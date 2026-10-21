// The Answer's voice (central:nara-conversation; manual §19.4, §19.21 Voice): what you say is heard and sent, and the answer is spoken,
// through the native voice owner the desktop already has — the kernel op nara_voice (open · listen · transcribe · speak · complete ·
// close: whisper.cpp in, Kokoro-82M out, on this machine only; desktop/cradle/kernel/src/nara_voice.rs). The legacy panel
// (desktop/cradle/src/nara/NativeVoicePanel.tsx) does the same steps by hand, one press each; here they follow each other on their own:
//
//   Hears on   open the voice (the dialogue binding, looked up, with the turn's context) → listen (a recording lease) → the microphone
//              (VoiceCapture) until you stop talking (a second of quiet after speech: `hear`) → transcribe → the words are `heard`
//              → sent as the session's next turn, exactly as a typed question (the encounter's own draft and Send) → `heard` clears.
//              The microphone opens again once the answer has been spoken (Speaks on) or has completed (Speaks off).
//   Speaks on  each answer that completes from now on is spoken: speak (the answer's block) → its WAV played through Web Audio, the
//              face's mouth following its loudness (agent/faceVoice.ts) → complete (playback ended) → `voice` quiet again.
//   Barge-in   Hears pressed on while the answer is spoken stops the sound at once, completes the response, and listens.
//
// The owner speaks one turn at a time (its mode: turn-based-native-cascade): it holds one recording or one response per voice, and
// refuses a second ("Finish the current voice activity first"), so the microphone is never open while the answer is spoken. It returns
// no partial transcript: `heard` stays empty while you talk and holds your words from the moment they are written until they are sent.
// A recording the owner never transcribes (Hears turned off mid-sentence, or an answer to speak while the microphone waits) is
// discarded and its lease released by closing the voice; the next press opens it again. Nothing is invented: a refusal is the owner's
// own words, on the key that asked (`refused`), and the key goes back off.
//
// Pure of React and of the transport: the owner's op, the microphone and the speakers are ports (useAnswerVoice.ts gives the real ones).
import type {NativeVoiceRequest, NativeVoiceResult} from '../../../../../../desktop/cradle/src/nara/nativeVoice'
import {nativeTextRuns} from '../../../../../../desktop/cradle/src/nara/nativeTranscript'

export type OnOff = 'on' | 'off'
/** What the voice does now: listening (the microphone is open, or your words are being written), speaking (the answer plays). */
export type VoiceNow = 'quiet' | 'listening' | 'speaking'
export type VoiceKey = 'hears' | 'speaks'

export interface AnswerVoiceState {
  readonly hears: OnOff
  readonly speaks: OnOff
  readonly voice: VoiceNow
  /** Your words as the owner wrote them, until they are sent. */
  readonly heard: string
  /** The owner's words for the last refusal, by the key that asked, until that key is pressed again. */
  readonly refused: Readonly<Partial<Record<VoiceKey, string>>>
  /** What waits on the owner now, in words ('' when nothing does). */
  readonly busy: string
  /** The open voice's constitution, as the owner answered nara_voice open (actuation.speech-constitution/v1: its interaction, its
   * interruption, the stages' declared voices); absent while no voice is open. */
  readonly constitution?: unknown
  /** The last speak's receipt, as the owner answered it (the speech actor's actuation.nara-session-response/v1, named by its request_ref);
   * absent before the first answer is spoken on this conversation. */
  readonly receipt?: unknown
}

export const VOICE_OFF: AnswerVoiceState = Object.freeze({hears: 'off', speaks: 'off', voice: 'quiet', heard: '', refused: Object.freeze({}), busy: ''})

/** The open request's two parts: the dialogue binding (its lookup) and the turn's context. */
type Opening = Pick<Extract<NativeVoiceRequest, {operation: 'open'}>, 'binding' | 'context'>

