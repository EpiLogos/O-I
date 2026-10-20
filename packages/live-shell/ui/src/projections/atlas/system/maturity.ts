// How finished a world's body looks (T-PROCEDURAL-BODY §6 item 2; manual §17.2 "Your system": "A world you have barely begun is a small grey
// moon: dry, airless, with no cloud. As you work in it, it gains seas, air, colour and weather, until a project you have lived in for a year
// is a planet with weather. Three things count: how long the world has existed, how much it holds (its pages and flows), and how many times
// you have shaped it, by its body or by its places. More of any makes it more finished; none of them ever makes it less. The look is read from
// those, never stored"). Two pure functions and the named numbers they stand on. The shell holds no body (ticket §2): maturity and look are
// readings computed from owner readings, held nowhere and written nowhere, and Earth is always as it is (nothing here is asked of it).
//
// The readings a WorldFacts is made of are the owners' (system/worldFacts.ts): the oldest change the register's change horizon keeps, the
// world's page listing, and the revision of the register's root space. The look is the generator's own (globe/body.ts BodyLook, ticket §4).
import type {BodyLook} from '../src/globe/body'

/** What is read of one world: how long its register has existed, how many pages and flows it holds, how many times it has been shaped. */
export interface WorldFacts {
  readonly ageMs: number
  readonly held: number
  readonly shaped: number
}

// What each reading counts for, and where it counts in full. A reading saturates at its "full": beyond it more changes nothing, so a world
// never looks less finished for a reading, and a very old or very full world is no more than a finished one.
//
// AGE_FULL_MS is the manual's own number: "a project you have lived in for a year". It under-reads where the owner's horizon began after the
// register did (Central's change horizon is the oldest dated record the owner keeps of a register; it is not its creation, which no owner
// states), so such a world looks younger than it is, never older.
export const AGE_FULL_MS = 365 * 24 * 60 * 60 * 1000
/** Thirty pages and flows is a shelf's worth: a project's ground that holds that many is past a sketch. */
export const HELD_FULL = 30
/** The register's space revision counts every facts write on it, a body set and a place set alike (WorldBodyReading.space.revision): twenty is
 * a world whose body has been shaped and whose places declared, more than once over. */
export const SHAPED_FULL = 20
/** Time and what a world holds count most, and equally: a body can be shaped in an afternoon, a world cannot be lived in by one. They sum to 1,
 * so all three at their full make a finished world, and no one of them alone makes a planet. */
export const WEIGHTS = {age: .4, held: .4, shaped: .2} as const

/** A moon below this maturity: about a month of life holding a handful of pages is where a body begins to turn. */
export const LOOK_FROM = .1
/** A planet with its seas, air and weather at and above this: most of a year, a shelf of pages, a body shaped. */
export const LOOK_TO = .75

/** One reading's share of its full, 0..1: a reading that is not a positive number counts as nothing. */
const share = (reading: number, full: number): number => (reading > 0 ? Math.min(reading, full) / full : 0)

/** How finished a world is, 0 new … 1 lived in. Monotone in each reading, bounded, and the same for the same readings. */
export function maturityOf(facts: WorldFacts): number {
  const finished = WEIGHTS.age * share(facts.ageMs, AGE_FULL_MS) + WEIGHTS.held * share(facts.held, HELD_FULL) + WEIGHTS.shaped * share(facts.shaped, SHAPED_FULL)
  return Math.min(1, finished)
}

/** The look a maturity gives a body: a moon until LOOK_FROM, a planet from LOOK_TO, and a smooth turn between (barren = 1 − smoothstep, flat at
 * both ends so no step shows as a jump). A maturity that is not a number is a moon: no reading, no finish. */
export function lookOf(maturity: number): BodyLook {
  const m = maturity > 0 ? Math.min(maturity, 1) : 0
  const t = Math.min(1, Math.max(0, (m - LOOK_FROM) / (LOOK_TO - LOOK_FROM)))
  return {barren: 1 - t * t * (3 - 2 * t)}
}
