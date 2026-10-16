// The Gateways rack (manual §19.3, actuation:gateways-rack): every gateway the work can reach, as chains on the Main track. Live's
// nearest: an Audio Effect Rack and its chain list. A rack has no wave to draw, so the chain list is the picture: each gateway's
// state light, its name and its transport. The square beside a chain chooses it (the shell holds that choice, as it does for the
// Skillset rack's chain); Whole, Full and Open show the chosen gateway.
//
// Value keys. The shell holds:  chain (the id of the chosen chain).
// The owners report:  light (lit · dark), chains (a JSON list of {id, name, transport?, state?, why?, reach?, signIn?, secrecy?};
//   state is ready · composed · refused — Composed and Refused are AIKit's own standing words, gateway_modes.rs Standing; Ready is
//   a gateway that answered its read, kernel HarnessAgentRead), peers (observers attached to the chosen gateway), frames (a JSON
//   list of {seq?, dir, kind, session, at, note} for the chosen gateway).
// The owner is asked to write:  fanOut (0 to 8 observers per session; no owner carries it yet).
// A key the owner has not reported is absent, and the view draws "—" for it and names it in words.
import {useState} from 'react'
import {Action, Band, Dial, Folded, Lamp, Panel, Readout, Rows, Section, Tile, type LightState, type RowItem, type Tone} from '../../sdk/panel'
import {has, json, NONE, numOf, strOf, type DesignedDevice, type ViewProps} from './design'
import './actuation__gateways-rack.css'

type V = ViewProps['v']
type State = 'ready' | 'composed' | 'refused'

// ---------------------------------------------------------------- fixed vocabulary (not the owner's data)

const FAN_MAX = 8, FAN_DEFAULT = 2
/** What each state is called, and what it means (AIKit's standing words: Composed, Refused; a gateway that answered is Ready). */
const STATE_WORD: Record<State, string> = {ready: 'Ready', composed: 'Composed', refused: 'Refused'}
const STATE_SAYS: Record<State, string> = {
  ready: 'Ready: the gateway answered a read. A session can use it now.',
  composed: 'Composed: declared, and nobody has tried it from end to end.',
  refused: 'Refused: the owner refused it.',
}
const SAYS = {
  list: 'The square marks the chain you chose. The light is the owner\'s reading: green ready, amber composed, faint refused.',
  fanOut: 'How many observers may watch each session on the chosen gateway, beside the shell. A slow observer loses only its own feed.',
  open: 'Open the chosen gateway full in a pane.',
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
}
const text = (x: unknown) => (typeof x === 'string' && x.length > 0 ? x : undefined)

/** The chains the owner reports, kept only where they have a shape. Nothing in a bad list can throw. */
const chainsOf = (v: V): Chain[] => {
  const raw = json<unknown>(v, 'chains', [])
  if (!Array.isArray(raw)) return []
  return raw.flatMap((c): Chain[] => {
    if (!c || typeof c !== 'object') return []
    const r = c as Record<string, unknown>
    const id = text(r.id), name = text(r.name)
    if (!id || !name) return []
    const state = r.state === 'ready' || r.state === 'composed' || r.state === 'refused' ? r.state : undefined
    return [{id, name, state, transport: text(r.transport), why: text(r.why), reach: text(r.reach), signIn: text(r.signIn), secrecy: text(r.secrecy)}]
  })
}
/** A rack always has one chosen chain: the one held, else the first. */
const chosenOf = (v: V, chains: readonly Chain[]): Chain | undefined => chains.find(c => c.id === strOf(v, 'chain')) ?? chains[0]
const readyCount = (chains: readonly Chain[]) => chains.filter(c => c.state === 'ready').length
const lightOf = (p: ViewProps): LightState => {
  const s = strOf(p.owner ?? p.v, 'light')
  return s === 'lit' || s === 'dark' ? s : 'unknown'
}
/** The light of a chain: green ready, amber composed, dark refused, hollow when the owner has not said. */
const lampOf = (state: State | undefined): {light: LightState; tone: Tone} =>
  state === 'ready' ? {light: 'lit', tone: 'green'} : state === 'composed' ? {light: 'lit', tone: 'accent'} : state === 'refused' ? {light: 'dark', tone: 'accent'} : {light: 'unknown', tone: 'accent'}
