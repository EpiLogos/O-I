// The atlas family's face bodies (DEVICE-SEMANTICS-LOCK §0.1.3, §8.1; ticket T-EVERY-MODE-INSTRUMENTS): the Technē 0
// instrument (the Earth and solar system, with its graph view) carries its full native controls on the Device side.
//
// Each body drives the SAME atlas state the Earth pane drives — the one mounted atlas (AtlasProjectionPanel.tsx
// `useAtlasHandle`), its controller, its deep-time model (state/timeModel.ts) and its globe engine. No body keeps a
// store of its own, and no control is re-implemented here: each calls the atlas's own method and re-reads the atlas's
// own state. The bodies re-render on the atlas's own change notices (the controller's `subscribeFaces`, the time
// model's `subscribe`), never on a poll.
//
// Before the atlas has mounted, a body names that and keeps no state of its own. The view choice is held by the
// atlas's mirror (presentAtlasView), exactly as the lens bar holds it, and taken when the atlas stands.
//
// The graph's controls are the constellation's own (graph/tools.ts GraphTools): the same setters, the same ranges,
// the same labels. The graph exists once the Graph view has first been shown; until then its body says so and offers
// the one act that opens it.

import {useEffect, useState, type ReactNode} from 'react'
import {presentAtlasView, useAtlasHandle, useAtlasView} from '../projections/atlas/AtlasProjectionPanel'
import type {AtlasHandle} from '../projections/atlas/mount'
import {FORCE_ROWS, forceMultiple} from '../projections/atlas/src/graph/forces'
import type {KindFlags} from '../projections/atlas/src/graph/settings'
import {formatYear} from '../projections/atlas/src/data/time'
import {allTime, playOrPause, resetForces, scrubClock, setForce, setWholeField, stepDepth, toggleCumulative, toggleKind, toggleOccurrences, toggleSky, toggleTie} from './atlasFaceActions'
import './atlasFaceBodies.css'

/** The four atlas faces whose bodies this module supplies (atlasFamilyManifest.ts). */
export const ATLAS_FACE_IDS = ['globe-engine', 'graph-tools', 'mode-switch', 'time-control'] as const
export type AtlasFaceId = (typeof ATLAS_FACE_IDS)[number]

export function isAtlasFaceId(id: string): id is AtlasFaceId {
  return (ATLAS_FACE_IDS as readonly string[]).includes(id)
}

/** The body of one atlas face, as the rack docks it when the face is expanded. */
export function AtlasFaceBody({faceId}: {faceId: AtlasFaceId}) {
  switch (faceId) {
    case 'mode-switch': return <AtlasModeSwitchBody/>
    case 'graph-tools': return <AtlasGraphToolsBody/>
    case 'time-control': return <AtlasTimeControlBody/>
    case 'globe-engine': return <AtlasGlobeBody/>
  }
}

/** The mounted atlas, re-read whenever the body shows something that may have changed: the deep-time clock, and the
 * controller's own notices (the graph's controls and its first opening, the globe's scope). */
function useAtlasLive(): AtlasHandle | null {
  const handle = useAtlasHandle()
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!handle) return
    const bump = () => setTick(n => n + 1)
    const offClock = handle.time.subscribe(bump)
    const offFaces = handle.ctl.subscribeFaces(bump)
    return () => {
      offClock()
      offFaces()
    }
  }, [handle])
  return handle
}

/** A body with no atlas to read yet: it names the face and what it waits for, and keeps no state. */
function AtlasNotice({faceId, children}: {faceId: AtlasFaceId; children: ReactNode}) {
  return (
    <div className="atlas-face" data-atlas-face={faceId} data-mounted="no">
      <p className="atlas-face-note" role="status">{children}</p>
    </div>
  )
}

// ── mode-switch: Earth ⇄ Graph ────────────────────────────────────────────

