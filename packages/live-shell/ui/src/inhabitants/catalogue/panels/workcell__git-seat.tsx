// Git / landing (manual §19.16): the landing device, last on a workcell's chain — where the work of every agent in the workcell lands as git. Live's nearest:
// Utility, a small effect whose meaning is plain at a glance. The picture is the branch: main along the bottom, the branch leaving it, one
// dot for each commit it holds that main does not, a pulsing hollow dot for work that has no commit, and — drawn from Land as — where
// Land will take it. Handle 1 sets Land as.
//
// Whole has three pages. Landing: every parameter of the device, in three groups (Seat, Cadence, Landing). Seat: the seat the workcell's
// lane holds — claim it, attach to its lane or start a new one, and release it when the work has landed (the seat instrument: `seat status`,
// `seat join`, `seat release`). Checkouts: every checkout of the workcell's machine as readings — its seats, worktrees and branches — what
// each finding means, and the three tenders you approve (Release seat, Prune worktree, Sweep branch). The Seat page's values stand under
// `seat.` and the Checkouts page's under `co.`: a binding hosts each by prefixing the seat instrument's binding and the checkouts' own.
//
// Everything the device draws is a value key. The readings (the seat's, through `seat status` and `git_repository_read`; the changes,
// through `git_diff_read`) are reported by the owners:
//   light           'lit' | 'dark'    the seat and the repository answered; hollow when the owner reports none
//   branch          string            the seat's branch (`head_branch`; `live_branch` of `seat status`)
//   seat            {workcell, product, state, claimedBy}   the seat the session stands in (`seat status`)
//   shared          boolean           the session shares the lane lead's seat and branch
//   uncommitted     number            files with no commit (`dirty_files`; `tracked_changes` + `untracked`)
//   ahead, behind   number            commits the branch holds that main does not, and the reverse (`ahead_main`, `behind_main`)
//   added, removed, files   number    the sums of `git_diff_read`: lines added, lines removed, files changed
//   diff            ChangedFile[]     the files of that reading: path, status, adds, dels, patch
//   commits         Commit[]          the branch's commits, newest first: sha, subject
//   checks          Check[]           the remote's checks of the branch: name, state (passed | failed | running)
// Settings: commit-policy ('per turn' | 'per task' | 'manual'), push-policy ('off' | 'on land'), landAs ('draft' | 'mr' | 'merge').
// Acts, each on its own key: land. Held by the hand (no reading): sel (the file shown in the pane).
//
// The Seat page (`seat.` keys; the shapes follow SeatReading in centralHygieneModel.ts):
//   seat.seats   SeatRow[]   workcell, product, state (free | claimed | occupied-foreign-lane), branch, head, claimedBy, dirty, untracked,
//                            ahead, behind, drift, zones [{actor, regions, since}], workers (the agents attached to the lane)
//   seat.actor   the session's own actor ref, to tell Yours from another agent's
// Settings: seat.product, seat.seat, seat.lane, seat.joinAs (attach | new-lane). Acts: seat.join, seat.release. Held by the hand:
//   seat.page:co (the co-workers' page).
//
// The Checkouts page (`co.` keys; the shapes are centralHygieneModel's own, JSON strings):
//   co.seats (SeatReading[]), co.worktrees (WorktreeRow[]: path, branch, head, detached, main), co.branches ({name, head, checkedOutAt,
//   merged?}[]), co.disk ({workcell, freeGb}[]), co.findings (HygieneFinding[]: kind, subject, standing, boundaryOps, tenderId), co.sources
//   (BoundaryOpSource[]: each read with its operation, and its refusal in the owner's words), co.machines ({id, label, ref, does?}[]),
//   co.machineRef (the machine the readings stand on), co.readAge (seconds since the sources were read), co.receipt / co.receipts.
// Settings: co.machine, co.faults (show faults only). Held by the hand: co.sel (the finding chosen), co.page:findings.
// Acts: co.reread (Read now), and the tenders, whose value is the finding's subject: co.release (`seat release`), co.prune (`git worktree
//   remove`), co.sweep (`git branch -d`). Each is held to run: the page tends only what you approve.
// A key the owner does not report is absent. The picture then says which reading is missing, and every control and reading draws "—".
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, type LightState, type Option, type RowItem, type Standing, type Tone} from '../../sdk/panel'
import {assembleCensus, hygieneFindings, registeredSeatPaths, type BoundaryOpSource, type SeatReading, type WorktreeRow} from '../../centralHygieneModel'
import {NONE, boolOf, clampTo, json, numOf, prefixed, scoped, st, strOf, type DesignedDevice, type Values, type ViewProps} from './design'
import './workcell__git-seat.css'

type V = ViewProps['v']
type LandAs = 'draft' | 'mr' | 'merge'
type CommitPolicy = 'turn' | 'task' | 'manual'

// ------------------------------------------------------------------------------------------------ the vocabulary

const COMMIT = [
  {value: 'turn', label: 'Per turn', does: 'The agent commits at the end of each turn.'},
  {value: 'task', label: 'Per task', does: 'The agent commits when a task ends.'},
  {value: 'manual', label: 'Manual', does: 'The agent commits only when you ask.'},
] as const
const LAND_AS = [
  {value: 'draft', label: 'Draft MR', does: 'Land opens a draft merge request. Nothing merges.'},
  {value: 'mr', label: 'MR', does: 'Land opens a merge request for review. Nothing merges.'},
  {value: 'merge', label: 'Merge', does: 'Land merges the branch into main, once every check has passed.'},
] as const
const POLICY_OF: Record<string, CommitPolicy> = {'per turn': 'turn', 'per task': 'task', manual: 'manual'}
const PAGES = [{id: 'landing', label: 'Landing'}, {id: 'seat', label: 'Seat'}, {id: 'checkouts', label: 'Checkouts'}] as const
type PageId = (typeof PAGES)[number]['id']
const pageOf = (p: ViewProps): PageId => (p.page === 'seat' || p.page === 'checkouts' ? p.page : 'landing')

const landAsOf = (v: V): LandAs | undefined => { const x = strOf(v, 'landAs'); return x === 'draft' || x === 'mr' || x === 'merge' ? x : undefined }
const commitOf = (v: V): CommitPolicy | undefined => { const x = strOf(v, 'commit-policy'); return x ? POLICY_OF[x] : undefined }
const pushOf = (v: V): boolean | undefined => { const x = strOf(v, 'push-policy'); return x === 'on land' ? true : x === 'off' ? false : undefined }
const light = (p: ViewProps): LightState => { const s = strOf(p.owner ?? p.v, 'light'); return s === 'lit' || s === 'dark' ? s : 'unknown' }
/** The tail of a name that does not fit: the end of a branch is what tells branches apart. */
const tail = (s: string | undefined, n: number) => (s === undefined ? NONE : s.length > n ? `…${s.slice(-(n - 1))}` : s)

// ------------------------------------------------------------------------------------------------ the readings

interface Seat {readonly workcell?: string; readonly product?: string; readonly state?: string; readonly claimedBy?: string}
interface Commit {readonly sha: string; readonly subject: string}
interface Check {readonly name: string; readonly state: 'passed' | 'failed' | 'running'}
interface Changed {readonly path: string; readonly status: string; readonly adds?: number | null; readonly dels?: number | null; readonly patch?: string}

/** A JSON list the owner reported, or undefined when the key is absent or holds no list. A row without its identity is left out. */
function list<T>(v: V, key: string, keep: (row: Record<string, unknown>) => boolean): T[] | undefined {
  const rows = json<unknown>(v, key, undefined)
  if (!Array.isArray(rows)) return undefined
  return rows.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && keep(row as Record<string, unknown>)) as unknown as T[]
}
const text = (x: unknown): x is string => typeof x === 'string' && x.length > 0
const commitsOf = (v: V) => list<Commit>(v, 'commits', r => text(r.sha) && typeof r.subject === 'string')
const checksOf = (v: V) => list<Check>(v, 'checks', r => text(r.name) && (r.state === 'passed' || r.state === 'failed' || r.state === 'running'))
const diffOf = (v: V) => list<Changed>(v, 'diff', r => text(r.path) && text(r.status))
const seatOf = (v: V): Seat | undefined => {
  const s = json<unknown>(v, 'seat', undefined)
  return s && typeof s === 'object' && !Array.isArray(s) ? s as Seat : undefined
}
const seatName = (v: V) => { const s = seatOf(v); return s?.workcell && s.product ? `${s.workcell}/${s.product}` : undefined }

function checkSum(checks: Check[] | undefined) {
  if (!checks) return undefined
  const passed = checks.filter(c => c.state === 'passed').length, failed = checks.filter(c => c.state === 'failed').length
  return {passed, failed, running: checks.filter(c => c.state === 'running').length, total: checks.length}
}
const checkText = (checks: Check[] | undefined): string | undefined => { const s = checkSum(checks); return s ? (s.total === 0 ? 'none' : `${s.passed}/${s.total}`) : undefined }
const checkTone = (checks: Check[] | undefined): Tone | undefined => { const s = checkSum(checks); return !s || s.total === 0 ? undefined : s.failed ? 'stall' : s.running ? 'accent' : 'green' }
const changeText = (v: V): string | undefined => { const a = numOf(v, 'added'), r = numOf(v, 'removed'); return a === undefined || r === undefined ? undefined : `+${a} −${r}` }

