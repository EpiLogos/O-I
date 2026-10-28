// The bindings of the gateways' readings beside Factory's chains, on their owners (lane BF2). The 22 Oct manual rewrite retired the four
// devices they drew as devices of their own: every gateway with its state is listed on the Workcells tile (§19.3; the workcell rack carries
// the Gateways' reading under `gw.`, AgentRailDevices.tsx), the agency gateway is the Gateway's agency build whose mark stands in the head of
// Messages (§19.10), an experiment is a task launched with Repeat, its takes set side by side with Compare (§19.5), and the frames are the
// Gateway's Frames page and its Full, its tile on the rail the Gateway's widget (§19.6: FRAMES_ID below is the Gateway's face drawn on the
// frames' binding). Their bindings stay: the gateways' (rackBinding), the agency build's (agencyBinding), the frames' (framesBinding);
// experimentBinding stands for the Launch panel's Repeat once a clip binding carries it.
//
// What the owners report, read 16 Oct 2026 through the installed owners (scratch lane-bf2/shapes/):
//   harness_agent_read {binding} — `aikit --json gateway agent --binding <b> sessions`: the AIKit agency gateway's answer about the
//     bound harness. On this machine the gateway is not running: `{"ok":false,"error":{"code":"cli.gateway_unreachable","message":
//     "connect gateway socket …/gateway.sock: No such file or directory …; start one with `aikit gateway serve`"}}`, which the kernel
//     passes as `{refused: true, error, message}` (agency.rs:144-176). It is the only gateway reading a kernel op reaches.
//   `aikit --json gateway modes|coexistence|who|connector list|remote list` answer (entry modes and their terms, the foreign
//     harness gateways, the Positions and their inbox, the connectors, the declared remotes) — but no kernel op runs any of them, so
//     the Agency gateway's surfaces, agents, harnesses, peers, entry and inbox stay absent, and each write stands disabled with the
//     operation it lacks.
//   Actuation's research comparison run (comparison.rs run_with) has no kernel route (it runs models), and its readings read the records
//     a run made, which nothing here holds: the Experiment's declaration and runs are absent (below). The Frames monitor reads AIKit's own
//     gateway journal since lane W6 (`aikit gateway ecology` and `aikit gateway replay`: framesValues below).
// The chains of the rack are the four the Actuation family declares (actuationFamilyManifest.ts:15 invariant.chains) — the
// registered gateways — each with the state its reading earns: Ready (it answered), Refused (its owner's words), or none read. The
// Remote carrier's chain reads Workcell's own status (lane BF3, workcellBindings.ts carrierChainState: Composed while a machine is
// connected, since nothing has carried a session through it).
// Pure, apart from the view holds (designBindings.ts holdView).
import type {DesignBinding, Standing, Value, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {IconName} from '../../inhabitants/sdk/icons'
import {allFamilyManifests} from '../../inhabitants/familyManifest'
import {inhabitantManifest} from '../../inhabitants/manifest'
import {gatewayDisclosed, type AgentChainReading} from './agentChainDevices'
import {gatewayValues, holdView, viewHolds, type ChainHolds, type GatewayInput} from './designBindings'
import {refusalWords} from './ownerRoutes'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)

/** The holds the retired devices' bindings keep their views under (the ids they stood under on the door). */
export const GATEWAYS_RACK_ID = 'factory:main:gateways'
export const AGENCY_GATEWAY_ID = 'factory:main:agency-gateway'
export const EXPERIMENT_ID = 'factory:main:experiment'
/** The rail's Frames tile: the Gateway's widget on the frames' binding (§19.6). */
export const FRAMES_ID = 'factory:frames'
/** The design the Frames tile draws: the Gateway's (actuation__gateway.tsx, its Frames page and its tile of the last eleven frames). */
export const FRAMES_DESIGN = 'actuation:gateway'

