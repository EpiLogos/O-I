import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

// O-I 856 (DLW §20.2 Field): "Collisions strike | On · Off | Off | Under On, a collision in the field strikes the torus at the point where it
// happens (§21.2)." The switch is the scene's own composition.collisionsStrike, an optional boolean; the editor admits it as a panel setting
// (beside Symbol voices), the Field's settings read it, and a scene that never set it is Off, the manual's default. The Field device carries
// it in its Sound section beside Symbol voices, and writes it through the editor's panel setting, as it writes Symbol voices.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}

const [{FIELD_PANEL_SETTINGS}, edits, author, model, field] = await Promise.all([
  import('../../../expressions-boundary/src/nativeFieldPanelSettings.ts'),
  import('../../../expressions-boundary/src/nativeDeviceEdits.ts'),
  import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts'),
  import('../src/components/devices/expressionsDevice.ts'),
  import('../src/components/devices/fieldInstrument.ts'),
])
const panel = (key, value) => ({kind: 'panel-setting', key, value})
const fieldInput = composition => {
  const journey = author.blankJourney(), applied = []
  journey.scenes[0].composition = {...journey.scenes[0].composition, ...composition}
  return {applied, input: {reading: {scene: journey.scenes[0]}, devices: {}, sound: {muted: null, mute: null, why: 'no frame'},
    apply: async changes => { applied.push(changes); return {ok: true} }}}
}

test('the editor admits Collisions strike as an On or Off on the scene\'s composition, and refuses anything else', () => {
  assert.deepEqual(FIELD_PANEL_SETTINGS.collisionsStrike, {target: 'composition', type: 'boolean'})
  for (const value of [true, false]) assert.doesNotThrow(() => edits.validateNativeFieldPanelChange(panel('collisionsStrike', value)))
  for (const value of ['on', 'off', 1, 0, null, undefined]) assert.throws(() => edits.validateNativeFieldPanelChange(panel('collisionsStrike', value)), /admitted native Field panel setting/, String(value))
})

test('On is written at composition.collisionsStrike and changes nothing else of the scene; Off writes it back', () => {
  const journey = author.blankJourney(), before = structuredClone(journey)
  const on = edits.applyNativeDeviceChanges(journey, journey.scenes[0].id, [panel('collisionsStrike', true)])
  assert.equal(on.scenes[0].composition.collisionsStrike, true)
  const {collisionsStrike, ...rest} = on.scenes[0].composition
  assert.deepEqual(rest, before.scenes[0].composition, 'only the switch moves')
  assert.deepEqual(journey, before, 'the caller\'s document is not mutated')
  const off = edits.applyNativeDeviceChanges(on, on.scenes[0].id, [panel('collisionsStrike', false)])
  assert.equal(off.scenes[0].composition.collisionsStrike, false)
  assert.doesNotThrow(() => author.validateJourney(structuredClone(off)))
})

test('the Field reads Collisions strike from the scene: On is On, set Off is Off, and a scene that never set it is Off, as the manual says', () => {
  assert.deepEqual(model.expressionsSettingKeys('field'), ['keySource', 'symbolVoices', 'collisionsStrike'])
  assert.equal(model.expressionsSettingChoices('field', 'collisionsStrike'), undefined, 'a switch, not a choice')
  const read = composition => model.expressionsSettingRead('field', 'collisionsStrike', {composition})
  assert.equal(read({collisionsStrike: true}), true)
  assert.equal(read({collisionsStrike: false}), false)
  assert.equal(read({}), false)
})

test('the Field device shows and writes Collisions strike through the editor\'s panel setting, and refuses a value that is not On or Off in words', async () => {
  assert.ok(field.FIELD_SETTINGS.includes('collisionsStrike') && field.FIELD_CONTROLS.includes('collisionsStrike'))
  assert.equal(field.fieldValues(fieldInput({collisionsStrike: true}).input).collisionsStrike, true)
  assert.equal(field.fieldValues(fieldInput({}).input).collisionsStrike, false, 'a scene that never set it reads Off')
  const {input, applied} = fieldInput({})
  assert.equal(field.fieldStanding(input, 'collisionsStrike'), null, 'the Field takes it while a native Expression is open')
  await field.applyFieldChanges(input, [{key: 'collisionsStrike', value: true}])
  assert.deepEqual(applied, [[{kind: 'panel-setting', key: 'collisionsStrike', value: true}]])
  await assert.rejects(field.applyFieldChanges(input, [{key: 'collisionsStrike', value: 'on'}]), /Collisions strike is on or off/)
  assert.match(field.fieldStanding({...input, reading: null}, 'collisionsStrike'), /No native Expression is open/)
  // The design: a toggle named as the manual names it, in the whole view's Sound section beside Symbol voices; a new design default is Off.
  const design = readFileSync(new URL('../src/inhabitants/catalogue/panels/expressions__field.tsx', import.meta.url), 'utf8')
  const sound = design.slice(design.indexOf('<Section label="Sound"'), design.indexOf('<Section label="Time"'))
  assert.match(sound, /label="Symbol voices"[\s\S]*<Toggle \{\.\.\.st\(p, 'collisionsStrike'\)\} label="Collisions strike"/)
  assert.match(sound, /onChange=\{x => p\.set\('collisionsStrike', x\)\}/)
  assert.match(design, /collisionsStrike: false/)
})
