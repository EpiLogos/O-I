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
// (`live_track_mixer_write`) against the set's revision; the input is read, not chosen, and the output is chosen from Main and the part's
// group where the set's acts are handed in (`live_set_act` track_output; O-I #857 G18), another part refused in the owner's words. Under each track its take lanes and its
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
// clipLaunchActs), and a row's Launch every clip the row holds, with the empty slots whose stop it keeps (Live's scene launch). The slots
// whose stop button the set has removed are each track's `stopless`, read from the owner (`stoplessSlots`).
import {barBeats, beatBeats, type SetDocument, type SetSignature} from '../shell/document'
import {liveColour, liveColourIndex} from '../live/livePalette'
import type {SetSummary} from '../shell/useSet'
import type {WorldActionReceipt, WorldAutomationLane, WorldCompStretch, WorldMixer, WorldTakeLane, WorldTrackActions, WorldTrackAdapter, WorldTrackClip, WorldTrackMix, WorldTrackSend, WorldTrackSet} from './worldTrackAdapter'
import type {LiveClipAt, LiveEnvelope, LiveSend, LiveSetAct, LiveSetActed, LiveTakeLane, LiveTrackMixer} from '../../../../../desktop/cradle/src/kernel/types'
import {enginePartOf, type LiveEngineReading} from '../live/liveEngine'
import type {LiveMixerControl, LiveMixerValue} from '../live/liveWrites'
import {readTorusKeptDrag, TORUS_KEPT_MIME, type TorusRackPlacing} from '../frame/instruments'
import type {RowSlot} from '../live/clipPlayer'
import {refusalWords} from '../../../../../desktop/cradle/src/shared/Refusal.tsx'
import type {ClipLaneStanding, ClipLanesStanding} from '../live/clipPlayer'

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
  // Live keeps Volume as linear gain, −70 dB (0.0003162277571) to +6 dB (1.99526238), and Pan −1…1 (racks-session-model.md: <Volume>,
  // <Pan>); the row shows them in dB and as a place (manual DLW.md:10611 "The level and the place of the part").
  volume: {meaning: 'The level of the part', range: {min: -70, max: 6, unit: 'dB'}, disabled: missing('Volume', mixerWrite('volume', 'gain'))},
  pan: {meaning: 'The place of the part, left to right', range: {min: -1, max: 1, unit: 'pan'}, disabled: missing('Pan', mixerWrite('pan', '-1..1'))},
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
  mixerWrite?: (track: number, control: LiveMixerControl, value: LiveMixerValue) => Promise<unknown>
  /** The engine's reading (live/liveEngine.ts useLiveEngine): while it plays this set, Volume and Pan read as the engine applied them. */
  engine?: LiveEngineReading | null
  /** The set owner's send write (live/liveWrites.ts writeLiveSend): a send by its index, its level as linear gain. */
  sendWrite?: (track: number, index: number, value: number) => Promise<unknown>
  /** The set owner's comp (live/liveWrites.ts writeLiveComp): a take lane by its index, a stretch in beats. */
  compWrite?: (track: number, take: number, range: {start: number; end: number}) => Promise<unknown>
  /** The set owner's acts on its objects (live/liveWrites.ts writeLiveSetAct, kernel live_set_act); absent, they wait for it. */
  act?: (act: LiveSetAct) => Promise<LiveSetActed>
  /** Consolidate on an audio part (O-I #743; live/liveWrites.ts writeLiveAudioConsolidate): the engine renders its clips alone across the
   * stretch and the set's owner keeps the sample beside the set as the clip that plays it; absent, an audio part's Consolidate waits for it. */
  consolidateAudio?: (track: number, span: {start: number; end: number}) => Promise<LiveSetActed>
  /** Crop on an audio clip (live/liveWrites.ts writeLiveAudioCrop): the host cuts the stretch of its sample it keeps and the set's owner
   * keeps the cut beside the set as the sample the cropped clip plays; absent, an audio clip's Crop waits for it. */
  cropAudio?: (track: number, clip: LiveClipAt, span: {start: number; end: number} | null) => Promise<LiveSetActed>
  /** Insert clip through the set's owner (live/liveWrites.ts writeLiveInsertClip, kernel live_clip_create), `beats` long: one bar of the set. */
  insertClip?: (track: number, scene: number, beats?: number) => Promise<unknown>
  /** A clip's info text, read from and written to the set's owner (live/liveWrites.ts: live_clip_read, live_clip_write `info`). */
  clipInfo?: {read(track: number, clip: LiveClipAt): Promise<string>; write(track: number, clip: LiveClipAt, text: string): Promise<unknown>}
  /** Launch, Stop the track and Stop all on the torus (live/clipPlayer.ts liveClipActs), by the track's place and the clip's. */
  play?: {launch(track: number, at: LiveClipAt): Promise<WorldActionReceipt>; stop(track: number): WorldActionReceipt | Promise<WorldActionReceipt>
    stopAll(): WorldActionReceipt | Promise<WorldActionReceipt>
    /** A row's Launch (O-I #743): what row `row` holds on each part, its clips and the empty slots whose stop it keeps. */
    launchRow?(row: number, slots: readonly RowSlot[]): Promise<WorldActionReceipt>
    /** Re-enable (live/clipPlayer.ts, O-I #853): an overridden parameter, or every one, back to the take's lanes. */
    reenable?(parameter?: string): Promise<WorldActionReceipt>
    /** Unfreeze (live/clipPlayer.ts, O-I #849 round 22): the take frozen on part `track` let go, the part's live Torus heard again. */
    unfreeze?(track: number): Promise<WorldActionReceipt>
    /** Back to Arrangement (DLW build ruling 2026-11-08, G12): the Session's clips stop, and the engine plays every part's Arrangement. */
    backToArrangement?(): Promise<WorldActionReceipt>}
  /** The standing of the take's lanes as the clip player plays them (O-I #853): what the hand overrode, which Re-enable counts. */
  lanes?: ClipLaneStanding | ClipLanesStanding | null
  /** Export Audio of a take Record laid (live/liveTake.ts exportLiveTake, O-I #855): its course rendered by the Torus's owner, saved as WAV. */
  exportTake?: (track: number, at: LiveClipAt) => Promise<WorldActionReceipt>
  /** Place Under Scene of a take Record laid (live/liveTake.ts placeLiveTake, O-I #855 round 26): laid under the presented Expression's
   * scene, from its arrangement clip's start or a slot's beat 0. */
  placeTake?: (track: number, at: LiveClipAt) => Promise<WorldActionReceipt>
  /** A kept sound played on the part `track` (live/LivePresets.tsx playKeptSoundOn, O-I #852): opened on the Torus as saved, then kept by
   * the part. With the set's acts, a kept sound dropped on the empty track plays on a new part. A rack's sound opens with the rack, so the
   * Torus's Macros page opens with its macros and variations. */
  openSound?: (soundRef: string, track: number, rack?: TorusRackPlacing) => Promise<WorldActionReceipt>
  /** Record into a slot (live/liveTake.ts recordIntoSlot, O-I #743): pressed on an armed part's empty slot, a take begins on the part;
   * pressed again there, it is laid in that slot (acts.rs TakeRecord `scene`). */
  record?: (track: number, scene: number) => Promise<WorldActionReceipt>
}

