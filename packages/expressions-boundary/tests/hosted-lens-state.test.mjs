// The hosted application reports the Technē lens it stands in (owner ruling, lock §0.1): the reader carries a valid lens,
// admits a reading without one, and refuses any other lens as it refuses every malformed field.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readHostedState} from '../src/index.ts';

// A complete reading (the host's readiness shape, as host.test.mjs builds it); the lens is the only variable.
const reading = extra => ({hostMode: 'expressions', sceneIndex: 0, sceneCount: 1,
  document: {id: 'expression:kept', name: 'Kept work'}, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'},
  selection: [{id: 'entity:one', name: 'A real selection reading'}], ...extra});

test('a valid hosted lens is carried through the reader', () => {
  for (const lens of ['project', 'canvas', 'timeline', 'journey', 'place', 'palace']) {
    assert.equal(readHostedState(reading({lens}))?.lens, lens, lens);
  }
});

test('a reading without a lens is valid (a frame that has not reported one), and carries none', () => {
  const state = readHostedState(reading({}));
  assert.ok(state, 'the reading is admitted');
  assert.equal('lens' in state, false);
});

test('a lens outside the six holders refuses the reading', () => {
  for (const lens of ['project-graph', 'places', 'expressions', 'none', 7, null, {}]) {
    assert.equal(readHostedState(reading({lens})), null, JSON.stringify(lens));
  }
});
