// The widget contract (FOUNDATION F8; manual §10.6: "The rail on the right holds widgets: small live views of whatever you
// want to keep at hand while you work … Each widget holds a piece of context that belongs to your whole world, not to one
// kind of work, so it stays with you when you move."). A widget is a plugin: an id, a name, its mark, and a body that
// draws what it holds for the subject it follows — or, pinned, the subject it was pinned at. Pure TypeScript.
import type {ComponentType, ReactElement} from 'react'
import type {IconName} from '../../inhabitants/sdk/Icon'

/** What an open body read, handed up so the rail can wear it: the count in the tile's head and the live miniature in the
 * launcher cell (world-shell-mockup.html `.tile`, `.lcell .pv`). Only what the body's owner disclosed — a body that reads
 * nothing hands up nothing, and its cell keeps the widget's designed mark. */
export interface WidgetGlance {
  /** The owner's count of what the widget holds (the packet's items, the trail's stops). */
  count?: number
  /** A word for the count or the reading's standing, under the cell's name ("open" is the rail's own). */
  status?: string
  /** The reading's first lines, drawn at preview scale in the launcher cell. */
  lines?: readonly WidgetGlanceLine[]
}
export interface WidgetGlanceLine {
  /** A short faint lead (a time, a size, a speaker). */
  lead?: string
  text: string
}

export interface WidgetBodyProps {
  /** The subject the widget shows: the ref it was pinned at, else THE selection's ref; null when nothing is selected. */
  subject: string | null
  /** Pinned: it no longer follows the selection. */
  pinned: boolean
  /** Hand the rail what the body read (null when it reads nothing). The rail clears it when the widget closes. */
  glance?: (glance: WidgetGlance | null) => void
}

export interface WidgetDeclaration {
  id: string
  name: string
  /** Its mark: a name in the icon cut, or the widget's own drawn mark. */
  mark: IconName | ReactElement
  /** A one-line hint of what it holds, for its launcher cell. */
  hint?: string
  /** A name that follows the world (the agent of the mode in front of you): drawn in the head and the cell for `name`. */
  Name?: ComponentType
  Body: ComponentType<WidgetBodyProps>
}

/** The rail's state as the book holds it (desktop/cradle/src/workspace/store.ts WidgetRail). */
export interface WidgetRailState {
  open: readonly string[]
  pinned?: Readonly<Record<string, string>>
  presets?: readonly {id: string; name: string; open: readonly string[]}[]
  width?: number
}

/** The book's writes the rail uses (the workspace book's own operations). */
export interface WidgetRailBook {
  rail: WidgetRailState
  toggle(id: string): void
  pin(id: string, ref: string | null): void
  savePreset(name: string): void
  applyPreset(id: string): void
  widen(width: number): void
}

/** Two glances are the same reading when they draw the same: the rail keeps the held one, so a body may hand up every render. */
export const sameGlance = (a: WidgetGlance | null | undefined, b: WidgetGlance | null | undefined): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
