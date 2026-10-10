import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production modules in memory (the inhabitant-manifest loader pattern):
// .ts/.tsx transpiled, CSS stubbed.
const root = new URL('../../../../', import.meta.url)
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
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const door = await import('../src/inhabitants/familyManifest.ts')
const schema = await import('../src/inhabitants/manifest.ts')
const five = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const l7 = await import('../src/inhabitants/centralFamilyL7.ts')
const hygiene = await import('../src/inhabitants/centralHygieneModel.ts')
const impact = await import('../src/inhabitants/centralImpactModel.ts')
const daynow = await import('../src/inhabitants/centralDayNowModel.ts')
const categories = await import('../src/inhabitants/centralBrowserCategories.ts')

// ---------------------------------------------------------------------------
// 1 — the extension composes additively; the L2 bases stay verbatim

test('the L7 extension composes onto central without rewriting any base', () => {
  door.resetFamilyManifestsForTest()
  five.loadAgentShellFamilies()
  const centralBase = JSON.stringify(door.familyManifest('central'))
  world.loadWorldShellFamilies()
  const centralL2 = JSON.stringify(door.familyManifest('central'))
  assert.equal(centralBase, centralL2, 'L2 composition leaves the base verbatim')
  l7.declareCentralFamilyL7()
  assert.equal(JSON.stringify(door.familyManifest('central')), centralL2, 'L7 composition leaves the base verbatim')
  // The composed manifest carries the L7 face after the L2 faces.
  const composed = schema.inhabitantManifest('central')
  const faceIds = composed.faces.map(face => face.id)
  assert.ok(faceIds.includes('ground-hygiene') && faceIds.includes('impact'), 'the L2-declared faces remain')
  assert.ok(faceIds.includes('day-now'), 'the L7-declared day-now face composes')
  assert.equal(faceIds.indexOf('day-now'), faceIds.length - 1, 'the L7 face composes last (declaration order)')
  // Validation passes on the composed family.
  assert.deepEqual([...schema.validateInhabitantManifest(composed)], [], 'the composed central manifest validates')
  // A second declaration is a no-op (the door's identity law).
  l7.declareCentralFamilyL7()
  assert.equal(schema.inhabitantManifest('central').faces.length, composed.faces.length, 're-declaration changes nothing')
})

// ---------------------------------------------------------------------------
// 2 — the hygiene census: parsing, stray branches, seat findings, tenders

const SEAT_STATUS = `workcell env-1  (/Users/admin/Central/worktrees/env-1)  disk free 44.9 GB (soft min 20, hard —)  tend: 0 MB at 10-09 02:19
  actuation  free                   detached 68a621a                              1 untracked -2
               floor breach recorded: 14.5 GB free < soft 20 GB
  o-i        claimed                agent/o-i-20261007-1639                       57 dirty 19 untracked +21 by codex:sol-new-shell
  factory    claimed                feat/ci-repair-delivery-280                   +6 by codex:improvement-parent
               floor breach recorded: 6.0 GB free < soft 20 GB
  point-cloud-demo free                   detached None                                 
  DRIFT: o-i: register pose ('agent/o-i-20261007-1639', '03b021c95') != live ('agent/o-i-20261007-1639', '5bd6ff239')
  DRIFT: point-cloud-demo: checkout missing

workcell env-2  (/Users/admin/Central/worktrees/env-2)  disk free 44.9 GB (soft min 20, hard —)  tend: 0 MB at 10-09 02:19
  o-i        free                   detached 447bebaa2                           
`

const WORKTREES = `worktree /Users/admin/Central/Work/O-I
HEAD 5bd6ff239abc
branch refs/heads/agent/o-i-20261007-1639

worktree /Users/admin/Central/worktrees/env-1/o-i
HEAD 5bd6ff239abc
branch refs/heads/agent/o-i-20261007-1639

worktree /tmp/rogue-lane
HEAD 0123456789abcdef
detached

worktree /Users/admin/Central/Work/O-I.git
HEAD 5bd6ff239abc
bare
`

const BRANCHES = [
  'agent/o-i-20261007-1639\t5bd6ff239abc\t/Users/admin/Central/worktrees/env-1/o-i',
  'feat/finished-lane\t9988776655\t',
  'main\taaaabbbbcccc\t',
  'docs/notes\td111222333\t',
].join('\n')

