import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// ME2 (DLW §20.2 Field): "Symbol voices | On · Off | On | Lets symbols carry the torus's sound to where they stand." The switch is the scene's own
// composition.symbolVoices, an optional boolean; the editor admits it as a panel setting (beside ME1's Key source), the Field's settings read it,
// and an absent switch means On, which is the manual's own meaning of a scene that never set it. Off changes no symbol's block.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}

const [{FIELD_PANEL_SETTINGS}, edits, author, model] = await Promise.all([
  import('../../../expressions-boundary/src/nativeFieldPanelSettings.ts'),
  import('../../../expressions-boundary/src/nativeDeviceEdits.ts'),
  import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts'),
  import('../src/components/devices/expressionsDevice.ts'),
])
const panel = (key, value) => ({kind: 'panel-setting', key, value})
const withVoice = () => {
  const journey = author.blankJourney()
  const symbol = author.entity('Root', 'O')
  symbol.sound = {enabled: true, carry: {kind: 'mode', ref: 'maqam/00'}, gain: 0.3}
  journey.scenes[0].entities = [symbol]
  return journey
}

test('the editor admits Symbol voices as an On or Off on the scene\'s composition, and refuses anything else', () => {
  assert.deepEqual(FIELD_PANEL_SETTINGS.symbolVoices, {target: 'composition', type: 'boolean'})
  for (const value of [true, false]) assert.doesNotThrow(() => edits.validateNativeFieldPanelChange(panel('symbolVoices', value)))
  for (const value of ['on', 'off', 1, 0, null, undefined]) assert.throws(() => edits.validateNativeFieldPanelChange(panel('symbolVoices', value)), /admitted native Field panel setting/, String(value))
})

test('Off is written at composition.symbolVoices and changes no symbol\'s block; On writes it back', () => {
  const journey = withVoice(), before = structuredClone(journey), blocks = structuredClone(journey.scenes[0].entities)
  const off = edits.applyNativeDeviceChanges(journey, journey.scenes[0].id, [panel('symbolVoices', false)])
  assert.equal(off.scenes[0].composition.symbolVoices, false)
  assert.deepEqual(off.scenes[0].entities, blocks, 'every symbol\'s block is as it was: Off silences the voices, it does not edit them')
  assert.deepEqual(journey, before, 'the caller\'s document is not mutated')
  const on = edits.applyNativeDeviceChanges(off, off.scenes[0].id, [panel('symbolVoices', true)])
  assert.equal(on.scenes[0].composition.symbolVoices, true)
  assert.doesNotThrow(() => author.validateJourney(structuredClone(on)))
})

test('the Field reads Symbol voices from the scene: Off is Off, set On is On, and a scene that never set it means On, as the manual says', () => {
  assert.deepEqual(model.expressionsSettingKeys('field'), ['keySource', 'symbolVoices'])
  assert.equal(model.expressionsSettingChoices('field', 'symbolVoices'), undefined, 'a switch, not a choice')
  const read = composition => model.expressionsSettingRead('field', 'symbolVoices', {composition})
  assert.equal(read({symbolVoices: false}), false)
  assert.equal(read({symbolVoices: true}), true)
  assert.equal(read({}), true)
})
