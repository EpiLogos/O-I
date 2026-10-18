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
//
// R3: the event lanes read the same provider's temporal events (AgentSessionsProvider `events`, the frame's one temporal read),
// and every session's Arm is the shell's one write arm — the transport's own press (shell/transports/useFactoryTransport.tsx:92
// `dispatch('arm', 'shell.setWriteArm', …)`), through the same registered setter (inhabitants/sdk/shellSetters.ts), its light the
// agent shell's flag, which the setter bridge moves only when the owner accepts (agent/shellSetterBridge.ts).
import {useMemo} from 'react'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {useAgencySessions} from '../../agent/useAgencySessions'
import {useAgentSessionsOptional} from '../../agent/AgentSessionsProvider'
import {useAgentShellOptional} from '../../agent/AgentShellContext'
import {useHarnessBinding} from '../../agent/useHarnessBinding'
import {harnessAgentControl} from '../../agent/harnessAgentControl'
import {shellSetter} from '../../inhabitants/sdk/shellSetters'
import {factoryTrackAdapter, type FactoryControls, type FactoryWriteArm} from '../../timeline/factoryTrackAdapter'
import type {UseModeTracks} from './modeTracks'

const WRITE_ARM = 'shell.setWriteArm'

/** The shell's write arm as the tracks press it: the registered setter's receipt, or the refusal that none is registered. */
export function shellWriteArm(on: boolean | null, setter: typeof shellSetter = shellSetter): FactoryWriteArm {
  return {
    on,
    set: async value => {
      const dispatch = setter(WRITE_ARM)
      if (!dispatch) return {ok: false, error: `${WRITE_ARM} is not registered in this session: the transport's write arm registers it, so the press reached no owner.`}
      // The setter's receipt (inhabitants/sdk/shellSetters.ts DispatchReceipt), in the words the views show: fired with its note, or
      // refused with its reason and the op it names.
      const receipt = await dispatch(value)
      return receipt.kind === 'fired' ? {ok: true, note: receipt.note}
        : {ok: false, error: `${receipt.reason}${receipt.missingOp ? ` — missing op: ${receipt.missingOp}` : ''}`}
    },
  }
}

const NO_CARRIER: KernelTransportStatus = {kind: 'unavailable', reason: 'The shell has published no kernel carrier for this reading.'}

/** Factory's tracks: a waiting reason while the sessions are unread or their read was refused (the pane says it);
 * the sessions as tracks once the agency answers, an empty set when it answers none. */
export const useFactoryTracks: UseModeTracks = reading => {
  const transport = reading.transport ?? NO_CARRIER
  const agency = useAgencySessions(transport)
  const events = useAgentSessionsOptional()?.events
  const shell = useAgentShellOptional()
  const armOn = shell ? shell.writeArm : null
  const writeArm = useMemo(() => shellWriteArm(armOn), [armOn])
  const harness = useHarnessBinding(transport)
  // Actions only once the owner has named its harness binding (never the shell's default 'cursor').
  const owned = transport.kind !== 'unavailable' && harness.error === null && harness.resolved
  const controls = useMemo<FactoryControls | undefined>(
    () => owned ? {control: control => harnessAgentControl(transport, harness.binding, control)} : undefined,
    [owned, transport, harness.binding],
  )
  if (!agency.tracks.length && agency.error) return {waiting: `The agent sessions are unread: ${agency.error}`}
  if (!agency.tracks.length && agency.loading) return {waiting: 'The agent sessions arrive when the agency read answers.'}
  return factoryTrackAdapter.project({tracks: agency.tracks, nowUnixMs: Date.now(), controls, ...(events ? {events} : {}), writeArm})
}
