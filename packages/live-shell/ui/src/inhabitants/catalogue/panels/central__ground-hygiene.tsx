// Ground hygiene (manual §18.12): the ground as readings — the seats of each workcell, the worktrees of the project, its branches —
// and three tenders that clear what no work needs. Live's nearest: Utility, a small effect whose meaning is plain at a glance, with
// the Scope pattern for a change that asks first (Tend: Off, Propose, Write). The picture is the ground itself: one ring for each
// reading, one tick for each thing read, a dot beside a tick that has a finding. The readings are the real `seat status` of env-1 to
// env-3 and the real worktrees and branches of O-I. The owner's classification is inhabitants/centralHygieneModel.ts; this panel
// applies the same kinds. Where the model differs from the seat instrument, this panel follows the instrument: a seat has landed
// when its tree is clean and nothing stands ahead of main.
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type RowItem} from '../../sdk/panel'
import {KindMark} from '../../sdk/marks'
import {clampTo, on, str, type DesignedDevice, type ViewProps} from './design'
import './central__ground-hygiene.css'

type V = ViewProps['v']
type Ring = 'seats' | 'worktrees' | 'branches'
type Kind = 'seat-claimed' | 'seat-drift' | 'seat-floor-breach' | 'foreign-lane' | 'occupied-by-landed' | 'stray-branch' | 'worktree-outside-register'
type TenderId = 'release' | 'prune' | 'sweep'

// ------------------------------------------------------------------------------------------------ the ground that was read

const SEAT_OP = 'seat status (Control/user/workcell/seat)', TREE_OP = 'git worktree list --porcelain', BRANCH_OP = 'git for-each-ref refs/heads'
const KERNEL_OPS = ['op workcell_status_read', 'op git_repository_read (project O-I)'] as const

interface Seat {
  readonly id: string; readonly env: string; readonly product: string; readonly state: 'free' | 'claimed' | 'occupied-foreign-lane'
  readonly branch?: string; readonly head: string; readonly by?: string; readonly dirty?: number; readonly untracked?: number; readonly ahead?: number
  readonly drift?: readonly [string, string, string, string]; readonly floor?: string
}
const LEAD = 'claude-code:dlw-lead', CONDUCTOR = 'claude-code:dlw-conductor'
const seat = (env: string, product: string, head: string, more: Partial<Seat> = {}): Seat => ({id: `${env}/${product}`, env, product, state: 'free', head, ...more})
const SEATS: readonly Seat[] = [
  seat('env-1', 'actuation', '933731e', {state: 'claimed', branch: 'fold/day-close-20261012', by: CONDUCTOR, dirty: 0, untracked: 0, ahead: 3, drift: ['fold/day-close-20261012', '7b4af99', 'fold/day-close-20261012', '933731e']}),
  seat('env-1', 'ai-kit', 'c2e1be91', {state: 'claimed', branch: 'speed/root-register-stays-warm', by: LEAD, dirty: 0, untracked: 0, ahead: 1, floor: '18.0 GB free < soft 20 GB', drift: ['speed/root-register-stays-warm', '7af8d11d', 'speed/root-register-stays-warm', 'c2e1be91']}),
  seat('env-1', 'central', '8aa1065', {state: 'claimed', branch: 'fix/day-close-no-t-payloads', by: CONDUCTOR, dirty: 0, untracked: 0, ahead: 1, drift: ['fold/day-close-20261012', 'cf58c54', 'fix/day-close-no-t-payloads', '8aa1065']}),
  seat('env-1', 'factory', '6b1b7ff'),
  seat('env-1', 'o-i', '9b6caea90', {state: 'claimed', branch: 'dlw/build', by: LEAD, dirty: 30, untracked: 15, ahead: 197, drift: ['dlw/phase1-semantics-20261013', 'cc69e19fa', 'dlw/build', '9b6caea90']}),
  seat('env-1', 'ql-mef', '37e3085'), seat('env-1', 'workcell', '59f94a3'), seat('env-1', 'point-cloud-demo', 'e9c7ccb'),
  seat('env-2', 'actuation', 'cd1f4ce'), seat('env-2', 'ai-kit', '01987475'),
  seat('env-2', 'central', '352bc31', {state: 'claimed', branch: 'speed/source-horizon-writes-on-change', by: LEAD, dirty: 0, untracked: 0, ahead: 1, floor: '18.0 GB free < soft 20 GB', drift: ['speed/source-horizon-writes-on-change', '4a3e423', 'speed/source-horizon-writes-on-change', '352bc31']}),
  seat('env-2', 'factory', '96a7fef'),
  seat('env-2', 'o-i', '2de90416e', {state: 'claimed', branch: 'dlw/native-build', by: LEAD, dirty: 0, untracked: 1, ahead: 171, drift: ['dlw/native-build', '2491a11b6', 'dlw/native-build', '2de90416e']}),
  seat('env-2', 'ql-mef', '73097be', {floor: '17.4 GB free < soft 20 GB'}), seat('env-2', 'workcell', '1023071', {floor: '18.2 GB free < soft 20 GB'}), seat('env-2', 'point-cloud-demo', 'e9c7ccb'),
  seat('env-3', 'actuation', 'cd1f4ce', {floor: '15.3 GB free < soft 20 GB'}), seat('env-3', 'ai-kit', '01987475', {floor: '10.7 GB free < soft 20 GB'}),
  seat('env-3', 'central', 'cf58c54', {floor: '9.3 GB free < soft 20 GB'}), seat('env-3', 'factory', '96a7fef'), seat('env-3', 'o-i', '65202d830'),
  seat('env-3', 'ql-mef', '36f9eb0'), seat('env-3', 'workcell', 'a716cd3'), seat('env-3', 'point-cloud-demo', 'e9c7ccb'),
]
const WORKCELLS: readonly {name: string; free: string}[] = [{name: 'env-1', free: '44.6 GB'}, {name: 'env-2', free: '44.6 GB'}, {name: 'env-3', free: '44.6 GB'}]

