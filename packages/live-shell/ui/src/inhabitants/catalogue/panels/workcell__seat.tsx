// Seat (manual §19.20): the place a session works in. A seat is one checkout of one product in env-1, env-2 or env-3; a lane holds it,
// and several agents work in one lane. Live's nearest: Utility, a small effect whose meaning is plain at a glance, with the Scope
// pattern for an act that asks first. The picture is the product's three seats side by side: who holds each, what it carries
// uncommitted, how far its lane is ahead of main; under them, the disk gauge of the chosen workcell with the Floor on it.
// The owner is the seat instrument (`seat status --json`, `seat join`, `seat release`); the hygiene device reads the same rows.
//
// Everything the device draws is a value key (the shapes follow SeatReading in centralHygieneModel.ts, plus the zones):
//   seats     SeatRow[]   workcell, product, state (free | claimed | occupied-foreign-lane), branch, head, claimedBy, dirty (tracked
//                         changes), untracked, ahead, behind (against main), drift, admissionNote, zones [{actor, regions, since}],
//                         workers (the attached agents, when the owner lists them)
//   disk      DiskRow[]   workcell, freeGb, softGb (the register's floor), hardGb (null: the floor's own law, max(4, floor / 4))
//   actor     the session's own actor ref, to tell Yours from Held
// Settings: product, seat, lane, joinAs (attach | new-lane), zone, keepDirt, floor.
// Held by the hand (no reading): sel (the seat open in the pane), page:zones.
// Acts, each on its own key: join and release. The owner has no operation for them in the shell yet: the host stands them disabled
// with its reason, and the view adds the instrument's own refusals (a dirty seat, a foreign lane, the hard floor) in front of it.
// A key the owner does not report is absent. The picture then says which reading is missing, and every control draws "—".
import {Action, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Band, TextField, Tile, type LightState, type Option, type RowItem, type Standing} from '../../sdk/panel'
import {KindMark} from '../../sdk/marks'
import {NONE, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type Values, type ViewProps} from './design'
import './workcell__seat.css'

type V = ViewProps['v']

// ------------------------------------------------------------------------------------------------ the vocabulary

/** The names of the seats, drawn dashed when the owner reports none. */
const SEAT_NAMES: readonly string[] = ['env-1', 'env-2', 'env-3']
const STATE_WORD: Record<string, string> = {free: 'free', claimed: 'held', 'occupied-foreign-lane': 'foreign'}
const JOIN_AS: readonly Option<string>[] = [{value: 'attach', label: 'Attach', does: 'Work beside the agents on the standing lane.'},
  {value: 'new-lane', label: 'New lane', does: 'Start a different lane. It replaces the standing claim; the old branch stays in Git.'}]
const FLOOR = {min: 0, max: 100, step: 1}
const LIGHT_WHY = 'The light shows whether a lane holds the seat. Join and Release change it.'

// ------------------------------------------------------------------------------------------------ the seats that were read

interface Zone {readonly actor: string; readonly regions: readonly string[]; readonly since: number | null}
interface SeatRow {
  readonly workcell: string; readonly product: string; readonly state: string; readonly branch: string | null; readonly head: string | null
  readonly claimedBy: string | null; readonly dirty: number | null; readonly untracked: number | null; readonly ahead: number | null; readonly behind: number | null
  readonly drift: string | null; readonly admissionNote: string | null; readonly zones: readonly Zone[]; readonly workers?: readonly string[]
}
interface DiskRow {readonly workcell: string; readonly freeGb: number | null; readonly softGb: number | null; readonly hardGb: number | null}

const text = (x: unknown): x is string => typeof x === 'string' && x.length > 0
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
    drift: orNull(r.drift), admissionNote: orNull(r.admissionNote),
    zones: objects(r.zones).filter(z => text(z.actor)).map((z): Zone => ({actor: z.actor as string, regions: Array.isArray(z.regions) ? z.regions.filter(text) : [], since: count(z.since)})),
    workers: Array.isArray(r.workers) ? r.workers.filter(text) : undefined,
  }))
}
function readDisk(v: V): DiskRow[] | undefined {
  const raw = json<unknown>(v, 'disk', undefined)
  if (!Array.isArray(raw)) return undefined
  return objects(raw).filter(r => text(r.workcell)).map((r): DiskRow => ({workcell: r.workcell as string, freeGb: count(r.freeGb), softGb: count(r.softGb), hardGb: count(r.hardGb)}))
}

/** Everything the panel draws, read from the values: the seats, the chosen seat among them, the disk of its workcell, the floor. */
function readGround(v: V) {
  const rows = readRows(v), disk = readDisk(v)
  const product = strOf(v, 'product'), seat = strOf(v, 'seat'), actor = strOf(v, 'actor')
  const envs = rows ? [...new Set(rows.map(r => r.workcell))].sort() : []
  const products = rows ? [...new Set(rows.map(r => r.product))] : []
  const row = rows?.find(r => r.workcell === seat && r.product === product)
  const diskRow = disk?.find(d => d.workcell === seat)
  const floor = numOf(v, 'floor')
  const hard = diskRow?.hardGb ?? (floor === undefined ? undefined : Math.max(4, floor / 4))
  const mine = !!row && !!actor && (row.claimedBy === actor || !!row.workers?.includes(actor) || row.zones.some(z => z.actor === actor))
  return {rows, disk, product, seat, actor, envs, products, row, diskRow, floor, hard, free: diskRow?.freeGb ?? undefined, mine}
}
type Ground = ReturnType<typeof readGround>
const GROUNDS = new WeakMap<V, Ground>()
function ground(v: V): Ground {
  let g = GROUNDS.get(v)
  if (!g) { g = readGround(v); GROUNDS.set(v, g) }
  return g
}

const short = (actor: string | null | undefined) => (actor ? actor.split(':').pop() || actor : NONE)
const seatNo = (name: string) => name.replace(/^env-/, '')
const filesOf = (r: SeatRow | undefined): number | undefined => (r && (r.dirty !== null || r.untracked !== null) ? (r.dirty ?? 0) + (r.untracked ?? 0) : undefined)
const at = (r: SeatRow) => `${r.workcell}/${r.product}`

