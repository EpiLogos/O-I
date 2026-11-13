// Technē's transport bindings (moved from shell/modeTransports.tsx, which registers them; O-I #740: loaded when Technē's transport
// first draws). Back to Now, the occasion steps, and the World's Arm, Record and Capture over its walk; and the World's held field
// (O-I #858 TO04, TX14): Aperture and View as choose the World's own field view, Projected reads what your world shows, and Carrier
// names the field's service and this window's round trip to it. Draw is the Earth's Place tool (the mockup's "Draw mode becomes the
// Place tool on M4′"; manual §10.5 Technē "Place something"), armed and disarmed as the Earth's ✎ Place arms it; Follow is the focused
// pane's own Follow/Pin (manual §10.2 "A pane follows what you select, unless you pin it"), the act its ⊞ pin makes.
import {useSyncExternalStore} from 'react'
import type {SlotBinding, TransportBindings} from '../../frame/transport/slots'
import {readoutsOf, type UseModeTransport} from '../modeTransports'
import {slotMeaning} from '../modeGrammar'
import {occasionStepControl, returnToNowControl, useSpineRevision} from './spineControls'
import {civilDayLabel} from './transportReadings'
import {civilDateOfDayRef} from '../../central/centralVertical'
import {useAtlasTimeBindings, useWalkBindings} from '../../projections/atlas/places/placesTransport'
import {useOptionalContinuity} from '../../continuity/workspace'
import {usePalaceWalkBindings} from '../../projections/atlas/palaces/palaceTransport'
import {chooseFieldView, fieldView, heldField, subscribeSystem, systemReading, type FieldView} from '../../projections/atlas/system/systemStore'
import {useAtlasHandle, useSuiteStanding} from '../../projections/atlas/AtlasProjectionPanel'
import {selectedSubject} from '../../projections/atlas/places/PlacesPlate'
import {routeNext} from '../../projections/atlas/places/placesModel'
import {armPlaceTool, disarmPlaceTool, NO_OWNER, NO_SUBJECT, placeKindChoice, placeToolState, subscribePlaceTool} from '../../projections/atlas/places/placeTool'
import {useFocusedPane, type FocusedPane} from '../../native/workbenchDoor'
import {APERTURES, APERTURE_LABEL, AUDIENCES, AUDIENCE_LABEL, heldFieldWhy, shownLoad, yourShown, type Aperture, type Audience, type HeldField} from '../../projections/atlas/system/fieldModel'

/** Carrier (TX14): the SharedField service the window reads the field through, and how long its last read of the field took. */
function fieldCarrier(held: HeldField): {value: string; title: string} {
  const head = 'Carrier — the SharedField service your World reads the field through'
  if (held.state !== 'read') return {value: '—', title: `${head}. ${heldFieldWhy(held)}`}
  const ms = typeof held.trip === 'number' ? Math.max(1, Math.round(held.trip)) : null
  const service = held.carrier ? `${held.carrier.name}: the database ${held.carrier.database} at ${held.carrier.uri}` : 'the held field names no service'
  const round = ms === null ? 'No read of the field has been timed yet.' : `This window's last read of the field took ${ms} ms, the round trip from asking the kernel to its answer.`
  return {value: [held.carrier?.name, ms === null ? null : `${ms} ms`].filter(Boolean).join(' · ') || '—', title: `${head}, ${service}. ${round}`}
}
/** Projected (TO04): how much of your world it shows in the field, counted from the held field. */
function fieldProjected(held: HeldField, yours: string | null): {value: string; title: string} {
  const head = 'Projected — what your World shows in the field'
  if (held.state !== 'read') return {value: '—', title: `${head}. ${heldFieldWhy(held)}`}
  const shown = yourShown(held, yours)
  return {value: shown.length ? `${shown.length} shown` : 'none', title: `${head}: ${shownLoad(shown)}. Shown and withdrawn on the World's Shown page.`}
}
/** Aperture and View as (TO04): the World's own field view, chosen here as in the World; dimmed with the field's words while it is not read. */
function fieldChoice<K extends 'aperture' | 'viewAs'>(key: K, label: string, does: string, options: readonly FieldView[K][], words: Readonly<Record<FieldView[K], string>>, view: FieldView, why: string | undefined) {
  const title = `${label} — ${does}${why ? ` ${why}` : ''}`
  return {title, control: <select aria-label={label} title={title} disabled={why !== undefined} value={view[key]}
    onChange={event => chooseFieldView({[key]: event.target.value} as Partial<FieldView>)}>
    {options.map(option => <option key={option} value={option}>{words[option]}</option>)}
  </select>}
}

