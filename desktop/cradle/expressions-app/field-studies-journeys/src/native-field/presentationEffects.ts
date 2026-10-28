/** The torus's effects as sound (manual §21.5: Filter, Dynamics, Delay and Reverb; §22.7: the Resonator bank), each a module of the browser's audio graph,
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
 *   Resonator bank: a convolver over the summed responses of its bodies, blended with the dry by Mix and lifted by Gain (see below)
 *
 * Two of the browser's nodes need their own correction to sound the law (measured in Chromium and WebKit alike,
 * tests/native-expression-effects-browser.mjs):
 *   - a feedback cycle through a DelayNode takes one render quantum (128 frames) more than the node's time, so the repeats would
 *     drift 2.7 ms a pass at 48 kHz: the first pass runs through its own line at the time, and the loop through a second line one
 *     quantum shorter, so every repeat lands one Time after the last;
 *   - the DynamicsCompressorNode adds its own makeup, 0.6 of the reduction at full level (Web Audio's "fullRangeMakeupGain"), so the
 *     makeup stage takes that back before it adds the effect's Makeup: the curve is the design's static curve.
 * One engine's ConvolverNode needs a correction of its own. WebKit on Linux (its GStreamer ports, WebKitGTK and WPE) lets the Nyquist bin of
 * every block its convolver transforms through unconvolved: FFTFrame::multiply multiplies the packed layout of Apple's FFT, where that bin
 * rides in the DC's imaginary part, and the GStreamer frame keeps it unpacked at the end, where nothing multiplies it. What comes out is the
 * response plus a buzz at half the sample rate that follows the input, block by block, for as long as the response lasts: an impulse through
 * a Decay 1 s body measured 3.05 s to fall 60 dB (Playwright's WebKit on Linux; tests/mr-resonator-bank.test.mjs). Where the page's one
 * measure finds it (convolverLeaksNyquist), the bank rings each side through a convolver whose response stands beside silence: the two halves
 * leak alike, and the silent half's output, the leak alone, is taken from the other's. That is four convolutions where one served (10 s of
 * noise through 1440 bodies renders in 1.5 s there, 0.4 s before); elsewhere the bank is one plain convolver.
 *
 * The room is generated, not sampled: noise falling 60 dB in Decay, its bright part falling faster with Damping (to a fifth of the
 * Decay at 100 %), after six early reflections spaced by Size — the law the design draws (catalogue/panels/live__reverb.tsx Tail).
 * A seeded noise makes the same settings the same room. A change of Size, Decay or Damping regenerates the room once the changes
 * pause (a dial's drag is many edits), never in an audio callback.
 *
 * The Resonator bank (manual §22.7) rings one tuned body at each part of the M3 clock's cut. A body is a damped resonance, r^n·sin(w·n), with
 * r set so that it falls 60 dB in Decay and its gain at its pitch one; the bank is the sum of its bodies, so its response to any sound is
 * the sound convolved with the sum of their impulse responses. It is built that way, one convolver over one response, because that is
 * what the machine sustains. Measured in OfflineAudioContext renders of 10 s of noise at Decay 1 s, in headless Chromium and WebKit, on this
 * machine under a load average of about 50 (render time for 10 s of audio, the best of three; the biquad bank by a throwaway probe, the
 * convolver by the probe and again by every run of tests/mr-resonator-bank.test.mjs):
 *   a bank of band-pass biquads, one per body:  24 bodies 0.17 s (Chromium) 0.23 s (WebKit); 90: 0.78 s, 0.96 s; 180: 1.5 s, 3.8 s;
 *                                               360: 3.3 s, 7.6 s — the cost grows with the bodies, so 1440 (1° x 360 over 4 octaves) could not play;
 *   one convolver over the summed response:     0.15 s (Chromium) 0.08 s (WebKit) for 24 bodies, and 0.13 to 0.4 s for 360 or 1440.
 * So every one of the sixteen cuts rings over every span, and no body is dropped. The price is in the making of the response, not in the
 * playing: a change of cut, root, Span, Decay or Tilt makes the response again once the changes pause, in slices the page can breathe
 * between, and the old response rings until the new one is in (as the reverb's room does). Mix, Gain and On act at once. */
