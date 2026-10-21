// Decision helper (manual §19.20, ai-kit:decision-helper): the small model a team's members put typed questions to, when the rules
// leave a choice open among labels the owner allows. Live's nearest: a MIDI effect such as Scale, which can only ever answer with a
// note the scale allows. The owners:
//   Provider, model, place, state, price: AIKit's decision provider (`aikit decide status`, aikit.decision-status/v1: selected_model,
//     placement, mode, install.state, limits.timeout_ms ≤ 120 s, tariff "none", independent_of_acting_models). Provider is the
//     election: none, a managed local model, a self-hosted endpoint, or the hosted API (`aikit decide`). Probe is `status --probe`.
//   Hosting: `hosted` {ref, endpoint, health, availability, lifetime} is the service that serves the model, as Workcell keeps it:
//     its declared services (`workcell doctor --json` declared_services; `workcell system --json` services.declared: logical_ref,
//     endpoint, health healthy | degraded | unavailable, availability, lifetime target-owned | managed), the one whose endpoint is
//     the provider's `where`. AIKit says whether the model is loaded; Workcell says whether its service answers. No kernel route
//     reaches Workcell's services yet (the kernel reads Workcell only through workcell_status_read and material_read); a provider
//     Workcell does not host leaves `hosted` absent.
//   The question: one unresolved head of a ql.agent-decision-frame/v1 (QL-MEF schemas/ql-agent-contracts-v1.schema.json): its field,
//     its labels with their owner refs, its cardinality and its ambiguity policy (preserve-candidates, abstain, single-if-supported).
//     What the rules settle stands in the frame's `determined` and is never asked; a frame with no unresolved head makes no call.
//   The answer: a ql.agent-determination/v1 — status (determined, partial, unresolved, unavailable, refused, stale), the learned
//     labels with their confidence, what the engine validated and the candidates it refused, each with its reason.
//   Instruments and admission: the team space (QL-MEF crates/ql-mef/src/team_space.rs; ANIMA-ALETHEIA-TEAMS.md §10.4) — the typed
//     frames over each cell's closed label sets, and the seven rules. Admission is per instrument and measured (rule 2); gate 6 is the
//     person's and refuses a model answer, abstention included (rule 7).
// The picture is the spread: one bar for each label the head allows, as tall as the helper's confidence in it; the labels it picked
// are lit; the corner says what the engine did with the answer.
import {useState} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type RowItem, type Scale, type Tone} from '../../sdk/panel'
import {NONE, has, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './ai-kit__decision-helper.css'

type V = ViewProps['v']

// Fixed vocabulary: the elections, the times, the states. None of it is the owner's data.
const PROVIDERS = [
  {value: 'none', label: 'None', does: 'No helper. Every open question goes back to the member who asked it.'},
  {value: 'local', label: 'This machine', does: 'A small model served on this machine. Nothing it reads leaves the machine.'},
  {value: 'endpoint', label: 'Your endpoint', does: 'A model you serve yourself, at an address you give.'},
  {value: 'hosted', label: 'Hosted', does: 'A hosted decision service. What it reads leaves the machine.'},
] as const
const WHEN = [
  {value: 'background', label: 'Background', does: 'The act goes on. The answer joins it as evidence if it comes before the deadline.'},
  {value: 'before', label: 'Before the act', does: 'The act waits for the answer, up to the deadline.'},
] as const
const DEADLINE: Scale = {min: 1, max: 120, log: true}
const STATUS: Record<string, {label: string; tone?: Tone}> = {
  determined: {label: 'Picked', tone: 'accent'}, partial: {label: 'Part picked', tone: 'accent'}, unresolved: {label: 'Abstained'},
  unavailable: {label: 'Unavailable', tone: 'stall'}, refused: {label: 'Refused', tone: 'stall'}, stale: {label: 'Stale', tone: 'stall'},
}
const ENGINE: Record<string, {label: string; tone?: Tone}> = {validated: {label: 'Validated', tone: 'green'}, kept: {label: 'Kept as given'}, refused: {label: 'Refused', tone: 'stall'}, waiting: {label: 'Checking'}}
const POLICY: Record<string, string> = {'preserve-candidates': 'Keep candidates', abstain: 'Abstain', 'single-if-supported': 'One if supported'}

// ---------------------------------------------------------------- what the owners report

interface Label {readonly id: string; readonly description: string}
interface Ask {readonly instrument: string; readonly member: string; readonly cf: string; readonly field: string; readonly labels: readonly Label[]; readonly min: number; readonly max: number; readonly policy: string}
interface Answer {readonly status: string; readonly scores: Readonly<Record<string, number>>; readonly picked: readonly string[]; readonly ms?: number; readonly engine?: string; readonly reason?: string}
interface Instrument {readonly id: string; readonly organ: string; readonly name: string; readonly cf?: string; readonly labels: readonly string[]; readonly person?: boolean; readonly built?: boolean; readonly admitted?: boolean}
interface Entry {readonly at: string; readonly member: string; readonly instrument: string; readonly picked: readonly string[]; readonly status: string; readonly engine: string}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])

