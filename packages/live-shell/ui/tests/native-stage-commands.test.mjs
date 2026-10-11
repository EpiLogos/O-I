import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

// Production sources in memory through the sibling composition loader: .ts/.tsx
// is transpiled, .css is a non-executing stub. The frame vocabulary, the real
// ExpressionsHost over a stubbed frame, the shell builders and the toolbar render.
const root = new URL('../../../../', import.meta.url);
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href;
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
const [frame, boundary, protocol, shell, tools, engine] = await Promise.all([
  import(new URL('stageCommands.ts', app)),
  import(new URL('packages/expressions-boundary/src/host.ts', root)),
  import(new URL('packages/expressions-boundary/src/protocol.ts', root)),
  import('../src/native/stageCommands.ts'),
  import('../src/components/NativeStageTools.tsx'),
  import('../src/native/engineCommand.ts'),
]);
const {ExpressionsHost} = boundary;
const {CHANNEL_VERSION, OPEN_STUDIO_COMMAND, readHostedState} = protocol;
const origin = 'http://127.0.0.1:8788';
const READY_STATE = {hostMode: 'expressions', sceneCount: 1,
  document: {id: 'expression:kept', name: 'Kept work'}, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}};
const READY = {v: CHANNEL_VERSION, kind: 'oi-app-state', state: READY_STATE};
const ALL_VIEW = ['view-2d', 'view-3d', 'guides', 'grid', 'snap', 'face-plane', 'fit-view', 'keep-view', 'restore-view'];

/** The real ExpressionsHost over a stubbed frame: every posted message is recorded. */
function aperture(t, options = {}) {
  const sent = [];
  let presented = true;
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); sent.push(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'world.expressions', owners: {channels: {}}, messageTarget: new EventTarget(),
    handshakeTimeoutMs: 60000, isPresented: () => presented, ...options});
  t.after(() => host.dispose());
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  const stageMessages = () => sent.filter(data => data.kind === 'host-command' && data.command !== OPEN_STUDIO_COMMAND);
  return {frame, host, deliver, sent, stageMessages, conceal: () => {presented = false}, reveal: () => {presented = true}};
}

test('the stage vocabulary is closed and every valid command reads back to itself', () => {
  // Other lanes add commands to this same closed list; this lane asserts its own members, and the refusal test below keeps the list closed.
  assert.ok(['view', 'capture', 'present', 'export', 'import', 'tool', 'engine'].every(name => frame.STAGE_COMMANDS.includes(name)));
  assert.deepEqual(frame.STAGE_TOOLS, ['select', 'interact', 'pin', 'text', 'formation']);
  assert.deepEqual(frame.STAGE_TOOL_READINGS, ['select', 'interact', 'pin', 'text', 'formation', 'orbit']);
  assert.deepEqual(frame.STAGE_ENGINE_ACTIONS, ['disperse', 'reset-phases', 'recover', 'reset']);
  assert.deepEqual(frame.STAGE_VIEW_ACTIONS, ALL_VIEW);
  assert.deepEqual(frame.STAGE_CAPTURE_WIDTHS, [1280, 1440, 1920, 3840]);
  assert.deepEqual(frame.STAGE_CAPTURE_ASPECTS, ['stage', '16:9', '1:1', '9:16']);
  assert.deepEqual(frame.STAGE_EXPORT_FORMATS, ['json', 'native', 'html']);
  const valid = [
    ...ALL_VIEW.map(action => ({command: 'view', action})),
    {command: 'capture', mediaKind: 'png'},
    {command: 'capture', mediaKind: 'png', settings: {width: 3840, aspect: '16:9', includeText: false, transparent: true}},
    {command: 'capture', mediaKind: 'video', action: 'start'},
    {command: 'capture', mediaKind: 'video', action: 'start', settings: {width: 1920}},
    {command: 'capture', mediaKind: 'video', action: 'stop'},
    {command: 'present', on: true}, {command: 'present', on: false},
    ...['json', 'native', 'html'].map(format => ({command: 'export', format})),
    {command: 'import'},
    ...['select', 'interact', 'pin', 'text', 'formation'].map(tool => ({command: 'tool', tool})),
    {command: 'tool', tool: 'pin', repeat: true}, {command: 'tool', tool: 'pin', repeat: false},
    {command: 'capture', mediaKind: 'video', action: 'save'},
    {command: 'engine', action: 'disperse'}, {command: 'engine', action: 'reset-phases'}, {command: 'engine', action: 'recover'},
    {command: 'engine', action: 'reset'}, {command: 'engine', action: 'reset', confirmed: true}, {command: 'engine', action: 'reset', confirmed: false},
  ];
  for (const command of valid) {
    const message = frame.stageRequestMessage(7, command);
    assert.ok(message, JSON.stringify(command));
    assert.deepEqual(frame.readStageRequest(message), {req: 7, command}, JSON.stringify(command));
  }
});

