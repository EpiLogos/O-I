// Which panes hold a document draft, as the pane's tab shows it (DLW §18.1: "A clip shows its state … Draft, Saved or Edited since
// save"; §17.8: "The save state shows next to the page"). After VS Code's workbench, whose tab of an editor with unsaved changes carries
// a dot (O-I campaign-evidence/2026-10-29-vscode-workbench-re/DECODE.md). A Central document hosted in a pane (a Day, a Flow, a Being, a
// Thing) publishes its standing through the document door (documentDoor.ts publishDocument) whether or not the hand has reached it; the
// door notes its draft fact here, and the Workbench marks the tab of each pane that holds one (desktop/cradle/src/surface/Workbench.tsx
// `draftOf`). The fact is the face's own (its `dirty`, read from its form against the owner's revision): nothing here reads an owner or
// keeps a copy of a document. No React state: one map and its listeners.
import {useCallback, useSyncExternalStore} from 'react'

/** One face's draft fact: the pane it stands in, and whether its form holds edits its owner does not. */
interface Held {readonly paneId: string; readonly dirty: boolean}

const faces = new Map<string, Held>()
const listeners = new Set<() => void>()
let version = 0
const moved = () => { version++; for (const listener of listeners) listener() }

/** A face's standing, as the document door hears it. A face outside any pane (a device card) marks no tab; a republish of the same fact
 * is no change. */
export function notePaneDraft(face: {readonly key: string; readonly paneId?: string; readonly dirty?: boolean}): void {
  const was = faces.get(face.key)
  if (!face.paneId) {
    if (was) { faces.delete(face.key); moved() }
    return
  }
  const dirty = face.dirty === true
  if (was && was.paneId === face.paneId && was.dirty === dirty) return
  faces.set(face.key, {paneId: face.paneId, dirty})
  moved()
}

/** The face leaves (its pane closed, its body unmounted): its draft fact goes with it. */
export function releasePaneDraft(key: string): void {
  if (faces.delete(key)) moved()
}

/** Whether a pane's binding holds a document with a draft. */
export function paneHoldsDraft(paneId: string | undefined): boolean {
  if (!paneId) return false
  for (const held of faces.values()) if (held.paneId === paneId && held.dirty) return true
  return false
}

export function subscribePaneDrafts(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const versionNow = () => version

/** The draft fact of every pane, as a reading that follows it: the Workbench re-renders its tabs when a draft starts or ends. */
export function usePaneDrafts(): (paneId: string) => boolean {
  const now = useSyncExternalStore(subscribePaneDrafts, versionNow, versionNow)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a new reader per moved version, so the panes see the move
  return useCallback((paneId: string) => paneHoldsDraft(paneId), [now])
}
