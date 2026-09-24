/** One managed native owner supplies PCM and identified field targets together.
 * The transport is the host-authorised ql-field-host pipe adapter, not a URL,
 * executable name, or authority grant. Companion views only receive readings.
 */
import { NativeAudioBinding } from './native-audio.mjs';
const OWNERS = new WeakSet();
const need = (ok, message) => { if (!ok) throw new Error(message); };
const U64 = (1n << 64n) - 1n;
function cursor(text) {
  need(typeof text === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(text), 'invalid instrument cursor');
  const value = BigInt(text); need(value <= U64, 'instrument cursor overflow'); return value;
}
function withoutAudio(frame) { return { ...structuredClone(frame), audio: [] }; }
function sameState(a, b) {
  // Named source fields are compared by the audio receiver. Resident arrays and
  // the native cursor must also stay unchanged on a read/refusal.
  return a.generation === b.generation && a.samples_elapsed === b.samples_elapsed &&
    JSON.stringify(a.targets) === JSON.stringify(b.targets) &&
    JSON.stringify(a.amplitudes_metres) === JSON.stringify(b.amplitudes_metres) &&
    JSON.stringify(a.clock) === JSON.stringify(b.clock) &&
    JSON.stringify(a.m2_identity) === JSON.stringify(b.m2_identity);
}

export class InstrumentSession {
  #context; #owner; #port; #field; #audio; #native; #instance; #sequence;
  #block; #lookahead; #maxBlocks; #maxBytes; #timeout; #queue = []; #bytes = 0;
  #views = new Set(); #maxViews; #busy = false; #held = false; #uncertain = false;
  #disposed = false; #reason = null; #presented; #timer = null; #running = false;
  #generation = 0; #coalesced = 0;

