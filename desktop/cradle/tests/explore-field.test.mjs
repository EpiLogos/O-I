import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeExploreTravel, freshExploreTravel, pushVisit, amendVisit, travelBy, canTravel, currentVisit, EXPLORE_TRAVEL_SCHEMA, EXPLORE_TRAVEL_LIMIT } from '../src/explore/travel.mjs';
import { fieldReading, searchField, primaryProjection, constellation, relationsOf, watchStanding, watchTargetKind } from '../src/explore/field.mjs';

const snapshot = () => ({
  schema: 'oi.shared-field.snapshot/v1',
  target: { name: 't', uri: 'ws://x', database: 'd' },
  status: { healthy: true },
  fields: [{ field_ref: 'oi:field:central:project:O-I', kind: 'explore', visibility: 'public', title: 'Shared field' }],
  participants: [{ participant_ref: 'participant:central:owner', field_ref: 'oi:field:central:project:O-I', identity: { kind: 'human', ref: 'human:central:owner' }, presentation: { chosen_name: 'Owner', world_ref: 'world:central:project:O-I' } }],
  projections: [
    { projection_ref: 'projection:central:project:O-I', projection_revision: 1, state: 'published', subject: { kind: 'central-world', ref: 'world:central:project:O-I' }, representation: { kind: 'oi.world-presentation/v1' } },
    { projection_ref: 'projection:desktop:expression:e', projection_revision: 2, state: 'published', subject: { kind: 'expression', ref: 'expression:e' }, representation: { kind: 'oi.world-presentation/v1' } },
    { projection_ref: 'projection:desktop:expression:e', projection_revision: 1, state: 'published', subject: { kind: 'expression', ref: 'expression:e' }, representation: { kind: 'oi.world-presentation/v1' } },
  ],
  entries: [
    { ref: 'world:central:project:O-I', kind: 'central-world', world_ref: 'world:central:project:O-I', label: 'O-I — a ProjectCentral world', aliases: [] },
    { ref: 'world:central:project:O-I/wiki:node:project-root/o-i', kind: 'wiki-node', world_ref: 'world:central:project:O-I', label: 'O-I', aliases: [], summary: 'project root' },
    { ref: 'expression:e', kind: 'expression', world_ref: 'world:desktop:expression-e', label: 'A field of glyphs', aliases: ['projection:desktop:expression:e'], meta: { projection_ref: 'projection:desktop:expression:e' } },
  ],
  relations: [{ from: 'world:central:project:O-I', to: 'world:central:project:O-I/wiki:node:project-root/o-i', relation: 'oi.world/wiki-node', origin: 'projection' }],
  my_authority: [{ field_ref: 'oi:field:central:project:O-I', participant_ref: 'participant:central:owner', role: 'contributor', revoked: false }],
  my_watches: [],
  entry_fields: { 'world:central:project:O-I': 'oi:field:central:project:O-I', 'world:central:project:O-I/wiki:node:project-root/o-i': 'oi:field:central:project:O-I', 'expression:e': 'oi:field:desktop:expression-e' },
  counts: { fields: 1, participants: 1, projections: 3, entries: 3, relations: 1 },
});

test('travel: fresh, push, amend, back/forward, bounded, and a corrupt payload degrades to fresh', () => {
  let travel = freshExploreTravel();
  assert.equal(travel.schema, EXPLORE_TRAVEL_SCHEMA);
  travel = amendVisit(travel, { query: 'o-i' });
  travel = pushVisit(travel, { query: 'o-i', selected: 'world:central:project:O-I', depth: { relations: true } });
  assert.equal(travel.index, 1);
  assert.deepEqual(currentVisit(travel), { query: 'o-i', selected: 'world:central:project:O-I', depth: { relations: true } });
  assert.equal(canTravel(travel, -1), true);
  assert.equal(canTravel(travel, 1), false);
  const back = travelBy(travel, -1);
  assert.equal(currentVisit(back).selected, undefined);
  assert.deepEqual(decodeExploreTravel(JSON.parse(JSON.stringify(travel))), travel);
  assert.deepEqual(decodeExploreTravel({ schema: EXPLORE_TRAVEL_SCHEMA, visits: [{ query: 1 }], index: 0 }), freshExploreTravel());
  assert.deepEqual(decodeExploreTravel({ schema: EXPLORE_TRAVEL_SCHEMA, visits: [{ query: '', payload: { cloned: true } }], index: 0 }).visits[0], { query: '' });
  assert.deepEqual(decodeExploreTravel({ schema: EXPLORE_TRAVEL_SCHEMA, visits: [{ query: '', depth: { transcript: true } }], index: 0 }), freshExploreTravel());
  assert.deepEqual(decodeExploreTravel('nope'), freshExploreTravel());
  for (let i = 0; i < EXPLORE_TRAVEL_LIMIT + 5; i += 1) travel = pushVisit(travel, { query: String(i) });
  assert.equal(travel.visits.length, EXPLORE_TRAVEL_LIMIT);
  assert.equal(travel.index, EXPLORE_TRAVEL_LIMIT - 1);
  const cleared = amendVisit(travel, { selected: undefined });
  assert.equal('selected' in currentVisit(cleared), false);
});

