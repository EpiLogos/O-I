// The Jankó keyboard's one input path (T-LIVE-JANKO-DEVICE). Pointer, touch and computer keyboard produce the same note events; MIDI joins the
// same path from the native host (liveMidi.ts, T-LIVE-MIDI). A note is a pitch class and a source. Notes struck within one task are one chord, one owner act; each later task
// is its own act. Nothing here synthesises a sound: a note is sent to the owner, which decides what sounds.
import type {StageCommand, StageResult} from '@epilogos/expressions-boundary'

export type NoteSource = 'pointer' | 'touch' | 'keyboard' | 'midi'
export interface NoteEvent {
  readonly kind: 'down' | 'up'
  readonly pitchClass: number
  readonly source: NoteSource
  /** Pen pressure in (0, 1], where the input carries it. Mouse and touch carry none. */
  readonly pressure?: number | null
  /** MIDI note-on velocity over 127, in (0, 1]. A MIDI note strikes at it in place of pressure; no other source carries it. */
  readonly velocity?: number | null
  /** The press's own identity: a pointer id, a MIDI port, channel and note, a computer key. A pitch class stays held while any press holds it,
   * so two touch-points of one class (the Jankó surface repeats each class) release independently. Absent: one press per source and class. */
  readonly press?: string
}

/** The owner's default strike (controller.playVoices: 0.35 modal metres). Keys without pressure strike at this amplitude. */
export const JANKO_DEFAULT_AMPLITUDE = 0.35

/** Strike amplitude from the input: a MIDI note strikes at its velocity over 127 (in place of pressure); pen pressure maps to the Studio's own
 * pressure law (0.9 × pressure, clamped to 0.15–0.9); every other input strikes at the owner's default. The amplitude is always inside the
 * owner's (0, 1] bound. */
export function strikeAmplitude(event: Pick<NoteEvent, 'source' | 'pressure' | 'velocity'>): number {
  if (event.source === 'midi') {
    return typeof event.velocity === 'number' && Number.isFinite(event.velocity) && event.velocity > 0 && event.velocity <= 1 ? event.velocity : JANKO_DEFAULT_AMPLITUDE
  }
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
  /** The note-device chain (T-LIVE-MODE-SCALES item 3): one act's pitch classes, in, and the classes sent, out. Applied to each act before
   * its stage command, whatever the source. Absent is the identity. */
  readonly transform?: (pitchClasses: readonly number[]) => readonly number[]
}

export interface JankoInput {
  down(event: NoteEvent): void
  up(event: NoteEvent): void
  held(): readonly number[]
}

/** One input path for every source. Notes struck in the same task are one chord (one owner act); a later task is a new act. */
export function createJankoInput(options: JankoInputOptions): JankoInput {
  // Each press, by its identity, to the class it holds. A class is held while any press holds it.
  const presses = new Map<string, number>()
  const heldClasses = () => [...new Set(presses.values())].sort((a, b) => a - b)
  const pressId = (event: NoteEvent) => `${event.source}:${event.press ?? event.pitchClass}`
  let batch: {classes: Set<number>; amplitude: number} | null = null
  const flush = () => {
    const pending = batch
    batch = null
    if (!pending) return
    const classes = [...pending.classes].sort((a, b) => a - b)
    const played = options.transform ? [...new Set(options.transform(classes))].sort((a, b) => a - b) : classes
    if (played.length === 0) return
    const command: StageCommand = {command: 'janko', action: 'play', pitch_classes: played, amplitude: pending.amplitude}
    void options.send(command).then(result => options.onResult?.(result), cause => options.onResult?.({ok: false, error: String(cause instanceof Error ? cause.message : cause)}))
  }
  return {
    down(event) {
      if (!Number.isInteger(event.pitchClass) || event.pitchClass < 0 || event.pitchClass > 11) return
      const id = pressId(event)
      if (presses.get(id) === event.pitchClass) return
      presses.set(id, event.pitchClass)
      options.onHeld?.(heldClasses())
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
      if (!presses.delete(pressId(event))) return
      options.onHeld?.(heldClasses())
    },
    held: heldClasses,
  }
}
