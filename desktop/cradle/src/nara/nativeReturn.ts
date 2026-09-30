/** Explicit retention of a native answer. Central owns the document and CAS;
 * AIKit owns the original transcript. No current UI selection rewrites its basis. */
import {encounter, type EncounterReading} from '../encounter/client';
import type {KernelTransportStatus} from '../kernel/types';
import {appendEntry, embedDocument, parseInstance, textToHtml, type QlDocParticipant} from '../flow/instance';
import {readFlowInstance, writeFlowInstance, type FlowInstance} from '../flow/instances';
import {dayRead, type DayReading} from '../day/client';
import {receiving, type DocumentReading, type ReceivingPage, type ReceivingRequest, type ReturnReading} from '../receiving/client';
import type {NativeDialogue} from './nativeDialogue';
import {nativeTextRuns} from './nativeTranscript';
import {nativeEpii} from './nativeEpii';
import type {NativeEpiiReview} from './epiiTypes';

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The native answer has no complete retained context.');
  return value as ObjectValue;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('The native answer is missing a source identity.');
  return value;
}
export interface NativeAnswer {
  dialogue: NativeDialogue;
  blockId: number;
  answerBlockIds: number[];
  questionBlockId: number;
  questionBlockIds: number[];
  answer: string;
  question: string;
  /** Set only from the original native inquiry; interpretation comes from its native review owner. */
  structuredEpii?: boolean;
  epii?: Pick<NativeEpiiReview, 'enrichment' | 'provenance'>;
  /** Exact submitted basis, deliberately excludes the full private identity matrix. */
  basis: {context: ObjectValue; selected: ObjectValue; identity_source: ObjectValue;
    input_revision: string; expression: ObjectValue};
}
export function nativeAnswer(dialogue: NativeDialogue, reading: EncounterReading, blockId: number): NativeAnswer {
  if (reading.agent_session !== dialogue.provisioning.agent_session) throw new Error('The selected answer belongs to another native session.');
  if (!Number.isSafeInteger(blockId) || blockId < 0) throw new Error('The native answer has no valid block identity.');
  if (reading.blocks.some((b, i, blocks) => !Number.isSafeInteger(b.id) || b.id < 0 || (i > 0 && b.id <= blocks[i - 1].id))) throw new Error('The native transcript order is ambiguous.');
  const blocks = nativeTextRuns(reading.blocks);
  const index = blocks.findIndex(b => b.blockIds.includes(blockId) && b.kind === 'assistant');
  if (index < 0 || !blocks[index].text.trim()) throw new Error('Select a returned assistant answer.');
  const prompt = blocks.slice(0, index).reverse().find(b => b.kind === 'user');
  if (!prompt) throw new Error('Load the earlier question before retaining this answer; its original basis is required.');
  let input: ObjectValue;
  try { input = object(JSON.parse(prompt.text)); } catch { throw new Error('This answer has no recorded Nara identity and Expression basis.'); }
  if (input.schema !== 'oi.nara-dialogue-input/v1' || input.role !== dialogue.role) throw new Error('This answer does not belong to the selected Nara conversation.');
  const context = object(input.context), identity = object(input.identity), source = object(identity.source), expression = object(input.expression);
  const binding = dialogue.binding;
  if (!binding || context.subject_ref !== binding.person_ref || context.nara_ref !== binding.nara_ref
    || source.source_ref !== binding.source_ref || expression.ref !== binding.expression_ref
    || input.role !== binding.role) throw new Error('The recorded question does not match the native session’s bound person and Expression.');
  const identityDisclosed = Array.isArray(context.disclosed) && context.disclosed.some((entry: unknown) => {
    const disclosure = object(entry);return disclosure.ref_id === source.source_ref && disclosure.revision === source.revision
      && disclosure.disclosure === 'personal-consent';
  });
  const profile = expression.profile ? object(expression.profile) : {ref: source.source_ref, revision: source.revision};
  if (context.agent_session_ref !== reading.agent_session || !identityDisclosed
    || context.profile_ref !== profile.ref || context.profile_revision !== profile.revision || context.expression_ref !== expression.ref
    || context.expression_revision !== String(expression.revision)) throw new Error('The recorded question has conflicting session, profile or Expression references.');
  // EncounterStore projects HostEvent::TurnEnded as completed/cancelled/error.
  // A later idle connection says nothing about this answer's original turn.
  // Do not cross either a terminal marker or a new user turn to borrow success.
  const terminalKinds = new Set(['completed', 'cancelled', 'error']);
  const priorBoundary = blocks.slice(0, index).reverse().find(block => block.kind === 'user' || terminalKinds.has(block.kind));
  if (priorBoundary?.id !== prompt.id) throw new Error('This answer has no unambiguous original user turn.');
  const terminal = blocks.slice(index + 1).find(block => block.kind === 'user' || terminalKinds.has(block.kind));
  if (!terminal || terminal.kind !== 'completed') throw new Error('The selected answer’s own native turn did not complete successfully. Interrupted, failed and unfinished answers cannot be retained.');
  text(context.subject_ref); text(context.nara_ref); text(source.source_ref); text(source.revision); text(expression.ref);
  const result: NativeAnswer = {dialogue, blockId: blocks[index].id, answerBlockIds: blocks[index].blockIds,
    questionBlockId: prompt.id, questionBlockIds: prompt.blockIds, answer: blocks[index].text,
    question: text(input.question), basis: {context, selected: object(input.selected), identity_source: source,
      input_revision: text(identity.input_revision), expression}};
  if (dialogue.role === 'epii' && input.epii_delegation) result.structuredEpii = true;
  if (new TextEncoder().encode(JSON.stringify(result)).length > 256 * 1024) throw new Error('This answer and its basis exceed the bounded retention size.');
  return result;
}
async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function answerId(answer: NativeAnswer): Promise<string> {
  return `nara-answer-${await digest(JSON.stringify([answer.dialogue.project, answer.dialogue.provisioning.agent_session, answer.blockId]))}`;
}
/** Re-read the exact owner page and refuse partial/currently streaming answers. */
export async function readNativeAnswer(transport: KernelTransportStatus, dialogue: NativeDialogue, blockId: number): Promise<NativeAnswer> {
  let before: number | undefined, blocks: EncounterReading['blocks'] = [];
  // AIKit's native view pages are sixteen blocks. A tool-rich answer may need
  // earlier pages to recover the actual submitted identity, never today's UI.
  // Start at the latest page so the selected answer's following terminal marker
  // is included. `before: blockId + 1` would hide the only completion evidence.
  for (let page = 0; page < 32; page++) {
    const reading = await encounter<EncounterReading>(transport, dialogue.project,
      {action: 'view', agent_session: dialogue.provisioning.agent_session, before});
    if (reading.schema !== 'aikit.encounter-view/v1') throw new Error('The owner did not return a native transcript view.');
    if (!reading.connection || reading.connection.state !== 'Resident' || reading.connection.error) throw new Error('Wait for the native conversation to be connected and idle before retaining this answer.');
    if (reading.agent_session !== dialogue.provisioning.agent_session) throw new Error('The native owner returned another session.');
    blocks = [...reading.blocks, ...blocks];
    const selected = blocks.findIndex(block => block.id === blockId && block.kind === 'assistant');
    if (selected >= 0) {
      let promptIndex = selected - 1;
      while (promptIndex >= 0 && blocks[promptIndex].kind !== 'user') promptIndex--;
      if (promptIndex >= 0) {
        let start = promptIndex;
        while (start > 0 && blocks[start - 1].kind === 'user') start--;
        // A page starting inside a user text run cannot prove its full basis.
        // Load until the preceding boundary or the beginning of native history.
        if (start > 0 || !reading.more) {
          const answer = nativeAnswer(dialogue, {...reading, blocks}, blockId);
          if (answer.structuredEpii) {
            const review = await nativeEpii(transport, dialogue.project,
              {operation:'inspect',binding:dialogue.binding,answer_block_id:answer.blockId});
            if (review.schema !== 'oi.nara-epii-review/v1') throw new Error('The native Epii review did not return the selected answer.');
            const provenance = object(review.provenance);
            if (provenance.agent_session_ref !== dialogue.provisioning.agent_session
              || JSON.stringify(provenance.answer_block_ids) !== JSON.stringify(answer.answerBlockIds)
              || JSON.stringify(provenance.question_block_ids) !== JSON.stringify(answer.questionBlockIds)) throw new Error('The native Epii review belongs to another recorded turn.');
            // Current application permission is deliberately not copied: this
            // is attributed retention, not permission to apply a proposal.
            answer.epii = {enrichment:review.enrichment,provenance:review.provenance};
          }
          if (new TextEncoder().encode(JSON.stringify(answer)).length > 256 * 1024) throw new Error('This answer, its reviewed reading and basis exceed the bounded retention size.');
          return answer;
        }
      }
    }
    const next = reading.blocks[0]?.id;
    if (!reading.more || next === undefined || (before !== undefined && next >= before)) break;
    before = next;
  }
  throw new Error('The answer, its original question and its completion were not found within the bounded native history. This answer has not been retained.');
}
export async function verifyNativeAnswer(transport: KernelTransportStatus, answer: NativeAnswer): Promise<void> {
  const fresh = await readNativeAnswer(transport, answer.dialogue, answer.blockId);
  if (JSON.stringify([fresh.answer, fresh.question, fresh.basis, fresh.answerBlockIds, fresh.questionBlockIds, fresh.structuredEpii, fresh.epii]) !== JSON.stringify([answer.answer, answer.question, answer.basis, answer.answerBlockIds, answer.questionBlockIds, answer.structuredEpii, answer.epii])) throw new Error('The native answer, its original basis or its reviewed reading changed. Review the transcript again.');
}
function escaped(value: string): string {return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export function answerHtml(answer: NativeAnswer, destination: 'flow' | 'day'): string {
  return renderAnswerHtml(answer, destination, destination === 'flow');
}
function renderAnswerHtml(answer: NativeAnswer, destination: 'flow' | 'day', curated: boolean): string {
  const name = answer.dialogue.role === 'epii' ? 'Epii' : 'Nara';
  const explanation = destination === 'day'
    ? `Explicitly retained quotation of ${name} by the person. The quoted agent remains the author of the answer; Central records the authenticated submitter of this quotation separately.`
    : `${name} answer, explicitly retained by the person from the native conversation.`;
  const provenance = {schema: 'oi.nara-retained-answer/v1', agent_session_ref: answer.dialogue.provisioning.agent_session,
    project: answer.dialogue.project, role: answer.dialogue.role, answer_block_id: answer.blockId,
    answer_block_ids: answer.answerBlockIds, question_block_id: answer.questionBlockId,
    question_block_ids: answer.questionBlockIds, original_answer_occurred_at: null,
    occurrence_note: 'The native transcript view exposes no occurrence timestamp; retention time is not substituted for it.',
    ...answer.basis};
  const reviewed = curated ? answer.epii : undefined;
  const proposal = reviewed?.enrichment.factory_commission_proposal;
  const content = reviewed
    ? `${textToHtml(reviewed.enrichment.synthesis)}${proposal ? `<h4>Proposed development work</h4>${textToHtml(proposal.discrepancy)}<p>Proposed for Factory review. Retaining this return does not start the work.</p>` : ''}<details><summary>Source Inspect — original Epii answer</summary>${textToHtml(answer.answer)}<pre>${escaped(JSON.stringify(reviewed, null, 2))}</pre></details>`
    : textToHtml(answer.answer);
  return `<p>${escaped(explanation)}</p><p><strong>Question</strong> ${escaped(answer.question)}</p>${content}<details><summary>Original person, Expression and source basis</summary><pre>${escaped(JSON.stringify(provenance, null, 2))}</pre></details>`;
}
function participant(instance: FlowInstance, answer: NativeAnswer): QlDocParticipant {
  const session = answer.dialogue.provisioning.agent_session;
  const declared = instance.doc.meta.participants ?? [];
  const existing = declared.find(p => p.kind === 'agent' && p.ref === session);
  if (existing) return existing;
  // Do not reuse an initial already attributed to another person or agent.
  const occupied = new Set([...declared.map(p => p.initial), ...instance.doc.entries.map(e => e.author)]);
  const preferred = answer.dialogue.role === 'epii' ? 'E' : 'N';
  const initial = [preferred, ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find(value => !occupied.has(value));
  if (!initial) throw new Error('This Flow has no unused participant initial. Choose another Flow.');
  return {initial, name: answer.dialogue.role === 'epii' ? 'Epii' : 'Nara', kind: 'agent', ref: session};
}
export async function composeFlowAnswer(instance: FlowInstance, answer: NativeAnswer): Promise<{html: string; entryId: string; already: boolean}> {
  if (!instance.doc.meta.documentId || !instance.doc.meta.created || !Number.isSafeInteger(instance.doc.meta.revision)
    || instance.doc.meta.revision < 0 || !Array.isArray(instance.doc.entries)
    || new Set(instance.doc.entries.map(entry => entry.id)).size !== instance.doc.entries.length) throw new Error('Choose an existing Flow with an unambiguous document identity and entry history.');
  const declarations = instance.doc.meta.participants ?? [];
  if (new Set(declarations.map(value => value.initial)).size !== declarations.length) throw new Error('This Flow has ambiguous participant initials. Its existing attribution has been preserved.');
  const entryId = await answerId(answer), html = answerHtml(answer, 'flow');
  const existing = instance.doc.entries.find(e => e.id === entryId);
  if (existing) {
    if (existing.html !== html && existing.html !== renderAnswerHtml(answer, 'flow', false)) throw new Error('The retained answer was edited in this Flow. Its authored version is preserved.');
    return {html: instance.html, entryId, already: true};
  }
  const appended = appendEntry(instance.html, answer.answer, {participant: participant(instance, answer)});
  const doc = parseInstance(appended.html), entry = doc.entries.find(e => e.id === appended.entry.id)!;
  entry.id = entryId; entry.html = html;
  return {html: embedDocument(instance.html, doc), entryId, already: false};
}
const busy = new Set<string>();
const uncertainFlow = new Set<string>();
export async function retainAnswerInFlow(transport: KernelTransportStatus, basis: FlowInstance, answer: NativeAnswer): Promise<{revision: string; entryId: string; already: boolean}> {
  const id = await answerId(answer), key = `${basis.location.ref}:${id}`;
  if (busy.has(key)) throw new Error('This answer is already being retained.');
  busy.add(key);
  try {
    await verifyNativeAnswer(transport, answer);
    const current = await readFlowInstance(transport, basis.location);
    if (current.doc.meta.documentId !== basis.doc.meta.documentId) throw new Error('The selected Flow identity changed.');
    const composed = await composeFlowAnswer(current, answer);
    if (composed.already) {uncertainFlow.delete(key); return {revision: current.revision, entryId: id, already: true};}
    if (uncertainFlow.has(key)) throw new Error('The earlier write is still unconfirmed. The current document has no retained entry; no automatic resend was made.');
    if (current.revision !== basis.revision) throw new Error('This Flow changed after your review. Read its current revision before retaining the answer.');
    uncertainFlow.add(key);
    const written = await writeFlowInstance(transport, current.location, current.revision, composed.html);
    if (written.outcome === 'conflict') {uncertainFlow.delete(key); throw new Error('The Flow changed during retention. Review its current revision; your answer is still in the native conversation.');}
    const saved = await readFlowInstance(transport, current.location);
    if (!saved.doc.entries.some(entry => entry.id === id && entry.html === answerHtml(answer, 'flow'))) throw new Error('Central did not confirm the exact retained answer. Check the native document before retrying.');
    uncertainFlow.delete(key);
    return {revision: saved.revision, entryId: id, already: false};
  } finally {busy.delete(key);}
}
export interface NativeDayTarget {day: DayReading; document: DocumentReading; fields: {id: string; label?: string}[]}
export async function readDayTarget(transport: KernelTransportStatus): Promise<NativeDayTarget> {
  const day = await dayRead(transport);
  if (day.document_state !== 'ready' || !day.document || day.document.document.kind !== 'day') throw new Error('Today has no native Day document ready for reviewed contributions. Open Today to review its source first.');
  const document = await receiving<DocumentReading>(transport, null, {kind: 'document', source_ref: day.source.ref, document_id: day.document.document_id});
  if (document.source.ref !== day.source.ref || document.document_id !== day.document.document_id || document.document.kind !== 'day' || document.document.lifecycle !== 'open') throw new Error('The native Day is closed or its source identity changed.');
  const fields = (document.document as typeof document.document & {fields?: {id: string; label?: string}[]}).fields;
  if (!Array.isArray(fields) || !fields.length || fields.some(field => !field || typeof field.id !== 'string' || !field.id.trim()) || new Set(fields.map(field => field.id)).size !== fields.length) throw new Error('This Day discloses no unambiguous contribution fields. Its structure has not been changed.');
  return {day, document, fields};
}
type Submission = Extract<ReceivingRequest, {kind: 'submit'}>;
const daySubmissions = new Map<string, Submission>();
function validateDayQuotation(result: ReturnReading, target: NativeDayTarget, fieldId: string, id: string, html: string): ReturnReading {
  if (result.schema !== 'central.receiving-reading/v1' || result.record.source_ref !== target.document.source.ref
    || result.record.document_id !== target.document.document_id || result.record.proposal?.contribution_id !== id
    || result.record.proposal?.operation !== 'field.append' || result.record.proposal?.field_id !== fieldId
    || result.record.proposal?.html !== html || result.source_changed_by_arrival_or_review !== false) throw new Error('This answer already has a different retained quotation or target field in the Day. Review its existing item in Inbox.');
  return result;
}
/** Native receipt discovery survives component remount and app restart. A
 * producer key cannot be reconstructed with a new timestamp after acknowledgement loss. */
async function existingDayQuotation(transport: KernelTransportStatus, target: NativeDayTarget, fieldId: string, id: string, html: string): Promise<ReturnReading | null> {
  let after = 0, inspected = 0;
  for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
    const page = await receiving<ReceivingPage>(transport, null, {kind: 'list', after, limit: 200});
    if (page.schema !== 'central.receiving-page/v1' || !Array.isArray(page.returns)) throw new Error('Central did not return its native receiving records.');
    for (const row of page.returns) {
      if (row.source_ref !== target.document.source.ref || row.document_id !== target.document.document_id) continue;
      if (++inspected > 200) throw new Error('This Day has too many receiving records to establish duplicate safety in one operation. Review its Inbox first.');
      const receipt = await receiving<ReturnReading>(transport, null, {kind: 'read', return_ref: row.return_ref});
      if (receipt.record?.proposal?.contribution_id === id) return validateDayQuotation(receipt, target, fieldId, id, html);
    }
    if (!page.more) return null;
    if (!Number.isSafeInteger(page.next_after) || page.next_after! <= after) throw new Error('Central receiving pagination did not advance.');
    after = page.next_after!;
  }
  throw new Error('The native receiving history exceeds this bounded duplicate check. No quotation was submitted.');
}
export async function proposeAnswerForDay(transport: KernelTransportStatus, target: NativeDayTarget, fieldId: string, answer: NativeAnswer): Promise<ReturnReading> {
  if (!target.fields.some(field => field.id === fieldId)) throw new Error('Choose a field disclosed by this native Day.');
  const id = await answerId(answer), key = `${target.document.source.ref}:${id}`;
  if (busy.has(key)) throw new Error('This quotation is already being submitted.');
  busy.add(key);
  try {
    await verifyNativeAnswer(transport, answer);
    const html = `${answerHtml(answer, 'day')}<p>Retained for Day ${escaped(target.day.day_ref)}.</p>`;
    if (new TextEncoder().encode(html).length > 256 * 1024) throw new Error('This quotation exceeds the native Day contribution size. Keep it in a Flow instead.');
    const retained = await existingDayQuotation(transport, target, fieldId, id, html);
    if (retained) return retained;
    const existing = daySubmissions.get(key);
    if (existing && existing.proposal.field_id !== fieldId) throw new Error('This answer already targets another field in this Day. Review the pending quotation in Inbox.');
    const request: Submission = existing ?? {kind: 'submit', producer_key: `${id}:${await digest(target.document.source.ref)}`,
      source_ref: target.document.source.ref, document_id: target.document.document_id,
      expected_source_revision: target.document.revision.revision, occurred_at_unix_seconds: Math.floor(Date.now() / 1000),
      proposal: {operation: 'field.append', field_id: fieldId, contribution_id: id, html}};
    // Keep exact request bytes on an uncertain retry: Central's producer key is idempotent.
    daySubmissions.set(key, request);
    const result = await receiving<ReturnReading>(transport, null, request);
    return validateDayQuotation(result, target, fieldId, id, html);
  } finally {busy.delete(key);}
}