import {PRESENTATION_EFFECTS, delaySeconds, filterQ, resonatorBodies, type EffectValue, type EffectsState, type PresentationEffect} from './effectsLaw.js';

/** Run later and give back the cancel. Tests pass their own. */
export type Defer = (run: () => void, ms: number) => () => void;
const later: Defer = (run, ms) => { const timer = setTimeout(run, ms); return () => clearTimeout(timer); };

const SMOOTH = 0.015, ROOM_PAUSE_MS = 60, MAX_DELAY = 6, MAX_PREDELAY = 0.3, MAX_ROOM = 22, QUANTUM = 128;
/** The bank's response lasts this many Decays: at 1.25 it is cut 75 dB down, far under what can be heard of a 60 dB fall. */
export const RESONATOR_TAIL = 1.25;
/** The most body-samples one slice of the response's making adds (about 10 to 20 ms on this machine). */
const RESONATOR_SLICE_WORK = 4e6;
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

/** What the bank's response is made of: the root (a pitch class), the cut (tenths of a degree), the span (octaves), Decay (s) and Tilt. */
export interface ResonatorParams {readonly root: number; readonly division: number; readonly span: number; readonly decay: number; readonly tilt: number}

/** The bank's impulse response, made body by body so that it can be made in slices. A body at hz with weight w is
 *   g · r^n · sin(w0 · n),  w0 = 2π·hz/rate,  r = e^(−σ/rate),  σ = 3·ln 10 / Decay,
 * which falls 60 dB in Decay; g is chosen so that the body's gain at its own pitch is exactly w (the transform of r^n·sin(w0 n) at w0 is
 * r·sin(w0) / |D|, D = 1 − 2r·cos(w0)·e^(−j·w0) + r²·e^(−2j·w0), and |D| = (1 − r)·√(1 − 2r·cos(2·w0) + r²)): a sine at a body's pitch
 * passes at the body's weight, a sound between two bodies passes far less. */
export class ResonatorImpulse {
  /** The response, one channel; every body added so far is in it. */
  readonly data: Float32Array;
  /** How many bodies the response is made of when it is whole: parts to the octave, over the span. */
  readonly bodies: number;
  readonly #rate: number;
  readonly #sigma: number;
  readonly #list: ReturnType<typeof resonatorBodies>;
  #next = 0;

  constructor(sampleRate: number, params: ResonatorParams) {
    this.#rate = sampleRate;
    this.#sigma = 3 * Math.LN10 / params.decay;
    this.#list = resonatorBodies(params);
    this.bodies = this.#list.length;
    this.data = new Float32Array(Math.ceil(params.decay * RESONATOR_TAIL * sampleRate) + 1);
  }

  /** Add bodies until `work` body-samples are spent; true when every body is in. */
  step(work: number): boolean {
    const per = Math.max(1, Math.floor(work / this.data.length));
    for (let done = 0; this.#next < this.#list.length && done < per; done++) this.#add(this.#list[this.#next++]!);
    return this.#next >= this.#list.length;
  }

  #add(body: {readonly hz: number; readonly weight: number}) {
    const data = this.data, rate = this.#rate, r = Math.exp(-this.#sigma / rate);
    const w0 = 2 * Math.PI * body.hz / rate, cos = Math.cos(w0), sin = Math.sin(w0);
    const g = body.weight * (1 - r) * Math.sqrt(1 - 2 * r * Math.cos(2 * w0) + r * r) / (r * sin);
    const a1 = 2 * r * cos, a2 = r * r;
    let y1 = r * sin, y2 = 0;
    data[1] = data[1]! + g * y1;
    for (let i = 2; i < data.length; i++) { const y = a1 * y1 - a2 * y2; data[i] = data[i]! + g * y; y2 = y1; y1 = y; }
  }
}

/** The whole response in one piece (the slices added up). */
export function resonatorImpulse(sampleRate: number, params: ResonatorParams): Float32Array {
  const build = new ResonatorImpulse(sampleRate, params);
  build.step(Infinity);
  return build.data;
}

let nyquistLeak: boolean | undefined;
let nyquistMeasure: Promise<boolean> | undefined;
/** Whether this engine's convolver lets each block's Nyquist bin through unconvolved (see the head of this file), measured once a page:
 * an impulse through a response of silence comes out silent from a convolver that convolves. Without Web Audio there is nothing to leak. */