test('the frame reader refuses every value outside the closed vocabulary', () => {
  const base = {v: 1, kind: 'host-command', req: 1};
  const bad = [
    {...base, command: 'view', action: 'constructor'}, {...base, command: 'view', action: '__proto__'},
    {...base, command: 'view', action: 'view-2d', extra: 1}, {...base, command: 'view'},
    {...base, command: 'capture', mediaKind: 'gif'}, {...base, command: 'capture', mediaKind: 'png', action: 'start'},
    {...base, command: 'capture', mediaKind: 'video', action: 'pause'}, {...base, command: 'capture', mediaKind: 'video', action: 'stop', settings: {width: 1280}},
    {...base, command: 'capture', mediaKind: 'png', settings: {width: 1000}}, {...base, command: 'capture', mediaKind: 'png', settings: {aspect: 'auto'}},
    {...base, command: 'capture', mediaKind: 'png', settings: {includeText: 'yes'}}, {...base, command: 'capture', mediaKind: 'png', settings: {quality: 0.9}},
    {...base, command: 'capture', mediaKind: 'png', settings: null},
    {...base, command: 'present', on: 'yes'}, {...base, command: 'export', format: 'pdf'}, {...base, command: 'export', format: 'json', path: '/tmp/x'},
    {...base, command: 'import', file: 'x'}, {...base, command: 'delete'}, {...base, command: 'lens', lens: 'palace'},
    {...base, req: 0}, {...base, req: 1.5}, {...base, req: '1'}, {...base, v: 2, command: 'import'},
    {v: 1, kind: 'host-request', req: 1, command: 'import'}, null, 'view', ['view'],
    {...base, command: 'tool', tool: 'orbit'}, {...base, command: 'tool'}, {...base, command: 'tool', tool: 'constructor'},
    {...base, command: 'tool', tool: 'select', repeat: true}, {...base, command: 'tool', tool: 'pin', repeat: 'yes'},
    {...base, command: 'tool', tool: 'pin', extra: 1}, {...base, command: 'tool', tool: 'select', action: 'start'},
    {...base, command: 'engine', action: 'delete'}, {...base, command: 'engine'}, {...base, command: 'engine', action: 'disperse', confirmed: true},
    {...base, command: 'engine', action: 'reset', confirmed: 'yes'}, {...base, command: 'engine', action: 'recover', strength: 3},
    {...base, command: 'capture', mediaKind: 'video', action: 'save', settings: {width: 1920}}, {...base, command: 'capture', mediaKind: 'png', action: 'save'},
  ];
  for (const message of bad) assert.equal(frame.readStageRequest(message), null, JSON.stringify(message));
  assert.equal(frame.stageRequestMessage(1, {command: 'view', action: 'grid', extra: 1}), null);
  assert.equal(frame.stageRequestMessage(1, {command: 'capture', mediaKind: 'video', action: 'stop', settings: {}}), null);
});

