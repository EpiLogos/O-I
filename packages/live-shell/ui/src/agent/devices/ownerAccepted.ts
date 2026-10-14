// What the owner has accepted of the shell's own settings, per harness binding (manual §10.4: "if the state is not known, the light
// stays dark"; lock §0.4: owners write, faces read). The agent shell keeps effort and input as its own state with defaults it
// starts with ('high', 'steer'); that state is a presentation of the press, not a reading of the harness, so the Factory devices
// never read it. What they read instead is here: a value is recorded only when the owner answered the write with a receipt that
// fired (shellSetterBridge.ts records it, after the owner accepts and not before). Heartbeat and the write arm have no entry:
// the dispatcher calls both presentation-state (agentNativeDispatch.ts) and refuses them, so no owner has ever accepted one.
//
// Pure of views except the subscription hook; a snapshot is replaced, never mutated, so a subscriber sees a stable reference
// until something is recorded.
import {useSyncExternalStore} from 'react'
import {agentAddress} from '../../inhabitants/agentParamAddresses'

/** The rows the owner has accepted a value for, by the row's key. */
export interface OwnerAcceptedValues {
  readonly effort?: string
  readonly input?: 'steer' | 'queue'
}

const NONE: OwnerAcceptedValues = Object.freeze({})
let held: Readonly<Record<string, OwnerAcceptedValues>> = {}
const listeners = new Set<() => void>()
const announce = () => { for (const listener of [...listeners]) listener() }

/** Record the owner's acceptance of one row's value on one harness binding. Only the rows the devices read, and only values
 * inside the row's declared choices, are kept; anything else is not an acceptance of a row here and returns false. */
export function recordOwnerAccepted(binding: string, key: string, value: unknown): boolean {
  const before = held[binding] ?? NONE
  let next: OwnerAcceptedValues
  if (key === 'effort' && typeof value === 'string' && (agentAddress('agent', 'effort')?.values ?? []).includes(value)) next = {...before, effort: value}
  else if (key === 'input' && (value === 'steer' || value === 'queue')) next = {...before, input: value}
  else return false
  held = {...held, [binding]: next}
  announce()
  return true
}

/** What the owner has accepted on this binding; nothing, until it has accepted something. */
export const ownerAccepted = (binding: string): OwnerAcceptedValues => held[binding] ?? NONE

export function subscribeOwnerAccepted(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Forget every acceptance (a test stands a fresh session). */
export function resetOwnerAccepted(): void {
  held = {}
  announce()
}

/** The accepted values of a binding, live. */
export function useOwnerAccepted(binding: string): OwnerAcceptedValues {
  return useSyncExternalStore(subscribeOwnerAccepted, () => ownerAccepted(binding), () => NONE)
}