function askOf(v: V): Ask | undefined {
  const a = json<unknown>(v, 'ask', null)
  if (!isObj(a) || typeof a.instrument !== 'string' || !Array.isArray(a.labels)) return undefined
  const labels = a.labels.flatMap(l => (isObj(l) && typeof l.id === 'string' ? [{id: l.id, description: typeof l.description === 'string' ? l.description : l.id}] : []))
  return {instrument: a.instrument, member: typeof a.member === 'string' ? a.member : NONE, cf: typeof a.cf === 'string' ? a.cf : NONE, field: typeof a.field === 'string' ? a.field : NONE,
    labels, min: typeof a.min === 'number' ? a.min : 0, max: typeof a.max === 'number' ? a.max : 1, policy: typeof a.policy === 'string' ? a.policy : NONE}
}
function answerOf(v: V): Answer | undefined {
  const a = json<unknown>(v, 'answer', null)
  if (!isObj(a) || typeof a.status !== 'string') return undefined
  const scores = isObj(a.scores) ? Object.fromEntries(Object.entries(a.scores).filter(([, x]) => typeof x === 'number')) as Record<string, number> : {}
  return {status: a.status, scores, picked: strs(a.picked), ms: typeof a.ms === 'number' ? a.ms : undefined, engine: typeof a.engine === 'string' ? a.engine : undefined, reason: typeof a.reason === 'string' ? a.reason : undefined}
}
const instrumentsOf = (v: V): Instrument[] | undefined => {
  if (!has(v, 'instruments')) return undefined
  const raw = json<unknown>(v, 'instruments', [])
  return Array.isArray(raw) ? raw.flatMap(x => (isObj(x) && typeof x.id === 'string' && typeof x.name === 'string'
    ? [{id: x.id, organ: typeof x.organ === 'string' ? x.organ : NONE, name: x.name, cf: typeof x.cf === 'string' ? x.cf : undefined, labels: strs(x.labels),
      person: x.person === true, built: x.built !== false, admitted: x.admitted === true}] : [])) : []
}
const logOf = (v: V): Entry[] | undefined => {
  if (!has(v, 'log')) return undefined
  const raw = json<unknown>(v, 'log', [])
  return Array.isArray(raw) ? raw.flatMap(x => (isObj(x) && typeof x.at === 'string' && typeof x.instrument === 'string'
    ? [{at: x.at, member: typeof x.member === 'string' ? x.member : NONE, instrument: x.instrument, picked: strs(x.picked), status: typeof x.status === 'string' ? x.status : NONE, engine: typeof x.engine === 'string' ? x.engine : NONE}] : [])) : []
}