/** The claim in a word: Free, Yours, Held (another agent's lane), Foreign (an owner-held lane). Undefined without a reading. */
function claimWord(g: Ground): string | undefined {
  const s = g.row?.state
  if (s === 'free') return 'Free'
  if (s === 'occupied-foreign-lane') return 'Foreign'
  if (s === 'claimed') return g.mine ? 'Yours' : 'Held'
  return undefined
}
const cornerOf = (g: Ground) => (g.seat && claimWord(g) ? `${g.seat} · ${claimWord(g)!.toLowerCase()}` : NONE)

/** The activator: lit when a lane holds the chosen seat, dark when it is free. It reads the owner's rows, not the hand's choice. */
const lightOf = (p: ViewProps): LightState => {
  const rows = readRows(p.owner ?? p.v), seat = strOf(p.v, 'seat'), product = strOf(p.v, 'product')
  const row = rows?.find(r => r.workcell === seat && r.product === product)
  return !row ? 'unknown' : row.state === 'free' ? 'dark' : row.state === 'claimed' || row.state === 'occupied-foreign-lane' ? 'lit' : 'unknown'
}

// ------------------------------------------------------------------------------------------------ what each act can do now

const FOREIGN = (r: SeatRow) => `An owner-held lane (${r.branch ?? 'no branch'}) holds this seat. The owner retires it.`
const joinAs = (v: V) => (strOf(v, 'joinAs') === 'new-lane' ? 'new-lane' : strOf(v, 'joinAs') === 'attach' ? 'attach' : undefined)
/** Whether Join starts a new lane here: always on a free seat, and on a held seat when you choose New lane. */
const makesLane = (g: Ground, v: V) => g.row?.state === 'free' || (g.row?.state === 'claimed' && joinAs(v) === 'new-lane')
const hasStanding = (r: SeatRow | undefined) => (filesOf(r) ?? 0) > 0

/** Why Join cannot run now, in the instrument's own refusals, or undefined. */
function joinWhy(g: Ground, v: V): string | undefined {
  if (!g.rows) return 'No reading of the seats.'
  if (!g.seat || !g.product) return 'Choose a product and a seat.'
  if (!g.row) return `${g.seat} has no ${g.product} seat.`
  if (g.row.state === 'occupied-foreign-lane') return FOREIGN(g.row)
  if (g.row.state !== 'free' && g.row.state !== 'claimed') return 'The seat has no reading of its state.'
  if (g.free !== undefined && g.hard !== undefined && g.free < g.hard) return `${g.seat} has ${g.free.toFixed(1)} GB free, below the ${g.hard} GB hard floor.`
  if (makesLane(g, v) && (g.row.dirty ?? 0) > 0 && !(strOf(v, 'zone') || strOf(v, 'keepDirt'))) return `${g.row.dirty} files have changes in this seat. Set Zone or Keep dirt on first.`
  return undefined
}
/** Why Release cannot run now, or undefined. */
function releaseWhy(g: Ground): string | undefined {
  if (!g.rows) return 'No reading of the seats.'
  if (!g.row) return 'Choose a product and a seat.'
  if (g.row.state === 'free') return 'This seat is free.'
  if (g.row.state === 'occupied-foreign-lane') return FOREIGN(g.row)
  const n = filesOf(g.row)
  if (n === undefined) return 'No reading of the uncommitted files.'
  if (n > 0) return `${n} files are uncommitted. Land or save them, then release.`
  return undefined
}
/** The host's standing for a key, with a reason of this view's own when the host gives none. */
const gate = (p: ViewProps, key: string, why?: string): Standing => { const s = st(p, key); return why && !s.disabled ? {...s, disabled: why} : s }

// ------------------------------------------------------------------------------------------------ the picture

/** The three seats of the chosen product, side by side: a block for each, filled by who holds it (teal a lane, orange an owner-held
 * lane, hollow free); under it the uncommitted files and how the lane stands against main. Below: the disk of the chosen workcell
 * on a 0 to 100 GB track, free as a teal bar, the Floor as the amber square on it, and the hard floor as a tick. Handle 1 chooses
 * the seat along the row; handle 2 sets the Floor along the track. */
