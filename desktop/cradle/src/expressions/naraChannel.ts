/** Narrow Nara instrument facade for one hosted Expression frame. Native
 * owners supply all profile/calculation/conversation values; none are accepted
 * back from the frame as authoritative readings or written to browser storage. */
import type {KernelTransportStatus} from '../kernel/types';
import {encounter, type EncounterReading} from '../encounter/client';
import {listFlowInstances, readFlowInstance, type FlowInstance, type FlowInstanceRow} from '../flow/instances';
import {readNativeAnswer, readDayTarget, retainAnswerInFlow, proposeAnswerForDay,
  type NativeAnswer, type NativeDayTarget} from '../nara/nativeReturn';
import {nativeVoice} from '../nara/nativeVoice';
import {naraIdentity} from '../nara/identity/client';
import {clearCurrentIdentity, currentIdentity, selectCurrentIdentity} from '../nara/identity/current';
import type {IdentityReading, IdentitySource, NaraIdentityRequest} from '../nara/identity/types';
import {acquireNativeDialogue, currentTurnBasis, lookupNativeDialogue, nativeTurnText,
  readNativeExpression, reconcileNativeTurn, submissionUncertain, submitNativeTurn,
  type NativeDialogue} from '../nara/nativeDialogue';
import {NARA_INSTRUMENT_CHANNEL, type InstrumentBasis, type NaraInstrumentRequest,
  type NaraInstrumentReply, type NaraInstrumentState, type InstrumentVoiceRequest} from '../nara/instrumentProtocol';

