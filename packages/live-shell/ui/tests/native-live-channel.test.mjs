import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';

// Production sources in memory through the sibling composition loader: .ts/.tsx
// is transpiled, .css is a non-executing stub. The frame reader and builders, the
// LiveOverrides transient layer, the real ExpressionsHost over a stubbed frame and
// the hosted-state reader.
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
const [frame, boundary, protocol, live, model, params] = await Promise.all([
  import(new URL('stageCommands.ts', app)),
  import(new URL('packages/expressions-boundary/src/host.ts', root)),
  import(new URL('packages/expressions-boundary/src/protocol.ts', root)),
  import(new URL('liveOverrides.ts', app)),
  import(new URL('model.ts', app)),
  import(new URL('nativeParameters.ts', app)),
]);
const {ExpressionsHost} = boundary;
const {CHANNEL_VERSION, OPEN_STUDIO_COMMAND, readHostedState} = protocol;
const {LiveOverrides} = live;
const {blankJourney} = model;
const {NATIVE_BINDINGS, nativeBinding, baseValue} = params;
const origin = 'http://127.0.0.1:8788';
const READY_STATE = {hostMode: 'expressions', sceneCount: 1,
  document: {id: 'expression:kept', name: 'Kept work'}, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}};
const READY = {v: CHANNEL_VERSION, kind: 'oi-app-state', state: READY_STATE};

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

/** A host-command frame message carrying the given fields. */
const msg = (fields, req = 1) => ({v: 1, kind: 'host-command', req, ...fields});
/** A complete AutomationLane (the Scene type's shape), targeting one parameter. */
const lane = (id, target) => ({id, enabled: true, target, type: 'lfo', wave: 'sine', min: 0, max: 1, rate: 1, phase: 0,
  blend: 'replace', duration: 1, delay: 0, loop: 'loop', firedAt: null});

test('the reader admits the live set, hold and release, and the automation resume', () => {
  assert.deepEqual(frame.readStageRequest(msg({command: 'live', action: 'set', target: 'field.timeScale', value: 1.5})),
    {req: 1, command: {command: 'live', action: 'set', target: 'field.timeScale', value: 1.5}});
  assert.deepEqual(frame.readStageRequest(msg({command: 'live', action: 'hold', target: 'field.timeScale', value: 1.5})),
    {req: 1, command: {command: 'live', action: 'hold', target: 'field.timeScale', value: 1.5}});
  assert.deepEqual(frame.readStageRequest(msg({command: 'live', action: 'release'})), {req: 1, command: {command: 'live', action: 'release'}});
  assert.deepEqual(frame.readStageRequest(msg({command: 'automation', action: 'resume'})), {req: 1, command: {command: 'automation', action: 'resume'}});
});

test('each live and resume command round-trips through the message builder and the reader', () => {
  const commands = [
    {command: 'live', action: 'set', target: 'field.timeScale', value: 1.5},
    {command: 'live', action: 'hold', target: 'field.timeScale', value: -10},
    {command: 'live', action: 'release'},
    {command: 'automation', action: 'resume'},
  ];
  for (const command of commands) {
    const message = frame.stageRequestMessage(7, command);
    assert.ok(message, JSON.stringify(command));
    assert.deepEqual(frame.readStageRequest(message), {req: 7, command}, JSON.stringify(command));
  }
});

test('the reader refuses a live command with no action, an unknown action, or a missing operand', () => {
  const base = {v: 1, kind: 'host-command', req: 1, command: 'live'};
  const bad = [
    {...base}, {...base, target: 'field.timeScale', value: 1},
    {...base, action: 'pause', target: 'field.timeScale', value: 1}, {...base, action: 'pause'},
    {...base, action: 'constructor', target: 'field.timeScale', value: 1},
    {...base, action: 'set', value: 1}, {...base, action: 'set', target: 'field.timeScale'}, {...base, action: 'set'},
    {...base, action: 'hold', value: 1}, {...base, action: 'hold', target: 'field.timeScale'}, {...base, action: 'hold'},
  ];
  for (const message of bad) assert.equal(frame.readStageRequest(message), null, JSON.stringify(message));
});

test('the reader refuses a live value that is not a finite number', () => {
  const live = (action, value) => msg({command: 'live', action, target: 'field.timeScale', value});
  for (const action of ['set', 'hold'])
    for (const value of [NaN, Infinity, -Infinity, '1.5', null, undefined, true])
      assert.equal(frame.readStageRequest(live(action, value)), null, `${action} ${String(value)}`);
  assert.equal(frame.stageRequestMessage(1, {command: 'live', action: 'set', target: 'field.timeScale', value: NaN}), null, 'the builder refuses it too');
});

