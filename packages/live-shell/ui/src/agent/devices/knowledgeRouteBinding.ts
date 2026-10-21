// The Knowledge route on its owners (lane W4; DLW §19.9, ai-kit:knowledge-route — "Kind: effect · Chain: inside the Scope device"; §16.1
// "one Scope … with the Knowledge route inside it"). It stands inside a session's Scope (factoryPlaces.ts INSIDE), for the agent seated
// on that session.
//
// What the owners report (real shape: AIKit's `aikit --json knowledge status`, aikit.knowledge-application/v1, read on workcell:mac 21 Oct,
// tests/fixtures/knowledge-route-2026-10-21.json, read-only):
//   `knowledge status` (the kernel's knowledge op {action: status}, desktop/cradle/kernel/src/knowledge.rs Request::Status): each lens's
//     answer — `wiki` {available, detail}, `sources` [{provider, available, detail}] with `project_map` (the project's knowledge: its
//     source pools and its map), `code` {available, detail} — and the `absences` AIKit names verbatim. Each lens's Ready and Why:
//       Wiki     unavailable: withheld, its detail; an absence naming the wiki's own budget (knowledge.wiki_…): withheld, that absence;
//                else ready.
//       Project  no source pool available: withheld; some unavailable, or no project map: degraded, naming each; else ready.
//       Code     unavailable: withheld, its detail; AIKit's absence "GitNexus CodeIndex degraded for Work/<project>": degraded, that
//                absence; else ready.
// What nothing reports, each absent with the operation it waits for:
//   the lenses the agent may search (wiki, project, code): Central's AgentProfile carries sources, not lenses — knowledge_source_refs
//     names source refs (on 21 Oct, 39 personal profiles: 21 with none, the rest central:source:… or file:// refs). agent-profile.save
//     writes that list, and no vocabulary maps a lens onto it, so a lens request has no writer;
//   the pages read and the links round the last hit: AIKit's `knowledge history` (aikit.knowledge-application-history/v1) records each
//     route with an empty context — no session, no task — so no page can be said to be this agent's in this task; the relation view
//     (`knowledge relations`) is asked round a hit, and without the agent's last hit there is none to ask round;
//   Reach and the level of each source: Scope reports no reach (designBindings.ts scopeValues), and the levels are Central's
//     central.world.effective-sources, which nothing here asks without a reach to compare them with;
//   Link depth, Read budget, Search first: the kernel asks relations at depth 2 for every caller (knowledge.rs RELATIONS_DEPTH), and no
//     operation carries a per-agent depth, budget or order;
//   Affected: no AIKit command reports the transitive impact for the route's readings (the library computes it inside `aikit flow
//     changed-since` and the Contemplate preflight), so there is no reading to read again or forget.
// Pure.
import type {DesignBinding, Standing, Value, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {chainDeviceId} from './agentChainDevices'
import {familyFaceDevice} from './mainTrackBindings'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)

export const KNOWLEDGE_ROUTE_DESIGN = 'ai-kit:knowledge-route'
/** The Knowledge route on the door: one device, inside the session's Scope (the agent chain's `world` slot). */
export const KNOWLEDGE_ROUTE_ID = `${chainDeviceId('world')}/knowledge-route`

/** The Knowledge route as a device of the runtime: AIKit's admitted `knowledge-route` face (aiKitFamilyManifest.ts), so
 * designKey('ai-kit', 'knowledge-route') is the design's id by the family's own declaration. Null when the family does not admit it. */
export function knowledgeRouteDevice(): DeviceInstance | null {
  return familyFaceDevice(KNOWLEDGE_ROUTE_ID, 'ai-kit', 'knowledge-route', 'Knowledge route', 'orbit')
}

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
const unread = (what: string, op: string, owner: string) => `${what}: no reading reaches it yet — missing op: ${op} (${owner}).`

type Lens = 'wiki' | 'project' | 'code'
const LENSES: readonly Lens[] = ['wiki', 'project', 'code']

