// O-I #741 (lane AH, OpenRig's planning dial and wave SDLC into Factory). A Factory task's plan is its unit's, in its Run's plan of
// record as Factory keeps it (Factory wave_sdlc.rs, `factory development wave read`, factory.wave-reading/v1, through the kernel's
// factory_owner `wave-read`): the planning dial — the rung, its reason, the rounds it still needs, the rounds that returned and the lock —
// and the wave it builds in, with its state, what gates it and the next lawful step, each in Factory's words. Clip view's Plan panel
// draws it and adds nothing; Lock is the person's act (`wave-act` lock, under the grant the host resolves), and Factory decides it.
// Channels: the readings are REAL Factory readings from a headless walk of Factory's CLI (kernel/tests/fixtures/owner-routes/
// factory-wave-reading-2026-10-29.json, its scratch path written /walk); SCRIPTED — the kernel calls and the lock are recording ports,
// never the owners. Not a screen pass: the native window is UNVERIFIED (#821).
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
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

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage ??= {getItem: () => null, setItem: noop}

const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const plan = await import('../src/agent/wavePlan.ts')
const takes = await import('../src/agent/factoryTakes.ts')
const clip = await import('../src/agent/clipBinding.ts')
const {loadClip} = await import('../src/inhabitants/catalogue/clips/index.ts')
const {resetViewHolds, wiredKey} = await import('../src/frame/detail/clipBinding.ts')
const {trackKey} = await import('../src/agent/agentRunModel.ts')

const REAL = JSON.parse(await readFile(new URL('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/factory-wave-reading-2026-10-29.json', import.meta.url), 'utf8'))
const RUN = REAL.fix_round.run_ref
const unitRef = key => REAL.fix_round.units.find(unit => unit.key === key).workflow_unit_ref
const COMPILER = unitRef('implement-compiler')
const REVIEW = unitRef('review-adversarially')
const STATE = '/walk/state.json'
const read = (reading, unit) => ({state: 'read', reading, target: {statePath: STATE, runRef: RUN, unitRef: unit}})

test('a take carries the owner\'s own unit ref, and the plan is read for the latest attempt that names one', () => {
  const served = {attempt_ref: 'attempt:2', run_ref: RUN, state_path: STATE, task_ref: 'task:t', workflow_unit: null}
  const take = takes.takeOf('ses-1', served, {attemptRef: 'attempt:2', workflowUnitRef: COMPILER, attemptRecordedAt: '2026-10-29T10:00:00Z'})
  assert.equal(take.unitRef, COMPILER, 'the full ref, which Factory\'s plan is keyed by')
  assert.equal(take.unit, null, 'the short words stay what they were: an opaque identity names nothing')
  const older = {...take, attemptRef: 'attempt:1', unitRef: REVIEW}
  const unnamed = {...take, attemptRef: 'attempt:3', unitRef: null}
  assert.deepEqual(plan.planTargetOf([older, take, unnamed]), {statePath: STATE, runRef: RUN, unitRef: COMPILER})
  assert.equal(plan.planTargetOf([unnamed]), null)
  assert.equal(plan.planTargetOf(null), null)
})

