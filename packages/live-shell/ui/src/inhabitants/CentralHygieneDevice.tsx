import {useCallback, useState} from 'react'

/** The ground-hygiene device — central family, face `ground-hygiene` (L2's
 * declared face; L7 gives it its body — ticket L7 commission 1).
 *
 * The ground as readings: worktree census, branch audit, stray-branch
 * detection, seat occupancy. Every reading stands on a named owner
 * operation, displayed with it:
 * - `op workcell_status_read` — the kernel's workcell read; when the owner
 *   refuses (boot provenance, e.g. walk-bridge grants), the refusal is
 *   carried verbatim and the machine-level declared owner operations
 *   (the seat instrument's `seat status`, read-only git state) supply the
 *   census — each labelled with its exact boundary_op.
 * - `op git_repository_read` — the kernel's git read, per product; a
 *   refusal is carried verbatim the same way.
 *
 * The tenders (release seat, prune worktree, sweep branch) render as
 * DECLARED controls naming their owner operation — a device fires none of
 * them; the repair stays commissioned (the field-health law: detection is
 * always in scope, repair is a separate act). */

import {kernelRead} from '../../../../../desktop/cradle/src/kernel/bridge'
import {ownerReadings} from '../owners/ownerReading'
import {readWorkcellOf, workcellReadingKey} from '../owners/readers'
import {useSpineEpoch} from '../owners/spine'
import {useWorldProjects} from '../agent/worldScope'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {
  assembleCensus,
  hygieneFindings,
  registeredSeatPaths,
  HYGIENE_TENDERS,
  parseBranchRefs,
  parseSeatStatus,
  parseSeatStatusJson,
  parseWorktreeList,
  workcellRefOf,
  type BoundaryOpSource,
  type HygieneCensus,
  type HygieneFinding,
} from './centralHygieneModel'
import {KindMark} from './sdk/marks.tsx'
import './inhabitantDevices.css'

export interface CentralHygieneDeviceProps {
  readonly transport: KernelTransportStatus
  /** The host's machine-level declared reads (the seat instrument, read-only
   * git). The harness supplies them; absent, only the kernel ops are read
   * and their refusals shown. Each result must name the boundary_op it ran. */
  readonly machineRead?: HygieneMachineRead
  /** The seat paths the register admits (the census classifies against them). */
  readonly seatPaths?: readonly string[]
  /** Each product's primary checkout as the register names it (`products.<product>.primary`), when the host read the register. */
  readonly primaries?: Readonly<Record<string, string>>
  readonly expanded?: boolean
}

interface ReadState {
  readonly census: HygieneCensus | null
  readonly findings: readonly HygieneFinding[]
  readonly pending: boolean
  readonly fault: string | null
}

/** The machine-level declared reads a host can supply (the seat instrument, read-only git); each names the boundary_op it ran. */
/** One machine read: its operation, its output, or its refusal; `partial` names each part of a reading made of several (the census's
 * projects) that refused while the others answered — by its own operation, in its owner's words. */
export type HygieneMachineRead = (kind: 'seat-status' | 'worktree-list' | 'branch-refs') => Promise<{boundaryOp: string; stdout: string; refused?: string;
  partial?: readonly {readonly boundaryOp: string; readonly refusal: string}[]}>

/** Read the ground once: the kernel's workcell and git reads (each refusal carried verbatim), then the host's machine reads where
 * it supplies them; the census and the model's findings. The device's own body and the designed device (central/devices/
 * groundDevices.ts) read through this one reader. */
/** What the census's git read says in a world with no project. */
export const NO_PROJECT_REPOSITORY = 'Your world has no project yet: git_repository_read reads a project\'s repository, and your world\'s root register keeps none.'

