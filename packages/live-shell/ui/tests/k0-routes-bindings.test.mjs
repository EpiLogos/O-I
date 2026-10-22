// Lane K0 (T-COVERAGE §1.2, W3's last three routes): each control bound through its kernel route, and its refusal the owner's words.
//   the Run map's Retry (software-factory:run-map, §19.25)       factory_owner attempt-retry (kernel/src/factory_retry.rs)
//   the Skillset rack's Issue (Bypass, the rack's upkeep pages)   aikit_write bypass-issue (`aikit bypass issue`)
//   Ground hygiene's Release orphans and sandboxes (§18.5)       workcell_read sandboxes, workcell_write release-orphans
//                                                                (`workcell sandboxes reconcile --server <url> [--release-orphans]`)
//
// Channels, each claim carried by one:
// - REAL (desktop/cradle/kernel/tests/fixtures/owner-routes/*-2026-10-22.json): Workcell's own report of a fixture lifecycle server and
//   its refusal for an unreachable one (read only); AIKit's bypass issue and its two refusals in an isolated home; Factory's admission
//   reading as the installed Factory answers it.
// - SCRIPTED: a kernel behind the bridge's fetch that records each op it is sent and answers it as the kernel answers (owner_route_reading,
//   factory_development_reading, or the kernel's Error envelope); the catalogue designs rendered through the runtime's host to static
//   markup. No owner state is written: every write goes to the scripted kernel.
// Not a screen pass.
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
const runMap = await import('../src/agent/devices/runMapBinding.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const routes = await import('../src/agent/devices/ownerRoutes.ts')
const ground = await import('../src/central/devices/groundDevices.ts')
const groundBind = await import('../src/central/devices/groundBindings.ts')
const pageHolds = await import('../src/central/devices/pageBindings.ts')
const hygieneModel = await import('../src/inhabitants/centralHygieneModel.ts')
const {design: runMapDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__run-map.tsx')
const {design: hygieneDesign} = await import('../src/inhabitants/catalogue/panels/central__ground-hygiene.tsx')

const kernelFixture = name => JSON.parse(readFileSync(new URL(`../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/${name}`, import.meta.url), 'utf8'))
const SANDBOXES = kernelFixture('workcell-sandboxes-2026-10-22.json')
const BYPASS = kernelFixture('aikit-bypass-issue-2026-10-22.json')
const factoryRs = readFileSync(new URL('../../../../desktop/cradle/kernel/src/factory.rs', import.meta.url), 'utf8')
const routesRs = readFileSync(new URL('../../../../desktop/cradle/kernel/src/owner_routes.rs', import.meta.url), 'utf8')

/** The kernel's Error envelope for an owner's refusal (owner_routes.rs `wire`), as the bridge carries it. */
const refusal = message => JSON.stringify({kind: 'owner-refused-or-failed', message, operation_may_have_run: false})
/** A kernel behind the bridge's fetch: `answer(op)` gives the outcome, or {error} for the kernel's refusal; each op kept. */
function kernel(answer) {
  const sent = []
  const fetch = async (_url, init) => {
    const op = JSON.parse(init.body)
    sent.push(op)
    const outcome = answer(op)
    return {json: async () => (outcome && 'error' in outcome ? {ok: false, error: outcome.error} : outcome ? {ok: true, outcome} : {ok: false, error: `the fixture kernel answers no ${op.op}`})}
  }
  return {sent, fetch}
}
async function withKernel(owner, run) {
  const real = globalThis.fetch
  globalThis.fetch = owner.fetch
  try { return await run() } finally { globalThis.fetch = real }
}
const viewsOf = design => design.views ?? ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (designed, binding) => viewsOf(designed).filter(view => view !== 'popout').map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))])
function draws(design, binding) {
  const drawn = hosted(design, binding)
  for (const [view, markup] of drawn) {
    assert.match(markup, new RegExp(`data-device-view="${view}"`), `${design.id} ${view} draws`)
    assert.doesNotMatch(markup, /\bNaN\b|undefined/, `${design.id} ${view}: no absent key drawn as text`)
    assert.doesNotMatch(markup, /data-device-fault/, `${design.id} ${view}: its own view drew`)
  }
  return drawn.map(([, markup]) => markup).join('\n')
}

// ── the Run map's Retry ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const RUN = {statePath: '/Users/admin/Central/Work/Factory/.factory/state', runRef: 'run:one', units: {'work-inspect': 'unit:inspect-source'}}
const ADMITS_NO_RETRY = 'Factory admits no retry from a desktop caller: its attempt admission (factory attempt admission) names no attempt-retry action, only attempt-receiving.'

