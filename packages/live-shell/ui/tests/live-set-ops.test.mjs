// The Live set's own edits in the shell: Clip view on the clip read whole from the set's owner (kernel live_clip_read; the owner is
// packages/live-set/src/edit.rs, tested there and in the kernel), each setting, MIDI tool and Mixer envelope wired to its write,
// and the tools' note transforms. Channels: FIXTURE clip readings shaped as the owner gives them; the pure binding, wiring and
// tools in memory through r2-clip-bindings' loader. The writes' transport is the native candidate's (the screen pass).
import test from 'node:test'
import assert from 'node:assert/strict'
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

const live = await import('../src/live/clipBinding.ts')
const tools = await import('../src/live/liveClipTools.ts')
const {setViewHold, resetViewHolds, clipHostId} = await import('../src/frame/detail/clipBinding.ts')

const liveSet = {path: '/sets/demo.als', tempo_bpm: 120, scene_count: 1, arrangement_clips: 1,
  tracks: [{kind: 'midi', name: 'Pad', devices: []}, {kind: 'audio', name: 'Drums', devices: []}]}
const liveDoc = {path: '/sets/demo.als', tempo: 120, scenes: 1, tracks: [
  {kind: 'midi', name: 'Pad', devices: [], arrangementClips: [], sessionSlots: {'0': 'Riff'}},
  {kind: 'audio', name: 'Drums', devices: [], arrangementClips: [], sessionSlots: {'0': 'Loop'}}]}
const waiting = {state: 'waiting', selection: null, line: 'reading'}
/** The owner's whole clip (edit.rs clip_reading). */
const whole = (over = {}) => ({kind: 'midi', name: 'Riff', colourIndex: 14, active: true, loop: true, start: 0, end: 8, position: 0, length: 4,
  sig: {num: 4, den: 4}, groove: null, scale: true, root: 2, mode: 'dorian', scaleName: 'Dorian', follow: false, followA: 'next', followB: 'none',
  chance: 100, linked: true, multiplier: 1, launch: 'trigger', legato: false, quantize: 'global', launchVelocity: 0,
  envelopes: [{target: '41', device: 'Mixer', parameter: 'Volume', points: [[0, 1], [4, 0.5011872336272722]]}],
  notes: [{id: 1, p: 62, at: 0, len: 1, vel: 100, chance: 1, on: true}, {id: 2, p: 65, at: 2, len: 0.5, vel: 80, chance: 1, on: true}], ...over})
const bind = (w, selection = {track: 0, scene: 0}) => live.liveClipBinding({set: liveSet, document: liveDoc, selection, mode: waiting, whole: w})

test('Clip view draws the clip whole from the set\'s owner, on the design\'s keys', () => {
  const v = bind(whole()).values
  assert.equal(v.name, 'Riff'); assert.equal(v.loop, true); assert.equal(v.length, 4); assert.equal(v.end, 8)
  assert.equal(v['sig.num'], 4); assert.equal(v.groove, 'none', 'no groove reads as none')
  assert.equal(v.mode, 'dorian'); assert.equal(v.root, 2); assert.equal(v.followA, 'next'); assert.equal(v.quantize, 'global')
  assert.deepEqual(JSON.parse(v.notes).map(n => [n.id, n.p, n.at]), [['1', 62, 0], ['2', 65, 2]])
  const volume = JSON.parse(v['env.mixer.volume'])
  assert.equal(volume[0][1], 0, 'unity gain is 0 dB'); assert.ok(Math.abs(volume[1][1] + 6) < 0.01, 'half the amplitude is −6 dB')
  const unread = bind(null).values
  for (const key of ['loop', 'launch', 'notes', 'env.mixer.volume']) assert.equal(key in unread, false, `${key} is absent until the clip is read whole`)
})

