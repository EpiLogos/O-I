import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FIELD_DAY_SCHEMA, FIELD_NOW_SCHEMA, advanceFieldDay, advanceFieldNow, fieldDayDelta, fieldDayKey,
  fieldNowDelta, fieldTimeLeaks, validateFieldDay, validateFieldNow,
} from './field-now.mjs';

const FIELD = 'oi:field:test:field-now';
const MAC_ROOT = 'central:now:control:root:06cca2f04e1a408f451f36263de0d3c1dda2aa8547a27d3ed163c222bc711dea';
const MAC_CHILD = 'central:now:control:root:0a0a2fc9023a2a38203d9f7a27d2f0fc0edcdee60d9dd17f3e43690218fa649d';
const OMARCHY_ROOT = 'central:now:control:root:aa11';
const OMARCHY_CHILD = 'central:now:project:O-I:bb22';
const OWNER = 'participant:test:owner';
const B = 'participant:test:b';

const macRoot = { now_ref: MAC_ROOT, workcell_ref: 'workcell:mac', world_ref: 'control:root', revision: 'central.content-fnv1a64/v1:863:cc1887a08302dcb5' };
const macChild = { now_ref: MAC_CHILD, parent_now_ref: MAC_ROOT, workcell_ref: 'workcell:mac', purpose_summary: 'FieldNow packet', state: 'active' };
const omarchyChild = { now_ref: OMARCHY_CHILD, parent_now_ref: OMARCHY_ROOT, workcell_ref: 'workcell:omarchy', state: 'active' };
const provenance = [{ kind: 'projection', ref: 'central:action:central.now.list', source_system: 'central' }];

function first() {
  return advanceFieldNow(null, {
    expected_revision: 0, projected_by: OWNER, field_ref: FIELD, audience: { visibility: 'public' }, provenance,
    upsert_root_now_refs: [macRoot], upsert_child_now_refs: [macChild],
  });
}

test('the first FieldNow projects a Workcell root and a child NOW at revision 1, attributed', () => {
  const now = first();
  assert.equal(now.schema, FIELD_NOW_SCHEMA);
  assert.equal(now.revision, 1);
  assert.deepEqual(now.projected_root_now_refs, [{ ...macRoot, projected_by: OWNER }]);
  assert.deepEqual(now.projected_child_now_refs, [{ ...macChild, projected_by: OWNER }]);
  assert.deepEqual(fieldTimeLeaks(now), []);
});

test('advancing is compare-and-swap: exact expected revision → revision + 1; stale is refused', () => {
  const r1 = first();
  const r2 = advanceFieldNow(r1, { expected_revision: 1, projected_by: B, upsert_child_now_refs: [omarchyChild] });
  assert.equal(r2.revision, 2);
  assert.equal(r2.projected_child_now_refs.find((entry) => entry.now_ref === OMARCHY_CHILD).projected_by, B);
  assert.throws(() => advanceFieldNow(r2, { expected_revision: 1, projected_by: B, withdraw_child_now_refs: [OMARCHY_CHILD] }), /moved on: it is at revision 2, writer expected 1/);
  assert.throws(() => advanceFieldNow(r2, { projected_by: B }), /expected_revision/);
  assert.throws(() => advanceFieldNow(null, { expected_revision: 1, field_ref: FIELD, audience: { visibility: 'public' }, provenance }), /moved on/);
  const r3 = advanceFieldNow(r2, { expected_revision: 2, projected_by: B, withdraw_child_now_refs: [OMARCHY_CHILD] });
  assert.equal(r3.revision, 3);
  assert.equal(r3.projected_child_now_refs.length, 1);
  assert.equal(r1.revision, 1, 'prior readings are never mutated');
});

