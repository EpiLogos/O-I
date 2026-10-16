import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Lane F, F2: entering a palace from World › Palaces always brings the Earth into view (PATH, lane U, 30ba8692f: "World ›
// Palaces opens the Earth, waits for its owners, enters — a wait that ends says so"). Seen natively (the lead, 16 Oct): the
// focused pane held the hosted frame's Canvas; the walk started on the transport ("Locus 2/5") and the row read "entered on the
// Ea…", but the pane kept the Canvas — the Earth's palace owners were bound (the Earth stood behind the Canvas, a tab of the same
// pane), so the entry skipped the door and never asked for the Earth. Now the door is asked every time, and the pane tree brings
// the Earth into view: into the focused pane when it follows the selection, beside it when it holds what it opened or is pinned.
// Headless (lane F): Technē's focused pane holding Canvas with the Earth behind — the door put the Earth beside, the Canvas kept.
// Channel here: scripted.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/') || s === 'react-dom' || s.startsWith('react-dom/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const source = (await readFile(new URL(u), 'utf8')).replace(/import\\.meta\\.env/g, '({BASE_URL:"/"})');
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(source, {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const world = await import('../src/projections/atlas/palaces/palacesWorld.ts')
const session = await import('../src/projections/atlas/palaces/palaceSession.ts')
const door = await import('../src/frame/instrumentDoor.ts')
const {openInstrumentAt} = await import('../src/frame/openInstrument.ts')
const {groupsOf} = await import('../../../../desktop/cradle/src/surface/engine.ts')

const group = (id, tabs) => ({type: 'group', id, tabs, pinned: [], active: tabs[0] ?? null})
const empty = () => ({root: group('g1', []), surfaces: {}, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel', rightDepth: 'collapsed', leftWidth: 260, rightWidth: 320})
/** Each pane: its tabs' kinds, the one in front marked *. */
const panes = layout => groupsOf(layout.root).map(g => g.tabs.map(id => `${g.active === id ? '*' : ''}${layout.surfaces[id].kind}`).join(' '))
const follows = kind => kind !== 'projection.expressions' && kind !== 'projection.central-document'

test('a palace entered while the Earth\'s owners are bound still asks for the Earth: the walk never starts on an Earth out of view', async () => {
  // owners bound, as when the Earth stands behind the Canvas: the entry itself never settles here (the owner's hold waits)
  session.bindPalaceOwners({hold: () => new Promise(() => {}), inspect: () => new Promise(() => {}), readWhole: () => new Promise(() => {}),
    list: async () => [], edit: () => new Promise(() => {}), invoke: () => new Promise(() => {})})
  try {
    let opened = 0
    const said = await world.enterFromOutside({key: 'central', title: 'Central'}, () => { opened++ }, 30)
    assert.equal(opened, 1, 'the Earth is asked into view even though the palace could be entered at once (was 0: no door)')
    assert.equal(said, null, 'entering began')
  } finally {
    session.bindPalaceOwners(null)
  }
})

test('the Earth comes into view: beside a pane that holds the Canvas, never behind it', () => {
  // Technē, as the lead had it: the focused pane holds the hosted frame's Canvas, the Earth a tab behind it
  const held = openInstrumentAt(openInstrumentAt(empty(), 'projection.earth'), 'projection.expressions')
  assert.deepEqual(panes(held), ['projection.earth *projection.expressions'])
  const inView = door.instrumentInView(held, 'projection.earth', undefined, follows)
  assert.deepEqual(panes(inView), ['*projection.expressions', '*projection.earth'], 'the Earth beside; the Canvas still in front of its pane')
  // not opened at all yet: beside the held pane too
  const stage = openInstrumentAt(empty(), 'projection.expressions')
  assert.deepEqual(panes(door.instrumentInView(stage, 'projection.earth', undefined, follows)), ['*projection.expressions', '*projection.earth'])
})

test('into the focused pane when it follows the selection; left alone when it is already in front; shown where it already stands', () => {
  const graph = openInstrumentAt(empty(), 'projection.constellation')
  assert.deepEqual(panes(door.instrumentInView(graph, 'projection.earth', undefined, follows)), ['projection.constellation *projection.earth'],
    'a following pane takes it (manual §10.2: a pane follows what you select)')
  const front = openInstrumentAt(empty(), 'projection.earth')
  assert.deepEqual(panes(door.instrumentInView(front, 'projection.earth', undefined, follows)), ['*projection.earth'], 'in front already: no second Earth')
  const elsewhere = openInstrumentAt(openInstrumentAt(openInstrumentAt(empty(), 'projection.earth'), 'projection.constellation'),
    'projection.expressions', {groupId: 'g1', edge: 'right'})
  assert.deepEqual(panes(elsewhere), ['projection.earth *projection.constellation', '*projection.expressions'])
  assert.deepEqual(panes(door.instrumentInView(elsewhere, 'projection.earth', undefined, follows)), ['*projection.earth projection.constellation', '*projection.expressions'],
    'behind its tab in another pane: that pane shows it, the focused pane keeps its own')
  const pinned = openInstrumentAt(empty(), 'projection.constellation', undefined, {ref: 'wiki:central', title: 'Central'})
  assert.deepEqual(panes(door.instrumentInView(pinned, 'projection.earth', undefined, follows)), ['*projection.constellation', '*projection.earth'],
    'a pane pinned to a subject keeps it; the Earth opens beside')
})

test('the door says in-view to the pane tree, and World › Palaces enters through it', async () => {
  const asked = []
  door.publishInstrumentOpener((kind, at) => asked.push([kind, at ?? null]))
  try {
    door.bringInstrumentIntoView('projection.earth')
    assert.deepEqual(asked, [['projection.earth', 'in-view']])
  } finally {
    door.publishInstrumentOpener(null)
  }
  assert.throws(() => door.bringInstrumentIntoView('projection.earth'), /No pane tree is mounted/)
  const browser = await readFile(new URL('../src/shell/ModeBrowser.tsx', import.meta.url), 'utf8')
  assert.match(browser, /enterFromOutside\(palace, \(\) => bringInstrumentIntoView\('projection\.earth'\)\)/)
  const workbench = await readFile(new URL('../src/native/Workbench.tsx', import.meta.url), 'utf8')
  assert.match(workbench, /at === 'in-view' \? instrumentInView\(layout, kind, subject\) : openInstrumentAt\(layout, kind, at, subject\)/, 'the candidate\'s pane tree answers it')
})
