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
const {instrumentEntries, instrumentPayload, parseInstrumentPayload, STAGE_LENSES} = await import('../src/frame/instruments.ts')
const door = await import('../src/frame/instrumentDoor.ts')
const modules = await import('../../../../desktop/cradle/src/surface/projectionModules.ts')
const {readFile} = await import('node:fs/promises')

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

// ── the Instruments list and what a stage-lens row carries ──────────────────

const admitAll = () => {
  modules.resetProjectionModulesForTest()
  for (const kind of ['projection.timeline', 'projection.expressions', 'projection.earth', 'projection.constellation', 'projection.device']) {
    modules.registerProjectionModule({id: `m-${kind}`, kind, create: () => ({unmount() {}})})
  }
}

test('the Instruments list names instruments: an admitted pane kind that is not one (the device pane) is not listed', () => {
  admitAll()
  const entries = instrumentEntries()
  const kinds = entries.map(entry => entry.kind)
  assert.ok(!kinds.includes('projection.device'), 'projection.device holds a device the rack shows; it is not an instrument')
  for (const kind of ['projection.timeline', 'projection.earth', 'projection.constellation', 'projection.expressions']) assert.ok(kinds.includes(kind), kind)
  assert.deepEqual(entries.filter(entry => entry.lens).map(entry => entry.lens), ['canvas', 'timeline', 'journey', 'palace'], 'the stage carries its four lenses')
  assert.ok(entries.every(entry => entry.label && entry.note), 'every row is named and says what it is for')
})

test('a stage lens travels with its kind in one payload, and a layout opens the stage from it', () => {
  admitAll()
  for (const entry of STAGE_LENSES) {
    const payload = instrumentPayload(entry)
    assert.equal(payload, `projection.expressions#${entry.lens}`)
    assert.deepEqual(parseInstrumentPayload(payload), {kind: 'projection.expressions', lens: entry.lens})
    assert.deepEqual(kinds(openInstrumentAt(empty(), payload)), [['projection.expressions']], `${payload} opens the stage`)
  }
  assert.deepEqual(parseInstrumentPayload('projection.earth'), {kind: 'projection.earth'})
  assert.deepEqual(parseInstrumentPayload('projection.expressions#nonsense'), {kind: 'projection.expressions'}, 'a lens the stage does not carry is dropped')
  assert.deepEqual(parseInstrumentPayload('projection.earth#canvas'), {kind: 'projection.earth'}, 'a lens belongs to the stage alone')
  const beside = openInstrumentAt(openInstrumentAt(empty(), 'projection.earth'), 'projection.expressions#journey', {groupId: 'g1', edge: 'right'})
  assert.deepEqual(kinds(beside), [['projection.earth'], ['projection.expressions']], 'dropped on an edge, the stage opens beside it')
})

test('the door opens the instrument where asked and then turns the stage: a double-click and a drop do the same thing', () => {
  const opened = [], turned = []
  door.publishInstrumentOpener((kind, at) => opened.push([kind, at?.groupId ?? null]))
  door.publishStageLensDriver((lens, refused) => { turned.push(lens); if (lens === 'palace') refused('The stage owner takes no palace here.') })
  door.reportInstrumentFault(null)
  door.openInstrument('projection.earth')
  assert.deepEqual(turned, [], 'a plain instrument turns nothing')
  door.openInstrument('projection.expressions#canvas', {groupId: 'g2', edge: 'right'})
  assert.deepEqual(opened.at(-1), ['projection.expressions', 'g2'], 'the stage opens in the pane it was dropped on, by its kind alone')
  assert.deepEqual(turned, ['canvas'], 'and is turned to the lens the payload carried')
  assert.equal(door.instrumentFault(), null)
  door.openInstrument('projection.expressions#palace')
  assert.equal(door.instrumentFault(), 'The stage owner takes no palace here.', 'the owner\'s refusal is said in the fault line, whichever road opened it')
  door.reportInstrumentFault(null)
  door.publishInstrumentOpener(null)
  turned.length = 0
  assert.throws(() => door.openInstrument('projection.expressions#canvas'), /No pane tree is mounted/)
  assert.deepEqual(turned, [], 'nothing is turned when nothing opened')
  door.publishStageLensDriver(null)
})

test('the row drags its payload, so the drop carries the lens; the pane drop reaches the door', async () => {
  const section = await readFile(new URL('../src/frame/InstrumentsSection.tsx', import.meta.url), 'utf8')
  assert.match(section, /setData\(INSTRUMENT_DRAG_TYPE, instrumentPayload\(entry\)\)/, 'the drag carries kind and lens in the one payload the panes read')
  assert.match(section, /openInstrument\(instrumentPayload\(entry\)\)/, 'a double-click opens through the same payload')
})
