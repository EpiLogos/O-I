import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const oraclePath = process.env.OI_AGENT_SHELL_ORACLE
  ?? '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/agent-shell-fidelity.json'
const fidelity = JSON.parse(await readFile(oraclePath, 'utf8'))

const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
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
}`)}`, root.href)

const {parseDataI} = await import('../src/agent/statusInfo.ts')
const {AGENT_DATA_I, AGENT_CONTROL_PAIRS, AGENT_DATA_I_FACTORIES, AGENT_TRANSPORT_TIPS, AGENT_TRANSPORT_IDS} = await import('../src/agent/agentFidelity.ts')

// Oracle controls carrying the data-i hook (the id:null entries included).
const dataIControls = fidelity.controls.filter(control => control.hook === 'data-i')

test('parseDataI splits on the first pipe and trims', () => {
  assert.deepEqual(parseDataI('Push|off · on land.'), {label: 'Push', fn: 'off · on land.'})
  assert.deepEqual(parseDataI('Run|Live’s Play. Launches the selected task.'), {label: 'Run', fn: 'Live’s Play. Launches the selected task.'})
  assert.deepEqual(parseDataI('A|B|C'), {label: 'A', fn: 'B|C'}, 'only the FIRST pipe separates')
  assert.deepEqual(parseDataI('  Spend | Where Live’s CPU meter sits.  '), {label: 'Spend', fn: 'Where Live’s CPU meter sits.'})
})

test('parseDataI handles label-only and absent values', () => {
  assert.deepEqual(parseDataI('Spend'), {label: 'Spend', fn: ''})
  assert.equal(parseDataI(''), null)
  assert.equal(parseDataI(null), null)
  assert.equal(parseDataI(undefined), null)
})

test('every fixed AGENT_DATA_I entry parses and is verbatim in the oracle controls', () => {
  assert.ok(Object.keys(AGENT_DATA_I).length > 0)
  for (const [key, value] of Object.entries(AGENT_DATA_I)) {
    const parsed = parseDataI(value)
    assert.ok(parsed, `${key} does not parse`)
    assert.ok(parsed.label.length > 0, `${key} has an empty label`)
    const verbatim = dataIControls.some(control => control.label === parsed.label && control.function === parsed.fn)
    assert.ok(verbatim, `${key} pair is not verbatim in the oracle: ${value}`)
  }
})

test('AGENT_DATA_I covers the lane control keys', () => {
  const required = [
    // 18 transport ids
    'tBrowser', 'tap', 'effort', 'effDn', 'effUp', 'hb', 'tokScope', 'follow',
    'play', 'stop', 'rec', 'od', 'arm', 'loop', 'vSession', 'vArr', 'tDetail', 'tDock',
    // transport extras
    'link', 'budget', 'quantize', 'tokIn', 'tokOut', 'position', 'handBack', 'capture',
    'punchIn', 'punchOut', 'writeWindowIn', 'writeWindowOut', 'point', 'keys', 'earthView',
    'map', 'throughput', 'context', 'spend', 'expressionsTab', 'techneTab', 'workbenchTab',
    // grid ('arm' of the grid is 'trackArm'; transport Write arm keeps 'arm')
    'hardStop', 'retry', 'telemetry', 'telemetryContext', 'solo', 'trackArm', 'watch', 'model',
    'subagentModel', 'group', 'queued', 'emptySlot', 'groupSlot', 'main', 'mainTelemetry',
    'runs', 'openThread',
    // dock (oracle ids: lfold = Fold, lmore = Library)
    'resize', 'wider', 'narrower', 'lfold', 'lmore', 'curate', 'pin', 'close',
    // devices (fixed)
    'writeMode', 'connect', 'transportMode', 'approvals', 'gateways', 'frameMonitor', 'git',
    'commit', 'push', 'land', 'dropZone', 'then', 'outputStyle', 'power', 'input',
    'activityBudget', 'steers',
  ]
  for (const key of required) assert.ok(key in AGENT_DATA_I, `missing AGENT_DATA_I.${key}`)
})

