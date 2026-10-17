// The window's keys, pure half (FOUNDATION F9; manual §10.8). One map from a key to an intent, and the one rule that keeps a
// key from acting where its press already means something else. No React, no DOM global, no store: a key event and an
// element are read through the small shapes below, so the whole map can be tested without a browser.
//
// What is here is what §10.8 gives to the window as a whole: Space (play or stop), Esc (stop), ⌘F (search), a row's
// number key (launch the row), a macro's letter key (turn the macro), Enter and ⌥Enter (open the selected thing in a pane,
// or beside it). What §10.8 gives to the shell already stays there: Tab (Session ⇄ Arrangement) and ⌘⌥B / ⌘⌥L (the
// browser and the detail area) are App.tsx's, and "Send what you typed" / "Steer the running turn" belong to the field being
// typed in, which this layer never touches — the map returns nothing for any of them.
import type {SdkParamRow} from '../../inhabitants/sdk/define'
import type {DeviceInstance, ParamValue} from '../devices/deviceRuntime'

/** What a key asks for. Rows and macros are counted from 0. */
export type KeyIntent =
  | {id: 'play-stop'}
  | {id: 'stop'}
  | {id: 'search'}
  | {id: 'row'; row: number}
  | {id: 'macro'; macro: number; direction: 1 | -1}
  | {id: 'open'; beside: boolean}

/** The part of a keyboard event the map reads (a real KeyboardEvent satisfies it). */
export interface KeyLike {
  key: string
  code?: string
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  repeat?: boolean
  isComposing?: boolean
}

/** Row keys: the number row, left to right. The tenth row is 0. */
export const ROW_KEYS = '1234567890'
/** Macro keys: a device's four rack macros, in the order its compact face draws them. These four letters are not one of the
 * Jankó keyboard's twelve (a w s e d f t g y h u j), so a macro key never shadows a note. Shift turns the macro back. */
export const MACRO_KEYS: readonly string[] = ['z', 'x', 'c', 'v']

/** The key that launches row `index`, or undefined past the tenth. */
export const rowKeyOf = (index: number): string | undefined => ROW_KEYS[index]
/** The key that turns macro `index`, or undefined past the fourth. */
export const macroKeyOf = (index: number): string | undefined => MACRO_KEYS[index]

const digitOf = (e: KeyLike): number | null => {
  const coded = /^(?:Digit|Numpad)(\d)$/.exec(e.code ?? '')
  if (coded) return Number(coded[1])
  return /^\d$/.test(e.key) ? Number(e.key) : null
}

/** Whether a press is a key of the window. Null for everything the window leaves to others (and for a held key or an IME
 * composition, which never act). Pure. */
