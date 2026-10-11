import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Wave 4 coverage for the Configure reveal of the chosen controls (toolbelt row). NativeWorldDetail passes
// `configure && configuration === 'controls'` to NativeChosenControls; the management rows are rendered with the
// `hidden` attribute when configure is off. This file renders the production NativeChosenControls with SSR for both states,
// the Follow/Bind and reorder disabled reasons, the owner's unavailable text, and the slider's accessible values.
// The Configure button click itself (NativeWorldDetail) is a DOM event and is not covered here.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [{NativeChosenControls}, {NATIVE_BINDINGS}] = await Promise.all([
  import('../src/components/NativeChosenControls.tsx'),
  import(parameters),
])

const [first, second, third] = NATIVE_BINDINGS
const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
const object = {id: 'object-1', name: 'Pin A', kind: 'pin', enabled: true, position: {x: 0, y: 0, z: 0}, size: {x: 1, y: 1}, rotation: 0,
  shape: 'circle', text: '', share: 1, tint: '#000', tintWeight: 1, locked: false, station: null,
  force: {kind: 'none', strength: 0, radius: 1.25, spin: 0}, sequence: {enabled: false, clock: 'seconds', steps: []}}
const control = (entry, binding, over = {}) => ({entry_id: entry, target: binding ? 'field.' + binding.key : null, binding, entity_id: null,
  native_ref: null, base_value: 1, effective_value: null, locked: false, unavailable_reason: null, ...over})