export async function readHygieneCensus({transport, epoch, machineRead, seatPaths = [], primaries, projects = []}: {
  readonly transport: KernelTransportStatus
  readonly epoch: string
  readonly machineRead?: HygieneMachineRead
  /** The world's projects (agent/worldScope.ts): each one's repository is read; a world with none says so. */
  readonly projects?: readonly string[]
  readonly seatPaths?: readonly string[]
  readonly primaries?: Readonly<Record<string, string>>
}): Promise<{census: HygieneCensus; findings: readonly HygieneFinding[]}> {
  const sources: BoundaryOpSource[] = []
  let seats: ReturnType<typeof parseSeatStatus> = []
  let worktrees: ReturnType<typeof parseWorktreeList> = []
  let branches: ReturnType<typeof parseBranchRefs> = []
  let machineRef: string | null = null

  // The kernel's workcell read — the primary owner, through the window's shared workcell answer (owners/readers.ts): the
  // person asked, so it is read again even after a refusal, and every other reader of it sees the same answer. A refusal is
  // a reading; its instant is when the owner answered.
  const workcellEntry = ownerReadings.entry(workcellReadingKey(transport), readWorkcellOf(transport))
  await workcellEntry.retry(epoch)
  const workcell = workcellEntry.snapshot()
  const workcellAt = new Date(workcell.readAtUnixMs ?? Date.now()).toISOString()
  if (workcell.status !== 'answered') {
    sources.push({
      boundaryOp: 'op workcell_status_read',
      channel: 'kernel-op',
      at: workcellAt,
      refusal: workcell.error ?? 'the workcell status reading did not answer',
    })
  } else {
    sources.push({boundaryOp: 'op workcell_status_read', channel: 'kernel-op', at: workcellAt})
    // Workcell's own status names its machine `workcell_ref` (centralHygieneModel.ts workcellRefOf).
    machineRef = workcellRefOf(workcell.value)
  }

  // The kernel's git read of each of the world's projects — refused verbatim when the owner refuses; a world with no project has no
  // repository to read (git_repository_read reads a project's), said so.
  if (!projects.length) sources.push({boundaryOp: 'op git_repository_read', channel: 'kernel-op', at: new Date().toISOString(), refusal: NO_PROJECT_REPOSITORY})
  for (const project of projects) {
    const gitAt = new Date().toISOString()
    const git = await kernelRead(transport, {op: 'git_repository_read', project}, {fresh: true})
    if (git.error || git.outcome?.result !== 'git_repository_reading') {
      sources.push({
        boundaryOp: `op git_repository_read (project ${project})`,
        channel: 'kernel-op',
        at: gitAt,
        refusal: git.error ?? 'the git repository reading did not answer',
      })
    } else {
      sources.push({boundaryOp: `op git_repository_read (project ${project})`, channel: 'kernel-op', at: gitAt})
    }
  }

  // The machine-level declared reads — the seat instrument and read-only
  // git, each naming its exact boundary operation.
  if (machineRead) {
    for (const kind of ['seat-status', 'worktree-list', 'branch-refs'] as const) {
      try {
        const result = await machineRead(kind)
        const at = new Date().toISOString()
        sources.push({boundaryOp: result.boundaryOp, channel: 'machine-instrument', at, refusal: result.refused})
        // The parts that refused beside the answered reading, each named by its operation and in its owner's words: never silent.
        for (const part of result.partial ?? []) sources.push({boundaryOp: part.boundaryOp, channel: 'machine-instrument', at, refusal: part.refusal})
        if (result.refused) continue
        if (kind === 'seat-status') {
          // The instrument's own JSON (`seat status --json`) states every count; its text is read only when the host ran that.
          seats = parseSeatStatusJson(result.stdout) ?? parseSeatStatus(result.stdout)
        }
        if (kind === 'worktree-list') worktrees = parseWorktreeList(result.stdout)
        if (kind === 'branch-refs') branches = parseBranchRefs(result.stdout)
      } catch (error) {
        sources.push({
          boundaryOp: `machine read ${kind}`,
          channel: 'machine-instrument',
          at: new Date().toISOString(),
          refusal: String(error),
        })
      }
    }
  }

  const census = assembleCensus({sources, worktrees, branches, seats, machineRef, ...(primaries ? {primaries} : {})})
  // The registered paths come from the census's own seat rows; the host's
  // seatPaths prop, when supplied, is admitted alongside them.
  const registered = [...new Set([...seatPaths, ...registeredSeatPaths(census)])]
  return {census, findings: hygieneFindings(census, registered)}
}

