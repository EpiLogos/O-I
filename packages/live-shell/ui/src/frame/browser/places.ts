// The browser's Places (manual §10.3: "Down the browser's left side stand Live's three groups: Collections …; the four kinds above …;
// and Places, where your ground lies"):
//
//   | You      | My World, your Days, and the identity you share.                                             |
//   | Agents   | The agents of your roster, accepted and proposed, with the harnesses and skills they carry.  |
//   | Machines | Your machines, and the workcells each one holds.                                             |
//   | Work     | Your projects, each a world with its pages. Add folder… brings in another (§10.11).          |
//   | Packs    | What you installed together: racks with their agents on their chains, songs, and the practice they carry, such as   |
//   |          | Ta-Onta (§25.4). Drag a rack onto a track, a song onto a track, as from anywhere else.                               |
//
// Each place reads its real owner, through a read the shell already asks (PlaceRows.tsx): You — Central's world disclosure
// (world_browse), its day surface (files_list at Control/user/day) and the identities the Studio's Nara chain keeps (nara_identity
// list); Agents — Central's agent profiles (agent_definition roster: accepted and proposed, with their skills) and the agents on this
// computer, which are the census (the World Model's agents slice, O-I ticket 1003), each with what AIKit reads of it (aikit harness
// disclose) as detail on its row, never a row of AIKit's own; Machines — Workcell's status for this machine and its workcell
// (workcell_status_read) and the machines Workcell declares (workcell machine list); Work — Central's Work projects (world_browse). Packs has no owner that lists what was
// installed together (O-I #844): AIKit keeps sets and Factory keeps songs, each read in its own place, and no product's read names a pack
// of them, so the place stands refused, naming the read it waits for (PACKS_WAIT). A place's rows are pure functions of those
// readings here; every row carries the ref its owner gives the thing, so a row can be put in a collection (collections.ts).
import type {RootWorld, WorldProject, NativeFileEntry} from '../../../../../../desktop/cradle/src/kernel/types'
import type {RosterAgent} from '../../../../../../desktop/cradle/src/agency/roster'
import {agentName, type CensusAgent} from '../../../../../../desktop/cradle/src/agency/census'
import {civilDateOfDayFile, dayWords} from './rowWords'

export type PlaceId = 'you' | 'agents' | 'machines' | 'work' | 'packs'

/** The five places, in the manual's order: their names, their hover words, their Info words. */
export const PLACES: readonly {readonly id: PlaceId; readonly label: string; readonly hint: string; readonly info: string}[] = [
  {id: 'you', label: 'You', hint: 'My World, your Days, and the identity you share',
    info: 'You: My World, your Days and the identity you share, from Central and the Studio\'s Nara chain. Select a row to preview it; double-click your world to bring it into today, or a Day to open it. Put any row in a collection from its preview.'},
  {id: 'agents', label: 'Agents', hint: 'the agents of your roster, accepted and proposed, with the harnesses and skills they carry',
    info: 'Agents: the agents of your roster, accepted and proposed, from Central\'s agent profiles, with the skills each carries; then the agents on this computer, each saying whether it starts and whether you can talk to it, or why not. Select one to preview it; put it in a collection from its preview.'},
  {id: 'machines', label: 'Machines', hint: 'your machines, and the workcells each one holds',
    info: 'Machines: this machine and the workcell it holds, from Workcell\'s status, then the machines Workcell declares, each with what it may be asked. Select one to preview it; put it in a collection from its preview.'},
  {id: 'work', label: 'Work', hint: 'your projects, each a world with its pages; Add folder… brings in another',
    info: 'Work: your projects in your ground\'s Work, from Central, each a world with its pages. Double-click a world to bring it into today. Add folder… opens Setup\'s Projects step for a folder of your work (§10.11); nothing moves until you accept.'},
  {id: 'packs', label: 'Packs', hint: 'what you installed together: racks with their agents on their chains, songs, and the practice they carry',
    info: 'Packs: what you installed together — racks with their agents on their chains, songs, and the practice they carry, such as Ta-Onta. Drag a rack onto a track, a song onto a track, as from anywhere else. No owner lists installed packs yet, so this place says what it waits for; your songs stand under Material › Songs in Factory.'},
]

/** What Packs says while no owner lists what was installed together: the plain line, and the read it waits for behind Why. */
export const PACKS_WAIT = {
  said: 'No owner lists what you installed together yet, so Packs holds nothing to show. Your songs stand under Material › Songs in Factory.',
  waitsFor: 'Packs waits for an owner read of installed packs (racks with their agents, songs, and the practice they carry): no aikit, factory or ctrl verb lists one.',
} as const

