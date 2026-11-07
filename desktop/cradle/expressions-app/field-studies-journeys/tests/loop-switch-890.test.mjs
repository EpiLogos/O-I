// O-I #747 round 890, XT15 ("I loop the scenes while I watch the cut"; DLW.md §16.6, "A loop region has an in point and an out point: the
// transport plays, and repeats, only between them"; §10.5 Loop and punch, "Loop the scenes"): Loop on or off, as Live's Loop switch governs
// its brace. Until this round the brace repeated whatever the Loop switch said: the switch turned only the saved sequence's return to its
// first scene. Now the brace repeats while Loop is on; with Loop off it is kept where it stands, drawn as off, and the scenes play through.
// SCRIPTED: the frame's own sources bundled with the app's esbuild; its transport stepped on a logical clock (rawDelta, never the wall).
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'loop-switch-890-'));
after(() => rmSync(out, {recursive: true, force: true}));
const bundle = async (entry, name) => {
  const outfile = join(out, `${name}.mjs`);
  await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent'});
  return import(pathToFileURL(outfile).href);
};
const markers = await bundle('src/journeyMarkers.ts', 'journeyMarkers');
const {advanceSceneTransport} = await bundle('src/sceneTransport.ts', 'sceneTransport');
const {blankScene} = await bundle('src/model.ts', 'model');
const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');
const css = readFileSync(join(journeys, 'src/styles.css'), 'utf8');

const journey = loop => {
  const scenes = [10, 8].map((duration, i) => { const s = blankScene(`Scene ${i + 1}`); s.id = `s${i + 1}`; s.duration = duration; return s; });
  return {schema: 'oi.journey', version: 1, id: 'j', name: 'Loop', description: '', loop, scenes, loopRegion: {from: 2, to: 6}, updatedAt: ''};
};
const STATE = {playing: true, savedSequence: false, hidden: false, libraryOpen: false, propertyRecording: false, editing: false};

test('XT15 (round 890): the brace repeats while Loop is on; with Loop off it is kept and does not repeat', () => {
  assert.equal(typeof markers.activeLoopRegion, 'function', 'the frame says which brace repeats');
  assert.deepEqual(markers.activeLoopRegion(journey(true)), {from: 2, to: 6});
  assert.equal(markers.activeLoopRegion(journey(false)), undefined, 'Loop off: the brace does not repeat');
  assert.deepEqual(journey(false).loopRegion, {from: 2, to: 6}, 'and is kept where it stands');
  assert.equal(markers.activeLoopRegion({...journey(true), loopRegion: undefined}), undefined);
  // Stepped on the transport's own clock, from 5.9 s by 0.2 s: on, it wraps to the in point; off, it plays on past the out point.
  const on = journey(true), off = journey(false);
  assert.equal(advanceSceneTransport(on, 0, 5.9, .2, {...STATE, loopRegion: markers.activeLoopRegion(on)}).elapsed_seconds.toFixed(2), '2.10');
  assert.equal(advanceSceneTransport(off, 0, 5.9, .2, {...STATE, loopRegion: markers.activeLoopRegion(off)}).elapsed_seconds.toFixed(2), '6.10');
});

test('XT15 (round 890): the frame\'s transport, its scene end and its saved-play notice read the brace through the Loop switch', () => {
  assert.match(app, /loopRegion:activeLoopRegion\(store\.document\)\};/, 'the transport steps with the brace that repeats');
  assert.match(app, /function playingSceneEnd\(\):number\|undefined\{if\(activeLoopRegion\(store\.document\)\)return undefined;/);
  assert.match(app, /loopPlayNotice\(journeyDurations\(doc\),playClockDurations\(true\),activeLoopRegion\(doc\)\)/);
});

test('XT15 (round 890): the frame draws a brace Loop does not repeat as off, kept where it stands', () => {
  assert.match(app, /data-loop-off="\$\{off\}"/, 'the brace says whether it repeats');
  assert.match(css, /\.journey-loop-brace\[data-loop-off="true"\]\{[^}]*opacity/);
});
