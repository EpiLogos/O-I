// R4 (T-REALIGN §3; DLW §20.3; lock §0.3.7; design `expressions:studio`, 9e57d8fe0): the Studio is the Expression's rack — your chosen
// controls as its macros, the field devices in four chains — drawn on its owner (src/components/expressions/studio/studioBinding.ts),
// each key bound as the documentation lane's reconciliation lists (studio-reconciled.md, "Follow-ups 1"): `controls`, `control:<id>`,
// `shared:<id>` from the toolbelt and the shared values; `devices`, `on:<family>` from the holder table and StripToggle; `on:nara` from
// the frame's Nara control; the acts through the retained editor's own requests.
// Channels: FIXTURE editor reading (shaped as the retained editor discloses it: NativeEditorReading), FIXTURE request port that records;
// SCRIPTED renders of the catalogue's Studio on the binding. Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

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

const src = path => new URL(`../src/${path}`, import.meta.url).href
const Binding = await import(src('components/expressions/studio/studioBinding.ts'))
const Model = await import(src('components/expressions/studio/studioModel.ts'))
const Semantics = await import(src('inhabitants/sdk/semantics.ts'))
const {design: STUDIO} = await import(src('inhabitants/catalogue/panels/expressions__studio.tsx'))

const ENGINE = {mediumEnabled: true, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: true,
  colorEnabled: true, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true,
  pointerMode: 'attract', relationalEnabled: false, volumeEnabled: false}
const pin = (id, name) => ({id, name, kind: 'pin', enabled: true, position: {x: 0, y: 0, z: 0}, size: {x: 1, y: 1}, rotation: 0, shape: 'circle', text: '',
  share: 1, tint: '#000', tintWeight: 1, locked: false, station: null, force: {kind: 'attract', strength: 2.5, radius: 1.25, spin: 0}, sequence: {enabled: false, clock: 'seconds', steps: []}})
const binding = (label, over = {}) => ({path: 'p', key: 'k', bind: 'b', factor: 1, label, group: 'g', min: 0, max: 15, hardMin: 0, hardMax: 20, step: 0.1, defaultValue: 1, ...over})
const CHOSEN = {available: true,
  entries: [{id: 'b1', key: 'turbulence', scope: 'field'}, {id: 'b2', key: 'rotation', scope: 'selected'}, {id: 'b3', key: 'share', scope: 'named', entityId: 'e-gone'}],
  controls: [
    {entry_id: 'b1', target: 'field.turbulence', binding: binding('Turbulence'), entity_id: null, native_ref: null, base_value: 2, effective_value: 2.5, locked: false, unavailable_reason: null},
    {entry_id: 'b2', target: 'entity.e-stone.rotation', binding: binding('Entity 1 · Rotation', {min: -180, max: 180, hardMin: -180, hardMax: 180, step: 1, defaultValue: 0, unit: 'degrees'}),
      entity_id: 'e-stone', native_ref: 'occ:1', base_value: 30, effective_value: null, locked: false, unavailable_reason: null},
    {entry_id: 'b3', target: null, binding: null, entity_id: null, native_ref: null, base_value: null, effective_value: null, locked: false, unavailable_reason: 'The bound object is absent from this Scene'},
  ]}
function reading({selection = ['e-stone'], shared = ['field.turbulence'], dirty = false} = {}) {
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene: {name: 'Opening', duration: 8, transition: 1, entities: [pin('e-stone', 'the stone')], engine: {...ENGINE},
      composition: {focus: 'parallel', frequencyDriver: 'manual'}, morph: {law: 'theta'}, automation: [],
      field: {background: '#ffffff', palette: ['#112233', '#445566'], material: 'ink', params: {}}},
    entityOccurrences: {'e-stone': 'occ:1'}, chosenControls: CHOSEN, devices: [], sharedTargets: shared,
    selection: {entity_ids: selection, step_id: null}, history: {canUndo: true, canRedo: false}, standing: {dirty, pending: false, notice: null},
  }
}
const QL = [{id: 'torus', admission: 'waiting'}, {id: 'ql-instrument', admission: 'admitted'}]
const chains = Model.studioChains(QL, id => (id === 'torus' ? 'Torus' : 'QL field / PCM owner'))
const input = (r = reading(), nara = {pressed: false}) => ({reading: r, chains, nara})
function ports() {
  const asked = [], shown = [], panes = [], browsed = [], pressed = []
  return {asked, shown, panes, browsed, pressed, ports: {
    request: async request => { asked.push(request); return {ok: true, reading: reading()} },
    browse: () => browsed.push(true), show: family => shown.push(family), pane: family => panes.push(family), nara: () => pressed.push('nara')}}
}

