import assert from 'node:assert/strict';
import test from 'node:test';
import { fieldNowReading } from '../src/explore/field-now-reading.mjs';

const F = 'oi:field:x';
const snapshot = { field_now: [{ field_ref: F, revision: 2, contract: {
  projected_root_now_refs: [{ now_ref: 'central:now:control:root:mac', workcell_ref: 'workcell:mac', world_ref: 'control:root', revision: 'r1', projected_by: 'participant:a' }],
  projected_child_now_refs: [
    { now_ref: 'central:now:project:O-I:child-a', parent_now_ref: 'central:now:control:root:mac', workcell_ref: 'workcell:mac', state: 'active', purpose_summary: 'explain', projected_by: 'participant:a' },
    { now_ref: 'central:now:project:B:child-b', parent_now_ref: 'central:now:control:root:omarchy', workcell_ref: 'workcell:omarchy', state: 'active', projected_by: 'participant:b' },
  ] } }] };

test('children group under the Workcell that carries them; a child whose root is not projected says so', () => {
  const reading = fieldNowReading(snapshot, F);
  assert.equal(reading.revision, 2);
  assert.deepEqual(reading.workcells.map((w) => [w.workcell_ref, Boolean(w.root), w.children.map((c) => [c.now_ref, c.under_root, c.projected_by])]), [
    ['workcell:mac', true, [['central:now:project:O-I:child-a', true, 'participant:a']]],
    ['workcell:omarchy', false, [['central:now:project:B:child-b', false, 'participant:b']]],
  ]);
});

test('a field without a FieldNow has none, not an empty one', () => {
  assert.equal(fieldNowReading(snapshot, 'oi:field:other'), null);
  assert.equal(fieldNowReading({}, F), null);
});
