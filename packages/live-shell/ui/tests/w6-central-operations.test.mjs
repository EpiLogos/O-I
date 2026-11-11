// W6, the Central owner operations that did not exist, bound in the shell (T-COVERAGE §1.5, the Central row):
//   1. Notifications' requests and provider: the requests Central keeps for personal.notify (personal.notifications.list,
//      central.notification-ledger/v1: ctrl/src/notification.rs, EpiLogos/Central#288), and a request's Open. Since the 22 Oct manual rewrite
//      (#725) they wait in Approvals, under Requests (§23.9): Approvals carries them (railBindings.ts withOwnerRequests);
//   2. Open and Reveal of a page's file or a world's folder through work.open / work.reveal by Central-relative path (EpiLogos/Central#289);
//      the track and clip menus that call them are frame/menu's (PROPOSE in the lane's return).
// Channels: SCRIPTED (the catalogue design rendered to static markup through the runtime's host; the pure bindings over documents shaped as
// Central answers them; a kernel behind the bridge's fetch that records every op; a recording hand for every press). No owner state is
// written and nothing is opened. Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
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

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const host = await import('../src/frame/devices/deviceHost.tsx')
const rail = await import('../src/widgets/railBindings.ts')
// REPLACED (#725): the Notifications design (widgets__notifications.tsx) was retired into Approvals (§23.9 "What an owner or an agent raises
// for you to decide … waits in Approvals, under Requests"): its readings are drawn by the Approvals design on Approvals' binding.
const {design} = await import('../src/inhabitants/catalogue/panels/software-factory__approvals.tsx')
const receipts = await import('../src/agent/devices/receiptBindings.ts')
const chainBind = await import('../src/agent/devices/designBindings.ts')

const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const viewsOf = design => design.views ?? ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (designed, binding) => viewsOf(designed).filter(view => view !== 'popout').map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))])
const designKeys = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]
/** Draw a design on a binding in all its views: no NaN, no undefined, its own view, never its fixture text; each reason drawn. */
function drawsOn(design, binding, fixture, reasons = []) {
  const drawn = hosted(design, binding)
  for (const [view, markup] of drawn) {
    assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view} draws`)
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}: its own view drew`)
    assert.doesNotMatch(markup, fixture, `${design.id} ${view}: its fixture never stands in`)
  }
  const all = drawn.map(([, markup]) => markup).join('\n')
  for (const why of reasons) assert.ok(all.includes(escaped(why)), `${design.id}: a refusal is drawn as why (${why.slice(0, 80)}…)`)
  return all
}

// A ledger as Central answers personal.notifications.list (shapes from ctrl/src/notification.rs; the CLI's answer on a scratch root).
const at = (h, m) => new Date(2026, 9, 21, h, m).getTime()
const LEDGER = {
  schema: 'central.notification-ledger/v1', unreadable_records: 0, notification_delivery_is_human_acknowledgement: false,
  provider: {provider: 'macos.applescript-notification-center', available: true, authorization: 'provider_managed', supports_callback: false,
    supports_urgency: false, supports_category: false, notes: ['Posting does not prove that the user saw it.']},
  provider_error: null,
  requests: [
    {schema: 'central.notification-record/v1', request_ref: 'central:notification:2-1', requested_at_unix_ms: at(9, 5),
      request: {title: 'Routine kept red', body: 'Two checks failed.', subject_ref: 'factory:run:7', urgency: 'critical', category: 'routine',
        callback: 'https://github.com/EpiLogos/O-I/actions/runs/7', action_ref: null, caller_ref: 'routine:checks', provenance_refs: []},
      delivery: {state: 'posted', provider: 'macos.applescript-notification-center', subject_ref: 'factory:run:7', action_ref: null,
        caller_ref: 'routine:checks', human_acknowledgement_observed: false, unsupported_requested_features: ['urgency', 'category'], provenance_refs: []}},
    {schema: 'central.notification-record/v1', request_ref: 'central:notification:1-1', requested_at_unix_ms: at(8, 0),
      request: {title: '', body: 'Day close waits on Face 5.', subject_ref: null, urgency: null, category: null, callback: null, action_ref: null,
        caller_ref: 'central:day', provenance_refs: []},
      refusal: {status: 'unavailable_capability', message: 'No eligible Connector implements UserNotification.'}},
    {schema: 'something-else/v1', request_ref: 'x'},
  ],
}
const answered = {status: 'answered', value: LEDGER}
const NOW = at(10, 0)
const base = {messagesAgents: undefined, nowUnixMs: NOW}
/** Central's Approvals as its chain builds it with nothing else waiting (CentralDevices.tsx: no session shown, no return read), with the owners'
 * requests laid in; `kept` the view's opened items. */
const approvalsWith = (input, open, kept) => rail.withOwnerRequests(
  receipts.approvalsBinding({session: null, encounter: null, holds: chainBind.chainHolds()}, {}, 'central:main:approvals'), input, open, kept)
const queueOf = binding => JSON.parse(binding.values.queue)

