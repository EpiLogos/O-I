import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// The Live semantics gate (DEVICE-SEMANTICS-LOCK §1, §2, §5; ticket
// T-SEMANTICS-GATE). Each door refuses a face that does not occupy a Live
// semantic, or breaks its invariant, mode or format — and the world's
// semantic registry is locked to a reviewed snapshot.

// Production modules in memory (the house loader pattern: .ts/.tsx
// transpiled, CSS stubbed, expressions-boundary resolved to source).
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

const door = await import('../src/inhabitants/familyManifest.ts')
const schema = await import('../src/inhabitants/manifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const centralL7 = await import('../src/inhabitants/centralFamilyL7.ts')
const sdkDefine = await import('../src/inhabitants/sdk/define.ts')
const sdkValidate = await import('../src/inhabitants/sdk/validate.ts')
const semantics = await import('../src/inhabitants/sdk/semantics.ts')

const probeManifest = face => ({
  id: 'probe-world',
  browser: ['probe'],
  faces: [face],
  params: {grammar: 'probe/parameter-address/v1'},
  projections: [],
  inspectors: [],
  time: {consumes: [], contributes: []},
  telemetry: null,
})

const honestDevice = (overrides = {}) => ({
  id: 'probe',
  title: 'Probe',
  icon: 'form',
  liveSemantic: 'info',
  note: 'a readings-only probe face',
  ...overrides,
})

const probeFamily = (devices, extra = {}) => ({
  id: 'acme',
  owner: 'Acme Instruments',
  browser: ['acme'],
  paramsGrammar: 'acme/parameter-address/v1',
  devices,
  ...extra,
})

// ---------------------------------------------------------------------------
// 1 — the registry and the standing world. These run FIRST: the atlas family
// self-admits on import, and a door reset would clear it for later tests.

test('the standing world passes the gate, and every admitted face occupies a Live semantic', () => {
  world.loadWorldShellFamilies()
  // The gate's world includes Central L7's day-now (lock §2.2); see validate-devices.mjs.
  centralL7.declareCentralFamilyL7()
  const gate = sdkValidate.validateAdmittedWorld()
  assert.deepEqual([...gate.byFamily.entries()], [], 'no family faults in the standing world')
  assert.deepEqual(gate.cross, [], 'no cross-family faults in the standing world')
  for (const manifest of door.allFamilyManifests()) {
    for (const face of manifest.faces) {
      assert.ok(semantics.isLiveSemantic(face.liveSemantic), `${manifest.id}/${face.id} occupies "${face.liveSemantic}"`)
    }
  }
  assert.equal(sdkValidate.semanticRegistry().length, 55, 'the world carries its 55 faces (38 + the L7 day-now + the knowledge graph’s 3, T-KNOWLEDGE-GRAPH-DEVICE + Central\'s page family\'s 7, lane BC2 + Software Factory\'s thread, tasks and agentset rack, lane BF3 + Central\'s packet and search, lane BC3 + Quaternal Logic\'s Sitting, T-WORLDS W4)')
})

test('the semantic registry is locked to its reviewed snapshot (lock §5.6)', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../src/inhabitants/sdk/semantic-registry.json', import.meta.url), 'utf8'))
  const live = JSON.parse(JSON.stringify(sdkValidate.semanticRegistry()))
  assert.deepEqual(live, snapshot, 'the registry drifted from its snapshot — run `node scripts/validate-devices.mjs --write-registry` and review the diff')
})

test('the registry names the write path and the Live exemplar of each face', () => {
  const registry = sdkValidate.semanticRegistry()
  const find = (family, face) => registry.find(entry => entry.family === family && entry.face === face)
  const dayDie = find('central', 'day-die')
  assert.equal(dayDie.liveSemantic, 'device-instrument')
  assert.deepEqual(dayDie.writePaths, ['kernel:receiving'])
  assert.match(dayDie.exemplar, /ableton-live-12\.0\.25\/devices\/operator-voice\.md$/)
  const gitSeat = find('workcell', 'git-seat')
  assert.deepEqual(gitSeat.writePaths, ['workcell-cli:git commit'])
  const globe = find('atlas-earth', 'globe-engine')
  assert.deepEqual(globe.writePaths, [], 'a generatesAbsent face names no write path')
  assert.equal(find('software-factory', 'agent-custody').liveSemantic, 'macro')
})

