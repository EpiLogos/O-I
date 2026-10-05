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


const reference = value => typeof value === 'string' && value.length > 0 && value.length <= 2048 &&
  !/[\u0000-\u001f\u007f]/u.test(value);
function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function sourceRequest(intent, context) {
  need(exactKeys(intent, ['selection', 'lease', 'actor']) && reference(intent.lease) && reference(intent.actor),
    'closed selected-source intent required');
  const selection = intent.selection;
  need(exactKeys(selection, ['expression_ref', 'document_revision', 'scene_ref', 'scene_revision']) &&
    reference(selection.expression_ref) && reference(selection.scene_ref) &&
    Number.isSafeInteger(selection.document_revision) && selection.document_revision > 0 &&
    Number.isSafeInteger(selection.scene_revision) && selection.scene_revision > 0,
    'selected-source intent requires exact native refs/current CAS');
  return Object.freeze({ selection: Object.freeze({ ...selection }), lease: intent.lease, actor: intent.actor,
    expected_request_id: context.next_request_id, expected_generation: context.expected_generation,
    expected_samples_elapsed: context.expected_samples_elapsed });
}
function nativeSnapshot(frame) {
  const snapshot = structuredClone(frame), remaining = [snapshot];
  while (remaining.length) {
    const value = remaining.pop();
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) if (child && typeof child === 'object') remaining.push(child);
      Object.freeze(value);
    }
  }
  return snapshot; // Bounded current native frame only; never disclosed or altered.
}
function sameSourceRequest(a, b) {
  const keys = ['selection', 'lease', 'actor', 'expected_request_id', 'expected_generation', 'expected_samples_elapsed'];
  return exactKeys(a, keys) && exactKeys(b, keys) &&
    ['lease', 'actor', 'expected_request_id', 'expected_generation', 'expected_samples_elapsed'].every(key => a[key] === b[key]) &&
    exactKeys(a.selection, ['expression_ref', 'document_revision', 'scene_ref', 'scene_revision']) &&
    ['expression_ref', 'document_revision', 'scene_ref', 'scene_revision'].every(key => a.selection[key] === b.selection[key]);
}

/** Pure discrimination only. This does not create a Session, native lease,
 * Source completion, clock capability or acknowledgement from saved values. */
export function validateSelectedSourceDocumentRecovery(result, originalRequest, context, native, maxBytes) {
  need(result?.schema === 'oi.native-expression-selected-scene-source/v1' &&
    result.recovered === true && result.replayed === false && result.recovery_current === true &&
    result.recovery_currentness === null && result.native_ordered_receipt_pending === false,
    'original closed selected-source recovery is not current');
  need(sameSourceRequest(result.original_request, originalRequest) && result.lease === originalRequest.lease &&
    originalRequest.expected_request_id === context.next_request_id &&
    originalRequest.expected_generation === context.expected_generation &&
    originalRequest.expected_samples_elapsed === context.expected_samples_elapsed,
    'selected-source recovery changed the sealed original request');
  const actual = result.native_result, reply = actual?.host_receipt;
  need(actual?.schema === 'ql.native-act-owner-result/v1' && actual.available === true &&
    actual.instance_ref === context.instance_ref && actual.request_id === context.next_request_id &&
    actual.last_request_id === context.next_request_id && ['ok', 'refused'].includes(actual.status),
    'selected-source recovery lacks its original actual Act result');
  need(reply?.schema === 'ql.field-host-receipt/v1' && reply.available === true &&
    reply.instance_ref === context.instance_ref && reply.request_id === context.next_request_id &&
    reply.last_request_id === context.next_request_id && reply.status === actual.status &&
    Array.isArray(result.native_procedural_receipts) && result.native_procedural_receipts.length === 1 &&
    JSON.stringify(result.native_procedural_receipts[0]) === JSON.stringify(reply),
    'selected-source recovery lacks its exact original Host receipt');
  const frame = reply.field;
  need(frame && frame.event_ref === context.event_ref && frame.subject_ref === context.subject_ref &&
    frame.generation === context.expected_generation && frame.samples_elapsed === context.expected_samples_elapsed &&
    Array.isArray(frame.audio) && frame.audio.length === 0 &&
    JSON.stringify(withoutAudio(frame)) === JSON.stringify(native),
    'selected-source recovery changed native FIELD source/state or replayed PCM');
  need(Number.isSafeInteger(maxBytes) && maxBytes > 0 && JSON.stringify(frame).length * 2 <= maxBytes,
    'selected-source recovery field exceeds its original ceiling');
  need(Object.hasOwn(result, 'document_result') && Array.isArray(result.document_receipts),
    'selected-source recovery omitted its original Document outcome');
  return reply; // Evidence projection only; private Session custody admits it.
}

const STAGE_INTENT_KEYS = ['basis','operation_ref','source','profile','authored','choice','scope','action'];
function sameJSON(a, b) {
  const pending = [[a, b]];
  while (pending.length) {
    const [left, right] = pending.pop();
    if (left === right) continue;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object' ||
      Array.isArray(left) !== Array.isArray(right)) return false;
    const keys = Object.keys(left);
    if (keys.length !== Object.keys(right).length) return false;
    for (const key of keys) {
      if (!Object.hasOwn(right, key)) return false;
      pending.push([left[key], right[key]]);
    }
  }
  return true;
}
function stageIntent(intent, ceiling) {
  need(exactKeys(intent, STAGE_INTENT_KEYS) &&
    exactKeys(intent.basis, ['expression_ref','document_revision','scene_ref']) &&
    reference(intent.basis.expression_ref) && reference(intent.basis.scene_ref) &&
    Number.isSafeInteger(intent.basis.document_revision) && intent.basis.document_revision > 0 &&
    reference(intent.operation_ref) && ['prepare','regenerate'].includes(intent.action) &&
    ['source','profile','authored','choice','scope'].every(key => intent[key] &&
      typeof intent[key] === 'object' && !Array.isArray(intent[key])),
    'exact original native Stage compilation intent required');
  need(Number.isSafeInteger(ceiling) && ceiling > 0 && JSON.stringify(intent).length * 2 <= ceiling,
    'original Stage intent exceeds its custody ceiling');
}

/** Pure wire discrimination only. Completion issuance belongs to the real
 * NativeChannel response handler; these values cannot restore a Session. */
