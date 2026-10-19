// Central's documents as panes (DLW §5: "documents open side by side … the day itself is one of the documents"; manual
// §10.2 panes, §10.3 "To open it, double-click it or drag it into a pane"; the mockup's `modes.base`: the Day on the
// left, a Flow on the right). A document is an OPENED thing, not an instrument the browser lists: it opens from the
// browser's material rows, into the pane that has focus, and holds its subject there.
//
// This module is the layout side, pure (no React, no owner read). Two documents stand in a pane of their own kind,
// `projection.central-document` (CentralDocumentPane.tsx), because their owners answer asynchronously and the pane says
// what the owner answered: the Day (the owner's `open-day` reading) and a Flow (the owner's file route). Every other
// file opens through the Workbench's own file route (useOpenCentralDocument.ts), unchanged.
//
// A pane's subject is its `projection.subject_ref`, one string:
//   `document:today`            the owner's current Day — re-read each time the pane mounts and when the window returns
//   `central:day:…:<date>`      the owner's Day of one civil date
//   `document:latest-flow`      the most recent Flow in Control/user/flows (the seed's right-hand pane)
//   `central:path:<root>:<path>` one Flow document, by the owner's path ref
//   `page:<being|thing>:<ref>`  one Being or Thing page, by its owner's path ref (T-WORLDS W2: they open as panes with a hosted
//                               face, like a Flow, never as a bare file tab)
// Nothing here reads the owner, so nothing here can fabricate a document: a subject that names none the owner holds is
// said by the pane, in the owner's words.
import {activateSurface, dropOnEdge, focusGroup, groupOf, moveTab, openBinding} from '../../../../../../desktop/cradle/src/surface/engine'
import type {LayoutState, PaneEdge, SurfaceBinding} from '../../../../../../desktop/cradle/src/surface/types'
import type {CentralLocation, NativeFileEntry} from '../../../../../../desktop/cradle/src/kernel/types'
import {USER_FLOWS_DIR} from '../../../../../../desktop/cradle/src/flow/instances'
import {openInstrumentAt} from '../../frame/openInstrument'
import {parseCentralPathRef} from '../centralVertical'
import {dateOfDayPath} from '../daySurface'

export const CENTRAL_DOCUMENT_PANE_KIND = 'projection.central-document'

/** The subject of the pane that holds the owner's current Day. */
export const TODAY_REF = 'document:today'
/** The subject of the pane that holds the most recent Flow. */
export const LATEST_FLOW_REF = 'document:latest-flow'

/** The root register's day ref for a civil date (`central:day:control:root:2026-10-08` — the shape the owner's own readings
 * carry). It is a request: the owner's `open-day` answers it or refuses it, in its own words. */
export function dayRefOfDate(date: string): string {
  return `central:day:control:root:${date}`
}

/** The civil date a day record's path names (`…/now/day/2026-10-08.md`). The same expression the browser's Files rows use to
 * tell a day record from a note (shell/ModeBrowser.tsx). */
export function dayDateOfPath(path: string): string | null {
  // The owner's `…/user/day/<date>/day.md` and a legacy record's `…/now/day/<date>.md` (central/daySurface.ts).
  return dateOfDayPath(path)
}

const FLOW_FILE = new RegExp(`(?:^|/)${USER_FLOWS_DIR}/[^/]+\\.html$`, 'i')
/** A Flow in a project world's own folder, its human ground (T-WORLDS W2: a world's pages are kept in its folder): named as every Flow
 * is minted (flow/instance.ts instanceFileName, `flow-<stamp>.html`), which tells it from the Goals, Visions, Mockups, Beings and
 * Things kept beside it. */
const WORLD_FLOW_FILE = /(?:^|\/)Work\/[^/]+\/ProjectCentral\/user\/(?:[^/]+\/)*flow-[^/]+\.html$/i

