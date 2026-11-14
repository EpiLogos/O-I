// The owners' readings the Central devices stand on, one hook each. Each reads the owner the face already reads and holds
// nothing of its own: a refusal is the reading (carried, never emptied), and a device with no answer yet keeps its light dark.
//   - the Day die: the owner's document reading (`receiving` kind:document) — the open face and the CAS revision
//     (inhabitants/DocumentDayDieFace.tsx:105-106);
//   - the Nara conversation: the dialogue binding (`lookupNativeDialogue`) once an identity and an expression stand
//     (inhabitants/ConversationNaraFace.tsx:67-90);
//   - the workcell: `workcell_status_read` (the shared workcell answer, owners/readers.ts);
//   - Central's ground: the `central` op `inspect` — the civil-time policy and today's Day reading — as the World Model's day slice
//     holds it (useCentralGroundAnswer; O-I ticket 1005);
//   - Central's readings carried by invoke_action (useCentralAction).
// Lane W3's receipts (owners/notices.ts): a receiving act or a Day write the kernel carried (`receiving_changed`, `day_changed`)
// reads the Day document again, and a Day write reads the ground again — no timer, and nothing the kernel did not carry.
import {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react'
import type {KernelReceipt} from '../../../../../../desktop/cradle/src/kernel/types'
import {receiving} from '../../../../../../desktop/cradle/src/receiving/client'
import type {CentralGroundReading} from '../../../../../../desktop/cradle/src/central/client'
import {validateDocumentBasis, type DayDocumentField} from '../../../../../../desktop/cradle/src/central/dayForm'
import {useOwnerReadingsOf} from '../../owners/ownerReading'
import {opKey, readOp, useOwnerOp, useStableMap} from '../../owners/ownerCall'
import {useSpineEpoch} from '../../owners/spine'
import {useWorkcellAnswer} from '../../owners/readers'
import {modelSlice, useModelSlice} from '../../owners/model'
import {createReceiptCursor, receiptMovesReceiving} from '../../owners/notices'
import {Workspace} from '../../shell/workspaceContext'
import {lookupNativeDialogue, type NativeDialogue} from '../../../../../../desktop/cradle/src/nara/nativeDialogue'
import {currentIdentity} from '../../../../../../desktop/cradle/src/nara/identity/current'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {conversationGap} from '../centralVertical'
import {dieFaceOf} from './dayDie'
import {dayFromModel} from './dayBinding'
import {actionAnswerOf, centralActionOp, type ActionAnswer} from './centralActions'
import type {CentralReads, NaraState} from './centralDeviceModel'

const NO_RECEIPTS: readonly KernelReceipt[] = []

/** Call `again` when the spine's receipts bring a new one that `moves` (each receipt once for this reader). Outside the shell's
 * providers (a pane in a root of its own) no receipt arrives. */
export function useReceiptsMove(moves: (receipt: KernelReceipt) => boolean, again: () => void): void {
  const receipts = useContext(Workspace)?.receipts ?? NO_RECEIPTS
  const fresh = useRef<ReturnType<typeof createReceiptCursor> | null>(null)
  fresh.current ??= createReceiptCursor()
  const live = useRef({moves, again})
  live.current = {moves, again}
  useEffect(() => { if (fresh.current!(receipts).some(live.current.moves)) live.current.again() }, [receipts])
}

export interface DayDieAperture {
  readonly project: string | null
  readonly sourceRef: string
  readonly documentId: string
}

/** The Day document's open face, CAS revision and payload (its records: the capture and sessions ledgers, the task tiers), from the
 * owner's document reading. Null with no Day standing. A Day can be saved in its pane or edited elsewhere, so the owner is read
 * again when the window regains focus or becomes visible, as the Day's standing is (central/useCentralDayStanding.ts) — never
 * polled. */
export function useDayDieReading(transport: KernelTransportStatus, day: DayDieAperture | null): {face: number | null; revision: string | null; payload: unknown; fields: readonly DayDocumentField[] | null; contributions: readonly unknown[] | null; refresh: () => void} {
  const [held, setHeld] = useState<{key: string; face: number; revision: string; payload: unknown; fields: readonly DayDocumentField[]; contributions: readonly unknown[]} | null>(null)
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
        // The Day's contributions stand beside its fields in the same reading (central.document-reading/v1 document.contributions).
        const contributions = (reading as {document: {contributions?: unknown}}).document.contributions
        if (alive) setHeld({key, face: dieFaceOf(basis.payload), revision: basis.revision, payload: basis.payload, fields: basis.fields, contributions: Array.isArray(contributions) ? contributions : []})
      })
      .catch(() => { if (alive) setHeld(null) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the aperture
  }, [transport, key, reread])
  // The owner is read again after a write the devices made (the die's open face), so the three sizes show what the owner holds.
  const refresh = useCallback(() => setReread(count => count + 1), [])
  // …and when the kernel says a receiving act or a Day write moved it (a save in the Day's own pane, an ensure).
  useReceiptsMove(receiptMovesReceiving, refresh)
  return held && held.key === key ? {face: held.face, revision: held.revision, payload: held.payload, fields: held.fields, contributions: held.contributions, refresh}
    : {face: null, revision: null, payload: null, fields: null, contributions: null, refresh}
}

