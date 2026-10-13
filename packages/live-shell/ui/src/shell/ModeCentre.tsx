/**
 * The per-mode centre — the designed frame the World cut presents when the
 * mode's material is not readable yet (WORLD-SHELL-DESIGN Revision 5's
 * Session|Arrangement meanings; the widget guide's empty-state law: an
 * absent reading renders as a DESIGNED empty state at mockup density —
 * framed, labelled, with the affordance that would fill it visible — NEVER
 * a bare sentence floating in a void).
 *
 * The four structures carry the mockups' own grammar at the mockups' density:
 *
 * - Base · Session — the day as clips (world-shell-mockup-base-session): five
 *   track columns with colour identity (Day steel · Flows teal · Beings
 *   green · Things gold · Goals violet), a named first clip per track, the
 *   eight-slot rhythm with soft-stop squares, and the per-track stop row.
 * - Base · Arrangement — today on one ruler: the hour ruler drawn full
 *   width, the day window as a band only when the Central owner's reading
 *   gives the day's bounds (no hours are set — DEVICE-SEMANTICS-LOCK §0, §4.7), the now
 *   needle ONLY when the civil read answers (a reading, never a wall clock),
 *   and the day's material as named lanes.
 * - Technē · Session — the M3′ Journey (world-shell-mockup-r2-scenes): the
 *   walk-stop rows at the mockup's scene-row grammar — place · occasion ·
 *   artefact · Expression · narration · transition in the mockup's column
 *   colours. The walks are the ones the World's track sets carry (the same
 *   objects the Timeline reads); with none carried, eight designed slots hold
 *   their places and the absence is named.
 * - Technē · Arrangement — the M2′ Relation Field: the four lenses in the
 *   design's order (chronology · causal · recurrence · concurrency), the
 *   honest lanes (authored history, development, the day, machines · NOW,
 *   FieldNow), the declared break drawn as a break, and the epistemic
 *   standing chip vocabulary (fact · claim · inferred · disputed · ghost).
 *
 * When the reading IS live the L4 presentation composes the centre (the
 * adapters own it); this frame then stands down — the App mounts it only
 * while the reading is absent or in flight. The unread-reading disclosure
 * is styled INSIDE every frame — never a floating sentence.
 *
 * Pure presentation over the grammar and the one temporal reading: no
 * store, no clock, no owner writes.
 */

import {useState, type CSSProperties} from 'react'
import {MODE_GRAMMAR, type SurfMode} from './modeGrammar'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import {journeyStopCells, journeyWalksOf, walkStopFocus} from '../timeline/journeyWalks'
import {applyWalkStopFocus} from '../timeline/walkFocus'
import type {TemporalEventRow} from '../timeline/timeSpine'
import type {WorldWalk, WorldWalkStop} from '../timeline/worldTrackAdapter'
import './modeSurface.css'

/** The five Base session tracks (Rev 5's second table) with the mockup's
 * colour identity and clip names — short names in the cell, the full line
 * in the tooltip (a clip cell carries a name, not a sentence). */
const BASE_SESSION_TRACKS = [
  {name: 'Day', colour: 'var(--mode-day)', clip: 'the day record', clipNote: 'the day record — its document opens in the Document detail'},
  {name: 'Flows', colour: 'var(--mode-flows)', clip: 'the day\'s flow', clipNote: 'the day\'s flow documents (Dialogue · Flow · Journal)'},
  {name: 'Beings', colour: 'var(--mode-beings)', clip: 'being entries', clipNote: 'the day\'s being entries, with their bindings'},
  {name: 'Things', colour: 'var(--mode-things)', clip: 'thing entries', clipNote: 'the day\'s thing entries, with their bindings'},
  {name: 'Goals', colour: 'var(--mode-goals)', clip: 'the goals lane', clipNote: 'the day\'s goals lane'},
] as const

/** The day's slots per track: one named clip, then soft-stop squares — the
 * mockup's session rhythm (empty slot ≠ dead UI; its square soft-stops). */
