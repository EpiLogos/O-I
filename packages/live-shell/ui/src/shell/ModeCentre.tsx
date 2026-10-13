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
 *   colours, eight stops, and the scene-launcher column (stops 1–8, record
 *   a walk).
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

import type {CSSProperties} from 'react'
import {MODE_GRAMMAR, type SurfMode} from './modeGrammar'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
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
    {presentation === 'session' && mode === 'techne' && <JourneyStructure />}
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

/** Technē · Session — the M3′ Journey at the mockup's scene-row grammar:
 * six coloured stop columns, eight stops, the scene-launcher column. */
function JourneyStructure() {
  return <div className="mode-centre-structure mode-centre-journey" aria-label="Journey — walk stops" data-provenance="M3′">
    <div className="mode-centre-journey-heads">
      <span className="mode-centre-track-head mode-centre-launcher-head">The walk</span>
      {JOURNEY_STOP_COLUMNS.map(column => <span key={column.name} className="mode-centre-track-head" style={{'--tc': column.colour} as CSSProperties}>{column.name}</span>)}
    </div>
    {WALK_STOPS.map(stop => <div key={stop} className="mode-centre-journey-row" data-stop={stop}>
      <span className="mode-centre-stop-chip" data-i={`Walk stop ${stop}|place · occasion · artefact · Expression · narration · transition — the walk's stops fill from the encounter; ▶ walks it`}>
        {stop} ·
      </span>
      {JOURNEY_STOP_COLUMNS.map(column => <span key={column.name} className="mode-centre-cell mode-centre-cell-void" aria-hidden="true">
        <span className="mode-centre-soft" />
      </span>)}
    </div>)}
    <div className="mode-centre-journey-record">
      <button type="button" className="mode-centre-record" data-i="Record a walk|● records a new walk from your encounters — each becomes a stop">
        ● record a walk
      </button>
    </div>
    <p className="mode-centre-note">The walk's writers wait for the journey owner; the stops hold their places.</p>
  </div>
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
