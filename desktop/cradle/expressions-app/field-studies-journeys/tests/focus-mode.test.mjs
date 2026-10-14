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

test('entering focus asks for real fullscreen on the stage through the one shared request, and focus ends only through its hold', () => {
  const request = functionBody('requestStageFullscreen');
  assert.match(request, /document\.getElementById\('stage'\)/);
  assert.match(request, /requestStageFullscreenOn\(stage,\{navigationUI:'hide'\},hold\)/, 'the request is the shared path in focusMode.ts');
  assert.doesNotMatch(request, /requestFullscreen\(/, 'app.ts makes no direct fullscreen request of its own');
  assert.match(request, /lost:\(\)=>stopFocusMode\(\)/, 'focus ends through its hold: the browser leaving fullscreen, or another mode taking it over');
  assert.match(functionBody('startFocusMode'), /requestStageFullscreen\(\)/);
});

test('leaving the browser fullscreen ends focus once, through the shared hold; app.ts keeps no second fullscreenchange listener', () => {
  assert.doesNotMatch(appSource, /addEventListener\('fullscreenchange'/, 'the browser exit is listened to in focusMode.ts only');
  const focusModeSource = readFileSync(join(here, '../src/focusMode.ts'), 'utf8');
  assert.match(focusModeSource, /document\.addEventListener\('fullscreenchange', onFullscreenChange\);/);
  assert.match(focusModeSource, /if \(!current\?\.granted \|\| document\.fullscreenElement\) return;/, 'only a granted hold is ended by the browser exit');
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

// ---------------------------------------------------------------------------
// The one fullscreen path, scripted. A stub document and stub stage elements stand for the browser: the test settles each
// request, and fires the browser's fullscreenchange the way the browser fires it (the new state first, then the promise).
// Each test loads its own copy of focusMode.ts, so a held fullscreen never leaks from one test into the next.
// ---------------------------------------------------------------------------

const FOCUS_MODE_URL = new URL('../build/focusMode.js', import.meta.url).href;
let freshCopies = 0;
async function freshFocusMode() {
  freshCopies += 1;
  return import(`${FOCUS_MODE_URL}?copy=${freshCopies}`);
}

function stubDocument() {
  const listeners = [];
  const fire = () => {
    for (const listener of listeners) listener();
  };
  return {
    fullscreenElement: null,
    exits: 0,
    addEventListener(type, listener) {
      if (type === 'fullscreenchange') listeners.push(listener);
    },
    removeEventListener() {},
    exitFullscreen() {
      this.exits += 1;
      this.fullscreenElement = null;
      fire();
      return Promise.resolve();
    },
    /** The browser's own change, fired with the new state already set (its exit, or a fullscreen switch). */
    changed: fire,
  };
}

function stubStage(name) {
  const stage = {
    name,
    pending: [],
    requestFullscreen(options) {
      return new Promise((resolve, reject) => stage.pending.push({resolve, reject, options}));
    },
  };
  return stage;
}

/** The browser grants the oldest request on this stage: the change fires, then the request settles. */
function grant(doc, stage) {
  const request = stage.pending.shift();
  doc.fullscreenElement = stage;
  doc.changed();
  request.resolve();
}

function refuse(stage) {
  stage.pending.shift().reject(new TypeError('no user gesture'));
}

async function withStubDocument(run) {
  const doc = stubDocument();
  const previous = globalThis.document;
  globalThis.document = doc;
  try {
    await run(doc, await freshFocusMode());
  } finally {
    globalThis.document = previous;
  }
}

test('the reader focus hands the fullscreen to the Canvas present: the reader ends once, nothing exits, and the Canvas holds it', () =>
  withStubDocument(async (doc, m) => {
    const stage = stubStage('stage');
    const canvas = stubStage('canvas');
    let readerLost = 0;
    let presentLost = 0;
    const reader = {lost: () => { readerLost += 1; }};
    const present = {lost: () => { presentLost += 1; }};

    const readerRequest = m.requestStageFullscreenOn(stage, {navigationUI: 'hide'}, reader);
    grant(doc, stage);
    assert.equal(await readerRequest, true);

    const presentRequest = m.requestStageFullscreenOn(canvas, {}, present);
    assert.equal(readerLost, 1, 'the reader ends its own state before the Canvas asks for the fullscreen');
    assert.equal(doc.exits, 0, 'a handover is not an exit: the new request takes the fullscreen over');
    grant(doc, canvas);
    assert.equal(await presentRequest, true);
    assert.equal(doc.fullscreenElement, canvas);
    assert.equal(readerLost, 1, 'the reader is ended once, never again');
    assert.equal(presentLost, 0, 'the change the handover fired does not end the Canvas present');

    doc.fullscreenElement = null;
    doc.changed();
    assert.equal(presentLost, 1, 'the browser leaving the Canvas ends the Canvas present, once');
    assert.equal(readerLost, 1);
    m.releaseStageFullscreen(reader);
    assert.equal(doc.exits, 0, 'a mode that no longer holds the stage releases nothing');
  }));

test('a refused takeover keeps the reader focus in place, ends the Canvas present it displaced, and leaves no fullscreen unowned', () =>
  withStubDocument(async (doc, m) => {
    const stage = stubStage('stage');
    const canvas = stubStage('canvas');
    let readerLost = 0;
    let presentLost = 0;
    const reader = {lost: () => { readerLost += 1; }};
    const present = {lost: () => { presentLost += 1; }};

    const presentRequest = m.requestStageFullscreenOn(canvas, {}, present);
    grant(doc, canvas);
    assert.equal(await presentRequest, true);

    const readerRequest = m.requestStageFullscreenOn(stage, {navigationUI: 'hide'}, reader);
    assert.equal(presentLost, 1, 'the Canvas present ends when the reader takes the stage');
    refuse(stage);
    assert.equal(await readerRequest, false, 'a refused request resolves false');
    assert.equal(readerLost, 0, 'a refusal never ends the reader focus: it stands in place');
    assert.equal(doc.exits, 1, 'the fullscreen the Canvas left is exited, so none stands without an owner');
    assert.equal(doc.fullscreenElement, null);
    m.releaseStageFullscreen(reader);
    assert.equal(doc.exits, 1, 'nothing is held, so a later release is a no-op');
  }));

test('a fresh request the browser refuses holds nothing and ends nothing', () =>
  withStubDocument(async (doc, m) => {
    const stage = stubStage('stage');
    let readerLost = 0;
    const reader = {lost: () => { readerLost += 1; }};
    const request = m.requestStageFullscreenOn(stage, {navigationUI: 'hide'}, reader);
    refuse(stage);
    assert.equal(await request, false);
    assert.equal(readerLost, 0);
    assert.equal(doc.exits, 0);
  }));

test('the browser leaving a granted fullscreen ends that mode once; a later change ends nothing again', () =>
  withStubDocument(async (doc, m) => {
    const stage = stubStage('stage');
    let readerLost = 0;
    const reader = {lost: () => { readerLost += 1; }};
    const request = m.requestStageFullscreenOn(stage, {navigationUI: 'hide'}, reader);
    grant(doc, stage);
    assert.equal(await request, true);
    doc.fullscreenElement = null;
    doc.changed();
    assert.equal(readerLost, 1, 'the browser exit ends the reader focus');
    doc.changed();
    assert.equal(readerLost, 1, 'the hold is ended once');
    assert.equal(doc.exits, 0, 'the browser already left the fullscreen; nothing is exited again');
  }));

test('a grant that settles after its mode ended is released, never held', () =>
  withStubDocument(async (doc, m) => {
    const stage = stubStage('stage');
    let readerLost = 0;
    const reader = {lost: () => { readerLost += 1; }};
    const request = m.requestStageFullscreenOn(stage, {navigationUI: 'hide'}, reader);
    m.releaseStageFullscreen(reader);
    assert.equal(doc.exits, 0, 'nothing was granted when the mode ended');
    grant(doc, stage);
    assert.equal(await request, false, 'a late grant does not hold');
    assert.equal(doc.exits, 1, 'the late grant is released');
    assert.equal(doc.fullscreenElement, null);
    assert.equal(readerLost, 0, 'the mode ended itself; nothing ends it twice');
  }));

test('a mode taken over while its request is pending is ended, and its late grant never exits the mode that took over', () =>
  withStubDocument(async (doc, m) => {
    const stage = stubStage('stage');
    const canvas = stubStage('canvas');
    let readerLost = 0;
    let presentLost = 0;
    const reader = {lost: () => { readerLost += 1; }};
    const present = {lost: () => { presentLost += 1; }};

    const readerRequest = m.requestStageFullscreenOn(stage, {navigationUI: 'hide'}, reader);
    const presentRequest = m.requestStageFullscreenOn(canvas, {}, present);
    assert.equal(readerLost, 1, 'the pending reader is ended by the takeover');

    grant(doc, stage);
    assert.equal(await readerRequest, false, 'the reader grant settles after the takeover and is not held');
    assert.equal(doc.exits, 0, 'the Canvas request owns the stage: its grant is not exited');
    grant(doc, canvas);
    assert.equal(await presentRequest, true);
    assert.equal(doc.fullscreenElement, canvas);
    assert.equal(readerLost, 1);
    assert.equal(presentLost, 0);
  }));

test('an unnamed teardown (the Timeline stage) never exits the fullscreen a named mode holds', () =>
  withStubDocument(async (doc, m) => {
    const stage = stubStage('stage');
    const reader = {lost: () => {}};
    const request = m.requestStageFullscreenOn(stage, {navigationUI: 'hide'}, reader);
    grant(doc, stage);
    assert.equal(await request, true);
    m.releaseStageFullscreen();
    assert.equal(doc.exits, 0, 'the unnamed release leaves the reader fullscreen alone');
    assert.equal(doc.fullscreenElement, stage);
    m.releaseStageFullscreen(reader);
    assert.equal(doc.exits, 1, 'the named release leaves its own fullscreen');
  }));

// ---------------------------------------------------------------------------
// The Timeline stage (T24) on the same path. The stage's focus is the real createStageFocus (focusMode.ts); the stage and
// its chrome are stubs. The other modes (E23 and A8) are modelled by a hold that records its own `lost` call: their real
// callbacks live in app.ts and researchInstruments.tsx, which need a browser to load.
// ---------------------------------------------------------------------------

function stageFocusStubs(m) {
  const stage = Object.assign(stubStage('timeline'), {dataset: {}});
  const chrome = {style: {display: 'flex'}};
  const focus = m.createStageFocus({stage, chrome, markKey: 'timelineFocus'});
  return {stage, chrome, focus};
}

/** Lets the granted request's settlement run, so the grant is recorded as the browser's. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

function modelHold() {
  const state = {lost: 0};
  return {state, hold: {lost: () => { state.lost += 1; }}};
}

const OTHER_MODES = [['the reader focus (E23)', 'reader stage'], ['the Canvas present (A8)', 'canvas stage']];

test('the Timeline stage focus hides the chrome, marks the stage and asks for fullscreen; its end restores both and releases it', () =>
  withStubDocument(async (doc, m) => {
    const {stage, chrome, focus} = stageFocusStubs(m);
    focus.begin();
    assert.equal(focus.isFocused(), true);
    assert.equal(chrome.style.display, 'none', 'the tools are hidden');
    assert.equal(stage.dataset.timelineFocus, 'true', 'the stage is marked');
    assert.equal(stage.pending.length, 1, 'focus asks for fullscreen on the stage');
    focus.begin();
    assert.equal(stage.pending.length, 1, 'beginning while focused asks nothing more');
    grant(doc, stage);
    focus.end();
    assert.equal(focus.isFocused(), false);
    assert.equal(chrome.style.display, 'flex', 'the chrome it began from comes back');
    assert.equal(stage.dataset.timelineFocus, undefined, 'the mark is cleared');
    assert.equal(doc.exits, 1, 'its end releases the fullscreen it asked for');
    assert.equal(doc.fullscreenElement, null);
  }));

test('the browser leaving the Timeline stage fullscreen ends its focus once: the chrome returns and the mark clears', () =>
  withStubDocument(async (doc, m) => {
    const {stage, chrome, focus} = stageFocusStubs(m);
    focus.begin();
    grant(doc, stage);
    await settle();
    assert.equal(focus.isFocused(), true);
    doc.fullscreenElement = null;
    doc.changed();
    assert.equal(focus.isFocused(), false);
    assert.equal(chrome.style.display, 'flex');
    assert.equal(stage.dataset.timelineFocus, undefined);
    doc.changed();
    assert.equal(doc.exits, 0, 'the browser had already left; nothing is exited');
  }));

test('a Timeline stage grant that settles after its focus ended is released, never held', () =>
  withStubDocument(async (doc, m) => {
    const {stage, focus} = stageFocusStubs(m);
    focus.begin();
    focus.end();
    grant(doc, stage);
    await settle();
    assert.equal(doc.exits, 1, 'the late grant is released');
    assert.equal(doc.fullscreenElement, null);
    assert.equal(focus.isFocused(), false);
  }));

for (const [label, name] of OTHER_MODES) {
  test(`${label} taking the stage over ends the Timeline stage focus: the mark clears and the tools come back`, () =>
    withStubDocument(async (doc, m) => {
      const {stage, chrome, focus} = stageFocusStubs(m);
      const other = stubStage(name);
      const model = modelHold();
      focus.begin();
      grant(doc, stage);
      assert.equal(focus.isFocused(), true);

      const request = m.requestStageFullscreenOn(other, {navigationUI: 'hide'}, model.hold);
      assert.equal(focus.isFocused(), false, 'the Timeline stage focus ends when the other mode takes over');
      assert.equal(stage.dataset.timelineFocus, undefined, 'the mark clears');
      assert.equal(chrome.style.display, 'flex', 'the tools come back');
      assert.equal(doc.exits, 0, 'a takeover is not an exit');

      focus.end();
      assert.equal(doc.exits, 0, 'a stale end from the Timeline stage releases nothing the other mode holds');
      grant(doc, other);
      assert.equal(await request, true);
      assert.equal(doc.fullscreenElement, other);

      doc.fullscreenElement = null;
      doc.changed();
      assert.equal(model.state.lost, 1, `${label} is ended once by the browser leaving its fullscreen`);
    }));

  test(`the Timeline stage taking the stage over ends ${label}`, () =>
    withStubDocument(async (doc, m) => {
      const {stage, chrome, focus} = stageFocusStubs(m);
      const other = stubStage(name);
      const model = modelHold();
      const request = m.requestStageFullscreenOn(other, {navigationUI: 'hide'}, model.hold);
      grant(doc, other);
      assert.equal(await request, true);

      focus.begin();
      assert.equal(model.state.lost, 1, `${label} is ended by the Timeline stage's takeover`);
      assert.equal(chrome.style.display, 'none', 'the Timeline stage hides its chrome');
      assert.equal(stage.dataset.timelineFocus, 'true');
      assert.equal(doc.exits, 0, 'a takeover is not an exit');

      grant(doc, stage);
      assert.equal(focus.isFocused(), true);
      assert.equal(doc.fullscreenElement, stage);
      m.releaseStageFullscreen(model.hold);
      assert.equal(doc.exits, 0, 'the ended mode releases nothing the Timeline stage holds');
      assert.equal(doc.fullscreenElement, stage);
    }));
}
