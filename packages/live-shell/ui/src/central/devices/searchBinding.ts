// Search (DLW §18.4, central:search) on its owner (lane BC3): Central's "@" language, answered by AIKit's knowledge search. The search
// line is the view's own; the owner answers it as typed — the kernel hands the whole query to `aikit knowledge search|resolve --limit 50
// -- <query>` (desktop/cradle/kernel/src/knowledge.rs:600 request_args), read through the cradle's own client (knowledge/client.ts
// `knowledge`) and its progressive pair (knowledge/searchProgress.ts progressiveSearch: the search and the resolution publish
// independently), the pair the cradle's search overlay runs (knowledge/SearchOverlay.tsx). The results are drawn in the owner's
// order. Reach asks the search in one project (op knowledge's `project`). Aliases, the shared fields and a tag's send have no owner.
// Pure: no React, no transport.
import type {DesignBinding, Value, Values} from '../../frame/devices/designed'
import type {KnowledgeHit} from '../../../../../../desktop/cradle/src/kernel/types'
import type {ResolutionRow} from '../../../../../../desktop/cradle/src/knowledge/searchProgress'
import {heldOf, pageBinding, type DesignWiring} from './pageBindings'

export const SEARCH_DESIGN = 'central:search'
export const SEARCH_KINDS = ['person', 'agent', 'place', 'document', 'passage', 'power'] as const
/** The kernel asks AIKit for this many results (knowledge.rs request_args `--limit 50`). */
export const SEARCH_LIMIT = 50
/** Your world: a search with no project (central__search.tsx ROOT). */
export const SEARCH_ROOT = 'control:root'
/** `@name = search` keeps an alias (central__search.tsx DEFINE): it is no search, and nothing keeps it. */
const DEFINE = /^@([A-Za-z][\w-]*)\s+=\s+(\S.*)$/

const NO_SELECTION = 'The page\'s selection does not cross the host bridge (desktop/cradle/src/document/frame.ts useDocumentHostRead reads the island only): no passage is selected for a tag.'
const NO_TAG = 'A tag sends nothing yet: no owner takes a passage sent to a person, an agent, a place or a document (DLW §18.4 What a tag sends).'

export const SEARCH_WIRING: DesignWiring = {
  design: SEARCH_DESIGN,
  keys: ['light', 'query', 'reach', 'fields', 'limit', 'enter', 'k:person', 'k:agent', 'k:place', 'k:document', 'k:passage', 'k:power', 'selection', 'from', 'pick',
    'results', 'aliases', 'projects'],
  reads: {
    light: 'AIKit answered the search (lit) or refused it (dark), in its own words (op knowledge search)',
    results: 'AIKit\'s hits for the query, in its order (op knowledge search, then resolve; searchProgress.ts progressiveSearch): ref the hit\'s resource, title its label, kind its kind, says its snippet; a resolution row\'s owner',
    limit: `${SEARCH_LIMIT}: the kernel asks AIKit for ${SEARCH_LIMIT} results (desktop/cradle/kernel/src/knowledge.rs request_args)`,
    projects: 'the projects the shell reaches (the browser\'s projects, when the chain is handed them)',
  },
  writes: {},
  local: {
    query: 'the search line: AIKit answers it as typed',
    reach: 'your world, or one project: the search is asked in that project (op knowledge `project`)',
    pick: 'the result the pane shows',
    ...Object.fromEntries(SEARCH_KINDS.map(kind => [`k:${kind}`, 'which kinds the list shows: the view cuts the owner\'s results'])),
  },
  refused: {
    fields: 'No owner searches the shared or joined fields from here: op knowledge reads your own world.',
    limit: `The kernel asks AIKit for ${SEARCH_LIMIT} results: no owner takes another number.`,
    enter: NO_TAG,
    aliases: 'No owner keeps an alias: it would live only in this view, and an alias is yours to keep (DLW §18.4 Rules).',
  },
  absent: {
    fields: 'No owner reports the fields a search looks in beside your world.',
    enter: NO_TAG,
    aliases: 'No owner keeps your aliases.',
    selection: NO_SELECTION,
    from: NO_SELECTION,
    projects: 'No project list is handed to this chain.',
  },
}

