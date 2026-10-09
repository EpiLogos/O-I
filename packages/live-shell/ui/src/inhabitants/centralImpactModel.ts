/** Central impact device — select a folder or note: its Central-web
 * neighbourhood, references, and the sessions touching it (WORLD-SHELL-DESIGN
 * §12, central family; ticket L7 commission 2).
 *
 * Port law: the neighbourhood is the knowledge graph owner's answer
 * (`op graph`), the references are the owner's own file listing
 * (`op files_list`) and wiki projection (`op wiki_projection_read`) where it
 * answers, and the sessions touching the subject are the NOW register's own
 * work references (`op now` kind:list) projected over the subject — the
 * matching is declared projection, the rows are the owner's. No second
 * graph, no local reference index, no session store.
 *
 * Aperture law: every leg carries the boundary_op that produced it; a
 * refused leg carries the refusal verbatim and discloses absence.
 *
 * Pure TypeScript. No React, no transport, no store. */

import type {GraphReading} from '../../../../../desktop/cradle/src/knowledge/graph'
import type {BoundaryOpSource} from './centralHygieneModel.ts'

// ---------------------------------------------------------------------------
// owner reading shapes — the graph reading is the owner's own type
// (`oi.cradle.graph-reading/v1`, desktop/cradle/src/knowledge/graph.ts);
// the NOW rows are `central.now-listing/v1`; the directory entries are
// `central.directory-reading/v1`. Carried, not re-declared where the owner
// already declares them.

/** One row of `op now` kind:list — `central.now-listing/v1`. */
export interface NowListRow {
  readonly now_ref: string
  readonly purpose: string
  readonly lifecycle: string
  readonly scope_ref?: string
  readonly task_ref?: string
  readonly work_refs?: readonly {readonly repo: string; readonly branch: string; readonly worktree_path?: string | null}[]
  readonly participant_refs?: readonly string[]
  readonly created_at_unix_seconds?: number
}

/** One entry of `op files_list` — `central.directory-reading/v1`. */
export interface DirectoryEntryRow {
  readonly name: string
  readonly kind: 'file' | 'directory' | 'symlink' | 'other'
  readonly byte_len: number
  readonly location?: {readonly path?: string;readonly ref?: string}
}

// ---------------------------------------------------------------------------
// the impact reading

export type ImpactSubjectKind = 'folder' | 'note' | 'day'

export interface ImpactSubject {
  readonly kind: ImpactSubjectKind
  /** The Central-relative path (the ground's own address space). */
  readonly path: string
  /** The subject's ref when the owner disclosed one (a note's source ref). */
  readonly ref?: string | null
}

export interface ImpactNeighbourhoodNode {
  readonly ref: string
  /** node | source | hosted-row, in the graph owner's own vocabulary. */
  readonly role: 'node' | 'source' | 'unknown'
}

export interface ImpactNeighbourhoodEdge {
  readonly fromRef: string
  readonly toRef: string
  readonly relation: string
  readonly provenance: string | null
  /** Whether this edge directly touches the selected subject. */
  readonly direct: boolean
}

export interface ImpactSessionTouch {
  readonly nowRef: string
  readonly purpose: string
  readonly lifecycle: string
  readonly work: readonly string[]
  readonly boundaryOp: string
}

export interface ImpactLeg {
  readonly name: 'neighbourhood' | 'references' | 'sessions'
  readonly boundaryOp: string
  readonly channel: BoundaryOpSource['channel']
  readonly at: string
  readonly refusal: string | null
}

export interface ImpactReading {
  readonly subject: ImpactSubject
  readonly nodes: readonly ImpactNeighbourhoodNode[]
  readonly edges: readonly ImpactNeighbourhoodEdge[]
  readonly references: readonly DirectoryEntryRow[]
  readonly sessions: readonly ImpactSessionTouch[]
  readonly legs: readonly ImpactLeg[]
}

/** The tail of a Central path, as the graph's refs cite sources
 * (`central:source:control:root:<path>` rows carry the full path). */
function pathTail(path: string): string {
  const parts = path.split('/').filter(part => part.length > 0)
  return parts[parts.length - 1] ?? path
}

/** Whether a graph ref cites the selected subject: by full path (the
 * subject's path appearing in the ref) or by its file tail for notes. */
function refCitesPath(ref: string, subject: ImpactSubject): boolean {
  if (ref.includes(subject.path)) return true
  if (subject.kind === 'note' || subject.kind === 'day') {
    const tail = pathTail(subject.path)
    return tail.length > 4 && ref.includes(tail)
  }
  return false
}

/** Project the neighbourhood: the graph owner's edges, cut to the selected
 * subject's one-hop neighbourhood. Direct edges touch the subject; the
 * endpoints of direct edges are the neighbourhood's nodes; edges between
 * two neighbourhood nodes are kept as the second ring, marked indirect. */
