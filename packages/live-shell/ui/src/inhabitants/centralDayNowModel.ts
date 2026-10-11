/** Central day/now craft — the civil stratum's device half (WORLD-SHELL-DESIGN
 * §12, §15.2; ticket L7 commission 3).
 *
 * §15.2: civil time is OWNED by Central (`civil-time-policy.json`); the time
 * spine exposes "the current day/NOW" as the default Now; day operations are
 * Central-family devices. This module is that device's pure half:
 *
 * - The civil reading stands on the kernel's temporal read
 *   (`op temporal_events_read` — the L4 spine's own owner); the policy row
 *   (timezone, day boundary, rollover) is the owner's contract carried
 *   verbatim from the reading's `field` — never generated, never a wall clock.
 * - The day/now operations (close, rollover, archive recovery) are DECLARED
 *   temporal controls bound to their native actions. They are authenticated
 *   owner mutations (`CENTRAL_NATIVE_TOKEN`-gated), so a device never fires
 *   them: each renders declared, naming its action, its authority and the
 *   receipt it would carry. The lane that walks a recovery reads only.
 * - The subject basis strip: when the selected material is a Central
 *   subject, the detail craft shows CAS identity, basis and the save
 *   router's named outcomes — "this world's warp markers" (§12). The strip
 *   reuses the document device model's outcome names verbatim.
 *
 * Pure TypeScript. No React, no transport, no timers, no store. */

import type {SaveRouterReading} from './documentDeviceModel.ts'
import {SAVE_ROUTER_OUTCOMES} from './manifest.ts'
import type {BoundaryOpSource} from './centralHygieneModel.ts'

export {SAVE_ROUTER_OUTCOMES}

// ---------------------------------------------------------------------------
// the civil field — the reading the spine already stands on

/** The civil field row the kernel's temporal read carries
 * (`oi.temporal-events/v1` → `field`). */
export interface CivilFieldPolicy {
  readonly day_scope?: string
  readonly timezone?: string
  readonly day_boundary_minutes?: number
  readonly policy_revision?: string
}

export interface CivilFieldReading {
  /** The day the reading stands in (the reading's own day ref / scope). */
  readonly dayRef: string | null
  readonly policy: CivilFieldPolicy
  /** The instant the reading observed — the owner's, not the device's. */
  readonly observedCivilInstant: string | null
  /** The boundary op that produced the reading. */
  readonly boundaryOp: string
  readonly at: string
  readonly refusal: string | null
}

// ---------------------------------------------------------------------------
// declared temporal controls — bound to their native actions, never fired

export type CivilControlId = 'day-close' | 'day-rollover' | 'archive-recovery'

export interface CivilTemporalControl {
  readonly id: CivilControlId
  readonly label: string
  /** The native action (or commissioned method) the control is bound to. */
  readonly nativeAction: string
  /** The action surface it runs on (root register vs project register). */
  readonly surface: string
  /** The authority the mutation needs — named, because it is why the device
   * never fires it (owner-rotated token; lifecycle policy revisions). */
  readonly authority: string
  /** The receipt a real firing lands with — what the owner returns. */
  readonly receiptShape: string
  /** Always `declared`: the device renders the control and waits. */
  readonly admission: 'declared'
  readonly note: string
}

export const CIVIL_TEMPORAL_CONTROLS: readonly CivilTemporalControl[] = [
  {
    id: 'day-close',
    label: 'Close the day',
    nativeAction: 'central.day.lifecycle (authenticated; central-day-close skill is the method of record)',
    surface: 'root register + the project registers (ProjectCentral/now/day/<date>.md)',
    authority: 'CENTRAL_NATIVE_TOKEN (owner-rotated) + the civil-time policy revision as expected_time_policy_revision',
    receiptShape: 'day lifecycle event + the closed day\'s .sources snapshot + the carry-forward list',
    admission: 'declared',
    note: 'Closes the standing day: the moving horizon ends, the archive holds the byte-exact close. Fires only from the owner\'s authenticated surface — never from a device or a lane.',
  },
  {
    id: 'day-rollover',
    label: 'Roll the NOW horizon over',
    nativeAction: 'projectcentral.now.rollover (project scope) / central.now lifecycle (root)',
    surface: 'the register the NOW clearing hangs from',
    authority: 'CENTRAL_NATIVE_TOKEN + the day/next-day pair the owner chooses',
    receiptShape: 'rollover return + the next local civil day recorded on the horizon',
    admission: 'declared',
    note: 'Moves the NOW field onto the next civil day. A mutation of the live field — the device declares it; a session with the token performs it.',
  },
  {
    id: 'archive-recovery',
    label: 'Recover an unclosed day',
    nativeAction: 'central-archive-recovery (skill METHOD; central.day.read / projectcentral registers as its read route)',
    surface: 'the register whose calendar holds the gap',
    authority: 'owner commission — "Never fabricate a day record" (field-health law); reconstruction reconstructs',
    receiptShape: 'the reconstructed day reading + its .sources snapshot + the returns it walked, each attributed',
    admission: 'declared',
    note: 'Walks a day that never closed (or a close that failed midway) from its real records. Reads only, even in recovery: the write belongs to the owner\'s close routine.',
  },
]