/** What the owner answered for one query (searchProgress.ts SearchSnapshot, reduced): its hits and rows, or its refusal. */
export interface SearchAnswer {
  readonly query: string
  readonly hits: readonly KnowledgeHit[]
  readonly rows: readonly ResolutionRow[]
  /** The search's own refusal (the resolution's is an absence, as the overlay keeps it). */
  readonly error?: string
  /** Owner operations still answering. */
  readonly pending: readonly string[]
}

/** The owner's results as the design's (central__search.tsx hitOf): ref, title, kind, says, owner. A kind the design does not know is
 * kept and drawn by its horizon rule; nothing is invented. */
export function searchResultsOf(answer: SearchAnswer): Record<string, Value>[] {
  const seen = new Set<string>()
  const out: Record<string, Value>[] = []
  for (const hit of answer.hits) {
    if (seen.has(hit.resource)) continue
    seen.add(hit.resource)
    out.push({ref: hit.resource, title: hit.label || hit.resource, kind: hit.kind, ...(hit.snippet ? {says: hit.snippet} : {})})
  }
  for (const row of answer.rows) {
    if (seen.has(row.reference)) continue
    seen.add(row.reference)
    out.push({ref: row.reference, title: row.label || row.reference, kind: String(row.kind), ...(row.owner ? {owner: row.owner} : {})})
  }
  return out
}

/** The search the owner is asked now: the held query, unless it keeps an alias or is empty. */
export function searchQueryOf(id: string): string | null {
  const query = heldOf(id).query
  if (typeof query !== 'string' || !query.trim() || DEFINE.test(query.trim())) return null
  return query
}

/** The project a search is asked in: none for your world, the named one for a project reach. */
export function searchProjectOf(id: string): string | undefined {
  const reach = heldOf(id).reach
  return typeof reach === 'string' && reach.startsWith('project:') ? reach.slice('project:'.length) : undefined
}

/** Search's readings (SEARCH_WIRING). `answer` is the owner's answer for the held query (null before any). */
export function searchValues(id: string, answer: SearchAnswer | null, projects: readonly string[] | null): Values {
  const values: Record<string, Value> = {}
  const held = heldOf(id)
  const query = typeof held.query === 'string' ? held.query : ''
  values.query = query
  values.reach = held.reach ?? SEARCH_ROOT
  for (const kind of SEARCH_KINDS) values[`k:${kind}`] = held[`k:${kind}`] ?? true
  if (held.pick !== undefined) values.pick = held.pick
  values.limit = SEARCH_LIMIT
  if (projects) values.projects = JSON.stringify(projects)
  // The answer stands for the query it answered only: a newer query is unread until the owner answers it.
  if (answer && answer.query === query) {
    if (answer.error && !answer.hits.length && !answer.rows.length) values.light = 'dark'
    else if (!answer.pending.includes('search')) values.light = 'lit'
    if (!answer.error || answer.hits.length || answer.rows.length) {
      if (!answer.pending.includes('search') || answer.hits.length) values.results = JSON.stringify(searchResultsOf(answer))
    }
  }
  return values
}

/** Search's binding: the view's own search line, reach, kinds and pick; the owner's answers; the unowned acts refused in words. */
export function searchBinding(id: string, answer: SearchAnswer | null, projects: readonly string[] | null): DesignBinding {
  const binding = pageBinding(id, SEARCH_WIRING, searchValues(id, answer, projects), {})
  // The owner's refusal of the shown query is said on the search line, as the host says a write's refusal.
  return answer?.error && answer.query === heldOf(id).query
    ? {...binding, standing: {...binding.standing, query: {...binding.standing?.query, refused: answer.error}}}
    : binding
}
