import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, readdir} from 'node:fs/promises'
import {register} from 'node:module'

// The Earth projection's shell host (T-ATLAS-HOST, host leg): the workspace-scoped memory of the atlas, the admission of the centre
// panel and the two pane kinds, and the honest refusals. Production modules in memory (the mode-grammar loader pattern): .ts/.tsx
// transpiled, CSS and JSON stubbed. The atlas itself is not mounted here: it needs WebGL and a kernel; its mount is UNVERIFIED headless
// and is verified on screen.
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

// The Technē lens bar retired (#762: ModeDetail's TechneLensBar was reached only by tests). Retired: 'the lens bar cuts Places and Project /
// graph to the Earth atlas and keeps the rest honest' → atlas-places-plate.test.mjs 'World / Places opens the atlas, never the stage's
// retired Places lens' (the instrument door) and f2-panes.test.mjs 'the Instruments list names instruments …'; 'the lens bar presses the
// open lens: the atlas view while the atlas is the centre …' → atlas-face-bodies.test.mjs 'the mode switch is the atlas view …: a choice
// made on the face is the view the pane follows' and techne-devices.test.mjs (the Earth ⇄ Graph device reads the view mirror).

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
  assert.match(code, /import\('\.\/provider\/suiteProvider'\)/, 'the provider loads with the atlas, not with the shell')
  assert.match(code, /import\('\.\/mount'\)/, 'the atlas loads on first view')
  assert.match(code, /mounted\.ctl\.toggleMode\(\)/, 'the Earth ⇄ Graph switch is the controller\'s own toggle')
  assert.doesNotMatch(code, /new GlobeEngine|new Controller|\.navigate\(/, 'nothing of the atlas is reimplemented here')
})

// T-ATLAS-HOST-b: inside the shell the atlas is a pane, and its fixed overlays are contained by it. Its sizes and its
// client-point placements are pane-relative. These are source checks on the port, plus the pure placement maths.
const atlasSrc = new URL('../src/projections/atlas/src/', import.meta.url)
async function filesUnder(dir) {
  const out = []
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
    if (entry.isDirectory()) out.push(...await filesUnder(url))
    else out.push(url)
  }
  return out
}

test('the atlas stylesheets size against the pane: no vw or vh remains, and the pane is a size container', async () => {
  const styles = (await filesUnder(new URL('style/', atlasSrc))).filter(url => url.pathname.endsWith('.css'))
  assert.ok(styles.length >= 8, 'the atlas stylesheets are read')
  for (const url of styles) {
    const code = (await readFile(url, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '')
    assert.deepEqual(code.match(/\d(?:d?vw|d?vh)\b/g) ?? [], [], `${url.pathname.split('/').pop()} sizes against the window`)
  }
  const host = await readFile(new URL('../src/projections/atlas/atlasHost.css', import.meta.url), 'utf8')
  assert.match(host, /\.atlas-host \{[^}]*contain: layout paint;[^}]*container-type: size;/, 'the pane contains its overlays and is their size container')
})

test('no atlas module reads the window size outside hostSize.ts: the pane is the atlas\'s viewport', async () => {
  const sources = (await filesUnder(atlasSrc)).filter(url => /\.tsx?$/.test(url.pathname))
  const readers = []
  for (const url of sources) {
    if (/window\.inner(Width|Height)/.test(await readFile(url, 'utf8'))) readers.push(url.pathname.split('/atlas/src/')[1])
  }
  assert.deepEqual(readers.filter(name => name !== 'ui/hostSize.ts'), [], 'every window-size read is the hostSize fallback')
  assert.deepEqual(readers, ['ui/hostSize.ts'], 'hostSize.ts is the one reader, and it is the standalone fallback')
})

test('the hover label is placed from the pane origin: its client point is taken into .atlas-host, and no window is read', async () => {
  const src = await readFile(new URL('ui/hover-label.ts', atlasSrc), 'utf8')
  assert.match(src, /import \{[^}]*\bhostOrigin\b[^}]*\} from '\.\/hostSize'/, 'the origin comes from the pane helper')
  assert.match(src, /paneLabelPosition\(x, y, hostOrigin\(this\.root\), hostSize\(this\.root\), this\.w\)/, 'the placement is the pane-relative one')
  assert.doesNotMatch(src, /window\./, 'the label reads no window geometry')
})

test('the hover label is placed in pane coordinates, kept inside the pane; standalone it is the ported formula', async () => {
  const {paneLabelPosition} = await import('../src/projections/atlas/src/ui/hostSize.ts')
  const pane = {x: 300, y: 40}
  const size = {w: 700, h: 500}
  assert.deepEqual(paneLabelPosition(600, 200, pane, size, 160), {x: 316, y: 126}, 'a pointer in the pane: 16px right, 34px above, in pane coordinates')
  assert.deepEqual(paneLabelPosition(980, 200, pane, size, 160), {x: 528, y: 126}, 'the right edge keeps 12px inside the pane')
  assert.deepEqual(paneLabelPosition(600, 50, pane, size, 160), {x: 316, y: 12}, 'the top keeps 12px inside the pane')
  assert.deepEqual(paneLabelPosition(600, 200, {x: 0, y: 0}, {w: 1440, h: 900}, 160), {x: 616, y: 166}, 'standalone (origin 0,0, window size): the ported formula')
})

test('hostSize reads the pane when one contains the atlas, and the window when none does', async () => {
  const {hostSize, hostOrigin} = await import('../src/projections/atlas/src/ui/hostSize.ts')
  const saved = {document: globalThis.document, window: globalThis.window}
  const pane = {clientWidth: 700, clientHeight: 500, getBoundingClientRect: () => ({left: 300, top: 40}), closest: () => pane}
  try {
    globalThis.document = {querySelector: selector => (selector === '.atlas-host' ? pane : null)}
    globalThis.window = {innerWidth: 1440, innerHeight: 900}
    assert.deepEqual(hostSize(), {w: 700, h: 500}, 'hosted: the pane\'s client box')
    assert.deepEqual(hostOrigin(), {x: 300, y: 40}, 'hosted: the pane\'s top-left in client coordinates')
    assert.deepEqual(hostSize({closest: () => pane}), {w: 700, h: 500}, 'an element inside the pane finds it by closest')
    globalThis.document = {querySelector: () => null}
    assert.deepEqual(hostSize(), {w: 1440, h: 900}, 'standalone: the window')
    assert.deepEqual(hostOrigin(), {x: 0, y: 0}, 'standalone: no origin')
  } finally {
    globalThis.document = saved.document
    globalThis.window = saved.window
  }
})
