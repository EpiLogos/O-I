import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Expressions' Device side is the Studio (manual §3 "In Expressions it is the studio that shapes the field"; §7; lock §2.4 Device =
// Studio; world-shell-mockup.html:1432-1441): one plate through the device runtime whose columns are the holder table's sections
// (inhabitants/sdk/semantics.ts STUDIO_SECTIONS), the field devices standing in them through DeviceView, the object and Scene devices
// listed with their light, and the old device chain's controls ported — the Object chooser, Configure as the plate's settings, Deep
// edit as its door, the rack, the chosen controls and the macros in the settings. Production modules in memory (the loader of
// expressions-clip.test.mjs); the reading is a fixture shaped as the retained editor discloses it, not a native owner.
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
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

const noop = () => {}
globalThis.__CRADLE_WALK__ = false
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis
globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop

const src = path => new URL(`../src/${path}`, import.meta.url).href
const world = await import(src('inhabitants/worldShellFamilies.ts'))
world.loadWorldShellFamilies()
const [WS, Detail, Model, Semantics, Catalogue] = await Promise.all([
  import(src('shell/workspaceContext.tsx')),
  import(src('components/NativeWorldDetail.tsx')),
  import(src('components/expressions/studio/studioModel.ts')),
  import(src('inhabitants/sdk/semantics.ts')),
  import(src('components/nativeDeviceCatalogue.ts')),
])

const ENGINE = {mediumEnabled: true, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: true, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true,
  pointerMode: 'attract', relationalEnabled: false, volumeEnabled: false}
const pin = (id, name, over = {}) => ({id, name, kind: 'pin', enabled: true, position: {x: 0, y: 0, z: 0}, size: {x: 1, y: 1},
  rotation: 0, shape: 'circle', text: '', share: 1, tint: '#000', tintWeight: 1, locked: false, station: null,
  force: {kind: 'attract', strength: 2.5, radius: 1.25, spin: 0}, sequence: {enabled: false, clock: 'seconds', steps: []}, ...over})
function reading({selection = [], devices = [], dirty = false, pending = false} = {}) {
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene: {name: 'the stone', duration: 8, transition: 1, entities: [pin('e-stone', 'the stone'), pin('e-vessel', 'the vessel')], engine: {...ENGINE},
      composition: {focus: 'parallel', frequencyDriver: 'manual'}, morph: {law: 'theta'}, automation: [],
      field: {background: '#ffffff', palette: ['#112233', '#445566'], material: 'ink', params: {}}},
    entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices,
    selection: {entity_ids: selection, step_id: null}, history: {canUndo: false, canRedo: false}, standing: {dirty, pending, notice: null},
  }
}
const studio = (r, props = {}) => renderToStaticMarkup(createElement(WS.Workspace.Provider, {value: {workspaceId: 'studio-fixture', accessEpoch: 1, accessReady: true,
  nativeAccessCurrent: () => true, mode: 'expressions', editor: r ? {request: async () => ({ok: false, error: 'fixture'}), subscribe: () => noop} : null, editorReading: r,
  transport: {kind: 'unavailable', reason: 'a fixture'}}},
  createElement(Detail.NativeWorldDetail, {mode: 'device', expand: noop, collapse: noop, presentMode: noop, ...props})))
const sectionOf = (html, id) => {
  const start = html.indexOf(`data-section="${id}"`)
  assert.ok(start >= 0, `the ${id} section stands`)
  const next = html.indexOf('<section class="inst-section"', start)
  return html.slice(start, next < 0 ? undefined : next)
}

test('the Studio\'s sections are the holder table\'s, in its order, each holding the catalogue devices the table names', () => {
  const sections = Model.studioSections()
  assert.deepEqual(sections.map(section => section.id), Semantics.STUDIO_SECTIONS.map(holder => holder.id))
  assert.deepEqual(sections.map(section => section.title), ['Tools', 'Selected · the glyph', 'Formation', 'Material', 'Motion', 'Body · 3:3', 'Nara · M4', 'Capture'])
  assert.equal(sections.find(section => section.id === 'studio:body').note, 'M1+M2+M3')
  const placed = sections.flatMap(section => [...section.field, ...section.entity, ...section.scene].map(device => device.family))
  assert.equal(new Set(placed).size, placed.length, 'a device stands in one section only')
  const clipHeld = Semantics.DETAIL_CLIP_HOLDER.holds.map(ref => ref.split('/')[1])
  for (const device of Catalogue.deviceCatalogue()) {
    assert.ok(placed.includes(device.family) || clipHeld.includes(device.family), `${device.family} stands in the Studio or on the clip`)
  }
  assert.deepEqual(sections.find(section => section.id === 'studio:body').ql, ['torus', 'ql-instrument'])
  assert.deepEqual(Model.studioFieldFamilies(sections).sort(), Catalogue.deviceCatalogue().filter(device => device.scope === 'field').map(device => device.family).sort())
})

