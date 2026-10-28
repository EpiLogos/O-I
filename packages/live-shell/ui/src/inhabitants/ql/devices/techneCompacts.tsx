// The Technē instruments' Compact presentation on the rack (manual §16.1: "Compact | In a chain | Play the device: a small live picture and
// up to four macros"; each instrument's entry, §17.1–§17.6 Presentations; ProjectCentral/docs/1-vision/dlw/DLW.md §16.3 "Compact — The display and up to four
// macros", §7 the display): an instrument not open on the focused pane stands on the rack as its Compact while the row has room (the rack
// folds the rest to their titles, TechneDevices.tsx), so it can be played without opening it. Each Compact is a head (its light, its
// mark, its name — pressed, it opens the instrument on the focused pane through the one instrument door, as its fold always did), a well
// that draws the instrument's state from its owner's readings — never a likely picture: a reading the owner has not given is named in the
// well — and the four macros its manual entry names, each pressing the instrument's own parameter through the same owner and handler its
// open plate uses (ProjectPlate.tsx, PlacesPlate.tsx, PalacePlate.tsx, the stage plates' frame chrome); a macro no owner carries yet
// stands waiting with why. A registration by holder id (COMPACTS), never a mode branch.
import {useSyncExternalStore, type ReactNode} from 'react'
import {Action, Chooser, Display, PanelHead, Readout, Toggle} from '../../sdk/panel'
import {Icon} from '../../sdk/Icon'
import type {IconName} from '../../sdk/icons'
import type {HolderDeclaration} from '../../sdk/semantics'
import {OwnerDial, PlateRadio} from '../../../frame/devices/plateControls'
import {atlasScale, subscribeAtlasScale} from '../../../projections/atlas/places/placesHost'
import {formatYear} from '../../../projections/atlas/src/data/time'
import {controlsAt, useFrameChrome, type FrameChromeView} from '../../../components/expressions/studio/frameChrome'
import {inside, palaceState, proposeReturn, setGuide, setPath, subscribePalace} from '../../../projections/atlas/palaces/palaceSession'
import {allTime, scrubClock, setWholeField} from '../../atlasFaceActions'
import {stageWhy, useAtlasLive, useCanvasWell, useJourneyWell, usePalaceWell, useProjectWell, useTimelineWell, useWindowWords, useWorldWell, type Well} from './techneWells'
import type {FrameChromeControl} from '@epilogos/expressions-boundary'

/** The Compact's well (techneWells.tsx draws it at any size). */
const WELL = {w: 96, h: 96}

/** A choice the manual names that no owner carries yet: its menu, nothing chosen, its reason on the status line. */
const waitingChooser = (label: string, options: readonly string[], why: string) =>
  <Chooser label={label} value="" options={[{value: '', label: '—'}, ...options.map(option => ({value: option.toLowerCase(), label: option}))]} disabled={why} />

const NOT_MOUNTED = 'The Earth has not mounted in this session: the World draws once the Earth pane is shown.'

interface CompactBody {readonly well: Well & {raw?: boolean}; readonly macros: ReactNode}

// ── the Project: the Earth, or its graph ──

function ProjectCompact(): CompactBody {
  const handle = useAtlasLive()
  const well = useProjectWell(WELL)
  const graph = handle?.ctl.graphControls ?? null
  const c = graph?.controls() ?? null
  const scope = handle?.ctl.globeScope
  const why = !handle ? NOT_MOUNTED : !graph ? 'The constellation has not been opened in this session: Depth stands once the Graph view is first shown.' : c && !c.local ? 'Steps count from a subject, so they apply in a local graph.' : undefined
  return {well, macros: <>
    <OwnerDial label="Depth" does="How many links away the graph reaches from its subject." value={c?.local ? c.depth : null} def={1} scale={{min: 1, max: 3, step: 1}} format={v => `${v}`}
      live onCommit={graph && c?.local ? v => graph.setDepth(v) : undefined} why={why} />
    <PlateRadio stack label="Scope" does="The mode's set alone, or the whole field (the globe's own choice)." value={scope?.scope ? (scope.wholeField ? 'field' : 'set') : null}
      options={[{value: 'set', label: 'Set'}, {value: 'field', label: 'Field'}]} onChange={handle && scope?.scope ? next => setWholeField(handle.engine, next === 'field') : undefined}
      disabled={!handle ? NOT_MOUNTED : !scope?.scope ? 'No mode’s set is set aside on the globe, so there is no whole-field choice to make.' : undefined} />
    <PlateRadio stack label="Ghosts" value={null} options={[{value: 'show', label: 'Show'}, {value: 'hide', label: 'Hide'}]}
      disabled="The atlas's graph draws only resolved links: no owner discloses its unresolved ones here." />
    {waitingChooser('Labels', ['Automatic', 'All', 'Focus'], 'The graph labels as its own zoom allows: no owner sets its labels here.')}
  </>}
}

