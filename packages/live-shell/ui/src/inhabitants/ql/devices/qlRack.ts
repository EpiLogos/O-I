// The rack of an instrument of the map (manual §16.16, §22.9), for the Rack pages of the Torus (M1′), the Sky (M2′) and the M3 clock (M3′),
// drawn by the catalogue's RackBands (inhabitants/catalogue/panels/quaternal-logic__map-rack.tsx) on the keys `rack` and `rack.part`.
// The owner is Quaternal Logic's M registry and ledger, read coordinate by coordinate through the kernel's ql_read {kind: 'kernel-ledger'}
// (desktop/cradle/kernel/src/owner_routes.rs QlRead::KernelLedger, `ql kernel ledger <coordinate> --json`, `ql.m-ledger-view/v1`):
//   positions, parts  the coordinate's children by reference and name (`child_coordinates`, QL-MEF #347), in the registry's order. Where the
//                     registry holds both spellings of one child (#4-0 and #4.0), the one the nesting threshold writes is kept (after a 4 the
//                     separator is ".", else "-": QL-MEF skills/ql-law); a ql whose view names children only by id leaves the rack absent;
//   ledger            three steps from each coordinate's own view: in the map (the view answers), bound (a computational binding names the
//                     coordinate), verified (a row on it stands verified in C or Rust). A view that does not answer leaves its steps hollow
//                     (null): no step is inferred from another (§22.9 "The ledger").
//   device, where     the device and the control that work each position, from the instrument's own entry ("Where you work it": the Torus
//                     §21.2, DLW.md:10194-10199; the Sky §22.1, :10767-10772; the M3 clock §22.3, :11018-11023), the manual's words verbatim.
//                     Parts carry none (§22.9).
//   rack.part         the part you choose ('0'..'5'), the view's own; the manual's default is 1 (§22.9 Parameters).
// M4′'s rack opens as a device of its own (§22.9), which no face places yet; this reads the three Rack pages. Nothing here writes the map.
// Pure apart from the kernel reads, which take the call they are given, and the small store the views share.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {Value} from '../../../frame/devices/designed'

export type RackInstrument = 1 | 2 | 3

/** Each instrument: its label, its coordinate in the map and its face (§16.16 "Where it plays"). */
export const RACK_INSTRUMENTS: Readonly<Record<RackInstrument, {readonly instrument: string; readonly ref: string; readonly face: string}>> = {
  1: {instrument: 'M1′', ref: '#1', face: 'quaternal-logic:torus'},
  2: {instrument: 'M2′', ref: '#2', face: 'quaternal-logic:sky'},
  3: {instrument: 'M3′', ref: '#3', face: 'quaternal-logic:m3-clock'},
}

/** Where each position is worked, as its instrument's entry says (DLW.md, the "Where you work it" rows): the device that carries it, and
 * the manual's own words for the control. A position whose entry names no device (it frames, or only keeps its place) carries none. */
export const RACK_CARRIED: Readonly<Record<RackInstrument, readonly {readonly device: string | null; readonly where: string | null}[]>> = {
  1: [
    {device: null, where: 'It frames the instrument and has no setting.'},
    {device: null, where: null},
    {device: 'quaternal-logic:m-prime-matrices', where: 'The Oscillator layer of the M′ matrices (§22.6).'},
    {device: 'quaternal-logic:torus', where: 'Pulse mix, Helix balance, Drive, and the context frame.'},
    {device: 'live:scale-mapping', where: 'Lens and context frame, Scale mapping (§21.3), Exact-ratio tuning (§21.4) and the keyboard.'},
    {device: 'quaternal-logic:torus', where: 'The surface, the View, and the Body group: Strike, Damping, Modes, Agitation and Body source.'},
  ],
  2: [
    {device: null, where: 'It frames the instrument and has no setting.'},
    {device: 'live:scale-mapping', where: 'Lens and context frame, Scale mapping (§21.3), and the eight-and-four reading.'},
    {device: 'quaternal-logic:torus', where: 'Body source on the Torus and on Resonance (§20.14).'},
    {device: 'quaternal-logic:sky', where: 'The Sky\'s ring of decans.'},
    {device: 'live:scale-mapping', where: 'Scale mapping\'s source scales, and a symbol\'s voice (§20.2).'},
    {device: 'quaternal-logic:sky', where: 'The Sky, and Sky modulation (§22.2).'},
  ],
  3: [
    {device: 'quaternal-logic:binding', where: 'Binding\'s nonets (§22.8), and the reading the clock takes before it draws.'},
    {device: 'quaternal-logic:deck', where: 'The Deck\'s I Ching (§22.4), the Hexagram readout, and a line change on the form.'},
    {device: 'quaternal-logic:m-prime-matrices', where: 'The Form matrix (§22.6), the Codon readout, and Binding\'s junctions and charges.'},
    {device: 'quaternal-logic:m3-clock', where: 'Matrix, Seed, Pose map and the Generation readout; Binding\'s Pairing.'},
    {device: 'quaternal-logic:deck', where: 'The Deck\'s Tarot, with the card of the current form and its orientation.'},
    {device: 'quaternal-logic:m3-clock', where: 'Position, Turn, Aperture, Reciprocal and Open. The Resonator bank sounds the cut (§22.7).'},
  ],
}

