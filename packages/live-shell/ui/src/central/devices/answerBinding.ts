// The Answer (DLW §19.4, central:nara-conversation) on Central's readings (lane BC2): the agent that answers, last on a document's
// chain. Its binding is the owner's Nara dialogue binding (oi.nara-dialogue-binding/v1, looked up by useCentralReadings.ts
// useNaraReading): bound, its session's conversation is the exchange — AIKit's encounter view of that session, observed by the ONE
// shared observer every presenter of a session uses (agent/devices/EncounterObservers.tsx), its rows the Agent's and the Thread's own
// (agent/devices/threadBinding.ts threadJson — lane BF2's read, reused, never read twice). The packet is the Packet's (lane BC3,
// packetBinding.ts — AIKit's prepared context, the one read the Packet widget and the transport share), shown only when it is prepared
// for this session: the encounter's Send carries its own session's prepared context (encounter/session.ts send → reviewedContext), so
// "an answer shows the packet that it came from" (DLW §18.3 Rules) and never another's. Its voice — Hears, Speaks, what the voice does
// and your words as they are written — is the native voice owner's (answerVoice.ts over the kernel op nara_voice); a transcript is sent
// through the same Send as a typed question. The face's dynamics and the conversation beside it are the view's own (`local`).
// Pure: no React, no transport.
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {RosterAgent} from '../../../../../../desktop/cradle/src/agency/roster'
import type {EncounterReading, EncounterStatus} from '../../../../../../desktop/cradle/src/encounter/client'
import {threadJson} from '../../agent/devices/threadBinding'
import type {NaraState} from './centralDeviceModel'
import {heldOf, pageBinding, setHeld, type DesignWiring, type PageActs} from './pageBindings'
import type {AnswerVoiceState, VoiceKey} from './answerVoice'

export const ANSWER_DESIGN = 'central:nara-conversation'

const NO_OWNER = (what: string) => `${what}: no owner holds it for the Nara dialogue (the binding carries its role, its expression and its session, nothing more).`

/** The voice the native owner holds (answerVoice.ts over the kernel op nara_voice: whisper.cpp in, Kokoro-82M out, on this machine). */
const VOICE = 'the Answer\'s voice (answerVoice.ts; kernel op nara_voice)'

export const ANSWER_WIRING: DesignWiring = {
  design: ANSWER_DESIGN,
  keys: ['light', 'agent', 'answerAs', 'writes', 'effort', 'draft', 'sent', 'source', 'state', 'context', 'document', 'entry', 'resume', 'agents', 'packet', 'thread',
    'sources', 'accept', 'decline', 'hears', 'speaks', 'voice', 'heard', 'chat', 'emotion', 'feeling.v', 'feeling.a', 'gaze.x', 'gaze.y', 'gesture', 'do'],
  reads: {
    light: 'the Nara dialogue binding: lit when bound, dark when unbound or refused (op nara_dialogue lookup)',
    agent: 'the accepted agent whose role is the binding\'s role (nara)', agents: 'Central\'s accepted agents (owners/readers.ts useRosterAgents; roster.ts shape)',
    state: 'the session\'s connection: idle while resident, answering while a turn is in flight (encounter status)',
    document: 'the reached page\'s tab title', resume: 'whether the binding asks for its session to resume (provisioning.resume_required)',
    packet: 'the Packet\'s items (AIKit\'s prepared context, packetBinding.ts packetItemOf), when the packet is prepared for this session: the packet its Send carries',
    thread: 'the bound session\'s exchange, as the Agent and the Thread draw it (threadBinding.ts threadJson over the shared encounter observer)',
    hears: `whether the microphone is open and what it hears is written and sent: ${VOICE}`,
    speaks: `whether each answer that completes is spoken: ${VOICE}`,
    voice: `what the voice does now: listening (the microphone open, or your words being written), speaking (the answer playing), quiet — ${VOICE}`,
    heard: `your words as the owner wrote them (op nara_voice transcribe), until they are sent; it writes no partial words: ${VOICE}`,
  },
  writes: {
    light: 'lit binds the conversation (op nara_dialogue resolve; centralDeviceWrites.ts bindConversation)',
    sent: 'your question, as the session\'s next turn (the encounter session\'s own draft and send — the thread pane\'s Send)',
    hears: 'on opens the voice and the microphone (op nara_voice open, listen); what you say is written (transcribe) and sent as `sent` is; on while the answer is spoken stops it first (barge-in); off closes the microphone and drops what it heard',
    speaks: 'on speaks each answer that completes from now on (op nara_voice speak, complete), the face\'s mouth following the sound; off stops it',
  },
  local: {
    draft: 'the composer\'s words, until you send them', source: 'the source this device shows',
    chat: 'whether the conversation stands beside the face',
    emotion: 'the face\'s held emotion (one of its twelve)', 'feeling.v': 'the face\'s valence, −1..1', 'feeling.a': 'the face\'s arousal, −1..1',
    'gaze.x': 'where the face looks, across, −1..1', 'gaze.y': 'where the face looks, up, −1..1',
    gesture: 'the gesture the face makes when asked', do: 'a count the view raises to make the gesture once',
  },
  refused: {
    agent: 'The dialogue binds the nara role; another agent answers through its own binding.',
    answerAs: NO_OWNER('How an answer joins the page'), writes: NO_OWNER('Whether the agent writes'), effort: NO_OWNER('Effort'),
    accept: 'A proposal is the owner\'s consent request: answer it in the Thread (Approve) or the thread pane, which hold the request.',
    decline: 'A proposal is the owner\'s consent request: answer it in the Thread or the thread pane, which hold the request.',
  },
  absent: {
    answerAs: NO_OWNER('How an answer joins the page'), writes: NO_OWNER('Whether the agent writes'), effort: NO_OWNER('Effort'),
    context: 'The dialogue reading discloses no size of the identity and Expression a turn carries.',
    entry: 'The page\'s selection does not cross the host bridge (it reads the island only), so no entry is the one asked about.',
    sources: 'The encounter view carries no list of what an answer cites.',
    packet: 'The packet the shell holds is prepared for another conversation (or none is read): this session\'s turn carries its own session\'s prepared context, which no reader here holds.',
  },
}