const SESSION_SLOTS = 7

/** The journey's stop columns — a walk stop is place · occasion · artefact ·
 * Expression · narration · transition (the mockup's own six). */
const JOURNEY_STOP_COLUMNS = [
  {name: 'Place', colour: 'var(--mode-place)'},
  {name: 'Occasion', colour: 'var(--mode-occasion)'},
  {name: 'Artefact', colour: 'var(--mode-artefact)'},
  {name: 'Expression', colour: 'var(--mode-expression)'},
  {name: 'Narration', colour: 'var(--mode-narration)'},
  {name: 'Transition', colour: 'var(--mode-transition)'},
] as const

/** The walk's eight stops (the transport's own reading: "stop n/8"). */
const WALK_STOPS = [1, 2, 3, 4, 5, 6, 7, 8] as const

/** The Relation Field's honest lanes — what the M2′ presentation composes
 * (the design's Rev 2: authored history beside development — runs,
 * revisions, the Day, machine NOWs, FieldNow). */
const RELATION_FIELD_ROWS = [
  {name: 'Authored history', note: 'the deep-time half — the atlas non-linear scale, epochs as bands', standing: null},
  {name: 'Development', note: 'runs, revisions, machine NOWs — the reading\'s admitted material', standing: 'run'},
  {name: 'The Day', note: 'the civil day\'s clips — returns, handoffs, clearings', standing: 'fact'},
  {name: 'Machines · NOW', note: 'each machine\'s own NOW reading, placed as it lands', standing: 'live'},
  {name: 'FieldNow', note: 'the field\'s presence — other Worlds arriving', standing: 'claim'},
] as const

/** The epistemic standings (the design's Rev 2 + the cut's edge grammar):
 * placement never upgrades standing. */
const STANDINGS = [
  {name: 'fact', title: 'fact — solid'},
  {name: 'claim', title: 'claim — violet, dashed'},
  {name: 'inferred', title: 'inferred — dotted'},
  {name: 'disputed', title: 'disputed — red, broken, crossed'},
  {name: 'ghost', title: 'ghost — an unresolved link, shown honestly'},
] as const

export function ModeCentreFrame({mode, presentation, world}: {
  mode: SurfMode
  presentation: 'session' | 'arrangement'
  /** The World cut's one temporal reading — the frame discloses its state
   * honestly and never invents what it does not carry. */
  world: WorldTimelineView | null
}) {
  const grammar = MODE_GRAMMAR[mode]
  const centre = grammar.centre[presentation]
  const source = world?.source
  const state = source?.status === 'live' ? 'live'
    : source?.status === 'reading' ? 'reading'
    : source?.status === 'unavailable' ? 'unavailable'
    : 'no-reading'
  const reason = source && source.status !== 'live' ? source.error ?? null : null
  const fills = mode === 'base' ? (presentation === 'session' ? 'columns' : 'ruler') : (presentation === 'session' ? 'stops' : 'rows')
  return <div className="mode-centre" data-mode-centre={mode} data-presentation={presentation} data-reading={state} role="status">
    <header className="mode-centre-head">
      <strong>{centre.label}</strong>
      <span className="mode-centre-meaning">{centre.meaning}</span>
      <span className="mode-centre-read" data-reading-state={state}>
        {state === 'live' ? 'the civil field reads'
          : state === 'reading' ? 'reading the civil field…'
          : 'the civil field is unread'}
      </span>
    </header>
    {presentation === 'session' && mode === 'base' && <DayAsClipsStructure />}
    {presentation === 'arrangement' && mode === 'base' && <TodayRulerStructure world={world} />}
    {presentation === 'session' && mode === 'techne' && <JourneyStructure world={world} />}
    {presentation === 'arrangement' && mode === 'techne' && <RelationFieldStructure />}
    <div className="mode-centre-disclosure">
      <b>{state === 'reading' ? 'Reading the civil field…' : 'The civil field is unread'}</b>
      {reason && <span className="mode-centre-disclosure-reason"> — {reason}</span>}
      {' '}The Timeline projection presents World tracks only over a real reading: the kernel's temporal read fills this frame's{' '}
      {fills}{' '}
      when it answers. The frame holds its place — designed, honest, empty.
    </div>
  </div>
}

