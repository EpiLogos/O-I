// Ground hygiene (manual §18.5): the ground as readings, on three pages, and the tenders that clear what no work needs. Checkouts: the
// seats of each workcell, the worktrees of the project, its branches. Ground: Central's root, the world's ProjectCentral scaffold, and
// the authored ground waiting for recognition. Material: Workcell's prepared worlds, their bindings, and the sandboxes of a sandbox
// server. Live's nearest: Utility, a small effect whose meaning is plain at a glance, with the Scope pattern for a change that asks
// first (Tend: Off, Propose, Write). The picture is the page's ground itself: one ring for each reading, one tick for each thing read, a
// dot beside a tick that has a finding. The owner's classification is inhabitants/centralHygieneModel.ts: the device draws the findings
// the owner reports (their kinds) and classifies nothing itself.
//
// Everything the device draws is a value key (the shapes are the model's own, JSON strings):
//   Checkouts
//   seats      SeatReading[]       the seat instrument's rows (`seat status`): workcell, product, state, branch, head, claimedBy, dirty,
//                                  untracked, ahead, drift, admissionNote
//   worktrees  WorktreeRow[]       `git worktree list --porcelain`: path, branch, head, detached, main
//   branches   BranchRow[]         `git for-each-ref refs/heads`: name, head, checkedOutAt; `merged` (boolean) when the owner says so
//   disk       {workcell, freeGb}[]  free disk of each workcell
//   Ground (Central, through the kernel's invoke_action)
//   root       {root, valid, checks: [{path, valid}], mixed: {detected, signals}}  central.doctor: the root's required parts
//   scaffold   {project, present: [path], missing: [path]}  central.world.reproject.plan {project}: already_present and would_stamp
//   authored   {status, recognised: [{path, provenance}], waiting, listed: [{path, hints}]}  projectcentral.ground.inspect {project}:
//                                  recognised_sources, the count of native_candidates, and the candidates the model lists as findings
//                                  (those whose role hints name vision, intent, desired experience, design or architecture)
//   Material (Workcell)
//   worlds     [{ref, state, bindings: [{ref, presence, health}]}]  each persisted world receipt read by material_read (kernel/src/
//                                  material.rs; `workcell status`: persisted_world_receipts says how many there are)
//   sandboxes  {server, sandboxes: [{id, state, lease, expiresAt}]}  `workcell sandboxes reconcile --server <url> --json`, which reads and
//                                  classifies (lease live | expired-orphan | unknown) and releases nothing without --release-orphans
//   Every page
//   findings   HygieneFinding[]    the owner's classification: kind, subject, standing, boundaryOps, tenderId
//   sources    BoundaryOpSource[]  each read with its operation, and its refusal in the owner's words when it refused
//   machines   {id, label, ref, does?}[]   the machines the device can read; `machine` is the one chosen, `machineRef` the one the
//                                  readings stand on
//   light      'lit' | 'dark'      the owners answered or refused; hollow when the owner reports none
//   readAge    seconds since the sources were read       receipt / receipts   the last tender's receipt and the count
// Settings: machine, look:<ring> for each of the nine rings, faults, refresh, tend, allow:<tender> for each of the eight tenders,
//   as:provenance and as:standing (what Recognise records).
// Held by the hand: sel (the open finding), ask (a tender waiting for Confirm), page:<ring> (a list's page).
// Acts, each on its own key: reread (Read now), and the tenders, whose value is the finding's subject: release, prune, sweep (the
// seat instrument and Git), init (central.init), reproject (central.world.reproject.apply {project}), recognise
// (projectcentral.ground.apply {project, source, provenance, standing, treatment retain-native-in-place, acceptance human-accepted}),
// reconcile (`workcell --receipt R reconcile --desired <binding>=present`) and orphans (`workcell sandboxes reconcile --server <url>
// --release-orphans`). Workcell has no kernel route to reconcile or to the sandboxes yet: the host stands those disabled with its reason.
// Confirm, under Propose, sets the tender's own key.
// A key the owner does not report is absent. The picture then says which reading is missing, and every control and reading draws "—".
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type RowItem, type Standing} from '../../sdk/panel'
import {KindMark} from '../../sdk/marks'
import {assembleCensus, hygieneFindings, registeredSeatPaths, type BoundaryOpSource, type SeatReading, type WorktreeRow} from '../../centralHygieneModel'
import {NONE, boolOf, clampTo, json, numOf, st, strOf, type DesignedDevice, type Values, type ViewProps} from './design'
import './central__ground-hygiene.css'

type V = ViewProps['v']
type PageId = 'checkouts' | 'ground' | 'material'
type TenderId = 'release' | 'prune' | 'sweep' | 'init' | 'reproject' | 'recognise' | 'reconcile' | 'orphans'
type Reading = 'read' | 'off' | 'none'
type Mode = 'off' | 'propose' | 'write'
type Tick = 'seat' | 'held' | 'foreign' | 'idle'

// ------------------------------------------------------------------------------------------------ the vocabulary

/** The pages, each with its three rings from the outside in, and the order its pane lists them. */
const PAGES: Readonly<Record<PageId, {label: string; rings: readonly string[]; columns: readonly string[]; tenders: readonly TenderId[]; ops: RegExp}>> = {
  checkouts: {label: 'Checkouts', rings: ['branches', 'seats', 'worktrees'], columns: ['seats', 'worktrees', 'branches'], tenders: ['release', 'prune', 'sweep'],
    ops: /seat|worktree|for-each-ref|git_repository|workcell_status/},
  ground: {label: 'Ground', rings: ['authored', 'scaffold', 'root'], columns: ['root', 'scaffold', 'authored'], tenders: ['init', 'reproject', 'recognise'], ops: /central\.|projectcentral\./},
  material: {label: 'Material', rings: ['sandboxes', 'bindings', 'worlds'], columns: ['worlds', 'bindings', 'sandboxes'], tenders: ['reconcile', 'orphans'], ops: /material|sandboxes|reconcile/},
}
const PAGE_IDS: readonly PageId[] = ['checkouts', 'ground', 'material']
const RING_NAME: Readonly<Record<string, string>> = {seats: 'seats', worktrees: 'worktrees', branches: 'branches', root: 'root', scaffold: 'scaffold', authored: 'authored',
  worlds: 'worlds', bindings: 'bindings', sandboxes: 'sandboxes'}
const MODES: readonly Mode[] = ['off', 'propose', 'write']
const TEND = [{value: 'off', label: 'Off', does: 'The device only reads. No tender is offered.'}, {value: 'propose', label: 'Propose', does: 'Each tender waits for your confirm.'},
  {value: 'write', label: 'Write', does: 'An allowed tender runs when you press it, and returns a receipt.'}] as const
const REFRESH = [{value: 'manual', label: 'Manual', does: 'Read again only when you press Read now.'}, {value: 'open', label: 'On open', does: 'Read again when the device opens.'},
  {value: '5min', label: '5 min', does: 'Read again every 5 minutes.'}] as const
const TENDERS: Record<TenderId, {label: string; allow: string; op: string}> = {
  release: {label: 'Release seat', allow: 'allow:release', op: 'seat release <workcell> <product>: refresh the seat to origin/main and clear the claim.'},
  prune: {label: 'Prune worktree', allow: 'allow:prune', op: 'git worktree remove: remove the checkout that no seat names.'},
  sweep: {label: 'Sweep branch', allow: 'allow:sweep', op: 'git branch -d: delete the branch, which Git allows only when it is merged.'},
  init: {label: 'Initialise root', allow: 'allow:init', op: 'central.init: create the root\'s missing parts. What is already there is kept.'},
  reproject: {label: 'Reproject', allow: 'allow:reproject', op: 'central.world.reproject.apply: stamp only the scaffold that is missing. Nothing is moved or renamed.'},
  recognise: {label: 'Recognise', allow: 'allow:recognise', op: 'projectcentral.ground.apply: record the source as ground, with the provenance and standing you choose. Its bytes and its path stay.'},
  reconcile: {label: 'Reconcile', allow: 'allow:reconcile', op: 'workcell reconcile --desired <binding>=present: bring the binding back from the world\'s receipt.'},
  orphans: {label: 'Release orphans', allow: 'allow:orphans', op: 'workcell sandboxes reconcile --release-orphans: release the sandboxes whose lease has ended. A sandbox without lease evidence is never released.'},
}
/** The tender ids of the owner's model (HYGIENE_TENDERS) and the key each acts on. */
const TENDER_OF: Record<string, TenderId> = {'release-seat': 'release', 'prune-worktree': 'prune', 'sweep-branch': 'sweep', 'init-root': 'init',
  'reproject-scaffold': 'reproject', 'recognise-source': 'recognise', 'reconcile-binding': 'reconcile', 'release-orphans': 'orphans'}
