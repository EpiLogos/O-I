// Live plays a clip (O-I #790). DLW §21.2 Views: "In Clip view, the Torus plays the notes of the clip that you select"; §21.2 Transport:
// "Play | Plays the clips of the part on the torus"; "What strikes the Torus": "A note in a clip | Its key's point, as the clip plays".
// Until the key's point on its helix is ruled (MT1), each note-on strikes through the key path — the Jankó's `janko` stage command, its
// pitch class at velocity over 127 — which the frame runs as the owner's own played voices (nativeField.ts playJanko, planJankoStrike,
// controller.playVoices). The `strike-at` stage command (controller.playAt, #771) is the door a player or the M3 clock strikes points by.
//
// Channels:
// - REAL (tests/fixtures/live-clip-read-2026-10-28.json): the kernel's `live_clip_read` answer for a real set (Live 12 set
//   "screen-pass-r11", track 1, arrangement clip 0 "LABS 10", 131 BPM), read 28 Oct through a private walk bridge on a copy; the path is
//   left out. Its markers are loop off, start 1.105…, end 35.875, and seven of its seventeen notes stand between them.
// - FIXTURE, owner-shaped: a looped clip in the words packages/live-set/src/edit.rs `markers` gives one (start = LoopStart +
//   StartRelative, position = LoopStart, length = LoopEnd − LoopStart).
// - SCRIPTED: the frame's own stage reader and its native field controller, bundled with esbuild as tests/mt2-strike-at-point.test.mjs
//   does, over the controlled scene owner of desktop/cradle/tests/native-expression-fixture.mjs (protocol only, not QL's numbers),
//   which here also discloses a played reading by pitch class (the shape planJankoStrike reads) and keeps every strike it is sent.
// - The clock is a controlled one: time moves only when the test moves it, so each strike's moment is exact.
// O-I #809: a strike lands at the sample the player chooses. Play reads the owner's audio clock (`audio-clock`: where its rendered sound
// stands, its rate, its lookahead and block), anchors the clip one owner lookahead past that sound, and strikes each note-on with its own
// sample cursor (`at_samples_elapsed`) one lookahead before the owner's render reaches it. The owner lands it there (QL-MEF: the native
// render lands a strike at exactly its sample), so a late wake never moves a note: only a wake later than the owner's slack lets one go.
import test, {after} from 'node:test'
import assert from 'node:assert/strict'
import {register, createRequire} from 'node:module'
import {mkdtempSync, readFileSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

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

const player = await import('../src/live/clipPlayer.ts')

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const frame = fileURLToPath(new URL('../../../../desktop/cradle/expressions-app/', import.meta.url))
const journeys = join(frame, 'field-studies-journeys')
const out = mkdtempSync(join(tmpdir(), 'live-clip-play-'))
after(() => rmSync(out, {recursive: true, force: true}))
const cache = new Map()
const bundle = (entry, name) => {
  if (!cache.has(name)) cache.set(name, (async () => {
    const outfile = join(out, `${name}.mjs`)
    await esbuild.build({absWorkingDir: journeys, nodePaths: [join(frame, 'node_modules')], entryPoints: [entry], bundle: true, format: 'esm',
      platform: 'node', outfile, logLevel: 'silent', loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}})
    return import(pathToFileURL(outfile).href)
  })())
  return cache.get(name)
}
const stage = () => bundle(join(journeys, 'src/stageCommands.ts'), 'stage')
const controller = () => bundle(join(journeys, 'src/native-field/controller.ts'), 'controller')
const janko = () => import(pathToFileURL(join(journeys, 'src/native-field/jankoStrike.mjs')).href)
const fixture = () => import(new URL('../../../../desktop/cradle/tests/native-expression-fixture.mjs', import.meta.url))

const REAL = JSON.parse(readFileSync(new URL('./fixtures/live-clip-read-2026-10-28.json', import.meta.url), 'utf8')).answer.outcome.reading.clip
const REAL_BPM = 131
const ADDRESS = {path: '/sets/screen-pass-r11.als', track: 1, at: {arrangement: 0}}
/** The note-ons Live plays of a clip whose loop is off: every note switched on, between the start marker and the end, in time order. */
const realNoteOns = REAL.notes.filter(note => note.on && note.at >= REAL.start && note.at < REAL.end).sort((a, b) => a.at - b.at || a.p - b.p)

