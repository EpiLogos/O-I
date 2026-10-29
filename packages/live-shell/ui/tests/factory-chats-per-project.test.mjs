import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

// DLW §19.1 "Projects and chats" (lane B, build list B3): Factory's browser lists the owner's projects and, under each, its chats —
// every session space the owner's discovery names for that project, newest first, each with its agent, its state and its last
// exchange as the owners report them. A chat is dropped on an empty track (it reopens through the owner's reconnect), dropped on
// the rail (its agent's tile opens with it), or double-clicked (its thread opens).
//
// Channels:
// - FIXTURE: real shapes captured read-only on 20 Oct 2026 — `aikit --json session-space discover --project O-I|Factory`
//   (tests/fixtures/factory-chats/discovery-*.json, the heavy project-context basis trimmed), `encounter view` and the first events of
//   `encounter read` for the same sessions (encounter-views.json, journal-heads.json), and the AIKit-history events as the kernel's
//   temporal projection gives them (temporal-events.json).
// - SCRIPTED: the real `readAgency`, `encounter` client and kernel bridge run over a counting fake `fetch`; every POST /op is recorded.
//   Nothing is written to any owner.
// - SSR: the rows as drawn, to static markup. Pointer drags and drops are not made here (UNVERIFIED on screen).
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
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const noop = () => {}
globalThis.document = {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const model = await import('../src/agent/factoryChatsModel.ts')
const reopen = await import('../src/agent/factoryChatsReopen.ts')
const rows = await import('../src/agent/FactoryChatsRows.tsx')
const {readAgency} = await import('../../../../desktop/cradle/src/agency/agencySources.ts')
const {StubWorkspaceProvider} = await import('../src/shell/workspaceContext.tsx')
const {AgentShellProvider} = await import('../src/agent/AgentShellContext.tsx')
const {AGENT_CHAIN_MIME, encodeChainDrag} = await import('../src/agent/agentChainDrag.ts')
const agentBrowser = await import('../src/agent/AgentShellBrowser.tsx')
const {ownerReadings} = await import('../src/owners/ownerReading.ts')
const {agencyReadingKey} = await import('../src/owners/agency.ts')

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/factory-chats/${name}.json`, import.meta.url), 'utf8'))
const DISCOVERY = {'O-I': fixture('discovery-O-I'), Factory: fixture('discovery-Factory')}
const VIEWS = fixture('encounter-views')
const HEADS = fixture('journal-heads')
const EVENTS = fixture('temporal-events')
const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

/** A counting fake bridge: every POST /op is recorded and answered by `answer(op)` (default: the fixtures, as the owners gave them). */
function bridge(url, answer) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (target, init) => {
    if (!String(target).startsWith(url)) return original(target, init)
    const op = JSON.parse(init.body)
    calls.push(op)
    return {json: async () => answer(op)}
  }
  return {calls, writes: () => calls.filter(op => op.op === 'encounter' && ['open', 'reconnect'].includes(op.request?.action)), restore: () => { globalThis.fetch = original }}
}
const ownersAnswer = op => {
  if (op.op === 'agency_read') return {ok: true, outcome: {result: 'agency_reading', project_ref: op.project, spaces: DISCOVERY[op.project] ?? [], observed_at_unix_ms: 1_792_500_000_000}}
  if (op.op === 'encounter') {
    const session = op.request.agent_session
    if (op.request.action === 'view') return VIEWS[session]?.data ? {ok: true, outcome: {result: 'encounter_reading', data: VIEWS[session].data}} : {ok: false, error: `no view fixture for ${session}`}
    if (op.request.action === 'read') return HEADS[session] ? {ok: true, outcome: {result: 'encounter_reading', data: HEADS[session]}} : {ok: true, outcome: {result: 'encounter_reading', data: {agent_session: session, events: [], next_cursor: 0, more: false}}}
    if (op.request.action === 'reconnect' || op.request.action === 'open') return {ok: true, outcome: {result: 'encounter_reading', data: {native_session_id: 'native-1'}}}
  }
  return {ok: false, error: `unexpected op ${op.op}`}
}
let nextUrl = 0
const withBridge = async (answer, body) => {
  const url = `http://bridge.test/factory-chats-${nextUrl++}`
  const stub = bridge(url, answer)
  try { return await body({kind: 'bridge', url}, stub) } finally { stub.restore() }
}
const readingOf = async (transport, project) => {
  const outcome = await readAgency(transport, project)
  assert.ok('reading' in outcome, `the ${project} discovery was read`)
  return outcome.reading
}
const answered = value => ({status: 'answered', value, error: null})