/** The kinds of the owner's model (HygieneFindingKind), by the ring each stands on. */
const RING_OF: Record<string, string> = {
  'seat-claimed': 'seats', 'seat-drift': 'seats', 'seat-floor-breach': 'seats', 'checkout-missing': 'seats', 'foreign-lane': 'seats', 'occupied-by-landed': 'seats',
  'stray-branch': 'branches', 'worktree-outside-register': 'worktrees',
  'root-part-missing': 'root', 'root-mixed': 'root', 'scaffold-missing': 'scaffold', 'source-unrecognised': 'authored',
  'binding-drift': 'bindings', 'binding-lost': 'bindings', 'sandbox-orphan': 'sandboxes', 'sandbox-unproven': 'sandboxes',
}
const KIND_NAME: Record<string, string> = {
  'seat-claimed': 'Seat claimed', 'seat-drift': 'Seat drift', 'seat-floor-breach': 'Disk below floor', 'checkout-missing': 'Checkout missing', 'foreign-lane': 'Foreign lane',
  'occupied-by-landed': 'Seat on a landed branch', 'stray-branch': 'Stray branch', 'worktree-outside-register': 'Worktree outside the register',
  'root-part-missing': 'Root part missing', 'root-mixed': 'Root is a product checkout', 'scaffold-missing': 'Scaffold missing', 'source-unrecognised': 'Waiting for recognition',
  'binding-drift': 'Binding not present', 'binding-lost': 'Binding lost', 'sandbox-orphan': 'Orphan sandbox', 'sandbox-unproven': 'Sandbox without a lease',
}
const KIND_SHORT: Record<string, string> = {
  'seat-claimed': 'claimed', 'seat-drift': 'drift', 'seat-floor-breach': 'disk', 'checkout-missing': 'missing', 'foreign-lane': 'foreign', 'occupied-by-landed': 'landed',
  'stray-branch': 'stray', 'worktree-outside-register': 'outside', 'root-part-missing': 'missing', 'root-mixed': 'mixed', 'scaffold-missing': 'missing',
  'source-unrecognised': 'waiting', 'binding-drift': 'drift', 'binding-lost': 'lost', 'sandbox-orphan': 'orphan', 'sandbox-unproven': 'no lease',
}
/** The kinds that are readings and not faults. */
const NOT_FAULTS: ReadonlySet<string> = new Set(['seat-claimed', 'sandbox-unproven'])
/** What a finding with no tender says instead. */
const NO_TENDER: Record<string, string> = {'foreign-lane': 'Unmerged work of another lane. The decision is yours.', 'root-mixed': 'The root is also a product checkout. Move one of them: the decision is yours.',
  'binding-lost': 'The binding was ephemeral: its material is gone and nothing brings it back.', 'sandbox-unproven': 'Without lease evidence, the sandbox may be live. It is never released here.'}
/** Which of a finding's operations its ring was read from (a finding cites every source; the ring names its own). */
const RING_OP: Record<string, RegExp> = {seats: /seat status/, worktrees: /worktree/, branches: /for-each-ref|branch/, root: /central\.doctor/, scaffold: /reproject/,
  authored: /projectcentral\.ground/, worlds: /material/, bindings: /material|reconcile/, sandboxes: /sandboxes/}
const PROVENANCE = [{value: 'human-authored', label: 'Human-authored', does: 'You wrote it.'}, {value: 'human-edited-draft', label: 'Edited draft', does: 'A draft you edited.'},
  {value: 'human-adopted', label: 'Adopted', does: 'You adopt it as yours.'}] as const
const STANDING = [{value: 'authored-human-position', label: 'Your position', does: 'A position you hold.'}, {value: 'design-commitment', label: 'Design commitment', does: 'A commitment of the design.'},
  {value: 'architecture-contract', label: 'Architecture contract', does: 'A contract of the architecture.'}, {value: 'current-development-state', label: 'Current state', does: 'How the development stands now.'}] as const

const tendOf = (v: V): Mode | undefined => { const m = strOf(v, 'tend'); return m === 'off' || m === 'propose' || m === 'write' ? m : undefined }
const light = (p: ViewProps): LightState => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const pageOf = (p: ViewProps): PageId => (PAGE_IDS.includes(p.page as PageId) ? p.page as PageId : 'checkouts')

// ------------------------------------------------------------------------------------------------ the ground that was read

interface Machine {readonly id: string; readonly label?: string; readonly ref?: string; readonly does?: string}
interface Branch {readonly name: string; readonly head?: string | null; readonly checkedOutAt?: string | null; readonly merged?: boolean}
interface Reported {readonly kind: string; readonly subject: string; readonly standing?: string; readonly boundaryOps?: unknown; readonly tenderId?: unknown}
interface Finding {
  readonly id: string; readonly ring: string; readonly at: number | undefined; readonly kind: string; readonly fault: boolean; readonly subject: string
  readonly standing: string; readonly ops: readonly string[]; readonly tender: TenderId | undefined; readonly merged: boolean | undefined
}
/** One ring as read: what stops it, a tick for each thing read, and the things read beyond the ticks (waiting sources). */
interface RingRead {readonly reading: Reading; readonly ticks: readonly Tick[]; readonly subjects: readonly string[]; readonly beyond?: number; readonly legend?: string}

const text = (x: unknown): x is string => typeof x === 'string' && x.length > 0
const rec = (x: unknown): Record<string, unknown> | undefined => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : undefined)
/** A JSON list the owner reported, or undefined when the key is absent or holds no list. A row without its identity is left out. */
function listOf<T>(v: V, key: string, keep: (row: Record<string, unknown>) => boolean): T[] | undefined {
  const rows = json<unknown>(v, key, undefined)
  if (!Array.isArray(rows)) return undefined
  return rows.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && keep(row as Record<string, unknown>)) as unknown as T[]
}

/** Every ring of every page, read from the values: what it read, a tick for each thing, and the subjects the owner's findings name. */
function readRings(v: V): Record<string, RingRead | undefined> {
  const seats = listOf<SeatReading>(v, 'seats', r => text(r.workcell) && text(r.product))
  const trees = listOf<WorktreeRow>(v, 'worktrees', r => text(r.path))
  const branches = listOf<Branch>(v, 'branches', r => text(r.name))
  const root = rec(json<unknown>(v, 'root', undefined)), scaffold = rec(json<unknown>(v, 'scaffold', undefined)), authored = rec(json<unknown>(v, 'authored', undefined))
  const worlds = listOf<{ref: string; state?: string; bindings?: unknown}>(v, 'worlds', r => text(r.ref)), boxes = rec(json<unknown>(v, 'sandboxes', undefined))
  const read = (ticks: Tick[], subjects: string[], extra: Partial<RingRead> = {}): RingRead => ({reading: 'read', ticks, subjects, ...extra})
  const checks = Array.isArray(root?.checks) ? root!.checks.flatMap(c => { const r = rec(c); return r && text(r.path) ? [{path: r.path as string, valid: r.valid === true}] : [] }) : []
  const paths = (x: unknown) => (Array.isArray(x) ? x.flatMap(p => (text(p) ? [p] : text(rec(p)?.path) ? [rec(p)!.path as string] : [])) : [])
  const known = Array.isArray(authored?.recognised) ? paths(authored!.recognised) : [], listed = Array.isArray(authored?.listed) ? paths(authored!.listed) : []
  const waiting = typeof authored?.waiting === 'number' ? authored.waiting : undefined
  const bindings = (worlds ?? []).flatMap(w => (Array.isArray(w.bindings) ? w.bindings.flatMap(b => { const r = rec(b); return r && text(r.ref) ? [{subject: `${w.ref}#${r.ref}`, presence: r.presence as string | undefined, health: r.health as string | undefined}] : [] }) : []))
  const sandboxes = Array.isArray(boxes?.sandboxes) ? boxes!.sandboxes.flatMap(b => { const r = rec(b); return r && text(r.id) ? [{id: r.id as string, lease: r.lease as string | undefined}] : [] }) : undefined
  return {
    seats: seats && read(seats.map(s => (s.state === 'claimed' ? 'seat' : s.state === 'free' ? 'idle' : 'foreign')), seats.map(s => `${s.workcell}/${s.product}`)),
    worktrees: trees && read(trees.map(() => 'held'), trees.map(t => t.path)),
    branches: branches && read(branches.map(b => (b.checkedOutAt ? 'held' : 'idle')), branches.map(b => b.name)),
    root: root && read(checks.map(c => (c.valid ? 'held' : 'foreign')), checks.map(c => c.path)),
    scaffold: scaffold && read([...paths(scaffold.present).map((): Tick => 'held'), ...paths(scaffold.missing).map((): Tick => 'foreign')], [...paths(scaffold.present), ...paths(scaffold.missing)]),
    authored: authored && read([...known.map((): Tick => 'held'), ...listed.map((): Tick => 'idle')], [...known, ...listed],
      {beyond: waiting === undefined ? undefined : Math.max(0, waiting - listed.length), legend: waiting === undefined ? undefined : `${waiting} waiting`}),
    worlds: worlds && read(worlds.map(w => (w.state === 'healthy' ? 'held' : w.state === 'degraded' ? 'seat' : 'foreign')), worlds.map(w => w.ref)),
    bindings: worlds && read(bindings.map(b => (b.presence === 'present' ? 'held' : b.presence === 'missing' || b.presence === 'stale' ? 'foreign' : 'idle')), bindings.map(b => b.subject)),
    sandboxes: sandboxes && read(sandboxes.map(b => (b.lease === 'live' ? 'held' : b.lease === 'expired-orphan' ? 'foreign' : 'idle')), sandboxes.map(b => b.id)),
  }
}