/** The op an act of the set's names, in the words a menu shows. */
export const LIVE_ACT_OP = (kind: LiveSetAct['kind']) => `live_set_act · ${kind} — the set's own ${kind.replace('_', ' ')}, against its revision (packages/live-set/src/acts.rs)`
/** What the empty track seats (O-I #852): a kept sound, on a new part Live's Insert MIDI Track makes, opened there on the Torus; a rack
 * placed on the part first, as Live's Instrument Rack. */
export const LIVE_SEAT_SOUND_OP = `${LIVE_ACT_OP('track_insert')}, a rack's ${LIVE_ACT_OP('rack_place')}, then the kept sound opened on the new part (the Torus's owner, through the frame's stage)`
/** Export Audio of a take: its course rendered offline by the Torus's owner, part after part (O-I #855). */
export const LIVE_EXPORT_TAKE_OP = 'render-take {checkpoint, acts, frames} — the take\'s course rendered by the Torus\'s owner (QL-MEF torus-render), saved as 32-bit float WAV'
/** Place Under Scene of a take (O-I #855 round 26): its course rendered by the Torus's owner, sealed by the kernel and laid under the scene. */
export const LIVE_PLACE_TAKE_OP = 'render-take {checkpoint, acts, frames}, the kernel\'s torus_take seal, then the Scene\'s record_torus_take — a take Record laid on a Live part, placed on its take lane under the presented scene'
/** Back to Arrangement (DLW build ruling 2026-11-08, G12; manual §21.1): what the Session plays stops, and the engine returns each part. */
export const LIVE_BACK_OP = 'the clip player\'s Stop all, then live_engine_send {kind: "back_to_arrangement"} — every part plays its Arrangement again (live-engine BackToArrangement)'
export const LIVE_INSERT_CLIP_OP = 'live_clip_create {path, track, scene, length: 4, notes: []} — an empty one-bar MIDI clip in the empty slot, as Live inserts one'
/** What an act no op of the set's owner carries waits for (O-I #743, round two), as the status bar says after the missing op. */
export const LIVE_RENDER_WAIT = 'Consolidating audio clips writes a new sample of what they play: the engine renders it, and no engine is handed in here.'
/** Why a track of a kind cannot be consolidated here, by the kind its owner reads (a MIDI part's the owner takes); an audio part's waits
 * for a render, and is consolidated where one is handed in (`consolidateAudio`). */
const CONSOLIDATE_REFUSED: Readonly<Partial<Record<SetSummary['tracks'][number]['kind'], string>>> = {audio: LIVE_RENDER_WAIT}
/** An audio clip's Crop (DLW build ruling 2026-11-05) writes a new sample of what it keeps: the host cuts it, and no host is handed in here. */
export const LIVE_CROP_WAIT = 'Cropping an audio clip writes a new sample of what it keeps: the desktop host cuts it from the clip\'s own, and no host is handed in here.'
/** Which parts' clips are cropped by a cut of their sample (an audio part's); a MIDI part's the owner crops as notes. */
const CROP_CUTS: Readonly<Partial<Record<SetSummary['tracks'][number]['kind'], string>>> = {audio: LIVE_CROP_WAIT}

/** The words the engine playing the set refused to lay a sample kept anew in (O-I #849 round 21, the host's `lay_again`); none where it
 * laid it from the next block, or holds no such set. */
const engineRefused = (answer: LiveSetActed): string | undefined =>
  answer.engine && 'refused' in answer.engine ? answer.engine.refused : undefined
/** An empty slot's ref, as THE selection names a Session slot of the set (shell/liveSelection.ts: …#track/<i>/slot/<scene>): a click on
 * an empty slot chooses it, as Live's does (walk of O-I 857). A row that is not a scene names no slot. */
export const liveSlotRef = (trackId: string, columnId: string): string | null =>
  /^scene:\d+$/.test(columnId) ? `${trackId}/slot/${columnId.slice('scene:'.length)}` : null

