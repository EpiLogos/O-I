// The Session grid as its catalogue design (parity D-25; catalogue dlw__session-grid.tsx; manual §16.6): the design draws the mode's tracks
// the Session · Arrangement pane already reads (ModeTracksView.tsx over modeTracks.ts), fed through this binding. Its keys and their owners:
//   light         lit while the set holds a track, dark while it holds none
//   mode          the mode the tracks are (the reading's mode): its Quantize words follow it
//   tracks        the set's tracks in its order (WorldTrack), a group being a track another sits under (`parentId`); the Main track's own
//                 material and the return tracks stand elsewhere in the shell's grid (its Main column, returnTracks.ts) and are not drawn here
//   clips, rows   the set's clips in their track's column and their stop's row (WorldTrackClip.columnId, counted from 1), each with its
//                 state, its read progress (SessionGrid.tsx clipProgress) and its takes; one clip per slot, the first the set gives
//   sel           THE selection, where it names a clip of the set (track:row); a press selects through the pane's own selection
//   armed, solo:* the mixer's Arm and Solo as the set reads them (WorldTrackMix), written through its mixer ops (WorldTrackActions.mixer)
//   quantize, follow:*, launch:*   the selected clip's launch (ClipLaunch) as its owner words it, where the words are the design's; no op
//                 writes a clip's launch settings, so each stands refused with the op it waits for
//   fold:*, show:*, takes          the view's own: which groups fold, which tracks the design draws, whether takes stack
//   rowKeys       the shell's own: the number keys launch the shown rows always (keys/keyDoors.ts publishTrackRows), with no switch
// The pane keeps the shell's own grid as the device's Full (deviceDoor.ts OwnFull: the material itself), so launch, stop, record, retry,
// the mixer row, the sections, the drop and the menus stay as they work.
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../devices/designed'
import type {WorldTrack, WorldTrackClip, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import {clipProgress, trackColour, type TracksSelection} from './SessionGrid'
import {designDevice, handsFor, missing} from '../../techne/devices/designDevices'

export const SESSION_GRID_ID = 'dlw:session-grid'
export const sessionGridDevice = designDevice(SESSION_GRID_ID, {title: 'Session grid', icon: 'session', heldBy: ['tracks'],
  note: 'The mode\'s tracks as the Session draws them: tracks across, stops down.'})

const FOLLOWS = ['none', 'next', 'first', 'stop'], MODES = ['once', 'hold', 'loop']
/** Each mode's Quantize words (the design's QUANT), as the owner's word for a launch reads them: Factory's "next tool" is Tool. */
const QUANT_WORDS: Readonly<Record<string, string>> = {now: 'now', tool: 'tool', 'next tool': 'tool', turn: 'turn', 'next turn': 'turn', bar: 'bar', 'next bar': 'bar', step: 'step'}

export const NO_LAUNCH_WRITE = missing('A clip\'s launch settings', 'an owner op that sets a clip\'s quantize, follow action or launch mode (the set\'s actions carry launch, stop and record only)', 'the mode\'s owner')
export const ROW_KEYS = 'The number keys launch the rows of the tracks this pane shows, always (the shell\'s row keys): no switch turns them off.'
const NO_CLIP = 'Select a clip in the grid: its launch reads here.'
const NOT_SAID = 'The selected clip\'s owner says nothing of this.'

/** The tracks the design draws: the set's own, apart from the Main track's material and the returns. */
const drawnTracks = (set: WorldTrackSet): readonly WorldTrack[] => set.tracks.filter(track => !track.main && !track.returns)

/** The clip each slot holds (the first the set gives), keyed as the design keys a clip: `track:row`. */
function slots(set: WorldTrackSet): Map<string, WorldTrackClip> {
  const tracks = new Set(drawnTracks(set).map(track => track.id)), rows = new Map(set.columns.map((column, i) => [column.id, i + 1]))
  const out = new Map<string, WorldTrackClip>()
  for (const clip of set.clips) {
    const row = rows.get(clip.columnId)
    if (!row || !tracks.has(clip.trackId)) continue
    const key = `${clip.trackId}:${row}`
    if (!out.has(key)) out.set(key, clip)
  }
  return out
}

/** The keys the view holds, for this set: a fold for each group, a show for each track, and Takes. */
export function sessionGridLocal(set: WorldTrackSet): readonly string[] {
  const tracks = drawnTracks(set), parents = new Set(tracks.flatMap(track => (track.parentId ? [track.parentId] : [])))
  return [...tracks.filter(track => parents.has(track.id)).map(track => `fold:${track.id}`), ...tracks.map(track => `show:${track.id}`), 'takes']
}

/** The design's values over the set and the selection. Pure. */
export function sessionGridValues(set: WorldTrackSet, selection: Pick<TracksSelection, 'ref'>, mode: string, held: Readonly<Record<string, Value>> = {}): Values {
  const tracks = drawnTracks(set), ids = new Set(tracks.map(track => track.id))
  const parents = new Set(tracks.flatMap(track => (track.parentId && ids.has(track.parentId) ? [track.parentId] : [])))
  const values: Record<string, Value> = {light: tracks.length ? 'lit' : 'dark', mode, rows: set.columns.length, rowKeys: true}
  values.tracks = JSON.stringify(tracks.map(track => ({id: track.id, name: track.name, short: track.name, c: trackColour(track),
    ...(track.parentId && ids.has(track.parentId) ? {parent: track.parentId} : {}), ...(parents.has(track.id) ? {group: true} : {})})))
  const held_ = slots(set)
  values.clips = JSON.stringify([...held_].map(([key, clip]) => {
    const row = Number(key.slice(key.lastIndexOf(':') + 1)), p = clipProgress(clip), takes = clip.takes?.length ?? 0
    return {track: clip.trackId, row, label: clip.label, ...(clip.status ? {status: clip.status} : {}), ...(p !== null ? {p} : {}), ...(takes ? {takes} : {})}
  }))
  for (const [key, clip] of held_) {
    const follow = clip.launch?.follow?.trim().toLowerCase(), launch = clip.launch?.mode?.trim().toLowerCase()
    if (follow && FOLLOWS.includes(follow)) values[`follow:${key}`] = follow
    if (launch && MODES.includes(launch)) values[`launch:${key}`] = launch
  }
  const chosen = [...held_].find(([, clip]) => clip.id === selection.ref)
  if (chosen) {
    values.sel = chosen[0]
    const quantize = QUANT_WORDS[chosen[1].launch?.quantize?.trim().toLowerCase() ?? '']
    if (quantize) values.quantize = quantize
  }
  // The mixer's Arm and Solo, where the set reads them.
  const armable = tracks.filter(track => typeof track.mix?.arm === 'boolean')
  if (armable.length) values.armed = armable.find(track => track.mix?.arm)?.id ?? 'none'
  for (const track of tracks) if (typeof track.mix?.solo === 'boolean') values[`solo:${track.id}`] = track.mix.solo
  values.takes = held.takes ?? false
  for (const key of sessionGridLocal(set)) if (held[key] !== undefined) values[key] = held[key]!
  return values
}

/** Why a key stands as it does: refused, the shell's own, or unread. */
function sessionGridStanding(set: WorldTrackSet, values: Values): Record<string, Standing> {
  const standing: Record<string, Standing> = {rowKeys: {disabled: ROW_KEYS}}
  const chosen = typeof values.sel === 'string' ? values.sel : undefined
  standing.quantize = {disabled: chosen ? (values.quantize === undefined ? NOT_SAID : NO_LAUNCH_WRITE) : NO_CLIP}
  for (const key of slots(set).keys()) for (const kind of ['follow', 'launch']) standing[`${kind}:${key}`] = {disabled: NO_LAUNCH_WRITE}
  const mixer = set.actions?.mixer, waiting = set.actions?.waiting ?? {}
  if (!mixer?.arm) standing.armed = {disabled: waiting.arm ?? (values.armed === undefined ? 'This mode\'s tracks are not armed.' : 'This mode\'s owner takes no arm from here.')}
  if (!mixer?.solo) for (const track of drawnTracks(set)) standing[`solo:${track.id}`] = {disabled: waiting.solo ?? 'This mode\'s owner takes no solo from here.'}
  return standing
}

export async function sessionGridWrite(set: WorldTrackSet, selection: TracksSelection, changes: readonly ValueChange[], values: Values): Promise<void> {
  const clips = slots(set)
  for (const {key, value} of changes) {
    if (key === 'sel') {
      const clip = typeof value === 'string' ? clips.get(value) : undefined
      if (!clip) throw Error('No clip stands in that slot.')
      selection.select({kind: 'clip', ref: clip.id, title: clip.label, track: clip.trackId})
      continue
    }
    if (key === 'armed') {
      const arm = set.actions?.mixer?.arm
      if (!arm) throw Error(set.actions?.waiting?.arm ?? 'This mode\'s owner takes no arm from here.')
      const before = typeof values.armed === 'string' && values.armed !== 'none' ? values.armed : undefined
      if (value === before) continue
      if (value === 'none') { if (before) await arm.run(before, false); continue }
      if (typeof value !== 'string' || !drawnTracks(set).some(track => track.id === value)) throw Error('Arm a track of this set.')
      await arm.run(value, true)
      continue
    }
    const solo = /^solo:(.+)$/.exec(key)
    if (solo) {
      const run = set.actions?.mixer?.solo
      if (!run) throw Error(set.actions?.waiting?.solo ?? 'This mode\'s owner takes no solo from here.')
      await run.run(solo[1]!, value === true)
      continue
    }
    if (key === 'quantize' || key.startsWith('follow:') || key.startsWith('launch:')) throw Error(NO_LAUNCH_WRITE)
    if (key === 'rowKeys') throw Error(ROW_KEYS)
    throw Error(`${key} is a reading of the set: its owner reports it; nothing here changes it.`)
  }
}

/** The Session grid's binding over the set the pane shows. */
export function sessionGridBinding(set: WorldTrackSet, selection: TracksSelection, mode: string, held: Readonly<Record<string, Value>> = {}): DesignBinding {
  const values = sessionGridValues(set, selection, mode, held)
  return {
    id: SESSION_GRID_ID,
    values,
    standing: sessionGridStanding(set, values),
    local: handsFor(SESSION_GRID_ID, sessionGridLocal(set)),
    writes: key => key === 'sel' || key === 'armed' || key === 'quantize' || key === 'rowKeys' || /^(solo|follow|launch):/.test(key),
    write: changes => sessionGridWrite(set, selection, changes, values),
  }
}
