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

const schema = await import('../src/inhabitants/manifest.ts')
const door = await import('../src/inhabitants/familyManifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const sdk = await import('../src/inhabitants/sdk/define.ts')
const detached = await import('../src/native/detachedKinds.ts')
const rack = await import('../src/inhabitants/inhabitantRack.tsx')

const aperture = {day: null, flow: null, conversation: null, instrument: null}
const withDay = {...aperture, day: {project: null, sourceRef: 'source:day', documentId: 'day-doc'}}
const withFlow = {...aperture, flow: {location: {}}}
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}
const host = (popped = false) => ({popOut() {}, redock() {}, poppedOut: () => popped})
const STANDALONE = [['day-die', 'document'], ['flow-document', 'document'], ['nara-conversation', 'conversation']]
const POPPING_FAMILIES = ['central']
const NON_STANDALONE = [
  ['atlas-earth', 'globe-engine'], ['atlas-earth', 'graph-tools'], ['atlas-earth', 'mode-switch'], ['atlas-earth', 'time-control'],
  ['knowledge-graph', 'knowledge-scope'], ['knowledge-graph', 'knowledge-filters'], ['knowledge-graph', 'knowledge-display'],
  ['actuation', 'gateway'], ['ai-kit', 'skill-device'], ['workcell', 'seat'], ['software-factory', 'ledger'], ['central', 'context-world'],
]

const loaded = () => {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  return schema.allInhabitantManifests()
}

test('the standalone set is exactly the four faces whose bodies draw in a window of their own', () => {
  for (const [id, kind] of STANDALONE) assert.equal(schema.standsAlone(id, kind), true, `${id} stands alone`)
  assert.equal(schema.standsAlone('day-die', 'parameter'), false, 'a parameter face never stands alone')
  assert.equal(schema.standsAlone('globe-engine', 'instrument'), false, 'the atlas globe drives the main window handle')
  const manifests = loaded()
  const standing = manifests.flatMap(manifest => manifest.faces.filter(schema.faceStandsAlone).map(face => `${manifest.id}/${face.id}`)).sort()
  assert.deepEqual(standing, ['central/day-die', 'central/flow-document', 'central/nara-conversation'])
})

test('a device pops out exactly where its face stands alone; the families that carry those faces declare the device kind', () => {
  const manifests = loaded()
  const popping = []
  for (const manifest of manifests) {
    for (const face of manifest.faces) {
      const pops = (face.dock ?? ['dock']).includes('pop-out')
      const expected = schema.faceStandsAlone(face) && face.admission !== 'waiting'
      assert.equal(pops, expected, `${manifest.id}/${face.id}: pop-out ${expected ? 'declared' : 'not declared'}`)
      if (!pops) continue
      popping.push(manifest.id)
      assert.ok((manifest.detachedKinds ?? []).includes('device'), `${manifest.id} declares the device kind`)
      const aperturePart = {'day-die': withDay, 'flow-document': withFlow}[face.id] ?? aperture
      assert.equal(detached.deviceIdentityFault({family: manifest.id, face: face.id, aperture: aperturePart}, manifests), null, `${manifest.id}/${face.id}`)
    }
  }
  assert.deepEqual([...new Set(popping)].sort(), POPPING_FAMILIES)
  for (const manifest of manifests) {
    if (!POPPING_FAMILIES.includes(manifest.id)) assert.ok(!(manifest.detachedKinds ?? []).includes('device'), `${manifest.id} carries no popping face`)
  }
})

test('the Central device faces keep their lifecycles and carry the device kind beside flow, file and encounter', () => {
  loaded()
  const central = schema.inhabitantManifest('central')
  for (const id of ['day-die', 'flow-document', 'nara-conversation']) {
    assert.deepEqual([...central.faces.find(entry => entry.id === id).dock], ['dock', 'expand', 'pop-out'], id)
  }
  assert.deepEqual([...central.detachedKinds].sort(), ['device', 'encounter', 'file', 'flow'])
})

test('the device door refuses by name a face that does not stand alone, even where its manifest declares pop-out and the device kind', () => {
  const manifests = loaded()
  for (const [familyId, faceId] of NON_STANDALONE) {
    const manifest = manifests.find(entry => entry.id === familyId)
    const forced = {
      ...manifest,
      detachedKinds: ['device'],
      faces: manifest.faces.map(face => face.id === faceId ? {...face, dock: ['dock', 'pop-out']} : face),
    }
    const fault = detached.deviceIdentityFault({family: familyId, face: faceId, aperture}, [forced])
    assert.match(fault ?? '', /does not stand alone/, `${familyId}/${faceId}`)
  }
})

