// The world's scope for the agent shell's readings (O-I #740 lane B): which registers a reading asks, never a literal project.
//
// A world is its root register and every project Central discloses in it (manual §2 Worlds; §19.1 "In Factory each agent session is a
// track"). The kernel admits a project only when Central's disclosed ground names it (kernel/src/owner_read.rs `disclosed`, the
// "Project is outside Central's disclosed ground" refusal), and every agent op reads the empty label as the root register
// (kernel/src/agent_prepared.rs `location`: "The empty conversation Project label is the renderer's explicit ROOT selection";
// `project_ref` binds it to AIKit's native root binding, `control:root`). Read on 29 Oct against a scratch world whose one project is
// `first-project` (a private walk-bridge, the candidate's frozen owners): `agency_read` with "" answered project_ref `control:root`, with
// "first-project" answered `first-project`, with "O-I" refused "Project is outside Central's disclosed ground".
//
//   - World-wide readings (Factory's sessions, the agent of the world) read the root register and every disclosed project, each session
//     kept with the register it was read under (`project` on its row and track).
//   - Per-session readings read the session's own register; with no session selected they say so in words (NO_SESSION).
//   - The world's projects are the kernel's own world browse (`world_browse`: navigator.root.work.projects, the list the gate checks),
//     asked again a few times while its first browse settles, as central/centralWorlds.ts `readWorlds` does (ROOT_SETTLE).
import {useEffect, useMemo, useReducer} from 'react'
import {kernelRead} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus, RootWorld} from '../../../../../desktop/cradle/src/kernel/types'
import type {AgencyReading, AgencySessionRow} from '../../../../../desktop/cradle/src/agency/agencyTypes'
import {ROOT_SETTLE} from '../central/centralWorlds'
import {agencyEntry} from '../owners/agency'
import {ownerReadings, sameWorld, useOwnerReading, type OwnerRead, type OwnerReading, type OwnerReadingEntry, type OwnerReadings} from '../owners/ownerReading'
import {useSpineEpoch} from '../owners/spine'

/** The root register in an agent op's `project` (kernel/src/agent_prepared.rs `location`): your world's own register. */
export const ROOT_REGISTER = ''

/** The register the frame's Nara channel binds its conversation under, and the M3 clock and the sky's presences ask under: the world's own
 * root register — Nara and the sky answer for the world, not for one of its projects — the same as desktop/cradle/src/nara/answerThis.ts
 * NARA_CHANNEL_PROJECT. The M3 clock must ask where the channel bound its context (kernel nara_context_key by project_ref). */
export const NARA_CHANNEL_REGISTER = ROOT_REGISTER

/** A register as the ops that take `project: string | null` name it: the root is null. */
export const registerOf = (project: string): string | null => project === ROOT_REGISTER ? null : project

/** A register in words: your world for the root, else the project's name. */
export const placeWord = (project: string): string => project === ROOT_REGISTER ? 'your world' : project

/** What a per-session reading says with no session to read. */
export const NO_SESSION = 'No session is selected: select a session (a track in Factory) and its reading follows it.'

/** What the root register's repository reading says: Central's `git_repository_read` reads one project's repository (kernel/src/lib.rs
 * `GitRepositoryRead {project: String}`; asked with "" on 29 Oct it refused "source path must be non-empty"), and your world's root has
 * none. A root reading would be a new owner operation, not this one. */
export const ROOT_KEEPS_NO_REPOSITORY = 'This session works in your world\'s root register, which keeps no repository: Central reads a project\'s repository (git_repository_read), and the root register is no project.'

/** Why a per-session repository reading is not asked, in words: no session selected, or a session of the root register; null when its
 * project is read. Pure. */
export function gitRepositoryAbsence(sessionRef: string | null | undefined, project: string): string | null {
  if (!sessionRef) return NO_SESSION
  return project === ROOT_REGISTER ? ROOT_KEEPS_NO_REPOSITORY : null
}

/** The projects Central discloses in a root reading, in its order (the list the kernel's disclosure gate checks). Pure. */
export function projectsOf(root: Pick<RootWorld, 'work'> | null | undefined): string[] {
  const rows = root?.work?.projects
  if (!Array.isArray(rows)) return []
  const names: string[] = []
  for (const row of rows) if (row && typeof row.name === 'string' && row.name && !names.includes(row.name)) names.push(row.name)
  return names
}