export interface VoiceRecorder {
  /** Stop the microphone and give the recording (16 kHz mono WAV). */
  finish(): Promise<ArrayBuffer>
  /** Stop the microphone and drop what it heard. */
  discard(): Promise<void>
}
export interface VoicePlaying {
  /** Resolves when the sound has ended, played out or stopped. */
  readonly ended: Promise<void>
  stop(): void
}

/** What the voice acts through. */
export interface AnswerVoicePorts {
  /** The kernel op nara_voice for this conversation's project (desktop/cradle/src/nara/nativeVoice.ts nativeVoice). */
  readonly voice: (request: NativeVoiceRequest) => Promise<NativeVoiceResult>
  /** The open request for the bound conversation, read now (centralDeviceWrites.ts voiceOpening). */
  readonly opening: () => Promise<Opening>
  /** Send words as the session's next turn: the `sent` path, the thread pane's Send. */
  readonly send: (text: string) => Promise<void>
  /** Open the microphone. `level` hears each block's loudness (RMS) and length; `ended` is called if it stops by itself (its
   * five-minute limit, or a failure). */
  readonly capture: (hear: {readonly level: (rms: number, ms: number) => void; readonly ended: (failure?: Error) => void}) => Promise<VoiceRecorder>
  /** Play a WAV (and move the face's mouth with it). */
  readonly play: (wav: ArrayBuffer) => Promise<VoicePlaying>
  /** Ready the speakers inside the hand's press: a browser lets sound start only after one. */
  readonly wake?: () => void
  /** Base64 of the recording, and the WAV from the owner's base64 (nativeVoice.ts encodeAudio, decodeAudio). */
  readonly encode: (bytes: Uint8Array) => string
  readonly decode: (base64: string) => ArrayBuffer
}

// ---------------------------------------------------------------------------------------------------------------- the ear

/** When an utterance ends: speech is a block over `ratio` times the room's quiet and over `floor` (RMS); you have spoken once the
 * speech adds up to `speechMs`; you have finished after `quietMs` of quiet after that. */
export const EAR = Object.freeze({ratio: 3, floor: 0.01, speechMs: 240, quietMs: 1100})

export interface EarState {
  /** The room's quiet (RMS), learnt from the blocks that are not speech; null before the first block. */
  readonly room: number | null
  readonly spokenMs: number
  readonly quietMs: number
  /** You have spoken in this recording. */
  readonly heard: boolean
}
export const EAR_START: EarState = Object.freeze({room: null, spokenMs: 0, quietMs: 0, heard: false})

/** One block of the microphone: the ear after it, and whether the utterance has ended. Pure. */
export function hear(state: EarState, rms: number, ms: number): {state: EarState; ended: boolean} {
  const level = Number.isFinite(rms) && rms > 0 ? rms : 0
  const room = state.room ?? Math.max(1e-4, level)
  const speech = level > Math.max(EAR.floor, room * EAR.ratio)
  if (speech) {
    const spokenMs = state.spokenMs + ms
    return {state: {room, spokenMs, quietMs: 0, heard: state.heard || spokenMs >= EAR.speechMs}, ended: false}
  }
  // The room's quiet follows a quieter block at once and a louder one slowly, so speech never teaches it.
  const next = Math.max(1e-4, room + (level - room) * (level < room ? 0.5 : 0.05))
  const quietMs = state.quietMs + ms
  return {state: {room: next, spokenMs: state.spokenMs, quietMs, heard: state.heard}, ended: state.heard && quietMs >= EAR.quietMs}
}

// ---------------------------------------------------------------------------------------------------------------- the answer

/** The latest completed answer in the session's exchange: the first block of the agent's last run that a completion follows (the
 * legacy panel's own choice, NativeVoicePanel.tsx `answer`), the block the owner speaks; null when none has completed. Pure. */
export function spokenAnswerOf(blocks: readonly {id: number; kind: string; text: string}[] | undefined): number | null {
  const runs = nativeTextRuns(blocks ?? [])
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].kind !== 'assistant') continue
    const after = runs.slice(i + 1).find(row => ['user', 'completed', 'cancelled', 'error'].includes(row.kind))
    if (after?.kind === 'completed') return runs[i].id
  }
  return null
}