/** A looped clip as edit.rs `markers` reads one: LoopStart 4, LoopEnd 8, StartRelative 2 (so playing starts at 6), OutMarker 8. */
const looped = (over = {}) => ({...REAL, name: 'Riff', loop: true, start: 6, end: 8, position: 4, length: 4, notes: [
  {id: 1, p: 60, at: 4, len: 0.5, vel: 127, chance: 1, on: true},
  {id: 2, p: 64, at: 4, len: 0.5, vel: 127, chance: 1, on: true},
  {id: 3, p: 67, at: 6, len: 0.5, vel: 64, chance: 1, on: true},
  {id: 4, p: 71, at: 7.5, len: 0.25, vel: 100, chance: 1, on: false},
  {id: 5, p: 72, at: 8, len: 1, vel: 90, chance: 1, on: true},
  {id: 6, p: 50, at: 2, len: 1, vel: 90, chance: 1, on: true}], ...over})

/** A controlled clock: time moves only when the test runs it, and each wake can come late by `lag` seconds. */
const controlledClock = (start = 100) => {
  let t = start, id = 0
  const timers = []
  const settle = () => new Promise(resolve => setImmediate(resolve))
  return {
    now: () => t,
    later: (run, ms) => { const handle = {at: t + ms / 1000, run, id: ++id}; timers.push(handle); return handle },
    cancel: handle => { const i = timers.indexOf(handle); if (i >= 0) timers.splice(i, 1) },
    pending: () => timers.length,
    settle,
    /** The thread is busy until `to`: time passes and no timer fires. */
    stall: to => { t = Math.max(t, to) },
    async run(to, lag = 0) {
      for (;;) {
        timers.sort((a, b) => a.at - b.at || a.id - b.id)
        const next = timers[0]
        if (!next || next.at > to) break
        timers.shift()
        t = Math.max(t, next.at + lag)
        next.run()
        await settle()
      }
      t = Math.max(t, to)
    },
  }
}

/** The owner's audio clock as the frame answers it: the embedded policy's lookahead and block (controller.ts EMBEDDED_NATIVE_PLAYBACK). */
const CLOCK = {samples_elapsed: '480000', sample_rate: 48000, lookahead_seconds: 0.5, block_frames: 8192}
/** The clip's first beat: one owner lookahead past the sound the owner had rendered when Play read its clock. */
const ANCHOR = 480000 + 24000
/** How late a wake may be and still land its note: the lookahead less the block the owner may render meanwhile. */
const SLACK = 0.5 - 8192 / 48000
const sampleAt = seconds => String(ANCHOR + Math.round(seconds * 48000))

/** A player over the controlled clock: the set's owner answers `clip`, the owner's audio clock `audio` (or its refusal), and the torus
 * takes every strike (its answer from `answer`). */
const harness = ({clip = REAL, answer = () => ({ok: true}), random = () => 0, audio = () => CLOCK} = {}) => {
  const clock = controlledClock()
  const sent = [], watchers = new Set(), reads = []
  let reading = clip
  const owners = {
    read: async address => { assert.deepEqual(address, ADDRESS, 'the clip is read from the place the selection names'); return reading },
    clock: async () => { reads.push(clock.now()); return audio() },
    strike: async command => { sent.push({at: clock.now(), command}); return answer(command) },
    watch: (_address, changed) => { watchers.add(changed); return () => watchers.delete(changed) },
    now: clock.now, later: clock.later, cancel: clock.cancel, random,
  }
  const p = player.createClipPlayer(owners)
  return {p, clock, sent, reads, watchers, set: next => { reading = next; for (const changed of [...watchers]) changed() }}
}

// ---------------------------------------------------------------------------------------------------- the clip's plan, from its owner