test('seat status parses into honest seat rows (state, branch, dirty, drift, admission)', () => {
  const seats = hygiene.parseSeatStatus(SEAT_STATUS)
  const oi = seats.find(seat => seat.workcell === 'env-1' && seat.product === 'o-i')
  assert.ok(oi)
  assert.equal(oi.state, 'claimed')
  assert.equal(oi.branch, 'agent/o-i-20261007-1639')
  assert.equal(oi.dirty, 57)
  assert.equal(oi.untracked, 19)
  assert.equal(oi.claimedBy, 'codex:sol-new-shell')
  const actuation = seats.find(seat => seat.product === 'actuation')
  assert.equal(actuation.state, 'free')
  assert.equal(actuation.branch, null)
  assert.match(actuation.admissionNote, /floor breach recorded/)
})

test('stray branches: lane-named, unclaimed, un-held — docs/ and main are never strays', () => {
  const seats = hygiene.parseSeatStatus(SEAT_STATUS)
  const worktrees = hygiene.parseWorktreeList(WORKTREES)
  const branches = hygiene.parseBranchRefs(BRANCHES)
  const census = hygiene.assembleCensus({
    sources: [{boundaryOp: 'seat status (test)', channel: 'machine-instrument', at: new Date().toISOString()}],
    worktrees, branches, seats,
  })
  const strays = hygiene.strayBranches(census)
  assert.deepEqual(strays.map(finding => finding.subject), ['feat/finished-lane'], 'only the unclaimed lane-named branch is a stray')
  assert.equal(strays[0].tenderId, 'sweep-branch')
  // The claimed branch is never a stray.
  assert.ok(!strays.some(finding => finding.subject === 'agent/o-i-20261007-1639'))
})

test('erroneous worktrees: /tmp/rogue-lane is outside the register; the bare repo and seat paths are not', () => {
  const seats = hygiene.parseSeatStatus(SEAT_STATUS)
  const worktrees = hygiene.parseWorktreeList(WORKTREES)
  const branches = hygiene.parseBranchRefs(BRANCHES)
  const census = hygiene.assembleCensus({
    sources: [{boundaryOp: 'git worktree list --porcelain (test)', channel: 'machine-instrument', at: new Date().toISOString()}],
    worktrees, branches, seats,
  })
  const seatPaths = ['/Users/admin/Central/Work/O-I', '/Users/admin/Central/worktrees/env-1', '/Users/admin/Central/worktrees/env-2']
  const errors = hygiene.erroneousWorktrees(census, seatPaths)
  assert.deepEqual(errors.map(finding => finding.subject), ['/tmp/rogue-lane'])
  assert.equal(errors[0].tenderId, 'prune-worktree')
})

test('seat findings name drift, missing checkouts and floor breaches in the instrument\u2019s own words', () => {
  const seats = hygiene.parseSeatStatus(SEAT_STATUS)
  const census = hygiene.assembleCensus({
    sources: [{boundaryOp: 'seat status (test)', channel: 'machine-instrument', at: new Date().toISOString()}],
    seats,
  })
  const findings = hygiene.seatFindings(census)
  const drift = findings.find(finding => finding.kind === 'seat-drift')
  assert.ok(drift, 'the o-i drift is a finding')
  assert.match(drift.standing, /register pose/)
  const missing = findings.find(finding => finding.kind === 'checkout-missing')
  assert.ok(missing, 'point-cloud-demo (detached None) reads as an unanswered checkout')
  const breach = findings.find(finding => finding.kind === 'seat-floor-breach')
  assert.ok(breach, 'the actuation floor breach is a finding')
  // Occupancy is its own reading.
  const occupancy = hygiene.seatOccupancy(census)
  assert.equal(occupancy.length, 2, 'two claimed seats')
  assert.match(occupancy[0].standing, /claimed by/)
})

test('a reading without its boundary operation is refused at assembly (the aperture law made structural)', () => {
  assert.throws(() => hygiene.assembleCensus({sources: [{boundaryOp: '', channel: 'kernel-op', at: new Date().toISOString()}]}), /without its boundary operation/)
})

