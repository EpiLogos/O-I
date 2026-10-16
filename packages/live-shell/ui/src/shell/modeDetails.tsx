// Each mode's detail bodies (FOUNDATION F4): the clip editor its clips open in, the chain on its Device side, and the row's
// head line over each (world-shell-mockup.html `#dth`, set by clipDetail() and deviceDetail()). A table read by the one detail
// host (frame/detail/DetailHost.tsx), never a branch in the frame. The bodies are the ones each mode already had; the host
// gives every mode the same head, the same clip box, the same Clip | Device pair and the same one line while nothing is
// selected.
import type {ComponentType} from 'react'
import type {SurfMode} from './modeGrammar'
import {useDetailReading, type DetailReading} from '../frame/detail/detailReading'
import {clipBoxRows, useSelectedClip, type SelectedClip} from '../frame/detail/ClipBox'
import {ClipWaiting} from '../frame/detail/ClipView'
import {DeviceChainPanel, LIVE_CLIP_WAITS} from '../components/DeviceChainPanel'
import {liveClipOf} from '../live/LiveClip'
import {trackDeviceFaceTitle} from '../live/liveChain'
import {addNoteDevice} from '../live/noteDevices/noteDeviceHold'
import {NOTE_DEVICE_MIME, parseNoteDeviceDrag} from '../live/noteDevices/noteDeviceDrag'
import {displayDeviceName} from './document'
import {NativeWorldDetail} from '../components/NativeWorldDetail'
import {CentralClipChooser} from '../central/CentralClipChooser'
import {centralSubjectName} from '../central/CentralClipDetail'
import {BaseDevicesDetail, FactoryTaskLogDetail, TechneClipDetail, TechneInstrumentsDetail} from './ModeDetail'
import {AgentShellDeviceDetail} from '../agent/AgentShellDeviceDetail'
import {TaskClipDevice} from '../agent/devices/TaskClipDevice'
import {WorldSubjectClip} from '../techne/subject/WorldSubjectClip'
import {useAgentSessionsOptional} from '../agent/AgentSessionsProvider'
import {eventsForSession, trackKey, type AgentSessionTrack} from '../agent/agentRunModel'
import {parseFactoryTaskRef} from '../timeline/factoryTrackAdapter'
import {STANDALONE_INSTRUMENTS, TECHNE_INSTRUMENTS} from '../inhabitants/sdk/semantics'
import type {PaneInstrumentId} from './paneInstrument'

/** What a head is drawn from: the frame's detail reading, the selected clip as the shown tracks give it, and the focused
 * pane's instrument when it takes the Device side. Nothing more is read for a head. */
export interface DetailHeadReading {
  detail: DetailReading
  selected: SelectedClip
  instrument: PaneInstrumentId | null
}

/** The row's head line: the thing in bold, then what this side of the row shows of it (the mockup's `<b>…</b> — …`). */
export interface DetailHead {
  name: string
  line?: string
}

export interface ModeDetail {
  clip: ComponentType
  device: ComponentType
  /** The mode's own devices lead a focused instrument's chain (Central's ground devices are never removed by the ruling). */
  devicesLeadInstrument?: boolean
  /** The mode keeps its own Device side whatever pane is focused (Live: the instrument's chain is the mode). */
  ownsDeviceSide?: boolean
  /** The chain's end: what can be dropped onto it (Live's "Drop Instruments or Samples Here"; the mockup's .dropz). Null when
   * the chain draws its own drop receiver (Factory's, which arms while a drag is held and answers through the owner). */
  dropHint: string | null
  /** What the chain's end receives: the drag type it accepts, and the one call a drop makes — the same call the browser row's
   * double-click makes, so a drop and a double-click land the same device. `receive` answers null when the device landed, else
   * the refusal in words. Absent: the end is a hint only (its owner has no add yet). */
  drop?: ChainDrop
  /** The one line the Clip side shows while nothing is selected — what it waits for, in the mode's own words. */
  clipWaits: string
  /** The Clip side opens without a selection: the mode's clip is not chosen from its tracks (Expressions: the open
   * Expression's scene). */
  clipUngated?: boolean
  /** The row's head line, per side. */
  head: {clip: (reading: DetailHeadReading) => DetailHead; device: (reading: DetailHeadReading) => DetailHead}
}

export interface ChainDrop {
  readonly accepts: string
  readonly receive: (payload: string) => string | null
}

/** An instrument by the plain name its holder declares (inhabitants/sdk/semantics.ts; its M′ address is provenance, never
 * its name): "Timeline", "Knowledge graph". */
export function instrumentName(id: PaneInstrumentId): string {
  return [...TECHNE_INSTRUMENTS, ...STANDALONE_INSTRUMENTS].find(item => item.id === id)?.title ?? id
}