/** The kernel op a project's ground is read by (`central` inspect; projections/atlas/system/SystemReadings.tsx keys a project's ground by
 * it). The root's is the World Model's (useCentralGroundAnswer). */
export const GROUND_OP = 'central inspect'

// The action helpers live in centralActions.ts (pure, free of the held readings), re-exported for the readers that import them here.
export {actionAnswerOf, centralActionOp, type ActionAnswer} from './centralActions'

/** One Central reading for a view, held for the window and read again on the kernel's notice. `input` null reads nothing. */
export function useCentralAction(transport: KernelTransportStatus, action: string, input: Readonly<Record<string, unknown>> | null, project?: string): ActionAnswer {
  const {reading} = useOwnerOp(transport, input ? centralActionOp(action, input, project) : null, 'action_dispatched', `${action} did not answer.`)
  return useMemo(() => input ? actionAnswerOf(reading, action) : {status: 'reading'},
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the reading names the answer
    [reading, action, input === null])
}

/** Central's agent sets by ref (central.agent-set.read {scope root, ref}), each the held answer useCentralAction holds for it: the sets a
 * rack's nested sets are tied to (O-I #842 round 21), so each nested rack reads its own Join. A set not answered yet is absent. */
export function useAgentSetReadings(transport: KernelTransportStatus, refs: readonly string[]): ReadonlyMap<string, ActionAnswer> {
  const epoch = useSpineEpoch()
  const action = 'central.agent-set.read'
  const op = (ref: string) => centralActionOp(action, {scope: 'root', ref})
  const answered = useStableMap(useOwnerReadingsOf(transport.kind === 'unavailable' ? [] : refs, ref => `${opKey(transport, op(ref))}|action_dispatched`,
    ref => readOp(transport, op(ref), 'action_dispatched', `${action} did not answer.`), epoch))
  return useMemo(() => new Map([...answered].map(([ref, value]) => [ref, actionAnswerOf({status: 'answered', value, error: null}, action)])), [answered])
}

/** A Central reading the person may ask again (Machine's Plan and Verify, DLW §18.7): the held answer, and `again`, which reads it once
 * more whatever stands — a refusal included (ownerReading.ts retry). A reading asked again is still a reading: it never travels as a
 * write. `input` null reads nothing. */
export function useCentralActionAsked(transport: KernelTransportStatus, action: string, input: Readonly<Record<string, unknown>> | null, project?: string): {
  answer: ActionAnswer
  again: () => void
} {
  const {reading, retry} = useOwnerOp(transport, input ? centralActionOp(action, input, project) : null, 'action_dispatched', `${action} did not answer.`)
  const answer = useMemo(() => input ? actionAnswerOf(reading, action) : {status: 'reading'} as const,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the reading names the answer
    [reading, action, input === null])
  return useMemo(() => ({answer, again: retry}), [answer, retry])
}

/** Central's ground for the root register, as the World Model's day slice holds it (kernel world_model.rs `day` `ground`; O-I ticket
 * 1005): the reading, the refusal in the owner's words (or the carrier's, when no kernel carrier stands), and the read again a write asks
 * for — a fresh read of the slice. The window's one reading of the ground: the Day device, the transport, Factory's rail and the World's
 * readings all read it here, and the kernel keeps it current (its watch, its own writes, the Day's turn). */
export function useCentralGroundAnswer(transport: KernelTransportStatus): {reading: CentralGroundReading | null; error: string | null; refresh: () => void; retry: () => void} {
  const slice = useModelSlice(transport, 'day')
  const again = useCallback(() => { if (transport.kind !== 'unavailable') void modelSlice(transport, 'day', {fresh: true}) }, [transport])
  return useMemo(() => {
    if (transport.kind === 'unavailable') return {reading: null, error: `the kernel carrier is unavailable: ${transport.reason}`, refresh: again, retry: again}
    const model = dayFromModel(slice)
    return {reading: model.ground, error: model.groundError, refresh: again, retry: again}
  }, [slice, transport, again])
}

type NaraStanding = {readonly state: Exclude<NaraState, 'bound'>} | {readonly state: 'bound'; readonly dialogue: NativeDialogue}

/** Where the conversation's binding stands, and its own fields once bound. */
export function useNaraReading(transport: KernelTransportStatus, project: string | null, expressionRef: string | null, conversation: string | null): NonNullable<CentralReads['nara']> & {refresh: () => void; space: string | null; resume: boolean | null} {
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
    // The session's space and whether it asks to resume: the Answer observes the session by them (answerBinding.ts).
    space: dialogue ? dialogue.provisioning.space : null,
    resume: dialogue && typeof dialogue.provisioning.resume_required === 'boolean' ? dialogue.provisioning.resume_required : null,
    refresh,
  }), [standing.state, conversation, expressionRef, dialogue, refresh])
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
