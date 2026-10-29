// The sessions' attempts as takes, read from their owners (agent/factoryTakes.ts): AIKit says which Factory attempts each session's
// bound task serves (one `encounter_task_attempts_list` for every track), Factory says what each is (`factory_attempt_read` for
// each Run the attempts name). Nothing is kept beyond the answer: the take lanes are drawn from the latest one. It reads again when
// the spine's epoch moves, when a Factory Run act the kernel carried finishes (the temporal notice: a receiving receipt moves the
// take that stands), and when the person chooses a take.
import {useCallback, useEffect, useReducer, useState} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {attemptReceivingWords, receiveAttempt} from '../../../../../desktop/cradle/src/contributions/factory/desk/factoryReads'
import {runKey, runsOf, servedBySession, takesBySession, type FactoryTake} from '../agent/factoryTakes'
import {onOwnerChanged, tellOwnerChanged} from './notices'
import {useSpineEpoch} from './spine'
import {projectFor, type SessionProjects} from './readers'

/** The kernel op as the reads call it: its outcome, or its refusal in words. */
export type TakesCall = (op: Record<string, unknown>) => Promise<{error?: string; outcome?: {result: string; data?: unknown}}>

const carried = (transport: KernelTransportStatus): TakesCall => op =>
  kernelOp(transport, op as Parameters<typeof kernelOp>[1]) as unknown as ReturnType<TakesCall>

/** Every session's takes, as the owners state them. A session AIKit refused, or whose bound task serves none, has no entry; a Run
 * Factory did not read leaves its attempts out (a take is only drawn from what its owner says). Each session is asked in its own
 * register (`projects`: one for all, or each session's, owners/readers.ts SessionProjects), one list per register. Null when AIKit
 * answered no register. */
export async function readAttemptTakes(call: TakesCall, projects: SessionProjects, sessionRefs: readonly string[]): Promise<Map<string, FactoryTake[]> | null> {
  if (!sessionRefs.length) return new Map()
  const byProject = new Map<string, string[]>()
  for (const ref of sessionRefs) { const project = projectFor(projects, ref); byProject.set(project, [...(byProject.get(project) ?? []), ref]) }
  const served: ReturnType<typeof servedBySession> = new Map()
  let answered = false
  for (const [project, refs] of byProject) {
    const listed = await call({op: 'encounter_task_attempts_list', project, agent_sessions: refs})
    if (listed.error || listed.outcome?.result !== 'encounter_task_attempts_list_reading') continue
    answered = true
    for (const [session, attempts] of servedBySession(listed.outcome.data as Parameters<typeof servedBySession>[0])) served.set(session, attempts)
  }
  if (!answered) return null
  const runs = new Map<string, unknown>()
  for (const run of runsOf(served)) {
    const read = await call({op: 'factory_attempt_read', state_path: run.statePath, run_ref: run.runRef})
    if (!read.error && read.outcome?.result === 'factory_attempt_reading') runs.set(runKey(run.statePath, run.runRef), read.outcome.data)
  }
  return takesBySession(served, runs)
}

/** Choose one take: Factory's own op, answered in the owner's words (agent/factoryTakes.ts). A refusal and an unconfirmed answer
 * are `ok: false` with the owner's reason; the Run's readers are told when something may have moved. */
export async function chooseAttempt(transport: KernelTransportStatus, take: FactoryTake): Promise<{ok: true; note: string} | {ok: false; error: string}> {
  try {
    const receipt = await receiveAttempt(transport, {statePath: take.statePath, runRef: take.runRef, attemptRef: take.attemptRef})
    if (receipt.changed) tellOwnerChanged({topic: 'temporal', cause: 'an attempt was chosen: its Return was proposed to Central\'s receiving field', agentSession: take.sessionRef})
    const words = attemptReceivingWords(receipt)
    return words.ok ? {ok: true, note: words.line} : {ok: false, error: words.line}
  } catch (cause) {
    return {ok: false, error: cause instanceof Error ? cause.message : String(cause)}
  }
}

/** The takes of the given sessions, read again as above, with the person's choice (which reads again once the owner answered). */
export function useAttemptTakes(transport: KernelTransportStatus, sessionRefs: readonly string[], projects: SessionProjects): {
  of(sessionRef: string): readonly FactoryTake[] | null
  choose(take: FactoryTake): Promise<unknown>
} | undefined {
  const epoch = useSpineEpoch()
  const [again, readAgain] = useReducer((n: number) => n + 1, 0)
  const [takes, setTakes] = useState<ReadonlyMap<string, readonly FactoryTake[]> | null>(null)
  // Each session with its register: a session placed in another register is read again there.
  const wanted = sessionRefs.map(ref => `${projectFor(projects, ref)}\u0000${ref}`).join('\n')
  const transportKey = JSON.stringify(transport)
  useEffect(() => onOwnerChanged('temporal', () => readAgain()), [])
  useEffect(() => {
    if (transport.kind === 'unavailable') { setTakes(null); return }
    let live = true
    const pairs = wanted ? wanted.split('\n').map(pair => pair.split('\u0000') as [string, string]) : []
    const placed = new Map(pairs.map(([project, ref]) => [ref, project]))
    void readAttemptTakes(carried(transport), ref => placed.get(ref) ?? '', pairs.map(([, ref]) => ref)).then(next => { if (live && next) setTakes(next) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportKey, wanted, epoch, again])
  const of = useCallback((sessionRef: string) => takes?.get(sessionRef) ?? null, [takes])
  const choose = useCallback(async (take: FactoryTake) => {
    const answer = await chooseAttempt(transport, take)
    readAgain()
    return answer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportKey])
  return transport.kind === 'unavailable' ? undefined : {of, choose}
}
