// T-PROCEDURAL-BODY §6 item 1 (Lane B, the system) — what rides a body's rings. Owner, 20 Oct 2026: "orbits really should be reserved for
// agentic works and recent artifacts therefrom". Inner ring: the agents at work in that world. Outer ring: the recent artefacts those
// agents made there, each at its own place, drifting off as it ages, the newest six at most. Nothing else: not a page that plays, not the
// file you have open, not a work to hand (manual §17.2 "Your system"; DLW.md "Only agents at work and what they make circle a body").
//
// What these tests hold the code to (the contract Lane B codes to; ticket §4 gave only the kinds, the rest is named here):
//   system/systemModel.ts   SatelliteKind = 'session' | 'artifact'; SystemSatellite.age (0 just made … <1 at the window's edge; 0 for a
//                           session) and `path` (an artefact's file: what a press opens); ARTIFACT_WINDOW_MS and ARTIFACTS_PER_WORLD; SystemInput gains `artifacts`, `nowMs`; a SessionLike
//                           may name its `project` (absent: your world, as every session rides today)
//   system/artifacts.ts     artifactsOf(horizon, project): the agent-made files of one world's change horizon, normalised
//   system/openSatellite.ts openSatellite(satellite, ports): the act a press on a satellite takes (never silent on a kind it does not know)
//
// WHERE THE ARTEFACT SOURCE IS (found in the running system, 20 Oct): Central's change horizon, `projectcentral.change.horizon`
// (`central.source-change-horizon/v1`), which the kernel's `central` op carries inside the ground it inspects for ANY register
// (desktop/cradle/kernel/src/central.rs:200 `sources`; desktop/cradle/src/central/client.ts:74 readGround(transport, project)). Each
// change row is a `central.source-change/v1`: change_ref, cursor, source_ref, source_path, kind (added | modified | removed),
// observed_at_unix_seconds, actor, actor_kind, agent_session_ref. The Ledger already reads it as "what an agent did"
// (agent/devices/receiptBindings.ts:90 receiptRows: a change whose actor_kind is `agent`, or that names an agent session), and the
// root register's ground is already held once for the window (central/devices/useCentralReadings.ts:115 useCentralGroundAnswer, which
// SystemReadings.tsx:101 already uses). A project world's is `readGround(transport, project)`: an existing owner op, no new store.
// CAVEAT (receiptBindings.ts:9-13, read 16 Oct): the root horizon then held 830 changes and O-I's 204, NONE attributed to an agent, so
// the outer ring was truly empty. The cause (O-I #746): central.files.write/create and central.flow.append, the doors an agent's session
// writes a page through, kept the session in the file's own history and the horizon met the write later, naming no one. Central now
// carries the write's attribution onto the horizon row of a page of your world's Flows carrier (ctrl/src/file_mutation.rs FlowsHorizon).
//
// Channels: scripted. The model is the shell's own pure code in memory; the horizon rows are shaped as Central answers (two REAL rows of
// the 16 Oct root horizon, tests/factory-receipts-binding.test.mjs) and FIXTURES for the agent's.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/') || s === 'react-dom' || s.startsWith('react-dom/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
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
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

globalThis.__CRADLE_WALK__ = false
const model = await import('../src/projections/atlas/system/systemModel.ts')
const {artifactsOf} = await import('../src/projections/atlas/system/artifacts.ts')
const {openSatellite} = await import('../src/projections/atlas/system/openSatellite.ts')
const {projectOfSession, sessionsOf} = await import('../src/projections/atlas/system/sessionWorld.ts')
const {bindSystemClock, systemNow, subscribeSystemNow, SYSTEM_TICK_MS} = await import('../src/projections/atlas/system/systemClock.ts')

// ── fixtures ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const YOURS = {ref: 'central:wiki:root', name: 'Your world', kind: 'yours', folder: 'Control/user/flows', project: null}
const OI = {ref: 'central:wiki:project:O-I', name: 'O-I', kind: 'project', folder: 'Work/O-I/ProjectCentral/user', project: 'O-I'}
const BOOK = {ref: 'central:wiki:project:Book', name: 'Book', kind: 'project', folder: 'Work/Book/ProjectCentral/user', project: 'Book'}
const RECORD = Object.freeze({
  body_ref: 'body:central:wiki:root', seed: 20261018, generator: {id: 'fbm-sphere', version: 1},
  landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'}, climate: {warmth: .58, moisture: .6, ice_caps: .3},
  sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18},
})
const readingOf = (ref, record, revision = 4) => ({schema: 'oi.world-body-reading/v1', register: null, space: {ref, revision, title: null}, disclosed_revision: revision,
  body: record, wiki_source: {path: 'w.json', ref: 'central:source:wiki', revision: 'r'}, owner_operation: 'aikit wiki-construct facts-inspect'})
