// The browser's groups down its left side (manual §10.3: "Down the browser's left side stand Live's three groups: Collections, the
// coloured favourites you make; the four kinds above, as Live's categories; and Places, where your ground lies"). The four kinds
// ("The browser holds four kinds of thing: material to open, instruments to open in a pane, devices to put on a chain, and running
// things you can work with where they are") stand between the Collections and the Places. A category belongs to one group; the one
// browser groups every category under its own, in this order. Pure TypeScript.
import type {ComponentType, ReactNode} from 'react'

export type BrowserKind = 'collection' | 'material' | 'instruments' | 'devices' | 'running' | 'place'

export const BROWSER_KINDS: readonly {kind: BrowserKind; label: string; hint: string}[] = [
  {kind: 'collection', label: 'Collections', hint: 'the coloured favourites you make: what you put in a collection stands under its colour'},
  {kind: 'material', label: 'Material', hint: 'to open: select previews, double-click or drag to a pane opens'},
  {kind: 'instruments', label: 'Instruments', hint: 'to open in a pane'},
  {kind: 'devices', label: 'Devices', hint: 'to put on a chain: drag onto a chain adds'},
  {kind: 'running', label: 'Running', hint: 'running things to work with where they are: drag an agent onto an empty track seats it'},
  {kind: 'place', label: 'Places', hint: 'where your ground lies: you, your agents, your machines and your work'},
]

/** A row body's controls when the one browser holds it: the category it shows, the search, and where its preview goes. */
export interface ControlledBrowser {
  category: string
  query: string
  /** The foot of the list (manual §16.7: "Select a row to preview it at the foot of the list"): a body portals its selected
   * row's preview here — a page's first lines, a material's picture, a device's account of what it does. */
  previewHost: HTMLElement | null
}

export interface BrowserCategory {
  id: string
  label: string
  kind: BrowserKind
  /** The category's mark (icon-cut). */
  mark?: ReactNode
  hint?: string
  /** The category's words in the Info view (its row's data-i): what its rows read and what selecting one does. Absent, the
   * hint stands. */
  info?: string
  /** Declared, but its owner read has not landed. */
  waiting?: boolean
  /** How many rows the category holds, when its source discloses that (the mockup's right-aligned count). Never guessed:
   * a source that does not know leaves it out, and the column draws no count. */
  count?: number
  /** The category's own acts in the column, as Live's collection labels have them (manual §10.9: its menu — right-click, the menu key
   * or ⇧F10 — lists each act with its key). Absent, the category has no menu. */
  acts?: CategoryActs
}

/** What a category of the column can have done to it, each through its owner; a refusal is thrown in the owner's words. */
export interface CategoryActs {
  /** Rename (⌘R): the column takes the new name in place. */
  rename?: (name: string) => Promise<void>
  /** Hide: the category leaves the column; the group's Edit brings it back. */
  hide?: () => Promise<void>
}

/** One category a group's Edit lists (Live's Edit on the Collections: each label with a box, ticked where the column shows it). */
export interface EditEntry {
  id: string
  label: string
  mark?: ReactNode
  shown: boolean
  /** Show or hide it, through its owner. */
  show: (shown: boolean) => Promise<void>
}

/** A row source: its categories and the body that draws a category's rows. */
export interface BrowserSource {
  id: string
  categories: readonly BrowserCategory[]
  Body: ComponentType<{controlled: ControlledBrowser}>
  /** A source whose categories follow its owner (the Collections: one category per collection that holds something): it says when
   * they move, and `categories` is read again. */
  moves?: {subscribe(listener: () => void): () => void; version(): number}
  /** What keeps such a source's owner read while the browser stands (it draws nothing). */
  Keeper?: ComponentType
  /** Live's Edit on the heading of the group this source's categories stand in: every category it may show, hidden ones too, each with
   * whether the column shows it. The heading keeps its Edit while every category is hidden. */
  edit?: {kind: BrowserKind; entries: () => readonly EditEntry[]}
}
