// Scope (manual §19.12): how far an agent may reach into your world, and how its writes arrive. Live's nearest: Utility — a small
// effect of few controls whose meaning is plain at a glance. The rings are the picture: teal is what the agent may read, amber
// what it may write. Raising the reach asks you first: the new reach waits, dashed, until you confirm it.
// Its Knowledge page (manual §19.12 Knowledge) decides what the agent may look up, inside the Reach. The owner is AIKit's knowledge route
// (the kernel's `knowledge` op: status, search, read, use): Sources (`src.wiki`, `src.project`, `src.code`), Search first (`searchFirst`),
// Link depth (`linkDepth`, 0–4), Read budget (`readBudget`, 1–200 pages), and the reading Route (`route`: ready | composed | refused,
// with the owner's reason `routeWhy`). `readings` [{id, page, source, hops, rev?, moved?}] are the pages the agent read, each with its
// source, how many links from a hit it stood, and whether its source moved since (Docs' Moved since, §18.5); `reading` is the one
// chosen. Read again (`readAgain`) reads it at the new revision of its source and AIKit records the use; Forget (`forget`, held) drops
// AIKit's record of having used it — no kernel request forgets a use yet.
// A read place's square is your include or exclude of it in the world (`r:<id>`: true included, false excluded; Central's world relations
// keep it, central.world-relations.save), as Context & world's toggles were before Scope carried them (lock §0.3.5); its standing says why
// a place takes no request. A place the owner reports no request for has no square.
import {useState} from 'react'
import {Action, Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, type LightState, type RowItem, unreadRows} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
const RINGS = ['Object', 'Scene', 'Expression', 'Central']
const MODES = [{value: 'propose', label: 'Propose', does: 'A write arrives as a proposal that waits.'}, {value: 'draft', label: 'Draft', does: 'A write arrives in a draft that you review.'},
  {value: 'direct', label: 'Direct', does: 'A write goes into the thing itself, with a receipt.'}] as const

/** A place the agent may read or write, on its ring (0 object … 3 Central); the binding supplies both lists. */
interface Place {readonly id: string; readonly name: string; readonly ring: number; readonly receipts?: number}
const reads = (v: V) => json<Place[]>(v, 'reads', [])
const writes = (v: V) => json<Place[]>(v, 'writes', [])
const reach = (v: V) => numOf(v, 'reach')
const writeRing = (v: V) => {
  const r = reach(v), wanted = writes(v).filter(w => v[`w:${w.id}`] !== false).map(w => w.ring)
  return r === undefined || !wanted.length ? undefined : Math.min(r, Math.max(...wanted))
}
const readRows = (p: ViewProps): RowItem[] => reads(p.v).map(r => ({id: r.id, name: r.name, light: reach(p.v) === undefined ? 'unknown' : r.ring <= reach(p.v)! ? 'lit' : 'dark', tone: 'value',
  note: ['obj', 'scene', 'expr', 'world'][r.ring] ?? NONE, request: boolOf(p.v, `r:${r.id}`), why: st(p, `r:${r.id}`).disabled}))
/** Include or exclude a read place, where its owner takes the request. */
const askRead = (p: ViewProps) => (id: string, x: boolean) => { if (!st(p, `r:${id}`).disabled) p.set(`r:${id}`, x) }
const writeRows = (v: V): RowItem[] => writes(v).map(w => {
  const request = v[`w:${w.id}`] !== false, r = reach(v)
  return {id: w.id, name: w.name, request, light: r === undefined ? 'unknown' : request && w.ring <= r ? 'lit' : 'dark', tone: 'accent', note: w.receipts === undefined ? NONE : `${w.receipts}`,
    why: r !== undefined && request && w.ring > r ? 'Outside the reach.' : undefined}
})
/** Receipts, summed from the writes the binding reports; absent when it reports none. */
const receipts = (v: V) => (has(v, 'writes') && writes(v).some(w => w.receipts !== undefined) ? writes(v).reduce((n, w) => n + (w.receipts ?? 0), 0) : undefined)