const S_GUARDIAN = 'session-space/development-entry-factory-guardian-20261008'
const S_CHAT_NEW = 'session-space/o-i-chat-1791392815-b898'
const S_CHAT_OLD = 'session-space/o-i-chat-1790087010-4a70'
const S_FX = 'session-space/factory-expressions-20260926-201904'
const S_ACP = 'session-space/factory-acp-chat'

// ---- the rows: projects, then each project's chats newest first ----------------------------------------------------

test('a project\'s chats are every session its discovery names, newest first by the last change AIKit recorded for its space', async () => {
  await withBridge(ownersAnswer, async transport => {
    const chats = model.projectChatsOf('O-I', answered(await readingOf(transport, 'O-I')), EVENTS)
    assert.equal(chats.state, 'read')
    assert.deepEqual(chats.chats.map(chat => chat.spaceRef), [S_GUARDIAN, S_CHAT_NEW, S_FX, S_FX, S_CHAT_OLD],
      'newest first: the guardian (1791428384933), the new chat (1791392822542), the two Expressions sessions of one space (1790453944889), the old chat (1790087011127)')
    assert.equal(chats.chats.length, 5, 'one chat per attached session, not per space')
    assert.ok(chats.chats.every(chat => chat.project === 'O-I'))
    assert.deepEqual(chats.chats.filter(chat => chat.spaceRef === S_FX).map(chat => chat.sessionRef), ['agent-session/fx-aletheia-20260926-201904', 'agent-session/fx-anima-20260926-201904'],
      'two sessions of one space tie on the space\'s time and keep the owner\'s order')
  })
})

test('a chat the history does not date sorts after the dated ones, in the owner\'s order, and says why it has no time', async () => {
  await withBridge(ownersAnswer, async transport => {
    const undated = EVENTS.filter(event => event.subject_ref !== S_CHAT_NEW)
    const chats = model.projectChatsOf('O-I', answered(await readingOf(transport, 'O-I')), undated)
    assert.deepEqual(chats.chats.map(chat => chat.spaceRef), [S_GUARDIAN, S_FX, S_FX, S_CHAT_OLD, S_CHAT_NEW])
    const words = model.chatWords(chats.chats.at(-1), {glance: null, activityUnixMs: model.lastActivityOf(chats.chats.at(-1), undated), roster: new Map()})
    assert.ok('absent' in words.when && /temporal|history/i.test(words.when.absent), `no time is said with its reason: ${JSON.stringify(words.when)}`)
  })
})

test('a space that belongs to two projects stands under both, with the same space and session', async () => {
  await withBridge(ownersAnswer, async transport => {
    const oi = model.projectChatsOf('O-I', answered(await readingOf(transport, 'O-I')), EVENTS)
    const factory = model.projectChatsOf('Factory', answered(await readingOf(transport, 'Factory')), EVENTS)
    assert.deepEqual(factory.chats.map(chat => chat.spaceRef), [S_GUARDIAN, S_ACP], 'Factory: the guardian (newest), then the ACP chat')
    const underOi = oi.chats.find(chat => chat.spaceRef === S_GUARDIAN), underFactory = factory.chats.find(chat => chat.spaceRef === S_GUARDIAN)
    assert.equal(underOi.sessionRef, underFactory.sessionRef)
    assert.deepEqual([underOi.project, underFactory.project], ['O-I', 'Factory'], 'each row knows the project it stands under')
    assert.deepEqual([...underOi.projects], ['Factory', 'O-I'], 'and every project the space belongs to, as the owner lists them')
    assert.notEqual(model.chatKey(underOi), model.chatKey(underFactory), 'the two rows are two rows')
    assert.equal(model.chatTrackKey(underOi), model.chatTrackKey(underFactory), 'but one track key: it is one session')
  })
})

test('the projects are the owner\'s list of worlds: yours is no project, and no project is named in the source', () => {
  const read = {state: 'read', worlds: [
    {ref: 'central:wiki:root', name: 'Your world', kind: 'yours', folder: 'Control/user/flows', project: null},
    {ref: 'central:wiki:project:Factory', name: 'Factory', kind: 'project', folder: 'Work/Factory/ProjectCentral/user', project: 'Factory'},
    {ref: 'central:wiki:project:O-I', name: 'O-I', kind: 'project', folder: 'Work/O-I/ProjectCentral/user', project: 'O-I'},
  ]}
  assert.deepEqual(model.projectsOfWorlds(read), {state: 'read', projects: ['Factory', 'O-I']}, 'in the disclosure\'s order')
  assert.deepEqual(model.projectsOfWorlds({state: 'unavailable', reason: 'Central did not disclose its worlds'}), {state: 'unavailable', words: 'Central did not disclose its worlds'})
  assert.deepEqual(model.projectsOfWorlds({state: 'reading'}), {state: 'reading'})
  for (const file of ['agent/factoryChatsModel.ts', 'agent/factoryChatsReopen.ts', 'agent/FactoryChatsRows.tsx'])
    assert.doesNotMatch(source(file), /'(O-I|Factory|Central|ai-kit|Workcell|Actuation)'/, `${file} names no project: the list is Central's`)
})