test('the reader refuses a target that is not a live Field parameter', () => {
  assert.ok(nativeBinding('timeScale'), 'positive control: the live target exists in the registry');
  const targets = [5, null, undefined, {}, ['field.timeScale'], 'field.nonexistent', 'field.', 'field.timeScale ', 'field.TimeScale',
    'entity:x:scale', 'native:fluid.timeScale', 'fluid.timeScale', 'timeScale', '__proto__', 'field.__proto__', 'field.constructor', 'constructor'];
  for (const target of targets)
    for (const action of ['set', 'hold'])
      assert.equal(frame.readStageRequest(msg({command: 'live', action, target, value: 1})), null, `${action} ${JSON.stringify(target)}`);
});

test('the reader refuses the discrete solver cardinalities, which are commit-only', () => {
  // Each key must name a real registry binding, so the refusal is the discrete exclusion and not a missing parameter.
  assert.equal(nativeBinding('native_medium__gridRes')?.path, 'medium.gridRes');
  assert.equal(nativeBinding('native_medium__iterations')?.path, 'medium.iterations');
  assert.equal(nativeBinding('count')?.path, 'particleCount');
  assert.equal(nativeBinding('native_cymatics__modeCount')?.path, 'cymatics.modeCount');
  for (const target of ['field.native_medium__gridRes', 'field.native_medium__iterations', 'field.count', 'field.native_cymatics__modeCount'])
    for (const action of ['set', 'hold'])
      assert.equal(frame.readStageRequest(msg({command: 'live', action, target, value: 64})), null, `${action} ${target}`);
});

test('the reader bounds a live value by the registry hard limits, inclusive at both ends', () => {
  const timeScale = nativeBinding('timeScale');
  assert.equal(timeScale.hardMin, -10);
  assert.equal(timeScale.hardMax, 100);
  const live = (action, value) => msg({command: 'live', action, target: 'field.timeScale', value});
  for (const action of ['set', 'hold'])
    for (const value of [-10, 0, 100]) assert.ok(frame.readStageRequest(live(action, value)), `${action} ${value} is inside`);
  for (const action of ['set', 'hold'])
    for (const value of [-10 - 1e-9, -11, 100 + 1e-9, 101]) assert.equal(frame.readStageRequest(live(action, value)), null, `${action} ${value} is outside`);
});

test('a release names no operand, and no live or resume message admits an extra key', () => {
  const base = {v: 1, kind: 'host-command', req: 1};
  const bad = [
    {...base, command: 'live', action: 'release', target: 'field.timeScale'}, {...base, command: 'live', action: 'release', value: 1},
    {...base, command: 'live', action: 'release', extra: 1},
    {...base, command: 'live', action: 'set', target: 'field.timeScale', value: 1, extra: 1},
    {...base, command: 'live', action: 'hold', target: 'field.timeScale', value: 1, confirmed: true},
    {...base, command: 'live', action: 'set', target: 'field.timeScale', value: 1, on: true},
    {...base, command: 'automation', action: 'resume', on: true}, {...base, command: 'automation', action: 'resume', target: 'field.timeScale'},
  ];
  for (const message of bad) assert.equal(frame.readStageRequest(message), null, JSON.stringify(message));
  assert.equal(frame.stageRequestMessage(1, {command: 'live', action: 'release', target: 'field.timeScale'}), null, 'the builder refuses a release with an operand');
});

test('stageLiveRefusal explains a refused value, and agrees with the reader on every target and value pair', () => {
  assert.equal(frame.stageLiveRefusal('field.timeScale', 1.5), null);
  assert.equal(frame.stageLiveRefusal('field.timeScale', -10), null);
  assert.equal(frame.stageLiveRefusal('field.timeScale', 100), null);
  assert.match(frame.stageLiveRefusal('field.timeScale', 101), /must be between -10 and 100/);
  assert.match(frame.stageLiveRefusal('field.timeScale', NaN), /finite number/);
  assert.match(frame.stageLiveRefusal('field.nonexistent', 1), /not live-adjustable/);
  assert.match(frame.stageLiveRefusal('field.native_medium__gridRes', 128), /not live-adjustable/);
  const targets = ['field.timeScale', 'field.nonexistent', 'field.native_medium__gridRes', 5, 'entity:x:scale'];
  const values = [-10, 100, -10 - 1e-9, 100 + 1e-9, 1.5, NaN, Infinity, '1', null];
  for (const target of targets)
    for (const value of values) {
      const refused = frame.stageLiveRefusal(target, value);
      const admitted = frame.readStageRequest(msg({command: 'live', action: 'set', target, value})) !== null;
      assert.equal(refused === null, admitted, `${JSON.stringify(target)} ${String(value)}`);
    }
});

