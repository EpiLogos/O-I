import { createElement, type ComponentType } from 'react'

import { admittedPanelSlots, contestedPanelIds, inhabitantManifest } from '../inhabitants/manifest'
import type { SetSummary } from './useSet'

/**
 * Panel registry — the shell's extension surface.
 *
 * Panels are registered, never hard-wired: the shell renders whatever the
 * registry holds at render time, so a new panel is data flowing through
 * `registerPanel`, not a change to the frame. See ui/PANELS.md for the
 * integration guide other agents build against.
 */

/** Where in the frame a panel renders. */
export type PanelSlot =
  /** Persistent application inhabitants in the main working surface. */
  | 'center'
  /** Right-hand dock, stacked collapsible cards. */
  | 'right-dock'
  /** Bottom device-chain area, beside the chain tiles. */
  | 'bottom'
  /** Browser pane, under the "Elements" section header. */
  | 'browser-section'

/** Everything the shell hands a panel at render time. */
export interface PanelContext {
  /** The opened set summary, or null when nothing is open. */
  set: SetSummary | null
  loading: boolean
  error: string | null
  /** Open a set by absolute path (same path the browser uses). */
  openSet: (path: string) => void
}

export interface PanelRegistration {
  /** Stable namespaced id, e.g. "native.context" or "astra.groove". */
  id: string
  /** Display title in the panel header. */
  title: string
  /** Optional original glyph name from components/Icon.tsx, drawn at 14px. */
  icon?: string
  /** Where the panel docks. */
  slot: PanelSlot
  component: ComponentType<PanelContext>
  /** Lower renders first within a slot (default 100). */
  order?: number
  /** Open through Browser/context actions without adding a fixed mode button. */
  navigation?: boolean
  /** One-line description, surfaced as the header tooltip. */
  note?: string
}

const panels = new Map<string, PanelRegistration>()

/** Register (or replace, by id) a panel. Call at module top level. */
export function registerPanel(reg: PanelRegistration): void {
  if (panels.has(reg.id)) {
    console.warn(`[live-shell/panels] duplicate id "${reg.id}" — replacing`)
  }
  panels.set(reg.id, reg)
}

export function unregisterPanel(id: string): void {
  panels.delete(id)
}

// Family-declared panel slots (manifest `panelSlots`, composed at the door) read through this registry. A declared slot
// whose panel id the code has registered IS that registration: the declaration never duplicates it. The rest are the
// family's own placeholders — their bodies are not registered yet, so they show as waiting (no admitted face) or declared
// (an admitted face, no body). One body per family and panel, so the component identity is stable across renders.
const familyBodies = new Map<string, ComponentType<PanelContext>>()

function familyPanelBody(family: string, panel: string): ComponentType<PanelContext> {
  const key = `${family}\u0000${panel}`
  const known = familyBodies.get(key)
  if (known) return known
  const body = function FamilyPanelPlaceholder() {
    const admitted = (inhabitantManifest(family)?.faces ?? []).some((face) => face.admission !== 'waiting')
    const standing = admitted ? 'declared' : 'waiting'
    return createElement(
      'div',
      { className: 'family-panel-placeholder', 'data-family': family, 'data-panel': panel, 'data-admission': standing },
      admitted
        ? `The ${family} family declares this panel. Its body is not registered yet.`
        : `The ${family} family's panel waits: its owner has not landed a face for it.`,
    )
  }
  familyBodies.set(key, body)
  return body
}

// A panel id two family slot declarations claim is contested: it composes for neither (the door names it). Reported once.
const reportedContests = new Set<string>()

function familyPanels(): PanelRegistration[] {
  for (const [panel, families] of contestedPanelIds()) {
    if (reportedContests.has(panel)) continue
    reportedContests.add(panel)
    console.error(`[live-shell/panels] panel "${panel}" is declared by ${[...new Set(families)].join(', ')} — a panel id has one owner; it composes for none`)
  }
  const composed: PanelRegistration[] = []
  for (const {family, slot} of admittedPanelSlots()) {
    if (panels.has(slot.panel)) continue
    composed.push({
      id: slot.panel,
      title: slot.title ?? family,
      slot: slot.slot,
      component: familyPanelBody(family, slot.panel),
      note: `Declared by the ${family} family`,
    })
  }
  return composed
}

/** Panels for a slot, ordered by `order` then title. Code-registered panels and the admitted families' declared slots. */
export function getPanels(slot: PanelSlot): PanelRegistration[] {
  return allPanels()
    .filter((p) => p.slot === slot)
    .sort(
      (a, b) =>
        (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title),
    )
}

export function allPanels(): PanelRegistration[] {
  return [...panels.values(), ...familyPanels()]
}