test('every registry entry names its holders (heldBy): an array of known holders (lock §4.8, §4.9)', () => {
  for (const entry of sdkValidate.semanticRegistry()) {
    assert.ok(Array.isArray(entry.heldBy), `${entry.family}/${entry.face} carries heldBy`)
    for (const holder of entry.heldBy) assert.ok(semantics.isHolder(holder), `${entry.family}/${entry.face} names the known holder "${holder}"`)
  }
})

test('the write-path grammar moved to semantics.ts and validate.ts re-exports it unchanged', () => {
  assert.equal(sdkValidate.isWritePath, semantics.isWritePath)
  assert.equal(semantics.isWritePath('kernel:receiving'), true)
  assert.equal(semantics.isWritePath('shell.setWriteArm'), true)
  assert.equal(semantics.isWritePath('workcell-cli:seat land'), true)
  assert.equal(semantics.isWritePath('just words'), false)
})

// ---------------------------------------------------------------------------
// 2 — the vocabulary and the mode legality tables (lock §1, §2).

test('the vocabulary is the closed set of the lock, and every semantic has its Live exemplar', () => {
  assert.equal(semantics.LIVE_SEMANTICS.length, 28)
  for (const semantic of semantics.LIVE_SEMANTICS) {
    assert.match(semantics.LIVE_EXEMPLARS[semantic], /^Work\/reverse-engineering\/ableton-live-12\.0\.25\/.+/, `${semantic} points at its Live exemplar`)
  }
  assert.equal(semantics.isLiveSemantic('scene'), false, 'the DLW "scene" is an Expression clip; the Live row is a stop')
  assert.equal(semantics.isLiveSemantic('stop'), true)
})

test('mode legality: live admits all; techne refuses audio and midi effects; base refuses midi effects only', () => {
  assert.equal(semantics.LEGAL_SEMANTICS_BY_MODE.live.length, semantics.LIVE_SEMANTICS.length)
  assert.ok(!semantics.LEGAL_SEMANTICS_BY_MODE.techne.includes('device-audio-fx'))
  assert.ok(!semantics.LEGAL_SEMANTICS_BY_MODE.techne.includes('device-midi-fx'))
  assert.ok(!semantics.LEGAL_SEMANTICS_BY_MODE.base.includes('device-midi-fx'))
  assert.ok(semantics.LEGAL_SEMANTICS_BY_MODE.base.includes('device-audio-fx'))
  for (const mode of Object.keys(semantics.LEGAL_SEMANTICS_BY_MODE)) {
    assert.ok(semantics.LEGAL_SEMANTICS_BY_MODE[mode].includes('return'), `return is legal in ${mode} (lock §4.3)`)
  }
})

// ---------------------------------------------------------------------------
// 3 — each refusal, at each door. The fault names the law.

test('door 1 — admitFamilyManifest refuses a face without, with an unknown, or with an illegal semantic', () => {
  door.resetFamilyManifestsForTest()
  assert.throws(() => door.admitFamilyManifest(probeManifest({id: 'f', presentations: ['compact']})), /no liveSemantic/)
  assert.throws(() => door.admitFamilyManifest(probeManifest({id: 'f', presentations: ['compact'], liveSemantic: 'widget'})), /closed vocabulary/)
  assert.throws(
    () => door.admitFamilyManifest(probeManifest({id: 'f', presentations: ['compact'], liveSemantic: 'device-midi-fx', invariant: {transforms: 'notes'}, modes: ['techne']})),
    /illegal in mode "techne"/,
  )
  assert.equal(door.familyManifest('probe-world'), undefined, 'a refused family never reaches the door')
  door.admitFamilyManifest(probeManifest({id: 'f', presentations: ['compact'], liveSemantic: 'info'}))
  assert.ok(door.familyManifest('probe-world'), 'a valid face is admitted')
})