export interface NaraChannelOwner {
  project: () => string;
  /** The host's current native scene announcement, never the request's ref. */
  expression: () => {expression_ref: string; revision: number} | null;
}
type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A typed Nara instrument request is required.');
  return value as ObjectValue;
}
function fields(value: ObjectValue, allowed: string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('This Nara operation contains unsupported fields.');
}
function text(value: unknown, label: string, limit = 4096): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error(`A bounded ${label} is required.`);
  return value;
}
function source(value: unknown): IdentitySource {
  const v = object(value); fields(v, ['source_ref', 'revision']);
  return {source_ref: text(v.source_ref, 'saved identity source'), revision: text(v.revision, 'saved source revision')};
}
function positiveId(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('A native answer block ID is required.');
  return value as number;
}
function voiceRequest(value: unknown): InstrumentVoiceRequest {
  const v = object(value);
  if (v.operation === 'open') {fields(v, ['operation']); return {operation: 'open'};}
  const voice_ref = text(v.voice_ref, 'native voice reference');
  switch (v.operation) {
    case 'read': case 'listen': case 'close':
      fields(v, ['operation', 'voice_ref']); return {operation: v.operation, voice_ref};
    case 'transcribe': {
      fields(v, ['operation', 'voice_ref', 'capture_ref', 'wav_base64']);
      const wav = text(v.wav_base64, 'captured WAV', 12_800_064);
      if (wav.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(wav)) throw new Error('Capture must be bounded base64 WAV.');
      return {operation: 'transcribe', voice_ref, capture_ref: text(v.capture_ref, 'native capture reference'), wav_base64: wav};
    }
    case 'speak': fields(v, ['operation', 'voice_ref', 'answer_block_id']); return {operation: 'speak', voice_ref, answer_block_id: positiveId(v.answer_block_id)};
    case 'complete': fields(v, ['operation', 'voice_ref', 'response_ref']); return {operation: 'complete', voice_ref, response_ref: text(v.response_ref, 'native response reference')};
    default: throw new Error('Unsupported native voice operation.');
  }
}
function request(value: unknown): NaraInstrumentRequest {
  const isCapture = !!value && typeof value === 'object' && (value as ObjectValue).operation === 'voice'
    && (value as {request?: {operation?: unknown}}).request?.operation === 'transcribe';
  if (new TextEncoder().encode(JSON.stringify(value)).length > (isCapture ? 13 * 1024 * 1024 : 2 * 1024 * 1024)) throw new Error('The Nara request exceeds its bounded input size.');
  const v = object(value);
  switch (v.operation) {
    case 'identity': {
      fields(v, ['operation', 'request']); const inner = object(v.request);
      switch (inner.operation) {
        case 'list': fields(inner, ['operation']); break;
        case 'open': fields(inner, ['operation', 'source_ref']); text(inner.source_ref, 'saved identity source'); break;
        case 'inspect': case 'calculate': fields(inner, ['operation', 'profile']); object(inner.profile); break;
        case 'save':
          fields(inner, ['operation', 'profile', 'source_ref', 'expected_revision']); object(inner.profile);
          if (inner.source_ref !== null) text(inner.source_ref, 'saved identity source');
          if (inner.expected_revision !== null) text(inner.expected_revision, 'saved source revision');
          if ((inner.source_ref === null) !== (inner.expected_revision === null)) throw new Error('Saving a profile requires both its source and exact revision.');
          break;
        default: throw new Error('Unsupported native identity operation.');
      }
      return {operation: 'identity', request: inner as unknown as NaraIdentityRequest};
    }
    case 'select_identity':
      fields(v, ['operation', 'source', 'input_revision']);
      return {operation: 'select_identity', source: source(v.source), input_revision: text(v.input_revision, 'native identity input revision')};
    case 'release_identity': fields(v, ['operation']); return {operation: 'release_identity'};
    case 'read': case 'send': case 'reconnect': case 'interrupt':
    case 'return_inspect': case 'return_flow_read': case 'return_flow': case 'return_day': case 'voice': {
      const extra = v.operation === 'read' ? ['before'] : v.operation === 'send' ? ['question']
        : v.operation === 'return_inspect' ? ['answer_block_id']
        : v.operation === 'return_flow_read' ? ['review_ref', 'flow_ref']
        : v.operation === 'return_flow' ? ['review_ref', 'flow_ref', 'expected_revision']
        : v.operation === 'return_day' ? ['review_ref', 'field_id'] : v.operation === 'voice' ? ['request'] : [];
      fields(v, ['operation', 'basis', 'role', ...extra]);
      const b = object(v.basis); fields(b, ['expression_ref', 'source']);
      const basis: InstrumentBasis = {expression_ref: text(b.expression_ref, 'Expression reference'), source: source(b.source)};
      if (v.role !== 'nara' && v.role !== 'epii') throw new Error('Choose the native Nara or Epii dialogue.');
      if (v.operation === 'voice') {
        if (v.role !== 'nara') throw new Error('The native speech owner is bound to Nara.');
        return {operation: 'voice', basis, role: 'nara', request: voiceRequest(v.request)};
      }
      if (v.operation === 'return_inspect') return {operation: 'return_inspect', basis, role: v.role, answer_block_id: positiveId(v.answer_block_id)};
      if (v.operation === 'return_day') return {operation: 'return_day', basis, role: v.role, review_ref: text(v.review_ref, 'review reference'), field_id: text(v.field_id, 'Day field')};
      if (v.operation === 'return_flow_read') return {operation: 'return_flow_read', basis, role: v.role, review_ref: text(v.review_ref, 'review reference'), flow_ref: text(v.flow_ref, 'Flow reference')};
      if (v.operation === 'return_flow') return {operation: 'return_flow', basis, role: v.role, review_ref: text(v.review_ref, 'review reference'), flow_ref: text(v.flow_ref, 'Flow reference'), expected_revision: text(v.expected_revision, 'Flow revision')};
      if (v.operation === 'read') {
        if (v.before !== undefined && (!Number.isSafeInteger(v.before) || (v.before as number) < 1)) throw new Error('Native history cursor is invalid.');
        return {operation: 'read', basis, role: v.role, ...(v.before !== undefined ? {before: v.before as number} : {})};
      }
      if (v.operation === 'send') return {operation: 'send', basis, role: v.role, question: text(v.question, 'question', 64 * 1024)};
      return {operation: v.operation, basis, role: v.role};
    }
    default: throw new Error('Unsupported Nara instrument operation.');
  }
}

