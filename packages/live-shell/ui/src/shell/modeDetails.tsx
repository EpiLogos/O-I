// Each mode's detail bodies (FOUNDATION F4): its Clip view (the mode's designed clip on its clip binding, hosted by the one clip
// host, frame/detail/ClipHost.tsx), the chain on its Device side, and the head line over the chain (world-shell-mockup.html `#dth`,
// set by deviceDetail()). A table read by the one detail host (frame/detail/DetailHost.tsx), never a branch in the frame; the host
// gives every mode the same Clip view over Device view (manual §16.4), the same Clip | Device pair and the same one line while
// nothing is selected.
import type {ComponentType} from 'react'
import type {SurfMode} from './modeGrammar'
import type {DetailReading} from '../frame/detail/detailReading'
import type {SelectedClip} from '../frame/detail/ClipBox'
import type {ClipPlace} from '../frame/detail/ClipHost'
import {LIVE_CLIP_WAITS, liveClipOf} from '../live/LiveClip'
import {trackDeviceFaceTitle} from '../live/liveChain'
import {addNoteDevice} from '../live/noteDevices/noteDeviceHold'
import {NOTE_DEVICE_MIME, parseNoteDeviceDrag} from '../live/noteDevices/noteDeviceDrag'
import {displayDeviceName} from './document'
import {centralSubjectName} from '../central/subjectName'
import {trackKey, type AgentSessionTrack} from '../agent/agentRunModel'
import {parseFactoryTaskRef} from '../timeline/factoryTrackAdapter'
import {workcellOfTrack} from '../frame/tracks/returnTracks'
import {STANDALONE_INSTRUMENTS, TECHNE_INSTRUMENTS} from '../inhabitants/sdk/semantics'
import type {PaneInstrumentId} from './paneInstrument'
import {loadWhenDrawn} from './loadWhenDrawn'

// Each mode's Clip view and chain are its own module (shell/details/<mode>.tsx), loaded when that mode's detail first draws — never
// with the shell's first frame, so a world that opens in one mode fetches no other mode's bodies (shell/loadWhenDrawn.ts; O-I #740;
// tests/first-load-budget.test.mjs). Until a body arrives its place shows the shell's waiting line for it, in words.
type ClipBody = ComponentType<{place: ClipPlace}>
const LiveClip: ClipBody = loadWhenDrawn('Live\'s clip', () => import('./details/live').then(module => module.LiveClip))
const LiveChain = loadWhenDrawn('Live\'s chain', () => import('./details/live').then(module => module.LiveChain))
const CentralClip: ClipBody = loadWhenDrawn('Central\'s clip', () => import('./details/central').then(module => module.CentralClip))
const CentralChain = loadWhenDrawn('Central\'s chain', () => import('./details/central').then(module => module.CentralChain))
const FactoryClip: ClipBody = loadWhenDrawn('Factory\'s clip', () => import('./details/factory').then(module => module.FactoryClip))
const FactoryChain = loadWhenDrawn('Factory\'s chain', () => import('./details/factory').then(module => module.FactoryChain))
const ExpressionsClip: ClipBody = loadWhenDrawn('Expressions\' clip', () => import('./details/expressions').then(module => module.ExpressionsClip))
const ExpressionsChain = loadWhenDrawn('Expressions\' chain', () => import('./details/expressions').then(module => module.ExpressionsChain))
const TechneClip: ClipBody = loadWhenDrawn('Technē\'s clip', () => import('./details/techne').then(module => module.TechneClip))
const TechneChain = loadWhenDrawn('Technē\'s instruments', () => import('./details/techne').then(module => module.TechneChain))

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
  /** The mode's Clip view: its clip binding hosted at the place the detail host measured (frame/detail/ClipHost.tsx), or the one
   * line it waits with. */
  clip: ComponentType<{place: ClipPlace}>
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

/** An instrument by the plain name its holder declares (inhabitants/sdk/semantics.ts; Technē's instruments carry no M′ number):
 * "Timeline", "Knowledge graph". */
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

// Each mode's clip (T-REALIGN R2; manual §16.5): one clip host draws the mode's designed clip on the mode's clip binding, which ports
// the readings of the bodies it replaces (live/LiveClip.tsx; central/CentralClipChooser.tsx and CentralClipDetail.tsx;
// agent/devices/TaskClipDevice.tsx and ModeDetail.tsx FactoryTaskLogDetail; the Expressions clip column of NativeWorldDetail.tsx;
// ModeDetail.tsx TechneClipDetail and techne/subject/WorldSubjectClip.tsx). The bodies are shell/details/<mode>.tsx, registered above.

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
    clipWaits: 'Select a day, a page or an entry, in the browser or on the day\'s tracks, to open it in Clip view.',
    head: {
      clip: reading => ({name: centralDocument(reading) ?? 'Page', line: centralDocument(reading) ? 'the page in Clip view' : undefined}),
      device: reading => ({name: centralDocument(reading) ?? 'No document selected',
        line: `document devices: each modifies the open document${reading.instrument ? ` · then ${instrumentName(reading.instrument)}, open on the focused pane` : ''}`}),
    }},
  factory: {clip: FactoryClip, device: FactoryChain, dropHint: null,
    clipWaits: 'Select a task on a session\'s track to open it in Clip view: its launch, its log and its envelopes.',
    head: {
      clip: ({detail, selected}) => {
        if (!selected.clip) return {name: 'Task log'}
        const track = detail.factory.tracks.find(item => trackKey(item) === selected.clip!.trackId)
        const session = track ? factorySessionName(track, selected.clip.label, selected.track?.name) : selected.track?.name ?? selected.clip.trackId
        return {name: selected.clip.label, line: `${session} · the task in Clip view`}
      },
      device: ({detail, selected, instrument}) => {
        if (instrument) return instrumentHead(instrument)
        // The chain's session is THE selection's, as the agent shell reads it (agent/AgentShellContext.tsx sessionOfSelection).
        const trackId = selected.ref ? parseFactoryTaskRef(selected.ref)?.trackId ?? selected.ref : null
        const track = trackId ? detail.factory.tracks.find(item => trackKey(item) === trackId) : undefined
        const shown = selected.set?.tracks.find(item => item.id === trackId)?.name
        // A workcell's return track (frame/tracks/returnTracks.ts, `workcell:<name>`; §19.23): the Device side is that workcell's chain.
        const cell = workcellOfTrack(trackId)
        if (cell) return {name: cell, line: 'the workcell\'s chain: Gateway → Remote carrier → Git / landing, with its Seat'}
        // With no session selected the Device side is Factory's Main track (§16.2; agent/devices/FactoryDeviceChain.tsx), as Live
        // shows the Main track's chain when no other track is chosen. The gateways, the frames and the ledger are monitors on the rail, and
        // the road in and out is the workcell's (§19.1, §19.23): a session's chain is the agent, its skills and its scope.
        if (!track) return {name: 'Main', line: 'Factory\'s Main track: the Run map, Approvals and the prompt pads'}
        return {name: shown ?? factorySessionName(track, null, undefined),
          line: track.group ? 'a group: the Agentset rack and the Decision helper, then the chain: agent → skills → scope' : 'the agent\'s chain: agent → skills → scope'}
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
