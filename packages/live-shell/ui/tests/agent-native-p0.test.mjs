// Agent-native P0 ligaments — the cut-test suite (lane zcode:agent-native-p0,
// 2026-10-11). The commission's honesty law: every ligament carries a test
// that fails when the ligament is CUT. Here that is literal — the binding
// tests re-run the fire path against a door WITHOUT the P0 declarations and
// assert the difference. The value-carrier tests capture the kernel payload
// at the dispatch boundary; the honest refusals are asserted with their
// named owner ops.

import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

// Production modules in memory (the house loader pattern: .ts/.tsx
// transpiled, CSS stubbed, expressions-boundary resolved to source).
const here = dirname(fileURLToPath(import.meta.url))
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', new URL('../../../../', import.meta.url)).href
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
    // a directory import (the atlas panel's shell workspace reads ../continuity): its index, as the bundler resolves it
    for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
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
const five = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const p0 = await import('../src/inhabitants/agentNativeP0.ts')
const sdkDefine = await import('../src/inhabitants/sdk/define.ts')
const adoptRows = await import('../src/inhabitants/sdk/adoptVerifiedRows.ts')
const sdkSetters = await import('../src/inhabitants/sdk/shellSetters.ts')
const sdkModes = await import('../src/inhabitants/sdk/modes.ts')
const dispatch = await import('../src/agent/agentNativeDispatch.ts')
const bridge = await import('../src/agent/toolBridge.ts')
const modeGrammar = await import('../src/shell/modeGrammar.ts')

const TRANSPORT = {kind: 'bridge', url: 'http://kernel.test'}
const BINDING = 'cursor'

/** Stand the world up: families, the verified table's adoption, then the
 * P0 batch. Reset first — the door is single-owner. */
function standWorld() {
  door.resetFamilyManifestsForTest()
  five.loadAgentShellFamilies()
  adoptRows.adoptVerifiedRows()
  p0.loadAgentNativeP0()
}

test('ligament 1 — the transport bindings are declared, and every bound slot resolves its §14 row', () => {
  standWorld()
  const bindings = sdkDefine.allTransportBindings()
  assert.ok(bindings.length >= 8, `the P0 batch declares ${bindings.length} bindings (≥8)`)
  // Each binding resolves: its row exists, its slot addressing is legal.
  for (const binding of bindings) {
    const row = sdkDefine.transportBindingRow(binding)
    assert.ok(row, `${binding.family} ${binding.mode}/${binding.row} → ${binding.face}/${binding.key} resolves a §14 row`)
    assert.ok(row.writePath || row.disclosure, `${binding.family}/${binding.face}/${binding.key} declares its owner operation or its honest absence`)
  }
  // The audited slots specifically: factory tempo→effort, metro→heartbeat,
  // overdub→input, arm→write-mode; base arm→write-mode.
  const slotOf = (mode, slot) => sdkDefine.transportBindingForSlot(mode, slot)
  assert.equal(slotOf('factory', 'tempo')?.key, 'effort')
  assert.equal(slotOf('factory', 'tempo')?.family, 'actuation')
  assert.equal(slotOf('factory', 'metro')?.key, 'heartbeat')
  assert.equal(slotOf('factory', 'overdub')?.key, 'input')
  assert.equal(slotOf('factory', 'arm')?.key, 'write-mode')
  assert.equal(slotOf('base', 'arm')?.key, 'write-mode')
  assert.equal(slotOf('factory', 'quantize')?.key, 'interrupt-quantize')
  assert.equal(slotOf('factory', 'play')?.key, 'task-control')
  assert.equal(slotOf('factory', 'stop')?.key, 'task-control')
})

