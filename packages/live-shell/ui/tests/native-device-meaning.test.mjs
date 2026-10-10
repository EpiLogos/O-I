import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The Entity Meaning device: its registry entry and catalogue row, the pure facts (coupling, falloff, colour, gain), the whole-meaning change shapes through a stub apply, and the server render.
// The reading is a minimal fixture (not a native owner or a saved receipt). The boundary validators are imported, not copied.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)

const [registry, views, catalogue, device, boundary] = await Promise.all([
  import('../src/components/nativeEntityFaceModel.ts'),
  import('../src/components/nativeEntityFaceViews.tsx'),
  import('../src/components/nativeDeviceCatalogue.ts'),
  import('../src/components/nativeEntityFace.meaning.ts'),
  import('../../../expressions-boundary/src/nativeEntitySemantic.ts'),
])
const {meaningFaceModel} = device
const {validateNativeEntitySemanticChange, validateNativeSemanticFieldChange, MEANING_NODE_IDS} = boundary
const {
  DEFAULT_RADIUS_PX, DIAGRAM, MEANING_NUMBERS, addedMapping, authoredGain, contributionColour, discRadius, discStops, falloffKernel, falloffPath,
  fieldChange, forceRadiusOf, meaningChange, meaningSummaryText, newMeaningId, numberProblem, parseNumberText, radiusAtDistance, resolvedRadius,
  withColour, withMappings, withMeaning, withRadius, withResonanceGain,
} = device

const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
const centre = (over = {}) => ({id: 'entity-a', name: 'Heart', kind: 'formation', enabled: true, position: {x: 0, y: 0, z: 0}, size: {x: 1, y: 1},
  rotation: 0, shape: 'yantra', text: '', share: 1, tint: '#336699', tintWeight: 1, locked: false, station: null,
  force: {kind: 'attract', strength: 2, radius: 80, spin: 0}, sequence: {enabled: false, clock: 'seconds', steps: []}, ...over})
const COLOUR = {enabled: true, colorSource: 'canonical', gain: 1, radius: {source: 'force'}, falloff: 'gaussian', metric: 'compositionPlane', blend: 'weighted', activation: 'constant'}
const BINDING = {id: 'semantic-a', semanticNodeId: 'anahata', enabled: true, resonance: {gain: 1}, carriers: [{kind: 'entity', id: 'entity-a'}], color: {...COLOUR}, modulations: []}
const FIELD = {enabled: true, profile: {kind: 'chakra', profileId: 'chakra-seven-v1'}, affinity: {method: 'modalProjection', bandwidth: 0.14}, globalColorGain: 1, bindings: [BINDING]}
/** A reading of one selected object. `field` and `binding` are the Scene's semantic field; `semanticField` is omitted when `field` is null. */
function reading({entities = [centre()], field = structuredClone(FIELD), selection = ['entity-a'], pending = false} = {}) {
  const scene = {name: 'Fixture', entities, automation: [], engine: {...ENGINE}, composition: {plane: 'XY'}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  if (field) scene.semanticField = field
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {'entity-a': 'occ:a'}, chosenControls: {available: false, entries: [], controls: []}, devices: [],
    selection: {entity_ids: selection, step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending, notice: null},
  }
}
const noop = async () => ({ok: true})
const entityOf = r => r.scene.entities.find(e => e.id === 'entity-a')
const SSR = (r = reading(), entity = entityOf(r)) => renderToStaticMarkup(createElement(views.EntityFaceBody, {family: 'meaning', models: registry.ENTITY_FACE_MODELS,
  views: views.ENTITY_FACE_VIEWS, reading: r, entity, disabled: false, apply: noop, renderControl: () => null}))
const ids = html => [...html.matchAll(/<(?:input|select)[^>]*\sid="([^"]+)"/g)].map(m => m[1])

