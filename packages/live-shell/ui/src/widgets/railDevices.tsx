// Devices born on the rail (DLW §23.1: "A widget with no device elsewhere, such as Files or Calendar, is a small device born on the
// rail"; §16.1 "A widget is a view of a device"). Each is a device of the runtime drawn by its catalogue design (`widgets:<id>`,
// inhabitants/catalogue/panels/widgets__<id>.tsx) on its owner's readings, and published on the device door, so its six views stand
// where every device's do: its Widget on the rail (the rail's registration of the same id draws the device — frame/widgets/
// deviceWidgets.tsx claimRailWidget), Whole in the pool, Full in a pane, Pop-out in its own window. The publisher stands once, with the
// rail's reading (App.tsx, inside the WidgetReadingProvider); the readings are the ones the rail's old tiles made (shell/TrailWidget.tsx,
// agent/AgentDockTileBody.tsx, shell/ModeContextDock.tsx), now drawn by the designs.
//
// Owners write, faces read: a key no owner reports reaches the design absent, with the owner's own words as `reason` where it refused;
// the keys a design marks as the tile's own (Limit, Show, Layout, Follow …) are view holds, kept here and never sent to an owner.
import {useEffect, useMemo, useRef, useState} from 'react'
import {useHeldRead, useOwnerOp} from '../owners/ownerCall'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {readGround, type CentralGroundReading} from '../../../../../desktop/cradle/src/central/client'
import {useTape} from '../../../../../desktop/cradle/src/agent/tape/journal'
import {listFiles, readFile} from '../../../../../desktop/cradle/src/files/client'
import {parseWiki, type WikiNode} from '../../../../../desktop/cradle/src/techne/wikiReading'
import type {TapeRow} from '../../../../../desktop/cradle/src/agent/tape/model'
import {useAgencySessions} from '../agent/useAgencySessions'
import {COMPANIONS} from '../shell/modeDockTiles'
import {CONVERSATION_PROJECT, conversationOf} from './agentConversation'
import {useOptionalContinuity} from '../continuity/workspace'
import {publishDevice} from '../frame/devices/deviceDoor'
import {claimRailWidget} from '../frame/widgets/deviceWidgets'
import type {DesignBinding, Value} from '../frame/devices/designed'
import type {DeviceInstance} from '../frame/devices/deviceRuntime'
import type {IconName} from '../inhabitants/sdk/Icon'
import {useWidgetReading} from './widgetReading'
import type {OwnerReading} from '../owners/ownerReading'
import {CALENDAR_ABSENT, diffFilesOf, filesOf, NOW_CLOSE_ABSENT, nowsValues, pagesOf, put, trailValues, wikiPagesOf} from './railBindings'

/** The family the rail-born devices stand in: their designs are `widgets:<id>` in the catalogue. */
export const RAIL_FAMILY = 'widgets'

/** The rail-born devices: the rail widget each one draws, its title, its mark, and what it reads. */
export const RAIL_DEVICES = [
  {id: 'trail', title: 'Trail', icon: 'trav', note: 'The workspace book\'s trail (desktop/cradle/src/workspace/store.ts TrailStop); a press returns to a stop.'},
  {id: 'files', title: 'Files', icon: 'lib', note: 'The files the followed agent read and changed, from its encounter tape (aikit encounter read, desktop/cradle/src/agent/tape), with the seat\'s diff counts.'},
  {id: 'web', title: 'Web', icon: 'browser', note: 'The pages the followed agent fetched, from its encounter tape: each address and the text it got.'},
  {id: 'wiki', title: 'Wiki', icon: 'orbit', note: 'The root wiki\'s pages (Control/agents/wiki/wiki.json through the files seam), each read as its source through the knowledge owner (kernel knowledge read).'},
  {id: 'diff', title: 'Diff', icon: 'select', note: 'The seat\'s working diff (kernel git_diff_read → Central central.git.diff, central.git-diff/v1) and its repository (git_repository_read).'},
  {id: 'nows', title: 'NOWs', icon: 'die', note: 'The ground\'s civil time, its Day and its open NOW clearings (kernel central inspect → central.civil-time-reading/v1, central.day-reading/v1, central.now-listing/v1).'},
  {id: 'calendar', title: 'Calendar', icon: 'metro', note: 'A third party\'s calendar, through the provider it comes from. No calendar provider is installed.'},
] as const satisfies readonly {id: string; title: string; icon: IconName; note: string}[]
export type RailDeviceId = typeof RAIL_DEVICES[number]['id']