/** The parts that hold clips, by the kind of clip each holds (a return, a group and the main hold none). */
const CLIP_PARTS: Readonly<Partial<Record<SetSummary['tracks'][number]['kind'], 'midi' | 'audio'>>> = {midi: 'midi', audio: 'audio'}
export const LIVE_WAITING: Readonly<Record<string, string>> = {
  'slot.record': 'a recording path: the set\'s Record handed in (live/liveTake.ts recordIntoSlot), which lays what is played in the slot as a take',
  'track.remove': 'the decode of how Live re-routes the parts and sends that went to a deleted track: session-model.md has no rule for it',
}
export const LIVE_INFO_OP = 'live_clip_write {path, track, clip, set: {info}} — the clip\'s info text (its Annotation), against the set\'s revision'
/** Record into a slot (O-I #743): a take on the part, laid in the slot. */
export const LIVE_RECORD_SLOT_OP = `Record into the slot (live/liveTake.ts recordIntoSlot): a take of what you play on the part, then ${LIVE_ACT_OP('take_record')} with its row — the pass laid in the empty slot, its take kept beside the set`
/** Re-enable (O-I #853): what the hand moved off a take's lanes, given back to them. */
export const LIVE_REENABLE_OP = 'the clip player (live/clipPlayer.ts reenable): each parameter the hand moved off a take\'s lanes plays from them again, at the value its lane reached'
/** Unfreeze (O-I #849 round 22): the take frozen on its part let go, the part's live Torus heard again. */
export const LIVE_UNFREEZE_OP = 'the clip player (live/clipPlayer.ts unfreeze): live_engine_unfreeze {track} — the take frozen on the part let go from the engine\'s next block, and its notes on the live Torus from there'
export const LIVE_PLAY_OP = 'the clip player (live/clipPlayer.ts): the clip read from the set\'s owner, its notes struck on the torus at the set\'s tempo'
/** A row's Launch (O-I #743): Live's scene launch, on a player of each part. */
export const LIVE_ROW_LAUNCH_OP = 'the clip player (live/clipPlayer.ts launchRow): every MIDI clip of the row read from the set\'s owner and played together on the torus, a player of each part, each landing on its launch quantize'

/** One send on a part's mixer row: Live's name for it ("Send A"), the return track it feeds, its level in dB within the range the set
 * keeps (Live's −70 dB floor to 0 dB), and why it cannot be moved when Live has it off on this part (a return's own sends). */
export type LiveMixSend = WorldTrackSend
/** A part's mixer readings with its sends (the frame's mix carries them: trackLanes.ts mixerCells draws them on the row). */
export type LiveTrackMix = WorldTrackMix
/** The mixer row's writes with the send's. */
export type LiveMixerActions = NonNullable<WorldTrackActions['mixer']>

/** A send's level, linear gain as the set keeps it, in dB; and back within the send's own range. */
const gainToDb = (gain: number, floor: number): number => 20 * Math.log10(Math.max(gain, floor))
const dbToGain = (db: number, floor: number, top: number): number => Math.max(floor, Math.min(top, 10 ** (db / 20)))
/** Live 12's send floor, as every set keeps it (each Send's MidiControllerRange Min). */
const SEND_FLOOR = 0.0003162277571
/** Live's volume range as every set keeps it (Mixer/Volume's MidiControllerRange): −70 dB to +6 dB, as linear gain. */
const VOLUME_FLOOR = 0.0003162277571, VOLUME_TOP = 1.99526238

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

/** The mixer with the set's acts handed in as well: Output is chosen (track_output), the input still read. */
const LIVE_MIXER_ROUTED: WorldMixer = {...LIVE_MIXER_WRITTEN, output: {meaning: LIVE_MIXER.output!.meaning}}

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
/** What names a lane of the take that plays, after its clip's id: the map parameter it writes follows. */
const TAKE_LANE = '#lane/'

/** A point on the ruler as Live's own counts it, bar.beat, by the set's time signature (O-I #849 round 21: a beat is its note, a bar its
 * numerator of them; Live's 4/4 where the set keeps none its owner reads). */
const barBeat = (signature?: SetSignature) => (beats: number): string => {
  const bar = barBeats(signature), beat = beatBeats(signature), held = Math.max(0, beats) + 1e-9
  return `${Math.floor(held / bar) + 1}.${Math.floor((held % bar) / beat) + 1}`
}

