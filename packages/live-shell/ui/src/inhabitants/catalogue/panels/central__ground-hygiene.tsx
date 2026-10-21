// Ground hygiene (manual §18.5): the ground as readings — the seats of each workcell, the worktrees of the project, its branches —
// and three tenders that clear what no work needs. Live's nearest: Utility, a small effect whose meaning is plain at a glance, with
// the Scope pattern for a change that asks first (Tend: Off, Propose, Write). The picture is the ground itself: one ring for each
// reading, one tick for each thing read, a dot beside a tick that has a finding. The owner's classification is
// inhabitants/centralHygieneModel.ts: the device draws the findings the owner reports (its kinds) and classifies nothing itself.
//
// Everything the device draws is a value key (the shapes are the model's own, JSON strings):
//   seats      SeatReading[]       the seat instrument's rows (`seat status`): workcell, product, state, branch, head, claimedBy, dirty,
//                                  untracked, ahead, drift, admissionNote
//   worktrees  WorktreeRow[]       `git worktree list --porcelain`: path, branch, head, detached, main
//   branches   BranchRow[]         `git for-each-ref refs/heads`: name, head, checkedOutAt; `merged` (boolean) when the owner says so
//   findings   HygieneFinding[]    the owner's classification: kind, subject, standing, boundaryOps, tenderId
//   sources    BoundaryOpSource[]  each read with its operation, and its refusal in the owner's words when it refused
//   machines   {id, label, ref, does?}[]   the machines the device can read; `machine` is the one chosen, `machineRef` the one the
//                                  readings stand on
//   disk       {workcell, freeGb}[]  free disk of each workcell
//   light      'lit' | 'dark'      the owners answered or refused; hollow when the owner reports none
//   readAge    seconds since the sources were read       receipt / receipts   the last tender's receipt and the count
// Settings: machine, look:seats, look:worktrees, look:branches, faults, refresh, tend, allow:release, allow:prune, allow:sweep.
// Held by the hand (no reading): sel (the open finding), ask (a tender waiting for Confirm), page:<ring> (the list's page).
// Acts, each on its own key: reread (Read now), and the tenders release / prune / sweep (the value is the finding's subject: the
// seat `env-1/central`, the worktree path, the branch name). Confirm, under Propose, sets the tender's own key.
// A key the owner does not report is absent. The picture then says which reading is missing, and every control and reading draws "—".
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type RowItem, type Standing} from '../../sdk/panel'
import {KindMark} from '../../sdk/marks'
import {assembleCensus, hygieneFindings, registeredSeatPaths, type BoundaryOpSource, type SeatReading, type WorktreeRow} from '../../centralHygieneModel'
import {NONE, boolOf, clampTo, json, numOf, st, strOf, type DesignedDevice, type Values, type ViewProps} from './design'
import './central__ground-hygiene.css'

type V = ViewProps['v']
type Ring = 'seats' | 'worktrees' | 'branches'
type TenderId = 'release' | 'prune' | 'sweep'
type Reading = 'read' | 'off' | 'none'
type Mode = 'off' | 'propose' | 'write'

// ------------------------------------------------------------------------------------------------ the vocabulary

const READS: readonly Ring[] = ['seats', 'worktrees', 'branches']
/** The rings from the outside in: the order they are drawn and named. */
const OUTSIDE_IN: readonly Ring[] = ['branches', 'seats', 'worktrees']
const MODES: readonly Mode[] = ['off', 'propose', 'write']
const TEND = [{value: 'off', label: 'Off', does: 'The device only reads. No tender is offered.'}, {value: 'propose', label: 'Propose', does: 'Each tender waits for your confirm.'},
  {value: 'write', label: 'Write', does: 'An allowed tender runs when you press it, and returns a receipt.'}] as const
const REFRESH = [{value: 'manual', label: 'Manual', does: 'Read again only when you press Read now.'}, {value: 'open', label: 'On open', does: 'Read again when the device opens.'},
  {value: '5min', label: '5 min', does: 'Read again every 5 minutes.'}] as const