/** Key (TO04, TO05: "the transport's Key"): as Live's Key turns its scale on beside Root and Scale, Technē's turns the cloud on beside Aperture and
 * View as. Lit, your World stands as the field sees it (or the public, as View as beside it chooses), everything it has not shown them under the
 * one even cloud; pressed again, as you know it. Its face is the bar's own mark, never a word the bar can cut (walk r43: a face naming both was cut
 * when the bar was full); its words name both. It changes what you see, never what you show: raising what an audience sees of your world asks
 * first, on the World's Shown page (TO06). Dimmed with the field's words while the field is not read. */
export function fieldKey(view: FieldView, why: string | undefined): SlotBinding {
  if (why !== undefined) return {refused: why}
  const clouded = view.viewAs !== 'me', as = view.viewAs === 'public' ? 'the public' : 'the field'
  const title = `Aperture · view as — ${APERTURE_LABEL[view.aperture]}, looked at as ${AUDIENCE_LABEL[view.viewAs]}: `
    + (clouded ? `your World as ${as} sees it, everything you have not shown ${as} under the one even cloud. Press to look as you know it.`
      : 'your World as you know it, nothing under cloud. Press to look as the field sees it; View as beside it chooses Field or Public.')
    + ' It changes what you see, never what you show; raising what an audience sees of your world asks first, on the World’s Shown page.'
  return {press: () => chooseFieldView({viewAs: clouded ? 'me' : 'field'}), lit: clouded, title}
}

/** Draw (Technē's Place tool): the Earth's ✎ Place, armed for the subject the Earth has selected (PlacesPlate.tsx LocationsSection's
 * press, without its chosen row's move); pressed again, or Esc on the Earth, it gives the tool back. Lit while armed. With no Earth open, or
 * no subject chosen on it, it stays drawn with the plate's own words. The tool offers a draft; only the subject's owner saves it. */
export function usePlaceBinding(): SlotBinding {
  const handle = useAtlasHandle()
  const tool = useSyncExternalStore(subscribePlaceTool, placeToolState, placeToolState)
  const standing = useSuiteStanding()
  const subject = selectedSubject(handle)
  const armed = tool.phase === 'armed'
  if (!handle) return {refused: NO_OWNER}
  if (!armed && !subject) return {refused: NO_SUBJECT}
  const said = tool.phase === 'idle' && tool.notice ? ` ${tool.notice}` : ''
  return {lit: armed, press: () => {
    if (armed) { disarmPlaceTool(); return }
    const chosen = selectedSubject(handle)
    armPlaceTool(chosen ? {...chosen, ...(placeKindChoice() === 'route' ? {routeNext: routeNext(standing.places, chosen.ref)} : {})} : null)
  }, title: armed
    ? `Place tool — armed for ${tool.subject.title}: click the Earth where it stands. Press again, or Esc, to give the tool back.`
    : `Place tool — arm the Earth's Place for ${subject!.title}: the next click on the Earth offers its point to the subject's own editor.${said}`}
}

/** Follow (Technē's): the focused pane follows what you meet, or stands pinned to its subject — the pane's own Follow/Pin. Lit while it
 * follows; pressed, a following pane pins to THE selection it shows, and a pinned one follows again. Pure over the pane and the selection. */