test('the device door refuses a standalone face whose aperture is absent, by name', () => {
  const manifests = loaded()
  assert.match(detached.deviceIdentityFault({family: 'central', face: 'day-die', aperture}, manifests), /needs its Day/)
  assert.equal(detached.deviceIdentityFault({family: 'central', face: 'day-die', aperture: withDay}, manifests), null)
  assert.match(detached.deviceIdentityFault({family: 'central', face: 'flow-document', aperture}, manifests), /needs its flow/)
  assert.equal(detached.deviceIdentityFault({family: 'central', face: 'nara-conversation', aperture}, manifests), null, 'Nara shows its own state without a conversation')
})

test('the validator is unchanged: a pop-out face needs detachedKinds, and any door kind satisfies it', () => {
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
  // The device door is the stricter gate: the same face is refused there by name.
  assert.match(detached.deviceIdentityFault({family: 'probe-family', face: 'probe', aperture}, [manifest(['device'])]), /does not stand alone/)
})

test('the rack draws no pop-out mark for a face that cannot stand alone, and a live one for a standing face with a host', () => {
  const manifests = loaded()
  const atlas = manifests.find(entry => entry.id === 'atlas-earth')
  assert.doesNotMatch(renderToStaticMarkup(createElement(rack.InhabitantRack, {manifests: [atlas], transport, deviceWindows: host()})), /data-action="pop-out"/)
  const central = schema.inhabitantManifest('central')
  const nara = {...central, faces: central.faces.filter(face => face.id === 'nara-conversation')}
  const markup = renderToStaticMarkup(createElement(rack.InhabitantRack, {manifests: [nara], transport, deviceWindows: host()}))
  const tag = markup.match(/<button[^>]*data-action="pop-out"[^>]*>/)[0]
  assert.doesNotMatch(tag, /disabled/)
  // Without a host door the same mark stands disabled.
  const idle = renderToStaticMarkup(createElement(rack.InhabitantRack, {manifests: [nara], transport}))
  assert.match(idle.match(/<button[^>]*data-action="pop-out"[^>]*>/)[0], /disabled/)
})

test('the faces that draw from the identity alone have a body in the window; a parameter face has none', () => {
  const central = schema.inhabitantManifest('central')
  const nara = central.faces.find(face => face.id === 'nara-conversation')
  assert.ok(rack.faceBodyFor(nara, {transport}), 'the Nara body draws in its own window')
  const parameter = central.faces.find(face => face.id === 'context-world')
  assert.equal(rack.faceBodyFor(parameter, {transport}), null, 'a parameter face has no body in the rack or the window')
})

test('the SDK default: a device pops out only where its window draws its body alone; the kit declares the device kind for it', () => {
  const devices = [
    {id: 'nara-conversation', title: 'Nara', icon: 'form', liveSemantic: 'device-instrument', invariant: {generates: 'kernel:nara_dialogue'}, kind: 'conversation', conversation: {binding: 'oi.nara-dialogue-binding/v1'}, note: 'stands alone'},
    {id: 'default-face', title: 'Default', icon: 'form', liveSemantic: 'info', note: 'a parameter: no body of its own'},
    {id: 'expand-face', title: 'Expand', icon: 'form', liveSemantic: 'info', note: 'keeps its lifecycle', dock: ['dock', 'expand']},
    {id: 'private-face', title: 'Private', icon: 'form', liveSemantic: 'info', note: 'opts out', popOut: false, dock: ['dock', 'expand']},
    {id: 'ql-instrument', title: 'Waiting', icon: 'form', liveSemantic: 'device-instrument', invariant: {generatesAbsent: 'kernel:native_expression'}, kind: 'instrument', admission: 'waiting', note: 'waits'},
  ]
  const {manifest} = sdk.buildFamilyDeclaration({id: 'probe-sdk', owner: 'probe', browser: [], devices, paramsGrammar: 'probe-sdk/v1'})
  const dockOf = id => manifest.faces.find(face => face.id === id).dock
  assert.deepEqual([...dockOf('nara-conversation')], ['dock', 'pop-out'])
  assert.equal(dockOf('default-face'), undefined, 'a parameter face does not pop out by default')
  assert.deepEqual([...dockOf('expand-face')], ['dock', 'expand'])
  assert.deepEqual([...dockOf('private-face')], ['dock', 'expand'])
  assert.equal(dockOf('ql-instrument'), undefined, 'a waiting face does not pop out')
  assert.deepEqual([...manifest.detachedKinds], ['device'])
  assert.deepEqual(schema.validateInhabitantManifest(manifest), [])
  assert.equal(sdk.devicePopsOut(devices[0]), true)
  assert.equal(sdk.devicePopsOut(devices[1]), false)
  const bare = sdk.buildFamilyDeclaration({id: 'probe-bare', owner: 'probe', browser: [], paramsGrammar: 'probe-bare/v1', devices: [devices[1]]})
  assert.equal(bare.manifest.detachedKinds, undefined, 'no popping face, no device kind')
})

