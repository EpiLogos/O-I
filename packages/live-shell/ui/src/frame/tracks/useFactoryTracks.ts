// Factory's tracks for the one Session and Arrangement (FOUNDATION F3; manual §6): the agent sessions as tracks, their tasks as
// clips. A hook over the published reading, which carries the kernel carrier. It reads the sessions with `useAgencySessions`
// — the one agency store, never a second poll of its own — and projects them with timeline/factoryTrackAdapter.ts.
//
// Its actions go through the one owner path the agent shell already uses, `harness_agent_control` on the bound harness
// (agent/harnessAgentControl.ts, the binding agent/useHarnessBinding.ts resolves — as agent/AgentShellRoot.tsx:23-33 wires the
// grid's hard stop and retry). With no carrier, or a harness binding the kernel has not resolved, there is no owner path and
// so no action: the grid stays read-only and says so.
//
// The tasks and the needles come from the sessions provider (agent/AgentSessionsProvider.tsx). Mounted above this pane, every
// caller reads its one poll; unmounted, `useAgencySessions` serves its own fallback — the sessions, with no tasks and no needles.
//
// Attempts as takes: each session's served attempts (AIKit) read with the Runs that hold them (Factory) lie as take lanes under its
// track, and choosing one is Factory's own op (owners/attemptTakes.ts).
//
// R3: the event lanes read the same provider's temporal events (AgentSessionsProvider `events`, the frame's one temporal read),
// and every session's Arm is the shell's one write arm — the transport's own press (shell/transports/useFactoryTransport.tsx:92
// `dispatch('arm', 'shell.setWriteArm', …)`), through the same registered setter (inhabitants/sdk/shellSetters.ts), its light the
// agent shell's flag, which the setter bridge moves only when the owner accepts (agent/shellSetterBridge.ts).
import {useCallback, useMemo} from 'react'
import type {EncounterSessionSettingsReading, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {useAgencySessions} from '../../agent/useAgencySessions'
import {useAgentSessionsOptional} from '../../agent/AgentSessionsProvider'
import {useAgentShellOptional} from '../../agent/AgentShellContext'
import {useHarnessBinding} from '../../agent/useHarnessBinding'
import {harnessAgentControl} from '../../agent/harnessAgentControl'
import {withChatSeat} from '../../agent/factoryChatsReopen'
import {shellSetter} from '../../inhabitants/sdk/shellSetters'
import {factoryTrackAdapter, type FactoryAttention, type FactoryControls, type FactorySettingsPort, type FactoryWriteArm} from '../../timeline/factoryTrackAdapter'
import {readSettingsOf, useSettingsAnswers} from '../../owners/readers'
import {useAttemptTakes} from '../../owners/attemptTakes'
import {makeTakes, takeRunOf, trackSettingChange, writeSessionSettings} from '../../agent/sessionSettings'
import {makeNewTaskOf, taskMaker, type SessionAddress} from '../../agent/clipBinding'
import {songOfNote, songTakes} from '../../agent/songClips'
import {clipHostId, viewHoldsOf} from '../detail/clipBinding'
import {projectOfSession, ROOT_REGISTER} from '../../agent/worldScope'
import {withClipMaker} from './clipMakers'
import {encounter} from '../../../../../../desktop/cradle/src/encounter/client'
import {tellOwnerChanged} from '../../owners/notices'
import type {UseModeTracks} from './modeTracks'
import {useSeatStatusAnswer} from '../../agent/devices/workcellReads'
import {withReturns, withWorksIn, workcellReturns} from './returnTracks'
import type {WorldActionReceipt, WorldTrack, WorldTrackActions, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import {publishedDevice} from '../devices/deviceDoor'
import {COMMUNIQUE_DRAG, MESSAGES_ID, communiqueDragOf} from '../../agent/devices/railTileIds'
import {trackKey, type AgentSessionTrack} from '../../agent/agentRunModel'

const WRITE_ARM = 'shell.setWriteArm'

/** The shell's write arm as the tracks press it: the registered setter's receipt, or the refusal that none is registered. */
export function shellWriteArm(on: boolean | null, setter: typeof shellSetter = shellSetter): FactoryWriteArm {
  return {
    on,
    set: async value => {
      const dispatch = setter(WRITE_ARM)
      if (!dispatch) return {ok: false, error: `${WRITE_ARM} is not registered in this session: the transport's write arm registers it, so the press reached no owner.`}
      // The setter's receipt (inhabitants/sdk/shellSetters.ts DispatchReceipt), in the words the views show: fired with its note, or
      // refused with its reason and the op it names.
      const receipt = await dispatch(value)
      return receipt.kind === 'fired' ? {ok: true, note: receipt.note}
        : {ok: false, error: `${receipt.reason}${receipt.missingOp ? ` — missing op: ${receipt.missingOp}` : ''}`}
    },
  }
}

const NO_CARRIER: KernelTransportStatus = {kind: 'unavailable', reason: 'The shell has published no kernel carrier for this reading.'}

/** Factory's tracks: a waiting reason while the sessions are unread or their read was refused (the pane says it);
 * the sessions as tracks once the agency answers, an empty set when it answers none. */
export const useFactoryTracks: UseModeTracks = reading => {
  const transport = reading.transport ?? NO_CARRIER
  const agency = useAgencySessions(transport)
  const events = useAgentSessionsOptional()?.events
  const shell = useAgentShellOptional()
  const armOn = shell ? shell.writeArm : null
  const writeArm = useMemo(() => shellWriteArm(armOn), [armOn])
  const soloed = shell?.soloed, setSolo = shell?.setSolo
  const attention = useMemo<FactoryAttention | undefined>(() => soloed && setSolo ? {soloed, solo: setSolo} : undefined, [soloed, setSolo])
  const harness = useHarnessBinding(transport)
  // Actions only once the owner has named its harness binding (never the shell's default 'cursor').
  const owned = transport.kind !== 'unavailable' && harness.error === null && harness.resolved
  const controls = useMemo<FactoryControls | undefined>(
    () => owned ? {control: control => harnessAgentControl(transport, harness.binding, control)} : undefined,
    [owned, transport, harness.binding],
  )
  // Every session's Telemetry, and its task's launch, follow and quantize: its own settings, all read in one owner call; Telemetry is
  // written on its own. Solo is what you attend to (§16.1, §16.6), the agent shell's on the book: it writes no setting.
  // Each session's own readings and writes are asked in the register its world-wide agency read listed it in (agent/worldScope.ts).
  const sessionRefs = useMemo(() => agency.tracks.filter(track => !track.group).map(track => track.sessionRef), [agency.tracks])
  const rows = agency.rows
  const projectOf = useCallback((session: string) => projectOfSession(rows, session), [rows])
  const own = useSettingsAnswers(transport, sessionRefs, projectOf)
  const settings = useMemo<FactorySettingsPort | undefined>(() => transport.kind === 'unavailable' ? undefined : {
    of: session => { const reading = own.get(session); return reading ? {telemetry: reading.track.telemetry, task: reading.task} : null },
    set: async (session, setting, on) => {
      try {
        await writeSessionSettings(transport, projectOf(session), session, trackSettingChange(setting, on))
        return {ok: true, note: `Telemetry ${on ? 'on' : 'off'} for this session (its own settings, on AIKit).`}
      } catch (cause) { return {ok: false, error: cause instanceof Error ? cause.message : String(cause)} }
    },
  }, [transport, own, projectOf])
  // Every session's attempts as takes: AIKit's served attempts and the Runs Factory holds them in, and the choice of one.
  const takes = useAttemptTakes(transport, sessionRefs, projectOf)
  // A track's Stop: that session's running turn cancelled on its own encounter owner, as the Thread's Hard stop does
  // (desktop/cradle/src/encounter/session.ts cancel); the harness's other sessions run on.
  const sessionStop = useMemo(() => transport.kind === 'unavailable' ? undefined : async (session: string) => {
    try {
      await encounter(transport, projectOf(session), {action: 'cancel', agent_session: session, reason: 'Stopped on its track'})
      tellOwnerChanged({topic: 'agency', cause: 'a session was stopped on its track', agentSession: session})
      return {ok: true as const, note: 'Stopped this session\'s running turn; the session stays, and the harness\'s other sessions run on.'}
    } catch (cause) { return {ok: false as const, error: cause instanceof Error ? cause.message : String(cause)} }
  }, [transport, projectOf])
  // A Repeat's press (§19.1 The Launch panel): its takes over the run AIKit hands with the session's settings (repeatPress).
  const repeat = useMemo(() => transport.kind === 'unavailable' ? undefined
    : repeatPress(transport, session => own.get(session), projectOf), [transport, own, projectOf])
  // The workcells of the machine's register as return tracks, and each session's Works in (§19.23): the seat register, read once.
  const seats = useSeatStatusAnswer(transport, transport.kind !== 'unavailable').reading
  const register = seats.status === 'answered' ? seats.value : null
  if (!agency.tracks.length && agency.error) return {waiting: `The agent sessions are unread: ${agency.error}`}
  if (!agency.tracks.length && agency.loading) return {waiting: 'The agent sessions arrive when the agency read answers.'}
  // A chat dragged from Factory's Projects (DLW §19.1) reopens on the empty track; an agent still starts a new agent there.
  const set = withChatSeat(factoryTrackAdapter.project({tracks: agency.tracks, nowUnixMs: Date.now(), controls, ...(events ? {events} : {}), writeArm, ...(settings ? {settings} : {}), ...(attention ? {attention} : {}), ...(takes ? {takes} : {}), ...(sessionStop ? {sessionStop} : {}), ...(repeat ? {repeat} : {})}), {transport})
  return factoryTrackSet(set, register, seats.status === 'refused' ? seats.error : null, transport, agency.tracks)
}

/** A Repeat's press (§19.1 The Launch panel: "Each run is a take"): its takes through Actuation's comparison run, the set started and
 * ended on AIKit (agent/sessionSettings.ts makeTakes), over the run AIKit hands with the session's settings — the session's own task
 * and its agent as an agent-jsonl body (`task.take_run`, takeRunOf). Where AIKit hands its refusal, or an AIKit before the take body
 * hands nothing, the press says so in words and writes nothing. With a song's note chosen in the pressed clip's Clip view (its `unit`
 * hold, a canon unit of the session's Run in Factory's score), the takes are the song's: each a Run Factory starts from the note's clip
 * (agent/songClips.ts songTakes, O-I #844). */
export function repeatPress(transport: KernelTransportStatus, settingsOf: (session: string) => EncounterSessionSettingsReading | null | undefined,
  projectOf: (session: string) => string) {
  return async (session: string, _label?: string, clipId?: string) => {
    const project = projectOf(session)
    const note = clipId ? viewHoldsOf(clipHostId('factory', clipId)).unit : undefined
    const song = typeof note === 'string' && note ? await songOfNote(transport, project, session, note) : null
    if (song && 'refused' in song) return {ok: false as const, error: song.refused}
    return song ? songTakes(transport, project, session, song) : makeTakes(transport, project, session, takeRunOf(settingsOf(session)?.task))
  }
}

/** Factory's set as the pane draws it: the register's workcells as return tracks and each session's Works in (withWorkcells), and its
 * tracks taking a constellation dropped on them — which makes the session's task of it, its source kept on AIKit (agent/clipBinding.ts
 * taskMaker) — and a message dragged from Messages, which becomes the work its agent stands on (withDelegateDrop). Pure. */
export function factoryTrackSet(set: WorldTrackSet, register: unknown, refused: string | null, transport: KernelTransportStatus,
  tracks: readonly AgentSessionTrack[]): WorldTrackSet {
  return withClipMaker(withWorkcells(set, register, refused, trackProjects(tracks)), withDelegateDrop(taskMaker(transport, tracks), tracks, messageDropOwners(transport)))
}

type Maker = NonNullable<WorldTrackActions['makeClip']>

/** The words a message's drop says where it makes nothing. */
export const DELEGATE_WORDS = {
  noMessages: 'Messages is not on the rail, so the message\'s turning into a task could not be recorded: open the rail, then drag it again.',
  noSession: 'Only a session\'s track takes a message: drop it on the track of the agent it went to.',
  noAgent: (name: string) => `No agent stands at ${name} now, so no track is its.`,
  another: (name: string) => `The message went to ${name}: drop it on ${name}'s track, whose task it becomes.`,
} as const

/** What a message's drop asks of its owners: whether Messages stands on the door to record the turning, the task maker's new task, the
 * session's task read back from AIKit, and Messages' own `delegate`. */
export interface MessageDropOwners {
  readonly recorded: () => boolean
  readonly make: (session: SessionAddress, message: {readonly ref: string; readonly title: string}, project: string) => Promise<WorldActionReceipt>
  readonly task: (sessionRef: string, project: string) => Promise<{readonly task_ref: string; readonly source?: string | null} | {readonly error: string}>
  readonly delegate: (value: string) => Promise<void>
}

/** Messages' own `delegate` (agent/devices/messagesBinding.ts: `aikit gateway delegate` through the kernel's gateway_write), on the
 * binding the rail's agent devices publish on the door (AgentRailDevices.tsx). Rejects with Messages' or AIKit's words. */
export async function messagesDelegate(value: string): Promise<void> {
  const write = publishedDevice(MESSAGES_ID)?.binding?.write
  if (!write) throw new Error(DELEGATE_WORDS.noMessages)
  await write([{key: 'delegate', value}])
}

/** The owners a message's drop goes through: the task maker's new task (agent/clipBinding.ts makeNewTaskOf, AIKit's task creation), the
 * session's settings read back (owners/readers.ts readSettingsOf), and Messages on the door. */
export function messageDropOwners(transport: KernelTransportStatus): MessageDropOwners {
  return {
    recorded: () => !!publishedDevice(MESSAGES_ID)?.binding?.write,
    make: (session, message, project) => makeNewTaskOf(transport, session, message, project),
    task: async (sessionRef, project) => {
      const read = await readSettingsOf(transport, project, sessionRef)()
      if ('error' in read) return {error: read.error}
      return read.value.task ?? {error: 'AIKit\'s settings for the session read no task'}
    },
    delegate: messagesDelegate,
  }
}

/** Factory's tracks taking a message dragged from Messages (§19.24 Rules: "A message asks; it is not a task. To turn one into work, drag
 * it onto the agent's track, and the agent takes it as a task with a receipt"; O-I ticket 757, DLW build ruling 2026-11-05), beside what the
 * maker took already: the drag (COMMUNIQUE_DRAG, as the Thread's message rows carry it) joins the maker's `alsoAccepts`. Its drop makes a
 * new task of the message through the task maker (makeNewTaskOf: the message's words its purpose, the Communique its source), reads the
 * task's receipt back from AIKit, then records the turning through Messages' `delegate` {communique, work: the new task, reason} — AIKit
 * gives the Position the message went to Factory's custody of it, and the Communique, escalated, carries no drag after. Since that custody
 * goes to the message's recipient, only the track of the agent standing there takes it; any other drop, a recipient with no agent, and
 * Messages off the rail say so in words and make nothing; AIKit's refusals come back in its words. Every other payload is the maker's.
 * Pure, but for the owners handed in. */
export function withDelegateDrop(maker: Maker, tracks: readonly AgentSessionTrack[], owners: MessageDropOwners): Maker {
  return {...maker, alsoAccepts: [...(maker.alsoAccepts ?? []), COMMUNIQUE_DRAG],
    op: `${maker.op}. A message: AIKit encounter-task-configure makes a new task of it on the track's session, then AIKit gateway delegate, through `
      + 'Messages, records the turning: the Position it went to takes Factory\'s custody of that task',
    run: async (trackId: string, payload: string): Promise<WorldActionReceipt> => {
      const drag = communiqueDragOf(payload)
      if (!drag) return maker.run(trackId, payload) as Promise<WorldActionReceipt>
      const track = tracks.find(item => trackKey(item) === trackId && !item.group)
      if (!track) return {ok: false, error: DELEGATE_WORDS.noSession}
      if (!drag.agent) return {ok: false, error: DELEGATE_WORDS.noAgent(drag.name)}
      if (track.agentRef !== drag.agent) return {ok: false, error: DELEGATE_WORDS.another(drag.name)}
      // Nothing is made that Messages could not record as the message's turning.
      if (!owners.recorded()) return {ok: false, error: DELEGATE_WORDS.noMessages}
      const label = track.agentName ?? track.purpose ?? track.sessionRef
      const project = track.project ?? ROOT_REGISTER
      const made = await owners.make({sessionRef: track.sessionRef, label}, {ref: drag.communique, title: drag.concern}, project)
      if (!made.ok) return made
      // The task's receipt, read back from AIKit: the session's task is the one made of this message.
      const task = await owners.task(track.sessionRef, project)
      if ('error' in task) return {ok: false, error: `${label} has a new task made of the message, but AIKit did not read it back: ${task.error}`}
      if (task.source !== drag.communique) return {ok: false, error: `${label}'s settings read another task (${task.task_ref}) than the one made of the message.`}
      const reason = `You dragged this message onto ${label}'s track, and ${label} takes it as a new task.`
      try { await owners.delegate(JSON.stringify({communique: drag.communique, work: task.task_ref, reason})) }
      catch (cause) { return {ok: false, error: `${label} has the message as a new task (${task.task_ref}), but the turning was not recorded: ${cause instanceof Error ? cause.message : String(cause)}`} }
      return {ok: true, note: `${label} takes the message as a new task (${task.task_ref}), and AIKit reads its source as the message; Messages recorded the turning.`}
    }}
}

/** Each drawn track's project: the register its session was read under (agent/worldScope.ts); your world's root register, and a track
 * no session stands behind, name none. Pure. */
export function trackProjects(tracks: readonly AgentSessionTrack[]): (track: WorldTrack) => string | null {
  return track => {
    const session = tracks.find(item => trackKey(item) === track.id)
    const project = session?.project ?? ROOT_REGISTER
    return project === ROOT_REGISTER ? null : project
  }
}

/** Factory's set with the register's workcells as its return tracks and each session's Works in (§19.23): a session works in its own
 * project's workcell ("The project's workcell by default"), the one holding that project's seat, else unread with the reason; a
 * session of your world's root register names none. Pure. */
export function withWorkcells(set: WorldTrackSet, register: unknown, refused: string | null = null,
  projectOf: (track: WorldTrack) => string | null = () => null): WorldTrackSet {
  return withReturns(withWorksIn(set, register, projectOf, refused), workcellReturns(register))
}
