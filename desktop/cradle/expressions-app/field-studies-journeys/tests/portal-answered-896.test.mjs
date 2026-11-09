// O-I #747 round 896, 0R-surface.5 and .8 (DLW build ruling 2026-11-09, on reviews 5 and 8).
//   .5: "Replace the regex pins with behavioural tests: … portal-placement-895." Its CODE-READING test read the Workbench's open of a portal's
//       source, App's carry of the portal, the panel's answer through the boundary host, and the frame's reading of the answer. They run here,
//       as one chain: the frame's own request (scenePortal.ts openScenePortal) reaches the boundary host (host.ts) over a message wire, the
//       shell answers it (native/hostedSummons.ts answerScenePortal), App holds the source for the Workbench (sourceIntents), the Workbench
//       opens it and places it (receiveSourceOpen, portalPlace.ts placeOpenedPortal over the pane engine), and the frame is answered with the
//       words of what its placement could not honour.
//   .8: "Every portal is answered. `portal.complete(reason)` is called on Workbench.tsx:770's early returns and when App.tsx:271's intent is
//       replaced. A second `complete` is a no-op. Red first, by behaviour." Round 895 returned from the Workbench's open with nothing said
//       when the Workbench was not shown or the request named no Central file, and App replaced a source it had not handed on yet: the frame
//       waited out its 90 s and said "Source placement was not acknowledged". Now each is answered in words, at once, and only once.
// REAL: the frame's openScenePortal, the boundary host, answerScenePortal, sourceIntents, receiveSourceOpen, placeOpenedPortal, the pane
// engine (desktop/cradle/src/surface/engine.ts). SCRIPTED: the frame's window and the shell's (two EventTargets joined by postMessage
// stubs), the trigger's resolution (the native Scene's portal: its target and placement), and the Workbench's detach and window doors.
// The panel's routing of the request (panels/expressions.tsx answerPortal), App's events and the frame's Info line stay pinned beside this
// in packages/live-shell/ui/tests/portal-placement-895.test.mjs. No wall clock: answers are awaited for a bounded number of turns.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const repo = join(journeys, '../../../..');
const out = mkdtempSync(join(tmpdir(), 'portal-answered-896-'));
after(() => rmSync(out, {recursive: true, force: true}));
const entry = join(out, 'entry.ts');
writeFileSync(entry, [
  `export {openScenePortal} from ${JSON.stringify(join(journeys, 'src/scenePortal.ts'))};`,
  `export {ExpressionsHost, CHANNEL_VERSION} from ${JSON.stringify(join(repo, 'packages/expressions-boundary/src/index.ts'))};`,
  `export {answerScenePortal, receiveSourceOpen, receiveSources, sourceIntents, sourceReceiverCount, watchSourceReceivers, SOURCE_HOLD_MS} from ${JSON.stringify(join(repo, 'packages/live-shell/ui/src/native/hostedSummons.ts'))};`,
  `export {placeOpenedPortal, PORTAL_WORDS} from ${JSON.stringify(join(repo, 'packages/live-shell/ui/src/native/portalPlace.ts'))};`,
  `export {openBinding, groupOf, groupsOf} from ${JSON.stringify(join(repo, 'desktop/cradle/src/surface/engine.ts'))};`,
].join('\n'));
const outfile = join(out, 'entry.mjs');
after(() => {delete globalThis.window;});
await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
  loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl', '.css': 'empty', '.html': 'text'}});
const M = await import(pathToFileURL(outfile).href);

const origin = 'http://127.0.0.1:8788', E = 'expression:made-of', TRIGGER = `${E}:trigger:p1`;
const BASIS = {expression_ref: E, revision: 4, scene_ref: `${E}:scene:central`};
const LOCATION = {schema: 'central.path-ref/v1', ref: 'central:file:notes/a.md', root: 'Control', path: 'notes/a.md'};
const turns = async (n = 50) => {for (let i = 0; i < n; i++) await new Promise(resolve => setImmediate(resolve));};
/** What the frame's ask came to, read from the moment it was asked. */
const track = promise => {const asked = {said: 'unanswered'}; void promise.then(note => {asked.said = {note};}, error => {asked.said = {error: error.message};}); return asked;};
/** The frame's answer once a bounded number of turns has passed, or 'unanswered'. */
const within = async asked => {await turns(); return asked.said;};