test('the clip plays as Live plays it: its loop off, from the start marker to the end, each note-on at its velocity over 127', () => {
  const plan = player.clipPlan(REAL)
  assert.equal(plan.ok, true, plan.reason)
  assert.deepEqual([plan.first.from, plan.first.to], [REAL.start, REAL.end], 'one pass, between the clip\'s own markers')
  assert.equal(plan.again, null, 'a clip whose loop is off plays once')
  assert.equal(realNoteOns.length, 7, 'seven of the seventeen notes stand between the markers')
  assert.deepEqual(plan.first.strikes.map(strike => ({beat: strike.beat, command: strike.command})), realNoteOns.map(note => ({beat: note.at,
    command: {command: 'janko', action: 'play', pitch_classes: [note.p % 12], amplitude: note.vel / 127}})), 'each note-on is one strike of its key, in time order')
})

test('a looped clip plays from its start marker to its loop end, then its loop again and again', () => {
  const plan = player.clipPlan(looped())
  assert.equal(plan.ok, true, plan.reason)
  assert.deepEqual([plan.first.from, plan.first.to], [6, 8], 'the first pass starts at the start marker')
  assert.deepEqual([plan.again.from, plan.again.to], [4, 8], 'then the loop, position to position + length')
  assert.deepEqual(plan.first.strikes.map(s => [s.beat, s.command.pitch_classes]), [[6, [7]]], 'the switched-off note and the note at the loop end never sound')
  assert.deepEqual(plan.again.strikes.map(s => [s.beat, s.command.pitch_classes, s.command.amplitude]), [[4, [0, 4], 1], [6, [7], 64 / 127]],
    'two keys struck together at one velocity are one act; a note before the loop is not in it')
})

test('notes struck together at different velocities are separate acts at one moment; one key in two octaves is struck once', () => {
  const plan = player.clipPlan(looped({notes: [
    {id: 1, p: 60, at: 6, len: 1, vel: 100, chance: 1, on: true}, {id: 2, p: 72, at: 6, len: 1, vel: 100, chance: 1, on: true},
    {id: 3, p: 64, at: 6, len: 1, vel: 50, chance: 1, on: true}]}))
  assert.deepEqual(plan.first.strikes.map(s => [s.beat, s.command.pitch_classes, s.command.amplitude]), [[6, [4], 50 / 127], [6, [0], 100 / 127]])
})

test('a clip with nothing to play is refused in words, before anything is struck', () => {
  assert.match(player.clipPlan({...REAL, kind: 'audio', notes: undefined}).reason, /audio clip/)
  assert.match(player.clipPlan({...REAL, notes: []}).reason, /no notes/)
  assert.match(player.clipPlan({...REAL, start: 40, end: 45}).reason, /No note of the clip stands between/)
  assert.match(player.clipPlan({...REAL, end: REAL.start}).reason, /ends where it starts/)
  assert.match(player.clipPlan(looped({length: 0})).reason, /loop has no length/)
  assert.match(player.clipPlan({...REAL, start: undefined}).reason, /markers/)
})

// ---------------------------------------------------------------------------------------------------- the player, in time

test('Play anchors the clip one owner lookahead past its rendered sound and strikes each note-on at its own sample, one lookahead ahead', async () => {
  const {p, clock, sent, reads} = harness()
  const pressed = clock.now()
  p.play(ADDRESS, REAL_BPM)
  await clock.settle()
  assert.equal(p.state().playing?.name, 'LABS 10')
  assert.deepEqual(reads, [pressed], 'the owner\'s audio clock is read once, at the press')
  const beat = 60 / REAL_BPM
  await clock.run(pressed + 600)
  assert.equal(sent.length, realNoteOns.length, 'every note-on was struck')
  realNoteOns.forEach((note, i) => {
    const offset = (note.at - REAL.start) * beat
    assert.ok(Math.abs(sent[i].at - (pressed + offset)) < 1e-9, `note ${i} is sent one lookahead before the owner reaches it`)
    assert.deepEqual(sent[i].command, {command: 'janko', action: 'play', pitch_classes: [note.p % 12], amplitude: note.vel / 127,
      at_samples_elapsed: sampleAt(offset)}, `note ${i} lands at its own sample`)
  })
  assert.equal(p.state().playing, null, 'the clip played to its end and stopped')
  assert.equal(clock.pending(), 0, 'no timer is left behind')
})

