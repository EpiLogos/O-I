import { createProjection, validateParticipant } from './index.mjs';
import { createContribution, createEncounter } from './social.mjs';

export const A2A_BINDING_SCHEMA = 'oi.a2a-binding/v1';
export const A2A_PRESENCE_SCHEMA = 'oi.a2a-presence/v1';
export const A2A_DIFFERENCE_SCHEMA = 'oi.a2a-difference/v1';
export const A2A_ADMISSION_SCHEMA = 'oi.a2a-admission/v1';
export const A2A_PROTOCOL_VERSION = '1.0';
export const A2A_PROTOCOL_BINDING = 'HTTP+JSON';

const BINDING_STATES = new Set(['published', 'withdrawn']);
const AVAILABILITY_STATES = new Set(['online', 'degraded', 'offline', 'withdrawn']);
const ADMISSION_DISPOSITIONS = new Set(['reject', 'contribution', 'projection', 'contribution+projection']);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function record(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function string(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function integer(value, name) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

function timestamp(value, name) {
  string(value, name);
  if (Number.isNaN(Date.parse(value))) throw new TypeError(`${name} must be an ISO timestamp`);
  return value;
}

function publicUrl(value, name) {
  string(value, name);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${name} must be an absolute URL`);
  }
  const localDevelopment = url.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localDevelopment) throw new TypeError(`${name} must use HTTPS outside loopback development`);
  if (url.username || url.password) throw new TypeError(`${name} must not embed credentials`);
  if (url.search || url.hash) throw new TypeError(`${name} must not expose query credentials or fragments`);
  return url.toString().replace(/\/$/, '');
}

function provenance(value, name) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${name} must be a non-empty array`);
  return value.map((entry, index) => {
    record(entry, `${name}[${index}]`);
    string(entry.kind, `${name}[${index}].kind`);
    string(entry.ref, `${name}[${index}].ref`);
    string(entry.source_system, `${name}[${index}].source_system`);
    return clone(entry);
  });
}

/**
 * An A2A binding is a revocable transport relation projected by an existing Participant.
 * It is never the Participant or canonical Agent identity. Publication requires an explicit
 * attributable decision; local runtime discovery alone cannot call this constructor successfully.
 */
export function createA2aBinding(input) {
  record(input, 'A2A binding');
  string(input.binding_ref, 'A2A binding.binding_ref');
  integer(input.binding_revision ?? 1, 'A2A binding.binding_revision');
  string(input.field_ref, 'A2A binding.field_ref');
  string(input.participant_ref, 'A2A binding.participant_ref');
  string(input.agent_ref, 'A2A binding.agent_ref');
  string(input.publisher_participant_ref, 'A2A binding.publisher_participant_ref');
  string(input.publication_decision_ref, 'A2A binding.publication_decision_ref');
  string(input.source_revision, 'A2A binding.source_revision');
  timestamp(input.published_at, 'A2A binding.published_at');

  if (input.agent_ref === input.participant_ref || input.binding_ref === input.participant_ref || input.binding_ref === input.agent_ref) {
    throw new TypeError('A2A binding, Participant and Agent semantic refs must remain distinct');
  }

  const state = input.state ?? 'published';
  if (!BINDING_STATES.has(state)) throw new TypeError(`Unsupported A2A binding state: ${state}`);

  const protocolVersion = input.protocol_version ?? A2A_PROTOCOL_VERSION;
  const protocolBinding = input.protocol_binding ?? A2A_PROTOCOL_BINDING;
  if (protocolVersion !== A2A_PROTOCOL_VERSION) throw new TypeError(`A2A protocol_version must be ${A2A_PROTOCOL_VERSION}`);
  if (protocolBinding !== A2A_PROTOCOL_BINDING) throw new TypeError(`A2A protocol_binding must be ${A2A_PROTOCOL_BINDING}`);

  const binding = {
    schema: A2A_BINDING_SCHEMA,
    binding_ref: input.binding_ref,
    binding_revision: input.binding_revision ?? 1,
    field_ref: input.field_ref,
    participant_ref: input.participant_ref,
    agent_ref: input.agent_ref,
    publisher_participant_ref: input.publisher_participant_ref,
    publication_decision_ref: input.publication_decision_ref,
    source_revision: input.source_revision,
    published_at: input.published_at,
    state,
    protocol_version: protocolVersion,
    protocol_binding: protocolBinding,
    provenance: provenance(input.provenance, 'A2A binding.provenance'),
  };

  if (input.projection_ref !== undefined) binding.projection_ref = string(input.projection_ref, 'A2A binding.projection_ref');

  if (state === 'published') {
    binding.endpoint_url = publicUrl(input.endpoint_url, 'A2A binding.endpoint_url');
    binding.agent_card_url = publicUrl(input.agent_card_url, 'A2A binding.agent_card_url');
  } else if (input.endpoint_url !== undefined || input.agent_card_url !== undefined) {
    throw new TypeError('withdrawn A2A bindings must not retain public endpoint locators');
  }

  return binding;
}

export function validateA2aBinding(binding) {
  record(binding, 'A2A binding');
  if (binding.schema !== A2A_BINDING_SCHEMA) throw new TypeError(`Unsupported A2A binding schema: ${binding.schema}`);
  return createA2aBinding(binding);
}

export function createA2aPresence(input) {
  record(input, 'A2A presence');
  string(input.binding_ref, 'A2A presence.binding_ref');
  string(input.field_ref, 'A2A presence.field_ref');
  string(input.participant_ref, 'A2A presence.participant_ref');
  integer(input.sequence, 'A2A presence.sequence');
  timestamp(input.observed_at, 'A2A presence.observed_at');
  if (!AVAILABILITY_STATES.has(input.availability)) throw new TypeError(`Unsupported A2A availability: ${input.availability}`);
  return {
    schema: A2A_PRESENCE_SCHEMA,
    binding_ref: input.binding_ref,
    field_ref: input.field_ref,
    participant_ref: input.participant_ref,
    availability: input.availability,
    sequence: input.sequence,
    observed_at: input.observed_at,
    provenance: provenance(input.provenance, 'A2A presence.provenance'),
  };
}

export function validateA2aPresence(presence) {
  record(presence, 'A2A presence');
  if (presence.schema !== A2A_PRESENCE_SCHEMA) throw new TypeError(`Unsupported A2A presence schema: ${presence.schema}`);
  return createA2aPresence(presence);
}

/** Resolve semantic Agent -> Participant -> explicitly published binding -> live availability. */
export function resolveA2aParticipation({ agent_ref, participants, bindings, presence }) {
  string(agent_ref, 'agent_ref');
  if (!Array.isArray(participants) || !Array.isArray(bindings) || !Array.isArray(presence)) throw new TypeError('participants, bindings and presence must be arrays');

  const participant = participants.map(validateParticipant).find((candidate) => candidate.identity.kind === 'agent' && candidate.identity.ref === agent_ref);
  if (!participant) return undefined;

  const candidates = bindings.map(validateA2aBinding)
    .filter((binding) => binding.agent_ref === agent_ref && binding.participant_ref === participant.participant_ref && binding.field_ref === participant.field_ref)
    .sort((a, b) => b.binding_revision - a.binding_revision);
  const binding = candidates.find((candidate) => candidate.state === 'published');
  if (!binding) return { agent_ref, participant, binding: undefined, presence: undefined };

  const currentPresence = presence.map(validateA2aPresence)
    .filter((candidate) => candidate.binding_ref === binding.binding_ref && candidate.participant_ref === participant.participant_ref)
    .sort((a, b) => b.sequence - a.sequence)[0];

  return { agent_ref, participant, binding, presence: currentPresence };
}

function assertA2aCard(card, binding) {
  record(card, 'A2A Agent Card');
  string(card.name, 'A2A Agent Card.name');
  if (!Array.isArray(card.supportedInterfaces)) throw new TypeError('A2A Agent Card.supportedInterfaces must be an array');
  const expectedEndpoint = publicUrl(binding.endpoint_url, 'A2A binding.endpoint_url');
  const selected = card.supportedInterfaces.find((candidate) => {
    if (!candidate || typeof candidate !== 'object') return false;
    try {
      return candidate.protocolBinding === binding.protocol_binding
        && candidate.protocolVersion === binding.protocol_version
        && publicUrl(candidate.url, 'A2A AgentInterface.url') === expectedEndpoint;
    } catch {
      return false;
    }
  });
  if (!selected) throw new TypeError('A2A Agent Card does not advertise the explicitly published interface');
  return clone(selected);
}

function a2aSendUrl(interfaceUrl, tenant) {
  const base = publicUrl(interfaceUrl, 'A2A AgentInterface.url');
  return `${base}/${tenant ? `${encodeURIComponent(tenant)}/` : ''}message:send`;
}

function transportRef(response) {
  if (response.task) return { kind: 'task', ref: string(response.task.id, 'A2A Task.id') };
  if (response.message) return { kind: 'message', ref: string(response.message.messageId, 'A2A Message.messageId') };
  throw new TypeError('A2A SendMessageResponse must contain task or message');
}

/**
 * Source-faithful A2A HTTP+JSON v1 exchange. Runtime auth is passed only as request headers;
 * credentials never enter the hosted binding contract or returned SharedField difference.
 */
export async function performA2aExchange({ binding, presence, initiator_participant_ref, message, fetch_impl = globalThis.fetch, authorization_headers = {} }) {
  const currentBinding = validateA2aBinding(binding);
  const currentPresence = validateA2aPresence(presence);
  string(initiator_participant_ref, 'initiator_participant_ref');
  record(message, 'A2A message');
  string(message.message_id, 'A2A message.message_id');
  string(message.text, 'A2A message.text');
  if (typeof fetch_impl !== 'function') throw new TypeError('fetch_impl must be a function');
  if (currentBinding.state !== 'published') throw new TypeError('A2A exchange requires an explicitly published binding');
  if (currentPresence.binding_ref !== currentBinding.binding_ref || currentPresence.participant_ref !== currentBinding.participant_ref) {
    throw new TypeError('A2A presence must belong to the selected binding/Participant');
  }
  if (!['online', 'degraded'].includes(currentPresence.availability)) throw new TypeError(`A2A endpoint is not currently reachable: ${currentPresence.availability}`);

  const cardResponse = await fetch_impl(currentBinding.agent_card_url, { headers: { Accept: 'application/json', ...authorization_headers } });
  if (!cardResponse?.ok) throw new Error(`A2A Agent Card fetch failed: ${cardResponse?.status ?? 'unknown'}`);
  const card = await cardResponse.json();
  const selectedInterface = assertA2aCard(card, currentBinding);

  const request = {
    ...(selectedInterface.tenant ? { tenant: selectedInterface.tenant } : {}),
    message: {
      messageId: message.message_id,
      role: 'ROLE_USER',
      parts: [{ text: message.text }],
    },
  };
  const response = await fetch_impl(a2aSendUrl(selectedInterface.url, selectedInterface.tenant), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/a2a+json',
      Accept: 'application/a2a+json',
      'A2A-Version': currentBinding.protocol_version,
      ...authorization_headers,
    },
    body: JSON.stringify(request),
  });
  if (!response?.ok) throw new Error(`A2A message exchange failed: ${response?.status ?? 'unknown'}`);
  const payload = await response.json();
  const result = transportRef(payload);

  return {
    schema: A2A_DIFFERENCE_SCHEMA,
    exchange_ref: message.exchange_ref ?? `a2a-exchange:${message.message_id}`,
    field_ref: currentBinding.field_ref,
    initiator_participant_ref,
    recipient_participant_ref: currentBinding.participant_ref,
    agent_ref: currentBinding.agent_ref,
    binding_ref: currentBinding.binding_ref,
    binding_revision: currentBinding.binding_revision,
    request_message_id: message.message_id,
    transport_result: { ...result, payload: clone(payload) },
    admission: 'pending',
    transport_provenance: {
      protocol: 'A2A',
      protocol_version: currentBinding.protocol_version,
      protocol_binding: currentBinding.protocol_binding,
      agent_card: { name: card.name, version: card.version, url: currentBinding.agent_card_url },
    },
  };
}

