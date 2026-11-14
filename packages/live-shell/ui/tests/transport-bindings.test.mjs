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
const {useExpressionsTransport, OVERDUB_REFUSED} = await import('../src/shell/transports/useExpressionsTransport.tsx')
// The frame's lazy parts (a mode's bodies, its transport and tracks, a device's face) load when first drawn (shell/loadWhenDrawn.ts;
// O-I #740); a server render cannot wait for a module, so they are fetched first and every body renders itself.
await (await import('../src/shell/loadWhenDrawn.ts')).loadEveryPart()

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
  for (const id of ['tap', 'play', 'stop', 'record', 'overdub', 'arm', 'capture', 'loop', 'follow', 'metro', 'quantize', 'key']) assert.ok(enabled(markup, id), `${id} is pressable`)
  // REPLACED (round 870; DLW build ruling 2026-11-05): Re-enable was pressable from mount (the shell's own flag, set dark by the press); it
  // is Hand back over the selected session's custody, pressable only while what you edited is held, as Live's Re-enable Automation is.
  assert.ok(!enabled(markup, 're-enable'), 're-enable waits: no session is selected, so nothing an agent holds is read')
  assert.deepEqual([...markup.matchAll(/data-slot="([^"]+)"/g)].map(m => m[1]).filter((id, i, all) => all.indexOf(id) === i), [...TRANSPORT_SLOT_IDS], 'the same 28 slots, in order')
})

test('Factory\'s lights are readings: none from a shell flag the owner has not accepted; Run lights only after the owner answers', () => {
  const {bindings} = factory()
  const markup = draw(bindings)
  // Heartbeat, steer and write arm have no owner reading until the harness accepts a value (R2 objection 7): no light. Follow
  // is the frame's own view (keep views with the agents); capture, voice, hand back and routine are the shell's own acts.
  // REPLACED (round 870): Re-enable's light was the shell's flag, off from mount; it is the custody listing's hand_back, and none while unread.
  assert.deepEqual(['metro', 'overdub', 'follow', 'arm', 'capture', 'record', 're-enable', 'loop'].map(id => light(markup, id)), [null, null, 'on', null, 'off', 'off', null, 'off'])
  // Run was lit from mount on the old bar (a `useState(true)` no owner had answered); here no light shows until the harness answers.
  assert.equal(light(markup, 'play'), null, 'no Run light without an answer')
  assert.equal(light(markup, 'stop'), null, 'the old bar never lit Stop')
  for (const id of ['tempo', 'signature', 'quantize', 'key', 'root', 'scale', 'position', 'cpu']) assert.equal(light(markup, id), null, `${id} is a readout, not a light`)
})

test('Factory\'s readouts are the old bar\'s, and read dashes until the owner accepts a value', () => {
  const {bindings} = factory()
  // Ticket C: tokens in · out stand on the key slot (the mockup's `Σ 142k · 38k`), the scope on scale, the scope's root session on
  // root — which waits, unread, while no session stands.
  assert.deepEqual(['tempo', 'signature', 'quantize', 'key', 'scale', 'position', 'cpu'].map(id => bindings[id].readout.value),
    ['—', '— / —', '— ▾', 'Σ — · —', 'session', '— . — . —', '—'])
  assert.equal(bindings.root.readout, undefined, 'no session, no root session')
  const markup = draw(bindings)
  assert.match(markup, />— ▾</); assert.match(markup, />Σ — · —</)
})

