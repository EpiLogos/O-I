// The shared owner answers several views read at once, each held once for the window (owners/ownerReading.ts):
//
//   - `encounter_task_read` — one session's task record (AIKit `aikit.encounter-task/v1`), keyed by project and session;
//     read by the sessions provider's clips and budget, the Factory chain's lights and the transport's metrics;
//   - `encounter_session_settings` — one session's own settings and its bound task's (AIKit
//     `aikit.encounter-session-settings/v1`), keyed by project and session; read by Factory's Clip view and its mixer row;
//   - `agent_definition` roster — Central's accepted agent profiles (`central.agent-profile-roster/v1`), keyed by register
//     (null = the root, else a project); read by the sessions provider, the agent browser's Skillsets, the Factory chain, the
//     Central devices and the agent widget;
//   - `workcell_status_read` — the machine's workcell standing, keyed by transport alone (the op takes no argument); read by
//     the agent browser's Git rows, the Factory chain's seat, the Central devices and the ground hygiene device.
//
// Each read is the op exactly as its readers asked it before (agent/useAgentMetrics.ts readEncounterTask, moved here,
// desktop/cradle/src/agency/nativeAgentClient.ts nativeAgentOwner, inhabitants/CentralHygieneDevice.tsx:70), with the same
// refusal words. What a notice re-reads:
//   - a task record: an act on its session; the selected session's with every agency read (owners/agency.ts);
//   - the roster and the workcell standing: the window regained (they move outside the shell: a profile accepted, a seat
//     joined) once their answer is older than a minute;
//   - all three: the spine's epoch, and the person's Retry.