const read = (ref, record, revision) => ({state: 'read', reading: readingOf(ref, record, revision), record})

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR
/** The instant the System is drawn for: the Day this ticket was opened, noon. */
const NOW = Date.UTC(2026, 9, 20, 12, 0, 0)
const NO_HAND = {file: null, works: []}
const inputOf = (extra = {}) => ({
  worlds: [YOURS, OI, BOOK], bodies: new Map([[YOURS.ref, read(YOURS.ref, RECORD, 67)], [OI.ref, read(OI.ref, null, 9)]]),
  playing: [], sessions: [], hand: NO_HAND, artifacts: [], nowMs: NOW, ...extra,
})
const sessionOf = (sessionRef, extra = {}) => ({sessionRef, agentName: 'Kev', purpose: 'build', group: false, ...extra})
const GROUP = {sessionRef: 'space:group', agentName: null, purpose: null, group: true}
const sourceRef = (name, world = 'control:root') => `central:source:${world}:Control/user/flows/${name}.html`
/** An artefact an agent made `agoMs` before NOW, as the model takes it (what artifactsOf returns). */
const made = (name, agoMs, extra = {}) => ({ref: sourceRef(name), name, path: `Control/user/flows/${name}.html`, atMs: NOW - agoMs, project: null,
  sessionRef: 'agent-session/kev', actor: 'agent:kev', ...extra})
const ringOf = (body, ring) => body.satellites.filter(satellite => satellite.ring === ring)
const idsOf = body => body.satellites.map(satellite => satellite.id)
const windowMs = () => {
  assert.equal(typeof model.ARTIFACT_WINDOW_MS, 'number', 'systemModel.ts exports ARTIFACT_WINDOW_MS, the window an artefact stays in orbit (named, with its reasoning beside it)')
  return model.ARTIFACT_WINDOW_MS
}

// ── the rings: sessions inner, artefacts outer, nothing else ─────────────────────────────────────────────────────────────

test('the inner ring is the agents at work and the outer is what they have just made, each world its own, and nothing else rides', () => {
  const playing = [{pageRef: 'ref:Control/user/flows/morning.html', nowRef: 'now:a', project: null, sinceMs: 1}, {pageRef: 'ref:Work/O-I/ProjectCentral/user/being.html', nowRef: 'now:b', project: 'O-I', sinceMs: 2}]
  const hand = {file: {ref: 'ref:Work/O-I/README.md', path: 'Work/O-I/README.md'}, works: [{expression_ref: 'expr:essay', title: 'The essay'}]}
  const artifacts = [made('a', 5 * MIN), made('b', 2 * HOUR, {project: 'O-I', ref: sourceRef('b', 'project:O-I')})]
  const [own, oi, book] = model.systemOf(inputOf({playing, hand, sessions: [sessionOf('agent-session/kev'), GROUP], artifacts, titles: new Map([['ref:Control/user/flows/morning.html', 'Morning']])}))
  assert.deepEqual(own.satellites.map(s => [s.kind, s.ring, s.id]), [['session', 'inner', 'agent-session/kev'], ['artifact', 'outer', sourceRef('a')]],
    'your world: its agent at work inside, what its agent made outside; its playing page, the open file and the works to hand ride nothing')
  assert.deepEqual(oi.satellites.map(s => [s.kind, s.ring, s.id]), [['artifact', 'outer', sourceRef('b', 'project:O-I')]], 'O-I: its own artefact, not a page that plays in its register nor the file in its folder')
  assert.deepEqual(book.satellites, [], 'a world nothing agentic happens in has empty rings')
})

