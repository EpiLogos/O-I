// Git / landing (manual §19.16): the landing device, last on a workcell's chain — where the work of every agent in the workcell lands as git. Live's nearest:
// Utility, a small effect whose meaning is plain at a glance. The picture is the branch: main along the bottom, the branch leaving it, one
// dot for each commit it holds that main does not, a pulsing hollow dot for work that has no commit, and — drawn from Land as — where
// Land will take it. Handle 1 sets Land as.
//
// Whole is one view: every parameter of the device, in three groups — Seat (the seat of the track's workcell and who holds it, Lane, the
// branch, the files with no commit, Release), Cadence (Commit, Push) and Landing (Land as, the checks, the changes, Land). The seat's
// values stand under `seat.`: a binding hosts them by prefixing the seat instrument's binding (`seat status`, `seat release`). Every seat
// of the machines, with its claim, its co-workers and what to tend, is the Seats page of Workcell's instrument (workcell__workcell.tsx),
// which reads the seats with this file's readers.
//
// Everything the device draws is a value key. The readings (the seat's, through `seat status` and `git_repository_read`; the changes,
// through `git_diff_read`) are reported by the owners:
//   light           'lit' | 'dark'    the seat and the repository answered; hollow when the owner reports none
//   branch          string            the seat's branch (`head_branch`; `live_branch` of `seat status`)
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
// The seat (`seat.` keys; the shapes follow SeatReading in centralHygieneModel.ts):
//   seat.seats   SeatRow[]   workcell, product, state (free | claimed | occupied-foreign-lane), branch, head, claimedBy, dirty, untracked,
//                            ahead, behind, drift, zones [{actor, regions, since}], workers (the agents attached to the lane)
//   seat.actor   the session's own actor ref, to tell Yours from another agent's
//   seat.product, seat.seat   the seat the track's workcell holds for its project (the binding starts them there; the Seat reads them)
// Settings: seat.joinAs (Lane: attach | new-lane). Act: seat.release (Release).
// A key the owner does not report is absent. The picture then says which reading is missing, and every control and reading draws "—".
import {Action, Band, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem, type Standing, type Tone, unreadRows} from '../../sdk/panel'
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

const landAsOf = (v: V): LandAs | undefined => { const x = strOf(v, 'landAs'); return x === 'draft' || x === 'mr' || x === 'merge' ? x : undefined }
const commitOf = (v: V): CommitPolicy | undefined => { const x = strOf(v, 'commit-policy'); return x ? POLICY_OF[x] : undefined }
const pushOf = (v: V): boolean | undefined => { const x = strOf(v, 'push-policy'); return x === 'on land' ? true : x === 'off' ? false : undefined }
const light = (p: ViewProps): LightState => { const s = strOf(p.owner ?? p.v, 'light'); return s === 'lit' || s === 'dark' ? s : 'unknown' }
/** The tail of a name that does not fit: the end of a branch is what tells branches apart. */
export const tail = (s: string | undefined, n: number) => (s === undefined ? NONE : s.length > n ? `…${s.slice(-(n - 1))}` : s)

// ------------------------------------------------------------------------------------------------ the readings

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
  if (!checks) return unreadRows('No reading of the checks.')
  return checks.map((c): RowItem => ({id: c.name, name: c.name, light: c.state === 'running' ? 'unknown' : 'lit', tone: c.state === 'failed' ? 'stall' : 'green',
    does: `${c.name}: ${c.state}. The remote reports it.`}))
}

// ================================================================================================ the seat (`seat.` keys)

/** What the seat says when the workcell's own reading names no seat: the seats are Workcell's (its seat instrument's rows), never
 * names this panel keeps. */
export const NO_SEATS = 'This workcell reports no seat: Workcell\'s seat reading names none on this machine.'
export const NO_SEAT_READING = 'No reading of the seats.'
export const STATE_WORD: Record<string, string> = {free: 'free', claimed: 'held', 'occupied-foreign-lane': 'foreign'}
const LANE: readonly Option<string>[] = [{value: 'attach', label: 'Attach', does: 'Attach to the lane: work beside the agents on the lane the seat holds, as co-workers.'},
  {value: 'new-lane', label: 'New lane', does: 'Start a new lane: a new branch from main replaces the standing lane; the old branch stays in Git. It never replaces uncommitted work.'}]

