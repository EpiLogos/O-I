// Lane BC2: Ground hygiene and Impact on the owners' real output shapes (DLW §18.5, §18.6), and the kernel receipts Central's
// readers re-read on (owners/notices.ts, lane W3).
// The fixtures are the real outputs of the read-only owner reads, run on workcell:mac on 16 Oct 2026 and trimmed to the rows the
// rules turn on (the seat instrument's `seat status` and `seat status --json`, Control/user/workcell/seat cmd_status; `workcell
// status --json`; `git worktree list --porcelain` of Work/O-I; NOW work refs of `ctrl action run central.now.list`). One row of each
// seat reading — a clean claimed seat with nothing main does not hold — is written in the instrument's own print shape, because the
// ground held no landed seat that day: it is marked FIXTURE where it stands.
// Channel: SCRIPTED over the production models. Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) return r
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText};
}`)}`, import.meta.url)

const hygiene = await import('../src/inhabitants/centralHygieneModel.ts')
const impact = await import('../src/inhabitants/centralImpactModel.ts')
const notices = await import('../src/owners/notices.ts')

// `seat status` (text), 16 Oct 2026 — env-1's rows as printed, and one FIXTURE row (`landed`) in the same print shape.
const SEAT_TEXT = `workcell env-1  (/Users/admin/Central/worktrees/env-1)  disk free 40.3 GB (soft min 20, hard —)  tend: 0 MB at 10-16 00:52
  actuation  claimed                fold/day-close-20261012                       +3 by claude-code:dlw-conductor
               zone claude-code:dlw-conductor: ProjectCentral, .gitignore, experiments, scripts
  ai-kit     claimed                speed/root-register-stays-warm                +2 by claude-code:dlw-lead
               floor breach recorded: 18.0 GB free < soft 20 GB
  central    claimed                fix/day-close-no-t-payloads                   +1 -4 by claude-code:dlw-conductor
  factory    free                   detached 6b1b7ff
  o-i        claimed                dlw/build                                     4 dirty 6 untracked +230 by claude-code:dlw-lead
  ql-mef     free                   detached 37e3085                              -1
  landed     claimed                fix/merged-lane                               -2 by claude-code:fixture
  DRIFT: o-i: register pose ('dlw/phase1-semantics-20261013', 'cc69e19fa') != live ('dlw/build', 'dc089936a')
`

// `seat status --json` (schema central.workcell-status/v1), 16 Oct 2026 — env-1, trimmed; the `landed` seat is the FIXTURE row.
const seat = (product, state, branch, head, tracked, untracked, ahead, behind, claimedBy = null, admission = null) => ({product, state,
  registered_branch: branch, registered_head: head, claimed_by: claimedBy, now_ref: null, zones: [], admission, live_branch: branch, live_head: head,
  tracked_changes: tracked, untracked, behind_main: behind, ahead_main: ahead})
const SEAT_JSON = JSON.stringify({schema: 'central.workcell-status/v1', recorded_at_unix_seconds: 1792117419, workcells: [{
  name: 'env-1', path: '/Users/admin/Central/worktrees/env-1', disk_free_gb: 40.3, min_free_gb: 20, hard_free_gb: null, last_tend: null,
  seats: [
    seat('actuation', 'claimed', 'fold/day-close-20261012', '933731e', 0, 0, 3, 0, 'claude-code:dlw-conductor'),
    seat('ai-kit', 'claimed', 'speed/root-register-stays-warm', '0c2c876b', 0, 0, 2, 0, 'claude-code:dlw-lead',
      {free_gb: 18.0, soft_floor_gb: 20, hard_floor_gb: 5.0, tended_freed_mb: 0, standing: 'admitted below the soft floor; breach recorded'}),
    seat('factory', 'free', null, '6b1b7ff', 0, 0, 0, 0),
    seat('o-i', 'claimed', 'dlw/build', 'dc089936a', 4, 6, 230, 0, 'claude-code:dlw-lead'),
    seat('landed', 'claimed', 'fix/merged-lane', 'aaaabbb', 0, 0, 0, 2, 'claude-code:fixture'),
    seat('point-cloud-demo', 'free', null, null, null, null, null, null),
  ],
  drift: ["o-i: register pose ('dlw/phase1-semantics-20261013', 'cc69e19fa') != live ('dlw/build', 'dc089936a')", 'point-cloud-demo: checkout missing'],
}, {
  name: 'env-2', path: '/Users/admin/Central/worktrees/env-2', disk_free_gb: 40.3, min_free_gb: 20, hard_free_gb: null, last_tend: null,
  seats: [seat('o-i', 'claimed', 'dlw/native-build', '9a1974d13', 0, 0, 229, 0, 'claude-code:dlw-lead')],
  drift: ["o-i: register pose ('dlw/native-build', '2491a11b6') != live ('dlw/native-build', '9a1974d13')"],
}]})

