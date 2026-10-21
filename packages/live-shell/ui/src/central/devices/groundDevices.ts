// Ground hygiene and Impact as designed devices on Central's chain (lane BC2; DLW §18.5, §18.6): the census and the
// neighbourhood read through the same owner ops the devices' earlier bodies read, and their bindings (groundBindings.ts).
//   - Ground hygiene reads when it opens and when you press Read now (DLW §18.5 Refresh "On open"), through the one census reader
//     (inhabitants/CentralHygieneDevice.tsx readHygieneCensus), its seats the seat instrument's own reading through the kernel (lane K1's
//     seat_status_read, the one shared entry the Seat reads: agent/devices/workcellReads.ts — slow, so read once and again on Read now);
//     the read-only git census (worktree list, for-each-ref) has no kernel op, and the census names that refusal;
//   - Impact reads its subject's three legs when the subject changes — the knowledge graph (`op graph`, readGraph), a folder's
//     listing (`op files_list`), the NOW register (`op now` kind:list) — ported from inhabitants/CentralImpactDevice.tsx's `read`
//     (which reads through these three since lane BC3: one implementation of each leg), and the NOW leg again when the kernel says
//     a NOW write landed (owners/notices.ts receiptMovesNow, lane W3).
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react'
import {kernelRead} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {readGraph, type GraphReading} from '../../../../../../desktop/cradle/src/knowledge/graph'
import type {KernelTransportStatus, NativeDirectory} from '../../../../../../desktop/cradle/src/kernel/types'
import type {DesignBinding} from '../../frame/devices/designed'
import {readHygieneCensus, type HygieneMachineRead} from '../../inhabitants/CentralHygieneDevice'
import {SEAT_STATUS_EPOCH, seatStatusEntry} from '../../agent/devices/workcellReads'
import {assembleImpact, type ImpactReading, type ImpactSubject, type NowListRow} from '../../inhabitants/centralImpactModel'
import {receiptMovesNow} from '../../owners/notices'
import {useSpineEpoch} from '../../owners/spine'
import {centralDeviceId} from './centralDeviceModel'
import {hygieneBinding, impactBinding, type HygieneRead} from './groundBindings'
import {heldOf, holdsVersion, subscribeHolds} from './pageBindings'
import {useReceiptsMove} from './useCentralReadings'

const REFUSAL = (error: unknown): string => (typeof error === 'string' ? error : String((error as {message?: string})?.message ?? error))

type GraphLeg = {reading: GraphReading; boundaryOp: string; at: string; refusal: string | null}
type FilesLeg = {entries: NativeDirectory['entries']; boundaryOp: string; at: string; refusal: string | null}
type NowLeg = {records: readonly NowListRow[]; boundaryOp: string; at: string; refusal: string | null}

/** The neighbourhood — the knowledge graph owner, through its own client (`op graph` inside readGraph, schema-checked there). */
export async function readGraphLeg(transport: KernelTransportStatus, subject: ImpactSubject): Promise<GraphLeg> {
  const at = new Date().toISOString()
  try {
    const reading = await readGraph(transport, undefined, subject.path, {input: 'all'})
    return {reading, boundaryOp: 'op graph (readGraph, oi.cradle.graph-reading/v1)', at, refusal: null}
  } catch (error) {
    const refusal = REFUSAL(error)
    const state = 'unavailable' as const
    const inputs = {central_wiki: {state, owner_operation: 'op graph (readGraph)', detail: refusal}, aikit_resolution: {state, owner_operation: 'op graph (readGraph)', detail: refusal},
      shared_field: {state, owner_operation: 'op graph (readGraph)', detail: refusal}, wiki_links: {state, owner_operation: 'op graph (readGraph)', detail: refusal}}
    return {reading: {schema: 'oi.cradle.graph-reading/v1', nodes: [], edges: [], inputs, counts: {spaces: 0, wiki_nodes: 0, knowledge_rows: 0, nodes: 0, edges: 0}} as unknown as GraphReading,
      boundaryOp: 'op graph (readGraph)', at, refusal}
  }
}

/** The references — the owner's own directory listing, for a folder. */
export async function readFilesLeg(transport: KernelTransportStatus, subject: ImpactSubject): Promise<FilesLeg | undefined> {
  if (subject.kind !== 'folder') return undefined
  const at = new Date().toISOString()
  try {
    const directory = await kernelRead(transport, {op: 'files_list', path: subject.path})
    if (directory.error || directory.outcome?.result !== 'directory_read') return {entries: [], boundaryOp: 'op files_list', at, refusal: REFUSAL(directory.error ?? 'the directory reading did not answer')}
    const doc = (directory.outcome as {directory?: NativeDirectory}).directory
    return {entries: doc?.entries ?? [], boundaryOp: 'op files_list', at, refusal: null}
  } catch (error) {
    return {entries: [], boundaryOp: 'op files_list', at, refusal: REFUSAL(error)}
  }
}

