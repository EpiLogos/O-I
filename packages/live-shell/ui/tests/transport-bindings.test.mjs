import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// T-TRANSPORT-BINDINGS: Factory's and Expressions' working controls as bindings of the one transport (FOUNDATION F7; manual
// §10.5). Each press goes through the exact owner call the old bar made; a light comes only from the reading the old bar lit it
// from; a control with no owner call stays unbound. The hooks run once inside a probe component (server render), so a binding's
// press is the real closure the bar would draw, and the owner call it makes is captured at the owner's own boundary (the kernel
// bridge's fetch, the shell setter registry, the native editor's request). UI legs — the drawn bar, hover, the take flow in a
// mounted frame — are not reachable here and are marked UNVERIFIED in the ticket receipt.
// Loader as f7-transport.test.mjs.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document = {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage = {getItem: () => null, setItem: () => {}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const h = React.createElement
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const {Transport} = await import('../src/frame/transport/Transport.tsx')
const {TRANSPORT_SLOT_IDS} = await import('../src/shell/modeGrammar.ts')
const {AgentShellProvider, useAgentShellOptional} = await import('../src/agent/AgentShellContext.tsx')
const {Workspace} = await import('../src/shell/workspaceContext.tsx')
const {registerShellSetter} = await import('../src/inhabitants/sdk/shellSetters.ts')
const {useFactoryTransport} = await import('../src/shell/transports/useFactoryTransport.tsx')
const {useExpressionsTransport} = await import('../src/shell/transports/useExpressionsTransport.tsx')