test('a page that plays, the file you have open and the works to hand never circle anything', () => {
  const playing = [{pageRef: 'ref:Control/user/flows/morning.html', nowRef: 'now:a', project: null, sinceMs: 1}, {pageRef: 'ref:Work/O-I/ProjectCentral/user/being.html', nowRef: 'now:b', project: 'O-I', sinceMs: 2}]
  const hand = {file: {ref: 'ref:Work/O-I/README.md', path: 'Work/O-I/README.md'}, works: [{expression_ref: 'expr:essay', title: 'The essay'}, {expression_ref: 'expr:film', title: 'The film'}]}
  for (const body of model.systemOf(inputOf({playing, hand}))) {
    assert.deepEqual(body.satellites, [], `${body.world.name}: no agent and nothing made, so nothing rides, whatever else is open`)
  }
  const withAgent = model.systemOf(inputOf({playing, hand, sessions: [sessionOf('agent-session/kev')]}))
  const everything = withAgent.flatMap(body => body.satellites)
  for (const gone of ['ref:Control/user/flows/morning.html', 'ref:Work/O-I/ProjectCentral/user/being.html', 'ref:Work/O-I/README.md', 'expr:essay', 'expr:film']) {
    assert.ok(!everything.some(s => s.id === gone), `${gone} is on the ground, not in orbit`)
  }
  assert.ok(everything.every(s => s.kind === 'session' || s.kind === 'artifact'), 'a satellite is a session or an artefact')
})

test('an agent at work rides the inner ring at the place its session ref keys, however the list around it changes; a group is no agent', () => {
  const kev = 'agent-session/kev', mara = 'agent-session/mara'
  const sessions = [sessionOf(kev), sessionOf(mara, {agentName: null, purpose: 'docs pass'}), sessionOf('agent-session/anon', {agentName: null, purpose: null}), GROUP]
  const [own] = model.systemOf(inputOf({sessions}))
  assert.deepEqual(own.satellites.map(s => [s.id, s.ring, s.kind, s.name]),
    [[kev, 'inner', 'session', 'Kev'], [mara, 'inner', 'session', 'docs pass'], ['agent-session/anon', 'inner', 'session', 'anon']],
    'every real session, in order, named by its agent, else its purpose, else the end of its ref; the group is a container, not an agent')
  for (const s of own.satellites) assert.equal(s.phase, model.ringPhase(s.id), `${s.id} stands where its ref keys it`)
  const alone = model.systemOf(inputOf({sessions: [sessions[0]]}))[0].satellites[0].phase
  const reversed = model.systemOf(inputOf({sessions: [...sessions].reverse()}))[0].satellites.find(s => s.id === kev).phase
  assert.equal(alone, own.satellites[0].phase, 'the same place when it rides alone')
  assert.equal(reversed, own.satellites[0].phase, 'and when the list is reversed')
  assert.ok(own.satellites[0].phase >= 0 && own.satellites[0].phase < Math.PI * 2)
})

test('a session rides the world its project names; one that names none rides your world, as every session does today', () => {
  const sessions = [sessionOf('agent-session/kev', {project: null}), sessionOf('agent-session/oi-1', {project: 'O-I', agentName: 'Flint'}), sessionOf('agent-session/gone', {project: 'Gone'}), sessionOf('agent-session/bare')]
  const [own, oi, book] = model.systemOf(inputOf({sessions}))
  assert.deepEqual(idsOf(own), ['agent-session/kev', 'agent-session/bare'], 'the root register\'s agents, and one that names no project, ride your world')
  assert.deepEqual(idsOf(oi), ['agent-session/oi-1'], 'O-I\'s agent rides O-I, not your world (agent/AgentSessionsProvider.tsx:21 reads the O-I project\'s agency)')
  assert.deepEqual(book.satellites, [])
  assert.ok(![...own.satellites, ...oi.satellites].some(s => s.id === 'agent-session/gone'), 'an agent of a world that is not in today\'s set rides nothing: it is never put on another world\'s ring')
})

test('what an agent made rides the outer ring of the world that holds it, keyed by its own ref, and says what it is', () => {
  const a = made('a', 10 * MIN, {actor: 'agent:flint'}), b = made('b', 20 * MIN, {project: 'O-I', ref: sourceRef('b', 'project:O-I'), path: 'ProjectCentral/user/b.html'}), lost = made('c', MIN, {project: 'Gone'})
  const [own, oi, book] = model.systemOf(inputOf({artifacts: [a, b, lost]}))
  const [mine] = ringOf(own, 'outer'), [theirs] = ringOf(oi, 'outer')
  assert.ok(mine, 'your world has its agent\'s artefact on its outer ring')
  assert.ok(theirs, 'O-I has its own artefact on its outer ring')
  assert.deepEqual([mine.id, mine.kind, mine.ring, mine.name, mine.phase], [a.ref, 'artifact', 'outer', 'a', model.ringPhase(a.ref)], 'the artefact is its source ref, named by its file, at the place that ref keys')
  assert.deepEqual([theirs.id, theirs.kind, theirs.name, theirs.phase], [b.ref, 'artifact', 'b', model.ringPhase(b.ref)], 'another world\'s artefact rides its own world')
  assert.deepEqual(book.satellites, [])
  assert.ok(![...own.satellites, ...oi.satellites].some(s => s.id === lost.ref), 'an artefact of a world that is not in today\'s set rides nothing')
  assert.equal(mine.path, 'Control/user/flows/a.html', 'it carries the file it is, which a press opens (SystemSatellite.path: an artefact\'s own path)')
  assert.match(mine.hint, /Control\/user\/flows\/a\.html/, 'the hint names the file')
  assert.match(mine.hint, /agent:flint/, 'the hint names who made it')
  assert.match(mine.hint, /Select to open/, 'and what a press does')
  assert.equal(ringOf(own, 'inner').length, 0, 'an artefact is not an agent at work: nothing is added to the inner ring')
})

