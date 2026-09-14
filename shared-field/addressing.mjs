export const PARTICIPANT_ADDRESS_SCHEMA = 'aikit.participant-address/v1';
export const PARTICIPANT_TARGET_KINDS = Object.freeze(['human', 'agent', 'agent-set']);

const TARGET_KINDS = new Set(PARTICIPANT_TARGET_KINDS);

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * Portable participant target parity with AIKit's `ParticipantTarget`.
 *
 * The value names who is addressed. It carries no membership mutation,
 * invocation permission, Action authority or attention classification.
 */
export function createParticipantTarget(input) {
  record(input, 'participant target');
  const kind = text(input.kind, 'participant target.kind');
  if (!TARGET_KINDS.has(kind)) {
    throw new TypeError(`participant target.kind must be one of ${PARTICIPANT_TARGET_KINDS.join(', ')}`);
  }
  const participant = text(input.participant, 'participant target.participant');
  const address = text(input.address, 'participant target.address');
  if (!address.startsWith('@') || address.length < 2 || /\s/.test(address)) {
    throw new TypeError('participant target.address must be a non-empty @token without whitespace');
  }
  return Object.freeze({ kind, participant, address });
}

/**
 * One structured `To:` + `@` grammar for human, Agent and AgentSet addressees.
 * This deliberately mirrors the accepted AIKit contract rather than creating a
 * desktop-local recipient identity.
 */
export function createParticipantAddress(input = {}) {
  record(input, 'participant address');
  const to = listTargets(input.to, 'participant address.to');
  const mentions = listTargets(input.mentions, 'participant address.mentions');
  const seen = new Set();
  for (const target of [...to, ...mentions]) {
    const key = `${target.kind}\u0000${target.participant}\u0000${target.address}`;
    if (seen.has(key)) throw new TypeError(`participant target ${target.address} is duplicated`);
    seen.add(key);
  }
  return Object.freeze({
    version: PARTICIPANT_ADDRESS_SCHEMA,
    to,
    mentions,
  });
}

export function validateParticipantAddress(value) {
  record(value, 'participant address');
  if (value.version !== PARTICIPANT_ADDRESS_SCHEMA) {
    throw new TypeError(`Unsupported participant address version: ${value.version}`);
  }
  return createParticipantAddress(value);
}

/**
 * Project a typed address onto an existing SharedField contribution without
 * changing the contribution's authored representation. Addressing is envelope
 * metadata: it is distinct from membership, invocation, authority and attention.
 */
export function addressedContribution(contribution, address) {
  const value = record(contribution, 'contribution');
  if (value.schema !== 'oi.contribution/v1') {
    throw new TypeError(`Unsupported Contribution schema: ${value.schema}`);
  }
  return {
    ...clone(value),
    addressing: validateParticipantAddress(address),
  };
}

/**
 * Private dialogue is the minimal dialogical SharedField composition. This
 * helper materialises only the field relation; dialogue history is not bound to
 * an AgentSession and no participant/session is created implicitly.
 */
export function privateDialogueField({ field_ref, participant_refs, provenance, title }) {
  text(field_ref, 'private dialogue.field_ref');
  if (!Array.isArray(participant_refs) || participant_refs.length < 2) {
    throw new TypeError('private dialogue.participant_refs requires at least two stable participant refs');
  }
  const participants = [...new Set(participant_refs.map((ref, index) => text(ref, `private dialogue.participant_refs[${index}]`)))];
  if (participants.length < 2) throw new TypeError('private dialogue requires at least two distinct participant refs');
  if (!Array.isArray(provenance) || provenance.length === 0) {
    throw new TypeError('private dialogue.provenance must be a non-empty array');
  }
  return {
    schema: 'oi.shared-field/v1',
    field_ref,
    kind: 'dialogue',
    visibility: 'private',
    ...(title ? { title: text(title, 'private dialogue.title') } : {}),
    participant_refs: participants,
    provenance: clone(provenance),
  };
}

function listTargets(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value.map((target, index) => createParticipantTarget(record(target, `${name}[${index}]`)));
}