export function intentOfKey(e: KeyLike): KeyIntent | null {
  if (e.repeat || e.isComposing) return null
  const chord = !!(e.metaKey || e.ctrlKey)
  if (chord) return !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f' ? {id: 'search'} : null
  if (e.key === 'Enter') return e.shiftKey ? null : {id: 'open', beside: !!e.altKey}
  if (e.altKey) return null
  if (e.key === 'Escape') return e.shiftKey ? null : {id: 'stop'}
  if (e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space') return e.shiftKey ? null : {id: 'play-stop'}
  const digit = digitOf(e)
  if (digit !== null) return e.shiftKey ? null : {id: 'row', row: (digit + 9) % 10}
  const macro = MACRO_KEYS.indexOf(e.key.toLowerCase())
  if (macro >= 0) return {id: 'macro', macro, direction: e.shiftKey ? -1 : 1}
  return null
}

/** ⌘F has a browser default of its own (find in page), so it is claimed at once and the default is stopped. Every other key waits
 * one task for the established handlers to have their say (see FrameKeys): Space included — the page does not scroll (the body
 * is overflow: hidden), and the Expressions bar's own Space handler may be the one that already played. */
export const claimsAtOnce = (intent: KeyIntent): boolean => intent.id === 'search'

// ---------------------------------------------------------------------------------------------------------------------
// Where a key does not act

/** The part of an element the rule reads (a real Element satisfies it). */
export interface ElementLike {
  tagName?: string
  isContentEditable?: boolean
  parentElement?: ElementLike | null
  getAttribute?(name: string): string | null
}

const attr = (el: ElementLike, name: string): string | null => el.getAttribute?.(name) ?? null
const tokens = (value: string | null): string[] => (value ?? '').toLowerCase().split(/\s+/).filter(Boolean)
const ancestry = (target: ElementLike | null): ElementLike[] => {
  const out: ElementLike[] = []
  for (let el = target, depth = 0; el && depth < 64; el = el.parentElement ?? null, depth++) out.push(el)
  return out
}

/** Text is being typed: an input, a textarea, a select, an editable region, or an element that says it is a text box. */
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
const TYPING_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton'])
/** Elements that handle their own keys, by what they declare: the application role (the Jankó keyboard is one), a dialog or a
 * menu or a listbox, a slider. A grid is not here: the Session grid is a grid, and the row keys act inside it. */
const OWN_KEY_ROLES = new Set(['application', 'dialog', 'alertdialog', 'menu', 'menubar', 'listbox', 'slider'])
/** Elements a Space or an Enter already presses. */
const PRESSED_ROLES = new Set(['button', 'link', 'checkbox', 'switch', 'radio', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'treeitem'])

export function isTyping(target: ElementLike | null): boolean {
  return ancestry(target).some(el => {
    if (TYPING_TAGS.has((el.tagName ?? '').toUpperCase()) || el.isContentEditable === true) return true
    const editable = attr(el, 'contenteditable')
    if (editable !== null && editable !== 'false') return true
    return TYPING_ROLES.has((attr(el, 'role') ?? '').toLowerCase())
  })
}

/** The words a `data-takes-keys` value uses for each intent. Empty or `all` declares every key. */
const TOKEN: Record<KeyIntent['id'], string> = {'play-stop': 'space', stop: 'escape', search: 'find', row: 'digits', macro: 'letters', open: 'enter'}

/** An element declares that it takes keys: `data-takes-keys` (every key, or the listed ones: space escape find digits letters
 * enter), a role that handles its own keys, or a modal. */
export function declaresKeys(intent: KeyIntent, target: ElementLike | null): boolean {
  return ancestry(target).some(el => {
    const declared = attr(el, 'data-takes-keys')
    if (declared !== null) {
      const words = tokens(declared)
      if (words.length === 0 || words.includes('all') || words.includes(TOKEN[intent.id])) return true
    }
    return OWN_KEY_ROLES.has((attr(el, 'role') ?? '').toLowerCase()) || attr(el, 'aria-modal') === 'true'
  })
}

/** The control in focus is one a Space or an Enter presses: it keeps the key (a browser row previews on Space; a button
 * clicks), and the window does not press a second thing with it. */
export function pressedByKey(target: ElementLike | null): boolean {
  return ancestry(target).some(el => {
    const tag = (el.tagName ?? '').toUpperCase()
    if (tag === 'BUTTON' || tag === 'SUMMARY' || (tag === 'A' && attr(el, 'href') !== null)) return true
    return PRESSED_ROLES.has((attr(el, 'role') ?? '').toLowerCase())
  })
}

/** Keys never act while you are typing, never act inside something that takes its own keys, and Space and Enter never press a
 * second thing on a control they already press (manual §10.8: "Keys never play notes while you are typing in a document"). */
export function suppressed(intent: KeyIntent, target: ElementLike | null): boolean {
  if (isTyping(target) || declaresKeys(intent, target)) return true
  return (intent.id === 'play-stop' || intent.id === 'open') && pressedByKey(target)
}

/** The part of a document the Escape check reads. */
export interface DocumentLike {
  querySelectorAll(selector: string): ArrayLike<ElementLike>
}

const hiddenFromView = (el: ElementLike): boolean =>
  ancestry(el).some(held => attr(held, 'hidden') !== null || attr(held, 'aria-hidden') === 'true' || attr(held, 'inert') !== null)

/** Escape belongs first to whatever is open that Escape closes: a modal, an open `<dialog>`, a menu, or anything that declares
 * `data-claims-keys="escape"` while its own state is live (a mode Escape leaves, a gesture Escape cancels). While one is on
 * screen the window's Escape (Stop) stands down. */
export function escapeClaimed(doc: DocumentLike): boolean {
  const found = doc.querySelectorAll('[aria-modal="true"], dialog[open], [role="menu"], [data-claims-keys]')
  for (let i = 0; i < found.length; i++) {
    const el = found[i]!
    if (hiddenFromView(el)) continue
    const claims = attr(el, 'data-claims-keys')
    if (claims === null) return true
    const words = tokens(claims)
    if (words.length === 0 || words.includes('all') || words.includes('escape')) return true
  }
  return false
}

// ---------------------------------------------------------------------------------------------------------------------
// Turning a macro

/** What a macro key does to the macro in front of it, and why it does nothing when it does not. */
export type MacroTurn =
  | {ok: true; key: string; value: ParamValue}
  | {ok: false; reason: 'no-write' | 'no-reading' | 'at-limit' | 'no-choices'}

/** Turn a rack macro one detent, as its own control does: a number moves by a fiftieth of its range and stays inside it, a
 * choice moves to the next of the owner's choices (and wraps, as its click does), a switch flips. The control is disabled
 * without a write, without a write path, or while the owner discloses no reading — so is the key. */
export function macroTurn(device: Pick<DeviceInstance, 'values' | 'submit'>, row: SdkParamRow, direction: 1 | -1): MacroTurn {
  if (!device.submit || !row.writePath) return {ok: false, reason: 'no-write'}
  const current = device.values[row.key]
  if (current === undefined) return {ok: false, reason: 'no-reading'}
  if (row.type === 'boolean') return typeof current === 'boolean' ? {ok: true, key: row.key, value: !current} : {ok: false, reason: 'no-reading'}
  if (row.type === 'enumerated') {
    const choices = row.values ?? []
    if (!choices.length) return {ok: false, reason: 'no-choices'}
    const at = choices.indexOf(String(current))
    const next = direction === 1 ? (at + 1) % choices.length : at <= 0 ? choices.length - 1 : at - 1
    return {ok: true, key: row.key, value: choices[next]!}
  }
  if ((row.type === 'number' || row.type === 'duration') && typeof current === 'number') {
    const min = row.range?.min ?? 0
    const max = row.range?.max ?? 1
    const next = Math.min(max, Math.max(min, current + direction * (((max - min) || 1) / 50)))
    return next === current ? {ok: false, reason: 'at-limit'} : {ok: true, key: row.key, value: next}
  }
  return {ok: false, reason: 'no-write'}
}