// `git worktree list --porcelain` in Work/O-I, 16 Oct 2026: the main worktree first, then the env seats.
const WORKTREES = `worktree /Users/admin/Central/Work/O-I
HEAD 1cc77db12d174145db60509a01dce71d855daa7a
branch refs/heads/main

worktree /Users/admin/Central/worktrees/env-1/o-i
HEAD c5afc4aa0ca20c712746c02fdf0571dc8dacd766
branch refs/heads/dlw/build

worktree /Users/admin/Central/worktrees/env-2/o-i
HEAD 9a1974d1339fbf1d65c21a2a17ec1604a0f5af22
branch refs/heads/dlw/native-build

worktree /private/tmp/rogue-lane
HEAD 0123456789abcdef
detached
`

const census = (input) => hygiene.assembleCensus({sources: [{boundaryOp: 'seat status --json (test)', channel: 'machine-instrument', at: '2026-10-16T00:00:00Z'}], ...input})
const landedOf = seats => hygiene.seatFindings(census({seats})).filter(finding => finding.kind === 'occupied-by-landed').map(finding => finding.subject)

test('the seat text reads a clean seat\'s counts as 0 (the instrument prints a mark only when it is not zero), any branch name, and ahead and behind', () => {
  const seats = hygiene.parseSeatStatus(SEAT_TEXT)
  const by = product => seats.find(row => row.product === product)
  assert.deepEqual([by('actuation').branch, by('actuation').dirty, by('actuation').untracked, by('actuation').ahead, by('actuation').behind], ['fold/day-close-20261012', 0, 0, 3, 0])
  assert.deepEqual([by('central').branch, by('central').ahead, by('central').behind], ['fix/day-close-no-t-payloads', 1, 4])
  assert.deepEqual([by('o-i').branch, by('o-i').dirty, by('o-i').untracked, by('o-i').ahead, by('o-i').claimedBy], ['dlw/build', 4, 6, 230, 'claude-code:dlw-lead'])
  assert.deepEqual([by('factory').branch, by('factory').head, by('factory').state], [null, '6b1b7ff', 'free'])
  assert.match(by('ai-kit').admissionNote, /floor breach recorded/)
  assert.match(by('o-i').drift, /register pose/)
})

test('a clean claimed seat with nothing main does not hold is landed; a clean seat ahead of main is not — from the text and from the JSON', () => {
  assert.deepEqual(landedOf(hygiene.parseSeatStatus(SEAT_TEXT)), ['env-1/landed'], 'text: only the seat 0 ahead')
  const json = hygiene.parseSeatStatusJson(SEAT_JSON)
  assert.ok(json, 'the instrument\'s JSON is read')
  assert.deepEqual(landedOf(json), ['env-1/landed'], 'JSON: actuation (+3) and ai-kit (+2) are clean but not landed; o-i is dirty')
  // A seat whose counts were not disclosed is never called landed.
  assert.equal(hygiene.seatOnLanded({...json.find(row => row.product === 'landed'), ahead: null}), false)
  assert.equal(hygiene.seatOnLanded({...json.find(row => row.product === 'landed'), untracked: 1}), false)
})

test('the seat JSON keeps the register\'s words: drift by product, a missing checkout as unknown, the admission standing as the floor note', () => {
  const seats = hygiene.parseSeatStatusJson(SEAT_JSON)
  const by = product => seats.find(row => row.product === product)
  assert.match(by('o-i').drift, /^register pose/)
  assert.equal(by('point-cloud-demo').state, 'unknown')
  assert.match(by('ai-kit').admissionNote, /breach recorded \(18 GB free < soft 20 GB\)/)
  const findings = hygiene.seatFindings(census({seats}))
  assert.deepEqual(findings.filter(finding => finding.kind === 'checkout-missing').map(finding => finding.subject), ['env-1/point-cloud-demo'])
  assert.deepEqual(findings.filter(finding => finding.kind === 'seat-floor-breach').map(finding => finding.subject), ['env-1/ai-kit'])
  assert.equal(hygiene.parseSeatStatusJson(SEAT_TEXT), null, 'the text is not the JSON reading: the caller reads it as text')
})

test('the primary checkout is the register\'s: never a product name turned into a path; git lists the main worktree first', () => {
  const seats = hygiene.parseSeatStatusJson(SEAT_JSON)
  const worktrees = hygiene.parseWorktreeList(WORKTREES)
  assert.deepEqual(worktrees.map(row => row.main), [true, false, false, false])
  const bare = census({seats, worktrees})
  assert.ok(!hygiene.registeredSeatPaths(bare).some(path => path.endsWith('/Work/o-i')), 'no Work/o-i is invented')
  assert.deepEqual(hygiene.erroneousWorktrees(bare, hygiene.registeredSeatPaths(bare)).map(finding => finding.subject), ['/private/tmp/rogue-lane'],
    'Work/O-I (the main worktree) and the env seats are the register\'s; the rogue lane is not')
  const withRegister = census({seats, worktrees, primaries: {'o-i': 'Work/O-I', 'ql-mef': 'Work/Quaternal-Logic'}})
  const paths = hygiene.registeredSeatPaths(withRegister)
  assert.ok(paths.includes('/Users/admin/Central/Work/O-I') && paths.includes('/Users/admin/Central/Work/Quaternal-Logic'), 'the register\'s primaries, under the ground')
})