/** Whether Land can act now, and if not, why. The host's standing for the act comes last. */
function landState(p: ViewProps): {ok: boolean; why?: string} {
  const v = p.v, ahead = numOf(v, 'ahead'), dirty = numOf(v, 'uncommitted'), as = landAsOf(v), push = pushOf(v), checks = checksOf(v)
  if (ahead === undefined && dirty === undefined) return {ok: false, why: 'The seat has no reading.'}
  if (as === undefined) return {ok: false, why: 'Land as has no reading.'}
  if (push === undefined) return {ok: false, why: 'Push has no reading.'}
  if (!push) return {ok: false, why: 'Push is Off. Set Push to On land to land the branch.'}
  if (ahead === 0 && dirty === 0) return {ok: false, why: 'Nothing to land. The branch is level with main.'}
  if (as === 'merge') {
    const s = checkSum(checks)
    if (!s) return {ok: false, why: 'The checks have no reading. Merge waits for them.'}
    if (s.failed) return {ok: false, why: 'A check failed. Merge waits for every check to pass.'}
    if (s.running) return {ok: false, why: 'A check still runs. Merge waits for every check to pass.'}
  }
  const held = st(p, 'land').disabled
  return held ? {ok: false, why: held} : {ok: true}
}
const landDoes = (as: LandAs | undefined) => (as === 'draft' ? 'Commit the work, push the branch and open a draft merge request.'
  : as === 'mr' ? 'Commit the work, push the branch and open a merge request.'
  : as === 'merge' ? 'Commit the work, push the branch and merge it into main once every check has passed.' : 'Land the branch as set in Land as.')

// ------------------------------------------------------------------------------------------------ the picture

interface Geo {
  readonly w: number; readonly h: number; readonly yMain: number; readonly yBranch: number; readonly x0: number; readonly lane0: number; readonly tip: number
  readonly ghost: number; readonly tx: number; readonly ck: number; readonly cap: number; readonly r: number; readonly text: boolean; readonly lever?: {readonly y: number; readonly xs: readonly [number, number, number]}
}
const COMPACT: Geo = {w: 140, h: 146, yMain: 94, yBranch: 36, x0: 14, lane0: 38, tip: 102, ghost: 124, tx: 8, ck: 22, cap: 9, r: 2.6, text: true, lever: {y: 134, xs: [28, 70, 112]}}
const WHOLE: Geo = {w: 194, h: 146, yMain: 94, yBranch: 36, x0: 14, lane0: 38, tip: 142, ghost: 172, tx: 8, ck: 22, cap: 14, r: 2.7, text: true, lever: {y: 134, xs: [40, 97, 154]}}
const TILE: Geo = {w: 112, h: 78, yMain: 58, yBranch: 18, x0: 8, lane0: 24, tip: 80, ghost: 98, tx: 0, ck: 0, cap: 6, r: 2.2, text: false}
const WIDE: Geo = {w: 760, h: 76, yMain: 58, yBranch: 26, x0: 24, lane0: 52, tip: 600, ghost: 690, tx: 24, ck: 706, cap: 40, r: 3, text: true}

/** The branch. Main runs along the bottom. The branch leaves it and runs right; each dot is a commit it holds that main does not
 * (the last `cap` of them when there are more, a break mark at the start). A pulsing hollow dot ends the branch while files have no
 * commit. From the end of the branch, Land as draws where Land will take it: a dashed square for a draft, a solid square for a merge
 * request, a dot on main for a merge. The ticks are the remote's checks. Handle 1 sets Land as. */
function Branch({p, g, live}: {p: ViewProps; g: Geo; live?: boolean}) {
  const v = p.v, ahead = numOf(v, 'ahead'), behind = numOf(v, 'behind'), dirty = numOf(v, 'uncommitted'), as = landAsOf(v), checks = checksOf(v)
  const {w, yMain: ym, yBranch: yb, x0, lane0, tip, ghost} = g
  const open = (dirty ?? 0) > 0, dots = ahead === undefined ? 0 : Math.min(ahead, g.cap), end = open ? tip - 12 : tip, mid = (yb + ym) / 2
  const at = (i: number) => (dots === 1 ? lane0 : lane0 + i * (end - lane0) / (dots - 1))
  const blind = ahead === undefined && dirty === undefined
  const change = changeText(v), files = numOf(v, 'files')
  const lever = g.lever, xs = lever?.xs, idx = as === undefined ? -1 : LAND_AS.findIndex(o => o.value === as)
  const standing = st(p, 'landAs')
  const drag = live && xs && !standing.disabled ? (x: number) => p.set('landAs', LAND_AS[Math.round(clampTo(0, 2, (x - xs[0]) / ((xs[2] - xs[0]) / 2)))]!.value) : undefined
  const sum = checkSum(checks)
  return <g>
    <path d={`M8 ${ym}H${w - 8}`} className="dp-faint" />
    <text x={8} y={ym + 12} className="dp-axis">main</text>
    {Array.from({length: Math.min(behind ?? 0, 6)}, (_, i) => <path key={i} d={`M${x0 + 10 + i * 6} ${ym - 3}v6`} stroke="var(--text-faint)" strokeWidth={1} />)}
    <circle cx={x0} cy={ym} r={2} fill="var(--text-faint)" />
    <path d={`M${x0} ${ym}Q${x0} ${yb} ${x0 + 14} ${yb}H${tip}`} className={ahead === undefined ? 'dp-faint' : 'dp-curve'} strokeDasharray={ahead === undefined ? '2 3' : undefined} />
    {ahead !== undefined && ahead > g.cap && <path d={`M${lane0 - 9} ${yb - 4}l3 8M${lane0 - 5} ${yb - 4}l3 8`} stroke="var(--text-faint)" strokeWidth={1} />}
    {Array.from({length: dots}, (_, i) => <circle key={i} cx={at(i)} cy={yb} r={g.r} fill="var(--dp-value)" />)}
    {open && <circle className="gs-pulse" cx={tip} cy={yb} r={g.r + 1} fill="none" stroke="var(--dp-on)" strokeWidth={1.5} />}
    {as !== undefined && <g>
      <path d={`M${tip} ${yb}Q${ghost} ${yb} ${ghost} ${yb + 14}V${as === 'merge' ? ym : mid - 5}`} fill="none" stroke="var(--text-dim)" strokeWidth={1.2} strokeDasharray="3 3" />
      {as === 'merge' ? <circle cx={ghost} cy={ym} r={3.4} fill="var(--dp-on)" />
        : <rect x={ghost - 4.5} y={mid - 4.5} width={9} height={9} fill="none" stroke="var(--dp-on)" strokeWidth={1.4} strokeDasharray={as === 'draft' ? '2 2' : undefined} />}
    </g>}
    {g.text && !blind && <g>
      <text x={g.tx} y={yb - 10} className="dp-ink">
        {change === undefined ? <tspan className="dp-ink-dim">no reading of the changes</tspan>
          : <><tspan fill="var(--green)">+{numOf(v, 'added')}</tspan><tspan dx={5} fill="var(--rec)">−{numOf(v, 'removed')}</tspan><tspan dx={5} className="dp-ink-dim">{files === undefined ? '' : `· ${files} files`}</tspan></>}
      </text>
      <text x={x0 + 22} y={yb + 17} className="dp-ink-dim">{ahead === undefined ? '— ahead' : ahead === 0 ? 'level with main' : `${ahead} ahead`}{behind ? ` · ${behind} behind` : ''}</text>
      {sum ? <g>
        <text x={g.ck} y={mid + 3} className="dp-axis">checks</text>
        {checks!.slice(0, 8).map((c, i) => <rect key={i} x={g.ck + i * 6} y={mid + 8} width={4} height={4}
          fill={c.state === 'passed' ? 'var(--green)' : c.state === 'failed' ? 'var(--rec)' : 'none'} stroke={c.state === 'running' ? 'var(--dp-value)' : 'none'} strokeWidth={1} />)}
      </g> : <text x={g.ck} y={mid + 3} className="dp-axis">no reading of the checks</text>}
    </g>}
    {blind && g.text && <text x={w / 2} y={mid + 4} className="dp-ink-dim" textAnchor="middle">No reading of the seat</text>}
    {lever && xs && <g>
      <path d={`M${xs[0]} ${lever.y}H${xs[2]}`} className="dp-faint" />
      {xs.map((x, i) => <g key={i}>
        <circle cx={x} cy={lever.y} r={1.8} fill="var(--text-faint)" />
        {as !== undefined && <text x={x} y={lever.y - 9} className="dp-axis" textAnchor="middle">{LAND_AS[i]!.label}</text>}
      </g>)}
      {as === undefined
        ? <text x={w / 2} y={lever.y - 9} className="dp-axis" textAnchor="middle">no reading of Land as</text>
        : <Handle n={1} x={xs[idx]!} y={lever.y} label="Land as" does="Drag along the line: Draft MR, MR or Merge. It sets what Land does."
          onDrag={drag} onReset={drag && (() => p.set('landAs', 'draft'))} />}
    </g>}
  </g>
}

// ------------------------------------------------------------------------------------------------ the controls

function CommitRadio({p}: {p: ViewProps}) {
  return <Radio {...st(p, 'commit-policy')} label="Commit" does="When the agent commits: after each turn, when a task ends, or only when you ask." value={commitOf(p.v) ?? ''} options={COMMIT} stack
    onChange={x => p.set('commit-policy', x === 'turn' ? 'per turn' : x === 'task' ? 'per task' : 'manual')} />
}
function LandAsRadio({p}: {p: ViewProps}) {
  return <Radio {...st(p, 'landAs')} label="Land as" does="How Land takes the work: a draft merge request, a merge request, or a merge into main." value={landAsOf(p.v) ?? ''} options={LAND_AS} stack
    onChange={x => p.set('landAs', x)} />
}
function PushToggle({p}: {p: ViewProps}) {
  const now = pushOf(p.v)
  return <Toggle {...st(p, 'push-policy')} label="Push" does="On land: the branch goes to the remote when you land it. Off: the work stays on this machine, and Land waits." on={now === true} unknown={now === undefined}
    onChange={x => p.set('push-policy', x ? 'on land' : 'off')} />
}
function LandAction({p}: {p: ViewProps}) {
  const can = landState(p)
  return <Action {...st(p, 'land')} hold label="Land" does={landDoes(landAsOf(p.v))} onPress={() => p.set('land', true)} disabled={can.ok ? undefined : can.why ?? 'Land has no operation here.'} />
}
function Reading({label, does, value, tone}: {label: string; does: string; value: string | undefined; tone?: Tone}) {
  return <div className="gs-ro"><Readout label={label} does={does} value={value} tone={tone} /></div>
}

