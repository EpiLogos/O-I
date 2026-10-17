// What the atlas binds for palaces while it stands (T-PALACES-ONTO-ATLAS; FOUNDATION §3 N4). Called once by the attach
// (AtlasProjectionPanel.tsx), released with it, beside the Places binding (places/placesHost.ts) — the same seam, the same lifetime.
//
// - The palace's owners (palaceOwners.ts) over the attach's kernel transport and the atlas's workspace memory.
// - The palace drawn inside (PalaceFloor.tsx): one layer in the pane, over the globe, made the first time a palace is entered and drawing
//   only while one is — the atlas's palace scale. The globe stays mounted beneath it, its state and keys unchanged, and comes back as it was on leaving.
// - Escape leaves the palace for the Earth (the atlas's own step back, one level out; the palace's return to ground), before the
//   atlas's own Escape sees it — a person typing in a field keeps their Escape. It is listened for only while a palace stands.
// The layer carries no control: the palace's controls are the M5 plate's and the transport's.

import {createElement} from 'react'
import {createRoot, type Root} from 'react-dom/client'
import type {KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {PresenceStorage} from '../../../../../../../desktop/cradle/src/techne/m0m5/journey/presence'
import {listen} from '../src/ui/lifetime'
import {livePalaceOwners} from './palaceOwners'
import {PalaceFloor} from './PalaceFloor'
import {bindPalaceOwners, leavePalace, palaceState, sayLine, subscribePalace} from './palaceSession'
import './palaces.css'

export interface PalacesBinding {
  dispose(): void
}

/** True while a field takes the keys (the shell's own rule for its key doors: F9, suppressed while typing). */
function typing(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  return !!element && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName ?? ''))
}

/** Bind palaces to the mounted atlas: the owners, the floor layer in the pane, and Escape out. */
export function bindPalaces({element, transport, storage}: {element: HTMLElement; transport: KernelTransportStatus; storage: () => PresenceStorage | null}): PalacesBinding {
  let live = true
  // a door that answers after the act (the subject door, Graph and source) says its answer on the palace's line
  const said = (line: string) => { if (live) sayLine(line) }
  bindPalaceOwners(livePalaceOwners({transport, storage, said, live: () => live}))
  // The layer stands from the first time a palace is entered: until then the pane is the Earth's alone.
  let layer: HTMLDivElement | null = null
  let root: Root | null = null
  const mark = () => {
    const phase = palaceState().phase
    if (!layer && phase !== 'outside' && live) {
      layer = document.createElement('div')
      layer.className = 'atlas-palace-layer'
      element.append(layer)
      root = createRoot(layer)
      root.render(createElement(PalaceFloor))
    }
    if (layer) layer.dataset.palace = phase
  }
  // Escape is listened for only while a palace stands, on the document's capture (before the atlas's own window listener sees it), so
  // the Earth outside a palace holds exactly the listeners it held before palaces lived in it.
  const onEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || typing(event.target) || palaceState().phase === 'outside') return
    event.stopImmediatePropagation()
    event.preventDefault()
    leavePalace('Left the palace for the Earth.')
  }
  let offKeys: (() => void) | null = null
  const keys = () => {
    const standing = palaceState().phase !== 'outside' && live
    if (standing && !offKeys) offKeys = listen<KeyboardEvent>(document, 'keydown', onEscape, true)
    else if (!standing && offKeys) { offKeys(); offKeys = null }
  }
  const offMark = subscribePalace(() => { mark(); keys() })
  mark()
  keys()
  return {
    dispose() {
      if (!live) return
      live = false
      offMark()
      offKeys?.()
      offKeys = null
      bindPalaceOwners(null)
      root?.unmount()
      root = null
      layer?.remove()
      layer = null
    },
  }
}