/** The head of a Device side the focused pane's instrument has taken (the mockup's Technē head, renderDetail() :1650). */
const instrumentHead = (id: PaneInstrumentId): DetailHead => ({name: 'Instruments', line: `${instrumentName(id)} open on the focused pane; its controls are its own`})

/** A Factory session's name beside its task: the tracks pane's name for it, unless that is the task's own title (a session is
 * named by its purpose, which is its task's), then the agent and the session as the pane names an unnamed one
 * (timeline/factoryTrackAdapter.ts trackName). */
function factorySessionName(track: AgentSessionTrack, taskTitle: string | null | undefined, shown: string | undefined): string {
  if (shown && shown !== taskTitle) return shown
  return track.agentName ? `${track.agentName} · ${track.sessionRef.slice(0, 10)}` : track.sessionRef.slice(0, 12)
}

/** Central's open document: the browser subject, else the selected clip. */
const centralDocument = ({detail, selected}: DetailHeadReading): string | null =>
  detail.centralSubject ? centralSubjectName(detail.centralSubject) : selected.clip?.label ?? null

function LiveClip() { const {live} = useDetailReading(); return <DeviceChainPanel ctx={live.ctx} document={live.document} selection={live.selection} mode="clip" /> }
function LiveChain() { const {live} = useDetailReading(); return <DeviceChainPanel ctx={live.ctx} document={live.document} selection={live.selection} mode="device" /> }
function CentralClip() {
  const {transport, centralSubject, world} = useDetailReading()
  const selected = useSelectedClip()
  return <CentralClipChooser transport={transport} subject={centralSubject} world={world} waits={MODE_DETAILS.base.clipWaits} colour={selected.track?.color} />
}
function CentralChain() { const {transport, centralSubject, world} = useDetailReading(); return <BaseDevicesDetail transport={transport} world={world} subject={centralSubject} /> }
/** The selected task: THE selection names it (`<session track>#task/<n>`, timeline/factoryTrackAdapter.ts), or a session track
 * whose first task it opens; its session is the agency reading's own track, its log the sessions provider's one temporal read. Beside
 * the log stands the task itself, the Tasks device the chain publishes (DLW §19.12 "In Clip view, the task is the clip"; lane BF3). */
function FactoryClip() {
  const {factory} = useDetailReading()
  const selected = useSelectedClip()
  const sessions = useAgentSessionsOptional()
  const task = selected.ref ? parseFactoryTaskRef(selected.ref) : null
  const trackId = task?.trackId ?? selected.ref
  const track = trackId ? factory.tracks.find(item => trackKey(item) === trackId) ?? null : null
  if (!track) return <ClipWaiting line={MODE_DETAILS.factory.clipWaits} />
  const shown = selected.set?.tracks.find(item => item.id === trackId)
  const title = track.tasks.find(item => !item.softStop && (task ? item.n === task.n : true))?.title
  return <div className="factory-clip"><TaskClipDevice />
    <FactoryTaskLogDetail track={track} n={task?.n ?? null} name={factorySessionName(track, title, shown?.name)} colour={shown?.color} box={clipBoxRows(selected)}
      events={sessions ? eventsForSession(sessions.events, track.sessionRef) : null} /></div>
}
function FactoryChain() { const {factory} = useDetailReading(); return <AgentShellDeviceDetail tracks={factory.tracks} /> }
// An Expressions clip is a scene (lock §9.1). Beside its editor stand the Scene's own controls — the Scene selector, Saved scenes,
// Save, Guide, the pins strip and Expression time — which stood on the Expressions bar until they had a home on the clip
// (components/expressions/clip/SceneControls.tsx). Technē's native clip below is the same editor without them: its bar never had them.
function ExpressionsClip() { const {native} = useDetailReading(); return <NativeWorldDetail mode="clip" sceneControls {...native} /> }
function ExpressionsChain() { const {native} = useDetailReading(); return <NativeWorldDetail mode="device" {...native} /> }
// Technē's clips are World cut events while the tracks pane stands over the World cut, else the open work's native clip.
function TechneClip() { const {worldCut, world, native, worldSubject} = useDetailReading(); return worldSubject ? <WorldSubjectClip subject={worldSubject} /> : worldCut ? <TechneClipDetail world={world} /> : <NativeWorldDetail mode="clip" {...native} /> }
function TechneChain() { const {transport} = useDetailReading(); return <TechneInstrumentsDetail transport={transport} /> }

