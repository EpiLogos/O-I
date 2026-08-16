import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLiveExploreApplication,
  createSpacetimeExploreSource,
  hostedSnapshotFromRows,
  projectionStorageKey,
  relationStorageRef,
} from './spacetimedb.mjs';

function json(value) {
  return JSON.stringify(value);
}

function canonicalFixture() {
  const field = {
    schema: 'oi.shared-field/v1',
    field_ref: 'oi:field:public',
    kind: 'public',
    visibility: 'public',
    title: 'O:I Public Field',
    provenance: [{ kind: 'shared-field', ref: 'oi:field:public', source_system: 'o-i', revision: 'shared-field@1' }],
  };
  const participant = {
    schema: 'oi.participant/v1',
    participant_ref: 'participant:public:parasakti',
    field_ref: field.field_ref,
    identity: { kind: 'agent', ref: 'agent:parasakti' },
    presentation: {},
    provenance: { source_system: 'software-factory', source_revision: 'factory-agent-canon@21' },
    agency: { ref: 'agency:parasakti:design', source_system: 'software-factory' },
  };
  const projection = {
    schema: 'oi.projection/v1',
    projection_ref: 'projection:parasakti:explore-note',
    projection_revision: 1,
    state: 'published',
    subject: { ref: 'artifact:explore-design-note', kind: 'artifact' },
    source: { system: 'software-factory', revision: 'run:explore@1' },
    publisher_participant_ref: participant.participant_ref,
    published_at: '2026-08-16T12:00:00.000Z',
    audience: { visibility: 'public' },
    representation: { kind: 'explore-entry', ref: 'projection:parasakti:explore-note' },
    provenance: [{ kind: 'source-artifact', ref: 'artifact:explore-design-note', source_system: 'software-factory', revision: 'run:explore@1' }],
  };
  const world = {
    schema: 'oi.explore-entry/v1',
    ref: 'world:human:ariadne',
    kind: 'human-world',
    world_ref: 'world:human:ariadne',
    label: 'Ariadne',
    aliases: ['@ariadne'],
    revision: 'central-public@8',
    provenance: [{ kind: 'human-participant-root', ref: 'human:ariadne', source_system: 'central', revision: 'central-public@8' }],
    locators: [{ surface: 'web', locator: '/@ariadne' }],
  };
  const agent = {
    schema: 'oi.explore-entry/v1',
    ref: 'agent:parasakti',
    kind: 'agent',
    world_ref: world.ref,
    label: 'Parāśakti',
    aliases: ['parasakti', 'design agent'],
    revision: 'factory-agent-canon@21',
    provenance: [{ kind: 'agent', ref: 'agent:parasakti', source_system: 'software-factory', revision: 'factory-agent-canon@21' }],
    locators: [{ surface: 'web', locator: '/@ariadne/agents/parasakti' }],
  };
  const relation = {
    from: world.ref,
    to: agent.ref,
    relation: 'oi.world/agent',
    origin: 'projection',
    provenance: [{ kind: 'projection-relation', ref: 'edge:world-agent', source_system: 'o-i', revision: 'world-projection@1' }],
  };
  return { field, participant, projection, world, agent, relation };
}

function hostedRows() {
  const { field, participant, projection, world, agent, relation } = canonicalFixture();
  return {
    sharedFields: [{ rowId: 71n, fieldRef: field.field_ref, kind: field.kind, visibility: field.visibility, contractJson: json(field) }],
    participants: [{
      rowId: 72n,
      participantRef: participant.participant_ref,
      fieldRef: participant.field_ref,
      identityKind: participant.identity.kind,
      identityRef: participant.identity.ref,
      sourceSystem: participant.provenance.source_system,
      sourceRevision: participant.provenance.source_revision,
      contractJson: json(participant),
    }],
    projections: [{
      rowId: 73n,
      projectionKey: projectionStorageKey(projection.projection_ref, projection.projection_revision),
      projectionRef: projection.projection_ref,
      projectionRevision: projection.projection_revision,
      sourceRevision: projection.source.revision,
      publisherParticipantRef: projection.publisher_participant_ref,
      state: projection.state,
      contractJson: json(projection),
    }],
    exploreEntries: [world, agent].map((entry, index) => ({
      rowId: BigInt(80 + index),
      semanticRef: entry.ref,
      worldRef: entry.world_ref,
      kind: entry.kind,
      label: entry.label,
      revision: entry.revision ?? '',
      entryJson: json(entry),
    })),
    exploreRelations: [{
      rowId: 90n,
      relationRef: relationStorageRef(relation),
      fromRef: relation.from,
      toRef: relation.to,
      relation: relation.relation,
      origin: relation.origin,
      relationJson: json(relation),
    }],
  };
}