// ── recency, and drifting off ───────────────────────────────────────────────────────────────────────────────────────────

// THE WINDOW. ARTIFACT_WINDOW_MS is one Day long, rolling. Reasoning, from the owner's ground (Control/agents/governance/field-and-now/
// day-close.md): NOW is a moving horizon that ends — "what was live is carried, what finished is removed, and what the day held stays
// readable in a dated record" — and a close is "a closure reading at a local civil date", the field "opens clean" the next morning. That law
// gives the horizon's size (one Day) and nothing finer: it names no recency of its own. So an artefact stays in orbit for as long as one
// Day's length from the moment it was made, and then belongs to the day's record, not to the sky. It is a rolling Day and not the civil
// boundary because the boundary is the owner's policy (Control/user/civil-time-policy.json: Europe/London, day_boundary_minutes 0, a
// rollover that may be automatic), and a boundary would empty every ring at once at midnight instead of letting each artefact drift off as
// it ages. A civil-Day window is the one-line alternative (the model would take the Day's start as input); the lead rules.
test('an artefact stays in orbit for a Day\'s length, with its age told, and drifts off at the edge: nothing older, nothing not yet made', () => {
  const W = windowMs()
  assert.equal(W, DAY, 'the window is one Day (the reasoning above, from day-close.md)')
  const at = ago => model.systemOf(inputOf({artifacts: [made('x', ago)]}))[0].satellites.find(s => s.kind === 'artifact')
  assert.equal(at(0).age, 0, 'just made: age 0')
  assert.ok(Math.abs(at(W / 2).age - .5) < 1e-9, 'halfway through the window: age one half (age is the share of the window it has lived)')
  assert.ok(at(W - 1), 'one ms inside the window: still in orbit')
  assert.ok(at(W - 1).age < 1 && at(W - 1).age > .999, 'and at the very edge of its age')
  assert.equal(at(W), undefined, 'at the window\'s length it has drifted off')
  assert.equal(at(W + HOUR), undefined, 'older: gone')
  assert.equal(at(-MIN), undefined, 'made after the instant shown: it did not exist yet, so it rides nothing (a past occasion shows the sky of that time)')
  const ages = [0, HOUR, 6 * HOUR, 18 * HOUR, W - MIN].map(ago => at(ago).age)
  assert.deepEqual([...ages].sort((a, b) => a - b), ages, 'the older, the further along: age rises with age')
  assert.equal(model.systemOf(inputOf({sessions: [sessionOf('agent-session/kev')]}))[0].satellites[0].age, 0, 'an agent at work does not age out: it is at work now')
})

