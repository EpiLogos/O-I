// Per-mode workspaces and the world-context layer (src/workspace/store.ts).
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/mode-workspaces.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const { switchWorkspaceMode, decodeWorldContext } = await import('../src/workspace/store.ts');

const group = (id, tabs) => ({ type: 'group', id, tabs, pinned: [], active: tabs[0] ?? null });
const workspace = () => ({
  id: 'w', name: 'W', writing: '',
  layout: { root: group('g1', ['a']), surfaces: { a: { id: 'a', kind: 'blank', title: 'A' } }, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel', rightDepth: 'collapsed', leftWidth: 260, rightWidth: 400, accompanying: { ref: 'agent-session/x', project: 'P', space: 's' }, tabPresentation: 'pinned-vertical' },
});

test('each mode owns its tree; leaving one keeps it, entering a fresh one starts empty', () => {
  const base = workspace();
  const factory = switchWorkspaceMode(base, 'factory');
  assert.equal(factory.layout.mode, 'factory');
  assert.equal(factory.layout.root, null, 'a mode with no saved tree opens empty, for its curation default to fill');
  assert.deepEqual(Object.keys(factory.layout.surfaces), [], 'base surfaces are not mounted in Factory');
  assert.equal(factory.modeLayouts.base.root.tabs[0], 'a', 'the base tree waits, intact');
  assert.equal(factory.layout.tabPresentation, undefined, 'tab pin state belongs to the mode that set it');
  assert.equal(factory.layout.rightDepth, 'panel', 'a work mode first opens with its companion');
});

test('widths, the live session and the panel planes ride through; the active mode never also waits', () => {
  const factory = switchWorkspaceMode(workspace(), 'factory');
  assert.equal(factory.layout.leftWidth, 260); assert.equal(factory.layout.rightWidth, 400);
  assert.deepEqual(factory.layout.accompanying, { ref: 'agent-session/x', project: 'P', space: 's' }, 'one canonical conversation');
  const back = switchWorkspaceMode({ ...factory, layout: { ...factory.layout, rightWidth: 480 } }, 'base');
  assert.equal(back.layout.mode, undefined, 'base is the absent mode');
  assert.equal(back.layout.root.tabs[0], 'a'); assert.equal(back.layout.tabPresentation, 'pinned-vertical');
  assert.equal(back.layout.rightWidth, 480, 'a width changed in one mode is the width everywhere');
  assert.equal(back.modeLayouts.base, undefined); assert.ok(back.modeLayouts.factory);
  assert.equal(switchWorkspaceMode(back, 'base'), back, 'entering the current mode changes nothing');
});

test('Epi-Logos is whole-app world state, not a tree mode (owner refinement 2026-09-19)', () => {
  // The owner moved Epi-Logos out of TREE_MODES (mode.ts): the world is the
  // workspace world context (context.world) riding across every mode, never a
  // per-mode tree — so the mode switch refuses it and changes nothing.
  const before = workspace();
  assert.equal(switchWorkspaceMode(before, 'epi-logos'), before, 'Epi-Logos is no mode entry');
});

test('world context decodes leniently: refs and positions only, bounded, never guessed', () => {
  assert.equal(decodeWorldContext(null), undefined);
  assert.equal(decodeWorldContext({ world: 'somewhere' }), undefined, 'an unknown world is dropped');
  const c = decodeWorldContext({ world: 'epi-logos', subject: { title: 'Passage', ref: 'r' }, reading: { ref: 'r', position: '#p3' }, trail: [{ mode: 'epi-logos', label: 'Essay' }, { mode: 'nowhere', label: 'x' }, { mode: 'techne' }] });
  assert.equal(c.world, 'epi-logos'); assert.equal(c.reading.position, '#p3');
  assert.equal(c.trail.length, 1, 'stops without a real mode and a label are dropped');
  assert.equal(decodeWorldContext({ trail: Array.from({ length: 40 }, () => ({ mode: 'base', label: 'x' })) }).trail.length, 24);
});

test('the world context is the one owner: a legacy arrangement-world flag is dropped, never resurrected', async () => {
  // The arrangement once carried a persisted LayoutState.epiLogos copy of
  // `context.world` (written in tandem, never reconciled — a restore with a
  // stale flag could disagree with the world actually in force). The copy is
  // retired: a payload carrying it decodes without it, and the world context
  // alone decides which world is in force.
  const { decodeLayout } = await import('../src/surface/persist.ts');
  const decoded = decodeLayout({ epiLogos: true, mode: 'factory' });
  assert.equal('epiLogos' in decoded, false, 'the arrangement carries no world copy');
  assert.equal(decoded.mode, 'factory', 'the rest of the legacy payload still decodes');
  assert.equal(decodeWorldContext({ world: 'epi-logos' })?.world, 'epi-logos', 'the world context remains the owner');
});
