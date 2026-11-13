// The agency gateway's generation: moved when this window starts or stops the gateway (Messages' Start, §19.10 Service).
// The spine epoch (owners/spine.ts) moves only with a new access or world, so a reading that refused while no gateway ran would
// stand refused after one starts. The readers that ask the gateway (the chain's harness read, the population, the protocol, a
// conversation and its heard read) key their answers on the spine epoch and this generation together.
import {useSyncExternalStore} from 'react'

let generation = 0
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const snapshot = () => generation

/** The generation now. */
export function gatewayGeneration(): number { return generation }

/** The gateway was started or stopped here: every reader of it asks again. */
export function gatewayMoved(): void {
  generation++
  for (const listener of [...listeners]) listener()
}

/** The epoch a gateway reader keys on: the spine's, and the gateway's generation. Pure. The generation joins the spine's access
 * (before its first `|`), never its world: a started gateway is the same world asked again, so the last answer stands carried while
 * it is re-read and a reader still on the other generation draws it (owners/ownerReading.ts sameWorld). Walk 22 keyed it after the
 * world, and Start blanked Messages' agents. */
export function gatewayEpochKey(spine: string, at: number = generation): string { return `gw${at}+${spine}` }

/** The current generation, for a reader inside React. */
export function useGatewayGeneration(): number { return useSyncExternalStore(subscribe, snapshot, snapshot) }
