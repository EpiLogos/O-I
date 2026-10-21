// A run as O-I's events (face-rig CREATURE-SPEC.md 25.1; face-rig environ-kit.js documents the kinds), and the run state they leave.
// The stage plays a recording of events. A device that holds a thread (the Agent) turns its rows into the same events, so the stage
// and the creature read one run: the thread says what happened, the stage shows where the run stands and what it has made.
import type {RunState} from './agency'

export interface RunEvent {readonly at: number; readonly kind: string; readonly [key: string]: unknown}
export interface Recording {
  readonly schema: string; readonly what: string
  readonly source: {readonly transcript: string; readonly lines: readonly [number, number]; readonly from: string; readonly to: string}
  readonly beat: number; readonly stallBeats: number; readonly length: number
  readonly counts: Readonly<Record<string, number>>
  readonly events: readonly RunEvent[]
}
/** One row of an agent's thread, as the Agent device holds it. */
export interface ThreadRow {readonly who: string; readonly kind: string; readonly text: string; readonly tool?: string; readonly state?: string}

/** The shell's horizon for a stall: a needle older than this is stalled (agent/agentRunModel.ts HEARTBEAT_HORIZON_MS, 90 s). The beat is the check-in. */
export const BEAT_MS = 15000, STALL_BEATS = 6
const READS = /^(Read|Grep|Glob|LS|WebFetch|WebSearch|NotebookRead)$/i

/** The run state a thread leaves, read from its last row and the needle (`age`: seconds since the last check-in, -1 when there was none). */
export function stateOfThread(rows: readonly ThreadRow[], o: {age: number | undefined; lit: boolean | undefined; horizon?: number}): RunState {
  if (o.lit === false) return 'queued'
  if (o.age === undefined || o.age < 0) return 'queued'
  if (o.age >= (o.horizon ?? 90)) return 'stalled'
  const last = rows[rows.length - 1]
  if (!last) return 'queued'
  if (last.kind === 'proposal') return 'waiting'
  if (last.kind === 'stall') return 'stalled'
  if (last.kind === 'tool') return last.tool && READS.test(last.tool) ? 'thinking' : 'acting'
  return 'thinking'
}

/** A recording of the events a thread's rows stand for, ending `age` seconds after the last check-in. `end` ends the run in a state the rows
 * do not show: done (a check passed and the work landed), failed (the task stopped on an error). */
export function recordingFromThread(rows: readonly ThreadRow[], o: {age?: number; end?: 'done' | 'failed' | 'producing'; what?: string}): Recording {
  const events: RunEvent[] = []
  let at = 0
  const push = (e: {readonly kind: string; readonly [key: string]: unknown}, step = 20000) => { events.push({at, ...e}); at += step }
  push({kind: 'clip', state: 'Queued'}, 6000)
  const started = rows.some(r => r.kind !== 'queued') && !(o.age !== undefined && o.age < 0)
  if (started) {
    push({kind: 'clip', state: 'Running'}, 0)
    push({kind: 'run', state: 'started'}, 6000)
    for (const r of rows) {
      if (r.kind === 'tool') {
        if (r.tool && READS.test(r.tool)) push({kind: 'knowledge', subject_ref: r.text})
        else push({kind: 'generation', subject_ref: r.text})
      } else if (r.kind === 'agent' || r.kind === 'ask') push({kind: 'thought'})
      else if (r.kind === 'proposal') { push({kind: 'return', subject_ref: r.tool ?? r.text, output: r.text}, 4000); push({kind: 'approval', state: 'requested'}) }
      else if (r.kind === 'stall') push({kind: 'clip', state: 'Stalled'}, 0)
    }
  }
  if (o.end === 'producing') push({kind: 'return', subject_ref: 'the change', output: 'the change'})
  if (o.end === 'done') { push({kind: 'return', subject_ref: 'the change', output: 'the change'}, 6000); push({kind: 'check', state: 'pass'}, 6000); push({kind: 'ledger', outcome: 'Landed'}, 6000); push({kind: 'clip', state: 'Done'}) }
  if (o.end === 'failed') push({kind: 'clip', state: 'Stopped', error: true})
  // a needle that stopped: the stall is read from the clock, which runs on past the last event
  if (o.age !== undefined && o.age >= 90 && !events.some(e => e.kind === 'clip' && e.state === 'Stalled')) events.push({at: at - 20000 + o.age * 1000, kind: 'clip', state: 'Stalled'})
  const length = (events[events.length - 1]?.at ?? 0) + 2000
  return {schema: 'face-rig.recorded-run/v1', what: o.what ?? 'a thread, as O-I events', source: {transcript: 'the agent\'s thread', lines: [0, rows.length], from: '', to: ''},
    beat: BEAT_MS, stallBeats: STALL_BEATS, length, counts: {}, events}
}
