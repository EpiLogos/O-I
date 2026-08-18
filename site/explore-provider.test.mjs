import assert from 'node:assert/strict';
import test from 'node:test';

import {
  browserSeedFromHostedSnapshot,
  createLiveExploreBrowserProvider,
  createStaticExploreBrowserProvider,
} from './explore-provider.mjs';

const entry = {
  ref: 'world:test',
  kind: 'human-world',
  world_ref: 'world:test',
  label: 'Test world',
  aliases: [],
  provenance: [{ kind: 'test', ref: 'world:test', source_system: 'test', revision: '1' }],
  locators: [],
};

function presentationProjection(revision = 1) {
  return {
    schema: 'oi.projection/v1',
    projection_ref: 'projection:test:world',
    projection_revision: revision,
    state: 'published',
    subject: { ref: 'world:test', kind: 'central.participant-root' },
    source: { system: 'central', ref: 'central:test', revision: 'central@1' },
    publisher_participant_ref: 'participant:test',
    published_at: '2026-08-18T00:00:00Z',
    audience: { visibility: 'public' },
    representation: {
      kind: 'oi.world-presentation/v1',
      payload: {
        schema: 'oi.world-presentation/v1',
        presentation_ref: 'presentation:test',
        world_ref: 'world:test',
        revision,
        title: `Test world ${revision}`,
        theme: { tokens: {} },
        regions: [],
        provenance: [{ kind: 'test', ref: 'presentation:test', source_system: 'test', revision: String(revision) }],
      },
    },
    provenance: [{ kind: 'test', ref: 'world:test', source_system: 'test', revision: '1' }],
  };
}

test('static provider is only a carrier over the browser read model', async () => {
  const provider = createStaticExploreBrowserProvider({
    source: '/explore.json',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        schema: 'oi.explore-browser-seed/v1',
        entries: [entry],
        relations: [],
        presentations: [],
        presentation_projections: [],
      }),
    }),
  });

  const model = await provider.current();
  assert.equal(model.worlds()[0].ref, 'world:test');
  assert.deepEqual(provider.status(), { kind: 'static', live: false, source: '/explore.json' });
});

test('hosted snapshot selects WorldPresentation projections without exposing implementation rows', () => {
  const seed = browserSeedFromHostedSnapshot({
    entries: [entry],
    relations: [],
    projections: [presentationProjection(), { ...presentationProjection(), representation: { kind: 'text/plain', payload: 'x' } }],
    implementation: { entries: [{ row_id: '44', semantic_ref: 'world:test' }] },
  });

  assert.equal(seed.presentation_projections.length, 1);
  assert.equal(seed.presentation_projections[0].projection_ref, 'projection:test:world');
  assert.equal(Object.hasOwn(seed, 'implementation'), false);
});

test('live provider rebuild events deliver a fresh browser model through the same contract', () => {
  let revision = 1;
  const listeners = new Set();
  const live = {
    snapshot() {
      return { entries: [entry], relations: [], projections: [presentationProjection(revision)] };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    status() {
      return { revision, healthy: true };
    },
  };

  const provider = createLiveExploreBrowserProvider(live);
  assert.equal(provider.current().presentation('world:test').title, 'Test world 1');

  let received;
  const unsubscribe = provider.subscribe((value) => {
    received = value;
  });
  revision = 2;
  for (const listener of listeners) listener({ type: 'rebuild', revision: 2 });

  assert.equal(received.model.presentation('world:test').title, 'Test world 2');
  assert.deepEqual(provider.status(), { kind: 'live', live: true, revision: 2, healthy: true });
  unsubscribe();
});
