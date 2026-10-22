// T-COVERAGE §1.3, the refusals that were stale: each binding below refused a reading or an act its owner already answers. Each now
// reads (or writes) through the owner's own route — Central's readings through the kernel's invoke_action (owner_write.rs carries a
// Central reading as a reading: it retires nothing), the page op, Factory's AttemptReceiving — and draws its catalogue design on it.
//   the Day (central:day-die, DLW §18.2)            central.day.settings.read, central.day.moves.read
//   Ground hygiene (central:ground-hygiene, §18.5)  central.git.census
//   Beings and Things (central:beings|things)       the page op's mutate_field
//   Runs (software-factory:attempt-review, §19.1)   the take lanes' reading; Stands through factory_owner AttemptReceiving
//   Scope (software-factory:context-write-mode)     central.world.effective-sources; a place request waits on the person's route
//   Wiki (widgets:wiki, §23.7)                      central.wiki.read for the page's links
//   Search (central:search, §18.4)                  control.search for Your world
//   a page's takes (§18.1)                          central.temporal.source-history
//   Diff (widgets:diff, §23.4)                      the selected seat's checkout
//
// Channels, each claim carried by one:
// - REAL (tests/fixtures/stale-refusals-2026-10-21.json): Central's answers on workcell:mac, 21 Oct 2026, through `ctrl --json action
//   run` (the runner the kernel's invoke_action reaches), read-only: the Day's settings and moves, the O-I git census, the root world's
//   effective sources, the root wiki, one page's history (Control/user/day/2026-10-19/day.md), and control.search's refusal ("Native
//   source exceeds the 4 MiB eager read capacity"). The seat instrument's reading is tests/fixtures/workcell-readings-2026-10-16.json.
// - FIXTURE: what no real answer on this machine holds — a move's run (Central's runs_of shape, day_moves.rs), a Being page (personal/
//   page.mjs law; no oi.page/v1 page exists on this machine), Factory takes (agent/factoryTakes.ts FactoryTake), a control.search match
//   (ctrl control.rs ControlSearchMatch), a wiki relation whose target the text names.
// - SCRIPTED: the catalogue designs rendered through the runtime's host (deviceHost.HostedDevice) to static markup; a kernel behind the
//   bridge's fetch answering invoke_action with the REAL data. No owner state is written: every write goes to a recording hand.
// Not a screen pass: the on-screen legs are the lead's.
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
const day = await import('../src/central/devices/dayBinding.ts')
const readings = await import('../src/central/devices/useCentralReadings.ts')
const ground = await import('../src/central/devices/groundDevices.ts')
const groundBind = await import('../src/central/devices/groundBindings.ts')
const hygieneModel = await import('../src/inhabitants/centralHygieneModel.ts')
const {readHygieneCensus} = await import('../src/inhabitants/CentralHygieneDevice.tsx')
const pages = await import('../src/central/devices/pageBindings.ts')
const tasks = await import('../src/agent/devices/taskBindings.ts')
const chainBind = await import('../src/agent/devices/designBindings.ts')
const world = await import('../src/central/devices/contextWorldBinding.ts')
const search = await import('../src/central/devices/searchBinding.ts')
const rail = await import('../src/widgets/railDevices.tsx')
const adapter = await import('../src/timeline/centralTrackAdapter.ts')
const {day: dayDesign} = await import('../src/inhabitants/catalogue/panels/day.tsx')
const {design: hygieneDesign} = await import('../src/inhabitants/catalogue/panels/central__ground-hygiene.tsx')
const {design: beingsDesign} = await import('../src/inhabitants/catalogue/panels/central__beings.tsx')
const {design: thingsDesign} = await import('../src/inhabitants/catalogue/panels/central__things.tsx')
const {design: runsDesign} = await import('../src/inhabitants/catalogue/panels/software-factory__attempt-review.tsx')
const {scope: scopeDesign} = await import('../src/inhabitants/catalogue/panels/scope.tsx')
const {design: searchDesign} = await import('../src/inhabitants/catalogue/panels/central__search.tsx')
const {design: wikiDesign} = await import('../src/inhabitants/catalogue/panels/widgets__wiki.tsx')

const REAL = JSON.parse(readFileSync(new URL('./fixtures/stale-refusals-2026-10-21.json', import.meta.url), 'utf8'))
const SEATS = JSON.parse(readFileSync(new URL('./fixtures/workcell-readings-2026-10-16.json', import.meta.url), 'utf8')).seatStatus
const bridge = {kind: 'bridge', url: 'http://owner.fixture'}
const escaped = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const viewsOf = design => design.views ?? ['folded', 'compact', 'whole', 'full', 'widget']
const hosted = (designed, binding) => viewsOf(designed).filter(view => view !== 'popout').map(view => [view, renderToStaticMarkup(createElement(host.HostedDevice, {designed, binding, view, nav: {}}))])
/** The design's keys (defaults ∪ fixtures), as standard (b) classifies them. */
const designKeys = design => [...new Set([...Object.keys(design.defaults), ...Object.values(design.fixtures ?? {}).flatMap(fixture => Object.keys(fixture))])]

