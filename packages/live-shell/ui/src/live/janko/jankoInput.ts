// The Jankó keyboard's one input path (T-LIVE-JANKO-DEVICE). Pointer, touch and computer keyboard produce the same note events; MIDI joins the
// same path in T-LIVE-MIDI. A note is a pitch class and a source. Notes struck within one task are one chord, one owner act; each later task
// is its own act. Nothing here synthesises a sound: a note is sent to the owner, which decides what sounds.
import type {StageCommand, StageResult} from '@epilogos/expressions-boundary'

export type NoteSource = 'pointer' | 'touch' | 'keyboard' | 'midi'
export interface NoteEvent {
  readonly kind: 'down' | 'up'
  readonly pitchClass: number
  readonly source: NoteSource
  /** Pen pressure in (0, 1], where the input carries it. Mouse and touch carry none. */
  readonly pressure?: number | null
}

/** The owner's default strike (controller.playVoices: 0.35 modal metres). Keys without pressure strike at this amplitude. */
export const JANKO_DEFAULT_AMPLITUDE = 0.35

/** Strike amplitude from the input: pen pressure maps to the Studio's own pressure law (0.9 × pressure, clamped to 0.15–0.9); every other
 * input strikes at the owner's default. The amplitude is always inside the owner's (0, 1] bound. */
export function strikeAmplitude(event: Pick<NoteEvent, 'source' | 'pressure'>): number {
  if (event.source === 'pointer' && typeof event.pressure === 'number' && Number.isFinite(event.pressure) && event.pressure > 0 && event.pressure <= 1) {
    return Math.min(0.9, Math.max(0.15, event.pressure * 0.9))
  }
  return JANKO_DEFAULT_AMPLITUDE
}

/** The computer keyboard plays the twelve pitch classes from a conventional piano row. Presentation only: the owner receives pitch classes. */
export const COMPUTER_KEY_PITCH: Readonly<Record<string, number>> = Object.freeze({
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
})

/** Whether a computer-keyboard event may play a note: the keyboard is armed by focus, the target is not editable text, no modifier is held
 * (so undo and the other shortcuts keep their meaning), and the key is not a held repeat. */
export function keyboardGate(input: {armed: boolean; editable: boolean; modifier: boolean; repeat: boolean}): boolean {
  return input.armed && !input.editable && !input.modifier && !input.repeat
}

export interface JankoInputOptions {
  /** The owner's channel: one janko stage command per chord. */
  readonly send: (command: StageCommand) => Promise<StageResult>
  /** Each chord's answer: the owner's refusal names what did not sound. */
  readonly onResult?: (result: StageResult) => void
  /** The keys currently held, after every change. */
  readonly onHeld?: (held: readonly number[]) => void
}

export interface JankoInput {
  down(event: NoteEvent): void
  up(event: NoteEvent): void
  held(): readonly number[]
}

/** One input path for every source. Notes struck in the same task are one chord (one owner act); a later task is a new act. */
export function createJankoInput(options: JankoInputOptions): JankoInput {
  const held = new Set<number>()
  let batch: {classes: Set<number>; amplitude: number} | null = null
  const flush = () => {
    const pending = batch
    batch = null
    if (!pending) return
    const command: StageCommand = {command: 'janko', action: 'play', pitch_classes: [...pending.classes].sort((a, b) => a - b), amplitude: pending.amplitude}
    void options.send(command).then(result => options.onResult?.(result), cause => options.onResult?.({ok: false, error: String(cause instanceof Error ? cause.message : cause)}))
  }
  return {
    down(event) {
      if (!Number.isInteger(event.pitchClass) || event.pitchClass < 0 || event.pitchClass > 11) return
      held.add(event.pitchClass)
      options.onHeld?.([...held].sort((a, b) => a - b))
      const amplitude = strikeAmplitude(event)
      if (batch === null) {
        batch = {classes: new Set([event.pitchClass]), amplitude}
        queueMicrotask(flush)
      } else {
        batch.classes.add(event.pitchClass)
        batch.amplitude = Math.max(batch.amplitude, amplitude)
      }
    },
    up(event) {
      held.delete(event.pitchClass)
      options.onHeld?.([...held].sort((a, b) => a - b))
    },
    held: () => [...held].sort((a, b) => a - b),
  }
}