test('the plan is Factory\'s reading, asked as a read, and a refusal stays in Factory\'s words', async () => {
  const asked = []
  const call = async op => { asked.push(op); return {outcome: {result: 'factory_development_reading', data: REAL.fix_round}} }
  const target = {statePath: STATE, runRef: RUN, unitRef: COMPILER}
  const answer = await plan.readWavePlan(call, target)
  assert.deepEqual(asked, [{op: 'factory_owner', request: {kind: 'wave-read', state_path: STATE, run_ref: RUN}}], 'its kind ends in read: the bridge hears a read')
  assert.equal(answer.state, 'read')
  const refused = await plan.readWavePlan(async () => ({error: 'factory: unknown command `wave`'}), target)
  assert.equal(refused.state, 'absent')
  assert.match(refused.why, /Factory did not read the Run's plan: factory: unknown command/)
  const other = await plan.readWavePlan(async () => ({outcome: {result: 'factory_development_reading', data: {schema: 'other'}}}), target)
  assert.match(other.why, /predate the planning dial/)
})

test('the Plan panel\'s values are Factory\'s words: the rung, its reason, its rounds and lock, and the wave that holds it', () => {
  const compiler = plan.planValuesOf(read(REAL.fix_round, COMPILER))
  const unit = REAL.fix_round.units.find(row => row.key === 'implement-compiler')
  assert.equal(compiler.plan, 'P3')
  assert.equal(compiler['plan.why'], unit.dial.reason)
  assert.equal(compiler['plan.asks'], unit.dial.asks)
  assert.equal(compiler['plan.territory'], 'kernel/')
  assert.equal(compiler['plan.locked'], 'P3 · by central:position:project:O-I:planner')
  assert.equal('plan.needs' in compiler, false, 'a locked plan needs nothing more')
  const rounds = JSON.parse(compiler['plan.rounds'])
  assert.deepEqual(rounds.map(row => row.name), ['Research', 'Adversarial pass'])
  assert.match(rounds[1].note, /critic/)
  assert.match(rounds[1].does, /amends: a failing test pins the empty-input refusal/)
  assert.equal(compiler.wave, 'w1 · Fix round')
  assert.equal(compiler['wave.gate'], REAL.fix_round.waves[0].gate)
  assert.equal(compiler['wave.next'], REAL.fix_round.waves[0].next)
  const ladder = JSON.parse(compiler.ladder)
  assert.deepEqual(ladder.map(row => [row.id, row.value]), [['locked', 'yes'], ['built', 'yes'], ['merged', 'yes'], ['reviewed', 'no']])
  assert.equal(ladder[3].why, unit.ladder.reviewed.basis)
  // An open plan says what it still needs; a wave behind an open one waits.
  const review = plan.planValuesOf(read(REAL.fix_round, REVIEW))
  assert.equal(review.plan, 'P0')
  assert.match(review['plan.needs'], /Nothing/)
  assert.equal('plan.locked' in review, false)
  assert.equal(review.wave, 'w2 · Waiting')
  // Sealed: both legs clear at one revision; the next wave builds.
  assert.equal(plan.planValuesOf(read(REAL.sealed, COMPILER)).wave, 'w1 · Sealed')
  assert.equal(plan.planValuesOf(read(REAL.sealed, REVIEW)).wave, 'w2 · Building')
  // A unit the plan holds no rung for reads as unset, and says who sets one.
  const unset = read(REAL.fix_round, 'workflow-unit:49ACFCP5MPWNPRWZ41ZYA6E59W')
  assert.deepEqual(plan.planValuesOf(unset), {})
  assert.match(plan.planWhy(unset), /holds no rung for workflow-unit:49ACFCP5MPWNPRWZ41ZYA6E59W/)
  assert.equal(plan.planWhy(null), plan.PLAN_NOT_HERE)
})

const track = {sessionRef: 'ses-214', purpose: 'compile', agentRef: 'agent:fizz', agentName: 'Fizz', agentAccepted: true,
  spaceRef: 'space:lead', spaceLabel: null, depth: 0, parentRef: null, group: false, memberRefs: [], needle: null, telemetryOn: true,
  budget: {used: 3, max: 12}, disclosure: null, tasks: [
    {n: 1, title: 'implement the compiler', state: 'running', startUnixMs: 1, lastActivityUnixMs: 2, softStop: false, disclosure: null}]}
const ref = `${trackKey(track)}#task/1`

test('the clip reads the plan on the design\'s keys, and Lock is the person\'s act that Factory decides', async () => {
  resetViewHolds()
  const locks = []
  const open = {reading: read(REAL.sealed, REVIEW), lock: async () => { locks.push('lock') }}
  // In REAL.sealed the P0 plan of review-adversarially is locked: Lock stands refused, naming the lock.
  const lockedBinding = clip.factoryClipBinding({ref, tracks: [track], events: [], plan: open})
  assert.equal(lockedBinding.values.plan, 'P0')
  assert.equal(lockedBinding.writes('plan.lock'), true, 'a refusal is a write the owner refuses')
  await assert.rejects(lockedBinding.write([{key: 'plan.lock', value: 1}]), /locked/)
  assert.deepEqual(locks, [])
  // In REAL.fix_round it is open: the press asks Factory, which decides.
  const binding = clip.factoryClipBinding({ref, tracks: [track], events: [], plan: {...open, reading: read(REAL.fix_round, REVIEW)}})
  await binding.write([{key: 'plan.lock', value: 1}])
  assert.deepEqual(locks, ['lock'])
  const refusing = clip.factoryClipBinding({ref, tracks: [track], events: [], plan: {reading: read(REAL.fix_round, REVIEW),
    lock: async () => { throw new Error(REAL.refused.fact) }}})
  await assert.rejects(refusing.write([{key: 'plan.lock', value: 1}]), /still needs: research/, 'Factory\'s refusal is the press\'s error')
  // The rung is the planner's, set with its reason: the desk reads it and never turns it.
  await assert.rejects(binding.write([{key: 'plan', value: 'P4'}]), /planner/)
  // Nothing read here: every key absent with why, and Lock refused in the same words.
  const wiring = clip.factoryWiring({sessionRef: 'ses-214', n: 1}, null, null, null)
  for (const key of ['plan', 'plan.why', 'plan.needs', 'wave', 'wave.gate', 'ladder']) assert.equal(wiring.absent[key], plan.PLAN_NOT_HERE, key)
  assert.equal(wiring.refused['plan.lock'], plan.PLAN_NOT_HERE)
  const absentBinding = clip.factoryClipBinding({ref, tracks: [track], events: [], plan: {reading: {state: 'absent', why: plan.PLAN_NO_TAKE}, lock: async () => {}}})
  assert.equal('plan' in absentBinding.values, false)
})

test('the design draws a Plan panel: the dial, its rounds, the wave and its gate, and Lock', async () => {
  resetViewHolds()
  const design = await loadClip('factory')
  const panel = design.panel.find(tab => tab.id === 'plan')
  assert.ok(panel, 'Clip view in Factory has a Plan panel')
  const binding = clip.factoryClipBinding({ref, tracks: [track], events: [], plan: {reading: read(REAL.fix_round, COMPILER), lock: async () => {}}})
  const markup = renderToStaticMarkup(createElement(panel.draw, {v: binding.values, set: noop, standing: binding.standing}))
  for (const words of ['P3', 'Adversarial', 'load-bearing', 'w1 · Fix round', 'the claims leg found 1 finding', 'Lock', 'Reviewed']) assert.ok(markup.includes(words), words)
  // Every key the panel draws or sets is wired to its owner, the view, or a refusal.
  const wiring = clip.factoryWiring({sessionRef: 'ses-214', n: 1}, null, null, {reading: read(REAL.fix_round, COMPILER), lock: async () => {}})
  for (const key of plan.PLAN_KEYS) assert.ok(wiredKey(wiring, key), key)
  // The design's own fixture reads as Factory's reading does.
  assert.ok(design.fixtures['Its plan, in a fix round'])
})