/** The atlas's one mode control, as the lens bar drives it: presentAtlasView, which the mounted atlas follows. */
function AtlasModeSwitchBody() {
  const handle = useAtlasLive()
  const view = useAtlasView()
  return (
    <div className="atlas-face" data-atlas-face="mode-switch" data-view={view} data-mounted={handle ? 'yes' : 'no'}>
      <div className="atlas-face-group" role="group" aria-label="Earth or Graph">
        <button type="button" className="atlas-face-choice" aria-pressed={view === 'earth'} onClick={() => presentAtlasView('earth')}>Earth</button>
        <button type="button" className="atlas-face-choice" aria-pressed={view === 'graph'} onClick={() => presentAtlasView('graph')}>Graph</button>
      </div>
      <p className="atlas-face-note">
        {handle
          ? 'The atlas’s own switch: the view the pane shows, the same one the G key and the lens bar choose.'
          : 'The Earth has not mounted in this session. The choice is held and taken when it does.'}
      </p>
    </div>
  )
}

// ── graph-tools: the constellation's own controls ─────────────────────────

const KIND_BUTTONS: readonly (readonly [keyof KindFlags, string])[] = [
  ['archetype', 'Archetypes'],
  ['theoretic', 'Theoretics'],
  ['family', 'Families'],
]

function skyNoteOf(sky: 'off' | 'loading' | 'on' | 'unavailable', asOf: string | undefined): string {
  if (sky === 'on') return `Bodies stand at their geocentric ecliptic longitudes, ${asOf ?? 'now'}. In a local graph they are ordinary neighbours.`
  if (sky === 'loading') return 'Loading the sky…'
  if (sky === 'unavailable') return 'The sky’s data is unavailable.'
  return ''
}

function AtlasGraphToolsBody() {
  const handle = useAtlasLive()
  if (!handle) return <AtlasNotice faceId="graph-tools">The constellation stands with the Earth pane. Its controls drive the graph the pane shows.</AtlasNotice>
  const graph = handle.ctl.graphControls
  if (!graph) {
    return (
      <div className="atlas-face" data-atlas-face="graph-tools" data-graph="unopened">
        <p className="atlas-face-note">The constellation has not been opened in this session. Its controls stand when the Graph view is first shown.</p>
        <button type="button" className="atlas-face-action" onClick={() => presentAtlasView('graph')}>Show the graph</button>
      </div>
    )
  }
  const c = graph.controls()
  const skyOn = c.sky === 'on' || c.sky === 'loading'
  const note = skyNoteOf(c.sky, c.skyAsOf)
  return (
    <div className="atlas-face" data-atlas-face="graph-tools" data-graph="open" data-local={c.local ? 'yes' : 'no'}>
      {c.local && (
        <div className="atlas-face-row">
          <span className="atlas-face-caption">Steps</span>
          <button type="button" className="atlas-face-step" aria-label="Fewer steps from the subject" disabled={c.depth <= 1} onClick={() => stepDepth(graph, -1)}>−</button>
          <span className="atlas-face-n">{c.depth}</span>
          <button type="button" className="atlas-face-step" aria-label="More steps from the subject" disabled={c.depth >= 3} onClick={() => stepDepth(graph, 1)}>+</button>
        </div>
      )}
      <div className="atlas-face-group" role="group" aria-label="What is drawn">
        <span className="atlas-face-caption">Kinds</span>
        <button type="button" className="atlas-face-filter" aria-pressed={c.dust} onClick={() => toggleOccurrences(graph)}>Occurrences</button>
        {KIND_BUTTONS.map(([kind, label]) => (
          <button key={kind} type="button" className="atlas-face-filter" aria-pressed={c.kinds[kind]}
            onClick={() => toggleKind(graph, kind)}>{label}</button>
        ))}
      </div>
      <div className="atlas-face-group" role="group" aria-label="Family to archetype relations">
        <span className="atlas-face-caption">Relations</span>
        {c.bases.map(basis => {
          const on = c.ties.includes(basis.id)
          return (
            <button key={basis.id} type="button" className="atlas-face-filter" aria-pressed={on}
              onClick={() => toggleTie(graph, basis.id)}>{basis.label}</button>
          )
        })}
      </div>
      <div className="atlas-face-group">
        <button type="button" className="atlas-face-filter" aria-pressed={skyOn} disabled={c.sky === 'loading'}
          onClick={() => toggleSky(graph)}>Sky anchors</button>
      </div>
      {note && <p className="atlas-face-note" role="status" aria-live="polite">{note}</p>}
      <div className="atlas-face-forces" aria-label="Forces">
        <span className="atlas-face-caption">Forces</span>
        {FORCE_ROWS.map(row => {
          const value = c.forces[row.key]
          return (
            <label key={row.key} className="atlas-face-force" title={row.tip}>
              <span>{row.label}</span>
              <output className="atlas-face-n">{`${forceMultiple(row.key, value).toFixed(2)}×`}</output>
              <input type="range" className="atlas-face-range" min={row.min} max={row.max} step={row.step} value={value} aria-label={`${row.label}: ${row.tip}`}
                onChange={e => setForce(graph, row.key, Number(e.target.value))}/>
            </label>
          )
        })}
        <button type="button" className="atlas-face-action" title="Restore the arrangement as drawn" onClick={() => resetForces(graph)}>Reset</button>
      </div>
      <button type="button" className="atlas-face-action" onClick={() => graph.reframe()}>Reframe graph</button>
    </div>
  )
}

