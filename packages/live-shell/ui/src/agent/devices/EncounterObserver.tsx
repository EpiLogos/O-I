// One session's observer: the shared encounter store's hook (desktop/cradle encounter/session.ts useEncounterSession), loaded only
// when a session is observed (EncounterObservers.tsx lazy-loads this module), so a page or a test that observes none never loads
// the cradle's walk-instrumented session module. It draws nothing; it hands its handle up.
import {useEffect} from 'react'
import {useEncounterSession} from '../../../../../../desktop/cradle/src/encounter/session'
import type {ObservedHandle, ObservedSession} from './EncounterObservers'
import {ROOT_REGISTER} from '../worldScope'

/** Each session is observed in its own register (`session.project`, agent/worldScope.ts), as AgentThreadView.tsx scopes its thread. */
export default function EncounterObserver({session, report}: {session: ObservedSession; report: (ref: string, handle: ObservedHandle | null) => void}) {
  const handle = useEncounterSession({project: session.project ?? ROOT_REGISTER, ref: session.ref, space: session.space})
  useEffect(() => { report(session.ref, handle ?? null) }, [handle, session.ref, report])
  useEffect(() => () => report(session.ref, null), [session.ref, report])
  return null
}