test('Factory\'s Run and Stop send the Action aikit.gateway.agent on the bound harness, and nothing else', async () => {
  const sent = []
  const real = globalThis.fetch, warn = console.warn
  console.warn = () => {}   // the old bar warned on a refused control; the refusal is asserted by the absence of a request
  globalThis.fetch = async (url, init) => { sent.push({url, body: JSON.parse(init.body)}); return {json: async () => ({ok: true, outcome: {result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: 'aikit.gateway.agent', data: {ok: true, schema: 1, data: {state: 'running'}}}}})} }
  try {
    const {bindings} = factory()
    bindings.play.press(); await settle()
    bindings.stop.press(); await settle()
    assert.deepEqual(sent, [
      {url: 'http://owner.test/op', body: {op: 'act', action: 'aikit.gateway.agent', input: {binding: 'cursor', operation: 'resume'}}},
      {url: 'http://owner.test/op', body: {op: 'act', action: 'aikit.gateway.agent', input: {binding: 'cursor', operation: 'stop'}}},
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
  assert.ok(shell && bindings.follow.press && bindings.loop.press && bindings.capture.press && bindings.tap.press && bindings.record.press)
  // REPLACED (round 870): Re-enable was a shell-state press (`shell.setHandBackLit(false)`); it is Hand back, Factory's (below).
  assert.equal('handBackLit' in shell, false, 'the shell keeps no hand-back flag')
})

// Round 870 (DLW build ruling 2026-11-05): the transport's Re-enable is Hand back, as Live's Re-enable Automation is. It reads and gives back
// through the custody listing (factory.work-custody-listing/v1 hand_back over what the selected session's agent holds), not the shell's own
// flag. FAKE: the listing in Factory's own shape and a recording hold port.
test('(r870) Re-enable is Hand back: lit from the custody listing, pressed only while lit, giving back through Factory\'s custody hold', async () => {
  const {custodyBinding} = await import('../src/agent/devices/sessionChainBindings.ts')
  const {handBackSlot, HAND_BACK_NO_SESSION} = await import('../src/agent/devices/sessionCustody.ts')
  const record = (ref, revision, hold) => ({schema: 'factory.work-custody/v1', custody_ref: ref, position_ref: 'position:lead', work_ref: `central:task:${ref}`, state: 'in-progress',
    assigned_at_unix_ms: 1, reason: 'assigned', revision, updated_at_unix_ms: 2, transitions: [],
    ...(hold ? {person_hold: {held_by: 'person:frank', authority_ref: 'grant:frank', subject_ref: 'ses/settings/name', reason: 'edited', taken_at_unix_ms: 3}} : {})})
  const listing = hand_back => ({schema: 'factory.work-custody-listing/v1', project_ref: 'project:o-i', filter: {}, count: 2, custody: [record('c1', 4, true), record('c2', 1, false)],
    ...(hand_back ? {hand_back} : {})})
  const asked = [], said = []
  const custody = (value, ports = {hold: async request => { asked.push(request) }}) => custodyBinding({sessionRef: 'ses', agent: {}, person: 'person:frank',
    custody: {statePath: '/state', listing: {status: 'answered', value, error: null}, agentPosition: 'position:lead', work: 'central:task:c2'}}, null, ports)
  const lit = handBackSlot(custody(listing({lit: true, held: ['c1']})), line => said.push(line))
  assert.equal(lit.lit, true, 'lit: what you edited is held by the agent')
  lit.press(); await settle()
  assert.deepEqual(asked, [{kind: 'custody-hold', state_path: '/state', custody_ref: 'c1', act: 'give-back', reason: 'person:frank gave back what they edited, from the desk.', expected_revision: 4}])
  assert.deepEqual(said, ['↳ Given back: the agent may take it up again.'])
  const dark = handBackSlot(custody(listing({lit: false, held: []})), () => {})
  assert.deepEqual([dark.lit, dark.press], [false, undefined], 'dark: nothing to give back, nothing pressed')
  const older = handBackSlot(custody(listing(undefined)), () => {})
  assert.deepEqual([older.lit, older.press], [undefined, undefined], 'a Factory with no hand_back: no light, and it says why')
  assert.match(older.why, /answers no hand_back/)
  const unread = handBackSlot(custodyBinding({sessionRef: 'ses', agent: {}, person: 'person:frank', custody: {statePath: '/state', listing: {status: 'reading', value: null, error: null},
    agentPosition: 'position:lead', work: null}}, null, {}), () => {})
  assert.deepEqual([unread.lit, unread.press], [undefined, undefined], 'unread: no light')
  assert.deepEqual(handBackSlot(null, () => {}), {why: HAND_BACK_NO_SESSION}, 'no session: nothing read')
  // Factory's refusal stands under the slot in its words.
  said.length = 0
  handBackSlot(custody(listing({lit: true, held: ['c1']}), {hold: async () => { throw Error('custody c1 was given back already') }}), line => said.push(line)).press(); await settle()
  assert.deepEqual(said, ['↳ Refused — custody c1 was given back already'])
  // The bar draws it from the session's custody, never from a shell flag.
  const code = await source('shell/transports/useFactoryTransport.tsx')
  assert.match(code, /const handBack = useHandBack\(transport, track\)/)
  assert.match(code, /const slot = handBackSlot\(handBack, line => note\('re-enable', line\)\)/)
  assert.doesNotMatch(code, /handBackLit/)
  assert.doesNotMatch(await source('agent/AgentShellContext.tsx'), /handBackLit/)
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

// O-I ticket 1008: what plays, records and is armed is the kernel's. Expressions' Set as the kernel lays it (kernel mode_set.rs), with the
// fixture's work as its track and its Scene as a clip, each with the acts the Set gives them; the window's Set store holds it for a carrier,
// and each press is one act through that carrier, captured at the bridge.
const {windowSets} = await import('../src/owners/modeSets.ts')
const WORK = 'expression:whole'
const workInput = {expression_ref: WORK}, sceneInput = {expression_ref: WORK, scene_ref: SCENE}
function setOf({status = null, armed = false, held = [], launch = true} = {}) {
  return {owner: 'expressions', sources: [{slice: 'expressions', owner: 'expressions', version: 1, state: 'held'}], rows: [], takes: [], mixer: {},
    lanes_absent: {}, acts: {}, waiting: {},
    tracks: [{id: WORK, name: 'A working inquiry', kind: '', mix: {arm: armed},
      acts: {arm: {action: 'expressions.arm', input: workInput, takes: 'on', words: 'arm'},
        ...(status ? {stopTrack: {action: 'expressions.scene.stop', input: workInput, words: 'stop', done: 'A working inquiry stopped.'}} : {}),
        ...(held.length ? {reenable: {action: 'expressions.studio.reenable', input: workInput, takes: 'target', words: 'reenable'}} : {})},
      studio: {scene_ref: SCENE, values: {}, settings: {}, held,
        act: {action: 'expressions.studio.set', input: sceneInput, takes: '*', words: 'studio'}}}],
    clips: [{id: SCENE, track: WORK, label: 'Main', ...(status ? {status} : {}), acts: {
      ...(launch ? {launch: {action: 'expressions.scene.launch', input: {launches: [sceneInput]}, words: 'launch'}} : {}),
      ...(status !== 'recording' ? {capture: {action: 'expressions.scene.capture', input: sceneInput, words: 'capture'}} : {})}}]}
}
/** A carrier whose Set the window's store holds, and the Actions its presses send. */
async function kernelHolds(set) {
  const carrier = {kind: 'bridge', url: `http://kernel.test/${Math.random()}`}, acts = []
  const real = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body), op = typeof body.op === 'object' ? body.op : body
    if (op.op === 'act') { acts.push({action: op.action, input: op.input}); return {json: async () => ({ok: true, outcome: {result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: op.action, data: {ok: true}}}})} }
    return {json: async () => ({ok: true, outcome: {result: 'mode_set', data: {schema: 'oi.mode-set/v1', mode: 'expressions', version: 1, set}}})}
  }
  try { await windowSets.read(carrier, 'expressions') } finally { globalThis.fetch = real }
  const press = async pressing => { const was = globalThis.fetch; globalThis.fetch = async (url, init) => { const body = JSON.parse(init.body), op = typeof body.op === 'object' ? body.op : body; acts.push({action: op.action, input: op.input}); return {json: async () => ({ok: true, outcome: {result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: op.action, data: {ok: true}}}})} }
    try { pressing(); await settle(); await settle() } finally { globalThis.fetch = was } }
  return {carrier, acts, press}
}
const expressionsOver = (carrier, nativeTransport, readouts) => run(useExpressionsTransport, {tempoBpm: null, readouts, nativeTransport},
  node => h(Workspace.Provider, {value: {transport: carrier}}, node)).bindings