export function projectNeighbourhood(reading: GraphReading, subject: ImpactSubject): {nodes: ImpactNeighbourhoodNode[]; edges: ImpactNeighbourhoodEdge[]} {
  const edges = reading.edges ?? []
  const directEdges = edges.filter(edge => refCitesPath(edge.from_ref, subject) || refCitesPath(edge.to_ref, subject))
  const neighbourhoodRefs = new Set<string>()
  for (const edge of directEdges) {
    neighbourhoodRefs.add(edge.from_ref)
    neighbourhoodRefs.add(edge.to_ref)
  }
  const innerEdges = edges.filter(edge => neighbourhoodRefs.has(edge.from_ref) && neighbourhoodRefs.has(edge.to_ref))
  const projected: ImpactNeighbourhoodEdge[] = [
    ...directEdges.map(edge => ({
      fromRef: edge.from_ref,
      toRef: edge.to_ref,
      relation: edge.relation,
      provenance: edge.provenance?.source ?? null,
      direct: true,
    })),
    ...innerEdges
      .filter(edge => !directEdges.includes(edge))
      .map(edge => ({
        fromRef: edge.from_ref,
        toRef: edge.to_ref,
        relation: edge.relation,
        provenance: edge.provenance?.source ?? null,
        direct: false,
      })),
  ]
  const nodes: ImpactNeighbourhoodNode[] = [...neighbourhoodRefs].map(ref => ({
    ref,
    role: ref.startsWith('wiki:node:') ? 'node' : ref.startsWith('central:source:') ? 'source' : 'unknown',
  }))
  return {nodes, edges: projected}
}

/** The sessions touching the subject: NOW records whose work references
 * name the subject's project — the work ref's repo is (or ends with) the
 * `Work/<Name>` segment, or its worktree path serves that product. The rows
 * are the register's own; the match is declared projection over them. */
export function projectSessions(listing: readonly NowListRow[], subject: ImpactSubject, boundaryOp: string): ImpactSessionTouch[] {
  const product = centralProductForPath(subject.path)
  const touches: ImpactSessionTouch[] = []
  for (const row of listing) {
    const works = row.work_refs ?? []
    const matched = works.filter(work =>
      (product !== null && (work.repo === product || work.repo.endsWith(`/${product}`))) ||
      (product !== null && work.worktree_path !== null && work.worktree_path !== undefined
        && (work.worktree_path.endsWith(`/${product}`) || work.worktree_path.includes(`/${product}/`))),
    )
    if (!matched.length) continue
    touches.push({
      nowRef: row.now_ref,
      purpose: row.purpose,
      lifecycle: row.lifecycle,
      work: matched.map(work => `${work.repo} @ ${work.branch}${work.worktree_path ? ` (${work.worktree_path})` : ''}`),
      boundaryOp,
    })
  }
  return touches
}

/** The Central project (`Work/<Name>`) a path belongs to — the repo name a
 * NOW work ref would carry. Null outside Work/. */
function centralProductForPath(path: string): string | null {
  const match = path.match(/^Work\/([^/]+)/)
  return match ? match[1] : null
}

/** Assemble the full impact reading from the owners' answers and refusals.
 * Every leg names its boundary operation; a refused leg keeps its refusal
 * verbatim and contributes nothing — absence is disclosed, not filled. */
export function assembleImpact(input: {
  subject: ImpactSubject
  graph: {reading: GraphReading; boundaryOp: string; at: string; refusal: string | null}
  files?: {entries: readonly DirectoryEntryRow[]; boundaryOp: string; at: string; refusal: string | null}
  now?: {records: readonly NowListRow[]; boundaryOp: string; at: string; refusal: string | null}
}): ImpactReading {
  const legs: ImpactLeg[] = []
  const neighbourhood = input.graph.refusal
    ? {nodes: [], edges: []}
    : projectNeighbourhood(input.graph.reading, input.subject)
  legs.push({
    name: 'neighbourhood',
    boundaryOp: input.graph.boundaryOp,
    channel: 'kernel-op',
    at: input.graph.at,
    refusal: input.graph.refusal,
  })
  const references = input.files && !input.files.refusal ? input.files.entries : []
  if (input.files) {
    legs.push({name: 'references', boundaryOp: input.files.boundaryOp, channel: 'kernel-op', at: input.files.at, refusal: input.files.refusal})
  }
  const sessions = input.now && !input.now.refusal
    ? projectSessions(input.now.records, input.subject, input.now.boundaryOp)
    : []
  if (input.now) {
    legs.push({name: 'sessions', boundaryOp: input.now.boundaryOp, channel: 'kernel-op', at: input.now.at, refusal: input.now.refusal})
  }
  return {
    subject: input.subject,
    nodes: neighbourhood.nodes,
    edges: neighbourhood.edges,
    references,
    sessions,
    legs,
  }
}

/** One line for the strip: what the subject's impact looks like. */
export function impactSummary(reading: ImpactReading): string {
  const parts = [
    `${reading.nodes.length} neighbourhood node${reading.nodes.length === 1 ? '' : 's'}`,
    `${reading.references.length} reference${reading.references.length === 1 ? '' : 's'}`,
    `${reading.sessions.length} session${reading.sessions.length === 1 ? '' : 's'} touching`,
  ]
  const refused = reading.legs.filter(leg => leg.refusal).length
  if (refused) parts.push(`${refused} leg${refused === 1 ? '' : 's'} refused by their owner`)
  return parts.join(' · ')
}
