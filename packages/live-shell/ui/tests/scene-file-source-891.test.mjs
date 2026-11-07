// O-I #747 round 891: a current revision for text and image sources, so a scene made of one shows the render law's mark too (manual §10.3
// Media: "When the source of a render has moved since it was made … says so, and Remake … makes it again from the source as it now
// stands"). A scene's text or image body is read from Central's file owner at a revision (field-studies-journeys nativeSceneBody.ts
// bodyFromNativeReading: native_owner 'central'); the same owner answers the file's revision now (the host channel's central-subject-text
// and central-subject-bytes, expressions-boundary cradle.ts). The Clip panel's Body tab says "source moved" under the Reference, with
// Remake beside it; a source no reading compares stands unmarked, never guessed; a constellation's revision stays the wiki's (round 890).
// Channels: SCRIPTED owners standing for Central's file owner (each call recorded); the production binding and the designed clip drawn to
// static markup.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

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
  if (u.includes('?raw') || u.includes('.html') || u.endsWith('.svg') || u.endsWith('.png') || u.endsWith('.md')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage ??= {getItem: () => null, setItem: noop}

const root = new URL('../../../../', import.meta.url)
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {loadClip} = await import('../src/inhabitants/catalogue/clips/index.ts')
const {resetViewHolds} = await import('../src/frame/detail/clipBinding.ts')
const expressions = await import('../src/components/expressions/clip/clipBinding.ts')
const {blankJourney} = await import(new URL('model.ts', author).href)

const EXPR = 'expression:file-891'
const SCENE = `${EXPR}:scene:dawn`
const NOTES = 'central:notes/dawn.md', PLATE = 'central:plates/dawn.png'
const body = (carrier, ref, revision) => ({carrier, subject_ref: ref, native_owner: 'central', reading: {ref, revision, availability: 'available'},
  provenance: [], actions: [], presentation: 'inline', capability: {state: 'renderable'}, span: null, recursion: null})
const whole = revision => ({carrier: 'knowledge_whole', subject_ref: 'wiki:node:central', native_owner: 'ai-kit', reading: {ref: 'wiki:node:central', revision, availability: 'available'},
  provenance: [], actions: [], presentation: 'preview', capability: {state: 'degrades_to_thing', reason: 'Central: a constellation of the wiki.'}, span: null, recursion: null})
function editorReading(sceneBody) {
  const scenes = [{scene_ref: SCENE, title: 'Dawn', native_title: 'Dawn', snapshot: {duration: 8}, working: {duration: 8}, material: {available: true}}]
  return {basis: {expression_ref: EXPR, revision: 3, scene_ref: SCENE, authored_revision: 0}, nativeScene: {scene_ref: SCENE, body: sceneBody, triggers: []},
    nativeSelection: {scene_ref: SCENE}, scenes: {basis: {expression_ref: EXPR, revision: 3}, scenes, loop: false, timing: {saved: {available: true}}},
    playback: {scene_ref: SCENE, intent_epoch: 3}, scene: {...blankJourney().scenes[0], id: SCENE, name: 'Dawn'},
    entityOccurrences: {}, selection: {entity_ids: [], step_id: null}, history: {}, standing: {busy: false, pending: false, notice: null}}
}
/** Central's file owner as the host channel answers it: the file at `now`, or a refusal. Every call recorded. */
function centralFiles(now) {
  const asked = []
  const answer = kind => async request => {
    asked.push([kind, request.ref])
    if (now instanceof Error) throw now
    return {requested_ref: request.ref, ref: request.ref, native_owner: 'central', revision: now, byte_len: 4}
  }
  return {asked, owners: {'central-subject-text': answer('central-subject-text'), 'central-subject-bytes': answer('central-subject-bytes')}}
}

test('r891: the revision a text or image source stands at now is Central\'s file owner\'s answer, asked of the source the body names', async () => {
  assert.equal(typeof expressions.fileSourceRevision, 'function', 'the read lives with the scene\'s binding')
  const text = centralFiles('r8')
  assert.equal(await expressions.fileSourceRevision(text.owners, body('text_source', NOTES, 'r7')), 'r8')
  assert.deepEqual(text.asked, [['central-subject-text', NOTES]], 'a text source: the text read, by its own ref')
  const image = centralFiles('i2')
  assert.equal(await expressions.fileSourceRevision(image.owners, body('image_media', PLATE, 'i1')), 'i2')
  assert.deepEqual(image.asked, [['central-subject-bytes', PLATE]], 'an image: the bytes read')
  const none = centralFiles('x')
  for (const other of [whole('3'), null, undefined]) assert.equal(await expressions.fileSourceRevision(none.owners, other), undefined)
  assert.deepEqual(none.asked, [], 'a constellation is the wiki\'s, and the engine composition is made of nothing: nothing is asked')
  assert.equal(await expressions.fileSourceRevision(centralFiles(new Error('The native owner does not admit this file path for retrieval')).owners, body('text_source', NOTES, 'r7')),
    undefined, 'a refused read compares nothing: the source stands unmarked, never guessed')
})

test('r891: a scene made of a file says "source moved" while the file stands at another revision than its body was read at', () => {
  resetViewHolds()
  const at = (sceneBody, now) => expressions.expressionsClipBinding({reading: editorReading(sceneBody), request: null, fileRevision: now}).values
  assert.equal(at(body('text_source', NOTES, 'r7'), 'r8')['body.mark'], 'source moved')
  assert.equal(at(body('image_media', PLATE, 'i1'), 'i2')['body.mark'], 'source moved')
  assert.equal('body.mark' in at(body('text_source', NOTES, 'r7'), 'r7'), false, 'current: no mark')
  assert.equal('body.mark' in at(body('text_source', NOTES, 'r7'), undefined), false, 'unread: no mark')
  assert.equal('body.mark' in at(whole('3'), 'r8'), false, 'a constellation\'s mark is the wiki\'s, under Constellation')
  assert.equal(at(body('text_source', NOTES, 'r7'), null)['body.mark'], 'source missing', 'the owner reads it as gone')
})

test('r891: the Body tab says it under the Reference, with Remake beside it; nothing while the source stands', async () => {
  const design = await loadClip('expressions')
  const tab = design.panel.find(row => row.id === 'body')
  assert.ok(tab, 'the scene\'s body has its tab beside Clip')
  const draw = v => renderToStaticMarkup(createElement('div', null, tab.draw({v: {...design.defaults, reference: NOTES, ...v}, set: noop, size: 'detail', room: {w: 1180, h: 300}})))
  const moved = draw({'body.mark': 'source moved'})
  assert.match(moved, />Reference<\/span>[\s\S]*<div class="clv-row clv-row--whole"><div class="clv-row-control"><span class="clv-tag clv-source-mark"[^>]*>source moved<\/span>.*>Remake<\/button>/,
    'the line under the Reference: the mark, then Remake')
  assert.match(moved, /data-i="Source moved\|The file no longer stands as it did when the scene was made of it\. The scene keeps showing what it was made from until it is remade\."/)
  assert.doesNotMatch(draw({}), /source moved|>Remake</)
})

// The kind of fault test-all found in round 891: clipBinding.ts is imported by the set's tracks (frame/tracks/modeTracks.ts sceneMaker), so
// a static import of the hosted frame's owner family there carried the Nara facade and the Flow documents (ql-flow.html) into every module
// that draws tracks. The family is loaded with the first read, as the atlas's palaces load it (palaceOwners.ts).
test('r891: the file owner\'s read loads the owner family when it is first asked, never with the module the set\'s tracks import', async () => {
  const source = await readFile(new URL('../src/components/expressions/clip/clipBinding.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /^import\s[^;]*from '@epilogos\/expressions-boundary\/cradle'/m, 'no static import of the owner family')
  assert.match(source, /import\('@epilogos\/expressions-boundary\/cradle'\)\.then\(\(\{createCradleOwners\}\) => fileSourceRevision\(/, 'loaded when the revision is first read')
})