test('a kept record is the design\'s request: its ref, the local clock time it came, its words, its caller, its callback as Open, and the provider\'s delivery or refusal', () => {
  const ledger = rail.notificationLedgerOf(LEDGER)
  assert.equal(ledger.requests.length, 2, 'a line that is no record is not a request')
  const [red, day] = ledger.requests
  assert.deepEqual({...red, delivery: JSON.parse(red.delivery)}, {id: 'central:notification:2-1', from: 'routine:checks', at: '09:05', time: 545,
    title: 'Routine kept red', body: 'Two checks failed.', subject: 'factory:run:7', urgency: 'critical', category: 'routine',
    open: 'https://github.com/EpiLogos/O-I/actions/runs/7',
    delivery: {state: 'posted', provider: 'macos.applescript-notification-center', unsupported: ['urgency', 'category']}})
  assert.deepEqual({...day, delivery: JSON.parse(day.delivery)}, {id: 'central:notification:1-1', from: 'central:day', at: '08:00', time: 480,
    body: 'Day close waits on Face 5.', delivery: {state: 'rejected'}}, 'an empty title and absent refs stay absent; a refusal is rejected')
  assert.deepEqual(ledger.provider, {provider: 'macos.applescript-notification-center', available: true, authorization: 'provider_managed',
    callback: false, urgency: false, category: false}, 'the provider\'s capabilities by the design\'s names')
  const none = rail.notificationLedgerOf({...LEDGER, provider: null, provider_error: 'No eligible Connector implements UserNotification.'})
  assert.equal(none.provider, null)
  assert.equal(none.providerError, 'No eligible Connector implements UserNotification.')
  assert.equal(rail.notificationLedgerOf({schema: 'central.now-listing/v1', requests: []}), null, 'another document is no ledger')
  assert.equal(rail.dayStartMs(at(9, 5)), at(0, 0), 'today starts at the local midnight')
})

// be2j ruling 2 (DLW build ruling 2026-11-09): a request's words are an agent's or another program's: the rail shows them plain
// (plainParts.ts plainText), so no bidi control reorders a row and nothing invisible stands in one; words with nothing visible left are
// none. Central keeps the record as it was asked.
test('a request\'s title and body are shown plain: no bidi control, control or invisible character; words with nothing visible left are none (be2j)', () => {
  const laced = structuredClone(LEDGER)
  laced.requests[0].request.title = 'Routine \u202ekept\u202c red\u200b'
  laced.requests[0].request.body = 'Two\u2066 checks\u2069\u0007failed.'
  laced.requests[1].request.title = '\u200b\u0007\u3164'
  const [red, day] = rail.notificationLedgerOf(laced).requests
  assert.deepEqual([red.title, red.body], ['Routine kept red', 'Two checks failed.'])
  assert.ok(!('title' in day), 'a title with nothing visible left is no title')
  assert.equal(laced.requests[0].request.title, 'Routine \u202ekept\u202c red\u200b', 'the record is read, never altered')
})

// be2k ruling 1 (DLW build ruling 2026-11-10): who asked and what a request is about are read where a person decides: the caller's ref and
// the subject or callback are shown plain, who on one line and where as a block (railBindings.ts ownerRequestsValues; the panel's queueOf
// for every kind). Open still opens the target the record keeps; where the shell has no hand for it, both of Open's paths say so with the
// target plain.
test('who asked and what a request is about are shown plain where a person decides; Open still opens the target the record keeps (be2k)', async () => {
  const laced = structuredClone(LEDGER)
  laced.requests[0].request.caller_ref = 'routine:\u202echecks\u200b'
  laced.requests[0].request.subject_ref = 'factory:\u2066run\u2069:7'
  const {rows} = rail.ownerRequestsValues({...base, ledger: {status: 'answered', value: laced}})
  const red = rows.find(row => row.id === 'central:notification:2-1')
  assert.deepEqual([red.who, red.where], ['routine:checks', 'factory:run:7'])
  assert.equal(red.open, 'https://github.com/EpiLogos/O-I/actions/runs/7', 'Open acts on the target the record keeps')
  // the queue as Approvals draws it, whoever filled it: who, what and where plain in every view
  const binding = approvalsWith(base, async () => {}, {opened: [], hold() {}})
  const queue = JSON.stringify([{id: 'q1', kind: 'request', who: 'Guar\u202edian\u200b', text: 'Run \u2066it\u2069', where: 'rm -rf ./x\u202e\nls', age: 5}])
  const drawn = hosted(design, {...binding, values: {...binding.values, queue}})
  for (const [view, markup] of drawn) assert.ok(!/[\u202a-\u202e\u2066-\u2069\u200b]/.test(markup), `${view}: nothing of the set is drawn`)
  assert.ok(drawn.some(([, markup]) => markup.includes('Guardian')), 'who is drawn, plain')
  const lacedOpen = structuredClone(LEDGER)
  lacedOpen.requests[0].request.callback = 'https://ci.test/\u202erun\u200b/7'
  const input = {...base, ledger: {status: 'answered', value: lacedOpen}}, noHand = /Open: the shell has no hand that opens https:\/\/ci\.test\/run\/7\.$/
  await assert.rejects(approvalsWith(input, undefined, {opened: [], hold() {}}).write([{key: 'open', value: 'central:notification:2-1'}]), noHand)
  const notices = rail.notificationsBinding('central:main:notifications', input, {}, {local: {}, messages() {}, approvals() {}})
  await assert.rejects(notices.write([{key: 'open', value: 'central:notification:2-1'}]), noHand)
})