test('Stop ends it: nothing more strikes, and no timer is left', async () => {
  const {p, clock, sent, watchers} = harness()
  const pressed = clock.now(), beat = 60 / REAL_BPM
  p.play(ADDRESS, REAL_BPM)
  await clock.settle()
  await clock.run(pressed + (realNoteOns[2].at - REAL.start) * beat + 1e-6)
  assert.equal(sent.length, 3)
  p.stop()
  assert.equal(p.state().playing, null)
  assert.equal(clock.pending(), 0, 'the next strike\'s timer is cancelled')
  assert.equal(watchers.size, 0, 'the clip is no longer watched')
  await clock.run(pressed + 600)
  assert.equal(sent.length, 3, 'nothing strikes after Stop')
})

test('a looped clip strikes its loop again and again, each pass at its own samples, and takes an edit at the next pass', async () => {
  const {p, clock, sent, set} = harness({clip: looped()})
  const pressed = clock.now(), beat = 60 / 120
  p.play(ADDRESS, 120)
  await clock.settle()
  // Pass 1: 6 → 8 (2 beats). Pass 2 from beat 2 after the anchor: 4 → 8. Pass 3 from beat 6.
  await clock.run(pressed + 6 * beat - 1e-6)
  assert.deepEqual(sent.map(s => [s.command.at_samples_elapsed, s.command.pitch_classes]),
    [[sampleAt(0), [7]], [sampleAt(2 * beat), [0, 4]], [sampleAt(4 * beat), [7]]])
  set(looped({notes: [{id: 9, p: 62, at: 5, len: 1, vel: 127, chance: 1, on: true}]}))
  await clock.settle()
  await clock.run(pressed + 10 * beat - 1e-6)
  assert.deepEqual(sent.slice(3).map(s => [s.command.at_samples_elapsed, s.command.pitch_classes]), [[sampleAt(7 * beat), [2]]],
    'the edited loop plays from the next pass')
  assert.equal(p.state().playing?.name, 'Riff', 'a looped clip plays on until Stop')
  p.stop()
})

test('a late wake never moves a note: it lands at its own sample; a stall past the owner\'s slack lets a note go and counts it', async () => {
  // The looped clip at 120 BPM strikes once a second: pass 1 at 0 s; then each loop pass of 2 s strikes at its start and 1 s in.
  const {p, clock, sent} = harness({clip: looped()})
  const pressed = clock.now()
  p.play(ADDRESS, 120)
  await clock.settle()
  await clock.run(pressed + 0.5, 0.05)
  assert.equal(sent.length, 1, 'a wake 50 ms late still strikes')
  assert.ok(Math.abs(sent[0].at - (pressed + 0.05)) < 1e-9, 'sent late by the wake')
  assert.equal(sent[0].command.at_samples_elapsed, sampleAt(0), 'and still lands at its own sample')
  await clock.run(pressed + 1.5, SLACK - 0.01)
  assert.equal(sent.length, 2, 'a wake just inside the owner\'s slack still lands')
  assert.equal(sent[1].command.at_samples_elapsed, sampleAt(1))
  assert.equal(p.state().missed, 0)
  // The thread stalls: the strikes due at 2, 3, 4 and 5 s are past the owner's slack when it wakes at 5.5 s.
  clock.stall(pressed + 5.5)
  await clock.run(pressed + 5.5)
  assert.equal(sent.length, 2, 'the backlog is not struck at once')
  assert.equal(p.state().missed, 4, 'every note-on the stall passed is counted as missed')
  await clock.run(pressed + 6.5)
  assert.equal(sent.length, 3, 'the clip keeps its own time after a stall')
  assert.ok(Math.abs(sent[2].at - (pressed + 6)) < 1e-9)
  assert.equal(sent[2].command.at_samples_elapsed, sampleAt(6), 'the next note-on lands at its own sample')
  p.stop()
})

test('Play refuses in words when the owner\'s audio clock cannot be read or leaves no time to schedule ahead', async () => {
  for (const [audio, words] of [
    [() => { throw new Error('The field is not running: resume it, then play') }, /audio clock: The field is not running/],
    [() => ({...CLOCK, lookahead_seconds: 8192 / 48000}), /no time to strike ahead/],
  ]) {
    const {p, clock, sent} = harness({audio})
    p.play(ADDRESS, REAL_BPM)
    await clock.settle()
    await clock.run(clock.now() + 600)
    assert.equal(p.state().playing, null)
    assert.match(p.state().fault, words)
    assert.equal(sent.length, 0, 'nothing strikes without the owner\'s clock')
    assert.equal(clock.pending(), 0)
  }
})

