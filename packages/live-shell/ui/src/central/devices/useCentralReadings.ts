// The owners' readings the Central devices stand on, one hook each. Each reads the owner the face already reads and holds
// nothing of its own: a refusal is the reading (carried, never emptied), and a device with no answer yet keeps its light dark.
//   - the Day die: the owner's document reading (`receiving` kind:document) — the open face and the CAS revision
//     (inhabitants/DocumentDayDieFace.tsx:105-106);
//   - the Nara conversation: the dialogue binding (`lookupNativeDialogue`) once an identity and an expression stand
//     (inhabitants/ConversationNaraFace.tsx:67-90);
//   - the roster: Central's accepted agents (`readRoster`, central.agent-profile-roster/v1; the first accepted agent is the
//     identity, agent/AgentDeviceChain.tsx:38-46);
//   - the workcell: `workcell_status_read` (inhabitants/CentralHygieneDevice.tsx:70-80);
//   - the Flow: the owner's revision of the selected flow document (`readFlowInstance`).
import {useCallback, useEffect, useMemo, useState} from 'react'
import {kernelOp} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {receiving} from '../../../../../../desktop/cradle/src/receiving/client'
import {validateDocumentBasis} from '../../../../../../desktop/cradle/src/central/dayForm'
import {readRoster} from '../../../../../../desktop/cradle/src/agency/roster'
import {readFlowInstance} from '../../../../../../desktop/cradle/src/flow/instances'
import {lookupNativeDialogue, type NativeDialogue} from '../../../../../../desktop/cradle/src/nara/nativeDialogue'
import {currentIdentity} from '../../../../../../desktop/cradle/src/nara/identity/current'
import type {CentralLocation, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {conversationGap} from '../centralVertical'
import {dieFaceOf} from './dayDie'
import type {CentralReads, NaraState} from './centralDeviceModel'

const message = (error: unknown): string => error instanceof Error ? error.message : String(error)

export interface DayDieAperture {
  readonly project: string | null
  readonly sourceRef: string
  readonly documentId: string
}

/** The Day document's open face and CAS revision, from the owner's document reading. Null with no Day standing. A Day can
 * be saved in its pane or edited elsewhere, so the owner is read again when the window regains focus or becomes visible,
 * as the Day's standing is (central/useCentralDayStanding.ts) — never polled. */
export function useDayDieReading(transport: KernelTransportStatus, day: DayDieAperture | null): {face: number | null; revision: string | null; refresh: () => void} {
  const [held, setHeld] = useState<{key: string; face: number; revision: string} | null>(null)
  const [reread, setReread] = useState(0)
  const key = day ? `${day.project ?? ''}|${day.sourceRef}|${day.documentId}` : null
  useEffect(() => {
    if (typeof window === 'undefined') return
    const again = () => { if (document.visibilityState !== 'hidden') setReread(count => count + 1) }
    window.addEventListener('focus', again)
    document.addEventListener('visibilitychange', again)
    return () => { window.removeEventListener('focus', again); document.removeEventListener('visibilitychange', again) }
  }, [])
  useEffect(() => {
    if (!day || !key) return
    let alive = true
    receiving<unknown>(transport, day.project, {kind: 'document', source_ref: day.sourceRef, document_id: day.documentId})
      .then(reading => {
        const basis = validateDocumentBasis(reading, day.sourceRef, day.documentId)
        if (alive) setHeld({key, face: dieFaceOf(basis.payload), revision: basis.revision})
      })
      .catch(() => { if (alive) setHeld(null) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the aperture
  }, [transport, key, reread])
  // The owner is read again after a write the devices made (the die's open face), so the three sizes show what the owner holds.
  const refresh = useCallback(() => setReread(count => count + 1), [])
  return held && held.key === key ? {face: held.face, revision: held.revision, refresh} : {face: null, revision: null, refresh}
}

type NaraStanding = {readonly state: Exclude<NaraState, 'bound'>} | {readonly state: 'bound'; readonly dialogue: NativeDialogue}

/** Where the conversation's binding stands, and its own fields once bound. */
export function useNaraReading(transport: KernelTransportStatus, project: string | null, expressionRef: string | null, conversation: string | null): NonNullable<CentralReads['nara']> & {refresh: () => void} {
  // The identity is read as the face reads it (inhabitants/ConversationNaraFace.tsx:69, `currentIdentity()`): at render, with no
  // subscription, so a conversation device re-reads it whenever its chain does.
  const identity = currentIdentity()
  const [looked, setLooked] = useState<{key: string; standing: NaraStanding} | null>(null)
  const [reread, setReread] = useState(0)
  const key = identity && expressionRef ? `${project ?? ''}|${identity.selection_ref}|${expressionRef}` : null
  useEffect(() => {
    if (!identity || !expressionRef || !key) return
    let alive = true
    lookupNativeDialogue(transport, project ?? '', identity, expressionRef, 'nara')
      .then(dialogue => { if (alive) setLooked({key, standing: dialogue ? {state: 'bound', dialogue} : {state: 'unbound'}}) })
      .catch(() => { if (alive) setLooked({key, standing: {state: 'refused'}}) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the binding
  }, [transport, key, reread])
  // The binding is looked up again after the device resolved it: the owner's session is then in the lookup's reach.
  const refresh = useCallback(() => setReread(count => count + 1), [])
  const standing: NaraStanding = !identity ? {state: 'no-identity'} : !expressionRef ? {state: 'no-expression'} : looked?.key === key ? looked.standing : {state: 'resolving'}
  const dialogue = standing.state === 'bound' ? standing.dialogue : null
  return useMemo(() => ({
    state: standing.state, conversation,
    gap: conversation && !expressionRef ? conversationGap(conversation) : null,
    expression: dialogue ? dialogue.binding.expression_ref : null,
    session: dialogue ? dialogue.provisioning.agent_session : null,
    refresh,
  }), [standing.state, conversation, expressionRef, dialogue, refresh])
}

/** Central's accepted agents. The first accepted agent is the identity the agent face shows. */
export function useRosterReading(transport: KernelTransportStatus): NonNullable<CentralReads['roster']> {
  const [state, setState] = useState<NonNullable<CentralReads['roster']>>({answer: 'reading', identity: null, accepted: 0, total: 0, fault: null})
  useEffect(() => {
    let alive = true
    readRoster(transport)
      .then(agents => {
        const accepted = agents.filter(agent => agent.accepted)
        if (alive) setState({answer: 'read', identity: accepted[0]?.ref ?? null, accepted: accepted.length, total: agents.length, fault: null})
      })
      .catch(error => { if (alive) setState({answer: 'refused', identity: null, accepted: 0, total: 0, fault: message(error)}) })
    return () => { alive = false }
  }, [transport])
  return state
}

/** The workcell status the ground hygiene stands on: its ref and health, or the owner's refusal. */
export function useWorkcellReading(transport: KernelTransportStatus): NonNullable<CentralReads['workcell']> {
  const [state, setState] = useState<NonNullable<CentralReads['workcell']>>({answer: 'reading', ref: null, health: null, ok: null, fault: null})
  useEffect(() => {
    let alive = true
    kernelOp(transport, {op: 'workcell_status_read'}).then(result => {
      if (!alive) return
      if (result.error || result.outcome?.result !== 'workcell_status_reading') {
        setState({answer: 'refused', ref: null, health: null, ok: null, fault: result.error ?? 'the workcell status reading did not answer'})
        return
      }
      const data = (result.outcome.data ?? {}) as {workcell_ref?: unknown; health?: unknown; ok?: unknown}
      setState({
        answer: 'read', fault: null,
        ref: typeof data.workcell_ref === 'string' && data.workcell_ref ? data.workcell_ref : null,
        health: typeof data.health === 'string' && data.health ? data.health : null,
        ok: typeof data.ok === 'boolean' ? data.ok : null,
      })
    })
    return () => { alive = false }
  }, [transport])
  return state
}

/** The owner's revision of the selected flow document, when an aperture selects one. */
export function useFlowReading(transport: KernelTransportStatus, location: CentralLocation | null): {path: string; revision: string | null} | null {
  const [held, setHeld] = useState<{path: string; revision: string} | null>(null)
  const path = location?.path ?? null
  useEffect(() => {
    if (!location) return
    let alive = true
    readFlowInstance(transport, location)
      .then(instance => { if (alive) setHeld({path: location.path, revision: instance.revision}) })
      .catch(() => { if (alive) setHeld(null) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the path names the aperture
  }, [transport, path])
  const revision = location && held?.path === location.path ? held.revision : null
  return useMemo(() => path ? {path, revision} : null, [path, revision])
}
