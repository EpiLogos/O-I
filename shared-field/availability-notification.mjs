import { createEncounter } from './social.mjs';
import { validateWatch } from './watch.mjs';
import { validateA2aBinding, validateA2aPresence } from './a2a.mjs';

export const AVAILABILITY_EVENT_SCHEMA = 'oi.availability-event/v1';
export const NOTIFICATION_DECISION_SCHEMA = 'oi.notification-decision/v1';
export const NOTIFICATION_DELIVERY_SCHEMA = 'oi.notification-delivery/v1';
export const CENTRAL_PERSONAL_NOTIFY_ACTION = 'personal.notify';
export const OI_WATCH_NOTIFICATION_ACTION = 'oi.watch-availability.notify';

const REACHABLE = new Set(['online', 'degraded']);
const DECISIONS = new Set(['notify', 'suppress']);

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

function timestamp(value, name) {
  string(value, name);
  if (Number.isNaN(Date.parse(value))) throw new TypeError(`${name} must be an ISO timestamp`);
  return value;
}

function watchValue(value) {
  return validateWatch(value?.watch ?? value);
}

function currentParticipation(snapshot = {}) {
  const bindings = (snapshot.bindings ?? []).map(validateA2aBinding);
  const presence = (snapshot.presence ?? []).map(validateA2aPresence);
  const byBinding = new Map();
  for (const binding of bindings) {
    const current = presence
      .filter(candidate => candidate.binding_ref === binding.binding_ref && candidate.participant_ref === binding.participant_ref)
      .sort((a, b) => b.sequence - a.sequence)[0];
    byBinding.set(binding.binding_ref, {
      binding,
      presence: current,
      availability: binding.state === 'published' ? (current?.availability ?? 'offline') : 'withdrawn',
    });
  }
  return byBinding;
}

function watchMatchesBinding(watch, binding) {
  if (watch.state !== 'active' || watch.field_ref !== binding.field_ref) return false;
  if (watch.target.kind === 'agent') return watch.target.ref === binding.agent_ref;
  if (watch.target.kind === 'object') {
    return watch.target.ref === binding.projection_ref || watch.target.ref === binding.binding_ref;
  }
  return false;
}

export function createAvailabilityEvent(input) {
  record(input, 'availability event');
  const watch = validateWatch(input.watch);
  const binding = validateA2aBinding(input.binding);
  const presence = validateA2aPresence(input.presence);
  if (!watchMatchesBinding(watch, binding)) throw new TypeError('availability event Watch does not target the A2A Agent/Projection');
  if (presence.binding_ref !== binding.binding_ref || presence.participant_ref !== binding.participant_ref || presence.field_ref !== binding.field_ref) {
    throw new TypeError('availability event presence does not belong to the selected A2A binding');
  }
  const previousAvailability = input.previous_availability ?? 'offline';
  string(previousAvailability, 'availability event.previous_availability');
  if (!REACHABLE.has(presence.availability) || REACHABLE.has(previousAvailability)) {
    throw new TypeError('availability event requires a transition from unavailable to reachable');
  }
  const eventRef = input.event_ref ?? `availability:${watch.watch_ref}:${binding.binding_ref}:${presence.sequence}`;
  string(eventRef, 'availability event.event_ref');

  return {
    schema: AVAILABILITY_EVENT_SCHEMA,
    event_ref: eventRef,
    field_ref: binding.field_ref,
    watch_ref: watch.watch_ref,
    watcher_participant_ref: watch.watcher_participant_ref,
    target: clone(watch.target),
    subject: {
      agent_ref: binding.agent_ref,
      participant_ref: binding.participant_ref,
      binding_ref: binding.binding_ref,
      binding_revision: binding.binding_revision,
      ...(binding.projection_ref ? { projection_ref: binding.projection_ref } : {}),
    },
    previous_availability: previousAvailability,
    availability: presence.availability,
    observed_at: presence.observed_at,
    presence_sequence: presence.sequence,
    source: {
      kind: 'spacetimedb-subscription',
      relation: 'a2a-presence',
    },
    provenance: [
      { kind: 'watch', ref: watch.watch_ref, source_system: watch.provenance.source_system, revision: watch.provenance.source_revision },
      ...presence.provenance.map(entry => clone(entry)),
    ],
  };
}

export function deriveWatchAvailabilityEvents({ watches = [], previous = {}, current = {} }) {
  const activeWatches = watches.map(watchValue).filter(watch => watch.state === 'active');
  const before = currentParticipation(previous);
  const after = currentParticipation(current);
  const events = [];

  for (const { binding, presence, availability } of after.values()) {
    if (!presence || !REACHABLE.has(availability)) continue;
    const previousAvailability = before.get(binding.binding_ref)?.availability ?? 'offline';
    if (REACHABLE.has(previousAvailability)) continue;
    for (const watch of activeWatches) {
      if (!watchMatchesBinding(watch, binding)) continue;
      events.push(createAvailabilityEvent({ watch, binding, presence, previous_availability: previousAvailability }));
    }
  }
  return events;
}