const TENDERS: Record<TenderId, {label: string; allow: string; op: string}> = {
  release: {label: 'Release seat', allow: 'allow:release', op: 'seat release <workcell> <product>: refresh the seat to origin/main and clear the claim.'},
  prune: {label: 'Prune worktree', allow: 'allow:prune', op: 'git worktree remove: remove the checkout that no seat names.'},
  sweep: {label: 'Sweep branch', allow: 'allow:sweep', op: 'git branch -d: delete the branch, which Git allows only when it is merged.'},
}
/** The tender ids of the owner's model (HYGIENE_TENDERS) and the key each acts on. */
const TENDER_OF: Record<string, TenderId> = {'release-seat': 'release', 'prune-worktree': 'prune', 'sweep-branch': 'sweep'}
/** The kinds of the owner's model (HygieneFindingKind), by the ring each stands on. */
const RING_OF: Record<string, Ring> = {
  'seat-claimed': 'seats', 'seat-drift': 'seats', 'seat-floor-breach': 'seats', 'checkout-missing': 'seats', 'foreign-lane': 'seats', 'occupied-by-landed': 'seats',
  'stray-branch': 'branches', 'worktree-outside-register': 'worktrees',
}
const KIND_NAME: Record<string, string> = {
  'seat-claimed': 'Seat claimed', 'seat-drift': 'Seat drift', 'seat-floor-breach': 'Disk below floor', 'checkout-missing': 'Checkout missing', 'foreign-lane': 'Foreign lane',
  'occupied-by-landed': 'Seat on a landed branch', 'stray-branch': 'Stray branch', 'worktree-outside-register': 'Worktree outside the register',
}
const KIND_SHORT: Record<string, string> = {
  'seat-claimed': 'claimed', 'seat-drift': 'drift', 'seat-floor-breach': 'disk', 'checkout-missing': 'missing', 'foreign-lane': 'foreign', 'occupied-by-landed': 'landed',
  'stray-branch': 'stray', 'worktree-outside-register': 'outside',
}
/** Which of a finding's operations its ring was read from (a finding cites every source; the ring names its own). */
const RING_OP: Record<Ring, RegExp> = {seats: /seat status/, worktrees: /worktree/, branches: /for-each-ref|branch/}

const tendOf = (v: V): Mode | undefined => { const m = strOf(v, 'tend'); return m === 'off' || m === 'propose' || m === 'write' ? m : undefined }
const light = (p: ViewProps): LightState => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState

// ------------------------------------------------------------------------------------------------ the ground that was read

interface Machine {readonly id: string; readonly label?: string; readonly ref?: string; readonly does?: string}
interface Branch {readonly name: string; readonly head?: string | null; readonly checkedOutAt?: string | null; readonly merged?: boolean}
interface Reported {readonly kind: string; readonly subject: string; readonly standing?: string; readonly boundaryOps?: unknown; readonly tenderId?: unknown}
interface Finding {
  readonly id: string; readonly ring: Ring; readonly at: number | undefined; readonly kind: string; readonly fault: boolean; readonly subject: string
  readonly standing: string; readonly ops: readonly string[]; readonly tender: TenderId | undefined; readonly merged: boolean | undefined
}

const text = (x: unknown): x is string => typeof x === 'string' && x.length > 0
/** A JSON list the owner reported, or undefined when the key is absent or holds no list. A row without its identity is left out. */
function listOf<T>(v: V, key: string, keep: (row: Record<string, unknown>) => boolean): T[] | undefined {
  const rows = json<unknown>(v, key, undefined)
  if (!Array.isArray(rows)) return undefined
  return rows.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && keep(row as Record<string, unknown>)) as unknown as T[]
}

/** Everything the panel draws, read from the values: what each ring read, its things, and the owner's findings. A ring with no
 * list, or read from another machine than the one chosen, has no reading; a finding of a kind this device does not know, whose
 * subject no ring holds, is not drawn. */
