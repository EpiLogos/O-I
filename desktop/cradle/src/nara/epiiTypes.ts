/** Native Epii review wire. Authority remains the completed AIKit turn and
 * the native Expression compare-and-swap, never this frame's displayed copy. */
import type {ExpressionDocument} from '../expression/types';
import type {NativeDialogueRequest} from './dialogueTypes';
export type NativeEpiiRequest =
 | {operation:'delegate';binding:NativeDialogueRequest;brief:string}
 | {operation:'inspect';binding:NativeDialogueRequest;answer_block_id:number}
 | {operation:'accept';binding:NativeDialogueRequest;answer_block_id:number;focus_ref:string};
export interface EpiiFocusTarget {ref:string;label:string;revision:string;revision_basis?:string;change:unknown}
export interface EpiiFactoryCommissionProposal {proposal_ref:string;discrepancy:string;diagnosis_refs:string[];proposed_owner_ref:'factory'}
export interface EpiiEnrichment {
 schema:'ql.epii-enrichment/v1';enrichment_ref:string;delegation_ref:string;basis_context_ref:string;
 basis_expression_revision:string;coordinate_refs:string[];source_refs:string[];method_refs:string[];evidence_refs:string[];
 standing:string;synthesis:string;proposed_focus_refs:string[];proposed_scene_change_refs:string[];
 proposed_profile_variant_ref:string|null;proposed_expressive_act_refs:string[];proposed_native_action_refs:string[];
 continuing_questions:string[];factory_commission_proposal:EpiiFactoryCommissionProposal|null;returned_at_unix_ms:number;
}
export interface NativeEpiiDelegation {schema:'oi.nara-epii-delegation/v1';agent_session_ref:string;text:string;delegation:unknown;origin_context:unknown;focus_targets:EpiiFocusTarget[];submitted:false}
export interface NativeEpiiReview {schema:'oi.nara-epii-review/v1';enrichment:EpiiEnrichment;provenance:unknown;apply_allowed:boolean;reason:string|null;focus_targets:EpiiFocusTarget[];applied:false;unsupported_proposals_standing:string}
export interface NativeEpiiAccepted {schema:'oi.nara-epii-accepted/v1';document:ExpressionDocument;provenance:unknown;applied:true}
export type NativeEpiiResult=NativeEpiiDelegation|NativeEpiiReview|NativeEpiiAccepted;
