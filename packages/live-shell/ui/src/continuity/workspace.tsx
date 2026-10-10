import {createContext, useCallback, useContext, useMemo, useRef, type ReactNode} from 'react'
import {useWorkspaces, type Workspace} from '../../../../../desktop/cradle/src/workspace/store'
import {warmWorkspaceTrees} from '../../../../../desktop/cradle/src/surface/warmTrees'
import {candidateApplicationEnvelope, readCandidateApplicationView} from './applicationView'

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
export function ContinuityProvider({children}: {children: ReactNode}) {
  const workspace = useCandidateWorkspace()
  return <Continuity.Provider value={workspace}>{children}</Continuity.Provider>
}
export function useContinuity(): CandidateWorkspace {
  const value = useContext(Continuity)
  if (!value) throw Error('The candidate continuity provider is absent')
  return value
}
export type {Workspace}