const checkRows = (v: V): RowItem[] => {
  const checks = checksOf(v)
  if (!checks) return [{id: 'none', name: 'No reading', light: 'unknown'}]
  if (!checks.length) return [{id: 'none', name: 'The remote runs no checks', light: 'dark'}]
  return checks.map((c): RowItem => ({id: c.name, name: c.name, light: c.state === 'running' ? 'unknown' : 'lit', tone: c.state === 'failed' ? 'stall' : 'green',
    does: `${c.name}: ${c.state}. The remote reports it.`}))
}

// ================================================================================================ the Seat page (`seat.` keys)

/** The names of the seats, drawn dashed when the owner reports none. */
const SEAT_NAMES: readonly string[] = ['env-1', 'env-2', 'env-3']
const STATE_WORD: Record<string, string> = {free: 'free', claimed: 'held', 'occupied-foreign-lane': 'foreign'}
const JOIN: readonly Option<string>[] = [{value: 'attach', label: 'Attach', does: 'Work beside the agents on the standing lane.'},
  {value: 'new-lane', label: 'New lane', does: 'Start a new lane. It replaces the standing lane; the old branch stays in Git. It never replaces uncommitted work.'}]

interface Zone {readonly actor: string; readonly regions: readonly string[]; readonly since: number | null}
interface SeatRow {
  readonly workcell: string; readonly product: string; readonly state: string; readonly branch: string | null; readonly head: string | null
  readonly claimedBy: string | null; readonly dirty: number | null; readonly untracked: number | null; readonly ahead: number | null; readonly behind: number | null
  readonly zones: readonly Zone[]; readonly workers?: readonly string[]
}
const count = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)
const orNull = (x: unknown): string | null => (text(x) ? x : null)
const objects = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? x.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object') : [])

/** The seat rows the owner reported, or undefined when the key is absent or holds no list. A row without its identity is left out. */
function readRows(v: V): SeatRow[] | undefined {
  const raw = json<unknown>(v, 'seats', undefined)
  if (!Array.isArray(raw)) return undefined
  return objects(raw).filter(r => text(r.workcell) && text(r.product)).map((r): SeatRow => ({
    workcell: r.workcell as string, product: r.product as string, state: text(r.state) ? r.state : 'unknown', branch: orNull(r.branch), head: orNull(r.head),
    claimedBy: orNull(r.claimedBy), dirty: count(r.dirty), untracked: count(r.untracked), ahead: count(r.ahead), behind: count(r.behind),
    zones: objects(r.zones).filter(z => text(z.actor)).map((z): Zone => ({actor: z.actor as string, regions: Array.isArray(z.regions) ? z.regions.filter(text) : [], since: count(z.since)})),
    workers: Array.isArray(r.workers) ? r.workers.filter(text) : undefined,
  }))
}
/** Everything the Seat page draws: the seats, the chosen seat among them, and whether the session's own actor holds it. */
function readSeats(v: V) {
  const rows = readRows(v), product = strOf(v, 'product'), seat = strOf(v, 'seat'), actor = strOf(v, 'actor')
  const envs = rows ? [...new Set(rows.map(r => r.workcell))].sort() : []
  const products = rows ? [...new Set(rows.map(r => r.product))] : []
  const row = rows?.find(r => r.workcell === seat && r.product === product)
  const mine = !!row && !!actor && (row.claimedBy === actor || !!row.workers?.includes(actor) || row.zones.some(z => z.actor === actor))
  return {rows, product, seat, actor, envs, products, row, mine}
}
type Seats = ReturnType<typeof readSeats>
const SEATS = new WeakMap<V, Seats>()
function seats(v: V): Seats {
  let g = SEATS.get(v)
  if (!g) { g = readSeats(v); SEATS.set(v, g) }
  return g
}
const short = (actor: string | null | undefined) => (actor ? actor.split(':').pop() || actor : NONE)
const filesOf = (r: SeatRow | undefined): number | undefined => (r && (r.dirty !== null || r.untracked !== null) ? (r.dirty ?? 0) + (r.untracked ?? 0) : undefined)

/** The claim in a word: Free, Yours, or Another agent's (a lane of another agent, or an owner-held lane). Undefined without a reading. */
function claimWord(g: Seats): string | undefined {
  const s = g.row?.state
  if (s === 'free') return 'Free'
  if (s === 'occupied-foreign-lane') return 'Another\'s'
  if (s === 'claimed') return g.mine ? 'Yours' : 'Another\'s'
  return undefined
}
const FOREIGN = (r: SeatRow) => `Another lane's unmerged work (${r.branch ?? 'no branch'}) holds this seat. The decision is yours.`
const joinOf = (v: V) => (strOf(v, 'joinAs') === 'new-lane' ? 'new-lane' : strOf(v, 'joinAs') === 'attach' ? 'attach' : undefined)
/** Why Join cannot run now, in the instrument's own refusals, or undefined. */
function joinWhy(g: Seats, v: V): string | undefined {
  if (!g.rows) return 'No reading of the seats.'
  if (!g.seat || !g.product) return 'Choose a product and a seat.'
  if (!g.row) return `${g.seat} has no ${g.product} seat.`
  if (g.row.state === 'occupied-foreign-lane') return FOREIGN(g.row)
  if (g.row.state !== 'free' && g.row.state !== 'claimed') return 'The seat has no reading of its state.'
  if (g.row.state === 'claimed' && joinOf(v) === 'new-lane' && (filesOf(g.row) ?? 0) > 0) return `${filesOf(g.row)} files are uncommitted. A new lane does not replace uncommitted work.`
  return undefined
}
/** Why Release cannot run now, or undefined. */
function releaseWhy(g: Seats): string | undefined {
  if (!g.rows) return 'No reading of the seats.'
  if (!g.row) return 'Choose a product and a seat.'
  if (g.row.state === 'free') return 'This seat is free.'
  if (g.row.state === 'occupied-foreign-lane') return FOREIGN(g.row)
  const n = filesOf(g.row)
  if (n === undefined) return 'No reading of the uncommitted files.'
  if (n > 0) return `${n} files are uncommitted. Land them first, then release.`
  return undefined
}
/** The host's standing for a key, with a reason of this view's own when the host gives none. */
const gate = (p: ViewProps, key: string, why?: string): Standing => { const s = st(p, key); return why && !s.disabled ? {...s, disabled: why} : s }

/** The product's seats side by side: a block for each, filled by who holds it (teal a lane, orange another lane's unmerged work, hollow
 * free); under it the uncommitted files, how the lane stands against main, and the tail of its branch. Handle 1 chooses the seat. */
function SeatBlocks({p, w}: {p: ViewProps; w: number}) {
  const g = seats(p.v)
  const names = g.envs.length ? g.envs : SEAT_NAMES
  const n = names.length, pad = 4, colW = (w - pad * 2) / n, colX = (i: number) => pad + i * colW + colW / 2
  const top = 27, bh = 40
  const seatHand = g.envs.length > 0 && !st(p, 'seat').disabled
  const pick = (x: number) => p.set('seat', names[clampTo(0, n - 1, Math.floor((x - pad) / colW))]!)
  return <g>
    {names.map((name, i) => {
      const row = g.rows?.find(r => r.workcell === name && r.product === g.product)
      const chosen = name === g.seat, cx = colX(i), x0 = cx - colW / 2 + 3, bw = colW - 6
      const held = row?.state === 'claimed', foreign = row?.state === 'occupied-foreign-lane'
      const colour = foreign ? 'var(--stall)' : 'var(--dp-value)'
      const files = filesOf(row), ahead = row?.ahead, behind = row?.behind
      const clean = held && files === 0 && ahead === 0
      return <g key={name}>
        <text x={cx} y={22} className={chosen ? 'dp-ink' : 'dp-axis'} textAnchor="middle">{name}</text>
        <rect x={x0} y={top} width={bw} height={bh} rx={2}
          style={{fill: held || foreign ? `color-mix(in srgb, ${colour} 24%, transparent)` : 'none', stroke: held || foreign ? colour : 'var(--text-faint)', strokeWidth: chosen ? 1.7 : 1,
            strokeDasharray: held || foreign ? undefined : '2 2', opacity: g.rows ? 1 : .55}} />
        {g.rows && <text x={cx} y={top + 16} className={held || foreign ? 'dp-ink' : 'dp-axis'} textAnchor="middle">{row ? STATE_WORD[row.state] ?? NONE : 'none'}</text>}
        {g.rows && row && (held || foreign) && <text x={cx} y={top + 29} className="dp-ink-dim" textAnchor="middle" style={{fontSize: 8}}>{short(row.claimedBy)}</text>}
        {row && <g>
          <text x={cx} y={84} className="dp-ink" textAnchor="middle" style={{fill: files === undefined ? undefined : files > 0 ? 'var(--stall)' : 'var(--text-faint)'}}>
            {files === undefined ? NONE : files > 0 ? `${files} file${files === 1 ? '' : 's'}` : 'clean'}</text>
          <text x={cx} y={95} className="dp-ink-dim" textAnchor="middle" style={{fill: clean ? 'var(--green)' : undefined}}>
            {held || foreign ? (clean ? 'landed' : ahead == null ? NONE : `+${ahead}`) : behind ? `${behind} behind` : 'at main'}</text>
          {(held || foreign) && row.branch && <text x={cx} y={106} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{tail(row.branch, Math.max(6, Math.floor(colW / 5)))}</text>}
        </g>}
      </g>
    })}
    {!g.rows && <text x={w / 2} y={top + bh + 18} className="dp-axis" textAnchor="middle">no reading of the seats</text>}
    {g.rows && g.seat && g.envs.includes(g.seat)
      && <Handle n={1} x={colX(g.envs.indexOf(g.seat))} y={top + bh + 30} label="Seat" does="Drag along the row to choose the seat."
        onDrag={seatHand ? x => pick(x) : undefined} />}
    {g.rows && <text x={pad + 2} y={140} className="dp-axis">{g.product ?? NONE}</text>}
  </g>
}

