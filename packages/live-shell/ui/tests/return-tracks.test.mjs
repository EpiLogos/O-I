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
const grid = {...await import('../src/frame/tracks/SessionGrid.tsx'), ...await import('../src/inhabitants/catalogue/panels/dlw__session-grid.tsx')}
const {ArrangementRuler, ArrangementRulerView, placeClips} = {...await import('../src/frame/tracks/ArrangementRuler.tsx'), ...await import('../src/inhabitants/catalogue/panels/dlw__arrangement-ruler.tsx')}
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
  // Each session works in its own project's workcell (§19.1 "The project's workcell by default"): the project its agency read listed it in.
  // REPLACED (O-I #740 lane B): every session worked in the shell's one literal project; these sessions are O-I's.
  const ofOI = () => 'O-I'
  const set = factory.withWorkcells({...crew(), mixer: {activator: {meaning: 'm'}, input: {meaning: 'in'}}}, one, null, ofOI)
  const solo = set.tracks.find(track => track.id === 'solo')
  assert.equal(solo.mix.works, 'env-1')
  const cells = lanes.mixerCells(set, solo, 0)
  const works = cells.find(cell => cell.id === 'works')
  assert.deepEqual([works.label, works.text, works.state], ['Works in', 'env-1', 'route'])
  assert.match(works.title, /missing op: a track's workcell held with its session's settings/)
  assert.equal(works.press, undefined)
  assert.match(html(set), /<small>works in<\/small>env-1/)
  // Two workcells hold o-i: unread, and the reason on the control.
  const both = factory.withWorkcells({...crew(), mixer: {activator: {meaning: 'm'}}}, REAL.seatStatus, null, ofOI)
  const unread = lanes.mixerCells(both, both.tracks.find(track => track.id === 'solo'), 0).find(cell => cell.id === 'works')
  assert.equal(unread.state, 'unread')
  assert.match(unread.title, /2 workcells hold O-I's seat/)
  for (const track of both.tracks.filter(track => track.returns)) assert.deepEqual(lanes.mixerCells(both, track, 0), [], 'a return track has no mixer row of a session')
})