export function validateNativeStageCompilationOutcome(result, originalIntent, retry, maxBytes) {
  stageIntent(originalIntent, maxBytes);
  need(result?.schema === 'oi.native-procedural-stage-library/v1' &&
    sameJSON(result.original_intent, originalIntent) &&
    Array.isArray(result.native_procedural_receipts) && result.native_procedural_receipts.length === 0 &&
    JSON.stringify(result).length * 2 <= maxBytes,
    'Stage lookup changed its original intent or claimed a native receipt');
  need(result.found !== false && result.state !== 'pending_compilation',
    'original native compilation remains pending or unknown');
  if (retry) {
    need(result.found === true && result.repeated === true ||
      result.state === 'pending_reception' && result.qualification === 'original_native_compilation_retained' ||
      result.state === 'issued' && result.qualification === 'live_native_owner',
      'Stage recovery lacks its exact original terminal lookup');
  }
  if (result.state === 'known_refusal') {
    need(['admission','prepared','preview','operation','outcome','outcome_basis'].every(key => !Object.hasOwn(result,key)) &&
      (retry ? result.found === true && result.repeated === true &&
        result.qualification === 'original_native_compilation_refusal' :
        result.qualification === undefined && result.found === undefined && result.repeated === undefined),
      'terminal compilation refusal claimed material or changed retry standing');
  }
  if (result.state === 'no_change') {
    need(['admission','operation'].every(key => !Object.hasOwn(result,key)) && result.found === true &&
      (retry ? result.repeated === true && result.source_current === false &&
        result.qualification === 'original_native_no_change_retry' :
        result.repeated === false && result.source_current === true && result.qualification === 'live_native_source_unchanged'),
      'readonly no-change outcome changed its fresh/retry currentness or claimed material');
  }
  const terminal =
    result.state === 'known_refusal' && typeof result.reason === 'string' && result.reason.length > 0 && result.reason.length <= 32768 && result.envelope === null &&
      result.source_current === false && (!retry || result.qualification === 'original_native_compilation_refusal') ||
    result.state === 'no_change' && result.outcome === 'no_change' && result.envelope === null &&
      result.prepared === null && ['live_native_source_unchanged','original_native_no_change_retry'].includes(result.qualification) ||
    result.state === 'issued' && result.qualification === 'live_native_owner' &&
      result.source_current === true && result.envelope && typeof result.envelope === 'object' ||
    result.state === 'pending_reception' && result.qualification === 'original_native_compilation_retained' &&
      result.source_current === false && result.envelope === null && result.admission && typeof result.admission === 'object' ||
    result.found === true && result.repeated === true && result.qualification === 'original_native_preparation_retry' &&
      result.source_current === false && result.envelope && typeof result.envelope === 'object';
  need(terminal, 'Stage reply is not an original terminal compilation outcome');
  return result;
}

const DEFINITION_INTENT_KEYS = ['lease','expression_ref','document_revision','source_producer_ref','request'];
function definitionIntent(intent, maxBytes) {
  need(exactKeys(intent, DEFINITION_INTENT_KEYS) && reference(intent.lease) && reference(intent.expression_ref) &&
    Number.isSafeInteger(intent.document_revision) && intent.document_revision > 0,
    'native definition intent requires the complete exact native basis');
  const action = intent.request;
  need(action?.action === 'install_prepared' && exactKeys(action,['action']) && reference(intent.source_producer_ref) ||
    action?.action === 'source_continue' && exactKeys(action,['action','procedure_ref']) && reference(action.procedure_ref) && intent.source_producer_ref === null,
    'native definition accepts only first producer installation or original identity continuation');
  need(Number.isSafeInteger(maxBytes) && maxBytes > 0 && JSON.stringify(intent).length * 2 <= maxBytes,
    'native definition intent exceeds its original custody ceiling');
}
function definitionRequest(intent, context) {
  const original = { lease:intent.lease,expression_ref:intent.expression_ref,document_revision:intent.document_revision,
    request:{schema:'ql.field-host-request/v1',instance_ref:context.instance_ref,
      event_ref:context.event_ref,subject_ref:context.subject_ref,request_id:context.next_request_id,
      expected_generation:context.expected_generation,expected_samples_elapsed:context.expected_samples_elapsed,
      command:{operation:'procedure',request:structuredClone(intent.request)}} };
  if (intent.source_producer_ref !== null) original.source_producer_ref = intent.source_producer_ref;
  return nativeSnapshot(original);
}
function originalDefinitionRequest(original, context, maxBytes) {
  const intent={lease:original?.lease,expression_ref:original?.expression_ref,document_revision:original?.document_revision,
    source_producer_ref:original?.source_producer_ref??null,request:original?.request?.command?.request};
  definitionIntent(intent,maxBytes);
  need(exactKeys(original,intent.source_producer_ref === null ? ['lease','expression_ref','document_revision','request'] :
    ['lease','expression_ref','document_revision','source_producer_ref','request']) &&
    sameJSON(original,definitionRequest(intent,context)),
    'native definition changed the original complete Session-issued request');
}
/** Pure discrimination, never a Source/clock/Session constructor. Only private
 * SAME Session custody plus the authenticated channel completion may account it. */
export function validateNativeDefinitionOutcome(result, originalRequest, context, native, maxBytes, recovery = false) {
  originalDefinitionRequest(originalRequest,context,maxBytes);
  need(result && typeof result === 'object' && JSON.stringify(result).length * 2 <= maxBytes,
    'native definition outcome exceeds its original ceiling');
  let outcome=result;
  if (recovery) {
    need(result.schema === 'oi.native-procedural-definition-recovery/v1' && result.found === true && result.recovered === true &&
      result.replayed === false && result.recovery_current === true && result.recovery_currentness === null &&
      sameJSON(result.original_intent,originalRequest) && Array.isArray(result.native_procedural_receipts) &&
      result.native_procedural_receipts.length === 0 && result.consumer_release === 'unconfirmed',
      'original native definition lookup is absent, changed or no longer current');
    outcome=result.original_result;
  }
  need(outcome?.schema === 'oi.native-procedural-definition/v1' && sameJSON(outcome.original_intent,originalRequest) &&
    sameJSON(outcome.original_request,originalRequest.request) &&
    outcome.captured_producer_ref === (originalRequest.source_producer_ref??null) && outcome.consumer_release === 'unconfirmed',
    'native definition result changed its original intent/producer');
  need(outcome.state === 'definition_received' && outcome.source_current === true && outcome.reason === null ||
    ['definition_qualification_refused','definition_channel_refused'].includes(outcome.state) && outcome.source_current === false &&
      typeof outcome.reason === 'string' && outcome.reason.length > 0 && outcome.reason.length <= 32768, 'native definition outcome standing unknown');
  const channel=outcome.native_source_channel,reply=outcome.native_receipt;
  need(channel?.schema === 'ql.native-act-owner-result/v1' && channel.available === true &&
    channel.instance_ref === context.instance_ref && channel.request_id === context.next_request_id &&
    channel.last_request_id === context.next_request_id && ['ok','refused'].includes(channel.status) &&
    sameJSON(channel.result?.native_receipt,reply), 'native definition lacks its full original actual C/Host outcome');
  need(reply?.schema === 'ql.field-host-receipt/v1' && reply.available === true && ['ok','refused'].includes(reply.status) &&
    reply.instance_ref === context.instance_ref && reply.request_id === context.next_request_id &&
    reply.last_request_id === context.next_request_id,
    'native definition lacks its actual one original Host acknowledgement');
  const frame=reply.field;
  need(frame && frame.event_ref === context.event_ref && frame.subject_ref === context.subject_ref &&
    frame.generation === context.expected_generation && frame.samples_elapsed === context.expected_samples_elapsed &&
    Array.isArray(frame.audio) && frame.audio.length === 0 && sameJSON(withoutAudio(frame),native),
    'native definition changed the complete original FIELD source/state or replayed PCM');
  if (outcome.state === 'definition_received') {
    const receipt=reply.procedural?.definition_receipt;
    need(reply.status === 'ok' && receipt?.schema === 'ql.native-procedural-definition-receipt/v1' &&
      sameJSON(outcome.definition_receipt,receipt) && outcome.material_status === receipt.material_status &&
      receipt.kind === originalRequest.request.command.request.action &&
      (receipt.kind === 'install_prepared' && receipt.material_status === 'pending_reception' ||
       receipt.kind === 'source_continue' && receipt.material_status === 'unchanged'),
      'native definition omitted its original received preparation/continuation');
  }
  return reply; // Projection only. The private Session alone may consume once.
}

