import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WORKBENCH_LAYOUT_STORAGE_KEY,
  WORKBENCH_LAYOUT_VERSION,
  bindSubject,
  closeBinding,
  dismissRegion,
  isAtRest,
  moveBindingToSplit,
  parseLayout,
  promoteBinding,
  restLayout,
  returnBinding,
  returnToRest,
  serializeLayout,
  splitBinding,
  summonRegion,
  summonSurface,
  toggleRegion,
} from './workbench-layout.mjs';

const REST = 'surface/oi/world-tree';
const SUBJECT = 'surface/oi/world-subject';
const subject = { ref: 'world:project:one', kind: 'project', native_owner: 'central', provenance: { source: 'oi.world-tree/v1' } };

test('rest is the product: agency field + canvas, every other region absent', () => {
  const rest = restLayout(REST);
  assert.equal(rest.version, WORKBENCH_LAYOUT_VERSION);
  assert.equal(rest.regions.navigator.present, false, 'navigator is absent at rest');
  assert.equal(rest.regions.sidecar.present, true, 'the agency field is present at rest');
  assert.equal(rest.regions.system.present, false, 'system is absent at rest');
  assert.equal(rest.regions.lower.present, false, 'the lower region is absent at rest');
  assert.deepEqual(rest.summoned, [], 'nothing is summoned at rest');
  assert.equal(rest.groups.length, 1, 'one canvas group at rest');
  assert.equal(rest.groups[0].tabs.length, 1);
  assert.equal(rest.groups[0].tabs[0].surfaceRef, REST, 'the World tree is the resting canvas surface');
  assert.equal(rest.groups[0].tabs[0].pinned, true, 'the resting surface is pinned');
  assert.equal(isAtRest(rest, REST), true);
});

test('a summoned region dismisses back to rest without residue', () => {
  const summoned = summonRegion(restLayout(REST), 'navigator');
  assert.equal(summoned.regions.navigator.present, true);
  assert.equal(isAtRest(summoned, REST), false);

  // a summoned surface binding lives and dies with its region
  const withSurface = summonSurface(summoned, SUBJECT, 'navigator');
  assert.equal(withSurface.summoned.length, 1);
  const dismissed = dismissRegion(withSurface, 'navigator');
  assert.equal(dismissed.regions.navigator.present, false);
  assert.deepEqual(dismissed.summoned, [], 'dismissing a region takes its summoned bindings with it');
  assert.equal(isAtRest(dismissed, REST), true, 'no residue: the layout is rest again');
});

test('summoning the same surface into the same region never mints a second binding', () => {
  let layout = summonSurface(restLayout(REST), SUBJECT, 'lower');
  const first = layout.summoned[0];
  layout = summonSurface(layout, SUBJECT, 'lower');
  assert.equal(layout.summoned.length, 1, 'one binding per surface per region');
  assert.equal(layout.summoned[0].bindingId, first.bindingId, 'the existing binding identity is reused');
});

test('promotion moves the binding to the centre without minting identity (03 §B B3)', () => {
  let layout = summonSurface(restLayout(REST), SUBJECT, 'navigator');
  const binding = layout.summoned[0];
  // the subject a surface is showing is carried through every move
  layout = bindSubject(layout, binding.bindingId, subject.ref);
  const promoted = promoteBinding(layout, binding.bindingId);

  const moved = promoted.groups.flatMap((group) => group.tabs).find((tab) => tab.bindingId === binding.bindingId);
  assert.ok(moved, 'the same binding appears in the canvas group');
  assert.equal(moved.surfaceRef, SUBJECT, 'same surfaceRef');
  assert.equal(moved.subjectRef, subject.ref, 'same subjectRef — promotion never mints identity');
  assert.equal(moved.region, 'canvas');
  assert.equal(moved.homeRegion, 'navigator', 'the region it was summoned from is remembered');
  assert.deepEqual(promoted.summoned, [], 'it left the summoned region');
  assert.equal(isAtRest(promoted, REST), false);
});

test('return moves a promoted binding back to its summoned region (03 §B B5)', () => {
  let layout = summonSurface(restLayout(REST), SUBJECT, 'system');
  const binding = layout.summoned[0];
  layout = bindSubject(layout, binding.bindingId, subject.ref);
  layout = promoteBinding(layout, binding.bindingId);
  const returned = returnBinding(layout, binding.bindingId);
  assert.equal(returned.summoned.length, 1);
  assert.equal(returned.summoned[0].bindingId, binding.bindingId, 'same binding');
  assert.equal(returned.summoned[0].subjectRef, subject.ref, 'same subjectRef');
  assert.equal(returned.summoned[0].region, 'system', 'back to the region it was summoned from');
  assert.equal(returned.regions.system.present, true, 'the home region is present again');
});

test('splitting carries the identical SubjectRef into the second group (03 §B B2)', () => {
  const rest = restLayout(REST);
  const opened = { ...rest };
  opened.groups = [{ ...opened.groups[0], tabs: [{ ...opened.groups[0].tabs[0], subjectRef: subject.ref, pinned: false }] }];
  const split = splitBinding(opened, 'horizontal');
  assert.equal(split.split, 'horizontal');
  assert.equal(split.groups.length, 2);
  const second = split.groups[1];
  assert.equal(second.tabs[0].surfaceRef, REST);
  assert.equal(second.tabs[0].subjectRef, subject.ref, 'the subjectRef is carried untouched');
  const moved = moveBindingToSplit(split, 'vertical');
  assert.equal(moved.split, 'vertical');
  assert.ok(moved.groups[1].tabs.some((tab) => tab.subjectRef === subject.ref));
});