// ---------------------------------------------------------------------------
// the subject basis strip — CAS identity, basis, save-router states

/** A Central subject's identity as the owner discloses it: the CAS revision
 * is the craft §12 names — this world's warp marker. */
export interface CentralSubjectBasis {
  /** The subject's Central ref (central:source / central:path grammar). */
  readonly ref: string
  /** The CAS revision the owner holds (`central.content-fnv1a64/v1:<len>:<hash>`). */
  readonly revision: string
  readonly byteLen: number | null
  /** The owning project, when the subject hangs from one. */
  readonly project: string | null
  /** The civil day the subject stands in, when it carries one (a day record). */
  readonly dayRef: string | null
  /** The civil-time policy revision the reading stood on. */
  readonly timePolicyRevision: string | null
  /** The save-router state the subject's device last reached (absent
   * before any attempt — an honest absence, never a fabricated state). */
  readonly saveOutcome: SaveRouterReading | null
  /** The boundary op that read the subject. */
  readonly boundaryOp: string
  readonly at: string
}

/** The CAS grammar's three parts, for the strip's typed display. A revision
 * outside the grammar is still shown verbatim — shown, never normalised. */
export function casParts(revision: string): {scheme: string; length: string; digest: string} | null {
  const match = revision.match(/^(central\.content-fnv1a64\/v1):(\d+):([0-9a-f]+)$/)
  if (!match) return null
  return {scheme: match[1], length: match[2], digest: match[3]}
}

/** The short form the strip's mono readout carries: the digest's first
 * twelve characters, with the length — the warp marker's readable face.
 * The full revision stays one disclosure away (title attribute in the face). */
export function casShort(revision: string): string {
  const parts = casParts(revision)
  if (!parts) return revision
  return `:${parts.digest.slice(0, 12)} · ${parts.length} B`
}

/** One timeline of the subject's basis: the readings that touched it, in
 * order, each naming its boundary op. The day recovery walk is this list,
 * read end-to-end. */
export interface BasisWalkStep {
  readonly at: string
  readonly label: string
  readonly boundaryOp: string
  readonly detail: string
}

export interface DayWalkReading {
  readonly day: string
  readonly basis: CentralSubjectBasis
  readonly steps: readonly BasisWalkStep[]
  /** The day record's carry-forward refs, as the record itself lists them. */
  readonly carryForward: readonly string[]
  /** Returns at close, as the record's own section lists them (actor + kind + status). */
  readonly returns: readonly {actor: string; kind: string; status: string; subject: string}[]
  readonly sources: readonly BoundaryOpSource[]
}

/** Parse the day record's markdown (the owner's own closure reading) into
 * the walk's read-only projection: returns, carry-forward refs. Parsing is
 * textual and honest — a section that is absent parses to empty, and the
 * raw record stays the authority (the strip links it). */
export function parseDayRecord(content: string): Pick<DayWalkReading, 'carryForward' | 'returns'> {
  const carryForward: string[] = []
  const returns: {actor: string; kind: string; status: string; subject: string}[] = []
  const lines = content.split('\n')
  let section: 'carry' | 'returns' | null = null
  let current: {actor: string; kind: string; status: string; subject: string} | null = null
  for (const line of lines) {
    if (line.startsWith('## ')) {
      section = line.includes('Carry forward') ? 'carry' : line.includes('Agent returns') || line.includes('Human current source') ? 'returns' : null
      current = null
      continue
    }
    if (section === 'carry' && line.startsWith('- `')) {
      const ref = line.match(/`([^`]+)`/)?.[1]
      if (ref) carryForward.push(ref)
      continue
    }
    if (section === 'returns') {
      const heading = line.match(/^### (.+)$/)
      if (heading) {
        if (current) returns.push(current)
        current = {actor: '', kind: '', status: '', subject: heading[1].trim()}
        continue
      }
      if (!current) continue
      const actor = line.match(/^- actor: `([^`]+)`/)
      if (actor) { current.actor = actor[1]; continue }
      const kind = line.match(/^- kind: `([^`]+)`/)
      if (kind) { current.kind = kind[1]; continue }
      const status = line.match(/^- status at close: `([^`]+)`/)
      if (status) { current.status = status[1]; continue }
    }
  }
  if (current) returns.push(current)
  return {carryForward, returns}
}

/** The civil day key a subject stands in, when its path carries one
 * (`…/now/day/2026-10-08.md` → `2026-10-08`). */
export function subjectDayRef(path: string): string | null {
  const match = path.match(/(\d{4}-\d{2}-\d{2})\.md$/)
  return match ? match[1] : null
}