test('the delta names exactly what a step touched and who it is attributed to', () => {
  const r1 = first();
  const r2 = advanceFieldNow(r1, { expected_revision: 1, projected_by: B, upsert_child_now_refs: [omarchyChild] });
  assert.deepEqual(fieldNowDelta(r1, r2), { roots: [], children: [{ ref: OMARCHY_CHILD, change: 'added', projected_by: [B] }], envelope_changed: false });
  const hijack = advanceFieldNow(r2, { expected_revision: 2, projected_by: B, upsert_child_now_refs: [{ ...macChild, projected_by: B }] });
  assert.deepEqual(fieldNowDelta(r2, hijack).children, [{ ref: MAC_CHILD, change: 'changed', projected_by: [OWNER, B] }], 'rewriting another participant\'s entry is visible as touching both attributions');
  assert.equal(fieldNowDelta(null, r1).envelope_changed, true);
});

test('one root NOW per Workcell; a child is situated on its projected root\'s Workcell', () => {
  const r1 = first();
  assert.throws(() => advanceFieldNow(r1, { expected_revision: 1, projected_by: OWNER, upsert_root_now_refs: [{ ...macRoot, now_ref: 'central:now:control:root:ff' }] }), /two root NOWs for workcell:mac/);
  assert.throws(() => advanceFieldNow(r1, { expected_revision: 1, projected_by: B, upsert_child_now_refs: [{ ...omarchyChild, parent_now_ref: MAC_ROOT }] }), /situated on workcell:omarchy but its projected root is on workcell:mac/);
  assert.throws(() => advanceFieldNow(r1, { expected_revision: 1, projected_by: OWNER, upsert_root_now_refs: [{ ...macRoot, now_ref: MAC_CHILD, workcell_ref: 'workcell:omarchy' }] }), /more than once/);
});

test('FieldNow refuses local-only identity beyond refs', () => {
  const r1 = first();
  const cases = [
    [{ ...macChild, purpose_summary: 'see /Users/admin/Central/Control/agents/now/x.json' }, /local-home-path|local-absolute-path/],
    [{ ...macChild, purpose_summary: 'continue claude-code:session:18a1d321abcd' }, /agent-session-ref|session-ref/],
    [{ ...macChild, purpose_summary: 'gateway ws://100.64.0.7:7337' }, /gateway-address/],
    [{ ...macChild, purpose_summary: 'read file:///etc/passwd' }, /file-url/],
    [{ ...macChild, session_space_ref: 'session-space:abc' }, /not part of oi.field-now\/v1/],
    [{ ...macChild, now_ref: '/Users/admin/Central/Control/agents/now/abc.json' }, /not a well-formed ref/],
    [{ ...macChild, workcell_ref: 'workcell:mac@100.92.62.101' }, /not a well-formed ref/],
  ];
  for (const [child, pattern] of cases) {
    assert.throws(() => advanceFieldNow(r1, { expected_revision: 1, projected_by: OWNER, upsert_child_now_refs: [child] }), pattern);
  }
  assert.throws(() => validateFieldNow({ ...r1, gateway_address: 'ws://x' }), /not part of/);
  assert.throws(() => validateFieldNow({ ...r1, presence_cursor: 'presence@/home/frank/.local/state/oi' }), /local-(home|absolute)-path/);
  assert.throws(() => validateFieldNow({ ...r1, audience: { visibility: 'private' } }), /private audience must name/);
});

test('cursors advance and clear; the first revision requires its envelope', () => {
  const r1 = first();
  const r2 = advanceFieldNow(r1, { expected_revision: 1, projected_by: OWNER, presence_cursor: `presence:${FIELD}@1790550025000000`, activity_cursor: 'activity:field@12' });
  assert.equal(r2.presence_cursor, `presence:${FIELD}@1790550025000000`);
  const r3 = advanceFieldNow(r2, { expected_revision: 2, projected_by: OWNER, activity_cursor: null });
  assert.equal(r3.activity_cursor, undefined);
  assert.equal(r3.presence_cursor, r2.presence_cursor);
  assert.throws(() => advanceFieldNow(null, { expected_revision: 0, projected_by: OWNER, field_ref: FIELD }), /requires field_ref, audience and provenance/);
  assert.throws(() => advanceFieldNow(r1, { expected_revision: 1, field_ref: 'oi:field:other' }), /cannot move between SharedFields/);
});

