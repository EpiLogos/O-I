import assert from 'node:assert/strict';
import test from 'node:test';
import { constituentReading } from '../src/explore/constituent.mjs';

const W = 'world:central:project:O-I';
const entries = [
  { ref: `${W}/central:position:project:O-I:aletheia-5`, kind: 'world-position', world_ref: W, label: 'Aletheia 5', meta: { handle: '@aletheia-5', role_ref: 'role:aletheia', agent_ref: 'agent/aletheia', disclosure: 'occupancy', occupancy: { state: 'occupied', generation_ordinal: 2, workcell_ref: 'workcell:mac' }, current_work: { outcome: 'none' } } },
  { ref: `${W}/workcell:mac`, kind: 'workcell', world_ref: W, label: 'Workcell mac', meta: { local_ref: 'workcell:mac', material_role: 'machine:current', disclosure: 'address' } },
  { ref: `${W}/skill/ql/darshana`, kind: 'practice', world_ref: W, label: 'darshana', meta: { practice_kind: 'skill', source_ref: 'skill/ql/darshana', source_revision: 'f3d55f2f', native_owner: 'ai-kit', availability: 'inspectable', grant: 'none' } },
  { ref: `${W}/run:1`, kind: 'activity', world_ref: W, label: 'Factory run 1', meta: { run_ref: 'run:1', state: 'seeded', liveness: 'live', participants: [] } },
  { ref: W, kind: 'central-world', world_ref: W, label: 'O-I' },
];
const relations = [
  { from: entries[0].ref, to: entries[1].ref, relation: 'oi.world/carried-by', origin: 'projection' },
  { from: entries[0].ref, to: entries[2].ref, relation: 'oi.world/practises', origin: 'projection', availability: 'inspectable' },
  { from: W, to: entries[3].ref, relation: 'oi.world/activity', origin: 'projection' },
];

test('an Agent Position reads as a Being with its Workcell and repertoire', () => {
  const reading = constituentReading(entries[0], relations, entries);
  assert.equal(reading.role, 'being');
  assert.deepEqual(reading.facts.find((f) => f.label === 'Occupancy'), { label: 'Occupancy', value: 'occupied · generation #2 · workcell:mac' });
  assert.deepEqual(reading.groups.map((g) => [g.title, g.items.map((i) => i.ref)]), [['Carried by', [entries[1].ref]], ['Practises', [entries[2].ref]]]);
  assert.equal(reading.groups[1].items[0].note, 'skill · inspectable');
});

test('a Workcell is a Thing that carries its Positions and offers nothing unless listed', () => {
  const reading = constituentReading(entries[1], relations, entries);
  assert.equal(reading.role, 'thing');
  assert.equal(reading.facts.find((f) => f.label === 'Offered').value, 'nothing offered — inspectable only');
  assert.deepEqual(reading.groups[0].items.map((i) => i.ref), [entries[0].ref]);
});

test('a practice keeps its source revision and says publication is not permission', () => {
  const reading = constituentReading(entries[2], relations, entries);
  assert.equal(reading.facts.find((f) => f.label === 'Source revision').value, 'f3d55f2f');
  assert.equal(reading.facts.find((f) => f.label === 'Granted use').value, 'none — publication is not permission');
  assert.deepEqual(reading.groups[0].items.map((i) => i.ref), [entries[0].ref]);
});

test('an activity with no attested participants says so rather than inventing them', () => {
  const reading = constituentReading(entries[3], relations, entries);
  assert.equal(reading.facts.find((f) => f.label === 'Participants').value, 'none attested by the owner');
  assert.equal(reading.groups.length, 0);
});

test('other kinds keep their own renderer', () => {
  assert.equal(constituentReading(entries[4], relations, entries), null);
});

test('a relation carried by both the field view and the reading is one item', () => {
  const reading = constituentReading(entries[0], [...relations, ...relations], entries);
  assert.deepEqual(reading.groups[0].items.map((i) => i.ref), [entries[1].ref]);
});
