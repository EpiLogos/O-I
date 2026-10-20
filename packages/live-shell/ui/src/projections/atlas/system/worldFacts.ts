// The readings a world's maturity is made of (T-PROCEDURAL-BODY §6 item 2), from its owners and never a copy of them. A pure reading:
//   - ageMs   how long its register has existed: now minus the oldest change its change horizon keeps (Central's `central` inspect,
//             `sources.data.changes`: desktop/cradle/kernel/src/central.rs:200, desktop/cradle/src/central/client.ts readGround). That horizon is
//             Central's record of every change it has observed in the register, so its first row is the nearest owner reading of when the
//             register began; no owner states a register's creation. Told in whole days, so the clock's minute never moves it and a body is
//             not drawn again for it;
//   - held    how many pages and flows it holds: the page owner's listing of the world's folder, every form (central/centralWorlds.ts
//             readWorldPages → PageListing.pages);
//   - shaped  how many times it has been shaped: the revision of its register's root space (WorldBodyReading.space.revision, desktop/cradle/
//             src/kernel/types.ts; kernel construction.rs read_body), which every facts write on the space bumps, a body set and a place set
//             alike. The record carries no count of its own (it does not change).
// A world whose horizon, page listing or space is not read has no facts: no reading, no claim.
import type {WorldFacts} from './maturity'

const DAY_MS = 24 * 60 * 60 * 1000

/** The facts of one world, or null while any of its three readings is not in. `horizon` is the change horizon as the owner answered it,
 * `pages` the length of the page listing, `revision` the space's revision, `nowMs` the instant the age is read against. */
export function worldFactsOf(readings: {readonly nowMs: number; readonly horizon: unknown; readonly pages: number | null | undefined; readonly revision: number | null | undefined}): WorldFacts | null {
  const {nowMs, horizon, pages, revision} = readings
  const changes = typeof horizon === 'object' && horizon !== null && 'changes' in horizon && Array.isArray(horizon.changes) ? horizon.changes : null
  if (changes === null || typeof pages !== 'number' || !(pages >= 0) || typeof revision !== 'number' || !(revision >= 0)) return null
  let oldest = Infinity
  for (const change of changes) {
    const at: unknown = typeof change === 'object' && change !== null && 'observed_at_unix_seconds' in change ? change.observed_at_unix_seconds : undefined
    if (typeof at === 'number' && Number.isFinite(at)) oldest = Math.min(oldest, at * 1000)
  }
  const age = Number.isFinite(oldest) ? Math.max(0, nowMs - oldest) : 0
  return {ageMs: Math.floor(age / DAY_MS) * DAY_MS, held: pages, shaped: revision}
}