test('door 1 — admitFamilyManifest refuses each broken invariant with its named field', () => {
  door.resetFamilyManifestsForTest()
  const refuses = (face, pattern) => assert.throws(() => door.admitFamilyManifest(probeManifest({id: 'f', presentations: ['compact'], ...face})), pattern)
  refuses({liveSemantic: 'device-instrument'}, /an instrument generates/)
  refuses({liveSemantic: 'device-instrument', invariant: {generates: 'not a path'}}, /not an owner write path/)
  refuses({liveSemantic: 'device-audio-fx'}, /names the material it transforms/)
  refuses({liveSemantic: 'rack', invariant: {chains: ['a']}}, /chainSelector/)
  refuses({liveSemantic: 'macro', invariant: {maps: []}}, /maps at least one/)
  refuses({liveSemantic: 'macro', invariant: {maps: [{key: 'autonomy'}]}}, /carries no range/)
  refuses({liveSemantic: 'clip', invariant: {material: 'm', revision: 'r'}}, /names its states/)
  refuses({liveSemantic: 'track'}, /names its native stream/)
  refuses({liveSemantic: 'stop'}, /names the clips it launches together/)
  refuses({liveSemantic: 'return'}, /routes to an owner write path/)
  refuses({liveSemantic: 'return', invariant: {routesTo: 'just words'}}, /routes to an owner write path/)
  refuses({liveSemantic: 'rack', invariant: {chains: ['a'], chainSelector: 'a', routesTo: 'kernel:receiving'}}, /does not belong to liveSemantic "rack"/)
  refuses({liveSemantic: 'info', invariant: {stream: 'x'}}, /does not belong to liveSemantic "info"/)
  door.resetFamilyManifestsForTest()
})

test('door 2 — declareFamilyExtension refuses an extension face that breaks the law before composing', () => {
  door.resetFamilyManifestsForTest()
  door.admitFamilyManifest(probeManifest({id: 'base', presentations: ['compact'], liveSemantic: 'info'}))
  assert.throws(
    () => schema.declareFamilyExtension('probe-world', {id: 'probe:x', by: 'test', faces: [{id: 'x-face', presentations: ['compact']}]}),
    /no liveSemantic/,
  )
  assert.throws(
    () => schema.declareFamilyExtension('probe-world', {id: 'probe:y', by: 'test', faces: [{id: 'y-face', presentations: ['compact'], liveSemantic: 'stop'}]}),
    /names the clips it launches together/,
  )
  door.resetFamilyManifestsForTest()
})

test('door 3 — validateInhabitantManifest names a missing and an unknown semantic on a composed manifest', () => {
  const manifest = {
    ...probeManifest({id: 'x', presentations: ['compact']}),
    faces: [{id: 'missing', presentations: ['compact']}, {id: 'unknown', presentations: ['compact'], liveSemantic: 'gizmo'}],
  }
  const faults = [...schema.validateInhabitantManifest(manifest)]
  assert.ok(faults.some(fault => fault.startsWith('probe-world/missing: no liveSemantic')), faults.join(' | '))
  assert.ok(faults.some(fault => fault.startsWith('probe-world/unknown: liveSemantic "gizmo" is not in the closed vocabulary')), faults.join(' | '))
})

