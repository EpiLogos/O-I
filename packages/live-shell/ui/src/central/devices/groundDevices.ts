// Ground hygiene and Impact as designed devices on Central's chain (lane BC2; DLW §18.5, §18.6): the census and the
// neighbourhood read through the same owner ops the devices' earlier bodies read, and their bindings (groundBindings.ts).
//   - Ground hygiene reads when it opens and when you press Read now (DLW §18.5 Refresh "On open"), through the one census reader
//     (inhabitants/CentralHygieneDevice.tsx readHygieneCensus), its seats the seat instrument's own reading through the kernel (lane K1's
//     seat_status_read, the one shared entry the Seat reads: agent/devices/workcellReads.ts — slow, so read once and again on Read now);
//     the worktrees and branches are Central's read-only git census (`central.git.census`, central.git-census/v1) through the kernel's
//     invoke_action (T-COVERAGE §1.3; owner_write.rs carries it as a reading), read once for both and again on Read now;
//   - the Ground and Material pages (readHygienePages): central.doctor, central.world.reproject.plan and projectcentral.ground.inspect
//     through invoke_action, Workcell's worlds of this machine's cell (`workcell worlds`, each receipt read with material_read); the
//     tenders write through their owners on the person's press (groundBindings.ts HYGIENE_WRITERS); the sandboxes of a named server through
//     workcell_read sandboxes
//     (lane K0), and while no server is named (none is yet: Workcell names its declared deployment's URL in no reading), refused saying so;
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
import {hygieneBinding, impactBinding, NO_SANDBOX_SERVER, type HygienePages, type HygienePorts, type HygieneRead, type HygieneSandboxes} from './groundBindings'
import {centralWrite} from './centralDeviceWrites'
import {materialWorldOf, worldsOf} from '../../agent/devices/workcellMaterial'
import {authoredOfInspection, groundFindings, materialFindings, rootOfDoctor, sandboxesOfReport, scaffoldOfPlan, type BoundaryOpSource, type MaterialWorld,
  type SandboxReading} from '../../inhabitants/centralHygieneModel'
import {ownerRouteWrite, refusalWords, workcellReadOp, workcellWriteOp} from '../../agent/devices/ownerRoutes'
import {ownerReadings} from '../../owners/ownerReading'
import {readWorkcellOf, workcellReadingKey} from '../../owners/readers'
import {heldOf, holdsVersion, subscribeHolds} from './pageBindings'
import {actionAnswerOf, centralActionOp, useReceiptsMove} from './useCentralReadings'

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

/** The project whose checkouts the census reads: the shell's, as the census's git reading is (CentralHygieneDevice.tsx git_repository_read). */
export const CENSUS_PROJECT = 'O-I'
export const GIT_CENSUS_ACTION = 'central.git.census'
/** The census's boundary operation for each list it gives (the design cites a finding's ring by its op: worktrees, branches). */
const CENSUS_OP = (list: 'worktrees' | 'branches') => `${GIT_CENSUS_ACTION} ${list} (invoke_action, project ${CENSUS_PROJECT})`

/** Central's git census of one project (central.git-census/v1) as the census parsers read a checkout list and a branch list
 * (centralHygieneModel.ts parseWorktreeList, parseBranchRefs): each worktree in the census's own order (the repository's main worktree
 * first) with its branch, and detached or bare where the census says so; each branch with the checkout that holds it. The census
 * reports no head, so none is written. Null when the answer is not the census. Pure. */