export function followBinding(pane: FocusedPane | null, selection: {ref: string; title?: string} | null | undefined): SlotBinding {
  if (!pane) return {refused: 'No pane is focused, so there is no pane to keep with what you meet.'}
  if (!pane.follows) return {refused: `The focused pane (${pane.title}) holds its own subject and does not follow the selection.`}
  if (pane.pinned) return {lit: false, press: () => pane.pin(undefined),
    title: `Follow — the focused pane (${pane.title}) is pinned to its subject. Press to let it follow what you meet again.`}
  const ref = selection?.ref
  return {lit: true, ...(ref ? {press: () => pane.pin(ref)} : {}),
    title: `Follow — the focused pane (${pane.title}) follows what you meet.${ref ? ` Press to pin it to ${selection?.title ?? ref}.` : ' Select something to pin it to.'}`}
}

export const useTechneTransport: UseModeTransport = ({readouts, timeSpine}) => {
  useSpineRevision(timeSpine)
  // Places is the atlas (T-PLACES-ONTO-ATLAS): Play and Stop press the atlas's one time button (the walk that stands, else the Earth's
  // clock through the shared window), and punch-in and punch-out read the window's edges (projections/atlas/places/placesTransport.ts).
  const atlasTime = useAtlasTimeBindings()
  // The World writes (O-I #760): Arm lets it, Record keeps a take of the places you visit, Capture keeps the view as a Scene; while a take
  // records or walks, Play, Stop and Stop n/N are its own, and with a stop of a take selected Play walks the take from it.
  const selection = useOptionalContinuity()?.current.context?.selection
  const walk = useWalkBindings(selection)
  const draw = usePlaceBinding(), follow = followBinding(useFocusedPane(), selection)
  // While a palace is entered its walk takes the one button (T-PALACES-ONTO-ATLAS, lane-5 T17): Play walks the palace locus by locus, Stop
  // holds it still, Walk pace and Stop n/8 read its dwell and its locus (projections/atlas/palaces/palaceTransport.ts); outside, none.
  const palaceWalk = usePalaceWalkBindings()
  // The clock that drives the panes (the mockup's `14:37 · 08 Oct`): the civil Now the World cut reads, with the civil day the
  // spine's own civil reading stands in (timeline/timeSpine.ts `now().dayRef`).
  const held = useSyncExternalStore(subscribeSystem, heldField, heldField), view = useSyncExternalStore(subscribeSystem, fieldView, fieldView)
  const system = useSyncExternalStore(subscribeSystem, systemReading, systemReading)
  const yours = system.state === 'read' ? system.bodies.find(body => body.yours)?.bodyRef ?? null : null, why = heldFieldWhy(held)
  const field: TransportBindings = {
    root: fieldChoice('aperture', 'Aperture', 'how far you look: world, local, shared or federated. It filters the one system and takes you nowhere. The World’s own Aperture, chosen here or there.',
      APERTURES as readonly Aperture[], APERTURE_LABEL, view, why),
    scale: fieldChoice('viewAs', 'View as', 'who you look as: your world as you know it, as the field sees it, or as the public sees it. The World’s own View as, chosen here or there.',
      AUDIENCES as readonly Audience[], AUDIENCE_LABEL, view, why),
    key: fieldKey(view, why),
    draw, follow,
    rate: {readout: fieldCarrier(held)},
    cpu: {readout: fieldProjected(held, yours)},
  }
  const now = readouts?.position, day = civilDayLabel(civilDateOfDayRef(timeSpine?.now()?.dayRef))
  const clock = now && day && /\d/.test(now.value) ? {position: {readout: {value: `${now.value} · ${day}`, title: now.title}}} : {}
  const bindings: TransportBindings = {...readoutsOf(readouts), ...clock, ...field, ...atlasTime, ...walk, ...palaceWalk}
  if (!timeSpine) return bindings
  const brace = timeSpine.transport().loopClipIds
  const length = slotMeaning('techne', 'loop-length')
  return {...bindings,
    tap: {control: returnToNowControl(timeSpine, slotMeaning('techne', 'tap'))},
    loop: {control: occasionStepControl(timeSpine, slotMeaning('techne', 'loop'))},
    ...(brace?.length ? {'loop-length': {readout: {value: `${brace.length} clip${brace.length === 1 ? '' : 's'}`,
      title: `${length.label} — ${length.fn}. The spine holds this window read-only: ${brace.length} clip${brace.length === 1 ? '' : 's'}.`}}} : {}),
  }
}