test('Expressions with no native reading presses nothing, and Play and Stop say why on the status bar (O-I #747, X2)', () => {
  const readouts = {position: {value: '0.00 / 8.00 s', title: 'the frame\'s'}}
  const none = expressions(undefined, readouts)
  assert.deepEqual(none.position, {readout: readouts.position}, 'the frame\'s readouts stand')
  // Manual §16.10: a disabled control stays drawn and the status bar says why. Before #747 Play was dimmed with no reason.
  const why = bindings => [bindings.play?.refused, bindings.stop?.refused]
  for (const [bindings, reason] of [
    [none, /No Expression is open here/],
    [expressions({owner: 'expressions', content: null, actions: null, isPresented: () => true, revealDetail: () => {}}), /has not been read yet/],
    [expressions({...native().source, content: {...native().source.content, scenes: null}}), /scenes/],
    [expressions({...native().source, content: {...native().source.content, playback: null}}), /playback/],
  ]) {
    for (const said of why(bindings)) assert.match(said ?? '', reason)
    assert.equal(bindings.play.press, undefined, 'nothing is pressed'); assert.equal(bindings.stop.press, undefined)
    assert.match(draw(bindings), new RegExp(`data-slot="play" data-i="[^"]*${reason.source}`), 'the reason rides in the line the status bar reads')
  }
})

