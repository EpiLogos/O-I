// The keyboard's layout, held in the shell (live/liveChainDevices.ts keyboardDevice: its one row, written to `shell.keyboardLayout`).
// One keyboard, one layout: the chain's plate, its picture in the pool, a pane or the rail, and the Jankó under the torus's Full all
// draw the layout held here, so a change in one place shows in every other at once (DEVICE-UI §2). Moved out of the plate's own state
// (KeyboardOnChain.tsx useState) when the keyboard was drawn in more than one place.
import {useSyncExternalStore} from 'react'
import type {KeyboardLayoutName} from './liveChainDevices'

let layout: KeyboardLayoutName = 'janko'
const listeners = new Set<() => void>()

export function keyboardLayout(): KeyboardLayoutName {
  return layout
}

export function setKeyboardLayout(next: KeyboardLayoutName): void {
  if (next === layout) return
  layout = next
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

export function useKeyboardLayout(): KeyboardLayoutName {
  return useSyncExternalStore(subscribe, keyboardLayout, keyboardLayout)
}
