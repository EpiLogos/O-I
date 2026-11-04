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
  assert.deepEqual(engine.engineEventOfMixerWrite(KINDS, 2, 'volume', 0.5), {kind: 'volume', part: {track: 1}, gain: 0.5})
  assert.deepEqual(engine.engineEventOfMixerWrite(KINDS, 3, 'volume', 0.7), {kind: 'volume', part: {return: 0}, gain: 0.7})
  assert.deepEqual(engine.engineEventOfMixerWrite(KINDS, 4, 'pan', -0.5), {kind: 'pan', part: 'main', pan: -0.5})
  assert.equal(engine.engineEventOfMixerWrite(KINDS, 1, 'volume', 0.5), null, 'a group is not hosted')
  assert.equal(engine.engineEventOfMixerWrite(KINDS, 0, 'volume', true), null, 'a volume is a number')
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
    engine.engineEventOfMixerWrite(KINDS, 2, 'solo', true), engine.engineEventOfSendWrite(KINDS, 2, 0, 0.5),
    engine.engineEventOfMixerWrite(KINDS, 0, 'volume', 0.25), engine.engineEventOfMixerWrite(KINDS, 4, 'pan', 0.3),
    // A Torus act, as its owner's torus-play names it (O-I #849).
    {kind: 'torus_play', track: 0, keys: [{row: 2, column: 3}], amplitude: [0.3, 0]}]
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
  await assert.rejects(engine.liveEngine.torus('lease:1', 0, 'sha256:0'), /\(live_engine_torus\)/)
  await assert.rejects(engine.liveEngine.read(), /\(live_engine_mixer\)/)
  await assert.rejects(engine.liveEngine.exportAudio(), here)
  assert.equal(engine.liveEngineState().reading, null, 'nothing is held that the engine did not answer')
  assert.match(engine.liveEngineState().error, here)
  assert.deepEqual([...engine.LIVE_ENGINE_OPS], ['live_engine_open', 'live_engine_play', 'live_engine_stop', 'live_engine_send', 'live_engine_torus', 'live_engine_mixer', 'live_engine_export'])
  for (const name of engine.LIVE_ENGINE_OPS) assert.match(hostSource, new RegExp(`pub (async )?fn ${name}\\(`), `the host serves ${name}`)
})

/** A native host standing in: the set owner's ops in the kernel's shape, and the engine as live_engine_host.rs answers — a move sent is
 * queued, and the reading shows it only after a block (here, the next live_engine_mixer read) applied it. */
