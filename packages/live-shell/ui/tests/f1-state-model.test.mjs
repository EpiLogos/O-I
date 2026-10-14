import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Loader as live-browser-chain.test.mjs: extensionless TypeScript imports, transpiled in memory.
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
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

// FOUNDATION F1 in the candidate: Live's selection is the world's one selection (a ref the open set anchors), and each
// mode first opens on its registered frame. Loaded as erasable TypeScript (--experimental-strip-types).
const {liveWorldSelection, setSelectionOf} = await import('../src/shell/liveSelection.ts')
const {MODE_FRAMES} = await import('../src/shell/modeFrames.ts')
const {SURF_MODES} = await import('../src/shell/modeGrammar.ts')

const set = {path: '/sets/demo.als', tracks: [{name: 'Pad', kind: 'midi', devices: []}, {name: 'Bass', kind: 'audio', devices: []}]}

test('a Live track, slot or clip becomes the one selection and reads back the same', () => {
  for (const value of [{track: 1, scene: null}, {track: 0, scene: 3}, {track: 1, scene: null, clip: 2}]) {
    const selection = liveWorldSelection(value, set)
    assert.equal(selection.mode, 'live')
    assert.deepEqual(setSelectionOf(selection, set.path), value.clip === undefined ? value : {track: 1, scene: null, clip: 2})
  }
  assert.equal(liveWorldSelection({track: 0, scene: null}, set).title, 'Pad')
  assert.equal(liveWorldSelection({track: 0, scene: 3}, set).track, 'als:/sets/demo.als#track/0', 'a slot names its track')
})

test('a selection elsewhere, or in another set, is not Live\'s', () => {
  assert.equal(liveWorldSelection({track: 0, scene: null}, null), null, 'with no set nothing of Live\'s is selected')
  assert.equal(setSelectionOf({mode: 'base', kind: 'day', ref: 'Control/agents/now/day/2026-10-14.md', title: 'x'}, set.path), null)
  assert.equal(setSelectionOf(liveWorldSelection({track: 0, scene: null}, set), '/sets/other.als'), null)
})

test('every mode has an opening frame, read from a table', () => {
  assert.deepEqual(Object.keys(MODE_FRAMES).sort(), [...SURF_MODES].sort())
  for (const frame of Object.values(MODE_FRAMES)) {
    assert.ok(frame.centerPanel && (frame.tab === 'session' || frame.tab === 'arrangement') && (frame.detailMode === 'clip' || frame.detailMode === 'device'))
  }
  assert.equal(MODE_FRAMES.live.detailMode, 'device', 'Live opens on its chain')
})
