/**
 * The voice's loudness, for the face's mouth (DLW §19.21 Voice, Mouth: Loudness). The local body (Kokoro-82M, through the kernel op
 * nara_voice) measures no timing: no phone, no word reaches the face. So the mouth follows the one thing the sound itself gives — how
 * loud it is now. A voice plays here through an AnalyserNode; each frame its loudness, 0..1, goes on one small bus; the face
 * (FaceStage.tsx useFaceMouth) follows the bus while a voice plays, and nothing else reads it. Nothing here invents a phone or a
 * viseme: a loudness can open the jaw and part the lips, and that is all the face is asked to do with it.
 *
 * The loudness is measured against the utterance's own speaking level (its loud frames, read once from the decoded sound before it
 * plays), so the mouth opens as far for a quiet voice as for a loud one, and closes between syllables by the dip in the sound.
 * The sound itself is delayed a little behind the meter (MOUTH_LEAD_MS): the face's own springs take that long to open the jaw, so
 * the mouth arrives with the syllable rather than after it.
 */

/** The voice's loudness now, 0..1; null while no voice plays. */
export type VoiceLevel = number | null

const listeners = new Set<(level: VoiceLevel) => void>()
let current: VoiceLevel = null

/** The loudness on the bus now. */
export const voiceLevel = (): VoiceLevel => current

/** Follow the bus: the listener hears every new level, then null when the voice stops. */
export function subscribeVoiceLevel(listener: (level: VoiceLevel) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Put a level on the bus (the player does; a test may). */
export function publishVoiceLevel(level: VoiceLevel): void {
  const next = level === null ? null : clamp01(level)
  if (next === current) return
  current = next
  for (const listener of [...listeners]) listener(next)
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0)

/** The root mean square of one frame of samples (−1..1). */
export function rmsOf(samples: ArrayLike<number>): number {
  const n = samples.length
  if (!n) return 0
  let sum = 0
  for (let i = 0; i < n; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / n)
}

/** How many decibels under the speaking level the mouth is shut. */
export const LOUDNESS_RANGE_DB = 30
/** The curve over that range: a syllable's dip of half the range closes the mouth to a quarter, so the jaw moves with each syllable
 * instead of hovering half open through the words. */
export const LOUDNESS_CURVE = 2

/** Loudness, 0..1, of a frame's RMS against the utterance's speaking level: 1 at that level and over, 0 at LOUDNESS_RANGE_DB under. */
export function loudnessOf(rms: number, reference: number): number {
  if (!(rms > 0) || !(reference > 0)) return 0
  const db = 20 * Math.log10(rms / reference)
  return Math.pow(clamp01(1 + db / LOUDNESS_RANGE_DB), LOUDNESS_CURVE)
}

/** The frame the speaking level is read over, and the share of voiced frames under it: the level is the 90th percentile of the
 * voiced frames' RMS (a frame over −50 dBFS is voiced), so a single plosive peak does not set it. */
const REFERENCE_FRAME_MS = 20
const VOICED_RMS = 10 ** (-50 / 20)
export function referenceLevel(samples: ArrayLike<number>, sampleRate: number): number {
  const size = Math.max(1, Math.round((sampleRate * REFERENCE_FRAME_MS) / 1000))
  const frames: number[] = []
  for (let start = 0; start + size <= samples.length; start += size) {
    let sum = 0
    for (let i = start; i < start + size; i++) sum += samples[i] * samples[i]
    const rms = Math.sqrt(sum / size)
    if (rms > VOICED_RMS) frames.push(rms)
  }
  if (!frames.length) return 0
  frames.sort((a, b) => a - b)
  return frames[Math.min(frames.length - 1, Math.floor(frames.length * 0.9))]
}

/** How fast the level follows the sound: opening quickly, closing a little slower, as a jaw does. */
export const ATTACK_MS = 18
export const RELEASE_MS = 70
/** One step of the follower: the level `dtMs` after `previous`, moving toward `target`. */
export function follow(previous: number, target: number, dtMs: number): number {
  if (!(dtMs > 0)) return previous
  const tau = target > previous ? ATTACK_MS : RELEASE_MS
  return previous + (target - previous) * (1 - Math.exp(-dtMs / tau))
}

/** How far the meter reads ahead of what is heard: the sound is delayed this long behind the AnalyserNode, the time the face's jaw
 * takes to answer a change (face-core.js faceTick: the jaw eases at dt/55 ms, the lips' muscles on their springs). */
export const MOUTH_LEAD_MS = 60

/** The few Web Audio parts the player uses (a real AudioContext has them; a test passes its own). */
export interface VoiceAudio {
  readonly currentTime: number
  readonly destination: unknown
  createBufferSource(): {buffer: unknown; connect(node: unknown): unknown; start(when?: number): void; stop(): void; onended: ((event: Event) => unknown) | null}
  createAnalyser(): {fftSize: number; connect?(node: unknown): unknown; getFloatTimeDomainData(array: Float32Array): void}
  createDelay(max?: number): {delayTime: {value: number}; connect(node: unknown): unknown}
}
/** A decoded sound: its first channel and its rate. */
export interface VoiceSound {
  readonly duration: number
  readonly sampleRate: number
  getChannelData(channel: number): Float32Array
}
/** A frame clock: calls back once on the next frame with its time in ms; returns a cancel. */
export type FrameClock = (frame: (nowMs: number) => void) => () => void

const animationFrames: FrameClock = frame => {
  if (typeof requestAnimationFrame !== 'function') { const t = setTimeout(() => frame(performance.now()), 16); return () => clearTimeout(t) }
  const id = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(id)
}

/** A voice playing: it ends by itself (`ended`), or when stopped. */
export interface VoicePlayback {
  /** Resolves when the sound has ended — played out or stopped. */
  readonly ended: Promise<void>
  /** Stop the sound now (a barge-in, Speaks turned off, the voice closed). */
  stop(): void
}

/** Play a decoded voice: the sound to the speakers (MOUTH_LEAD_MS behind), its loudness on the bus each frame, null when it ends. */
export function playVoice(audio: VoiceAudio, sound: VoiceSound, clock: FrameClock = animationFrames): VoicePlayback {
  const source = audio.createBufferSource()
  source.buffer = sound
  const meter = audio.createAnalyser()
  meter.fftSize = 1024
  const delay = audio.createDelay(1)
  delay.delayTime.value = MOUTH_LEAD_MS / 1000
  source.connect(meter)
  source.connect(delay)
  delay.connect(audio.destination)
  const reference = referenceLevel(sound.getChannelData(0), sound.sampleRate)
  const frame = new Float32Array(meter.fftSize)
  let level = 0, last: number | null = null, cancel: (() => void) | null = null, done = false
  let finish: () => void = () => {}
  const ended = new Promise<void>(resolve => { finish = resolve })
  const end = () => {
    if (done) return
    done = true
    cancel?.()
    cancel = null
    publishVoiceLevel(null)
    finish()
  }
  const tick = (now: number) => {
    if (done) return
    meter.getFloatTimeDomainData(frame)
    level = follow(level, loudnessOf(rmsOf(frame), reference), last === null ? 16 : now - last)
    last = now
    publishVoiceLevel(level)
    cancel = clock(tick)
  }
  source.onended = end
  source.start()
  publishVoiceLevel(0)
  cancel = clock(tick)
  return {
    ended,
    stop: () => {
      if (done) return
      source.onended = null
      try { source.stop() } catch { /* already stopped */ }
      end()
    },
  }
}
