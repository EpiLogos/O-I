import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #747 round 892, item 5: every scene made of a file carries the render law's mark (manual §10.3 Media: "When the source of a render has
// moved since it was made, the render's row … says so"), not only the presented scene in its Clip panel (round 891). The scenes reading
// (expressions-boundary scenes.ts) names each scene's file, its carrier, the revision its body was read at and the revision Central's file
// owner reads it at now (createSceneSourcesNow, asked by the frame through its own host reads): where the two differ the scene's clip says
// "source moved" on the Session grid and on the Arrangement, in its file's words; while nothing has read the file, or it stands where the
// body was read, nothing is said. FIXTURE: a kernel document of three scenes — the first made of a text file read at r7, the second of an
// image read at i2, the third of nothing — through the Expressions model's own bridge and the scenes projection. SCRIPTED: static markup.
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
const [model, {kernelDocumentToJourney}, {projectNativeScenes, sceneSourceKey}, {nativeTracks}, ruler, {SessionGridView}] = await Promise.all([
  import(new URL('model.ts', app)),
  import(new URL('kernelDocumentBridge.ts', app)),
  import(new URL('scenes.ts', boundary)),
  import('../src/frame/tracks/modeTracks.ts'),
  import('../src/frame/tracks/ArrangementRuler.tsx'),
  import('../src/inhabitants/catalogue/panels/dlw__session-grid.tsx'),
])
const E = 'expression:made-of-files'
const S = n => `${E}:scene:s${n}`
const TEXT = 'central:notes/a.md', IMAGE = 'central:pictures/b.png'
const at = (ref, revision) => ({ref, revision, availability: 'available'})
const file = (carrier, ref, revision) => ({carrier, subject_ref: ref, native_owner: 'central', reading: at(ref, revision), provenance: [at(ref, revision)], actions: [],
  presentation: 'inline', capability: {state: 'renderable'}, span: null, recursion: null})
function seed() {
  const bodies = [file('text_source', TEXT, 'r7'), file('image_media', IMAGE, 'i2'), null]
  const scenes = ['Notes', 'Picture', 'Plain'].map((name, i) => {
    const scene = model.blankScene(name); scene.id = S(i + 1); scene.duration = 6; scene.transition = 1
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}, ...(bodies[i] ? {body: bodies[i]} : {})}
  })
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Made of files', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []})
}
const basis = {expression_ref: E, revision: 4, scene_ref: S(1)}
const content = now => {
  const view = seed(), reading = projectNativeScenes(view.journey, view, now && new Map(Object.entries(now).map(([key, revision]) => [sceneSourceKey(...key.split(' ')), revision])))
  return {basis, playback: {scene_ref: S(1), scene_playing: false, saved_sequence_playing: false}, scenes: reading}
}
const noop = () => {}
const grid = set => renderToStaticMarkup(React.createElement(SessionGridView, {set, selection: {select() {}}, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop}))
const arrangement = set => renderToStaticMarkup(React.createElement(ruler.ArrangementRuler, {set, selection: {select() {}}}))
const marked = set => set.clips.filter(clip => clip.source).map(clip => clip.id.slice(clip.id.lastIndexOf(':s') + 1)).sort()

test('r892: a scene whose file stands at another revision than its body was read at says "source moved" in both its lanes; the others say nothing', () => {
  const moved = nativeTracks(content({[`text_source ${TEXT}`]: 'r8', [`image_media ${IMAGE}`]: 'i2'}), 'Made of files', {})
  assert.deepEqual(marked(moved), ['s1:audio', 's1:visual'], 'the scene made of the file that moved, in its picture and its sound lanes')
  const clip = moved.clips.find(row => row.source)
  assert.deepEqual([clip.source.mark, clip.source.standing], ['source moved', 'moved'])
  assert.equal(clip.source.said, 'its file has changed since the scene was made of it; Remake, in its Clip panel, makes it again')
  assert.deepEqual(marked(nativeTracks(content({[`text_source ${TEXT}`]: 'r8', [`image_media ${IMAGE}`]: 'i3'}), 'Made of files', {})),
    ['s1:audio', 's1:visual', 's2:audio', 's2:visual'], 'an image is a file as a text is: every scene made of a file that moved')
  for (const [now, why] of [[{[`text_source ${TEXT}`]: 'r7', [`image_media ${IMAGE}`]: 'i2'}, 'each file stands where its body was read'],
    [{}, 'nothing has read the files'], [undefined, 'no revisions now at all']])
    assert.deepEqual(marked(nativeTracks(content(now), 'Made of files', {})), [], why)
})

test('r892: the Session grid and the Arrangement draw the mark on the scene made of a file, in the render law\'s words', () => {
  const moved = nativeTracks(content({[`text_source ${TEXT}`]: 'r8'}), 'Made of files', {})
  const cells = grid(moved)
  const cell = cells.match(/<div role="gridcell" class="cs clip[^"]*" data-clip="[^"]*s1:visual"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? ''
  assert.match(cell, /data-source="moved"/)
  assert.match(cell, /title="Notes · [^"]*· source moved: its file has changed since the scene was made of it; Remake, in its Clip panel, makes it again"/)
  assert.match(cell, /<span class="cs-source"[^>]*>source moved<\/span>/)
  // Round 893, changed on purpose: the clip also draws its content marks after its words (ArrangementRuler.tsx contentMarks, aria-hidden).
  assert.match(arrangement(moved), /<button type="button"[^>]*data-clip="[^"]*s1:visual"[^>]*data-source="moved"[^>]*>Notes · source moved(?:<i class="tl-cm[^"]*"[^>]*><\/i>)*<\/button>/)
})
