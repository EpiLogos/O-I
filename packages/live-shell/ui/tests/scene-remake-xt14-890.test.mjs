// O-I #747 round 890, XT14 ("I find a film whose source has moved and remake it": the render "shows that its source has moved; remade, it
// matches the Expression again"; "Until it is remade, it keeps naming what it was made from" #709). Manual §10.3 Media: "A render is made
// from something else: it names what it was made from, it can be remade, and it is never edited in place. When the source of a render has
// moved since it was made, the render's row in the browser says so, and Remake, in its menu, makes it again from the source as it now
// stands"; §19.1 Songs: Factory's song clip is such a render, with its Remake.
// The lead's brief (DLW build ruling 2026-11-06, round 890 item 4): Expressions get the moved-source mark and Remake; Remake re-derives the
// scene from its moved source as one labelled undo step; Factory's Remake law is shared, not copied.
// What a scene is made from is its body's source, read at a revision (expression_carrier.rs SceneBody.reading). Channels: FIXTURE wiki
// register shaped as the Wiki owner gives it (techne/wikiExpression.ts parseWiki → projectWikiExpression), the production boundary planner
// over a minimal native document, and a SCRIPTED request door standing for the retained editor.
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
const text = path => readFile(new URL(path, import.meta.url), 'utf8')
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {parseWiki} = await import('../../../../desktop/cradle/src/techne/wikiReading.ts')
const {projectWikiExpression} = await import('../../../../desktop/cradle/src/techne/wikiExpression.ts')
const owners = await import('../src/owners/constellations.ts')
const {MADE_OF} = await import('../src/inhabitants/catalogue/clips/design.ts')
const {loadClip} = await import('../src/inhabitants/catalogue/clips/index.ts')
const {resetViewHolds} = await import('../src/frame/detail/clipBinding.ts')
const expressions = await import('../src/components/expressions/clip/clipBinding.ts')
const songs = await import('../src/agent/songClips.ts')
const material = await import('../../../expressions-boundary/src/sceneMaterialEdits.ts')
const {blankJourney} = await import(new URL('model.ts', author).href)
const {kernelDocumentToJourney} = await import(new URL('kernelDocumentBridge.ts', author).href)
const law = await import('../src/frame/detail/remake.ts').catch(error => ({missing: error.message}))

// ---------------------------------------------------------------------------------------------------------------- the shared law

test('the render law is one module: where a source stands, the mark, what Remake does and answers', () => {
  assert.equal(law.missing, undefined, 'frame/detail/remake.ts holds the law every render shares')
  assert.equal(law.sourceStanding('6', '6'), 'current')
  assert.equal(law.sourceStanding('6', '7'), 'moved')
  assert.equal(law.sourceStanding('6', null), 'missing', 'the owner reads the source as gone')
  assert.equal(law.sourceStanding('6', undefined), 'unread', 'nothing reads the source now: never guessed as current')
  assert.equal(law.sourceStanding(null, '7'), 'unread', 'a render that names no revision cannot be compared')
  assert.equal(law.standingMark('set', 'moved'), 'set moved')
  assert.equal(law.standingMark('source', 'missing'), 'source missing')
  assert.equal(law.standingMark('source', 'current'), null)
  assert.equal(law.standingMark('source', 'unread'), null)
  assert.equal(law.remakeDoes('Dawn', 'set'), 'Makes Dawn again from the set it names, as that set now stands. A render is never edited in place.')
  assert.equal(law.remadeNote('Dawn', 'set', true), 'Dawn was made again from its set, which had moved.')
  assert.equal(law.remadeNote('Dawn', 'set', false), 'Dawn was made again from its set, which had not moved.')
})

