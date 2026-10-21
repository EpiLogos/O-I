// The conversation of the agent open in Messages (DLW §19.24 "Select an agent and its conversation fills the pane"; lane W1-Factory): AIKit's
// journal of Communiques, `aikit gateway conversation --position P --with W --json`, which the kernel runs as inhabitation_read {kind:
// conversation, position, with} (desktop/cradle/kernel/src/inhabitation.rs Request::Conversation; its records checked as
// aikit.communique/v1), read with the cradle's own read (desktop/cradle/src/contributions/factory/inhabitation/reads.ts readConversation) and
// held once for the window under the spine's epoch, as the population is (usePopulationAnswer.ts).
//
// A conversation names both Positions, and the desktop is never an occupant (inhabitation.rs: "Both Positions are named explicitly"), so no
// Position stands for you here: the agent's conversation is every Communique to and from its Position, read pair by pair with each other
// Position of the population, one after another (the Factory Live view reads its cast's pairs the same way: live/producer.ts). Every pair
// must answer; one refusal is the reading's refusal, in the owner's words, never a conversation with a gap in it.
import {useMemo} from 'react'
import {readConversation} from '../../../../../../desktop/cradle/src/contributions/factory/inhabitation/reads'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {useOwnerReading} from '../../owners/ownerReading'
import {useSpineEpoch} from '../../owners/spine'
import type {WorkcellAnswer} from './workcellBindings'

export const CONVERSATION_OP = 'inhabitation_read'

/** The Communiques of every pair, once each (a record is in both of its Positions' journals), in the journal's order. */
export function mergeConversations(position: string, readings: readonly unknown[]): {position_ref: string; communiques: unknown[]} {
  const byRef = new Map<string, Record<string, unknown>>()
  for (const reading of readings) {
    const records = reading && typeof reading === 'object' && Array.isArray((reading as {communiques?: unknown}).communiques) ? (reading as {communiques: unknown[]}).communiques : []
    for (const record of records) {
      if (!record || typeof record !== 'object') continue
      const ref = (record as {communique_ref?: unknown}).communique_ref
      if (typeof ref === 'string' && !byRef.has(ref)) byRef.set(ref, record as Record<string, unknown>)
    }
  }
  const at = (record: Record<string, unknown>) => (typeof record.sent_at_unix_ms === 'number' ? record.sent_at_unix_ms : Number.POSITIVE_INFINITY)
  const order = (record: Record<string, unknown>) => (typeof record.sequence === 'number' ? record.sequence : Number.POSITIVE_INFINITY)
  return {position_ref: position, communiques: [...byRef.values()].sort((a, b) => (at(a) - at(b)) || (order(a) - order(b)))}
}

/** The open agent's conversation: null `position` reads nothing (no agent is open). */
export function useConversationAnswer(transport: KernelTransportStatus, project: string, position: string | null, others: readonly string[]): WorkcellAnswer {
  const epoch = useSpineEpoch()
  const carried = transport.kind !== 'unavailable'
  const withs = useMemo(() => others.filter(other => other !== position), [others, position])
  const key = carried && position && withs.length ? JSON.stringify([CONVERSATION_OP, transport, 'conversation', project, position, withs]) : null
  const {reading} = useOwnerReading(key, async () => {
    const readings: unknown[] = []
    for (const other of withs) {
      const read = await readConversation(transport, position!, other, project)
      if (read.state !== 'read') return {error: `${read.source}: ${read.reason}`}
      readings.push(read.data)
    }
    return {value: mergeConversations(position!, readings) as unknown}
  }, epoch)
  const reason = transport.kind === 'unavailable' ? transport.reason : null
  return useMemo((): WorkcellAnswer => (reason !== null ? {status: 'refused', value: null, error: `the kernel carrier is unavailable: ${reason}`}
    : !key ? {status: 'reading', value: null, error: null}
      : {status: reading.status, value: reading.value, error: reading.error}), [reason, key, reading])
}