const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
interface Hosted {readonly ref?: string; readonly endpoint?: string; readonly health?: string; readonly availability?: string; readonly lifetime?: string}
/** The service that serves the model, as Workcell keeps it; undefined where Workcell reports none. */
const hostedOf = (v: V): Hosted | undefined => {
  const h = json<unknown>(v, 'hosted', null)
  return isObj(h) ? Object.fromEntries(['ref', 'endpoint', 'health', 'availability', 'lifetime'].flatMap(k => (typeof h[k] === 'string' ? [[k, h[k]]] : []))) as Hosted : undefined
}
const LIFETIME: Record<string, string> = {'target-owned': 'its owner', managed: 'Workcell'}
const serviceName = (ref: string | undefined) => ref?.replace(/^service:/, '').replace(/\/.*$/, '')
const wanted = (v: V, i: Instrument) => v[`allow:${i.id}`] !== false && !i.person && i.built !== false
const pickText = (a: Answer | undefined) => (a === undefined ? undefined : a.picked.length ? a.picked.join(', ') : 'none')
const statusOf = (a: Answer | undefined) => (a ? STATUS[a.status] : undefined)
const engineOf = (a: Answer | undefined) => (a?.engine ? ENGINE[a.engine] : undefined)
/** The gap between the strongest label and the next: how clearly the helper told them apart. */
function clarity(a: Answer | undefined): number | undefined {
  const s = a ? Object.values(a.scores).sort((x, y) => y - x) : []
  return s.length >= 2 ? s[0]! - s[1]! : s.length === 1 ? s[0] : undefined
}
const pc = (x: number | undefined) => (x === undefined ? undefined : `${Math.round(x * 100)} %`)
const msText = (x: number | undefined) => (x === undefined ? undefined : x < 1000 ? `${Math.round(x)} ms` : `${(x / 1000).toFixed(1)} s`)

// ---------------------------------------------------------------- the spread

/** One bar for each label the head allows, as tall as the helper's confidence; the picked are lit. Without a question it says why. */
function Spread({v, w, h, names = true}: {v: V; w: number; h: number; names?: boolean}) {
  const ask = askOf(v), a = answerOf(v)
  if (!has(v, 'ask')) return <Say w={w} h={h} lines={['No reading', 'of the question']} />
  if (!ask) return <Say w={w} h={h} lines={['Nothing open', 'The rules settled it. No call.']} />
  const top = 16, base = h - (names ? 20 : 8), left = 8, right = w - 8, n = Math.max(1, ask.labels.length)
  const step = (right - left) / n, bar = Math.max(2, step - (n > 8 ? 2 : 5))
  const most = Math.max(.5, ...Object.values(a?.scores ?? {}))
  const Y = (x: number) => base - (x / most) * (base - top)
  return <>
    {[.25, .5].filter(g => g <= most).map(g => <g key={g}><line x1={left} x2={right} y1={Y(g)} y2={Y(g)} className="dp-grid" /><text x={right} y={Y(g) - 2} textAnchor="end" className="dp-axis">{g * 100}</text></g>)}
    <line x1={left} x2={right} y1={base} y2={base} className="dp-faint" />
    {ask.labels.map((l, i) => {
      const x = left + i * step + (step - bar) / 2, s = a?.scores[l.id], picked = a?.picked.includes(l.id) ?? false
      return <g key={l.id}>
        {s !== undefined && <rect x={x} y={Y(s)} width={bar} height={Math.max(1, base - Y(s))} className={picked ? 'dp-fill-on' : 'dp-fill'} />}
        {s !== undefined && <line x1={x} x2={x + bar} y1={Y(s)} y2={Y(s)} className={picked ? 'dp-curve-on' : 'dp-curve'} />}
        {names && <text x={x + bar / 2} y={base + 10} textAnchor="middle" className={picked ? 'dp-ink' : 'dp-axis'}>{short(l.id, step)}</text>}
      </g>
    })}
    {!a && <text x={w / 2} y={(top + base) / 2} textAnchor="middle" className="dp-ink-dim">Asked. No answer yet.</text>}
    {a && !a.picked.length && a.status === 'unresolved' && <text x={w / 2} y={top + 8} textAnchor="middle" className="dp-ink-dim">Abstained: nothing stood out</text>}
  </>
}
/** A label's name cut to the room its bar has (about 5 px a letter). */
const short = (id: string, room: number) => { const n = Math.max(2, Math.floor(room / 5)); return id.length > n ? `${id.slice(0, n - 1)}…` : id }
function Say({w, h, lines}: {w: number; h: number; lines: readonly string[]}) {
  return <text x={w / 2} y={h / 2 - (lines.length - 1) * 6 + 3} textAnchor="middle" className="dp-ink-dim">{lines.map((s, i) => <tspan key={i} x={w / 2} dy={i ? 12 : 0}>{s}</tspan>)}</text>
}
function SpreadDisplay({p, w, h, names}: {p: ViewProps; w: number; h: number; names?: boolean}) {
  const ask = askOf(p.v), e = engineOf(answerOf(p.v))
  return <Display w={w} h={h} label="The spread" corner={e?.label ?? (ask ? ask.instrument : NONE)}
    does="One bar for each label the owner allows, as tall as the helper's confidence. Lit bars are its pick. The corner says what the engine did with it.">
    <Spread v={p.v} w={w} h={h} names={names} />
  </Display>
}