test('answers are read only when well formed, and the reply the frame builds is the reply the host reads', () => {
  assert.deepEqual(frame.stageReplyMessage(4, {ok: true}, {command: 'view', action: 'grid'}), {v: 1, kind: 'host-command-result', command: 'view', req: 4, ok: true});
  assert.deepEqual(frame.stageReplyMessage(5, {ok: true}, {command: 'capture', mediaKind: 'png'}), {v: 1, kind: 'host-capture-result', req: 5, ok: true});
  assert.deepEqual(frame.stageReplyMessage(6, {ok: false, error: 'No recording is running.'}, {command: 'capture', mediaKind: 'video', action: 'stop'}),
    {v: 1, kind: 'host-capture-result', req: 6, ok: false, error: 'No recording is running.'});
  assert.equal(frame.stageReplyMessage(9, {ok: false, error: '   '}).error, 'The application refused the stage command.');
  assert.equal(frame.stageReplyMessage(9, {ok: false, error: 'x'.repeat(900)}).error.length, 512);
  assert.deepEqual(frame.readStageResult(frame.stageReplyMessage(6, {ok: false, error: 'bad\u0007 line'})), {req: 6, ok: false, error: 'bad  line'});
  assert.deepEqual(frame.readStageResult({v: 1, kind: 'host-capture-result', req: 2, ok: false, error: 'Gone'}), {req: 2, ok: false, error: 'Gone'});
  assert.equal(frame.readStageResult({v: 1, kind: 'host-command-result', command: 'open-studio', ok: true, section: 'physics'}), null, 'open-studio answers carry no req');
  assert.equal(frame.readStageResult({v: 1, kind: 'host-command-result', req: 1, ok: 'yes'}), null);
  assert.equal(frame.readStageResult({v: 1, kind: 'host-command-result', req: 1, ok: false, error: 'bad\u0007'}), null);
  assert.equal(frame.readStageResult({v: 1, kind: 'host-command-result', req: 1, ok: false, error: 'x'.repeat(513)}), null);
  assert.equal(frame.readStageResult({v: 1, kind: 'host-command', req: 1, ok: true}), null);
  assert.equal(frame.readStageResult({v: 2, kind: 'host-capture-result', req: 1, ok: true}), null);
});

test('the hosted state carries recording, presenting and a read-only camera reading, and refuses a malformed one', () => {
  const state = readHostedState({...READY_STATE, recording: true, presenting: false, stage: {mode: '3d', grid: true, snap: false, guides: true}});
  assert.equal(state.recording, true);
  assert.equal(state.presenting, false);
  assert.deepEqual(state.stage, {mode: '3d', grid: true, snap: false, guides: true});
  assert.equal(readHostedState({...READY_STATE, recording: 'yes'}), null);
  assert.equal(readHostedState({...READY_STATE, presenting: 1}), null);
  assert.equal(readHostedState({...READY_STATE, stage: {mode: '4d', grid: true, snap: false, guides: true}}), null);
  assert.equal(readHostedState({...READY_STATE, stage: {mode: '2d', grid: true, snap: false}}), null);
  assert.equal(readHostedState({...READY_STATE, stage: 'orbit'}), null);
  assert.equal(readHostedState(READY_STATE).stage, undefined, 'a state without the reading does not invent one');
});

test('the frame refuses an unconfirmed reset before running it; every other engine action is admitted', () => {
  assert.match(frame.stageRefusal({command: 'engine', action: 'reset'}), /needs confirmation/);
  assert.match(frame.stageRefusal({command: 'engine', action: 'reset', confirmed: false}), /needs confirmation/);
  assert.equal(frame.stageRefusal({command: 'engine', action: 'reset', confirmed: true}), null);
  for (const action of ['disperse', 'reset-phases', 'recover']) assert.equal(frame.stageRefusal({command: 'engine', action}), null, action);
  assert.equal(frame.stageRefusal({command: 'tool', tool: 'pin', repeat: true}), null);
});

