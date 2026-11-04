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

const EVENT_OPERATIONS = ['m1-advance', 'replace-event'];
// A struck point: the torus's sampled sheet is [0, 2*pi) in both angles, an act
// holds at most 64 points, and each impulse is within the scene body's declared
// 1.0 metre material policy (mirrors the native owner's own refusals).
const TAU = 2 * Math.PI;
const STRIKE_AT_MAX_POINTS = 64;
const STRIKE_AT_MAX_METRES = 1.0;
// stage-state is the Ta-Onta procedural stage's scoped disclosure: a read on
// the one owner — the field does not advance and the receipt is unchanged.
// score-resolve and score-state are the Tarot score's reads on the one owner
// (ql-mef continuous/host.rs score_operation): resolve holds the score over an
// admitted basis, state answers the held score with its currentness. Neither
// advances the field.
// torus-state is the Torus's M1′ session reading (ql-mef continuous/host.rs
// torus_operation): a read, the field unchanged. torus-checkpoint is the body
// as it rings with its form, forces, comma and seeds (ql.torus-checkpoint/v1):
// a read too, and so is torus-render: a take rendered offline on a second
// owner of the same scene (ql.torus-render/v1), this owner neither moving nor
// sounding.
const READ_OPERATIONS = ['read', 'inspect', 'influence', 'personal', 'receive-personal', 'stage-state',
  'score-resolve', 'score-state', 'torus-state', 'torus-checkpoint', 'torus-render'];
const SCORE_OPERATIONS = ['score-resolve', 'score-state'];
// The stage's acts on the one owner (ql-mef continuous/host.rs stage_operation).
// stage-evaluate runs an invoked procedure's plan. retire releases a procedure's
// own slots; bind and unbind change the live flow's bindings. These three do not
// advance the field: the host answers with its ql.stage-receipt/v1 and the field
// unchanged, so the ordinary cursor law (no generation, no samples) holds.
const STAGE_ACTS = ['stage-evaluate', 'stage-retire', 'stage-bind', 'stage-unbind'];
// The Torus's acts on the one owner (O-I #850). torus-play strikes the keys'
// moving points: one strike at points, one generation. torus-release moves no
// native state (the body rings on). torus-set moves none either, except a
// Fundamental edit, which is one modes continuation of the same voices. A
// torus-set for a later sample (O-I 855) waits and moves nothing; the advance
// whose block reaches its sample makes it there and names it in its
// torus_set_landed, a Fundamental made there being that block's one generation.
// torus-restore (O-I #855) rings the body again from a checkpoint: the event's
// modes and shape continuations when the event moved, the damping when it
// moved, and the body's state, so one to four generations, no samples, no PCM.
const TORUS_ACTS = ['torus-set', 'torus-play', 'torus-release', 'torus-restore'];
const TORUS_CHECKPOINT = 'ql.torus-checkpoint/v1';
// The owner's own bounds on one render (ql-mef scene_field.rs TORUS_RENDER_FRAMES_MAX, TORUS_RENDER_ACTS_MAX).
const TORUS_RENDER = 'ql.torus-render/v1';
const TORUS_RENDER_FRAMES_MAX = 2 ** 20;
const TORUS_RENDER_ACTS_MAX = 4096;
// The owner acts that move no native state by their own law: a release (the body rings on), a session edit other than the
// Fundamental, and the stage's retire, bind and unbind. Their acknowledgement is the field as it stands, so there is nothing
// to present: they claim no presentation block and are never refused for want of one (O-I #790: a dense clip releases as
// often as it strikes, and a release refused for presentation capacity left its note in the owner's count).
// A setting sent for a later sample than the cursor waits for it, and moves nothing now.
const waits = (command, cursor) => command.operation === 'torus-set' && command.at_samples_elapsed !== undefined &&
  BigInt(command.at_samples_elapsed) > BigInt(cursor);