test('ligament 1 — CUT TEST: with the P0 declarations cut, the audited slots are unbound and refuse', async () => {
  // The world WITHOUT the ligament: families + the verified table only.
  door.resetFamilyManifestsForTest()
  five.loadAgentShellFamilies()
  adoptRows.adoptVerifiedRows()
  assert.equal(sdkDefine.allTransportBindings().length, 0, 'cut: zero bindings stand (the audit\u2019s own finding)')
  for (const slot of ['tempo', 'metro', 'overdub', 'arm', 'quantize', 'play', 'stop']) {
    const outcome = await dispatch.fireTransportSlot('factory', slot, 'high', {transport: TRANSPORT, binding: BINDING})
    assert.deepEqual(outcome, {kind: 'unbound'}, `cut slot factory/${slot} refuses as unbound`)
  }
  // And the loader refuses to run without its families (the door is theirs).
  door.resetFamilyManifestsForTest()
  assert.throws(() => p0.loadAgentNativeP0(), /families not yet admitted/)
})

test('ligament 1 — the slot table agrees with the shell frame\u2019s grammar (28 slots, same bytes)', () => {
  assert.deepEqual([...sdkModes.TRANSPORT_SLOT_IDS], [...modeGrammar.TRANSPORT_SLOT_IDS])
  // Every row's slots decompose onto the bar, and the decomposition covers
  // all 28 exactly once.
  const covered = new Set()
  for (const row of sdkModes.TRANSPORT_ROWS) {
    for (const slot of sdkModes.TRANSPORT_ROW_SLOTS[row]) {
      assert.ok(!covered.has(slot), `slot ${slot} covered twice by the row decomposition`)
      covered.add(slot)
    }
  }
  assert.equal(covered.size, sdkModes.TRANSPORT_SLOT_IDS.length)
})

test('ligament 1 — double-booking normalizes onto slots: a row binding collides with a slot binding', async () => {
  standWorld()
  // The factory arm slot is software-factory's (write-mode). A second
  // family claiming the same slot through a ROW binding (arm-capture
  // covers the arm slot) double-books — the world gate faults the cross.
  sdkDefine.admitFamily({
    id: 'acme',
    owner: 'Acme',
    browser: ['acme'],
    paramsGrammar: 'acme/parameter-address/v1',
    writerAuthority: 'test fixture (itself)',
    transport: [{mode: 'factory', row: 'arm-capture', face: 'probe', key: 'mode'}],
    devices: [{
      id: 'probe', title: 'Probe', icon: 'form', liveSemantic: 'info',
      params: [sdkDefine.enumParam({key: 'mode', title: 'Mode', type: 'enumerated', values: ['a', 'b'], writePath: 'shell.setAcmeMode'})],
    }],
    writers: ['shell.setAcmeMode'],
  })
  const sdkValidate = await import('../src/inhabitants/sdk/validate.ts')
  const world = sdkValidate.validateAdmittedWorld()
  const booking = world.cross.find(fault => fault.includes('transport double-booking') && fault.includes('factory/arm'))
  assert.ok(booking, `the gate faults the double-booked slot: ${world.cross.join(' | ')}`)
  assert.match(booking, /software-factory/)
  assert.match(booking, /acme/)
  door.resetFamilyManifestsForTest()
})

test('ligament 3 — the value ARRIVES at the kernel boundary: carrier rows dispatch configure, armed shell rows disclose their setter', async () => {
  standWorld()
  const captured = []
  const invoke = async (_transport, op) => {
    captured.push(op)
    return {outcome: {result: 'harness_agent_outcome', document: {state: 'configured'}}, error: undefined}
  }
  // A KERNEL-channel row: the gateway transport value rides the carrier.
  const gatewayTransport = sdkParamRowOf('actuation', 'gateway', 'transport')
  const receipt = await dispatch.fireWritePath(gatewayTransport, 'ws', {transport: TRANSPORT, binding: BINDING, invoke})
  assert.equal(receipt.kind, 'fired', `gateway transport fires: ${JSON.stringify(receipt)}`)
  assert.deepEqual(captured[0], {op: 'harness_agent_control', binding: BINDING, control: 'configure', value: {transport: 'ws'}})
  // An ARMED SHELL row (the effort row's verified path is shell.setEffort):
  // before the shell registers its setter, the dispatch refuses NAMING the
  // setter — the honest pre-wiring state the ligament-4 bridge closes.
  const effortRow = sdkDefine.transportBindingRow({mode: 'factory', row: 'tempo', face: 'harness-model', key: 'effort', family: 'actuation'})
  assert.equal(effortRow.writePath, 'shell.setEffort')
  const preWiring = await dispatch.fireWritePath(effortRow, 'max', {transport: TRANSPORT, binding: BINDING, invoke})
  assert.equal(preWiring.kind, 'refused')
  assert.equal(preWiring.missingOp, 'shell.setEffort')
})

