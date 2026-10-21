// The owners' readings the Central devices stand on, one hook each. Each reads the owner the face already reads and holds
// nothing of its own: a refusal is the reading (carried, never emptied), and a device with no answer yet keeps its light dark.
//   - the Day die: the owner's document reading (`receiving` kind:document) — the open face and the CAS revision
//     (inhabitants/DocumentDayDieFace.tsx:105-106);
//   - the Nara conversation: the dialogue binding (`lookupNativeDialogue`) once an identity and an expression stand
//     (inhabitants/ConversationNaraFace.tsx:67-90);
//   - the roster: Central's accepted agents (the shared roster answer, owners/readers.ts; central.agent-profile-roster/v1; the
//     first accepted agent is the identity, agent/AgentDeviceChain.tsx:38-46);
//   - the workcell: `workcell_status_read` (the shared workcell answer, owners/readers.ts);
//   - Central's ground: the `central` op `inspect` (readGround) — the civil-time policy and today's Day reading — held once for the
//     window (owners/ownerReading.ts), as the Day's own answer is (owners/day.ts);
//   - Central's readings carried by invoke_action (useCentralAction): the Day's own settings and moves (T-COVERAGE §1.3).
// Lane W3's receipts (owners/notices.ts): a receiving act or a Day write the kernel carried (`receiving_changed`, `day_changed`)
// reads the Day document again, and a Day write reads the ground again — no timer, and nothing the kernel did not carry.
import {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react'
import type {KernelReceipt} from '../../../../../../desktop/cradle/src/kernel/types'
import {receiving} from '../../../../../../desktop/cradle/src/receiving/client'
import {readGround, type CentralGroundReading} from '../../../../../../desktop/cradle/src/central/client'
import {validateDocumentBasis} from '../../../../../../desktop/cradle/src/central/dayForm'
import {onAttentionRegained} from '../../owners/attention'
import {ownerReadings, useOwnerReading, useOwnerReadingsOf, type OwnerRead} from '../../owners/ownerReading'
import {kernelReadSend} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {pageSourceRef, type CentralPageHistory} from '../../timeline/centralTrackAdapter'
import type {CentralWorld, WorldPagesReading} from '../centralWorlds'
import {useOwnerOp} from '../../owners/ownerCall'
import {useSpineEpoch} from '../../owners/spine'
import {useRosterAgents, useWorkcellAnswer} from '../../owners/readers'
import {createReceiptCursor, receiptMovesDay, receiptMovesReceiving} from '../../owners/notices'
import {Workspace} from '../../shell/workspaceContext'
import {lookupNativeDialogue, type NativeDialogue} from '../../../../../../desktop/cradle/src/nara/nativeDialogue'
import {currentIdentity} from '../../../../../../desktop/cradle/src/nara/identity/current'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {conversationGap} from '../centralVertical'
import {dieFaceOf} from './dayDie'
import {DAY_MOVES_ACTION, DAY_SETTINGS_ACTION, type DayOwnReadings} from './dayBinding'
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
  // …and when the kernel says a receiving act or a Day write moved it (a save in the Day's own pane, an ensure).
  useReceiptsMove(receiptMovesReceiving, refresh)
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

// The action helpers live in centralActions.ts (pure, free of the held readings), re-exported for the readers that import them here.
export {actionAnswerOf, centralActionOp, type ActionAnswer} from './centralActions'

/** One Central reading for a view, held for the window and read again on the kernel's notice. `input` null reads nothing. */
export function useCentralAction(transport: KernelTransportStatus, action: string, input: Readonly<Record<string, unknown>> | null, project?: string): ActionAnswer {
  const {reading} = useOwnerOp(transport, input ? centralActionOp(action, input, project) : null, 'action_dispatched', `${action} did not answer.`)
  return useMemo(() => input ? actionAnswerOf(reading, action) : {status: 'reading'},
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the reading names the answer
    [reading, action, input === null])
}

/** The Day's own settings (central.day.settings.read) and the moves of the Day shown (central.day.moves.read {day_ref}, only when
 * its document stands), with the policy's timezone: the readings dayBinding.ts dayOwnValuesOf reads. */
export function useDayOwnReadings(transport: KernelTransportStatus, dayRef: string | null, timezone: string | null): DayOwnReadings {
  const settings = useCentralAction(transport, DAY_SETTINGS_ACTION, {})
  const moves = useCentralAction(transport, DAY_MOVES_ACTION, dayRef ? {day_ref: dayRef} : null)
  return useMemo(() => ({
    settings: settings.status === 'answered' ? settings.value : null,
    settingsRefusal: settings.status === 'refused' ? settings.error : null,
    moves: !dayRef ? null : moves.status === 'answered' ? moves.value : undefined,
    movesRefusal: dayRef && moves.status === 'refused' ? moves.error : null,
    timezone,
  }), [settings, moves, dayRef, timezone])
}

/** Central's file-history reading, a page's revisions (its takes, manual §18.1). */
export const SOURCE_HISTORY_ACTION = 'central.temporal.source-history'
/** How many of a page's saves are read: a day's worth for a page saved often. */
export const PAGE_HISTORY_LIMIT = 50

/** Each page's history (central.temporal.source-history through invoke_action), by the page's path, for today's worlds' pages: held for
 * the window per page, a refusal kept as the page's answer in Central's words (timeline/centralTrackAdapter.ts pageTakesOf reads it). */
export function usePageHistories(transport: KernelTransportStatus | undefined, worlds: readonly Pick<CentralWorld, 'ref' | 'project'>[],
  pages: ReadonlyMap<string, WorldPagesReading>, epoch: string): ReadonlyMap<string, CentralPageHistory> {
  const usable = transport && transport.kind !== 'unavailable' ? transport : null
  const rows = useMemo(() => !usable ? [] : worlds.flatMap(world => {
    const read = pages.get(world.ref)
    return read?.state === 'read' ? read.listing.pages.flatMap(page => { const ref = pageSourceRef(world, page.location.path); return ref ? [JSON.stringify([page.location.path, ref.sourceRef, ref.project ?? null])] : [] }) : []
  }), [usable, worlds, pages])
  const answers = useOwnerReadingsOf(rows, row => JSON.stringify(['page-history', usable, row]), row => async () => {
    const [, sourceRef, project] = JSON.parse(row) as [string, string, string | null]
    const call = await kernelReadSend(usable!, centralActionOp(SOURCE_HISTORY_ACTION, {source_ref: sourceRef, limit: PAGE_HISTORY_LIMIT, ...(project ? {project} : {})}))
    const answer = actionAnswerOf({status: call.error ? 'refused' : 'answered', value: call.outcome?.result === 'action_dispatched' ? call.outcome : null, error: call.error ?? null}, SOURCE_HISTORY_ACTION)
    return {value: answer.status === 'answered' ? {state: 'read', history: answer.value} as CentralPageHistory
      : {state: 'refused', reason: answer.status === 'refused' ? answer.error : `${SOURCE_HISTORY_ACTION} did not answer.`} as CentralPageHistory}
  }, epoch)
  return useMemo(() => new Map([...answers].map(([row, history]) => [(JSON.parse(row) as [string])[0], history])), [answers])
}

/** Central's ground for the root register, held once for the window: the reading, the refusal in the owner's words (or the
 * carrier's, when no kernel carrier stands), and the reads again a write asks for. */
export function useCentralGroundAnswer(transport: KernelTransportStatus): {reading: CentralGroundReading | null; error: string | null; refresh: () => void; retry: () => void} {
  installGroundNotices()
  const epoch = useSpineEpoch()
  const carried = transport.kind !== 'unavailable'
  const {reading, refresh, retry} = useOwnerReading(carried ? groundKey(transport) : null, readGroundOf(transport), epoch)
  // A Day write the kernel carried moves today's Day reading: the ground is read again, a remembered refusal too.
  useReceiptsMove(receiptMovesDay, retry)
  if (!carried) return {reading: null, error: `the kernel carrier is unavailable: ${transport.reason}`, refresh, retry}
  return {reading: reading.status === 'answered' ? reading.value : null, error: reading.status === 'refused' ? reading.error : null, refresh, retry}
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
