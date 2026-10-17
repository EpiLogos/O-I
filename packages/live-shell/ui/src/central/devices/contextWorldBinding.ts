// Context & world (DLW §19.12, central:context-world) on its owners (lane BC3). Where it stands: "after the agent, on any track the agent
// works on" — on Central's workspace track the agent is the Answer, the last of a document's chain (§16.2 "the document effects, then the
// agent that answers"; §18.10), so Context & world stands after the Answer and reads the scope of the Answer's session: the session the
// Nara dialogue binding holds (useCentralReadings.ts useNaraReading). Unbound, no agent works on the track and its light is dark.
//
// The owners, each one the shell already reads:
//   - what a world lets an agent read: Central's change horizon — every source with `agent_retrieval_allowed` (Central ctrl
//     source_horizon.rs; the ground reading's `sources`, useCentralGroundAnswer — the Day device's one read of the ground), drawn as
//     one place on the Central ring;
//   - the packet the session's turn carries: AIKit's prepared context, when the Packet's reading is prepared for this session (the
//     encounter's Send carries the context of its own session: encounter/session.ts send → reviewedContext);
//   - the receipts of the agent's writes: the same change horizon's changes whose `agent_session_ref` is this session (ctrl
//     source_horizon.rs:138-140 actor, actor_kind, agent_session_ref; before and after revisions).
// The Reach, the Writes to list, Writes elsewhere, Knowledge search and the proposals that wait have no owner a kernel op reaches: each
// is absent, and a change of it refused, in words. Pure: no React, no transport.
import type {DesignBinding, Value, Values} from '../../frame/devices/designed'
import {heldOf, pageBinding, type DesignWiring} from './pageBindings'

export const CONTEXT_WORLD_DESIGN = 'central:context-world'

const NO_REACH = 'No owner holds an agent\'s Reach: no operation enforces it yet (the Factory Scope\'s reach waits on the same write, agent/devices/designBindings.ts:93 — WO-SF2).'
const NO_WRITES = 'No owner lists the places an agent may write, or how a write elsewhere arrives: Central records each write as a source change (its receipt), and no kernel operation sets the list or the mode.'
const NO_REQUEST = 'No owner takes a place request: the person\'s include and exclude is Central\'s central.world-relations.save, which no kernel operation carries.'

export const CONTEXT_WORLD_WIRING: DesignWiring = {
  design: CONTEXT_WORLD_DESIGN,
  keys: ['light', 'reach', 'writeMode', 'knowledge', 'document', 'reads', 'writes', 'tree', 'r:<id>', 'w:<id>', 'receipts', 'waiting', 'readsPage', 'writesPage',
    'reachPending'],
  reads: {
    light: 'lit while the Answer\'s session holds the track and Central\'s ground answered; dark while no session is bound (no agent works on the track)',
    document: 'the reached page\'s tab title',
    reads: 'the places the agent may read: the packet its turn carries (AIKit\'s prepared context, when prepared for this session), and your world\'s sources that allow agent retrieval (the ground\'s change horizon, agent_retrieval_allowed)',
    receipts: 'the change horizon\'s source changes made in this session (agent_session_ref), newest first: actor, time, place, kind, before and after revisions',
  },
  writes: {},
  local: {
    readsPage: 'the page of the Reads list this device shows',
    writesPage: 'the page of the Writes list this device shows',
    reachPending: 'a raised Reach waiting for Confirm (nothing is sent before; the Reach itself has no owner)',
  },
  refused: {
    reach: NO_REACH,
    writeMode: NO_WRITES,
    knowledge: 'No owner gates an agent\'s knowledge search: no operation enforces it yet.',
    'r:<id>': NO_REQUEST,
    'w:<id>': NO_REQUEST,
  },
  absent: {
    reach: NO_REACH,
    writeMode: NO_WRITES,
    writes: NO_WRITES,
    knowledge: 'No owner reports whether the agent may search your knowledge.',
    waiting: 'No kernel operation lists the proposals an agent returned (Central\'s projectcentral.source.return, kept until you accept it).',
    tree: 'Optional: the pane draws the places when no tree is given.',
  },
}

/** One source change, as Central's change horizon records it (source_horizon.rs). */
interface SourceChange {
  readonly change_ref?: unknown
  readonly cursor?: unknown
  readonly kind?: unknown
  readonly source_path?: unknown
  readonly before_revision?: unknown
  readonly after_revision?: unknown
  readonly observed_at_unix_seconds?: unknown
  readonly actor?: unknown
  readonly actor_kind?: unknown
  readonly agent_session_ref?: unknown
}