// ── the Canvas, the Timeline, the Journey: the stage's instruments, read from the frame's published chrome while the stage stands in their lens ──

/** One of the frame's own controls, by its words, pressed through its one runner (frameChrome.tsx). */
function frameControl(view: FrameChromeView, homes: Parameters<typeof controlsAt>[1], label: string | RegExp): FrameChromeControl | undefined {
  return controlsAt(view.reading, homes).find(control => typeof label === 'string' ? control.label === label : label.test(control.label))
}

function CanvasCompact(): CompactBody {
  const view = useFrameChrome()
  const well = useCanvasWell(WELL)
  const why = stageWhy(view, 'canvas')
  const snap = why ? undefined : frameControl(view, 'canvas:tools', 'Snap')
  return {well, macros: <>
    {waitingChooser('Tool', ['Select', 'Frame', 'Relate', 'Note', 'Shape', 'Text'], 'The canvas holds no standing tool: each tool is one act, on the open plate.')}
    <Toggle label="Snap" does={snap?.title ?? 'Snap the board\'s items as you drag them: the canvas\'s own Snap.'} on={!!snap?.pressed} onChange={snap ? () => view.send(snap) : undefined}
      disabled={why ?? (snap ? undefined : 'The canvas offers no Snap here.')} />
    {waitingChooser('Relation', ['Echo', 'Influence', 'Cause', 'Transform'], 'The next line\'s type has no owner: a drawn line\'s relation is named when it is promoted.')}
    {waitingChooser('Standing', ['Fact', 'Claim', 'Inference', 'Guess'], 'No owner gives a drawn line a standing yet: it stays a proposal until its owner accepts it.')}
  </>}
}

function TimelineCompact(): CompactBody {
  const view = useFrameChrome()
  const well = useTimelineWell(WELL)
  const why = stageWhy(view, 'timeline')
  const lenses = why ? [] : controlsAt(view.reading, 'timeline:lens').filter(control => control.kind === 'toggle')
  const lit = lenses.find(control => control.pressed)
  const words = useWindowWords()
  return {well, macros: <>
    <PlateRadio stack label="Lens" does="How the events relate on the ruler: the timeline's own lenses." value={lit?.id ?? null}
      options={(lenses.length ? lenses : [{id: 'chronology', label: 'Chronology'} as FrameChromeControl, {id: 'relations', label: 'Relations'} as FrameChromeControl])
        .map(control => ({value: control.id, label: control.short ?? control.label, why: control.disabled ? control.title ?? 'Off here.' : null}))}
      onChange={lenses.length ? id => { const control = lenses.find(entry => entry.id === id); if (control) view.send(control) } : undefined} disabled={why} />
    <Readout label="Window" value={words} does="The span you read over: the shared window's two edges, the same the transport's punch-in and punch-out read." />
    {waitingChooser('Floor', ['Facts', 'Claims', 'Inferences', 'Guesses', 'All'], 'The chronology filters no event by standing: every event shows at its own standing.')}
    <Toggle label="Readings" on={false} disabled="The ruler's reading discloses no layers here." />
  </>}
}

function JourneyCompact(): CompactBody {
  const view = useFrameChrome()
  const well = useJourneyWell(WELL)
  const why = stageWhy(view, 'journey')
  const hold = why ? undefined : frameControl(view, 'journey:stops', /^Hold/)
  const pace = hold && hold.value !== undefined ? Number(hold.value) : NaN
  return {well, macros: <>
    {Number.isFinite(pace) && hold?.min !== undefined && hold.max !== undefined
      ? <OwnerDial label="Pace" does="How long the walk stays at a stop: the stop's own hold, in seconds." value={pace} def={pace} scale={{min: hold.min, max: hold.max, step: hold.step ?? 1}} format={v => `${v} s`}
          onCommit={v => view.send(hold, String(v))} />
      : <Readout label="Pace" value={Number.isFinite(pace) ? `${pace} s` : '—'} does={why ?? 'How long the walk stays at a stop: the stop\'s own hold.'} />}
    <PlateRadio stack label="Arrival" value={null} options={['Fly', 'Cut', 'Fade'].map(label => ({value: label.toLowerCase(), label}))} disabled="Each transition's curve stands on its row in the walk: no owner sets the walk's arrival yet." />
    <PlateRadio stack label="Loop" value={null} options={[{value: 'off', label: 'Off'}, {value: 'on', label: 'On'}]} disabled="No owner repeats the walk yet." />
    <PlateRadio stack label="Narration" value={null} options={[{value: 'on', label: 'On'}, {value: 'off', label: 'Off'}]} disabled="No owner speaks or shows a stop's words yet." />
  </>}
}

// ── World: the body with its phase ──

