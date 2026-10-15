// What the World cut adds to a mode's tracks, as readings of the time spine (WORLD-SHELL-DESIGN §15): the cron firings as a track,
// the occasion stood in, and the stop focus a walk's rail presses. Ported from the World cut presentation the tracks pane replaced,
// git 09a573a1d:packages/live-shell/ui/src/projections/worldTimelinePresentation.tsx:
// - the cron set (:137-141): one row named `firings`, one track `cron · firings`, the spine's `cronClips()` — every real firing a
//   clip, nothing synthetic; its cadence and count, the old Cron chip (:486-489), are the track's kind words. A firing stands on the
//   ruler at its own instant where the mode's ruler places civil instants (`ruler.instant`); elsewhere the Session holds it;
// - the occasion (:465-474 the Occasion chip and its admission light, :367 the occasion cursor): the spine's selected occasion, its
//   basis words as first read, placed where the clip that draws its event stands, its admission a separate reading — null until a
//   fresh read has qualified it;
// - the stop focus (:255-261 focusWalkStop): walkStopFocus → applyWalkStopFocus, through the owners (the spine, the atlas), with
//   the named absence as the refusal.
// The views draw these from the set; they hold no spine and know no mode. The registration that calls this is modeTracks.ts.
//
// Pure TypeScript. No React.
import type {Occasion, TemporalEventRow, TimeSpine} from '../../timeline/timeSpine'
import type {WorldTrackActions, WorldTrackClip, WorldTrackOccasion, WorldTrackSet, WorldWalk, WorldWalkStop} from '../../timeline/worldTrackAdapter'

/** The cron track's id, and the one row its firings stand in (worldTimelinePresentation.tsx:138-139). */
export const CRON_TRACK_ID = 'cron'
export const CRON_ROW_ID = 'cron'

/** The op the rails' stop focus names (the one rule the Timeline and the Journey share). */
export const FOCUS_STOP_OP = 'applyWalkStopFocus: the stop\'s occasion on the spine, or its epoch in the atlas'

/** The cron track's kind words: the read cadence and the firings landed (the old Cron chip, :486-489). */
export function cronKindText(cadence: {label: string; everyMs: number} | null | undefined, firings: number): string {
  return `cron · ${cadence ? `${cadence.label} · every ${Math.round(cadence.everyMs / 1000)}s` : 'no cadence'} · ${firings} firing${firings === 1 ? '' : 's'} landed`
}

/** The spine's firings as a set (:137-141). A firing stands at its instant where `ruler.instant` places it; the track is read-only:
 * no owner op of the mode reaches the spine's record of what fired. */
export function cronSet(spine: Pick<TimeSpine, 'cronClips' | 'firings'>, cadence: {label: string; everyMs: number} | null | undefined, ruler?: WorldTrackSet['ruler']): WorldTrackSet {
  const instants = new Map(spine.firings().map(firing => [firing.id, firing.atUnixMs]))
  const clips = spine.cronClips().map((clip): WorldTrackClip => {
    const instant = instants.get(clip.id)
    const at = instant !== undefined ? ruler?.instant?.(instant) : undefined
    return at !== undefined && Number.isFinite(at) ? {...clip, at: {start: at}} : clip
  })
  return {
    columns: [{id: CRON_ROW_ID, name: 'firings'}],
    tracks: [{id: CRON_TRACK_ID, name: 'cron · firings', kind: cronKindText(cadence, clips.length), readOnly: true}],
    clips,
  }
}

/** A mode's set with the cron set after its own tracks (the old cut's group order: the cron group last). A set that already holds
 * a track of that id keeps its own. */
export function withCron(set: WorldTrackSet, cron: WorldTrackSet): WorldTrackSet {
  if (set.tracks.some(track => track.id === CRON_TRACK_ID)) return set
  const columns = set.columns.some(column => column.id === CRON_ROW_ID) ? set.columns : [...set.columns, ...cron.columns]
  return {...set, columns, tracks: [...set.tracks, ...cron.tracks], clips: [...set.clips, ...cron.clips]}
}

/** The occasion stood in, as the set's reading (:465-474, :367): placed where a clip of this set draws its event. */
export function occasionOn(set: Pick<WorldTrackSet, 'clips'>, occasion: Occasion | null, eventByClipId: ReadonlyMap<string, TemporalEventRow>): WorldTrackOccasion | undefined {
  if (!occasion) return undefined
  const {basis, admission} = occasion
  const stands = (clip: WorldTrackClip) => eventByClipId.get(clip.id)?.subject_ref === basis.ref
  const clip = set.clips.find(candidate => candidate.at && stands(candidate)) ?? set.clips.find(stands)
  return {
    ref: basis.ref,
    label: basis.summary || basis.ref,
    ...(basis.instantUnixMs != null ? {year: new Date(basis.instantUnixMs).getUTCFullYear()} : {}),
    ...(clip ? {clipId: clip.id} : {}),
    ...(clip?.at ? {at: clip.at.start} : {}),
    admission: admission ? {admitted: admission.admitted, disclosure: admission.disclosure} : null,
  }
}

/** The readout words and the admission light of an occasion (:468-470): lit only when an admission is reported. */
export function occasionLight(occasion: Pick<WorldTrackOccasion, 'admission'>): {state: 'admitted' | 'refused' | 'unqualified'; title: string} {
  const admission = occasion.admission
  if (!admission) return {state: 'unqualified', title: 'Current admission not yet qualified against a fresh reading'}
  return {state: admission.admitted ? 'admitted' : 'refused', title: `Current admission: ${admission.admitted ? 'admitted' : 'no longer in the reading'} — ${admission.disclosure}`}
}

/** Stand a stop through its owners: resolves to the named absence, or null when it stood (useTechneTracks.ts techneControls). */
export type StandStop = (walk: WorldWalk, stop: WorldWalkStop) => Promise<string | null>

/** The rails' stop focus over the set's own walks: an index the walk does not hold is refused before any owner is called. */
export function focusStopAction(walks: readonly WorldWalk[], stand: StandStop): NonNullable<WorldTrackActions['focusStop']> {
  return {
    op: FOCUS_STOP_OP,
    run: async (walkId, stopIndex) => {
      const walk = walks.find(candidate => candidate.id === walkId)
      const stop = walk?.stops[stopIndex]
      if (!walk || !stop) return {ok: false, error: `Stop ${stopIndex + 1} of "${walkId}" is not a stop of this work.`}
      let absence: string | null
      try {
        absence = await stand(walk, stop)
      } catch (cause) {
        absence = cause instanceof Error ? cause.message : String(cause)
      }
      return absence === null ? {ok: true, note: `Stood ${stop.label}.`} : {ok: false, error: absence}
    },
  }
}

/** What the World cut adds to a mode's set: the cron track, the occasion, and — where the set carries walks and its owner gives no
 * stop focus of its own — the rails' stop focus. */
export function worldCutSet(set: WorldTrackSet, spine: Pick<TimeSpine, 'cronClips' | 'firings' | 'occasion'>, source: {eventByClipId: ReadonlyMap<string, TemporalEventRow>; readCadence?: {label: string; everyMs: number} | null}, stand: StandStop): WorldTrackSet {
  const merged = withCron(set, cronSet(spine, source.readCadence, set.ruler))
  const occasion = occasionOn(merged, spine.occasion(), source.eventByClipId)
  const focus = merged.walks?.length && !merged.actions?.focusStop ? focusStopAction(merged.walks, stand) : undefined
  return {
    ...merged,
    ...(occasion ? {occasion} : {}),
    ...(focus ? {actions: {...merged.actions, focusStop: focus}} : {}),
  }
}
