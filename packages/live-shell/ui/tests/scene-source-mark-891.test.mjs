import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #747 round 891: the render law's mark on the grid, not only in the Clip panel (manual §10.3 Media: "When the source of a render has
// moved since it was made, the render's row … says so, and Remake … makes it again from the source as it now stands"). A scene made of a
// constellation is a render of it: where the wiki now reads that constellation at another revision than the scene's body was read at, the
// scene's clip says "source moved" on the Session grid and on the Arrangement, in both its lanes; while the wiki has not read it, or reads
// it where the body was read, nothing is said (frame/detail/remake.ts: nothing read is never guessed). The same words as the Clip panel's.
// FIXTURE: a kernel document of three scenes, the first made of a constellation at revision 3, through the Expressions model's own bridge
// and the scenes projection; the wiki's constellations as owners/constellations.ts reads them. SCRIPTED: static markup.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href
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
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const app = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const boundary = new URL('packages/expressions-boundary/src/', root)
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const [model, {kernelDocumentToJourney}, {projectNativeScenes}, {nativeTracks}, ruler, {SessionGridView}] = await Promise.all([
  import(new URL('model.ts', app)),
  import(new URL('kernelDocumentBridge.ts', app)),
  import(new URL('scenes.ts', boundary)),
  import('../src/frame/tracks/modeTracks.ts'),
  import('../src/frame/tracks/ArrangementRuler.tsx'),
  import('../src/inhabitants/catalogue/panels/dlw__session-grid.tsx'),
])
const E = 'expression:made'
const S = n => `${E}:scene:s${n}`
const WHOLE = 'wiki:node:central'
const basis = {expression_ref: E, revision: 4, scene_ref: S(1)}
const at = revision => ({ref: WHOLE, revision, availability: 'available'})
const BODY = {carrier: 'knowledge_whole', subject_ref: WHOLE, native_owner: 'wiki', reading: at('3'), provenance: [at('3')], actions: [], presentation: 'preview',
  capability: {state: 'degrades_to_thing', reason: 'Central: a constellation of the wiki.'}, span: null, recursion: null}
function seed() {
  const scenes = [10, 8, 6].map((duration, i) => {
    const scene = model.blankScene(i ? `Scene ${i + 1}` : 'Of Central'); scene.id = S(i + 1); scene.duration = duration; scene.transition = 1
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}, ...(i ? {} : {body: BODY})}
  })
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Made', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []})
}
const content = () => {
  const view = seed(), reading = projectNativeScenes(view.journey, view)
  return {basis, playback: {scene_ref: S(1), scene_playing: false, saved_sequence_playing: false}, scenes: reading}
}
/** The wiki's constellations, as owners/constellations.ts reads them: Central's whole at `revision`. */
const wiki = revision => [{ref: WHOLE, title: 'Central', kind: 'space', members: [], ...(revision ? {revision} : {})}]
const noop = () => {}
const grid = set => renderToStaticMarkup(React.createElement(SessionGridView, {set, selection: {select() {}}, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop}))
const arrangement = set => renderToStaticMarkup(React.createElement(ruler.ArrangementRuler, {set, selection: {select() {}}}))

test('r891: a scene whose constellation has moved since its body was read says "source moved" in both its lanes; the others say nothing', () => {
  const moved = nativeTracks(content(), 'Made', {constellations: wiki('4')})
  const marked = moved.clips.filter(clip => clip.source)
  assert.deepEqual(marked.map(clip => clip.id.slice(clip.id.lastIndexOf(':s') + 1)).sort(), ['s1:audio', 's1:visual'],
    'the scene made of the constellation, in its picture and its sound lanes')
  assert.equal(marked.length, 2)
  assert.ok(marked.every(clip => clip.source.mark === 'source moved' && clip.source.standing === 'moved' && clip.label === 'Of Central'))
  for (const [rows, why] of [[wiki('3'), 'the wiki reads it where the body was read'], [wiki(undefined), 'the wiki gives no revision'], [[], 'the wiki has not read it'],
    [undefined, 'no reading of the wiki']])
    assert.equal(nativeTracks(content(), 'Made', rows === undefined ? {} : {constellations: rows}).clips.some(clip => clip.source), false, why)
})

test('r891: the Session grid and the Arrangement draw the mark on the scene\'s clip, in the render law\'s words', () => {
  const moved = nativeTracks(content(), 'Made', {constellations: wiki('4')})
  const cells = grid(moved)
  const cell = cells.match(/<div role="gridcell" class="cs clip[^"]*" data-clip="[^"]*s1:visual"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? ''
  assert.match(cell, /data-source="moved"/, 'the cell carries where its source stands')
  assert.match(cell, /title="Of Central · [^"]*· source moved: its constellation has moved since the scene was made of it; Remake, in its Clip panel, makes it again"/)
  assert.match(cell, /<span class="cs-source"[^>]*>source moved<\/span>/, 'said on the clip')
  const sourced = [...cells.matchAll(/data-clip="([^"]*)"[^>]*data-source="moved"/g)].map(m => m[1].slice(m[1].lastIndexOf(':s') + 1))
  assert.ok(sourced.length >= 1 && sourced.every(id => id.startsWith('s1:')), `on the scene's own cells and no other's: ${sourced}`)
  assert.equal((cells.match(/class="cs-source"/g) ?? []).length, sourced.length, 'said once on each')
  const blocks = arrangement(moved)
  // Round 893, changed on purpose: the clip also draws its content marks after its words (ArrangementRuler.tsx contentMarks, aria-hidden).
  assert.match(blocks, /<button type="button"[^>]*data-clip="[^"]*s1:visual"[^>]*data-source="moved"[^>]*>Of Central · source moved(?:<i class="tl-cm[^"]*"[^>]*><\/i>)*<\/button>/)
  assert.doesNotMatch(grid(nativeTracks(content(), 'Made', {constellations: wiki('3')})), /cs-source|data-source/)
})

test('r891: the set\'s tracks draw again when the wiki\'s reading changes; with no constellation read, the Audition lit is still the frame\'s alone', async () => {
  const {MODE_REDRAWS} = await import('../src/frame/tracks/modeTracks.ts')
  const store = await import(new URL('desktop/cradle/src/techne/wikiProjectionStore.ts', root).href)
  const before = MODE_REDRAWS.expressions.snapshot()
  assert.ok(before === null || before === undefined, `no take auditioned and no constellation read: nothing lit (${JSON.stringify(before)})`)
  let drawn = 0
  const off = MODE_REDRAWS.expressions.subscribe(() => { drawn += 1 })
  try {
    store.setWikiProjectionRegisters([{key: 'central', title: 'Central'}])
    assert.ok(drawn > 0, 'the wiki\'s new reading draws the pane again, so a moved constellation is marked without another act')
  } finally { off() }
})