export const NO_CHILD_REFS = 'This ql\'s ledger view names a coordinate\'s children only by id (`ql kernel ledger <coordinate>`): their references and names, which the rack lists, come with QL-MEF #347 (child_coordinates).'
const LEDGER_VIEW = 'ql.m-ledger-view/v1'

type Rungs = [boolean | null, boolean | null, boolean | null]
const HOLLOW: Rungs = [null, null, null]
interface Child {readonly source_ref: string; readonly local_segment: string; readonly separator: string; readonly name: string | null}
interface View {readonly ref: string; readonly name: string | null; readonly segment: string; readonly registry: string; readonly children: readonly Child[]; readonly rungs: Rungs}

const isRecord = (x: unknown): x is Record<string, any> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** One coordinate's view, admitted only when it is the coordinate asked and names its children; else the reason in words. */
export function readLedgerView(answer: KernelOpCall, ref: string): {ok: true; view: View} | {ok: false; reason: string} {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'Quaternal Logic did not answer `ql kernel ledger`.'}
  const outcome = answer.outcome as {result?: string; data?: unknown}
  const data = isRecord(outcome.data) ? outcome.data : null
  if (outcome.result !== 'owner_route_reading' || data?.schema !== LEDGER_VIEW) return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not QL's ledger view.`}
  const node = isRecord(data.coordinate) ? data.coordinate : null
  if (node?.source_ref !== ref) return {ok: false, reason: `QL answered another coordinate than ${ref}.`}
  if (!Array.isArray(data.child_coordinates)) return {ok: false, reason: NO_CHILD_REFS}
  const children: Child[] = data.child_coordinates.flatMap((c: unknown): Child[] => (isRecord(c) && typeof c.source_ref === 'string' && typeof c.local_segment === 'string'
    ? [{source_ref: c.source_ref, local_segment: c.local_segment, separator: typeof c.separator === 'string' ? c.separator : '',
      name: Array.isArray(c.names) && typeof c.names[0] === 'string' ? c.names[0] : null}] : []))
  const rows = Array.isArray(data.rows) ? data.rows.filter(isRecord) : []
  const bound = rows.some(row => Array.isArray(row.bindings) && row.bindings.some((b: any) => b?.kind === 'computational' && Array.isArray(b.coordinates) && b.coordinates.includes(ref)))
  const verified = rows.some(row => ['c', 'rust'].some(stratum => row.assessment?.readiness?.[stratum]?.status === 'verified'))
  return {ok: true, view: {ref, name: Array.isArray(node.names) && typeof node.names[0] === 'string' ? node.names[0] : null, segment: String(node.local_segment ?? ''),
    registry: typeof data.registry_revision === 'string' ? data.registry_revision : '', children, rungs: [true, bound, verified]}}
}

/** The children as the rack lists them: in the registry's order, one per segment where the registry holds both spellings — the one the
 * nesting threshold writes (after a 4 the separator is ".", else "-"). */
export function rackChildren(parentSegment: string, children: readonly Child[]): Child[] {
  const law = parentSegment === '4' ? '.' : '-'
  return children.filter(child => {
    const twins = children.filter(other => other.local_segment === child.local_segment)
    return twins.length < 2 || child.separator === law || !twins.some(other => other.separator === law)
  })
}

// ── the store the views share ───────────────────────────────────────────────

export interface QlRackState {
  readonly busy: boolean
  /** The rack, as the design's `rack` key carries it; null with the reason when it is not read. */
  readonly rack: string | null
  readonly reason: string | null
  /** The part you chose ('0'..'5'), the view's own. */
  readonly part: Value | undefined
}
export type RackCall = (op: KernelOp) => Promise<KernelOpCall>
const READING = 'Reading the rack from the map\'s ledger…'
const INITIAL: QlRackState = {busy: false, rack: null, reason: READING, part: undefined}
let states: Record<RackInstrument, QlRackState> = {1: INITIAL, 2: INITIAL, 3: INITIAL}
const asked = new Set<RackInstrument>()
let sequence = 0
let call: RackCall = op => kernelOp(detectTransport(), op)
const listeners = new Set<() => void>()
const setRack = (n: RackInstrument, next: QlRackState) => { states = {...states, [n]: next}; for (const listener of [...listeners]) listener() }

export function qlRackState(n: RackInstrument): QlRackState { return states[n] }

