import test from 'node:test';
import assert from 'node:assert/strict';
import { validBinding, validPane } from '../src/surface/layout-codec.mjs';

// The workspace/state-continuity lane (O:I #18/#65; SHARED-FIELD-STATE-DISCOVERY
// §2.2, SF1; SHARED-FIELD-DESKTOP §12): what the autosaved Workspace may
// restore, per binding kind — stable refs and compact view state, degraded
// honestly, never guessed.

const knowledgePage = () => ({
  id: 'ws:kg-page', kind: 'knowledge', title: 'Editor wiki', project: 'Editor',
  ref: 'wiki:node:editor', address: { kind: 'wiki', value: 'wiki:node:editor' },
  view: { knowledgePlane: 'page', graphOrigin: 'ws:kg-graph' },
});
const sourceTab = () => ({ id: 'ws:src', kind: 'source', title: '01 DESIGN.md', project: 'Editor', ref: 'central:source:project:editor-walk:00' });

test('a knowledge page restores as a page, still bound to the graph it was opened from', () => {
  const restored = validBinding(JSON.parse(JSON.stringify(knowledgePage())));
  assert.ok(restored, 'the page binding survives the codec');
  assert.equal(restored.view.knowledgePlane, 'page', 'kill/relaunch must not demote a page to a graph');
  assert.equal(restored.view.graphOrigin, 'ws:kg-graph', 'the return-to-graph origin survives restore');
  assert.equal(restored.address.value, 'wiki:node:editor');
  assert.equal(restored.project, 'Editor');
});

test('view state is kind-scoped and typed: foreign planes and origins drop, valid ones keep', () => {
  const wrongKind = validBinding({ ...sourceTab(), view: { knowledgePlane: 'page', graphOrigin: 'ws:kg-graph' } });
  assert.equal(wrongKind.view, undefined, 'a source tab carries no knowledge view');

  const badPlane = validBinding({ ...knowledgePage(), view: { knowledgePlane: 'constellation', graphOrigin: 'ws:kg-graph' } });
  assert.equal(badPlane.view, undefined, 'an unknown knowledge plane is not guessed into a plane');

  const badOrigin = validBinding({ ...knowledgePage(), view: { knowledgePlane: 'page', graphOrigin: '   ' } });
  assert.equal(badOrigin.view.knowledgePlane, 'page', 'the plane survives an unusable origin');
  assert.equal(badOrigin.view.graphOrigin, undefined, 'a blank origin is dropped, not carried');

  const encounter = validBinding({
    id: 'ws:enc', kind: 'encounter', title: 'Session', project: 'Editor',
    ref: 'agent-session/lesson', encounter: { space: 'editor-walk' },
    view: { encounterPlane: 'Activity', knowledgePlane: 'graph' },
  });
  assert.deepEqual(encounter.view, { encounterPlane: 'Activity' }, 'an encounter keeps only its own plane');

  const plainGraph = validBinding({ id: 'ws:kg-graph', kind: 'knowledge', title: 'Editor wiki', project: 'Editor', ref: 'wiki:space:editor', address: { kind: 'wiki', value: 'wiki:space:editor' } });
  assert.equal(plainGraph.view, undefined, 'a graph opened at rest carries no view state to restore');
});

test('the rest of the constellation round-trips by ref: presentation, terminal, flow, draft', () => {
  const presentation = validBinding({
    id: 'ws:pres', kind: 'presentation', title: 'A field of glyphs', ref: 'expression:e',
    presentation: { world_ref: 'world:desktop:expression-e', field_ref: 'oi:field:desktop:expression-e', projection_ref: 'projection:1', projection_revision: 2, presentation_ref: 'presentation:1', presentation_revision: 3, expression_ref: 'expression:e', expression_revision: 9 },
  });
  assert.deepEqual(presentation.presentation, { world_ref: 'world:desktop:expression-e', field_ref: 'oi:field:desktop:expression-e', projection_ref: 'projection:1', projection_revision: 2, presentation_ref: 'presentation:1', presentation_revision: 3, expression_ref: 'expression:e', expression_revision: 9 }, 'the exact World/Projection/Presentation/Expression refs restore');

  const presentationBad = validBinding({ id: 'ws:pres2', kind: 'presentation', title: 'x', ref: 'expression:e', presentation: { projection_ref: 'projection:1' } });
  assert.equal(presentationBad, null, 'a pinned subject without its world ref discloses nothing');

  const flow = validBinding({ id: 'ws:flow', kind: 'flow', title: 'flow-1.md', ref: 'central:path:Work/x', location: { schema: 'central.path-ref/v1', ref: 'central:path:Work/x', root: '/r', path: 'Work/x' }, flow: { flowRef: 'flow-1', path: 'Work/x' } });
  assert.equal(flow.flow.flowRef, 'flow-1');
  assert.equal(validBinding({ id: 'ws:bad', kind: 'flow', title: 'x', ref: 'other:ref', location: { schema: 'central.path-ref/v1', ref: 'other:ref', root: '/r', path: 'p' }, flow: { flowRef: 'f', path: 'p' } }), null, 'a flow ref outside the path grammar is refused');

  const draft = validBinding({ id: 'ws:draft', kind: 'draft', title: 'Draft' });
  assert.equal(draft.kind, 'draft', 'unplaced writing survives a relaunch — dropping it would orphan the words');

  const terminal = validBinding({ id: 'ws:term', kind: 'terminal', title: 'Terminal', terminal: { cwd: '/tmp' } });
  assert.equal(terminal.terminal.cwd, '/tmp');
  const browser = validBinding({ id: 'ws:br', kind: 'browser', title: 'Browser', browser: { url: 'https://example.test' } });
  assert.equal(browser.browser.url, 'https://example.test');
});

