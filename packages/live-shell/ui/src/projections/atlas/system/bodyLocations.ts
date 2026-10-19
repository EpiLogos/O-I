// The locations on your own body (T-WORLDS §5 W3 phase B; manual §17.2 "Build a planet": "Click the body to place a place … Every world
// you start lands as a place on your planet"): what stands on the body you build, read from what its owners returned. Pure: no DOM, no
// transport. The World device's Locations read it (inhabitants/ql/devices/atlasDevices.ts), and the globe draws it on your body
// (system/systemOverlay.ts), each where it stands, or on the nearest shore where its spot is sea (globe/body.ts shoreOf: drawing only,
// its coordinate never changes).
//
// Two owners place things on your body, and nothing else does:
//   - a place an owner declares on it: a place facet whose body_ref is your body's (AIKit PlaceFacet.body_ref; the suite reading carries
//     it as SuitePlace.body_ref and its point as on_body, provider/suiteReading.ts locateOnBody), written by its subject's PlaceSet;
//   - a world of today's set that lands on it: its own body record's landing (system/systemModel.ts landingLocations), written by that
//     world's BodySet.
import {firstBody, type WorldBodyState} from '../body/worldBody'
import type {SuitePlace} from '../provider/suiteStanding'
import {landingLocations, type SystemBody} from './systemModel'

/** One location on your body, as the World design's Locations read it (atlas-earth__globe-engine.tsx `locations`: {id, name, lat, lon, kind}). */
export interface BodyLocation {readonly id: string; readonly name: string; readonly lat: number; readonly lon: number; readonly kind: string}

export type BodyLocations = {readonly rows: readonly BodyLocation[]} | {readonly unread: string}

export const LOCATIONS_READING = 'Your body’s locations are read with your owners’ places and your system’s worlds.'

/** The locations on your own body: every place an owner declares on it, at its own point, then every world of today's set that lands on
 * it. While neither owner has answered, the reason, never a list. Pure. */
export function yourLocations(state: WorldBodyState, places: readonly SuitePlace[], placesRead: boolean, system: readonly SystemBody[] | null): BodyLocations {
  if (state.state !== 'read') return {unread: state.state === 'refused' ? state.reason : LOCATIONS_READING}
  if (!placesRead && !system) return {unread: LOCATIONS_READING}
  // a body not built yet is the body seeded from its ref (body/worldBody.ts firstBody), the one the globe draws: what stands on it stands
  // on that ref, which is the ref its first write keeps
  const bodyRef = state.record ? state.record.body_ref : firstBody(state.reading.space.ref, state.reading.space.revision).body_ref
  const own = places.flatMap(place => place.body_ref === bodyRef && place.on_body
    ? [{id: place.ref, name: place.name, lat: place.on_body.lat, lon: place.on_body.lon, kind: 'place'}] : [])
  const landed = system ? landingLocations(system) : []
  return {rows: [...own.filter((row, index) => own.findIndex(other => other.id === row.id) === index), ...landed]}
}
