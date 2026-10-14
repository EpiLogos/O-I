// Stands in for projections/atlas/mount.ts in the attach tests (tests/atlas-dispose.test.mjs). The real mountAtlas needs
// WebGL and a corpus bundle; this stub keeps the contract the real one keeps: it opens the atlas lifetime, binds a window
// listener and a pending timer under it, and its dispose releases them through that lifetime.
import {beginLifetime, later, listen} from '../../src/projections/atlas/src/ui/lifetime.ts'

const state = {mounts: 0, disposals: 0, fail: false}

export function stubState() {
  return state
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
  return {
    engine: {setPaused() {}, dispose() {}},
    ctl: {state: {graph: false}, toggleMode() {}},
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
