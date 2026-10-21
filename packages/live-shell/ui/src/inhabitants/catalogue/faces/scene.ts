// A crew scene: a pattern performed by several whole creatures in one pane (face-rig creature-crew.js and crew-*.js; CREW-NOTES.md). The pane
// is the face rig's own: a habitat under the bodies, each member a complete kit creature, one camera, and the pattern a generator whose every
// step is something a body does. A face holds the scene as it holds a single creature (spec 25.2): it runs while the agents are at work
// (thinking, acting, producing), holds where it is while they wait, freezes in a stall, and does not begin before something has happened. A failed
// crew plays the pattern's own failure (the mill, the tug of war, the mimic), the hazard of spec 22.8.
import {crewSpec, use, type Kit} from './vendor'
import type {RunState} from './agency'

/** Which scene performs a pattern: the file, the scene's title, the pattern it runs, and the failure it plays when the crew fails. */
export interface SceneDef {readonly file: string; readonly title: string; readonly id: string; readonly fail?: string}
export const SCENES: Readonly<Record<string, SceneDef>> = {
  trail: {file: 'crew-ant', title: 'ANT', id: 'trail', fail: 'mill'},
  clear: {file: 'crew-ant', title: 'ANT', id: 'clear', fail: 'painted'},
  haul: {file: 'crew-ant', title: 'ANT', id: 'haul', fail: 'deadlock'},
  tend: {file: 'crew-honeybee', title: 'HONEYBEE', id: 'tend'},
  recruit: {file: 'crew-honeybee', title: 'HONEYBEE', id: 'recruit'},
  quorum: {file: 'crew-honeybee', title: 'HONEYBEE', id: 'quorum', fail: 'quorum-tie'},
  guard: {file: 'crew-honeybee', title: 'HONEYBEE', id: 'guard', fail: 'guard-mimic'},
  relay: {file: 'crew-monarch', title: 'MONARCH', id: 'relay', fail: 'relay-break'},
}

export interface Scene {
  set(state: RunState): void
  setReduced(on: boolean): void
  setRunning(on: boolean): void
  /** The pane's aspect, height over width. */
  readonly aspect: number
  destroy(): void
}

/** The scenes share their file's world (the hive, the sand): one scene of each file at a time. A second asks for the same world and is refused, and its face
 * stands the crew as bodies on the pane's ground instead. */
const busy = new Set<string>()

export async function mountScene(host: HTMLElement, pattern: string, o: {state: RunState; reduced: boolean}): Promise<Scene | null> {
  const def = SCENES[pattern]
  if (!def || busy.has(def.file)) return null
  busy.add(def.file)
  try { await use(def.file) } catch (cause) { busy.delete(def.file); throw cause }
  const spec = crewSpec(def.title)
  if (!spec || !host.isConnected) { busy.delete(def.file); return null }
  const view = spec.view as {x: number; y: number; w: number; h: number}
  const aspect = view.h / view.w
  const crew = window.CreatureCrew.make(host, {view})
  const scene = (spec.setup(crew, {}) || {}) as {patterns?: Kit[]}
  crew.patterns = scene.patterns ?? []
  crew.snapCam()
  const pick = (id: string) => crew.patterns.find((x: Kit) => x.id === id)
  let state: RunState = o.state, reduced = o.reduced, running = true, started: string | null = null
  const hold = (on: boolean) => { crew.paused = on; for (const m of crew.members) m.c.pause(on) }
  const begin = (id: string) => { const P = pick(id); if (!P) return; crew.cancel(); crew.pattern = P; crew.start(P.id, P.run); started = id }
  // A crew that is shown mid-way (it was working before the face drew) is placed by running its clock ahead, coarsely: the bodies take their
  // places and no one sees it happen.
  const ahead = (ms: number) => { crew.advance(ms, 60); crew.live(); }
  const apply = () => {
    const wantFail = state === 'failed' && def.fail && pick(def.fail)
    const id = wantFail ? def.fail! : def.id
    if (started !== id) begin(id)
    const moves = state === 'thinking' || state === 'acting' || state === 'producing' || state === 'failed'
    if (reduced) { if (state !== 'queued' && crew.t < 4000) ahead(state === 'done' ? 9000 : 4000); hold(true); return }
    if (!moves && state !== 'queued' && crew.t < 2500) ahead(state === 'done' ? 9000 : 3000)
    hold(!moves || !running)
  }
  apply()
  return {
    aspect,
    set(next) { if (next === state) return; state = next; apply() },
    setReduced(on) { if (on === reduced) return; reduced = on; apply() },
    setRunning(on) { running = on; apply() },
    destroy() { busy.delete(def.file); try { crew.destroy() } catch { /* the pane let go already */ } host.innerHTML = '' },
  }
}
