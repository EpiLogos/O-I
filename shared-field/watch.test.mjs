import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WATCH_NON_IMPLICATIONS,
  WATCH_SCHEMA,
  createWatch,
  validateWatch,
  watchTargets,
} from './watch.mjs';

function watchFixture(overrides = {}) {
  return {
    watch_ref: 'watch:participant:ariadne:parasakti',
    watcher_participant_ref: 'participant:public:ariadne',
    field_ref: 'oi:field:public',
    target: { kind: 'agent', ref: 'agent:parasakti' },
    created_at: '2026-08-16T19:00:00.000Z',
    provenance: {
      source_system: 'o-i',
      source_revision: 'watch-action@1',
    },
    ...overrides,
  };
}

test('Watch v1 records future-interest availability without social or truth semantics', () => {
  const watch = createWatch(watchFixture());

  assert.equal(watch.schema, WATCH_SCHEMA);
  assert.equal(watch.state, 'active');
  assert.equal(watch.target.ref, 'agent:parasakti');
  assert.equal(watch.watcher_participant_ref, 'participant:public:ariadne');
  assert.deepEqual(WATCH_NON_IMPLICATIONS, ['trust', 'endorsement', 'preference', 'semantic-truth']);
  for (const implication of ['trust', 'endorsement', 'preference', 'truth', 'rank', 'score']) {
    assert.equal(implication in watch, false, `${implication} must not be implied by Watch`);
  }
  assert.equal(watchTargets(watch, 'agent:parasakti'), true);
  assert.equal(watchTargets(watch, 'project:software-factory'), false);
});

test('Watch v1 is strict about its semantic boundary', () => {
  assert.throws(
    () => createWatch(watchFixture({ preference: 1 })),
    /preference is not part of oi.watch\/v1/
  );
  assert.throws(
    () => createWatch(watchFixture({ target: { kind: 'relation', ref: 'edge:1' } })),
    /watch target kind must be one of/
  );
  assert.throws(
    () => validateWatch({ ...createWatch(watchFixture()), state: 'following' }),
    /watch state must be one of/
  );
});