/** What the voice reads of the exchange: the latest completed answer, and the last block that ended a turn (completed, cancelled or in
 * error; block ids only grow) — a turn that ends after a spoken question lets the microphone open again. Pure. */
export function exchangeOf(blocks: readonly {id: number; kind: string; text: string}[] | undefined): {answer: number | null; ended: number | null} {
  const ends = (blocks ?? []).filter(block => block.kind === 'completed' || block.kind === 'cancelled' || block.kind === 'error')
  return {answer: spokenAnswerOf(blocks), ended: ends.length ? Math.max(...ends.map(block => block.id)) : null}
}

// ---------------------------------------------------------------------------------------------------------------- the session

const WAV_TYPES = ['audio/wav', 'audio/wave', 'audio/x-wav']
const wordsOf = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure))
/** The microphone's refusals in words the person can act on. */
export function microphoneWords(failure: unknown): string {
  const name = failure && typeof failure === 'object' && 'name' in failure ? String((failure as {name: unknown}).name) : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'The microphone was refused: allow O:I to use it (System Settings › Privacy & Security › Microphone), then turn Hears on again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone is connected.'
  return `The microphone did not open: ${wordsOf(failure)}`
}
class Stale extends Error { constructor() { super('The conversation changed: the voice was closed, and what it was doing was dropped.') } }

/** One conversation's voice. The binding reads `snapshot()`, writes through `write`, and tells it of the exchange (`observe`). */
export class AnswerVoice {
  private state: AnswerVoiceState = VOICE_OFF
  private readonly listeners = new Set<() => void>()
  private ports: AnswerVoicePorts | null = null
  private key: string | null = null
  /** Bumped whenever the conversation changes or the voice is closed: a late result of an older one is dropped. */
  private generation = 0
  private lease: string | null = null
  private recording: {recorder: VoiceRecorder; ref: string; ear: EarState; finishing: boolean; dropped: boolean} | null = null
  private playing: {playback: VoicePlaying; response: string} | null = null
  /** A question sent by voice: the microphone opens again once a turn has ended after it (`ended`: the last turn's end when it was sent). */
  private waiting: {readonly ended: number | null} | null = null
  /** The latest completed answer seen (undefined before the first reading: what was answered before is never spoken), and how many
   * turns had ended. */
  private seen: number | null | undefined = undefined
  private endedSeen: number | null = null
  /** The owner takes one call at a time on a voice ("Native voice is busy"): every call goes through this chain. */
  private chain: Promise<unknown> = Promise.resolve()