/** The device id on the door, which is also its design's key (frame/devices/designs.ts designKey). */
export const railDeviceId = (id: RailDeviceId): string => `${RAIL_FAMILY}:${id}`

// The rail's widget of each id draws its device (claimed when this module loads, before the rail first draws).
for (const spec of RAIL_DEVICES) claimRailWidget(spec.id, railDeviceId(spec.id))

/** A rail-born device as the runtime holds it: no rows of its own (its design draws on the binding's keys). */
export function railDevice(id: RailDeviceId): DeviceInstance {
  const spec = RAIL_DEVICES.find(item => item.id === id)!
  return {id: railDeviceId(id), family: RAIL_FAMILY, rows: [], values: {},
    face: {id, title: spec.title, icon: spec.icon, liveSemantic: 'device-instrument', note: spec.note,
      invariant: {generatesAbsent: 'Born on the rail: it reads its owner and draws what the owner reports; nothing it shows is filled in.'}}}
}

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
  // The latest book, for the one move a press makes (the binding stays the same object while the trail does).
  const latest = useRef({continuity, context})
  latest.current = {continuity, context}
  const returnTo = useMemo(() => (ref: Value | undefined) => {
    const {continuity: book, context: now} = latest.current
    const stop = now?.trail?.find(item => (item.surfaceRef ?? item.label) === ref)
    if (!book || !stop) return
    book.switchMode(stop.mode)
    if (stop.surfaceRef && stop.surfaceKind) {
      const selection = {mode: stop.mode, kind: stop.surfaceKind, ref: stop.surfaceRef, title: stop.label, track: stop.position}
      book.setContext(current => ({...current, selection}))
    }
  }, [])
  const open = !!continuity, trail = context?.trail, here = context?.selection?.ref ?? null
  return useMemo(() => ({id: railDeviceId('trail'),
    values: withHolds(open ? trailValues(trail ?? [], here) : {reason: 'The workspace book is not open'}, holds),
    local: {...local, return: returnTo}}), [open, trail, here, holds, local, returnTo])
}

// ---------------------------------------------------------------------------------------------------------------- the Diff

/** The shell's project: the repository the Diff reads (the rail's old Diff tile read the same, agent/AgentDockTileBody.tsx:114). */
const DIFF_PROJECT = 'O-I'
type DiffReading = {status: 'reading'} | {status: 'refused'; words: string} | {status: 'read'; root: string; files: Record<string, Value>[]; head: string | null; branch: string | null; omitted: number}

function useDiffReading(transport: KernelTransportStatus | undefined): DiffReading {
  // Two held reads, each shared with every other view that asks the same (the agent dock's Diff, the chain's Git): the repository,
  // then its working diff once the repository has named its root.
  const repo = useOwnerOp(transport, {op: 'git_repository_read', project: DIFF_PROJECT}, 'git_repository_reading', 'The repository owner did not answer.').reading
  const doc = repo.status === 'answered' ? repo.value?.document as {repo_root?: unknown; branch?: unknown; head?: unknown} | undefined : undefined
  const root = typeof doc?.repo_root === 'string' ? doc.repo_root : null
  const patch = useOwnerOp(transport, root ? {op: 'git_diff_read', request: {repo_root: root, from: 'HEAD', to: 'working-tree', max_bytes: 65536, max_files: 200}} : null,
    'git_diff_reading', 'Central did not answer the diff.').reading
  return useMemo((): DiffReading => {
    if (!transport || transport.kind === 'unavailable') return {status: 'refused', words: transport?.reason ?? 'No kernel carrier stands.'}
    if (repo.status === 'refused') return {status: 'refused', words: repo.error ?? 'The repository owner did not answer.'}
    if (repo.status !== 'answered') return {status: 'reading'}
    if (!root) return {status: 'refused', words: 'Central did not disclose the repository root.'}
    if (patch.status === 'refused') return {status: 'refused', words: patch.error ?? 'Central did not answer the diff.'}
    if (patch.status !== 'answered' || !patch.value) return {status: 'reading'}
    const read = diffFilesOf(patch.value.document)
    if (!read) return {status: 'refused', words: 'Central returned an unsupported Git diff.'}
    return {status: 'read', root, files: read.files, head: read.head, branch: typeof doc?.branch === 'string' ? doc.branch : null, omitted: read.omitted}
  }, [transport, repo, patch, root, doc])
}

