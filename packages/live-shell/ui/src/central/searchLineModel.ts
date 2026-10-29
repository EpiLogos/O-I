// The search line's reading of what was typed and of what the owners answered (DLW §18.4; O-I #820) — pure. The line itself is
// central/searchLine.tsx; its door is central/searchLineDoor.ts.
//
// Ported, not recreated:
//   - the language is the Search design's own grammar (inhabitants/catalogue/panels/central__search.tsx marksOf, a port of aikit-core
//     resource/operative.rs lex), and the groups its results come in are that design's table (SEARCH_GROUPS, searchGroupOf);
//   - the results are the Search pane's binding's (central/devices/searchBinding.ts searchValues → `results`): the owner's hits with
//     the address the owner gave and AIKit's own use count (ranking.destination: observations, frecency);
//   - the line's states follow VS Code's Quick Open as the manual cites it: plain words are a jump to what you open most, `>` is the
//     Command Palette's prefix for acts (§18.4 "The line anywhere"). No decode of VS Code's workbench is kept in this repository
//     (campaign-evidence/ and docs/ hold none): the behaviour ported is the manual's, and the cradle's own Quick-Open-like palette
//     (desktop/cradle/src/knowledge/SearchOverlay.tsx: the query line, ↑↓, Enter, Esc, the typed Actions tab of the app's verbs);
//   - the acts are the menu bar's (frame/menu/commandDoor.ts MENU_COMMANDS, routed by App.tsx's `oi:command` handler), each with the key
//     the host's menu binds (desktop/cradle/src-tauri/src/menus.rs:58-83, MENU_ACCELERATORS below, held equal to it by
//     tests/e820-search-line.test.mjs).
import type {CentralLocation, KnowledgeAddress} from '../../../../../desktop/cradle/src/kernel/types'
import type {FlowInstanceRow} from '../../../../../desktop/cradle/src/flow/flowsDir'
import {textToHtml} from '../../../../../desktop/cradle/src/flow/instance'
import {MENU_COMMANDS, OBJECT_ACT_OF, type MenuCommand} from '../frame/menu/commandDoor'
import {marksOf, searchGroupOf, SEARCH_GROUPS, type SearchGroup} from '../inhabitants/catalogue/panels/central__search'
import {isFlowPath} from './documents/centralDocuments'
import type {LinePassage} from './searchLineDoor'

/** What the line is doing with what was typed: `>` offers acts; nothing offers what you opened; plain words jump; a mark searches. */
export type LineMode = 'acts' | 'opened' | 'jump' | 'search'

export function lineModeOf(text: string): LineMode {
  const typed = text.trim()
  if (typed.startsWith('>')) return 'acts'
  if (!typed) return 'opened'
  return marksOf(typed).length ? 'search' : 'jump'
}

/** One result as the line holds it: the Search binding's row, the group its kind is shown in, the owner's address and use count. */
export interface LineResult {
  readonly ref: string
  readonly title: string
  readonly kind: string
  readonly group: SearchGroup
  readonly says?: string
  readonly owner?: string
  readonly address?: KnowledgeAddress
  /** How many opens the owner counted. */
  readonly used?: number
  /** The owner's frecency: how often and how lately, together. */
  readonly frecency?: number
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined)
const addressOf = (raw: unknown): KnowledgeAddress | undefined => {
  if (typeof raw !== 'string') return undefined
  try {
    const parsed = JSON.parse(raw) as {kind?: unknown; value?: unknown}
    return typeof parsed?.kind === 'string' && typeof parsed.value === 'string' ? parsed as KnowledgeAddress : undefined
  } catch { return undefined }
}

/** The Search binding's `results` (a JSON string) as the line's results, in the owner's order. Pure. */
export function lineResultsOf(results: string | undefined): LineResult[] {
  if (typeof results !== 'string') return []
  let raw: unknown
  try { raw = JSON.parse(results) } catch { return [] }
  if (!Array.isArray(raw)) return []
  return raw.flatMap((row): LineResult[] => {
    const o = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
    const ref = text(o.ref)
    if (!ref) return []
    const kind = typeof o.kind === 'string' ? o.kind : ''
    const address = addressOf(o.address)
    return [{ref, title: text(o.title) ?? ref, kind, group: searchGroupOf(kind), ...(text(o.says) ? {says: text(o.says)} : {}), ...(text(o.owner) ? {owner: text(o.owner)} : {}),
      ...(address ? {address} : {}), ...(typeof o.used === 'number' ? {used: o.used} : {}), ...(typeof o.frecency === 'number' ? {frecency: o.frecency} : {})}]
  })
}

/** The jump: what you open most first — the owner's frecency, highest first — and the rest after it, each in the owner's order. The shell
 * ranks nothing of its own: a result the owner gave no count keeps its place. Pure. */