const words = id => ({label: id, fn: `does ${id}`, dataI: `${id}|does ${id}`, waiting: `${id} waits`})
const draw = bindings => renderToStaticMarkup(h(Transport, {bindings, words}))
const tag = (markup, id) => markup.match(new RegExp(`<(?:button|span|output)[^>]*data-slot="${id}"[^>]*>`))?.[0] ?? ''
const enabled = (markup, id) => tag(markup, id) !== '' && !/disabled=""/.test(tag(markup, id))
const light = (markup, id) => tag(markup, id).match(/data-light="(on|off)"/)?.[1] ?? null
const owner = bindings => Object.keys(bindings).sort()
/** Run a binding hook once, in a probe component, and hand back what it bound (and the shell it read, when one stands). */
function run(hook, reading, wrap = node => node) {
  const out = {}
  const Probe = () => { out.shell = useAgentShellOptional(); out.bindings = hook(reading); return null }
  renderToStaticMarkup(wrap(h(Probe)))
  return out
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

// ——— Factory ———

const BRIDGE = {kind: 'bridge', url: 'http://owner.test'}
const factory = (transport = BRIDGE, readouts) => run(useFactoryTransport, {tempoBpm: null, readouts},
  node => h(AgentShellProvider, null, h(Workspace.Provider, {value: {transport}}, node)))

test('Factory binds the old bar\'s working controls to the slots §10.5 names, and no others', () => {
  const {bindings} = factory()
  assert.deepEqual(owner(bindings), ['arm', 'capture', 'cpu', 'follow', 'key', 'loop', 'metro', 'overdub', 'play', 'position', 're-enable',
    'record', 'quantize', 'root', 'scale', 'signature', 'stop', 'tap', 'tempo'].sort())
  // Link had no handler on the old bar; punch, draw, keys, the maps and rate had no control at all: they stay unbound, drawn waiting.
  for (const id of ['link', 'punch-in', 'punch-out', 'loop-length', 'draw', 'keys', 'key-map', 'midi-map', 'rate']) assert.equal(bindings[id], undefined, `${id} stays unbound`)
  const markup = draw(bindings)
  for (const id of ['link', 'punch-in', 'punch-out', 'draw', 'keys', 'key-map', 'midi-map']) assert.ok(!enabled(markup, id), `${id} is drawn waiting`)
  for (const id of ['tap', 'play', 'stop', 'record', 'overdub', 'arm', 're-enable', 'capture', 'loop', 'follow', 'metro', 'quantize', 'key']) assert.ok(enabled(markup, id), `${id} is pressable`)
  assert.deepEqual([...markup.matchAll(/data-slot="([^"]+)"/g)].map(m => m[1]).filter((id, i, all) => all.indexOf(id) === i), [...TRANSPORT_SLOT_IDS], 'the same 28 slots, in order')
})

test('Factory\'s lights are the shell\'s own readings; Run lights only after the owner has answered', () => {
  const {bindings} = factory()
  const markup = draw(bindings)
  // The agent shell's defaults: heartbeat, steer and follow on; write arm, capture, voice, hand back and routine off.
  assert.deepEqual(['metro', 'overdub', 'follow', 'arm', 'capture', 'record', 're-enable', 'loop'].map(id => light(markup, id)), ['on', 'on', 'on', 'off', 'off', 'off', 'off', 'off'])
  // Run was lit from mount on the old bar (a `useState(true)` no owner had answered); here no light shows until the harness answers.
  assert.equal(light(markup, 'play'), null, 'no Run light without an answer')
  assert.equal(light(markup, 'stop'), null, 'the old bar never lit Stop')
  for (const id of ['tempo', 'signature', 'quantize', 'key', 'root', 'scale', 'position', 'cpu']) assert.equal(light(markup, id), null, `${id} is a readout, not a light`)
})

test('Factory\'s readouts are the old bar\'s, and read their owner\'s dashes when it discloses nothing', () => {
  const {bindings} = factory()
  assert.deepEqual(['tempo', 'signature', 'quantize', 'key', 'root', 'scale', 'position', 'cpu'].map(id => bindings[id].readout.value),
    ['high', '— / —', 'next tool ▾', 'Σ session', 'in —', 'out —', '— . — . —', '—'])
  const markup = draw(bindings)
  assert.match(markup, />high</); assert.match(markup, />next tool ▾</); assert.match(markup, />Σ session</)
})

test('Factory\'s Run and Stop send harness_agent_control on the bound harness, and nothing else', async () => {
  const sent = []
  const real = globalThis.fetch, warn = console.warn
  console.warn = () => {}   // the old bar warned on a refused control; the refusal is asserted by the absence of a request
  globalThis.fetch = async (url, init) => { sent.push({url, body: JSON.parse(init.body)}); return {json: async () => ({ok: true, outcome: {result: 'harness_agent_outcome', document: {state: 'running'}}})} }
  try {
    const {bindings} = factory()
    bindings.play.press(); await settle()
    bindings.stop.press(); await settle()
    assert.deepEqual(sent, [
      {url: 'http://owner.test/op', body: {op: 'harness_agent_control', binding: 'cursor', control: 'resume'}},
      {url: 'http://owner.test/op', body: {op: 'harness_agent_control', binding: 'cursor', control: 'stop'}},
    ])
    // With no carrier there is no owner to reach: the press asks nobody.
    sent.length = 0
    const dark = factory({kind: 'unavailable', reason: 'no carrier in this test'}).bindings
    dark.play.press(); await settle()
    assert.equal(sent.length, 0)
  } finally { globalThis.fetch = real; console.warn = warn }
})

test('Factory\'s effort, heartbeat, interrupt timing, steer and write arm go through the registered shell setters', async () => {
  const calls = []
  for (const path of ['shell.setEffort', 'shell.setHeartbeat', 'shell.setQuantize', 'shell.setSteer', 'shell.setWriteArm']) {
    registerShellSetter(path, async value => { calls.push([path, value]); return {kind: 'fired', channel: 'kernel', writePath: path, note: 'carried'} })
  }
  const {bindings} = factory()
  bindings.tempo.step(1); bindings.tempo.step(-1)
  bindings.metro.press(); bindings.quantize.press(); bindings.overdub.press(); bindings.arm.press()
  await settle()
  assert.deepEqual(calls, [
    ['shell.setEffort', 'max'], ['shell.setEffort', 'medium'],             // from the default `high`, one step each way
    ['shell.setHeartbeat', false], ['shell.setQuantize', 'next turn'],     // from on / `next tool`
    ['shell.setSteer', false], ['shell.setWriteArm', true],                // from on / off
  ])
})

test('Factory\'s shell-state presses are the shell\'s own functions', () => {
  const {bindings, shell} = factory()
  assert.equal(bindings.key.press, shell.cycleTokenScope, 'the token scope cycles through the shell')
  assert.ok(shell && bindings.follow.press && bindings.loop.press && bindings['re-enable'].press && bindings.capture.press && bindings.tap.press && bindings.record.press)
})

test('Factory with no agent shell shows only the frame\'s readouts and presses nothing', () => {
  const readouts = {position: {value: '12 . 3 . 4', title: 'the frame\'s'}}
  const {bindings} = run(useFactoryTransport, {tempoBpm: null, readouts})
  assert.deepEqual(bindings, {position: {readout: readouts.position}})
})

test('Factory\'s hook makes only the old bar\'s owner calls', async () => {
  const code = await source('shell/transports/useFactoryTransport.tsx')
  for (const call of ['harnessAgentControl(transport, binding, control)', 'shellSetter(path)', 'startAgentVoice(transport)', 'stopAgentVoice(voiceSession.current)', 'useShellSetterBridge(']) {
    assert.ok(code.includes(call), `the hook makes ${call}, as the old bar did`)
  }
  assert.doesNotMatch(code, /kernelOp|fetch\(|invoke\(|harnessAgentConfigure|harnessAgentControlOutcome/, 'no owner call the old bar did not make')
})

// ——— Expressions ———

const root = new URL('../../../../', import.meta.url)
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const [C, Retained, Bridge, Model, Store] = await Promise.all([
  import('../src/shell/nativeContent.ts'),
  import(new URL('hostEditor.ts', author)),
  import(new URL('kernelDocumentBridge.ts', author)),
  import(new URL('model.ts', author)),
  import(new URL('store.ts', author)),
])
const SCENE = 'expression:whole:scene:main'
const PLAYBACK = {scene_ref: SCENE, scene_elapsed_seconds: 0, expression_time_seconds: 0, scene_playing: false, saved_sequence_playing: false, field_paused: false, track_preview: false}
const blocked = () => { throw Error('This test does not dispatch the owner effect') }

/** The owner's reading of one Expression with a single Scene (as native-transport.test.mjs builds it). */
function ownerReading(loop = false) {
  const journey = Model.blankJourney()
  journey.name = 'A working inquiry'
  journey.scenes[0].name = 'First'
  const document = {schema: 'oi.expression/v1', expression_ref: 'expression:whole', revision: 1, title: journey.name,
    scenes: [{scene_ref: SCENE, revision: 1, title: 'Main', entity_refs: []}], entities: {}, relations: {},
    selection: {scene_ref: SCENE, entity_ref: null}, provenance: [], representations: [], refinements: []}
  const view = Bridge.kernelDocumentToJourney(document, {identity: {expression: journey.id, scenes: {[SCENE]: journey.scenes[0].id}}})
  view.journey.loop = loop
  const store = new Store.DocumentStore(view.journey)
  const scene = store.document.scenes.find(value => value.id === view.startSceneId) ?? store.document.scenes[0]
  const selection = {entity_ids: [], step_id: null}
  return Retained.createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => selection, nativeView: () => view,
    nativeSelect: blocked, commit: blocked, change: (label, mutate) => store.change(label, mutate), afterHistory: blocked, selectLocal: blocked,
    openEditor: blocked, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false,
    sceneControls: {read: () => ({...PLAYBACK, intent_epoch: 0}), recording: () => false, transitionPending: () => false,
      focus: blocked, transport: blocked, seek: blocked, snapshot: blocked}}).read()
}

/** A native transport source whose Scene has authored material and an 8 s working duration, with the owner's requests captured. */
function native({playback = {}, saved = false, loop = false} = {}) {
  const reading = ownerReading(loop)
  const base = C.readNativeExpressionsContent(reading)
  const sent = []
  const actions = C.createNativeContentActions(base, {request: async request => { sent.push(request); return {ok: true, reading} }})
  const content = {...base,
    playback: {...base.playback, ...playback},
    scenes: {...base.scenes,
      scenes: base.scenes.scenes.map(row => ({...row, material: {...row.material, available: true, reason: null}, working: {...row.working, duration: 8}})),
      timing: {...base.scenes.timing, saved: {...base.scenes.timing.saved, available: saved}}}}
  const expected = async call => { const asked = []; await call(C.createNativeContentActions(base, {request: async request => { asked.push(request); return {ok: true, reading} }})); return asked }
  return {source: {owner: 'expressions', content, actions, isPresented: () => true, currentReading: () => reading, revealDetail: () => {}}, sent, expected}
}
const expressions = (nativeTransport, readouts) => run(useExpressionsTransport, {tempoBpm: null, readouts, nativeTransport}).bindings

test('Expressions with no native reading shows only the frame\'s readouts and presses nothing', () => {
  const readouts = {position: {value: '0.00 / 8.00 s', title: 'the frame\'s'}}
  assert.deepEqual(expressions(undefined, readouts), {position: {readout: readouts.position}})
  assert.deepEqual(expressions({owner: 'expressions', content: null, actions: null, isPresented: () => true, revealDetail: () => {}}), {})
})

test('Expressions binds the old bar\'s working controls to the slots §10.5 and the old bar name, and no others', () => {
  const {source: bar} = native()
  const bindings = expressions(bar)
  assert.deepEqual(owner(bindings), ['arm', 'cpu', 'draw', 'key-map', 'loop', 'overdub', 'play', 'position', 're-enable', 'record', 'stop', 'tempo'].sort())
  for (const id of ['link', 'tap', 'signature', 'metro', 'quantize', 'key', 'root', 'scale', 'follow', 'capture', 'punch-in', 'punch-out', 'loop-length', 'keys', 'midi-map', 'rate']) {
    assert.equal(bindings[id], undefined, `${id} had no control on the old bar and stays unbound`)
  }
  const markup = draw(bindings)
  assert.deepEqual([...markup.matchAll(/data-slot="([^"]+)"/g)].map(m => m[1]).filter((id, i, all) => all.indexOf(id) === i), [...TRANSPORT_SLOT_IDS], 'the same 28 slots, in order')
  for (const id of ['link', 'tap', 'capture', 'punch-in', 'punch-out', 'keys', 'midi-map']) assert.ok(!enabled(markup, id), `${id} is drawn waiting`)
  // The owner's own controls stand in their slots in place of a mark: the time scale, the scrub, the tool rail, Map, the engine light.
  assert.match(markup, /aria-label="Time Scale"/); assert.match(markup, /aria-label="Scene position"/); assert.match(markup, /aria-label="Stage tool"/)
  assert.match(markup, /aria-label="Pin controls"/); assert.match(markup, /aria-label="Engine: Running"/)
  assert.match(markup, />0\.00 \/ 8\.00 s</, 'the Scene time reads the owner\'s elapsed over its working duration')
})

test('Expressions lights: Play and Loop from the owner\'s reading, Arm and the take mode from the shell, none from a frame that has not reported', () => {
  const idle = draw(expressions(native().source))
  assert.deepEqual(['play', 'loop', 'arm', 'overdub', 'record', 're-enable', 'stop'].map(id => light(idle, id)), ['off', 'off', 'off', 'off', null, null, null])
  const playing = draw(expressions(native({playback: {scene_playing: true, scene_elapsed_seconds: 2}, saved: true, loop: true}).source))
  assert.equal(light(playing, 'play'), 'on', 'aria-pressed was `scene_playing`')
  assert.equal(light(playing, 'loop'), 'on', 'the Journey loop flag')
})

test('Expressions Play and Stop send the owner requests the old bar sent', async () => {
  const idle = native()
  const b = expressions(idle.source)
  assert.equal(b.play.refused, undefined); assert.ok(b.play.press)
  b.play.press(); await settle()
  assert.deepEqual(idle.sent, await idle.expected(actions => actions.scene({action: 'play'})), 'Play is the Scene play request')
  // Stopped at its start there is nothing to stop; the owner\'s reason keeps the control drawn.
  assert.equal(b.stop.press, undefined); assert.match(b.stop.refused, /idle at its start/)

  const running = native({playback: {scene_playing: true, scene_elapsed_seconds: 2}})
  const r = expressions(running.source)
  r.play.press(); r.stop.press(); await settle()
  assert.deepEqual(running.sent, [
    ...await running.expected(actions => actions.scene({action: 'pause'})),
    ...await running.expected(actions => actions.scene({action: 'seek', scene_ref: SCENE, seconds: 0, sequence: 'working'})),
  ], 'Pause while playing; Stop is one working seek to zero')
})

test('Expressions Loop toggles the Journey loop through the owner, and says why it cannot', async () => {
  assert.match(expressions(native({saved: false}).source).loop.refused, /Save the Scene sequence before looping it/)
  const saved = native({saved: true})
  const b = expressions(saved.source)
  assert.equal(b.loop.refused, undefined); b.loop.press(); await settle()
  assert.deepEqual(saved.sent, await saved.expected(actions => actions.setSceneLoop(true)))
})

test('Expressions Arm, Record and Re-enable follow the old bar: Arm decides Play, Record only stops a take, Re-enable needs a held value', () => {
  const b = expressions(native().source)
  assert.ok(b.arm.press && b.overdub.press, 'Arm and the take mode are the bar\'s own presentation')
  assert.equal(b.record.press, undefined, 'Record is never an immediate-record button')
  assert.match(b.record.title, /Arm automation, then press Play/)
  assert.equal(b['re-enable'].press, undefined, 'the orange return is live only while something is held')
  assert.match(b.overdub.title, /Replace last take/)
})

test('Expressions\' hook makes only the old bar\'s owner calls', async () => {
  const code = await source('shell/transports/useExpressionsTransport.tsx')
  const actions = [...new Set([...code.matchAll(/actions\.(\w+)\(/g)].map(m => m[1]))].sort()
  assert.deepEqual(actions, ['applyChanges', 'readNow', 'scene', 'setSceneLoop'], 'the editor requests the old bar made (not Save, which has no slot)')
  for (const call of ['takeStart(takeMode)', 'takeStop', 'STAGE_AUTOMATION_RESUME', 'createLiveSession(', 'spaceTogglesPlayback(']) assert.ok(code.includes(call), `the hook uses ${call}, as the old bar did`)
  assert.doesNotMatch(code, /kernelOp|fetch\(|history\('save'\)/, 'no owner call the old bar did not make on a slot')
})