const exportArgs = []
function nativeHost({refuseOpen = null} = {}) {
  const calls = []
  const part = name => ({name, gain: 1, pan: 0, active: true, solo: false, sends: [0], midi: name === 'P0'})
  let applied = null, queued = []
  exportArgs.length = 0
  const reading = () => structuredClone(applied)
  const apply = event => {
    const {mixer} = applied
    const at = p => p === 'main' ? mixer.main : 'track' in p ? mixer.tracks[p.track] : mixer.returns[p.return]
    if (event.kind === 'active') at(event.part).active = event.on
    if (event.kind === 'solo') mixer.tracks[event.track].solo = event.on
    if (event.kind === 'send') mixer.tracks[event.track].sends[event.send] = event.gain
    if (event.kind === 'volume') at(event.part).gain = event.gain
    if (event.kind === 'pan') at(event.part).pan = event.pan
  }
  const engineOp = {
    live_engine_open: ({path}) => { if (refuseOpen?.(path)) throw refuseOpen(path); applied = {path, sample_rate: 48000, position: 0, playing: false, warnings: ['P1: a group is not hosted'],
      mixer: {tracks: [part('P0'), part('P2')], returns: [part('P3')], main: part('Main')}}; return reading() },
    live_engine_play: () => { applied.playing = true; return reading() },
    live_engine_stop: () => { applied.playing = false; return reading() },
    live_engine_send: ({event}) => { if (event.kind === 'send' && event.send > 0) throw `track ${event.track} has no send ${event.send}`; queued.push(event); return reading() },
    live_engine_mixer: () => { for (const event of queued) apply(event); queued = []; applied.position += 512; return reading() },
    // the host chooses the file in its own save dialog: the page names none (live_engine_host.rs live_engine_export)
    live_engine_export: args => { exportArgs.push(args); return {path: '/Users/me/Exports/engine.wav', frames: applied.position, events: 0, complete: true} },
  }
  const kernel = op => {
    if (op.op === 'live_set_read' && op.path === '/sets/unreadable.als') throw 'The set owner cannot read /sets/unreadable.als: no such file.'
    if (op.op === 'live_set_read') return {result: 'live_set_reading', reading: {summary: {...summary, path: op.path}, document: {path: op.path, tracks: []}, revision: `sha256:${'0'.repeat(64)}`}}
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
    const mark = calls.length
    await set.mixerWrite(2, 'volume', 0.5)
    await set.mixerWrite(4, 'pan', 0.3)
    assert.deepEqual(calls.slice(mark).filter(call => call !== 'kernel_op:live_set_read'), ['kernel_op:live_track_mixer_write', 'live_engine_send', 'kernel_op:live_track_mixer_write', 'live_engine_send'],
      'Volume and Pan: the set\'s owner keeps them (a replay bridges them), then the engine moves')
    await engine.liveEngine.read()
    assert.deepEqual([engine.liveEngineState().reading.mixer.tracks[1].gain, engine.liveEngineState().reading.mixer.main.pan], [0.5, 0.3],
      'the engine applied P2\'s volume and the Main track\'s pan')
    const exported = await engine.liveEngine.exportAudio()
    assert.deepEqual(exported, {path: '/Users/me/Exports/engine.wav', frames: 1536, events: 0, complete: true})
    assert.deepEqual(exportArgs, [{}], 'the page names no path: the host asks the person where the file goes')
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

// The mixer row's Volume and Pan (manual §21.1 "The mixer row"; O-I #849): the part's reading is the set's — its owner's, read back
// from the file — and, while the engine plays the set, the engine's applied mixer; a move is written through the set's owner.
const adapter = await import('../src/timeline/liveSetTrackAdapter.ts')
const lanes = await import('../src/frame/tracks/trackLanes.ts')
globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {MixerRow} = await import('../src/frame/tracks/SessionGrid.tsx')
const dB = gain => Math.round(20 * Math.log10(gain) * 100) / 100
const row = (kind, name, mixer) => ({kind, name, devices: [], arrangementClips: [], sessionSlots: {}, mixer, takeLanes: [], automation: []})
const mixSet = {path: PATH, tempo_bpm: 120, scene_count: 1, arrangement_clips: 0,
  tracks: [{kind: 'midi', name: 'Keys', devices: []}, {kind: 'return', name: 'A-Echo', devices: []}, {kind: 'master', name: 'Main', devices: []}]}
const mixDocument = {path: PATH, tempo: 120, scenes: 1, tracks: [row('midi', 'Keys', {activator: true, volume: 0.5, pan: -0.25}),
  row('return', 'A-Echo', {activator: true, volume: 1, pan: 0}), row('master', 'Main', {activator: true, volume: 0.9})]}
const engineMix = (gain, pan) => ({name: 'x', gain, pan, active: true, solo: false, sends: [], midi: false})
const playing = {path: PATH, sample_rate: 48000, position: 0, playing: true, warnings: [],
  mixer: {tracks: [engineMix(0.25, 0.5)], returns: [engineMix(0.5, 0)], main: engineMix(1, 0.3)}}

test('a part\'s Volume and Pan stand on its mixer row: the set\'s reading, the engine\'s while it plays, each written through the set\'s owner', async () => {
  const wrote = []
  const project = engineReading => adapter.liveSetTrackAdapter.project({set: mixSet, document: mixDocument, engine: engineReading,
    mixerWrite: async (...args) => { wrote.push(args) }})
  const tracks = project(null)
  const [keys, ret, main] = tracks.tracks
  assert.deepEqual([dB(10 ** (keys.mix.volume / 20)), keys.mix.pan], [-6.02, -0.25], 'Keys: −6.02 dB, a quarter left, as the set holds them')
  assert.deepEqual([ret.mix.volume, ret.mix.pan], [0, 0])
  assert.equal(main.mix.pan, undefined, 'a pan the set holds none of stays unread')
  assert.ok(tracks.mixer.volume && tracks.mixer.pan && !tracks.mixer.volume.disabled && !tracks.mixer.pan.disabled, 'written by the set\'s owner')
  const cells = lanes.mixerCells(tracks, keys, 0)
  const volume = cells.find(cell => cell.id === 'volume'), pan = cells.find(cell => cell.id === 'pan')
  assert.deepEqual([volume.level.min, volume.level.max, volume.level.unit], [-70, 6, 'dB'], 'Live\'s range: −70 dB to +6 dB')
  assert.deepEqual([pan.level.min, pan.level.max, pan.level.value], [-1, 1, -0.25])
  await volume.level.set.run(-12)
  await pan.level.set.run(0.5)
  assert.equal(wrote.length, 2)
  assert.deepEqual([wrote[0][0], wrote[0][1], dB(wrote[0][2])], [0, 'volume', -12], 'the set keeps the volume as linear gain')
  assert.deepEqual(wrote[1], [0, 'pan', 0.5])
  assert.deepEqual(await tracks.actions.mixer.volume.run(keys.id, Number.NaN), {ok: false, error: 'The volume takes a level in dB.'})
  // while the engine plays the set, the row reads the engine's applied mixer
  const heard = project(playing)
  assert.deepEqual([dB(10 ** (heard.tracks[0].mix.volume / 20)), heard.tracks[0].mix.pan], [-12.04, 0.5], 'Keys as the engine applied it')
  assert.deepEqual([heard.tracks[1].mix.volume, heard.tracks[2].mix.volume, heard.tracks[2].mix.pan].map(v => Math.round(v * 100) / 100), [-6.02, 0, 0.3],
    'the return and the Main track as the engine applied them')
  assert.match(lanes.mixerCells(heard, heard.tracks[0], 0).find(cell => cell.id === 'volume').title, /as the engine applied it/)
  assert.equal(dB(10 ** (project({...playing, playing: false}).tracks[0].mix.volume / 20)), -6.02, 'stopped: the set\'s reading')
  assert.equal(dB(10 ** (project({...playing, path: '/other.als'}).tracks[0].mix.volume / 20)), -6.02, 'another set playing: this set\'s reading')
  // no writer handed in: dimmed, naming the op
  const read = adapter.liveSetTrackAdapter.project({set: mixSet, document: mixDocument})
  assert.match(read.mixer.volume.disabled, /live_track_mixer_write \{path, track, control: "volume", value: gain\}/)
  assert.equal(lanes.mixerCells(read, read.tracks[0], 0).find(cell => cell.id === 'pan').level.set, undefined, 'a reading, not a control')
  // drawn on the row, each a value box over its owner
  const markup = renderToStaticMarkup(createElement(MixerRow, {cells, shown: true, trackId: keys.id, receipt: null, onPress: () => {}}))
  assert.match(markup, /class="mx-lv"[\s\S]*data-mix="volume"[\s\S]*data-mix="pan"/, 'Volume, then Pan, on the row\'s level line')
})

// Live's mode tracks (frame/tracks/modeTracks.ts) read the engine as it stands when the pane draws, and the pane draws again when the
// engine's reading moves (MODE_REDRAWS, ModeTracksView): Volume and Pan on the row are the engine's while it plays the set.
test('the Live mode\'s tracks read the engine as it stands, and the pane draws again when it moves', async () => {
  const {MODE_TRACKS, MODE_REDRAWS} = await import('../src/frame/tracks/modeTracks.ts')
  nativeHost()
  try {
    const level = shown => [shown.tracks[2].mix && Math.round(shown.tracks[2].mix.volume * 100) / 100, shown.tracks[4].mix?.pan, shown.tracks[2].mix?.levelSource]
    assert.deepEqual(level(MODE_TRACKS.live({set: summary, document: null})), [undefined, undefined, undefined], 'no engine, no document: unread')
    await engine.liveEngine.play(PATH)
    assert.deepEqual(level(MODE_TRACKS.live({set: summary, document: null})), [0, 0, 'as the engine applied it'])
    let drawn = 0
    const off = MODE_REDRAWS.live.subscribe(() => { drawn += 1 })
    const before = MODE_REDRAWS.live.snapshot()
    await engine.liveEngine.send({kind: 'volume', part: {track: 1}, gain: 0.5})
    await engine.liveEngine.send({kind: 'pan', part: 'main', pan: -0.5})
    await engine.liveEngine.read()
    off()
    assert.ok(drawn >= 3 && MODE_REDRAWS.live.snapshot() !== before, 'each answer of the engine\'s draws the pane again')
    assert.deepEqual(level(MODE_TRACKS.live({set: summary, document: null})), [-6.02, -0.5, 'as the engine applied it'])
  } finally {
    await engine.liveEngine.stop().catch(() => {})
    delete globalThis.window
  }
})

// Live's transport (shell/transports/useLiveTransport.tsx): with a clip selected, Play and Stop are the clip player's on the torus
// (manual §21.2 Views, "In Clip view, the Torus plays the notes of the clip that you select"); with none, they play the open set in
// the one engine (§21.1 Rules: every part sounds in one engine, to the Main track), lit while the engine plays THIS set, and a
// refusal stands in the engine's own words.
/** Waits for the engine's answer to a press (a press answers nothing of its own: the engine's state does). */
async function until(ready, ms = 2000) {
  for (const start = Date.now(); !ready(); await new Promise(resolve => setTimeout(resolve, 5))) if (Date.now() - start > ms) throw new Error('the engine did not answer')
}
test('with no clip selected, Live\'s Play and Stop play the open set in the engine, lit for this set, refusing in the engine\'s words', async () => {
  const bind = (path, native = true) => engine.engineTransportBindings(path, engine.liveEngineState(), native)
  assert.match(bind(null).play.refused, /Open a set/, 'no set open: nothing to play')
  assert.match(bind(PATH, false).play.refused, /desktop's audio path, the native candidate's/, 'off the candidate: refused before a press')
  assert.match(bind(PATH).stop.refused, /Nothing plays in the engine/)
  const calls = nativeHost({refuseOpen: path => path === '/sets/elsewhere.als' && 'The engine opens only a set the kernel reads: /sets/elsewhere.als is not one.'})
  try {
    const idle = bind(PATH)
    assert.equal(idle.play.lit, false)
    idle.play.press()
    await until(() => engine.liveEngineState().reading?.playing)
    assert.deepEqual(calls.filter(c => c.startsWith('live_engine')), ['live_engine_open', 'live_engine_play'], 'Play bridges the set and starts it')
    const playing = bind(PATH)
    assert.equal(playing.play.lit, true, 'lit: the engine plays this set')
    assert.match(playing.play.title, /P1: a group is not hosted/, 'what the bridge could not host is said on Play')
    assert.equal(bind('/sets/other.als').play.lit, false, 'another set is not lit by this one playing')
    assert.ok(playing.stop.press, 'Stop stops what the engine plays')
    playing.stop.press()
    await until(() => engine.liveEngineState().reading?.playing === false)
    assert.equal(engine.liveEngineState().reading.playing, false)
    assert.equal(bind(PATH).play.lit, false)
    // the engine refuses: the press answers nothing of its own, and the slot says the engine's words
    bind('/sets/elsewhere.als').play.press()
    await until(() => engine.liveEngineState().error)
    assert.match(bind('/sets/elsewhere.als').play.title, /The engine refused: The engine opens only a set the kernel reads/)
    // the set's owner refuses to read it: Play says so, in the owner's words, and nothing was bridged
    calls.length = 0
    bind('/sets/unreadable.als').play.press()
    await until(() => /unreadable/.test(engine.liveEngineState().error ?? ''))
    assert.match(bind('/sets/unreadable.als').play.title, /The engine refused: .*cannot read \/sets\/unreadable\.als/)
    assert.ok(!calls.includes('live_engine_open'), 'a set its owner cannot read is not bridged')
  } finally {
    await engine.liveEngine.stop().catch(() => {})
    delete globalThis.window
  }
  const source = readFileSync(new URL('../src/shell/transports/useLiveTransport.tsx', import.meta.url), 'utf8')
  const live = source.slice(source.indexOf('export const useLiveTransport'))
  assert.match(live, /const playStop = clipAddressOf\(selection\) \? clip : engine/, 'a selected clip keeps the clip player; else the engine')
  assert.match(live, /\.\.\.playStop,/)
  const bar = readFileSync(new URL('../src/components/TransportBar.tsx', import.meta.url), 'utf8')
  assert.match(bar, /reading=\{\{[^}]*setPath[^}]*\}\}/, 'the bar hands the transport the open set')
})

