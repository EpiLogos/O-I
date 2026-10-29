// Live's set as tracks, the reference adapter for the shared Session and Arrangement (FOUNDATION F3; lock §9.1 Live row:
// track = audio / MIDI / group / return, clip = audio / MIDI clip, stop = scene).
//
// Projection:
// - tracks: the set's tracks in order, each with its kind and its display colour;
// - columns: the set's scenes, the Session grid's rows (Live's scenes are the DLW's stops);
// - clips: every filled session slot (a clip in its scene's row), and every arrangement clip placed on the ruler by its
//   own start and end in beats — an arrangement clip stands in no row;
// - ruler: beats, labelled bar.beat as Live's own ruler counts them.
// Clip and track ids are the refs THE selection already speaks for Live (shell/liveSelection.ts: als:<set>#track/<i>,
// …/slot/<scene>, …/clip/<j>), so selecting a clip on the shared grid is selecting it everywhere.
//
// The set's owner discloses no playback state and no launch op, so clips carry no status and the set no actions: the grid
// stays honest and read-only until the owner gives them. Pure TypeScript.
//
// R3 (manual §21.1 "The mixer row", §16.6; Live cap 37–45): the set's master track is the Main track (flagged `main`, its chain the
// devices the set lists on it); every part carries Live's mixer row — Activator, Solo, Arm, Monitor In · Auto · Off, its input and
// output — read from the set's owner (`live_set_read`, packages/live-set/src/edit.rs) and, where a writer is handed in, written to it
// (`live_track_mixer_write`) against the set's revision; the routings are read, not chosen. Under each track its take lanes and its
// automation envelopes, as the set holds them. A control the track has no element for stays absent.
//
// The sends (manual §21.1 "Sends: How much of the part goes to each return track"): each part's sends ride its `mix` as `sends`, one
// for each return in the set's order, named by the return it feeds, its level in dB; where a writer is handed in, `actions.mixer.send`
// writes one (`live_track_mixer_write` control "send"). The comp (§21.1 "Select a range in a take and press Enter to bring it into the
// main lane … the take lane marks the range it gave"): `lanes.comp` lays each main-lane stretch under the take it came from (Live's own
// record, the TakeId a comped clip shares with its take), and `actions.comp` runs `live_take_comp` with the take lane and the stretch.
//
// The acts on the set's objects (manual §10.9 Acts and menus, O-I #743): Insert clip runs `live_clip_create` (an empty one-bar MIDI clip,
// Live's Insert MIDI Clip); Paste, a clip's Duplicate and Delete, an empty slot's stop button, a track's Rename, Move and Duplicate, and a
// row's Insert, Rename, Duplicate and Delete each run one typed `live_set_act` (packages/live-set/src/acts.rs) against the set's revision,
// and answer in the owner's words. Launch, Stop and Stop all play the clip on the torus through the clip player (live/clipPlayer.ts
// clipLaunchActs). The slots whose stop button the set has removed are each track's `stopless`, read from the owner (`stoplessSlots`).
import type {SetDocument} from '../shell/document'
import {liveColour, liveColourIndex} from '../live/livePalette'
import type {SetSummary} from '../shell/useSet'
import type {WorldActionReceipt, WorldAutomationLane, WorldCompStretch, WorldMixer, WorldTakeLane, WorldTrackActions, WorldTrackAdapter, WorldTrackClip, WorldTrackMix, WorldTrackSet} from './worldTrackAdapter'
import type {LiveClipAt, LiveEnvelope, LiveSend, LiveSetAct, LiveSetActed, LiveTakeLane, LiveTrackMixer} from '../../../../../desktop/cradle/src/kernel/types'

const missing = (what: string, op: string) => `${what}: no owner operation carries it yet — missing op: ${op} (kernel · live-set).`
const MIXER_READ = 'live_set_read reporting each track\'s mixer {activator, solo, arm, monitor: "in" | "auto" | "off", input, output} from the .als (TrackActivator, Solo, Arm, MonitoringEnum, AudioInputRouting / MidiInputRouting, AudioOutputRouting)'
const mixerWrite = (control: string, value: string) => `live_track_mixer_write {path, track, control: "${control}", value: ${value}} → {ok, note} | {ok: false, error}, and ${MIXER_READ}`

