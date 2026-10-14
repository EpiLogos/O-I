// The device declaration gate (DEVICE-SEMANTICS-LOCK §0.1 every designed element occupies a Live semantic AND keeps its invariant;
// §5.3 the invariants; §0.4 owners write, faces read; manual §10.4 "all three show the same live settings"; R2 objection 9).
//
// The manifest gate (inhabitants/sdk/validate.ts) checks that a face DECLARES its invariant. Nothing checked that the
// `DeviceInstance` a family builds from that declaration CARRIES it, so a declared instrument could stand at all three sizes
// with no generating control (Central's die and conversation did). This gate reads the instances, not the manifests:
//   - `device-instrument` that `generates` a path: some row of the instance writes through exactly that path, and the instance
//     carries the `submit` that writes it. A row with a write path and no `submit` is a control that cannot write;
//   - `device-instrument` that declares `generatesAbsent`: no row pretends a writer;
//   - `device-audio-fx` / `device-midi-fx` with a `replaceReceipt`, and `return` with a `routesTo`: a row on that path;
//   - `clip` with `states`: a row that exposes exactly those states (the invariant is not left unread);
//   - `macro`: every row it maps is a row of its own device.
// The gate is written once (`declarationFaults`) and run over every family's instances it can build here. Each instance is built
// in the standing where its owner answers (an aperture selected, an owner following), because a family may draw a row as a
// reading while its owner cannot take it, with the reason; Central's instances are also built with no reading at all and with
// none of its apertures, because Central keeps its write row at every size whether or not an owner stands.
//
// Channels: SCRIPTED over the production builders (no screen). Families whose builders need a live harness or an editor reading
// (Expressions, the atlas, the knowledge graph) are not reached here; `declarationFaults` is exported for them to add.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
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

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const {isWritePath} = await import('../src/inhabitants/sdk/semantics.ts')
const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
const {loadWorldShellFamilies} = await import('../src/inhabitants/worldShellFamilies.ts')
loadWorldShellFamilies() // the shell admits the declared families once per module load (shell/ModeDetail.tsx)
const central = await import('../src/central/devices/centralDeviceModel.ts')
const {torusDevice} = await import('../src/live/torusDevice.ts')
const ql = await import('../src/inhabitants/ql/devices/qlDevices.ts')
const agent = await import('../src/agent/devices/agentChainDevices.ts')
const vertical = await import('../src/central/centralVertical.ts')

/** The gate. `instance` is a `DeviceInstance` (frame/devices/deviceRuntime.ts). Returns the faults, each naming the instance. */
export function declarationFaults(instance) {
  const faults = []
  const where = instance.id
  const fault = message => faults.push(`${where}: ${message}`)
  const {liveSemantic, invariant = {}} = instance.face
  const written = instance.rows.filter(row => row.writePath)
  const pathOf = new Set(written.map(row => row.writePath))
  for (const row of written) {
    if (!isWritePath(row.writePath)) fault(`row "${row.key}" writes through "${row.writePath}", which is no owner path`)
  }
  if (written.length && typeof instance.submit !== 'function') fault(`rows ${written.map(row => `"${row.key}"`).join(', ')} name a write path but the instance has no submit: a control that cannot write`)
  if (typeof instance.submit === 'function' && !written.length) fault('the instance carries a submit but no row names a write path: a door to nothing')
  switch (liveSemantic) {
    case 'device-instrument':
      if (invariant.generates !== undefined && !pathOf.has(invariant.generates)) fault(`a device-instrument that generates through "${invariant.generates}" has no row on that path (rows: ${instance.rows.map(row => row.key).join(', ')}) — the declared instrument has no generating control`)
      if (invariant.generatesAbsent !== undefined && written.length) fault(`generatesAbsent names the owner it waits for, yet rows ${written.map(row => `"${row.key}"`).join(', ')} pretend a writer`)
      break
    case 'device-audio-fx':
    case 'device-midi-fx':
      if (invariant.replaceReceipt !== undefined && !pathOf.has(invariant.replaceReceipt)) fault(`an effect whose replacing write leaves "${invariant.replaceReceipt}" has no row on that path`)
      break
    case 'return':
      if (invariant.routesTo !== undefined && !pathOf.has(invariant.routesTo)) fault(`a return that routes to "${invariant.routesTo}" has no row on that path`)
      break
    case 'clip':
      if (invariant.states !== undefined && !instance.rows.some(row => JSON.stringify(row.values) === JSON.stringify(invariant.states))) {
        fault(`a clip whose states are ${JSON.stringify(invariant.states)} exposes them in no row — its state invariant is unread`)
      }
      break
    case 'macro':
      for (const map of invariant.maps ?? []) if (!instance.rows.some(row => row.key === map.key)) fault(`a macro maps "${map.key}", which is no row of its own device`)
      break
    default:
  }
  return faults
}

