import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjection } from './index.mjs';
import { refineProjection } from './projection-refinement.mjs';

function sourceProjection() {
  return createProjection({
    projection_ref: 'projection:parasakti:explore-note',
    projection_revision: 1,
    state: 'published',
    subject: { ref: 'artifact:explore-design-note', kind: 'artifact' },
    source: { system: 'software-factory', revision: 'run:explore@1' },
    publisher_participant_ref: 'participant:public:parasakti',
    published_at: '2026-08-16T12:00:00.000Z',
    audience: { visibility: 'public' },
    representation: { kind: 'explore-entry', ref: 'projection:parasakti:explore-note' },
    provenance: [
      {
        kind: 'source-artifact',
        ref: 'artifact:explore-design-note',
        source_system: 'software-factory',
        revision: 'run:explore@1',
      },
    ],
  });
}

test('human Projection refinement creates r2 while canonical source remains r1', () => {
  const r1 = sourceProjection();
  const r2 = refineProjection(r1, {
    publisher_participant_ref: 'participant:public:ariadne',
    published_at: '2026-08-16T19:05:00.000Z',
    representation: {
      kind: 'explore-entry',
      ref: 'projection:parasakti:explore-note',
      payload: { summary: 'Human-refined public wording.' },
    },
    provenance: [
      {
        kind: 'human-refinement',
        ref: 'participant:public:ariadne',
        source_system: 'o-i',
        revision: 'refinement@1',
      },
    ],
  });

  assert.equal(r2.projection_ref, r1.projection_ref);
  assert.equal(r2.projection_revision, 2);
  assert.equal(r2.source.system, 'software-factory');
  assert.equal(r2.source.revision, 'run:explore@1');
  assert.equal(r1.source.revision, 'run:explore@1');
  assert.equal(r2.publisher_participant_ref, 'participant:public:ariadne');
  assert.deepEqual(r2.supersedes, {
    projection_ref: r1.projection_ref,
    projection_revision: 1,
    source_revision: 'run:explore@1',
  });
  assert.ok(r2.provenance.some(entry => entry.kind === 'source-artifact'));
  assert.ok(r2.provenance.some(entry => entry.kind === 'human-refinement'));
});

test('human refinement cannot smuggle a canonical source revision change', () => {
  assert.throws(
    () => refineProjection(sourceProjection(), {
      publisher_participant_ref: 'participant:public:ariadne',
      published_at: '2026-08-16T19:05:00.000Z',
      source_revision: 'run:explore@2',
      provenance: [
        {
          kind: 'human-refinement',
          ref: 'participant:public:ariadne',
          source_system: 'o-i',
          revision: 'refinement@1',
        },
      ],
    }),
    /canonical source state cannot be rewritten by refinement/
  );
});
