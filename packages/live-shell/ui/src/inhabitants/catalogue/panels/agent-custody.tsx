// Retired as a device of its own (22 Oct manual rewrite): not a `<family>__<face>.tsx` panel any more, so the catalogue does not load
// it; the Agent (actuation:harness-model) carries its pages through this module.
// Custody (manual §19.4, software-factory:agent-custody): what waits for you before a change lands, how a write arrives, and what the
// agent holds now. Live's nearest: Utility with a small display — a few plain settings whose meaning shows at a glance. It shares the
// Agent's chain slot (agentDeviceCatalogue.ts) and Scope's `writeMode` row (shell.setWriteArm; the transport's Arm). The Agent's
// Autonomy, which it once set (a rail from Suggest to Auto), is retired (§19.4, §19.12): Scope's Tool calls took its place.
//
// The well draws the device's own law. Two gate boxes (diffs, approvals) light for the review gate; a line of three stops shows how a
// write arrives; a dot for each held item shows what the agent holds (Factory's custody: filled orange while the agent works on it,
// ringed orange when it is blocked, ringed red when you edited it).
//
// Keys. Settings: `gate` (diffs|approvals|both), `writeMode` (propose|draft|direct), `escalate` (a
// person's id). Readings: `light`, `handBackLit` (the transport's Re-enable light), `held` (JSON rows of {id, name, kind work|file|value,
// state in-progress|blocked|edited, by, receipts, why}) and `people` (JSON rows of {id, name}). The action: `handBack`, set true to give
// the held items back. A key the owner does not report arrives absent, and the views draw "—" and name what is missing.
//
// Its Grants page is Scope's (manual §19.12 Grants; scope.tsx).
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './agent-custody.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- fixed vocabulary (the settings' words, not the owner's data)

const GATES = [
  {value: 'diffs', label: 'Diffs', does: 'A change waits for you to read its diff.'},
  {value: 'approvals', label: 'Approvals', does: 'A change waits for you to answer its request.'},
  {value: 'both', label: 'Both', does: 'A change waits for the diff and the approval.'},
] as const
const MODES = [
  {value: 'propose', label: 'Propose', does: 'A write arrives as a proposal that waits.'},
  {value: 'draft', label: 'Draft', does: 'A write arrives in a draft that you review.'},
  {value: 'direct', label: 'Direct', does: 'A write goes into the thing itself, with a receipt.'},
] as const
const SAYS = {
  gate: 'What waits for you before a change lands.',
  write: 'The most the agent may do with a write. Scope limits each part of the world; the stricter value stands.',
  escalate: 'Who the agent asks when it needs a decision.',
  handBack: 'Lit when you edited something the agent holds. Press it to give control to the agent again.',
}
const KINDS = ['work', 'file', 'value'] as const
const STATES = ['in-progress', 'blocked', 'edited'] as const
type Kind = (typeof KINDS)[number]
type State = (typeof STATES)[number]

/** The place of a value in its list, or undefined when the owner has not reported it (or reports a word the list lacks). */
const at = (list: readonly {value: string}[], x: string | undefined) => { const i = list.findIndex(o => o.value === x); return i < 0 ? undefined : i }
const gateAt = (v: V) => at(GATES, strOf(v, 'gate'))
const modeAt = (v: V) => at(MODES, strOf(v, 'writeMode'))
const gateWord = (v: V) => { const i = gateAt(v); return i === undefined ? undefined : GATES[i]!.label }

// ---------------------------------------------------------------- the owner's rows, read safely

interface Held {readonly id: string; readonly name: string; readonly kind?: Kind; readonly state?: State; readonly by?: string; readonly receipts?: number; readonly why?: string}

/** The held items from `held`: a row that is not an object is dropped, an unknown kind or state is left unread. */
function heldItems(v: V): Held[] {
  const raw = json<unknown>(v, 'held', [])
  const rows: Held[] = []
  for (const [n, item] of (Array.isArray(raw) ? raw : []).entries()) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    rows.push({id: typeof o.id === 'string' && o.id ? o.id : `held:${n}`, name: typeof o.name === 'string' && o.name ? o.name : NONE,
      kind: KINDS.find(k => k === o.kind), state: STATES.find(s => s === o.state), by: typeof o.by === 'string' && o.by ? o.by : undefined,
      receipts: typeof o.receipts === 'number' && Number.isFinite(o.receipts) && o.receipts >= 0 ? o.receipts : undefined,
      why: typeof o.why === 'string' && o.why ? o.why : undefined})
  }
  return rows
}
/** The count of held items; undefined when the owner reports no list. */
const heldCount = (v: V) => (has(v, 'held') ? heldItems(v).length : undefined)
const countText = (v: V) => { const n = heldCount(v); return n === undefined ? NONE : `${n} held` }

