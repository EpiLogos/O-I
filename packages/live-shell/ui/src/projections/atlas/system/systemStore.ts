// Your system as the shell last read it (T-WORLDS §5 W3 phase B): the bodies of today's worlds and what circles them
// (system/systemModel.ts systemOf), published by the readings the pane holds (system/SystemReadings.tsx) and read by the globe's
// overlay (system/systemOverlay.ts), the World device and the browser's Bodies group. It holds the last reading and nothing else:
// no body is kept, defaulted or invented here, and every write goes to its owner through the acts the readings bind.
import type {SystemBody, SystemSatellite} from './systemModel'
import type {Aperture, Audience, HeldField, SayingWhat, StarComes} from './fieldModel'

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
  /** Take a landed world off your planet: its body kept whole, without the landing, as one BodySet on its register at the revision
   * read. A landing is never permanent. Resolves with the owner's acknowledgement. */
  unland(body: SystemBody): Promise<string>
  /** [O-I #858] One act at a star (system/fieldModel.ts starRequest), asked of the held SharedField through the kernel's
   * `shared_field` op. Resolves with what the field did, in a line; rejects with the field's own words. */
  fieldAct(request: Record<string, unknown>): Promise<string>
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

/** No bodies: one list, so a reader that compares snapshots (useSyncExternalStore) sees the same value until the system is read. */
const NO_BODIES: readonly SystemBody[] = []

/** The bodies as they read now (none while the system is not read). */
export const systemBodies = (): readonly SystemBody[] => (reading.state === 'read' ? reading.bodies : NO_BODIES)

// ── the Field scale: the held field as the window last read it, and the view's own choices (manual §17.2; O-I #858) ─────────
//
// The reading is published by the pane's readings (system/SystemReadings.tsx), read through the kernel's `shared_field` op and retired
// by the field's own news; the choices are the view's own hand (whether the Field is the scale drawn, the aperture and who you look
// as), never written anywhere.

/** The view's own choices at Field scale. */
export interface FieldView {
  /** the Field is the scale drawn (the other scales are the camera's) */
  readonly field: boolean
  readonly aperture: Aperture
  readonly viewAs: Audience
}

let field: HeldField = {state: 'reading'}
let fieldChoice: FieldView = {field: false, aperture: 'world', viewAs: 'me'}

export const heldField = (): HeldField => field
export const fieldView = (): FieldView => fieldChoice

export function publishField(next: HeldField): void {
  if (JSON.stringify(next) === JSON.stringify(field)) return
  field = next
  notify()
}

export function chooseFieldView(next: Partial<FieldView>): void {
  const made = {...fieldChoice, ...next}
  if (made.field === fieldChoice.field && made.aperture === fieldChoice.aperture && made.viewAs === fieldChoice.viewAs) return
  fieldChoice = made
  notify()
}

/** The view's own hand at a star (manual §17.2 items 9 and 10; SF06): the star chosen, the waiting world chosen to let in, a star to
 * light (its name, what it gathers and who may come) until it is lit, what to say there (to what, of what kind, in what words) until
 * it is said, and the page of its day and of what was said there. Never written anywhere; the acts go to the field. */
export interface StarHand {
  readonly star: string | null
  readonly admit: string | null
  readonly name: string
  readonly gathers: string
  readonly comes: StarComes
  /** what something is said to, or the saying to unsay: a thing shown at the star (fieldModel.ts shownId) or a saying's ref */
  readonly to: string | null
  readonly what: SayingWhat
  readonly words: string
  /** the page of the star's day and of what was said there you turned to, or null for the newest */
  readonly dayPage: number | null
  readonly saidPage: number | null
}

let hand: StarHand = {star: null, admit: null, name: '', gathers: '', comes: 'anyone', to: null, what: 'question', words: '', dayPage: null, saidPage: null}

export const starHand = (): StarHand => hand

export function chooseStarHand(next: Partial<StarHand>): void {
  const made = {...hand, ...next}
  if ((Object.keys(made) as (keyof StarHand)[]).every(key => made[key] === hand[key])) return
  hand = made
  notify()
}