test('the registry carries the meaning family: the entity selector lists it, the catalogue device opens the Objects panel, and the view is registered', () => {
  assert.ok(registry.entityFamilies().includes('meaning'))
  assert.equal(registry.ENTITY_FACE_MODELS.meaning, meaningFaceModel)
  assert.equal(typeof views.ENTITY_FACE_VIEWS.meaning.render, 'function')
  const row = catalogue.deviceCatalogue().find(item => item.family === 'meaning')
  assert.equal(row.scope, 'entity')
  assert.equal(row.name, 'Meaning')
  assert.equal(row.studio, 'formations', 'the semantic panel sits in the Objects tab (inspector.ts entityControls)')
  assert.equal(row.toggle, null)
  assert.deepEqual([...row.paths], [], 'no semantic field is a registry parameter')
  assert.deepEqual([...row.compact], [], 'no compact control can resolve from the registry yet')
})

test('the enable light is the Scene semantic layer flag, only for an object that has a meaning; the summary is one line from its own binding', () => {
  const on = reading(), entity = entityOf(on)
  assert.equal(meaningFaceModel.enabled(on, entity), true)
  assert.equal(meaningFaceModel.enabled(reading({field: {...FIELD, enabled: false}}), entity), false)
  assert.equal(meaningFaceModel.enabled(reading({field: {...FIELD, bindings: []}}), entity), undefined, 'no meaning on this object: no light')
  assert.equal(meaningFaceModel.enabled(reading({field: null}), entity), undefined)
  assert.equal(meaningFaceModel.strip.summary(on, entity), 'Anahata (Heart) · canonical · gain 1')
  assert.equal(meaningFaceModel.strip.summary(reading({field: {...FIELD, bindings: []}}), entity), 'No meaning')
  assert.equal(meaningSummaryText(BINDING, {...FIELD, enabled: false}), 'layer off · Anahata (Heart) · canonical · gain 1')
  assert.equal(meaningSummaryText(withColour(BINDING, {enabled: false}), FIELD), 'Anahata (Heart) · no colour contribution')
  assert.equal(meaningFaceModel.strip.toggle, null)
})

test('the radius coupling is read from the object: follow force radius is the emitter radius (minimum 5), else the engine default 220', () => {
  assert.deepEqual(forceRadiusOf(centre()), {value: 80, emitter: true})
  assert.deepEqual(forceRadiusOf(centre({force: {kind: 'attract', strength: 2, radius: 1.25, spin: 0}})), {value: 5, emitter: true}, 'the engine clamps the emitter radius to 5')
  assert.deepEqual(forceRadiusOf(centre({enabled: false})), {value: DEFAULT_RADIUS_PX, emitter: false}, 'a disabled object emits nothing')
  assert.deepEqual(forceRadiusOf(centre({force: {kind: 'none', strength: 0, radius: 40, spin: 0}})), {value: DEFAULT_RADIUS_PX, emitter: false})
  assert.deepEqual(forceRadiusOf(centre({force: {kind: 'none', strength: 0, radius: 40, spin: 1.2}})), {value: 40, emitter: true}, 'a spin alone keeps the emitter')
  assert.deepEqual(resolvedRadius(BINDING, centre()), {value: 80, source: 'force'})
  assert.deepEqual(resolvedRadius(withRadius(BINDING, {source: 'independent', value: 300}), centre()), {value: 300, source: 'independent'})
  assert.deepEqual(resolvedRadius(withRadius(BINDING, {source: 'independent'}), centre()), {value: DEFAULT_RADIUS_PX, source: 'independent'}, 'an independent radius with no value is the engine default')
  // Changing the force radius changes the followed radius, and the value is never written to the object.
  const wide = centre({force: {kind: 'attract', strength: 2, radius: 120, spin: 0}})
  assert.equal(resolvedRadius(BINDING, wide).value, 120)
  assert.equal(wide.force.radius, 120)
  const kept = withRadius(withRadius(BINDING, {source: 'independent', value: 300}), {source: 'force'})
  assert.equal(kept.color.radius.value, 300, 'switching back to force keeps the independent value, as the app does')
})

