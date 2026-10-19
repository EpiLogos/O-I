// Your system as the shell last read it (T-WORLDS §5 W3 phase B): the bodies of today's worlds and what circles them
// (system/systemModel.ts systemOf), published by the readings the pane holds (system/SystemReadings.tsx) and read by the globe's
// overlay (system/systemOverlay.ts), the World device and the browser's Bodies group. It holds the last reading and nothing else:
// no body is kept, defaulted or invented here, and every write goes to its owner through the acts the readings bind.
import type {SystemBody, SystemSatellite} from './systemModel'

export type SystemReading =
  | {readonly state: 'unbound'}
  | {readonly state: 'reading'}
  | {readonly state: 'unavailable'; readonly reason: string}
  /** `set` says why today's set holds only your world (the Day not opened yet, its document not made), or null when it is read. */
  | {readonly state: 'read'; readonly bodies: readonly SystemBody[]; readonly set: string | null}

/** The owners' acts the readings bind: open a satellite, and land a world on your planet. */
export interface SystemActs {
  open(satellite: SystemSatellite, body: SystemBody): Promise<void>
  /** Land a world of today's set on your planet at a point of it: one BodySet on that world's register, on the revision read (its
   * body as it reads, or the body seeded from its ref, with the landing). Resolves with the owner's acknowledgement. */
  land(body: SystemBody, lat: number, lon: number): Promise<string>
}

let reading: SystemReading = {state: 'unbound'}
let acts: SystemActs | null = null
const listeners = new Set<() => void>()
const notify = () => { for (const listener of [...listeners]) listener() }

export const systemReading = (): SystemReading => reading
export const systemActs = (): SystemActs | null => acts
export function subscribeSystem(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function publishSystem(next: SystemReading): void {
  if (JSON.stringify(next) === JSON.stringify(reading)) return
  reading = next
  notify()
}

/** Bind the acts (or, with null, release them); the reading goes back to unbound when they are released. */
export function bindSystemActs(next: SystemActs | null): void {
  acts = next
  if (!next) reading = {state: 'unbound'}
  notify()
}

/** The bodies as they read now (none while the system is not read). */
export const systemBodies = (): readonly SystemBody[] => (reading.state === 'read' ? reading.bodies : [])