export const liveSetTrackAdapter: WorldTrackAdapter<LiveSetReading> = {
  id: LIVE_SET_TRACK_ADAPTER_ID,
  project({set, document, colors, mixerWrite, sendWrite, compWrite, act, insertClip, clipInfo, play, exportTake, placeTake, engine, openSound, record, lanes: standing,
    consolidateAudio, cropAudio}): WorldTrackSet {
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
    // While the engine plays this set, a part's Volume and Pan are the engine's: the mixer as it applied it, never the move asked.
    const heard = engine?.playing && engine.path === set.path ? engine : null
    const kinds = set.tracks.map(track => track.kind)
    const applied = (index: number) => {
      const part = heard && enginePartOf(kinds, index)
      if (!heard || !part) return undefined
      // a group is the engine's bus (O-I #849 round 16): its row as the engine applied it
      return part === 'main' ? heard.mixer.main : 'track' in part ? heard.mixer.tracks[part.track]
        : 'group' in part ? heard.mixer.groups?.[part.group] : heard.mixer.returns[part.return]
    }
    const tracks = set.tracks.map((track, index) => {
      const mixer = document?.tracks[index]?.mixer
      const {sends, volume, pan, ...row}: LiveTrackMixer = mixer ?? {}
      const playing = applied(index)
      const level = playing ? {volume: gainToDb(playing.gain, VOLUME_FLOOR), pan: playing.pan, levelSource: 'as the engine applied it'}
        : {...(volume !== undefined ? {volume: gainToDb(volume, VOLUME_FLOOR)} : {}), ...(pan !== undefined ? {pan} : {})}
      const mix: LiveTrackMix = {...row, ...level, ...(sends?.length ? {sends: liveMixSends(sends)} : {})}
      const stopless = document?.tracks[index]?.stoplessSlots ?? []
      // The set's own colour where it keeps one (the track's Color, Live's palette index), else the shell's.
      const color = liveColour(document?.tracks[index]?.colourIndex) ?? colors?.[index]
      const parent = parentOf(index)
      return {id: trackRef(index), name: track.name, kind: track.kind, ...(color ? {color} : {}),
        ...(parent !== undefined ? {parentId: trackRef(parent), depth: depthOf(index)} : {}),
        ...(track.kind === 'master' ? {main: true as const} : {}), ...(Object.keys(mix).length ? {mix} : {}),
        // A return track holds no clips: the views draw it after the parts with no clip slots, as Live's Session does (walk of O-I 857, O8).
        ...(track.kind === 'return' ? {returns: true as const} : {}),
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
    // The lanes of the take that plays (O-I #743 round 20), each its own under the take's clip, in the clip's own time, marked Overridden
    // where the hand holds it, so each has its own Re-enable. A slot's clip has no place on the ruler, so its take's lanes stand where the
    // clip landed on the transport as it plays (O-I #849 round 21: the launch grid's beats, clipPlayer.ts ClipLaneStanding `at`).
    // Every player's take that plays, a row's among them (O-I #849 round 21: clipPlayer.ts liveClipActs `lanes`), each under its own clip.
    // A frozen take's lanes say so, and carry no Overridden mark (O-I #849 round 22); a looping clip's are drawn again for each pass
    // (DLW build ruling 2026-11-05), a slot clip's and, from its start marker where it lies, an arrangement clip's (O-I #849 round 23).
    const playing = !standing ? [] : 'takes' in standing ? standing.takes : standing.take && standing.lanes ? [{take: standing.take, lanes: standing.lanes}] : []
    const held = standing?.overridden ?? []
    for (const {take, lanes: own} of playing) {
      if (take.address.path !== set.path || take.address.track >= tracks.length) continue
      const slot = 'slot' in take.address.at
      const clipId = `${trackRef(take.address.track)}/${'slot' in take.address.at ? `slot/${take.address.at.slot}` : `clip/${take.address.at.arrangement}`}`
      const landed = slot && take.at !== undefined && Number.isFinite(take.at) ? {clipAt: take.at} : {}
      const marker = take.loop && take.loop.to > take.loop.from ? {loop: {start: take.loop.start, from: take.loop.from, to: take.loop.to}}
        : take.start !== undefined && Number.isFinite(take.start) ? {start: take.start} : {}
      for (const lane of own) automation.push({id: `${clipId}${TAKE_LANE}${lane.parameter}`, trackId: trackRef(take.address.track), device: take.name,
        parameter: lane.label, clipId, ...landed, ...marker, points: lane.points.map(point => ({at: point.beat, value: point.value})),
        ...(take.frozen !== undefined ? {overridden: false, frozen: take.frozen} : {overridden: held.includes(lane.parameter)})})
    }
    const absent: Record<string, string> = {events: LIVE_LANES_ABSENT.events}
    if (!read) Object.assign(absent, LIVE_LANES_ABSENT)
    else {
      if (!takes.length) absent.takes = 'The set holds no take lanes: record takes in Arrangement view to lay them here.'
      if (!automation.length) absent.automation = 'The set holds no automation under its tracks.'
    }
    const writing = mixerWrite && read
    const result: WorldTrackSet = {columns, tracks, clips, slotRef: liveSlotRef, ruler: {unit: 'beats', label: barBeat(document?.signature)},
      mixer: writing ? (act ? LIVE_MIXER_ROUTED : LIVE_MIXER_WRITTEN) : LIVE_MIXER, main: {name: 'Main', chain: master ? [...master.devices] : [],
        // Back to Arrangement lights while a part plays a Session clip over its Arrangement, as the engine reports it (G12); unread while
        // the engine does not play this set.
        ...(heard ? {differs: heard.mixer.tracks.some(part => part.session === true)} : {})},
      lanes: {...(takes.length ? {takes} : {}), ...(comp.length ? {comp} : {}), ...(automation.length ? {automation} : {}), absent,
        // How many parameters the hand holds off a take's lanes (O-I #853), as the clip player counts them: Re-enable lights while any are.
        ...(standing ? {held: standing.overridden.length} : {})}}
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
      const level = (control: 'volume' | 'pan', trackId: string, value: number) => {
        const index = indexOf(trackId)
        if (index < 0) return Promise.resolve({ok: false as const, error: `"${trackId}" is not a track of this set.`})
        return receipt(mixerWrite(index, control, value), `${control} written to the set.`)
      }
      const mixer: LiveMixerActions = {activator: {op: LIVE_MIXER_WRITE_OP('activator'), run: run('activator')}, solo: {op: LIVE_MIXER_WRITE_OP('solo'), run: run('solo')},
        arm: {op: LIVE_MIXER_WRITE_OP('arm'), run: run('arm')}, monitor: {op: LIVE_MIXER_WRITE_OP('monitor'), run: run('monitor')},
        // Volume in dB on the row, written as the linear gain the set keeps; Pan as it stands. The owner refuses out of its range.
        volume: {op: LIVE_MIXER_WRITE_OP('volume'), run: (trackId, db) => Number.isFinite(db) ? level('volume', trackId, dbToGain(db, VOLUME_FLOOR, VOLUME_TOP))
          : Promise.resolve({ok: false as const, error: 'The volume takes a level in dB.'})},
        pan: {op: LIVE_MIXER_WRITE_OP('pan'), run: (trackId, place) => Number.isFinite(place) ? level('pan', trackId, Math.max(-1, Math.min(1, place)))
          : Promise.resolve({ok: false as const, error: 'The pan takes a place from −1 (left) to 1 (right).'})}}
      if (sendWrite) mixer.send = {op: LIVE_SEND_WRITE_OP, run: (trackId, sendId, db) => {
        const index = indexOf(trackId)
        const sends = index < 0 ? [] : document?.tracks[index]?.mixer?.sends ?? []
        const at = sends.findIndex(send => send.send === sendId), send = sends[at]
        if (!send) return Promise.resolve({ok: false as const, error: `${sendId} is no send of this part.`})
        if (!send.on) return Promise.resolve({ok: false as const, error: `${sendId} is off on this part: Live turns a return's own sends on from the send's menu.`})
        if (!Number.isFinite(db)) return Promise.resolve({ok: false as const, error: `${sendId} takes a level in dB.`})
        return receipt(sendWrite(index, at, dbToGain(db, send.min ?? SEND_FLOOR, send.max ?? 1)), `${sendId} written to the set.`)
      }}
      // Output (O-I #857 G18): Main, or the group the part stands in, through the set's own act; another part is offered as Live offers
      // it and refused in the owner's words.
      if (act) mixer.output = {op: LIVE_ACT_OP('track_output'), choices: trackId => {
        const index = indexOf(trackId), track = set.tracks[index]
        if (!track || track.kind === 'master') return []
        const reads = document?.tracks[index]?.mixer?.output, parent = parentOf(index)
        return [{value: 'main', label: 'Main', ...(reads === 'Main' ? {standing: true} : {})},
          ...(parent !== undefined ? [{value: 'group', label: `Group · ${set.tracks[parent]?.name ?? 'its group'}`, ...(reads === 'Group' ? {standing: true} : {})}] : []),
          ...set.tracks.flatMap((other, at) => at === index || at === parent || other.kind === 'master' ? [] : [{value: `track:${at}`, label: other.name}])]
      }, run: (trackId, choice) => {
        const index = indexOf(trackId), other = /^track:(\d+)$/.exec(choice)
        if (index < 0 || set.tracks[index]?.kind === 'master') return Promise.resolve({ok: false as const, error: `"${trackId}" is no part of this set with an Output to choose.`})
        const to = choice === 'main' || choice === 'group' ? choice : other ? {track: Number(other[1])} : null
        if (to === null) return Promise.resolve({ok: false as const, error: `${choice} is no Output of this part.`})
        return act({kind: 'track_output', track: index, to}).then(answer => ({ok: true as const, note: answer.done}),
          (cause: unknown) => ({ok: false as const, error: cause instanceof Error ? cause.message : String(cause)}))
      }}
      result.actions = {...result.actions, mixer}
    }
    const objects = liveObjectActs(set, act, insertClip, play, clipInfo, exportTake, openSound, record, document, consolidateAudio, cropAudio, placeTake)
    if (objects) result.actions = {...result.actions, ...objects}
    return result
  },
}

/** A device of a placed rack's chain as Live's own: the class a set stores it under, and the settings carried onto it (a switch 0 or 1). */
export interface LiveChainDevice {readonly device: string; readonly parameters: readonly {readonly id: string; readonly value: number}[]}

type KeptState = TorusRackPlacing['chain'][number]['state']
/** One setting of a Torus effect carried onto Live's device: Live's document key, the stored value made from the kept settings (null where they
 * do not make one), the range Live's device holds it in (packages/live-dynamics/src/params.rs, the corpus's surface), and the kept setting it
 * comes from, as its words show it (the value in the kept unit, from the stored one). */
interface CarriedSetting {readonly id: string; readonly from: readonly string[]; readonly of: (kept: KeptState) => number | null; readonly min: number
  readonly max: number; readonly word: string; readonly unit: string; readonly shown: (stored: number) => number}
/** A kept setting that has no stored setting of Live's to go to, but stands as Live's own does at one value of it: said in words otherwise. */
interface StandingSetting {readonly key: string; readonly at: EffectValue; readonly words: (kept: EffectValue) => string}
type EffectValue = KeptState[string]
const keptNumber = (kept: KeptState, key: string): number | null => typeof kept[key] === 'number' && Number.isFinite(kept[key]) ? kept[key] as number : null
/** A kept setting carried as it stands, or made by `law` from it. */
const carry = (key: string, id: string, min: number, max: number, unit: string, law: (v: number) => number = v => v, shown: (s: number) => number = s => s,
  word = key === 'predelay' ? 'pre-delay' : key): CarriedSetting => ({id, from: [key], of: kept => {
  const v = keptNumber(kept, key)
  return v === null ? null : law(v)
}, min, max, word, unit, shown})
/** How many of its Attack's times Live's Compressor takes to come within a quarter dB of a held level (the host's TORUS_ATTACK_SETTLES,
 * live_engine_host.rs: Live's Attack is the frame's over it). */
const TORUS_ATTACK_SETTLES = 3.562350828929603
/** The Torus's Delay's note lengths in beats and the longest time its frame's line holds (effectsLaw.ts DELAY_DIVISIONS, presentationEffects.ts
 * MAX_DELAY). */
const DELAY_BEATS: Readonly<Record<string, number>> = {'1/32': 0.125, '1/16': 0.25, '1/8': 0.5, '1/4': 1, '1/2': 2, '1': 4}
const DELAY_MAX_S = 6
/** The Delay's time in seconds, as its frame holds it: a synced one's note length at its tempo, a free one's own. */
function delaySeconds(kept: KeptState): number | null {
  if (typeof kept.sync !== 'boolean') return null
  if (kept.sync) {
    const beats = typeof kept.division === 'string' ? DELAY_BEATS[kept.division] : undefined, tempo = keptNumber(kept, 'tempo')
    return beats === undefined || tempo === null || tempo <= 0 ? null : Math.min(DELAY_MAX_S, 60 / tempo * beats)
  }
  const ms = keptNumber(kept, 'time')
  return ms === null ? null : Math.min(DELAY_MAX_S, ms / 1000)
}
const delayTime = (id: string): CarriedSetting => ({id, from: ['sync', 'division', 'time', 'tempo'], of: delaySeconds, min: 0.001000000047, max: 5,
  word: 'time', unit: 's', shown: s => s})

/** The Torus's effects as Live's own devices on a placed rack's chain (O-I #852 round 10; manual §21.5 Filter, Dynamics, Delay, Reverb): each
 * by the class a set stores Live's device of its kind under, and the settings carried onto it, as the engine reads Live's device (the host's
 * torus_chain, live_engine_host.rs, carries the same; O-I #849 rounds 14 and 15), each from the corpus's surface only (params.rs: its key,
 * its range and its kind):
 *   Filter as Auto Filter: cutoff as Cutoff, a pitch (A 440 Hz at 69, a semitone a step: the engine's reading, the corpus pins no unit),
 *     resonance as Resonance (0 to 1 for 0 to 100 %), drive as Drive (dB). Its type is Live's FilterType, a menu the writer does not write
 *     yet: Live's own, 0, is the low-pass; another type stands at Live's own, in words. Auto Filter keeps no dry/wet: a mix under full, in words.
 *   Dynamics as Compressor: threshold as Threshold (a level), ratio as Ratio, attack as Attack (ms, over TORUS_ATTACK_SETTLES), release as
 *     Release (ms), makeup as Gain (dB), and Knee 0: the frame's compressor is hard-kneed.
 *   Delay as Delay: its time (a synced one's note length at its tempo) as DelayLine_TimeL and DelayLine_TimeR (seconds), feedback as
 *     Feedback (0 to 0.95), tone as Filter_Frequency (Hz), mix as DryWet (0 to 1); and the switches that make Live's Delay read its time so:
 *     each side free, not synced (DelayLine_SyncL, DelayLine_SyncR: "false = free"), the sides linked (DelayLine_Link), not ping-pong
 *     (DelayLine_PingPong), its filter on (Filter_On).
 *   Reverb as Reverb: decay as DecayTime and pre-delay as PreDelay (params.rs: "stored unit = ms"); its size, damping and dry/wet have no
 *     stored setting of Live's with their meaning, and stand at Live's own, in words.
 * A setting over or under what Live's device holds stands at its nearer edge, in words. Whether each device is on is carried as Live's On
 * (session-model.md §6). The Resonator bank has no Live device in the corpus's surface. */
const TORUS_EFFECT_IN_LIVE: Readonly<Record<string, {readonly device: string; readonly title: string; readonly carried: readonly CarriedSetting[]
  readonly fixed?: readonly {readonly id: string; readonly value: number}[]; readonly standing?: readonly StandingSetting[]}>> = {
  filter: {device: 'AutoFilter', title: 'Auto Filter', carried: [
    carry('cutoff', 'Cutoff', 20, 135, 'Hz', hz => 69 + 12 * Math.log2(hz / 440), cutoff => 440 * 2 ** ((cutoff - 69) / 12)),
    carry('resonance', 'Resonance', 0, 1.25, '%', r => r / 100, r => r * 100),
    carry('drive', 'Drive', 0, 24, 'dB'),
  ], standing: [
    {key: 'type', at: 'lowpass', words: type => `its ${String(type)} type stands at Live's own, the low-pass: Live's Auto Filter keeps its FilterType as a menu, and a menu's stored shape is not written here yet`},
    {key: 'mix', at: 100, words: mix => `its mix of ${String(mix)} % stands at full: the corpus's surface of Live's Auto Filter keeps no dry/wet`},
  ]},
  dynamics: {device: 'Compressor2', title: 'Compressor', carried: [
    carry('threshold', 'Threshold', 0.0003162277571, 1.99526238, 'dB', db => 10 ** (db / 20), level => 20 * Math.log10(level)),
    carry('ratio', 'Ratio', 1, 3.4028232635611926e38, ':1'),
    carry('attack', 'Attack', 0.009999999776, 1000, 'ms', ms => ms / TORUS_ATTACK_SETTLES, ms => ms * TORUS_ATTACK_SETTLES),
    carry('release', 'Release', 1, 3000, 'ms'),
    carry('makeup', 'Gain', -36, 36, 'dB'),
  ], fixed: [{id: 'Knee', value: 0}]},
  delay: {device: 'Delay', title: 'Delay', carried: [
    delayTime('DelayLine_TimeL'), delayTime('DelayLine_TimeR'),
    carry('feedback', 'Feedback', 0, 0.9499999881, '%', f => f / 100, f => f * 100),
    carry('tone', 'Filter_Frequency', 49.9999962, 18000.0059, 'Hz'),
    carry('mix', 'DryWet', 0, 1, '%', m => m / 100, m => m * 100),
  ], fixed: [{id: 'DelayLine_Link', value: 1}, {id: 'DelayLine_PingPong', value: 0}, {id: 'DelayLine_SyncL', value: 0}, {id: 'DelayLine_SyncR', value: 0},
    {id: 'Filter_On', value: 1}]},
  reverb: {device: 'Reverb', title: 'Reverb', carried: [
    carry('decay', 'DecayTime', 199.999985, 60000.0039, 's', seconds => Math.round(seconds * 1e9) / 1e6, ms => ms / 1000),
    carry('predelay', 'PreDelay', 0.5, 249.999969, 'ms'),
  ]},
}
/** A kept setting by the manual's word for it. */
const settingWord = (key: string) => key === 'predelay' ? 'pre-delay' : key
/** A value as the words show it: to a tenth, or to three figures under one (the host's torus_chain rounds so). */
const shownValue = (x: number) => {
  const places = Math.abs(x) >= 1 || x === 0 ? 1 : 2 - Math.floor(Math.log10(Math.abs(x)))
  return Math.round(x * 10 ** places) / 10 ** places
}

/** A placed rack's chain as Live's own devices, with the words for what does not stand on it as kept (O-I #852 round 10; O-I #849 round 15:
 * every key the engine maps). A note device stays off the chain, as does the Resonator bank: the corpus gives Live's note devices and Live's
 * Resonators no parameter surface yet; a device that is none of the Torus's has no Live device to stand as. Each placed device takes the
 * settings it carries (TORUS_EFFECT_IN_LIVE), within what Live's device holds, and the words name the rest, which stand at Live's own. Pure. */
export function rackChainInLive(chain: TorusRackPlacing['chain']): {chain: LiveChainDevice[]; words: string[]} {
  const listed = (names: readonly string[]) => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  const placed: LiveChainDevice[] = []
  const off: string[] = []
  const settings: string[] = []
  for (const kept of chain) {
    if (kept.role === 'note') { off.push(`Its note device ${kept.device_ref} stays off its chain: the corpus gives Live's note devices no parameter surface yet.`); continue }
    if (kept.device_ref === 'resonator') { off.push('Its Resonator bank stays off its chain: the corpus gives Live\'s Resonators no parameter surface yet.'); continue }
    const live = TORUS_EFFECT_IN_LIVE[kept.device_ref]
    if (!live) { off.push(`Its effect ${kept.device_ref} is none of the Torus's, so no Live device stands for it.`); continue }
    const parameters: {id: string; value: number}[] = []
    const took: string[] = [], said: string[] = []
    if (typeof kept.state.on === 'boolean') parameters.push({id: 'On', value: kept.state.on ? 1 : 0})
    const used = new Set(['on'])
    for (const law of live.carried) {
      const stored = law.of(kept.state)
      if (stored === null || !Number.isFinite(stored)) continue
      for (const key of law.from) used.add(key)
      const value = Math.min(law.max, Math.max(law.min, stored))
      parameters.push({id: law.id, value})
      if (!took.includes(law.word)) took.push(law.word)
      if (value !== stored && !said.some(words => words.startsWith(`its ${law.word} of `))) said.push(`its ${law.word} of ${shownValue(law.shown(stored))} ${law.unit} is ${stored < law.min ? 'under' : 'over'} the ${shownValue(law.shown(value))} ${law.unit} Live's ${live.title} holds, and stands there`)
    }
    for (const standing of live.standing ?? []) {
      const value = kept.state[standing.key]
      if (value === undefined) continue
      used.add(standing.key)
      if (value === standing.at) took.push(settingWord(standing.key))
      else said.push(standing.words(value))
    }
    if (parameters.some(p => p.id !== 'On')) parameters.push(...(live.fixed ?? []))
    const left = Object.keys(kept.state).filter(key => !used.has(key)).map(settingWord)
    placed.push({device: live.device, parameters})
    const head = took.length ? `Live's ${live.title} takes its ${listed(took)}`
      : kept.state.on === false ? `Live's ${live.title} stands off, as it was kept` : ''
    const rest = [left.length ? `its ${listed(left)} stand at Live's own, for the corpus pins no stored setting of Live's with their meaning and unit` : '', ...said].filter(Boolean)
    if (rest.length) settings.push(`${head ? `${head}; ` : `Live's ${live.title}: `}${rest.join('; ')}.`)
  }
  return {chain: placed, words: [...off, ...settings]}
}

/** What of a placed rack the part does not carry yet, in words (O-I #852 rounds 9 and 10): what of its chain does not stand on it as Live's
 * own (rackChainInLive), and what its macros turn, which Live 12 keeps in a form not read yet (racks-session-model.md §1.7). Pure. */
export function rackUnplaced(rack: TorusRackPlacing): string[] {
  const listed = (names: readonly string[]) => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  const turned = rack.macros.filter(item => item.targets.length).map(item => `${item.name} turns ${listed(item.targets.map(target =>
    target.device_ref === 'torus' ? `the Torus's ${target.parameter}` : `${target.device_ref}'s ${target.parameter}`))}`)
  return [
    ...rackChainInLive(rack.chain).words,
    turned.length ? `What its macros turn is not mapped (${turned.join('; ')}): Live 12 keeps a macro's mapping in a form not read here yet.` : '',
  ].filter(Boolean)
}

/** The acts on the set's objects (manual §10.9), each through its owner: the set's own acts where its writer is handed in, Launch and
 * Stop where the player is. An object of another set, or the Main track, is refused here, before anything reaches the owner. Pure. */
function liveObjectActs(set: SetSummary, act: LiveSetReading['act'], insertClip: LiveSetReading['insertClip'], play: LiveSetReading['play'],
  clipInfo?: LiveSetReading['clipInfo'], exportTake?: LiveSetReading['exportTake'], openSound?: LiveSetReading['openSound'],
  record?: LiveSetReading['record'], document: SetDocument | null = null, consolidateAudio?: LiveSetReading['consolidateAudio'],
  cropAudio?: LiveSetReading['cropAudio'], placeTake?: LiveSetReading['placeTake']): WorldTrackActions | null {
  if (!act && !play && !clipInfo && !exportTake && !record && !placeTake) return null
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
      if (why) return refused(why)
      // An audio part's clips are rendered by the engine and kept beside the set; what it did not play of them is said after.
      if (consolidateAudio && rendersConsolidate(track)) return consolidateAudio(track, {start: span.start, end: span.end}).then(
        answer => ({ok: true as const, note: [answer.done, answer.sourceRefused, ...(answer.unplayed ?? []), engineRefused(answer)].filter(Boolean).join(' ')}),
        (cause: unknown) => ({ok: false as const, error: said(cause)}))
      return run({kind: 'clips_consolidate', track, from: span.start, to: span.end})
    }, refuses: trackId => {
      const track = trackOf(trackId, 'holds no clips')
      return typeof track === 'string' ? track : consolidateRefusal(track)
    }}
    // Crop keeps only the clip's loop, or its start to its end, or the selection over it (DLW build ruling 2026-11-05); an audio clip's
    // is a new sample, cut by the host and kept beside the set.
    actions.cropClip = {op: op('clip_crop'), run: (clipId, span) => {
      const place = clipOf(clipId)
      if (typeof place === 'string') return refused(place)
      const range = span ? {from: span.start, to: span.end} : {}
      const kind = set.tracks[place.track]?.kind, cuts = kind ? CROP_CUTS[kind] : undefined
      if (!cuts) return run({kind: 'clip_crop', track: place.track, clip: place.at, ...range})
      if (!cropAudio) return refused(cuts)
      return cropAudio(place.track, place.at, span ?? null).then(
        answer => ({ok: true as const, note: [answer.done, answer.sourceRefused, engineRefused(answer)].filter(Boolean).join(' ')}),
        (cause: unknown) => ({ok: false as const, error: said(cause)}))
    }}
    // A kept sound dropped on the empty track plays on a new part (manual §21.2 "Drag it onto a part to play it"): the part Live's Insert
    // MIDI Track makes after the last one, then the sound opened on the Torus and kept by that part. A sound opens on the body it was saved
    // on, a form's or the torus (its checkpoint chooses it again); an instrument plays the first sound made on it, and a rack the sound its
    // Torus opens with. A rack is placed on the part first, in Live's own rack shape (O-I #852 round 9, `rack_place`): an Instrument Rack
    // under its name, its macros where they stand, its variations; what the shell has no shape for yet is said in words. Its sound opens with
    // the rack, so the Torus's Macros page holds its macros and variations (live/LivePresets.tsx playKeptSoundOn).
    if (openSound) actions.seat = {op: LIVE_SEAT_SOUND_OP, accepts: TORUS_KEPT_MIME, run: payload => {
      const dropped = readTorusKeptDrag(payload)
      if (!dropped) return refused('Only a kept sound plays on a new part: drag one from under the Torus in Instruments.')
      const sound = dropped.kind === 'sound' ? dropped.ref : dropped.sound
      if (!sound) return refused(dropped.kind === 'instrument'
        ? 'This instrument has no sound made on it yet: save a sound while its body rings, then drop the instrument.'
        : 'This rack opens no sound: keep a sound on it, then drop the rack.')
      const rack = dropped.rack
      return act({kind: 'track_insert', after: null}).then(async (answer): Promise<WorldActionReceipt> => {
        const track = answer.at?.track
        if (typeof track !== 'number') return {ok: false, error: `${answer.done} The owner named no part it made, so the sound was not opened.`}
        let placed = ''
        if (rack) {
          const made = await act({kind: 'rack_place', track, name: rack.name, macros: rack.macros.map(({name, value}) => ({name, value})),
            variations: rack.variations.map(({name, values}) => ({name, values: [...values]})),
            chain: rackChainInLive(rack.chain).chain.map(({device, parameters}) => ({device, parameters: parameters.map(p => ({...p}))}))}).then(
            done => ({ok: true as const, done: done.done}), (cause: unknown) => ({ok: false as const, cause}))
          // A refusal speaks plainly (shared/Refusal.tsx): what happened, then the owner's words when they are words.
          if (!made.ok) return {ok: false, error: refusalWords(`${answer.done} The rack was not placed on it.`, made.cause)}
          placed = made.done
        }
        const opened = await openSound(sound, track, rack)
        return opened.ok ? {ok: true, note: [answer.done, placed, opened.note, ...(rack ? rackUnplaced(rack) : [])].filter(Boolean).join(' ')}
          : {ok: false, error: refusalWords(`${answer.done} The sound did not open on it.`, opened.error)}
      }, (cause: unknown) => ({ok: false as const, error: refusalWords('No part was made for the sound.', cause)}))
    }}
  }
  // An audio part's consolidate writes a new sample of what it plays: a render (the owner refuses it in the same words).
  const rendersConsolidate = (track: number): boolean => {
    const kind = set.tracks[track]?.kind
    return consolidateAudio !== undefined && kind !== undefined && CONSOLIDATE_REFUSED[kind] === LIVE_RENDER_WAIT
  }
  const consolidateRefusal = (track: number): string | undefined => {
    const kind = set.tracks[track]?.kind
    if (kind === 'midi' || rendersConsolidate(track)) return undefined
    return (kind && CONSOLIDATE_REFUSED[kind]) ?? `${named(track)} is no audio or MIDI part: it holds no clips to join.`
  }
  actions.waiting = LIVE_WAITING
  if (insertClip) actions.insertClip = {op: LIVE_INSERT_CLIP_OP, run: (trackId, rowId) => {
    const track = trackOf(trackId, 'holds no clips'), scene = rowOf(rowId)
    if (typeof track === 'string') return refused(track)
    if (typeof scene === 'string') return refused(scene)
    // Live inserts an empty clip one bar long: a bar of the set's signature
    return insertClip(track, scene, barBeats(document?.signature)).then(() => ({ok: true as const, note: `Inserted an empty MIDI clip in row ${scene + 1} of ${named(track)}.`}),
      (cause: unknown) => ({ok: false as const, error: said(cause)}))
  }}
  if (exportTake) actions.exportTake = {op: LIVE_EXPORT_TAKE_OP, run: clipId => {
    const place = clipOf(clipId)
    if (typeof place === 'string') return refused(place)
    return 'arrangement' in place.at ? exportTake(place.track, place.at) : refused('A take lies in Arrangement view: Export Audio renders a take Record laid there.')
  }}
  if (placeTake) actions.placeTake = {op: LIVE_PLACE_TAKE_OP, run: clipId => {
    const place = clipOf(clipId)
    return typeof place === 'string' ? refused(place) : placeTake(place.track, place.at)
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
    // A row launches only what is in it (§21.1): its clips, and the stop of each empty slot that keeps one; a slot whose stop the set
    // removed leaves its part playing. A part's clip is of the part's kind.
    const launchRow = play.launchRow
    if (launchRow) actions.launchStop = {op: LIVE_ROW_LAUNCH_OP, run: columnId => {
      const scene = rowOf(columnId)
      if (typeof scene === 'string') return refused(scene)
      if (!document) return refused('The set\'s slots are not read yet, so the row has nothing to launch.')
      const slots: RowSlot[] = []
      set.tracks.forEach((part, track) => {
        const kind = CLIP_PARTS[part.kind]
        if (!kind) return
        const held = document.tracks[track]?.sessionSlots[String(scene)]
        if (typeof held === 'string') slots.push({track, name: held, kind})
        else if (!(document.tracks[track]?.stoplessSlots ?? []).includes(scene)) slots.push({track, kind: 'stop'})
      })
      return launchRow(scene, slots)
    }}
    const reenable = play.reenable
    if (reenable) actions.reenable = {op: LIVE_REENABLE_OP, run: laneId => laneId === undefined ? reenable()
      : laneId.includes(TAKE_LANE) ? reenable(laneId.slice(laneId.indexOf(TAKE_LANE) + TAKE_LANE.length))
      : refused(`${laneId} is a lane of the set's own automation, which no hand here overrides: Re-enable gives back what a take's lanes play.`)}
    const back = play.backToArrangement
    if (back) actions.backToArrangement = {op: LIVE_BACK_OP, run: () => back()}
    const unfreeze = play.unfreeze
    if (unfreeze) actions.unfreeze = {op: LIVE_UNFREEZE_OP, run: laneId => {
      if (!laneId.includes(TAKE_LANE)) return refused(`${laneId} is a lane of the set's own automation, which no take froze: Unfreeze lets go of a take frozen on its part.`)
      const place = clipOf(laneId.slice(0, laneId.indexOf(TAKE_LANE)))
      return typeof place === 'string' ? refused(place) : unfreeze(place.track)
    }}
  }
  // Record into a slot (O-I #743): an armed MIDI part's empty slot begins a take on the part, and ends it there, laid in the slot.
  if (record) actions.recordSlot = {op: LIVE_RECORD_SLOT_OP, run: (trackId, columnId) => {
    const track = trackOf(trackId, 'records into no slot'), scene = rowOf(columnId)
    if (typeof track === 'string') return refused(track)
    if (typeof scene === 'string') return refused(scene)
    if (set.tracks[track]?.kind !== 'midi') return refused(`${named(track)} is not a MIDI part: Live records notes into a MIDI part's slot.`)
    return record(track, scene).catch((cause: unknown) => ({ok: false as const, error: said(cause)}))
  }}
  return actions
}
