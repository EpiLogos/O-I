import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Clip view on a Central page (clip:central, its Page tab): a page the owner has not read says so; a page the owner read and found
// holding nothing ('[]', as an empty file reads — seen natively on Day · Tue 13 Oct, 0 B, the empty hash) says it is empty; a reading
// that is not a list of paragraphs says that, never a plausible page.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.includes('?raw')||url.endsWith('.html'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText.split('import.meta.env').join('({BASE_URL: "/"})')};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {clip} = await import('../src/inhabitants/catalogue/clips/central.tsx')
const pageTab = clip.editor.find(tab => tab.id === 'page')
const draw = values => renderToStaticMarkup(React.createElement(React.Fragment, null, pageTab.draw({v: values, set: noop, size: 'whole', room: {w: 800, h: 400}})))

test('the Page tab tells an unread page from an empty one, and a malformed reading from both', () => {
  assert.match(draw({}), /No reading of the page yet\./)
  assert.match(draw({page: '[]'}), /The page is empty\./)
  assert.doesNotMatch(draw({page: '[]'}), /No reading/)
  assert.match(draw({page: '{"not": "a list"}'}), /not a list of paragraphs/)
  const drawn = draw({page: JSON.stringify([{id: 'p1', kind: 'p', parts: [{text: 'The Day opens.'}]}])})
  assert.match(drawn, /The Day opens\./)
})
