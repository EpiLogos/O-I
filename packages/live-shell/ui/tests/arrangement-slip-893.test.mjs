// O-I #747 round 893 (the OPEN list, walk 892): a Slip changed nothing the Arrangement draws. Slip changes where a clip starts inside its
// own content (manual §16.6; the scene's entryOffset, "Start is set by Slip on Arrangement view's ruler"), and the clip drew its name only,
// so a slipped scene looked as it did before. Now the owner's scenes inventory reads where each scene starts in its own evolution, the
// track carries it as the clip's content, and the Arrangement draws the content's seconds under the clip from there, as Live's clip draws
// its content moved by a slip, and says the start in words where it is not the content's own.
// Channels: SCRIPTED — the frame's conversion of a native document and the boundary's projection of its scenes, the shell's track of them
// (modeTracks.ts nativeTracks), and the stateless ruler view called directly. No DOM: how it looks is the screen pass's.
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
const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis
globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop

const root = new URL('../../../../', import.meta.url)
const frame = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const [Bridge, Scenes, Validation, Model, Tracks, Ruler] = await Promise.all([
  import(new URL('kernelDocumentBridge.ts', frame)),
  import(new URL('packages/expressions-boundary/src/scenes.ts', root)),
  import(new URL('packages/expressions-boundary/src/scenesValidation.ts', root)),
  import(new URL('model.ts', frame)),
  import('../src/frame/tracks/modeTracks.ts'),
  import('../src/frame/tracks/ArrangementRuler.tsx').then(async own => ({...own, ...await import('../src/inhabitants/catalogue/panels/dlw__arrangement-ruler.tsx')})),
])

const E = 'expression:slip'
/** A native document of two scenes, Dawn 6 s and Noon 12 s, each the frame's blank scene renamed, nothing placed. */
function documentOf() {
  const scenes = [['dawn', 'Dawn', 6], ['noon', 'Noon', 12]].map(([id, name, duration]) => {
    const scene_ref = `${E}:scene:${id}`, scene = {...Model.blankJourney().scenes[0], id: scene_ref, name, duration}
    return {scene_ref, revision: 1, title: name, entity_refs: [],
      presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}}
  })
  return {schema: 'oi.expression/v1', expression_ref: E, revision: 3, title: 'Slip', scenes: scenes.map(({presentation: p, ...row}) => ({...row, presentation: p})),
    entities: {}, relations: {}, selection: {scene_ref: scenes[0].scene_ref, entity_ref: null}, provenance: [], representations: [], refinements: []}
}
/** The open Expression's track, its Dawn slipped to start `entry` seconds into its own evolution (absent: from its start). */
function trackOf(entry) {
  const view = Bridge.kernelDocumentToJourney(documentOf())
  if (entry !== undefined) view.journey.scenes[0].entryOffset = entry
  const inventory = Scenes.projectNativeScenes(view.journey, view)
  const basis = {expression_ref: E, revision: 3, scene_ref: `${E}:scene:dawn`}
  return {inventory, valid: Validation.isNativeScenesReading(inventory, basis), set: Tracks.nativeTracks({basis, scenes: inventory, playback: null}, 'Slip')}
}
function find(tree, pred, out = []) {
  if (Array.isArray(tree)) { for (const child of tree) find(child, pred, out); return out }
  if (!tree || typeof tree !== 'object' || !tree.props) return out
  if (pred(tree)) out.push(tree)
  return find(tree.props.children, pred, out)
}
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : text(tree.props?.children)
/** The Arrangement over the set: Dawn's clip on the visual lane, its content's marks (content second → where in the clip, %) and words. */
function drawn(set) {
  const tree = Ruler.ArrangementRulerView({set, selection: {select: noop}, receipt: null, onDismiss: noop, onPress: noop,
    view: {window: null, onWindow: noop, snap: 'grid', onSnap: noop, marker: null, onMarker: noop, width: 360}})
  const clip = find(tree, el => typeof el.props?.['data-clip'] === 'string' && el.props['data-clip'].endsWith(':visual') && el.props['data-clip'].includes('dawn'))[0]
  assert.ok(clip, 'Dawn\'s clip is drawn')
  const marks = find(clip, el => el.props?.['data-content-at'] !== undefined).map(el => [el.props['data-content-at'], parseFloat(el.props.style.left)])
  return {clip, marks, words: text(clip.props.children), title: clip.props.title}
}

test('the scenes inventory reads where a slipped scene starts in its own evolution, and a scene not slipped keeps none', () => {
  const plain = trackOf(), slipped = trackOf(2.5)
  assert.equal(plain.valid, true); assert.equal(slipped.valid, true, 'the inventory with an entry is still a scenes reading')
  assert.equal(plain.inventory.scenes[0].working.entry, undefined)
  assert.equal(slipped.inventory.scenes[0].working.entry, 2.5)
  assert.equal(slipped.inventory.scenes[1].working.entry, undefined, 'Noon is not slipped')
  assert.equal(Validation.isNativeScenesReading({...slipped.inventory, scenes: [{...slipped.inventory.scenes[0], working: {...slipped.inventory.scenes[0].working, entry: -1}}, slipped.inventory.scenes[1]]},
    {expression_ref: E, revision: 3, scene_ref: `${E}:scene:dawn`}), false, 'an entry before the content\'s start is not a reading')
})

test('a Slip moves what the Arrangement draws in the clip: its content\'s seconds start where the scene starts in them, and it says so', () => {
  const before = drawn(trackOf().set), after = drawn(trackOf(2.5).set)
  const clips = trackOf(2.5).set.clips.filter(clip => clip.id.includes('dawn'))
  assert.deepEqual(clips.map(clip => clip.content), [{from: 2.5, unit: 's'}, {from: 2.5, unit: 's'}], 'both of the scene\'s lanes carry it')
  assert.ok(before.marks.length >= 2, `the content's seconds are drawn in the clip (${JSON.stringify(before.marks)})`)
  assert.deepEqual(before.marks.map(([at]) => at), before.marks.map((_, i) => before.marks[0][0] + i * (before.marks[1][0] - before.marks[0][0])), 'evenly')
  // Each mark lies where its content second plays: (second − entry) of the clip's 6 s.
  for (const [at, left] of after.marks) assert.ok(Math.abs(left - (at - 2.5) / 6 * 100) < 1e-6, `${at} s of its content at ${left}%`)
  for (const [at, left] of before.marks) assert.ok(Math.abs(left - at / 6 * 100) < 1e-6, `${at} s of its content at ${left}%`)
  assert.notDeepEqual(after.marks, before.marks, 'the Slip moved them')
  assert.ok(after.marks.every(([at]) => at > 2.5 && at < 8.5), 'only the seconds the clip plays are drawn')
  assert.doesNotMatch(before.words, /from/, 'a scene that starts at its content\'s start says nothing more')
  assert.match(after.words, /from 2\.5 s/, 'a slipped clip says where it starts in its content')
  assert.match(after.title, /starts 2\.5 s into its own content/)
})