function Seats({p, w, live, gauge, mini}: {p: ViewProps; w: number; h: number; live?: boolean; gauge?: boolean; mini?: boolean}) {
  const g = ground(p.v)
  const names = g.envs.length ? g.envs : SEAT_NAMES
  const n = names.length, pad = 4, colW = (w - pad * 2) / n, colX = (i: number) => pad + i * colW + colW / 2
  const top = mini ? 14 : 27, bh = mini ? 36 : 34
  const seatHand = live && g.envs.length > 0 && !st(p, 'seat').disabled
  const pick = (x: number) => p.set('seat', names[clampTo(0, n - 1, Math.floor((x - pad) / colW))]!)
  const gx0 = 10, gx1 = w - 10, gx = (gb: number) => gx0 + clampTo(0, 100, gb) / 100 * (gx1 - gx0)
  const floorHand = live && g.floor !== undefined && !st(p, 'floor').disabled
  const setFloor = (x: number) => p.set('floor', Math.round(clampTo(0, 100, (x - gx0) / (gx1 - gx0) * 100)))
  return <g>
    {names.map((name, i) => {
      const row = g.rows?.find(r => r.workcell === name && r.product === g.product)
      const chosen = name === g.seat, cx = colX(i), x0 = cx - colW / 2 + 3, bw = colW - 6
      const held = row?.state === 'claimed', foreign = row?.state === 'occupied-foreign-lane'
      const colour = foreign ? 'var(--stall)' : 'var(--dp-value)'
      const files = filesOf(row), ahead = row?.ahead, behind = row?.behind
      const clean = held && files === 0 && ahead === 0
      return <g key={name}>
        <text x={cx} y={mini ? 9 : 22} className={chosen ? 'dp-ink' : 'dp-axis'} textAnchor="middle">{mini ? seatNo(name) : name}</text>
        <rect x={x0} y={top} width={bw} height={bh} rx={2}
          style={{fill: held || foreign ? `color-mix(in srgb, ${colour} 24%, transparent)` : 'none', stroke: held || foreign ? colour : 'var(--text-faint)', strokeWidth: chosen ? 1.7 : 1,
            strokeDasharray: held || foreign ? undefined : '2 2', opacity: g.rows ? 1 : .55}} />
        {!mini && g.rows && <text x={cx} y={top + 13} className={held || foreign ? 'dp-ink' : 'dp-axis'} textAnchor="middle">{row ? STATE_WORD[row.state] ?? NONE : 'none'}</text>}
        {mini && files !== undefined && files > 0 && <circle cx={cx} cy={top + bh + 9} r={2.2} style={{fill: 'var(--stall)'}} />}
        {!mini && row && <g>
          <text x={cx} y={73} className="dp-ink" textAnchor="middle" style={{fill: files === undefined ? undefined : files > 0 ? 'var(--stall)' : 'var(--text-faint)'}}>
            {files === undefined ? NONE : files > 0 ? `${files} file${files === 1 ? '' : 's'}` : 'clean'}</text>
          <text x={cx} y={83} className="dp-ink-dim" textAnchor="middle" style={{fill: clean ? 'var(--green)' : undefined}}>
            {held || foreign ? (clean ? 'landed' : ahead == null ? NONE : `+${ahead}`) : behind ? `${behind} behind` : 'at main'}</text>
          {held && row.zones.length > 0 && <text x={cx} y={93} className="dp-ink-dim" textAnchor="middle">{row.zones.length} zones</text>}
        </g>}
      </g>
    })}
    {!g.rows && !mini && <text x={w / 2} y={top + bh + 16} className="dp-axis" textAnchor="middle">no reading of the seats</text>}
    {live && g.rows && g.seat && g.envs.includes(g.seat)
      && <Handle n={1} x={colX(g.envs.indexOf(g.seat))} y={top + 26} label="Seat" does="Drag along the row to choose env-1, env-2 or env-3."
        onDrag={seatHand ? x => pick(x) : undefined} />}
    {gauge && <g>
      <text x={gx0} y={108} className="dp-axis">{g.diskRow ? 'disk free' : g.disk ? `no disk reading of ${g.seat ?? 'the seat'}` : 'no reading of the disk'}</text>
      {g.free !== undefined && <text x={gx1} y={108} className="dp-ink-dim" textAnchor="end">{g.free.toFixed(1)} GB</text>}
      <rect x={gx0} y={114} width={gx1 - gx0} height={6} className="dp-faint" />
      {g.hard !== undefined && g.floor !== undefined && <rect x={gx0} y={114} width={Math.max(0, gx(g.floor) - gx0)} height={6} style={{fill: 'var(--stall)', opacity: .28}} />}
      {g.free !== undefined && <rect x={gx0} y={114} width={Math.max(0, gx(g.free) - gx0)} height={6} style={{fill: 'var(--dp-value)', opacity: .85}} />}
      {g.hard !== undefined && <path d={`M${gx(g.hard)} 111V123`} className="dp-faint" />}
      {g.floor !== undefined && <path d={`M${gx(g.floor)} 109V125`} style={{stroke: 'var(--accent)', strokeWidth: 1, fill: 'none'}} />}
      {g.floor !== undefined && live
        ? <Handle n={2} shape="square" x={gx(g.floor)} y={117} label="Floor" does="Drag along the track to set the free disk below which Join sweeps caches first." onDrag={floorHand ? x => setFloor(x) : undefined} />
        : null}
      {g.floor !== undefined && <text x={gx(g.floor)} y={134} className="dp-ink-dim" textAnchor="middle">floor {g.floor}</text>}
      {g.floor === undefined && <text x={w / 2} y={134} className="dp-axis" textAnchor="middle">no reading of the Floor</text>}
      <text x={gx0} y={143} className="dp-axis">0</text>
      <text x={gx1} y={143} className="dp-axis" textAnchor="end">100 GB</text>
    </g>}
  </g>
}

// ------------------------------------------------------------------------------------------------ the controls

