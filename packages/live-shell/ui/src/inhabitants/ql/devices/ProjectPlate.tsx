// The M0′ Project instrument, open on the rack: one plate for the Earth and solar system with its graph (lock §0.1.3, §8.1 "the Technē 0
// instrument … carries its full native controls on the Device side"; the mockup's M0 plate, world-shell-mockup.html:1456 — Whole (depth,
// budget), View (list · tree · graph · form, kinds, ghosts), Source; manual §17.3's grammar, Whole: "Reach, Filters, Display, Groups").
// Before, M0′ stood as its families' plate: three boxed sub-devices (the globe, Graph tools, Earth ⇄ Graph) and the deep-time clock, each
// its own plate inside a column. Here their parameters are the plate's own sections, drawn in the device craft (docs/dlw/DLW.md §16;
// the panel kit, inhabitants/sdk/panel.tsx, and frame/devices/plateControls.tsx): the view and the scope as switches, the graph's reach
// and what it draws as switches, its four forces as dials, the clock as a value box with its keys.
//
// Ported, not recreated: every control is the face bodies' own act (inhabitants/atlasFaceBodies.tsx :74-221) through the same handlers
// (inhabitants/atlasFaceActions.ts — stepDepth's setter, toggleKind, toggleTie, toggleOccurrences, toggleSky, setForce, resetForces,
// scrubClock, allTime, playOrPause, toggleCumulative, setWholeField; the view through presentAtlasView, the lens bar's), each read back
// from the one mounted atlas on its own notices; a control the atlas cannot take now waits with the body's own words. The devices M0′
// holds stand as marks on the sections that draw their controls (every setting in the pool, full size in a pane).
//
// The stage's project lens (shell/paneInstrument.ts:118, :121 map it to techne:m0): while a pane presents the hosted stage and it stands in
// that lens, the plate also
// draws the stage's own controls — its Expression (Save, Undo, the scene bar, the tools, Nara, the captures; the stage plates' Expression
// section, projections/stageInstruments/stageInstrumentModel.ts EXPRESSION_SECTION) and whatever the frame places in its project view —
// read from the frame's published chrome and pressed through its one runner (components/expressions/studio/frameChrome.tsx), so the stage
// is never left without its controls while M0′ is its instrument (lane Y's open, T-FRAME-CHROME-ONTO-PLATES).
//
// The head is the panel kit's (InstrumentPlate.tsx; manual §16.9); the display section is M0′'s live well (techneWells.tsx): the Earth as
// the pane looks at it, or on its Graph side the graph's own picture.
import {useState, useSyncExternalStore} from 'react'
import {InstrumentPlate, heldMarksOf, SectionNote, type PlateSection} from '../../../frame/devices/InstrumentPlate'
import {HeldMarks, OwnerDial, OwnerValueBox, PlateLine, PlateRadio, PlateReading} from '../../../frame/devices/plateControls'
import {Action, Toggle} from '../../sdk/panel'
import type {FacePresentation} from '../../sdk/define'
import {presentAtlasView, useAtlasView} from '../../../projections/atlas/AtlasProjectionPanel'
import type {AtlasHandle} from '../../../projections/atlas/mount'
import {DEFAULT_FORCES, FORCE_ROWS, forceMultiple} from '../../../projections/atlas/src/graph/forces'
import {formatYear} from '../../../projections/atlas/src/data/time'
import {atlasScale, subscribeAtlasScale} from '../../../projections/atlas/places/placesHost'
import {controlsAt, useFrameChrome} from '../../../components/expressions/studio/frameChrome'
import {PlateFrameControls} from '../../../projections/stageInstruments/StageInstrumentPlate'
import {useAtlasLive, wellSection} from './techneWells'
import type {OwnPlateProps} from './TechneDevices'
import {EXPRESSION_SECTION} from '../../../projections/stageInstruments/stageInstrumentModel'
import {useFramePlacement} from '../../../projections/expressionsPaneHost'
import {allTime, playOrPause, resetForces, scrubClock, setForce, setWholeField, toggleCumulative, toggleKind, toggleOccurrences, toggleSky, toggleTie} from '../../atlasFaceActions'

// The bodies' own words for the states in which the atlas cannot take a control (atlasFaceBodies.tsx :86, :109, :114, :216).
const NOT_MOUNTED = 'The Earth has not mounted in this session. Its controls stand once the Earth pane is shown.'
const NOT_OPENED = 'The constellation has not been opened in this session. Its controls stand when the Graph view is first shown.'
const NOT_LOCAL = 'Steps count from a subject, so they apply in a local graph.'
const NO_SCOPE = 'No mode’s set is set aside on the globe, so there is no whole-field choice to make.'

const KIND_KEYS = [['archetype', 'Archetypes'], ['theoretic', 'Theoretics'], ['family', 'Families']] as const

/** The mounted atlas, re-read on its own notices (techneWells.tsx useAtlasLive, where the wells read it too). */
export {useAtlasLive}