// ── the instances the gate reads ─────────────────────────────────────────────────────────────────────────────────────────────────

const centralFaces = inhabitantManifest('central').faces
const DAY_REF = 'central:day:control:root:2026-10-06'
const readyDay = vertical.interpretDayOpen(DAY_REF, {data: {schema: 'oi.central-day-open/v1', project: null, day: {
  document_state: 'ready', source: {ref: 'central:source:control:root:Control/user/day/2026-10-06/day.md'},
  document: {document_id: 'day-document:2026-10-06'}, revision: {revision: 'central.content-fnv1a64/v1:12:0000000000000001'}}}})
const FULL_READS = {
  day: {standing: readyDay, face: 3, revision: 'central.content-fnv1a64/v1:12:0000000000000001'},
  flow: {path: 'Control/user/flows/a.html', revision: 'central.content-fnv1a64/v1:9:0000000000000002', state: 'saved'},
  nara: {state: 'bound', conversation: null, gap: null, expression: 'expression:x', session: 'session:y'},
  roster: {answer: 'read', identity: 'agent/central-guardian', accepted: 2, total: 3, fault: null},
  workcell: {answer: 'read', ref: 'workcell:mac', health: 'ok', ok: true, fault: null},
  impact: {kind: 'folder', path: 'Work/O-I'},
}
const centralInstances = [{}, FULL_READS].flatMap((reads, at) => centralFaces.map(face => ({source: `central, ${at ? 'every owner answering' : 'no reading'}`, instance: central.centralDevice(face, reads)})))

const FOLLOWING = {ok: true, determinants: {lens: {lens12: 3, label: 'L1′'}, contextFrame: 2, harmonic: {selection: 'canonical-basis', index: 0}, m3: 'DNA'},
  value: {schema: 'ql.instrument-reading/v1', standing: 'following', identity: {event_ref: 'event:t'}, available: true, queued_blocks: 0},
  parameters: {muted: true, level: 1, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: null, refusal: null}}
const qlFace = inhabitantManifest('quaternal-logic')?.faces.find(face => face.id === ql.QL_INSTRUMENT_FACE)
const otherInstances = [
  {source: 'live, the instrument following', instance: torusDevice(FOLLOWING)},
  ...(qlFace ? [{source: 'quaternal-logic, the instrument following', instance: ql.qlInstrumentDevice(qlFace, FOLLOWING)}] : []),
  ...agent.agentChainDevices({sessionRef: 'session:fixture', reading: {...agent.INITIAL_READING}, accepted: {}}, async row => ({kind: 'fired', channel: 'shell', writePath: row.writePath, note: 'acknowledged'}))
    .map(({device}) => ({source: 'factory, the chain', instance: device})),
]

// ── the gate's own proof: it fails the way objection 9 failed ────────────────────────────────────────────────────────────────────