/** The world's projects through the kernel's world browse; a refusal throws, in the kernel's words. A browse that has not yet disclosed
 * a root is asked again `settle.tries` times, `settle.apartMs` apart (ported from central/centralWorlds.ts `readWorlds`). */
export async function readWorldProjects(transport: KernelTransportStatus, settle: {readonly tries: number; readonly apartMs: number} = ROOT_SETTLE): Promise<string[]> {
  if (transport.kind === 'unavailable') throw new Error(transport.reason ?? 'Native transport unavailable')
  for (let attempt = 1; ; attempt++) {
    const answer = await kernelRead(transport, {op: 'world_browse'}, {fresh: attempt > 1})
    if (answer.error || answer.outcome?.result !== 'world_read') throw new Error(answer.error ?? 'Central did not disclose its world')
    const navigator = answer.outcome.snapshot.navigator
    if (navigator?.root) return projectsOf(navigator.root)
    if (navigator?.error || attempt >= settle.tries) throw new Error(navigator?.error ?? 'Central returned no root disclosure')
    await new Promise(resolve => setTimeout(resolve, settle.apartMs))
  }
}

export const worldProjectsKey = (transport: KernelTransportStatus): string => JSON.stringify(['world-projects', transport])

function readProjectsOf(transport: KernelTransportStatus): OwnerRead<string[]> {
  return async () => {
    try { return {value: await readWorldProjects(transport)} } catch (cause) { return {error: cause instanceof Error ? cause.message : String(cause)} }
  }
}

/** The window's one held answer of the world's projects. */
export function worldProjectsEntry(transport: KernelTransportStatus, registry: OwnerReadings = ownerReadings): OwnerReadingEntry<string[]> {
  return registry.entry(worldProjectsKey(transport), readProjectsOf(transport))
}

/** The registers a world-wide reading asks: the root register first, then each project. Null while the world is being read. A world
 * Central could not disclose is read in its root register alone, whose own reading then says why. Pure. */
export function scopesOf(world: Pick<OwnerReading<readonly string[]>, 'status' | 'value'>): string[] | null {
  if (world.status === 'reading') return null
  return [ROOT_REGISTER, ...(world.status === 'answered' && world.value ? world.value.filter(name => name !== ROOT_REGISTER) : [])]
}

/** A row of a world-wide agency reading: the owner's row, with the register it was read under. */
export type WorldSessionRow = AgencySessionRow & {readonly project: string}

export interface WorldAgency {
  /** Every session the world's registers list, each once, in register order (a space two registers list rides the first). */
  rows: WorldSessionRow[]
  /** Each register's refusal, named by its place. */
  refusals: {project: string; error: string}[]
  /** The refusals in words, or null when every register answered. */
  error: string | null
  /** A register is still being read (or the world itself). */
  loading: boolean
  /** When the earliest answer was read: a needle never runs past a reading. */
  readAtUnixMs: number | null
  /** The registers read. */
  scopes: string[]
}

/** The world's agency from each register's standing answer under `epoch` (an answer kept from another world is not drawn). Pure. */
export function mergeAgency(readings: readonly {project: string; reading: OwnerReading<AgencyReading>}[], epoch: string | null, scopesRead = true): WorldAgency {
  const rows: WorldSessionRow[] = []
  const seen = new Set<string>()
  const refusals: {project: string; error: string}[] = []
  let loading = !scopesRead
  let readAtUnixMs: number | null = null
  for (const {project, reading} of readings) {
    const foreign = epoch !== null && reading.epoch !== null && !sameWorld(reading.epoch, epoch)
    if (foreign || reading.status === 'reading') { loading = true; continue }
    if (reading.status === 'refused') { refusals.push({project, error: reading.error ?? 'AIKit SessionSpace reading unavailable'}); continue }
    for (const row of reading.value?.rows ?? []) {
      if (seen.has(row.sessionRef)) continue
      seen.add(row.sessionRef)
      rows.push({...row, project})
    }
    if (reading.readAtUnixMs !== null && reading.readAtUnixMs !== undefined) readAtUnixMs = readAtUnixMs === null ? reading.readAtUnixMs : Math.min(readAtUnixMs, reading.readAtUnixMs)
  }
  return {rows, refusals, error: refusalWords(refusals), loading, readAtUnixMs, scopes: readings.map(item => item.project)}
}