export function jumpOrder<T extends {readonly frecency?: number}>(results: readonly T[]): T[] {
  const counted = results.map((result, index) => ({result, index})).filter(entry => (entry.result.frecency ?? 0) > 0)
  counted.sort((a, b) => (b.result.frecency! - a.result.frecency!) || a.index - b.index)
  const first = new Set(counted.map(entry => entry.result))
  return [...counted.map(entry => entry.result), ...results.filter(result => !first.has(result))]
}

/** A search's results in groups by kind, in the design's order; a kind turned off (Search's `k:<kind>`, the same settings) is left out. */
export function groupsOf(results: readonly LineResult[], kindOn: (group: SearchGroup) => boolean): {group: SearchGroup; name: string; results: LineResult[]}[] {
  return SEARCH_GROUPS.filter(group => kindOn(group.id)).flatMap(group => {
    const held = results.filter(result => result.group === group.id)
    return held.length ? [{group: group.id, name: group.name, results: held}] : []
  })
}

// ---------------------------------------------------------------------------------------------------------------------
// Enter: open, or send the passage through the target's owner

/** What Enter does with the result chosen: send the passage (and through which owner), open the result, or nothing — dimmed, with the
 * operation the send waits for. `words` is the line that shows what is sent, to whom, and its size (§18.4 Rules: "A tag always shows
 * what it sends, and its size, before it goes"). */
export type SendPlan =
  | {readonly verb: 'send'; readonly target: 'flow' | 'agent'; readonly words: string}
  | {readonly verb: 'open'; readonly words: string}
  | {readonly verb: 'dim'; readonly why: string}

/** An agent's standing session in the agency reading (the session a send prompts). */
export interface AgentSessionFact {readonly sessionRef: string; readonly project: string; readonly name: string; readonly space?: string}

/** What the line knows of the result chosen: the Flow the owner lists for it, the agent's session; undefined is not asked yet. */
export interface SendFacts {
  readonly flow?: CentralLocation | null
  readonly agent?: AgentSessionFact | null
}

const size = (passage: LinePassage) => `${passage.text.length} character${passage.text.length === 1 ? '' : 's'}`
const missing = (op: string, owner: string) => `No owner operation carries it yet — missing op: ${op} (${owner}).`

/** §18.4 What a tag sends, kind by kind. Pure. */
export function sendPlanOf(result: LineResult, passage: LinePassage | null | undefined, facts: SendFacts): SendPlan {
  if (!passage?.text) return {verb: 'open', words: `Enter opens ${result.title}.`}
  switch (result.group) {
    case 'passage': case 'power': case 'vak':
      return {verb: 'open', words: `Enter opens ${result.title}: a tag does not send to it.`}
    case 'person':
      return {verb: 'dim', why: `${result.title} is a person: a message carrying the passage and where it came from has no owner here. ${missing('a message to a person, with the passage and its source', 'Shared field')}`}
    case 'place':
      return {verb: 'dim', why: `${result.title} is a place: filing the passage on it, with a link back to the page, has no owner here. ${missing('a passage filed on a place of your world', 'Central')}`}
    case 'agent':
      if (facts.agent === undefined) return {verb: 'dim', why: `Reading whether ${result.title} has a session in the agency reading…`}
      if (!facts.agent) return {verb: 'dim', why: `${result.title} has no session in the agency reading to start on the passage; a conversation is opened from the Agent widget (encounter_provision).`}
      return {verb: 'send', target: 'agent', words: `Starts ${facts.agent.name} on ${size(passage)} from ${passage.from}.`}
    default:
      if (facts.flow === undefined && result.group === 'document' && pathOf(result) && isFlowPath(pathOf(result)!)) return {verb: 'dim', why: `Reading the owner's Flows for ${result.title}…`}
      if (facts.flow) return {verb: 'send', target: 'flow', words: `Adds ${size(passage)} from ${passage.from} to ${result.title} as a new entry, with the page it came from.`}
      return {verb: 'dim', why: `${result.title} is not a Flow the owner lists: another document takes the passage as a quote at the end, and that has no owner here. ${missing('a quote appended to a document, with a link back', 'Central')}`}
  }
}

/** The path a result names in your world's Control, when it names one: AIKit's source ref for Control (`central:source:control:root:<path>`)
 * or Central's match in Control (`<path>:<line>`, owner Control). Pure. */
export function pathOf(result: Pick<LineResult, 'ref' | 'owner'>): string | null {
  const source = /^central:source:control:root:(.+)$/.exec(result.ref)
  if (source) return source[1]!
  if (result.owner === 'Control') return result.ref.replace(/:\d+$/, '')
  return null
}