test('a note with a chance sounds as often as its chance says, by the player\'s own draw', async () => {
  const chancy = looped({loop: false, start: 4, end: 8, notes: [
    {id: 1, p: 60, at: 4, len: 1, vel: 127, chance: 0.25, on: true}, {id: 2, p: 64, at: 4, len: 1, vel: 127, chance: 1, on: true},
    {id: 3, p: 67, at: 5, len: 1, vel: 127, chance: 0.25, on: true}]})
  const draws = [0.9, 0.1]
  const {p, clock, sent} = harness({clip: chancy, random: () => draws.shift()})
  p.play(ADDRESS, 120)
  await clock.settle()
  await clock.run(clock.now() + 10)
  assert.deepEqual(sent.map(s => s.command.pitch_classes), [[4], [7]], 'the first chance missed its draw, the second made it')
  assert.deepEqual(sent.map(s => s.command.at_samples_elapsed), [sampleAt(0), sampleAt(0.5)])
})

test('the torus\'s refusal is named and the clip keeps its time; a clip the owner cannot read never starts', async () => {
  const {p, clock} = harness({answer: () => ({ok: false, error: 'No voice of this sky sounds at E'})})
  p.play(ADDRESS, REAL_BPM)
  await clock.settle()
  await clock.run(clock.now() + 9)
  assert.equal(p.state().refused, 'No voice of this sky sounds at E')
  assert.ok(p.state().playing, 'a refused note does not stop the clip')
  p.stop()
  const audio = harness({clip: {...REAL, kind: 'audio', notes: undefined}})
  audio.p.play(ADDRESS, REAL_BPM)
  await audio.clock.settle()
  assert.equal(audio.p.state().playing, null)
  assert.match(audio.p.state().fault, /audio clip/)
  assert.equal(audio.clock.pending(), 0)
})

// ---------------------------------------------------------------------------------------------------- each note-on reaches the owner

const openController = async () => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture()
  const THREE = await import(pathToFileURL(join(frame, 'node_modules/three/build/three.module.js')).href)
  const {NativeFieldController} = await controller()
  class Owner extends ControlledSceneOwner {
    strikes = []
    strikesAt = []
    /** The played reading by pitch class (the shape planJankoStrike reads): each class on one of the owner's voices. */
    influence() {
      const influence = super.influence()
      return {...influence, played_addresses: {by_class: Array.from({length: 12}, (_, pitch_class) => {
        const voice = influence.voices[pitch_class % influence.voices.length]
        return {pitch_class, voices: [{mode_ref: `scene:planet/${voice.planet_ref}`, planet_ref: voice.planet_ref}]}
      })}}
    }
    /** Each strike as the owner took it: its act, and the sample cursor it lands at (none: at the owner's cursor). */
    async request(request) {
      const command = request.request?.command
      if (command?.operation !== 'strike' && command?.operation !== 'strike-at') return super.request(request)
      const read = structuredClone(request)
      read.request.command = {operation: 'read'}
      const reply = await super.request(read)
      const took = {cursor: this.frame.samples_elapsed, at: command.at_samples_elapsed}
      if (command.operation === 'strike') this.strikes.push({...took, act: structuredClone(command.strikes)})
      else this.strikesAt.push({...took, act: structuredClone(command.points)})
      this.bump(1n)
      reply.field = structuredClone(this.frame)
      reply.field.audio = []
      return reply
    }
  }
  const texture = () => new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType)
  const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), setTargetTextures() {}}
  const renderer = {retainedTopology: () => ({tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}), retainedTargetPort: () => port, setNativeDomain() {},
    releaseRetainedField() {}, onRetainedRecoveryRequired: () => () => {}, checkpointRetainedField() { return {receipt: {}}; }, restoreRetainedField() {}}
  const owner = new Owner(), audio = new ControlledAudio(), c = new NativeFieldController(owner, renderer, () => audio)
  await c.compose({sky: 'none'})
  // The session pumps the owner's sound ahead on its own timer; wait for its first block, so the owner's cursor stands past zero.
  for (let i = 0; i < 400 && c.reading.native?.acknowledged?.samples_elapsed === '0'; i++) await new Promise(resolve => setTimeout(resolve, 5))
  assert.notEqual(c.reading.native?.acknowledged?.samples_elapsed, '0', 'the owner has rendered sound ahead')
  return {owner, c}
}

