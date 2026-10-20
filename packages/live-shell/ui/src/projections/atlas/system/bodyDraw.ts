// The one drawer of the body the globe shows (T-PROCEDURAL-BODY §6 item 3; manual §17.2 "Your system": "Earth is always as it is"; "Choose a past
// occasion and … the weather on every body you built … follow it"). It reads, and writes nothing:
//   - the body to draw: your own world's record while your world is chosen and it reads (body/worldBody.ts shownBody), the world you entered
//     when another world is the body (system/enteredWorld.ts), else none, which is the Earth; and the look it is drawn with, read from how lived
//     in that world is (system/systemStore.ts, each SystemBody's `look`): the Earth is given no look;
//   - the occasion: the shared time window's instant (sharedClock.ts's window, one authority with the Earth's day and night), Now when none stands.
// It tells the globe (globe/engine.ts, ticket §4) only when what it draws moved: a body is redrawn when its record or its look changed, never
// for a notice that carried nothing new (a redraw is the generator's whole cost). The look rides beside the owner's record and is held nowhere.
import type {DisclosureSession} from '../../../../../../../desktop/cradle/src/techne/contract'
import type {DisclosureSessionStore} from '../../../../../../../desktop/cradle/src/techne/session'
import {parseTimestamp} from '../../../../../../../desktop/cradle/src/techne/m0m5/timeline/scale'
import type {BodyLook, WorldBodyRecord} from '../src/globe/body'
import {bodyChoice, shownBody, subscribeWorldBody} from '../body/worldBody'
import {enteredWorld, subscribeEnteredWorld} from './enteredWorld'
import {subscribeSystem, systemBodies} from './systemStore'

/** The globe as the drawer takes it (ticket §4): the body it shows with the look it is drawn with, and the occasion its weather stands at. A host
 * whose globe draws no body (a stub in a test) leaves them out, as body/worldBody.ts bindWorldBody's engine does. */
export interface BodyEngine {
  setBody?(record: WorldBodyRecord | null, look?: BodyLook): void
  setBodyTime?(ms: number | null): void
}

type SharedWindow = NonNullable<DisclosureSession['time_window']>

/** One edge of a window as the time authority reads it (scale.ts parseTimestamp, never the platform parser): NaN for an edge that is open or does not parse. */
function edgeMs(edge: string | null | undefined): number {
  if (!edge) return Number.NaN
  try { return parseTimestamp(edge) } catch { return Number.NaN }
}

/** The instant a shared window stands at: the midpoint of a bounded window (the rule the Earth's day and night already follow, sharedClock.ts
 * windowYear), its bounded edge when one is open, and null, Now, for all time and for a window that does not parse. */
export function occasionMs(window: SharedWindow | null | undefined): number | null {
  if (!window) return null
  const from = edgeMs(window.from), to = edgeMs(window.to)
  if (Number.isFinite(from) && Number.isFinite(to)) return (from + to) / 2
  if (Number.isFinite(from)) return from
  if (Number.isFinite(to)) return to
  return null
}

/** How wide a step of the occasion a small disc is told in: six hours. Weather is carried over days (the cloud bands move slowly), so a disc of
 * fifty pixels shows nothing of a step this short, and a played occasion redraws a disc four times a day of its time, not on every frame. */
export const OCCASION_STEP_MS = 6 * 60 * 60 * 1000

/** The step an instant falls in, as its start; Now stays null. */
export const occasionStep = (ms: number | null): number | null => (ms === null ? null : Math.floor(ms / OCCASION_STEP_MS) * OCCASION_STEP_MS)

let occasion: number | null = null
const occasionListeners = new Set<() => void>()

/** The instant the drawer last read from the shared window, ms; null, Now, while none stands or none is bound. The one reading of the window the
 * System has: the discs beside your planet draw the weather of the same occasion (system/systemOverlay.ts), so the window is subscribed once. */
export const shownOccasion = (): number | null => occasion

export function subscribeOccasion(listener: () => void): () => void {
  occasionListeners.add(listener)
  return () => { occasionListeners.delete(listener) }
}

/** What the globe is to draw now: the record and its look, or none (the Earth). */
function drawn(): {readonly record: WorldBodyRecord | null; readonly look: BodyLook | undefined} {
  if (bodyChoice() === 'other') {
    const world = systemBodies().find(body => body.key === enteredWorld())
    return {record: world?.record ?? null, look: world?.look}
  }
  const record = shownBody()
  return {record, look: record ? systemBodies().find(body => body.yours)?.look : undefined}
}

/** Bind the drawer to the mounted globe and the shared window: the body and its look at once, then on each change of either; the occasion at
 * once, then on each change of the window. Released with the atlas. */
export function bindBodyDraw({engine, store}: {readonly engine: BodyEngine; readonly store: DisclosureSessionStore}): {dispose(): void} {
  let live = true
  let bodyKey = ''
  const drawBody = () => {
    if (!live) return
    const {record, look} = drawn()
    const key = JSON.stringify([record, look ?? null])
    if (key === bodyKey) return
    bodyKey = key
    if (record) engine.setBody?.(record, look ?? {})
    else engine.setBody?.(null)
  }
  let time: number | null | undefined
  const drawTime = () => {
    if (!live) return
    const next = occasionMs(store.get()?.time_window)
    if (next === time) return
    time = next
    occasion = next
    engine.setBodyTime?.(next)
    for (const listener of [...occasionListeners]) listener()
  }
  const offs = [subscribeWorldBody(drawBody), subscribeSystem(drawBody), subscribeEnteredWorld(drawBody), store.subscribe(drawTime)]
  drawBody()
  drawTime()
  return {dispose() { live = false; occasion = null; for (const off of offs) off() }}
}