/** Why a lens request has no writer, with what the seated agent's profile names (its knowledge_source_refs), where it is read. */
export function lensRequestRefused(sources: readonly string[] | null): string {
  const named = sources === null ? 'no agent\'s profile is read here' : !sources.length ? 'the seated agent\'s profile names no knowledge source'
    : `the seated agent's profile names ${sources.length} source${sources.length === 1 ? '' : 's'} (${sources.slice(0, 2).join(', ')}${sources.length > 2 ? ', …' : ''})`
  return missing('The sources the agent may search', `a lens-level request on the AgentProfile — Central's knowledge_source_refs carries source refs, not lenses, and agent-profile.save writes that list (${named})`, 'Central')
}

/** The keys no owner reports here, each with the reading it waits for. */
export const KNOWLEDGE_ABSENT = {
  pages: unread('The pages read in this task', 'a knowledge history by session or task — `aikit knowledge history` (aikit.knowledge-application-history/v1) records each route with an empty context', 'AIKit'),
  graph: unread('The links round the last hit', 'the agent\'s last hit, to ask `aikit knowledge relations` or `aikit knowledge frame <address>` round it (the history names no session; the kernel\'s aikit_read knowledge-frame takes at least one address, and no reading names one as this agent\'s)', 'AIKit'),
  reach: unread('Reach', 'the scope reach on the world device (WO-SF2): Scope reports none', 'Software Factory'),
  level: unread('The level that holds each source', 'central.world.effective-sources, asked against a Reach Scope does not report yet', 'Central'),
  light: unread('Whether the route is on', 'a reading of the route\'s standing for the agent', 'AIKit'),
  affected: unread('Affected', 'an AIKit command reporting the transitive impact for the route\'s readings (computed inside `aikit flow changed-since` and the Contemplate preflight only)', 'AIKit'),
} as const

/** The controls no owner operation carries, each with the operation it lacks. */
export const KNOWLEDGE_REFUSE = {
  depth: missing('Link depth', 'a per-agent depth on `aikit knowledge relations` (the kernel asks depth 2 for every caller: knowledge.rs RELATIONS_DEPTH)', 'AIKit'),
  budget: missing('Read budget', 'a per-agent ceiling on the pages a task opens', 'AIKit'),
  searchFirst: missing('Search first', 'a per-agent order of search and links on the route', 'AIKit'),
  refresh: 'Read again: Affected is not reported, so no reading stands to read again (the kernel\'s knowledge use would read it at its new basis).',
  forget: 'Forget: Affected is not reported, so no reading stands to forget (`aikit knowledge forget destination <resource>` reaches AIKit through the kernel\'s aikit_write since lane W3 round 3).',
} as const

/** Each lens's answer from AIKit's `knowledge status`, or null when the reading cannot be read as one. */
export function lensAnswers(status: unknown, project: string): Record<Lens, {ready: 'ready' | 'degraded' | 'withheld'; why?: string}> | null {
  if (!isObj(status) || !Array.isArray(status.sources) || typeof status.project_map !== 'boolean') return null
  const absences = [...new Set((Array.isArray(status.absences) ? status.absences : []).filter((item): item is string => typeof item === 'string'))]
  const provider = (value: unknown): {available: boolean; detail?: string} | null => isObj(value) && typeof value.available === 'boolean'
    ? {available: value.available, ...(str(value.detail) ? {detail: value.detail as string} : {})} : null
  const wiki = provider(status.wiki), code = provider(status.code)
  const sources = status.sources.flatMap(item => (isObj(item) && typeof item.available === 'boolean' ? [{name: str(item.provider) ?? 'a source pool', available: item.available, detail: str(item.detail)}] : []))
  const wikiBudget = absences.filter(item => /\(knowledge\.wiki_[a-z_]+\)/.test(item))
  const codeDegraded = absences.filter(item => item.startsWith(`GitNexus CodeIndex degraded for Work/${project}:`))
  const down = sources.filter(item => !item.available)
  return {
    wiki: !wiki ? {ready: 'withheld', why: 'AIKit reports no wiki provider.'} : !wiki.available ? {ready: 'withheld', ...(wiki.detail ? {why: wiki.detail} : {})}
      : wikiBudget.length ? {ready: 'withheld', why: wikiBudget.join(' ')} : {ready: 'ready'},
    project: !sources.length || down.length === sources.length ? {ready: 'withheld', why: down.length ? down.map(item => `${item.name}: ${item.detail ?? 'unavailable'}`).join('; ') : 'AIKit reports no source pool.'}
      : down.length || !status.project_map ? {ready: 'degraded', why: [...down.map(item => `${item.name}: ${item.detail ?? 'unavailable'}`), ...(status.project_map ? [] : ['The project map is unavailable.'])].join('; ')}
      : {ready: 'ready'},
    code: !code ? {ready: 'withheld', why: 'AIKit reports no code index.'} : !code.available ? {ready: 'withheld', ...(code.detail ? {why: code.detail} : {})}
      : codeDegraded.length ? {ready: 'degraded', why: codeDegraded.join(' ')} : {ready: 'ready'},
  }
}

