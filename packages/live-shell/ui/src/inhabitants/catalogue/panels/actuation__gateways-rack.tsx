// Gateways (manual §19.3, actuation:gateways-rack): every gateway your agents can come in through, and the state each is in. A monitor
// (manual §16.3): it stands on the rail and in a pane, and has two views; it reads and opens, and changes no gateway's settings (each
// workcell's Gateway holds its own). Live's nearest: a rack's chain list, one line for each chain with its light. The tile is one line
// for each gateway with its state dot, beside the count of ready gateways and the observers attached; a line pressed there opens that
// gateway in Full. Full's head carries the count of ready gateways and of those in use, with Selected and Show; its body is the list —
// each gateway with its transport, its state and its reason when refused, its observers and the workcells it serves — beside the
// selected gateway's readiness and its latest frames, drawn as the Frames monitor draws them (§19.6).
//
// Value keys. The shell holds:  chain (Selected: the id of the gateway Full shows), show (all · ready · inuse).
// The owners report:  light (lit · dark), chains (a JSON list of {id, name, transport?, state?, why?, reach?, signIn?, secrecy?, observers?,
//   workcells?}; state is ready · composed · refused — Composed and Refused are AIKit's own standing words, gateway_modes.rs Standing;
//   Ready is a gateway that answered its read, kernel HarnessAgentRead; observers is the Fan-out each workcell's Gateway sets for its
//   sessions (actuation__gateway.tsx fanOut), read here and never written; workcells the workcells whose chain the gateway heads),
//   peers (observers attached to the selected gateway), frames (a JSON list of {seq?, dir, kind, session, at, note} for the selected
//   gateway).
// A key the owner has not reported is absent, and the view draws "—" for it and names it in words.
import {Chooser, Lamp, Radio, Readout, Rows, Tile, type LightState, type Option, type RowItem, type Tone} from '../../sdk/panel'
import {has, json, NONE, numOf, railAndPane, strOf, type ViewProps} from './design'
import {MonitorHead, MonitorPane} from './monitor'
import './actuation__gateways-rack.css'

type V = ViewProps['v']
type State = 'ready' | 'composed' | 'refused'

// ---------------------------------------------------------------- fixed vocabulary (not the owner's data)

const FAN_MAX = 8
/** What each state is called, and what it means (AIKit's standing words: Composed, Refused; a gateway that answered is Ready). */
const STATE_WORD: Record<State, string> = {ready: 'Ready', composed: 'Composed', refused: 'Refused'}
const STATE_SAYS: Record<State, string> = {
  ready: 'Ready: the gateway answered a read. A session can use it now.',
  composed: 'Composed: declared, and nobody has tried it from end to end.',
  refused: 'Refused: the owner refused it.',
}
const SHOWS: readonly Option<string>[] = [
  {value: 'all', label: 'All', does: 'List every gateway.'},
  {value: 'ready', label: 'Ready', does: 'List only the gateways that answered a read.'},
  {value: 'inuse', label: 'In use', does: 'List only the gateways a workcell uses.'},
]
const SAYS = {
  list: 'One line for each gateway. The light is the owner\'s reading: green ready, amber composed, faint refused. Press a line to open it in Full.',
  selected: 'The gateway whose frames and readiness Full shows.',
  show: 'Lists every gateway, only the ready ones, or only those a workcell uses.',
}

// ---------------------------------------------------------------- readings

interface Chain {
  readonly id: string
  readonly name: string
  readonly transport?: string
  readonly state?: State
  readonly why?: string
  readonly reach?: string
  readonly signIn?: string
  readonly secrecy?: string
  /** The observers each session may have, as the workcell's Gateway sets it. */
  readonly observers?: number
  /** The workcells whose chain the gateway heads; undefined when the owner does not say. */
  readonly workcells?: readonly string[]
}
const text = (x: unknown) => (typeof x === 'string' && x.length > 0 ? x : undefined)

