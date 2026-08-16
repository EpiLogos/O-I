import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatch } from './watch.mjs';
import { createA2aBinding, createA2aPresence } from './a2a.mjs';
import {
  AVAILABILITY_EVENT_SCHEMA,
  CENTRAL_PERSONAL_NOTIFY_ACTION,
  NOTIFICATION_DECISION_SCHEMA,
  createNotificationDecision,
  createWatchAvailabilityRuntime,
  deriveWatchAvailabilityEvents,
} from './availability-notification.mjs';

function source(initial) {
  let value = structuredClone(initial);
  const listeners = new Set();
  return {
    snapshot: () => structuredClone(value),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    set(next, event = { type: 'update' }) {
      value = structuredClone(next);
      for (const listener of [...listeners]) listener(event);
    },
    signal(event = { type: 'update' }) {
      for (const listener of [...listeners]) listener(event);
    },
  };
}

const FIELD = 'field:watch-availability';
const WATCHER = 'participant:watcher';
const AGENT = 'agent:remote';
const PARTICIPANT = 'participant:remote';
const BINDING = 'a2a-binding:remote';
const PROJECTION = 'projection:a2a-binding:remote';

function watch(target = { kind: 'agent', ref: AGENT }, state = 'active') {
  return createWatch({
    watch_ref: `watch:${target.kind}:${target.ref}`,
    watcher_participant_ref: WATCHER,
    field_ref: FIELD,
    target,
    state,
    created_at: '2026-08-16T21:00:00.000Z',
    provenance: { source_system: 'O:I', source_revision: 'watch@1' },
  });
}

function binding(revision = 1, endpoint = 'https://agent.example/a2a') {
  return createA2aBinding({
    binding_ref: BINDING,
    binding_revision: revision,
    field_ref: FIELD,
    participant_ref: PARTICIPANT,
    agent_ref: AGENT,
    publisher_participant_ref: PARTICIPANT,
    publication_decision_ref: `decision:publish:${revision}`,
    source_revision: `agent@${revision}`,
    projection_ref: PROJECTION,
    published_at: `2026-08-16T21:0${revision}:00.000Z`,
    endpoint_url: endpoint,
    agent_card_url: 'https://agent.example/.well-known/agent-card.json',
    provenance: [{ kind: 'explicit-publication', ref: `decision:publish:${revision}`, source_system: 'O:I', revision: String(revision) }],
  });
}

function presence(availability, sequence) {
  return createA2aPresence({
    binding_ref: BINDING,
    field_ref: FIELD,
    participant_ref: PARTICIPANT,
    availability,
    sequence,
    observed_at: `2026-08-16T21:${String(sequence).padStart(2, '0')}:05.000Z`,
    provenance: [{ kind: 'reachability-observation', ref: `probe:${sequence}`, source_system: 'O:I' }],
  });
}

function a2aSnapshot(availability, sequence, revision = 1, endpoint) {
  return { bindings: [binding(revision, endpoint)], presence: [presence(availability, sequence)] };
}

function centralSuccess(input) {
  return {
    ok: true,
    data: {
      delivery: {
        state: 'posted',
        provider: 'fixture.notification',
        subject_ref: input.subject_ref,
        action_ref: input.action_ref,
        caller_ref: input.caller_ref,
        human_acknowledgement_observed: false,
        unsupported_requested_features: [],
        provenance_refs: input.provenance_refs,
      },
      notification_delivery_is_human_acknowledgement: false,
      diagnostics: {},
    },
  };
}

test('Watch produces attributable availability/Encounter but no notification without explicit policy', async () => {
  const watchSource = source([{ watch: watch() }]);
  const a2aSource = source(a2aSnapshot('offline', 1));
  const events = [];
  const encounters = [];
  const decisions = [];
  const notifications = [];
  const runtime = createWatchAvailabilityRuntime({
    watch_source: watchSource,
    a2a_source: a2aSource,
    invoke_central_action: async (...args) => { notifications.push(args); throw new Error('must not notify without policy'); },
    on_event: value => events.push(value),
    on_encounter: value => encounters.push(value),
    on_decision: value => decisions.push(value),
  });

  a2aSource.set(a2aSnapshot('online', 2));
  await runtime.flush();

  assert.equal(events.length, 1);
  assert.equal(events[0].schema, AVAILABILITY_EVENT_SCHEMA);
  assert.equal(events[0].watch_ref, watch().watch_ref);
  assert.equal(events[0].subject.agent_ref, AGENT);
  assert.equal(events[0].subject.participant_ref, PARTICIPANT);
  assert.equal(events[0].previous_availability, 'offline');
  assert.equal(events[0].availability, 'online');
  assert.equal('activity' in events[0], false, 'availability is not Activity');
  assert.equal(encounters.length, 1);
  assert.equal(encounters[0].mediation.kind, 'watch-availability');
  assert.equal(encounters[0].participant_ref, WATCHER);
  assert.equal('subjective_state' in encounters[0], false, 'Encounter is objective mediation, not subjective state');
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].schema, NOTIFICATION_DECISION_SCHEMA);
  assert.equal(decisions[0].disposition, 'suppress');
  assert.match(decisions[0].reason, /Watch records interest only/);
  assert.equal(notifications.length, 0, 'Watch does not imply notification');
  runtime.dispose();
});