test('the hosted state carries the active tool, pin repeat and take readings, and refuses an unknown tool', () => {
  const stage = {mode: '2d', grid: false, snap: false, guides: false};
  assert.deepEqual(readHostedState({...READY_STATE, stage: {...stage, tool: 'pin', repeatPins: true, videoTake: false}}).stage,
    {...stage, tool: 'pin', repeatPins: true, videoTake: false});
  assert.deepEqual(readHostedState({...READY_STATE, stage: {...stage, tool: 'orbit'}}).stage, {...stage, tool: 'orbit'}, 'orbit is a reading, never a command');
  assert.equal(readHostedState({...READY_STATE, stage: {...stage, tool: 'draw'}}), null);
  assert.equal(readHostedState({...READY_STATE, stage: {...stage, repeatPins: 'yes'}}), null);
  assert.equal(readHostedState({...READY_STATE, stage: {...stage, videoTake: 1}}), null);
});

test('the host posts tool, engine and save commands as typed messages, and each answer settles its own command', async t => {
  const a = aperture(t);
  await a.deliver(READY);
  const tool = a.host.stageCommand({command: 'tool', tool: 'pin', repeat: true});
  const reset = a.host.stageCommand({command: 'engine', action: 'reset', confirmed: true});
  const save = a.host.stageCommand({command: 'capture', mediaKind: 'video', action: 'save'});
  assert.deepEqual(a.stageMessages(), [
    {v: 1, kind: 'host-command', req: 1, command: 'tool', tool: 'pin', repeat: true},
    {v: 1, kind: 'host-command', req: 2, command: 'engine', action: 'reset', confirmed: true},
    {v: 1, kind: 'host-command', req: 3, command: 'capture', mediaKind: 'video', action: 'save'},
  ]);
  await a.deliver({v: 1, kind: 'host-command-result', command: 'tool', req: 1, ok: true});
  await a.deliver({v: 1, kind: 'host-command-result', command: 'engine', req: 2, ok: false, error: 'The field takes no runtime commands in this application.'});
  await a.deliver({v: 1, kind: 'host-capture-result', req: 3, ok: false, error: 'No recording take to save.'});
  assert.deepEqual(await tool, {ok: true});
  assert.deepEqual(await reset, {ok: false, error: 'The field takes no runtime commands in this application.'});
  assert.deepEqual(await save, {ok: false, error: 'No recording take to save.'});
  assert.throws(() => a.host.stageCommand({command: 'tool', tool: 'orbit'}), /Unknown Expressions stage command/, 'orbit is not a command');
  assert.throws(() => a.host.stageCommand({command: 'engine', action: 'reset', confirmed: 'yes'}), /Unknown Expressions stage command/);
});

test('the host posts exactly the typed stage command with its request id, and settles on the matching answer', async t => {
  const a = aperture(t);
  await a.deliver(READY);
  const view = a.host.stageCommand({command: 'view', action: 'grid'});
  assert.deepEqual(a.stageMessages(), [{v: 1, kind: 'host-command', req: 1, command: 'view', action: 'grid'}]);
  await a.deliver({v: 1, kind: 'host-command-result', command: 'view', req: 1, ok: true});
  assert.deepEqual(await view, {ok: true});
  const video = a.host.stageCommand({command: 'capture', mediaKind: 'video', action: 'start', settings: {width: 1920, transparent: false}});
  assert.deepEqual(a.stageMessages()[1], {v: 1, kind: 'host-command', req: 2, command: 'capture', mediaKind: 'video', action: 'start', settings: {width: 1920, transparent: false}});
  await a.deliver({v: 1, kind: 'host-capture-result', req: 2, ok: false, error: 'A recording is already running.'});
  assert.deepEqual(await video, {ok: false, error: 'A recording is already running.'});
  assert.equal(a.sent.filter(data => data.kind === 'host-command-result' || data.kind === 'host-capture-result').length, 0, 'an answer is never echoed back');
});

