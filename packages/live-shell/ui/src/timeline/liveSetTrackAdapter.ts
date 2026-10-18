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
import type {SetDocument} from '../shell/document'
import type {SetSummary} from '../shell/useSet'
import type {WorldAutomationLane, WorldMixer, WorldTakeLane, WorldTrackAdapter, WorldTrackClip, WorldTrackSet} from './worldTrackAdapter'
import type {LiveEnvelope} from '../../../../../desktop/cradle/src/kernel/types'

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
  /** The set owner's mixer write (live/liveWrites.ts writeLiveMixer); absent, the row is read only and says why. */
  mixerWrite?: (track: number, control: 'activator' | 'solo' | 'arm' | 'monitor', value: boolean | 'in' | 'auto' | 'off') => Promise<unknown>
}

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
  project({set, document, colors, mixerWrite}): WorldTrackSet {
    if (!set) return {columns: [], tracks: [], clips: []}
    const trackRef = (index: number) => `als:${set.path}#track/${index}`
    // The set's master track is Live's Main track: its material stands at the end, and its chain is the devices the set lists on it.
    const tracks = set.tracks.map((track, index) => {
      const mixer = document?.tracks[index]?.mixer
      return {id: trackRef(index), name: track.name, kind: track.kind, ...(colors?.[index] ? {color: colors[index]} : {}),
        ...(track.kind === 'master' ? {main: true as const} : {}), ...(mixer && Object.keys(mixer).length ? {mix: {...mixer}} : {})}
    })
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
    // The take lanes and automation the set holds under each track.
    const takes: WorldTakeLane[] = [], automation: WorldAutomationLane[] = []
    const read = !!document?.tracks.some(track => track.takeLanes !== undefined || track.automation !== undefined)
    document?.tracks.forEach((track, index) => {
      if (index >= tracks.length) return
      track.takeLanes?.forEach((lane, at) => takes.push({id: `${trackRef(index)}#take/${at}`, trackId: trackRef(index), name: lane.name || `Take ${at + 1}`,
        spans: lane.clips.map(clip => ({start: clip.start, end: clip.end, label: clip.name}))}))
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
      lanes: {...(takes.length ? {takes} : {}), ...(automation.length ? {automation} : {}), absent}}
    if (writing) {
      const indexOf = (trackId: string) => tracks.findIndex(track => track.id === trackId)
      const run = (control: 'activator' | 'solo' | 'arm' | 'monitor') => (trackId: string, value: boolean | 'in' | 'auto' | 'off') => {
        const index = indexOf(trackId)
        if (index < 0) return Promise.resolve({ok: false, error: `"${trackId}" is not a track of this set.`})
        return mixerWrite(index, control, value).then(
          () => ({ok: true, note: `${control} written to the set.`}),
          (cause: unknown) => ({ok: false, error: cause instanceof Error ? cause.message : String(cause)}))
      }
      result.actions = {mixer: {activator: {op: LIVE_MIXER_WRITE_OP('activator'), run: run('activator')}, solo: {op: LIVE_MIXER_WRITE_OP('solo'), run: run('solo')},
        arm: {op: LIVE_MIXER_WRITE_OP('arm'), run: run('arm')}, monitor: {op: LIVE_MIXER_WRITE_OP('monitor'), run: run('monitor')}}}
    }
    return result
  },
}
