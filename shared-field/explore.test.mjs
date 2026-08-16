import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createExploreApplication } from './explore.mjs';

const fixture = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./fixtures/explore-world-v1.json', import.meta.url)), 'utf8'));
const schema = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./explore-schema-v1.json', import.meta.url)), 'utf8'));
const app = createExploreApplication(fixture);

test('stable semantic refs resolve independently of transport locators', () => {
  const agent = app.resolve('agent:parasakti');
  assert.equal(agent.ref, 'agent:parasakti');
  assert.equal(agent.kind, 'agent');
  assert.equal(agent.world_ref, 'world:human:ariadne');
  assert.equal(agent.locators[0].locator, '/@ariadne/agents/parasakti');
  assert.equal(app.resolveLocator('/@ariadne/agents/parasakti', { surface: 'web' }).ref, agent.ref);
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

test('structured agent operations preserve the same resource identity and provenance', () => {
  const ref = 'projection:parasakti:explore-note';
  assert.equal(app.read(ref).ref, ref);
  assert.equal(app.relations(ref, { depth: 1, budget: 5 }).focus, ref);
  assert.equal(app.sources(ref).revision, 'projection@1');
  assert.equal(app.explain(ref).semantic_identity.ref, ref);
  assert.equal(app.explain(ref).transport_locators[0].locator, '/p/parasakti-explore-note');
});

test('human and agent surfaces consume the same application read model and serialize cleanly', () => {
  const human = app.surface('browser', 'agent:parasakti', { depth: 1, budget: 5 });
  const agent = app.surface('agent-api', 'agent:parasakti', { depth: 1, budget: 5 });
  assert.deepEqual(human.read_model, agent.read_model);
  assert.notEqual(human.surface, agent.surface);
  assert.deepEqual(JSON.parse(JSON.stringify(human)).read_model, human.read_model);
});

test('language-neutral Explore schema names the versioned cross-client contracts', () => {
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.$defs.entry.properties.schema.const, 'oi.explore-entry/v1');
  assert.equal(schema.$defs.searchResult.properties.schema.const, 'oi.explore-result/v1');
  assert.equal(schema.$defs.relationView.properties.schema.const, 'oi.explore-relation-view/v1');
  assert.ok(schema.$defs.sourceView);
  assert.ok(schema.$defs.explainView);
  assert.ok(schema.$defs.surfaceView);
});
