// The seventh-product test (WORLD-SHELL-DESIGN §13): a seventh product joins by declaring a family manifest alone — no
// shell module changes. The fixture below is a synthetic product that exists only in this file; its ids name no shipped
// product. It is admitted through the one door (sdk `admitFamily`, the device kit over `admitFamilyManifest`), its panel
// slot composes through the door's declared-extension path, and it is read back from the shell's composed views: the
// door, the world shell's family list, the rack. Its faces obey the same laws as the six (waiting/admitted, the pop-out
// standalone rule, the device identity check).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
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
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const door = await import('../src/inhabitants/familyManifest.ts')
const manifests = await import('../src/inhabitants/manifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const sdkDefine = await import('../src/inhabitants/sdk/define.ts')
const sdkValidate = await import('../src/inhabitants/sdk/validate.ts')
const detached = await import('../src/native/detachedKinds.ts')
const rack = await import('../src/inhabitants/inhabitantRack.tsx')

const SIX = ['central', 'actuation', 'ai-kit', 'software-factory', 'workcell', 'quaternal-logic']
const FAMILY = 'fixture-seventh'
const PRODUCT = 'fixture-seventh-product'
const CATEGORY = 'fixture-seventh-category'
const PANEL = 'fixture-seventh.context'
const NO_APERTURE = {day: null, flow: null, conversation: null, instrument: null}
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}

// The synthetic seventh product: a device face (admitted), a waiting face, a browser category, and (below) a panel slot.
const SEVENTH = {
  id: FAMILY,
  owner: 'Fixture Seventh Product (test only)',
  product: PRODUCT,
  newProduct: {id: PRODUCT, authority: 'SDK test fixture — a synthetic seventh product that ships nowhere'},
  browser: [CATEGORY],
  paramsGrammar: 'fixture-seventh/parameter-address/v1',
  writers: ['shell.setFixtureGain'],
  writerAuthority: 'SDK test fixture — arms its own gain path',
  devices: [
    {
      id: 'probe',
      title: 'Fixture Probe',
      icon: 'form',
      liveSemantic: 'info',
      note: 'A fixture reading; no fixture owner op exists, so the reading discloses its absence.',
      params: [
        sdkDefine.reading({key: 'readiness', title: 'Readiness', type: 'string', disclosure: 'No fixture owner reading wired.'}),
        sdkDefine.numberParam({key: 'gain', title: 'Gain', type: 'number', range: {min: 0, max: 2, unit: 'x'}, writePath: 'shell.setFixtureGain'}),
      ],
    },
    {
      id: 'waiting-dial',
      title: 'Fixture Dial',
      icon: 'form',
      liveSemantic: 'info',
      admission: 'waiting',
      note: 'Waits for the fixture owner\'s dial op, which has not landed.',
    },
  ],
}
function admitSevenPlusSix() {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  const sixBefore = SIX.map(id => JSON.stringify(manifests.inhabitantManifest(id)))
  const admitted = sdkDefine.admitFamily(SEVENTH)
  // The panel slot composes as the door's declared extension (no renderer change): one more entry on the composed view.
  manifests.declareFamilyExtension(FAMILY, {
    id: `${FAMILY}:panel`,
    by: 'SDK test fixture',
    panelSlots: [{slot: 'right-dock', panel: PANEL}],
    note: 'Fixture panel slot — composes onto the admitted family.',
  })
  return {admitted, sixBefore}
}

test('a seventh product admits through the one door, beside the six, with the six untouched', () => {
  const {admitted, sixBefore} = admitSevenPlusSix()
  assert.equal(admitted.manifest.id, FAMILY)
  assert.deepEqual(door.allFamilyManifests().map(manifest => manifest.id).filter(id => SIX.includes(id)).sort(), [...SIX].sort(), 'the six remain admitted')
  assert.equal(sdkDefine.familyProduct(FAMILY), PRODUCT, 'the family carves the synthetic product, recorded at the gate')
  assert.deepEqual(SIX.map(id => JSON.stringify(manifests.inhabitantManifest(id))), sixBefore, 'the six composed manifests are unchanged by the seventh')
})

test('the seventh family composes into the world shell, the door view and the browser and panel declarations', () => {
  admitSevenPlusSix()
  const composed = manifests.inhabitantManifest(FAMILY)
  assert.ok(composed, 'the composed view carries the seventh family')
  assert.deepEqual(composed.faces.map(face => face.id), ['probe', 'waiting-dial'])
  assert.deepEqual([...composed.browser], [CATEGORY], 'the browser category the family declares')
  assert.deepEqual(composed.panelSlots, [{slot: 'right-dock', panel: PANEL}], 'the panel slot composes onto the family')
  assert.ok(manifests.allInhabitantManifests().some(manifest => manifest.id === FAMILY), 'the door view lists it')
  assert.ok(world.worldShellFamilyManifests().some(manifest => manifest.id === FAMILY), 'the world shell reads it from the door, not a list of six')
})