function readGround(v: V) {
  const seats = listOf<SeatReading>(v, 'seats', r => text(r.workcell) && text(r.product))
  const trees = listOf<WorktreeRow>(v, 'worktrees', r => text(r.path))
  const branches = listOf<Branch>(v, 'branches', r => text(r.name))
  const reported = listOf<Reported>(v, 'findings', r => text(r.kind) && text(r.subject))
  const machines = listOf<Machine>(v, 'machines', r => text(r.id))
  const chosen = machines?.find(m => m.id === strOf(v, 'machine'))
  const standsOn = strOf(v, 'machineRef')
  const elsewhere = !!chosen?.ref && standsOn !== undefined && chosen.ref !== standsOn
  const present: Record<Ring, boolean> = {seats: !!seats, worktrees: !!trees, branches: !!branches}
  const reading = Object.fromEntries(READS.map(r => [r, boolOf(v, `look:${r}`) === false ? 'off' : elsewhere || !present[r] ? 'none' : 'read'])) as Record<Ring, Reading>
  const index: Record<Ring, Map<string, number>> = {
    seats: new Map<string, number>((seats ?? []).map((s, i): [string, number] => [`${s.workcell}/${s.product}`, i])),
    worktrees: new Map<string, number>((trees ?? []).map((t, i): [string, number] => [t.path, i])),
    branches: new Map<string, number>((branches ?? []).map((b, i): [string, number] => [b.name, i])),
  }
  const all: Finding[] = []
  for (const f of reported ?? []) {
    const ring = RING_OF[f.kind] ?? READS.find(r => index[r].has(f.subject))
    if (!ring) continue
    const at = index[ring].get(f.subject), branch = ring === 'branches' && at !== undefined ? branches?.[at] : undefined
    all.push({id: `${f.kind}:${f.subject}`, ring, at, kind: f.kind, fault: f.kind !== 'seat-claimed', subject: f.subject, standing: text(f.standing) ? f.standing : NONE,
      ops: Array.isArray(f.boundaryOps) ? f.boundaryOps.filter(text) : [], tender: text(f.tenderId) ? TENDER_OF[f.tenderId] : undefined,
      merged: typeof branch?.merged === 'boolean' ? branch.merged : undefined})
  }
  const faultsOnly = boolOf(v, 'faults') === true
  const shown = all.filter(f => reading[f.ring] === 'read' && (!faultsOnly || f.fault))
  const counts = (ring: Ring) => ({read: (ring === 'seats' ? seats : ring === 'worktrees' ? trees : branches)?.length ?? 0, flagged: shown.filter(f => f.ring === ring).length})
  return {
    reading, seats, trees, branches, machines, chosen, standsOn, elsewhere, found: reported !== undefined, shown, faultsOnly, noun: faultsOnly ? 'faults' : 'findings',
    anyRead: READS.some(r => reading[r] === 'read'), count: {seats: counts('seats'), worktrees: counts('worktrees'), branches: counts('branches')},
  }
}
type Ground = ReturnType<typeof readGround>
const GROUNDS = new WeakMap<V, Ground>()
function ground(v: V): Ground {
  let g = GROUNDS.get(v)
  if (!g) { g = readGround(v); GROUNDS.set(v, g) }
  return g
}

/** The machine the readings are about: the one chosen, else the one they stand on. */
const refOf = (g: Ground) => g.chosen?.ref ?? g.standsOn ?? NONE
const cornerOf = (g: Ground) => (g.anyRead && g.found ? `${g.shown.length} ${g.noun}` : NONE)
/** What stops a ring from drawing, in words. */
const missing = (g: Ground, ring: Ring) => (g.reading[ring] === 'off' ? `Look at has ${ring[0]!.toUpperCase() + ring.slice(1)} Off.`
  : g.elsewhere ? `No reading from ${refOf(g)}.` : `No reading of the ${ring}.`)

/** Whether a tender can run now, and if not, why. The host's standing for the tender's key comes last. */
function tenderState(p: ViewProps, f: Finding): {ok: boolean; why?: string} {
  if (!f.tender) return {ok: false}
  const t = TENDERS[f.tender], mode = tendOf(p.v), allowed = boolOf(p.v, t.allow)
  if (mode === undefined) return {ok: false, why: 'Tend has no reading.'}
  if (mode === 'off') return {ok: false, why: 'Tend is Off. Set Tend to Propose or Write.'}
  if (allowed === undefined) return {ok: false, why: `Whether ${t.label} is allowed has no reading.`}
  if (!allowed) return {ok: false, why: `${t.label} is not allowed. Turn it on in the pool.`}
  if (f.tender === 'sweep' && f.merged === false) return {ok: false, why: 'This branch holds unmerged work. Leave it to its lane.'}
  const held = st(p, f.tender).disabled
  return held ? {ok: false, why: held} : {ok: true}
}
/** A tender asks first under Propose, and acts at once under Write. */
function press(p: ViewProps, f: Finding) {
  if (!f.tender) return
  if (tendOf(p.v) === 'propose') p.set('ask', f.id)
  else p.set(f.tender, f.subject)
}
function confirm(p: ViewProps, f: Finding) {
  if (!f.tender) return
  p.set(f.tender, f.subject)
  p.set('ask', undefined)
}
/** One control for several keys (Look at): the first key's standing wins where more than one has any. */
const stOfAll = (p: ViewProps, keys: readonly string[]): Standing => Object.assign({}, ...keys.map(k => st(p, k)).reverse()) as Standing