/** Refusals in words: one alone as the owner said it; several each named by its place, a refusal repeated once. Pure. */
export function refusalWords(refusals: readonly {project: string; error: string}[]): string | null {
  if (!refusals.length) return null
  const distinct = [...new Set(refusals.map(item => item.error))]
  if (distinct.length === 1) return distinct[0]
  return refusals.map(item => `${placeWord(item.project)}: ${item.error}`).join('; ')
}

/** The register a session was read under, from rows or tracks that carry it; the root register when none names the session. Pure. */
export function projectOfSession(rows: readonly {readonly sessionRef: string; readonly project?: string}[], sessionRef: string | null | undefined): string {
  if (!sessionRef) return ROOT_REGISTER
  return rows.find(row => row.sessionRef === sessionRef)?.project ?? ROOT_REGISTER
}

/** The world's projects, held for the window (read on mount and the spine's epoch). */
export function useWorldProjects(transport: KernelTransportStatus, enabled = true): OwnerReading<string[]> {
  const epoch = useSpineEpoch()
  const live = enabled && transport.kind !== 'unavailable'
  return useOwnerReading(live ? worldProjectsKey(transport) : null, readProjectsOf(transport), epoch).reading
}

/** The world's agency entries, one per register, subscribed and asked under the epoch; null registers while the world is read. */
export function useWorldAgencyEntries(transport: KernelTransportStatus, enabled = true): {
  scopes: string[] | null
  entries: readonly (readonly [string, OwnerReadingEntry<AgencyReading>])[]
  agency: WorldAgency
  epoch: string
} {
  const epoch = useSpineEpoch()
  const world = useWorldProjects(transport, enabled)
  const live = enabled && transport.kind !== 'unavailable'
  const read = live ? scopesOf(world) : null
  const scopesKey = read ? read.join('\n') : null
  // One array while the registers stand, so a reader's memo moves only when they do.
  const scopes = useMemo(() => (scopesKey === null ? null : scopesKey.split('\n')), [scopesKey])
  const transportKey = JSON.stringify(transport)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the keys name the transport and the registers
  const entries = useMemo(() => live && scopes ? scopes.map(scope => [scope, agencyEntry(transport, scope)] as const) : [], [live, transportKey, scopesKey])
  const [revision, moved] = useReducer((count: number) => count + 1, 0)
  useEffect(() => {
    const offs = entries.map(([, entry]) => entry.subscribe(moved))
    for (const [, entry] of entries) void entry.ensure(epoch)
    return () => { for (const off of offs) off() }
  }, [entries, epoch])
  const agency = useMemo(() => mergeAgency(entries.map(([project, entry]) => ({project, reading: entry.snapshot()})), epoch, scopes !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is each entry's change
    [entries, revision, epoch, scopesKey])
  return {scopes, entries, agency, epoch}
}

/** The world's agency for a reader outside React (the World cut's run lanes): the projects and each register's answer made to stand for
 * `epoch` — the standing answers when they stand, else the one shared read of each — then merged. */
export async function readWorldAgency(transport: KernelTransportStatus, epoch: string, registry: OwnerReadings = ownerReadings): Promise<WorldAgency> {
  if (transport.kind === 'unavailable') return {rows: [], refusals: [], error: transport.reason ?? 'Native transport unavailable', loading: false, readAtUnixMs: null, scopes: []}
  const world = worldProjectsEntry(transport, registry)
  await world.ensure(epoch)
  const scopes = scopesOf(world.snapshot()) ?? [ROOT_REGISTER]
  const entries = scopes.map(scope => [scope, agencyEntry(transport, scope, registry)] as const)
  for (const [, entry] of entries) await entry.ensure(epoch)
  return mergeAgency(entries.map(([project, entry]) => ({project, reading: entry.snapshot()})), epoch)
}