/** The rings: the reach for reads tinted teal, the reach for writes tinted amber. The handle sets the reach. With no reading of
 * the reach, the rings stand bare and say so. */
function Rings({v, set, w, h, labels}: {v: V; set?: ViewProps['set']; w: number; h: number; labels: boolean}) {
  const cx = w / 2, cy = h / 2 + (labels ? 4 : 0), step = (Math.min(w, h) / 2 - 8) / 4, r = (i: number) => step * (i + 1)
  const now = reach(v), pending = v.reachPending === undefined ? null : Number(v.reachPending), at = pending ?? now ?? 0, wr = writeRing(v)
  const angle = -Math.PI / 4, hx = cx + r(at) * Math.cos(angle), hy = cy + r(at) * Math.sin(angle)
  return <g>
    {now !== undefined && <circle cx={cx} cy={cy} r={r(now)} fill="var(--fizz)" fillOpacity={.1} />}
    {wr !== undefined && <circle cx={cx} cy={cy} r={r(wr)} fill="var(--accent)" fillOpacity={.13} />}
    {RINGS.map((name, i) => <g key={name}>
      <circle cx={cx} cy={cy} r={r(i)} className="dp-faint" />
      {labels && <text x={cx} y={cy - r(i) + 9} className="dp-axis" textAnchor="middle">{name.toLowerCase()}</text>}
    </g>)}
    {/* the read arc over the top, the write arc under the bottom */}
    {now !== undefined && <path d={`M${cx - r(now)} ${cy}A${r(now)} ${r(now)} 0 0 1 ${cx + r(now)} ${cy}`} fill="none" stroke="var(--dp-value)" strokeWidth={2} />}
    {wr !== undefined && <path d={`M${cx + r(wr)} ${cy}A${r(wr)} ${r(wr)} 0 0 1 ${cx - r(wr)} ${cy}`} fill="none" stroke="var(--dp-on)" strokeWidth={2} />}
    {pending !== null && <circle cx={cx} cy={cy} r={r(pending)} fill="none" stroke="var(--dp-value)" strokeDasharray="3 3" strokeWidth={1.4} />}
    {now === undefined && pending === null && w > 90 && <text x={cx} y={h - 6} className="dp-ink-dim" textAnchor="middle">No reading of the reach</text>}
    {set && <Handle x={hx} y={hy} label="Reach" does="Drag out or in: the widest part of the world the agent may touch. Raising it asks you first." tone="value"
      onDrag={(x, y) => ask(v, set)(Math.round(clampTo(0, 3, Math.hypot(x - cx, y - cy) / step - 1)))} />}
  </g>
}

/** A reach you set: a raise, or any reach while the owner has not reported one, waits for Confirm; a narrowing goes at once. */
const ask = (v: V, set: ViewProps['set']) => (x: number) => {
  const now = reach(v)
  if (now === undefined || x > now) set('reachPending', x)
  else { set('reach', x); set('reachPending', undefined) }
}

/** The consent pair under a raised reach: the raise waits until you confirm it. */
function Consent({p}: {p: ViewProps}) {
  if (p.v.reachPending === undefined) return null
  return <div className="ref-pair">
    <Action {...st(p, 'reach')} hold label="Confirm" does={`Raise the reach to ${RINGS[Number(p.v.reachPending)] ?? NONE}.`} onPress={() => { p.set('reach', Number(p.v.reachPending)); p.set('reachPending', undefined) }} />
    <Action label="Cancel" does="Keep the reach as it is." onPress={() => p.set('reachPending', undefined)} />
  </div>
}

// The light reads the owner alone; hollow while it has not said.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const ringName = (x: number | undefined) => (x === undefined ? undefined : RINGS[x])
const litCount = (rows: RowItem[], v: V, key: string) => (has(v, key) && reach(v) !== undefined ? rows.filter(r => r.light === 'lit').length : undefined)
const modeLabel = (v: V) => MODES.find(m => m.value === strOf(v, 'writeMode'))?.label

// ---------------------------------------------------------------- Knowledge: what the agent may look up