interface Zone {readonly actor: string; readonly regions: readonly string[]; readonly since: number | null}
export interface SeatRow {
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
/** Everything the seat draws: the seats, the chosen seat among them, and whether the session's own actor holds it. */
function readSeats(v: V) {
  const rows = readRows(v), product = strOf(v, 'product'), seat = strOf(v, 'seat'), actor = strOf(v, 'actor')
  const envs = rows ? [...new Set(rows.map(r => r.workcell))].sort() : []
  const products = rows ? [...new Set(rows.map(r => r.product))] : []
  const row = rows?.find(r => r.workcell === seat && r.product === product)
  const mine = !!row && !!actor && (row.claimedBy === actor || !!row.workers?.includes(actor) || row.zones.some(z => z.actor === actor))
  return {rows, product, seat, actor, envs, products, row, mine}
}
export type Seats = ReturnType<typeof readSeats>
const SEATS = new WeakMap<V, Seats>()
/** The seats of a `seat.`-scoped value set, read once per set (Workcell's Seats page reads them with this too). */
export function seats(v: V): Seats {
  let g = SEATS.get(v)
  if (!g) { g = readSeats(v); SEATS.set(v, g) }
  return g
}
export const short = (actor: string | null | undefined) => (actor ? actor.split(':').pop() || actor : NONE)
export const filesOf = (r: SeatRow | undefined): number | undefined => (r && (r.dirty !== null || r.untracked !== null) ? (r.dirty ?? 0) + (r.untracked ?? 0) : undefined)

/** The claim in a word: Free, Yours, or Another agent's (a lane of another agent, or an owner-held lane). Undefined without a reading. */
export function claimWord(g: Seats): string | undefined {
  const s = g.row?.state
  if (s === 'free') return 'Free'
  if (s === 'occupied-foreign-lane') return 'Another\'s'
  if (s === 'claimed') return g.mine ? 'Yours' : 'Another\'s'
  return undefined
}
export const claimTone = (g: Seats): Tone | undefined => {
  const s = g.row?.state
  return s === 'free' ? 'green' : s === 'occupied-foreign-lane' || (s === 'claimed' && !g.mine) ? 'stall' : s === 'claimed' ? 'accent' : undefined
}
const FOREIGN = (r: SeatRow) => `Another lane's unmerged work (${r.branch ?? 'no branch'}) holds this seat. The decision is yours.`
const joinOf = (v: V) => (strOf(v, 'joinAs') === 'new-lane' ? 'new-lane' : strOf(v, 'joinAs') === 'attach' ? 'attach' : undefined)
/** Why the seat has no row to act on, or undefined. */
const noRow = (g: Seats): string | undefined => (g.row ? undefined : !g.rows ? NO_SEAT_READING : !g.seat || !g.product ? NO_SEATS : `${g.seat} has no ${g.product} seat.`)
/** Why Release cannot run now, or undefined. */
function releaseWhy(g: Seats): string | undefined {
  if (!g.row) return noRow(g)
  if (g.row.state === 'free') return 'This seat is free.'
  if (g.row.state === 'occupied-foreign-lane') return FOREIGN(g.row)
  const n = filesOf(g.row)
  if (n === undefined) return 'No reading of the uncommitted files.'
  if (n > 0) return `${n} files are uncommitted. Land them first, then release.`
  return undefined
}
/** The host's standing for a key, with a reason of this view's own when the host gives none. */
export const gate = (p: ViewProps, key: string, why?: string): Standing => { const s = st(p, key); return why && !s.disabled ? {...s, disabled: why} : s }

function SeatReading({p, shared}: {p: ViewProps; shared: boolean | undefined}) {
  const g = seats(p.v), r = g.row, claim = claimWord(g)
  return <div className="gs-ro gs-span"><Readout {...st(p, 'seat')} label="seat" value={r && claim ? `${r.workcell} · ${claim}` : undefined} tone={claimTone(g)}
    does={`The checkout where the agents work${r ? `, ${r.workcell}/${r.product}` : ''}, and who holds it: free, yours, or another agent's${r?.claimedBy ? ` (${r.claimedBy})` : ''}${shared ? '. A helper shares it with its lead' : ''}. Every seat is on Workcell's Seats page.`} /></div>
}
function LaneRadio({p}: {p: ViewProps}) {
  const g = seats(p.v)
  const why = noRow(g) ?? (g.row!.state === 'free' ? 'This seat is free: the first task starts a new lane from main.' : g.row!.state === 'occupied-foreign-lane' ? FOREIGN(g.row!) : undefined)
  return <Radio {...gate(p, 'joinAs', why)} label="Lane" stack does={`Attach: work beside the agents on the lane the seat holds${g.row?.branch ? ` (${g.row.branch})` : ''}, as co-workers. New lane: a new branch from main replaces the standing lane.`}
    value={g.row?.state === 'free' ? 'new-lane' : joinOf(p.v) ?? ''} options={LANE} onChange={x => p.set('joinAs', x)} />
}
function ReleaseAction({p}: {p: ViewProps}) {
  return <Action {...gate(p, 'release', releaseWhy(seats(p.v)))} hold label="Release" does="Returns the seat to main after the work has landed, and clears the claim." onPress={() => p.set('release', true)} />
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
  const shared = boolOf(v, 'shared'), seat = seats(seatOf(p).v).row
  return <div className="gs-pane">
    <header className="gs-top">
      <h3>Git / landing<small>{strOf(v, 'branch') ?? NONE} · {seat ? `${seat.workcell}/${seat.product}` : NONE}{shared === true ? ' · shared with lead' : ''}</small></h3>
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

/** The seat's sample: the real `seat status` of the o-i and actuation seats on 16 Oct, in the shape of SeatRow (Workcell's Seats page
 * reads on it too). */
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
export const SEAT_DEFAULTS = {actor: 'claude-code:dlw-conductor', product: 'actuation', seat: 'env-1', joinAs: 'attach', seats: dump(SEAT_SAMPLE)}

const DEFAULTS: Values = {
  light: 'lit', branch: 'fold/day-close-20261012', shared: false,
  uncommitted: 2, ahead: 3, behind: 0, added: 2497, removed: 411, files: 121,
  'commit-policy': 'per task', 'push-policy': 'off', landAs: 'draft',
  commits: dump(COMMITS), diff: dump(DIFF), checks: dump(CHECKS),
  ...prefixed('seat.', SEAT_DEFAULTS) as Values,
}
const seatOf = (p: ViewProps) => scoped(p, 'seat.')

// ------------------------------------------------------------------------------------------------ the device

export const design: DesignedDevice = {
  id: 'workcell:git-seat',
  title: 'Git / landing',
  kind: 'connection',
  defaults: DEFAULTS,
  fixtures: {
    'A lane in progress': {'push-policy': 'on land'},
    'A long lane': {
      branch: 'dlw/build', shared: true,
      uncommitted: 58, ahead: 242, behind: 0, added: 101783, removed: 30442, files: 893, checks: undefined,
      commits: dump([{sha: 'e01c76c11', subject: 'Designed device: Run, bindable (DLW device run)'}, {sha: '419d508c6', subject: 'Impact is bindable: subject, nodes, edges, references and sessions are value keys (retrofit)'},
        {sha: 'ea15033ad', subject: 'oi: per-call checks read the cached suite verification and hash in-process'}]),
      diff: dump([{path: 'desktop/cradle/docs/world-shell/targets.json', status: 'M', adds: 7603, dels: 1062}, {path: 'packages/live-shell/ui/tests/fixtures/atlas-suite-reading.json', status: 'A', adds: 1906, dels: 0},
        {path: 'desktop/cradle/kernel/src/graph.rs', status: 'M', adds: 1645, dels: 192}, {path: 'desktop/cradle/kernel/src/owner_read.rs', status: 'M', adds: 1239, dels: 29},
        {path: 'desktop/cradle/kernel/src/owner_write.rs', status: 'A', adds: 1016, dels: 0}, {path: 'desktop/cradle/docs/world-shell/wayfinder/tools/build_rehome.py', status: 'A', adds: 846, dels: 0}]),
      'seat.product': 'o-i',
    },
    'A free seat': {'seat.product': 'ql-mef', 'seat.seat': 'env-2'},
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
      <PushToggle p={p} />
      <div className="gs-tall"><LandAsRadio p={p} /></div>
      <LandAction p={p} />
    </Section>
  </Panel>,

  whole: p => {
    const v = p.v, checks = checksOf(v), uncommitted = numOf(v, 'uncommitted'), files = numOf(v, 'files'), branch = strOf(v, 'branch'), seat = seatOf(p)
    return <Panel title="Git / landing" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="The branch" does="Main along the bottom; each dot is a commit; a pulsing hollow dot is work with no commit. The dashed line is where Land takes the branch. Drag handle 1 to set Land as.">
            <Branch p={p} g={WHOLE} live />
          </Display>
        </Section>
        {/* 136: the room "uncommitted" needs over its reading (the kit's measure; panel.tsx nameWidth), which the kit cannot see through Reading */}
        <Section label="Seat" cols={2} width={136}>
          <SeatReading p={seat} shared={boolOf(v, 'shared')} />
          <div className="gs-tall"><LaneRadio p={seat} /></div>
          <Reading label="branch" does={`The branch the agents work on${branch ? `: ${branch}` : ''}. The seat reports it.`} value={branch === undefined ? undefined : tail(branch, 9)} />
          <Reading label="uncommitted" does="The files that have no commit." value={uncommitted === undefined ? undefined : `${uncommitted} ${uncommitted === 1 ? 'file' : 'files'}`} tone={uncommitted ? 'accent' : uncommitted === 0 ? 'green' : undefined} />
          <ReleaseAction p={seat} />
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
        <Section grow>
          <Rows label={checks ? `Checks · ${checkText(checks)}` : 'Checks'} does="The checks the remote runs on the branch. Green passed; hollow still runs; orange failed. The device does not make them up." items={checkRows(v)} empty="The remote runs no checks on the branch." size={7} />
        </Section>
      </Band>
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

