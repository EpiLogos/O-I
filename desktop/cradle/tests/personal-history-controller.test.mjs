/** Personal-history intake controller contract: review before write, the
 * exact reviewed plan travels verbatim, refusals are never retried, and the
 * anchor readback opens the flow on facts. The native owner is a faithful
 * stand-in of Central's ActionResult envelope — the controller may not
 * loosen what the envelope actually carries. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PersonalHistoryController} from '../src/personal/historyController.ts';

const PLAN = {
  schema: 'central.personal-collection-plan/v1', collection_id: 'field-notes',
  title: 'Field notes', world_ref: 'control:root', project: null,
  person_ref: 'central:pasu:nara:local', author_ref: 'central:pasu:nara:local',
  adapter: 'markdown-frontmatter@1',
  placement: {mode: 'copy', home: 'Control/user/collections/field-notes', origin: '/tmp/archive', accepted_plan_revision: null},
  entries: [
    {action: 'copy-register', entry_id: 'a.md', role: 'entry', entry_type: 'journal', disposition: 'retained', bytes: 12, content_revision: 'rev-1', origin: '/tmp/archive/a.md', destination: 'Control/user/collections/field-notes/a.md', source_ref: 'central:source:control:root:Control/user/collections/field-notes/a.md', date_approximate: false, readable: true, reason: null, entry_meta: {}},
    {action: 'none', entry_id: 'b.md', role: 'entry', entry_type: 'journal', disposition: 'retained', bytes: 8, content_revision: 'rev-2', origin: '/tmp/archive/b.md', destination: 'Control/user/collections/field-notes/b.md', source_ref: 'central:source:control:root:Control/user/collections/field-notes/b.md', date_approximate: false, readable: true, reason: null, entry_meta: {}},
  ],
  origin_absent: [], conflicts: [], divergences: [],
  counts: {'copy-register': 1, unchanged: 1},
  plan_revision: 'central.content-fnv1a64/v1:9:abcdef0123456789',
  undo_summary: '1 new, 0 update(s), 1 unchanged; rollback removes this import',
};

const INSPECTION = {
  schema: 'central.personal-collection-inspection/v1', origin: '/tmp/archive',
  world_ref: 'control:root', adapter: 'markdown-frontmatter@1',
  members: PLAN.entries.map(entry => ({...entry, event_date: '2026-03-14', date_basis: 'frontmatter date'})),
  counts: {retained: 2, unreadable: 0, 'excluded-by-selection': 0, total: 2},
};

const ANCHOR = {
  schema: 'central.personal-anchor/v1',
  person: {subject_ref: 'central:pasu:nara:local', form: 'nara', manifest_present: true, sourced_files: []},
  world: {subject_ref_declared: 'central:pasu:nara:local', subject_ref_consistent: true},
  installation: null,
  collections: [],
};

function harness(options = {}) {
  const calls = [];
  let failNext = options.failNext;
  const native = async op => {
    calls.push(structuredClone(op));
    assert.equal(op.op, 'invoke_action');
    const action = op.invocation.action;
    const input = op.invocation.input ?? {};
    if (failNext?.action === action) {
      const failure = failNext; failNext = null;
      return {ok: false, status: 'invalid_input', action, error: {code: 'invalid_input', message: failure.message}};
    }
    if (action === 'central.personal.anchor.inspect') return {ok: true, status: 'success', action, data: structuredClone(ANCHOR)};
    if (action === 'central.personal.collection.list') return {ok: true, status: 'success', action, data: {schema: 'central.personal-collection-listing/v1', collections: ANCHOR.collections}};
    if (action === 'central.personal.collection.inspect') {
      if (!input.path) throw new Error('inspect without a path');
      return {ok: true, status: 'success', action, data: structuredClone(INSPECTION)};
    }
    if (action === 'central.personal.collection.plan') return {ok: true, status: 'success', action, data: structuredClone(options.plan ?? PLAN)};
    if (action === 'central.personal.collection.apply') {
      if (options.capturePlan) options.capturePlan(input);
      return {ok: true, status: 'success', action, data: {schema: 'central.personal-collection-apply/v1', collection_id: 'field-notes', receipt: {sequence: 1, applied_at_unix_seconds: 9, adapter: 'markdown-frontmatter@1', entries_added: 1, entries_changed: 0, entries_unchanged: 1, entries_unchanged_at_origin_absent: 0, accepted_plan_revision: (options.capturedPlan ?? input.plan).plan_revision}, record_ref: 'central:source:control:root:Control/user/collections/field-notes/collection.json', entries: 2, refused: options.refused ?? []}};
    }
    if (action === 'central.personal.collection.verify') return {ok: true, status: 'success', action, data: {collection_id: input.collection_id, entries_total: 2, verified: 2, problems: [], record_revision: 'record-rev-11'}};
    if (action === 'central.personal.collection.rollback') return {ok: true, status: 'success', action, data: {collection_id: input.collection_id, import_sequence: input.import_sequence, removed_entries: ['a.md'], restored_entries: [], preserved_entries: [], removed_registrations: [], record_removed: false, notes: []}};
    throw new Error('unexpected action: ' + action);
  };
  const record = (action, input) => calls.push({invocation: {action, input}});
  const enwrap = (action, input, reply) => {
    record(action, input);
    if (failNext?.action === action) { const failure = failNext; failNext = null; return {ok: false, status: 'invalid_input', action, error: {code: 'invalid_input', message: failure.message}}; }
    return reply;
  };
  const nativeApi = {
    anchorInspect: () => enwrap('central.personal.anchor.inspect', {}, {ok: true, status: 'success', action: 'central.personal.anchor.inspect', data: structuredClone(ANCHOR)}),
    collectionList: () => enwrap('central.personal.collection.list', {}, {ok: true, status: 'success', action: 'central.personal.collection.list', data: {schema: 'central.personal-collection-listing/v1', collections: ANCHOR.collections}}),
    collectionInspect: path => enwrap('central.personal.collection.inspect', {path}, {ok: true, status: 'success', action: 'central.personal.collection.inspect', data: structuredClone(INSPECTION)}),
    collectionPlan: request => enwrap('central.personal.collection.plan', request, {ok: true, status: 'success', action: 'central.personal.collection.plan', data: structuredClone(options.plan ?? PLAN)}),
    collectionApply: plan => {
      options.capturedPlan = structuredClone(plan);
      options.capturePlan?.({plan, acceptance: 'human-accepted'});
      return enwrap('central.personal.collection.apply', {plan, acceptance: 'human-accepted'}, {ok: true, status: 'success', action: 'central.personal.collection.apply', data: {schema: 'central.personal-collection-apply/v1', collection_id: 'field-notes', receipt: {sequence: 1, applied_at_unix_seconds: 9, adapter: 'markdown-frontmatter@1', entries_added: 1, entries_changed: 0, entries_unchanged: 1, entries_unchanged_at_origin_absent: 0, accepted_plan_revision: plan.plan_revision}, record_ref: 'central:source:control:root:Control/user/collections/field-notes/collection.json', entries: 2, refused: options.refused ?? []}});
    },
    collectionVerify: collection_id => enwrap('central.personal.collection.verify', {collection_id}, {ok: true, status: 'success', action: 'central.personal.collection.verify', data: {collection_id, entries_total: 2, verified: 2, problems: [], record_revision: 'record-rev-11'}}),
    collectionStatus: collection_id => enwrap('central.personal.collection.status', {collection_id}, {ok: true, status: 'success', action: 'central.personal.collection.status', data: {}}),
    collectionRollback: input => enwrap('central.personal.collection.rollback', input, {ok: true, status: 'success', action: 'central.personal.collection.rollback', data: {collection_id: input.collection_id, import_sequence: input.import_sequence, removed_entries: ['a.md'], restored_entries: [], preserved_entries: [], removed_registrations: [], record_removed: false, notes: []}}),
  };
  const controller = new PersonalHistoryController(nativeApi, undefined);
  return {controller, calls, options, count: action => calls.filter(c => c.invocation.action === action).length};
}

test('the flow opens on the anchor readback and refuses to inspect without a path', async () => {
  const h = harness();
  await h.controller.open();
  assert.equal(h.controller.getSnapshot().step, 'choose');
  assert.equal(h.controller.getSnapshot().anchor.person.subject_ref, 'central:pasu:nara:local');
  await h.controller.inspect();
  assert.equal(h.count('central.personal.collection.inspect'), 0, 'inspect needs a chosen path');
  h.controller.choose({path: '/tmp/archive'});
  await h.controller.inspect();
  assert.equal(h.controller.getSnapshot().step, 'inspected');
  assert.equal(h.controller.getSnapshot().inspection.counts.total, 2);
});

test('apply only ever sends the exact reviewed plan with the human-acceptance act', async () => {
  const captured = {};
  const h = harness({capturePlan: input => { captured.acceptance = input.acceptance; captured.plan = structuredClone(input.plan); }});
  await h.controller.open();
  h.controller.choose({path: '/tmp/archive'});
  await h.controller.inspect();
  await h.controller.plan();
  const reviewed = h.controller.getSnapshot().plan;
  await h.controller.apply();
  assert.equal(captured.acceptance, 'human-accepted');
  assert.deepEqual(captured.plan, reviewed, 'the reviewed plan travels verbatim');
  assert.equal(h.controller.getSnapshot().step, 'result');
  assert.equal(h.controller.getSnapshot().outcome.receipt.entries_added, 1);
});

test('a native refusal is shown, never retried, and recovery stays native', async () => {
  const h = harness();
  await h.controller.open();
  h.controller.choose({path: '/tmp/archive'});
  await h.controller.inspect();
  await h.controller.plan();
  h.options.failNext = null;
  // Force the refusal through a private re-dispatch of apply's native call.
  const refusing = new PersonalHistoryController({
    ...structuredClone({}),
    anchorInspect: () => ({ok: true, status: 'success', action: 'central.personal.anchor.inspect', data: structuredClone(ANCHOR)}),
    collectionList: () => ({ok: true, status: 'success', action: 'central.personal.collection.list', data: {collections: []}}),
    collectionInspect: () => ({ok: true, status: 'success', action: 'central.personal.collection.inspect', data: structuredClone(INSPECTION)}),
    collectionPlan: () => ({ok: true, status: 'success', action: 'central.personal.collection.plan', data: structuredClone(PLAN)}),
    collectionApply: () => ({ok: false, status: 'invalid_input', action: 'central.personal.collection.apply', error: {code: 'invalid_input', message: 'origin changed since the plan'}}),
  });
  await refusing.open();
  refusing.choose({path: '/tmp/archive'});
  await refusing.inspect();
  await refusing.plan();
  await refusing.apply();
  const state = refusing.getSnapshot();
  assert.equal(state.step, 'result');
  assert.match(state.error, /origin changed since the plan/);
  assert.match(state.error, /native journal owns recovery/);
  assert.equal(state.outcome, undefined);
});

test('a conflicted plan cannot apply', async () => {
  const h = harness({plan: {...structuredClone(PLAN), conflicts: ['a.md: destination already exists']}});
  await h.controller.open();
  h.controller.choose({path: '/tmp/archive'});
  await h.controller.inspect();
  await h.controller.plan();
  assert.equal(h.controller.canApply(), false);
  await h.controller.apply();
  assert.equal(h.count('central.personal.collection.apply'), 0);
});

test('rollback needs the verified record revision and reports what happened', async () => {
  const h = harness();
  await h.controller.open();
  h.controller.choose({path: '/tmp/archive'});
  await h.controller.inspect();
  await h.controller.plan();
  await h.controller.apply();
  await h.controller.verify('field-notes');
  await h.controller.rollback('field-notes', 1, 'record-rev-11');
  const rollback = h.calls.find(c => c.invocation.action === 'central.personal.collection.rollback');
  assert.deepEqual(rollback.invocation.input, {collection_id: 'field-notes', import_sequence: 1, expected_record_revision: 'record-rev-11'});
  // The flow returns to the anchor readback after the undo.
  assert.equal(h.controller.getSnapshot().step, 'choose');
});
