// What the shared views draw of R3's contract (manual §16.6, §16.8; lock §0.3 item 3), as pure readings of the set: each track's
// mixer row, the Main track at the end, and the lanes under each track in Arrangement view. Live 12 is the reference for every
// piece (Work/reverse-engineering/ableton-live-12.0.25/ui/CLIP-VIEW-EVIDENCE.md): the mixer row's activator, solo, arm, monitor
// In · Auto · Off and I/O (cap 37, 43); the Main column's launchers, Stop All and Back to Arrangement (cap 35, 41); automation lanes
// headed by device and parameter (cap 43); take lanes with an audition button, and a comp that copies a selected range of a take
// into the main lane, the used range drawn in the clip's colour (cap 44–45). New module; it ports no shell code (the views had
// none of this) and replaces nothing. Pure TypeScript, no React, no mode names.
import type {
  MixerControlId,
  MonitorSetting,
  TrackLaneKind,
  WorldAutomationLane,
  WorldEventLane,
  WorldTakeLane,
  WorldTrack,
  WorldTrackSet,
} from '../../timeline/worldTrackAdapter'

/** The row's order, as Live draws its mixer: activator, solo, arm, then the I/O column's monitor and routes. */
export const MIXER_ORDER: readonly MixerControlId[] = ['activator', 'solo', 'arm', 'monitor', 'input', 'output']
export const MIXER_LABEL: Readonly<Record<MixerControlId, string>> = {activator: 'Activator', solo: 'Solo', arm: 'Arm', monitor: 'Monitor', input: 'Input', output: 'Output'}
/** The glyph each control shows, as Live's mixer does (the activator carries the track's number; solo "S"; arm the record dot). */
const MIXER_GLYPH: Readonly<Record<'activator' | 'solo' | 'arm', string>> = {activator: '', solo: 'S', arm: '●'}
const MONITOR_WORD: Readonly<Record<MonitorSetting, string>> = {in: 'In', auto: 'Auto', off: 'Off'}
/** Monitor steps In → Auto → Off → In, as Live's three-way switch reads left to right. */
export const nextMonitor = (setting: MonitorSetting | undefined): MonitorSetting => setting === 'in' ? 'auto' : setting === 'auto' ? 'off' : 'in'

/** One control of a track's row, as the views draw it. */
export interface MixerCell {
  id: MixerControlId
  label: string
  /** The words on the control: its glyph, its monitor word, or its route. */
  text: string
  /** on / off: the owner's reading; unread: the owner reports none; route: the mode's own route, not a setting. */
  state: 'on' | 'off' | 'unread' | 'route'
  /** The press, when an owner op writes it: what it says and what it runs. */
  press?: {what: string; run: () => unknown}
  title: string
}

/** The row of one track: the controls the mode has, in Live's order, each with its owner's reading and its write. A track merged
 * from another reading (read-only), or a set that declares no mixer, has none. */
