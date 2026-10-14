// What the owners say about the two documents a Central pane holds (no React; each read is the owner's own client).
//  - the Day: the owner's `central` op `open-day` — the one read path the Day's craft uses (central/useCentralDayStanding.ts).
//    Its answer is interpreted by the same function the detail row uses (centralVertical.ts `interpretDayOpen`), so the pane
//    says what the detail row says: ready, "no native document yet" (with the op that would admit it), or refused — each in
//    the owner's own sentence.
//  - a Flow: the owner's file route over Control/user/flows (flow/instances.ts `listFlowInstances`).
// A read that fails is a state with the owner's words in it; nothing here fills a document in.
import {central} from '../../../../../../desktop/cradle/src/central/client'
import {listFlowInstances, type FlowInstanceRow} from '../../../../../../desktop/cradle/src/flow/instances'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {dayOpenRequest, interpretDayOpen, type DayDocumentStanding} from '../centralVertical'

/** What a Day that was asked for as "the current one" is called until the owner names its date. */
const CURRENT_DAY = 'today'

const dayRefOf = (data: unknown): string | null => {
  const ref = (data as {day?: {day_ref?: unknown}} | undefined)?.day?.day_ref
  return typeof ref === 'string' ? ref : null
}

/** The owner's standing for one Day: `dayRef` names a civil date, null the current Day (the owner's `open-day` with no day ref).
 * Never rejects — a refusal arrives as the standing's own state. */
export async function readDayStanding(transport: KernelTransportStatus, dayRef: string | null): Promise<DayDocumentStanding> {
  const request = dayRef ? dayOpenRequest(dayRef) : {kind: 'open-day' as const}
  const answer = await central<unknown>(transport, null, request).then(
    (data): {data: unknown; error?: undefined} => ({data}),
    (error: unknown): {error: string; data?: undefined} => ({error: error instanceof Error ? error.message : String(error)}),
  )
  return interpretDayOpen(dayRef ?? dayRefOf(answer.data) ?? CURRENT_DAY, answer)
}

// ── the most recent Flow ─────────────────────────────────────────────────

/** A Flow instance is named for the minute it was created (`flow-2026-10-14-2050.html`; a same-minute collision takes a
 * numeric suffix, `-2`, `-3` — flow/instance.ts `instanceFileName`). The name is the owner's own record of when it was made:
 * the listing carries no clock. */
const STAMPED = /^flow-(\d{4}-\d{2}-\d{2}-\d{4})(?:-(\d+))?\.html$/i

function rankOf(name: string): {stamp: string; n: number} | null {
  const match = name.match(STAMPED)
  return match ? {stamp: match[1], n: match[2] ? Number(match[2]) : 1} : null
}

/** The most recently created Flow of a listing: stamped names by their minute and then their collision suffix, newest first;
 * a name the owner's minting did not give (a Flow someone named by hand) ranks behind every stamped one. Null for an empty
 * listing. */
export function latestFlowOf<T extends Pick<FlowInstanceRow, 'name'>>(rows: readonly T[]): T | null {
  const ranked = [...rows].sort((a, b) => {
    const left = rankOf(a.name), right = rankOf(b.name)
    if (left && right) return right.stamp.localeCompare(left.stamp) || right.n - left.n
    if (left || right) return left ? -1 : 1
    return b.name.localeCompare(a.name)
  })
  return ranked[0] ?? null
}

export type FlowReading =
  | {readonly state: 'found'; readonly row: FlowInstanceRow; readonly count: number}
  | {readonly state: 'none'}
  | {readonly state: 'refused'; readonly message: string}

/** The owner's Flow listing, reduced to the most recent one. Never rejects. */
export async function readLatestFlow(transport: KernelTransportStatus): Promise<FlowReading> {
  try {
    const rows = await listFlowInstances(transport)
    const row = latestFlowOf(rows)
    return row ? {state: 'found', row, count: rows.length} : {state: 'none'}
  } catch (error) {
    return {state: 'refused', message: error instanceof Error ? error.message : String(error)}
  }
}
