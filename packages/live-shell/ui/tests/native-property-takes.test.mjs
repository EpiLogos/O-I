import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production sources in memory through the sibling loader: .ts/.tsx is transpiled, .css is a non-executing stub.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url);

const app = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root);
const boundary = new URL('packages/expressions-boundary/src/', root);
const [frame, hostModule, protocol, trackEdits, model, {DocumentStore}, {kernelDocumentToJourney}, {prepareCompositionEdit}, {createRetainedNativeEditor}, parameters, takesLogic, takesView] = await Promise.all([
  import(new URL('stageCommands.ts', app)),
  import(new URL('host.ts', boundary)),
  import(new URL('protocol.ts', boundary)),
  import(new URL('nativeTrackEdits.ts', boundary)),
  import(new URL('model.ts', app)),
  import(new URL('store.ts', app)),
  import(new URL('kernelDocumentBridge.ts', app)),
  import(new URL('kernelComposition.ts', app)),
  import(new URL('hostEditor.ts', app)),
  import(new URL('parameters.ts', boundary)),
  import('../src/native/frameTakes.ts'),
  import('../src/components/NativeTakes.tsx'),
]);
const appSource = await readFile(new URL('app.ts', app), 'utf8');
const hostEditorSource = await readFile(new URL('hostEditor.ts', app), 'utf8');
const {ExpressionsHost} = hostModule;
const {CHANNEL_VERSION, OPEN_STUDIO_COMMAND, readHostedState} = protocol;
const {applyNativeTrackChanges, readNativeTakeTracks, validateNativeTrackChange} = trackEdits;
const origin = 'http://127.0.0.1:8788';
const READY_STATE = {hostMode: 'expressions', sceneCount: 1,
  document: {id: 'expression:kept', name: 'Kept work'}, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}};
const READY = {v: CHANNEL_VERSION, kind: 'oi-app-state', state: READY_STATE};
const BIND_KEY = parameters.NATIVE_BINDINGS[0].key;
const BIND = 'field.params.' + BIND_KEY;
const LABEL = parameters.NATIVE_BINDINGS[0].label;
const BIND2 = 'field.params.' + parameters.NATIVE_BINDINGS[1].key;
const track = (id, bind, points, entityId) => ({id, bind, ...(entityId === undefined ? {} : {entityId}), points});
const readingWith = tracks => ({basis: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one', authored_revision: 1},
  scene: {id: 'scene-one', name: 'One', propertyTracks: tracks, entities: []}, standing: {pending: false, dirty: false, notice: null}});
const noop = async () => ({ok: true});

/** The real ExpressionsHost over a stubbed frame: every posted message is recorded. */
function aperture(t) {
  const sent = [];
  const frameTarget = new EventTarget();
  frameTarget.src = `${origin}/__application/expressions/index.html`;
  frameTarget.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); sent.push(data);}};
  frameTarget.closest = () => null;
  const host = new ExpressionsHost(frameTarget, {bindingId: 'world.expressions', owners: {channels: {}}, messageTarget: new EventTarget(), handshakeTimeoutMs: 60000, isPresented: () => true});
  t.after(() => host.dispose());
  const deliver = data => host.handleMessage({source: frameTarget.contentWindow, origin, data});
  const stageMessages = () => sent.filter(data => data.kind === 'host-command' && data.command !== OPEN_STUDIO_COMMAND);
  return {host, deliver, sent, stageMessages};
}

