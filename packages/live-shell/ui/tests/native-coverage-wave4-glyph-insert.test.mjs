import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Wave 4 coverage for the Glyph Sequence insert row (source-add). The three state-insert buttons in GlyphSequenceEditor send
// step-insert changes; the button handlers are inline JSX, so their payloads are mirrored here from GlyphSequenceEditor.tsx
// (the plus State, plus ASCII state and plus Image state onClick bodies) and the owner reducer is the production
// applyNativeGlyphChanges from the desktop Studio. The editor is rendered with SSR for names, titles and disabled reasons.
// Same loader as native-glyph-object-controls.test.mjs. No owner, server or DOM is involved.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const [source, editorModule, model, hostEditor] = await Promise.all([
  import('../src/components/nativeGlyphSource.ts'),
  import('../src/components/GlyphSequenceEditor.tsx'),
  import(new URL('model.ts', author)),
  import(new URL('hostEditor.ts', author)),
])
const {sourceDefault, ASCII_DEFAULT, DEFAULT_IMAGE_THRESHOLD} = source
const {GlyphSequenceEditor} = editorModule
const {fieldStudies} = model
const {applyNativeGlyphChanges} = hostEditor

// A formation with two states, as the Glyph Sequence editor shows it. The editor's selected state is state-a.
function fixture(steps = 2) {
  const journey = fieldStudies(), scene = journey.scenes[0]
  const e = scene.entities.find(entity => entity.kind === 'formation')
  e.locked = false
  e.sequence.enabled = true
  e.sequence.manual = false
  const base = {text: 'O', shape: 'text', hold: 1, transition: 1, position: null, layers: []}
  e.sequence.steps = Array.from({length: steps}, (_, index) => ({...base, id: `state-${index === 0 ? 'a' : index === 1 ? 'b' : index}`}))
  return {journey, scene, e, step: e.sequence.steps[0]}
}
const readingFor = (scene, e, step, {locked = false} = {}) => ({
  basis: {expression_ref: 'expr:glyph-insert', revision: 1, scene_ref: scene.id, authored_revision: 1},
  scene: {...scene, entities: scene.entities.map(row => row.id === e.id ? {...row, locked} : row)},
  entityOccurrences: {[e.id]: 'occ:glyph-insert'}, chosenControls: {available: false, entries: [], controls: []}, devices: [],
  selection: {entity_ids: [e.id], step_id: step.id}, history: {canUndo: false, canRedo: false},
  standing: {dirty: false, pending: false, notice: null},
})
const markupFor = reading => renderToStaticMarkup(createElement(GlyphSequenceEditor, {reading, request: async () => ({ok: false, error: 'closed'})}))
/** The opening tag of the button whose text is exactly `label`. */
const buttonTag = (markup, label) => {
  const found = markup.match(new RegExp(`<button[^>]*>${label}</button>`))
  assert.ok(found, `button ${label} is rendered`)
  return found[0]
}
const stepsOf = (journey, entityId) => journey.scenes[0].entities.find(row => row.id === entityId).sequence.steps
// The three payloads of the state-insert buttons, one change each, as GlyphSequenceEditor sends them.
const plusState = (e, afterId) => ({kind: 'step-insert', entity_id: e.id, after_step_id: afterId, text: e.text})
const plusAscii = (e, afterId) => ({kind: 'step-insert', entity_id: e.id, after_step_id: afterId, text: e.text, source: sourceDefault('ascii')})
const plusImage = (e, afterId) => ({kind: 'step-insert', entity_id: e.id, after_step_id: afterId, text: e.text, source: sourceDefault('image')})

test('plus State inserts one glyph state after the selected state, with no source of its own', () => {
  const {journey, scene, e} = fixture()
  const next = applyNativeGlyphChanges(journey, scene.id, [plusState(e, 'state-a')])
  const steps = stepsOf(next, e.id)
  assert.equal(steps.length, 3)
  assert.equal(steps[0].id, 'state-a')
  assert.equal(typeof steps[1].id, 'string')
  assert.ok(!['state-a', 'state-b'].includes(steps[1].id), 'the inserted state has a fresh id')
  assert.equal(steps[2].id, 'state-b')
  assert.equal(steps[1].text, 'O')
  assert.equal(steps[1].source, undefined, 'a plain state carries no source')
  assert.equal(steps[0].source, undefined)
})