test('a session of your world\'s root register names no workcell; a project\'s session its project\'s (O-I #740)', () => {
  const one = structuredClone(REAL.seatStatus)
  one.workcells[1].seats.find(seat => seat.product === 'o-i').state = 'free'
  const projectOf = factory.trackProjects([{sessionRef: 'a', spaceRef: 's', group: false, project: 'O-I'}, {sessionRef: 'b', spaceRef: 's', group: false, project: ''}])
  assert.deepEqual([projectOf({id: 's:a'}), projectOf({id: 's:b'}), projectOf({id: 'unseated'})], ['O-I', null, null], 'a track\'s project is its session\'s register; the root names none')
  const set = factory.withWorkcells({...crew(), mixer: {activator: {meaning: 'm'}}}, one, null, track => projectOf({id: track.id === 'solo' ? 's:a' : track.id === 'lead' ? 's:b' : track.id}))
  assert.equal(set.tracks.find(track => track.id === 'solo').mix?.works, 'env-1', 'O-I\'s session works where O-I\'s seat is held')
  assert.equal(set.tracks.find(track => track.id === 'lead').mix?.works, undefined, 'the root register keeps no seat: no workcell is named')
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

// LV06 (walk of O-I 857, r46; DLW build ruling 2026-11-08, item 10): the set's owner read each part's sends and the Live adapter
// projected them with their write (live-set-ops.test.mjs), but no mixer row drew them, so nothing could be sent to a return. A part's
// sends now stand on its row as Live draws them, above Volume and Pan: one value box each, named by its send and the return it feeds,
// each writing its own send; a send Live has off on this part stands disabled with why. ⌥⌘S hides them (the frame's sends-hidden).
test('a part\'s sends stand on its mixer row above its levels, one box each that writes its own send; ⌥⌘S hides them (LV06)', () => {
  const wrote = []
  const set = {columns: [{id: 'r1', name: '1'}], clips: [],
    tracks: [{id: 'keys', name: 'Keys', kind: 'midi', color: '#225588', mix: {volume: 0, pan: 0, sends: [
      {id: 'Send A', name: 'A-Reverb', value: -70, min: -70, max: 0, unit: 'dB'},
      {id: 'Send B', name: 'B-Delay', value: -6, min: -70, max: 0, unit: 'dB', disabled: 'Send B is off on this part: Live turns a return\'s own sends on from the send\'s menu.'}]}},
      {id: 'pad', name: 'Pad', kind: 'midi', color: '#558822', mix: {volume: 0, pan: 0}}],
    mixer: {volume: {meaning: 'How loud the part plays'}, pan: {meaning: 'Where the part sits'}},
    actions: {mixer: {volume: {op: 'volume-op', run: noop}, send: {op: 'send-op', run: (track, send, db) => { wrote.push([track, send, db]); return {ok: true} }}}}}
  const cells = lanes.mixerCells(set, set.tracks[0], 0)
  assert.deepEqual(cells.map(cell => [cell.id, cell.key ?? cell.id, cell.label, cell.text]),
    [['send', 'send:Send A', 'Send A', '-inf dB'], ['send', 'send:Send B', 'Send B', '-6.0 dB'], ['volume', 'volume', 'Volume', '0.0 dB'], ['pan', 'pan', 'Pan', 'C']],
    'the sends first, in the set\'s order, then Volume and Pan')
  const [a, b] = cells
  assert.deepEqual([a.level.value, a.level.min, a.level.max, a.level.unit], [-70, -70, 0, 'dB'])
  assert.match(a.title, /^Send A · How much of Keys goes to A-Reverb, its return · -inf dB \(send-op\)$/)
  assert.equal(a.level.set.what(-12), 'Send A -12.0 dB to A-Reverb on Keys')
  a.level.set.run(-12)
  assert.deepEqual(wrote, [['keys', 'Send A', -12]], 'the box writes its own send, by the track and the send')
  assert.equal(b.level.set, undefined, 'a send that is off on this part is not moved')
  assert.match(b.title, /· Send B is off on this part: Live turns a return's own sends on from the send's menu\.$/)
  assert.deepEqual(lanes.mixerCells(set, set.tracks[1], 1).map(cell => cell.id), ['volume', 'pan'], 'a part with no sends draws none')
  const readOnly = lanes.mixerCells({...set, actions: {mixer: {volume: set.actions.mixer.volume}}}, set.tracks[0], 0)
  assert.equal(readOnly[0].level.set, undefined)
  assert.match(readOnly[0].title, / · no owner writes the send$/)
  const markup = html(set)
  assert.match(markup, /<span class="mx-level mx-send" data-mix="send" data-send="Send A" data-state="on"[^>]*title="Send A · How much of Keys goes to A-Reverb/)
  assert.match(markup, /data-send="Send B"/)
  assert.match(cssText, /\.sends-hidden \.mx-send \{ display: none \}/)
})

/** Every element of a rendered tree whose props pass `match`. */
const findAll = (node, match, out = []) => {
  if (Array.isArray(node)) { for (const child of node) findAll(child, match, out); return out }
  if (!node || typeof node !== 'object' || !node.props) return out
  if (match(node.props)) out.push(node)
  findAll(node.props.children, match, out)
  return out
}

test('an empty Session takes its first seat: the drop area is the seat drop, and a drop runs the seat (manual §10.3)', () => {
  const seated = []
  const seat = {op: 'harness_agent_control new', accepts: 'application/x-oi-agent', run: payload => { seated.push(payload); return Promise.resolve({ok: true}) }}
  const pressed = []
  const tree = view({columns: [], tracks: [], clips: [], actions: {seat}}, {onPress: (key, label, run) => { pressed.push(key); run() }})
  const [drop] = findAll(tree, props => props.className === 'sg-drop')
  assert.ok(drop, 'the empty Session draws its drop area')
  assert.equal(drop.props['data-seat-drop'], 'open', 'the drop area is where the first seat lands')
  const event = {dataTransfer: {types: ['application/x-oi-agent'], getData: () => 'agent:one', dropEffect: ''}, preventDefault() { this.prevented = true }}
  drop.props.onDragOver(event)
  assert.equal(event.prevented, true)
  drop.props.onDrop(event)
  assert.deepEqual(pressed, ['seat'])
  assert.deepEqual(seated, ['agent:one'])
  assert.match(html({columns: [], tracks: [], clips: [], actions: {seat}}), /Drop here to start the first/)
})

test('a double-click on an empty slot starts a clip there, as its menu\'s Insert clip does (manual §16.6)', () => {
  const inserted = []
  const insertClip = {op: 'live_clip_create', run: (track, row) => { inserted.push([track, row]); return Promise.resolve({ok: true}) }}
  const set = {...crew(), actions: {insertClip}}
  const tree = view(set, {onPress: (key, label, run) => run()})
  const slot = findAll(tree, props => props['data-slot-track'] === 'solo' && props['data-slot-row'] === 'r2')[0]
  assert.ok(slot && typeof slot.props.onDoubleClick === 'function', 'the empty slot answers a double-click')
  const event = {}
  event.target = event.currentTarget = {}
  slot.props.onDoubleClick(event)
  assert.deepEqual(inserted, [['solo', 'r2']])
})