/** Base · Session — the day as clips: five coloured track columns at the
 * mockup's session rhythm (named first clip, soft-stop squares, stop row). */
function DayAsClipsStructure() {
  return <div className="mode-centre-structure mode-centre-day" aria-label="The day as clips — track structure">
    {BASE_SESSION_TRACKS.map(track => <div key={track.name} className="mode-centre-track" data-track={track.name} style={{'--tc': track.colour} as CSSProperties}>
      <div className="mode-centre-track-head" data-i={`${track.name} track|${track.clipNote}`}>{track.name}</div>
      <button type="button" className="mode-centre-cell mode-centre-cell-named" data-i={`First clip of ${track.name}|${track.clipNote} — placed here when the civil field reads`}
        title={track.clipNote}>
        <span className="mode-centre-tri" aria-hidden="true" /><span className="mode-centre-cell-name">{track.clip}</span>
      </button>
      {Array.from({length: SESSION_SLOTS}, (_, slot) => <div key={slot} className="mode-centre-cell mode-centre-cell-void" aria-hidden="true">
        <span className="mode-centre-soft" data-i={`Empty slot of ${track.name}|its square stops the track after the current entry — soft stop. Double-click writes an entry once the civil field reads.`} />
      </div>)}
      <div className="mode-centre-stoprow" aria-hidden="true">
        <span className="mode-centre-stop-hard" data-i={`${track.name} hard stop|stops the track now and keeps what was written as a draft`} />
        <span className="mode-centre-stop-retry" data-i={`${track.name} retry|restarts from the last good step — lit only when a lane in here has stalled`}>↻</span>
        <span className="mode-centre-stop-chip" />
      </div>
    </div>)}
  </div>
}

/** The ruler spans the civil day. The day's own bounds — when it opened and
 * its automated closure — are the Central owner's (DEVICE-SEMANTICS-LOCK §0,
 * §4.7): the band is drawn only over the owner's reading, never from hours
 * typed here. `dayBounds` stays null until the civil reading carries them. */
const RULER = {spanStart: 0, spanEnd: 24} as const
const at = (hour: number) => `${((hour - RULER.spanStart) / (RULER.spanEnd - RULER.spanStart) * 100).toFixed(3)}%`

/** Base · Arrangement — today on one ruler: the hour ruler drawn full
 * width, the day window as a band, the now needle only over a real
 * reading, and the day's material as named lanes. */
function TodayRulerStructure({world}: {world: WorldTimelineView | null}) {
  const source = world?.source
  const now = source?.status === 'live' ? source.now : null
  const nowHour = now?.instantUnixMs != null ? new Date(now.instantUnixMs).getHours() + new Date(now.instantUnixMs).getMinutes() / 60 : null
  const inSpan = nowHour != null && nowHour >= RULER.spanStart && nowHour <= RULER.spanEnd
  // the owner's day bounds (opened · closes), in hours; null until the civil reading gives them
  const dayBounds = null as {open: number; close: number} | null
  const hours: number[] = []
  for (let hour = RULER.spanStart; hour <= RULER.spanEnd; hour += 2) hours.push(hour)
  return <div className="mode-centre-structure mode-centre-ruler" aria-label="Today on one ruler">
    <div className="mode-centre-ruler-row">
      {hours.map(hour => <span key={hour} className="mode-centre-tick" data-hour={hour} style={{left: at(hour)}}><i>{String(hour).padStart(2, '0')}:00</i></span>)}
      {dayBounds && <span className="mode-centre-window" style={{left: at(dayBounds.open), width: `calc(${at(dayBounds.close)} - ${at(dayBounds.open)})`}}
        data-i="The day window|when the day opened and its automated closure — the Central owner's reading" />}
      {nowHour != null && inSpan && <span className="mode-centre-now" style={{left: at(nowHour)}}
        data-i="Now|the civil instant from the kernel's own temporal read — never the wall clock" />}
    </div>
    <div className="mode-centre-ruler-lanes">
      {[
        {name: 'documents', note: 'the day record and its flow documents, at their civil instants'},
        {name: 'entries', note: 'beings, things and goals entries as they are made'},
        {name: 'returns · handoffs', note: 'the day\'s NOW returns and handoffs'},
        {name: 'the close', note: 'the day\'s automated closure lands here, when the Central owner closes it'},
      ].map(lane => <div key={lane.name} className="mode-centre-ruler-lane" data-lane={lane.name}>
        <span className="mode-centre-ruler-lane-name">{lane.name}</span>
        <span className="mode-centre-ruler-note" data-i={`Today's ${lane.name}|${lane.note} — placed when the civil field reads`}>
          {lane.note} place here
        </span>
      </div>)}
    </div>
  </div>
}