test('read whole, every setting, tool and Mixer envelope is a write to the set\'s owner; the shell\'s own instruments say they have none', () => {
  const binding = bind(whole())
  for (const key of ['loop', 'start', 'length', 'launch', 'quantize', 'followA', 'mode', 'root', 'groove', 'launchVelocity', 'name', 'active',
    'duplicate', 'invert', 'transform.press', 'generate.press', 'env.mixer.volume', 'env.mixer.pan']) {
    assert.equal(binding.writes(key), true, key)
    assert.equal(binding.standing[key], undefined, `${key} stands enabled`)
  }
  assert.match(binding.standing['env.mixer.sendA'].disabled, /reports no sends for this part/, 'an owner that reads no mixer row offers no Send envelope')
  assert.match(live.liveWiring({path: '/s.als', track: 0, at: {slot: 0}}, whole(), 'h', null).refused['env.torus.*'], /The Torus is the shell's own instrument/)
  const audio = bind(whole({kind: 'audio', notes: undefined}), {track: 1, scene: 0})
  assert.equal(audio.standing.invert.disabled, 'An audio clip holds no notes.')
  const unread = live.liveClipBinding({set: liveSet, document: liveDoc, selection: {track: 0, scene: 0}, mode: waiting, whole: null, unread: 'the kernel is out of reach'})
  assert.equal(unread.standing.launch.disabled, 'The clip is not read whole yet: the kernel is out of reach.')
})

test('the tools rewrite the notes as Live\'s buttons do, with the settings the view holds', () => {
  resetViewHolds()
  const w = whole()
  const host = clipHostId('live', live.liveClipRef({track: 0, scene: 0}))
  const press = key => live.toolPress(key, w, Object.fromEntries(Object.entries({})))
  const dup = press('duplicate')
  assert.deepEqual(dup.set, {length: 8, end: 8}, 'the loop doubles')
  assert.deepEqual(dup.notes.map(n => n.at), [0, 2, 4, 6])
  assert.deepEqual(press('invert').notes.map(n => n.p), [65, 62])
  assert.deepEqual(live.toolPress('addInterval', w, {interval: 2}).notes.slice(2).map(n => n.p), [65, 69], 'up two degrees of D Dorian')
  assert.deepEqual(live.toolPress('setLength', w, {setGrid: '1/8'}).notes.map(n => n.len), [0.5, 0.5])
  assert.deepEqual(live.toolPress('double', w, {}).notes.map(n => [n.at, n.len]), [[0, 2], [4, 1]])
  assert.deepEqual(live.toolPress('legatoNotes', w, {}).notes.map(n => n.len), [2, 0.5])
  assert.deepEqual(live.toolPress('reverse', w, {}).notes.map(n => n.at), [7, 5.5])
  assert.deepEqual(live.toolPress('invert', w, {note: '2'}).notes.map(n => n.p), [62, 65], 'one selected note mirrors onto itself')
  const off = whole({notes: [{id: 1, p: 61, at: 0.1, len: 1, vel: 100, chance: 1, on: true}]})
  assert.deepEqual(live.toolPress('fitToScale', off, {}).notes.map(n => n.p), [60], 'C♯ falls to C in D Dorian (the lower on a tie)')
  assert.deepEqual(live.toolPress('transform.press', off, {transform: 'quantize', 'q.grid': '1/4', 'q.amount': 100}).notes.map(n => n.at), [0])
  assert.match(live.toolPress('transform.press', off, {transform: 'ornament'}).refused, /not written by the shell yet/)
  const beat = live.toolPress('generate.press', whole({notes: []}), {generate: 'rhythm', 'rhythm.steps': 4, 'rhythm.density': 2, 'rhythm.step': '1/4', 'rhythm.pitch': 36})
  assert.deepEqual(beat.notes.map(n => [n.p, n.at]), [[36, 0], [36, 2], [36, 4], [36, 6]], 'two hits in four steps, across the clip')
  assert.ok(host.startsWith('clip:live:'))
  setViewHold(host, 'interval', 1)
  resetViewHolds()
})

test('the tools keep notes in range and ids only where a note was', () => {
  const notes = [{id: 7, p: 127, at: 0, len: 1, vel: 127, chance: 1}]
  assert.equal(tools.addInterval(notes, null, 3, null)[1].p, 127, 'a pitch stays within 0–127')
  assert.equal(tools.addInterval(notes, null, 3, null)[1].id, undefined, 'a new note takes the owner\'s next id')
  assert.ok(tools.randomize(notes, null, 50, () => 1).every(n => n.vel <= 127))
  assert.deepEqual(tools.strum([{p: 60, at: 0, len: 1, vel: 100, chance: 1}, {p: 67, at: 0, len: 1, vel: 100, chance: 1}], null, 0, 100).map(n => n.at), [0, 0.25])
})

// DLW build ruling 2026-11-09, 46c item 8: a tool's press and the roll's hand copy each note whole, every field read, so its velocity
// deviation, release velocity, switch and expression go back to the set's owner as they came.
test('a tool or the roll\'s hand gives each note back with every field read', () => {
  const kept = {id: 1, p: 62, at: 0, len: 1, vel: 90, dev: -12, off: 30, chance: 0.5, on: false, mpe: {pressure: [[0, 64]]}}
  const w = whole({notes: [kept, {id: 2, p: 65, at: 4, len: 0.5, vel: 100, dev: 0, off: 64, chance: 1, on: true}]})
  for (const key of ['invert', 'double', 'halve', 'reverse', 'legatoNotes', 'duplicate', 'humanize.press']) {
    const one = live.toolPress(key, w, {}).notes.find(n => n.id === 1)
    assert.deepEqual([one.dev, one.off, one.on, one.mpe], [-12, 30, false, {pressure: [[0, 64]]}], key)
  }
  assert.deepEqual(live.noteHand('note.move', w, JSON.stringify({id: 1, at: 2, p: 60})).find(n => n.id === 1), {...kept, at: 2, p: 60},
    'the roll moves the note, and the rest of it stands')
  assert.deepEqual(live.noteHand('note.length', w, JSON.stringify({id: 1, len: 2})).find(n => n.id === 1), {...kept, len: 2})
  assert.deepEqual(live.noteHand('note.erase', w, '2'), [kept], 'the note that stays is whole')
})

// Walk of O-I 857, G17 (DLW build ruling 2026-11-08, item 2): the Sample tab of an audio clip read whole, as the set's owner reads it
// (live-set edit.rs clip_reading: Warp and its mode, SampleVolume as linear gain, Transpose, Detune, Fade or the fade lengths, and
// the units its markers are in), each setting a write to the owner; a MIDI clip has none.
// Round 47 item 5: Arpeggiate as Live 12's reference manual states it (MIDI Transformations, Arpeggiate), on the notes that share a start.
// The styles the chapter does not state are refused in words.
test('Arpeggiate plays each chord as a run at its rate and gate, climbing by Distance for each of its Steps', () => {
  const press = (w, view) => live.toolPress('transform.press', w, {transform: 'arpeggiate', 'arp.distance': 12, 'arp.steps': 2, 'arp.rate': '1/16', 'arp.gate': 100, ...view})
  const c3 = whole({scale: false, notes: [{id: 1, p: 60, at: 0, len: 0.75, vel: 90, dev: -4, off: 30, chance: 0.5, on: true}]})
  const run = press(c3, {'arp.style': 'up'}).notes
  assert.deepEqual(run.map(n => [n.p, n.at, n.len]), [[60, 0, 0.25], [72, 0.25, 0.25], [84, 0.5, 0.25]], 'Distance +12 with Steps 2 plays C3, C4, C5')
  assert.ok(run.every(n => n.id === undefined && n.vel === 90 && n.dev === -4 && n.off === 30 && n.chance === 0.5), 'each step is the chord\'s note, with the owner\'s next id')
  const chord = whole({scale: false, notes: [{id: 3, p: 67, at: 0, len: 1, vel: 100, chance: 1, on: true}, {id: 1, p: 60, at: 0, len: 1, vel: 100, chance: 1, on: true},
    {id: 2, p: 64, at: 0, len: 1, vel: 100, chance: 1, on: true}, {id: 4, p: 50, at: 2, len: 0.5, vel: 100, chance: 1, on: true}]})
  const firstChord = notes => notes.filter(n => n.at < 2).map(n => [n.p, n.at])
  const one = {'arp.steps': 0, 'arp.gate': 50}
  assert.deepEqual(firstChord(press(chord, {...one, 'arp.style': 'up'}).notes), [[60, 0], [64, 0.25], [67, 0.5], [60, 0.75]])
  assert.ok(press(chord, {...one, 'arp.style': 'up'}).notes.every(n => n.len === 0.125), 'Gate 50 % holds half of each step')
  assert.deepEqual(firstChord(press(chord, {...one, 'arp.style': 'down'}).notes), [[67, 0], [64, 0.25], [60, 0.5], [67, 0.75]])
  assert.deepEqual(firstChord(press(chord, {...one, 'arp.style': 'play order'}).notes), [[60, 0], [64, 0.25], [67, 0.5], [60, 0.75]], 'the order the notes were written in')
  assert.deepEqual(firstChord(press(chord, {'arp.style': 'chord trigger', 'arp.steps': 1}).notes).map(([p, at]) => `${p}@${at}`).join(' '),
    '60@0 64@0 67@0 72@0.25 76@0.25 79@0.25 60@0.5 64@0.5 67@0.5 72@0.75 76@0.75 79@0.75', 'Chord Trigger plays each pass\'s chord together')
  assert.deepEqual(press(chord, {...one, 'arp.style': 'up'}).notes.filter(n => n.at >= 2).map(n => [n.p, n.at]), [[50, 2], [50, 2.25]], 'each start is its own chord')
  const picked = live.toolPress('transform.press', chord, {transform: 'arpeggiate', 'arp.style': 'up', 'arp.steps': 0, 'arp.rate': '1/4', note: '4'}).notes
  assert.deepEqual(picked.map(n => [n.id, n.p, n.at]), [[3, 67, 0], [1, 60, 0], [2, 64, 0], [undefined, 50, 2]], 'a selected note arpeggiates its own chord only')
  const dorian = whole({notes: [{id: 1, p: 62, at: 0, len: 0.5, vel: 100, chance: 1, on: true}]})
  assert.deepEqual(press(dorian, {'arp.style': 'up', 'arp.distance': 2, 'arp.steps': 1}).notes.map(n => n.p), [62, 65], 'with the scale on, Distance counts its degrees: D to F in D Dorian')
  const high = whole({scale: false, notes: [{id: 1, p: 120, at: 0, len: 0.75, vel: 100, chance: 1, on: true}]})
  assert.deepEqual(press(high, {'arp.style': 'up'}).notes.map(n => [n.p, n.at]), [[120, 0]], 'a step above MIDI\'s range is left out')
  const random = (xs => () => xs.shift() ?? 0)
  const long = whole({scale: false, notes: [60, 64, 67].map((p, i) => ({id: i + 1, p, at: 0, len: 1.5, vel: 100, chance: 1, on: true}))})
  const order = (style, r) => tools.arpeggiate(long.notes, null, {style, distance: 12, steps: 0, rate: '1/16', gate: 100}, null, r).map(n => n.p)
  const once = order('random once', random([0.9, 0.1]))
  assert.deepEqual(once.slice(3), once.slice(0, 3), 'Random Once keeps one order'); assert.deepEqual([...once.slice(0, 3)].sort(), [60, 64, 67])
  const other = order('random other', random([0.1, 0.1, 0.9, 0.9]))
  assert.deepEqual([...other.slice(0, 3)].sort(), [60, 64, 67]); assert.deepEqual([...other.slice(3)].sort(), [60, 64, 67], 'Random Other plays every note before any again')
  assert.deepEqual(order('random', random([0, 0, 0.99, 0.5, 0.5, 0])), [60, 60, 67, 64, 64, 60], 'Random takes a note at each step')
  for (const style of ['up down', 'down up', 'converge', 'diverge']) {
    assert.match(press(chord, {'arp.style': style}).refused, /style is not made here: Live's manual does not state the order it takes/, style)
  }
  assert.match(live.toolPress('transform.press', chord, {transform: 'connect'}).refused, /not written by the shell yet/)
})

test('G17: the Sample tab reads an audio clip\'s warp, gain, pitch and fades as the set keeps them, and writes each to the set\'s owner', async () => {
  const sample = {kind: 'audio', notes: undefined, warp: false, units: 'seconds', warpMode: 'complexpro', gain: 0.5011872336272722, transpose: -3,
    detune: 12, fade: true, fadeIn: null, fadeOut: null}
  const slot = bind(whole(sample), {track: 1, scene: 0})
  const v = slot.values
  assert.deepEqual([v.warp, v.units, v.warpMode, v.transpose, v.detune, v.fade, v.placed], [false, 'seconds', 'complexpro', -3, 12, true, false])
  assert.ok(Math.abs(v.gain + 6) < 0.01, 'Live keeps linear gain; the tab draws it in dB')
  assert.equal('fadeIn' in v, false, 'a Session clip keeps no fade lengths: its Fade switch')
  for (const key of ['warp', 'warpMode', 'gain', 'transpose', 'detune', 'fade', 'fadeIn', 'fadeOut']) {
    assert.equal(slot.writes(key), true, key)
    assert.equal(slot.standing[key], undefined, `${key} stands enabled`)
  }
  assert.ok(Math.abs(live.SAMPLE_GAIN.toSet(-6) - 0.5011872336) < 1e-9, 'a gain in dB is written as Live keeps it, linear')
  assert.equal(live.SAMPLE_GAIN.toSet(-70), 0, 'the slider\'s floor is silence')
  assert.equal(live.SAMPLE_GAIN.toDesign(0), -70)
  await assert.rejects(slot.write([{key: 'gain', value: -6}]), /The set's owner is the kernel, and it is out of reach here/, 'the write goes to the set\'s owner')
  const midi = bind(whole())
  assert.equal(midi.standing.warp.disabled, 'A MIDI clip plays no sample: the Sample tab is an audio clip\'s.')
  for (const key of ['warp', 'gain', 'units', 'placed']) assert.equal(key in midi.values, false, `${key}: a MIDI clip has no Sample tab`)
  const design = (await import('../src/inhabitants/catalogue/clips/live.tsx')).clip
  assert.deepEqual(design.panel.map(tab => tab.id), ['clip', 'launch', 'sample'])
  const clipView = await import('../src/inhabitants/catalogue/clips/live.tsx')
  assert.deepEqual([clipView.seconds(2), clipView.seconds(61.25), clipView.seconds(-1)], ['0:02:000', '1:01:250', '0:00:000'],
    'an unwarped clip\'s markers read in minutes, seconds and milliseconds of its sample, as Live shows them')
})

// Round 48d item 1 (DLW build ruling 2026-11-09): the rest of Live 12's Sample tab (the reference manual, Clip View, Audio Clip
// Controls): RAM and HiQ, the BPM the clip's warp markers keep its sample at with its ÷2 and ×2, each a write of the clip (live-set
// edit.rs, "ram", "hiq", "bpm"); and Reverse, an act of the set's owner that renders the sample backwards into the set's own folder
// (live-set acts.rs clip_reverse). A MIDI clip has none of them.
test('48d: the Sample tab reads RAM, HiQ and the sample\'s BPM, writes each and its ÷2 and ×2, and Reverse is the set\'s owner\'s act', async () => {
  const sample = {kind: 'audio', notes: undefined, warp: true, units: 'beats', warpMode: 'beats', gain: 1, transpose: 0, detune: 0, fade: true,
    ram: true, hiq: false, bpm: 92}
  const v = bind(whole(sample), {track: 1, scene: 0}).values
  assert.deepEqual([v.ram, v.hiq, v.bpm], [true, false, 92])
  const none = bind(whole({...sample, bpm: null}), {track: 1, scene: 0}).values
  assert.deepEqual(['bpm' in none, none['bpm.none']], [false, true], 'warp markers that keep more than one tempo read no BPM, and say so')
  const older = bind(whole({...sample, bpm: undefined}), {track: 1, scene: 0}).values
  assert.deepEqual(['bpm' in older, 'bpm.none' in older], [false, false], 'a reading with no BPM says nothing of it (48e item 11)')
  assert.equal('ram' in bind(whole()).values, false, 'a MIDI clip has no Sample tab')
  const address = {path: '/sets/sample.als', track: 1, at: {slot: 0}}
  const wiring = live.liveWiring(address, whole(sample), 'h', null)
  for (const key of ['ram', 'hiq', 'bpm', 'sample.reverse']) assert.equal(typeof wiring.acts[key], 'function', `${key} goes to the set's owner`)
  for (const key of ['ram', 'hiq', 'bpm']) assert.ok(wiring.reads[key], `${key} says where it is read from`)
  const midi = live.liveWiring(address, whole(), 'h', null)
  for (const key of ['ram', 'hiq', 'bpm']) assert.equal(midi.refused[key], 'A MIDI clip plays no sample: the Sample tab is an audio clip\'s.', key)
  assert.equal(midi.refused['sample.reverse'], 'A MIDI clip plays no sample: Pitch·Time\'s Reverse plays its notes backwards.')
  assert.match(live.liveWiring(address, null, 'h', 'the kernel is out of reach').refused['sample.reverse'], /not read whole yet: the kernel is out of reach/)
  const written = []
  const owner = async op => {
    if (op.op === 'live_set_read') return {ok: true, outcome: {result: 'live_set_reading', reading: {summary: {path: address.path}, document: {path: address.path}, revision: `sha256:${'0'.repeat(64)}`}}}
    written.push(op)
    if (op.op === 'live_set_act') return {ok: true, outcome: {result: 'live_set_acted', reading: {act: op.act.kind, done: 'Reversed Loop.', at: {track: 1, slot: 0}, revision: 'r1'}}}
    return {ok: true, outcome: {result: 'live_clip_reading', reading: {clip: whole(sample)}}}
  }
  const was = {window: globalThis.window, fetch: globalThis.fetch}
  globalThis.window = {__OI_KERNEL_BRIDGE__: 'http://kernel.test'}
  globalThis.fetch = async (url, init) => ({ok: true, status: 200, headers: {get: () => 'application/json'},
    json: async () => String(url).endsWith('/op') ? owner(JSON.parse(init.body)) : {default_set: address.path}})
  // The design's ÷2 and ×2 set BPM at half and twice what it reads, and its Reverse is a press on the act's key.
  const {clip: design} = await import('../src/inhabitants/catalogue/clips/live.tsx')
  const tab = design.panel.find(item => item.id === 'sample')
  assert.match(tab.does, /BPM with ÷2 and ×2[^]*Reverse, RAM, HiQ/)
  const set = []
  const drawn = tab.draw({v, set: (key, value) => set.push([key, value]), size: 'whole', room: {w: 800, h: 320}})
  const press = label => {
    const stack = [drawn]
    while (stack.length) {
      const next = stack.pop()
      if (!next || typeof next !== 'object') continue
      if (Array.isArray(next)) { stack.push(...next); continue }
      const props = next.props ?? {}
      if (props.label === label && typeof props.onPress === 'function') return props.onPress
      if (typeof next.type === 'function' && !props.children && next.type.name !== 'Action') { try { stack.push(next.type(props)) } catch { /* a control with hooks */ } }
      stack.push(props.children)
    }
    throw new Error(`no press labelled ${label}`)
  }
  press('÷2')(); press('×2')(); press('Reverse')()
  assert.deepEqual(set.slice(0, 2), [['bpm', 46], ['bpm', 184]], '÷2 and ×2 write BPM at half and twice what it reads')
  assert.equal(set[2][0], 'sample.reverse', 'Reverse is the act\'s press')
  // A control's props in a drawn tab, by its label.
  const control = (drawnTab, label) => (function find(node) {
    if (!node || typeof node !== 'object') return undefined
    if (Array.isArray(node)) { for (const x of node) { const f = find(x); if (f) return f } return undefined }
    if (node.props?.label === label) return node.props
    return find(node.props?.children)
  })(drawnTab)
  const drawWith = values => tab.draw({v: {...v, ...values}, set: () => {}, size: 'whole', room: {w: 800, h: 320}})
  const unread = drawWith({bpm: undefined, 'bpm.none': true})
  assert.match(control(unread, '÷2').disabled, /no one tempo/, 'with no one tempo, ÷2 says why it does nothing')
  assert.match(control(unread, '×2').disabled, /no one tempo/, 'and so does ×2')
  assert.match(control(unread, 'BPM').disabled, /no one tempo/, 'and the BPM box')
  // 48e items 2 and 11 (DLW build ruling 2026-11-09): a reading with no BPM shows it unknown, as RAM and HiQ are, and ÷2 and ×2 say there
  // is none to halve or double; each says why where half or twice what it reads would leave the range the set's owner keeps (20 to 999).
  const notRead = drawWith({bpm: undefined})
  assert.deepEqual([Number.isNaN(control(notRead, 'BPM').value), control(notRead, 'BPM').disabled], [true, undefined], 'a BPM not read is unknown')
  assert.equal(control(notRead, '÷2').disabled, 'No BPM is read for the clip\'s sample, so there is none to halve.')
  assert.equal(control(notRead, '×2').disabled, 'No BPM is read for the clip\'s sample, so there is none to double.')
  const fast = drawWith({bpm: 600})
  assert.deepEqual([control(fast, '÷2').disabled, control(fast, '×2').disabled], [undefined, 'Twice 600 BPM is more than 999, the most a clip\'s sample keeps.'])
  const slow = drawWith({bpm: 30})
  assert.deepEqual([control(slow, '÷2').disabled, control(slow, '×2').disabled], ['Half of 30 BPM is less than 20, the least a clip\'s sample keeps.', undefined])
  assert.deepEqual([control(drawWith({bpm: 499.5}), '×2').disabled, control(drawWith({bpm: 40}), '÷2').disabled], [undefined, undefined],
    'twice 499.5 is 999 and half of 40 is 20, each in the range')
  // RAM, HiQ and the BPM box each write their own key through the design.
  const wrote = []
  const own = tab.draw({v, set: (key, value) => wrote.push([key, value]), size: 'whole', room: {w: 800, h: 320}})
  control(own, 'RAM').onChange(false); control(own, 'HiQ').onChange(true); control(own, 'BPM').onChange(120)
  assert.deepEqual(wrote, [['ram', false], ['hiq', true], ['bpm', 120]], 'RAM, HiQ and BPM write their own keys')
  try {
    await wiring.acts.bpm(184)
    await wiring.acts.ram(false)
    await wiring.acts['sample.reverse'](Date.now())
  } finally { globalThis.window = was.window; globalThis.fetch = was.fetch }
  assert.deepEqual(written.map(op => [op.op, op.track, op.clip, op.set ?? op.act]), [
    ['live_clip_write', 1, {slot: 0}, {bpm: 184}], ['live_clip_write', 1, {slot: 0}, {ram: false}],
    ['live_set_act', undefined, undefined, {kind: 'clip_reverse', track: 1, clip: {slot: 0}}]])
})

test('the mixer row reads each part\'s own controls and writes them to the set; its take lanes and automation lie under it', async () => {
  const {liveSetTrackAdapter, LIVE_MIXER_WRITE_OP} = await import('../src/timeline/liveSetTrackAdapter.ts')
  const doc = {...liveDoc, tracks: [
    {...liveDoc.tracks[0], mixer: {activator: true, solo: false, arm: true, monitor: 'auto', input: 'All Ins · All Channels', output: 'Main'},
      takeLanes: [{name: 'Lane', clips: [{name: 'Take 1', start: 0, end: 16}]}],
      automation: [{target: '41', device: 'Mixer', parameter: 'Volume', points: [[0, 1], [8, 0.5]]}],
      devices: [{name: 'Mixer', params: [{id: 'Volume', value: '1', min: '0', max: '2'}]}]},
    {...liveDoc.tracks[1], mixer: {activator: false}, takeLanes: [], automation: []}]}
  const wrote = []
  const set = liveSetTrackAdapter.project({set: liveSet, document: doc, mixerWrite: async (track, control, value) => { wrote.push([track, control, value]) }})
  assert.deepEqual(set.tracks[0].mix, {activator: true, solo: false, arm: true, monitor: 'auto', input: 'All Ins · All Channels', output: 'Main'})
  assert.deepEqual(set.tracks[1].mix, {activator: false}, 'a control the part has no element for stays absent')
  for (const id of ['activator', 'solo', 'arm', 'monitor']) assert.equal(set.mixer[id].disabled, undefined, `${id} writes`)
  assert.match(set.mixer.output.disabled, /routing is read from the set/)
  assert.equal(set.actions.mixer.solo.op, LIVE_MIXER_WRITE_OP('solo'))
  assert.deepEqual(await set.actions.mixer.monitor.run(set.tracks[0].id, 'in'), {ok: true, note: 'monitor written to the set.'})
  assert.deepEqual(wrote, [[0, 'monitor', 'in']])
  assert.deepEqual(set.lanes.takes, [{id: `${set.tracks[0].id}#take/0`, trackId: set.tracks[0].id, name: 'Lane', spans: [{start: 0, end: 16, label: 'Take 1'}]}])
  assert.deepEqual(set.lanes.automation[0].points, [{at: 0, value: 0.5}, {at: 8, value: 0.25}], 'values 0–1 of the parameter\'s range')
  const unwritten = liveSetTrackAdapter.project({set: liveSet, document: liveDoc})
  assert.match(unwritten.mixer.solo.disabled, /missing op/, 'an owner that reads no mixer leaves the row saying what it lacks')
  assert.match(unwritten.lanes.absent.takes, /missing op/)
})

// ── the owner's remaining ops: the clip's colour, the sends, the comp and the Groove Pool ─────────────────────────────────────────

const {LIVE_CLIP_PALETTE, liveColour, liveColourIndex} = await import('../src/live/livePalette.ts')

test('the clip\'s colour is its own palette index, drawn and chosen as Live\'s 70 colours', async () => {
  assert.equal(LIVE_CLIP_PALETTE.length, 70); assert.equal(new Set(LIVE_CLIP_PALETTE).size, 70, 'seventy distinct colours, 14 × 5')
  assert.equal(liveColour(9), '#5480E4', 'the template set\'s LABS clips (Color 9) are Live\'s blue')
  assert.equal(liveColour(13), '#FFFFFF', 'the first row ends in white'); assert.equal(liveColour(69), '#3C3C3C')
  assert.equal(liveColour(70), null); assert.equal(liveColour(null), null)
  for (let i = 0; i < 70; i++) assert.equal(liveColourIndex(liveColour(i)), i)
  assert.equal(liveColourIndex('#ff94a6'), 0, 'any case'); assert.equal(liveColourIndex(42), 42)
  assert.equal(liveColourIndex('#123456'), null); assert.equal(liveColourIndex('var(--sel)'), null); assert.equal(liveColourIndex(70), null)
  const read = bind(whole({colourIndex: 14}))
  assert.equal(read.values.colour, '#FF3636', 'the clip\'s own colour, not its track\'s')
  assert.equal(read.writes('colour'), true); assert.equal(read.standing.colour, undefined)
  await assert.rejects(read.write([{key: 'colour', value: '#123456'}]), /one of Live's 70 palette colours/)
  await assert.rejects(read.write([{key: 'colour', value: '#FF3636'}]), /out of reach here/, 'a palette colour goes to the set\'s owner')
  const unread = live.liveClipBinding({set: liveSet, document: liveDoc, selection: {track: 0, scene: 0}, mode: waiting, colour: '#79b6ce'})
  assert.equal(unread.values.colour, '#79b6ce', 'until read whole, the track\'s colour')
  assert.match(unread.standing.colour.disabled, /not read whole yet/)
})

test('Clip view\'s Envelopes move each send of the part, named as Live names them, in dB', async () => {
  const floor = 0.0003162277571
  const sends = [{name: 'A-Reverb', send: 'Send A', value: floor, min: floor, max: 1, on: true}, {name: 'B-Delay', send: 'Send B', value: 0.5, min: floor, max: 1, on: true}]
  const doc = {...liveDoc, tracks: [{...liveDoc.tracks[0], mixer: {activator: true, sends}}, liveDoc.tracks[1]]}
  const w = whole({envelopes: [{target: '32', device: 'Mixer', parameter: 'Send B', points: [[0, 1], [4, 0.5011872336272722]]}]})
  const binding = live.liveClipBinding({set: liveSet, document: doc, selection: {track: 0, scene: 0}, mode: waiting, whole: w})
  const sendB = JSON.parse(binding.values['env.mixer.sendB'])
  assert.equal(sendB[0][1], 0); assert.ok(Math.abs(sendB[1][1] + 6) < 0.01, 'half the amplitude is −6 dB')
  for (const key of ['env.mixer.sendA', 'env.mixer.sendB']) { assert.equal(binding.writes(key), true, key); assert.equal(binding.standing[key], undefined, key) }
  const toSet = live.sendEnvelopes(sends)['env.mixer.sendA']
  assert.equal(toSet.parameter, 'Send A'); assert.equal(toSet.toSet(0), 1); assert.equal(toSet.toSet(-200), floor, 'no lower than Live\'s floor')
  const none = live.liveClipBinding({set: liveSet, document: {...liveDoc, tracks: [{...liveDoc.tracks[0], mixer: {activator: true}}, liveDoc.tracks[1]]},
    selection: {track: 0, scene: 0}, mode: waiting, whole: whole()})
  assert.match(none.standing['env.mixer.sendA'].disabled, /sends nowhere: the set has no return track/)
})

test('the mixer row carries each part\'s sends in dB and writes one through the set\'s owner; a return\'s own send is off', async () => {
  const {liveSetTrackAdapter, LIVE_SEND_WRITE_OP, liveMixSends} = await import('../src/timeline/liveSetTrackAdapter.ts')
  const floor = 0.0003162277571
  const sends = [{name: 'A-Reverb', send: 'Send A', value: 0.5011872336272722, min: floor, max: 1, on: true}, {name: 'B-Delay', send: 'Send B', value: floor, min: floor, max: 1, on: false}]
  const doc = {...liveDoc, tracks: [{...liveDoc.tracks[0], mixer: {activator: true, sends}, takeLanes: [], automation: []}, {...liveDoc.tracks[1], mixer: {activator: true}, takeLanes: [], automation: []}]}
  const wrote = []
  const set = liveSetTrackAdapter.project({set: liveSet, document: doc, mixerWrite: async () => {}, sendWrite: async (...args) => { wrote.push(args) }})
  const row = set.tracks[0].mix.sends
  assert.deepEqual(row.map(s => [s.id, s.name, s.unit]), [['Send A', 'A-Reverb', 'dB'], ['Send B', 'B-Delay', 'dB']])
  assert.ok(Math.abs(row[0].value + 6) < 0.01); assert.ok(Math.abs(row[0].min + 70) < 0.01, 'Live\'s floor is −70 dB'); assert.equal(row[0].max, 0)
  assert.match(row[1].disabled, /Send B is off on this part/)
  assert.equal(set.tracks[1].mix.sends, undefined, 'a part the owner reads no sends for carries none')
  assert.equal(set.actions.mixer.send.op, LIVE_SEND_WRITE_OP)
  assert.deepEqual(await set.actions.mixer.send.run(set.tracks[0].id, 'Send A', 0), {ok: true, note: 'Send A written to the set.'})
  assert.deepEqual(wrote, [[0, 0, 1]], 'track 0, send 0, unity gain')
  assert.match((await set.actions.mixer.send.run(set.tracks[0].id, 'Send B', -6)).error, /off on this part/)
  assert.match((await set.actions.mixer.send.run(set.tracks[0].id, 'Send C', -6)).error, /no send of this part/)
  assert.equal(wrote.length, 1, 'a refused send writes nothing')
  assert.deepEqual(liveMixSends([]), [])
  const readOnly = liveSetTrackAdapter.project({set: liveSet, document: doc, mixerWrite: async () => {}})
  assert.equal(readOnly.actions.mixer.send, undefined, 'no send writer handed in: the sends are read')
})

test('the comp: each main-lane stretch lies under the take it came from, and Return copies a take\'s stretch through the owner', async () => {
  const {liveSetTrackAdapter, LIVE_COMP_OP} = await import('../src/timeline/liveSetTrackAdapter.ts')
  // FIXTURE: take lanes as the owner reads them (edit.rs take_lanes_json): each take's TakeId and the main-lane stretches it gave.
  const doc = {...liveDoc, tracks: [{...liveDoc.tracks[0], mixer: {activator: true}, automation: [], takeLanes: [
    {name: 'Lane', clips: [{name: 'Keys', start: 0, end: 16, takeId: 1, gave: [{start: 10, end: 16}, {start: 0, end: 6}]}]},
    {name: 'Lane', clips: [{name: 'Keys 2', start: 4, end: 12, takeId: 2, gave: [{start: 6, end: 10}]}]}]},
    {...liveDoc.tracks[1], takeLanes: [], automation: []}]}
  const comps = []
  const set = liveSetTrackAdapter.project({set: liveSet, document: doc, compWrite: async (...args) => { comps.push(args) }})
  const track = set.tracks[0].id
  assert.deepEqual(set.lanes.comp, [{trackId: track, takeId: `${track}#take/0`, start: 0, end: 6}, {trackId: track, takeId: `${track}#take/1`, start: 6, end: 10},
    {trackId: track, takeId: `${track}#take/0`, start: 10, end: 16}], 'the main lane names which take each stretch came from, in the ruler\'s order')
  assert.equal(set.actions.comp.op, LIVE_COMP_OP)
  assert.deepEqual(await set.actions.comp.run(track, `${track}#take/1`, {start: 6, end: 10}), {ok: true, note: 'The take\'s stretch stands in the main lane.'})
  assert.deepEqual(comps, [[0, 1, {start: 6, end: 10}]], 'track 0, take lane 1, the stretch')
  assert.match((await set.actions.comp.run(track, 'als:/other.als#track/0#take/1', {start: 0, end: 1})).error, /not a take lane of this set/)
  const refused = liveSetTrackAdapter.project({set: liveSet, document: doc, compWrite: async () => { throw new Error('The set changed since it was read') }})
  assert.deepEqual(await refused.actions.comp.run(track, `${track}#take/0`, {start: 0, end: 1}), {ok: false, error: 'The set changed since it was read'}, 'a refusal in the owner\'s words')
  assert.equal(liveSetTrackAdapter.project({set: liveSet, document: doc}).actions, undefined, 'no comp writer handed in: the takes are read')
})

test('the writes go through the set\'s owner on its revision: the send, the comp and the Groove Pool', async () => {
  const writes = await import('../src/live/liveWrites.ts')
  const grooves = await import('../src/live/liveGrooves.ts')
  const out = /The set's owner is the kernel, and it is out of reach here/
  await assert.rejects(writes.writeLiveSend('/s.als', 0, 1, 0.5), out)
  await assert.rejects(writes.writeLiveComp('/s.als', 0, 1, {start: 6, end: 10}), out)
  await assert.rejects(grooves.writeLiveGroove('/s.als', 1, 'base', '1/8t'), out)
  await assert.rejects(grooves.writeLiveGlobalGroove('/s.als', 120), out)
  const set = writes.liveSetWrites('/s.als')
  assert.deepEqual(Object.keys(set).sort(), ['act', 'clipInfo', 'compWrite', 'consolidateAudio', 'cropAudio', 'insertClip', 'mixerWrite', 'openSound', 'sendWrite'],
    'O-I #743: the acts on the set\'s objects, Insert clip, the info text and an audio part\'s Consolidate (the engine\'s render); O-I #852: a kept sound opened on a part (live/LivePresets.tsx playKeptSoundOn); DLW build ruling 2026-11-05: an audio clip\'s Crop (the host\'s cut)')
  assert.equal(typeof set.openSound, 'function')
  await assert.rejects(set.consolidateAudio(0, {start: 0, end: 4}), out)
  await assert.rejects(set.cropAudio(0, {arrangement: 0}, null), out)
  await assert.rejects(set.compWrite(0, 1, {start: 0, end: 1}), out)
  await assert.rejects(set.act({kind: 'scene_insert', after: 0}), out)
  await assert.rejects(set.insertClip(2, 0), out)
  await assert.rejects(set.clipInfo.read(2, {slot: 0}), out)
  assert.deepEqual(grooves.GROOVE_BASES, ['1/4', '1/8', '1/8t', '1/16', '1/16t', '1/32'], 'Live\'s Grid order')
})

// O-I #853's MPE tab on the clip read whole (DLW build ruling 2026-11-05, BB round 19): each note's expression as the set keeps it beside
// the note (live/liveWrites.ts liveClipMpe) is the tab's `mpe`; bend is the hand's force, −1..1 about a centre line, never semitones
// (LIVE_MPE_BEND_FORCE); and Slide, which nothing records, is drawn dim saying so (LIVE_MPE_NO_SLIDE).
test('the MPE tab reads each note\'s expression from the clip read whole: pressure on 0–127, bend as its force', async () => {
  const writes = await import('../src/live/liveWrites.ts')
  const {wiredKey} = await import('../src/frame/detail/clipBinding.ts')
  const notes = [{id: 1, p: 62, at: 0, len: 1, vel: 100, chance: 1, on: true, mpe: {pressure: [[0, 0.5], [0.5, 1]], bend: [[0, 0], [0.5, -0.5]]}},
    {id: 2, p: 65, at: 2, len: 0.5, vel: 80, chance: 1, on: true}]
  const v = bind(whole({notes})).values
  assert.deepEqual(JSON.parse(v.mpe), writes.liveClipMpe(notes).mpe)
  assert.deepEqual(JSON.parse(v.mpe), {1: {pressure: [[0, 64], [0.5, 127]], bend: [[0, 0], [0.5, -0.5]]}})
  assert.equal(bind(whole()).values.mpe, '{}', 'read whole and no note carries expression: an empty reading, not an absent one')
  assert.equal('mpe' in bind(null).values, false, 'unread: absent until the clip is read whole')
  const wiring = live.liveWiring({path: '/s.als', track: 0, at: {slot: 0}}, whole({notes}), 'h', null)
  assert.equal(wiring.absent?.mpe, undefined, 'no longer marked absent')
  assert.match(wiring.reads.mpe, /pressure and bend/)
  assert.equal(wiredKey(wiring, 'mpe.bend'), true, 'whether the tab shows the bend lane is the view\'s')
})

test('the MPE tab draws Bend about its centre line as a force, and Slide dim because nothing records it', async () => {
  const React = await import('react')
  const {renderToStaticMarkup} = await import('react-dom/server')
  const writes = await import('../src/live/liveWrites.ts')
  const {clip: design} = await import('../src/inhabitants/catalogue/clips/live.tsx')
  const tab = v => renderToStaticMarkup(React.createElement(() => design.editor.find(item => item.id === 'mpe').draw({v, set: () => {}, size: 'whole', room: {w: 800, h: 320}})))
  const esc = text => text.replace(/'/g, '&#x27;')
  const notes = [{id: 1, p: 62, at: 0, len: 1, vel: 100, chance: 1, on: true, mpe: {pressure: [[0, 0.5]], bend: [[0, 0], [0.5, 1], [1, -1]]}}]
  const html = tab(bind(whole({notes})).values)
  const bend = /<svg[^>]*data-lane="bend"[^>]*>([^]*?)<\/svg>/.exec(html)
  assert.ok(bend, 'a Bend lane')
  assert.ok(bend[0].includes(esc(writes.LIVE_MPE_BEND_FORCE)), 'worded as a force')
  const axis = [...bend[1].matchAll(/<text[^>]*class="clv-axis"[^>]*>([^<]*)<\/text>/g)].map(m => m[1])
  assert.deepEqual(axis, ['Bend', '1', '0', '−1'], 'up, the centre, down: no semitones')
  assert.doesNotMatch(bend[1], /st\b|semitone/)
  const centre = /<line[^>]*class="clv-mpe-centre"[^>]*y1="([\d.]+)"/.exec(bend[1])
  assert.ok(centre, 'a centre line')
  const path = /<path d="M[\d.]+ ([\d.]+) L[\d.]+ ([\d.]+) L[\d.]+ ([\d.]+)"/.exec(bend[1])
  assert.ok(path, 'the note\'s bend drawn')
  const [mid, up, down] = path.slice(1).map(Number)
  assert.equal(mid, Number(centre[1]), 'no force sits on the centre line')
  assert.ok(up < mid && down > mid && Math.abs((mid - up) - (down - mid)) < 0.11, 'up as far above as down below')
  const slide = /<svg[^>]*data-lane="slide"[^>]*>/.exec(html)?.[0]
  assert.ok(slide, 'the Slide lane stays where it was')
  assert.match(slide, /data-dim="true"/)
  assert.ok(slide.includes(esc(writes.LIVE_MPE_NO_SLIDE)), 'dim, saying why')
  assert.doesNotMatch(/<svg[^>]*data-lane="pressure"[^>]*>/.exec(html)[0], /data-dim/, 'pressure is recorded: drawn plain')
  assert.doesNotMatch(tab({...bind(whole({notes})).values, 'mpe.bend': false}), /data-lane="bend"/, 'Bend off: no lane')
  const source = await (await import('node:fs/promises')).readFile(new URL('../src/inhabitants/catalogue/clips/live.tsx', import.meta.url), 'utf8')
  assert.match(source.split('\n')[7], /bend: \[\[t, −1–1\]…\]/, 'the contract says bend is a force')
  assert.doesNotMatch(source.split('\n').slice(0, 9).join('\n'), /semitones/)
})

// Walk #857 (Arriving, 7 Nov): three quick steps of a part's Volume, each a write on the set's standing revision, left one: the second and
// third were sent on the revision the first had already moved, and the set's owner refused them ("The set changed since it was read"), so
// the hand's steps were lost. Writes to one set now go one after another, each on the revision the one before it left.
test('quick writes to one set each land on the revision the one before left, none refused as stale', async () => {
  const writes = await import('../src/live/liveWrites.ts')
  const path = '/sets/race.als'
  let revision = 0, applied = []
  const rev = () => `sha256:${String(revision).padStart(64, '0')}`
  let queue = Promise.resolve()
  const owner = op => (queue = queue.then(async () => {
    await new Promise(resolve => setTimeout(resolve, 15))
    if (op.op === 'live_set_read') return {ok: true, outcome: {result: 'live_set_reading', reading: {summary: {path}, document: {path}, revision: rev()}}}
    if (op.expected_revision !== rev()) return {ok: false, error: 'The set changed since it was read (Live may have saved it): read it again and make the change on what stands'}
    revision += 1; applied.push(op.value)
    return {ok: true, outcome: {result: 'live_track_mixer_reading', reading: {mixer: {volume: op.value}}}}
  }))
  const was = {window: globalThis.window, fetch: globalThis.fetch}
  globalThis.window = {__OI_KERNEL_BRIDGE__: 'http://kernel.test'}
  globalThis.fetch = async (url, init) => ({ok: true, status: 200, headers: {get: () => 'application/json'},
    json: async () => String(url).endsWith('/op') ? owner(JSON.parse(init.body)) : {default_set: path}})
  try {
    const steps = await Promise.allSettled([0.9, 0.8, 0.7].map(volume => writes.writeLiveMixer(path, 0, 'volume', volume)))
    assert.deepEqual(steps.map(step => step.status === 'rejected' ? String(step.reason?.message ?? step.reason) : 'ok'), ['ok', 'ok', 'ok'])
    assert.deepEqual(applied, [0.9, 0.8, 0.7], 'each step lands, in the order the hand made them')
  } finally { globalThis.window = was.window; globalThis.fetch = was.fetch }
})

// Walk of O-I 857, LN02 (7 Nov): the roll drew no notes. Clip view's Notes said "Press a note to select it" and nothing more: no
// gesture made a note, none removed one. Now a double-click on an empty row draws a note there, one grid step long at velocity 100;
// a double-click on a note removes it; a drag moves or lengthens it. Each is a write of the clip's notes through the set's owner
// (live_clip_write notes), as the MIDI tools' are (DLW build ruling 2026-11-07, ruling 3).
test('the roll\'s hand: a note drawn, removed, moved or lengthened is a write of the clip\'s notes through the set\'s owner', async () => {
  const address = {path: '/sets/roll.als', track: 0, at: {slot: 0}}
  const hands = ['note.draw', 'note.erase', 'note.move', 'note.length']
  const wiring = live.liveWiring(address, whole(), 'h', null)
  for (const key of hands) assert.equal(typeof wiring.acts[key], 'function', `${key} writes to the set's owner`)
  const audio = live.liveWiring(address, whole({kind: 'audio', notes: undefined}), 'h', null)
  for (const key of hands) assert.equal(audio.refused[key], 'An audio clip holds no notes.', key)
  assert.match(live.liveWiring(address, null, 'h', 'the kernel is out of reach').refused['note.draw'], /not read whole yet: the kernel is out of reach/)
  const written = []
  const owner = async op => {
    if (op.op === 'live_set_read') return {ok: true, outcome: {result: 'live_set_reading', reading: {summary: {path: address.path}, document: {path: address.path}, revision: `sha256:${'0'.repeat(64)}`}}}
    written.push(op)
    return {ok: true, outcome: {result: 'live_clip_reading', reading: {clip: whole({notes: op.notes})}}}
  }
  const was = {window: globalThis.window, fetch: globalThis.fetch}
  globalThis.window = {__OI_KERNEL_BRIDGE__: 'http://kernel.test'}
  globalThis.fetch = async (url, init) => ({ok: true, status: 200, headers: {get: () => 'application/json'},
    json: async () => String(url).endsWith('/op') ? owner(JSON.parse(init.body)) : {default_set: address.path}})
  const was1 = {id: 1, p: 62, at: 0, len: 1, vel: 100, chance: 1, on: true}, was2 = {id: 2, p: 65, at: 2, len: 0.5, vel: 80, chance: 1, on: true}
  try {
    await wiring.acts['note.draw'](JSON.stringify({p: 64, at: 1.25, len: 0.25}))
    await wiring.acts['note.erase']('2')
    await wiring.acts['note.move'](JSON.stringify({id: '1', at: 3, p: 60}))
    await wiring.acts['note.length'](JSON.stringify({id: '2', len: 1.5}))
    await assert.rejects(wiring.acts['note.erase']('9'), /no note 9 in the clip/i, 'a note that is not there is not removed in silence')
  } finally { globalThis.window = was.window; globalThis.fetch = was.fetch }
  assert.deepEqual(written.map(op => op.op), ['live_clip_write', 'live_clip_write', 'live_clip_write', 'live_clip_write'])
  assert.deepEqual(written.map(op => [op.track, op.clip]), Array(4).fill([0, {slot: 0}]))
  assert.deepEqual(written[0].notes, [was1, was2, {p: 64, at: 1.25, len: 0.25, vel: 100, chance: 1}], 'drawn: a new note, with no id, beside the ones there')
  assert.deepEqual(written[1].notes, [was1], 'removed: note 2 is gone, note 1 keeps its id')
  assert.deepEqual(written[2].notes, [{...was1, at: 3, p: 60}, was2], 'moved: note 1 keeps its id at its new place and row')
  assert.deepEqual(written[3].notes, [was1, {...was2, len: 1.5}], 'lengthened')
  assert.equal(tools.drawNote([], 200, -1, 0).at(0).p, 127, 'a drawn note stays on the keyboard')
  assert.ok(tools.drawNote([], 60, -1, 0).at(0).at >= 0 && tools.drawNote([], 60, -1, 0).at(0).len > 0, 'at or after the clip\'s start, and some length')
})

test('the roll\'s Notes hand its gestures to those writes: a drawn note is one step of the editor\'s grid, where the hand put it', async () => {
  const React = await import('react')
  const {renderToStaticMarkup} = await import('react-dom/server')
  const kit = await import('../src/inhabitants/catalogue/clips/clipKit.tsx')
  const {clip: design} = await import('../src/inhabitants/catalogue/clips/live.tsx')
  const notesTab = design.editor.find(item => item.id === 'notes')
  const sets = []
  const roll = v => { const p = {v, set: (key, value) => sets.push([key, value]), size: 'whole', room: {w: 800, h: 320}}; const el = notesTab.draw(p); return el.type(el.props) }
  const grid = roll(bind(whole()).values)
  assert.equal(grid.type, kit.LaneGrid, 'the roll is the clip kit\'s lane grid')
  for (const hand of ['onDraw', 'onErase', 'onMove', 'onLength']) assert.equal(typeof grid.props[hand], 'function', hand)
  assert.equal(grid.props.snap, 0.25, 'the editor\'s grid, 1/16, is the step a drawn or dragged note snaps to')
  grid.props.onDraw(1.25, '64'); grid.props.onErase('2'); grid.props.onMove('1', 3, '60'); grid.props.onLength('2', 1.5)
  assert.deepEqual(sets, [['note.draw', JSON.stringify({p: 64, at: 1.25, len: 0.25})], ['note.erase', '2'],
    ['note.move', JSON.stringify({id: '1', at: 3, p: 60})], ['note.length', JSON.stringify({id: '2', len: 1.5})]])
  assert.equal(roll({...bind(whole()).values, grid: '1/8'}).props.snap, 0.5, 'the grid at 1/8 draws eighths')
  assert.match(grid.props.does, /Double-click an empty row to draw a note/)
  assert.match(grid.props.does, /double-click a note to remove it/i)
  // The lane grid: a double-click lands on the step under the hand; the rows say they draw.
  assert.equal(kit.laneTime(56 + (800 - 56) * (1.3 / 8), {from: 0, to: 8, keyW: 56, w: 800, snap: 0.25}), 1.25, 'snapped down to the step under the hand')
  assert.equal(kit.laneTime(10, {from: 0, to: 8, keyW: 56, w: 800, snap: 0.25}), 0, 'never before the span')
  const html = renderToStaticMarkup(React.createElement(() => notesTab.draw({v: bind(whole()).values, set: () => {}, size: 'whole', room: {w: 800, h: 320}})))
  assert.match(html, /<rect[^>]*class="clv-lane"[^>]*data-draws="true"/, 'the rows draw')
  const still = renderToStaticMarkup(React.createElement(kit.LaneGrid, {lanes: [{id: 'a'}], blocks: [], from: 0, to: 4, major: 4, minor: 1, label: String, w: 300, h: 100, name: 'G', does: 'd'}))
  assert.doesNotMatch(still, /data-draws/, 'a lane grid with no hand to draw draws nothing')
})

// Walk of O-I 857, LN02 (7 Nov): a note drawn whole ("chance 1", Live's Probability) was said as "chance 1 %", and the chance lane stood
// at a hundredth of its height. The set holds a note's chance from 0 to 1, as the clip player and the MIDI tools read it.
test('the roll says a note\'s chance as the set holds it, from 0 to 1: a note that always plays is 100 %', async () => {
  const {clip: design} = await import('../src/inhabitants/catalogue/clips/live.tsx')
  const notesTab = design.editor.find(item => item.id === 'notes')
  const roll = v => { const p = {v, set: () => {}, size: 'whole', room: {w: 800, h: 320}}; const el = notesTab.draw(p); return el.type(el.props) }
  const values = bind(whole({notes: [{id: 1, p: 60, at: 0, len: 1, vel: 100, chance: 1, on: true}, {id: 2, p: 64, at: 1, len: 1, vel: 80, chance: 0.5, on: true}]})).values
  const said = roll(values).props.blocks.map(block => block.does)
  assert.match(said[0], /velocity 100, chance 100 %\.$/)
  assert.match(said[1], /velocity 80, chance 50 %\.$/)
  assert.deepEqual(roll({...values, lane: 'chance'}).props.blocks.map(block => block.vel), [127, 63.5], 'the chance lane stands as tall as the chance')
})
