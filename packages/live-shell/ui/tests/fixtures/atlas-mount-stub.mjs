// Stands in for projections/atlas/mount.ts in the attach tests (tests/atlas-dispose.test.mjs). The real mountAtlas needs
// WebGL and a corpus bundle; this stub keeps the contract the real one keeps: it opens the atlas lifetime, binds a window
// listener and a pending timer under it, and its dispose releases them through that lifetime.
import {beginLifetime, later, listen} from '../../src/projections/atlas/src/ui/lifetime.ts'

const state = {mounts: 0, disposals: 0, fail: false, refuseState: false}

export function stubState() {
  return state
}

/** The next reads of the controller's state refuse, so an attach that reads it fails part way (after the attach has made its
 * observers and subscriptions). Off by default. */
export function refuseStateReads(on) {
  state.refuseState = on
}

/** The next mount refuses, as a failing corpus or a WebGL-less device does. */
export function failNextMount() {
  state.fail = true
}

export async function mountAtlas() {
  if (state.fail) {
    state.fail = false
    throw Error('stub mount refused')
  }
  const life = beginLifetime()
  state.mounts++
  listen(globalThis.window, 'keydown', () => {})
  later(() => {}, 60_000)
  // T-PLACES-ONTO-ATLAS: the attach binds Places (places/placesHost.ts) to the engine's frame, its canvas and its camera
  const canvas = {dataset: {}, addEventListener() {}, removeEventListener() {}}
  return {
    engine: {setPaused() {}, dispose() {}, onFrame() {}, renderer: {domElement: canvas}, rig: {lat: 0, lon: 0, dist: 3.8, shiftX: 0, shiftY: 0, flyTo() {}}, camera: {fov: 38, aspect: 1}, sky: null},
    ctl: {
      get state() {
        if (state.refuseState) throw Error('stub state refused')
        return {graph: false}
      },
      toggleMode() {},
    },
    time: null,
    model: null,
    replaceOccurrence() {
      return {changed: false}
    },
    dispose() {
      state.disposals++
      life.dispose()
    },
  }
}
