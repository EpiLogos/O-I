// The widget contract (FOUNDATION F8; manual §10.6: "The rail on the right holds widgets: small live views of whatever you
// want to keep at hand while you work … Each widget holds a piece of context that belongs to your whole world, not to one
// kind of work, so it stays with you when you move."). A widget is a plugin: an id, a name, its mark, and a body that
// draws what it holds for the subject it follows — or, pinned, the subject it was pinned at. Pure TypeScript.
import type {ComponentType, ReactElement} from 'react'
import type {IconName} from '../../inhabitants/sdk/Icon'

export interface WidgetBodyProps {
  /** The subject the widget shows: the ref it was pinned at, else THE selection's ref; null when nothing is selected. */
  subject: string | null
  /** Pinned: it no longer follows the selection. */
  pinned: boolean
}

export interface WidgetDeclaration {
  id: string
  name: string
  /** Its mark: a name in the icon cut, or the widget's own drawn mark. */
  mark: IconName | ReactElement
  /** A one-line hint of what it holds, for its launcher cell. */
  hint?: string
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