test('the host refuses an outside-vocabulary command, or an unready, concealed or disposed host, without posting', async t => {
  const a = aperture(t);
  assert.throws(() => a.host.stageCommand({command: 'view', action: 'grid'}), /not reported its state/);
  await a.deliver(READY);
  const before = a.sent.length;
  for (const bad of [{command: 'view', action: 'constructor'}, {command: 'capture', mediaKind: 'video', action: 'stop', settings: {width: 1280}},
    {command: 'import', file: 'x'}, {command: 'present', on: 'yes'}, {command: 'export', format: 'pdf'}, null, 'grid'])
    assert.throws(() => a.host.stageCommand(bad), /Unknown Expressions stage command/, JSON.stringify(bad));
  assert.equal(a.sent.length, before);
  a.conceal();
  assert.throws(() => a.host.stageCommand({command: 'import'}), /concealed/);
  a.reveal();
  a.host.dispose();
  assert.throws(() => a.host.stageCommand({command: 'import'}), /disposed/);
  assert.equal(a.stageMessages().length, 0);
});

test('a reload settles every waiting stage command; a stale, malformed or unknown answer changes nothing', async t => {
  const a = aperture(t);
  await a.deliver(READY);
  const waiting = a.host.stageCommand({command: 'present', on: true});
  a.frame.dispatchEvent(new Event('load'));
  assert.deepEqual(await waiting, {ok: false, error: 'The application reloaded before it answered this stage command'});
  await a.deliver(READY);
  let settled = null;
  const next = a.host.stageCommand({command: 'import'}).then(result => {settled = result; return result;});
  await a.deliver({v: 1, kind: 'host-command-result', command: 'present', req: 1, ok: true});
  await a.deliver({v: 1, kind: 'host-command-result', command: 'import', req: 2, ok: 'yes'});
  await a.deliver({v: 1, kind: 'host-command-result', command: 'import', req: 2, ok: false, error: 'bad\u0007'});
  await Promise.resolve();
  assert.equal(settled, null, 'malformed and stale answers leave the command waiting');
  await a.deliver({v: 1, kind: 'host-command-result', command: 'import', req: 2, ok: true});
  assert.deepEqual(await next, {ok: true});
  assert.equal(a.sent.filter(data => data.kind === 'host-command-result' || data.kind === 'host-capture-result').length, 0);
});

test('a stage command the frame never answers settles as a refusal rather than hanging', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const a = aperture(t);
  await a.deliver(READY);
  const waiting = a.host.stageCommand({command: 'capture', mediaKind: 'png'});
  t.mock.timers.tick(60000);
  assert.deepEqual(await waiting, {ok: false, error: 'The application did not answer this stage command'});
});

test('the shell builders and parser produce only commands the boundary accepts', () => {
  assert.deepEqual(shell.stageView('fit-view'), {command: 'view', action: 'fit-view'});
  assert.deepEqual(shell.stageRecord('start'), {command: 'capture', mediaKind: 'video', action: 'start'});
  assert.deepEqual(shell.stageRecord('stop'), {command: 'capture', mediaKind: 'video', action: 'stop'});
  assert.deepEqual(shell.stagePresent(false), {command: 'present', on: false});
  assert.deepEqual(shell.stageExport('native'), {command: 'export', format: 'native'});
  assert.deepEqual(shell.STAGE_IMPORT, {command: 'import'});
  assert.deepEqual(shell.stageCapturePng(), {command: 'capture', mediaKind: 'png'});
  assert.deepEqual(shell.parseStageCommand({command: 'view', action: 'snap'}), {command: 'view', action: 'snap'});
  for (const hostile of [{command: 'view', action: 'delete'}, {command: 'view', action: 'grid', req: 0}, {command: 'capture', mediaKind: 'video', action: 'stop', settings: {}},
    {command: 'export', format: 'pdf'}, {command: 'present', on: 1}, {command: 'view', action: 'grid', x: 1}, [], 'import', null])
    assert.equal(shell.parseStageCommand(hostile), null, JSON.stringify(hostile));
  assert.equal(shell.isStageViewAction('constructor'), false);
  assert.equal(shell.isStageViewAction('grid'), true);
  assert.equal(shell.isStageExportFormat('html'), true);
  assert.equal(shell.isStageExportFormat('__proto__'), false);
});

