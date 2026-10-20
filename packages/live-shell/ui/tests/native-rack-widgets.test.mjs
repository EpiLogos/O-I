import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Entity and scene rack widgets: the compact resolution, the whole-sound change shapes, the scene action row, the target states and the
// rendered controls. Same in-memory loader as the sibling rack tests. No DOM is available, so pointer and key gestures are covered by
// the pure math they call (nativeFieldHandleModel) and by the exact change each commits.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [model, {NATIVE_BINDINGS, bindValue, entityTargets}, rack, entityModel, sound, handle] = await Promise.all([
  import('../src/components/nativeDeviceRackModel.ts'),
  import(parameters),
  import('../src/components/NativeDeviceRack.tsx'),
  import('../src/components/nativeEntityFaceModel.ts'),
  import('../src/components/nativeEntityFace.sound.ts'),
  import('../src/components/nativeFieldHandleModel.ts'),
])
const {rackWidgets, entitySoundControlChange, entityParameterChange, NO_SOUND_NOTE, LOCKED_OBJECT_NOTE} = model
const SOUND = {enabled: true, carry: {kind: 'mode', ref: 'maqam/00'}, gain: 0.5, attack: 0.1, release: 0.9}
const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
const force = (over = {}) => ({id: 'force-1', name: 'Pin A', kind: 'pin', enabled: true, position: {x: 0, y: 0, z: 0}, size: {x: 1, y: 1},
  rotation: 0, shape: 'circle', text: '', share: 1, tint: '#000', tintWeight: 1, locked: false, station: null,
  force: {kind: 'attract', strength: 2.5, radius: 1.25, spin: 0}, sequence: {enabled: false, clock: 'seconds', steps: []}, ...over})
function reading({selection = [], entities = [force()], devices = [], text, pending = false} = {}) {
  const scene = {name: 'Fixture', entities, engine: {...ENGINE}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  if (text !== undefined) scene.text = text
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices,
    selection: {entity_ids: selection, step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending, notice: null},
  }
}
const placed = (...families) => families.map(family => ({id: `${family}-1`, family}))
const widget = (r, family) => rackWidgets(r).find(row => row.family === family)
const NEVER = async () => ({ok: false, error: 'x'})
const render = r => renderToStaticMarkup(createElement(rack.NativeDeviceRack, {reading: r, request: NEVER, onOpen() {}}))

test('entity compact: registry rows are the selected object\'s entity targets; with no selection there are none', () => {
  const r = reading({devices: placed('formation'), selection: ['force-1']})
  const w = widget(r, 'formation')
  assert.equal(w.scope, 'entity')
  assert.equal(w.entityId, 'force-1')
  assert.equal(w.target, 'Pin A')
  assert.ok(w.compact.length > 0 && w.compact.length <= 4)
  const targets = new Map(entityTargets(r.scene).map(row => [row.target, row]))
  for (const control of w.compact) {
    assert.match(control.path, /^entity:force-1:/)
    const row = targets.get(control.path)
    assert.ok(row, control.path)
    assert.equal(control.label, row.label)
    assert.equal(control.value, row.value)
    assert.equal(control.min, row.min)
    assert.equal(control.hardMax, row.hardMax)
  }
  const idle = widget(reading({devices: placed('formation')}), 'formation')
  assert.deepEqual(idle.compact, [])
  assert.deepEqual(idle.entityCompact, [])
  assert.equal(idle.target, null)
  assert.equal(idle.entityId, null)
})

test('entity lock: a locked selected object marks its widget locked; the target is still that object', () => {
  const r = reading({devices: placed('formation'), selection: ['force-1'], entities: [force({locked: true})]})
  const w = widget(r, 'formation')
  assert.equal(w.locked, true)
  assert.equal(w.target, 'Pin A')
  assert.equal(widget(reading({devices: placed('formation'), selection: ['force-1']}), 'formation').locked, false)
  const html = render(r)
  assert.ok(html.includes(LOCKED_OBJECT_NOTE))
  assert.match(html, /<svg[^>]*role="slider"[^>]*aria-disabled="true"/)
})