test('the chains are the holder table\'s four, in the design\'s order, Body holding the torus and the field instrument', () => {
  assert.deepEqual(chains.map(holding => holding.chain), ['material', 'motion', 'body', 'nara'])
  assert.deepEqual(chains.map(holding => holding.field.map(device => device.family)), [
    ['colour', 'ink', 'depth', 'medium'], ['pointer', 'relational', 'contacts', 'morph', 'focus'], ['physics', 'resonance'], []])
  assert.deepEqual(chains[2].ql, [{id: 'torus', title: 'Torus', waiting: true}, {id: 'ql-instrument', title: 'QL field / PCM owner', waiting: false}])
  assert.deepEqual(Semantics.STUDIO_SECTIONS.map(holder => holder.id), ['studio:material', 'studio:motion', 'studio:body', 'studio:nara'])
})

test('the macros are your chosen controls: `controls` from the toolbelt, `control:<id>` its value, `shared:<id>` All scenes from the shared values', () => {
  const v = Binding.studioValues(input())
  const controls = JSON.parse(v.controls)
  assert.deepEqual(controls.map(c => [c.id, c.label, c.scope]), [['b1', 'Turbulence', 'field'], ['b2', 'Rotation', 'selected'], ['b3', 'share', 'named']])
  assert.deepEqual([controls[0].min, controls[0].max, controls[0].step, controls[0].def, controls[0].plays], [0, 15, 0.1, 1, 2.5], 'the binding\'s range, step, default; what the field plays')
  assert.equal(controls[1].subject, 'the stone', 'Follow names the symbol it acts on now')
  assert.deepEqual([controls[2].min, controls[2].max, controls[2].why], [null, null, 'The bound object is absent from this Scene'], 'an unresolved control keeps its place and says why')
  assert.equal(v['control:b1'], 2)
  assert.equal(v['control:b2'], 30)
  assert.equal(v['control:b3'], undefined, 'no value the owner does not hold')
  assert.equal(v['shared:b1'], true, 'the Expression shares the field parameter')
  assert.equal(v['shared:b2'], undefined, 'a symbol\'s control has no All scenes')
  assert.equal(Binding.studioValues(input(reading({shared: []})))['shared:b1'], false)
  const older = reading(); delete older.sharedTargets
  assert.equal(Binding.studioValues(input(older))['shared:b1'], undefined, 'an older reading names no shared targets: absent, never false')
  assert.deepEqual([v.open, v.scene, v.dirty, v.pending, v.canUndo, v.canRedo], [true, 'Opening', false, false, true, false])
})

test('the chains\' rows: each device in order with its owner\'s summary; on:<family> only where StripToggle gives an on and off (none for Physics, Ink, Pointer, Focus)', () => {
  const v = Binding.studioValues(input())
  const rows = JSON.parse(v.devices)
  assert.deepEqual(rows.map(row => [row.family, row.chain]), [['colour', 'material'], ['ink', 'material'], ['depth', 'material'], ['medium', 'material'],
    ['pointer', 'motion'], ['relational', 'motion'], ['contacts', 'motion'], ['morph', 'motion'], ['focus', 'motion'],
    ['physics', 'body'], ['resonance', 'body'], ['torus', 'body'], ['ql-instrument', 'body'], ['nara', 'nara']])
  const byFamily = Object.fromEntries(rows.map(row => [row.family, row]))
  for (const family of ['physics', 'ink', 'pointer', 'focus']) {
    assert.equal(byFamily[family].toggle, false, `${family} has no on and off`)
    assert.equal(v[`on:${family}`], undefined, `${family}: no on: key`)
  }
  for (const family of ['colour', 'depth', 'medium', 'relational', 'contacts', 'morph', 'resonance']) {
    assert.equal(byFamily[family].toggle, true, `${family} switches`)
    assert.equal(typeof v[`on:${family}`], 'boolean', `${family}: its owner's on/off`)
  }
  assert.equal(v['on:medium'], true)
  assert.equal(v['on:resonance'], false)
  assert.ok(byFamily.colour.says && byFamily.colour.says.length > 0, 'the owner\'s summary')
  assert.match(byFamily.torus.why, /waits for its owner/)
  assert.equal(byFamily.torus.toggle, false)
  assert.deepEqual([byFamily.nara.says, v['on:nara']], ['Closed', false], 'Nara is the frame\'s instrument, closed')
  const none = Binding.studioValues(input(null, {why: 'The frame publishes no Nara control here.'}))
  assert.equal(none.open, false)
  assert.equal(none.controls, undefined)
  assert.equal(none['on:nara'], undefined)
  assert.ok(JSON.parse(none.devices).filter(row => row.chain !== 'nara' && !row.why?.includes('owner')).every(row => row.says === null), 'no summary without a reading')
})

