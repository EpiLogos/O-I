// O-I #747 round 896, 0R-surface.2 (DLW build ruling 2026-11-09, on the review of C99): Delete never drops edits the owner does not hold,
// whatever scene stands. Review 2 found C99's frame reported unsaved edits only while the field stood on a bound scene (`!!view&&!!binding`),
// so a fresh scene added and edited, not yet bound, read as clean, and Delete trashed the work with the edits in it; and the shell read the
// last announcement, which a change made without a render never refreshed.
// Now the frame reads the work itself (kernelComposition.ts workHoldsEdits; nativeWorkspace.ts unsavedWorks), the shell asks it afresh at
// the press (the stage command `delete-hold`, host.ts holdForDelete, the panel's frameDeleteHold, deleteWork), a frame that does not answer
// refuses the Delete in words, and from the ask until the owner answers the frame takes no edit of that work ("This work is being deleted.").
// Each link runs by behaviour: the frame's own modules answer the host's ask through the boundary's own channel (a message wire), and
// deleteWork runs over the panel's own door.
// Round 896 1R (DLW build ruling 2026-11-09, on the review of C99b): one Delete at a time per work, the hold counting each ask by work and an
// answer letting one go (1R-surface.4); every path from the ask lets the hold go, a lost answer and a panel that throws included, and the
// ask answers for the presented work only (1R-surface.5); the frame's state carries no report of unsaved works (nothing read it); and app.ts
// passes every write of its store through one gate (takesEdit), its stage case through answerDeleteHold (the same functions run here).
// SCRIPTED: the owner channel (the kernel's Delete) and the frame window's postMessage (the frame's real stage reader and Delete hold answer
// it, as app.ts does). REAL: the store, the kernel conversion, the composition read, the hold, the stage protocol, the host, the door, deleteWork.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
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
  `export {deleteHold, unsavedWorks, takesEdit, answerDeleteHold, DELETING_WORDS} from ${JSON.stringify(join(journeys, 'src/nativeWorkspace.ts'))};`,
  `export {readStageRequest, stageReplyMessage} from ${JSON.stringify(join(journeys, 'src/stageCommands.ts'))};`,
  `export {ExpressionsHost, CHANNEL_VERSION, readHostedState} from ${JSON.stringify(join(repo, 'packages/expressions-boundary/src/index.ts'))};`,
  `export {deleteWork, frameDeleteHold, UNSAVED_DELETE, DELETE_IN_FLIGHT} from ${JSON.stringify(join(repo, 'packages/live-shell/ui/src/components/nativeExpressionCommands.ts'))};`,
].join('\n'));
const outfile = join(out, 'entry.mjs');
await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
  loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl', '.css': 'empty', '.html': 'text'}});
const M = await import(pathToFileURL(outfile).href);

const E = 'expression:hold-896', E2 = 'expression:other-896', origin = 'http://127.0.0.1:8788';
/** A document title as the shell's sentences quote it (1R-surface.8). */
const Q = name => `\u201C\u2068${name}\u2069\u201D`;
const settle = () => new Promise(resolve => setTimeout(resolve, 10));
/** An edit of the work, taken or refused in the store's words. */
const edit = store => {try {store.change('Rename', doc => {doc.name = `n${store.revision}`;}); return 'taken';} catch (error) {return error.message;}};
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
  // The frame's state carries no report of them (1R-surface.5): the shell asks at its press, and an old frame's report is passed over.
  assert.equal(M.readHostedState({hostMode: 'expressions', sceneIndex: 1, sceneCount: 2, unsavedWorks: f.unsaved()})?.unsavedWorks, undefined);
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
      // The frame's own answer to the stage command, as app.ts gives it.
      const result = M.answerDeleteHold(f.deleting, command, () => {});
      // 'lost': the frame took the ask and held the work, and its answer never reached the host.
      if (answers === 'lost' && command.action === 'ask') return;
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
  assert.deepEqual(refused, {ok: false, error: `${Q('Holds')} holds changes in the field that are not saved. ${M.UNSAVED_DELETE}`});
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
  assert.deepEqual(refused, {ok: false, error: `${Q('Holds')} was not deleted: The field did not say whether this work holds unsaved changes (The application did not answer this stage command).`});
  assert.deepEqual(ownerAsked, [], 'nothing is asked of the owner');
  const none = await M.deleteWork(ports(M.frameDeleteHold(() => null)), WORKS, E);
  assert.equal(none.ok, true, 'no frame mounted: nothing here holds edits of it');
});

