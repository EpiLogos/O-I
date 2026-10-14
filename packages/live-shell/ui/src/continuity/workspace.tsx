import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {useWorkspaces, type Workspace} from '../../../../../desktop/cradle/src/workspace/store'
import {warmWorkspaceTrees} from '../../../../../desktop/cradle/src/surface/warmTrees'
import {tauriInvoke} from '../../../../../desktop/cradle/src/kernel/bridge'
import {candidateApplicationEnvelope, readCandidateApplicationView} from './applicationView'
import {admissionReport, applyPendingAdmission, type AdmissionOutcome, type PendingAdmission} from './admission'
import {nativeHost} from '../native/application'

export const CANDIDATE_WORKSPACE_KEY = 'oi.live-shell.candidate.workspace.v2'
export const CANDIDATE_LEGACY_LAYOUT_KEY = 'oi.live-shell.candidate.layout.v1'
/** The shell's mode cut (WORLD-SHELL-DESIGN Rev 5's rack): Live (the audio
 * presentation) · Base·Central · Factory · Expressions · Technē, with
 * Settings the terminal system entry. Each stands on its own book mode, so
 * each keeps its own panes, detail side and browser (FOUNDATION F1): Live
 * is the book's `live`, Central its `base`. A mode switch is an encounter
 * transition over the spine, never a fork of it. */
export type ShellMode = 'audio' | 'base' | 'factory' | 'expressions' | 'techne' | 'settings'
export type CandidateWorkspace = ReturnType<typeof useCandidateWorkspace>

/** The shell modes by the book mode each stands on (a table, never a branch). */
const SHELL_MODE_OF_BOOK: Readonly<Record<string, ShellMode>> = {live: 'audio', base: 'base', factory: 'factory', expressions: 'expressions', techne: 'techne', settings: 'settings'}
export const BOOK_MODE_OF_SHELL: Readonly<Record<ShellMode, 'live' | 'base' | 'factory' | 'expressions' | 'techne' | 'settings'>> = {audio: 'live', base: 'base', factory: 'factory', expressions: 'expressions', techne: 'techne', settings: 'settings'}

/** One imported v2 book; owner documents, source buffers and recovery addresses remain native. */
export function useCandidateWorkspace() {
  const book = useWorkspaces({storageKey: CANDIDATE_WORKSPACE_KEY, legacyLayoutKey: CANDIDATE_LEGACY_LAYOUT_KEY})
  const storedMode = book.current.layout.mode ?? 'base'
  // A book saved before Live had its own mode stood in Live as `base` without the Central world: that tree is renamed
  // Live's, once, and Central opens on its own default the first time it is entered.
  const standsInOldLive = storedMode === 'base' && book.current.context?.world !== 'central' && !book.current.modeLayouts?.live
  useEffect(() => { if (standsInOldLive) book.setLayout(layout => ({...layout, mode: 'live'})) }, [standsInOldLive, book.current.id])
  const mode: ShellMode = standsInOldLive ? 'audio' : SHELL_MODE_OF_BOOK[storedMode] ?? 'base'
  const setMode = (next: ShellMode) => book.switchMode(BOOK_MODE_OF_SHELL[next])
  const warmTrees = warmWorkspaceTrees(book.workspaces, book.current.id, storedMode)
  const applicationView = useMemo(() => readCandidateApplicationView(book.current.layout.applicationView), [book.current.layout.applicationView])
  const currentBook = useRef(book)
  currentBook.current = book
  // Acceptance queues presentation state. Durability is the native book's
  // separate flushCheckpoint after React has published the queued update.
  const checkpointApplicationView = useCallback((snapshot: unknown): boolean => {
    const envelope = candidateApplicationEnvelope(snapshot)
    if (!envelope) return false
    const identical = (stored: unknown) => JSON.stringify(candidateApplicationEnvelope(readCandidateApplicationView(stored))) === JSON.stringify(envelope)
    if (identical(currentBook.current.current.layout.applicationView)) return true
    currentBook.current.setLayout(layout => identical(layout.applicationView) ? layout : {...layout, applicationView: envelope})
    return true
  }, [])
  return {...book, mode, setMode, warmTrees, applicationView, checkpointApplicationView}
}
const Continuity = createContext<CandidateWorkspace | null>(null)