test('Factory\'s song clips speak the shared law, not a copy of it', async () => {
  assert.equal(songs.STANDING_WORD.moved, law.standingMark('set', 'moved'))
  assert.equal(songs.STANDING_WORD.missing, law.standingMark('set', 'missing'))
  const clips = await text('../src/agent/songClips.ts'), rows = await text('../src/agent/SongRows.tsx')
  assert.match(clips, /from '\.\.\/frame\/detail\/remake'/)
  assert.doesNotMatch(clips, /'set moved'|which had moved|which had not moved/, 'the words live in the law')
  assert.match(rows, /remakeDoes\(selected\.name, 'set'\)/)
  assert.doesNotMatch(rows, /again from the set it names/)
})

// ---------------------------------------------------------------------------------------------------------------- the owner's Remake

const EXPR = 'expression:remake-890'
const SCENE = `${EXPR}:scene:dawn`
const LIVED = 'wiki:node:project-root/o-i'
const NOTES = 'native:file:notes'
const wholeBody = revision => ({carrier: 'knowledge_whole', subject_ref: LIVED, native_owner: 'ai-kit', reading: {ref: LIVED, revision, availability: 'available'},
  provenance: [], actions: [], presentation: 'preview', capability: {state: 'degrades_to_thing', reason: 'O-I: a constellation of the wiki.'}, span: null, recursion: null})
const textBody = (revision, span = {start: 2, end: 9}) => ({carrier: 'text_source', subject_ref: NOTES, native_owner: 'central', reading: {ref: NOTES, revision, availability: 'available'},
  provenance: [], actions: [], presentation: 'inline', capability: {state: 'renderable'}, span, recursion: null})
const REMAKE = {family: 'body', body: {operation: 'remake'}}
function seed(body) {
  const journey = blankJourney()
  const document = {schema: 'oi.expression/v1', expression_ref: EXPR, revision: 3, title: 'Remake', scenes: [{scene_ref: SCENE, revision: 1, title: 'Dawn', entity_refs: [], body, triggers: []}],
    entities: {}, relations: {}, selection: {scene_ref: SCENE, entity_ref: null}, provenance: [], representations: [], refinements: []}
  return kernelDocumentToJourney(document, {identity: {expression: journey.id, scenes: {[SCENE]: journey.scenes[0].id}}})
}
const basis = view => ({expression_ref: EXPR, revision: view.document.revision, scene_ref: SCENE, authored_revision: 0})

test('Remake reads the scene\'s own source again: the carrier, subject and span its body names, nothing the shell sends', () => {
  assert.deepEqual(material.sceneMaterialReadRequirement(REMAKE, wholeBody('6')), {kind: 'read', carrier: 'knowledge_whole', subject_ref: LIVED, span: null})
  assert.deepEqual(material.sceneMaterialReadRequirement(REMAKE, textBody('a1')), {kind: 'read', carrier: 'text_source', subject_ref: NOTES, span: {start: 2, end: 9}})
  assert.match(material.sceneMaterialReadRequirement(REMAKE, null).problem, /made of no source/, 'the engine composition is no render')
  assert.match(material.sceneMaterialReadRequirement(REMAKE).problem, /made of no source/)
  assert.match(material.sceneMaterialReadRequirement(REMAKE, {...wholeBody('6'), carrier: 'expression_ref'}).problem, /no host resolver yet: expression_ref/)
  assert.match(material.sceneMaterialReadRequirement({family: 'body', body: {operation: 'remake', subject_ref: 'native:file:other'}}, wholeBody('6')).problem,
    /Unsupported Scene body operand/, 'Remake names no source of its own: it is the scene\'s')
})