test('Run map · Retry is the kernel\'s factory_owner attempt-retry: the request the kernel deserialises, the unit the node stands for', async () => {
  // The kernel's own request: OwnerRequest::AttemptRetry, serde kebab-case, with the fields the binding sends.
  assert.match(factoryRs, /AttemptRetry \{\s+state_path: PathBuf,\s+run_ref: String,\s+workflow_unit_ref: String,/)
  assert.match(factoryRs, /#\[serde\(tag = "kind", rename_all = "kebab-case"\)\]\s+pub enum OwnerRequest/)
  bind.resetHolds()
  const owner = kernel(op => (op.op === 'factory_owner' ? {result: 'factory_development_reading', data: {contract: 'oi.factory-attempt-retry/v1', status: 'retried',
    changed: true, attemptRef: 'attempt:desk-retry:ab', refusal: null}} : null))
  const transport = {kind: 'bridge', url: 'http://run-map.fixture'}
  const binding = runMap.runMapBinding(bind.chainHolds(), RUN, {owner: request => routes.factoryOwnerWrite(transport, request, '`factory attempt action` retry')})
  assert.equal(binding.standing.retry, undefined, 'a Run named and a carrier: Retry stands')
  await withKernel(owner, () => binding.write([{key: 'retry', value: 'work-inspect'}]))
  assert.deepEqual(owner.sent, [{op: 'factory_owner', request: {kind: 'attempt-retry', state_path: RUN.statePath, run_ref: 'run:one', workflow_unit_ref: 'unit:inspect-source'}}])
  // A node Factory names no unit for is not asked.
  await assert.rejects(binding.write([{key: 'retry', value: 'barrier-gate'}]), /names no unit for the node barrier-gate/)
  assert.equal(owner.sent.length, 1)
})

test('Run map · Factory\'s refusal is the press\'s error in Factory\'s words; with no Run named, Retry stands disabled saying so', async () => {
  bind.resetHolds()
  // The kernel's document when the installed Factory admits no desktop retry (factory_retry.rs; its admission reading is REAL).
  const answers = [{status: 'refused', changed: false, refusal: {source: 'owner', step: 'admission', message: ADMITS_NO_RETRY}},
    {status: 'uncertain', changed: true, refusal: {source: 'owner', step: 'retry', message: 'Software Factory attempt stopped at its 300 s bound'}}]
  for (const answer of answers) {
    const binding = runMap.runMapBinding(bind.chainHolds(), RUN, {owner: async () => ({contract: 'oi.factory-attempt-retry/v1', ...answer})})
    await assert.rejects(binding.write([{key: 'retry', value: 'work-inspect'}]), {message: answer.status === 'refused' ? ADMITS_NO_RETRY
      : 'Factory did not answer and may have run: Software Factory attempt stopped at its 300 s bound Read the Run again before retrying.'})
  }
  // No Run on the Main track (today): disabled, naming the route and why; a Run without a carrier says so instead.
  const none = runMap.runMapBinding(bind.chainHolds())
  assert.equal(none.standing.retry.disabled, runMap.RUN_MAP_REFUSE.retry)
  assert.match(none.standing.retry.disabled, /factory_owner attempt-retry .* no Run is named on the Main track/)
  await assert.rejects(none.write([{key: 'retry', value: 'work-inspect'}]), {message: runMap.RUN_MAP_REFUSE.retry})
  const noCarrier = runMap.runMapBinding(bind.chainHolds(), RUN)
  assert.match(noCarrier.standing.retry.disabled, /kernel carrier is unavailable/)
  // A Run named but not read: the other acts and readings say that, not "no Run is named".
  assert.match(noCarrier.standing.recognise.disabled, new RegExp(runMap.RUN_NOT_READ.slice(0, 40)))
  assert.doesNotMatch(noCarrier.standing.run.disabled, /no Run is named/)
  // (a) the catalogue design draws on both bindings.
  for (const binding of [none, noCarrier]) draws(runMapDesign, binding)
})

// ── the Skillset rack's Issue ───────────────────────────────────────────────────────────────────────────────────────────────────────

const RACK_INPUT = () => ({profile: null, sets: {}, setList: null, skills: null, capabilities: null, profiles: null, holds: bind.chainHolds()})

test('Skillset rack · Issue writes aikit_write bypass-issue with the scope and the reason pressed, and AIKit\'s answer stands', async () => {
  assert.match(routesRs, /BypassIssue \{\s+#\[serde\(default\)\]\s+scope: Option<String>,\s+reason: String,/, 'the kernel\'s own request')
  bind.resetHolds()
  const owner = kernel(op => (op.op === 'aikit_write' ? {result: 'owner_route_reading', route: 'aikit bypass issue', data: BYPASS.issued.data, warnings: []} : null))
  const transport = {kind: 'bridge', url: 'http://rack-issue.fixture'}
  const upkeep = {write: request => routes.ownerRouteWrite(transport, routes.aikitWriteOp(request), '`aikit bypass issue`')}
  const binding = bind.rackBinding('factory:skillset', RACK_INPUT(), null, {project: 'O-I', sessionRef: null}, upkeep)
  assert.equal(binding.standing.issue, undefined, 'a carrier stands: Issue is offered')
  assert.ok(binding.writes('issue'))
  await withKernel(owner, () => binding.write([{key: 'issue', value: JSON.stringify({scope: 'next-event', reason: 'debugging a flake'})}]))
  assert.deepEqual(owner.sent, [{op: 'aikit_write', request: {kind: 'bypass-issue', reason: 'debugging a flake', scope: 'next-event'}}])
  // Without a carrier, Issue stands disabled naming it.
  const alone = bind.rackBinding('factory:skillset', RACK_INPUT(), null, {project: 'O-I', sessionRef: null}, {})
  assert.match(alone.standing.issue.disabled, /kernel carrier is unavailable/)
})

test('Skillset rack · a scope AIKit does not take is refused in AIKit\'s words (the design offers 1 hour; AIKit 0.1.0 parses none)', async () => {
  bind.resetHolds()
  const owner = kernel(op => (op.op === 'aikit_write' ? {error: refusal(BYPASS.scope_refused.error.message)} : null))
  const transport = {kind: 'bridge', url: 'http://rack-issue-refused.fixture'}
  const binding = bind.rackBinding('factory:skillset', RACK_INPUT(), null, {project: 'O-I', sessionRef: null},
    {write: request => routes.ownerRouteWrite(transport, routes.aikitWriteOp(request), '`aikit bypass issue`')})
  await assert.rejects(withKernel(owner, () => binding.write([{key: 'issue', value: JSON.stringify({scope: '1h', reason: 'a long debug'})}])),
    {message: '`1h` is not a bypass scope; use `next-event` or `session`'})
  assert.deepEqual(owner.sent[0].request, {kind: 'bypass-issue', reason: 'a long debug', scope: '1h'}, 'the scope travels as pressed: AIKit decides')
})

// ── Ground hygiene's sandboxes and Release orphans ──────────────────────────────────────────────────────────────────────────────────

const SERVER = SANDBOXES.read.server
const sandboxKernel = (sandboxes, release) => kernel(op => {
  if (op.op === 'workcell_read' && op.request.kind === 'sandboxes') return sandboxes
  if (op.op === 'workcell_write' && op.request.kind === 'release-orphans') return release
  return null
})
const censusOf = pages => ({census: {sources: [], worktrees: [], branches: [], seats: [], machineRef: 'workcell:mac'}, findings: [], pages, at: Date.UTC(2026, 9, 22, 9)})

test('Ground hygiene · a named server\'s sandboxes are Workcell\'s report through workcell_read sandboxes, classified by the model', async () => {
  const owner = sandboxKernel({result: 'owner_route_reading', route: 'workcell sandboxes reconcile', data: SANDBOXES.read, warnings: []}, null)
  const pages = await withKernel(owner, () => ground.readHygienePages({kind: 'bridge', url: 'http://hygiene-sandboxes.fixture'}, 'e', true, SERVER))
  assert.deepEqual(owner.sent.filter(op => op.op === 'workcell_read'), [{op: 'workcell_read', request: {kind: 'sandboxes', server: SERVER}}])
  assert.deepEqual(pages.sandboxes.sandboxes.map(box => [box.id, box.lease]), [['sbx-live', 'live'], ['sbx-orphan', 'expired-orphan'], ['sbx-nolease', 'unknown']])
  const op = ground.sandboxesOp(SERVER)
  assert.equal(pages.sources.find(source => source.boundaryOp === op).refusal, undefined)
  assert.deepEqual(pages.findings.filter(f => f.kind.startsWith('sandbox')).map(f => [f.kind, f.subject, f.tenderId]),
    [['sandbox-orphan', 'sbx-orphan', 'release-orphans'], ['sandbox-unproven', 'sbx-nolease', null]])
  // With no server named (the shell today), the sandboxes are not asked and the source says why.
  const unnamed = sandboxKernel(null, null)
  const bare = await withKernel(unnamed, () => ground.readHygienePages({kind: 'bridge', url: 'http://hygiene-unnamed.fixture'}, 'e', true))
  assert.equal(unnamed.sent.some(op => op.op === 'workcell_read'), false)
  assert.equal(bare.sources.find(source => source.boundaryOp === ground.PAGE_OPS.sandboxes).refusal, groundBind.NO_SANDBOX_SERVER)
})

test('Ground hygiene · Release orphans writes workcell_write release-orphans on the named server, and a refused read is its standing in Workcell\'s words', async () => {
  pageHolds.resetHolds()
  const transport = {kind: 'bridge', url: 'http://hygiene-release.fixture'}
  const sandboxes = hygieneModel.sandboxesOfReport(SANDBOXES.read)
  const read = censusOf({sources: [{boundaryOp: ground.sandboxesOp(SERVER), channel: 'kernel-op', at: 't'}], sandboxes,
    findings: hygieneModel.materialFindings({sandboxes, ops: {worlds: ground.PAGE_OPS.worlds, sandboxes: ground.sandboxesOp(SERVER)}})})
  const released = {...SANDBOXES.read, release_orphans: true, released_sandboxes: ['sbx-orphan']}
  const owner = sandboxKernel(null, {result: 'owner_route_reading', route: 'workcell sandboxes reconcile --release-orphans', data: released, warnings: []})
  let reread = 0
  const binding = groundBind.hygieneBinding('central:ground-hygiene', read, Date.UTC(2026, 9, 22, 9), async () => { reread++ }, {sandboxes: ground.sandboxesPort(transport, SERVER)})
  // The tender has a writer: Tend and Allow are the hand's, at the manual's defaults (Propose, On); the seat's tenders stay refused, and
  // Reconcile, with no Workcell port handed in here, says so.
  assert.deepEqual([binding.values.tend, binding.values['allow:orphans']], ['propose', true])
  assert.equal(binding.standing.orphans, undefined)
  assert.equal(binding.standing.tend, undefined)
  assert.match(binding.standing.release.disabled, /no writer reaches it/)
  assert.equal(binding.standing.reconcile.disabled, 'The kernel carrier is unavailable here, so Workcell cannot be asked.')
  for (const key of groundBind.HYGIENE_ORPHANS_WIRING.keys) {
    assert.ok([groundBind.HYGIENE_ORPHANS_WIRING.reads, groundBind.HYGIENE_ORPHANS_WIRING.writes, groundBind.HYGIENE_ORPHANS_WIRING.local,
      groundBind.HYGIENE_ORPHANS_WIRING.refused, groundBind.HYGIENE_ORPHANS_WIRING.absent].some(table => key in table), `${key} placed`)
  }
  await withKernel(owner, () => binding.write([{key: 'orphans', value: 'sbx-orphan'}]))
  assert.deepEqual(owner.sent, [{op: 'workcell_write', request: {kind: 'release-orphans', server: SERVER}}])
  assert.equal(reread, 1, 'the pages are read again after the release')
  // Only an orphan in Workcell's last report is pressed; the others are not asked.
  await assert.rejects(binding.write([{key: 'orphans', value: 'sbx-nolease'}]), /sbx-nolease is not an orphan in Workcell's last report/)
  assert.equal(owner.sent.length, 1)
  // Workcell's failure for the sandbox, in its words.
  const failed = sandboxKernel(null, {result: 'owner_route_reading', route: 'r', data: {...SANDBOXES.read, release_orphans: true,
    failures: [{operation: 'release sandbox', target: 'sbx-orphan', reason: 'OpenSandbox release sandbox returned HTTP 405'}]}, warnings: []})
  await assert.rejects(withKernel(failed, () => binding.write([{key: 'orphans', value: 'sbx-orphan'}])),
    {message: 'Workcell could not release sbx-orphan: OpenSandbox release sandbox returned HTTP 405'})
  // Workcell refuses the read of an unreachable server (REAL words): that is Release orphans' standing, and no sandbox is drawn.
  const words = 'unavailable: connect OpenSandbox HTTP endpoint 127.0.0.1:9: Connection refused (os error 61)'
  const down = sandboxKernel({error: refusal(words)}, null)
  const pages = await withKernel(down, () => ground.readHygienePages(transport, 'e', true, 'http://127.0.0.1:9'))
  assert.equal(pages.sandboxes, undefined)
  const refused = groundBind.hygieneBinding('central:ground-hygiene', censusOf(pages), Date.UTC(2026, 9, 22, 9), async () => {}, {sandboxes: ground.sandboxesPort(transport, 'http://127.0.0.1:9')})
  assert.equal(refused.standing.orphans.disabled, words)
  // With no server named, Release orphans stands as before: refused, naming what it waits for.
  const unnamed = groundBind.hygieneBinding('central:ground-hygiene', censusOf({sources: [], findings: []}), Date.UTC(2026, 9, 22, 9), async () => {})
  assert.match(unnamed.standing.orphans.disabled, /a sandbox server named to the shell/)
  // Tend is the hand's setting either way (lane K0): Central's and Workcell's tenders write through their owners.
  assert.equal(unnamed.values.tend, 'propose')
  assert.equal(unnamed.values['allow:orphans'], undefined, 'no server named: Release orphans offers nothing to allow')
  // (a) the catalogue design draws the Material page on the named server's report.
  host.setHostPage(binding.id, 'material')
  const markup = draws(hygieneDesign, binding)
  assert.match(markup, /sbx-orphan/)
  host.resetHost(binding.id)
})