function ProductChooser({p}: {p: ViewProps}) {
  const g = seats(p.v)
  const options = g.products.map(x => {
    const mine = g.rows!.filter(r => r.product === x), held = mine.filter(r => r.state !== 'free').length
    return {value: x, label: x, does: `${x}: ${held} of ${mine.length} seats are held.`}
  })
  return <Chooser {...gate(p, 'product', g.rows ? undefined : 'No reading of the seats.')} label="Product" wide does="The project that the seat holds."
    value={g.product ?? ''} options={options} onChange={x => p.set('product', x)} />
}
function SeatRadio({p}: {p: ViewProps}) {
  const g = seats(p.v)
  const options = (g.envs.length ? g.envs : SEAT_NAMES).map(name => {
    const row = g.rows?.find(r => r.workcell === name && r.product === g.product)
    return {value: name, label: name, does: row ? `${name}: ${row.state === 'free' ? 'free' : `${STATE_WORD[row.state] ?? row.state} by ${short(row.claimedBy)}${row.branch ? ` on ${row.branch}` : ''}`}.` : `${name} has no ${g.product ?? 'such'} seat.`}
  })
  return <Radio {...gate(p, 'seat', g.rows ? undefined : 'No reading of the seats.')} label="Seat" stack does="The seat the session joins: one checkout of the product on this machine."
    value={g.seat ?? ''} options={options} onChange={x => p.set('seat', x)} />
}
function JoinRadio({p}: {p: ViewProps}) {
  const g = seats(p.v)
  const why = !g.row ? (g.rows ? 'Choose a product and a seat.' : 'No reading of the seats.') : g.row.state === 'free' ? 'This seat is free. Joining it starts a new lane from main.'
    : g.row.state === 'occupied-foreign-lane' ? FOREIGN(g.row) : undefined
  return <Radio {...gate(p, 'joinAs', why)} label="Join" stack does="Attach: work beside the agents on the standing lane. New lane: replace the standing lane."
    value={g.row?.state === 'free' ? 'new-lane' : joinOf(p.v) ?? ''} options={JOIN} onChange={x => p.set('joinAs', x)} />
}
function LaneField({p}: {p: ViewProps}) {
  const g = seats(p.v), standing = g.row?.state === 'claimed' && joinOf(p.v) !== 'new-lane'
  const why = !g.row ? (g.rows ? 'Choose a product and a seat.' : 'No reading of the seats.') : standing ? 'Attach joins the standing lane. Choose New lane to name another.'
    : g.row.state === 'occupied-foreign-lane' ? FOREIGN(g.row) : undefined
  return <TextField {...gate(p, 'lane', why)} label="Lane" wide does="The branch of the line of work. A free seat cuts it from main; a held seat shows its standing lane."
    value={standing ? g.row!.branch ?? '' : strOf(p.v, 'lane') ?? ''} placeholder={g.row ? `agent/${g.product}-date-time` : NONE} onChange={x => p.set('lane', x)} />
}
/** The agents that share the lane: those the claim lists, else those that declared an edit zone in it. */
const coworkerRows = (g: Seats): RowItem[] => {
  if (!g.row) return [{id: 'none', name: g.rows ? 'No seat chosen' : 'No reading', light: 'unknown'}]
  if (g.row.state === 'free') return [{id: 'free', name: 'No lane holds this seat', light: 'dark'}]
  const named = g.row.workers?.length ? g.row.workers : [...new Set([...(g.row.claimedBy ? [g.row.claimedBy] : []), ...[...g.row.zones].sort((a, b) => (b.since ?? 0) - (a.since ?? 0)).map(z => z.actor)])]
  if (!named.length) return [{id: 'none', name: 'No co-worker named', light: 'dark'}]
  return named.map((actor): RowItem => {
    const zone = g.row!.zones.find(z => z.actor === actor)
    return {id: actor, name: short(actor), light: 'lit', tone: actor === g.actor ? 'accent' : 'value', note: actor === g.row!.claimedBy ? 'lead' : undefined,
      does: `${actor}${zone ? `: edits ${zone.regions.join(', ') || 'no paths'}` : ''}${actor === g.actor ? '. You.' : ''}`}
  })
}

function SeatBands({p}: {p: ViewProps}) {
  const g = seats(p.v), r = g.row, n = filesOf(r)
  return <>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The seats" does="The product's seats on this machine: who holds each, its uncommitted files and how its lane stands against main. Drag handle 1 to choose the seat.">
          <SeatBlocks p={p} w={194} />
        </Display>
      </Section>
      <Section label="Place" width={96}>
        <ProductChooser p={p} />
        <SeatRadio p={p} />
        <LaneField p={p} />
      </Section>
      <Section label="Claim" grow>
        <Readout big label="claim" does="Who holds the seat: free, yours, or another agent's." value={claimWord(g)} tone={r?.state === 'free' ? 'green' : r?.state === 'occupied-foreign-lane' || (r?.state === 'claimed' && !g.mine) ? 'stall' : 'accent'} />
        <Readout label="uncommitted" does="Files with changes that have no commit, tracked or not." value={n} tone={n ? 'stall' : undefined} />
      </Section>
    </Band>
    <Band>
      <Section label="Join" width={120}>
        <JoinRadio p={p} />
        <div className="gs-acts">
          <Action {...gate(p, 'join', joinWhy(g, p.v))} label="Join seat" does="Claim the seat for the workcell's lane: attach to the standing lane, or start a new one, as Join is set." onPress={() => p.set('join', true)} />
          <Action {...gate(p, 'release', releaseWhy(g))} hold label="Release" does="Release the seat after the work has landed. The seat returns to main and the claim clears." onPress={() => p.set('release', true)} />
        </div>
      </Section>
      <Section label="Co-workers" grow>
        <Rows does="The agents that share this lane. Amber is you." items={coworkerRows(g)} size={7} page={numOf(p.v, 'page:co') ?? 0} onPage={x => p.set('page:co', x)} />
      </Section>
    </Band>
  </>
}

// ================================================================================================ the Checkouts page (`co.` keys)

type TenderId = 'release' | 'prune' | 'sweep'
type Tick = 'seat' | 'held' | 'foreign' | 'idle'
const RINGS = ['branches', 'seats', 'worktrees'] as const
type Ring = (typeof RINGS)[number]
const RING_TITLE: Record<Ring, string> = {seats: 'Seats', worktrees: 'Worktrees', branches: 'Branches'}
const TENDERS: Record<TenderId, {label: string; op: string}> = {
  release: {label: 'Release seat', op: 'seat release: refresh the seat to the main branch and clear its claim.'},
  prune: {label: 'Prune worktree', op: 'git worktree remove: remove the checkout that no seat names.'},
  sweep: {label: 'Sweep branch', op: 'git branch -d: remove the stray branch, which Git allows only when it is merged.'},
}
/** The tender ids of the owner's model (HYGIENE_TENDERS) and the key each acts on. */
const TENDER_OF: Record<string, TenderId> = {'release-seat': 'release', 'prune-worktree': 'prune', 'sweep-branch': 'sweep'}
/** The kinds of the owner's model (HygieneFindingKind), by the ring each stands on. */
const RING_OF: Record<string, Ring> = {
  'seat-claimed': 'seats', 'seat-drift': 'seats', 'seat-floor-breach': 'seats', 'checkout-missing': 'seats', 'foreign-lane': 'seats', 'occupied-by-landed': 'seats',
  'stray-branch': 'branches', 'worktree-outside-register': 'worktrees', 'root-mixed': 'worktrees',
}
const KIND_NAME: Record<string, string> = {
  'seat-claimed': 'Seat claimed', 'seat-drift': 'Seat drift', 'seat-floor-breach': 'Disk below floor', 'checkout-missing': 'Checkout missing', 'foreign-lane': 'Foreign lane',
  'occupied-by-landed': 'Seat on a landed branch', 'stray-branch': 'Stray branch', 'worktree-outside-register': 'Worktree outside the register', 'root-mixed': 'Root is a product checkout',
}
const KIND_SAYS: Record<string, string> = {
  'seat-claimed': 'A lane holds the seat. This is not a fault.', 'seat-drift': 'The register and the checkout disagree.', 'seat-floor-breach': 'A seat has less free disk than the floor.',
  'checkout-missing': 'The register names a checkout that is not on disk.', 'foreign-lane': 'Unmerged work of another lane stands in a seat. The decision is yours.',
  'occupied-by-landed': 'The seat stands on a branch that is already merged.', 'stray-branch': 'A lane branch that no seat holds and no claim accounts for.',
  'worktree-outside-register': 'A checkout that no seat names.', 'root-mixed': 'Your root is also the checkout of a product. The decision is yours.',
}
const KIND_SHORT: Record<string, string> = {
  'seat-claimed': 'claimed', 'seat-drift': 'drift', 'seat-floor-breach': 'disk', 'checkout-missing': 'missing', 'foreign-lane': 'foreign', 'occupied-by-landed': 'landed',
  'stray-branch': 'stray', 'worktree-outside-register': 'outside', 'root-mixed': 'mixed',
}
/** The kinds that are readings and not faults. */
const NOT_FAULTS: ReadonlySet<string> = new Set(['seat-claimed'])
/** Which of a finding's operations its ring was read from. */
const RING_OP: Record<Ring, RegExp> = {seats: /seat status/, worktrees: /worktree/, branches: /for-each-ref|branch/}

