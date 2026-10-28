// The Knowledge graph (manual §17.3, knowledge-graph:graph) on its owners. T-COVERAGE §1.4: "the family publishes knowledge-scope,
// -filters, -display faces, not graph"; the coverage row: "a binding over the kernel `graph` op (exists)". Two owners, each read where
// it stands:
//   - the open graph's own view state, through the handle the open surface publishes (desktop/cradle/src/knowledge/
//     knowledgeGraphHandle.ts KnowledgeGraphSurface: filters, zoom, selected), written through the knowledge graph's armed setters —
//     the same path the family's three faces wrote (inhabitants/ql/devices/knowledgeDevices.ts KNOWLEDGE_DECLARED_ROWS → ownerWrite.ts
//     writeThroughOwner → agent/shellSetterBridge.ts), which call the panel's own acts; a coloured group's switch is the panel's own
//     filter change (knowledgeGraphFaceActions.ts setFilters);
//   - the reading itself: while a graph is open, the open surface's own reading, which its handle publishes with its register and query
//     (knowledgeGraphHandle.ts reading, project, query — the kernel `graph` op's answer the pane draws; desktop/cradle/kernel/src/
//     graph.rs, graphProgress.ts loadGraph); with none open, the same op asked here of the root register's wiki (graphRead.ts): its
//     local inputs first, the Shared Field's only while Shared stands.
// The keys and their owners:
//   light        lit while a graph is open, dark while none is
//   selected     the open graph's selected subject ('' while none is selected); a press on a node selects through the handle's own
//                act (knowledgeGraphHandle.ts select: the canvas's press, KnowledgeSurface.tsx select)
//   minimap      the canvas's overview toggle, through the handle (minimap, setMinimap)
//   fit          the Fit button's own act on the open graph (knowledgeGraphHandle.ts fit: the canvas's own fit, within its zoom limits); an
//                act, never a value: the zoom it lands on is read back on `zoom`
//   scope, depth, direction, shared, text, kinds, relations, ghosts (unresolved), orphans (isolated), mode (context), labels,
//   arrows, zoom, groups (emphasis)   the open graph's view state (GraphFilters), kinds and relations as the design lists them
//   reading      the kernel graph op's answer (oi.cradle.graph-reading/v1), whole: the open surface's, else the root register's
//   budget       the max_nodes the read is asked with: the open surface reads at graphProgress.ts's own 4096 and its handle takes no
//                bound; with none open, the hand's bound on the root read
//   aperture.*   QL's living-wiki plan (livingPlan.ts: `ql wiki living-plan` through the kernel's ql_read wiki-living-plan): the request is
//                the view's own (mode, positions, context, full, budget), the admitted and omitted positions, the depth and the refraction
//                QL's answer, or its refusal in its words
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {KnowledgeGraphSurface} from '../../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle'
import type {GraphReading} from '../../../../../../desktop/cradle/src/knowledge/graph'
import type {EmphasisGroup} from '../../../../../../desktop/cradle/src/knowledge/graphEmphasis'
import {GRAPH_DESIGN, disabled, handsFor, missing, put, refusal} from './designDevices'
import {APERTURE_READINGS, APERTURE_REQUEST, livingPlanState, livingPlanValues, livingPlanWhy, type LivingPlanState} from './livingPlan'

export const GRAPH_ID = GRAPH_DESIGN
/** The read's own node bound when the hand has set none (graphProgress.ts progressiveGraph: `maxNodes ?? 4096`). */
export const GRAPH_READ_NODES = 4096

/** The open graph's state, as the face bodies say it (knowledgeDevices.ts NOT_OPEN, NOT_LOCAL: the bodies' own words). */
export const NOT_OPEN = 'The knowledge graph is not open in this session. Open a graph in the centre and its controls stand here; nothing is held.'
export const NOT_LOCAL = 'Depth applies in a local view; the scope is the available field, so set the scope to the selected subject first.'

/** The open surface's reading, as a read (its handle's reading and loading): the same material the pane draws. */
export function surfaceRead(surface: KnowledgeGraphSurface): GraphRead {
  return {status: surface.loading ? 'reading' : 'answered', reading: surface.reading ?? null, error: null, pending: surface.loading ? ['loading'] : [], nodes: GRAPH_READ_NODES}
}
const SURFACE_BOUND = missing('Budget', 'a node bound on the open graph\'s read (KnowledgeSurface.tsx reads at graphProgress.ts\'s own 4096; its handle takes none)', 'the knowledge graph')

/** No key of the graph is refused now: the Aperture page is QL's plan (livingPlan.ts). */
export const GRAPH_REFUSE = {} as const

