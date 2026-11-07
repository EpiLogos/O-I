import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

// O-I #747 round 885, Pulse, now that the beat exists (DLW build ruling 2026-11-06): the Field's "Pulse | On · Off | Off | Pulses the field
// on the beat" (DLW §20.2, in the whole view's Time group: "Tempo, Hold to change, Pulse"), and the transport's Metronome in Expressions,
// "Pulse the field" (§10.5; §20.2 Transport "Metronome | Pulses the field"). One switch: the scene's composition.pulse, an optional boolean,
// Off when absent. The editor admits it as a panel setting (as Collisions strike); the Field reads and writes it there; the transport's
// Metronome lights while it is On and a press asks the owner for the other. SCRIPTED: pure modules and FIXTURE readings; no frame.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}

const [{FIELD_PANEL_SETTINGS}, edits, author, model, field, playback, address] = await Promise.all([
  import('../../../expressions-boundary/src/nativeFieldPanelSettings.ts'),
  import('../../../expressions-boundary/src/nativeDeviceEdits.ts'),
  import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts'),
  import('../src/components/devices/expressionsDevice.ts'),
  import('../src/components/devices/fieldInstrument.ts'),
  import('../src/components/nativeScenePlayback.ts'),
  import('../../../expressions-boundary/src/parameterAddress.ts'),
])
const panel = (key, value) => ({kind: 'panel-setting', key, value})
const fieldInput = composition => {
  const journey = author.blankJourney(), applied = []
  journey.scenes[0].composition = {...journey.scenes[0].composition, ...composition}
  return {applied, input: {reading: {scene: journey.scenes[0]}, devices: {}, sound: {muted: null, mute: null, why: 'no frame'},
    apply: async changes => { applied.push(changes); return {ok: true} }}}
}

test('r885: the editor admits Pulse as an On or Off on the scene\'s composition, and refuses anything else', () => {
  assert.deepEqual(FIELD_PANEL_SETTINGS.pulse, {target: 'composition', type: 'boolean'})
  for (const value of [true, false]) assert.doesNotThrow(() => edits.validateNativeFieldPanelChange(panel('pulse', value)))
  for (const value of ['on', 1, null, undefined]) assert.throws(() => edits.validateNativeFieldPanelChange(panel('pulse', value)), /admitted native Field panel setting/, String(value))
  const journey = author.blankJourney(), before = structuredClone(journey)
  const on = edits.applyNativeDeviceChanges(journey, journey.scenes[0].id, [panel('pulse', true)])
  assert.equal(on.scenes[0].composition.pulse, true)
  const {pulse, ...rest} = on.scenes[0].composition
  assert.deepEqual(rest, before.scenes[0].composition, 'only the switch moves')
  assert.doesNotThrow(() => author.validateJourney(structuredClone(edits.applyNativeDeviceChanges(on, on.scenes[0].id, [panel('pulse', false)]))))
  assert.deepEqual(address.parameterAddresses(panel('pulse', true)).addresses, [{family: 'field', deviceInstance: null, key: 'pulse', type: 'boolean', writePath: 'composition.pulse'}],
    'addressed as the Field\'s, written at composition.pulse')
})

test('r885: the Field reads Pulse from the scene, Off when it never set it, and writes it through the editor\'s panel setting', async () => {
  assert.deepEqual(model.expressionsSettingKeys('field'), ['keySource', 'symbolVoices', 'collisionsStrike', 'pulse'])
  const read = composition => model.expressionsSettingRead('field', 'pulse', {composition})
  assert.deepEqual([read({pulse: true}), read({pulse: false}), read({})], [true, false, false])
  assert.ok(field.FIELD_SETTINGS.includes('pulse') && field.FIELD_CONTROLS.includes('pulse'))
  assert.equal(field.fieldValues(fieldInput({pulse: true}).input).pulse, true)
  assert.equal(field.fieldValues(fieldInput({}).input).pulse, false)
  const {input, applied} = fieldInput({})
  assert.equal(field.fieldStanding(input, 'pulse'), null)
  await field.applyFieldChanges(input, [{key: 'pulse', value: true}])
  assert.deepEqual(applied, [[{kind: 'panel-setting', key: 'pulse', value: true}]])
  await assert.rejects(field.applyFieldChanges(input, [{key: 'pulse', value: 'on'}]), /Pulse is on or off\./)
  // The design: a toggle named as the manual names it, in the whole view's Time section after Hold to change; a new design default is Off.
  const design = readFileSync(new URL('../src/inhabitants/catalogue/panels/expressions__field.tsx', import.meta.url), 'utf8')
  const time = design.slice(design.indexOf('<Section label="Time"'))
  const timeSection = time.slice(0, time.indexOf('</Section>'))
  assert.match(timeSection, /<Toggle \{\.\.\.st\(p, 'pulse'\)\} label="Pulse" does="Pulses the field on the beat\."/)
  assert.match(timeSection, /onChange=\{x => p\.set\('pulse', x\)\}/)
  assert.match(design, /pulse: false/)
})

test('r885: the transport\'s Metronome is the open scene\'s Pulse: lit while On, a press asks for the other, unread it neither lights nor presses', () => {
  const sent = []
  const off = playback.pulseSlot({on: false, reason: null, send: on => sent.push(on)})
  assert.equal(off.lit, false)
  assert.match(off.title, /^Pulse — the field pulses on the beat of its Tempo: Off\./, 'the slot\'s word in Expressions (modes.ts: pulse)')
  off.press(); assert.deepEqual(sent, [true])
  const on = playback.pulseSlot({on: true, reason: null, send: on => sent.push(on)})
  assert.equal(on.lit, true); on.press(); assert.deepEqual(sent, [true, false])
  const busy = playback.pulseSlot({on: true, reason: 'The native editor is busy or not attached.', send: on => sent.push(on)})
  assert.deepEqual([busy.lit, busy.press, busy.refused], [true, undefined, 'The native editor is busy or not attached.'], 'busy: the light stays, the press waits')
  const unread = playback.pulseSlot({on: undefined, reason: null, send: on => sent.push(on)})
  assert.deepEqual([unread.lit, unread.press], [undefined, undefined])
  assert.match(unread.refused, /has not been read/)
  assert.deepEqual(sent, [true, false])
  const transport = readFileSync(new URL('../src/shell/transports/useExpressionsTransport.tsx', import.meta.url), 'utf8')
  assert.match(transport, /metro: \(\(\) => \{\n\s+const slot = pulseSlot\(\{on: pulseOn, reason: ready \? null : 'The native editor is busy or not attached\.'/)
  assert.match(transport, /actions\.applyChanges\(\[expressionsSettingChange\('field', 'pulse', on\)\]\)/)
})
