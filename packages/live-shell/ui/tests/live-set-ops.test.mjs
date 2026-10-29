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
  assert.deepEqual(Object.keys(set).sort(), ['act', 'clipInfo', 'compWrite', 'insertClip', 'mixerWrite', 'sendWrite'], 'O-I #743: the acts on the set\'s objects, Insert clip and the info text')
  await assert.rejects(set.compWrite(0, 1, {start: 0, end: 1}), out)
  await assert.rejects(set.act({kind: 'scene_insert', after: 0}), out)
  await assert.rejects(set.insertClip(2, 0), out)
  await assert.rejects(set.clipInfo.read(2, {slot: 0}), out)
  assert.deepEqual(grooves.GROOVE_BASES, ['1/4', '1/8', '1/8t', '1/16', '1/16t', '1/32'], 'Live\'s Grid order')
})
