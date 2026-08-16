import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createExploreApplication } from './explore.mjs';

const fixture = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./fixtures/explore-world-v1.json', import.meta.url)), 'utf8'));
const app = createExploreApplication(fixture);

test('stable semantic refs resolve independently of transport locators', () => {
  const agent = app.resolve('agent:parasakti');
  assert.equal(agent.ref, 'agent:parasakti');
  assert.equal(agent.kind, 'agent');
  assert.equal(agent.world_ref, 'world:human:ariadne');
  assert.equal(agent.locators[0].locator, '/@ariadne/agents/parasakti');
});

test('public fixture retains source revision and provenance without private Central material', () => {
  const serialized = JSON.stringify(fixture);
  assert.equal(serialized.includes('PRIVATE_SENTINEL'), false);
  assert.equal(serialized.includes('Control/user'), false);
  const projection = app.resolve('projection:parasakti:explore-note');
  assert.equal(projection.meta.source_revision, 'run:explore@1');
  assert.equal(projection.provenance[1].source_system, 'software-factory');
});

test('fast exact and fuzzy search reaches heterogeneous projected objects', () => {
  assert.equal(app.search('agent:parasakti')[0].ref, 'agent:parasakti');
  assert.equal(app.search('parasakti')[0].ref, 'agent:parasakti');
  assert.equal(app.search('kn nav')[0].ref, 'wiki:o-i:explore:knowledge-navigation');
  assert.equal(app.search('projection authority')[0].kind, 'wiki-node');
});

test('search -> open -> local whole stays bounded and relation typed', () => {
  const result = app.search('shared field')[0];
  const opened = app.open(result.ref, { depth: 1, budget: 4 });
  assert.equal(opened.resource.ref, 'wiki:o-i:explore:shared-field');
  assert.equal(opened.relations.focus, opened.resource.ref);
  assert.ok(opened.relations.nodes.length <= 4);
  assert.ok(opened.relations.edges.some((edge) => edge.relation === 'wiki.contains'));
});

test('local whole does not require neighbour payload expansion', () => {
  const relationView = app.localWhole('wiki:o-i:explore', { depth: 1, budget: 3 });
  assert.equal(relationView.nodes.length, 3);
  assert.equal(relationView.truncated, true);
  assert.ok(relationView.nodes.every((node) => node.schema === 'oi.explore-entry/v1'));
});

test('human and agent surfaces consume the same application read model', () => {
  const human = app.surface('browser', 'agent:parasakti', { depth: 1, budget: 5 });
  const agent = app.surface('agent-api', 'agent:parasakti', { depth: 1, budget: 5 });
  assert.deepEqual(human.read_model, agent.read_model);
  assert.notEqual(human.surface, agent.surface);
});
