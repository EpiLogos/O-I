// Live's mixer in the one engine (O-I #849). The desktop's audio path hosts live-engine (the owner: desktop/cradle/src-tauri/src/
// live_engine_host.rs over packages/live-engine); these are its owner ops, and nothing here keeps a mixer of its own:
//   live_engine_open {path}    bridge the set into the engine (no sound)
//   live_engine_play / _stop   start / stop the engine on the default output
//   live_engine_send {event}   a note, Panic, or a mixer move — applied at the next audio block
//   live_engine_mixer          the reading: the mixer as the engine APPLIED it (a move asked is not in it until a block applied it)
//   live_engine_export {path}  Export Audio: the samples the engine played, rendered offline, as a 32-bit float WAV
// The set's own mixer writes (live/liveWrites.ts liveSetWrites: Activator, Solo, a send) land in the .als through the set's owner and,
// while the engine plays that set, follow into it as the same move, so what you hear moves without the set being bridged again; Play
// bridges the file as it then stands. The engine runs in the native candidate only; elsewhere each act refuses, naming its op.
import {useSyncExternalStore} from 'react'
import {detectTransport, tauriInvoke} from '../../../../../desktop/cradle/src/kernel/bridge'
import {readSet} from '../native/application'
import {readSetSummary} from '../shell/useSet'

/** A part as the engine names it: one of the set's parts, one of its returns, or the Main track. */
export type LiveEnginePart = {track: number} | {return: number} | 'main'
export type LiveEngineEvent =
  | {kind: 'note_on'; track: number; key: number; velocity: number}
  | {kind: 'note_off'; track: number; key: number}
  | {kind: 'panic'}
  | {kind: 'volume'; part: LiveEnginePart; gain: number}
  | {kind: 'pan'; part: LiveEnginePart; pan: number}
  | {kind: 'send'; track: number; send: number; gain: number}
  | {kind: 'active'; part: LiveEnginePart; on: boolean}
  | {kind: 'solo'; track: number; on: boolean}

/** One part's mixer as the engine applied it (gain and sends linear, pan −1…1). */
export interface LiveEnginePartMix {name: string; gain: number; pan: number; active: boolean; solo: boolean; sends: number[]; midi: boolean}
export interface LiveEngineReading {
  path: string
  sample_rate: number
  /** Frames the engine has played. */
  position: number
  playing: boolean
  /** What the bridge could not host, in its words (an unhosted device, a group, an audio part's clips). */
  warnings: string[]
  mixer: {tracks: LiveEnginePartMix[]; returns: LiveEnginePartMix[]; main: LiveEnginePartMix}
}
export interface LiveEngineExport {path: string; frames: number; events: number; complete: boolean}

export const LIVE_ENGINE_OPS = ['live_engine_open', 'live_engine_play', 'live_engine_stop', 'live_engine_send', 'live_engine_mixer', 'live_engine_export'] as const
type LiveEngineOp = typeof LIVE_ENGINE_OPS[number]

const words = (e: unknown) => typeof e === 'string' ? e : e instanceof Error ? e.message : String(e)

async function op<T>(command: LiveEngineOp, args: Record<string, unknown> = {}): Promise<T> {
  if (detectTransport().kind !== 'tauri') throw new Error(`The Live engine plays in the desktop's audio path, the native candidate's; it is out of reach here (${command})`)
  try { return await tauriInvoke<T>(command, args) } catch (e) { throw new Error(words(e)) }
}

/** The part the engine hosts for the set's part `index` (the set owner's index: its parts, returns and groups in order, then the Main
 * track), from the set's kinds when the engine bridged it; null for a group, which the engine does not host. */
export function enginePartOf(kinds: readonly string[], index: number): LiveEnginePart | null {
  const before = (match: (kind: string) => boolean) => kinds.slice(0, index).filter(match).length
  const kind = kinds[index]
  if (kind === 'master') return 'main'
  if (kind === 'return') return {return: before(k => k === 'return')}
  if (PART_KINDS.has(kind)) return {track: before(k => PART_KINDS.has(k))}
  return null
}
/** The set's kinds the engine hosts as parts (an audio or a MIDI part). */
const PART_KINDS: ReadonlySet<string> = new Set(['audio', 'midi'])

