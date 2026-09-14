export const ACTIVITY_SCHEMA = 'oi.activity/v1';
export const NOTIFICATION_SCHEMA = 'oi.notification/v1';
export const ATTENTION_SCHEMA = 'oi.attention/v1';

export const ACTIVITY_PHASES = Object.freeze([
  'queued',
  'active',
  'waiting',
  'completed',
  'failed',
  'cancelled',
]);

const PHASES = new Set(ACTIVITY_PHASES);
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

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

function timestamp(value, name) {
  text(value, name);
  if (Number.isNaN(Date.parse(value))) throw new TypeError(`${name} must be an ISO timestamp`);
  return value;
}

function strings(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value.map((entry, index) => text(entry, `${name}[${index}]`));
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function semanticRef(value, name) {
  const ref = record(value, name);
  return {
    ref: text(ref.ref, `${name}.ref`),
    kind: text(ref.kind, `${name}.kind`),
  };
}

function provenance(value, name) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${name} must be a non-empty array`);
  return clone(value);
}

/**
 * Portable semantic observation of actuality unfolding.
 *
 * Native products determine what happened. This envelope does not promote a
 * provider event into a canonical Action merely because one was observed.
 */
export function createActivity(input) {
  record(input, 'activity');
  const phase = text(input.phase, 'activity.phase');
  if (!PHASES.has(phase)) throw new TypeError(`activity.phase must be one of ${ACTIVITY_PHASES.join(', ')}`);
  const startedAt = timestamp(input.started_at, 'activity.started_at');
  const updatedAt = timestamp(input.updated_at ?? startedAt, 'activity.updated_at');
  if (Date.parse(updatedAt) < Date.parse(startedAt)) throw new TypeError('activity.updated_at cannot precede activity.started_at');

  return {
    schema: ACTIVITY_SCHEMA,
    activity_ref: text(input.activity_ref, 'activity.activity_ref'),
    revision: Number.isInteger(input.revision) && input.revision > 0 ? input.revision : 1,
    native_owner: text(input.native_owner, 'activity.native_owner'),
    ...(input.actor_ref ? { actor_ref: text(input.actor_ref, 'activity.actor_ref') } : {}),
    ...(input.agency_ref ? { agency_ref: text(input.agency_ref, 'activity.agency_ref') } : {}),
    ...(input.agent_session_ref ? { agent_session_ref: text(input.agent_session_ref, 'activity.agent_session_ref') } : {}),
    subject: semanticRef(input.subject, 'activity.subject'),
    ...(input.action_ref ? { action_ref: text(input.action_ref, 'activity.action_ref') } : {}),
    ...(input.invocation_ref ? { invocation_ref: text(input.invocation_ref, 'activity.invocation_ref') } : {}),
    verb: text(input.verb, 'activity.verb'),
    ...(input.object_ref ? { object_ref: text(input.object_ref, 'activity.object_ref') } : {}),
    semantic_summary: text(input.semantic_summary, 'activity.semantic_summary'),
    phase,
    ...(input.outcome !== undefined ? { outcome: clone(input.outcome) } : {}),
    ...(input.salience ? { salience: text(input.salience, 'activity.salience') } : {}),
    needs_attention: input.needs_attention === true,
    result_refs: strings(input.result_refs, 'activity.result_refs'),
    evidence_refs: strings(input.evidence_refs, 'activity.evidence_refs'),
    ...(input.return_ref ? { return_ref: text(input.return_ref, 'activity.return_ref') } : {}),
    ...(input.trace_ref ? { trace_ref: text(input.trace_ref, 'activity.trace_ref') } : {}),
    started_at: startedAt,
    updated_at: updatedAt,
    provenance: provenance(input.provenance, 'activity.provenance'),
  };
}

export function validateActivity(value) {
  record(value, 'activity');
  if (value.schema !== ACTIVITY_SCHEMA) throw new TypeError(`Unsupported Activity schema: ${value.schema}`);
  return createActivity(value);
}

/**
 * Evolve one visible Activity in place. Identity and native owner cannot drift;
 * terminal phases cannot silently reopen. Rich raw trace remains referenced as
 * evidence rather than copied into semantic UI state.
 */
export function advanceActivity(previous, update) {
  const prior = validateActivity(previous);
  record(update, 'activity update');
  if (update.activity_ref && update.activity_ref !== prior.activity_ref) {
    throw new TypeError('activity update cannot change ActivityRef');
  }
  if (update.native_owner && update.native_owner !== prior.native_owner) {
    throw new TypeError('activity update cannot change native owner');
  }
  const phase = update.phase ?? prior.phase;
  if (TERMINAL.has(prior.phase) && phase !== prior.phase) {
    throw new TypeError(`terminal Activity ${prior.activity_ref} cannot transition from ${prior.phase} to ${phase}`);
  }
  return createActivity({
    ...prior,
    ...clone(update),
    activity_ref: prior.activity_ref,
    native_owner: prior.native_owner,
    revision: prior.revision + 1,
    subject: update.subject ?? prior.subject,
    provenance: update.provenance ?? prior.provenance,
    started_at: prior.started_at,
    updated_at: update.updated_at ?? prior.updated_at,
  });
}

/**
 * Honest fallback for a meaningful native/provider event whose richer semantic
 * mapping is unavailable. It remains Activity, but never pretends to be Action.
 */
export function genericObservedActivity(input) {
  record(input, 'generic observed activity');
  return createActivity({
    ...input,
    action_ref: undefined,
    invocation_ref: undefined,
    verb: input.verb ?? 'Observed',
    semantic_summary: input.semantic_summary ?? `Observed native activity from ${text(input.native_owner, 'generic observed activity.native_owner')}.`,
  });
}

/** Notification is an optional transient projection of a changed Activity. */
export function notificationFromActivity(activity, input) {
  const value = validateActivity(activity);
  record(input, 'notification projection');
  return {
    schema: NOTIFICATION_SCHEMA,
    notification_ref: text(input.notification_ref, 'notification.notification_ref'),
    activity_ref: value.activity_ref,
    subject: clone(value.subject),
    semantic_summary: value.semantic_summary,
    projected_at: timestamp(input.projected_at, 'notification.projected_at'),
    destination: text(input.destination, 'notification.destination'),
    deep_link_ref: text(input.deep_link_ref ?? value.activity_ref, 'notification.deep_link_ref'),
  };
}

/**
 * Attention is unresolved human-facing work and exists only when the semantic
 * owner explicitly says attention is needed. O:I does not infer importance from prose.
 */
export function attentionFromActivity(activity, input) {
  const value = validateActivity(activity);
  if (!value.needs_attention) {
    throw new TypeError(`Activity ${value.activity_ref} does not declare needs_attention`);
  }
  record(input, 'attention projection');
  return {
    schema: ATTENTION_SCHEMA,
    attention_ref: text(input.attention_ref, 'attention.attention_ref'),
    activity_ref: value.activity_ref,
    subject: clone(value.subject),
    reason: text(input.reason, 'attention.reason'),
    state: 'open',
    created_at: timestamp(input.created_at, 'attention.created_at'),
    deep_link_ref: text(input.deep_link_ref ?? value.activity_ref, 'attention.deep_link_ref'),
    native_owner: value.native_owner,
  };
}

export function resolveAttention(attention, input) {
  const value = record(attention, 'attention');
  if (value.schema !== ATTENTION_SCHEMA) throw new TypeError(`Unsupported Attention schema: ${value.schema}`);
  if (value.state !== 'open') throw new TypeError(`Attention ${value.attention_ref} is already resolved`);
  record(input, 'attention resolution');
  return {
    ...clone(value),
    state: 'resolved',
    resolved_at: timestamp(input.resolved_at, 'attention.resolved_at'),
    resolution_ref: text(input.resolution_ref, 'attention.resolution_ref'),
  };
}