test('the newest six artefacts of a world ride and no more; the cap counts only what is in the window, per world, newest first', () => {
  assert.equal(model.ARTIFACTS_PER_WORLD, 6, 'systemModel.ts exports ARTIFACTS_PER_WORLD = 6')
  const names = ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6']
  const seven = names.map((name, i) => made(name, (i + 1) * 10 * MIN))
  const given = [seven[3], seven[6], seven[0], seven[5], seven[1], seven[4], seven[2]]
  const [own] = model.systemOf(inputOf({artifacts: given}))
  assert.deepEqual(ringOf(own, 'outer').map(s => s.name), names.slice(0, 6), 'the six newest, newest first, whatever order they were given in; the oldest is out')
  const W = windowMs()
  const stale = [made('s0', W + HOUR), made('s1', W + 2 * HOUR), made('s2', W + 3 * HOUR)]
  const [kept] = model.systemOf(inputOf({artifacts: [...stale, ...seven.slice(0, 6)]}))
  assert.deepEqual(ringOf(kept, 'outer').map(s => s.name), names.slice(0, 6), 'artefacts past the window take no place')
  const both = model.systemOf(inputOf({artifacts: [...seven, ...seven.map(item => ({...item, project: 'O-I', ref: item.ref.replace('control:root', 'project:O-I')}))]}))
  assert.deepEqual([ringOf(both[0], 'outer').length, ringOf(both[1], 'outer').length], [6, 6], 'six for each world, not six in all')
  const tied = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'].map(name => made(name, 30 * MIN))
  const one = ringOf(model.systemOf(inputOf({artifacts: tied}))[0], 'outer').map(s => s.id), two = ringOf(model.systemOf(inputOf({artifacts: [...tied].reverse()}))[0], 'outer').map(s => s.id)
  assert.equal(one.length, 6)
  assert.deepEqual(one, two, 'artefacts made in the same instant are chosen by their ref, so the same six ride however the list is ordered')
})

test('an artefact keeps its place on the ring under reorder, under the removal of a neighbour, and when a newer one pushes the oldest off', () => {
  const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((name, i) => made(name, (i + 1) * HOUR))
  const phases = list => Object.fromEntries(ringOf(model.systemOf(inputOf({artifacts: list}))[0], 'outer').map(s => [s.name, s.phase]))
  const base = phases(six)
  assert.equal(Object.keys(base).length, 6, 'six artefacts of the last six hours all ride the outer ring')
  for (const [name, phase] of Object.entries(base)) assert.equal(phase, model.ringPhase(six.find(item => item.name === name).ref), `${name} stands where its ref keys it`)
  assert.equal(new Set(Object.values(base)).size, 6, 'six refs, six places')
  assert.deepEqual(phases([...six].reverse()), base, 'reordered: every artefact where it was')
  const without = phases(six.filter(item => item.name !== 'c'))
  for (const [name, phase] of Object.entries(without)) assert.equal(phase, base[name], `${name} did not move when c was put down`)
  const pushed = phases([made('n', 5 * MIN), ...six])
  assert.equal(pushed.f, undefined, 'a newer artefact took the sixth place: the oldest drifted off')
  for (const name of ['a', 'b', 'c', 'd', 'e']) assert.equal(pushed[name], base[name], `${name} stayed where it was when a newer one arrived`)
  assert.equal(pushed.n, model.ringPhase(sourceRef('n')))
})

test('a world with no agent has empty rings, whatever else is open', () => {
  const playing = [{pageRef: 'ref:Control/user/flows/morning.html', nowRef: 'now:a', project: null, sinceMs: 1}]
  const hand = {file: {ref: 'ref:Control/user/flows/morning.html', path: 'Control/user/flows/morning.html'}, works: [{expression_ref: 'expr:essay', title: 'The essay'}]}
  for (const body of model.systemOf(inputOf({playing, hand, sessions: [], artifacts: []}))) assert.deepEqual(body.satellites, [], body.world.name)
  const [own, oi] = model.systemOf(inputOf({playing, hand, sessions: [GROUP], artifacts: []}))
  assert.deepEqual([own.satellites, oi.satellites], [[], []], 'a session group alone is no agent at work')
})

test('the model is pure: the same readings give the same rings, nothing is mutated, and no clock or die is consulted', () => {
  const deepFreeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const inner of Object.values(value)) deepFreeze(inner) } return value }
  const input = deepFreeze(inputOf({sessions: [sessionOf('agent-session/kev'), GROUP]}))
  assert.deepEqual(model.systemOf(input), model.systemOf(input))
  const source = readFileSync(new URL('../src/projections/atlas/system/systemModel.ts', import.meta.url), 'utf8').split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n')
  assert.doesNotMatch(source, /Math\.random|Date\.now|new Date\(|performance\.now/, 'the instant is an input (nowMs), never read here: the same input is the same sky')
})

// ── the horizon's change rows → artefacts ─────────────────────────────────────────────────────────────────────────────────

// REAL rows of the root horizon (16 Oct; tests/factory-receipts-binding.test.mjs): none made by an agent.
const REMOVED = {schema: 'central.source-change/v1', change_ref: 'central:change:control:root:830', cursor: 830, world_ref: 'control:root',
  source_ref: 'central:source:control:root:Control/user/flows/o-i-the-mark-9ad0e0e9.expression.json', source_path: 'Control/user/flows/o-i-the-mark-9ad0e0e9.expression.json',
  before_revision: 'central.content-fnv1a64/v1:8894:7cff0f12f97985f2', after_revision: null, kind: 'removed', observed_at_unix_seconds: 1792108013, provider: 'central.filesystem-reconcile/v1'}