/** One page as read: its rings, the owner's findings on them, and what the device shows. A ring with no reading, or read from another
 * machine than the one chosen, has no reading; a finding of a kind this device does not know, whose subject no ring holds, is not drawn. */
function readPage(v: V, page: PageId) {
  const rings = readRings(v), names = PAGES[page].rings
  const reported = listOf<Reported>(v, 'findings', r => text(r.kind) && text(r.subject))
  const machines = listOf<Machine>(v, 'machines', r => text(r.id))
  const chosen = machines?.find(m => m.id === strOf(v, 'machine'))
  const standsOn = strOf(v, 'machineRef')
  const elsewhere = !!chosen?.ref && standsOn !== undefined && chosen.ref !== standsOn
  const reading = Object.fromEntries(names.map(r => [r, boolOf(v, `look:${r}`) === false ? 'off' : elsewhere || !rings[r] ? 'none' : 'read'])) as Record<string, Reading>
  const branches = listOf<Branch>(v, 'branches', r => text(r.name))
  const all: Finding[] = []
  for (const f of reported ?? []) {
    const ring = RING_OF[f.kind] ?? names.find(r => rings[r]?.subjects.includes(f.subject))
    if (!ring || !names.includes(ring)) continue
    const i = rings[ring]?.subjects.indexOf(f.subject) ?? -1, at = i < 0 ? undefined : i, branch = ring === 'branches' && at !== undefined ? branches?.[at] : undefined
    all.push({id: `${f.kind}:${f.subject}`, ring, at, kind: f.kind, fault: !NOT_FAULTS.has(f.kind), subject: f.subject, standing: text(f.standing) ? f.standing : NONE,
      ops: Array.isArray(f.boundaryOps) ? f.boundaryOps.filter(text) : [], tender: text(f.tenderId) ? TENDER_OF[f.tenderId] : undefined,
      merged: typeof branch?.merged === 'boolean' ? branch.merged : undefined})
  }
  const faultsOnly = boolOf(v, 'faults') === true
  const shown = all.filter(f => reading[f.ring] === 'read' && (!faultsOnly || f.fault))
  const count = Object.fromEntries(names.map(r => [r, {read: rings[r]?.ticks.length ?? 0, flagged: shown.filter(f => f.ring === r).length}])) as Record<string, {read: number; flagged: number}>
  return {page, names, rings, reading, machines, chosen, standsOn, elsewhere, found: reported !== undefined, shown, faultsOnly, noun: faultsOnly ? 'faults' : 'findings',
    anyRead: names.some(r => reading[r] === 'read'), count}
}
type Ground = ReturnType<typeof readPage>
const GROUNDS = new WeakMap<V, Partial<Record<PageId, Ground>>>()
function ground(v: V, page: PageId): Ground {
  const cache = GROUNDS.get(v) ?? {}
  if (!cache[page]) { cache[page] = readPage(v, page); GROUNDS.set(v, cache) }
  return cache[page]!
}
/** Every finding the device shows, on every page: the folded head's count. */
const allShown = (v: V) => PAGE_IDS.map(id => ground(v, id)).filter(g => g.anyRead && g.found)

/** The machine the readings are about: the one chosen, else the one they stand on. */
const refOf = (g: Ground) => g.chosen?.ref ?? g.standsOn ?? NONE
const cornerOf = (g: Ground) => (g.anyRead && g.found ? `${g.shown.length} ${g.noun}` : NONE)
const totalOf = (v: V) => { const gs = allShown(v); return gs.length ? `${gs.reduce((n, g) => n + g.shown.length, 0)} ${gs[0]!.noun}` : NONE }
const title = (ring: string) => ring[0]!.toUpperCase() + ring.slice(1)
/** What stops a ring from drawing, in words. */
const missing = (g: Ground, ring: string) => (g.reading[ring] === 'off' ? `Look at has ${title(ring)} Off.`
  : g.elsewhere ? `No reading from ${refOf(g)}.` : `No reading of the ${RING_NAME[ring] ?? ring}.`)

/** Whether a tender can run now, and if not, why. The host's standing for the tender's key comes last. */
function tenderState(p: ViewProps, f: Finding): {ok: boolean; why?: string} {
  if (!f.tender) return {ok: false}
  const t = TENDERS[f.tender], mode = tendOf(p.v), allowed = boolOf(p.v, t.allow)
  if (mode === undefined) return {ok: false, why: 'Tend has no reading.'}
  if (mode === 'off') return {ok: false, why: 'Tend is Off. Set Tend to Propose or Write.'}
  if (allowed === undefined) return {ok: false, why: `Whether ${t.label} is allowed has no reading.`}
  if (!allowed) return {ok: false, why: `${t.label} is not allowed. Turn it on in the pool.`}
  if (f.tender === 'sweep' && f.merged === false) return {ok: false, why: 'This branch holds unmerged work. Leave it to its lane.'}
  if (f.tender === 'recognise' && (!strOf(p.v, 'as:provenance') || !strOf(p.v, 'as:standing'))) return {ok: false, why: 'Choose its provenance and standing first.'}
  const held = st(p, f.tender).disabled
  return held ? {ok: false, why: held} : {ok: true}
}
/** A tender's value: the finding's subject, with the provenance and standing Recognise records. */
const tenderValue = (p: ViewProps, f: Finding) => (f.tender === 'recognise' ? JSON.stringify({source: f.subject, provenance: strOf(p.v, 'as:provenance'), standing: strOf(p.v, 'as:standing')}) : f.subject)
/** A tender asks first under Propose, and acts at once under Write. */
function press(p: ViewProps, f: Finding) {
  if (!f.tender) return
  if (tendOf(p.v) === 'propose') p.set('ask', f.id)
  else p.set(f.tender, tenderValue(p, f))
}
function confirm(p: ViewProps, f: Finding) {
  if (!f.tender) return
  p.set(f.tender, tenderValue(p, f))
  p.set('ask', undefined)
}
/** One control for several keys (Look at): the first key's standing wins where more than one has any. */
const stOfAll = (p: ViewProps, keys: readonly string[]): Standing => Object.assign({}, ...keys.map(k => st(p, k)).reverse()) as Standing

// ------------------------------------------------------------------------------------------------ the picture

const RING_R = [1, .7, .4]
const polar = (cx: number, cy: number, r: number, i: number, n: number) => {
  const a = -Math.PI / 2 + 2 * Math.PI * (i + .5) / n
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
}
const LEVER = [-40, 0, 40]

/** Three rings, from the outside in as the page names them. A tick for each thing read; a dot beside a tick that has a finding (orange a
 * fault, teal a reading); an amber ring on the dot where a tender fits. Things read beyond the ticks (sources waiting for recognition)
 * close the ring with a dotted arc. Handle 1 sets Tend. */