export const MODE_DETAILS: Readonly<Record<SurfMode, ModeDetail>> = {
  // Live: the one instrument's chain and the open set's clips (lock §0.2). The heads are the mockup's liveDetail() :1760 —
  // "<b>Drums</b> — Drum Rack → Glue Compressor → Reverb" and "<b>Kit 1</b> — Drums · clip" — read from the open set alone, so a
  // head never names what the row does not show: the instrument's own plates (keyboard, note devices, torus) stand in the row.
  live: {clip: LiveClip, device: LiveChain, ownsDeviceSide: true, dropHint: 'Drop an instrument or effect here',
    drop: {accepts: NOTE_DEVICE_MIME, receive: payload => {
      const kind = parseNoteDeviceDrag(payload)
      if (!kind) return 'Only a note device lands on this chain.'
      addNoteDevice(kind)
      return null
    }},
    clipWaits: LIVE_CLIP_WAITS,
    head: {
      clip: ({detail, selected}) => {
        const clip = liveClipOf(detail.live.ctx?.set ?? null, detail.live.document, detail.live.selection)
        return clip ? {name: clip.name, line: `${clip.track ?? selected.track?.name ?? 'its track'} · clip`} : {name: 'Clip'}
      },
      device: ({detail}) => {
        const track = detail.live.ctx?.set?.tracks[detail.live.selection.track]
        if (!track) return {name: 'No track selected'}
        const devices = track.devices.map(name => trackDeviceFaceTitle(name) ?? displayDeviceName(name))
        return devices.length ? {name: track.name, line: devices.join(' → ')} : {name: track.name}
      },
    }},
  base: {clip: CentralClip, device: CentralChain, devicesLeadInstrument: true, dropHint: 'Add a document device',
    clipWaits: 'Select a day, a document or an entry, in the browser or on the day\'s tracks, to see it as data here.',
    head: {
      clip: reading => ({name: centralDocument(reading) ?? 'Document', line: centralDocument(reading) ? 'the document as data' : undefined}),
      device: reading => ({name: centralDocument(reading) ?? 'No document selected',
        line: `document devices: each modifies the open document${reading.instrument ? ` · then ${instrumentName(reading.instrument)}, open on the focused pane` : ''}`}),
    }},
  factory: {clip: FactoryClip, device: FactoryChain, dropHint: null,
    clipWaits: 'Select a task on a session\'s track to read its tool-run log here.',
    head: {
      clip: ({detail, selected}) => {
        if (!selected.clip) return {name: 'Task log'}
        const track = detail.factory.tracks.find(item => trackKey(item) === selected.clip!.trackId)
        const session = track ? factorySessionName(track, selected.clip.label, selected.track?.name) : selected.track?.name ?? selected.clip.trackId
        return {name: selected.clip.label, line: `${session} · the task's tool-run log`}
      },
      device: ({detail, selected, instrument}) => {
        if (instrument) return instrumentHead(instrument)
        // The chain's session is THE selection's, as the agent shell reads it (agent/AgentShellContext.tsx sessionOfSelection).
        const trackId = selected.ref ? parseFactoryTaskRef(selected.ref)?.trackId ?? selected.ref : null
        const track = trackId ? detail.factory.tracks.find(item => trackKey(item) === trackId) : undefined
        const shown = selected.set?.tracks.find(item => item.id === trackId)?.name
        // With no session selected the Device side is Factory's Main track (§16.2; agent/devices/FactoryDeviceChain.tsx), as Live
        // shows the Main track's chain when no other track is chosen.
        if (!track) return {name: 'Main', line: 'Factory\'s Main track: the gateways, the Experiment, the Ledger, Approvals and the Link'}
        return {name: shown ?? factorySessionName(track, null, undefined),
          line: track.group ? 'a group: the Agentset rack, then the path: gateway → agent → skills → world → git' : 'the agent\'s path: gateway → agent → skills → world → git'}
      },
    }},
  // The Studio receives a dragged field device itself (ExpressionsStudio.tsx, DEVICE_MIME), and the mockup's Expressions row
  // ends at the Studio — no separate box (lane P, 15 Oct: the box took ~150px the Studio's columns need at 1440).
  expressions: {clip: ExpressionsClip, device: ExpressionsChain, dropHint: null,
    clipWaits: 'Open an Expression to see its scene here.', clipUngated: true,
    head: {
      clip: ({selected}) => ({name: selected.clip?.label ?? 'Scene', line: selected.set?.tracks[0]?.name ?? 'the open Expression\'s scene'}),
      device: ({selected, instrument}) => instrument ? instrumentHead(instrument)
        : {name: 'Studio', line: `the Expressions engine's own controls${selected.set?.tracks[0] ? ` · ${selected.set.tracks[0].name}` : ''}`},
    }},
  techne: {clip: TechneClip, device: TechneChain, dropHint: 'Drop a device here',
    clipWaits: 'Select an event or a stop to see what is in focus here.',
    head: {
      clip: ({selected, detail}) => selected.clip ? {name: selected.clip.label, line: 'what is in focus'} : detail.worldSubject ? {name: detail.worldSubject.title, line: 'what is in focus'} : {name: 'Clip'},
      device: ({instrument}) => instrument ? instrumentHead(instrument) : {name: 'Instruments', line: 'none open on the focused pane'},
    }},
}
