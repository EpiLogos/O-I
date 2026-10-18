import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Expressions' Device side is the Studio (DLW §20.3; lock §0.3.7; R4): the Expression's rack drawn by its design (`expressions:studio`)
// on the device runtime, the holder table's four chains (inhabitants/sdk/semantics.ts STUDIO_SECTIONS), then the Stage — the stage's
// own controls the manual gives no home — beside it; the old plate's ported controls kept: Configure as the settings, Deep edit as its
// door, the rack, the chosen controls and the macros in the settings; the selected symbol's controls exported for the scene's Clip view. Production modules in memory (the loader of
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

test('the Studio\'s chains are the holder table\'s four, in its order, each holding the catalogue devices the table names; what left is the clip\'s', () => {
  const sections = Model.studioSections()
  assert.deepEqual(sections.map(section => section.id), Semantics.STUDIO_SECTIONS.map(holder => holder.id))
  // REPLACED (R4; DLW §20.3; lock §0.3.7): ['Tools', 'Selected · the glyph', 'Formation', 'Material', 'Motion', 'Body · 3:3', 'Nara · M4', 'Capture'].
  assert.deepEqual(sections.map(section => section.title), ['Material', 'Motion', 'Body', 'Nara'])
  assert.equal(sections.find(section => section.id === 'studio:body').note, 'M1+M2+M3')
  const placed = sections.flatMap(section => [...section.field, ...section.entity, ...section.scene].map(device => device.family))
  assert.equal(new Set(placed).size, placed.length, 'a device stands in one chain only')
  const clipHeld = Semantics.DETAIL_CLIP_HOLDER.holds.map(ref => ref.split('/')[1])
  for (const device of Catalogue.deviceCatalogue()) {
    assert.ok(placed.includes(device.family) || clipHeld.includes(device.family), `${device.family} stands in the Studio or on the clip`)
  }
  assert.deepEqual(sections.flatMap(section => [...section.entity, ...section.scene]), [], 'no object or Scene device in the Studio: those are the scene\'s Clip view\'s')
  assert.deepEqual(sections.find(section => section.id === 'studio:body').ql, ['torus', 'ql-instrument'])
  assert.deepEqual(Model.studioFieldFamilies(sections).sort(), Catalogue.deviceCatalogue().filter(device => device.scope === 'field').map(device => device.family).sort())
})

test('the Device side is the Studio — its design on the runtime, the ported marks in its head — then the Stage beside it (REPLACED: one eight-section plate)', () => {
  const html = studio(reading({selection: ['e-stone'], devices: [{id: 'colour-1', family: 'colour'}, {id: 'sound-1', family: 'sound'}], dirty: true}))
  assert.match(html, /data-studio="rack"/)
  assert.match(html, /data-device="expressions:studio"[^>]*data-design="expressions:studio"/, 'the Studio stands as its design\'s device')
  for (const label of ['Configure: your rack, chosen controls, macros and the Scene', 'Deep edit: the Studio at full height', 'Read the retained editor again']) {
    assert.match(html, new RegExp(`aria-label="${label}"`), `${label}: a mark on the Studio's head`)
  }
  for (const id of ['studio:tools', 'studio:selected', 'studio:formation', 'studio:capture', 'chosen']) assert.ok(!html.includes(`data-section="${id}"`), `${id}: no longer a Studio section`)
  // The stage's own controls the manual gives no home stand beside the Studio as the Stage (OPEN), never inside its design.
  assert.match(html, /data-studio-stage="unplaced"/)
  assert.ok(html.indexOf('data-studio-stage') > html.indexOf('data-device="expressions:studio"'), 'the Stage after the Studio')
  assert.match(html, /data-section="stage:capture"/)
  assert.match(html, /data-section="stage:view"/)
  assert.doesNotMatch(html, /aria-label="Chosen native controls"/, 'Your controls are the Studio\'s macros now (its Macros page), not a section')
})

test('REPLACED — a chain\'s devices are rows of the Studio, not compact plates in sections: their light, On, Show and Pane are the design\'s (r4-studio.test.mjs)', () => {
  const html = studio(reading({devices: [{id: 'colour-1', family: 'colour'}]}))
  assert.doesNotMatch(html, /data-device-shown=/, 'no section shows a device behind its mark')
  assert.doesNotMatch(html, /role="tablist" aria-label="Material: the devices it holds"/)
})