// ---------------------------------------------------------------- controls

const provider = (p: ViewProps) => <Radio {...st(p, 'provider')} label="Provider" does="Who answers the open questions: no one, a model on this machine, your endpoint, or a hosted service."
  value={strOf(p.v, 'provider') ?? ''} options={PROVIDERS} stack onChange={x => p.set('provider', x)} />
const providerChooser = (p: ViewProps) => <Chooser {...st(p, 'provider')} label="Provider" does="Who answers the open questions."
  value={strOf(p.v, 'provider') ?? ''} options={PROVIDERS} onChange={x => p.set('provider', x)} />
const whenChooser = (p: ViewProps) => <Chooser {...st(p, 'when')} label="When" does="Background: the act goes on and the answer joins it if it comes in time. Before the act: the act waits for it."
  value={strOf(p.v, 'when') ?? ''} options={WHEN} onChange={x => p.set('when', x)} />
const when = (p: ViewProps) => <Radio {...st(p, 'when')} label="When" does="Background: the act goes on and the answer joins it if it comes in time. Before the act: the act waits for it."
  value={strOf(p.v, 'when') ?? ''} options={WHEN} stack onChange={x => p.set('when', x)} />
const deadline = (p: ViewProps) => <Dial {...st(p, 'deadline')} label="Deadline" does="How long an answer may take. One that comes later is dropped, and the question stays open."
  value={numOf(p.v, 'deadline') ?? NaN} def={10} scale={DEADLINE} format={x => `${Math.round(x)} s`} onChange={x => p.set('deadline', Math.round(x))} />
const probe = (p: ViewProps) => <Action {...st(p, 'probe')} label="Probe" does="Asks the helper one small typed question and reports how it answered and how long it took."
  disabled={st(p, 'probe').disabled ?? (strOf(p.v, 'provider') === 'none' ? 'Choose a provider first.' : undefined)} onPress={() => p.set('probe', true)} />

const count = (v: V, key: string) => numOf(v, key)
function Counts({v}: {v: V}) {
  return <div className="dh-counts">
    <Readout big label="by rule" does="Acts the rules settled whole. They asked the helper nothing." value={count(v, 'settled')} tone="green" />
    <Readout big label="asked" does="Questions put to the helper today." value={count(v, 'asked')} tone="accent" />
    <Readout big label="abstained" does="Answers that picked nothing. They are kept as given." value={count(v, 'abstained')} />
    <Readout big label="refused" does="Picks the engine refused." value={count(v, 'refused')} tone="stall" />
  </div>
}

