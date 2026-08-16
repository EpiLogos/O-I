import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DbConnection, tables } from './module_bindings/index';
import {
  createLiveExploreApplication,
  createSpacetimeExploreSource,
  projectionStorageKey,
  relationStorageRef,
} from '../spacetimedb.mjs';

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_DATABASE ?? 'oi-shared-field-ci';
const TIMEOUT_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitUntil<T>(read: () => T | undefined | false, description: string): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const value = read();
    if (value) return value as T;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function connect(): Promise<DbConnection> {
  return new Promise((resolve, reject) => {
    DbConnection.builder()
      .withUri(URI)
      .withDatabaseName(DATABASE)
      .onConnect((conn) => resolve(conn))
      .onConnectError((_ctx, error) => reject(error))
      .build();
  });
}

async function subscribe(conn: DbConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.subscriptionBuilder()
      .onApplied(() => resolve())
      .onError((_ctx, error) => reject(error))
      .subscribe([
        tables.sharedField,
        tables.participant,
        tables.projection,
        tables.exploreEntry,
        tables.exploreRelation,
      ]);
  });
}

const fixture = JSON.parse(
  await readFile(new URL('../fixtures/explore-world-v1.json', import.meta.url), 'utf8')
);
const byRef = new Map(fixture.entries.map((entry: any) => [entry.ref, entry]));
const fieldEntry: any = byRef.get('oi:field:public');
const worldEntry: any = byRef.get('world:human:ariadne');
const agentEntry: any = byRef.get('agent:parasakti');
const projectionEntry: any = byRef.get('projection:parasakti:explore-note');
assert.ok(fieldEntry && worldEntry && agentEntry && projectionEntry, 'fixture should contain hosted floor objects');

const field = {
  schema: 'oi.shared-field/v1',
  field_ref: fieldEntry.ref,
  kind: 'public',
  visibility: 'public',
  title: fieldEntry.label,
  provenance: fieldEntry.provenance,
};
const participants = [
  {
    schema: 'oi.participant/v1',
    participant_ref: worldEntry.meta.participant_ref,
    field_ref: field.field_ref,
    identity: { kind: 'human', ref: worldEntry.provenance[0].ref },
    presentation: { world_ref: worldEntry.ref },
    provenance: {
      source_system: worldEntry.provenance[0].source_system,
      source_revision: worldEntry.provenance[0].revision,
    },
  },
  {
    schema: 'oi.participant/v1',
    participant_ref: agentEntry.meta.participant_ref,
    field_ref: field.field_ref,
    identity: { kind: 'agent', ref: agentEntry.ref },
    presentation: { world_ref: agentEntry.world_ref },
    provenance: {
      source_system: agentEntry.provenance[0].source_system,
      source_revision: agentEntry.provenance[0].revision,
    },
    agency: { ref: agentEntry.meta.agency_ref, source_system: agentEntry.provenance[0].source_system },
  },
];
const projection = {
  schema: 'oi.projection/v1',
  projection_ref: projectionEntry.projection_ref,
  projection_revision: 1,
  state: 'published',
  subject: { ref: projectionEntry.provenance[1].ref, kind: projectionEntry.provenance[1].kind },
  source: { system: projectionEntry.provenance[1].source_system, revision: projectionEntry.meta.source_revision },
  publisher_participant_ref: projectionEntry.meta.publisher_participant_ref,
  published_at: '2026-08-16T12:00:00.000Z',
  audience: { visibility: 'public' },
  representation: { kind: 'explore-entry', ref: projectionEntry.ref },
  provenance: projectionEntry.provenance,
};

