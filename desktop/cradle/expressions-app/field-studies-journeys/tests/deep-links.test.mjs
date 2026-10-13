// lane-3 E22: deep links address refs, never indices.
// `?expression=<ref>&scene=<scene_ref>&t=<seconds>&marker=<id>`: the pure parse and format, the
// refusals that name what was refused, and the app's wiring (one parser, replaceState only).
// Run after `npm run build:journeys` (this suite imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  DEEP_LINK_REF_MAX, parseDeepLink, formatDeepLink, resolveSceneRef, resolveMarker,
  clampJourneyTime, markerAtTime, shortenRef,
} from '../build/deepLinks.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const appSource = readFileSync(join(here, '../src/app.ts'), 'utf8');

// The body of a top-level function in app.ts, from its declaration to the next top-level declaration.
function functionBody(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `app.ts declares ${name}`);
  const rest = appSource.slice(start + 1);
  const next = rest.search(/\n(?:function |\/\*\*|document\.addEventListener|const |let |window\.)/);
  return next < 0 ? rest : rest.slice(0, next);
}

const SCENES = [
  {id: 'scene-open', name: 'Opening', ref: 'scene:native-open'},
  {id: 'scene-middle', name: 'Middle'},
];
const MARKERS = [
  {id: 'marker-a', name: 'Entrance', time: 4.5, colour: 'amber'},
  {id: 'marker-b', name: 'Turn', time: 12, colour: 'rose'},
];

test('parse reads the four address keys: refs as strings, t as seconds', () => {
  const parsed = parseDeepLink('?expression=expression%3Aabc&scene=scene-2&t=12.5&marker=marker-a');
  assert.deepEqual(parsed.address, {expression: 'expression:abc', scene: 'scene-2', t: 12.5, marker: 'marker-a'});
  assert.deepEqual(parsed.refused, []);
});

test('a parameter the app does not own is carried by the format and ignored by the parse, without refusal', () => {
  const parsed = parseDeepLink('?mode=techne&world=abc&present=1');
  assert.deepEqual(parsed.address, {});
  assert.deepEqual(parsed.refused, []);
});

test('scene=0 is a ref string, never an index: it resolves to no Scene and is refused by name', () => {
  const parsed = parseDeepLink('?scene=0');
  assert.equal(parsed.address.scene, '0');
  const found = resolveSceneRef(SCENES, parsed.address.scene);
  assert.ok('refused' in found, 'an index-looking ref must not select a Scene');
  assert.match(found.refused, /"0"/);
  assert.match(found.refused, /first Scene/);
});

test('an empty or unprintable ref is refused by name and not kept', () => {
  const parsed = parseDeepLink('?scene=&marker=a%20b&expression=ok-ref');
  assert.deepEqual(parsed.address, {expression: 'ok-ref'});
  assert.equal(parsed.refused.length, 2);
  assert.match(parsed.refused[0], /scene/);
  assert.match(parsed.refused[1], /marker/);
  assert.match(parsed.refused[1], /a b/);
});

test('a ref longer than the bound is refused', () => {
  const parsed = parseDeepLink(`?scene=${'x'.repeat(DEEP_LINK_REF_MAX + 1)}`);
  assert.deepEqual(parsed.address, {});
  assert.match(parsed.refused[0], /scene/);
});