// Ported reads: agent/useAgentMetrics.ts at 98385f92d :7-14 (`readEncounterTask`), desktop/cradle/src/agency/nativeAgentClient.ts:4-10
// (`nativeAgentOwner`, the roster request), central/devices/useCentralReadings.ts at 98385f92d :111-133 (`useWorkcellReading`);
// `composeRoster` is desktop/cradle/src/agency/roster.ts:70-76 `readRoster`'s composition over two held answers.
import {useEffect, useMemo, useReducer} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {EncounterSessionSettingsReading, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {rosterFromReading, type RosterAgent} from '../../../../../desktop/cradle/src/agency/roster'
import {scopesOf} from './ownerCall'
import {ensureInOrder, ownerReadings, sameWorld, useOwnerReading, type OwnerRead, type OwnerReading, type OwnerReadings, type OwnerReadingEntry} from './ownerReading'
import {useSpineEpoch} from './spine'
import {onAttentionRegained} from './attention'
import {onOwnerChanged} from './notices'

const unavailableReason = (transport: KernelTransportStatus): string | null =>
  transport.kind === 'unavailable' ? transport.reason ?? 'Transport unavailable' : null

/** Where sessions' own readings are asked: one register for them all, or each session's own (the register its world-wide agency read
 * listed it in, agent/worldScope.ts) — '' is the root register. */
export type SessionProjects = string | ((agentSession: string) => string)
export const projectFor = (projects: SessionProjects, agentSession: string): string => typeof projects === 'function' ? projects(agentSession) : projects

// ---- encounter_task_read ---------------------------------------------------------------------------------------------

export const TASK_OP = 'encounter_task_read'
export const taskReadingKey = (transport: KernelTransportStatus, project: string, agentSession: string): string =>
  JSON.stringify([TASK_OP, transport, project, agentSession])

/** One session's task record; `value` null is the owner's honest absence (no task bound). */
export function readTaskOf(transport: KernelTransportStatus, project: string, agentSession: string): OwnerRead<unknown> {
  return async () => {
    const unavailable = unavailableReason(transport)
    if (unavailable) return {error: unavailable}
    const result = await kernelOp(transport, {op: 'encounter_task_read', project, agent_session: agentSession})
    if (result.error || result.outcome?.result !== 'encounter_task_reading') return {error: result.error ?? 'AIKit did not return a task reading'}
    return {value: result.outcome.data ?? null, ...scopesOf(result.outcome)}
  }
}

export function taskReadingEntry(transport: KernelTransportStatus, project: string, agentSession: string, registry: OwnerReadings = ownerReadings): OwnerReadingEntry<unknown> {
  return registry.entry(taskReadingKey(transport, project, agentSession), readTaskOf(transport, project, agentSession))
}

// ---- encounter_session_settings ---------------------------------------------------------------------------------------

export const SETTINGS_OP = 'encounter_session_settings'
export const settingsReadingKey = (transport: KernelTransportStatus, project: string, agentSession: string): string =>
  JSON.stringify([SETTINGS_OP, transport, project, agentSession])

/** One session's settings and its bound task's (`aikit.encounter-session-settings/v1`): every value as it stands, defaults stated. */
export function readSettingsOf(transport: KernelTransportStatus, project: string, agentSession: string): OwnerRead<EncounterSessionSettingsReading> {
  return async () => {
    const unavailable = unavailableReason(transport)
    if (unavailable) return {error: unavailable}
    const result = await kernelOp(transport, {op: 'encounter_session_settings', project, agent_session: agentSession})
    if (result.error || result.outcome?.result !== 'encounter_session_settings_reading') return {error: result.error ?? 'AIKit did not return the session\'s settings'}
    return {value: result.outcome.data, ...scopesOf(result.outcome)}
  }
}

export function settingsReadingEntry(transport: KernelTransportStatus, project: string, agentSession: string, registry: OwnerReadings = ownerReadings): OwnerReadingEntry<EncounterSessionSettingsReading> {
  return registry.entry(settingsReadingKey(transport, project, agentSession), readSettingsOf(transport, project, agentSession))
}

// ---- agent_definition roster -----------------------------------------------------------------------------------------

export const ROSTER_OP = 'agent_definition'
export const rosterReadingKey = (transport: KernelTransportStatus, project: string | null): string =>
  JSON.stringify([ROSTER_OP, transport, project, {action: 'roster'}])

/** A dev-bridge fetch can fail transiently: such a failure is asked again inside the one read (the sessions provider's own
 * rule, agent/AgentSessionsProvider.tsx at 98385f92d :142-166 — six attempts, 3 s apart); a named owner refusal is final. */
export const ROSTER_TRANSPORT_ATTEMPTS = 6
export const ROSTER_TRANSPORT_RETRY_MS = 3_000
const TRANSPORT_FAILURE = /fetch|network|abort/i

/** One register's roster reading, the owner's `central.agent-profile-roster/v1` document as `value`. */
export function readRosterOf(transport: KernelTransportStatus, project: string | null, retryMs = ROSTER_TRANSPORT_RETRY_MS): OwnerRead<unknown> {
  return async () => {
    const unavailable = unavailableReason(transport)
    if (unavailable) return {error: unavailable}
    let error = 'Native Agent owner returned no reading'
    for (let attempt = 0; attempt < ROSTER_TRANSPORT_ATTEMPTS; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, retryMs))
      const result = await kernelOp(transport, {op: 'agent_definition', project, request: {action: 'roster'}})
      if (!result.error && result.outcome?.result === 'agent_definition_reading') return {value: result.outcome.data, ...scopesOf(result.outcome)}
      error = result.error ?? error
      if (!TRANSPORT_FAILURE.test(error)) break
    }
    return {error}
  }
}

// ---- workcell_status_read --------------------------------------------------------------------------------------------

export const WORKCELL_OP = 'workcell_status_read'
export const workcellReadingKey = (transport: KernelTransportStatus): string => JSON.stringify([WORKCELL_OP, transport])

export function readWorkcellOf(transport: KernelTransportStatus): OwnerRead<unknown> {
  return async () => {
    const unavailable = unavailableReason(transport)
    if (unavailable) return {error: unavailable}
    const result = await kernelOp(transport, {op: 'workcell_status_read'})
    if (result.error || result.outcome?.result !== 'workcell_status_reading') return {error: result.error ?? 'the workcell status reading did not answer'}
    return {value: result.outcome.data ?? null, ...scopesOf(result.outcome)}
  }
}

