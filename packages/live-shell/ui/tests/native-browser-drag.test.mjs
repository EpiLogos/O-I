import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production drag protocol in memory, same loader as the sibling native tests.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)

const drag = await import('../src/components/nativeDrag.ts')
const components = new URL('../src/components/', import.meta.url)
const read = name => readFile(new URL(name, components), 'utf8')

const field = {path: 'fluid.returnSpeed', key: 'recovery', label: 'Return Spring', unit: null, min: -5, max: 25, kind: 'field', scope: 'field'}
const object = {path: 'forces.strength', key: 'forces.strength', label: 'Force Strength', unit: 'px', min: -20, max: 20, kind: 'object', scope: 'named', entityId: 'pin-1'}

test('a parameter payload round-trips and keeps the rack path, chosen key and native range', () => {
  for (const payload of [field, object]) {
    const decoded = drag.decodeParameterDrag(drag.encodeParameterDrag(payload))
    assert.deepEqual(decoded, payload)
  }
})

test('malformed payloads from any source are refused', () => {
  const refuse = value => assert.equal(drag.parseParameterDrag(value), null, JSON.stringify(value))
  refuse(null)
  refuse([])
  refuse({...field, path: ''})
  refuse({...field, key: undefined})
  refuse({...field, min: Number.NaN})
  refuse({...field, min: 'low'})
  refuse({...field, label: 'x'.repeat(301)})
  refuse({...field, unit: 7})
  refuse({...field, kind: 'field', scope: 'named'})
  refuse({...object, entityId: ''})
  refuse({...object, entityId: undefined})
  refuse({...object, scope: 'field'})
  refuse({...object, kind: 'other'})
  assert.equal(drag.decodeParameterDrag('{not json'), null)
  assert.equal(drag.decodeParameterDrag('42'), null)
})

test('the active drag is held for the gesture and cleared on end', () => {
  assert.equal(drag.activeDrag(), null)
  drag.setActiveDrag({kind: 'parameter', drag: field})
  assert.deepEqual(drag.activeDrag(), {kind: 'parameter', drag: field})
  drag.setActiveDrag({kind: 'chosen', entry_id: 'belt-1', index: 2})
  assert.equal(drag.activeDrag().kind, 'chosen')
  drag.setActiveDrag(null)
  assert.equal(drag.activeDrag(), null)
})

test('the protocol uses distinct application MIME types and event names', () => {
  assert.equal(drag.PARAMETER_MIME, 'application/x-oi-native-parameter')
  assert.equal(drag.CHOSEN_MIME, 'application/x-oi-chosen-control')
  assert.notEqual(drag.PARAMETER_MIME, drag.CHOSEN_MIME)
  assert.match(drag.MAP_PARAMETER_EVENT, /^oi:/)
  assert.match(drag.OPEN_DEVICE_EVENT, /^oi:/)
})

// Source wiring: the gesture reaches the owner through the shared rules, and the
// new styles use shell tokens only. These guard against a silent re-split of the rules.
test('the Browser, chosen rack and macro rack are wired to the shared drag rules', async () => {
  const browser = await read('NativePropertyBrowser.tsx'), chosen = await read('NativeChosenControls.tsx'), rack = await read('NativeRackEditor.tsx')
  const search = await read('WorldBrowser.tsx')
  assert.match(browser, /setDragChip\(/)
  assert.match(browser, /chosenAddChange\(drag\)/, 'the button and the drop share one chosen-add change')
  assert.match(browser, /dispatchEvent\(new CustomEvent\(MAP_PARAMETER_EVENT/)
  assert.match(chosen, /chosenDropReason\(active\.drag, reading\)/)
  assert.match(chosen, /invoke\(\{operation: 'apply', basis: reading\.basis, changes: \[\{kind: 'chosen-order', entry_ids: next\}\]\}\)/, 'one chosen-order request per drop')
  assert.match(chosen, /if \(event\.altKey \|\| disabled/, 'Alt+arrow is not taken by the dial')
  assert.match(rack, /window\.addEventListener\(MAP_PARAMETER_EVENT, map\)/)
  assert.match(rack, /Cancel mapping/)
  assert.match(search, /rowAfter\(rows\.length, index, event\.key as RowKey\)/)
  assert.match(search, /event\.key === 'Escape' && query/)
})

test('new browser styles use shell tokens, not literal colours', async () => {
  for (const name of ['WorldBrowser.css', 'NativeChosenControls.css', 'NativeMaterialBrowser.css']) {
    const css = await read(name)
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, `${name} has a literal colour`)
  }
})
