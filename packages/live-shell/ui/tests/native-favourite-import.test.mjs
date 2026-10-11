import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Production browser model in memory, same loader as the sibling native tests.
// Readings are minimal fixtures: they are not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)


const [model, {NATIVE_BINDINGS}] = await Promise.all([
  import('../src/components/nativeBrowserModel.ts'),
  import(parameters),
])
const {favouriteImportChanges} = model

test('Scene favourites import as one chosen-add per admitted Field parameter that the toolbelt does not hold', () => {
  const [first, second] = NATIVE_BINDINGS.map(binding => binding.key)
  const chosen = [{key: second, scope: 'field'}]
  const {changes, skipped} = favouriteImportChanges([first, second, 'absent-favourite', first], chosen)
  assert.deepEqual(changes, [{kind: 'chosen-add', key: first, scope: 'field'}], 'one change for the new admitted key, once');
  assert.deepEqual(skipped, ['absent-favourite'], 'a favourite with no native Field definition is reported, not invented');
})

test('an absent or empty favourites list imports nothing, and a Named or Selected chosen control does not count as the Field one', () => {
  const key = NATIVE_BINDINGS[0].key;
  assert.deepEqual(favouriteImportChanges(undefined, []), {changes: [], skipped: []});
  assert.deepEqual(favouriteImportChanges([], []), {changes: [], skipped: []});
  assert.deepEqual(favouriteImportChanges([key], [{key, scope: 'selected'}]).changes, [{kind: 'chosen-add', key, scope: 'field'}]);
  assert.deepEqual(favouriteImportChanges([key], [{key, scope: 'field'}]), {changes: [], skipped: []}, 'already in the toolbelt');
})