test('the track-remove edit is one closed shape, and a removal is validated and atomic', () => {
  assert.deepEqual(validateNativeTrackChange({kind: 'track-remove', track_id: 'take-a'}), {kind: 'track-remove', track_id: 'take-a'});
  for (const bad of [null, 'track-remove', [], {kind: 'track-add', track_id: 'x'}, {kind: 'track-remove'}, {kind: 'track-remove', track_id: ''},
    {kind: 'track-remove', track_id: 'x'.repeat(201)}, {kind: 'track-remove', track_id: 'a', points: []}, {kind: 'track-remove', track_id: 1}])
    assert.throws(() => validateNativeTrackChange(bad), /admitted property track edit|recorded property track/, JSON.stringify(bad));

  const journey = model.blankJourney();
  journey.scenes[0].propertyTracks = [track('take-a', BIND, [{time: 0, value: 1}, {time: 1, value: 2}]), track('take-b', BIND2, [{time: 0, value: 3}, {time: 2, value: 3}])];
  const before = structuredClone(journey);
  const after = applyNativeTrackChanges(journey, journey.scenes[0].id, [{kind: 'track-remove', track_id: 'take-a'}]);
  assert.deepEqual(after.scenes[0].propertyTracks.map(row => row.id), ['take-b'], 'exactly the named track is removed');
  assert.deepEqual(journey, before, 'the caller document is untouched');
  assert.throws(() => applyNativeTrackChanges(journey, journey.scenes[0].id, [{kind: 'track-remove', track_id: 'missing'}]), /no longer belongs to this Scene/);
  assert.throws(() => applyNativeTrackChanges(journey, 'no-such-scene', [{kind: 'track-remove', track_id: 'take-a'}]), /no longer in this Expression/);
  assert.throws(() => applyNativeTrackChanges(journey, journey.scenes[0].id, []), /between 1 and 64/);
  assert.throws(() => applyNativeTrackChanges(journey, journey.scenes[0].id, [{kind: 'track-remove', track_id: 'take-a'}, {kind: 'track-remove', track_id: 'take-a'}]),
    /no longer belongs/, 'a second removal of the same track in one batch is refused');
  assert.throws(() => applyNativeTrackChanges(journey, journey.scenes[0].id, [{kind: 'track-remove', track_id: 'take-b'}, {kind: 'track-remove', track_id: 'missing'}]),
    /no longer belongs/, 'a refused batch changes nothing, including its valid first removal');
  assert.deepEqual(journey, before);
});

test('the reading names each recorded track by its binding and carries its own keyframes', () => {
  const journey = model.blankJourney();
  const scene = journey.scenes[0];
  scene.propertyTracks = [track('take-a', BIND, [{time: 0, value: 1}, {time: 1.5, value: 2}])];
  const [row] = readNativeTakeTracks(scene);
  assert.deepEqual([row.id, row.bind, row.entity_id, row.label, row.point_count, row.start, row.end, row.duration], ['take-a', BIND, null, LABEL, 2, 0, 1.5, 1.5]);
  assert.deepEqual(row.points, [{time: 0, value: 1}, {time: 1.5, value: 2}]);
  assert.deepEqual(readNativeTakeTracks(model.blankJourney().scenes[0]), [], 'a Scene without takes reads as none');
});

test('a take round-trips: the reading carries the tracks, the composition material carries them, and one removal commits one gesture', async () => {
  const receiptPath = process.env.OI_NATIVE_COMPOSITION_RECEIPT ?? '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
  const nativeDocument = JSON.parse(await readFile(receiptPath, 'utf8')).after.document;
  const view = kernelDocumentToJourney(nativeDocument);
  const store = new DocumentStore(view.journey);
  const scene = store.document.scenes.find(item => item.id === view.startSceneId) ?? store.document.scenes[0];
  store.change(() => {
    store.document.scenes.find(item => item.id === scene.id).propertyTracks = [track('take-a', BIND, [{time: 0, value: 0.25}, {time: 2, value: 0.75}]), track('take-b', BIND2, [{time: 0, value: 1}, {time: 2, value: 1}])];
  });
  let committed = 0;
  const owner = createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
    nativeSelect: () => {throw Error('closed')}, commit: async () => {committed++; return true}, change: mutate => store.change(mutate), afterHistory: () => {throw Error('closed')},
    selectLocal: () => {throw Error('closed')}, openEditor: () => {throw Error('closed')}, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false});
  assert.deepEqual(owner.read().scene.propertyTracks.map(row => row.id), ['take-a', 'take-b'], 'the reading carries the recorded tracks');
  const materialOf = () => prepareCompositionEdit(view, store.document, {sceneId: scene.id}).changes
    .find(change => change.change === 'scene_material_set' && change.scene_ref === view.bindings[scene.id]?.scene_ref);
  assert.deepEqual(materialOf().presentation.scene.propertyTracks, store.document.scenes.find(item => item.id === scene.id).propertyTracks,
    'the composition material carries every track, unchanged');
  await owner.apply({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'track-remove', track_id: 'take-a'}]});
  assert.equal(committed, 1, 'one gesture, one commit');
  assert.deepEqual(owner.read().scene.propertyTracks.map(row => row.id), ['take-b']);
  assert.deepEqual(materialOf().presentation.scene.propertyTracks.map(row => row.id), ['take-b'], 'the committed material no longer carries the removed track');
  assert.match(hostEditorSource, /kind\.startsWith\('track-'\)\?'track'/, 'track-remove has its own family, never the glyph default');
  assert.match(hostEditorSource, /type==='track'\?applyNativeTrackChanges\(next,scene\.id,changes as NativeTrackChange\[\]\)/);
});