test('the tool, engine and save builders produce only commands the boundary accepts, and the capture defaults are admitted', () => {
  assert.deepEqual(shell.stageTool('formation'), {command: 'tool', tool: 'formation'});
  assert.deepEqual(shell.stagePinRepeat(false), {command: 'tool', tool: 'pin', repeat: false});
  assert.deepEqual(shell.stageEngine('reset'), {command: 'engine', action: 'reset'});
  assert.deepEqual(shell.stageEngine('reset', true), {command: 'engine', action: 'reset', confirmed: true});
  assert.deepEqual(shell.stageEngine('disperse'), {command: 'engine', action: 'disperse'});
  assert.deepEqual(shell.STAGE_SAVE_VIDEO, {command: 'capture', mediaKind: 'video', action: 'save'});
  assert.deepEqual(shell.STAGE_CAPTURE_DEFAULTS, {width: 1440, aspect: 'stage', includeText: true, transparent: false});
  assert.deepEqual(shell.STAGE_TOOL_LABELS, {select: 'Select', interact: 'Interact', pin: 'Pin', text: 'Text', formation: 'Formation'});
  for (const command of [shell.stageTool('select'), shell.stagePinRepeat(true), shell.stageEngine('recover'), shell.stageEngine('reset', true), shell.STAGE_SAVE_VIDEO,
    shell.stageCapturePng(shell.STAGE_CAPTURE_DEFAULTS), shell.stageRecord('start', shell.STAGE_CAPTURE_DEFAULTS)])
    assert.deepEqual(shell.parseStageCommand(command), command, JSON.stringify(command));
  for (const hostile of [{command: 'engine', action: 'delete'}, {command: 'engine', action: 'reset', confirmed: 1}, {command: 'tool', tool: 'orbit'},
    {command: 'tool', tool: 'select', repeat: true}, {command: 'capture', mediaKind: 'video', action: 'save', settings: {width: 1280}}])
    assert.equal(shell.parseStageCommand(hostile), null, JSON.stringify(hostile));
});

test('the engine request parser admits only the closed actions, and confirmed only as true on reset', () => {
  assert.deepEqual(engine.parseNativeEngineCommand({action: 'disperse'}), {action: 'disperse'});
  assert.deepEqual(engine.parseNativeEngineCommand({action: 'reset', confirmed: true}), {action: 'reset', confirmed: true});
  assert.deepEqual(engine.parseNativeEngineCommand({action: 'reset'}), {action: 'reset'}, 'an unconfirmed reset is parsed and then refused by the frame');
  for (const bad of [null, 'reset', ['reset'], {}, {action: 'constructor'}, {action: 'delete'}, {action: 'disperse', confirmed: true},
    {action: 'reset', confirmed: false}, {action: 'reset', confirmed: 'yes'}])
    assert.equal(engine.parseNativeEngineCommand(bad), null, JSON.stringify(bad));
});

test('the engine request is dispatched as one typed event, and the mount reading reports to subscribers', t => {
  const target = new EventTarget();
  globalThis.window = target;
  t.after(() => {delete globalThis.window; engine.setNativeEngineMounted(false);});
  const seen = [];
  target.addEventListener(engine.NATIVE_ENGINE_COMMAND, event => seen.push(event.detail));
  engine.dispatchNativeEngineCommand({action: 'reset', confirmed: true});
  engine.dispatchNativeEngineCommand({action: 'recover'});
  assert.equal(engine.NATIVE_ENGINE_COMMAND, 'oi:native-engine-command');
  assert.deepEqual(seen, [{action: 'reset', confirmed: true}, {action: 'recover'}]);
  let changes = 0;
  const stop = engine.subscribeNativeEngineMounted(() => changes++);
  assert.equal(engine.readNativeEngineMounted(), false);
  engine.setNativeEngineMounted(true); engine.setNativeEngineMounted(true);
  assert.equal(engine.readNativeEngineMounted(), true);
  stop();
  engine.setNativeEngineMounted(false);
  assert.equal(changes, 1, 'an unchanged reading notifies nobody, and an unsubscribed listener hears nothing');
  assert.equal(engine.engineCommandReason({mounted: false, busy: false}), 'No native Expression is mounted.');
  assert.equal(engine.engineCommandReason({mounted: false, busy: true}), 'No native Expression is mounted.');
  assert.equal(engine.engineCommandReason({mounted: true, busy: true}), 'Wait for the native work to finish saving.');
  assert.equal(engine.engineCommandReason({mounted: true, busy: false}), null);
});