export function validateA2aDifference(value) {
  record(value, 'A2A difference');
  if (value.schema !== A2A_DIFFERENCE_SCHEMA) throw new TypeError(`Unsupported A2A difference schema: ${value.schema}`);
  string(value.exchange_ref, 'A2A difference.exchange_ref');
  string(value.field_ref, 'A2A difference.field_ref');
  string(value.initiator_participant_ref, 'A2A difference.initiator_participant_ref');
  string(value.recipient_participant_ref, 'A2A difference.recipient_participant_ref');
  string(value.agent_ref, 'A2A difference.agent_ref');
  string(value.binding_ref, 'A2A difference.binding_ref');
  integer(value.binding_revision, 'A2A difference.binding_revision');
  string(value.request_message_id, 'A2A difference.request_message_id');
  record(value.transport_result, 'A2A difference.transport_result');
  if (!['task', 'message'].includes(value.transport_result.kind)) throw new TypeError('A2A transport result must be task or message');
  string(value.transport_result.ref, 'A2A difference.transport_result.ref');
  if (value.admission !== 'pending') throw new TypeError('received A2A difference must begin pending explicit admission');
  return clone(value);
}

/** Record direct availability of the returned difference without claiming subjective experience. */
export function encounterA2aDifference(difference, input) {
  const value = validateA2aDifference(difference);
  record(input, 'A2A encounter');
  return createEncounter({
    encounter_ref: string(input.encounter_ref, 'A2A encounter.encounter_ref'),
    field_ref: value.field_ref,
    participant_ref: string(input.participant_ref, 'A2A encounter.participant_ref'),
    occurred_at: timestamp(input.occurred_at, 'A2A encounter.occurred_at'),
    mediation: {
      kind: 'direct-address',
      protocol: 'A2A',
      binding_ref: value.binding_ref,
      transport_kind: value.transport_result.kind,
      transport_ref: value.transport_result.ref,
    },
    items: [{ ref: value.exchange_ref, kind: A2A_DIFFERENCE_SCHEMA }],
    provenance: [{ kind: 'a2a-exchange', ref: value.exchange_ref, source_system: 'A2A', revision: String(value.binding_revision) }],
  });
}