function ProductChooser({p}: {p: ViewProps}) {
  const g = ground(p.v)
  const options = g.products.map(x => {
    const mine = g.rows!.filter(r => r.product === x), held = mine.filter(r => r.state !== 'free').length
    return {value: x, label: x, does: `${x}: ${held} of ${mine.length} seats are held.`}
  })
  return <Chooser {...gate(p, 'product', g.rows ? undefined : 'No reading of the seats.')} label="Product" wide does="The project that the seat holds."
    value={g.product ?? ''} options={options} onChange={x => p.set('product', x)} />
}
function SeatRadio({p}: {p: ViewProps}) {
  const g = ground(p.v)
  const options = (g.envs.length ? g.envs : SEAT_NAMES).map(name => {
    const row = g.rows?.find(r => r.workcell === name && r.product === g.product)
    return {value: name, label: name, does: row ? `${name}: ${row.state === 'free' ? 'free' : `${STATE_WORD[row.state] ?? row.state} by ${short(row.claimedBy)}${row.branch ? ` on ${row.branch}` : ''}`}.` : `${name} has no ${g.product ?? 'such'} seat.`}
  })
  return <Radio {...gate(p, 'seat', g.rows ? undefined : 'No reading of the seats.')} label="Seat" stack does="The seat the session joins: one checkout of the product."
    value={g.seat ?? ''} options={options} onChange={x => p.set('seat', x)} />
}
function JoinAs({p, stack}: {p: ViewProps; stack?: boolean}) {
  const g = ground(p.v)
  const why = !g.row ? (g.rows ? 'Choose a product and a seat.' : 'No reading of the seats.') : g.row.state === 'free' ? 'This seat is free. Join starts a new lane.'
    : g.row.state === 'occupied-foreign-lane' ? FOREIGN(g.row) : undefined
  return <Radio {...gate(p, 'joinAs', why)} label="Join as" stack={stack} does="Attach: work beside the agents on the standing lane. New lane: replace the standing lane."
    value={g.row?.state === 'free' ? 'new-lane' : joinAs(p.v) ?? ''} options={JOIN_AS} onChange={x => p.set('joinAs', x)} />
}
function LaneField({p}: {p: ViewProps}) {
  const g = ground(p.v), standing = g.row?.state === 'claimed' && joinAs(p.v) !== 'new-lane'
  const why = !g.row ? (g.rows ? 'Choose a product and a seat.' : 'No reading of the seats.') : standing ? 'Attach joins the standing lane. Choose New lane to name another.'
    : g.row.state === 'occupied-foreign-lane' ? FOREIGN(g.row) : undefined
  return <TextField {...gate(p, 'lane', why)} label="Lane" wide does="The branch of the line of work. A free seat cuts it from main; a held seat shows its standing lane."
    value={standing ? g.row!.branch ?? '' : strOf(p.v, 'lane') ?? ''} placeholder={g.row ? `agent/${g.product}-date-time` : NONE} onChange={x => p.set('lane', x)} />
}
function ZoneField({p}: {p: ViewProps}) {
  const g = ground(p.v)
  return <TextField {...gate(p, 'zone', !g.row ? (g.rows ? 'Choose a product and a seat.' : 'No reading of the seats.') : g.row.state === 'occupied-foreign-lane' ? FOREIGN(g.row) : undefined)}
    label="Zone" wide does="The paths you will edit, apart by commas. Co-workers and new lanes commit inside their zones." value={strOf(p.v, 'zone') ?? ''}
    placeholder={has(p.v, 'zone') ? 'path, path' : NONE} onChange={x => p.set('zone', x)} />
}
function KeepDirt({p}: {p: ViewProps}) {
  const g = ground(p.v)
  const why = !g.row ? (g.rows ? 'Choose a product and a seat.' : 'No reading of the seats.') : !makesLane(g, p.v) ? 'Only a new lane replaces what stands in the seat.'
    : !hasStanding(g.row) ? 'No changes stand in this seat.' : undefined
  return <TextField {...gate(p, 'keepDirt', why)} label="Keep dirt on" wide does="A branch that keeps every change standing in the seat before the new lane starts. Nothing is deleted."
    value={strOf(p.v, 'keepDirt') ?? ''} placeholder={has(p.v, 'keepDirt') ? 'branch name' : NONE} onChange={x => p.set('keepDirt', x)} />
}
function JoinAction({p}: {p: ViewProps}) {
  return <Action {...gate(p, 'join', joinWhy(ground(p.v), p.v))} label="Join" does="Claim a free seat, or attach to the held lane, with the values set here." onPress={() => p.set('join', true)} />
}
function ReleaseAction({p}: {p: ViewProps}) {
  return <Action {...gate(p, 'release', releaseWhy(ground(p.v)))} label="Release" does="Give the seat up after the work has landed. The seat returns to main and the claim clears." onPress={() => p.set('release', true)} />
}
function FloorDial({p}: {p: ViewProps}) {
  const g = ground(p.v)
  return <Dial {...st(p, 'floor')} label="Floor" does="Free disk below which Join sweeps caches first. Below the hard floor, a quarter of it and at least 4 GB, Join refuses."
    value={g.floor ?? NaN} def={g.diskRow?.softGb ?? 20} scale={FLOOR} format={x => `${x} GB`} onChange={x => p.set('floor', x)} />
}

// ------------------------------------------------------------------------------------------------ the readings

function Claim({p}: {p: ViewProps}) {
  const g = ground(p.v), r = g.row, n = filesOf(r)
  return <>
    <Readout big label="claim" does="Who holds the seat: Free, Yours, Held by another lane, or Foreign for an owner-held lane." value={claimWord(g)} tone={g.row?.state === 'free' ? 'green' : g.row?.state === 'occupied-foreign-lane' ? 'stall' : 'accent'} />
    <Readout label="held by" does={r?.claimedBy ? `The lead of the lane: ${r.claimedBy}.` : 'The lead of the lane.'} value={r ? (r.claimedBy ? short(r.claimedBy) : r.state === 'free' ? 'nobody' : undefined) : undefined} />
    <Readout label="uncommitted" does="Files with changes that have no commit, tracked or not." value={n} tone={n ? 'stall' : undefined} />
    <Readout label="ahead" does="Commits on the lane that main does not hold." value={r?.ahead == null ? undefined : r.state === 'free' ? '0' : `+${r.ahead}`} />
  </>
}
const zoneRows = (g: Ground, actor: string | undefined): RowItem[] => {
  if (!g.row) return [{id: 'none', name: g.rows ? 'No seat chosen' : 'No reading', light: 'unknown'}]
  if (g.row.state === 'free') return [{id: 'free', name: 'No lane holds this seat', light: 'dark'}]
  if (!g.row.zones.length) return [{id: 'zones', name: 'No zone declared', light: 'dark'}]
  return [...g.row.zones].sort((a, b) => (b.since ?? 0) - (a.since ?? 0)).map((z): RowItem => ({
    id: z.actor, name: short(z.actor), light: 'lit', tone: z.actor === actor ? 'accent' : 'value',
    note: z.regions.length === 1 ? z.regions[0]!.split('/').pop() : `${z.regions.length} paths`, does: `${z.actor}: ${z.regions.join(', ') || 'no paths'}`,
  }))
}
function ZoneList({p, size}: {p: ViewProps; size: number}) {
  const g = ground(p.v), rows = zoneRows(g, g.actor), page = numOf(p.v, 'page:zones') ?? 0
  return <Rows does="The agents that declared an edit zone in this lane, the latest first. Teal is another agent. Amber is you." items={rows} size={size}
    page={page} onPage={x => p.set('page:zones', x)} />
}

// ------------------------------------------------------------------------------------------------ the pane

const lampOf = (r: SeatRow) => (r.state === 'free' ? 'dark' : 'lit')
const toneOf = (r: SeatRow) => (r.state === 'occupied-foreign-lane' ? 'stall' : 'value')