/** Live's mixer row (manual §21.1), each control's meaning in the manual's words. */
export const LIVE_MIXER: WorldMixer = {
  activator: {meaning: 'Turns the part on or off; off, the part makes no sound', disabled: missing('Activator', mixerWrite('activator', 'bool'))},
  solo: {meaning: 'Lets you hear only the soloed parts', disabled: missing('Solo', mixerWrite('solo', 'bool'))},
  arm: {meaning: 'Arms the part for recording: press Record, or a clip slot\'s record button, to record what you play into a clip', disabled: missing('Arm', mixerWrite('arm', 'bool'))},
  monitor: {meaning: 'In always passes what you play through the chain; Auto passes it when the part is armed; Off passes only the clips', disabled: missing('Monitor', mixerWrite('monitor', '"in" | "auto" | "off"'))},
  input: {meaning: 'Where the part\'s notes or sound come from: the playing surface, the computer keys or MIDI; an audio part, your audio interface', disabled: missing('Input', mixerWrite('input', 'routing'))},
  output: {meaning: 'Where the part goes: the Main track, a group, or another part', disabled: missing('Output', mixerWrite('output', 'routing'))},
}

/** Why the set's lanes are absent, in its owner's terms. */
export const LIVE_LANES_ABSENT = {
  takes: missing('Take lanes', 'live_set_read reporting each track\'s TakeLanes {name, clips: [{name, start, end, takeId, gave}]}, the main lane\'s stretches each take gave'),
  automation: missing('Automation lanes', 'live_set_read reporting each track\'s AutomationEnvelopes {device, parameter, points: [{beat, value}]}'),
  events: 'Event lanes are Factory\'s: a session\'s messages, files, terminal and pages read.',
} as const

export interface LiveSetReading {
  set: SetSummary | null
  document: SetDocument | null
  /** Each track's display colour, by index (the shell's palette and the person's overrides). */
  colors?: readonly string[]
  /** The set owner's mixer write (live/liveWrites.ts writeLiveMixer); absent, the row is read only and says why. */
  mixerWrite?: (track: number, control: 'activator' | 'solo' | 'arm' | 'monitor', value: boolean | 'in' | 'auto' | 'off') => Promise<unknown>
  /** The set owner's send write (live/liveWrites.ts writeLiveSend): a send by its index, its level as linear gain. */
  sendWrite?: (track: number, index: number, value: number) => Promise<unknown>
  /** The set owner's comp (live/liveWrites.ts writeLiveComp): a take lane by its index, a stretch in beats. */
  compWrite?: (track: number, take: number, range: {start: number; end: number}) => Promise<unknown>
  /** The set owner's acts on its objects (live/liveWrites.ts writeLiveSetAct, kernel live_set_act); absent, they wait for it. */
  act?: (act: LiveSetAct) => Promise<LiveSetActed>
  /** Insert clip through the set's owner (live/liveWrites.ts writeLiveInsertClip, kernel live_clip_create). */
  insertClip?: (track: number, scene: number) => Promise<unknown>
  /** A clip's info text, read from and written to the set's owner (live/liveWrites.ts: live_clip_read, live_clip_write `info`). */
  clipInfo?: {read(track: number, clip: LiveClipAt): Promise<string>; write(track: number, clip: LiveClipAt, text: string): Promise<unknown>}
  /** Launch, Stop the track and Stop all on the torus (live/clipPlayer.ts liveClipActs), by the track's place and the clip's. */
  play?: {launch(track: number, at: LiveClipAt): Promise<WorldActionReceipt>; stop(track: number): WorldActionReceipt | Promise<WorldActionReceipt>
    stopAll(): WorldActionReceipt | Promise<WorldActionReceipt>}
}

