// O-I #740 lane B: every reading names the world's scope, never a literal project; the Seat page draws only the workcell's own seats.
//
// Channels, each claim carried by one:
// - REAL (29 Oct 2026, a private walk-bridge entered into a scratch world whose one project is `first-project`, the candidate's frozen
//   owners): `agency_read` with "" answered project_ref `control:root`, with "first-project" answered `first-project`, with "O-I" refused
//   "Project is outside Central's disclosed ground"; `world_browse` disclosed work.projects [first-project]. The fixture kernel below
//   answers in those shapes and refuses a project the world does not disclose in those words.
// - PURE: agent/worldScope.ts's mappings.
// - SCRIPTED: Git / landing's design drawn on its Seat page through the runtime's host (deviceHost.HostedDevice), to static markup.
// - CODE-READING: the sites the walk named carry no literal project.
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
  if(url.includes('?raw')||url.endsWith('.html'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const scope = await import('../src/agent/worldScope.ts')
const {createOwnerReadings} = await import('../src/owners/ownerReading.ts')
const family = await import('../src/inhabitants/familyManifest.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const model = await import('../src/agent/devices/agentChainDevices.ts')
const bind = await import('../src/agent/devices/designBindings.ts')
const cell = await import('../src/agent/devices/workcellBindings.ts')
const {design: gitDesign, NO_SEATS} = await import('../src/inhabitants/catalogue/panels/workcell__git-seat.tsx')
const {SEAT_PAGE, carryPages} = await import('../src/agent/devices/oneAgentBinding.ts')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const answered = (value, at = 1, epoch = '1|w') => ({status: 'answered', value, error: null, readAtUnixMs: at, epoch, refreshing: false, carried: false})
const refused = (error, epoch = '1|w') => ({status: 'refused', value: null, error, readAtUnixMs: 2, epoch, refreshing: false, carried: false})
const row = (sessionRef, spaceRef, projects) => ({spaceRef, sessionRef, raw: {definition: {id: spaceRef, projects}}})

// ---- the world's registers ---------------------------------------------------------------------------------------------------------

test('PURE — the world\'s registers: the root first, then each project Central discloses; none while the world is read', () => {
  assert.deepEqual(scope.projectsOf({work: {projects: [{name: 'first-project'}, {name: 'field-notes'}, {name: 'first-project'}, {}]}}), ['first-project', 'field-notes'])
  assert.deepEqual(scope.projectsOf(null), [])
  assert.equal(scope.scopesOf({status: 'reading', value: null}), null)
  assert.deepEqual(scope.scopesOf({status: 'answered', value: ['first-project']}), ['', 'first-project'])
  assert.deepEqual(scope.scopesOf({status: 'answered', value: []}), [''], 'a world with no project: its root register alone')
  assert.deepEqual(scope.scopesOf({status: 'refused', value: null}), [''], 'a world Central could not disclose is read in its root, which says why')
  assert.equal(scope.registerOf(''), null)
  assert.equal(scope.registerOf('first-project'), 'first-project')
  assert.equal(scope.placeWord(''), 'your world')
})

test('PURE — the world\'s agency: every register\'s sessions once, each with the register it was read under; refusals named, never dropped', () => {
  const merged = scope.mergeAgency([
    {project: '', reading: answered({projectRef: 'control:root', rows: [row('ses-root', 'space:lilt', ['control:root'])]}, 5)},
    {project: 'first-project', reading: answered({projectRef: 'first-project', rows: [row('ses-1', 'space:f', ['first-project']), row('ses-root', 'space:lilt', ['control:root', 'first-project'])]}, 3)},
  ], '1|w')
  assert.deepEqual(merged.rows.map(r => [r.sessionRef, r.project]), [['ses-root', ''], ['ses-1', 'first-project']], 'a space two registers list rides the first')
  assert.deepEqual([merged.error, merged.loading, merged.readAtUnixMs], [null, false, 3], 'the earliest answer is the reading\'s instant')
  const partly = scope.mergeAgency([{project: '', reading: refused('Central root location unavailable')}, {project: 'first-project', reading: answered({rows: []})}], '1|w')
  assert.equal(partly.error, 'Central root location unavailable')
  const both = scope.mergeAgency([{project: '', reading: refused('a')}, {project: 'first-project', reading: refused('b')}], '1|w')
  assert.equal(both.error, 'your world: a; first-project: b', 'several refusals, each named by its place')
  const foreign = scope.mergeAgency([{project: '', reading: answered({rows: [row('ses-x', 's', [])]}, 1, '1|other')}], '1|w')
  assert.deepEqual([foreign.rows, foreign.loading], [[], true], 'an answer of another world is never drawn')
  assert.equal(scope.mergeAgency([], null, false).loading, true, 'the world itself still being read')
})

test('PURE — a session\'s own readings ask its register; a repository reading says why it cannot be asked', () => {
  const rows = [{sessionRef: 'ses-1', project: 'first-project'}, {sessionRef: 'ses-root', project: ''}]
  assert.equal(scope.projectOfSession(rows, 'ses-1'), 'first-project')
  assert.equal(scope.projectOfSession(rows, 'ses-root'), '')
  assert.equal(scope.projectOfSession(rows, null), '', 'no session: the root register')
  assert.equal(scope.gitRepositoryAbsence(null, ''), scope.NO_SESSION)
  assert.equal(scope.gitRepositoryAbsence('ses-root', ''), scope.ROOT_KEEPS_NO_REPOSITORY)
  assert.equal(scope.gitRepositoryAbsence('ses-1', 'first-project'), null)
})

// ---- the owner asked for the world, never for a named project -----------------------------------------------------------------------

/** A kernel in the shapes the scratch world answered (REAL, 29 Oct): its one project `first-project`; any other is outside its ground. */
function worldKernel(projects) {
  const sent = []
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    if (body.op === 'world_browse') return {json: async () => ({ok: true, outcome: {result: 'world_read', snapshot: {navigator: {root: {work: {projects: projects.map(name => ({name, path: `Work/${name}`}))}}, error: null}}}})}
    if (body.op === 'agency_read') {
      if (body.project !== '' && !projects.includes(body.project)) return {json: async () => ({ok: false, error: 'Project is outside Central\'s disclosed ground'})}
      const ref = body.project || 'control:root'
      const spaces = [{definition: {id: `space:${ref}`, projects: [ref]}, label: ref, agent_sessions: {[`ses-${ref}`]: {purpose: `work in ${ref}`}}}]
      return {json: async () => ({ok: true, outcome: {result: 'agency_reading', project_ref: ref, spaces, harness_disclosure: null, observed_at_unix_ms: 1}})}
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

test('REAL-shaped — a world whose one project is first-project: its root register and first-project are asked, O-I never; no refusal', async () => {
  const owner = worldKernel(['first-project'])
  const transport = {kind: 'bridge', url: 'http://t740-first-project.fixture'}
  const agency = await withKernel(owner, () => scope.readWorldAgency(transport, 'w|1', createOwnerReadings()))
  const asked = owner.sent.filter(body => body.op === 'agency_read').map(body => body.project)
  assert.deepEqual(asked, ['', 'first-project'])
  assert.equal(agency.error, null, 'no "outside Central\'s disclosed ground" anywhere')
  assert.deepEqual(agency.rows.map(r => [r.sessionRef, r.project]), [['ses-control:root', ''], ['ses-first-project', 'first-project']])
  // A world with no project: its root register alone, its sessions, or none, said by the reading (no refusal).
  const bare = worldKernel([])
  const none = await withKernel(bare, () => scope.readWorldAgency({kind: 'bridge', url: 'http://t740-bare.fixture'}, 'w|1', createOwnerReadings()))
  assert.deepEqual(bare.sent.filter(body => body.op === 'agency_read').map(body => body.project), [''])
  assert.equal(none.error, null)
  // The owner's own world, where O-I is a project: O-I's sessions are read as before, now beside the root register's.
  const yours = worldKernel(['Actuation', 'O-I'])
  const own = await withKernel(yours, () => scope.readWorldAgency({kind: 'bridge', url: 'http://t740-yours.fixture'}, 'w|1', createOwnerReadings()))
  assert.deepEqual(own.rows.map(r => r.project), ['', 'Actuation', 'O-I'])
})

// ---- the Seat page: the workcell's own seats ------------------------------------------------------------------------------------

test('SCRIPTED — the Seat page draws only the seats Workcell reads: none read, or none reported, is said in words, never env-1, env-2, env-3', () => {
  bind.resetHolds()
  host.resetHost()
  const git = {...model.INITIAL_READING, gitAdmitted: true, gitRepo: {branch: 'main', uncommitted: 0}}
  const carrying = seat => carryPages(cell.gitBinding(git, bind.chainHolds()), [{page: SEAT_PAGE, binding: seat}])
  const views = ['folded', 'compact', 'whole', 'full', 'widget']
  const draw = binding => {
    host.resetHost(binding.id)
    host.setHostPage(binding.id, 'seat')
    return views.map(view => renderToStaticMarkup(createElement(host.HostedDevice, {designed: gitDesign, binding, view, nav: {}}))).join('\n')
  }
  const unread = draw(carrying(cell.seatBinding({status: null, project: 'first-project', branch: null, holds: bind.chainHolds()})))
  assert.doesNotMatch(unread, /env-[123]/, 'no seat name the panel keeps of its own')
  assert.match(unread, /No reading of the seats\./)
  const empty = draw(carrying(cell.seatBinding({status: {schema: 'central.workcell-status/v1', workcells: []}, project: 'first-project', branch: null, holds: bind.chainHolds()})))
  assert.doesNotMatch(empty, /env-[123]/)
  assert.ok(empty.includes(NO_SEATS.replace(/'/g, '&#x27;')), 'a workcell that reports no seat says so')
  assert.doesNotMatch(read('inhabitants/catalogue/panels/workcell__git-seat.tsx'), /SEAT_NAMES/, 'no fixed seat names in the product')
  bind.resetHolds()
  host.resetHost()
})

// ---- no literal project at the sites the walk named ---------------------------------------------------------------------------------

test('CODE-READING — the readings the walk named carry no literal project; the world\'s scope is read', () => {
  const sites = ['agent/useAgencySessions.ts', 'agent/AgentSessionsProvider.tsx', 'agent/AgentThreadView.tsx', 'agent/AgentDockTileBody.tsx', 'agent/clipBinding.ts',
    'agent/devices/EncounterObserver.tsx', 'agent/devices/useAgentChainReading.ts', 'agent/devices/useRackReading.ts', 'central/devices/groundDevices.ts',
    'components/NativeContextPanel.tsx', 'inhabitants/CentralHygieneDevice.tsx', 'native/expressionOwners.ts', 'inhabitants/ql/devices/skyPresences.ts',
    'inhabitants/ql/devices/qlM3Clock.ts', 'panels/expressions.tsx', 'owners/readers.ts', 'projections/useWorldTemporalReading.ts', 'widgets/agentConversation.ts',
    'widgets/railDevices.tsx', 'projections/atlas/palaces/palaceOwners.ts', 'widgets/AgentWidget.tsx', 'widgets/PacketWidget.tsx', 'shell/transports/useCentralTransport.tsx',
    'frame/tracks/useFactoryTracks.ts']
  for (const site of sites) assert.doesNotMatch(read(site), /(project|PROJECT)\b[^\n]{0,24}['"]O-I['"]/, `${site}: no literal project`)
  assert.match(read('agent/AgentSessionsProvider.tsx'), /useWorldAgencyEntries\(transport\)/, 'the provider reads the world\'s agency')
  assert.match(readFileSync(new URL('../../../../desktop/cradle/src/nara/answerThis.ts', import.meta.url), 'utf8'), /export const NARA_CHANNEL_PROJECT = "";/)
})

// ---- round two: Central's Approvals in the selected world; the census never silent on a partial refusal ----------------------------

test('PURE — a world\'s register: a project\'s world its project, your world the root (null); each observed session in its own register', () => {
  assert.equal(scope.worldRegisterOf({kind: 'project', project: 'first-project'}), 'first-project')
  assert.equal(scope.worldRegisterOf({kind: 'yours', project: null}), null, 'your world: the root register')
  assert.equal(scope.worldRegisterOf(null), null, 'no world selected: your own')
  // The Nara conversation in the register its dialogue was looked up in; the packet's session in the register its agency read listed it.
  assert.deepEqual(scope.observedSessionsOf({session: 'ses-nara', space: 'space:n', project: ''}, {ref: 'ses-1', space: 'space:f', project: 'first-project'}),
    [{ref: 'ses-nara', space: 'space:n', project: ''}, {ref: 'ses-1', space: 'space:f', project: 'first-project'}])
  assert.deepEqual(scope.observedSessionsOf(null, {ref: 'ses-1', space: 'space:f'}), [{ref: 'ses-1', space: 'space:f', project: ''}], 'a track no world-wide read placed: the root')
  assert.deepEqual(scope.observedSessionsOf({session: 'ses-1', space: 'space:f', project: ''}, {ref: 'ses-1', space: 'space:f', project: 'first-project'}),
    [{ref: 'ses-1', space: 'space:f', project: ''}], 'one session observed once')
  assert.deepEqual(scope.observedSessionsOf(null, null), [])
})

test('CODE-READING — Central\'s Approvals read and act in the selected world\'s register; its observed sessions carry theirs', () => {
  const central = read('central/devices/CentralDevices.tsx')
  assert.doesNotMatch(central, /APPROVALS_PROJECT|RACK_PROJECT/, 'no fixed register')
  assert.match(central, /const approvalsRegister = worldRegisterOf\(selectedWorld\)/)
  // REPLACED (round three): the returns of the one register asked, and the acts in it; your world now reads every project's, and each
  // act goes to its row's own project (the round-three tests below).
  assert.match(central, /useWorldReturns\(transport, approvalsRegister\)/)
  assert.match(central, /acceptSourceReturn\(transport, returnProjectOf\(row, approvalsRegister\), row, person\)/)
  assert.match(central, /observedSessionsOf\(/, 'the observed sessions, each in its register')
})

/** A kernel answering Central's git census for the projects in `answers`, and refusing the others in Central's words. */
function censusKernel(answers) {
  const sent = []
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    if (body.op === 'invoke_action' && body.invocation.action === 'central.git.census') {
      const project = body.invocation.input.project
      const data = answers[project]
      return {json: async () => ({ok: true, outcome: {result: 'action_dispatched', dispatch: data
        ? {state: 'invoked', owner_operation: 'central.git.census', data}
        : {state: 'owner_refused', owner_operation: 'central.git.census', message: `Not a git repository: Work/${project}`}}})}
    }
    return {json: async () => ({ok: false, error: `the fixture kernel answers no ${body.op}`})}
  }
  return {sent, fetch}
}

test('SCRIPTED — the census names each project that refused, by name and in its words, beside the lists of those that answered', async () => {
  const ground = await import('../src/central/devices/groundDevices.ts')
  const {readHygieneCensus} = await import('../src/inhabitants/CentralHygieneDevice.tsx')
  const census = {schema: 'central.git-census/v1', repos: [{worktrees: [{path: '/w/Bare/Central/Work/field-notes', branch: 'main'}], branches: [{name: 'main', checked_out_in: ['/w/Bare/Central/Work/field-notes']}]}]}
  const owner = censusKernel({'field-notes': census})
  const transport = {kind: 'bridge', url: 'http://t740-partial-census.fixture'}
  const read = ground.hygieneMachineRead(transport, true, ['field-notes', 'first-project'])
  const trees = await withKernel(owner, () => read('worktree-list'))
  assert.match(trees.stdout, /field-notes/, 'the lists of the project that answered')
  assert.equal(trees.refused, undefined, 'one project answered: the reading stands')
  assert.deepEqual(trees.partial, [{boundaryOp: 'central.git.census worktrees (invoke_action, project first-project)', refusal: 'Not a git repository: Work/first-project'}])
  assert.equal(trees.boundaryOp, 'central.git.census worktrees (invoke_action, project field-notes)', 'the reading names the project it is of')
  const whole = await withKernel(censusKernel({'field-notes': census}), () => readHygieneCensus({transport: {kind: 'bridge', url: 'http://t740-partial-census-2.fixture'}, epoch: 'e',
    machineRead: ground.hygieneMachineRead({kind: 'bridge', url: 'http://t740-partial-census-2.fixture'}, true, ['field-notes', 'first-project'])}))
  assert.deepEqual(whole.census.worktrees.map(tree => tree.path), ['/w/Bare/Central/Work/field-notes'])
  const refusals = whole.census.sources.filter(source => /first-project/.test(source.boundaryOp)).map(source => source.refusal)
  assert.deepEqual(refusals, ['Not a git repository: Work/first-project', 'Not a git repository: Work/first-project'], 'its worktrees and its branches: each refusal named, never silent')
})

// ---- round three: Approvals in your own world read every project's returns -------------------------------------------------------

const receipts = await import('../src/agent/devices/receiptBindings.ts')
const {withReturnComments} = await import('../src/central/devices/sourceReturnComment.ts')

/** Yours with two projects (alpha, beta): world_browse discloses both; each answers its own source returns, or refuses in Central's words. */
function yoursKernel(projects, returns) {
  const sent = []
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    if (body.op === 'world_browse') return {json: async () => ({ok: true, outcome: {result: 'world_read', snapshot: {navigator: {root: {work: {projects: projects.map(name => ({name, path: `Work/${name}`}))}}, error: null}}}})}
    if (body.op === 'source_returns_read') {
      const entries = returns[body.project]
      if (!entries) return {json: async () => ({ok: false, error: `Central owner Action refused: Not a project ground: Work/${body.project}`})}
      return {json: async () => ({ok: true, outcome: {result: 'source_returns_reading', data: {schema: 'central.source-returns/v1', entries, more: false, next_before: null, authored_source_mutated: false}}})}
    }
    return {json: async () => ({ok: false, error: `the fixture kernel answers no ${body.op}`})}
  }
  return {sent, fetch}
}
const entry = (ref, path, status = 'pending') => ({return_ref: ref, source_ref: `central:source:project:x:${path}`, basis_revision: 'b1', status, agent_session_ref: 'ses-1', current_revision: 'c1'})

test('SCRIPTED — Yours\' Approvals read every project\'s returns, each row naming its project; an act goes to its own project', async () => {
  const owner = yoursKernel(['alpha', 'beta'], {alpha: [entry('ret:a', 'docs/a.md')], beta: [entry('ret:b', 'docs/b.md')]})
  const read = await withKernel(owner, () => scope.readWorldReturns({kind: 'bridge', url: 'http://t740-yours-returns.fixture'}, null, '1|w', createOwnerReadings()))
  assert.deepEqual(owner.sent.filter(body => body.op === 'source_returns_read').map(body => body.project), ['alpha', 'beta'])
  assert.deepEqual(read.returns.entries.map(row => [row.return_ref, row.project]), [['ret:a', 'alpha'], ['ret:b', 'beta']])
  assert.deepEqual([read.absent, read.refusals], [null, []])
  // The queue names each row's project.
  const rows = receipts.proposalRows(read.returns.entries, [], undefined)
  assert.deepEqual(rows.map(row => [row.id, row.project, row.where]), [['ret:a', 'alpha', 'alpha · docs/a.md'], ['ret:b', 'beta', 'beta · docs/b.md']])
  // Approve and Deny act in the row's own project (the CentralDevices wiring: returnProjectOf(row, the selected world's register)).
  const acted = []
  const binding = receipts.approvalsBinding({returns: read.returns, session: null, encounter: null, holds: bind.chainHolds(), tracks: []},
    {approve: async row => { acted.push(['approve', scope.returnProjectOf(row, null)]) }, reject: async row => { acted.push(['reject', scope.returnProjectOf(row, null)]) }})
  await binding.write([{key: 'approve', value: 'ret:b'}])
  await binding.write([{key: 'reject', value: 'ret:a'}])
  assert.deepEqual(acted, [['approve', 'beta'], ['reject', 'alpha']])
  assert.equal(scope.returnProjectOf({return_ref: 'r'}, 'first-project'), 'first-project', 'a project\'s world: its own register')
  // A project's world reads that project alone.
  const one = yoursKernel(['alpha', 'beta'], {alpha: [entry('ret:a', 'docs/a.md')], beta: [entry('ret:b', 'docs/b.md')]})
  const only = await withKernel(one, () => scope.readWorldReturns({kind: 'bridge', url: 'http://t740-alpha-returns.fixture'}, 'alpha', '1|w', createOwnerReadings()))
  assert.deepEqual(one.sent.filter(body => body.op === 'source_returns_read').map(body => body.project), ['alpha'])
  assert.deepEqual(only.returns.entries.map(row => row.project), ['alpha'])
})

test('SCRIPTED — a project that refused is named in Central\'s words beside the others\' rows; a world with no project says so, never "have not answered"', async () => {
  const owner = yoursKernel(['alpha', 'beta'], {alpha: [entry('ret:a', 'docs/a.md')]})
  const read = await withKernel(owner, () => scope.readWorldReturns({kind: 'bridge', url: 'http://t740-partial-returns.fixture'}, null, '1|w', createOwnerReadings()))
  assert.deepEqual(read.returns.entries.map(row => row.project), ['alpha'])
  assert.deepEqual(read.refusals, [{project: 'beta', error: 'Central owner Action refused: Not a project ground: Work/beta'}])
  const partly = receipts.approvalsBinding({returns: read.returns, returnsRefused: read.refusals, session: null, encounter: null, holds: bind.chainHolds(), tracks: []}, {approve: async () => {}})
  assert.match(partly.standing.queue?.disabled ?? '', /beta: Central owner Action refused: Not a project ground: Work\/beta/, 'the refused project, by name, in Central\'s words')
  assert.equal(partly.standing.approve, undefined, 'the answered rows stay answerable')
  // No project disclosed: nothing is asked, and the words say why.
  const bare = yoursKernel([], {})
  const none = await withKernel(bare, () => scope.readWorldReturns({kind: 'bridge', url: 'http://t740-no-project-returns.fixture'}, null, '1|w', createOwnerReadings()))
  assert.deepEqual(bare.sent.filter(body => body.op === 'source_returns_read'), [])
  assert.deepEqual([none.returns, none.absent], [null, scope.NO_PROJECT_RETURNS])
  const empty = receipts.approvalsBinding({returns: none.returns, returnsAbsent: none.absent, session: null, encounter: null, holds: bind.chainHolds(), tracks: []},
    {approve: async () => {}, reject: async () => {}})
  for (const key of ['approve', 'reject']) assert.match(empty.standing[key]?.disabled ?? '', /no project yet/, key)
  await assert.rejects(empty.write([{key: 'approve', value: 'ret:x'}]), error => /no project yet/.test(error.message) && !/have not answered/.test(error.message))
  const comments = withReturnComments(empty, {returns: none.returns, comment: 'change it', absent: none.absent}, {send: async () => {}})
  assert.match(comments.standing.changes?.disabled ?? '', /no project yet/)
  assert.doesNotMatch(comments.standing.changes?.disabled ?? '', /have not answered/)
})

test('CODE-READING — Central\'s Approvals read the world\'s returns and act in each row\'s project', () => {
  const central = read('central/devices/CentralDevices.tsx')
  assert.match(central, /const worldReturns = useWorldReturns\(transport, approvalsRegister\)/)
  assert.match(central, /approve: row => acceptSourceReturn\(transport, returnProjectOf\(row, approvalsRegister\), row, person\)/)
  assert.match(central, /reject: row => rejectSourceReturn\(transport, returnProjectOf\(row, approvalsRegister\), row\)/)
  assert.match(central, /send: \(row, words\) => commentSourceReturn\(transport, returnProjectOf\(row, approvalsRegister\), row, words, person\)/)
  assert.match(central, /returnsAbsent: worldReturns\.absent, returnsRefused: worldReturns\.refusals/)
  assert.doesNotMatch(read('agent/devices/useRackReading.ts'), /RACK_PROJECT/, 'the old export is gone')
  assert.match(read('frame/transport/LinkSlot.tsx'), /usePopulationAnswer\(transport, registerOf\(ROOT_REGISTER\)\)/)
})

// ---- round four: Factory's Approvals, on the Main track, read the world's returned work ---------------------------------------------

test('CODE-READING — Factory\'s Approvals read every project\'s returns (§19.14 "one place"), act in each row\'s project, and say why when none stand', () => {
  const chain = read('agent/devices/FactoryDeviceChain.tsx')
  assert.doesNotMatch(chain, /useSourceReturnsAnswer\(transport, register\)/, 'not the shown chain\'s register alone (a root chain asked nothing)')
  assert.match(chain, /const approvalsReturns = useWorldReturns\(transport, null\)/)
  assert.match(chain, /approve: row => acceptSourceReturn\(transport, returnProjectOf\(row, null\), row, person\)/)
  assert.match(chain, /reject: row => rejectSourceReturn\(transport, returnProjectOf\(row, null\), row\)/)
  assert.match(chain, /send: \(row, words\) => commentSourceReturn\(transport, returnProjectOf\(row, null\), row, words, person\)/)
  assert.match(chain, /returnsAbsent: approvalsReturns\.absent, returnsRefused: approvalsReturns\.refusals/)
  assert.match(chain, /withReturnComments\(binding, \{returns: returned, comment: agentDraft, absent: approvalsReturns\.absent\}/)
})