test('1R-surface.4: the hold counts each Delete asked, by work: two works, and the same work twice', () => {
  let presented = E;
  const store = new M.DocumentStore(work().journey);
  const deleting = M.deleteHold({presented: () => presented, unsaved: () => false, hold: words => store.hold(words)});
  // Two works: A's Delete asked, then B's; B's answer lets nothing of A go.
  deleting.ask(E); deleting.ask(E2);
  assert.equal(edit(store), M.DELETING_WORDS, 'A, presented, is held while its Delete waits, though B\'s was asked after');
  deleting.release(E2);
  assert.equal(edit(store), M.DELETING_WORDS, 'B\'s answer lets nothing of A go');
  presented = E2; deleting.follow();
  assert.equal(edit(store), 'taken', 'B presented, its Delete answered: its edits are taken');
  presented = E; deleting.follow();
  assert.equal(edit(store), M.DELETING_WORDS, 'A presented again: still held');
  deleting.release(E);
  assert.equal(edit(store), 'taken');
  // The same work twice: the first answer lets one ask go, and the second still holds.
  deleting.ask(E); deleting.ask(E);
  assert.deepEqual(deleting.held(), [[E, 2]]);
  deleting.release(E);
  assert.equal(edit(store), M.DELETING_WORDS, 'the first answer leaves the second Delete\'s hold standing');
  deleting.release(E);
  assert.equal(edit(store), 'taken');
  deleting.release(E);
  assert.equal(edit(store), 'taken', 'an answer with no ask standing changes nothing');
  // A deleted work lets every ask of it go; its Delete's own release, after, finds none.
  deleting.ask(E); deleting.ask(E); deleting.deleted(E);
  assert.deepEqual(deleting.held(), []);
  assert.equal(edit(store), 'taken');
});

const WORKS2 = [{expression_ref: E, title: 'Holds', revision: 2, open: true}, {expression_ref: E2, title: 'Other', revision: 1, open: false}];
test('1R-surface.4: a second Delete of a work whose Delete waits is refused in words; another work\'s Delete goes on and lets nothing of the first go', {timeout: 20_000}, async t => {
  const f = frame(), {host, ready} = hosted(f);
  t.after(() => host.dispose());
  await ready();
  const asked = [];
  let answer;
  const waits = new Promise(resolve => {answer = resolve;});
  const door = {...ports(M.frameDeleteHold(() => host)), press: async request => {
    asked.push(request.expression_ref);
    if (request.expression_ref === E) await waits;
    return {state: 'deleted', expression_ref: request.expression_ref, title: request.expression_ref === E ? 'Holds' : 'Other'};
  }};
  const first = M.deleteWork(door, WORKS2, E);
  for (let i = 0; i < 100 && !asked.length; i++) await settle();
  assert.deepEqual(asked, [E], 'the first Delete reached the owner');
  assert.equal(edit(f.store), M.DELETING_WORDS, 'the work is held while its Delete waits');
  // Raced against a short wait: a second Delete that went on to the owner would wait there on the first one's answer.
  const again = await Promise.race([M.deleteWork(door, WORKS2, E), new Promise(resolve => setTimeout(() => resolve('the second Delete went on to the owner'), 500))]);
  assert.deepEqual(again, {ok: false, error: `${Q('Holds')} ${M.DELETE_IN_FLIGHT}`});
  assert.equal(M.DELETE_IN_FLIGHT, "is being deleted already: wait for Central's answer before you delete it again.");
  assert.deepEqual(asked, [E], 'the owner is not asked again');
  const other = await M.deleteWork(door, WORKS2, E2);
  assert.equal(other.ok, true, 'another work\'s Delete goes on');
  await settle();
  assert.equal(edit(f.store), M.DELETING_WORDS, 'and its answer lets nothing of the first go');
  answer();
  assert.equal((await first).ok, true);
  await settle();
  assert.equal(edit(f.store), 'taken', 'the first Delete answered: the hold is gone');
  assert.deepEqual(await M.deleteWork(door, WORKS2, E), {ok: false, error: `${Q('Holds')} holds changes in the field that are not saved. ${M.UNSAVED_DELETE}`},
    'answered, the work is asked of again (no longer in flight); here it holds the edit just taken');
});

test('1R-surface.5: an ask whose answer is lost still lets the frame\'s hold go (M5)', {timeout: 20_000}, async t => {
  const f = frame(), {host, ready} = hosted(f, {answers: 'lost'});
  t.after(() => host.dispose());
  await ready();
  ownerAsked.length = 0;
  const refused = await M.deleteWork(ports(M.frameDeleteHold(() => host)), WORKS, E);
  assert.deepEqual(refused, {ok: false, error: `${Q('Holds')} was not deleted: The field did not say whether this work holds unsaved changes (The application did not answer this stage command).`});
  assert.deepEqual(ownerAsked, []);
  await settle();
  assert.deepEqual(f.deleting.held(), [], 'the frame took the ask, and the release reached it');
  assert.equal(edit(f.store), 'taken');
});