  snapshot = (): AnswerVoiceState => this.state
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }

  private set(change: Partial<AnswerVoiceState>): void {
    const next = {...this.state, ...change}
    if ((Object.keys(next) as (keyof AnswerVoiceState)[]).every(key => next[key] === this.state[key])) return
    this.state = next
    for (const listener of [...this.listeners]) listener()
  }
  private refuse(key: VoiceKey, words: string | undefined): void {
    const refused = {...this.state.refused}
    if (words === undefined) delete refused[key]; else refused[key] = words
    this.set({refused})
  }
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(task, task)
    this.chain = run.catch(() => undefined)
    return run
  }
  private check(generation: number): void { if (generation !== this.generation) throw new Stale() }

  /** The conversation the voice belongs to (its session and Expression), and its ports; null while none is bound or no native
   * owner stands. Another conversation closes this one's voice: both keys go off. */
  attach(key: string | null, ports: AnswerVoicePorts | null): void {
    if (key === this.key) { this.ports = ports; return }
    const was = this.ports
    this.generation++
    this.key = key
    this.ports = ports
    this.seen = undefined
    this.endedSeen = null
    this.waiting = null
    void this.teardown(was)
    this.state = VOICE_OFF
    for (const listener of [...this.listeners]) listener()
  }

  /** Close the voice: the microphone, the sound and the owner's lease. */
  async close(): Promise<void> {
    this.generation++
    this.waiting = null
    this.set({hears: 'off', speaks: 'off', voice: 'quiet', heard: '', busy: ''})
    await this.teardown(this.ports)
  }

  private async teardown(ports: AnswerVoicePorts | null): Promise<void> {
    const recording = this.recording, playing = this.playing, lease = this.lease
    this.recording = null; this.playing = null; this.lease = null
    if (this.state.constitution !== undefined) this.set({constitution: undefined})
    playing?.playback.stop()
    await recording?.recorder.discard().catch(() => undefined)
    // Closing the lease releases a recording or a response the owner still holds.
    if (lease && ports) await this.serial(() => ports.voice({operation: 'close', voice_ref: lease})).catch(() => undefined)
  }

  /** A press: Hears or Speaks on or off. Resolves when the owner has answered the press; rejects with its words. */
  async write(key: VoiceKey, value: unknown): Promise<void> {
    const on = value === 'on' || value === true
    if (value !== 'on' && value !== 'off' && typeof value !== 'boolean') throw new Error(`${key} is on or off.`)
    this.refuse(key, undefined)
    if (key === 'speaks') return on ? this.speaksOn() : this.speaksOff()
    return on ? this.hearsOn() : this.hearsOff()
  }

  private portsOrThrow(): AnswerVoicePorts {
    if (!this.ports) throw new Error('No conversation is bound here: the voice has no session to hear for or answer from.')
    return this.ports
  }

  private async hearsOn(): Promise<void> {
    const ports = this.portsOrThrow(), generation = this.generation
    this.set({hears: 'on'})
    try {
      // Barge-in: you talk over the answer — its sound stops, the owner is told it ended, and the microphone opens.
      if (this.playing) await this.stopSpeaking()
      this.waiting = null
      await this.listen(ports, generation)
    } catch (failure) {
      if (generation === this.generation && !(failure instanceof Stale)) { this.set({hears: 'off', voice: this.playing ? 'speaking' : 'quiet', busy: ''}); this.refuse('hears', wordsOf(failure)) }
      throw failure
    }
  }

  private async hearsOff(): Promise<void> {
    this.set({hears: 'off'})
    this.waiting = null
    if (this.recording) {
      const ports = this.ports
      await this.serial(() => this.dropRecording(ports))
      this.set({voice: this.playing ? 'speaking' : 'quiet', busy: ''})
    }
    if (this.state.speaks === 'off') await this.release()
  }

  private async speaksOn(): Promise<void> {
    const ports = this.portsOrThrow(), generation = this.generation
    ports.wake?.()
    this.set({speaks: 'on'})
    try {
      await this.serial(() => this.open(ports, generation))
    } catch (failure) {
      if (generation === this.generation && !(failure instanceof Stale)) { this.set({speaks: 'off', busy: ''}); this.refuse('speaks', wordsOf(failure)) }
      throw failure
    }
  }

  private async speaksOff(): Promise<void> {
    this.set({speaks: 'off'})
    if (this.playing) await this.stopSpeaking()
    if (this.state.hears === 'off' && !this.recording) await this.release()
  }

  /** Close the lease when neither key needs it. */
  private async release(): Promise<void> {
    const lease = this.lease, ports = this.ports
    if (!lease || !ports || this.state.hears === 'on' || this.state.speaks === 'on') return
    this.lease = null
    this.set({constitution: undefined})
    await this.serial(() => ports.voice({operation: 'close', voice_ref: lease})).catch(() => undefined)
  }

  /** The voice's lease: open it (the dialogue binding, looked up, and the turn's context, read now) unless it is open. */
  private async open(ports: AnswerVoicePorts, generation: number): Promise<string> {
    if (this.lease) return this.lease
    this.set({busy: 'Opening the voice'})
    const {binding, context} = await ports.opening()
    this.check(generation)
    const result = await ports.voice({operation: 'open', binding, context})
    if (generation !== this.generation) {
      await ports.voice({operation: 'close', voice_ref: result.voice_ref}).catch(() => undefined)
      throw new Stale()
    }
    this.lease = result.voice_ref
    this.set({busy: '', constitution: result.constitution})
    return result.voice_ref
  }

  /** Open the microphone on a recording lease, unless it is open. */
  private listen(ports: AnswerVoicePorts, generation: number): Promise<void> {
    return this.serial(async () => {
      this.check(generation)
      if (this.recording || this.state.hears !== 'on') return
      const lease = await this.open(ports, generation)
      const granted = await ports.voice({operation: 'listen', voice_ref: lease})
      this.check(generation)
      if (!granted.capture_ref) throw new Error('The native voice owner did not grant a recording lease.')
      let recorder: VoiceRecorder
      try {
        recorder = await ports.capture({
          level: (rms, ms) => this.heardBlock(generation, rms, ms),
          ended: failure => { void this.recordingEnded(generation, failure) },
        })
      } catch (failure) {
        // The owner holds the recording lease until a transcript or a close: release it.
        this.lease = null
        this.set({constitution: undefined})
        await ports.voice({operation: 'close', voice_ref: lease}).catch(() => undefined)
        throw new Error(microphoneWords(failure))
      }
      if (generation !== this.generation || this.state.hears !== 'on') { await recorder.discard().catch(() => undefined); this.check(generation); return }
      this.recording = {recorder, ref: granted.capture_ref, ear: EAR_START, finishing: false, dropped: false}
      this.set({voice: 'listening', heard: '', busy: ''})
    })
  }

  private heardBlock(generation: number, rms: number, ms: number): void {
    const recording = this.recording
    if (generation !== this.generation || !recording || recording.finishing) return
    const {state, ended} = hear(recording.ear, rms, ms)
    recording.ear = state
    if (ended) void this.finishUtterance(generation).catch(() => undefined)
  }

  private async recordingEnded(generation: number, failure?: Error): Promise<void> {
    if (generation !== this.generation || !this.recording || this.recording.finishing) return
    if (!failure) { await this.finishUtterance(generation).catch(() => undefined); return }
    const ports = this.ports
    await this.serial(() => this.dropRecording(ports))
    this.set({hears: 'off', voice: 'quiet', busy: ''})
    this.refuse('hears', wordsOf(failure))
  }

  /** You stopped talking: your words are written, then sent as the session's next turn. */
  private async finishUtterance(generation: number): Promise<void> {
    const recording = this.recording, ports = this.ports
    if (!recording || !ports || recording.finishing) return
    recording.finishing = true
    this.set({busy: 'Writing what you said'})
    try {
      const bytes = await recording.recorder.finish()
      this.check(generation)
      if (this.recording === recording) this.recording = null
      const lease = this.lease
      if (!lease) throw new Error('The voice closed before your words were written.')
      const result = await this.serial(() => ports.voice({operation: 'transcribe', voice_ref: lease, capture_ref: recording.ref, wav_base64: ports.encode(new Uint8Array(bytes))}))
      this.check(generation)
      if (typeof result.transcription?.text !== 'string') throw new Error('The native speech service did not return a transcript.')
      const said = result.transcription.text.trim()
      if (!said) {
        // Nothing was written from it (a cough, the room): listen again.
        this.set({heard: '', busy: '', voice: 'quiet'})
        if (this.state.hears === 'on') await this.listen(ports, generation)
        return
      }
      this.set({heard: said, busy: 'Sending your words'})
      await ports.send(said)
      this.check(generation)
      this.waiting = {ended: this.endedSeen}
      this.set({heard: '', busy: '', voice: 'quiet'})
    } catch (failure) {
      // Dropped (Hears turned off while the words were being written), or another conversation: nothing to say.
      if (failure instanceof Stale || generation !== this.generation || recording.dropped) return
      if (this.recording === recording) this.recording = null
      // Your words stay in `heard` when they were written and could not be sent; the microphone closes.
      this.set({hears: 'off', voice: this.playing ? 'speaking' : 'quiet', busy: ''})
      this.refuse('hears', wordsOf(failure))
      throw failure
    }
  }

  /** A recording the owner will not transcribe: the microphone stops and the lease that holds it is closed. */
  private async dropRecording(ports: AnswerVoicePorts | null): Promise<void> {
    const recording = this.recording, lease = this.lease
    if (!recording) return
    this.recording = null
    recording.dropped = true
    await recording.recorder.discard().catch(() => undefined)
    this.lease = null
    if (lease && ports) await ports.voice({operation: 'close', voice_ref: lease}).catch(() => undefined)
  }

  /** Stop the sound now; the response it played, which the owner is then told has ended. */
  private halt(): string | null {
    const playing = this.playing
    if (!playing) return null
    this.playing = null
    playing.playback.stop()
    this.set({voice: this.recording ? 'listening' : 'quiet'})
    return playing.response
  }
  /** Tell the owner a response's playback ended (op complete: "renderer-playback-ended"), played out or stopped. */
  private async completed(ports: AnswerVoicePorts, response: string): Promise<void> {
    const lease = this.lease
    if (lease) await ports.voice({operation: 'complete', voice_ref: lease, response_ref: response})
  }
  /** Stop the sound now and tell the owner its playback ended. */
  private async stopSpeaking(): Promise<void> {
    const response = this.halt(), ports = this.ports
    if (response && ports) await this.serial(() => this.completed(ports, response)).catch(() => undefined)
  }

  /** The session's exchange as the shared observer reads it (exchangeOf): the latest completed answer, and how many turns have ended.
   * An answer that completes while Speaks is on is spoken; the microphone opens again once a turn has ended after a spoken question. */
  observe(exchange: {readonly answer: number | null; readonly ended: number | null}): void {
    if (this.seen === undefined) { this.seen = exchange.answer; this.endedSeen = exchange.ended; return }
    const fresh = exchange.answer !== null && exchange.answer !== this.seen
    if (fresh) this.seen = exchange.answer
    this.endedSeen = exchange.ended
    const ports = this.ports, generation = this.generation
    if (!ports) return
    if (fresh && this.state.speaks === 'on') { void this.speakAnswer(ports, generation, exchange.answer!).catch(() => undefined); return }
    const endedSince = (since: number | null) => exchange.ended !== null && (since === null || exchange.ended > since)
    if (this.waiting && endedSince(this.waiting.ended) && !this.playing) {
      this.waiting = null
      if (this.state.hears === 'on') void this.listen(ports, generation).catch(failure => {
        if (generation === this.generation && !(failure instanceof Stale)) { this.set({hears: 'off', voice: 'quiet', busy: ''}); this.refuse('hears', wordsOf(failure)) }
      })
    }
  }

  private async speakAnswer(ports: AnswerVoicePorts, generation: number, answer: number): Promise<void> {
    this.waiting = null
    let started: {playback: VoicePlaying; response: string} | null = null
    try {
      started = await this.serial(async () => {
        this.check(generation)
        if (this.recording) {
          // You are talking: your turn first, and this answer stays written.
          if (this.recording.ear.heard || this.recording.finishing) return null
          // The microphone only waits: its lease is released so the owner can speak.
          await this.dropRecording(ports)
        }
        const halted = this.halt()
        if (halted) await this.completed(ports, halted).catch(() => undefined)
        const lease = await this.open(ports, generation)
        this.set({busy: 'Readying the answer\'s voice'})
        const result = await ports.voice({operation: 'speak', voice_ref: lease, answer_block_id: answer})
        this.check(generation)
        const response = result.response_ref
        if (!response || !result.audio?.audio_base64 || !WAV_TYPES.includes(result.audio.content_type)) throw new Error('The native speech service did not return WAV audio.')
        if (this.state.speaks !== 'on') {
          // Speaks went off while the sound was made: nothing plays; the owner is told it ended.
          await ports.voice({operation: 'complete', voice_ref: lease, response_ref: response}).catch(() => undefined)
          this.set({busy: ''})
          return null
        }
        let playback: VoicePlaying
        try {
          playback = await ports.play(ports.decode(result.audio.audio_base64))
        } catch (failure) {
          // The sound could not play: the owner still holds the response until it is told the playback ended.
          await ports.voice({operation: 'complete', voice_ref: lease, response_ref: response}).catch(() => undefined)
          throw new Error(`The answer's sound did not play: ${wordsOf(failure)}`)
        }
        if (generation !== this.generation) { playback.stop(); throw new Stale() }
        const playing = {playback, response}
        this.playing = playing
        this.set({voice: 'speaking', busy: '', ...(result.receipt !== undefined ? {receipt: result.receipt} : {})})
        return playing
      })
    } catch (failure) {
      if (failure instanceof Stale || generation !== this.generation) return
      this.set({speaks: 'off', voice: this.recording ? 'listening' : 'quiet', busy: ''})
      this.refuse('speaks', wordsOf(failure))
      return
    }
    if (!started) {
      if (this.state.hears === 'on' && !this.recording) await this.listen(ports, generation).catch(() => undefined)
      return
    }
    await started.playback.ended
    // Stopped (a barge-in, Speaks off, the voice closed): whoever stopped it has told the owner.
    if (this.playing !== started || generation !== this.generation) return
    this.playing = null
    const response = started.response
    await this.serial(() => this.completed(ports, response)).catch(failure => {
      if (generation === this.generation) this.refuse('speaks', wordsOf(failure))
    })
    if (generation !== this.generation) return
    this.set({voice: 'quiet'})
    if (this.state.hears === 'on') await this.listen(ports, generation).catch(failure => {
      if (generation === this.generation && !(failure instanceof Stale)) { this.set({hears: 'off', busy: ''}); this.refuse('hears', wordsOf(failure)) }
    })
  }
}

