import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Return tracks (manual §16.2, §19.23; HANDOFF-BUILD item 10): in Factory each workcell of the machine's register stands as a return
// track after the tracks and before Main, ⌥⌘R shows and hides them (the frame's returns-hidden), and every track an agent works on
// names its workcell in its In/Out section as Works in.
// - REAL: tests/fixtures/workcell-readings-2026-10-16.json `seatStatus` (the seat register as read on workcell:mac, 16 Oct).
// - SCRIPTED: the views rendered to static markup (react-dom/server), and the stateless view called directly so its
//   handlers can be read off the element tree and run. There is no DOM, so nothing here proves how it looks or that a click
//   lands: the screen legs (stripes, rails, the now line, the needle's readout) are for the lead's screen pass.
// - CODE-READING: tracks.css is read as text for the rules the markup depends on.
// Loader as f3-tracks.test.mjs.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const cssText = await readFile(new URL('../src/frame/tracks/tracks.css', import.meta.url), 'utf8')
const grid = await import('../src/frame/tracks/SessionGrid.tsx')
const {ArrangementRuler, ArrangementRulerView, placeClips} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const {SessionGridView, trackTree, stalledLanes, receiptOf, answerOf} = grid

const SELECT = {select() {}}
const clip = (id, trackId, columnId, label, extra = {}) => ({id, trackId, columnId, label, ...extra})
/** A crew: a group, a lead under it, a helper under the lead, and a lone session; helper stalled, one clip waiting. */
const crew = () => ({
  columns: [{id: 'r1', name: '1'}, {id: 'r2', name: '2'}],
  tracks: [
    {id: 'g', name: 'Crew', kind: 'group', color: '#111111', depth: 0},
    {id: 'lead', name: 'Lead', kind: 'session', color: '#222222', depth: 1, parentId: 'g'},
    {id: 'helper', name: 'Helper', kind: 'session', color: '#333333', depth: 2, parentId: 'lead'},
    {id: 'solo', name: 'Solo', kind: 'session', color: '#444444'},
  ],
  clips: [
    clip('lead#1', 'lead', 'r1', 'plan', {status: 'running'}),
    clip('helper#1', 'helper', 'r1', 'dig', {status: 'stalled'}),
    clip('helper#2', 'helper', 'r2', 'tidy', {status: 'waiting'}),
    clip('solo#1', 'solo', 'r1', 'alone', {status: 'stopped'}),
  ],
})
const noop = () => {}
const view = (set, over = {}) => SessionGridView({set, selection: SELECT, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop, ...over})
const html = (set, over = {}) => renderToStaticMarkup(React.createElement(SessionGridView, {set, selection: SELECT, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop, ...over}))
const {readFileSync} = await import('node:fs')
const returns = await import('../src/frame/tracks/returnTracks.ts')
const factory = await import('../src/frame/tracks/useFactoryTracks.ts')
const lanes = await import('../src/frame/tracks/trackLanes.ts')
const REAL = JSON.parse(readFileSync(new URL('./fixtures/workcell-readings-2026-10-16.json', import.meta.url), 'utf8'))

test('the register\'s workcells are return tracks, in its order, with no clips and none of the set\'s actions', () => {
  const tracks = returns.workcellReturns(REAL.seatStatus)
  assert.deepEqual(tracks.map(track => track.id), REAL.seatStatus.workcells.map(cell => `workcell:${cell.name}`))
  for (const track of tracks) { assert.equal(track.returns, true); assert.equal(track.readOnly, true); assert.equal(track.kind, 'workcell') }
  assert.deepEqual(returns.workcellReturns(null), [], 'an unread register makes none')
  assert.deepEqual(returns.workcellReturns({schema: 'other'}), [])
  assert.equal(returns.workcellOfTrack('workcell:env-2'), 'env-2')
  assert.equal(returns.workcellOfTrack('session:x'), null)
  assert.equal(returns.workcellOfTrack('workcell:'), null)
})

