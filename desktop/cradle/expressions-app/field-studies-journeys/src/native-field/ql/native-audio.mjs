/** Play the C++ owner's PCM, never a second oscillator or simulation.
 *
 * Scheduling is bounded, explicit and ahead of the device clock. Graph/source
 * queries, native-worker calls and JSON parsing do not run in an audio callback.
 * The caller owns authority and the native session; companions only read receipts.
 */
const OWNERS = new WeakMap();
const IDENTITY = ['event_ref', 'subject_ref', 'registry_revision', 'geometry_ref', 'material_ref', 'model_ref'];
const U64_MAX = (1n << 64n) - 1n;
const need = (ok, message) => { if (!ok) throw new Error(message); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
function cursor(value) {
  need(typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value), 'invalid exact native cursor');
  const result = BigInt(value); need(result <= U64_MAX, 'native cursor overflow'); return result;
}
function reference(value) {
  need(typeof value === 'string' && value.length > 0 && value.length <= 2048 &&
    !/[\u0000-\u001f\u007f]/u.test(value), 'missing or invalid native identity');
  return value;
}
// Canonicalise ONLY the bounded receipt, not the full geometry/source graph.
function stable(value, depth = 0) {
  need(depth <= 12, 'native receipt too deeply nested');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') { need(value.length <= 2048, 'oversized receipt string'); return value; }
  if (typeof value === 'number') {
    need(finite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)), 'inexact receipt number'); return value;
  }
  need(typeof value === 'object' && value !== null, 'invalid native receipt');
  const keys = Object.keys(value); need(keys.length <= 128, 'oversized native receipt');
  if (Array.isArray(value)) return value.map(v => stable(v, depth + 1));
  return Object.fromEntries(keys.sort().map(key => [key, stable(value[key], depth + 1)]));
}
function decode(frame, sampleRate) {
  need(frame?.schema === 'ql.continuous-field/v1', 'unsupported native field');
  need(frame.sample_rate === sampleRate, 'device/native sample-rate mismatch; no implicit resampling');
  const identity = Object.fromEntries(IDENTITY.map(key => [key, reference(frame[key])]));
  const generation = cursor(frame.generation), end = cursor(frame.samples_elapsed);
  need(Array.isArray(frame.audio) && frame.audio.length <= 8192 && BigInt(frame.audio.length) <= end,
    'invalid native PCM block length');
  need(frame.clock?.centre_ref === '#3-5-5/0' && frame.clock?.field_ref === '#3-0' &&
    frame.m2_identity?.event_ref === identity.event_ref, 'missing or unrelated native basis');
  const basis = stable({ ...identity, generation: frame.generation, samples_elapsed: frame.samples_elapsed,
    clock: frame.clock, m2_identity: frame.m2_identity, standing: reference(frame.standing) });
  const encoded = JSON.stringify(basis); need(encoded.length <= 32768, 'oversized native basis');
  const pcm = new Float32Array(frame.audio.length);
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const value = frame.audio[i];
    need(finite(value) && Math.abs(value) <= 3e38, 'nonfinite or unrepresentable native PCM');
    pcm[i] = value; peak = Math.max(peak, Math.abs(pcm[i]));
  }
  return { identity, generation, end, start: end - BigInt(pcm.length), basis, encoded, pcm, peak };
}

/** Exactly one audible receiver per actual native owner object in this realm.
 * A detached window must receive the original owner's read-only receipt, not
 * manufacture a new owner object. Cross-process authority remains the host's.
 */
export class NativeAudioBinding {
  #context; #owner; #gainNode; #gain; #muted; #identity; #source;
  #origin; #originTime; #lead; #maxFrames; #maxBlocks; #active = new Map();
  #lastAudio = null; #last = null; #closed = false; #held = false; #reason = null;
  #epoch = 0; #dropped = 0; #scheduled = 0; #listening = false; #stateChanged;