function useDiffBinding(reading: DiffReading): DesignBinding {
  const {holds, local} = useHolds(['show', 'session', 'layout', 'open'])
  return useMemo(() => {
    const values: Record<string, Value> = {}
    if (reading.status === 'read') {
      put(values, 'files', JSON.stringify(reading.files))
      put(values, 'branch', reading.branch)
      put(values, 'head', reading.head?.slice(0, 9))
    } else if (reading.status === 'refused') put(values, 'reason', reading.words)
    return {id: railDeviceId('diff'), values: withHolds(values, holds), local}
  }, [reading, holds, local])
}

// ---------------------------------------------------------------------------------------------------------------- Files and Web
// Both follow one agent: the conversation the rail's Agent follows (widgets/agentConversation.ts conversationOf — THE selection's
// session, else the mode's companion's), read through the one shared journal reader (desktop/cradle/src/agent/tape/journal.ts
// useTape: the owner's journal, never a copy). The tape names what each tool call acted on; it carries no line counts of its own.

function useFollowedTape(): {rows: readonly TapeRow[]; agent: string | null; words: string | null} {
  const reading = useWidgetReading()
  const continuity = useOptionalContinuity()
  const agency = useAgencySessions(reading?.transport ?? {kind: 'unavailable', reason: 'No kernel carrier stands.'})
  const companion = reading ? COMPANIONS[reading.mode].name : 'Agent'
  const {track} = conversationOf(agency.tracks, companion, continuity?.current.context?.selection?.ref ?? null)
  const {tape, reading: journal} = useTape(track ? {project: CONVERSATION_PROJECT, ref: track.sessionRef} : undefined, agency.tracks)
  const agent = track ? `${track.agentName ?? companion}${track.purpose ? ` · ${track.purpose}` : ''}` : null
  const words = track ? journal?.error ?? null : `No ${companion} session stands to follow.`
  // The same object while the rows, the agent and the words stand, so the two bindings change only when the tape does.
  return useMemo(() => ({rows: tape.rows, agent, words}), [tape.rows, agent, words])
}

function useFilesBinding(tape: ReturnType<typeof useFollowedTape>, diff: DiffReading): DesignBinding {
  const {holds, local} = useHolds(['show', 'blocked', 'follow', 'open'])
  return useMemo(() => {
    const values: Record<string, Value> = {}
    put(values, 'agent', tape.agent)
    if (tape.agent) put(values, 'files', JSON.stringify(filesOf(tape.rows, diff.status === 'read' ? diff.files : [], diff.status === 'read' ? diff.root : null)))
    put(values, 'reason', tape.words)
    return {id: railDeviceId('files'), values: withHolds(values, holds), local}
  }, [tape, diff, holds, local])
}

function useWebBinding(tape: ReturnType<typeof useFollowedTape>): DesignBinding {
  const {holds, local} = useHolds(['mark', 'follow', 'page'])
  return useMemo(() => {
    const values: Record<string, Value> = {}
    put(values, 'agent', tape.agent)
    if (tape.agent) put(values, 'pages', JSON.stringify(pagesOf(tape.rows)))
    put(values, 'reason', tape.words)
    return {id: railDeviceId('web'), values: withHolds(values, holds), local}
  }, [tape, holds, local])
}