/** Resolve a chain row directly by instance + key (the adoption shape). */
function sdkParamRowOf(family, deviceInstance, key) {
  return sdkDefine.sdkParamRows(family).find(row => row.deviceInstance === deviceInstance && row.key === key)
}

test('ligament 3 — the bare lifecycle control fires TODAY: task-control resume/stop dispatch the union verbs', async () => {
  standWorld()
  const captured = []
  const invoke = async (_transport, op) => {
    captured.push(op)
    return {outcome: {result: 'harness_agent_outcome', document: {state: 'running'}}, error: undefined}
  }
  const row = sdkDefine.transportBindingRow({mode: 'factory', row: 'play', face: 'agent-custody', key: 'task-control', family: 'software-factory'})
  const play = await dispatch.fireWritePath(row, 'resume', {transport: TRANSPORT, binding: BINDING, invoke})
  assert.equal(play.kind, 'fired')
  assert.deepEqual(captured.at(-1), {op: 'harness_agent_control', binding: BINDING, control: 'resume'})
  const stop = await dispatch.fireWritePath(row, 'stop', {transport: TRANSPORT, binding: BINDING, invoke})
  assert.equal(stop.kind, 'fired')
  assert.deepEqual(captured.at(-1), {op: 'harness_agent_control', binding: BINDING, control: 'stop'})
  // A value outside the union refuses, named.
  const bad = await dispatch.fireWritePath(row, 'detonate', {transport: TRANSPORT, binding: BINDING, invoke})
  assert.equal(bad.kind, 'refused')
  assert.match(bad.reason, /not one of the control union/)
})

test('ligament 3 — the unpatched kernel\u2019s refusal is the honest state: steer-line names the carrier', async () => {
  standWorld()
  const invoke = async () => ({outcome: null, error: 'the kernel refused the operation: unknown variant `configure`, expected one of `new`, `stop`, `restart`, `pause`, `resume`'})
  const row = sdkDefine.transportBindingRow({mode: 'factory', row: 'tempo', face: 'harness-model', key: 'steer-line', family: 'actuation'})
  assert.ok(row, 'the steer-line row stands (same-day declaration)')
  const receipt = await dispatch.fireWritePath(row, 'settle physics next', {transport: TRANSPORT, binding: BINDING, invoke})
  assert.equal(receipt.kind, 'refused')
  assert.match(receipt.reason, /unknown variant `configure`/)
  assert.match(receipt.missingOp ?? '', /value-carrier patch/)
})

test('ligament 4 — heartbeat and write-arm refuse honestly, their owner ops named', async () => {
  standWorld()
  const captured = []
  const invoke = async (_t, op) => { captured.push(op); return {outcome: null, error: 'never called'} }
  // The heartbeat row's writePath is shell.setHeartbeat — an armed shell
  // row. Its refusal lives in the SETTER's kernel dispatch (fireKernelRow,
  // what the registered setter runs); fire that directly, as the bridge
  // does.
  const heartbeat = sdkParamRowOf('actuation', 'agent', 'heartbeat')
  const hb = await dispatch.fireHarnessControlByKey('heartbeat', false, {transport: TRANSPORT, binding: BINDING, invoke})
  assert.equal(hb.kind, 'refused')
  assert.match(hb.reason, /cron/)
  assert.match(hb.missingOp ?? '', /WO-A3/)
  assert.equal(captured.length, 0, 'heartbeat dispatches nothing — no carrier pretends a fire')

  const arm = sdkParamRowOf('software-factory', 'world', 'write-mode')
  const wa = await dispatch.fireHarnessControlByKey('write-mode', true, {transport: TRANSPORT, binding: BINDING, invoke})
  assert.equal(wa.kind, 'refused')
  assert.match(wa.reason, /presentation-state/)
  assert.match(wa.missingOp ?? '', /WO-SF2/)
  assert.equal(captured.length, 0)
})