function WorldCompact(): CompactBody {
  const handle = useAtlasLive()
  const well = useWorldWell(WELL)
  const scale = useSyncExternalStore(subscribeAtlasScale, atlasScale, atlasScale)
  const clock = handle?.time
  const occasion = clock ? (clock.mode === 'cursor' ? 'cursor' : 'all') : null
  return {well, macros: <>
    <Readout label="Scale" value={scale ?? '—'} does="How close you look: field, system, body, region or place, as the camera stands." />
    {waitingChooser('Aperture', ['World', 'Local', 'Shared', 'Federated'], 'No owner opens the shared or federated field to the atlas yet.')}
    {waitingChooser('View as', ['Me', 'Field', 'Public'], 'No owner discloses how the field or the public sees your world yet.')}
    <PlateRadio stack label="Occasion" does={clock && clock.mode === 'cursor' && handle ? `The moment the Earth shows: ${formatYear(handle.model.scale.fromU(clock.cursorU))}.` : 'The moment the Earth shows: all time, or the cursor.'}
      value={occasion} options={[{value: 'all', label: 'All'}, {value: 'cursor', label: clock && handle && clock.mode === 'cursor' ? formatYear(handle.model.scale.fromU(clock.cursorU)) : 'Cursor'}]}
      onChange={handle && clock ? next => { if (next === 'all') allTime(handle.ctl, clock); else scrubClock(handle.ctl, clock, clock.cursorU) } : undefined}
      disabled={handle ? undefined : NOT_MOUNTED} />
  </>}
}

// ── the Palace: the plan of the rooms, the path, your room ──

function PalaceCompact(): CompactBody {
  const state = useSyncExternalStore(subscribePalace, palaceState, palaceState)
  const well = usePalaceWell(WELL)
  const here = state.phase === 'inside' ? inside() : null
  const why = here ? undefined : 'Enter a palace: its path, its guide and its Return stand here.'
  return {well, macros: <>
    <PlateRadio stack label="Path" does="Guided: the floor draws the path and the walk's focus. Free: the palace entered directly." value={here?.path ?? null}
      options={[{value: 'guided', label: 'Guided'}, {value: 'free', label: 'Free'}]} onChange={here ? next => setPath(next) : undefined} disabled={why} />
    <PlateRadio stack label="Guide" does="The guide says why the focused room stands where it does." value={here ? (here.guide ? 'on' : 'off') : null}
      options={[{value: 'on', label: 'On'}, {value: 'off', label: 'Off'}]} onChange={here ? next => setGuide(next === 'on') : undefined} disabled={why} />
    {waitingChooser('Audience', ['Me', 'Field', 'Public'], 'No owner discloses how the field or the public sees the palace yet; you see it as yours.')}
    <Action label="Return" does="Shape the palace's Return as an attributable proposal: nothing is written." onPress={here ? proposeReturn : undefined}
      disabled={why ?? (here?.busy || !here?.reading ? 'The palace has no reading to return yet.' : undefined)} />
  </>}
}

/** The Compact of each Technē instrument, by holder (a registration, never a mode branch). */
const COMPACTS: Readonly<Record<string, () => CompactBody>> = {
  'techne:m0': ProjectCompact, 'techne:m1': CanvasCompact, 'techne:m2': TimelineCompact, 'techne:m3': JourneyCompact, 'techne:m4': WorldCompact, 'techne:m5': PalaceCompact,
}

export const hasCompact = (id: string): boolean => id in COMPACTS

/** The Compact's body: its well and its four macros, read from the instrument's owners. A component per holder, so each reads its own. */
function CompactBodyOf({id}: {id: string}) {
  const {well, macros} = COMPACTS[id]!()
  return <div className="techne-compact-body">
    <Display w={WELL.w} h={WELL.h} label={well.label.split(':')[0]} does={well.label} corner={well.corner} raw={well.raw}>{well.picture}</Display>
    <div className="techne-compact-macros">{macros}</div>
  </div>
}

/** An instrument on the rack at its Compact size: the kit's head (its light, its mark, its name — pressed, it opens on the focused pane —
 * and ⤢) and its body. Who owns it is said on the status bar, never drawn (lock §9.4). */
export function InstrumentCompact({holder, mark, light, onOpen}: {holder: HolderDeclaration; mark: IconName; light: 'lit' | 'dark' | 'unknown'; onOpen: () => void}) {
  const words = `Open ${holder.title} on the focused pane, with every setting on its plate.`
  return <section className="techne-compact" data-instrument={holder.id} data-expanded="compact" data-rack="compact" aria-label={`${holder.title}, compact`}>
    <PanelHead title={holder.title} light={light} mark={<Icon name={mark} size={11} className="techne-compact-mark" />} onName={onOpen} nameDoes={words}
      onFull={onOpen} fullLabel={words} hint={[holder.provenance, 'Technē', 'compact on the rack'].filter(Boolean).join(' · ')} />
    <CompactBodyOf key={holder.id} id={holder.id} />
  </section>
}