/** The stage channel as the candidate runs it: the host posts the exact message (stageRequestMessage), the frame reads it
 * (readStageRequest) and runs its own case — `janko` through nativeField.ts playJanko, `strike-at` through controller.playAt, and
 * `audio-clock` as the controller's audioClock — and answers with stageReplyMessage, which the host reads back (readStageResult). */
const frameChannel = async c => {
  const {stageRequestMessage, readStageRequest, stageReplyMessage, readStageResult} = await stage()
  const {planJankoStrike} = await janko()
  let req = 0
  const pending = []
  const run = async command => {
    const message = stageRequestMessage(++req, command)
    assert.ok(message, `the host posts ${JSON.stringify(command)}`)
    const read = readStageRequest(message)
    assert.deepEqual(read, {req, command}, 'the frame reads the command the player sent, exactly')
    const at = read.command.at_samples_elapsed
    let clock
    if (read.command.command === 'janko') {
      const plan = planJankoStrike(c.reading.instrument?.influence?.played_addresses, read.command.pitch_classes)
      if (plan.refusal) throw new Error(plan.refusal)
      await c.playVoices(plan.refs, read.command.amplitude, at)
    } else if (read.command.command === 'strike-at') await c.playAt(read.command.points, read.command.amplitude, at)
    else if (read.command.command === 'audio-clock') clock = c.audioClock()
    else throw new Error(`not a strike: ${read.command.command}`)
    const {req: answered, ...result} = readStageResult(stageReplyMessage(req, clock ? {ok: true, clock} : {ok: true}, read.command))
    assert.equal(answered, req)
    return result
  }
  return {strike: command => { const done = run(command); pending.push(done); return done }, settled: () => Promise.all(pending)}
}

test('the owner\'s audio clock is the frame\'s own: where its rendered sound stands, its rate, its lookahead and its block', async () => {
  const {c} = await openController()
  try {
    const native = c.reading.native, policy = c.reading.playback_policy
    assert.deepEqual(c.audioClock(), {samples_elapsed: native.acknowledged.samples_elapsed, sample_rate: 48000,
      lookahead_seconds: policy.lookaheadSeconds, block_frames: policy.blockFrames})
    const channel = await frameChannel(c)
    assert.deepEqual(await player.readAudioClock(channel.strike), c.audioClock(), 'the player reads it through the stage channel')
  } finally { await c.dispose() }
  const {NativeFieldController} = await controller()
  const closed = new NativeFieldController({request: async () => { throw new Error('no owner') }}, {}, () => { throw new Error('no audio') })
  assert.throws(() => closed.audioClock(), /Open the live instrument first/)
})

test('each note-on of the real clip reaches the owner at its own sample: its key\'s voices, at its velocity over 127, in the clip\'s order', async () => {
  const {owner, c} = await openController()
  try {
    const channel = await frameChannel(c)
    const clock = controlledClock()
    const clocks = []
    const p = player.createClipPlayer({read: async () => REAL, strike: channel.strike, watch: () => () => {}, now: clock.now, later: clock.later,
      cancel: clock.cancel, random: () => 0, clock: async () => { const read = await player.readAudioClock(channel.strike); clocks.push(read); return read }})
    const pressed = clock.now()
    p.play(ADDRESS, REAL_BPM)
    await new Promise(resolve => setTimeout(resolve, 20))
    await clock.run(pressed + 600)
    await channel.settled()
    assert.equal(clocks.length, 1)
    const {samples_elapsed, sample_rate, lookahead_seconds} = clocks[0]
    const anchor = BigInt(samples_elapsed) + BigInt(Math.round(lookahead_seconds * sample_rate)), beat = 60 / REAL_BPM
    const voices = c.reading.instrument.influence.voices
    const refOf = pc => `scene:planet/${voices[pc % voices.length].planet_ref}`
    assert.deepEqual(owner.strikes.map(({at, act}) => ({at, act})), realNoteOns.map(note => ({
      at: String(anchor + BigInt(Math.round((note.at - REAL.start) * beat * sample_rate))),
      act: [{mode_ref: refOf(note.p % 12), amplitude: [note.vel / 127, 0]}]})),
      'one owner strike per note-on, on the voice the owner names for its key, at its own sample')
    for (const {at, cursor} of owner.strikes) assert.ok(BigInt(at) > BigInt(cursor), `the strike at ${at} reached the owner ahead of its cursor ${cursor}`)
    assert.equal(c.reading.instrument.played.strikes, realNoteOns.length)
    assert.equal(c.reading.instrument.struck.source, 'note', 'the plate follows the voices the clip struck')
    assert.deepEqual(c.reading.instrument.struck.refs, [refOf(realNoteOns.at(-1).p % 12)])
  } finally { await c.dispose() }
})