const EVENT_OPERATIONS = ['m1-advance', 'replace-event'];
const READ_OPERATIONS = ['procedure', 'read', 'inspect', 'influence', 'personal', 'receive-personal'];
const SOURCE_OPERATIONS = ['selected-source-retain','selected-source-bootstrap'];
const PERFORMANCE_OPERATIONS = ['performance-prepare','performance-prepare-current','performance-scene-prepare','performance-recording-begin','performance-save-cut','performance-continue-act','performance-playback','performance-edited-render','performance-exchange'];

export class InstrumentSession {
  #context; #owner; #port; #field; #audio; #native; #instance; #sequence;
  #block; #lookahead; #maxBlocks; #maxBytes; #timeout; #queue = []; #bytes = 0;
  #views = new Set(); #maxViews; #busy = false; #held = false; #uncertain = false;
  #disposed = false; #reason = null; #presented; #timer = null; #running = false;
  #procedureWaiters = []; #documentTransaction = false; #cadenceMs = null;
  #pendingPresentation = null; #presentationDelivery = null; #maxPresentationAttempts;
  #pendingDocumentRecovery = null;
  #pendingCompilationRecovery = null;
  #definitionDelivery = null;
  #releaseProcedures() { for (const resume of this.#procedureWaiters.splice(0)) resume(); }
  async #waitIdle(allowDocument = false) {
    const deadline = Date.now() + this.#timeout;
    while (this.#busy || (!allowDocument && this.#documentTransaction)) {
      need(!this.#disposed && !this.#uncertain && this.#procedureWaiters.length < 16, 'native operation wait bound/standing exceeded');
      const remaining = deadline - Date.now(); need(remaining > 0, 'native operation admission timed out');
      await new Promise((resolve, reject) => {
        let timer;
        const resume = () => { clearTimeout(timer); resolve(); };
        timer = setTimeout(() => {
          const index = this.#procedureWaiters.indexOf(resume);
          if (index >= 0) this.#procedureWaiters.splice(index, 1);
          reject(new Error('native operation admission timed out'));
        }, remaining);
        this.#procedureWaiters.push(resume);
      });
    }
  }
  #generation = 0; #coalesced = 0; #influence = null;