interface Tree {readonly path: string; readonly branch: string | null; readonly head: string; readonly seat?: string}
const TREES: readonly Tree[] = [
  {path: '/Users/admin/Central/Work/O-I', branch: 'main', head: '1cc77db12', seat: 'primary'},
  {path: '/Users/admin/Central/worktrees/env-1/o-i', branch: 'dlw/build', head: '9b6caea90', seat: 'env-1/o-i'},
  {path: '/Users/admin/Central/worktrees/env-2/o-i', branch: 'dlw/native-build', head: '2de90416e', seat: 'env-2/o-i'},
  {path: '/Users/admin/Central/worktrees/env-3/o-i', branch: null, head: '65202d830', seat: 'env-3/o-i'},
]

/** The 71 branches of O-I in the order Git lists them: S a lane-named branch no checkout holds, H a branch a checkout holds. */
const BRANCH_MAP = 'SSS..H.H.....' + 'S'.repeat(17) + '.'.repeat(15) + 'H' + '.'.repeat(25)
const STRAYS: readonly {name: string; head: string; merged: boolean}[] = [
  {name: 'agent/o-i-20261007-0824', head: '9a7de2d82', merged: true}, {name: 'agent/o-i-20261007-1639', head: '7fbde446e', merged: false},
  {name: 'agent/o-i-20261008-1823', head: '1fb4986c6', merged: false}, {name: 'feat/281-played-instrument-in-app', head: '78cb79abc', merged: true},
  {name: 'feat/central-field-base', head: '963383814', merged: false}, {name: 'feat/epi-findings-complete-20261007', head: '9f692aa9d', merged: false},
  {name: 'feat/epi-findings-reconciled-20261007', head: 'c6262deb5', merged: false}, {name: 'feat/epi-findings-reconciliation-20261007', head: '487cba91c', merged: false},
  {name: 'feat/epi-stage4-presentation-20261006', head: 'fea6d2ae2', merged: false}, {name: 'feat/epi-stage4-replay-20261006', head: '75b702d8b', merged: false},
  {name: 'feat/epi-world-s1-20261005', head: '73b50363c', merged: false}, {name: 'feat/epi-world-s2-20261005', head: '4e53c2288', merged: false},
  {name: 'feat/epi-world-s3-20261006', head: '284bfc0d9', merged: false}, {name: 'feat/live-re-lane-15min-workload', head: 'b2bb210ab', merged: false},
  {name: 'feat/nara-identity-expression-20260927', head: 'f3d45dc35', merged: false}, {name: 'feat/owner-requests-inbox-20260929', head: 'b8fd8aace', merged: false},
  {name: 'feat/personal-history-user-20261006', head: '54373ab54', merged: true}, {name: 'feat/plural-flow-20260930', head: '0bcad4092', merged: false},
  {name: 'feat/shared-expression-20260930', head: '0a184d8c2', merged: false}, {name: 'feat/stage-op-relay-20261006', head: 'e36e63a10', merged: false},
]

// ------------------------------------------------------------------------------------------------ the settings

