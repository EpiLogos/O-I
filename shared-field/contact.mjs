const CONTACT_STATES = new Set(['pending', 'accepted', 'declined', 'redirected', 'narrowed', 'expired']);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function requireObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function requireString(value, name, max = 4096) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  if (value.length > max) throw new TypeError(`${name} must be at most ${max} characters`);
  return value;
}

function requireMicros(value, name) {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) {
    throw new TypeError(`${name} must be an unsigned microsecond timestamp string`);
  }
  return value;
}

export function validateContact(value) {
  const contact = clone(requireObject(value, 'Contact'));
  if (contact.schema !== 'oi.contact/v1') throw new TypeError(`Unsupported Contact schema: ${contact.schema}`);
  requireString(contact.contact_ref, 'Contact contact_ref', 512);
  requireString(contact.field_ref, 'Contact field_ref', 512);
  requireString(contact.initiator_participant_ref, 'Contact initiator_participant_ref', 512);
  requireString(contact.recipient_participant_ref, 'Contact recipient_participant_ref', 512);
  if (contact.initiator_participant_ref === contact.recipient_participant_ref) {
    throw new TypeError('Contact initiator and recipient must be distinct Participants');
  }
  if (!CONTACT_STATES.has(contact.state)) throw new TypeError(`Unsupported Contact state: ${contact.state}`);
  requireString(contact.purpose, 'Contact purpose', 500);
  requireObject(contact.requested_scope, 'Contact requested_scope');
  requireObject(contact.provenance, 'Contact provenance');
  const created = BigInt(requireMicros(contact.timing?.created_micros, 'Contact timing.created_micros'));
  const expires = BigInt(requireMicros(contact.timing?.expires_micros, 'Contact timing.expires_micros'));
  if (expires <= created) throw new TypeError('Contact expiry must be after creation');
  if (contact.response !== undefined) requireObject(contact.response, 'Contact response');
  return contact;
}

export function createContact(input = {}) {
  return validateContact({
    schema: 'oi.contact/v1',
    contact_ref: input.contact_ref,
    field_ref: input.field_ref,
    initiator_participant_ref: input.initiator_participant_ref,
    recipient_participant_ref: input.recipient_participant_ref,
    state: input.state ?? 'pending',
    purpose: input.purpose,
    requested_scope: clone(input.requested_scope ?? {}),
    timing: {
      created_micros: String(input.created_micros),
      expires_micros: String(input.expires_micros),
    },
    ...(input.response === undefined ? {} : { response: clone(input.response) }),
    provenance: clone(input.provenance ?? {}),
  });
}
