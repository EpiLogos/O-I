// Factory's unit decisions in Approvals (lane W9; DLW §19.14 "Requests ask for a decision … For a request, read the question. Choose Approve
// or Deny."). Factory holds them, and they reach the shell through owners that exist:
//   - the Run's own reading (factory_development_read `run`, factory.run-reading/v1): `humanRequests` [{humanRequestRef, decisionRef, question,
//     whyHuman, unitDecisionBasis? {workflowUnitRef, attemptRef, executionRef, resolverRef, controlled, …}, unitDecisionResponse?,
//     unitDecisionRetirement?}] (factory/src/build.rs HumanRequestRecord, run_lifecycle.rs UnitDecisionBasis). A unit decision waits while it
//     has a basis and neither a response nor a retirement;
//   - where Factory put the question to Central (`factory attempt decision submit`, which "does not answer a question"), the Run's native
//     attempts retain the call: an observation {contract factory.attempt-unit-decision-call/v1, operationRef "factory-unit-decision:<human
//     request ref>", phase observed, payload.centralResponse = Central's receiving reading of the question} (attempt_native_receiving.rs);
//   - `factory attempt decision read <state> <run> <human request> <receiving ref>` (the kernel's factory_owner attempt-decision-read,
//     factory.attempt-unit-decision-reading/v1: centralResponse, decisionResponse when the unit's resolver answered, else `unresolved`).
// The person answers in Central's receiving field: the question offers exactly "Resume bounded work" and "Cancel bounded work", and Factory
// takes an answer only from the unit's resolver (reviewed_response: reviewer_ref = resolverRef). Approve answers Resume, Deny answers Cancel,
// each the person's own press through the kernel's `receiving` Review {disposition answered}. A question Factory has not put to Central yet
// cannot be answered from here: its submission takes the retained RequestUnitDecision Action, which no reading here holds and the desk
// composes none. Nothing is invented: a field Factory does not name is left out of the row.
import {kernelRead} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import type {Value} from '../../frame/devices/designed'
import {useHeldRead} from '../../owners/ownerCall'
import {refusalWords} from './ownerRoutes'
import {developmentReading} from './runJourney'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

export const QUESTION_CALL = 'factory.attempt-unit-decision-call/v1'
export const DECISION_READING = 'factory.attempt-unit-decision-reading/v1'
/** The two bounded decisions Factory declares for every unit question (attempt_native_receiving.rs question_input `options`). */
export const UNIT_ANSWERS = {allowOnce: 'Resume bounded work', deny: 'Cancel bounded work'} as const

/** One unit decision that waits, as Factory holds it. */
export interface UnitDecision {
  readonly statePath: string
  readonly runRef: string
  readonly humanRequestRef: string
  readonly question: string
  readonly unit?: string
  readonly resolverRef?: string
  /** The Central return Factory's submission made of the question, where the Run retains the call. */
  readonly receivingRef?: string
}

/** The Central return Factory's submitted question became, from the Run's retained call; undefined when Factory has not put it to Central. */
function questionRefOf(run: Obj, humanRequestRef: string): string | undefined {
  const attempts = isObj(run.nativeAttempts) && Array.isArray(run.nativeAttempts.attempts) ? run.nativeAttempts.attempts : []
  for (const attempt of attempts) {
    for (const seen of isObj(attempt) && Array.isArray(attempt.observations) ? attempt.observations : []) {
      if (!isObj(seen) || seen.contract !== QUESTION_CALL || seen.operationRef !== `factory-unit-decision:${humanRequestRef}` || seen.phase !== 'observed') continue
      const response = isObj(seen.payload) && isObj(seen.payload.centralResponse) ? seen.payload.centralResponse : null
      const ref = response && isObj(response.data) ? str(response.data.return_ref) : undefined
      if (ref) return ref
    }
  }
  return undefined
}