// ---- what re-reads them ----------------------------------------------------------------------------------------------

/** An answer older than this is read again when the person comes back to the window (roster, workcell). */
export const ATTENTION_MIN_AGE_MS = 60_000

const familyOf = (key: string): string | null => { try { return (JSON.parse(key) as unknown[])[0] as string } catch { return null } }
const sessionOf = (key: string): string | null => { try { return (JSON.parse(key) as unknown[])[3] as string } catch { return null } }

/** Refresh the held entries of one family that a notice reaches, each under the epoch it stands in (an entry that never
 * answered has nothing to refresh; a remembered refusal is left for the person or the next epoch). */
export function refreshHeld(registry: OwnerReadings, family: string, options: {minAgeMs?: number; agentSession?: string; at?: number} = {}): number {
  let asked = 0
  for (const entry of registry.entries()) {
    if (familyOf(entry.key) !== family || entry.readers === 0) continue
    if (options.agentSession && sessionOf(entry.key) !== options.agentSession) continue
    const standing = entry.snapshot()
    if (!standing.epoch || standing.status === 'refused') continue
    const age = entry.ageAt(options.at ?? Date.now())
    if (options.minAgeMs !== undefined && age !== null && age < options.minAgeMs) continue
    void entry.refresh(standing.epoch)
    asked++
  }
  return asked
}

let installed = false
/** The window's notices for these three families, installed once for the window's registry. */
function installNotices() {
  if (installed || typeof window === 'undefined') return
  installed = true
  onAttentionRegained(() => {
    refreshHeld(ownerReadings, ROSTER_OP, {minAgeMs: ATTENTION_MIN_AGE_MS})
    refreshHeld(ownerReadings, WORKCELL_OP, {minAgeMs: ATTENTION_MIN_AGE_MS})
  })
  // An act on one session re-reads that session's task record. The window regained and an act that names no session reach the
  // task records through the agency driver instead (owners/agency.ts): each agency read re-reads the selected session's record,
  // as the agency cadence always carried it; the others were read once and are read again only when an act names them.
  // A rebound task changes which task the session's settings answer for: its settings are read with it.
  onOwnerChanged('agency', change => {
    if (!change.agentSession) return
    refreshHeld(ownerReadings, TASK_OP, {agentSession: change.agentSession})
    refreshHeld(ownerReadings, SETTINGS_OP, {agentSession: change.agentSession})
  })
}

// ---- hooks -----------------------------------------------------------------------------------------------------------

/** One session's task record in its register `project`, shared with every other reader of it. `sessionRef` null reads nothing. */
export function useTaskAnswer(transport: KernelTransportStatus, sessionRef: string | null, project: string) {
  installNotices()
  const epoch = useSpineEpoch()
  const key = sessionRef ? taskReadingKey(transport, project, sessionRef) : null
  return useOwnerReading(key, sessionRef ? readTaskOf(transport, project, sessionRef) : NOTHING, epoch)
}

/** One session's settings in its register `project`, shared with every other reader of them. `sessionRef` null reads nothing. */
export function useSettingsAnswer(transport: KernelTransportStatus, sessionRef: string | null, project: string) {
  installNotices()
  const epoch = useSpineEpoch()
  const key = sessionRef ? settingsReadingKey(transport, project, sessionRef) : null
  return useOwnerReading(key, sessionRef ? readSettingsOf(transport, project, sessionRef) : NOTHING, epoch)
}

/** Many sessions' settings (a view of many tracks: the mixer row's Telemetry and Solo), in one owner read: each answer stands in
 * its session's shared entry, where the Clip view and the Tasks device read it too. Sessions are read again when the epoch moves;
 * a write to one re-reads that one (agent/sessionSettings.ts). The map holds the sessions answered. */
