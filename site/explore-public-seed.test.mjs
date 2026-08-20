import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createExploreBrowserModel } from './explore-read-model.mjs';

const SEED_URL = new URL('./public/data/explore-public.json', import.meta.url);

async function loadPublicSeed() {
  return JSON.parse(await readFile(SEED_URL, 'utf8'));
}

test('public Explore does not manufacture worlds while no real Projection is published', async () => {
  const seed = await loadPublicSeed();
  const model = createExploreBrowserModel(seed);

  assert.deepEqual(seed.entries, []);
  assert.deepEqual(seed.relations, []);
  assert.deepEqual(seed.presentations, []);
  assert.deepEqual(seed.presentation_projections, []);
  assert.deepEqual(model.worlds(), []);
  assert.deepEqual(model.search('anything'), []);
});

test('empty public field remains a valid Explore Surface ready for provider-supplied projections', async () => {
  const seed = await loadPublicSeed();
  assert.equal(seed.schema, 'oi.explore-browser-seed/v1');
  assert.doesNotThrow(() => createExploreBrowserModel(seed));
});