test('Remake is one labelled step: the body made again from its source as it now stands, the scene\'s presentation kept', () => {
  const view = seed(wholeBody('6'))
  const plan = material.prepareNativeSceneMaterialEdit(view, basis(view), REMAKE, {...wholeBody('7'), presentation: 'preview'})
  assert.equal(plan.label, 'Remake scene')
  assert.equal(plan.changes.length, 1, 'one change: one undo step')
  assert.equal(plan.changes[0].change, 'scene_body_set')
  assert.equal(plan.changes[0].body.reading.revision, '7', 'remade, it matches its source again')
  assert.equal(plan.changes[0].body.subject_ref, LIVED, 'it still names what it was made from')
  const text = seed(textBody('a1'))
  const kept = material.prepareNativeSceneMaterialEdit(text, basis(text), REMAKE, {...textBody('a2'), presentation: 'inline'})
  assert.deepEqual(kept.changes[0].body.span, {start: 2, end: 9})
  // A source that has not moved: nothing is written, and the step says so.
  const still = material.prepareNativeSceneMaterialEdit(view, basis(view), REMAKE, wholeBody('6'))
  assert.deepEqual(still.changes, [])
  assert.match(still.label, /^Remake scene: its source had not moved$/)
})

test('Remake refuses a reading of another source, and a scene made of none', () => {
  const view = seed(wholeBody('6'))
  assert.throws(() => material.prepareNativeSceneMaterialEdit(view, basis(view), REMAKE, {...wholeBody('7'), subject_ref: 'wiki:node:other', reading: {ref: 'wiki:node:other', revision: '7', availability: 'available'}}),
    /another source/)
  const text = seed(textBody('a1'))
  assert.throws(() => material.prepareNativeSceneMaterialEdit(text, basis(text), REMAKE, textBody('a2', {start: 0, end: 4})), /another source/, 'the span is the scene\'s, kept')
  assert.throws(() => material.prepareNativeSceneMaterialEdit(view, basis(view), REMAKE), /Resolve the exact native reading/)
  const none = seed(null)
  assert.throws(() => material.prepareNativeSceneMaterialEdit(none, basis(none), REMAKE, wholeBody('7')), /made of no source/)
})

test('the frame reads the scene\'s current body before it reads the source again (app.ts editSceneMaterial)', async () => {
  const app = await readFile(new URL('app.ts', author), 'utf8')
  assert.match(app, /const view=nativeWorkspace\?\.nativeView\(\);\s*const requirement=sceneMaterialReadRequirement\(request\.intent,Object\.values\(view\?\.bindings\?\?\{\}\)\.find\(row=>row\.scene_ref===request\.basis\.scene_ref\)\?\.body\?\?null\);/)
})

// ---------------------------------------------------------------------------------------------------------------- the mark and the press

const SPACE = 'central:wiki:project:O-I'
const wiki = revision => ({objects: [
  {object: 'space', ref: SPACE, title: 'O-I', anchor_ref: LIVED, node_refs: [LIVED], child_space_refs: [], revision},
  {object: 'node', ref: LIVED, title: 'O-I', type: 'project-root', revision: 1},
]})
function rows(revision) {
  const register = {key: 'O-I', title: 'O-I', project: 'O-I', projectPath: 'Work/O-I'}
  const reading = {state: 'ready', register, wiki: parseWiki(JSON.stringify(wiki(revision))), wikiBasis: {path: 'wiki.json', revision: 'r1', location: {schema: 'central.path-ref/v1', ref: 'x', root: '/g', path: 'wiki.json'}},
    relations: {state: 'unavailable', focusRef: '', reason: 'not read in this fixture'}}
  return owners.constellationsOf({registers: [register], standings: {'O-I': {phase: 'projected', reading, projection: projectWikiExpression(reading)}}}).rows
}
function editorReading(body) {
  const scenes = [{scene_ref: SCENE, title: 'Dawn', native_title: 'Dawn', snapshot: {duration: 8}, working: {duration: 8}, material: {available: true}}]
  return {basis: {expression_ref: EXPR, revision: 3, scene_ref: SCENE, authored_revision: 0}, nativeScene: {scene_ref: SCENE, body, triggers: []},
    nativeSelection: {scene_ref: SCENE}, scenes: {basis: {expression_ref: EXPR, revision: 3}, scenes, loop: false, timing: {saved: {available: true}}},
    playback: {scene_ref: SCENE, intent_epoch: 3}, scene: {...blankJourney().scenes[0], id: SCENE, name: 'Dawn'},
    entityOccurrences: {}, selection: {entity_ids: [], step_id: null}, history: {}, standing: {busy: false, pending: false, notice: null}}
}