test('the tenders are declared and name their owner operation — none carries a fire path', () => {
  assert.ok(hygiene.HYGIENE_TENDERS.length >= 3)
  for (const tender of hygiene.HYGIENE_TENDERS) {
    assert.ok(tender.ownerOperation.length > 8, `${tender.id} names its owner operation`)
    assert.match(tender.waitsFor, /instrument|commissioned|repair|owner/)
    assert.ok(tender.receiptShape.length > 8)
  }
})

// ---------------------------------------------------------------------------
// 3 — the impact projection: neighbourhood, sessions touching, legs

const GRAPH = {
  counts: {nodes: 3, edges: 4},
  edges: [
    {from_ref: 'wiki:node:day-close-law', relation: 'node-source', to_ref: 'central:source:control:root:Work/reverse-engineering/ProjectCentral/now/day/2026-10-08.md', provenance: {source: 'central.wiki.read'}},
    {from_ref: 'wiki:node:field-health', relation: 'node-source', to_ref: 'central:source:control:root:Work/reverse-engineering/ProjectCentral/now/day/2026-10-08.md', provenance: {source: 'central.wiki.read'}},
    {from_ref: 'wiki:node:day-close-law', relation: 'echoes', to_ref: 'wiki:node:field-health', provenance: {source: 'central.wiki.read'}},
    {from_ref: 'wiki:node:unrelated', relation: 'node-source', to_ref: 'central:source:control:root:Work/O-I/docs/other.md', provenance: {source: 'central.wiki.read'}},
  ],
}

test('the neighbourhood is the graph owner\u2019s one-hop cut; the second ring stays indirect', () => {
  const subject = {kind: 'note', path: 'Work/reverse-engineering/ProjectCentral/now/day/2026-10-08.md', ref: null}
  const {nodes, edges} = impact.projectNeighbourhood(GRAPH, subject)
  assert.equal(nodes.length, 3, 'the subject\u2019s source + the two wiki nodes that cite it')
  assert.equal(edges.filter(edge => edge.direct).length, 2)
  assert.equal(edges.filter(edge => !edge.direct).length, 1, 'the echoes edge between two neighbourhood nodes')
  assert.ok(!edges.some(edge => edge.fromRef === 'wiki:node:unrelated'), 'the unrelated edge is cut')
})

test('sessions touching: NOW records whose work refs name the subject\u2019s project', () => {
  const listing = [
    {now_ref: 'central:now:a', purpose: 'shell work', lifecycle: 'active', work_refs: [{repo: 'O-I', branch: 'agent/o-i-20261007-1639', worktree_path: '/Users/admin/Central/worktrees/env-1/o-i'}]},
    {now_ref: 'central:now:b', purpose: 'unrelated', lifecycle: 'archived', work_refs: [{repo: 'Factory', branch: 'main'}]},
    {now_ref: 'central:now:c', purpose: 'register walk', lifecycle: 'active', work_refs: []},
  ]
  const subject = {kind: 'folder', path: 'Work/O-I/packages/live-shell/ui', ref: null}
  const touches = impact.projectSessions(listing, subject, 'op now (kind:list)')
  assert.equal(touches.length, 1)
  assert.equal(touches[0].nowRef, 'central:now:a')
  assert.match(touches[0].work[0], /agent\/o-i-20261007-1639/)
})

test('assembleImpact carries refusals verbatim and discloses absence; the summary names refused legs', () => {
  const subject = {kind: 'note', path: 'Control/user/skills/central-field-health/SKILL.md', ref: null}
  const reading = impact.assembleImpact({
    subject,
    graph: {reading: {}, boundaryOp: 'op graph', at: 't', refusal: 'Central owner Action refused: graph unavailable'},
    now: {records: [], boundaryOp: 'op now (kind:list)', at: 't', refusal: null},
  })
  const graphLeg = reading.legs.find(leg => leg.name === 'neighbourhood')
  assert.match(graphLeg.refusal, /graph unavailable/)
  assert.equal(reading.nodes.length, 0)
  assert.match(impact.impactSummary(reading), /1 leg refused/)
})

// ---------------------------------------------------------------------------
// 4 — the day/now craft: declared controls, CAS identity, day record parsing

