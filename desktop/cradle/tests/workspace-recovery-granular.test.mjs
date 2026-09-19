// Granular workspace recovery (workspace continuity WF1; matrix rows C18–C20):
// progressive layout decode below the whole-workspace quarantine, the
// last-known-good publication journal, the acknowledged-draft crash bound,
// and the recovery-record retention bound.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/workspace-recovery-granular.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// Map-backed localStorage FIRST, before any module import: these modules are
// storage-bound and must all see the same store for the whole run.
const backing = new Map();
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => { backing.set(k, String(v)); },
  removeItem: (k) => { backing.delete(k); },
  key: (i) => [...backing.keys()][i] ?? null,
  get length() { return backing.size; },
};

const { decodeLayoutProgressive, stageCheckpoint, commitCheckpoint, lastKnownGood } = await import('../src/workspace/checkpoints.ts');
const { writeDraft, readDraft, writeDraftIntent, acknowledgeDraft, readDurableDraft, clearSavedDraft } = await import('../src/workspace/drafts.ts');
const { preservePresentation, latestRecovery, listRecovery } = await import('../src/workspace/recovery.ts');

const systemTab = (id) => ({ id, kind: 'system', title: `System ${id}` });
const BOOK_KEY = 'oi-cradle.workspaces.v1';

test('C19: one malformed surface binding drops alone; its pane and siblings survive', () => {
  const raw = {
    root: { type: 'split', id: 's1', dir: 'h', weights: [0.5, 0.5], children: [
      { type: 'group', id: 'g1', tabs: ['a', 'ghost'], pinned: ['a'], active: 'a' },
      { type: 'group', id: 'g2', tabs: ['b'], pinned: [], active: 'b' },
    ] },
    surfaces: { a: systemTab('a'), b: systemTab('b'), ghost: { id: 'ghost', kind: 'shared-field-store', title: 'A second model' } },
    closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel',
  };
  const result = decodeLayoutProgressive(raw, 'ws1');
  assert.ok(result.layout, 'valid siblings decode to a real layout');
  assert.deepEqual(Object.keys(result.layout.surfaces).sort(), ['a', 'b']);
  assert.deepEqual(result.droppedBindingIds, ['ghost']);
  assert.ok(result.notes.some((n) => n.includes('"ghost"') && n.includes('could not be restored')), 'the drop is named');
  assert.equal(result.layout.root.type, 'split', 'the tree itself survives');
  assert.deepEqual(result.layout.root.children[0].tabs, ['a'], 'the valid sibling tab keeps its pane');
  assert.equal(result.layout.root.children[0].active, 'a');
  assert.deepEqual(result.layout.root.children[1].tabs, ['b'], 'the untouched group survives');
  assert.equal(raw.surfaces.ghost.kind, 'shared-field-store', 'the raw record is never mutated');
  // The sanitized record re-decodes clean: the store's strict law (decoded
  // surfaces count === raw count, root preserved) holds without a loss.
  const reread = decodeLayoutProgressive(result.sanitized, 'ws1');
  assert.deepEqual(reread.droppedBindingIds, []);
  assert.deepEqual(Object.keys(reread.layout.surfaces).sort(), ['a', 'b']);
});

test('C19: an unrepairable pane tree falls back to one group holding the valid bindings', () => {
  const raw = { root: { type: 'group', id: 'g1', tabs: 'a' }, surfaces: { a: systemTab('a'), b: systemTab('b') }, closedStack: [], focusedGroupId: null, agencyDepth: 'panel' };
  const result = decodeLayoutProgressive(raw, 'ws1');
  assert.ok(result.layout, 'valid material is presented, never silently emptied');
  assert.equal(result.layout.root.type, 'group');
  assert.deepEqual([...result.layout.root.tabs].sort(), ['a', 'b']);
  assert.equal(result.layout.root.active, 'a');
  assert.ok(result.notes.some((n) => n.includes('pane arrangement could not be restored')), 'the fallback says what happened');
  assert.deepEqual(result.droppedBindingIds, [], 'the bindings were valid; only the tree failed');
});

test('C19: a tree whose groups all emptied yields the fallback; pruning is surgical when one group lives', () => {
  const allDead = { root: { type: 'split', id: 's', dir: 'v', children: [
    { type: 'group', id: 'g1', tabs: ['ghost'], pinned: [], active: null },
    { type: 'group', id: 'g2', tabs: ['phantom'], pinned: [], active: null },
  ] }, surfaces: { a: systemTab('a') }, closedStack: [], focusedGroupId: null, agencyDepth: 'panel' };
  const fallen = decodeLayoutProgressive(allDead, 'ws1');
  assert.ok(fallen.layout, 'the valid binding is reopened, not hidden');
  assert.deepEqual(fallen.layout.root.tabs, ['a']);

  const oneLives = { ...allDead, root: { type: 'split', id: 's', dir: 'h', children: [
    { type: 'group', id: 'g1', tabs: ['a', 'ghost'], pinned: [], active: 'a' },
    { type: 'group', id: 'g2', tabs: ['ghost'], pinned: [], active: null },
  ] } };
  const surgical = decodeLayoutProgressive(oneLives, 'ws1');
  assert.equal(surgical.layout.root.id, 'g1', 'the surviving group stands (lone child normalises)');
  assert.deepEqual(surgical.layout.root.tabs, ['a']);
  assert.ok(surgical.notes.some((n) => n.includes('1 saved pane group held no restorable surface')), 'the dead group is named');
  assert.ok(!surgical.notes.some((n) => n.includes('arrangement could not be restored')), 'no fallback note when a group survived');
});

