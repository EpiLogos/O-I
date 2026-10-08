import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production browser model, Objects panel and Scene reusable form, in memory with the same loader as the sibling suites.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const boundary = new URL('packages/expressions-boundary/src/', root)
const [model, panel, formations, reuse, {requestNativeMaterialEditor}, {buildReuse}, {kernelDocumentToJourney}] = await Promise.all([
  import(new URL('../src/components/nativeBrowserModel.ts', import.meta.url)),
  import(new URL('../src/components/NativeObjectBrowser.tsx', import.meta.url)),
  import(new URL('nativeFormations.ts', boundary)), import(new URL('reuse.ts', author)),
  import(new URL('materialEditor.ts', boundary)), import(new URL('reuse.ts', author)), import(new URL('kernelDocumentBridge.ts', author)),
])
const nativeDocument = JSON.parse(await readFile(new URL('./fixtures/native-rich-glyph-rack.json', import.meta.url), 'utf8'))

const reading = (count = 0, pending = false) => ({
  basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
  scene: {id: 'scene-1', entities: Array.from({length: count}, (_, i) => ({id: 'e' + i}))},
  standing: {dirty: false, pending, notice: null},
})

test('Objects rows are the add picker shapes, the Force pin and the glyph row, in order, filtered by search', () => {
  const rows = model.objectRows(reading(), '')
  assert.deepEqual(rows.map(row => row.kind), ['text', 'ring', 'disc', 'triangle', 'square', 'force'])
  assert.ok(rows.every(row => !row.full))
  assert.deepEqual(model.objectRows(reading(), 'RING').map(row => row.kind), ['ring'])
  assert.deepEqual(model.objectRows(reading(), 'field').map(row => row.kind), ['force'])
  assert.ok(model.objectRows(reading(32), '').every(row => row.full), 'the 32-entity budget marks every row full')
  assert.ok(model.objectRows(null, '').every(row => !row.full), 'no reading is not a full Scene')
})

test('each Objects row maps to exactly one change that the boundary validator admits', () => {
  assert.deepEqual(model.objectAddChange('text', 'Hi'), {kind: 'formation-add', shape: 'text', text: 'Hi'})
  assert.deepEqual(model.objectAddChange('ring', 'ignored'), {kind: 'formation-add', shape: 'ring'})
  assert.deepEqual(model.objectAddChange('force', 'ignored'), {kind: 'force-insert', position: {x: 0, y: 0, z: 0}})
  for (const row of model.objectRows(reading(), '')) {
    const change = model.objectAddChange(row.kind, '  ')
    if (change.kind === 'formation-add') formations.validateFormationAdd(change)
  }
  assert.equal(formations.validateFormationAdd(model.objectAddChange('text', '   ')).text, 'O')
})

test('the Objects panel renders the creatable rows, the budget and a disabled state at the limit or while pending', () => {
  const render = (rows, value) => renderToStaticMarkup(createElement(panel.NativeObjectBrowser, {rows, reading: value, request: async () => ({ok: true, reading: value})}))
  const open = render(model.objectRows(reading(3), ''), reading(3))
  assert.match(open, /Glyph or word/)
  assert.equal((open.match(/\+ Add to Scene/g) ?? []).length, 6)
  assert.match(open, /3 of 32 formations and pins/)
  assert.doesNotMatch(open, /disabled=""[^>]*aria-label="Add Ring to Scene"/)
  const full = render(model.objectRows(reading(32), ''), reading(32))
  assert.match(full, /32 of 32 formations and pins/)
  assert.equal((full.match(/disabled=""[^>]*aria-label="Add /g) ?? []).length, 6, 'every add is disabled at the limit')
  const pending = render(model.objectRows(reading(1, true), ''), reading(1, true))
  assert.equal((pending.match(/disabled=""[^>]*aria-label="Add /g) ?? []).length, 6, 'a pending owner disables every add')
  const none = render(model.objectRows(null, ''), null)
  assert.doesNotMatch(none, /of 32 formations/)
  assert.match(render([], reading()), /No object matches this search/)
})

test('a Scene reusable form is addressed by the native Scene ref and builds the existing reuse block', () => {
  const rows = [{scene_ref: 'scene:native-a', local_scene_id: 'scene-a'}, {scene_ref: 'scene:native-b', local_scene_id: null}]
  const form = reuse.sceneReuseForm('  Handoff  ', 'scene:native-a', rows)
  assert.deepEqual(form, {kind: 'scene', title: 'Handoff', states: {}, gestures: {}, entrySceneId: 'scene-a', playback: [],
    associations: {workflow_keys: [], task_types: [], skill_set_refs: [], skill_refs: [], event_families: []}})
  assert.throws(() => reuse.sceneReuseForm('  ', 'scene:native-a', rows), /title/)
  assert.throws(() => reuse.sceneReuseForm('x'.repeat(257), 'scene:native-a', rows), /256/)
  assert.throws(() => reuse.sceneReuseForm('Handoff', 'scene:native-b', rows), /native binding/)
  assert.throws(() => reuse.sceneReuseForm('Handoff', 'scene:absent', rows), /native binding/)
  const journey = kernelDocumentToJourney(structuredClone(nativeDocument)).journey
  const block = buildReuse(journey, form, {scene: id => id === 'scene-a' ? 'scene:native-a' : undefined, entity: () => undefined})
  assert.equal(block.schema, 'oi.expression-reuse/v1')
  assert.equal(block.kind, 'scene'); assert.equal(block.entry_scene_ref, 'scene:native-a'); assert.equal(block.title, 'Handoff')
  assert.equal('playback' in block, false)
})

test('the save request reaches the existing saveReusable owner with the exact basis and form', async () => {
  const basis = {expression_ref: 'expr:fixture', revision: 4, scene_ref: 'scene:native-a', authored_revision: 9}
  const form = reuse.sceneReuseForm('Handoff', 'scene:native-a', [{scene_ref: 'scene:native-a', local_scene_id: 'scene-a'}])
  const calls = []
  const controller = {saveReusable: async input => {calls.push(input); return {outcome: {state: 'saved', file: {location: {path: 'Work/O-I/handoff.expression.json'}}}, copy_ref: 'expression:material-handoff-1'}}}
  const result = await requestNativeMaterialEditor(controller, {operation: 'material', basis, action: 'save-reusable', input: {form}}, () => basis)
  assert.equal(result.kind, 'saved')
  assert.equal(result.receipt.copy_ref, 'expression:material-handoff-1')
  assert.deepEqual(calls, [{form, basis}])
  await assert.rejects(requestNativeMaterialEditor(controller, {operation: 'material', basis: {...basis, revision: 5}, action: 'save-reusable', input: {form}}, () => basis), /destination changed/)
  assert.equal(calls.length, 1, 'a stale basis never reaches the owner')
})
