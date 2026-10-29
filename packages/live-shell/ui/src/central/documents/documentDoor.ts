// The document a pane holds, as the browser's aperture reads it (world-shell-mockup.html: the Day pane's head reads its
// revision and save state; "Save HTML copy" and "Place on Central" stand in the browser's context panel under the focused
// document, never on the document's face). A Central document hosted in a pane publishes itself here when the hand reaches
// it — a press or focus anywhere in the pane, its hosted form included — and withdraws when it unmounts. The aperture reads
// the last one reached. No React state is held here: one value and its listeners.
import {createContext, useSyncExternalStore} from 'react'
import type {CentralLocation} from '../../../../../../desktop/cradle/src/kernel/types'
import {outcomeLabel, type SaveRouterReading} from '../../inhabitants/documentDeviceModel'
import type {PagePacketItem} from '../devices/pageReadings'

/** The pane binding a document face is hosted in (CentralDocumentPane provides it): the aperture matches the focused pane
 * by it, not by the form alone. */
export const DocumentPaneContext = createContext<string | null>(null)

export interface DocumentInPane {
  /** The pane's own key (one per mounted document face). */
  key: string
  /** The hosting pane's binding id, when the face stands in a pane. */
  paneId?: string
  form: 'Day' | 'Flow' | 'Being' | 'Thing'
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
  /** A Flow's owner location: the file the page family's devices read (central/devices/pageReadings.ts), the same the face reads. */
  location?: CentralLocation
  /** Whether the hosted form holds edits the owner does not (the face's own draft fact, `data-dirty`). */
  dirty?: boolean
  /** The last save's named outcome (the save router's five: saved, unchanged, stale, conflict, refused); absent before a save. */
  outcome?: SaveRouterReading['outcome']
  /** A Day's document, as the owner names it, when the face publishes it (the Day's devices read its document by it). */
  day?: {readonly project: string | null; readonly sourceRef: string; readonly documentId: string}
  /** A Day's open face as its form shows it now (0–5): the die turns in its pane before the owner holds the turn, at its next Save. */
  face?: number
  /** The page's own packet as its form holds it now (a Flow's island, `D.packet`, read by the face's bounded read): what To packet put
   * there, saved or not. The Packet device and the transport's count read it (walk 739 gap 14: the packet is the document's). */
  packet?: readonly PagePacketItem[]
}

/** A Day held open in a pane: the face its form shows and the turn that reaches it (the form's own turn, through the face's bridge). */
export interface DayInPane {
  readonly face: number | null
  readonly turn: (face: number) => void
}

const openDays = new Map<string, Map<string, DayInPane>>()
const dayListeners = new Set<() => void>()
let daysVersion = 0
const daysMoved = () => { daysVersion++; for (const listener of dayListeners) listener() }

/** A Day face stands in a pane (or turns there): it can be turned there. Returns its withdrawal. */
export function holdDayInPane(documentId: string, key: string, day: DayInPane): () => void {
  const held = openDays.get(documentId) ?? new Map<string, DayInPane>()
  held.set(key, day)
  openDays.set(documentId, held)
  daysMoved()
  return () => {
    const now = openDays.get(documentId)
    if (now?.get(key) !== day) return
    now.delete(key)
    if (!now.size) openDays.delete(documentId)
    daysMoved()
  }
}

/** The Day a pane holds open, by the owner's document id: the one the hand last reached when it stands in more than one pane. Null
 * when no pane holds it — a turn then goes to the owner (central/devices/centralDeviceWrites.ts turnDieFace). */
export function dayInPane(documentId: string): DayInPane | null {
  const held = openDays.get(documentId)
  if (!held?.size) return null
  return (reached?.day?.documentId === documentId ? held.get(reached.key) : undefined) ?? [...held.values()].pop() ?? null
}

const subscribeDays = (listener: () => void) => { dayListeners.add(listener); return () => { dayListeners.delete(listener) } }
const daysNow = () => daysVersion

/** The Day a pane holds open, as a reading that follows it: the face its form shows, as it turns. Null when no pane holds it. */
export function useDayInPane(documentId: string | null): DayInPane | null {
  useSyncExternalStore(subscribeDays, daysNow, daysNow)
  return documentId ? dayInPane(documentId) : null
}

/** Turn a Day to `face` where it is seen: in the pane that holds it open (its form turns, and the owner holds the turn with the Day's
 * next Save, so the pane's basis never moves under its draft), else through the owner's own write route (`owner`, the die's
 * mutate-field — centralDeviceWrites.ts turnDieFace). Resolves with where the turn went. */
export async function turnDay(documentId: string, face: number, owner: () => Promise<unknown>): Promise<'pane' | 'owner'> {
  const held = dayInPane(documentId)
  if (held) { held.turn(face); return 'pane' }
  await owner()
  return 'owner'
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

/** The book's layout writer, registered by the shell that holds the book (App.tsx): a document pane renders in a root of its own, so it
 * reaches the pane tree only through this — a link a page follows opens beside it here. Null where no book is mounted. */
type LayoutWriter = (update: (layout: import('../../../../../../desktop/cradle/src/surface/types').LayoutState) => import('../../../../../../desktop/cradle/src/surface/types').LayoutState) => void
let layoutWriter: LayoutWriter | null = null
export function registerDocumentLayoutWriter(writer: LayoutWriter | null): () => void {
  layoutWriter = writer
  return () => { if (layoutWriter === writer) layoutWriter = null }
}
export function documentLayoutWriter(): LayoutWriter | null { return layoutWriter }
