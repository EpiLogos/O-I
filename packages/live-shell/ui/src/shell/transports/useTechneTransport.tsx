// Technē's transport bindings (moved from shell/modeTransports.tsx, which registers them; O-I #740: loaded when Technē's transport
// first draws). Back to Now, the occasion steps, and the World's Arm, Record and Capture over its walk.
import type {TransportBindings} from '../../frame/transport/slots'
import {readoutsOf, type UseModeTransport} from '../modeTransports'
import {slotMeaning} from '../modeGrammar'
import {occasionStepControl, returnToNowControl, useSpineRevision} from '../ModeTransportBar'
import {civilDayLabel} from './transportReadings'
import {civilDateOfDayRef} from '../../central/centralVertical'
import {useAtlasTimeBindings, useWalkBindings} from '../../projections/atlas/places/placesTransport'
import {useOptionalContinuity} from '../../continuity/workspace'
import {usePalaceWalkBindings} from '../../projections/atlas/palaces/palaceTransport'

export const useTechneTransport: UseModeTransport = ({readouts, timeSpine}) => {
  useSpineRevision(timeSpine)
  // Places is the atlas (T-PLACES-ONTO-ATLAS): Play and Stop press the atlas's one time button (the walk that stands, else the Earth's
  // clock through the shared window), and punch-in and punch-out read the window's edges (projections/atlas/places/placesTransport.ts).
  const atlasTime = useAtlasTimeBindings()
  // The World writes (O-I #760): Arm lets it, Record keeps a take of the places you visit, Capture keeps the view as a Scene; while a take
  // records or walks, Play, Stop and Stop n/N are its own, and with a stop of a take selected Play walks the take from it.
  const walk = useWalkBindings(useOptionalContinuity()?.current.context?.selection)
  // While a palace is entered its walk takes the one button (T-PALACES-ONTO-ATLAS, lane-5 T17): Play walks the palace locus by locus, Stop
  // holds it still, Walk pace and Stop n/8 read its dwell and its locus (projections/atlas/palaces/palaceTransport.ts); outside, none.
  const palaceWalk = usePalaceWalkBindings()
  // The clock that drives the panes (the mockup's `14:37 · 08 Oct`): the civil Now the World cut reads, with the civil day the
  // spine's own civil reading stands in (timeline/timeSpine.ts `now().dayRef`).
  const now = readouts?.position, day = civilDayLabel(civilDateOfDayRef(timeSpine?.now()?.dayRef))
  const clock = now && day && /\d/.test(now.value) ? {position: {readout: {value: `${now.value} · ${day}`, title: now.title}}} : {}
  const bindings: TransportBindings = {...readoutsOf(readouts), ...clock, ...atlasTime, ...walk, ...palaceWalk}
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