test('each act goes to the owner\'s own change: the value, All scenes, the order, the reach, the removal, a device\'s switch, Save', async () => {
  const p = ports()
  const b = Binding.studioBinding(input(), p.ports)
  await b.write([{key: 'control:b1', value: 4.5}])
  await b.write([{key: 'shared:b1', value: false}])
  await b.write([{key: 'later', value: 'b1'}])
  await b.write([{key: 'remove', value: 'b2'}])
  await b.write([{key: 'bind', value: 'b2'}])
  await b.write([{key: 'follow', value: 'b3'}])
  await b.write([{key: 'on:medium', value: false}])
  await b.write([{key: 'save', value: true}])
  const changes = p.asked.filter(request => request.operation === 'apply').map(request => request.changes)
  assert.deepEqual(changes, [
    [{kind: 'parameter', target: 'field.turbulence', value: 4.5}],
    [{kind: 'shared-setting', target: 'field.turbulence', shared: false}],
    [{kind: 'chosen-order', entry_ids: ['b2', 'b1', 'b3']}],
    [{kind: 'chosen-remove', entry_id: 'b2'}],
    [{kind: 'chosen-scope', entry_id: 'b2', scope: 'named', entity_id: 'e-stone'}],
    [{kind: 'chosen-scope', entry_id: 'b3', scope: 'selected'}],
    [{kind: 'field-setting', key: 'mediumEnabled', value: false}],
  ])
  assert.deepEqual(p.asked.at(-1), {operation: 'save', basis: reading().basis}, 'Save is the editor\'s own')
  await assert.rejects(() => b.write([{key: 'control:b1', value: 99}]), /Range 0–20/, 'outside the hard range, refused before the owner')
  await assert.rejects(() => b.write([{key: 'shared:b2', value: true}]), /Only a Field control/)
  await assert.rejects(() => b.write([{key: 'on:physics', value: false}]), /always part of the field/)
  // The place's own acts: + Parameter browses, Show and Pane reach the device (DesignBinding.local, never the owner).
  b.local.add(true); b.local.show('medium'); b.local.pane('torus')
  assert.deepEqual([p.browsed.length, p.shown, p.panes], [1, ['medium'], ['torus']])
  await b.write([{key: 'on:nara', value: true}])
  assert.deepEqual(p.pressed, ['nara'], 'the frame\'s own Nara control, pressed once')
  const off = Binding.studioBinding(input(reading(), {why: 'The frame publishes no Nara control here.'}), {...p.ports, nara: null})
  assert.match(off.standing['on:nara'].disabled, /publishes no Nara control/)
})

test('the design draws its six views on the binding — the macros, the chains, the head\'s acts — never NaN, never its fixtures', () => {
  const p = ports()
  const b = Binding.studioBinding(input(), p.ports)
  const props = page => ({v: b.values, owner: b.values, set: noop, nav: {}, page, setPage: noop, standing: b.standing})
  const said = console.error
  console.error = (first, ...rest) => { if (!String(first).includes('useLayoutEffect does nothing on the server')) said(first, ...rest) }
  try {
    for (const view of ['folded', 'compact', 'widget', 'full']) {
      const html = renderToStaticMarkup(createElement(() => STUDIO[view](props(''))))
      assert.doesNotMatch(html, /NaN|undefined/, view)
      assert.doesNotMatch(html, /Particle Count|Vortex Force/, `${view}: the design's fixture is never drawn`)
    }
    const macros = renderToStaticMarkup(createElement(() => STUDIO.whole(props('macros'))))
    assert.match(macros, /Turbulence/)
    assert.match(macros, /Rotation/)
    const chainsPage = renderToStaticMarkup(createElement(() => STUDIO.whole(props('chains'))))
    for (const chain of ['Material', 'Motion', 'Body', 'Nara']) assert.match(chainsPage, new RegExp(`>${chain}</button>`), `${chain}: a chain of the rack`)
    assert.match(chainsPage, /aria-label="Withhold Shared Medium"/, 'the chosen chain\'s devices, each with its owner\'s switch')
    assert.doesNotMatch(chainsPage, /aria-label="(?:Withhold|Request) Particles"/, 'Ink has no on and off')
    assert.match(renderToStaticMarkup(createElement(() => STUDIO.full(props('')))), /Torus/, 'the Full lists every chain\'s devices')
  } finally { console.error = said }
})