function Cell({p, row, selected}: {p: ViewProps; row: SeatRow | undefined; selected: boolean}) {
  if (!row) return <div className="sd-cell sd-cell--none">no seat</div>
  const n = filesOf(row), held = row.state !== 'free'
  return <button type="button" className="sd-cell" aria-pressed={selected} onClick={() => p.set('sel', at(row))}
    data-i={`${at(row)}|${held ? `${STATE_WORD[row.state] ?? row.state} by ${row.claimedBy ?? 'the owner'} on ${row.branch ?? 'no branch'}` : 'Free, detached at main.'}`}>
    <span className="dp-lamp" data-light={lampOf(row)} data-tone={toneOf(row)} />
    <b>{held ? row.branch ?? NONE : 'free'}</b>
    <i data-warn={row.drift ? 'true' : undefined}>
      {held ? `${short(row.claimedBy)} · ${n === undefined ? NONE : n > 0 ? `${n} file${n === 1 ? '' : 's'}` : 'clean'} · ${row.ahead == null ? NONE : row.ahead > 0 ? `+${row.ahead}` : 'landed'}`
        : `${row.behind ? `-${row.behind} behind main` : 'at main'}${row.admissionNote ? ' · below the floor' : ''}`}{row.drift ? ' · drift' : ''}
    </i>
  </button>
}

function Pane({p}: {p: ViewProps}) {
  const g = ground(p.v), machine = strOf(p.v, 'machineRef')
  const selId = strOf(p.v, 'sel') ?? (g.seat && g.product ? `${g.seat}/${g.product}` : undefined)
  const sel = g.rows?.find(r => at(r) === selId)
  const held = g.rows?.filter(r => r.state === 'claimed').length, foreign = g.rows?.filter(r => r.state === 'occupied-foreign-lane').length
  return <div className="ref-pane-body sd-pane">
    <div className="sd-top">
      <h3>Seats<small>{machine ?? NONE} · {g.rows ? `${g.rows.length} seats · ${held} held${foreign ? ` · ${foreign} foreign` : ''}` : 'no reading'}</small></h3>
      <span className="sd-disk">disk free {g.disk?.length ? g.disk.map(d => `${d.workcell} ${d.freeGb === null ? NONE : `${d.freeGb.toFixed(1)} GB`}`).join(' · ') : NONE}</span>
    </div>
    {!g.rows ? <p className="sd-none">No reading of the seats.</p> : <div className="sd-grid" style={{gridTemplateColumns: `132px repeat(${g.envs.length}, minmax(0, 1fr))`}}>
      <span className="sd-head" />
      {g.envs.map(e => <span key={e} className="sd-head"><KindMark kind="place" size={13} />{e}</span>)}
      {g.products.map(product => <div key={product} className="sd-line">
        <span className="sd-product">{product}</span>
        {g.envs.map(e => {
          const row = g.rows!.find(r => r.workcell === e && r.product === product)
          return <Cell key={e} p={p} row={row} selected={!!row && at(row) === selId} />
        })}
      </div>)}
    </div>}
    <div className="sd-detail">
      {sel ? <>
        <div>
          <h5>{sel.workcell} · {sel.product}<small>{sel.state === 'free' ? 'free' : `${STATE_WORD[sel.state] ?? sel.state} by ${sel.claimedBy ?? 'the owner'}`}</small></h5>
          <p>{sel.state === 'free' ? `Detached at ${sel.head ?? NONE}${sel.behind ? `, ${sel.behind} commits behind main` : ', at main'}.`
            : `Lane ${sel.branch ?? NONE} at ${sel.head ?? NONE}: ${sel.ahead == null ? NONE : `+${sel.ahead}`} against main, ${filesOf(sel) ?? NONE} files uncommitted (${sel.dirty ?? NONE} tracked, ${sel.untracked ?? NONE} untracked).`}</p>
          <p className="sd-rests">{sel.state === 'free' ? 'A free seat has no zones.' : sel.zones.length ? `Zones: ${[...sel.zones].sort((a, b) => (b.since ?? 0) - (a.since ?? 0)).slice(0, 3).map(z => `${short(z.actor)} (${z.regions.length})`).join(', ')}${sel.zones.length > 3 ? ` and ${sel.zones.length - 3} more` : ''}.` : 'No zone declared.'}</p>
        </div>
        <div>
          <h5>Standing</h5>
          <p data-warn={sel.drift ? 'true' : undefined}>{sel.drift ? `Drift: ${sel.drift}` : 'The register and the checkout agree.'}</p>
          {sel.admissionNote && <p className="sd-rests">{sel.admissionNote}.</p>}
        </div>
      </> : <div><h5>Select a seat</h5><p>Read its lane, its claim, its uncommitted files and its zones. The controls stay in Device view.</p></div>}
    </div>
  </div>
}

// ------------------------------------------------------------------------------------------------ the sample readings
// What the gallery reads on: the real `seat status` of env-1 to env-3 on 16 Oct, in the shape of SeatRow (each seat's eight latest
// zones). `defaults` and `fixtures` use them and nothing else does.