export function censusLines(census: unknown): {worktrees: string; branches: string} | null {
  const doc = census as {schema?: unknown; repos?: unknown} | null
  if (!doc || doc.schema !== 'central.git-census/v1' || !Array.isArray(doc.repos)) return null
  const worktrees: string[] = [], branches: string[] = []
  for (const repo of doc.repos as {worktrees?: unknown; branches?: unknown}[]) {
    for (const tree of Array.isArray(repo?.worktrees) ? repo.worktrees as {path?: unknown; branch?: unknown; detached?: unknown; bare?: unknown}[] : []) {
      if (typeof tree?.path !== 'string' || !tree.path) continue
      worktrees.push([`worktree ${tree.path}`, ...(typeof tree.branch === 'string' && tree.branch && tree.detached !== true ? [`branch refs/heads/${tree.branch}`] : []),
        ...(tree.detached === true ? ['detached'] : []), ...(tree.bare === true ? ['bare'] : []), ''].join('\n'))
    }
    for (const branch of Array.isArray(repo?.branches) ? repo.branches as {name?: unknown; checked_out_in?: unknown}[] : []) {
      if (typeof branch?.name !== 'string' || !branch.name) continue
      const holder = Array.isArray(branch.checked_out_in) && typeof branch.checked_out_in[0] === 'string' ? branch.checked_out_in[0] : ''
      branches.push(`${branch.name}\t\t${holder}`)
    }
  }
  return {worktrees: worktrees.join('\n'), branches: branches.join('\n')}
}

/** Ground hygiene's census, read when the device opens and on Read now; its binding. */
/** The census's machine reads through the kernel: the seat instrument (seat_status_read; `again`: Read now asks it afresh, else the shared
 * answer stands), and Central's git census for the worktrees and branches — one read for both. */
export function hygieneMachineRead(transport: KernelTransportStatus, again: boolean): HygieneMachineRead {
  let census: Promise<{lines: {worktrees: string; branches: string}} | {refused: string}> | null = null
  const readCensus = () => census ??= kernelRead(transport, centralActionOp(GIT_CENSUS_ACTION, {project: CENSUS_PROJECT}), {fresh: again}).then(call => {
    const answer = actionAnswerOf({status: call.error ? 'refused' : 'answered', value: call.outcome?.result === 'action_dispatched' ? call.outcome : null, error: call.error ?? null}, GIT_CENSUS_ACTION)
    if (answer.status === 'refused') return {refused: answer.error}
    const lines = answer.status === 'answered' ? censusLines(answer.value) : null
    return lines ? {lines} : {refused: 'Central answered the git census in a form it is not (central.git-census/v1 expected).'}
  }, (cause: unknown) => ({refused: REFUSAL(cause)}))
  return async kind => {
    if (kind !== 'seat-status') {
      const read = await readCensus(), boundaryOp = CENSUS_OP(kind === 'worktree-list' ? 'worktrees' : 'branches')
      return 'refused' in read ? {boundaryOp, stdout: '', refused: read.refused}
        : {boundaryOp, stdout: kind === 'worktree-list' ? read.lines.worktrees : read.lines.branches}
    }
    const entry = seatStatusEntry(transport)
    await (again ? entry.retry(SEAT_STATUS_EPOCH) : entry.ensure(SEAT_STATUS_EPOCH))
    const seats = entry.snapshot()
    const boundaryOp = 'op seat_status_read (seat status --json)'
    return seats.status === 'answered' ? {boundaryOp, stdout: JSON.stringify(seats.value)} : {boundaryOp, stdout: '', refused: seats.error ?? 'The seat instrument did not answer.'}
  }
}

/** The Ground and Material pages' readings' operations, as the design cites a finding's ring by its op (root central.doctor, scaffold
 * reproject, authored projectcentral.ground, worlds material, sandboxes sandboxes). */
export const PAGE_OPS = {
  root: 'central.doctor',
  scaffold: `central.world.reproject.plan (project ${CENSUS_PROJECT})`,
  authored: `projectcentral.ground.inspect (project ${CENSUS_PROJECT})`,
  worlds: 'material: `workcell worlds` (op workcell_read worlds), each receipt read with op material_read',
  sandboxes: 'workcell sandboxes reconcile --server <the sandbox server>',
} as const
/** The sandboxes' operation for a named server (op workcell_read sandboxes, lane K0). */
export const sandboxesOp = (server: string) => `workcell sandboxes reconcile --server ${server} (op workcell_read sandboxes)`

