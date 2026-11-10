import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// XF09 of the walk of O-I #857 (round 53; DLW build ruling 2026-11-09): "+ Parameter" and the browser's Parameters. The story: "The
// browser opens on the field's and the symbols' parameters; my choices stand as macros". The walk (r52-XF09-b-01-add, r53-XF09) found
// "+ Parameter" left the browser on the category it stood on (Expressions), because the frame's one browser holds its category in the
// book and the parameters' own category state is not the book's; and a double-click on a parameter added nothing, where a drag added it.
// SCRIPTED: the browse's category from the Expressions source's own categories; the double-click's change and its reasons, the drop's.
// CODE-READING: the App chooses that category on + Parameter; the parameter row adds on a double-click.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const drag = await import('../src/components/nativeDrag.ts')
const model = await import('../src/components/nativeBrowserModel.ts')
const {WORLD_BROWSER_CATEGORIES} = await import('../src/components/worldBrowserCategories.ts')
const src = name => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')

test('+ Parameter opens the browser on Expressions\' Parameters: the category the book holds, by its own key', async () => {
  const expressions = {id: 'expressions', categories: WORLD_BROWSER_CATEGORIES}
  const sessions = {id: 'sessions', categories: [{id: 'running'}]}
  assert.equal(drag.parameterCategory([expressions, sessions]), 'expressions:properties')
  assert.equal(WORLD_BROWSER_CATEGORIES.find(category => category.id === 'properties')?.label, 'Parameters')
  assert.equal(drag.parameterCategory([sessions]), null, 'a mode whose browser has no parameters opens the browser and chooses nothing')
  const modes = await src('shell/modeBrowsers.tsx')
  assert.match(modes, /expressions: \(\) => \[\{id: 'expressions', categories: WORLD_BROWSER_CATEGORIES/, 'Expressions\' browser is that source')
  const app = await src('App.tsx')
  const handler = app.slice(app.indexOf('const browseParameters = () => {'), app.indexOf('window.addEventListener(PARAMETER_BROWSE_EVENT, browseParameters)'))
  assert.match(handler, /chooseBrowserCategory\(category\)/, 'the App chooses it in the book')
  assert.match(handler, /parameterCategory\(browserSourcesOf\(frameMode\)\)/)
})

const field = {path: 'ink.opacity', key: 'opacity', label: 'Ink · Ink Opacity', unit: null, min: 0, max: 1}
const reading = (entries = [], over = {}) => ({chosenControls: {available: true, entries, controls: []}, standing: {pending: false}, selection: {entity_ids: []},
  scene: {entities: []}, entityOccurrences: {}, ...over})

test('a double-click on a parameter adds it to your macros as a drop onto the Studio does: the same change, the same reasons', () => {
  const payload = model.parameterDragFor(field, 'field', 'selected')
  assert.deepEqual(model.parameterAdd(payload, reading()), {change: model.chosenAddChange(payload)})
  assert.deepEqual(model.parameterAdd(payload, reading([{id: 'b1', key: 'opacity', scope: 'field'}])), {why: 'Already chosen in this scope'})
  assert.deepEqual(model.parameterAdd(payload, reading([], {standing: {pending: true}})), {why: 'Waiting for the native owner to acknowledge the last change'})
  assert.deepEqual(model.parameterAdd(payload, null), {why: 'Open an Expression to choose controls'})
})

test('the parameter row adds on a double-click, through the editor\'s one apply, and says why when it does not', async () => {
  const browser = await src('components/NativePropertyBrowser.tsx')
  const row = browser.slice(browser.indexOf('className={`world-file-row world-property-row'), browser.indexOf('<span aria-hidden="true">○</span>'))
  assert.match(row, /onDoubleClick=\{\(\) => add\(binding\)\}/)
  const add = browser.slice(browser.indexOf('const add = (binding: Property)'), browser.indexOf('function startDrag'))
  assert.match(add, /parameterAdd\(parameterDragFor\(binding, kind, scope\), reading \?\? null\)/)
  assert.match(add, /setFault\(decided\.why\)/)
  assert.match(add, /applyEdit\(\[decided\.change\]\)/)
})
