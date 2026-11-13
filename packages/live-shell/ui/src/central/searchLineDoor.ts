// The search line's door (DLW §18.4 "The line anywhere"; O-I #820): ⌘K opens the line over anything, the transport, a chain or a pane,
// as VS Code's Quick Open does, and @ opens the same line in a document — a Flow entry, the agent's composer. "It is one line, with the
// same language, the same settings and the same results; where it opens only decides where a result goes. Esc closes it and you are
// where you were."
//
// This module is what the first frame carries of the line: who asked for it (its door), where it opens (the caret), the passage selected
// when it was asked (the one a tag sends), and how to put the caret and the selection back. The line itself — its search, its results,
// its sends — is central/searchLine.tsx, loaded when it first opens (SearchLineHost.tsx; tests/first-load-budget.test.mjs LOADS_LATER).
// The frame's keys reach it as they reach the browser's search (frame/keys/keyDoors.ts): through a host that registers here.
//
// Ported, not recreated: putting the focus, the caret and the selection back on close is the cradle's search overlay's own
// (desktop/cradle/src/knowledge/SearchOverlay.tsx:206-226); an @ word is the pane's reading of a composer's words (atQueryOf, moved
// here from central/searchPane.tsx so the first frame can read it without the pane). No React, no store: a reference to the request.
//
// In a Flow entry and the agent's composer (§5: "`@` in a Flow entry or in an agent's composer … puts the chosen reference in place";
// the owner's ruling on #820, round 862) the door says where a choice goes (`insert`): a reference to what it names, put where the @ was
// typed, which opens what it names through the owner that opens it from the line. The line itself (⌘K) keeps Enter's open (§18.4).
import type {KnowledgeAddress} from '../../../../../desktop/cradle/src/kernel/types'
import {KNOWLEDGE_OPEN} from '../panels/knowledgeDoor'

/** Where the line was asked from: the frame (⌘K), a Flow's entry, or a composer (@). */
export type LineDoor = 'frame' | 'flow' | 'composer'

/** The passage selected when the line was asked for: its words, where it came from in words, and the page it came from (the link back). */
export interface LinePassage {
  readonly text: string
  readonly from: string
  /** The page of a world it came from (a Flow's path), when it came from one. */
  readonly path?: string
}

export interface LineRequest {
  readonly door: LineDoor
  /** Where the line opens: the caret, in the window's coordinates. None: over the frame, as Quick Open stands. */
  readonly at?: {readonly x: number; readonly y: number} | null
  readonly passage?: LinePassage | null
  /** Puts the focus, the caret and the selection back where they were. */
  readonly restore?: (() => void) | null
  /** Where a choice goes in a Flow entry or a composer (§5): the reference put where the @ was typed. None: the line opens what is chosen. */
  readonly insert?: ((reference: LineReference) => void) | null
  /** The words the line opens with (the browser's "Search the whole field": what was typed in its search row). None: it opens empty. */
  readonly query?: string
}

/** A reference to what a result names: its words, and the address that opens it (a page of a world by its path; `oi:knowledge:` AIKit's
 * address of a source or the wiki; `oi:vak:` the search a Vāk entry was found by). */
export interface LineReference {
  readonly title: string
  readonly href: string
}

/** What an owner answered to the line, said once the line has closed (an open the owner refused, a send's receipt). */
export interface LineReceipt {
  readonly ok: boolean
  readonly what: string
  readonly text: string
}

let request: LineRequest | null = null
let receipt: LineReceipt | null = null
let version = 0
const listeners = new Set<() => void>()
const emit = () => { version++; for (const listener of [...listeners]) listener() }

/** Open the line. False when it already stands: it is one line. */
export function openSearchLine(next: LineRequest): boolean {
  if (request) return false
  request = next
  receipt = null
  emit()
  return true
}

/** Close the line. Esc puts you back where you were (`restore`, the default); a click elsewhere leaves the focus where it put it. */
export function closeSearchLine(options: {restore?: boolean} = {}): void {
  const was = request
  if (!was) return
  request = null
  emit()
  if (options.restore !== false) {
    try { was.restore?.() } catch { /* the place it came from has gone: there is nothing to put back */ }
  }
}

