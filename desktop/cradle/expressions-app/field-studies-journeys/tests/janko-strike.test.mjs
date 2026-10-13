// The Jankó note path's strike plan in the frame: a key is a pitch class; the owner's played reading names its voices. A key with no owner
// voice is refused by name, and a chord with any silent key is not sent at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import {planJankoStrike} from '../src/native-field/jankoStrike.mjs';

const played = {by_class: [
  {pitch_class: 0, voices: [{mode_ref: 'mode:0a', planet_ref: 'Sun'}, {mode_ref: 'mode:0b', planet_ref: 'Moon'}]},
  {pitch_class: 4, voices: [{mode_ref: 'mode:4a', planet_ref: 'Venus'}]},
  {pitch_class: 7, voices: []},
]};

test('the owner\'s voices for a key are the mode references it names, in order, with no voice invented', () => {
  assert.deepEqual(planJankoStrike(played, [0]), {refs: ['mode:0a', 'mode:0b'], silent: [], refusal: null});
  assert.deepEqual(planJankoStrike(played, [0, 4]).refs, ['mode:0a', 'mode:0b', 'mode:4a'], 'a chord is one act over the owner voices');
});

test('a key the owner names no voice for is refused by name, and a chord with any silent key is not sent', () => {
  const single = planJankoStrike(played, [7]);
  assert.deepEqual(single.refs, []);
  assert.deepEqual(single.silent, [7]);
  assert.match(single.refusal, /No voice of this sky sounds at G/);
  const chord = planJankoStrike(played, [0, 1]);
  assert.deepEqual(chord.silent, [1]);
  assert.deepEqual(chord.refs, [], 'nothing sounds from a chord with a silent key');
  assert.match(chord.refusal, /C♯/);
});

test('without the owner\'s played reading every key is refused: the owner states no voices', () => {
  for (const absent of [null, undefined, {}, {by_class: 'x'}]) {
    const plan = planJankoStrike(absent, [0]);
    assert.deepEqual(plan.refs, []);
    assert.match(plan.refusal, /carries no Jankó voices/);
  }
});

test('a note outside the twelve pitch classes is refused before the owner is asked', () => {
  for (const bad of [[12], [-1], [0.5], [], ['0'], [0, 0.5]]) {
    assert.match(planJankoStrike(played, bad).refusal, /pitch classes, 0–11/, JSON.stringify(bad));
  }
});