/** The people the agent may ask, with the value the owner reports itself kept among them. */
function people(v: V): Option<string>[] {
  const raw = json<unknown>(v, 'people', [])
  const list = (Array.isArray(raw) ? raw : []).flatMap(item => {
    const o = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return typeof o.id === 'string' && o.id ? [{value: o.id, label: typeof o.name === 'string' && o.name ? o.name : o.id}] : []
  })
  const now = strOf(v, 'escalate')
  return now !== undefined && now !== '' && !list.some(x => x.value === now) ? [...list, {value: now, label: now}] : list
}

// The light reads the owner alone; hollow while it has not said.
const lightOf = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
/** The Re-enable light: lit, dark, or undefined while the owner has not said. */
const handLit = (p: ViewProps) => boolOf(p.owner ?? p.v, 'handBackLit')

// ---------------------------------------------------------------- the dots

/** A held item as a dot: filled orange while the agent works on it, ringed orange when it is blocked, ringed red when you edited it
 * (the standard's overridden mark, §6), a faint ring when its state is not read. */
function Dot({x, y, state, r = 3.5, title}: {x: number; y: number; state?: State; r?: number; title?: string}) {
  const ring = {fill: 'none', strokeWidth: 1.5}
  return state === 'in-progress' ? <circle cx={x} cy={y} r={r} fill="var(--stall)">{title && <title>{title}</title>}</circle>
    : state === 'blocked' ? <circle cx={x} cy={y} r={r - 0.75} stroke="var(--stall)" {...ring}>{title && <title>{title}</title>}</circle>
    : state === 'edited' ? <circle cx={x} cy={y} r={r - 0.75} stroke="var(--rec)" {...ring}>{title && <title>{title}</title>}</circle>
    : <circle cx={x} cy={y} r={r - 0.75} stroke="var(--text-faint)" strokeWidth={1} fill="none">{title && <title>{title}</title>}</circle>
}
const itemTitle = (i: Held) => [i.name, i.kind, i.state?.replace('-', ' ')].filter(Boolean).join(' · ')

/** The held items as a grid of dots; the last cell says how many more there are when they do not all fit. */
function Dots({items, x, y, pitch, cols, rows, r}: {items: Held[]; x: number; y: number; pitch: number; cols: number; rows: number; r?: number}) {
  const room = cols * rows, over = items.length > room, shownItems = over ? items.slice(0, room - 1) : items
  const cell = (n: number) => ({cx: x + (n % cols) * pitch, cy: y + Math.floor(n / cols) * pitch})
  return <g>
    {shownItems.map((item, n) => <Dot key={item.id} x={cell(n).cx} y={cell(n).cy} r={r} state={item.state} title={itemTitle(item)} />)}
    {over && <text x={cell(room - 1).cx - 3} y={cell(room - 1).cy + 3} className="dp-axis">+{items.length - room + 1}</text>}
  </g>
}

// ---------------------------------------------------------------- the well

/** The well: the gate boxes and the write stops (whole), the held dots. A reading the owner has not reported is left off the picture
 * and named in words; a handle shows only where its key can be written. */
