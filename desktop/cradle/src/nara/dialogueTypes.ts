/** Native identity/session binding shared by both instrument and host. */
export type DialogueRole = 'nara' | 'epii';
export interface NativeDialogueRequest {
  operation: 'lookup' | 'resolve' | 'context' | 'readiness'; source_ref: string; expected_revision: string;
  person_ref: string; nara_ref: string; expression_ref: string; role: DialogueRole;
}