/** Each view key and the knowledge graph's armed setter that takes it (knowledgeDevices.ts KNOWLEDGE_DECLARED_ROWS write paths). */
export const GRAPH_SETTERS: Readonly<Record<string, string>> = {
  scope: 'shell.setKnowledgeScope', depth: 'shell.setKnowledgeDepth', direction: 'shell.setKnowledgeDirection', shared: 'shell.setKnowledgeShared',
  ghosts: 'shell.setKnowledgeGhosts', text: 'shell.setKnowledgeText', kinds: 'shell.setKnowledgeKinds', relations: 'shell.setKnowledgeRelations',
  orphans: 'shell.setKnowledgeIsolated', mode: 'shell.setKnowledgeContext', labels: 'shell.setKnowledgeLabels', arrows: 'shell.setKnowledgeArrows',
  zoom: 'shell.setKnowledgeZoom',
}
/** The keys that write through the handle's own acts. */
const HANDLE_KEYS = ['selected', 'minimap', 'fit'] as const
const VIEW_KEYS = [...Object.keys(GRAPH_SETTERS), ...HANDLE_KEYS, 'clear'] as const
/** Sessions (§17.3 "What a subject reaches": open only, or open and closed) is the view's own; the design keys it `reach.closed`. */
export const GRAPH_LOCAL = ['budget', ...APERTURE_REQUEST, 'reach.closed'] as const
/** What a subject reaches (§17.3, which took in Impact's reach of §18.6; knowledge-graph__graph.tsx `reach.` keys): References and Sessions
 * are Impact's legs on the browser's selected folder, note or Day (central/devices/groundDevices.ts useImpactDevice: a folder's listing,
 * op files_list; the NOW register, op now kind:list), and the graph's binding is handed neither that selection nor a kernel carrier here. */
export const REACH_ABSENT = 'What a subject reaches: not read here — the Knowledge graph\'s binding (techne/devices/techneDesigns.ts useTechneDesignBindings) is handed neither the browser\'s selected folder, note or Day nor a kernel carrier, which Impact\'s legs read it through (central/devices/groundDevices.ts useImpactDevice: op files_list, op now kind:list).'
const REACH_READINGS = ['reach.subject', 'reach.references', 'reach.sessions'] as const

/** The kernel graph op's answer as the window holds it. */
export interface GraphRead {
  readonly status: 'reading' | 'answered' | 'refused'
  readonly reading: GraphReading | null
  /** The owner's refusal, in its words. */
  readonly error: string | null
  /** The inputs still loading (graphProgress.ts GraphProgress.pending). */
  readonly pending: readonly string[]
  /** The max_nodes this read was asked with. */
  readonly nodes: number
}

/** A coloured group as the design reads it (knowledge-graph__graph.tsx groupsOf): the panel's emphasis group, verbatim. */
const groupOf = (group: EmphasisGroup) => ({id: group.id, label: group.label, color: group.color, text: group.text, kinds: group.kinds, tags: group.tags, enabled: group.enabled})

/** The Knowledge graph's values: the open graph's view state, the kernel's reading and the read's own bound. */
export function graphValues(surface: KnowledgeGraphSurface | null, read: GraphRead | null, held: Readonly<Record<string, Value>> = {}): Values {
  const values: Record<string, Value> = {}
  values.light = surface ? 'lit' : 'dark'
  put(values, 'budget', surface ? GRAPH_READ_NODES : held.budget ?? read?.nodes)
  // Sessions (§17.3): Open only by default, the hand's own.
  put(values, 'reach.closed', held['reach.closed'] ?? false)
  if (read?.reading) values.reading = JSON.stringify(read.reading)
  if (!surface) return values
  const f = surface.filters
  values.selected = surface.selected ?? ''
  values.scope = f.scope
  values.depth = f.depth
  values.direction = f.direction
  values.shared = f.shared
  values.text = f.text
  values.kinds = f.kinds.join('|')
  values.relations = f.relations.join('|')
  values.ghosts = f.unresolved
  values.orphans = f.isolated
  values.mode = f.context
  values.labels = f.labels
  values.arrows = f.arrows
  put(values, 'zoom', surface.zoom)
  values.groups = JSON.stringify(f.emphasis.map(groupOf))
  if (typeof surface.minimap === 'boolean') values.minimap = surface.minimap
  return values
}

/** Where a write goes: an armed setter by path, or the panel's own filter change. Injectable for the tests. */
export interface GraphWrites {
  readonly setter: (path: string, value: unknown) => Promise<unknown>
  readonly patch: (surface: KnowledgeGraphSurface, patch: Partial<KnowledgeGraphSurface['filters']>) => void
}

/** A design value as the setter takes it: the design's lists are `|`-joined, the setters take arrays. */
function decoded(key: string, value: Value): unknown {
  if (key === 'kinds' || key === 'relations') return String(value).split('|').filter(Boolean)
  if (key === 'depth' || key === 'zoom') return Number(value)
  return value
}

