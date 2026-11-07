// The Expression's own sound on its mixer row (manual §20.1 The mixer row: "Volume | The level of the Expression's sound"; "Activator | The
// Expression plays, or it does not. Off, its scenes do not launch, and its track is dimmed"; "Solo | Lets you hear only this Expression's
// sound"). Round 885 (DLW build ruling 2026-11-06): Volume, the Main level and the Activator are the Expression's own, kept in its document
// as a Live Set keeps its mixer; the row reads them from the scenes reading (`mix`) and writes them through the owner's `mix` scene edit.
// Solo and the frame's mute here (its "Mute all object sound here", which the Field's Sound sets: "Lets the field sound. The picture stays
// when sound is off", §20.2) are what is heard, not what plays: the frame's `sound` command carries them (`silenced`, `muted`), nothing
// saves them, and neither reads as the Activator. Pure, apart from the module's one hold (the soloed Expression).
import type {StageCommand, StageResult} from '@epilogos/expressions-boundary'
import type {FrameTakeLink} from './frameTakes'

let soloed: string | null = null

/** Whether the open Expression is silenced by Solo: another Expression is the soloed one. Pure. */
export function soloSilenced(soloedExpression: string | null, presented: string): boolean {
  return soloedExpression !== null && soloedExpression !== presented
}

/** The Expression's mixer as its scenes reading discloses it (boundary scenes.ts `mix`). */
export interface ExpressionMixReading {readonly level: number; readonly main: number; readonly active: boolean}

export interface FrameSoundReading {
  /** The Activator, as the Expression's document keeps it; null while no mixer has been read. */
  readonly active: boolean | null
  readonly soloed: string | null
  /** XS15: the Expression's level and the Main level its document keeps (linear gain, 0 to 2); null while no mixer has been read. */
  readonly level: number | null
  readonly main: number | null
  /** The frame's mute here, as the frame reports it (`soundMuted`): what is heard, never the Activator; null while it has not reported. */
  readonly muted: boolean | null
}

export function frameSoundReading(link: FrameTakeLink, mix: ExpressionMixReading | null | undefined): FrameSoundReading {
  return {active: mix?.active ?? null, soloed, level: mix?.level ?? null, main: mix?.main ?? null, muted: link.state?.soundMuted ?? null}
}

/** The owner's `mix` scene edit of the open Expression (boundary sceneEdits.ts), or null where none is taken. */
export type ExpressionMixEdit = ((intent: {operation: 'mix'; set: {level?: number; main?: number; active?: boolean}}) => Promise<{ok: boolean; error?: string}>) | null
const NO_MIX: StageResult = {ok: false, error: 'The open Expression\'s owner takes no mixer settings here.'}

/** The Activator: the Expression plays, or it does not — kept in its document. */
export async function setExpressionActive(edit: ExpressionMixEdit, on: boolean): Promise<{ok: boolean; error?: string}> {
  return edit ? edit({operation: 'mix', set: {active: on}}) : NO_MIX
}
/** XS15: the Expression's sound level (Volume on its track), kept in its document. */
export async function setExpressionLevel(edit: ExpressionMixEdit, gain: number): Promise<{ok: boolean; error?: string}> {
  return edit ? edit({operation: 'mix', set: {level: gain}}) : NO_MIX
}
/** XS15: the Main level (Volume on the Main track): every Expression's sound together, kept in the document with the rest of its mixer. */
export async function setMainLevel(edit: ExpressionMixEdit, gain: number): Promise<{ok: boolean; error?: string}> {
  return edit ? edit({operation: 'mix', set: {main: gain}}) : NO_MIX
}

const NO_FRAME: StageResult = {ok: false, error: 'No Expressions application is mounted.'}

/** Solo: hear only this Expression (on), or every Expression again (off, when it is the soloed one). The frame hears its Expression
 * silenced while another is soloed. */
export async function setExpressionSolo(link: FrameTakeLink, presented: string, expression: string, on: boolean): Promise<StageResult> {
  if (!link.run) return NO_FRAME
  const was = soloed
  soloed = on ? expression : soloed === expression ? null : soloed
  const result = await link.run({command: 'sound', silenced: soloSilenced(soloed, presented)} satisfies StageCommand)
  if (!result.ok) soloed = was
  return result
}

/** The Field's Sound: the frame's mute here, on or off (it reports it back as `soundMuted`). Not the Activator: the Expression plays on. */
export async function setFieldSoundMuted(link: FrameTakeLink, muted: boolean): Promise<StageResult> {
  return link.run ? link.run({command: 'sound', muted}) : NO_FRAME
}

/** The hold back to nothing (a test, a world change). */
export function resetFrameSound(): void {
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
