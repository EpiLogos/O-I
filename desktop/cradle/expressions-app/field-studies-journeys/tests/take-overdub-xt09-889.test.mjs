// O-I #747 round 889, XT09 ("I lay a new take over a scene": §20.2 Transport, "Overdub | Lays a new take over the scene"; the manual's own
// pairing, "Take the swell, layer the next section over it"). With Overdub on (the frame's take mode `append`, Next section) an armed take
// lies over the scene from where the last take ended, and the last take stands before it; with Overdub off (`replace`) the take records the
// last take's own span again and nothing outside it. Either way the take keeps every property it does not move, and the scene grows to
// hold it. Where the take lies and how it is laid are the frame's own (propertyTracks.ts propertyTakeWindow and layPropertyTake), and the
// record-properties act and the finished take use them.
// SCRIPTED: the sources are bundled with the app's own esbuild; nothing is drawn or heard.
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
const out = mkdtempSync(join(tmpdir(), 'overdub-889-'));
after(() => rmSync(out, {recursive: true, force: true}));
const bundle = async (entry, name) => {
  const outfile = join(out, `${name}.mjs`);
  await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent'});
  return import(pathToFileURL(outfile).href);
};
const tracks = await bundle('src/propertyTracks.ts', 'propertyTracks');
const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');

test('XT09: Overdub lays the take from where the last one ended; Replace records the last take\'s span again', () => {
  assert.equal(typeof tracks.propertyTakeWindow, 'function', 'the frame says where a take lies');
  const last = {start: 2, end: 5};
  assert.deepEqual(tracks.propertyTakeWindow('append', last, 1), {start: 5});
  assert.deepEqual(tracks.propertyTakeWindow('replace', last, 1), {start: 2, limit: 3});
  // the scene's first take lies from where the scene stands, in either mode
  assert.deepEqual(tracks.propertyTakeWindow('append', undefined, 1.5), {start: 1.5});
  assert.deepEqual(tracks.propertyTakeWindow('replace', undefined, 1.5), {start: 1.5});
  // a scene is at most an hour long: a take that would start there is refused in words
  assert.deepEqual(tracks.propertyTakeWindow('append', {start: 0, end: 3600}, 0), {refused: 'This scene has reached its one-hour duration limit.'});
});

test('XT09: the new take lies over the scene: the last take stands before it, what it does not move stays, and the scene grows to hold it', () => {
  assert.equal(typeof tracks.layPropertyTake, 'function', 'the frame lays a finished take over its scene');
  const scene = {duration: 6, propertyTakeRange: {start: 0, end: 5}, propertyTracks: [
    {id: 'swell', bind: 'field.params.recovery', points: [{time: 0, value: 1}, {time: 5, value: 2}]},
    {id: 'speed', bind: 'field.params.speed', points: [{time: 0, value: 1}]}]};
  const take = [{id: 'next', bind: 'field.params.recovery', points: [{time: 5, value: 3}, {time: 9, value: 4}]}];
  const laid = tracks.layPropertyTake(scene, take, 5, 9);
  assert.deepEqual(laid.propertyTakeRange, {start: 5, end: 9});
  assert.equal(laid.duration, 9);
  assert.deepEqual(laid.propertyTracks[0].points, [{time: 0, value: 1}, {time: 5, value: 3}, {time: 9, value: 4}],
    'the swell stands before the next section, which lies over the scene from its last moment on');
  assert.deepEqual(laid.propertyTracks[1], scene.propertyTracks[1], 'a property the take does not move stays as it was');
  assert.equal(scene.propertyTracks[0].points.length, 2, 'the scene read is never changed in place');
  // Replace: the same span again, the moves before and after it kept
  const again = tracks.layPropertyTake(laid, [{id: 'redo', bind: 'field.params.recovery', points: [{time: 5, value: 7}, {time: 9, value: 8}]}], 5, 9);
  assert.deepEqual(again.propertyTracks[0].points, [{time: 0, value: 1}, {time: 5, value: 7}, {time: 9, value: 8}]);
  assert.equal(again.duration, 9);
});

test('XT09: the record-properties act and the finished take use the frame\'s own window and laying', () => {
  assert.match(app, /const lies=propertyTakeWindow\(appendTake\?'append':'replace',s\.propertyTakeRange\?\?takeWindows\.get\(s\.id\),sceneElapsed\);if\('refused' in lies\)\{toast\(lies\.refused\);break;\}/);
  assert.match(app, /changed\(\(\)=>\{Object\.assign\(scene\(\),layPropertyTake\(scene\(\),take\.tracks,take\.start,end\)\);\},true,'Record property take'\)/);
});
