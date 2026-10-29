// A coordinate's name in Quaternal Logic's map: the registry's own name for it (`ql kernel ledger <coordinate> --json`, `ql.m-ledger-view/v1`
// coordinate.names), read through the kernel's ql_read {kind: 'kernel-ledger'} (desktop/cradle/kernel/src/owner_routes.rs
// QlRead::KernelLedger). The Torus's and Resonance's tattva is announced by its coordinate (the live scene's M2 condition,
// expressions-app instrumentCondition.ts); its name is the map's. Each coordinate is read once per session: the map does not move under a
// running shell. Pure apart from the one kernel call, which takes the call it is given, and the small store the views share.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {FrameInstrumentCondition} from '@epilogos/expressions-boundary'
import type {Standing, Value} from '../../../frame/devices/designed'

export type CoordinateName = {readonly ok: true; readonly name: string} | {readonly ok: false; readonly reason: string; readonly busy?: boolean}

/** The registry's name of the coordinate asked, or the reason in words. */
export function readCoordinateName(answer: KernelOpCall, ref: string): CoordinateName {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'Quaternal Logic did not answer `ql kernel ledger`.'}
  const outcome = answer.outcome as {result?: string; data?: {schema?: unknown; coordinate?: {source_ref?: unknown; names?: unknown}}}
  if (outcome.result !== 'owner_route_reading' || outcome.data?.schema !== 'ql.m-ledger-view/v1') return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not QL's ledger view.`}
  if (outcome.data.coordinate?.source_ref !== ref) return {ok: false, reason: `QL answered another coordinate than ${ref}.`}
  const names = outcome.data.coordinate.names
  return Array.isArray(names) && typeof names[0] === 'string' && names[0] ? {ok: true, name: names[0]} : {ok: false, reason: `The map gives ${ref} no name.`}
}

export type NameCall = (op: KernelOp) => Promise<KernelOpCall>
let names: ReadonlyMap<string, CoordinateName> = new Map()
let call: NameCall = op => kernelOp(detectTransport(), op)
const listeners = new Set<() => void>()
const publish = (ref: string, name: CoordinateName) => { names = new Map([...names, [ref, name]]); for (const listener of [...listeners]) listener() }

export function coordinateNames(): ReadonlyMap<string, CoordinateName> { return names }

/** Read a coordinate's name once. */
export async function ensureCoordinateName(ref: string): Promise<void> {
  if (names.has(ref)) return
  publish(ref, {ok: false, reason: `Reading the map's name for ${ref}…`, busy: true})
  let name: CoordinateName
  try {
    name = readCoordinateName(await call({op: 'ql_read', request: {kind: 'kernel-ledger', coordinate: ref}}), ref)
  } catch (error) {
    name = {ok: false, reason: `The kernel could not be asked for the map's name: ${error instanceof Error ? error.message : String(error)}`}
  }
  publish(ref, name)
}