/** A device of an admitted family face (designKey(family, face.id) is its design's id), its values its design's from the binding;
 * null when the family does not admit the face. The family as composed (inhabitants/manifest.ts inhabitantManifest: its base and the
 * extensions declared onto it, Software Factory's attempt-review among them). */
export function familyFaceDevice(id: string, family: string, faceId: string, title: string, icon: IconName): DeviceInstance | null {
  const face = (inhabitantManifest(family)?.faces ?? allFamilyManifests().find(manifest => manifest.id === family)?.faces)?.find(candidate => candidate.id === faceId)
  if (!face) return null
  return {id, family, rows: [], values: {},
    face: {id: face.id, title, icon, liveSemantic: face.liveSemantic, ...(face.invariant ? {invariant: face.invariant} : {}), ...(face.note ? {note: face.note} : {})}}
}

/** The rail's Frames: Actuation's admitted Gateway face, drawn by the Gateway's design on the frames' binding (§19.6). */
export const mainDevices = () => ({
  frames: familyFaceDevice(FRAMES_ID, 'actuation', 'gateway', 'Gateway', 'link'),
})

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
const disabled = (reasons: Readonly<Record<string, string>>): Record<string, Standing> =>
  Object.fromEntries(Object.entries(reasons).map(([key, why]) => [key, {disabled: why}]))
const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}
/** The latest frames of a gateway another monitor selects (the Gateways monitor, the workcell rack): not the Frames monitor's journal. */
export const FRAME_RING = 'no reading reaches it yet — missing op: the latest frames of the selected gateway (Hermes\' TUI ring is not read: AIKit\'s coexistence law forbids reading a foreign gateway\'s state; the Agency gateway\'s own journal, `aikit gateway replay`, is the Frames monitor\'s reading) (AIKit).'

// ---------------------------------------------------------------------------------------------------------------- the gateway's answer

/** What harness_agent_read's answer says of the AIKit agency gateway and of the harness behind it. */
export type GatewayAnswer =
  | {readonly kind: 'unread'}
  /** The gateway answered about the binding. */
  | {readonly kind: 'answered'}
  /** The gateway itself did not answer (its socket is absent, it is not running): the owner's words. */
  | {readonly kind: 'unreachable'; readonly words: string}
  /** The gateway answered, and refused the binding: the owner's words. */
  | {readonly kind: 'refused'; readonly words: string}

const UNREACHABLE = new Set(['owner_unreachable', 'cli.gateway_unreachable'])

export function gatewayAnswer(reading: Pick<AgentChainReading, 'gatewayAdmitted' | 'gatewayDoc'>): GatewayAnswer {
  if (reading.gatewayAdmitted === true) return {kind: 'answered'}
  const doc = reading.gatewayDoc
  if (reading.gatewayAdmitted !== false || !isObj(doc) || !('refused' in doc)) return {kind: 'unread'}
  const error = isObj(doc.error) ? doc.error : {}
  const words = str(doc.message) ?? str(error.message) ?? 'The gateway gave no reason.'
  return UNREACHABLE.has(String(error.code)) ? {kind: 'unreachable', words} : {kind: 'refused', words}
}

// ---------------------------------------------------------------------------------------------------------------- the Gateways rack

/** The gateways your machines reach, by the manual's names: the Gateway's builds (§19.2 "Builds": the Hermes gateway, the AIKit agency
 * gateway, the Actuation gateway) and the Remote carrier, the connected machine that carries remote sessions (§19.2, §19.18). */
export const GATEWAY_CHAINS: readonly {readonly id: string; readonly name: string}[] = [
  {id: 'hermes', name: 'Hermes gateway'},
  {id: 'aikit-agency-gateway', name: 'AIKit agency gateway'},
  {id: 'actuation-frank', name: 'Actuation gateway'},
  {id: 'remote-carrier', name: 'Remote carrier'},
]

/** The registered gateways: the Gateway's builds and the Remote carrier, while Actuation admits the Gateway (its builds are its own) and
 * Workcell the Remote carrier; none where neither family admits its face (a list never invents a gateway). The Gateways rack, whose face
 * declared them as its chains, was retired in the 22 Oct manual rewrite (§19.3). */
