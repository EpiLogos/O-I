// O-I #747 round 895 (DLW build ruling 2026-11-08, "the port ledger tells the truth"): the port ledger's delete-step and duplicate-step
// named packages/live-shell/ui/tests/native-arrangement-view.test.mjs, which left the tree with the native Arrangement timeline (commit
// 4e189a71d, FOUNDATION §7: "the native Arrangement timeline and model → the Clip editor"). Their outward home stands: the Glyph Sequence
// editor's Duplicate and Remove, and Delete on its states. This is their test.
// CODE-READING: the inline onClick and onKeyDown bodies of GlyphSequenceEditor.tsx (one change each, as it sends them). SSR: the editor
// rendered for its buttons and their gates. REAL: the owner reducer, the desktop Studio's applyNativeGlyphChanges. Same loader as
// native-coverage-wave4-glyph-insert.test.mjs. No owner, server or DOM is involved.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const [{GlyphSequenceEditor}, {fieldStudies}, {applyNativeGlyphChanges}] = await Promise.all([
  import('../src/components/GlyphSequenceEditor.tsx'),
  import(new URL('model.ts', author)),
  import(new URL('hostEditor.ts', author)),
])
const editor = readFileSync(new URL('../src/components/GlyphSequenceEditor.tsx', import.meta.url), 'utf8')

function fixture(steps = 3) {
  const journey = fieldStudies(), scene = journey.scenes[0]
  const e = scene.entities.find(entity => entity.kind === 'formation')
  e.locked = false
  e.sequence.enabled = true
  e.sequence.manual = false
  const base = {text: 'O', shape: 'text', hold: 1, transition: 1, position: null, layers: []}
  e.sequence.steps = Array.from({length: steps}, (_, index) => ({...base, id: `state-${index}`, text: String.fromCharCode(65 + (index % 26))}))
  return {journey, scene, e, step: e.sequence.steps[0]}
}
const readingFor = (scene, e, step, {locked = false} = {}) => ({
  basis: {expression_ref: 'expr:glyph-states', revision: 1, scene_ref: scene.id, authored_revision: 1},
  scene: {...scene, entities: scene.entities.map(row => row.id === e.id ? {...row, locked} : row)},
  entityOccurrences: {[e.id]: 'occ:glyph-states'}, chosenControls: {available: false, entries: [], controls: []}, devices: [],
  selection: {entity_ids: [e.id], step_id: step.id}, history: {canUndo: false, canRedo: false},
  standing: {dirty: false, pending: false, notice: null},
})
const markupFor = reading => renderToStaticMarkup(createElement(GlyphSequenceEditor, {reading, request: async () => ({ok: false, error: 'closed'})}))
const buttonTag = (markup, label) => {
  const found = markup.match(new RegExp(`<button[^>]*>${label}</button>`))
  assert.ok(found, `button ${label} is rendered`)
  return found[0]
}
const stepsOf = (journey, entityId) => journey.scenes[0].entities.find(row => row.id === entityId).sequence.steps

test('CODE-READING: Duplicate sends one step-duplicate for the state shown; Remove and Delete send one step-remove for the selected states', () => {
  assert.match(editor, /onClick=\{\(\)=>apply\(\[\{kind:'step-duplicate',entity_id:e\.id,step_id:k\.id\}\]\)\}>Duplicate<\/button>/)
  assert.match(editor, /onClick=\{\(\)=>apply\(\[\{kind:'step-remove',entity_id:e\.id,step_ids:selected\.length\?selected:\[k\.id\]\}\]\)\}>Remove<\/button>/)
  assert.match(editor, /aria-label="Glyph states"[^\n]*onKeyDown=\{event=>\{if\(event\.key==='Delete'&&!locked\)\{event\.preventDefault\(\);void apply\(\[\{kind:'step-remove',entity_id:e\.id,step_ids:selected\.length\?selected:\[k\.id\]\}\]\)\}/,
    'Delete on the states list removes the same states Remove does, and never while locked')
})

test('Duplicate copies the state shown in place, under a fresh id; the owner refuses a state that has gone', () => {
  const {journey, scene, e} = fixture()
  const steps = stepsOf(applyNativeGlyphChanges(journey, scene.id, [{kind: 'step-duplicate', entity_id: e.id, step_id: 'state-1'}]), e.id)
  assert.equal(steps.length, 4)
  assert.deepEqual([steps[0].id, steps[1].id, steps[3].id], ['state-0', 'state-1', 'state-2'])
  assert.ok(!steps.slice(0, 2).concat(steps[3]).some(step => step.id === steps[2].id), 'the copy has an id of its own')
  assert.equal(steps[2].text, 'B', 'the copy is of the state shown')
  assert.equal(stepsOf(journey, e.id).length, 3, 'the input journey is not mutated')
  assert.throws(() => applyNativeGlyphChanges(journey, scene.id, [{kind: 'step-duplicate', entity_id: e.id, step_id: 'state-gone'}]))
})

test('Remove takes the selected states out and keeps the rest in order; it never takes the last state', () => {
  const {journey, scene, e} = fixture(4)
  const steps = stepsOf(applyNativeGlyphChanges(journey, scene.id, [{kind: 'step-remove', entity_id: e.id, step_ids: ['state-1', 'state-3']}]), e.id)
  assert.deepEqual(steps.map(step => step.id), ['state-0', 'state-2'])
  assert.throws(() => applyNativeGlyphChanges(journey, scene.id, [{kind: 'step-remove', entity_id: e.id, step_ids: ['state-0', 'state-1', 'state-2', 'state-3']}]))
  assert.equal(stepsOf(journey, e.id).length, 4, 'a refused removal changes nothing')
})

test('Duplicate and Remove are offered on an unlocked sequence, and gated as the owner gates them', () => {
  const {scene, e, step} = fixture()
  const open = markupFor(readingFor(scene, e, step))
  assert.doesNotMatch(buttonTag(open, 'Duplicate'), /disabled=""/)
  assert.doesNotMatch(buttonTag(open, 'Remove'), /disabled=""/)
  const locked = markupFor(readingFor(scene, e, step, {locked: true}))
  for (const label of ['Duplicate', 'Remove']) assert.match(buttonTag(locked, label), /disabled=""/, `${label}: not while locked`)
  const one = fixture(1)
  assert.match(buttonTag(markupFor(readingFor(one.scene, one.e, one.step)), 'Remove'), /disabled=""/, 'Remove: not the last state')
  const full = fixture(32)
  assert.match(buttonTag(markupFor(readingFor(full.scene, full.e, full.step)), 'Duplicate'), /disabled=""/, 'Duplicate: not past 32 states')
})