test('a pane tree restores: groups, splits, weights; unknown tabs refuse the group; lone split children normalise', () => {
  const surfaces = Object.fromEntries([sourceTab(), knowledgePage(), { id: 'ws:pres', kind: 'presentation', title: 'P', ref: 'expression:e', presentation: { world_ref: 'w' } }].map((b) => [b.id, b]));
  const tree = {
    type: 'split', id: 'split-1', dir: 'h', weights: [0.6, 0.4],
    children: [
      { type: 'group', id: 'g1', tabs: ['ws:src', 'ws:kg-page'], pinned: ['ws:src'], active: 'ws:kg-page' },
      { type: 'split', id: 'split-2', dir: 'v', children: [{ type: 'group', id: 'g2', tabs: ['ws:pres'], pinned: [], active: 'ws:pres' }] },
    ],
  };
  const restored = validPane(tree, surfaces);
  assert.equal(restored.type, 'split');
  assert.deepEqual(restored.weights, [0.6, 0.4]);
  assert.deepEqual(restored.children[0].tabs, ['ws:src', 'ws:kg-page']);
  assert.equal(restored.children[0].active, 'ws:kg-page');
  assert.equal(restored.children[1].type, 'group', 'a split with one live child normalises to the group');

  const ghosted = validPane({ type: 'group', id: 'g3', tabs: ['ws:src', 'ws:ghost'], pinned: [], active: 'ws:ghost' }, surfaces);
  assert.equal(ghosted, null, 'a group naming an unknown surface is not partially guessed');

  const badWeights = validPane({ type: 'split', id: 's', dir: 'h', weights: [0.6], children: [ { type: 'group', id: 'a', tabs: ['ws:src'], pinned: [], active: 'ws:src' }, { type: 'group', id: 'b', tabs: ['ws:pres'], pinned: [], active: 'ws:pres' } ] }, surfaces);
  assert.equal(badWeights.weights, undefined, 'weights that do not match the children are dropped, not clamped into being');
});

test('every kind the Workbench mounts round-trips, so an open tab never sends the book to recovery', () => {
  // Regression: `factory` was mounted but not restorable — a saved workspace
  // with the Factory development tab open dropped the binding on decode and
  // the store refused the whole book ("Some saved surface bindings could not
  // be restored"). The mode centre surfaces join under the same law.
  for (const [kind, title] of [['factory', 'Factory development'], ['expressions', 'Expressions'], ['techne', 'Technè'], ['system', 'System'], ['explore', 'Explore']]) {
    const restored = validBinding({ id: `ws:${kind}`, kind, title });
    assert.ok(restored, `${kind} binding restores`);
    assert.equal(restored.kind, kind);
    const pane = validPane({ type: 'group', id: 'g', tabs: [`ws:${kind}`], pinned: [], active: `ws:${kind}` }, { [`ws:${kind}`]: restored });
    assert.equal(pane.active, `ws:${kind}`, `${kind} stays the active tab of its pane`);
  }
});

test('a pane restores its own tab pin state; unknown names are dropped', () => {
  const surfaces = { a: validBinding({ id: 'a', kind: 'system', title: 'System' }) };
  const pane = validPane({ type: 'group', id: 'g', tabs: ['a'], pinned: [], active: 'a', tabPresentation: 'unpinned', tabPinOrientation: 'vertical' }, surfaces);
  assert.equal(pane.tabPresentation, 'unpinned'); assert.equal(pane.tabPinOrientation, 'vertical');
  const odd = validPane({ type: 'group', id: 'g', tabs: ['a'], pinned: [], active: 'a', tabPresentation: 'sideways', tabPinOrientation: 'diagonal' }, surfaces);
  assert.equal(odd.tabPresentation, undefined); assert.equal(odd.tabPinOrientation, undefined);
});

test('unowned kinds and malformed records refuse honestly', () => {
  assert.equal(validBinding(null), null);
  assert.equal(validBinding({ id: 'x' }), null, 'no id/kind/title, no binding');
  assert.equal(validBinding({ id: 'x', kind: 'shared-field-store', title: 'A second model' }), null, 'no new surface kind enters through persisted state');
  const missingAddress = validBinding({ id: 'ws:kg2', kind: 'knowledge', title: 'W', project: 'Editor', ref: 'wiki:node:editor' });
  assert.equal(missingAddress, null, 'a knowledge binding without its owner address cannot be restored by ref');
});
