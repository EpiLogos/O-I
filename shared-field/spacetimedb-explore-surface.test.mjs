import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExploreSurfaceModelFromHostedSnapshot,
  exploreSurfaceSeedFromHostedSnapshot,
} from './spacetimedb-explore-surface.mjs';

const worldRef = 'world:test:live';
const presentation = {
  schema: 'oi.world-presentation/v1',
  presentation_ref: 'presentation:test:live',
  world_ref: worldRef,
  revision: 1,
  title: 'Live projected world',
  summary: 'A presentation arriving through subscribed hosted state.',
  theme: { tokens: {} },
  regions: [],
  provenance: [{ kind: 'projection', ref: 'projection:test:presentation', source_system: 'test-source', revision: 'source@1' }],
};

const presentationProjection = {
  schema: 'oi.projection/v1',
  projection_ref: 'projection:test:presentation',
  projection_revision: 1,
  state: 'published',
  subject: { kind: 'human-world', ref: worldRef },
  source: { system: 'test-source', revision: 'source@1' },
  publisher_participant_ref: 'participant:test:human',
  published_at: '2026-08-18T12:00:00.000Z',
  audience: { visibility: 'public' },
  representation: { kind: 'oi.world-presentation/v1', payload: presentation },
  provenance: [{ kind: 'human-publication', ref: 'participant:test:human', source_system: 'test-source', revision: 'source@1' }],
};

const ordinaryProjection = {
  ...presentationProjection,
  projection_ref: 'projection:test:ordinary',
  representation: { kind: 'explore-entry', ref: worldRef },
};

const hostedSnapshot = {
  fields: [],
  participants: [],
  projections: [ordinaryProjection, presentationProjection],
  entries: [{
    schema: 'oi.explore-entry/v1',
    ref: worldRef,
    kind: 'human-world',
    world_ref: worldRef,
    label: 'Live World',
    summary: 'Subscribed from SpaceTimeDB.',
    revision: 'source@1',
    provenance: [{ kind: 'human-world', ref: worldRef, source_system: 'test-source', revision: 'source@1' }],
    locators: [],
  }],
  relations: [],
  implementation: {
    entries: [{ row_id: '999', semantic_ref: worldRef }],
  },
};

test('hosted SpaceTimeDB snapshot becomes the existing Explore Surface seed without implementation identity leakage', () => {
  const seed = exploreSurfaceSeedFromHostedSnapshot(hostedSnapshot);
  assert.equal(seed.schema, 'oi.explore-browser-seed/v1');
  assert.equal(seed.entries[0].ref, worldRef);
  assert.equal(seed.presentation_projections.length, 1);
  assert.equal(seed.presentation_projections[0].projection_ref, presentationProjection.projection_ref);
  assert.equal('implementation' in seed, false);
});

test('subscribed WorldPresentation Projection renders through the same Explore Surface model', () => {
  const model = createExploreSurfaceModelFromHostedSnapshot(hostedSnapshot);
  const opened = model.open(worldRef, { depth: 1, budget: 8 });
  assert.equal(opened.resource.ref, worldRef);
  assert.equal(opened.world_presentation.presentation_ref, presentation.presentation_ref);
  assert.equal(opened.world_presentation.title, presentation.title);
  assert.equal(opened.world_presentation_projection.projection_ref, presentationProjection.projection_ref);
});