test('ligament 4 — the setter bridge wires the armed values: registration, arrival, and the unregistered refusal', async () => {
  standWorld()
  const {registerAgentShellSetters} = await import('../src/agent/shellSetterBridge.ts')
  const presented = []
  const captured = []
  const shell = {
    setEffort: v => presented.push(['effort', v]),
    setSteer: v => presented.push(['steer', v]),
    setHeartbeat: v => presented.push(['heartbeat', v]),
    setWriteArm: v => presented.push(['writeArm', v]),
    setQuantize: v => presented.push(['quantize', v]),
    quantize: 'next tool',
  }
  const receipts = []
  registerAgentShellSetters({
    transport: () => TRANSPORT,
    binding: () => BINDING,
    shell,
    onReceipt: r => receipts.push(r),
    // Capture at the kernel boundary: the value ARRIVES through the bridge.
    invoke: async (_t, op) => { captured.push(op); return {outcome: {result: 'harness_agent_outcome', document: {}}, error: undefined} },
  })
  const receipt = await sdkSetters.shellSetter('shell.setEffort')('medium')
  assert.ok(presented.some(([key, value]) => key === 'effort' && value === 'medium'), 'presentation keeps the control\u2019s value true')
  assert.equal(receipt.kind, 'fired', `the setter returns a fired receipt: ${JSON.stringify(receipt)}`)
  assert.deepEqual(captured.at(-1), {op: 'harness_agent_control', binding: BINDING, control: 'configure', value: {effort: 'medium'}}, 'the value ARRIVES through the bridge')
  // The setter channel also answers refusals through the bridge: heartbeat
  // refuses naming the cron owner, nothing captured.
  const hbReceipt = await sdkSetters.shellSetter('shell.setHeartbeat')(false)
  assert.equal(hbReceipt.kind, 'refused')
  assert.match(hbReceipt.missingOp ?? '', /WO-A3/)

  // Cut test: with the registry reset, the same path refuses naming the setter.
  door.resetFamilyManifestsForTest()
  five.loadAgentShellFamilies()
  adoptRows.adoptVerifiedRows()
  p0.loadAgentNativeP0()
  const cut = await dispatch.fireWritePath(
    sdkParamRowOf('actuation', 'agent', 'effort'),
    'low',
    {transport: TRANSPORT, binding: BINDING},
  )
  assert.equal(cut.kind, 'refused')
  assert.equal(cut.missingOp, 'shell.setEffort', 'unregistered setter: the refusal NAMES the setter')
})