test('a constellation names the revision the wiki reads its whole at: the reading a scene\'s body is made from', () => {
  assert.equal(owners.constellationNamed(rows(6), LIVED)?.revision, '6')
  assert.equal(owners.constellationNamed(rows(7), LIVED)?.revision, '7')
})

test('the scene says its source moved, and keeps naming what it was made from, until it is remade', () => {
  resetViewHolds()
  const current = expressions.expressionsClipBinding({reading: editorReading(wholeBody('6')), request: null, constellations: rows(6)})
  assert.equal(current.values[MADE_OF.ref], LIVED)
  assert.equal(MADE_OF.mark in current.values, false, 'a current source carries no mark')
  const moved = expressions.expressionsClipBinding({reading: editorReading(wholeBody('6')), request: null, constellations: rows(7)})
  assert.equal(moved.values[MADE_OF.mark], 'source moved')
  assert.equal(moved.values[MADE_OF.ref], LIVED, 'it keeps naming what it was made from')
  assert.equal(moved.values[MADE_OF.name], 'O-I')
  const unread = expressions.expressionsClipBinding({reading: editorReading(textBody('a1')), request: null, constellations: rows(7)})
  assert.equal(MADE_OF.mark in unread.values, false, 'a file source no reading compares stands unmarked, never guessed')
})

test('Remake in the Clip panel is one scene-material request: the scene\'s own body, made again', async () => {
  resetViewHolds()
  const sent = []
  const reading = editorReading(wholeBody('6'))
  const binding = expressions.expressionsClipBinding({reading, request: async operation => { sent.push(operation); return {ok: true, reading} }, constellations: rows(7)})
  assert.equal(binding.standing[MADE_OF.remake], undefined, 'Remake stands lit')
  await binding.write([{key: MADE_OF.remake, value: 1}])
  assert.deepEqual(sent, [{operation: 'scene-material', basis: reading.basis, intent: REMAKE}])
  const engine = expressions.expressionsClipBinding({reading: editorReading(null), request: async () => assert.fail('nothing is sent'), constellations: rows(7)})
  assert.match(engine.standing[MADE_OF.remake].disabled, /made of no source/)
})

test('the Expressions Clip panel draws the mark and Remake on their own line under the constellation, with what Remake does', async () => {
  const design = await loadClip('expressions')
  const tab = design.panel.find(row => row.id === 'clip')
  const draw = v => renderToStaticMarkup(createElement('div', null, tab.draw({v: {...design.defaults, ...v}, set: noop, size: 'detail', room: {w: 1180, h: 300}})))
  const moved = draw({[MADE_OF.name]: 'O-I', [MADE_OF.ref]: LIVED, [MADE_OF.mark]: 'source moved'})
  assert.match(moved, /<span class="clv-tag clv-source-mark"[^>]*>source moved<\/span>/, 'its own mark, not the groove rows\' clv-mark')
  assert.match(moved, />Remake</)
  assert.match(moved, /Makes the scene again from the source it names, as that source now stands\. A render is never edited in place\./)
  assert.doesNotMatch(draw({[MADE_OF.name]: 'O-I', [MADE_OF.ref]: LIVED}), /source moved/)
  // Walk 890 (capture 25): beside the name and Show in Browser the clip column had no room, and Remake was drawn over Show in Browser.
  const rows = moved.split('<div class="clv-row">').slice(1)
  const named = rows.find(row => row.includes('>Constellation</span>')), remade = rows.find(row => row.includes('>Remake<'))
  assert.ok(named && remade && named !== remade, 'Remake stands on its own line, not a third control beside the name and Show in Browser')
  assert.match(named, />Show in Browser</)
  assert.doesNotMatch(named, /source moved|>Remake</)
  assert.match(remade, /source moved/, 'the mark stands with Remake')
})
