import assert from 'node:assert/strict';
import { DbConnection } from './module_bindings/index';
import { createParticipant } from '../index.mjs';
import { createWatch } from '../watch.mjs';
import { createA2aBinding, createA2aPresence } from '../a2a.mjs';
import { reviseA2aBinding } from '../a2a-lifecycle.mjs';
import {
  createA2aBindingProjection,
  createA2aPresenceExploreEntry,
  createSpacetimeA2aSource,
} from '../spacetimedb-a2a.mjs';
import { projectionStorageKey } from '../spacetimedb.mjs';
import { createSpacetimeWatchSource } from '../spacetimedb-watch.mjs';
import {
  CENTRAL_PERSONAL_NOTIFY_ACTION,
  createWatchAvailabilityRuntime,
} from '../availability-notification.mjs';

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_WATCH_NOTIFY_DATABASE ?? 'oi-shared-field-watch-notify-ci';
const TIMEOUT_MS = 15_000;

const FIELD_REF = 'oi:field:watch-notification-live';
const OWNER_PARTICIPANT_REF = 'participant:watch-notification:owner';
const AGENT_REF = 'agent:watch-notification:remote';
const AGENT_PARTICIPANT_REF = 'participant:watch-notification:remote';
const AGENT_WORLD_REF = 'world:watch-notification:remote';
const BINDING_REF = 'a2a-binding:watch-notification:remote';
const BINDING_PROJECTION_REF = 'projection:a2a-binding:watch-notification:remote';
const PRESENCE_REF = 'a2a-presence:watch-notification:remote';
const WATCH_REF = 'watch:watch-notification:remote';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitUntil<T>(read: () => T | undefined | false, description: string): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const value = read();
    if (value) return value as T;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function connect(name: string) {
  return new Promise<{ name: string; conn: DbConnection; identity: any }>((resolve, reject) => {
    DbConnection.builder()
      .withUri(URI)
      .withDatabaseName(DATABASE)
      .onConnect((conn, identity) => resolve({ name, conn, identity }))
      .onConnectError((_ctx, error) => reject(error))
      .build();
  });
}

async function subscribe(conn: DbConnection, queries: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    conn.subscriptionBuilder()
      .onApplied(() => resolve())
      .onError((_ctx, error) => reject(error))
      .subscribe(queries);
  });
}

function participantArgs(value: any) {
  return {
    participantRef: value.participant_ref,
    fieldRef: value.field_ref,
    identityKind: value.identity.kind,
    identityRef: value.identity.ref,
    sourceSystem: value.provenance.source_system,
    sourceRevision: value.provenance.source_revision,
    contractJson: JSON.stringify(value),
  };
}

function projectionArgs(fieldRef: string, value: any) {
  return {
    projectionKey: projectionStorageKey(value.projection_ref, value.projection_revision),
    fieldRef,
    projectionRef: value.projection_ref,
    projectionRevision: value.projection_revision,
    sourceRevision: value.source.revision,
    publisherParticipantRef: value.publisher_participant_ref,
    state: value.state,
    contractJson: JSON.stringify(value),
  };
}

function exploreArgs(fieldRef: string, value: any) {
  return {
    semanticRef: value.ref,
    fieldRef,
    worldRef: value.world_ref,
    kind: value.kind,
    label: value.label,
    revision: value.revision ?? '',
    entryJson: JSON.stringify(value),
  };
}

function watchArgs(value: any) {
  return {
    watchRef: value.watch_ref,
    fieldRef: value.field_ref,
    watcherParticipantRef: value.watcher_participant_ref,
    targetKind: value.target.kind,
    targetRef: value.target.ref,
    state: value.state,
    contractJson: JSON.stringify(value),
  };
}