test('the SDK refuses a pop-out the author asks for on a face that cannot stand alone, by name', () => {
  const build = device => sdk.buildFamilyDeclaration({id: 'probe-refuse', owner: 'probe', browser: [], paramsGrammar: 'probe-refuse/v1', devices: [device]})
  assert.throws(() => build({id: 'parameter-pop', title: 'P', icon: 'form', liveSemantic: 'info', popOut: true}), /refuses pop-out/)
  assert.throws(() => build({id: 'parameter-dock', title: 'P', icon: 'form', liveSemantic: 'info', dock: ['dock', 'pop-out']}), /refuses pop-out/)
  assert.doesNotThrow(() => build({id: 'parameter-quiet', title: 'P', icon: 'form', liveSemantic: 'info', popOut: false}))
})

test('an extension of a parameter device composes without the device kind or any pop-out', () => {
  loaded()
  const extension = sdk.declareDeviceExtension({
    id: 'central:qa-parameter', by: 'qa', family: 'central',
    devices: [{id: 'qa-parameter', title: 'QA Parameter', icon: 'form', liveSemantic: 'info', note: 'a readings face'}],
  })
  assert.equal(extension.detachedKinds, undefined)
  const central = schema.inhabitantManifest('central')
  assert.equal(central.faces.find(face => face.id === 'qa-parameter').dock, undefined)
})

test('a device window is admitted and let go on its identity alone; a file window waits on this window\'s World/access (r23)', async () => {
  // r23: the Day's first Pop-out read "The detached native World/access epoch is unavailable or has retired", and its Re-dock did
  // nothing: a device draws on the main window's relay and reads no native file, yet its window waited on an access it may never get.
  const {detachedAdmission, DETACHED_ACCESS_RETIRED} = await import('../src/native/detachedAdmission.ts')
  const calls = []
  let access = {ready: false, epoch: 0, current: () => false}
  const admission = detachedAdmission({access: () => access, loadFamilies: () => calls.push('families'),
    readConfig: async () => { calls.push('config'); return {product_ids: [], contributions: []} },
    admitContribution: binding => calls.push(`contribution:${binding.id}`), checkpoint: async ids => { calls.push(`checkpoint:${ids.join(',')}`) }})
  const device = {id: 'device:central/day-die', kind: 'device', device: {family: 'central', face: 'day-die', aperture: {day: {project: null, sourceRef: 's', documentId: 'd'}}}}
  await admission.admitBinding(device)
  await admission.beforeRelease(device)
  assert.deepEqual(calls, ['families'], 'admitted and let go with no access, no config read and no checkpoint')
  await assert.rejects(admission.admitBinding({...device, id: 'device:central/other'}), /does not name its family and face/)
  const file = {id: 'file-1', kind: 'file', ref: 'central:path:x'}
  await assert.rejects(admission.admitBinding(file), new RegExp(DETACHED_ACCESS_RETIRED.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')), 'a file still waits on access')
  await assert.rejects(admission.beforeRelease(file), /World\/access/)
  access = {ready: true, epoch: 3, current: epoch => epoch === 3}
  calls.length = 0
  await admission.admitBinding(file)
  await admission.beforeRelease(file)
  assert.deepEqual(calls, ['config', 'contribution:file-1', 'checkpoint:file-1'])
})