/** The engine's move for one of the set's mixer writes; null where the write changes nothing the engine plays (Arm, Monitor) or the
 * engine has no such move (a return's solo or sends, a group). */
export function engineEventOfMixerWrite(kinds: readonly string[], track: number, control: string, value: unknown): LiveEngineEvent | null {
  const part = enginePartOf(kinds, track)
  if (!part || typeof value !== 'boolean') return null
  if (control === 'activator') return {kind: 'active', part, on: value}
  if (control === 'solo' && typeof part === 'object' && 'track' in part) return {kind: 'solo', track: part.track, on: value}
  return null
}

export function engineEventOfSendWrite(kinds: readonly string[], track: number, index: number, gain: number): LiveEngineEvent | null {
  const part = enginePartOf(kinds, track)
  return part && typeof part === 'object' && 'track' in part ? {kind: 'send', track: part.track, send: index, gain} : null
}

interface EngineState {
  readonly reading: LiveEngineReading | null
  /** The set's part kinds when the engine bridged it: the index space the set's writes name. */
  readonly kinds: readonly string[]
  /** The engine's last refusal, in its words. */
  readonly error: string | null
}
let state: EngineState = {reading: null, kinds: [], error: null}
const listeners = new Set<() => void>()
let poll: ReturnType<typeof setInterval> | null = null
/** While the engine plays, its reading is read again this often (ms): a move shows once a block applied it. */
export const LIVE_ENGINE_READ_MS = 250

function settle(next: Partial<EngineState>) {
  state = {...state, ...next}
  const playing = !!state.reading?.playing
  if (playing && !poll) poll = setInterval(() => void liveEngine.read().catch(() => {}), LIVE_ENGINE_READ_MS)
  if (!playing && poll) { clearInterval(poll); poll = null }
  for (const listener of [...listeners]) listener()
}
async function adopt<T extends LiveEngineReading>(answer: Promise<T>): Promise<T> {
  try { const reading = await answer; settle({reading, error: null}); return reading } catch (e) { settle({error: words(e)}); throw e }
}

/** The engine's acts, each through its owner op; each answers the engine's reading (Export, what it wrote). */
export const liveEngine = {
  /** Play the set at `path`: bridge it as the file now stands (unless the engine already plays it), then start the output. The set's
   * part kinds come from its owner's reading (`read`, the shell's own by default). */
  async play(path: string, read: (path: string) => Promise<{summary: unknown}> = readSet): Promise<LiveEngineReading> {
    if (state.reading?.path === path && state.reading.playing) return state.reading
    const summary = readSetSummary((await read(path)).summary)
    await adopt(op<LiveEngineReading>('live_engine_open', {path}))
    settle({kinds: summary.tracks.map(track => track.kind)})
    return adopt(op<LiveEngineReading>('live_engine_play'))
  },
  stop: (): Promise<LiveEngineReading> => adopt(op<LiveEngineReading>('live_engine_stop')),
  send: (event: LiveEngineEvent): Promise<LiveEngineReading> => adopt(op<LiveEngineReading>('live_engine_send', {event})),
  read: (): Promise<LiveEngineReading> => adopt(op<LiveEngineReading>('live_engine_mixer')),
  /** Export Audio to an absolute `.wav` path: the samples the engine played since Play. */
  exportAudio: (out: string): Promise<LiveEngineExport> => op<LiveEngineExport>('live_engine_export', {path: out}),
}

/** One of the set's mixer writes, followed into the engine while it plays that set (nothing otherwise: Play bridges the file). */
export async function followInEngine(path: string, event: (kinds: readonly string[]) => LiveEngineEvent | null): Promise<void> {
  if (state.reading?.path !== path || !state.reading.playing) return
  const move = event(state.kinds)
  if (!move) return
  try { await liveEngine.send(move) } catch (e) { throw new Error(`The set keeps it; the engine refused it: ${words(e)}`) }
}

export const liveEngineState = (): EngineState => state
export function subscribeLiveEngine(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
/** The engine's reading and refusal as it stands (the applied mixer, never a move asked). */
export function useLiveEngine(): EngineState {
  return useSyncExternalStore(subscribeLiveEngine, liveEngineState, liveEngineState)
}
