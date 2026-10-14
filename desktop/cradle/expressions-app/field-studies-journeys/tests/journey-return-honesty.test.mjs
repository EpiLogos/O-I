// lane-5 T11 — an honest return. A return names the beat it restored. The native Scene moves to that beat only when this Journey can
// present it on the native basis as it stands; a beat it cannot present is a named miss, never shown as restored. Run after
// `npm run build:journeys`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {restoredBeatNotice} from '../build/journeyBeats.js';

const HERE = 'oi.expression:probe:scene:here';
const THERE = 'oi.expression:probe:scene:there';
const src = new URL('../src/', import.meta.url);

test('T11: a return to the Scene the native view already presents names it and moves nothing', () => {
  assert.deepEqual(restoredBeatNotice(HERE, HERE, false), {moves: false, notice: 'Back in this Journey at "here".'});
  assert.deepEqual(restoredBeatNotice(HERE, HERE, true), {moves: false, notice: 'Back in this Journey at "here".'});
});

test('T11: a restored beat this Journey can present on the native basis moves the Scene to it, by ref', () => {
  assert.deepEqual(restoredBeatNotice(THERE, HERE, true), {moves: true, notice: 'Back in this Journey at "there".'});
});

test('T11: a restored beat the native basis no longer presents is a named miss: nothing moves, nothing is claimed as restored', () => {
  const outcome = restoredBeatNotice(THERE, HERE, false);
  assert.equal(outcome.moves, false);
  assert.match(outcome.notice, /named the beat "there"/);
  assert.match(outcome.notice, /stays where it was/);
  assert.doesNotMatch(outcome.notice, /^Back in this Journey/);
});

test('T11: the instrument routes its return through this helper, and no unconditional "Back in" line remains', async () => {
  const source = await readFile(new URL('journeyInstrument.tsx', src), 'utf8');
  assert.match(source, /restoredBeatNotice\(restoredRef,basis\.scene_ref,/);
  assert.match(source, /if\(outcome\.moves&&card\)/);
  assert.doesNotMatch(source, /restoredRef\?\?basis\.scene_ref/);
});
