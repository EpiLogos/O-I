import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeLibraryEntries,
  eligibleForScope,
  groupByProject,
  catalogueAndGallery,
  sceneStripLayout,
} from '../build/nativeLibrary.js';

const scene = (i, len = 6) => ({scene_ref: `scene-${i}`, title: 'S'.repeat(len) + i});

test('scene strip is single-line: visible count derives from the width budget, with a bounded +N', () => {
  const scenes = Array.from({length: 8}, (_, i) => scene(i));
  const layout = sceneStripLayout(scenes, 200);
  assert.ok(layout.visible.length > 0, 'at least one scene stays visible');
  assert.ok(layout.visible.length < scenes.length, 'not every scene fits in a bounded strip');
  assert.equal(layout.hiddenCount, scenes.length - layout.visible.length);
  // Widening the budget reveals more without ever losing what already fit.
  const wider = sceneStripLayout(scenes, 2000);
  assert.ok(wider.visible.length >= layout.visible.length);
  assert.equal(wider.hiddenCount, scenes.length - wider.visible.length);
});

test('a strip that fits entirely has no +N reveal', () => {
  const scenes = [scene(0, 3), scene(1, 3)];
  const layout = sceneStripLayout(scenes, 5000);
  assert.equal(layout.visible.length, 2);
  assert.equal(layout.hiddenCount, 0);
});

test('an empty scene list lays out to nothing, not a stray chip', () => {
  const layout = sceneStripLayout([], 400);
  assert.deepEqual(layout, {visible: [], hiddenCount: 0});
});

test('dedupe is by native identity (ref), never by display title', () => {
  const entries = [
    {ref: 'expression:a', title: 'Overview', owner: 'x', scope: 'local'},
    {ref: 'expression:b', title: 'Overview', owner: 'x', scope: 'local'}, // same title, different subject
    {ref: 'expression:a', title: 'Overview (renamed)', owner: 'x', scope: 'local'}, // same subject, retitled read
  ];
  const deduped = dedupeLibraryEntries(entries);
  assert.equal(deduped.length, 2);
  assert.deepEqual(deduped.map(e => e.ref).sort(), ['expression:a', 'expression:b']);
  // The first-seen reading for a given ref wins; no silent overwrite mid-list.
  assert.equal(deduped.find(e => e.ref === 'expression:a').title, 'Overview');
});

test('private/ineligible entries are excluded at the shared horizon, kept at local', () => {
  const entries = [
    {ref: 'expression:public', title: 'Public', owner: 'x', scope: 'shared'},
    {ref: 'expression:nested', title: 'Nested local subset', owner: 'x', scope: 'local'},
    {ref: 'expression:private', title: 'Private draft', owner: 'x', scope: 'local', private: true},
    {ref: 'expression:other-provider', title: 'Never local or shared', owner: 'x', scope: 'other'},
  ];
  const local = eligibleForScope(entries, 'local');
  assert.equal(local.length, 3, 'private is excluded even locally; a non-private, non-local-scoped item stays (local reads its own field wholesale)');
  assert.ok(!local.some(e => e.ref === 'expression:private'));

  const shared = eligibleForScope(entries, 'shared');
  assert.deepEqual(shared.map(e => e.ref).sort(), ['expression:nested', 'expression:public']);
  assert.ok(!shared.some(e => e.private));
});

test('catalogue and gallery are two presentations of the same deduped collection', () => {
  const entries = [
    {ref: 'expression:b', title: 'Beta', owner: 'x', scope: 'local'},
    {ref: 'expression:a', title: 'Alpha', owner: 'x', scope: 'local'},
    {ref: 'expression:a', title: 'Alpha (stale read)', owner: 'x', scope: 'local'}, // duplicate native identity
  ];
  const {catalogue, gallery} = catalogueAndGallery(entries);
  assert.equal(catalogue.length, 2);
  assert.equal(gallery.length, 2);
  assert.deepEqual(
    catalogue.map(e => e.ref).sort(),
    gallery.map(e => e.ref).sort(),
    'same subject set — a gallery-only or catalogue-only entry would be a second collection',
  );
  // Gallery is sorted for discovery; catalogue keeps read order (its own
  // project grouping does the ordering work) — the two orders may legitimately differ.
  assert.deepEqual(gallery.map(e => e.title), ['Alpha', 'Beta']);
});

test('project grouping puts unbound entries under Central rather than dropping them', () => {
  const entries = [
    {ref: 'a', title: 'A', owner: 'x', scope: 'local', project: 'Actuation'},
    {ref: 'b', title: 'B', owner: 'x', scope: 'local'},
    {ref: 'c', title: 'C', owner: 'x', scope: 'local', project: 'Actuation'},
  ];
  const groups = groupByProject(entries);
  assert.equal(groups.length, 2);
  const actuation = groups.find(g => g.project === 'Actuation');
  const central = groups.find(g => g.project === 'Central');
  assert.equal(actuation.entries.length, 2);
  assert.equal(central.entries.length, 1);
  assert.equal(central.entries[0].ref, 'b');
});
