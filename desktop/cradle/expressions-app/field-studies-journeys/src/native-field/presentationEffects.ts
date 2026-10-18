/** The torus's four effects as sound (manual §21.5): Filter, Dynamics, Delay and Reverb, each a module of the browser's audio graph,
 * standing after the controller's level and before the device in the order the owner's chain names (effectsLaw.ts `chain`): "the
 * sound passes through them from left to right". An empty chain joins the level to the device, so the torus sounds as the receiver
 * gives it. The parameters and their law are effectsLaw.ts; this module only sounds the state it is given. An effect on the chain but
 * off passes its input unchanged: its dry path at full and its own path silent (the reverb's path is disconnected while it is off or
 * off the chain, so an idle reverb costs nothing). Nothing here touches the native PCM, its clock or the receiver's clip law.
 *
 *   Filter: drive → biquad, blended with the dry by Mix
 *   Dynamics: compressor → makeup, or the dry when off
 *   Delay: the dry at full, plus a line whose repeats are darkened by Tone and fed back by Feedback, heard at Mix
 *   Reverb: pre-delay → convolver over a generated room, blended with the dry by Dry/wet
 *
 * Two of the browser's nodes need their own correction to sound the law (measured in Chromium and WebKit alike,
 * tests/native-expression-effects-browser.mjs):
 *   - a feedback cycle through a DelayNode takes one render quantum (128 frames) more than the node's time, so the repeats would
 *     drift 2.7 ms a pass at 48 kHz: the first pass runs through its own line at the time, and the loop through a second line one
 *     quantum shorter, so every repeat lands one Time after the last;
 *   - the DynamicsCompressorNode adds its own makeup, 0.6 of the reduction at full level (Web Audio's "fullRangeMakeupGain"), so the
 *     makeup stage takes that back before it adds the effect's Makeup: the curve is the design's static curve.
 *
 * The room is generated, not sampled: noise falling 60 dB in Decay, its bright part falling faster with Damping (to a fifth of the
 * Decay at 100 %), after six early reflections spaced by Size — the law the design draws (catalogue/panels/live__reverb.tsx Tail).
 * A seeded noise makes the same settings the same room. A change of Size, Decay or Damping regenerates the room once the changes
 * pause (a dial's drag is many edits), never in an audio callback. */
import {delaySeconds, filterQ, type EffectValue, type EffectsState, type PresentationEffect} from './effectsLaw.js';

/** Run later and give back the cancel. Tests pass their own. */
export type Defer = (run: () => void, ms: number) => () => void;
const later: Defer = (run, ms) => { const timer = setTimeout(run, ms); return () => clearTimeout(timer); };

const SMOOTH = 0.015, ROOM_PAUSE_MS = 60, MAX_DELAY = 6, MAX_PREDELAY = 0.3, MAX_ROOM = 22, QUANTUM = 128;
const dbToGain = (db: number) => 10 ** (db / 20);
/** Connect each node to the next. */
const wire = (...nodes: AudioNode[]) => { for (let i = 0; i + 1 < nodes.length; i++) nodes[i]!.connect(nodes[i + 1]!); };
const num = (value: EffectValue | undefined) => value as number;
/** The compressor's own makeup in dB: 0.6 of the reduction its curve gives a full-level input (a hard knee). */
export const compressorOwnMakeupDb = (threshold: number, ratio: number): number => -0.6 * threshold * (1 - 1 / ratio);

/** Seeded uniform noise in [-1, 1): the same seed gives the same room. */
function noise(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; };
}

/** The room's impulse response, two channels: early reflections by Size, then noise falling 60 dB in Decay, its bright part (what a
 * one-pole low-pass at 2 kHz leaves out) falling 60 dB in Decay·(1 − 0.8·Damping). */
export function reverbImpulse(sampleRate: number, size: number, decay: number, damping: number): Float32Array[] {
  const length = Math.max(1, Math.ceil(Math.min(MAX_ROOM, decay * 1.1 + 0.05) * sampleRate));
  const bright = decay * (1 - 0.8 * damping / 100), gap = (3 + size / 100 * 27) / 1000;
  const pole = Math.exp(-2 * Math.PI * 2000 / sampleRate);
  return [0, 1].map(channel => {
    const out = new Float32Array(length), random = noise(0x5eed + channel);
    // Each envelope falls by a constant factor a sample: 60 dB over its time.
    const fall = 10 ** (-3 / (decay * sampleRate)), fallBright = 10 ** (-3 / (bright * sampleRate));
    let low = 0, env = 1, envBright = 1;
    for (let i = 0; i < length; i++) {
      const n = random();
      low = (1 - pole) * n + pole * low;
      out[i] = low * env + (n - low) * envBright;
      env *= fall; envBright *= fallBright;
    }
    for (let k = 0; k < 6; k++) {
      const at = Math.round(gap * (k + 1) * sampleRate);
      if (at < length) out[at] = out[at]! + (channel === k % 2 ? 1 : -1) * dbToGain(-60 * gap * (k + 1) / decay - 3 * k);
    }
    return out;
  });
}