test('a strike at points reaches the owner through the frame with its sample: the points, the amplitude and the cursor the command names', async () => {
  const {owner, c} = await openController()
  try {
    const channel = await frameChannel(c)
    const points = [{theta: 0.5, phi: 1.25}, {theta: 2, phi: 6.2}]
    const at = String(BigInt(c.audioClock().samples_elapsed) + 4800n)
    assert.deepEqual(await channel.strike({command: 'strike-at', points, amplitude: 0.4, at_samples_elapsed: at}), {ok: true})
    await channel.strike({command: 'strike-at', points, amplitude: 0.4})
    assert.deepEqual(owner.strikesAt.map(({at, act}) => ({at, act})), [{at, act: points.map(point => ({...point, amplitude: [0.4, 0]}))},
      {at: undefined, act: points.map(point => ({...point, amplitude: [0.4, 0]}))}], 'a strike with no cursor lands at the owner\'s own')
    assert.equal(c.reading.instrument.struck.source, 'point')
    assert.deepEqual(c.reading.instrument.struck.points, points)
  } finally { await c.dispose() }
})

test('a sample behind the owner\'s cursor is sound already rendered: the owner\'s own session refuses it before any exchange', async () => {
  const {owner, c} = await openController()
  try {
    const behind = String(BigInt(c.audioClock().samples_elapsed) - 1n)
    await assert.rejects(c.playAt([{theta: 1, phi: 1}], 0.4, behind), /already rendered/)
    await assert.rejects(c.playVoices([`scene:planet/${c.reading.instrument.influence.voices[0].planet_ref}`], 0.4, behind), /already rendered/)
    assert.deepEqual([owner.strikes.length, owner.strikesAt.length], [0, 0], 'nothing reached the owner')
    assert.equal(c.reading.status, 'following', 'a refused note leaves the field running')
  } finally { await c.dispose() }
})

test('the frame runs each strike through the native field with its sample, and answers the audio clock from its controller', () => {
  const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8')
  const run = app.slice(app.indexOf('async function runStageCommand('), app.indexOf('async function answerStageCommand('))
  assert.match(run, /case 'janko':[\s\S]*?await nativeField\.playJanko\(command\.pitch_classes,command\.amplitude,command\.at_samples_elapsed\);/)
  assert.match(run, /case 'strike-at':[\s\S]*?await nativeField\.controller\.playAt\(command\.points,command\.amplitude,command\.at_samples_elapsed\);/)
  assert.match(run, /case 'audio-clock':[\s\S]*?return \{ok:true,clock:nativeField\.controller\.audioClock\(\)\};/)
  const answer = app.slice(app.indexOf('async function answerStageCommand('), app.indexOf('function openStudioSection('))
  assert.match(answer, /const answer=await runStageCommand\(command\);window\.parent\.postMessage\(stageReplyMessage\(req,answer,command\),'\*'\);/)
  const nativeField = readFileSync(join(journeys, 'src/nativeField.ts'), 'utf8')
  const body = nativeField.slice(nativeField.indexOf('const playJanko='), nativeField.indexOf('const touch=('))
  assert.match(body, /planJankoStrike\(reading\.instrument\?\.influence\?\.played_addresses,pitchClasses\)/)
  assert.match(body, /await controller\.playVoices\(plan\.refs,amplitude,at\)/)
})