const ADMISSION_READ_BOUND_MS = 15000
function withinReadBound<T>(read: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const bound = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`no answer within ${ADMISSION_READ_BOUND_MS / 1000} s`)), ADMISSION_READ_BOUND_MS) })
  return Promise.race([read, bound]).finally(() => clearTimeout(timer))
}

/** One apply per page load. React StrictMode runs effects twice, and two applies must never race. */
let admissionRun: Promise<AdmissionOutcome> | null = null
function runAdmissionOnce(): Promise<AdmissionOutcome> {
  admissionRun ??= Promise.resolve()
    .then(() => applyPendingAdmission({
      store: localStorage,
      namespace: CANDIDATE_WORKSPACE_KEY,
      // A read that never answers must not hold the start: past the bound it is a failed read, which writes nothing.
      read: () => withinReadBound(tauriInvoke<PendingAdmission>('live_shell_continuity_pending', {})),
      confirm: confirmation => tauriInvoke<void>('live_shell_continuity_confirm', {...confirmation}),
    }))
    .catch((error: unknown): AdmissionOutcome => ({status: 'failed', admission: '', written: 0, reason: `The owner-admitted continuity could not start (${error instanceof Error ? error.message : String(error)}); nothing was applied, and the next start tries again.`}))
  return admissionRun
}

const holdStyle = {margin: 0, padding: '12px 16px', font: '13px system-ui, sans-serif'} as const
const noticeStyle = {position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10000, margin: 0, padding: '8px 16px', font: '13px system-ui, sans-serif', background: 'Canvas', color: 'CanvasText', borderTop: '1px solid GrayText'} as const

/**
 * The startup gate. The owner-admitted continuity is applied before the workspace book is
 * read, because useWorkspaces reads it while rendering. A held (failed) apply mounts nothing,
 * so no write can overwrite a partial apply. A refusal or an applied outcome mounts the
 * workspace and states its result once in a dismissible status line. The development
 * browser and detached views have no native admission to apply, so they mount at once.
 */
export function ContinuityProvider({children}: {children: ReactNode}) {
  const gated = nativeHost() && !window.__OI_DETACHED__
  const [outcome, setOutcome] = useState<AdmissionOutcome | null>(gated ? null : {status: 'none'})
  const [dismissed, setDismissed] = useState(false)
  // The owner's way out of a held apply: start on the candidate's own data, leaving the admission pending (unconfirmed),
  // so the next start re-verifies it and retries.
  const [startWithout, setStartWithout] = useState(false)
  useEffect(() => {
    if (outcome) return
    let live = true
    void runAdmissionOnce().then(next => { if (live) setOutcome(next) })
    return () => { live = false }
  }, [outcome])
  if (!outcome) return <p role="status" data-region="continuity-admission" style={holdStyle}>Reading the owner-admitted continuity…</p>
  // Hold only after a partial write: a read failure or a stop before any admitted write leaves the namespace as it was.
  if (outcome.status === 'failed' && outcome.written > 0 && !startWithout) {
    return <div role="alert" data-region="continuity-admission" data-admission="failed" style={holdStyle}>
      <p style={{margin: '0 0 8px'}}>{outcome.reason}</p>
      <p style={{margin: '0 0 8px'}}>The workspace is held so nothing overwrites the half-applied records. Quitting and reopening retries the apply. Starting without it opens the candidate on the records now in place; once the candidate writes its own workspace, this admission can no longer apply as made, and applying it later needs a fresh admission with --owner-replace.</p>
      <button type="button" data-action="start-without-admission" onClick={() => setStartWithout(true)}>Start without the admitted continuity</button>
    </div>
  }
  const report = dismissed ? null : admissionReport(outcome)
  return (
    <>
      {report && <p role="status" data-region="continuity-admission" style={noticeStyle}>{report} <button type="button" onClick={() => setDismissed(true)}>Dismiss</button></p>}
      <ContinuityBook>{children}</ContinuityBook>
    </>
  )
}
function ContinuityBook({children}: {children: ReactNode}) {
  const workspace = useCandidateWorkspace()
  return <Continuity.Provider value={workspace}>{children}</Continuity.Provider>
}
/** The book when one is mounted, else null — for a part that can stand without it (it then shows nothing of the book). */
export function useOptionalContinuity(): CandidateWorkspace | null {
  return useContext(Continuity)
}
export function useContinuity(): CandidateWorkspace {
  const value = useContext(Continuity)
  if (!value) throw Error('The candidate continuity provider is absent')
  return value
}
export type {Workspace}
