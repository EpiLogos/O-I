import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import {register} from 'node:module'

// Loader as af741-workbench-tabs.test.mjs: extensionless TypeScript imports transpiled in memory; ?raw page scripts load as empty text.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url).pathname,'utf8')};
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})
globalThis.__CRADLE_WALK__ = false

// Lane AF (O-I #741). DLW §18.4 "The line anywhere": "⌘F finds where you are … in a pane it finds in the instrument in front, as VS
// Code's ⌘F finds in the file in front". Before this lane ⌘F only ever focused the browser's search (frame/keys/planKey.ts 'search'),
// wherever the focus stood. The rules taken from VS Code 1.141 (campaign-evidence/2026-10-29-vscode-workbench-re/DECODE.md): the find
// widget finds as you type ("find.findOnType"), case-insensitive by default, counts "{0} of {1}" or "No results", Enter is Next Match
// and ⇧Enter Previous Match with wrap-around ("editor.find.loop": true), ⌘G / ⇧⌘G step from the editor, the search is seeded from the
// selection ("editor.find.seedSearchStringFromSelection": "always"), at most 19999 matches are marked ("title.matchesCountLimit"),
// and Escape closes it and gives the editor its focus back.

const script = await readFile(new URL('../../../../desktop/cradle/src/context/document-find.js', import.meta.url), 'utf8').catch(() => null)

/** The page script in a bare realm: it touches no page until the host asks, so a realm with listeners and nothing else loads it. */
function pageRealm() {
  const heard = {message: [], keydown: []}
  const window = {addEventListener: (type, listener) => heard[type]?.push(listener)}
  const document = {addEventListener: (type, listener) => heard[type]?.push(listener)}
  window.window = window
  window.parent = window
  const context = vm.createContext({window, document, parent: window})
  vm.runInContext(script, context)
  return {window, heard}
}

test('the page\'s find marks what VS Code\'s does: case-insensitive, literal, non-overlapping, at most 19999', () => {
  assert.ok(script, 'desktop/cradle/src/context/document-find.js: the find the document frame carries')
  const {window} = pageRealm()
  const held = window.__OI_DOCUMENT_FIND__
  assert.equal(typeof held?.matches, 'function', 'the page script states its matcher')
  // The page's arrays are another realm's: read them as plain data.
  const find = {matches: (...args) => JSON.parse(JSON.stringify(held.matches(...args))), LIMIT: held.LIMIT}
  assert.deepEqual(find.matches('The stone. the STONE carved', 'the'), [[0, 3], [11, 14]], 'case-insensitive, in order')
  assert.deepEqual(find.matches('aaaa', 'aa'), [[0, 2], [2, 4]], 'a match starts after the last one ends, as the editor counts them')
  assert.deepEqual(find.matches('a+b (c) a.b', 'a.b'), [[8, 11]], 'the words are found as typed: no pattern of their own')
  assert.deepEqual(find.matches('anything', ''), [], 'nothing typed: nothing found')
  assert.deepEqual(find.matches('one\ntwo', 'one two'), [], 'two blocks of the page are not one line of words')
  assert.equal(find.matches('x'.repeat(30000), 'x').length, 19999, 'the marks stop at VS Code\'s limit')
  assert.equal(find.LIMIT, 19999)
})

test('the page answers only its host, and touches nothing until it is asked', () => {
  const {heard} = pageRealm()
  assert.equal(heard.message.length, 1, 'one listener for the host\'s questions')
  assert.equal(heard.keydown.length, 1, 'one for ⌘F, ⌘G and Escape typed inside the page')
  // A message from anything but the page's parent is not a question.
  assert.doesNotThrow(() => heard.message[0]({source: {}, data: {type: 'oi:document-find', request: 'r', op: 'find', query: 'x'}}))
})

test('the document frame carries the find: after the page\'s <head>, never before its doctype', async () => {
  const frame = await import('../../../../desktop/cradle/src/document/frame.ts').catch(error => ({error}))
  assert.equal(typeof frame.withFrameScript, 'function', 'frame.ts places a page script in a projection')
  const tag = '<script>FIND</script>'
  assert.equal(frame.withFrameScript('<!doctype html><html><head><title>t</title></head><body>b</body></html>', tag),
    `<!doctype html><html><head>${tag}<title>t</title></head><body>b</body></html>`)
  assert.equal(frame.withFrameScript('<!DOCTYPE html>\n<html lang="en"><body>b</body></html>', tag), `<!DOCTYPE html>\n<html lang="en">${tag}<body>b</body></html>`)
  assert.equal(frame.withFrameScript('<!doctype html><p>b</p>', tag), `<!doctype html>${tag}<p>b</p>`, 'a doctype stays first: the page keeps its standards mode')
  assert.equal(frame.withFrameScript('<p>b</p>', tag), `${tag}<p>b</p>`)
  const source = await readFile(new URL('../../../../desktop/cradle/src/document/frame.ts', import.meta.url), 'utf8')
  assert.ok(/withFrameScript\(\w+, documentFindScript\)/.test(source), 'useDocumentFrame frames every hosted document with it: the Day, a Flow, a Being, a Thing')
})