/** Whether a path is a Flow document: an instance in your world's flows folder, or a Flow in a project world's human ground. */
export function isFlowPath(path: string): boolean {
  return FLOW_FILE.test(path) || WORLD_FLOW_FILE.test(path)
}

/** What a pane's subject names. */
export type DocumentSubject =
  | {readonly form: 'day'; readonly dayRef: string | null}
  | {readonly form: 'flow'; readonly location: CentralLocation | null}
  | {readonly form: 'page'; readonly kind: PageKind; readonly location: CentralLocation}

/** A reference page's kind: a Being or a Thing (oi.page/v1, its family). */
export type PageKind = 'being' | 'thing'
const PAGE_SUBJECT = /^page:(being|thing):(.+)$/

/** Read a subject ref. A pane of this kind with no subject holds the most recent Flow. Null: the ref names no document this
 * pane holds (the pane says so; it never guesses another). */
export function parseDocumentSubject(ref: string | undefined): DocumentSubject | null {
  if (ref === undefined || ref === LATEST_FLOW_REF) return {form: 'flow', location: null}
  if (ref === TODAY_REF) return {form: 'day', dayRef: null}
  if (ref.startsWith('central:day:')) return {form: 'day', dayRef: ref}
  const page = PAGE_SUBJECT.exec(ref)
  if (page) {
    const at = parseCentralPathRef(page[2]!)
    return at ? {form: 'page', kind: page[1] as PageKind, location: {schema: 'central.path-ref/v1', ref: page[2]!, root: at.root, path: at.path}} : null
  }
  const located = parseCentralPathRef(ref)
  if (located && isFlowPath(located.path)) return {form: 'flow', location: {schema: 'central.path-ref/v1', ref, root: located.root, path: located.path}}
  return null
}

// ── what the browser's rows open ─────────────────────────────────────────

/** A document a pane of this kind holds. `date: null` is the owner's current Day; `location: null` the most recent Flow. */
export type CentralDocumentTarget =
  | {readonly form: 'day'; readonly date: string | null}
  | {readonly form: 'flow'; readonly location: CentralLocation | null}
  | {readonly form: 'page'; readonly kind: PageKind; readonly location: CentralLocation}

/** A listed row, as the browser holds it. */
export type DocumentEntry = Pick<NativeFileEntry, 'name' | 'location' | 'kind' | 'retrieval_allowed'>

/** The Day a Days row opens: the civil date its record's path names. `path` is the row's path when its location lacks one. Null
 * for a row that is not a day record. */
export function dayOfEntry(entry: DocumentEntry, path: string = entry.location?.path ?? entry.name): CentralDocumentTarget | null {
  const date = entry.kind === 'file' ? dayDateOfPath(path) : null
  return date ? {form: 'day', date} : null
}

/** The Flow a Files row opens: a Flow instance opens as its Flow, in a pane of this kind. Null for every other file — it opens
 * through the Workbench's file route, as its own tab, unchanged. */
export function flowOfEntry(entry: DocumentEntry, path: string = entry.location?.path ?? entry.name): CentralDocumentTarget | null {
  return entry.kind === 'file' && entry.location && isFlowPath(path) ? {form: 'flow', location: entry.location} : null
}

const baseName = (path: string): string => path.split('/').filter(Boolean).pop() ?? path

/** The ref and the tab's title a target is held under. */
export function subjectOf(target: CentralDocumentTarget): {ref: string; title: string} {
  if (target.form === 'day') return target.date ? {ref: dayRefOfDate(target.date), title: `Day · ${target.date}`} : {ref: TODAY_REF, title: 'Day'}
  if (target.form === 'page') return {ref: `page:${target.kind}:${target.location.ref}`, title: `${target.kind === 'being' ? 'Being' : 'Thing'} · ${baseName(target.location.path).replace(/\.html$/i, '')}`}
  return target.location ? {ref: target.location.ref, title: `Flow · ${baseName(target.location.path).replace(/\.html$/i, '')}`} : {ref: LATEST_FLOW_REF, title: 'Flow'}
}

