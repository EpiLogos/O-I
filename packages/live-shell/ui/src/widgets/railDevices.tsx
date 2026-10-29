// Devices born on the rail (DLW §23.1: "A widget with no device elsewhere, such as Files, is a small device born on the rail"; §16.1 "A
// widget is a view of a device"). The 22 Oct manual rewrite retired three of them: the Diff is Files' Diff page (§23.4), carried here under
// `diff.`; a calendar is no device of the DLW, only a third party's widget (§23.8); and what Notifications showed waits in Approvals, under
// Requests (§23.9), whose chains carry it (useOwnerRequests below, railBindings.ts withOwnerRequests). Each is a device of the runtime drawn by its catalogue design (`widgets:<id>`,
// inhabitants/catalogue/panels/widgets__<id>.tsx) on its owner's readings, and published on the device door, so its six views stand
// where every device's do: its Widget on the rail (the rail's registration of the same id draws the device — frame/widgets/
// deviceWidgets.tsx claimRailWidget), Whole in the pool, Full in a pane, Pop-out in its own window. The publisher stands once, with the
// rail's reading (App.tsx, inside the WidgetReadingProvider); the readings are the ones the rail's old tiles made (shell/TrailWidget.tsx,
// agent/AgentDockTileBody.tsx, shell/ModeContextDock.tsx), now drawn by the designs.
//
// Owners write, faces read: a key no owner reports reaches the design absent, with the owner's own words as `reason` where it refused;
// the keys a design marks as the tile's own (Limit, Show, Layout, Follow …) are view holds, kept here and never sent to an owner.
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react'
import {useHeldRead, useOwnerOp} from '../owners/ownerCall'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {readGround, type CentralGroundReading} from '../../../../../desktop/cradle/src/central/client'
import {useTape} from '../../../../../desktop/cradle/src/agent/tape/journal'
import {listFiles, readFile} from '../../../../../desktop/cradle/src/files/client'
import {parseWiki, type WikiNode} from '../../../../../desktop/cradle/src/techne/wikiReading'
import type {TapeRow} from '../../../../../desktop/cradle/src/agent/tape/model'
import {useAgencySessions} from '../agent/useAgencySessions'
import {COMPANIONS} from '../shell/modeDockTiles'
import {conversationOf} from './agentConversation'
import {useAgentSessionsOptional} from '../agent/AgentSessionsProvider'
import {gitRepositoryAbsence, projectOfSession, ROOT_REGISTER} from '../agent/worldScope'
import {useOptionalContinuity} from '../continuity/workspace'
import {publishDevice, publishedDevice, subscribeDeviceDoor} from '../frame/devices/deviceDoor'
import {GIT_ID} from '../agent/devices/workcellBindings'
import {useSeatStatusAnswer} from '../agent/devices/workcellReads'
import {actionAnswerOf, centralActionOp} from '../central/devices/useCentralReadings'
import type {closeNowClearing} from '../central/devices/nowsClose'
import {subscribeTerminals, terminalsNow} from '../../../../../desktop/cradle/src/terminal/terminalReadings'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import {TERMINAL_ID, holdsFrom, screenOf, sessionRoomsOf, terminalBinding, terminalDevice, type RoomScreen, type SessionRoom, type TerminalHolds} from './terminalBinding'
import {RAIL_DEVICES, railDeviceId, railDevice, type RailDeviceId} from './railDeviceIds'
import type {DesignBinding, Value} from '../frame/devices/designed'
import type {DeviceInstance} from '../frame/devices/deviceRuntime'
import {useWidgetReading} from './widgetReading'
import type {OwnerReading} from '../owners/ownerReading'
import {NOTIFY_LIST_ACTION, dayStartMs, diffFilesOf, filesOf, groundPlaceOf, keptTrackOf, nowsCloseWrites, nowsValues, openFileOf, pagesOf, put, trailIndexOf, trailValues, wikiPagesOf, type NotifyLedgerAnswer} from './railBindings'
import {returnToStop} from '../shell/TrailWidget'
import {standingOn} from '../../../../../desktop/cradle/src/workspace/store'
import {DIFF_PAGE, carryPages} from '../agent/devices/oneAgentBinding'
import {openInstrument} from '../frame/instrumentDoor'
import {DEVICE_PANE_KIND} from '../frame/devices/devicePane'
import {loadWhenDrawn} from '../shell/loadWhenDrawn'

// The rail-born devices' names, ids and rail claims are their own light module (widgets/railDeviceIds.ts), loaded with the shell's first
// frame; this publisher loads when the rail first draws (App.tsx; O-I #740).
export {RAIL_FAMILY, RAIL_DEVICES, railDeviceId, railDevice, type RailDeviceId} from './railDeviceIds'

