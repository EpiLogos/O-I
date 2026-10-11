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

import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {
  assembleCensus,
  hygieneFindings,
  registeredSeatPaths,
  HYGIENE_TENDERS,
  parseBranchRefs,
  parseSeatStatus,
  parseWorktreeList,
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
  readonly machineRead?: (kind: 'seat-status' | 'worktree-list' | 'branch-refs') => Promise<{boundaryOp: string; stdout: string; refused?: string}>
  /** The seat paths the register admits (the census classifies against them). */
  readonly seatPaths?: readonly string[]
  readonly expanded?: boolean
}

interface ReadState {
  readonly census: HygieneCensus | null
  readonly findings: readonly HygieneFinding[]
  readonly pending: boolean
  readonly fault: string | null
}

export function CentralHygieneDevice({transport, machineRead, seatPaths = [], expanded = false}: CentralHygieneDeviceProps) {
  const [state, setState] = useState<ReadState>({census: null, findings: [], pending: false, fault: null})

  const read = useCallback(async () => {
    setState(prev => ({...prev, pending: true, fault: null}))
    const sources: BoundaryOpSource[] = []
    let seats: ReturnType<typeof parseSeatStatus> = []
    let worktrees: ReturnType<typeof parseWorktreeList> = []
    let branches: ReturnType<typeof parseBranchRefs> = []
    let machineRef: string | null = null

    // The kernel's workcell read — the primary owner. A refusal is a reading.
    const workcellAt = new Date().toISOString()
    const workcell = await kernelOp(transport, {op: 'workcell_status_read'})
    if (workcell.error || workcell.outcome?.result !== 'workcell_status_reading') {
      sources.push({
        boundaryOp: 'op workcell_status_read',
        channel: 'kernel-op',
        at: workcellAt,
        refusal: workcell.error ?? 'the workcell status reading did not answer',
      })
    } else {
      sources.push({boundaryOp: 'op workcell_status_read', channel: 'kernel-op', at: workcellAt})
      const data = (workcell.outcome as {data?: {machine_ref?: string; register?: unknown}}).data
      machineRef = data?.machine_ref ?? null
    }

    // The kernel's git read — refused verbatim when the owner refuses.
    const gitAt = new Date().toISOString()
    const git = await kernelOp(transport, {op: 'git_repository_read', project: 'O-I'})
    if (git.error || git.outcome?.result !== 'git_repository_reading') {
      sources.push({
        boundaryOp: 'op git_repository_read (project O-I)',
        channel: 'kernel-op',
        at: gitAt,
        refusal: git.error ?? 'the git repository reading did not answer',
      })
    } else {
      sources.push({boundaryOp: 'op git_repository_read (project O-I)', channel: 'kernel-op', at: gitAt})
    }

    // The machine-level declared reads — the seat instrument and read-only
    // git, each naming its exact boundary operation.
    if (machineRead) {
      for (const kind of ['seat-status', 'worktree-list', 'branch-refs'] as const) {
        try {
          const result = await machineRead(kind)
          sources.push({boundaryOp: result.boundaryOp, channel: 'machine-instrument', at: new Date().toISOString(), refusal: result.refused})
          if (result.refused) continue
          if (kind === 'seat-status') {
            seats = parseSeatStatus(result.stdout)
            const machine = result.stdout.match(/^workcell (\S+)/)
            if (machine && !machineRef) machineRef = machine[1]
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

    const census = assembleCensus({sources, worktrees, branches, seats, machineRef})
    // The registered paths come from the census's own seat rows; the host's
    // seatPaths prop, when supplied, is admitted alongside them.
    const registered = [...new Set([...seatPaths, ...registeredSeatPaths(census)])]
    setState({census, findings: hygieneFindings(census, registered), pending: false, fault: null})
  }, [machineRead, seatPaths, transport])

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
