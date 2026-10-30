// Autosave for Central's documents (DLW §17.8 Document: "Autosave | On · Off | On | Saves a short time after you stop", "Turns saving as
// you go on or off", in the Save group; the transport's Metronome "Saves as you go" and Quantize "Sets when a save lands", which Central's
// transport names Autosave and Save timing — shell/modeGrammar.ts). After VS Code's workbench, the manual's source for Central's editor
// side (O-I campaign-evidence/2026-10-29-vscode-workbench-re/DECODE.md "Saving"; read again in the 1.141 bundle for this lane):
//   - `files.autoSave` off · afterDelay · onFocusChange · onWindowChange, `files.autoSaveDelay` default 1000 ms. Here the manual's
//     Autosave On · Off is the first, and Save timing the other three: After a pause (the default), On leaving the page, On leaving the
//     window; onFocusChange saves on a change of window too;
//   - EditorAutoSave.scheduleAutoSave: every change discards the scheduled save and schedules it again; when the delay passes with no
//     further change the document is saved, if it is still dirty;
//   - "ignoring auto save request for … working copy that is in conflict or error": an auto save never runs while the document is in
//     conflict or error; a save by hand or a revert ends that. Here the face stands held, with the reason, until Save or Re-read.
// The save is the face's own Save through Central — its head's Save, ⌘S (useSaveKey.ts) — so autosave opens no write path of its own, and
// each face's stale and conflict laws stand as they are. The face learns of an edit from its page (desktop/cradle/src/context/
// document-edit.js, which every hosted document frame carries), never by a poll. The setting is this device's, as VS Code's is the
// user's: kept in the window's storage, read back, and On where nothing is kept. Pure apart from that store; no React.
import type {SaveRouterOutcome} from '../../inhabitants/manifest'
import {outcomeLabel, type SaveRouterReading} from '../../inhabitants/documentDeviceModel'

/** VS Code's `files.autoSaveDelay` default: the pause after the last edit before the save. */
export const AUTOSAVE_DELAY_MS = 1000

/** When a save lands (the transport's Save timing): a pause after the last edit (VS Code's afterDelay), leaving the page
 * (onFocusChange), or leaving the window (onWindowChange). */
export type SaveTiming = 'pause' | 'page' | 'window'
export interface AutosaveSetting {readonly on: boolean; readonly timing: SaveTiming}
export const AUTOSAVE_DEFAULT: AutosaveSetting = {on: true, timing: 'pause'}
const TIMINGS: readonly SaveTiming[] = ['pause', 'page', 'window']

/** Where this device keeps the setting. */
export const AUTOSAVE_KEY = 'oi-central.autosave.v1'

let setting: AutosaveSetting | null = null
const listeners = new Set<() => void>()
const emit = () => { for (const listener of [...listeners]) listener() }