/** The binding that holds a target: the one already open on that subject, else a new one. One document, one pane — opening
 * what is already open moves it where it was asked for rather than making a second. */
export function documentBinding(layout: LayoutState, target: CentralDocumentTarget): SurfaceBinding {
  const {ref, title} = subjectOf(target)
  const existing = Object.values(layout.surfaces).find(binding => binding.kind === CENTRAL_DOCUMENT_PANE_KIND && binding.projection?.subject_ref === ref)
  return existing ?? {id: crypto.randomUUID(), kind: CENTRAL_DOCUMENT_PANE_KIND, title, projection: {kind: CENTRAL_DOCUMENT_PANE_KIND, subject_ref: ref}}
}

/** Open a document in the layout: in the focused pane, in a named pane, or beside one (the instrument door's own placement,
 * frame/openInstrument.ts — a document opens exactly as an instrument does). */
export function openCentralDocumentAt(layout: LayoutState, target: CentralDocumentTarget, at?: {groupId: string; edge: PaneEdge | null}): LayoutState {
  const binding = documentBinding(layout, target)
  if (at?.edge) return dropOnEdge({...layout, surfaces: {...layout.surfaces, [binding.id]: layout.surfaces[binding.id] ?? binding}}, binding.id, at.groupId, at.edge)
  const placed = groupOf(layout, binding.id)
  if (at && placed && placed.id !== at.groupId) return moveTab(layout, binding.id, at.groupId)
  return openBinding(at ? focusGroup(layout, at.groupId) : layout, binding)
}

/** Bring a document's own pane forward: its tab in front in its group, and its group focused (the engine's own activation). The
 * pane is the one the document is held in (documentDoor.ts DocumentInPane.paneId); a Flow whose pane is gone opens again where the
 * focused pane is, as the browser opens one. A Day whose pane is gone is not re-opened: which Day it was is its pane's subject. */
export function revealDocumentPane(layout: LayoutState, paneId: string | undefined, flow?: CentralLocation | null): LayoutState {
  if (paneId && groupOf(layout, paneId)) return activateSurface(layout, paneId)
  return flow ? openCentralDocumentAt(layout, {form: 'flow', location: flow}) : layout
}

// ── Central's first tree ─────────────────────────────────────────────────

export interface CentralSeedOptions {
  /** Instrument kinds that open as tabs in the right-hand pane, behind the Flow — the panes Central's first tree held before
   * its documents stood in it (the Session · Arrangement pane). */
  readonly alongside?: readonly string[]
  /** What the right-hand pane opens instead of the most recent Flow: the subject the browser has selected. */
  readonly subject?: CentralDocumentTarget
}

/** Central's first tree (the mockup's `modes.base`: `[Day] | [Flow …]`, focus on the Day): today's Day in the left pane, the
 * most recent Flow (or the selected subject) in the right, the focus on the Day. Does nothing to a tree that already holds a
 * tab, so Central's own arrangement — and every named set — stands as it was left. */
export function seedCentralDocuments(layout: LayoutState, options: CentralSeedOptions = {}): LayoutState {
  if (Object.keys(layout.surfaces).some(id => groupOf(layout, id))) return layout
  const day = documentBinding(layout, {form: 'day', date: null})
  let next = openBinding(layout, day)
  const left = next.focusedGroupId
  const right = documentBinding(next, options.subject ?? {form: 'flow', location: null})
  if (left) next = dropOnEdge({...next, surfaces: {...next.surfaces, [right.id]: next.surfaces[right.id] ?? right}}, right.id, left, 'right')
  const stand = groupOf(next, right.id)?.id
  for (const kind of options.alongside ?? []) next = openInstrumentAt(next, kind, stand ? {groupId: stand, edge: null} : undefined)
  if (stand) next = activateSurface(next, right.id)
  return left ? focusGroup(next, left) : next
}
