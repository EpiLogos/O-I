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
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import {heldOf, pageBinding, setHeld, type DesignWiring} from './pageBindings'

export const CONTEXT_WORLD_DESIGN = 'central:context-world'

const NO_REACH = 'No owner holds an agent\'s Reach: no operation enforces it yet (the Factory Scope\'s reach waits on the same write, agent/devices/designBindings.ts:93 — WO-SF2).'
const NO_WRITES = 'No owner lists the places an agent may write, or how a write elsewhere arrives: Central records each write as a source change (its receipt), and no kernel operation sets the list or the mode.'
// Context & world stands on no chain since R4: Scope carries it (centralScopeBinding), where a read place's include or exclude is saved.
const NO_REQUEST = 'A place request is the person\'s include or exclude, which Scope saves through central.world-relations.save; Context & world stands on no chain since R4 (lock §0.3.5: Context & world is Scope).'

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

/** Central's resolution of a world's sources (`central.world.effective-sources`, central.effective-world-sources: ancestry propagation with
 * per-hop provenance, overrides and declared exclusions), read through the kernel's invoke_action (T-COVERAGE §1.3). */
export const EFFECTIVE_SOURCES_ACTION = 'central.world.effective-sources'

/** The world's effective sources as places on the Central ring (scope.tsx Place {id, name, ring}; the path rides along): each source
 * that stands available in the world, named by its path in the register, with its treatment and the world it comes from. A source the
 * world excludes is no place an agent reads. Null when the answer is not that resolution. Pure. */