test('1R-surface.5: the ask answers for the presented work only (M7)', () => {
  const f = frame();
  addAndEditAScene(f.store);
  assert.deepEqual(f.unsaved(), [E], 'the presented work holds edits');
  assert.equal(f.deleting.ask(E2), false, 'another work\'s Delete is not answered by the presented work\'s edits');
  assert.equal(edit(f.store), 'taken', 'nor holds the presented work');
  f.deleting.release(E2);
  assert.equal(f.deleting.ask(E), true);
  f.deleting.release(E);
});

test('1R-surface.5: a panel that throws on the deleted work leaves the Delete done, says so, and lets the hold go', async t => {
  const f = frame(), {host, ready} = hosted(f);
  t.after(() => host.dispose());
  await ready();
  const done = await M.deleteWork({...ports(M.frameDeleteHold(() => host)), deleted: () => {throw Error('the panel is gone');}}, WORKS, E);
  assert.equal(done.ok, true);
  assert.match(done.note, /The panel did not close it: the panel is gone$/);
  await settle();
  assert.deepEqual(f.deleting.held(), []);
  assert.equal(edit(f.store), 'taken');
});

test('the frame\'s held paths: every write of app.ts\'s store passes one gate, and its stage case is answerDeleteHold', () => {
  // The gate and the stage's answer, run (app.ts calls these and nothing else for them).
  const store = new M.DocumentStore(work().journey), said = [];
  assert.equal(M.takesEdit(store, words => said.push(words)), true);
  store.hold(M.DELETING_WORDS);
  assert.equal(M.takesEdit(store, words => said.push(words)), false);
  assert.deepEqual(said, [M.DELETING_WORDS], 'refused, the field says why');
  store.hold(null);
  const f = frame(), announced = [];
  assert.deepEqual(M.answerDeleteHold(f.deleting, {action: 'ask', expression_ref: E}, () => announced.push('ask')), {ok: true, unsaved: false});
  assert.equal(edit(f.store), M.DELETING_WORDS);
  assert.deepEqual(M.answerDeleteHold(f.deleting, {action: 'release', expression_ref: E}, () => announced.push('release')), {ok: true});
  assert.equal(edit(f.store), 'taken');
  assert.deepEqual(announced, ['ask', 'release'], 'the frame\'s state is announced after each');
  // CODE-READING, structural: app.ts with its comments blanked. Every write of the store (a change, a composite, a gesture's begin) lies in
  // one of the gated paths, each of which asks the gate first; opening a work (applyJourney) is not an edit of the held one.
  const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
  const writes = [...app.matchAll(/\bstore\.(begin|change|composite)\(/g)].map(m => {
    const before = app.slice(0, m.index), at = before.lastIndexOf('\nfunction ');
    return {write: m[1], in: /^\nfunction (\w+)/.exec(before.slice(at))?.[1]};
  });
  assert.deepEqual([...new Set(writes.map(w => w.in))].sort(), ['applyJourney', 'begun', 'changed', 'changedComposite', 'changedPresentation']);
  assert.equal(writes.length, 5, JSON.stringify(writes));
  assert.match(app, /function begun\(label:string\|undefined\):boolean\{if\(heldForDelete\(\)\)return false;store\.begin\(label\);return true;\}/);
  assert.match(app, /function changed\(fn:\(\)=>void,render:boolean,label:string\)\{if\(heldForDelete\(\)\)return;/);
  assert.match(app, /function changedPresentation\(label:string,fn:\(doc:Journey\)=>void\)\{\n if\(heldForDelete\(\)\)return;/);
  assert.match(app, /function changedComposite\(label:string,fn:\(doc:Journey\)=>void,after\?:\(\)=>void\)\{\n if\(heldForDelete\(\)\)return;/);
  assert.match(app, /function heldForDelete\(\):boolean\{return !takesEdit\(store,words=>toast\(words,4000\)\);\}/);
  assert.match(app, /function saveWorkspace\(\)\{\s*changedPresentation\('Update toolbelt',/, 'the toolbelt\'s change is an edit, through the gate (1R-surface.9)');
  assert.equal((app.match(/\bbegun\(/g) ?? []).length, 6, 'the five gestures that begin an edit, and begun itself');
  assert.match(app, /case 'delete-hold':return answerDeleteHold\(deleting,command,announceHostState\);/);
  assert.match(app, /function closeDeletedExpression\(ref:string,words:string\)\{\n deleting\.deleted\(ref\);/);
  assert.doesNotMatch(app, /unsavedWorks:/, 'the frame\'s state carries no report of unsaved works');
});