function fakeHandle(initialRows) {
  let rows = initialRows.map((row) => ({ ...row }));
  const inserts = new Set();
  const updates = new Set();
  const deletes = new Set();
  return {
    iter: () => rows.values(),
    onInsert: (callback) => inserts.add(callback),
    removeOnInsert: (callback) => inserts.delete(callback),
    onUpdate: (callback) => updates.add(callback),
    removeOnUpdate: (callback) => updates.delete(callback),
    onDelete: (callback) => deletes.add(callback),
    removeOnDelete: (callback) => deletes.delete(callback),
    replace(predicate, next) {
      const index = rows.findIndex(predicate);
      assert.notEqual(index, -1, 'row to replace should exist');
      const previous = rows[index];
      rows[index] = { ...next };
      for (const callback of updates) callback({}, previous, rows[index]);
    },
  };
}

function fakeDb(rows) {
  return {
    sharedField: fakeHandle(rows.sharedFields),
    participant: fakeHandle(rows.participants),
    projection: fakeHandle(rows.projections),
    exploreEntry: fakeHandle(rows.exploreEntries),
    exploreRelation: fakeHandle(rows.exploreRelations),
  };
}

test('SpaceTimeDB snapshot keeps row IDs implementation-only and validates semantic identity columns', () => {
  const snapshot = hostedSnapshotFromRows(hostedRows());
  assert.equal(snapshot.entries[1].ref, 'agent:parasakti');
  assert.equal(snapshot.implementation.entries[1].row_id, '81');
  assert.equal(snapshot.implementation.entries[1].semantic_ref, 'agent:parasakti');
  assert.equal('rowId' in snapshot.entries[1], false);
  assert.equal(snapshot.projections[0].source.revision, 'run:explore@1');

  const drifted = hostedRows();
  drifted.exploreEntries[1].semanticRef = 'row:81';
  assert.throws(() => hostedSnapshotFromRows(drifted), /semanticRef does not match canonical contract/);
});

test('live subscribed SpaceTimeDB source rebuilds Explore without changing semantic refs', () => {
  const db = fakeDb(hostedRows());
  const live = createLiveExploreApplication(createSpacetimeExploreSource(db));
  const events = [];
  const unsubscribe = live.subscribe((event) => events.push(event));

  assert.equal(live.search('parasakti')[0].ref, 'agent:parasakti');
  assert.equal(live.open('agent:parasakti', { depth: 1 }).relations.focus, 'agent:parasakti');
  assert.equal(live.status().healthy, true);

  const current = [...db.exploreEntry.iter()].find((row) => row.semanticRef === 'agent:parasakti');
  const entry = JSON.parse(current.entryJson);
  const revisedEntry = { ...entry, label: 'Parāśakti Live', revision: 'factory-agent-canon@22' };
  db.exploreEntry.replace(
    (row) => row.semanticRef === entry.ref,
    { ...current, label: revisedEntry.label, revision: revisedEntry.revision, entryJson: json(revisedEntry) }
  );

  assert.equal(live.read('agent:parasakti').label, 'Parāśakti Live');
  assert.equal(live.read('agent:parasakti').ref, 'agent:parasakti');
  assert.equal(live.search('live')[0].ref, 'agent:parasakti');
  assert.equal(live.snapshot().implementation.entries.find((row) => row.semantic_ref === 'agent:parasakti').row_id, '81');
  assert.equal(events.at(-1).type, 'rebuild');
  assert.equal(events.at(-1).cause.type, 'update');

  unsubscribe();
  live.dispose();
});

test('live Explore keeps the last good index when a subscribed provider row violates its contract', () => {
  const db = fakeDb(hostedRows());
  const live = createLiveExploreApplication(createSpacetimeExploreSource(db));
  const current = [...db.exploreEntry.iter()].find((row) => row.semanticRef === 'agent:parasakti');

  db.exploreEntry.replace(
    (row) => row.semanticRef === 'agent:parasakti',
    { ...current, label: 'Drifted database label' }
  );

  assert.equal(live.status().healthy, false);
  assert.match(live.status().error, /label does not match canonical contract/);
  assert.equal(live.read('agent:parasakti').label, 'Parāśakti');
  live.dispose();
});