// ── time-control: the atlas's deep-time scale ─────────────────────────────

/** The deep-time clock the Earth pane's time control reads: the same TimeModel instance, the same scale. */
function AtlasTimeControlBody() {
  const handle = useAtlasLive()
  if (!handle) return <AtlasNotice faceId="time-control">The deep-time scale stands with the Earth pane. Its controls drive the same clock once the Earth is mounted.</AtlasNotice>
  const clock = handle.time
  const scale = handle.model.scale
  const readout = clock.mode === 'cursor' ? formatYear(scale.fromU(clock.cursorU)) : 'All time'
  return (
    <div className="atlas-face" data-atlas-face="time-control" data-mode={clock.mode}>
      <p className="atlas-face-readout" aria-live="polite">{readout}</p>
      <input type="range" className="atlas-face-range" aria-label="Deep time" min={clock.fromU} max={clock.toU} step={0.0005} value={clock.cursorU}
        onChange={e => scrubClock(handle.ctl, clock, Number(e.target.value))}/>
      <div className="atlas-face-group">
        <button type="button" className="atlas-face-action" onClick={() => allTime(handle.ctl, clock)}>All time</button>
        <button type="button" className="atlas-face-action" aria-pressed={clock.playing} onClick={() => playOrPause(handle.ctl, clock)}>{clock.playing ? 'Pause' : 'Play'}</button>
        <button type="button" className="atlas-face-filter" aria-pressed={clock.cumulative} onClick={() => toggleCumulative(clock)}>Cumulative</button>
      </div>
    </div>
  )
}

// ── globe-engine: the globe's exposed parameters ──────────────────────────

/** The globe's own parameters, as the engine exposes them: the whole-field choice (the one control it offers) and the
 * base texture it stands at. Nothing else is a parameter of the globe, and the body says so. */
function AtlasGlobeBody() {
  const handle = useAtlasLive()
  if (!handle) return <AtlasNotice faceId="globe-engine">The globe stands with the Earth pane and is drawn once the pane is shown.</AtlasNotice>
  const {scope, wholeField} = handle.ctl.globeScope
  return (
    <div className="atlas-face" data-atlas-face="globe-engine" data-base={handle.engine.baseKind}>
      <p className="atlas-face-caption">Base texture <b className="atlas-face-n">{handle.engine.baseKind}</b></p>
      {scope
        ? (
          <div className="atlas-face-row">
            <span className="atlas-face-caption">{scope.label}</span>
            <button type="button" className="atlas-face-filter" aria-pressed={wholeField} onClick={() => setWholeField(handle.engine, !wholeField)}>Whole field</button>
          </div>
        )
        : <p className="atlas-face-note">No mode’s set is set aside on the globe, so there is no whole-field choice to make.</p>}
      <p className="atlas-face-note">
        The globe exposes no other parameter: its palette follows the field and its sun follows the sky. Zoom and pan are the pane’s own gestures.
      </p>
    </div>
  )
}