function binding(revision = 1, endpoint = 'http://127.0.0.1:43111/a2a') {
  return createA2aBinding({
    binding_ref: BINDING_REF,
    binding_revision: revision,
    field_ref: FIELD_REF,
    participant_ref: AGENT_PARTICIPANT_REF,
    agent_ref: AGENT_REF,
    publisher_participant_ref: AGENT_PARTICIPANT_REF,
    publication_decision_ref: `decision:watch-notification:publish:${revision}`,
    source_revision: `agent@${revision}`,
    projection_ref: BINDING_PROJECTION_REF,
    published_at: `2026-08-16T22:0${revision}:00.000Z`,
    endpoint_url: endpoint,
    agent_card_url: 'http://127.0.0.1:43111/.well-known/agent-card.json',
    provenance: [{
      kind: 'explicit-publication',
      ref: `decision:watch-notification:publish:${revision}`,
      source_system: 'O:I',
      revision: String(revision),
    }],
  });
}

function presence(availability: string, sequence: number) {
  return createA2aPresence({
    binding_ref: BINDING_REF,
    field_ref: FIELD_REF,
    participant_ref: AGENT_PARTICIPANT_REF,
    availability,
    sequence,
    observed_at: `2026-08-16T22:${String(sequence).padStart(2, '0')}:05.000Z`,
    provenance: [{
      kind: 'reachability-observation',
      ref: `probe:watch-notification:${sequence}`,
      source_system: 'O:I',
    }],
  });
}

async function putPresence(conn: DbConnection, value: any) {
  const entry = createA2aPresenceExploreEntry(value, {
    semantic_ref: PRESENCE_REF,
    world_ref: AGENT_WORLD_REF,
  });
  await conn.reducers.putExploreEntry(exploreArgs(FIELD_REF, entry));
}

const [owner, agent, intruder] = await Promise.all([
  connect('owner'),
  connect('agent'),
  connect('intruder'),
]);

const field = {
  schema: 'oi.shared-field/v1',
  field_ref: FIELD_REF,
  kind: 'public',
  visibility: 'public',
  title: 'Watch notification live acceptance',
  provenance: [{ kind: 'acceptance-fixture', ref: 'fixture:watch-notification-live', source_system: 'O:I', revision: '1' }],
};
const ownerParticipant = createParticipant({
  participant_ref: OWNER_PARTICIPANT_REF,
  field_ref: FIELD_REF,
  identity: { kind: 'human', ref: 'human:watch-notification:owner' },
  presentation: { world_ref: 'world:watch-notification:owner' },
  provenance: { source_system: 'O:I', source_revision: 'owner@1' },
});
const agentParticipant = createParticipant({
  participant_ref: AGENT_PARTICIPANT_REF,
  field_ref: FIELD_REF,
  identity: { kind: 'agent', ref: AGENT_REF },
  presentation: { world_ref: AGENT_WORLD_REF },
  provenance: { source_system: 'Actuation', source_revision: 'agent@1' },
  agency: { ref: 'agency:watch-notification:remote', source_system: 'Actuation' },
});
const agentExploreEntry = {
  schema: 'oi.explore-entry/v1',
  ref: AGENT_REF,
  kind: 'agent',
  world_ref: AGENT_WORLD_REF,
  label: 'Watched remote agent',
  aliases: [],
  provenance: [{ kind: 'agent-projection', ref: AGENT_REF, source_system: 'Actuation', revision: 'agent@1' }],
  locators: [],
};