  constructor({ context, owner, transport, initialReceipt, fieldBinding,
    blockFrames = 512, lookaheadSeconds = 0.1, maxBlocks = 16,
    maxQueuedBytes = 16 * 1024 * 1024, maxViews = 32, timeoutMs = 5000,
    gain = 0.1, muted = true, leadSeconds = 0.04, maxPresentationAttempts = 4 } = {}) {
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
    need(Number.isInteger(maxPresentationAttempts) && maxPresentationAttempts >= 1 &&
      maxPresentationAttempts <= 16, 'invalid retained presentation retry bound');
    this.#maxPresentationAttempts = maxPresentationAttempts;
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

  get reading() {
    return { schema: 'ql.instrument-reading/v1', instance_ref: this.#instance,
      last_request_id: this.#sequence.toString(),
      event_ref: this.#native.event_ref, subject_ref: this.#native.subject_ref,
      acknowledged: { generation: this.#native.generation, samples_elapsed: this.#native.samples_elapsed },
      presented: { ...this.#presented }, audio: this.#audio.lastReceipt,
      available: !this.#uncertain && !this.#disposed, held: this.#held || this.#audio.capacity.held,
      reason: this.#pendingPresentation?.reason ?? this.#reason,
      pending_document_transaction: this.#pendingDocumentRecovery === null ? null : {
        schema: 'ql.instrument-pending-document-transaction/v1',
        context: { ...this.#pendingDocumentRecovery.context }, attempts: this.#pendingDocumentRecovery.attempts,
        max_attempts: 4, reason: this.#pendingDocumentRecovery.reason,
        standing: 'original_selected_source_reply_unknown' },
      pending_stage_compilation: this.#pendingCompilationRecovery === null ? null : {
        schema: 'ql.instrument-pending-stage-compilation/v1',
        context: { ...this.#pendingCompilationRecovery.context },
        operation_ref: this.#pendingCompilationRecovery.original_intent.operation_ref,
        basis: { ...this.#pendingCompilationRecovery.original_intent.basis },
        attempts: this.#pendingCompilationRecovery.attempts, max_attempts: 4,
        reason: this.#pendingCompilationRecovery.reason, standing: 'original_native_compilation_unknown' },
      pending_native_definition: this.#definitionDelivery === null || !this.#uncertain ? null : {
        schema:'ql.instrument-pending-native-definition/v1',context:{...this.#definitionDelivery.context},
        original_request:structuredClone(this.#definitionDelivery.original_request),
        attempts:this.#definitionDelivery.attempts,max_attempts:4,reason:this.#definitionDelivery.reason,
        accounted:this.#definitionDelivery.accounted,standing:'original_native_definition_reply_unknown' },
      presentation_blocked: this.#pendingPresentation !== null,
      pending_presentation: this.#pendingPresentation === null ? null : this.#pendingReading(),
      presentation_delivery: this.#presentationDelivery === null ? null : structuredClone(this.#presentationDelivery),
      in_flight: this.#busy, queued_blocks: this.#queue.length,
      queued_bytes: this.#bytes + (this.#pendingPresentation?.packet.bytes ?? 0),
      coalesced_presentation_frames: this.#coalesced,
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
    if (this.#pendingPresentation) {
      this.#presentationDelivery = { ...this.#pendingReading(), status: 'abandoned_by_explicit_hold' };
      this.#pendingPresentation = null;
    }
    this.#pendingDocumentRecovery = null; // Explicit Hold abandons this reply-recovery custody.
    this.#pendingCompilationRecovery = null;
    this.#definitionDelivery = null;
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
  setMuted(muted) {
    need(!this.#pendingDocumentRecovery && !this.#pendingCompilationRecovery && !(this.#definitionDelivery && this.#uncertain), 'resolve the original retained transaction before changing its captured mute');
    // A new explicit mute choice supersedes an already-accounted delivery's
    // old mute snapshot. Uncertain delivery remains fenced by the guard above.
    if (this.#definitionDelivery?.accounted) this.#definitionDelivery = null;
    this.#audio.setMuted(muted); return this.reading;
  }

  async #exchange(command) {
    need(!this.#disposed && !this.#uncertain, 'unknown/disposed native owner; no automatic retry');
    need(!this.#pendingPresentation, 'resolve the original retained presentation before another native request');
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
        return { refused: true, error: reply.error ?? 'native command refused',performance:reply.performance,recording:reply.recording,source_transaction:reply.source_transaction };
      }
      const changing = command.operation === 'set-axis' || command.operation === 'replace' || command.operation === 'set-damping';
      // replace-event commits modes and, when required, shape. m1-advance
      // additionally commits inscription-axis alignment. Strike is a policy
      // within the modes commit, not another generation (scene_field.rs).
      const event = EVENT_OPERATIONS.includes(command.operation);
      const frames = command.operation === 'advance' ? command.frames : 0;
      const before = cursor(this.#native.generation), after = cursor(frame.generation);
      const minimumEventDelta = command.operation === 'm1-advance' ? 2n : 1n;
      const maximumEventDelta = command.operation === 'm1-advance' ? 3n : 2n;
      need((event ? after >= before + minimumEventDelta && after <= before + maximumEventDelta
        : after === before + (changing ? 1n : 0n)) &&
        cursor(frame.samples_elapsed) === cursor(this.#native.samples_elapsed) + BigInt(frames) &&
        frame.audio.length === frames, 'host operation and native cursor disagree');
      if (READ_OPERATIONS.includes(command.operation)) need(unchanged, 'native read advanced or reset state');
      if(PERFORMANCE_OPERATIONS.includes(command.operation)||SOURCE_OPERATIONS.includes(command.operation))need(unchanged&&frame.audio.length===0,'performance control changed or replayed legacy PCM');
      this.#sequence = next;
      // The native operation is now acknowledged even if presentation later
      // fails. Recovery reads this cursor; no claim of rolling native state back.
      this.#native = withoutAudio(frame);
      // A scene determinant acknowledgement carries its own influence reading.
      if (reply.influence !== undefined) this.#influence = structuredClone(reply.influence);
      return { frame, sources: reply.sources, influence: reply.influence, personal: reply.personal, procedural: reply.procedural,performance:reply.performance,recording:reply.recording,source_transaction:reply.source_transaction };
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
    this.#queue.push({ frame: presentation, bytes, time: receipt.target_context_seconds,
      request_id: this.#sequence.toString() }); this.#bytes += bytes;
    return receipt;
  }

  #packetReference(packet) {
    return { instance_ref: this.#instance, request_id: packet.request_id,
      event_ref: packet.frame.event_ref, subject_ref: packet.frame.subject_ref,
      generation: packet.frame.generation, samples_elapsed: packet.frame.samples_elapsed };
  }
  #pendingReading() {
    const pending = this.#pendingPresentation;
    return { schema: 'ql.instrument-pending-presentation/v1',
      packet_ref: this.#packetReference(pending.packet), attempts: pending.attempts,
      max_attempts: this.#maxPresentationAttempts,
      target_context_seconds: pending.packet.time, reason: pending.reason };
  }
  #applyPresentation(packet, removed, attempts) {
    // The retained original is never given to a mutating renderer. Retrying
    // repeats this same field ingress; it never schedules or replays PCM.
    this.#field.apply(structuredClone(packet.frame));
    this.#presented = { generation: packet.frame.generation, samples_elapsed: packet.frame.samples_elapsed };
    this.#coalesced += Math.max(0, removed - 1);
    this.#presentationDelivery = { packet_ref: this.#packetReference(packet),
      status: 'field_binding_returned', attempts, target_context_seconds: packet.time };
  }

  /** Apply only END-of-block targets whose matching PCM time has arrived.
   * Skipped visual frames coalesce explicitly; no second integration or reseed. */
  present() {
    if (this.#disposed || this.#held || this.#uncertain || this.#pendingPresentation || this.#audio.capacity.held) return this.reading;
    let selected = null, removed = 0;
    while (this.#queue.length && this.#queue[0].time <= this.#context.currentTime) {
      selected = this.#queue.shift(); this.#bytes -= selected.bytes; removed++;
    }
    if (selected) {
      try { this.#applyPresentation(selected, removed, 1); }
      catch (error) {
        this.#cancelTimer(); this.#running = false;
        this.#pendingPresentation = { packet: selected, removed, attempts: 1,
          owner_generation: this.#generation, last_request: this.#sequence,
          owner_state: this.#native,
          reason: `retained-field-application-failed: ${String(error)}`.slice(0, 2048) };
        // Already admitted PCM and remaining target packets keep their actual
        // custody. No native request, audio Hold/reset or epoch is inferred.
        throw error;
      }
    }
    return this.reading;
  }

  /** Explicit bounded SAME-packet retry after the actual renderer is repaired.
   * Existing field.apply returning is not a resident/body/audio observation.
   * Successful delivery does not automatically restart cadence. */
  retryPresentation() {
    const pending = this.#pendingPresentation;
    need(pending && !this.#busy && !this.#documentTransaction && !this.#held &&
      !this.#disposed && !this.#uncertain && !this.#audio.capacity.held && !this.#audio.capacity.closed,
      'original retained presentation requires the same idle admitted owner');
    need(pending.owner_generation === this.#generation && pending.last_request === this.#sequence &&
      JSON.stringify(pending.owner_state) === JSON.stringify(this.#native),
      'native owner/source/request changed since retained presentation failed');
    need(pending.attempts < this.#maxPresentationAttempts, 'retained presentation retry bound exhausted');
    pending.attempts++;
    try {
      this.#field.validate(pending.packet.frame);
      this.#applyPresentation(pending.packet, pending.removed, pending.attempts);
      this.#pendingPresentation = null;
    } catch (error) {
      pending.reason = `retained-field-retry-failed: ${String(error)}`.slice(0, 2048);
      throw error;
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
    if (this.#busy || this.#documentTransaction || this.#held || this.#pendingPresentation || this.#uncertain) return this.reading;
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
    } finally { this.#busy = false; this.#releaseProcedures(); }
  }

  /** Explicit owner-authorised domain change, serialized with data delivery.
   * It changes the existing native owner; no UI-local clock or second composer. */
  async operate(command) {
    need(!this.#busy && !this.#documentTransaction && !this.#held && !this.#disposed &&
      ['set-axis', 'replace', 'set-damping', ...EVENT_OPERATIONS].includes(command?.operation), 'domain operation requires idle admitted owner');
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
    } finally { this.#busy = false; this.#releaseProcedures(); }
  }

  /** Native callback audio and body are retained by the SAME FieldHost. The
   * browser's buffered PCM lane is held before admission; these controls never
   * enqueue legacy PCM, recover it, or allocate another request counter. */
  async performance(command) {
    need(!this.#busy && !this.#documentTransaction && !this.#pendingPresentation &&
      !this.#disposed && !this.#uncertain && this.#held &&
      PERFORMANCE_OPERATIONS.includes(command?.operation), 'performance requires the idle held native driver');
    this.#busy = true;
    try {
      const reply = await this.#exchange(command);
      need(!reply.refused, String(reply.error));
      if(command.operation==='performance-scene-prepare'||command.operation==='performance-recording-begin'||command.operation==='performance-save-cut')
        need(reply.recording?.schema==='oi.native-scene-recording-result/v1'&&reply.recording.accepted===true,'original native recording transaction omitted');
      else {need(reply.performance?.schema === 'ql.performance-management-reply/v1', 'native performance reply omitted');
        if(command.operation==='performance-continue-act'||command.operation==='performance-playback'||command.operation==='performance-edited-render')need(reply.recording?.schema==='oi.native-scene-recording-result/v1'&&reply.recording.accepted===true&&reply.performance.operation===command.operation&&reply.performance.accepted===true,'original native Act transaction omitted');}
      return { performance: reply.performance, recording: reply.recording };
    } finally { this.#busy = false; this.#releaseProcedures(); }
  }

  /** Same admitted native owner performs source preparation/manual attribution.
   * It does not advance numerical/body/audio clocks. The same Expression owner
   * applies returned Edit and records actual material/consumer reception. */
  async procedure(request) {
    await this.#waitIdle();
    need(!this.#disposed && !this.#uncertain,'procedure requires an admitted native owner');
    this.#busy = true;
    try {
      const reply=await this.#exchange({operation:'procedure',request:structuredClone(request)});
      need(!reply.refused,String(reply.error));
      need(reply.procedural && typeof reply.procedural === 'object','native procedural reply missing');
      return structuredClone(reply.procedural);
    } finally { this.#busy=false; this.#releaseProcedures(); }
  }

  /** Serialize an actual Kernel Edit's pure source preflight with this SAME
   * owner. Existing ACK/PCM delivery finishes; no hold, audio reset or queue
   * discard occurs. The Kernel returns only genuine consumed receipt rows. */
  async nativeDocumentTransaction(action, selectedSourceIntent) {
    return this.#nativeDocumentTransaction(action, selectedSourceIntent);
  }

  /** Stateless original Stage compilation only. Its actual NativeChannel
   * completion, not a caller JSON reply, identifies the finished invocation. */
  async nativeStageCompilationTransaction(action, originalIntent) {
    need(typeof this.#port.consumeStageCompilationCompletion === 'function',
      'actual authenticated Stage completion transport unavailable');
    return this.#nativeDocumentTransaction(action, undefined, originalIntent);
  }

  async #nativeDocumentTransaction(action, selectedSourceIntent, originalStageIntent) {
    need(typeof action === 'function' && !this.#documentTransaction && !this.#pendingPresentation && !this.#disposed && !this.#uncertain,
      'native document transaction requires one admitted owner');
    const cadence = this.#running ? this.#cadenceMs : null;
    const generation = this.#generation;
    this.#documentTransaction = true; this.#cancelTimer(); this.#running = false;
    const nativeGeneration = this.#native.generation;
    let actionStarted = false, actionTimer, busyOwned = false, retainedSource = null, retainedCompilation = null;
    try {
      await this.#waitIdle(true);
      need(!this.#disposed && !this.#uncertain, 'native owner lost before document transaction');
      this.#busy = true; busyOwned = true;
      const next = this.#sequence + 1n; need(next <= U64, 'host sequence exhausted');
      const context = Object.freeze({ schema: 'ql.native-document-transaction/v1',
        instance_ref: this.#instance, event_ref: this.#native.event_ref, subject_ref: this.#native.subject_ref,
        last_request_id: this.#sequence.toString(), next_request_id: next.toString(),
        expected_generation: this.#native.generation, expected_samples_elapsed: this.#native.samples_elapsed });
      if (selectedSourceIntent !== undefined) {
        // Bind only this actual readonly Source getter before its callback can
        // dispatch. Generic Kernel/field writes keep their original unknown path.
        const original = sourceRequest(selectedSourceIntent, context);
        need(JSON.stringify(this.#native).length * 2 <= this.#maxBytes,
          'selected-source native snapshot exceeds its original ceiling');
        const audio = this.#audio.lastReceipt, capacity = this.#audio.capacity;
        retainedSource = { context, original_request: original, native: nativeSnapshot(this.#native),
          owner_generation: this.#generation, sequence: this.#sequence, held: this.#held,
          prior_reason: this.#reason, reason: this.#reason,
          cadence: generation === this.#generation && nativeGeneration === this.#native.generation ? cadence : null,
          muted: audio.muted, audio_held: capacity.held, audio_epoch: audio.device_epoch,
          audio_origin: audio.native_origin, audio_context_origin: audio.context_origin_seconds,
          audio_target: audio.target_context_seconds, audio_scheduled: audio.scheduled_blocks,
          audio_discarded: audio.discarded_blocks, attempts: 0 };
      }
      if (originalStageIntent !== undefined) {
        stageIntent(originalStageIntent, Math.min(this.#maxBytes, 8 * 1024 * 1024));
        // Charge both original Intent copies and the actual native frame before
        // constructing private retained custody or a callback projection.
        need(JSON.stringify(originalStageIntent).length * 4 + JSON.stringify(this.#native).length * 2 <= this.#maxBytes,
          'Stage compilation custody exceeds its combined ceiling');
        const audio = this.#audio.lastReceipt, capacity = this.#audio.capacity;
        retainedCompilation = { context, original_intent: nativeSnapshot(originalStageIntent),
          native: nativeSnapshot(this.#native), owner_generation: this.#generation, sequence: this.#sequence,
          held: this.#held, prior_reason: this.#reason, reason: this.#reason,
          cadence: generation === this.#generation && nativeGeneration === this.#native.generation ? cadence : null,
          muted: audio.muted, audio_held: capacity.held, audio_epoch: audio.device_epoch,
          audio_origin: audio.native_origin, audio_context_origin: audio.context_origin_seconds,
          audio_target: audio.target_context_seconds, audio_scheduled: audio.scheduled_blocks,
          audio_discarded: audio.discarded_blocks, attempts: 0 };
      }
      actionStarted = true;
      let result = await Promise.race([Promise.resolve().then(() => retainedCompilation ?
        action(context, structuredClone(retainedCompilation.original_intent)) : action(context)),
        new Promise((_, reject) => { actionTimer = setTimeout(() => reject(new Error('native document transaction timed out')), this.#timeout); })]);
      if (retainedCompilation) {
        need(retainedCompilation.owner_generation === this.#generation && retainedCompilation.sequence === this.#sequence &&
          !this.#disposed && JSON.stringify(this.#native) === JSON.stringify(retainedCompilation.native),
          'Stage transaction changed the original Session/ordinal/FIELD');
        const expectedRequest = { operation:'procedural_stage_library', request:retainedCompilation.original_intent };
        result = this.#port.consumeStageCompilationCompletion(result, expectedRequest);
        validateNativeStageCompilationOutcome(result, retainedCompilation.original_intent, false, 8 * 1024 * 1024);
      }
      need(!this.#disposed && result && typeof result === 'object' && Array.isArray(result.native_procedural_receipts) &&
        result.native_procedural_receipts.length <= 1, 'native document transaction receipt standing unknown');
      if (retainedSource && result.native_procedural_receipts.length === 0) {
        need(result.not_dispatched === true && result.native_result === undefined,
          'selected-source empty receipt requires a known pre-dispatch callback result');
      }
      if (retainedSource && result.native_procedural_receipts.length) {
        need(result.native_result?.schema === 'ql.native-act-owner-result/v1' &&
          result.native_result.available === true && result.native_result.instance_ref === context.instance_ref &&
          result.native_result.request_id === context.next_request_id && result.native_result.last_request_id === context.next_request_id &&
          sameSourceRequest(result.original_request, retainedSource.original_request) &&
          result.lease === retainedSource.original_request.lease &&
          JSON.stringify(result.native_result?.host_receipt) === JSON.stringify(result.native_procedural_receipts[0]),
          'selected-source transaction returned another original request/Host receipt');
      }
      for (const reply of result.native_procedural_receipts) {
        need(reply?.schema === 'ql.field-host-receipt/v1' && reply.instance_ref === this.#instance &&
          reply.request_id === next.toString() && reply.last_request_id === next.toString() &&
          reply.available === true && ['ok', 'refused'].includes(reply.status), 'foreign/reordered document preflight receipt');
        const frame = reply.field;
        need(frame && Array.isArray(frame.audio) && frame.audio.length === 0 &&
          JSON.stringify(withoutAudio(frame)) === JSON.stringify(this.#native), 'document preflight changed native state/source or replayed PCM');
        need(JSON.stringify(frame).length * 2 <= this.#maxBytes, 'document preflight field exceeds ceiling');
        this.#field.validate(frame); this.#audio.validate(frame);
        this.#sequence = next; // A refused native request still consumed its ordinal.
      }
      return result;
    } catch (error) {
      if (actionStarted && retainedSource && !this.#disposed) {
        // Keep the original native queue/port/device epoch. Mute only the
        // existing gain: audio.hold would discard PCM and require a new epoch.
        retainedSource.reason = String(error).slice(0, 2048);
        this.#pendingDocumentRecovery = retainedSource.owner_generation === this.#generation &&
          retainedSource.sequence === this.#sequence ? retainedSource : null;
        this.#uncertain = true;
        if (this.#pendingDocumentRecovery) this.#reason = retainedSource.reason;
        this.#cancelTimer(); this.#running = false;
        try { this.#audio.setMuted(true); } catch (muteError) {
          retainedSource.reason = (retainedSource.reason + '; mute failed: ' + String(muteError)).slice(0, 2048);
          if (this.#pendingDocumentRecovery) this.#reason = retainedSource.reason;
        }
      } else if (actionStarted && retainedCompilation && !this.#disposed) {
        retainedCompilation.reason = String(error).slice(0, 2048);
        this.#pendingCompilationRecovery = retainedCompilation.owner_generation === this.#generation &&
          retainedCompilation.sequence === this.#sequence ? retainedCompilation : null;
        this.#uncertain = true; this.#cancelTimer(); this.#running = false;
        if (this.#pendingCompilationRecovery) this.#reason = retainedCompilation.reason;
        try { this.#audio.setMuted(true); } catch (muteError) {
          retainedCompilation.reason = (retainedCompilation.reason + '; mute failed: ' + String(muteError)).slice(0, 2048);
          if (this.#pendingCompilationRecovery) this.#reason = retainedCompilation.reason;
        }
      } else if (actionStarted) this.#unknown(String(error));
      throw error;
    } finally {
      clearTimeout(actionTimer);
      if (busyOwned) this.#busy = false;
      this.#documentTransaction = false; this.#releaseProcedures();
      if (cadence !== null && generation === this.#generation &&
        nativeGeneration === this.#native.generation &&
        !this.#held && !this.#pendingPresentation && !this.#disposed && !this.#uncertain) this.start(cadence);
    }
  }


  /** Lookup only this SAME Session's lost readonly selected-source outcome.
   * The callback calls the native closed memo; no field request or Edit is
   * resent. Imported original contexts cannot instantiate this private custody. */
  async recoverNativeDocumentTransaction(action) {
    const pending = this.#pendingDocumentRecovery;
    need(typeof action === 'function' && pending && this.#uncertain && !this.#disposed &&
      !this.#busy && !this.#documentTransaction && !this.#pendingPresentation,
      'no original selected-source transaction is recoverable in this Session');
    need(pending.attempts < 4, 'selected-source reply recovery bound exhausted');
    const current = () => {
      need(this.#pendingDocumentRecovery === pending && !this.#disposed && this.#uncertain &&
        pending.owner_generation === this.#generation && pending.sequence === this.#sequence &&
        this.#instance === pending.context.instance_ref &&
        JSON.stringify(this.#native) === JSON.stringify(pending.native),
        'selected-source recovery owner/request/FIELD state changed');
      const audio = this.#audio.lastReceipt, capacity = this.#audio.capacity;
      need(!capacity.closed && capacity.held === pending.audio_held &&
        audio.device_epoch === pending.audio_epoch && audio.native_origin === pending.audio_origin &&
        audio.context_origin_seconds === pending.audio_context_origin &&
        audio.target_context_seconds === pending.audio_target &&
        audio.scheduled_blocks === pending.audio_scheduled && audio.discarded_blocks === pending.audio_discarded,
        'selected-source recovery cannot rebase changed/discarded audio presentation');
    };
    current(); pending.attempts++;
    this.#busy = true; this.#documentTransaction = true;
    let timer, restored = false;
    try {
      const result = await Promise.race([Promise.resolve().then(() =>
        action(pending.context, structuredClone(pending.original_request))),
        new Promise((_, reject) => { timer = setTimeout(() =>
          reject(new Error('selected-source reply recovery timed out')), this.#timeout); })]);
      current();
      const reply = validateSelectedSourceDocumentRecovery(result, pending.original_request,
        pending.context, pending.native, this.#maxBytes);
      this.#field.validate(reply.field); this.#audio.validate(reply.field);
      // No PCM apply/rebase/epoch/queue work. Restore the existing gain before
      // accounting this one original next ordinal; a failed restore stays unknown.
      this.#audio.setMuted(pending.muted);
      this.#sequence = cursor(pending.context.next_request_id);
      this.#uncertain = false; this.#held = pending.held; this.#reason = pending.prior_reason;
      this.#pendingDocumentRecovery = null; restored = true;
      return result;
    } catch (error) {
      if (this.#pendingDocumentRecovery === pending) {
        pending.reason = String(error).slice(0, 2048); this.#reason = pending.reason;
      }
      throw error; // Retain full original private custody for bounded explicit retry.
    } finally {
      clearTimeout(timer); this.#busy = false; this.#documentTransaction = false; this.#releaseProcedures();
      if (restored && pending.cadence !== null && pending.owner_generation === this.#generation &&
        !this.#held && !this.#pendingPresentation && !this.#disposed && !this.#uncertain) this.start(pending.cadence);
    }
  }

  /** SAME private pure lookup only. The original native reservation may
   * remain pending; that outcome is checkpointed by Working inside the callback
   * and cannot restore cadence or authorize a second compilation. */
  async recoverNativeStageCompilation(action) {
    const pending = this.#pendingCompilationRecovery;
    need(typeof action === 'function' && typeof this.#port.consumeStageCompilationCompletion === 'function' &&
      pending && this.#uncertain && !this.#disposed && !this.#busy && !this.#documentTransaction && !this.#pendingPresentation,
      'no original Stage compilation is recoverable in this Session');
    need(pending.attempts < 4, 'Stage compilation lookup bound exhausted');
    const current = () => {
      need(this.#pendingCompilationRecovery === pending && !this.#disposed && this.#uncertain &&
        pending.owner_generation === this.#generation && pending.sequence === this.#sequence &&
        this.#instance === pending.context.instance_ref && JSON.stringify(this.#native) === JSON.stringify(pending.native),
        'Stage recovery changed the original Session/ordinal/FIELD');
      const audio = this.#audio.lastReceipt, capacity = this.#audio.capacity;
      need(!capacity.closed && capacity.held === pending.audio_held && audio.device_epoch === pending.audio_epoch &&
        audio.native_origin === pending.audio_origin && audio.context_origin_seconds === pending.audio_context_origin &&
        audio.target_context_seconds === pending.audio_target && audio.scheduled_blocks === pending.audio_scheduled &&
        audio.discarded_blocks === pending.audio_discarded,
        'Stage recovery cannot rebase changed/discarded audio presentation');
    };
    current(); pending.attempts++; this.#busy = true; this.#documentTransaction = true;
    let timer, restored = false;
    try {
      const completion = await Promise.race([Promise.resolve().then(() =>
        action(pending.context, structuredClone(pending.original_intent))),
        new Promise((_, reject) => { timer = setTimeout(() =>
          reject(new Error('original Stage compilation lookup timed out')), this.#timeout); })]);
      current();
      const expectedRequest = { operation:'procedural_stage_library_retry', request:pending.original_intent };
      const result = this.#port.consumeStageCompilationCompletion(completion, expectedRequest);
      validateNativeStageCompilationOutcome(result, pending.original_intent, true, 8 * 1024 * 1024);
      this.#audio.setMuted(pending.muted);
      this.#uncertain = false; this.#held = pending.held; this.#reason = pending.prior_reason;
      this.#pendingCompilationRecovery = null; restored = true;
      return result; // No field/audio validation, apply, request or ACK occurs.
    } catch (error) {
      if (this.#pendingCompilationRecovery === pending) {
        pending.reason = String(error).slice(0, 2048); this.#reason = pending.reason;
      }
      throw error;
    } finally {
      clearTimeout(timer); this.#busy = false; this.#documentTransaction = false; this.#releaseProcedures();
      if (restored && pending.cadence !== null && pending.owner_generation === this.#generation &&
        !this.#held && !this.#pendingPresentation && !this.#disposed && !this.#uncertain) this.start(pending.cadence);
    }
  }

  /** First native definition admission/current-source continuation only. The
   * full original request is sealed here before the real callback dispatch. */
  async nativeDefinitionTransaction(action, intent) {
    need(typeof action === 'function' && typeof this.#port.consumeNativeDefinitionCompletion === 'function' &&
      !this.#documentTransaction && !this.#pendingPresentation && !this.#disposed && !this.#uncertain,
      'native definition requires one admitted owner and authenticated completion transport');
    const ceiling=Math.min(this.#maxBytes,8*1024*1024);
    definitionIntent(intent,ceiling);
    const cadence=this.#running?this.#cadenceMs:null,generation=this.#generation,nativeGeneration=this.#native.generation;
    this.#documentTransaction=true;this.#cancelTimer();this.#running=false;
    let timer,busyOwned=false,started=false,pending=null;
    try {
      await this.#waitIdle(true);
      need(!this.#disposed && !this.#uncertain,'native owner lost before definition delivery');
      this.#busy=true;busyOwned=true;
      const next=this.#sequence+1n;need(next<=U64,'host sequence exhausted');
      const context=Object.freeze({schema:'ql.native-document-transaction/v1',instance_ref:this.#instance,
        event_ref:this.#native.event_ref,subject_ref:this.#native.subject_ref,last_request_id:this.#sequence.toString(),
        next_request_id:next.toString(),expected_generation:this.#native.generation,expected_samples_elapsed:this.#native.samples_elapsed});
      need(JSON.stringify(intent).length*6+JSON.stringify(this.#native).length*2+2048<=ceiling,
        'combined native definition custody exceeds its original ceiling');
      const audio=this.#audio.lastReceipt,capacity=this.#audio.capacity;
      pending={context,original_request:definitionRequest(intent,context),native:nativeSnapshot(this.#native),
        owner_generation:this.#generation,sequence:this.#sequence,held:this.#held,prior_reason:this.#reason,reason:this.#reason,
        cadence:generation===this.#generation&&nativeGeneration===this.#native.generation?cadence:null,
        muted:audio.muted,audio_held:capacity.held,audio_epoch:audio.device_epoch,audio_origin:audio.native_origin,
        audio_context_origin:audio.context_origin_seconds,audio_target:audio.target_context_seconds,
        audio_scheduled:audio.scheduled_blocks,audio_discarded:audio.discarded_blocks,attempts:0,accounted:false};
      this.#definitionDelivery=pending;started=true;
      const completion=await Promise.race([Promise.resolve().then(()=>action(context,structuredClone(pending.original_request))),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('native definition delivery timed out')),this.#timeout);})]);
      this.#requireDefinitionDelivery(pending,false);
      const result=this.#port.consumeNativeDefinitionCompletion(completion,{operation:'procedural_conduct',request:pending.original_request});
      const reply=validateNativeDefinitionOutcome(result,pending.original_request,context,pending.native,ceiling);
      this.#field.validate(reply.field);this.#audio.validate(reply.field);
      this.#sequence=next;pending.accounted=true;
      // Return genuine qualification refusal after accounting its consumed
      // ordinal; Working separately decides whether native material may proceed.
      return result;
    } catch(error) {
      if(started&&pending&&!this.#disposed) this.#retainDefinitionUnknown(pending,error);
      throw error;
    } finally {
      clearTimeout(timer);if(busyOwned)this.#busy=false;
      this.#documentTransaction=false;this.#releaseProcedures();
      if(cadence!==null&&generation===this.#generation&&nativeGeneration===this.#native.generation&&
        !this.#held&&!this.#pendingPresentation&&!this.#disposed&&!this.#uncertain)this.start(cadence);
    }
  }
  #requireDefinitionDelivery(pending, recovery) {
    need(this.#definitionDelivery===pending&&!this.#disposed&&pending.owner_generation===this.#generation&&
      this.#instance===pending.context.instance_ref&&
      this.#sequence===(pending.accounted?cursor(pending.context.next_request_id):pending.sequence)&&
      sameJSON(this.#native,pending.native)&&(!recovery||pending.accounted||this.#uncertain),
      'native definition changed its original Session/lifetime/ordinal/FIELD');
    const audio=this.#audio.lastReceipt,capacity=this.#audio.capacity;
    need(!capacity.closed&&capacity.held===pending.audio_held&&audio.device_epoch===pending.audio_epoch&&
      audio.native_origin===pending.audio_origin&&audio.context_origin_seconds===pending.audio_context_origin&&
      audio.target_context_seconds===pending.audio_target&&audio.scheduled_blocks===pending.audio_scheduled&&
      audio.discarded_blocks===pending.audio_discarded,
      'native definition cannot rebase changed/discarded audio presentation');
  }
  #retainDefinitionUnknown(pending,error) {
    pending.reason=String(error).slice(0,2048);
    if(this.#definitionDelivery!==pending||this.#disposed||pending.owner_generation!==this.#generation)return;
    this.#uncertain=true;this.#reason=pending.reason;this.#cancelTimer();this.#running=false;
    try{this.#audio.setMuted(true);}catch(muteError){pending.reason=(pending.reason+'; mute failed: '+String(muteError)).slice(0,2048);this.#reason=pending.reason;}
  }
  /** Readonly native original-outcome lookup. An already-accounted private
   * original may be checked again with ZERO new ACK. Saved JSON alone cannot
   * reconstruct this custody; no request/PCM/reset/owner or definition replay. */
  async recoverNativeDefinitionTransaction(action, context, originalRequest) {
    const pending=this.#definitionDelivery;
    need(typeof action==='function'&&typeof this.#port.consumeNativeDefinitionCompletion==='function'&&pending&&
      !this.#disposed&&!this.#busy&&!this.#documentTransaction&&!this.#pendingPresentation&&
      sameJSON(context,pending.context)&&sameJSON(originalRequest,pending.original_request),
      'no exact original native definition delivery is recoverable in this Session');
    this.#requireDefinitionDelivery(pending,true);
    need(pending.attempts<4,'native definition lookup bound exhausted');pending.attempts++;
    this.#busy=true;this.#documentTransaction=true;this.#cancelTimer();this.#running=false;
    let timer,restored=false;
    try {
      const completion=await Promise.race([Promise.resolve().then(()=>action(pending.context,structuredClone(pending.original_request))),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('original native definition lookup timed out')),this.#timeout);})]);
      this.#requireDefinitionDelivery(pending,true);
      const result=this.#port.consumeNativeDefinitionCompletion(completion,{operation:'procedural_definition_retry',request:pending.original_request});
      const reply=validateNativeDefinitionOutcome(result,pending.original_request,pending.context,pending.native,
        Math.min(this.#maxBytes,8*1024*1024),true);
      this.#field.validate(reply.field);this.#audio.validate(reply.field);
      this.#audio.setMuted(pending.muted);
      if(!pending.accounted){this.#sequence=cursor(pending.context.next_request_id);pending.accounted=true;}
      this.#uncertain=false;this.#held=pending.held;this.#reason=pending.prior_reason;restored=true;
      return result; // Actual recovery wrapper already has [] NEW receipts.
    }catch(error){if(!this.#disposed)this.#retainDefinitionUnknown(pending,error);throw error;}
    finally {
      clearTimeout(timer);this.#busy=false;this.#documentTransaction=false;this.#releaseProcedures();
      if(restored&&pending.cadence!==null&&pending.owner_generation===this.#generation&&
        !this.#held&&!this.#pendingPresentation&&!this.#disposed&&!this.#uncertain)this.start(pending.cadence);
    }
  }

  /** The scene owner's acting-influence reading; never advances or resets. */
  async influence() {
    need(!this.#busy && !this.#documentTransaction && !this.#held, 'inspection requires an idle admitted owner'); this.#busy = true;
    try {
      const reply = await this.#exchange({ operation: 'influence' });
      need(!reply.refused, String(reply.error)); this.#influence = structuredClone(reply.influence); return reply.influence;
    } finally { this.#busy = false; this.#releaseProcedures(); }
  }

  /** A Nara-constituted scene owner's reception: `input` (seven supplied centre
   * inputs citing the current event) receives; without it, reads. The material
   * field never changes. Protected state stays with the calling host. */
  async personal(input) {
    need(!this.#busy && !this.#documentTransaction && !this.#held, 'inspection requires an idle admitted owner'); this.#busy = true;
    try {
      const reply = await this.#exchange(input === undefined ? { operation: 'personal' } : { operation: 'receive-personal', input });
      need(!reply.refused, String(reply.error)); return reply.personal;
    } finally { this.#busy = false; this.#releaseProcedures(); }
  }

  async inspect() {
    need(!this.#busy && !this.#documentTransaction && !this.#held, 'inspection requires an idle admitted owner'); this.#busy = true;
    try {
      const reply = await this.#exchange({ operation: 'inspect' });
      need(!reply.refused, String(reply.error)); return reply.sources;
    } finally { this.#busy = false; this.#releaseProcedures(); }
  }

  /** Explicit re-entry after device interruption/late delivery, not provider-loss
   * replay. Unknown native acknowledgements require a separately opened owner. */
  async recover(reason) {
    need(!this.#busy && !this.#documentTransaction && !this.#pendingPresentation && !this.#uncertain && !this.#disposed, 'cannot reconcile an unknown, pending or in-flight native operation');
    this.hold(reason); this.#busy = true;
    try {
      const reply = await this.#exchange({ operation: 'read' });
      need(!reply.refused, String(reply.error));
      this.#audio.rebase(reply.frame, reason);
      this.#field.apply(reply.frame);
      this.#presented = { generation: reply.frame.generation, samples_elapsed: reply.frame.samples_elapsed };
      this.#held = false; this.#reason = null;
      return this.reading;
    } finally { this.#busy = false; this.#releaseProcedures(); }
  }

  start(periodMs = 8) {
    need(!this.#documentTransaction && !this.#pendingPresentation && !this.#disposed && !this.#held && !this.#uncertain && Number.isInteger(periodMs) &&
      periodMs >= 4 && periodMs <= 100, 'invalid driver start');
    if (this.#running) return;
    this.#running = true; this.#cadenceMs = periodMs;
    const tick = async () => {
      this.#timer = null;
      try { await this.pump(); } catch (error) { if (!this.#disposed && !this.#held && !this.#pendingPresentation) this.hold(String(error)); }
      if (this.#running && !this.#disposed && !this.#held && !this.#pendingPresentation) this.#timer = setTimeout(tick, periodMs);
    };
    this.#timer = setTimeout(tick, 0);
  }

  dispose() {
    if (this.#disposed) return;
    this.hold('instrument-driver-disposed'); this.#disposed = true; this.#pendingDocumentRecovery = null; this.#pendingCompilationRecovery = null;
    this.#audio.dispose(); this.#views.clear(); this.#port.close?.(); OWNERS.delete(this.#owner); this.#releaseProcedures();
    // Retained renderer destruction/checkpoint and native material lifecycle
    // remain with their actual host. This class never seeds or steps particles.
  }

  async source(command) {
    need(!this.#busy && !this.#documentTransaction && !this.#pendingPresentation && !this.#disposed && !this.#uncertain && this.#held &&
      [...SOURCE_OPERATIONS, 'inspect'].includes(command?.operation), 'source reading requires the idle held native driver');
    this.#busy = true;
    try {
      const reply = await this.#exchange(command);
      need(!reply.refused, String(reply.error));
      return command.operation === 'inspect' ? reply.sources : reply.source_transaction;
    } finally { this.#busy = false; this.#releaseProcedures(); }
  }
physicalEdit(edit) { return this.nativeSourceEdit('physical',edit); }
acousticEdit(configuration) { return this.nativeSourceEdit('acoustic',configuration); }
async nativeSourceEdit(kind,operand) {
    need(kind==='physical'||kind==='acoustic','unsupported native source edit');
    need(!this.#disposed && !this.#uncertain && this.#held && !this.#busy && !this.#documentTransaction && !this.#pendingPresentation,
      'physical source edit requires the idle held admitted driver');
    this.#busy = true; let timer;
    const observed = this.#sequence.toString();
    try {
      const delivered = await Promise.race([Promise.resolve().then(() => this.#port.request({
        command:kind==='physical'?{operation:'performance-physical-edit',edit:structuredClone(operand)}:{operation:'performance-acoustic-edit',configuration:structuredClone(operand)},
        observed_request_id:observed,instance_ref:this.#instance,
        event_ref:this.#native.event_ref,subject_ref:this.#native.subject_ref})),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('native physical edit acknowledgement timed out')),this.#timeout);})]);
      need(!this.#disposed,'driver disposed during native physical operation');
      const result=kind==='physical'?delivered?.physical_edit:delivered?.acoustic_edit;
      need(result?.schema===`oi.native-${kind}-scene-edit-result/v1` && result.custody_retained===true &&
        result.before_native_request_id===observed,'original physical native counter/custody omitted or reordered');
      const receipts=[result.prepare_host_receipt,result.host_receipt].filter(receipt=>receipt!==null&&receipt!==undefined);
      need(receipts.length>=1&&receipts.length<=2,'original physical native receipts omitted');
      for (let index=0;index<receipts.length;index++) {
        const reply=receipts[index],next=this.#sequence+1n;
        need(next<=U64&&reply?.schema==='ql.field-host-receipt/v1'&&reply.instance_ref===this.#instance&&
          reply.request_id===next.toString()&&reply.last_request_id===reply.request_id,'foreign or reordered physical HostReceipt');
        need(reply.available===true&&(reply.status==='ok'||reply.status==='refused'),'physical native acknowledgement standing unknown');
        need((index===0?result.prepare_native_request_id:result.apply_native_request_id)===reply.request_id,'physical phase differs from its original native receipt');
        const frame=reply.field;
        need(frame?.event_ref===this.#native.event_ref&&frame?.subject_ref===this.#native.subject_ref&&
          frame?.sample_rate===this.#native.sample_rate&&Array.isArray(frame.audio),'foreign physical native field');
        need(JSON.stringify(frame).length*2<=this.#maxBytes,'physical native field exceeds presentation memory ceiling');
        this.#field.validate(frame);this.#audio.validate(frame);
        need(sameState(frame,this.#native)&&frame.audio.length===0,'physical edit changed or replayed legacy PCM');
        this.#sequence=cursor(reply.request_id);this.#native=withoutAudio(frame);
      }
      need(result.after_native_request_id===this.#sequence.toString(),'physical result omitted the actual final native ordinal');
      if(result.accepted===true)need(receipts.length===2&&result.application_committed===true&&result.state==='applied_and_retained','physical success omitted its original application/document retention');
      return delivered;
    } catch(error) {this.#unknown(String(error));throw error;}
    finally {clearTimeout(timer);this.#busy=false;this.#releaseProcedures();}
  }
}
