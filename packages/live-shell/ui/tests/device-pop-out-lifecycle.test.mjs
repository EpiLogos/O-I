import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production modules in memory (same loader pattern as
// expressions-family-manifest.test.mjs): .ts/.tsx transpiled, CSS stubbed,
// and @epilogos/expressions-boundary/<name> resolved to the boundary source.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', root).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(s, c, n) {
  if (s.startsWith('@epilogos/expressions-boundary/')) return n(BOUNDARY + s.slice('@epilogos/expressions-boundary/'.length) + '.ts', c);
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

// Device pop-out is the rack-device lifecycle (WORLD-SHELL-DESIGN §4, §5, §10.8): every admitted device face that is not
// waiting declares `pop-out` in its dock, and its family declares the `device` detached kind. The receiving window's
// loader admits the same families the main window does, through the same door. Channel: scripted (node test, no render).

const schema = await import('../src/inhabitants/manifest.ts')
const door = await import('../src/inhabitants/familyManifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const sdk = await import('../src/inhabitants/sdk/define.ts')
const detached = await import('../src/native/detachedKinds.ts')

const aperture = {day: null, flow: null, conversation: null, instrument: null}
const POP_OUT_FAMILIES = ['actuation', 'ai-kit', 'atlas-earth', 'central', 'knowledge-graph', 'quaternal-logic', 'software-factory', 'workcell']

test('every admitted non-waiting device face pops out, and its family declares the device kind', () => {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  const manifests = schema.allInhabitantManifests()
  const popping = new Set()
  for (const manifest of manifests) {
    for (const face of manifest.faces) {
      if (face.admission === 'waiting') {
        assert.ok(!(face.dock ?? ['dock']).includes('pop-out'), `${manifest.id}/${face.id} waits and must not pop out`)
        continue
      }
      assert.ok((face.dock ?? ['dock']).includes('pop-out'), `${manifest.id}/${face.id} is a device and must pop out`)
      assert.ok((manifest.detachedKinds ?? []).includes('device'), `${manifest.id} declares no device kind`)
      popping.add(manifest.id)
      // The receiving window's own check passes for every popping face (no fault is drawn).
      assert.equal(detached.deviceIdentityFault({family: manifest.id, face: face.id, aperture}, manifests), null, `${manifest.id}/${face.id}`)
    }
  }
  assert.deepEqual([...popping].sort(), POP_OUT_FAMILIES)
})

test('the Central device faces (day-die, flow-document, nara-conversation) keep their lifecycles and gain the device kind', () => {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  const central = schema.inhabitantManifest('central')
  for (const id of ['day-die', 'flow-document', 'nara-conversation']) {
    const face = central.faces.find(entry => entry.id === id)
    assert.deepEqual([...face.dock], ['dock', 'expand', 'pop-out'], id)
  }
  assert.deepEqual([...central.detachedKinds].sort(), ['device', 'encounter', 'file', 'flow'])
})

test('a rack device pop-out is refused by name where its family lacks the device kind; the manifest validator keeps its door-kind law', () => {
  // The validator's law is the existing one: a pop-out face needs the family's detached kinds (any door kind).
  const manifest = (detachedKinds) => ({
    id: 'probe-family',
    browser: [],
    ...(detachedKinds ? {detachedKinds} : {}),
    faces: [{id: 'probe', liveSemantic: 'info', presentations: ['compact'], dock: ['dock', 'pop-out']}],
    params: {grammar: 'probe/v1'},
    projections: [],
    inspectors: [],
    time: {consumes: [], contributes: []},
    telemetry: null,
  })
  assert.match(schema.validateInhabitantManifest(manifest(undefined)).join('\n'), /detachedKinds/)
  assert.deepEqual(schema.validateInhabitantManifest(manifest(['flow'])), [])
  // The rack's device door is stricter: the device identity stands only where the family declares the device kind.
  const identity = {family: 'probe-family', face: 'probe', aperture}
  assert.match(detached.deviceIdentityFault(identity, [manifest(['flow'])]), /does not declare the device detached kind/)
  assert.equal(detached.deviceIdentityFault(identity, [manifest(['device'])]), null)
})

test('the receiving window loader admits knowledge-graph and atlas, and admits them again after a door reset', () => {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  assert.ok(door.familyManifest('knowledge-graph'), 'knowledge-graph admitted by the loader')
  assert.ok(door.familyManifest('atlas-earth'), 'atlas-earth admitted by the loader')
  // The module imports ran once; a reset must not strand either family behind a flag or an import that will not re-run.
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  assert.ok(door.familyManifest('knowledge-graph'), 'knowledge-graph re-admitted after a reset')
  assert.ok(door.familyManifest('atlas-earth'), 'atlas-earth re-admitted after a reset')
  assert.equal(schema.allInhabitantManifests().filter(manifest => manifest.id === 'atlas-earth').length, 1)
})

test('the SDK default: a device pops out unless it opts out, a waiting device does not, and the family declares the device kind', () => {
  const devices = [
    {id: 'default-face', title: 'Default', icon: 'form', liveSemantic: 'info', note: 'pops by default'},
    {id: 'expand-face', title: 'Expand', icon: 'form', liveSemantic: 'info', note: 'keeps its own lifecycle', dock: ['dock', 'expand']},
    {id: 'private-face', title: 'Private', icon: 'form', liveSemantic: 'info', note: 'opts out', popOut: false, dock: ['dock', 'expand']},
    {id: 'waiting-face', title: 'Waiting', icon: 'form', liveSemantic: 'info', note: 'waits', admission: 'waiting'},
  ]
  const {manifest} = sdk.buildFamilyDeclaration({id: 'probe-sdk', owner: 'probe', browser: [], devices, paramsGrammar: 'probe-sdk/v1'})
  const dockOf = id => manifest.faces.find(face => face.id === id).dock
  assert.deepEqual([...dockOf('default-face')], ['dock', 'pop-out'])
  assert.deepEqual([...dockOf('expand-face')], ['dock', 'expand', 'pop-out'])
  assert.deepEqual([...dockOf('private-face')], ['dock', 'expand'])
  assert.equal(dockOf('waiting-face'), undefined)
  assert.deepEqual([...manifest.detachedKinds], ['device'])
  assert.deepEqual(schema.validateInhabitantManifest(manifest), [])
  assert.deepEqual(
    [sdk.devicePopsOut({id: 'a', title: 'a', icon: 'form', liveSemantic: 'info'}), sdk.devicePopsOut({id: 'b', title: 'b', icon: 'form', liveSemantic: 'info', popOut: false})],
    [true, false],
  )
  const optedOut = sdk.buildFamilyDeclaration({id: 'probe-quiet', owner: 'probe', browser: [], paramsGrammar: 'probe-quiet/v1',
    devices: [{id: 'quiet', title: 'Quiet', icon: 'form', liveSemantic: 'info', popOut: false}]})
  assert.equal(optedOut.manifest.detachedKinds, undefined)
})

test('a device face declared through an extension composes with the device kind, once, on an admitted family', () => {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  const extension = sdk.declareDeviceExtension({
    id: 'central:qa-device-default', by: 'qa', family: 'central',
    devices: [{id: 'qa-default', title: 'QA Default', icon: 'form', liveSemantic: 'info', note: 'pops by default'}],
  })
  assert.deepEqual(extension.detachedKinds, ['device'])
  const central = schema.inhabitantManifest('central')
  assert.deepEqual([...central.faces.find(face => face.id === 'qa-default').dock], ['dock', 'pop-out'])
  assert.equal(central.detachedKinds.filter(kind => kind === 'device').length, 1, 'the device kind is declared once')
})
