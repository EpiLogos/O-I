import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createExploreBrowserModel } from './explore-read-model.mjs';

const SEED_URL = new URL('./public/data/explore-public.json', import.meta.url);

async function loadPublicSeed() {
  return JSON.parse(await readFile(SEED_URL, 'utf8'));
}

test('public Explore seed projects the O:I programme world with real provenance', async () => {
  const seed = await loadPublicSeed();
  const model = createExploreBrowserModel(seed);

  const worlds = model.worlds();
  assert.equal(worlds.length, 1, 'exactly one world should be projected');
  assert.equal(worlds[0].ref, 'world:epi-logos');
  assert.ok(worlds[0].presentation, 'the world opens with its authored presentation');
  assert.ok(worlds[0].presentation_projection, 'the presentation arrives as a published projection');
});

test('public Explore seed entries all carry real provenance and relations resolve', async () => {
  const seed = await loadPublicSeed();
  const refs = new Set(seed.entries.map((entry) => entry.ref));

  for (const entry of seed.entries) {
    assert.ok(entry.provenance?.length > 0, `${entry.ref} must carry provenance`);
    for (const provenance of entry.provenance) {
      assert.ok(provenance.ref && provenance.source_system, `${entry.ref} provenance must name a resolvable source`);
    }
  }
  for (const relation of seed.relations) {
    assert.ok(refs.has(relation.from), `relation from unknown ref: ${relation.from}`);
    assert.ok(refs.has(relation.to), `relation to unknown ref: ${relation.to}`);
  }
});

test('public Explore seed opens products, documents and the field from the world', async () => {
  const seed = await loadPublicSeed();
  const model = createExploreBrowserModel(seed);

  for (const query of ['Central', 'Actuation', 'AIKit', 'Software Factory', 'Workcell', 'Quaternal Logic']) {
    const results = model.search(query);
    assert.ok(results.length > 0, `search should find ${query}`);
  }
  assert.ok(model.search('documentation').some((result) => result.ref === 'wiki:o-i:docs'));
  assert.ok(model.search('shared field').length > 0);

  const opened = model.open('world:epi-logos');
  assert.equal(opened.world.ref, 'world:epi-logos');
  const relatedRefs = new Set(opened.relations.edges.flatMap((edge) => [edge.from, edge.to]));
  for (const expected of ['project:central', 'project:quaternal-logic', 'wiki:o-i:docs', 'oi:field:public']) {
    assert.ok(relatedRefs.has(expected), `world should relate to ${expected}`);
  }
});

test('public world presentation uses only portable renderers with fallbacks', async () => {
  const seed = await loadPublicSeed();
  const model = createExploreBrowserModel(seed);
  const presentation = model.presentation('world:epi-logos');
  assert.ok(presentation, 'presentation must resolve');

  for (const region of presentation.regions) {
    assert.ok(region.bindings.length > 0, `region ${region.region_ref} should not be empty`);
    for (const binding of region.bindings) {
      assert.ok(
        binding.portable_renderer?.startsWith('oi.presentation/'),
        `binding ${binding.binding_ref} must declare a portable renderer`,
      );
      assert.ok(binding.provenance.length > 0, `binding ${binding.binding_ref} must carry provenance`);
    }
  }
});