test('the civil controls are declared, bound to native actions, and fire from nowhere', () => {
  const ids = daynow.CIVIL_TEMPORAL_CONTROLS.map(control => control.id)
  assert.deepEqual(ids, ['day-close', 'day-rollover', 'archive-recovery'])
  for (const control of daynow.CIVIL_TEMPORAL_CONTROLS) {
    assert.equal(control.admission, 'declared')
    assert.match(control.nativeAction, /central\.|projectcentral\.|archive-recovery/)
    assert.match(control.authority, /CENTRAL_NATIVE_TOKEN|owner commission/)
    assert.ok(control.receiptShape.length > 8)
  }
})

test('CAS identity: the grammar\u2019s three parts parse; short form carries digest + length; foreign forms stay verbatim', () => {
  const parts = daynow.casParts('central.content-fnv1a64/v1:62055:c37a1b74ee2f9d0b')
  assert.equal(parts.scheme, 'central.content-fnv1a64/v1')
  assert.equal(parts.length, '62055')
  assert.equal(parts.digest, 'c37a1b74ee2f9d0b')
  assert.match(daynow.casShort('central.content-fnv1a64/v1:62055:c37a1b74ee2f9d0b'), /c37a1b74ee2f · 62055 B/)
  assert.equal(daynow.casShort('r12'), 'r12')
})

test('the day record parses into returns and carry-forward refs — the real 2026-10-08 record, read-only', async () => {
  const dayPath = new URL('../../../Work/reverse-engineering/ProjectCentral/now/day/2026-10-08.md', root)
  let content
  try {
    content = await readFile(dayPath, 'utf8')
  } catch {
    // The harness may run outside the ground layout; the fixture below
    // carries the same shape so the parser is still exercised.
    content = '# DAY — 2026-10-08\n\n## Agent returns at close\n\n### A return\n\n- actor: `codex:x`\n- kind: `note`\n- status at close: `active`\n\n## Carry forward by stable NOW source ref\n\n- `ProjectCentral/now/agents/a.json`\n'
  }
  const parsed = daynow.parseDayRecord(content)
  assert.ok(parsed.returns.length >= 30, `the real day holds its returns (${parsed.returns.length})`)
  assert.ok(parsed.carryForward.length >= 30, `the real day carries its refs forward (${parsed.carryForward.length})`)
  const shell = parsed.returns.find(entry => /Agent shell mockup/.test(entry.subject))
  assert.ok(shell, 'the agent-shell-mockup return is among them')
  assert.equal(shell.actor, 'claude-code:agent-shell-design-20261008')
  assert.equal(shell.kind, 'handoff')
})

test('subjectDayRef: the civil day a day-record path stands in', () => {
  assert.equal(daynow.subjectDayRef('Work/reverse-engineering/ProjectCentral/now/day/2026-10-08.md'), '2026-10-08')
  assert.equal(daynow.subjectDayRef('Control/user/skills/x/SKILL.md'), null)
})

// ---------------------------------------------------------------------------
// 5 — the browser categories: admitted rows from owner data, refusals as rows

test('the browser categories name their reads; the wiki category waits honestly', () => {
  const admitted = categories.CENTRAL_BROWSER_CATEGORIES.filter(category => category.admission === 'admitted')
  assert.ok(admitted.length >= 4)
  for (const category of categories.CENTRAL_BROWSER_CATEGORIES) {
    assert.ok(category.reads.every(read => /^(op |seat |git )/.test(read)), `${category.id} names its owner operations`)
  }
  const wiki = categories.CENTRAL_BROWSER_CATEGORIES.find(category => category.id === 'central-wiki')
  assert.equal(wiki.admission, 'waiting')
  const rows = categories.centralBrowserRows(wiki, {})
  assert.match(rows[0].label, /Waiting/)
})

test('a refused read renders as the row — an honest empty names itself', () => {
  const days = categories.CENTRAL_BROWSER_CATEGORIES.find(category => category.id === 'central-days')
  const rows = categories.centralBrowserRows(days, {}, [{read: 'op files_list', refusal: 'Central owner Action refused: no connector'}])
  assert.match(rows[0].label, /refused — Central owner Action refused/)
})
