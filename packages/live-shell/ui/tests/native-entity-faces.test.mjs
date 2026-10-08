import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production entity registry, device catalogue, rack model and editor in memory (same loader as native-device-rack.test.mjs).
// The reading is a minimal fixture; it is not a native owner or a saved receipt. The fixture registry entries are passed to the
// shared body as parameters: the real ENTITY_FACE_MODELS / ENTITY_FACE_VIEWS are never mutated.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [registry, views, editors, catalogue, rack, {entityTargets, NATIVE_BINDINGS}] = await Promise.all([
  import('../src/components/nativeEntityFaceModel.ts'),
  import('../src/components/nativeEntityFaceViews.tsx'),
  import('../src/components/NativeDeviceEditors.tsx'),
  import('../src/components/nativeDeviceCatalogue.ts'),
  import('../src/components/nativeDeviceRackModel.ts'),
  import(parameters),
])

const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
const pin = (over = {}) => ({id: 'force-1', name: 'Pin A', kind: 'pin', enabled: true, position: {x: 0, y: 0, z: 0}, size: {x: 1, y: 1},
  rotation: 0, shape: 'circle', text: '', share: 1, tint: '#000', tintWeight: 1, locked: false, station: null,
  force: {kind: 'attract', strength: 2.5, radius: 1.25, spin: 0}, sequence: {enabled: false, clock: 'seconds', steps: []}, ...over})
