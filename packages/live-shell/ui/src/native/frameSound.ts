// The Expression's own sound on its mixer row (manual §20.1 The mixer row: "Volume | The level of the Expression's sound"; "Activator | The
// Expression plays, or it does not. Off, its scenes do not launch, and its track is dimmed"; "Solo | Lets you hear only this Expression's
// sound"). Round 885 (DLW build ruling 2026-11-06): Volume, the Main level and the Activator are the Expression's own, kept in its document
// as a Live Set keeps its mixer; the row reads them from the scenes reading (`mix`) and writes them through the owner's `mix` scene edit.
// Round 886 (DLW build ruling 2026-11-06, the lead's derivation: the mixer row maps Live's controls, DLW.md:8919–8929, and a Live Set keeps
// its solo states): Solo is kept there too. What Solo is heard as stays the frame's: while another open Expression is soloed and this one is
// not, its frame hears it silenced (Live's law), told once per change by the frame's `sound` command (`silenced`). Which open Expressions
// are soloed is read from the owner's works list (its `solo` flag) and from each presented scenes reading. The frame's mute here (its "Mute
// all object sound here", which the Field's Sound sets: "Lets the field sound. The picture stays when sound is off", §20.2) is what is
// heard, not what plays: nothing saves it, and it never reads as the Activator. Pure, apart from the module's holds (the Solo each open
// Expression was last read with, and what the frame was last told).
import type {StageCommand, StageResult} from '@epilogos/expressions-boundary'
import type {FrameTakeLink} from './frameTakes'

/** The Solo each open Expression was last read with, by its ref. */
const soloOf = new Map<string, boolean>()
/** What the frame was last told: its link's runner, the Expression it presented and whether it hears it silenced. */
let told: {run: FrameTakeLink['run']; presented: string; silenced: boolean} | null = null

/** Whether `presented` is silenced by Solo (Live's law): another open Expression is soloed and it is not. A closed work sounds nowhere.
 * Pure. */
export function soloSilencedBy(works: readonly {readonly expression_ref: string; readonly open?: boolean; readonly solo?: boolean}[], presented: string,
  ownSolo: boolean | null): boolean {
  return ownSolo !== true && works.some(work => work.open !== false && work.solo === true && work.expression_ref !== presented)
}

/** The owner's works list as published (components/nativeExpressionCommands.ts enumerateWorks): each open work's Solo as the owner keeps
 * it; a work no longer open is forgotten. */
export function noteWorksSolo(works: readonly {readonly expression_ref: string; readonly open?: boolean; readonly solo?: boolean}[]): void {
  for (const work of works) if (work.open === false) soloOf.delete(work.expression_ref); else soloOf.set(work.expression_ref, work.solo === true)
}
/** One Expression's Solo as its scenes reading (or the owner's answer to the row's press) says it. */
export function noteSolo(expression: string, solo: boolean): void { soloOf.set(expression, solo) }

/** Tell the frame whether it hears its presented Expression silenced, once per change: null when nothing changed or no frame presents
 * an Expression, else the frame's answer. */
export async function syncSoloSilenced(link: FrameTakeLink): Promise<StageResult | null> {
  const presented = link.state?.nativeScene?.expression_ref
  if (!link.run || !presented) return null
  const silenced = soloSilencedBy([...soloOf].map(([expression_ref, solo]) => ({expression_ref, solo})), presented, soloOf.get(presented) ?? null)
  if (told && told.run === link.run && told.presented === presented && told.silenced === silenced) return null
  const was = told
  told = {run: link.run, presented, silenced}
  const result = await link.run({command: 'sound', silenced} satisfies StageCommand)
  if (!result.ok) told = was
  return result
}

/** The Expression's mixer as its scenes reading discloses it (boundary scenes.ts `mix`); a frame from before Solo says none. */
export interface ExpressionMixReading {readonly level: number; readonly main: number; readonly active: boolean; readonly solo?: boolean}

export interface FrameSoundReading {
  /** The Activator and Solo, as the Expression's document keeps them; null while no mixer has been read. */
  readonly active: boolean | null
  readonly solo: boolean | null
  /** XS15: the Expression's level and the Main level its document keeps (linear gain, 0 to 2); null while no mixer has been read. */
  readonly level: number | null
  readonly main: number | null
  /** The frame's mute here, as the frame reports it (`soundMuted`): what is heard, never the Activator; null while it has not reported. */
  readonly muted: boolean | null
}

export function frameSoundReading(link: FrameTakeLink, mix: ExpressionMixReading | null | undefined): FrameSoundReading {
  return {active: mix?.active ?? null, solo: mix ? mix.solo === true : null, level: mix?.level ?? null, main: mix?.main ?? null, muted: link.state?.soundMuted ?? null}
}

/** The owner's `mix` scene edit of the open Expression (boundary sceneEdits.ts), or null where none is taken. Solo off is its default,
 * so the document keeps none (null). */
export type ExpressionMixIntent = {operation: 'mix'; set: {level?: number; main?: number; active?: boolean; solo?: true | null}}
export type ExpressionMixEdit = ((intent: ExpressionMixIntent) => Promise<{ok: boolean; error?: string}>) | null
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
/** Solo: hear only this Expression (on), or every Expression again (off) — kept in its document (round 886). */
export async function setExpressionSolo(edit: ExpressionMixEdit, on: boolean): Promise<{ok: boolean; error?: string}> {
  return edit ? edit({operation: 'mix', set: {solo: on ? true : null}}) : NO_MIX
}

const NO_FRAME: StageResult = {ok: false, error: 'No Expressions application is mounted.'}

/** The Field's Sound: the frame's mute here, on or off (it reports it back as `soundMuted`). Not the Activator: the Expression plays on. */
export async function setFieldSoundMuted(link: FrameTakeLink, muted: boolean): Promise<StageResult> {
  return link.run ? link.run({command: 'sound', muted}) : NO_FRAME
}

/** The holds back to nothing (a test, a world change). */
export function resetFrameSound(): void {
  soloOf.clear()
  told = null
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