export function mixerCells(set: WorldTrackSet, track: WorldTrack, position: number): MixerCell[] {
  if (!set.mixer || track.readOnly) return []
  const writes = set.actions?.mixer
  const mix = track.mix ?? {}
  const cells: MixerCell[] = []
  for (const id of MIXER_ORDER) {
    const control = set.mixer[id]
    if (!control) continue
    const label = MIXER_LABEL[id]
    const grain = control.grain ? ` · ${control.grain}` : ''
    if (control.route !== undefined || id === 'input' || id === 'output') {
      const value = id === 'input' || id === 'output' ? mix[id] : undefined
      const route = control.route ?? value
      cells.push({id, label, text: route ?? '—', state: route === undefined ? 'unread' : 'route',
        title: `${label} · ${control.meaning}${route === undefined ? ' · unread: the owner reports none' : control.route !== undefined ? ' · the mode\'s own route, not a setting' : ''}${control.disabled ? ` · ${control.disabled}` : ''}`})
      continue
    }
    if (id === 'monitor') {
      const value = mix.monitor
      const write = writes?.monitor
      const next = nextMonitor(value)
      cells.push({id, label, text: value ? MONITOR_WORD[value] : '—', state: value === undefined ? 'unread' : value === 'off' ? 'off' : 'on',
        ...(write ? {press: {what: `Monitor ${MONITOR_WORD[next]} on ${track.name}`, run: () => write.run(track.id, next)}} : {}),
        title: `${label} · ${control.meaning} · ${value ? MONITOR_WORD[value] : 'unread: the owner reports none'}${write ? ` · press for ${MONITOR_WORD[next]} (${write.op})` : control.disabled ? ` · ${control.disabled}` : ''}${grain}`})
      continue
    }
    const key = id as 'activator' | 'solo' | 'arm'
    const value = mix[key]
    const write = writes?.[key]
    // An unread switch, pressed, asks the owner for On: nothing here pretends to know which way it stands.
    const next = value === undefined ? true : !value
    const glyph = key === 'activator' ? String(position + 1) : MIXER_GLYPH[key]
    cells.push({id, label, text: glyph, state: value === undefined ? 'unread' : value ? 'on' : 'off',
      ...(write ? {press: {what: `${label} ${next ? 'on' : 'off'} on ${track.name}`, run: () => write.run(track.id, next)}} : {}),
      title: `${label} · ${control.meaning} · ${value === undefined ? 'unread: the owner reports none' : value ? 'on' : 'off'}${write ? ` · press to turn it ${next ? 'on' : 'off'} (${write.op})` : control.disabled ? ` · ${control.disabled}` : ''}${grain}`})
  }
  return cells
}

/** The tracks in the views' order: the set's own, with the Main track's material at the end, where Live keeps Main. */
export function mainLast(tracks: readonly WorldTrack[]): WorldTrack[] {
  return [...tracks.filter(track => !track.main), ...tracks.filter(track => track.main)]
}

/** The Lanes setting (manual §16.6: Takes On, Automation On, Events Off by default). The pane's own presentation. */
export type LanesShown = Readonly<Record<TrackLaneKind, boolean>>
export const DEFAULT_LANES: LanesShown = {takes: true, automation: true, events: false}
export const LANE_WORD: Readonly<Record<TrackLaneKind, string>> = {takes: 'Takes', automation: 'Automation', events: 'Events'}

/** The lanes under one track, as the Lanes setting shows them. */
export function lanesUnder(set: WorldTrackSet, trackId: string, shown: LanesShown): {takes: WorldTakeLane[]; automation: WorldAutomationLane[]; events: WorldEventLane[]} {
  const lanes = set.lanes
  return {
    takes: shown.takes ? (lanes?.takes ?? []).filter(lane => lane.trackId === trackId) : [],
    automation: shown.automation ? (lanes?.automation ?? []).filter(lane => lane.trackId === trackId) : [],
    events: shown.events ? (lanes?.events ?? []).filter(lane => lane.trackId === trackId) : [],
  }
}

/** How many lanes of a kind the set holds, for the Lanes setting's readout. */
export const laneCount = (set: WorldTrackSet, kind: TrackLaneKind): number => (set.lanes?.[kind] ?? []).length

/** An automation lane's breakpoints on the ruler: its own `at`s, or — when it rides a clip — offset by where that clip stands. A lane
 * on a clip that has no place on the ruler has none. */
export function automationPoints(lane: WorldAutomationLane, clipStart: (clipId: string) => number | undefined): {at: number; value: number}[] {
  if (lane.clipId === undefined) return lane.points.map(point => ({at: point.at, value: point.value}))
  const base = clipStart(lane.clipId)
  return base === undefined ? [] : lane.points.map(point => ({at: base + point.at, value: point.value}))
}

/** A selected stretch of a take, ordered and held inside the take's own spans; null when it is empty or touches none of them. */
export function compRange(lane: WorldTakeLane, from: number, to: number): {start: number; end: number} | null {
  const start = Math.min(from, to), end = Math.max(from, to)
  if (!(end > start)) return null
  const covered = lane.spans.filter(span => span.end > start && span.start < end)
  if (!covered.length) return null
  return {start: Math.max(start, Math.min(...covered.map(span => span.start))), end: Math.min(end, Math.max(...covered.map(span => span.end)))}
}