test('plus State inserts at the head when the selected state is the first one, and before the rest of the sequence otherwise', () => {
  const {journey, scene, e} = fixture(3)
  // A null destination is the head of the sequence; the middle state id puts the new state between the second and third.
  const head = stepsOf(applyNativeGlyphChanges(journey, scene.id, [plusState(e, null)]), e.id)
  assert.equal(head.length, 4)
  assert.ok(!head[0].id.startsWith('state-'), 'the new state leads the sequence')
  assert.deepEqual(head.slice(1).map(step => step.id), ['state-a', 'state-b', 'state-2'])
  const middle = stepsOf(applyNativeGlyphChanges(journey, scene.id, [plusState(e, 'state-b')]), e.id)
  assert.deepEqual(middle.slice(0, 2).map(step => step.id), ['state-a', 'state-b'])
  assert.ok(!middle[2].id.startsWith('state-'), 'the new state sits between the second and third states')
  assert.equal(middle[3].id, 'state-2')
})

test('plus ASCII state gives only the new state the app ASCII default, and leaves the existing states alone', () => {
  const {journey, scene, e} = fixture()
  const before = stepsOf(journey, e.id)
  const next = stepsOf(applyNativeGlyphChanges(journey, scene.id, [plusAscii(e, 'state-a')]), e.id)
  assert.equal(next.length, 3)
  assert.deepEqual(next[1].source, {kind: 'ascii', ascii: {...ASCII_DEFAULT}})
  assert.equal(next[1].source.ascii.text, 'O  :  I')
  assert.equal(next[0].source, undefined, 'the state the insert followed keeps its own source')
  assert.equal(next[2].source, undefined)
  assert.equal(before.length, 2, 'the input journey is not mutated')
})

test('plus Image state gives only the new state the image default, with no file, in one change', () => {
  const {journey, scene, e} = fixture()
  const next = stepsOf(applyNativeGlyphChanges(journey, scene.id, [plusImage(e, 'state-b')]), e.id)
  assert.equal(next.length, 3)
  assert.equal(next[2].source.kind, 'image')
  assert.deepEqual(next[2].source.image, {mode: 'luminance', threshold: DEFAULT_IMAGE_THRESHOLD, invert: false, scale: 1})
  assert.equal(next[2].source.image.dataUrl, undefined, 'the file is chosen in the Studio, never by the insert')
  assert.equal(next[0].source, undefined)
  assert.equal(next[1].source, undefined)
})

test('insertion after a state that has vanished is refused by the owner, and nothing is inserted', () => {
  const {journey, scene, e} = fixture()
  assert.throws(() => applyNativeGlyphChanges(journey, scene.id, [plusState(e, 'state-gone')]), /insertion destination no longer exists/)
  assert.equal(stepsOf(journey, e.id).length, 2)
})

test('the three state-insert buttons are rendered and enabled for an unlocked sequence with room', () => {
  const {scene, e, step} = fixture()
  const markup = markupFor(readingFor(scene, e, step))
  assert.doesNotMatch(buttonTag(markup, '＋ State'), /disabled=""/)
  assert.doesNotMatch(buttonTag(markup, '＋ ASCII state'), /disabled=""/)
  assert.doesNotMatch(buttonTag(markup, '＋ Image state'), /disabled=""/)
  assert.match(buttonTag(markup, '＋ ASCII state'), /title="A new state with the app&#x27;s default ASCII drawing"/)
  assert.match(buttonTag(markup, '＋ Image state'), /title="A new image state; choose its file in the Studio"/)
})

test('every state-insert button is disabled when the entity is locked', () => {
  const {scene, e, step} = fixture()
  const markup = markupFor(readingFor(scene, e, step, {locked: true}))
  for (const label of ['＋ State', '＋ ASCII state', '＋ Image state']) assert.match(buttonTag(markup, label), /disabled=""/, label)
})

test('every state-insert button is disabled at the 32-state limit', () => {
  const {scene, e, step} = fixture(32)
  const markup = markupFor(readingFor(scene, e, step))
  for (const label of ['＋ State', '＋ ASCII state', '＋ Image state']) assert.match(buttonTag(markup, label), /disabled=""/, label)
})
