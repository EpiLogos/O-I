// The Technē instruments' Compact presentation on the rack (manual §16.1: "Compact | In a chain | Play the device: a small live picture and
// up to four macros"; each instrument's entry, §17.1–§17.6 Presentations; docs/dlw/DEVICE-UI.md §2 "Compact — The display and up to four
// macros", §7 the display): an instrument not open on the focused pane stands on the rack as its Compact while the row has room (the rack
// folds the rest to their titles, TechneDevices.tsx), so it can be played without opening it. Each Compact is a head (its light, its
// mark, its name — pressed, it opens the instrument on the focused pane through the one instrument door, as its fold always did), a well
// that draws the instrument's state from its owner's readings — never a likely picture: a reading the owner has not given is named in the
// well — and the four macros its manual entry names, each pressing the instrument's own parameter through the same owner and handler its
// open plate uses (ProjectPlate.tsx, PlacesPlate.tsx, PalacePlate.tsx, the stage plates' frame chrome); a macro no owner carries yet
// stands waiting with why. A registration by holder id (COMPACTS), never a mode branch.
import {useSyncExternalStore, type ReactNode} from 'react'
import {Action, Chooser, Display, Readout, Toggle} from '../../sdk/panel'
import {Icon} from '../../sdk/Icon'
import type {IconName} from '../../sdk/icons'
import type {HolderDeclaration} from '../../sdk/semantics'
import {OwnerDial, PlateRadio, said} from '../../../frame/devices/plateControls'
import {useAtlasSun, useAtlasView} from '../../../projections/atlas/AtlasProjectionPanel'
import {atlasScale, subscribeAtlasScale} from '../../../projections/atlas/places/placesHost'
import {formatYear} from '../../../projections/atlas/src/data/time'
import {windowEdgeYear} from '../../../projections/atlas/sharedClock'
import {disclosureSession} from '../../../../../../../desktop/cradle/src/techne/session'
import {controlsAt, useFrameChrome, type FrameChromeView} from '../../../components/expressions/studio/frameChrome'
import {focusedRoom, inside, palaceState, proposeReturn, roomsNow, setGuide, setPath, subscribePalace, walkOf} from '../../../projections/atlas/palaces/palaceSession'
import {usePalaces} from '../../../projections/atlas/palaces/palacesWorld'
import {allTime, scrubClock, setWholeField} from '../../atlasFaceActions'
import {useAtlasLive} from './ProjectPlate'
import type {FrameChromeControl} from '@epilogos/expressions-boundary'

const W = 96, H = 96

/** A choice the manual names that no owner carries yet: its menu, nothing chosen, its reason on the status line. */
const waitingChooser = (label: string, options: readonly string[], why: string) =>
  <Chooser label={label} value="" options={[{value: '', label: '—'}, ...options.map(option => ({value: option.toLowerCase(), label: option}))]} disabled={why} />

const NOT_MOUNTED = 'The Earth has not mounted in this session: the World draws once the Earth pane is shown.'

/** Words in the well, where a reading is missing (DEVICE-UI.md §7 "When a reading is missing, say which one in the well"). */
function Missing({lines}: {lines: readonly string[]}) {
  return <>{lines.map((line, index) => <text key={line} x={W / 2} y={H / 2 - (lines.length - 1) * 6 + index * 12} textAnchor="middle" className="dp-ink-dim">{line}</text>)}</>
}

// ── M0′ Project: the graph's reach and what it draws, or the body in space ──

