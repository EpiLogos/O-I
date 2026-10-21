// The one Arrangement view (manual §3, FOUNDATION F3): "lays the same material along one ruler, so you can see the course
// of it". Tracks down, time across. A clip with a place on the ruler stands there; a set with no ruler lays its rows end
// to end, each as wide as its longest clip, while a set with a ruler lays only the clips that have an `at` (no `at`, no
// place on it) and says how many it left to the Session. A track's needle marks where it has got to, and stalls in the
// stall colour with its age. A ruler that fixes its window and says where now stands gets a now line. A running clip has no
// right edge (its needle is the edge) and a waiting one with no length is a dash. Craft floor: world-shell-mockup.html
// `tlBody` / `tlClips`; ported from agent/AgentArrangementView.tsx (the run viewer).
//
// From the World cut presentation it replaced (git 09a573a1d:packages/live-shell/ui/src/projections/worldTimelinePresentation.tsx)
// and the Expressions Arrangement (…/components/nativeArrangementTimeline.tsx), everything read from the set:
// - each clip's standing mark (trackMarks.ts; :316-347 there), and the atmosphere of the narrowest section it stands in;
// - the sections, one lane per layer under the ruler, nested by depth and coloured by their atmosphere (trackSections.ts; :391-431);
// - the occasion stood in, as a line through the lanes and a readout on the ruler with its admission light (:367, :465-474) —
//   lit only when an admission is reported;
// - each walk as a rail under the lane that holds its stops, its stops numbered in walk order; pressing one stands it through
//   the set's `focusStop` (trackRails.ts; :433-447, :258-261);
// - the window: ⌘/Ctrl-wheel or a pinch zooms about the pointer, a sideways or Shift wheel pans, a drag on the ruler pans, and
//   the focused ruler takes ←/→ ↑/↓ + − Home End (a slider: the window's keys leave it its own); a press on the ruler sets the
//   pane's insert marker, snapped to the grid, coarsely, or freely (Shift frees one press, Alt coarsens it), and keyboard zoom
//   holds it still (rulerWindow.ts; nativeArrangementTimeline.tsx:92-111, :142-148, :173-226, :296-315). The window, the snap
//   and the marker are the pane's presentation: nothing here writes time to any owner.
// R3 (manual §16.6 "Arrangement view", §16.8; lock §0.3 item 3; Live cap 43–45): each track's head carries its mixer switches; the
// Main track's material lies last; under each track lie its lanes by the Lanes setting (Takes On, Automation On, Events Off): take
// lanes, each with its audition, where a stretch selected and Return copies it into the main lane through the owner's comp (the
// main lane shows which take each stretch came from); automation lanes naming device and parameter, what modulates them, and
// Re-enable for a value held by hand; Factory's event lanes, an event clicked opening beside the ruler (trackLanes.ts).
import {useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject} from 'react'
import type {TrackLaneKind, WorldEventLane, WorldTakeLane, WorldTrackClip, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import {answerOf, MixerRow, STATUS_WORD, stalledLanes, TrackDeviceButton, trackColour, trackTree, type PressedReceipt, type TracksSelection} from './SessionGrid'
import {trackHeadDevice, useTrackHeadDevices} from './trackHeads'
import {automationPoints, compRange, DEFAULT_LANES, LANE_WORD, laneCount, lanesUnder, mainLast, mixerCells, type LanesShown} from './trackLanes'
import {CutIcon} from '../../agent/agentIcons'
import {clipAccessibleName, clipStandingAttributes, clipStandingEdge, clipStandingMark, clipStandingTag, clipStandingTitle} from './trackMarks'
import {narrowestSectionOf, sectionLanes} from './trackSections'
import {railKindText, railSegments, railStopTitle, walkRails, type WalkRail} from './trackRails'
import {occasionLight} from './worldCutTracks'
import {
  clampRange, fitRange, isFit, markStep, nextSnap, panBy, percentOf, rangeBounds, snapAt, snapOfPress, wheelZoomFactor, windowMarks,
  windowOfKey, zoomAround, type SnapMode, type TimeRange,
} from './rulerWindow'
import {useTracksMenu} from '../menu/TracksMenu'
import './tracks.css'

interface Placed {clip: WorldTrackClip; start: number; end: number}
/** A grouped track's two sides, as the ruler names them (lock §9.3: sight and sound of one state). */
const SIDE_WORD = {visual: 'sight', audio: 'sound'} as const

/** Every clip's place on one ruler: its own `at`; else, on a set with no ruler, its row's offset plus its span (rows end to
 * end). On a set with a ruler a clip with no `at` has no place. `end` is the ruler's fixed window when the set gives one
 * (`ruler.end`, the run viewer's window: agent/AgentArrangementView.tsx:39), else what the clips and needles hold. */
export function placeClips(set: WorldTrackSet): {placed: Placed[]; end: number} {
  const ruled = set.ruler !== undefined
  const offsets = new Map<string, number>()
  let cursor = 0
  if (!ruled) {
    for (const row of set.columns) {
      offsets.set(row.id, cursor)
      const widest = Math.max(1, ...set.clips.filter(clip => clip.columnId === row.id).map(clip => clip.span?.end ?? 1))
      cursor += widest
    }
  }
  const placed: Placed[] = []
  for (const clip of set.clips) {
    if (clip.at) placed.push({clip, start: clip.at.start, end: clip.at.end ?? clip.at.start})
    else if (offsets.has(clip.columnId)) {
      const base = offsets.get(clip.columnId)!
      placed.push({clip, start: base + (clip.span?.start ?? 0), end: base + (clip.span?.end ?? 1)})
    }
  }
  const fixed = set.ruler?.end
  if (typeof fixed === 'number' && Number.isFinite(fixed) && fixed > 0) return {placed, end: fixed}
  const end = Math.max(cursor, 1, ...placed.map(p => p.end), ...set.tracks.map(track => track.needle ?? 0))
  return {placed, end}
}

/** A length on the ruler when the set gives no way to say it: the number and the ruler's unit. */
const plainDuration = (unit: string) => (span: number): string => `${Math.round(span)} ${unit}`

/** The pane's own view of the ruler: the window, the snap, the insert marker — and what the gestures and keys do to them. */
export interface RulerWindowProps {
  /** The window shown; null is the whole ruler. */
  window: TimeRange | null
  onWindow(next: TimeRange | null): void
  snap: SnapMode
  onSnap(next: SnapMode): void
  marker: number | null
  onMarker(next: number | null): void
  /** The measured width of the ruler's marks, in px (0 before it is measured). */
  width: number
  /** The marks row, for the gestures' geometry; the Arrangement's root, for the wheel and the pinch. */
  marksRef?: RefObject<HTMLDivElement | null>
  rootRef?: RefObject<HTMLDivElement | null>
  /** The drag in progress on the ruler, held across renders by the pane (a pan re-renders the view mid-drag). */
  gesture?: {current: RulerGesture | null}
}

/** A press on the ruler: where it began, the window then, px per ruler unit, and whether it has moved into a pan. */
export interface RulerGesture {pointer: number; startX: number; start: TimeRange; scale: number; moved: boolean}

/** A stretch of a take being chosen (the pane's own, until Return hands it to the owner's comp). */
export interface TakeSelection {trackId: string; takeId: string; from: number; to: number}

/** The pane's lanes state: the Lanes setting, the stretch of a take being chosen, and the event opened beside the ruler. */
export interface LanesViewProps {
  shown: LanesShown
  onShown(next: LanesShown): void
  take: TakeSelection | null
  onTake(next: TakeSelection | null): void
  opened: {laneId: string; eventId: string} | null
  onOpened(next: {laneId: string; eventId: string} | null): void
}
const STILL_LANES: LanesViewProps = {shown: DEFAULT_LANES, onShown: () => {}, take: null, onTake: () => {}, opened: null, onOpened: () => {}}

export interface ArrangementRulerViewProps {
  set: WorldTrackSet
  selection: TracksSelection
  empty?: string
  view: RulerWindowProps
  /** The lanes under the tracks; absent, the Lanes setting's defaults with nothing chosen. */
  lanes?: LanesViewProps
  receipt: PressedReceipt | null
  /** A rail's stop pressed: `key` names the control, `what` the press, `run` calls the owner. */
  onPress(key: string, what: string, run: () => unknown): void
  onDismiss(): void
}

/** The ruler's tools: zoom out, zoom in, fit, and the snap (nativeArrangementTimeline.tsx:309-312; the loop toggle there was an
 * owner write and is not here). */
function rulerTools(view: RulerWindowProps, range: TimeRange, bounds: ReturnType<typeof rangeBounds>, anchor: number) {
  const span = range.end - range.start
  return <span className="tl-head tl-tools">
    <button type="button" aria-label="Zoom out" title="Zoom out (↓ or − on the ruler, ⌘/Ctrl-wheel)" disabled={span >= bounds.end - bounds.start} onClick={() => view.onWindow(zoomAround(range, anchor, .5, bounds))}>−</button>
    <button type="button" aria-label="Zoom in" title="Zoom in (↑ or + on the ruler, ⌘/Ctrl-wheel or pinch)" disabled={span <= bounds.minSpan} onClick={() => view.onWindow(zoomAround(range, anchor, 2, bounds))}>+</button>
    <button type="button" aria-label="Fit the whole ruler" title="Fit the whole ruler" disabled={isFit(range, bounds)} onClick={() => view.onWindow(null)}>Fit</button>
    <button type="button" className="tl-snap" data-snap={view.snap} aria-label={`Snap: ${view.snap}`}
      title={`Snap · ${view.snap} — the insert marker snaps to a twentieth of a mark (grid), half a mark (coarse), or not at all (free). Shift frees one press, Alt coarsens it. Click for the next.`}
      onClick={() => view.onSnap(nextSnap(view.snap))}>⌗ {view.snap}</button>
  </span>
}

export function ArrangementRulerView({set, selection, empty, view, lanes: lanesView = STILL_LANES, receipt, onPress, onDismiss}: ArrangementRulerViewProps) {
  const {placed, end} = placeClips(set)
  const bounds = rangeBounds(end)
  const range = clampRange(view.window ?? fitRange(bounds), bounds)
  const held = (at: number) => Math.min(Math.max(at, 0), end)
  const pct = (at: number) => `${percentOf(held(at), range)}%`
  const span = range.end - range.start
  const marks = windowMarks(range, bounds, view.width)
  const label = set.ruler?.label ?? ((at: number) => String(Math.round(at * 10) / 10))
  const now = set.ruler?.now
  const tree = trackTree(set.tracks)
  const {own: stalled} = stalledLanes(set, tree)
  const left = set.clips.length - new Set(placed.map(p => p.clip.id)).size
  const inWindow = (at: number) => at >= range.start && at <= range.end
  // Keyboard and button zoom hold the insert marker still when it is in view (Live zooms about it), else the window's middle.
  const anchor = view.marker !== null && inWindow(view.marker) ? view.marker : (range.start + range.end) / 2
  const markRow = <div className="tl-marks">{marks.map(mark => <span key={mark.at} className={mark.end ? 'end' : undefined} style={{left: `${percentOf(mark.at, range)}%`}}>{label(mark.at)}</span>)}</div>
  // An empty work draws the ruler and the lane area with the reason in it, as the Session does — never a blank box.
  if (!set.tracks.length) return <div ref={view.rootRef as RefObject<HTMLDivElement>} className="tl" aria-label="Arrangement" data-tracks-view="arrangement" data-empty="true">
    <div className="tl-ruler" aria-label="Ruler"><span className="tl-head" />{markRow}</div>
    <div className="sg-drop" role="status">{empty ?? 'No tracks in this work yet.'}</div>
  </div>

  // Sections: one lane per layer under the ruler; a clip takes the atmosphere of the narrowest section it stands in.
  const lanesOfSections = sectionLanes(set)
  const trackOf = new Map(set.tracks.map(track => [track.id, track]))
  // Rails: under the lane of each walk's first placed stop; a rail with no placed stop stands after the tracks.
  const rails = walkRails(set, placed)
  const railsUnder = new Map<string, WalkRail[]>()
  for (const rail of rails) if (rail.trackId !== undefined) railsUnder.set(rail.trackId, [...(railsUnder.get(rail.trackId) ?? []), rail])
  const focusStop = set.actions?.focusStop
  // The occasion stood in: a line through the lanes where its clip stands (:367), and its readout with the admission light.
  const occasion = set.occasion
  const occasionAt = occasion?.at !== undefined && inWindow(occasion.at) ? occasion.at : undefined
  const light = occasion ? occasionLight(occasion) : undefined
  const marker = view.marker !== null && inWindow(view.marker) ? view.marker : undefined

  // The ruler's gestures (nativeArrangementTimeline.tsx:142-148, :173-198): a drag pans the window, a press sets the marker.
  const gesture = view.gesture ?? {current: null}
  const pointAt = (clientX: number): number | null => {
    const box = view.marksRef?.current?.getBoundingClientRect()
    return box && box.width > 0 ? range.start + (clientX - box.left) / box.width * span : null
  }
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width <= 0) return
    gesture.current = {pointer: event.pointerId, startX: event.clientX, start: range, scale: box.width / span, moved: false}
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = gesture.current
    if (!active || event.pointerId !== active.pointer) return
    const dx = event.clientX - active.startX
    if (!active.moved && Math.abs(dx) <= 3) return
    active.moved = true
    view.onWindow(panBy(active.start, -dx / active.scale, bounds))
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = gesture.current
    if (!active || event.pointerId !== active.pointer) return
    gesture.current = null
    if (active.moved) return
    const at = pointAt(event.clientX)
    if (at !== null) view.onMarker(snapAt(at, snapOfPress(view.snap, event), markStep(range, bounds, view.width), bounds))
  }
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && view.marker !== null) { event.preventDefault(); view.onMarker(null); return }
    const next = windowOfKey(event.key, range, bounds, anchor)
    if (!next) return
    event.preventDefault()
    view.onWindow(next)
  }
  const marksProps = {
    ref: view.marksRef as RefObject<HTMLDivElement>,
    role: 'slider', tabIndex: 0,
    'aria-label': `Visible window of the ruler${set.ruler ? `, in ${set.ruler.unit}` : ''}`,
    'aria-valuemin': bounds.start, 'aria-valuemax': Math.max(bounds.start, bounds.end - span), 'aria-valuenow': range.start,
    'aria-valuetext': `${label(range.start)} to ${label(range.end)}`,
    title: 'Drag to pan · press to set the insert marker · ⌘/Ctrl-wheel or pinch to zoom · ←→ pan · ↑↓ zoom · Home or End to the ends',
  }
  // A line at the window's very end is held just inside it, and a readout past the middle reads back from its point, as a dash does.
  const lineAt = (at: number) => { const p = percentOf(held(at), range); return p >= 99.5 ? 'calc(100% - 2px)' : `${p}%` }
  const readoutAt = (at: number): CSSProperties => { const p = percentOf(at, range); return p > 70 ? {right: `calc(100% - ${p}%)`} : {left: `${p}%`} }
  const occasionReadout = occasion && light && <span className={`tl-occ-mark${occasionAt === undefined ? ' off' : percentOf(occasionAt, range) > 70 ? ' back' : ''}`} data-occasion={occasion.ref}
    style={occasionAt !== undefined ? readoutAt(occasionAt) : undefined}
    title={`Occasion · ${occasion.label}${occasion.year !== undefined ? ` · ${occasion.year}` : ''}${occasion.at === undefined ? ' · no clip of this work stands it on the ruler' : occasionAt === undefined ? ' · outside the window' : ''} · ${light.title}`}>
    occasion · {occasion.label.length > 28 ? `${occasion.label.slice(0, 28)}…` : occasion.label}
    <i className="tl-light" data-admission={light.state} aria-label={light.title} />
  </span>
  // The overview strip (catalogue dlw__arrangement-ruler.tsx FullRuler's `arp-over`): the whole ruler, thin, each placed clip a tick in its
  // track's colour at its track's height, and the window marked on it; a press centres the window on that moment. Its head carries the
  // ruler's scale: the set's unit, or, where the set has no ruler, that the rows are laid one after another (placeClips).
  const extent = Math.max(bounds.end - bounds.start, Number.EPSILON)
  const overAt = (at: number) => `${(held(at) - bounds.start) / extent * 100}%`
  const trackRow = new Map(set.tracks.map((track, index) => [track.id, index]))
  const scaleWord = set.ruler ? set.ruler.unit : 'rows in order'
  const overviewStrip = <div className="tl-lane tl-over" role="group" aria-label={`The whole ruler, in ${scaleWord}`}>
    <span className="tl-head tl-over-head" title={set.ruler ? `The ruler's scale: ${set.ruler.unit}` : 'No ruler: the Arrangement lays the rows one after another'}>
      <span className="tl-scale">{scaleWord}</span><small>whole ruler</small>
    </span>
    <div className="tl-over-body" title="The whole ruler · press to centre the window on that moment"
      onClick={event => {
        const box = event.currentTarget.getBoundingClientRect()
        if (box.width <= 0) return
        const at = bounds.start + (event.clientX - box.left) / box.width * extent
        view.onWindow(clampRange({start: at - span / 2, end: at + span / 2}, bounds))
      }}>
      {placed.map(({clip, start, end: to}) => {
        const track = trackOf.get(clip.trackId)
        return <i key={clip.id} data-over-clip={clip.id} style={{left: overAt(start), width: `max(2px, ${(held(to) - held(start)) / extent * 100}%)`,
          top: 2 + (trackRow.get(clip.trackId) ?? 0) * 2.6, ...(track ? {'--tc': trackColour(track)} : {})} as CSSProperties} />
      })}
      <i className="tl-over-win" data-fit={isFit(range, bounds) || undefined} style={{left: overAt(range.start), width: `${span / extent * 100}%`}} />
    </div>
  </div>
  const markerMark = marker !== undefined && <span className="tl-marker-mark" style={{left: lineAt(marker)}} title={`Insert marker at ${label(marker)} · the pane's own, snapped ${view.snap}; it writes no time to any owner`}>{label(marker)}</span>

  // A rail stands under its track in that track's colour; one with no placed stop stands after the tracks, uncoloured.
  const railLane = (rail: WalkRail, colour?: string) => {
    const total = rail.walk.stops.length
    const off = total - rail.placed
    return <div key={`rail:${rail.walk.id}`} className="tl-lane tl-rail" data-walk-row={rail.walk.id} data-walk-kind={rail.walk.kind} data-walk-derived={rail.walk.derived ? 'derived' : 'curated'}
      style={colour ? {'--tc': colour} as CSSProperties : undefined}>
      <span className="tl-head tl-rail-head" title={`${rail.walk.name} · ${railKindText(rail.walk)}${off ? ` · ${off} of ${total} ${total === 1 ? 'stop has' : 'stops have'} no place on this ruler` : ''}`}>
        <span className="tl-lane-name">{rail.walk.name}</span><small>{off ? `${rail.placed}/${total} placed` : `${total} ${total === 1 ? 'stop' : 'stops'}`}</small>
      </span>
      <div className="tl-body">
        {railSegments(rail).map((segment, i) => <i key={i} className="tl-rail-seg" style={{left: pct(segment.from), width: `${(held(segment.to) - held(segment.from)) / span * 100}%`}} aria-hidden="true" />)}
        {rail.stops.map(({stop, index, at}) => {
          if (at === undefined) return null
          const key = `stop:${rail.walk.id}:${index}`
          const words = `${index + 1}/${total} · ${railStopTitle(stop)}`
          return focusStop
            ? <button type="button" key={key} className="tl-stop" data-walk-stop={index + 1} data-stop-ref={stop.id} data-receipt={receipt?.key === key ? (receipt.ok ? 'ok' : 'refused') : undefined}
              style={{left: pct(at)}} title={`${words} · press to stand it (${focusStop.op})`} aria-label={`Stand stop ${index + 1} of ${total}: ${stop.label}`}
              onClick={() => onPress(key, `Stand ${stop.label}`, () => focusStop.run(rail.walk.id, index))}>{index + 1}</button>
            : <span key={key} className="tl-stop" data-walk-stop={index + 1} data-stop-ref={stop.id} style={{left: pct(at)}} title={`${words} · no stop focus: the owner gives none`}>{index + 1}</span>
        })}
      </div>
    </div>
  }

  const colourOf = (track: {color?: string}) => ({'--tc': track.color ?? 'var(--track-default, var(--bg-3))'}) as CSSProperties
  const receiptOn = (key: string) => receipt?.key === key ? (receipt.ok ? 'ok' : 'refused') : undefined
  // A point on a lane's body from the pointer: the body spans the same window as the ruler's marks.
  const bodyAt = (element: HTMLElement, clientX: number): number | null => {
    const box = element.getBoundingClientRect()
    return box.width > 0 ? range.start + (clientX - box.left) / box.width * span : null
  }

  // A take lane (Live cap 44–45): its name and its audition; a stretch dragged across it is the pane's choice, and Return copies it
  // into the main lane through the owner's comp. The stretch chosen and the take that stands are marked; nothing is copied here.
  const comp = set.actions?.comp, audition = set.actions?.audition
  const takeLane = (take: WorldTakeLane, colour: CSSProperties) => {
    const chosen = lanesView.take?.takeId === take.id && lanesView.take.trackId === take.trackId ? lanesView.take : null
    const stretch = chosen ? compRange(take, chosen.from, chosen.to) : null
    const auditionKey = `audition:${take.trackId}:${take.id}`, compKey = `comp:${take.trackId}:${take.id}`
    const press = () => { if (comp && stretch) onPress(compKey, `Comp ${take.name} ${label(stretch.start)} – ${label(stretch.end)}`, () => comp.run(take.trackId, take.id, stretch)) }
    return <div key={`take:${take.id}`} className="tl-lane tl-take" data-take={take.id} data-standing={take.standing ? 'true' : undefined} style={colour}>
      <span className="tl-head tl-take-head" title={`${take.name} · a take${take.standing ? ' · it stands' : ''} · select a stretch and press Return to copy it into the main lane`}>
        <span className="tl-lane-name">{take.name}</span>
        <button type="button" className="tl-audition" aria-label={`Audition ${take.name}`} disabled={!audition} data-receipt={receiptOn(auditionKey)}
          title={audition ? `Audition ${take.name} (${audition.op})` : 'Audition: the owner gives no op that plays a take alone'}
          onClick={() => { if (audition) onPress(auditionKey, `Audition ${take.name}`, () => audition.run(take.trackId, take.id)) }}><CutIcon name="play" size={10} /></button>
      </span>
      <div className="tl-body tl-take-body" tabIndex={0} role="group" aria-label={`Take ${take.name}`} data-receipt={receiptOn(compKey)}
        title={comp ? `Drag across the take to choose a stretch; Return copies it into the main lane (${comp.op})` : 'Comp: the owner gives no op that copies a stretch of a take into the main lane'}
        onPointerDown={event => { if (event.button !== 0) return; const at = bodyAt(event.currentTarget, event.clientX); if (at === null) return
          event.currentTarget.setPointerCapture?.(event.pointerId); lanesView.onTake({trackId: take.trackId, takeId: take.id, from: at, to: at}) }}
        onPointerMove={event => { if (!chosen || !(event.buttons & 1)) return; const at = bodyAt(event.currentTarget, event.clientX); if (at !== null) lanesView.onTake({...chosen, to: at}) }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); press() } else if (event.key === 'Escape' && chosen) { event.preventDefault(); lanesView.onTake(null) } }}>
        {take.spans.map((piece, i) => <span key={i} className="tl-take-span" style={{left: pct(piece.start), width: `max(4px, ${Math.max(0, held(piece.end) - held(piece.start)) / span * 100}%)`}}
          title={`${piece.label} · ${label(piece.start)} – ${label(piece.end)}`}>{piece.label}</span>)}
        {stretch && <span className="tl-take-sel" style={{left: pct(stretch.start), width: `${Math.max(0, held(stretch.end) - held(stretch.start)) / span * 100}%`}}
          title={`Chosen: ${label(stretch.start)} – ${label(stretch.end)} · press Return to copy it into the main lane`} aria-hidden="true" />}
      </div>
    </div>
  }

  // An event lane (Factory): a session's events of one kind, each a tick; clicked, it opens beside the ruler.
  const eventLane = (lane: WorldEventLane, colour: CSSProperties) => <div key={`events:${lane.id}`} className="tl-lane tl-events" data-event-lane={lane.id} data-event-kind={lane.kind} style={colour}>
    <span className="tl-head tl-events-head" title={`${lane.name} · ${lane.events.length} ${lane.events.length === 1 ? 'event' : 'events'}`}>
      <span className="tl-lane-name">{lane.name}</span><small>{lane.events.length}</small>
    </span>
    <div className="tl-body">
      {lane.events.map(event => <button type="button" key={event.id} className={`tl-event${lanesView.opened?.eventId === event.id && lanesView.opened.laneId === lane.id ? ' sel' : ''}`}
        data-event={event.id} style={{left: pct(event.at)}} title={`${event.label} · ${label(event.at)}`} aria-label={`${lane.name}: ${event.label}`}
        onClick={() => lanesView.onOpened({laneId: lane.id, eventId: event.id})} />)}
    </div>
  </div>
  const openedLane = lanesView.opened ? set.lanes?.events?.find(lane => lane.id === lanesView.opened!.laneId) : undefined
  const openedEvent = openedLane?.events.find(event => event.id === lanesView.opened!.eventId)

  // The Lanes setting (manual §16.6 settings table): Takes, Automation, Events, each On or Off; why a kind has nothing, beside it;
  // and Re-enable, lit while the owner counts parameters held off their automation by hand.
  const heldCount = set.lanes?.held
  const reenableAll = set.actions?.reenable
  const lanesBar = <div className="tl-lane tl-setbar" role="group" aria-label="Lanes">
    <span className="tl-head tl-setbar-head">Lanes</span>
    <div className="tl-body tl-setbar-body">
      {(['takes', 'automation', 'events'] as TrackLaneKind[]).map(kind => {
        const count = laneCount(set, kind), why = set.lanes?.absent?.[kind]
        return <button type="button" key={kind} className="tl-lanes-kind" data-lanes={kind} aria-pressed={lanesView.shown[kind]} data-count={count}
          title={`${LANE_WORD[kind]} · ${lanesView.shown[kind] ? 'On' : 'Off'} · ${count} ${count === 1 ? 'lane' : 'lanes'}${why ? ` · ${why}` : ''}`}
          onClick={() => lanesView.onShown({...lanesView.shown, [kind]: !lanesView.shown[kind]})}>{LANE_WORD[kind]}<small>{count}</small></button>
      })}
      {(heldCount !== undefined || reenableAll) && <button type="button" className={`tl-reenable${heldCount ? ' lit' : ''}`} disabled={!reenableAll || !heldCount} data-receipt={receiptOn('reenable')}
        title={heldCount === undefined ? 'Re-enable: the owner reports no count of values held by hand' : heldCount ? `Re-enable: ${heldCount} ${heldCount === 1 ? 'parameter is' : 'parameters are'} held off ${heldCount === 1 ? 'its' : 'their'} automation${reenableAll ? ` (${reenableAll.op})` : ''}` : 'Re-enable: nothing is held off its automation'}
        onClick={() => { if (reenableAll && heldCount) onPress('reenable', 'Re-enable', () => reenableAll.run()) }}>Re-enable</button>}
    </div>
  </div>

  return <div ref={view.rootRef as RefObject<HTMLDivElement>} className="tl" aria-label="Arrangement" data-tracks-view="arrangement" data-window={isFit(range, bounds) ? undefined : 'zoomed'}>
    <div className="tl-ruler" aria-label={`Ruler${set.ruler ? ` in ${set.ruler.unit}` : ''}`}>
      {rulerTools(view, range, bounds, anchor)}
      <div {...marksProps} className="tl-marks tl-window" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={() => { gesture.current = null }} onKeyDown={onKeyDown}>
        {marks.map(mark => <span key={mark.at} className={mark.end ? 'end' : undefined} style={{left: `${percentOf(mark.at, range)}%`}}>{label(mark.at)}</span>)}
        {occasionReadout}
        {markerMark}
      </div>
    </div>
    {(set.lanes || set.mixer) && lanesBar}
    {lanesOfSections.map(lane => <div key={`sections:${lane.layerId ?? ''}`} className="tl-lane tl-sections" data-section-layer={lane.layerId}
      style={{'--levels': lane.levels} as CSSProperties}>
      <span className="tl-head tl-sections-head" title={`${lane.name} · sections · nested`}><span className="tl-lane-name">{lane.name}</span><small>sections</small></span>
      <div className="tl-body">
        {lane.items.map(({section, depth}) => {
          const from = held(section.span.start), to = held(section.span.end)
          if (to < range.start || from > range.end) return null
          // A section that began before the window is drawn from the window's edge, so its name stays in view; it has no edge there.
          const shownFrom = Math.max(from, range.start), shownTo = Math.min(to, range.end)
          return <button type="button" key={section.id} className="tl-sect" data-section={section.id} data-depth={depth} data-before={from < range.start || undefined}
            style={{left: pct(shownFrom), width: `${Math.max(0, shownTo - shownFrom) / span * 100}%`, '--depth': depth, ...(section.atmosphere ? {'--atm': section.atmosphere} : {})} as CSSProperties}
            title={`${section.name} · ${label(section.span.start)} – ${label(section.span.end)} · press to fit the window to it`}
            onClick={() => view.onWindow(clampRange({start: from, end: to}, bounds))}>{section.name}</button>
        })}
      </div>
    </div>)}
    {mainLast(set.tracks).flatMap((track, position) => {
      const style = {'--tc': trackColour(track)} as CSSProperties
      const clips = placed.filter(p => p.clip.trackId === track.id)
      // A rail per level, in each ancestor's colour, as the Session draws them (manual §6).
      const rails = tree.ancestorsOf(track).map(trackColour)
      const stoppedNeedle = track.needle !== undefined && stalled.has(track.id)
      const age = stoppedNeedle && now !== undefined ? (set.ruler?.duration ?? plainDuration(set.ruler?.unit ?? ''))(Math.max(0, now - track.needle!)) : undefined
      const readout = stoppedNeedle ? `${track.name} · stalled${age ? ` ${age}` : ''}` : undefined
      // The head carries the track's mixer switches, as Live's Arrangement header does (cap 43); a head with none is the name alone.
      const cells = mixerCells(set, track, position).filter(cell => cell.id !== 'input' && cell.id !== 'output')
      const headName = <>
        {rails.length > 0 && <span className="rails" aria-hidden="true">{rails.map((colour, i) => <i key={i} style={{background: colour}} />)}</span>}
        {track.name}{track.lane ? <small>{SIDE_WORD[track.lane]}</small> : null}{track.main ? <small>Main</small> : null}</>
      const selectTrack = () => selection.select({kind: 'track', ref: track.id, title: track.name})
      // The track's own device, opened from its head (trackHeads.ts; §18.1: the world's Workspace).
      const device = trackHeadDevice(track.id)
      const under = lanesUnder(set, track.id, lanesView.shown)
      const comps = (set.lanes?.comp ?? []).filter(stretch => stretch.trackId === track.id)
      const takeName = (takeId: string) => set.lanes?.takes?.find(take => take.id === takeId)?.name ?? takeId
      return [<div key={track.id} className={`tl-lane${track.lane ? ` lane-${track.lane}` : ''}`} style={{...style, ...(rails.length ? {'--rails': rails.length} : {})} as CSSProperties} data-track={track.id} data-main={track.main ? 'true' : undefined} data-return={track.returns ? 'true' : undefined}>
        {cells.length || device
          ? <div className={`tl-head tl-track-head${selection.ref === track.id ? ' sel' : ''}`}>
            <button type="button" className="tl-name" title={`${track.name} · ${track.kind}`} onClick={selectTrack}>{headName}</button>
            <TrackDeviceButton device={device} track={track} selection={selection} />
            {cells.length > 0 && <MixerRow cells={cells} shown routes={false} trackId={track.id} receipt={receipt} onPress={onPress} />}
          </div>
          : <button type="button" className={`tl-head${selection.ref === track.id ? ' sel' : ''}`} title={`${track.name} · ${track.kind}`} onClick={selectTrack}>{headName}</button>}
        <div className="tl-body">
          {now !== undefined && <span className="tl-now" style={{left: pct(now)}} aria-hidden="true" />}
          {occasionAt !== undefined && <span className="tl-occ" style={{left: lineAt(occasionAt)}} aria-hidden="true" />}
          {marker !== undefined && <span className="tl-marker" style={{left: lineAt(marker)}} aria-hidden="true" />}
          {clips.map(({clip, start, end: stop}) => {
            const lengthless = !(stop > start)
            // A waiting clip with no length is a dash: nobody knows how long it will take. A point near the window's end (a dash,
            // or any clip with no length) reaches back from it instead of past the edge.
            const dash = clip.status === 'waiting' && lengthless
            const flip = lengthless && percentOf(held(start), range) > 85
            const word = clip.status ? STATUS_WORD[clip.status] : undefined
            const when = `${label(start)}${stop > start ? ` – ${label(stop)}` : ''}`
            const edge = clip.status === 'running' ? ' · no end is drawn: its needle is the edge' : dash ? ' · no length is drawn' : ''
            const mark = clipStandingMark(clip)
            const section = narrowestSectionOf(set, clip, trackOf.get(clip.trackId))
            const atmosphere = section?.atmosphere
            const width = `max(6px, ${((held(Math.max(stop, start)) - held(start)) / span) * 100}%)`
            const placeStyle: CSSProperties = dash ? (flip ? {right: `calc(100% - ${pct(start)})`} : {left: pct(start)}) : flip ? {right: `calc(100% - ${pct(start)})`, width} : {left: pct(start), width}
            return <button type="button" key={clip.id} data-clip={clip.id} data-clip-status={clip.status ?? 'undisclosed'}
              className={`tl-clip${clip.status ? ` ${clip.status}` : ''}${dash ? ' dash' : ''}${selection.ref === clip.id ? ' sel' : ''}`}
              style={{...placeStyle, ...(mark ? {borderLeft: clipStandingEdge(mark)} : {}), ...(atmosphere ? {'--atm': atmosphere} : {})} as CSSProperties}
              title={`${clip.label} · ${when}${word ? ` · ${word}` : ''}${edge}${clip.note ? ` · ${clip.note}` : ''}${clipStandingTitle(mark)}${section ? ` · in ${section.name}` : ''}`}
              {...clipStandingAttributes(mark)} data-section={section?.id} aria-label={mark ? clipAccessibleName(clip.label, mark) : undefined}
              onClick={() => selection.select({kind: 'clip', ref: clip.id, title: clip.label, track: clip.trackId})}>{dash ? `▸ ${clip.label}` : clip.label}{clipStandingTag(mark)}</button>
          })}
          {comps.map((stretch, i) => <span key={`comp:${i}`} className="tl-comp" data-comp-take={stretch.takeId}
            style={{left: pct(stretch.start), width: `${Math.max(0, held(stretch.end) - held(stretch.start)) / span * 100}%`}}
            title={`${label(stretch.start)} – ${label(stretch.end)} came from ${takeName(stretch.takeId)}`}>{takeName(stretch.takeId)}</span>)}
          {track.needle !== undefined && <span className="tl-needle" style={{left: pct(track.needle)}} data-stalled={stoppedNeedle ? 'true' : undefined} data-edge={percentOf(held(track.needle), range) > 60 ? 'end' : undefined}
            title={readout ?? `${track.name} has got to ${label(track.needle)}`}>{readout && <span className="tl-readout">{readout}</span>}</span>}
        </div>
      </div>,
      ...under.takes.map(take => takeLane(take, colourOf(track))),
      ...under.automation.map(lane => {
        const points = automationPoints(lane, clipId => placed.find(p => p.clip.id === clipId)?.start)
        const line = points.map(point => `${percentOf(point.at, range).toFixed(3)},${(100 - Math.min(1, Math.max(0, point.value)) * 100).toFixed(3)}`).join(' ')
        const reenable = set.actions?.reenable
        const key = `reenable:${lane.id}`
        return <div key={`auto:${lane.id}`} className="tl-lane tl-auto" data-automation={lane.id} data-overridden={lane.overridden ? 'true' : undefined} style={colourOf(track)}>
          <span className="tl-head tl-auto-head" title={`${lane.device} / ${lane.parameter}${lane.range ? ` · ${lane.range.min} – ${lane.range.max}` : ''}${lane.modulatedBy ? ` · moved by ${lane.modulatedBy}` : ''}${points.length ? ` · ${points.length} points` : ' · no points on this ruler'}`}>
            <span className="tl-lane-name">{lane.device} / {lane.parameter}</span>
            {lane.modulatedBy && <small className="tl-mod">{lane.modulatedBy}</small>}
            {lane.overridden && <button type="button" className="tl-reenable lit" disabled={!reenable} data-receipt={receipt?.key === key ? (receipt.ok ? 'ok' : 'refused') : undefined}
              title={reenable ? `Re-enable: give ${lane.parameter} back to its lane (${reenable.op})` : 'Re-enable: the owner gives no op that gives the value back'}
              onClick={() => { if (reenable) onPress(key, `Re-enable ${lane.parameter}`, () => reenable.run(lane.id)) }}>Re-enable</button>}
          </span>
          <div className="tl-body">
            {lane.modulatedBy && !points.length && <span className="tl-mod-band" aria-hidden="true" />}
            {points.length > 0 && <svg className="tl-auto-line" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${lane.device} / ${lane.parameter}: ${points.length} points`}>
              <polyline points={line} vectorEffect="non-scaling-stroke" />
            </svg>}
          </div>
        </div>
      }),
      ...under.events.map(lane => eventLane(lane, colourOf(track))),
      ...(railsUnder.get(track.id) ?? []).map(rail => railLane(rail, trackColour(track)))]
    })}
    {rails.filter(rail => rail.trackId === undefined).map(rail => railLane(rail))}
    {openedLane && openedEvent && <aside className="tl-event-open" role="dialog" aria-label={`${openedLane.name}: ${openedEvent.label}`} data-event={openedEvent.id}>
      <header><b>{openedLane.name}</b><span>{label(openedEvent.at)}</span>
        <button type="button" aria-label="Close" onClick={() => lanesView.onOpened(null)}>×</button></header>
      <p>{openedEvent.label}</p>
      {openedEvent.detail && <p className="tl-event-detail">{openedEvent.detail}</p>}
      {openedEvent.ref && <code>{openedEvent.ref}</code>}
    </aside>}
    {(receipt || left > 0) && <div className="tl-foot">
      {receipt && <p className="sg-receipt tl-receipt" role="status" data-ok={receipt.ok}>
        <b>{receipt.what}</b>
        <span title={receipt.text}>{receipt.text}</span>
        <button type="button" aria-label="Dismiss" onClick={onDismiss}>×</button>
      </p>}
      {left > 0 && <p className="tl-note" role="status">{left} {left === 1 ? 'clip has' : 'clips have'} no place on this ruler: its owner gives none. The Session grid holds {left === 1 ? 'it' : 'them'}.</p>}
    </div>}
    {overviewStrip}
    <RulerLegend set={set} stalled={stalled} now={now} />
  </div>
}

/** The states a clip lies in on the ruler, in the order the legend names them (dlw:arrangement-ruler's foot). */
const RULER_LEGEND = ['running', 'waiting', 'stopped', 'stalled'] as const
/** The ruler's legend (catalogue dlw__arrangement-ruler.tsx's foot): how each state lies on the ruler, and the lanes that have stalled, each
 * with how long since its needle stopped. */
function RulerLegend({set, stalled, now}: {set: WorldTrackSet; stalled: ReadonlySet<string>; now: number | undefined}) {
  const duration = set.ruler?.duration ?? plainDuration(set.ruler?.unit ?? '')
  const says = set.tracks.filter(track => track.needle !== undefined && stalled.has(track.id))
    .map(track => `${track.name} · stalled${now !== undefined ? ` ${duration(Math.max(0, now - track.needle!))}` : ''}`).join(' · ')
  return <footer className="sg-legend tl-legend" aria-label="Legend">
    {RULER_LEGEND.map(state => <span key={state} className="sg-key"><i data-status={state} />{STATUS_WORD[state]}</span>)}
    <span className="sg-says">{says || 'No lane has stalled'}</span>
  </footer>
}

/** The Arrangement: the view, with the state a ruler keeps — the window, the snap and the insert marker (the pane's
 * presentation, never the book's and never an owner's), and the owner's last answer to a rail's stop. */
export function ArrangementRuler({set, selection, empty}: {set: WorldTrackSet; selection: TracksSelection; empty?: string}) {
  // A mode naming its tracks' own devices again draws their head buttons (trackHeads.ts).
  useTrackHeadDevices()
  const [shown, setShown] = useState<TimeRange | null>(null)
  const [snap, setSnap] = useState<SnapMode>('grid')
  const [marker, setMarker] = useState<number | null>(null)
  const [width, setWidth] = useState(0)
  const [receipt, setReceipt] = useState<PressedReceipt | null>(null)
  const [shownLanes, setShownLanes] = useState<LanesShown>(DEFAULT_LANES)
  const [take, setTake] = useState<TakeSelection | null>(null)
  const [opened, setOpened] = useState<{laneId: string; eventId: string} | null>(null)
  const latest = useRef(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const marksRef = useRef<HTMLDivElement | null>(null)
  const gesture = useRef<RulerGesture | null>(null)
  const {end} = placeClips(set)
  const bounds = rangeBounds(end)
  const range = clampRange(shown ?? fitRange(bounds), bounds)
  // What the wheel and the pinch read, current at the event (they are bound once).
  const live = useRef({range, bounds})
  live.current = {range, bounds}

  // The marks' width, for the 64px floor and the wheel's pan scale (nativeArrangementTimeline.tsx:82-90).
  useEffect(() => {
    const node = marksRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const measure = () => setWidth(node.clientWidth)
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    return () => observer.disconnect()
  }, [set.tracks.length > 0])

  // The wheel (nativeArrangementTimeline.tsx:92-111): ⌘/Ctrl zooms about the pointer, sideways or Shift pans, a plain wheel
  // scrolls the lanes. WebKit's pinch arrives as gesture events, so it zooms through the same rule.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const apply = (next: TimeRange) => setShown(next)
    const anchorAt = (clientX: number): number | null => {
      const box = marksRef.current?.getBoundingClientRect()
      const {range: current} = live.current
      return box && box.width > 0 ? current.start + (clientX - box.left) / box.width * (current.end - current.start) : null
    }
    const onWheel = (event: WheelEvent) => {
      const {range: current, bounds: limits} = live.current
      if (event.ctrlKey || event.metaKey) {
        const anchor = anchorAt(event.clientX)
        if (anchor === null) return
        event.preventDefault()
        apply(zoomAround(current, anchor, wheelZoomFactor(event.deltaY), limits))
      } else if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        const box = marksRef.current?.getBoundingClientRect()
        if (!box || box.width <= 0) return
        event.preventDefault()
        apply(panBy(current, (event.deltaX || event.deltaY) / (box.width / (current.end - current.start)), limits))
      }
    }
    let pinch = 1
    const onGestureStart = (event: Event) => { pinch = 1; event.preventDefault() }
    const onGestureChange = (event: Event) => {
      const gesture = event as Event & {scale?: number; clientX?: number}
      if (typeof gesture.scale !== 'number' || !(gesture.scale > 0)) return
      event.preventDefault()
      const anchor = anchorAt(gesture.clientX ?? 0) ?? (live.current.range.start + live.current.range.end) / 2
      apply(zoomAround(live.current.range, anchor, gesture.scale / pinch, live.current.bounds))
      pinch = gesture.scale
    }
    root.addEventListener('wheel', onWheel, {passive: false})
    root.addEventListener('gesturestart', onGestureStart)
    root.addEventListener('gesturechange', onGestureChange)
    return () => {
      root.removeEventListener('wheel', onWheel)
      root.removeEventListener('gesturestart', onGestureStart)
      root.removeEventListener('gesturechange', onGestureChange)
    }
  }, [set.tracks.length > 0])

  const press = (key: string, what: string, run: () => unknown) => {
    const turn = ++latest.current
    setReceipt(null)
    void answerOf(run).then(answer => { if (answer && turn === latest.current) setReceipt({key, what, ...answer}) })
  }
  // Every object's acts, after Live's: its menu, Live's keys on the selection, rename in place (frame/menu/TracksMenu.tsx). The host
  // takes no room of its own: it holds the ruler's events, and the ruler keeps its own root.
  const menu = useTracksMenu({set, selection, view: 'arrangement', press})
  return <div className="tracks-menu-host" ref={menu.rootRef} onContextMenu={menu.onContextMenu} onKeyDown={menu.onKeyDown}>
    <ArrangementRulerView set={set} selection={selection} empty={empty} receipt={receipt} onPress={press}
      lanes={{shown: shownLanes, onShown: setShownLanes, take, onTake: setTake, opened, onOpened: setOpened}}
      onDismiss={() => { latest.current += 1; setReceipt(null) }}
      view={{window: shown, onWindow: setShown, snap, onSnap: setSnap, marker, onMarker: setMarker, width, marksRef, rootRef, gesture}} />
    {menu.layer}
  </div>
}
