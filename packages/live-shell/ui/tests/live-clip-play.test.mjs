// Live plays a clip (O-I #790). DLW §21.2 Views: "In Clip view, the Torus plays the notes of the clip that you select"; §21.2 Transport:
// "Play | Plays the clips of the part on the torus"; "What strikes the Torus": "A note in a clip | Its key's point, as the clip plays".
// MT1 is ruled (owner, 1 Nov: a key's point is dynamic): each note-on strikes its key on the Torus's M1′ session through the part's one
// playing path (live/janko/jankoInput.ts clipStrike: the key a MIDI note of its number strikes, `janko` strike → QL-MEF torus-play, which
// strikes the key's moving point), at its velocity over 127, and each note's length ends in a `janko` release of that key (torus-release).
// The path holds the clip's notes with the keys' and MIDI's, so Polyphony and the notes that make way are counted once. The `strike-at`
// stage command (controller.playAt, #771) stays the door a player or the M3 clock strikes bare points by.
//
// Channels:
// - REAL (tests/fixtures/live-clip-read-2026-10-28.json): the kernel's `live_clip_read` answer for a real set (Live 12 set
//   "screen-pass-r11", track 1, arrangement clip 0 "LABS 10", 131 BPM), read 28 Oct through a private walk bridge on a copy; the path is
//   left out. Its markers are loop off, start 1.105…, end 35.875, and seven of its seventeen notes stand between them.
// - FIXTURE, owner-shaped: a looped clip in the words packages/live-set/src/edit.rs `markers` gives one (start = LoopStart +
//   StartRelative, position = LoopStart, length = LoopEnd − LoopStart).
// - SCRIPTED: the frame's own stage reader and its native field controller, bundled with esbuild as tests/mt2-strike-at-point.test.mjs
//   does, over the controlled scene owner of desktop/cradle/tests/native-expression-fixture.mjs (protocol only, not QL's numbers),
//   taught the Torus's two acts with QL's own count of notes (m1_prime.rs, as the frame's janko-keys-853.test.mjs teaches it), and
//   keeping every act it is sent with the sample it lands at.
// - The owner's Jankó window is tests/fixtures/janko-window-v1.json: a note's key is the path's own (keyForNote at the first touch point).
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

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const player = await import('../src/live/clipPlayer.ts')
const keys = await import('../src/live/janko/jankoInput.ts')
const layout = await import('../src/live/janko/jankoLayout.ts')
const windowState = layout.readJankoWindow(JSON.parse(readFileSync(new URL('./fixtures/janko-window-v1.json', import.meta.url), 'utf8')))
/** A note's key on the owner's surface: the key a MIDI note of its number strikes. */
const keyOf = note => keys.keyForNote(keys.surfaceKeys(windowState.window), note, 0)

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
const fixture = () => import(new URL('../../../../desktop/cradle/tests/native-expression-fixture.mjs', import.meta.url))

const REAL = JSON.parse(readFileSync(new URL('./fixtures/live-clip-read-2026-10-28.json', import.meta.url), 'utf8')).answer.outcome.reading.clip
const REAL_BPM = 131
const ADDRESS = {path: '/sets/screen-pass-r11.als', track: 1, at: {arrangement: 0}}
/** The note-ons Live plays of a clip whose loop is off: every note switched on, between the start marker and the end, in time order. */
const realNoteOns = REAL.notes.filter(note => note.on && note.at >= REAL.start && note.at < REAL.end).sort((a, b) => a.at - b.at || a.p - b.p)
/** A clip's acts on the owner (its loop off), in the order their samples come: each note-on, and each note's end (its own, or the end
 * marker's if that comes first), an end before a note-on at one time, and the ends at one time one release of their keys. */
const actsOf = (clip, bpm = REAL_BPM) => {
  const beat = 60 / bpm
  const ons = clip.notes.filter(note => note.on && note.at >= clip.start && note.at < clip.end).sort((a, b) => a.at - b.at || a.p - b.p)
  const acts = ons.flatMap(note => [
    {kind: 'strike', seconds: (note.at - clip.start) * beat, notes: [note]},
    {kind: 'release', seconds: (Math.min(note.at + note.len, clip.end) - clip.start) * beat, notes: [note]},
  ]).sort((a, b) => a.seconds - b.seconds || (a.kind === b.kind ? 0 : a.kind === 'release' ? -1 : 1))
  return acts.reduce((merged, act) => {
    const last = merged.at(-1)
    if (last && act.kind === 'release' && last.kind === 'release' && last.seconds === act.seconds) last.notes.push(...act.notes)
    else merged.push(act)
    return merged
  }, [])
}

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

/** A player over the controlled clock and the part's playing path: the set's owner answers `clip`, the owner's audio clock `audio` (or
 * its refusal), and the torus takes every act the path sends (its answer from `answer`), each kept with the page's time it was sent. */
const harness = ({clip = REAL, answer = () => ({ok: true}), random = () => 0, audio = () => CLOCK} = {}) => {
  const clock = controlledClock()
  const sent = [], watchers = new Set(), reads = []
  let reading = clip
  const path = keys.createJankoInput({window: () => windowState,
    send: async command => { sent.push({at: clock.now(), command: structuredClone(command)}); return answer(command) }})
  const owners = {
    read: async address => { assert.deepEqual(address, ADDRESS, 'the clip is read from the place the selection names'); return reading },
    clock: async () => { reads.push(clock.now()); return audio() },
    strike: (notes, amplitude, at) => path.clipStrike(notes, amplitude, at),
    release: holds => path.clipRelease(holds),
    watch: (_address, changed) => { watchers.add(changed); return () => watchers.delete(changed) },
    now: clock.now, later: clock.later, cancel: clock.cancel, random,
  }
  const p = player.createClipPlayer(owners)
  return {p, clock, sent, reads, watchers, path, set: next => { reading = next; for (const changed of [...watchers]) changed() }}
}
const strikes = sent => sent.filter(s => s.command.action === 'strike')
const releases = sent => sent.filter(s => s.command.action === 'release')
const notesOf = strike => strike.notes.map(note => note.note)

// ---------------------------------------------------------------------------------------------------- the clip's plan, from its owner

test('the clip plays as Live plays it: its loop off, from the start marker to the end, each note-on at its velocity over 127', () => {
  const plan = player.clipPlan(REAL)
  assert.equal(plan.ok, true, plan.reason)
  assert.deepEqual([plan.first.from, plan.first.to], [REAL.start, REAL.end], 'one pass, between the clip\'s own markers')
  assert.equal(plan.again, null, 'a clip whose loop is off plays once')
  assert.equal(realNoteOns.length, 7, 'seven of the seventeen notes stand between the markers')
  assert.deepEqual(plan.first.strikes, realNoteOns.map(note => ({beat: note.at, notes: [{note: note.p, chance: 1, end: note.at + note.len}],
    amplitude: note.vel / 127})), 'each note-on is one strike of its own note, in time order, held for its own length')
})

test('a looped clip plays from its start marker to its loop end, then its loop again and again', () => {
  const plan = player.clipPlan(looped())
  assert.equal(plan.ok, true, plan.reason)
  assert.deepEqual([plan.first.from, plan.first.to], [6, 8], 'the first pass starts at the start marker')
  assert.deepEqual([plan.again.from, plan.again.to], [4, 8], 'then the loop, position to position + length')
  assert.deepEqual(plan.first.strikes.map(s => [s.beat, notesOf(s)]), [[6, [67]]], 'the switched-off note and the note at the loop end never sound')
  assert.deepEqual(plan.again.strikes.map(s => [s.beat, notesOf(s), s.amplitude]), [[4, [60, 64], 1], [6, [67], 64 / 127]],
    'two notes struck together at one velocity are one act; a note before the loop is not in it')
  assert.deepEqual(plan.again.strikes.map(s => s.notes.map(note => note.end)), [[4.5, 4.5], [6.5]], 'each held for its own length')
})

test('notes struck together at different velocities are separate acts at one moment; one note in two octaves is two notes, a period apart', () => {
  // REPLACES "… one key in two octaves is struck once": a key is a note of the surface now, so middle C and the C above are two keys.
  const plan = player.clipPlan(looped({notes: [
    {id: 1, p: 60, at: 6, len: 1, vel: 100, chance: 1, on: true}, {id: 2, p: 72, at: 6, len: 1, vel: 100, chance: 1, on: true},
    {id: 3, p: 64, at: 6, len: 1, vel: 50, chance: 1, on: true}, {id: 4, p: 60, at: 6, len: 1.5, vel: 100, chance: 0.5, on: true}]}))
  assert.deepEqual(plan.first.strikes.map(s => [s.beat, notesOf(s), s.amplitude]), [[6, [64], 50 / 127], [6, [60, 72], 100 / 127]])
  assert.deepEqual(plan.first.strikes[1].notes[0], {note: 60, chance: 1, end: 7.5}, 'one note written twice at one moment is struck once, for its longer length')
  assert.notDeepEqual(keyOf(60), keyOf(72), 'on two keys')
})