test('Approvals draws the requests and the provider Central keeps, never its fixture; Open opens the request\'s target through the shell\'s hand and only then holds it opened', async () => {
  // REPLACED (#725): Notifications' own binding and drawing — retired into Approvals (§23.9); the requests are Approvals' queue rows of kind
  // request, the provider's availability its desktop notice, and Open its Open.
  const held = {}
  const opened = []
  const kept = () => ({opened: held.opened ?? [], hold: ids => { held.opened = ids }})
  const open = async target => { opened.push(target) }
  const binding = approvalsWith({...base, ledger: answered}, open, kept())
  const requests = queueOf(binding).filter(row => row.kind === 'request')
  assert.equal(requests.length, 2)
  assert.deepEqual(requests.map(row => [row.id, row.who, row.text, row.age]), [['central:notification:2-1', 'routine:checks', 'Routine kept red', 3300],
    ['central:notification:1-1', 'central:day', 'Day close waits on Face 5.', 7200]], 'each by its words (a request with no title by its body), its caller and how long it waited')
  assert.equal(requests[0].urgent, true, 'a critical request is urgent')
  assert.equal(binding.values.desktop, 'shown', 'the provider is available: your computer shows a notice')
  assert.equal(binding.waiting, undefined, 'nothing waits once the requests are read')
  const all = drawsOn(design, binding, /prop:setModel|setModel|Morning checks failed|Kev decision service down/)
  assert.match(all, /Routine kept red/)
  assert.match(all, /Day close waits on Face 5\./, 'a request with no title is drawn by its body')
  await binding.write([{key: 'open', value: 'central:notification:2-1'}])
  assert.deepEqual(opened, ['https://github.com/EpiLogos/O-I/actions/runs/7'])
  assert.deepEqual(held.opened, ['central:notification:2-1'])
  assert.equal(queueOf(approvalsWith({...base, ledger: answered}, open, kept())).find(row => row.id === 'central:notification:2-1').opened, true, 'held, it is drawn opened')
  // A request that names nothing to open, a ref Approvals does not hold, and a hand that refuses: each refuses in words, and nothing is held.
  delete held.opened
  await assert.rejects(approvalsWith({...base, ledger: answered}, open, kept()).write([{key: 'open', value: 'central:notification:1-1'}]), /names nothing to open/)
  await assert.rejects(approvalsWith({...base, ledger: answered}, open, kept()).write([{key: 'open', value: 'central:notification:9-9'}]), /no item central:notification:9-9 waits/)
  const refusing = approvalsWith({...base, ledger: answered}, async target => { throw new Error(`Open: no route in the shell opens ${target} yet`) }, kept())
  await assert.rejects(refusing.write([{key: 'open', value: 'central:notification:2-1'}]), /no route in the shell opens https:/)
  assert.equal(held.opened, undefined, 'a refused open is not held as opened')
})

test('before Central answers, the requests wait; where it refuses, Approvals says why in Central\'s words and the requests stay absent', async () => {
  // REPLACED (#725): Notifications' waiting and Open's refusal — in Approvals the desktop's notice waits, and carries Central's refusal.
  const reading = approvalsWith({...base, ledger: {status: 'reading'}})
  assert.deepEqual(reading.waiting, ['desktop'])
  assert.equal(reading.values.queue, undefined, 'no request is read, and nothing else waits')
  const words = 'The kernel routes personal.notifications.list to no owner (desktop/cradle/kernel/src/action.rs invoke).'
  const refused = approvalsWith({...base, ledger: {status: 'refused', error: words}})
  assert.equal(refused.values.queue, undefined)
  assert.equal(refused.values.desktop, undefined)
  assert.ok(refused.standing.desktop.disabled.includes(words), 'the desktop\'s notice is disabled with Central\'s (or the kernel\'s) own words')
  await assert.rejects(refused.write([{key: 'open', value: 'x'}]), /no item x waits/)
  const noProvider = approvalsWith({...base, ledger: {status: 'answered', value: {...LEDGER, provider: null,
    provider_error: 'No eligible Connector implements UserNotification.'}}})
  assert.equal(noProvider.values.desktop, undefined, 'no provider selected: absent, never a guessed one')
  assert.equal(queueOf(noProvider).length, 2)
  const unavailable = approvalsWith({...base, ledger: {status: 'answered', value: {...LEDGER, provider: {...LEDGER.provider, available: false}}}})
  assert.equal(unavailable.values.desktop, 'refused', 'a provider that cannot show: refused')
})