export function CentralHygieneDevice({transport, machineRead, seatPaths = [], primaries, expanded = false}: CentralHygieneDeviceProps) {
  const [state, setState] = useState<ReadState>({census: null, findings: [], pending: false, fault: null})
  const epoch = useSpineEpoch()
  // The world's projects (agent/worldScope.ts), each one's repository read.
  const world = useWorldProjects(transport)
  const projectsKey = world.status === 'answered' && world.value ? world.value.join('\n') : ''

  const read = useCallback(async () => {
    setState(prev => ({...prev, pending: true, fault: null}))
    const {census, findings} = await readHygieneCensus({transport, epoch, machineRead, seatPaths, primaries, projects: projectsKey ? projectsKey.split('\n') : []})
    setState({census, findings, pending: false, fault: null})
  }, [machineRead, seatPaths, primaries, transport, epoch, projectsKey])

  const strip = state.census
    ? `${state.census.worktrees.length} worktrees · ${state.census.branches.length} branches · ${state.census.seats.length} seats`
      + (state.census.machineRef ? ` · ${state.census.machineRef}` : '')
    : 'no census read yet'

  return (
    <article className="inhabitant-device" data-central-device="ground-hygiene" data-census={state.census ? 'read' : 'unread'}>
      <header className="inhabitant-device-head">
        <span className={`inhabitant-light${state.census ? ' is-admitted' : ''}`} title={state.census ? 'The owners answered or refused — the census stands' : 'No census has been read yet'} />
        <span className="inhabitant-device-mark"><KindMark kind="location" size={12} title="ground hygiene"/></span>
        <strong>Ground hygiene</strong>
        <span className="inhabitant-device-sub">readings · {strip}</span>
        <span className="inhabitant-device-save" role="status" data-hygiene-standing={state.pending ? 'reading' : state.census ? 'read' : 'unread'}>
          {state.pending ? 'reading the owners…' : state.census ? `${state.findings.length} finding${state.findings.length === 1 ? '' : 's'}` : 'not read'}
        </span>
      </header>
      <div className="inhabitant-device-actions">
        <button type="button" data-action="read-census" disabled={state.pending} onClick={() => void read()}>
          {state.census ? 'Re-read the ground' : 'Read the ground'}
        </button>
      </div>
      {state.fault && <p className="inhabitant-device-fault" role="alert">{state.fault}</p>}
      {expanded && state.census && (
        <div className="inhabitant-device-body" data-hygiene-body>
          <ul className="inhabitant-reading-list" data-hygiene-sources>
            {state.census.sources.map(source => (
              <li key={`${source.boundaryOp}:${source.at}`} className="inhabitant-reading" data-reading-channel={source.channel} data-refused={source.refusal ? 'true' : 'false'}>
                <span className="inhabitant-reading-op" title={`${source.boundaryOp} at ${source.at}`}>{source.boundaryOp}</span>
                {source.refusal
                  ? <span className="inhabitant-reading-refusal" data-refusal-text>{source.refusal}</span>
                  : <span className="inhabitant-reading-ok">answered</span>}
              </li>
            ))}
          </ul>
          <ul className="inhabitant-reading-list" data-hygiene-findings>
            {state.findings.length === 0 && <li className="inhabitant-reading"><span className="inhabitant-reading-ok">no findings — every seat claim accounts for its branch, every worktree is registered</span></li>}
            {state.findings.map(finding => (
              <li key={`${finding.kind}:${finding.subject}`} className="inhabitant-reading" data-finding-kind={finding.kind}>
                <span className="inhabitant-reading-op" title={finding.boundaryOps.join(' · ')}>{finding.kind}</span>
                <span className="inhabitant-reading-standing">{finding.subject} — {finding.standing}</span>
                {finding.tenderId && <span className="inhabitant-reading-tender">tender available: {finding.tenderId} (declared, waiting)</span>}
              </li>
            ))}
          </ul>
          <div className="inhabitant-device-actions" data-hygiene-tenders>
            {HYGIENE_TENDERS.map(tender => (
              <span key={tender.id} className="inhabitant-tender-wrap" data-tender-wrap={tender.id}>
                <button
                  type="button"
                  className="inhabitant-tender"
                  data-tender={tender.id}
                  disabled
                  title={`${tender.ownerOperation} — ${tender.waitsFor}. Receipt: ${tender.receiptShape}`}
                >
                  {tender.label} (declared)
                </button>
                <span className="inhabitant-tender-receipt" data-tender-receipt>
                  {tender.ownerOperation} · receipt: {tender.receiptShape}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}
