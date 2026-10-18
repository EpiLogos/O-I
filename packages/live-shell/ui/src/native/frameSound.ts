// The Expression's own sound on its mixer row (manual §20.1: "Activator silences the Expression's sound; the picture still plays",
// "Solo lets you hear only this Expression's sound"). The frame hosts the open Expression and holds one object-sound mute for it
// (field-studies-journeys native-field/entitySound.ts), set by its `sound` stage command and reported as `soundMuted`. The
// Activator is the person's own mute; Solo names the one Expression to hear. What the frame is told is both at once: silent when
// the person muted it, or when another Expression is soloed. Pure, apart from the module's two holds.
import type {StageCommand, StageResult} from '@epilogos/expressions-boundary'
import type {FrameTakeLink} from './frameTakes'

let personMuted: boolean | null = null
let soloed: string | null = null

/** Whether the frame's Expression is to be silent: the person's mute, or another Expression soloed. Pure. */
export function soundSilenced(muted: boolean, soloedExpression: string | null, presented: string): boolean {
  return muted || (soloedExpression !== null && soloedExpression !== presented)
}

export interface FrameSoundReading {
  /** The Activator as it stands: the person's mute, else what the frame reports; null while neither says. */
  readonly muted: boolean | null
  readonly soloed: string | null
}

export function frameSoundReading(link: FrameTakeLink): FrameSoundReading {
  return {muted: personMuted ?? link.state?.soundMuted ?? null, soloed}
}

const send = (run: (command: StageCommand) => Promise<StageResult>, presented: string, muted: boolean) =>
  run({command: 'sound', muted: soundSilenced(muted, soloed, presented)})

/** The Activator: mute or unmute the Expression's sound. */
export async function setExpressionMuted(link: FrameTakeLink, presented: string, muted: boolean): Promise<StageResult> {
  if (!link.run) return {ok: false, error: 'No Expressions application is mounted.'}
  const result = await send(link.run, presented, muted)
  if (result.ok) personMuted = muted
  return result
}

/** Solo: hear only this Expression (on), or every Expression again (off, when it is the soloed one). */
export async function setExpressionSolo(link: FrameTakeLink, presented: string, expression: string, on: boolean): Promise<StageResult> {
  if (!link.run) return {ok: false, error: 'No Expressions application is mounted.'}
  const was = soloed
  soloed = on ? expression : soloed === expression ? null : soloed
  const result = await send(link.run, presented, personMuted ?? link.state?.soundMuted ?? false)
  if (!result.ok) soloed = was
  return result
}

/** The holds back to nothing (a test, a world change). */
export function resetFrameSound(): void {
  personMuted = null
  soloed = null
}

// ---------------------------------------------------------------------------------------------------------------- the Studio arm

/** The Expressions transport's Studio arm, as the transport holds it (shell/transports/useExpressionsTransport.tsx): armed, Play
 * records a take. The mixer row's Arm reads and presses this same arm; null while no transport stands. */
let studioArm: {on: boolean; set: (on: boolean) => void} | null = null
const armListeners = new Set<() => void>()
export function publishStudioArm(arm: {on: boolean; set: (on: boolean) => void} | null): void {
  if (arm?.on === studioArm?.on && arm?.set === studioArm?.set) return
  studioArm = arm
  for (const listener of [...armListeners]) listener()
}
export const readStudioArm = () => studioArm
export function subscribeStudioArm(listener: () => void): () => void {
  armListeners.add(listener)
  return () => { armListeners.delete(listener) }
}