test('Expressions binds the old bar\'s working controls to the slots §10.5 and the old bar name, and no others', async () => {
  const {source: bar} = native()
  const bindings = expressionsOver((await kernelHolds(setOf())).carrier, bar)
  assert.deepEqual(owner(bindings), ['arm', 'capture', 'cpu', 'draw', 'follow', 'key', 'key-map', 'loop', 'metro', 'overdub', 'play', 'position', 'quantize', 're-enable', 'record', 'root', 'scale', 'signature', 'stop', 'tempo'].sort())
  // Round 895 (OPEN 8; §10.5 "Key, root and scale | Tune the field's resonance", "Follow | Keep views with the scene"): the key row tunes
  // the plate the Resonance drives, and Follow says why it holds no switch (resonance-follow-transport-895.test.mjs).
  // Round 885 (§10.5 "Metronome | Pulse the field"): the Metronome is bound beyond the old bar, as the open scene's Pulse.
  // XS08 (O-I #747 round 884, DLW build ruling 2026-11-06; §10.5 "Quantize | Set when scenes launch"): Quantize is bound beyond the old bar.
  // This fixture's Expression keeps none, so its owner reads Live's bar, and the slot offers Live's values.
  assert.match(bindings.quantize.title, /^Scene quantize — when a launched scene lands: 1 Bar\./); assert.equal(bindings.quantize.control.props.value, '1 bar')
  // Ticket C: the scene's ratio of hold to change reads the field's own morph hold share (toroidalMorph.holdRatio).
  assert.match(bindings.signature.readout.value, /^\d+ : \d+$/); assert.match(bindings.signature.readout.title, /ratio of hold to change/)
  for (const id of ['link', 'tap', 'punch-in', 'punch-out', 'loop-length', 'keys', 'midi-map', 'rate']) {
    assert.equal(bindings[id], undefined, `${id} had no control on the old bar and stays unbound`)
  }
  const markup = draw(bindings)
  assert.deepEqual([...markup.matchAll(/data-slot="([^"]+)"/g)].map(m => m[1]).filter((id, i, all) => all.indexOf(id) === i), [...TRANSPORT_SLOT_IDS], 'the same 28 slots, in order')
  for (const id of ['link', 'tap', 'punch-in', 'punch-out', 'keys', 'midi-map']) assert.ok(!enabled(markup, id), `${id} is drawn waiting`)
  assert.ok(enabled(markup, 'capture'), 'Capture keeps the gestures as a scene (O-I #747 round three)')
  // The owner's own controls stand in their slots in place of a mark: the time scale, the scrub, the tool rail, Map, the engine light.
  // Round 885 (DLW build ruling 2026-11-06): the field's speed reads as Tempo, 96 × its time scale, in beats a minute.
  assert.match(markup, /aria-label="Tempo" value="96\.00"/); assert.match(bindings.tempo.title, /^Tempo — the field's speed in beats a minute: 96 × its time scale/)
  assert.match(markup, /aria-label="Scene position"/); assert.match(markup, /aria-label="Stage tool"/)
  assert.match(markup, /aria-label="Pin controls"/); assert.match(markup, /aria-label="Engine: Running"/)
  assert.match(markup, />0\.00 \/ 8\.00 s</, 'the Scene time reads the owner\'s elapsed over its working duration')
})

test('r885: Expressions\' Metronome is the open scene\'s Pulse (§10.5 "Pulse the field"): dark while Off, a press writes On through the Studio\'s act', async () => {
  const off = native(), kernel = await kernelHolds(setOf())
  const b = expressionsOver(kernel.carrier, off.source)
  assert.equal(b.metro.lit, false, 'the fixture\'s scene never set Pulse: Off, the manual\'s default')
  assert.match(b.metro.title, /^Pulse — the field pulses on the beat of its Tempo: Off\./)
  assert.equal(light(draw(b), 'metro'), 'off')
  await kernel.press(() => b.metro.press())
  // O-I ticket 1008: the Pulse is a setting of the Studio, so its write is one Action of the Studio's act, never the frame's editor.
  assert.deepEqual(kernel.acts, [{action: 'expressions.studio.set', input: {...sceneInput, setting: {kind: 'panel-setting', key: 'pulse'}, value: true}}])
  assert.deepEqual(off.sent, [], 'the frame\'s editor is asked nothing')
})

test('Expressions lights: Play, Arm, Record and Re-enable from the kernel\'s Set, Loop from the owner\'s reading, none from a Set not read', async () => {
  const idle = draw(expressionsOver((await kernelHolds(setOf())).carrier, native().source))
  assert.deepEqual(['play', 'loop', 'arm', 'record', 're-enable'].map(id => light(idle, id)), ['off', 'off', 'off', 'off', 'off'])
  const playing = draw(expressionsOver((await kernelHolds(setOf({status: 'running', armed: true, held: ['field.medium.pressure']}))).carrier,
    native({playback: {scene_playing: false}, saved: true, loop: true}).source))
  assert.deepEqual(['play', 'loop', 'arm', 'record', 're-enable'].map(id => light(playing, id)), ['on', 'on', 'on', 'off', 'on'],
    'Play is the kernel\'s playing clip, not the frame\'s `scene_playing`; Arm its arm; Re-enable a value it holds')
  const recording = draw(expressionsOver((await kernelHolds(setOf({status: 'recording', armed: true}))).carrier, native().source))
  assert.equal(light(recording, 'record'), 'on')
  const unread = draw(expressions(native().source))
  assert.deepEqual(['record', 're-enable'].map(id => light(unread, id)), [null, null], 'a Set not read lights nothing')
})

test('O-I ticket 1008: Expressions Play is the Scene\'s launch and Stop the Expression\'s stop, each one act of the kernel\'s Set', async () => {
  const idle = native(), kernel = await kernelHolds(setOf())
  const b = expressionsOver(kernel.carrier, idle.source)
  assert.equal(b.play.refused, undefined); assert.ok(b.play.press)
  await kernel.press(() => b.play.press())
  assert.deepEqual(kernel.acts, [{action: 'expressions.scene.launch', input: {launches: [sceneInput]}}], 'Play launches the Scene')
  // Nothing plays in the kernel and the field stands at its start: nothing to stop, and the owner's reason keeps the control drawn.
  assert.equal(b.stop.press, undefined); assert.match(b.stop.refused, /idle at its start/)
  const running = native({playback: {scene_playing: true, scene_elapsed_seconds: 2}}), playing = await kernelHolds(setOf({status: 'running'}))
  const r = expressionsOver(playing.carrier, running.source)
  await playing.press(() => r.stop.press())
  assert.deepEqual(playing.acts, [{action: 'expressions.scene.stop', input: workInput}], 'Stop is the kernel\'s stop')
  assert.deepEqual(idle.sent.concat(running.sent), [], 'the frame decides no playback')
  const elsewhere = native({playback: {scene_playing: true, scene_elapsed_seconds: 2}})
  const view = expressionsOver((await kernelHolds(setOf())).carrier, elsewhere.source)
  view.stop.press(); await settle()
  assert.deepEqual(elsewhere.sent, await elsewhere.expected(actions => actions.scene({action: 'seek', scene_ref: SCENE, seconds: 0, sequence: 'working'})),
    'with nothing playing in the kernel, Stop rewinds the field\'s own view of the Scene')
  const silent = expressionsOver((await kernelHolds(setOf({launch: false}))).carrier, native().source)
  assert.equal(silent.play.press, undefined, 'a Scene the Set gives no launch is not played'); assert.match(silent.play.refused, /does not launch/)
})

test('Expressions Loop toggles the Journey loop through the owner, and says why it cannot', async () => {
  assert.match(expressions(native({saved: false}).source).loop.refused, /Save the Scene sequence before looping it/)
  const saved = native({saved: true})
  const b = expressions(saved.source)
  assert.equal(b.loop.refused, undefined); b.loop.press(); await settle()
  assert.deepEqual(saved.sent, await saved.expected(actions => actions.setSceneLoop(true)))
})

test('O-I ticket 1008: Arm is the kernel\'s arm, Record stops the take the kernel records, Re-enable gives back what it holds, and Overdub has no mode', async () => {
  const kernel = await kernelHolds(setOf())
  const b = expressionsOver(kernel.carrier, native().source)
  assert.equal(b.record.press, undefined, 'Record is never an immediate-record button')
  assert.match(b.record.title, /Arm, then press Play/)
  assert.equal(b['re-enable'].press, undefined, 'the orange return is live only while the kernel holds a value')
  await kernel.press(() => b.arm.press())
  assert.deepEqual(kernel.acts, [{action: 'expressions.arm', input: {...workInput, on: true}}])
  const taking = await kernelHolds(setOf({status: 'recording', armed: true, held: ['field.medium.pressure']}))
  const t = expressionsOver(taking.carrier, native().source)
  assert.match(t.play.refused, /A take is recording/)
  await taking.press(() => t.record.press())
  await taking.press(() => t['re-enable'].press())
  await taking.press(() => t.arm.press())
  assert.deepEqual(taking.acts, [{action: 'expressions.scene.stop', input: workInput}, {action: 'expressions.studio.reenable', input: workInput},
    {action: 'expressions.arm', input: {...workInput, on: false}}], 'Record stops the take; Re-enable gives every held value back; Arm turns off')
  assert.equal(t.overdub.press, undefined); assert.equal(t.overdub.refused, OVERDUB_REFUSED)
})

test('Expressions\' hook makes only the old bar\'s owner calls on its slots; the Scene\'s own calls stand on the Clip side', async () => {
  const code = await source('shell/transports/useExpressionsTransport.tsx')
  const actions = [...new Set([...code.matchAll(/actions\.(\w+)\(/g)].map(m => m[1]))].sort()
  assert.deepEqual(actions, ['applyChanges', 'readNow', 'scene', 'sceneEdit', 'setSceneLoop'], 'the editor requests the old bar made on a slot (Save has no slot: it is the Clip side\'s, through sendSave), and XS08\'s Quantize')
  // XS08 (round 884): the one call beyond the old bar is the transport's Quantize, the Expression's own setting, through its owner.
  assert.deepEqual([...code.matchAll(/actions\.sceneEdit\(([^)]*)\)/g)].map(m => m[1]), ["{operation: 'launch-quantize', quantize: value}"])
  for (const call of ['runAct(', 'createLiveSession(', 'spaceTogglesPlayback(']) assert.ok(code.includes(call), `the hook uses ${call}`)
  assert.doesNotMatch(code, /kernelOp|fetch\(|history\('save'\)/, 'no owner call the old bar did not make on a slot')
  // What the Scene keeps while Expressions stands (⌘S, the selection's focus) is mounted here once, and nowhere else.
  assert.equal((code.match(/useSceneKeepers\(source\)/g) ?? []).length, 1)
})

test('Expressions\' bar is the one bar: TransportBar draws ModeTransport for every mode and the retired bar is gone', async () => {
  const bar = await source('components/TransportBar.tsx')
  assert.doesNotMatch(bar, /NativeTransportBar/, 'TransportBar draws no second Expressions bar')
  assert.equal((bar.match(/<ModeTransport /g) ?? []).length, 1, 'one ModeTransport, whatever the mode')
  assert.doesNotMatch(bar, /mode === 'expressions'/, 'no branch for Expressions beside the one bar')
  const {existsSync} = await import('node:fs')
  assert.equal(existsSync(new URL('../src/components/NativeTransportBar.tsx', import.meta.url)), false, 'the retired bar is deleted, not parked')
})

// O-I #747 round three (manual §20.1: "Play, record, arm the Studio, and keep your gestures as a scene — The transport: Play, Record, Arm and
// Capture"; "Capture in the transport keeps your last gestures as a new scene"): the Stage plate's Save scene… is the transport's Capture.
test('Expressions Capture keeps the scene as it stands and makes the next from it, through the Scene\'s capture act', async () => {
  const idle = native(), kernel = await kernelHolds(setOf())
  const b = expressionsOver(kernel.carrier, idle.source)
  assert.ok(b.capture.press); assert.match(b.capture.title, /Capture — keep your gestures as a scene/)
  await kernel.press(() => b.capture.press())
  assert.deepEqual(kernel.acts, [{action: 'expressions.scene.capture', input: sceneInput}], 'O-I ticket 1008: one act of the kernel\'s Set')
  assert.deepEqual(idle.sent, [])
  const none = expressions(undefined)
  assert.match(none.capture?.refused ?? '', /No Expression is open here/, 'with nothing open it says why')
})
