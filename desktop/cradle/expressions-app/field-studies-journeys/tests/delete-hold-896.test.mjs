// O-I #747 round 896, 0R-surface.2 (DLW build ruling 2026-11-09, on the review of C99): Delete never drops edits the owner does not hold,
// whatever scene stands. Review 2 found C99's frame reported unsaved edits only while the field stood on a bound scene (`!!view&&!!binding`),
// so a fresh scene added and edited, not yet bound, read as clean, and Delete trashed the work with the edits in it; and the shell read the
// last announcement, which a change made without a render never refreshed.
// Now the frame reads the work itself (kernelComposition.ts workHoldsEdits; nativeWorkspace.ts unsavedWorks), the shell asks it afresh at
// the press (the stage command `delete-hold`, host.ts holdForDelete, the panel's frameDeleteHold, deleteWork), a frame that does not answer
// refuses the Delete in words, and from the ask until the owner answers the frame takes no edit of that work ("This work is being deleted.").
// Each link runs by behaviour: the frame's own modules answer the host's ask through the boundary's own channel (a message wire), and
// deleteWork runs over the panel's own door.
// SCRIPTED: the owner channel (the kernel's Delete) and the frame window's postMessage (the frame's real stage reader and Delete hold answer
// it, as app.ts does). REAL: the store, the kernel conversion, the composition read, the hold, the stage protocol, the host, the door, deleteWork.
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
const out = mkdtempSync(join(tmpdir(), 'delete-hold-896-'));
after(() => rmSync(out, {recursive: true, force: true}));
const entry = join(out, 'entry.ts');
writeFileSync(entry, [
  `export * as model from ${JSON.stringify(join(journeys, 'src/model.ts'))};`,
  `export {DocumentStore} from ${JSON.stringify(join(journeys, 'src/store.ts'))};`,
  `export {kernelDocumentToJourney} from ${JSON.stringify(join(journeys, 'src/kernelDocumentBridge.ts'))};`,
  `export {workHoldsEdits} from ${JSON.stringify(join(journeys, 'src/kernelComposition.ts'))};`,
  `export {deleteHold, unsavedWorks, DELETING_WORDS} from ${JSON.stringify(join(journeys, 'src/nativeWorkspace.ts'))};`,
  `export {readStageRequest, stageReplyMessage} from ${JSON.stringify(join(journeys, 'src/stageCommands.ts'))};`,
  `export {ExpressionsHost, CHANNEL_VERSION, readHostedState} from ${JSON.stringify(join(repo, 'packages/expressions-boundary/src/index.ts'))};`,
  `export {deleteWork, frameDeleteHold, UNSAVED_DELETE} from ${JSON.stringify(join(repo, 'packages/live-shell/ui/src/components/nativeExpressionCommands.ts'))};`,
].join('\n'));
const outfile = join(out, 'entry.mjs');
await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
  loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl', '.css': 'empty', '.html': 'text'}});
const M = await import(pathToFileURL(outfile).href);

const E = 'expression:hold-896', origin = 'http://127.0.0.1:8788';
const S = n => `${E}:scene:s${n}`;
/** The work as its owner holds it: one bound scene. */
function work() {
  const scene = M.model.blankScene('Dawn'); scene.id = S(1); scene.duration = 6;
  return M.kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 2, title: 'Holds', entities: {}, relations: {},
    scenes: [{scene_ref: scene.id, revision: 1, title: 'Dawn', entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}, triggers: []}],
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []});
}
/** The frame as app.ts runs it, from its own modules: the store over the work's journey, the report and the Delete's hold. */
function frame() {
  const view = work(), store = new M.DocumentStore(view.journey);
  const unsaved = () => M.unsavedWorks({view, transactionOpen: store.transactionOpen, busy: false, dirty: v => M.workHoldsEdits(v, store.document)});
  const deleting = M.deleteHold({presented: () => view.document.expression_ref, unsaved: () => unsaved().length > 0, hold: words => store.hold(words)});
  return {view, store, unsaved, deleting};
}
/** The new scene the person adds (app.ts 'new-scene': a blank scene spliced in, with no binding until its owner binds it), then edits. */
function addAndEditAScene(store) {
  store.change('New scene', doc => {const scene = M.model.blankScene('Dusk'); scene.id = 'scene-fresh'; doc.scenes.push(scene);});
  store.change('Rename scene', doc => {doc.scenes.at(-1).name = 'Dusk, edited';});
}