/** The shell's window, App, the Workbench and the frame, joined as the application joins them. */
function world({placement = 'overlay', presented = true, detach = async () => {}, redock = null, away = false} = {}) {
  const w = {faults: [], answers: [], reported: [], layout: {root: {type: 'group', id: 'g1', tabs: ['work'], pinned: [], active: 'work'}, surfaces: {work: {id: 'work', kind: 'projection', title: 'Expressions'}},
    closedStack: [], focusedGroupId: 'g1', agencyDepth: 'rest'}, handed: [], presented};
  // The frame's window: its parent is the shell's, and what the host posts to it arrives as the parent's message.
  const frame = new EventTarget();
  const contentWindow = {postMessage(data) {w.answers.push(data); queueMicrotask(() => {const event = new Event('message'); Object.defineProperties(event, {data: {value: data}, source: {value: frame.parent}, origin: {value: origin}}); frame.dispatchEvent(event);});}};
  frame.parent = {postMessage(data) {queueMicrotask(() => void w.host.handleMessage({source: contentWindow, origin, data}));}};
  frame.setTimeout = (fn, ms) => setTimeout(fn, ms); frame.clearTimeout = id => clearTimeout(id);
  // The browser's record of the frame's host: the frame posts to it there and hears it from there alone (round 896, 1R-surface.10).
  frame.location = {origin, ancestorOrigins: {length: 1, 0: origin}};
  const element = new EventTarget();
  element.src = `${origin}/__application/expressions/index.html`;
  element.contentWindow = contentWindow;
  element.closest = () => null;
  // App: the source held for the Workbench until it is shown (App.tsx SOURCE_PRESENT), then handed on.
  w.app = M.sourceIntents();
  // The Workbench over its pane tree (native/Workbench.tsx sourceOpen and placePortal).
  // As App hands it on (hostedSummons sourceIntents give: location, passage, note, portal), a source open names no project, and the file it
  // opened is held under none.
  const held = away ? {id: 'held', kind: 'file', title: 'a.md', ref: LOCATION.ref, location: LOCATION} : null;
  if (held) w.layout = {...w.layout, surfaces: {...w.layout.surfaces, held}, detached: [{surfaceId: 'held'}]};
  w.workbench = detail => M.receiveSourceOpen(detail, {presented: () => w.presented, capture: () => {},
    held: (ref, project) => held && held.location.ref === ref && held.project === project ? {binding: held, away: true} : null,
    insert: binding => {w.layout = M.openBinding(w.layout, binding);}, uuid: () => 'src', reveal: () => {}, report: cause => w.reported.push(String(cause)),
    place: (binding, place, isAway) => M.placeOpenedPortal(binding, place, isAway, {layout: () => w.layout, setLayout: change => {w.layout = change(w.layout);},
      workPane: () => 'work', detach, redock})});
  // App hands the held source to the Workbench's receiver, mounted for the hand-over (Workbench.tsx receiveSources; 1R-surface.9).
  w.hand = () => {const intent = w.pending; w.pending = null; const off = M.receiveSources(w.workbench); try {return w.app.give(intent);} finally {off();}};
  // The panel's answer to the frame's portal request (panels/expressions.tsx answerPortal), through the boundary host.
  w.host = new M.ExpressionsHost(element, {bindingId: 'world.expressions', owners: {channels: {}}, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000,
    mode: 'expressions', isPresented: () => true, onHostRequest: request => {
      if (request.request !== 'scene-portal') return;
      const at = w.host;
      void M.answerScenePortal(request, {transport: {kind: 'unavailable', reason: 'scripted'}, current: () => true, project: () => 'O-I',
        openFile: (location, carry) => {w.pending = w.app.hold({location, ...carry});},
        openKnowledge: () => {throw Error('not a knowledge page');}, fault: reason => w.faults.push(reason), clear: () => {},
        answer: (id, error, note) => at.answerScenePortal(id, error, note),
        resolvePortal: async () => ({target: {location: LOCATION, title: 'a.md'}, placement})});
    }});
  w.ready = () => w.host.handleMessage({source: contentWindow, origin, data: {v: M.CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'expressions', sceneIndex: 0, sceneCount: 1}}});
  // The frame asks, from its own module, with its own window (the frame's global for as long as its answer is awaited: one world at a time).
  w.ask = () => {globalThis.window = frame; return track(M.openScenePortal(TRIGGER, BASIS));};
  w.results = () => w.answers.filter(data => data.kind === 'scene-portal-result');
  return w;
}