export function registeredChains(): readonly string[] {
  const admits = (family: string, face: string) => allFamilyManifests().find(manifest => manifest.id === family)?.faces.some(candidate => candidate.id === face) ?? false
  return GATEWAY_CHAINS.map(chain => chain.id).filter(id => (id === 'remote-carrier' ? admits('workcell', 'remote-carrier') : admits('actuation', 'gateway')))
}

export interface RackInput {
  readonly reading: Pick<AgentChainReading, 'gatewayAdmitted' | 'gatewayDoc'>
  readonly holds: ChainHolds
  /** The Remote carrier's standing as a chain (workcellBindings.ts carrierChainState), where Workcell's status was read. */
  readonly carrier?: {readonly state?: 'ready' | 'composed' | 'refused'; readonly why?: string}
}

/** One chain's row (the Workcells tile's gateways, workcell__workcell.tsx:62-63 `gw.chains`; the Gateways rack was retired into it, ticket 725): its state from the reading that reaches it, the refusal in the owner's words.
 * The Hermes harness is read through AIKit's gateway, so with that gateway down it is not read at all; the Actuation gateway has no
 * reading a kernel op reaches; the Remote carrier's is Workcell's status. */
function chainRow(id: string, name: string, answer: GatewayAnswer, doc: unknown, carrier: RackInput['carrier']): Record<string, Value> {
  const row: Record<string, Value> = {id, name}
  if (id === 'remote-carrier') {
    if (carrier?.state) row.state = carrier.state
    if (carrier?.why) row.why = carrier.why
  }
  if (id === 'aikit-agency-gateway') {
    if (answer.kind === 'answered' || answer.kind === 'refused') row.state = 'ready'
    if (answer.kind === 'unreachable') { row.state = 'refused'; row.why = answer.words }
  }
  if (id === 'hermes') {
    if (answer.kind === 'answered') {
      row.state = 'ready'
      const transport = gatewayDisclosed(doc).transport
      if (typeof transport === 'string') row.transport = transport
    }
    if (answer.kind === 'refused') { row.state = 'refused'; row.why = answer.words }
  }
  return row
}

export function rackValues(input: RackInput): Values {
  const values: Record<string, Value> = {}
  const answer = gatewayAnswer(input.reading)
  const names = new Map(GATEWAY_CHAINS.map(chain => [chain.id, chain.name]))
  const rows = registeredChains().map(id => chainRow(id, names.get(id) ?? id, answer, input.reading.gatewayDoc, input.carrier))
  if (rows.length) values.chains = JSON.stringify(rows)
  // The rack's light: on when a chain is ready, off when the chains read are all refused or only composed, unread otherwise.
  if (rows.some(row => row.state === 'ready')) values.light = 'lit'
  else if (rows.some(row => row.state === 'refused' || row.state === 'composed')) values.light = 'dark'
  put(values, 'chain', viewHolds(input.holds, GATEWAYS_RACK_ID).chain)
  put(values, 'show', viewHolds(input.holds, GATEWAYS_RACK_ID).show)
  return values
}

/** What the Gateways monitor reads that no kernel op reaches: the observers attached to the selected gateway and its latest frames. */
export const RACK_ABSENT: Readonly<Record<string, Standing>> = disabled({
  peers: 'The observers attached: no reading reaches them yet — missing op: the gateway\'s sessions and observers (`aikit gateway status|ecology` through the kernel) (AIKit).',
  frames: `The selected gateway's latest frames: ${FRAME_RING}`,
})

/** The Gateways monitor's binding (§19.3: a monitor, on the rail and full in a pane, never on a chain — lane W1-Factory): the chosen chain
 * and Show are the view's own (the chosen one shows that gateway whole in the pool). It writes nothing: each gateway's Fan-out is set on its
 * workcell's Gateway (actuation__gateway.tsx fanOut, refused there until an owner carries it) and the monitor only reads it. */