test('a project\'s chats are read when its row is opened: a closed project holds no reading at all, an opened one holds its own', async () => {
  await withBridge(ownersAnswer, async (transport, stub) => {
    const render = open => renderToStaticMarkup(createElement(StubWorkspaceProvider, {transport}, createElement(AgentShellProvider, null,
      createElement(rows.ProjectRow, {project: 'Factory', open, onToggle: noop, needle: ''}))))
    const held = () => ownerReadings.entries().some(entry => entry.key === agencyReadingKey(transport, 'Factory'))
    const closed = render(false)
    assert.match(closed, /aria-expanded="false"/)
    assert.match(closed, />Factory</)
    assert.doesNotMatch(closed, /Reading the chats of Factory|aria-label="Chats of Factory"/, 'a closed project draws no chats')
    assert.equal(held(), false, 'and asks for no agency reading')
    assert.deepEqual(stub.calls, [], 'nothing reached the kernel')
    const open = render(true)
    assert.match(open, /aria-expanded="true"/)
    assert.match(open, /Reading the chats of Factory/, 'an opened project reads its chats')
    assert.equal(held(), true, 'through the window\'s one agency reading for that project')
  })
})

test('an opened project draws the window\'s standing answer at once — its chats, or the owner\'s words — and asks the kernel nothing to do it', async () => {
  const {agencyEntry} = await import('../src/owners/agency.ts')
  const {useSpineEpoch} = await import('../src/owners/spine.ts')
  await withBridge(op => op.op === 'agency_read' && op.project === 'Central' ? {ok: false, error: 'AIKit SessionSpace is unavailable: no aikit'} : ownersAnswer(op), async (transport, stub) => {
    let epoch = null
    renderToStaticMarkup(createElement(StubWorkspaceProvider, {transport}, createElement(() => { epoch = useSpineEpoch(); return null })))
    await agencyEntry(transport, 'Factory').ensure(epoch)
    await agencyEntry(transport, 'Central').ensure(epoch)
    const asked = stub.calls.length
    const render = project => renderToStaticMarkup(createElement(StubWorkspaceProvider, {transport}, createElement(AgentShellProvider, null,
      createElement(rows.ProjectRow, {project, open: true, onToggle: noop, needle: ''}))))
    const factory = render('Factory')
    assert.equal((factory.match(/data-chat="/g) ?? []).length, 2, 'the standing answer is drawn with the first render, not after a read')
    assert.doesNotMatch(factory, /Reading the chats/)
    const central = render('Central')
    assert.match(central, /AIKit SessionSpace is unavailable: no aikit/, 'a standing refusal is drawn in the owner\'s words')
    assert.equal(stub.calls.length, asked, 'drawing them asked the kernel nothing')
  })
})

// ---- what a chat shows: its agent, its state, its last exchange, as the owners report them --------------------------

test('the last exchange is the last thing you said and what came back, from the owner\'s encounter view', () => {
  const glance = id => model.glanceOfView(VIEWS[id].data)
  const yo = glance('agent-session/o-i-chat-1790087010-4a70')
  assert.equal(yo.state, 'Disconnected')
  assert.equal(yo.provider, null, 'a disconnected session names no provider')
  assert.equal(yo.exchange.you, 'yo')
  assert.match(yo.exchange.reply, /^Yo\. I'm here, standing in O-I\./)
  assert.equal(yo.exchange.failed, null)
  const failed = glance('agent-session/o-i-chat-1791392815-b898')
  assert.equal(failed.state, 'Resident')
  assert.equal(failed.provider, 'Pi', 'a resident session names the provider the owner connected')
  assert.match(failed.exchange.you, /^In two sentences: which passage am I reading/)
  assert.equal(failed.exchange.reply, null)
  assert.match(failed.exchange.failed, /Weekly\/Monthly Limit Exhausted/, 'the provider\'s failure is what came back, in its own words')
  const agentOnly = glance('agent-session/fx-anima-20260926-201904')
  assert.equal(agentOnly.exchange.you, null, 'a session whose last words are the agent\'s has no "you"')
  assert.match(agentOnly.exchange.reply, /^Passage 2 confirmed/)
  const empty = glance('agent-session/development-entry-factory-guardian-20261008')
  assert.equal(empty.state, 'Released')
  assert.equal(empty.exchange, null, 'no block, no exchange')
})

test('a chat\'s words say what the owners reported and, for each thing they did not, the reading that would carry it', async () => {
  await withBridge(ownersAnswer, async transport => {
    const chats = model.projectChatsOf('O-I', answered(await readingOf(transport, 'O-I')), EVENTS).chats
    const old = chats.find(chat => chat.spaceRef === S_CHAT_OLD)
    const words = model.chatWords(old, {glance: model.glanceOfView(VIEWS[old.sessionRef].data), activityUnixMs: model.lastActivityOf(old, EVENTS), roster: new Map()})
    assert.equal(words.label, 'Desktop chat conversation', 'the session\'s purpose is its name')
    assert.ok('absent' in words.agent, 'the discovery\'s attachment names no agent_ref')
    assert.match(words.agent.absent, /agent_ref/)
    assert.match(words.agent.absent, /encounter-agency-read/, 'and says which reading carries the binding\'s agent')
    assert.deepEqual(words.state, {said: 'disconnected'})
    assert.match(words.exchange.said, /yo/)
    assert.match(words.exchange.said, /Yo\. I'm here/)
    assert.deepEqual(words.when, {said: '2026-09-22 14:23Z'}, 'the last change AIKit recorded for its space, in UTC')
    assert.match(words.hover, /disconnected/)
    const unread = model.chatWords(old, {glance: null, activityUnixMs: null, roster: new Map()})
    assert.ok('absent' in unread.state && /encounter view/.test(unread.state.absent), 'an unread view says which reading would carry the state')
    assert.ok('absent' in unread.exchange && /encounter view/.test(unread.exchange.absent))
    const refused = model.chatWords(old, {glance: null, glanceRefused: 'Encounter is not attached to this native Project\'s SessionSpaces', activityUnixMs: null, roster: new Map()})
    assert.match(refused.state.absent, /Encounter is not attached to this native Project's SessionSpaces/, 'a refused view is said in the owner\'s words')
  })
})

test('an agent the discovery names is the roster\'s name for it, else its ref', async () => {
  await withBridge(ownersAnswer, async transport => {
    const reading = await readingOf(transport, 'O-I')
    const named = {...reading, rows: reading.rows.map(row => row.spaceRef === S_CHAT_OLD ? {...row, agentRef: 'agent:fizz'} : row)}
    const chat = model.chatsOfAgency('O-I', named).find(item => item.spaceRef === S_CHAT_OLD)
    assert.equal(chat.agentRef, 'agent:fizz')
    assert.deepEqual(model.chatWords(chat, {glance: null, activityUnixMs: null, roster: new Map([['agent:fizz', {name: 'Fizz'}]])}).agent, {said: 'Fizz'})
    assert.deepEqual(model.chatWords(chat, {glance: null, activityUnixMs: null, roster: new Map()}).agent, {said: 'agent:fizz'})
  })
})

// ---- a refused discovery says the owner's words ----------------------------------------------------------------------

test('a refused discovery shows the owner\'s words, not an empty list', async () => {
  const owner = 'AIKit SessionSpace is unavailable: spawn aikit ENOENT'
  await withBridge(op => op.op === 'agency_read' ? {ok: false, error: owner} : ownersAnswer(op), async transport => {
    const outcome = await readAgency(transport, 'Factory')
    assert.deepEqual(outcome, {error: owner}, 'the real reading carries the kernel\'s words')
    const refused = model.projectChatsOf('Factory', {status: 'refused', value: null, error: outcome.error}, EVENTS)
    assert.equal(refused.state, 'refused')
    assert.ok(refused.words.includes(owner), 'the owner\'s words are in the line, verbatim')
    assert.match(refused.words, /Factory/, 'and the project it was asked for')
    const markup = renderToStaticMarkup(createElement(rows.ProjectChats, {project: 'Factory', chats: refused, glances: new Map(), roster: new Map(), events: EVENTS, needle: '', ports: {}}))
    assert.ok(markup.includes(owner), 'the rows draw them')
    assert.match(markup, /role="alert"/)
    assert.doesNotMatch(markup, /data-chat=/, 'and no chat')
  })
})

test('the rows as drawn: each chat is a draggable card with its name, its agent, its state and its last exchange', async () => {
  await withBridge(ownersAnswer, async transport => {
    const chats = model.projectChatsOf('O-I', answered(await readingOf(transport, 'O-I')), EVENTS)
    const glances = new Map(chats.chats.filter(chat => VIEWS[chat.sessionRef]?.data).map(chat => [model.chatKey(chat), {status: 'answered', glance: model.glanceOfView(VIEWS[chat.sessionRef].data)}]))
    const markup = renderToStaticMarkup(createElement(rows.ProjectChats, {project: 'O-I', chats, glances, roster: new Map(), events: EVENTS, needle: '', ports: {}}))
    assert.equal((markup.match(/data-chat="/g) ?? []).length, 5, 'a card per chat')
    assert.equal((markup.match(/draggable="true"/g) ?? []).length, 5, 'every chat can be picked up')
    assert.match(markup, /Desktop chat conversation/)
    assert.match(markup, /disconnected/)
    assert.match(markup, /Yo\. I&#x27;m here|Yo\. I'm here/, 'the last exchange is on the card')
    assert.match(markup, /data-absent="agent"/, 'an agent the discovery does not name is marked absent, its reason in the hover')
    assert.ok(markup.indexOf('Factory280') < markup.indexOf('Desktop chat conversation'), 'newest first on the page, too')
  })
})

// ---- the drop on an empty track ---------------------------------------------------------------------------------------

const chatOfAll = async project => {
  const url = `http://bridge.test/factory-chats-all-${nextUrl++}`
  const stub = bridge(url, ownersAnswer)
  try { return model.chatsOfAgency(project, await readingOf({kind: 'bridge', url}, project)) } finally { stub.restore() }
}
/** The chat as the real reading builds it (readAgency's own rows over the captured discovery). */
const chatOf = async (project, spaceRef) => {
  const url = `http://bridge.test/factory-chats-of-${nextUrl++}`
  const stub = bridge(url, ownersAnswer)
  try { return model.chatsOfAgency(project, await readingOf({kind: 'bridge', url}, project)).find(chat => chat.spaceRef === spaceRef) } finally { stub.restore() }
}

test('the provider is the one the owner recorded for that session, not one the face remembers', async () => {
  await withBridge(ownersAnswer, async (transport, stub) => {
    const anima = (await chatOfAll('O-I')).find(chat => chat.sessionRef === 'agent-session/fx-anima-20260926-201904')
    const receipt = await reopen.dropChatOnTrack(model.encodeChatDrag(anima), {transport, trackIds: []})
    assert.equal(receipt.ok, true, JSON.stringify(receipt))
    assert.equal(stub.writes()[0].request.provider, 'factory-expressions-pi')
    assert.equal(stub.writes()[0].request.space, S_FX)
  })
})

test('dropped on an empty track, a disconnected chat reopens through the owner\'s reconnect with its space and its recorded provider', async () => {
  await withBridge(ownersAnswer, async (transport, stub) => {
    const chat = await chatOf('O-I', S_CHAT_OLD)
    const receipt = await reopen.dropChatOnTrack(model.encodeChatDrag(chat), {transport, trackIds: [model.chatTrackKey(chat)]})
    assert.equal(receipt.ok, true, JSON.stringify(receipt))
    const writes = stub.writes()
    assert.equal(writes.length, 1, 'one owner write')
    assert.deepEqual(writes[0], {op: 'encounter', project: 'O-I', request: {action: 'reconnect', space: S_CHAT_OLD, agent_session: 'agent-session/o-i-chat-1790087010-4a70', provider: 'pi'}},
      'the space\'s id, the session, and the provider the owner recorded in its journal\'s binding')
    assert.deepEqual(stub.calls.filter(op => op !== writes[0]).map(op => op.request.action).sort(), ['read', 'view'], 'the rest is reading: the view, then the journal\'s first events')
    assert.match(receipt.note, /Desktop chat conversation/)
    assert.match(receipt.note, /track/, 'it says the chat stands on a track of the set')
  })
})

test('a chat the owner already holds open is not reopened: no write is sent', async () => {
  await withBridge(ownersAnswer, async (transport, stub) => {
    const chat = await chatOf('O-I', S_CHAT_NEW)
    const receipt = await reopen.dropChatOnTrack(model.encodeChatDrag(chat), {transport, trackIds: []})
    assert.equal(receipt.ok, true)
    assert.match(receipt.note, /already open/i)
    assert.equal(stub.writes().length, 0)
  })
})

test('the owner\'s refusal of the reconnect comes back in its own words, as a refusal', async () => {
  const owner = 'encounter.recorded_basis_contradicts: provider pi no longer matches the recorded command'
  await withBridge(op => op.op === 'encounter' && op.request.action === 'reconnect' ? {ok: false, error: owner} : ownersAnswer(op), async transport => {
    const chat = await chatOf('O-I', S_CHAT_OLD)
    const receipt = await reopen.dropChatOnTrack(model.encodeChatDrag(chat), {transport, trackIds: []})
    assert.equal(receipt.ok, false)
    assert.ok(receipt.error.includes(owner))
  })
})

test('a chat whose journal records no binding is refused in words and nothing is written', async () => {
  await withBridge(ownersAnswer, async (transport, stub) => {
    const chat = await chatOf('Factory', S_ACP)
    const receipt = await reopen.dropChatOnTrack(model.encodeChatDrag(chat), {transport, trackIds: []})
    assert.equal(receipt.ok, false)
    assert.match(receipt.error, /binding/)
    assert.match(receipt.error, /Owner-commissioned live ACP chat proof/, 'it names the chat')
    assert.equal(stub.writes().length, 0)
  })
})

test('a drop with no op to carry it is refused in words naming the op, and sends nothing', async () => {
  await withBridge(ownersAnswer, async (transport, stub) => {
    const chat = await chatOf('O-I', S_CHAT_OLD)
    const none = await reopen.dropChatOnTrack(model.encodeChatDrag(chat), {transport: {kind: 'unavailable', reason: 'The shell has published no kernel carrier for this reading.'}, trackIds: []})
    assert.equal(none.ok, false)
    assert.match(none.error, /encounter reconnect/, 'the missing op is named')
    assert.match(none.error, /no kernel carrier/, 'with the carrier\'s own reason')
    const malformed = await reopen.dropChatOnTrack('{"not":"a chat"}', {transport, trackIds: []})
    assert.equal(malformed.ok, false)
    assert.match(malformed.error, /chat/)
    const bytes = await reopen.dropChatOnTrack('not json', {transport, trackIds: []})
    assert.equal(bytes.ok, false)
    assert.deepEqual(stub.calls, [], 'no op reached the kernel for any of them')
  })
})

test('the empty track still seats an agent as it did: a chat is told apart by its payload, anything else goes to the seat it replaces', async () => {
  await withBridge(ownersAnswer, async (transport, stub) => {
    const seated = []
    const original = {op: 'harness_agent_control:new', accepts: AGENT_CHAIN_MIME, run: payload => { seated.push(payload); return Promise.resolve({ok: true, note: 'started'}) }}
    const set = {columns: [], tracks: [], clips: [], actions: {grain: 'whole harness', seat: original}}
    const wrapped = reopen.withChatSeat(set, {transport})
    assert.equal(wrapped.actions.seat.accepts, AGENT_CHAIN_MIME, 'the grid still accepts the one drag type')
    assert.equal(wrapped.actions.grain, 'whole harness', 'the rest of the actions stand')
    assert.match(wrapped.actions.seat.op, /encounter reconnect/, 'the op it names for a chat')
    assert.match(wrapped.actions.seat.op, /harness_agent_control:new/, 'and the op it keeps for an agent')
    const agent = encodeChainDrag({family: 'agent', ref: 'agent:fizz', label: 'Fizz'})
    assert.deepEqual(await wrapped.actions.seat.run(agent), {ok: true, note: 'started'})
    assert.deepEqual(seated, [agent])
    assert.deepEqual(stub.calls, [], 'an agent drop sends nothing of ours')
    const chat = await chatOf('O-I', S_CHAT_OLD)
    const receipt = await wrapped.actions.seat.run(model.encodeChatDrag(chat))
    assert.equal(receipt.ok, true)
    assert.equal(seated.length, 1, 'a chat never reaches the agent seat')
    assert.equal(stub.writes().length, 1)
    // A set that carries no seat (no harness binding): a chat can still be reopened, an agent is refused in words.
    const bare = reopen.withChatSeat({columns: [], tracks: [], clips: []}, {transport})
    assert.equal(bare.actions.seat.accepts, AGENT_CHAIN_MIME)
    const refused = await bare.actions.seat.run(agent)
    assert.equal(refused.ok, false)
    assert.match(refused.error, /harness/)
    // No carrier at all: the seat says so and sends nothing.
    const before = stub.calls.length
    const unreached = reopen.withChatSeat(set, {transport: {kind: 'unavailable', reason: 'no carrier'}})
    assert.equal((await unreached.actions.seat.run(model.encodeChatDrag(chat))).ok, false)
    assert.equal(stub.calls.length, before)
  })
})

// ---- the drop on the rail ----------------------------------------------------------------------------------------------

test('dropped on the rail, a chat reopens and its agent\'s tile opens holding it', async () => {
  await withBridge(ownersAnswer, async (transport, stub) => {
    const chat = await chatOf('O-I', S_CHAT_OLD)
    const said = []
    const rail = {isOpen: id => { said.push(['isOpen', id]); return false }, toggle: id => said.push(['toggle', id]), pin: (id, ref) => said.push(['pin', id, ref])}
    const receipt = await reopen.dropChatOnRail(model.encodeChatDrag(chat), {transport, rail, trackIds: [model.chatTrackKey(chat)]})
    assert.equal(receipt.ok, true, JSON.stringify(receipt))
    assert.equal(stub.writes().length, 1)
    assert.deepEqual(said, [['isOpen', 'agent'], ['toggle', 'agent'], ['pin', 'agent', model.chatTrackKey(chat)]], 'the agent tile opens, then holds this chat')
    const open = []
    const again = await reopen.dropChatOnRail(model.encodeChatDrag(chat), {transport, rail: {isOpen: () => true, toggle: id => open.push(id), pin: () => {}}, trackIds: []})
    assert.equal(again.ok, true)
    assert.deepEqual(open, [], 'an open tile is not toggled shut')
  })
})

test('a refused reopen leaves the rail alone, and a rail with no op sends nothing', async () => {
  await withBridge(op => op.op === 'encounter' && op.request.action === 'reconnect' ? {ok: false, error: 'owner says no'} : ownersAnswer(op), async (transport, stub) => {
    const chat = await chatOf('O-I', S_CHAT_OLD)
    const said = []
    const receipt = await reopen.dropChatOnRail(model.encodeChatDrag(chat), {transport, rail: {isOpen: () => false, toggle: id => said.push(id), pin: id => said.push(id)}, trackIds: []})
    assert.equal(receipt.ok, false)
    assert.deepEqual(said, [], 'the tile is not opened for a chat that did not reopen')
    const before = stub.calls.length
    const none = await reopen.dropChatOnRail(model.encodeChatDrag(chat), {transport: {kind: 'unavailable', reason: 'no carrier'}, rail: {isOpen: () => false, toggle: noop, pin: noop}, trackIds: []})
    assert.equal(none.ok, false)
    assert.match(none.error, /encounter reconnect/)
    assert.equal(stub.calls.length, before)
  })
})

test('the rail takes a chat in hand and nothing else: the handlers carry the gesture to the act', async () => {
  const railModule = await import('../src/agent/factoryChatsRail.tsx')
  await withBridge(ownersAnswer, async (transport, stub) => {
    const chat = await chatOf('O-I', S_CHAT_OLD)
    const toggled = [], pinned = [], told = []
    const handlers = railModule.chatRailHandlers({transport, trackIds: [], said: receipt => told.push(receipt),
      rail: {isOpen: () => false, toggle: id => toggled.push(id), pin: (id, ref) => pinned.push([id, ref])}})
    const event = (payload, types = [AGENT_CHAIN_MIME]) => {
      const seen = {prevented: false, effect: null}
      return {seen, event: {dataTransfer: {types, getData: type => (type === AGENT_CHAIN_MIME ? payload : ''), set dropEffect(value) { seen.effect = value }}, preventDefault: () => { seen.prevented = true }}}
    }
    // Nothing in hand (an agent's drag, or a chat from another window): not droppable, not taken.
    const over = event(model.encodeChatDrag(chat))
    handlers.onDragOver(over.event)
    assert.equal(over.seen.prevented, false, 'with no chat in hand the rail does not look droppable')
    model.setActiveChatDrag(chat)
    handlers.onDragOver(over.event)
    assert.equal(over.seen.prevented, true)
    assert.equal(over.seen.effect, 'copy')
    const other = event('x', ['text/plain'])
    handlers.onDragOver(other.event)
    assert.equal(other.seen.prevented, false, 'other drag types are left alone')
    // An agent dropped here is not a chat: nothing is sent, nothing opens.
    const agent = event(encodeChainDrag({family: 'agent', ref: 'agent:fizz', label: 'Fizz'}))
    handlers.onDrop(agent.event)
    assert.equal(agent.seen.prevented, false)
    assert.deepEqual([stub.calls.length, toggled, pinned, told], [0, [], [], []])
    // The chat dropped: the owner reopens it, the tile opens holding it, the receipt is said, the gesture's hold is released.
    const drop = event(model.encodeChatDrag(chat))
    handlers.onDrop(drop.event)
    assert.equal(drop.seen.prevented, true)
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(stub.writes().length, 1)
    assert.deepEqual(toggled, ['agent'])
    assert.deepEqual(pinned, [['agent', model.chatTrackKey(chat)]])
    assert.equal(told.length, 1)
    assert.equal(told[0].ok, true)
    assert.equal(model.activeChatDrag(), null, 'the hold ends with the drop')
  })
})

// ---- the double-click --------------------------------------------------------------------------------------------------

test('a double-click opens the chat\'s thread where the shell has the session; elsewhere it says what the thread reads', async () => {
  const oi = await chatOf('O-I', S_CHAT_OLD), acp = await chatOf('Factory', S_ACP)
  const tracks = new Set([model.chatTrackKey(oi)])
  assert.deepEqual(model.threadOpening(oi, tracks, true), {kind: 'open', trackKey: model.chatTrackKey(oi), label: 'Desktop chat conversation', pane: true})
  // REPLACED (#788): "without a Thread device on the chain the thread opens in the shell's thread view". The Thread is no device of its own
  // (#725, #772): it is the Agent's Thread page and the Agent's Full (§19.4 Views, Full: "The thread, and beside it the stage"), so the pane
  // opens with the Agent on the chain.
  assert.equal(model.threadOpening(oi, tracks, false).pane, false, 'without the Agent on the chain the thread opens in the shell\'s thread view')
  const refused = model.threadOpening(acp, tracks, true)
  assert.equal(refused.kind, 'refused')
  assert.match(refused.words, /Factory/)
  // REPLACED (O-I #740 lane B): the words named the one project the shell mounted (O-I); the shell mounts the world's sessions now, every register's.
  assert.match(refused.words, /your world \(its root register and each project Central discloses\)/, 'the thread reads the world\'s agency')
  assert.equal(model.threadOpening(oi, null, true).kind, 'refused', 'no sessions provider, no thread')
})

test('REPLACED (#788) — a chat\'s thread opens full in a pane as the Agent\'s Full, never as a Thread device (§19.4 Views)', () => {
  // Was: the rows asked whether THREAD_DEVICE_ID stood on the door and opened it in a pane. Nothing publishes it (#725, #772): the Agent
  // carries the Thread as its page and its Full (FactoryDeviceChain.tsx openAgentThread), so the rows ask for the Agent and open it.
  const rows = source('agent/FactoryChatsRows.tsx')
  assert.doesNotMatch(rows, /THREAD_DEVICE_ID|threadBinding/, 'no retired Thread device read or opened')
  assert.match(rows, /const AGENT_ID = chainDeviceId\('agent'\)/, 'the Agent on the session\'s chain')
  assert.match(rows, /const agentOnChain = useIsPublished\(AGENT_ID\)/)
  assert.match(rows, /openInstrument\(DEVICE_PANE_KIND, undefined, \{ref: AGENT_ID, title: opening\.label\}\)/, 'its Full, the thread, in a pane')
  assert.match(source('agent/devices/FactoryDeviceChain.tsx'), /const openAgentThread = \(\) => openDevice\(chainDeviceId\('agent'\), 'Agent'\)/,
    'the same door the chain\'s own ⤢ opens')
})

// ---- the category stands in Factory's browser ----------------------------------------------------------------------------

test('Factory\'s browser has a Projects category of material, and the existing categories keep their kinds', () => {
  const projects = agentBrowser.AGENT_BROWSER_CATEGORIES.find(category => category.id === 'projects')
  assert.ok(projects, 'a Projects category')
  assert.equal(projects.label, 'Projects')
  assert.equal(projects.kind, 'material', 'chats are opened, not run: the running kind stays sessions and agents')
  assert.deepEqual(agentBrowser.AGENT_BROWSER_CATEGORIES.filter(category => category.kind === 'running').map(category => category.id), ['sess', 'agents'])
  // REPLACED (#788): the Runs category is gone with the retired Run and Runs; a session's attempts are its track's take lanes (§19.1).
  assert.deepEqual(agentBrowser.AGENT_BROWSER_CATEGORIES.map(category => category.id), ['sess', 'context', 'agents', 'skillsets', 'git', 'projects'])
  const body = source('agent/AgentShellBrowser.tsx')
  assert.match(body, /category === 'projects'/)
  assert.match(body, /FactoryChatsRows/)
  assert.doesNotMatch(body, /op: 'agency_read'|op: 'encounter'/, 'the browser reads the shared owner answers, never an op itself')
})

test('Projects renders its rows inside the browser body, projects first, none read', () => {
  const markup = renderToStaticMarkup(createElement(StubWorkspaceProvider, {transport: {kind: 'unavailable', reason: 'test'}}, createElement(AgentShellProvider, null,
    createElement(agentBrowser.AgentShellBrowser, {rows: [], error: null, loading: false, controlled: {category: 'projects', query: '', previewHost: null}}))))
  assert.match(markup, /data-factory-projects/)
  assert.match(markup, /kernel|carrier|test/i, 'with no carrier the projects say why they are not listed')
})
