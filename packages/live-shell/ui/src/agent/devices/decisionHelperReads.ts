// The Decision helper's two owner reads (T-AGENCY K5; kernel ops decision_status and team_space), each held once for the window in the
// shared owner readings (owners/ownerReading.ts), as workcellReads.ts holds lane K1's:
//   - `decision_status` → aikit.decision-status/v1, AIKit's decision provider (`aikit decide status`; asks no model);
//   - `team_space` → ql.vak-team-space/v1, Quaternal Logic's team space (`ql context-frame team-space`).
// Both are machine-level. They are read when the helper stands on a chain (a group's), drawn last-first when it comes back, and
// re-read on the spine's epoch. A refusal is the owner's words, carried as the reading's error.
import {kernelOp} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {useOwnerReading, type OwnerRead} from '../../owners/ownerReading'
import {useSpineEpoch} from '../../owners/spine'

const unavailable = (transport: KernelTransportStatus): string | null => (transport.kind === 'unavailable' ? transport.reason ?? 'Transport unavailable' : null)

export const DECISION_STATUS_OP = 'decision_status'
export const TEAM_SPACE_OP = 'team_space'
export const decisionStatusKey = (transport: KernelTransportStatus): string => JSON.stringify([DECISION_STATUS_OP, transport])
export const teamSpaceKey = (transport: KernelTransportStatus): string => JSON.stringify([TEAM_SPACE_OP, transport])

/** AIKit's decision provider through the kernel. */
export function readDecisionStatusOf(transport: KernelTransportStatus): OwnerRead<unknown> {
  return async () => {
    const down = unavailable(transport)
    if (down) return {error: down}
    const result = await kernelOp(transport, {op: 'decision_status'})
    if (result.error || result.outcome?.result !== 'decision_status_reading') return {error: result.error ?? 'AIKit did not return its decision provider.'}
    return {value: result.outcome.data}
  }
}

/** Quaternal Logic's team space through the kernel. */
export function readTeamSpaceOf(transport: KernelTransportStatus): OwnerRead<unknown> {
  return async () => {
    const down = unavailable(transport)
    if (down) return {error: down}
    const result = await kernelOp(transport, {op: 'team_space'})
    if (result.error || result.outcome?.result !== 'team_space_reading') return {error: result.error ?? 'Quaternal Logic did not return its team space.'}
    return {value: result.outcome.data}
  }
}

/** Both readings, shared; `enabled` false reads nothing (no helper stands on a chain). */
export function useDecisionHelperReadings(transport: KernelTransportStatus, enabled: boolean) {
  const epoch = useSpineEpoch()
  const status = useOwnerReading(enabled ? decisionStatusKey(transport) : null, readDecisionStatusOf(transport), epoch)
  const team = useOwnerReading(enabled ? teamSpaceKey(transport) : null, readTeamSpaceOf(transport), epoch)
  return {
    status: status.reading.status === 'answered' ? status.reading.value : null,
    teamSpace: team.reading.status === 'answered' ? team.reading.value : null,
    errors: [status.reading.error, team.reading.error].filter((error): error is string => !!error),
  }
}
