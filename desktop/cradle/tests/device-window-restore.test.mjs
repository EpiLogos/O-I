// A popped-out device is not persisted state (seam 8, review finding 1): its window dies with the app, so a saved
// device binding and its detached entry are read and dropped SILENTLY. A device-only layout restores as a valid empty
// layout, and a layout with tabs keeps its tabs. Old books that still carry a device are tolerated.
// Behavioural: the production load path (loadWorkspaceBook) over a Map-backed localStorage.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/device-window-restore.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// Map-backed localStorage FIRST, before any module import: the store and the checkpoint journal are storage-bound.
const backing = new Map();
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => { backing.set(k, String(v)); },
  removeItem: (k) => { backing.delete(k); },
  key: (i) => [...backing.keys()][i] ?? null,
  get length() { return backing.size; },
};

const { decodeLayoutProgressive } = await import('../src/workspace/checkpoints.ts');
const { loadWorkspaceBook } = await import('../src/workspace/store.ts');

const BOOK_KEY = 'oi-cradle.workspaces.v1';
const DEVICE = 'device:probe/face';
const device = () => ({
  id: DEVICE, kind: 'device', title: 'probe · face', ref: DEVICE,
  device: { family: 'probe', face: 'face', aperture: { day: null, flow: null, conversation: null, instrument: null } },
});
const tab = (id) => ({ id, kind: 'system', title: `System ${id}` });
const deviceEntry = (groupId) => ({ surfaceId: DEVICE, groupId, index: 0, pinned: false });
const writingWorkspace = (id, layout) => ({
  id, name: id, writing: `words for ${id}`, layout,
  context: { subject: { ref: 'central:path:x', kind: 'artefact', title: 'X' } },
  recentPlaces: [],
});
const loadBook = (workspaces, active) => {
  backing.clear();
  backing.set(BOOK_KEY, JSON.stringify({ version: 2, active, workspaces }));
  return loadWorkspaceBook();
};

test('a layout whose only surface is a popped-out device decodes to a valid empty layout, with no drop note', () => {
  const raw = { root: null, surfaces: { [DEVICE]: device() }, detached: [deviceEntry('g1')], closedStack: [], focusedGroupId: null, agencyDepth: 'panel' };
  const result = decodeLayoutProgressive(raw, 'ws1');
  assert.ok(result.layout, 'the layout is not damaged-to-empty: the device is simply not restored');
  assert.equal(result.layout.root, null);
  assert.deepEqual(result.layout.surfaces, {}, 'the device binding is not restored as a workbench surface');
  assert.deepEqual(result.layout.detached ?? [], [], 'its detached entry leaves with it');
  assert.deepEqual(result.droppedBindingIds, [], 'a device is never a dropped binding');
  assert.deepEqual(result.notes, [], 'a device leaves no drop note');
  assert.equal(raw.surfaces[DEVICE].kind, 'device', 'the raw record is never mutated');
});

test('a device-only workspace restores with its writing, context and recents intact, and no quarantine', () => {
  const dev = writingWorkspace('dev-only', { root: null, surfaces: { [DEVICE]: device() }, detached: [deviceEntry('g1')], closedStack: [], focusedGroupId: null, agencyDepth: 'panel' });
  const { book, quarantine } = loadBook([dev], 'dev-only');
  const restored = book.workspaces.find(w => w.id === 'dev-only');
  assert.deepEqual(quarantine, [], 'nothing is quarantined: a popped device is not damage');
  assert.equal(restored.name, 'dev-only');
  assert.equal(restored.context.subject.ref, 'central:path:x', 'the context survives restore');
  // The writing is never lost: with no tabs to hold it, it is carried into its own draft surface.
  assert.ok(restored.layout.root, 'the workspace is not emptied');
  const carried = restored.layout.surfaces[`dev-only:carried-writing`];
  assert.ok(carried && carried.kind === 'draft', 'the writing is carried into a draft surface');
  assert.equal(JSON.parse(backing.get(`oi-cradle.unplaced-draft.v1:dev-only:carried-writing`)).text, 'words for dev-only', 'the writing text survives in the draft');
  assert.equal(restored.layout.surfaces[DEVICE], undefined, 'the device is not restored');
});

test('a layout with tabs and a popped-out device keeps its tabs and drops only the device', () => {
  const tabsAndDevice = { root: { type: 'group', id: 'g1', tabs: ['tab1'], pinned: [], active: 'tab1' }, surfaces: { tab1: tab('tab1'), [DEVICE]: device() }, detached: [deviceEntry('g1')], closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel' };
  const result = decodeLayoutProgressive(tabsAndDevice, 'ws1');
  assert.ok(result.layout, 'the tabbed layout restores');
  assert.deepEqual(result.layout.root.tabs, ['tab1'], 'the tab keeps its pane');
  assert.deepEqual(Object.keys(result.layout.surfaces), ['tab1']);
  assert.deepEqual(result.layout.detached ?? [], []);
  assert.deepEqual(result.notes, [], 'the device leaves no note');
  assert.deepEqual(result.droppedBindingIds, []);
});

test('a device-only layout still reads as damaged when a non-device binding is also unrestorable', () => {
  // The device's silence must not widen to other damage: a bad binding with nothing restorable still empties and names itself.
  const raw = { root: null, surfaces: { [DEVICE]: device(), ghost: { id: 'ghost', kind: 'shared-field-store', title: 'A second model' } }, detached: [deviceEntry('g1')], closedStack: [], focusedGroupId: null, agencyDepth: 'panel' };
  const result = decodeLayoutProgressive(raw, 'ws1');
  assert.equal(result.layout, null, 'a real drop with nothing restorable is still damaged-to-empty');
  assert.deepEqual(result.droppedBindingIds, ['ghost']);
  assert.ok(!result.notes.some(note => note.includes(DEVICE)), 'the device is never named as a drop');
});

test('a saved book with a popped device and a pane group restores the group and skips the device entry', () => {
  const raw = { root: { type: 'group', id: 'g1', tabs: [], pinned: [], active: null, emptySlot: true }, surfaces: { [DEVICE]: device() }, detached: [deviceEntry('g1')], closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel' };
  const result = decodeLayoutProgressive(raw, 'ws1');
  assert.ok(result.layout, 'the empty destination restores');
  assert.equal(result.layout.root.type, 'group');
  assert.equal(result.layout.root.emptySlot, true, 'an intentional empty slot survives; the device does not keep it alive as a detached slot');
  assert.deepEqual(result.layout.detached ?? [], []);
});
