// The world an agent is at work in (T-PROCEDURAL-BODY §6 item 1: "inner, the agents at work in that world"). A pure mapping from what the
// sessions provider already holds (agent/AgentSessionsProvider.tsx; its rows are agency/agencyTypes.ts AgencySessionRow) to the System's
// sessions.
//
// An agency row's `raw` is the SessionSpace as AIKit disclosed it (agency/agencySources.ts:36-42), and that space names the projects it
// belongs to: `definition.projects`, which the kernel checks on every read (kernel/src/agency.rs:759-762). Read on 20 Oct with `aikit
// session-space discover --project O-I`: a space named "Factory280 ordinary protected producer Pi" belongs to ["Factory", "O-I"], a root
// space ("Lilt") to ["control:root"]; a project's id is its name (Work/O-I/ProjectCentral/project.json: "project_id": "O-I"). So the row
// itself says where its session is at work, and nothing is guessed.
//
// A space can belong to more than one project; its session rides the first listed that is a world of today's set (a project before the root,
// the narrower world first). Where no listed project is a world of the set (the root's agents, a project the Day did not bring in, a row with
// no space payload), the session rides your world, as every session rode before. (The provider reads the O-I project's agency alone, so it
// holds no root register's session: reading the root's is the provider's to add.)
import type {CentralWorld} from '../../../central/centralWorlds'
import type {SessionLike} from './systemModel'

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** The projects a SessionSpace payload says it belongs to; none for a payload that is not one. */
function projectsOf(space: unknown): readonly string[] {
  const projects = isObject(space) && isObject(space.definition) ? space.definition.projects : undefined
  return Array.isArray(projects) ? projects.filter((project): project is string => typeof project === 'string') : []
}

/** The project of the world a session is at work in: the first project its space lists that a world of `worlds` is of; null is your world. */
export function projectOfSession(row: {readonly raw?: unknown}, worlds: readonly CentralWorld[]): string | null {
  for (const project of projectsOf(row.raw)) {
    const world = worlds.find(candidate => candidate.project === project)
    if (world) return project
  }
  return null
}

/** The System's sessions from the provider's tracks and rows: each track with the project its row's space names. A track with no row (a
 * group, which is a space and no session) says nothing of its world. */
export function sessionsOf(
  tracks: readonly {readonly sessionRef: string; readonly agentName: string | null; readonly purpose: string | null; readonly group: boolean}[],
  rows: readonly {readonly sessionRef: string; readonly raw?: unknown}[],
  worlds: readonly CentralWorld[],
): SessionLike[] {
  return tracks.map(track => {
    const row = rows.find(candidate => candidate.sessionRef === track.sessionRef)
    return {sessionRef: track.sessionRef, agentName: track.agentName, purpose: track.purpose, group: track.group, project: row ? projectOfSession(row, worlds) : null}
  })
}