test('⌘F finds in the pane in front; the browser keeps it where the focus stands in the browser', async () => {
  const doors = await import('../src/frame/paneFind.ts')
  const {planKey} = await import('../src/frame/keys/planKey.ts')
  const opened = []
  const stop = doors.registerPaneFinder('flow', {open: () => opened.push('flow')})
  const element = (marks) => ({closest: selector => selector.split(',').map(s => s.trim()).some(s => marks[s]) ? {
    querySelector: () => ({getAttribute: () => marks.binding ?? null}), getAttribute: () => null} : null})
  assert.equal(doors.paneFinderInFront(element({'.one-browser': true}), 'flow'), null, 'focus in the browser: the browser narrows its list')
  assert.equal(doors.paneFinderInFront(element({'.pane.group': true, binding: 'flow'}), 'day'), doors.paneFinder('flow'), 'focus in a pane: that pane\'s document')
  assert.equal(doors.paneFinderInFront(null, 'flow'), doors.paneFinder('flow'), 'focus loose on the page: the focused pane')
  assert.equal(doors.paneFinderInFront(element({'.pane.group': true, binding: 'timeline'}), 'flow'), null, 'a pane whose instrument finds nothing has no finder')
  // WebKit leaves a pressed button unfocused: with the focus loose, the place last pressed says where you are.
  assert.equal(doors.paneFinderInFront(null, 'flow', element({'.one-browser': true})), null, 'a press in the browser, the focus loose: the browser\'s ⌘F')
  assert.equal(doors.paneFinderInFront(null, 'day', element({'.pane.group': true, binding: 'flow'})), doors.paneFinder('flow'), 'a press in a pane: that pane\'s find')
  const page = element({'.pane.group': true, binding: 'flow'}), browserRow = element({'.one-browser': true})
  assert.equal(doors.paneFinderInFront(page, 'day', browserRow, false), doors.paneFinder('flow'), 'the focus moved after the press: the focus says where')
  assert.equal(doors.paneFinderInFront(page, 'flow', browserRow, true), null, 'the press came after the focus (the page kept it, the hand moved to the browser): the press says where')
  // The window's own record: a press, then the focus moving into a page, then a press again.
  doors.notePress(browserRow); assert.equal(doors.lastPress().since, true)
  doors.noteFocusMoved(); assert.equal(doors.lastPress().since, false, 'the focus moved after the press')
  doors.notePress(page); assert.equal(doors.lastPress().target, page)

  const browser = []
  const keyDoors = (finder) => ({transport: () => null, rows: () => null, device: () => null, openable: () => null,
    searchAvailable: () => true, search: () => { browser.push('browser'); return true }, paneFind: () => finder})
  planKey({id: 'search'}, keyDoors(doors.paneFinder('flow'))).run()
  assert.deepEqual([opened, browser], [['flow'], []], 'a pane that finds: its find opens, the browser is left alone')
  planKey({id: 'search'}, keyDoors(null)).run()
  assert.deepEqual(browser, ['browser'], 'no pane finds: the browser\'s search, as before')
  stop()
  assert.equal(doors.paneFinder('flow'), null, 'a pane that leaves withdraws its finder')
})

test('the find line counts as VS Code\'s does, and its keys are the find widget\'s', async () => {
  const model = await import('../src/central/documents/documentFindModel.ts')
  assert.equal(model.findWords('', null), '')
  assert.equal(model.findWords('stone', {query: 'stone', count: 0, current: 0}), 'No results')
  assert.equal(model.findWords('stone', {query: 'stone', count: 5, current: 2}), '2 of 5')
  assert.equal(model.findWords('stone', {query: 'ston', count: 5, current: 2}), '', 'an answer to an earlier query is not this one\'s')
  assert.equal(model.findWords('x', {query: 'x', count: 19999, current: 1, limited: true}), '1 of 19999+', 'the limit is said')
  const key = (key, extra = {}) => model.findKeyOf({key, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, ...extra})
  assert.equal(key('Enter'), 'next')
  assert.equal(key('Enter', {shiftKey: true}), 'previous')
  assert.equal(key('g', {metaKey: true}), 'next')
  assert.equal(key('G', {metaKey: true, shiftKey: true}), 'previous')
  assert.equal(key('Escape'), 'close')
  assert.equal(key('f', {metaKey: true}), 'select', '⌘F again in the line takes its words again')
  assert.equal(key('a'), null)
})