const dump = (x: unknown) => JSON.stringify(x)
const SAMPLE: SeatRow[] = [
  {"workcell":"env-1","product":"actuation","state":"claimed","branch":"fold/day-close-20261012","head":"933731e","claimedBy":"claude-code:dlw-conductor","dirty":0,"untracked":0,"ahead":3,"behind":0,"drift":"register pose ('fold/day-close-20261012', '7b4af99') != live ('fold/day-close-20261012', '933731e')","admissionNote":null,"zones":[{"actor":"claude-code:dlw-conductor","regions":["ProjectCentral",".gitignore","experiments","scripts"],"since":1791846105}]},
  {"workcell":"env-1","product":"ai-kit","state":"free","branch":null,"head":"51a98e6d","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":0,"drift":null,"admissionNote":"admitted below the soft floor; breach recorded","zones":[{"actor":"claude-code:dlw-lead","regions":["crates/aikit-cli/src/app/knowledge.rs","crates/aikit-cli/src/app/knowledge","crates/aikit-cli/tests"],"since":1792106456},{"actor":"codex:improvement-parent","regions":["crates/aikit-core/src/skillset.rs","crates/aikit-core/src/method.rs","crates/aikit-cli/src/profile_ops.rs","crates/aikit-cli/src/skillset_package_cli.rs","crates/aikit-core/src/skillset_package","crates/aikit-cli/src/projection_drift.rs","crates/aikit-adapters/src/clients"],"since":1791388304}]},
  {"workcell":"env-1","product":"central","state":"claimed","branch":"fix/day-close-no-t-payloads","head":"8aa1065","claimedBy":"claude-code:dlw-conductor","dirty":0,"untracked":0,"ahead":1,"behind":4,"drift":"register pose ('fold/day-close-20261012', 'cf58c54') != live ('fix/day-close-no-t-payloads', '8aa1065')","admissionNote":null,"zones":[{"actor":"claude-code:dlw-conductor","regions":["ProjectCentral",".gitignore","experiments","scripts"],"since":1791846067},{"actor":"zcode:mac-peer-credential-push","regions":["ctrl"],"since":1791428601},{"actor":"agent:claude-code:ctrl-t-payload-law","regions":["ctrl/tests/continuous_work_admission.rs"],"since":1791412597}]},
  {"workcell":"env-1","product":"factory","state":"free","branch":null,"head":"6b1b7ff","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":0,"drift":null,"admissionNote":null,"zones":[{"actor":"claude-code:dlw-conductor","regions":["ProjectCentral",".gitignore","experiments","scripts"],"since":1791846073},{"actor":"codex:improvement-parent","regions":["factory/src"],"since":1791388304}]},
  {"workcell":"env-1","product":"o-i","state":"claimed","branch":"dlw/build","head":"5b3c3e0fc","claimedBy":"claude-code:dlw-lead","dirty":40,"untracked":22,"ahead":244,"behind":0,"drift":"register pose ('dlw/phase1-semantics-20261013', 'cc69e19fa') != live ('dlw/build', '5b3c3e0fc')","admissionNote":null,"zones":[{"actor":"claude-code:dlw-manual","regions":["packages/live-shell/ui/src/inhabitants/catalogue"],"since":1792078733},{"actor":"claude-code:dlw-lead","regions":["desktop/cradle/docs/world-shell"],"since":1791851470},{"actor":"claude-code:dlw-conductor","regions":["ProjectCentral",".gitignore","experiments","scripts"],"since":1791846057},{"actor":"agent:cursor-624-rust","regions":["skills/device-sdk","skills/m-prime-development"],"since":1791749995},{"actor":"agent:zcode-convergence","regions":["desktop/cradle/kernel/src","desktop/cradle/src","desktop/cradle/tests"],"since":1791728322},{"actor":"agent:zcode-mprime-founding","regions":["skills/m-prime-development","docs"],"since":1791670260},{"actor":"agent:zcode-device-sdk","regions":["packages/live-shell/ui/src/inhabitants","packages/live-shell/ui/src/components","packages/live-shell/ui/tests","packages/live-shell/ui/scripts"],"since":1791540643},{"actor":"zcode:agent-shell-repair","regions":["packages/live-shell/ui","packages/expressions-boundary","packages/live-shell/src/inhabitants.rs"],"since":1791493218}]},
  {"workcell":"env-1","product":"ql-mef","state":"free","branch":null,"head":"37e3085","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":1,"drift":null,"admissionNote":null,"zones":[{"actor":"claude-code:dlw-lead","regions":["crates/ql-cli"],"since":1791926354},{"actor":"claude-code:dlw-conductor","regions":["ProjectCentral",".gitignore","experiments","scripts"],"since":1791846085},{"actor":"agent:distribution-finish","regions":["scripts/oi-source-install.sh","scripts/export-sky.py","scripts/test-sky-export.py"],"since":1791418597}]},
  {"workcell":"env-1","product":"workcell","state":"free","branch":null,"head":"59f94a3","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":1,"drift":null,"admissionNote":null,"zones":[{"actor":"claude-code:dlw-conductor","regions":["ProjectCentral",".gitignore","experiments","scripts"],"since":1791846079},{"actor":"codex:collaboration-b","regions":["crates"],"since":1791435480},{"actor":"codex:improvement-parent","regions":["crates/workcell-cli"],"since":1791435376}]},
  {"workcell":"env-1","product":"point-cloud-demo","state":"free","branch":null,"head":"e9c7ccb","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":0,"drift":null,"admissionNote":null,"zones":[]},
  {"workcell":"env-2","product":"actuation","state":"free","branch":null,"head":"cd1f4ce","claimedBy":null,"dirty":0,"untracked":1,"ahead":0,"behind":2,"drift":null,"admissionNote":null,"zones":[]},
  {"workcell":"env-2","product":"ai-kit","state":"free","branch":null,"head":"01987475","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":3,"drift":null,"admissionNote":null,"zones":[{"actor":"agent:zcode-praxis-persist","regions":["crates/aikit-store/src","crates/aikit-store/tests","crates/aikit-cli/src","crates/aikit-cli/tests","crates/aikit-core/src","crates/aikit-core/tests"],"since":1791634509},{"actor":"agent:zcode-praxis-projection","regions":["crates/aikit-cli/src","crates/aikit-cli/tests","crates/aikit-core/src","crates/aikit-core/tests"],"since":1791631682},{"actor":"agent:zcode-praxis-receipt","regions":["crates/aikit-core/src","crates/aikit-core/tests","crates/aikit-cli/src","crates/aikit-cli/tests"],"since":1791628193},{"actor":"agent/oh-i","regions":["crates/aikit-adapters/src"],"since":1791393344},{"actor":"codex:improvement-parent","regions":["crates/aikit-cli/src/communique_turn.rs","crates/aikit-adapters/src/gateway_communique.rs","crates/aikit-cli/src/gateway_contact.rs","crates/aikit-cli/src/gateway_owners.rs","crates/aikit-cli/src/inhabit_team.rs","crates/aikit-cli/src/inhabit.rs","crates/aikit-cli/src/inhabitation.rs","crates/aikit-adapters/src/agent_session_host.rs","crates/aikit-adapters/src/agent_connection.rs"],"since":1791388304}]},
  {"workcell":"env-2","product":"central","state":"free","branch":null,"head":"5b92994","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":0,"drift":null,"admissionNote":"admitted below the soft floor; breach recorded","zones":[{"actor":"claude-code:dlw-lead","regions":["ctrl/src/source_horizon.rs","connectors/git-sync/src/git_diff.rs","ctrl/tests"],"since":1792106457},{"actor":"agent:claude-code:file-map-external-scopes","regions":["ctrl/src/file_map_catalog.rs","ctrl/src/file_map_backend.rs","ctrl/src/file_map.rs","ctrl/src/file_map_adoption.rs","ctrl/src/file_map_moves.rs","ctrl/src/file_map_index.rs"],"since":1791414683}]},
  {"workcell":"env-2","product":"factory","state":"free","branch":null,"head":"96a7fef","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":1,"drift":null,"admissionNote":null,"zones":[{"actor":"agent:zcode-flake-repair","regions":["factory/src/commission.rs"],"since":1791635397},{"actor":"agent:zcode-commission-wiring","regions":["factory/src","factory/tests","docs/program"],"since":1791631682},{"actor":"agent:zcode-vak-conduct","regions":["factory/src/vak_orchestration","factory/src/vak_orchestration.rs","factory/tests"],"since":1791628191}]},
  {"workcell":"env-2","product":"o-i","state":"claimed","branch":"dlw/native-build","head":"9a1974d13","claimedBy":"claude-code:dlw-lead","dirty":0,"untracked":1,"ahead":229,"behind":0,"drift":"register pose ('dlw/native-build', '2491a11b6') != live ('dlw/native-build', '9a1974d13')","admissionNote":null,"zones":[{"actor":"claude-code:cradle-instrument-summon","regions":["desktop/cradle/src","desktop/cradle/tests"],"since":1791950692},{"actor":"claude-code:dlw-manual","regions":["docs/dlw"],"since":1791897450},{"actor":"agent:zcode-convergence","regions":["desktop/cradle/kernel/src/agent_definition.rs","desktop/cradle/kernel/tests/agent_definition_gate.rs","desktop/cradle/src/agency","desktop/cradle/tests/agent-self-definition.test.mjs"],"since":1791724803},{"actor":"zcode:glass-bead-game-study","regions":["skills/m-prime-development"],"since":1791684675},{"actor":"zcode:glue-circuit-integration","regions":["docs/research/ableton-live-12.0.25/devices/glue-perblock-derivation.md"],"since":1791480227},{"actor":"agent/oh-i","regions":["desktop/cradle/kernel/tests"],"since":1791409247},{"actor":"agent:claude-code:opus-5.5","regions":[".github/workflows/site.yml"],"since":1791396690},{"actor":"codex:psc-581","regions":["desktop/cradle/kernel/tests"],"since":1791384688}]},
  {"workcell":"env-2","product":"ql-mef","state":"free","branch":null,"head":"73097be","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":6,"drift":null,"admissionNote":"admitted below the soft floor; breach recorded","zones":[{"actor":"claude-sonnet-5.5:281-replan","regions":["crates/ql-mef/src/continuous/scene_field.rs","crates/ql-mef/tests/scene_instrument.rs","crates/ql-mef/tests/scene_played_classes.rs"],"since":1791312302}]},
  {"workcell":"env-2","product":"workcell","state":"free","branch":null,"head":"1023071","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":0,"drift":null,"admissionNote":"admitted below the soft floor; breach recorded","zones":[{"actor":"claude-code:dlw-lead","regions":["src","tests","crates","docs"],"since":1792079109}]},
  {"workcell":"env-2","product":"point-cloud-demo","state":"free","branch":null,"head":"e9c7ccb","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":0,"drift":null,"admissionNote":null,"zones":[{"actor":"claude-code:dlw-conductor","regions":["ProjectCentral",".gitignore","experiments","scripts"],"since":1791841122},{"actor":"zcode:enrich-sproducts-l3","regions":["production/s-products"],"since":1791294344}]},
  {"workcell":"env-3","product":"actuation","state":"free","branch":null,"head":"cd1f4ce","claimedBy":null,"dirty":0,"untracked":1,"ahead":0,"behind":2,"drift":null,"admissionNote":"admitted below the soft floor; breach recorded","zones":[{"actor":"zcode:harness-wiring-20261006","regions":["crates"],"since":1791321142}]},
  {"workcell":"env-3","product":"ai-kit","state":"free","branch":null,"head":"01987475","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":3,"drift":null,"admissionNote":"admitted below the soft floor; breach recorded","zones":[{"actor":"zcode:harness-wiring-20261006","regions":["crates/aikit-cli/src/app/mod.rs"],"since":1791364022}]},
  {"workcell":"env-3","product":"central","state":"free","branch":null,"head":"cf58c54","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":4,"drift":null,"admissionNote":"admitted below the soft floor; breach recorded","zones":[{"actor":"agent:zcode-convergence","regions":["ctrl/src/agent_profile.rs","ctrl/src/agent_profile_acceptance.rs","ctrl/src/agent_profile_actions.rs","ctrl/tests/agent_profile_acceptance.rs"],"since":1791726480}]},
  {"workcell":"env-3","product":"factory","state":"free","branch":null,"head":"96a7fef","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":1,"drift":null,"admissionNote":null,"zones":[{"actor":"agent:zcode-praxis-attach","regions":["factory/src","factory/tests"],"since":1791635240},{"actor":"agent:zcode-praxis-validation","regions":["factory/src","factory/tests"],"since":1791631683}]},
  {"workcell":"env-3","product":"o-i","state":"free","branch":null,"head":"65202d830","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":75,"drift":null,"admissionNote":null,"zones":[{"actor":"zcode:agent-self-acquaintance","regions":["desktop/cradle/tests"],"since":1791385883},{"actor":"codex:psg-sampler","regions":["desktop/cradle/expressions-app/src/engine"],"since":1791384676},{"actor":"codex:walkbridge-v2","regions":["desktop/cradle/kernel/src/bin"],"since":1791374402},{"actor":"codex:psu-580-s2","regions":["desktop/cradle/expressions-app/field-studies-journeys"],"since":1791372334},{"actor":"codex:psu-580","regions":["desktop/cradle/expressions-app/field-studies-journeys/src/native-field/ql/instrument-session.mjs","desktop/cradle/expressions-app/field-studies-journeys/src/native-field/controller.ts","desktop/cradle/expressions-app/field-studies-journeys/src/nativeField.ts","desktop/cradle/expressions-app/field-studies-journeys/tests/native-stage.test.mjs"],"since":1791363347}]},
  {"workcell":"env-3","product":"ql-mef","state":"free","branch":null,"head":"36f9eb0","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":0,"drift":null,"admissionNote":null,"zones":[{"actor":"claude-code:dlw-manual","regions":["docs/M-PRIME-PHYSICAL-MUSIC-WORK-PACKETS.md"],"since":1791924556},{"actor":"agent:zcode-cprime-coverage","regions":["crates/ql-cli"],"since":1791628202},{"actor":"codex:psu-580","regions":["adapters/retained-field/instrument-session.mjs","adapters/retained-field/instrument-session.test.mjs"],"since":1791366291}]},
  {"workcell":"env-3","product":"workcell","state":"free","branch":null,"head":"a716cd3","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":2,"drift":null,"admissionNote":null,"zones":[]},
  {"workcell":"env-3","product":"point-cloud-demo","state":"free","branch":null,"head":"e9c7ccb","claimedBy":null,"dirty":0,"untracked":0,"ahead":0,"behind":0,"drift":null,"admissionNote":null,"zones":[]},
]
const SAMPLE_DISK: DiskRow[] = [{"workcell":"env-1","freeGb":40.2,"softGb":20,"hardGb":null},{"workcell":"env-2","freeGb":40.2,"softGb":20,"hardGb":null},{"workcell":"env-3","freeGb":40.2,"softGb":20,"hardGb":null}]