/** The Run's unit decisions that wait (a basis, no response, no retirement). Pure. */
export function pendingUnitDecisions(statePath: string, run: unknown): UnitDecision[] {
  if (!isObj(run) || !str(run.runRef) || !Array.isArray(run.humanRequests)) return []
  return run.humanRequests.flatMap(row => {
    if (!isObj(row) || !isObj(row.unitDecisionBasis) || row.unitDecisionResponse || row.unitDecisionRetirement) return []
    const ref = str(row.humanRequestRef), question = str(row.question)
    if (!ref || !question) return []
    const basis = row.unitDecisionBasis, receivingRef = questionRefOf(run, ref)
    return [{statePath, runRef: String(run.runRef), humanRequestRef: ref, question, ...(str(basis.workflowUnitRef) ? {unit: String(basis.workflowUnitRef)} : {}),
      ...(str(basis.resolverRef) ? {resolverRef: String(basis.resolverRef)} : {}), ...(receivingRef ? {receivingRef} : {})}]
  })
}

/** What `factory attempt decision read` says of one question: Central's return (its revision, its status, when it arrived), and whether the
 * unit's resolver has answered it. */
export interface QuestionStanding {
  readonly revision?: string
  readonly status?: string
  readonly receivedAt?: number
  readonly answered: boolean
}

/** Factory's decision reading as the question's standing; null when it is not that reading. Pure. */
export function questionStanding(reading: unknown): QuestionStanding | null {
  if (!isObj(reading) || reading.contract !== DECISION_READING) return null
  const central = isObj(reading.centralResponse) && isObj(reading.centralResponse.data) ? reading.centralResponse.data : null
  const record = central && isObj(central.record) ? central.record : null
  return {...(central && str(central.revision) ? {revision: String(central.revision)} : {}), ...(record && str(record.status) ? {status: String(record.status)} : {}),
    ...(record && num(record.received_at_unix_seconds) !== undefined ? {receivedAt: num(record.received_at_unix_seconds)} : {}), answered: !!reading.decisionResponse}
}

/** The unit decisions the chain read: each waiting decision, with its question's standing where Factory read it (or why not). */
export interface UnitDecisionsRead {
  readonly decisions: readonly UnitDecision[]
  readonly standings: Readonly<Record<string, {readonly standing?: QuestionStanding; readonly error?: string}>>
}

/** The decisions that still wait for you: Factory's pending ones whose question the resolver has not answered. Pure. */
export const waitingDecisions = (read: UnitDecisionsRead | null | undefined): UnitDecision[] =>
  (read?.decisions ?? []).filter(decision => !read!.standings[decision.humanRequestRef]?.standing?.answered)

/** The waiting decisions as Approvals' requests (software-factory__approvals.tsx rows {id, kind request, who, text, where, session, age}):
 * the question, the unit it stops, the session's agent, and how long the question has stood in Central where it does. Pure. */
export function unitRows(read: UnitDecisionsRead | null | undefined, session: {readonly agentName?: string | null; readonly agentRef?: string | null; readonly purpose?: string | null; readonly sessionRef: string} | null,
  nowUnixMs: number | undefined): Record<string, Value>[] {
  return waitingDecisions(read).map(decision => {
    const standing = read!.standings[decision.humanRequestRef]?.standing
    const who = session?.agentName ?? session?.agentRef ?? undefined
    return {id: decision.humanRequestRef, kind: 'request', text: decision.question, ...(decision.unit ? {where: decision.unit} : {}), ...(who ? {who} : {}),
      ...(session ? {session: session.purpose ?? session.sessionRef} : {}),
      ...(standing?.receivedAt !== undefined && nowUnixMs ? {age: Math.max(0, Math.round(nowUnixMs / 1000 - standing.receivedAt))} : {})}
  })
}

/** The register a Central return belongs to, from its ref (`central:return:project:<P>:…` or `central:return:control:root:…`). */
export function returnProject(ref: string): string | null | undefined {
  const project = /^central:return:project:([^:]+):/.exec(ref)
  return project ? project[1] : ref.startsWith('central:return:control:root:') ? null : undefined
}