test('door 4 — admitFamily refuses a device without a semantic, an illegal mode, an incompatible format, or a broken rack', () => {
  door.resetFamilyManifestsForTest()
  const withoutSemantic = honestDevice()
  delete withoutSemantic.liveSemantic
  assert.throws(() => sdkDefine.admitFamily(probeFamily([withoutSemantic])), /no liveSemantic/)
  assert.throws(
    () => sdkDefine.admitFamily(probeFamily([honestDevice({liveSemantic: 'device-midi-fx', invariant: {transforms: 'notes'}, modes: ['techne']})])),
    /illegal in mode "techne"/,
  )
  assert.throws(
    () => sdkDefine.admitFamily(probeFamily([honestDevice({liveSemantic: 'device-audio-fx', invariant: {transforms: 'x'}, formats: {live: 'die'}})])),
    /format "die" \(mode "live"\) is incompatible with liveSemantic "device-audio-fx"/,
  )
  assert.throws(
    () => sdkDefine.admitFamily(probeFamily([honestDevice({liveSemantic: 'track', invariant: {stream: 's'}, formats: {live: 'run-viewer'}})])),
    /"run-viewer" belongs to factory only/,
  )
  assert.throws(
    () => sdkDefine.admitFamily(probeFamily([honestDevice({liveSemantic: 'rack', invariant: {chains: ['a']}})])),
    /chainSelector/,
  )
  assert.equal(door.familyManifest('acme'), undefined, 'refused declarations never reach the door')
  door.resetFamilyManifestsForTest()
})

test('door 4 — admitFamily admits a waiting instrument with no generates (waiting faces are exempt, lock §5.3)', () => {
  door.resetFamilyManifestsForTest()
  const admitted = sdkDefine.admitFamily(probeFamily([honestDevice({liveSemantic: 'device-instrument', admission: 'waiting', note: 'waits for its owner'})]))
  assert.equal(admitted.manifest.faces[0].liveSemantic, 'device-instrument')
  door.resetFamilyManifestsForTest()
})

test('door 5 — declareDeviceExtension refuses an extension device without a semantic', () => {
  door.resetFamilyManifestsForTest()
  sdkDefine.admitFamily(probeFamily([honestDevice()]))
  assert.throws(
    () => sdkDefine.declareDeviceExtension({id: 'acme:more', by: 'test', family: 'acme', devices: [{id: 'more', title: 'More', icon: 'form', params: []}]}),
    /no liveSemantic/,
  )
  door.resetFamilyManifestsForTest()
})

test('door 6 — validateAdmittedWorld refuses a macro that maps no row of its family, an unarmed shell write, an unknown tool and an unknown kernel op', () => {
  door.resetFamilyManifestsForTest()
  door.admitFamilyManifest(probeManifest({id: 'm', presentations: ['compact'], liveSemantic: 'macro', invariant: {maps: [{key: 'nope', range: ['a', 'b']}]}}))
  let faults = sdkValidate.validateAdmittedWorld().byFamily.get('probe-world') ?? []
  assert.ok(faults.some(fault => /macro maps "nope", which is no declared row/.test(fault)), faults.join(' | '))
  door.resetFamilyManifestsForTest()

  door.admitFamilyManifest(probeManifest({id: 'r', presentations: ['compact'], liveSemantic: 'return', invariant: {routesTo: 'shell.notArmedAnywhere'}}))
  faults = sdkValidate.validateAdmittedWorld().byFamily.get('probe-world') ?? []
  assert.ok(faults.some(fault => /armed by no one/.test(fault)), faults.join(' | '))
  door.resetFamilyManifestsForTest()

  door.admitFamilyManifest(probeManifest({id: 'r', presentations: ['compact'], liveSemantic: 'return', invariant: {routesTo: 'nosuchtool:do thing'}}))
  faults = sdkValidate.validateAdmittedWorld().byFamily.get('probe-world') ?? []
  assert.ok(faults.some(fault => /unknown tool/.test(fault)), faults.join(' | '))
  door.resetFamilyManifestsForTest()

  door.admitFamilyManifest(probeManifest({id: 'r', presentations: ['compact'], liveSemantic: 'return', invariant: {routesTo: 'kernel:not_an_op'}}))
  faults = sdkValidate.validateAdmittedWorld().byFamily.get('probe-world') ?? []
  assert.ok(faults.some(fault => /names no kernel op/.test(fault)), faults.join(' | '))
  door.resetFamilyManifestsForTest()
})