async function view(ref: string): Promise<{ok: true; view: View} | {ok: false; reason: string}> {
  try {
    return readLedgerView(await call({op: 'ql_read', request: {kind: 'kernel-ledger', coordinate: ref}}), ref)
  } catch (error) {
    return {ok: false, reason: `The kernel could not be asked for the ledger: ${error instanceof Error ? error.message : String(error)}`}
  }
}

/** Views of many coordinates, four at a time, in the order asked. */
async function views(refs: readonly string[]) {
  const out: ({ok: true; view: View} | {ok: false; reason: string})[] = new Array(refs.length)
  let next = 0
  await Promise.all(Array.from({length: Math.min(4, refs.length)}, async () => { while (next < refs.length) { const at = next++; out[at] = await view(refs[at]!) } }))
  return out
}

/** Read an instrument's rack once: its view, its positions' views, their parts' views. Only the newest read stands. */
export async function readQlRack(n: RackInstrument): Promise<void> {
  const ticket = ++sequence, at = RACK_INSTRUMENTS[n]
  setRack(n, {...states[n], busy: true})
  const top = await view(at.ref)
  if (!top.ok) { if (ticket === sequence) setRack(n, {...states[n], busy: false, rack: null, reason: top.reason}); return }
  const positions = rackChildren(top.view.segment, top.view.children).filter(child => /^[0-5]$/.test(child.local_segment))
  const posViews = await views(positions.map(p => p.source_ref))
  const parts = posViews.map((v, i) => (v.ok ? rackChildren(positions[i]!.local_segment, v.view.children) : []))
  const partViews = await views(parts.flat().map(part => part.source_ref))
  if (ticket !== sequence) return
  const registries = new Set([top.view, ...posViews.flatMap(v => (v.ok ? [v.view] : [])), ...partViews.flatMap(v => (v.ok ? [v.view] : []))].map(v => v.registry))
  if (registries.size > 1) { setRack(n, {...states[n], busy: false, rack: null, reason: 'The ledger answered from two registry revisions while the rack was read.'}); return }
  let k = 0
  const rack = {instrument: at.instrument, coordinate: at.ref, name: top.view.name ?? at.ref, face: at.face, registry: top.view.registry.slice(0, 12),
    positions: positions.map((p, i) => {
      const own = posViews[i]!, carried = RACK_CARRIED[n][Number(p.local_segment)]!
      return {pos: Number(p.local_segment), ref: p.source_ref, name: p.name ?? p.source_ref, device: carried.device, where: carried.where,
        ledger: own.ok ? own.view.rungs : HOLLOW,
        parts: parts[i]!.map(part => { const v = partViews[k++]!; return {ref: part.source_ref, name: part.name ?? part.source_ref, ledger: v.ok ? v.view.rungs : HOLLOW} })}
    })}
  setRack(n, {...states[n], busy: false, rack: JSON.stringify(rack), reason: null})
}

/** The first read of an instrument's rack, once per session: the map does not move under a running shell (its refresh owns that). */
export function ensureQlRack(n: RackInstrument): void {
  if (asked.has(n)) return
  asked.add(n)
  void readQlRack(n)
}

export function setQlRackPart(n: RackInstrument, part: Value | undefined): void { setRack(n, {...states[n], part}) }

/** Tests: start again, with another call. */
export function resetQlRack(next: {call?: RackCall} = {}): void {
  sequence++; asked.clear(); states = {1: INITIAL, 2: INITIAL, 3: INITIAL}; call = next.call ?? (op => kernelOp(detectTransport(), op))
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** An instrument's rack as the views share it; the first view to mount reads it. */
export function useQlRack(n: RackInstrument): QlRackState {
  useEffect(() => { ensureQlRack(n) }, [n])
  return useSyncExternalStore(subscribe, () => states[n], () => states[n])
}

// ── the keys the Rack pages read ────────────────────────────────────────────

/** The Rack page's values: the rack when read, and the part you chose (the manual's 1 until you choose). */
export function rackValues(rack: QlRackState): Record<string, Value> {
  return rack.rack ? {rack: rack.rack, 'rack.part': rack.part ?? '1'} : {}
}

/** Why the rack is not drawn, as its standing; null when it is read. */
export function rackWhy(rack: QlRackState): string | null {
  return rack.rack ? null : rack.reason ?? READING
}

export const RACK_READ = 'A reading of the map\'s ledger: the Rack writes nothing to the map; its own refresh changes it.'

/** A Rack page's share of a binding: the rack as read (or why not), and the part you choose in your own hand. */
export function rackPage(n: RackInstrument, rack: QlRackState = qlRackState(n)) {
  const why = rackWhy(rack)
  return {
    values: rackValues(rack),
    standing: {rack: {disabled: why ?? RACK_READ}},
    local: {'rack.part': (value: Value | undefined) => setQlRackPart(n, value)},
    waiting: rack.busy && !rack.rack,
  }
}
