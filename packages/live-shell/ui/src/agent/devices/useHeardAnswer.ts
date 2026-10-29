// Whether the agent heard the line you sent in Messages (DLW §19.24; O-I #741): AIKit's desk read of that one Communique by the ref its
// send answered, `aikit gateway heard C --json` (aikit.communique-heard/v1), which the kernel runs as inhabitation_read {kind:
// communique} (desktop/cradle/kernel/src/inhabitation.rs Request::Communique) — the delivery standing, never the words. Read with the
// cradle's own inhabitation read (desktop/cradle/src/contributions/factory/inhabitation/reads.ts readCommuniqueHeard) and held for the
// window under the spine's epoch, as the conversation is (useConversationAnswer.ts).
//
// The gateway's journal moves when the occupant takes the line at its next boundary, and the kernel watches no journal, so no notice
// says it moved: while the line is not heard the reading is asked again every HEARD_POLL_MS, and once heard it is left standing.
import {useEffect, useMemo} from 'react'
import {readCommuniqueHeard} from '../../../../../../desktop/cradle/src/contributions/factory/inhabitation/reads'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {useOwnerReading} from '../../owners/ownerReading'
import {useSpineEpoch} from '../../owners/spine'

export const HEARD_OP = 'inhabitation_read'
/** How often a line not yet heard is read again. */
export const HEARD_POLL_MS = 4_000

export interface HeardAnswer {
  readonly ref: string
  readonly status: 'reading' | 'answered' | 'refused'
  readonly value?: unknown
  readonly error?: string
}

/** Whether a heard reading says the line was heard (`heard: true`); false while it waits, undefined while unread. Pure. */
export const heardOf = (value: unknown): boolean | undefined =>
  value && typeof value === 'object' && typeof (value as {heard?: unknown}).heard === 'boolean' ? (value as {heard: boolean}).heard : undefined

/** AIKit's heard reading of the Communique `ref` (none read for no ref). `register` is a register (agent/worldScope.ts): your world's root
 * register ('' or null) names no project. */
export function useHeardAnswer(transport: KernelTransportStatus, register: string | null, ref: string | null): HeardAnswer | undefined {
  const project = register || undefined
  const epoch = useSpineEpoch()
  const carried = transport.kind !== 'unavailable'
  const key = carried && ref ? JSON.stringify([HEARD_OP, transport, 'communique', project ?? null, ref]) : null
  const {reading, refresh} = useOwnerReading(key, async () => {
    const read = await readCommuniqueHeard(transport, ref!, project)
    return read.state === 'read' ? {value: read.data as unknown} : {error: `${read.source}: ${read.reason}`}
  }, epoch)
  const heard = heardOf(reading.value)
  useEffect(() => {
    if (!key || heard === true || reading.status === 'refused') return
    const timer = setInterval(refresh, HEARD_POLL_MS)
    return () => clearInterval(timer)
  }, [key, heard, reading.status, refresh])
  return useMemo(() => (ref && key ? {ref, status: reading.status, ...(reading.value !== null && reading.value !== undefined ? {value: reading.value} : {}),
    ...(reading.error ? {error: reading.error} : {})} : undefined), [ref, key, reading])
}