function ProjectCompact() {
  const handle = useAtlasLive()
  const view = useAtlasView()
  const graph = handle?.ctl.graphControls ?? null
  const c = graph?.controls() ?? null
  const scope = handle?.ctl.globeScope
  const why = !handle ? NOT_MOUNTED : !graph ? 'The constellation has not been opened in this session: Depth stands once the Graph view is first shown.' : c && !c.local ? 'Steps count from a subject, so they apply in a local graph.' : undefined
  const kinds: readonly [string, boolean | undefined, string][] = [['Archetypes', c?.kinds.archetype, 'var(--accent)'], ['Theoretics', c?.kinds.theoretic, 'var(--sel)'], ['Families', c?.kinds.family, 'var(--green)']]
  const picture = !handle ? <Missing lines={['the Earth', 'not mounted']} />
    : view === 'earth' ? <>
        <circle cx={W / 2} cy={H / 2} r={30} className="dp-faint" />
        <circle cx={W / 2} cy={H / 2} r={30} className="dp-fill" />
        {scope?.scope && !scope.wholeField && <circle cx={W / 2} cy={H / 2} r={36} className="dp-curve-on" strokeDasharray="3 3" />}
      </>
      : !c ? <Missing lines={['graph not', 'opened yet']} />
      : <>
          {[1, 2, 3].map(step => <circle key={step} cx={W / 2} cy={H / 2} r={10 + step * 11} className={c.local && step <= c.depth ? 'dp-curve' : 'dp-faint'} />)}
          <circle cx={W / 2} cy={H / 2} r={3.5} fill="var(--text)" />
          {kinds.map(([name, on, colour], index) => {
            const a = (index / 3) * Math.PI * 2 - Math.PI / 2, r = c.local ? 10 + c.depth * 11 : 40
            return <circle key={name} cx={W / 2 + r * Math.cos(a)} cy={H / 2 + r * Math.sin(a)} r={4} fill={on ? colour : 'none'} stroke={colour} strokeWidth={1.2} />
          })}
          {c.dust && [0, 1, 2, 3, 4, 5].map(k => <circle key={k} cx={W / 2 + 20 * Math.cos(k + 0.5)} cy={H / 2 + 20 * Math.sin(k + 0.5)} r={1} fill="var(--text-dim)" />)}
        </>
  const corner = !handle ? undefined : view === 'earth' ? 'space' : c ? (c.local ? `${c.depth} step${c.depth === 1 ? '' : 's'}` : 'whole') : 'graph'
  return {picture, corner, label: 'The graph: its reach in rings from the subject, the kinds it draws on the outer ring; in space, the body.', macros: <>
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

// ── M1′–M3′: the stage's instruments, read from the frame's published chrome while the stage stands in their lens ──

function stageWhy(view: FrameChromeView, lens: string): string | undefined {
  if (!view.reading) return view.reason ?? 'The stage has not reported its controls yet.'
  return view.reading.lens === lens ? view.reason ?? undefined : `The stage stands in its ${view.reading.lens} lens: open this instrument on the focused pane to play it.`
}

/** One of the frame's own controls, by its words, pressed through its one runner (frameChrome.tsx). */
function frameControl(view: FrameChromeView, homes: Parameters<typeof controlsAt>[1], label: string | RegExp): FrameChromeControl | undefined {
  return controlsAt(view.reading, homes).find(control => typeof label === 'string' ? control.label === label : label.test(control.label))
}

function CanvasCompact() {
  const view = useFrameChrome()
  const why = stageWhy(view, 'canvas')
  const snap = why ? undefined : frameControl(view, 'canvas:tools', 'Snap')
  const zoom = why ? undefined : controlsAt(view.reading, 'canvas:look').find(control => control.kind === 'reading' && /%$/.test(control.label))
  const z = zoom ? Number.parseFloat(zoom.label) : NaN
  const side = Number.isFinite(z) && z > 0 ? Math.max(8, Math.min(80, 80 * 100 / z)) : null
  const picture = side === null ? <Missing lines={why ? ['the stage is', `in ${view.reading?.lens ?? 'no'} lens`] : ['zoom not', 'published']} />
    : <><rect x={8} y={8} width={80} height={80} className="dp-faint" /><rect x={W / 2 - side / 2} y={H / 2 - side / 2} width={side} height={side} className="dp-curve" /><rect x={W / 2 - side / 2} y={H / 2 - side / 2} width={side} height={side} className="dp-fill" /></>
  return {picture, corner: zoom?.label, label: 'The board, with the part the pane shows at its zoom.', macros: <>
    {waitingChooser('Tool', ['Select', 'Frame', 'Relate', 'Note', 'Shape', 'Text'], 'The canvas holds no standing tool: each tool is one act, on the open plate.')}
    <Toggle label="Snap" does={snap?.title ?? 'Snap the board\'s items as you drag them: the canvas\'s own Snap.'} on={!!snap?.pressed} onChange={snap ? () => view.send(snap) : undefined}
      disabled={why ?? (snap ? undefined : 'The canvas offers no Snap here.')} />
    {waitingChooser('Relation', ['Echo', 'Influence', 'Cause', 'Transform'], 'The next line\'s type has no owner: a drawn line\'s relation is named when it is promoted.')}
    {waitingChooser('Standing', ['Fact', 'Claim', 'Inference', 'Guess'], 'No owner gives a drawn line a standing yet: it stays a proposal until its owner accepts it.')}
  </>}
}

function useWindowEdges(): {from: number | null; to: number | null} | null {
  const window = useSyncExternalStore(disclosureSession.subscribe, () => disclosureSession.get()?.time_window ?? null, () => null)
  return window ? {from: windowEdgeYear(window.from), to: windowEdgeYear(window.to)} : null
}

function TimelineCompact() {
  const view = useFrameChrome()
  const why = stageWhy(view, 'timeline')
  const edges = useWindowEdges()
  const lenses = why ? [] : controlsAt(view.reading, 'timeline:lens').filter(control => control.kind === 'toggle')
  const lit = lenses.find(control => control.pressed)
  const words = edges ? `${edges.from ?? '…'} – ${edges.to ?? '…'}` : 'all time'
  const picture = <>
    <line x1={8} y1={58} x2={88} y2={58} className="dp-faint" />
    {[8, 28, 48, 68, 88].map(x => <line key={x} x1={x} y1={54} x2={x} y2={62} className="dp-faint" />)}
    <rect x={edges ? 26 : 8} y={46} width={edges ? 44 : 80} height={8} className="dp-fill" />
    <line x1={edges ? 26 : 8} y1={50} x2={edges ? 70 : 88} y2={50} className="dp-curve" />
    {edges && <><text x={26} y={76} textAnchor="middle" className="dp-axis">{edges.from ?? '…'}</text><text x={70} y={76} textAnchor="middle" className="dp-axis">{edges.to ?? '…'}</text></>}
    <text x={W / 2} y={32} textAnchor="middle" className="dp-ink-dim">{edges ? 'window' : 'all time'}</text>
  </>
  return {picture, corner: lit?.short ?? lit?.label, label: 'The ruler with the window you read over: its two edges, or all time.', macros: <>
    <PlateRadio stack label="Lens" does="How the events relate on the ruler: the timeline's own lenses." value={lit?.id ?? null}
      options={(lenses.length ? lenses : [{id: 'chronology', label: 'Chronology'} as FrameChromeControl, {id: 'relations', label: 'Relations'} as FrameChromeControl])
        .map(control => ({value: control.id, label: control.short ?? control.label, why: control.disabled ? control.title ?? 'Off here.' : null}))}
      onChange={lenses.length ? id => { const control = lenses.find(entry => entry.id === id); if (control) view.send(control) } : undefined} disabled={why} />
    <Readout label="Window" value={words} does="The span you read over: the shared window's two edges, the same the transport's punch-in and punch-out read." />
    {waitingChooser('Floor', ['Facts', 'Claims', 'Inferences', 'Guesses', 'All'], 'The chronology filters no event by standing: every event shows at its own standing.')}
    <Toggle label="Readings" on={false} disabled="The ruler's reading discloses no layers here." />
  </>}
}

function JourneyCompact() {
  const view = useFrameChrome()
  const why = stageWhy(view, 'journey')
  const hold = why ? undefined : frameControl(view, 'journey:stops', /^Hold/)
  const scene = view.reading ? controlsAt(view.reading, 'scene').find(control => control.kind === 'toggle' && /^\d+\s/.test(control.label)) : undefined
  const pace = hold && hold.value !== undefined ? Number(hold.value) : NaN
  const picture = <Missing lines={scene ? ['scene', scene.label.replace(/\s+Saved$/, '').slice(0, 14)] : ['stops not', 'published']} />
  return {picture, corner: Number.isFinite(pace) ? `${pace} s` : undefined, label: 'The walk: the scene it stands on (its stops are not published to the shell).', macros: <>
    {Number.isFinite(pace) && hold?.min !== undefined && hold.max !== undefined
      ? <OwnerDial label="Pace" does="How long the walk stays at a stop: the stop's own hold, in seconds." value={pace} def={pace} scale={{min: hold.min, max: hold.max, step: hold.step ?? 1}} format={v => `${v} s`}
          onCommit={v => view.send(hold, String(v))} />
      : <Readout label="Pace" value={Number.isFinite(pace) ? `${pace} s` : '—'} does={why ?? 'How long the walk stays at a stop: the stop\'s own hold.'} />}
    <PlateRadio stack label="Arrival" value={null} options={['Fly', 'Cut', 'Fade'].map(label => ({value: label.toLowerCase(), label}))} disabled="Each transition's curve stands on its row in the walk: no owner sets the walk's arrival yet." />
    <PlateRadio stack label="Loop" value={null} options={[{value: 'off', label: 'Off'}, {value: 'on', label: 'On'}]} disabled="No owner repeats the walk yet." />
    <PlateRadio stack label="Narration" value={null} options={[{value: 'on', label: 'On'}, {value: 'off', label: 'Off'}]} disabled="No owner speaks or shows a stop's words yet." />
  </>}
}

// ── M4′ World: the body with its phase ──

function WorldCompact() {
  const handle = useAtlasLive()
  const sun = useAtlasSun()
  const scale = useSyncExternalStore(subscribeAtlasScale, atlasScale, atlasScale)
  const clock = handle?.time
  const sky = handle?.engine.sky
  // The phase as the camera sees it: the Sun's direction against the camera's own axes (the globe's own light, globe/engine.ts:352).
  let phase: {k: number; angle: number} | null = null
  if (handle && sky?.sunKnown) {
    const cam = handle.engine.camera
    cam.updateMatrixWorld()
    const e = cam.matrixWorld.elements
    const sx = sky.sunDir.x, sy = sky.sunDir.y, sz = sky.sunDir.z
    const right = sx * e[0]! + sy * e[1]! + sz * e[2]!, up = sx * e[4]! + sy * e[5]! + sz * e[6]!, toward = sx * e[8]! + sy * e[9]! + sz * e[10]!
    phase = {k: toward, angle: Math.atan2(-up, right)}
  }
  const r = 34, cx = W / 2, cy = H / 2
  const picture = !handle ? <Missing lines={['the Earth', 'not mounted']} /> : <>
    <circle cx={cx} cy={cy} r={r} fill="var(--bg-0)" className="dp-faint" />
    {phase ? <g transform={`rotate(${(phase.angle * 180) / Math.PI} ${cx} ${cy})`}>
      {/* the lit half toward the Sun, closed by the terminator: an ellipse whose width is the phase */}
      <path d={`M${cx} ${cy - r} A${r} ${r} 0 0 1 ${cx} ${cy + r} A${Math.abs(phase.k) * r} ${r} 0 0 ${phase.k > 0 ? 1 : 0} ${cx} ${cy - r}Z`} className="dp-fill" />
      <path d={`M${cx} ${cy - r} A${r} ${r} 0 0 1 ${cx} ${cy + r}`} className="dp-curve" />
    </g> : <text x={cx} y={cy + 3} textAnchor="middle" className="dp-ink-dim">{sun?.placed ? 'sky not loaded' : 'no Sun placed'}</text>}
  </>
  const occasion = clock ? (clock.mode === 'cursor' ? 'cursor' : 'all') : null
  return {picture, corner: scale ?? undefined, label: 'The Earth with its phase: the side the Sun lights, as the pane looks at it.', macros: <>
    <Readout label="Scale" value={scale ?? '—'} does="How close you look: system, body, region or palace, as the camera stands." />
    {waitingChooser('Aperture', ['World', 'Local', 'Shared', 'Federated'], 'No owner opens the shared or federated field to the atlas yet.')}
    {waitingChooser('View as', ['Me', 'Field', 'Public'], 'No owner discloses how the field or the public sees your world yet.')}
    <PlateRadio stack label="Occasion" does={clock && clock.mode === 'cursor' && handle ? `The moment the Earth shows: ${formatYear(handle.model.scale.fromU(clock.cursorU))}.` : 'The moment the Earth shows: all time, or the cursor.'}
      value={occasion} options={[{value: 'all', label: 'All'}, {value: 'cursor', label: clock && handle && clock.mode === 'cursor' ? formatYear(handle.model.scale.fromU(clock.cursorU)) : 'Cursor'}]}
      onChange={handle && clock ? next => { if (next === 'all') allTime(handle.ctl, clock); else scrubClock(handle.ctl, clock, clock.cursorU) } : undefined}
      disabled={handle ? undefined : NOT_MOUNTED} />
  </>}
}

// ── M5′ Palace: the plan of the rooms, the path, your room ──

function PalaceCompact() {
  const state = useSyncExternalStore(subscribePalace, palaceState, palaceState)
  const {rows} = usePalaces()
  const here = state.phase === 'inside' ? inside() : null
  const why = here ? undefined : 'Enter a palace: its path, its guide and its Return stand here.'
  let picture: ReactNode = <Missing lines={rows.length ? [`${rows.length} palace${rows.length === 1 ? '' : 's'}`, 'enter one'] : ['no palace', 'read yet']} />
  if (here) {
    const rooms = roomsNow(here)
    const focus = focusedRoom(here)
    const n = Math.max(1, rooms.length), cols = Math.ceil(Math.sqrt(n)), cell = 72 / cols
    const at = (index: number) => ({x: 12 + (index % cols) * cell + cell / 2, y: 12 + Math.floor(index / cols) * cell + cell / 2})
    picture = <>
      {here.path === 'guided' && rooms.length > 1 && <polyline points={rooms.map((_, index) => `${at(index).x},${at(index).y}`).join(' ')} className="dp-faint" strokeDasharray="2 3" />}
      {rooms.map((room, index) => { const p = at(index), s = cell * 0.6; return <rect key={room.key} x={p.x - s / 2} y={p.y - s / 2} width={s} height={s} className={room.key === focus ? 'dp-curve-on' : 'dp-faint'} /> })}
    </>
  }
  const {index, steps} = here ? walkOf(here) : {index: 0, steps: []}
  return {picture, corner: here ? (steps.length ? `${index + 1}/${steps.length}` : here.palace.title) : undefined, label: 'The plan of the rooms, the path through them and the room the walk stands in.', macros: <>
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
const COMPACTS: Readonly<Record<string, () => {picture: ReactNode; corner?: string; label: string; macros: ReactNode}>> = {
  'techne:m0': ProjectCompact, 'techne:m1': CanvasCompact, 'techne:m2': TimelineCompact, 'techne:m3': JourneyCompact, 'techne:m4': WorldCompact, 'techne:m5': PalaceCompact,
}

export const hasCompact = (id: string): boolean => id in COMPACTS

/** The Compact's body: its well and its four macros, read from the instrument's owners. A component per holder, so each reads its own. */
function CompactBody({id}: {id: string}) {
  const {picture, corner, label, macros} = COMPACTS[id]!()
  return <div className="techne-compact-body">
    <Display w={W} h={H} label={label} does={label} corner={corner}>{picture}</Display>
    <div className="techne-compact-macros">{macros}</div>
  </div>
}

/** An instrument on the rack at its Compact size: its head (light, mark, name, ⤢) and its body. Pressing the name or ⤢ opens it on the
 * focused pane — the press its fold always carried (TechneDevices.tsx openOnFocusedPane). */
export function InstrumentCompact({holder, mark, light, onOpen}: {holder: HolderDeclaration; mark: IconName; light: 'lit' | 'dark' | 'unknown'; onOpen: () => void}) {
  const words = `Open ${holder.title} on the focused pane, with every setting on its plate.`
  return <section className="techne-compact" data-instrument={holder.id} data-expanded="compact" data-rack="compact" aria-label={`${holder.title}, compact`}>
    <header className="techne-compact-head">
      <span className="dp-lamp" data-light={light} />
      <Icon name={mark} size={11} className="techne-compact-mark" />
      <button type="button" className="techne-compact-title" onClick={onOpen} data-i={said(holder.title, words)}>{holder.title}</button>
      {holder.provenance && <span className="techne-compact-k">{holder.provenance}</span>}
      <button type="button" className="techne-compact-open" aria-label={words} data-i={said('Open', words)} onClick={onOpen}>⤢</button>
    </header>
    <CompactBody key={holder.id} id={holder.id} />
  </section>
}