/** Workcell's report of one named sandbox server (op workcell_read sandboxes): its sandboxes with their leases, or Workcell's refusal in its
 * words. The kernel withholds the key variable from a server the desk names. */
export async function readSandboxes(transport: KernelTransportStatus, server: string, again: boolean): Promise<{reading: SandboxReading} | {refused: string}> {
  try {
    const call = await kernelRead(transport, {op: 'workcell_read', request: {kind: 'sandboxes', server}}, {fresh: again})
    if (call.error) return {refused: refusalWords(call.error)}
    const outcome = call.outcome as {result?: unknown; data?: unknown} | null
    const reading = outcome?.result === 'owner_route_reading' ? sandboxesOfReport(outcome.data) : null
    return reading ? {reading} : {refused: 'Workcell answered in a form the device does not read (its sandboxes reconcile report expected).'}
  } catch (cause) { return {refused: REFUSAL(cause)} }
}

/** One Central reading for the pages through invoke_action: its data, or its refusal in the owner's words. */
async function pageRead(transport: KernelTransportStatus, action: string, input: Record<string, unknown>, again: boolean): Promise<{data: unknown} | {refused: string}> {
  try {
    const call = await kernelRead(transport, centralActionOp(action, input), {fresh: again})
    const answer = actionAnswerOf({status: call.error ? 'refused' : 'answered', value: call.outcome?.result === 'action_dispatched' ? call.outcome : null, error: call.error ?? null}, action)
    return answer.status === 'answered' ? {data: answer.value} : {refused: answer.status === 'refused' ? answer.error : `${action} did not answer.`}
  } catch (cause) { return {refused: REFUSAL(cause)} }
}

/** The Ground and Material pages (DLW §18.5): Central's root (central.doctor), the world's scaffold (central.world.reproject.plan) and its
 * authored ground (projectcentral.ground.inspect), each through invoke_action as a reading; Workcell's prepared worlds from its status
 * (the shared workcell answer: none while it keeps no world receipt; with some, no operation lists them for material_read, refused by
 * name); the sandboxes of the server named (`sandboxServer`, op workcell_read sandboxes), and with none named, refused saying so. The
 * model classifies the findings (centralHygieneModel.ts groundFindings, materialFindings). */
export async function readHygienePages(transport: KernelTransportStatus, epoch: string, again: boolean, sandboxServer: string | null = null): Promise<HygienePages> {
  const at = new Date().toISOString()
  const [doctor, plan, inspection] = await Promise.all([
    pageRead(transport, 'central.doctor', {}, again),
    pageRead(transport, 'central.world.reproject.plan', {project: CENSUS_PROJECT}, again),
    pageRead(transport, 'projectcentral.ground.inspect', {project: CENSUS_PROJECT}, again),
  ])
  const sources: BoundaryOpSource[] = []
  const reading = <T,>(op: string, read: {data: unknown} | {refused: string}, parse: (data: unknown) => T | null): T | undefined => {
    if ('refused' in read) { sources.push({boundaryOp: op, channel: 'kernel-op', at, refusal: read.refused}); return undefined }
    const parsed = parse(read.data)
    sources.push({boundaryOp: op, channel: 'kernel-op', at, ...(parsed ? {} : {refusal: 'Central answered in a form the device does not read.'})})
    return parsed ?? undefined
  }
  const root = reading(PAGE_OPS.root, doctor, rootOfDoctor)
  const scaffold = reading(PAGE_OPS.scaffold, plan, scaffoldOfPlan)
  const authored = reading(PAGE_OPS.authored, inspection, authoredOfInspection)
  // Workcell's prepared worlds of this machine's cell: `workcell worlds` lists their receipts (lane K0: the route stands since lane W12), and
  // each is read with material_read for its bindings' presence. The cell and its state root are Workcell's status (the shared answer).
  const worlds = await readHygieneWorlds(transport, epoch, again, at, sources)
  // The sandboxes: Workcell's report of the server named, else why none is read.
  let sandboxes: SandboxReading | undefined
  const sandboxOp = sandboxServer ? sandboxesOp(sandboxServer) : PAGE_OPS.sandboxes
  if (!sandboxServer) sources.push({boundaryOp: sandboxOp, channel: 'kernel-op', at, refusal: NO_SANDBOX_SERVER})
  else {
    const read = await readSandboxes(transport, sandboxServer, again)
    if ('reading' in read) { sandboxes = read.reading; sources.push({boundaryOp: sandboxOp, channel: 'kernel-op', at}) }
    else sources.push({boundaryOp: sandboxOp, channel: 'kernel-op', at, refusal: read.refused})
  }
  const findings = [
    ...groundFindings({root, scaffold, authored, ops: {root: PAGE_OPS.root, scaffold: PAGE_OPS.scaffold, authored: PAGE_OPS.authored}}),
    ...materialFindings({worlds, sandboxes, ops: {worlds: PAGE_OPS.worlds, sandboxes: sandboxOp}}),
  ]
  return {...(root ? {root} : {}), ...(scaffold ? {scaffold} : {}), ...(authored ? {authored} : {}), ...(worlds ? {worlds} : {}), ...(sandboxes ? {sandboxes} : {}),
    sources, findings}
}