test('AGENT_DATA_I_FACTORIES covers the parametric controls with oracle strings', () => {
  const cases = [
    ['taskN', () => AGENT_DATA_I_FACTORIES.taskN(4), 'Task · 4', 'Task · ${n}',
      "${st==='run'?'Running — no end is drawn; its needle is the live edge.':st==='stall'?'Stalled: the needle stopped where its output stopped.':'Done.'} Double-click to open the thread."],
    ['rowN', () => AGENT_DATA_I_FACTORIES.rowN(2), 'Row · 2', 'Row · ${r}',
      'Launch the row: fires every task in it across sessions — a batch.'],
    ['skillsetRackN', () => AGENT_DATA_I_FACTORIES.skillsetRackN(3), 'Skillset · 3', 'Skillset · ${n}',
      'A rack of skills; drop it on a session’s chain.'],
    ['worldBridgeN', () => AGENT_DATA_I_FACTORIES.worldBridgeN(5), 'World · bridge-5', 'World · bridge-2',
      'What the session may read (teal) and write (amber).'],
    ['gatewayN', () => AGENT_DATA_I_FACTORIES.gatewayN('hermes'), 'Gateway · hermes', 'Gateway · hermes',
      'Where the session runs: the harness connection (Hermes tui_gateway, JSON-RPC over stdio or WebSocket). Frames flow along the link; the ring is the replay buffer; the outer pulse is the heartbeat.'],
    ['gatewayFoldedN', () => AGENT_DATA_I_FACTORIES.gatewayFoldedN('Gateway'), 'Gateway (folded)', '${n} (folded)',
      'A device folded to its title, as in Live.'],
    ['agentset', () => AGENT_DATA_I_FACTORIES.agentset('Port crew'), 'Agentset · Port crew', 'Agentset · Port crew',
      'One chain per member, nested as spawned, each with its model. Click a member to open its thread.'],
    ['agentFace', () => AGENT_DATA_I_FACTORIES.agentFace('Fizz'), 'Fizz · agent', '${a.name} · agent',
      'Compact. Click: expand in the pool. ↗: open its thread full.'],
  ]
  for (const [key, make, expected, oracleLabel, oracleFn] of cases) {
    assert.equal(typeof AGENT_DATA_I_FACTORIES[key], 'function', `missing factory ${key}`)
    const parsed = parseDataI(make())
    assert.ok(parsed, `${key} output does not parse`)
    assert.equal(parsed.label, expected, `${key} label`)
    // The function text must be a verbatim oracle control function, and the
    // oracle label it derives from must exist on that same or another control.
    const fnVerbatim = dataIControls.some(control => control.function === oracleFn)
    const labelVerbatim = dataIControls.some(control => control.label === oracleLabel)
    assert.ok(fnVerbatim, `${key} function text not found in the oracle controls`)
    assert.ok(labelVerbatim, `${key} oracle label template not found: ${oracleLabel}`)
    assert.equal(parsed.fn, oracleFn, `${key} function text`)
  }
})

test('AGENT_TRANSPORT_TIPS derives from the same pairs (label · function)', () => {
  const pairTips = new Set(Object.values(AGENT_CONTROL_PAIRS).map(([label, fn]) => `${label} · ${fn}`))
  for (const [alias, tip] of Object.entries(AGENT_TRANSPORT_TIPS)) {
    assert.ok(pairTips.has(tip), `TIPS.${alias} is not derived from AGENT_CONTROL_PAIRS`)
    const parsed = parseDataI(tip.replaceAll(' · ', '|'))
    assert.ok(parsed, `TIPS.${alias} does not carry a label`)
  }
  for (const alias of ['browser', 'link', 'tap', 'effort', 'effortDn', 'effortUp', 'budget', 'heartbeat',
    'quantize', 'tokens', 'tokIn', 'tokOut', 'follow', 'position', 'run', 'stop', 'voice', 'steer',
    'writeArm', 'handBack', 'capture', 'loop', 'sessionTab', 'arrangementTab', 'detail', 'dock',
    'spend', 'wider', 'narrower', 'fold']) {
    assert.ok(alias in AGENT_TRANSPORT_TIPS, `missing TIPS alias ${alias}`)
  }
})

test('AGENT_TRANSPORT_IDS equals the oracle transport orderHint in order', () => {
  assert.deepEqual([...AGENT_TRANSPORT_IDS], fidelity.transport.orderHint)
})