const conn = await connect();
try {
  await subscribe(conn);
  const source = createSpacetimeExploreSource(conn.db);
  const live = createLiveExploreApplication(source);
  let rebuilds = 0;
  const stopListening = live.subscribe(event => {
    if (event.type === 'rebuild') rebuilds += 1;
  });

  conn.reducers.putSharedField({
    fieldRef: field.field_ref,
    kind: field.kind,
    visibility: field.visibility,
    contractJson: JSON.stringify(field),
  });
  await waitUntil(() => conn.db.sharedField.fieldRef.find(field.field_ref), 'SharedField insertion');

  for (const participant of participants) {
    conn.reducers.putParticipant({
      participantRef: participant.participant_ref,
      fieldRef: participant.field_ref,
      identityKind: participant.identity.kind,
      identityRef: participant.identity.ref,
      sourceSystem: participant.provenance.source_system,
      sourceRevision: participant.provenance.source_revision,
      contractJson: JSON.stringify(participant),
    });
    await waitUntil(
      () => conn.db.participant.participantRef.find(participant.participant_ref),
      `Participant ${participant.participant_ref}`
    );
  }

  conn.reducers.putProjection({
    projectionKey: projectionStorageKey(projection.projection_ref, projection.projection_revision),
    projectionRef: projection.projection_ref,
    projectionRevision: projection.projection_revision,
    sourceRevision: projection.source.revision,
    publisherParticipantRef: projection.publisher_participant_ref,
    state: projection.state,
    contractJson: JSON.stringify(projection),
  });
  await waitUntil(
    () => conn.db.projection.projectionKey.find(projectionStorageKey(projection.projection_ref, projection.projection_revision)),
    'Projection insertion'
  );

  for (const entry of fixture.entries) {
    conn.reducers.putExploreEntry({
      semanticRef: entry.ref,
      worldRef: entry.world_ref,
      kind: entry.kind,
      label: entry.label,
      revision: entry.revision ?? '',
      entryJson: JSON.stringify(entry),
    });
    await waitUntil(() => conn.db.exploreEntry.semanticRef.find(entry.ref), `Explore entry ${entry.ref}`);
  }

  for (const relation of fixture.relations) {
    const relationRef = relationStorageRef(relation);
    conn.reducers.putExploreRelation({
      relationRef,
      fromRef: relation.from,
      toRef: relation.to,
      relation: relation.relation,
      origin: relation.origin,
      relationJson: JSON.stringify(relation),
    });
    await waitUntil(() => conn.db.exploreRelation.relationRef.find(relationRef), `Explore relation ${relationRef}`);
  }

  await waitUntil(() => live.search('knowledge navigation')[0]?.ref === 'wiki:o-i:explore:knowledge-navigation', 'Explore index seed');
  const opened = live.open('wiki:o-i:explore:knowledge-navigation', { depth: 1, budget: 8 });
  assert.equal(opened?.resource.ref, 'wiki:o-i:explore:knowledge-navigation');
  assert.equal(opened?.relations.focus, 'wiki:o-i:explore:knowledge-navigation');
  assert.ok(opened?.relations.nodes.some((entry: any) => entry.ref === 'wiki:o-i:explore'));

  const semanticRef = 'wiki:o-i:explore:knowledge-navigation';
  const before = conn.db.exploreEntry.semanticRef.find(semanticRef);
  assert.ok(before, 'hosted Explore row should exist');
  const beforeRowId = String(before.rowId);
  const currentEntry: any = byRef.get(semanticRef);
  const revisedEntry = {
    ...currentEntry,
    label: 'Knowledge Navigation Live',
    revision: 'okf-node@3-live',
    provenance: currentEntry.provenance.map((item: any) => ({ ...item, revision: 'okf-node@3-live' })),
  };

  conn.reducers.putExploreEntry({
    semanticRef,
    worldRef: revisedEntry.world_ref,
    kind: revisedEntry.kind,
    label: revisedEntry.label,
    revision: revisedEntry.revision,
    entryJson: JSON.stringify(revisedEntry),
  });

  await waitUntil(() => live.read(semanticRef)?.revision === 'okf-node@3-live', 'subscription-driven Explore rebuild');
  const after = conn.db.exploreEntry.semanticRef.find(semanticRef);
  assert.ok(after, 'updated hosted Explore row should exist');
  assert.equal(String(after.rowId), beforeRowId, 'SpaceTimeDB update should keep its implementation row while semantic identity is stable');
  assert.equal(live.read(semanticRef)?.ref, semanticRef, 'semantic ref must remain stable through hosted update');
  assert.equal(live.search('navigation live')[0]?.ref, semanticRef, 'updated label should enter rebuilt deterministic search');
  assert.equal(live.open(semanticRef, { depth: 1, budget: 8 })?.relations.focus, semanticRef);
  assert.equal(live.read('projection:parasakti:explore-note')?.meta.source_revision, 'run:explore@1');
  assert.equal(live.snapshot().projections[0].source.revision, 'run:explore@1');
  assert.ok(rebuilds > 0, 'at least one SpaceTimeDB cache event should rebuild Explore');
  assert.equal(live.status().healthy, true);

  console.log(JSON.stringify({
    proof: 'oi-spacetimedb-live-explore/v1',
    database: DATABASE,
    participant_count: conn.db.participant.count(),
    projection_count: conn.db.projection.count(),
    explore_entry_count: conn.db.exploreEntry.count(),
    relation_count: conn.db.exploreRelation.count(),
    semantic_ref: semanticRef,
    implementation_row_id: beforeRowId,
    source_revision: live.snapshot().projections[0].source.revision,
    explore_revision: live.read(semanticRef)?.revision,
    rebuilds,
  }, null, 2));

  stopListening();
  live.dispose();
} finally {
  conn.disconnect();
}