test('take and tracks are closed commands, and every valid one reads back to itself', () => {
  assert.deepEqual(frame.STAGE_TAKE_MODES, ['append', 'replace']);
  assert.deepEqual(frame.STAGE_TRACK_ACTIONS, ['preview', 'stop-preview']);
  assert.ok(frame.STAGE_COMMANDS.includes('take') && frame.STAGE_COMMANDS.includes('tracks'));
  const valid = [{command: 'take', action: 'start', mode: 'append'}, {command: 'take', action: 'start', mode: 'replace'}, {command: 'take', action: 'stop'},
    {command: 'tracks', action: 'preview'}, {command: 'tracks', action: 'stop-preview'}];
  for (const command of valid) {
    const message = frame.stageRequestMessage(3, command);
    assert.ok(message, JSON.stringify(command));
    assert.deepEqual(frame.readStageRequest(message), {req: 3, command}, JSON.stringify(command));
  }
  assert.deepEqual(frame.stageRequestMessage(3, valid[0]), {v: 1, kind: 'host-command', req: 3, command: 'take', action: 'start', mode: 'append'});
  assert.deepEqual(frame.stageRequestMessage(3, valid[2]), {v: 1, kind: 'host-command', req: 3, command: 'take', action: 'stop'});
});

test('the frame reader refuses every take and tracks value outside the closed vocabulary', () => {
  const base = {v: 1, kind: 'host-command', req: 1};
  const bad = [
    {...base, command: 'take'}, {...base, command: 'take', action: 'start'}, {...base, command: 'take', action: 'start', mode: 'both'},
    {...base, command: 'take', action: 'start', mode: 'constructor'}, {...base, command: 'take', action: 'start', mode: 'append', extra: 1},
    {...base, command: 'take', action: 'stop', mode: 'append'}, {...base, command: 'take', action: 'pause'}, {...base, command: 'take', action: '__proto__'},
    {...base, command: 'tracks'}, {...base, command: 'tracks', action: 'start'}, {...base, command: 'tracks', action: 'preview', mode: 'append'},
    {...base, command: 'tracks', action: 'preview', track: 'take-a'}, {...base, command: 'tracks', action: '__proto__'},
  ];
  for (const message of bad) assert.equal(frame.readStageRequest(message), null, JSON.stringify(message));
  assert.equal(frame.stageRequestMessage(1, {command: 'take', action: 'start', mode: 'both'}), null);
  assert.equal(frame.stageRequestMessage(1, {command: 'take', action: 'stop', mode: 'append'}), null);
  assert.equal(frame.stageRequestMessage(1, {command: 'tracks', action: 'delete'}), null);
});

test('the host posts take and track commands with their request ids, and settles on the frame answer', async t => {
  const a = aperture(t);
  await a.deliver(READY);
  const start = a.host.stageCommand(takesLogic.takeStart('append'));
  assert.deepEqual(a.stageMessages(), [{v: 1, kind: 'host-command', req: 1, command: 'take', action: 'start', mode: 'append'}]);
  await a.deliver({v: 1, kind: 'host-command-result', command: 'take', req: 1, ok: false, error: 'A property take is already recording.'});
  assert.deepEqual(await start, {ok: false, error: 'A property take is already recording.'}, 'the frame refusal reaches the shell');
  const stop = a.host.stageCommand(takesLogic.takeStop);
  await a.deliver({v: 1, kind: 'host-command-result', command: 'take', req: 2, ok: true});
  assert.deepEqual(await stop, {ok: true});
  const preview = a.host.stageCommand(takesLogic.tracksPreview(true));
  assert.deepEqual(a.stageMessages()[2], {v: 1, kind: 'host-command', req: 3, command: 'tracks', action: 'preview'});
  await a.deliver({v: 1, kind: 'host-command-result', command: 'tracks', req: 3, ok: true});
  assert.deepEqual(await preview, {ok: true});
  assert.throws(() => a.host.stageCommand({command: 'take', action: 'start'}), /Unknown Expressions stage command/, 'start without a mode is refused unposted');
  assert.equal(a.stageMessages().length, 3);
});

