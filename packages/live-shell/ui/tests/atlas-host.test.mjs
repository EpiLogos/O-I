import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The Earth projection's shell host (T-ATLAS-HOST, host leg): the lens bar's cut and pressed states, the workspace-scoped
// memory of the atlas, the admission of the centre panel and the two pane kinds, and the honest refusals. Production
// modules in memory (the mode-grammar loader pattern): .ts/.tsx transpiled, CSS and JSON stubbed. The atlas itself is
// not mounted here: it needs WebGL and a kernel; its mount is UNVERIFIED headless and is verified on screen.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
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
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const html = element => renderToStaticMarkup(element)
const lensesOf = out => (out.match(/<button[\s\S]*?<\/button>/g) ?? []).map(button => ({
  name: button.match(/<span>([^<]+)<\/span>/)?.[1],
  state: button.match(/data-lens-state="([^"]+)"/)?.[1],
  pressed: button.match(/aria-pressed="(true|false)"/)?.[1] === 'true',
  disabled: /disabled=""/.test(button),
}))
const lensNamed = (out, name) => lensesOf(out).find(lens => lens.name === name)
const panelSource = new URL('../src/projections/atlas/AtlasProjectionPanel.tsx', import.meta.url)

// Admission before any workspace is bound: the door refuses honestly, and claims nothing.
test('the Earth pane kinds are admitted once; a door with no bound workspace refuses and claims nothing', async () => {
  const {registerAtlasHost, ATLAS_PANEL_ID, ATLAS_MODULE_ID} = await import('../src/projections/atlas/registerAtlasHost.ts')
  const {getPanels} = await import('../src/shell/panels.ts')
  const {projectionModule, registerProjectionModule} = await import('../../../../desktop/cradle/src/surface/projectionModules.ts')
  registerAtlasHost()
  registerAtlasHost()
  const centre = getPanels('center').filter(panel => panel.id === ATLAS_PANEL_ID)
  assert.equal(centre.length, 1, 'the centre panel is registered once')
  assert.equal(centre[0].navigation, false, 'the lens bar is its entry; the transport list does not name it')
  for (const kind of ['projection.earth', 'projection.constellation']) {
    assert.equal(projectionModule(kind)?.id, ATLAS_MODULE_ID, `${kind} is admitted under the atlas module`)
  }
  assert.equal(projectionModule('projection.timeline'), undefined, 'no kind is claimed that the atlas does not mount')
  assert.throws(() => registerProjectionModule({id: 'other-owner', kind: 'projection.earth', create: () => ({unmount() {}})}),
    /already admitted by "atlas-earth"/, 'a second, different module for the kind is refused')
  const element = {replaceChildren() {}, append() {}}
  await assert.rejects(
    () => projectionModule('projection.earth').create({kind: 'projection.earth', binding: {id: 'b1', title: 'Earth'}, element, encounter: {}}),
    /No workspace is bound for the Earth projection/,
    'the door names the missing workspace rather than mounting without a memory',
  )
})

test('the lens bar cuts Places and Project / graph to the Earth atlas and keeps the rest honest', async () => {
  const {TechneLensBar} = await import('../src/shell/ModeDetail.tsx')
  const out = html(createElement(TechneLensBar, {presentation: 'session', atlasOpen: false, onLens() {}}))
  assert.equal(lensNamed(out, 'Places').state, 'cut', 'Places is cut')
  assert.equal(lensNamed(out, 'Project / graph').state, 'cut', 'Project / graph is cut')
  assert.equal(lensNamed(out, 'Timeline').state, 'cut')
  assert.equal(lensNamed(out, 'Journey').state, 'cut')
  assert.equal(lensNamed(out, 'Canvas').state, 'waiting', 'Canvas holds its place, named')
  assert.equal(lensNamed(out, 'Palace').state, 'waiting', 'Palace holds its place, named')
  assert.equal(lensNamed(out, 'Canvas').disabled, true, 'a waiting lens is disabled')
  assert.equal(lensNamed(out, 'Places').disabled, false, 'a cut lens is live')
})

