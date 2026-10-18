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
// devices the set lists on it); every part carries Live's mixer row — Activator, Solo, Arm, Monitor In · Auto · Off and its output —
// whose readings and writes the set's owner (`live_set_read`) does not carry yet; its automation envelopes and take lanes are not
// read either. Each stands disabled or absent with the op it lacks; nothing is filled in.
import type {SetDocument} from '../shell/document'
import type {SetSummary} from '../shell/useSet'
import type {WorldMixer, WorldTrackAdapter, WorldTrackClip, WorldTrackSet} from './worldTrackAdapter'

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
  takes: missing('Take lanes', 'live_set_read reporting each track\'s TakeLanes {name, clips: [{name, start, end}]} and the main lane\'s comp, and live_take_comp {path, track, lane, start, end} for the comp'),
  automation: missing('Automation lanes', 'live_set_read reporting each track\'s AutomationEnvelopes {device, parameter, points: [{beat, value}]}'),
  events: 'Event lanes are Factory\'s: a session\'s messages, files, terminal and pages read.',
} as const

export interface LiveSetReading {
  set: SetSummary | null
  document: SetDocument | null
  /** Each track's display colour, by index (the shell's palette and the person's overrides). */
  colors?: readonly string[]
}

export const LIVE_SET_TRACK_ADAPTER_ID = 'live-set-tracks'

const barBeat = (beats: number): string => `${Math.floor(beats / 4) + 1}.${Math.floor(beats % 4) + 1}`

export const liveSetTrackAdapter: WorldTrackAdapter<LiveSetReading> = {
  id: LIVE_SET_TRACK_ADAPTER_ID,
  project({set, document, colors}): WorldTrackSet {
    if (!set) return {columns: [], tracks: [], clips: []}
    const trackRef = (index: number) => `als:${set.path}#track/${index}`
    // The set's master track is Live's Main track: its material stands at the end, and its chain is the devices the set lists on it.
    const tracks = set.tracks.map((track, index) => ({id: trackRef(index), name: track.name, kind: track.kind, ...(colors?.[index] ? {color: colors[index]} : {}),
      ...(track.kind === 'master' ? {main: true as const} : {})}))
    const master = set.tracks.find(track => track.kind === 'master')
    const columns = Array.from({length: set.scene_count}, (_, scene) => ({id: `scene:${scene}`, name: String(scene + 1)}))
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
    return {columns, tracks, clips, ruler: {unit: 'beats', label: barBeat},
      mixer: LIVE_MIXER, main: {name: 'Main', chain: master ? [...master.devices] : []}, lanes: {absent: LIVE_LANES_ABSENT}}
  },
}
