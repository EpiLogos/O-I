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
  assert.match(binding.standing['env.mixer.sendA'].disabled, /track send/)
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
