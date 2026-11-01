// The skills rack's chosen member (manual §19.7: "Select a member to expand it above the rack"; every chain works at once, so the
// rack declares no selector among them). Choosing a member is a choice of view, not an owner write, so it is held here — one choice for the compact rack, the pool and the pane, which all draw the same rack.
import {useSyncExternalStore} from 'react'

let held: string | null = null
const listeners = new Set<() => void>()

export function selectSkillChain(ref: string | null): void {
  if (held === ref) return
  held = ref
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The chosen chain among these: the one held, else the first (a rack always has one selected chain), null with none. */
export function chosenChain(chains: readonly {ref: string}[] | null, choice: string | null): string | null {
  if (!chains?.length) return null
  return chains.some(chain => chain.ref === choice) ? choice : chains[0]!.ref
}

export function useSelectedSkillChain(chains: readonly {ref: string}[] | null): string | null {
  const choice = useSyncExternalStore(subscribe, () => held, () => held)
  return chosenChain(chains, choice)
}
