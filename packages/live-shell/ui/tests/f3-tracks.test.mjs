import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// FOUNDATION F3: one Session grid and one Arrangement ruler over one material contract. Live's set is the reference
// adapter; every mode's tracks come from its registration; the views know no mode. Loader as live-browser-chain.test.mjs.
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
const {liveSetTrackAdapter} = await import('../src/timeline/liveSetTrackAdapter.ts')
const {setSelectionOf} = await import('../src/shell/liveSelection.ts')
const {SessionGrid} = await import('../src/frame/tracks/SessionGrid.tsx')
const {ArrangementRuler, placeClips} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const {MODE_TRACKS, mergeSets, nativeTracks} = await import('../src/frame/tracks/modeTracks.ts')
const {SURF_MODES} = await import('../src/shell/modeGrammar.ts')

const set = {path: '/sets/demo.als', tempo_bpm: 120, scene_count: 3, arrangement_clips: 1, tracks: [
  {kind: 'midi', name: 'Pad', devices: []}, {kind: 'audio', name: 'Drums', devices: []}]}
const document = {path: '/sets/demo.als', tempo: 120, scenes: 3, tracks: [
  {kind: 'midi', name: 'Pad', devices: [], arrangementClips: [{name: 'Intro', kind: 'midi', start: 0, end: 16}], sessionSlots: {'0': 'A', '1': null, '2': 'C'}},
  {kind: 'audio', name: 'Drums', devices: [], arrangementClips: [], sessionSlots: {'1': 'Beat', '7': 'out of range'}}]}

test('Live\'s set projects as tracks, scenes as rows, slots as clips, arrangement clips on a bars ruler', () => {
  const tracks = liveSetTrackAdapter.project({set, document, colors: ['#79b6ce', '#9885bc']})
  assert.deepEqual(tracks.tracks.map(t => [t.name, t.kind, t.color]), [['Pad', 'midi', '#79b6ce'], ['Drums', 'audio', '#9885bc']])
  assert.deepEqual(tracks.columns.map(c => c.id), ['scene:0', 'scene:1', 'scene:2'])
  assert.deepEqual(tracks.clips.filter(c => c.columnId).map(c => [c.label, c.columnId]), [['A', 'scene:0'], ['C', 'scene:2'], ['Beat', 'scene:1']], 'empty and out-of-range slots make no clip')
  const intro = tracks.clips.find(c => c.label === 'Intro')
  assert.deepEqual(intro.at, {start: 0, end: 16}); assert.equal(intro.columnId, '', 'an arrangement clip stands in no row')
  assert.equal(tracks.ruler.label(16), '5.1', 'bar.beat, as Live counts')
  assert.equal(tracks.actions, undefined, 'the set owner gives no launch: the grid stays read-only')
  assert.deepEqual(liveSetTrackAdapter.project({set: null, document: null}), {columns: [], tracks: [], clips: []})
})

test('a clip on the shared grid is THE selection, in the ref Live already speaks', () => {
  const tracks = liveSetTrackAdapter.project({set, document})
  const slot = tracks.clips.find(c => c.label === 'C')
  assert.deepEqual(setSelectionOf({mode: 'live', kind: 'clip', ref: slot.id, title: 'C'}, set.path), {track: 0, scene: 2})
  const arranged = tracks.clips.find(c => c.label === 'Intro')
  assert.deepEqual(setSelectionOf({mode: 'live', kind: 'clip', ref: arranged.id, title: 'Intro'}, set.path), {track: 0, scene: null, clip: 0})
})

