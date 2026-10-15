import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createNativeTechneNavigator} from '../src/techne.ts';
import {
  ensureWikiStanding, getWikiProjectionState, requestWikiSelection, wikiProjectionOf,
} from '../../../desktop/cradle/src/techne/wikiProjectionStore.ts';
import {publishWikiNativeRegisters} from '../../../desktop/cradle/src/techne/wikiNativeExpression.ts';

// Ticket S (PATH §7): a selection request the Technē navigator takes is never dropped in silence. It is settled — opened (the
// owner focused the Scene and the host was told to open its Expression) or refused in the owner's words — or, when the stage
// was concealed or released while the open was in flight, it goes back to the seam for the stage presented next. Before this,
// a request taken and then superseded by a disconnect was consumed and its error swallowed (techne.ts drain, `connected && live`).
//
// Channel: SCRIPTED over fakes — the kernel transport is a fetch fake answering the owner ops the navigator and the projection
// store make (world_read, files_list, file_read, knowledge, expression list/open/edit) with the recorded 14 Oct Central wiki
// (packages/live-shell/ui/tests/fixtures/atlas-suite-reading.json); the host is a recorder. The real navigator, store and
// projection run unchanged. Not covered: the hosted frame (the panel's wiring settles the frame's own announcement).

const fixture = JSON.parse(await readFile(new URL('../../live-shell/ui/tests/fixtures/atlas-suite-reading.json', import.meta.url), 'utf8'));
const WIKI = {path: fixture.wikiFile.path, revision: fixture.wikiFile.revision, content: JSON.stringify({objects: fixture.wikiFile.objects})};
const LOCATION = {schema: 'central.path-ref/v1', ref: 'ref:wiki', root: 'Control', path: WIKI.path};
const transport = {kind: 'bridge', url: 'http://owner.test'};

/** The owner, faked at the transport: `gate` holds world_read until released, so a test can conceal the stage mid-open. */
function owner() {
  const ops = [];
  const documents = new Map();
  let gate = null;
  const ok = outcome => ({json: async () => ({ok: true, outcome})});
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body);
    ops.push(op.op + (op.request?.operation ? `:${op.request.operation}` : ''));
    if (op.op === 'world_read') {
      if (gate) await gate.promise;
      return ok({result: 'world_read', receipts: [], snapshot: {navigator: {root: {work: {projects: []}}}}});
    }
    if (op.op === 'files_list') return ok({result: 'directory_read', receipts: [], directory: {entries: [{name: 'wiki.json', location: LOCATION}]}});
    if (op.op === 'file_read') return ok({result: 'file_read', receipts: [], reading: {location: LOCATION, revision: WIKI.revision, content: WIKI.content}});
    if (op.op === 'knowledge') return ok({result: 'knowledge', receipts: [], data: {edges: []}});
    if (op.op === 'expression') {
      const request = op.request;
      if (request.operation === 'list') return ok({result: 'expression', receipts: [], data: {expressions: [...documents.values()].map(document => ({expression_ref: document.expression_ref}))}});
      if (request.operation === 'open') { documents.set(request.document.expression_ref, request.document); return ok({result: 'expression', receipts: [], data: {state: 'ready', document: request.document}}); }
      if (request.operation === 'inspect') return ok({result: 'expression', receipts: [], data: {state: 'ready', document: documents.get(request.expression_ref)}});
      if (request.operation === 'edit') {
        const current = documents.get(request.expression_ref), change = request.changes[0];
        const next = {...current, revision: current.revision + 1, selection: {...current.selection, scene_ref: change.scene_ref, entity_ref: change.entity_ref ?? null}};
        documents.set(next.expression_ref, next);
        return ok({result: 'expression', receipts: [], data: {state: 'ready', document: next}});
      }
    }
    return {json: async () => ({ok: false, error: `the fake owner does not answer ${op.op}`})};
  };
  return {
    ops,
    hold() { let release; gate = {promise: new Promise(resolve => { release = resolve; })}; gate.release = release; },
    release() { const held = gate; gate = null; held?.release(); },
  };
}

