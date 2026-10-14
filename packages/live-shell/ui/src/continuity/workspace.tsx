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
 * presentation) · Base·Central (the Central world context over the same
 * book mode) · Factory · Expressions · Technē, with Settings the terminal
 * system entry. Live and Base share the book's `base` mode — the design's
 * §6 resolution: Central is a world context (`context.world = 'central'`),
 * not a second mode — so a mode switch here is an encounter transition
 * over the spine, never a fork of it. */
export type ShellMode = 'audio' | 'base' | 'factory' | 'expressions' | 'techne' | 'settings'
export type CandidateWorkspace = ReturnType<typeof useCandidateWorkspace>

/** One imported v2 book. Audio is the candidate's presentation of Base;
 * owner documents, source buffers and recovery addresses remain native. */
export function useCandidateWorkspace() {
  const book = useWorkspaces({storageKey: CANDIDATE_WORKSPACE_KEY, legacyLayoutKey: CANDIDATE_LEGACY_LAYOUT_KEY})
  const storedMode = book.current.layout.mode ?? 'base'
  // Restore reads the encounter: book `base` stands in Base·Central when the
  // world context says Central, else it is Live's audio cut (the standing
  // reading of this candidate).
  const mode: ShellMode = storedMode === 'expressions' || storedMode === 'techne' || storedMode === 'settings' || storedMode === 'factory' ? storedMode
    : storedMode === 'base' && book.current.context?.world === 'central' ? 'base' : 'audio'
  const setMode = (next: ShellMode) => book.switchMode(next === 'audio' || next === 'base' ? 'base' : next)
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

/** One apply per page load. React StrictMode runs effects twice, and two applies must never race. */
let admissionRun: Promise<AdmissionOutcome> | null = null
function runAdmissionOnce(): Promise<AdmissionOutcome> {
  admissionRun ??= Promise.resolve()
    .then(() => applyPendingAdmission({
      store: localStorage,
      namespace: CANDIDATE_WORKSPACE_KEY,
      read: () => tauriInvoke<PendingAdmission>('live_shell_continuity_pending', {}),
      confirm: confirmation => tauriInvoke<void>('live_shell_continuity_confirm', {...confirmation}),
    }))
    .catch((error: unknown): AdmissionOutcome => ({status: 'failed', admission: '', reason: `The owner-admitted continuity could not start (${error instanceof Error ? error.message : String(error)}). The workspace is held.`}))
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
  useEffect(() => {
    if (outcome) return
    let live = true
    void runAdmissionOnce().then(next => { if (live) setOutcome(next) })
    return () => { live = false }
  }, [outcome])
  if (!outcome) return <p role="status" data-region="continuity-admission" style={holdStyle}>Reading the owner-admitted continuity…</p>
  if (outcome.status === 'failed') return <p role="alert" data-region="continuity-admission" data-admission="failed" style={holdStyle}>{outcome.reason}</p>
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
export function useContinuity(): CandidateWorkspace {
  const value = useContext(Continuity)
  if (!value) throw Error('The candidate continuity provider is absent')
  return value
}
export type {Workspace}
