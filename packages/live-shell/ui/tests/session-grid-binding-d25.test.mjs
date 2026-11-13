// Parity D-25: the Session grid stands as its catalogue design (dlw__session-grid.tsx) on a binding over the tracks the Session ·
// Arrangement pane reads (frame/tracks/sessionGridBinding.ts), published by the pane (ModeTracksView.tsx) with the shell's own grid as its Full.
// - FIXTURE, owner-shaped: a Factory-shaped WorldTrackSet (a crew under a group, a stalled member, a running clip with its progress and takes,
//   the mixer's arm and solo) and the pane's selection.
// - SCRIPTED: the design drawn through the runtime's host (deviceHost.HostedDevice) on the binding, and the design's own draw on the same
//   values; writes go to stand-in mixer ops and a stand-in selection.
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
const grid = await import('../src/frame/tracks/sessionGridBinding.ts')
const {design} = await import('../src/inhabitants/catalogue/panels/dlw__session-grid.tsx')
const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

const ran = []
const SET = {
  columns: [{id: 'b1', name: 'Batch 1'}, {id: 'b2', name: 'Batch 2'}, {id: 'b3', name: 'Batch 3'}],
  tracks: [
    {id: 'crew', name: 'Crew east', kind: 'agent', color: '#5cc6b4', mix: {arm: false, solo: false}},
    {id: 'ana', name: 'Ana · lead', kind: 'agent', color: '#8fbfb6', parentId: 'crew', mix: {arm: true, solo: false}},
    {id: 'bo', name: 'Bo', kind: 'agent', color: '#a8c9c2', parentId: 'crew', mix: {arm: false, solo: true}},
    {id: 'cy', name: 'Cy review', kind: 'agent', color: '#d985a6', mix: {arm: false, solo: false}},
    {id: 'main', name: 'Main', kind: 'agent', main: true},
  ],
  clips: [
    {id: 'k1', trackId: 'ana', columnId: 'b1', label: 'plan the east port', status: 'done'},
    {id: 'k2', trackId: 'ana', columnId: 'b2', label: 'map the field', status: 'running', progress: {elapsed: 30, expected: 60}, takes: [{id: 't1', name: 'one'}, {id: 't2', name: 'two'}],
      launch: {quantize: 'next tool', follow: 'next', mode: 'loop'}},
    {id: 'k3', trackId: 'bo', columnId: 'b2', label: 'make fixtures', status: 'stalled'},
    {id: 'k4', trackId: 'cy', columnId: 'b3', label: 'review the port', status: 'waiting'},
    {id: 'k5', trackId: 'main', columnId: 'b1', label: 'the main row'},
    {id: 'k6', trackId: 'cy', columnId: 'b1', label: 'read the brief'},
  ],
  actions: {mixer: {arm: {op: 'arm', run: (id, on) => { ran.push(['arm', id, on]) }}, solo: {op: 'solo', run: (id, on) => { ran.push(['solo', id, on]) }}}},
}
const picked = []
const selection = {ref: 'k2', select: target => { picked.push(target) }}

test('D-25: the binding reads the set the pane shows — its tracks, clips, rows, selection, arm, solo and the selected clip\'s launch', () => {
  holds.resetHolds()
  const b = grid.sessionGridBinding(SET, selection, 'factory')
  const tracks = JSON.parse(b.values.tracks)
  assert.deepEqual(tracks.map(t => [t.id, t.parent ?? null, t.group ?? false]), [['crew', null, true], ['ana', 'crew', false], ['bo', 'crew', false], ['cy', null, false]],
    'the set\'s tracks in its order, a group the track others sit under; the Main track\'s material stands in the shell\'s Main column, not here')
  assert.deepEqual(JSON.parse(b.values.clips).map(c => [c.track, c.row, c.status, c.p ?? null, c.takes ?? null]),
    [['ana', 1, 'done', null, null], ['ana', 2, 'running', 50, 2], ['bo', 2, 'stalled', null, null], ['cy', 3, 'waiting', null, null], ['cy', 1, undefined, null, null]],
    'a clip whose owner discloses no state carries none')
  assert.deepEqual([b.values.rows, b.values.sel, b.values.armed, b.values['solo:bo'], b.values.quantize, b.values['follow:ana:2'], b.values['launch:ana:2'], b.values.mode],
    [3, 'ana:2', 'ana', true, 'tool', 'next', 'loop', 'factory'])
  assert.equal(b.values.light, 'lit')
})