type Holds = Readonly<Record<string, Value | undefined>>
/** The view's own holds for a design's tile keys: each set goes straight here, never to an owner. */
function useHolds(keys: readonly string[]): {holds: Holds; local: Record<string, (value: Value | undefined) => void>} {
  const [holds, setHolds] = useState<Holds>({})
  const local = useMemo(() => Object.fromEntries(keys.map(key => [key, (value: Value | undefined) => setHolds(current => ({...current, [key]: value}))])),
    // The keys are fixed per device.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [])
  return {holds, local}
}
const withHolds = (values: Record<string, Value>, holds: Holds) => { for (const [key, value] of Object.entries(holds)) put(values, key, value); return values }

// ---------------------------------------------------------------------------------------------------------------- the Trail

function useTrailBinding(): DesignBinding {
  const continuity = useOptionalContinuity()
  const context = continuity?.current.context
  const {holds, local} = useHolds(['limit', 'chosen'])
  // The latest book, for the one walk a press makes (the binding stays the same object while the trail does).
  const latest = useRef(continuity)
  latest.current = continuity
  const returnTo = useMemo(() => (ref: Value | undefined) => {
    const book = latest.current, index = trailIndexOf(ref)
    if (book && index !== null) returnToStop(book, index)
  }, [])
  const open = !!continuity, trail = context?.trail, standing = trail?.length ? standingOn(context ?? {}) : null
  return useMemo(() => ({id: railDeviceId('trail'),
    values: withHolds(open ? trailValues(trail ?? [], standing) : {reason: 'The workspace book is not open'}, holds),
    local: {...local, return: returnTo}}), [open, trail, standing, holds, local, returnTo])
}

// ---------------------------------------------------------------------------------------------------------------- the Diff

/** The world's Docs on the door (central/devices/CentralDevices.tsx DOCS_DEVICE_ID; pageBindings.ts docsValues): its `subject` is the selected
 * world's project, or `central` for your world. The Workspace, whose `folder` it read before, was retired into the track's head and Docs in
 * the 22 Oct manual rewrite (§18.1). Named here, not imported, so the rail's boot does not load Central's bindings. */
export const DIFF_WORLD_ID = 'central:docs'
/** Docs' subject word for your world (pageBindings.ts docsValues: `world.project ?? 'central'`): the root, no project. */
const ROOT_FOLDER = 'central'

/** The repository the Diff reads when no seat is selected: the project world Docs stands on (the selected world's track), else the book's
 * workspace's project, else the selected session's project (agent/worldScope.ts: the register its agency read listed it in). Your world
 * (`central`, the root register '') has no repository of its own; with none of these, `project` is null and `words` say why. Pure. */
export function diffProjectOf(workspaceFolder: Value | undefined, bookProject: string | undefined, session: {ref: string | null; project: string} = {ref: null, project: ROOT_REGISTER}):
  {project: string; from: 'world' | 'workspace' | 'session'} | {project: null; from: 'none'; words: string} {
  const named = (word: unknown): word is string => typeof word === 'string' && word.trim() !== '' && word !== ROOT_FOLDER
  if (named(workspaceFolder)) return {project: workspaceFolder, from: 'world'}
  if (named(bookProject)) return {project: bookProject, from: 'workspace'}
  const absent = gitRepositoryAbsence(session.ref, session.project)
  return absent ? {project: null, from: 'none', words: absent} : {project: session.project, from: 'session'}
}
type DiffReading = {status: 'reading'} | {status: 'refused'; words: string} | {status: 'read'; root: string; files: Record<string, Value>[]; head: string | null; branch: string | null; omitted: number}

/** The checkout of the seat selected on Git / landing's Seat page (workcellBindings.ts GIT_ID, its `seat.seat`, a workcell, and its
 * `seat.product`: the Seat was retired into that page in the 22 Oct manual rewrite, §19.17), as the
 * seat instrument reads it (`seat status --json`): the workcell's path with the product's directory under it — the seat path the census
 * already uses (centralHygieneModel.ts registeredSeatPaths) — and the seat's live branch and head. Null with no seat selected, or one the
 * reading does not hold. Pure. */
export function selectedSeatOf(seatValues: Readonly<Record<string, Value>> | undefined, status: unknown): {root: string; branch: string | null; head: string | null} | null {
  const seat = seatValues?.seat, product = seatValues?.product
  if (typeof seat !== 'string' || !seat || typeof product !== 'string' || !product) return null
  const cells = (status as {workcells?: unknown} | null)?.workcells
  const cell = Array.isArray(cells) ? (cells as {name?: unknown; path?: unknown; seats?: unknown}[]).find(row => row?.name === seat) : undefined
  if (!cell || typeof cell.path !== 'string' || !cell.path) return null
  const row = Array.isArray(cell.seats) ? (cell.seats as {product?: unknown; live_branch?: unknown; live_head?: unknown}[]).find(entry => entry?.product === product) : undefined
  if (!row) return null
  return {root: `${cell.path.replace(/\/$/, '')}/${product}`, branch: typeof row.live_branch === 'string' ? row.live_branch : null,
    head: typeof row.live_head === 'string' ? row.live_head : null}
}

/** One word of Git / landing's Seat page as published (its `seat.seat` or `seat.product`), or null. */
const seatWord = (key: 'seat' | 'product'): string | null => { const value = publishedDevice(GIT_ID)?.binding?.values[`seat.${key}`]; return typeof value === 'string' && value ? value : null }

function useDiffReading(transport: KernelTransportStatus | undefined): DiffReading {
  // The seat selected on Git / landing's Seat page, where the chain publishes it (watched as its two words, so no other publish redraws the rail),
  // and the seat instrument's one shared reading (asked only then).
  const seatName = useSyncExternalStore(subscribeDeviceDoor, () => seatWord('seat'), () => null)
  const seatProduct = useSyncExternalStore(subscribeDeviceDoor, () => seatWord('product'), () => null)
  const seatValues = useMemo(() => (seatName && seatProduct ? {seat: seatName, product: seatProduct} : undefined), [seatName, seatProduct])
  const chosen = !!seatValues
  // With no seat chosen: the project world Docs stands on, else the book's workspace's project, else the shell's.
  const folder = useSyncExternalStore(subscribeDeviceDoor, () => publishedDevice(DIFF_WORLD_ID)?.binding?.values.subject, () => undefined)
  const bookProject = useOptionalContinuity()?.current.project
  const sessions = useAgentSessionsOptional()
  const sessionRef = sessions?.selectedSessionRef ?? null
  const where = diffProjectOf(folder, bookProject, {ref: sessionRef, project: projectOfSession(sessions?.rows ?? [], sessionRef)})
  const project = where.project
  const seats = useSeatStatusAnswer(transport ?? {kind: 'unavailable', reason: 'No kernel carrier stands.'}, chosen && !!transport && transport.kind !== 'unavailable').reading
  const seat = chosen && seats.status === 'answered' ? selectedSeatOf(seatValues, seats.value) : null
  // Two held reads, each shared with every other view that asks the same (the agent dock's Diff, the chain's Git): the repository —
  // only with no seat selected — then the working diff of the seat's checkout, or of the repository once it has named its root.
  const repo = useOwnerOp(transport, chosen || project === null ? null : {op: 'git_repository_read', project}, 'git_repository_reading', 'The repository owner did not answer.').reading
  const doc = !chosen && repo.status === 'answered' ? repo.value?.document as {repo_root?: unknown; branch?: unknown; head?: unknown} | undefined : undefined
  const root = seat ? seat.root : typeof doc?.repo_root === 'string' ? doc.repo_root : null
  const patch = useOwnerOp(transport, root ? {op: 'git_diff_read', request: {repo_root: root, from: 'HEAD', to: 'working-tree', max_bytes: 65536, max_files: 200}} : null,
    'git_diff_reading', 'Central did not answer the diff.').reading
  return useMemo((): DiffReading => {
    if (!transport || transport.kind === 'unavailable') return {status: 'refused', words: transport?.reason ?? 'No kernel carrier stands.'}
    if (chosen) {
      if (seats.status === 'refused') return {status: 'refused', words: seats.error ?? 'The seat instrument did not answer.'}
      if (seats.status !== 'answered') return {status: 'reading'}
      if (!seat) return {status: 'refused', words: `The seat instrument holds no ${String(seatValues?.product)} seat in ${String(seatValues?.seat)}.`}
    } else {
      if (where.project === null) return {status: 'refused', words: where.words}
      if (repo.status === 'refused') return {status: 'refused', words: repo.error ?? 'The repository owner did not answer.'}
      if (repo.status !== 'answered') return {status: 'reading'}
      if (!root) return {status: 'refused', words: 'Central did not disclose the repository root.'}
    }
    if (patch.status === 'refused') return {status: 'refused', words: patch.error ?? 'Central did not answer the diff.'}
    if (patch.status !== 'answered' || !patch.value) return {status: 'reading'}
    const read = diffFilesOf(patch.value.document)
    if (!read) return {status: 'refused', words: 'Central returned an unsupported Git diff.'}
    const branch = seat ? seat.branch : typeof doc?.branch === 'string' ? doc.branch : null
    return {status: 'read', root: root!, files: read.files, head: read.head ?? seat?.head ?? null, branch, omitted: read.omitted}
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `where` is named by its project and words
  }, [transport, chosen, seats, seat, seatValues, repo, patch, root, doc, where.project, where.from === 'none' ? where.words : null])
}

/** The Diff page's binding (Files' Diff page, §23.4; widgets__files.tsx `diff.` keys): the working diff as read, and the page's own holds.
 * Files carries it under `diff.` (railDevices.tsx RailDevices). */
function useDiffBinding(reading: DiffReading): DesignBinding {
  const {holds, local} = useHolds(['show', 'session', 'layout', 'open'])
  return useMemo(() => {
    const values: Record<string, Value> = {}
    if (reading.status === 'read') {
      put(values, 'files', JSON.stringify(reading.files))
      put(values, 'branch', reading.branch)
      put(values, 'head', reading.head?.slice(0, 9))
    } else if (reading.status === 'refused') put(values, 'reason', reading.words)
    return {id: railDeviceId('files'), values: withHolds(values, holds), local}
  }, [reading, holds, local])
}

// ---------------------------------------------------------------------------------------------------------------- Files and Web
// Both follow one agent: the conversation the rail's Agent follows (widgets/agentConversation.ts conversationOf — THE selection's
// session, else the mode's companion's), read through the one shared journal reader (desktop/cradle/src/agent/tape/journal.ts
// useTape: the owner's journal, never a copy). The tape names what each tool call acted on; it carries no line counts of its own.

/** The tape of the agent a monitor reads: the selected one, or the one its Follow kept (`kept`, a session; railBindings.ts keptTrackOf). */
function useFollowedTape(kept: string | null): {rows: readonly TapeRow[]; agent: string | null; words: string | null; session: string | null} {
  const reading = useWidgetReading()
  const continuity = useOptionalContinuity()
  const agency = useAgencySessions(reading?.transport ?? {kind: 'unavailable', reason: 'No kernel carrier stands.'})
  const companion = reading ? COMPANIONS[reading.mode].name : 'Agent'
  const followed = conversationOf(agency.tracks, companion, continuity?.current.context?.selection?.ref ?? null).track
  const {track, words: keptWords} = keptTrackOf(agency.tracks, kept, followed)
  // The tape is read in the followed session's own register (agent/worldScope.ts).
  const {tape, reading: journal} = useTape(track ? {project: track.project ?? ROOT_REGISTER, ref: track.sessionRef} : undefined, agency.tracks)
  const agent = track ? `${track.agentName ?? companion}${track.purpose ? ` · ${track.purpose}` : ''}` : null
  const words = track ? journal?.error ?? null : keptWords ?? `No ${companion} session stands to follow.`
  const session = track?.sessionRef ?? null
  // The same object while the rows, the agent and the words stand, so the two bindings change only when the tape does.
  return useMemo(() => ({rows: tape.rows, agent, words, session}), [tape.rows, agent, words, session])
}

/** Follow (§23.2, §23.3): on, the monitor reads the selected agent; off, it keeps the one it read when you turned it off. A hold of the
 * monitor's own, never sent to an owner. */
function useFollowHold(): {kept: string | null; follow: (value: Value | undefined, session: string | null) => void} {
  const [kept, setKept] = useState<string | null>(null)
  const follow = useCallback((value: Value | undefined, session: string | null) => setKept(value === false ? session : null), [])
  return {kept, follow}
}

/** The file opened in Files' Full, as Central reads it: the ground's root from its listing, the file's folder listed, its entry read through
 * the files seam (desktop/cradle/src/files/client.ts listFiles, readFile — as the rail's Wiki reads its pages). A file Central does not let
 * be read (its entry's `retrieval_allowed`), or one outside the ground, says why. */
function useOpenFile(transport: KernelTransportStatus | undefined, path: string | null): OwnerReading<readonly string[]> {
  return useHeldRead(transport && transport.kind !== 'unavailable' && path ? ['rail-files-open', transport, path] : null, async () => {
    const ground = await listFiles(transport!, '')
    const place = groundPlaceOf(path!, ground.location.root)
    if ('words' in place) throw new Error(place.words)
    const folder = await listFiles(transport!, place.parent)
    const entry = folder.entries.find(candidate => candidate.name === place.name && candidate.kind === 'file')
    if (!entry) throw new Error(`Central lists no file ${place.name} in ${place.parent || 'the ground'}.`)
    if (!entry.retrieval_allowed) throw new Error(`Central does not let ${place.relative} be read.`)
    return (await readFile(transport!, entry.location)).content.split('\n')
  })
}

function useFilesBinding(tape: ReturnType<typeof useFollowedTape>, diff: DiffReading, transport: KernelTransportStatus | undefined,
  hold: ReturnType<typeof useFollowHold>): DesignBinding {
  const {holds, local} = useHolds(['show', 'blocked', 'open'])
  const path = openFileOf(holds.open, diff.status === 'read' ? diff.root : null)
  const opened = useOpenFile(transport, path)
  return useMemo(() => {
    const values: Record<string, Value> = {}
    put(values, 'agent', tape.agent)
    if (tape.agent) put(values, 'files', JSON.stringify(filesOf(tape.rows, diff.status === 'read' ? diff.files : [], diff.status === 'read' ? diff.root : null)))
    put(values, 'reason', tape.words)
    put(values, 'follow', hold.kept === null)
    if (path && opened.status === 'answered' && opened.value) put(values, 'content', JSON.stringify(opened.value))
    else if (path && opened.status === 'refused') put(values, 'openReason', opened.error ?? 'Central did not read the file.')
    return {id: railDeviceId('files'), values: withHolds(values, holds), local: {...local, follow: (value: Value | undefined) => hold.follow(value, tape.session)}}
  }, [tape, diff, holds, local, path, opened, hold])
}

function useWebBinding(tape: ReturnType<typeof useFollowedTape>, hold: ReturnType<typeof useFollowHold>): DesignBinding {
  const {holds, local} = useHolds(['mark', 'page'])
  return useMemo(() => {
    const values: Record<string, Value> = {}
    put(values, 'agent', tape.agent)
    if (tape.agent) put(values, 'pages', JSON.stringify(pagesOf(tape.rows)))
    put(values, 'reason', tape.words)
    put(values, 'follow', hold.kept === null)
    return {id: railDeviceId('web'), values: withHolds(values, holds), local: {...local, follow: (value: Value | undefined) => hold.follow(value, tape.session)}}
  }, [tape, holds, local, hold])
}

// ---------------------------------------------------------------------------------------------------------------- the Terminal
// A room of a session space (§17.9, §10.1; widgets/terminalBinding.ts): the rooms AIKit keeps, from the agency reading's spaces; the room of
// the run you select (THE selection's session, else the mode's companion's, as Files and Web follow: agentConversation.ts conversationOf),
// or the one you pinned; its screen, the owner's capture (kernel op working_surface_read), read again while the window is shown — the
// cadence the cradle's Computer view keeps (desktop/cradle/src/contributions/factory/ComputerView.tsx); and the Workbench's own terminals
// beside them. The Terminal's holds are kept here and in this window's storage, so a reopened Terminal returns to the same room.

const TERMINAL_HOLDS_KEY = 'oi.terminal.holds'
const readHolds = (): TerminalHolds => { try { return holdsFrom(globalThis.localStorage?.getItem(TERMINAL_HOLDS_KEY) ?? null) } catch { return {} } }
let terminalHolds: TerminalHolds | null = null
const holdsListeners = new Set<() => void>()
const holdsNow = (): TerminalHolds => (terminalHolds ??= readHolds())
const subscribeHolds = (listener: () => void) => { holdsListeners.add(listener); return () => { holdsListeners.delete(listener) } }
function holdTerminal(key: keyof TerminalHolds, value: Value | undefined): void {
  const next: Record<string, unknown> = {...holdsNow()}
  if (value === undefined) delete next[key]
  else next[key] = value
  terminalHolds = next as TerminalHolds
  try { globalThis.localStorage?.setItem(TERMINAL_HOLDS_KEY, JSON.stringify(next)) } catch { /* kept for this window only */ }
  for (const listener of [...holdsListeners]) listener()
}

/** How often the shown room's screen is read: while the keyboard is held, closer, so what you typed shows. */
const SCREEN_EVERY_MS = 1000, SCREEN_TYPING_MS = 300
/** The size the takeover client attaches at (the provider fits the room to its newest client while you type). */
const TAKEOVER_SIZE = {cols: 120, rows: 40} as const
const wordsOf = (error: unknown) => String(error instanceof Error ? error.message : error).replace(/^Error:\s*/, '').trim()
type Takeover = typeof import('../../../../../desktop/cradle/src/contributions/factory/workingSurfaceClient')
type Lease = {room: string; id: string; seq: number; client: Takeover}

function useTerminalBinding(transport: KernelTransportStatus | undefined) {
  const locals = useSyncExternalStore(subscribeTerminals, terminalsNow, terminalsNow)
  const holds = useSyncExternalStore(subscribeHolds, holdsNow, holdsNow)
  const reading = useWidgetReading()
  const continuity = useOptionalContinuity()
  const carrier = transport ?? {kind: 'unavailable' as const, reason: 'No kernel carrier stands.'}
  const agency = useAgencySessions(carrier)
  const companion = reading ? COMPANIONS[reading.mode].name : 'Agent'
  const {track} = conversationOf(agency.tracks, companion, continuity?.current.context?.selection?.ref ?? null)
  const rooms = useMemo(() => sessionRoomsOf(agency.rows, agency.tracks), [agency.rows, agency.tracks])
  const followed = useMemo(() => ({session: track?.sessionRef ?? null, words: track ? null : `No run is selected, and no ${companion} session stands to follow.`}), [track, companion])
  const shownId = holds.follow === false ? holds.shell : followed.session ? rooms.find(room => room.session === followed.session)?.id : undefined
  const shown = rooms.find(room => room.id === shownId)
  const [screen, setScreen] = useState<RoomScreen | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const lease = useRef<Lease | null>(null)
  const [driving, setDriving] = useState<string | null>(null)
  const native = carrier.kind === 'tauri'
  const release = useCallback(async () => {
    const held = lease.current
    lease.current = null
    setDriving(null)
    if (held) await held.client.release(held.id).catch(error => setRefusal(`Release: ${wordsOf(error)}`))
  }, [])
  // The room's keyboard, taken only when the person sets Input to Type: the takeover client attaches to the exact room the owner resolves
  // (after the native confirmation); its output is drained, the screen being the owner's capture. Watch only, another room, a hidden
  // window or the end of the attachment releases it; the run goes on either way.
  const type = useCallback(async (room: SessionRoom, on: boolean) => {
    setRefusal(null)
    if (!on) return release()
    if (lease.current?.room === room.id) return
    await release()
    try {
      const client = await import('../../../../../desktop/cradle/src/contributions/factory/workingSurfaceClient')
      const got = await client.takeover(room.project, room.session, room.id, TAKEOVER_SIZE)
      const held: Lease = {room: room.id, id: got.client_id, seq: got.seq, client}
      lease.current = held
      setDriving(room.id)
      while (lease.current === held) {
        const batch = await client.poll(held.id, held.seq)
        if (lease.current !== held) return
        held.seq = batch.seq
        if (batch.eof) { lease.current = null; setDriving(null); return }
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    } catch (error) {
      if (lease.current) { lease.current = null; setDriving(null) }
      setRefusal(`Type: ${wordsOf(error)}`)
    }
  }, [release])
  const keys = useCallback(async (data: string) => {
    const held = lease.current
    if (held) await held.client.input(held.id, data).catch(error => setRefusal(`Type: ${wordsOf(error)}`))
  }, [])
  useEffect(() => { if (lease.current && lease.current.room !== shown?.id) void release() }, [shown?.id, release])
  useEffect(() => {
    const hidden = () => { if (document.hidden) void release() }
    document.addEventListener('visibilitychange', hidden)
    return () => { document.removeEventListener('visibilitychange', hidden); void release() }
  }, [release])
  // The shown room's screen: the owner's capture, read while the window is shown. A refusal is the provider not answering; the last lines
  // stay with it, and the room stays.
  const typing = useRef(false)
  typing.current = driving !== null
  useEffect(() => {
    setScreen(null)
    if (!shown || carrier.kind === 'unavailable') return
    let cancelled = false, timer: ReturnType<typeof setTimeout> | undefined, kept: string[] | undefined
    const read = async () => {
      if (cancelled) return
      if (typeof document === 'undefined' || !document.hidden) {
        try {
          const result = await kernelOp(carrier, {op: 'working_surface_read', project: shown.project, agent_session: shown.session, binding: shown.id})
          if (cancelled) return
          if (result.error || result.outcome?.result !== 'working_surface_reading') throw Error(result.error ?? 'The working surface owner did not answer.')
          const document_ = result.outcome.document as {reason?: string; capture?: {capture?: {state?: string; text?: string; reason?: string}} | null}
          const capture = document_.capture?.capture
          if (capture?.state === 'captured' && typeof capture.text === 'string') {
            kept = screenOf(capture.text)
            setScreen({room: shown.id, lines: kept})
          } else setScreen({room: shown.id, ...(kept ? {lines: kept} : {}), refused: capture?.reason ?? document_.reason ?? 'its owner returned no capture'})
        } catch (error) {
          if (!cancelled) setScreen({room: shown.id, ...(kept ? {lines: kept} : {}), refused: wordsOf(error)})
        }
      }
      if (!cancelled) timer = setTimeout(read, typing.current ? SCREEN_TYPING_MS : SCREEN_EVERY_MS)
    }
    void read()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  // The room is named by its id, project and session; the carrier by its kind.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown?.id, shown?.project, shown?.session, carrier.kind])
  const hands = useMemo(() => ({hold: holdTerminal, type, keys}), [type, keys])
  return useMemo(() => {
    const drivenScreen = screen && driving === screen.room ? {...screen, driving: true} : screen
    const binding = terminalBinding({rooms, locals, followed, holds, screen: drivenScreen, hands, native})
    if (binding && refusal) return {...binding, values: {...binding.values, reason: refusal}}
    return binding
  }, [rooms, locals, followed, holds, screen, driving, hands, native, refusal])
}

// ---------------------------------------------------------------------------------------------------------------- the Wiki
// The root register's wiki, read verbatim through the files seam as the Technē registers read theirs (desktop/cradle/src/techne/
// wikiExpression.ts readWikiRegister: list the folder, read wiki.json, parseWiki). A page's text is its first source as the knowledge
// owner reads it (kernel knowledge `read` of {kind: 'source'}): AIKit returns the source's text and, here, no link occurrences.
// The page's links are the relations Central's own reading of the same wiki gives its node (`central.wiki.read`, central-wiki-reading:
// node-source and node-space rows derived at read time; T-COVERAGE §1.3): each drawn where its page's text names its target word for
// word — never found by a pattern — resolved when the target is another page of the wiki, external otherwise. A relation whose target
// the text does not name has no place in a line, so it is not drawn.

const ROOT_WIKI_FOLDER = 'Control/agents/wiki'
export const WIKI_READ_ACTION = 'central.wiki.read'

/** One link of the page as the design draws it (widgets__wiki.tsx Link: its line, its span, its target and whether it resolves). */
export interface WikiLink {readonly line: number; readonly from: number; readonly to: number; readonly target: string; readonly state: 'resolved' | 'external'}

/** The page's links from Central's wiki reading: each relation of the node (`relations[]` from_ref the node) placed at the first line
 * that names its target word for word — the target's ref, else the source path a `central:source:<world>:` ref names. A target that is a
 * node of the wiki resolves (pressing it shows that page); a source or a space is external. Pure. */
export function wikiLinksOf(reading: unknown, nodeRef: string, lines: readonly string[]): WikiLink[] {
  const doc = reading as {nodes?: unknown; relations?: unknown} | null
  if (!doc || !Array.isArray(doc.relations)) return []
  const nodes = new Set(Array.isArray(doc.nodes) ? (doc.nodes as {ref?: unknown}[]).flatMap(node => typeof node?.ref === 'string' ? [node.ref] : []) : [])
  const links: WikiLink[] = []
  for (const relation of doc.relations as {from_ref?: unknown; to_ref?: unknown}[]) {
    if (relation?.from_ref !== nodeRef || typeof relation.to_ref !== 'string' || !relation.to_ref) continue
    const target = relation.to_ref
    const path = target.match(/^central:source:(?:control:root|project:[^:]+):(.+)$/)?.[1]
    for (const word of path ? [target, path] : [target]) {
      const line = lines.findIndex(text => text.includes(word))
      if (line < 0) continue
      const from = lines[line]!.indexOf(word)
      links.push({line, from, to: from + word.length, target, state: nodes.has(target) ? 'resolved' : 'external'})
      break
    }
  }
  return links
}

type WikiPagesReading = {status: 'reading'} | {status: 'refused'; words: string} | {status: 'read'; nodes: readonly WikiNode[]}
type WikiBody = {ref: string; lines: readonly string[]} | {ref: string; words: string}

function useWikiBinding(transport: KernelTransportStatus | undefined): DesignBinding {
  const {holds, local} = useHolds(['follow', 'page'])
  // The register's wiki.json through the files seam, held once for the window and read again when the ground moves.
  const wiki = useHeldRead(transport && transport.kind !== 'unavailable' ? ['rail-wiki', transport, ROOT_WIKI_FOLDER] : null, async () => {
    const folder = await listFiles(transport!, ROOT_WIKI_FOLDER)
    const entry = folder.entries.find(candidate => candidate.name === 'wiki.json')
    if (!entry) throw new Error('The root register discloses no wiki.json.')
    const parsed = parseWiki((await readFile(transport!, entry.location)).content)
    if (parsed.state !== 'ready') throw new Error(parsed.state === 'failed' ? parsed.reason : 'The wiki reading did not resolve.')
    return parsed.nodes
  })
  const pages = useMemo((): WikiPagesReading => !transport || transport.kind === 'unavailable' ? {status: 'refused', words: transport?.reason ?? 'No kernel carrier stands.'}
    : wiki.status === 'answered' && wiki.value ? {status: 'read', nodes: wiki.value}
    : wiki.status === 'refused' ? {status: 'refused', words: wiki.error ?? 'The wiki reading did not resolve.'} : {status: 'reading'}, [transport, wiki])
  const shown = typeof holds.page === 'string' ? holds.page : pages.status === 'read' ? pages.nodes[0]?.ref : undefined
  const node = pages.status === 'read' ? pages.nodes.find(candidate => candidate.ref === shown) : undefined
  const source = node?.source_refs?.[0]
  const text = useOwnerOp(transport, node && source ? {op: 'knowledge', request: {action: 'read', address: {kind: 'source', value: source}}} : null, 'knowledge').reading
  const body = useMemo((): WikiBody | null => !node ? null : !source ? {ref: node.ref, words: 'This page cites no source to read.'}
    : text.status === 'answered' && typeof (text.value?.data as {content?: unknown} | undefined)?.content === 'string' ? {ref: node.ref, lines: ((text.value!.data as {content: string}).content).split('\n')}
    : text.status === 'reading' ? null : {ref: node.ref, words: text.error ?? 'The knowledge owner returned no text for this page.'}, [node, source, text])
  // Central's reading of the same wiki, for the page's links (held for the window; a reading, so it retires nothing in the kernel).
  const relations = useOwnerOp(transport, node ? centralActionOp(WIKI_READ_ACTION, {}) : null, 'action_dispatched', `${WIKI_READ_ACTION} did not answer.`).reading
  const typed = useMemo(() => actionAnswerOf(relations, WIKI_READ_ACTION), [relations])
  return useMemo(() => {
    const values: Record<string, Value> = {}
    if (pages.status === 'read') put(values, 'pages', JSON.stringify(wikiPagesOf(pages.nodes)))
    else if (pages.status === 'refused') put(values, 'reason', pages.words)
    put(values, 'page', shown)
    if (body && body.ref === shown) {
      if ('lines' in body) {
        // The links stand once Central's wiki reading answered; until then, or where it refused, the page draws without them.
        put(values, 'body', JSON.stringify({lines: body.lines, ...(typed.status === 'answered' ? {links: wikiLinksOf(typed.value, body.ref, body.lines)} : {})}))
        if (typed.status === 'refused') put(values, 'reason', `The page's links: Central's wiki reading refused — ${typed.error}`)
      } else put(values, 'reason', body.words)
    }
    return {id: railDeviceId('wiki'), values: withHolds(values, holds), local}
  }, [pages, body, shown, typed, holds, local])
}

// ---------------------------------------------------------------------------------------------------------------- the NOWs

type GroundReading = {status: 'reading'} | {status: 'refused'; words: string} | {status: 'read'; ground: CentralGroundReading}
/** The ground's civil time, Day and NOWs: one held reading, read again on the kernel's notice (its `clock` scope moves the civil
 * minute), never on this tile's own timer. */
function useGround(transport: KernelTransportStatus | undefined): GroundReading {
  const ground: OwnerReading<CentralGroundReading> = useHeldRead(transport && transport.kind !== 'unavailable' ? ['rail-ground', transport] : null, () => readGround(transport!, null))
  return useMemo((): GroundReading => {
    if (!transport || transport.kind === 'unavailable') return {status: 'refused', words: transport?.reason ?? 'No kernel carrier stands.'}
    if (ground.status === 'answered' && ground.value) return {status: 'read', ground: ground.value}
    return ground.status === 'refused' ? {status: 'refused', words: ground.error ?? 'Central did not answer.'} : {status: 'reading'}
  }, [transport, ground])
}

/** NOWs' Close through Central (central/devices/nowsClose.ts), its module loaded at the press: Central's writes stay out of the rail's
 * first load. */
const closeNow: typeof closeNowClearing = (...args) => import('../central/devices/nowsClose').then(module => module.closeNowClearing(...args))

function useNowsBinding(transport: KernelTransportStatus | undefined): DesignBinding {
  const reading = useGround(transport)
  const {holds, local} = useHolds(['machine', 'open'])
  return useMemo(() => {
    const values = reading.status === 'read' ? nowsValues(reading.ground) : reading.status === 'refused' ? {reason: reading.words} : {}
    // Close writes through Central's central.now.lifecycle on the listing and the policy this reading gave (railBindings.ts).
    return {id: railDeviceId('nows'), values: withHolds(values, holds), local, ...nowsCloseWrites(transport, reading.status === 'read' ? reading.ground : null, closeNow)}
  }, [reading, holds, local, transport])
}

// ---------------------------------------------------------------------------------------------------------------- Notifications

/** Messages on the door (agent/devices/messagesBinding.ts MESSAGES_ID): named here, not imported, so the rail's boot does not load its chain
 * (scripts/load-census.mjs). */
export const NOTIFY_MESSAGES_ID = 'ai-kit:messages'
const doorValue = (id: string, key: string): Value | undefined => publishedDevice(id)?.binding?.values[key]

/** Open a request's target where it belongs: a device on the door in its pane (a subject or callback that names one), an https://
 * address through the host's opener (as Expressions opens a reference: panels/expressions.tsx). The shell has no router for an oi://
 * address or any other ref yet, so those refuse in words naming what is missing. Opening writes nothing to any owner. */
export async function openNotificationTarget(target: string): Promise<void> {
  if (publishedDevice(target)) { openInstrument(DEVICE_PANE_KIND, undefined, {ref: target, title: publishedDevice(target)?.device.face.title ?? target}); return }
  if (/^https:\/\//.test(target)) {
    const {invoke} = await import('@tauri-apps/api/core')
    await invoke('plugin:opener|open_url', {url: target})
    return
  }
  throw new Error(`Open: no route in the shell opens ${target} yet — the shell has no router for oi:// addresses or refs that name no device on the door.`)
}

/** What Notifications read, for Approvals to carry (§23.9; railBindings.ts withOwnerRequests): Messages' agents off the door, and the requests
 * Central keeps for personal.notify since the local midnight (personal.notifications.list), a reading asked again on the kernel's notice. */
export function useOwnerRequests(transport: KernelTransportStatus | undefined): {readonly ledger: NotifyLedgerAnswer; readonly messagesAgents: Value | undefined} {
  const agents = useSyncExternalStore(subscribeDeviceDoor, () => doorValue(NOTIFY_MESSAGES_ID, 'agents'), () => undefined)
  // Today's requests: those asked since the local midnight (a number that moves only when the day does).
  const since = dayStartMs(Date.now())
  const ledgerOp = useMemo(() => centralActionOp(NOTIFY_LIST_ACTION, {since_unix_ms: since}), [since])
  const ledgerReading = useOwnerOp(transport, transport ? ledgerOp : null, 'action_dispatched', `${NOTIFY_LIST_ACTION} did not answer.`).reading
  const ledger = useMemo(() => actionAnswerOf(ledgerReading, NOTIFY_LIST_ACTION), [ledgerReading])
  return useMemo(() => ({ledger, messagesAgents: agents}), [ledger, agents])
}

// ---------------------------------------------------------------------------------------------------------------- the publisher

/** A publisher has no place of its own to wait in: until it arrives the rail's widgets draw their devices' own waiting states (a failed
 * load still says so in words, shell/loadWhenDrawn.ts). */
function PublishesNothingYet() { return null }

/** The rail's agent devices — Messages, Gateways, the Agency gateway, Frames, the Ledger and the workcell rack (agent/devices/
 * AgentRailDevices.tsx) — published beside the rail-born devices, in every mode; their code loads when the rail first draws. */
const AgentRailDevices = loadWhenDrawn('The rail\'s agent devices', () => import('../agent/devices/AgentRailDevices').then(module => module.AgentRailDevices), PublishesNothingYet)

/** Publish each rail-born device on the door while the rail stands, and claim the rail's widget of the same id for it; and the rail's
 * agent devices with it. */
export function RailDevices() {
  const reading = useWidgetReading()
  const transport = reading?.transport
  // Files and Web each follow the selected agent, or keep their own (Follow off); the tape reader is shared where both read one session.
  const filesFollow = useFollowHold(), webFollow = useFollowHold()
  const diffReading = useDiffReading(transport), filesTape = useFollowedTape(filesFollow.kept), webTape = useFollowedTape(webFollow.kept)
  const trail = useTrailBinding(), diff = useDiffBinding(diffReading), nows = useNowsBinding(transport)
  const ownFiles = useFilesBinding(filesTape, diffReading, transport, filesFollow), web = useWebBinding(webTape, webFollow), wiki = useWikiBinding(transport)
  // Files carries its Diff page under `diff.` (§23.2, §23.4): the Diff's own binding, prefixed.
  const files = useMemo(() => carryPages(ownFiles, [{page: DIFF_PAGE, binding: diff}]), [ownFiles, diff])
  const devices = useMemo(() => Object.fromEntries(RAIL_DEVICES.map(spec => [spec.id, railDevice(spec.id)])) as Record<RailDeviceId, DeviceInstance>, [])
  // The Terminal (§17.9): a room of a session space, or a terminal the Workbench opened, while one stands (useTerminalBinding above);
  // its rail tile is widgets/TerminalRailWidget.tsx, its Full a pane. It stands on no chain.
  const terminal = useTerminalBinding(transport)
  const terminalInstance = useMemo(() => terminalDevice(), [])
  useEffect(() => { publishDevice(TERMINAL_ID, terminal ? {device: terminalInstance, binding: terminal} : null) }, [terminalInstance, terminal])
  // Each device is published again only when its own binding changes (a binding is the same object while its readings stand).
  useEffect(() => { publishDevice(devices.trail.id, {device: devices.trail, binding: trail}) }, [devices, trail])
  useEffect(() => { publishDevice(devices.files.id, {device: devices.files, binding: files}) }, [devices, files])
  useEffect(() => { publishDevice(devices.web.id, {device: devices.web, binding: web}) }, [devices, web])
  useEffect(() => { publishDevice(devices.wiki.id, {device: devices.wiki, binding: wiki}) }, [devices, wiki])
  useEffect(() => { publishDevice(devices.nows.id, {device: devices.nows, binding: nows}) }, [devices, nows])
  useEffect(() => () => { for (const spec of RAIL_DEVICES) publishDevice(railDeviceId(spec.id), null); publishDevice(TERMINAL_ID, null) }, [])
  return <AgentRailDevices />
}
