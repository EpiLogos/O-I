// O-I #747 round 896, item 0.1 (DLW build ruling 2026-11-09): the Studio's Full never covers the field it edits. Round 895's walk (895h)
// opened "Open Studio full in a pane" as a tab over the field, so the frame was concealed and every write the Full made (Resonance's
// "Driven by") was refused: a concealed frame takes no editor write (expressions-boundary host.ts captureTarget), and it was refused in
// words that named no cause ("Open one native Expression Scene before capturing its target", said with a scene open).
// Now a field device's Full opens beside the field when the field is the target pane's front tab (instrumentDoor.ts fullBesideField, by
// fullPlacement), so the field stays presented and the write lands. If the field is concealed anyway (the person put a tab over it), the
// write is refused in words that name the cause, and one press beside the Info line, "Show the field beside", places the field and applies
// nothing; the scene words are said only when no scene is open.
// Channels: REAL — the door (openDeviceFull, the published opener as the Workbench publishes it: placeInstrument over the cradle pane
// engine), the boundary host's capture gate (ExpressionsHost.captureTarget, whether the field is presented read off the pane tree as its
// residence is shown: its surface the front tab of its pane), the device host's flush and its refusal press (flushDrafts, offerOnInfoLine,
// pressInfoOffer), showFieldBeside. SCRIPTED — the frame window (it answers the host's handshake with a scene open) and the binding's write,
// which captures the host's target first, as the editor client's request does (editorHost.ts, pinned below). CODE-READING — the
// Workbench publishes the opener, the field's placer and the press; every field device's Full goes by its placement.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

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
  const path=url.split('?')[0];
  if(path.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(path.endsWith('.html')||path.endsWith('.svg'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(path.endsWith('.ts')||path.endsWith('.tsx')){
    const source=await readFile(new URL(path).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:path});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const door = await import('../src/frame/instrumentDoor.ts')
const {DEVICE_PANE_KIND} = await import('../src/frame/devices/deviceDoor.ts')
const {flushDrafts, offerOnInfoLine, readInfoOffer, pressInfoOffer, publishRefusalPress, resetHost} = await import('../src/frame/devices/deviceHost.tsx')
const {groupOf, groupsOf, makeProjectionBinding} = await import('../../../../desktop/cradle/src/surface/engine.ts')
const boundary = await import('../../../expressions-boundary/src/host.ts')
const {CHANNEL_VERSION} = await import('../../../expressions-boundary/src/protocol.ts')
const read = path => readFile(new URL(path, import.meta.url), 'utf8')

const {MODE_TREE_SEEDS} = await import('../src/shell/modeFrames.ts')

const STUDIO = {ref: 'expressions:studio', title: 'Studio'}
const notes = {id: 'notes', kind: 'file', title: 'notes.md', ref: 'central:file:notes.md'}
/** The Expressions mode's first tree, as the shell seeds it (shell/modeFrames.ts MODE_TREE_SEEDS.expressions: "the field fills one pane"),
 * its field surface named 'field' here so the asserts read: the field the one tab of the focused pane, in front. Walk 896c found round
 * 896's first cut keyed the field by a kind the shell's tree never holds ('expressions'); the seed's own kind is the one read now. */
function fieldInFront() {
  const empty = {root: {type: 'group', id: 'g1', tabs: [], pinned: [], active: null}, surfaces: {}, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel', rightDepth: 'collapsed', leftWidth: 260, rightWidth: 320}
  const seeded = MODE_TREE_SEEDS.expressions(empty)
  const [seededId] = seeded.root.tabs
  assert.equal(seeded.root.tabs.length, 1, 'the seed lays the field alone in one pane')
  return {...seeded, root: {...seeded.root, tabs: ['field'], active: 'field'}, surfaces: {field: {...seeded.surfaces[seededId], id: 'field'}}}
}
/** Whether the field's residence is shown: its surface the front tab of its pane (a tab behind another is hidden). */
const fieldShown = layout => groupsOf(layout.root).some(group => group.active === 'field')
const fullOf = layout => makeProjectionBinding(layout, DEVICE_PANE_KIND, {subject_ref: STUDIO.ref, subject_title: STUDIO.title}).id

/** The pane tree as the Workbench mounts it (native/Workbench.tsx): one layout, the opener and the field's placer published over it. */
function mountTree(initial) {
  const tree = {layout: initial}
  door.publishInstrumentOpener((kind, at, subject) => { tree.layout = door.placeInstrument(tree.layout, kind, at, subject) })
  door.publishFieldPlacer(() => { tree.layout = door.showFieldBeside(tree.layout) })
  publishRefusalPress(boundary.FIELD_CONCEALED, {label: 'Expressions', words: boundary.FIELD_CONCEALED, act: boundary.SHOW_FIELD_BESIDE, run: async () => door.placeFieldBeside()})
  return tree
}
function unmount() { door.publishInstrumentOpener(null); door.publishFieldPlacer(null); publishRefusalPress(boundary.FIELD_CONCEALED, null); offerOnInfoLine(null) }

/** A host over a frame that answers its handshake with a scene open; presented while the field's residence is shown in `tree`. */
async function hostOver(tree, {scene = true} = {}) {
  const origin = 'http://oi-material.localhost', frameWindow = {postMessage() {}}
  const element = new EventTarget()
  Object.assign(element, {src: `${origin}/__application/expressions/index.html`, contentWindow: frameWindow, closest: () => null})
  const host = new boundary.ExpressionsHost(element, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000,
    mode: 'expressions', isPresented: () => fieldShown(tree.layout)})
  const nativeScene = scene ? {expression_ref: 'expression:swell', revision: 4, scene_ref: 'expression:swell:scene:main'} : undefined
  await host.handleMessage({source: frameWindow, origin, data: {v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'expressions', sceneIndex: 0, sceneCount: 1, ...(nativeScene ? {nativeScene} : {})}}})
  return host
}
/** Resonance's "Driven by" as the Full writes it: the binding's write captures the host's target first, as the editor client does. */
function resonance(host, landed) {
  return {id: 'expressions:resonance', values: {driver: 'Transport'}, write: async changes => { const target = host.captureTarget(); landed.push({changes, scene: target.scene.scene_ref}) }}
}
const drive = async (binding, value) => {
  const {setDraft} = await import('../src/frame/devices/deviceHost.tsx')
  setDraft(binding.id, 'driver', value)
  return flushDrafts(binding, 0)
}

test('the Studio\'s Full opened with its field in front stands beside the field, and a write to Resonance\'s Driven by lands', async t => {
  const tree = mountTree(fieldInFront())
  t.after(unmount)
  const {openDeviceFull} = await import('../src/frame/devices/DeviceView.tsx')
  assert.equal(openDeviceFull(STUDIO.ref, STUDIO.title), null, 'the door opened it')
  const full = fullOf(tree.layout)
  assert.ok(groupOf(tree.layout, full), 'the Full stands in the tree')
  // The write from the Full: the host takes it, because the field is presented.
  const host = await hostOver(tree), landed = []
  t.after(() => host.dispose())
  resetHost('expressions:resonance')
  assert.equal(await drive(resonance(host, landed), 'Manual'), null, 'the write is not refused')
  assert.deepEqual(landed, [{changes: [{key: 'driver', value: 'Manual'}], scene: 'expression:swell:scene:main'}], 'the write landed on the presented scene')
  assert.equal(readInfoOffer(), null, 'nothing is offered for a write that landed')
  // Where it stands: beside the field, never as a tab over it.
  assert.notEqual(groupOf(tree.layout, full).id, groupOf(tree.layout, 'field').id, 'beside the field, in its own pane, never as a tab over it')
  assert.equal(groupOf(tree.layout, 'field').active, 'field', 'the field is still the shown tab of its pane')
  assert.equal(groupOf(tree.layout, full).active, full, 'and the Full is shown in its own')
  assert.deepEqual(groupsOf(tree.layout.root).map(group => group.tabs), [['field'], [full]], 'the field on the left, the Full on its right')
  // Opened again, the Full shows where it stands; a field device's Full from the rack goes the same way.
  assert.equal(openDeviceFull(STUDIO.ref, STUDIO.title), null)
  assert.deepEqual(groupsOf(tree.layout.root).map(group => group.tabs), [['field'], [full]])
  // A device that does not edit the field opens where any instrument opens.
  assert.equal(door.fullPlacement('central:day'), undefined)
  assert.equal(door.fullPlacement(STUDIO.ref), 'beside-field')
  assert.equal(tree.layout.surfaces.field.kind, door.FIELD_SURFACE_KIND, 'the field is the surface kind the door looks for')
})

test('every door to the Studio\'s Full places it beside the field: its own ⤢, Open in studio, a door that names no place', async t => {
  // Walk 896b: the Studio's own "Open the Studio full in a pane" (ExpressionsStudio.tsx) and Open in studio (studioHome.ts) asked the
  // tree for no place, so the Full opened as a tab over the field and Resonance's write was refused. The tree now places a field
  // device's Full beside the field whichever door asks, so no door can open it over the field it edits.
  const {openStudioHome} = await import('../src/components/expressions/studio/studioHome.ts')
  for (const [door_, open] of [
    ['the Studio\'s own ⤢', () => door.openInstrument(DEVICE_PANE_KIND, undefined, STUDIO)],
    ['Open in studio (Resonance)', () => assert.equal(openStudioHome('resonance'), null)],
    ['a field device\'s ⤢ that names no place', () => door.openInstrument(DEVICE_PANE_KIND, undefined, {ref: 'expressions:resonance', title: 'Resonance'})],
  ]) {
    const tree = mountTree(fieldInFront())
    open()
    assert.equal(fieldShown(tree.layout), true, `${door_}: the field stays shown`)
    assert.equal(groupsOf(tree.layout.root).length, 2, `${door_}: the Full stands in a pane of its own beside the field`)
    assert.deepEqual(groupOf(tree.layout, 'field').tabs, ['field'], `${door_}: nothing is opened as a tab over the field`)
    const host = await hostOver(tree), landed = []
    resetHost('expressions:resonance')
    assert.equal(await drive(resonance(host, landed), 'Manual'), null, `${door_}: the Full's write is not refused`)
    assert.equal(landed.length, 1, `${door_}: the Full's write lands`)
    host.dispose(); unmount()
  }
  // A device that does not edit the field, asked for with no place, still opens in the focused pane.
  const tree = mountTree(fieldInFront())
  t.after(unmount)
  door.openInstrument(DEVICE_PANE_KIND, undefined, {ref: 'central:day', title: 'Day'})
  assert.equal(groupsOf(tree.layout.root).length, 1)
})

test('the field concealed anyway: the write is refused in words that name the cause, and "Show the field beside" places it and applies nothing', async t => {
  // The person put a tab over the field.
  const tree = mountTree(fieldInFront())
  t.after(unmount)
  tree.layout = {...tree.layout, root: {...tree.layout.root, tabs: ['field', 'notes'], active: 'notes'}, surfaces: {...tree.layout.surfaces, notes}}
  assert.equal(fieldShown(tree.layout), false, 'the field is concealed')
  const host = await hostOver(tree), landed = []
  t.after(() => host.dispose())
  resetHost('expressions:resonance')
  const refused = await drive(resonance(host, landed), 'Manual')
  assert.equal(refused, 'The field this edits is not shown. Show it beside to change it.')
  assert.deepEqual(landed, [], 'nothing was written')
  const offer = readInfoOffer()
  assert.ok(offer, 'one press stands beside the Info line')
  assert.equal(offer.act, 'Show the field beside')
  assert.equal(offer.words, refused)
  // The press: the field is placed beside what stood over it, and nothing is applied by it.
  const said = await pressInfoOffer()
  assert.equal(said, 'The field is shown beside. Nothing was changed: make the change again.')
  assert.equal(readInfoOffer(), null, 'the press is taken')
  assert.equal(fieldShown(tree.layout), true, 'the field is shown')
  assert.equal(groupOf(tree.layout, 'notes').active, 'notes', 'and what stood over it stays shown, beside it')
  assert.notEqual(groupOf(tree.layout, 'notes').id, groupOf(tree.layout, 'field').id)
  assert.deepEqual(landed, [], 'the press applied nothing')
  // The person makes the change again: it lands.
  assert.equal(await drive(resonance(host, landed), 'Manual'), null)
  assert.equal(landed.length, 1)
})

test('"Open one native Expression Scene before capturing its target" is said only when no scene is open', async t => {
  const tree = mountTree(fieldInFront())
  t.after(unmount)
  const none = await hostOver(tree, {scene: false})
  t.after(() => none.dispose())
  assert.throws(() => none.captureTarget(), {message: 'Open one native Expression Scene before capturing its target'})
  const open = await hostOver(tree)
  t.after(() => open.dispose())
  assert.equal(open.captureTarget().scene.scene_ref, 'expression:swell:scene:main')
  tree.layout = {...tree.layout, root: {...tree.layout.root, tabs: ['field', 'notes'], active: 'notes'}, surfaces: {...tree.layout.surfaces, notes}}
  assert.throws(() => open.captureTarget(), {message: boundary.FIELD_CONCEALED}, 'a scene open and the field concealed: the cause, not the scene words')
  // A field shown already is left where it stands by the press.
  const shown = fieldInFront()
  assert.equal(door.showFieldBeside(shown), shown)
})

test('CODE-READING: the Workbench publishes the opener, the placer and the press; every field device\'s Full goes by its placement; the editor client captures first', async () => {
  const workbench = await read('../src/native/Workbench.tsx')
  assert.match(workbench, /publishInstrumentOpener\(\(kind, at, subject\) => latest\.current\.book\.setLayout\(layout => placeInstrument\(layout, kind, at, subject\)\)\)/)
  assert.match(workbench, /publishFieldPlacer\(\(\) => latest\.current\.book\.setLayout\(showFieldBeside\)\)/)
  assert.match(workbench, /publishRefusalPress\(FIELD_CONCEALED, \{label: 'Expressions', words: FIELD_CONCEALED, act: SHOW_FIELD_BESIDE, run: async \(\) => placeFieldBeside\(\)\}\)/)
  assert.match(await read('../src/components/devices/ExpressionsDeviceView.tsx'), /openInstrument\(DEVICE_PANE_KIND, 'beside-field', \{ref: expressionsDeviceId\(family\), title\}\)/)
  assert.match(await read('../src/widgets/railDevices.tsx'), /openInstrument\(DEVICE_PANE_KIND, fullPlacement\(target\), \{ref: target,/)
  const {expressionsDeviceId} = await import('../src/components/devices/expressionsDevice.ts')
  assert.ok(expressionsDeviceId('resonance').startsWith(door.FIELD_DEVICE_PREFIX))
  assert.match(await read('../src/components/expressions/studio/studioBinding.ts'), /export const STUDIO_DEVICE_ID = 'expressions:studio'/)
  assert.match(await read('../../../expressions-boundary/src/editorHost.ts'), /try \{\n\s+target = host\.captureTarget\(\);/)
})
