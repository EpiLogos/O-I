import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Wave 4 coverage for the Property browser's open path (reveal-param row). "Open device" in NativePropertyBrowser dispatches
// OPEN_DEVICE_EVENT with deviceTargetFor(property, kind); WorldBrowser's listener admits it with parseOpenDevice and opens the
// pool on that family. This file checks the production request shape and parser, and that every target the browser can send
// names a device the catalogue really lists, in the same scope. The listener and the scroll-to-control inside the panel are
// effects and DOM calls, so they are not covered here. Pure modules only; no DOM, no owner.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [{deviceTargetFor}, {parseOpenDevice, OPEN_DEVICE_EVENT}, {deviceCatalogue}, {FIELD_FACE_MODELS}, {NATIVE_BINDINGS}] = await Promise.all([
  import('../src/components/nativeBrowserModel.ts'),
  import('../src/components/nativeDrag.ts'),
  import('../src/components/nativeDeviceCatalogue.ts'),
  import('../src/components/nativeFieldFaceModel.ts'),
  import(parameters),
])

const catalogue = new Map(deviceCatalogue().map(device => [device.family, device]))
const fieldBindings = NATIVE_BINDINGS.map(binding => ({...binding, target: 'field.' + binding.key}))
// Object parameters are the entity bindings; the browser lists them per object, so a representative key is enough here.
const objectKeys = ['forces.strength', 'forces.radius', 'forces.spin', 'position.x', 'size.x', 'tint']
const bindingFor = path => {
  const found = NATIVE_BINDINGS.find(binding => binding.path === path)
  assert.ok(found, `native binding ${path}`)
  return found
}

test('every Field parameter the browser can open lands on a catalogued device of the same scope', () => {
  const opened = fieldBindings.map(binding => [binding, deviceTargetFor(binding, 'field')]).filter(([, device]) => device)
  assert.ok(opened.length > 0, 'some Field parameters are disclosed by a device')
  for (const [binding, target] of opened) {
    const device = catalogue.get(target.family)
    assert.ok(device, `${binding.key} opens ${target.family}, which the catalogue lists`)
    assert.equal(device.scope, target.scope, `${binding.key} opens ${target.family} in its own scope`)
    assert.equal(target.scope, 'field')
  }
})

test('the owning family is named: a physics parameter opens the physics device, not another family', () => {
  const path = FIELD_FACE_MODELS.physics.paths[0]
  assert.deepEqual(deviceTargetFor(bindingFor(path), 'field'), {scope: 'field', family: 'physics'})
})

test('Object parameters open the entity device only for the force family; other object keys have no device to open', () => {
  assert.deepEqual(deviceTargetFor({path: 'forces.strength', key: 'forces.strength'}, 'object'), {scope: 'entity', family: 'force'})
  assert.equal(catalogue.get('force')?.scope, 'entity')
  for (const key of objectKeys.filter(key => !key.startsWith('forces.'))) {
    assert.equal(deviceTargetFor({path: key, key}, 'object'), null, `${key} has no device, so Open device stays disabled`)
  }
})

test('a Field parameter that no device discloses has no open target, so Open device stays disabled', () => {
  assert.equal(deviceTargetFor({path: 'native_unknown.parameter', key: 'native_unknown.parameter'}, 'field'), null)
})

test('the open request parses to exactly its scope and family, and anything malformed is refused', () => {
  // The browser dispatches {scope, family}; the listener admits it through the same parser.
  assert.equal(OPEN_DEVICE_EVENT, 'oi:native-open-device')
  assert.deepEqual(parseOpenDevice({scope: 'field', family: 'physics', extra: 'ignored'}), {scope: 'field', family: 'physics'})
  assert.deepEqual(parseOpenDevice({scope: 'entity', family: 'force'}), {scope: 'entity', family: 'force'})
  assert.equal(parseOpenDevice({scope: 'window', family: 'physics'}), null, 'an unknown scope is refused')
  assert.equal(parseOpenDevice({scope: 'field', family: 'Physics Panel'}), null, 'a family id must be a lower-camel identifier')
  assert.equal(parseOpenDevice({scope: 'field', family: 'a'.repeat(33)}), null, 'a family id is at most 32 characters')
  assert.equal(parseOpenDevice({scope: 'field'}), null, 'a missing family is refused')
  assert.equal(parseOpenDevice(['field', 'physics']), null, 'an array is not a request')
  assert.equal(parseOpenDevice(null), null)
  assert.equal(parseOpenDevice('physics'), null)
})

test('every target the browser can send round-trips through the parser unchanged', () => {
  const targets = [...fieldBindings.map(binding => deviceTargetFor(binding, 'field')), deviceTargetFor({path: 'forces.strength', key: 'forces.strength'}, 'object')]
    .filter(Boolean)
  assert.ok(targets.length > 0)
  for (const target of targets) {
    // The event detail is a plain object; the listener parses the structured clone of it.
    const detail = structuredClone(target)
    assert.deepEqual(parseOpenDevice(detail), target)
  }
})
