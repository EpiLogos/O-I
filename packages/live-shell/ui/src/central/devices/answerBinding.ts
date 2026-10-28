// The one Agent on Central's readings (DLW §16.1 "The agent that answers in a Central page and the agent that runs a Factory task is one
// Agent"; §19.4 "The answer's face"; lock §0.3.5 "Answer is the Agent on a page's chain"). The Answer (central:nara-conversation) was
// retired into the Agent in the 22 Oct manual rewrite (#804), and its own binding with it (answerBinding, answerValues, ANSWER_WIRING at
// c776a3007, #806): its voice is the Agent's Voice page (agent/devices/voiceBinding.ts), its face's own keys the Agent's (oneAgentBinding.ts).
// What stays here is what the Agent reads on Central. Its binding is the owner's Nara dialogue binding (oi.nara-dialogue-binding/v1, looked
// up by useCentralReadings.ts useNaraReading): bound, its session's conversation is the exchange — AIKit's encounter view of that session,
// observed by the ONE shared observer every presenter of a session uses (agent/devices/EncounterObservers.tsx), its rows the Agent's and
// the Thread's own (agent/devices/threadBinding.ts threadJson). The packet is the Packet's (packetBinding.ts — AIKit's prepared context,
// the one read the Packet widget and the transport share), shown only when it is prepared for this session: the encounter's Send carries
// its own session's prepared context (encounter/session.ts send → reviewedContext), so "an answer shows the packet that it came from"
// (DLW §18.3 Rules) and never another's. Pure: no React, no transport.
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {RosterAgent} from '../../../../../../desktop/cradle/src/agency/roster'
import type {EncounterReading, EncounterStatus} from '../../../../../../desktop/cradle/src/encounter/client'
import {threadJson} from '../../agent/devices/threadBinding'
import type {NaraState} from './centralDeviceModel'
import {heldOf, setHeld} from './pageBindings'

export interface AnswerInput {
  readonly nara: {readonly state: NaraState; readonly session: string | null; readonly resume?: boolean | null} | null
  /** The bound session's observed conversation (EncounterObservers.tsx observedState), when one is observed. */
  readonly observed?: {readonly reading?: EncounterReading; readonly status?: EncounterStatus}
  readonly roster: readonly Pick<RosterAgent, 'ref' | 'name' | 'accepted' | 'purpose' | 'role'>[] | null
  /** The Packet's items (packetBinding.ts packetValues `packet`) and the session its prepared context is for. */
  readonly packet?: {readonly items: string; readonly session: string | null} | null
}

/** The role the Nara dialogue binds: the agent of that role answers on Central. */
const ROLE = 'nara'

/** What the Agent writes through on Central: the conversation's binding, and the bound session's turn. */
export interface AnswerPorts {
  readonly bind: (() => Promise<void>) | null
  /** Send a question as the session's next turn (the encounter session's draft, then its Send); null while no session is observed. */
  readonly send: ((text: string) => Promise<void>) | null
}

// ---------------------------------------------------------------------------------------------------------------- the one Agent
// R4 (DLW §16.1 "The agent that answers in a Central page and the agent that runs a Factory task is one Agent"; §19.4; lock §0.3.5
// "Answer is the Agent on a page's chain"): on Central's workspace chain the Answer's owners draw the one Agent's design
// (actuation:harness-model) — the Nara dialogue binding is its light, the roster's agent of the binding's role its name, the bound
// session's exchange its thread, the encounter's Send its composer. The Agent's run settings have no owner for the Nara dialogue (the
// binding carries its role, its expression and its session, nothing more), so each stands disabled with the operation it lacks. Its
// Custody, Identity and Thread pages are composed on by agent/devices/oneAgentBinding.ts (CentralDevices.tsx).

/** The Agent on Central: `central:agent` (the chain's device id; its design is Actuation's, actuation:harness-model). */
export const CENTRAL_AGENT_ID = 'central:agent'

/** One operation would carry every run setting of the dialogue's agent: AIKit's nara_dialogue binding, configured on its session. */
const NARA_CONFIGURE = (what: string, field: string) =>
  `${what}: no owner operation carries it yet — missing op: kernel:nara_dialogue {action: configure, session_ref, ${field}} (AIKit).`