test('the lens bar presses the open lens: the atlas view while the atlas is the centre, the World cut otherwise', async () => {
  const {TechneLensBar} = await import('../src/shell/ModeDetail.tsx')
  const {presentAtlasView} = await import('../src/projections/atlas/AtlasProjectionPanel.tsx')
  const pressed = out => lensesOf(out).filter(lens => lens.pressed).map(lens => lens.name)

  presentAtlasView('graph')
  assert.deepEqual(pressed(html(createElement(TechneLensBar, {presentation: 'session', atlasOpen: true, onLens() {}}))), ['Project / graph'],
    'the graph view presses Project / graph and nothing else')

  presentAtlasView('earth')
  assert.deepEqual(pressed(html(createElement(TechneLensBar, {presentation: 'session', atlasOpen: true, onLens() {}}))), ['Places'],
    'the globe view presses Places')

  assert.deepEqual(pressed(html(createElement(TechneLensBar, {presentation: 'session', atlasOpen: false, onLens() {}}))), ['Journey'],
    'with the World cut open, the atlas lenses are not pressed and the presentation is')
})

test('the atlas memory is bound to the workspace namespace and to one workspace id at a time', async () => {
  const {bindAtlasScope, atlasMemoryStorage} = await import('../src/projections/atlas/AtlasProjectionPanel.tsx')
  const areaMap = new Map([['unrelated.key', 'kept']])
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, writable: true, value: {
    get length() {return areaMap.size},
    key: index => [...areaMap.keys()][index] ?? null,
    getItem: key => areaMap.get(key) ?? null,
    setItem: (key, value) => {areaMap.set(key, String(value))},
    removeItem: key => {areaMap.delete(key)},
    clear: () => areaMap.clear(),
  }})
  const memory = atlasMemoryStorage()

  assert.equal(memory.getItem('forces'), null, 'unbound: nothing is read')
  assert.equal(memory.length, 0)
  assert.throws(() => memory.setItem('forces', '{}'), /No workspace is bound/, 'unbound: a write is refused, so the atlas finds no storage')
  assert.equal(areaMap.size, 1, 'unbound: nothing was written to the area')

  bindAtlasScope({namespace: 'oi.test.workspace', workspaceId: 'A'})
  memory.setItem('forces', '{"v":1}')
  assert.equal(memory.getItem('forces'), '{"v":1}', 'a value written in workspace A is read back in A')
  assert.equal([...areaMap.keys()].includes('oi.test.workspace.atlas.A::forces'), true, 'the key sits under the namespace and the id')
  assert.equal(memory.length, 1)
  assert.equal(memory.key(0), 'forces', 'the namespace is not shown to the atlas')

  bindAtlasScope({namespace: 'oi.test.workspace', workspaceId: 'B'})
  assert.equal(memory.getItem('forces'), null, 'workspace B does not see workspace A')
  assert.equal(memory.length, 0)

  bindAtlasScope({namespace: 'oi.test.workspace', workspaceId: 'A'})
  memory.removeItem('forces')
  memory.setItem('practice', '[]')
  memory.clear()
  assert.equal(memory.length, 0, 'clear removes only the workspace\'s own keys')
  assert.equal(areaMap.get('unrelated.key'), 'kept', 'keys outside the atlas namespace are untouched')
})

test('the panel loads the atlas lazily, writes no storage of its own, and reimplements none of the atlas', async () => {
  const source = await readFile(panelSource, 'utf8')
  const code = source.split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n')
  const storageUses = code.match(/localStorage|sessionStorage|indexedDB/g) ?? []
  assert.equal(storageUses.length, 1, 'the only browser-storage reference is the workspace area lookup')
  assert.match(code, /import\('\.\/provider\/archetypalEarthProvider'\)/, 'the provider loads with the atlas, not with the shell')
  assert.match(code, /import\('\.\/mount'\)/, 'the atlas loads on first view')
  assert.match(code, /mounted\.ctl\.toggleMode\(\)/, 'the Earth ⇄ Graph switch is the controller\'s own toggle')
  assert.doesNotMatch(code, /new GlobeEngine|new Controller|\.navigate\(/, 'nothing of the atlas is reimplemented here')
})
