/** Nara's bounded instrument channel inside the existing Expressions app.
 * The parent owns native transport. Personal values are transient readings,
 * never part of an exported Journey or Expression document. */
import type {IdentityReading, IdentitySource, NaraIdentityRequest, NaraIdentityResult} from './identity/types';

export const NARA_INSTRUMENT_CHANNEL = 'nara-instrument';
type DialogueRole = 'nara' | 'epii';
/** Deliberately bounded native read projections. The instrument does not
 * import the desktop's transport, component tree or live handles. */
export interface InstrumentExpression {
  expression_ref: string; revision: number; title: string;
  selection: {scene_ref: string; entity_ref: string | null; relation_ref?: string | null};
  entities: Record<string,{entity_ref: string; title: string; subject: {subject_ref: string} | null}>;
}
export interface InstrumentDialogue {
  key: string; role: DialogueRole; project: string;
  provisioning: {agent_session: string; space: string; provider: string; resume_required?: boolean};
}
export interface InstrumentConversation {
  schema?: 'aikit.encounter-view/v1'; agent_session: string;
  blocks: {id: number; kind: string; text: string}[]; more: boolean;
  connection?: {state: string; error?: string | null; native_session_id?: string; resident?: boolean};
}
export interface InstrumentIdentity {source: IdentitySource; reading: IdentityReading}
export interface InstrumentBasis {
  expression_ref: string;
  source: IdentitySource;
}
/** The frame supplies gestures and references, never a constitution, native
 * answer, destination document, or provider/session configuration. */
export type InstrumentVoiceRequest =
  | {operation: 'open'}
  | {operation: 'read' | 'listen' | 'close'; voice_ref: string}
  | {operation: 'transcribe'; voice_ref: string; capture_ref: string; wav_base64: string}
  | {operation: 'speak'; voice_ref: string; answer_block_id: number}
  | {operation: 'complete'; voice_ref: string; response_ref: string};
export interface InstrumentVoiceResult {
  schema: 'oi.nara-voice/v1'; voice_ref: string; capture_ref?: string; response_ref?: string;
  constitution?: unknown; receipt?: unknown; conditions?: unknown;
  transcription?: {text: string; [key: string]: unknown};
  audio?: {audio_base64: string; content_type: string; [key: string]: unknown};
  answer?: {text: string; answer_block_ids: number[]}; closed?: boolean;
}
export interface InstrumentReturnState {
  schema: 'oi.nara-instrument-return/v1'; review_ref: string;
  answer?: {text: string; question: string; block_ids: number[]; original_basis: Record<string, unknown>};
  flows?: {ref: string; name: string}[];
  day?: {source_ref: string; document_id: string; revision: string; civil_date: string; fields: {id: string; label?: string}[]} | null;
  unavailable?: {flows?: string; day?: string};
  flow?: {ref: string; revision: string; title: string; entries: number};
  retained?: {ref: string; revision: string; entry_id: string; already: boolean};
  proposal?: {return_ref: string; revision: string; status: string; included: boolean};
}
export type NaraInstrumentRequest =
  | {operation: 'identity'; request: NaraIdentityRequest}
  | {operation: 'select_identity'; source: IdentitySource; input_revision: string}
  | {operation: 'release_identity'}
  | {operation: 'read'; basis: InstrumentBasis; role: DialogueRole; before?: number}
  | {operation: 'send'; basis: InstrumentBasis; role: DialogueRole; question: string}
  | {operation: 'reconnect' | 'interrupt'; basis: InstrumentBasis; role: DialogueRole}
  | {operation: 'return_inspect'; basis: InstrumentBasis; role: DialogueRole; answer_block_id: number}
  | {operation: 'return_flow_read'; basis: InstrumentBasis; role: DialogueRole; review_ref: string; flow_ref: string}
  | {operation: 'return_flow'; basis: InstrumentBasis; role: DialogueRole; review_ref: string; flow_ref: string; expected_revision: string}
  | {operation: 'return_day'; basis: InstrumentBasis; role: DialogueRole; review_ref: string; field_id: string}
  | {operation: 'voice'; basis: InstrumentBasis; role: 'nara'; request: InstrumentVoiceRequest};

export interface NaraInstrumentState {
  schema: 'oi.nara-instrument-state/v1';
  identity: InstrumentIdentity | null;
  expression: InstrumentExpression | null;
  dialogue: InstrumentDialogue | null;
  conversation: InstrumentConversation | null;
}
export type NaraInstrumentReply = NaraIdentityResult | NaraInstrumentState | InstrumentReturnState | InstrumentVoiceResult;