test('a pristine empty workspace and an intentional empty slot restore without quarantine notes', () => {
  const pristine = decodeLayoutProgressive({ surfaces: {}, root: null, closedStack: [] }, 'ws1');
  assert.ok(pristine.layout, 'empty is not damaged');
  assert.deepEqual(pristine.notes, []);
  assert.deepEqual(pristine.droppedBindingIds, []);
  const slot = decodeLayoutProgressive({ root: { type: 'group', id: 'g0', tabs: [], pinned: [], active: null, emptySlot: true }, surfaces: {}, closedStack: [], focusedGroupId: 'g0', agencyDepth: 'strip' }, 'ws1');
  assert.ok(slot.layout);
  assert.equal(slot.layout.root.emptySlot, true);
  assert.deepEqual(slot.notes, []);
});

test('C19: a record whose every binding is malformed returns null — the caller quarantines', () => {
  const raw = { root: { type: 'group', id: 'g1', tabs: ['ghost'], pinned: [], active: null }, surfaces: { ghost: { id: 'ghost', kind: 'nonsense', title: 'x' } }, closedStack: [] };
  const result = decodeLayoutProgressive(raw, 'ws1');
  assert.equal(result.layout, null);
  assert.deepEqual(result.droppedBindingIds, ['ghost']);
});

test('C20: stage→crash without commit leaves the previous slot as last-known-good', () => {
  assert.equal(lastKnownGood(BOOK_KEY), null, 'nothing published yet');
  commitCheckpoint(BOOK_KEY); // commit with nothing staged: honest no-op
  assert.equal(lastKnownGood(BOOK_KEY), null);
  stageCheckpoint(BOOK_KEY, '{"version":2,"active":"w1"}');
  commitCheckpoint(BOOK_KEY);
  assert.equal(lastKnownGood(BOOK_KEY), '{"version":2,"active":"w1"}');
  // The next publication is interrupted: candidate staged (bytes safe), the
  // live write lands truncated, the commit never happens.
  stageCheckpoint(BOOK_KEY, '{"version":2,"active":"w2"');
  localStorage.setItem(BOOK_KEY, '{"version":2,"act');
  assert.equal(lastKnownGood(BOOK_KEY), '{"version":2,"active":"w1"}', 'the journal never reads the live key');
  // Recovery publishes again and the new good copy becomes the previous slot.
  stageCheckpoint(BOOK_KEY, '{"version":2,"active":"w1","workspaces":[]}');
  commitCheckpoint(BOOK_KEY);
  assert.equal(lastKnownGood(BOOK_KEY), '{"version":2,"active":"w1","workspaces":[]}');
});

test('C18: an intent draft reads as unacknowledged until it is acknowledged', () => {
  const draft = { content: 'held words', base_revision: 'rev-1', saved_content: 'canon' };
  writeDraftIntent('ref-a', draft);
  let durable = readDurableDraft('ref-a');
  assert.equal(durable.acknowledged, false, 'an intent is not a vouch');
  assert.equal(durable.draft.content, 'held words');
  acknowledgeDraft('ref-a', draft);
  durable = readDurableDraft('ref-a');
  assert.equal(durable.acknowledged, true);
  assert.deepEqual(durable.draft, draft);
});

test('C18: the ordinary write stays acknowledged-by-write; clear removes both layers', () => {
  const draft = { content: 'x', base_revision: 'r', saved_content: 's' };
  writeDraft('ref-b', draft);
  assert.equal(readDurableDraft('ref-b').acknowledged, true, 'writeDraft keeps today\'s acknowledged-by-write semantics');
  assert.deepEqual(readDraft('ref-b'), draft);
  writeDraftIntent('ref-c', draft);
  const plain = readDraft('ref-c');
  assert.equal(plain.content, 'x', 'readDraft stays the plain reader over an intent record');
  assert.equal(plain.base_revision, 'r');
  assert.equal(plain.saved_content, 's');
  assert.equal(plain.acknowledged, false, 'the durability field rides the record');
  writeDraft('ref-c', plain); // the ordinary round-trip
  assert.equal(readDurableDraft('ref-c').acknowledged, false, 'an ordinary round-trip preserves the standing');
  clearSavedDraft('ref-c', 'x');
  assert.equal(readDurableDraft('ref-c'), null, 'one record: clearing removes intent and acknowledged together');
  clearSavedDraft('ref-b', 'other');
  assert.equal(readDurableDraft('ref-b').draft.content, 'x', 'the content guard still protects the draft');
  clearSavedDraft('ref-b', 'x');
  assert.equal(readDurableDraft('ref-b'), null);
});

test('recovery retention keeps the newest five, newest first, and dedup still holds', () => {
  for (let i = 0; i < 7; i++) {
    localStorage.setItem('some-source-key', `bytes-${i}`);
    preservePresentation('some-source-key', `failure ${i}`);
  }
  const list = listRecovery();
  assert.equal(list.length, 5, 'the bound holds');
  assert.equal(list[0].reason, 'failure 6', 'newest first');
  assert.equal(list[4].reason, 'failure 2', 'the oldest two were pruned');
  assert.equal(latestRecovery().reason, 'failure 6');
  let recordKeys = 0;
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('oi-cradle.recovery.')) recordKeys++; }
  assert.equal(recordKeys, 6, 'five records plus the pointer — nothing lingers');
  const again = preservePresentation('some-source-key', 'failure 6');
  assert.equal(again.key, list[0].key, 'same source bytes dedup to the same record');
  assert.equal(listRecovery().length, 5, 'a dedup hit retains nothing new');
});
