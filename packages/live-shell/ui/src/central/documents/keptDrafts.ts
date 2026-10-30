// The draft a Central document's pane held when it closed (O-I #741, lane AG). DLW §2: "A draft you are writing stays in your hands
// until its owner acknowledges the save." §16.7: a set keeps no content, and "what it could not keep, such as a draft never saved, it
// names as it opens." The manual names no confirm on closing a pane (VS Code asks Save / Don't Save / Cancel; Obsidian, the manual's
// source for saving, keeps the page and asks nothing), so a pane never asks and never drops: the draft is kept on this device and the
// document brings it back, named, when it opens again, until its owner acknowledges a save of it or the person sets it aside (Re-read,
// Review). No owner keeps an unsaved draft, so this is no copy of anything an owner keeps (§16.1 "The shell keeps no copy of what an
// owner keeps").
//
// How it is kept: each document face (DocumentFlowFace, DocumentPageFace, DocumentDayDieFace) keeps its draft here whenever its
// standing poll reads one, and once more before its pane closes — the workbench checkpoints every pane's documents before any close,
// split or move (native/Workbench.tsx `checkpointDocuments`), the same door the cradle's own surfaces keep their working copies through
// (desktop/cradle/src/document/frame.ts registerDocumentCheckpoint). A store that does not acknowledge the draft refuses the close,
// in words, so a draft is never lost without a word. One record per document per form, in this window's WebStorage.
import {useEffect, useRef} from 'react'
import {registerDocumentCheckpoint} from '../../../../../../desktop/cradle/src/document/frame'
import {revisionShort} from './documentDoor'

export const KEPT_DRAFT_SCHEMA = 'oi.central.kept-draft/v1'

export type KeptForm = 'Day' | 'Flow' | 'Being' | 'Thing'

/** One kept draft: what the form held, the owner's revision it was written against, and when it was kept. `draft` is the form's own
 * text (a Flow's or a page's island; a Day's snapshot, as JSON, with the basis it was staged on). */
export interface KeptDraft {
  readonly schema: typeof KEPT_DRAFT_SCHEMA
  readonly form: KeptForm
  /** The document, as its owner names it: a Flow's or a page's location ref, a Day's source ref and document id. */
  readonly ref: string
  /** The owner's revision the draft was written against. */
  readonly basis: string
  readonly draft: string
  readonly title: string
  /** When it was kept, in ms. */
  readonly at: number
}

export const keptDraftKey = (form: KeptForm, ref: string): string => `oi-central.kept-draft.v1:${form}:${ref}`

const storage = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

/** The draft kept for a document, or null. Something else in its slot is no draft. */
export function keptDraftOf(form: KeptForm, ref: string): KeptDraft | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(keptDraftKey(form, ref))
    if (raw === null) return null
    const value = JSON.parse(raw) as Partial<KeptDraft> | null
    if (value?.schema !== KEPT_DRAFT_SCHEMA || value.form !== form || value.ref !== ref || typeof value.basis !== 'string'
      || typeof value.draft !== 'string' || typeof value.at !== 'number') return null
    return {schema: KEPT_DRAFT_SCHEMA, form, ref, basis: value.basis, draft: value.draft, title: typeof value.title === 'string' ? value.title : '', at: value.at}
  } catch { return null }
}

/** Keep a document's draft on this device, replacing what was kept for it. Throws, in words, when this device does not keep it: the
 * caller (a pane closing) then refuses to go on, so the draft stays where it is. */
export function keepDraft(draft: {readonly form: KeptForm; readonly ref: string; readonly basis: string; readonly draft: string; readonly title: string}): KeptDraft {
  const record: KeptDraft = {schema: KEPT_DRAFT_SCHEMA, form: draft.form, ref: draft.ref, basis: draft.basis, draft: draft.draft, title: draft.title, at: Date.now()}
  const encoded = JSON.stringify(record)
  const store = storage()
  let held: string | null = null
  try {
    store?.setItem(keptDraftKey(draft.form, draft.ref), encoded)
    held = store?.getItem(keptDraftKey(draft.form, draft.ref)) ?? null
  } catch { held = null }
  if (held !== encoded) throw new Error(keptDraftRefusal(draft.form, draft.title))
  return record
}

/** What a pane says when this device could not keep its draft: the pane stays open, and how to close it. */
export function keptDraftRefusal(form: KeptForm, title?: string): string {
  return `This device did not keep the draft of ${title || `this ${form}`}, so its pane stays open. Save the draft, or set it aside, then close the pane.`
}

/** Let a kept draft go: its owner acknowledged a save of it, or the person set it aside. Named `draft`: only that draft goes, so an edit
 * kept while a save was in flight stays. */
export function releaseKeptDraft(form: KeptForm, ref: string, draft?: string): void {
  const store = storage()
  if (!store) return
  try {
    if (draft !== undefined && keptDraftOf(form, ref)?.draft !== draft) return
    store.removeItem(keptDraftKey(form, ref))
  } catch { /* nothing kept there to let go */ }
}

/** Whether the document moved on from the revision the kept draft was written against. */
export const keptDraftMoved = (kept: KeptDraft, revision: string): boolean => kept.basis !== revision

/** When a draft was kept, in a few words. */
function keptWhen(at: number, now = Date.now()): string {
  const minutes = Math.round((now - at) / 60_000)
  if (minutes < 1) return 'moments ago'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(at).toLocaleString('en-GB', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})
}

/** What the page says as it opens over a kept draft: that it is back, from when, what Save and the set-aside do — and, when the owner
 * moved on since, that Save will not write over the newer page (§17.8: a stale save keeps the draft and shows what changed). */
export function keptDraftNotice(kept: KeptDraft, revision: string, setAside: string | null = 'Re-read'): string {
  const back = `Your unsaved draft of this ${kept.form}, kept on this device when its pane closed (${keptWhen(kept.at)}), is back in the page.`
  if (!keptDraftMoved(kept, revision)) return `${back} Save writes it${setAside ? `; ${setAside} sets it aside` : ''}.`
  return `${back} The ${kept.form} moved since: the draft stands on r${revisionShort(kept.basis)}, the ${kept.form} is now r${revisionShort(revision)}. Save will not write over it${setAside ? `; ${setAside} sets the draft aside` : ''}.`
}

/** A face keeps its draft under its pane before the pane closes: `keep` reads the form and keeps what it holds (or lets go of what it
 * no longer holds), and throws, in words, when it cannot — the workbench then leaves the pane open. Registered while the face stands in
 * a pane (`paneId`, its binding id); the latest `keep` is the one asked. */
export function useDraftKeeping(paneId: string | undefined, keep: () => Promise<void>): void {
  const latest = useRef(keep)
  latest.current = keep
  useEffect(() => (paneId ? registerDocumentCheckpoint(paneId, () => latest.current()) : undefined), [paneId])
}
