import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createExploreSurfaceModel, EXPLORE_SURFACE_SEED_SCHEMA } from './explore-surface.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/explore-world-v1.json', import.meta.url), 'utf8'));
const seed = {
  schema: EXPLORE_SURFACE_SEED_SCHEMA,
  entries: fixture.entries,
  relations: fixture.relations,
  presentations: [],
  presentation_projections: [],
};

test('shared Surface model preserves search leaf to bounded local whole', () => {
  const model = createExploreSurfaceModel(seed);
  const [result] = model.search('knowledge navigation');
  assert.equal(result.ref, 'wiki:o-i:explore:knowledge-navigation');
  const opened = model.open(result.ref, { depth: 1, budget: 12 });
  assert.equal(opened.resource.ref, result.ref);
  assert.equal(opened.relations.focus, result.ref);
  assert.ok(opened.relations.nodes.some((node) => node.ref === 'wiki:o-i:explore'));
  assert.ok(opened.relations.edges.some((edge) => edge.relation === 'wiki.contains'));
});

test('Surface consumers receive the same stable world and provenance-bearing relation state', () => {
  const model = createExploreSurfaceModel(seed);
  const worlds = model.worlds();
  assert.equal(worlds.length, 1);
  assert.equal(worlds[0].ref, 'world:human:ariadne');
  const opened = model.open(worlds[0].ref, { depth: 1, budget: 18 });
  assert.equal(opened.world.ref, worlds[0].ref);
  assert.ok(opened.relations.edges.every((edge) => edge.origin && edge.provenance?.length));
});

test('Surface composition rejects an unsupported transport payload rather than inventing fallback meaning', () => {
  assert.throws(() => createExploreSurfaceModel({ ...seed, schema: 'not-explore/v1' }), /Unsupported Explore Surface seed schema/);
});