/** The op an act of the set's names, in the words a menu shows. */
export const LIVE_ACT_OP = (kind: LiveSetAct['kind']) => `live_set_act · ${kind} — the set's own ${kind.replace('_', ' ')}, against its revision (packages/live-set/src/acts.rs)`
export const LIVE_INSERT_CLIP_OP = 'live_clip_create {path, track, scene, length: 4, notes: []} — an empty one-bar MIDI clip in the empty slot, as Live inserts one'
/** What an act no op of the set's owner carries waits for (O-I #743, round two), as the status bar says after the missing op. */
export const LIVE_RENDER_WAIT = 'Consolidating audio clips writes a new sample of what plays: a render of the part, which nothing here carries.'
/** Why a track of a kind cannot be consolidated here, by the kind its owner reads (a MIDI part's the owner takes). */
const CONSOLIDATE_REFUSED: Readonly<Partial<Record<SetSummary['tracks'][number]['kind'], string>>> = {audio: LIVE_RENDER_WAIT}
export const LIVE_WAITING: Readonly<Record<string, string>> = {
  'row.launch': 'a player of every clip of a row at once on the torus: the clip player (live/clipPlayer.ts) plays one clip at a time',
  'slot.record': 'a recording path: what is played written into a new clip in the slot; nothing records into a clip yet',
  'track.remove': 'the decode of how Live re-routes the parts and sends that went to a deleted track: session-model.md has no rule for it',
  'clip.crop': 'the decode of what Live\'s Crop Clip keeps of a clip — its notes and markers outside the loop, or outside its start and end: the Live Object Model lists Clip.crop (LOM-INVENTORY.md), and nothing decoded says what it does; an audio clip\'s crop also writes a new sample, a render',
}
export const LIVE_INFO_OP = 'live_clip_write {path, track, clip, set: {info}} — the clip\'s info text (its Annotation), against the set\'s revision'
export const LIVE_PLAY_OP = 'the clip player (live/clipPlayer.ts): the clip read from the set\'s owner, its notes struck on the torus at the set\'s tempo'

/** One send on a part's mixer row: Live's name for it ("Send A"), the return track it feeds, its level in dB within the range the set
 * keeps (Live's −70 dB floor to 0 dB), and why it cannot be moved when Live has it off on this part (a return's own sends). */
export interface LiveMixSend {id: string; name: string; value: number | null; min: number; max: number; unit: 'dB'; disabled?: string}
/** A part's mixer readings with its sends (worldTrackAdapter's WorldTrackMix carries no sends yet: PROPOSE). */
export type LiveTrackMix = WorldTrackMix & {sends?: readonly LiveMixSend[]}
/** The mixer row's writes with the send's (WorldTrackActions.mixer carries no send yet: PROPOSE). */
export type LiveMixerActions = NonNullable<WorldTrackActions['mixer']> & {send?: {op: string; run(trackId: string, sendId: string, db: number): unknown}}

/** A send's level, linear gain as the set keeps it, in dB; and back within the send's own range. */
const gainToDb = (gain: number, floor: number): number => 20 * Math.log10(Math.max(gain, floor))
const dbToGain = (db: number, floor: number, top: number): number => Math.max(floor, Math.min(top, 10 ** (db / 20)))
/** Live 12's send floor, as every set keeps it (each Send's MidiControllerRange Min). */
const SEND_FLOOR = 0.0003162277571

/** A part's sends on its row, in the set's order. */
export function liveMixSends(sends: readonly LiveSend[]): LiveMixSend[] {
  return sends.map(send => {
    const floor = send.min ?? SEND_FLOOR, top = send.max ?? 1
    return {id: send.send, name: send.name, value: send.value === null ? null : gainToDb(send.value, floor), min: gainToDb(floor, floor),
      max: gainToDb(top, floor), unit: 'dB' as const, ...(send.on ? {} : {disabled: `${send.send} is off on this part: Live turns a return's own sends on from the send's menu.`})}
  })
}

