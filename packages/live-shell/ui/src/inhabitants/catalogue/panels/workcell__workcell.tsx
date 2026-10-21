// A workcell (manual §19.23, workcell:workcell): where agents work, set once. A workcell is one of the machine's standing tracks of
// checkouts (env-1, env-2, env-3 on a Mac), holding one seat for each project; the DLW draws it as a rack whose chain carries the road
// in and out — the Gateway (§19.2), the Remote carrier (§19.18), Git / landing with the Seat inside it (§19.16, §19.17). Every track an
// agent works on names its workcell in its In/Out section (Works in, §16.6), in every mode, so a setting made here holds for every
// agent that works here. Live's nearest: a return track, whose chain several tracks share; drawn as a rack and its chain list.
//
// Value keys. The owners report (never written from here):
//   light      'lit' | 'dark'     the register and the workcell's gateway answered; hollow when nobody reports
//   name       string             the workcell's name (`seat status --json`: workcell; Control/machines/workcells.register.json)
//   machine    string             where it runs (the Remote carrier's reading: `workcell status --json`, workcell_ref)
//   chain      [{id, name, light, reading}]  its three devices with their lights and one reading each (the devices' own owners)
//   seats      [{product, state, lane, claimedBy, workers, dirty, ahead, behind}]  one per project (`seat status --json`, SeatRow)
//   working    [{agent, track, mode}]  the agents working here now, from the claims and the gateway's sessions (`aikit gateway who`)
//   workcells  [{name, light, lane}]  every workcell the machines hold, for the tile's chips
//   frames     [{at, dir, kind, note}]  the gateway's latest frames (the Frames monitor's reading, §19.6)
// The macros reach into the chain, each written by its own device's owner:
//   transport, approvals, stallAfter  the Gateway's (kernel harness_agent_control `configure`, as actuation:gateway writes them)
//   landAs                            Git / landing's ('draft' | 'mr' | 'merge', as workcell:git-seat writes it)
// The shell holds: selected (the chain device shown beside the list), chosen (the workcell the tile shows).
import {useState} from 'react'
import {Band, Chooser, Folded, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {NONE, has, json, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './workcell__workcell.css'

type V = ViewProps['v']

interface ChainDevice {readonly id: string; readonly name: string; readonly light?: string; readonly reading?: string}
interface Seat {readonly product: string; readonly state: string; readonly lane?: string | null; readonly claimedBy?: string | null; readonly workers?: readonly string[]
  readonly dirty?: number; readonly ahead?: number; readonly behind?: number}
interface Worker {readonly agent: string; readonly track: string; readonly mode: string}
interface Cell {readonly name: string; readonly light?: string; readonly lane?: string | null}
interface Frame {readonly at: string; readonly dir: 'in' | 'out'; readonly kind: string; readonly note?: string}

const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const chainOf = (v: V) => (has(v, 'chain') ? json<unknown[]>(v, 'chain', []).filter((d): d is ChainDevice => rec(d) && typeof d.id === 'string' && typeof d.name === 'string') : undefined)
const seatsOf = (v: V) => (has(v, 'seats') ? json<unknown[]>(v, 'seats', []).filter((s): s is Seat => rec(s) && typeof s.product === 'string') : undefined)
const workingOf = (v: V) => (has(v, 'working') ? json<unknown[]>(v, 'working', []).filter((w): w is Worker => rec(w) && typeof w.agent === 'string') : undefined)
const cellsOf = (v: V) => json<unknown[]>(v, 'workcells', []).filter((c): c is Cell => rec(c) && typeof c.name === 'string')
const framesOf = (v: V) => json<unknown[]>(v, 'frames', []).filter((f): f is Frame => rec(f) && typeof f.kind === 'string')
const lightIn = (x: unknown): LightState => (x === 'lit' || x === 'dark' ? x : 'unknown')

const TRANSPORTS: readonly Option<string>[] = [{value: 'stdio', label: 'Local', does: 'A trusted child process on this machine.'},
  {value: 'ws', label: 'Network', does: 'A network link, with a token.'}, {value: 'remote', label: 'Remote', does: 'Through a connected machine, with a short-lived ticket.'}]
const APPROVALS: readonly Option<string>[] = [{value: 'ask', label: 'Ask', does: 'Ask you each time.'}, {value: 'session', label: 'Session', does: 'Allow for the session.'},
  {value: 'always', label: 'Always', does: 'Allow always. Deny stays yours.'}]
const STALLS: readonly Option<string>[] = [{value: '30', label: '30 s'}, {value: '90', label: '90 s'}, {value: '300', label: '5 min'}, {value: '1800', label: '30 min'}]
const LANDS: readonly Option<string>[] = [{value: 'draft', label: 'Draft MR', does: 'Land as a draft merge request.'}, {value: 'mr', label: 'MR', does: 'Land as a merge request.'},
  {value: 'merge', label: 'Merge', does: 'Merge into main.'}]

/** A seat's lane, as the folded head and Works in read it: the seat of the chosen product, or the first seat that holds a lane. */
const laneOf = (v: V): string | undefined => { const seats = seatsOf(v); return seats?.find(s => s.lane)?.lane ?? undefined }

/** The macros: four settings of the chain, each written by the device that holds it. */
function macros(p: ViewProps, stack: boolean) {
  const v = p.v
  return {
    transport: <Radio {...st(p, 'transport')} label="Transport" does="The Gateway's Transport: how the agents here reach their harness." value={strOf(v, 'transport') ?? ''} options={TRANSPORTS} stack={stack} onChange={x => p.set('transport', x)} />,
    approvals: <Radio {...st(p, 'approvals')} label="Approvals" does="The Gateway's Approvals: the default answer when an agent here asks permission." value={strOf(v, 'approvals') ?? ''} options={APPROVALS} stack={stack} onChange={x => p.set('approvals', x)} />,
    stall: <Chooser {...st(p, 'stallAfter')} label="Stall after" does="The Gateway's Stall after: the silence, with work pending, after which a session here counts as stalled."
      value={has(v, 'stallAfter') ? String(v.stallAfter) : ''} options={STALLS} onChange={x => p.set('stallAfter', Number(x))} />,
    land: <Chooser {...st(p, 'landAs')} label="Land as" does="Git / landing's Land as: how the work of every agent here lands." value={strOf(v, 'landAs') ?? ''} options={LANDS} onChange={x => p.set('landAs', x)} />,
  }
}

function ChainList({p, selected, onSelect}: {p: ViewProps; selected: string; onSelect: (id: string) => void}) {
  const chain = chainOf(p.v)
  const items: RowItem[] = chain
    ? chain.map(d => ({id: d.id, name: d.name, light: lightIn(d.light), note: d.reading ?? NONE, does: `${d.name}: select it to read it beside the list; ▸ on its head expands it.`}))
    : [{id: 'none', name: 'No reading of the chain', light: 'unknown'}]
  return <Rows label="Chain" does="The road in and out, in its order: the gateway, the machine, the seat and its landing." items={items} selected={selected} onSelect={chain ? onSelect : undefined} size={3} />
}

function Working({v, size = 4}: {v: V; size?: number}) {
  const working = workingOf(v)
  const items: RowItem[] = working
    ? (working.length ? working.map(w => ({id: `${w.agent}:${w.track}`, name: w.agent, light: 'lit' as LightState, note: `${w.mode} · ${w.track}`})) : [{id: 'none', name: 'Nobody works here now', light: 'dark'}])
    : [{id: 'none', name: 'No reading of who works here', light: 'unknown'}]
  return <Rows label="Working here" does="The agents working in this workcell now, each with its mode and its track. Click one to select its track." items={items} size={size} />
}

const light = (v: V, owner?: V) => lightIn(strOf(owner ?? v, 'light'))

export const design: DesignedDevice = {
  id: 'workcell:workcell',
  title: 'Workcell',
  kind: 'rack',
  defaults: {
    light: 'lit', name: 'env-1', machine: 'workcell:mac', transport: 'stdio', approvals: 'session', stallAfter: 300, landAs: 'draft',
    chain: JSON.stringify([
      {id: 'gateway', name: 'Gateway', light: 'lit', reading: 'Claude Code · local'},
      {id: 'carrier', name: 'Remote carrier', light: 'lit', reading: 'This machine'},
      {id: 'landing', name: 'Git / landing', light: 'lit', reading: 'dlw/build · 3 ahead'}]),
    seats: JSON.stringify([
      {product: 'o-i', state: 'claimed', lane: 'dlw/build', claimedBy: 'claude-code:dlw-lead', workers: ['claude-code:uiux-lane-kit'], dirty: 4, ahead: 3, behind: 0},
      {product: 'ai-kit', state: 'claimed', lane: 'reads-round-2', claimedBy: 'claude-code:dlw-lead', workers: [], dirty: 0, ahead: 1, behind: 2},
      {product: 'central', state: 'free', lane: null, claimedBy: null, workers: [], dirty: 0, ahead: 0, behind: 0},
      {product: 'workcell', state: 'free', lane: null, claimedBy: null, workers: [], dirty: 0, ahead: 0, behind: 0}]),
    working: JSON.stringify([
      {agent: 'dlw-lead', track: 'dlw/build', mode: 'Factory'}, {agent: 'uiux-lane-kit', track: 'UI/UX refinement', mode: 'Factory'},
      {agent: 'Nara', track: 'Practice', mode: 'Central'}]),
    workcells: JSON.stringify([{name: 'env-1', light: 'lit', lane: 'dlw/build'}, {name: 'env-2', light: 'lit', lane: 'dlw/uiux-kit-motion'},
      {name: 'env-3', light: 'dark', lane: null}, {name: 'omarchy · env-1', light: 'lit', lane: 'ql/m-ledger'}]),
    frames: JSON.stringify([
      {at: '14:02:01', dir: 'out', kind: 'prompt.submit', note: 'Type-check the three TypeScript roots'},
      {at: '14:02:02', dir: 'in', kind: 'message.delta', note: 'I will read the agent context first.'},
      {at: '14:02:09', dir: 'in', kind: 'tool.call', note: 'Bash · tsc --noEmit'},
      {at: '14:02:31', dir: 'in', kind: 'heartbeat', note: ''}]),
  },
  fixtures: {
    'Two lanes at work': {},
    'Remote, nobody here': {name: 'omarchy · env-1', machine: 'workcell:omarchy', transport: 'remote', approvals: 'ask',
      chain: JSON.stringify([{id: 'gateway', name: 'Gateway', light: 'lit', reading: 'Claude Code · remote'}, {id: 'carrier', name: 'Remote carrier', light: 'lit', reading: 'Omarchy · 41 ms'},
        {id: 'landing', name: 'Git / landing', light: 'dark', reading: 'No lane'}]),
      seats: JSON.stringify([{product: 'o-i', state: 'free', lane: null}, {product: 'quaternal-logic', state: 'free', lane: null}]), working: '[]'},
    'No reading': {light: undefined, name: undefined, machine: undefined, chain: undefined, seats: undefined, working: undefined, frames: undefined,
      transport: undefined, approvals: undefined, stallAfter: undefined, landAs: undefined},
  },

  folded: p => <Folded title={strOf(p.v, 'name') ?? 'Workcell'} light={light(p.v, p.owner)} readings={[laneOf(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <CompactView p={p} />,

  whole: p => <WholeView p={p} />,

  full: p => <FullView p={p} />,

  widget: p => <WidgetView p={p} />,
}

function CompactView({p}: {p: ViewProps}) {
    const [selected, setSelected] = useState('gateway'), m = macros(p, true)
    return <Panel title={strOf(p.v, 'name') ?? 'Workcell'} view="compact" light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
      <Section width={196}><ChainList p={p} selected={selected} onSelect={setSelected} /></Section>
      <Section label="Macros" width={92}>{m.transport}</Section>
      <Section width={92}>{m.approvals}{m.stall}{m.land}</Section>
    </Panel>
}

function WholeView({p}: {p: ViewProps}) {
    const [selected, setSelected] = useState('gateway'), m = macros(p, true), chosen = chainOf(p.v)?.find(d => d.id === selected)
    return <Panel title={strOf(p.v, 'name') ?? 'Workcell'} view="whole" light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full}>
      <Band>
        <Section width={196}>
          <ChainList p={p} selected={selected} onSelect={setSelected} />
          <Readout label={chosen?.name ?? 'device'} does="The selected device's own reading. Its settings open on its head, ▸." value={chosen?.reading} />
        </Section>
        <Section label="Gateway" width={92}>{m.transport}</Section>
        <Section width={92}>{m.approvals}{m.stall}</Section>
        <Section label="Landing" width={92}>{m.land}<Readout label="machine" does="Where the workcell runs: the Remote carrier's reading." value={strOf(p.v, 'machine')} /></Section>
        <Section grow><Working v={p.v} /></Section>
      </Band>
    </Panel>
}

function FullView({p}: {p: ViewProps}) {
    const seats = seatsOf(p.v), frames = framesOf(p.v)
    return <div className="ref-pane-body ref-doc">
      <h3>{strOf(p.v, 'name') ?? NONE} <small>{strOf(p.v, 'machine') ?? NONE} · {seats ? `${seats.filter(s => s.lane).length} of ${seats.length} seats hold a lane` : 'no reading of the seats'}</small></h3>
      <table className="wc-seats">
        <thead><tr><th>Project</th><th>Lane</th><th>Held by</th><th>Co-workers</th><th>Uncommitted</th><th>Against main</th></tr></thead>
        <tbody>{(seats ?? []).map(s => <tr key={s.product} data-free={s.lane ? undefined : 'true'}>
          <td><b>{s.product}</b></td><td>{s.lane ?? 'free'}</td><td>{s.claimedBy ?? NONE}</td><td>{s.workers?.length ? s.workers.join(', ') : NONE}</td>
          <td>{s.dirty ?? NONE}</td><td>{s.ahead === undefined ? NONE : `${s.ahead} ahead · ${s.behind ?? 0} behind`}</td>
        </tr>)}</tbody>
      </table>
      <div className="wc-pane-side">
        <section><h4>Working here</h4>
          {workingOf(p.v)?.length ? <ul className="wc-list">{workingOf(p.v)!.map(w => <li key={`${w.agent}:${w.track}`}><b>{w.agent}</b> <span>{w.mode} · {w.track}</span></li>)}</ul>
            : <p className="ref-doc-lead">{workingOf(p.v) ? 'Nobody works here now.' : 'No reading of who works here.'}</p>}
        </section>
        <section><h4>The gateway's latest frames</h4>
          {frames.length ? <ul className="wc-list wc-frames">{frames.map((f, i) => <li key={i}><span>{f.at}</span> <b data-dir={f.dir}>{f.dir === 'in' ? '←' : '→'} {f.kind}</b> <span>{f.note}</span></li>)}</ul>
            : <p className="ref-doc-lead">No reading of the frames.</p>}
        </section>
      </div>
    </div>
}

function WidgetView({p}: {p: ViewProps}) {
    const cells = cellsOf(p.v), here = strOf(p.v, 'name')
    const [chosen, setChosen] = useState(here ?? cells[0]?.name ?? '')
    const cell = cells.find(c => c.name === chosen)
    return <Tile title="Workcells" light={light(p.v, p.owner)} span={2} onFull={p.nav.full}><div className="wc-tile">
      <div className="wc-chips" role="radiogroup" aria-label="Workcell">
        {cells.map(c => <button key={c.name} type="button" role="radio" aria-checked={c.name === chosen} className="wc-chip" data-light={lightIn(c.light)}
          data-i={`${c.name}|${c.lane ? `Lane ${c.lane}.` : 'No lane.'} Click to show it.`} onClick={() => setChosen(c.name)}>{c.name}</button>)}
      </div>
      <div className="wc-tile-body">
        <p className="wc-tile-lane" data-i="Lane|The lane the chosen workcell's seat holds."><b>{cell ? (cell.lane ?? 'free') : NONE}</b>{chosen === here && strOf(p.v, 'machine') ? ` · ${strOf(p.v, 'machine')}` : ''}</p>
        {chosen === here && (workingOf(p.v)?.slice(0, 2) ?? []).map(w => <p key={`${w.agent}:${w.track}`} className="wc-tile-who"
          data-i={`${w.agent}|Working here: ${w.mode} · ${w.track}. Click to select its track.`}><i />{w.agent} <span>{w.mode} · {w.track}</span></p>)}
        {chosen === here && (workingOf(p.v)?.length ?? 0) > 2 && <p className="wc-tile-who"><span>+{workingOf(p.v)!.length - 2} more</span></p>}
      </div>
    </div></Tile>
}