test('a note longer than its pass is let go at the pass\'s end, as Live cuts a note at its loop end or the clip\'s end', () => {
  const plan = player.clipPlan(looped({notes: [{id: 1, p: 60, at: 7, len: 3, vel: 100, chance: 1, on: true}]}))
  assert.deepEqual(plan.first.strikes.map(s => s.notes.map(note => note.end)), [[8]])
  assert.deepEqual(plan.again.strikes.map(s => s.notes.map(note => note.end)), [[8]])
  const once = player.clipPlan({...REAL, end: 21})
  assert.deepEqual(once.first.strikes.map(s => s.notes.map(note => note.end)), [[21]], 'the long first note of the real clip ends at the end marker')
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
  const {p, clock, sent, reads, path} = harness()
  const pressed = clock.now()
  p.play(ADDRESS, REAL_BPM)
  await clock.settle()
  assert.equal(p.state().playing?.name, 'LABS 10')
  assert.deepEqual(reads, [pressed], 'the owner\'s audio clock is read once, at the press')
  await clock.run(pressed + 600)
  await clock.settle()
  // REPLACES the pitch-class act (`janko` play): each note-on is a strike of its own key, and each note's end a release of that key.
  const acts = actsOf(REAL)
  assert.equal(acts.length, 14, 'seven note-ons and seven ends, none at one moment')
  assert.equal(sent.length, acts.length, 'every note-on was struck and every note let go')
  acts.forEach((act, i) => {
    assert.ok(Math.abs(sent[i].at - (pressed + act.seconds)) < 1e-9, `act ${i} is sent one lookahead before the owner reaches it`)
    assert.deepEqual(sent[i].command, act.kind === 'strike'
      ? {command: 'janko', action: 'strike', keys: [keyOf(act.notes[0].p)], amplitude: act.notes[0].vel / 127, at_samples_elapsed: sampleAt(act.seconds)}
      : {command: 'janko', action: 'release', keys: act.notes.map(note => keyOf(note.p))}, `${act.kind} ${i} of note ${act.notes[0].p}, at its own sample`)
  })
  assert.equal(p.state().playing, null, 'the clip played to its end and stopped')
  assert.deepEqual(path.sounding(), [], 'the clip holds nothing once it has played')
  assert.equal(clock.pending(), 0, 'no timer is left behind')
})

test('a clip\'s notes leave as MIDI when they sound: each note-on and each end held for the time to its sample; Stop lets go at once (O-I #853 round 22)', async () => {
  const clock = controlledClock(), out = []
  const path = keys.createJankoInput({window: () => windowState, send: async () => ({ok: true}),
    midiOut: (messages, after) => out.push({at: clock.now(), after, messages})})
  const p = player.createClipPlayer({read: async () => REAL, clock: async () => CLOCK,
    strike: (notes, amplitude, at, sounds) => path.clipStrike(notes, amplitude, at, sounds), release: (holds, sounds) => path.clipRelease(holds, sounds),
    watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0})
  const pressed = clock.now()
  p.play(ADDRESS, REAL_BPM)
  await clock.settle()
  await clock.run(pressed + 600)
  await clock.settle()
  const acts = actsOf(REAL)
  assert.equal(out.length, acts.length, 'every note-on and every end leaves')
  acts.forEach((act, i) => {
    assert.ok(Math.abs(out[i].after - 500) < 1e-6, `act ${i} is held the owner's lookahead, until its sample sounds (${out[i].after})`)
    assert.deepEqual(out[i].messages, act.kind === 'strike'
      ? act.notes.map(note => ({kind: 'on', channel: 0, note: note.p, velocity: note.vel}))
      : act.notes.map(note => ({kind: 'off', channel: 0, note: note.p, velocity: 0})), `${act.kind} ${i}, as written`)
  })
  // A wake that comes late shortens the hold by as much: the note still leaves when its sample sounds.
  out.length = 0
  const again = clock.now(), beat = 60 / REAL_BPM
  p.play(ADDRESS, REAL_BPM)
  await clock.settle()
  await clock.run(again + (realNoteOns[1].at - REAL.start) * beat + 1e-6, 0.1)
  assert.ok(out.length >= 2)
  assert.ok(Math.abs(out.at(-1).after - 400) < 1e-6, `woken 0.1 s late, it is held 0.4 s (${out.at(-1).after})`)
  const struck = out.filter(sent => sent.messages[0].kind === 'on').length, ended = out.filter(sent => sent.messages[0].kind === 'off').length
  p.stop()
  await clock.settle()
  const stopped = out.filter(sent => sent.messages[0].kind === 'off').slice(ended)
  assert.equal(stopped.flatMap(sent => sent.messages).length, struck - ended, 'Stop lets every note it holds go')
  assert.ok(stopped.every(sent => sent.after === undefined), 'at once: the host holds each behind its note-on')
})

test('Stop ends it: nothing more strikes, everything the clip holds is let go at once, and no timer is left', async () => {
  // REPLACES "Stop ends it: nothing more strikes, and no timer is left": Stop now also releases what the clip holds, as Panic does.
  const {p, clock, sent, watchers, path} = harness()
  const pressed = clock.now(), beat = 60 / REAL_BPM
  p.play(ADDRESS, REAL_BPM)
  await clock.settle()
  await clock.run(pressed + (realNoteOns[2].at - REAL.start) * beat + 1e-6)
  assert.equal(strikes(sent).length, 3)
  assert.equal(releases(sent).length, 0, 'the three notes still sound')
  p.stop()
  assert.equal(p.state().playing, null)
  assert.equal(clock.pending(), 0, 'the next strike\'s timer is cancelled')
  assert.equal(watchers.size, 0, 'the clip is no longer watched')
  await clock.settle()
  const byColumn = list => [...list].sort((a, b) => a.column - b.column || a.row - b.row)
  assert.equal(releases(sent).length, 1, 'one release')
  assert.deepEqual(byColumn(releases(sent)[0].command.keys), byColumn(realNoteOns.slice(0, 3).map(note => keyOf(note.p))), 'of every key it held')
  assert.deepEqual(path.sounding(), [])
  await clock.run(pressed + 600)
  assert.equal(strikes(sent).length, 3, 'nothing strikes after Stop')
  assert.equal(releases(sent).length, 1, 'and nothing is let go twice')
})