test('toggle readings are undefined unless the hosted state carries them, and every control names why it is off', () => {
  assert.ok(Object.values(shell.stageReadings(null)).every(value => value === undefined));
  assert.deepEqual(shell.stageReadings({...READY_STATE, stage: {mode: '3d', grid: true, snap: false, guides: true}, recording: true, presenting: false}),
    {view2d: false, view3d: true, grid: true, snap: false, guides: true, recording: true, presenting: false, tool: undefined, repeatPins: undefined, videoTake: undefined});
  assert.deepEqual(shell.stageReadings({...READY_STATE, stage: {mode: '2d', grid: false, snap: true, guides: false, tool: 'pin', repeatPins: true, videoTake: true}}),
    {view2d: true, view3d: false, grid: false, snap: true, guides: false, recording: undefined, presenting: undefined, tool: 'pin', repeatPins: true, videoTake: true});
  assert.equal(shell.stageDisabledReason({mounted: false, state: READY_STATE, busy: false}), 'No Expressions application is mounted.');
  assert.equal(shell.stageDisabledReason({mounted: true, state: null, busy: false}), 'The Expressions application has not reported its state yet.');
  assert.equal(shell.stageDisabledReason({mounted: true, state: {hostMode: 'expressions', sceneCount: 0}, busy: false}), 'Open a native Expression to use its stage.');
  assert.equal(shell.stageDisabledReason({mounted: true, state: READY_STATE, busy: true}), 'The application is still answering the last stage command.');
  assert.equal(shell.stageDisabledReason({mounted: true, state: READY_STATE, busy: false}), null);
});