const stateTone = (state: State | undefined): Tone | undefined => (state === 'ready' ? 'green' : state === 'composed' ? 'accent' : undefined)
const countLine = (chains: readonly Chain[]) => (chains.length === 0 ? NONE : `${readyCount(chains)}/${chains.length}`)
const attached = (v: V) => {
  const n = numOf(v, 'peers'), cap = numOf(v, 'fanOut')
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

/** The chain list: the rack's picture. The square chooses the chain; the light is the owner's reading; the note is the transport. */
function ChainList({p, size = 4}: {p: ViewProps; size?: number}) {
  const [page, setPage] = useState(0)
  const chains = chainsOf(p.v), chosen = chosenOf(p.v, chains)
  const items: RowItem[] = chains.map(c => ({
    id: c.id, name: c.name, ...lampOf(c.state), request: c.id === chosen?.id, why: c.state === 'refused' ? c.why : undefined,
    note: c.transport, does: c.state ? STATE_SAYS[c.state] : 'No reading of this chain yet.',
  }))
  return <Rows label={chains.length === 0 ? 'Chains' : `Chains · ${countLine(chains)} ready`} does={SAYS.list} items={items} size={size} page={page} onPage={setPage}
    onRequest={id => p.set('chain', id)} />
}

/** The reason of each refused chain stays under the list. */
function Reasons({v}: {v: V}) {
  const chains = chainsOf(v)
  if (chains.length === 0) return <p className="gr-none">No reading of the chains.</p>
  const refused = chains.filter(c => c.state === 'refused')
  return refused.length === 0 ? null : <div className="gr-reasons" aria-label="Reasons">
    {refused.map(c => <p key={c.id}><b>{c.name}</b> {c.why ?? 'The owner gave no reason.'}</p>)}
  </div>
}

/** Fan-out and the observers it allows: one light for each, lit for each one attached. */
function Lights({v}: {v: V}) {
  const cap = numOf(v, 'fanOut'), peers = numOf(v, 'peers')
  if (cap === undefined) return <span className="gr-lights-none">No reading</span>
  const n = Math.max(0, Math.min(FAN_MAX, Math.round(cap)))
  return <span className="gr-lights" role="img" aria-label={peers === undefined ? `${n} observers allowed` : `${peers} of ${n} observers attached`}
    data-i={`Observers|One light for each observer allowed. A lit light is one attached${peers === undefined ? '; the owner reports none' : ''}.`}>
    {Array.from({length: n}, (_, i) => <Lamp key={i} tone="value" state={peers === undefined ? 'unknown' : i < peers ? 'lit' : 'dark'} />)}
  </span>
}

const fanDial = (p: ViewProps) => <Dial label="Fan-out" does={SAYS.fanOut} value={numOf(p.v, 'fanOut') ?? NaN} def={FAN_DEFAULT}
  scale={{min: 0, max: FAN_MAX, step: 1}} format={x => `${Math.round(x)}`} onChange={x => p.set('fanOut', Math.round(x))} {...st(p, 'fanOut')} />

const attachedReadout = (v: V) => <Readout label="attached" does="Observers attached to the chosen gateway, of the observers allowed." value={attached(v)} tone="value" />

const openAction = (p: ViewProps, chosen: Chain | undefined) => <Action label="Open" does={SAYS.open}
  onPress={chosen && p.nav.full ? p.nav.full : undefined} disabled={!chosen ? 'No chain is chosen.' : !p.nav.full ? 'A pane cannot open here.' : undefined} {...st(p, 'open')} />

/** The terms of one gateway: who can reach it, how it signs them in, what protects the link. A term the owner did not give is "—". */
function Terms({chain}: {chain: Chain | undefined}) {
  if (!chain) return <p className="gr-none">No reading of the chain.</p>
  const rows: readonly [string, string | undefined, string][] = [
    ['Reach', chain.reach, 'Who can reach the gateway.'],
    ['Sign-in', chain.signIn, 'How the gateway knows who connects.'],
    ['Secrecy', chain.secrecy, 'What protects the link.'],
  ]
  return <dl className="gr-terms">
    {rows.map(([k, x, says]) => <div key={k} style={{display: 'contents'}} data-i={`${k}|${says}${x === undefined ? ' The owner gave none.' : ''}`}>
      <dt>{k}</dt><dd data-none={x === undefined ? 'true' : undefined}>{x ?? NONE}</dd>
    </div>)}
  </dl>
}

const head = (p: ViewProps) => ({light: lightOf(p), onFold: p.nav.fold, onFull: p.nav.full})

// ---------------------------------------------------------------- the pane: the chosen gateway at full size

function GatewayPane({v}: {v: V}) {
  const chains = chainsOf(v), chosen = chosenOf(v, chains)
  if (!chosen) return <div className="gr-pane"><div className="gr-strip"><span className="gr-strip-none">Gateways</span></div>
    <div className="gr-body" data-none="true"><p className="gr-empty">No reading of the chains.</p></div></div>
  const frames = framesOf(v)
  const state = chosen.state
  return <div className="gr-pane">
    <div className="gr-strip" aria-label="Chains">
      {chains.map(c => <span key={c.id} className="gr-chip" aria-current={c.id === chosen.id ? 'true' : undefined}>
        <Lamp state={lampOf(c.state).light} tone={lampOf(c.state).tone} label={c.state ? `${c.name}: ${STATE_WORD[c.state]}` : `${c.name}: no reading`} />{c.name}
      </span>)}
    </div>
    <div className="gr-body">
      <div className="gr-frames">
        <div className="gr-frames-head" aria-label="The gateway"><b>{chosen.name}</b><span>{chosen.transport ?? NONE}</span><span>{state ? STATE_WORD[state] : NONE}</span></div>
        {frames.length === 0 ? <p className="gr-empty">No reading of the frames.</p> : <ol className="gr-list" aria-label="Frames">
          {frames.map((f, i) => <li key={`${f.session}:${f.seq ?? 'out'}:${i}`} className="gr-frame" data-dir={f.dir} data-kind={kindClass(f.kind)}>
            <span className="gr-seq">{f.seq ?? NONE}</span><span className="gr-at">{f.at}</span>
            <span className="gr-dir" aria-label={f.dir === 'out' ? 'Sent' : 'Received'}>{f.dir === 'out' ? '→' : '←'}</span>
            <span className="gr-kind">{f.kind}</span><span className="gr-session">{f.session}</span><span className="gr-note">{f.note}</span>
          </li>)}
        </ol>}
      </div>
      <aside className="gr-reads" aria-label="Readings">
        <section className="gr-read"><h4>Readiness</h4>
          <strong data-state={state ?? 'none'}>{state ? STATE_WORD[state] : NONE}</strong>
          <p>{state === 'refused' ? (chosen.why ?? 'The owner gave no reason.') : state ? STATE_SAYS[state].split(': ')[1] : 'No reading of the state.'}</p></section>
        <section className="gr-read"><h4>Terms</h4>
          <p>reach <b>{chosen.reach ?? NONE}</b></p>
          <p>sign-in <b>{chosen.signIn ?? NONE}</b></p>
          <p>secrecy <b>{chosen.secrecy ?? NONE}</b></p></section>
        <section className="gr-read"><h4>Observers</h4>
          <strong data-state={has(v, 'peers') ? undefined : 'none'}>{attached(v) ?? NONE}</strong>
          <p>attached, of the observers allowed</p>
          <Lights v={v} /></section>
      </aside>
    </div>
  </div>
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

/** The four chains the manifest declares (actuationFamilyManifest.ts gateways-rack), with their standing as AIKit words it. */
const CHAINS = [
  {id: 'hermes', name: 'Hermes gateway', transport: 'ws', state: 'ready', reach: 'this machine', signIn: 'a token, or a 30 s ticket'},
  {id: 'aikit-agency-gateway', name: 'AIKit agency gateway', transport: 'unix', state: 'ready', reach: 'local processes the file mode admits', signIn: 'file mode: owner scope', secrecy: 'none needed; stays in the kernel'},
  {id: 'actuation-frank', name: 'Actuation gateway', transport: 'tailnet', state: 'composed', signIn: 'a grant for each attach'},
  {id: 'remote-carrier', name: 'Remote carrier', transport: 'Workcell', state: 'refused', why: 'Refused by default. Terminate TLS in front, then widen the bind on purpose.',
    reach: 'anyone who can route to it', signIn: 'bearer token only', secrecy: 'none unless TLS is terminated in front'},
]

/** Every key the owners report: the "No readings" fixture drops all of them. */
const KEYS = ['light', 'chain', 'chains', 'fanOut', 'peers', 'frames']
const NOTHING: Record<string, undefined> = Object.fromEntries(KEYS.map(k => [k, undefined]))

export const design: DesignedDevice = {
  id: 'actuation:gateways-rack',
  title: 'Gateways',
  kind: 'rack',
  defaults: {
    light: 'lit', chain: 'hermes', fanOut: FAN_DEFAULT, peers: 1,
    chains: JSON.stringify(CHAINS), frames: JSON.stringify(FRAMES),
  },
  fixtures: {
    'Hermes chosen': {},
    'Remote carrier chosen': {chain: 'remote-carrier', peers: undefined, frames: undefined},
    'No readings': NOTHING,
  },

  folded: p => {
    const chains = chainsOf(p.v)
    return <Folded title="Gateways" light={lightOf(p)} readings={[chains.length === 0 ? NONE : `${readyCount(chains)}/${chains.length} ready`]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title="Gateways" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={224}>
      <ChainList p={p} />
      <Reasons v={p.v} />
    </Section>
    <Section label="Observers" cols={2}>
      {fanDial(p)}
      {attachedReadout(p.v)}
      <Lights v={p.v} />
    </Section>
  </Panel>,

  whole: p => {
    const chosen = chosenOf(p.v, chainsOf(p.v))
    return <Panel title="Gateways" view="whole" {...head(p)}>
      <Band>
        <Section label="Chains" width={224}>
          <ChainList p={p} />
          <Reasons v={p.v} />
        </Section>
        <Section label="Gateway" cols={3} grow>
          <p className="gr-chosen" data-none={chosen ? undefined : 'true'}>{chosen ? chosen.name : 'No chain chosen'}</p>
          <Readout label="state" does="Whether the chosen gateway can carry a session now. A refusal gives its reason under the list." value={chosen?.state ? STATE_WORD[chosen.state] : undefined} tone={stateTone(chosen?.state)} />
          <Readout label="transport" does="How a session reaches the chosen gateway." value={chosen?.transport} />
          {openAction(p, chosen)}
        </Section>
      </Band>
      <Band>
        <Section label="Observers" cols={2}>
          {fanDial(p)}
          {attachedReadout(p.v)}
          <Lights v={p.v} />
        </Section>
        <Section label="Terms" grow>
          <Terms chain={chosen} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <GatewayPane v={p.v} />,

  widget: p => {
    const chains = chainsOf(p.v)
    return <Tile title="Gateways" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <div className="gr-tile-list"><ChainList p={p} /></div>
      <div className="gr-tile-side">
        <Readout big label="ready" does="Chains whose gateway answered a read, of all the chains." value={chains.length === 0 ? undefined : countLine(chains)} tone="green" />
        <Readout label="attached" does="Observers attached to the chosen gateway, of the observers allowed." value={attached(p.v)} tone="value" />
      </div>
    </Tile>
  },
}