test('a portal\'s place, through every link: the frame asks, the shell resolves and opens it, App holds it for the Workbench, the Workbench places it beside the work, and the frame is answered with what was not honoured', async t => {
  const w = world();
  t.after(() => w.host.dispose());
  await w.ready();
  const asked = w.ask();
  await turns();
  assert.equal(w.results().length, 0, 'not answered while App holds it: the Workbench has not placed it');
  w.hand();
  assert.deepEqual(await within(asked), {note: M.PORTAL_WORDS.overlay}, 'the frame says where it opened');
  assert.equal(w.layout.root.type, 'split');
  assert.deepEqual(w.layout.root.children.map(child => child.tabs), [['work'], ['src']], 'the source in its own pane on the right of the work\'s pane');
  assert.equal(M.groupOf(w.layout, 'work').active, 'work', 'the work still shown');
  assert.equal(w.results().length, 1);
});

test('Full fills the main area; Detached goes by the detach door, or opens as a tab and says why; Re-dock with no window owner is refused in words', async t => {
  const full = world({placement: 'full'});
  t.after(() => full.host.dispose());
  await full.ready();
  const fullAsked = full.ask(); await turns(); full.hand();
  assert.deepEqual(await within(fullAsked), {note: undefined});
  assert.equal(full.layout.maximizedGroupId, M.groupOf(full.layout, 'src').id);

  const detached = world({placement: 'detached', detach: async () => {throw Error('Detached native windows are unavailable in the development browser.');}});
  t.after(() => detached.host.dispose());
  await detached.ready();
  const detachedAsked = detached.ask(); await turns(); detached.hand();
  assert.deepEqual(await within(detachedAsked), {note: `${M.PORTAL_WORDS.asTab}: Detached native windows are unavailable in the development browser.`});

  const redock = world({placement: 're_dock', away: true});
  t.after(() => redock.host.dispose());
  await redock.ready();
  const redockAsked = redock.ask(); await turns(); redock.hand();
  assert.deepEqual(await within(redockAsked), {error: M.PORTAL_WORDS.noWindowOwner});
  assert.deepEqual(redock.faults, [M.PORTAL_WORDS.noWindowOwner], 'and named on the fault line');

  const elsewhere = world({placement: 'beside', away: true});
  t.after(() => elsewhere.host.dispose());
  await elsewhere.ready();
  const elsewhereAsked = elsewhere.ask(); await turns(); elsewhere.hand();
  assert.deepEqual(await within(elsewhereAsked), {note: M.PORTAL_WORDS.ownWindow}, 'a source in its own window is not opened twice');
});

test('0R-surface.8: the Workbench not shown answers the portal in words, at once', async t => {
  const w = world({presented: false});
  t.after(() => w.host.dispose());
  await w.ready();
  const asked = w.ask(); await turns(); w.hand();
  assert.deepEqual(await within(asked), {error: M.PORTAL_WORDS.notPresented});
  assert.deepEqual(w.faults, [M.PORTAL_WORDS.notPresented]);
  assert.deepEqual(w.layout.root.tabs, ['work'], 'nothing opened');
});

test('0R-surface.8: a source App had not handed on yet, replaced by a newer one, is answered in words; the newer one opens', async t => {
  const w = world();
  t.after(() => w.host.dispose());
  await w.ready();
  const first = w.ask(); await turns();
  const second = w.ask(); await turns();
  assert.deepEqual(await within(first), {error: M.PORTAL_WORDS.replaced}, 'the replaced source\'s portal is answered at once');
  w.hand();
  assert.deepEqual(await within(second), {note: M.PORTAL_WORDS.overlay});
  assert.equal(w.results().length, 2, 'each portal answered once');
});