const SOURCES = [{key: 'src.wiki', label: 'Wiki', does: 'The wiki.'}, {key: 'src.project', label: 'Project knowledge', does: 'The project\'s sources and its map.'},
  {key: 'src.code', label: 'Code', does: 'The code index.'}] as const
const ROUTE_TONE: Readonly<Record<string, 'green' | 'value' | 'stall'>> = {ready: 'green', composed: 'value', refused: 'stall'}
interface Reading {readonly id: string; readonly page: string; readonly source: string; readonly hops: number; readonly rev?: string; readonly moved?: boolean}
const readingsOf = (v: V): Reading[] | undefined => {
  if (!has(v, 'readings')) return undefined
  const raw = json<unknown>(v, 'readings', [])
  return Array.isArray(raw) ? raw.flatMap(x => { const r = x as Record<string, unknown>
    return r && typeof r.id === 'string' && typeof r.page === 'string' ? [{id: r.id, page: r.page, source: typeof r.source === 'string' ? r.source : NONE, hops: typeof r.hops === 'number' ? r.hops : 0,
      rev: typeof r.rev === 'string' ? r.rev : undefined, moved: r.moved === true}] : [] }) : []
}

/** The route's reach: a hit at the centre, a ring for each link the agent may follow from it (dashed past Link depth), and each page it
 * read where it stood, teal, or orange where its source moved since. Under it, the pages read against the Read budget. */
function RouteWell({v, w, h}: {v: V; w: number; h: number}) {
  const depth = numOf(v, 'linkDepth'), budget = numOf(v, 'readBudget'), readings = readingsOf(v)
  const cx = w / 2, cy = (h - 18) / 2 + 4, step = (Math.min(w, h - 18) / 2 - 6) / 4
  const at = (hop: number, i: number, n: number) => { const a = -Math.PI / 2 + (i + .5) * (2 * Math.PI / Math.max(1, n)) + hop * .35, r = hop * step; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const }
  const byHop = (hop: number) => (readings ?? []).filter(x => x.hops === hop)
  const read = readings?.length, bx = 8, bw = w - 16, by = h - 10
  return <Display w={w} h={h} label="What the agent may look up" corner={ringName(reach(v)) ?? NONE}
    does="A hit at the centre and a ring for each link the agent may follow from it: dashed past Link depth. Each page the agent read stands where it was found, orange where its source moved. Under it, the pages read against the budget.">
    {[1, 2, 3, 4].map(i => <circle key={i} cx={cx} cy={cy} r={i * step} fill="none" className="dp-faint" strokeDasharray={depth === undefined || i > depth ? '2 3' : undefined} />)}
    <circle cx={cx} cy={cy} r={3.5} fill="var(--dp-value)" />
    {readings?.map(x => { const ring = byHop(x.hops), [px, py] = at(x.hops, ring.indexOf(x), ring.length)
      return <circle key={x.id} cx={px} cy={py} r={3} fill={x.moved ? 'var(--stall)' : 'var(--dp-value)'} opacity={x.hops > (depth ?? 4) ? .4 : 1} data-i={`${x.page}|${x.source}${x.rev ? ` at ${x.rev}` : ''}.${x.moved ? ' Its source moved since.' : ''}`} /> })}
    {readings === undefined && <text x={cx} y={cy + 16} className="dp-ink-dim" textAnchor="middle">No reading of the pages read</text>}
    <rect x={bx} y={by - 4} width={bw} height={5} className="dp-faint" fill="none" />
    {read !== undefined && budget !== undefined && <rect x={bx} y={by - 4} width={bw * clampTo(0, 1, read / budget)} height={5} fill="var(--dp-value)" />}
    <text x={bx} y={by - 7} className="dp-axis">{read === undefined || budget === undefined ? 'pages read' : `${read} of ${budget} pages`}</text>
  </Display>
}