// The Main track's Volume and Pan in the Session's Main column (Live's Main has no Activator, Solo or Arm: its levels alone), and every
// track's Volume and Pan in its Arrangement head, on a line under its name and switches (manual §21.1 "The mixer row"; Live cap 43).
test('the Main column carries the Main track\'s Volume and Pan, and each Arrangement head its track\'s, each written through the set\'s owner', async () => {
  const wrote = []
  const tracks = adapter.liveSetTrackAdapter.project({set: mixSet, document: mixDocument, mixerWrite: async (...args) => { wrote.push(args) }})
  const {SessionGrid} = await import('../src/frame/tracks/SessionGrid.tsx')
  const {ArrangementRuler} = await import('../src/frame/tracks/ArrangementRuler.tsx')
  const session = renderToStaticMarkup(createElement(SessionGrid, {set: tracks, selection: {select() {}}}))
  const main = session.slice(session.indexOf('class="trk trk-main"'))
  const mainRow = main.slice(main.indexOf('data-mixer="main"'), main.indexOf('data-mixer="main"') + 2000)
  assert.match(mainRow, /class="mx-lv"[\s\S]*data-mix="volume"[\s\S]*data-mix="pan"/, 'the Main column: Volume, then Pan')
  assert.doesNotMatch(mainRow.slice(0, mainRow.indexOf('class="mx-lv"')), /data-mix="(activator|solo|arm)"/, 'and no switch Live\'s Main has none of')
  assert.match(mainRow, /data-mix="volume"[^>]*data-state="on"/, 'the Main track\'s volume, as the set holds it')
  assert.match(mainRow, /data-mix="pan"[^>]*data-state="unread"/, 'a pan the set holds none of stands unread')
  const arrangement = renderToStaticMarkup(createElement(ArrangementRuler, {set: tracks, selection: {select() {}}}))
  const heads = [...arrangement.matchAll(/<div class="tl-head tl-track-head[^"]*">([\s\S]*?)<div class="tl-body">/g)].map(match => match[1])
  assert.equal(heads.length, 3, 'a head per track, the Main track last')
  for (const head of heads) assert.match(head, /<div class="mx-lv">[\s\S]*data-mix="volume"[\s\S]*data-mix="pan"/, 'each head: Volume, then Pan')
  // the Main track's level writes the Main track (the set's last track: live-set edit.rs track_at_mut, the MainTrack after Tracks)
  const level = lanes.mixerCells(tracks, tracks.tracks[2], 2).find(cell => cell.id === 'volume').level
  await level.set.run(-3)
  assert.deepEqual([wrote[0][0], wrote[0][1], dB(wrote[0][2])], [2, 'volume', -3])
})
