import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Production browser model in memory, same loader as the sibling native tests.
// Readings are minimal fixtures: they are not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)

const [model, {NATIVE_BINDINGS, entityTargets}] = await Promise.all([
  import('../src/components/nativeBrowserModel.ts'),
  import(parameters),
])
const {
  rowAfter, groupRows, reorderIds, reorderChange, gapToIndex, edgeGap, parameterDragFor, chosenAddChange, chosenDropReason,
  rackMapReason, rackMappingPath, mappableRacks, deviceTargetFor, selectionSlot, materialCompatibility, materialRowVisible,
  parameterFacts, rowLabel, countLabel, chosenScopeFor,
} = model

const field = path => {
  const found = NATIVE_BINDINGS.find(row => row.path === path)
  assert.ok(found, `missing native binding ${path}`)
  return found
}
const facts = binding => ({path: binding.path, key: binding.key, label: binding.label, unit: binding.unit, min: binding.min, max: binding.max})
const force = (over = {}) => ({id: 'pin-1', name: 'Pin A', kind: 'pin', enabled: true, native: {}, position: {x: 0, y: 0, z: 0}, size: {x: 1, y: 1},
  rotation: 0, shape: 'circle', text: '', share: 1, tint: '#000', tintWeight: 1, locked: false, station: null,
  force: {kind: 'attract', strength: 2.5, radius: 1.25, spin: 0}, sequence: {enabled: false, clock: 'seconds', steps: []}, ...over})

// A reading fixture with one object and an optional chosen list.
function reading({entities = [force()], selection = [], entries = [], available = true, pending = false, occurrences} = {}) {
  const scene = {name: 'Fixture', entities, engine: {}, field: {background: '#fff', palette: ['#000'], material: 'ink', params: {}}}
  const ids = entities.map(entity => entity.id)
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: occurrences ?? Object.fromEntries(ids.map(id => [id, 'occ:' + id])),
    chosenControls: {available, entries, controls: []}, selection: {entity_ids: selection, step_id: null},
    history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending, notice: null},
  }
}
const objectDrag = (over = {}) => ({...parameterDragFor({...facts(entityTargets(reading({selection: ['pin-1']}).scene)[0]), entityId: 'pin-1'}, 'object', 'selected'), ...over})

test('row navigation clamps and returns to the search field above the rows', () => {
  assert.equal(rowAfter(0, -1, 'ArrowDown'), -1)
  assert.equal(rowAfter(3, -1, 'ArrowDown'), 0)
  assert.equal(rowAfter(3, 0, 'ArrowUp'), -1)
  assert.equal(rowAfter(3, -1, 'ArrowUp'), -1)
  assert.equal(rowAfter(3, 2, 'ArrowDown'), 2)
  assert.equal(rowAfter(3, 1, 'ArrowDown'), 2)
  assert.equal(rowAfter(3, 2, 'Home'), 0)
  assert.equal(rowAfter(3, 0, 'End'), 2)
  assert.equal(rowAfter(3, 9, 'ArrowUp'), 1, 'a stale index is clamped before moving')
})

test('groups keep first-appearance order and registry order inside each group', () => {
  const rows = [{group: 'morph', id: 1}, {group: 'motion', id: 2}, {group: 'morph', id: 3}]
  const groups = groupRows(rows)
  assert.deepEqual(groups.map(group => group.group), ['morph', 'motion'])
  assert.deepEqual(groups[0].rows.map(row => row.id), [1, 3])
  assert.deepEqual(groupRows([]), [])
})

