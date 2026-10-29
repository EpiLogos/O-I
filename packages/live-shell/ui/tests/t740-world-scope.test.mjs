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