/** The worlds of this machine's cell as the Material page reads them: `workcell worlds` (op workcell_read worlds) lists the receipts Workcell
 * keeps, those of the cell its status names (workcell_ref), each read with the kernel's material_read for its bindings (centralHygieneModel.ts
 * MaterialWorld: presence and health; the world's persistence carried to each binding). A source for each read, its refusal in Workcell's
 * words; undefined when the worlds could not be listed. */
async function readHygieneWorlds(transport: KernelTransportStatus, epoch: string, again: boolean, at: string, sources: BoundaryOpSource[]): Promise<MaterialWorld[] | undefined> {
  const workcell = ownerReadings.entry(workcellReadingKey(transport), readWorkcellOf(transport))
  await workcell.ensure(epoch)
  const status = workcell.snapshot()
  const cell = status.status === 'answered' ? status.value as {workcell_ref?: unknown; state_root?: unknown} | null : null
  if (!cell || typeof cell.workcell_ref !== 'string' || typeof cell.state_root !== 'string') {
    sources.push({boundaryOp: PAGE_OPS.worlds, channel: 'kernel-op', at, refusal: status.status === 'refused' ? status.error ?? 'Workcell refused its status.'
      : status.status === 'reading' ? 'Workcell has not answered its status yet.' : 'Workcell\'s status names no workcell_ref and state root, so no receipt can be told as this cell\'s.'})
    return undefined
  }
  let listing: ReturnType<typeof worldsOf> = null
  try {
    const call = await kernelRead(transport, workcellReadOp({kind: 'worlds'}), {fresh: again})
    if (call.error) { sources.push({boundaryOp: PAGE_OPS.worlds, channel: 'kernel-op', at, refusal: refusalWords(call.error)}); return undefined }
    listing = worldsOf((call.outcome as {data?: unknown} | null)?.data)
  } catch (cause) { sources.push({boundaryOp: PAGE_OPS.worlds, channel: 'kernel-op', at, refusal: REFUSAL(cause)}); return undefined }
  if (!listing) { sources.push({boundaryOp: PAGE_OPS.worlds, channel: 'kernel-op', at, refusal: 'Workcell answered its worlds in a form the device does not read (workcell.world-receipts/v1 expected).'}); return undefined }
  sources.push({boundaryOp: PAGE_OPS.worlds, channel: 'kernel-op', at})
  const mine = listing.worlds.filter(world => world.workcellRef === cell.workcell_ref)
  const read = await Promise.all(mine.map(async (listed): Promise<MaterialWorld | null> => {
    const op = `material: material_read ${listed.worldRef}`
    try {
      const call = await kernelRead(transport, {op: 'material_read', target: {receipt: listed.receipt, state_root: String(cell.state_root), expected_world_ref: listed.worldRef}}, {fresh: again})
      const outcome = call.outcome as {data?: unknown; failure?: {message?: unknown}} | null
      const material = call.error ? null : materialWorldOf(outcome?.data)
      if (!material) {
        sources.push({boundaryOp: op, channel: 'kernel-op', at, refusal: call.error ? refusalWords(call.error) : typeof outcome?.failure?.message === 'string' ? outcome.failure.message
          : 'Workcell answered the material read with neither a reading nor its failure.'})
        return null
      }
      sources.push({boundaryOp: op, channel: 'kernel-op', at})
      const world = material.world as {ref: string; state?: string; persistence?: string; bindings: {ref: string; presence?: string; health?: string}[]}
      return {ref: world.ref, receipt: listed.receipt, ...(world.state ? {state: world.state} : {}),
        bindings: world.bindings.map(binding => ({ref: String(binding.ref), presence: binding.presence ?? 'unknown', ...(binding.health ? {health: binding.health} : {}),
          ...(world.persistence ? {persistence: world.persistence} : {})}))}
    } catch (cause) { sources.push({boundaryOp: op, channel: 'kernel-op', at, refusal: REFUSAL(cause)}); return null }
  }))
  return read.filter((world): world is MaterialWorld => world !== null)
}