const DEFAULTS: Values = {
  machineRef: 'workcell:mac', actor: 'claude-code:dlw-manual', product: 'o-i', seat: 'env-1', lane: '', joinAs: 'attach', zone: '', keepDirt: '', floor: 20,
  seats: dump(SAMPLE), disk: dump(SAMPLE_DISK),
}

// ------------------------------------------------------------------------------------------------ the device

export const design: DesignedDevice = {
  id: 'workcell:seat',
  title: 'Seat',
  kind: 'effect',
  defaults: DEFAULTS,
  fixtures: {
    'A held seat': {},
    'A free seat': {product: 'ql-mef', seat: 'env-2'},
    'No readings': Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, undefined])),
  },

  folded: p => {
    const g = ground(p.v)
    return <Folded title="Seat" light={lightOf(p)} readings={[g.seat ?? NONE, claimWord(g) ?? NONE]} onUnfold={p.nav.unfold} />
  },

  compact: p => {
    const g = ground(p.v)
    return <Panel title="Seat" view="compact" light={lightOf(p)} lightWhy={LIGHT_WHY} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="The seats" does="The product's three seats and the disk of the chosen workcell. Drag handle 1 to choose the seat." corner={cornerOf(g)}>
          <Seats p={p} w={140} h={146} live gauge />
        </Display>
      </Section>
      <Section label="Macros" cols={3}>
        <SeatRadio p={p} />
        <JoinAs p={p} stack />
        <div className="sd-acts"><JoinAction p={p} /><ReleaseAction p={p} /></div>
      </Section>
    </Panel>
  },

  whole: p => {
    const g = ground(p.v)
    return <Panel title="Seat" view="whole" light={lightOf(p)} lightWhy={LIGHT_WHY} onFold={p.nav.fold} onFull={p.nav.full}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="The seats" does="The product's three seats and the disk of the chosen workcell. Drag handle 1 to choose the seat and handle 2 to set the Floor." corner={cornerOf(g)}>
            <Seats p={p} w={194} h={146} live gauge />
          </Display>
        </Section>
        <Section label="Place" width={96}>
          <ProductChooser p={p} />
          <SeatRadio p={p} />
          <LaneField p={p} />
        </Section>
        <Section label="Claim" grow>
          <Claim p={p} />
        </Section>
      </Band>
      <Band>
        <Section label="Join" cols={2}>
          <div className="sd-span2"><JoinAs p={p} /></div>
          <div className="sd-span2"><ZoneField p={p} /></div>
          <div className="sd-span2"><KeepDirt p={p} /></div>
          <JoinAction p={p} />
          <ReleaseAction p={p} />
        </Section>
        <Section label="Disk" width={62}>
          <FloorDial p={p} />
          <Readout label="free" does="Free disk of the chosen workcell." value={g.free === undefined ? undefined : `${g.free.toFixed(1)} GB`} />
        </Section>
        <Section label="Zones" grow>
          <ZoneList p={p} size={7} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <Pane p={p} />,

  widget: p => {
    const g = ground(p.v)
    return <Tile title="Seat" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <Display w={76} h={76} label="The seats" does="The product's three seats. A filled block is a held seat; an orange dot is uncommitted work.">
        <Seats p={p} w={76} h={76} mini />
      </Display>
      <div className="sd-tile-side">
        <Readout big label="claim" does="Who holds the seat." value={claimWord(g)} tone={g.row?.state === 'free' ? 'green' : g.row?.state === 'occupied-foreign-lane' ? 'stall' : 'accent'} />
        <Readout label="seat" does="The chosen seat and its product." value={g.seat && g.product ? `${g.seat} · ${g.product}` : undefined} />
        <Readout label="lane" does={g.row?.branch ? `The lane: ${g.row.branch}.` : 'The lane that holds the seat.'} value={g.row ? g.row.branch ?? (g.row.state === 'free' ? 'none' : undefined) : undefined} />
      </div>
    </Tile>
  },
}