// ------------------------------------------------------------------------------------------------ the picture

const RING_R: Record<Ring, number> = {branches: 1, seats: .7, worktrees: .4}
const polar = (cx: number, cy: number, r: number, i: number, n: number) => {
  const a = -Math.PI / 2 + 2 * Math.PI * (i + .5) / n
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
}
const LEVER = [-40, 0, 40]

/** Three rings, branches outside, seats between, worktrees inside. A tick for each thing read; a dot beside a tick that has a
 * finding (orange a fault, teal a claimed seat); an amber ring on the dot where a tender fits. Handle 1 sets Tend. */
function Rings({p, w, h, legend, small, live}: {p: ViewProps; w: number; h: number; legend?: boolean; small?: boolean; live?: boolean}) {
  const g = ground(p.v), mode = tendOf(p.v), tendStanding = st(p, 'tend')
  const cx = small ? w / 2 : 70, cy = small ? h / 2 : 66, R = small ? w / 2 - 9 : 44, t = small ? 1.6 : 2.4, off = small ? 4 : 6.5
  const tick = (ring: Ring, i: number): 'seat' | 'held' | 'foreign' | 'idle' => {
    if (ring === 'seats') { const s = g.seats?.[i]; return s?.state === 'claimed' ? 'seat' : s?.state === 'free' ? 'idle' : 'foreign' }
    if (ring === 'worktrees') return 'held'
    return g.branches?.[i]?.checkedOutAt ? 'held' : 'idle'
  }
  const marks = (ring: Ring) => {
    if (g.reading[ring] !== 'read') return null
    const n = g.count[ring].read, r = R * RING_R[ring]
    const lines: Record<string, string> = {seat: '', held: '', foreign: '', idle: ''}
    for (let i = 0; i < n; i++) {
      const [x1, y1] = polar(cx, cy, r - t, i, n), [x2, y2] = polar(cx, cy, r + t, i, n), k = tick(ring, i)
      lines[k] = `${lines[k] ?? ''}M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`
    }
    const flagged = new Map<number, Finding[]>()
    g.shown.filter(f => f.ring === ring && f.at !== undefined).forEach(f => flagged.set(f.at!, [...(flagged.get(f.at!) ?? []), f]))
    return <g key={ring}>
      <path d={lines.idle} stroke="var(--text-faint)" strokeWidth={small ? .8 : 1} opacity={.7} fill="none" />
      <path d={lines.held} stroke="var(--dp-value)" strokeWidth={small ? .9 : 1.3} fill="none" />
      <path d={lines.seat} stroke="var(--dp-value)" strokeWidth={small ? 1 : 1.5} fill="none" />
      <path d={lines.foreign} stroke="var(--stall)" strokeWidth={small ? 1 : 1.5} fill="none" />
      {[...flagged].map(([i, fs]) => {
        const [x, y] = polar(cx, cy, r + off, i, n), fault = fs.some(f => f.fault), fits = fs.some(f => tenderState(p, f).ok)
        return <g key={i}>
          <circle cx={x} cy={y} r={ring === 'branches' ? t * .8 : t} fill={fault ? 'var(--stall)' : 'var(--dp-value)'} />
          {fits && !small && <circle cx={x} cy={y} r={t + 2.2} fill={mode === 'write' ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'none'} stroke="var(--accent)" strokeWidth={1} />}
        </g>
      })}
    </g>
  }
  const modeAt = mode === undefined ? -1 : MODES.indexOf(mode)
  const drag = live && !tendStanding.disabled ? (x: number) => p.set('tend', MODES[Math.round(clampTo(0, 2, (x - cx + 40) / 40))]!) : undefined
  return <g>
    {OUTSIDE_IN.map(ring => <g key={ring}>
      <circle cx={cx} cy={cy} r={R * RING_R[ring]} className="dp-faint" strokeDasharray={g.reading[ring] === 'read' ? undefined : '2 3'} opacity={g.reading[ring] === 'read' ? 1 : .6} />
      {marks(ring)}
    </g>)}
    {!g.anyRead && <text x={cx} y={cy + 3} className="dp-axis" textAnchor="middle">no reading</text>}
    {legend && OUTSIDE_IN.map((ring, i) => {
      const c = g.count[ring], y = 24 + i * 40
      return <g key={ring}>
        <text x={134} y={y} className="dp-axis">{ring}</text>
        <text x={134} y={y + 12} className="dp-ink">{g.reading[ring] === 'read' ? `${c.read} read` : g.reading[ring] === 'off' ? 'Off' : 'no reading'}</text>
        {g.reading[ring] === 'read' && <text x={134} y={y + 23} className="dp-ink-dim">{g.found ? c.flagged : NONE} flagged</text>}
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

// ------------------------------------------------------------------------------------------------ the controls

/** Which of the three readings are on, as one choice: empty while any of them is unreported. */
function lookMode(v: V): string {
  const on = READS.map(r => boolOf(v, `look:${r}`))
  if (on.some(x => x === undefined)) return ''
  const n = on.filter(Boolean).length
  return n === 3 ? 'all' : n === 0 ? 'none' : n === 1 ? READS[on.indexOf(true)]! : 'two'
}
function LookAt({p}: {p: ViewProps}) {
  const mode = lookMode(p.v)
  const options = [{value: 'all', label: 'All', does: 'Read seats, worktrees and branches.'}, {value: 'seats', label: 'Seats', does: 'Read the seats only.'},
    {value: 'worktrees', label: 'Worktrees', does: 'Read the worktrees only.'}, {value: 'branches', label: 'Branches', does: 'Read the branches only.'},
    ...(mode === 'two' || mode === 'none' ? [{value: mode, label: mode === 'two' ? 'Two' : 'None', does: 'Set in the pool.'}] : [])]
  return <Chooser {...stOfAll(p, READS.map(r => `look:${r}`))} label="Look at" wide does="Which readings the device takes. It turns the three readings of the pool On or Off together." value={mode} options={options}
    onChange={x => { if (x === 'two' || x === 'none') return; READS.forEach(r => p.set(`look:${r}`, x === 'all' || x === r)) }} />
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

const rowsOf = (g: Ground): RowItem[] => (!g.anyRead ? [{id: 'none', name: 'No reading', light: 'unknown'}]
  : !g.found ? [{id: 'none', name: 'No reading of the findings', light: 'unknown'}]
  : g.shown.length === 0 ? [{id: 'clear', name: 'No findings', light: 'lit', tone: 'green'}]
  : g.shown.map((f): RowItem => ({id: f.id, name: f.subject.split('/').slice(-2).join('/'), light: 'lit', tone: f.fault ? 'stall' : 'value', note: KIND_SHORT[f.kind] ?? f.kind,
    does: `${KIND_NAME[f.kind] ?? f.kind}: ${f.standing}`})))

// ------------------------------------------------------------------------------------------------ the pane

const COLUMNS: readonly {ring: Ring; title: string; mark: 'place' | 'source' | 'journey'}[] = [
  {ring: 'seats', title: 'Seats', mark: 'place'}, {ring: 'worktrees', title: 'Worktrees', mark: 'source'}, {ring: 'branches', title: 'Branches', mark: 'journey'},
]
const PAGE = 10
const lastName = (f: Finding) => (f.ring === 'worktrees' ? f.subject.replace(/^\/Users\/[^/]+\/Central\//, '') : f.subject)
/** Free disk of each workcell, in the owner's order: those of the machine the readings stand on. */
function diskOf(v: V, g: Ground): string {
  if (g.elsewhere) return NONE
  const rows = listOf<{workcell: string; freeGb?: unknown}>(v, 'disk', r => text(r.workcell))
  if (!rows?.length) return NONE
  return rows.map(r => `${r.workcell} ${typeof r.freeGb === 'number' && Number.isFinite(r.freeGb) ? `${r.freeGb.toFixed(1)} GB` : NONE}`).join(' · ')
}

function Pane({p}: {p: ViewProps}) {
  const g = ground(p.v), sel = g.shown.find(f => f.id === strOf(p.v, 'sel'))
  const sources = listOf<BoundaryOpSource>(p.v, 'sources', r => text(r.boundaryOp))
  return <div className="ref-pane-body hy-pane">
    <div className="hy-top">
      <h3>Ground hygiene<small>{refOf(g)} · {g.anyRead && g.found ? `${g.shown.length} ${g.noun}` : 'no reading'}</small></h3>
      <span className="hy-disk">disk free {diskOf(p.v, g)}</span>
      <ul className="hy-sources">
        {sources === undefined
          ? <li className="hy-source"><em>No reading of the sources.</em></li>
          : sources.map(s => <li key={s.boundaryOp} className="hy-source" data-refused={s.refusal ? 'true' : undefined}>
            <span className="dp-lamp" data-light={s.refusal ? 'dark' : 'lit'} data-tone={s.refusal ? 'stall' : 'green'} /><code>{s.boundaryOp}</code><em>{s.refusal ?? 'answered'}</em>
          </li>)}
      </ul>
    </div>
    <div className="hy-cols">
      {COLUMNS.map(c => {
        const all = g.shown.filter(f => f.ring === c.ring), pages = Math.max(1, Math.ceil(all.length / PAGE)), at = Math.min(numOf(p.v, `page:${c.ring}`) ?? 0, pages - 1)
        const rows = all.slice(at * PAGE, at * PAGE + PAGE)
        return <section key={c.ring} className="hy-col" aria-label={c.title}>
          <h4><KindMark kind={c.mark} size={14} />{c.title}<b data-i="Flagged of read|The things with a finding, of the things the device read.">{g.reading[c.ring] === 'read' ? `${g.found ? all.length : NONE} of ${g.count[c.ring].read}` : g.reading[c.ring] === 'off' ? 'Off' : NONE}</b>
            {pages > 1 && <span className="hy-pager">
              <button type="button" aria-label="Previous page" disabled={at === 0} onClick={() => p.set(`page:${c.ring}`, at - 1)}>‹</button>
              <span>{at + 1}/{pages}</span>
              <button type="button" aria-label="Next page" disabled={at === pages - 1} onClick={() => p.set(`page:${c.ring}`, at + 1)}>›</button>
            </span>}
          </h4>
          {g.reading[c.ring] !== 'read'
            ? <p className="hy-none">{missing(g, c.ring)}</p>
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
  const own = f.ops.filter(op => RING_OP[f.ring].test(op))
  return (own.length ? own : f.ops).join(' · ') || NONE
}

function Tender({p, f}: {p: ViewProps; f: Finding}) {
  if (!f.tender) return <div className="hy-tend"><small>{f.kind === 'foreign-lane' ? 'Unmerged work of another lane. The decision is yours.' : 'No tender fits this finding.'}</small></div>
  const can = tenderState(p, f), asking = strOf(p.v, 'ask') === f.id, stand = st(p, f.tender), t = TENDERS[f.tender]
  return <div className="hy-tend">
    {asking
      ? <>
        <small>{t.op}</small>
        <Action {...stand} hold label="Confirm" does={`Run: ${t.label}.`} onPress={() => confirm(p, f)} disabled={can.ok ? undefined : can.why ?? 'No tender runs here.'} />
        <Action label="Cancel" does="Keep the ground as it is." onPress={() => p.set('ask', undefined)} />
      </>
      : <>
        <Action {...stand} label={t.label} does={t.op} onPress={() => press(p, f)} disabled={can.ok ? undefined : can.why ?? 'No tender runs here.'} />
        <small>{can.ok ? (tendOf(p.v) === 'propose' ? 'Tend is Propose: you confirm first.' : 'Tend is Write: it runs when you press it.') : can.why}</small>
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

const DEFAULTS: Values = {
  light: 'lit', machine: 'this', machineRef: 'workcell:mac', 'look:seats': true, 'look:worktrees': true, 'look:branches': true, faults: true, refresh: 'open', tend: 'propose',
  'allow:release': true, 'allow:prune': true, 'allow:sweep': true, readAge: 12,
  machines: dump([{id: 'this', label: 'This machine', ref: 'workcell:mac'}, {id: 'omarchy', label: 'omarchy', ref: 'workcell:omarchy', does: 'The linked machine workcell:omarchy.'}]),
  disk: dump([{workcell: 'env-1', freeGb: 44.6}, {workcell: 'env-2', freeGb: 44.6}, {workcell: 'env-3', freeGb: 44.6}]),
  ...sample(),
}

// ------------------------------------------------------------------------------------------------ the device

export const design: DesignedDevice = {
  id: 'central:ground-hygiene',
  title: 'Ground hygiene',
  kind: 'effect',
  defaults: DEFAULTS,
  fixtures: {
    'After a merge': sample({merged: true}),
    'A foreign lane': sample({foreign: true}),
    'No machine read': {seats: undefined, worktrees: undefined, branches: undefined, findings: undefined, disk: undefined,
      sources: dump([KERNEL_WORKCELL, {...KERNEL_GIT, refusal: 'the git repository reading did not answer'}])},
    'No readings': Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, undefined])),
  },

  folded: p => <Folded title="Ground hygiene" light={light(p)} readings={[cornerOf(ground(p.v))]} onUnfold={p.nav.unfold} />,

  compact: p => {
    const g = ground(p.v)
    return <Panel title="Ground hygiene" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="The ground" does="Rings of branches, seats and worktrees. A dot marks a thing with a finding. Drag handle 1 to set Tend." corner={cornerOf(g)}>
          <Rings p={p} w={140} h={146} live />
        </Display>
      </Section>
      <Section label="Macros" cols={3}>
        <div className="hy-span2"><LookAt p={p} /></div>
        <FaultsToggle p={p} label="Faults" />
        <div className="hy-span2"><RefreshChooser p={p} /></div>
        <TendRadio p={p} />
      </Section>
    </Panel>
  },

  whole: p => {
    const g = ground(p.v), locked = tendOf(p.v) === 'off' ? 'Tend is Off.' : undefined, read = numOf(p.v, 'readAge')
    return <Panel title="Ground hygiene" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="The ground" does="Rings of branches, seats and worktrees, with the count of each. A dot marks a thing with a finding. Drag handle 1 to set Tend." corner={cornerOf(g)}>
            <Rings p={p} w={194} h={146} legend live />
          </Display>
        </Section>
        <Section label="Look" width={104}>
          {READS.map(r => {
            const now = boolOf(p.v, `look:${r}`)
            return <Toggle {...st(p, `look:${r}`)} key={r} label={r[0]!.toUpperCase() + r.slice(1)} does={`Read the ${r}. Off leaves its ring empty.`}
              on={now === true} unknown={now === undefined} onChange={x => p.set(`look:${r}`, x)} />
          })}
          <Chooser {...st(p, 'machine')} label="Machine" wide does="Whose ground the device reads. Link lists the other machines." value={strOf(p.v, 'machine') ?? ''}
            options={(g.machines ?? []).map(m => ({value: m.id, label: m.label ?? m.id, does: m.does}))} onChange={x => p.set('machine', x)} />
          <RefreshChooser p={p} />
        </Section>
        <Section label="Show" grow>
          <FaultsToggle p={p} label="Faults only" />
          <Action {...st(p, 'reread')} label="Read now" does="Read every source once." onPress={() => p.set('reread', true)} />
          <Readout big label="findings" does="The findings that the device shows now." value={g.anyRead && g.found ? g.shown.length : undefined} tone={g.shown.length ? 'accent' : 'green'} />
          <Readout label="read" does="When the device last read its sources." value={read === undefined ? undefined : read === 0 ? 'now' : `${read} s ago`} />
        </Section>
      </Band>
      <Band>
        <Section label="Tend" width={108}>
          <TendRadio p={p} />
          {(Object.keys(TENDERS) as TenderId[]).map(t => {
            const now = boolOf(p.v, TENDERS[t].allow), held = st(p, TENDERS[t].allow)
            return <Toggle {...held} key={t} label={TENDERS[t].label} does={`Allow the device to offer ${TENDERS[t].label}.`} disabled={locked ?? held.disabled}
              on={now === true} unknown={now === undefined} onChange={x => p.set(TENDERS[t].allow, x)} />
          })}
        </Section>
        <Section label="Findings" grow>
          <Rows does="The first findings, with their kind. Orange is a fault. Teal is a claimed seat." items={rowsOf(g)} size={8} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <Pane p={p} />,

  widget: p => {
    const g = ground(p.v), first = rowsOf(g).slice(0, 3)
    return <Tile title="Ground hygiene" light={light(p)} span={2} onFull={p.nav.full}>
      <Display w={76} h={76} label="The ground" does="Rings of branches, seats and worktrees. A dot marks a thing with a finding.">
        <Rings p={p} w={76} h={76} small />
      </Display>
      <div className="hy-tile-side">
        <Readout big label={g.noun} does="The findings that the device shows now." value={g.anyRead && g.found ? g.shown.length : undefined} tone={g.shown.length ? 'accent' : 'green'} />
        <div className="hy-tile-list" onClick={p.nav.full}><Rows does="The first three findings. Click one to open the list in a pane." items={first} size={3} /></div>
      </div>
    </Tile>
  },
}
