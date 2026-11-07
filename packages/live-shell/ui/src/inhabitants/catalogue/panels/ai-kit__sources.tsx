// Sources (manual §19.9, ai-kit:sources): what an agent reads — the sources it starts from, and where it may look for more. An effect
// before the Agent, because what an agent reads enters its context before it acts; ahead of a team's rack it is the team's shared reading,
// inside one member's chain that member's own. Live's nearest: a MIDI effect before an instrument, which shapes what the instrument
// receives. Sources says what the agent reads; Scope (§19.12), after the Agent, says what it may touch, so a source outside its Reach stays
// closed. Its drawing is the one Scope's Knowledge page carried before Sources stood on the chain: the route's reach, the switches of the
// routes, Link depth and Read budget, and the pages read with Read again and Forget.
//
// Owners, and the keys on their paths:
//   pinned       the pinned sources, each at its revision: [{id, name, kind, rev}] (kind document · page · file). Central keeps them in the
//                agent's profile; a source dragged from the browser onto the face, wherever it is drawn, adds one (`pin`).
//   src.wiki, src.project, src.code   the routes the agent may search (the wiki; the project's sources and map; the code index): your
//                switches, kept by AIKit on the placement beside the three bounds; a route switched off is neither searched nor read
//   routes       whether each route answers: [{id: wiki · project · code, state: ready · composed · refused, why?}]; a refused route names
//                its reason, and the agent then works without that source
//   searchFirst  the agent searches before it reads a file;  linkDepth  0–4 links from a hit (2);  readBudget  1–200 pages in a task (40)
//   readings     what the agent read in this run: [{id, page, source, hops, rev?, moved?}], each passage with its source, how many links
//                from a hit it stood, and whether its source moved since (Docs' Moved since, §18.5)
// Held by the hand: reading (the passage chosen in Full), pinChosen (the pin chosen in Pinned). Acts, each on its own key: open (open the
// passage's source), readAgain (read it at the new revision of its source; AIKit records the use), forget (held: drop AIKit's record of
// having used it, so the route no longer ranks it from memory — the source is untouched), each with the passage as its value; pin (a drop:
// `{type, value}`, the drag's first type other than plain text and what it carried — the owner says whether it is a source), and unpin
// (held: the chosen pin leaves the agent's profile; the source is untouched).
// A key the owner has not reported is absent: the views draw "—" and name the missing reading in the well.
import {useState, type DragEvent, type ReactNode} from 'react'
import {Action, Band, Dial, Display, Folded, Lamp, Panel, Readout, Rows, Section, Tile, Toggle, ValueBox, type LightState, type RowItem, type Tone, NoReading, unreadRows} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './ai-kit__sources.css'

type V = ViewProps['v']

const ROUTES = [{id: 'wiki', key: 'src.wiki', label: 'Wiki', does: 'The wiki.'}, {id: 'project', key: 'src.project', label: 'Project knowledge', does: 'The project\'s sources and its map.'},
  {id: 'code', key: 'src.code', label: 'Code', does: 'The code index.'}] as const
const ROUTE_TONE: Readonly<Record<string, Tone>> = {ready: 'green', composed: 'value', refused: 'stall'}
const ROUTE_WORD: Readonly<Record<string, string>> = {ready: 'Ready', composed: 'Composed', refused: 'Refused'}

interface Pinned {readonly id: string; readonly name: string; readonly kind?: string; readonly rev?: string}
interface Route {readonly id: string; readonly state?: string; readonly why?: string}
interface Reading {readonly id: string; readonly page: string; readonly source: string; readonly hops: number; readonly rev?: string; readonly moved?: boolean}