function Rings({p, page, w, h, legend, small, live}: {p: ViewProps; page: PageId; w: number; h: number; legend?: boolean; small?: boolean; live?: boolean}) {
  const g = ground(p.v, page), mode = tendOf(p.v), tendStanding = st(p, 'tend')
  const cx = small ? w / 2 : 70, cy = small ? h / 2 : 66, R = small ? w / 2 - 9 : 44, t = small ? 1.6 : 2.4, off = small ? 4 : 6.5
  const marks = (ring: string, k: number) => {
    const read = g.rings[ring]
    if (g.reading[ring] !== 'read' || !read) return null
    const beyond = read.beyond ?? 0, n = read.ticks.length, r = R * RING_R[k]!
    // The things read beyond the ticks take a share of the ring as wide as the ticks take, at most half of it.
    const share = beyond > 0 ? Math.min(.5, beyond / (beyond + n)) : 0, slots = n === 0 ? 0 : Math.round(n / (1 - share))
    const lines: Record<Tick, string> = {seat: '', held: '', foreign: '', idle: ''}
    for (let i = 0; i < n; i++) {
      const [x1, y1] = polar(cx, cy, r - t, i, Math.max(slots, n)), [x2, y2] = polar(cx, cy, r + t, i, Math.max(slots, n)), kind = read.ticks[i]!
      lines[kind] = `${lines[kind]}M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`
    }
    const flagged = new Map<number, Finding[]>()
    g.shown.filter(f => f.ring === ring && f.at !== undefined).forEach(f => flagged.set(f.at!, [...(flagged.get(f.at!) ?? []), f]))
    const a0 = -Math.PI / 2 + 2 * Math.PI * (n / Math.max(slots, 1)), a1 = 3 * Math.PI / 2
    return <g key={ring}>
      {share > 0 && n === 0 && <circle cx={cx} cy={cy} r={r} stroke="var(--stall)" strokeWidth={small ? 1.2 : 1.6} strokeDasharray="1 2.5" fill="none" />}
      {share > 0 && n > 0 && <path d={`M${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)}`}
        stroke="var(--stall)" strokeWidth={small ? 1.2 : 1.6} strokeDasharray="1 2.5" fill="none" />}
      <path d={lines.idle} stroke="var(--text-faint)" strokeWidth={small ? .8 : 1} opacity={.7} fill="none" />
      <path d={lines.held} stroke="var(--dp-value)" strokeWidth={small ? .9 : 1.3} fill="none" />
      <path d={lines.seat} stroke="var(--dp-value)" strokeWidth={small ? 1 : 1.5} fill="none" />
      <path d={lines.foreign} stroke="var(--stall)" strokeWidth={small ? 1 : 1.5} fill="none" />
      {[...flagged].map(([i, fs]) => {
        const [x, y] = polar(cx, cy, r + off, i, Math.max(slots, n)), fault = fs.some(f => f.fault), fits = fs.some(f => tenderState(p, f).ok)
        return <g key={i}>
          <circle cx={x} cy={y} r={k === 0 ? t * .8 : t} fill={fault ? 'var(--stall)' : 'var(--dp-value)'} />
          {fits && !small && <circle cx={x} cy={y} r={t + 2.2} fill={mode === 'write' ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'none'} stroke="var(--accent)" strokeWidth={1} />}
        </g>
      })}
    </g>
  }
  const modeAt = mode === undefined ? -1 : MODES.indexOf(mode)
  const drag = live && !tendStanding.disabled ? (x: number) => p.set('tend', MODES[Math.round(clampTo(0, 2, (x - cx + 40) / 40))]!) : undefined
  return <g>
    {g.names.map((ring, k) => <g key={ring}>
      <circle cx={cx} cy={cy} r={R * RING_R[k]!} className="dp-faint" strokeDasharray={g.reading[ring] === 'read' ? undefined : '2 3'} opacity={g.reading[ring] === 'read' ? 1 : .6} />
      {marks(ring, k)}
    </g>)}
    {!g.anyRead && <text x={cx} y={cy + 3} className="dp-axis" textAnchor="middle">no reading</text>}
    {legend && g.names.map((ring, i) => {
      const c = g.count[ring]!, y = 24 + i * 40, read = g.rings[ring]
      return <g key={ring}>
        <text x={134} y={y} className="dp-axis">{RING_NAME[ring]}</text>
        <text x={134} y={y + 12} className="dp-ink">{g.reading[ring] === 'read' ? `${read?.legend && read.ticks.length === 0 ? read.legend : `${c.read} read`}` : g.reading[ring] === 'off' ? 'Off' : 'no reading'}</text>
        {g.reading[ring] === 'read' && <text x={134} y={y + 23} className="dp-ink-dim">{read?.legend && read.ticks.length > 0 ? read.legend : `${g.found ? c.flagged : NONE} flagged`}</text>}
      </g>
    })}
    {!small && <g>
      <path d={`M${cx + LEVER[0]!} 137H${cx + LEVER[2]!}`} className="dp-faint" />
      {LEVER.map((dx, i) => <g key={i}>
        <circle cx={cx + dx} cy={137} r={1.8} fill="var(--text-faint)" />
        {mode !== undefined && <text x={cx + dx} y={129} className="dp-axis" textAnchor="middle">{MODES[i]}</text>}
      </g>)}
      {mode === undefined
        ? <text x={cx} y={129} className="dp-axis" textAnchor="middle">no reading of Tend</text>
        : <Handle n={1} x={cx + LEVER[modeAt]!} y={137} label="Tend" does="Drag along the line: Off, Propose or Write. Propose waits for your confirm."
          onDrag={drag} onReset={drag && (() => p.set('tend', 'propose'))} />}
    </g>}
  </g>
}
const RINGS_SAY: Readonly<Record<PageId, string>> = {
  checkouts: 'Rings of branches, seats and worktrees',
  ground: 'Rings of the authored sources, the world\'s scaffold and the root; a dotted arc for the sources waiting',
  material: 'Rings of the sandboxes, the worlds\' bindings and the worlds',
}

// ------------------------------------------------------------------------------------------------ the controls

/** Which of the page's three readings are on, as one choice: empty while any of them is unreported. */
function lookMode(v: V, names: readonly string[]): string {
  const on = names.map(r => boolOf(v, `look:${r}`))
  if (on.some(x => x === undefined)) return ''
  const n = on.filter(Boolean).length
  return n === 3 ? 'all' : n === 0 ? 'none' : n === 1 ? names[on.indexOf(true)]! : 'two'
}
function LookAt({p, page}: {p: ViewProps; page: PageId}) {
  const names = PAGES[page].rings, mode = lookMode(p.v, names)
  const options = [{value: 'all', label: 'All', does: `Read the ${names.join(', ')}.`}, ...names.map(r => ({value: r, label: title(RING_NAME[r]!), does: `Read the ${RING_NAME[r]} only.`})),
    ...(mode === 'two' || mode === 'none' ? [{value: mode, label: mode === 'two' ? 'Two' : 'None', does: 'Set in the pool.'}] : [])]
  return <Chooser {...stOfAll(p, names.map(r => `look:${r}`))} label="Look at" wide does="Which readings the device takes on this page. It turns the page's three readings On or Off together." value={mode} options={options}
    onChange={x => { if (x === 'two' || x === 'none') return; names.forEach(r => p.set(`look:${r}`, x === 'all' || x === r)) }} />
}
function RefreshChooser({p, label = 'Refresh'}: {p: ViewProps; label?: string}) {
  return <Chooser {...st(p, 'refresh')} label={label} wide does="When the device reads again." value={strOf(p.v, 'refresh') ?? ''} options={REFRESH} onChange={x => p.set('refresh', x)} />
}
function TendRadio({p}: {p: ViewProps}) {
  return <Radio {...st(p, 'tend')} label="Tend" does="Off: only read. Propose: a tender waits for your confirm. Write: a tender runs when you press it." value={tendOf(p.v) ?? ''} options={TEND} stack onChange={x => p.set('tend', x)} />
}
function FaultsToggle({p, label}: {p: ViewProps; label: string}) {
  const now = boolOf(p.v, 'faults')
  return <Toggle {...st(p, 'faults')} label={label} does="On: hide the findings that are not faults. A claimed seat is not a fault." on={now === true} unknown={now === undefined} onChange={x => p.set('faults', x)} />
}

const shortSubject = (f: Finding) => (f.ring === 'bindings' ? f.subject.split('#').pop()!.replace(/^connectivity:service:|\/.*$/g, '') : f.subject.split('/').slice(-2).join('/'))
const rowsOf = (g: Ground): RowItem[] => (!g.anyRead ? [{id: 'none', name: 'No reading', light: 'unknown'}]
  : !g.found ? [{id: 'none', name: 'No reading of the findings', light: 'unknown'}]
  : g.shown.length === 0 ? [{id: 'clear', name: 'No findings', light: 'lit', tone: 'green'}]
  : g.shown.map((f): RowItem => ({id: f.id, name: shortSubject(f), light: 'lit', tone: f.fault ? 'stall' : 'value', note: KIND_SHORT[f.kind] ?? f.kind,
    does: `${KIND_NAME[f.kind] ?? f.kind}: ${f.standing}`})))

// ------------------------------------------------------------------------------------------------ the pane

const COLUMN_MARK: Readonly<Record<string, 'place' | 'source' | 'journey'>> = {seats: 'place', worktrees: 'source', branches: 'journey', root: 'place', scaffold: 'source', authored: 'journey',
  worlds: 'place', bindings: 'source', sandboxes: 'journey'}