const record = (x: unknown): Record<string, unknown> | undefined => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : undefined)
const SUPPORT_STATES: readonly string[] = ['supported', 'degraded', 'unsupported']

/** What the open voice's own answers tell the Voice device (agent/devices/voiceBinding.ts VOICE_ABSENT names each key's source): the TTS
 * stage's declared voice (the constitution's provenance.stage_relations, in the kernel's order stt, text, tts:
 * kernel/src/nara_voice_constitution.rs), the body's duplex and barge-in (its `interaction`), its stop (its `interruption`), and the last
 * speak's receipt by its request_ref. A key the answers do not carry stays absent. Pure. */
export function voiceBodyReadings(state: Pick<AnswerVoiceState, 'constitution' | 'receipt'>): Record<string, string> {
  const readings: Record<string, string> = {}
  const constitution = record(state.constitution)
  if (constitution) {
    const stages = record(constitution.provenance)?.stage_relations
    const tts = Array.isArray(stages) ? record(record(stages[2])?.configuration) : undefined
    if (typeof tts?.declared_voice === 'string' && tts.declared_voice) readings['voice.voice'] = tts.declared_voice
    const interaction = record(constitution.interaction)
    const support = (name: string): string | undefined => { const state = record(interaction?.[name])?.state; return typeof state === 'string' && SUPPORT_STATES.includes(state) ? state : undefined }
    const duplex = support('full-duplex-realtime'), bargeIn = support('barge-in')
    if (duplex) readings['body.duplex'] = duplex
    if (bargeIn) readings['body.bargeIn'] = bargeIn
    const interruption = record(constitution.interruption)?.state
    if (typeof interruption === 'string' && SUPPORT_STATES.includes(interruption)) readings['body.interrupt'] = interruption
  }
  const receipt = record(state.receipt)?.request_ref
  if (typeof receipt === 'string' && receipt) readings['body.receipt'] = receipt
  return readings
}
