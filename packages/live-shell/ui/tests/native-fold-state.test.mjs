import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {readFileSync} from 'node:fs'

// Production Mark profile device in memory, same loader as the sibling native tests (.tsx transpiled, .css stubbed).
// The readings are minimal fixtures; they are not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)

// Fold into an earlier object (app.ts 'fold-state' and 'confirm-fold'), and the ink device's Material row.
// Server rendering covers each stage's markup; the choices and the single apply are pure builders checked against the boundary validators.
const [picker, face, fold, style, editorSource] = await Promise.all([
  import('../src/components/FoldStatePicker.tsx'),
  import('../src/components/NativeFieldFace.ink.tsx'),
  import('../../../expressions-boundary/src/nativeStateFold.ts'),
  import('../../../expressions-boundary/src/nativeFieldStyle.ts'),
  readFile(new URL('../src/components/GlyphSequenceEditor.tsx', import.meta.url), 'utf8'),
])
const {FoldStateView, foldChange, foldDestinationKey, foldDestinationLabel, FOLD_MODE_LABELS} = picker
const {InkMaterial, materialChange} = face
const {validateNativeFoldChange, FOLD_MODES} = fold
const {validateNativeFieldMaterialChange} = style
const {createElement: h} = await import('react')
const TARGETS = [
  {scene_id: 'scene-opening', scene_title: 'Opening', entity_id: 'target-entity', entity_name: 'Target', steps: 1},
  {scene_id: 'scene-intro', scene_title: 'Intro', entity_id: 'halo-entity', entity_name: 'Halo', steps: 4},
]
const noop = () => {}
const BASE = {stage: 'closed', targets: TARGETS, destination: 'scene-opening|target-entity', mode: 'seconds', removeSource: false, stateLabel: 'State 2',
  sourceName: 'Source', disabled: false, pending: false, fault: null, onStage: noop, onDestination: noop, onMode: noop, onRemoveSource: noop, onConfirm: noop}
const render = props => renderToStaticMarkup(h(FoldStateView, {...BASE, ...props})).replace(/<!-- -->/g, '')

test('the closed stage offers the fold only where an earlier formation exists, with the reason when it does not', () => {
  const open = render({})
  assert.match(open, /<button type="button" title="Copy this state into an earlier Scene’s formation">Fold into earlier object…<\/button>/)
  const none = render({targets: []})
  assert.match(none, /<button type="button" disabled="" title="No earlier Scene has an unlocked formation with room for another state">Fold into earlier object…<\/button>/)
  assert.match(render({disabled: true}), /<button type="button" disabled="" title="Copy this state/)
})

test('the choose stage names each destination and playback mode, and offers Review only with a destination', () => {
  const html = render({stage: 'choose'})
  assert.match(html, /<div class="fold-state" role="group" aria-label="Fold this state">/)
  assert.match(html, /<option value="scene-opening\|target-entity"[^>]*>Opening \/ Target<\/option>/)
  assert.match(html, /<option value="scene-intro\|halo-entity"[^>]*>Intro \/ Halo<\/option>/)
  for (const mode of FOLD_MODES) assert.match(html, new RegExp(`<option value="${mode}"[^>]*>${FOLD_MODE_LABELS[mode]}</option>`))
  assert.match(html, /Remove this state here after adding/)
  assert.match(html, /<button type="button">Review fold<\/button>/)
  assert.match(render({stage: 'choose', destination: ''}), /<button type="button" disabled="">Review fold<\/button>/)
})

test('the confirm stage states exactly what is added, and only its Confirm button sends the change', () => {
  const html = render({stage: 'confirm', removeSource: true, mode: 'morph'})
  assert.match(html, /<div class="fold-state" role="group" aria-label="Confirm fold"><p>Copy State 2 of Source into Opening \/ Target\. It adds one state to that formation’s sequence, and this state is removed from here\. Undo restores it\.<\/p>/)
  assert.match(html, /<button type="button">Confirm fold<\/button>/)
  assert.match(render({stage: 'confirm', pending: true}), /<button type="button" disabled="">Confirm fold<\/button>/)
  assert.match(render({stage: 'confirm', removeSource: false}), /Copy State 2 of Source into Opening \/ Target\. It adds one state to that formation’s sequence\. Undo restores it\./)
})

test('an owner refusal stays in a role=alert line on every stage', () => {
  const refusal = 'Unlock the destination formation first.'
  for (const stage of ['closed', 'choose', 'confirm']) assert.match(render({stage, fault: refusal}), new RegExp(`<p role="alert" class="glyph-option-alert">${refusal}</p>`))
})

test('the picker source has no native confirmation dialog, and the glyph editor places it beside the state actions', () => {
  const picker_src = readFileSync(new URL('../src/components/FoldStatePicker.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(picker_src, /window\.confirm\s*\(/)
  assert.match(editorSource, /import \{FoldStatePicker\} from '\.\/FoldStatePicker';/)
  assert.match(editorSource, /<FoldStatePicker reading=\{r\} request=\{request\} entityId=\{e\.id\} stepId=\{k\.id\} stepIndex=\{sequence\.steps\.indexOf\(k\)\} disabled=\{locked\} isPresented=\{isPresented\}\/>/)
})

test('each fold is one admitted change, carrying the chosen destination, playback and removal, and the boundary accepts it', () => {
  const change = foldChange('source-entity', 'source-1', TARGETS[0], 'morph', true)
  assert.deepEqual(change, {kind: 'state-fold', entity_id: 'source-entity', step_id: 'source-1', target_entity_id: 'target-entity', mode: 'morph', remove_source: true})
  assert.deepEqual(validateNativeFoldChange(change), change)
  assert.equal(foldDestinationKey(TARGETS[1]), 'scene-intro|halo-entity')
  assert.equal(foldDestinationLabel(TARGETS[1]), 'Intro / Halo')
  assert.deepEqual(Object.keys(FOLD_MODE_LABELS), [...FOLD_MODES])
})

test('the Material row marks the Scene’s own material and sends one field-material change per card', async () => {
  const reading = {scene: {field: {material: 'print'}}}
  const html = renderToStaticMarkup(h(InkMaterial, {reading, disabled: false, apply: async () => ({ok: true})}))
  assert.match(html, /<div class="ink-material" role="group" aria-label="Field material"><span>Material<\/span>/)
  assert.match(html, /<button type="button" aria-pressed="false">Ink<\/button>/)
  assert.match(html, /<button type="button" aria-pressed="true">Print<\/button>/)
  assert.match(html, /<button type="button" aria-pressed="false">Rounded<\/button>/)
  const off = renderToStaticMarkup(h(InkMaterial, {reading, disabled: true, apply: async () => ({ok: true})}))
  assert.equal((off.match(/disabled=""/g) ?? []).length, 3)
  assert.deepEqual(materialChange('round'), {kind: 'field-material', value: 'round'})
  assert.deepEqual(validateNativeFieldMaterialChange(materialChange('round')), {kind: 'field-material', value: 'round'})
  assert.throws(() => validateNativeFieldMaterialChange(materialChange('paper')), /admitted Field material/)
})
