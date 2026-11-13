// Parity D-26: the Arrangement ruler stands as its catalogue design (dlw__arrangement-ruler.tsx) on a binding over the tracks the Session ·
// Arrangement pane reads, laid as the pane's ruler lays them (frame/tracks/rulerBinding.ts), published by the pane (ModeTracksView.tsx) with
// the shell's own ruler as its Full.
// - FIXTURE, owner-shaped: a Factory-shaped WorldTrackSet on a ruler of seconds (its label and duration functions, a fixed window, now),
//   a stalled needle, a running clip with takes, a section, and the loop its owner carries with its setLoop op.
// - SCRIPTED: the design drawn through the runtime's host on the binding, and the design's own draw on the same values; writes go to a
//   stand-in setLoop and a stand-in selection.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

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
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export default null'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

globalThis.__CRADLE_WALK__ = false
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const host = await import('../src/frame/devices/deviceHost.tsx')
const holds = await import('../src/techne/devices/designDevices.ts')
const ruler = await import('../src/frame/tracks/rulerBinding.ts')
const {design} = await import('../src/inhabitants/catalogue/panels/dlw__arrangement-ruler.tsx')
const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

const clock = at => { const s = 14 * 3600 + Math.round(at); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }
const looped = []
const SET = {
  columns: [{id: 'b1', name: 'Batch 1'}],
  ruler: {unit: 'seconds', label: clock, end: 600, now: 600, duration: span => `${Math.floor(span / 60)}m ${String(Math.round(span % 60)).padStart(2, '0')}s`},
  tracks: [
    {id: 'ana', name: 'Ana · lead', kind: 'agent', color: '#779dcc', needle: 600},
    {id: 'bo', name: 'Bo fixtures', kind: 'agent', color: '#9885bc', needle: 420, stalled: true},
  ],
  clips: [
    {id: 'k1', trackId: 'ana', columnId: 'b1', label: 'plan the east port', status: 'stopped', at: {start: 60, end: 180}},
    {id: 'k2', trackId: 'ana', columnId: 'b1', label: 'map the field', status: 'running', at: {start: 240, end: 600}, takes: [{id: 't1', name: 'one'}, {id: 't2', name: 'two'}]},
    {id: 'k3', trackId: 'bo', columnId: 'b1', label: 'make fixtures', status: 'stalled', at: {start: 300, end: 420}, standing: {visual: 'derived', verbatim: null, rule: 'r'}},
    {id: 'k4', trackId: 'bo', columnId: 'b1', label: 'never placed', status: 'waiting'},
  ],
  sections: [{id: 's1', name: 'Morning', span: {start: 0, end: 300}}],
  loop: {start: 240, end: 480},
  actions: {setLoop: {op: 'loop', run: (edge, at) => { looped.push([edge, at]) }}},
}
const picked = []
const selection = {ref: 'k2', select: target => { picked.push(target) }}

test('D-26: the binding lays the set as the pane\'s ruler lays it, in the ruler\'s own words', () => {
  holds.resetHolds()
  const b = ruler.rulerBinding(SET, selection, 'factory')
  assert.deepEqual(JSON.parse(b.values.clips).map(c => [c.id, c.at, c.end ?? null, c.status, c.standing ?? null, c.takes ?? null]),
    [['k1', 60, 180, 'stopped', null, null], ['k2', 240, 600, 'running', null, 2], ['k3', 300, 420, 'stalled', 'derived', null]], 'a clip with no place on the ruler is left to the Session')
  assert.deepEqual(JSON.parse(b.values.tracks).map(t => [t.id, t.needle, t.stalled ?? false]), [['ana', 600, false], ['bo', 420, true]])
  assert.deepEqual(JSON.parse(b.values.sections), [{id: 's1', name: 'Morning', from: 0, to: 300}])
  assert.deepEqual([b.values.end, b.values.now, b.values.unit, b.values.loop, b.values.loopIn, b.values.loopOut, b.values.sel, b.values.start, b.values.span, b.values.snap],
    [600, 600, 'seconds', true, 240, 480, 'k2', 0, 600, 'grid'])
  const labels = JSON.parse(b.values.labels), spans = JSON.parse(b.values.spans)
  for (const [at, words] of Object.entries(labels)) assert.equal(words, clock(Number(at)), `the ruler's own label at ${at}`)
  assert.equal(labels['240'], '14:04:00')
  assert.deepEqual(spans, {600: '10m 00s', 180: '3m 00s'}, 'the window\'s span and the stalled needle\'s age, in the ruler\'s duration')
})