export interface AnswerInput {
  readonly nara: {readonly state: NaraState; readonly session: string | null; readonly resume?: boolean | null} | null
  /** The bound session's observed conversation (EncounterObservers.tsx observedState), when one is observed. */
  readonly observed?: {readonly reading?: EncounterReading; readonly status?: EncounterStatus}
  readonly roster: readonly Pick<RosterAgent, 'ref' | 'name' | 'accepted' | 'purpose' | 'role'>[] | null
  /** The reached page: its tab title. */
  readonly page: {readonly title: string} | null
  /** The Packet's items (packetBinding.ts packetValues `packet`) and the session its prepared context is for. */
  readonly packet?: {readonly items: string; readonly session: string | null} | null
  /** The voice, as its owner holds it (answerVoice.ts AnswerVoice snapshot). */
  readonly voice?: AnswerVoiceState | null
}

const ROLE = 'nara'

/** The Answer's readings (ANSWER_WIRING). */
export function answerValues(id: string, input: AnswerInput): Values {
  const values: Record<string, Value> = {}
  const state = input.nara?.state
  if (state === 'bound') values.light = 'lit'
  else if (state === 'unbound' || state === 'refused') values.light = 'dark'
  const accepted = (input.roster ?? []).filter(agent => agent.accepted)
  if (input.roster) values.agents = JSON.stringify(accepted.map(agent => ({id: agent.ref, name: agent.name, ...(agent.purpose ? {does: agent.purpose} : {}), ...(agent.role ? {role: agent.role} : {})})))
  const answering = accepted.find(agent => agent.role === ROLE)
  if (answering) values.agent = answering.ref
  if (state === 'bound') {
    const status = input.observed?.status?.state
    if (status === 'TurnInFlight' || status === 'InterruptRequested') values.state = 'answering'
    else if (status === 'Resident') values.state = 'idle'
    const thread = threadJson(input.observed, answering?.name ?? null)
    if (thread !== undefined) values.thread = thread
    if (typeof input.nara?.resume === 'boolean') values.resume = input.nara.resume
  }
  if (input.page) values.document = input.page.title
  // The packet the Send carries: the Packet's, when it is prepared for this very session.
  if (state === 'bound' && input.nara?.session && input.packet && input.packet.session === input.nara.session) values.packet = input.packet.items
  // The voice: on or off as its owner holds it, what it does now, and your words until they are sent.
  if (input.voice) Object.assign(values, {hears: input.voice.hears, speaks: input.voice.speaks, voice: input.voice.voice, heard: input.voice.heard})
  const held = heldOf(id)
  for (const key of Object.keys(ANSWER_WIRING.local)) { const value = held[key] ?? ANSWER_VIEW_DEFAULTS[key]; if (value !== undefined) values[key] = value }
  return values
}