const still = (command, cursor) => ['torus-release', 'stage-retire', 'stage-bind', 'stage-unbind'].includes(command.operation) ||
  (command.operation === 'torus-set' && (command.edit?.fundamental === undefined || waits(command, cursor)));
const JANKO_ROWS = 6;

export class InstrumentSession {
  #context; #owner; #port; #field; #audio; #native; #instance; #sequence;
  #block; #lookahead; #maxBlocks; #maxBytes; #timeout; #queue = []; #bytes = 0;
  #views = new Set(); #maxViews; #busy = false; #held = false; #uncertain = false;
  #disposed = false; #reason = null; #presented; #timer = null; #running = false;
  #generation = 0; #coalesced = 0; #influence = null; #stageReceipt = null; #torus = null; #torusPlay = null;
  #acts = []; #advances = { blocks: 0, frames: 0, first_samples_elapsed: null, last_samples_elapsed: null };

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

  /** The influence reading the last scene determinant acknowledgement carried. */
  get lastInfluence() { return this.#influence === null ? null : structuredClone(this.#influence); }
  /** The last stage act's own receipt (ql.stage-receipt/v1) as the owner returned it, or null before any. */
  get lastStageReceipt() { return this.#stageReceipt === null ? null : structuredClone(this.#stageReceipt); }
  /** The Torus's M1′ session reading the last Torus acknowledgement carried, or null before any. */
  get lastTorus() { return this.#torus === null ? null : structuredClone(this.#torus); }
  /** The last played Torus act's receipt (ql.torus-play/v1), or null before any. */
  get lastTorusPlay() { return this.#torusPlay === null ? null : structuredClone(this.#torusPlay); }

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

  /** The played-performance journal: a frozen independent copy of every admitted
   * owner act and the aggregate advance data plane. Refused exchanges and plain
   * inspection reads are not acts; the copy survives disposal. */
  journal() {
    return Object.freeze(structuredClone({ schema: 'ql.instrument-performance-journal/v1',
      instance_ref: this.#instance, acts: this.#acts, advances: this.#advances }));
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
      const changing = command.operation === 'set-axis' || command.operation === 'replace' ||
        command.operation === 'set-damping' || command.operation === 'strike' || command.operation === 'strike-at' ||
        command.operation === 'torus-play';
      // A Torus edit moves the owner only when it changes the Fundamental, and only when it is made now.
      const torusSet = command.operation === 'torus-set';
      const fundamental = torusSet && command.edit?.fundamental !== undefined && !waits(command, this.#native.samples_elapsed);
      // A block that made waiting settings at their samples moves one generation for each Fundamental it made.
      const landed = command.operation === 'advance' && Array.isArray(reply.torus_set_landed)
        ? BigInt(reply.torus_set_landed.filter(set => set?.applied === true && Array.isArray(set.moved) &&
          set.moved.includes('fundamental')).length) : 0n;
      const torusRestore = command.operation === 'torus-restore';
      // replace-event commits modes and, when required, shape. m1-advance
      // additionally commits inscription-axis alignment. replace-event's own
      // strike flag is a policy within the modes commit, not another generation.
      const event = EVENT_OPERATIONS.includes(command.operation);
      // A stage evaluation is the host's own compiled plan: 1..N admitted
      // applications (replace / set-damping / set-axis / strike / strike-at / m1-advance,
      // plus the generated passage's m1-advance ticks), so the generation
      // advances by the plan's own steps. Samples and PCM do not move: each
      // step's receipt is audio-empty and the plan never schedules data-plane
      // blocks — sound continues through the ordinary advance path.
      const stageEvaluation = command.operation === 'stage-evaluate';
      const frames = command.operation === 'advance' ? command.frames : 0;
      const before = cursor(this.#native.generation), after = cursor(frame.generation);
      const minimumEventDelta = command.operation === 'm1-advance' ? 2n : 1n;
      const maximumEventDelta = command.operation === 'm1-advance' ? 3n : 2n;
      need((event ? after >= before + minimumEventDelta && after <= before + maximumEventDelta
        : stageEvaluation ? after > before
        : torusSet ? after === before || (fundamental && after === before + 1n)
        : torusRestore ? after >= before + 1n && after <= before + 4n
        : after === before + (changing ? 1n : 0n) + landed) &&
        cursor(frame.samples_elapsed) === cursor(this.#native.samples_elapsed) + BigInt(frames) &&
        frame.audio.length === frames, 'host operation and native cursor disagree');
      if (READ_OPERATIONS.includes(command.operation)) need(unchanged, 'native read advanced or reset state');
      this.#sequence = next;
      // The native operation is now acknowledged even if presentation later
      // fails. Recovery reads this cursor; no claim of rolling native state back.
      this.#native = withoutAudio(frame);
      this.#journal(command, request.request_id);
      // A scene determinant acknowledgement carries its own influence reading.
      if (reply.influence !== undefined) this.#influence = structuredClone(reply.influence);
      // A Torus acknowledgement carries the session reading, and a played act its receipt.
      if (reply.torus !== undefined) this.#torus = structuredClone(reply.torus);
      if (reply.torus_play !== undefined) this.#torusPlay = structuredClone(reply.torus_play);
      // A stage acknowledgement carries the stage's own scoped body: the
      // ql.stage-state/v1 disclosure or the ql.stage-receipt/v1 claim.
      // A score acknowledgement carries the score, its currentness and the
      // field event it was resolved against.
      return { frame, sources: reply.sources, influence: reply.influence, personal: reply.personal, stage: reply.stage,
        score: reply.score, current: reply.current, resolved_event_ref: reply.resolved_event_ref,
        torus: reply.torus, torus_play: reply.torus_play, strike_at: reply.strike_at, torus_checkpoint: reply.torus_checkpoint,
        torus_render: reply.torus_render, torus_set_landed: reply.torus_set_landed };
    } catch (error) {
      this.#unknown(String(error)); throw error;
    } finally { clearTimeout(timer); }
  }

  /** Admitted-exchange record: data-plane advances aggregate into ranges; owner
   * acts and explicit recovery reads journal individually at their commit cursor. */
  #journal(command, requestId) {
    const acknowledged = { generation: this.#native.generation, samples_elapsed: this.#native.samples_elapsed };
    if (command.operation === 'advance') {
      const advances = this.#advances; advances.blocks++; advances.frames += command.frames;
      if (advances.first_samples_elapsed === null) advances.first_samples_elapsed = acknowledged.samples_elapsed;
      advances.last_samples_elapsed = acknowledged.samples_elapsed;
    } else if (command.operation === 'read') {
      this.#acts.push({ request_id: requestId, operation: command.operation, command: structuredClone(command), acknowledged, kind: 'recovery' });
    } else if (!READ_OPERATIONS.includes(command.operation)) {
      this.#acts.push({ request_id: requestId, operation: command.operation, command: structuredClone(command), acknowledged, kind: 'act' });
    }
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
   * It changes the existing native owner; no UI-local clock or second composer.
   * The Ta-Onta procedural stage's invoked procedure rides the same envelope:
   * the host compiles it into its own admitted applications and acknowledges
   * with the applied field, the new influence and the stage claim. Its retire,
   * bind and unbind ride it too, each acknowledged with its receipt and the
   * field unchanged. Every stage act's receipt is kept as lastStageReceipt. */
  async operate(command) {
    need(!this.#busy && !this.#held && !this.#disposed &&
      ['set-axis', 'replace', 'set-damping', 'strike', 'strike-at', ...EVENT_OPERATIONS, ...STAGE_ACTS, ...TORUS_ACTS].includes(command?.operation), 'domain operation requires idle admitted owner');
    this.present();
    const presents = !still(command, this.#native.samples_elapsed);
    need(!presents || this.#queue.length < this.#maxBlocks &&
      this.#bytes + JSON.stringify(this.#native).length * 2 <= this.#maxBytes, 'wait for bounded presentation capacity');
    this.#busy = true; const generation = this.#generation;
    try {
      const reply = await this.#exchange(command);
      need(!reply.refused, String(reply.error));
      if (STAGE_ACTS.includes(command.operation) && reply.stage !== undefined) this.#stageReceipt = structuredClone(reply.stage);
      if (generation !== this.#generation || this.#held || this.#disposed) return this.reading;
      // The exchange has held a still act to its law (the cursor unchanged, no PCM): the field it answers with is the one presented.
      if (!presents) return this.reading;
      try { this.#enqueue(reply.frame); } catch (error) { this.hold(`presentation-admission-failed: ${String(error)}`); throw error; }
      this.present(); return this.reading;
    } finally { this.#busy = false; }
  }

  /** The scene owner's acting-influence reading; never advances or resets. */
  async influence() {
    need(!this.#busy && !this.#held, 'inspection requires an idle admitted owner'); this.#busy = true;
    try {
      const reply = await this.#exchange({ operation: 'influence' });
      need(!reply.refused, String(reply.error)); this.#influence = structuredClone(reply.influence); return reply.influence;
    } finally { this.#busy = false; }
  }

  /** The Ta-Onta procedural stage's scoped disclosure (ql.stage-state/v1): the
   * live constituents, their effective values and each owned slot's procedure.
   * A read on the one owner: the field does not advance or reset. */
  async stageState() {
    need(!this.#busy && !this.#held, 'inspection requires an idle admitted owner'); this.#busy = true;
    try {
      const reply = await this.#exchange({ operation: 'stage-state' });
      need(!reply.refused, String(reply.error)); return reply.stage;
    } finally { this.#busy = false; }
  }

  /** The selected subject's Tarot score reading (`ql.tarot-score/v1`), held by
   * the scene owner: `score-resolve` resolves an admitted basis once and holds
   * it, `score-state` answers the held score with its currentness, never a
   * re-derivation. Both are reads: the field does not advance. A refusal is the
   * score owner's own named basis admission ("no anchor basis", a foreign
   * subject); it comes back as named data and the session stands unchanged. */
  async score(command) {
    need(SCORE_OPERATIONS.includes(command?.operation), 'the Tarot score operations are score-resolve and score-state');
    need(!this.#busy && !this.#held, 'inspection requires an idle admitted owner'); this.#busy = true;
    try {
      const reply = await this.#exchange(command);
      if (reply.refused) return { refused: true, error: String(reply.error ?? 'native command refused') };
      need(reply.score && typeof reply.score === 'object' && reply.score.schema === 'ql.tarot-score/v1',
        'the score acknowledgement carries no ql.tarot-score/v1 reading');
      return { refused: false, score: structuredClone(reply.score), current: reply.current === true,
        resolved_event_ref: String(reply.resolved_event_ref ?? '') };
    } finally { this.#busy = false; }
  }

  /** The sample a played act (or a setting, `what`) lands at (O-I #809, 855): absent,
   * the owner's cursor; given, an exact cursor at or after the acknowledged one. A sample
   * behind it is sound already rendered, refused before any exchange as the owner refuses it. */
  #landing(at, what = 'strike') {
    if (at === undefined) return {};
    need(typeof at === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(at) && BigInt(at) <= U64,
      `a ${what} names the sample it lands at as an exact sample cursor`);
    const cursor = this.#native.samples_elapsed;
    need(BigInt(at) >= BigInt(cursor),
      `a ${what} at sample ${at} is behind the owner's cursor ${cursor}: that sound is already rendered`);
    return { at_samples_elapsed: at };
  }

  /** A played excitation: strike named voices of the standing instrument, now
   * or at `at_samples_elapsed`, the sample of the continuation it lands at: a
   * player schedules ahead on the audio clock and the owner lands the act in its
   * render at exactly that sample (O-I #809). Each act names a native mode
   * reference (disclosed on the owner's influence voices) with an impulse in
   * modal metres. Serialized with data delivery like every other owner
   * operation; the reply's end-of-block targets present the struck body, so
   * sound and visible displacement share the native state. */
  async strike(strikes, { at_samples_elapsed } = {}) {
    need(Array.isArray(strikes) && strikes.length > 0 && strikes.length <= 4096, 'a strike act names 1..4096 voices');
    const acts = strikes.map(act => {
      need(act && typeof act.mode_ref === 'string' && act.mode_ref.length > 0 && act.mode_ref.length <= 2048,
        'invalid strike mode reference');
      need(Array.isArray(act.amplitude) && act.amplitude.length === 2 &&
        act.amplitude.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e6),
        'strike amplitude must be two finite metres');
      return { mode_ref: act.mode_ref, amplitude: [act.amplitude[0], act.amplitude[1]] };
    });
    return this.operate({ operation: 'strike', strikes: acts, ...this.#landing(at_samples_elapsed) });
  }

  /** A played excitation of the torus surface: strike the standing body at the
   * points of the surface touched or keyed, now. A point is the torus's own
   * angles on the sampled sheet - theta the poloidal (small) circle and phi the
   * toroidal (large) circle, each in [0, 2*pi) - with an impulse in modal
   * metres; the native owner's scene body excites every standing voice by that
   * impulse times the voice's own shape at the point (QL-MEF `strike-at`, the
   * receipt `ql.strike-at/v1` names the points and each voice's coupling). A
   * chord is several points in one act: one generation. Serialized with data
   * delivery like every other owner operation; the reply's end-of-block targets
   * present the struck body, so sound and visible displacement share the
   * native state. An angle outside the sampled sheet is refused, never reduced:
   * the mode shapes change sign across its seam. `at_samples_elapsed` names the
   * sample the act lands at, as for `strike`. */
  async strikeAt(points, { at_samples_elapsed } = {}) {
    need(Array.isArray(points) && points.length > 0 && points.length <= STRIKE_AT_MAX_POINTS,
      `a strike-at act names 1..${STRIKE_AT_MAX_POINTS} points`);
    const acts = points.map(point => {
      need(point && [point.theta, point.phi].every(angle => typeof angle === 'number' && Number.isFinite(angle) &&
        angle >= 0 && angle < TAU), 'a struck point names theta and phi as finite angles in [0, 2*pi): the sampled sheet of the torus');
      need(Array.isArray(point.amplitude) && point.amplitude.length === 2 &&
        point.amplitude.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= STRIKE_AT_MAX_METRES),
        `a struck point's amplitude must be two finite metres within ${STRIKE_AT_MAX_METRES.toFixed(1)}`);
      return { theta: point.theta, phi: point.phi, amplitude: [point.amplitude[0], point.amplitude[1]] };
    });
    return this.operate({ operation: 'strike-at', points: acts, ...this.#landing(at_samples_elapsed) });
  }

  /** The Torus's M1′ session (`ql.m1-prime-session/v1`): every setting, the band
   * beside the rate, the pulse, the shape, the comma gathered since the Torus
   * opened and the sounding notes. A read: the field does not advance. */
  async torusState() {
    need(!this.#busy && !this.#held, 'inspection requires an idle admitted owner'); this.#busy = true;
    try {
      const reply = await this.#exchange({ operation: 'torus-state' });
      need(!reply.refused, String(reply.error)); this.#torus = structuredClone(reply.torus); return reply.torus;
    } finally { this.#busy = false; }
  }

  /** The Torus as it rings (`ql.torus-checkpoint/v1`): the body's state, its
   * form, forces, comma and seeds, taken at the acknowledged sample. A read:
   * the field does not advance. Pending timed acts are not kept; the
   * performance journal keeps them. */
  async torusCheckpoint() {
    need(!this.#busy && !this.#held, 'inspection requires an idle admitted owner'); this.#busy = true;
    try {
      const reply = await this.#exchange({ operation: 'torus-checkpoint' });
      need(!reply.refused, String(reply.error));
      need(reply.torus_checkpoint?.schema === TORUS_CHECKPOINT, 'the owner answered with no Torus checkpoint');
      this.#torus = structuredClone(reply.torus); return structuredClone(reply.torus_checkpoint);
    } finally { this.#busy = false; }
  }

  /** Ring the Torus again from a checkpoint the owner gave: one owner act, which
   * the owner refuses in words when the checkpoint is not of this body. */
  async torusRestore(checkpoint) {
    need(checkpoint && typeof checkpoint === 'object' && !Array.isArray(checkpoint) && checkpoint.schema === TORUS_CHECKPOINT,
      `a Torus restore takes the owner's ${TORUS_CHECKPOINT}`);
    return this.operate({ operation: 'torus-restore', checkpoint: structuredClone(checkpoint) });
  }

  /** A take rendered offline (`ql.torus-render/v1`, O-I #855): from `checkpoint` on a
   * second owner of the same scene, or continuing the last render (`continues`, the
   * token its answer gave), `frames` of sound with each act ({action:'strike', keys,
   * amplitude} | {action:'release', keys} | {action:'set', edit}, each with the
   * `at_samples_elapsed` it lands at, in the order of their samples) made at its sample.
   * A read: this owner neither moves nor sounds. The answer keeps the render owner's
   * sound, the notes that made way strike by strike, where it ended as a checkpoint and
   * the token that continues it. A longer take renders in parts. */
  async torusRender({ checkpoint, continues, acts = [], frames } = {}) {
    need((checkpoint === undefined) !== (continues === undefined), 'a render takes either a checkpoint or the render it continues');
    if (checkpoint !== undefined) need(checkpoint && typeof checkpoint === 'object' && !Array.isArray(checkpoint) &&
      checkpoint.schema === TORUS_CHECKPOINT, `a render begins from the owner's ${TORUS_CHECKPOINT}`);
    if (continues !== undefined) need(typeof continues === 'string' && continues.length > 0 && continues.length <= 256,
      'continues names the render its answer gave');
    need(Number.isSafeInteger(frames) && frames >= 1 && frames <= TORUS_RENDER_FRAMES_MAX,
      `a render takes 1 to ${TORUS_RENDER_FRAMES_MAX} frames; a longer take renders in parts`);
    need(Array.isArray(acts) && acts.length <= TORUS_RENDER_ACTS_MAX, `a render takes at most ${TORUS_RENDER_ACTS_MAX} acts`);
    const taken = acts.map(act => {
      need(act && typeof act === 'object' && typeof act.at_samples_elapsed === 'string' &&
        /^(0|[1-9][0-9]{0,19})$/.test(act.at_samples_elapsed) && BigInt(act.at_samples_elapsed) <= U64,
        'a take\'s act names the sample it lands at as an exact sample cursor');
      const at_samples_elapsed = act.at_samples_elapsed;
      if (act.action === 'strike') {
        const amplitude = act.amplitude;
        need(Array.isArray(amplitude) && amplitude.length === 2 &&
          amplitude.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= STRIKE_AT_MAX_METRES),
          `a Torus act's amplitude must be two finite metres within ${STRIKE_AT_MAX_METRES.toFixed(1)}`);
        return { action: 'strike', at_samples_elapsed, keys: this.#keys(act.keys), amplitude: [amplitude[0], amplitude[1]] };
      }
      if (act.action === 'release') return { action: 'release', at_samples_elapsed, keys: this.#keys(act.keys) };
      if (act.action === 'set') {
        need(act.edit && typeof act.edit === 'object' && !Array.isArray(act.edit) && Object.keys(act.edit).length > 0,
          'a Torus edit names at least one setting');
        return { action: 'set', at_samples_elapsed, edit: structuredClone(act.edit) };
      }
      return need(false, 'a take\'s act is a strike, release or set');
    });
    need(!this.#busy && !this.#held, 'a render requires an idle admitted owner'); this.#busy = true;
    try {
      const command = { operation: 'torus-render', ...(checkpoint === undefined ? { continues } : { checkpoint: structuredClone(checkpoint) }),
        acts: taken, frames };
      const reply = await this.#exchange(command);
      need(!reply.refused, String(reply.error));
      const render = reply.torus_render;
      need(render?.schema === TORUS_RENDER && Array.isArray(render.audio) && render.audio.length === frames &&
        render.audio.every(Number.isFinite) && render.checkpoint?.schema === TORUS_CHECKPOINT && typeof render.continues === 'string',
        'the owner answered with no render of the take');
      return render;
    } finally { this.#busy = false; }
  }

  /** One edit of the Torus session: any of rate ({mode:'free', steps_per_second}
   * or {mode:'sync', note:{numerator, denominator}}), tempo_bpm, fundamental
   * ({source:'map'} or {source:'hz', hz}), carrier, shape, tuning and polyphony.
   * The owner validates and refuses in words; the reply's session reading is
   * kept as lastTorus and its influence as lastInfluence. `at_samples_elapsed`
   * names the sample it is made at, as for `strike` (O-I 855): for a later sample
   * it waits, moving nothing, and the block that reaches that sample makes it
   * there, its reading and influence then kept from that block's reply. */
  async torusSet(edit, { at_samples_elapsed } = {}) {
    need(edit && typeof edit === 'object' && !Array.isArray(edit) && Object.keys(edit).length > 0,
      'a Torus edit names at least one setting');
    return this.operate({ operation: 'torus-set', edit: structuredClone(edit), ...this.#landing(at_samples_elapsed, 'setting') });
  }

  #keys(keys) {
    need(Array.isArray(keys) && keys.length > 0 && keys.length <= 32, 'a Torus act names 1..32 keys');
    return keys.map(key => {
      need(key && Number.isInteger(key.row) && key.row >= 0 && key.row < JANKO_ROWS &&
        Number.isInteger(key.column) && key.column >= 0 && key.column <= 65535,
        'a Jankó key names its row (0..5) and column');
      return { row: key.row, column: key.column };
    });
  }

  /** Keys of the Jankó surface strike their moving points on the voices of the
   * tuning in force: one strike at points, one generation. Each key is a new
   * note; past Polyphony the oldest make way. The receipt (ql.torus-play/v1:
   * each note's place, point and own cell) is kept as lastTorusPlay.
   * `at_samples_elapsed` names the sample the act lands at, as for `strike`. */
  async torusPlay(keys, { amplitude = [0.05, 0], at_samples_elapsed } = {}) {
    const acts = this.#keys(keys);
    need(Array.isArray(amplitude) && amplitude.length === 2 &&
      amplitude.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= STRIKE_AT_MAX_METRES),
      `a Torus act's amplitude must be two finite metres within ${STRIKE_AT_MAX_METRES.toFixed(1)}`);
    return this.operate({ operation: 'torus-play', keys: acts, amplitude: [amplitude[0], amplitude[1]],
      ...this.#landing(at_samples_elapsed) });
  }

  /** Release keys from the count of notes; the body rings on, so no native state moves. */
  async torusRelease(keys) {
    return this.operate({ operation: 'torus-release', keys: this.#keys(keys) });
  }

  /** A Nara-constituted scene owner's reception: `input` (seven supplied centre
   * inputs citing the current event) receives; without it, reads. The material
   * field never changes. Protected state stays with the calling host. */
  async personal(input) {
    need(!this.#busy && !this.#held, 'inspection requires an idle admitted owner'); this.#busy = true;
    try {
      const reply = await this.#exchange(input === undefined ? { operation: 'personal' } : { operation: 'receive-personal', input });
      need(!reply.refused, String(reply.error)); return reply.personal;
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