try {
  await subscribe(owner.conn, [
    'SELECT * FROM shared_field',
    'SELECT * FROM participant',
    'SELECT * FROM projection',
    'SELECT * FROM explore_entry',
    'SELECT * FROM my_field_authority',
    'SELECT * FROM my_watch',
  ]);
  await subscribe(agent.conn, [
    'SELECT * FROM shared_field',
    'SELECT * FROM participant',
    'SELECT * FROM projection',
    'SELECT * FROM explore_entry',
    'SELECT * FROM my_field_authority',
  ]);
  await subscribe(intruder.conn, ['SELECT * FROM my_watch']);

  await owner.conn.reducers.putSharedField({
    fieldRef: field.field_ref,
    kind: field.kind,
    visibility: field.visibility,
    contractJson: JSON.stringify(field),
  });
  await owner.conn.reducers.putParticipant(participantArgs(ownerParticipant));
  await owner.conn.reducers.putParticipant(participantArgs(agentParticipant));
  await owner.conn.reducers.grantParticipantAuthority({
    fieldRef: FIELD_REF,
    participantRef: OWNER_PARTICIPANT_REF,
    targetIdentity: owner.identity,
    role: 'contributor',
    contactable: true,
    ttlSeconds: 0,
  });
  await owner.conn.reducers.grantParticipantAuthority({
    fieldRef: FIELD_REF,
    participantRef: AGENT_PARTICIPANT_REF,
    targetIdentity: agent.identity,
    role: 'contributor',
    contactable: true,
    ttlSeconds: 0,
  });
  await owner.conn.reducers.putExploreEntry(exploreArgs(FIELD_REF, agentExploreEntry));

  const firstBinding = binding();
  await agent.conn.reducers.putProjection(projectionArgs(FIELD_REF, createA2aBindingProjection(firstBinding)));
  await putPresence(owner.conn, presence('offline', 1));

  const watched = createWatch({
    watch_ref: WATCH_REF,
    watcher_participant_ref: OWNER_PARTICIPANT_REF,
    field_ref: FIELD_REF,
    target: { kind: 'agent', ref: AGENT_REF },
    created_at: '2026-08-16T22:01:00.000Z',
    provenance: { source_system: 'O:I', source_revision: 'watch-notification@1' },
  });
  await owner.conn.reducers.putWatch(watchArgs(watched));

  const watchSource = createSpacetimeWatchSource(owner.conn.db as any);
  const a2aSource = createSpacetimeA2aSource(owner.conn.db as any);
  await waitUntil(() => watchSource.snapshot()[0]?.watch.watch_ref === WATCH_REF, 'caller-filtered Watch');
  await waitUntil(() => a2aSource.snapshot().presence[0]?.availability === 'offline', 'offline baseline');
  assert.equal(Array.from((intruder.conn.db as any).myWatch.iter()).length, 0, 'unrelated caller cannot see private Watch relation');

  const events: any[] = [];
  const encounters: any[] = [];
  const decisions: any[] = [];
  const notifications: any[] = [];
  const runtime = createWatchAvailabilityRuntime({
    watch_source: watchSource,
    a2a_source: a2aSource,
    notification_policy: ({ event }: any) => ({
      disposition: 'notify',
      policy_ref: 'central:policy:watch-availability:live',
      reason: 'Acceptance fixture explicitly requests notify on newly reachable watched targets.',
      decided_at: event.observed_at,
    }),
    invoke_central_action: async (action: string, input: any) => {
      assert.equal(action, CENTRAL_PERSONAL_NOTIFY_ACTION);
      notifications.push({ action, input });
      return {
        ok: true,
        data: {
          delivery: {
            state: 'posted',
            provider: 'central-conformance-fixture',
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
    },
    on_event: (value: any) => events.push(value),
    on_encounter: (value: any) => encounters.push(value),
    on_decision: (value: any) => decisions.push(value),
  });

  await putPresence(owner.conn, presence('online', 2));
  await waitUntil(() => notifications.length === 1, 'explicit Central notification after watched availability transition');
  await runtime.flush();
  assert.equal(events.length, 1);
  assert.equal(events[0].previous_availability, 'offline');
  assert.equal(events[0].availability, 'online');
  assert.equal(events[0].subject.agent_ref, AGENT_REF);
  assert.equal(events[0].subject.participant_ref, AGENT_PARTICIPANT_REF);
  assert.equal('activity' in events[0], false);
  assert.equal(encounters.length, 1);
  assert.equal(encounters[0].mediation.kind, 'watch-availability');
  assert.equal('subjective_state' in encounters[0], false);
  assert.equal(decisions[0].disposition, 'notify');
  assert.equal(notifications[0].action, 'personal.notify');
  assert.equal(notifications[0].input.action_ref, 'oi.watch-availability.notify');

  const replacement = reviseA2aBinding(firstBinding, {
    publication_decision_ref: 'decision:watch-notification:publish:2',
    source_revision: 'agent@2',
    published_at: '2026-08-16T22:02:00.000Z',
    endpoint_url: 'http://127.0.0.1:43112/a2a',
    agent_card_url: 'http://127.0.0.1:43112/.well-known/agent-card.json',
    provenance: [{ kind: 'explicit-publication', ref: 'decision:watch-notification:publish:2', source_system: 'O:I', revision: '2' }],
  });
  await agent.conn.reducers.putProjection(projectionArgs(FIELD_REF, createA2aBindingProjection(replacement, {
    projection_ref: BINDING_PROJECTION_REF,
    projection_revision: 2,
  })));
  await putPresence(owner.conn, presence('online', 3));
  await waitUntil(() => a2aSource.snapshot().bindings[0]?.binding_revision === 2, 'replacement binding revision');
  await waitUntil(() => a2aSource.snapshot().presence[0]?.sequence === 3, 'replacement presence sequence');
  await sleep(100);
  await runtime.flush();
  assert.equal(replacement.agent_ref, firstBinding.agent_ref);
  assert.equal(replacement.participant_ref, firstBinding.participant_ref);
  assert.equal(replacement.binding_ref, firstBinding.binding_ref);
  assert.equal(notifications.length, 1, 'endpoint churn while online is not a new availability notification');

  await putPresence(owner.conn, presence('offline', 4));
  await waitUntil(() => a2aSource.snapshot().presence[0]?.sequence === 4, 'offline transition');
  await runtime.flush();
  await putPresence(owner.conn, presence('online', 5));
  await waitUntil(() => notifications.length === 2, 'second bounded availability transition');
  await runtime.flush();
  assert.equal(events.length, 2);

  runtime.refresh();
  await sleep(50);
  await runtime.flush();
  assert.equal(notifications.length, 2, 'rebuild over an already-online snapshot does not duplicate delivery');

  await owner.conn.reducers.revokeParticipantAuthority({
    fieldRef: FIELD_REF,
    participantRef: OWNER_PARTICIPANT_REF,
  });
  await waitUntil(() => watchSource.snapshot().length === 0, 'Watch revocation from caller View');
  await putPresence(owner.conn, presence('offline', 6));
  await waitUntil(() => a2aSource.snapshot().presence[0]?.sequence === 6, 'post-revocation offline');
  await runtime.flush();
  await putPresence(owner.conn, presence('online', 7));
  await waitUntil(() => a2aSource.snapshot().presence[0]?.sequence === 7, 'post-revocation online');
  await sleep(100);
  await runtime.flush();
  assert.equal(notifications.length, 2, 'revocation/unwatch stops future delivery');

  assert.equal(
    notifications.every(item => item.input.provenance_refs.some((ref: string) => ref.startsWith('encounter:availability:'))),
    true,
  );
  assert.equal(
    notifications.every(item => item.input.caller_ref.startsWith('notification-decision:')),
    true,
  );

  console.log(JSON.stringify({
    proof: 'oi-watch-availability-notification-live/v1',
    spacetimedb: '2.8.1',
    database: DATABASE,
    watch_ref: WATCH_REF,
    agent_ref: AGENT_REF,
    participant_ref: AGENT_PARTICIPANT_REF,
    binding_ref: BINDING_REF,
    binding_revision_after_churn: replacement.binding_revision,
    availability_events: events.map(event => event.event_ref),
    encounters: encounters.map(encounter => encounter.encounter_ref),
    explicit_notification_decisions: decisions.map(decision => decision.decision_ref),
    central_action: CENTRAL_PERSONAL_NOTIFY_ACTION,
    central_deliveries: notifications.length,
    human_acknowledgement_recorded: false,
    intruder_watch_visibility: 0,
    revocation_stopped_delivery: true,
    rebuild_deduplicated: true,
    endpoint_churn_preserved_identity: true,
  }, null, 2));

  runtime.dispose();
} finally {
  owner.conn.disconnect();
  agent.conn.disconnect();
  intruder.conn.disconnect();
}
