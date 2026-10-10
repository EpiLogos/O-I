/**
 * The per-mode centre — the designed frame the World cut presents when the
 * mode's material is not readable yet (WORLD-SHELL-DESIGN Revision 5's
 * Session|Arrangement meanings; the widget guide's empty-state law: an
 * absent reading renders as a DESIGNED empty state at mockup density —
 * framed, labelled, with the affordance that would fill it visible — NEVER
 * a bare sentence floating in a void).
 *
 * What killed the audit's void: the centre's World cut rendered the
 * Timeline projection's bare one-line absence (`view-empty`) across an
 * empty pane. This composition replaces that state — per mode, per
 * presentation:
 *
 * - Base · Session — the day-as-clips frame: the five track columns (Day,
 *   Flows, Beings, Things, Goals) drawn as structure with named empty
 *   cells, and the unread-reading disclosure as a styled component INSIDE
 *   the frame.
 * - Base · Arrangement — today on one ruler: the hour ruler drawn, the
 *   day's clips named as the affordance that fills it.
 * - Technē · Session — the M3′ Journey: walk stops as rows (place ·
 *   occasion · artefact · narration), honestly empty until the journey
 *   owner lands.
 * - Technē · Arrangement — the M2′ Relation Field surface: the lens frame
 *   with the honest rows (the declared break, the four lenses' names) over
 *   the unread civil field.
 *
 * When the reading IS live the L4 presentation composes the centre (the
 * adapters own it); this frame then stands down — the App mounts it only
 * while the reading is absent or in flight. The disclosure names the read
 * that fills the frame (the kernel's temporal read) and keeps the
 * honesty boundaries: the retired native-access reading renders as the
 * designed waiting state, never fabricated content.
 *
 * Pure presentation over the grammar and the one temporal reading: no
 * store, no clock, no owner writes.
 */

import {MODE_GRAMMAR, type SurfMode} from './modeGrammar'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import './modeSurface.css'

/** The five Base session tracks (Rev 5's second table: "the day as clips:
 * Day, Flows, Beings, Things and Goals as tracks") — the mockup's column
 * heads, each naming the clip that would sit in its first cell. */
const BASE_SESSION_TRACKS = [
  {name: 'Day', clip: 'the day record — its document opens in the Document detail'},
  {name: 'Flows', clip: 'the day\'s flow documents (Dialogue · Flow · Journal)'},
  {name: 'Beings', clip: 'the day\'s being entries, with their bindings'},
  {name: 'Things', clip: 'the day\'s thing entries, with their bindings'},
  {name: 'Goals', clip: 'the day\'s goals lane'},
] as const

/** The Technē journey's columns (a walk stop: place · occasion · artefact ·
 * Expression · narration · transition). */
const JOURNEY_STOP_COLUMNS = ['Place', 'Occasion', 'Artefact', 'Narration', 'Transition'] as const

/** The Relation Field's honest rows — what the M2′ presentation composes
 * when the reading is live (the mockup's lens surface). */
const RELATION_FIELD_ROWS = [
  {name: 'Authored history', note: 'the deep-time half — the atlas non-linear scale, epochs as bands'},
  {name: 'Development', note: 'runs, revisions, machine NOWs — the reading\'s admitted material'},
  {name: 'The Day', note: 'the civil day\'s clips — returns, handoffs, clearings'},
  {name: 'Declared break', note: 'the break into today — deep history keeps 61%, today\'s hours the rest'},
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
    {presentation === 'arrangement' && mode === 'base' && <TodayRulerStructure />}
    {presentation === 'session' && mode === 'techne' && <JourneyStructure />}
    {presentation === 'arrangement' && mode === 'techne' && <RelationFieldStructure />}
    <div className="mode-centre-disclosure">
      <b>{state === 'reading' ? 'Reading the civil field…' : 'The civil field is unread'}</b>
      {reason && <span className="mode-centre-disclosure-reason"> — {reason}</span>}
      {' '}The Timeline projection presents World tracks only over a real reading: the kernel's temporal read fills this frame's{' '}
      {mode === 'base' ? (presentation === 'session' ? 'columns' : 'ruler') : (presentation === 'session' ? 'stops' : 'rows')}{' '}
      when it answers. The frame holds its place — designed, honest, empty.
    </div>
  </div>
}