test('0R-surface.8: a request naming no Central file answers its portal in words; a second complete is a no-op; a plain open with nothing to take says nothing', async t => {
  const answers = [];
  const portal = {place: 'beside', complete: (error, note) => answers.push([error ?? null, note ?? null])};
  const ports = {presented: () => true, capture: () => {}, held: () => null, insert: () => {throw Error('nothing to open')}, place: async () => undefined, reveal: () => {}, report: cause => answers.push(['reported', String(cause)]), uuid: () => 'src'};
  M.receiveSourceOpen({location: {schema: 'central.path-ref/v1', ref: 'central:file:x'}, portal}, ports);
  M.receiveSourceOpen({location: 'notes/a.md', portal}, ports);
  assert.deepEqual(answers, [[M.PORTAL_WORDS.noFile, null], [M.PORTAL_WORDS.noFile, null]]);
  answers.length = 0;
  M.receiveSourceOpen({location: 'notes/a.md'}, ports);
  M.receiveSourceOpen({location: LOCATION}, {...ports, presented: () => false});
  assert.deepEqual(answers, [], 'an open that carries no portal is left as before');

  // Through the shell's answer: whatever completes the portal twice, the frame is answered once.
  const w = world();
  t.after(() => w.host.dispose());
  await w.ready();
  let carried = null;
  w.workbench = detail => {carried = detail.portal;};
  const asked = w.ask(); await turns(); w.hand();
  carried.complete(undefined, 'placed');
  carried.complete('The window owner did not answer.');
  carried.complete(undefined, 'again');
  assert.deepEqual(await within(asked), {note: `${M.PORTAL_WORDS.overlay} placed`});
  await turns();
  assert.equal(w.results().length, 1, 'one answer reaches the frame');
  assert.deepEqual(w.faults, [], 'and no fault from a second complete');
});

test('1R-surface.9: a source handed before the Workbench is mounted waits for it; one never taken is answered at its deadline, and forgotten', () => {
  const timers = new Map(); let next = 0;
  const timer = {set: (run, ms) => {timers.set(++next, {run, ms}); return next;}, clear: id => {timers.delete(id);}};
  const fire = () => {for (const [id, {run}] of [...timers]) {timers.delete(id); run();}};
  const expired = [], answers = [];
  const portal = name => ({place: 'beside', complete: (error, note) => answers.push([name, error ?? null, note ?? null])});
  const app = M.sourceIntents({timer, expired: intent => expired.push(intent)});
  assert.equal(M.SOURCE_HOLD_MS, 10_000);
  // Before the Workbench is drawn: no receiver is mounted, and the source stays held.
  const first = app.hold({location: LOCATION, portal: portal('first')});
  assert.deepEqual([...timers.values()].map(t => t.ms), [M.SOURCE_HOLD_MS], 'held with a deadline');
  assert.equal(M.sourceReceiverCount(), 0);
  assert.equal(app.give(first), false, 'nothing takes it: it is not let go');
  assert.equal(app.held(), first);
  // The Workbench mounts: App is told (its hand-over runs again), and hands it once.
  const told = [], got = [];
  const unwatch = M.watchSourceReceivers(() => told.push(M.sourceReceiverCount()));
  const off = M.receiveSources(detail => got.push(detail));
  assert.deepEqual(told, [1]);
  assert.equal(app.give(first), true);
  assert.equal(got.length, 1);
  assert.equal(got[0].location, LOCATION);
  assert.equal(app.give(first), false, 'handed once');
  assert.equal(timers.size, 0, 'its deadline goes with it');
  assert.deepEqual(answers, [], 'the Workbench answers it, not the deadline');
  // A source the Workbench never takes: at its deadline its portal is told the Workbench was not shown, and App forgets it.
  off(); unwatch();
  assert.deepEqual(told, [1, 0]);
  const second = app.hold({location: LOCATION, portal: portal('second')});
  fire();
  assert.deepEqual(answers, [['second', M.PORTAL_WORDS.notPresented, null]]);
  assert.deepEqual(expired, [second]);
  assert.equal(app.held(), null);
  const late = M.receiveSources(detail => got.push(detail));
  assert.equal(app.give(second), false, 'answered, it never opens late');
  late();
  assert.equal(got.length, 1);
});