test('sound compact: gain and what the voice carries are the object sound, with the validator bounds', () => {
  const w = widget(reading({devices: placed('sound'), selection: ['force-1'], entities: [force({sound: SOUND})]}), 'sound')
  assert.deepEqual(w.entityCompact.map(row => row.field), ['gain', 'carry'])
  const [gain, carry] = w.entityCompact
  assert.equal(gain.blocked, null)
  assert.equal(gain.control.value, 0.5)
  assert.equal(gain.control.min, 0)
  assert.equal(gain.control.max, 1)
  assert.equal(gain.control.step, 0.01)
  // A parenthesised unit is a description, not a suffix.
  assert.equal(gain.control.unit, '')
  assert.equal(carry.value, 'mode:maqam/00', 'the carry is one option value: its kind and the catalogue\'s own key')
  assert.equal(carry.blocked, null)
})

test('sound compact without a sound: every control is blocked and shows the app defaults', () => {
  const w = widget(reading({devices: placed('sound'), selection: ['force-1']}), 'sound')
  assert.ok(w.entityCompact.length === 2 && w.entityCompact.every(row => row.blocked === NO_SOUND_NOTE))
  assert.equal(w.entityCompact[0].control.value, 0.2)
  assert.equal(w.entityCompact[1].value, '', 'carrying nothing yet')
})

test('entity change shapes: a registry control commits one parameter by its target; a sound control commits one whole sound', () => {
  const r = reading({devices: placed('sound'), selection: ['force-1'], entities: [force({sound: SOUND})]})
  const gain = entitySoundControlChange(r, 'gain', 0.8)
  assert.equal(gain.kind, 'entity-sound')
  assert.equal(gain.entity_id, 'force-1')
  assert.equal(gain.sound.gain, 0.8)
  // The rest of the object's sound travels with the one changed field.
  assert.deepEqual(gain.sound.carry, {kind: 'mode', ref: 'maqam/00'})
  assert.equal(gain.sound.release, 0.9)
  const named = entitySoundControlChange(r, 'carry', 'name:shem')
  assert.deepEqual(named.sound.carry, {kind: 'name', ref: 'shem'})
  assert.equal(named.sound.gain, 0.5)
  const none = entitySoundControlChange(r, 'carry', '')
  assert.equal('carry' in none.sound, false, 'None yet clears the carry')
  for (const sent of [gain, named, none]) for (const gone of ['frequencyHz', 'followCymatic', 'waveform', 'pan']) assert.equal(gone in sent.sound, false, `${gone} is never sent`)
  assert.throws(() => entitySoundControlChange(r, 'gain', 3))
  assert.throws(() => entitySoundControlChange(r, 'carry', 'oscillator:x'))
  assert.throws(() => entitySoundControlChange(reading({devices: placed('sound')}), 'gain', 0.5), /Select one object/)
})

test('sound stepper and entity keys: one step, Shift x10, bounds, Home returns the app default', () => {
  const attack = sound.soundNumberSpec('attack')
  assert.equal(sound.steppedValue(attack, 0.1, 1, false), 0.11)
  assert.equal(sound.steppedValue(attack, 0.5, -1, true), 0.4)
  assert.equal(sound.steppedValue(attack, 0, -1, false), null)
  assert.match(sound.numberProblem(attack, 11), /^Attack must be from 0 to 10 s\.$/)
  assert.equal(sound.numberProblem(attack, 2), null)
  assert.ok(Number.isNaN(sound.parseNumberText('  ')))
  // The entity bar's keys run the same field math as the Field handle, on the entity's own bounds.
  const gain = widget(reading({devices: placed('sound'), selection: ['force-1'], entities: [force({sound: SOUND})]}), 'sound').entityCompact[0].control
  assert.equal(handle.keyboardValue(gain, 0.5, 'ArrowRight', false), 0.51)
  assert.equal(handle.keyboardValue(gain, 0.5, 'ArrowLeft', true), 0.4)
  assert.equal(handle.keyboardValue(gain, 1, 'ArrowUp', false), 1)
  assert.equal(handle.resetValue(gain), 0.2)
})