export function relayNaraChannel(frame: HTMLIFrameElement, transport: KernelTransportStatus, owner: NaraChannelOwner): () => void {
  let live = true, epoch = 0, selectionGeneration = 0, mutating = false, selectedRef: string | null = null;
  const seen = new Set<number>();
  let review: {ref: string; selection: string; expressionRevision: number; answer: NativeAnswer;
    flows: FlowInstanceRow[]; day: NativeDayTarget | null; flow: FlowInstance | null} | null = null;
  let voice: {ref: string; project: string; selection: string; expressionRef: string; expressionRevision: number; closing?: boolean} | null = null;
  const closeVoice = async () => {
    const held = voice; if (!held) return;
    // Detach before awaiting so an obsolete frame cannot operate this lease.
    voice = null;
    await nativeVoice(transport, held.project, {operation: 'close', voice_ref: held.ref});
  };
  const disposeVoice = () => {void closeVoice().catch(() => console.warn('The native Nara voice lease could not be closed during frame cleanup.'));};
  // The cache contains only owner-calculated readings from this frame epoch.
  // Four recent inputs permit save/review without a second calculation store.
  const calculated = new Map<string, IdentityReading>();
  const remember = (reading: IdentityReading) => {
    calculated.delete(reading.input_revision); calculated.set(reading.input_revision, reading);
    while (calculated.size > 4) calculated.delete(calculated.keys().next().value!);
  };
  const release = () => {
    selectionGeneration++;
    review = null; disposeVoice();
    const current = currentIdentity();
    if (selectedRef && current?.selection_ref === selectedRef) clearCurrentIdentity(current.reading.person_ref);
    selectedRef = null;
  };
  const announce = () => {
    if (live) frame.contentWindow?.postMessage({v: 1, kind: 'oi-kernel-channel', channel: NARA_INSTRUMENT_CHANNEL}, '*');
  };
  const loaded = () => {epoch++; release(); calculated.clear(); seen.clear(); mutating = false; announce();};
  const execute = async (r: NaraInstrumentRequest, requireEpoch: () => void): Promise<NaraInstrumentReply> => {
    requireEpoch();
    if (r.operation === 'identity') {
      const result = await naraIdentity(transport, r.request); requireEpoch();
      if (r.request.operation === 'calculate' && result.reading) remember(result.reading);
      const held = currentIdentity();
      if (result.reading && held?.reading.person_ref === result.reading.person_ref
          && (held.reading.input_revision !== result.reading.input_revision
              || (result.source && held.source.revision !== result.source.revision))) {
        release();
      }
      return result;
    }
    if (r.operation === 'release_identity') {
      release(); return {schema: 'oi.nara-instrument-state/v1', identity: null, expression: null, dialogue: null, conversation: null};
    }
    if (r.operation === 'select_identity') {
      const at = selectionGeneration;
      const requireSelecting = () => {
        requireEpoch();
        if (selectionGeneration !== at) throw new Error('Identity selection was released while its native source was being read. Select it again explicitly.');
      };
      const opened = await naraIdentity(transport, {operation: 'open', source_ref: r.source.source_ref}); requireSelecting();
      if (!opened.source || !opened.reading || opened.source.source_ref !== r.source.source_ref
          || opened.source.revision !== r.source.revision || opened.reading.input_revision !== r.input_revision) throw new Error('The saved identity changed. Reopen and review its current input before selecting it.');
      let reading = calculated.get(r.input_revision);
      if (!reading) {
        const result = await naraIdentity(transport, {operation: 'calculate', profile: opened.reading.profile}); requireSelecting();
        if (!result.reading) throw new Error('The native owner did not calculate this identity.');
        reading = result.reading; remember(reading);
      }
      if (reading.input_revision !== opened.reading.input_revision || reading.person_ref !== opened.reading.person_ref
          || reading.nara_ref !== opened.reading.nara_ref) throw new Error('The native calculation belongs to a different identity input.');
      // Calculation may take time; its source must still be current at selection.
      const confirmed = await naraIdentity(transport, {operation: 'open', source_ref: r.source.source_ref}); requireSelecting();
      if (confirmed.source?.revision !== r.source.revision || confirmed.reading?.input_revision !== reading.input_revision) throw new Error('The saved profile changed during calculation. Review it again.');
      release(); selectCurrentIdentity(reading, opened.source); selectedRef = currentIdentity()!.selection_ref;
      return {schema: 'oi.nara-instrument-state/v1', identity: {source: opened.source, reading}, expression: null, dialogue: null, conversation: null};
    }

    if (r.operation === 'voice' && r.request.operation === 'close') {
      if (!voice || voice.ref !== r.request.voice_ref) throw new Error('This voice lease does not belong to the current instrument.');
      const held = voice; held.closing = true;
      const result = await nativeVoice(transport, held.project, r.request);
      if (voice === held) voice = null;
      requireEpoch(); return result;
    }
    const identity = currentIdentity();
    if (!identity || !selectedRef || identity.selection_ref !== selectedRef || identity.source.source_ref !== r.basis.source.source_ref
        || identity.source.revision !== r.basis.source.revision) throw new Error('Select this saved identity in the current Nara instrument first.');
    const expression = owner.expression(), project = owner.project();
    if (!expression || expression.expression_ref !== r.basis.expression_ref || !Number.isSafeInteger(expression.revision)) throw new Error('The requested Expression is not the host’s current native Expression.');
    const requireCurrent = () => {
      requireEpoch(); const now = owner.expression();
      if (currentIdentity()?.selection_ref !== identity.selection_ref || selectedRef !== identity.selection_ref
          || owner.project() !== project || now?.expression_ref !== expression.expression_ref || now.revision !== expression.revision) throw new Error('The selected person or Expression changed. Refresh the instrument before continuing.');
    };
    const fresh = await naraIdentity(transport, {operation: 'open', source_ref: identity.source.source_ref}); requireCurrent();
    if (fresh.source?.revision !== identity.source.revision || fresh.reading?.input_revision !== identity.reading.input_revision) {
      release(); throw new Error('The saved identity changed. Reopen and review its current revision.');
    }
    const document = await readNativeExpression(transport, expression.expression_ref); requireCurrent();
    if (document.revision !== expression.revision) throw new Error('The native Expression is newer than this instrument. Refresh its scene before continuing.');
    let dialogue: NativeDialogue | null = await lookupNativeDialogue(transport, project, identity, expression.expression_ref, r.role, true);
    requireCurrent();
    if (r.operation === 'voice') {
      if (!dialogue) throw new Error('Begin the native Nara dialogue before opening voice.');
      if (r.request.operation === 'open') {
        if (voice) throw new Error('Close the current voice connection before opening another.');
        const basis = await currentTurnBasis(transport, dialogue, identity, expression.expression_ref); requireCurrent();
        if (basis.document.revision !== expression.revision) throw new Error('Refresh the selected centre before opening voice.');
        const result = await nativeVoice(transport, project, {operation: 'open', binding: {...dialogue.binding, operation: 'lookup'}, context: basis.context});
        try {requireCurrent();} catch (error) {
          await nativeVoice(transport, project, {operation: 'close', voice_ref: result.voice_ref}); throw error;
        }
        voice = {ref: result.voice_ref, project, selection: identity.selection_ref, expressionRef: expression.expression_ref, expressionRevision: expression.revision};
        return result;
      }
      const lease = voice;
      if (!lease || lease.closing || lease.ref !== r.request.voice_ref || lease.selection !== identity.selection_ref
          || lease.project !== project || lease.expressionRef !== expression.expression_ref || lease.expressionRevision !== expression.revision) throw new Error('Close the previous voice connection and reopen it for the current person and selected centre.');
      const result = await nativeVoice(transport, project, r.request); requireCurrent();
      if (voice !== lease || lease.closing) throw new Error('This voice connection closed before the operation returned. Discard its audio or transcript.');
      return result;
    }
    if (r.operation === 'return_inspect') {
      if (!dialogue) throw new Error('No native dialogue is available for this answer.');
      const answer = await readNativeAnswer(transport, dialogue, r.answer_block_id); requireCurrent();
      const [listed, day] = await Promise.allSettled([listFlowInstances(transport), readDayTarget(transport)]); requireCurrent();
      const flows = listed.status === 'fulfilled' ? listed.value : [], target = day.status === 'fulfilled' ? day.value : null;
      review = {ref: `nara-answer-review:${crypto.randomUUID()}`, selection: identity.selection_ref,
        expressionRevision: expression.revision, answer, flows, day: target, flow: null};
      return {schema: 'oi.nara-instrument-return/v1', review_ref: review.ref,
        answer: {text: answer.answer, question: answer.question, block_ids: answer.answerBlockIds, original_basis: answer.basis},
        flows: flows.map(row => ({ref: row.location.ref, name: row.name})),
        day: target ? {source_ref: target.document.source.ref, document_id: target.document.document_id,
          revision: target.document.revision.revision, civil_date: target.day.temporal.civil_date, fields: target.fields} : null,
        unavailable: {...(listed.status === 'rejected' ? {flows: String(listed.reason)} : {}), ...(day.status === 'rejected' ? {day: String(day.reason)} : {})}};
    }
    if (r.operation === 'return_flow_read' || r.operation === 'return_flow' || r.operation === 'return_day') {
      const held = review;
      if (!held || held.ref !== r.review_ref || held.selection !== identity.selection_ref || held.expressionRevision !== expression.revision
          || held.answer.dialogue.key !== dialogue?.key) throw new Error('Read this completed answer and its destinations again before retaining it.');
      if (r.operation === 'return_flow_read') {
        const row = held.flows.find(row => row.location.ref === r.flow_ref);
        if (!row) throw new Error('Choose a Flow returned by the native destination list.');
        const flow = await readFlowInstance(transport, row.location); requireCurrent();
        if (review !== held) throw new Error('The answer review changed.');
        held.flow = flow;
        return {schema: 'oi.nara-instrument-return/v1', review_ref: held.ref,
          flow: {ref: flow.location.ref, revision: flow.revision, title: flow.doc.meta.title || 'Untitled Flow', entries: flow.doc.entries.length}};
      }
      if (r.operation === 'return_flow') {
        if (!held.flow || held.flow.location.ref !== r.flow_ref || held.flow.revision !== r.expected_revision) throw new Error('Read the selected Flow and review its exact revision before retaining this answer.');
        const result = await retainAnswerInFlow(transport, held.flow, held.answer); requireCurrent();
        window.dispatchEvent(new CustomEvent('oi:file-draft-changed', {detail: {ref: r.flow_ref}}));
        return {schema: 'oi.nara-instrument-return/v1', review_ref: held.ref,
          retained: {ref: r.flow_ref, revision: result.revision, entry_id: result.entryId, already: result.already}};
      }
      if (!held.day) throw new Error('There is no native Day ready for a reviewed quotation.');
      const result = await proposeAnswerForDay(transport, held.day, r.field_id, held.answer); requireCurrent();
      return {schema: 'oi.nara-instrument-return/v1', review_ref: held.ref,
        proposal: {return_ref: result.return_ref, revision: result.revision, status: result.record.status, included: result.included}};
    }
    if (r.operation === 'send') {
      dialogue ??= await acquireNativeDialogue(transport, project, identity, expression.expression_ref, r.role); requireCurrent();
      const basis = await currentTurnBasis(transport, dialogue, identity, expression.expression_ref); requireCurrent();
      if (basis.document.revision !== expression.revision) throw new Error('The selected centre or relation changed before this turn. Refresh and review it.');
      await submitNativeTurn(transport, dialogue, nativeTurnText(r.question, basis, r.role), requireCurrent); requireCurrent();
    } else if (r.operation === 'reconnect') {
      if (!dialogue?.provisioning.provider) throw new Error('No recorded native provider is available to reconnect.');
      await encounter(transport, project, {action: 'reconnect', agent_session: dialogue.provisioning.agent_session,
        space: dialogue.provisioning.space, provider: dialogue.provisioning.provider}); requireCurrent();
    } else if (r.operation === 'interrupt') {
      if (!dialogue) throw new Error('There is no bound native dialogue to interrupt.');
      await encounter(transport, project, {action: 'cancel', agent_session: dialogue.provisioning.agent_session,
        reason: 'Person requested interruption through the current Nara Expression instrument'}); requireCurrent();
    }
    let conversation: EncounterReading | null = null;
    if (dialogue) {
      if (r.operation === 'read' && submissionUncertain(dialogue)) await reconcileNativeTurn(transport, dialogue);
      requireCurrent();
      conversation = await encounter<EncounterReading>(transport, project, {action: 'view', agent_session: dialogue.provisioning.agent_session,
        ...(r.operation === 'read' && r.before !== undefined ? {before: r.before} : {})}); requireCurrent();
      if (conversation.schema !== 'aikit.encounter-view/v1' || conversation.agent_session !== dialogue.provisioning.agent_session) throw new Error('The native owner returned a different conversation.');
    }
    const state: NaraInstrumentState = {schema: 'oi.nara-instrument-state/v1', identity: {source: identity.source, reading: identity.reading},
      expression: document, dialogue, conversation};
    return state;
  };
  const handler = async (event: MessageEvent) => {
    if (!live || event.source !== frame.contentWindow || event.data?.v !== 1) return;
    if (event.data.kind === 'oi-kernel-hello') {announce(); return;}
    if (event.data.kind !== NARA_INSTRUMENT_CHANNEL) return;
    const req = event.data.req;
    if (!Number.isSafeInteger(req) || req < 1) return;
    const at = epoch, windowAtRequest = frame.contentWindow;
    const current = () => live && epoch === at && frame.contentWindow === windowAtRequest;
    const requireEpoch = () => {if (!current()) throw new Error('The Nara instrument frame changed before the operation finished.');};
    const respond = (payload: {ok: true; data: NaraInstrumentReply} | {ok: false; error: string}) => {
      if (current()) windowAtRequest?.postMessage({v: 1, kind: `${NARA_INSTRUMENT_CHANNEL}-result`, req, ...payload}, event.origin === 'null' ? '*' : event.origin);
    };
    let held = false;
    try {
      if (seen.has(req)) throw new Error('This instrument request was already handled; read the native state before retrying.');
      if (seen.size >= 65536) throw new Error('This instrument has reached its request bound. Reopen the frame.');
      seen.add(req);
      const r = request(event.data.request);
      // Reads, interruption and release remain available during native work.
      // Release invalidates the selection immediately; outstanding operations
      // must pass their current-selection guard before publishing a result.
      const changes = r.operation !== 'read' && r.operation !== 'interrupt' && r.operation !== 'release_identity'
        && !(r.operation === 'voice' && (r.request.operation === 'close' || r.request.operation === 'read'))
        && !(r.operation === 'identity' && ['list', 'open'].includes(r.request.operation));
      if (changes && mutating) throw new Error('Another Nara operation is still pending.');
      if (changes) {mutating = true; held = true;}
      respond({ok: true, data: await execute(r, requireEpoch)});
    } catch (cause) {respond({ok: false, error: cause instanceof Error ? cause.message : String(cause)});}
    finally {if (held && current()) mutating = false;}
  };
  window.addEventListener('message', handler); frame.addEventListener('load', loaded); announce();
  return () => {live = false; epoch++; release(); calculated.clear(); seen.clear(); window.removeEventListener('message', handler); frame.removeEventListener('load', loaded);};
}
