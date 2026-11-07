// O-I #747 round 890, XS02's proof by test ("Reopened after a restart, its scenes, settings and selection come back as they were saved,
// and the field says which of its live motion it could not bring back rather than passing a restart off as the moment I left"). The line
// was proved by reading app.ts (presented-chrome.test.mjs X4); here the frame's own decision runs: what a settled link says, given the
// address the shell kept beside the work across the relaunch, whether it applied, and what applying it refused.
// SCRIPTED: the frame's source bundled with the app's esbuild; app.ts read only for the one call that hands the decision its toast.
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
const out = mkdtempSync(join(tmpdir(), 'restart-line-890-'));
after(() => rmSync(out, {recursive: true, force: true}));
const outfile = join(out, 'deepLinks.mjs');
await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: ['src/deepLinks.ts'], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent'});
const links = await import(pathToFileURL(outfile).href);
const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');

const LINE = 'Reopened where it stood. Its live motion could not be brought back: the particles start again from the scene\'s configuration, because a save keeps the configuration, not where each particle was or how it was moving.';

test('XS02: a work reopened where it stood after a relaunch says what of its live motion could not come back', () => {
  assert.equal(typeof links.settledLinkNotes, 'function', 'the decision is the frame\'s own, and runs');
  assert.equal(links.REOPENED_MOTION_LINE, LINE);
  const asked = [];
  const settled = links.settledLinkNotes({address: {expression: 'expression:dawn', scene: 'expression:dawn:scene:noon', t: 7.5}, notes: []}, true,
    address => { asked.push(address); return []; });
  assert.deepEqual(asked, [{expression: 'expression:dawn', scene: 'expression:dawn:scene:noon', t: 7.5}], 'the kept address is applied: scene and time come back');
  assert.deepEqual(settled, {notes: [LINE], carried: true});
});

test('XS02: what applying the kept address refused comes first, then the line; the link\'s own refusals before both', () => {
  const settled = links.settledLinkNotes({address: {scene: 'expression:dawn:scene:gone'}, notes: ['The link\'s t "x" is not a time in seconds; it was ignored.']}, true,
    () => ['The scene "expression:dawn:scene:gone" is not in this Expression; it opened at its first scene.']);
  assert.deepEqual(settled.notes, ['The link\'s t "x" is not a time in seconds; it was ignored.',
    'The scene "expression:dawn:scene:gone" is not in this Expression; it opened at its first scene.', LINE]);
});

test('XS02: a plain load says nothing, and a work that did not settle where it stood never claims to have reopened there', () => {
  assert.deepEqual(links.settledLinkNotes({address: {}, notes: []}, true, () => assert.fail('nothing to apply')), {notes: [], carried: false});
  const unsettled = links.settledLinkNotes({address: {scene: 'expression:dawn:scene:noon'}, notes: []}, false, () => assert.fail('not applied'));
  assert.deepEqual(unsettled, {notes: [], carried: true}, 'the Expression did not settle: no address applied, no restart line');
  // A link whose only parameter was refused reopened nowhere in particular: its refusal is said, and no restart is passed off.
  const refusedOnly = links.settledLinkNotes({address: {}, notes: ['The link\'s scene "a b" is not a ref; it was ignored.']}, true, () => []);
  assert.deepEqual(refusedOnly, {notes: ['The link\'s scene "a b" is not a ref; it was ignored.'], carried: true});
});

test('XS02: the frame toasts what the decision says when its Expression settles (app.ts settleDeepLink)', () => {
  const settle = app.slice(app.indexOf('function settleDeepLink('), app.indexOf('function applyDeepLinkAddress('));
  assert.match(settle, /const \{notes,carried\}=settledLinkNotes\(link,applied,applyDeepLinkAddress\);\s*if\(notes\.length\)toast\(notes\.join\(' '\),8000\);/);
  assert.doesNotMatch(app, /function reopenedMotionLine\(/, 'one line, kept with its decision');
});