test('the hosted state carries the take readings and refuses malformed ones, and the silent video reading stays separate', () => {
  const state = readHostedState({...READY_STATE, propertyRecording: true, propertyPreview: false, takeMode: 'append'});
  assert.deepEqual([state.propertyRecording, state.propertyPreview, state.takeMode, state.recording], [true, false, 'append', undefined]);
  assert.equal(readHostedState({...READY_STATE, takeMode: 'both'}), null);
  assert.equal(readHostedState({...READY_STATE, propertyRecording: 'yes'}), null);
  assert.equal(readHostedState({...READY_STATE, propertyPreview: 1}), null);
  assert.equal(readHostedState(READY_STATE).takeMode, undefined, 'a state without the reading does not invent one');
});

test('the frame answers take and tracks through the application bodies, refusing with the application messages', () => {
  assert.match(appSource, /case 'take': \{/);
  assert.match(appSource, /if\(appendTake!==\(command\.mode==='append'\)\)await action\('take-mode',body\);/);
  assert.match(appSource, /await action\('record-properties',body\);\n/);
  assert.match(appSource, /Add local numeric properties to the toolbelt\. Shared overrides must be made local before recording\./);
  assert.match(appSource, /if\(!propertyTake\)throw new Error\('This scene has reached its one-hour duration limit\.'\);/);
  assert.match(appSource, /if\(!trackPreview\)await action\('preview-tracks',body\);/);
  assert.match(appSource, /propertyRecording:!!propertyTake,propertyPreview:trackPreview,automationHeld:liveOverrides\.heldCount\(\),takeMode:appendTake\?'append':'replace'/);
  assert.match(appSource, /renderAll\(\);announceHostState\(\);\}\nfunction updatePropertyTake/, 'a take that ends on its own is announced');
});

test('every take and preview control names the first thing the user must do', () => {
  const at = (state, run = noop) => ({state, run});
  const scene = 'scene:one';
  const ready = {hostMode: 'expressions', sceneCount: 1, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: scene}};
  const reason = (link, want, extra = {}) => takesLogic.frameTakeReason({link, busy: false, sceneRef: scene, want, ...extra});
  assert.equal(reason(at(ready, null), 'start'), 'No Expressions application is mounted.');
  assert.equal(takesLogic.frameTakeReason({link: at(ready), busy: true, sceneRef: scene, want: 'start'}), 'The application is still answering the last take command.');
  assert.equal(reason(at(null), 'start'), 'The Expressions application has not reported its state yet.');
  assert.equal(reason(at({hostMode: 'expressions', sceneCount: 0}), 'start'), 'Open a native Expression to record its properties.');
  assert.match(reason(at(ready), 'start', {sceneRef: 'scene:other'}), /another Scene/);
  assert.match(reason(at(ready), 'start', {chosen: 0}), /toolbelt/);
  assert.equal(reason(at(ready), 'start', {chosen: 2}), null);
  assert.equal(reason(at({...ready, propertyRecording: true}), 'start'), 'A property take is already recording.');
  assert.match(reason(at({...ready, recording: true}), 'start'), /video recording/);
  assert.equal(reason(at(ready), 'stop'), 'No property take is recording.');
  assert.equal(reason(at({...ready, propertyRecording: true}), 'stop', {sceneRef: null}), null, 'stop is allowed from any Scene the frame stands in');
  assert.match(reason(at({...ready, propertyRecording: true}), 'preview', {tracks: 1}), /Finish the property take/);
  assert.match(reason(at(ready), 'preview', {tracks: 0}), /Record a take first/);
  assert.equal(reason(at(ready), 'preview', {tracks: 1}), null);
  assert.equal(reason(at(ready), 'stop-preview'), 'Preview is not playing.');
  assert.equal(reason(at({...ready, propertyPreview: true}), 'stop-preview'), null);
});

