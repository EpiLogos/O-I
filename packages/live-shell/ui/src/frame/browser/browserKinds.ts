// The browser's four kinds (manual §10.3: "The browser holds four kinds of thing: material to open, instruments to open
// in a pane, devices to put on a chain, and running things you can work with where they are"). A category belongs to one
// kind; the one browser groups every category under its kind, in this order. Pure TypeScript.
import type {ComponentType, ReactNode} from 'react'

export type BrowserKind = 'material' | 'instruments' | 'devices' | 'running'

export const BROWSER_KINDS: readonly {kind: BrowserKind; label: string; hint: string}[] = [
  {kind: 'material', label: 'Material', hint: 'to open: select previews, double-click or drag to a pane opens'},
  {kind: 'instruments', label: 'Instruments', hint: 'to open in a pane'},
  {kind: 'devices', label: 'Devices', hint: 'to put on a chain: drag onto a chain adds'},
  {kind: 'running', label: 'Running', hint: 'running things to work with where they are: drag an agent onto an empty track seats it'},
]

/** A row body's controls when the one browser holds it: the category it shows, the search, and where its pool goes. */
export interface ControlledBrowser {
  category: string
  query: string
  /** The one pool under the browser: a body's own pool content is portalled here. */
  poolHost: HTMLElement | null
}

export interface BrowserCategory {
  id: string
  label: string
  kind: BrowserKind
  /** The category's mark (icon-cut). */
  mark?: ReactNode
  hint?: string
  /** Declared, but its owner read has not landed. */
  waiting?: boolean
}

/** A row source: its categories and the body that draws a category's rows. */
export interface BrowserSource {
  id: string
  categories: readonly BrowserCategory[]
  Body: ComponentType<{controlled: ControlledBrowser}>
}