export async function graphWrite(surface: KnowledgeGraphSurface | null, changes: readonly ValueChange[], writes: GraphWrites): Promise<void> {
  for (const {key, value} of changes) {
    if (key in GRAPH_REFUSE) throw refusal(GRAPH_REFUSE, key)
    if (!surface) throw Error(NOT_OPEN)
    if (key === 'selected') {
      if (typeof value !== 'string' || !value) throw Error('Select a note on the graph.')
      if (!surface.select) throw Error(missing('Select a note', 'the select act on the open graph\'s handle', 'the knowledge graph'))
      surface.select(value)
      continue
    }
    if (key === 'fit') {
      if (!surface.fit) throw Error(missing('Fit', 'the Fit act on the open graph\'s handle', 'the knowledge graph'))
      surface.fit()
      continue
    }
    if (key === 'minimap') {
      if (!surface.setMinimap) throw Error(missing('Minimap', 'the overview toggle on the open graph\'s handle', 'the knowledge graph'))
      surface.setMinimap(value === true)
      continue
    }
    if (key === 'budget') throw Error(SURFACE_BOUND)
    const group = /^g:(.+)$/.exec(key)
    if (group) {
      const groups = surface.filters.emphasis
      if (!groups.some(candidate => candidate.id === group[1])) throw Error(`No coloured group ${group[1]} stands in the open graph.`)
      writes.patch(surface, {emphasis: groups.map(candidate => candidate.id === group[1] ? {...candidate, enabled: value === true} : candidate)})
      continue
    }
    const path = GRAPH_SETTERS[key]
    if (!path) throw refusal(GRAPH_REFUSE, key)
    if (key === 'depth' && surface.filters.scope !== 'local') throw Error(NOT_LOCAL)
    await writes.setter(path, decoded(key, value))
  }
}

/** Why a key of the design has no reading now. */
export function graphAbsent(surface: KnowledgeGraphSurface | null, read: GraphRead | null, key: string): string {
  if (key in GRAPH_REFUSE) return GRAPH_REFUSE[key as keyof typeof GRAPH_REFUSE]
  if ((REACH_READINGS as readonly string[]).includes(key)) return REACH_ABSENT
  if (key === 'reading') return read?.status === 'refused' ? `The kernel graph op refused: ${read.error ?? 'no reason given'}.` : surface ? 'The open graph has not read its first part yet.' : 'The kernel graph op has not answered yet.'
  if (!surface) return NOT_OPEN
  if (key === 'minimap') return missing('Minimap', 'the overview toggle on the open graph\'s handle', 'the knowledge graph')
  return `${key}: the open graph's handle reports no such reading.`
}
const GRAPH_READINGS = ['reading', 'selected', 'groups'] as const

/** The Knowledge graph's binding on the open graph and the kernel's reading. */
export function graphBinding(surface: KnowledgeGraphSurface | null, read: GraphRead | null, writes: GraphWrites, held: Readonly<Record<string, Value>> = {},
  plan: LivingPlanState = livingPlanState()): DesignBinding {
  const standing: Record<string, Standing> = disabled(GRAPH_REFUSE)
  // The Aperture page: QL's plan for the request you hold (livingPlan.ts).
  for (const key of APERTURE_READINGS) standing[key] = {disabled: livingPlanWhy(plan)}
  if (!surface) for (const key of VIEW_KEYS) standing[key] = {disabled: NOT_OPEN}
  else {
    if (surface.filters.scope !== 'local') standing.depth = {disabled: NOT_LOCAL}
    standing.budget = {disabled: SURFACE_BOUND}
  }
  const values: Record<string, Value> = {...graphValues(surface, read, held), ...livingPlanValues(plan)}
  for (const key of APERTURE_REQUEST) if (held[key] !== undefined) values[key] = held[key]!
  for (const key of GRAPH_READINGS) if (!(key in values) && !(key in standing)) standing[key] = {disabled: graphAbsent(surface, read, key)}
  for (const key of REACH_READINGS) standing[key] = {disabled: REACH_ABSENT}
  return {
    id: GRAPH_ID,
    values,
    standing,
    ...(read === null || (read.status === 'reading' && !read.reading) ? {waiting: ['reading', ...(plan.busy ? APERTURE_READINGS : [])]} : plan.busy && !plan.reading.ok ? {waiting: [...APERTURE_READINGS]} : {}),
    local: handsFor(GRAPH_ID, GRAPH_LOCAL),
    writes: key => key in GRAPH_REFUSE || key in GRAPH_SETTERS || (HANDLE_KEYS as readonly string[]).includes(key) || key.startsWith('g:'),
    write: changes => graphWrite(surface, changes, writes),
  }
}
