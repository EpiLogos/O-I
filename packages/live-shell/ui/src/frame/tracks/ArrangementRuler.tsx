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
import {useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject} from 'react'
import type {WorldTrackClip, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import {answerOf, STATUS_WORD, stalledLanes, trackColour, trackTree, type PressedReceipt, type TracksSelection} from './SessionGrid'
import {clipAccessibleName, clipStandingAttributes, clipStandingEdge, clipStandingMark, clipStandingTag, clipStandingTitle} from './trackMarks'
import {narrowestSectionOf, sectionLanes} from './trackSections'
import {railKindText, railSegments, railStopTitle, walkRails, type WalkRail} from './trackRails'
import {occasionLight} from './worldCutTracks'
import {
  clampRange, fitRange, isFit, markStep, nextSnap, panBy, percentOf, rangeBounds, snapAt, snapOfPress, wheelZoomFactor, windowMarks,
  windowOfKey, zoomAround, type SnapMode, type TimeRange,
} from './rulerWindow'
import './tracks.css'

interface Placed {clip: WorldTrackClip; start: number; end: number}
/** A grouped track's two sides, as the ruler names them (lock §9.3: sight and sound of one state). */
const LANE_WORD = {visual: 'sight', audio: 'sound'} as const

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

export interface ArrangementRulerViewProps {
  set: WorldTrackSet
  selection: TracksSelection
  empty?: string
  view: RulerWindowProps
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

export function ArrangementRulerView({set, selection, empty, view, receipt, onPress, onDismiss}: ArrangementRulerViewProps) {
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
    {set.tracks.flatMap(track => {
      const style = {'--tc': trackColour(track)} as CSSProperties
      const clips = placed.filter(p => p.clip.trackId === track.id)
      // A rail per level, in each ancestor's colour, as the Session draws them (manual §6).
      const rails = tree.ancestorsOf(track).map(trackColour)
      const stoppedNeedle = track.needle !== undefined && stalled.has(track.id)
      const age = stoppedNeedle && now !== undefined ? (set.ruler?.duration ?? plainDuration(set.ruler?.unit ?? ''))(Math.max(0, now - track.needle!)) : undefined
      const readout = stoppedNeedle ? `${track.name} · stalled${age ? ` ${age}` : ''}` : undefined
      return [<div key={track.id} className={`tl-lane${track.lane ? ` lane-${track.lane}` : ''}`} style={{...style, ...(rails.length ? {'--rails': rails.length} : {})} as CSSProperties} data-track={track.id}>
        <button type="button" className={`tl-head${selection.ref === track.id ? ' sel' : ''}`} title={`${track.name} · ${track.kind}`}
          onClick={() => selection.select({kind: 'track', ref: track.id, title: track.name})}>
          {rails.length > 0 && <span className="rails" aria-hidden="true">{rails.map((colour, i) => <i key={i} style={{background: colour}} />)}</span>}
          {track.name}{track.lane ? <small>{LANE_WORD[track.lane]}</small> : null}</button>
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
          {track.needle !== undefined && <span className="tl-needle" style={{left: pct(track.needle)}} data-stalled={stoppedNeedle ? 'true' : undefined} data-edge={percentOf(held(track.needle), range) > 60 ? 'end' : undefined}
            title={readout ?? `${track.name} has got to ${label(track.needle)}`}>{readout && <span className="tl-readout">{readout}</span>}</span>}
        </div>
      </div>, ...(railsUnder.get(track.id) ?? []).map(rail => railLane(rail, trackColour(track)))]
    })}
    {rails.filter(rail => rail.trackId === undefined).map(rail => railLane(rail))}
    {receipt && <p className="sg-receipt tl-receipt" role="status" data-ok={receipt.ok}>
      <b>{receipt.what}</b>
      <span>{receipt.text}</span>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>×</button>
    </p>}
    {left > 0 && <p className="tl-note" role="status">{left} {left === 1 ? 'clip has' : 'clips have'} no place on this ruler: its owner gives none. The Session grid holds {left === 1 ? 'it' : 'them'}.</p>}
  </div>
}

/** The Arrangement: the view, with the state a ruler keeps — the window, the snap and the insert marker (the pane's
 * presentation, never the book's and never an owner's), and the owner's last answer to a rail's stop. */
export function ArrangementRuler({set, selection, empty}: {set: WorldTrackSet; selection: TracksSelection; empty?: string}) {
  const [shown, setShown] = useState<TimeRange | null>(null)
  const [snap, setSnap] = useState<SnapMode>('grid')
  const [marker, setMarker] = useState<number | null>(null)
  const [width, setWidth] = useState(0)
  const [receipt, setReceipt] = useState<PressedReceipt | null>(null)
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
  return <ArrangementRulerView set={set} selection={selection} empty={empty} receipt={receipt} onPress={press}
    onDismiss={() => { latest.current += 1; setReceipt(null) }}
    view={{window: shown, onWindow: setShown, snap, onSnap: setSnap, marker, onMarker: setMarker, width, marksRef, rootRef, gesture}} />
}