const TEND = [{value: 'off', label: 'Off', does: 'The device only reads. No tender is offered.'}, {value: 'propose', label: 'Propose', does: 'Each tender waits for your confirm.'},
  {value: 'write', label: 'Write', does: 'An allowed tender runs when you press it, and returns a receipt.'}] as const
const REFRESH = [{value: 'manual', label: 'Manual', does: 'Read again only when you press Read now.'}, {value: 'open', label: 'On open', does: 'Read again when the device opens.'},
  {value: '5min', label: '5 min', does: 'Read again every 5 minutes.'}] as const
const READS = ['seats', 'worktrees', 'branches'] as const
const TENDERS: Record<TenderId, {label: string; allow: string; op: string}> = {
  release: {label: 'Release seat', allow: 'allow:release', op: 'seat release <workcell> <product>: refresh the seat to origin/main and clear the claim.'},
  prune: {label: 'Prune worktree', allow: 'allow:prune', op: 'git worktree remove: remove the checkout that no seat names.'},
  sweep: {label: 'Sweep branch', allow: 'allow:sweep', op: 'git branch -d: delete the branch, which Git allows only when it is merged.'},
}
const KIND_NAME: Record<Kind, string> = {
  'seat-claimed': 'Seat claimed', 'seat-drift': 'Seat drift', 'seat-floor-breach': 'Disk below floor', 'foreign-lane': 'Foreign lane',
  'occupied-by-landed': 'Seat on a landed branch', 'stray-branch': 'Stray branch', 'worktree-outside-register': 'Worktree outside the register',
}
const KIND_SHORT: Record<Kind, string> = {
  'seat-claimed': 'claimed', 'seat-drift': 'drift', 'seat-floor-breach': 'disk', 'foreign-lane': 'foreign', 'occupied-by-landed': 'landed', 'stray-branch': 'stray', 'worktree-outside-register': 'outside',
}
const MODES = ['off', 'propose', 'write']

const tend = (v: V) => str(v, 'tend')
/** A value the fixture may leave out: empty when absent (`str` would say "undefined"). */
const opt = (v: V, key: string) => (v[key] === undefined ? '' : String(v[key]))
const lookCount = (v: V) => READS.filter(r => on(v, `look:${r}`)).length
const lookMode = (v: V) => (lookCount(v) === 3 ? 'all' : lookCount(v) === 0 ? 'none' : lookCount(v) === 1 ? READS.find(r => on(v, `look:${r}`))! : 'two')
const light = (v: V): LightState => (str(v, 'workcell') === 'answered' ? 'lit' : 'unknown')
const machineRef = (v: V) => (str(v, 'machine') === 'this' ? 'workcell:mac' : `workcell:${str(v, 'machine')}`)

// ------------------------------------------------------------------------------------------------ the findings

interface Finding {
  readonly id: string; readonly ring: Ring; readonly at: number; readonly kind: Kind; readonly fault: boolean; readonly subject: string
  readonly standing: string; readonly op: string; readonly tender?: TenderId; readonly head?: string; readonly merged?: boolean
}
type Reading = 'read' | 'off' | 'none'