function host() {
  const opened = [];
  return {opened, bindingId: 'world.expressions', openExpression(ref, bindingId, options) { opened.push({ref, bindingId, ...options}); }, selectInstrument() {}};
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
async function until(check, label) {
  for (let i = 0; i < 400; i++) { if (check()) return; await settle(); }
  assert.fail(`never: ${label}`);
}

/** The Central register read through the owner fake, and one constellation Scene of its projection to ask for. */
async function centralScene() {
  publishWikiNativeRegisters([]);
  const standing = await ensureWikiStanding({key: 'central', title: 'Central'}, transport);
  const projection = wikiProjectionOf(standing);
  assert.ok(projection, 'the recorded Central wiki projects');
  const constellation = projection.constellations.find(row => row.sceneRef);
  assert.ok(constellation, 'the projection stands a constellation Scene');
  return {registerKey: 'central', sceneRef: constellation.sceneRef, entityRef: null, subjectRef: constellation.wholeRef ?? null, title: 'T', origin: 'external', lens: 'canvas'};
}

test('a taken request is settled: opened once the owner focused it and the host was told, with the owner basis', async () => {
  const fake = owner();
  const ask = await centralScene();
  const shown = host(), settled = [], errors = [];
  const navigator = createNativeTechneNavigator({transport, host: shown, isPresented: () => true, onError: reason => errors.push(reason), onSettled: row => settled.push(row)});
  const stop = navigator.connectSelectionRequests();
  requestWikiSelection(ask);
  await until(() => settled.length === 1, 'settled');
  stop(); navigator.dispose();
  assert.equal(settled[0].state, 'opened');
  assert.deepEqual([settled[0].request.registerKey, settled[0].request.sceneRef], [ask.registerKey, ask.sceneRef], 'the settlement names the request it ends');
  assert.equal(settled[0].open.scene_ref, ask.sceneRef, 'the owner focused the asked Scene');
  assert.deepEqual(shown.opened.map(row => [row.ref, row.refresh, row.lens]), [[settled[0].open.expression_ref, true, 'canvas']], 'the host was told to open that Expression, once');
  assert.deepEqual(errors, []);
  assert.equal(getWikiProjectionState().request, null, 'the seam is empty');
  assert.ok(fake.ops.includes('expression:edit'), 'the focus is the owner\'s edit');
});

test('a refused request is settled in the owner\'s words and reaches onError; nothing is posted again', async () => {
  owner();
  await centralScene();
  const settled = [], errors = [];
  const navigator = createNativeTechneNavigator({transport, host: host(), isPresented: () => true, onError: reason => errors.push(reason), onSettled: row => settled.push(row)});
  const stop = navigator.connectSelectionRequests();
  requestWikiSelection({registerKey: 'Nowhere', sceneRef: 'expression:x:scene:y', entityRef: null, subjectRef: null, origin: 'external'});
  await until(() => settled.length === 1, 'settled');
  stop(); navigator.dispose();
  assert.deepEqual([settled[0].state, settled[0].reason], ['refused', 'This Wiki register is not disclosed by the native World']);
  assert.deepEqual(errors, ['This Wiki register is not disclosed by the native World']);
  assert.equal(getWikiProjectionState().request, null, 'a refusal is final: the seam stays empty');
});

test('a request taken while presented, then concealed before its open finished, goes back to the seam for the next stage', async () => {
  const fake = owner();
  const ask = await centralScene();
  let presented = true;
  const first = host(), settled = [], errors = [];
  const navigator = createNativeTechneNavigator({transport, host: first, isPresented: () => presented, onError: reason => errors.push(reason), onSettled: row => settled.push(row)});
  const stop = navigator.connectSelectionRequests();
  fake.hold();
  requestWikiSelection(ask);
  await until(() => fake.ops.includes('world_read'), 'the open reached the owner');
  assert.equal(getWikiProjectionState().request, null, 'the request was taken');
  presented = false;
  fake.release();
  await until(() => getWikiProjectionState().request !== null, 'the request is back on the seam');
  const back = getWikiProjectionState().request;
  assert.deepEqual([back.registerKey, back.sceneRef, back.entityRef, back.lens, back.origin], [ask.registerKey, ask.sceneRef, null, 'canvas', 'external'], 'the same ask, posted again');
  assert.deepEqual([settled, errors, first.opened], [[], [], []], 'not settled, not a fault, nothing opened by the concealed stage');
  stop(); navigator.dispose();
  // The stage presented next takes it and opens it.
  const next = host(), later = [];
  const second = createNativeTechneNavigator({transport, host: next, isPresented: () => true, onSettled: row => later.push(row)});
  const stopNext = second.connectSelectionRequests();
  await until(() => later.length === 1, 'the next stage settled it');
  stopNext(); second.dispose();
  assert.equal(later[0].state, 'opened');
  assert.equal(next.opened.length, 1);
});

test('a stage released (disposed) mid-open returns the request too — and never over a newer ask', async () => {
  const fake = owner();
  const ask = await centralScene();
  const settled = [];
  const navigator = createNativeTechneNavigator({transport, host: host(), isPresented: () => true, onSettled: row => settled.push(row)});
  navigator.connectSelectionRequests();
  fake.hold();
  requestWikiSelection(ask);
  await until(() => fake.ops.includes('world_read'), 'the open reached the owner');
  navigator.dispose();
  fake.release();
  await until(() => getWikiProjectionState().request !== null, 'returned');
  assert.equal(getWikiProjectionState().request.sceneRef, ask.sceneRef);
  assert.deepEqual(settled, []);
  // Taken again and released again, while a newer ask stands: the newer one is kept.
  const again = createNativeTechneNavigator({transport, host: host(), isPresented: () => true});
  fake.hold();
  again.connectSelectionRequests();
  await until(() => getWikiProjectionState().request === null, 'taken again');
  requestWikiSelection({...ask, sceneRef: 'expression:newer:scene:newer'});
  again.dispose();
  fake.release();
  await settle(); await settle();
  assert.equal(getWikiProjectionState().request.sceneRef, 'expression:newer:scene:newer', 'the newer ask is not overwritten');
});