/** The named server's Release orphans through the kernel: workcell_write release-orphans {server} (`workcell sandboxes reconcile --server
 * <url> --release-orphans`), Workcell's report, or its refusal thrown in its words. */
export const sandboxesPort = (transport: KernelTransportStatus, server: string): HygieneSandboxes => ({server,
  release: async named => (await ownerRouteWrite(transport, workcellWriteOp({kind: 'release-orphans', server: named}), '`workcell sandboxes reconcile --release-orphans`')).data})

/** Ground hygiene on the owners. `sandboxServer`: the OpenSandbox lifecycle server whose sandboxes the Material page reads and whose
 * orphans Release orphans releases (Workcell's own `--server`); nothing names one yet (NO_SANDBOX_SERVER), so callers pass none. */
export function useHygieneDevice(transport: KernelTransportStatus, open: boolean, sandboxServer: string | null = null): DesignBinding {
  const epoch = useSpineEpoch()
  const [read, setRead] = useState<HygieneRead | null>(null)
  useSyncExternalStore(subscribeHolds, holdsVersion, holdsVersion)
  const version = holdsVersion()
  const census = useCallback(async (again: boolean) => {
    const {census, findings} = await readHygieneCensus({transport, epoch, machineRead: hygieneMachineRead(transport, again)})
    const pages = await readHygienePages(transport, epoch, again, sandboxServer)
    setRead({census, findings, pages, at: Date.now()})
  }, [transport, epoch, sandboxServer])
  const run = useCallback(() => census(true), [census])
  useEffect(() => { if (open) void census(false) }, [open, census])
  // The tenders' writers (lane K0): Central's acts through invoke_action (the person's press, PERSON_ACTS), Workcell's reconcile on a world's
  // receipt, and a named server's Release orphans.
  const ports = useMemo((): HygienePorts => (transport.kind === 'unavailable' ? {project: CENSUS_PROJECT} : {
    central: (action, input) => centralWrite(transport, action, input),
    workcell: async request => (await ownerRouteWrite(transport, workcellWriteOp(request), `\`workcell ${request.kind}\``)).data,
    project: CENSUS_PROJECT, sandboxes: sandboxServer ? sandboxesPort(transport, sandboxServer) : null,
  }), [transport, sandboxServer])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the holds' version re-binds the view's own keys
  return useMemo(() => hygieneBinding(HYGIENE_DEVICE_ID, read, Date.now(), run, ports), [read, run, ports, version])
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

