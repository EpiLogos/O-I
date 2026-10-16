// The owners' readings the Central devices stand on, one hook each. Each reads the owner the face already reads and holds
// nothing of its own: a refusal is the reading (carried, never emptied), and a device with no answer yet keeps its light dark.
//   - the Day die: the owner's document reading (`receiving` kind:document) — the open face and the CAS revision
//     (inhabitants/DocumentDayDieFace.tsx:105-106);
//   - the Nara conversation: the dialogue binding (`lookupNativeDialogue`) once an identity and an expression stand
//     (inhabitants/ConversationNaraFace.tsx:67-90);
//   - the roster: Central's accepted agents (the shared roster answer, owners/readers.ts; central.agent-profile-roster/v1; the
//     first accepted agent is the identity, agent/AgentDeviceChain.tsx:38-46);
//   - the workcell: `workcell_status_read` (the shared workcell answer, owners/readers.ts);
//   - the Flow: the owner's revision of the selected flow document (`readFlowInstance`);
//   - Central's ground: the `central` op `inspect` (readGround) — the civil-time policy and today's Day reading — held once for the
//     window (owners/ownerReading.ts), as the Day's own answer is (owners/day.ts).
import {useCallback, useEffect, useMemo, useState} from 'react'
import {receiving} from '../../../../../../desktop/cradle/src/receiving/client'
import {readGround, type CentralGroundReading} from '../../../../../../desktop/cradle/src/central/client'
import {validateDocumentBasis} from '../../../../../../desktop/cradle/src/central/dayForm'
import {onAttentionRegained} from '../../owners/attention'
import {ownerReadings, useOwnerReading, type OwnerRead} from '../../owners/ownerReading'
import {useSpineEpoch} from '../../owners/spine'
import {useRosterAgents, useWorkcellAnswer} from '../../owners/readers'
import {readFlowInstance} from '../../../../../../desktop/cradle/src/flow/instances'
import {lookupNativeDialogue, type NativeDialogue} from '../../../../../../desktop/cradle/src/nara/nativeDialogue'
import {currentIdentity} from '../../../../../../desktop/cradle/src/nara/identity/current'
import type {CentralLocation, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {conversationGap} from '../centralVertical'
import {dieFaceOf} from './dayDie'
import type {CentralReads, NaraState} from './centralDeviceModel'

export interface DayDieAperture {
  readonly project: string | null
  readonly sourceRef: string
  readonly documentId: string
}

/** The Day document's open face, CAS revision and payload (its records: the capture and sessions ledgers, the task tiers), from the
 * owner's document reading. Null with no Day standing. A Day can be saved in its pane or edited elsewhere, so the owner is read
 * again when the window regains focus or becomes visible, as the Day's standing is (central/useCentralDayStanding.ts) — never
 * polled. */
export function useDayDieReading(transport: KernelTransportStatus, day: DayDieAperture | null): {face: number | null; revision: string | null; payload: unknown; refresh: () => void} {
  const [held, setHeld] = useState<{key: string; face: number; revision: string; payload: unknown} | null>(null)
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
        if (alive) setHeld({key, face: dieFaceOf(basis.payload), revision: basis.revision, payload: basis.payload})
      })
      .catch(() => { if (alive) setHeld(null) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the aperture
  }, [transport, key, reread])
  // The owner is read again after a write the devices made (the die's open face), so the three sizes show what the owner holds.
  const refresh = useCallback(() => setReread(count => count + 1), [])
  return held && held.key === key ? {face: held.face, revision: held.revision, payload: held.payload, refresh} : {face: null, revision: null, payload: null, refresh}
}

export const GROUND_OP = 'central inspect'
/** A window return reads an answered ground again only when it is at least this old (focus and visibility arrive together). */
export const GROUND_ATTENTION_MIN_AGE_MS = 5_000

export const groundKey = (transport: KernelTransportStatus): string => JSON.stringify([GROUND_OP, transport, null])

