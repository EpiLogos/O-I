// FOUNDATION F2, manual §10.2: ⊞ splits a pane Beside, Below or Four ways; a drop on a pane's edge makes a new split; a
// projection pane follows the selection or is pinned to a subject; a pane kind is an open set with builds.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/pane-grammar.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const {splitQuad, dropOnEdge, pinSubject, groupsOf, makeProjectionBinding, openBinding} = await import('../src/surface/engine.ts');
const {executeFrameAction} = await import('../src/surface/registry.ts');
const {isProjectionPaneKind} = await import('../src/surface/types.ts');
const {registerProjectionModule, projectionModule, projectionBuilds, admittedProjectionKinds, resetProjectionModulesForTest} = await import('../src/surface/projectionModules.ts');
const {dropEdge} = await import('../src/surface/dropEdge.ts');

const group = (id, tabs) => ({type: 'group', id, tabs, pinned: [], active: tabs[0] ?? null});
const layout = () => ({root: group('g1', ['a', 'b']), surfaces: {a: {id: 'a', kind: 'blank', title: 'A'}, b: {id: 'b', kind: 'blank', title: 'B'}}, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel', rightDepth: 'collapsed', leftWidth: 260, rightWidth: 320});

test('Four ways: one pane becomes four, keeping its tabs in the upper left', () => {
  const next = splitQuad(layout(), 'g1');
  const groups = groupsOf(next.root);
  assert.equal(groups.length, 4);
  assert.deepEqual(groups[0].tabs, ['a', 'b'], 'the pane keeps its tabs');
  assert.ok(groups.slice(1).every(g => g.tabs.length === 0 && g.emptySlot), 'three empty panes join it');
  assert.equal(next.root.dir, 'v'); assert.equal(next.root.children[0].dir, 'h'); assert.equal(next.root.children[1].dir, 'h');
  assert.equal(executeFrameAction(layout(), 'surface.split-quad', {groupId: 'g1'}).root.type, 'split', 'the frame action reaches it');
  const held = layout();
  assert.equal(splitQuad(held, 'missing'), held, 'no such pane, no change');
});

test('a drop on a pane\'s edge stands the surface alone in a new pane on that edge', () => {
  for (const [edge, dir, after] of [['left', 'h', false], ['right', 'h', true], ['top', 'v', false], ['bottom', 'v', true]]) {
    const next = executeFrameAction(layout(), 'surface.drop-edge', {surfaceId: 'b', groupId: 'g1', edge});
    assert.equal(next.root.type, 'split', edge); assert.equal(next.root.dir, dir, edge);
    const [first, second] = next.root.children;
    const moved = after ? second : first, kept = after ? first : second;
    assert.deepEqual(moved.tabs, ['b'], edge); assert.deepEqual(kept.tabs, ['a'], edge);
    assert.equal(next.focusedGroupId, moved.id, 'the new pane has focus');
  }
  const lone = {...layout(), root: group('g1', ['a'])};
  assert.equal(dropOnEdge(lone, 'a', 'g1', 'right'), lone, 'a pane\'s only tab cannot split from itself');
});

test('a projection pane follows the selection until pinned, and a pin is released by passing no subject', () => {
  const base = layout();
  const binding = makeProjectionBinding(base, 'projection.earth');
  const opened = openBinding(base, binding);
  const pinned = pinSubject(opened, binding.id, 'wiki:node:identity');
  assert.equal(pinned.surfaces[binding.id].projection.subject_ref, 'wiki:node:identity');
  const following = executeFrameAction(pinned, 'surface.pin-subject', {surfaceId: binding.id});
  assert.equal(following.surfaces[binding.id].projection.subject_ref, undefined);
  assert.equal(pinSubject(opened, 'a', 'x'), opened, 'a pane that is not a projection has no subject to pin');
});

test('pane kinds are an open set, and a kind may carry several builds that answer to the same controls', () => {
  resetProjectionModulesForTest();
  assert.ok(isProjectionPaneKind('projection.palace') && isProjectionPaneKind('projection.earth'));
  assert.ok(!isProjectionPaneKind('projection.') && !isProjectionPaneKind('earth') && !isProjectionPaneKind('projection.Earth'));
  const create = () => ({unmount() {}});
  registerProjectionModule({id: 'palace-board', kind: 'projection.palace', build: {id: 'board', label: 'Board'}, create});
  registerProjectionModule({id: 'palace-walk', kind: 'projection.palace', build: {id: 'walk', label: 'Walk'}, create});
  assert.deepEqual(projectionBuilds('projection.palace').map(m => m.build.id), ['board', 'walk']);
  assert.equal(projectionModule('projection.palace').id, 'palace-board', 'the first build is the default');
  assert.equal(projectionModule('projection.palace', 'walk').id, 'palace-walk');
  assert.throws(() => registerProjectionModule({id: 'other', kind: 'projection.palace', create}), /already admitted/, 'an unbuilt second module still refuses');
  registerProjectionModule({id: 'earth', kind: 'projection.earth', create});
  assert.throws(() => registerProjectionModule({id: 'earth-2', kind: 'projection.earth', create}), /already admitted/);
  registerProjectionModule({id: 'earth', kind: 'projection.earth', create});
  assert.deepEqual(admittedProjectionKinds().sort(), ['projection.earth', 'projection.palace']);
  resetProjectionModulesForTest();
});

test('a pane\'s edges are its outer fifths; the middle opens into the pane', () => {
  const rect = {left: 0, top: 0, width: 100, height: 100};
  assert.equal(dropEdge(rect, 50, 50), null);
  assert.equal(dropEdge(rect, 5, 50), 'left'); assert.equal(dropEdge(rect, 95, 50), 'right');
  assert.equal(dropEdge(rect, 50, 5), 'top'); assert.equal(dropEdge(rect, 50, 95), 'bottom');
  assert.equal(dropEdge(rect, 21, 50), null, 'just inside the fifth is the middle');
});