interface Machine {readonly id: string; readonly label?: string; readonly ref?: string; readonly does?: string}
interface BranchRow {readonly name: string; readonly head?: string | null; readonly checkedOutAt?: string | null; readonly merged?: boolean}
interface Reported {readonly kind: string; readonly subject: string; readonly standing?: string; readonly boundaryOps?: unknown; readonly tenderId?: unknown}
interface Finding {
  readonly id: string; readonly ring: Ring; readonly at: number | undefined; readonly kind: string; readonly fault: boolean; readonly subject: string
  readonly standing: string; readonly ops: readonly string[]; readonly tender: TenderId | undefined; readonly merged: boolean | undefined; readonly dirty: number | undefined
}
interface RingRead {readonly ticks: readonly Tick[]; readonly subjects: readonly string[]}

/** The machine's checkouts as read: each ring, the owner's findings on them, and what the page shows. A ring with no reading, or read
 * from another machine than the one chosen, has no reading; a finding of a kind this page does not know, whose subject no ring holds, is
 * not drawn. A source that refused leaves its ring empty and keeps the owner's words. */
function readCheckouts(v: V) {
  const seatRows = list<SeatReading>(v, 'seats', r => text(r.workcell) && text(r.product))
  const trees = list<WorktreeRow>(v, 'worktrees', r => text(r.path))
  const branches = list<BranchRow>(v, 'branches', r => text(r.name))
  const read = (ticks: Tick[], subjects: string[]): RingRead => ({ticks, subjects})
  const rings: Record<Ring, RingRead | undefined> = {
    seats: seatRows && read(seatRows.map(s => (s.state === 'claimed' ? 'seat' : s.state === 'free' ? 'idle' : 'foreign')), seatRows.map(s => `${s.workcell}/${s.product}`)),
    worktrees: trees && read(trees.map(() => 'held'), trees.map(t => t.path)),
    branches: branches && read(branches.map(b => (b.checkedOutAt ? 'held' : 'idle')), branches.map(b => b.name)),
  }
  const machines = list<Machine>(v, 'machines', r => text(r.id))
  const chosen = machines?.find(m => m.id === strOf(v, 'machine'))
  const standsOn = strOf(v, 'machineRef')
  const elsewhere = !!chosen?.ref && standsOn !== undefined && chosen.ref !== standsOn
  const sources = list<BoundaryOpSource>(v, 'sources', r => text(r.boundaryOp))
  const refusal = Object.fromEntries(RINGS.map(ring => [ring, sources?.find(s => RING_OP[ring].test(s.boundaryOp) && s.refusal)?.refusal])) as Record<Ring, string | undefined>
  const readable = (ring: Ring) => !elsewhere && !!rings[ring] && !refusal[ring]
  const reported = list<Reported>(v, 'findings', r => text(r.kind) && text(r.subject))
  const all: Finding[] = []
  for (const f of reported ?? []) {
    const ring = RING_OF[f.kind] ?? RINGS.find(r => rings[r]?.subjects.includes(f.subject))
    if (!ring) continue
    const i = rings[ring]?.subjects.indexOf(f.subject) ?? -1, at = i < 0 ? undefined : i
    const branch = ring === 'branches' && at !== undefined ? branches?.[at] : undefined
    const seat = ring === 'seats' && at !== undefined ? seatRows?.[at] : undefined
    all.push({id: `${f.kind}:${f.subject}`, ring, at, kind: f.kind, fault: !NOT_FAULTS.has(f.kind), subject: f.subject, standing: text(f.standing) ? f.standing : NONE,
      ops: Array.isArray(f.boundaryOps) ? f.boundaryOps.filter(text) : [], tender: text(f.tenderId) ? TENDER_OF[f.tenderId] : undefined,
      merged: typeof branch?.merged === 'boolean' ? branch.merged : undefined,
      dirty: seat && (seat.dirty !== null || seat.untracked !== null) ? (seat.dirty ?? 0) + (seat.untracked ?? 0) : undefined})
  }
  const faultsOnly = boolOf(v, 'faults') === true
  const shown = all.filter(f => readable(f.ring) && (!faultsOnly || f.fault))
  const disk = list<{workcell: string; freeGb?: unknown}>(v, 'disk', r => text(r.workcell))
  const free = disk?.flatMap(d => (typeof d.freeGb === 'number' && Number.isFinite(d.freeGb) ? [{workcell: d.workcell, gb: d.freeGb}] : []))
  return {rings, machines, chosen, standsOn, elsewhere, refusal, readable, found: reported !== undefined, shown, faultsOnly, noun: faultsOnly ? 'faults' : 'findings',
    anyRead: RINGS.some(readable), free: elsewhere ? undefined : free}
}
type Checkouts = ReturnType<typeof readCheckouts>
const CHECKOUTS = new WeakMap<V, Checkouts>()
function checkouts(v: V): Checkouts {
  let g = CHECKOUTS.get(v)
  if (!g) { g = readCheckouts(v); CHECKOUTS.set(v, g) }
  return g
}
const lastName = (f: Finding) => (f.ring === 'worktrees' ? f.subject.replace(/^\/Users\/[^/]+\/Central\//, '') : f.subject.split('/').slice(-2).join('/'))

/** Whether a finding's tender can run now, and if not, why. The host's standing for the tender's key comes last. */
function tenderState(p: ViewProps, f: Finding | undefined): {ok: boolean; why?: string} {
  if (!f) return {ok: false, why: 'Choose a finding first.'}
  if (!f.tender) return {ok: false, why: f.kind === 'foreign-lane' || f.kind === 'root-mixed' ? KIND_SAYS[f.kind] : 'No tender fits this finding.'}
  if (f.tender === 'release' && f.dirty !== undefined && f.dirty > 0) return {ok: false, why: `The seat holds ${f.dirty} uncommitted files. It is never released here.`}
  if (f.tender === 'sweep' && f.merged === false) return {ok: false, why: 'This branch holds unmerged work. Leave it to its lane.'}
  const held = st(p, f.tender).disabled
  return held ? {ok: false, why: held} : {ok: true}
}

const RING_R = [1, .7, .4]
const polar = (cx: number, cy: number, r: number, i: number, n: number) => {
  const a = -Math.PI / 2 + 2 * Math.PI * (i + .5) / n
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
}

/** Three rings — branches, seats and worktrees from the outside in. A tick for each thing read; a dot beside a tick that has a finding
 * (orange a fault, teal a reading); an amber ring on the dot where a tender fits; the chosen finding's dot is ringed in white. Beside
 * them, each ring's count. A ring with no reading is dashed. */
function CheckoutRings({p}: {p: ViewProps}) {
  const g = checkouts(p.v), sel = strOf(p.v, 'sel')
  const cx = 66, cy = 70, R = 52, t = 2.4, off = 6.5
  const marks = (ring: Ring, k: number) => {
    const read = g.rings[ring]
    if (!g.readable(ring) || !read) return null
    const n = read.ticks.length, r = R * RING_R[k]!
    const lines: Record<Tick, string> = {seat: '', held: '', foreign: '', idle: ''}
    for (let i = 0; i < n; i++) {
      const [x1, y1] = polar(cx, cy, r - t, i, n), [x2, y2] = polar(cx, cy, r + t, i, n), kind = read.ticks[i]!
      lines[kind] = `${lines[kind]}M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`
    }
    const flagged = new Map<number, Finding[]>()
    g.shown.filter(f => f.ring === ring && f.at !== undefined).forEach(f => flagged.set(f.at!, [...(flagged.get(f.at!) ?? []), f]))
    return <g key={ring}>
      <path d={lines.idle} stroke="var(--text-faint)" strokeWidth={1} opacity={.7} fill="none" />
      <path d={lines.held} stroke="var(--dp-value)" strokeWidth={1.3} fill="none" />
      <path d={lines.seat} stroke="var(--dp-value)" strokeWidth={1.5} fill="none" />
      <path d={lines.foreign} stroke="var(--stall)" strokeWidth={1.5} fill="none" />
      {[...flagged].map(([i, fs]) => {
        const [x, y] = polar(cx, cy, r + off, i, n), fault = fs.some(f => f.fault), fits = fs.some(f => tenderState(p, f).ok), chosen = fs.some(f => f.id === sel)
        return <g key={i}>
          <circle cx={x} cy={y} r={k === 0 ? t * .8 : t} fill={fault ? 'var(--stall)' : 'var(--dp-value)'} />
          {fits && <circle cx={x} cy={y} r={t + 2.2} fill="none" stroke="var(--accent)" strokeWidth={1} />}
          {chosen && <circle cx={x} cy={y} r={t + 4} fill="none" stroke="var(--text)" strokeWidth={1} />}
        </g>
      })}
    </g>
  }
  return <g>
    {RINGS.map((ring, k) => <g key={ring}>
      <circle cx={cx} cy={cy} r={R * RING_R[k]!} className="dp-faint" strokeDasharray={g.readable(ring) ? undefined : '2 3'} opacity={g.readable(ring) ? 1 : .6} />
      {marks(ring, k)}
    </g>)}
    {!g.anyRead && <text x={cx} y={cy + 3} className="dp-axis" textAnchor="middle">no reading</text>}
    {RINGS.map((ring, i) => {
      const y = 24 + i * 40, read = g.rings[ring], flagged = g.shown.filter(f => f.ring === ring).length
      return <g key={ring}>
        <text x={134} y={y} className="dp-axis">{RING_TITLE[ring].toLowerCase()}</text>
        <text x={134} y={y + 12} className="dp-ink">{g.readable(ring) ? `${read?.ticks.length ?? 0} read` : g.refusal[ring] ? 'refused' : 'no reading'}</text>
        {g.readable(ring) && <text x={134} y={y + 23} className="dp-ink-dim">{g.found ? `${flagged} flagged` : NONE}</text>}
      </g>
    })}
  </g>
}

const findingRows = (g: Checkouts): RowItem[] => {
  const refused = RINGS.flatMap((ring): RowItem[] => (g.refusal[ring] ? [{id: `refused:${ring}`, name: `${RING_TITLE[ring]} not read`, light: 'dark', tone: 'stall', why: g.refusal[ring]}] : []))
  if (!g.anyRead) return refused.length ? refused : [{id: 'none', name: g.elsewhere ? 'No reading from that machine' : 'No reading', light: 'unknown'}]
  if (!g.found) return [...refused, {id: 'none', name: 'No reading of the findings', light: 'unknown'}]
  if (g.shown.length === 0) return [...refused, {id: 'clear', name: g.faultsOnly ? 'No faults' : 'No findings', light: 'lit', tone: 'green'}]
  return [...refused, ...g.shown.map((f): RowItem => ({id: f.id, name: lastName(f), light: 'lit', tone: f.fault ? 'stall' : 'value', note: KIND_SHORT[f.kind] ?? f.kind,
    does: `${KIND_NAME[f.kind] ?? f.kind}: ${KIND_SAYS[f.kind] ?? f.standing}`}))]
}

function CheckoutBands({p}: {p: ViewProps}) {
  const g = checkouts(p.v), sel = g.shown.find(f => f.id === strOf(p.v, 'sel')), can = tenderState(p, sel), read = numOf(p.v, 'readAge')
  const low = g.free?.length ? g.free.reduce((a, b) => (b.gb < a.gb ? b : a)) : undefined
  const t = sel?.tender ? TENDERS[sel.tender] : undefined
  return <>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The checkouts" does="Rings of branches, seats and worktrees, with the count of each. A dot marks a thing with a finding; an amber ring, a tender that fits."
          corner={g.anyRead && g.found ? `${g.shown.length} ${g.noun}` : NONE}>
          <CheckoutRings p={p} />
        </Display>
      </Section>
      <Section label="Show" width={104}>
        <Chooser {...st(p, 'machine')} label="Machine" wide does="Whose checkouts the page reads. Link adds the other machines that share your ground." value={strOf(p.v, 'machine') ?? ''}
          options={(g.machines ?? []).map(m => ({value: m.id, label: m.label ?? m.id, does: m.does}))} onChange={x => p.set('machine', x)} />
        <Toggle {...st(p, 'faults')} label="Faults only" does="On: hide the findings that are not faults. A claimed seat is not a fault." on={boolOf(p.v, 'faults') === true}
          unknown={boolOf(p.v, 'faults') === undefined} onChange={x => p.set('faults', x)} />
        <Action {...st(p, 'reread')} label="Read now" does="Read every checkout of the machine once." onPress={() => p.set('reread', true)} />
      </Section>
      <Section label="Read" grow>
        <Readout label="read" does="When the page last read its sources." value={read === undefined ? undefined : read === 0 ? 'now' : `${read} s ago`} />
        <Readout label="disk free" does={g.free?.length ? `The free disk of each workcell: ${g.free.map(d => `${d.workcell} ${d.gb.toFixed(1)} GB`).join(', ')}. The lowest shows.` : 'The free disk of each workcell.'}
          value={low === undefined ? undefined : `${low.gb.toFixed(1)} GB`} tone={g.shown.some(f => f.kind === 'seat-floor-breach') ? 'stall' : undefined} />
        <Readout label="receipt" does={strOf(p.v, 'receipt') ? `The last tender's receipt: ${strOf(p.v, 'receipt')}` : 'Each tender returns a receipt.'} value={numOf(p.v, 'receipts')} />
      </Section>
    </Band>
    <Band>
      <Section label="Findings" grow>
        <Rows does="What the page found, with its kind. Orange is a fault; teal a reading that is not one. A finding is a reading, not a verdict. Press one to choose it."
          items={findingRows(g)} size={8} selected={sel?.id} onSelect={id => { if (!id.startsWith('refused:') && id !== 'none' && id !== 'clear') p.set('sel', id) }}
          page={numOf(p.v, 'page:findings') ?? 0} onPage={x => p.set('page:findings', x)} />
      </Section>
      <Section label="Tend" width={112}>
        <Readout label="chosen" does={sel ? `${KIND_NAME[sel.kind] ?? sel.kind}: ${KIND_SAYS[sel.kind] ?? sel.standing} Rests on ${sel.ops.join(' · ') || NONE}.` : 'The finding you chose.'}
          value={sel ? KIND_SHORT[sel.kind] ?? sel.kind : undefined} tone={sel?.fault ? 'stall' : 'value'} />
        <Action {...(sel?.tender ? st(p, sel.tender) : {})} hold label={t?.label ?? 'Tend'} does={t ? `${t.op} You approve it by holding.` : 'The tender that fits the finding you chose.'}
          onPress={() => { if (sel?.tender) p.set(sel.tender, sel.subject) }} disabled={can.ok ? undefined : can.why} />
      </Section>
    </Band>
  </>
}

// ------------------------------------------------------------------------------------------------ the pane

/** The lines of a patch: hunk headers, context, additions and deletions, with the line numbers the hunks give. */
function patchLines(patch: string) {
  const out: {kind: 'hunk' | 'context' | 'add' | 'delete' | 'note'; text: string; old?: number; next?: number}[] = []
  let old = 0, next = 0, hunk = false
  for (const line of patch.split('\n')) {
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (m) { old = Number(m[1]); next = Number(m[2]); hunk = true; out.push({kind: 'hunk', text: line}); continue }
    if (!hunk) continue
    const k = line[0]
    if (k === ' ') out.push({kind: 'context', text: line.slice(1), old: old++, next: next++})
    else if (k === '-') out.push({kind: 'delete', text: line.slice(1), old: old++})
    else if (k === '+') out.push({kind: 'add', text: line.slice(1), next: next++})
    else if (k === '\\') out.push({kind: 'note', text: line})
  }
  return out
}
const SIGN = {hunk: '', context: ' ', add: '+', delete: '−', note: ''} as const
const leaf = (path: string) => path.split('/').slice(-2).join('/')

function Pane({p}: {p: ViewProps}) {
  const v = p.v, commits = commitsOf(v), checks = checksOf(v), diff = diffOf(v), files = numOf(v, 'files')
  const sel = diff?.find(f => f.path === strOf(v, 'sel')) ?? diff?.[0]
  const lines = sel?.patch ? patchLines(sel.patch) : []
  const more = diff && files !== undefined && files > diff.length ? files - diff.length : 0
  const shared = boolOf(v, 'shared'), seat = seatOf(v)
  return <div className="gs-pane">
    <header className="gs-top">
      <h3>Git / landing<small>{strOf(v, 'branch') ?? NONE} · {seatName(v) ?? NONE}{shared === true ? ' · shared with lead' : ''}</small></h3>
      <span className="gs-top-read">{seat?.claimedBy ? `held by ${seat.claimedBy}` : NONE}</span>
    </header>
    <div className="dp-display gs-wide"><svg viewBox="0 0 760 76" preserveAspectRatio="xMinYMid meet" role="group" aria-label="The branch"><Branch p={p} g={WIDE} /></svg></div>
    <div className="gs-cols">
      <section className="gs-left">
        <div className="gs-block">
          <h4>Commits<b>{commits ? `${commits.length}${numOf(v, 'ahead') !== undefined && numOf(v, 'ahead')! > commits.length ? ` of ${numOf(v, 'ahead')}` : ''}` : NONE}</b></h4>
          {commits === undefined ? <p className="gs-none">No reading of the commits.</p>
            : !commits.length ? <p className="gs-none">No commits beyond main.</p>
            : <ul className="gs-list">{commits.map(c => <li key={c.sha} className="gs-commit" data-i={`${c.sha}|${c.subject}`}><code>{c.sha.slice(0, 7)}</code><span>{c.subject}</span></li>)}</ul>}
        </div>
        <div className="gs-block">
          <h4>Checks<b>{checkText(checks) ?? NONE}</b></h4>
          {checks === undefined ? <p className="gs-none">No reading of the checks.</p>
            : !checks.length ? <p className="gs-none">The remote runs no checks.</p>
            : <ul className="gs-list">{checks.map(c => <li key={c.name} className="gs-check" data-i={`${c.name}|${c.state}. The remote reports it.`}>
              <span className="dp-lamp" data-light={c.state === 'running' ? 'unknown' : 'lit'} data-tone={c.state === 'failed' ? 'stall' : 'green'} /><span>{c.name}</span><i>{c.state}</i></li>)}</ul>}
        </div>
        <div className="gs-block" data-grow="true">
          <h4>Files<b>{files === undefined ? NONE : files}</b></h4>
          {diff === undefined ? <p className="gs-none">No reading of the changes.</p>
            : !diff.length ? <p className="gs-none">No changes against main.</p>
            : <ul className="gs-list">{diff.map(f => <li key={f.path}><button type="button" className="gs-file" aria-pressed={sel?.path === f.path} onClick={() => p.set('sel', f.path)} data-i={`${f.path}|${f.status === 'A' ? 'Added' : f.status === 'D' ? 'Deleted' : 'Modified'} file.`}>
              <em data-status={f.status}>{f.status}</em><span>{leaf(f.path)}</span><i><span className="gs-add">+{f.adds ?? NONE}</span> <span className="gs-del">−{f.dels ?? NONE}</span></i></button></li>)}
              {more > 0 && <li className="gs-more">{more} more files are not in the reading.</li>}</ul>}
        </div>
      </section>
      <section className="gs-diff" aria-label="The diff">
        {sel ? <>
          <div className="gs-diff-head"><b>{sel.path}</b><span><span className="gs-add">+{sel.adds ?? NONE}</span> <span className="gs-del">−{sel.dels ?? NONE}</span></span></div>
          {lines.length ? <div className="gs-lines" role="region" aria-label="File changes">
            {lines.map((l, i) => <div key={i} className="gs-line" data-kind={l.kind}><span>{l.old ?? ''}</span><span>{l.next ?? ''}</span><span>{SIGN[l.kind]}</span><span>{l.text}</span></div>)}
          </div> : <p className="gs-diff-none">The reading has no patch for this file.</p>}
        </> : <p className="gs-diff-none">{diff === undefined ? 'No reading of the changes.' : 'No changes against main.'}</p>}
      </section>
    </div>
  </div>
}

// ------------------------------------------------------------------------------------------------ the sample readings
// What the gallery reads on: the real seat env-1/actuation on its lane `fold/day-close-20261012` (its three commits, the sums of
// `git diff origin/main...HEAD`, the first files of that diff with their patches, the repository's workflow names) and the real seat
// env-1/o-i on `dlw/build`. `defaults` and `fixtures` use them and nothing else does. The checks' states are the fixture's.

const dump = (x: unknown) => JSON.stringify(x)
const ACT = 'ProjectCentral/now'
const DIFF: Changed[] = [
  {path: `${ACT}/agents/clean-state-landed-pr-82-merged-2026-09-14.json`, status: 'M', adds: 2, dels: 1,
    patch: '@@ -19,6 +19,7 @@\n     "2026-10-08",\n     "2026-10-09",\n     "2026-10-10",\n-    "2026-10-11"\n+    "2026-10-11",\n+    "2026-10-12"\n   ]\n }'},
  {path: `${ACT}/agents/constitution-applied-next-tier-verified-2026-09-21.json`, status: 'M', adds: 6, dels: 5,
    patch: '@@ -11,5 +10,0 @@\n-  "carried_from_days": [\n-    "2026-10-09",\n-    "2026-10-10",\n-    "2026-10-11"\n-  ],\n@@ -19,0 +15,6 @@\n+  ],\n+  "carried_from_days": [\n+    "2026-10-09",\n+    "2026-10-10",\n+    "2026-10-11",\n+    "2026-10-12"'},
  {path: `${ACT}/day/2026-10-12.md`, status: 'A', adds: 976, dels: 0},
  {path: `${ACT}/day/2026-10-12.sources/agents/epistemic-cultivation-research-ground-and-record-2026-09-09.json`, status: 'A', adds: 27, dels: 0},
  {path: `${ACT}/day/2026-10-12.sources/agents/prime-physical-relational-campaign-awaits-a-2026-09-09.json`, status: 'A', adds: 29, dels: 0},
  {path: `${ACT}/day/2026-10-12.sources/agents/series-1-experiment-thread-activated-live-2026-09-13.json`, status: 'A', adds: 27, dels: 0},
]
const COMMITS: Commit[] = [
  {sha: '933731e', subject: 'Register integrity: drop the test that pinned every NOW record’s status'},
  {sha: 'f015fff', subject: 'Register integrity: reconcile the NOW horizon to the 2026-10-12 day close'},
  {sha: 'b88218e', subject: 'ProjectCentral NOW: the 2026-10-12 day close lands in git (actuation)'},
]
const CHECKS: Check[] = [
  {name: 'Native CLI', state: 'passed'}, {name: 'Native Skills', state: 'passed'},
  {name: 'Pre-local build', state: 'running'}, {name: 'Product documentation maintenance', state: 'passed'},
]

/** The Seat page's sample: the real `seat status` of the o-i and actuation seats on 16 Oct, in the shape of SeatRow. */
const SEAT_SAMPLE = [
  {workcell: 'env-1', product: 'actuation', state: 'claimed', branch: 'fold/day-close-20261012', head: '933731e', claimedBy: 'claude-code:dlw-conductor', dirty: 0, untracked: 0, ahead: 3, behind: 0,
    zones: [{actor: 'claude-code:dlw-conductor', regions: ['ProjectCentral', '.gitignore', 'experiments', 'scripts'], since: 1791846105}]},
  {workcell: 'env-2', product: 'actuation', state: 'free', branch: null, head: 'cd1f4ce', claimedBy: null, dirty: 0, untracked: 1, ahead: 0, behind: 2, zones: []},
  {workcell: 'env-3', product: 'actuation', state: 'free', branch: null, head: 'cd1f4ce', claimedBy: null, dirty: 0, untracked: 1, ahead: 0, behind: 2, zones: []},
  {workcell: 'env-1', product: 'o-i', state: 'claimed', branch: 'dlw/build', head: '5b3c3e0fc', claimedBy: 'claude-code:dlw-lead', dirty: 40, untracked: 22, ahead: 244, behind: 0,
    zones: [{actor: 'claude-code:dlw-manual', regions: ['packages/live-shell/ui/src/inhabitants/catalogue'], since: 1792078733},
      {actor: 'claude-code:dlw-lead', regions: ['desktop/cradle/docs/world-shell'], since: 1791851470},
      {actor: 'claude-code:dlw-conductor', regions: ['ProjectCentral', '.gitignore', 'experiments', 'scripts'], since: 1791846057}]},
  {workcell: 'env-2', product: 'o-i', state: 'claimed', branch: 'dlw/native-build', head: '9a1974d13', claimedBy: 'claude-code:dlw-lead', dirty: 0, untracked: 1, ahead: 229, behind: 0,
    zones: [{actor: 'claude-code:dlw-manual', regions: ['docs/dlw'], since: 1791897450}]},
  {workcell: 'env-3', product: 'o-i', state: 'free', branch: null, head: '65202d830', claimedBy: null, dirty: 0, untracked: 0, ahead: 0, behind: 75, zones: []},
  {workcell: 'env-1', product: 'ql-mef', state: 'free', branch: null, head: '37e3085', claimedBy: null, dirty: 0, untracked: 0, ahead: 0, behind: 1, zones: []},
  {workcell: 'env-2', product: 'ql-mef', state: 'free', branch: null, head: '73097be', claimedBy: null, dirty: 0, untracked: 0, ahead: 0, behind: 6, zones: []},
  {workcell: 'env-3', product: 'ql-mef', state: 'free', branch: null, head: '36f9eb0', claimedBy: null, dirty: 0, untracked: 0, ahead: 0, behind: 0, zones: []},
]
const SEAT_DEFAULTS = {actor: 'claude-code:dlw-conductor', product: 'actuation', seat: 'env-1', lane: '', joinAs: 'attach', seats: dump(SEAT_SAMPLE)}

/** The Checkouts page's sample, in the shapes of centralHygieneModel: the seats, worktrees and branches of O-I as they stood on 15 Oct.
 * The findings are the model's own classification of the census, as the shell would hand it over. */
function checkoutSample(opts: {merged?: boolean; foreign?: boolean} = {}) {
  const root = '/Users/admin/Central', cell = (env: string) => `${root}/worktrees/${env}`, at = '2026-10-15T09:12:00.000Z'
  const LEAD = 'claude-code:dlw-lead', CONDUCTOR = 'claude-code:dlw-conductor'
  const pose = (a: string, b: string, c: string, d: string) => `register pose ('${a}', '${b}') != live ('${c}', '${d}')`
  const floor = (gb: string) => ({admissionNote: `floor breach recorded: ${gb} GB free < soft 20 GB`})
  const seat = (env: string, product: string, head: string, more: Partial<SeatReading> = {}): SeatReading => ({
    workcell: env, workcellPath: cell(env), product, state: 'free', branch: null, head, claimedBy: null, dirty: null, untracked: null, ahead: null, behind: null,
    drift: null, admissionNote: null, ...more,
  })
  const lane = (branch: string, by: string, ahead: number, more: Partial<SeatReading> = {}): Partial<SeatReading> => ({state: 'claimed', branch, claimedBy: by, dirty: 0, untracked: 0, ahead, ...more})
  const foreign = (s: SeatReading): SeatReading => (opts.foreign && s.workcell === 'env-3' && s.product === 'o-i' ? {...s, state: 'occupied-foreign-lane', branch: 'feat/central-field-base', head: '963383814'} : s)
  const seatRows: SeatReading[] = [
    seat('env-1', 'actuation', '933731e', lane('fold/day-close-20261012', CONDUCTOR, 3, {drift: pose('fold/day-close-20261012', '7b4af99', 'fold/day-close-20261012', '933731e')})),
    seat('env-1', 'central', '8aa1065', lane('fix/day-close-no-t-payloads', CONDUCTOR, opts.merged ? 0 : 1, {drift: pose('fold/day-close-20261012', 'cf58c54', 'fix/day-close-no-t-payloads', '8aa1065')})),
    seat('env-1', 'o-i', '9b6caea90', lane('dlw/build', LEAD, 197, {dirty: 30, untracked: 15, drift: pose('dlw/phase1-semantics-20261013', 'cc69e19fa', 'dlw/build', '9b6caea90')})),
    seat('env-2', 'actuation', 'cd1f4ce'), seat('env-2', 'central', '352bc31', floor('18.0')),
    seat('env-2', 'o-i', '2de90416e', lane('dlw/native-build', LEAD, 171, {untracked: 1, drift: pose('dlw/native-build', '2491a11b6', 'dlw/native-build', '2de90416e')})),
    seat('env-3', 'actuation', 'cd1f4ce', floor('15.3')), seat('env-3', 'central', 'cf58c54', floor('9.3')), seat('env-3', 'o-i', '65202d830'),
  ].map(foreign)
  const tree = (path: string, branch: string | null, head: string, more: Partial<WorktreeRow> = {}): WorktreeRow => ({path, head, branch, bare: false, detached: branch === null, ...more})
  const trees: WorktreeRow[] = [
    tree(`${root}/Work/O-I`, 'main', '1cc77db12', {main: true}),
    tree(`${cell('env-1')}/o-i`, 'dlw/build', '9b6caea90'),
    tree(`${cell('env-2')}/o-i`, 'dlw/native-build', '2de90416e'),
    opts.foreign ? tree(`${cell('env-3')}/o-i`, 'feat/central-field-base', '963383814') : tree(`${cell('env-3')}/o-i`, null, '65202d830'),
    ...(opts.foreign ? [tree('/private/tmp/o-i-lane', 'agent/o-i-20261007-1639', '7fbde446e')] : []),
  ]
  const names: readonly (readonly [string, string, boolean?])[] = [
    ['agent/o-i-20261007-0824', '9a7de2d82', true], ['agent/o-i-20261007-1639', '7fbde446e', false], ['agent/o-i-20261008-1823', '1fb4986c6', false],
    ['dlw/build', '9b6caea90'], ['dlw/native-build', '2de90416e'], ['feat/281-played-instrument-in-app', '78cb79abc', true], ['feat/central-field-base', '963383814', false],
    ['feat/personal-history-user-20261006', '54373ab54', true], ['fold/day-close-20261012', '938cb12a4'], ['main', '1cc77db12'], ['recover/tarot-score-312-20261007', '5fbbe477e'],
  ]
  const held = new Map<string, string>(trees.filter(t => t.branch).map((t): [string, string] => [t.branch!, t.path]))
  const branches = names.map(([name, head, merged]) => ({name, head, checkedOutAt: held.get(name) ?? null, ...(merged === undefined ? {} : {merged})}))
  const sources: BoundaryOpSource[] = [{boundaryOp: 'op workcell_status_read', channel: 'kernel-op', at}, {boundaryOp: 'op git_repository_read (project O-I)', channel: 'kernel-op', at},
    {boundaryOp: 'seat status (Control/user/workcell/seat)', channel: 'machine-instrument', at},
    {boundaryOp: 'git worktree list --porcelain', channel: 'machine-instrument', at},
    {boundaryOp: 'git for-each-ref refs/heads', channel: 'machine-instrument', at}]
  const census = assembleCensus({sources, seats: seatRows, worktrees: trees, branches, machineRef: 'workcell:mac'})
  const findings = hygieneFindings(census, registeredSeatPaths(census))
  return {seats: dump(seatRows), worktrees: dump(trees), branches: dump(branches), sources: dump(sources), findings: dump(findings)}
}
const CHECKOUT_DEFAULTS = {
  machine: 'this', machineRef: 'workcell:mac', faults: true, readAge: 12,
  machines: dump([{id: 'this', label: 'This machine', ref: 'workcell:mac'}, {id: 'omarchy', label: 'omarchy', ref: 'workcell:omarchy', does: 'The linked machine workcell:omarchy.'}]),
  disk: dump([{workcell: 'env-1', freeGb: 44.6}, {workcell: 'env-2', freeGb: 44.6}, {workcell: 'env-3', freeGb: 18.2}]),
  ...checkoutSample(),
}

const DEFAULTS: Values = {
  light: 'lit', branch: 'fold/day-close-20261012', shared: false,
  seat: dump({workcell: 'env-1', product: 'actuation', state: 'claimed', claimedBy: 'claude-code:dlw-conductor'}),
  uncommitted: 2, ahead: 3, behind: 0, added: 2497, removed: 411, files: 121,
  'commit-policy': 'per task', 'push-policy': 'off', landAs: 'draft',
  commits: dump(COMMITS), diff: dump(DIFF), checks: dump(CHECKS),
  ...prefixed('seat.', SEAT_DEFAULTS) as Values,
  ...prefixed('co.', CHECKOUT_DEFAULTS) as Values,
}
const seatOfPage = (p: ViewProps) => scoped(p, 'seat.')
const coOf = (p: ViewProps) => scoped(p, 'co.')

// ------------------------------------------------------------------------------------------------ the device

export const design: DesignedDevice = {
  id: 'workcell:git-seat',
  title: 'Git / landing',
  kind: 'connection',
  firstPage: 'landing',
  defaults: DEFAULTS,
  fixtures: {
    'A lane in progress': {'push-policy': 'on land'},
    'A long lane': {
      branch: 'dlw/build', shared: true, seat: dump({workcell: 'env-1', product: 'o-i', state: 'claimed', claimedBy: 'claude-code:dlw-lead'}),
      uncommitted: 58, ahead: 242, behind: 0, added: 101783, removed: 30442, files: 893, checks: undefined,
      commits: dump([{sha: 'e01c76c11', subject: 'Designed device: Run, bindable (DLW device run)'}, {sha: '419d508c6', subject: 'Impact is bindable: subject, nodes, edges, references and sessions are value keys (retrofit)'},
        {sha: 'ea15033ad', subject: 'oi: per-call checks read the cached suite verification and hash in-process'}]),
      diff: dump([{path: 'desktop/cradle/docs/world-shell/targets.json', status: 'M', adds: 7603, dels: 1062}, {path: 'packages/live-shell/ui/tests/fixtures/atlas-suite-reading.json', status: 'A', adds: 1906, dels: 0},
        {path: 'desktop/cradle/kernel/src/graph.rs', status: 'M', adds: 1645, dels: 192}, {path: 'desktop/cradle/kernel/src/owner_read.rs', status: 'M', adds: 1239, dels: 29},
        {path: 'desktop/cradle/kernel/src/owner_write.rs', status: 'A', adds: 1016, dels: 0}, {path: 'desktop/cradle/docs/world-shell/wayfinder/tools/build_rehome.py', status: 'A', adds: 846, dels: 0}]),
      'seat.product': 'o-i',
    },
    'A free seat': {'seat.product': 'ql-mef', 'seat.seat': 'env-2'},
    'After a merge': prefixed('co.', checkoutSample({merged: true})),
    'A foreign lane': prefixed('co.', checkoutSample({foreign: true})),
    'No machine read': prefixed('co.', {seats: undefined, worktrees: undefined, branches: undefined, findings: undefined, disk: undefined,
      sources: dump([{boundaryOp: 'op workcell_status_read', channel: 'kernel-op', at: '2026-10-15T09:12:00.000Z'},
        {boundaryOp: 'git worktree list --porcelain', channel: 'machine-instrument', at: '2026-10-15T09:12:00.000Z', refusal: 'the git repository reading did not answer'}])}),
    'No readings': Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, undefined])),
  },

  folded: p => <Folded title="Git" light={light(p)} readings={[tail(strOf(p.v, 'branch'), 24)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Git / landing" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The branch" does="Main along the bottom; each dot is a commit; a pulsing hollow dot is work with no commit. The dashed line is where Land takes the branch. Drag handle 1 to set Land as."
        corner={tail(strOf(p.v, 'branch'), 20)}>
        <Branch p={p} g={COMPACT} live />
      </Display>
    </Section>
    <Section label="Macros" cols={3}>
      <div className="gs-tall"><CommitRadio p={p} /></div>
      <div className="gs-tall"><LandAsRadio p={p} /></div>
      <PushToggle p={p} />
      <LandAction p={p} />
    </Section>
  </Panel>,

  whole: p => {
    const v = p.v, checks = checksOf(v), uncommitted = numOf(v, 'uncommitted'), files = numOf(v, 'files'), page = pageOf(p)
    return <Panel title="Git / landing" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} pages={PAGES} page={page} onPage={p.setPage}>
      {page === 'seat' ? <SeatBands p={seatOfPage(p)} /> : page === 'checkouts' ? <CheckoutBands p={coOf(p)} /> : <>
        <Band>
          <Section width={206}>
            <Display w={194} h={146} label="The branch" does="Main along the bottom; each dot is a commit; a pulsing hollow dot is work with no commit. The dashed line is where Land takes the branch. Drag handle 1 to set Land as.">
              <Branch p={p} g={WHOLE} live />
            </Display>
          </Section>
          <Section label="Seat" width={110}>
            <Reading label="branch" does={`The branch the agent works on${strOf(v, 'branch') ? `: ${strOf(v, 'branch')}` : ''}. The seat reports it.`} value={tail(strOf(v, 'branch'), 16) === NONE ? undefined : tail(strOf(v, 'branch'), 16)} />
            <Reading label="seat" does={`The checkout where the agent works${seatOf(v)?.claimedBy ? `, held by ${seatOf(v)!.claimedBy}` : ''}${boolOf(v, 'shared') ? '. A helper shares it with its lead' : ''}. See the Seat page.`} value={seatName(v)} />
            <Reading label="uncommitted" does="The files that have no commit." value={uncommitted === undefined ? undefined : `${uncommitted} ${uncommitted === 1 ? 'file' : 'files'}`} tone={uncommitted ? 'accent' : uncommitted === 0 ? 'green' : undefined} />
          </Section>
          <Section label="Cadence" grow>
            <CommitRadio p={p} />
            <PushToggle p={p} />
          </Section>
        </Band>
        <Band>
          <Section label="Landing" cols={2} width={124}>
            <div className="gs-tall"><LandAsRadio p={p} /></div>
            <Reading label="added" does="Lines added against main." value={numOf(v, 'added') === undefined ? undefined : `+${numOf(v, 'added')}`} tone="green" />
            <Reading label="removed" does="Lines removed against main." value={numOf(v, 'removed') === undefined ? undefined : `−${numOf(v, 'removed')}`} tone="rec" />
            <LandAction p={p} />
            <Reading label="files" does="Files changed against main." value={files === undefined ? undefined : `${files}`} />
          </Section>
          <Section label="Checks" grow>
            <Rows label={checks ? `Checks · ${checkText(checks)}` : 'Checks · no reading'} does="The checks the remote runs on the branch. Green passed; hollow still runs; orange failed. The device does not make them up." items={checkRows(v)} size={7} />
          </Section>
        </Band>
      </>}
    </Panel>
  },

  full: p => <Pane p={p} />,

  widget: p => <Tile title="Git" light={light(p)} span={2} onFull={p.nav.full}>
    <div className="gs-tile-pic">
      <Display w={112} h={78} label="The branch" does="Main along the bottom; each dot is a commit; a pulsing hollow dot is work with no commit.">
        <Branch p={p} g={TILE} />
      </Display>
      <span className="gs-tile-branch" data-i={`Branch|${strOf(p.v, 'branch') ?? 'No reading of the branch.'}`}>{tail(strOf(p.v, 'branch'), 22)}</span>
    </div>
    <div className="gs-tile-side">
      <Reading label="changes" does="Lines added and removed against main." value={changeText(p.v)} />
      <Reading label="checks" does="The checks that passed, of all the checks the remote runs." value={checkText(checksOf(p.v))} tone={checkTone(checksOf(p.v))} />
      <LandAction p={p} />
    </div>
  </Tile>,
}