// ---------------------------------------------------------------------------------------------------- Live's transport

const following = {ok: true, value: {standing: 'following'}, determinants: null, parameters: null}
const idle = {playing: null, starting: false, refused: null, missed: 0, fault: null}
const words = over => {
  const calls = []
  const bindings = player.clipPlayBindings({address: ADDRESS, title: '3-LABS · clip 1', bpm: REAL_BPM, torus: following, state: idle,
    play: (...args) => calls.push(['play', ...args]), stop: () => calls.push(['stop']), ...over})
  return {bindings, calls}
}

test('Play plays the selected clip on the torus; Stop ends it; each is refused in words when it cannot', () => {
  const ready = words()
  assert.equal(ready.bindings.play.lit, false)
  assert.match(ready.bindings.play.title, /3-LABS · clip 1/)
  ready.bindings.play.press()
  assert.deepEqual(ready.calls, [['play', ADDRESS, REAL_BPM]])
  assert.match(ready.bindings.stop.refused, /Nothing plays/)
  const playing = words({state: {...idle, playing: {address: ADDRESS, name: 'LABS 10', bpm: REAL_BPM}}})
  assert.equal(playing.bindings.play.lit, true, 'Play lights while the clip plays, so Space stops it')
  playing.bindings.stop.press()
  assert.deepEqual(playing.calls, [['stop']])
  assert.match(words({address: null}).bindings.play.refused, /Select a clip/)
  assert.match(words({bpm: null}).bindings.play.refused, /tempo/)
  assert.match(words({torus: null}).bindings.play.refused, /torus/)
  assert.match(words({torus: {...following, value: {standing: 'held'}}}).bindings.play.refused, /held/)
  assert.match(words({state: {...idle, fault: 'An audio clip has no notes'}}).bindings.play.title, /An audio clip has no notes/)
  const refused = words({state: {...idle, playing: {address: ADDRESS, name: 'LABS 10', bpm: REAL_BPM}, refused: 'No voice of this sky sounds at E'}})
  assert.match(refused.bindings.play.title, /No voice of this sky sounds at E/)
  const starting = words({state: {...idle, starting: true}})
  assert.match(starting.bindings.play.refused, /Reading the clip/)
  starting.bindings.stop.press()
  assert.deepEqual(starting.calls, [['stop']], 'Stop also ends a press whose clip is still being read')
})

test('the clip the selection names is the clip Play reads: a Live clip or slot of a set, nothing else', () => {
  assert.deepEqual(player.clipAddressOf({mode: 'live', kind: 'live-clip', ref: 'als:/sets/a b.als#track/3/clip/2', title: 't'}), {path: '/sets/a b.als', track: 3, at: {arrangement: 2}})
  assert.deepEqual(player.clipAddressOf({mode: 'live', kind: 'live-slot', ref: 'als:/sets/a.als#track/0/slot/5', title: 't'}), {path: '/sets/a.als', track: 0, at: {slot: 5}})
  assert.equal(player.clipAddressOf({mode: 'live', kind: 'live-track', ref: 'als:/sets/a.als#track/0', title: 't'}), null, 'a track is not a clip')
  assert.equal(player.clipAddressOf({mode: 'expressions', kind: 'scene', ref: 'als:/sets/a.als#track/0/clip/1', title: 't'}), null)
  assert.equal(player.clipAddressOf(undefined), null)
})

test('Live\'s transport binds Play and Stop through the clip player, over THE selection and the set\'s tempo', () => {
  // Live's bindings are their own module, loaded with Live's transport (shell/transports/useLiveTransport.tsx; O-I #740).
  const source = readFileSync(new URL('../src/shell/transports/useLiveTransport.tsx', import.meta.url), 'utf8')
  const live = source.slice(source.indexOf('export const useLiveTransport'))
  assert.match(live, /const clip = useLiveClipPlay\(useOptionalContinuity\(\)\?\.current\.context\?\.selection, tempoBpm\)/)
  assert.match(live, /return \{\n\s+\.\.\.clip,/, 'Play and Stop are the clip player\'s')
})