/** View: Space or Graph, how close, and what the globe draws (the mode-switch and globe-engine faces). */
function ViewSection({handle}: {handle: AtlasHandle | null}) {
  const view = useAtlasView()
  const scale = useSyncExternalStore(subscribeAtlasScale, atlasScale, atlasScale)
  const scope = handle?.ctl.globeScope
  return <>
    <PlateRadio inline label="View" does="Space or Graph: the same material, as bodies or by connection — the atlas's own switch, the lens bar's."
      value={view} options={[{value: 'earth', label: 'Space'}, {value: 'graph', label: 'Graph'}]} onChange={next => presentAtlasView(next)} />
    <PlateReading label="Scale" value={scale ?? '—'} does="How close you look, as the atlas stands: field, system, body, region or place. The camera sets it." />
    <PlateRadio inline label="Scope" does={scope?.scope ? `The globe draws ${scope.scope.label} alone, or the whole field.` : 'The mode’s set alone, or the whole field.'}
      value={scope?.scope ? (scope.wholeField ? 'field' : 'set') : null} options={[{value: 'set', label: scope?.scope?.label ?? 'Set'}, {value: 'field', label: 'Field'}]}
      onChange={handle && scope?.scope ? next => setWholeField(handle.engine, next === 'field') : undefined} disabled={!handle ? NOT_MOUNTED : !scope?.scope ? NO_SCOPE : undefined} />
    <PlateReading label="Texture" value={handle ? handle.engine.baseKind : '—'} does="The globe's base texture. Its palette follows the field and its sun follows the sky; zoom and pan are the pane's own gestures." />
  </>
}

/** Graph: how far it reaches and what it draws (the graph-tools face: steps, kinds, occurrences, relations, sky anchors). */
function GraphSection({handle}: {handle: AtlasHandle | null}) {
  const graph = handle?.ctl.graphControls ?? null
  const c = graph?.controls() ?? null
  const why = !handle ? NOT_MOUNTED : !graph ? NOT_OPENED : undefined
  const skyOn = c ? c.sky === 'on' || c.sky === 'loading' : false
  return <>
    <PlateRadio inline label="Steps" does="How many links away the local graph reaches from its subject."
      value={c && c.local ? String(c.depth) : null} options={['1', '2', '3'].map(n => ({value: n, label: n}))}
      onChange={graph && c?.local ? next => graph.setDepth(Number(next)) : undefined} disabled={why ?? (c && !c.local ? NOT_LOCAL : undefined)} />
    <div className="plate-keys plate-span" role="group" aria-label="What is drawn">
      {KIND_KEYS.map(([kind, label]) => <Toggle key={kind} label={label} does={`Draw the ${label.toLowerCase()} of the field.`} on={!!c?.kinds[kind]} onChange={graph ? () => toggleKind(graph, kind) : undefined} disabled={why} />)}
      <Toggle label="Occurrences" does="Draw each occurrence as dust around its form." on={!!c?.dust} onChange={graph ? () => toggleOccurrences(graph) : undefined} disabled={why} />
    </div>
    <div className="plate-keys plate-span" role="group" aria-label="Family to archetype relations">
      {(c?.bases ?? [{id: 'jung', label: 'Jung'}, {id: 'inferred', label: 'Inferred'}, {id: 'site', label: 'Site'}]).map(basis =>
        <Toggle key={basis.id} label={basis.label} does={`Draw the ties ${basis.label === 'Jung' ? 'Jung states' : basis.label === 'Inferred' ? 'that are inferred' : 'a site states'}.`} tone="value"
          on={!!c?.ties.includes(basis.id)} onChange={graph ? () => toggleTie(graph, basis.id) : undefined} disabled={why} />)}
      <Toggle label="Sky anchors" does={c?.sky === 'unavailable' ? 'The sky’s data is unavailable.' : 'Bodies stand at their geocentric ecliptic longitudes; in a local graph they are ordinary neighbours.'}
        on={skyOn} onChange={graph ? () => toggleSky(graph) : undefined} disabled={why ?? (c?.sky === 'loading' ? 'Loading the sky…' : undefined)} />
    </div>
    {!graph && handle && <Action label="Show the graph" does="Open the Graph view: its controls stand once it is first shown." onPress={() => presentAtlasView('graph')} />}
  </>
}

/** Forces: the graph's four, as multiples of the arrangement as drawn, sent as the hand moves (the graph answers at once). */
function ForcesSection({handle}: {handle: AtlasHandle | null}) {
  const graph = handle?.ctl.graphControls ?? null
  const c = graph?.controls() ?? null
  const why = !handle ? NOT_MOUNTED : !graph ? NOT_OPENED : undefined
  return <>
    {FORCE_ROWS.map(row => <OwnerDial key={row.key} label={row.label === 'Link distance' ? 'Distance' : row.label === 'Link force' ? 'Link' : row.label} does={row.tip}
      value={c ? c.forces[row.key] : null} def={DEFAULT_FORCES[row.key]} live
      scale={{min: row.min, max: row.max, step: row.step}} format={v => `${forceMultiple(row.key, v).toFixed(2)}×`}
      onCommit={graph ? v => setForce(graph, row.key, v) : undefined} why={why} />)}
    <div className="plate-keys plate-span">
      <Action label="Reset" does="Restore the arrangement as drawn." onPress={graph ? () => resetForces(graph) : undefined} disabled={why} />
      <Action label="Reframe" does="Fit the graph to the pane again." onPress={graph ? () => graph.reframe() : undefined} disabled={why} />
    </div>
  </>
}

