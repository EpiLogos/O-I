// Factory's tracks for the one Session and Arrangement (FOUNDATION F3; manual §6): the agent sessions as tracks, their tasks as
// clips. A hook over the published reading, which carries the kernel carrier. It reads the sessions with `useAgencySessions`
// — the one agency store, never a second poll of its own — and projects them with timeline/factoryTrackAdapter.ts.
//
// Its actions go through the one owner path the agent shell already uses, `harness_agent_control` on the bound harness
// (agent/harnessAgentControl.ts, the binding agent/useHarnessBinding.ts resolves — as agent/AgentShellRoot.tsx:23-33 wires the
// grid's hard stop and retry). With no carrier, or a harness binding the kernel has not resolved, there is no owner path and
// so no action: the grid stays read-only and says so.
//
// The tasks and the needles come from the sessions provider (agent/AgentSessionsProvider.tsx). Mounted above this pane, every
// caller reads its one poll; unmounted, `useAgencySessions` serves its own fallback — the sessions, with no tasks and no needles.
import {useMemo} from 'react'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {useAgencySessions} from '../../agent/useAgencySessions'
import {useHarnessBinding} from '../../agent/useHarnessBinding'
import {harnessAgentControl} from '../../agent/harnessAgentControl'
import {factoryTrackAdapter, type FactoryControls} from '../../timeline/factoryTrackAdapter'
import type {UseModeTracks} from './modeTracks'

const NO_CARRIER: KernelTransportStatus = {kind: 'unavailable', reason: 'The shell has published no kernel carrier for this reading.'}

/** Factory's tracks: a waiting reason while the sessions are unread or their read was refused (the pane says it);
 * the sessions as tracks once the agency answers, an empty set when it answers none. */
export const useFactoryTracks: UseModeTracks = reading => {
  const transport = reading.transport ?? NO_CARRIER
  const agency = useAgencySessions(transport)
  const harness = useHarnessBinding(transport)
  const owned = transport.kind !== 'unavailable' && harness.error === null
  const controls = useMemo<FactoryControls | undefined>(
    () => owned ? {control: control => harnessAgentControl(transport, harness.binding, control)} : undefined,
    [owned, transport, harness.binding],
  )
  if (!agency.tracks.length && agency.error) return {waiting: `The agent sessions are unread: ${agency.error}`}
  if (!agency.tracks.length && agency.loading) return {waiting: 'The agent sessions arrive when the agency read answers.'}
  return factoryTrackAdapter.project({tracks: agency.tracks, nowUnixMs: Date.now(), controls})
}