test('the Device side is one Studio plate: its head the owner\'s standing and the ported marks, its columns the eight sections', () => {
  const html = studio(reading({selection: ['e-stone'], devices: [{id: 'colour-1', family: 'colour'}, {id: 'sound-1', family: 'sound'}], dirty: true}))
  assert.equal((html.match(/class="inst-plate"/g) ?? []).length, 1, 'one plate')
  assert.match(html, /data-studio="sections"/)
  assert.match(html, /<h3 class="sdk-face__title">Studio<\/h3><span class="sdk-face__owner">Expressions engine · the stone · edited since save<\/span>/, 'the owner\'s standing, in its words')
  for (const label of ['Configure: your rack, chosen controls, macros and the Scene', 'Deep edit: the Studio at full height', 'Read the retained editor again']) {
    assert.match(html, new RegExp(`aria-label="${label}"`), `${label}: a mark on the plate's head`)
  }
  const order = Semantics.STUDIO_SECTIONS.map(holder => html.indexOf(`data-section="${holder.id}"`))
  assert.ok(order.every((at, index) => at >= 0 && (index === 0 || at > order[index - 1])), 'the sections stand in the table\'s order')
  assert.doesNotMatch(html, /native-detail-header|>Configure<|Deep edit ↗/, 'the old chrome is gone from the body')
  // T-FRAME-CHROME-ONTO-PLATES (owner, 15 Oct: "the rack device view was meant to be the toolbar, which should be letting you curate the
  // settings and macros"): the chosen controls — the frame's toolbelt — always stand, as the Studio's own Your controls, with + Parameter.
  const yours = html.slice(html.indexOf('data-section="chosen"'))
  assert.ok(html.indexOf('data-section="chosen"') > html.indexOf('data-section="studio:capture"'), 'Your controls stand after the eight sections')
  assert.match(yours, /<strong>Chosen controls<\/strong><button[^>]*>\+ Parameter<\/button>/, 'the curation stands on the Studio, its browse one press away')
  assert.equal((html.match(/Chosen controls<\/strong>/g) ?? []).length, 1, 'once')
})

test('a field section stands its devices through the runtime, one shown behind its mark, the one on the rack first', () => {
  const html = studio(reading({devices: [{id: 'colour-1', family: 'colour'}]}))
  const material = sectionOf(html, 'studio:material')
  assert.match(material, /role="tablist" aria-label="Material: the devices it holds"/)
  for (const name of ['Colour Field', 'Particles', '3D body &amp; depth', 'Shared Medium']) assert.match(material, new RegExp(`role="tab"[^>]*aria-label="${name}"`))
  assert.match(material, /data-device-shown="expressions:colour"/, 'the device on the rack is shown first')
  assert.match(material, /data-device="expressions:colour" data-device-size="compact"/, 'drawn by DeviceView, compact')
  assert.match(material, /role="slider"/, 'its controls are real')
  assert.match(material, /aria-label="Open Colour Field full size in a pane"/)
  const tools = sectionOf(html, 'studio:tools')
  assert.doesNotMatch(tools, /role="tablist"/, 'a section of one device has no selector')
  assert.match(tools, /data-device="expressions:pointer"/)
  const body = sectionOf(html, 'studio:body')
  assert.match(body, /aria-label="QL field \/ PCM owner"/, 'Body · 3:3 holds the M1 field\/PCM owner beside the physics')
  assert.match(body, /aria-label="Physics"/)
})

test('Selected · the glyph holds the Object chooser, the Force card\'s modes for the one object, and its object devices', () => {
  const none = sectionOf(studio(reading()), 'studio:selected')
  assert.match(none, /<select aria-label="Native editor selection">/)
  assert.match(none, /Choose one object to act on it\./)
  const one = sectionOf(studio(reading({selection: ['e-stone'], devices: [{id: 'sound-1', family: 'sound'}]})), 'studio:selected')
  assert.match(one, /<option value="e-stone" selected="">the stone<\/option>/)
  assert.match(one, /role="group" aria-label="Force mode"/)
  assert.match(one, /aria-pressed="true"[^>]*>attract</, 'the object\'s own mode is lit')
  assert.match(one, /data-family="sound" data-on-rack="true"/, 'a device on the rack says so')
  assert.match(one, /aria-label="Add Meaning to the rack"/, 'one that is not can be added')
})

