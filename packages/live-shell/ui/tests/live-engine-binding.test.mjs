// Live's mixer in the one engine (O-I #849): the Live UI's mixer writes go to the set's owner and, while the engine plays the set,
// follow into the engine through its owner ops (live/liveEngine.ts over desktop/cradle/src-tauri/src/live_engine_host.rs); what the
// UI holds is the engine's reading — the mixer as it APPLIED it — never the move asked. Channels: the host's wire pinned against the
// host's own tests (live_engine_host.rs parses these events); a native host standing in through window.__TAURI_INTERNALS__ that answers
// as live_engine_host.rs does (a move is in the reading only once a block applied it); the set owner's ops answered in the kernel's shape.
// The engine's own arithmetic is tested in Rust (packages/live-engine/tests/parts_engine.rs, the host's tests); here, the binding.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const engine = await import('../src/live/liveEngine.ts')
const writes = await import('../src/live/liveWrites.ts')
const hostSource = readFileSync(new URL('../../../../desktop/cradle/src-tauri/src/live_engine_host.rs', import.meta.url), 'utf8')

// The set as its owner lists it: a MIDI part, a group, an audio part, a return, the Main track (live-set edit.rs tracks: Tracks in
// order, then the Main track).
const KINDS = ['midi', 'group', 'audio', 'return', 'master']
const PATH = '/sets/engine.als'
const summary = {path: PATH, tempo_bpm: 120, scene_count: 1, arrangement_clips: 0,
  tracks: KINDS.map((kind, i) => ({kind, name: `P${i}`, devices: []}))}

test('the set\'s parts are the engine\'s: its parts, its returns and the Main track; a group is not hosted', () => {
  assert.deepEqual(KINDS.map((_, i) => engine.enginePartOf(KINDS, i)), [{track: 0}, null, {track: 1}, {return: 0}, 'main'])
  assert.deepEqual(engine.engineEventOfMixerWrite(KINDS, 2, 'activator', false), {kind: 'active', part: {track: 1}, on: false})
  assert.deepEqual(engine.engineEventOfMixerWrite(KINDS, 3, 'activator', true), {kind: 'active', part: {return: 0}, on: true})
  assert.deepEqual(engine.engineEventOfMixerWrite(KINDS, 4, 'activator', false), {kind: 'active', part: 'main', on: false})
  assert.deepEqual(engine.engineEventOfMixerWrite(KINDS, 2, 'solo', true), {kind: 'solo', track: 1, on: true})
  assert.equal(engine.engineEventOfMixerWrite(KINDS, 3, 'solo', true), null, 'the engine solos parts, not returns')
  assert.equal(engine.engineEventOfMixerWrite(KINDS, 0, 'arm', true), null, 'Arm changes nothing the engine plays')
  assert.equal(engine.engineEventOfMixerWrite(KINDS, 0, 'monitor', 'in'), null)
  assert.equal(engine.engineEventOfMixerWrite(KINDS, 1, 'activator', false), null, 'a group is not hosted')
  assert.deepEqual(engine.engineEventOfSendWrite(KINDS, 2, 0, 0.5), {kind: 'send', track: 1, send: 0, gain: 0.5})
  assert.equal(engine.engineEventOfSendWrite(KINDS, 3, 0, 0.5), null, 'the engine has no return-to-return send')
})

