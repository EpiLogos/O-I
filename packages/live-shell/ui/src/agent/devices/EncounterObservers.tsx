// The sessions' conversations as the Thread and the Agent read them: the ONE shared observer of each session (desktop/cradle
// encounter/session.ts useEncounterSession — "Every presenter of one session shares ONE store entry, keyed `${project}:${ref}`"),
// the same the thread pane subscribes (AgentThreadView.tsx: project O-I, the track's session and space), so the pane and the devices
// never read a session twice. One observer component per session, mounted only for a session there is to observe (so a page with no
// kernel provider and no session — the refusal fixture — mounts none); each hands its handle up. A presenter the kernel cannot serve
// says so in its handle's place, and never takes the chain down.
import {Component, Suspense, lazy, useCallback, useState, type ReactNode} from 'react'
import type {EncounterSessionHandle} from '../../../../../../desktop/cradle/src/encounter/session'

/** `project`: the register the session was read under (agent/worldScope.ts), its conversation's own; absent is your world's root register. */
export interface ObservedSession {readonly ref: string; readonly space: string; readonly project?: string}
export type ObservedHandle = EncounterSessionHandle | {readonly error: string}
type Report = (ref: string, handle: ObservedHandle | null) => void

/** The observer itself, loaded on first use: the cradle's session module instruments the walk harness at module scope, so it is
 * imported only when a session is observed (EncounterObserver.tsx). */
const Observer = lazy(() => import('./EncounterObserver'))

class Boundary extends Component<{session: string; report: Report; children: ReactNode}, {failed: boolean}> {
  state = {failed: false}
  static getDerivedStateFromError() { return {failed: true} }
  componentDidCatch(cause: unknown) { this.props.report(this.props.session, {error: cause instanceof Error ? cause.message : String(cause)}) }
  render() { return this.state.failed ? null : this.props.children }
}

/** Observe each session: the handles by session ref, and the observers to mount (render them anywhere; they draw nothing). */
export function useEncounterSessions(sessions: readonly ObservedSession[]): {handles: Readonly<Record<string, ObservedHandle>>; observers: ReactNode} {
  const [handles, setHandles] = useState<Readonly<Record<string, ObservedHandle>>>({})
  const report = useCallback<Report>((ref, handle) => setHandles(was => {
    if (handle === null) { if (!(ref in was)) return was; const {[ref]: _gone, ...rest} = was; return rest }
    return was[ref] === handle ? was : {...was, [ref]: handle}
  }), [])
  const observers = sessions.map(session => (
    <Boundary key={`${session.ref}@${session.space}@${session.project ?? ''}`} session={session.ref} report={report}><Suspense fallback={null}><Observer session={session} report={report} /></Suspense></Boundary>))
  return {handles, observers}
}

/** A handle's state, when the observer is serving one. */
export const observedState = (handle: ObservedHandle | undefined) => (handle && 'state' in handle ? handle.state : undefined)
