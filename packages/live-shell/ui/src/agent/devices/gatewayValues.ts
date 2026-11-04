// The Gateway's values and its link readings (split from designBindings.ts so the frame's first load carries them without the device
// bindings, O-I #740). Pure.
import type {Value, Values} from '../../frame/devices/designed'
import {gatewayDisclosed, type AgentChainReading} from './agentChainDevices'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

export interface GatewayInput {
  readonly reading: Pick<AgentChainReading, 'gateway' | 'gatewayAdmitted' | 'gatewayDoc'>
  readonly harness: {readonly binding: string; readonly resolved: boolean}
}

/** The Gateway's values (§19.2; catalogue/panels/actuation__gateway.tsx:6-13 names its keys): what the harness_agent_read answer
 * discloses under the carrier's own field names (agentChainDevices.ts gatewayDisclosed — readiness, transport, connect; stall_after_seconds;
 * its approvals is Scope's Tool calls, §19.12, scopeValues), the light from whether the gateway answered, its refusal in the owner's words, and the binding's link as AIKit's
 * gateway knows it (gatewayLinkValues: beatAge, running, inflight, frames, seq). The other session counters (epoch, peers, ring, ringCap,
 * viaLead, lead) and autoContinue and fanOut are in no document the shell reads, so they stay absent. */
export function gatewayValues(input: GatewayInput): Values {
  const {reading, harness} = input
  const values: Record<string, Value> = {}
  put(values, 'light', reading.gatewayAdmitted === true ? 'lit' : reading.gatewayAdmitted === false ? 'dark' : undefined)
  if (harness.resolved) put(values, 'harness', harness.binding)
  if (reading.gateway.kind === 'refused') put(values, 'refused', reading.gateway.line)
  for (const [key, value] of Object.entries(gatewayDisclosed(reading.gatewayDoc))) if (key !== 'approvals') put(values, key, value)
  const doc = isObj(reading.gatewayDoc) && !('refused' in reading.gatewayDoc) ? reading.gatewayDoc : null
  if (doc && typeof doc.stall_after_seconds === 'number') put(values, 'stallAfter', doc.stall_after_seconds)
  Object.assign(values, gatewayLinkValues(reading.gatewayDoc))
  return values
}

// The Gateway's link readings (ticket 745, lane AA; actuation__gateway.tsx `beatAge`, `running`, `inflight`, `frames`, `seq`): the kernel's
// harness_agent_read runs `aikit --json gateway agent --binding B sessions` and hands on the envelope's `data` — {binding_ref, operation,
// type: conversation, result} — whose `result.link` is the binding's link as the gateway knows it (ai-kit aikit-adapters
// gateway_conversation_engine.rs `link`): the newest frames of its Stream, each stamped when the gateway journaled it, and how many the
// journal holds; the check-in (the newest frame's instant) and its age by the gateway's own clock; the turns running on the binding's turn
// plane; and the frames in flight (the prompts waiting for the harness and the sends waiting for the connector's receipt).

/** The engine's result in the gateway's answer (`data.result`), or null where the answer is no conversation reading. */
const conversationResult = (doc: unknown): Obj | null => {
  if (!isObj(doc) || 'refused' in doc) return null
  return isObj(doc.result) ? doc.result : null
}
/** The binding's link in the gateway's answer, or null where it carries none. */
export const gatewayLinkOf = (doc: unknown): Obj | null => {
  const link = conversationResult(doc)?.link
  return isObj(link) ? link : null
}
/** A session the answer does not name (the design draws "—"). */
const NONE_WORD = '—'
const count = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined)
/** An instant on this machine's clock, as the Frames page reads one (`HH:MM:SS`, actuation__gateway.tsx clockSecs). */
const clockOf = (unixMs: number): string => {
  const at = new Date(unixMs)
  return [at.getHours(), at.getMinutes(), at.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')
}
/** Which way a frame went, by the door the gateway journaled it through: toward the agent from the surface is a frame the shell sent;
 * from the agent, one it received. */
const LINK_DIRECTION: Readonly<Record<string, 'in' | 'out'>> = {'to-agent': 'out', 'from-agent': 'in'}

/** The link's frames as the Frames page's rows ({seq, dir, kind, session, at, note}): the gateway's own kind (a custom frame by its custom
 * kind), the direction its door names, the instant it was journaled where the gateway stamped it, and how its words open. Pure. */
export function linkFrames(link: Obj, session: string): Record<string, Value>[] {
  return (Array.isArray(link.frames) ? link.frames : []).flatMap((row): Record<string, Value>[] => {
    if (!isObj(row)) return []
    const kind = typeof row.custom_kind === 'string' && row.custom_kind ? row.custom_kind : typeof row.kind === 'string' && row.kind ? row.kind : null
    if (!kind) return []
    const frame: Record<string, Value> = {kind, session}
    put(frame, 'seq', count(row.sequence))
    put(frame, 'dir', typeof row.direction === 'string' ? LINK_DIRECTION[row.direction] : undefined)
    const at = count(row.recorded_at_unix_ms)
    put(frame, 'at', at === undefined ? undefined : clockOf(at))
    put(frame, 'note', typeof row.note === 'string' && row.note ? row.note : undefined)
    return [frame]
  })
}

/** The four link readings and the last sequence, from the gateway's answer; none where it carries no link. A gateway with no frame yet has
 * had no check-in (the design's -1); frames journaled before the gateway stamped them name no check-in, and beatAge stays absent. Pure. */
export function gatewayLinkValues(doc: unknown): Record<string, Value> {
  const link = gatewayLinkOf(doc)
  if (!link) return {}
  const values: Record<string, Value> = {}
  const frames = count(link.frame_count)
  put(values, 'beatAge', count(link.check_in_age_seconds) ?? (frames === 0 ? -1 : undefined))
  put(values, 'running', count(link.turns_running))
  put(values, 'inflight', count(link.frames_in_flight))
  put(values, 'seq', count(link.last_sequence))
  const session = conversationResult(doc)?.agent_session_ref
  values.frames = JSON.stringify(linkFrames(link, typeof session === 'string' && session ? session : NONE_WORD))
  return values
}
