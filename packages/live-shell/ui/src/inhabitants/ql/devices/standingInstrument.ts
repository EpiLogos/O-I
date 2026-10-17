// The instrument the Technē rack stands open, by the focused pane's instrument (TechneDevices.tsx `open`). The focused pane names one
// instrument (shell/paneInstrument.ts), but the rack can stand another open over it: a fold pressed (M4′ World / Places over the Earth
// pane's M0′), a palace entered (M5′), or every instrument folded. The Device side's head names the instrument actually standing (lead,
// 16 Oct: the detail head read "Project open…" while M4′/M5′ stood), so the rack publishes it here and the head reads it.
import {useSyncExternalStore} from 'react'

const standing = new Map<string, string | null>()
const listeners = new Set<() => void>()
let version = 0

/** The rack standing over the focused pane's instrument `focus` publishes the instrument it stands open (null: every one folded), or
 * withdraws its word (undefined) when it leaves. */
export function publishStandingInstrument(focus: string, open: string | null | undefined): void {
  if (open === undefined ? !standing.has(focus) : standing.get(focus) === open) return
  if (open === undefined) standing.delete(focus); else standing.set(focus, open)
  version++
  for (const listener of [...listeners]) listener()
}

/** The instrument the rack stands open while `focus` is the focused pane's: undefined when no rack has said (the focus stands). */
export function standingInstrument(focus: string | null): string | null | undefined {
  return focus === null ? undefined : standing.get(focus)
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The instrument standing for the focused pane's instrument, re-read when a rack publishes. */
export function useStandingInstrument(focus: string | null): string | null | undefined {
  useSyncExternalStore(subscribe, () => version, () => version)
  return standingInstrument(focus)
}
