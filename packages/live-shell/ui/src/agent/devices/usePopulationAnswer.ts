// AIKit's population for the Link (DLW §19.19; lane BF3): `aikit gateway who --project-world W --json`, which the kernel runs as
// `inhabitation_read {kind: population}` (desktop/cradle/kernel/src/inhabitation.rs:33-38, :88), read with the cradle's own read
// (desktop/cradle/src/contributions/factory/inhabitation/reads.ts readPopulation) and held once for the window under the spine's
// epoch, as the shell holds every shared owner answer (owners/ownerReading.ts useOwnerReading). Its `remotes` are the declared
// remote Workcells, each asked once (ai-kit gateway_contact.rs:525-530 RemoteSurvey, :663-697 statuses), and its `positions` carry
// each occupant's Workcell (occupancy.workcell_ref). Read 16 Oct 2026 in 2.5 s here (the remote's 2 s timeout).
import {useMemo} from 'react'
import {readPopulation} from '../../../../../../desktop/cradle/src/contributions/factory/inhabitation/reads'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {useOwnerReading} from '../../owners/ownerReading'
import {useSpineEpoch} from '../../owners/spine'
import type {WorkcellAnswer} from './workcellBindings'

export const POPULATION_OP = 'inhabitation_read'

/** A register's population as the Link reads it: the owner's document, or its refusal in its own words with the command named. `project`
 * is a register (agent/worldScope.ts): your world's root register ('' or null) reads the whole population, named by no project world. */
export function usePopulationAnswer(transport: KernelTransportStatus, project: string | null): WorkcellAnswer {
  const epoch = useSpineEpoch()
  const carried = transport.kind !== 'unavailable'
  const world = project || undefined
  const {reading} = useOwnerReading(carried ? JSON.stringify([POPULATION_OP, transport, 'population', world ?? null]) : null, async () => {
    const read = await readPopulation(transport, world)
    return read.state === 'read' ? {value: read.data as unknown} : {error: `${read.source}: ${read.reason}`}
  }, epoch)
  const reason = transport.kind === 'unavailable' ? transport.reason : null
  // One answer object for one standing reading, so the bindings built on it move only when the reading does.
  return useMemo((): WorkcellAnswer => (reason !== null ? {status: 'refused', value: null, error: `the kernel carrier is unavailable: ${reason}`}
    : {status: reading.status, value: reading.value, error: reading.error}), [reason, reading])
}