/** Base · Session — the day as clips: the five track columns as structure,
 * the first cell naming the clip that would sit in it (empty slot ≠ dead
 * UI: the affordance is visible, not hover-only). */
function DayAsClipsStructure() {
  return <div className="mode-centre-structure mode-centre-day" aria-label="The day as clips — track structure">
    {BASE_SESSION_TRACKS.map(track => <div key={track.name} className="mode-centre-track" data-track={track.name}>
      <div className="mode-centre-track-head" data-i={`${track.name} track|${track.clip}`}>{track.name}</div>
      <button type="button" className="mode-centre-cell mode-centre-cell-named" data-i={`First clip of ${track.name}|${track.clip} — placed here when the civil field reads`}
        title={track.clip}>{track.clip}</button>
      <div className="mode-centre-cell mode-centre-cell-void" aria-hidden="true" />
      <div className="mode-centre-cell mode-centre-cell-void" aria-hidden="true" />
    </div>)}
  </div>
}

/** Base · Arrangement — today on one ruler: the hour ruler drawn, the day's
 * clips named as what fills it. */
function TodayRulerStructure() {
  const hours = [6, 9, 12, 15, 18, 21]
  return <div className="mode-centre-structure mode-centre-ruler" aria-label="Today on one ruler">
    <div className="mode-centre-ruler-row">
      {hours.map(hour => <span key={hour} className="mode-centre-tick" data-hour={hour}><i>{String(hour).padStart(2, '0')}:00</i></span>)}
    </div>
    <div className="mode-centre-ruler-lane">
      <span className="mode-centre-ruler-note" data-i="Today's clips|the day's documents and entries, placed at their civil instants">
        today's clips place here — the day opened, its entries, the close
      </span>
    </div>
  </div>
}

/** Technē · Session — the M3′ Journey: walk stops as rows. */
function JourneyStructure() {
  return <div className="mode-centre-structure mode-centre-journey" aria-label="M3′ Journey — walk stops">
    <div className="mode-centre-journey-heads">
      {JOURNEY_STOP_COLUMNS.map(column => <span key={column} className="mode-centre-track-head">{column}</span>)}
    </div>
    {[1, 2, 3].map(stop => <div key={stop} className="mode-centre-journey-row" data-stop={stop}>
      <span className="mode-centre-stop-chip" data-i={`Walk stop ${stop}|place · occasion · artefact · narration · transition — the walk's stops fill from the encounter`}>
        stop {stop}/8
      </span>
      {JOURNEY_STOP_COLUMNS.map(column => <span key={column} className="mode-centre-cell mode-centre-cell-void" aria-hidden="true" />)}
    </div>)}
    <p className="mode-centre-note">The walk's writers wait for the journey owner; the stops hold their places.</p>
  </div>
}

/** Technē · Arrangement — the M2′ Relation Field surface: the lens frame
 * with its honest rows. */
function RelationFieldStructure() {
  return <div className="mode-centre-structure mode-centre-relation" aria-label="M2′ Relation Field">
    <div className="mode-centre-lens-row" role="tablist" aria-label="Timeline lenses">
      {['chronology', 'concurrency', 'causal', 'recurrence'].map(lens => (
        <span key={lens} className="mode-centre-lens" data-lens={lens}>{lens}</span>
      ))}
    </div>
    {RELATION_FIELD_ROWS.map(row => <div key={row.name} className="mode-centre-relation-row" data-row={row.name}>
      <span className="mode-centre-relation-name" data-i={`${row.name}|${row.note}`}>{row.name}</span>
      <span className="mode-centre-relation-note">{row.note}</span>
      <span className="mode-centre-relation-lane" aria-hidden="true" />
    </div>)}
  </div>
}