test('scene widget: the presented Scene is the target; its action carries the exact changes and a disabled reason', () => {
  const w = widget(reading({devices: placed('text'), text: []}), 'text')
  assert.equal(w.scope, 'scene')
  assert.equal(w.target, 'Fixture')
  assert.equal(w.entityId, null)
  assert.equal(w.locked, false)
  assert.equal(w.actions.length, 1)
  assert.equal(w.actions[0].label, 'Add layer')
  assert.deepEqual(w.actions[0].changes, [{kind: 'text-layer-add'}])
  assert.equal(w.actions[0].disabled, null)
  const undisclosed = widget(reading({devices: placed('text')}), 'text')
  assert.equal(undisclosed.actions[0].disabled, 'Page text is not disclosed by this reading')
})

test('SSR: an entity widget with a selected object names its target and labels each control', () => {
  const html = render(reading({devices: placed('formation'), selection: ['force-1']}))
  assert.match(html, /Target · Pin A/)
  for (const control of widget(reading({devices: placed('formation'), selection: ['force-1']}), 'formation').compact) {
    assert.ok(html.includes(`aria-label="${control.label}"`), control.label)
  }
  assert.doesNotMatch(html, /Select an object to act on it/)
})

test('SSR: with no selected object the entity widget shows the disabled Select an object state and no controls', () => {
  const html = render(reading({devices: placed('sound')}))
  assert.match(html, /aria-disabled="true">Select an object to act on it</)
  assert.doesNotMatch(html, /role="slider"/)
  assert.doesNotMatch(html, /aria-label="Name or mode"/)
})

test('SSR: a sound with a sound renders gain as a slider and the voice\'s carry as a select of the store; no frequency, waveform or pan control', () => {
  const html = render(reading({devices: placed('sound'), selection: ['force-1'], entities: [force({sound: SOUND})]}))
  assert.match(html, /<svg[^>]*role="slider"[^>]*aria-label="Gain"/)
  assert.match(html, /<select class="native-rack-select" aria-label="Name or mode"/)
  assert.match(html, /<option value="" selected="">None yet<\/option>|<option value="">None yet<\/option>/)
  for (const gone of ['Frequency', 'Waveform', 'Pan']) assert.doesNotMatch(html, new RegExp(`aria-label="[^"]*${gone}`), `${gone} is gone with the oscillator`)
  assert.doesNotMatch(html, new RegExp(NO_SOUND_NOTE))
})

test('SSR: a sound with no sound states it, and its controls are disabled', () => {
  const html = render(reading({devices: placed('sound'), selection: ['force-1']}))
  assert.ok(html.includes(NO_SOUND_NOTE))
  assert.match(html, /<svg[^>]*role="slider"[^>]*aria-label="Gain"[^>]*aria-disabled="true"/)
  assert.match(html, /aria-label="Name or mode"[^>]*disabled=""/)
})

test('SSR: a scene widget shows its Scene target and its action as a labelled button; an undisclosed action states why', () => {
  const html = render(reading({devices: placed('text'), text: []}))
  assert.match(html, /Scene · Fixture/)
  assert.match(html, /role="group" aria-label="[^"]*actions"/)
  assert.match(html, /class="native-rack-action"[^>]*>Add layer<\/button>/)
  assert.doesNotMatch(html, /title="Open settings"/, 'a scene title does not open an entity or field pool')
  const undisclosed = render(reading({devices: placed('text')}))
  assert.match(undisclosed, /class="native-rack-action" title="Page text is not disclosed by this reading"[^>]*disabled=""/)
})