/** Everything the panel draws, derived from the values: what each ring read, its things, and the findings (the owner's kinds). */
function ground(v: V) {
  const machine = str(v, 'machine') === 'this' && v.noRead !== true
  const reading = Object.fromEntries(READS.map(r => [r, !machine ? 'none' : on(v, `look:${r}`) ? 'read' : 'off'])) as Record<Ring, Reading>
  const foreign = opt(v, 'foreign'), extraTree = opt(v, 'tree'), extraBranch = opt(v, 'treeBranch') || null
  const seats = SEATS.map(s => (foreign && s.id === 'env-3/o-i' ? {...s, state: 'occupied-foreign-lane' as const, branch: foreign, head: '963383814'} : s))
    .map(s => ({...s, ahead: typeof v[`ahead:${s.id}`] === 'number' ? Number(v[`ahead:${s.id}`]) : s.ahead}))
  const trees: Tree[] = [...TREES, ...(extraTree ? [{path: extraTree, branch: extraBranch, head: '7fbde446e'}] : [])]
  const held = new Set<string>([...seats.map(s => s.branch), ...trees.map(t => t.branch)].filter((b): b is string => !!b))
  const done = (id: string) => v[`done:${id}`] !== undefined
  const all: Finding[] = []
  const push = (f: Finding) => { if (!done(f.id)) all.push(f) }
  if (reading.seats === 'read') {
    seats.forEach((s, at) => {
      if (s.state === 'claimed') push({id: `claimed:${s.id}`, ring: 'seats', at, kind: 'seat-claimed', fault: false, subject: s.id, op: SEAT_OP,
        standing: `claimed by ${s.by} on ${s.branch} · ${s.dirty} dirty, ${s.untracked} untracked`})
    })
    seats.forEach((s, at) => {
      if (s.drift) push({id: `drift:${s.id}`, ring: 'seats', at, kind: 'seat-drift', fault: true, subject: s.id, op: SEAT_OP,
        standing: `register pose ('${s.drift[0]}', '${s.drift[1]}') != live ('${s.drift[2]}', '${s.drift[3]}')`})
      if (s.floor) push({id: `floor:${s.id}`, ring: 'seats', at, kind: 'seat-floor-breach', fault: true, subject: s.id, op: SEAT_OP, standing: `floor breach recorded: ${s.floor}`})
      if (s.state === 'occupied-foreign-lane') push({id: `foreign:${s.id}`, ring: 'seats', at, kind: 'foreign-lane', fault: true, subject: s.id, op: SEAT_OP,
        standing: `owner-held unmerged lane (${s.branch}) occupies the seat; join and curation refuse — the owner retires it`})
      if (s.state === 'claimed' && s.dirty === 0 && s.untracked === 0 && s.ahead === 0) push({id: `landed:${s.id}`, ring: 'seats', at, kind: 'occupied-by-landed', fault: true,
        subject: s.id, op: SEAT_OP, tender: 'release', standing: `seat claims ${s.branch} with a clean tree and nothing ahead of main — the lane landed; release the seat`})
    })
  }
  if (reading.branches === 'read') {
    let k = 0
    BRANCH_MAP.split('').forEach((c, at) => {
      if (c !== 'S') return
      const b = STRAYS[k++]!
      if (held.has(b.name)) return
      push({id: `stray:${b.name}`, ring: 'branches', at, kind: 'stray-branch', fault: true, subject: b.name, op: BRANCH_OP, tender: 'sweep', head: b.head, merged: b.merged,
        standing: `lane-named branch with no register claim and no seat holding it (${b.head})${b.merged ? ', merged into main' : ', with commits that main does not hold'}`})
    })
  }
  if (reading.worktrees === 'read') {
    trees.forEach((t, at) => {
      if (!t.seat) push({id: `tree:${t.path}`, ring: 'worktrees', at, kind: 'worktree-outside-register', fault: true, subject: t.path, op: TREE_OP, tender: 'prune',
        standing: `checked out at ${t.branch ?? `detached ${t.head}`} outside every registered seat`})
    })
  }
  const shown = on(v, 'faults') ? all.filter(f => f.fault) : all
  const count = (ring: Ring) => ({read: ring === 'seats' ? seats.length : ring === 'worktrees' ? trees.length : BRANCH_MAP.length, flagged: shown.filter(f => f.ring === ring).length})
  return {reading, seats, trees, held, all, shown, faults: all.filter(f => f.fault), anyRead: READS.some(r => reading[r] === 'read'), count}
}
type Ground = ReturnType<typeof ground>

/** Whether a tender can run now, and if not, why. */
function tenderState(v: V, f: Finding): {ok: boolean; why?: string} {
  if (!f.tender) return {ok: false}
  if (tend(v) === 'off') return {ok: false, why: 'Tend is Off. Set Tend to Propose or Write.'}
  if (!on(v, TENDERS[f.tender].allow)) return {ok: false, why: `${TENDERS[f.tender].label} is not allowed. Turn it on in the pool.`}
  if (f.tender === 'sweep' && !f.merged) return {ok: false, why: 'This branch holds unmerged work. Leave it to its lane.'}
  return {ok: true}
}
const stamp = () => new Date().toTimeString().slice(0, 5)
function receiptOf(f: Finding): string {
  const t = f.tender!
  return `${t === 'release' ? `Seat ${f.subject} released: refreshed to origin/main, claim cleared.` : t === 'prune' ? `Removed the checkout ${f.subject}.` : `Deleted branch ${f.subject} (was ${f.head}).`} ${stamp()}`
}
function press(p: ViewProps, f: Finding) {
  if (tend(p.v) === 'propose') { p.set('ask', f.id); return }
  commit(p, f)
}
function commit(p: ViewProps, f: Finding) {
  p.set(`done:${f.id}`, true); p.set('ask', undefined); p.set('sel', undefined)
  p.set('receipt', receiptOf(f)); p.set('receipts', Number(p.v.receipts ?? 0) + 1)
}

// ------------------------------------------------------------------------------------------------ the picture

