// Search (DLW §18.4, central:search) on its owner (lane BC3): Central's "@" language, answered by AIKit's knowledge search. The search
// line is the view's own; the owner answers it as typed — the kernel hands the whole query to `aikit knowledge search|resolve --limit 50
// -- <query>` (desktop/cradle/kernel/src/knowledge.rs:600 request_args), read through the cradle's own client (knowledge/client.ts
// `knowledge`) and its progressive pair (knowledge/searchProgress.ts progressiveSearch: the search and the resolution publish
// independently), the pair the cradle's search overlay runs (knowledge/SearchOverlay.tsx). The results are drawn in the owner's
// order. Reach asks the search in one project (op knowledge's `project`). Aliases, the shared fields and a tag's send have no owner.
// Your world (the reach with no project) also asks Central's own search of Control (`control.search` through the kernel's invoke_action,
// T-COVERAGE §1.3): the authored files below Control's roots, Control's retrieval exclusions held by Central; each match is a document,
// its line the result's words. Central's refusal of it is said on Reach, in its words, beside AIKit's results.
// Pure: no React, no transport.
import type {DesignBinding, Value, Values} from '../../frame/devices/designed'
import type {KnowledgeHit} from '../../../../../../desktop/cradle/src/kernel/types'
import type {ResolutionRow} from '../../../../../../desktop/cradle/src/knowledge/searchProgress'
import {heldOf, pageBinding, type DesignWiring} from './pageBindings'
import type {ActionAnswer} from './useCentralReadings'

export const SEARCH_DESIGN = 'central:search'
export const SEARCH_KINDS = ['person', 'agent', 'place', 'document', 'passage', 'power', 'vak'] as const
/** The kernel asks AIKit for this many results (knowledge.rs request_args `--limit 50`). */
export const SEARCH_LIMIT = 50
/** Your world: a search with no project (central__search.tsx ROOT). */
export const SEARCH_ROOT = 'control:root'
/** Central's search of Control, asked for Your world. */
export const CONTROL_SEARCH_ACTION = 'control.search'
/** `@name = search` keeps an alias (central__search.tsx DEFINE): it is no search, and nothing keeps it. */
const DEFINE = /^@([A-Za-z][\w-]*)\s+=\s+(\S.*)$/

const NO_SELECTION = 'The page\'s selection does not cross the host bridge (desktop/cradle/src/document/frame.ts useDocumentHostRead reads the island only): no passage is selected for a tag.'
const NO_TAG = 'A tag sends nothing yet: no owner takes a passage sent to a person, an agent, a place or a document (DLW §18.4 What a tag sends).'
const NO_VAK = 'A vāk entry\'s neighbourhood is Quaternal Logic\'s `ql vak context <ref> <depth>` (ql.vak-context/v1), which no kernel route reaches yet (T-COVERAGE §1.2: vak locate | context).'

export const SEARCH_WIRING: DesignWiring = {
  design: SEARCH_DESIGN,
  keys: ['light', 'query', 'reach', 'fields', 'limit', 'enter', 'k:person', 'k:agent', 'k:place', 'k:document', 'k:passage', 'k:power', 'k:vak', 'selection', 'from', 'pick',
    'results', 'aliases', 'projects', 'vak.depth', 'vak.context'],
  reads: {
    light: 'AIKit answered the search (lit) or refused it (dark), in its own words (op knowledge search)',
    results: 'AIKit\'s hits for the query, in its order (op knowledge search, then resolve; searchProgress.ts progressiveSearch): ref the hit\'s resource, title its label, kind its kind, says its snippet; a resolution row\'s owner; for Your world, then Central\'s matches in Control (control.search: each a document, its path and line, the line\'s words)',
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
    'vak.depth': NO_VAK,
  },
  absent: {
    fields: 'No owner reports the fields a search looks in beside your world.',
    enter: NO_TAG,
    aliases: 'No owner keeps your aliases.',
    selection: NO_SELECTION,
    from: NO_SELECTION,
    projects: 'No project list is handed to this chain.',
    'vak.depth': NO_VAK,
    'vak.context': NO_VAK,
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
  /** Central's search of Control (control.search), asked for Your world only. */
  readonly control?: ActionAnswer
}

/** Central's matches in Control (control-source-search: matches [{target, source_path, line, text}]) as the design's results: each a
 * document at its path and line, the line's words what it says, Control its owner. Null when the answer is not that search. Pure. */
export function controlResultsOf(data: unknown): Record<string, Value>[] | null {
  const doc = data as {matches?: unknown} | null
  if (!doc || !Array.isArray(doc.matches)) return null
  return (doc.matches as {source_path?: unknown; line?: unknown; text?: unknown}[]).flatMap(match => {
    if (typeof match?.source_path !== 'string' || !match.source_path) return []
    const line = typeof match.line === 'number' && Number.isInteger(match.line) ? match.line : null
    return [{ref: line === null ? match.source_path : `${match.source_path}:${line}`, title: match.source_path.split('/').filter(Boolean).pop() ?? match.source_path,
      kind: 'document', ...(typeof match.text === 'string' && match.text.trim() ? {says: match.text.trim()} : {}), owner: 'Control'}]
  })
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
    const control = answer.control?.status === 'answered' ? controlResultsOf(answer.control.value) ?? [] : null
    if (answer.error && !answer.hits.length && !answer.rows.length && !control?.length) values.light = 'dark'
    else if (!answer.pending.includes('search') || control?.length) values.light = 'lit'
    const owned = !answer.error || answer.hits.length || answer.rows.length ? (!answer.pending.includes('search') || answer.hits.length ? searchResultsOf(answer) : null) : null
    if (owned || control) {
      const seen = new Set((owned ?? []).map(row => row.ref))
      values.results = JSON.stringify([...(owned ?? []), ...(control ?? []).filter(row => !seen.has(row.ref))])
    }
  }
  return values
}

/** Search's binding: the view's own search line, reach, kinds and pick; the owner's answers; the unowned acts refused in words. */
export function searchBinding(id: string, answer: SearchAnswer | null, projects: readonly string[] | null): DesignBinding {
  const binding = pageBinding(id, SEARCH_WIRING, searchValues(id, answer, projects), {})
  const shown = !!answer && answer.query === heldOf(id).query
  const standing = {...binding.standing}
  // The owner's refusal of the shown query is said on the search line, as the host says a write's refusal.
  if (shown && answer!.error) standing.query = {...standing.query, refused: answer!.error}
  // Central's refusal of its search of Control is said on Reach: Your world's Control documents are missing, in its words.
  if (shown && answer!.control?.status === 'refused') standing.reach = {...standing.reach, refused: `Your world's Control documents: Central did not search them — ${answer!.control.error}`}
  return {...binding, standing}
}