/** The ground's change horizon, as the `central` inspect reading carries it (central/client.ts CentralGroundReading `sources`). */
export interface ChangeHorizon {
  readonly state: string
  readonly data?: {readonly sources?: readonly {readonly binding?: {readonly agent_retrieval_allowed?: unknown}}[]; readonly changes?: readonly SourceChange[]; readonly world_ref?: unknown}
  readonly error?: {readonly message?: string}
}

export interface ContextWorldInput {
  /** The Answer's binding: whether a session holds the track, and which. */
  readonly answer: {readonly bound: boolean; readonly session: string | null}
  /** The ground's change horizon (null while the ground has not answered) and the ground's refusal. */
  readonly horizon: ChangeHorizon | null
  readonly groundError?: string | null
  /** The reached page's tab title. */
  readonly document: string | null
  /** The Packet's reading: its items and the session it is prepared for. */
  readonly packet: {readonly items: number; readonly session: string | null} | null
}

const str = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined)
/** A content revision as the receipt shows it: the owner's digest, short. */
const revisionShort = (value: unknown): string | undefined => {
  const text = str(value)
  if (!text) return undefined
  const tail = text.split(':').pop() ?? text
  return tail.slice(0, 8)
}
const KIND_WORD: Readonly<Record<string, string>> = {added: 'Added', modified: 'Modified', removed: 'Removed', deleted: 'Removed'}

/** The receipts of one session's writes, newest first. */
export function receiptsOf(horizon: ChangeHorizon | null, session: string): Record<string, Value>[] {
  const changes = horizon?.data?.changes ?? []
  return changes.filter(change => change.agent_session_ref === session)
    .sort((a, b) => (Number(b.cursor) || 0) - (Number(a.cursor) || 0))
    .map((change, at) => {
      const before = revisionShort(change.before_revision), after = revisionShort(change.after_revision), kind = str(change.kind)
      return {
        id: str(change.change_ref) ?? `change-${at}`,
        actor: str(change.actor) ?? session,
        ...(typeof change.observed_at_unix_seconds === 'number' ? {at: change.observed_at_unix_seconds} : {}),
        ...(str(change.source_path) ? {place: str(change.source_path)!} : {}),
        ...(kind ? {kind: KIND_WORD[kind] ?? kind} : {}),
        ...(before ? {before} : {}), ...(after ? {after} : {}),
      }
    })
}

/** Context & world's readings (CONTEXT_WORLD_WIRING). */
export function contextWorldValues(id: string, input: ContextWorldInput): Values {
  const values: Record<string, Value> = {}
  const held = heldOf(id)
  for (const key of Object.keys(CONTEXT_WORLD_WIRING.local)) if (held[key] !== undefined) values[key] = held[key]!
  if (input.document) values.document = input.document
  const session = input.answer.bound ? input.answer.session : null
  if (!input.answer.bound) values.light = 'dark'
  else if (session && input.horizon?.state === 'ready') values.light = 'lit'
  if (!session) return values
  const places: Record<string, Value>[] = []
  if (input.packet && input.packet.session === session) {
    places.push({id: 'packet', name: 'Packet', ring: 0, path: `The prepared context: ${input.packet.items} item${input.packet.items === 1 ? '' : 's'} that this session's turn carries.`})
  }
  if (input.horizon?.state === 'ready') {
    const sources = (input.horizon.data?.sources ?? []).filter(row => row.binding?.agent_retrieval_allowed === true).length
    const world = str(input.horizon.data?.world_ref) ?? 'control:root'
    places.push({id: 'world', name: world === 'control:root' ? 'Your world' : world, ring: 3, path: `${sources} source${sources === 1 ? '' : 's'} an agent may retrieve (Central's change horizon).`})
    values.receipts = JSON.stringify(receiptsOf(input.horizon, session))
  }
  if (places.length) values.reads = JSON.stringify(places)
  return values
}

/** Context & world's binding: readings only; the Reach, the writes and the requests refused in words. */
export function contextWorldBinding(id: string, input: ContextWorldInput): DesignBinding {
  const values = contextWorldValues(id, input)
  // Each place's request stands refused before it is pressed, in the same words.
  const places = [...(typeof values.reads === 'string' ? JSON.parse(values.reads) as {id: string}[] : [])]
  const standing = Object.fromEntries(places.flatMap(place => [[`r:${place.id}`, {disabled: NO_REQUEST}], [`w:${place.id}`, {disabled: NO_REQUEST}]]))
  return pageBinding(id, CONTEXT_WORLD_WIRING, values, {}, {}, standing)
}