const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const text = (x: unknown): string | undefined => (typeof x === 'string' && x.length > 0 ? x : undefined)
/** A JSON list the owner reported, its rows kept where they have their identity; undefined when the key is absent or holds no list. */
function listOf<T>(v: V, key: string, keep: (row: Record<string, unknown>) => T | undefined): T[] | undefined {
  const raw = json<unknown>(v, key, undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap(row => { const t = rec(row) ? keep(row) : undefined; return t === undefined ? [] : [t] })
}
const pinnedOf = (v: V) => listOf<Pinned>(v, 'pinned', r => (text(r.id) && text(r.name) ? {id: r.id as string, name: r.name as string, kind: text(r.kind), rev: text(r.rev)} : undefined))
const routesOf = (v: V) => listOf<Route>(v, 'routes', r => (text(r.id) ? {id: r.id as string, state: text(r.state), why: text(r.why)} : undefined))
const readingsOf = (v: V) => listOf<Reading>(v, 'readings', r => (text(r.id) && text(r.page) ? {id: r.id as string, page: r.page as string, source: text(r.source) ?? NONE,
  hops: typeof r.hops === 'number' ? r.hops : 0, rev: text(r.rev), moved: r.moved === true} : undefined))

/** A route's light: lit while it answers (ready, or composed and declared), dark when refused, hollow while nobody reports it. */
const routeLight = (r: Route | undefined): LightState => (r?.state === 'ready' || r?.state === 'composed' ? 'lit' : r?.state === 'refused' ? 'dark' : 'unknown')
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const NONE_PINNED = 'No source is pinned. Drag one from the browser onto the list.'
const pinnedRows = (v: V): RowItem[] => { const list = pinnedOf(v)
  return list === undefined ? unreadRows('No reading of the pinned sources.')
    : list.map(s => ({id: s.id, name: s.name, light: 'lit', tone: 'value', note: [s.kind, s.rev].filter(Boolean).join(' · ') || NONE,
      does: `A pinned source the agent always reads from${s.rev ? `, at ${s.rev}` : ''}.`})) }
/** The routes: your switch on each, and its light — whether it answers. */
const routeRows = (v: V): RowItem[] => { const read = routesOf(v)
  return ROUTES.map(r => { const at = read?.find(x => x.id === r.id)
    return {id: r.key, name: r.label, light: routeLight(at), tone: at?.state ? ROUTE_TONE[at.state] : undefined, request: boolOf(v, r.key), note: at?.state ? ROUTE_WORD[at.state] ?? at.state : undefined,
      why: at?.state === 'refused' ? at.why ?? 'The route is refused, and gives no reason.' : undefined, does: `The agent may search ${r.does.charAt(0).toLowerCase()}${r.does.slice(1)} Its light: whether the route answers.`} }) }

/** The route's reach: a hit at the centre, a ring for each link the agent may follow from it (dashed past Link depth), and each page it
 * read where it stood, teal, or orange where its source moved since. Under it, the pages read against the Read budget. */
function RouteWell({v, w, h}: {v: V; w: number; h: number}) {
  const depth = numOf(v, 'linkDepth'), budget = numOf(v, 'readBudget'), readings = readingsOf(v)
  const cx = w / 2, cy = (h - 18) / 2 + 4, step = (Math.min(w, h - 18) / 2 - 6) / 4
  const at = (hop: number, i: number, n: number) => { const a = -Math.PI / 2 + (i + .5) * (2 * Math.PI / Math.max(1, n)) + hop * .35, r = hop * step; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const }
  const byHop = (hop: number) => (readings ?? []).filter(x => x.hops === hop)
  const read = readings?.length, bx = 8, bw = w - 16, by = h - 10
  return <Display w={w} h={h} label="What the agent may look up" corner={depth === undefined ? NONE : `${depth} link${depth === 1 ? '' : 's'}`}
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

/** A light for each route, in a line: the compact list's foot and the tile's. */
function RouteLights({v}: {v: V}) {
  const read = routesOf(v)
  return <div className="src-routes" role="group" aria-label="Routes">
    {ROUTES.map(r => { const at = read?.find(x => x.id === r.id), on = boolOf(v, r.key)
      return <span key={r.id} className="src-route" data-off={on === false ? 'true' : undefined}>
        <Lamp state={routeLight(at)} tone={at?.state ? ROUTE_TONE[at.state] : undefined} label={r.label} does={`Whether the ${r.label} route answers${on === false ? '; you turned it off' : ''}.`} why={at?.state === 'refused' ? at.why : undefined} />
        {r.label}
      </span> })}
  </div>
}

/** The three macros: Search first, Link depth and Read budget. */
function macros(p: ViewProps) {
  const v = p.v
  return {
    searchFirst: <Toggle {...st(p, 'searchFirst')} label="Search first" does="The agent searches before it reads a file." on={boolOf(v, 'searchFirst') === true} unknown={boolOf(v, 'searchFirst') === undefined} onChange={x => p.set('searchFirst', x)} />,
    linkDepth: <Dial {...st(p, 'linkDepth')} label="Link depth" does="The number of links the agent follows from a hit." value={numOf(v, 'linkDepth') ?? NaN} def={2} scale={{min: 0, max: 4, step: 1}} format={x => `${x}`} onChange={x => p.set('linkDepth', x)} />,
    readBudget: <ValueBox {...st(p, 'readBudget')} label="Read budget" does="The most pages the agent reads in one task." value={numOf(v, 'readBudget') ?? NaN} def={40} scale={{min: 1, max: 200, step: 1}} format={x => `${Math.round(x)}`} onChange={x => p.set('readBudget', Math.round(x))} />,
  }
}

const PINNED_DOES = 'The sources the agent always reads from, each at its revision. Drag a source from the browser onto the list to add it.'

/** The face takes a dropped source wherever it is drawn (the chain's plate, the pool, a pane): the drag's own type and what it carried go to
 * `pin` as they were, and the owner says whether it is a source. */
function PinDrop({p, children}: {p: ViewProps; children: ReactNode}) {
  const carried = (e: DragEvent<HTMLElement>) => Array.from(e.dataTransfer.types).find(t => t !== 'text/plain')
  return <div className="src-drop" data-refused={st(p, 'pin').refused ? 'true' : undefined}
    onDragOver={e => { if (!carried(e) || st(p, 'pin').disabled) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
    onDrop={e => {
      const type = carried(e)
      if (!type || st(p, 'pin').disabled) return
      e.preventDefault(); e.stopPropagation()
      const value = e.dataTransfer.getData(type)
      p.set('pin', JSON.stringify({type, value}))
    }}>{children}</div>
}

/** Pinned: each pin at its revision, chosen by the hand; the chosen one is unpinned by a hold. */
function PinnedList({p, size, columns, page, onPage}: {p: ViewProps; size: number; columns?: number; page?: number; onPage?: (page: number) => void}) {
  const v = p.v, chosen = strOf(v, 'pinChosen'), unpin = st(p, 'unpin')
  return <>
    <Rows does={PINNED_DOES} items={pinnedRows(v)} empty={NONE_PINNED} size={size} columns={columns} page={page} onPage={onPage} why={st(p, 'pin').refused}
      selected={chosen} onSelect={unpin.disabled ? undefined : id => p.set('pinChosen', id)} />
    <Action {...st(p, 'unpin')} hold label="Unpin" does="Take the chosen source off the agent's pins. Central keeps the profile without it; the source is untouched."
      onPress={chosen ? () => p.set('unpin', chosen) : undefined} disabled={unpin.disabled ?? (chosen ? undefined : 'Choose a pinned source first.')} />
  </>
}

function WholeView({p}: {p: ViewProps}) {
  const v = p.v, m = macros(p), [page, setPage] = useState(0), pinned = pinnedOf(v)
  return <PinDrop p={p}><Panel title="Sources" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section label={pinned ? `Pinned · ${pinned.length}` : 'Pinned'} grow>
        <PinnedList p={p} size={6} columns={2} page={page} onPage={setPage} />
      </Section>
    </Band>
    <Band>
      <Section width={168}><RouteWell v={v} w={156} h={146} /></Section>
      <Section label="Routes" width={152}>
        <Rows does="The places the agent may search. The square is your switch; the light, whether the route answers. A refused route names its reason." items={routeRows(v)}
          onRequest={(key, x) => { if (!st(p, key).disabled) p.set(key, x) }} size={3} />
        {m.searchFirst}
      </Section>
      <Section label="Bounds" grow>{m.linkDepth}{m.readBudget}</Section>
    </Band>
  </Panel></PinDrop>
}

/** Full: what the agent read in the run, passage by passage, each with its source. A source opens from its row; a passage whose source
 * moved reads again at the new revision; Forget drops AIKit's record of its use. */
function FullView({p}: {p: ViewProps}) {
  const v = p.v, readings = readingsOf(v), chosen = readings?.find(x => x.id === strOf(v, 'reading'))
  const sources = readings ? new Set(readings.map(x => x.source)).size : undefined
  return <PinDrop p={p}><div className="ref-pane-body">
    <div className="ref-doc src-doc">
      <h3>Read <small>{readings ? `${readings.length} passage${readings.length === 1 ? '' : 's'} from ${sources} source${sources === 1 ? '' : 's'} · ${readings.filter(x => x.moved).length} moved since`
        : <NoReading name="Read" why="No reading of what the agent read in this run." />}</small></h3>
      {readings && readings.length === 0 && <p className="ref-doc-lead">The agent has read nothing in this run.</p>}
      {readings && readings.length > 0 && <table className="src-read">
        <thead><tr><th>Passage</th><th>Source</th><th>Revision</th><th>Links from a hit</th><th /></tr></thead>
        <tbody>{readings.map(x => <tr key={x.id} data-moved={x.moved ? 'true' : undefined} data-chosen={x.id === chosen?.id ? 'true' : undefined} onClick={() => p.set('reading', x.id)}>
          <td><b>{x.page}</b></td><td><code>{x.source}</code></td><td>{x.rev ?? NONE}{x.moved ? ' · moved' : ''}</td><td>{x.hops}</td>
          <td className="src-acts">
            <Action {...st(p, 'open')} label="Open" does="Open this passage's source." onPress={() => p.set('open', x.id)} />
            <Action {...st(p, 'readAgain')} label="Read again" does="Read the passage at the new revision of its source. AIKit records the use." onPress={() => p.set('readAgain', x.id)}
              disabled={st(p, 'readAgain').disabled ?? (x.moved ? undefined : 'Its source has not moved.')} />
            <Action {...st(p, 'forget')} hold label="Forget" does="Drop AIKit's record of having used the passage, so the route no longer ranks it from memory. The source is untouched."
              onPress={() => p.set('forget', x.id)} />
          </td>
        </tr>)}</tbody>
      </table>}
    </div>
  </div></PinDrop>
}

export const design: DesignedDevice = {
  id: 'ai-kit:sources',
  title: 'Sources',
  kind: 'effect',
  defaults: {
    light: 'lit',
    pinned: JSON.stringify([
      {id: 'docs/SCENES.md', name: 'The scene grammar', kind: 'document', rev: 'r31'},
      {id: 'wiki:node:lantern', name: 'Lantern', kind: 'page', rev: 'r9'},
      {id: 'Expressions/Tidal/registers.md', name: 'Tidal: the scene registers', kind: 'file', rev: 'r4'}]),
    // The manual's defaults: Wiki and Project knowledge, Search first, two links, forty pages.
    'src.wiki': true, 'src.project': true, 'src.code': false, searchFirst: true, linkDepth: 2, readBudget: 40,
    routes: JSON.stringify([{id: 'wiki', state: 'ready'}, {id: 'project', state: 'ready'}, {id: 'code', state: 'composed'}]),
    reading: 'k3',
    readings: JSON.stringify([
      {id: 'k1', page: 'Lantern', source: 'wiki:node:lantern', hops: 0, rev: 'r9'},
      {id: 'k2', page: 'Tidal: the scene registers', source: 'Expressions/Tidal/registers.md', hops: 1, rev: 'r4'},
      {id: 'k3', page: 'Light that answers sound', source: 'wiki:node:light-and-sound', hops: 1, rev: 'r12', moved: true},
      {id: 'k4', page: 'The scene grammar', source: 'docs/SCENES.md', hops: 2, rev: 'r31'}]),
  },
  fixtures: {
    'An agent\'s reading': {},
    'A route refused': {routes: JSON.stringify([{id: 'wiki', state: 'refused', why: 'The knowledge capability is not active in this profile.'}, {id: 'project', state: 'ready'}, {id: 'code', state: 'composed'}]),
      readings: JSON.stringify([{id: 'k4', page: 'The scene grammar', source: 'docs/SCENES.md', hops: 0, rev: 'r31'}]), reading: undefined},
    'No readings': {light: undefined, pinned: undefined, 'src.wiki': undefined, 'src.project': undefined, 'src.code': undefined, routes: undefined, searchFirst: undefined,
      linkDepth: undefined, readBudget: undefined, reading: undefined, readings: undefined},
  },

  folded: p => { const n = pinnedOf(p.v)?.length
    return <Folded title="Sources" light={light(p)} readings={[n === undefined ? NONE : String(n)]} onUnfold={p.nav.unfold} /> },

  compact: p => { const m = macros(p)
    return <PinDrop p={p}><Panel title="Sources" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
      <Section width={176}>
        <Rows label="Pinned" does={PINNED_DOES} items={pinnedRows(p.v)} empty={NONE_PINNED} size={4} why={st(p, 'pin').refused} />
        <RouteLights v={p.v} />
      </Section>
      <Section label="Macros" width={152} cols={2}>{m.searchFirst}{m.linkDepth}{m.readBudget}</Section>
    </Panel></PinDrop> },

  whole: p => <WholeView p={p} />,

  full: p => <FullView p={p} />,

  widget: p => { const n = pinnedOf(p.v)?.length
    return <Tile title="Sources" light={light(p)} onFull={p.nav.full}>
      <div className="ref-tile-side">
        <Readout big label="pinned" does="The sources the agent always reads from." value={n} tone="value" />
        <RouteLights v={p.v} />
      </div>
    </Tile> },
}