test('reordering yields the full order and no request when nothing moves', () => {
  assert.deepEqual(reorderIds(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a'])
  assert.deepEqual(reorderIds(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b'])
  assert.deepEqual(reorderChange(['a', 'b', 'c'], 1, 1), null)
  assert.deepEqual(reorderChange(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c'])
  assert.throws(() => reorderIds(['a'], 1, 0), /Choose a chosen control/)
  assert.throws(() => reorderIds(['a'], -1, 0), /Choose a chosen control/)
})

test('drop gaps map to final indices for every source and edge', () => {
  const ids = ['a', 'b', 'c', 'd']
  for (let from = 0; from < ids.length; from++) {
    for (let index = 0; index < ids.length; index++) {
      for (const edge of ['before', 'after']) {
        const to = gapToIndex(from, edgeGap(index, edge))
        const moved = reorderChange(ids, from, to)
        const gap = edgeGap(index, edge)
        if (gap === from || gap === from + 1) assert.equal(moved, null, `no-op from ${from} ${edge} ${index}`)
        else {
          assert.ok(moved, `moves from ${from} ${edge} ${index}`)
          assert.equal(moved.indexOf(ids[from]), to)
          assert.deepEqual(moved.filter(id => id !== ids[from]), ids.filter((_, i) => i !== from), 'other order preserved')
        }
      }
    }
  }
})

test('scope rule is shared: fields are field-scoped, objects follow the chosen object scope', () => {
  assert.equal(chosenScopeFor('field', 'named'), 'field')
  assert.equal(chosenScopeFor('object', 'named'), 'named')
  const drag = parameterDragFor(facts(field('medium.iterations')), 'field', 'selected')
  assert.deepEqual(chosenAddChange(drag), {kind: 'chosen-add', key: field('medium.iterations').key, scope: 'field'})
  const named = objectDrag({scope: 'named'})
  assert.deepEqual(chosenAddChange(named), {kind: 'chosen-add', key: named.key, scope: 'named', entity_id: 'pin-1'})
  assert.deepEqual(chosenAddChange(objectDrag()), {kind: 'chosen-add', key: named.key, scope: 'selected'}, 'follow scope sends no entity id')
  assert.throws(() => parameterDragFor({...facts(field('medium.iterations')), entityId: undefined}, 'object', 'named'), /names its object/)
})

test('the drag payload uses the rack path and the chosen key, and keeps the native range', () => {
  const binding = field('fluid.returnSpeed')
  const drag = parameterDragFor(facts(binding), 'field', 'selected')
  assert.equal(drag.path, 'fluid.returnSpeed')
  assert.equal(drag.key, binding.key)
  assert.equal(drag.min, binding.min)
  assert.equal(drag.max, binding.max)
  assert.equal(rowLabel('Entity 1 · Force Strength'), 'Force Strength')
  assert.equal(rowLabel('Ink Opacity'), 'Ink Opacity')
})

test('chosen drop accepts a valid parameter and refuses duplicates, missing reads and stale selections', () => {
  const drag = parameterDragFor(facts(field('medium.iterations')), 'field', 'selected')
  assert.equal(chosenDropReason(drag, reading()), null)
  assert.match(chosenDropReason(drag, null), /Open an Expression/)
  assert.match(chosenDropReason(drag, reading({available: false})), /not disclosed/)
  assert.match(chosenDropReason(drag, reading({pending: true})), /acknowledge/)
  const chosen = [{id: 'belt-1', key: drag.key, scope: 'field'}]
  assert.match(chosenDropReason(drag, reading({entries: chosen})), /Already chosen/)
  assert.match(chosenDropReason({...drag, key: 'nope'}, reading()), /no native definition/)

  const object = objectDrag()
  assert.equal(chosenDropReason(object, reading({selection: ['pin-1']})), null)
  assert.match(chosenDropReason(object, reading({selection: []})), /selection changed/)
  assert.match(chosenDropReason(objectDrag({entityId: 'gone'}), reading({selection: ['gone']})), /absent/)
  assert.match(chosenDropReason(object, reading({selection: ['pin-1'], entities: [force({locked: true})]})), /locked/)
  assert.match(chosenDropReason(object, reading({selection: ['pin-1'], occurrences: {}})), /admitted native occurrence/)
  const named = objectDrag({scope: 'named'})
  assert.match(chosenDropReason(named, reading({entries: [{id: 'b', key: named.key, scope: 'named', entityId: 'pin-1'}]})), /Already chosen/)
  assert.equal(chosenDropReason(named, reading({entries: [{id: 'b', key: named.key, scope: 'named', entityId: 'other'}]})), null)
})

test('macro mapping: field racks take Field parameters, entity racks only their own object', () => {
  const fieldRack = {id: 'r1', scope: {kind: 'field'}, macros: [{id: 'm1', name: 'Macro 1', value: .5, mappings: []}]}
  const entityRack = {id: 'r2', scope: {kind: 'entity', entity_ref: 'occ:pin-1'}, macros: fieldRack.macros}
  const fieldDrag = parameterDragFor(facts(field('fluid.returnSpeed')), 'field', 'selected')
  assert.equal(rackMapReason(fieldDrag, fieldRack, reading()), null)
  assert.equal(rackMappingPath(fieldRack, fieldDrag), 'fluid.returnSpeed')
  assert.match(rackMapReason(fieldDrag, entityRack, reading()), /Entity racks take parameters of their own object/)

  const object = objectDrag()
  assert.equal(rackMapReason(object, entityRack, reading()), null)
  assert.equal(rackMappingPath(entityRack, object), object.key)
  assert.match(rackMapReason(object, fieldRack, reading()), /Field racks take Field parameters/)
  assert.match(rackMapReason(objectDrag({entityId: 'other'}), entityRack, reading({entities: [force(), force({id: 'other'})]})), /another object/)
  assert.match(rackMapReason(object, entityRack, reading({entities: [force({locked: true})]})), /Unlock/)
  assert.match(rackMapReason(object, {...entityRack, macros: []}, reading()), /no macro/)
  assert.deepEqual(mappableRacks(fieldDrag, [fieldRack, entityRack], reading()), [fieldRack])
})

test('device target: each parameter names the editor that discloses it, or none', () => {
  assert.deepEqual(deviceTargetFor(field('fluid.returnSpeed'), 'field'), {scope: 'field', family: 'physics'})
  assert.deepEqual(deviceTargetFor(field('medium.iterations'), 'field'), {scope: 'field', family: 'medium'})
  assert.deepEqual(deviceTargetFor(field('cymatics.frequencyHz'), 'field'), {scope: 'field', family: 'resonance'})
  assert.deepEqual(deviceTargetFor(field('toroidalMorph.driveDepth'), 'field'), {scope: 'field', family: 'morph'})
  assert.deepEqual(deviceTargetFor(field('color.cycleSpeed'), 'field'), {scope: 'field', family: 'colour'})
  assert.deepEqual(deviceTargetFor(field('relational.attractorCount'), 'field'), {scope: 'field', family: 'relational'})
  assert.deepEqual(deviceTargetFor(field('interaction.radius'), 'field'), {scope: 'field', family: 'pointer'})
  assert.deepEqual(deviceTargetFor(field('paperGrain'), 'field'), {scope: 'field', family: 'colour'})
  assert.deepEqual(deviceTargetFor(field('morphProgress'), 'field'), {scope: 'field', family: 'morph'})
  assert.equal(deviceTargetFor({path: 'not.a.parameter', key: 'notAParameter'}, 'field'), null)
  assert.deepEqual(deviceTargetFor({path: 'entities.0.forces.strength', key: 'forces.strength'}, 'object'), {scope: 'entity', family: 'force'})
  assert.equal(deviceTargetFor({path: 'entities.0.x', key: 'x'}, 'object'), null)
})

test('material compatibility reads role accepts against the selected object', () => {
  const agentRole = {role: 'self', accepts: 'agent'}, objectRole = {role: 'goal', accepts: 'object'}, textRole = {role: 'caption', accepts: 'text'}
  const plainObject = selectionSlot(reading({selection: ['pin-1']}))
  assert.deepEqual(plainObject, {name: 'Pin A', slot: 'object'})
  const agent = selectionSlot(reading({entities: [force({role: 'self'})], selection: ['pin-1']}))
  assert.deepEqual(agent, {name: 'Pin A', slot: 'agent'})
  assert.equal(selectionSlot(reading({selection: []})), null)

  assert.deepEqual(materialCompatibility([agentRole], null), {state: 'none'}, 'no selection gives no basis')
  assert.equal(materialCompatibility([objectRole], plainObject).state, 'compatible')
  assert.equal(materialCompatibility([textRole], plainObject).state, 'compatible', 'text-only material needs no object')
  assert.equal(materialCompatibility([], plainObject).state, 'compatible')
  const incompatible = materialCompatibility([agentRole], plainObject)
  assert.equal(incompatible.state, 'incompatible')
  assert.match(incompatible.reason, /Needs an agent role/)
  assert.equal(materialCompatibility([agentRole, objectRole], agent).state, 'compatible')
  assert.equal(materialCompatibility([agentRole], agent).state, 'compatible', 'an agent may fill an agent role')
  assert.equal(materialRowVisible(incompatible, false, false), false, 'hidden by default')
  assert.equal(materialRowVisible(incompatible, true, false), true, 'shown marked under Show all')
  assert.equal(materialRowVisible(incompatible, false, true), true, 'a selected row stays visible')
})

test('parameter facts format soft and hard bounds, step, native path and effective value', () => {
  const binding = field('fluid.returnSpeed')
  const detail = parameterFacts(binding, 1.23456789, undefined, 'Field')
  assert.equal(detail.base, '1.23457')
  assert.equal(detail.effective, null)
  assert.equal(detail.native, binding.bind)
  assert.equal(detail.scope, 'Field')
  assert.equal(parameterFacts(binding, 1, 2, 'Field').effective, '2')
  assert.equal(parameterFacts(binding, 1, Number.NaN, 'Field').effective, null)
  assert.equal(parameterFacts({label: 'X', min: 0, max: 1, hardMin: -2, hardMax: 2, step: 0, bind: 'b'}, 0, undefined, 'Object').step, 'continuous')
  assert.equal(parameterFacts({label: 'X', min: 0, max: 1, hardMin: -2, hardMax: 2, step: 0, bind: 'b'}, 0, undefined, 'Object').hard, '-2 – 2')
})

test('counts pluralise by noun', () => {
  assert.equal(countLabel(0, 'parameter'), '0 parameters')
  assert.equal(countLabel(1, 'material'), '1 material')
  assert.equal(countLabel(3, 'expression'), '3 expressions')
})