test('explicit policy invokes Central personal.notify and delivery cannot become acknowledgement', async () => {
  const watchSource = source([{ watch: watch() }]);
  const a2aSource = source(a2aSnapshot('offline', 1));
  const calls = [];
  const deliveries = [];
  const runtime = createWatchAvailabilityRuntime({
    watch_source: watchSource,
    a2a_source: a2aSource,
    notification_policy: ({ event }) => createNotificationDecision(event, {
      disposition: 'notify',
      policy_ref: 'central:policy:watch-availability',
      reason: 'User-authored policy requests availability notifications for this Watch.',
    }),
    invoke_central_action: async (action, input) => {
      calls.push({ action, input });
      return centralSuccess(input);
    },
    on_delivery: value => deliveries.push(value),
  });

  a2aSource.set(a2aSnapshot('online', 2));
  await runtime.flush();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, CENTRAL_PERSONAL_NOTIFY_ACTION);
  assert.equal(calls[0].input.subject_ref, AGENT);
  assert.equal(calls[0].input.action_ref, 'oi.watch-availability.notify');
  assert.ok(calls[0].input.provenance_refs.includes(watch().watch_ref));
  assert.ok(calls[0].input.provenance_refs.some(ref => ref.startsWith('encounter:availability:')));
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].human_acknowledgement_observed, false);
  assert.equal(deliveries[0].delivery.human_acknowledgement_observed, false);
  runtime.dispose();
});

test('caller-filtered Watch scope suppresses unwatched changes and supports a watched Projection object', () => {
  const current = a2aSnapshot('online', 2);
  const previous = a2aSnapshot('offline', 1);
  assert.deepEqual(deriveWatchAvailabilityEvents({ watches: [watch({ kind: 'agent', ref: 'agent:someone-else' })], previous, current }), []);

  const projectionEvents = deriveWatchAvailabilityEvents({ watches: [watch({ kind: 'object', ref: PROJECTION })], previous, current });
  assert.equal(projectionEvents.length, 1);
  assert.equal(projectionEvents[0].target.ref, PROJECTION);
  assert.equal(projectionEvents[0].subject.agent_ref, AGENT);
  assert.equal(projectionEvents[0].subject.participant_ref, PARTICIPANT);

  const otherFieldWatch = createWatch({
    watch_ref: 'watch:other-field',
    watcher_participant_ref: WATCHER,
    field_ref: 'field:private-other',
    target: { kind: 'agent', ref: AGENT },
    created_at: '2026-08-16T21:00:00.000Z',
    provenance: { source_system: 'O:I', source_revision: 'watch@private' },
  });
  assert.deepEqual(deriveWatchAvailabilityEvents({ watches: [otherFieldWatch], previous, current }), [], 'cross-field/private Watch state cannot leak into this field');
});

test('endpoint churn preserves Agent/Participant identity, unwatch stops delivery, and rebuild is deduplicated', async () => {
  const active = watch();
  const watchSource = source([{ watch: active }]);
  const a2aSource = source(a2aSnapshot('online', 1));
  const calls = [];
  const runtime = createWatchAvailabilityRuntime({
    watch_source: watchSource,
    a2a_source: a2aSource,
    notification_policy: ({ event }) => ({
      disposition: 'notify',
      policy_ref: 'central:policy:watch-availability',
      reason: 'Notify on newly reachable state.',
      decided_at: event.observed_at,
    }),
    invoke_central_action: async (action, input) => {
      calls.push({ action, input });
      return centralSuccess(input);
    },
  });

  runtime.refresh();
  a2aSource.signal();
  await runtime.flush();
  assert.equal(calls.length, 0, 'online reconnect/rebuild baseline must not duplicate a notification');

  const replacement = a2aSnapshot('online', 2, 2, 'https://agent.example/a2a-v2');
  assert.equal(replacement.bindings[0].agent_ref, AGENT);
  assert.equal(replacement.bindings[0].participant_ref, PARTICIPANT);
  assert.equal(replacement.bindings[0].binding_ref, BINDING);
  a2aSource.set(replacement);
  await runtime.flush();
  assert.equal(calls.length, 0, 'endpoint replacement while already reachable is not newly available');

  a2aSource.set(a2aSnapshot('offline', 3, 2, 'https://agent.example/a2a-v2'));
  await runtime.flush();
  a2aSource.set(a2aSnapshot('online', 4, 2, 'https://agent.example/a2a-v2'));
  await runtime.flush();
  assert.equal(calls.length, 1);

  a2aSource.signal();
  await runtime.flush();
  assert.equal(calls.length, 1, 'duplicate provider callbacks for the same snapshot are idempotent');

  watchSource.set([{ watch: { ...active, state: 'paused' } }]);
  a2aSource.set(a2aSnapshot('offline', 5, 2, 'https://agent.example/a2a-v2'));
  await runtime.flush();
  a2aSource.set(a2aSnapshot('online', 6, 2, 'https://agent.example/a2a-v2'));
  await runtime.flush();
  assert.equal(calls.length, 1, 'paused/unwatched relation stops future delivery');
  runtime.dispose();
});

test('Central acknowledgement claims fail closed', async () => {
  const watchSource = source([{ watch: watch() }]);
  const a2aSource = source(a2aSnapshot('offline', 1));
  const runtime = createWatchAvailabilityRuntime({
    watch_source: watchSource,
    a2a_source: a2aSource,
    notification_policy: ({ event }) => ({
      disposition: 'notify',
      policy_ref: 'central:policy:test',
      reason: 'fixture',
      decided_at: event.observed_at,
    }),
    invoke_central_action: async (_action, input) => {
      const result = centralSuccess(input);
      result.data.delivery.human_acknowledgement_observed = true;
      return result;
    },
  });
  a2aSource.set(a2aSnapshot('online', 2));
  await assert.rejects(runtime.flush(), /must never be recorded as human acknowledgement/);
  runtime.dispose();
});
