import { createA2aBinding, validateA2aBinding } from './a2a.mjs';

function requireRecord(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

/**
 * Replace current transport material without changing Agent, Participant or binding identity.
 * Every replacement is a new semantic binding revision and requires a fresh publication decision.
 */
export function reviseA2aBinding(previous, update) {
  const prior = validateA2aBinding(previous);
  requireRecord(update, 'A2A binding revision');
  if (prior.state !== 'published') throw new TypeError('Cannot replace a withdrawn A2A binding');
  requireString(update.publication_decision_ref, 'A2A binding revision.publication_decision_ref');
  if (update.publication_decision_ref === prior.publication_decision_ref) {
    throw new TypeError('A2A endpoint replacement requires a fresh explicit publication decision');
  }

  return createA2aBinding({
    ...prior,
    binding_revision: prior.binding_revision + 1,
    publication_decision_ref: update.publication_decision_ref,
    source_revision: requireString(update.source_revision, 'A2A binding revision.source_revision'),
    published_at: requireString(update.published_at, 'A2A binding revision.published_at'),
    endpoint_url: update.endpoint_url ?? prior.endpoint_url,
    agent_card_url: update.agent_card_url ?? prior.agent_card_url,
    provenance: update.provenance ?? prior.provenance,
    state: 'published',
  });
}

/** Withdraw current reachability while preserving the semantic relation and history. */
export function withdrawA2aBinding(previous, input) {
  const prior = validateA2aBinding(previous);
  requireRecord(input, 'A2A binding withdrawal');
  if (prior.state === 'withdrawn') return prior;
  requireString(input.publication_decision_ref, 'A2A binding withdrawal.publication_decision_ref');
  if (input.publication_decision_ref === prior.publication_decision_ref) {
    throw new TypeError('A2A withdrawal requires a fresh explicit publication decision');
  }

  return createA2aBinding({
    binding_ref: prior.binding_ref,
    binding_revision: prior.binding_revision + 1,
    field_ref: prior.field_ref,
    participant_ref: prior.participant_ref,
    agent_ref: prior.agent_ref,
    publisher_participant_ref: prior.publisher_participant_ref,
    publication_decision_ref: input.publication_decision_ref,
    source_revision: requireString(input.source_revision, 'A2A binding withdrawal.source_revision'),
    published_at: requireString(input.published_at, 'A2A binding withdrawal.published_at'),
    state: 'withdrawn',
    protocol_version: prior.protocol_version,
    protocol_binding: prior.protocol_binding,
    ...(prior.projection_ref ? { projection_ref: prior.projection_ref } : {}),
    provenance: input.provenance ?? prior.provenance,
  });
}