export const searchLineNow = (): LineRequest | null => request
export const searchLineVersion = (): number => version
export function subscribeSearchLine(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Say an owner's answer once the line has closed; the host shows it until it is dismissed or the line opens again. */
export function showLineReceipt(next: LineReceipt | null): void { receipt = next; emit() }
export const lineReceipt = (): LineReceipt | null => receipt

// ---- the host: the frame's ⌘K reaches the line only while one is mounted

let hosts = 0
/** The line's host (SearchLineHost.tsx) registers while it is mounted; the returned function withdraws it. */
export function registerSearchLineHost(): () => void {
  hosts++
  let left = false
  return () => { if (!left) { left = true; hosts-- } }
}
export const searchLineAvailable = (): boolean => hosts > 0

// ---- the menu bar's commands: the frame publishes how it runs one (App.tsx, the `oi:command` route), so `>` runs the same act

let menuRunner: ((id: string) => void) | null = null
/** The frame publishes its menu bar's router (null when it leaves). */
export function publishMenuCommands(run: ((id: string) => void) | null): void { menuRunner = run }
export const menuCommands = (): ((id: string) => void) | null => menuRunner

// ---- the @ in a composer

/** The search a composer's words name: from the last word that starts with @ to the end of the line (`@ariadne`, `@1 founding positions`),
 * or null when the word being typed names none — an @ inside a word (an address) is no search. Pure. */
export function atQueryOf(text: string): string | null {
  const match = /(?:^|\s)(@[^@\n]*)$/.exec(text)
  return match ? match[1]! : null
}

/** Whether an @ typed after `before` opens the line: at the start of the field or after a space. An @ inside a word is an address. */
export const atOpens = (before: string): boolean => before === '' || /\s$/.test(before)

/** The part of a keyboard event the @ reads (a real KeyboardEvent satisfies it). */
export interface AtKeyLike {
  key: string
  isComposing?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
}
/** The part of a text field the @ reads (a real textarea or input satisfies it). */
export interface AtFieldLike {
  value: string
  selectionStart: number | null
  selectionEnd: number | null
  getAttribute(name: string): string | null
}

/** What an @ pressed in a composer does: nothing (null) unless the field declares `data-at-search` and the @ starts a word or a passage
 * is selected. With a passage selected the @ is held (`hold`: the selection is not replaced) and the passage goes with the request;
 * with none the @ stays as typed. Pure. */
export function atKeyOf(event: AtKeyLike, field: AtFieldLike, from = 'the agent\'s composer'): {hold: boolean; request: LineRequest} | null {
  if (event.key !== '@' || event.isComposing || event.metaKey || event.ctrlKey) return null
  const door = field.getAttribute('data-at-search')
  if (door === null) return null
  const start = field.selectionStart ?? field.value.length, end = field.selectionEnd ?? start
  const selected = field.value.slice(Math.min(start, end), Math.max(start, end))
  if (selected.trim()) return {hold: true, request: {door: 'composer', passage: {text: selected, from}}}
  return atOpens(field.value.slice(0, start)) ? {hold: false, request: {door: 'composer', passage: null}} : null
}

// ---- a reference put in place, and opened

/** What a reference's address names, as the owner that opens it reads it: AIKit's knowledge address (the Graph and source receiver, in
 * the world it was found in), or a Vāk search (Search's own pane, the entry among its neighbours). A page of a world and an http(s)
 * address are the page link route's (inhabitants/DocumentPageFace.tsx linkTarget). */
export type ReferenceTarget =
  | {readonly kind: 'knowledge'; readonly address: KnowledgeAddress; readonly project?: string}
  | {readonly kind: 'vak'; readonly query: string}

const KNOWLEDGE_KINDS: readonly string[] = ['wiki', 'source', 'project-map']
const decoded = (text: string): string | null => { try { return decodeURIComponent(text) } catch { return null } }

/** The owner a reference's address names, or null when it names none here. Pure. */
export function referenceTargetOf(href: unknown): ReferenceTarget | null {
  if (typeof href !== 'string') return null
  const knowledge = /^oi:knowledge:([a-z-]+):([^?]+)(?:\?project=(.+))?$/.exec(href)
  if (knowledge) {
    const value = decoded(knowledge[2]!), project = knowledge[3] === undefined ? undefined : decoded(knowledge[3])
    if (!KNOWLEDGE_KINDS.includes(knowledge[1]!) || !value || project === null || project === '') return null
    return {kind: 'knowledge', address: {kind: knowledge[1] as KnowledgeAddress['kind'], value}, ...(project ? {project} : {})}
  }
  const vak = /^oi:vak:(.+)$/.exec(href)
  if (!vak) return null
  const query = decoded(vak[1]!)
  return query ? {kind: 'vak', query} : null
}

/** A reference as text, in a composer: the link form the kernel writes into a Markdown page (kernel page.rs append_quote), the words'
 * brackets escaped and the address's spaces and parentheses encoded. Pure. */
export function referenceText(reference: LineReference): string {
  const words = reference.title.replace(/[[\]\\]/g, c => `\\${c}`)
  const href = reference.href.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')
  return `[${words}](${href})`
}

/** The part of a text field a reference is put into (a real textarea or input satisfies it). */
export interface InsertFieldLike {
  value: string
  focus(options?: FocusOptions): void
  setRangeText(text: string, start: number, end: number, mode?: SelectionMode): void
  dispatchEvent(event: Event): boolean
}

/** Where a choice goes in a composer: the reference, as text, in place of the @ typed before the caret (`at`, where the caret stood when
 * the line opened; at the caret when the @ has gone), a space after it unless one follows, the caret after it. The field hears it as
 * typing (an `input` event), so the composer's own draft takes it as it takes what is typed. */
export function fieldInsert(field: InsertFieldLike, at: number): (reference: LineReference) => void {
  return reference => {
    const caret = Math.min(Math.max(0, at), field.value.length)
    const start = caret > 0 && field.value[caret - 1] === '@' ? caret - 1 : caret
    const next = field.value[caret]
    const text = `${referenceText(reference)}${next === undefined || !/\s/.test(next) ? ' ' : ''}`
    field.focus({preventScroll: true})
    field.setRangeText(text, start, caret, 'end')
    field.dispatchEvent(new Event('input', {bubbles: true}))
  }
}

/** How long the Graph and source receiver has to acknowledge an open before its opener says it did not. */
const OPEN_DEADLINE_MS = 10_000

/** Open AIKit's address of a source or the wiki through the Graph and source receiver, as the Workbench does (native/Workbench.tsx:332-343):
 * a wiki address as its graph, a source as its page; resolves when the receiver acknowledges, rejects with its refusal. */
export function openKnowledgeAddress(title: string, address: KnowledgeAddress, project: string | undefined): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false
    const complete = (reason?: string) => { if (settled) return; settled = true; window.clearTimeout(deadline); if (reason) reject(new Error(reason)); else resolve() }
    const deadline = window.setTimeout(() => complete('The Graph and source receiver (panels/knowledge.tsx) did not acknowledge this open.'), OPEN_DEADLINE_MS)
    window.dispatchEvent(new CustomEvent(KNOWLEDGE_OPEN, {detail: {title, ...(project ? {project} : {}), address,
      plane: address.kind === 'wiki' ? 'graph' : 'page', complete}}))
  })
}