test('Approvals reads today\'s requests from Central through invoke_action, and Open goes where the shell has a route', async () => {
  const {readFile} = await import('node:fs/promises')
  const source = await readFile(new URL('../src/widgets/railDevices.tsx', import.meta.url), 'utf8')
  assert.match(source, /centralActionOp\(NOTIFY_LIST_ACTION, \{since_unix_ms: since\}\)/, 'personal.notifications.list since the local midnight')
  // REPLACED (#725): the rail's Notifications device read them (useNotificationsBinding) — the rail's reader is now useOwnerRequests, and
  // Central's Approvals carries what it reads, Open through openNotificationTarget.
  assert.match(source, /export function useOwnerRequests\(transport/)
  assert.doesNotMatch(source, /useNotificationsBinding|id: 'notifications'/, 'no Notifications device on the rail')
  const central = await readFile(new URL('../src/central/devices/CentralDevices.tsx', import.meta.url), 'utf8')
  assert.match(central, /const ownerRequests = useOwnerRequests\(transport\)/)
  assert.match(central, /withOwnerRequests\(commented, \{\.\.\.ownerRequests, nowUnixMs: nowUnixMs \|\| Date\.now\(\)\}, openNotificationTarget,/)
  assert.match(source, /plugin:opener\|open_url/, 'an https:// target through the host\'s opener, as Expressions opens a reference')
  assert.match(source, /no router for oi:\/\/ addresses/, 'an oi:// target refuses naming the missing router')
  assert.equal(rail.NOTIFY_LIST_ACTION, 'personal.notifications.list')
})

// ── 2. Open and Reveal by path ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A kernel behind the bridge's fetch (FIXTURE): invoke_action answered by `actions[action]` (a function of the input, or {refuse}); every op
 * recorded (tests/central-person-writes.test.mjs's shape). */
function kernel(actions = {}) {
  const sent = []
  const ok = outcome => ({json: async () => ({ok: true, outcome})})
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    if (body.op === 'invoke_action') {
      const action = body.invocation.action
      const given = actions[action]
      if (given === undefined) return ok({result: 'action_dispatched', dispatch: {state: 'unknown_owner', action}})
      const answer = typeof given === 'function' ? given(body.invocation.input ?? {}) : given
      return ok({result: 'action_dispatched', dispatch: answer?.refuse ? {state: 'owner_refused', owner_operation: action, message: answer.refuse} : {state: 'invoked', owner_operation: action, data: answer}})
    }
    return {json: async () => ({ok: false, error: `the fixture kernel answers no ${body.op}`})}
  }
  return {sent, fetch}
}
async function withKernel(owner, run) {
  const real = globalThis.fetch
  globalThis.fetch = owner.fetch
  try { return await run() } finally { globalThis.fetch = real }
}

test('Open and Reveal hand a page\'s file or a world\'s folder to Central\'s work.open and work.reveal by its Central-relative path, and Central\'s refusal is the answer', async () => {
  const writes = await import('../src/central/devices/centralDeviceWrites.ts')
  const transport = {kind: 'bridge', url: 'http://kernel.test'}
  const answered = input => ({query: input.query, match: 'path', item: {name: input.query.split('/').filter(Boolean).pop(), path: `/Central/${input.query}`},
    native: {port: 'NativeOpen'}})
  const owner = kernel({'work.open': answered, 'work.reveal': answered})
  await withKernel(owner, async () => {
    const opened = await writes.openOrRevealInCentral(transport, 'open', 'Control/user/flows/today.html')
    assert.equal(opened.item.name, 'today.html')
    await writes.openOrRevealInCentral(transport, 'reveal', 'Work/O-I/ProjectCentral/user')
  })
  assert.deepEqual(owner.sent.filter(body => body.op === 'invoke_action').map(body => [body.invocation.action, body.invocation.input]),
    [['work.open', {query: 'Control/user/flows/today.html'}], ['work.reveal', {query: 'Work/O-I/ProjectCentral/user'}]])
  // A name with no home is not sent; Central's refusal comes back in its words.
  await assert.rejects(writes.openOrRevealInCentral(transport, 'open', 'today.html'), /no Central-relative path/)
  const refusing = kernel({'work.reveal': {refuse: 'Nothing stands at Control/user/flows/gone.html in the Central root.'}})
  await withKernel(refusing, async () => {
    await assert.rejects(writes.openOrRevealInCentral(transport, 'reveal', 'Control/user/flows/gone.html'), /Nothing stands at Control\/user\/flows\/gone\.html/)
  })
  assert.deepEqual(writes.CENTRAL_OPEN_ACTS, {open: 'work.open', reveal: 'work.reveal'})
})

// ── 3. Approvals' Changes: a comment on a source return ───────────────────────────────────────────────────────────────────────────

const PENDING = {return_ref: 'central:return:project:o-i:1792-7', source_ref: 'central:source:project:o-i:ProjectCentral/agents/wiki/notes.md',
  basis_revision: 'r-1', status: 'pending', agent_session_ref: 'agent-session:kite', current_revision: 'r-1'}

test('Changes comments on a pending return through projectcentral.source.return_comment, in the words written in the thread, and says why where it cannot', async () => {
  const comment = await import('../src/central/devices/sourceReturnComment.ts')
  const person = 'central:source:control:root:Control/user/identity'
  assert.deepEqual(comment.returnCommentInput('O-I', PENDING, '  Name the second source too.  ', person),
    {input: {project: 'O-I', return_ref: PENDING.return_ref, comment: 'Name the second source too.', commented_by_ref: person}})
  for (const [args, words] of [
    [[null, PENDING, 'x', person], /none is named here/],
    [['O-I', null, 'x', person], /choose a returned proposal/],
    [['O-I', {...PENDING, status: 'accepted'}, 'x', person], /is accepted, so it takes no comment/],
    [['O-I', PENDING, '   ', person], /say what to change in the thread first/],
    [['O-I', PENDING, 'x'.repeat(16385), person], /at most 16384 bytes/],
    [['O-I', PENDING, 'x', null], /personal anchor has not named the person/],
  ]) assert.match(comment.returnCommentInput(...args).refused, words)
  const transport = {kind: 'bridge', url: 'http://kernel.test'}
  const owner = kernel({'projectcentral.source.return_comment': input => ({schema: 'central.source-return-reading/v1',
    proposal: {...PENDING, comments: [{comment: input.comment, commented_by_ref: input.commented_by_ref, at_unix_ms: 1}]}, authored_source_mutated: false})})
  await withKernel(owner, async () => {
    const kept = await comment.commentSourceReturn(transport, 'O-I', PENDING, 'Name the second source too.', person)
    assert.equal(kept.proposal.status, 'pending', 'the return stays pending: Approve and Reject remain the person\'s')
    assert.equal(kept.proposal.comments[0].comment, 'Name the second source too.')
  })
  assert.deepEqual(owner.sent.filter(body => body.op === 'invoke_action').map(body => [body.invocation.action, body.project, body.invocation.input]),
    [['projectcentral.source.return_comment', 'O-I', {project: 'O-I', return_ref: PENDING.return_ref, comment: 'Name the second source too.', commented_by_ref: person}]])
})

test('Central\'s Approvals carries Changes over the Approvals binding: disabled until something is written, the press sends the written words and then clears them, every other key stays the binding\'s', async () => {
  const comment = await import('../src/central/devices/sourceReturnComment.ts')
  const written = []
  const base = {id: 'central:main:approvals', values: {}, standing: {changes: {disabled: 'Changes: missing op: a comment on a source return (Central).'}, approvals: {disabled: 'x'}},
    writes: key => key === 'approve', write: async changes => { written.push(...changes) }}
  const returns = {entries: [PENDING]}
  const unread = comment.withReturnComments(base, {returns: null, comment: 'x'}, {send: async () => {}})
  assert.match(unread.standing.changes.disabled, /source returns have not answered/)
  const empty = comment.withReturnComments(base, {returns, comment: '  '}, {send: async () => {}})
  assert.match(empty.standing.changes.disabled, /say what to change in the thread first/)
  await assert.rejects(empty.write([{key: 'changes', value: PENDING.return_ref}]), /say what to change in the thread first/)
  const sent = [], cleared = []
  const ready = comment.withReturnComments(base, {returns, comment: ' Date it. '}, {send: async (row, words) => { sent.push([row.return_ref, words]) }, after: () => cleared.push(true)})
  assert.equal(ready.standing.changes, undefined, 'Changes stands once something is written')
  assert.equal(ready.standing.approvals.disabled, 'x', 'the binding\'s other standing is kept')
  assert.ok(ready.writes('changes') && ready.writes('approve'))
  await ready.write([{key: 'changes', value: PENDING.return_ref}, {key: 'approve', value: PENDING.return_ref}])
  assert.deepEqual(sent, [[PENDING.return_ref, 'Date it.']])
  assert.deepEqual(cleared, [true], 'what was written is cleared once Central keeps it')
  assert.deepEqual(written, [{key: 'approve', value: PENDING.return_ref}], 'Approve goes to the binding\'s own write')
  await assert.rejects(ready.write([{key: 'changes', value: 'central:return:project:o-i:gone'}]), /not among the returns Central lists now/)
  const refusing = comment.withReturnComments(base, {returns, comment: 'Date it.'}, {send: async () => { throw new Error('Return is not pending') }, after: () => cleared.push('no')})
  await assert.rejects(refusing.write([{key: 'changes', value: PENDING.return_ref}]), /Return is not pending/)
  assert.deepEqual(cleared, [true], 'a refused comment clears nothing')
  const {readFile} = await import('node:fs/promises')
  const chain = await readFile(new URL('../src/central/devices/CentralDevices.tsx', import.meta.url), 'utf8')
  // REPLACED (O-I #740 lane B): `{returns: returned, comment: agentDraft}`; the comment hand also carries why no returns stand (`absent`).
  assert.match(chain, /withReturnComments\(binding, \{returns: returned, comment: agentDraft, absent: worldReturns\.absent\}/, 'Central\'s chain carries Changes with the Agent\'s composer as the thread')
  // REPLACED (O-I #740 lane B): APPROVALS_PROJECT ('O-I'); the row's own project, else the selected world's register (worldScope.ts).
  assert.match(chain, /commentSourceReturn\(transport, returnProjectOf\(row, approvalsRegister\), row, words, person\)/)
})

// ── 6. The grid's clip second line, the ruler's overview strip and scale label ─────────────────────────────────────────────────────

const noopFn = () => {}

test('a clip\'s second line says what follows it and its takes, as the owner words them, in the grid\'s 52px cell; with nothing to say there is none', async () => {
  const grid = await import('../src/frame/tracks/SessionGrid.tsx')
  const set = {columns: [{id: 'r1', name: '1'}, {id: 'r2', name: '2'}], tracks: [{id: 't', name: 'Lead', kind: 'session'}],
    clips: [{id: 'a', trackId: 't', columnId: 'r1', label: 'map field', status: 'running', launch: {quantize: 'next turn', follow: 'next'}, takes: [{id: 'k1', name: '1'}, {id: 'k2', name: '2', standing: true}]},
      {id: 'b', trackId: 't', columnId: 'r2', label: 'plain', status: 'stopped'}]}
  const markup = renderToStaticMarkup(createElement(grid.SessionGridView, {set, selection: {ref: null, select: noopFn}, folded: {}, onFold: noopFn, receipt: null, onPress: noopFn, onDismiss: noopFn}))
  assert.match(markup, /<span class="cs-text"><span class="cs-label">map field<\/span><small class="cs-sub"><span class="cs-follow">→ next<\/span> · <span class="cs-takes">2 takes<\/span><\/small><\/span>/)
  assert.match(markup, /<span class="cs-text"><span class="cs-label">plain<\/span><\/span>/, 'nothing follows and no takes: one line')
  assert.equal(renderToStaticMarkup(grid.clipSecondLine({takes: [{id: 'k', name: '1'}]})), '<small class="cs-sub"><span class="cs-takes">1 take</span></small>')
  assert.equal(grid.clipSecondLine({launch: {quantize: 'now'}}), null, 'a quantize alone stands in the foot, not the second line')
  const {readFile} = await import('node:fs/promises')
  const css = await readFile(new URL('../src/frame/tracks/tracks.css', import.meta.url), 'utf8')
  // W4: the design's 52px cell replaces the mockup's 28px (catalogue dlw__session-grid.css .sgd-cell; agent-shell-craft pins it).
  assert.match(css, /\.cs \{ height: 52px;/, 'the design\'s 52px cell stands (agent-shell-craft pins it)')
})

test('the ruler\'s overview strip draws the whole ruler with each placed clip and the window, its head the ruler\'s scale; a press centres the window there', async () => {
  const {ArrangementRulerView} = await import('../src/frame/tracks/ArrangementRuler.tsx')
  const set = {columns: [{id: 'r1', name: '1'}], ruler: {unit: 'seconds', end: 1000}, tracks: [{id: 'a', name: 'A', kind: 'session', color: '#4cc9f0'}, {id: 'b', name: 'B', kind: 'session'}],
    clips: [{id: 'c1', trackId: 'a', columnId: 'r1', label: 'one', status: 'stopped', at: {start: 100, end: 300}}, {id: 'c2', trackId: 'b', columnId: 'r1', label: 'two', status: 'running', at: {start: 500}}]}
  const windows = []
  const view = {window: {start: 200, end: 400}, onWindow: w => windows.push(w), snap: 'free', onSnap: noopFn, marker: null, onMarker: noopFn, width: 0}
  const tree = ArrangementRulerView({set, selection: {select: noopFn}, view, receipt: null, onPress: noopFn, onDismiss: noopFn})
  const markup = renderToStaticMarkup(tree)
  assert.match(markup, /<div class="tl-lane tl-over" role="group" aria-label="The whole ruler, in seconds">/)
  assert.match(markup, /<span class="tl-scale">seconds<\/span><small>whole ruler<\/small>/, 'the scale label: the ruler\'s unit')
  assert.match(markup, /data-over-clip="c1" style="left:10%;width:max\(2px, 20%\);top:2px;--tc:#4cc9f0"/)
  assert.match(markup, /data-over-clip="c2" style="left:50%;width:max\(2px, 0%\);top:4.6px/)
  assert.match(markup, /class="tl-over-win" style="left:20%;width:20%"/, 'the window marked on the whole ruler')
  // The press: find the strip's body in the tree and press it at 75% of its width.
  const find = (node, test) => { if (!node || typeof node !== 'object') return null; if (test(node)) return node
    for (const child of [].concat(node.props?.children ?? [])) { const hit = find(child, test); if (hit) return hit } return null }
  const strip = find(tree, node => node.props?.className === 'tl-over-body')
  strip.props.onClick({clientX: 75, currentTarget: {getBoundingClientRect: () => ({left: 0, width: 100})}})
  assert.deepEqual(windows, [{start: 650, end: 850}], 'centred on 750, the window\'s span kept')
  const unruled = renderToStaticMarkup(ArrangementRulerView({set: {...set, ruler: undefined, clips: [{id: 'c3', trackId: 'a', columnId: 'r1', label: 'three', span: {start: 0, end: 1}}]},
    selection: {select: noopFn}, view: {...view, window: null}, receipt: null, onPress: noopFn, onDismiss: noopFn}))
  assert.match(unruled, /<span class="tl-scale">rows in order<\/span>/, 'no ruler: the rows are laid one after another, said so')
  assert.match(unruled, /class="tl-over-win" data-fit="true"/, 'fit: the window is the whole ruler')
})

// ── be2l (DLW build ruling 2026-11-10): the follow-ups of the review of be2k ─────────────────────────────────────────────────────────
const SET_2L = /[\p{Cf}\u{2028}\u{2029}\u{3164}]/u
/** Two words laced with an override and a zero-width space: drawn plain, they read as the two words joined. */
const laced2l = (a, b) => `${a}\u{202e}${b}\u{200b}`
const QUEUE_2L = [
  {id: 'q-req', kind: 'request', who: 'Flint', text: 'Ship the catalogue?', where: 'the catalogue', session: laced2l('tsc ', 'roots'), age: 5, flag: laced2l('recursive ', 'delete'),
    options: {allowOnce: laced2l('Yes, ', 'ship'), deny: laced2l('No, ', 'hold')}},
  {id: 'q-run', kind: 'request', who: 'Kite', text: 'Clear the build', where: 'rm -rf ./x\u{202e}\nls', age: 6, flag: '\u{200b}'},
  {id: 'q-den', kind: 'request', who: 'Kite', text: 'Delete the output', where: 'rm -rf dist', age: 9, state: 'denied', by: laced2l('Gate', 'keeper')},
  {id: 'q-prop', kind: 'proposal', who: 'Flint', text: 'Add the model row', where: 'a.ts', age: 7, diff: ['+ad\u{202e}d a row', '-re\u{200b}move one', ' keep\tthis']},
  {id: 'q-rev', kind: 'review', who: 'Flint', text: 'The attempt', where: 'attempt 3', age: 8, review: {
    criteria: [{text: laced2l('Names ', 'gates'), state: 'satisfied'}, {text: '\u{200b}\u{3164}', state: 'unsatisfied'}],
    claims: [{statement: laced2l('Order ', 'holds'), evidence: 2}], requests: [{question: laced2l('Which ', 'order first')}]}},
  {id: 'q-rcg', kind: 'recognition', who: 'Factory', text: 'Run 12 returned', where: 'Run 12', age: 10,
    recognition: {run: laced2l('Run ', 'twelve'), course: laced2l('The ', 'catalogue'), summary: laced2l('Every ', 'device draws'), recognised: {at: laced2l('09', '.05')}}},
  {id: 'q-ref', kind: 'proposal', who: 'AIKit', text: 'A proposed revision', where: 'skill/docs', age: 11, refinement: {member: laced2l('skill/central/docs', '-method'), owner: 'aikit', stale: false,
    revision: '9c\u{202e}41e2a07b3d5f18', inUse: '4e\u{200b}17b0c2d9a86f35', why: [{task: laced2l('task ', 'one'), reason: laced2l('Plan ', 'lacked gates')}],
    result: [{condition: laced2l('Names ', 'each gate'), proposed: 'open', inUse: 'open'}], resultWhy: laced2l('Open, ', 'no take answered')}},
]
/** Approvals drawn on the queue with one item chosen: every view the host draws, and the Review page. */
const drawn2l = pick => {
  const binding = approvalsWith(base, async () => {}, {opened: [], hold() {}})
  const values = {...binding.values, queue: JSON.stringify(QUEUE_2L), pick}
  return [...hosted(design, {...binding, values}).map(([, markup]) => markup),
    renderToStaticMarkup(design.whole({v: values, set() {}, nav: {}, page: 'review', setPage() {}, standing: {}}))].join('\n')
}

// be2l ruling 3: every word of an item that someone else wrote is read through the cleaners who and where use: the session, the flag,
// who declined, a decision's own answers, a review's conditions, claims and questions, a recognition's run, course, return and time, a
// refinement's member, revisions, reasons, conditions and result. A diff keeps its lines and its tabs. A condition with nothing visible
// is still a condition, and says so.
test('every word of a queue item is drawn plain in every view and on the Review page; a diff keeps its lines (be2l ruling 3)', () => {
  const words = {
    'q-req': ['<span>tsc roots</span>', 'Flagged: recursive delete.', 'Yes, ship', 'No, hold'],
    'q-run': ['Flagged: nothing visible.'],
    'q-den': ['declined · Gatekeeper'],
    'q-prop': ['<span data-d="add">+add a row\n</span><span data-d="del">-remove one\n</span><span> keep\tthis\n</span>'],
    'q-rev': ['<li data-state="satisfied">Names gates<span>met</span></li><li data-state="unsatisfied">nothing visible<span>not met</span></li><li data-state="satisfied">Order holds<span>2 evidence</span></li>', 'Which order first'],
    'q-rcg': ['Run twelve', 'The catalogue', 'Every device draws', '09.05'],
    'q-ref': ['docs-method', '9c41e2a07b3d', '4e17b0c2d9a8', 'Plan lacked gates', 'task one', 'Names each gate', 'Open, no take answered'],
  }
  for (const [pick, expected] of Object.entries(words)) {
    const markup = drawn2l(pick)
    assert.ok(!SET_2L.test(markup), `${pick}: nothing of the set is drawn: ${JSON.stringify(markup.match(/.{0,60}[\p{Cf}\u{2028}\u{2029}\u{3164}].{0,20}/u)?.[0])}`)
    for (const text of expected) assert.ok(markup.includes(text), `${pick}: ${text}`)
  }
})

// be2l ruling 4: what a request is about keeps its lines where a person decides, in the queue and on the rail; the rail reads it from
// the callback where the record names no subject; and Open acts on the callback exactly as the record keeps it.
test('what a request is about keeps its lines in the queue and on the rail, falls back to its callback, and Open opens the callback as given (be2l ruling 4)', async () => {
  assert.ok(drawn2l('q-run').includes('<pre class="ap-cmd" aria-label="What it asks">rm -rf ./x\nls</pre>'), 'the queue keeps a command\'s lines')
  const record = structuredClone(LEDGER), given = 'https://ci.test/\u{202e}run\u{200b}/7'
  record.requests[0].request.subject_ref = 'factory:run:7\nthe \u{2066}second\u{2069} line'
  record.requests[0].request.callback = given
  record.requests[1].request.callback = 'central:day/\u{200b}close'
  const input = {...base, ledger: {status: 'answered', value: record}}
  const {rows} = rail.ownerRequestsValues(input)
  assert.deepEqual(rows.map(row => [row.where, row.open]), [['factory:run:7\nthe second line', given], ['central:day/close', 'central:day/\u{200b}close']])
  const opened = []
  await approvalsWith(input, async target => { opened.push(target) }, {opened: [], hold() {}}).write([{key: 'open', value: 'central:notification:2-1'}])
  assert.deepEqual(opened, [given])
})

// be2n ruling 5 (DLW build ruling 2026-11-11): "nothing visible" is the queue's word for given words that show nothing. Given words that
// are exactly those two words are someone's: they stand in quotes, so neither is taken for the other.
test('given words that are exactly "nothing visible" are drawn in quotes; words that show nothing are not (be2n ruling 5)', () => {
  const binding = approvalsWith(base, async () => {}, {opened: [], hold() {}})
  const queue = JSON.stringify([{id: 'q-said', kind: 'request', who: 'Kite', text: 'Clear the build', where: 'rm -rf ./x', age: 6, flag: 'nothing visible'},
    {id: 'q-blank', kind: 'request', who: 'Kite', text: 'Clear the build', where: 'rm -rf ./y', age: 7, flag: '\u{200b}\u{3164}'},
    {id: 'q-rev', kind: 'review', who: 'Flint', text: 'The attempt', where: 'attempt 3', age: 8, review: {criteria: [{text: 'nothing visible', state: 'satisfied'}, {text: '\u{200b}', state: 'unsatisfied'}], claims: [], requests: []}}])
  const draw = pick => hosted(design, {...binding, values: {...binding.values, queue, pick}}).map(([, markup]) => markup).join('\n')
  assert.ok(draw('q-said').includes('Flagged: &quot;nothing visible&quot;.'), 'someone wrote those words')
  assert.ok(draw('q-blank').includes('Flagged: nothing visible.'), 'the queue says nothing shows')
  assert.ok(draw('q-rev').includes('<li data-state="satisfied">&quot;nothing visible&quot;<span>met</span></li><li data-state="unsatisfied">nothing visible<span>not met</span></li>'), draw('q-rev'))
})

// be2n ruling 1: the line and the raw form a request's row hands the queue are read as every other word of it is: the line on one plain
// line, the raw form a plain block. A row that hands neither draws neither.
test('a request row\'s line and raw form are drawn plain, the raw form open under its line; a row with neither draws neither (be2n ruling 1)', () => {
  const binding = approvalsWith(base, async () => {}, {opened: [], hold() {}})
  const queue = JSON.stringify([{id: 'q-sent', kind: 'request', who: 'Kite', text: 'ls', where: 'execute', age: 6, differs: 'Not\u{202e} as sent\u{200b}', raw: '{"a":\u{202e}1}\u{2028}x'},
    {id: 'q-bare', kind: 'request', who: 'Kite', text: 'ls', where: 'execute', age: 7}])
  const draw = pick => hosted(design, {...binding, values: {...binding.values, queue, pick}}).map(([, markup]) => markup).join('\n')
  const sent = draw('q-sent')
  assert.ok(sent.includes('<p class="ap-note ap-differs" role="note" data-flagged="true">Not as sent</p><details class="ap-raw" open=""><summary>Show raw</summary><pre class="ap-cmd">{&quot;a&quot;:1}\nx</pre></details>'), sent.match(/.{0,80}ap-raw.{0,160}/s)?.[0])
  assert.ok(!SET_2L.test(sent), 'nothing of the set is drawn')
  const bare = hosted(design, {...binding, values: {...binding.values, queue: JSON.stringify([JSON.parse(queue)[1]]), pick: 'q-bare'}}).map(([, markup]) => markup).join('\n')
  assert.ok(!bare.includes('ap-raw') && !bare.includes('ap-differs') && !bare.includes('Show raw is in the pane.'))
})