export function availabilityEncounter(eventInput) {
  const event = validateAvailabilityEvent(eventInput);
  return createEncounter({
    encounter_ref: `encounter:${event.event_ref}`,
    field_ref: event.field_ref,
    participant_ref: event.watcher_participant_ref,
    occurred_at: event.observed_at,
    mediation: {
      kind: 'watch-availability',
      source_system: 'SpaceTimeDB',
      watch_ref: event.watch_ref,
      availability_event_ref: event.event_ref,
      binding_ref: event.subject.binding_ref,
    },
    items: [{ ref: event.target.ref, kind: event.target.kind }],
    provenance: [{
      kind: 'availability-event',
      ref: event.event_ref,
      source_system: 'O:I',
      revision: String(event.presence_sequence),
    }],
  });
}

export function validateAvailabilityEvent(value) {
  record(value, 'availability event');
  if (value.schema !== AVAILABILITY_EVENT_SCHEMA) throw new TypeError(`Unsupported availability event schema: ${value.schema}`);
  string(value.event_ref, 'availability event.event_ref');
  string(value.field_ref, 'availability event.field_ref');
  string(value.watch_ref, 'availability event.watch_ref');
  string(value.watcher_participant_ref, 'availability event.watcher_participant_ref');
  record(value.target, 'availability event.target');
  string(value.target.kind, 'availability event.target.kind');
  string(value.target.ref, 'availability event.target.ref');
  record(value.subject, 'availability event.subject');
  for (const key of ['agent_ref', 'participant_ref', 'binding_ref']) string(value.subject[key], `availability event.subject.${key}`);
  if (!Number.isInteger(value.subject.binding_revision) || value.subject.binding_revision < 1) throw new TypeError('availability event.subject.binding_revision must be positive');
  string(value.previous_availability, 'availability event.previous_availability');
  if (!REACHABLE.has(value.availability)) throw new TypeError('availability event.availability must be reachable');
  timestamp(value.observed_at, 'availability event.observed_at');
  if (!Number.isInteger(value.presence_sequence) || value.presence_sequence < 1) throw new TypeError('availability event.presence_sequence must be positive');
  return clone(value);
}

export function createNotificationDecision(eventInput, input = {}) {
  const event = validateAvailabilityEvent(eventInput);
  record(input, 'notification decision');
  const disposition = input.disposition ?? 'suppress';
  if (!DECISIONS.has(disposition)) throw new TypeError(`notification decision disposition must be one of: ${[...DECISIONS].join(', ')}`);
  const policyRef = string(input.policy_ref ?? 'oi:notification-policy:none', 'notification decision.policy_ref');
  const reason = string(input.reason ?? 'No notification policy requested delivery.', 'notification decision.reason');
  const decidedAt = timestamp(input.decided_at ?? event.observed_at, 'notification decision.decided_at');
  return {
    schema: NOTIFICATION_DECISION_SCHEMA,
    decision_ref: string(input.decision_ref ?? `notification-decision:${policyRef}:${event.event_ref}`, 'notification decision.decision_ref'),
    event_ref: event.event_ref,
    watch_ref: event.watch_ref,
    disposition,
    policy_ref: policyRef,
    reason,
    decided_at: decidedAt,
  };
}

export function validateNotificationDecision(value, eventInput) {
  record(value, 'notification decision');
  const event = validateAvailabilityEvent(eventInput);
  if (value.schema !== NOTIFICATION_DECISION_SCHEMA) throw new TypeError(`Unsupported notification decision schema: ${value.schema}`);
  string(value.decision_ref, 'notification decision.decision_ref');
  if (value.event_ref !== event.event_ref || value.watch_ref !== event.watch_ref) throw new TypeError('notification decision must refer to the availability event and Watch');
  if (!DECISIONS.has(value.disposition)) throw new TypeError('notification decision has unsupported disposition');
  string(value.policy_ref, 'notification decision.policy_ref');
  string(value.reason, 'notification decision.reason');
  timestamp(value.decided_at, 'notification decision.decided_at');
  return clone(value);
}

export function createCentralPersonalNotifyInvocation({ event: eventInput, encounter, decision: decisionInput }) {
  const event = validateAvailabilityEvent(eventInput);
  record(encounter, 'availability Encounter');
  const decision = validateNotificationDecision(decisionInput, event);
  if (decision.disposition !== 'notify') throw new TypeError('Central personal.notify invocation requires an explicit notify policy decision');
  if (encounter.encounter_ref !== `encounter:${event.event_ref}` || encounter.participant_ref !== event.watcher_participant_ref) {
    throw new TypeError('Central notification Encounter does not match the availability event');
  }
  return {
    action_id: CENTRAL_PERSONAL_NOTIFY_ACTION,
    input: {
      title: 'Watched subject available',
      body: `${event.subject.agent_ref} is ${event.availability} in ${event.field_ref}.`,
      subject_ref: event.target.ref,
      category: 'oi.watch-availability',
      action_ref: OI_WATCH_NOTIFICATION_ACTION,
      caller_ref: decision.decision_ref,
      provenance_refs: [
        event.watch_ref,
        event.event_ref,
        encounter.encounter_ref,
        decision.decision_ref,
        event.subject.binding_ref,
      ],
    },
  };
}