/** The gateways the owner reports, kept only where they have a shape. Nothing in a bad list can throw. */
const chainsOf = (v: V): Chain[] => {
  const raw = json<unknown>(v, 'chains', [])
  if (!Array.isArray(raw)) return []
  return raw.flatMap((c): Chain[] => {
    if (!c || typeof c !== 'object') return []
    const r = c as Record<string, unknown>
    const id = text(r.id), name = text(r.name)
    if (!id || !name) return []
    const state = r.state === 'ready' || r.state === 'composed' || r.state === 'refused' ? r.state : undefined
    const observers = typeof r.observers === 'number' && Number.isFinite(r.observers) ? Math.max(0, Math.min(FAN_MAX, Math.round(r.observers))) : undefined
    const workcells = Array.isArray(r.workcells) ? r.workcells.filter((w): w is string => typeof w === 'string' && w.length > 0) : undefined
    return [{id, name, state, transport: text(r.transport), why: text(r.why), reach: text(r.reach), signIn: text(r.signIn), secrecy: text(r.secrecy), observers, workcells}]
  })
}
const inUse = (c: Chain) => (c.workcells?.length ?? 0) > 0
/** The gateways Show lets through. */
const listedOf = (v: V, chains: readonly Chain[]): Chain[] => {
  const show = strOf(v, 'show')
  return chains.filter(c => (show === 'ready' ? c.state === 'ready' : show === 'inuse' ? inUse(c) : true))
}
/** The selected gateway: the one held, else the first that is ready, else the first. */
const chosenOf = (v: V, chains: readonly Chain[]): Chain | undefined => chains.find(c => c.id === strOf(v, 'chain')) ?? chains.find(c => c.state === 'ready') ?? chains[0]
const readyCount = (chains: readonly Chain[]) => chains.filter(c => c.state === 'ready').length
const lightOf = (p: ViewProps): LightState => {
  const s = strOf(p.owner ?? p.v, 'light')
  return s === 'lit' || s === 'dark' ? s : 'unknown'
}
/** The light of a gateway: green ready, amber composed, dark refused, hollow when the owner has not said. */
const lampOf = (state: State | undefined): {light: LightState; tone: Tone} =>
  state === 'ready' ? {light: 'lit', tone: 'green'} : state === 'composed' ? {light: 'lit', tone: 'accent'} : state === 'refused' ? {light: 'dark', tone: 'accent'} : {light: 'unknown', tone: 'accent'}
const countLine = (chains: readonly Chain[]) => (chains.length === 0 ? NONE : `${readyCount(chains)}/${chains.length}`)
const attached = (v: V, chosen: Chain | undefined) => {
  const n = numOf(v, 'peers'), cap = chosen?.observers
  return n === undefined ? undefined : cap === undefined ? `${n}` : `${n} of ${cap}`
}

interface Frame {seq?: number; dir: 'in' | 'out'; kind: string; session: string; at: string; note: string}
/** The frames the owner reports, kept only where they have a shape. */
const framesOf = (v: V): Frame[] => {
  const raw = json<unknown>(v, 'frames', [])
  if (!Array.isArray(raw)) return []
  return raw.flatMap((f): Frame[] => {
    if (!f || typeof f !== 'object') return []
    const r = f as Record<string, unknown>
    if (typeof r.kind !== 'string') return []
    return [{seq: typeof r.seq === 'number' ? r.seq : undefined, dir: r.dir === 'out' ? 'out' : 'in', kind: r.kind,
      session: text(r.session) ?? NONE, at: text(r.at) ?? NONE, note: typeof r.note === 'string' ? r.note : ''}]
  })
}
const kindClass = (kind: string) => (kind.startsWith('approval') ? 'approval' : kind.includes('error') ? 'error' : kind.startsWith('tool') ? 'tool' : undefined)

// ---------------------------------------------------------------- the parts

const st = (p: ViewProps, key: string) => p.standing?.[key] ?? {}
const select = (p: ViewProps) => (id: string) => { p.set('chain', id); p.nav.full?.() }

/** The tile's list: one line for each gateway Show lets through, its state dot, its name and its transport. A press opens it in Full. */
function TileList({p}: {p: ViewProps}) {
  const chains = chainsOf(p.v), listed = listedOf(p.v, chains), chosen = chosenOf(p.v, chains)
  if (chains.length === 0) return <p className="gr-none">No reading of the gateways.</p>
  const items: RowItem[] = listed.map(c => ({id: c.id, name: c.name, ...lampOf(c.state), why: c.state === 'refused' ? (c.why ?? 'The owner gave no reason.') : undefined,
    note: c.transport, does: c.state ? STATE_SAYS[c.state] : 'No reading of this gateway yet.'}))
  return listed.length === 0 ? <p className="gr-none">No gateway to show.</p>
    : <Rows does={SAYS.list} items={items} size={5} selected={chosen?.id} onSelect={select(p)} />
}

/** Observers: one light for each a session may have, lit for each one attached. */
function Lights({v, chosen}: {v: V; chosen: Chain | undefined}) {
  const cap = chosen?.observers, peers = numOf(v, 'peers')
  if (cap === undefined) return <span className="gr-lights-none">No reading</span>
  return <span className="gr-lights" role="img" aria-label={peers === undefined ? `${cap} observers allowed` : `${peers} of ${cap} observers attached`}
    data-i={`Observers|One light for each observer a session may have, as the workcell's Gateway sets it. A lit light is one attached${peers === undefined ? '; the owner reports none' : ''}.`}>
    {Array.from({length: cap}, (_, i) => <Lamp key={i} tone="value" state={peers === undefined ? 'unknown' : i < peers ? 'lit' : 'dark'} />)}
  </span>
}

