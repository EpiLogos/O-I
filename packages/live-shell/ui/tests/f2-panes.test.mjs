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
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

// FOUNDATION F2 in the candidate: the panes are the centre in every mode. An instrument opens in the focused pane, in a
// named pane, or on a pane's edge; a mode's first tree is seeded from its registration and a seed never replaces a tree
// the mode already arranged. Loaded as erasable TypeScript (--experimental-strip-types).
const {openInstrumentAt, seedInstruments} = await import('../src/frame/openInstrument.ts')
const {groupsOf} = await import('../../../../desktop/cradle/src/surface/engine.ts')
const {MODE_FRAMES, MODE_TRACK_SOURCES} = await import('../src/shell/modeFrames.ts')

const group = (id, tabs) => ({type: 'group', id, tabs, pinned: [], active: tabs[0] ?? null})
const empty = () => ({root: group('g1', []), surfaces: {}, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel', rightDepth: 'collapsed', leftWidth: 260, rightWidth: 320})
const kinds = layout => groupsOf(layout.root).map(g => g.tabs.map(id => layout.surfaces[id].kind))

test('an instrument opens in the focused pane, and again it is the same pane, not a second', () => {
  const once = openInstrumentAt(empty(), 'projection.earth')
  assert.deepEqual(kinds(once), [['projection.earth']])
  const twice = openInstrumentAt(once, 'projection.earth')
  assert.equal(Object.keys(twice.surfaces).length, 1)
  const held = empty()
  assert.equal(openInstrumentAt(held, 'not-a-kind'), held, 'a name that is not a pane kind opens nothing')
})

test('an instrument dropped on a pane\'s edge opens beside it; dropped in the middle of another pane it moves there', () => {
  const stage = openInstrumentAt(empty(), 'projection.expressions')
  const beside = openInstrumentAt(stage, 'projection.constellation', {groupId: 'g1', edge: 'right'})
  assert.deepEqual(kinds(beside), [['projection.expressions'], ['projection.constellation']], 'Graph dragged beside the stage opens there')
  const [, right] = groupsOf(beside.root)
  const moved = openInstrumentAt(beside, 'projection.expressions', {groupId: right.id, edge: null})
  assert.deepEqual(kinds(moved).flat().sort(), ['projection.constellation', 'projection.expressions'])
  assert.equal(groupsOf(moved.root).length, 1, 'the emptied pane closes; one instrument is never in two panes')
})

test('a mode\'s first tree is seeded, and a seed never touches a tree that already holds a tab', () => {
  const seeded = seedInstruments(['projection.expressions', 'projection.timeline'])(empty())
  assert.deepEqual(kinds(seeded), [['projection.expressions'], ['projection.timeline']])
  assert.equal(seedInstruments(['projection.earth'])(seeded), seeded)
})

test('every mode stands on the pane tree, and its tracks come from its registration', () => {
  for (const frame of Object.values(MODE_FRAMES)) assert.equal(frame.centerPanel, 'native.workbench')
  assert.deepEqual(MODE_TRACK_SOURCES, {live: 'set', base: 'world', factory: 'world', expressions: 'native', techne: 'world'})
})