/** The Flow a result names, as the owner's Flow listing gives it (flow/flowsDir.ts listFlowInstances): matched by its path, never made. */
export function flowOf(result: Pick<LineResult, 'ref' | 'owner'>, listing: readonly FlowInstanceRow[]): CentralLocation | null {
  const path = pathOf(result)
  if (!path || !isFlowPath(path)) return null
  return listing.find(row => row.location.path === path)?.location ?? null
}

/** The entry a Flow takes: the passage, and where it came from (the page's path, the link back). */
export function flowEntryText(passage: LinePassage): string {
  return `${passage.text}\n\n— from ${passage.from}${passage.path ? ` (${passage.path})` : ''}`
}

/** HTML's five-character escape, as the Flow's own entry writer escapes words (desktop/cradle/src/flow/instance.ts:77 escapeHtml). */
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c] as string)

/** The entry a Flow takes, as the page draws it: the passage in paragraphs (flow/instance.ts textToHtml, the words an entry is made of
 * without html), then where it came from — a link to that page when it came from one, which the page follows as a page of a world
 * (ql-flow.html `oi:page-link`; inhabitants/DocumentPageFace.tsx linkTarget). Pure. */
export function flowEntryHtml(passage: LinePassage): string {
  const from = passage.path ? `<a href="${escapeHtml(passage.path)}">${escapeHtml(passage.from)}</a>` : escapeHtml(passage.from)
  return `${textToHtml(passage.text)}<p>— from ${from}</p>`
}

/** The turn an agent is started on: the passage, and where it came from. */
export const agentTurnText = flowEntryText

// ---------------------------------------------------------------------------------------------------------------------
// > : the menu bar's acts

/** The key the host's menu binds to each of its items (desktop/cradle/src-tauri/src/menus.rs:23, 58-83), verbatim. */
export const MENU_ACCELERATORS: Readonly<Record<MenuCommand, string | null>> = {
  'edit.undo': 'CmdOrCtrl+Z', 'edit.redo': 'CmdOrCtrl+Shift+Z', 'edit.duplicate': 'CmdOrCtrl+D', 'edit.delete': null, 'edit.rename': 'CmdOrCtrl+R',
  'create.clip': 'CmdOrCtrl+Shift+M', 'create.row': 'CmdOrCtrl+I',
  'view.session': null, 'view.arrangement': null, 'view.pane': 'Alt+CmdOrCtrl+9', 'view.browser': 'Alt+CmdOrCtrl+B', 'view.pool': 'Alt+CmdOrCtrl+6',
  'view.rail': 'Alt+CmdOrCtrl+8', 'view.clip': 'Alt+CmdOrCtrl+3', 'view.device': 'Alt+CmdOrCtrl+4', 'view.detail': 'Alt+CmdOrCtrl+L',
  'view.expand-clip': 'Alt+CmdOrCtrl+E', 'view.mixer': 'Alt+CmdOrCtrl+M', 'view.io': 'Alt+CmdOrCtrl+I', 'app.settings': 'CmdOrCtrl+,',
  'view.present': null, 'view.grid': null, 'view.snap': null, 'view.guides': null, 'view.flat': null, 'view.depth': null, 'view.face-plane': null,
  'file.export.picture': null, 'file.export.film': null, 'file.export.json': null, 'file.export.html': null, 'file.export.native': null,
}

/** An accelerator as the Mac's menus write it: ⌃⌥⇧⌘ then the key. Pure. */
export function keyGlyphs(accelerator: string | null | undefined): string {
  if (!accelerator) return ''
  const parts = accelerator.split('+')
  const key = parts.pop() ?? ''
  const has = (name: string) => parts.some(part => part.toLowerCase() === name)
  return `${has('ctrl') ? '⌃' : ''}${has('alt') || has('option') ? '⌥' : ''}${has('shift') ? '⇧' : ''}${has('cmdorctrl') || has('cmd') || has('command') ? '⌘' : ''}${key.length === 1 ? key.toUpperCase() : key}`
}

/** One act the line offers: the menu bar's item, its key, and the object act it runs on the selection when it is an Edit or Create item. */
export interface LineAct {readonly id: MenuCommand; readonly label: string; readonly key: string; readonly object?: string}

/** `>` and words: the menu bar's acts whose names match, in the menu's order, each with its key. Pure. */
export function actsOf(typed: string): LineAct[] {
  const words = typed.trim().replace(/^>/, '').trim().toLowerCase()
  return (Object.keys(MENU_COMMANDS) as MenuCommand[]).flatMap(id => {
    const label = MENU_COMMANDS[id]
    if (words && !label.toLowerCase().includes(words)) return []
    const object = OBJECT_ACT_OF[id]
    return [{id, label, key: keyGlyphs(MENU_ACCELERATORS[id]), ...(object ? {object} : {})}]
  })
}