/** One row of a place. `ref` is the thing's ref as its owner gives it (what a collection keeps); `kind` is what sort of thing it is. */
export interface PlaceRow {
  readonly key: string
  readonly ref: string
  readonly label: string
  readonly kind: 'world' | 'day' | 'identity' | 'agent' | 'harness' | 'machine' | 'workcell' | 'project'
  /** The words in the row's right column. */
  readonly meta: string
  /** What the row is, in words: its preview at the foot of the list and its hover. */
  readonly words: string
  /** The group it stands under inside its place (Days, Identity, Harnesses …); absent for the place's first rows. */
  readonly group?: string
  /** A world a double-click brings into today: its world ref as Central's disclosure names it, and its name. */
  readonly seat?: {readonly ref: string; readonly name: string}
  /** A Day a double-click opens: its listed entry. */
  readonly day?: NativeFileEntry
  /** An agent of the census that starts (a Harnesses row): it drags as an agent, and an empty track it is dropped on seats it there
   * (Factory's seat act, kernel mode_set.rs). One that does not start drags nowhere. */
  readonly starts?: boolean
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null

/** Your world as a row, from Central's root disclosure. Pure. */
export function yourWorldRow(root: RootWorld): PlaceRow {
  const ref = root.control.agent_wiki?.wiki?.space_ref ?? 'central:wiki:root'
  const projects = root.work?.projects?.length ?? 0
  return {key: 'world:control:root', ref: 'control:root', label: 'My World', kind: 'world', meta: 'yours',
    words: `My World — your own world, the root of your ground at ${root.root}; ${plural(projects, 'project')} in its Work. Double-click it to bring it into today.`,
    seat: {ref, name: 'Your world'}}
}

/** Your Days, newest first, from the day surface's listing (central/daySurface.ts dayEntriesOf). Pure. */
export function dayRows(days: readonly NativeFileEntry[]): PlaceRow[] {
  return days.flatMap((entry): PlaceRow[] => {
    const date = civilDateOfDayFile(entry.name)
    if (!date) return []
    const path = entry.location?.path ?? `Control/user/day/${date}/day.md`
    return [{key: `day:${date}`, ref: `central:day:control:root:${date}`, label: dayWords(date) ?? date, kind: 'day', meta: date, group: 'Days',
      words: `${dayWords(date) ?? date} — your Day of ${date}, kept at ${path}. Double-click it to open the Day.`, day: entry}]
  }).sort((a, b) => b.meta.localeCompare(a.meta))
}

/** The identities the Studio's Nara chain keeps (nara_identity list: `{name, person_ref, source_ref, revision}`). Pure. */
export function identityRows(listed: unknown): PlaceRow[] {
  const profiles = isRecord(listed) && Array.isArray(listed.profiles) ? listed.profiles.filter(isRecord) : []
  return profiles.flatMap((profile): PlaceRow[] => {
    const ref = text(profile.source_ref), name = text(profile.name)
    if (!ref || !name) return []
    return [{key: `identity:${ref}`, ref, label: name, kind: 'identity', meta: 'identity', group: 'Identity',
      words: `${name} — the identity you share, kept by the Studio's Nara chain at ${ref}. Open it in the Studio's Nara chain to change it.`}]
  })
}

/** The agents of your roster, accepted first and then proposed, each with the skills it carries. Pure. */
export function agentRows(agents: readonly RosterAgent[]): PlaceRow[] {
  const ordered = [...agents.filter(agent => agent.accepted), ...agents.filter(agent => !agent.accepted)]
  return ordered.map(agent => {
    const skills = agent.skillRefs.length
    const said = [agent.purpose, agent.role ? `its role ${agent.role}` : null, skills ? `it carries ${plural(skills, 'skill')}` : 'it carries no skill yet']
      .filter(Boolean).join('; ')
    return {key: `agent:${agent.ref}`, ref: agent.ref, label: agent.name, kind: 'agent' as const, meta: agent.accepted ? 'accepted' : 'proposed',
      words: `${agent.name} — ${agent.accepted ? 'an accepted agent of your roster' : 'proposed to your roster, not yet accepted'}: ${said}. Its profile is ${agent.profileRef}.`}
  })
}

/** What AIKit's harness disclosure says it reads of each harness (aikit.harness-disclosure/v1 `profiles[].disclosure`: its slug and
 * layers), by slug; the disclosure's envelope is read through. Pure. */
function disclosedLayers(disclosure: unknown): ReadonlyMap<string, readonly string[]> {
  const body = isRecord(disclosure) && isRecord(disclosure.data) && Array.isArray(disclosure.data.profiles) ? disclosure.data : disclosure
  const profiles = isRecord(body) && Array.isArray(body.profiles) ? body.profiles.filter(isRecord) : []
  return new Map(profiles.flatMap((profile): [string, string[]][] => {
    const disclosed = isRecord(profile.disclosure) ? profile.disclosure : null
    const slug = text(disclosed?.slug)
    if (!slug) return []
    return [[slug, Array.isArray(disclosed?.layers) ? disclosed.layers.filter(isRecord).flatMap(layer => text(layer.layer) ? [layer.layer as string] : []) : []]]
  }))
}

/** A why as the end of a sentence: one full stop. */
const sentence = (why: string) => `${why.trim().replace(/[.\s]+$/, '')}.`

/** The agents on this computer: the census (the World Model's agents slice, O-I ticket 1003), one row per agent harness Actuation
 * detects, in its order, saying whether it starts here and whether you can talk to it, or why not. What AIKit reads of an agent (its
 * harness disclosure, `disclosure`) is detail on that agent's row, found by its slug: a harness AIKit only declares a profile for is
 * no agent here, and an agent AIKit has no profile for is listed all the same. Pure. */
export function harnessRows(agents: readonly CensusAgent[], disclosure: unknown = null): PlaceRow[] {
  const layersOf = disclosedLayers(disclosure)
  return agents.map(agent => {
    const name = agentName(agent)
    const why = agent.why ? `: ${sentence(agent.why)}` : ', and the census does not say why.'
    const at = agent.version ? `, at version ${agent.version},` : ''
    const said = !agent.starts ? `It does not start${why}`
      : agent.talks ? `It starts${at} and you can talk to it.` : `It starts${at} but you cannot talk to it${why}`
    const layers = layersOf.get(agent.slug) ?? []
    return {key: `harness:${agent.slug}`, ref: `harness:${agent.slug}`, label: name, kind: 'harness' as const, starts: agent.starts,
      meta: !agent.starts ? 'does not start' : agent.talks ? 'you can talk to it' : 'you cannot talk to it', group: 'Harnesses',
      words: `${name} — an agent on this computer. ${said}${layers.length ? ` AIKit reads its ${layers.join(', ')}.` : ''}`}
  })
}

/** This machine and the workcell it holds (Workcell's status: `workcell_ref`, `health`, `providers`, `connections`). Pure. */
export function thisMachineRows(status: unknown): PlaceRow[] {
  if (!isRecord(status)) return []
  const ref = text(status.workcell_ref)
  if (!ref) return []
  const health = text(status.health)
  const providers = typeof status.providers === 'number' ? status.providers : null
  const connections = Array.isArray(status.connections) ? status.connections.length : null
  const said = [health ? `it stands ${health}` : null, providers !== null ? plural(providers, 'provider') : null,
    connections !== null ? plural(connections, 'connection') : null].filter(Boolean).join('; ')
  return [{key: `workcell:${ref}`, ref, label: 'This machine', kind: 'workcell', meta: ref,
    words: `This machine — it holds the workcell ${ref}${said ? `: ${said}` : ''}.`}]
}

/** The machines Workcell declares (workcell machine list: `{label, endpoint, operations, note}`). Pure. */
export function declaredMachineRows(listed: unknown): PlaceRow[] {
  const machines = isRecord(listed) && Array.isArray(listed.machines) ? listed.machines.filter(isRecord) : []
  return machines.flatMap((machine): PlaceRow[] => {
    const label = text(machine.label), endpoint = text(machine.endpoint)
    if (!label || !endpoint) return []
    const operations = Array.isArray(machine.operations) ? machine.operations.filter((op): op is string => typeof op === 'string') : []
    const note = text(machine.note)
    return [{key: `machine:${label}`, ref: `machine:${label}`, label, kind: 'machine', meta: endpoint, group: 'Declared',
      words: `${label} — a machine Workcell declares at ${endpoint}; ${operations.length ? `it may be asked to ${operations.join(', ')}` : 'it may be asked nothing yet'}.${note ? ` ${note}` : ''}`}]
  })
}

/** Whether a Work project is a world: it keeps a ProjectCentral with a wiki and a human ground (central/centralWorlds.ts worldsOf). */
const worldOf = (project: WorldProject): {ref: string; name: string} | null => {
  const ground = project.projectcentral
  const ref = ground?.agent_wiki?.wiki?.space_ref
  return ref && ground.user?.exists && ground.user.path ? {ref, name: project.world_name?.trim() || project.name} : null
}

/** Your projects in your ground's Work, each a world with its pages where it keeps one. Pure. */
export function workRows(root: RootWorld): PlaceRow[] {
  return (root.work?.projects ?? []).map(project => {
    const world = worldOf(project)
    const name = project.world_name?.trim() || project.name
    return {key: `project:${project.name}`, ref: `project:${project.name}`, label: name, kind: 'project' as const, meta: world ? 'world' : 'folder',
      words: world
        ? `${name} — a project of your Work at ${project.path}, a world with its pages in ${project.projectcentral.user.path}. Double-click it to bring it into today.`
        : `${name} — a folder of your Work at ${project.path}; it keeps no ProjectCentral yet, so it is not a world with pages.`,
      ...(world ? {seat: world} : {})}
  })
}

/** A place's rows that match the search, by their words. Pure. */
export function matching(rows: readonly PlaceRow[], query: string): PlaceRow[] {
  const needle = query.trim().toLocaleLowerCase()
  return needle ? rows.filter(row => `${row.label} ${row.meta} ${row.ref}`.toLocaleLowerCase().includes(needle)) : [...rows]
}