/** Full's head: the gateways ready and in use; Selected and Show. */
function Head({p}: {p: ViewProps}) {
  const chains = chainsOf(p.v), chosen = chosenOf(p.v, chains)
  return <MonitorHead title="Gateways" readings={[
    {label: 'ready', value: chains.length ? countLine(chains) : undefined, does: 'Gateways that answered a read, of all the gateways.', tone: 'green'},
    {label: 'in use', value: chains.length && chains.some(c => c.workcells !== undefined) ? chains.filter(inUse).length : undefined, does: 'Gateways a workcell uses.'},
  ]} controls={<>
    <Chooser {...st(p, 'chain')} label="Selected" does={SAYS.selected} value={chosen?.id ?? ''} options={chains.map(c => ({value: c.id, label: c.name}))} onChange={x => p.set('chain', x)}
      disabled={st(p, 'chain').disabled ?? (chains.length ? undefined : 'No reading of the gateways.')} />
    <Radio {...st(p, 'show')} label="Show" does={SAYS.show} value={strOf(p.v, 'show') ?? ''} options={SHOWS} onChange={x => p.set('show', x)} />
  </>} />
}

/** Every gateway Show lets through: its state, its transport, the reason a refused one gives, its observers and its workcells. A
 * press selects it. */
function List({p}: {p: ViewProps}) {
  const chains = chainsOf(p.v), listed = listedOf(p.v, chains), chosen = chosenOf(p.v, chains)
  return <section className="gr-list" aria-label="Gateways">
    {chains.length === 0 ? <p className="gr-empty">No reading of the gateways.</p> : listed.length === 0 ? <p className="gr-empty">No gateway to show.</p>
      : listed.map(c => { const lamp = lampOf(c.state)
        return <button key={c.id} type="button" className="gr-line" aria-pressed={c.id === chosen?.id} data-state={c.state} onClick={() => p.set('chain', c.id)}
          data-i={`${c.name}|${c.state ? STATE_SAYS[c.state] : 'No reading of this gateway yet.'} Press to show its frames and readiness.`}>
          <Lamp state={lamp.light} tone={lamp.tone} />
          <b>{c.name}</b>
          <span className="gr-line-state">{c.state ? STATE_WORD[c.state] : NONE}</span>
          <span className="gr-line-reads">
            <span><small>over</small> {c.transport ?? NONE}</span>
            <span><small>observers</small> {c.observers ?? NONE}</span>
            <span><small>workcells</small> {c.workcells === undefined ? NONE : c.workcells.length ? c.workcells.join(', ') : 'none'}</span>
          </span>
          {c.state === 'refused' && <span className="gr-line-why">{c.why ?? 'The owner gave no reason.'}</span>}
        </button> })}
  </section>
}

/** The selected gateway: its readiness, its terms and its observers, over its latest frames. */
function Selected({v}: {v: V}) {
  const chains = chainsOf(v), chosen = chosenOf(v, chains)
  if (!chosen) return <section className="gr-side"><p className="gr-empty">No gateway selected.</p></section>
  const frames = framesOf(v), state = chosen.state
  return <section className="gr-side" aria-label={chosen.name}>
    <div className="gr-reads">
      <section className="gr-read"><h4>Readiness</h4>
        <strong data-state={state ?? 'none'}>{state ? STATE_WORD[state] : NONE}</strong>
        <p>{state === 'refused' ? (chosen.why ?? 'The owner gave no reason.') : state ? STATE_SAYS[state].split(': ')[1] : 'No reading of the state.'}</p></section>
      <section className="gr-read"><h4>Terms</h4>
        <p>reach <b>{chosen.reach ?? NONE}</b></p>
        <p>sign-in <b>{chosen.signIn ?? NONE}</b></p>
        <p>secrecy <b>{chosen.secrecy ?? NONE}</b></p></section>
      <section className="gr-read"><h4>Observers</h4>
        <strong data-state={has(v, 'peers') ? undefined : 'none'}>{attached(v, chosen) ?? NONE}</strong>
        <p>attached, of those allowed</p>
        <Lights v={v} chosen={chosen} /></section>
    </div>
    <div className="gr-frames-head" aria-label="Its latest frames"><b>Frames</b><span>{chosen.transport ?? NONE}</span><span>{frames.length ? `${frames.length} latest` : NONE}</span></div>
    {frames.length === 0 ? <p className="gr-empty">No reading of the frames.</p> : <ol className="gr-frames" aria-label="Frames">
      {frames.map((f, i) => <li key={`${f.session}:${f.seq ?? 'out'}:${i}`} className="gr-frame" data-dir={f.dir} data-kind={kindClass(f.kind)}>
        <span className="gr-seq">{f.seq ?? NONE}</span><span className="gr-at">{f.at}</span>
        <span className="gr-dir" aria-label={f.dir === 'out' ? 'Sent' : 'Received'}>{f.dir === 'out' ? '→' : '←'}</span>
        <span className="gr-kind">{f.kind}</span><span className="gr-session">{f.session}</span><span className="gr-note">{f.note}</span>
      </li>)}
    </ol>}
  </section>
}