test('t accepts whole seconds and up to three decimals, and refuses every other form', () => {
  assert.equal(parseDeepLink('?t=0').address.t, 0);
  assert.equal(parseDeepLink('?t=0.5').address.t, 0.5);
  assert.equal(parseDeepLink('?t=600.125').address.t, 600.125);
  for (const bad of ['-1', '1e3', 'NaN', 'Infinity', '12:30', '', '1.2345', '0x10', '1,5']) {
    const parsed = parseDeepLink(`?t=${encodeURIComponent(bad)}`);
    assert.equal(parsed.address.t, undefined, `t=${bad} is not a time`);
    assert.equal(parsed.refused.length, 1, `t=${bad} is named as refused`);
    assert.match(parsed.refused[0], /^The link's t /);
  }
});

test('format sets, replaces and removes the address and keeps every other parameter in place', () => {
  assert.equal(
    formatDeepLink('?mode=techne&scene=old&journey=seven', {scene: 'new', t: 3.14159}),
    '?mode=techne&scene=new&journey=seven&t=3.142',
  );
  assert.equal(formatDeepLink('?scene=a&t=4&marker=m', {t: undefined}), '?scene=a&marker=m');
  assert.equal(formatDeepLink('?scene=a', {scene: undefined}), '');
  assert.equal(formatDeepLink('', {}), '');
});

test('format never writes a time that is negative or not finite', () => {
  assert.equal(formatDeepLink('', {t: -1}), '');
  assert.equal(formatDeepLink('', {t: Number.NaN}), '');
});

test('a patch key left out is kept; a patch key with undefined is removed', () => {
  assert.equal(formatDeepLink('?expression=keep&scene=a', {scene: 'b'}), '?expression=keep&scene=b');
  assert.equal(formatDeepLink('?expression=keep&scene=a', {expression: undefined}), '?scene=a');
});

test('parse of a format returns the same address (round trip, refs with colons included)', () => {
  const address = {expression: 'expression:9f2c', scene: 'scene:native-open', t: 7.25, marker: 'marker-b'};
  const search = formatDeepLink('?mode=techne', address);
  assert.deepEqual(parseDeepLink(search).address, address);
  assert.match(search, /^\?mode=techne&/);
});

test('a Scene resolves by its document id, its native scene_ref, or a legacy name, never by index', () => {
  assert.deepEqual(resolveSceneRef(SCENES, 'scene-middle'), {index: 1, id: 'scene-middle', via: 'ref'});
  assert.deepEqual(resolveSceneRef(SCENES, 'scene:native-open'), {index: 0, id: 'scene-open', via: 'ref'});
  assert.deepEqual(resolveSceneRef(SCENES, 'middle'), {index: 1, id: 'scene-middle', via: 'name'});
  assert.deepEqual(resolveSceneRef(SCENES, 'MIDDLE'), {index: 1, id: 'scene-middle', via: 'name'});
  assert.match(resolveSceneRef(SCENES, '1').refused, /"1"/);
  assert.match(resolveSceneRef(SCENES, 'scene-gone').refused, /"scene-gone"/);
});

test('a marker resolves by its id, and a missing one is refused by name', () => {
  assert.deepEqual(resolveMarker(MARKERS, 'marker-b'), {marker: MARKERS[1]});
  assert.match(resolveMarker(MARKERS, 'marker-z').refused, /"marker-z"/);
  assert.match(resolveMarker([], '0').refused, /"0"/);
});

test('a time past the end of the Expression is held at its end, and says so', () => {
  assert.deepEqual(clampJourneyTime(30, 20), {time: 20, clamped: true});
  assert.deepEqual(clampJourneyTime(5, 20), {time: 5, clamped: false});
  assert.deepEqual(clampJourneyTime(-2, 20), {time: 0, clamped: false});
  assert.deepEqual(clampJourneyTime(3, 0), {time: 0, clamped: true});
});

test('a marker matches the playhead only within the ruler tolerance', () => {
  assert.equal(markerAtTime(MARKERS, 4.504), 'marker-a');
  assert.equal(markerAtTime(MARKERS, 4.52), undefined);
  assert.equal(markerAtTime([], 0), undefined);
});

test('a long value is shortened in the sentence that names it', () => {
  const long = 'q'.repeat(200);
  assert.ok(shortenRef(long).length < 60);
  assert.ok(shortenRef(long).endsWith('…'));
  assert.equal(shortenRef('short'), 'short');
});

test('the app reads its address through this parser and only ever writes it with replaceState', () => {
  assert.match(appSource, /from '\.\/deepLinks'/);
  assert.doesNotMatch(appSource, /qs\.get\('scene'\)/, 'the scene query is no longer an index');
  const sync = functionBody('syncDeepLinkAddress');
  assert.match(sync, /history\.replaceState\(/);
  assert.doesNotMatch(sync, /pushState/, 'the address never adds history entries');
  assert.match(sync, /formatDeepLink\(location\.search/);
});

test('an applied link never navigates by index, and each refusal is named in a toast', () => {
  const apply = functionBody('applyDeepLinkAddress');
  assert.doesNotMatch(apply, /sceneIndex\s*=/, 'a link selects a Scene through its ref, not an index');
  assert.match(apply, /resolveSceneRef\(/);
  assert.match(apply, /resolveMarker\(/);
  assert.match(apply, /clampJourneyTime\(/);
  const settle = functionBody('settleDeepLink');
  assert.match(settle, /toast\(notes\.join/);
});

test('the address is not written before the link has settled', () => {
  assert.match(functionBody('syncDeepLinkAddress'), /if\(deepLinkPending\)return;/);
});