export class PresentationEffects {
  /** Where the level connects. */
  readonly input: GainNode;
  readonly #output: AudioNode;
  readonly #context: BaseAudioContext;
  readonly #defer: Defer;
  readonly #nodes: AudioNode[] = [];
  #state: EffectsState;
  #chain: string | null = null;
  #room: string | null = null;
  #cancelRoom: (() => void) | null = null;
  #reverbConnected = false;
  #closed = false;
  readonly #filter: {in: GainNode; dry: GainNode; drive: GainNode; biquad: BiquadFilterNode; wet: GainNode; out: GainNode};
  readonly #dynamics: {in: GainNode; dry: GainNode; compressor: DynamicsCompressorNode; makeup: GainNode; wet: GainNode; out: GainNode};
  readonly #delay: {in: GainNode; send: GainNode; line: DelayNode; loop: DelayNode; tone: BiquadFilterNode; feedback: GainNode; wet: GainNode; out: GainNode};
  readonly #reverb: {in: GainNode; dry: GainNode; pre: DelayNode; convolver: ConvolverNode; wet: GainNode; out: GainNode};

  constructor(context: BaseAudioContext, output: AudioNode, state: EffectsState, defer: Defer = later) {
    this.#context = context; this.#output = output; this.#defer = defer; this.#state = state;
    const gain = () => this.#keep(context.createGain());
    this.input = gain();
    // Filter: the dry and the driven, filtered sound, blended by Mix.
    const filter = {in: gain(), dry: gain(), drive: gain(), biquad: this.#keep(context.createBiquadFilter()), wet: gain(), out: gain()};
    wire(filter.in, filter.dry, filter.out);
    wire(filter.in, filter.drive, filter.biquad, filter.wet, filter.out);
    // Dynamics: the compressor (a hard knee, the design's static curve) and its makeup, or the dry when off.
    const dynamics = {in: gain(), dry: gain(), compressor: this.#keep(context.createDynamicsCompressor()), makeup: gain(), wet: gain(), out: gain()};
    wire(dynamics.in, dynamics.dry, dynamics.out);
    wire(dynamics.in, dynamics.compressor, dynamics.makeup, dynamics.wet, dynamics.out);
    // Delay: the dry at full, and the line: each pass darkened by Tone, fed back by Feedback through the loop's own line, heard at Mix.
    const delay = {in: gain(), send: gain(), line: this.#keep(context.createDelay(MAX_DELAY)), loop: this.#keep(context.createDelay(MAX_DELAY)),
      tone: this.#keep(context.createBiquadFilter()), feedback: gain(), wet: gain(), out: gain()};
    wire(delay.in, delay.out);
    wire(delay.in, delay.send, delay.line, delay.tone);
    wire(delay.tone, delay.feedback, delay.loop, delay.tone);
    wire(delay.tone, delay.wet, delay.out);
    // Reverb: the dry and the room after the pre-delay, blended by Dry/wet; the room's path joins only while the reverb sounds.
    const reverb = {in: gain(), dry: gain(), pre: this.#keep(context.createDelay(MAX_PREDELAY)), convolver: this.#keep(context.createConvolver()), wet: gain(), out: gain()};
    wire(reverb.in, reverb.dry, reverb.out);
    wire(reverb.pre, reverb.convolver, reverb.wet, reverb.out);
    reverb.convolver.normalize = true;
    filter.biquad.Q.value = 0; delay.tone.type = 'lowpass'; delay.tone.Q.value = 20 * Math.log10(Math.SQRT1_2);
    dynamics.compressor.knee.value = 0;
    this.#filter = filter; this.#dynamics = dynamics; this.#delay = delay; this.#reverb = reverb;
    this.#apply(state, true);
  }

  #keep<T extends AudioNode>(node: T): T { this.#nodes.push(node); return node; }

  #module(effect: PresentationEffect): {in: AudioNode; out: AudioNode} {
    return effect === 'filter' ? this.#filter : effect === 'dynamics' ? this.#dynamics : effect === 'delay' ? this.#delay : this.#reverb;
  }

  /** Join the modules in the chain's order, the level first and the device last; an empty chain joins the level to the device. */
  #wireChain(chain: readonly PresentationEffect[]) {
    const key = chain.join(' ');
    if (key === this.#chain) return;
    this.#chain = key;
    this.input.disconnect();
    for (const effect of ['filter', 'dynamics', 'delay', 'reverb'] as const) this.#module(effect).out.disconnect();
    // The level into the first module, each module's way out into the next one's way in, the last into the device.
    let from: AudioNode = this.input;
    for (const effect of chain) { from.connect(this.#module(effect).in); from = this.#module(effect).out; }
    from.connect(this.#output);
  }

  #param(param: AudioParam, value: number, now: boolean) {
    if (now || typeof param.setTargetAtTime !== 'function') param.value = value;
    else param.setTargetAtTime(value, this.#context.currentTime, SMOOTH);
  }

  /** Sound this state. Values the owner already admitted (effectsLaw.ts editEffects, editEffectChain). */
  apply(state: EffectsState): void {
    if (this.#closed) return;
    this.#apply(state, false);
  }

  #apply(state: EffectsState, now: boolean) {
    this.#state = state;
    this.#wireChain(state.chain);
    const {filter: f, dynamics: d, delay: y, reverb: r} = state;
    const set = (param: AudioParam, value: number) => this.#param(param, value, now);
    // Filter
    const fOn = f.on === true, mix = num(f.mix) / 100;
    this.#filter.biquad.type = f.type as BiquadFilterType;
    set(this.#filter.biquad.frequency, num(f.cutoff));
    set(this.#filter.biquad.Q, filterQ(f.type as string, num(f.resonance)));
    set(this.#filter.drive.gain, dbToGain(num(f.drive)));
    set(this.#filter.dry.gain, fOn ? 1 - mix : 1);
    set(this.#filter.wet.gain, fOn ? mix : 0);
    // Dynamics
    const dOn = d.on === true, c = this.#dynamics.compressor;
    set(c.threshold, num(d.threshold)); set(c.ratio, num(d.ratio));
    set(c.attack, num(d.attack) / 1000); set(c.release, num(d.release) / 1000);
    set(this.#dynamics.makeup.gain, dbToGain(num(d.makeup) - compressorOwnMakeupDb(num(d.threshold), num(d.ratio))));
    set(this.#dynamics.dry.gain, dOn ? 0 : 1);
    set(this.#dynamics.wet.gain, dOn ? 1 : 0);
    // Delay
    const yOn = y.on === true;
    const time = Math.min(MAX_DELAY, delaySeconds(y));
    set(this.#delay.line.delayTime, time);
    set(this.#delay.loop.delayTime, Math.max(QUANTUM / this.#context.sampleRate, time - QUANTUM / this.#context.sampleRate));
    set(this.#delay.tone.frequency, num(y.tone));
    set(this.#delay.feedback.gain, num(y.feedback) / 100);
    set(this.#delay.send.gain, yOn ? 1 : 0);
    set(this.#delay.wet.gain, yOn ? num(y.mix) / 100 : 0);
    // Reverb: its room sounds only while it is on and on the chain.
    const rOn = r.on === true, sounds = rOn && state.chain.includes('reverb'), wet = num(r.mix) / 100;
    set(this.#reverb.pre.delayTime, num(r.predelay) / 1000);
    set(this.#reverb.dry.gain, rOn ? 1 - wet : 1);
    set(this.#reverb.wet.gain, rOn ? wet : 0);
    if (sounds !== this.#reverbConnected) {
      if (sounds) this.#reverb.in.connect(this.#reverb.pre); else this.#reverb.in.disconnect(this.#reverb.pre);
      this.#reverbConnected = sounds;
    }
    if (sounds) this.#roomFor(num(r.size), num(r.decay), num(r.damping), now);
  }

  /** Generate the room for these settings, once the edits pause; the first room is made at once. */
  #roomFor(size: number, decay: number, damping: number, now: boolean) {
    const key = `${size}/${decay}/${damping}`;
    if (key === this.#room) return;
    this.#room = key;
    this.#cancelRoom?.(); this.#cancelRoom = null;
    const make = () => {
      this.#cancelRoom = null;
      if (this.#closed) return;
      const channels = reverbImpulse(this.#context.sampleRate, size, decay, damping);
      const buffer = this.#context.createBuffer(2, channels[0]!.length, this.#context.sampleRate);
      channels.forEach((data, channel) => buffer.copyToChannel(data, channel));
      this.#reverb.convolver.buffer = buffer;
    };
    if (now || this.#reverb.convolver.buffer === null) make();
    else this.#cancelRoom = this.#defer(make, ROOM_PAUSE_MS);
  }

  /** The state this graph sounds. */
  get state(): EffectsState { return this.#state; }

  dispose(): void {
    if (this.#closed) return;
    this.#closed = true; this.#cancelRoom?.(); this.#cancelRoom = null;
    for (const node of this.#nodes) { try { node.disconnect(); } catch { /* already apart */ } }
  }
}