test('a looped clip strikes its loop again and again, each pass at its own samples, and takes an edit at the next pass', async () => {
  const {p, clock, sent, set} = harness({clip: looped()})
  const pressed = clock.now(), beat = 60 / 120
  p.play(ADDRESS, 120)
  await clock.settle()
  // Pass 1: 6 → 8 (2 beats). Pass 2 from beat 2 after the anchor: 4 → 8. Pass 3 from beat 6.
  await clock.run(pressed + 6 * beat - 1e-6)
  assert.deepEqual(strikes(sent).map(s => [s.command.at_samples_elapsed, s.command.keys]),
    [[sampleAt(0), [keyOf(67)]], [sampleAt(2 * beat), [keyOf(60), keyOf(64)]], [sampleAt(4 * beat), [keyOf(67)]]])
  assert.deepEqual(releases(sent).map(s => [Math.round((s.at - pressed) * 1e6) / 1e6, s.command.keys]), [[0.5 * beat, [keyOf(67)]], [2.5 * beat, [keyOf(60), keyOf(64)]],
    [4.5 * beat, [keyOf(67)]]], 'each note let go as its half beat ends')
  set(looped({notes: [{id: 9, p: 62, at: 5, len: 1, vel: 127, chance: 1, on: true}]}))
  await clock.settle()
  await clock.run(pressed + 10 * beat - 1e-6)
  assert.deepEqual(strikes(sent).slice(3).map(s => [s.command.at_samples_elapsed, s.command.keys]), [[sampleAt(7 * beat), [keyOf(62)]]],
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
  assert.equal(strikes(sent).length, 1, 'a wake 50 ms late still strikes')
  assert.ok(Math.abs(strikes(sent)[0].at - (pressed + 0.05)) < 1e-9, 'sent late by the wake')
  assert.equal(strikes(sent)[0].command.at_samples_elapsed, sampleAt(0), 'and still lands at its own sample')
  await clock.run(pressed + 1.5, SLACK - 0.01)
  assert.equal(strikes(sent).length, 2, 'a wake just inside the owner\'s slack still lands')
  assert.equal(strikes(sent)[1].command.at_samples_elapsed, sampleAt(1))
  assert.equal(p.state().missed, 0)
  // The thread stalls: the strikes due at 2, 3, 4 and 5 s are past the owner's slack when it wakes at 5.5 s.
  clock.stall(pressed + 5.5)
  await clock.run(pressed + 5.5)
  assert.equal(strikes(sent).length, 2, 'the backlog is not struck at once')
  // REPLACES "missed 4" (acts): the count is of note-ons, so the two chords the stall passed count two each.
  assert.equal(p.state().missed, 6, 'every note-on the stall passed is counted as missed')
  assert.deepEqual(releases(sent).map(s => s.command.keys), [[keyOf(67)], [keyOf(60), keyOf(64)]],
    'the notes struck before the stall are still let go; the ones it passed owe nothing')
  await clock.run(pressed + 6.5)
  assert.equal(strikes(sent).length, 3, 'the clip keeps its own time after a stall')
  assert.ok(Math.abs(strikes(sent)[2].at - (pressed + 6)) < 1e-9)
  assert.equal(strikes(sent)[2].command.at_samples_elapsed, sampleAt(6), 'the next note-on lands at its own sample')
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
  assert.deepEqual(strikes(sent).map(s => s.command.keys), [[keyOf(64)], [keyOf(67)]], 'the first chance missed its draw, the second made it')
  assert.deepEqual(strikes(sent).map(s => s.command.at_samples_elapsed), [sampleAt(0), sampleAt(0.5)])
  assert.deepEqual(releases(sent).map(s => s.command.keys), [[keyOf(64)], [keyOf(67)]], 'a note that did not sound is not let go')
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
  const keyId = key => `${key.row}/${key.column}`
  class Owner extends ControlledSceneOwner {
    strikes = []
    strikesAt = []
    /** The Torus's acts as the owner took them, in order: torus-play and torus-release. */
    torusActs = []
    notes = []
    next = 0
    /** Each act as the owner took it: what it names, and the sample cursor it lands at (none: at the owner's cursor). The Torus's two acts
     * keep QL's own count of notes (m1_prime.rs strike/release, as janko-keys-853.test.mjs teaches it): a key already sounding makes way
     * for its new note. */
    async request(request) {
      const command = request.request?.command
      if (!['strike', 'strike-at', 'torus-play', 'torus-release'].includes(command?.operation)) return super.request(request)
      const read = structuredClone(request)
      read.request.command = {operation: 'read'}
      const reply = await super.request(read)
      const took = {cursor: this.frame.samples_elapsed, at: command.at_samples_elapsed}
      if (command.operation === 'torus-release') {
        this.torusActs.push({...took, operation: 'torus-release', keys: structuredClone(command.keys)})
        this.notes = this.notes.filter(note => !command.keys.some(key => keyId(key) === keyId(note.key)))
        return reply
      }
      if (command.operation === 'strike') this.strikes.push({...took, act: structuredClone(command.strikes)})
      else if (command.operation === 'strike-at') this.strikesAt.push({...took, act: structuredClone(command.points)})
      else {
        this.torusActs.push({...took, operation: 'torus-play', keys: structuredClone(command.keys), amplitude: command.amplitude})
        const admitted = [], made_way = []
        for (const key of command.keys) {
          const index = this.notes.findIndex(note => keyId(note.key) === keyId(key))
          if (index >= 0) made_way.push(...this.notes.splice(index, 1))
          const note = {id: this.next++, key: {row: key.row, column: key.column}, arc: key.column % 6 + 6 * (key.row % 2), struck_at_samples: 0}
          this.notes.push(note)
          admitted.push(note)
        }
        reply.torus_play = {schema: 'ql.torus-play/v1', made_way, polyphony: 16,
          notes: admitted.map(note => ({id: note.id, key: note.key, place: {arc: note.arc}, point: {theta: 0.25 * (note.arc + 1), phi: 0.5 * (note.arc + 1), arc: note.arc}}))}
      }
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
 * (readStageRequest) and runs its own case — a `janko` strike through controller.torusPlay and its release through controller.torusRelease
 * (app.ts runStageCommand), `strike-at` through controller.playAt, and `audio-clock` as the controller's audioClock — and answers with
 * stageReplyMessage, which the host reads back (readStageResult). */
const frameChannel = async c => {
  const {stageRequestMessage, readStageRequest, stageReplyMessage, readStageResult} = await stage()
  let req = 0
  const pending = []
  const run = async command => {
    const message = stageRequestMessage(++req, command)
    assert.ok(message, `the host posts ${JSON.stringify(command)}`)
    const read = readStageRequest(message)
    assert.deepEqual(read, {req, command}, 'the frame reads the command the player sent, exactly')
    const at = read.command.at_samples_elapsed
    let answer = {ok: true}
    if (read.command.command === 'janko' && read.command.action === 'strike') {
      const made_way = await c.torusPlay(read.command.keys, read.command.amplitude, at)
      if (made_way.length) answer = {ok: true, made_way}
    } else if (read.command.command === 'janko' && read.command.action === 'release') await c.torusRelease(read.command.keys)
    else if (read.command.command === 'strike-at') await c.playAt(read.command.points, read.command.amplitude, at)
    else if (read.command.command === 'audio-clock') answer = {ok: true, clock: c.audioClock()}
    else throw new Error(`not an act of the clip: ${JSON.stringify(read.command)}`)
    const {req: answered, ...result} = readStageResult(stageReplyMessage(req, answer, read.command))
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

test('each note-on of the real clip reaches the owner at its own sample as its key struck on the Torus, and each note\'s end as its release', async () => {
  // REPLACES "… its key's voices, at its velocity over 127, in the clip's order" (the owner's `strike` of the played voices by pitch
  // class): the clip strikes keys of the surface through the part's one playing path, as the keys and MIDI do.
  // The real clip to its fourth note: the controlled audio's clock stands still, so what the session presents never drains, and its
  // bound of sixteen presented blocks holds the acts one test can send (instrument-session.mjs operate).
  const clip = {...REAL, end: 23}
  const {owner, c} = await openController()
  try {
    const channel = await frameChannel(c)
    const clock = controlledClock()
    const clocks = []
    const path = keys.createJankoInput({send: channel.strike, window: () => windowState})
    const p = player.createClipPlayer({read: async () => clip, watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel,
      random: () => 0, strike: (notes, amplitude, at) => path.clipStrike(notes, amplitude, at), release: holds => path.clipRelease(holds),
      clock: async () => { const read = await player.readAudioClock(channel.strike); clocks.push(read); return read }})
    const pressed = clock.now()
    p.play(ADDRESS, REAL_BPM)
    await new Promise(resolve => setTimeout(resolve, 20))
    await clock.run(pressed + 600)
    await channel.settled()
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(clocks.length, 1)
    const {samples_elapsed, sample_rate, lookahead_seconds} = clocks[0]
    const anchor = BigInt(samples_elapsed) + BigInt(Math.round(lookahead_seconds * sample_rate))
    const acts = actsOf(clip)
    assert.deepEqual(acts.map(act => [act.kind, act.notes.map(note => note.p)]), [['strike', [52]], ['strike', [56]], ['strike', [59]], ['strike', [63]],
      ['release', [59]], ['release', [52, 56, 63]]], 'four note-ons; the end marker ends three notes at once')
    assert.deepEqual(owner.torusActs.map(({operation, keys, amplitude, at}) => ({operation, keys, ...(amplitude ? {amplitude} : {}), at})),
      acts.map(act => act.kind === 'strike'
        ? {operation: 'torus-play', keys: [keyOf(act.notes[0].p)], amplitude: [act.notes[0].vel / 127, 0], at: String(anchor + BigInt(Math.round(act.seconds * sample_rate)))}
        : {operation: 'torus-release', keys: act.notes.map(note => keyOf(note.p)), at: undefined}),
      'one torus-play per note-on, of its key, at its own sample; a torus-release of the keys whose notes end, in the order the samples come')
    for (const {operation, at, cursor} of owner.torusActs) if (operation === 'torus-play') assert.ok(BigInt(at) > BigInt(cursor), `the strike at ${at} reached the owner ahead of its cursor ${cursor}`)
    assert.deepEqual(owner.strikes, [], 'no strike of voices by pitch class')
    assert.deepEqual(owner.notes, [], 'every note the clip struck is let go')
    assert.equal(c.reading.instrument.played.strikes, 4)
    assert.equal(c.reading.instrument.struck.source, 'point', 'the plate follows the points the clip struck')
    assert.equal(c.reading.instrument.struck.points.length, 1)
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
    await assert.rejects(c.torusPlay([keyOf(60)], 0.4, behind), /already rendered/, 'a key the clip strikes too')
    assert.deepEqual([owner.strikes.length, owner.strikesAt.length, owner.torusActs.length], [0, 0, 0], 'nothing reached the owner')
    assert.equal(c.reading.status, 'following', 'a refused note leaves the field running')
  } finally { await c.dispose() }
})

test('the frame runs each strike through the native field with its sample, and answers the audio clock from its controller', () => {
  const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8')
  const run = app.slice(app.indexOf('async function runStageCommand('), app.indexOf('async function answerStageCommand('))
  // REPLACED (O-I #855, the owner's half): a strike's answer also names the sample its act landed at, which a Live take keeps
  // (controller.ts torusPlayed, the act torusPlay makes, answered whole); the keys and their sample are the clip's note-on as before.
  // REPLACED (round 54 item 0): the answer also says how long the key waited to reach the owner (late_ms; round 54a L1).
  assert.match(run, /case 'janko':[\s\S]*?if\(command\.action==='strike'\)\{const \{made_way,landed_at_samples_elapsed,late_ms\}=await nativeField\.controller\.torusPlayed\(command\.keys,command\.amplitude,command\.at_samples_elapsed\);/,
    'a clip\'s note-on: its keys at its sample')
  assert.match(run, /if\(command\.action==='release'\)\{await nativeField\.controller\.torusRelease\(command\.keys\);return \{ok:true\};\}/, 'a note\'s end')
  // REPLACED (O-I #855 fold-in): the pitch-class act the QL sitting's bell struck through the owner's played voices (nativeField.ts
  // playJanko, planJankoStrike) is retired; the bell strikes its key on the one path (sitting-bell-keys.test.mjs), so the janko case runs
  // keys and nothing else.
  const janko = run.slice(run.indexOf("case 'janko':"), run.indexOf("case 'strike-at':"))
  assert.doesNotMatch(janko, /playJanko|pitch_classes/, 'no pitch-class act')
  assert.match(run, /case 'strike-at':[\s\S]*?await nativeField\.controller\.playAt\(command\.points,command\.amplitude,command\.at_samples_elapsed\);/)
  assert.match(run, /case 'audio-clock':[\s\S]*?return \{ok:true,clock:nativeField\.controller\.audioClock\(\)\};/)
  const answer = app.slice(app.indexOf('async function answerStageCommand('), app.indexOf('function openStudioSection('))
  // REPLACED (O-I #747 round 896, 1R-surface.10): the answer goes to the host at its exact origin (hostChannel.ts postToHost), never '*'.
  assert.match(answer, /const answer=await runStageCommand\(command\);postToHost\(stageReplyMessage\(req,answer,command\)\);/)
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
  assert.match(live, /const selection = useOptionalContinuity\(\)\?\.current\.context\?\.selection\n\s+const clip = useLiveClipPlay\(selection, tempoBpm\)/)
  // with a clip selected Play and Stop are the clip player's; with none, the open set's in the engine (O-I #849, tests/live-engine-binding)
  assert.match(live, /const playStop = clipAddressOf\(selection\) \? clip : engine\n\s+return \{\n\s+\.\.\.playStop,/, 'a selected clip: Play and Stop are the clip player\'s')
})

test('the candidate\'s clip plays on the part\'s one playing path: its notes struck and let go through livePlayingPath', () => {
  const source = readFileSync(new URL('../src/live/clipPlayer.ts', import.meta.url), 'utf8')
  const owners = source.slice(source.indexOf('function candidateOwners('), source.indexOf('export const liveClipPlayer'))
  // REPLACES the round-21 wiring without `sounds`: the time to each sample travels with it, for MIDI out (O-I #853 round 22).
  assert.match(owners, /strike: \(notes, amplitude, at, sounds\) => livePlayingPath\(\)\.clipStrike\(notes, amplitude, at, sounds\)/)
  assert.match(owners, /release: \(holds, sounds\) => livePlayingPath\(\)\.clipRelease\(holds, sounds\)/)
  assert.doesNotMatch(source, /action: 'play'/, 'the clip strikes no pitch-class act')
})

// ---------------------------------------------------------------------------------------------------- a row's launch, on the launch grid
// O-I #743: a row's launch plays every clip of the row at once, each on its own track's player (Live's scene launch), each landing where its
// launch quantize says (DLW manual §21.1: "How a clip launches, when it lands and what follows it are the clip's own, in its Launch tab.
// The transport's Quantize is the launch quantize for every clip set to Global"; §21.1's rule "A row launches only what is in it").

test('a launch quantize is a step of the grid: bars of four beats, or a note value, a triplet two thirds of it; none is no step', () => {
  assert.deepEqual(['1 bar', '2 bars', '4 bars', '8 bars'].map(word => player.quantumBeats(word)), [4, 8, 16, 32])
  assert.deepEqual(['1/2', '1/4', '1/8', '1/16', '1/32'].map(word => player.quantumBeats(word)), [2, 1, 0.5, 0.25, 0.125])
  assert.deepEqual(['1/2t', '1/4t', '1/8t', '1/16t'].map(word => player.quantumBeats(word)), [4 / 3, 2 / 3, 1 / 3, 1 / 6])
  assert.equal(player.quantumBeats('none'), null)
  for (const word of ['global', '3 bars', '1/32t', '1/64', '']) assert.equal(player.quantumBeats(word), undefined, word)
  // the grid's steps from its origin: the first at or after the earliest a launch can land
  assert.equal(player.landAt(1000n, null, 480), 1000n, 'no grid yet: it lands as soon as it can')
  assert.equal(player.landAt(1000n, 900n, null), 1000n, 'no step: as soon as it can')
  assert.equal(player.landAt(1000n, 900n, 480), 1380n)
  assert.equal(player.landAt(1380n, 900n, 480), 1380n, 'on a step, there')
  assert.equal(player.landAt(1000n, 900n, 1000 / 3), 1233n, 'a step of a fraction of a sample, rounded once from the origin')
  assert.equal(player.landAt(800n, 900n, 480), 900n, 'never before the grid\'s origin')
})

test('a launch that lands later than it could strikes its notes from where it lands, and paces them from then', async () => {
  const {p, clock, sent} = harness()
  const pressed = clock.now()
  const asked = []
  p.play(ADDRESS, REAL_BPM, (clip, timing) => { asked.push([clip.name, timing.anchor, timing.rate]); return timing.anchor + 24000n })
  await clock.settle()
  assert.deepEqual(asked, [['LABS 10', BigInt(ANCHOR), 48000]], 'asked once, with the clip read and the earliest it can land')
  await clock.run(pressed + 1200)
  await clock.settle()
  const acts = actsOf(REAL)
  assert.equal(sent.length, acts.length)
  acts.forEach((act, i) => {
    assert.ok(Math.abs(sent[i].at - (pressed + 0.5 + act.seconds)) < 1e-9, `act ${i} is sent one lookahead before its own sample, half a second on`)
    if (act.kind === 'strike') assert.equal(sent[i].command.at_samples_elapsed, String(ANCHOR + 24000 + Math.round(act.seconds * 48000)))
  })
})

/** A two-bar clip at 120 BPM: a note on its first beat and one on its fifth, from `p` up. */
const short = (name, quantize, p) => ({...REAL, name, quantize, loop: false, start: 0, end: 8, position: 0, length: 8, notes: [
  {id: 1, p, at: 0, len: 1, vel: 100, chance: 1, on: true}, {id: 2, p: p + 4, at: 4, len: 1, vel: 100, chance: 1, on: true}]})
/** Each track's player over the one playing path; the owner's clock moves only when the test advances it. */
const rowHarness = () => {
  const clock = controlledClock()
  const sent = []
  let samples = 480000n
  const path = keys.createJankoInput({window: () => windowState, send: async command => { sent.push({at: clock.now(), command: structuredClone(command)}); return {ok: true} }})
  const clips = {0: short('Keys', 'global', 60), 1: short('Pads', '1/4', 67), 3: short('Bass', 'global', 48)}
  const ownersOf = () => ({
    read: async address => clips[address.track],
    clock: async () => ({...CLOCK, samples_elapsed: String(samples)}),
    strike: (notes, amplitude, at) => path.clipStrike(notes, amplitude, at), release: holds => path.clipRelease(holds),
    watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0,
  })
  const single = player.createClipPlayer(ownersOf())
  const made = new Map()
  const acts = player.clipLaunchActs(single, () => ({ok: true, value: {standing: 'following'}, parameters: {torus: {}}}),
    track => { const p = player.createClipPlayer(ownersOf()); made.set(track, p); return p })
  return {clock, sent, single, made, acts, advance: frames => { samples += BigInt(frames) }}
}
const ROW = [{track: 0, name: 'Keys', kind: 'midi'}, {track: 1, name: 'Pads', kind: 'midi'}, {track: 2, name: 'Drums', kind: 'audio'}]
const settled = async (clock, answer) => { for (let i = 0; i < 4; i++) await clock.settle(); return answer }
const strikeSamples = sent => strikes(sent).map(s => BigInt(s.command.at_samples_elapsed))

test('a row launches every MIDI clip of it together, each on its own track, on one grid; an audio clip of it is said, not played', async () => {
  const {clock, sent, single, made, acts, advance} = rowHarness()
  const said = await settled(clock, acts.launchRow('/sets/a.als', 2, 120, ROW, '1 bar'))
  assert.equal(said.ok, true, said.error)
  assert.equal(said.note, 'Row 3 plays on the torus: Keys and Pads. Drums is an audio clip, which the engine plays where it lies in the Arrangement, not from a slot.')
  assert.deepEqual([...made.keys()], [0, 1], 'a player of each MIDI part\'s clip')
  assert.deepEqual([...made.values()].map(p => p.state().playing?.name), ['Keys', 'Pads'])
  await settled(clock, clock.run(clock.now() + 0.1))
  assert.deepEqual(strikeSamples(sent), [BigInt(ANCHOR), BigInt(ANCHOR)], 'nothing played: the row lands as soon as it can, together, and that is the grid\'s origin')
  // While the row plays, a clip launched lands on the grid: Keys on the transport's Quantize (Global: 1 bar), from where the grid began.
  advance(30000)
  const bar = 4 * 0.5 * 48000
  sent.length = 0
  const keysAnswer = await settled(clock, acts.launch({path: '/sets/a.als', track: 0, at: {slot: 2}}, 120, '1 bar'))
  assert.equal(keysAnswer.ok, true, keysAnswer.error)
  assert.equal(single.state().playing?.name, 'Keys', 'a clip launched on a track takes the place of the row\'s clip on it')
  assert.equal(made.get(0).state().playing, null)
  assert.equal(made.get(1).state().playing?.name, 'Pads', 'the row plays on on the other tracks')
  await settled(clock, clock.run(clock.now() + 2))
  assert.deepEqual(strikeSamples(sent), [BigInt(ANCHOR + bar), BigInt(ANCHOR + bar)], 'Keys lands on the next bar of the grid, as Pads strikes its fifth beat')
  // Pads keeps its own 1/4: launched again now, it lands on the next beat of the grid, not the next bar.
  advance(30000)
  sent.length = 0
  await settled(clock, acts.launchRow('/sets/a.als', 2, 120, [ROW[1]], '1 bar'))
  await settled(clock, clock.run(clock.now() + 0.3))
  assert.deepEqual(strikeSamples(sent), [BigInt(ANCHOR + 3 * 24000)], 'Pads lands on its own quantize')
  assert.equal(single.state().playing?.name, 'Keys', 'a row that holds nothing on a track leaves what plays there')
  // Stop all stops every player.
  assert.equal(acts.stopAll().ok, true)
  assert.deepEqual([single, ...made.values()].map(p => p.state().playing), [null, null, null])
})

// O-I #849 round 21: a bar of the launch grid is the set's, read from its time signature (model.rs signature_of), not four beats.
test('a bar of the launch grid is the set\'s, read from its time signature; a note value is the note\'s whatever the bar', async () => {
  assert.deepEqual(['1 bar', '2 bars', '4 bars', '8 bars'].map(word => player.quantumBeats(word, 3)), [3, 6, 12, 24], 'bars of 3/4')
  assert.deepEqual(['1 bar', '2 bars'].map(word => player.quantumBeats(word, 3.5)), [3.5, 7], 'bars of 7/8')
  assert.deepEqual(['1/4', '1/8t'].map(word => player.quantumBeats(word, 3)), [1, 1 / 3])
  const {clock, sent, acts, advance} = rowHarness()
  await settled(clock, acts.launchRow('/sets/a.als', 2, 120, [ROW[0]], '1 bar', 3))
  await settled(clock, clock.run(clock.now() + 0.1))
  advance(30000)
  sent.length = 0
  // Bass keeps Global: it lands on the next bar of three beats from where the grid began, not of four
  const bass = await settled(clock, acts.launch({path: '/sets/a.als', track: 3, at: {slot: 0}}, 120, '1 bar', 3))
  assert.equal(bass.ok, true, bass.error)
  await settled(clock, clock.run(clock.now() + 2))
  assert.equal(strikeSamples(sent).sort((a, b) => (a < b ? -1 : 1))[0], BigInt(ANCHOR + 3 * 0.5 * 48000), 'on the bar of 3/4')
  // the frame launches on the set's bar (frame/tracks/modeTracks.ts liveTracks)
  const tracks = readFileSync(new URL('../src/frame/tracks/modeTracks.ts', import.meta.url), 'utf8')
  assert.match(tracks, /const bar = barBeats\(document\?\.signature\)/)
  assert.match(tracks, /acts\.launch\(\{path: set\.path, track, at\}, set\.tempo_bpm, quantize, bar\)/)
  assert.match(tracks, /acts\.launchRow\(set\.path, row, set\.tempo_bpm, slots, quantize, bar\)/)
})

// O-I #849 round 21, item 6: a Session clip has no place of its own on the Arrangement's ruler, so a slot take's lanes stand where its
// clip landed on the transport: the launch grid's beats from where the grid began. A take's course, which no quantize moves, begins the
// grid where none stands.
test('a slot take\'s lanes stand on the ruler where its clip landed on the launch grid, and a take\'s course begins the grid', async () => {
  const clock = controlledClock()
  let samples = 480000n
  const clips = {0: short('Keys', 'global', 60), 1: short('Take 2', 'global', 62)}
  const moves = [{beat: 1, edits: [], sets: [{parameter: 'lens', value: 4}]}, {beat: 3, edits: [], sets: [{parameter: 'lens', value: 6}]}]
  // Take 2 plays as it was played: its course from the sample the Torus rang again from, 10000 samples before the clip's anchor
  const exact = {landed: String(ANCHOR - 10000), from: '1000', frames: 4 * 48000, sample_rate: 48000, acts: []}
  const p = player.createClipPlayer({
    read: async address => clips[address.track],
    prepare: async clip => ({resumes: 'Resumes.', moves, ...(clip.name === 'Take 2' ? {exact} : {})}),
    clock: async () => ({...CLOCK, samples_elapsed: String(samples)}),
    edit: async () => ({ok: true}), set: async () => ({ok: true}),
    strike: async () => ({ok: true}), release: () => {}, watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0,
  })
  const acts = player.clipLaunchActs(p, () => ({ok: true, value: {standing: 'following'}, parameters: {torus: {}}}))
  const keysSlot = {path: '/sets/a.als', track: 0, at: {slot: 2}}, takeSlot = {path: '/sets/a.als', track: 1, at: {slot: 0}}
  assert.equal((await settled(clock, acts.launch(keysSlot, 120, '1 bar'))).ok, true)
  assert.deepEqual(p.state().lanes.take, {address: keysSlot, name: 'Keys', at: 0}, 'nothing played: it lands as soon as it can, the grid\'s first beat')
  samples += 30000n
  assert.equal((await settled(clock, acts.launch(keysSlot, 120, '1 bar'))).ok, true)
  assert.deepEqual(p.state().lanes.take, {address: keysSlot, name: 'Keys', at: 4}, 'launched again while it plays: on the next bar of the grid')
  acts.stopAll()
  assert.equal((await settled(clock, acts.launch(takeSlot, 120, '1 bar'))).ok, true)
  assert.deepEqual(p.state().lanes.take, {address: takeSlot, name: 'Take 2', at: 0}, 'a take\'s course lands where its Torus rang again')
  samples += 30000n
  // (O-I #849 round 21: launched while a take with lanes plays, the player's word as those lanes end was taken for the launch's answer)
  assert.deepEqual(await settled(clock, acts.launch(keysSlot, 120, '1 bar')), {ok: true, note: 'Keys plays on the torus.'},
    'another clip launched while a take plays on the player is answered as it plays')
  assert.deepEqual(p.state().lanes.take, {address: keysSlot, name: 'Keys', at: 4},
    'the grid began where the take\'s course landed: Keys lands a bar from there, not where it first could')
  const lone = player.createClipPlayer({read: async () => clips[0], prepare: async () => ({resumes: 'Resumes.', moves}), clock: async () => CLOCK,
    edit: async () => ({ok: true}), set: async () => ({ok: true}),
    strike: async () => ({ok: true}), release: () => {}, watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0})
  lone.play(keysSlot, 120)
  await settled(clock)
  assert.deepEqual(lone.state().lanes.take, {address: keysSlot, name: 'Keys'}, 'a clip played on no launch grid stands nowhere on the transport')

  // Live's set lays the slot take's lanes from there; an arrangement take's stay under its clip where it lies.
  const {liveSetTrackAdapter} = await import('../src/timeline/liveSetTrackAdapter.ts')
  const {automationPoints} = await import('../src/frame/tracks/trackLanes.ts')
  const summary = {path: '/sets/a.als', scene_count: 3, tempo_bpm: 120, tracks: [{kind: 'midi', name: 'Keys', devices: []}, {kind: 'master', name: 'Main', devices: []}]}
  const play = {launch: async () => ({ok: true, note: ''}), stop: () => ({ok: true, note: ''}), stopAll: () => ({ok: true, note: ''}), reenable: async () => ({ok: true, note: ''})}
  const standing = {automated: ['lens'], overridden: [], take: {address: keysSlot, name: 'Keys', at: 4},
    lanes: [{parameter: 'lens', label: 'Lens', points: [{beat: 1, value: 0}, {beat: 3, value: 1}]}]}
  const [lane] = liveSetTrackAdapter.project({set: summary, document: null, play, lanes: standing}).lanes.automation
  assert.equal(lane.clipId, 'als:/sets/a.als#track/0/slot/2')
  assert.equal(lane.clipAt, 4, 'where its clip landed')
  assert.deepEqual(automationPoints(lane, () => undefined), [{at: 5, value: 0}, {at: 7, value: 1}], 'its points on the ruler from where its clip landed')
  assert.deepEqual(automationPoints({...lane, clipAt: undefined}, () => undefined), [], 'a clip with no place that landed nowhere: none')
  const [arranged] = liveSetTrackAdapter.project({set: summary, document: null, play,
    lanes: {...standing, take: {address: {path: '/sets/a.als', track: 0, at: {arrangement: 0}}, name: 'Keys', at: 4}}}).lanes.automation
  assert.equal(arranged.clipAt, undefined, 'an arrangement clip\'s lanes stand where the clip lies')
  assert.deepEqual(automationPoints(arranged, () => 16), [{at: 17, value: 0}, {at: 19, value: 1}])
})

// O-I #849 round 21, item 2: a row of several takes plays each on its own track's player. One Torus rings at a time, so the first take of
// the press to set it again holds it and the others are told whose it is (live/liveTake.ts prepareTake); each player's take lanes are
// followed, and Re-enable gives back what the hand holds off any of them.
const takeRow = () => {
  const clock = controlledClock()
  const hands = [], turns = []
  const clips = {0: short('Keys', 'global', 60), 1: short('Pads', '1/4', 67)}
  const ownersOf = () => ({
    read: async address => clips[address.track],
    prepare: async (clip, bpm, turn) => {
      turns.push([clip.name, turn?.take(clip.name)])
      return {resumes: 'Resumes.', moves: [{beat: 1, edits: [], sets: [{parameter: clip.name === 'Keys' ? 'lens' : 'frame', value: 4}]},
        {beat: 3, edits: [], sets: [{parameter: 'carrier', value: clip.name === 'Keys' ? 0.2 : 0.4}, {parameter: clip.name === 'Keys' ? 'lens' : 'frame', value: 6}]}]}
    },
    clock: async () => CLOCK, edit: async () => ({ok: true}), set: async () => ({ok: true}),
    hand: moved => { hands.push(moved); return () => { hands.splice(hands.indexOf(moved), 1) } },
    strike: async () => ({ok: true}), release: () => {}, watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0,
  })
  const single = player.createClipPlayer(ownersOf())
  const acts = player.clipLaunchActs(single, () => ({ok: true, value: {standing: 'following'}, parameters: {torus: {}}}), () => player.createClipPlayer(ownersOf()))
  return {clock, hands, turns, acts}
}

// REPLACES "a row's takes ask one turn of the Torus: … a launch alone asks none" (a turn of each press): DLW build ruling 2026-11-05, "The
// turn belongs to the first take until it ends, and any launch meanwhile is held in the same words, a single launch included".
test('one turn of the Torus across every launch: the first take to ask holds it until it ends, and any launch meanwhile is held, one launched alone too', async () => {
  const turn = player.torusTurn()
  assert.equal(turn.take('Keys'), null, 'the first take to ask sets the Torus again')
  assert.equal(turn.take('Pads'), 'Keys', 'the next is told whose it is')
  assert.equal(turn.take('Keys'), 'Keys')
  turn.release('Pads')
  assert.equal(turn.take('Pads'), 'Keys', 'only the take that holds it gives it back')
  turn.release('Keys')
  assert.equal(turn.take('Pads'), null, 'given back, the next take to ask holds it')
  const {clock, turns, acts} = takeRow()
  const asked = () => turns.splice(0)
  await settled(clock, acts.launchRow('/sets/a.als', 0, 120, ROW.slice(0, 2), '1 bar'))
  assert.deepEqual(asked(), [['Keys', null], ['Pads', 'Keys']], 'the row\'s first take holds the Torus, and the other is told whose it is')
  await settled(clock, acts.launch({path: '/sets/a.als', track: 1, at: {slot: 0}}, 120, '1 bar'))
  assert.deepEqual(asked(), [['Pads', 'Keys']], 'a clip launched alone while Keys plays is held in the same words')
  await settled(clock, acts.launchRow('/sets/a.als', 0, 120, ROW.slice(0, 2), '1 bar'))
  assert.deepEqual(asked(), [['Keys', null], ['Pads', 'Keys']], 'launched over, Keys gave its turn back as it stopped, and holds it again')
  acts.stop('/sets/a.als', 0, 'Keys')
  await settled(clock, acts.launch({path: '/sets/a.als', track: 1, at: {slot: 0}}, 120, '1 bar'))
  assert.deepEqual(asked(), [['Pads', null]], 'Keys stopped: its turn is given back, and a clip launched alone holds it')
  await settled(clock, clock.run(clock.now() + 10))
  await settled(clock, acts.launch({path: '/sets/a.als', track: 0, at: {slot: 0}}, 120, '1 bar'))
  assert.deepEqual(asked(), [['Keys', null]], 'Pads played to its end: its turn is the next take\'s')
})

test('every player\'s take lanes are followed: a row\'s takes stand with the set\'s own player\'s, and Re-enable reaches each', async () => {
  const {clock, hands, acts} = takeRow()
  let heard = 0
  const off = acts.subscribe(() => { heard++ })
  assert.deepEqual(acts.lanes(), {automated: [], overridden: [], takes: []}, 'nothing plays: no lanes')
  await settled(clock, acts.launchRow('/sets/a.als', 0, 120, ROW.slice(0, 2), '1 bar'))
  assert.ok(heard > 0, 'a row\'s players are heard')
  const lanes = acts.lanes()
  assert.equal(acts.lanes(), lanes, 'one reading while nothing moves')
  assert.deepEqual(lanes.takes.map(({take}) => [take.address.track, take.name]), [[0, 'Keys'], [1, 'Pads']], 'each row player\'s take, by its track')
  assert.deepEqual([...lanes.automated].sort(), ['carrier', 'frame', 'lens'], 'what any take that plays writes stands Automated')
  for (const moved of [...hands]) moved(['carrier'])
  assert.deepEqual(acts.lanes().overridden, ['carrier'], 'held off both takes\' lanes, it is one parameter held')
  const answer = await acts.reenable('carrier')
  assert.equal(answer.ok, true, answer.error)
  assert.deepEqual(acts.lanes().overridden, [], 'Re-enable gave it back to every take that plays it')
  assert.deepEqual(await acts.reenable('carrier'), {ok: false, error: 'carrier is not held off a take\'s lane.'}, 'held by none: the player\'s own words')
  off()

  // Live's set lays each take's lanes under its own clip, and counts what the hand holds once.
  const {liveSetTrackAdapter} = await import('../src/timeline/liveSetTrackAdapter.ts')
  const summary = {path: '/sets/a.als', scene_count: 1, tempo_bpm: 120,
    tracks: [{kind: 'midi', name: 'Keys', devices: []}, {kind: 'midi', name: 'Pads', devices: []}, {kind: 'master', name: 'Main', devices: []}]}
  const play = {launch: async () => ({ok: true, note: ''}), stop: () => ({ok: true, note: ''}), stopAll: () => ({ok: true, note: ''}), reenable: async () => ({ok: true, note: ''})}
  const set = liveSetTrackAdapter.project({set: summary, document: null, play, lanes: {...lanes, overridden: ['carrier']}})
  assert.deepEqual(set.lanes.automation.map(lane => [lane.clipId, lane.parameter, lane.overridden]), [
    ['als:/sets/a.als#track/0/slot/0', 'lens', false], ['als:/sets/a.als#track/0/slot/0', 'carrier', true],
    ['als:/sets/a.als#track/1/slot/0', 'frame', false], ['als:/sets/a.als#track/1/slot/0', 'carrier', true]], 'each take\'s lanes under its own clip')
  assert.equal(set.lanes.held, 1)
  // the pane and the Torus's face follow every player (frame/tracks/modeTracks.ts, live/TorusOnChain.tsx)
  const tracks = readFileSync(new URL('../src/frame/tracks/modeTracks.ts', import.meta.url), 'utf8')
  assert.match(tracks, /void import\('\.\.\/\.\.\/live\/clipPlayer'\)\.then\(\(\{liveClipActs\}\) => \{/)
  assert.match(tracks, /const lanes = liveClipActs\.lanes\(\)/)
  assert.match(tracks, /liveClipActs\.subscribe\(follow\)/)
  const face = readFileSync(new URL('../src/live/TorusOnChain.tsx', import.meta.url), 'utf8')
  assert.match(face, /const laneReading = \(\): ClipLaneStanding => liveClipActs\.lanes\(\)/)
  assert.match(face, /useSyncExternalStore\(liveClipActs\.subscribe, laneReading, laneReading\)/)
})

// O-I #849 round 22 (DLW build ruling 2026-11-05): "A rendered take is a frozen take. Its Torus parameters are baked in and carry no
// Overridden mark. Touching one says the take is frozen, in words, and offers Unfreeze, which returns the part to its live Torus. The part
// plays the rendered sample until the take ends, then returns to its live Torus, as a clip returns at its end." The engine's freeze is a
// double here (`land`, `unfreeze`); live/liveTake.ts prepareTake makes the real one, and the host's test plays it.
const FROZEN_SLOT = {path: '/sets/a.als', track: 1, at: {slot: 0}}
const frozenHarness = ({refuse = null} = {}) => {
  const clock = controlledClock()
  const sent = [], landed = [], unfrozen = [], edits = [], sets = [], hands = []
  const path = keys.createJankoInput({window: () => windowState, send: async command => { sent.push({at: clock.now(), command: structuredClone(command)}); return {ok: true} }})
  const frozen = {words: 'Pads is frozen.', seconds: 3, moves: [{beat: 1, edits: [], sets: [{parameter: 'frame', value: 4}]}],
    settings: [{beat: 2, edit: {kind: 'torus', edit: {carrier: 0.5}}}], unfrozen: 'Pads is unfrozen.',
    land: async at => { landed.push(at); return refuse }, unfreeze: async () => { unfrozen.push(clock.now()); return null }}
  const p = player.createClipPlayer({read: async () => short('Pads', 'global', 67), prepare: async () => ({resumes: 'Keys holds the Torus; Pads is frozen.', frozen}),
    clock: async () => CLOCK, edit: async edit => { edits.push(edit); return {ok: true} }, set: async (id, value) => { sets.push([id, value]); return {ok: true} },
    hand: moved => { hands.push(moved); return () => { hands.splice(hands.indexOf(moved), 1) } },
    strike: (notes, amplitude, at) => path.clipStrike(notes, amplitude, at), release: holds => path.clipRelease(holds),
    watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0})
  return {clock, sent, landed, unfrozen, edits, sets, hands, p}
}

test('a frozen take strikes nothing and makes no move: its sound is the engine\'s from where its clip lands, and its lanes say so, held by no hand', async () => {
  const {clock, sent, landed, unfrozen, edits, sets, hands, p} = frozenHarness()
  p.play(FROZEN_SLOT, 120)
  await settled(clock)
  assert.deepEqual(landed, [BigInt(ANCHOR)], 'frozen on its part at the sample its clip lands at')
  assert.equal(p.state().resumes, 'Keys holds the Torus; Pads is frozen.')
  const lanes = p.state().lanes
  assert.deepEqual(lanes.automated, [], 'nothing of it stands Automated: its lanes are in its sound')
  assert.deepEqual(lanes.take, {address: FROZEN_SLOT, name: 'Pads', frozen: 'Pads is frozen.'})
  assert.deepEqual(lanes.lanes.map(lane => [lane.parameter, lane.points.map(point => point.beat)]), [['frame', [1]], ['carrier', [2]]],
    'its lanes as they were baked in: its moves\' and its course\'s settings of the Torus')
  assert.equal(hands.length, 0, 'no hand move can take a frozen lane off')
  await settled(clock, clock.run(clock.now() + 3.9))
  assert.deepEqual([strikes(sent).length, edits.length, sets.length], [0, 0, 0], 'it strikes no note on the live Torus and makes none of its moves')
  await settled(clock, clock.run(clock.now() + 1))
  assert.equal(p.state().playing, null, 'its clip ends at its end')
  assert.deepEqual(unfrozen, [], 'played past its sound\'s end, nothing is let go: the engine has done with it')
  assert.equal(p.state().lanes.take, undefined, 'and its lanes go')
})

test('Unfreeze plays the rest of a frozen take on the live Torus; Stop lets it go; one the engine refused plays there from its start, in its words', async () => {
  const a = frozenHarness()
  const acts = player.clipLaunchActs(a.p, () => following)
  assert.equal((await settled(a.clock, acts.launch(FROZEN_SLOT, 120, 'none'))).ok, true)
  await settled(a.clock, a.clock.run(a.clock.now() + 1))
  assert.deepEqual(await acts.unfreeze('/sets/a.als', 0), {ok: false, error: 'No take plays frozen on this part.'}, 'another part holds none')
  assert.deepEqual(await acts.unfreeze('/sets/a.als', 1), {ok: true, note: 'Pads is unfrozen.'})
  assert.equal(a.unfrozen.length, 1, 'the engine lets it go')
  assert.equal(a.p.state().resumes, 'Pads is unfrozen.')
  assert.equal(a.p.state().lanes.take, undefined, 'its frozen lanes go with it')
  await settled(a.clock, a.clock.run(a.clock.now() + 3.5))
  assert.deepEqual(strikeSamples(a.sent), [BigInt(ANCHOR + 96000)], 'the note at beat 4 strikes the live Torus; the one at beat 0 was the engine\'s')
  assert.deepEqual(await a.p.unfreeze(), {ok: false, error: 'No take plays frozen on this part.'})
  // Stop while it sounds lets it go, as Live stops a frozen clip.
  const b = frozenHarness()
  b.p.play(FROZEN_SLOT, 120)
  await settled(b.clock, b.clock.run(b.clock.now() + 1))
  b.p.stop()
  assert.equal(b.unfrozen.length, 1, 'stopped while its sound plays, the engine lets it go')
  // The engine refused it: it plays its notes on the live Torus from its start, in the words it was refused in, and has no frozen lanes.
  const c = frozenHarness({refuse: 'Keys holds the Torus. It was not frozen on its part: The engine follows no Torus it has taken yet.'})
  c.p.play(FROZEN_SLOT, 120)
  await settled(c.clock)
  assert.equal(c.p.state().resumes, 'Keys holds the Torus. It was not frozen on its part: The engine follows no Torus it has taken yet.')
  assert.equal(c.p.state().lanes.take, undefined)
  await settled(c.clock, c.clock.run(c.clock.now() + 4.5))
  assert.deepEqual(strikeSamples(c.sent), [BigInt(ANCHOR), BigInt(ANCHOR + 96000)], 'both its notes strike the live Torus')
  assert.deepEqual(c.unfrozen, [], 'nothing frozen to let go')
})

// O-I #849 round 23 (DLW build ruling 2026-11-05: "Lay a frozen take sample-aligned to its holder's course, not on the grid"): the take
// that holds the Torus rings its course from the sample the Torus rang again from, which is no step of the launch grid; a take frozen while
// it holds lands on that course, so the two sound sample for sample as they were played.
test('the take that holds the Torus says where its course rang from, or that it plays none; given back, it says none', async () => {
  const turn = player.torusTurn()
  assert.equal(turn.take('Keys'), null, 'Keys holds it')
  const waiting = turn.rung()
  turn.ring('Pads', 1n)
  turn.ring('Keys', 494000n)
  assert.equal(await waiting, 494000n, 'only its holder says where its course rang from')
  assert.equal(await turn.rung(), 494000n, 'and says so to a take that asks after')
  turn.release('Keys')
  assert.equal(await turn.rung(), null, 'given back, no course holds it')
  assert.equal(turn.take('Bass'), null)
  const plain = turn.rung()
  turn.ring('Bass', null)
  assert.equal(await plain, null, 'a holder that plays no course says so')
  const stopped = player.torusTurn()
  stopped.take('Keys')
  const asked = stopped.rung()
  stopped.release('Keys')
  assert.equal(await asked, null, 'a holder that ends before its course rings says none')
})

test('a take frozen while another holds the Torus lands on the holder\'s course, not on the launch grid: with it, from its first sample, or a whole step on', async () => {
  const clock = controlledClock()
  let samples = 480000n
  const clips = {0: short('Keys', 'global', 60), 1: short('Pads', 'global', 67), 3: short('Bass', 'global', 48)}
  const landed = []
  // Keys holds the Torus and rings its course from 30000 samples before its own anchor, past the owner's slack (15808), as a frozen
  // take's sound may begin: the engine plays it from where it then stands. Pads, held, is frozen on its part.
  const exact = () => ({landed: String(samples + 24000n - 30000n), from: '1000', frames: 4 * 48000, sample_rate: 48000, acts: []})
  const ownersOf = track => ({
    read: async address => clips[address.track],
    // Bass is a plain clip, no take, so it takes no turn of the Torus (liveTake.ts prepareTake takes one only for a take).
    prepare: async (clip, _bpm, turn) => {
      if (track === 3) return null
      const holder = turn?.take(clip.name) ?? null
      if (track === 0 && holder === null) return {resumes: 'Keys rings its course.', exact: exact()}
      if (track === 1 && holder !== null) return {resumes: `${holder} holds the Torus; Pads is frozen.`, frozen: {words: 'Pads is frozen.', seconds: 4,
        moves: [], settings: [], unfrozen: 'Pads is unfrozen.', land: async at => { landed.push(at); return null }, unfreeze: async () => null}}
      return null
    },
    clock: async () => ({...CLOCK, samples_elapsed: String(samples)}),
    strike: async () => ({ok: true}), release: () => {}, watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0,
  })
  const single = player.createClipPlayer(ownersOf(3))
  const acts = player.clipLaunchActs(single, () => ({ok: true, value: {standing: 'following'}, parameters: {torus: {}}}), track => player.createClipPlayer(ownersOf(track)))
  // Bass begins the launch grid at 504000; Keys's course then rings from 494000, which is no step of it.
  assert.equal((await settled(clock, acts.launch({path: '/sets/a.als', track: 3, at: {slot: 0}}, 120, '1 bar'))).ok, true)
  samples += 20000n
  const ROW2 = [{track: 0, name: 'Keys', kind: 'midi'}, {track: 1, name: 'Pads', kind: 'midi'}]
  assert.equal((await settled(clock, acts.launchRow('/sets/a.als', 0, 120, ROW2, '1 bar'))).ok, true)
  assert.deepEqual(landed, [494000n], 'launched with its holder it starts with it, at the course\'s first sample: not on the grid (600000), nor its own earliest (524000)')
  // Launched alone a while later (its earliest 694000), it lands on the next bar of the holder's course (782000), not of the grid (696000).
  samples += 170000n
  const pads = acts.launchRow('/sets/a.als', 1, 120, [{track: 1, name: 'Pads', kind: 'midi'}], '1 bar')
  assert.equal((await settled(clock, pads)).ok, true)
  assert.deepEqual(landed, [494000n, 494000n + 3n * 96000n], 'three bars of the holder\'s course on')
})

test('a take that holds the Torus and plays no course says so as it begins, and one frozen with it lands on the launch grid', async () => {
  const clock = controlledClock()
  let samples = 480000n
  const clips = {0: short('Keys', 'global', 60), 1: short('Pads', 'global', 67), 3: short('Bass', 'global', 48)}
  const landed = []
  const ownersOf = track => ({
    read: async address => clips[address.track],
    prepare: async (clip, _bpm, turn) => {
      if (track === 3) return null
      const holder = turn?.take(clip.name) ?? null
      // Keys holds the Torus, and its course cannot play: it voices its notes as played, on no course.
      if (track === 0 && holder === null) return {resumes: 'Keys plays its notes on no course.', voice: () => ({touch: 0, strength: 1})}
      if (track === 1 && holder !== null) return {resumes: `${holder} holds the Torus; Pads is frozen.`, frozen: {words: 'Pads is frozen.', seconds: 4,
        moves: [], settings: [], unfrozen: 'Pads is unfrozen.', land: async at => { landed.push(at); return null }, unfreeze: async () => null}}
      return null
    },
    clock: async () => ({...CLOCK, samples_elapsed: String(samples)}),
    strike: async () => ({ok: true}), release: () => {}, watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 0,
  })
  const acts = player.clipLaunchActs(player.createClipPlayer(ownersOf(3)), () => ({ok: true, value: {standing: 'following'}, parameters: {torus: {}}}),
    track => player.createClipPlayer(ownersOf(track)))
  // Bass begins the launch grid at 504000; the row's earliest is then 524000.
  assert.equal((await settled(clock, acts.launch({path: '/sets/a.als', track: 3, at: {slot: 0}}, 120, '1 bar'))).ok, true)
  samples += 20000n
  const ROW2 = [{track: 0, name: 'Keys', kind: 'midi'}, {track: 1, name: 'Pads', kind: 'midi'}]
  assert.equal((await settled(clock, acts.launchRow('/sets/a.als', 0, 120, ROW2, '1 bar'))).ok, true)
  assert.deepEqual(landed, [600000n], 'no course to land on: the launch grid\'s next bar, as Keys begins')
})

// O-I #849 round 23 (DLW build ruling 2026-11-05: "A frozen take sends the MIDI its notes played, as Freeze in Live still sends"): frozen,
// it strikes nothing on the live Torus, and each of its notes still leaves as MIDI when it sounds, at the strength it was played.
test('a frozen take\'s notes leave as MIDI as they sound, each at its strength and until its end, though it strikes nothing; Stop lets them go at once', async () => {
  const clock = controlledClock()
  const sent = [], midi = []
  const path = keys.createJankoInput({window: () => windowState, send: async command => { sent.push({at: clock.now(), command: structuredClone(command)}); return {ok: true} }})
  const frozen = {words: 'Pads is frozen.', seconds: 4, moves: [], settings: [], unfrozen: 'Pads is unfrozen.', land: async () => null, unfreeze: async () => null}
  const p = player.createClipPlayer({read: async () => short('Pads', 'global', 67),
    prepare: async () => ({resumes: 'Pads is frozen.', frozen, voice: (note, beat) => ({touch: 0, strength: note === 67 ? 0.5 : 0.25})}),
    clock: async () => CLOCK, strike: (notes, amplitude, at) => path.clipStrike(notes, amplitude, at), release: holds => path.clipRelease(holds),
    midi: (messages, afterMs) => midi.push({at: clock.now(), messages: structuredClone(messages), afterMs}),
    watch: () => () => {}, now: clock.now, later: clock.later, cancel: clock.cancel, random: () => 1})
  p.play(FROZEN_SLOT, 120)
  await settled(clock)
  await settled(clock, clock.run(clock.now() + 2.4))
  assert.equal(strikes(sent).length, 0, 'it strikes nothing on the live Torus')
  assert.deepEqual(midi.map(m => m.messages), [[{kind: 'on', channel: 0, note: 67, velocity: 64}], [{kind: 'off', channel: 0, note: 67, velocity: 0}],
    [{kind: 'on', channel: 0, note: 71, velocity: 32}]], 'its first note and its end, then its second, each at the strength it was played')
  for (const m of midi) assert.ok(m.afterMs > 0 && m.afterMs <= 500, 'each held by the host until its sample sounds')
  const first = midi[0], end = midi[1]
  assert.ok(Math.abs((end.at + end.afterMs / 1000) - (first.at + first.afterMs / 1000) - 0.5) < 1e-6, 'its end sounds a beat after its start')
  p.stop()
  assert.deepEqual(midi.at(-1), {at: clock.now(), messages: [{kind: 'off', channel: 0, note: 71, velocity: 0}], afterMs: undefined}, 'Stop lets its held note go at once')
  assert.equal(strikes(sent).length + releases(sent).length, 0, 'and nothing of it reached the playing path')
})

test('Live\'s set lays a frozen take\'s lanes under its clip with no Overridden mark, saying so, with Unfreeze; a looping slot take\'s are drawn for each pass', async () => {
  const {liveSetTrackAdapter} = await import('../src/timeline/liveSetTrackAdapter.ts')
  const {automationPoints, LOOP_PASSES_DRAWN} = await import('../src/frame/tracks/trackLanes.ts')
  const summary = {path: '/sets/a.als', scene_count: 1, tempo_bpm: 120,
    tracks: [{kind: 'midi', name: 'Keys', devices: []}, {kind: 'midi', name: 'Pads', devices: []}, {kind: 'master', name: 'Main', devices: []}]}
  const unfreezes = []
  const play = {launch: async () => ({ok: true, note: ''}), stop: () => ({ok: true, note: ''}), stopAll: () => ({ok: true, note: ''}),
    reenable: async () => ({ok: true, note: ''}), unfreeze: async track => { unfreezes.push(track); return {ok: true, note: 'Pads is unfrozen.'} }}
  const carrier = {parameter: 'carrier', label: 'Carrier', points: [{beat: 2, value: 1}]}
  const lanes = {automated: ['carrier'], overridden: ['carrier'], takes: [
    {take: {address: {path: '/sets/a.als', track: 0, at: {slot: 0}}, name: 'Keys', at: 0}, lanes: [carrier]},
    {take: {address: FROZEN_SLOT, name: 'Pads', at: 0, frozen: 'Pads is frozen.'}, lanes: [carrier]}]}
  const set = liveSetTrackAdapter.project({set: summary, document: null, play, lanes})
  assert.deepEqual(set.lanes.automation.map(lane => [lane.device, lane.overridden, lane.frozen ?? null]), [['Keys', true, null], ['Pads', false, 'Pads is frozen.']],
    'the hand holds Carrier off Keys\'s lane; Pads\'s is baked into its sound, and carries no Overridden mark')
  const frozen = set.lanes.automation[1]
  assert.deepEqual(await set.actions.unfreeze.run(frozen.id), {ok: true, note: 'Pads is unfrozen.'})
  assert.deepEqual(unfreezes, [1], 'Unfreeze reaches the part the lane\'s clip is on')
  assert.match((await set.actions.unfreeze.run('als:/sets/a.als#track/1/auto/0')).error, /no take froze/)
  assert.match(set.actions.unfreeze.op, /live_engine_unfreeze \{track\}/)
  // A looping slot take (edit.rs markers: start 6, loop 4 to 8) plays, publishing its loop; its lanes are drawn for each pass of the loop.
  const clock = controlledClock()
  const moves = [{beat: 5, edits: [], sets: [{parameter: 'frame', value: 4}]}, {beat: 7, edits: [], sets: [{parameter: 'frame', value: 6}]}]
  const p = player.createClipPlayer({read: async () => looped(), prepare: async () => ({resumes: 'Resumes.', moves}), clock: async () => CLOCK,
    set: async () => ({ok: true}), strike: async () => ({ok: true}), release: () => {}, watch: () => () => {}, now: clock.now, later: clock.later,
    cancel: clock.cancel, random: () => 0})
  p.play(FROZEN_SLOT, 120, undefined, {origin: () => BigInt(ANCHOR), began: () => {}})
  await settled(clock)
  const playing = p.state().lanes
  assert.deepEqual(playing.take, {address: FROZEN_SLOT, name: 'Riff', at: -6, loop: {start: 6, from: 4, to: 8}}, 'its start marker landed on the grid\'s first beat')
  const [looping] = liveSetTrackAdapter.project({set: summary, document: null, play, lanes: playing}).lanes.automation
  assert.deepEqual(looping.loop, {start: 6, from: 4, to: 8})
  assert.deepEqual(automationPoints(looping, () => undefined, 10).map(point => point.at), [1, 3, 5, 7, 9],
    'the first pass from its start marker (beat 7 only), then the loop again (beats 5 and 7) for each pass, to the ruler\'s end')
  assert.deepEqual(automationPoints(looping, () => undefined).map(point => point.at), [-1, 1], 'no ruler\'s end given: its points once, as before')
  assert.equal(automationPoints(looping, () => undefined, 1e9).length, 1 + 2 * LOOP_PASSES_DRAWN, 'at most so many passes drawn')
  // REPLACES (O-I #849 round 23; DLW build ruling 2026-11-05: "Repeat a looping clip's lanes in Arrangement too"): round 22's "an
  // arrangement clip's lanes stand under the clip where it lies", its loop undrawn. An arrangement clip lies on the ruler from its start
  // marker: here at 16 to 24, so beat 7 of the clip stands at 17, then the loop's 5 and 7 again each 4 beats on, cut at the clip's end.
  const [arranged] = liveSetTrackAdapter.project({set: summary, document: null, play,
    lanes: {...playing, take: {...playing.take, address: {path: '/sets/a.als', track: 1, at: {arrangement: 0}}}}}).lanes.automation
  assert.deepEqual(arranged.loop, {start: 6, from: 4, to: 8}, 'an arrangement clip\'s lanes carry its loop as a slot clip\'s do')
  assert.deepEqual(automationPoints(arranged, () => 16, 100, () => 24).map(point => point.at), [17, 19, 21, 23],
    'its first pass from its start marker at the clip\'s start, then each pass of the loop, none past the clip\'s end')
  assert.deepEqual(automationPoints(arranged, () => 16, 30).map(point => point.at), [17, 19, 21, 23, 25, 27, 29], 'no end of its own: to the ruler\'s')
  assert.deepEqual(automationPoints(arranged, () => 16).map(point => point.at), [15, 17], 'no ruler\'s end given: its points once, from its start marker')
  p.stop()
})

// O-I #849 round 24 (DLW build ruling 2026-11-05, item 3: "The older start-marker offset for a non-looping arrangement clip"): a clip whose
// loop is off plays from its start marker too (clipPlan: one pass from `start` to `end`), so where it lies on the ruler is its start
// marker, and its lanes stand from there, as a looping clip's do since round 23.
test('a non-looping arrangement clip\'s lanes stand from its start marker where it lies, as Live plays it from there', async () => {
  const {liveSetTrackAdapter} = await import('../src/timeline/liveSetTrackAdapter.ts')
  const {automationPoints} = await import('../src/frame/tracks/trackLanes.ts')
  const summary = {path: '/sets/a.als', scene_count: 1, tempo_bpm: 120,
    tracks: [{kind: 'midi', name: 'Keys', devices: []}, {kind: 'midi', name: 'Pads', devices: []}, {kind: 'master', name: 'Main', devices: []}]}
  const play = {launch: async () => ({ok: true, note: ''}), stop: () => ({ok: true, note: ''}), stopAll: () => ({ok: true, note: ''}), reenable: async () => ({ok: true, note: ''})}
  const clock = controlledClock()
  const moves = [{beat: 6.5, edits: [], sets: [{parameter: 'frame', value: 4}]}, {beat: 7, edits: [], sets: [{parameter: 'frame', value: 6}]}]
  const p = player.createClipPlayer({read: async () => looped({loop: false}), prepare: async () => ({resumes: 'Resumes.', moves}), clock: async () => CLOCK,
    set: async () => ({ok: true}), strike: async () => ({ok: true}), release: () => {}, watch: () => () => {}, now: clock.now, later: clock.later,
    cancel: clock.cancel, random: () => 0})
  p.play(FROZEN_SLOT, 120, undefined, {origin: () => BigInt(ANCHOR), began: () => {}})
  await settled(clock)
  const playing = p.state().lanes
  assert.deepEqual(playing.take, {address: FROZEN_SLOT, name: 'Riff', at: -6, start: 6}, 'its loop off, it names the start marker it plays from')
  const [arranged] = liveSetTrackAdapter.project({set: summary, document: null, play,
    lanes: {...playing, take: {...playing.take, address: {path: '/sets/a.als', track: 1, at: {arrangement: 0}}}}}).lanes.automation
  assert.equal(arranged.start, 6)
  assert.deepEqual(automationPoints(arranged, () => 16).map(point => point.at), [16.5, 17], 'the clip lies from 16, where beat 6 of it plays')
  const [slot] = liveSetTrackAdapter.project({set: summary, document: null, play, lanes: playing}).lanes.automation
  assert.deepEqual(automationPoints(slot, () => undefined).map(point => point.at), [0.5, 1], 'a slot clip stands where it landed, its start marker counted in, as before')
  p.stop()
})

test('a row stops a track where its empty slot keeps the stop button, and leaves one whose slot has it removed', async () => {
  const {clock, single, acts} = rowHarness()
  await settled(clock, acts.launch({path: '/sets/a.als', track: 3, at: {slot: 0}}, 120, '1 bar'))
  assert.equal(single.state().playing?.name, 'Bass')
  await settled(clock, acts.launchRow('/sets/a.als', 2, 120, ROW, '1 bar'))
  assert.equal(single.state().playing?.name, 'Bass', 'the row holds no slot of track 4 that stops it')
  const said = await settled(clock, acts.launchRow('/sets/a.als', 2, 120, [...ROW, {track: 3, kind: 'stop'}], '1 bar'))
  assert.equal(said.ok, true)
  assert.equal(single.state().playing, null, 'its empty slot\'s stop stops Bass')
})

test('a row with no MIDI clip, no tempo or a Torus that cannot play is refused in words, and nothing plays', async () => {
  const {acts, made} = rowHarness()
  assert.deepEqual(await acts.launchRow('/sets/a.als', 2, 120, [ROW[2]], '1 bar'), {ok: false,
    error: 'Row 3 holds no MIDI clip to play on the torus. Drums is an audio clip, which the engine plays where it lies in the Arrangement, not from a slot.'})
  assert.deepEqual(await acts.launchRow('/sets/a.als', 2, 0, ROW, '1 bar'), {ok: false, error: 'The set discloses no tempo, so the clip has no time to play in.'})
  assert.equal(made.size, 0)
  const lone = player.clipLaunchActs(player.createClipPlayer({}), () => ({ok: true, value: {standing: 'following'}, parameters: {torus: {}}}))
  assert.deepEqual(await lone.launchRow('/sets/a.als', 2, 120, ROW, '1 bar'), {ok: false,
    error: 'Row 3 cannot launch here: this player plays one clip at a time.'})
})