test('a section whose owner discloses nothing says so in one line; no work open, no field device and no default values', () => {
  const html = studio(reading())
  assert.match(sectionOf(html, 'studio:nara-m4'), /class="inst-section-line">No owner discloses the Nara layer/)
  // Capture is no longer empty: the stage's capture moved here from the Expressions pane (14 Oct; expressions-pane-studio-stage.test.mjs).
  assert.match(sectionOf(html, 'studio:capture'), /role="group" aria-label="Capture"/)
  assert.doesNotMatch(sectionOf(html, 'studio:capture'), /No owner discloses capture/)
  const closed = studio(null)
  assert.match(closed, /Expressions engine · no work is open/)
  assert.doesNotMatch(closed, /data-device="expressions:/, 'no reading, no field device')
  assert.match(sectionOf(closed, 'studio:material'), /Open a native Expression to see its Colour Field, Particles, 3D body &amp; depth, Shared Medium\./)
  assert.doesNotMatch(closed, /aria-label="Deep edit: the Studio/, "no work, no door")
})

test('the settings are the old configuration, in the plate: Configure swaps the sections for your rack, chosen controls, macros, settings', async () => {
  const {ExpressionsStudio} = await import(src('components/expressions/studio/ExpressionsStudio.tsx'))
  const r = reading()
  const props = {reading: r, request: async () => ({ok: false, error: 'fixture'}), selectEntity: noop, drafts: new Map(), onExpandGlyph: noop, glyphPresented: () => false,
    onConfigure: noop, own: [], deep: {open: false, available: true, onPress: noop}, refresh: {available: true, onPress: noop}, fault: null,
    settings: ['rack', 'controls', 'macros', 'settings'].map(id => ({id, title: id, children: createElement('p', null, id)}))}
  const open = renderToStaticMarkup(createElement(ExpressionsStudio, {...props, configure: true}))
  assert.match(open, /data-studio="settings"/)
  for (const id of ['rack', 'controls', 'macros', 'settings']) assert.match(open, new RegExp(`data-section="${id}"`))
  assert.doesNotMatch(open, /data-section="studio:/, 'the settings stand in place of the sections')
  assert.match(open, /aria-label="Close the settings"/)
  const closed = renderToStaticMarkup(createElement(ExpressionsStudio, {...props, configure: false, own: [{id: 'chosen', title: 'Your controls', children: 'mine'}]}))
  assert.match(closed, /data-section="studio:capture"[^]*data-section="chosen"/, 'the person\'s own controls stand after the sections')
  const detail = await readFile(new URL('../src/components/NativeWorldDetail.tsx', import.meta.url), 'utf8')
  for (const id of ['rack', 'controls', 'macros', 'settings']) assert.ok(detail.includes(`{id:'${id}',`), `the ${id} column is composed from the old configuration`)
})

test('the Studio is ported, not recreated: the rack\'s drop, the owner paths, the runtime', async () => {
  const studioSource = await readFile(new URL('../src/components/expressions/studio/ExpressionsStudio.tsx', import.meta.url), 'utf8')
  assert.match(studioSource, /from '\.\.\/\.\.\/\.\.\/frame\/devices\/InstrumentPlate'/, 'the plate is the runtime\'s')
  assert.match(studioSource, /useFieldDevices\(FIELD_FAMILIES/, 'the field devices are the rack\'s and the pool\'s own')
  assert.match(studioSource, /DEVICE_MIME/, 'a device dragged from the browser drops on the plate')
  assert.match(studioSource, /kind: 'device-add', family, after_id: afterIdFor/, 'and goes on the rack as the rack\'s own drop does')
  assert.match(studioSource, /kind: 'force-mode', entity_id: entity\.id, value: mode/, 'the Force card\'s one write')
  assert.match(studioSource, /editor\.apply\(\[deviceAddChange\(family\)\]\)/, 'the rack\'s + Device')
  const detail = await readFile(new URL('../src/components/NativeWorldDetail.tsx', import.meta.url), 'utf8')
  for (const part of ['<NativeDeviceRack reading={reading} request={request} onOpen={dispatchOpenDevice}/>', '<NativeChosenControls', '<NativeRackEditor', '<NativeSceneTransport source={sceneSource}/>']) {
    assert.ok(detail.includes(part), `${part} stays reachable in the settings`)
  }
})

test('the rack card\'s head wears the cut\'s marks, never text glyphs: the ring, fold, pop-out, the device\'s own mark as its handle', async () => {
  const {NativeDeviceRack} = await import(src('components/NativeDeviceRack.tsx'))
  const out = renderToStaticMarkup(createElement(NativeDeviceRack, {reading: reading({devices: [{id: 'medium-1', family: 'medium'}, {id: 'glyph-1', family: 'glyph'}]}),
    request: async () => ({ok: false, error: 'fixture'}), onOpen: noop}))
  assert.doesNotMatch(out, /[▾▸⋮✕⤢]/, 'no text glyph on the card heads')
  assert.match(out, /class="native-rack-light is-on sdk-power sdk-power--on"/, 'the light is the plate\'s power ring, lit on the owner\'s on')
  assert.match(out, /class="native-rack-fold"[^>]*><svg/, 'fold: the cut\'s chevron')
  assert.match(out, /class="native-rack-pane"[^>]*><svg/, 'open full: the cut\'s pop-out')
  assert.match(out, /aria-label="Reorder Shared Medium: drag, or Alt\+Left or Alt\+Right"[^>]*><svg/, 'the handle is the device\'s own mark')
  assert.equal((out.match(/class="native-rack-remove-mark"/g) ?? []).length, 2, 'remove is the cut\'s plus, turned')
})