test('field reading groups entries by world and presents participants as Beings; an unavailable snapshot is honest', () => {
  const reading = fieldReading(snapshot());
  assert.equal(reading.state, 'available');
  assert.deepEqual(reading.worlds.map((world) => [world.world_ref, world.label, world.entries.length]), [['world:central:project:O-I', 'O-I — a ProjectCentral world', 1], ['world:desktop:expression-e', 'A field of glyphs', 1]]);
  assert.deepEqual(reading.beings.map((being) => being.label), ['Owner']);
  assert.deepEqual(reading.counts, { entries: 3, worlds: 2, beings: 1 });
  const gone = fieldReading({ state: 'unavailable', detail: 'no target' });
  assert.equal(gone.state, 'unavailable');
  assert.equal(gone.detail, 'no target');
  assert.deepEqual(gone.worlds, []);
});

test('search ranks addressable subjects and an empty query is the whole field', () => {
  assert.equal(searchField(snapshot(), '').length, 5);
  const hits = searchField(snapshot(), 'glyph');
  assert.deepEqual(hits.map((hit) => hit.ref), ['expression:e']);
  const being = searchField(snapshot(), 'owner');
  assert.ok(being.some((hit) => hit.kind === 'being' && hit.ref === 'participant:central:owner'));
  assert.ok(searchField(snapshot(), 'shared field').some((hit) => hit.kind === 'field'));
  assert.deepEqual(searchField({ state: 'unavailable' }, 'x'), []);
});

test('the primary projection is the entry\'s own latest published one, else the world\'s', () => {
  const rows = snapshot();
  const expression = primaryProjection({ state: 'hosted', entry: rows.entries[2], projections: rows.projections.filter((projection) => projection.subject.ref === 'expression:e') });
  assert.equal(expression.projection_revision, 2);
  const node = primaryProjection({ state: 'hosted', entry: rows.entries[1], projections: rows.projections.filter((projection) => projection.subject.ref === 'world:central:project:O-I') });
  assert.equal(node.projection_ref, 'projection:central:project:O-I');
  assert.equal(primaryProjection({ state: 'absent' }), null);
  assert.equal(primaryProjection({ state: 'hosted', entry: rows.entries[1], projections: [] }), null);
});

test('constellation places every entry and Being deterministically inside the extent', () => {
  const reading = fieldReading(snapshot());
  const a = constellation(reading, { width: 800, height: 520 });
  const b = constellation(reading, { width: 800, height: 520 });
  assert.deepEqual(a, b);
  for (const ref of ['world:central:project:O-I', 'world:central:project:O-I/wiki:node:project-root/o-i', 'expression:e', 'participant:central:owner']) {
    assert.ok(a[ref], `${ref} is placed`);
    assert.ok(a[ref].x >= 0 && a[ref].x <= 800 && a[ref].y >= 0 && a[ref].y <= 520, `${ref} within extent`);
  }
  assert.equal(a['world:central:project:O-I'].world, true);
  assert.deepEqual(relationsOf(snapshot().relations, 'world:central:project:O-I'), [{ relation: 'oi.world/wiki-node', origin: 'projection', direction: 'out', other: 'world:central:project:O-I/wiki:node:project-root/o-i' }]);
});

test('watch standing follows the caller\'s own authority and watch rows', () => {
  const rows = snapshot();
  const reading = { state: 'hosted', field_ref: 'oi:field:central:project:O-I', entry: rows.entries[0], my_authority: rows.my_authority, my_watches: [] };
  assert.deepEqual(watchStanding(reading), { available: true, watching: false, participant_ref: 'participant:central:owner', field_ref: 'oi:field:central:project:O-I' });
  const watching = watchStanding({ ...reading, my_watches: [{ watch_ref: 'w', target_ref: rows.entries[0].ref, state: 'active', watcher_participant_ref: 'participant:central:owner' }] });
  assert.equal(watching.watching, true);
  assert.equal(watchStanding({ ...reading, my_authority: [] }).available, false);
  assert.equal(watchStanding({ ...reading, field_ref: null, my_authority: [] }).reason, 'the entry names no SharedField');
  assert.equal(watchTargetKind('central-world'), 'world');
  assert.equal(watchTargetKind('wiki-node'), 'wiki-node');
  assert.equal(watchTargetKind('expression'), 'object');
});