test('REPLACED — the selected symbol\'s controls are the scene\'s Clip view\'s: SelectedObject keeps the Object chooser and the Force card\'s modes for it to mount', async () => {
  const {SelectedObject} = await import(src('components/expressions/studio/ExpressionsStudio.tsx'))
  const draw = r => renderToStaticMarkup(createElement(SelectedObject, {reading: r, selectEntity: noop, locked: false, send: noop}))
  const none = draw(reading())
  assert.match(none, /<select class="dp-chooser" aria-label="Native editor selection">/, 'the kit\'s chooser')
  assert.match(none, /Choose one object to act on it\./)
  const one = draw(reading({selection: ['e-stone']}))
  assert.match(one, /<option value="e-stone" selected="">the stone<\/option>/)
  assert.match(one, /role="group" aria-label="Force mode"/)
  assert.match(one, /aria-pressed="true"[^>]*>attract</, 'the object\'s own mode is lit')
  assert.doesNotMatch(studio(reading({selection: ['e-stone']})), /aria-label="Native editor selection"/, 'not on the Studio')
})

test('no work open: the Studio stands unlit, no field device and no default value; the Stage says why its keys are off', () => {
  const closed = studio(null)
  assert.match(closed, /Expressions engine · no work is open/)
  assert.doesNotMatch(closed, /data-device="expressions:(?!studio)/, 'no reading, no field device')
  assert.match(closed, /data-device="expressions:studio"/)
  assert.match(closed, /data-section="stage:capture"/)
  assert.doesNotMatch(closed, /aria-label="Deep edit: the Studio/, 'no work, no door')
})

test('the settings are the old configuration: Configure swaps the Studio for your rack, chosen controls, macros, settings', async () => {
  const {ExpressionsStudio} = await import(src('components/expressions/studio/ExpressionsStudio.tsx'))
  const r = reading()
  const props = {reading: r, request: async () => ({ok: false, error: 'fixture'}), selectEntity: noop, drafts: new Map(), onExpandGlyph: noop, glyphPresented: () => false,
    onConfigure: noop, own: [], deep: {open: false, available: true, onPress: noop}, refresh: {available: true, onPress: noop}, fault: null,
    settings: ['rack', 'controls', 'macros', 'settings'].map(id => ({id, title: id, children: createElement('p', null, id)}))}
  const open = renderToStaticMarkup(createElement(ExpressionsStudio, {...props, configure: true}))
  assert.match(open, /data-studio="settings"/)
  for (const id of ['rack', 'controls', 'macros', 'settings']) assert.match(open, new RegExp(`data-section="${id}"`))
  assert.doesNotMatch(open, /data-device="expressions:studio"/, 'the settings stand in place of the Studio')
  assert.match(open, /aria-label="Close the settings"/)
  const closed = renderToStaticMarkup(createElement(ExpressionsStudio, {...props, configure: false,
    own: [{id: 'chosen', title: 'Your controls', children: 'mine'}, {id: 'macros', title: 'Macros', children: 'racks'}]}))
  assert.doesNotMatch(closed, /data-section="chosen"/, 'your chosen controls are the Studio\'s macros, not drawn twice')
  assert.match(closed, /data-section="stage:capture"[^]*data-section="macros"/, 'the person\'s macro racks stand after the Stage\'s own')
  const detail = await readFile(new URL('../src/components/NativeWorldDetail.tsx', import.meta.url), 'utf8')
  for (const id of ['rack', 'controls', 'macros', 'settings']) assert.ok(detail.includes(`{id:'${id}',`), `the ${id} column is composed from the old configuration`)
})

test('the Studio is ported, not recreated: the drops, the owner paths, the runtime', async () => {
  const studioSource = await readFile(new URL('../src/components/expressions/studio/ExpressionsStudio.tsx', import.meta.url), 'utf8')
  assert.match(studioSource, /<DeviceView device=\{STUDIO_DEVICE\} size="compact" binding=\{binding\}/, 'the Studio is a device of the runtime, drawn by its design')
  assert.match(studioSource, /useFieldDevices\(FIELD_FAMILIES/, 'the field devices are the rack\'s and the pool\'s own')
  assert.match(studioSource, /DEVICE_MIME/, 'a device dragged from the browser drops on the Studio')
  assert.match(studioSource, /kind: 'device-add', family, after_id: afterIdFor/, 'and goes on the rack as the rack\'s own drop does')
  assert.match(studioSource, /editor\.apply\(\[chosenAddChange\(active\.drag\)\]\)/, 'a parameter dropped becomes a macro: the chosen controls\' own add')
  assert.match(studioSource, /kind: 'force-mode', entity_id: entity\.id, value: mode/, 'the Force card\'s one write, kept for Clip view')
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
