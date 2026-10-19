// What a double-click, or Enter, on one of the browser's Central rows opens (manual §10.3: "To preview something, select it
// once. To open it, double-click it or drag it into a pane"). A row's selection is unchanged — it previews, in the Document
// detail. Opening goes two ways, both into the pane that has focus:
//   - a Days row opens its Day, and a Flow instance in the Files rows its Flow, in a pane of their own kind
//     (centralDocuments.ts — the document is held by that pane; CentralDocumentPane.tsx draws it);
//   - every other file opens through the Workbench's own file route, the sequence the Files category of the world browser
//     (components/WorldBrowser.tsx `selectFile`) already uses: the file's binding opens in the focused pane, the owner reads
//     the file, and the reading qualifies the binding. Nothing about a file's own surface changes. A day record in the Files
//     rows is a file like any other: it opens as itself, and the Days rows open the Day.
// A refusal is thrown in the owner's words, and the row says it.
import {useMemo, useRef} from 'react'
import {useOptionalContinuity} from '../../continuity/workspace'
import {useWorkspace} from '../../shell/workspaceContext'
import type {WorkspaceReading} from '../../shell/workspaceTypes'
import type {LayoutState} from '../../../../../../desktop/cradle/src/surface/types'
import {dayOfEntry, flowOfEntry, openCentralDocumentAt, type CentralDocumentTarget, type DocumentEntry} from './centralDocuments'

/** A newer open retires an older one still reading (the world browser's own file-epoch law). */
let opening = 0

/** Open one ground file through the Workbench's file route. Rejects with the owner's refusal, or with why it cannot be read. */
export async function openGroundFile(held: {readonly current: WorkspaceReading}, entry: DocumentEntry): Promise<void> {
  const workspace = held.current
  if (entry.kind !== 'file') throw new Error(`${entry.name} is a ${entry.kind}, not a file; Central opens files.`)
  if (!entry.retrieval_allowed) throw new Error(`${entry.name} is withheld by its owner (retrieval not allowed), so it does not open.`)
  if (workspace.transport.kind === 'unavailable') throw new Error(workspace.transport.reason)
  if (!workspace.accessReady) throw new Error('The native owner access is not ready yet, so no file opens. Try again in a moment.')
  const {workspaceId, accessEpoch, resources} = workspace
  const generation = ++opening
  const intent = {
    workspaceId,
    viewId: workspace.prepareSource(entry.location),
    generation,
    isCurrent: () => generation === opening && held.current.workspaceId === workspaceId && held.current.nativeAccessCurrent(accessEpoch),
  }
  const source = await resources.read(entry.location, intent)
  if (source.location.ref !== entry.location.ref) throw new Error('The native reading belongs to another subject')
  held.current.publishSource(source, intent)
}

export interface CentralDocumentOpener {
  /** A Days row: its Day, in the focused pane. */
  openDay: (entry: DocumentEntry, path?: string) => Promise<void>
  /** A Files row: its Flow in the focused pane, or the file as its own tab. */
  openFile: (entry: DocumentEntry, path?: string) => Promise<void>
  /** A Beings or Things row: its page in a pane of its own, its hosted face (T-WORLDS W2). */
  openPage: (entry: DocumentEntry, kind: 'being' | 'thing') => Promise<void>
}

/** The opener over what is held: the workspace the file route reads through, and the book whose layout the pane opens in (absent
 * where no pane tree is mounted — the gesture then refuses by name). Each gesture takes the listed entry, and its path when
 * its location does not carry one, and rejects with the owner's words. */
export function centralDocumentOpener(held: {readonly workspace: {readonly current: WorkspaceReading}; readonly book: {readonly current: {setLayout: (update: (layout: LayoutState) => LayoutState) => void} | null}}): CentralDocumentOpener {
  const hold = (target: CentralDocumentTarget) => {
    const pane = held.book.current
    if (!pane) throw new Error('No pane tree is mounted to open the document in')
    pane.setLayout(layout => openCentralDocumentAt(layout, target))
  }
  return {
    openDay: async (entry, path) => {
      const day = dayOfEntry(entry, path)
      if (!day) throw new Error(`${entry.name} is not a day record, so there is no Day to open.`)
      hold(day)
    },
    openFile: async (entry, path) => {
      const flow = flowOfEntry(entry, path)
      if (flow) return hold(flow)
      return openGroundFile(held.workspace, entry)
    },
    openPage: async (entry, kind) => {
      if (entry.kind !== 'file' || !entry.location) throw new Error(`${entry.name} is no page file, so it does not open as a page.`)
      hold({form: 'page', kind, location: entry.location})
    },
  }
}

/** The browser's open gestures, over the workspace and book the shell holds. */
export function useCentralDocumentOpener(): CentralDocumentOpener {
  const workspace = useWorkspace()
  const book = useOptionalContinuity()
  const workspaceNow = useRef(workspace)
  workspaceNow.current = workspace
  const bookNow = useRef(book)
  bookNow.current = book
  return useMemo(() => centralDocumentOpener({workspace: workspaceNow, book: bookNow}), [])
}
