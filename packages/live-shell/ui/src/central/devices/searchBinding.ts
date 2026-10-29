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
const NO_TAG = 'The pane sends nothing: a tag sends from the search line (⌘K, or @ in a Flow entry or the agent\'s composer; central/searchLine.tsx), where a Flow takes the passage as a new entry and an agent\'s session takes it as a turn. No owner takes a passage sent to a person, a place or another document (DLW §18.4 What a tag sends).'
/** No `vak:` term in the search: no entry is located and no neighbourhood read. */
const NO_VAK_TERM = 'The search names no `vak:` term (a coordinate of the Vāk registry, `vak:M0-3`), so Quaternal Logic is asked for no entry and no neighbourhood.'
/** A `vak:` term (central__search.tsx VAK_TERM): the coordinate it names. */
const VAK_TERM = /(?:^|\s)vak:(M0\S*)/
/** The neighbourhood's depth when the hand has not moved it, and QL's own bound (`ql vak context <ref> <depth>`: 0 to 2). */
export const VAK_DEPTH = {start: 1, max: 2} as const

export const SEARCH_WIRING: DesignWiring = {
  design: SEARCH_DESIGN,
  keys: ['light', 'query', 'reach', 'fields', 'limit', 'enter', 'k:person', 'k:agent', 'k:place', 'k:document', 'k:passage', 'k:power', 'k:vak', 'selection', 'from', 'pick',
    'results', 'aliases', 'projects', 'vak.depth', 'vak.context'],
  reads: {
    light: 'AIKit answered the search (lit) or refused it (dark), in its own words (op knowledge search)',
    results: 'AIKit\'s hits for the query, in its order (op knowledge search, then resolve; searchProgress.ts progressiveSearch): ref the hit\'s resource, title its label, kind its kind, says its snippet; a resolution row\'s owner; for Your world, then Central\'s matches in Control (control.search: each a document, its path and line, the line\'s words)',
    limit: `${SEARCH_LIMIT}: the kernel asks AIKit for ${SEARCH_LIMIT} results (desktop/cradle/kernel/src/knowledge.rs request_args)`,
    projects: 'the projects the shell reaches (the browser\'s projects, when the chain is handed them)',
    'vak.context': 'the located entry\'s neighbourhood: Quaternal Logic\'s `ql vak context <ref> <depth>` (ql.vak-context/v1) through the kernel\'s ql_read vak-context, as {centre, depth, revision, entries: [[ref, name, symbol, source line]], relations: [[from, relation, into]]}; the entry itself is `ql vak locate <ref>` (ql_read vak-locate), among the results as a vak-entry',
  },
  writes: {},
  local: {
    query: 'the search line: AIKit answers it as typed',
    reach: 'your world, or one project: the search is asked in that project (op knowledge `project`)',
    pick: 'the result the pane shows',
    'vak.depth': 'how far round the located entry the neighbourhood is asked: 0 to 2, QL\'s own bound',
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
    'vak.context': NO_VAK_TERM,
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
  /** Quaternal Logic's answers for the `vak:` term in the query: the entry located and its neighbourhood (kernel ql_read). */
  readonly vak?: VakAnswer
}

/** One `vak:` term asked of Quaternal Logic: the coordinate, the depth asked, and each read's answer or refusal in QL's words. */
export interface VakAnswer {
  readonly ref: string
  readonly depth: number
  readonly locate: ActionAnswer
  readonly context: ActionAnswer
}

/** The coordinate the search's `vak:` term names, or null. Pure. */
export function vakTermOf(query: string | null | undefined): string | null {
  return query ? VAK_TERM.exec(query)?.[1] ?? null : null
}

/** The depth the hand asked, held to QL's bound. Pure. */
export function vakDepthOf(held: unknown): number {
  return typeof held === 'number' && Number.isInteger(held) ? Math.max(0, Math.min(VAK_DEPTH.max, held)) : VAK_DEPTH.start
}

/** `ql vak locate <ref>` ({vakRef, name, symbol, primaryDesignation, standing, sourceLine}) as the design's result: a vak-entry, its name its
 * title, its designation what it says, Quaternal Logic its owner, and no horizon (QL states none). Null when the answer is not that. Pure. */
export function vakEntryResultOf(data: unknown): Record<string, Value> | null {
  const d = data as {vakRef?: unknown; name?: unknown; primaryDesignation?: unknown} | null
  if (!d || typeof d.vakRef !== 'string' || !d.vakRef) return null
  return {ref: d.vakRef, title: typeof d.name === 'string' && d.name ? d.name : d.vakRef, kind: 'vak-entry',
    ...(typeof d.primaryDesignation === 'string' && d.primaryDesignation ? {says: d.primaryDesignation} : {}), owner: 'Quaternal Logic'}
}

/** `ql vak context <ref> <depth>` (ql.vak-context/v1: centre, depth, entries, relations, sourceRevision) as the design's `vak.context`:
 * every entry [ref, name, symbol, source line], the centre among them, every relation [from, relation, into]. Null when it is not that. */
export function vakContextValueOf(data: unknown): string | null {
  const d = data as {contract?: unknown; centre?: unknown; depth?: unknown; sourceRevision?: unknown; entries?: unknown; relations?: unknown} | null
  if (!d || d.contract !== 'ql.vak-context/v1' || !Array.isArray(d.entries) || !Array.isArray(d.relations)) return null
  const entryOf = (raw: unknown): [string, string, string, number] | [string, string, string] | null => {
    const e = raw as {vakRef?: unknown; name?: unknown; symbol?: unknown; source?: {sourceLine?: unknown}} | null
    if (!e || typeof e.vakRef !== 'string' || !e.vakRef) return null
    const line = typeof e.source?.sourceLine === 'number' ? e.source.sourceLine : null
    const head: [string, string, string] = [e.vakRef, typeof e.name === 'string' && e.name ? e.name : e.vakRef, typeof e.symbol === 'string' ? e.symbol : '']
    return line === null ? head : [...head, line]
  }
  const centre = entryOf(d.centre)
  if (!centre) return null
  const entries = d.entries.flatMap(raw => { const e = entryOf(raw); return e ? [e] : [] })
  if (!entries.some(e => e[0] === centre[0])) entries.unshift(centre)
  const relations = d.relations.flatMap(raw => {
    const r = raw as {fromRef?: unknown; relation?: unknown; intoRef?: unknown} | null
    return r && typeof r.fromRef === 'string' && typeof r.relation === 'string' && typeof r.intoRef === 'string' ? [[r.fromRef, r.relation, r.intoRef]] : []
  })
  return JSON.stringify({centre: centre[0], depth: typeof d.depth === 'number' ? d.depth : 0, ...(typeof d.sourceRevision === 'string' ? {revision: d.sourceRevision} : {}), entries, relations})
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

/** The owner's own use count for a hit (AIKit's `ranking.destination`: how many opens it observed, and its frecency — how often and how
 * lately, decayed by the owner's half-life; aikit-core resource/search.rs apply_familiarity). Absent where the owner gives none. */
function usedOf(hit: KnowledgeHit): {used?: number; frecency?: number} {
  const destination = (hit as KnowledgeHit & {ranking?: {destination?: {observations?: unknown; frecency?: unknown}}}).ranking?.destination
  if (!destination) return {}
  const observations = typeof destination.observations === 'number' && destination.observations > 0 ? destination.observations : undefined
  const frecency = typeof destination.frecency === 'number' && Number.isFinite(destination.frecency) ? destination.frecency + 0 : undefined
  return {...(observations ? {used: observations} : {}), ...(frecency !== undefined ? {frecency} : {})}
}

/** The owner's results as the design's (central__search.tsx hitOf): ref, title, kind, says, owner — and, for the search line, the address
 * the owner gave to open it by (as JSON) and its own use count (usedOf). A kind the design does not know is kept and drawn by its horizon
 * rule; nothing is invented. */
export function searchResultsOf(answer: SearchAnswer): Record<string, Value>[] {
  const seen = new Set<string>()
  const out: Record<string, Value>[] = []
  for (const hit of answer.hits) {
    if (seen.has(hit.resource)) continue
    seen.add(hit.resource)
    out.push({ref: hit.resource, title: hit.label || hit.resource, kind: hit.kind, ...(hit.snippet ? {says: hit.snippet} : {}),
      ...(hit.address ? {address: JSON.stringify(hit.address)} : {}), ...usedOf(hit)})
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
  values['vak.depth'] = vakDepthOf(held['vak.depth'])
  // The answer stands for the query it answered only: a newer query is unread until the owner answers it.
  if (answer && answer.query === query) {
    const control = answer.control?.status === 'answered' ? controlResultsOf(answer.control.value) ?? [] : null
    if (answer.error && !answer.hits.length && !answer.rows.length && !control?.length) values.light = 'dark'
    else if (!answer.pending.includes('search') || control?.length) values.light = 'lit'
    const owned = !answer.error || answer.hits.length || answer.rows.length ? (!answer.pending.includes('search') || answer.hits.length ? searchResultsOf(answer) : null) : null
    // The `vak:` term's entry stands first among the results, as QL located it; its neighbourhood is `vak.context`.
    const vak = answer.vak && answer.vak.ref === vakTermOf(query) ? answer.vak : undefined
    const entry = vak?.locate.status === 'answered' ? vakEntryResultOf(vak.locate.value) : null
    if (owned || control || entry) {
      const rows = [...(entry ? [entry] : []), ...(owned ?? []), ...(control ?? [])]
      const seen = new Set<Value>()
      values.results = JSON.stringify(rows.filter(row => (seen.has(row.ref) ? false : (seen.add(row.ref), true))))
    }
    const context = vak?.context.status === 'answered' ? vakContextValueOf(vak.context.value) : null
    if (context) values['vak.context'] = context
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
  // Quaternal Logic's refusal of the `vak:` term is said on the Vāk kind and on the depth, in its words.
  const vak = shown ? answer!.vak : undefined
  if (vak?.locate.status === 'refused') standing['k:vak'] = {...standing['k:vak'], refused: `vak:${vak.ref}: Quaternal Logic located no entry — ${vak.locate.error}`}
  if (vak?.context.status === 'refused') standing['vak.depth'] = {...standing['vak.depth'], refused: `vak:${vak.ref}: Quaternal Logic read no neighbourhood — ${vak.context.error}`}
  return {...binding, standing}
}
