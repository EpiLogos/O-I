// Factory's clip identities and its tasks' own acts on AIKit. Factory's Set — its Agent sessions as tracks, Factory's tasks as clips on the
// session that executes them, their attempts as takes, the workcells as return tracks — is the kernel's, built from the World Model's
// sessions, factory and workcells slices (kernel mode_set.rs, O-I #1004), and drawn through frame/tracks/kernelSet.ts. What stays here:
// - a task clip's id, `<track id>#task/<n>` (the n-th task on its track): THE selection's ref for it, which `parseFactoryTaskRef` gives
//   back as the session it lies on;
// - a session's and its task's own acts on AIKit (withFactoryTaskActs: Delete, Paste, Insert, a session's Rename and Delete) and the
//   ports they and a task's own Launch answer through (agent/factoryTaskActs.ts).
//
// Pure TypeScript. No React.
import {trackKey, type AgentSessionTrack} from '../agent/agentRunModel'
import type {WorldTrackActions, WorldTrackSet} from './worldTrackAdapter'

/** The owner's answer, verbatim in shape from `harnessAgentControl`: a one-line note, or the refusal. */
export type FactoryControlReceipt = {ok: true; note: string; document?: unknown} | {ok: false; error: string}

/** A Factory task's own acts on its owners, by the session that carries it and the task_ref AIKit names (agent/factoryTaskActs.ts
 * taskLaunchPort): Launch starts the unit Factory names for the task (agent/devices/taskBindings.ts launchTask), its receipt's `document`
 * saying whether Factory `launched` it or had `already-launched` it; Stop asks the unit the task's current attempt stands on to stop
 * (stopAfterTask). Each answers its receipt, or its owner's refusal in words; a task that is not Factory's work (its register keeps no
 * Factory state, Factory names no unit for it, or none of its attempts is current) answers its refusal with `document.status`
 * NOT_FACTORY_WORK, nothing of Factory's moved, and the grid launches or stops it as it did before (the harness, the session's own stop). */
export interface FactoryTaskLaunchPort {
  launch(sessionRef: string, taskRef: string): Promise<FactoryControlReceipt>
  stop(sessionRef: string, taskRef: string): Promise<FactoryControlReceipt>
}
/** A Factory task port's word for a task that is not Factory's work. */
export const NOT_FACTORY_WORK = 'not-factory-work'

const TASK_MARK = '#task/'

/** A task clip's id: its session's track id and its ordinal in that session. */
export const factoryTaskRef = (trackId: string, n: number): string => `${trackId}${TASK_MARK}${n}`

/** The session track id and ordinal a task clip id names; null for anything else. */
export function parseFactoryTaskRef(ref: string): {trackId: string; n: number} | null {
  const at = ref.lastIndexOf(TASK_MARK)
  if (at <= 0) return null
  const n = Number(ref.slice(at + TASK_MARK.length))
  return Number.isSafeInteger(n) && n >= 1 ? {trackId: ref.slice(0, at), n} : null
}

const refused = (error: string): Promise<FactoryControlReceipt> => Promise.resolve({ok: false, error})

/** A session's and its task's own acts on AIKit (O-I #743; manual §10.9, §19.1 "a session is a track, a task is a clip"), each one owner
 * call answering its receipt or refusal in words: a task taken off its session (encounter-task-remove), copied onto a session holding none
 * (encounter-task-copy), a blank task made on a session holding none (encounter-task-configure naming its purpose only), the session's own
 * name (encounter-session-settings `track.name`) and the session taken off the set (the SessionSpace's detach-agent-session). */
export interface FactoryTaskActs {
  remove(sessionRef: string): Promise<FactoryControlReceipt>
  copy(fromSession: string, toSession: string): Promise<FactoryControlReceipt>
  blank(sessionRef: string): Promise<FactoryControlReceipt>
  rename(sessionRef: string, name: string): Promise<FactoryControlReceipt>
  detach(sessionRef: string): Promise<FactoryControlReceipt>
  /** The session's own name as AIKit's settings read it, or null while it has none (or is unread). */
  nameOf(sessionRef: string): string | null
  /** The register a session was read in (agent/worldScope.ts): a task is copied within one. */
  projectOf(sessionRef: string): string
}

/** The ops these acts name. */
export const FACTORY_TASK_REMOVE_OP = 'AIKit encounter-task-remove — the session\'s task taken off it on the revision read; AIKit keeps its record in the task\'s history'
export const FACTORY_TASK_COPY_OP = 'AIKit encounter-task-copy — the task made again on the session it is pasted on (which must hold none), from that session\'s own standing, its settings carried; Cut then takes the task off its own session'
export const FACTORY_TASK_BLANK_OP = 'AIKit encounter-task-configure — a blank task (its purpose only) on a session that holds none, the rest from the session\'s standing'
export const FACTORY_SESSION_NAME_OP = 'AIKit encounter-session-settings {track: {name}} — the session\'s own name, against the revision that stands'
export const FACTORY_SESSION_DETACH_OP = 'AIKit SessionSpace detach-agent-session — the session taken off the set: detached from the Project\'s spaces that hold it; the session, its task and settings stay AIKit\'s'