function KnowledgeBands({p}: {p: ViewProps}) {
  const v = p.v, readings = readingsOf(v), chosen = readings?.find(x => x.id === strOf(v, 'reading')), [page, setPage] = useState(0), route = strOf(v, 'route')
  const toggle = (key: string, label: string, does: string) => <Toggle {...st(p, key)} key={key} label={label} does={does} on={boolOf(v, key) === true} unknown={boolOf(v, key) === undefined} onChange={x => p.set(key, x)} />
  const rows: RowItem[] = readings === undefined ? unreadRows('No reading of the pages the agent read.')
    : readings.length === 0 ? [{id: 'none', name: 'The agent has read nothing yet', light: 'dark'}]
    : readings.map(x => ({id: x.id, name: x.page, light: x.moved ? 'dark' : 'lit', tone: x.moved ? 'stall' : 'value', note: x.moved ? 'moved' : x.rev ?? x.source,
      does: `From ${x.source}${x.rev ? ` at ${x.rev}` : ''}, ${x.hops} link${x.hops === 1 ? '' : 's'} from a hit.${x.moved ? ' Its source moved since: Read again reads it at the new revision.' : ''}`}))
  return <>
    <Band>
      <Section width={168}><RouteWell v={v} w={156} h={146} /></Section>
      <Section label="Sources" width={112}>
        {SOURCES.map(s => toggle(s.key, s.label, `The agent may search ${s.does.charAt(0).toLowerCase()}${s.does.slice(1)}`))}
        {toggle('searchFirst', 'Search first', 'The agent searches before it reads a file.')}
      </Section>
      <Section label="Bounds" grow>
        <Dial {...st(p, 'linkDepth')} label="Link depth" does="The number of links the agent follows from a hit." value={numOf(v, 'linkDepth') ?? NaN} def={2} scale={{min: 0, max: 4, step: 1}} format={x => `${x}`} onChange={x => p.set('linkDepth', x)} />
        <ValueBox {...st(p, 'readBudget')} label="Read budget" does="The most pages the agent reads in one task." value={numOf(v, 'readBudget') ?? NaN} def={40} scale={{min: 1, max: 200, step: 1}} format={x => `${Math.round(x)}`} onChange={x => p.set('readBudget', Math.round(x))} />
        <Readout label="route" does={`Whether the route answers: ready, composed, or refused with its reason.${strOf(v, 'routeWhy') ? ` ${strOf(v, 'routeWhy')}` : ''}`}
          value={route} tone={route ? ROUTE_TONE[route] : undefined} />
      </Section>
    </Band>
    <Band>
      <Section grow><Rows label={readings ? `Pages read · ${readings.length}, ${readings.filter(x => x.moved).length} moved` : 'Pages read'}
        does="Each page the agent read, with its source. Orange: its source moved since. Choose one to read it again or to forget it." items={rows} size={7} page={page} onPage={setPage}
        selected={chosen?.id} onSelect={readings?.length ? id => p.set('reading', id) : undefined} /></Section>
      <Section label="Reading" width={104}>
        <Action {...st(p, 'readAgain')} label="Read again" does="Reads the chosen page at the new revision of its source. AIKit records the use."
          onPress={chosen ? () => p.set('readAgain', chosen.id) : undefined} disabled={st(p, 'readAgain').disabled ?? (chosen ? undefined : 'Choose a page first.')} />
        <Action {...st(p, 'forget')} hold label="Forget" does="Drops AIKit's record of having used the page, so the route no longer ranks it from memory. The source is untouched."
          onPress={chosen ? () => p.set('forget', chosen.id) : undefined} disabled={st(p, 'forget').disabled ?? (chosen ? undefined : 'Choose a page first.')} />
      </Section>
    </Band>
  </>
}

const SAMPLE_READS: Place[] = [
  {id: 'lantern', name: 'Lantern (object)', ring: 0}, {id: 'scene', name: 'This scene', ring: 1}, {id: 'registers', name: 'Scene registers', ring: 1},
  {id: 'tidal', name: 'Tidal (Expression)', ring: 2}, {id: 'wiki', name: 'Central wiki', ring: 3},
]
const SAMPLE_WRITES: Place[] = [
  {id: 'lantern', name: 'Lantern (object)', ring: 0, receipts: 3}, {id: 'layers', name: 'Scene layers', ring: 1, receipts: 1}, {id: 'tidal', name: 'Tidal (Expression)', ring: 2, receipts: 0},
]

