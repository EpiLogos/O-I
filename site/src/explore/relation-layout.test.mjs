import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRelationLayout } from './relation-layout.mjs';

const view = {
  focus: 'wiki:root',
  nodes: [
    { ref: 'wiki:root', kind: 'wiki-node', label: 'Root' },
    { ref: 'wiki:a', kind: 'wiki-node', label: 'A' },
    { ref: 'project:b', kind: 'project', label: 'B' },
    { ref: 'source:c', kind: 'source', label: 'C' },
  ],
  edges: [
    { from: 'wiki:root', to: 'wiki:a', relation: 'wiki.contains', origin: 'authored' },
    { from: 'wiki:root', to: 'project:b', relation: 'project.binds', origin: 'projection' },
    { from: 'wiki:a', to: 'source:c', relation: 'source.supports', origin: 'source' },
  ],
};

test('places the canonical focus at the centre without changing relation identity', () => {
  const layout = buildRelationLayout(view, { width: 1000, height: 600 });
  const focus = layout.nodes.find((node) => node.ref === view.focus);
  assert.equal(focus.x, 500);
  assert.equal(focus.y, 300);
  assert.equal(focus.tier, 0);
  assert.equal(layout.edges[0].relation, 'wiki.contains');
  assert.equal(layout.edges[0].origin, 'authored');
  assert.equal(layout.nodes.length, view.nodes.length);
  assert.equal(layout.edges.length, view.edges.length);
});

test('recentring is a new visual projection of the supplied relation state', () => {
  const recentered = buildRelationLayout({ ...view, focus: 'wiki:a' }, { width: 1000, height: 600 });
  const focus = recentered.nodes.find((node) => node.ref === 'wiki:a');
  const previous = recentered.nodes.find((node) => node.ref === 'wiki:root');
  assert.equal(focus.x, 500);
  assert.equal(focus.y, 300);
  assert.notEqual(previous.tier, 0);
});

test('layout is deterministic for the same bounded relation state', () => {
  assert.deepEqual(buildRelationLayout(view), buildRelationLayout(view));
});