const NATIVE = {schema: 'central.source-change/v1', change_ref: 'central:change:control:root:821', cursor: 821, world_ref: 'control:root',
  source_ref: 'central:source:control:root:Control/agents/now/clearings/e3fd/now.json', source_path: 'Control/agents/now/clearings/e3fd/now.json', before_revision: null,
  after_revision: 'central.content-fnv1a64/v1:776:c8e9c7c0bcf630f7', kind: 'added', observed_at_unix_seconds: 1791751348, provider: 'central.filesystem-reconcile/v1',
  actor: 'central.now.allocate', actor_kind: 'native-operation'}
// FIXTURES, in the shape of the rows above, made by an agent:
const BY_AGENT = {...NATIVE, change_ref: 'central:change:control:root:831', cursor: 831, source_ref: 'central:source:control:root:Control/user/flows/flow-2026-10-20-0932.html',
  source_path: 'Control/user/flows/flow-2026-10-20-0932.html', kind: 'added', observed_at_unix_seconds: 1792499520, actor: 'agent:aletheia', actor_kind: 'agent', agent_session_ref: 'agent-session/fx-aletheia'}
const horizon = changes => ({schema: 'central.source-change-horizon/v1', world_ref: 'control:root', cursor: 900, sources: [], changes})

test('the horizon\'s changes an agent made are the artefacts: its actor kind is agent, or it names an agent session; a human or native change is not', () => {
  assert.deepEqual(artifactsOf(horizon([REMOVED, NATIVE]), null), [], 'the real root horizon of 16 Oct holds no agent\'s work: the outer ring is empty, truly')
  assert.deepEqual(artifactsOf(horizon([NATIVE, BY_AGENT, REMOVED]), null), [{
    ref: BY_AGENT.source_ref, name: 'flow-2026-10-20-0932', path: 'Control/user/flows/flow-2026-10-20-0932.html', atMs: 1792499520 * 1000, project: null,
    sessionRef: 'agent-session/fx-aletheia', actor: 'agent:aletheia',
  }], 'an artefact is its source ref, its file\'s name and path, the instant it was observed in ms, the world it is in, and who made it')
  const sessionOnly = {...BY_AGENT, cursor: 832, change_ref: 'c832', source_ref: 'central:source:control:root:b.html', source_path: 'b.html', actor: undefined, actor_kind: 'human'}
  const actorOnly = {...BY_AGENT, cursor: 833, change_ref: 'c833', source_ref: 'central:source:control:root:c.html', source_path: 'c.html', agent_session_ref: undefined}
  assert.deepEqual(artifactsOf(horizon([sessionOnly, actorOnly]), null).map(item => item.path).sort(), ['b.html', 'c.html'], 'a change that names an agent session, or an actor of kind agent, is an agent\'s (the Ledger\'s own rule, receiptBindings.ts receiptRows)')
  assert.deepEqual(artifactsOf(horizon([BY_AGENT]), 'O-I').map(item => item.project), ['O-I'], 'it carries the world\'s project it was read from')
})