/** The clip-to-occasion map when no World reading is bound (the frame then shows no walks at all). */
const NO_OCCASIONS: ReadonlyMap<string, TemporalEventRow> = new Map()

/** Technē · Session — the M3′ Journey at the mockup's scene-row grammar. The walks are the ones the World's track sets
 * carry (the same objects the Timeline reads): each walk is a block of scene rows, each stop a row whose cells are the
 * six coloured columns. A stop focuses the occasion the Timeline would focus for its clip. With no walk carried, the
 * eight designed slots hold their places and the absence is named. */
function JourneyStructure({world}: {world: WorldTimelineView | null}) {
  const [named, setNamed] = useState<string | null>(null)
  const walks = journeyWalksOf(world?.source.sets ?? [])
  // A stop focuses what the Timeline would focus for it: its occasion, or its layer's epoch in the atlas (the atlas owns
  // its camera), or the named reason it cannot.
  const focusStop = (walk: WorldWalk, stop: WorldWalkStop) => {
    const focus = walkStopFocus(walk, stop, world?.source.eventByClipId ?? NO_OCCASIONS)
    void applyWalkStopFocus(focus, (event) => world?.selectOccasion(event)).then(setNamed)
  }
  return <div className="mode-centre-structure mode-centre-journey" aria-label="Journey — walk stops" data-provenance="M3′" data-walks={walks.length}>
    <div className="mode-centre-journey-heads">
      <span className="mode-centre-track-head mode-centre-launcher-head">The walk</span>
      {JOURNEY_STOP_COLUMNS.map(column => <span key={column.name} className="mode-centre-track-head" style={{'--tc': column.colour} as CSSProperties}>{column.name}</span>)}
    </div>
    {walks.length === 0 && WALK_STOPS.map(stop => <div key={stop} className="mode-centre-journey-row" data-stop={stop}>
      <span className="mode-centre-stop-chip" data-i={`Walk stop ${stop}|place · occasion · artefact · Expression · narration · transition — the walk's stops fill from the encounter; ▶ walks it`}>
        {stop} ·
      </span>
      {JOURNEY_STOP_COLUMNS.map(column => <span key={column.name} className="mode-centre-cell mode-centre-cell-void" aria-hidden="true">
        <span className="mode-centre-soft" />
      </span>)}
    </div>)}
    {walks.map(walk => <div key={walk.id} className="mode-centre-journey-walk" data-walk={walk.id} data-walk-kind={walk.kind} data-walk-derived={walk.derived ? 'derived' : 'curated'}>
      <div className="mode-centre-journey-walkhead">
        <strong>{walk.name}</strong>
        <span>{walk.kind}</span>
        <span>{walk.derived ? 'derived on read' : 'curated'}</span>
        <span>{walk.stops.length} {walk.stops.length === 1 ? 'stop' : 'stops'}</span>
      </div>
      {walk.stops.map((stop, index) => {
        const cells = journeyStopCells(stop)
        const values = [cells.place, cells.occasion, cells.artefact, cells.expression, null, null]
        return <div key={`${walk.id}:${index}`} className="mode-centre-journey-row" data-stop={index + 1} data-stop-ref={stop.id}>
          <button type="button" className="mode-centre-stop-chip mode-centre-journey-stop" onClick={() => focusStop(walk, stop)}
            data-i={`Walk stop ${index + 1} of ${walk.stops.length}|${stop.label}${cells.also ? ` — ${cells.also} attached reached from this stop` : ''}. A click focuses the stop: its occasion on the Timeline, or its epoch in the atlas.`}>
            {index + 1}/{walk.stops.length}
          </button>
          {JOURNEY_STOP_COLUMNS.map((column, i) => <JourneyCell key={column.name} column={column} value={values[i]} />)}
        </div>
      })}
    </div>)}
    <div className="mode-centre-journey-record">
      <button type="button" className="mode-centre-record" data-i="Record a walk|● records a new walk from your encounters — each becomes a stop">
        ● record a walk
      </button>
    </div>
    {walks.length === 0
      ? <p className="mode-centre-note">The atlas reading carries no walks in the World's track sets; the stops hold their places. Aion walks join when the Earth pane has loaded its reading.</p>
      : <p className="mode-centre-note">The walks the World's track sets carry — the same walks the Timeline reads.</p>}
    {named && <p className="mode-centre-journey-named" role="status">{named}</p>}
  </div>
}

/** One Journey cell: the value a stop carries, or the soft void of a column it does not carry (named on hover). */
function JourneyCell({column, value}: {column: (typeof JOURNEY_STOP_COLUMNS)[number]; value: string | null}) {
  if (value === null) return <span className="mode-centre-cell mode-centre-cell-void" data-i={`${column.name}|not carried by this stop`}>
    <span className="mode-centre-soft" />
  </span>
  return <span className="mode-centre-cell mode-centre-cell-named" style={{'--tc': column.colour} as CSSProperties} title={value}>
    <span className="mode-centre-cell-name">{value}</span>
  </span>
}

/** Technē · Arrangement — the M2′ Relation Field: the lenses in the
 * design's order, the honest lanes, the declared break, the standings. */
function RelationFieldStructure() {
  return <div className="mode-centre-structure mode-centre-relation" aria-label="Timeline" data-provenance="M2′">
    <div className="mode-centre-lens-row" role="tablist" aria-label="Timeline lenses">
      {['chronology', 'causal', 'recurrence', 'concurrency'].map(lens => (
        <span key={lens} className="mode-centre-lens" data-lens={lens}>{lens}</span>
      ))}
    </div>
    <div className="mode-centre-break" data-i="The declared break|deep history keeps 61% of the ruler, today's hours the rest — the break is declared, never hidden">
      <span>the declared break into today</span>
    </div>
    {RELATION_FIELD_ROWS.map(row => <div key={row.name} className="mode-centre-relation-row" data-row={row.name}>
      <span className="mode-centre-relation-name" data-i={`${row.name}|${row.note}`}>{row.name}</span>
      <span className="mode-centre-relation-note">{row.note}</span>
      <span className="mode-centre-relation-lane" aria-hidden="true" />
      {row.standing && <span className={`mode-centre-standing mode-centre-standing-${row.standing}`} data-i={`${row.name} · standing|clips draw in their epistemic standing — placement never upgrades it`}>{row.standing}</span>}
    </div>)}
    <div className="mode-centre-standing-legend" aria-label="Epistemic standings">
      <span className="mode-centre-legend-title">standings</span>
      {STANDINGS.map(standing => <span key={standing.name} className={`mode-centre-standing mode-centre-standing-${standing.name}`} title={standing.title}>{standing.name}</span>)}
    </div>
  </div>
}
