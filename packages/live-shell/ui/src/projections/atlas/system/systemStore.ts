// Your system as the shell last read it (T-WORLDS §5 W3 phase B): the bodies of today's worlds and what circles them
// (system/systemModel.ts systemOf), published by the readings the pane holds (system/SystemReadings.tsx) and read by the globe's
// overlay (system/systemOverlay.ts), the World device and the browser's Bodies group. It holds the last reading and nothing else:
// no body is kept, defaulted or invented here, and every write goes to its owner through the acts the readings bind.
import type {SystemBody, SystemSatellite} from './systemModel'
import type {Aperture, Audience, ContributionWhat, HeldField, SayingWhat, ShowTo, ShownTo, StarComes} from './fieldModel'

// The even cloud (manual §17.2 View as; system/fieldModel.ts keeps the rest of the field's model). Kept here, beside the view's own
// choice of whom you look as, because the Palace's cloud (palaces/palacesModel.ts) is drawn in the window's first load and must not
// carry the whole field model with it (O-I #858; round 30b).
const REACH: Readonly<Record<Exclude<ShownTo, 'star'>, number>> = {me: 0, field: 1, public: 2}
/** Whether a part shown to `shownTo` lies under cloud for `audience`: never for you; for the field and the public, unless it was shown
 * to them or wider. A part shown at a star is shown there alone. */
export function cloudedFor(shownTo: ShownTo, audience: Audience): boolean {
  if (audience === 'me') return false
  if (shownTo === 'star') return true
  return REACH[shownTo] < REACH[audience]
}

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
  /** [O-I #858 SF12, SF13] One request of Software Factory through the kernel's `factory_owner` op (a Run's shown work, an act on a task
   * offered at a star): Factory's document, or a rejection in its words. Absent where no kernel carrier stands. */
  factory?(request: Record<string, unknown>): Promise<unknown>
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
  /** [SF12, SF13] the Run of Software Factory's chosen (its key in the Factory reading), the unit of it to offer, the work of yours shown
   * here chosen, the offer chosen; the grant to offer under (what the task may read and touch, in refs, and the days it stands); and
   * what was made, to bring back to an offer your world took (its label, a line on it, and the ref of the grant it touched) */
  readonly run: string | null
  readonly unit: string | null
  readonly work: string | null
  readonly offer: string | null
  readonly reads: string
  readonly touches: string
  readonly days: number
  readonly made: string
  readonly summary: string
  readonly madeRef: string | null
  /** [SF13] the Factory state a task your world takes up is kept in, chosen on the face; null for the first located */
  readonly taker: string | null
  /** [SF01, SF02, SF14] the name your world is to stand in the field under, until it is linked; the part of your world chosen to show and
   * who is to see it (none of either until you choose: nothing is shown by default); and the thing your world shows chosen to withdraw */
  readonly worldName: string
  readonly showPart: string | null
  readonly showTo: ShowTo | null
  readonly shownPart: string | null
  /** [SF07] what to contribute to (a part another world shows, by fieldModel.ts shownKey with its world, or a contribution's ref), what it
   * is and its words, until it is contributed; the contribution chosen to answer or take back, and the words to answer it with */
  readonly contributeTo: string | null
  readonly contributeWhat: ContributionWhat
  /** a claim of the same work's part of yours to set beside it (SF09): what your world shows, by its shownKey */
  readonly contributeBeside: string | null
  readonly contributeWords: string
  readonly contribution: string | null
  readonly answerWords: string
  /** another's world chosen on the Space page, to watch or unwatch (DLW build ruling 2026-11-06) */
  readonly other: string | null
  /** a search over the shared field being written (`@name = words`), the searches this window keeps, and the one chosen to forget (DLW
   * build ruling 2026-11-06, from manual §18.4: no owner keeps a mark a client can read with its Reach, so the World keeps its own here) */
  readonly searchLine: string
  readonly searches: readonly WorldSearch[]
  readonly search: string | null
}
/** A search you made over the shared field: its name, its plain words, and when it was kept (ms since the epoch); what is newly shown,
 * said, offered or contributed there that holds every word reaches you from it. */
export interface WorldSearch {readonly name: string; readonly words: string; readonly at: number}

