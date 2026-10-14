// FOUNDATION F1: Live stands on its own book mode; one selection in the world context, each move on the trail;
// named sets kept in the book and returned to (src/workspace/store.ts, src/workspace/mode.ts).
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/named-sets-selection.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const {switchWorkspaceMode, saveNamedSet, applyNamedSet, decodeWorldContext} = await import('../src/workspace/store.ts');
const {WORKSPACE_MODES, STRIP_MODES, TREE_MODES, MODE_CURATION} = await import('../src/workspace/mode.ts');

const group = (id, tabs) => ({type: 'group', id, tabs, pinned: [], active: tabs[0] ?? null});
const workspace = () => ({
  id: 'w', name: 'W', writing: '',
  layout: {root: group('g1', ['a']), surfaces: {a: {id: 'a', kind: 'blank', title: 'A'}}, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel', rightDepth: 'collapsed', leftWidth: 260, rightWidth: 400},
});

test('Live is its own book mode: its own tree, never in the legacy desktop strip', () => {
  assert.ok(WORKSPACE_MODES.includes('live') && TREE_MODES.includes('live'));
  assert.ok(!STRIP_MODES.includes('live'), 'the legacy desktop has no Live');
  assert.equal(MODE_CURATION.live.label, 'Live');
  const live = switchWorkspaceMode(workspace(), 'live');
  assert.equal(live.layout.mode, 'live');
  assert.equal(live.modeLayouts.base.root.tabs[0], 'a', "Central's tree waits, intact");
  const back = switchWorkspaceMode({...live, layout: {...live.layout, root: group('g9', ['z']), surfaces: {z: {id: 'z', kind: 'blank', title: 'Z'}}}}, 'base');
  assert.equal(back.layout.root.tabs[0], 'a', 'Central returns to its own tree');
  assert.equal(back.modeLayouts.live.root.tabs[0], 'z', "and Live's waits for it");
});

test('the one selection decodes from the world context, and a damaged one is dropped', () => {
  const context = decodeWorldContext({selection: {mode: 'factory', kind: 'agent-session', ref: 'space:a/session:b', title: 'Builder'}});
  assert.deepEqual(context.selection, {mode: 'factory', kind: 'agent-session', ref: 'space:a/session:b', title: 'Builder', track: undefined});
  assert.equal(decodeWorldContext({selection: {mode: 'nowhere', kind: 'x', ref: 'r', title: 't'}}), undefined);
  assert.equal(decodeWorldContext({selection: {mode: 'base', kind: 'day', ref: '', title: 't'}}), undefined);
});

test('a named set keeps the mode\'s arrangement; returning to it stands in its mode and takes its tree', () => {
  const live = switchWorkspaceMode(workspace(), 'live');
  const arranged = {...live, layout: {...live.layout, root: group('g2', ['s']), surfaces: {s: {id: 's', kind: 'blank', title: 'S'}}, applicationView: {schema: 'oi.application-view/v1', version: 1, app_id: 'x', payload: {tab: 'arrangement'}}}};
  const saved = saveNamedSet(arranged, ' Mixing ', 'set-1', 10);
  assert.equal(saved.sets.length, 1);
  assert.equal(saved.sets[0].name, 'Mixing'); assert.equal(saved.sets[0].mode, 'live');
  assert.equal(saved.sets[0].layout.root.tabs[0], 's');
  assert.equal(saveNamedSet(arranged, '   ').sets, undefined, 'a set needs a name');
  const resaved = saveNamedSet(saved, 'Mixing', 'set-2', 20);
  assert.deepEqual(resaved.sets.map(set => set.id), ['set-2'], 'a same-named set in the same mode is replaced');

  const elsewhere = switchWorkspaceMode({...resaved, layout: {...resaved.layout, rightWidth: 512}}, 'factory');
  const returned = applyNamedSet(elsewhere, 'set-2', 99);
  assert.equal(returned.layout.mode, 'live', 'the set stands in its own mode');
  assert.equal(returned.layout.root.tabs[0], 's');
  assert.equal(returned.layout.applicationView.payload.tab, 'arrangement', 'with its frame');
  assert.equal(returned.layout.rightWidth, 512, 'the side widths stay as they are');
  assert.equal(returned.layout.appliedSet, 'set-2@99', 'the frame is told a set was applied');
  assert.equal(applyNamedSet(elsewhere, 'missing'), elsewhere);
});
