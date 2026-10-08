import type { ComponentType } from 'react'

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
  /** Stable namespaced id, e.g. "core.inspector" or "astra.groove". */
  id: string
  /** Display title in the panel header. */
  title: string
  /** Optional 24x24 SVG path data (stroke space), drawn at 14px. */
  icon?: string
  /** Where the panel docks. */
  slot: PanelSlot
  component: ComponentType<PanelContext>
  /** Lower renders first within a slot (default 100). */
  order?: number
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

/** Panels for a slot, ordered by `order` then title. */
export function getPanels(slot: PanelSlot): PanelRegistration[] {
  return [...panels.values()]
    .filter((p) => p.slot === slot)
    .sort(
      (a, b) =>
        (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title),
    )
}

export function allPanels(): PanelRegistration[] {
  return [...panels.values()]
}
