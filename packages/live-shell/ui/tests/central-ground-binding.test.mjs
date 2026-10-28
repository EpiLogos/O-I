// Lane BC2: Ground hygiene (DLW §18.5) and Impact (§18.13) on their catalogue designs, bound over the census and the neighbourhood
// the shell's models classify (central/devices/groundBindings.ts). The census fed here is the real seat reading's shape (the JSON of
// `seat status --json`, 16 Oct 2026, trimmed; one landed seat a FIXTURE in the instrument's own shape — the ground held none that day).
// Channel: SCRIPTED over the production bindings, and SSR of each design's views on them. Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
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

const ground = await import('../src/central/devices/groundBindings.ts')
const {resetHolds, setHeld} = await import('../src/central/devices/pageBindings.ts')
const hygiene = await import('../src/inhabitants/centralHygieneModel.ts')
const impact = await import('../src/inhabitants/centralImpactModel.ts')
const {designKey} = await import('../src/frame/devices/designs.ts')

const seat = (product, state, branch, tracked, untracked, ahead, behind, claimedBy = null) => ({product, state, registered_branch: branch, registered_head: 'a1b2c3d',
  claimed_by: claimedBy, now_ref: null, zones: [], admission: null, live_branch: branch, live_head: 'a1b2c3d', tracked_changes: tracked, untracked, behind_main: behind, ahead_main: ahead})
const SEAT_JSON = JSON.stringify({schema: 'central.workcell-status/v1', recorded_at_unix_seconds: 1792117419, workcells: [{name: 'env-1', path: '/Users/admin/Central/worktrees/env-1',
  disk_free_gb: 40.3, min_free_gb: 20, hard_free_gb: null, last_tend: null, drift: [],
  seats: [seat('actuation', 'claimed', 'fold/day-close-20261012', 0, 0, 3, 0, 'claude-code:dlw-conductor'), seat('o-i', 'claimed', 'dlw/build', 4, 6, 230, 0, 'claude-code:dlw-lead'),
    seat('landed', 'claimed', 'fix/merged-lane', 0, 0, 0, 2, 'claude-code:fixture')]}]})
const census = (sources) => {
  const seats = hygiene.parseSeatStatusJson(SEAT_JSON)
  const built = hygiene.assembleCensus({sources, seats, machineRef: hygiene.workcellRefOf({workcell_ref: 'workcell:mac'})})
  return {census: built, findings: hygiene.hygieneFindings(built, hygiene.registeredSeatPaths(built)), at: Date.now() - 5000}
}
const KERNEL = [{boundaryOp: 'op workcell_status_read', channel: 'kernel-op', at: 't'},
  {boundaryOp: 'op git_repository_read (project O-I)', channel: 'kernel-op', at: 't', refusal: 'No eligible Connector implements GitState.'}]
const SEAT_READ = {boundaryOp: 'seat status --json (Control/user/workcell/seat)', channel: 'machine-instrument', at: 't'}

// Ground hygiene's and Impact's designs were retired as devices of their own in the 22 Oct manual rewrite (the seats and checkouts are
// Git / landing's Checkouts page, the reach the Knowledge graph's Reach page); their bindings stay for the devices that carry them, so
// what is checked here is the bindings' own law: every wired key placed, each device published under its own id.
test('every key Ground hygiene and Impact wire is placed; each device is published under its own id', () => {
  for (const wiring of [ground.HYGIENE_WIRING, ground.IMPACT_WIRING]) {
    assert.equal(designKey('central', wiring.design.slice('central:'.length)), wiring.design)
    for (const key of wiring.keys) assert.ok([wiring.reads, wiring.writes, wiring.local, wiring.refused, wiring.absent].some(table => key in table), `${wiring.design}: "${key}" placed`)
  }
})

test('Ground hygiene draws what the shell reads — the kernel\'s sources, the git refusal in its words, the machine — and no ring it did not read', () => {
  resetHolds()
  const v = ground.hygieneValues('central:ground-hygiene', census(KERNEL), Date.now())
  // REPLACED (lane K0): Tending is the hand's own setting now that tenders write through their owners, at the manual's Propose (§18.5).
  assert.deepEqual([v.light, v.machineRef, v.tend, v.refresh, v.faults], ['lit', 'workcell:mac', 'propose', 'open', true])
  assert.deepEqual([v['allow:init'], v['allow:reproject'], v['allow:recognise'], v['allow:reconcile']], [true, true, true, true], 'Allowed tenders: All On')
  assert.ok(v.readAge >= 5)
  assert.match(JSON.parse(v.sources)[1].refusal, /GitState/)
  for (const key of ['seats', 'worktrees', 'branches', 'disk', 'allow:release', 'receipt']) assert.equal(v[key], undefined, `${key}: not read`)
  assert.deepEqual(ground.hygieneValues('central:ground-hygiene', null, Date.now()).light, undefined, 'not read yet: no light')
})