const RING_R: Record<Ring, number> = {branches: 1, seats: .7, worktrees: .4}
const polar = (cx: number, cy: number, r: number, i: number, n: number) => {
  const a = -Math.PI / 2 + 2 * Math.PI * (i + .5) / n
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
}
const LEVER = [-40, 0, 40]

/** Three rings, branches outside, seats between, worktrees inside. A tick for each thing read; a dot beside a tick that has a
 * finding (orange a fault, teal a claimed seat); an amber ring on the dot where a tender fits. Handle 1 sets Tend. */
function Rings({v, set, w, h, legend, small}: {v: V; set?: ViewProps['set']; w: number; h: number; legend?: boolean; small?: boolean}) {
  const g = ground(v), mode = tend(v)
  const cx = small ? w / 2 : 70, cy = small ? h / 2 : 66, R = small ? w / 2 - 9 : 44, t = small ? 1.6 : 2.4, off = small ? 4 : 6.5
  const tick = (ring: Ring, i: number): 'seat' | 'held' | 'foreign' | 'idle' => {
    if (ring === 'seats') { const s = g.seats[i]!; return s.state === 'claimed' ? 'seat' : s.state === 'free' ? 'idle' : 'foreign' }
    if (ring === 'worktrees') return 'held'
    return BRANCH_MAP[i] === 'H' || (BRANCH_MAP[i] === 'S' && g.held.has(STRAYS[BRANCH_MAP.slice(0, i).split('S').length - 1]!.name)) ? 'held' : 'idle'
  }
  const marks = (ring: Ring) => {
    if (g.reading[ring] !== 'read') return null
    const n = g.count(ring).read, r = R * RING_R[ring]
    const lines: Record<string, string> = {seat: '', held: '', foreign: '', idle: ''}
    for (let i = 0; i < n; i++) {
      const [x1, y1] = polar(cx, cy, r - t, i, n), [x2, y2] = polar(cx, cy, r + t, i, n)
      lines[tick(ring, i)] += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`
    }
    const flagged = new Map<number, Finding[]>()
    g.shown.filter(f => f.ring === ring).forEach(f => flagged.set(f.at, [...(flagged.get(f.at) ?? []), f]))
    return <g key={ring}>
      <path d={lines.idle} stroke="var(--text-faint)" strokeWidth={small ? .8 : 1} opacity={.7} fill="none" />
      <path d={lines.held} stroke="var(--dp-value)" strokeWidth={small ? .9 : 1.3} fill="none" />
      <path d={lines.seat} stroke="var(--dp-value)" strokeWidth={small ? 1 : 1.5} fill="none" />
      <path d={lines.foreign} stroke="var(--stall)" strokeWidth={small ? 1 : 1.5} fill="none" />
      {[...flagged].map(([i, fs]) => {
        const [x, y] = polar(cx, cy, r + off, i, n), fault = fs.some(f => f.fault), fits = mode !== 'off' && fs.some(f => tenderState(v, f).ok)
        return <g key={i}>
          <circle cx={x} cy={y} r={ring === 'branches' ? t * .8 : t} fill={fault ? 'var(--stall)' : 'var(--dp-value)'} />
          {fits && !small && <circle cx={x} cy={y} r={t + 2.2} fill={mode === 'write' ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'none'} stroke="var(--accent)" strokeWidth={1} />}
        </g>
      })}
    </g>
  }
  const names: Record<Ring, string> = {branches: 'branches', seats: 'seats', worktrees: 'worktrees'}
  const modeAt = MODES.indexOf(mode)
  return <g>
    {(['branches', 'seats', 'worktrees'] as Ring[]).map(ring => <g key={ring}>
      <circle cx={cx} cy={cy} r={R * RING_R[ring]} className="dp-faint" strokeDasharray={g.reading[ring] === 'read' ? undefined : '2 3'} opacity={g.reading[ring] === 'read' ? 1 : .6} />
      {marks(ring)}
    </g>)}
    {!g.anyRead && <text x={cx} y={cy + 3} className="dp-axis" textAnchor="middle">no reading</text>}
    {legend && (['branches', 'seats', 'worktrees'] as Ring[]).map((ring, i) => {
      const c = g.count(ring), y = 24 + i * 40
      return <g key={ring}>
        <text x={134} y={y} className="dp-axis">{names[ring]}</text>
        <text x={134} y={y + 12} className="dp-ink">{g.reading[ring] === 'read' ? `${c.read} read` : g.reading[ring] === 'off' ? 'Off' : 'no reading'}</text>
        {g.reading[ring] === 'read' && <text x={134} y={y + 23} className="dp-ink-dim">{c.flagged} flagged</text>}
      </g>
    })}
    {!small && <g>
      <path d={`M${cx + LEVER[0]!} 137H${cx + LEVER[2]!}`} className="dp-faint" />
      {LEVER.map((dx, i) => <g key={i}>
        <circle cx={cx + dx} cy={137} r={1.8} fill="var(--text-faint)" />
        <text x={cx + dx} y={129} className="dp-axis" textAnchor="middle">{MODES[i]}</text>
      </g>)}
      <Handle n={1} x={cx + LEVER[modeAt]!} y={137} label="Tend" does="Drag along the line: Off, Propose or Write. Propose waits for your confirm."
        onDrag={set && (x => set('tend', MODES[Math.round(clampTo(0, 2, (x - cx + 40) / 40))]!))} onReset={set && (() => set('tend', 'propose'))} />
    </g>}
  </g>
}

const cornerOf = (g: Ground, v: V) => (!g.anyRead ? '—' : `${g.shown.length} ${on(v, 'faults') ? 'faults' : 'findings'}`)

// ------------------------------------------------------------------------------------------------ the controls

function LookAt({p}: {p: ViewProps}) {
  const mode = lookMode(p.v)
  const options = [{value: 'all', label: 'All', does: 'Read seats, worktrees and branches.'}, {value: 'seats', label: 'Seats', does: 'Read the seats only.'},
    {value: 'worktrees', label: 'Worktrees', does: 'Read the worktrees only.'}, {value: 'branches', label: 'Branches', does: 'Read the branches only.'},
    ...(mode === 'two' || mode === 'none' ? [{value: mode, label: mode === 'two' ? 'Two' : 'None', does: 'Set in the pool.'}] : [])]
  return <Chooser label="Look at" wide does="Which readings the device takes. It turns the three readings of the pool On or Off together." value={mode} options={options}
    onChange={x => { if (x === 'two' || x === 'none') return; READS.forEach(r => p.set(`look:${r}`, x === 'all' || x === r)) }} />
}
function RefreshChooser({p, label = 'Refresh'}: {p: ViewProps; label?: string}) {
  return <Chooser label={label} wide does="When the device reads again." value={str(p.v, 'refresh')} options={REFRESH} onChange={x => p.set('refresh', x)} />
}
function TendRadio({p}: {p: ViewProps}) {
  return <Radio label="Tend" does="Off: only read. Propose: a tender waits for your confirm. Write: a tender runs when you press it." value={tend(p.v)} options={TEND} stack onChange={x => p.set('tend', x)} />
}
function FaultsToggle({p, label}: {p: ViewProps; label: string}) {
  return <Toggle label={label} does="On: hide the findings that are not faults. A claimed seat is not a fault." on={on(p.v, 'faults')} onChange={x => p.set('faults', x)} />
}

const rowsOf = (g: Ground): RowItem[] => (!g.anyRead ? [{id: 'none', name: 'No reading', light: 'unknown'}]
  : g.shown.length === 0 ? [{id: 'clear', name: 'No findings', light: 'lit', tone: 'green'}]
  : g.shown.map((f): RowItem => ({id: f.id, name: f.subject.split('/').slice(-2).join('/'), light: 'lit', tone: f.fault ? 'stall' : 'value', note: KIND_SHORT[f.kind], does: `${KIND_NAME[f.kind]}: ${f.standing}`})))

// ------------------------------------------------------------------------------------------------ the pane

const COLUMNS: readonly {ring: Ring; title: string; mark: 'place' | 'source' | 'journey'}[] = [
  {ring: 'seats', title: 'Seats', mark: 'place'}, {ring: 'worktrees', title: 'Worktrees', mark: 'source'}, {ring: 'branches', title: 'Branches', mark: 'journey'},
]
const PAGE = 10
const lastName = (f: Finding) => (f.ring === 'worktrees' ? f.subject.replace('/Users/admin/Central/', '') : f.subject)

function Pane({p}: {p: ViewProps}) {
  const g = ground(p.v), sel = g.shown.find(f => f.id === str(p.v, 'sel'))
  const sources = [...KERNEL_OPS.map(op => ({op, refusal: op.includes('git_repository') && opt(p.v, 'gitRefusal') || null})),
    ...(p.v.noRead === true ? [] : [SEAT_OP, TREE_OP, BRANCH_OP].map(op => ({op, refusal: null as string | null})))]
  return <div className="ref-pane-body hy-pane">
    <div className="hy-top">
      <h3>Ground hygiene<small>{machineRef(p.v)} · {g.anyRead ? `${g.shown.length} ${on(p.v, 'faults') ? 'faults' : 'findings'}` : 'no reading'}</small></h3>
      <span className="hy-disk">disk free {WORKCELLS.map(w => `${w.name} ${w.free}`).join(' · ')}</span>
      <ul className="hy-sources">
        {sources.map(s => <li key={s.op} className="hy-source" data-refused={s.refusal ? 'true' : undefined}>
          <span className="dp-lamp" data-light={s.refusal ? 'dark' : 'lit'} data-tone={s.refusal ? 'stall' : 'green'} /><code>{s.op}</code><em>{s.refusal ?? 'answered'}</em>
        </li>)}
      </ul>
    </div>
    <div className="hy-cols">
      {COLUMNS.map(c => {
        const all = g.shown.filter(f => f.ring === c.ring), pages = Math.max(1, Math.ceil(all.length / PAGE)), at = Math.min(Number(p.v[`page:${c.ring}`] ?? 0), pages - 1)
        const rows = all.slice(at * PAGE, at * PAGE + PAGE)
        return <section key={c.ring} className="hy-col" aria-label={c.title}>
          <h4><KindMark kind={c.mark} size={14} />{c.title}<b data-i="Flagged of read|The things with a finding, of the things the device read.">{g.reading[c.ring] === 'read' ? `${all.length} of ${g.count(c.ring).read}` : g.reading[c.ring] === 'off' ? 'Off' : '—'}</b>
            {pages > 1 && <span className="hy-pager">
              <button type="button" aria-label="Previous page" disabled={at === 0} onClick={() => p.set(`page:${c.ring}`, at - 1)}>‹</button>
              <span>{at + 1}/{pages}</span>
              <button type="button" aria-label="Next page" disabled={at === pages - 1} onClick={() => p.set(`page:${c.ring}`, at + 1)}>›</button>
            </span>}
          </h4>
          {g.reading[c.ring] !== 'read'
            ? <p className="hy-none">{g.reading[c.ring] === 'off' ? `Look at has ${c.title} Off.` : p.v.noRead === true ? 'No reading. This place has no machine read.' : `No reading from ${machineRef(p.v)}.`}</p>
            : all.length === 0 ? <p className="hy-none">No findings.</p>
            : <ul className="hy-list">
              {rows.map(f => <li key={f.id}><button type="button" className="hy-row" aria-pressed={sel?.id === f.id} onClick={() => p.set('sel', f.id)}
                data-i={`${KIND_NAME[f.kind]}|${f.standing}`}>
                <span className="hy-dot" data-fault={f.fault} data-tender={tenderState(p.v, f).ok ? 'true' : undefined} /><b>{lastName(f)}</b><i>{KIND_SHORT[f.kind]}</i>
              </button></li>)}
            </ul>}
        </section>
      })}
    </div>
    <div className="hy-detail">
      {sel ? <>
        <div>
          <h5>{KIND_NAME[sel.kind]}<small>{lastName(sel)}</small></h5>
          <p>{sel.standing}</p>
          <p className="hy-rests">Rests on <code>{sel.op}</code></p>
        </div>
        <Tender p={p} f={sel} />
      </> : <>
        <div>
          <h5>Select a row</h5>
          <p>Read what a finding rests on and which tender fits. A finding is a reading, not a verdict.</p>
        </div>
        <div className="hy-tend">{p.v.receipt ? <small className="hy-receipt">Receipt {String(p.v.receipts)}: {str(p.v, 'receipt')}</small> : <small>No tender has run.</small>}</div>
      </>}
    </div>
  </div>
}

function Tender({p, f}: {p: ViewProps; f: Finding}) {
  if (!f.tender) return <div className="hy-tend"><small>{f.kind === 'foreign-lane' ? 'Unmerged work of another lane. The decision is yours.' : 'No tender fits this finding.'}</small></div>
  const st = tenderState(p.v, f), asking = str(p.v, 'ask') === f.id
  return <div className="hy-tend">
    {asking
      ? <>
        <small>{TENDERS[f.tender].op}</small>
        <Action label="Confirm" does={`Run: ${TENDERS[f.tender].label}.`} onPress={() => commit(p, f)} />
        <Action label="Cancel" does="Keep the ground as it is." onPress={() => p.set('ask', undefined)} />
      </>
      : <>
        <Action label={TENDERS[f.tender].label} does={TENDERS[f.tender].op} onPress={() => press(p, f)} disabled={st.ok ? undefined : st.why ?? 'No tender runs here.'} />
        <small>{st.ok ? (tend(p.v) === 'propose' ? 'Tend is Propose: you confirm first.' : 'Tend is Write: it runs when you press it.') : st.why}</small>
      </>}
  </div>
}

// ------------------------------------------------------------------------------------------------ the device

export const design: DesignedDevice = {
  id: 'central:ground-hygiene',
  title: 'Ground hygiene',
  kind: 'effect',
  defaults: {
    workcell: 'answered', machine: 'this', 'look:seats': true, 'look:worktrees': true, 'look:branches': true, faults: true, refresh: 'open', tend: 'propose',
    'allow:release': true, 'allow:prune': true, 'allow:sweep': true, readAge: 12,
  },
  fixtures: {
    'After a merge': {'ahead:env-1/central': 0},
    'A foreign lane': {foreign: 'feat/central-field-base', tree: '/private/tmp/o-i-lane', treeBranch: 'agent/o-i-20261007-1639'},
    'No machine read': {noRead: true, gitRefusal: 'the git repository reading did not answer'},
  },

  folded: p => {
    const g = ground(p.v)
    return <Folded title="Ground hygiene" light={light(p.v)} readings={[g.anyRead ? `${g.shown.length} ${on(p.v, 'faults') ? 'faults' : 'findings'}` : '—']} onUnfold={p.nav.unfold} />
  },

  compact: p => {
    const g = ground(p.v)
    return <Panel title="Ground hygiene" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="The ground" does="Rings of branches, seats and worktrees. A dot marks a thing with a finding. Drag handle 1 to set Tend." corner={cornerOf(g, p.v)}>
          <Rings v={p.v} set={p.set} w={140} h={146} />
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
    const g = ground(p.v), locked = tend(p.v) === 'off' ? 'Tend is Off.' : undefined
    return <Panel title="Ground hygiene" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="The ground" does="Rings of branches, seats and worktrees, with the count of each. A dot marks a thing with a finding. Drag handle 1 to set Tend." corner={cornerOf(g, p.v)}>
            <Rings v={p.v} set={p.set} w={194} h={146} legend />
          </Display>
        </Section>
        <Section label="Look" width={104}>
          {READS.map(r => <Toggle key={r} label={r[0]!.toUpperCase() + r.slice(1)} does={`Read the ${r}. Off leaves its ring empty.`} on={on(p.v, `look:${r}`)} onChange={x => p.set(`look:${r}`, x)} />)}
          <Chooser label="Machine" wide does="Whose ground the device reads. Link lists the other machines." value={str(p.v, 'machine')}
            options={[{value: 'this', label: 'This machine'}, {value: 'omarchy', label: 'omarchy', does: 'The linked machine workcell:omarchy.'}]} onChange={x => p.set('machine', x)} />
          <RefreshChooser p={p} />
        </Section>
        <Section label="Show" grow>
          <FaultsToggle p={p} label="Faults only" />
          <Action label="Read now" does="Read every source once." onPress={() => p.set('readAge', 0)} />
          <Readout big label="findings" does="The findings that the device shows now." value={g.anyRead ? g.shown.length : undefined} tone={g.shown.length ? 'accent' : 'green'} />
          <Readout label="read" does="When the device last read its sources." value={Number(p.v.readAge) === 0 ? 'now' : `${Number(p.v.readAge)} s ago`} />
        </Section>
      </Band>
      <Band>
        <Section label="Tend" width={108}>
          <TendRadio p={p} />
          {(Object.keys(TENDERS) as TenderId[]).map(t => <Toggle key={t} label={TENDERS[t].label} does={`Allow the device to offer ${TENDERS[t].label}.`} disabled={locked}
            on={on(p.v, TENDERS[t].allow)} onChange={x => p.set(TENDERS[t].allow, x)} />)}
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
    return <Tile title="Ground hygiene" light={light(p.v)} span={2} onFull={p.nav.full}>
      <Display w={76} h={76} label="The ground" does="Rings of branches, seats and worktrees. A dot marks a thing with a finding.">
        <Rings v={p.v} w={76} h={76} small />
      </Display>
      <div className="hy-tile-side">
        <Readout big label={on(p.v, 'faults') ? 'faults' : 'findings'} does="The findings that the device shows now." value={g.anyRead ? g.shown.length : undefined} tone={g.shown.length ? 'accent' : 'green'} />
        <div className="hy-tile-list" onClick={p.nav.full}><Rows does="The first three findings. Click one to open the list in a pane." items={first} size={3} /></div>
      </div>
    </Tile>
  },
}