test('escape to rest: summoned regions close, non-pinned canvas tabs drop, the tree remains', () => {
  let layout = summonSurface(summonRegion(restLayout(REST), 'lower'), SUBJECT, 'lower');
  layout = promoteBinding(layout, layout.summoned[0].bindingId);
  assert.equal(isAtRest(layout, REST), false);
  const rest = returnToRest(layout, REST);
  assert.equal(isAtRest(rest, REST), true);
  assert.deepEqual(rest.summoned, []);
  assert.ok(rest.regions.lower.present === false);
  assert.ok(rest.groups.every((group) => group.tabs.every((tab) => tab.surfaceRef === REST)), 'only the resting surface remains');
  assert.equal(rest.groups[0].tabs[0].pinned, true);
});

test('closing a summoned surface dismisses its region once nothing is left in it', () => {
  let layout = summonSurface(restLayout(REST), SUBJECT, 'system');
  const binding = layout.summoned[0];
  layout = closeBinding(layout, binding.bindingId);
  assert.deepEqual(layout.summoned, []);
  assert.equal(layout.regions.system.present, false, 'the empty summoned region does not linger');
});

test('persistence is professional and restorable — and never persists semantic selection (02 §6 rule 3)', () => {
  let layout = summonSurface(summonRegion(restLayout(REST), 'navigator'), SUBJECT, 'navigator');
  layout = bindSubject(layout, layout.summoned[0].bindingId, subject.ref);
  const summonedId = layout.summoned[0].bindingId;
  layout = promoteBinding(layout, summonedId);
  layout = bindSubject(layout, layout.groups[0].tabs[0].bindingId, subject.ref);

  const stored = JSON.parse(serializeLayout(layout));
  assert.equal(stored.version, WORKBENCH_LAYOUT_VERSION);
  const everyTab = [
    ...stored.groups.flatMap((group) => group.tabs),
    ...stored.summoned,
    ...stored.closed,
  ];
  assert.equal(everyTab.length > 0, true);
  for (const tab of everyTab) {
    assert.equal('subjectRef' in tab, false, `no binding persists a subjectRef (saw ${JSON.stringify(tab)})`);
  }

  const restored = parseLayout(serializeLayout(layout), REST);
  assert.equal(restored.split, layout.split);
  assert.equal(restored.regions.navigator.present, true, 'the summoned region is restored');
  assert.ok(restored.groups[0].tabs.some((tab) => tab.surfaceRef === SUBJECT), 'the open surfaces are restored');
  assert.ok(restored.groups.every((group) => group.tabs.every((tab) => tab.subjectRef === undefined)), 'a restored binding shows no subject: the kernel owns focus');
});

test('a layout that is not the current version restores as rest, fail-closed', () => {
  const stale = JSON.stringify({ version: 1, regions: {}, groups: [], summoned: [] });
  assert.equal(isAtRest(parseLayout(stale, REST), REST), true);
  assert.equal(isAtRest(parseLayout('not json at all', REST), REST), true);
  assert.equal(isAtRest(parseLayout(null, REST), REST), true);
  assert.equal(isAtRest(parseLayout('{}', REST), REST), true);
  // a same-version layout that still smuggles a subjectRef is stripped on restore
  const smuggled = JSON.stringify({
    version: WORKBENCH_LAYOUT_VERSION,
    regions: restLayout(REST).regions,
    split: 'single',
    groups: [{ groupId: 'group-1', tabs: [{ bindingId: 'b1', surfaceRef: SUBJECT, subjectRef: subject.ref, region: 'canvas', pinned: false }], activeBindingId: 'b1' }],
    summoned: [],
  });
  const restored = parseLayout(smuggled, REST);
  assert.ok(restored.groups[0].tabs.every((tab) => tab.subjectRef === undefined), 'selection never survives persistence');
});

test('the storage key names the versioned shape the module writes', () => {
  const host = readFileSync(new URL('./workbench-host.tsx', import.meta.url), 'utf8');
  assert.equal(WORKBENCH_LAYOUT_STORAGE_KEY, 'oi.desktop.workbench-layout/v2');
  assert.match(host, /WORKBENCH_LAYOUT_STORAGE_KEY/, 'the host persists through the module key, not a private literal');
});

test('keyboard and pointer parity is structural: both paths call the same reducers', () => {
  const host = readFileSync(new URL('./workbench-host.tsx', import.meta.url), 'utf8');
  // summon/dismiss: Cmd+B / Cmd+J / Cmd+/ / Cmd+. and the summon strip buttons
  assert.match(host, /toggleRegion\(current, region\)/, 'the keyboard path toggles through the reducer');
  assert.match(host, /onClick=\{\(\) => setLayout\(\(current\) => toggleRegion\(current, target\.region\)\)\}/, 'the pointer path toggles through the same reducer');
  // promote / return / dismiss
  assert.match(host, /function promoteFocused\(\)/);
  assert.match(host, /onClick=\{promoteFocused\}/, 'promote is the same act from the strip and from Cmd+Enter');
  assert.match(host, /onClick=\{dismissFocused\}/);
  assert.match(host, /function dismissFocused\(\)/);
  // rest: Escape and the strip's Rest button
  assert.match(host, /onClick=\{rest\}/);
  assert.match(host, /returnToRest\(current, restSurfaceRef\)/);
});