export const LIVE_SEND_WRITE_OP = 'live_track_mixer_write {path, track, control: "send", index, value} — the part\'s send to a return, against the set\'s revision'
export const LIVE_COMP_OP = 'live_take_comp {path, track, take, range: {start, end}} — the take\'s stretch copied into the main lane, as Live records a comp'

/** The ops the mixer row names when it writes. */
export const LIVE_MIXER_WRITE_OP = (control: string) => `live_track_mixer_write {path, track, control: "${control}"} — the set's own ${control}, against its revision`
const ROUTING_READ = 'The routing is read from the set; choosing another needs the routings Live offers on this machine, which the document does not list.'

/** The mixer as it stands with the set's owner writing it: the four controls enabled, the routings read. */
const LIVE_MIXER_WRITTEN: WorldMixer = Object.fromEntries(Object.entries(LIVE_MIXER).map(([id, control]) => {
  if (id === 'input' || id === 'output') return [id, {...control, disabled: ROUTING_READ}]
  const {disabled: _missing, ...rest} = control!
  return [id, rest]
}))

/** A Live envelope as a lane: its points 0–1 of the range its parameter keeps (the device's MIDI range, else the points' own). */
function automationLane(trackId: string, index: number, env: LiveEnvelope, document: SetDocument['tracks'][number]): WorldAutomationLane {
  const param = document.devices.find(device => device.name === env.device)?.params.find(p => p.id === env.parameter)
  const values = env.points.map(([, v]) => v)
  const min = param?.min !== undefined && param.min !== null && Number.isFinite(Number(param.min)) ? Number(param.min) : Math.min(...values, 0)
  const max = param?.max !== undefined && param.max !== null && Number.isFinite(Number(param.max)) ? Number(param.max) : Math.max(...values, 1)
  const span = max - min || 1
  return {id: `${trackId}#automation/${index}`, trackId, device: env.device, parameter: env.parameter,
    points: env.points.map(([at, v]) => ({at, value: Math.max(0, Math.min(1, (v - min) / span))})), range: {min, max}}
}

export const LIVE_SET_TRACK_ADAPTER_ID = 'live-set-tracks'

const barBeat = (beats: number): string => `${Math.floor(beats / 4) + 1}.${Math.floor(beats % 4) + 1}`