export const scope: DesignedDevice = {
  id: 'software-factory:context-write-mode',
  title: 'Scope',
  kind: 'effect',
  defaults: {light: 'lit', reach: 1, writeMode: 'propose', basis: 'r15 → r17',
    reads: JSON.stringify(SAMPLE_READS), writes: JSON.stringify(SAMPLE_WRITES),
    // Your include or exclude of each read place, as the world's relations keep it: the Expression you set aside is excluded.
    'r:lantern': true, 'r:scene': true, 'r:registers': true, 'r:tidal': false, 'r:wiki': true,
    // Knowledge: the manual's defaults (Wiki and Project knowledge, Search first, two links, forty pages) and the route's readings.
    'src.wiki': true, 'src.project': true, 'src.code': false, searchFirst: true, linkDepth: 2, readBudget: 40, route: 'ready', reading: 'k3',
    readings: JSON.stringify([
      {id: 'k1', page: 'Lantern', source: 'wiki:node:lantern', hops: 0, rev: 'r9'},
      {id: 'k2', page: 'Tidal: the scene registers', source: 'Expressions/Tidal/registers.md', hops: 1, rev: 'r4'},
      {id: 'k3', page: 'Light that answers sound', source: 'wiki:node:light-and-sound', hops: 1, rev: 'r12', moved: true},
      {id: 'k4', page: 'The scene grammar', source: 'docs/SCENES.md', hops: 2, rev: 'r31'},
    ])},
  firstPage: 'reach',
  fixtures: {
    'A scene in reach': {},
    'Route refused': {route: 'refused', routeWhy: 'The knowledge capability is not active in this profile.', readings: JSON.stringify([])},
    'No readings': {light: undefined, reach: undefined, writeMode: undefined, basis: undefined, reads: undefined, writes: undefined,
      'src.wiki': undefined, 'src.project': undefined, 'src.code': undefined, searchFirst: undefined, linkDepth: undefined, readBudget: undefined, route: undefined, reading: undefined, readings: undefined},
  },

  folded: p => <Folded title="Scope" light={light(p)} readings={[ringName(reach(p.v)) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Scope" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="Reach" does="Teal: what the agent may read. Amber: what it may write." corner={shown(p.v, 'basis')}>
        <Rings v={p.v} set={p.set} w={140} h={146} labels={false} />
      </Display>
    </Section>
    <Section label="Macros" cols={2}>
      <Dial {...st(p, 'reach')} label="Reach" does="The widest part of the world the agent may touch. Raising it asks you first." value={reach(p.v) ?? NaN} def={1}
        scale={{min: 0, max: 3, step: 1}} format={x => RINGS[x]!} onChange={ask(p.v, p.set)} pending={p.v.reachPending !== undefined || st(p, 'reach').pending} />
      <Radio {...st(p, 'writeMode')} label="Write mode" does="How a write arrives." value={strOf(p.v, 'writeMode') ?? ''} options={MODES} stack onChange={x => p.set('writeMode', x)} />
      <Readout label="reads" does="Places the agent may read. Click the plate to choose them." value={litCount(readRows(p), p.v, 'reads')} tone="value" onPress={p.nav.select} />
      <Readout label="writes" does="Places the agent may write. Click the plate to choose them." value={litCount(writeRows(p.v), p.v, 'writes')} tone="accent" onPress={p.nav.select} />
    </Section>
  </Panel>,

  whole: p => <ScopeWhole p={p} />,

  full: p => {
    const w = 760, h = 420
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The world the agent may touch">
        <g className="dp-display" style={{background: 'none'}}>
          <Rings v={p.v} w={w} h={h} labels />
          {writes(p.v).filter(x => (x.receipts ?? 0) > 0).map((x, i) => {
            const step = (h / 2 - 8) / 4, rr = step * (x.ring + 1) - step / 2, a = -2.4 + i * .9
            return <g key={x.id}>
              <rect x={w / 2 + rr * Math.cos(a) - 7} y={h / 2 + 4 + rr * Math.sin(a) - 7} width={14} height={14} fill="var(--dp-on)" />
              <text x={w / 2 + rr * Math.cos(a)} y={h / 2 + 4 + rr * Math.sin(a) + 3.5} textAnchor="middle" style={{font: '700 9px var(--font-ui)', fill: 'var(--on-accent)'}}>{x.receipts}</text>
              <text x={w / 2 + rr * Math.cos(a) + 11} y={h / 2 + 4 + rr * Math.sin(a) + 3.5} className="dp-ink">{x.name}</text>
            </g>
          })}
          {!has(p.v, 'writes') && <text x={18} y={h - 16} className="dp-ink-dim">No reading of the places the agent wrote</text>}
        </g>
      </svg>
    </div>
  },

  widget: p => <Tile title="Scope" light={light(p)} onFull={p.nav.full}>
    <Display w={64} h={64} label="Reach"><Rings v={p.v} w={64} h={64} labels={false} /></Display>
    <div className="ref-tile-side">
      <Readout label="reach" value={ringName(reach(p.v))} tone="value" />
      <Readout label="writes" value={modeLabel(p.v)} tone="accent" />
      <Readout label="receipts" value={receipts(p.v)} />
    </div>
  </Tile>,
}

function ScopeWhole({p}: {p: ViewProps}) {
  const [readPage, setReadPage] = useState(0)
  const at = p.v.reachPending ?? reach(p.v)
  const page = p.page === 'knowledge' ? 'knowledge' : 'reach'
  return <Panel title="Scope" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} page={page} onPage={p.setPage}
    pages={[{id: 'reach', label: 'Reach'}, {id: 'knowledge', label: 'Knowledge', light: (strOf(p.v, 'route') === undefined ? undefined : strOf(p.v, 'route') === 'refused' ? 'dark' : 'lit') as LightState | undefined}]}>
    {page === 'knowledge' ? <KnowledgeBands p={p} /> : <>
    <Band>
      <Section width={168}>
        <Display w={156} h={146} label="Reach" does="Teal: what the agent may read. Amber: what it may write. Drag the handle to set the reach." corner={shown(p.v, 'basis')}>
          <Rings v={p.v} set={p.set} w={156} h={146} labels />
        </Display>
      </Section>
      <Section label="Reach" width={96}>
        <Radio {...st(p, 'reach')} does="The widest part of the world the agent may touch. Raising it asks you first." value={at === undefined ? '' : String(at)}
          options={RINGS.map((name, i) => ({value: String(i), label: name}))} stack onChange={x => ask(p.v, p.set)(Number(x))} pending={p.v.reachPending !== undefined || st(p, 'reach').pending} />
        <Consent p={p} />
      </Section>
      <Section label="Writes arrive" grow>
        <Radio {...st(p, 'writeMode')} does="How a write arrives." value={strOf(p.v, 'writeMode') ?? ''} options={MODES} stack onChange={x => p.set('writeMode', x)} />
        <Readout big label="receipts" does="One receipt for each write the agent made." value={receipts(p.v)} tone="accent" />
      </Section>
    </Band>
    <Band>
      <Section width={132}>
        <Rows label="Reads" waiting={st(p, 'reads').waiting} why="No reading of the places the agent may read." does="The places the agent may read. A teal light marks a place in reach. The square is your request: pressed, the world includes the place; open, it excludes it."
          items={has(p.v, 'reads') ? readRows(p) : undefined} onRequest={askRead(p)} size={7} page={readPage} onPage={setReadPage} />
      </Section>
      <Section width={132}>
        <Rows label={has(p.v, 'writes') ? 'Writes · receipts' : 'Writes'} waiting={st(p, 'writes').waiting} why="No reading of the places the agent may write." does="The places the agent may write. The square is your request; amber marks a place in reach." items={has(p.v, 'writes') ? writeRows(p.v) : undefined}
          onRequest={(id, x) => p.set(`w:${id}`, x)} size={7} />
      </Section>
      <Section label="Basis" grow>
        <Readout label="basis" does="The revision the agent started from, and the revision of its edits." value={strOf(p.v, 'basis')} />
      </Section>
    </Band>
    </>}
  </Panel>
}