/** Open what a reference names through its owner: AIKit's address through the Graph and source receiver; a Vāk entry in Search's own pane
 * on the search that found it. */
export function openReference(target: ReferenceTarget, title: string): Promise<void> {
  if (target.kind === 'knowledge') return openKnowledgeAddress(title, target.address, target.project)
  return import('./searchPane').then(module => module.openSearchPane(target.query))
}

// ---- Esc: you are where you were

/** Take what has the focus now, its caret and the selection, and return how to put them back. Port of the cradle's search overlay
 * (desktop/cradle/src/knowledge/SearchOverlay.tsx:206-226): a text field gets its caret again, anything else its selection ranges. */
export function captureFocus(doc: Document = document): () => void {
  const previous = (doc.activeElement ?? null) as HTMLElement | null
  const field = typeof HTMLTextAreaElement !== 'undefined' && (previous instanceof HTMLTextAreaElement || previous instanceof HTMLInputElement) ? previous : null
  const caret = field && field.selectionStart !== null ? {start: field.selectionStart, end: field.selectionEnd ?? field.selectionStart, direction: field.selectionDirection} : null
  const selection = doc.getSelection?.()
  const ranges = selection ? Array.from({length: selection.rangeCount}, (_, i) => selection.getRangeAt(i).cloneRange()) : []
  return () => {
    if (!previous?.isConnected) return
    previous.focus({preventScroll: true})
    if (field && caret) field.setSelectionRange(caret.start, caret.end, caret.direction ?? undefined)
    else if (ranges.length) {
      const current = doc.getSelection?.()
      current?.removeAllRanges()
      for (const range of ranges) if (range.startContainer.isConnected) current?.addRange(range)
    }
  }
}