export function effectivePlacesOf(data: unknown): Record<string, Value>[] | null {
  const doc = data as {sources?: unknown; world_ref?: unknown} | null
  if (!doc || !Array.isArray(doc.sources)) return null
  return (doc.sources as {ref?: unknown; state?: unknown; effective_treatment?: unknown; effective_source_world?: unknown; propagation_path?: unknown}[]).flatMap(source => {
    if (typeof source?.ref !== 'string' || !source.ref || source.state !== 'available') return []
    const world = str(source.effective_source_world)
    const at = world ? source.ref.indexOf(`${world}:`) : -1
    const name = at >= 0 ? source.ref.slice(at + world!.length + 1) : source.ref.split(':').pop() ?? source.ref
    const hops = Array.isArray(source.propagation_path) ? source.propagation_path.filter((hop): hop is string => typeof hop === 'string') : []
    const treatment = str(source.effective_treatment)
    return [{id: source.ref, name, ring: 3, path: `${source.ref}${treatment ? ` · ${treatment}` : ''}${hops.length > 1 ? ` · through ${hops.join(' → ')}` : world ? ` · from ${world}` : ''}`}]
  })
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
  /** Central's effective sources of the world (EFFECTIVE_SOURCES_ACTION): its data, or its refusal; absent while unasked. */
  readonly effective?: {readonly status: 'reading'} | {readonly status: 'answered'; readonly value: unknown} | {readonly status: 'refused'; readonly error: string}
  /** Central's authored relations of the world (WORLD_RELATIONS_READ): the record the person's include and exclude is written on. */
  readonly relations?: {readonly status: 'reading'} | {readonly status: 'answered'; readonly value: unknown} | {readonly status: 'refused'; readonly error: string}
  /** Save the world's relations record on its revision (WORLD_RELATIONS_SAVE); absent where nothing writes. */
  readonly saveRelations?: (record: Record<string, unknown>, expectedRevision: string) => Promise<void>
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
  // The world's places: Central's effective sources when it resolved them (each source a place); else, as before, the change
  // horizon's count of the sources an agent may retrieve, as one place.
  const effective = input.effective?.status === 'answered' ? effectivePlacesOf(input.effective.value) : null
  if (effective) places.push(...effective)
  if (input.horizon?.state === 'ready') {
    if (!effective) {
      const sources = (input.horizon.data?.sources ?? []).filter(row => row.binding?.agent_retrieval_allowed === true).length
      const world = str(input.horizon.data?.world_ref) ?? 'control:root'
      places.push({id: 'world', name: world === 'control:root' ? 'Your world' : world, ring: 3, path: `${sources} source${sources === 1 ? '' : 's'} an agent may retrieve (Central's change horizon).`})
    }
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

// ---------------------------------------------------------------------------------------------------------------- one Scope
// R4 (DLW §16.1 "What an agent may read and where it may write is one Scope (§19.12) … on any track an agent works on"; §19.12 "last on
// a Central workspace's chain"; lock §0.3.5 "Context & world is Scope"): Context & world's owners draw Scope's design on Central
// (software-factory:context-write-mode, inhabitants/catalogue/panels/scope.tsx) — the light, the places the agent may read (the packet
// its turn carries, your world's retrievable sources: each a place on its ring, the shape Scope reads), and the receipts of the
// session's writes. The Reach, the Writes list, the write mode and the Knowledge page have no owner a kernel op reaches, as before: each absent,
// and a change of it refused with the operation it lacks. The raised reach is the view's, held until Confirm (Scope's own ask).

/** Scope on Central's workspace chain (its design is Software Factory's: software-factory:context-write-mode). */
export const CENTRAL_SCOPE_ID = 'central:scope'

const SCOPE_MISSING = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
/** Scope's controls on Central that no owner takes, each with the operation it lacks. */
export const CENTRAL_SCOPE_REFUSED: Readonly<Record<string, string>> = {
  reach: SCOPE_MISSING('Reach', 'the scope reach write on the session\'s context, enforced on its reads (WO-SF2)', 'Software Factory'),
  writeMode: SCOPE_MISSING('Write mode', 'write-arm enforcement on the session\'s writes (WO-SF2): propose · draft · direct', 'Software Factory'),
  // The Knowledge page (manual §19.12 Knowledge; it took in the Knowledge route of §19.9 in the 22 Oct manual rewrite): its settings by the
  // design's own keys (scope.tsx), none of which an owner takes for the dialogue's session.
  'src.wiki': SCOPE_MISSING('Sources: Wiki', 'the Knowledge route\'s source bounds for the session (protocol_read is available but unwired)', 'AIKit'),
  'src.project': SCOPE_MISSING('Sources: Project knowledge', 'the Knowledge route\'s source bounds for the session (protocol_read is available but unwired)', 'AIKit'),
  'src.code': SCOPE_MISSING('Sources: Code', 'the Knowledge route\'s source bounds for the session (protocol_read is available but unwired)', 'AIKit'),
  searchFirst: SCOPE_MISSING('Search first', 'a per-agent order of search and links on the Knowledge route', 'AIKit'),
  linkDepth: SCOPE_MISSING('Link depth', 'the Knowledge route\'s link bound for the session', 'AIKit'),
  readBudget: SCOPE_MISSING('Read budget', 'the Knowledge route\'s page budget for the session', 'AIKit'),
  readAgain: SCOPE_MISSING('Read again', 'a reading of the session\'s used pages (no kernel op lists what the route read for a session)', 'AIKit'),
  forget: SCOPE_MISSING('Forget', 'a forgetting of a used reading (no kernel request forgets a use yet)', 'AIKit'),
}
const NO_PLACE_REQUEST = 'A place in Writes: Central\'s world relations keep the sources a world reads (sources, excluded_sources), not where an agent writes — missing op: the session\'s writable places (write-arm enforcement, WO-SF2, Software Factory).'

// ---------------------------------------------------------------------------------------------------------------- the world's relations
// W2 (manual §19.12 Reads; DLW lock §0.3.5): a read place's request is the person's include or exclude of that source in the world, kept by
// Central's authored world relations (central.world-relations/v1: sources, excluded_sources), read by `central.world-relations.read` and
// written by `central.world-relations.save` on the record's revision — one of the person's own presses the kernel carries (action.rs
// PERSON_ACTS). Central's save asks the record to carry its next revision (RevisionNotAdvanced otherwise).
export const WORLD_RELATIONS_READ = 'central.world-relations.read'
export const WORLD_RELATIONS_SAVE = 'central.world-relations.save'
/** The root register's world, the one Scope on Central's workspace chain reads. */
export const ROOT_WORLD_RELATIONS: Readonly<Record<string, unknown>> = {scope: 'root', ref: 'control:root'}

/** The world's relations record as Central's read gives it (data.record), or null when the answer is not that record. */
export function relationsRecordOf(data: unknown): Record<string, unknown> | null {
  const record = (data as {record?: unknown} | null)?.record
  return record && typeof record === 'object' && !Array.isArray(record) && (record as {schema?: unknown}).schema === 'central.world-relations/v1'
    && typeof (record as {revision?: unknown}).revision === 'string' ? record as Record<string, unknown> : null
}

/** The record's next revision: the counter in its revision advanced (`w1` → `w2`), else `.1` added. Central asks only that it advance. */
export function nextRelationsRevision(revision: string): string {
  const counted = revision.match(/^(.*?)(\d+)$/)
  return counted ? `${counted[1]}${Number(counted[2]) + 1}` : `${revision}.1`
}

/** The record with one source included (removed from excluded_sources) or excluded (added), at its next revision; every other field as
 * read. Pure. */
export function relationsWith(record: Record<string, unknown>, sourceRef: string, include: boolean): Record<string, unknown> {
  const excluded = new Set(Array.isArray(record.excluded_sources) ? record.excluded_sources.filter((ref): ref is string => typeof ref === 'string') : [])
  if (include) excluded.delete(sourceRef); else excluded.add(sourceRef)
  return {...record, revision: nextRelationsRevision(String(record.revision)), excluded_sources: [...excluded].sort()}
}

/** The include or exclude of each of the world's sources, as Central resolved them (effective sources: available is included, excluded is
 * not), as `r:<source ref>` values. */
export function readRequestsOf(effective: unknown): Record<string, boolean> {
  const sources = (effective as {sources?: unknown} | null)?.sources
  if (!Array.isArray(sources)) return {}
  return Object.fromEntries(sources.flatMap(source => typeof source?.ref === 'string' && (source.state === 'available' || source.state === 'excluded')
    ? [[`r:${source.ref}`, source.state === 'available']] : []))
}

/** Scope's readings on Central: Context & world's (contextWorldValues), in Scope's keys. `reads` keeps Scope's place shape ({id, name,
 * ring}; the place's path rides along); `receipts` is the session's source changes, newest first (the manual's Receipts list — the design
 * sums a place's receipts from `writes`, which no owner lists, so it draws the count as missing). */
export function centralScopeValues(id: string, input: ContextWorldInput): Values {
  const world = contextWorldValues(id, input)
  const values: Record<string, Value> = {}
  for (const key of ['light', 'reads', 'receipts', 'reachPending'] as const) if (world[key] !== undefined) values[key] = world[key]!
  // Each source's include or exclude, as Central resolved the world (r:<source ref>).
  if (input.answer.bound && input.effective?.status === 'answered') Object.assign(values, readRequestsOf(input.effective.value))
  return values
}

/** Why a read place's request cannot be written now. */
function readRequestWhy(input: ContextWorldInput, key: string): string | null {
  const ref = key.slice(2)
  if (!ref.startsWith('central:source:')) return `${ref}: no source of the world, so no include or exclude of it is kept (central.world-relations/v1 keeps sources).`
  if (!input.saveRelations) return 'No writer of the world\'s relations is handed to Scope here (central.world-relations.save).'
  if (input.relations?.status === 'refused') return `Central refused the world's relations: ${input.relations.error}`
  if (input.relations?.status !== 'answered' || !relationsRecordOf(input.relations.value)) return 'Central\'s world relations have not answered yet (central.world-relations.read): a save is checked against their revision.'
  return null
}

/** Scope's binding on Central: its readings; a raised reach held until Confirm; a read place's include or exclude saved on the world's
 * relations record at its revision (central.world-relations.save); every other write refused with the op it lacks. */
export function centralScopeBinding(id: string, input: ContextWorldInput): DesignBinding {
  const values = centralScopeValues(id, input)
  const places = typeof values.reads === 'string' ? (JSON.parse(values.reads) as {id: string}[]) : []
  const standing: Record<string, Standing> = Object.fromEntries(Object.entries(CENTRAL_SCOPE_REFUSED).map(([key, why]) => [key, {disabled: why}]))
  for (const place of places) {
    standing[`w:${place.id}`] = {disabled: NO_PLACE_REQUEST}
    const why = readRequestWhy(input, `r:${place.id}`)
    if (why) standing[`r:${place.id}`] = {disabled: why}
  }
  return {
    id,
    values,
    standing,
    local: {reachPending: value => setHeld(id, 'reachPending', value === undefined ? undefined : value)},
    writes: key => key in CENTRAL_SCOPE_REFUSED || key.startsWith('w:') || key.startsWith('r:'),
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (key.startsWith('r:')) {
          const why = readRequestWhy(input, key)
          if (why) throw Error(why)
          if (typeof value !== 'boolean') throw Error('A read place\'s request is on (included) or off (excluded).')
          const record = relationsRecordOf((input.relations as {value: unknown}).value)!
          await input.saveRelations!(relationsWith(record, key.slice(2), value), String(record.revision))
          continue
        }
        if (key === 'reach') setHeld(id, 'reachPending', undefined)
        throw Error(CENTRAL_SCOPE_REFUSED[key] ?? (key.startsWith('w:') ? NO_PLACE_REQUEST : `${key} is a reading: its owner reports it; nothing here changes it.`))
      }
    },
  }
}
