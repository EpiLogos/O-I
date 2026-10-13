// lane-3 E23: reader fullscreen and focus mode.
// The pure layout model (snapshot on entry, exact restore on exit) and the app's wiring: focus is the
// presenting mode, fullscreen is requested on the stage and a refusal keeps focus, no timer hides chrome.
// Run after `npm run build:journeys` (this suite imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {NOT_FOCUSED, beginFocus, endFocus, focusedLayout, isFocused} from '../build/focusMode.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const appSource = readFileSync(join(here, '../src/app.ts'), 'utf8');
const stylesSource = readFileSync(join(here, '../src/styles.css'), 'utf8');

function functionBody(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `app.ts declares ${name}`);
  const rest = appSource.slice(start + 1);
  const next = rest.search(/\n(?:function |\/\*\*|document\.addEventListener|const |let |window\.)/);
  return next < 0 ? rest : rest.slice(0, next);
}

// A working layout: a sequence panel open, the studio editing one object, the transient panels open.
const WORKING = Object.freeze({
  sequenceOpen: true,
  beltOpen: true,
  timelineOpen: true,
  inspectorOpen: true,
  editing: true,
  contextKind: 'objects',
  beltPickerOpen: true,
  shapePickerOpen: true,
  modesOpen: false,
  captureOpen: true,
  tool: 'select',
  cursorTool: 'select',
  selected: Object.freeze(['entity-1', 'entity-2']),
});

test('no focus is active until one begins; a fresh session is not focused', () => {
  assert.equal(isFocused(NOT_FOCUSED), false);
  assert.equal(isFocused(beginFocus(NOT_FOCUSED, WORKING)), true);
});

test('exit restores the exact layout that entry found, including the selection', () => {
  const begun = beginFocus(NOT_FOCUSED, WORKING);
  const ended = endFocus(begun);
  assert.deepEqual(ended.restore, WORKING);
  assert.equal(isFocused(ended.session), false);
});

test('the snapshot is a copy: changing the source layout afterwards does not change what exit restores', () => {
  const source = {...WORKING, selected: ['entity-1']};
  const begun = beginFocus(NOT_FOCUSED, source);
  source.selected.push('entity-9');
  source.contextKind = 'text';
  const {restore} = endFocus(begun);
  assert.deepEqual(restore.selected, ['entity-1']);
  assert.equal(restore.contextKind, 'objects');
  assert.notEqual(restore.selected, source.selected);
});

test('beginning while focused keeps the first snapshot', () => {
  const first = beginFocus(NOT_FOCUSED, WORKING);
  const second = beginFocus(first, {...WORKING, sequenceOpen: false, selected: []});
  assert.equal(second, first);
  assert.deepEqual(endFocus(second).restore, WORKING);
});

test('ending when not focused restores nothing and stays not focused', () => {
  const ended = endFocus(NOT_FOCUSED);
  assert.equal(ended.restore, null);
  assert.equal(isFocused(ended.session), false);
});

test('focus closes the working panels and the selection, and keeps the panel flags for exit to restore', () => {
  const focused = focusedLayout(WORKING);
  assert.equal(focused.contextKind, '');
  assert.equal(focused.beltPickerOpen, false);
  assert.equal(focused.shapePickerOpen, false);
  assert.equal(focused.modesOpen, false);
  assert.equal(focused.captureOpen, false);
  assert.deepEqual(focused.selected, []);
  // The stylesheet hides these while focused; they are not changed here, so exit returns them as they were.
  assert.equal(focused.sequenceOpen, true);
  assert.equal(focused.inspectorOpen, true);
  assert.equal(focused.timelineOpen, true);
  assert.equal(focused.editing, true);
  assert.equal(focused.tool, 'select');
});

test('a focus session round trip returns the layout focus found, after the layout was changed while focused', () => {
  const begun = beginFocus(NOT_FOCUSED, WORKING);
  const whileFocused = focusedLayout(WORKING);
  assert.notDeepEqual(whileFocused, WORKING);
  const {session, restore} = endFocus(begun);
  assert.deepEqual(restore, WORKING);
  assert.equal(session.prior, null);
});

test('the presenting mode is one mode: focus is the existing present action, extended and not duplicated', () => {
  assert.match(appSource, /case 'present':startFocusMode\(\);break;/);
  assert.match(appSource, /case 'exit-present':stopFocusMode\(\);break;/);
  assert.match(appSource, /f:presenting\?'exit-present':'present'/, 'F still toggles the same mode');
  assert.match(appSource, /if\(presenting\)\{stopFocusMode\(\);\}/, 'Escape still leaves the same mode');
  assert.doesNotMatch(appSource, /case 'present':presenting=true/, 'the bare flag write is gone');
});

test('entering focus asks the browser for real fullscreen on the stage, and a refusal keeps focus in place', () => {
  const request = functionBody('requestStageFullscreen');
  assert.match(request, /document\.getElementById\('stage'\)/);
  assert.match(request, /requestFullscreen\(\{navigationUI:'hide'\}\)/);
  assert.match(request, /try\{/, 'a request the browser throws is caught');
  assert.match(request, /\(\)=>\{\/\* refused/, 'a rejected request has a handler and does not end focus');
  assert.doesNotMatch(request, /stopFocusMode\(\)/, 'a refusal never ends focus');
  assert.match(functionBody('startFocusMode'), /requestStageFullscreen\(\)/);
});

test('leaving the browser fullscreen ends focus; only a fullscreen focus asked for ends it', () => {
  assert.match(appSource, /document\.addEventListener\('fullscreenchange',\(\)=>\{if\(fullscreenGranted&&!document\.fullscreenElement\)stopFocusMode\(\);\}\);/);
});

test('exit from focus restores the saved layout and releases the fullscreen it asked for', () => {
  const stop = functionBody('stopFocusMode');
  assert.match(stop, /endFocus\(focusSession\)/);
  assert.match(stop, /writeFocusLayout\(ended\.restore\)/);
  assert.match(stop, /leaveFullscreen\(\)/);
});

test('focus never hides chrome on a timer: no timers run in the focus code', () => {
  for (const name of ['startFocusMode', 'stopFocusMode', 'dropFocusMode', 'requestStageFullscreen', 'leaveFullscreen', 'readFocusLayout', 'writeFocusLayout']) {
    assert.doesNotMatch(functionBody(name), /setTimeout|setInterval|requestAnimationFrame/, `${name} has no timer`);
  }
});

test('the chrome hidden by focus is the stylesheet presenting rules, and the exit control stays visible', () => {
  assert.match(stylesSource, /\.presentation \.chrome/);
  assert.match(stylesSource, /\.presentation \.present-return\{display:flex!important\}/);
  assert.match(stylesSource, /#stage:fullscreen\{width:100vw;height:100vh;background:var\(--paper\)\}/);
});

test('an Escape that leaves a browser fullscreen does not also close the editor beneath', () => {
  assert.match(appSource, /if\(ev\.key==='Escape'&&performance\.now\(\)-focusExitedAt<400\)\{ev\.preventDefault\(\);return;\}/);
});
