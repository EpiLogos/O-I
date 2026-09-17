import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createExploreSurfaceModel } from '../shared-field/explore-surface.mjs';
import { createExploreApplication } from '../shared-field/explore.mjs';
import { EXPLORE_DISCOVERY_SCHEMA } from '../shared-field/explore-surface.mjs';

const PUBLIC_SEED_URL = new URL('./public/data/explore-public.json', import.meta.url);
const DISCOVERY_URL = new URL('./public/data/explore-discovery.json', import.meta.url);

/**
 * The discovery export is the bounded, agent-facing carrier AIKit
 * materialises into its SemanticWiki (`aikit-adapters::oi_explore` reads
 * this exact path by default). It must stay a faithful derivation of the
 * public Explore seed: never hand-edited, always regenerated alongside it,
 * and always loadable by another World's Explore application — the same
 * refs resolve there.
 */
test('the committed discovery export is exactly the public seed\'s discoverySeed()', async () => {
  const publicSeed = JSON.parse(await readFile(PUBLIC_SEED_URL, 'utf8'));
  const committed = JSON.parse(await readFile(DISCOVERY_URL, 'utf8'));

  const model = createExploreSurfaceModel(publicSeed);
  assert.deepEqual(committed, model.discoverySeed());
  assert.equal(committed.schema, EXPLORE_DISCOVERY_SCHEMA);
});

test('the committed discovery export resolves as ordinary index state in another World', async () => {
  const committed = JSON.parse(await readFile(DISCOVERY_URL, 'utf8'));
  const secondWorld = createExploreApplication({
    entries: committed.entries,
    relations: committed.relations,
    ...(committed.membership ? { membership: committed.membership } : {}),
  });
  for (const entry of committed.entries) {
    assert.ok(secondWorld.resolve(entry.ref), `exported ref ${entry.ref} resolves`);
  }
  assert.deepEqual(secondWorld.search('anything'), []);
});