/** The words for a blank task's purpose: AIKit makes a task of a purpose, and a blank one says only that it is new. */
export const FACTORY_BLANK_PURPOSE = 'A new task'

/** Factory's set with its sessions' and tasks' own acts (FactoryTaskActs) and each session's own name on its track. A group is a
 * SessionSpace, not a session: its acts are refused in words. An id the set does not hold is refused before any owner call. Pure, apart
 * from the acts it hands back. */
export function withFactoryTaskActs(set: WorldTrackSet, sessions: readonly AgentSessionTrack[], acts: FactoryTaskActs): WorldTrackSet {
  const sessionOf = new Map(sessions.map(track => [trackKey(track), track]))
  const tasks = new Map(set.clips.map(clip => [clip.trackId, clip]))
  const named = (trackId: string) => set.tracks.find(track => track.id === trackId)?.name ?? trackId
  const label = (track: AgentSessionTrack) => acts.nameOf(track.sessionRef) ?? named(trackKey(track))
  const session = (trackId: string): AgentSessionTrack | string => {
    const track = sessionOf.get(trackId)
    if (!track) return `"${trackId}" is not a session of this work.`
    if (track.group) return `${named(trackId)} is a group of sessions (a SessionSpace), not a session: its sessions are its own tracks.`
    return track
  }
  const holds = (trackId: string) => tasks.get(trackId)
  const tracks = set.tracks.map(track => {
    const own = sessionOf.get(track.id)
    const name = own && !own.group ? acts.nameOf(own.sessionRef) : null
    return name ? {...track, name} : track
  })
  const actions: WorldTrackActions = {...set.actions,
    deleteClip: {op: FACTORY_TASK_REMOVE_OP, run: clipId => {
      const parsed = parseFactoryTaskRef(clipId)
      const clip = set.clips.find(item => item.id === clipId)
      if (!parsed || !clip) return refused(`"${clipId}" is not a task of this work.`)
      const track = session(parsed.trackId)
      if (typeof track === 'string') return refused(track)
      if (clip.status === 'running') return refused(`${clip.label} is running on ${label(track)}: stop it first, then Delete takes it off the session.`)
      return acts.remove(track.sessionRef)
    }},
    pasteClip: {op: FACTORY_TASK_COPY_OP, run: async (fromClipId, trackId, _rowId, cut) => {
      const parsed = parseFactoryTaskRef(fromClipId)
      const from = parsed ? session(parsed.trackId) : `"${fromClipId}" is not a task of this work.`
      if (typeof from === 'string') return refused(from)
      const to = session(trackId)
      if (typeof to === 'string') return refused(to)
      const held = holds(trackId)
      if (held) return refused(`A session holds one task: ${label(to)} holds ${held.label}. Paste the task on a session that holds none.`)
      if (acts.projectOf(from.sessionRef) !== acts.projectOf(to.sessionRef)) return refused(`${label(from)} and ${label(to)} work in different registers: a task is copied within one.`)
      const copied = await acts.copy(from.sessionRef, to.sessionRef)
      if (!copied.ok || !cut) return copied
      const removed = await acts.remove(from.sessionRef)
      return removed.ok ? {...copied, note: `${copied.note} The task is off ${label(from)} now (${removed.note})`}
        : {ok: false, error: `${copied.note} But the task stays on ${label(from)}: ${removed.error}`}
    }},
    insertClip: {op: FACTORY_TASK_BLANK_OP, run: trackId => {
      const track = session(trackId)
      if (typeof track === 'string') return refused(track)
      const held = holds(trackId)
      if (held) return refused(`A session holds one task: ${label(track)} holds ${held.label}. Insert a task on a session that holds none.`)
      return acts.blank(track.sessionRef)
    }},
    renameTrack: {op: FACTORY_SESSION_NAME_OP, run: (trackId, name) => {
      const track = session(trackId)
      if (typeof track === 'string') return refused(track)
      if (!name.trim()) return refused('A session\'s name is text.')
      return acts.rename(track.sessionRef, name.trim())
    }},
    removeTrack: {op: FACTORY_SESSION_DETACH_OP, run: trackId => {
      const track = session(trackId)
      if (typeof track === 'string') return refused(track)
      return acts.detach(track.sessionRef)
    }},
  }
  return {...set, tracks, actions}
}