/** The root register's ground (`central` inspect): an answer, or the owner's refusal in its words. */
export function readGroundOf(transport: KernelTransportStatus): OwnerRead<CentralGroundReading> {
  return async () => ({value: await readGround(transport, null)})
}

let groundNotices = false
/** A Day can be ensured or initialised outside this shell: an answered ground is read again when the window is regained (the
 * Day answer's own rule, owners/day.ts:36-49). */
function installGroundNotices() {
  if (groundNotices || typeof window === 'undefined') return
  groundNotices = true
  onAttentionRegained(() => {
    const at = Date.now()
    for (const entry of ownerReadings.entries()) {
      if (!entry.key.startsWith(`["${GROUND_OP}"`) || entry.readers === 0) continue
      const standing = entry.snapshot()
      const age = entry.ageAt(at)
      if (standing.epoch && standing.status === 'answered' && (age === null || age >= GROUND_ATTENTION_MIN_AGE_MS)) void entry.refresh(standing.epoch)
    }
  })
}

/** Central's ground for the root register, held once for the window: the reading, the refusal in the owner's words (or the
 * carrier's, when no kernel carrier stands), and the reads again a write asks for. */
export function useCentralGroundAnswer(transport: KernelTransportStatus): {reading: CentralGroundReading | null; error: string | null; refresh: () => void; retry: () => void} {
  installGroundNotices()
  const epoch = useSpineEpoch()
  const carried = transport.kind !== 'unavailable'
  const {reading, refresh, retry} = useOwnerReading(carried ? groundKey(transport) : null, readGroundOf(transport), epoch)
  if (!carried) return {reading: null, error: `the kernel carrier is unavailable: ${transport.reason}`, refresh, retry}
  return {reading: reading.status === 'answered' ? reading.value : null, error: reading.status === 'refused' ? reading.error : null, refresh, retry}
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

/** Central's accepted agents (the root register), from the window's shared roster answer (owners/readers.ts) — the same one
 * the agent browser, the Factory chain and the sessions provider read. The first accepted agent is the identity the agent
 * face shows. */
export function useRosterReading(transport: KernelTransportStatus): NonNullable<CentralReads['roster']> {
  const roster = useRosterAgents(transport)
  return useMemo((): NonNullable<CentralReads['roster']> => {
    if (roster.state === 'reading') return {answer: 'reading', identity: null, accepted: 0, total: 0, fault: null}
    if (roster.state === 'error') return {answer: 'refused', identity: null, accepted: 0, total: 0, fault: roster.error ?? 'The agent roster did not answer'}
    const accepted = roster.agents.filter(agent => agent.accepted)
    return {answer: 'read', identity: accepted[0]?.ref ?? null, accepted: accepted.length, total: roster.agents.length, fault: null}
  }, [roster])
}

/** The workcell status the ground hygiene stands on: its ref and health, or the owner's refusal — the window's shared
 * workcell answer (owners/readers.ts), a refusal remembered for its epoch. */
export function useWorkcellReading(transport: KernelTransportStatus): NonNullable<CentralReads['workcell']> {
  const {reading} = useWorkcellAnswer(transport)
  return useMemo((): NonNullable<CentralReads['workcell']> => {
    if (reading.status === 'reading') return {answer: 'reading', ref: null, health: null, ok: null, fault: null}
    if (reading.status === 'refused') return {answer: 'refused', ref: null, health: null, ok: null, fault: reading.error ?? 'the workcell status reading did not answer'}
    const data = (reading.value ?? {}) as {workcell_ref?: unknown; health?: unknown; ok?: unknown}
    return {
      answer: 'read', fault: null,
      ref: typeof data.workcell_ref === 'string' && data.workcell_ref ? data.workcell_ref : null,
      health: typeof data.health === 'string' && data.health ? data.health : null,
      ok: typeof data.ok === 'boolean' ? data.ok : null,
    }
  }, [reading])
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