test('D-26: a press selects through the pane\'s selection, the loop\'s ends move through the owner\'s setLoop, the window, the snap, the marker, the lanes and the cut modes are the device\'s own holds, the pane\'s too', async () => {
  holds.resetHolds()
  picked.length = 0; looped.length = 0
  let b = ruler.rulerBinding(SET, selection, 'factory')
  await b.write([{key: 'sel', value: 'k3'}])
  assert.deepEqual(picked, [{kind: 'clip', ref: 'k3', title: 'make fixtures', track: 'bo'}])
  await b.write([{key: 'loopIn', value: 300}, {key: 'loopOut', value: 540}])
  assert.deepEqual(looped, [['start', 300], ['end', 540]])
  await assert.rejects(() => b.write([{key: 'loop', value: false}]), /missing op/)
  // REPLACED (Lead, 13 Nov: the ruler's window/snap/marker state moves into the device's view state, so pane and device share it): Move and
  // Trim were refused as the pane's ruler's own; they are the device's holds now, which the pane's ruler reads (ArrangementRuler.tsx useRulerView).
  assert.deepEqual([b.values.move, b.values.trim], ['insert', 'trim'], 'unheld, the pane\'s own starts: Insert and Trim')
  for (const key of ['start', 'span', 'marker', 'snap', 'move', 'trim', 'strip', 'laneTakes', 'laneAuto', 'laneEvents', 'show:bo', 'st:derived']) assert.equal(typeof b.local[key], 'function', key)
  assert.equal(b.writes('move'), false, 'a cut mode is never sent to an owner')
  b.local.trim('roll'); b.local.snap('free'); b.local.marker(300)
  b.local.start(240); b.local.span(120)
  b = ruler.rulerBinding(SET, selection, 'factory', holds.heldFor(ruler.RULER_ID))
  assert.deepEqual([b.values.start, b.values.span, b.values.trim, b.values.snap, b.values.marker], [240, 120, 'roll', 'free', 300])
  const labels = JSON.parse(b.values.labels)
  assert.ok(Object.keys(labels).some(at => Number(at) > 240 && Number(at) < 360), 'the zoomed window\'s marks carry their words')
  assert.equal(JSON.parse(b.values.spans)['120'], '2m 00s')
  const bare = ruler.rulerBinding({...SET, loop: undefined, actions: {}}, selection, 'factory')
  assert.match(bare.standing.loopIn.disabled, /carries no loop/)
  holds.resetHolds()
})

test('D-26: the pane\'s ruler and the device share one view state — what the device holds the ruler draws, and the ruler\'s presses hold it', async () => {
  holds.resetHolds()
  const {ArrangementRuler} = await import('../src/frame/tracks/ArrangementRuler.tsx')
  const draw = () => renderToStaticMarkup(createElement(ArrangementRuler, {set: SET, selection}))
  assert.match(draw(), /data-snap="grid" aria-label="Snap: grid"/, 'unheld, the pane starts with snap Grid')
  const b = ruler.rulerBinding(SET, selection, 'factory')
  b.local.snap('coarse'); b.local.start(240); b.local.span(120)
  const drawn = draw()
  assert.match(drawn, /data-snap="coarse" aria-label="Snap: coarse"/, 'the device\'s Snap is the ruler\'s')
  assert.doesNotMatch(drawn, /aria-label="Fit the whole ruler"[^>]*disabled=""/, 'the device\'s window is the ruler\'s: zoomed, Fit stands')
  const {useRulerView} = await import('../src/frame/tracks/ArrangementRuler.tsx')
  let view = null
  renderToStaticMarkup(createElement(() => { view = useRulerView(); return null }))
  assert.deepEqual([view.shown, view.snap, view.marker], [{start: 240, end: 360}, 'coarse', null])
  view.setMarker(300); view.setTrimMode('slip'); view.setShownLanes({takes: false, automation: true, events: true}); view.setShown(null)
  const after = ruler.rulerBinding(SET, selection, 'factory', holds.heldFor(ruler.RULER_ID)).values
  assert.deepEqual([after.marker, after.trim, after.laneTakes, after.laneEvents, after.start, after.span], [300, 'slip', false, true, 0, after.end],
    'the ruler\'s marker, trim mode and lanes are the device\'s; Fit drops the window back to the whole ruler')
  holds.resetHolds()
})

test('D-26: drawn through the host on the binding, every view is the design\'s own draw of the set — never the fixtures\' run', () => {
  holds.resetHolds()
  host.resetHost()
  const b = ruler.rulerBinding(SET, selection, 'factory')
  for (const view of ['folded', 'compact', 'whole', 'widget']) {
    const bound = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: b, view, nav: {}}))
    const own = renderToStaticMarkup(design[view]({v: {...b.values}, set() {}, nav: {}, page: 'ruler', setPage() {}, standing: b.standing}))
    assert.doesNotMatch(bound, /re-plan port|Fizz|Naassene|data-device-fault|\bNaN\b|undefined/, `${view}: no fixture material, no fault`)
    const clipsOf = markup => [...markup.matchAll(/data-i="([^"|]+)\|(?:[A-Z][a-z]+\. )*Press to select the clip/g)].map(m => m[1])
    assert.deepEqual(clipsOf(bound), clipsOf(own), `${view}: the bound draw lays the clips the design's own draw lays`)
    if (view === 'compact' || view === 'whole') {
      assert.deepEqual(clipsOf(bound), ['plan the east port', 'map the field', 'make fixtures'], view)
      assert.match(bound, /1 stalled/, `${view}: the corner counts the stalled needle`)
      assert.match(bound, /14:0\d:00/, `${view}: the marks carry the ruler's clock`)
    }
  }
  host.resetHost()
})

test('D-26: the pane publishes the design as the Arrangement ruler, with the shell\'s own ruler as its Full (scrubbing, the cuts and the loop brace stay)', () => {
  const pane = source('frame/tracks/ModeTracksView.tsx')
  assert.match(pane, /publishDevice\(RULER_ID, \{device: rulerDevice, binding: ruler, full: \{draw: \(\) => <ArrangementRuler set=\{shown\} selection=\{selection\} empty=\{waiting\} \/>\}\}\)/)
  assert.match(pane, /publishDevice\(RULER_ID, null\)/, 'withdrawn when the pane goes')
  assert.match(pane, /presented === 'arrangement' \? <ArrangementRuler set=\{shown\}/, 'the pane still draws the shell\'s ruler')
})