export function validateCentralPersonalNotifyDelivery(resultInput, invocation) {
  const result = record(resultInput, 'Central personal.notify ActionResult');
  if (invocation?.action_id !== CENTRAL_PERSONAL_NOTIFY_ACTION) throw new TypeError('notification delivery must come from Central personal.notify');
  if (result.ok !== true) throw new TypeError('Central personal.notify did not complete successfully');
  const data = record(result.data, 'Central personal.notify data');
  const delivery = record(data.delivery, 'Central personal.notify delivery');
  if (delivery.caller_ref !== invocation.input.caller_ref) throw new TypeError('Central notification caller lineage changed during delivery');
  if (delivery.subject_ref !== invocation.input.subject_ref) throw new TypeError('Central notification subject changed during delivery');
  if (delivery.action_ref !== invocation.input.action_ref) throw new TypeError('Central notification originating Action changed during delivery');
  if (delivery.human_acknowledgement_observed !== false || data.notification_delivery_is_human_acknowledgement !== false) {
    throw new TypeError('notification delivery must never be recorded as human acknowledgement');
  }
  return {
    schema: NOTIFICATION_DELIVERY_SCHEMA,
    action_id: CENTRAL_PERSONAL_NOTIFY_ACTION,
    request: clone(invocation.input),
    delivery: clone(delivery),
    human_acknowledgement_observed: false,
  };
}

/**
 * Compose the existing caller-filtered Watch View with the existing public A2A Projection/Explore
 * subscription. The runtime owns no authority table and no notification semantics: it derives a
 * bounded O:I availability Encounter, asks an explicit policy, and only then invokes Central's
 * canonical personal.notify Action. Initial/rebuilt snapshots are baselines and never deliveries.
 */
export function createWatchAvailabilityRuntime({
  watch_source,
  a2a_source,
  notification_policy,
  invoke_central_action,
  on_event,
  on_encounter,
  on_decision,
  on_delivery,
}) {
  if (!watch_source || typeof watch_source.snapshot !== 'function' || typeof watch_source.subscribe !== 'function') {
    throw new TypeError('watch_source must expose snapshot() and subscribe()');
  }
  if (!a2a_source || typeof a2a_source.snapshot !== 'function' || typeof a2a_source.subscribe !== 'function') {
    throw new TypeError('a2a_source must expose snapshot() and subscribe()');
  }
  if (notification_policy !== undefined && typeof notification_policy !== 'function') throw new TypeError('notification_policy must be a function when supplied');
  if (invoke_central_action !== undefined && typeof invoke_central_action !== 'function') throw new TypeError('invoke_central_action must be a function when supplied');

  let watches = watch_source.snapshot().map(watchValue);
  let previous = a2a_source.snapshot();
  const processed = new Set();
  let queue = Promise.resolve();

  const processChange = async () => {
    const current = a2a_source.snapshot();
    const events = deriveWatchAvailabilityEvents({ watches, previous, current });
    previous = current;
    for (const event of events) {
      if (processed.has(event.event_ref)) continue;
      processed.add(event.event_ref);
      const encounter = availabilityEncounter(event);
      on_event?.(clone(event));
      on_encounter?.(clone(encounter));

      let decision;
      if (notification_policy) {
        const candidate = await notification_policy({ event: clone(event), encounter: clone(encounter) });
        decision = candidate?.schema === NOTIFICATION_DECISION_SCHEMA
          ? validateNotificationDecision(candidate, event)
          : createNotificationDecision(event, candidate ?? {});
      } else {
        decision = createNotificationDecision(event, {
          disposition: 'suppress',
          policy_ref: 'oi:notification-policy:none',
          reason: 'Watch records interest only; no notification policy was supplied.',
        });
      }
      on_decision?.(clone(decision));
      if (decision.disposition !== 'notify') continue;
      if (!invoke_central_action) throw new TypeError('notify decision requires invoke_central_action for Central personal.notify');

      const invocation = createCentralPersonalNotifyInvocation({ event, encounter, decision });
      const result = await invoke_central_action(invocation.action_id, clone(invocation.input));
      const delivery = validateCentralPersonalNotifyDelivery(result, invocation);
      on_delivery?.(clone(delivery));
    }
  };

  const stopWatch = watch_source.subscribe(() => {
    watches = watch_source.snapshot().map(watchValue);
  });
  const stopA2a = a2a_source.subscribe(() => {
    queue = queue.then(processChange);
  });

  return Object.freeze({
    refresh() {
      watches = watch_source.snapshot().map(watchValue);
      previous = a2a_source.snapshot();
    },
    flush() {
      return queue;
    },
    dispose() {
      stopA2a?.();
      stopWatch?.();
    },
  });
}