test('each live target names exactly one registry binding, so the reader and the overrides layer resolve the same parameter', () => {
  // LiveOverrides finds a target's binding by nativeBinding(key) (first match); the reader asks stageLiveBinding (its own map). They must be the same object.
  let liveCount = 0;
  for (const binding of NATIVE_BINDINGS) {
    const admitted = frame.stageLiveBinding('field.' + binding.key);
    if (admitted === undefined) continue;
    liveCount++;
    assert.equal(NATIVE_BINDINGS.filter(b => b.key === binding.key).length, 1, `duplicate key ${binding.key}`);
    assert.strictEqual(admitted, nativeBinding(binding.key), binding.key);
  }
  assert.ok(liveCount > 0);
});

test('LiveOverrides.apply returns the same scene when nothing is overridden', () => {
  const scene = blankJourney().scenes[0];
  const o = new LiveOverrides();
  assert.equal(o.active(), false);
  assert.equal(o.apply(scene), scene);
});

test('a drag applies to a copy: the input scene and its parameters are unchanged', () => {
  const scene = blankJourney().scenes[0];
  const before = structuredClone(scene);
  const o = new LiveOverrides();
  o.setDrag('field.timeScale', 2.5);
  const out = o.apply(scene);
  assert.notEqual(out, scene);
  assert.notEqual(out.field.params, scene.field.params);
  assert.equal(baseValue(out, 'timeScale'), 2.5);
  assert.equal(out.field.params.timeScale, 2.5);
  assert.equal(baseValue(scene, 'timeScale'), 1);
  assert.equal(scene.field.params.timeScale, 1);
  assert.deepEqual(scene, before, 'the original scene object is not mutated');
});

test('a drag or a hold removes the automation lanes that drive the same parameter, from the copy only', () => {
  const scene = blankJourney().scenes[0];
  scene.automation = [lane('l1', 'field.timeScale'), lane('l2', 'field.speed')];
  const before = structuredClone(scene);
  const o = new LiveOverrides();
  o.setDrag('field.timeScale', 2.5);
  const out = o.apply(scene);
  assert.deepEqual(out.automation.map(l => l.id), ['l2'], 'the lane on another parameter stays');
  assert.deepEqual(scene.automation.map(l => l.id), ['l1', 'l2'], 'the input still has both lanes');
  assert.deepEqual(scene, before);
  const held = new LiveOverrides();
  held.hold('field.timeScale', 0.5);
  assert.deepEqual(held.apply(scene).automation.map(l => l.id), ['l2']);
  assert.equal(baseValue(held.apply(scene), 'timeScale'), 0.5);
});

test('the version moves on each real change and not on a repeated drag or an empty release', () => {
  const o = new LiveOverrides();
  assert.equal(o.version, 0);
  o.setDrag('field.timeScale', 2.5);
  assert.equal(o.version, 1);
  o.setDrag('field.timeScale', 2.5);
  assert.equal(o.version, 1, 'a repeated identical drag changes nothing');
  o.setDrag('field.timeScale', 3);
  assert.equal(o.version, 2);
  assert.equal(o.releaseDrags(), true);
  assert.equal(o.version, 3);
  assert.equal(o.releaseDrags(), false);
  assert.equal(o.version, 3, 'an empty release changes nothing');
  o.hold('field.timeScale', 1);
  assert.equal(o.version, 4);
  assert.equal(o.resume(), 1);
  assert.equal(o.version, 5);
  assert.equal(o.resume(), 0);
  assert.equal(o.version, 5, 'a resume with nothing held changes nothing');
});

test('releaseDrags clears a drag and reports it, and never clears a hold', () => {
  const o = new LiveOverrides();
  o.setDrag('field.timeScale', 2);
  assert.equal(o.releaseDrags(), true);
  assert.equal(o.releaseDrags(), false);
  assert.equal(o.active(), false);
  assert.equal(o.valueForBind('field.params.timeScale'), undefined);

  o.hold('field.timeScale', 1);
  assert.equal(o.releaseDrags(), false, 'a hold is not a drag');
  assert.equal(o.heldCount(), 1);
  o.setDrag('field.timeScale', 2);
  assert.equal(o.releaseDrags(), true);
  assert.equal(o.heldCount(), 1, 'the hold survives a release');
  assert.equal(o.valueForBind('field.params.timeScale'), 1, 'the released drag falls back to the hold');
  assert.equal(o.active(), true);
});

test('hold moves a drag to a hold, and resume returns the held count once', () => {
  const o = new LiveOverrides();
  o.setDrag('field.timeScale', 2.5);
  o.hold('field.timeScale', 2.5);
  assert.equal(o.valueForBind('field.params.timeScale'), 2.5, 'the held value is still read');
  assert.equal(o.heldCount(), 1);
  assert.equal(o.releaseDrags(), false, 'the drag became a hold, so there is no drag to release');
  assert.equal(o.resume(), 1);
  assert.equal(o.resume(), 0);
  assert.equal(o.heldCount(), 0);
  assert.equal(o.valueForBind('field.params.timeScale'), undefined);
  assert.equal(o.active(), false);
});

