// lane-3 E22 / ticket P (G3): the frame announces its address with its state — the Scene's ref, the time and the marker while
// the transport stands still — and the boundary reads it with the frame's own deep-link grammar (deepLinks.ts): an address its
// link would not carry back whole refuses the reading, like every malformed field. The shell copies the address and reopens
// the frame with it in that same form.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readHostedState, readHostedAddress, addressLink, addressRefs, entryAtAddress, parseDeepLink} from '../src/index.ts';

const reading = extra => ({hostMode: 'expressions', sceneIndex: 0, sceneCount: 2,
  document: {id: 'expression:kept', name: 'Kept work'}, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'},
  sceneName: 'the stone', ...extra});

test('an announced address is carried with the reading, the time as its link carries it', () => {
  const state = readHostedState(reading({address: {scene: 'scene:one', t: 12.3456789, marker: 'marker-a1', markerName: 'Arrival'}}));
  assert.deepEqual(state?.address, {scene: 'scene:one', t: 12.346, marker: 'marker-a1', markerName: 'Arrival'});
  assert.deepEqual(readHostedState(reading({address: {scene: 'scene:one'}}))?.address, {scene: 'scene:one'});
  assert.deepEqual(readHostedState(reading({address: {scene: 'scene:one', t: 0}}))?.address, {scene: 'scene:one', t: 0});
});

test('a reading without an address is valid (a link not yet settled) and carries none', () => {
  const state = readHostedState(reading({}));
  assert.ok(state);
  assert.equal('address' in state, false);
});

test('a malformed address refuses the whole reading', () => {
  for (const address of [
    null, 'scene:one', [], {scene: 7}, {scene: ''}, {scene: 'the stone'}, {scene: 'scene:one\n'}, {scene: 'x'.repeat(257)},
    {scene: 'scene:one', t: -1}, {scene: 'scene:one', t: Number.NaN}, {scene: 'scene:one', t: '12'}, {scene: 'scene:one', t: 1e7},
    {scene: 'scene:one', marker: 'a marker'}, {scene: 'scene:one', marker: 4},
    {scene: 'scene:one', markerName: 'Arrival'}, {scene: 'scene:one', marker: 'm', markerName: 3},
  ]) {
    assert.equal(readHostedAddress(address), null, JSON.stringify(address));
    assert.equal(readHostedState(reading({address})), null, JSON.stringify(address));
  }
});

test('the whole address is the frame\'s own link form, and it parses back to the same place', () => {
  const link = addressLink('expression:kept', {scene: 'scene:one', t: 12.5, marker: 'marker-a1', markerName: 'Arrival'});
  assert.equal(link, '?expression=expression%3Akept&scene=scene%3Aone&t=12.5&marker=marker-a1');
  assert.deepEqual(parseDeepLink(link), {address: {expression: 'expression:kept', scene: 'scene:one', marker: 'marker-a1', t: 12.5}, refused: []});
  assert.equal(addressLink('expression:kept', undefined), '?expression=expression%3Akept');
  assert.equal(addressLink(undefined, {scene: 'scene:one'}), '?scene=scene%3Aone');
});

test('the shell keeps the refs only, and reopens the frame at them in its own query, every other parameter kept', () => {
  assert.deepEqual(addressRefs({scene: 'scene:one', t: 4, marker: 'm1', markerName: 'Arrival'}), {scene: 'scene:one', t: 4, marker: 'm1'});
  assert.equal(addressRefs({}), undefined);
  assert.equal(addressRefs(undefined), undefined);
  const entry = '/__application/expressions/index.html?mode=expressions&world=generic&host-load=abc&expression=expression%3Akept';
  assert.equal(entryAtAddress(entry, undefined), entry);
  const opened = entryAtAddress(entry, {scene: 'scene:two', t: 7.25, marker: 'm1', markerName: 'Arrival'});
  assert.ok(opened.startsWith('/__application/expressions/index.html?'));
  const query = new URLSearchParams(opened.slice(opened.indexOf('?')));
  assert.deepEqual(Object.fromEntries(query), {mode: 'expressions', world: 'generic', 'host-load': 'abc', expression: 'expression:kept', scene: 'scene:two', t: '7.25', marker: 'm1'});
  assert.deepEqual(parseDeepLink(opened.slice(opened.indexOf('?'))).refused, [], 'the frame reads the kept address back without refusal');
});