let hand: StarHand = {star: null, admit: null, name: '', gathers: '', comes: 'anyone', to: null, what: 'question', words: '', dayPage: null, saidPage: null,
  run: null, unit: null, work: null, offer: null, reads: '', touches: '', days: 7, made: '', summary: '', madeRef: null, taker: null,
  worldName: '', showPart: null, showTo: null, shownPart: null, contributeTo: null, contributeWhat: 'question', contributeWords: '', contributeBeside: null, contribution: null, answerWords: '', other: null, searchLine: '', searches: [], search: null}

export const starHand = (): StarHand => hand

export function chooseStarHand(next: Partial<StarHand>): void {
  const made = {...hand, ...next}
  if ((Object.keys(made) as (keyof StarHand)[]).every(key => made[key] === hand[key])) return
  hand = made
  notify()
}

// ── Software Factory at a star (manual §6, §17.2; O-I #858 SF12, SF13) ────────────────────────────────────────────────────
//
// The Runs of Software Factory's that this window's Factory states hold, each with the name Factory shows it under, read by the pane's
// readings (system/SystemReadings.tsx) through the kernel's factory_owner (`locate`, then each state's project and each Run's shown work)
// while the Field is the scale drawn; the units of the Run chosen, to offer one; the state the taker's side of an offer is kept in, and
// where each offer that state took up stands there (its `offers` reading), or why that was not read.

/** One Run that may be shown at a star. `key` names it in the view's hand. */
export interface FactoryRun {
  readonly key: string
  readonly statePath: string
  readonly runRef: string
  readonly name: string
  readonly standing: string
  readonly project: string | null
  /** the revision Factory reads the Run at (its `factory.shown-work/v1`), null when it names none: a work shown at an older one is
   * shown again (§17.2) */
  readonly revision?: number | null
}
/** A Factory state a task may be taken up in: its state file, and the project it keeps (null for Central's own). */
export interface FactoryTaker {
  readonly statePath: string
  readonly project: string | null
}
/** A unit of a Run, as an offer names its task. */
export interface FactoryUnit {
  readonly ref: string
  readonly key: string
}
export type FactoryAtStar =
  | {readonly state: 'reading'}
  | {readonly state: 'unavailable'; readonly reason: string}
  | {readonly state: 'read'; readonly runs: readonly FactoryRun[]; readonly takerState: string | null
    /** the Factory states this window can take a task up in, each by the name a person knows it by: the one chosen is `takerState` */
    readonly takers?: readonly FactoryTaker[]
    readonly units: {readonly run: string; readonly units: readonly FactoryUnit[]} | {readonly run: string; readonly why: string} | null
    /** each offer one of the takers' states took up, by its ref, with where it stands there (taken, returned, revoked); absent or null
     * while unread */
    readonly taken?: Readonly<Record<string, string>> | null; readonly takenWhy?: string
    /** the state that took each offer up, by its ref: the one a Return or a revocation goes to, whichever state is chosen now */
    readonly takenAt?: Readonly<Record<string, string>> | null
    /** what each state gave back to an offer it took (Factory's `factory.task-offer-return/v1`), by the offer's ref: a Return the field did
     * not hear is carried to it from here, whatever the hand holds */
    readonly returns?: Readonly<Record<string, Readonly<Record<string, unknown>>>> | null}

let factory: FactoryAtStar = {state: 'reading'}
export const factoryAtStar = (): FactoryAtStar => factory
export const runKeyOf = (statePath: string, runRef: string): string => JSON.stringify([statePath, runRef])

export function publishFactory(next: FactoryAtStar): void {
  if (JSON.stringify(next) === JSON.stringify(factory)) return
  factory = next
  notify()
}

/** A revocation told to the Factory that took the task up (O-I #858 SF13; DLW build ruling 2026-11-06): being told, told, or refused in
 * Factory's words. Each offer is told once in a window's life, read after read; a refusal stays to be seen. */
export type Relay = {readonly state: 'telling'} | {readonly state: 'told'} | {readonly state: 'refused'; readonly why: string}
const relays = new Map<string, Relay>()
export const relayOf = (offerRef: string): Relay | undefined => relays.get(offerRef)
export function noteRelay(offerRef: string, relay: Relay): void {
  relays.set(offerRef, relay)
  notify()
}
