// The device redock store gap (seam 8): a popped-out device's entry must leave every layout of its workspace, including a
// saved mode layout and a workspace that is not the current one, and never returns as a centre tab. Behavioural: the
// production store helper over the production layout shape. Channel: scripted.
import test from 'node:test';
import assert from 'node:assert/strict';

const {dropWorkspaceDetached} = await import('../src/workspace/store.ts');
const {freshLayout} = await import('../src/surface/types.ts');

const DEVICE = 'device:probe/face';
const OTHER_DEVICE = 'device:probe/other';
const KNOWLEDGE = 'knowledge:note';

// A layout with the given surfaces popped out (detached, never centre tabs).
const detachedLayout = (...ids) => ({
  ...freshLayout(),
  surfaces: Object.fromEntries(ids.map(id => [id, {id, kind: id.startsWith('device:') ? 'device' : 'knowledge', title: id, ref: id}])),
  detached: ids.map(id => ({surfaceId: id, groupId: 'group', index: 0, pinned: false})),
});

const workspace = (id, layout, modeLayouts) => ({id, name: id, writing: '', layout, ...(modeLayouts ? {modeLayouts} : {})});

test('a device popped out of a saved mode layout of another workspace leaves that layout with its binding', () => {
  const other = workspace('other', detachedLayout(OTHER_DEVICE), {
    tech: detachedLayout(DEVICE, KNOWLEDGE),
    base: detachedLayout(OTHER_DEVICE),
  });
  const dropped = dropWorkspaceDetached(other, DEVICE);
  assert.deepEqual(dropped.modeLayouts.tech.detached.map(entry => entry.surfaceId), [KNOWLEDGE]);
  assert.equal(dropped.modeLayouts.tech.surfaces[DEVICE], undefined);
  assert.ok(dropped.modeLayouts.tech.surfaces[KNOWLEDGE], 'the knowledge surface stays detached');
  // The other entries of the other mode layout and the current layout are intact.
  assert.deepEqual(dropped.modeLayouts.base, other.modeLayouts.base);
  assert.equal(dropped.layout, other.layout);
});

test('a device popped out of the current layout of the named workspace leaves it, and no other workspace is touched', () => {
  const current = workspace('current', detachedLayout(DEVICE));
  const named = workspace('named', detachedLayout(DEVICE, KNOWLEDGE));
  const books = [current, named];
  const applied = books.map(entry => entry.id === 'named' ? dropWorkspaceDetached(entry, DEVICE) : entry);
  assert.equal(applied[0], current, 'the other workspace keeps its own entry');
  assert.deepEqual(applied[1].layout.detached.map(entry => entry.surfaceId), [KNOWLEDGE]);
  assert.equal(applied[1].layout.surfaces[DEVICE], undefined);
  assert.equal(applied[1].layout.root, null, 'a device never returns as a centre tab');
});

test('a workspace that holds no entry for the surface is returned as the same object', () => {
  const unrelated = workspace('unrelated', detachedLayout(OTHER_DEVICE), {tech: detachedLayout(KNOWLEDGE)});
  assert.equal(dropWorkspaceDetached(unrelated, DEVICE), unrelated);
});