test('the frame link publishes once per change and tells its subscribers when it moves', () => {
  let seen = 0;
  const off = takesLogic.subscribeFrameTakeLink(() => seen++);
  const run = noop;
  takesLogic.publishFrameTakeLink({state: READY_STATE, run});
  takesLogic.publishFrameTakeLink({state: READY_STATE, run});
  assert.equal(seen, 1, 'an unchanged link is not republished');
  assert.equal(takesLogic.readFrameTakeLink().state, READY_STATE);
  takesLogic.publishFrameTakeLink({state: null, run: null});
  assert.equal(seen, 2);
  off();
  takesLogic.publishFrameTakeLink({state: READY_STATE, run});
  assert.equal(seen, 2, 'an unsubscribed listener is not called');
  takesLogic.publishFrameTakeLink({state: null, run: null});
});

test('the mini envelope is drawn from the track own keyframes, normalised to its own span', () => {
  const envelope = takesLogic.takeEnvelope([{time: 0, value: 0}, {time: 1, value: 1}, {time: 2, value: 0.5}], 160, 36);
  assert.equal(envelope.path, 'M0.00 36.00 L80.00 0.00 L160.00 18.00');
  assert.deepEqual([envelope.min, envelope.max, envelope.start, envelope.end, envelope.drawn], [0, 1, 0, 2, 3]);
  assert.equal(takesLogic.takeEnvelope([{time: 0, value: 4}, {time: 3, value: 4}], 100, 20).path, 'M0.00 10.00 L100.00 10.00', 'a flat track sits mid-height');
  assert.equal(takesLogic.takeEnvelope([{time: 5, value: 2}], 160, 36).path, 'M0.00 18.00', 'a single keyframe has no span');
  assert.equal(takesLogic.takeEnvelope([]), null);
  const dense = Array.from({length: 1000}, (_, index) => ({time: index * 0.01, value: Math.sin(index / 10)}));
  const drawn = takesLogic.takeEnvelope(dense);
  assert.ok(drawn.drawn <= takesLogic.ENVELOPE_POINT_LIMIT, 'a dense track is bounded for the mini view');
  assert.match(drawn.path, /^M0\.00 /);
  assert.match(drawn.path, new RegExp(` L${(999 * 0.01 / 9.99 * 160).toFixed(2).replace('.', '\\.')}`), 'the last keyframe is always drawn');
});

test('the Takes tab names each track, draws its envelope, and refuses preview and delete with their reasons', () => {
  const reading = readingWith([track('take-a', BIND, [{time: 0, value: 0}, {time: 1, value: 1}]), track('take-b', BIND2, [{time: 0, value: 2}, {time: 2, value: 2}])]);
  const markup = renderToStaticMarkup(createElement(takesView.NativeTakes, {reading, request: async () => ({ok: true, reading})}));
  assert.match(markup, /aria-label="Recorded takes"/);
  assert.match(markup, /2 recorded tracks/);
  assert.ok(markup.includes(LABEL), 'each track is named by its binding');
  assert.equal(markup.match(/<path /g).length, 2, 'one envelope per track');
  const preview = markup.match(/<button[^>]*>Preview<\/button>/)[0];
  assert.match(preview, /disabled=""/);
  assert.match(markup, /No Expressions application is mounted\./);
  const deletes = markup.match(/<button[^>]*aria-label="Delete recorded track[^"]*"[^>]*>/g);
  assert.equal(deletes.length, 2);
  for (const button of deletes) assert.doesNotMatch(button, /disabled=""/, 'delete is available while the owner is idle');
  const pending = renderToStaticMarkup(createElement(takesView.NativeTakes, {reading: {...reading, standing: {pending: true, dirty: false, notice: null}}, request: noop}));
  assert.match(pending, /still answering the last edit/);
  const empty = renderToStaticMarkup(createElement(takesView.NativeTakes, {reading: readingWith([]), request: noop}));
  assert.match(empty, /No property takes are recorded in this Scene/);
  const loading = renderToStaticMarkup(createElement(takesView.NativeTakes, {reading: null, request: noop}));
  assert.match(loading, /0 recorded tracks/);
});