function Instruments({p, size, onSelect, selected}: {p: ViewProps; size: number; onSelect?: (id: string) => void; selected?: string}) {
  const [page, setPage] = useState(0)
  const all = instrumentsOf(p.v)
  const items: RowItem[] = (all ?? []).map(i => ({id: i.id, name: i.name, note: i.organ, request: i.person || i.built === false ? undefined : wanted(p.v, i),
    light: i.person || i.built === false ? 'dark' : !wanted(p.v, i) ? 'dark' : i.admitted ? 'lit' : 'unknown', tone: i.admitted ? 'accent' : undefined,
    why: i.person ? 'Gate 6 is yours. No helper answers it, not even to abstain.' : i.built === false ? 'Not built yet.' : wanted(p.v, i) && !i.admitted ? 'Asked for. The team has not measured it yet.' : undefined,
    does: `${i.labels.length} labels${i.cf ? ` · ${i.cf}` : ''}`}))
  const request = st(p, 'instruments').disabled ? undefined : (id: string, on: boolean) => p.set(`allow:${id}`, on)
  return <Rows label={all ? 'Instruments' : 'Instruments · no reading'} items={items} onRequest={request} onSelect={onSelect} selected={selected}
    does="The questions this team may put to the helper. The square is your request; the light is the team's measured admission." size={size} page={page} onPage={setPage} />
}

// ---------------------------------------------------------------- sample material

const GATE = ['aligned', 'annotated', 'hold', 'redirect']
const THOUGHT = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T0′', 'T1′', 'T2′', 'T3′', 'T4′', 'T5′']
const INSTRUMENTS = [
  {id: 'vak', organ: 'Anima', name: 'Vāk block', cf: 'CF5 (4.0/1-4.4/5)', labels: ['CPF', 'CT', 'CP', 'CF', 'CFP', 'CS', 'direction'], admitted: true},
  {id: 'gate', organ: 'Aletheia', name: 'Gate reading, 1–5', cf: 'the gate’s row', labels: GATE, admitted: true},
  {id: 'gate6', organ: 'Aletheia', name: 'Gate 6 reading', labels: ['aligned', 'hold', 'redirect'], person: true},
  {id: 'thought', organ: 'Aletheia', name: 'Thought reading', labels: THOUGHT, admitted: true},
  {id: 'gnosis', organ: 'Aletheia', name: 'Gnosis retrieval', labels: ['grounded', 'partial', 'empty'], admitted: true},
  {id: 'stack', organ: 'Aletheia', name: 'Stack traverse', labels: ['healthy', 'drift', 'gap', 'unverified'], admitted: true},
  {id: 'plugin', organ: 'Aletheia', name: 'Plugin integration', labels: ['redundant', 'complementary', 'conflicting', 'adopt', 'reference only', 'decline']},
  {id: 'improvement', organ: 'Aletheia', name: 'Improvement proposal', labels: ['implementation', 'addendum', 'owner-issue', 'no-change'], admitted: true},
  {id: 'aliveness', organ: 'Aletheia', name: 'Spread aliveness', labels: ['live', 'mute'], built: false},
  {id: 'klein', organ: 'Anima', name: 'Klein telemetry', labels: ['effective', 'suboptimal', 'ineffective']},
]
const GATE_ASK = {instrument: 'Gate reading', member: 'Mercurius', cf: 'CF4 (0/1/2/3)', field: 'gate 5 · Rupa', min: 0, max: 1, policy: 'abstain',
  labels: GATE.map(id => ({id, description: id}))}