test('what an agent removed is no artefact; a change that cannot be keyed or dated is left out, never guessed; one file is one artefact, its newest change', () => {
  const row = (cursor, extra = {}) => ({...BY_AGENT, cursor, change_ref: `c${cursor}`, ...extra})
  assert.deepEqual(artifactsOf(horizon([row(1, {kind: 'removed'})]), null), [], 'a removal made nothing')
  assert.deepEqual(artifactsOf(horizon([row(2, {observed_at_unix_seconds: undefined}), row(3, {source_ref: undefined}), row(4, {observed_at_unix_seconds: 'soon'})]), null), [], 'no instant, no ref: nothing is invented')
  const twice = artifactsOf(horizon([row(5, {observed_at_unix_seconds: 1000, actor: 'agent:old'}), row(6, {observed_at_unix_seconds: 2000, actor: 'agent:new'})]), null)
  assert.equal(twice.length, 1, 'the same file changed twice is one artefact')
  assert.deepEqual([twice[0].atMs, twice[0].actor], [2000 * 1000, 'agent:new'], 'at its newest change')
  const newestFirst = artifactsOf(horizon([row(6, {observed_at_unix_seconds: 2000, actor: 'agent:new'}), row(5, {observed_at_unix_seconds: 1000, actor: 'agent:old'})]), null)
  assert.deepEqual(newestFirst.map(item => [item.atMs, item.actor]), [[2000 * 1000, 'agent:new']], 'whatever order the changes are listed in: the newest stands, not the last read')
  const sameInstant = artifactsOf(horizon([row(8, {observed_at_unix_seconds: 3000, actor: 'agent:later'}), row(7, {observed_at_unix_seconds: 3000, actor: 'agent:earlier'})]), null)
  assert.deepEqual(sameInstant.map(item => item.actor), ['agent:later'], 'two changes in one instant: the later cursor')
  const many = artifactsOf(horizon([1, 2, 3].map(i => row(10 + i, {source_ref: `central:source:control:root:f${i}.html`, source_path: `f${i}.html`, observed_at_unix_seconds: 1000 + i * 10}))), null)
  assert.deepEqual(many.map(item => item.path), ['f3.html', 'f2.html', 'f1.html'], 'newest first')
  for (const nothing of [null, undefined, 'x', 4, {}, {changes: 'no'}, horizon([null, 3, 'x', []])]) assert.deepEqual(artifactsOf(nothing, null), [], `a horizon that is not one gives none: ${JSON.stringify(nothing)}`)
})

// ── pressing a satellite ───────────────────────────────────────────────────────────────────────────────────────────────────

test('a press on a session chooses it, on an artefact opens its file through the file route; a kind it does not know is refused by name, never silent', async () => {
  const calls = []
  const ports = {selectSession: ref => calls.push(['session', ref]), openArtifact: async item => { calls.push(['artifact', item.id, item.path]) }}
  const [own] = model.systemOf(inputOf({sessions: [sessionOf('agent-session/kev')], artifacts: [made('a', MIN)]}))
  for (const satellite of own.satellites) await openSatellite(satellite, own, ports)
  assert.deepEqual(calls, [['session', 'agent-session/kev'], ['artifact', sourceRef('a'), 'Control/user/flows/a.html']], 'a session is chosen in the sessions provider; an artefact opens as a file (the file route reads its path from the artefact itself)')
  await assert.rejects(openSatellite({id: 'x', name: 'x', ring: 'inner', kind: 'page', phase: 0, hint: '', age: 0}, own, ports), /page/, 'a kind that rides nothing now is refused in words (SystemReadings.tsx:172-183 used to do nothing for an unknown kind)')
  await assert.rejects(openSatellite(own.satellites[1], own, {selectSession() {}}), /open|file/i, 'a pane that cannot open a file says so rather than doing nothing')
  await assert.rejects(openSatellite(own.satellites[0], own, {async openArtifact() {}}), /sessions are not read in this pane/, 'and one that cannot choose a session says so')
})

// ── which world an agent is at work in ────────────────────────────────────────────────────────────────────────────────────────

// An agency row is {spaceRef, spaceLabel, sessionRef, purpose, agentRef, raw}, and `raw` is the SessionSpace the owner disclosed
// (desktop/cradle/src/agency/agencySources.ts:36-42). That space names the projects it belongs to: `definition.projects`, which the kernel
// checks on every read (desktop/cradle/kernel/src/agency.rs:759-762). Read on 20 Oct with `aikit session-space discover --project O-I`: a space
// of "Factory280 ordinary protected producer Pi" names ["Factory", "O-I"]; a root space ("Lilt") names ["control:root"]; a project's id is its
// name (Work/O-I/ProjectCentral/project.json "project_id": "O-I"). So the row itself says where its session is at work.
const spaceOf = projects => ({version: 'aikit.session-space-application/v1', definition: {id: 'session-space/x', projects}, label: 'x', agent_sessions: {}})

