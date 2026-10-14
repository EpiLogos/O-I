// FOUNDATION F8, the book side: the widget rail is one open set for the whole world (manual §10.6: "Open a terminal in
// Factory and it is still there in Central"), each widget's pin, presets, the rail's width — beside the per-mode trees,
// surviving every mode switch.
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/widget-rail.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const {toggleWidget, pinWidget, saveWidgetPreset, applyWidgetPreset, setWidgetRailWidth, switchWorkspaceMode} = await import('../src/workspace/store.ts');

const group = (id, tabs) => ({type: 'group', id, tabs, pinned: [], active: tabs[0] ?? null});
const fresh = () => ({id: 'w', name: 'World', writing: '',
  layout: {root: group('g1', ['a']), surfaces: {a: {id: 'a', kind: 'blank', title: 'A'}}, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel', rightDepth: 'collapsed', leftWidth: 260, rightWidth: 400}});

test('a widget opened in one mode is open in every mode', () => {
  let w = switchWorkspaceMode(fresh(), 'factory');
  w = toggleWidget(w, 'terminal', ['agent', 'trail']);
  assert.deepEqual(w.widgets.open, ['agent', 'trail', 'terminal'], 'the defaults stand under the first toggle');
  w = switchWorkspaceMode(w, 'base');
  assert.deepEqual(w.widgets.open, ['agent', 'trail', 'terminal'], 'still open in Central');
  w = toggleWidget(w, 'trail');
  assert.deepEqual(w.widgets.open, ['agent', 'terminal'], 'closing keeps it in the launcher, out of the open set');
});

test('a pin holds the ref the widget stopped following at; closing a widget drops its pin', () => {
  let w = toggleWidget(fresh(), 'packet');
  w = pinWidget(w, 'packet', 'Control/agents/now/day/2026-10-14.md');
  assert.equal(w.widgets.pinned.packet, 'Control/agents/now/day/2026-10-14.md');
  w = pinWidget(w, 'packet', null);
  assert.equal(w.widgets.pinned.packet, undefined, 'unpinned, it follows again');
  w = toggleWidget(pinWidget(w, 'packet', 'x'), 'packet');
  assert.equal(w.widgets.pinned.packet, undefined);
});

test('a preset keeps the open widgets under a name and opens exactly them again; the width is bounded', () => {
  let w = toggleWidget(toggleWidget(fresh(), 'terminal'), 'files');
  w = saveWidgetPreset(w, 'Coding', 'p1', 1);
  w = toggleWidget(toggleWidget(w, 'terminal'), 'sky');
  assert.deepEqual(applyWidgetPreset(w, 'p1').widgets.open, ['terminal', 'files']);
  assert.equal(setWidgetRailWidth(w, 5000).widgets.width, 900);
  assert.equal(setWidgetRailWidth(w, 10).widgets.width, 260);
});
