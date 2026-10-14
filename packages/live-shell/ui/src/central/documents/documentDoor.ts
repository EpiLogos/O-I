// The document a pane holds, as the browser's aperture reads it (world-shell-mockup.html: the Day pane's head reads its
// revision and save state; "Save HTML copy" and "Place on Central" stand in the browser's context panel under the focused
// document, never on the document's face). A Central document hosted in a pane publishes itself here when the hand reaches
// it — a press or focus anywhere in the pane, its hosted form included — and withdraws when it unmounts. The aperture reads
// the last one reached. No React state is held here: one value and its listeners.
import {createContext, useSyncExternalStore} from 'react'
import {outcomeLabel, type SaveRouterReading} from '../../inhabitants/documentDeviceModel'

/** The pane binding a document face is hosted in (CentralDocumentPane provides it): the aperture matches the focused pane
 * by it, not by the form alone. */
export const DocumentPaneContext = createContext<string | null>(null)

export interface DocumentInPane {
  /** The pane's own key (one per mounted document face). */
  key: string
  /** The hosting pane's binding id, when the face stands in a pane. */
  paneId?: string
  form: 'Day' | 'Flow'
  title: string
  /** The owner's revision of the bytes the face stands on, when read. */
  revision?: string
  /** The save standing in words: saved, edited since save, waiting for the owner, the owner's refusal, or no save yet. */
  state: string
  /** Save through the owner's revision-checked write; absent while the owner path is not open (still reading, blocked). */
  save?: () => void
  /** Re-read the document from its owner. */
  reread?: () => void
  /** The re-read's own name in this form (the Day reviews its native source; the Flow re-reads). */
  rereadLabel?: string
}

let reached: DocumentInPane | null = null
const listeners = new Set<() => void>()
const emit = () => { for (const listener of listeners) listener() }

/** A document face in a pane: it was reached, or its standing changed while it is the one reached. */
export function publishDocument(document: DocumentInPane, reachedNow = false): void {
  if (!reachedNow && reached?.key !== document.key) return
  reached = document
  emit()
}

/** The face unmounts: if it was the one reached, nothing is. */
export function withdrawDocument(key: string): void {
  if (reached?.key !== key) return
  reached = null
  emit()
}

export function reachedDocument(): DocumentInPane | null { return reached }

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The document pane the hand last reached, or null. */
export function useReachedDocument(): DocumentInPane | null {
  return useSyncExternalStore(subscribe, reachedDocument, reachedDocument)
}

/** The save standing in a few words, for the pane's head and the aperture (the mockup's "r7 · edited since save"). */
export function documentStateWords({pending, dirty, save, blocked}: {pending: boolean; dirty: boolean; save?: SaveRouterReading; blocked?: string}): string {
  if (pending) return 'waiting for the owner'
  if (blocked) return `blocked — ${blocked}`
  if (dirty) return 'edited since save'
  return outcomeLabel(save) ?? 'as read'
}

/** A revision as the head shows it (the mockup's `r7`): the owner's content digest, short — the CAS form
 * `central.content-fnv1a64/v1:<length>:<digest>` reads as its digest's first eight, never the scheme's prefix. */
export function revisionShort(revision: string): string {
  const digest = revision.includes(':') ? revision.slice(revision.lastIndexOf(':') + 1) : revision
  return digest.slice(0, 8)
}