/** The receiving Review that answers one waiting decision as the person, or why it cannot be asked now, in words. Pure. */
export function unitAnswer(read: UnitDecisionsRead | null | undefined, id: unknown, key: 'allowOnce' | 'allowAlways' | 'deny', person: string | null):
  {readonly project: string | null; readonly review: {kind: 'review'; return_ref: string; expected_return_revision: string; disposition: 'answered'; answer: string}} | {readonly refused: string} {
  const decision = waitingDecisions(read).find(item => item.humanRequestRef === id)
  if (!decision) return {refused: 'That decision no longer waits: Factory reports it answered or retired.'}
  if (key === 'allowAlways') return {refused: 'A unit decision takes one answer, Resume or Cancel (Allow once or Deny); nothing allows it always.'}
  if (!decision.receivingRef) return {refused: 'Factory has not put this question to Central yet, so there is nothing to answer: `factory attempt decision submit` takes the retained RequestUnitDecision Action, which no reading here holds, and the desk composes none.'}
  const read1 = read!.standings[decision.humanRequestRef]
  if (!read1?.standing) return {refused: read1?.error ?? 'Factory has not read the question\'s standing in Central yet (`factory attempt decision read`).'}
  if (!read1.standing.revision) return {refused: '`factory attempt decision read` named no revision of the question in Central, so no answer can name the one you read.'}
  if (read1.standing.status && read1.standing.status !== 'pending') return {refused: `The question stands ${read1.standing.status} in Central, so it takes no answer.`}
  if (!person) return {refused: 'Central\'s personal anchor has not named the person (central.personal.anchor.inspect), and only the unit\'s resolver answers it.'}
  if (decision.resolverRef && decision.resolverRef !== person) return {refused: `Only the unit's resolver answers it (${decision.resolverRef}); Factory takes no other reviewer's answer.`}
  const project = returnProject(decision.receivingRef)
  if (project === undefined) return {refused: `The question's Central return (${decision.receivingRef}) names no register this desk can ask.`}
  return {project, review: {kind: 'review', return_ref: decision.receivingRef, expected_return_revision: read1.standing.revision, disposition: 'answered', answer: UNIT_ANSWERS[key]}}
}

/** One factory_owner read through the kernel's held reads: Factory's document, or its refusal in its words. */
async function factoryOwnerRead(transport: KernelTransportStatus, request: Record<string, unknown>): Promise<unknown> {
  if (transport.kind === 'unavailable') throw new Error(`The kernel carrier is unavailable: ${transport.reason}`)
  const call = await kernelRead(transport, {op: 'factory_owner', request: request as {kind: string}})
  if (call.error) throw new Error(refusalWords(call.error))
  if (call.outcome?.result !== 'factory_development_reading') throw new Error(`factory ${String(request.kind)} did not answer with its reading.`)
  return call.outcome.data
}

/** Read the Runs' waiting decisions, and for each question Factory put to Central, its standing there. A Run Factory refuses is skipped
 * (the Runs device says why); a standing Factory refuses keeps Factory's words. */
export async function readUnitDecisions(transport: KernelTransportStatus, runs: readonly {readonly statePath: string; readonly runRef: string}[]): Promise<UnitDecisionsRead> {
  const decisions = (await Promise.all(runs.map(async run => {
    try { return pendingUnitDecisions(run.statePath, await developmentReading(transport, run.statePath, 'run', run.runRef)) } catch { return [] }
  }))).flat()
  const standings = Object.fromEntries(await Promise.all(decisions.filter(decision => decision.receivingRef).map(async decision => {
    try {
      const standing = questionStanding(await factoryOwnerRead(transport, {kind: 'attempt-decision-read', state_path: decision.statePath, run_ref: decision.runRef,
        human_request_ref: decision.humanRequestRef, receiving_ref: decision.receivingRef}))
      return [decision.humanRequestRef, standing ? {standing} : {error: '`factory attempt decision read` answered something other than its decision reading.'}] as const
    } catch (cause) { return [decision.humanRequestRef, {error: cause instanceof Error ? cause.message : String(cause)}] as const }
  })))
  return {decisions, standings}
}

/** The waiting decisions of the Runs the shown session's takes name, held for the window (read again on the spine's epoch and after a write).
 * Nothing is asked without a Run. */
export function useUnitDecisions(transport: KernelTransportStatus, runs: readonly {readonly statePath: string; readonly runRef: string}[]) {
  const key = runs.map(run => `${run.statePath}\u0000${run.runRef}`).sort().join('\u0001')
  return useHeldRead<UnitDecisionsRead>(runs.length ? ['unit-decisions', transport, key] : null, () => readUnitDecisions(transport, runs))
}