function store(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

/** The setting as this device keeps it; On, after a pause, where nothing (or nothing readable) is kept. */
export function autosaveSetting(): AutosaveSetting {
  if (setting) return setting
  let read = AUTOSAVE_DEFAULT
  try {
    const raw = store()?.getItem(AUTOSAVE_KEY)
    const value = raw ? JSON.parse(raw) as {on?: unknown; timing?: unknown} : null
    if (value) read = {on: typeof value.on === 'boolean' ? value.on : true, timing: TIMINGS.includes(value.timing as SaveTiming) ? value.timing as SaveTiming : 'pause'}
  } catch { read = AUTOSAVE_DEFAULT }
  setting = read
  return read
}

/** A store that keeps nothing (blocked or full) still turns the setting for this window. */
function put(next: AutosaveSetting): void {
  setting = next
  try { store()?.setItem(AUTOSAVE_KEY, JSON.stringify(next)) } catch { /* this window keeps it */ }
  emit()
}

export const setAutosave = (on: boolean): void => put({...autosaveSetting(), on})
export const setSaveTiming = (timing: SaveTiming): void => put({...autosaveSetting(), timing})
/** The next Save timing, round: as the transport's Quantize steps. */
export const nextSaveTiming = (timing: SaveTiming): SaveTiming => TIMINGS[(TIMINGS.indexOf(timing) + 1) % TIMINGS.length]!
/** Read the setting again from the store (another window turned it; the tests). */
export function forgetAutosaveSetting(): void { setting = null; emit() }

export function subscribeAutosave(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
// Another window of this device turned it: read it again.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', event => { if ((event as StorageEvent).key === AUTOSAVE_KEY) forgetAutosaveSetting() })
}

/** Save timing in words: the transport slot's face, and the line that says it. */
export function saveTimingWords(timing: SaveTiming): {readonly face: string; readonly words: string} {
  if (timing === 'page') return {face: 'page', words: 'when you leave the page'}
  if (timing === 'window') return {face: 'window', words: 'when you leave the window'}
  return {face: '1 s', words: 'a second after you stop'}
}

// ---------------------------------------------------------------------------------------------------------------- when a save lands

/** The moments a save can land at: the pause after the last edit, the page losing the focus, the window losing it. */
export type SaveMoment = 'pause' | 'leave' | 'window'

/** Whether a save lands at this moment, under the setting (VS Code's getAutoSaveMode: afterDelay on the delay only, onFocusChange on a
 * change of focus or of window, onWindowChange on a change of window). */
export function savesAt(moment: SaveMoment, at: AutosaveSetting): boolean {
  if (!at.on) return false
  if (moment === 'pause') return at.timing === 'pause'
  if (moment === 'leave') return at.timing === 'page'
  return at.timing === 'page' || at.timing === 'window'
}

/** What the page tells its host (document-edit.js). */
export const DOCUMENT_EDIT_MESSAGE = 'oi:document-edit'
export type PageGesture = 'input' | 'press' | 'leave'
const GESTURES: readonly PageGesture[] = ['input', 'press', 'leave']

/** The gesture a page's message names, or null for any other message. */
export function pageGesture(data: unknown): PageGesture | null {
  const message = data as {type?: unknown; gesture?: unknown} | null | undefined
  if (message?.type !== DOCUMENT_EDIT_MESSAGE) return null
  return GESTURES.includes(message.gesture as PageGesture) ? message.gesture as PageGesture : null
}

// ---------------------------------------------------------------------------------------------------------------- held

const HOLDING: readonly SaveRouterOutcome[] = ['stale', 'conflict', 'refused']

/** Why autosave holds a face, or undefined: a Day blocked under Review, or a last save the router named stale, conflict or refused (VS
 * Code's conflict and error). A save by hand that the owner takes, or a Re-read, ends it. */
export function autosaveHeldOf(save: SaveRouterReading | undefined, blocked?: string): string | undefined {
  if (blocked) return blocked
  if (save && HOLDING.includes(save.outcome)) return outcomeLabel(save) ?? save.outcome
  return undefined
}

// ---------------------------------------------------------------------------------------------------------------- the glyph

export type GlyphState = 'saved' | 'saving' | 'held'
export interface AutosaveGlyph {readonly state: GlyphState; readonly words: string}

/** The small glyph: saved, saving or held (§17.4), and the line that says why. Saving covers a save in flight and an edit that will be
 * saved when it lands (VS Code shows an editor with a short auto save delay as saving, not dirty); held, an edit autosave will not save. */
export function autosaveGlyph(input: {readonly on: boolean; readonly timing: SaveTiming; readonly dirty: boolean; readonly typing: boolean; readonly pending: boolean
  readonly held?: string}): AutosaveGlyph {
  if (input.pending) return {state: 'saving', words: 'Saving through Central.'}
  if (input.held) return {state: 'held', words: `Held, not saved: ${input.held}`}
  if (!input.dirty && !input.typing) return {state: 'saved', words: 'Saved: Central holds what the page shows.'}
  if (!input.on) return {state: 'held', words: 'Held, not saved: Autosave is off. Press Save to save it.'}
  return {state: 'saving', words: `Saving ${saveTimingWords(input.timing).words}.`}
}

// ---------------------------------------------------------------------------------------------------------------- the controller

/** A face as autosave sees it, read afresh at each moment. */
export interface AutosaveFace {
  /** Read the page (the bounded island read, or the form's own draft fact): true when it holds a draft. The face marks and keeps it. */
  settle(): Promise<boolean> | boolean
  /** The face's own Save through Central; absent while it cannot run (the page still reading, a Day blocked). */
  readonly save: (() => Promise<void> | void) | undefined
  /** A save in flight. */
  readonly pending: boolean
  /** Why autosave holds (autosaveHeldOf). */
  readonly held?: string
}

export interface AutosaveTimer {set(run: () => void, ms: number): unknown; clear(handle: unknown): void}
const REAL_TIMER: AutosaveTimer = {set: (run, ms) => setTimeout(run, ms), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>)}

export interface AutosaveControl {
  /** A gesture the page told its host. */
  gesture(kind: PageGesture): void
  /** The window lost the focus (or was hidden). */
  windowLeft(): void
  /** The face's save in flight was answered: a moment that came due meanwhile runs now. */
  settled(): void
  /** Stop: nothing scheduled runs. */
  cancel(): void
}

/** The pause and the moments, over a face (`face` reads it now). At the pause the face reads its page — so its draft fact follows the
 * edit, not a poll — and saves through its own Save when the setting lands a save there, the face holds no draft, nothing holds it and no
 * save is in flight; a moment that comes due during a save in flight runs when it is answered. `typing` hears an input before its pause. */
export function createAutosave(options: {face: () => AutosaveFace; setting: () => AutosaveSetting; timer?: AutosaveTimer; delay?: number; typing?: (on: boolean) => void}): AutosaveControl {
  const timer = options.timer ?? REAL_TIMER
  const delay = options.delay ?? AUTOSAVE_DELAY_MS
  let handle: unknown = null
  /** Inputs heard: typing ends at a pause only if none came while its read and save were answered. */
  let inputs = 0
  let running = false
  let due: SaveMoment | null = null
  let stopped = false

  const run = async (moment: SaveMoment): Promise<void> => {
    if (stopped) return
    if (running || options.face().pending) { due = due === 'pause' || !due ? moment : due; return }
    running = true
    try {
      const draft = await options.face().settle()
      const now = options.face()
      if (!draft || now.held || !now.save || !savesAt(moment, options.setting())) return
      if (now.pending) { due = moment; return }
      await now.save()
    } catch {
      // The face names its own outcome; a read that did not answer is no draft.
    } finally {
      running = false
      if (due && !options.face().pending) { const next = due; due = null; void run(next) }
    }
  }
  const pause = () => {
    if (handle !== null) timer.clear(handle)
    handle = timer.set(() => {
      handle = null
      const seen = inputs
      // The edit stands as being saved until the pause's read and save are answered, never "saved" between them.
      void run('pause').then(() => { if (inputs === seen) options.typing?.(false) })
    }, delay)
  }
  return {
    gesture(kind) {
      if (stopped) return
      if (kind === 'leave') { void run('leave'); return }
      if (kind === 'input') { inputs++; options.typing?.(true) }
      pause()
    },
    windowLeft() { void run('window') },
    settled() { if (due && !running && !options.face().pending) { const next = due; due = null; void run(next) } },
    cancel() { stopped = true; if (handle !== null) timer.clear(handle); handle = null; due = null },
  }
}