/** A kernel behind the bridge's fetch: invoke_action answered by `actions` (data, or {refuse}), every other op refused; each op kept. */
function kernel(actions) {
  const sent = []
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    if (body.op === 'invoke_action') {
      const answer = actions[body.invocation.action]
      if (!answer) return {json: async () => ({ok: true, outcome: {result: 'action_dispatched', dispatch: {state: 'unknown_owner', action: body.invocation.action}}})}
      return {json: async () => ({ok: true, outcome: {result: 'action_dispatched', dispatch: answer.refuse
        ? {state: 'owner_refused', owner_operation: body.invocation.action, message: answer.refuse} : {state: 'invoked', owner_operation: body.invocation.action, data: answer}}})}
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

// ── the kernel route: a reading carried as an action, through the shell's one helper ─────────────────────────────────────────────────

test('a Central reading travels as invoke_action and comes back as its data, or as the owner\'s words', async () => {
  assert.deepEqual(readings.centralActionOp('central.day.moves.read', {day_ref: 'd'}),
    {op: 'invoke_action', invocation: {action: 'central.day.moves.read', target_ref: 'central:action:central.day.moves.read', input: {day_ref: 'd'}}})
  const answered = (dispatch) => readings.actionAnswerOf({status: 'answered', value: {result: 'action_dispatched', dispatch}, error: null}, 'control.search')
  assert.deepEqual(answered({state: 'invoked', owner_operation: 'x', data: {a: 1}}), {status: 'answered', value: {a: 1}})
  assert.deepEqual(answered({state: 'owner_refused', owner_operation: 'x', message: REAL.controlSearch.envelope.error.message}),
    {status: 'refused', error: 'Native source exceeds the 4 MiB eager read capacity'})
  assert.match(answered({state: 'unknown_owner', action: 'control.search'}).error, /routes control\.search to no owner/)
  assert.deepEqual(readings.actionAnswerOf({status: 'reading', value: null, error: null}, 'x'), {status: 'reading'})
})

// ── the Day ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const OWN = {settings: REAL.daySettings.data, settingsRefusal: null, moves: REAL.dayMoves.data, movesRefusal: null, timezone: 'Europe/London'}
const READY_FACTS = {civilDate: '2026-10-19', standing: {state: 'ready', dayRef: 'central:day:control:root:2026-10-19', civilDate: '2026-10-19', sourceRef: 's', documentId: 'd', revision: 'r'},
  refusal: null, canOpenToday: false, canClose: true, aperture: null, boundary: 0, automaticRollover: false}

test('REAL — the Day\'s own settings and moves: Rollover Off, Agent writes, every Source, Close routine, each move\'s prompt and Runs at, and no run yet', () => {
  const values = day.dayOwnValuesOf(OWN)
  assert.equal(values.rollover, -15, 'Central\'s rollover null: Off, the design\'s step below midnight')
  assert.deepEqual([values.agentWrites, values.closeRoutine], ['propose', true])
  assert.deepEqual(['src_central', 'src_factory', 'src_expressions', 'src_techne', 'src_live'].map(key => values[key]), [true, true, true, true, true], 'Live too: the design\'s default had it off')
  assert.deepEqual(['tasks', 'patterns', 'context', 'synthesis', 'close'].map(move => values[`at_${move}`]), [-45, -45, -45, -45, -30], 'Off, and Close at Day start')
  assert.equal(values.prompt_tasks, REAL.daySettings.data.effective_prompts.tasks)
  assert.notEqual(values.prompt_tasks, dayDesign.defaults.prompt_tasks, 'the owner\'s prompt, never the design\'s sample')
  for (const move of ['tasks', 'patterns', 'context', 'synthesis', 'close']) {
    assert.equal(values[`running_${move}`], false, `${move}: no open run`)
    assert.equal(values[`last_${move}`], -1, `${move}: no run ended in this Day — "not yet"`)
  }
  const why = day.dayOwnAbsent(OWN, values)
  for (const move of ['tasks', 'patterns', 'context', 'synthesis']) assert.match(why[`gave_${move}`], /No run of this move has ended in this Day/)
  assert.deepEqual(Object.keys(why).filter(key => !key.startsWith('gave_')), [], 'nothing else is absent')
})

test('FIXTURE — a move\'s runs in Central\'s own shape: the open run lights its pad; the last ended run gives its time on the policy\'s clock and what it gave', () => {
  const ended = Date.UTC(2026, 9, 19, 8, 30) // 09:30 BST
  const moves = structuredClone(REAL.dayMoves.data)
  moves.moves.tasks.last = {run_ref: 'r1', move: 'tasks', state: 'done', ended_at_unix_ms: ended, end: {state: 'done', gave: {summary: 'three tasks', proposals: ['t1', 't2', 't3'], writes: []}}}
  moves.moves.patterns.running = {run_ref: 'r2', move: 'patterns', state: 'running'}
  moves.moves.context.last = {run_ref: 'r3', move: 'context', state: 'refused', ended_at_unix_ms: ended, end: {state: 'refused', reason: 'Agent writes was Off'}}
  const values = day.dayOwnValuesOf({...OWN, moves})
  assert.deepEqual([values.last_tasks, values.gave_tasks, values.running_patterns], [570, 3, true])
  assert.equal(values.last_context, 570)
  assert.equal(values.gave_context, undefined, 'a refused run says why, not what it gave')
  assert.match(day.dayOwnAbsent({...OWN, moves}, values).gave_context, /ended without saying what it gave/)
  assert.equal(day.dayOwnValuesOf({...OWN, moves, timezone: null}).last_tasks, undefined, 'no clock to read the instant on: absent, never a guess')
  assert.equal(day.runsAtOf({kind: 'daily', time: '07:15'}), 435)
  assert.equal(day.runsAtOf({kind: 'weekly'}), undefined, 'a kind Central does not write is not read')
})

test('the Day\'s readings refused or unread: each own key absent in the owner\'s words; no moves for a Day with no document', () => {
  const refused = {settings: null, settingsRefusal: 'the Day\'s settings source is not JSON; nothing is guessed from it', moves: null, movesRefusal: null, timezone: null}
  const values = day.dayOwnValuesOf(refused)
  assert.deepEqual(values, {})
  const why = day.dayOwnAbsent(refused, values)
  assert.match(why.agentWrites, /Central refused its Day settings: the Day's settings source is not JSON/)
  assert.match(why.last_tasks, /The Day shown has no document, so its moves are not read/)
  assert.match(day.dayOwnAbsent({...refused, moves: undefined}, values).running_close, /have not answered yet \(central\.day\.moves\.read\)/)
})

test('(b) every key the Day design reads is a reading, absent with its reason, or a local hold; (c) every control writes or stands disabled with its route', async () => {
  const values = day.dayValuesOf(READY_FACTS, null, OWN)
  const why = {...day.DAY_ABSENT, ...day.dayOwnAbsent(OWN, values)}
  const own = new Set(['face', 'c0', 'c1', 'c2done', 'date', 'refusal', 'canOpenToday', 'canClose', 'dayStart', 'light'])
  for (const key of designKeys(dayDesign)) {
    assert.ok(key in values || why[key] || own.has(key), `${key}: a reading, or absent with a reason`)
    if (key in values) assert.notEqual(values[key], undefined, key)
  }
  // REPLACED (W2): the settings and the pads write through Central (central-person-writes.test.mjs); with no writers handed in here, a
  // write is refused naming what is missing. Verify still waits on its kernel route.
  const binding = day.dayDesignBinding('central:day-die', READY_FACTS, values, {turn: async () => {}, openToday: async () => {}, closeNow: async () => {}}, OWN)
  for (const key of ['run_tasks', 'rollover', 'agentWrites', 'closeRoutine', 'src_live', 'at_close', 'prompt_tasks']) assert.equal(binding.standing[key], undefined, `${key} acts`)
  await assert.rejects(binding.write([{key: 'verifyCloseout', value: true}]), /T-COVERAGE §1\.2/)
  assert.equal(binding.standing.closeNow, undefined, 'Close now writes through Central\'s close-carry')
})

test('(e) the Day draws its design on Central\'s readings in every view: the owner\'s prompt, the pads\' reasons, never the design\'s sample', () => {
  const values = day.dayValuesOf(READY_FACTS, null, OWN)
  const binding = day.dayDesignBinding('central:day-die', READY_FACTS, values, {turn: async () => {}, openToday: async () => {}, closeNow: async () => {}}, OWN)
  const all = drawsOn(dayDesign, binding, /Wed 15 Oct|Read face 0 and propose tasks in three tiers|63 handoff returns/, [day.DAY_STANDING.verifyCloseout.disabled])
  assert.ok(all.includes(escaped(REAL.daySettings.data.effective_prompts.tasks)), 'Tasks\' Prompt is Central\'s own')
  assert.match(all, /not yet/, 'a pad\'s record says no run has ended today')
})

// ── Ground hygiene: Central's git census ─────────────────────────────────────────────────────────────────────────────────────────

test('REAL — the git census as the census reads a checkout list and a branch list: every worktree, main first; every branch and its checkout', () => {
  const lines = ground.censusLines(REAL.gitCensus.data)
  const trees = hygieneModel.parseWorktreeList(lines.worktrees)
  assert.deepEqual(trees.map(tree => [tree.path, tree.branch, tree.main]), REAL.gitCensus.data.repos[0].worktrees.map((tree, i) => [tree.path, tree.branch, i === 0]))
  assert.equal(trees[0].path, '/Users/admin/Central/Work/O-I', 'the primary checkout, git\'s main worktree, first')
  assert.ok(trees.every(tree => tree.head === null), 'the census reports no head, so none is written')
  const branches = hygieneModel.parseBranchRefs(lines.branches)
  assert.equal(branches.length, REAL.gitCensus.data.summary.branches)
  assert.deepEqual(branches.find(branch => branch.name === 'dlw/build'), {name: 'dlw/build', head: null, checkedOutAt: '/Users/admin/Central/worktrees/env-1/o-i'})
  assert.equal(ground.censusLines({schema: 'something-else'}), null)
})

test('the census reads once for both lists through invoke_action, names its boundary per list, and carries Central\'s refusal in its words', async () => {
  const owner = kernel({'central.git.census': REAL.gitCensus.data})
  const read = ground.hygieneMachineRead(bridge, true)
  const [trees, branches] = await withKernel(owner, async () => [await read('worktree-list'), await read('branch-refs')])
  assert.equal(owner.sent.length, 1, 'one census for both lists')
  assert.deepEqual(owner.sent[0], {op: 'invoke_action', invocation: {action: 'central.git.census', target_ref: 'central:action:central.git.census', input: {project: 'O-I'}}})
  assert.equal(trees.boundaryOp, 'central.git.census worktrees (invoke_action, project O-I)')
  assert.equal(branches.boundaryOp, 'central.git.census branches (invoke_action, project O-I)')
  assert.equal(trees.refused, undefined)
  const refusing = kernel({'central.git.census': {refuse: 'No eligible Connector implements GitState'}})
  // Another carrier, so the window's held census (one answer per op and carrier) is not this refusal.
  const refused = await withKernel(refusing, () => ground.hygieneMachineRead({kind: 'bridge', url: 'http://refusing.fixture'}, true)('worktree-list'))
  assert.equal(refused.refused, 'No eligible Connector implements GitState', 'the owner\'s words')
})

test('(e) Ground hygiene draws the census\'s checkouts in every view, the other readings refused in their words', async () => {
  const owner = kernel({'central.git.census': REAL.gitCensus.data})
  const read = await withKernel(owner, () => readHygieneCensus({transport: bridge, epoch: 'e', machineRead: ground.hygieneMachineRead(bridge, false)}))
  assert.deepEqual(read.census.worktrees.map(tree => tree.path), REAL.gitCensus.data.repos[0].worktrees.map(tree => tree.path))
  assert.ok(read.census.sources.some(source => source.boundaryOp.startsWith('central.git.census worktrees') && !source.refusal))
  const binding = groundBind.hygieneBinding(ground.HYGIENE_DEVICE_ID, {census: read.census, findings: read.findings, at: Date.UTC(2026, 9, 21, 9)}, Date.UTC(2026, 9, 21, 9), async () => {})
  const all = drawsOn(hygieneDesign, binding, /fold\/day-close-20261012|933731e|2026-10-15T09:12/)
  assert.ok(all.includes('worktrees/env-2/o-i') || all.includes('dlw/native-build'), 'a census worktree is drawn')
})

// ── Ground hygiene's Ground and Material pages (T-COVERAGE §1.3b) ──────────────────────────────────────────────────────────────

const PAGES = JSON.parse(readFileSync(new URL('./fixtures/ground-hygiene-pages-2026-10-21.json', import.meta.url), 'utf8'))
const OPS = ground.PAGE_OPS

test('REAL — the Ground page\'s readings as the model reads them: the root sound, O-I\'s scaffold whole, Point-Cloud-Demo\'s relations missing, O-I\'s candidates waiting', () => {
  const root = hygieneModel.rootOfDoctor(PAGES.doctor.data)
  assert.deepEqual([root.root, root.valid, root.checks.length, root.mixed.detected], ['/Users/admin/Central', true, 6, false])
  const oi = hygieneModel.scaffoldOfPlan(PAGES.reprojectOI.data)
  assert.deepEqual([oi.project, oi.present.length, oi.missing], ['O-I', 7, []])
  const pcd = hygieneModel.scaffoldOfPlan(PAGES.reprojectPointCloud.data)
  assert.deepEqual(pcd.missing, ['Work/Point-Cloud-Demo/ProjectCentral/relations'])
  const authored = hygieneModel.authoredOfInspection(PAGES.groundOI.data)
  assert.equal(authored.status, 'partial')
  assert.equal(authored.recognised.length, 7)
  assert.equal(authored.listed.length, 1650, 'every candidate the rule lists (of 6254 in the full reading)')
  assert.equal(PAGES.nativeCandidatesTotal, 6254)
  assert.ok(authored.listed.every(row => row.hints.some(hint => hygieneModel.WAITING_HINTS.includes(hint))))
  const findings = hygieneModel.groundFindings({root, scaffold: pcd, authored, ops: {root: OPS.root, scaffold: OPS.scaffold, authored: OPS.authored}})
  assert.equal(findings.filter(f => f.kind === 'root-part-missing' || f.kind === 'root-mixed').length, 0, 'a sound root has no finding')
  assert.deepEqual(findings.filter(f => f.kind === 'scaffold-missing').map(f => [f.subject, f.tenderId]), [['Work/Point-Cloud-Demo/ProjectCentral/relations', 'reproject-scaffold']])
  const waiting = findings.filter(f => f.kind === 'source-unrecognised')
  assert.equal(waiting.length, 1650)
  assert.ok(waiting.every(f => f.tenderId === 'recognise-source' && f.boundaryOps[0] === OPS.authored))
  assert.match(waiting.find(f => f.subject === 'docs/VISION.md')?.standing ?? '', /suggests vision/)
  assert.equal(hygieneModel.scaffoldOfPlan({schema: 'other'}), null)
})

test('FIXTURE — a root part not valid, a root mixed with a product, a binding stale or lost, a sandbox orphaned or unproven: each its kind and its tender', () => {
  const root = hygieneModel.rootOfDoctor({...PAGES.doctor.data, valid: false, checks: [{path: 'Control/machines', valid: false}, {path: 'Work', valid: true}],
    mixed_root: {detected: true, signals: ['.git', 'Cargo.toml']}})
  const g = hygieneModel.groundFindings({root, ops: {root: OPS.root, scaffold: OPS.scaffold, authored: OPS.authored}})
  assert.deepEqual(g.map(f => [f.kind, f.subject, f.tenderId]), [['root-part-missing', 'Control/machines', 'init-root'], ['root-mixed', '/Users/admin/Central', null]])
  const worlds = [{ref: 'world:a', bindings: [{ref: 'workspace:checkout', presence: 'stale'}, {ref: 'output:logs', presence: 'released'}, {ref: 'runtime:preview', presence: 'missing', persistence: 'ephemeral'},
    {ref: 'affordance:shell', presence: 'present'}]}]
  const sandboxes = {server: 'http://127.0.0.1:8090', sandboxes: [{id: 'sbx-1', lease: 'live'}, {id: 'sbx-2', lease: 'expired-orphan', expiresAt: '2026-10-20T18:00:00Z'}, {id: 'sbx-3', lease: 'unknown'}]}
  const m = hygieneModel.materialFindings({worlds, sandboxes, ops: {worlds: OPS.worlds, sandboxes: OPS.sandboxes}})
  assert.deepEqual(m.map(f => [f.kind, f.subject, f.tenderId]), [['binding-drift', 'world:a#workspace:checkout', 'reconcile-binding'], ['binding-lost', 'world:a#runtime:preview', null],
    ['sandbox-orphan', 'sbx-2', 'release-orphans'], ['sandbox-unproven', 'sbx-3', null]])
  for (const id of ['init-root', 'reproject-scaffold', 'recognise-source', 'reconcile-binding', 'release-orphans']) assert.ok(hygieneModel.HYGIENE_TENDERS.some(t => t.id === id), `${id} is declared`)
})

test('the pages read through invoke_action and the shared workcell answer; the sandboxes, with no sandbox server named, refused saying so', async () => {
  const actions = {'central.doctor': PAGES.doctor.data, 'central.world.reproject.plan': PAGES.reprojectOI.data, 'projectcentral.ground.inspect': PAGES.groundOI.data}
  const owner = kernel(actions)
  const fetchWithStatus = async (url, init) => {
    const body = JSON.parse(init.body)
    if (body.op === 'workcell_status_read') return {json: async () => ({ok: true, outcome: {result: 'workcell_status_reading', data: {workcell_ref: 'workcell:mac', persisted_world_receipts: PAGES.workcellStatus.persisted_world_receipts}}})}
    return owner.fetch(url, init)
  }
  const pages = await withKernel({fetch: fetchWithStatus}, () => ground.readHygienePages({kind: 'bridge', url: 'http://pages.fixture'}, 'e', true))
  assert.deepEqual(owner.sent.map(body => [body.invocation.action, body.invocation.input]),
    [['central.doctor', {}], ['central.world.reproject.plan', {project: 'O-I'}], ['projectcentral.ground.inspect', {project: 'O-I'}]])
  assert.equal(pages.root.valid, true)
  assert.deepEqual(pages.worlds, [], 'Workcell keeps no world receipt: no world, a reading')
  assert.equal(pages.sandboxes, undefined)
  assert.deepEqual(pages.sources.map(source => [source.boundaryOp, !!source.refusal]), [[OPS.root, false], [OPS.scaffold, false], [OPS.authored, false], [OPS.worlds, false], [OPS.sandboxes, true]])
  // REPLACED (lane K0): the kernel reads a named server's sandboxes (workcell_read sandboxes); none is named, and the refusal says so.
  assert.equal(pages.sources.at(-1).refusal, groundBind.NO_SANDBOX_SERVER)
  assert.equal(pages.findings.length, 1650, 'O-I: no scaffold missing, every listed candidate waiting')
})

test('(b)(c)(e) Ground hygiene draws the census and the pages in every view: every key classified, every tender disabled naming its route', async () => {
  const owner = kernel({'central.git.census': REAL.gitCensus.data, 'central.doctor': PAGES.doctor.data, 'central.world.reproject.plan': PAGES.reprojectPointCloud.data,
    'projectcentral.ground.inspect': PAGES.groundOI.data})
  const transport = {kind: 'bridge', url: 'http://pages-hygiene.fixture'}
  const read = await withKernel(owner, () => readHygieneCensus({transport, epoch: 'e', machineRead: ground.hygieneMachineRead(transport, false)}))
  const pages = await withKernel(owner, () => ground.readHygienePages(transport, 'e', false))
  const binding = groundBind.hygieneBinding(ground.HYGIENE_DEVICE_ID, {census: read.census, findings: read.findings, pages, at: Date.UTC(2026, 9, 21, 9)}, Date.UTC(2026, 9, 21, 9), async () => {})
  for (const key of designKeys(hygieneDesign)) assert.ok(groundBind.HYGIENE_WIRING.keys.includes(key), `${key} is wired`)
  for (const key of ['root', 'scaffold', 'authored']) assert.notEqual(binding.values[key], undefined, `${key}: Central's reading`)
  assert.equal(binding.values.sandboxes, undefined)
  assert.deepEqual([binding.values['as:provenance'], binding.values['as:standing'], binding.values['look:authored']], ['human-authored', 'design-commitment', true], 'the manual\'s defaults for the holds')
  for (const key of ['init', 'reproject', 'recognise']) {
    // W4: invoke_action carries the person for the presses action.rs PERSON_ACTS names; these are not among them.
    assert.match(binding.standing[key].disabled, /person's authority: .*PERSON_ACTS names, which do not include it/, key)
    await assert.rejects(binding.write([{key, value: 'x'}]), /PERSON_ACTS/)
  }
  assert.match(binding.standing.reconcile.disabled, /kernel route to Workcell/)
  // REPLACED (lane K0): Release orphans has its route (workcell_write release-orphans) and waits for a sandbox server named here.
  assert.match(binding.standing.orphans.disabled, /a sandbox server named to the shell/)
  const findings = JSON.parse(binding.values.findings)
  assert.ok(findings.some(f => f.kind === 'scaffold-missing') && findings.some(f => f.kind === 'source-unrecognised'))
  const fixture = /fold\/day-close-20261012|933731e|2026-10-15T09:12|sbx-3b17|world:demand:factory-attempt/
  drawsOn(hygieneDesign, binding, fixture)
  // The Ground and Material pages, as the host turns to them (deviceHost.setHostPage).
  host.setHostPage(binding.id, 'ground')
  const onGround = drawsOn(hygieneDesign, binding, fixture)
  assert.ok(onGround.includes('ProjectCentral/relations'), 'the missing scaffold part is drawn')
  host.setHostPage(binding.id, 'material')
  const onMaterial = drawsOn(hygieneDesign, binding, fixture, [groundBind.NO_SANDBOX_SERVER])
  assert.doesNotMatch(onMaterial, /sbx-/, 'no sandbox is drawn: none was read')
  host.resetHost(binding.id)
})

// ── Beings and Things: the ties through the page op ─────────────────────────────────────────────────────────────────────────────

const BEING = {profile: 'oi.page/v1', meta: {documentId: null, created: null, title: 'Cairn', revision: 3, family: 'beings', template: 'oi.template/beings', templateVersion: '0.1.0', sourceMode: 'authored'},
  bindings: {worldRef: 'control:root', subjectRef: 'cairn', kind: 'agent', categories: ['C2'], expressionRef: null, placeRef: null,
    sources: [{ref: 'central:source:control:root:Control/self/agents/cairn/self.md', revision: 'sha256:abc'}, {ref: 'central:source:control:root:Control/self/agents/relational-logos.md', revision: 'sha256:def'}]},
  appearance: {layout: 'portrait', tone: 'paper'}, page: {subtitle: '', introduction: '', sections: [{id: 's1', heading: '', text: ''}], links: [], expression: null}, notes: [], extensions: {}}

test('FIXTURE — a Being\'s ties write through the page op on the revision read: a ref, a kind, the offices that stay, a tone, a source dropped', async () => {
  const sent = []
  const hand = {write: async (field, value) => { sent.push([field, value]) }, worlds: [{value: 'control:root', label: 'Your world'}]}
  const binding = pages.beingsBinding('central:beings', BEING, hand)
  assert.deepEqual([binding.values.kind, binding.values.place, binding.values.world, binding.values.subject], ['agent', '', 'control:root', 'cairn'])
  assert.equal(binding.values.worlds, JSON.stringify(hand.worlds))
  await binding.write([{key: 'world', value: 'project:O-I'}, {key: 'subject', value: ''}, {key: 'kind', value: 'person'}, {key: 'o1', value: true},
    {key: 'ground', value: 'ink'}, {key: 'layout', value: 'editorial'}, {key: 'expression', value: 'sf1-walk'}, {key: 'place', value: 'O-I'},
    {key: 'dropSource', value: 'central:source:control:root:Control/self/agents/relational-logos.md'}])
  assert.deepEqual(sent, [['world', 'project:O-I'], ['subject', null], ['kind', 'person'], ['office', ['C1', 'C2']], ['tone', 'ink'], ['layout', 'editorial'],
    ['expression', 'sf1-walk'], ['place', 'O-I'], ['sources', [{ref: 'central:source:control:root:Control/self/agents/cairn/self.md', revision: 'sha256:abc'}]]])
  await assert.rejects(binding.write([{key: 'o2', value: false}]), /the last one stays/)
  await assert.rejects(binding.write([{key: 'addSource', value: true}]), /browser's selection is not handed/)
  await assert.rejects(binding.write([{key: 'anchor', value: 'zurich'}]), /point on Earth/)
  assert.equal(sent.length, 9, 'no refusal reached the owner')
  const things = pages.thingsBinding('central:things', {...BEING, meta: {...BEING.meta, family: 'things'}}, hand)
  assert.equal(things.writes('kind'), false, 'a Thing has no kind')
})

test('a Being with no page read with its revision: every tie stands disabled saying so; (b) every design key classified', () => {
  for (const [design, wiring, readWiring] of [[beingsDesign, pages.BEINGS_WIRING, pages.BEINGS_READ_WIRING], [thingsDesign, pages.THINGS_WIRING, pages.THINGS_READ_WIRING]]) {
    for (const w of [wiring, readWiring]) for (const key of designKeys(design)) {
      assert.ok(w.keys.includes(key), `${design.id}: ${key} is wired`)
      assert.ok([w.reads, w.writes, w.local, w.refused, w.absent].some(table => key in table), `${design.id}: ${key} is read, written, held, refused or absent`)
    }
  }
  const binding = pages.beingsBinding('central:beings', BEING)
  for (const key of ['world', 'subject', 'kind', 'o1', 'layout', 'ground', 'dropSource']) assert.match(binding.standing[key].disabled, /page op mutate_field.*no page is read here/, key)
})

test('(e) Beings and Things draw their designs on the page\'s ties in every view, never the design\'s sample', () => {
  const hand = {write: async () => {}}
  drawsOn(beingsDesign, pages.beingsBinding('central:beings', BEING, hand), /C\. G\. Jung|Zürich|e3273bc0d9af/, [pages.BEINGS_READ_WIRING.refused.addSource])
  drawsOn(thingsDesign, pages.thingsBinding('central:things', {...BEING, meta: {...BEING.meta, family: 'things'}}), /e3273bc0d9af|field\.json/)
})

// ── Runs: the take lanes' attempts; Stands through AttemptReceiving ──────────────────────────────────────────────────────────────

const take = (attemptRef, n, extra = {}) => ({sessionRef: 'agent-session/s1', attemptRef, runRef: 'run:R1', statePath: '/factory/state', taskRef: 'task:1', unit: 'inspect-source',
  state: 'returned', startUnixMs: Date.UTC(2026, 9, 21, 8, n * 10), endUnixMs: Date.UTC(2026, 9, 21, 8, n * 10 + 7), summary: `attempt ${n}`, receivingRef: null, ...extra})
const TAKES = [take('att:2', 2, {receivingRef: 'central:receiving:x'}), take('att:1', 1, {state: 'failed', summary: null}), take('att:3', 3, {state: 'running', endUnixMs: null})]

test('FIXTURE — Runs reads the session\'s takes: its Run, the attempts oldest first, the one Central received standing; Stands writes through AttemptReceiving', async () => {
  chainBind.resetHolds()
  const chosen = []
  const runs = {takes: TAKES, choose: async t => { chosen.push(t.attemptRef); return t.attemptRef === 'att:3' ? {ok: false, error: 'the attempt has not returned'} : {ok: true, note: 'proposed'} }, timezone: 'Europe/London'}
  const values = tasks.runsValues('agent-session/s1', chainBind.chainHolds(), runs)
  assert.deepEqual(JSON.parse(values.works), [{id: 'run:R1', name: 'inspect-source'}])
  const attempts = JSON.parse(values.attempts)
  assert.deepEqual(attempts.map(a => [a.id, a.n, a.state, a.current, a.at, a.seen ?? null]), [['att:1', 1, 'failed', false, '09:10', 7], ['att:2', 2, 'done', true, '09:20', 7], ['att:3', 3, 'running', false, '09:30', null]])
  assert.equal(values.stands, 'att:2', 'the attempt whose Return Central received stands')
  const binding = tasks.runsBinding('agent-session/s1', chainBind.chainHolds(), runs)
  assert.equal(binding.standing.stands, undefined, 'Stands acts')
  await binding.write([{key: 'stands', value: 'att:1'}])
  await assert.rejects(binding.write([{key: 'stands', value: 'att:3'}]), /has not returned/, 'Factory\'s refusal in its words')
  await assert.rejects(binding.write([{key: 'stands', value: 'none'}]), /nothing un-stands an attempt/)
  await assert.rejects(binding.write([{key: 'stands', value: 'att:9'}]), /no attempt of the session's takes/)
  assert.deepEqual(chosen, ['att:1', 'att:3'])
  assert.match(tasks.runsBinding('agent-session/s1', chainBind.chainHolds(), {...runs, takes: null}).standing.stands.disabled, /names no Factory attempt/)
  chainBind.resetHolds()
})

test('(e) Runs draws its design on the takes in every view, never the design\'s sample; without takes Stands says why', () => {
  chainBind.resetHolds()
  host.resetHost()
  const runs = {takes: TAKES, choose: async () => ({ok: true}), timezone: 'Europe/London'}
  const all = drawsOn(runsDesign, tasks.runsBinding('agent-session/s1', chainBind.chainHolds(), runs), /01ARZ3NDEKTSV4RRFFQ69G5FAA|3\.4\.2|All three roots type-check/)
  assert.match(all, /#2/, 'an attempt is drawn')
  drawsOn(runsDesign, tasks.runsBinding('agent-session/s1', chainBind.chainHolds()), /01ARZ3NDEKTSV4RRFFQ69G5FAA|3\.4\.2/, [tasks.RUNS_REFUSE.stands])
  for (const key of designKeys(runsDesign)) {
    const values = tasks.runsValues('agent-session/s1', chainBind.chainHolds(), runs)
    const classified = key in values || ['light', 'journey', 'collected', 'collect', 'task', 'standsPending', 'stands', 'attempt'].includes(key)
    assert.ok(classified, `${key}: a reading, a hold, or absent`)
  }
  chainBind.resetHolds()
})

// ── Scope: the world's effective sources ─────────────────────────────────────────────────────────────────────────────────────────

const SCOPE_INPUT = {answer: {bound: true, session: 'agent-session/nara'}, horizon: {state: 'ready', data: {sources: [], changes: [], world_ref: 'control:root'}}, groundError: null,
  document: 'Day', packet: {items: 2, session: 'agent-session/nara'}, effective: {status: 'answered', value: REAL.effectiveSources.data}}

test('REAL — Scope\'s reads are the world\'s effective sources, each a place on the Central ring; a write place has no field in the world\'s relations', async () => {
  const places = world.effectivePlacesOf(REAL.effectiveSources.data)
  assert.deepEqual(places.map(place => [place.name, place.ring]), [['Control/agents', 3], ['Control/relations', 3], ['Control/user/identity', 3]])
  assert.match(places[2].path, /canonical · from control:root/)
  const binding = world.centralScopeBinding(world.CENTRAL_SCOPE_ID, SCOPE_INPUT)
  assert.deepEqual(JSON.parse(binding.values.reads).map(place => place.id), ['packet', ...REAL.effectiveSources.data.sources.map(source => source.ref)])
  const w = `w:${REAL.effectiveSources.data.sources[0].ref}`
  // REPLACED (W2): a read place's include or exclude saves through central.world-relations.save (central-person-writes.test.mjs); a write
  // place has no field in the world's relations.
  assert.match(binding.standing[w].disabled, /missing op: the session's writable places/)
  await assert.rejects(binding.write([{key: w, value: false}]), /missing op/)
  // Unanswered, or refused: as before, the change horizon's count stands as one place.
  const before = world.centralScopeBinding(world.CENTRAL_SCOPE_ID, {...SCOPE_INPUT, effective: {status: 'refused', error: 'x'}})
  assert.deepEqual(JSON.parse(before.values.reads).map(place => place.id), ['packet', 'world'])
})

test('(e) Scope draws the effective sources in every view, never the design\'s sample', () => {
  const all = drawsOn(scopeDesign, world.centralScopeBinding(world.CENTRAL_SCOPE_ID, SCOPE_INPUT), /Lantern \(object\)|Tidal \(Expression\)|r15 → r17/)
  assert.ok(all.includes('Control/user/identity'), 'a source is drawn by its path')
})

// ── Wiki: the page's links from Central's wiki reading ───────────────────────────────────────────────────────────────────────────

test('REAL — the wiki\'s relations as the page\'s links: placed where the text names the target word for word; resolved only for another page', () => {
  const node = 'wiki:node:identity'
  assert.deepEqual(rail.wikiLinksOf(REAL.wiki.data, node, ['# User identity', 'The owner of this world.']), [], 'the real page names none of its targets: no link is drawn')
  assert.deepEqual(rail.wikiLinksOf(REAL.wiki.data, node, ['Read Control/user/identity.md first.']),
    [{line: 0, from: 5, to: 29, target: 'Control/user/identity.md', state: 'external'}], 'FIXTURE line: the source it cites, external')
  const source = 'central:source:control:root:Control/agents/wiki/returns/ta-onta-and-the-thought-stream-2026-09-16.md'
  assert.deepEqual(rail.wikiLinksOf(REAL.wiki.data, 'wiki:node:root/ta-onta-and-the-thought-stream', ['see Control/agents/wiki/returns/ta-onta-and-the-thought-stream-2026-09-16.md']),
    [{line: 0, from: 4, to: 4 + source.split(':').pop().length, target: source, state: 'external'}], 'a central:source ref named by its path')
  const linked = {...REAL.wiki.data, relations: [...REAL.wiki.data.relations, {from_ref: node, kind: 'node-node', to_ref: 'wiki:node:staged/propose-not-write'}]}
  assert.equal(rail.wikiLinksOf(linked, node, ['then wiki:node:staged/propose-not-write'])[0].state, 'resolved', 'FIXTURE relation: another page resolves')
})

test('(e) the Wiki draws a page with its links in both its views, never the design\'s sample', () => {
  const pages_ = JSON.stringify(REAL.wiki.data.nodes.map(node => ({ref: node.ref, title: node.title, type: node.node_type})))
  const lines = ['Read Control/user/identity.md first.']
  const binding = {id: 'widgets:wiki', values: {pages: pages_, page: 'wiki:node:identity', body: JSON.stringify({lines, links: rail.wikiLinksOf(REAL.wiki.data, 'wiki:node:identity', lines)})}, local: {}}
  const all = drawsOn(wikiDesign, binding, /Seat guard: use seats|Shared seat: neighbours commit/)
  assert.ok(all.includes('Control/user/identity.md|'), 'the link is drawn on its words')
})

// ── Search: control.search for Your world ────────────────────────────────────────────────────────────────────────────────────────

test('REAL refusal and FIXTURE match — Your world asks control.search: a match is a Control document; Central\'s refusal is said on Reach', () => {
  pages.resetHolds()
  pages.setHeld('central:search', 'query', 'day')
  const answer = {query: 'day', hits: [], rows: [], pending: []}
  const matched = search.searchBinding('central:search', {...answer, control: {status: 'answered', value: {query: 'day', roots: [], files_scanned: 1, skipped_sources: [],
    matches: [{target: 'user', source_path: 'Control/user/day/2026-10-19/day.md', line: 12, text: '  The day closes. ', source_class: 'authored'}]}}}, null)
  assert.deepEqual(JSON.parse(matched.values.results), [{ref: 'Control/user/day/2026-10-19/day.md:12', title: 'day.md', kind: 'document', says: 'The day closes.', owner: 'Control'}])
  assert.equal(matched.values.light, 'lit')
  const refused = search.searchBinding('central:search', {...answer, control: {status: 'refused', error: REAL.controlSearch.envelope.error.message}}, null)
  assert.equal(refused.standing.reach.refused, 'Your world\'s Control documents: Central did not search them — Native source exceeds the 4 MiB eager read capacity')
  assert.equal(search.controlResultsOf({nothing: true}), null)
  pages.resetHolds()
})

test('(e) Search draws Central\'s refusal and its matches in every view, never the design\'s sample', () => {
  pages.resetHolds()
  pages.setHeld('central:search', 'query', 'day')
  const binding = search.searchBinding('central:search', {query: 'day', hits: [], rows: [], pending: [], control: {status: 'refused', error: REAL.controlSearch.envelope.error.message}}, null)
  drawsOn(searchDesign, binding, /A completion claim without executed evidence|agent:flint/, [binding.standing.reach.refused])
  pages.resetHolds()
})

// ── a page's takes: its revisions ────────────────────────────────────────────────────────────────────────────────────────────────

test('REAL — a page\'s revisions over its day lie as take lanes under its world\'s track, the one that stands marked', () => {
  const todayStart = Date.UTC(2026, 9, 19)
  const minuteOf = ms => (ms < todayStart || ms >= todayStart + 86_400_000 ? null : Math.round((ms - todayStart) / 60000))
  const page = {path: 'Control/user/day/2026-10-19/day.md', title: 'Day', world: 'central:wiki:root'}
  const nowMs = Date.UTC(2026, 9, 19, 23, 0)
  const takes = adapter.pageTakesOf(page, REAL.sourceHistory.data, minuteOf, todayStart, nowMs)
  const entries = [...REAL.sourceHistory.data.entries].sort((a, b) => a.recorded_at_unix_seconds - b.recorded_at_unix_seconds)
  assert.equal(takes.length, entries.length, 'each save of the day a take')
  assert.deepEqual(takes.map(t => t.id), entries.map(entry => `${page.path}@${entry.revision}`))
  assert.ok(takes.every(t => t.trackId === adapter.centralWorldTrackId('central:wiki:root')))
  assert.deepEqual(takes.filter(t => t.standing).map(t => t.id), [`${page.path}@${REAL.sourceHistory.data.revision.revision}`], 'the revision that stands now')
  for (let i = 0; i + 1 < takes.length; i++) assert.equal(takes[i].spans[0].end, takes[i + 1].spans[0].start, 'each stands until the next save')
  assert.equal(takes.at(-1).spans[0].end, 23 * 60, 'the one that stands, until now')
  assert.match(takes[0].spans[0].label, /^revision [0-9a-f]{8} · saved by a human$/)
  assert.deepEqual(adapter.pageTakesOf(page, REAL.sourceHistory.data, minuteOf, Date.UTC(2026, 9, 25), nowMs), [], 'none of them stood on another day')
  assert.deepEqual(adapter.pageSourceRef({project: null}, 'Control/user/flows/f.html'), {sourceRef: 'central:source:control:root:Control/user/flows/f.html'})
  assert.deepEqual(adapter.pageSourceRef({project: 'Archetypal-Earth'}, 'Work/Archetypal-Earth/ProjectCentral/user/p.html'),
    {sourceRef: 'central:source:project:Archetypal-Earth:ProjectCentral/user/p.html', project: 'Archetypal-Earth'})
  assert.equal(adapter.pageSourceRef({project: 'O-I'}, 'Control/user/x.html'), null)
})

test('the takes reach the arrangement\'s lanes; a refusal is said where none stands', () => {
  const page = {name: 'day.md', title: 'Day', form: 'page', revision: 'r', world: 'central:wiki:root',
    location: {schema: 'central.path-ref/v1', ref: 'native:path', root: '/c', path: 'Control/user/day/2026-10-19/day.md'}}
  const base = {civil: {state: 'unavailable', reason: 'x'}, worlds: {state: 'read', worlds: [{ref: 'central:wiki:root', name: 'Your world', kind: 'yours', folder: 'Control/user/day/2026-10-19', project: null}]},
    set: {state: 'read', civilDate: '2026-10-19', set: {tracks: [], rows: []}}, pages: new Map([['central:wiki:root', {state: 'read', listing: {schema: 'oi.page-list/v1', path: 'x', more: false, pages: [page], not_pages: []}}]])}
  const set = adapter.projectCentralTracks({...base, histories: new Map([[page.location.path, {state: 'read', history: REAL.sourceHistory.data}]]), nowMs: Date.UTC(2026, 9, 19, 23)})
  assert.equal(set.lanes.takes.length, REAL.sourceHistory.data.entries.length)
  assert.equal(set.lanes.absent.takes, undefined)
  const refused = adapter.projectCentralTracks({...base, histories: new Map([[page.location.path, {state: 'refused', reason: 'SourceRef is not in this World'}]])})
  assert.equal(refused.lanes.absent.takes, 'Revisions as take lanes: Central did not read a page\'s history — SourceRef is not in this World')
})

// ── Diff: the selected seat ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('REAL — the Diff follows the seat selected on the Seat device: its checkout as the census names seats, its live branch and head', () => {
  assert.deepEqual(rail.selectedSeatOf({seat: 'env-1', product: 'o-i'}, SEATS),
    {root: '/Users/admin/Central/worktrees/env-1/o-i', branch: 'dlw/build', head: SEATS.workcells[0].seats.find(seat => seat.product === 'o-i').live_head})
  assert.equal(rail.selectedSeatOf({seat: 'env-2', product: 'o-i'}, SEATS).branch, 'dlw/native-build')
  assert.equal(rail.selectedSeatOf({seat: 'env-9', product: 'o-i'}, SEATS), null, 'a seat the instrument does not hold')
  assert.equal(rail.selectedSeatOf(undefined, SEATS), null, 'no seat selected: the shell\'s project, as before')
})

test('the bindings read no design default or fixture, and carry no colour of their own', () => {
  for (const file of ['central/devices/dayBinding.ts', 'central/devices/groundDevices.ts', 'central/devices/searchBinding.ts', 'central/devices/contextWorldBinding.ts',
    'agent/devices/taskBindings.ts', 'timeline/centralTrackAdapter.ts']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /\.defaults\[|\.fixtures\b|from '[^']*catalogue\/panels\//, `${file}: no design default or fixture`)
  }
})