export const liveSetTrackAdapter: WorldTrackAdapter<LiveSetReading> = {
  id: LIVE_SET_TRACK_ADAPTER_ID,
  project({set, document, colors, mixerWrite, sendWrite, compWrite, act, insertClip, clipInfo, play}): WorldTrackSet {
    if (!set) return {columns: [], tracks: [], clips: []}
    const trackRef = (index: number) => `als:${set.path}#track/${index}`
    // The set's master track is Live's Main track: its material stands at the end, and its chain is the devices the set lists on it.
    // A group's members stand under it (Live's TrackGroupId names the group's own Id), a rail for every level.
    const byId = new Map<string, number>()
    document?.tracks.forEach((track, index) => { if (track.trackId) byId.set(track.trackId, index) })
    const parentOf = (index: number): number | undefined => {
      const group = document?.tracks[index]?.groupId
      return group !== undefined && group !== null && group >= 0 ? byId.get(String(group)) : undefined
    }
    const depthOf = (index: number): number => {
      let depth = 0
      for (let at = parentOf(index); at !== undefined && depth < set.tracks.length; at = parentOf(at)) depth += 1
      return depth
    }
    const tracks = set.tracks.map((track, index) => {
      const mixer = document?.tracks[index]?.mixer
      const {sends, ...row}: LiveTrackMixer = mixer ?? {}
      const mix: LiveTrackMix = {...row, ...(sends?.length ? {sends: liveMixSends(sends)} : {})}
      const stopless = document?.tracks[index]?.stoplessSlots ?? []
      // The set's own colour where it keeps one (the track's Color, Live's palette index), else the shell's.
      const color = liveColour(document?.tracks[index]?.colourIndex) ?? colors?.[index]
      const parent = parentOf(index)
      return {id: trackRef(index), name: track.name, kind: track.kind, ...(color ? {color} : {}),
        ...(parent !== undefined ? {parentId: trackRef(parent), depth: depthOf(index)} : {}),
        ...(track.kind === 'master' ? {main: true as const} : {}), ...(Object.keys(mix).length ? {mix} : {}),
        ...(stopless.length ? {stopless: stopless.map(scene => `scene:${scene}`)} : {})}
    })
    const master = set.tracks.find(track => track.kind === 'master')
    // A row is named by its own name where it has one (Live's scene Name, read from the owner), else by its number.
    const columns = Array.from({length: set.scene_count}, (_, scene) => ({id: `scene:${scene}`, name: document?.sceneNames?.[scene] || String(scene + 1)}))
    const clips: WorldTrackClip[] = []
    document?.tracks.forEach((track, index) => {
      if (index >= tracks.length) return
      for (const [slot, name] of Object.entries(track.sessionSlots)) {
        const scene = Number(slot)
        if (name === null || !Number.isSafeInteger(scene) || scene < 0 || scene >= set.scene_count) continue
        clips.push({id: `${trackRef(index)}/slot/${scene}`, trackId: trackRef(index), columnId: `scene:${scene}`, label: name})
      }
      track.arrangementClips.forEach((clip, at) => {
        clips.push({id: `${trackRef(index)}/clip/${at}`, trackId: trackRef(index), columnId: '', label: clip.name, at: {start: clip.start, end: clip.end}})
      })
    })
    // The take lanes and automation the set holds under each track.
    const takes: WorldTakeLane[] = [], automation: WorldAutomationLane[] = [], comp: WorldCompStretch[] = []
    const read = !!document?.tracks.some(track => track.takeLanes !== undefined || track.automation !== undefined)
    document?.tracks.forEach((track, index) => {
      if (index >= tracks.length) return
      const lanes: readonly LiveTakeLane[] = track.takeLanes ?? [], own: WorldCompStretch[] = []
      lanes.forEach((lane, at) => {
        const id = `${trackRef(index)}#take/${at}`
        takes.push({id, trackId: trackRef(index), name: lane.name || `Take ${at + 1}`, spans: lane.clips.map(clip => ({start: clip.start, end: clip.end, label: clip.name}))})
        // Each stretch of the main lane that came from this lane's takes (Live: the comped clip shares its take's TakeId).
        for (const clip of lane.clips) for (const stretch of clip.gave ?? []) own.push({trackId: trackRef(index), takeId: id, start: stretch.start, end: stretch.end})
      })
      comp.push(...own.sort((a, b) => a.start - b.start))
      track.automation?.forEach((env, at) => { if (env.points.length) automation.push(automationLane(trackRef(index), at, env, track)) })
    })
    const absent: Record<string, string> = {events: LIVE_LANES_ABSENT.events}
    if (!read) Object.assign(absent, LIVE_LANES_ABSENT)
    else {
      if (!takes.length) absent.takes = 'The set holds no take lanes: record takes in Arrangement view to lay them here.'
      if (!automation.length) absent.automation = 'The set holds no automation under its tracks.'
    }
    const writing = mixerWrite && read
    const result: WorldTrackSet = {columns, tracks, clips, ruler: {unit: 'beats', label: barBeat},
      mixer: writing ? LIVE_MIXER_WRITTEN : LIVE_MIXER, main: {name: 'Main', chain: master ? [...master.devices] : []},
      lanes: {...(takes.length ? {takes} : {}), ...(comp.length ? {comp} : {}), ...(automation.length ? {automation} : {}), absent}}
    const indexOf = (trackId: string) => tracks.findIndex(track => track.id === trackId)
    const receipt = (done: Promise<unknown>, note: string) => done.then(
      () => ({ok: true as const, note}),
      (cause: unknown) => ({ok: false as const, error: cause instanceof Error ? cause.message : String(cause)}))
    if (compWrite && read) {
      result.actions = {comp: {op: LIVE_COMP_OP, run: (trackId, takeId, range) => {
        const index = indexOf(trackId), lane = /#take\/(\d+)$/.exec(takeId)?.[1]
        if (index < 0 || lane === undefined || !takeId.startsWith(`${trackId}#take/`)) return Promise.resolve({ok: false as const, error: `"${takeId}" is not a take lane of this set.`})
        return receipt(compWrite(index, Number(lane), range), `The take's stretch stands in the main lane.`)
      }}}
    }
    if (writing) {
      const run = (control: 'activator' | 'solo' | 'arm' | 'monitor') => (trackId: string, value: boolean | 'in' | 'auto' | 'off') => {
        const index = indexOf(trackId)
        if (index < 0) return Promise.resolve({ok: false, error: `"${trackId}" is not a track of this set.`})
        return mixerWrite(index, control, value).then(
          () => ({ok: true, note: `${control} written to the set.`}),
          (cause: unknown) => ({ok: false, error: cause instanceof Error ? cause.message : String(cause)}))
      }
      const mixer: LiveMixerActions = {activator: {op: LIVE_MIXER_WRITE_OP('activator'), run: run('activator')}, solo: {op: LIVE_MIXER_WRITE_OP('solo'), run: run('solo')},
        arm: {op: LIVE_MIXER_WRITE_OP('arm'), run: run('arm')}, monitor: {op: LIVE_MIXER_WRITE_OP('monitor'), run: run('monitor')}}
      if (sendWrite) mixer.send = {op: LIVE_SEND_WRITE_OP, run: (trackId, sendId, db) => {
        const index = indexOf(trackId)
        const sends = index < 0 ? [] : document?.tracks[index]?.mixer?.sends ?? []
        const at = sends.findIndex(send => send.send === sendId), send = sends[at]
        if (!send) return Promise.resolve({ok: false as const, error: `${sendId} is no send of this part.`})
        if (!send.on) return Promise.resolve({ok: false as const, error: `${sendId} is off on this part: Live turns a return's own sends on from the send's menu.`})
        if (!Number.isFinite(db)) return Promise.resolve({ok: false as const, error: `${sendId} takes a level in dB.`})
        return receipt(sendWrite(index, at, dbToGain(db, send.min ?? SEND_FLOOR, send.max ?? 1)), `${sendId} written to the set.`)
      }}
      result.actions = {...result.actions, mixer}
    }
    const objects = liveObjectActs(set, act, insertClip, play, clipInfo)
    if (objects) result.actions = {...result.actions, ...objects}
    return result
  },
}