/** The sessions touching — the NOW register's own listing (`op now` kind:list). */
export async function readNowLeg(transport: KernelTransportStatus): Promise<NowLeg> {
  const at = new Date().toISOString()
  try {
    const now = await kernelRead(transport, {op: 'now', project: null, request: {kind: 'list'}})
    if (now.error || now.outcome?.result !== 'now_reading') return {records: [], boundaryOp: 'op now (kind:list)', at, refusal: REFUSAL(now.error ?? 'the NOW listing did not answer')}
    const data = (now.outcome as {data?: {records?: NowListRow[]}}).data
    return {records: data?.records ?? [], boundaryOp: 'op now (kind:list)', at, refusal: null}
  } catch (error) {
    return {records: [], boundaryOp: 'op now (kind:list)', at, refusal: REFUSAL(error)}
  }
}

export const HYGIENE_DEVICE_ID = centralDeviceId('ground-hygiene')
export const IMPACT_DEVICE_ID = centralDeviceId('impact')

/** Ground hygiene's census, read when the device opens and on Read now; its binding. */
/** The census's machine reads through the kernel: the seat instrument (seat_status_read; `again`: Read now asks it afresh, else the shared
 * answer stands); the read-only git census has no kernel op, refused by name. */
export function hygieneMachineRead(transport: KernelTransportStatus, again: boolean): HygieneMachineRead {
  return async kind => {
    if (kind !== 'seat-status') return {boundaryOp: kind === 'worktree-list' ? 'git worktree list --porcelain' : 'git for-each-ref refs/heads', stdout: '',
      refused: 'No kernel op runs the read-only git census here (worktree list, for-each-ref): the worktrees and branches stand on the git repository reading.'}
    const entry = seatStatusEntry(transport)
    await (again ? entry.retry(SEAT_STATUS_EPOCH) : entry.ensure(SEAT_STATUS_EPOCH))
    const seats = entry.snapshot()
    const boundaryOp = 'op seat_status_read (seat status --json)'
    return seats.status === 'answered' ? {boundaryOp, stdout: JSON.stringify(seats.value)} : {boundaryOp, stdout: '', refused: seats.error ?? 'The seat instrument did not answer.'}
  }
}

export function useHygieneDevice(transport: KernelTransportStatus, open: boolean): DesignBinding {
  const epoch = useSpineEpoch()
  const [read, setRead] = useState<HygieneRead | null>(null)
  useSyncExternalStore(subscribeHolds, holdsVersion, holdsVersion)
  const version = holdsVersion()
  const census = useCallback(async (again: boolean) => {
    const {census, findings} = await readHygieneCensus({transport, epoch, machineRead: hygieneMachineRead(transport, again)})
    setRead({census, findings, at: Date.now()})
  }, [transport, epoch])
  const run = useCallback(() => census(true), [census])
  useEffect(() => { if (open) void census(false) }, [open, census])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the holds' version re-binds the view's own keys
  return useMemo(() => hygieneBinding(HYGIENE_DEVICE_ID, read, Date.now(), run), [read, run, version])
}

const sameSubject = (a: ImpactSubject | null, b: ImpactSubject | null) => a?.kind === b?.kind && a?.path === b?.path

/** Impact's neighbourhood of the subject (the browser's selection, or the one Pin holds), read when the subject changes; the NOW leg
 * again on a NOW receipt; its binding. */
export function useImpactDevice(transport: KernelTransportStatus, selected: ImpactSubject | null): DesignBinding {
  useSyncExternalStore(subscribeHolds, holdsVersion, holdsVersion)
  const version = holdsVersion()
  const pinned = useRef<ImpactSubject | null>(null)
  const pin = heldOf(IMPACT_DEVICE_ID).pin === true
  if (!pin) pinned.current = null
  else if (!pinned.current) pinned.current = selected
  const subject = pin ? pinned.current : selected
  const [legs, setLegs] = useState<{subject: ImpactSubject; graph: GraphLeg; files?: FilesLeg; now: NowLeg} | null>(null)
  const kind = subject?.kind, path = subject?.path
  useEffect(() => {
    if (!subject) { setLegs(null); return }
    let alive = true
    void Promise.all([readGraphLeg(transport, subject), readFilesLeg(transport, subject), readNowLeg(transport)]).then(([graph, files, now]) => {
      if (alive) setLegs({subject, graph, ...(files ? {files} : {}), now})
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the subject is its kind and path
  }, [transport, kind, path])
  const rereadNow = useCallback(() => {
    void readNowLeg(transport).then(now => setLegs(was => (was ? {...was, now} : was)))
  }, [transport])
  useReceiptsMove(receiptMovesNow, rereadNow)
  const reading: ImpactReading | null = useMemo(() => (legs && sameSubject(legs.subject, subject) ? assembleImpact({subject: legs.subject, graph: legs.graph, files: legs.files, now: legs.now}) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [legs, kind, path])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the holds' version re-binds the view's own keys
  return useMemo(() => impactBinding(IMPACT_DEVICE_ID, reading), [reading, version])
}