function reading({selection = [], entities = [pin()], devices = []} = {}) {
  const scene = {name: 'Fixture', entities, automation: [], engine: {...ENGINE}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices,
    selection: {entity_ids: selection, step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const shown = value => String(Number(value.toFixed(4)))
const noop = async () => ({ok: true})
const FORCE_PATHS = ['forces.strength', 'forces.spin', 'forces.radius', 'x', 'y', 'z']

test('the entity families are Force plus exactly the registered entity devices, in the catalogue as well', () => {
  const registered = Object.keys(registry.ENTITY_FACE_MODELS)
  assert.deepEqual(registry.entityFamilies(), ['force', ...registered])
  assert.deepEqual(catalogue.deviceCatalogue().filter(device => device.scope === 'entity').map(device => device.family).sort(), ['force', ...registered].sort())
})

test('the Entity editor shows Force; with no registered entity devices there is no family selector and an unknown family falls back to Force', () => {
  const hasRegistry = Object.keys(registry.ENTITY_FACE_MODELS).length > 0
  for (const family of ['force', 'formation']) {
    if (hasRegistry && family === 'formation') continue // a registered family renders its own panel (covered by its device test)
    const html = renderToStaticMarkup(createElement(editors.NativeDeviceEditors, {
      reading: reading({selection: ['force-1']}), request: async () => ({ok: false, error: 'x'}), requested: {scope: 'entity', family, nonce: 1}}))
    assert.match(html, /native-force-device/, `${family} renders the Force editor`)
    if (hasRegistry) assert.match(html, /aria-label="Entity device family"/, 'registered entity devices get a family selector')
    else assert.doesNotMatch(html, /aria-label="Entity device family"/, 'no family selector without registry entries')
  }
})

test('the shared entity body renders a registry family: shell, grouped controls through renderControl, then the view output', () => {
  const models = {fixture: {name: 'Fixture', paths: ['forces.strength', 'x'], groups: [{title: 'Strength', paths: ['forces.strength']}, {title: 'Centre', paths: ['x'], note: 'Stage units'}],
    compact: ['forces.strength'], enabled: () => true, strip: {summary: () => 'fixture', toggle: null}}}
  const fixtureViews = {fixture: {render: ctx => createElement('p', {className: 'fixture-view'}, `view for ${ctx.entity.name}`, ctx.renderControl('x'))}}
  const body = (family, extra = {}) => renderToStaticMarkup(createElement(views.EntityFaceBody, {family, models, views: fixtureViews,
    reading: reading({selection: ['force-1']}), entity: pin(), disabled: false, apply: noop,
    renderControl: suffix => createElement('span', {className: 'ctl'}, `CTL:${suffix}`), ...extra}))
  assert.deepEqual(registry.entityFamilies(models), ['force', 'fixture'])
  const html = body('fixture')
  assert.match(html, /class="native-device native-entity-device" aria-label="Fixture"/)
  assert.match(html, /<strong>Fixture<\/strong>/)
  assert.match(html, /aria-label="Strength"/)
  assert.match(html, /aria-label="Centre"/)
  assert.match(html, /Stage units/)
  assert.match(html, /<span class="ctl">CTL:forces\.strength<\/span>/)
  assert.match(html, /<p class="fixture-view">view for Pin A<span class="ctl">CTL:x<\/span><\/p>/)
  assert.equal(body('missing'), '', 'an unknown family renders nothing')
})

test('EntityControl renders the entity parameter label, unit and live value for forces.strength', () => {
  const r = reading({selection: ['force-1']})
  const entity = r.scene.entities[0]
  const row = entityTargets(r.scene).find(item => item.entityId === 'force-1' && item.key === 'forces.strength')
  assert.ok(row, 'the entity has a forces.strength target')
  const html = renderToStaticMarkup(createElement(editors.EntityControl, {reading: r, entity, family: 'force', suffix: 'forces.strength',
    disabled: false, apply: noop, captureCurrent: () => () => true}))
  assert.match(html, new RegExp(`aria-label="${esc(row.label)}"`))
  assert.match(html, new RegExp(`<small>${esc(row.unit ?? '')}</small>`))
  assert.match(html, new RegExp(`value="${esc(shown(row.value))}"`))
  assert.equal(shown(row.value), '2.5')
  assert.equal(renderToStaticMarkup(createElement(editors.EntityControl, {reading: r, entity, family: 'force', suffix: 'no.such',
    disabled: false, apply: noop, captureCurrent: () => () => true})), '', 'an unknown suffix renders nothing')
})

test('catalogue: Force is an entity device with the six entity parameters, three compact controls and the Studio section it opens', () => {
  const force = catalogue.deviceCatalogue().find(device => device.family === 'force')
  assert.equal(force.scope, 'entity')
  assert.equal(force.name, 'Force')
  assert.deepEqual([...force.paths].sort(), [...FORCE_PATHS].sort())
  assert.deepEqual(force.compact, ['forces.strength', 'forces.radius', 'forces.spin'])
  assert.equal(force.studio, 'formations', 'the Objects panel is the formations section (studioSections.ts)')
  assert.equal(force.toggle, null)
  // Every Force path is a real entity parameter of an entity, not a Field binding.
  const keys = new Set(entityTargets(reading({selection: ['force-1']}).scene).map(row => row.key))
  for (const path of FORCE_PATHS) assert.ok(keys.has(path), `${path} is an entity target`)
  assert.ok(!NATIVE_BINDINGS.some(row => row.path === 'forces.strength'))
  // Enable light: undefined without one selected object, the Force card's own rule with one.
  assert.equal(force.enabled(reading()), undefined)
  assert.equal(force.enabled(reading({selection: ['force-1']})), true)
  assert.equal(force.enabled(reading({selection: ['force-1'], entities: [pin({enabled: false})]})), false)
  assert.equal(force.enabled(reading({selection: ['force-1'], entities: [pin({force: {kind: 'none', strength: 0, radius: 1, spin: 0}})]})), false)
  assert.match(force.summary(reading({selection: ['force-1']})), /attract · strength 2\.5 · radius 1\.25/)
  assert.match(force.summary(reading()), /Select one object/)
})

test('rack widgets: an entity widget targets the selected object by name with its live controls; no selection gives no target and no controls', () => {
  const selected = rack.rackWidgets(reading({selection: ['force-1'], devices: [{id: 'force-a', family: 'force'}]}))[0]
  assert.equal(selected.scope, 'entity')
  assert.equal(selected.target, 'Pin A')
  assert.deepEqual(selected.compact.map(control => control.path), ['entity:force-1:forces.strength', 'entity:force-1:forces.radius', 'entity:force-1:forces.spin'])
  assert.equal(selected.compact[0].value, 2.5)
  const idle = rack.rackWidgets(reading({devices: [{id: 'force-a', family: 'force'}]}))[0]
  assert.equal(idle.target, null)
  assert.deepEqual(idle.compact, [])
  assert.equal(idle.on, undefined)
  const field = rack.rackWidgets(reading({selection: ['force-1'], devices: [{id: 'medium-1', family: 'medium'}]}))[0]
  assert.equal(field.scope, 'field')
  assert.equal(field.target, null)
})

test('addable devices: an entity device stays addable when placed; a placed Field family is not', () => {
  const families = rack.addableDevices(reading({devices: [{id: 'force-a', family: 'force'}, {id: 'medium-1', family: 'medium'}]})).map(device => device.family)
  assert.ok(families.includes('force'))
  assert.ok(!families.includes('medium'))
})
