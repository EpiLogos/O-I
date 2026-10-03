/** Narrow Nara instrument facade for one hosted Expression frame. Native
 * owners supply all profile/calculation/conversation values; none are accepted
 * back from the frame as authoritative readings or written to browser storage. */
import {kernelOp} from '../kernel/bridge';
import {validateCoordinateExpression} from '../nara/coordinateExpression';
import {validateRuntimeReadiness} from '../nara/runtimeReadiness';
import {readNativePersonalSkyInput} from '../nara/nativeSkyInput';
import type {KernelTransportStatus} from '../kernel/types';
import {encounter, type EncounterReading, type EncounterStatus} from '../encounter/client';
import {listFlowInstances, readFlowInstance, type FlowInstance, type FlowInstanceRow} from '../flow/instances';
import {readNativeAnswer, readDayTarget, retainAnswerInFlow, proposeAnswerForDay,
  type NativeAnswer, type NativeDayTarget} from '../nara/nativeReturn';
import {keepNativeAnswerInExpression,readStoredNativeAnswers} from '../nara/nativeAnswerExpression';
import {keptAnswerCarrier} from '../nara/nativeKeptAnswer';
import {nativeEpii} from '../nara/nativeEpii';
import {nativeVoice} from '../nara/nativeVoice';
import {naraIdentity} from '../nara/identity/client';
import {clearCurrentIdentity, currentIdentity, selectCurrentIdentity} from '../nara/identity/current';
import type {IdentityReading, IdentitySource, NaraIdentityRequest} from '../nara/identity/types';
import {acquireNativeDialogue, cachedNativeDialogue, currentTurnBasis, lookupNativeDialogue, nativeTurnText,
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
    case 'source': {
      fields(v,['operation','coordinate_ref','inventory']);
      const coordinate_ref=text(v.coordinate_ref,'exact source reference');
      if(v.inventory===undefined)return {operation:'source',coordinate_ref};
      const page=object(v.inventory);fields(page,['offset','limit']);
      if(!Number.isSafeInteger(page.offset)||Number(page.offset)<0||!Number.isSafeInteger(page.limit)||Number(page.limit)<1||Number(page.limit)>256)throw Error('Source inventory needs an existing offset and 1–256 records.');
      return {operation:'source',coordinate_ref,inventory:{offset:Number(page.offset),limit:Number(page.limit)}};
    }
    case 'coordinate': {
      fields(v,['operation','request']);const inner=object(v.request);fields(inner,['coordinate_ref','face','include_content','related_coordinates','inventory']);
      if(inner.face!=='bimba'&&inner.face!=='pratibimba')throw Error('Choose a native coordinate face.');
      if(inner.include_content!==undefined&&typeof inner.include_content!=='boolean')throw Error('Full source disclosure must be an explicit boolean.');
      let related_coordinates:string[]|undefined;
      if(inner.related_coordinates!==undefined){if(!Array.isArray(inner.related_coordinates)||inner.related_coordinates.length>63)throw Error('Choose at most 63 related native coordinates.');related_coordinates=inner.related_coordinates.map(ref=>text(ref,'related coordinate'));}
      let inventory:{offset:number;limit:number}|undefined;
      if(inner.inventory!==undefined){const page=object(inner.inventory);fields(page,['offset','limit']);if(!Number.isSafeInteger(page.offset)||Number(page.offset)<0||!Number.isSafeInteger(page.limit)||Number(page.limit)<1||Number(page.limit)>256)throw Error('Source inventory needs an existing offset and 1–256 records.');inventory={offset:Number(page.offset),limit:Number(page.limit)};}
      return {operation:'coordinate',request:{coordinate_ref:text(inner.coordinate_ref,'coordinate reference'),face:inner.face,...(inner.include_content!==undefined?{include_content:inner.include_content}:{}),...(related_coordinates?{related_coordinates}:{}),...(inventory?{inventory}:{})}};
    }
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
        case 'transit': fields(inner,['operation','request']); object(inner.request); break;
        case 'personal_current':
          fields(inner,['operation','source_ref','expected_revision','sky_request','sky_snapshot','snapshot_purpose']);
          text(inner.source_ref,'saved identity source');text(inner.expected_revision,'saved source revision');readNativePersonalSkyInput(inner);break;
        default: throw new Error('Unsupported native identity operation.');
      }
      return {operation: 'identity', request: inner as unknown as NaraIdentityRequest};
    }
    case 'select_identity':
      fields(v, ['operation', 'source', 'input_revision']);
      return {operation: 'select_identity', source: source(v.source), input_revision: text(v.input_revision, 'native identity input revision')};
    case 'release_identity': fields(v, ['operation']); return {operation: 'release_identity'};
    case 'read': case 'send': case 'epii_delegate': case 'epii_inspect': case 'epii_accept': case 'reconnect': case 'interrupt':
    case 'act_inspect': case 'act_focus': case 'act_restore': case 'act_status': case 'current_pin': case 'current_read': case 'current_restore': case 'readiness': case 'm3':
    case 'return_expression':case 'return_expression_list':case 'return_expression_read':
    case 'return_inspect': case 'return_flow_read': case 'return_flow': case 'return_day': case 'voice': {
      const extra = v.operation === 'read' ? ['before'] : (v.operation === 'send' || v.operation === 'epii_delegate') ? ['question']
        : v.operation === 'epii_inspect' ? ['answer_block_id']
        : v.operation === 'epii_accept' ? ['answer_block_id','focus_ref']
        : v.operation === 'act_inspect' ? ['answer_block_id']
        : v.operation === 'act_focus' ? ['answer_block_id','target_ref']
        : v.operation === 'act_restore' ? ['act_ref','expected_revision']
        : v.operation === 'current_pin' ? ['sky_request','sky_snapshot','snapshot_purpose']
        : v.operation === 'return_expression' ? ['review_ref'] : v.operation === 'return_expression_read' ? ['answer_ref']
        : v.operation === 'return_inspect' ? ['answer_block_id']
        : v.operation === 'return_flow_read' ? ['review_ref', 'flow_ref']
        : v.operation === 'return_flow' ? ['review_ref', 'flow_ref', 'expected_revision']
        : v.operation === 'return_day' ? ['review_ref', 'field_id'] : (v.operation === 'voice'||v.operation === 'm3') ? ['request'] : [];
      fields(v, ['operation', 'basis', 'role', ...extra]);
      const b = object(v.basis); fields(b, ['expression_ref', 'source']);
      const basis: InstrumentBasis = {expression_ref: text(b.expression_ref, 'Expression reference'), source: source(b.source)};
      if (v.role !== 'nara' && v.role !== 'epii') throw new Error('Choose the native Nara or Epii dialogue.');
      if(['epii_delegate','epii_inspect','epii_accept'].includes(String(v.operation))&&v.role!=='epii')throw Error('Structured inquiry belongs to the native Epii session.');
      if(['act_inspect','act_focus','act_restore','act_status','current_pin','current_read','current_restore','readiness'].includes(String(v.operation))&&v.role!=='nara')throw Error('Personal context belongs to the native Nara session.');
      if(v.operation==='return_expression_list')return {operation:'return_expression_list',basis,role:v.role};
      if(v.operation==='return_expression_read')return {operation:'return_expression_read',basis,role:v.role,answer_ref:text(v.answer_ref,'kept native answer reference')};
      if(v.operation==='return_expression')return {operation:'return_expression',basis,role:v.role,review_ref:text(v.review_ref,'native answer review')};
      if(v.operation==='act_status')return {operation:'act_status',basis,role:'nara'};
      if(v.operation==='readiness')return {operation:'readiness',basis,role:'nara'};
      if(v.operation==='m3'){
        if(v.role!=='nara')throw Error('M3 reception belongs to the current Nara.');
        const inner=object(v.request);
        if(inner.operation==='read')fields(inner,['operation']);
        else if(inner.operation==='open'){
          fields(inner,['operation','selections','activity_policy']);
          const selected=object(inner.selections);fields(selected,['clock_steps','address','pose','aperture','matrix_axis','rna']);
          for(const key of ['clock_steps','address','pose','aperture','matrix_axis'])if(!Number.isSafeInteger(selected[key])||(selected[key] as number)<0)throw Error('Choose each native M3 opening value.');
          if(typeof selected.rna!=='boolean')throw Error('Choose DNA or RNA.');
          if(inner.activity_policy!==undefined&&inner.activity_policy!=='historical-personal-frame-sprite-v1')throw Error('Unsupported activity policy.');
        }else if(inner.operation==='select_activity_policy'){
          fields(inner,['operation','expected_generation','expected_revision','activity_policy']);positiveId(inner.expected_generation);text(inner.expected_revision,'M3 revision');
          if(inner.activity_policy!=='historical-personal-frame-sprite-v1')throw Error('Unsupported activity policy.');
        }else if(inner.operation==='apply'){
          fields(inner,['operation','expected_generation','operations']);positiveId(inner.expected_generation);
          if(!Array.isArray(inner.operations)||!inner.operations.length||inner.operations.length>64)throw Error('Choose 1–64 native M3 operations.');
          // QL validates each exact tagged operation; authority, timestamps,
          // subject and event are supplied only by the native owner.
          for(const operation of inner.operations)object(operation);
        }else throw Error('Unsupported native M3 operation.');
        return {operation:'m3',basis,role:'nara',request:inner as unknown as import('../nara/nativeM3').M3Gesture};
      }
      if(v.operation==='current_read'||v.operation==='current_restore')return {operation:v.operation,basis,role:'nara'};
      if(v.operation==='current_pin')return {operation:'current_pin',basis,role:'nara',...readNativePersonalSkyInput(v)};
      if(v.operation==='act_inspect')return {operation:'act_inspect',basis,role:'nara',answer_block_id:positiveId(v.answer_block_id)};
      if(v.operation==='act_focus')return {operation:'act_focus',basis,role:'nara',answer_block_id:positiveId(v.answer_block_id),target_ref:text(v.target_ref,'cited native focus')};
      if(v.operation==='act_restore')return {operation:'act_restore',basis,role:'nara',act_ref:text(v.act_ref,'native expressive act'),expected_revision:positiveId(v.expected_revision)};
      if(v.operation==='epii_inspect')return {operation:'epii_inspect',basis,role:'epii',answer_block_id:positiveId(v.answer_block_id)};
      if(v.operation==='epii_accept')return {operation:'epii_accept',basis,role:'epii',answer_block_id:positiveId(v.answer_block_id),focus_ref:text(v.focus_ref,'proposed native focus')};
      if(v.operation==='epii_delegate')return {operation:'epii_delegate',basis,role:'epii',question:text(v.question,'inquiry',16*1024)};
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
  let voiceGeneration = 0;
  const interrupted = {nara: 0, epii: 0};
  const seen = new Set<number>();
  let review: {ref: string; selection: string; expressionRevision: number; answer: NativeAnswer;
    flows: FlowInstanceRow[]; day: NativeDayTarget | null; flow: FlowInstance | null} | null = null;
  let voice: {ref: string; project: string; selection: string; expressionRef: string; expressionRevision: number; closing?: boolean; closePending?: Promise<void>} | null = null;
  const closeVoice = async () => {
    const held = voice; if (!held) return;
    // Refuse further speech immediately, retaining the lease for an explicit
    // retry if the native owner does not acknowledge closure.
    held.closing = true;
    held.closePending ??= nativeVoice(transport, held.project, {operation: 'close', voice_ref: held.ref})
      .then(result => {
        if (result.closed !== true) throw new Error('The native voice owner did not acknowledge closure.');
        if (voice === held) voice = null;
      }).finally(() => {held.closePending = undefined;});
    await held.closePending;
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
    const wasSelected = selectedRef !== null;
    selectionGeneration++;
    voiceGeneration++;
    review = null; disposeVoice();
    const current = currentIdentity();
    if (selectedRef && current?.selection_ref === selectedRef) clearCurrentIdentity(current.reading.person_ref);
    selectedRef = null;
    if (wasSelected && live) frame.contentWindow?.postMessage({v: 1, kind: 'oi-nara-identity-released'}, '*');
  };
  const announce = () => {
    if (live) frame.contentWindow?.postMessage({v: 1, kind: 'oi-kernel-channel', channel: NARA_INSTRUMENT_CHANNEL}, '*');
  };
  const loaded = () => {epoch++; release(); calculated.clear(); seen.clear(); mutating = false; announce();};
  const execute = async (r: NaraInstrumentRequest, requireEpoch: () => void): Promise<NaraInstrumentReply> => {
    requireEpoch();
    if(r.operation==='source'){
      const response=await kernelOp(transport,{op:'nara_coordinate',request:{coordinate_ref:r.coordinate_ref,face:'bimba',source_only:true,...(r.inventory?{inventory:r.inventory}:{})}});requireEpoch();
      if(response.error||response.outcome?.result!=='nara_coordinate')throw Error(response.error??'The complete shared source owner did not return a reading.');
      const reading=response.outcome.data as unknown as import('../nara/instrumentProtocol').NaraSourceReading;
      if(!['ql.bimba-coordinate-content/v1','ql.bimba-inventory/v1'].includes(reading?.schema)||!reading.source_revision||!reading.registry_revision)throw Error('The native source owner returned an unsupported source reading.');
      return reading;
    }
    if(r.operation==='coordinate'){
      const response=await kernelOp(transport,{op:'nara_coordinate',request:r.request});requireEpoch();
      if(response.error||response.outcome?.result!=='nara_coordinate')throw Error(response.error??'The native coordinate owner did not return a reading.');
      return validateCoordinateExpression(response.outcome.data);
    }
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
      voiceGeneration++;
      await closeVoice();
      requireEpoch(); return {schema: 'oi.nara-voice/v1', voice_ref: r.request.voice_ref, closed: true};
    }
    const identity = currentIdentity();
    if (!identity || !selectedRef || identity.selection_ref !== selectedRef || identity.source.source_ref !== r.basis.source.source_ref
        || identity.source.revision !== r.basis.source.revision) throw new Error('Select this saved identity in the current Nara instrument first.');
    const expression = owner.expression(), project = owner.project();
    if (!expression || expression.expression_ref !== r.basis.expression_ref || !Number.isSafeInteger(expression.revision)) throw new Error('The requested Expression is not the host’s current native Expression.');
    if (r.operation === 'interrupt') {
      interrupted[r.role]++;
      if (r.role === 'nara') voiceGeneration++;
      const hadVoice = r.role === 'nara' && voice !== null;
      // Stop effects independently. Source correction must not prevent closing
      // an already-bound voice or cancelling its existing native conversation.
      let stoppedSession: string | null = null, cancellationRequested = false;
      const results = await Promise.allSettled([
        r.role === 'nara' ? closeVoice() : Promise.resolve(),
        (async () => {
          const dialogue = await (cachedNativeDialogue(project, identity, expression.expression_ref, r.role)
            ?? lookupNativeDialogue(transport, project, identity, expression.expression_ref, r.role));
          if (!dialogue) return;
          stoppedSession = dialogue.provisioning.agent_session;
          if (dialogue.provisioning.resume_required) return;
          const status = await encounter<EncounterStatus>(transport, project, {action: 'status', agent_session: stoppedSession});
          if (status.state !== 'TurnInFlight' && status.state !== 'InterruptRequested') return;
          await encounter(transport, project, {action: 'cancel', agent_session: stoppedSession,
            reason: 'Person requested interruption through the current Nara Expression instrument'});
          cancellationRequested = true;
        })(),
      ]);
      const failures = results.flatMap((result, index) => result.status === 'rejected'
        ? [`${index === 0 ? 'Voice closure' : 'Response cancellation'} was not acknowledged: ${String(result.reason)}`] : []);
      if (failures.length) throw new Error(failures.join(' '));
      requireEpoch();
      return {schema: 'oi.nara-instrument-interruption/v1', agent_session: stoppedSession,
        cancellation_requested: cancellationRequested, voice_closed: hadVoice};
    }
    const turnGeneration = interrupted[r.role], speechGeneration = voiceGeneration;
    const requireCurrent = () => {
      requireEpoch(); const now = owner.expression();
      if (currentIdentity()?.selection_ref !== identity.selection_ref || selectedRef !== identity.selection_ref
          || owner.project() !== project || now?.expression_ref !== expression.expression_ref || now.revision !== expression.revision) throw new Error('The selected person or Expression changed. Refresh the instrument before continuing.');
      if (((r.operation === 'send' || r.operation === 'epii_delegate' || r.operation === 'act_focus') && interrupted[r.role] !== turnGeneration)
          || (r.operation === 'voice' && voiceGeneration !== speechGeneration)) throw new Error('This operation was stopped. Its late result has been discarded.');
    };
    const fresh = await naraIdentity(transport, {operation: 'open', source_ref: identity.source.source_ref}); requireCurrent();
    if (fresh.source?.revision !== identity.source.revision || fresh.reading?.input_revision !== identity.reading.input_revision) {
      release(); throw new Error('The saved identity changed. Reopen and review its current revision.');
    }
    const document = await readNativeExpression(transport, expression.expression_ref); requireCurrent();
    if (document.revision !== expression.revision) throw new Error('The native Expression is newer than this instrument. Refresh its scene before continuing.');
    if(r.operation==='readiness'){
      const response=await kernelOp(transport,{op:'nara_dialogue',project,request:{operation:'readiness',
        source_ref:identity.source.source_ref,expected_revision:identity.source.revision,
        person_ref:identity.reading.person_ref,nara_ref:identity.reading.nara_ref,
        expression_ref:expression.expression_ref,role:'nara'}});requireCurrent();
      if(response.error||response.outcome?.result!=='nara_dialogue'||response.outcome.data.schema!=='oi.nara-coordinate-context/v1')throw Error(response.error??'The native runtime owner did not return its context.');
      const reading=validateRuntimeReadiness(response.outcome.data.runtime_readiness);
      if(reading.expression_ref!==expression.expression_ref||reading.expression_revision!==String(expression.revision))throw Error('The native runtime disclosure belongs to a different Expression basis.');
      return reading;
    }
    if(r.operation==='m3'){
      const binding:import('../nara/dialogueTypes').NativeDialogueRequest={operation:'context',
        source_ref:identity.source.source_ref,expected_revision:identity.source.revision,
        person_ref:identity.reading.person_ref,nara_ref:identity.reading.nara_ref,
        expression_ref:expression.expression_ref,role:'nara'};
      const response=await kernelOp(transport,{op:'m3_reception',project,request:{...r.request,binding}});requireCurrent();
      if(response.error||response.outcome?.result!=='m3_reception')throw Error(response.error??'The native M3 owner did not answer.');
      const value=response.outcome.data;
      if(value.schema!=='oi.m3-reception-context/v1'||value.expression_ref!==expression.expression_ref||value.expression_revision!==expression.revision||value.person_ref!==identity.reading.person_ref||value.identity_revision!==identity.source.revision)throw Error('M3 returned a different encounter.');
      return value;
    }
    if(r.operation==='current_pin'||r.operation==='current_read'||r.operation==='current_restore'){
      const binding:import('../nara/dialogueTypes').NativeDialogueRequest={operation:'context',
        source_ref:identity.source.source_ref,expected_revision:identity.source.revision,
        person_ref:identity.reading.person_ref,nara_ref:identity.reading.nara_ref,
        expression_ref:expression.expression_ref,role:'nara'};
      const request:import('../nara/nativeCurrent').NativeCurrentRequest=r.operation==='current_pin'
        ?{operation:'pin',binding,...readNativePersonalSkyInput(r)}:{operation:r.operation==='current_restore'?'restore':'read',binding};
      requireCurrent();const reply=await kernelOp(transport,{op:'nara_current',project,request});requireCurrent();
      if(reply.error||reply.outcome?.result!=='nara_current')throw Error(reply.error??'The native personal current owner did not answer.');
      return reply.outcome.data;
    }
    if(r.operation==='return_expression_list'||r.operation==='return_expression_read'){
      const carrier=keptAnswerCarrier(document);
      if(carrier.world.person_ref!==identity.reading.person_ref||carrier.world.nara_ref!==identity.reading.nara_ref)throw Error('The stored answer belongs to another personal world.');
      const readings=await readStoredNativeAnswers(transport,document);requireCurrent();
      const own=readings.filter(value=>value.record.original_person_ref===identity.reading.person_ref&&value.record.original_nara_ref===identity.reading.nara_ref);
      if(r.operation==='return_expression_list')return {schema:'oi.nara-instrument-return/v1',review_ref:'stored-native-answers',expressions:own.map(r=>r.record)};
      const kept=own.find(value=>value.record.answer_ref===r.answer_ref);if(!kept)throw Error('That attributed native answer is not part of this personal world.');
      return {schema:'oi.nara-instrument-return/v1',review_ref:'stored-native-answers',kept};
    }
    let dialogue: NativeDialogue | null = await lookupNativeDialogue(transport, project, identity, expression.expression_ref, r.role, true);
    requireCurrent();
    if (r.operation === 'voice') {
      if (!dialogue) throw new Error('Begin the native Nara dialogue before opening voice.');
      if (r.request.operation === 'open') {
        // A previous failed close remains owned here. Explicitly opening voice
        // retries its closure before admitting any replacement lease.
        if (voice?.closing) {await closeVoice(); requireCurrent();}
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
    if(r.operation==='act_inspect'||r.operation==='act_focus'||r.operation==='act_restore'||r.operation==='act_status'){
      if(!dialogue)throw Error('The native Nara dialogue is unavailable.');
      const binding={...dialogue.binding,expected_revision:identity.source.revision};
      const actRequest:import('../nara/nativeExpressiveAct').NativeExpressiveActRequest=r.operation==='act_restore'
        ?{operation:'restore',binding,act_ref:r.act_ref,expected_revision:r.expected_revision}
        :r.operation==='act_focus'?{operation:'focus',binding,answer_block_id:r.answer_block_id,target_ref:r.target_ref}
        :r.operation==='act_status'?{operation:'status',binding}:{operation:'inspect',binding,answer_block_id:r.answer_block_id};
      requireCurrent();
      const reply=await kernelOp(transport,{op:'nara_expressive_act',project,request:actRequest});
      if(reply.error||reply.outcome?.result!=='nara_expressive_act')throw Error(reply.error??'The native expressive act owner did not answer.');
      requireEpoch();
      if(r.operation==='act_inspect'||r.operation==='act_status')requireCurrent();
      return reply.outcome.data;
    }
    if(r.operation==='epii_inspect'||r.operation==='epii_accept'){
      if(!dialogue)throw Error('The native Epii inquiry session is unavailable.');
      if(r.operation==='epii_accept')await currentTurnBasis(transport,dialogue,identity,expression.expression_ref);requireCurrent();
      const result=await nativeEpii(transport,project,{operation:r.operation==='epii_inspect'?'inspect':'accept',
        binding:{...dialogue.binding,expected_revision:identity.source.revision},answer_block_id:r.answer_block_id,
        ...(r.operation==='epii_accept'?{focus_ref:r.focus_ref}:{})} as import('../nara/epiiTypes').NativeEpiiRequest);
      requireEpoch();
      // Accept advances the actual native revision. The frame adopts that
      // exact returned document through its existing nativeWorkspace path.
      if(r.operation==='epii_inspect')requireCurrent();
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
    if(r.operation==='return_expression'){
      const held=review;
      if(!held||held.ref!==r.review_ref||held.selection!==identity.selection_ref||held.expressionRevision!==expression.revision
        ||held.answer.dialogue.key!==dialogue?.key)throw Error('Review the exact completed native answer before keeping it in this Expression.');
      const basis=await currentTurnBasis(transport,held.answer.dialogue,identity,expression.expression_ref);requireCurrent();
      const input=JSON.parse(nativeTurnText(held.answer.question,basis,r.role)) as Record<string,unknown>;
      const receipt=await keepNativeAnswerInExpression(transport,held.answer,input,requireCurrent);
      // This explicit commit advances the native document. Do not compare it
      // with the precommit revision, resend it, or adopt into a new selection.
      requireEpoch();
      if(currentIdentity()?.selection_ref!==identity.selection_ref||owner.project().trim()!==project
        ||owner.expression()?.expression_ref!==expression.expression_ref)throw Error('The native answer was kept; reopen its personal Expression to read the acknowledged revision.');
      review=null;
      return {schema:'oi.nara-instrument-return/v1',review_ref:held.ref,expression:receipt};
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
    if (r.operation === 'send' || r.operation === 'epii_delegate') {
      dialogue ??= await acquireNativeDialogue(transport, project, identity, expression.expression_ref, r.role); requireCurrent();
      const basis = await currentTurnBasis(transport, dialogue, identity, expression.expression_ref); requireCurrent();
      if (basis.document.revision !== expression.revision) throw new Error('The selected centre or relation changed before this turn. Refresh and review it.');
      let turnText=nativeTurnText(r.question,basis,r.role);
      if(r.operation==='epii_delegate'){
        const prepared=await nativeEpii(transport,project,{operation:'delegate',binding:{...dialogue.binding,expected_revision:identity.source.revision},brief:r.question});requireCurrent();
        if(prepared.schema!=='oi.nara-epii-delegation/v1'||prepared.agent_session_ref!==dialogue.provisioning.agent_session)throw Error('Epii preparation returned a different native session.');
        turnText=prepared.text;
      }
      try {
        await submitNativeTurn(transport, dialogue, turnText, requireCurrent);
      } catch (failure) {
        if (interrupted[r.role] !== turnGeneration && submissionUncertain(dialogue)) {
          // A lost admission acknowledgement can still leave a native turn in
          // flight. Preserve that uncertainty while requesting cancellation.
          try {
            await encounter(transport, project, {action: 'cancel', agent_session: dialogue.provisioning.agent_session,
              reason: 'The person stopped a turn whose native admission remains uncertain'});
          } catch (cancellation) {
            throw new Error(`${String(failure)} Cancellation was not acknowledged: ${String(cancellation)}`);
          }
        }
        throw failure;
      }
      if (interrupted[r.role] !== turnGeneration) {
        // Prompt admission may have overlapped Stop. Cancel again only after
        // the submitted operation returns so a late admission cannot escape it.
        await encounter(transport, project, {action: 'cancel', agent_session: dialogue.provisioning.agent_session,
          reason: 'The person stopped this turn while native submission was pending'});
      }
      requireCurrent();
    } else if (r.operation === 'reconnect') {
      if (!dialogue?.provisioning.provider) throw new Error('No recorded native provider is available to reconnect.');
      await encounter(transport, project, {action: 'reconnect', agent_session: dialogue.provisioning.agent_session,
        space: dialogue.provisioning.space, provider: dialogue.provisioning.provider}); requireCurrent();
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
      const changes = r.operation !== 'return_expression_list' && r.operation !== 'return_expression_read' && r.operation !== 'act_status' && r.operation !== 'current_read' && r.operation !== 'act_inspect' && r.operation !== 'epii_inspect' && r.operation !== 'coordinate' && r.operation !== 'source' && r.operation !== 'read' && r.operation !== 'interrupt' && r.operation !== 'release_identity'
        && !(r.operation === 'voice' && (r.request.operation === 'close' || r.request.operation === 'read'))
        && !(r.operation === 'm3' && r.request.operation === 'read')
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