// Three chosen controls: one Field entry (shown in the top bar, never in this rack), one Follow entry and one Bind entry. `selection` decides whether a single object is selected.
function reading({entries, controls, available = true, selection = []} = {}) {
  const scene = {name: 'Chosen fixture', entities: [object], engine: {...ENGINE}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  return {
    basis: {expression_ref: 'expr:chosen', revision: 1, scene_ref: 'scene:chosen', authored_revision: 1},
    scene, entityOccurrences: {}, devices: [],
    chosenControls: {available, entries: entries ?? [
      {id: 'entry-field', key: first.key, scope: 'field'},
      {id: 'entry-follow', key: second.key, scope: 'selected'},
      {id: 'entry-named', key: third.key, scope: 'named', entityId: object.id},
    ], controls: controls ?? [control('entry-field', first), control('entry-follow', second), control('entry-named', third, {entity_id: object.id})]},
    selection: {entity_ids: selection, step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
const request = async () => ({ok: true})
const render = (over = {}, configure = false) => renderToStaticMarkup(createElement(NativeChosenControls, {reading: reading(over), request, configure}))
// React escapes attribute and text content; the labels below are matched in their escaped form.
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
/** The opening tag of the first element whose attributes include `aria-label="<label>"`. */
const tagWithLabel = (markup, label) => {
  const found = markup.match(new RegExp(`<[a-z]+[^>]*aria-label="${escape(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`))
  assert.ok(found, `element labelled ${label} is rendered`)
  return found[0]
}
const countOf = (markup, pattern) => (markup.match(pattern) ?? []).length

test('with Configure off, every chosen-control management row is hidden and the controls themselves stay rendered', () => {
  const markup = render()
  assert.equal(countOf(markup, /class="native-chosen-manage" hidden=""/g), 2, 'one hidden management row per chosen control')
  assert.equal(countOf(markup, /class="native-chosen-item"/g), 2)
  assert.match(markup, /role="slider"/)
  assert.doesNotMatch(markup, /class="native-chosen-manage"(?! hidden)/)
})

test('with Configure on, the management rows are revealed for the same reading and their named actions appear', () => {
  const markup = render({}, true)
  assert.equal(countOf(markup, /class="native-chosen-manage" hidden=""/g), 0)
  assert.equal(countOf(markup, /class="native-chosen-manage"/g), 2)
  assert.doesNotMatch(markup, new RegExp(escape(`Drag to reorder ${first.label}`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'a Field pin is managed from the top bar, not here')
  for (const binding of [second, third]) {
    assert.match(markup, new RegExp(`aria-label="${escape(`Drag to reorder ${binding.label}; or Alt with Left or Right arrow`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
    assert.match(markup, new RegExp(`aria-label="${escape(`Remove ${binding.label} chosen control`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  }
  // Both object entries (Follow and Bind) have a scope choice; a Field entry is never scoped and never shown here.
  assert.equal(countOf(markup, /<select aria-label="Scope for /g), 2)
})

test('reorder is disabled at the edges of the visible object controls', () => {
  const markup = render({}, true)
  assert.match(tagWithLabel(markup, `Move ${second.label} earlier`), /disabled=""/)
  assert.doesNotMatch(tagWithLabel(markup, `Move ${second.label} later`), /disabled=""/)
  assert.doesNotMatch(tagWithLabel(markup, `Move ${third.label} earlier`), /disabled=""/)
  assert.match(tagWithLabel(markup, `Move ${third.label} later`), /disabled=""/)
})

test('Field pins are not shown in the rack, and a reorder of the object controls keeps each Field entry in its own slot', async () => {
  const markup = render()
  assert.equal(countOf(markup, /class="native-chosen-item"/g), 2, 'only the two object entries render')
  const {wholeChosenOrder} = await import('../src/components/nativeBrowserModel.ts')
  const entries = [{id: 'f1', scope: 'field'}, {id: 'a', scope: 'selected'}, {id: 'f2', scope: 'field'}, {id: 'b', scope: 'named'}]
  assert.deepEqual(wholeChosenOrder(entries, ['b', 'a']), ['f1', 'b', 'f2', 'a'])
  assert.deepEqual(wholeChosenOrder(entries, ['a', 'b']), ['f1', 'a', 'f2', 'b'])
  assert.deepEqual(wholeChosenOrder([{id: 'f1', scope: 'field'}], []), ['f1'])
  const fieldOnly = render({entries: [{id: 'entry-field', key: first.key, scope: 'field'}], controls: [control('entry-field', first)]})
  assert.match(fieldOnly, /No object parameters chosen\. Field pins are in the top bar\./)
})

test('a Follow entry offers Bind this object only when one object is selected to bind', () => {
  const unselected = render({entries: [{id: 'entry-follow', key: second.key, scope: 'selected'}], controls: [control('entry-follow', second)]}, true)
  assert.match(unselected, /<option value="named" disabled="">Bind this object<\/option>/)
  const selected = render({entries: [{id: 'entry-follow', key: second.key, scope: 'selected'}], controls: [control('entry-follow', second)],
    selection: [object.id]}, true)
  assert.doesNotMatch(selected, /<option value="named" disabled="">Bind this object<\/option>/)
  assert.match(selected, /<option value="named">Bind this object<\/option>/)
})

test('an unavailable owner disables Add Parameter and says the owner has not disclosed its chosen controls', () => {
  const markup = render({available: false, entries: [], controls: []})
  assert.match(markup, /<button disabled="">\+ Parameter<\/button>/)
  assert.match(markup, /The retained owner has not disclosed its chosen controls\./)
})

test('a retained declaration the owner has not resolved shows its reason and cannot take a typed value', () => {
  const markup = render({entries: [{id: 'entry-follow', key: second.key, scope: 'selected'}], controls: []})
  assert.match(markup, /The native owner has not resolved this retained declaration\./)
  assert.match(markup, /class="native-chosen-control is-unavailable"/)
  assert.match(tagWithLabel(markup, 'Unavailable parameter exact value'), /disabled=""/)
})

test('the dial reports its range and current value to assistive technology', () => {
  const markup = render({entries: [{id: 'entry-follow', key: second.key, scope: 'selected'}], controls: [control('entry-follow', second, {base_value: 1, entity_id: object.id})], selection: [object.id]})
  const dial = tagWithLabel(markup, `${second.label} · ${object.name}`)
  assert.match(dial, /role="slider"/)
  assert.match(dial, new RegExp(`aria-valuemin="${second.hardMin}"`))
  assert.match(dial, new RegExp(`aria-valuemax="${second.hardMax}"`))
  assert.match(dial, /aria-valuenow="1"/)
})