export function useSettingsAnswers(transport: KernelTransportStatus, sessionRefs: readonly string[], projects: SessionProjects): ReadonlyMap<string, EncounterSessionSettingsReading> {
  installNotices()
  const epoch = useSpineEpoch()
  // Each session with its register: the list op is asked once per register, for that register's sessions.
  const wanted = sessionRefs.map(ref => `${projectFor(projects, ref)}\u0000${ref}`).join('\n')
  const transportKey = JSON.stringify(transport)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entries = useMemo(() => wanted ? wanted.split('\n').map(pair => { const [project, ref] = pair.split('\u0000'); return settingsReadingEntry(transport, project, ref) }) : [], [transportKey, wanted])
  const [, changed] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const offs = entries.map(entry => entry.subscribe(changed))
    const unread = entries.filter(entry => entry.snapshot().epoch !== epoch || entry.snapshot().status === 'reading')
    if (unread.length && transport.kind !== 'unavailable') {
      const byProject = new Map<string, OwnerReadingEntry<EncounterSessionSettingsReading>[]>()
      for (const entry of unread) {
        const project = (JSON.parse(entry.key) as unknown[])[2] as string
        byProject.set(project, [...(byProject.get(project) ?? []), entry])
      }
      for (const [project, held] of byProject) {
        const refs = held.map(entry => (JSON.parse(entry.key) as unknown[])[3] as string)
        void kernelOp(transport, {op: 'encounter_session_settings_list', project, agent_sessions: refs}).then(result => {
          if (result.error || result.outcome?.result !== 'encounter_session_settings_list_reading') return
          for (const reading of result.outcome.data.readings) {
            const entry = held.find(item => (JSON.parse(item.key) as unknown[])[3] === reading.agent_session)
            if (entry && !('refused' in reading)) entry.accept(reading, epoch, result.outcome.read_scopes)
          }
        })
      }
    }
    return () => offs.forEach(off => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, epoch])
  const held = new Map<string, EncounterSessionSettingsReading>()
  for (const entry of entries) {
    const standing = entry.snapshot()
    if (standing.status === 'answered' && standing.value) held.set(standing.value.agent_session, standing.value)
  }
  return held
}

/** One register's roster (project null = the root), shared. `enabled` false defers the read (nothing subscribes). */
export function useRosterAnswer(transport: KernelTransportStatus, project: string | null, enabled = true) {
  installNotices()
  const epoch = useSpineEpoch()
  return useOwnerReading(enabled ? rosterReadingKey(transport, project) : null, readRosterOf(transport, project), epoch)
}

/** The machine's workcell standing, shared. */
export function useWorkcellAnswer(transport: KernelTransportStatus) {
  installNotices()
  const epoch = useSpineEpoch()
  return useOwnerReading(workcellReadingKey(transport), readWorkcellOf(transport), epoch)
}

const NOTHING: OwnerRead<never> = async () => ({error: 'nothing to read'})

export interface RosterAgentsReading {
  state: 'reading' | 'ready' | 'error'
  agents: RosterAgent[]
  error?: string
  /** When the older of the two registers' answers was read. */
  readAtUnixMs: number | null
  retry: () => void
}

/** The agents of a whole world: the root register's, and each project's own first (in the world's order), over the shared roster
 * answers — `useRosterAgents` widened from one project to the world's projects (agent/worldScope.ts). `enabled` false defers the read. */
export function useWorldRosterAgents(transport: KernelTransportStatus, projects: readonly string[], enabled = true): RosterAgentsReading {
  installNotices()
  const epoch = useSpineEpoch()
  const root = useRosterAnswer(transport, null, enabled)
  const basis = enabled && transport.kind !== 'unavailable' ? JSON.stringify([transport, projects]) : null
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the basis names the transport and the projects
  const entries = useMemo(() => basis ? projects.map(project => ownerReadings.entry(rosterReadingKey(transport, project), readRosterOf(transport, project))) : [], [basis])
  const [revision, moved] = useReducer((count: number) => count + 1, 0)
  useEffect(() => {
    const offs = entries.map(entry => entry.subscribe(moved))
    let live = true
    void ensureInOrder(entries, epoch, () => live)
    return () => { live = false; for (const off of offs) off() }
  }, [entries, epoch])
  return useMemo(() => {
    const own = entries.map(entry => { const standing = entry.snapshot(); return standing.epoch !== null && !sameWorld(standing.epoch, epoch) ? READING_ROSTER : standing })
    return composeRosters(root.reading, own, () => { root.retry(); for (const entry of entries) void entry.retry(epoch) })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is each entry's change
  }, [root.reading, entries, revision, epoch])
}