/**
 * Admission is the only bridge from transport result to SharedField semantic material.
 * It intentionally does not create Actuation Determination/Return or Factory Run identities.
 */
export function admitA2aDifference(difference, input) {
  const value = validateA2aDifference(difference);
  record(input, 'A2A admission');
  string(input.decision_ref, 'A2A admission.decision_ref');
  string(input.decided_by_participant_ref, 'A2A admission.decided_by_participant_ref');
  timestamp(input.decided_at, 'A2A admission.decided_at');
  if (!ADMISSION_DISPOSITIONS.has(input.disposition)) throw new TypeError(`Unsupported A2A admission disposition: ${input.disposition}`);

  const receipt = {
    schema: A2A_ADMISSION_SCHEMA,
    decision_ref: input.decision_ref,
    exchange_ref: value.exchange_ref,
    field_ref: value.field_ref,
    disposition: input.disposition,
    decided_by_participant_ref: input.decided_by_participant_ref,
    decided_at: input.decided_at,
    transport_provenance: {
      binding_ref: value.binding_ref,
      binding_revision: value.binding_revision,
      transport_kind: value.transport_result.kind,
      transport_ref: value.transport_result.ref,
    },
  };

  if (input.disposition.includes('contribution')) {
    record(input.contribution, 'A2A admission.contribution');
    receipt.contribution = createContribution({
      contribution_ref: string(input.contribution.contribution_ref, 'A2A admission.contribution.contribution_ref'),
      field_ref: value.field_ref,
      contributor_participant_ref: input.decided_by_participant_ref,
      created_at: input.decided_at,
      mode: input.contribution.mode ?? 'finding',
      target: record(input.contribution.target, 'A2A admission.contribution.target'),
      relation: { kind: input.contribution.relation_kind ?? 'returned-difference' },
      representation: { kind: 'a2a-return', payload: clone(value.transport_result.payload) },
      provenance: [
        { kind: 'a2a-exchange', ref: value.exchange_ref, source_system: 'A2A', revision: String(value.binding_revision) },
        { kind: 'admission-decision', ref: input.decision_ref, source_system: 'O:I' },
      ],
      source: { system: 'A2A', revision: value.transport_result.ref },
    });
  }

  if (input.disposition.includes('projection')) {
    record(input.projection, 'A2A admission.projection');
    receipt.projection = createProjection({
      projection_ref: string(input.projection.projection_ref, 'A2A admission.projection.projection_ref'),
      projection_revision: input.projection.projection_revision ?? 1,
      state: 'published',
      subject: input.projection.subject ?? { ref: value.exchange_ref, kind: A2A_DIFFERENCE_SCHEMA },
      source: { system: 'A2A', revision: value.transport_result.ref },
      publisher_participant_ref: input.decided_by_participant_ref,
      published_at: input.decided_at,
      audience: input.projection.audience ?? { visibility: 'public' },
      representation: { kind: 'a2a-return', payload: clone(value.transport_result.payload) },
      provenance: [
        { kind: 'a2a-exchange', ref: value.exchange_ref, source_system: 'A2A', revision: String(value.binding_revision) },
        { kind: 'admission-decision', ref: input.decision_ref, source_system: 'O:I' },
      ],
    });
  }

  return receipt;
}