  constructor(context, { owner, initialFrame, gain = 0.1, muted = true, leadSeconds = 0.04,
                         maxQueuedFrames = Math.min(32768, context?.sampleRate * 2), maxBlocks = 64 } = {}) {
    need(owner && typeof owner === 'object' && !OWNERS.has(owner), 'native owner already has an audio receiver');
    need(context && typeof context.createBufferSource === 'function' && typeof context.createGain === 'function' &&
      context.state !== 'closed', 'usable audio context required');
    need(Number.isInteger(context.sampleRate) && context.sampleRate >= 8000 && context.sampleRate <= 192000,
      'unsupported device sample rate');
    need(finite(gain) && gain >= 0 && gain <= 1 && typeof muted === 'boolean', 'invalid explicit presentation gain/mute');
    need(finite(leadSeconds) && leadSeconds >= 0 && leadSeconds <= 0.5, 'invalid scheduling lead');
    need(Number.isInteger(maxQueuedFrames) && maxQueuedFrames >= 128 && maxQueuedFrames <= context.sampleRate * 2 &&
      Number.isInteger(maxBlocks) && maxBlocks >= 1 && maxBlocks <= 256, 'invalid audio queue ceiling');
    const initial = decode(initialFrame, context.sampleRate);
    need(initial.pcm.length === 0, 'attach to a native read receipt, not an already-produced audio interval');
    const gainNode = context.createGain();
    try {
      gainNode.gain.value = muted ? 0 : gain;
      gainNode.connect(context.destination);
    } catch (error) { gainNode.disconnect(); throw error; }
    this.#context = context; this.#owner = owner; this.#gainNode = gainNode; this.#gain = gain; this.#muted = muted;
    this.#identity = initial.identity; this.#source = initial;
    this.#lead = leadSeconds; this.#maxFrames = maxQueuedFrames; this.#maxBlocks = maxBlocks;
    this.#origin = initial.end;
    this.#originTime = this.#newOriginTime();
    this.#stateChanged = () => {
      if (context.state === 'closed') this.dispose();
      else if (context.state === 'running') this.#listening = true;
      else if (this.#listening) this.hold('audio-context-interrupted');
    };
    context.addEventListener?.('statechange', this.#stateChanged);
    this.#listening = context.state === 'running';
    OWNERS.set(owner, this);
    this.#receipt('attached', null);
  }
  #newOriginTime() {
    const context = this.#context;
    // Integer device sample boundary, not a fractional-block phase shift.
    return Math.ceil((context.currentTime + this.#lead) * context.sampleRate) / context.sampleRate;
  }
  #checkIdentity(packet) {
    for (const key of IDENTITY) need(packet.identity[key] === this.#identity[key], 'audio event/subject/source identity changed');
    need(packet.generation >= this.#source.generation && packet.end >= this.#source.end, 'stale native audio basis');
    if (packet.generation === this.#source.generation && packet.end === this.#source.end)
      need(packet.encoded === this.#source.encoded, 'conflicting basis at the same native cursor');
  }
  #prune() {
    for (const [node, item] of this.#active) if (item.endTime <= this.#context.currentTime) {
      node.onended = null; node.disconnect(); this.#active.delete(node);
    }
  }
  #receipt(status, interval) {
    this.#last = { schema: 'ql.native-audio-receipt/v1', native: this.#source.basis,
      device_epoch: this.#epoch, device_sample_rate: this.#context.sampleRate,
      native_origin: this.#origin.toString(), context_origin_seconds: this.#originTime,
      observed_context_seconds: this.#context.currentTime,
      target_context_seconds: this.#originTime + Number(this.#source.end - this.#origin) / this.#context.sampleRate,
      status, muted: this.#muted, presentation_gain: this.#gain,
      scheduled_blocks: this.#scheduled, discarded_blocks: this.#dropped,
      reason: this.#reason, interval,
      standing: 'native PCM scheduled on a browser audio graph; not proof of physical speaker output' };
    return structuredClone(this.#last);
  }
  get lastReceipt() { return structuredClone(this.#last); }
  get capacity() {
    this.#prune();
    const queued = [...this.#active.values()].reduce((sum, item) => sum + item.frames, 0);
    return Object.freeze({ blocks: this.#maxBlocks - this.#active.size, frames: this.#maxFrames - queued,
      held: this.#held, closed: this.#closed });
  }
  /** Pure wire admission, separate from queue capacity and device deadlines.
   * Management transport must validate PCM/bases before acknowledging a reply.
   * Holds still allow validation of the explicit native read used for re-entry.
   */
  validate(frame) {
    need(!this.#closed, 'audio receiver disposed');
    this.#checkIdentity(decode(frame, this.#context.sampleRate));
    return true;
  }
  /** Admit a contiguous native PCM interval exactly once. Refusal never advances
   * this receiver's cursor, and never rolls back an already-committed C++ owner.
   */
  apply(frame) {
    need(!this.#closed && !this.#held, 'audio receiver requires explicit recovery');
    const packet = decode(frame, this.#context.sampleRate);
    this.#checkIdentity(packet);
    if (packet.pcm.length === 0) {
      need(packet.end === this.#source.end, 'unheard native interval; rebase explicitly instead of silently skipping');
      this.#source = packet; return this.#receipt('source-read', null);
    }
    if (packet.end === this.#source.end && this.#lastAudio?.encoded === packet.encoded) {
      need(packet.pcm.length === this.#lastAudio.pcm.length && packet.pcm.every((v, i) => Object.is(v, this.#lastAudio.pcm[i])),
        'conflicting PCM at the same native cursor');
      // No node, allocation of a buffer, source cursor or playback is repeated.
      return this.#receipt('duplicate-not-scheduled', this.#last?.interval ?? null);
    }
    need(packet.start === this.#source.end, 'missing, overlapping or replayed native audio interval');
    need(packet.peak * this.#gain <= 1, 'presentation would clip; change explicit source/presentation gain');
    const capacity = this.capacity;
    need(capacity.blocks > 0 && capacity.frames >= packet.pcm.length, 'bounded audio queue full');
    const offset = packet.start - this.#origin;
    need(offset >= 0 && packet.end - this.#origin <= BigInt(Number.MAX_SAFE_INTEGER), 'device epoch exhausted; explicit rebase required');
    const startTime = this.#originTime + Number(offset) / this.#context.sampleRate;
    const endTime = this.#originTime + Number(packet.end - this.#origin) / this.#context.sampleRate;
    need(startTime >= this.#context.currentTime, 'late native audio; explicit rebase required');
    need(endTime - this.#context.currentTime <= this.#maxFrames / this.#context.sampleRate + this.#lead,
      'audio lookahead ceiling exceeded');
    let node;
    try {
      const buffer = this.#context.createBuffer(1, packet.pcm.length, this.#context.sampleRate);
      buffer.copyToChannel(packet.pcm, 0);
      node = this.#context.createBufferSource(); node.buffer = buffer; node.loop = false;
      node.playbackRate.value = 1; node.detune.value = 0;
      node.connect(this.#gainNode);
      node.onended = () => { node.disconnect(); this.#active.delete(node); };
      // Recheck after allocation. Web Audio otherwise silently starts late input
      // immediately, which would erase the explicit native/device clock relation.
      need(startTime >= this.#context.currentTime, 'allocation missed the audio deadline; rebase required');
      node.start(startTime);
    } catch (error) {
      if (node) { node.onended = null; try { node.stop(); } catch { /* not started */ } node.disconnect(); }
      throw error;
    }
    this.#active.set(node, { startTime, endTime, frames: packet.pcm.length });
    this.#source = packet; this.#lastAudio = packet; this.#scheduled++;
    return this.#receipt('scheduled', { native_start: packet.start.toString(), native_end: packet.end.toString(),
      frames: packet.pcm.length, start_context_seconds: startTime, end_context_seconds: endTime,
      // The target positions in the same packet are its END-of-block field state.
      target_context_seconds: endTime });
  }
  setMuted(muted) {
    need(!this.#closed && typeof muted === 'boolean', 'invalid mute operation');
    this.#gainNode.gain.setValueAtTime(muted ? 0 : this.#gain, this.#context.currentTime);
    this.#muted = muted;
    return this.#receipt('mute-changed-without-native-reset', null);
  }
  /** Halt and discard queued presentation, retaining the exact native basis.
   * This is not a provider query, a native reset, nor a claim that nothing played.
   */
  hold(reason = 'host-requested-hold') {
    need(!this.#closed, 'audio receiver disposed'); reference(reason);
    this.#prune();
    for (const node of this.#active.keys()) {
      node.onended = null; try { node.stop(); } catch { /* already ended */ } node.disconnect();
    }
    this.#dropped += this.#active.size; this.#active.clear();
    this.#held = true; this.#reason = reason;
    return this.#receipt('held-discarded-presentation', null);
  }
  /** Start a new device epoch from an explicit current native READ. Neither lost
   * sound nor elapsed wall time is manufactured. Original replay is a new owner.
   */
  rebase(readFrame, reason) {
    need(!this.#closed, 'audio receiver disposed'); reference(reason);
    const packet = decode(readFrame, this.#context.sampleRate);
    this.#checkIdentity(packet);
    need(packet.pcm.length === 0, 'rebase requires a native read receipt without PCM');
    // Full validation precedes dropping anything already scheduled.
    this.hold(reason);
    this.#source = packet; this.#origin = packet.end; this.#originTime = this.#newOriginTime();
    this.#lastAudio = null; this.#held = false; this.#reason = null; this.#epoch++; this.#scheduled = 0;
    return this.#receipt('rebased-with-explicit-discontinuity', null);
  }
  /** Keep the admitted native cursor and open a fresh device epoch around it.
   * Used when PCM for the next contiguous interval arrived after the previous
   * origin was already past — never advances or rewinds native samples.
   */
  realignClock(reason) {
    need(!this.#closed, 'audio receiver disposed'); reference(reason);
    this.hold(reason);
    this.#origin = this.#source.end; this.#originTime = this.#newOriginTime();
    this.#lastAudio = null; this.#held = false; this.#reason = null; this.#epoch++; this.#scheduled = 0;
    return this.#receipt('realigned-device-clock', null);
  }
  dispose() {
    if (this.#closed) return;
    this.hold('audio-receiver-disposed');
    this.#closed = true; this.#gainNode.disconnect();
    this.#context.removeEventListener?.('statechange', this.#stateChanged);
    OWNERS.delete(this.#owner);
    this.#receipt('disposed', null);
  }
}