test('a drag outranks a hold on the same parameter, in valueForBind and in apply', () => {
  const scene = blankJourney().scenes[0];
  const o = new LiveOverrides();
  o.hold('field.timeScale', 0.5);
  assert.equal(o.valueForBind('field.params.timeScale'), 0.5);
  assert.equal(baseValue(o.apply(scene), 'timeScale'), 0.5, 'a hold alone is applied');
  o.setDrag('field.timeScale', 2);
  assert.equal(o.heldCount(), 1);
  assert.equal(o.valueForBind('field.params.timeScale'), 2, 'the drag outranks the hold');
  assert.equal(baseValue(o.apply(scene), 'timeScale'), 2);
  assert.equal(o.valueForBind('field.params.speed'), undefined, 'a parameter with no override reads nothing');
});

test('setDrag and hold refuse a target outside the live set, and store nothing', () => {
  const o = new LiveOverrides();
  assert.throws(() => o.setDrag('field.nonexistent', 1), /not live-adjustable/);
  assert.throws(() => o.setDrag('field.native_medium__gridRes', 128), /not live-adjustable/);
  assert.throws(() => o.setDrag('entity:x:scale', 1), /not live-adjustable/);
  assert.throws(() => o.hold('field.count', 1000), /not live-adjustable/);
  assert.equal(o.active(), false);
  assert.equal(o.version, 0);
});

test('the host posts the live command as one typed message, and each answer settles its own command', async t => {
  const a = aperture(t);
  await a.deliver(READY);
  const set = a.host.stageCommand({command: 'live', action: 'set', target: 'field.timeScale', value: 1.2});
  assert.deepEqual(a.stageMessages(), [{v: 1, kind: 'host-command', req: 1, command: 'live', action: 'set', target: 'field.timeScale', value: 1.2}]);
  await a.deliver({v: 1, kind: 'host-command-result', command: 'live', req: 1, ok: true});
  assert.deepEqual(await set, {ok: true});

  const hold = a.host.stageCommand({command: 'live', action: 'hold', target: 'field.timeScale', value: 0.5});
  const release = a.host.stageCommand({command: 'live', action: 'release'});
  assert.deepEqual(a.stageMessages().at(-2), {v: 1, kind: 'host-command', req: 2, command: 'live', action: 'hold', target: 'field.timeScale', value: 0.5});
  assert.deepEqual(a.stageMessages().at(-1), {v: 1, kind: 'host-command', req: 3, command: 'live', action: 'release'});
  await a.deliver({v: 1, kind: 'host-command-result', command: 'live', req: 2, ok: false, error: 'The frame refused the hold.'});
  await a.deliver({v: 1, kind: 'host-command-result', command: 'live', req: 3, ok: true});
  assert.deepEqual(await hold, {ok: false, error: 'The frame refused the hold.'});
  assert.deepEqual(await release, {ok: true});
  assert.equal(a.sent.filter(data => data.kind === 'host-command-result' || data.kind === 'host-capture-result').length, 0, 'an answer is never echoed back');
});

test('the host refuses a malformed or out-of-range live command without posting, and the vocabulary names live', async t => {
  const unready = aperture(t);
  assert.throws(() => unready.host.stageCommand({command: 'live', action: 'release'}), /not reported its state/);

  const a = aperture(t);
  await a.deliver(READY);
  const before = a.sent.length;
  const bad = [
    {command: 'live', action: 'set', target: 'field.timeScale', value: 101},
    {command: 'live', action: 'hold', target: 'field.timeScale', value: -10.5},
    {command: 'live', action: 'set', target: 'field.native_medium__gridRes', value: 128},
    {command: 'live', action: 'set', target: 'field.timeScale', value: '1'},
    {command: 'live', action: 'release', value: 1},
    {command: 'automation', action: 'resume', on: true},
  ];
  for (const command of bad) assert.throws(() => a.host.stageCommand(command), /Unknown Expressions stage command/, JSON.stringify(command));
  assert.equal(a.sent.length, before, 'nothing is posted');
  assert.ok(protocol.STAGE_COMMANDS.includes('live'));
  assert.ok(protocol.STAGE_COMMANDS.includes('automation'));
});

test('the hosted state carries the held-parameter count as a non-negative integer, and refuses any other', () => {
  assert.equal(readHostedState({...READY_STATE, automationHeld: 2}).automationHeld, 2);
  assert.equal(readHostedState({...READY_STATE, automationHeld: 0}).automationHeld, 0);
  assert.equal(readHostedState(READY_STATE).automationHeld, undefined, 'an absent count stays absent');
  for (const bad of [-1, 1.5, 'x', NaN, Infinity])
    assert.equal(readHostedState({...READY_STATE, automationHeld: bad}), null, String(bad));
});