export function rackBinding(input: RackInput, ports: {readonly show: (chain: string) => void}): DesignBinding {
  const values = rackValues(input)
  return {
    id: GATEWAYS_RACK_ID,
    values,
    local: {chain: value => { holdView(GATEWAYS_RACK_ID, 'chain', typeof value === 'string' ? value : undefined); if (typeof value === 'string') ports.show(value) },
      show: value => holdView(GATEWAYS_RACK_ID, 'show', typeof value === 'string' ? value : undefined)},
    standing: 'light' in values ? RACK_ABSENT : {...RACK_ABSENT, light: {disabled: 'The light is a reading: no gateway has answered yet, so it is not known.'}},
    writes: () => false,
    write: async changes => {
      for (const {key} of changes) throw Error(`${key} is a reading: its owner reports it; nothing here changes it.`)
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Agency gateway

export const AGENCY_REFUSE = {
  service: missing('Service', 'aikit gateway serve · shutdown through the kernel', 'AIKit'),
  entry: missing('Entry', 'aikit gateway setup --mode <entry> --apply through the kernel', 'AIKit'),
  coexist: missing('Coexist', 'aikit gateway coexistence --policy through the kernel', 'AIKit'),
  agentPolicy: missing('Calls', 'an ingress rule for the sender kind agent (GatewayIngressDecision has no write for it)', 'AIKit'),
  surfaces: missing('Surfaces', 'aikit gateway connector add · remove through the kernel', 'AIKit'),
} as const

/** The Agency gateway's values (§19.9): its light and state from whether it answered, its refusal in its own words; nothing else a
 * kernel op reaches. */
export function agencyValues(reading: Pick<AgentChainReading, 'gatewayAdmitted' | 'gatewayDoc'>, holds: ChainHolds): Values {
  const values: Record<string, Value> = {}
  const answer = gatewayAnswer(reading)
  if (answer.kind === 'answered' || answer.kind === 'refused') { values.light = 'lit'; values.state = 'ready' }
  if (answer.kind === 'unreachable') { values.light = 'dark'; values.refused = answer.words }
  put(values, 'entryPending', viewHolds(holds, AGENCY_GATEWAY_ID).entryPending)
  return values
}

export function agencyBinding(reading: Pick<AgentChainReading, 'gatewayAdmitted' | 'gatewayDoc'>, holds: ChainHolds): DesignBinding {
  return {
    id: AGENCY_GATEWAY_ID,
    values: agencyValues(reading, holds),
    standing: disabled(AGENCY_REFUSE),
    // A changed entry waits for Confirm (the view's own ask); Confirm itself has no carrier.
    local: {entryPending: value => holdView(AGENCY_GATEWAY_ID, 'entryPending', typeof value === 'string' ? value : undefined)},
    writes: key => key in AGENCY_REFUSE || key.startsWith('on:'),
    write: async changes => {
      for (const {key} of changes) {
        holdView(AGENCY_GATEWAY_ID, 'entryPending', undefined)
        throw Error(key.startsWith('on:') ? AGENCY_REFUSE.surfaces : AGENCY_REFUSE[key as keyof typeof AGENCY_REFUSE] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Experiment

// Lane W3 routes Actuation's research comparison's READINGS (desktop/cradle/kernel/src/owner_routes.rs ActuationRead::Comparison:
// `actuation-research comparison.held|assess|mask|review` over the records or manifest handed) and not its run: comparison.run executes
// model bodies, so no kernel route asks it. Each reading reads what a run made — held takes the run records (`records`: it answers `valid`
// and the held constants that differ, `mismatches`), assess, mask and review take a run's manifest (ql-series1-run/0.3) — and no reading the
// shell holds carries a run record or a manifest: the research store keeps them, and no kernel route lists or reads it. So the declaration
// stays unwritten, and the runs, the state and the earlier Experiments (whose `mismatches` held would answer) stay absent, each saying so.
const EXPERIMENT_OP = 'Actuation\'s matched comparison run, `actuation-research comparison.run` (research comparison.rs run_with), which the kernel does not route because it runs models'
/** Every statement and reading the Experiment asks the owner to write (a task launched with Repeat, clips/factory.tsx:5-7 `repeat.*`, `compare`, `takes`; the Experiment was retired into it, §19.5). */
export const EXPERIMENT_WRITES: readonly string[] = ['question', 'task', 'variable', 'levels', 'agents', 'repeats', 'stop', 'capTurns', 'capTime',
  'readTokens', 'readTime', 'readCalls', 'readTests', 'readSpend', 'readStalls', 'beat', 'compare', 'fork']
export const EXPERIMENT_REFUSE = missing('The Experiment', EXPERIMENT_OP, 'Actuation')
/** What the comparison's readings would read, and why none is handed them. */
const NO_RUN_RECORDS = 'the run records or the manifest of a comparison run to hand Actuation\'s comparison readings (the kernel\'s actuation_read {comparison held|assess|mask|review} reads only what it is handed; the research store keeps them, and no kernel route lists or reads it)'
/** The Experiment's readings, each absent with what it waits for (clips/factory.tsx:5-7; agent/clipBinding.ts LAUNCH_ABSENT). */
export const EXPERIMENT_ABSENT: Readonly<Record<string, string>> = {
  light: `The light: no reading reaches it yet — missing op: ${NO_RUN_RECORDS} (Actuation).`,
  state: `Draft, running or done: no reading reaches it yet — missing op: ${NO_RUN_RECORDS} (Actuation).`,
  runs: `The runs: no reading reaches them yet — missing op: ${NO_RUN_RECORDS} (Actuation).`,
  earlier: `The earlier Experiments and the held constants that differ: no reading reaches them yet — missing op: ${NO_RUN_RECORDS}; comparison.held answers the differing constants of the records it is handed (Actuation).`,
  tasks: 'The tasks a run can do: no reading reaches them yet — missing op: the research task catalogue (experiments/native-research/tasks.json) through the kernel (Actuation).',
  options: 'The values each variable may take: no reading reaches them yet — missing op: the comparison\'s named conditions (research comparison.rs CONDITIONS) through the kernel (Actuation).',
}

/** The Experiment's values: no reading reaches its owner, so its declaration, runs and state are all absent; the reading the picture
 * draws (`plot`) is the view's own. */
export function experimentValues(holds: ChainHolds): Values {
  const values: Record<string, Value> = {}
  put(values, 'plot', viewHolds(holds, EXPERIMENT_ID).plot)
  return values
}

export function experimentBinding(holds: ChainHolds): DesignBinding {
  return {
    id: EXPERIMENT_ID,
    values: experimentValues(holds),
    standing: disabled({...EXPERIMENT_ABSENT, ...Object.fromEntries(EXPERIMENT_WRITES.map(key => [key, EXPERIMENT_REFUSE]))}),
    local: {plot: value => holdView(EXPERIMENT_ID, 'plot', typeof value === 'string' ? value : undefined)},
    writes: key => EXPERIMENT_WRITES.includes(key),
    write: async changes => { for (const {key} of changes) throw Error(EXPERIMENT_WRITES.includes(key) ? EXPERIMENT_REFUSE : `${key} is a reading.`) },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Frames monitor

/** The monitor's own settings and the shell's starting value of each (§19.5: All sessions, Both, every kind, Follow on, Pause off,
 * Keep 1000). The shell holds them; nothing here is written to the harness. */
export const FRAMES_VIEW: Readonly<Record<string, Value>> = {
  session: 'all', direction: 'both', kinds: 'messages,tools,heartbeat,approvals,errors', follow: true, pause: false, keep: 1000,
}

/** AIKit's own gateway journal, as the Frames monitor reads it (lane W6; desktop/cradle/kernel/src/owner_routes.rs AikitRead): the gateway's
 * ecology (`aikit gateway ecology --json`: {type ecology, ecology {agencies [{sessions [{agent_session_ref, harness_ref, streams
 * [{stream_ref, last_sequence, event_count}]}]}]}}) names the sessions it serves and their Streams; a replay (`aikit gateway replay --stream S
 * [--after N] [--limit L] --json`: {type replay, replay {stream_ref, after_sequence, returned_through, stream_last_sequence, has_more, events
 * [{sequence, event {kind, content, surface_ref, metadata}}]}}) gives one Stream's frames in sequence. Hermes' TUI ring is not read: AIKit's
 * coexistence law forbids reading a foreign gateway's state. */
export interface FramesJournal {
  /** `aikit gateway ecology`, as the window holds it. */
  readonly ecology: {readonly status: 'reading' | 'answered' | 'refused'; readonly value: unknown; readonly error: string | null}
  /** Each Stream's replay, by its ref: AIKit's answer or its refusal in its words. Absent: none asked yet. */
  readonly replays?: ReadonlyMap<string, {readonly value?: unknown; readonly error?: string}>
}

/** One session of the gateway's ecology and its Streams. */
export interface JournalSession {
  readonly session: string
  readonly harness?: string
  readonly streams: readonly {readonly stream: string; readonly last?: number; readonly count?: number}[]
}

const finite = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)

/** The sessions the gateway's ecology names, each with its Streams. Null when the reading is not the ecology. Pure. */
export function journalSessions(ecology: unknown): JournalSession[] | null {
  const doc = isObj(ecology) && ecology.type === 'ecology' && isObj(ecology.ecology) ? ecology.ecology : null
  if (!doc || !Array.isArray(doc.agencies)) return null
  return doc.agencies.flatMap(agency => (isObj(agency) && Array.isArray(agency.sessions) ? agency.sessions : []).flatMap((row): JournalSession[] => {
    if (!isObj(row) || typeof row.agent_session_ref !== 'string' || !row.agent_session_ref) return []
    const streams = (Array.isArray(row.streams) ? row.streams : []).flatMap(stream => (isObj(stream) && typeof stream.stream_ref === 'string' && stream.stream_ref
      ? [{stream: stream.stream_ref, ...(finite(stream.last_sequence) !== undefined ? {last: finite(stream.last_sequence)} : {}),
        ...(finite(stream.event_count) !== undefined ? {count: finite(stream.event_count)} : {})}] : []))
    return [{session: row.agent_session_ref, ...(typeof row.harness_ref === 'string' && row.harness_ref ? {harness: row.harness_ref} : {}), streams}]
  }))
}

/** AIKit's own bound on one replay (`--limit 1..4096`). */
export const REPLAY_LIMIT = 4096

/** One replay the monitor asks for. */
export interface JournalAsk {readonly session: string; readonly stream: string; readonly after: number; readonly limit: number}

/** The replays the monitor asks for: each Stream of the session chosen (every session's, with All), from where its last Keep frames begin
 * (`--after` the journal's last sequence less Keep) and no more than Keep, within AIKit's own bound. None for the lead: no reading names
 * one. Pure. */
export function journalAsks(sessions: readonly JournalSession[], chosen: Value | undefined, keep: Value | undefined): JournalAsk[] {
  if (chosen === 'lead') return []
  const kept = typeof keep === 'number' && Number.isFinite(keep) && keep >= 1 ? Math.floor(keep) : Number(FRAMES_VIEW.keep)
  const limit = Math.min(kept, REPLAY_LIMIT)
  const shown = chosen === 'all' || chosen === undefined ? sessions : sessions.filter(row => row.session === chosen)
  return shown.flatMap(row => row.streams.map(stream => ({session: row.session, stream: stream.stream, after: Math.max(0, (stream.last ?? 0) - limit), limit})))
}

/** A frame's direction, as the event's own kind names it (actuation.stream/v1 EventKind): a person's message went from the shell to the
 * harness; the model's message, delta and result came back. Every other kind names no direction, and none is given it. */
export const FRAME_DIRECTION: Readonly<Record<string, 'in' | 'out'>> = {'human-message': 'out', 'model-message': 'in', 'model-delta': 'in', 'model-result': 'in'}

/** One replay's frames as the monitor's rows (the Gateway's Frames page, actuation__gateway.tsx:27-28 `frames` {seq?, dir, kind, session, at, note}; the Frames monitor was retired into it, §19.6): the event's sequence,
 * its kind and the direction its kind names, the session, and its content where it is words. The journal gives no instant, so `at` is left
 * out. Null when the answer is not the replay of a Stream. Pure. */
export function journalFrames(replay: unknown, session: string): Record<string, Value>[] | null {
  const doc = isObj(replay) && replay.type === 'replay' && isObj(replay.replay) ? replay.replay : null
  if (!doc || !Array.isArray(doc.events)) return null
  return doc.events.flatMap((row): Record<string, Value>[] => {
    if (!isObj(row) || !isObj(row.event) || typeof row.event.kind !== 'string' || !row.event.kind) return []
    const kind = row.event.kind, dir = FRAME_DIRECTION[kind], seq = finite(row.sequence)
    return [{...(seq !== undefined ? {seq} : {}), ...(dir ? {dir} : {}), kind, session,
      ...(typeof row.event.content === 'string' && row.event.content ? {note: row.event.content} : {})}]
  })
}

/** The lead: no reading names one. */
const FRAMES_LEAD = 'The lead\'s session: no reading reaches it yet — missing op: a lead among the gateway\'s sessions (`aikit gateway ecology` names each session and its harness, not a lead) (AIKit).'

/** The journal's readings for the monitor: the frames of the Streams asked (each Stream in its sequence, the Streams in the ecology's order)
 * and — with one Stream read — its last sequence and the events the journal holds; and why the frames are not drawn, in the owner's words,
 * when they are not (or why one of several Streams is missing). Pure. */
export function journalValues(journal: FramesJournal | undefined, chosen: Value | undefined, keep: Value | undefined): {values: Record<string, Value>; why?: string} {
  if (!journal) return {values: {}, why: 'The frames: AIKit\'s gateway journal is not read here (`aikit gateway ecology` and `aikit gateway replay` through the kernel).'}
  if (journal.ecology.status === 'refused') return {values: {}, why: refusalWords(journal.ecology.error ?? 'AIKit refused its gateway ecology.')}
  if (journal.ecology.status !== 'answered') return {values: {}, why: 'AIKit\'s gateway ecology has not answered yet (`aikit gateway ecology`).'}
  const sessions = journalSessions(journal.ecology.value)
  if (!sessions) return {values: {}, why: '`aikit gateway ecology` answered something other than the gateway\'s ecology.'}
  if (chosen === 'lead') return {values: {}, why: FRAMES_LEAD}
  const asks = journalAsks(sessions, chosen, keep)
  if (!asks.length) return {values: {frames: '[]'}}
  const frames: Record<string, Value>[] = []
  const refused: string[] = []
  for (const ask of asks) {
    const answer = journal.replays?.get(ask.stream)
    if (!answer) return {values: {}, why: `AIKit's gateway has not answered the replay of ${ask.stream} yet (\`aikit gateway replay\`).`}
    if (answer.error) { refused.push(refusalWords(answer.error)); continue }
    const rows = journalFrames(answer.value, ask.session)
    if (rows) frames.push(...rows)
    else refused.push(`\`aikit gateway replay\` answered something other than the replay of ${ask.stream}.`)
  }
  const why = refused.length ? [...new Set(refused)].join(' ') : undefined
  if (refused.length === asks.length) return {values: {}, ...(why ? {why} : {})}
  const values: Record<string, Value> = {frames: JSON.stringify(frames)}
  if (asks.length === 1) {
    const read = journal.replays?.get(asks[0]!.stream)?.value
    put(values, 'seq', isObj(read) && isObj(read.replay) ? finite(read.replay.stream_last_sequence) : undefined)
    put(values, 'ring', sessions.flatMap(row => row.streams).find(stream => stream.stream === asks[0]!.stream)?.count)
  }
  return {values, ...(why ? {why} : {})}
}

/** The monitor's values: the Gateway's own readings under the Gateway's own names (actuation__gateway.tsx:22-28, the Frames page — one reading,
 * the same as the Gateway device's: designBindings.ts gatewayValues), the view's settings and the frame opened, and the frames of AIKit's
 * gateway journal for the session chosen (journalValues). */
export function framesValues(gateway: GatewayInput, holds: ChainHolds, journal?: FramesJournal): Values {
  const view = viewHolds(holds, FRAMES_ID)
  const values: Record<string, Value> = {...gatewayValues(gateway)}
  for (const [key, value] of Object.entries(FRAMES_VIEW)) values[key] = view[key] ?? value
  put(values, 'frame', view.frame)
  Object.assign(values, journalValues(journal, values.session, values.keep).values)
  return values
}

/** What the Frames monitor draws that no document the shell reads carries — each absent, with the read it waits for: the Hermes TUI
 * gateway's counters (its ring is not read: AIKit's coexistence law forbids reading a foreign gateway's state, and AIKit's journal keeps no
 * such counter), the lead (the ecology names sessions and their harness, no lead), the journal's cap (it declares none); until a journal
 * is read, the frames, the last sequence and the events held stand with the journal's own words (framesBinding). */
const HERMES_COUNTER = 'no reading reaches it yet — missing op: the Hermes TUI gateway\'s own counter (its ring is not read: AIKit\'s coexistence law forbids reading a foreign gateway\'s state, and AIKit\'s journal, `aikit gateway replay`, keeps no such counter) (Hermes).'
export const FRAMES_ABSENT: Readonly<Record<string, Standing>> = disabled({
  ...Object.fromEntries(['epoch', 'peers', 'fanOut', 'beatAge', 'running', 'inflight', 'viaLead'].map(key => [key, `${key}: ${HERMES_COUNTER}`])),
  lead: FRAMES_LEAD,
  ringCap: 'The events the journal keeps: no reading reaches it yet — missing op: a declared cap on AIKit\'s gateway journal (it declares none; `aikit gateway replay` bounds one read at 4096) (AIKit).',
})

/** The monitor only reads (§19.6 "The monitor only reads. It sends nothing and changes no frame"): no write; its settings and the frame
 * opened are the view's own; the frames come from AIKit's gateway journal, and what no owner reports stands absent with the read it waits
 * for — the frames, the last sequence and the events held with the journal's own refusal when it refused. */
export function framesBinding(gateway: GatewayInput, holds: ChainHolds, journal?: FramesJournal): DesignBinding {
  const hold = (key: string) => (value: Value | undefined) => holdView(FRAMES_ID, key, value)
  const values = framesValues(gateway, holds, journal)
  const read = journalValues(journal, values.session, values.keep)
  const oneStream = read.why ?? 'One Stream at a time: choose a session with one Stream to read its last sequence and the events its journal holds.'
  const standing: Record<string, Standing> = Object.fromEntries(Object.entries(FRAMES_ABSENT).filter(([key]) => !(key in values)))
  if (!('frames' in values)) standing.frames = {disabled: read.why ?? 'The frames: AIKit\'s gateway journal has not answered.'}
  for (const key of ['seq', 'ring']) if (!(key in values)) standing[key] = {disabled: oneStream}
  return {
    id: FRAMES_ID,
    values,
    standing,
    local: {...Object.fromEntries(Object.keys(FRAMES_VIEW).map(key => [key, hold(key)])), frame: hold('frame')},
  }
}