// ---------------------------------------------------------------------------------------------------------------- the Wiki
// The root register's wiki, read verbatim through the files seam as the Technē registers read theirs (desktop/cradle/src/techne/
// wikiExpression.ts readWikiRegister: list the folder, read wiki.json, parseWiki). A page's text is its first source as the knowledge
// owner reads it (kernel knowledge `read` of {kind: 'source'}): AIKit returns the source's text and no link occurrences, so the
// page's links stay empty — never found by a pattern here.

const ROOT_WIKI_FOLDER = 'Control/agents/wiki'

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
  return useMemo(() => {
    const values: Record<string, Value> = {}
    if (pages.status === 'read') put(values, 'pages', JSON.stringify(wikiPagesOf(pages.nodes)))
    else if (pages.status === 'refused') put(values, 'reason', pages.words)
    put(values, 'page', shown)
    if (body && body.ref === shown) {
      if ('lines' in body) put(values, 'body', JSON.stringify({lines: body.lines, links: []}))
      else put(values, 'reason', body.words)
    }
    return {id: railDeviceId('wiki'), values: withHolds(values, holds), local}
  }, [pages, body, shown, holds, local])
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

function useNowsBinding(transport: KernelTransportStatus | undefined): DesignBinding {
  const reading = useGround(transport)
  const {holds, local} = useHolds(['machine', 'open'])
  return useMemo(() => {
    const values = reading.status === 'read' ? nowsValues(reading.ground) : reading.status === 'refused' ? {reason: reading.words} : {}
    return {id: railDeviceId('nows'), values: withHolds(values, holds), local, writes: key => key !== 'close', standing: {close: {disabled: NOW_CLOSE_ABSENT}}}
  }, [reading, holds, local])
}

// ---------------------------------------------------------------------------------------------------------------- the Calendar

function useCalendarBinding(): DesignBinding {
  const {holds, local} = useHolds(['range', 'calendar', 'thisWork'])
  return useMemo(() => ({id: railDeviceId('calendar'), values: withHolds({reason: CALENDAR_ABSENT}, holds), local}), [holds, local])
}

// ---------------------------------------------------------------------------------------------------------------- the publisher

/** Publish each rail-born device on the door while the rail stands, and claim the rail's widget of the same id for it. */
export function RailDevices() {
  const reading = useWidgetReading()
  const transport = reading?.transport
  const diffReading = useDiffReading(transport), tape = useFollowedTape()
  const trail = useTrailBinding(), diff = useDiffBinding(diffReading), nows = useNowsBinding(transport), calendar = useCalendarBinding()
  const files = useFilesBinding(tape, diffReading), web = useWebBinding(tape), wiki = useWikiBinding(transport)
  const devices = useMemo(() => Object.fromEntries(RAIL_DEVICES.map(spec => [spec.id, railDevice(spec.id)])) as Record<RailDeviceId, DeviceInstance>, [])
  // Each device is published again only when its own binding changes (a binding is the same object while its readings stand).
  useEffect(() => { publishDevice(devices.trail.id, {device: devices.trail, binding: trail}) }, [devices, trail])
  useEffect(() => { publishDevice(devices.diff.id, {device: devices.diff, binding: diff}) }, [devices, diff])
  useEffect(() => { publishDevice(devices.files.id, {device: devices.files, binding: files}) }, [devices, files])
  useEffect(() => { publishDevice(devices.web.id, {device: devices.web, binding: web}) }, [devices, web])
  useEffect(() => { publishDevice(devices.wiki.id, {device: devices.wiki, binding: wiki}) }, [devices, wiki])
  useEffect(() => { publishDevice(devices.nows.id, {device: devices.nows, binding: nows}) }, [devices, nows])
  useEffect(() => { publishDevice(devices.calendar.id, {device: devices.calendar, binding: calendar}) }, [devices, calendar])
  useEffect(() => () => { for (const spec of RAIL_DEVICES) publishDevice(railDeviceId(spec.id), null) }, [])
  return null
}