export function convolverLeaksNyquist(): Promise<boolean> {
  if (nyquistMeasure) return nyquistMeasure;
  const verdict = (leaks: boolean) => (nyquistLeak = leaks);
  if (typeof OfflineAudioContext !== 'function') return nyquistMeasure = Promise.resolve(verdict(false));
  try {
    const context = new OfflineAudioContext(1, 1024, 48000);
    const impulse = context.createBuffer(1, 1, 48000), source = context.createBufferSource(), convolver = context.createConvolver();
    impulse.getChannelData(0)[0] = 1; source.buffer = impulse;
    // Longer than the first 128 frames, which the engines convolve directly, so the response reaches the transformed blocks.
    convolver.normalize = false; convolver.buffer = context.createBuffer(1, 512, 48000);
    wire(source, convolver, context.destination); source.start(0);
    return nyquistMeasure = context.startRendering().then(out => verdict(out.getChannelData(0).some(x => x !== 0)), () => verdict(false));
  } catch { return nyquistMeasure = Promise.resolve(verdict(false)); }
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
  #ring: string | null = null;
  #cancelRing: (() => void) | null = null;
  #closed = false;
  readonly #filter: {in: GainNode; dry: GainNode; drive: GainNode; biquad: BiquadFilterNode; wet: GainNode; out: GainNode};
  readonly #dynamics: {in: GainNode; dry: GainNode; compressor: DynamicsCompressorNode; makeup: GainNode; wet: GainNode; out: GainNode};
  readonly #delay: {in: GainNode; send: GainNode; line: DelayNode; loop: DelayNode; tone: BiquadFilterNode; feedback: GainNode; wet: GainNode; out: GainNode};
  readonly #reverb: {in: GainNode; dry: GainNode; pre: DelayNode; convolver: ConvolverNode; wet: GainNode; out: GainNode};
  /** The bank's ringing is made only when it first sounds: a bank that is never put on the chain costs one gain node. The ringing is its
   * convolvers (one, or one a side where the engine leaks), where the bank's input joins it, and whether it is joined. */
  readonly #resonator: {in: GainNode; dry: GainNode; wet: GainNode; out: GainNode; ring: {convolvers: ConvolverNode[]; entry: AudioNode; joined: boolean} | null};

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
    // Resonator bank: the dry and, while it sounds, the ringing (in → convolver → wet), blended by Mix.
    const resonator = {in: gain(), dry: gain(), wet: gain(), out: gain(), ring: null};
    wire(resonator.in, resonator.dry, resonator.out);
    wire(resonator.wet, resonator.out);
    this.#filter = filter; this.#dynamics = dynamics; this.#delay = delay; this.#reverb = reverb; this.#resonator = resonator;
    this.#apply(state, true);
  }

  #keep<T extends AudioNode>(node: T): T { this.#nodes.push(node); return node; }

  #module(effect: PresentationEffect): {in: AudioNode; out: AudioNode} {
    return effect === 'filter' ? this.#filter : effect === 'dynamics' ? this.#dynamics : effect === 'delay' ? this.#delay : effect === 'reverb' ? this.#reverb : this.#resonator;
  }

  /** Join the modules in the chain's order, the level first and the device last; an empty chain joins the level to the device. */
  #wireChain(chain: readonly PresentationEffect[]) {
    const key = chain.join(' ');
    if (key === this.#chain) return;
    this.#chain = key;
    this.input.disconnect();
    for (const effect of PRESENTATION_EFFECTS) this.#module(effect).out.disconnect();
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
    // Resonator bank: Mix and Gain act at once; the ringing joins the path only while the bank is on and on the chain.
    const z = state.resonator, zOn = z.on === true, zMix = num(z.mix) / 100, zSounds = zOn && state.chain.includes('resonator');
    set(this.#resonator.dry.gain, zOn ? 1 - zMix : 1);
    set(this.#resonator.wet.gain, zOn ? zMix * dbToGain(num(z.gain)) : 0);
    this.#ringing(zSounds, {root: num(z.root), division: num(z.division), span: num(z.span), decay: num(z.decay), tilt: num(z.tilt)});
  }

  /** The bank's ringing: its convolver is made when the bank first sounds and joins the path while it does; its response is made for
   * these settings (once the edits pause), the old one ringing until the new one is in. Off, nothing is convolved and nothing waits. */
  #ringing(sounds: boolean, params: ResonatorParams) {
    const z = this.#resonator;
    if (!sounds) {
      this.#cancelRing?.(); this.#cancelRing = null; this.#ring = null;
      this.#join(false);
      return;
    }
    if (!z.ring) {
      const convolver = this.#keep(this.#context.createConvolver());
      // Not renormalised: Tilt and Gain are the bank's own, the response's size is the bodies' weights.
      convolver.normalize = false;
      wire(convolver, z.wet);
      z.ring = {convolvers: [convolver], entry: convolver, joined: false};
    }
    this.#join(true);
    const key = `${params.root}/${params.division}/${params.span}/${params.decay}/${params.tilt}`;
    if (key === this.#ring) return;
    this.#ring = key;
    this.#cancelRing?.(); this.#cancelRing = null;
    const ring = z.ring, rate = this.#context.sampleRate, first = ring.convolvers[0]!.buffer === null;
    const start = () => {
      this.#cancelRing = null;
      if (this.#closed) return;
      // The first response waits for the page's measure of the convolver (once, a few milliseconds).
      const measure = convolverLeaksNyquist();
      if (nyquistLeak === undefined) {
        let live = true;
        void measure.then(() => { if (live) start(); });
        this.#cancelRing = () => { live = false; };
        return;
      }
      const leaks = nyquistLeak, build = new ResonatorImpulse(rate, params);
      const slice = () => {
        this.#cancelRing = null;
        if (this.#closed) return;
        if (!build.step(RESONATOR_SLICE_WORK)) { this.#cancelRing = this.#defer(slice, 0); return; }
        if (leaks) this.#unleak();
        // Where the engine leaks, the response stands beside silence (the head of this file).
        const buffer = this.#context.createBuffer(leaks ? 2 : 1, build.data.length, rate);
        buffer.copyToChannel(build.data, 0);
        for (const convolver of ring.convolvers) convolver.buffer = buffer;
      };
      slice();
    };
    this.#cancelRing = this.#defer(start, first ? 0 : ROOM_PAUSE_MS);
  }

  /** Join the bank's input to its ringing, or part them: a node is parted only from what it is joined to. */
  #join(joined: boolean) {
    const z = this.#resonator, ring = z.ring;
    if (!ring || ring.joined === joined) return;
    if (joined) z.in.connect(ring.entry); else z.in.disconnect(ring.entry);
    ring.joined = joined;
  }

  /** Where the engine's convolver leaks (convolverLeaksNyquist): one convolver a side, each over the response beside silence, and from each
   * side's response half its silent half (the leak alone) taken away. Made once, before the first response is in, so nothing has rung yet. */
  #unleak() {
    const z = this.#resonator, ring = z.ring!, context = this.#context;
    if (ring.convolvers.length === 2) return;
    const joined = ring.joined;
    this.#join(false);
    // The input as two sides: a mono sound on both, a stereo sound (a reverb before the bank) on its own.
    const sides = this.#keep(context.createGain());
    sides.channelCount = 2; sides.channelCountMode = 'explicit'; sides.channelInterpretation = 'speakers';
    const split = this.#keep(context.createChannelSplitter(2)), merge = this.#keep(context.createChannelMerger(2));
    wire(sides, split);
    const convolvers = [ring.convolvers[0]!, this.#keep(context.createConvolver())];
    convolvers.forEach((convolver, side) => {
      const halves = this.#keep(context.createChannelSplitter(2)), leak = this.#keep(context.createGain());
      convolver.normalize = false; convolver.disconnect(); leak.gain.value = -1;
      split.connect(convolver, side); convolver.connect(halves);
      halves.connect(merge, 0, side); halves.connect(leak, 1); leak.connect(merge, 0, side);
    });
    merge.connect(z.wet);
    ring.convolvers = convolvers; ring.entry = sides;
    this.#join(joined);
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
    this.#closed = true; this.#cancelRoom?.(); this.#cancelRoom = null; this.#cancelRing?.(); this.#cancelRing = null;
    for (const node of this.#nodes) { try { node.disconnect(); } catch { /* already apart */ } }
  }
}