  constructor({ context, owner, transport, initialReceipt, fieldBinding,
    blockFrames = 512, lookaheadSeconds = 0.1, maxBlocks = 16,
    maxQueuedBytes = 16 * 1024 * 1024, maxViews = 32, timeoutMs = 5000,
    gain = 0.1, muted = true, leadSeconds = 0.04 } = {}) {
    need(owner && typeof owner === 'object' && !OWNERS.has(owner), 'native owner already has an instrument driver');
    need(transport && typeof transport.request === 'function', 'authorised native transport required');
    need(fieldBinding && typeof fieldBinding.validate === 'function' && typeof fieldBinding.apply === 'function',
      'retained field admission/application interface required');
    need(initialReceipt?.schema === 'ql.field-host-receipt/v1' && initialReceipt.status === 'ready' &&
      initialReceipt.available === true && typeof initialReceipt.instance_ref === 'string' &&
      initialReceipt.instance_ref.length > 0 && initialReceipt.instance_ref.length <= 2048, 'native ready receipt required');
    need(Number.isInteger(blockFrames) && blockFrames >= 128 && blockFrames <= 8192, 'unsupported native block size');
    need(Number.isFinite(lookaheadSeconds) && lookaheadSeconds >= 0.01 && lookaheadSeconds <= 0.5 &&
      blockFrames / context.sampleRate <= lookaheadSeconds && leadSeconds <= lookaheadSeconds, 'invalid lookahead');
    need(Number.isInteger(maxBlocks) && maxBlocks >= 1 && maxBlocks <= 128 &&
      Number.isInteger(maxQueuedBytes) && maxQueuedBytes >= 65536 && maxQueuedBytes <= 64 * 1024 * 1024 &&
      Number.isInteger(maxViews) && maxViews >= 1 && maxViews <= 256 &&
      Number.isInteger(timeoutMs) && timeoutMs >= 100 && timeoutMs <= 120000, 'invalid instrument ceilings');
    this.#sequence = cursor(initialReceipt.last_request_id);
    this.#native = withoutAudio(initialReceipt.field);
    need(initialReceipt.field.audio.length === 0, 'attach through native read, not replayed sound');
    fieldBinding.validate(this.#native);
    this.#audio = new NativeAudioBinding(context, { owner, initialFrame: this.#native, gain, muted, leadSeconds,
      maxQueuedFrames: Math.min(context.sampleRate * 2, Math.max(32768, blockFrames * maxBlocks)), maxBlocks });
    this.#context = context; this.#owner = owner; this.#port = transport; this.#field = fieldBinding;
    this.#instance = initialReceipt.instance_ref; this.#block = blockFrames; this.#lookahead = lookaheadSeconds;
    this.#maxBlocks = maxBlocks; this.#maxBytes = maxQueuedBytes; this.#maxViews = maxViews; this.#timeout = timeoutMs;
    this.#presented = { generation: this.#native.generation, samples_elapsed: this.#native.samples_elapsed };
    OWNERS.add(owner);
  }

  get reading() {
    return { schema: 'ql.instrument-reading/v1', instance_ref: this.#instance,
      event_ref: this.#native.event_ref, subject_ref: this.#native.subject_ref,
      acknowledged: { generation: this.#native.generation, samples_elapsed: this.#native.samples_elapsed },
      presented: { ...this.#presented }, audio: this.#audio.lastReceipt,
      available: !this.#uncertain && !this.#disposed, held: this.#held || this.#audio.capacity.held,
      reason: this.#reason, in_flight: this.#busy, queued_blocks: this.#queue.length,
      queued_bytes: this.#bytes, coalesced_presentation_frames: this.#coalesced,
      views: this.#views.size, disposed: this.#disposed };
  }

  /** The host must authorise disclosure before passing even this reference-only
   * view to another window. No raw target, PCM, personal basis or command port. */
  openView() {
    need(!this.#disposed && this.#views.size < this.#maxViews, 'view ceiling or disposed driver');
    const token = {}; this.#views.add(token);
    return Object.freeze({ read: () => {
      need(this.#views.has(token) && !this.#disposed, 'view closed');
      const value = this.reading;
      // Audio's internal native clock/basis belongs to the owner, not ambient
      // companion context. Disclose only the scheduling relation here.
      value.audio = { status: value.audio.status, muted: value.audio.muted,
        device_epoch: value.audio.device_epoch, target_context_seconds: value.audio.target_context_seconds };
      return value;
    }, close: () => this.#views.delete(token) });
  }

  #cancelTimer() { if (this.#timer !== null) clearTimeout(this.#timer); this.#timer = null; }
  hold(reason = 'host-presentation-hold') {
    need(!this.#disposed && typeof reason === 'string' && reason.length > 0 && reason.length <= 2048, 'invalid hold');
    this.#cancelTimer(); this.#running = false; this.#held = true; this.#reason = reason; this.#generation++;
    if (!this.#audio.capacity.closed) this.#audio.hold(reason);
    this.#queue = []; this.#bytes = 0;
    return this.reading;
  }
  #unknown(reason) {
    this.#uncertain = true;
    if (!this.#disposed) this.hold(reason);
    this.#port.close?.();
  }
  setMuted(muted) { this.#audio.setMuted(muted); return this.reading; }

  async #exchange(command) {
    need(!this.#disposed && !this.#uncertain, 'unknown/disposed native owner; no automatic retry');
    const next = this.#sequence + 1n; need(next <= U64, 'host sequence exhausted');
    const request = { schema: 'ql.field-host-request/v1', instance_ref: this.#instance,
      event_ref: this.#native.event_ref, subject_ref: this.#native.subject_ref,
      request_id: next.toString(), expected_generation: this.#native.generation,
      expected_samples_elapsed: this.#native.samples_elapsed, command: structuredClone(command) };
    let timer;
    try {
      const reply = await Promise.race([Promise.resolve().then(() => this.#port.request(request)),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('native acknowledgement timed out')), this.#timeout); })]);
      need(!this.#disposed, 'driver disposed during native operation');
      need(reply?.schema === 'ql.field-host-receipt/v1' && reply.instance_ref === this.#instance &&
        reply.request_id === request.request_id && reply.last_request_id === request.request_id, 'foreign or reordered host acknowledgement');
      need(reply.available === true && (reply.status === 'ok' || reply.status === 'refused'), 'native acknowledgement standing unknown');
      const frame = reply.field;
      need(frame?.event_ref === this.#native.event_ref && frame?.subject_ref === this.#native.subject_ref &&
        frame?.sample_rate === this.#native.sample_rate && Array.isArray(frame.audio), 'foreign/malformed native field');
      need(JSON.stringify(frame).length * 2 <= this.#maxBytes, 'native field exceeds presentation memory ceiling');
      this.#field.validate(frame); // PURE: future targets cannot run ahead of sound.
      this.#audio.validate(frame); // Malformed PCM/bases are transport uncertainty, not a device failure.
      const unchanged = sameState(frame, this.#native);
      if (reply.status === 'refused') {
        need(unchanged && frame.audio.length === 0, 'refused command changed state or replayed PCM');
        this.#sequence = next;
        return { refused: true, error: reply.error ?? 'native command refused' };
      }
      const changing = command.operation === 'set-axis' || command.operation === 'replace';
      const frames = command.operation === 'advance' ? command.frames : 0;
      need(cursor(frame.generation) === cursor(this.#native.generation) + (changing ? 1n : 0n) &&
        cursor(frame.samples_elapsed) === cursor(this.#native.samples_elapsed) + BigInt(frames) &&
        frame.audio.length === frames, 'host operation and native cursor disagree');
      if (command.operation === 'read' || command.operation === 'inspect') need(unchanged, 'native read advanced or reset state');
      this.#sequence = next;
      // The native operation is now acknowledged even if presentation later
      // fails. Recovery reads this cursor; no claim of rolling native state back.
      this.#native = withoutAudio(frame);
      return { frame, sources: reply.sources };
    } catch (error) {
      this.#unknown(String(error)); throw error;
    } finally { clearTimeout(timer); }
  }

  #enqueue(frame) {
    try {
      return this.#admit(frame);
    } catch (error) {
      // Device clock can outrun the lead on a stalled main thread after an
      // already-acknowledged advance. Rebase to that cursor once and retry;
      // a second refusal still holds for explicit recovery.
      if (!/late native audio|allocation missed the audio deadline/.test(String(error))) throw error;
      this.#audio.realignClock('late-native-audio-realign');
      return this.#admit(frame);
    }
  }

  #admit(frame) {
    const presentation = withoutAudio(frame), bytes = JSON.stringify(presentation).length * 2;
    need(this.#queue.length < this.#maxBlocks && this.#bytes + bytes <= this.#maxBytes, 'bounded target queue full');
    const receipt = this.#audio.apply(frame);
    this.#queue.push({ frame: presentation, bytes, time: receipt.target_context_seconds }); this.#bytes += bytes;
    return receipt;
  }

  /** Apply only END-of-block targets whose matching PCM time has arrived.
   * Skipped visual frames coalesce explicitly; no second integration or reseed. */
  present() {
    if (this.#disposed || this.#held || this.#audio.capacity.held) return this.reading;
    let selected = null, removed = 0;
    while (this.#queue.length && this.#queue[0].time <= this.#context.currentTime) {
      selected = this.#queue.shift(); this.#bytes -= selected.bytes; removed++;
    }
    if (selected) {
      try {
        this.#field.apply(selected.frame);
        this.#presented = { generation: selected.frame.generation, samples_elapsed: selected.frame.samples_elapsed };
        this.#coalesced += Math.max(0, removed - 1);
      } catch (error) { this.hold(`retained-field-application-failed: ${String(error)}`); throw error; }
    }
    return this.reading;
  }

  /** One bounded data-plane advance, never concurrent and never a catch-up burst.
   * Full source inspection, models and graph work stay outside this path. */
  async pump() {
    need(!this.#disposed, 'driver disposed');
    this.present();
    const capacity = this.#audio.capacity, audio = this.#audio.lastReceipt;
    if (capacity.held || capacity.closed) {
      if (!this.#held) this.hold('audio-context-requires-explicit-recovery');
      return this.reading;
    }
    if (this.#busy || this.#held || this.#uncertain) return this.reading;
    const estimate = JSON.stringify(this.#native).length * 2;
    // target_context_seconds is the device time of the last admitted END cursor,
    // including the empty post-rebase origin. That origin sits lead-seconds in the
    // future with nothing scheduled yet — do not treat it as filled lookahead.
    const scheduledAhead = this.#audio.lastReceipt?.scheduled_blocks > 0 || this.#queue.length > 0;
    const fillHorizon = scheduledAhead
      ? audio.target_context_seconds + this.#block / this.#context.sampleRate - this.#context.currentTime
      : 0;
    if (capacity.frames < this.#block || !capacity.blocks || this.#queue.length >= this.#maxBlocks ||
      this.#bytes + estimate > this.#maxBytes || fillHorizon > this.#lookahead)
      return this.reading;
    this.#busy = true; const generation = this.#generation;
    try {
      const reply = await this.#exchange({ operation: 'advance', frames: this.#block, muted: false });
      if (reply.refused) { this.hold(String(reply.error)); return this.reading; }
      if (generation !== this.#generation || this.#held || this.#disposed) return this.reading;
      try { this.#enqueue(reply.frame); } catch (error) { this.hold(`presentation-admission-failed: ${String(error)}`); throw error; }
      this.present(); return this.reading;
    } finally { this.#busy = false; }
  }

  /** Explicit owner-authorised domain change, serialized with data delivery.
   * It changes the existing native owner; no UI-local clock or second composer. */
  async operate(command) {
    need(!this.#busy && !this.#held && !this.#disposed &&
      ['set-axis', 'replace'].includes(command?.operation), 'domain operation requires idle admitted owner');
    this.present();
    need(this.#queue.length < this.#maxBlocks &&
      this.#bytes + JSON.stringify(this.#native).length * 2 <= this.#maxBytes, 'wait for bounded presentation capacity');
    this.#busy = true; const generation = this.#generation;
    try {
      const reply = await this.#exchange(command);
      need(!reply.refused, String(reply.error));
      if (generation !== this.#generation || this.#held || this.#disposed) return this.reading;
      try { this.#enqueue(reply.frame); } catch (error) { this.hold(`presentation-admission-failed: ${String(error)}`); throw error; }
      this.present(); return this.reading;
    } finally { this.#busy = false; }
  }

  async inspect() {
    need(!this.#busy && !this.#held, 'inspection requires an idle admitted owner'); this.#busy = true;
    try {
      const reply = await this.#exchange({ operation: 'inspect' });
      need(!reply.refused, String(reply.error)); return reply.sources;
    } finally { this.#busy = false; }
  }

  /** Explicit re-entry after device interruption/late delivery, not provider-loss
   * replay. Unknown native acknowledgements require a separately opened owner. */
  async recover(reason) {
    need(!this.#busy && !this.#uncertain && !this.#disposed, 'cannot reconcile an unknown or in-flight native operation');
    this.hold(reason); this.#busy = true;
    try {
      const reply = await this.#exchange({ operation: 'read' });
      need(!reply.refused, String(reply.error));
      this.#audio.rebase(reply.frame, reason);
      this.#field.apply(reply.frame);
      this.#presented = { generation: reply.frame.generation, samples_elapsed: reply.frame.samples_elapsed };
      this.#held = false; this.#reason = null;
      return this.reading;
    } finally { this.#busy = false; }
  }

  start(periodMs = 8) {
    need(!this.#disposed && !this.#held && !this.#uncertain && Number.isInteger(periodMs) &&
      periodMs >= 4 && periodMs <= 100, 'invalid driver start');
    if (this.#running) return;
    this.#running = true;
    const tick = async () => {
      this.#timer = null;
      try { await this.pump(); } catch (error) { if (!this.#disposed && !this.#held) this.hold(String(error)); }
      if (this.#running && !this.#disposed && !this.#held) this.#timer = setTimeout(tick, periodMs);
    };
    this.#timer = setTimeout(tick, 0);
  }

  dispose() {
    if (this.#disposed) return;
    this.hold('instrument-driver-disposed'); this.#disposed = true;
    this.#audio.dispose(); this.#views.clear(); this.#port.close?.(); OWNERS.delete(this.#owner);
    // Retained renderer destruction/checkpoint and native material lifecycle
    // remain with their actual host. This class never seeds or steps particles.
  }
}
