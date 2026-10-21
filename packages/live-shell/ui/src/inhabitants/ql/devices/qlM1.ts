// The M1 engine's cells for the M′ matrices' Oscillator (manual §22.6; the design's `m1.cells`, quaternal-logic__m-prime-matrices.tsx),
// read from Quaternal Logic's own `ql kernel m1` through the kernel's ql_read {kind: 'kernel-m1'} (desktop/cradle/kernel/src/owner_routes.rs
// ql_read; answers ql.m1.engine/v1). QL's M1 engine is "a bounded in-memory operational owner … Storage, authorization and realtime
// interpolation belong to its consumers" (crates/ql-mef/src/m1_engine.rs M1Engine): it answers one cell per request, so the family's
// matrix is its 144 cells, each asked once and kept for the session with the registry revision that answered (a family whose answers
// name two revisions is refused in words, to be read again).
// The engine's config is the consumer's: the family, row and position are the view's own (qlMatrices.ts), and every other field of the
// request is QL's own example request (fixtures/kernel/m1-engine-v1.request.json) — the cell is the source literal at (family, row,
// position) (crates/ql-mef/src/m1.rs `cell`: raw_terms from row × position), and depends on none of them. The selected coordinate is the
// family's own, `#1-2-<family>`, as QL names the cell's coordinate (m1.rs `cell`). No M1 clock runs in the shell, so no tick is read.
// Pure apart from the kernel call it is given and the small store the views share.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../../desktop/cradle/src/kernel/types'

/** One cell as the matrix draws it: [raw, digit root, decimal], each null where QL states none (the Quintessence has no scalar; a decimal
 * only within ten by ten). */
export type M1Cell = readonly [number | null, number | null, number | null]

/** QL's example request (fixtures/kernel/m1-engine-v1.request.json), for the fields the cell does not depend on. */
export const M1_EXAMPLE_CONFIG = {event_ref: 'example:cosmic-event', subject_coordinate: '#1', revision: '0', cycle: '1', tick12: 7, flowering_substage: 3,
  lens12: 11, context_frame: 7, basis: 'fifths'} as const

/** The request for one cell of a family. */
export function m1Request(family: number, row12: number, col12: number) {
  return {schema: 'ql.m1.engine/v1', config: {...M1_EXAMPLE_CONFIG, selected_coordinate: `#1-2-${family}`, family, row12, col12}, action: null}
}

const nullable = (x: unknown): number | null | undefined => (x === null ? null : Number.isSafeInteger(x) ? x as number : undefined)

/** The cell QL answered, admitted only when it is the cell asked for; else the reason in words. */
export function readM1Answer(answer: KernelOpCall, family: number, row12: number, col12: number):
  {readonly ok: true; readonly cell: M1Cell; readonly revision: string | null} | {readonly ok: false; readonly reason: string} {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'Quaternal Logic did not answer `ql kernel m1`.'}
  const outcome = answer.outcome as {result?: string; data?: Record<string, any>}
  if (outcome.result !== 'owner_route_reading' || outcome.data?.schema !== 'ql.m1.engine/v1') return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not QL's M1 engine.`}
  const cell = outcome.data.cell as Record<string, unknown> | undefined
  if (!cell || cell.family !== family || cell.row12 !== row12 || cell.col12 !== col12) return {ok: false, reason: 'QL answered another cell than the one asked.'}
  const raw = nullable(cell.raw), dr = nullable(cell.digit_root), decimal = nullable(cell.decimal10)
  if (raw === undefined || dr === undefined || decimal === undefined) return {ok: false, reason: 'QL\'s cell carries no raw value, digit root or decimal.'}
  return {ok: true, cell: [raw, dr, decimal], revision: typeof outcome.data.registry_revision === 'string' ? outcome.data.registry_revision : null}
}

export type M1Call = (op: KernelOp) => Promise<KernelOpCall>

// ── the store the views share ───────────────────────────────────────────────

export interface QlM1State {
  /** The family whose cells are asked for; null while none is chosen. */
  readonly family: number | null
  /** Its 144 cells, row by row, once every one has answered. */
  readonly cells: readonly (readonly M1Cell[])[] | null
  /** The registry revision the cells answer for. */
  readonly revision: string | null
  readonly reason: string | null
  readonly busy: boolean
}
const INITIAL: QlM1State = {family: null, cells: null, revision: null, reason: null, busy: false}
let state: QlM1State = INITIAL
let sequence = 0
let call: M1Call = op => kernelOp(detectTransport(), op)
/** The families read, by family, with the revision they answered for. */
const kept = new Map<number, {cells: M1Cell[][]; revision: string | null}>()
const listeners = new Set<() => void>()
const setState = (next: QlM1State) => { if (next !== state) { state = next; for (const listener of [...listeners]) listener() } }
/** How many cells are asked at once: the kernel's owner limiter serialises its own spawns; a few keeps the matrix arriving. */
const AT_ONCE = 4

export function qlM1State(): QlM1State { return state }

/** Read a family's 144 cells (or take the ones kept); only the newest family asked stands. A refusal of any cell stands in its words. */
export async function syncQlM1(family: number | null): Promise<void> {
  if (family === null || !Number.isInteger(family) || family < 0 || family > 5) { setState({...INITIAL}); return }
  const known = kept.get(family)
  if (known) { setState({family, cells: known.cells, revision: known.revision, reason: null, busy: false}); return }
  if (state.family === family && state.busy) return
  const ticket = ++sequence
  setState({family, cells: null, revision: null, reason: null, busy: true})
  const cells: M1Cell[][] = Array.from({length: 12}, () => Array<M1Cell>(12))
  const asks = Array.from({length: 144}, (_, i) => [Math.floor(i / 12), i % 12] as const)
  let revision: string | null = null, refused: string | null = null, next = 0
  const worker = async () => {
    while (next < asks.length && !refused && ticket === sequence) {
      const [row, col] = asks[next++]!
      let answer: KernelOpCall
      try {
        answer = await call({op: 'ql_read', request: {kind: 'kernel-m1', request: m1Request(family, row, col)}} as KernelOp)
      } catch (error) {
        answer = {outcome: null, error: `The kernel could not be asked for QL's M1 engine: ${error instanceof Error ? error.message : String(error)}`}
      }
      const read = readM1Answer(answer, family, row, col)
      if (!read.ok) { refused = read.reason; return }
      if (revision !== null && read.revision !== revision) { refused = 'QL\'s registry moved while the family was read: read it again.'; return }
      revision = read.revision
      cells[row]![col] = read.cell
    }
  }
  await Promise.all(Array.from({length: AT_ONCE}, worker))
  if (ticket !== sequence) return
  if (refused) { setState({family, cells: null, revision: null, reason: refused, busy: false}); return }
  kept.set(family, {cells, revision})
  setState({family, cells, revision, reason: null, busy: false})
}

/** Tests: start again, with another call. */
export function resetQlM1(next: {call?: M1Call} = {}): void {
  sequence++; state = INITIAL; kept.clear(); call = next.call ?? (op => kernelOp(detectTransport(), op))
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The cells of the family the view holds, read when it changes. */
export function useQlM1(family: unknown): QlM1State {
  const asked = typeof family === 'number' ? family : null
  useEffect(() => { void syncQlM1(asked) }, [asked])
  return useSyncExternalStore(subscribe, qlM1State, qlM1State)
}