/** The acts on the set's objects (manual §10.9), each through its owner: the set's own acts where its writer is handed in, Launch and
 * Stop where the player is. An object of another set, or the Main track, is refused here, before anything reaches the owner. Pure. */
function liveObjectActs(set: SetSummary, act: LiveSetReading['act'], insertClip: LiveSetReading['insertClip'], play: LiveSetReading['play'],
  clipInfo?: LiveSetReading['clipInfo']): WorldTrackActions | null {
  if (!act && !play && !clipInfo) return null
  const prefix = `als:${set.path}#track/`
  const refused = (error: string) => Promise.resolve({ok: false as const, error})
  const said = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
  type Place = {track: number; at: LiveClipAt}
  /** A track of this set by its id: its place, or why it is none the owner takes. */
  const trackOf = (trackId: string, what: string): number | string => {
    const index = trackId.startsWith(prefix) ? Number(trackId.slice(prefix.length)) : NaN
    if (!Number.isSafeInteger(index) || index < 0 || index >= set.tracks.length) return `"${trackId}" is not a track of this set.`
    return set.tracks[index]!.kind === 'master' ? `The Main track ${what}.` : index
  }
  const clipOf = (clipId: string): Place | string => {
    if (!clipId.startsWith(prefix)) return `"${clipId}" is a clip of another set: copy it from this one.`
    const found = /^(\d+)\/(slot|clip)\/(\d+)$/.exec(clipId.slice(prefix.length))
    if (!found) return `"${clipId}" is not a clip of this set.`
    const track = Number(found[1]), index = Number(found[3])
    return {track, at: found[2] === 'slot' ? {slot: index} : {arrangement: index}}
  }
  const rowOf = (rowId: string): number | string => {
    const scene = /^scene:(\d+)$/.exec(rowId)
    const index = scene ? Number(scene[1]) : NaN
    return Number.isSafeInteger(index) && index < set.scene_count ? index : `"${rowId}" is not a row of this set.`
  }
  const named = (index: number) => set.tracks[index]?.name ?? 'the track'
  const run = (made: LiveSetAct): Promise<WorldActionReceipt> => act!(made).then(
    answer => ({ok: true as const, note: answer.sourceRefused ? `${answer.done} ${answer.sourceRefused}` : answer.done}),
    (cause: unknown) => ({ok: false as const, error: said(cause)}))
  const actions: WorldTrackActions = {}
  if (act) {
    const op = LIVE_ACT_OP
    actions.pasteClip = {op: op('clip_paste'), run: (fromClipId, trackId, rowId, cut) => {
      const from = clipOf(fromClipId), track = trackOf(trackId, 'holds no clips'), scene = rowOf(rowId)
      if (typeof from === 'string') return refused(from)
      if (typeof track === 'string') return refused(track)
      if (typeof scene === 'string') return refused(scene)
      return run({kind: 'clip_paste', from_track: from.track, from: from.at, track, scene, cut})
    }}
    actions.stopButton = {op: op('slot_stop_button'), run: (trackId, rowId, on) => {
      const track = trackOf(trackId, 'holds no clip slots'), scene = rowOf(rowId)
      if (typeof track === 'string') return refused(track)
      if (typeof scene === 'string') return refused(scene)
      return run({kind: 'slot_stop_button', track, scene, on})
    }}
    actions.duplicateClip = {op: op('clip_duplicate'), run: clipId => {
      const place = clipOf(clipId)
      return typeof place === 'string' ? refused(place) : run({kind: 'clip_duplicate', track: place.track, clip: place.at})
    }}
    actions.deleteClip = {op: op('clip_delete'), run: clipId => {
      const place = clipOf(clipId)
      return typeof place === 'string' ? refused(place) : run({kind: 'clip_delete', track: place.track, clip: place.at})
    }}
    actions.renameTrack = {op: op('track_rename'), run: (trackId, name) => {
      const track = trackOf(trackId, 'keeps Live\'s own name')
      return typeof track === 'string' ? refused(track) : run({kind: 'track_rename', track, name})
    }}
    actions.moveTrack = {op: op('track_move'), run: (trackId, by) => {
      const track = trackOf(trackId, 'keeps Live\'s own place, at the end')
      return typeof track === 'string' ? refused(track) : run({kind: 'track_move', track, by})
    }}
    actions.duplicateTrack = {op: op('track_duplicate'), run: trackId => {
      const track = trackOf(trackId, 'is the set\'s one Main track')
      return typeof track === 'string' ? refused(track) : run({kind: 'track_duplicate', track})
    }}
    actions.insertRow = {op: op('scene_insert'), run: afterRowId => {
      if (afterRowId === null) return run({kind: 'scene_insert', after: null})
      const after = rowOf(afterRowId)
      return typeof after === 'string' ? refused(after) : run({kind: 'scene_insert', after})
    }}
    actions.renameRow = {op: op('scene_rename'), run: (rowId, name) => {
      const scene = rowOf(rowId)
      return typeof scene === 'string' ? refused(scene) : run({kind: 'scene_rename', scene, name})
    }}
    actions.duplicateRow = {op: op('scene_duplicate'), run: rowId => {
      const scene = rowOf(rowId)
      return typeof scene === 'string' ? refused(scene) : run({kind: 'scene_duplicate', scene})
    }}
    actions.deleteRow = {op: op('scene_delete'), run: rowId => {
      const scene = rowOf(rowId)
      return typeof scene === 'string' ? refused(scene) : run({kind: 'scene_delete', scene})
    }}
    actions.colourTrack = {op: op('track_colour'), run: (trackId, colour) => {
      const track = trackOf(trackId, 'keeps Live\'s own colour'), index = liveColourIndex(colour)
      if (typeof track === 'string') return refused(track)
      return index === null ? refused(`${colour} is not one of Live's 70 colours.`) : run({kind: 'track_colour', track, colour: index})
    }}
    actions.groupTracks = {op: op('tracks_group'), run: trackIds => {
      const chosen: number[] = []
      for (const trackId of trackIds) {
        const track = trackOf(trackId, 'stands in no group')
        if (typeof track === 'string') return refused(track)
        chosen.push(track)
      }
      return run({kind: 'tracks_group', tracks: chosen})
    }}
    actions.splitClip = {op: op('clip_split'), run: (clipId, at) => {
      const place = clipOf(clipId)
      return typeof place === 'string' ? refused(place) : run({kind: 'clip_split', track: place.track, clip: place.at, at})
    }}
    actions.consolidateClips = {op: op('clips_consolidate'), run: (trackId, span) => {
      const track = trackOf(trackId, 'holds no clips'), why = typeof track === 'number' ? consolidateRefusal(track) : undefined
      if (typeof track === 'string') return refused(track)
      return why ? refused(why) : run({kind: 'clips_consolidate', track, from: span.start, to: span.end})
    }, refuses: trackId => {
      const track = trackOf(trackId, 'holds no clips')
      return typeof track === 'string' ? track : consolidateRefusal(track)
    }}
  }
  // An audio part's consolidate writes a new sample of what it plays: a render (the owner refuses it in the same words).
  const consolidateRefusal = (track: number): string | undefined => {
    const kind = set.tracks[track]?.kind
    return kind === 'midi' ? undefined : (kind && CONSOLIDATE_REFUSED[kind]) ?? `${named(track)} is no audio or MIDI part: it holds no clips to join.`
  }
  actions.waiting = LIVE_WAITING
  if (insertClip) actions.insertClip = {op: LIVE_INSERT_CLIP_OP, run: (trackId, rowId) => {
    const track = trackOf(trackId, 'holds no clips'), scene = rowOf(rowId)
    if (typeof track === 'string') return refused(track)
    if (typeof scene === 'string') return refused(scene)
    return insertClip(track, scene).then(() => ({ok: true as const, note: `Inserted an empty MIDI clip in row ${scene + 1} of ${named(track)}.`}),
      (cause: unknown) => ({ok: false as const, error: said(cause)}))
  }}
  if (clipInfo) actions.clipInfo = {op: LIVE_INFO_OP,
    read: clipId => { const place = clipOf(clipId); return typeof place === 'string' ? Promise.reject(new Error(place)) : clipInfo.read(place.track, place.at) },
    run: (clipId, text) => {
      const place = clipOf(clipId)
      return typeof place === 'string' ? refused(place) : clipInfo.write(place.track, place.at, text).then(() => ({ok: true as const, note: text ? 'The clip\'s info text is kept.' : 'The clip\'s info text is cleared.'}),
        (cause: unknown) => ({ok: false as const, error: said(cause)}))
    }}
  if (play) {
    actions.launch = {op: LIVE_PLAY_OP, run: clipId => {
      const place = clipOf(clipId)
      return typeof place === 'string' ? refused(place) : play.launch(place.track, place.at)
    }}
    actions.stopTrack = {op: `${LIVE_PLAY_OP} — Stop stops the clip that plays on the track`, grain: null, run: trackId => {
      const track = trackOf(trackId, 'stops with Stop all')
      return typeof track === 'string' ? {ok: false as const, error: track} : play.stop(track)
    }}
    actions.stopAll = {op: `${LIVE_PLAY_OP} — Stop all stops whatever plays`, run: () => play.stopAll()}
  }
  return actions
}