function CustodyWell({v, set, standing, w, h, size}: {v: V; set?: ViewProps['set']; standing?: ViewProps['standing']; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const mini = size === 'mini', whole = size === 'whole'
  const g = gateAt(v), m = modeAt(v), items = heldItems(v), known = has(v, 'held'), lit = boolOf(v, 'handBackLit') === true
  const handle = (key: string) => !!set && !mini && !standing?.[key]?.disabled
  const x0 = mini ? 10 : 14, x1 = w - x0, mid = (x0 + x1) / 2
  const sx = (i: number) => x0 + i * (x1 - x0) / 2
  const nearest = (x: number, stops: number[]) => stops.reduce((best, s, i) => (Math.abs(s - x) < Math.abs(stops[best]! - x) ? i : best), 0)
  // the whole well's gate boxes sit at the left and right, the "both" stop between them; the write stops run across like the rail
  const boxW = 62, boxL = 14, boxR = w - 14 - boxW, gateStops = [boxL + boxW / 2, mid, boxR + boxW / 2], gateOrder = ['diffs', 'both', 'approvals'] as const
  const gateIndex = g === undefined ? undefined : gateOrder.indexOf(GATES[g]!.value)
  const diffsOn = g !== undefined && GATES[g]!.value !== 'approvals', approvalsOn = g !== undefined && GATES[g]!.value !== 'diffs'
  const writeY = 85
  return <Display w={w} h={h} label="Custody" does={mini ? 'What waits for you, and what the agent holds.' : 'What waits for you before a change lands, how a write arrives, and what the agent holds. Drag the handles to set them.'}
    corner={mini ? undefined : countText(v)}>
    {whole && <>
      {/* the review gate: two boxes that light for what waits for you */}
      <text x={7} y={11} className="dp-axis">{g === undefined ? `review gate ${NONE}` : 'review gate'}</text>
      <path d={`M${boxL + boxW} 37H${boxR}`} className="dp-faint" />
      {[{x: boxL, word: 'diffs', on: diffsOn}, {x: boxR, word: 'approvals', on: approvalsOn}].map(box => <g key={box.word}>
        <rect x={box.x + 0.5} y={30.5} width={boxW - 1} height={14} className={box.on ? undefined : 'dp-faint'} fill={box.on ? 'color-mix(in srgb, var(--dp-value) 22%, transparent)' : 'none'} stroke={box.on ? 'var(--dp-value)' : undefined} />
        <text x={box.x + boxW / 2} y={40.5} className="dp-ink-dim" textAnchor="middle">{box.word}</text>
      </g>)}
      {gateStops.map((gx, i) => <path key={i} d={`M${gx} 53V59`} className="dp-faint" />)}
      {handle('gate') && gateIndex !== undefined && <Handle n={1} x={gateStops[gateIndex]!} y={56} label="Review gate" does="Drag along the line: diffs, both, or approvals wait for you."
        onDrag={x => set!('gate', gateOrder[nearest(x, gateStops)]!)} onReset={() => set!('gate', 'both')} />}
      {gateIndex !== undefined && !handle('gate') && <circle cx={gateStops[gateIndex]!} cy={56} r={3.5} fill="var(--dp-on)" />}

      {/* the write stops: how a write arrives */}
      <text x={7} y={71} className="dp-axis">{m === undefined ? `write ${NONE}` : 'write'}</text>
      <path d={`M${x0} ${writeY}H${x1}`} className="dp-faint" />
      {MODES.map((mode, i) => <g key={mode.value}>
        <path d={`M${sx(i)} ${writeY - 4}V${writeY + 4}`} className="dp-faint" />
        <text x={i === 0 ? 7 : i === 1 ? mid : w - 7} y={writeY + 13} className="dp-axis" textAnchor={i === 0 ? 'start' : i === 1 ? 'middle' : 'end'}>{mode.value}</text>
      </g>)}
      {m !== undefined && !handle('writeMode') && <circle cx={sx(m)} cy={writeY} r={3.5} fill="var(--dp-on)" />}
      {handle('writeMode') && m !== undefined && <Handle n={2} x={sx(m)} y={writeY} label="Write mode" does="Drag along the line: how a write arrives."
        onDrag={x => set!('writeMode', MODES[Math.round(clampTo(0, 2, (x - x0) / ((x1 - x0) / 2)))]!.value)} onReset={() => set!('writeMode', 'propose')} />}
    </>}

    {/* what the agent holds, a dot for each item */}
    {!mini && !whole && <text x={7} y={14} className="dp-axis">gate {g === undefined ? NONE : GATES[g]!.value} · writes {m === undefined ? NONE : MODES[m]!.value}</text>}
    {!mini && !whole && <text x={7} y={34} className="dp-axis">{known ? 'held' : `held ${NONE}`}</text>}
    {!mini && !whole && lit && <text x={w - 7} y={34} className="dp-axis" textAnchor="end" style={{fill: 'var(--rec)'}}>hand back lit</text>}
    {known && size === 'compact' && <Dots items={items} x={14} y={50} pitch={14} cols={8} rows={4} r={4.5} />}
    {known && whole && <Dots items={items} x={11} y={110} pitch={10} cols={18} rows={1} />}
    {known && mini && <Dots items={items} x={13} y={14} pitch={9} cols={10} rows={6} />}
    {mini && lit && <text x={7} y={h - 6} className="dp-axis" style={{fill: 'var(--rec)'}}>hand back lit</text>}
    {/* the compact well (140 wide) holds the words on two lines; the whole well holds them on one */}
    {!known && <text x={7} y={whole ? 112 : mini ? 32 : 64} className="dp-ink-dim">{mini ? 'Held not read' : whole ? 'No reading of what the agent holds'
      : <><tspan x={7}>No reading of what</tspan><tspan x={7} dy={12}>the agent holds</tspan></>}</text>}
    {known && items.length === 0 && <text x={7} y={whole ? 112 : mini ? 32 : 64} className="dp-ink-dim">Nothing held</text>}
  </Display>
}

// ---------------------------------------------------------------- the controls

const gateDial = (p: ViewProps) => <Dial {...st(p, 'gate')} label="Gate" does={`${SAYS.gate} Diffs, approvals or both.`} value={gateAt(p.v) ?? NaN} def={2} scale={{min: 0, max: 2, step: 1}}
  format={i => GATES[Math.round(i)]?.label ?? NONE} onChange={i => p.set('gate', GATES[Math.round(i)]!.value)} />
const writeDial = (p: ViewProps) => <Dial {...st(p, 'writeMode')} label="Writes" does={SAYS.write} value={modeAt(p.v) ?? NaN} def={0} scale={{min: 0, max: 2, step: 1}}
  format={i => MODES[Math.round(i)]?.label ?? NONE} onChange={i => p.set('writeMode', MODES[Math.round(i)]!.value)} />
/** Hand back: lit when you edited a held item. It acts only while lit; its own key, `handBack`, asks the owner to give the items back. */
function handBackToggle(p: ViewProps) {
  const lit = handLit(p), s = st(p, 'handBack')
  return <Toggle {...s} disabled={s.disabled ?? (lit === false ? 'Nothing you edited is held.' : undefined)} tone="rec" label="Hand back" does={SAYS.handBack}
    on={lit === true} unknown={lit === undefined} onChange={lit === true ? () => p.set('handBack', true) : undefined} />
}
const radio = (p: ViewProps, key: 'gate' | 'writeMode', label: string | undefined, does: string, options: readonly Option<string>[]) =>
  <Radio {...st(p, key)} label={label} does={does} value={strOf(p.v, key) ?? ''} options={options} stack onChange={x => p.set(key, x)} />

// ---------------------------------------------------------------- the pane: what the agent holds

function HeldPane({p}: {p: ViewProps}) {
  const v = p.v, items = heldItems(v), known = has(v, 'held'), lit = boolOf(v, 'handBackLit')
  return <div className="cu-pane">
    <div className="cu-pane-head" aria-label="Custody">
      <b>Custody</b><span>gate {shown(v, 'gate')}</span><span>writes {shown(v, 'writeMode')}</span><span>{countText(v)}</span>
      <span data-lit={lit === true ? 'true' : undefined}>{lit === undefined ? `hand back ${NONE}` : lit ? 'hand back lit' : 'hand back dark'}</span>
    </div>
    <div className="cu-list" role="table" aria-label="Held items">
      <div className="cu-line cu-line--head" role="row"><span /><span>Item</span><span>Kind</span><span>State</span><span>Last changed by</span><span>Receipts</span></div>
      {!known && <p className="cu-empty">No reading of what the agent holds.</p>}
      {known && items.length === 0 && <p className="cu-empty">The agent holds nothing.</p>}
      {items.map(item => <div key={item.id} className="cu-line" role="row" data-i={`${item.name}|${item.why ?? itemTitle(item)}`}>
        <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden><Dot x={5} y={5} r={4} state={item.state} /></svg>
        <span className="cu-name">{item.name}</span>
        <span className="cu-kind">{item.kind ?? NONE}</span>
        <span className="cu-state" data-state={item.state}>{item.state?.replace('-', ' ') ?? NONE}</span>
        <span className="cu-by">{item.by ?? NONE}</span>
        <span className="cu-receipts">{item.receipts === undefined ? NONE : `${item.receipts} receipt${item.receipts === 1 ? '' : 's'}`}</span>
      </div>)}
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

const SAMPLE_PEOPLE = [{id: 'you', name: 'You'}]
/** The sample material of the gallery's fixtures: the work, files and value the agent Flint holds on the Agent device's task. The views
 * never read these: the owner's list arrives on `held`. */
const sampleHeld = (edited?: boolean) => JSON.stringify([
  {id: 'work:typecheck', name: 'Type-check the three roots', kind: 'work', state: 'in-progress', by: 'Flint', receipts: 2},
  {id: 'file:designBindings', name: 'designBindings.ts', kind: 'file', state: 'in-progress', by: 'Flint', receipts: 3},
  {id: 'file:AgentShellContext', name: 'AgentShellContext.tsx', kind: 'file', state: edited ? 'edited' : 'in-progress', by: edited ? 'you' : 'Flint', receipts: 1},
  {id: 'value:effort', name: 'Effort', kind: 'value', state: 'in-progress', by: 'Flint', receipts: 0},
  {id: 'file:harnessAgentControl', name: 'harnessAgentControl.ts', kind: 'file', state: 'blocked', by: 'Flint', receipts: 0, why: 'Waits for your approval.'},
])

/** Custody's two bands: the Whole of Custody, and the Custody page of the Agent, which carries it. On the Agent, how a write arrives
 * is Scope's (manual §16.1), so the page reads it instead of setting it. */
export function CustodyBands({p, writes = true}: {p: ViewProps; writes?: boolean}) {
  const items = heldItems(p.v), known = has(p.v, 'held')
  const rows: RowItem[] = items.map(item => ({id: item.id, name: item.name, light: item.state === undefined ? 'unknown' : 'lit', note: item.kind ?? NONE, why: item.state === 'blocked' ? (item.why ?? 'Blocked.') : undefined,
    does: itemTitle(item), mark: <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden><Dot x={5} y={5} r={4} state={item.state} /></svg>}))
  return <>
    <Band>
      <Section width={206}>
        <CustodyWell v={p.v} set={p.set} standing={p.standing} w={194} h={146} size="whole" />
      </Section>
      <Section label="Writes" grow>
        {writes ? radio(p, 'writeMode', undefined, SAYS.write, MODES)
          : <Readout label="writes" does="How a write arrives is set by Scope, the next device on the chain, and by Arm in the transport." value="as Scope allows" />}
      </Section>
    </Band>
    <Band>
      <Section width={176}>
        <Rows label="Held" does="The things the agent holds now. An orange dot: the agent works on it. A red ring: you edited it." items={known ? rows : undefined} why="No reading of what the agent holds." size={7} />
      </Section>
      <Section label="Review gate" width={78}>
        {radio(p, 'gate', undefined, `${SAYS.gate} Diffs, approvals or both.`, GATES)}
      </Section>
      <Section label="Hand back" grow>
        {handBackToggle(p)}
        <Chooser {...st(p, 'escalate')} label="Escalate to" does={SAYS.escalate} value={strOf(p.v, 'escalate') ?? ''} options={people(p.v)} onChange={x => p.set('escalate', x)} />
      </Section>
    </Band>
  </>
}

export const design: DesignedDevice = {
  id: 'software-factory:agent-custody',
  title: 'Custody',
  kind: 'effect',
  defaults: {light: 'lit', gate: 'both', writeMode: 'propose', escalate: 'you', people: JSON.stringify(SAMPLE_PEOPLE), held: sampleHeld(), handBackLit: false},
  fixtures: {
    'Both gates, five held': {},
    'You edited a file': {held: sampleHeld(true), handBackLit: true},
    'No readings': Object.fromEntries(['light', 'gate', 'writeMode', 'escalate', 'people', 'held', 'handBackLit'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Custody" light={lightOf(p)} readings={[gateWord(p.v) ?? NONE, countText(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Custody" view="compact" light={lightOf(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}>
      <CustodyWell v={p.v} set={p.set} standing={p.standing} w={140} h={146} size="compact" />
    </Section>
    <Section label="Macros" cols={2} width={124}>
      {gateDial(p)}
      {writeDial(p)}
      {handBackToggle(p)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Custody" view="whole" light={lightOf(p)} onFold={p.nav.fold} onFull={p.nav.full}><CustodyBands p={p} /></Panel>,

  full: p => <HeldPane p={p} />,

  widget: p => <Tile title="Custody" light={lightOf(p)} span={2} onFull={p.nav.full}>
    <CustodyWell v={p.v} standing={p.standing} w={104} h={100} size="mini" />
    <div className="cu-tile-side">
      <Readout big label="held" does="The items the agent holds now." value={heldCount(p.v)} tone="stall" />
      <Readout label="gate" does="What waits for you before a change lands." value={gateWord(p.v)} tone="value" />
      {handBackToggle(p)}
    </div>
  </Tile>,
}