const LOG = [
  {at: '14:02', member: 'Mercurius', instrument: 'Gate reading · 5', picked: ['aligned'], status: 'determined', engine: 'validated'},
  {at: '14:01', member: 'Anansi', instrument: 'Gnosis retrieval', picked: ['partial'], status: 'determined', engine: 'validated'},
  {at: '13:58', member: 'Moirai as Klotho', instrument: 'Thought reading', picked: [], status: 'unresolved', engine: 'kept'},
  {at: '13:51', member: 'Anima', instrument: 'Vāk block · CF', picked: ['(0/1/2/3)'], status: 'determined', engine: 'validated'},
  {at: '13:47', member: 'Zeithoven', instrument: 'Improvement proposal', picked: ['addendum'], status: 'determined', engine: 'validated'},
  {at: '13:40', member: 'Janus', instrument: 'Stack traverse · layer 2', picked: ['drift'], status: 'determined', engine: 'validated'},
]

export const design: DesignedDevice = {
  id: 'ai-kit:decision-helper',
  title: 'Decision helper',
  kind: 'effect',
  firstPage: 'ask',
  defaults: {
    light: 'lit', provider: 'local', when: 'background', deadline: 10,
    // Readings: the provider as AIKit reports it.
    model: 'kev-latest', base: 'Qwen3.5 0.8B', where: '127.0.0.1:8019', state: 'loaded', independent: true, price: 'none',
    // Readings: the service that serves it, as Workcell reports it (`workcell system --json` services.declared, 21 Oct).
    hosted: JSON.stringify({ref: 'service:kev-decision/personal-workcell', endpoint: 'http://127.0.0.1:8019', health: 'healthy', availability: 'available', lifetime: 'target-owned'}),
    // The question and the answer, as the team and the engine report them.
    ask: JSON.stringify(GATE_ASK),
    answer: JSON.stringify({status: 'determined', scores: {aligned: .41, annotated: .27, hold: .19, redirect: .13}, picked: ['aligned'], ms: 412, engine: 'validated', reason: 'The gate rules passed.'}),
    instruments: JSON.stringify(INSTRUMENTS), log: JSON.stringify(LOG),
    settled: 37, asked: 6, abstained: 1, refused: 0,
  },
  fixtures: {
    'A gate reading': {},
    Abstained: {ask: JSON.stringify({instrument: 'Thought reading', member: 'Moirai as Klotho', cf: 'CF3 (0/1/2)', field: 'thought', min: 0, max: 2, policy: 'preserve-candidates',
      labels: THOUGHT.map(id => ({id, description: id}))}),
    answer: JSON.stringify({status: 'unresolved', scores: Object.fromEntries(THOUGHT.map((id, i) => [id, [.11, .09, .1, .08, .07, .09, .08, .06, .07, .09, .08, .08][i]!])), picked: [], ms: 538, engine: 'kept', reason: 'An empty selection is kept as given.'})},
    'Nothing open': {ask: 'null', answer: undefined, settled: 38},
    'Its service is down': {state: 'loaded', hosted: JSON.stringify({ref: 'service:kev-decision/personal-workcell', endpoint: 'http://127.0.0.1:8019', health: 'unavailable', availability: 'degraded', lifetime: 'target-owned'})},
    'No readings': {light: undefined, provider: undefined, when: undefined, deadline: undefined, model: undefined, base: undefined, where: undefined, state: undefined,
      independent: undefined, price: undefined, hosted: undefined, ask: undefined, answer: undefined, instruments: undefined, log: undefined, settled: undefined, asked: undefined, abstained: undefined, refused: undefined},
  },

  folded: p => <Folded title="Decision helper" light={light(p)} readings={[count(p.v, 'asked') === undefined ? NONE : `${count(p.v, 'asked')} asked`, pickText(answerOf(p.v)) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Decision helper" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><SpreadDisplay p={p} w={140} h={146} /></Section>
    <Section label="Macros" cols={2}>{whenChooser(p)}{deadline(p)}{providerChooser(p)}{probe(p)}</Section>
  </Panel>,

  whole: p => {
    const ask = askOf(p.v), a = answerOf(p.v), s = statusOf(a), e = engineOf(a)
    const [chosen, choose] = [strOf(p.v, 'chosen'), (id: string) => p.set('chosen', id)]
    const sel = instrumentsOf(p.v)?.find(i => i.id === (chosen ?? 'gate'))
    return <Panel title="Decision helper" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}
      pages={[{id: 'ask', label: 'Ask'}, {id: 'instruments', label: 'Instruments'}, {id: 'provider', label: 'Provider'}]} page={p.page} onPage={p.setPage}>
      {p.page === 'instruments' ? <Band>
        <Section width={232}><Instruments p={p} size={8} onSelect={choose} selected={sel?.id} /></Section>
        <Section label={sel ? sel.name : 'Instrument'} grow>
          <div className="ref-pair"><Readout label="organ" does="The team that puts this question." value={sel?.organ} /><Readout label="row" does="The context frame it is asked at." value={sel?.cf ?? (sel ? 'any' : undefined)} /></div>
          <div className="dh-labels" data-i="Labels|The only answers the owner allows. The helper can pick among them, or none.">
            {sel ? sel.labels.map(l => <span key={l}>{l}</span>) : <i>{NONE}</i>}
          </div>
          <Readout label="admission" does="Whether the team has measured this instrument and lets the helper answer it."
            value={sel ? (sel.person ? 'Yours alone' : sel.built === false ? 'Not built' : sel.admitted ? 'Admitted' : 'Not measured') : undefined} tone={sel?.admitted ? 'green' : undefined} />
        </Section>
      </Band> : p.page === 'provider' ? <Band>
        <Section label="Provider" width={150}>{provider(p)}</Section>
        <Section label="Model" cols={2} grow>
          <Readout label="model" does="The model that answers." value={strOf(p.v, 'model')} />
          <Readout label="base" does="The model it was trained from." value={strOf(p.v, 'base')} />
          <Readout label="where" does="Where it runs." value={strOf(p.v, 'where')} />
          <Readout label="state" does="Whether it is loaded and answering." value={strOf(p.v, 'state')} tone={strOf(p.v, 'state') === 'loaded' ? 'green' : 'stall'} />
          <Readout label="apart" does="The helper is never one of the agents acting, nor a member of the team." value={has(p.v, 'independent') ? (p.v.independent === true ? 'yes' : 'no') : undefined} />
          <Readout label="price" does="A model on your machine has no price. None is invented." value={strOf(p.v, 'price')} />
          <Readout label="hosting" does="Whether the service that serves the model answers, as Workcell reads it: healthy, degraded or unavailable."
            value={hostedOf(p.v)?.health} tone={hostedOf(p.v)?.health === 'healthy' ? 'green' : hostedOf(p.v) ? 'stall' : undefined} />
          <Readout label="kept by" does="Who keeps the service running: its own owner (target-owned) or Workcell (managed)." value={hostedOf(p.v) ? LIFETIME[hostedOf(p.v)!.lifetime ?? ''] ?? hostedOf(p.v)!.lifetime : undefined} />
        </Section>
        <Section label="Timing" width={128}>{when(p)}{deadline(p)}{probe(p)}</Section>
      </Band> : <>
        <Band>
          <Section width={260}><SpreadDisplay p={p} w={248} h={146} /></Section>
          <Section label="Question" cols={2} grow>
            <Readout label="instrument" does="The typed question the member put." value={ask?.instrument} />
            <Readout label="asked by" does="The member who asked." value={ask?.member} />
            <Readout label="row" does="The context frame it was asked at." value={ask?.cf} />
            <Readout label="field" does="What the question decides." value={ask?.field} />
            <Readout label="pick" does="How many labels the answer may hold." value={ask ? `${ask.min}–${ask.max} of ${ask.labels.length}` : undefined} />
            <Readout label="if unclear" does="What the owner wants when no label stands out: keep the candidates, abstain, or one if it is supported." value={ask ? POLICY[ask.policy] ?? ask.policy : undefined} />
          </Section>
        </Band>
        <Band>
          <Section label="Answer" cols={2} width={260}>
            <Readout label="picked" does="The labels the helper picked. None is an answer too." value={pickText(a)} tone={a?.picked.length ? 'accent' : undefined} />
            <Readout label="status" does="Picked, part picked, abstained, unavailable, refused or stale." value={s?.label} tone={s?.tone} />
            <Readout label="clarity" does="How far the strongest label stood above the next." value={pc(clarity(a))} />
            <Readout label="took" does="How long the answer took." value={msText(a?.ms)} />
          </Section>
          <Section label="Engine" grow>
            <Readout label="engine" does="What the rules did with the answer: validated it, kept an abstention as given, or refused it." value={e?.label} tone={e?.tone} />
            <p className="dh-reason" data-i="Reason|The engine's own words.">{a?.reason ?? NONE}</p>
            <Counts v={p.v} />
          </Section>
        </Band>
      </>}
    </Panel>
  },

  full: p => {
    const log = logOf(p.v), ask = askOf(p.v)
    return <div className="ref-pane-body dh-full">
      <section className="dh-now">
        <h4>{ask ? `${ask.member} asks · ${ask.instrument}` : 'Nothing open'}</h4>
        <Display w={300} h={150} label="The spread" corner={engineOf(answerOf(p.v))?.label ?? NONE}
          does="One bar for each label the owner allows, as tall as the helper's confidence. Lit bars are its pick.">
          <Spread v={p.v} w={300} h={150} />
        </Display>
        <Counts v={p.v} />
        <p className="dh-hosted" data-i="Hosting|The service that serves the model, as Workcell reads it: whether it answers, where, and who keeps it running.">
          <b>hosting</b>{hostedOf(p.v) ? <><span>{serviceName(hostedOf(p.v)!.ref) ?? NONE}</span><span data-tone={hostedOf(p.v)!.health === 'healthy' ? 'green' : 'stall'}>{hostedOf(p.v)!.health ?? NONE}</span>
            <span>{hostedOf(p.v)!.endpoint ?? NONE}</span><span>kept by {LIFETIME[hostedOf(p.v)!.lifetime ?? ''] ?? hostedOf(p.v)!.lifetime ?? NONE}</span></> : <span>{NONE}</span>}</p>
      </section>
      <section className="dh-log">
        <h4>Today</h4>
        {log ? log.length ? <table>
          <thead><tr><th>At</th><th>Asked by</th><th>Instrument</th><th>Picked</th><th>Engine</th></tr></thead>
          <tbody>{log.map((r, i) => <tr key={i} data-dim={r.status === 'unresolved' ? 'true' : undefined}>
            <td>{r.at}</td><td>{r.member}</td><td>{r.instrument}</td><td>{r.picked.length ? r.picked.join(', ') : 'none'}</td>
            <td data-tone={ENGINE[r.engine]?.tone}>{ENGINE[r.engine]?.label ?? r.engine}</td>
          </tr>)}</tbody>
        </table> : <p className="dh-none">Nothing asked today.</p> : <p className="dh-none">No reading of the questions.</p>}
      </section>
    </div>
  },

  widget: p => <Tile title="Decision helper" light={light(p)} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="The spread" does="The last question's labels, as tall as the helper's confidence. Lit bars are its pick.">
      <Spread v={p.v} w={112} h={104} names={false} />
    </Display>
    <div className="ref-tile-counts">
      <Readout big label="by rule" does="Acts the rules settled whole." value={count(p.v, 'settled')} tone="green" />
      <Readout big label="asked" does="Questions put to the helper today." value={count(p.v, 'asked')} tone="accent" />
      <Readout big label="picked" does="The last answer." value={pickText(answerOf(p.v))} />
    </div>
  </Tile>,
}