const interval = { start: '2026-09-28T00:00:00.000Z', end: '2026-09-29T00:00:00.000Z', policy: 'utc-day' };
const policy = { source_system: 'oi', ref: 'oi:field-time-policy:utc-day', revision: '1' };

test('FieldDay keeps its own aggregation policy while source Day refs stay intact and attributed', () => {
  const d1 = advanceFieldDay(null, {
    expected_revision: 0, projected_by: OWNER, field_ref: FIELD, interval, temporal_policy_provenance: policy, audience: { visibility: 'public' },
    upsert_source_day_refs: [{ day_ref: 'central:day:control:root:2026-09-28', workcell_ref: 'workcell:mac' }],
    upsert_now_refs: [{ now_ref: MAC_CHILD }],
  });
  assert.equal(d1.schema, FIELD_DAY_SCHEMA);
  assert.equal(d1.revision, 1);
  assert.equal(fieldDayKey(d1), `${FIELD}|${interval.start}|${interval.end}`);
  const d2 = advanceFieldDay(d1, { expected_revision: 1, projected_by: B, upsert_source_day_refs: [{ day_ref: 'central:day:control:root:2026-09-29', workcell_ref: 'workcell:omarchy' }], cursors: { contribution_cursor: 'contribution:field@3' } });
  assert.equal(d2.revision, 2);
  assert.deepEqual(d2.interval, interval, 'the field interval never absorbs a participant\'s local civil Day');
  assert.deepEqual(d2.projected_source_day_refs.map((entry) => [entry.day_ref, entry.projected_by]), [['central:day:control:root:2026-09-28', OWNER], ['central:day:control:root:2026-09-29', B]]);
  assert.deepEqual(fieldDayDelta(d1, d2), { entries: [{ ref: 'central:day:control:root:2026-09-29', change: 'added', projected_by: [B] }], envelope_changed: false });
  assert.throws(() => advanceFieldDay(d2, { expected_revision: 1, projected_by: B }), /moved on/);
  assert.throws(() => advanceFieldDay(d2, { expected_revision: 2, interval: { ...interval, end: '2026-09-30T00:00:00.000Z' } }), /interval is its identity/);
  assert.throws(() => validateFieldDay({ ...d2, interval: { ...interval, end: interval.start } }), /must follow its start/);
  assert.throws(() => advanceFieldDay(d2, { expected_revision: 2, projected_by: B, upsert_source_day_refs: [{ day_ref: 'Control/user/day/2026-09-28/day.md' }] }), /not a well-formed ref/);
  assert.throws(() => validateFieldDay({ ...d2, cursors: { encounter_cursor: 'encounter at /home/frank/x' } }), /local-(home|absolute)-path/);
});

test('the JSON schema names exactly the keys the validators accept', async () => {
  const { readFileSync } = await import('node:fs');
  const schema = JSON.parse(readFileSync(new URL('./field-now-schema-v1.json', import.meta.url), 'utf8'));
  const r1 = first();
  assert.deepEqual(Object.keys(schema.$defs.field_now.properties).sort(), ['activity_cursor', 'audience', 'contribution_cursor', 'field_ref', 'presence_cursor', 'projected_child_now_refs', 'projected_root_now_refs', 'provenance', 'revision', 'schema']);
  for (const key of Object.keys(r1)) assert.ok(key in schema.$defs.field_now.properties, key);
  for (const key of Object.keys(r1.projected_child_now_refs[0])) assert.ok(key in schema.$defs.field_now.properties.projected_child_now_refs.items.properties, key);
  assert.equal(schema.$defs.field_now.properties.schema.const, FIELD_NOW_SCHEMA);
  assert.equal(schema.$defs.field_day.properties.schema.const, FIELD_DAY_SCHEMA);
});