test('the gate fails a declared generating instrument that has no write row, and a control with no door', () => {
  const declared = {id: 'x:die', family: 'x', rows: [{key: 'face', title: 'Face', type: 'enumerated', values: ['a']}], values: {},
    face: {id: 'die', title: 'Die', icon: 'die', liveSemantic: 'device-instrument', invariant: {generates: 'kernel:receiving'}}}
  assert.match(declarationFaults(declared).join('\n'), /has no row on that path/, 'the declared instrument has no generating control')
  const noDoor = {...declared, rows: [{key: 'face', title: 'Face', type: 'enumerated', values: ['a'], writePath: 'kernel:receiving'}]}
  assert.match(declarationFaults(noDoor).join('\n'), /no submit/, 'a control that cannot write')
  assert.deepEqual(declarationFaults({...noDoor, submit: async () => {}}), [], 'the row and its door together keep the invariant')
  const pretend = {...declared, face: {...declared.face, invariant: {generatesAbsent: 'the owner op'}}, rows: noDoor.rows, submit: async () => {}}
  assert.match(declarationFaults(pretend).join('\n'), /pretend a writer/)
  const clip = {id: 'x:flow', family: 'x', rows: [], values: {}, face: {id: 'flow', title: 'Flow', icon: 'form', liveSemantic: 'clip', invariant: {material: 'm', revision: 'r', states: ['draft', 'saved']}}}
  assert.match(declarationFaults(clip).join('\n'), /state invariant is unread/)
  assert.deepEqual(declarationFaults({...clip, rows: [{key: 'state', title: 'State', type: 'enumerated', values: ['draft', 'saved']}]}), [])
  assert.deepEqual(declarationFaults({id: 'x:fx', family: 'x', rows: [], values: {}, face: {id: 'fx', title: 'Fx', icon: 'form', liveSemantic: 'macro', invariant: {maps: [{key: 'gone', range: [0, 1]}]}}}).length, 1)
})

// ── Central: every declared face, with and without an owner standing ─────────────────────────────────────────────────────────────

test('Central: every declared face\'s instance keeps its declaration, whatever the owners are doing', () => {
  assert.ok(centralInstances.length >= 2 * 7, 'every declared face is built, bare and answered')
  const faults = centralInstances.flatMap(({instance}) => declarationFaults(instance))
  assert.deepEqual(faults, [])
  // The two instruments in particular, and the clip: the reviewer\'s objection, named.
  const by = id => central.centralDevice(centralFaces.find(face => face.id === id), {})
  assert.deepEqual(by('day-die').rows.filter(row => row.writePath).map(row => [row.key, row.writePath]), [['face', 'kernel:receiving']])
  assert.deepEqual(by('nara-conversation').rows.filter(row => row.writePath).map(row => [row.key, row.writePath]), [['bound', 'kernel:nara_dialogue']])
  assert.deepEqual(by('flow-document').rows.find(row => row.key === 'state').values, ['draft', 'saved', 'edited since save'], 'the Flow\'s states are a row')
})

// ── the other families this gate can reach ────────────────────────────────────────────────────────────────────────────────────────

// What the gate found in the families outside Central's zone when it was written (14 Oct 2026). Each is a real mismatch between
// a declaration and its instance, named with the zone that owns the fix. They are tolerated here so this suite is the gate for
// Central and for NEW faults anywhere; a gap that is fixed shows in the diagnostics below and is then deleted from this list.
const KNOWN_GAPS = [
  {id: 'quaternal-logic:ql-instrument', rule: 'generates through "kernel:native_expression" has no row on that path', owner: 'src/inhabitants/ql/devices/qlDevices.ts',
    why: 'the face declares it generates through kernel:native_expression; its rows write through stage:instrument (QL_WRITE_PATH), the hosted stage channel. Either the declaration names the stage path or the rows write the declared op.'},
  {id: 'factory:agent', rule: 'generates through "kernel:harness_agent_control" has no row on that path', owner: 'src/agent/devices/agentChainDevices.ts',
    why: 'the Agent is declared an instrument that generates through kernel:harness_agent_control; none of its rows (autonomy, effort, budget-used, input, heartbeat, model, identity) writes there — its writes are shell setters, and that op is the gateway rows\'.'},
]

test('the other families\' instances keep their declarations where their owners answer — and what is known to fall short is named, with its owner', t => {
  assert.ok(otherInstances.length >= 2, 'the torus and the Factory chain are reached')
  const found = otherInstances.flatMap(({source, instance}) => declarationFaults(instance).map(message => ({source, id: instance.id, message})))
  const known = fault => KNOWN_GAPS.find(gap => gap.id === fault.id && fault.message.includes(gap.rule))
  assert.deepEqual(found.filter(fault => !known(fault)).map(fault => `[${fault.source}] ${fault.message}`), [], 'a declaration an instance does not keep, and no one has named')
  for (const gap of KNOWN_GAPS) {
    const standing = found.some(fault => known(fault) === gap)
    t.diagnostic(`${standing ? 'STANDS' : 'CLEARED (delete from KNOWN_GAPS)'}: ${gap.id} — ${gap.owner}`)
  }
})