test('the falloff kernel is the particle shader kernel: gaussian exp(-d^2/2), compact (1-d)^2 clamped at the radius', () => {
  assert.equal(falloffKernel('gaussian', 0), 1)
  assert.ok(Math.abs(falloffKernel('gaussian', 1) - Math.exp(-0.5)) < 1e-12)
  assert.equal(falloffKernel('gaussian', -1), falloffKernel('gaussian', 1), 'symmetric')
  assert.ok(Math.abs(falloffKernel('compact', 0.5) - 0.25) < 1e-12)
  assert.equal(falloffKernel('compact', 1), 0)
  assert.equal(falloffKernel('compact', 1.5), 0, 'compact falloff stops at the radius')
  const path = falloffPath('compact')
  assert.match(path, /^M/)
  assert.equal(path.split('L').length - 1, 48, '49 samples over 0 to 2r')
  assert.deepEqual(discStops('gaussian').map(stop => stop.offset), [0, 0.25, 0.5, 0.75, 1])
  assert.equal(discStops('compact').at(-1).opacity, 0, 'the compact disc fades to nothing at its radius')
})

test('the contributed colour follows the engine: override when set, else the object tint, else the canonical centre colour', () => {
  const entity = centre({tint: '#123456'})
  assert.match(contributionColour(BINDING, entity), /^#[\da-f]{6}$/i)
  assert.equal(contributionColour(withColour(BINDING, {colorSource: 'entityTint'}), entity), '#123456')
  assert.equal(contributionColour(withColour(BINDING, {colorSource: 'override', overrideColor: '#abcdef'}), entity), '#abcdef')
  assert.equal(contributionColour(withColour(BINDING, {colorSource: 'override'}), entity), contributionColour(BINDING, entity), 'override without a colour falls back to canonical')
})

test('the authored gain is the engine product: colour gain x resonance gain x global gain, zero when the layer, meaning or contribution is off', () => {
  const field = {...FIELD, globalColorGain: 2}
  assert.equal(authoredGain(withResonanceGain(withColour(BINDING, {gain: 3}), 4), field), 24)
  assert.equal(authoredGain(BINDING, {...field, enabled: false}), 0)
  assert.equal(authoredGain({...BINDING, enabled: false}, field), 0)
  assert.equal(authoredGain(withColour(BINDING, {enabled: false}), field), 0)
  assert.equal(authoredGain({...BINDING, resonance: undefined}, field), 2, 'an absent resonance gain is 1')
})

test('a new centre keeps the identity, resonance gain, colour and mappings of the old one (the inspector Meaning select), and none removes it', () => {
  const mapped = {...BINDING, resonance: {gain: 2.5}, modulations: [addedMapping()]}
  const moved = withMeaning(mapped, 'entity-a', 'ajna', newMeaningId)
  assert.equal(moved.id, 'semantic-a'); assert.equal(moved.semanticNodeId, 'ajna'); assert.equal(moved.enabled, true)
  assert.deepEqual(moved.resonance, {gain: 2.5}); assert.deepEqual(moved.color, COLOUR); assert.deepEqual(moved.modulations, mapped.modulations)
  assert.deepEqual(moved.carriers, [{kind: 'entity', id: 'entity-a'}])
  const fresh = withMeaning(undefined, 'entity-a', 'ajna', () => 'semantic-new')
  assert.deepEqual(fresh, {id: 'semantic-new', semanticNodeId: 'ajna', enabled: true, resonance: {gain: 1}, carriers: [{kind: 'entity', id: 'entity-a'}], color: COLOUR, modulations: []})
  assert.equal(withMeaning(mapped, 'entity-a', null, newMeaningId), null)
  assert.match(newMeaningId(), /^semantic-/)
  assert.deepEqual(meaningChange('entity-a', moved), {kind: 'entity-semantic', entity_id: 'entity-a', semantic: moved})
})

test('the builders are pure: the input binding is never mutated and each edit changes only its own field', () => {
  const snapshot = structuredClone(BINDING)
  const edits = [
    withColour(BINDING, {gain: 7}), withColour(BINDING, {enabled: false}), withColour(BINDING, {colorSource: 'override', overrideColor: '#00ff00'}),
    withRadius(BINDING, {source: 'independent', value: 512}), withResonanceGain(BINDING, 3), withMappings(BINDING, [addedMapping()]),
  ]
  assert.deepEqual(BINDING, snapshot, 'the input is not mutated')
  assert.equal(edits[0].color.gain, 7); assert.equal(edits[0].color.falloff, 'gaussian')
  assert.equal(edits[1].color.enabled, false); assert.equal(edits[1].color.gain, 1)
  assert.equal(edits[2].color.overrideColor, '#00ff00')
  assert.deepEqual(edits[3].color.radius, {source: 'independent', value: 512})
  assert.equal(edits[4].resonance.gain, 3)
  assert.deepEqual(edits[5].modulations, [{source: {kind: 'resonanceAffinity'}, target: 'color.gain', amount: 1, offset: 0}])
  // A binding with no colour writes the app's default colour before the one field (app.ts setSemanticBindingValue).
  const bare = {...BINDING}; delete bare.color
  assert.deepEqual(withColour(bare, {gain: 2}).color, {...COLOUR, gain: 2})
})

test('the exact-value bounds are the inspector ranges, and a bad value shows the bound it must sit inside', () => {
  assert.equal(numberProblem(MEANING_NUMBERS.colourGain, 100), null)
  assert.equal(numberProblem(MEANING_NUMBERS.colourGain, 100.01), 'Colour gain must be from 0 to 100.')
  assert.equal(numberProblem(MEANING_NUMBERS.radius, 0), 'Independent radius must be from 1 to 100000 native px.')
  assert.equal(numberProblem(MEANING_NUMBERS.amount, -100.5), 'Amount must be from -100 to 100.')
  assert.equal(numberProblem(MEANING_NUMBERS.offset, Number.NaN), 'Offset must be a number from -100 to 100.')
  assert.ok(Number.isNaN(parseNumberText('  ')))
  assert.equal(parseNumberText(' 12.5 '), 12.5)
  assert.throws(() => meaningChange('entity-a', withColour(BINDING, {gain: 101})), /Colour gain must be a number from 0 to 100/)
  assert.throws(() => meaningChange('entity-a', withResonanceGain(BINDING, 101)), /Resonance gain must be a number from -100 to 100/)
  assert.throws(() => meaningChange('entity-a', withRadius(BINDING, {source: 'independent', value: 0})), /independent radius must be a number from 0.001 to 100000/)
})

test('the radius handle maps the disc: a pointer at the rim sets the scale, and the drawn ring follows the value', () => {
  assert.equal(discRadius(DEFAULT_RADIUS_PX), DIAGRAM.radius)
  assert.equal(discRadius(110), DIAGRAM.radius / 2)
  assert.equal(discRadius(1e9), DIAGRAM.radius * DIAGRAM.maxFactor, 'clamped at the edge')
  assert.equal(radiusAtDistance(DIAGRAM.radius), DEFAULT_RADIUS_PX)
  assert.equal(radiusAtDistance(DIAGRAM.radius / 2), 110)
  assert.equal(radiusAtDistance(0), 1, 'the centre sets the minimum')
  assert.equal(radiusAtDistance(1e6), 100000, 'the edge sets the maximum')
})

test('the Scene-level changes: the layer enable and the global gain are the only two admitted Scene settings', () => {
  assert.deepEqual(fieldChange('enabled', false), {kind: 'semantic-field-setting', key: 'enabled', value: false})
  assert.deepEqual(fieldChange('globalColorGain', 42.5), {kind: 'semantic-field-setting', key: 'globalColorGain', value: 42.5})
  assert.throws(() => fieldChange('globalColorGain', 100.5), /from 0 to 100/)
  assert.equal(MEANING_NUMBERS.globalColourGain.max, 100)
})

test('change shapes: every control sends one whole meaning or one Scene setting through a stub apply, and the boundary admits each', async () => {
  const sent = []
  const apply = async changes => { sent.push(...changes); return {ok: true} }
  const send = async change => apply([change])
  const entity = 'entity-a'
  const steps = [
    meaningChange(entity, withMeaning(BINDING, entity, 'ajna', newMeaningId)),
    meaningChange(entity, withMeaning(BINDING, entity, null, newMeaningId)),
    meaningChange(entity, withColour(BINDING, {enabled: false})),
    meaningChange(entity, withColour(BINDING, {colorSource: 'entityTint'})),
    meaningChange(entity, withColour(BINDING, {colorSource: 'override', overrideColor: '#abcdef'})),
    meaningChange(entity, withColour(BINDING, {activation: 'focus'})),
    meaningChange(entity, withColour(BINDING, {gain: 12.5})),
    meaningChange(entity, withResonanceGain(BINDING, 3)),
    meaningChange(entity, withRadius(BINDING, {source: 'independent', value: 512})),
    meaningChange(entity, withColour(BINDING, {falloff: 'compact', metric: 'world3d', blend: 'additive'})),
    meaningChange(entity, withMappings(BINDING, [addedMapping()])),
    meaningChange(entity, withMappings(BINDING, [{...addedMapping(), amount: -4, offset: 0.5, clamp: [0, 2]}])),
    meaningChange(entity, null),
  ]
  for (const change of steps) await send(change)
  await send(fieldChange('enabled', true))
  await send(fieldChange('globalColorGain', 0))
  assert.equal(sent.length, steps.length + 2)
  for (const change of sent.slice(0, steps.length)) {
    assert.deepEqual(Object.keys(change).sort(), ['entity_id', 'kind', 'semantic'])
    assert.equal(change.kind, 'entity-semantic')
    assert.deepEqual(validateNativeEntitySemanticChange(change), change)
  }
  for (const change of sent.slice(steps.length)) {
    assert.deepEqual(Object.keys(change).sort(), ['key', 'kind', 'value'])
    assert.equal(change.kind, 'semantic-field-setting')
    assert.deepEqual(validateNativeSemanticFieldChange(change), change)
  }
  assert.equal(sent[steps.length - 1].semantic, null, 'remove sends a null meaning')
  assert.ok(MEANING_NODE_IDS.includes(sent[0].semantic.semanticNodeId))
})

test('the options are the inspector lists and the boundary admits exactly those values', () => {
  const values = list => list.map(([id]) => id)
  assert.deepEqual(values(device.MEANING_OPTIONS.meaning), ['none', ...MEANING_NODE_IDS])
  assert.deepEqual(device.MEANING_OPTIONS.meaning.slice(1).map(([, label]) => label), ['Muladhara (Root)', 'Svadhisthana (Sacral)', 'Manipura (Solar Plexus)', 'Anahata (Heart)', 'Vishuddha (Throat)', 'Ajna (Third Eye)', 'Sahasrara (Crown)'])
  assert.deepEqual(values(device.MEANING_OPTIONS.colourSource), ['canonical', 'entityTint', 'override'])
  assert.deepEqual(values(device.MEANING_OPTIONS.activation), ['constant', 'resonanceAffinity', 'focus'])
  assert.deepEqual(values(device.MEANING_OPTIONS.radiusSource), ['force', 'independent'])
  assert.deepEqual(values(device.MEANING_OPTIONS.falloff), ['gaussian', 'compact'])
  assert.deepEqual(values(device.MEANING_OPTIONS.metric), ['compositionPlane', 'world3d'])
  assert.deepEqual(values(device.MEANING_OPTIONS.blend), ['weighted', 'additive'])
  assert.deepEqual(values(device.MEANING_OPTIONS.signal), ['resonanceAffinity', 'focus', 'carrierSpeed', 'forceStrength', 'forceSpin'])
  assert.deepEqual(values(device.MEANING_OPTIONS.target), ['color.gain', 'color.radius', 'color.hueShift'])
  assert.throws(() => meaningChange('entity-a', withColour(BINDING, {falloff: 'linear'})), /Choose a falloff/)
})

test('the server render: the summary, the groups in the inspector order, the labelled controls, the derived radius and the handle', () => {
  const html = SSR()
  assert.match(html, /aria-label="Meaning device"/)
  assert.match(html, />Anahata \(Heart\) · canonical · gain 1</)
  for (const group of ['Meaning', 'Colour', 'Radius and falloff', 'Mapping', 'Scene field']) assert.ok(html.includes(`aria-label="${group}"`), group)
  assert.ok(html.indexOf('aria-label="Colour"') < html.indexOf('aria-label="Radius and falloff"') && html.indexOf('aria-label="Mapping"') < html.indexOf('aria-label="Scene field"'))
  assert.match(html, /data-derived-radius/, 'the followed radius is shown read only')
  assert.match(html, /Follows this object&#x27;s force radius: 80 stage units, read from Influence/, 'SSR escapes the apostrophe')
  assert.doesNotMatch(html, /role="slider"/, 'no handle while the radius follows the force')
  assert.match(html, /<h4>Scene field<\/h4>/)
  assert.match(html, /Semantic layer enabled/)
  // Every field has a label that names it: a label for= the id, or the control sits inside its label.
  for (const id of ids(html)) assert.ok(html.includes(`for="${id}"`) || new RegExp(`<label[^>]*>(?:(?!</label>)[\\s\\S])*id="${id}"`).test(html), `label for ${id}`)
  assert.match(html, /<option value="anahata" selected="">Anahata \(Heart\)<\/option>/)
  assert.match(html, /Remove meaning/)
  assert.match(html, /Add signal mapping/)
})

test('the independent radius draws a handle with its value, and the disc changes when the value changes', () => {
  const independent = (value) => reading({field: {...FIELD, bindings: [withRadius(BINDING, {source: 'independent', value})]}})
  const small = SSR(independent(120)), large = SSR(independent(240))
  assert.match(small, /role="slider"[^>]*aria-label="Independent radius handle"[^>]*aria-valuenow="120"/)
  assert.match(small, /aria-valuetext="120 native px"/)
  const ringOf = html => html.match(/r="([\d.]+)" class="native-entity-meaning-ring"/)[1]
  assert.notEqual(ringOf(small), ringOf(large), 'the drawn ring moves with the value')
  assert.ok(Math.abs(Number(ringOf(large)) - DIAGRAM.radius * 240 / DEFAULT_RADIUS_PX) < 1e-9, 'a 240 px radius is drawn at 240 / 220 of the disc')
  assert.match(small, /Influence radius · 120 native px, independent/)
  const follow = SSR()
  assert.notEqual(ringOf(follow), ringOf(large), 'the followed radius (80) is drawn on the same scale')
  assert.ok(Math.abs(Number(ringOf(follow)) - DIAGRAM.radius * 80 / DEFAULT_RADIUS_PX) < 1e-9, 'the followed radius 80 is drawn at 80 / 220 of the disc')
})

test('the locked, unbound and absent states say what is missing and disable the meaning controls', () => {
  const locked = SSR(reading({entities: [centre({locked: true})]}))
  assert.match(locked, /This object is locked\. Unlock this entity to change its meaning\./)
  assert.match(locked, /<select[^>]*id="[^"]*-meaning"[^>]*disabled=""/)
  const bare = SSR(reading({field: {...FIELD, bindings: []}}))
  assert.match(bare, />No meaning on this object\. Choose one below to attach it\.</)
  assert.doesNotMatch(bare, /Remove meaning/)
  assert.match(bare, /No semantic binding/)
  const noField = SSR(reading({field: null}))
  assert.match(noField, /<input[^>]*id="[^"]*-field-enabled"[^>]*disabled=""/, 'the Scene toggle is disabled until a meaning creates the field')
  assert.match(noField, /<input[^>]*id="[^"]*-global-gain"[^>]*disabled=""/)
  const pending = SSR(reading({pending: true}))
  assert.match(pending, /A native acknowledgement is pending: meaning edits wait for it\./)
})