/** Tests: forget every name, and use another call. */
export function resetCoordinateNames(next: {call?: NameCall} = {}): void {
  names = new Map(); call = next.call ?? (op => kernelOp(detectTransport(), op))
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The map's name of the coordinate, read once; null while no coordinate is given. */
export function useCoordinateName(ref: string | null): CoordinateName | null {
  useEffect(() => { if (ref) void ensureCoordinateName(ref) }, [ref])
  const all = useSyncExternalStore(subscribe, coordinateNames, coordinateNames)
  return ref ? all.get(ref) ?? {ok: false, reason: `Reading the map's name for ${ref}…`, busy: true} : null
}

// ── the tattva of the live scene's M2 condition, as the Torus and Resonance draw it ──

export const NO_CONDITION = 'The live scene has announced no M2 condition yet: the native field announces it once it has inspected its sources (open the live instrument).'
export const TATTVA_READ = 'A reading: the tattva of the live scene\'s M2 condition, by the map\'s name for its coordinate; the condition changes with the event.'
export const FIBRE_READ = 'A reading: the element fibre of the live scene\'s M2 condition, as QL gives it.'

/** The tattva keys from the announced condition and the map's name of its coordinate: each a reading, or absent with its reason. */
export function tattvaKeys(condition: FrameInstrumentCondition | null | undefined, name: CoordinateName | null): {values: Record<string, Value>; standing: Record<string, Standing>} {
  const values: Record<string, Value> = {}
  const standing: Record<string, Standing> = {}
  if (!condition) return {values, standing: {'tattva.name': {disabled: NO_CONDITION}, 'tattva.fibre': {disabled: NO_CONDITION}}}
  if (condition.material_fibre) { values['tattva.fibre'] = condition.material_fibre; standing['tattva.fibre'] = {disabled: FIBRE_READ} }
  else standing['tattva.fibre'] = {disabled: 'The live scene\'s M2 condition gives no element fibre.'}
  if (!condition.tattva_ref) standing['tattva.name'] = {disabled: 'The live scene\'s M2 condition stands on no tattva.'}
  else if (name?.ok) { values['tattva.name'] = name.name; standing['tattva.name'] = {disabled: TATTVA_READ} }
  else standing['tattva.name'] = {disabled: name?.reason ?? `Reading the map's name for ${condition.tattva_ref}…`}
  return {values, standing}
}

// ── M2's body constants by element fibre: what the tattva sets under Body source Tattva (manual §21.2, §20.14) ──
// The owner is QL's M2 (`ql kernel body-constants`, `ql.m2-body-constants/v1`, crates/ql-mef/src/m2_body.rs), read through the kernel's
// ql_read {kind: 'body-constants'} (desktop/cradle/kernel/src/owner_routes.rs QlRead::BodyConstants): each fibre's Strike (a share),
// Q factor, Agitation and Boundary strength with the tattvas the map gives it, and the table's standing ('proposed': a starting point,
// tunable). Read once per session, like a coordinate's name: the table does not move under a running shell.

export interface BodyRow {
  readonly fibre: string
  readonly tattvas: readonly string[]
  readonly strike_share: number
  readonly q_factor: number
  readonly agitation: number
  readonly boundary_strength: number
}
export type BodyTable = {readonly ok: true; readonly standing: string; readonly rows: readonly BodyRow[]} | {readonly ok: false; readonly reason: string; readonly busy?: boolean}

const finiteIn = (x: unknown, lo: number, hi: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi

/** QL's table as the shell reads it, or the reason in words. */
export function readBodyTable(answer: KernelOpCall): BodyTable {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'Quaternal Logic did not answer `ql kernel body-constants`.'}
  const outcome = answer.outcome as {result?: string; data?: {schema?: unknown; standing?: unknown; rows?: unknown}}
  if (outcome.result !== 'owner_route_reading' || outcome.data?.schema !== 'ql.m2-body-constants/v1') return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not M2's body constants.`}
  const rows = (Array.isArray(outcome.data.rows) ? outcome.data.rows : []).flatMap((raw): BodyRow[] => {
    const row = raw as Record<string, unknown>
    return typeof row?.fibre === 'string' && Array.isArray(row.tattvas) && row.tattvas.every(t => typeof t === 'string') && finiteIn(row.strike_share, 0, 1)
      && finiteIn(row.q_factor, 0.1, 40) && finiteIn(row.agitation, 0, 5) && finiteIn(row.boundary_strength, 0, 30)
      ? [{fibre: row.fibre, tattvas: row.tattvas as string[], strike_share: row.strike_share, q_factor: row.q_factor, agitation: row.agitation, boundary_strength: row.boundary_strength}] : []
  })
  if (!rows.length || typeof outcome.data.standing !== 'string') return {ok: false, reason: 'M2\'s body constants came back without a row or a standing.'}
  return {ok: true, standing: outcome.data.standing, rows}
}

let body: BodyTable | null = null
const READING_TABLE = 'Reading M2\'s body constants…'
const NO_TABLE: BodyTable = {ok: false, reason: READING_TABLE, busy: true}
export function bodyTable(): BodyTable { return body ?? NO_TABLE }

/** Read M2's body constants once. */
export async function ensureBodyTable(): Promise<void> {
  if (body) return
  body = NO_TABLE
  let table: BodyTable
  try {
    table = readBodyTable(await call({op: 'ql_read', request: {kind: 'body-constants'}}))
  } catch (error) {
    table = {ok: false, reason: `The kernel could not be asked for M2's body constants: ${error instanceof Error ? error.message : String(error)}`}
  }
  body = table
  for (const listener of [...listeners]) listener()
}

/** Tests: forget the table (resetCoordinateNames gives the call). */
export function resetBodyTable(): void { body = null; for (const listener of [...listeners]) listener() }

/** M2's body constants, read once. */
export function useBodyTable(): BodyTable {
  useEffect(() => { void ensureBodyTable() }, [])
  return useSyncExternalStore(subscribe, bodyTable, bodyTable)
}

export const BODY_SOURCES = ['declared', 'tattva'] as const
export type BodySource = typeof BODY_SOURCES[number]

/** The constants the tattva sets under Tattva: the table's row for the condition's fibre; none (with why) where there is no fibre or table. */
export function tattvaBody(condition: FrameInstrumentCondition | null | undefined, table: BodyTable | null): {row: BodyRow} | {row: null; why: string} {
  if (!condition) return {row: null, why: NO_CONDITION}
  if (!condition.material_fibre) return {row: null, why: 'The live scene\'s tattva carries no element fibre: under Tattva the body keeps the values you set.'}
  if (!table) return {row: null, why: READING_TABLE}
  if (!table.ok) return {row: null, why: table.reason}
  const row = table.rows.find(item => item.fibre === condition.material_fibre)
  return row ? {row} : {row: null, why: `M2's body constants hold no row for the ${condition.material_fibre} fibre.`}
}