const PAGE = 10
const lastName = (f: Finding) => (f.ring === 'worktrees' ? f.subject.replace(/^\/Users\/[^/]+\/Central\//, '') : f.ring === 'bindings' ? f.subject.split('#').pop()!
  : f.ring === 'scaffold' ? f.subject.replace(/^Work\/[^/]+\//, '') : f.subject)
/** Free disk of each workcell, in the owner's order: those of the machine the readings stand on. */
function diskOf(v: V, g: Ground): string {
  if (g.elsewhere) return NONE
  const rows = listOf<{workcell: string; freeGb?: unknown}>(v, 'disk', r => text(r.workcell))
  if (!rows?.length) return NONE
  return rows.map(r => `${r.workcell} ${typeof r.freeGb === 'number' && Number.isFinite(r.freeGb) ? `${r.freeGb.toFixed(1)} GB` : NONE}`).join(' · ')
}
/** The page's own line at the head of the pane: the disk for the checkouts, the root and project for the ground, the server for the material. */
function topLine(v: V, g: Ground): string {
  if (g.page === 'checkouts') return `disk free ${diskOf(v, g)}`
  if (g.page === 'ground') { const r = rec(json<unknown>(v, 'root', undefined)), s = rec(json<unknown>(v, 'scaffold', undefined)); return `root ${text(r?.root) ? r!.root as string : NONE} · project ${text(s?.project) ? s!.project as string : NONE}` }
  const b = rec(json<unknown>(v, 'sandboxes', undefined)); return `sandbox server ${text(b?.server) ? b!.server as string : NONE}`
}

function PaneTabs({p, page}: {p: ViewProps; page: PageId}) {
  return <div className="ref-pane-tabs" role="tablist" aria-label="Pages">
    {PAGE_IDS.map(id => { const g = ground(p.v, id); return <button key={id} type="button" role="tab" aria-selected={id === page} onClick={() => p.setPage(id)}>
      {PAGES[id].label}{g.anyRead && g.found ? ` · ${g.shown.length}` : ''}</button> })}
  </div>
}

function Pane({p}: {p: ViewProps}) {
  const page = pageOf(p), g = ground(p.v, page), sel = g.shown.find(f => f.id === strOf(p.v, 'sel'))
  const sources = listOf<BoundaryOpSource>(p.v, 'sources', r => text(r.boundaryOp))?.filter(s => PAGES[page].ops.test(s.boundaryOp))
  return <div className="ref-pane-body hy-pane">
    <PaneTabs p={p} page={page} />
    <div className="hy-top">
      <h3>Ground hygiene<small>{refOf(g)} · {g.anyRead && g.found ? `${g.shown.length} ${g.noun}` : 'no reading'}</small></h3>
      <span className="hy-disk">{topLine(p.v, g)}</span>
      <ul className="hy-sources">
        {sources === undefined || sources.length === 0
          ? <li className="hy-source"><em>No reading of the sources.</em></li>
          : sources.map(s => <li key={s.boundaryOp} className="hy-source" data-refused={s.refusal ? 'true' : undefined}>
            <span className="dp-lamp" data-light={s.refusal ? 'dark' : 'lit'} data-tone={s.refusal ? 'stall' : 'green'} /><code>{s.boundaryOp}</code><em>{s.refusal ?? 'answered'}</em>
          </li>)}
      </ul>
    </div>
    <div className="hy-cols">
      {PAGES[page].columns.map(ring => {
        const all = g.shown.filter(f => f.ring === ring), pages = Math.max(1, Math.ceil(all.length / PAGE)), at = Math.min(numOf(p.v, `page:${ring}`) ?? 0, pages - 1)
        const rows = all.slice(at * PAGE, at * PAGE + PAGE), read = g.rings[ring]
        return <section key={ring} className="hy-col" aria-label={title(RING_NAME[ring]!)}>
          <h4><KindMark kind={COLUMN_MARK[ring]!} size={14} />{title(RING_NAME[ring]!)}<b data-i="Flagged of read|The things with a finding, of the things the device read.">{g.reading[ring] === 'read' ? `${g.found ? all.length : NONE} of ${read?.legend ?? g.count[ring]!.read}` : g.reading[ring] === 'off' ? 'Off' : NONE}</b>
            {pages > 1 && <span className="hy-pager">
              <button type="button" aria-label="Previous page" disabled={at === 0} onClick={() => p.set(`page:${ring}`, at - 1)}>‹</button>
              <span>{at + 1}/{pages}</span>
              <button type="button" aria-label="Next page" disabled={at === pages - 1} onClick={() => p.set(`page:${ring}`, at + 1)}>›</button>
            </span>}
          </h4>
          {g.reading[ring] !== 'read'
            ? <p className="hy-none">{missing(g, ring)}</p>
            : !g.found ? <p className="hy-none">No reading of the findings.</p>
            : all.length === 0 ? <p className="hy-none">No findings.</p>
            : <ul className="hy-list">
              {rows.map(f => <li key={f.id}><button type="button" className="hy-row" aria-pressed={sel?.id === f.id} onClick={() => p.set('sel', f.id)}
                data-i={`${KIND_NAME[f.kind] ?? f.kind}|${f.standing}`}>
                <span className="hy-dot" data-fault={f.fault} data-tender={tenderState(p, f).ok ? 'true' : undefined} /><b>{lastName(f)}</b><i>{KIND_SHORT[f.kind] ?? f.kind}</i>
              </button></li>)}
            </ul>}
        </section>
      })}
    </div>
    <div className="hy-detail">
      {sel ? <>
        <div>
          <h5>{KIND_NAME[sel.kind] ?? sel.kind}<small>{lastName(sel)}</small></h5>
          <p>{sel.standing}</p>
          <p className="hy-rests">Rests on <code>{restsOn(sel)}</code></p>
        </div>
        <Tender p={p} f={sel} />
      </> : <>
        <div>
          <h5>Select a row</h5>
          <p>Read what a finding rests on and which tender fits. A finding is a reading, not a verdict.</p>
        </div>
        <div className="hy-tend">{strOf(p.v, 'receipt') ? <small className="hy-receipt">Receipt{numOf(p.v, 'receipts') === undefined ? '' : ` ${numOf(p.v, 'receipts')}`}: {strOf(p.v, 'receipt')}</small> : <small>No receipt reported.</small>}</div>
      </>}
    </div>
  </div>
}
const restsOn = (f: Finding) => {
  const own = f.ops.filter(op => (RING_OP[f.ring] ?? /./).test(op))
  return (own.length ? own : f.ops).join(' · ') || NONE
}

function Tender({p, f}: {p: ViewProps; f: Finding}) {
  if (!f.tender) return <div className="hy-tend"><small>{NO_TENDER[f.kind] ?? 'No tender fits this finding.'}</small></div>
  const can = tenderState(p, f), asking = strOf(p.v, 'ask') === f.id, stand = st(p, f.tender), t = TENDERS[f.tender]
  const as = f.tender === 'recognise' && <div className="hy-as">
    <Chooser {...st(p, 'as:provenance')} label="Provenance" wide does="Who made the source, as Recognise records it." value={strOf(p.v, 'as:provenance') ?? ''} options={PROVENANCE} onChange={x => p.set('as:provenance', x)} />
    <Chooser {...st(p, 'as:standing')} label="Standing" wide does="What the source stands as, as Recognise records it." value={strOf(p.v, 'as:standing') ?? ''} options={STANDING} onChange={x => p.set('as:standing', x)} />
  </div>
  return <div className="hy-tend">
    {asking
      ? <>
        <small>{t.op}</small>
        <div className="hy-tend-acts">
          <Action {...stand} hold label="Confirm" does={`Run: ${t.label}.`} onPress={() => confirm(p, f)} disabled={can.ok ? undefined : can.why ?? 'No tender runs here.'} />
          <Action label="Cancel" does="Keep the ground as it is." onPress={() => p.set('ask', undefined)} />
        </div>
      </>
      : <>
        {as}
        <div className="hy-tend-acts">
          <Action {...stand} label={t.label} does={t.op} onPress={() => press(p, f)} disabled={can.ok ? undefined : can.why ?? 'No tender runs here.'} />
          <small>{can.ok ? (tendOf(p.v) === 'propose' ? 'Tend is Propose: you confirm first.' : 'Tend is Write: it runs when you press it.') : can.why}</small>
        </div>
      </>}
  </div>
}

// ------------------------------------------------------------------------------------------------ the sample readings
// What the gallery reads on, in the shapes of centralHygieneModel: the real `seat status` of env-1 to env-3 and the real worktrees and
// branches of O-I (15 Oct). `defaults` and `fixtures` use them and nothing else does. The findings are the model's own classification of
// the census, as the shell would hand it over.

const dump = (x: unknown) => JSON.stringify(x)
const SAMPLE_AT = '2026-10-15T09:12:00.000Z'
const KERNEL_WORKCELL: BoundaryOpSource = {boundaryOp: 'op workcell_status_read', channel: 'kernel-op', at: SAMPLE_AT}
const KERNEL_GIT: BoundaryOpSource = {boundaryOp: 'op git_repository_read (project O-I)', channel: 'kernel-op', at: SAMPLE_AT}

function sample(opts: {merged?: boolean; foreign?: boolean} = {}) {
  const root = '/Users/admin/Central', cell = (env: string) => `${root}/worktrees/${env}`
  const LEAD = 'claude-code:dlw-lead', CONDUCTOR = 'claude-code:dlw-conductor'
  const pose = (a: string, b: string, c: string, d: string) => `register pose ('${a}', '${b}') != live ('${c}', '${d}')`
  const floor = (gb: string) => ({admissionNote: `floor breach recorded: ${gb} GB free < soft 20 GB`})
  const seat = (env: string, product: string, head: string, more: Partial<SeatReading> = {}): SeatReading => ({
    workcell: env, workcellPath: cell(env), product, state: 'free', branch: null, head, claimedBy: null, dirty: null, untracked: null, ahead: null, behind: null,
    drift: null, admissionNote: null, ...more,
  })
  const lane = (branch: string, by: string, ahead: number, more: Partial<SeatReading> = {}): Partial<SeatReading> => ({state: 'claimed', branch, claimedBy: by, dirty: 0, untracked: 0, ahead, ...more})
  const foreign = (s: SeatReading): SeatReading => (opts.foreign && s.workcell === 'env-3' && s.product === 'o-i' ? {...s, state: 'occupied-foreign-lane', branch: 'feat/central-field-base', head: '963383814'} : s)
  const seats: SeatReading[] = [
    seat('env-1', 'actuation', '933731e', lane('fold/day-close-20261012', CONDUCTOR, 3, {drift: pose('fold/day-close-20261012', '7b4af99', 'fold/day-close-20261012', '933731e')})),
    seat('env-1', 'ai-kit', 'c2e1be91', lane('speed/root-register-stays-warm', LEAD, 1, {...floor('18.0'), drift: pose('speed/root-register-stays-warm', '7af8d11d', 'speed/root-register-stays-warm', 'c2e1be91')})),
    seat('env-1', 'central', '8aa1065', lane('fix/day-close-no-t-payloads', CONDUCTOR, opts.merged ? 0 : 1, {drift: pose('fold/day-close-20261012', 'cf58c54', 'fix/day-close-no-t-payloads', '8aa1065')})),
    seat('env-1', 'factory', '6b1b7ff'),
    seat('env-1', 'o-i', '9b6caea90', lane('dlw/build', LEAD, 197, {dirty: 30, untracked: 15, drift: pose('dlw/phase1-semantics-20261013', 'cc69e19fa', 'dlw/build', '9b6caea90')})),
    seat('env-1', 'ql-mef', '37e3085'), seat('env-1', 'workcell', '59f94a3'), seat('env-1', 'point-cloud-demo', 'e9c7ccb'),
    seat('env-2', 'actuation', 'cd1f4ce'), seat('env-2', 'ai-kit', '01987475'),
    seat('env-2', 'central', '352bc31', lane('speed/source-horizon-writes-on-change', LEAD, 1, {...floor('18.0'), drift: pose('speed/source-horizon-writes-on-change', '4a3e423', 'speed/source-horizon-writes-on-change', '352bc31')})),
    seat('env-2', 'factory', '96a7fef'),
    seat('env-2', 'o-i', '2de90416e', lane('dlw/native-build', LEAD, 171, {untracked: 1, drift: pose('dlw/native-build', '2491a11b6', 'dlw/native-build', '2de90416e')})),
    seat('env-2', 'ql-mef', '73097be', floor('17.4')), seat('env-2', 'workcell', '1023071', floor('18.2')), seat('env-2', 'point-cloud-demo', 'e9c7ccb'),
    seat('env-3', 'actuation', 'cd1f4ce', floor('15.3')), seat('env-3', 'ai-kit', '01987475', floor('10.7')),
    seat('env-3', 'central', 'cf58c54', floor('9.3')), seat('env-3', 'factory', '96a7fef'), seat('env-3', 'o-i', '65202d830'),
    seat('env-3', 'ql-mef', '36f9eb0'), seat('env-3', 'workcell', 'a716cd3'), seat('env-3', 'point-cloud-demo', 'e9c7ccb'),
  ].map(foreign)

  const tree = (path: string, branch: string | null, head: string, more: Partial<WorktreeRow> = {}): WorktreeRow => ({path, head, branch, bare: false, detached: branch === null, ...more})
  const trees: WorktreeRow[] = [
    tree(`${root}/Work/O-I`, 'main', '1cc77db12', {main: true}),
    tree(`${cell('env-1')}/o-i`, 'dlw/build', '9b6caea90'),
    tree(`${cell('env-2')}/o-i`, 'dlw/native-build', '2de90416e'),
    opts.foreign ? tree(`${cell('env-3')}/o-i`, 'feat/central-field-base', '963383814') : tree(`${cell('env-3')}/o-i`, null, '65202d830'),
    ...(opts.foreign ? [tree('/private/tmp/o-i-lane', 'agent/o-i-20261007-1639', '7fbde446e')] : []),
  ]

  // The 71 branches of O-I in the order Git lists them: name, head, and for a lane-named branch whether main holds it.
  const names: readonly (readonly [string, string, boolean?])[] = [
    ['agent/o-i-20261007-0824', '9a7de2d82', true], ['agent/o-i-20261007-1639', '7fbde446e', false], ['agent/o-i-20261008-1823', '1fb4986c6', false],
    ['chore/untrack-ableton-corpus-20261012', 'b954df489'], ['craft/live-re-20261007', '126343f91'], ['dlw/build', '9b6caea90'],
    ['dlw/build-20261012', '61bb54765'], ['dlw/native-build', '2de90416e'], ['docs/dlw-manual-20261013', '85b3c52f0'],
    ['enrich/expressions-20261006', 'fe0657642'], ['enrich/expressions-convergence', '347ac10a8'], ['enrich/expressions-craft-20261007', '51d8b3d5a'],
    ['enrich/tarot-score-312-landing', '2b3d5e69c'], ['feat/281-played-instrument-in-app', '78cb79abc', true], ['feat/central-field-base', '963383814', false],
    ['feat/epi-findings-complete-20261007', '9f692aa9d', false], ['feat/epi-findings-reconciled-20261007', 'c6262deb5', false], ['feat/epi-findings-reconciliation-20261007', '487cba91c', false],
    ['feat/epi-stage4-presentation-20261006', 'fea6d2ae2', false], ['feat/epi-stage4-replay-20261006', '75b702d8b', false], ['feat/epi-world-s1-20261005', '73b50363c', false],
    ['feat/epi-world-s2-20261005', '4e53c2288', false], ['feat/epi-world-s3-20261006', '284bfc0d9', false], ['feat/live-re-lane-15min-workload', 'b2bb210ab', false],
    ['feat/nara-identity-expression-20260927', 'f3d45dc35', false], ['feat/owner-requests-inbox-20260929', 'b8fd8aace', false], ['feat/personal-history-user-20261006', '54373ab54', true],
    ['feat/plural-flow-20260930', '0bcad4092', false], ['feat/shared-expression-20260930', '0a184d8c2', false], ['feat/stage-op-relay-20261006', 'e36e63a10', false],
    ['fix/collapsed-title-first-tab-overlap', '1ddb57756'], ['fix/exec-busy-parity-20261012', 'ee7054ed3'], ['fix/graph-inputs-wiki-links', '65fad68ea'],
    ['fix/harness-settings-owner-wiring', '6f9b6444e'], ['fix/narrow-title-tab-overlap', '8a64355a1'], ['fix/shared-field-20261005', '85d210b76'],
    ['fix/untrack-target-symlink-20261012', '76827a8b6'], ['fold/day-close-20261012', '938cb12a4'], ['hermes-contract-fold', '5794b5aef'],
    ['infra/vercel-wiring', '347ac10a8'], ['integrate/oi-scene-nara', '04a8153ee'], ['landing-currentness', 'dcf5d1bcb'],
    ['landing/device-ui-rounds-20261011', '90616efa9'], ['landing/live-re-15min-20261011', '60e98e1c2'], ['m-prime-methodology', '3560cc6c9'],
    ['main', '1cc77db12'], ['main-convergence-20261010', 'ff3793709'], ['now-field-supply-20261006', 'f96940879'],
    ['now/field-settle-20261012', '03ad6e9a6'], ['parked/env2-o-i-site-dirt-20261006', '2e0fc5162'], ['pr-573', '15b64830d'],
    ['pr-596', '5d3319af6'], ['pr-599', 'b8bbbd323'], ['pr-605', 'db6ceb471'],
    ['pr-624', 'd1ab42ab9'], ['psg-sampler-299', '6b24c2a1e'], ['recover/281-replan-dirt-20261006', '24d41e90b'],
    ['recover/env-2-oi-dirt-20261006-pre-central-field', 'ed3ff7e21'], ['recover/env-3-oi-ui-coherence-dirt-20261006-pre-central-field', '6bb5597ba'], ['recover/env2-o-i-epi-world-dirt-20261006', '55a6ba7e7'],
    ['recover/expression-enrichment-dirt-20261007', '64b916844'], ['recover/tarot-score-312-20261007', '5fbbe477e'], ['recover/tarot-score-312-20261007b', '30cd71f85'],
    ['recovered/central-field-base-dirt-20261006', '86a2b75bf'], ['relay/codex-ci-repair-296-walk-bridge-20261007', 'd1a1031fc'], ['site/essay-live-library-retired-20261006', '218e0cdce'],
    ['site/essay-significance-pin-20261007', '795ebe42e'], ['site/home-redesign-20261005', '5dd834d63'], ['study/zcode-desktop-3.14.3', '8506b4842'],
    ['ui-coherence-track-20261005', 'cc3594869'], ['web65/shared-world-participation', 'be9fb803e'],
  ]
  const held = new Map<string, string>(trees.filter(t => t.branch).map((t): [string, string] => [t.branch!, t.path]))
  const branches = names.map(([name, head, merged]) => ({name, head, checkedOutAt: held.get(name) ?? null, ...(merged === undefined ? {} : {merged})}))

  const sources: BoundaryOpSource[] = [KERNEL_WORKCELL, KERNEL_GIT,
    {boundaryOp: 'seat status (Control/user/workcell/seat)', channel: 'machine-instrument', at: SAMPLE_AT},
    {boundaryOp: 'git worktree list --porcelain', channel: 'machine-instrument', at: SAMPLE_AT},
    {boundaryOp: 'git for-each-ref refs/heads', channel: 'machine-instrument', at: SAMPLE_AT}]
  const census = assembleCensus({sources, seats, worktrees: trees, branches, machineRef: 'workcell:mac'})
  const findings = hygieneFindings(census, registeredSeatPaths(census))
  return {seats: dump(seats), worktrees: dump(trees), branches: dump(branches), sources: dump(sources), findings: dump(findings)}
}


// The Ground and Material pages read on this ground as it stood on 21 Oct: central.doctor (every part of the root valid), the reprojection
// plans of O-I (nothing missing) and Point-Cloud-Demo (its relations missing), O-I's authored ground (7 sources recognised, 6254 waiting,
// of which the model lists the vision and experience documents), and two prepared worlds with a sandbox server's five sandboxes.
const SAMPLE_AT_21 = '2026-10-21T02:05:00.000Z'
const PROJECT = 'O-I'
const ROOT = {root: '/Users/admin/Central', valid: true, mixed: {detected: false, signals: []},
  checks: ['Control/user', 'Control/agents/governance', 'Control/agents/wiki', 'Control/machines', '.central', 'Work'].map(path => ({path, valid: true}))}
const SCAFFOLD_PARTS = ['ProjectCentral', 'ProjectCentral/project.json', 'ProjectCentral/user', 'ProjectCentral/agents/governance', 'ProjectCentral/agents/wiki',
  'ProjectCentral/agents/wiki/wiki.json', 'ProjectCentral/relations']
const scaffoldOf = (project: string, missing: readonly string[] = []) => ({project, present: SCAFFOLD_PARTS.filter(x => !missing.includes(x)).map(x => `Work/${project}/${x}`), missing: missing.map(x => `Work/${project}/${x}`)})
const WAITING = [
  ['docs/VISION.md', ['purpose', 'vision']], ['desktop/cradle/docs/world-shell/wayfinder/DLW-VISION.md', ['purpose', 'vision']],
  ['desktop/cradle/docs/world-shell/UX-SPINE-ALIGNMENT.md', ['desired-experience', 'interaction-direction']], ['docs/cradle/03-UX-STATES.md', ['desired-experience', 'interaction-direction']],
  ['docs/experience/DEVELOPER-FIELD.md', ['desired-experience', 'interaction-direction']], ['docs/contracts/NARA-SPEECH-EXPERIENCE-V1.md', ['desired-experience', 'interaction-direction']],
] as const
const AUTHORED = {status: 'partial', waiting: 6254,
  recognised: [...['03c8cd08', '479be302', '97e0b0ec', 'edbbea0c'].map(h => ({path: `ProjectCentral/agents/now/clearings/${h}/now.json`, provenance: 'agent-maintained'})),
    ...['2026-08-21-oi97-false-convergence.md', '2026-08-23-physical-gate-is-not-branch-parking.md', 'README.md'].map(f => ({path: `ProjectCentral/user/learnings/${f}`, provenance: 'unresolved'}))],
  listed: WAITING.map(([path, hints]) => ({path, hints}))}
const WORLDS = [
  {ref: 'world:demand:factory-attempt-dlw-build-0142', state: 'degraded', bindings: [
    {ref: 'workspace:checkout', presence: 'present', health: 'healthy'}, {ref: 'affordance:shell', presence: 'present', health: 'healthy'},
    {ref: 'runtime:preview', presence: 'present', health: 'healthy'}, {ref: 'connectivity:service:redis-now/personal-workcell', presence: 'present', health: 'healthy'},
    {ref: 'connectivity:service:kev-decision/personal-workcell', presence: 'present', health: 'healthy'},
    {ref: 'connectivity:service:gliner25-decision/personal-workcell', presence: 'present', health: 'unavailable'}, {ref: 'output:artifacts', presence: 'present', health: 'healthy'}]},
  {ref: 'world:demand:factory-attempt-ql-m-ledger-0031', state: 'degraded', bindings: [
    {ref: 'workspace:checkout', presence: 'stale', health: 'unknown'}, {ref: 'affordance:shell', presence: 'present', health: 'healthy'},
    {ref: 'connectivity:service:redis-now/personal-workcell', presence: 'present', health: 'healthy'}, {ref: 'output:artifacts', presence: 'present', health: 'healthy'},
    {ref: 'output:logs', presence: 'released', health: 'unknown'}]},
]
const SANDBOX_SERVER = 'http://127.0.0.1:8090'
const SANDBOXES = {server: SANDBOX_SERVER, sandboxes: [
  {id: 'sbx-7f2a', state: 'Running', lease: 'live', expiresAt: '2026-10-21T03:00:00Z'}, {id: 'sbx-81c0', state: 'Running', lease: 'live', expiresAt: '2026-10-21T04:30:00Z'},
  {id: 'sbx-90d4', state: 'Paused', lease: 'live', expiresAt: '2026-10-22T00:00:00Z'}, {id: 'sbx-3b17', state: 'Running', lease: 'expired-orphan', expiresAt: '2026-10-20T18:00:00Z'},
  {id: 'sbx-c55e', state: 'Running', lease: 'unknown', expiresAt: null}]}
const GROUND_SOURCES: BoundaryOpSource[] = [{boundaryOp: 'central.doctor', channel: 'kernel-op', at: SAMPLE_AT_21},
  {boundaryOp: `central.world.reproject.plan (project ${PROJECT})`, channel: 'kernel-op', at: SAMPLE_AT_21},
  {boundaryOp: `projectcentral.ground.inspect (project ${PROJECT})`, channel: 'kernel-op', at: SAMPLE_AT_21}]
const MATERIAL_SOURCES: BoundaryOpSource[] = [{boundaryOp: 'op material_read (2 world receipts)', channel: 'kernel-op', at: SAMPLE_AT_21},
  {boundaryOp: `workcell sandboxes reconcile --server ${SANDBOX_SERVER}`, channel: 'machine-instrument', at: SAMPLE_AT_21}]
const finding = (kind: string, subject: string, standing: string, ops: readonly string[], tenderId: string | null) => ({kind, subject, standing, boundaryOps: ops, tenderId})
const groundFindings = (missing: readonly string[], project: string) => [
  ...missing.map(x => finding('scaffold-missing', `Work/${project}/${x}`, `The world's ProjectCentral has no ${x.replace('ProjectCentral/', '')}. Reproject stamps it and moves nothing.`,
    [`central.world.reproject.plan (project ${project})`], 'reproject-scaffold')),
  ...WAITING.map(([path, hints]) => finding('source-unrecognised', path, `Its name suggests ${hints.join(' and ').replace(/-/g, ' ')}. Central does not infer authorship: recognise it to make it ground, or leave it as project source.`,
    [`projectcentral.ground.inspect (project ${PROJECT})`], 'recognise-source')),
]
const MATERIAL_FINDINGS = [
  finding('binding-drift', 'world:demand:factory-attempt-ql-m-ledger-0031#workspace:checkout', 'The checkout is stale: the receipt names it and the provider no longer holds it as it was. Reconcile recovers it.',
    ['op material_read (2 world receipts)'], 'reconcile-binding'),
  finding('sandbox-orphan', 'sbx-3b17', 'Its lease ended at 18:00 on 20 Oct. Nothing holds it.', [`workcell sandboxes reconcile --server ${SANDBOX_SERVER}`], 'release-orphans'),
  finding('sandbox-unproven', 'sbx-c55e', 'The server reports no lease for it, so it may be live.', [`workcell sandboxes reconcile --server ${SANDBOX_SERVER}`], null),
]
/** A checkout sample with the Ground and Material readings beside it. */
function withPages(base: ReturnType<typeof sample>, missing: readonly string[] = [], project = PROJECT) {
  return {...base, root: dump(ROOT), scaffold: dump(scaffoldOf(project, missing)), authored: dump(AUTHORED), worlds: dump(WORLDS), sandboxes: dump(SANDBOXES),
    sources: dump([...JSON.parse(base.sources) as BoundaryOpSource[], ...GROUND_SOURCES.map(s => ({...s, boundaryOp: s.boundaryOp.replace(PROJECT, project)})), ...MATERIAL_SOURCES]),
    findings: dump([...JSON.parse(base.findings) as unknown[], ...groundFindings(missing, project), ...MATERIAL_FINDINGS])}
}

const DEFAULTS: Values = {
  light: 'lit', machine: 'this', machineRef: 'workcell:mac', faults: true, refresh: 'open', tend: 'propose', readAge: 12,
  ...Object.fromEntries(PAGE_IDS.flatMap(id => PAGES[id].rings).map(r => [`look:${r}`, true])),
  ...Object.fromEntries((Object.keys(TENDERS) as TenderId[]).map(t => [TENDERS[t].allow, true])),
  'as:provenance': 'human-authored', 'as:standing': 'design-commitment',
  machines: dump([{id: 'this', label: 'This machine', ref: 'workcell:mac'}, {id: 'omarchy', label: 'omarchy', ref: 'workcell:omarchy', does: 'The linked machine workcell:omarchy.'}]),
  disk: dump([{workcell: 'env-1', freeGb: 44.6}, {workcell: 'env-2', freeGb: 44.6}, {workcell: 'env-3', freeGb: 44.6}]),
  ...withPages(sample()),
}

// ------------------------------------------------------------------------------------------------ the device

function PagedWhole({p}: {p: ViewProps}) {
  const page = pageOf(p), g = ground(p.v, page), locked = tendOf(p.v) === 'off' ? 'Tend is Off.' : undefined, read = numOf(p.v, 'readAge')
  const pages = PAGE_IDS.map(id => { const x = ground(p.v, id); return {id, label: PAGES[id].label, light: (x.anyRead && x.found ? (x.shown.some(f => f.fault) ? 'dark' : 'lit') : undefined) as LightState | undefined} })
  return <Panel title="Ground hygiene" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} pages={pages} page={page} onPage={p.setPage}>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The ground" does={`${RINGS_SAY[page]}, with the count of each. A dot marks a thing with a finding. Drag handle 1 to set Tend.`} corner={cornerOf(g)}>
          <Rings p={p} page={page} w={194} h={146} legend live />
        </Display>
      </Section>
      <Section label="Look" width={104}>
        {PAGES[page].rings.map(r => {
          const now = boolOf(p.v, `look:${r}`)
          return <Toggle {...st(p, `look:${r}`)} key={r} label={title(RING_NAME[r]!)} does={`Read the ${RING_NAME[r]}. Off leaves its ring empty.`}
            on={now === true} unknown={now === undefined} onChange={x => p.set(`look:${r}`, x)} />
        })}
        <Chooser {...st(p, 'machine')} label="Machine" wide does="Whose ground the device reads. Link lists the other machines." value={strOf(p.v, 'machine') ?? ''}
          options={(g.machines ?? []).map(m => ({value: m.id, label: m.label ?? m.id, does: m.does}))} onChange={x => p.set('machine', x)} />
        <RefreshChooser p={p} />
      </Section>
      <Section label="Show" grow>
        <FaultsToggle p={p} label="Faults only" />
        <Action {...st(p, 'reread')} label="Read now" does="Read every source once." onPress={() => p.set('reread', true)} />
        <Readout big label="findings" does="The findings that the device shows now on this page." value={g.anyRead && g.found ? g.shown.length : undefined} tone={g.shown.length ? 'accent' : 'green'} />
        <Readout label="read" does="When the device last read its sources." value={read === undefined ? undefined : read === 0 ? 'now' : `${read} s ago`} />
      </Section>
    </Band>
    <Band>
      <Section label="Tend" width={108}>
        <TendRadio p={p} />
        {PAGES[page].tenders.map(t => {
          const now = boolOf(p.v, TENDERS[t].allow), held = st(p, TENDERS[t].allow)
          return <Toggle {...held} key={t} label={TENDERS[t].label} does={`Allow the device to offer ${TENDERS[t].label}.`} disabled={locked ?? held.disabled}
            on={now === true} unknown={now === undefined} onChange={x => p.set(TENDERS[t].allow, x)} />
        })}
      </Section>
      <Section label="Findings" grow>
        <Rows does="The first findings, with their kind. Orange is a fault. Teal is a reading that is not a fault." items={rowsOf(g)} size={8} />
      </Section>
    </Band>
  </Panel>
}

export const design: DesignedDevice = {
  id: 'central:ground-hygiene',
  title: 'Ground hygiene',
  kind: 'effect',
  firstPage: 'checkouts',
  defaults: DEFAULTS,
  fixtures: {
    'After a merge': withPages(sample({merged: true})),
    'A foreign lane': withPages(sample({foreign: true})),
    'A world missing its scaffold': withPages(sample(), ['ProjectCentral/relations'], 'Point-Cloud-Demo'),
    'No machine read': {seats: undefined, worktrees: undefined, branches: undefined, findings: undefined, disk: undefined, worlds: undefined, sandboxes: undefined,
      sources: dump([KERNEL_WORKCELL, {...KERNEL_GIT, refusal: 'the git repository reading did not answer'}, ...GROUND_SOURCES,
        {...MATERIAL_SOURCES[1]!, refusal: 'the sandbox server did not answer'}])},
    'No readings': Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, undefined])),
  },

  folded: p => <Folded title="Ground hygiene" light={light(p)} readings={[totalOf(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => {
    const page = pageOf(p), g = ground(p.v, page)
    return <Panel title="Ground hygiene" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="The ground" does={`${RINGS_SAY[page]}. A dot marks a thing with a finding. Drag handle 1 to set Tend.`} corner={cornerOf(g)}>
          <Rings p={p} page={page} w={140} h={146} live />
        </Display>
      </Section>
      <Section label="Macros" cols={3}>
        <div className="hy-span2"><LookAt p={p} page={page} /></div>
        <FaultsToggle p={p} label="Faults" />
        <div className="hy-span2"><RefreshChooser p={p} /></div>
        <TendRadio p={p} />
      </Section>
    </Panel>
  },

  whole: p => <PagedWhole p={p} />,

  full: p => <Pane p={p} />,

  widget: p => {
    const page = pageOf(p), g = ground(p.v, page), first = rowsOf(g).slice(0, 3)
    return <Tile title="Ground hygiene" light={light(p)} span={2} onFull={p.nav.full}>
      <Display w={76} h={76} label="The ground" does={`${RINGS_SAY[page]}. A dot marks a thing with a finding.`}>
        <Rings p={p} page={page} w={76} h={76} small />
      </Display>
      <div className="hy-tile-side">
        <Readout big label={g.noun} does="The findings that the device shows now on its page." value={g.anyRead && g.found ? g.shown.length : undefined} tone={g.shown.length ? 'accent' : 'green'} />
        <div className="hy-tile-list" onClick={p.nav.full}><Rows does="The first three findings. Click one to open the list in a pane." items={first} size={3} /></div>
      </div>
    </Tile>
  },
}