test('every event the UI sends is one the host parses: the same fields its own tests send', () => {
  // The host's tests parse these (live_engine_host.rs events_move_the_mixer_and_export_renders_what_was_played): each kind's fields.
  const pinned = new Map()
  for (const [, json] of hostSource.matchAll(/r#"(\{"kind":[^#]*\})"#/g)) {
    const event = JSON.parse(json)
    if (json.includes('"bus"') || json.includes('"fader"') || !('part' in event || 'track' in event || event.kind === 'panic')) continue
    const shape = JSON.stringify([Object.keys(event).sort(), typeof event.part === 'object' ? Object.keys(event.part) : event.part ?? null])
    pinned.set(`${event.kind} ${shape}`, true)
  }
  const sent = [engine.engineEventOfMixerWrite(KINDS, 2, 'activator', false), engine.engineEventOfMixerWrite(KINDS, 3, 'activator', false),
    engine.engineEventOfMixerWrite(KINDS, 2, 'solo', true), engine.engineEventOfSendWrite(KINDS, 2, 0, 0.5)]
  for (const event of sent) {
    const shape = JSON.stringify([Object.keys(event).sort(), typeof event.part === 'object' ? Object.keys(event.part) : event.part ?? null])
    assert.ok(pinned.has(`${event.kind} ${shape}`), `the host's tests parse a ${event.kind} event shaped ${shape}`)
  }
})

test('off the native candidate each engine act refuses, naming its op', async () => {
  const here = /The Live engine plays in the desktop's audio path, the native candidate's; it is out of reach here/
  await assert.rejects(engine.liveEngine.play(PATH, async () => ({summary})), /out of reach here \(live_engine_open\)/)
  await assert.rejects(engine.liveEngine.stop(), /\(live_engine_stop\)/)
  await assert.rejects(engine.liveEngine.send({kind: 'panic'}), /\(live_engine_send\)/)
  await assert.rejects(engine.liveEngine.read(), /\(live_engine_mixer\)/)
  await assert.rejects(engine.liveEngine.exportAudio('/tmp/a.wav'), here)
  assert.equal(engine.liveEngineState().reading, null, 'nothing is held that the engine did not answer')
  assert.match(engine.liveEngineState().error, here)
  assert.deepEqual([...engine.LIVE_ENGINE_OPS], ['live_engine_open', 'live_engine_play', 'live_engine_stop', 'live_engine_send', 'live_engine_mixer', 'live_engine_export'])
  for (const name of engine.LIVE_ENGINE_OPS) assert.match(hostSource, new RegExp(`pub (async )?fn ${name}\\(`), `the host serves ${name}`)
})

/** A native host standing in: the set owner's ops in the kernel's shape, and the engine as live_engine_host.rs answers — a move sent is
 * queued, and the reading shows it only after a block (here, the next live_engine_mixer read) applied it. */
function nativeHost() {
  const calls = []
  const part = name => ({name, gain: 1, pan: 0, active: true, solo: false, sends: [0], midi: name === 'P0'})
  let applied = null, queued = []
  const reading = () => structuredClone(applied)
  const apply = event => {
    const {mixer} = applied
    const at = p => p === 'main' ? mixer.main : 'track' in p ? mixer.tracks[p.track] : mixer.returns[p.return]
    if (event.kind === 'active') at(event.part).active = event.on
    if (event.kind === 'solo') mixer.tracks[event.track].solo = event.on
    if (event.kind === 'send') mixer.tracks[event.track].sends[event.send] = event.gain
  }
  const engineOp = {
    live_engine_open: ({path}) => { applied = {path, sample_rate: 48000, position: 0, playing: false, warnings: ['P1: a group is not hosted'],
      mixer: {tracks: [part('P0'), part('P2')], returns: [part('P3')], main: part('Main')}}; return reading() },
    live_engine_play: () => { applied.playing = true; return reading() },
    live_engine_stop: () => { applied.playing = false; return reading() },
    live_engine_send: ({event}) => { if (event.kind === 'send' && event.send > 0) throw `track ${event.track} has no send ${event.send}`; queued.push(event); return reading() },
    live_engine_mixer: () => { for (const event of queued) apply(event); queued = []; applied.position += 512; return reading() },
    live_engine_export: ({path}) => ({path, frames: applied.position, events: 0, complete: true}),
  }
  const kernel = op => {
    if (op.op === 'live_set_read') return {result: 'live_set_reading', reading: {summary, document: {path: op.path, tracks: []}, revision: `sha256:${'0'.repeat(64)}`}}
    if (op.op === 'live_track_mixer_write') return {result: 'live_track_mixer_reading', reading: {mixer: {activator: op.control === 'activator' ? op.value : true}}}
    throw new Error(`unexpected kernel op ${op.op}`)
  }
  globalThis.window = {__TAURI_INTERNALS__: {invoke: async (command, args) => {
    calls.push(command === 'kernel_op' ? `kernel_op:${args.op.op}` : command)
    if (command === 'live_shell_config') return {default_set: PATH, product_ids: [], contributions: [], kernel_transport: {kind: 'tauri', invoke: 'kernel_op'},
      runtime_epoch: 'e1', kernel_epoch: 'k1', runtime_scope: {kind: 'host-runtime', epoch: 'e1'}}
    if (command === 'kernel_op') return kernel(args.op)
    if (engineOp[command]) return engineOp[command](args)
    throw new Error(`unexpected command ${command}`)
  }}}
  return calls
}

test('the set\'s mixer writes move the engine while it plays the set, and the UI holds what the engine applied', async () => {
  const calls = nativeHost()
  try {
    const set = writes.liveSetWrites(PATH)
    // not playing: the write is the set's alone (Play bridges the file as it then stands)
    await set.mixerWrite(2, 'activator', false)
    assert.ok(!calls.some(c => c.startsWith('live_engine')), 'no engine is playing the set: nothing is sent to it')
    const played = await engine.liveEngine.play(PATH)
    assert.equal(played.playing, true)
    assert.deepEqual(calls.filter(c => c.startsWith('live_engine')), ['live_engine_open', 'live_engine_play'], 'Play bridges the set, then starts the output')
    calls.length = 0
    await set.mixerWrite(2, 'activator', false)
    assert.deepEqual(calls, ['kernel_op:live_track_mixer_write', 'live_engine_send'], 'the set\'s owner first, then the engine')
    assert.equal(engine.liveEngineState().reading.mixer.tracks[1].active, true, 'asked is not applied: the reading is the engine\'s, from before the block')
    await engine.liveEngine.read()
    assert.equal(engine.liveEngineState().reading.mixer.tracks[1].active, false, 'once a block applied it, the engine\'s reading shows P2 off')
    await set.sendWrite(2, 0, 0.5)
    await set.mixerWrite(0, 'solo', true)
    await set.mixerWrite(0, 'arm', true)
    await engine.liveEngine.read()
    const {mixer} = engine.liveEngineState().reading
    assert.equal(mixer.tracks[1].sends[0], 0.5)
    assert.equal(mixer.tracks[0].solo, true)
    assert.equal(calls.filter(c => c === 'live_engine_send').length, 3, 'Arm sent nothing to the engine')
    await assert.rejects(set.sendWrite(2, 1, 0.5), /^Error: The set keeps it; the engine refused it: track 1 has no send 1$/)
    assert.equal(engine.liveEngineState().error, 'track 1 has no send 1', 'the refusal stands in the engine\'s words')
    const exported = await engine.liveEngine.exportAudio('/tmp/engine.wav')
    assert.deepEqual(exported, {path: '/tmp/engine.wav', frames: 1024, events: 0, complete: true})
    await engine.liveEngine.stop()
    assert.equal(engine.liveEngineState().reading.playing, false)
    calls.length = 0
    await set.mixerWrite(2, 'activator', true)
    assert.ok(!calls.includes('live_engine_send'), 'stopped: the write is the set\'s alone')
  } finally {
    // a failure above must not leave the reading's poll running
    await engine.liveEngine.stop().catch(() => {})
    delete globalThis.window
  }
})