test('D-25: a press selects through the pane\'s selection, Arm and Solo through the mixer, the view holds Fold, Show and Takes, the launch settings refuse with their missing op', async () => {
  holds.resetHolds()
  ran.length = 0; picked.length = 0
  let b = grid.sessionGridBinding(SET, selection, 'factory')
  await b.write([{key: 'sel', value: 'cy:3'}])
  assert.deepEqual(picked, [{kind: 'clip', ref: 'k4', title: 'review the port', track: 'cy'}])
  await b.write([{key: 'armed', value: 'cy'}, {key: 'solo:ana', value: true}])
  await b.write([{key: 'armed', value: 'none'}])
  assert.deepEqual(ran, [['arm', 'cy', true], ['solo', 'ana', true], ['arm', 'ana', false]])
  for (const key of ['quantize', 'follow:ana:2', 'launch:ana:2']) {
    assert.match(b.standing[key].disabled, /missing op/, key)
    await assert.rejects(() => b.write([{key, value: 'next'}]), /missing op/)
  }
  assert.match(b.standing.rowKeys.disabled, /number keys launch/)
  for (const key of ['fold:crew', 'show:cy', 'takes']) assert.equal(typeof b.local[key], 'function', key)
  b.local['fold:crew'](true)
  b = grid.sessionGridBinding(SET, selection, 'factory', holds.heldFor(grid.SESSION_GRID_ID))
  assert.equal(b.values['fold:crew'], true)
  // A set whose owner takes no arm says so on the chooser.
  const bare = grid.sessionGridBinding({...SET, actions: {waiting: {arm: 'Arm waits for the harness.'}}}, selection, 'factory')
  assert.equal(bare.standing.armed.disabled, 'Arm waits for the harness.')
  holds.resetHolds()
})

/** What a draw of the grid shows: each track head's name and each clip's label, in order, and the Main column. */
const gridWords = markup => [...markup.matchAll(/data-i="([^"|]+)\|(?:Press to (?:fold|arm)|[A-Z][a-z ]+\. Press to select the clip)/g)].map(m => m[1])

test('D-25: drawn through the host on the binding, every view is the design\'s own draw of the set — never the mockup\'s grid', () => {
  holds.resetHolds()
  host.resetHost()
  const b = grid.sessionGridBinding(SET, selection, 'factory')
  for (const view of ['compact', 'whole', 'widget', 'folded']) {
    const bound = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: b, view, nav: {}}))
    const own = renderToStaticMarkup(design[view]({v: {...b.values}, set() {}, nav: {}, page: '', setPage() {}, standing: b.standing}))
    assert.doesNotMatch(bound, /re-plan port|Fizz · lead|Port bridge-2|data-device-fault|\bNaN\b|undefined/, `${view}: no mockup material, no fault`)
    assert.deepEqual(gridWords(bound), gridWords(own), `${view}: the bound draw is the design's own draw of the same set`)
    if (view === 'compact' || view === 'whole') {
      for (const word of ['Crew east', 'Ana · lead', 'Bo', 'Cy review', 'plan the east port', 'map the field', 'make fixtures', 'review the port', 'read the brief'])
        assert.ok(gridWords(bound).includes(word), `${view}: ${word} drawn in the grid`)
      assert.match(bound, /launch tool/, `${view}: the corner says the selected clip's quantize`)
    }
  }
  const whole = renderToStaticMarkup(createElement(host.HostedDevice, {designed: design, binding: b, view: 'whole', nav: {}}))
  for (const label of ['Crew east', 'Ana · lead', 'Bo', 'Cy review']) assert.ok(whole.includes(label), label)
  assert.doesNotMatch(whole, />Main<\/span>[\s\S]*?Main track material/, 'the Main track\'s material is not drawn as a track')
  host.resetHost()
})

test('D-25: the pane publishes the design as the Session grid, with the shell\'s own grid as its Full (launch, stop, record and the mixer stay)', () => {
  const pane = source('frame/tracks/ModeTracksView.tsx')
  assert.match(pane, /publishDevice\(SESSION_GRID_ID, \{device: sessionGridDevice, binding: gridBinding, full: \{draw: \(\) => <SessionGrid set=\{shown\} selection=\{selection\} empty=\{waiting\} \/>\}\}\)/)
  assert.match(pane, /publishDevice\(SESSION_GRID_ID, null\)/, 'withdrawn when the pane goes')
  assert.match(pane, /<SessionGrid set=\{shown\} selection=\{selection\} empty=\{waiting\} \/>\}/, 'the pane still draws the shell\'s grid')
  const panel = source('inhabitants/catalogue/panels/dlw__session-grid.tsx')
  const views = panel.slice(panel.indexOf('function Grid'), panel.indexOf('  defaults: {')) + panel.slice(panel.indexOf('  fixtures: {'))
  assert.doesNotMatch(views, /\bMOCK_(TRACKS|CLIPS|ROWS)\b|'fixture:2'/, 'the views draw from their keys; the mockup is the defaults alone')
})