test('the seventh family renders in the rack from the door view, with its waiting face honest', () => {
  admitSevenPlusSix()
  const composed = manifests.inhabitantManifest(FAMILY)
  const markup = renderToStaticMarkup(createElement(rack.InhabitantRack, {manifests: [composed], transport}))
  assert.match(markup, /data-family="fixture-seventh"/, 'the rack draws the family')
  assert.match(markup, /data-face-id="probe"[^>]*data-admission="admitted"/, 'the admitted face is drawn as admitted')
  assert.match(markup, /data-face-id="waiting-dial"[^>]*data-admission="waiting"/, 'the waiting face is drawn as waiting, with its note')
  const everyFamily = renderToStaticMarkup(createElement(rack.InhabitantRack, {manifests: manifests.allInhabitantManifests(), transport}))
  assert.match(everyFamily, /data-family="fixture-seventh"/, 'the rack over the whole door view draws it too')
  for (const id of SIX) assert.match(everyFamily, new RegExp(`data-family="${id}"`), `${id} still composes into the rack`)
})

test('the seventh family obeys the same laws: the door validator, the Live gate, waiting, and the standalone pop-out rule', () => {
  admitSevenPlusSix()
  const composed = manifests.inhabitantManifest(FAMILY)
  assert.deepEqual(manifests.validateInhabitantManifest(composed), [], 'the composed manifest validates with no faults')
  const gate = sdkValidate.validateAdmittedWorld()
  assert.equal(gate.byFamily.get(FAMILY)?.length ?? 0, 0, 'the Live gate finds no fault in the family')
  assert.deepEqual(gate.cross.filter(fault => fault.includes(FAMILY)), [], 'no cross-family fault names it')

  const dial = composed.faces.find(face => face.id === 'waiting-dial')
  assert.equal(dial.admission, 'waiting')
  assert.ok(dial.note, 'a waiting face names what it waits for')
  assert.equal(sdkDefine.devicePopsOut(SEVENTH.devices[1]), false, 'a waiting face does not pop out')

  const probe = composed.faces.find(face => face.id === 'probe')
  assert.equal(probe.admission, undefined, 'an admitted face carries the default admitted state')
  assert.equal(manifests.faceStandsAlone(probe), false, 'a parameter face does not draw its body in a window of its own')
  assert.equal(sdkDefine.devicePopsOut(SEVENTH.devices[0]), false, 'the default never offers pop-out where the body cannot stand alone')
  assert.throws(() => sdkDefine.devicePopsOut({...SEVENTH.devices[0], popOut: true}), /refuses pop-out/, 'an asked-for pop-out is refused by name')
})

test('the device identity check refuses the seventh family\'s faces by name, and the native kinds are the door\'s', () => {
  admitSevenPlusSix()
  const all = manifests.allInhabitantManifests()
  const identity = {family: FAMILY, face: 'probe', aperture: NO_APERTURE}
  const fault = detached.deviceIdentityFault(identity, all)
  assert.ok(fault, 'a non-standalone face has no pop-out identity')
  assert.match(fault, /fixture-seventh\/probe/, fault)
  assert.match(detached.deviceIdentityFault({family: 'fixture-unknown', face: 'probe', aperture: NO_APERTURE}, all) ?? '', /no admitted family "fixture-unknown"/)
  assert.match(detached.deviceIdentityFault({family: FAMILY, face: 'no-such-face', aperture: NO_APERTURE}, all) ?? '', /declares no face "no-such-face"/)
  // The native receiving kinds come from the door's declared kinds, not from the fixture.
  assert.equal(detached.nativeDetachedBodySupported('device'), true)
  assert.equal(detached.nativeDetachedBodySupported('object'), false, 'a door kind without a native body is refused')
})

test('the gate refuses a seventh product that claims no authority or squats a registered product', () => {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  assert.throws(() => sdkDefine.admitFamily({...SEVENTH, id: 'fixture-no-authority', newProduct: {id: PRODUCT, authority: '   '}}), /commissioning authority/)
  assert.throws(() => sdkDefine.admitFamily({...SEVENTH, id: 'fixture-squat', product: 'central', newProduct: undefined}), /registered product|one product family per product/)
  assert.equal(door.familyManifest('fixture-no-authority'), undefined, 'a refused declaration never reaches the door')
})
