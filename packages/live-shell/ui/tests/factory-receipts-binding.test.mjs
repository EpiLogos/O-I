// Lane BF3: Factory's Main track readers (src/agent/devices/receiptBindings.ts, FactoryDeviceChain.tsx, AgentDockTileBody.tsx) — the
// Ledger (software-factory:ledger, DLW §19.13, its widget §23.9) and Approvals (software-factory:approvals, §19.16, its widget §23.10).
//
// Channels:
// - REAL: two changes of the root register's change horizon as read on 16 Oct (Control/.central/source-change-control.json, the
//   reading the kernel's `central` inspect carries: an unattributed removal and a native operation's addition). No change in any
//   horizon on this machine names an agent, so the agent's change below is a FIXTURE shaped as ctrl/src/source_horizon.rs SourceChange.
// - FIXTURE: AIKit's consent request (desktop/cradle/src/encounter/client.ts NativePermission; the real views read on 16 Oct held none),
//   the Gateway's values and binding. Every port records its calls: no approval is answered, no owner state is written.
// - SCRIPTED: the two catalogue designs rendered through the runtime's host (deviceHost.HostedDevice) to static markup.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const family = await import('../src/inhabitants/familyManifest.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const {designKey} = await import('../src/frame/devices/designs.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const door = await import('../src/frame/devices/deviceDoor.ts')
const widgets = await import('../src/frame/widgets/deviceWidgets.tsx')
const bind = await import('../src/agent/devices/designBindings.ts')
const rec = await import('../src/agent/devices/receiptBindings.ts')
const {design: ledgerDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__ledger.tsx')
const {design: approvalsDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__approvals.tsx')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const views = ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (designed, binding) => views.map(view => renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}})))
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

// ---- REAL (root horizon, 16 Oct) ----------------------------------------------------------------------------------------------
const REMOVED = {schema: 'central.source-change/v1', change_ref: 'central:change:control:root:830', cursor: 830, world_ref: 'control:root',
  source_ref: 'central:source:control:root:Control/user/flows/o-i-the-mark-9ad0e0e9.expression.json', source_path: 'Control/user/flows/o-i-the-mark-9ad0e0e9.expression.json',
  source_roles: ['personal-human-source-aperture'], provenance: 'unresolved', standing: 'unspecified', treatment: 'control-user', agent_retrieval_allowed: true,
  before_revision: 'central.content-fnv1a64/v1:8894:7cff0f12f97985f2', after_revision: null, kind: 'removed', observed_at_unix_seconds: 1792108013, provider: 'central.filesystem-reconcile/v1'}
const NATIVE = {schema: 'central.source-change/v1', change_ref: 'central:change:control:root:821', cursor: 821, world_ref: 'control:root',
  source_ref: 'central:source:control:root:Control/agents/now/clearings/e3fd/now.json', source_path: 'Control/agents/now/clearings/e3fd/now.json', source_roles: ['now-clearing'],
  provenance: 'agent-maintained', standing: 'current-development-state', treatment: 'generated-derived', agent_retrieval_allowed: true, before_revision: null,
  after_revision: 'central.content-fnv1a64/v1:776:c8e9c7c0bcf630f7', kind: 'added', observed_at_unix_seconds: 1791751348, provider: 'central.filesystem-reconcile/v1',
  actor: 'central.now.allocate', actor_kind: 'native-operation'}
// ---- FIXTURE -----------------------------------------------------------------------------------------------------------------
const AGENT = {...NATIVE, change_ref: 'central:change:control:root:831', cursor: 831, source_path: 'Control/agents/now/day/2026-10-16.md', kind: 'modified',
  before_revision: 'central.content-fnv1a64/v1:1:aa', after_revision: 'central.content-fnv1a64/v1:2:bb', observed_at_unix_seconds: 1792157400,
  actor: 'agent:aletheia', actor_kind: 'agent', agent_session_ref: 'agent-session/fx-aletheia'}
const horizon = changes => ({schema: 'central.source-change-horizon/v1', world_ref: 'control:root', cursor: 831, sources: [], changes})
const TIME = {state: 'ready', action: 'central.time.policy', data: {schema: 'central.civil-time-reading/v1', civil_date: '2026-10-16', local_time: '12:00', revision: 'r',
  source_ref: 's', policy: {timezone: 'Europe/London', day_boundary_minutes: 0, automatic_day_rollover: false}}}
const ground = changes => ({sources: {state: 'ready', action: 'projectcentral.change.horizon', data: horizon(changes)}, time: TIME})

const SESSION = {sessionRef: 'agent-session/fx-aletheia', purpose: 'Explain run', agentRef: 'agent:aletheia', agentName: 'aletheia', agentAccepted: true, spaceRef: 's',
  spaceLabel: null, depth: 1, parentRef: 's', group: false, memberRefs: [], tasks: [], needle: null, telemetryOn: true, budget: {used: null, max: null}, disclosure: null}
const CONSENT = {native_request_id: 'req-7', native_session_id: 'n', tool_call_id: 'call-1', raw: {}, provenance: ['aikit'],
  tool_call: {kind: 'execute', title: 'Bash: rm -rf dist', rawInput: {command: 'rm -rf dist', cwd: '/Users/admin/Central/Work/O-I'}},
  choices: [{option_id: 'o1', label: 'Allow', kind: 'allow_once'}, {option_id: 'o2', label: 'Always', kind: 'allow_always'}, {option_id: 'o3', label: 'Reject', kind: 'reject_once'}]}
const PERMIT = {ref: 'aikit.encounter.permission', enabled: true, reason: null}
const encounter = (permissions, actions = [PERMIT]) => ({permissions, actions})

test('the Ledger and Approvals are keyed to their designs exactly, from Software Factory\'s admitted faces', () => {
  const devices = rec.receiptDevices()
  for (const [device, design] of [[devices.ledger, ledgerDesign], [devices.approvals, approvalsDesign]]) {
    assert.ok(device, `${design.id}: the family admits the face`)
    assert.equal(designKey(device.family, device.face.id), design.id)
  }
})

test('the Ledger reads Central\'s change horizon: a change an agent made is a receipt (landed, in the civil zone); the real changes no agent made are none', () => {
  bind.resetHolds()
  const real = rec.ledgerValues({ground: ground([NATIVE, REMOVED]), groundError: null, holds: bind.chainHolds()})
  assert.equal(real.receipts, '[]', 'the real horizon names no agent: an empty list, read — not an absent one')
  assert.deepEqual([real.light, real.today], ['lit', '2026-10-16'])
  const values = rec.ledgerValues({ground: ground([NATIVE, AGENT, REMOVED]), groundError: null, holds: bind.chainHolds()})
  // 13:30 UTC is 14:30 in the policy's zone (Europe/London, BST): the Day's own clock.
  assert.deepEqual(JSON.parse(values.receipts), [{n: 831, agent: 'agent:aletheia', outcome: 'landed', day: '2026-10-16', time: '14:30',
    files: [{path: 'Control/agents/now/day/2026-10-16.md', kind: 'modified', from: 'central.content-fnv1a64/v1:1:aa', to: 'central.content-fnv1a64/v1:2:bb'}],
    session: 'agent-session/fx-aletheia'}])
  assert.deepEqual([values.period, values.agent, values.outcome, values.order], ['today', 'all', 'all', 'newest'], 'the manual\'s starting filters, the view\'s own')
  for (const key of ['run', 'used', 'cap', 'tokensIn', 'tokensOut', 'spend', 'task']) assert.equal(values[key], undefined, `${key}: no reading`)
  const refused = {ground: {sources: {state: 'failed', action: 'projectcentral.change.horizon', error: {message: 'horizon locked'}}, time: TIME}, groundError: null, holds: bind.chainHolds()}
  assert.deepEqual([rec.ledgerValues(refused).light, rec.ledgerValues(refused).receipts], ['dark', undefined])
  assert.equal(rec.ledgerWaits(refused), 'horizon locked', 'the owner\'s words')
  assert.deepEqual(rec.ledgerValues({ground: null, groundError: null, holds: bind.chainHolds()}), {period: 'today', agent: 'all', outcome: 'all', order: 'newest'}, 'unread: nothing but the view')
  for (const [key, value] of Object.entries(ledgerDesign.defaults)) {
    if (['light', 'period', 'agent', 'outcome', 'order', 'today'].includes(key)) continue // the view's starts are the manual's; today is the civil day
    assert.notDeepEqual([key, values[key]], [key, value], `${key} carries the design's default`)
  }
})

test('the Ledger only reads: its filters are the view\'s; Open log selects the receipt\'s agent session, or says why it cannot', async () => {
  bind.resetHolds()
  const opened = []
  const binding = rec.ledgerBinding({ground: ground([AGENT, NATIVE]), groundError: null, holds: bind.chainHolds()}, {openSession: ref => { opened.push(ref); return null }})
  binding.local.outcome('landed')
  binding.local.task(831)
  const after = rec.ledgerValues({ground: ground([AGENT]), groundError: null, holds: bind.chainHolds()})
  assert.deepEqual([after.outcome, after.task], ['landed', 831])
  await binding.write([{key: 'openLog', value: 831}])
  assert.deepEqual(opened, ['agent-session/fx-aletheia'])
  await assert.rejects(() => binding.write([{key: 'openLog', value: 7}]), /not in the change horizon/)
  const gone = rec.ledgerBinding({ground: ground([AGENT]), groundError: null, holds: bind.chainHolds()}, {openSession: () => 'This agent session is not among Factory\'s sessions here.'})
  await assert.rejects(() => gone.write([{key: 'openLog', value: 831}]), /not among Factory's sessions/)
  await assert.rejects(() => binding.write([{key: 'receipts', value: '[]'}]), /is a reading/)
  bind.resetHolds()
})

test('Approvals: the Default answer is the Gateway\'s approvals key — the same read and the same write; the queue is the shown session\'s consent requests', async () => {
  bind.resetHolds()
  const calls = []
  const gateway = {write: async changes => { calls.push(['gateway', ...changes.map(change => [change.key, change.value])]) }, standing: {}}
  const ports = {permission: async (id, decision) => { calls.push(['permission', id, decision]) }}
  const input = {gateway: {approvals: 'session', transport: 'ws'}, session: SESSION, encounter: encounter([CONSENT]), holds: bind.chainHolds()}
  const binding = rec.approvalsBinding(input, gateway, ports)
  assert.equal(binding.values.approvals, 'session', 'the Gateway\'s own reading')
  assert.deepEqual(JSON.parse(binding.values.queue), [{id: 'req-7', kind: 'request', text: 'rm -rf dist', who: 'aletheia', where: 'execute', session: 'Explain run'}])
  assert.deepEqual([binding.values.light, binding.values.show, binding.values.order], ['lit', 'both', 'oldest'])
  await binding.write([{key: 'approvals', value: 'ask'}])
  await binding.write([{key: 'allowOnce', value: 'req-7'}])
  await binding.write([{key: 'allowAlways', value: 'req-7'}])
  await binding.write([{key: 'deny', value: 'req-7'}])
  assert.deepEqual(calls, [
    ['gateway', ['approvals', 'ask']],
    ['permission', 'req-7', {outcome: 'selected', option_id: 'o1'}],
    ['permission', 'req-7', {outcome: 'selected', option_id: 'o2'}],
    ['permission', 'req-7', {outcome: 'selected', option_id: 'o3'}],
  ], 'each answer is the harness\'s own choice, through the session\'s encounter (recorded here, never sent)')
  await assert.rejects(() => binding.write([{key: 'allowOnce', value: 'req-gone'}]), /no longer waits/)
  for (const key of ['wait', 'noAnswer', 'changes']) {
    assert.match(binding.standing[key].disabled, /missing op/, key)
    await assert.rejects(() => binding.write([{key, value: 'x'}]), /missing op/)
  }
  // REPLACED (W2): Approve writes through Central's acceptance where the chain hands its port (tests/w2-hookups-binding.test.mjs); with
  // none passed it stands disabled in those words.
  assert.equal(binding.standing.approve.disabled, rec.APPROVE_UNWIRED)
  await assert.rejects(() => binding.write([{key: 'approve', value: 'x'}]), /no acceptance port is passed here/)
  assert.equal(calls.length, 4, 'no refusal dispatched anything')
  binding.local.show('requests')
  binding.local.pick('req-7')
  const after = rec.approvalsValues({...input, holds: bind.chainHolds()})
  assert.deepEqual([after.show, after.pick], ['requests', 'req-7'])
  bind.resetHolds()
})

test('Approvals with nothing to answer: no session shown, no consent verb, or nothing waiting — each said', async () => {
  bind.resetHolds()
  const none = rec.approvalsBinding({gateway: {}, session: null, encounter: null, holds: bind.chainHolds()}, null, {})
  assert.equal(none.values.queue, undefined, 'no session shown: the queue is not read')
  assert.match(none.standing.allowOnce.disabled, /No session is shown/)
  await assert.rejects(() => none.write([{key: 'approvals', value: 'ask'}]), /Gateway is not drawn on its owner/)
  const refused = rec.approvalsBinding({gateway: {}, session: SESSION, encounter: encounter([CONSENT], [{...PERMIT, enabled: false, reason: 'There is no active provider turn'}]), holds: bind.chainHolds()}, null, {permission: async () => assert.fail('not sent')})
  assert.equal(refused.standing.deny.disabled, 'There is no active provider turn', 'the encounter\'s own reason')
  await assert.rejects(() => refused.write([{key: 'deny', value: 'req-7'}]), /no active provider turn/)
  const empty = rec.approvalsValues({gateway: {}, session: SESSION, encounter: encounter([]), holds: bind.chainHolds()})
  assert.deepEqual([empty.queue, empty.light], ['[]', 'dark'], 'nothing waits: an empty queue, read')
  const standing = rec.approvalsBinding({gateway: {}, session: SESSION, encounter: encounter([]), holds: bind.chainHolds()}, {standing: {approvals: {disabled: 'the row is not adopted'}}}, {}).standing
  assert.equal(standing.approvals.disabled, 'the row is not adopted', 'the Gateway\'s standing for the shared key')
})

test('the two designs draw on their bindings in all five views — no NaN, no undefined, never their fixtures — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const cases = [
    [ledgerDesign, rec.ledgerBinding({ground: ground([AGENT, NATIVE]), groundError: null, holds: bind.chainHolds()}, {openSession: () => null}), /re-plan port|Cairn|review #482|fixtures\/handoff/, []],
    [approvalsDesign, rec.approvalsBinding({gateway: {approvals: 'ask'}, session: SESSION, encounter: encounter([CONSENT]), holds: bind.chainHolds()}, null, {}),
      /setModel|Kite|recursive delete/, [rec.APPROVALS_REFUSE.wait]],
  ]
  for (const [design, binding, fixture, reasons] of cases) {
    const drawn = hosted(design, binding)
    drawn.forEach((markup, index) => {
      assert.match(markup, new RegExp(`data-device-view="${views[index]}"`), `${design.id} ${views[index]} draws`)
      assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${views[index]}: no absent key drawn as text`)
      assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${views[index]}: its own view drew`)
      assert.doesNotMatch(markup, fixture, `${design.id} ${views[index]}: its fixture never stands in`)
    })
    const all = drawn.join('\n')
    for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: a refused control says why (${why})`)
  }
  assert.ok(hosted(approvalsDesign, cases[1][1]).join('\n').includes('rm -rf dist'), 'the queue draws the session\'s real request')
  host.resetHost()
})

test('the rail\'s Ledger and Approvals are their devices\' own widgets (§23.9, §23.10), the rail\'s own way; the chain stands Approvals on the Main track, the Ledger on none', () => {
  for (const [widgetId, deviceId, design] of [['ledger', rec.LEDGER_ID, ledgerDesign], ['approvals', rec.APPROVALS_ID, approvalsDesign]]) {
    const registered = {id: widgetId, name: widgetId, mark: 'chain', Body: () => null}
    widgets.claimRailWidget(widgetId, deviceId)
    const claimed = widgets.claimedWidget(registered)
    assert.equal(claimed.bare, true)
    const device = rec.receiptDevices()[widgetId === 'ledger' ? 'ledger' : 'approvals']
    const binding = widgetId === 'ledger' ? rec.ledgerBinding({ground: ground([AGENT]), groundError: null, holds: bind.chainHolds()}, {openSession: () => null})
      : rec.approvalsBinding({gateway: {}, session: SESSION, encounter: encounter([CONSENT]), holds: bind.chainHolds()}, null, {})
    door.publishDevice(deviceId, {device, binding})
    try {
      const tile = renderToStaticMarkup(createElement(claimed.Body, {subject: null, pinned: false}))
      assert.match(tile, /data-device-size="widget"/)
      assert.match(tile, new RegExp(`data-device-design="${design.id}"|data-device-design="generic"`))
    } finally { door.publishDevice(deviceId, null) }
  }
  // The claims stand with the tiles' marks (agentDockTiles.ts), before any tile body loads; the bodies stay in AgentDockTileBody.tsx.
  const tiles = read('agent/agentDockTiles.ts') + read('agent/AgentDockTileBody.tsx')
  assert.match(tiles, /claimRailWidget\('ledger', LEDGER_ID\)/)
  assert.match(tiles, /claimRailWidget\('approvals', APPROVALS_ID\)/)
  assert.doesNotMatch(tiles, /Encounter task \(ledger basis\)|approval hooks/, 'the raw task-record receipts are gone (MOVED)')
  const view = read('agent/devices/FactoryDeviceChain.tsx')
  // REPLACED (lane W1-Factory; DLW §16.1, §19.13): the Ledger is a monitor — its tile on the rail and its Full in a pane, never on a chain;
  // it stays published for both. Approvals is an effect on the Main track (§19.14).
  assert.doesNotMatch(view, /placed\(LEDGER_ID/, 'the Ledger stands on no chain (§19.13 "Kind: monitor")')
  assert.match(read('agent/devices/AgentRailDevices.tsx'), /publish\(LEDGER_ID, ledger\)/, 'and stays published, for the rail and a pane, by the rail\'s publisher in every mode')
  assert.match(view, /case 'approvals': return placed\(APPROVALS_ID, receipts\.approvals, approvalsDesignBinding, [^\n]*'data-main-slot': 'approvals'/, 'Approvals on the Main track (§19.14)')
  assert.match(view, /approvalsBinding\(\{gateway: gatewayDesignBinding\?\.values \?\? \{\}, session: shownTrack/, 'the Gateway\'s values and the shown session')
  assert.match(read('agent/devices/AgentRailDevices.tsx'), /useCentralGroundAnswer\(transport\)/, 'the window\'s one ground answer')
  assert.doesNotMatch(read('agent/devices/receiptBindings.ts'), /\.defaults\[|\.fixtures|catalogue\/panels\//, 'the bindings read no design default or fixture')
})