const READING_ROSTER: OwnerReading<unknown> = {status: 'reading', value: null, error: null, readAtUnixMs: null, epoch: null, refreshing: true, carried: false}

/** The agents available in a scope, exactly as desktop/cradle/src/agency/roster.ts `readRoster` composes them — the root
 * register, plus the project's own register first when a project is named — over the shared roster answers. */
export function useRosterAgents(transport: KernelTransportStatus, project?: string, enabled = true): RosterAgentsReading {
  const root = useRosterAnswer(transport, null, enabled)
  const own = useRosterAnswer(transport, project ?? null, enabled && !!project)
  return useMemo(() => composeRoster(root.reading, project ? own.reading : null, () => { root.retry(); if (project) own.retry() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [root.reading, own.reading, project])
}

/** The composition, pure: a refusal of either register is the reading's error (the same words readRoster threw). */
export function composeRoster(root: OwnerReading<unknown>, own: OwnerReading<unknown> | null, retry: () => void): RosterAgentsReading {
  return composeRosters(root, own ? [own] : [], retry)
}

/** The composition over the root and any number of project registers, pure: the projects' own agents first, in order, then the
 * root's not already named; a refusal of any register is the reading's error. */
export function composeRosters(root: OwnerReading<unknown>, owns: readonly OwnerReading<unknown>[], retry: () => void): RosterAgentsReading {
  const readings = [root, ...owns]
  const refused = readings.find(reading => reading.status === 'refused')
  if (refused) return {state: 'error', agents: [], error: refused.error ?? 'The agent roster did not answer', readAtUnixMs: refused.readAtUnixMs, retry}
  if (readings.some(reading => reading.status !== 'answered')) return {state: 'reading', agents: [], readAtUnixMs: null, retry}
  try {
    const rootAgents = rosterFromReading(root.value)
    const readAtUnixMs = Math.min(...readings.map(reading => reading.readAtUnixMs ?? Infinity))
    if (!owns.length) return {state: 'ready', agents: rootAgents, readAtUnixMs, retry}
    const ownAgents: RosterAgent[] = []
    const seen = new Set<string>()
    for (const own of owns) {
      for (const agent of rosterFromReading(own.value, rootAgents.length + ownAgents.length)) {
        if (seen.has(agent.ref)) continue
        seen.add(agent.ref)
        ownAgents.push(agent)
      }
    }
    return {state: 'ready', agents: [...ownAgents, ...rootAgents.filter(agent => !seen.has(agent.ref))], readAtUnixMs, retry}
  } catch (cause) {
    return {state: 'error', agents: [], error: cause instanceof Error ? cause.message : String(cause), readAtUnixMs: null, retry}
  }
}

/** Subscribe to many task records at once (a provider holding every session's clips): one subscription per session, each
 * ensured under the epoch. Returns nothing; read each entry's snapshot. */
export function useTaskEntries(transport: KernelTransportStatus, projects: SessionProjects, sessionRefs: readonly string[], epoch: string, onChange: () => void) {
  installNotices()
  // Each session with its register (a session moved to another register is another entry).
  const key = sessionRefs.map(ref => `${projectFor(projects, ref)}\u0000${ref}`).join('\n')
  useEffect(() => {
    if (transport.kind === 'unavailable') return
    const entries = sessionRefs.map(ref => taskReadingEntry(transport, projectFor(projects, ref), ref))
    const offs = entries.map(entry => entry.subscribe(onChange))
    // Sequentially, as the provider always read them, so the kernel never sees a pile of task reads at once.
    let live = true
    void (async () => { for (const entry of entries) { if (!live) return; await entry.ensure(epoch) } })()
    return () => { live = false; for (const off of offs) off() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport, key, epoch])
}