export interface KnowledgeRouteInput {
  /** AIKit's `knowledge status` data, null while unread or refused. */
  readonly status: unknown
  /** AIKit's refusal of the status, in its words, where it refused. */
  readonly statusError?: string | null
  /** The project whose code index the route reads (the kernel's knowledge op runs in its folder). */
  readonly project: string
  /** The seated agent's accepted profile (designBindings.ts seatedProfile), null when none is seated or read. */
  readonly profile: Readonly<Record<string, unknown>> | null
}

/** The route's values: each lens's answer and its reason, from AIKit's status. Every other key is absent (KNOWLEDGE_ABSENT). */
export function knowledgeRouteValues(input: KnowledgeRouteInput): Values {
  const values: Record<string, Value> = {}
  const answers = lensAnswers(input.status, input.project)
  if (answers) for (const lens of LENSES) {
    values[`ready:${lens}`] = answers[lens].ready
    const why = answers[lens].why
    if (why) values[`why:${lens}`] = why
  }
  return values
}

/** The seated profile's knowledge sources, or null when no profile is read. */
const sourcesOf = (profile: Readonly<Record<string, unknown>> | null): string[] | null =>
  profile ? (Array.isArray(profile.knowledge_source_refs) ? profile.knowledge_source_refs.filter((ref): ref is string => typeof ref === 'string') : []) : null

/** The route's binding: the lenses' answers as readings; every absent reading stands with what it waits for, every control disabled
 * with the operation it lacks, and a press is refused in the same words. Nothing here writes. */
export function knowledgeRouteBinding(input: KnowledgeRouteInput, id: string = KNOWLEDGE_ROUTE_ID): DesignBinding {
  const lens = lensRequestRefused(sourcesOf(input.profile))
  const reasons: Record<string, string> = {wiki: lens, project: lens, code: lens, ...KNOWLEDGE_REFUSE}
  // Each absent reading stands with the reading it waits for; each refused control with the operation it lacks.
  const absent: Record<string, string> = {pages: KNOWLEDGE_ABSENT.pages, graph: KNOWLEDGE_ABSENT.graph, reach: KNOWLEDGE_ABSENT.reach, light: KNOWLEDGE_ABSENT.light,
    affected: KNOWLEDGE_ABSENT.affected, ...Object.fromEntries(LENSES.map(item => [`level:${item}`, KNOWLEDGE_ABSENT.level]))}
  // Each lens's answer is AIKit's: unread, every Ready and Why waits on the status; read, a lens with nothing wrong has no Why.
  const answers = lensAnswers(input.status, input.project)
  const unreadStatus = `Each source's answer: AIKit's knowledge status ${input.statusError ? `refused — ${input.statusError}` : 'has not answered'} (the kernel's knowledge op, action status).`
  for (const item of LENSES) {
    if (!answers) absent[`ready:${item}`] = unreadStatus
    if (!answers || !answers[item].why) absent[`why:${item}`] = answers ? `${item}: AIKit names nothing wrong with this source; it is ${answers[item].ready}.` : unreadStatus
  }
  const standing: Record<string, Standing> = Object.fromEntries(Object.entries({...absent, ...reasons}).map(([key, why]) => [key, {disabled: why}]))
  return {
    id,
    values: knowledgeRouteValues(input),
    standing,
    writes: key => key in reasons,
    write: async changes => {
      for (const {key} of changes) throw Error(reasons[key] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
    },
  }
}