/** The view's own keys at rest: the composer empty, the conversation beside the face, the face neutral, centred and nodding when
 * asked. Held for the session in one store (pageBindings.ts holds), so the chain, the pool, the pane and the rail show one face. */
export const ANSWER_VIEW_DEFAULTS: Readonly<Record<string, Value>> = {
  draft: '', source: '1', chat: 'on', emotion: 'neutral', 'feeling.v': 0, 'feeling.a': 0, 'gaze.x': 0, 'gaze.y': 0, gesture: 'nod', do: 0,
}

/** What the Answer writes through: the conversation's binding, the bound session's turn, and the voice. */
export interface AnswerPorts {
  readonly bind: (() => Promise<void>) | null
  /** Send a question as the session's next turn (the encounter session's draft, then its Send); null while no session is observed. */
  readonly send: ((text: string) => Promise<void>) | null
  /** Hears and Speaks on or off (answerVoice.ts AnswerVoice write; it rejects with the owner's words), and why the voice cannot open
   * here (no native owner, no bound conversation), or null when it can. Absent: no voice owner at all. */
  readonly voice?: {readonly write: (key: VoiceKey, value: Value) => Promise<void>; readonly why: string | null} | null
}

const NO_VOICE = 'No voice owner stands here: the native speech (the kernel op nara_voice) is the desktop\'s.'

/** The Answer's binding. */
export function answerBinding(id: string, input: AnswerInput, ports: AnswerPorts): DesignBinding {
  const bound = input.nara?.state === 'bound'
  const NOT_BOUND = 'The conversation is not bound: no session receives the question. Bind it (the light), on an expression with its identity.'
  const voice = ports.voice ?? null
  const acts: PageActs = {
    light: async value => {
      if (value !== 'lit') throw new Error('A face cannot unbind a conversation: AIKit holds the session, and the nara_dialogue op declares no release.')
      if (!ports.bind) throw new Error('No conversation is selected. The binding resolves for the encounter\'s subject once one is.')
      await ports.bind()
    },
    sent: async value => {
      const text = String(value ?? '').trim()
      if (!text) throw new Error('The question has no words.')
      if (!bound || !ports.send) throw new Error(NOT_BOUND)
      await ports.send(text)
    },
    hears: async value => { if (!voice) throw new Error(NO_VOICE); await voice.write('hears', value) },
    speaks: async value => { if (!voice) throw new Error(NO_VOICE); await voice.write('speaks', value) },
  }
  const why: Record<string, string> = {}
  if (!bound || !ports.send) why.sent = NOT_BOUND
  if (!ports.bind) why.light = 'No conversation is selected. The binding resolves for the encounter\'s subject once one is.'
  // The voice cannot open here: both keys stand disabled with the reason. It could and its owner refused the last press: the key
  // says so in the owner's words, and stays pressable.
  const absent = !voice ? NO_VOICE : voice.why
  const standing: Record<string, Standing> = {}
  for (const key of ['hears', 'speaks'] as const) {
    if (absent) why[key] = absent
    else if (input.voice?.refused[key]) standing[key] = {refused: input.voice.refused[key]}
  }
  return pageBinding(id, ANSWER_WIRING, answerValues(id, input), acts, why, standing)
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

/** The Agent's own readings on Central (actuation__harness-model.tsx keys): its light (the dialogue binding), its name (the roster's agent
 * of the binding's role), its thread (the bound session's exchange), and the composer's words and the last line it sent (the view's).
 * Model, harness, effort, budget, turns, input, interrupt, heartbeat and the needle have no reading for the dialogue: absent. */
export function centralAgentValues(id: string, input: AnswerInput): Values {
  const values: Record<string, Value> = {}
  const state = input.nara?.state
  if (state === 'bound') values.light = 'lit'
  else if (state === 'unbound' || state === 'refused') values.light = 'dark'
  const answering = (input.roster ?? []).filter(agent => agent.accepted).find(agent => agent.role === ROLE)
  if (answering) values.agent = answering.name || answering.ref
  if (state === 'bound') {
    const thread = threadJson(input.observed, answering?.name ?? null)
    if (thread !== undefined) values.thread = thread
  }
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