// ---------------------------------------------------------------- the device

const FRAMES = [
  {dir: 'out', kind: 'prompt.submit', session: 'build-lane', at: '14:02:01', note: 'Type-check the three TypeScript roots'},
  {seq: 381, dir: 'in', kind: 'message.start', session: 'build-lane', at: '14:02:01', note: ''},
  {seq: 382, dir: 'in', kind: 'message.delta', session: 'build-lane', at: '14:02:02', note: 'I will read the agent context first.'},
  {seq: 383, dir: 'in', kind: 'tool.start', session: 'build-lane', at: '14:02:04', note: 'Read · src/agent/AgentShellContext.tsx'},
  {seq: 384, dir: 'in', kind: 'tool.complete', session: 'build-lane', at: '14:02:04', note: 'Read · 412 lines'},
  {seq: 385, dir: 'in', kind: 'approval.request', session: 'build-lane', at: '14:02:09', note: 'Bash waits for you'},
  {dir: 'out', kind: 'approval.respond', session: 'build-lane', at: '14:02:12', note: 'allow once'},
  {seq: 41, dir: 'in', kind: 'status.update', session: 'review-lane', at: '14:02:15', note: 'reading the diff'},
]

/** The four gateways the manifest declares (actuationFamilyManifest.ts gateways-rack), with their standing as AIKit words it, the
 * observers each workcell's Gateway allows, and the workcells whose chain each heads. */
const CHAINS = [
  {id: 'hermes', name: 'Hermes gateway', transport: 'ws', state: 'ready', reach: 'this machine', signIn: 'a token, or a 30 s ticket', observers: 2, workcells: ['env-1', 'env-2']},
  {id: 'aikit-agency-gateway', name: 'AIKit agency gateway', transport: 'unix', state: 'ready', reach: 'local processes the file mode admits', signIn: 'file mode: owner scope', secrecy: 'none needed; stays in the kernel',
    observers: 4, workcells: ['env-3']},
  {id: 'actuation-frank', name: 'Actuation gateway', transport: 'tailnet', state: 'composed', signIn: 'a grant for each attach', workcells: []},
  {id: 'remote-carrier', name: 'Remote carrier', transport: 'Workcell', state: 'refused', why: 'Refused by default. Terminate TLS in front, then widen the bind on purpose.',
    reach: 'anyone who can route to it', signIn: 'bearer token only', secrecy: 'none unless TLS is terminated in front', workcells: []},
]

/** Every key the owners report: the "No readings" fixture drops all of them. */
const KEYS = ['light', 'chain', 'show', 'chains', 'peers', 'frames']
const NOTHING: Record<string, undefined> = Object.fromEntries(KEYS.map(k => [k, undefined]))

export const design = railAndPane({
  id: 'actuation:gateways-rack',
  title: 'Gateways',
  kind: 'monitor',
  defaults: {
    light: 'lit', chain: 'hermes', show: 'all', peers: 1,
    chains: JSON.stringify(CHAINS), frames: JSON.stringify(FRAMES),
  },
  fixtures: {
    'Hermes chosen': {},
    'Remote carrier chosen': {chain: 'remote-carrier', peers: undefined, frames: undefined},
    'No readings': NOTHING,
  },

  full: p => <MonitorPane label="Gateways" head={<Head p={p} />}><div className="gr-body"><List p={p} /><Selected v={p.v} /></div></MonitorPane>,

  widget: p => {
    const chains = chainsOf(p.v)
    return <Tile title="Gateways" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <div className="gr-tile-list"><TileList p={p} /></div>
      <div className="gr-tile-side">
        <Readout big label="ready" does="Gateways that answered a read, of all the gateways." value={chains.length === 0 ? undefined : countLine(chains)} tone="green" />
        <Readout label="attached" does="Observers attached to the selected gateway, of those its sessions may have." value={attached(p.v, chosenOf(p.v, chains))} tone="value" />
      </div>
    </Tile>
  },
})