test('a stray branch is one no checkout holds (its own %(worktreepath)) and no claim accounts for — whether or not the worktree read was taken', () => {
  const branches = hygiene.parseBranchRefs([
    'dlw/build\tc5afc4aa0\t/Users/admin/Central/worktrees/env-1/o-i',
    'agent/o-i-20261007-1639\t5bd6ff239\t/Users/admin/Central/worktrees/env-3/o-i',
    'feat/finished-lane\t9988776655\t',
    'main\taaaabbbbcccc\t/Users/admin/Central/Work/O-I',
  ].join('\n'))
  const strays = input => hygiene.strayBranches(census({branches, ...input})).map(finding => finding.subject)
  assert.deepEqual(strays({worktrees: hygiene.parseWorktreeList(WORKTREES)}), ['feat/finished-lane'])
  assert.deepEqual(strays({}), ['feat/finished-lane'], 'Look at: Worktrees off — the held lane is still held')
})

test('the workcell reading names its machine workcell_ref, as `workcell status --json` prints it', () => {
  const reading = {admission: {available: false}, health: 'healthy', ok: true, workcell_ref: 'workcell:mac', workcell_ref_source: 'declared'}
  assert.equal(hygiene.workcellRefOf(reading), 'workcell:mac')
  assert.equal(hygiene.workcellRefOf({machine_ref: 'workcell:mac'}), null, 'a key Workcell does not print is not read')
  assert.equal(hygiene.workcellRefOf(null), null)
})

// NOW work refs as `central.now.list` carries them (16 Oct 2026): a seat checkout names its repo by the seat path.
const NOW = [
  {now_ref: 'central:now:seat', purpose: 'shell work in a seat', lifecycle: 'active', work_refs: [{branch: '4141add37e72b46221d3bcd71e8ccb483752332d', repo: 'worktrees/env-2/o-i', worktree_path: '/Users/admin/Central/worktrees/env-2/o-i'}]},
  {now_ref: 'central:now:seat-repo-only', purpose: 'a seat named by its repo alone', lifecycle: 'active', work_refs: [{branch: 'ui/cradle-consolidation-20260923', repo: 'worktrees/env-1/o-i'}]},
  {now_ref: 'central:now:primary', purpose: 'the primary', lifecycle: 'active', work_refs: [{branch: 'agent/nara-integration-20260921', repo: 'Work/O-I'}]},
  {now_ref: 'central:now:factory-seat', purpose: 'another product\'s seat', lifecycle: 'active', work_refs: [{branch: 'e2d16db', repo: 'worktrees/env-2/factory', worktree_path: '/Users/admin/Central/worktrees/env-2/factory'}]},
  {now_ref: 'central:now:ql-seat', purpose: 'ql-mef in a seat', lifecycle: 'active', work_refs: [{branch: 'x', repo: 'worktrees/env-3/ql-mef', worktree_path: '/Users/admin/Central/worktrees/env-3/ql-mef'}]},
]

test('Impact matches a seat\'s sessions to its project: worktrees/<env>/<product> is a checkout of the project the register names', () => {
  const oi = impact.projectSessions(NOW, {kind: 'folder', path: 'Work/O-I/packages/live-shell/ui', ref: null}, 'op now (kind:list)')
  assert.deepEqual(oi.map(touch => touch.nowRef), ['central:now:seat', 'central:now:seat-repo-only', 'central:now:primary'])
  const ql = subject => impact.projectSessions(NOW, {kind: 'folder', path: 'Work/Quaternal-Logic/crates', ref: null}, 'op now (kind:list)', subject).map(touch => touch.nowRef)
  assert.deepEqual(ql(undefined), [], 'ql-mef is not Quaternal-Logic by its name: without the register it does not match')
  assert.deepEqual(ql({'ql-mef': 'Work/Quaternal-Logic', 'o-i': 'Work/O-I'}), ['central:now:ql-seat'], 'with the register\'s primary, it does')
  assert.equal(impact.seatProductOf('/Users/admin/Central/worktrees/env-2/o-i/packages'), 'o-i')
  assert.equal(impact.seatProductOf('Work/O-I'), null)
  const reading = impact.assembleImpact({subject: {kind: 'folder', path: 'Work/O-I', ref: null}, graph: {reading: {}, boundaryOp: 'op graph', at: 't', refusal: 'graph refused'},
    now: {records: NOW, boundaryOp: 'op now (kind:list)', at: 't', refusal: null}})
  assert.equal(reading.sessions.length, 3)
})

test('the kernel receipts Central\'s readers re-read on: a receiving act or a Day write moves a Day document; a NOW write moves the NOW field', () => {
  const receipt = event => ({seq: 1, event, owner: 'central', action: 'x', ref: 'r'})
  assert.equal(notices.receiptMovesReceiving(receipt('receiving_changed')), true)
  assert.equal(notices.receiptMovesReceiving(receipt('day_changed')), true)
  assert.equal(notices.receiptMovesReceiving(receipt('now_changed')), false)
  assert.equal(notices.receiptMovesNow(receipt('now_changed')), true)
  assert.equal(notices.receiptMovesNow(receipt('receiving_changed')), false)
})