test('an agent is at work in the world its space belongs to: the project its definition names that today\'s set holds, the first listed; the root, or nothing the set holds, is your world', () => {
  const worlds = [YOURS, OI, BOOK]
  const of = projects => projectOfSession({raw: spaceOf(projects)}, worlds)
  assert.equal(of(['O-I']), 'O-I')
  assert.equal(of(['control:root']), null, 'the root register\'s agents are at work in your world')
  assert.equal(of(['Factory', 'O-I']), 'O-I', 'the real space of 20 Oct names Factory and O-I; Factory is not a world of this set, O-I is')
  assert.equal(of(['Book', 'O-I']), 'Book', 'two worlds of the set: the first it lists')
  assert.equal(of(['control:root', 'O-I']), 'O-I', 'a project before the root: the narrower world')
  assert.equal(of(['Gone']), null, 'a project that is not a world of today\'s set is not derivable to one: your world, as every session rode before')
  for (const nothing of [undefined, null, {}, {definition: {}}, {definition: {projects: 'O-I'}}, {definition: {projects: [4, null]}}, 'x']) {
    assert.equal(projectOfSession({raw: nothing}, worlds), null, `no projects to read: ${JSON.stringify(nothing)}`)
  }
  assert.equal(projectOfSession({}, worlds), null, 'a row with no space payload')
  assert.equal(projectOfSession({raw: spaceOf(['O-I'])}, [YOURS]), null, 'with only your world in the set')
})

test('the agents of the sessions provider become the System\'s sessions: a real session of a space, the world its space names, a group left out, a row not found says nothing of its world', () => {
  const track = (sessionRef, extra = {}) => ({sessionRef, agentName: 'Kev', purpose: 'build', group: false, spaceRef: 'session-space/x', ...extra})
  const rows = [{spaceRef: 'session-space/x', sessionRef: 'agent-session/a', raw: spaceOf(['O-I'])}, {spaceRef: 'session-space/y', sessionRef: 'agent-session/b', raw: spaceOf(['control:root'])}]
  const tracks = [track('agent-session/a'), track('agent-session/b', {agentName: null, purpose: 'docs'}), track('agent-session/lost'), track('session-space/x', {group: true, agentName: null, purpose: null})]
  assert.deepEqual(sessionsOf(tracks, rows, [YOURS, OI]), [
    {sessionRef: 'agent-session/a', agentName: 'Kev', purpose: 'build', group: false, project: 'O-I'},
    {sessionRef: 'agent-session/b', agentName: null, purpose: 'docs', group: false, project: null},
    {sessionRef: 'agent-session/lost', agentName: 'Kev', purpose: 'build', group: false, project: null},
    {sessionRef: 'session-space/x', agentName: null, purpose: null, group: true, project: null},
  ], 'each track with the project its row\'s space names; the same four fields the model reads, nothing of the track\'s other readings')
})

// ── the System's instant ────────────────────────────────────────────────────────────────────────────────────────────────────────

// The model takes the instant as an input (nowMs) and reads no clock. The one clock is held here, told to its readers every minute so an
// artefact drifts off the ring as it ages, under the atlas's own lifetime (src/ui/lifetime.ts later: cancelled when the atlas is disposed).
test('the System\'s instant is held and told once a minute, under the atlas lifetime; released, a late tick changes nothing', () => {
  assert.equal(SYSTEM_TICK_MS, 60_000, 'a minute: the least a person sees an artefact move by, and no cost to anyone')
  let wall = NOW
  const timers = []
  const later = (run, ms) => { const timer = {run, ms, cancelled: false}; timers.push(timer); return () => { timer.cancelled = true } }
  const told = []
  const off = subscribeSystemNow(() => told.push(systemNow()))
  const clock = bindSystemClock({now: () => wall, later})
  assert.equal(systemNow(), NOW, 'bound: the instant is the clock\'s now')
  assert.deepEqual(timers.map(timer => timer.ms), [SYSTEM_TICK_MS], 'one tick is waiting')
  const bound = told.length
  wall += SYSTEM_TICK_MS
  timers[0].run()
  assert.equal(systemNow(), NOW + SYSTEM_TICK_MS, 'the tick moved the instant')
  assert.equal(told.length, bound + 1, 'and told its readers once')
  assert.deepEqual(timers.map(timer => timer.ms), [SYSTEM_TICK_MS, SYSTEM_TICK_MS], 'and asked for the next')
  assert.equal(systemNow(), systemNow(), 'between ticks the instant stands still (a reader that compares snapshots sees one value)')
  clock.dispose()
  assert.equal(timers.at(-1).cancelled, true, 'released: the waiting tick is cancelled')
  wall += SYSTEM_TICK_MS
  timers[1].run()
  assert.equal(systemNow(), NOW + SYSTEM_TICK_MS, 'a tick that was already due does not move it')
  assert.equal(timers.length, 2, 'and asks for no more')
  off()
  const source = readFileSync(new URL('../src/projections/atlas/system/systemClock.ts', import.meta.url), 'utf8')
  assert.match(source, /from '\.\.\/src\/ui\/lifetime'/, 'the timer is the atlas lifetime\'s own')
})
