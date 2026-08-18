import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createExploreBrowserModel } from './explore-read-model.mjs';

async function canonicalExploreFixture() {
  return JSON.parse(await readFile(new URL('../shared-field/fixtures/explore-world-v1.json', import.meta.url), 'utf8'));
}

function presentation(worldRef) {
  return {
    schema: 'oi.world-presentation/v1',
    presentation_ref: `${worldRef}:presentation`,
    world_ref: worldRef,
    revision: 1,
    title: 'Authored world presentation',
    theme: { tokens: {} },
    regions: [
      {
        region_ref: 'region:opening',
        role: 'opening',
        bindings: [
          {
            binding_ref: 'binding:opening',
            component_ref: 'component:test:opening',
            portable_renderer: 'oi.presentation/text/v1',
            props: { text: 'A portable opening.' },
            fallback: { title: 'Opening', text: 'A portable opening.' },
            provenance: [
              {
                kind: 'component-contribution',
                ref: 'component:test:opening',
                source_system: 'test',
                revision: '1',
              },
            ],
          },
        ],
      },
    ],
    provenance: [
      {
        kind: 'world-presentation',
        ref: `${worldRef}:presentation`,
        source_system: 'test',
        revision: '1',
      },
    ],
  };
}

test('browser Explore consumes canonical search/open/local-whole semantics', async () => {
  const fixture = await canonicalExploreFixture();
  const root = fixture.entries.find((entry) => entry.ref === entry.world_ref);
  const model = createExploreBrowserModel({
    schema: 'oi.explore-browser-seed/v1',
    entries: fixture.entries,
    relations: fixture.relations,
    presentations: [presentation(root.ref)],
  });

  assert.equal(model.worlds().length, 1);
  assert.equal(model.worlds()[0].ref, root.ref);

  const results = model.search('knowledge navigation');
  assert.equal(results[0].ref, 'wiki:o-i:explore:knowledge-navigation');

  const opened = model.open(results[0].ref, { depth: 1, budget: 8 });
  assert.equal(opened.resource.ref, results[0].ref);
  assert.equal(opened.relations.focus, results[0].ref);
  assert.equal(opened.world.ref, root.ref);
  assert.equal(opened.world_presentation.world_ref, root.ref);
  assert.ok(opened.sources.provenance.length > 0);
});

test('browser model accepts an honestly empty public field', () => {
  const model = createExploreBrowserModel({
    schema: 'oi.explore-browser-seed/v1',
    entries: [],
    relations: [],
    presentations: [],
  });

  assert.deepEqual(model.worlds(), []);
  assert.deepEqual(model.search('anything'), []);
  assert.equal(model.open('world:missing'), undefined);
});

test('latest presentation Projection revision wins without changing source semantics', async () => {
  const fixture = await canonicalExploreFixture();
  const root = fixture.entries.find((entry) => entry.ref === entry.world_ref);
  const base = {
    schema: 'oi.projection/v1',
    projection_ref: 'projection:test:world',
    state: 'published',
    subject: { ref: root.ref, kind: 'central.participant-root' },
    source: { system: 'central', ref: 'central:test', revision: 'central@1' },
    publisher_participant_ref: 'participant:test',
    audience: { visibility: 'public' },
    provenance: [
      { kind: 'central-participant-root', ref: 'central:test', source_system: 'central', revision: 'central@1' },
    ],
  };

  const p1 = {
    ...base,
    projection_revision: 1,
    published_at: '2026-08-18T00:00:00Z',
    representation: { kind: 'oi.world-presentation/v1', payload: presentation(root.ref) },
  };
  const secondPresentation = presentation(root.ref);
  secondPresentation.revision = 2;
  secondPresentation.title = 'Second presentation revision';
  const p2 = {
    ...base,
    projection_revision: 2,
    published_at: '2026-08-18T00:10:00Z',
    representation: { kind: 'oi.world-presentation/v1', payload: secondPresentation },
    supersedes: { projection_ref: 'projection:test:world', projection_revision: 1, source_revision: 'central@1' },
  };

  const model = createExploreBrowserModel({
    schema: 'oi.explore-browser-seed/v1',
    entries: fixture.entries,
    relations: fixture.relations,
    presentation_projections: [p1, p2],
  });

  assert.equal(model.presentation(root.ref).title, 'Second presentation revision');
  assert.equal(model.presentationProjection(root.ref).projection_revision, 2);
  assert.equal(model.presentationProjection(root.ref).source.revision, 'central@1');
});