test('Ground hygiene, given the seat reading, reports the clean landed seat as landed and the clean seat ahead of main as not; the seat\'s tenders stand disabled with the model\'s reason', async () => {
  resetHolds()
  const binding = ground.hygieneBinding('central:ground-hygiene', census([...KERNEL, SEAT_READ]), Date.now(), async () => {})
  const findings = JSON.parse(binding.values.findings)
  assert.deepEqual(findings.filter(f => f.kind === 'occupied-by-landed').map(f => f.subject), ['env-1/landed'])
  assert.equal(findings.find(f => f.subject === 'env-1/actuation' && f.kind === 'occupied-by-landed'), undefined, 'actuation: clean, 3 ahead — not landed')
  assert.equal(JSON.parse(binding.values.seats).length, 3)
  // REPLACED (lane K0): Release seat, Prune and Sweep have no writer here; Tend is the hand's setting, never disabled.
  for (const key of ['release', 'prune', 'sweep', 'allow:release']) assert.match(binding.standing[key].disabled, /no writer reaches it/, `${key} disabled with its reason`)
  assert.equal(binding.standing.tend, undefined, 'Tend is the hand\'s own setting')
  await assert.rejects(() => binding.write([{key: 'release', value: 'env-1/landed'}]), /seat instrument/)
  let reread = 0
  await ground.hygieneBinding('central:ground-hygiene', null, Date.now(), async () => { reread++ }).write([{key: 'reread', value: true}])
  assert.equal(reread, 1, 'Read now reads the owners again')
})

test('Impact draws the subject, the graph\'s cut, the references and the sessions a seat checkout touches; a refused graph says its words', () => {
  resetHolds()
  const subject = {kind: 'folder', path: 'Work/O-I/packages', ref: null}
  const reading = impact.assembleImpact({subject,
    graph: {reading: {edges: [{from_ref: 'wiki:node:dlw', relation: 'node-source', to_ref: 'central:source:control:root:Work/O-I/packages', provenance: {source: 'central.wiki.read'}}]}, boundaryOp: 'op graph', at: 't', refusal: null},
    files: {entries: [{name: 'live-shell', kind: 'directory', byte_len: 0, location: {path: 'Work/O-I/packages/live-shell'}}], boundaryOp: 'op files_list', at: 't', refusal: null},
    now: {records: [{now_ref: 'central:now:seat', purpose: 'shell work', lifecycle: 'active', work_refs: [{repo: 'worktrees/env-2/o-i', branch: 'dlw/native-build', worktree_path: '/Users/admin/Central/worktrees/env-2/o-i'}]}],
      boundaryOp: 'op now (kind:list)', at: 't', refusal: null}})
  const v = ground.impactValues('central:impact', reading)
  assert.deepEqual(JSON.parse(v.subject), {kind: 'folder', path: 'Work/O-I/packages', ref: null})
  assert.equal(JSON.parse(v.nodes).length, 2)
  assert.equal(JSON.parse(v.references)[0].name, 'live-shell')
  assert.deepEqual(JSON.parse(v.sessions).map(s => s.nowRef), ['central:now:seat'], 'the seat checkout\'s session touches its project')
  assert.deepEqual([v.light, v.depth, v.pin, v.closed], ['lit', 2, false, false])
  const refused = ground.impactValues('central:impact', impact.assembleImpact({subject, graph: {reading: {}, boundaryOp: 'op graph', at: 't', refusal: 'The graph reading is unavailable'}}))
  assert.equal(refused['refusal:graph'], 'The graph reading is unavailable')
  assert.equal(refused.nodes, undefined)
  setHeld('central:impact', 'depth', 3)
  assert.equal(ground.impactValues('central:impact', reading).depth, 3, 'Depth is the view\'s own')
  assert.ok(ground.impactBinding('central:impact', reading).values.nodes, 'the binding carries the reading')
})
