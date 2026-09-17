import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWorldPresentationProjection,
  refineWorldPresentationProjection,
  worldPresentationFromProjection,
} from './presentation-projection.mjs';

function presentation(revision = 1, title = 'Initial world') {
  return {
    schema: 'oi.world-presentation/v1',
    presentation_ref: 'presentation:human:root',
    world_ref: 'world:human:root',
    revision,
    title,
    theme: { tokens: {} },
    regions: [],
    provenance: [
      {
        kind: 'world-presentation',
        ref: 'presentation:human:root',
        source_system: 'central',
        revision: `presentation@${revision}`,
      },
    ],
  };
}

function projection() {
  return createWorldPresentationProjection({
    projection: {
      schema: 'oi.projection/v1',
      projection_ref: 'projection:human:root',
      projection_revision: 1,
      state: 'published',
      subject: { ref: 'world:human:root', kind: 'central.participant-root' },
      source: { system: 'central', ref: 'central:human:root', revision: 'central@7' },
      publisher_participant_ref: 'participant:public:human',
      published_at: '2026-08-18T00:00:00Z',
      audience: { visibility: 'public' },
      provenance: [
        {
          kind: 'central-participant-root',
          ref: 'central:human:root',
          source_system: 'central',
          revision: 'central@7',
        },
      ],
    },
    presentation: presentation(),
  });
}

const refinementInput = {
  publisher_participant_ref: 'participant:public:human',
  published_at: '2026-08-18T00:30:00Z',
  provenance: [
    {
      kind: 'human-refinement',
      ref: 'human:root',
      source_system: 'central',
      revision: 'central@7',
    },
  ],
};

test('world presentation is a Projection representation, not source identity', () => {
  const value = projection();
  assert.equal(value.subject.ref, 'world:human:root');
  assert.equal(value.source.revision, 'central@7');
  assert.equal(value.representation.kind, 'oi.world-presentation/v1');
  assert.equal(worldPresentationFromProjection(value).title, 'Initial world');
});

test('human edit creates a new attributable Projection revision without rewriting source', () => {
  const previous = projection();
  const next = refineWorldPresentationProjection(previous, presentation(2, 'Edited world'), refinementInput);

  assert.equal(next.projection_revision, 2);
  assert.equal(next.source.system, 'central');
  assert.equal(next.source.revision, 'central@7');
  assert.equal(next.supersedes.projection_revision, 1);
  assert.equal(next.supersedes.source_revision, 'central@7');
  assert.equal(worldPresentationFromProjection(next).title, 'Edited world');
  assert.equal(worldPresentationFromProjection(next).revision, 2);
  assert.equal(next.provenance.at(-1).kind, 'human-refinement');
});

test('working representation ratifies from W1 to W2 when the draft intentionally retains the published revision', () => {
  const previous = projection();
  const working = presentation(1, 'Edited in place');
  const next = refineWorldPresentationProjection(previous, working, refinementInput);
  assert.equal(next.projection_revision, 2);
  assert.equal(worldPresentationFromProjection(next).revision, 2);
  assert.equal(worldPresentationFromProjection(next).title, 'Edited in place');
  assert.equal(next.source.revision, 'central@7');
});

test('presentation cannot silently switch to another world while editing', () => {
  const wrongWorld = presentation(2, 'Wrong world');
  wrongWorld.world_ref = 'world:other';
  assert.throws(() => refineWorldPresentationProjection(projection(), wrongWorld, refinementInput), /world_ref must match Projection subject.ref/);
});

test('presentation identity and revision cannot drift backwards during refinement', () => {
  const wrongPresentation = presentation(2, 'Wrong presentation');
  wrongPresentation.presentation_ref = 'presentation:other';
  assert.throws(() => refineWorldPresentationProjection(projection(), wrongPresentation, refinementInput), /presentation_ref must remain stable/);

  const previous = refineWorldPresentationProjection(projection(), presentation(2, 'Second'), refinementInput);
  assert.throws(() => refineWorldPresentationProjection(previous, presentation(1, 'Older'), {
    ...refinementInput,
    published_at: '2026-08-18T00:40:00Z',
  }), /revision cannot move backwards/);
});
