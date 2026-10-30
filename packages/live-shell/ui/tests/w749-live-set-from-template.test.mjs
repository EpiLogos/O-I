import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #749 (manual §10.3, "A set you want to start from again is a template … A new set started from it takes its tracks and its
// layout"; §16.7, "Start from a template — Open a template from the browser — A new set starts with the template's tracks and its
// layout"). The walk of 29 Oct left a template dimmed in Live sets, for want of an owner act. Now selecting it offers a new set's name
// and the project of your world it is kept in; Start asks the Live document owner (kernel live_set_owner.rs set_from_template,
// op live_set_from_template), and the new set opens. Channels: SCRIPTED (the rows and the form rendered on the server; the act's
// op and answer read through a stand-in call). The kernel's own tests copy a real template on a scratch home; not a screen pass (#821).
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
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url).pathname,'utf8')};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document = {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage = {getItem: () => null, setItem: () => {}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const pane = await import('../src/components/BrowserPane.tsx')
const html = element => renderToStaticMarkup(element)

const TEMPLATE = {path: '/home/Music/Ableton/User Library/Templates/Start Here.als', name: 'Start Here', standing: 'template', place: 'User Library'}
const PROJECTS = [{name: 'Album', path: '/w/Central/Work/Album'}, {name: 'Field', path: '/w/Central/Work/Field'}]

test('a template is a row to start a set from: pressable, never dimmed, its words say what selecting it does', () => {
  const markup = html(React.createElement(pane.LiveSetList, {rows: [TEMPLATE], words: null, openSet: () => {}}))
  assert.match(markup, /data-live-set="\/home\/Music\/Ableton\/User Library\/Templates\/Start Here.als" aria-pressed="false"/)
  assert.doesNotMatch(markup, /aria-disabled/)
  assert.match(markup, /data-i="Start Here\|A template of Live&#x27;s: select it to start a new set from it in one of your projects\. The new set takes its tracks and its layout; the template stays as it is\."/)
})

test('the new set goes first to the project the open set stands in, else the first project', () => {
  assert.equal(pane.projectForNewSet(PROJECTS, '/w/Central/Work/Field/Song.als'), 'Field')
  assert.equal(pane.projectForNewSet(PROJECTS, '/w/Central/Work/Fielding/Song.als'), 'Album', 'a sibling folder is not the project')
  assert.equal(pane.projectForNewSet(PROJECTS, null), 'Album')
  assert.equal(pane.projectForNewSet([], null), '')
})

test('the start form: the template\'s name to begin with, your projects to keep it in, and Start; or why it cannot start', () => {
  const start = projects => ({projects, start: async () => '/x.als'})
  const form = html(React.createElement(pane.TemplateStartForm, {template: TEMPLATE, start: start(PROJECTS), openSet: () => {}, openPath: '/w/Central/Work/Field/Song.als'}))
  assert.match(form, /data-template-start="\/home\/Music\/Ableton\/User Library\/Templates\/Start Here.als"/)
  assert.match(form, /aria-label="New set&#x27;s name"[^>]*value="Start Here"/)
  assert.match(form, /<option value="Album">Album<\/option><option value="Field" selected="">Field<\/option>/, 'the open set\'s project is chosen')
  assert.match(form, /data-action="start-from-template"[^>]*>Start<\/button>/)
  assert.match(html(React.createElement(pane.TemplateStartForm, {template: TEMPLATE, start: start(null), openSet: () => {}, openPath: null})), /Reading the projects of your world…/)
  assert.match(html(React.createElement(pane.TemplateStartForm, {template: TEMPLATE, start: start([]), openSet: () => {}, openPath: null})), /holds no project yet/)
  const refused = html(React.createElement(pane.TemplateStartForm, {template: TEMPLATE, start: start({refused: 'Error: Central did not disclose its worlds'}), openSet: () => {}, openPath: null}))
  assert.match(refused, /role="alert">The projects of your world are not read, so a new set has nowhere to be kept\. Central did not disclose its worlds\./)
})

test('Start asks the Live document owner for the new set and answers its path; a refusal is the owner\'s words', async () => {
  const asked = []
  const answer = await pane.startSetFromTemplate(async op => {
    asked.push(op)
    return {outcome: {result: 'live_set_started', reading: {schema: 'oi.live-set-from-template/v1', path: '/w/Central/Work/Album/First Take.als', name: 'First Take',
      project: 'Album', template: TEMPLATE.path, tracks: 3}}}
  }, TEMPLATE.path, 'Album', 'First Take')
  assert.deepEqual(asked, [{op: 'live_set_from_template', template: TEMPLATE.path, project: 'Album', name: 'First Take'}])
  assert.equal(answer, '/w/Central/Work/Album/First Take.als')
  await assert.rejects(pane.startSetFromTemplate(async () => ({outcome: null, error: 'A set named First Take stands in Album already: choose another name'}), TEMPLATE.path, 'Album', 'First Take'),
    /stands in Album already/)
})