test('the stage toolbar names every control, disables it with its reason, and reads toggles from the hosted state', () => {
  const buttons = html => Object.fromEntries([...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(([, attrs, label]) => [label, attrs]));
  const unmounted = renderToStaticMarkup(createElement(tools.NativeStageTools, {state: null, run: null}));
  assert.match(unmounted, /role="toolbar" aria-label="Stage controls"/);
  assert.match(unmounted, /No Expressions application is mounted\./);
  const off = buttons(unmounted);
  assert.equal(Object.keys(off).length, 17, 'the tool rail now lives in the top bar');
  for (const [label, attrs] of Object.entries(off)) {
    assert.match(attrs, /disabled=""/, label);
    assert.doesNotMatch(attrs, /aria-pressed/, label);
  }
  const bare = buttons(renderToStaticMarkup(createElement(tools.NativeStageTools, {state: READY_STATE, run: async () => ({ok: true})})));
  assert.doesNotMatch(bare['2D'], /aria-pressed/, 'no camera reading, no pressed claim');
  assert.doesNotMatch(bare['Present'], /disabled/);

  const ready = renderToStaticMarkup(createElement(tools.NativeStageTools, {
    state: {...READY_STATE, stage: {mode: '3d', grid: true, snap: false, guides: true}, recording: true, presenting: false},
    run: async () => ({ok: true}),
  }));
  const on = buttons(ready);
  assert.equal(Object.keys(on).length, 17);
  // Save video needs a held take: it names that reason until the frame reports one.
  for (const [label, attrs] of Object.entries(on)) if (label !== 'Save video') assert.doesNotMatch(attrs, /disabled/, label);
  assert.match(on['Save video'], /disabled=""/);
  assert.match(on['2D'], /aria-pressed="false"/);
  assert.match(on['3D'], /aria-pressed="true"/);
  assert.match(on.Grid, /aria-pressed="true"/);
  assert.match(on.Snap, /aria-pressed="false"/);
  assert.match(on.Guides, /aria-pressed="true"/);
  assert.match(on['Stop recording'], /aria-pressed="true"/);
  assert.match(on.Present, /aria-pressed="false"/);
  assert.doesNotMatch(on['Face plane'], /aria-pressed/);
  assert.match(ready, /Export ▾/);
  assert.match(ready, /aria-label="Camera"/);
});

test('Save video waits for a take, and the capture options start at the Image suite defaults', () => {
  const toolState = (stage = {}, extra = {}) => ({...READY_STATE, stage: {mode: '2d', grid: false, snap: false, guides: false, ...stage}, ...extra});
  const render = state => renderToStaticMarkup(createElement(tools.NativeStageTools, {state, run: async () => ({ok: true})}));
  const buttons = html => Object.fromEntries([...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(([, attrs, label]) => [label, attrs]));
  const held = buttons(render(toolState({tool: 'pin', videoTake: true})));
  assert.doesNotMatch(held['Save video'], /disabled/, 'a held take can be saved');
  const select = buttons(render(toolState({tool: 'select'})));
  assert.match(select['Save video'], /disabled=""/);
  assert.match(select['Save video'], /Record a take first\./);
  assert.equal(select.Select, undefined, 'the tool rail is in the top bar, not here');

  const recording = buttons(render(toolState({}, {recording: true})));
  assert.match(recording['Stop recording'], /aria-pressed="true"/);
  assert.match(recording['Save video'], /disabled=""/, 'a take is not saved while recording');

  const html = render(toolState({tool: 'pin'}));
  assert.doesNotMatch(html, /aria-label="Tool"/);
  assert.match(html, /<summary>Capture options ▾<\/summary>/);
  assert.match(html, /<label>Width <select[^>]*>/);
  assert.match(html, /<option value="1440" selected="">1440 px<\/option>/, 'the popover starts at the Image suite default');
  assert.match(html, /<option value="stage" selected="">Stage frame<\/option>/);
  assert.match(html, /Include text/);
  assert.match(html, /Transparent background/);
  assert.match(html, /<summary>Orbit<\/summary>/, 'orbit is a keyboard-reachable note');
  assert.match(html, /Orbit is a pointer drag on the stage itself, not a button\./);
});

test('the automation runtime commands are typed: play names no operand, loop carries its boolean, and the host posts only those', async t => {
  for (const command of [{command: 'automation', action: 'play'}, {command: 'automation', action: 'loop', on: true}, {command: 'automation', action: 'loop', on: false}]) {
    const message = frame.stageRequestMessage(3, command);
    assert.ok(message, JSON.stringify(command));
    assert.deepEqual(frame.readStageRequest(message), {req: 3, command});
  }
  const base = {v: 1, kind: 'host-command', req: 3, command: 'automation'};
  const bad = [{...base}, {...base, action: 'pause'}, {...base, action: 'play', on: true}, {...base, action: 'play', confirmed: true},
    {...base, action: 'loop'}, {...base, action: 'loop', on: 'yes'}, {...base, action: 'loop', on: true, extra: 1}];
  for (const message of bad) assert.equal(frame.readStageRequest(message), null, JSON.stringify(message));
  assert.equal(frame.stageRequestMessage(3, {command: 'automation', action: 'pause'}), null, 'pause is a document change, not a stage command');
  assert.equal(frame.stageRequestMessage(3, {command: 'automation', action: 'loop', on: 1}), null);
  assert.deepEqual(shell.parseStageCommand(shell.stageAutomationPlay), {command: 'automation', action: 'play'});
  assert.deepEqual(shell.parseStageCommand(shell.stageAutomationLoop(false)), {command: 'automation', action: 'loop', on: false});

  assert.equal(readHostedState({...READY_STATE, automationLoop: true}).automationLoop, true);
  assert.equal(readHostedState({...READY_STATE, automationLoop: 'yes'}), null);
  const a = aperture(t);
  await a.deliver(READY);
  const loop = a.host.stageCommand({command: 'automation', action: 'loop', on: true});
  assert.deepEqual(a.stageMessages().at(-1), {v: 1, kind: 'host-command', req: 1, command: 'automation', action: 'loop', on: true});
  await a.deliver({v: 1, kind: 'host-command-result', command: 'automation', req: 1, ok: true});
  assert.deepEqual(await loop, {ok: true});
});