test('Works in: the one workcell holding the project\'s seat; unread, with the reason, when several hold it or none does', () => {
  const two = returns.worksInOf(REAL.seatStatus, 'O-I')
  assert.equal(two.workcell, null, 'env-1 and env-2 both hold o-i')
  assert.match(two.why, /2 workcells hold O-I's seat \(env-1 on dlw\/build, env-2 on dlw\/native-build\)/)
  const one = structuredClone(REAL.seatStatus)
  one.workcells[1].seats.find(seat => seat.product === 'o-i').state = 'free'
  assert.deepEqual(returns.worksInOf(one, 'O-I'), {workcell: 'env-1'})
  assert.match(returns.worksInOf(one, 'nothing-here').why, /No workcell holds nothing-here's seat/)
  assert.match(returns.worksInOf(null, 'O-I').why, /has not answered/)
})

test('the Session grid stands the return tracks after the empty track and before Main, with no clip slots', () => {
  const set = factory.withWorkcells({...crew(), mixer: {activator: {meaning: 'm'}}}, REAL.seatStatus)
  const markup = html(set)
  const fill = markup.indexOf('sg-fill'), main = markup.indexOf('trk-main'), env1 = markup.indexOf('data-track="workcell:env-1"')
  assert.ok(fill > 0 && env1 > fill && main > env1, 'tracks · empty track · returns · Main')
  assert.ok(markup.indexOf('data-track="solo"') < fill, 'the set\'s own tracks first')
  const column = markup.slice(markup.lastIndexOf('<div', env1), markup.indexOf('trk-main'))
  assert.match(column, /class="trk trk-return"/)
  assert.doesNotMatch(column, /sg2|sg-rec|class="tri"/, 'no stop squares, record buttons or launches on a return track')
  assert.match(cssText, /\.returns-hidden \.trk-return, \.returns-hidden \.tl-lane\[data-return="true"\] \{ display: none \}/, '⌥⌘R hides them')
})

test('the Arrangement lays the return tracks after the tracks and before the Main track\'s own material', () => {
  const order = lanes.mainLast([{id: 'day', main: true}, {id: 'workcell:env-1', returns: true}, {id: 'a'}, {id: 'b'}]).map(track => track.id)
  assert.deepEqual(order, ['a', 'b', 'workcell:env-1', 'day'])
  const set = factory.withWorkcells(crew(), REAL.seatStatus)
  const view = {window: null, onWindow: noop, snap: 'free', onSnap: noop, marker: null, onMarker: noop, width: 0}
  const markup = renderToStaticMarkup(React.createElement(ArrangementRulerView, {set, selection: SELECT, view, receipt: null, onPress: noop, onDismiss: noop}))
  assert.match(markup, /data-track="workcell:env-2"[^>]*data-return="true"/)
})

test('every session names its workcell in its In/Out section; choosing another stands disabled with the op it lacks', () => {
  const one = structuredClone(REAL.seatStatus)
  one.workcells[1].seats.find(seat => seat.product === 'o-i').state = 'free'
  const set = factory.withWorkcells({...crew(), mixer: {activator: {meaning: 'm'}, input: {meaning: 'in'}}}, one)
  const solo = set.tracks.find(track => track.id === 'solo')
  assert.equal(solo.mix.works, 'env-1')
  const cells = lanes.mixerCells(set, solo, 0)
  const works = cells.find(cell => cell.id === 'works')
  assert.deepEqual([works.label, works.text, works.state], ['Works in', 'env-1', 'route'])
  assert.match(works.title, /missing op: a track's workcell held with its session's settings/)
  assert.equal(works.press, undefined)
  assert.match(html(set), /<small>works in<\/small>env-1/)
  // Two workcells hold o-i: unread, and the reason on the control.
  const both = factory.withWorkcells({...crew(), mixer: {activator: {meaning: 'm'}}}, REAL.seatStatus)
  const unread = lanes.mixerCells(both, both.tracks.find(track => track.id === 'solo'), 0).find(cell => cell.id === 'works')
  assert.equal(unread.state, 'unread')
  assert.match(unread.title, /2 workcells hold O-I's seat/)
  for (const track of both.tracks.filter(track => track.returns)) assert.deepEqual(lanes.mixerCells(both, track, 0), [], 'a return track has no mixer row of a session')
})

test('Central\'s worlds: a project\'s world works where its project\'s seat is held; your own world names no workcell', () => {
  const one = structuredClone(REAL.seatStatus)
  one.workcells[1].seats.find(seat => seat.product === 'o-i').state = 'free'
  const set = {columns: [], clips: [], mixer: {arm: {meaning: 'a'}}, tracks: [
    {id: 'central:world:project:O-I', name: 'O-I', kind: 'world'}, {id: 'central:world:you', name: 'You', kind: 'world'}, {id: 'day', name: 'Day', kind: 'day', main: true}]}
  const project = new Map([['central:world:project:O-I', 'O-I'], ['central:world:you', null]])
  const shown = returns.withWorksIn(set, one, track => project.get(track.id) ?? null)
  assert.equal(shown.tracks[0].mix.works, 'env-1')
  assert.equal(shown.tracks[1].mix, undefined, 'your world holds no seat')
  assert.equal(shown.tracks[2].mix, undefined, 'the Day is the Main track')
  assert.match(shown.mixer.works.disabled, /^Choosing another workcell: no owner operation carries it yet/)
  assert.equal(returns.withWorksIn({...set, mixer: undefined}, one, () => 'O-I').mixer, undefined, 'a set with no mixer row gets none')
})