/** Deep time: the atlas's clock — the cursor over the deep-time scale, All time, Play, Cumulative (the time-control face). */
function TimeSection({handle}: {handle: AtlasHandle | null}) {
  const clock = handle?.time
  const [refusal, setRefusal] = useState<string | null>(null)
  const year = handle && clock ? (clock.mode === 'cursor' ? formatYear(handle.model.scale.fromU(clock.cursorU)) : 'All time') : '—'
  return <>
    <OwnerValueBox label="Cursor" does="The moment the Earth shows on the deep-time scale; a move writes the shared window." wide value={clock ? clock.cursorU : null} def={0.5}
      scale={{min: clock?.fromU ?? 0, max: clock?.toU ?? 1}} format={() => year} live onCommit={handle && clock ? u => setRefusal(scrubClock(handle.ctl, clock, u)) : undefined}
      why={handle ? undefined : NOT_MOUNTED} />
    <div className="plate-keys plate-span">
      <Action label="All time" does="Show every age at once." onPress={handle && clock ? () => setRefusal(allTime(handle.ctl, clock)) : undefined} disabled={handle ? undefined : NOT_MOUNTED} />
      <Toggle label={clock?.playing ? 'Pause' : 'Play'} does="Play the deep-time clock through the window, or pause it." on={!!clock?.playing}
        onChange={handle && clock ? () => setRefusal(playOrPause(handle.ctl, clock)) : undefined} disabled={handle ? undefined : NOT_MOUNTED} />
      <Toggle label="Cumulative" does="Keep what has passed drawn as the clock moves." on={!!clock?.cumulative} onChange={clock ? () => toggleCumulative(clock) : undefined} disabled={handle ? undefined : NOT_MOUNTED} />
    </div>
    <PlateLine text={refusal} tone="refused" />
  </>
}

/** The M0′ Project plate. `held` are the devices the families declare M0′ holds (the globe, Graph tools, Earth ⇄ Graph, Deep time): each
 * stands as a mark on the section that draws its controls. */
export function ProjectPlate({held, focused, onFold, onFull}: Pick<OwnPlateProps, 'held' | 'focused' | 'onFold' | 'onFull'>) {
  const handle = useAtlasLive()
  const view = useFrameChrome()
  const marks = (faces: readonly string[]) => <HeldMarks devices={heldMarksOf(held.filter(entry => faces.includes(entry.face)))} />
  const others = held.filter(entry => !['globe-engine', 'mode-switch', 'graph-tools', 'time-control'].includes(entry.face))
  // The stage stands in its project lens: its own controls stand here too (paneInstrument.ts maps that lens to M0′).
  const placed = useFramePlacement() !== null
  const stage = placed && view.reading?.lens === 'project'
  const stageControls = stage ? controlsAt(view.reading, [...EXPRESSION_SECTION.homes, 'project:view']) : []
  const presentation: FacePresentation = {family: 'techne', faceId: 'techne:m0', title: 'Project', icon: 'lib',
    owner: ['M0′', 'Technē', 'the Earth and its graph', stage ? 'the stage in its project lens' : null, focused ? 'open on the focused pane' : 'opened here'].filter(Boolean).join(' · ')}
  const well = wellSection('techne:m0')
  const sections: PlateSection[] = [
    ...(well ? [well] : []),
    ...(stage ? [{id: 'expression', title: 'Expression', note: 'the stage',
      children: stageControls.length ? <PlateFrameControls controls={stageControls} view={view} label="Expression" /> : <SectionNote word="none">{view.reason ?? 'The stage places no control in its project lens.'}</SectionNote>}] : []),
    {id: 'view', title: 'View', width: 196, note: marks(['mode-switch', 'globe-engine']), children: <ViewSection handle={handle} />},
    {id: 'graph', title: 'Graph', width: 236, note: marks(['graph-tools']), children: <GraphSection handle={handle} />},
    {id: 'forces', title: 'Forces', cols: 4, children: <ForcesSection handle={handle} />},
    {id: 'time', title: 'Deep time', width: 196, note: marks(['time-control']), children: <TimeSection handle={handle} />},
    ...(others.length ? [{id: 'held', title: 'Also held', children: <HeldMarks devices={heldMarksOf(others)} />}] : []),
  ]
  return <InstrumentPlate presentation={presentation} sections={sections} onFold={onFold} onFull={onFull} fullLabel="Open Project on the focused pane"
    footer={stage && view.refusal ? <PlateLine text={view.refusal} tone="refused" /> : undefined}
    dataAttributes={{'data-instrument': 'techne:m0', 'data-expanded': 'true', 'data-project-plate': 'true', 'data-stage-lens': stage ? 'project' : undefined}} />
}
