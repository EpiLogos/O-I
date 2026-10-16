// The Answer (DLW §18.10, central:nara-conversation) on Central's readings (lane BC2): the agent that answers, last on a document's
// chain. Its binding is the owner's Nara dialogue binding (oi.nara-dialogue-binding/v1, looked up by useCentralReadings.ts
// useNaraReading): bound, its session's conversation is the exchange — AIKit's encounter view of that session, observed by the ONE
// shared observer every presenter of a session uses (agent/devices/EncounterObservers.tsx), its rows the Agent's and the Thread's own
// (agent/devices/threadBinding.ts threadJson — lane BF2's read, reused, never read twice). The packet is the Packet's (lane BC3,
// packetBinding.ts — AIKit's prepared context, the one read the Packet widget and the transport share), shown only when it is prepared
// for this session: the encounter's Send carries its own session's prepared context (encounter/session.ts send → reviewedContext), so
// "an answer shows the packet that it came from" (DLW §18.9 Rules) and never another's. Pure: no React, no transport.
import type {DesignBinding, Value, Values} from '../../frame/devices/designed'
import type {RosterAgent} from '../../../../../../desktop/cradle/src/agency/roster'
import type {EncounterReading, EncounterStatus} from '../../../../../../desktop/cradle/src/encounter/client'
import {threadJson} from '../../agent/devices/threadBinding'
import type {NaraState} from './centralDeviceModel'
import {heldOf, pageBinding, type DesignWiring, type PageActs} from './pageBindings'

export const ANSWER_DESIGN = 'central:nara-conversation'

const NO_OWNER = (what: string) => `${what}: no owner holds it for the Nara dialogue (the binding carries its role, its expression and its session, nothing more).`

export const ANSWER_WIRING: DesignWiring = {
  design: ANSWER_DESIGN,
  keys: ['light', 'agent', 'answerAs', 'writes', 'effort', 'draft', 'sent', 'source', 'state', 'context', 'document', 'entry', 'resume', 'agents', 'packet', 'thread',
    'sources', 'accept', 'decline'],
  reads: {
    light: 'the Nara dialogue binding: lit when bound, dark when unbound or refused (op nara_dialogue lookup)',
    agent: 'the accepted agent whose role is the binding\'s role (nara)', agents: 'Central\'s accepted agents (owners/readers.ts useRosterAgents; roster.ts shape)',
    state: 'the session\'s connection: idle while resident, answering while a turn is in flight (encounter status)',
    document: 'the reached page\'s tab title', resume: 'whether the binding asks for its session to resume (provisioning.resume_required)',
    packet: 'the Packet\'s items (AIKit\'s prepared context, packetBinding.ts packetItemOf), when the packet is prepared for this session: the packet its Send carries',
    thread: 'the bound session\'s exchange, as the Agent and the Thread draw it (threadBinding.ts threadJson over the shared encounter observer)',
  },
  writes: {
    light: 'lit binds the conversation (op nara_dialogue resolve; centralDeviceWrites.ts bindConversation)',
    sent: 'your question, as the session\'s next turn (the encounter session\'s own draft and send — the thread pane\'s Send)',
  },
  local: {draft: 'the composer\'s words, until you send them', source: 'the source this device shows'},
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
  const held = heldOf(id)
  const defaults: Record<string, Value> = {draft: '', source: '1'}
  for (const key of Object.keys(ANSWER_WIRING.local)) { const value = held[key] ?? defaults[key]; if (value !== undefined) values[key] = value }
  return values
}

/** What the Answer writes through: the conversation's binding, and the bound session's turn. */
export interface AnswerPorts {
  readonly bind: (() => Promise<void>) | null
  /** Send a question as the session's next turn (the encounter session's draft, then its Send); null while no session is observed. */
  readonly send: ((text: string) => Promise<void>) | null
}

/** The Answer's binding. */
export function answerBinding(id: string, input: AnswerInput, ports: AnswerPorts): DesignBinding {
  const bound = input.nara?.state === 'bound'
  const NOT_BOUND = 'The conversation is not bound: no session receives the question. Bind it (the light), on an expression with its identity.'
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
  }
  const why: Record<string, string> = {}
  if (!bound || !ports.send) why.sent = NOT_BOUND
  if (!ports.bind) why.light = 'No conversation is selected. The binding resolves for the encounter\'s subject once one is.'
  return pageBinding(id, ANSWER_WIRING, answerValues(id, input), acts, why)
}