test('the frame reads unsaved edits from the work, so a fresh scene with no binding counts; the store holds the work while it is deleted', () => {
  const f = frame();
  assert.deepEqual(f.unsaved(), [], 'the work as its owner holds it: nothing unsaved');
  addAndEditAScene(f.store);
  assert.equal(f.view.bindings['scene-fresh'], undefined, 'the fresh scene has no binding');
  assert.deepEqual(f.unsaved(), [E], 'its edits are the work\'s, and are reported by the work');
  // The announced state carries them, and the boundary reads them as the frame said them.
  const state = M.readHostedState({hostMode: 'expressions', sceneIndex: 1, sceneCount: 2, unsavedWorks: f.unsaved()});
  assert.deepEqual(state?.unsavedWorks, [E]);
  assert.equal(M.readHostedState({hostMode: 'expressions', sceneIndex: 0, sceneCount: 1, unsavedWorks: ['dawn']}), null, 'only Expression refs');
  // The hold: from the ask, no edit, undo or redo is taken, in the field's words; released, edits are taken again.
  assert.equal(f.deleting.ask(E), true, 'asked afresh: the work holds edits');
  assert.throws(() => f.store.change('Rename', doc => {doc.name = 'x';}), {message: M.DELETING_WORDS});
  assert.throws(() => f.store.begin('Drag'), {message: M.DELETING_WORDS});
  assert.throws(() => f.store.undo(), {message: M.DELETING_WORDS});
  assert.throws(() => f.store.composite('Split', () => {}), {message: M.DELETING_WORDS});
  assert.equal(M.DELETING_WORDS, 'This work is being deleted.');
  f.deleting.release('expression:other');
  assert.throws(() => f.store.change('Rename', doc => {doc.name = 'x';}), {message: M.DELETING_WORDS}, 'another work\'s release lets nothing go');
  f.deleting.release(E);
  f.store.change('Rename', doc => {doc.name = 'Holds, again';});
  assert.equal(f.store.document.name, 'Holds, again');
});

/** A host over the frame's own answers: what the host posts to the frame window is read by the frame's stage reader and answered by its hold. */
function hosted(f, {answers = true} = {}) {
  const frameWindow = {postMessage(data) {
    queueMicrotask(async () => {
      const read = M.readStageRequest(data);
      if (!read || read.command.command !== 'delete-hold' || !answers) return;
      const command = read.command;
      const result = command.action === 'release' ? (f.deleting.release(command.expression_ref), {ok: true}) : {ok: true, unsaved: f.deleting.ask(command.expression_ref)};
      await host.handleMessage({source: frameWindow, origin, data: M.stageReplyMessage(read.req, result, command)});
    });
  }};
  const element = new EventTarget();
  element.src = `${origin}/__application/expressions/index.html`;
  element.contentWindow = frameWindow;
  element.closest = () => null;
  const host = new M.ExpressionsHost(element, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000,
    mode: 'expressions', isPresented: () => false});
  return {host, ready: () => host.handleMessage({source: frameWindow, origin, data: {v: M.CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'expressions', sceneIndex: 1, sceneCount: 2}}})};
}
const WORKS = [{expression_ref: E, title: 'Holds', revision: 2, open: true}];
const ownerAsked = [];
const ports = door => ({expression: async () => {throw Error('the owner channel carries no press');}, press: async request => {ownerAsked.push(request); return {state: 'deleted', expression_ref: E, title: 'Holds'}},
  refresh: async () => {}, deleted: () => {}, ...door});

test('by behaviour through every link: a fresh scene edited, then Delete is refused in words and the owner is never asked', async t => {
  const f = frame(), {host, ready} = hosted(f);
  t.after(() => host.dispose());
  await ready();
  addAndEditAScene(f.store);
  ownerAsked.length = 0;
  const refused = await M.deleteWork(ports(M.frameDeleteHold(() => host)), WORKS, E);
  assert.deepEqual(refused, {ok: false, error: `Holds holds changes in the field that are not saved. ${M.UNSAVED_DELETE}`});
  assert.deepEqual(ownerAsked, [], 'nothing is asked of the owner');
  await new Promise(resolve => setTimeout(resolve, 10));
  f.store.change('Rename', doc => {doc.name = 'kept';});
  assert.equal(f.store.document.name, 'kept', 'a refused Delete lets the work take edits again');
});

test('by behaviour: a clean work is held from the ask until the owner answers, and takes no edit meanwhile', async t => {
  const f = frame(), {host, ready} = hosted(f);
  t.after(() => host.dispose());
  await ready();
  ownerAsked.length = 0;
  let duringDelete = null;
  const done = await M.deleteWork({...ports(M.frameDeleteHold(() => host)), press: async request => {
    ownerAsked.push(request);
    try {f.store.change('A late edit', doc => {doc.name = 'late';}); duringDelete = 'taken';} catch (error) {duringDelete = error.message;}
    return {state: 'deleted', expression_ref: E, title: 'Holds'};
  }}, WORKS, E);
  assert.equal(done.ok, true);
  assert.equal(ownerAsked.length, 1, 'the owner is asked once');
  assert.equal(duringDelete, 'This work is being deleted.', 'an edit while the owner answers is refused in the field\'s words');
  assert.notEqual(f.store.document.name, 'late');
});

test('a frame that does not answer the ask refuses the Delete in words; with no frame mounted no draft holds edits', async t => {
  const f = frame(), {host, ready} = hosted(f, {answers: false});
  t.after(() => host.dispose());
  await ready();
  ownerAsked.length = 0;
  // The host waits DELETE_HOLD_TIMEOUT_MS (5 s) for the frame's answer.
  const refused = await M.deleteWork(ports(M.frameDeleteHold(() => host)), WORKS, E);
  assert.deepEqual(refused, {ok: false, error: 'Holds was not deleted: The field did not say whether this work holds unsaved changes (The application did not answer this stage command).'});
  assert.deepEqual(ownerAsked, [], 'nothing is asked of the owner');
  const none = await M.deleteWork(ports(M.frameDeleteHold(() => null)), WORKS, E);
  assert.equal(none.ok, true, 'no frame mounted: nothing here holds edits of it');
});