test('the Session grid draws every track, every row, each clip\'s state, and no launch without the owner\'s op', () => {
  const tracks = liveSetTrackAdapter.project({set, document})
  tracks.clips[0].status = 'stalled'
  const markup = renderToStaticMarkup(React.createElement(SessionGrid, {set: tracks, selection: {ref: tracks.clips[0].id, select() {}}}))
  assert.equal((markup.match(/data-track="/g) ?? []).length, 2)
  assert.match(markup, /data-clip-status="stalled"/); assert.match(markup, /class="cs clip stalled sel"/)
  assert.match(markup, /aria-label="Launch A" disabled=""/, 'launch is disabled without a launch op')
  assert.equal((markup.match(/class="stop-launch" disabled=""/g) ?? []).length, 3, 'a row launcher per stop, disabled without the op')
  const launched = []
  const live = {...tracks, actions: {launch: {op: 'test:launch', run: id => launched.push(id)}}}
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(SessionGrid, {set: live, selection: {select() {}}})), /aria-label="Launch A" disabled=""/)
})

test('the Arrangement lays clips on one ruler: by their own place, else their row end to end; needles stand on their track', () => {
  const tracks = liveSetTrackAdapter.project({set, document})
  const {placed, end} = placeClips(tracks)
  assert.deepEqual(placed.find(p => p.clip.label === 'Intro'), {clip: tracks.clips.find(c => c.label === 'Intro'), start: 0, end: 16})
  assert.equal(end, 16)
  const rows = {columns: [{id: 'a', name: 'a'}, {id: 'b', name: 'b'}], tracks: [{id: 't', name: 'T', kind: 'k', needle: 3}],
    clips: [{id: 'x', trackId: 't', columnId: 'a', label: 'x', span: {start: 0, end: 2}}, {id: 'y', trackId: 't', columnId: 'b', label: 'y', span: {start: 0, end: 1}}]}
  assert.deepEqual(placeClips(rows).placed.map(p => [p.clip.id, p.start, p.end]), [['x', 0, 2], ['y', 2, 3]])
  const markup = renderToStaticMarkup(React.createElement(ArrangementRuler, {set: rows, selection: {select() {}}}))
  assert.match(markup, /class="tl-needle"/)
})

test('every mode has its tracks by registration, and the views know no mode', async () => {
  assert.deepEqual(Object.keys(MODE_TRACKS).sort(), [...SURF_MODES].sort())
  assert.equal(MODE_TRACKS.live({set, document}).tracks.length, 2)
  const world = {source: {sets: [{columns: [{id: 'd', name: 'd'}], tracks: [{id: 'day', name: 'Day', kind: 'day'}], clips: []}, {columns: [{id: 'd', name: 'd'}], tracks: [{id: 'run', name: 'Run', kind: 'run'}], clips: []}]}}
  // Central's and Factory's tracks read their owners: hooks, rendered as the pane renders them.
  const out = {}
  const Probe = ({mode, reading}) => { out[mode] = MODE_TRACKS[mode](reading); return null }
  renderToStaticMarkup(React.createElement(Probe, {mode: 'base', reading: {set: null, document: null}}))
  assert.deepEqual(out.base.tracks.map(t => t.id), ['day', 'flows', 'beings', 'things', 'goals'].map(s => `central:stream:${s}`), 'Central: its five streams, even unread')
  renderToStaticMarkup(React.createElement(Probe, {mode: 'factory', reading: {set: null, document: null}}))
  assert.match(out.factory.waiting, /agent sessions/, 'Factory: waiting on the agency, said')
  renderToStaticMarkup(React.createElement(Probe, {mode: 'techne', reading: {set: null, document: null}}))
  assert.equal(out.techne.tracks.length, 6, 'Technē: its six native streams, named even unread')
  assert.deepEqual(mergeSets(world.source.sets).columns.map(c => c.id), ['d'])
  assert.equal(nativeTracks(null), null)
  const native = nativeTracks({basis: {expression_ref: 'expression:w'}, scenes: {scenes: [{scene_ref: 's1', title: 'Opening', native_title: 'n', working: {duration: 4, transition: 0}, snapshot: {duration: null}}]}}, 'Work')
  assert.equal(native.tracks.filter(t => t.groupId).length, 2, 'the work is one track with its sight and sound lanes')
  assert.equal(native.clips[0].label, 'Opening')
  const {readFile} = await import('node:fs/promises')
  for (const view of ['SessionGrid.tsx', 'ArrangementRuler.tsx', 'TracksPane.tsx']) {
    assert.doesNotMatch(await readFile(new URL(`../src/frame/tracks/${view}`, import.meta.url), 'utf8'), /'(live|base|factory|expressions|techne)'/, `${view} names no mode`)
  }
})