test('ligament 2 — the tool bridge parses the grammar and renders receipts', async () => {
  standWorld()
  // Grammar: tool, command, args.
  const parsed = bridge.parseToolCommand('workcell-cli:git commit --message "x"'.replace(/"/g, ''))
  assert.ok('tool' in parsed && parsed.tool === 'workcell-cli')
  assert.deepEqual(parsed.argv, ['git', 'commit', '--message', 'x'])
  // Malformed paths refuse.
  assert.ok('error' in bridge.parseToolCommand('workcell-cli'))
  assert.ok('error' in bridge.parseToolCommand('workcell-cli:'))
  // Dispatch through an injected runner: the receipt is the command's output.
  const receipt = await bridge.dispatchToolCommand('workcell-cli:seat status', {}, async command => {
    assert.equal(command.tool, 'workcell-cli')
    assert.deepEqual(command.argv, ['seat', 'status'])
    return {ok: true, output: 'env-1/o-i claimed'}
  })
  assert.equal(receipt.kind, 'fired')
  assert.match(receipt.note, /env-1\/o-i claimed/)
  // A refusing runner refuses, named.
  const refused = await bridge.dispatchToolCommand('ctrl:now list', {}, async () => ({ok: false, error: 'ctrl refused: unknown action'}))
  assert.equal(refused.kind, 'refused')
  assert.match(refused.reason, /ctrl refused/)
})

test('ligament 2 — no runner, no fake: the bridge names what a real runner needs', async () => {
  const receipt = await bridge.dispatchToolCommand('workcell-cli:git push', {}, bridge.terminalToolRunner)
  assert.equal(receipt.kind, 'refused')
  assert.ok(
    /terminal surface|Tauri shell host|tool-dispatch op/.test(receipt.reason),
    `the refusal names the runner: ${receipt.reason}`,
  )
})

test('same-day declarations — the new rows stand and the gate stays green over the whole batch', () => {
  standWorld()
  const rows = family => sdkDefine.sdkParamRows(family).map(row => `${row.deviceInstance}/${row.key}`)
  // The agent-chain same-day rows.
  assert.ok(rows('actuation').includes('agent/steer-line'), `actuation rows: ${rows('actuation').join(', ')}`)
  assert.ok(rows('actuation').includes('agent/interrupt-quantize'))
  assert.ok(rows('software-factory').includes('agent/task-control'))
  assert.ok(rows('software-factory').includes('agent/new-task'))
  // The atlas address layer (WO-AT1, wired): the atlas's own exposed parameters, one row each.
  const atlas = rows('atlas-earth')
  for (const address of [
    'graph-tools/depth', 'graph-tools/centre', 'graph-tools/repel', 'graph-tools/link', 'graph-tools/distance',
    'graph-tools/ties', 'graph-tools/kinds', 'graph-tools/occurrences', 'graph-tools/sky-anchors',
    'mode-switch/view', 'globe-engine/whole-field',
    'time-control/cursor', 'time-control/all-time', 'time-control/play', 'time-control/cumulative',
  ]) {
    assert.ok(atlas.includes(address), `atlas row ${address} stands`)
  }
  assert.equal(atlas.includes('time-control/occasion-window'), false, 'the clock takes no occasion window')
  // The central tenders: declared WITHOUT device write paths (the owner
  // arms, never the device), each disclosure naming the owner surface.
  const central = sdkDefine.sdkParamRows('central')
  for (const key of ['sweep-branch', 'prune-worktree', 'release-seat']) {
    const tender = central.find(row => row.deviceInstance === 'ground-hygiene' && row.key === key)
    assert.ok(tender, `tender ${key} declared`)
    assert.equal(tender.writePath, undefined, `${key} carries no device write path`)
    assert.match(tender.disclosure ?? '', /ctrl|workcell-cli|seat instrument|owner/i)
  }
  // The atlas setters are self-armed WITH an authority: the gate's writers
  // law stays green (asserted fully in the next test), and an unregistered
  // atlas dispatch refuses naming the setter (the honest pre-wiring state,
  // asserted in the test after it).
})

test('same-day declarations — the world gate passes with the batch standing', async () => {
  standWorld()
  const sdkValidate = await import('../src/inhabitants/sdk/validate.ts')
  const world = sdkValidate.validateAdmittedWorld()
  assert.equal(world.byFamily.size, 0, `gate faults: ${[...world.byFamily].map(([id, faults]) => `${id}: ${faults.join('; ')}`).join(' | ')}`)
  assert.deepEqual(world.cross, [])
})

test('same-day declarations — the atlas rows\u2019 writers are wired: unregistered they refuse naming the setter; registered, with no atlas mounted, they refuse naming the writer', async () => {
  standWorld()
  const depth = sdkDefine.sdkParamRows('atlas-earth').find(row => row.key === 'depth')
  // Cut test: the standing world carries no atlas setters until the shell's transport registers them.
  const cut = await dispatch.fireWritePath(depth, 2, {transport: TRANSPORT, binding: BINDING})
  assert.equal(cut.kind, 'refused')
  assert.equal(cut.missingOp, 'shell.setAtlasDepth')
  assert.match(cut.reason, /has not registered/)
  // Wired: the writer answers, and with no atlas mounted it refuses by name, never a silent drop.
  const shellBridge = await import('../src/agent/shellSetterBridge.ts')
  shellBridge.registerAtlasShellSetters()
  const receipt = await dispatch.fireWritePath(depth, 2, {transport: TRANSPORT, binding: BINDING})
  assert.equal(receipt.kind, 'refused')
  assert.equal(receipt.writePath, 'shell.setAtlasDepth')
  assert.equal(receipt.missingOp, undefined)
  assert.match(receipt.reason, /shell\.setAtlasDepth refuses.*not mounted/)
})