/** The Agent's own controls on Central that no owner takes, each with the operation it lacks (the host draws each disabled). */
export const CENTRAL_AGENT_REFUSED: Readonly<Record<string, string>> = {
  effort: NARA_CONFIGURE('Effort', 'effort: low | medium | high | max'),
  cap: NARA_CONFIGURE('Budget', 'turn_budget: 1–40'),
  input: NARA_CONFIGURE('Input', 'input: steer | queue'),
  quantize: NARA_CONFIGURE('Interrupt', 'interrupt: now | next tool | next turn'),
  heartbeat: NARA_CONFIGURE('Heartbeat', 'heartbeat: on | off'),
  model: NARA_CONFIGURE('Model', 'model'),
  harness: NARA_CONFIGURE('Harness', 'harness'),
}

/** The Agent's own readings on Central (actuation__harness-model.tsx keys; agent-answer.tsx, the answer's face): its light (the dialogue
 * binding), its name (the roster's agent of the binding's role) and that role, its run (producing while the bound session's turn is in
 * flight, so the face answers — §19.4 "its mouth moving with its words while it answers" — whether or not its voice speaks), its thread
 * (the bound session's exchange), the packet it reads (the Packet's items, prepared for this very session: §19.4 "intent on the packet
 * while it reads"), and the composer's words and the last line it sent (the view's). Model, harness, effort, budget, turns, input,
 * interrupt, heartbeat and the needle have no reading for the dialogue: absent. */
export function centralAgentValues(id: string, input: AnswerInput): Values {
  const values: Record<string, Value> = {}
  const state = input.nara?.state
  if (state === 'bound') values.light = 'lit'
  else if (state === 'unbound' || state === 'refused') values.light = 'dark'
  values.role = ROLE
  const answering = (input.roster ?? []).filter(agent => agent.accepted).find(agent => agent.role === ROLE)
  if (answering) values.agent = answering.name || answering.ref
  if (state === 'bound') {
    const status = input.observed?.status?.state
    if (status === 'TurnInFlight' || status === 'InterruptRequested') values.run = 'producing'
    const thread = threadJson(input.observed, answering?.name ?? null)
    if (thread !== undefined) values.thread = thread
  }
  // The packet the Send carries: the Packet's, when it is prepared for this very session (ported from the retired answerValues).
  if (state === 'bound' && input.nara?.session && input.packet && input.packet.session === input.nara.session) values.packet = input.packet.items
  const held = heldOf(id)
  values.draft = held.draft ?? ''
  if (held.sent !== undefined) values.sent = held.sent
  return values
}

/** The roster ref of the agent that answers on Central (the dialogue binding's role), for its Identity page. */
export function centralAgentRef(input: Pick<AnswerInput, 'roster'>): string | null {
  return (input.roster ?? []).filter(agent => agent.accepted).find(agent => agent.role === ROLE)?.ref ?? null
}

/** The Agent's own binding on Central: the light binds the dialogue (op nara_dialogue resolve), `sent` is the session's next turn (the
 * encounter's draft and Send — the thread pane's), the draft is the view's; every run setting refused with the op it lacks. */
export function centralAgentBinding(id: string, input: AnswerInput, ports: AnswerPorts): DesignBinding {
  const bound = input.nara?.state === 'bound'
  const NOT_BOUND = 'The conversation is not bound: no session receives your words. Bind it (the light), on an expression with its identity.'
  const NO_SUBJECT = 'No conversation is selected. The binding resolves for the encounter\'s subject once one is.'
  const standing: Record<string, Standing> = Object.fromEntries(Object.entries(CENTRAL_AGENT_REFUSED).map(([key, why]) => [key, {disabled: why}]))
  if (!bound || !ports.send) standing.sent = {disabled: NOT_BOUND}
  if (!ports.bind) standing.light = {disabled: NO_SUBJECT}
  return {
    id,
    values: centralAgentValues(id, input),
    standing,
    local: {draft: value => setHeld(id, 'draft', value === undefined ? undefined : String(value))},
    writes: key => key === 'light' || key === 'sent' || key in CENTRAL_AGENT_REFUSED,
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (key === 'light') {
          if (value !== 'lit') throw Error('A face cannot unbind a conversation: AIKit holds the session, and the nara_dialogue op declares no release.')
          if (!ports.bind) throw Error(NO_SUBJECT)
          await ports.bind()
          continue
        }
        if (key === 'sent') {
          const text = String(value ?? '').trim()
          if (!text) continue
          if (!bound || !ports.send) throw Error(NOT_BOUND)
          await ports.send(text)
          setHeld(id, 'sent', text)
          setHeld(id, 'draft', undefined)
          continue
        }
        throw Error(CENTRAL_AGENT_REFUSED[key] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}
