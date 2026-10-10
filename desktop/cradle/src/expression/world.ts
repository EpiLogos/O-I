/**
 * ES1/ES4 Expression-world operations — the typed renderer face of
 * `kernel/src/expression_world.rs` (`KernelOp::ExpressionWorld`, wire tag
 * `{"op":"expression_world","request":{...}}`).
 *
 * One canonical bounded selection state; LIST, TREE, GRAPH, Wiki page and
 * Expression are presentations over the same native refs. Selection is
 * inspection and never invokes an Action; portal placements route through
 * the existing Surface host with the canonical target ref preserved;
 * ExpressiveAct interrupt holds the act; whole rebasing is explicit.
 * `activity_ref` fields are caller-supplied correlation, never authority.
 *
 * The mode-spanning act and reusable material (contract
 * docs/contracts/EXPRESSION-ACT-MATERIAL-V1.md §1, §3, §4) are the `act_*`
 * and `material_list` operations: select/bind, perform/transition, operate,
 * continue/replay. Acts persist in the kernel's act store and replay by
 * timeline position (`act_seek`).
 *
 * JSON shapes here mirror the Rust serde contract exactly (tag
 * `operation`, snake_case, unknown fields refused kernel-side).
 */
import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
import type {Change,ReadingRef,ReuseAssociations,ReuseKind,ReuseRole,ReuseGesture,ExpressionDocument} from "./types";

/** Schema a desktop-socket body carries to route to the world seam. */
export const WORLD_SCHEMA="oi.expression-world/v1";

export type WorldOrigin="graph"|"wiki"|"constellation"|"expression"|"agent"|"page";
export type PortalPlacement="preview"|"overlay"|"beside"|"full"|"detached";
/** Act phase. `running`/`held` are the ES4 cancellable states; an act ends
 * `completed` (with its Return) or `cancelled`. */
export type ActPhase="running"|"held"|"completed"|"cancelled";
/** @deprecated the act's field is `phase`; kept as an alias for readers. */
export type ActState=ActPhase;
export type ActMode="factory"|"expressions"|"techne";
export type PassageKind="edition"|"scene"|"state"|"gesture"|"text"|"operate"|"continue"|"return";

export interface WorldSelection {subject_ref:string;kind:string;native_owner:string;revision?:string;origin:WorldOrigin;expression_ref?:string;entity_ref?:string;activity_ref?:string}
export interface WorldPortal {portal_ref:string;target_ref:string;surface_id:string;surface_kind:string;placement:PortalPlacement;title:string;opened_by:string;activity_ref?:string}
export interface WholeMember {subject:ReadingRef;native_owner:string}
export interface WholeRelation {relation:ReadingRef;from_ref:string;to_ref:string}

/** Cast member of an act: who is present in which role. */
export interface CastMember {role:string;participant_ref:string;profile_ref?:string;character_ref?:string;label?:string}
/** Role binding (contract §3). `character_ref` is a Central file ref of a
 * `kind:"character"` material document (or an open `expression:` ref);
 * `entity_ref` pins the target-Expression entity that presents the role. */
export interface ActBinding {kind:"agent"|"object"|"text"|"value";agent_ref?:string;profile_ref?:string;character_ref?:string;subject_ref?:string;state?:string;label?:string;glyph?:string;text?:string;value?:number;entity_ref?:string;/** exact character revision performed (kernel-recorded; a caller may pin it) */character_revision?:string}
export type ActBindings=Record<string,ActBinding>;
/** The material an act performs: a Central file (`file_ref`) or an open
 * Expression (`expression_ref`), with an exact scene or a named state. */
export interface MaterialSelect {file_ref?:string;expression_ref?:string;revision?:string;scene_ref?:string;state?:string}
export interface ActMaterial {file_ref?:string;expression_ref?:string;revision?:string;scene_ref?:string}
export interface Transition {duration?:number;easing?:string}
export interface EventBasis {family:string;source:string;event_ref:string;occurrence?:string|number}
export type ActMaterialContract='oi.expression-act-material/v2';
/** Native immutable edition handle; position is a passage index, never seconds. */
export interface RetainedPerformanceEdition {schema:'oi.expression-act-performance-edition/v1';index:number;expression_ref:string;revision:number;expanded_document_sha256:string;expanded_bytes:number}
export interface Passage {index:number;kind:PassageKind;/** immutable native edition retained by act_perform; never current writable state */edition?:ExpressionDocument;performance_edition?:RetainedPerformanceEdition;file_ref?:string;/** material addressed as an open Expression */expression_ref?:string;revision?:string;scene_ref?:string;/** the live Expression/Scene performed into */target_ref?:string;target_scene_ref?:string;field?:string;state?:string;role?:string;gesture?:string;bindings?:ActBindings;captions?:Record<string,string>;transition?:Transition;event_basis?:EventBasis;operation?:string;native_ref?:string;text?:string;value?:number;summary?:string;mode:ActMode;at_unix_ms:number;/** later fills of the same text role absorbed in place */coalesced?:number}
export interface Continuation {from:ActMode;to:ActMode;instrument_ref?:string;expression_ref?:string;at:number}
export interface WorldAct {
 act_ref:string;expression_ref:string;summary:string;actor:string;activity_ref?:string;
 phase:ActPhase;basis_revision:number;revision:number;mode:ActMode;
 /** Absent for legacy material-v1; read only from the actual native Act. */
 material_contract?:ActMaterialContract;
 cast:CastMember[];subject_ref?:string;instrument_ref?:string;material?:ActMaterial;
 bindings:ActBindings;selection?:string;position?:number;sequence:Passage[];
 continuations:Continuation[];return_ref?:string;result?:string;
 /** role → target-Expression entity that presents it (kernel-derived). */
 role_entities:Record<string,string>;
 updated_at_unix_ms:number;
 /** archived acts live outside the live budget; readable/replayable by ref */
 archived?:boolean;
}
/** One row of `material_list` (contract §1 Discovery). */
export interface MaterialListing {file_ref:string;revision:string;title:string;kind:ReuseKind;roles:ReuseRole[];states:Record<string,string>;gestures:Record<string,ReuseGesture>;associations:ReuseAssociations;preview_state?:string|null;entry_scene_ref?:string|null;playback:string[];expression_ref:string;location:CentralPathRef}
/** Association filter; each key matches the material's corresponding list. */
export interface MaterialAssociation {workflow_key?:string;task_type?:string;skill_set_ref?:string;skill_ref?:string;event_family?:string}
export interface CentralPathRef {schema:"central.path-ref/v1";ref:string;root:string;path:string}
export interface MaterialListResult {state:"materials";schema:"oi.expression-material-list/v1";register:string;
 /** Owner-disclosed folder per kind — the exact `parent` for `save_as` into the register. */
 folders:Partial<Record<ReuseKind,CentralPathRef>>;materials:MaterialListing[];unreadable:{file_ref?:string;path?:string;error:string}[];truncated:boolean}
/** Central register reusable material is saved in (`<register>/<kind>/<slug>.expression.json`). */
export const MATERIAL_REGISTER="Work/O-I/desktop/cradle/material/expressive-material";

interface ActGuard {expected_act_revision?:number;activity_ref?:string}

export type WorldRequest =
 | {operation:"capabilities"}
 | {operation:"selection_set";origin:WorldOrigin;subject_ref:string;kind:string;native_owner:string;revision?:string;activity_ref?:string;expression_ref?:string}
 | {operation:"selection_read"}
 | {operation:"portal_inspect";target_ref?:string}
 | {operation:"portal_open";portal_ref:string;target_ref:string;surface_kind:string;surface_id:string;placement:PortalPlacement;title:string;actor:string;activity_ref?:string}
 | {operation:"portal_close";portal_ref:string;actor:string}
 | {operation:"portal_redock";portal_ref:string;actor:string}
 | {operation:"act_perform";act_ref:string;expression_ref:string;expected_revision:number;summary:string;actor:string;activity_ref?:string;changes:Change[]}
 | {operation:"act_interrupt";act_ref:string;actor:string;reason?:string}
 | {operation:"act_checkpoint";act_ref:string;checkpoint_ref:string;actor:string}
 | {operation:"act_restore";act_ref:string;checkpoint_ref:string;expected_revision:number;actor:string;activity_ref?:string}
 | {operation:"whole_bind";whole_ref:string;basis:ReadingRef;locus_ref:string;members:WholeMember[];relations:WholeRelation[];expression_ref?:string;actor:string;activity_ref?:string}
 | {operation:"whole_inspect";whole_ref:string}
 | {operation:"whole_rebase";whole_ref:string;expected_basis_revision:string;basis:ReadingRef;members:WholeMember[];relations:WholeRelation[];actor:string;activity_ref?:string}
 /* Mode-spanning act + reusable material (EXPRESSION-ACT-MATERIAL-V1 §4). */
 | {operation:"material_list";kind?:ReuseKind;association?:MaterialAssociation;register?:string}
 | ({operation:"act_open";act_ref:string;expression_ref:string;mode:ActMode;actor:string;summary?:string;cast?:CastMember[];subject_ref?:string;instrument_ref?:string;selection?:string;bindings?:ActBindings}&ActGuard)
 /** Scene change: `material` names a Scene (or an Expression-level state).
  * Object-local state change: `role` + `state` and no Scene — the role's
  * occupant takes that character state's `self` material. */
 | ({operation:"act_select";act_ref:string;actor:string;material?:MaterialSelect;role?:string;state?:string;kind?:"scene"|"state"|"return";bindings?:ActBindings;captions?:Record<string,string>;transition?:Transition;event_basis?:EventBasis;expected_revision?:number;summary?:string}&ActGuard)
 | ({operation:"act_gesture";act_ref:string;actor:string;gesture:string;role?:string;entity_ref?:string;material?:MaterialSelect;transition?:Transition;event_basis?:EventBasis;expected_revision?:number}&ActGuard)
 | ({operation:"act_text";act_ref:string;actor:string;role:string;text?:string;value?:number;field?:"kicker"|"title"|"italic"|"body";event_basis?:EventBasis;expected_revision?:number}&ActGuard)
 | ({operation:"act_operate";act_ref:string;actor:string;operation_kind:string;native_ref:string;mode?:ActMode;summary?:string;event_basis?:EventBasis}&ActGuard)
 | ({operation:"act_continue";act_ref:string;actor:string;to:ActMode;instrument_ref?:string;expression_ref?:string;summary?:string}&ActGuard)
 | ({operation:"act_complete";act_ref:string;actor:string;return_ref?:string;result?:string;result_role?:string;cancelled?:boolean;expected_revision?:number}&ActGuard)
 | ({operation:"act_seek";act_ref:string;actor:string;position:number;accept_drift?:boolean;expected_revision?:number}&ActGuard)
 | ({operation:"act_play";act_ref:string;actor:string;material:MaterialSelect;bindings?:ActBindings;captions?:Record<string,string>;from?:number;expected_revision?:number}&ActGuard)
 | {operation:"act_archive";act_ref:string;actor:string}
 | {operation:"act_inspect";act_ref:string}
 | {operation:"act_retained_inspect";act_ref:string}
 | {operation:"act_retained_edition";act_ref:string;expected_act_revision:number;position:number}
 | {operation:"act_list";mode?:ActMode;expression_ref?:string;phase?:ActPhase};

/** Structured act outcome. Refusals come back as data too:
 * `revision_conflict` (the target Expression moved), `act_revision_conflict`
 * (another writer advanced the act), `material_revision_changed` (Scene or
 * character material drifted; seek takes `accept_drift`), `act_passage_limit`
 * (continue in a successor act). */
export interface ActOutcome {state:string;act?:WorldAct;passage?:Passage;passages?:Passage[];replayed?:{from:number;to:number;incremental:boolean};coalesced?:boolean;[key:string]:unknown}

/** Apply one world operation through the kernel seam. The kernel returns
 * typed refusals inside `outcome.data` (revision conflicts, `unbound`,
 * `unavailable_surface`, `whole_basis_conflict`, `whole_unchanged`); a
 * transport-level failure is the bridge's `error`. */
export async function worldOp(transport:KernelTransportStatus,request:WorldRequest){
 const r=await kernelOp(transport,{op:"expression_world",request});
 if(r.error||!r.outcome||r.outcome.result!=="expression_world")throw new Error(r.error??"Expression world unavailable");
 return r.outcome.data;
}

type Without<T,K extends keyof T>=Omit<T,K>;
type Req<O extends WorldRequest["operation"]>=Without<Extract<WorldRequest,{operation:O}>,"operation">;

/** Anything that can carry one world request: the kernel bridge (desktop
 * renderer) or a hosted-frame relay (`kernel-expression-world`). */
export type WorldCall=(request:WorldRequest)=>Promise<unknown>;
export const viaTransport=(transport:KernelTransportStatus):WorldCall=>request=>worldOp(transport,request);

const call=async <T>(target:KernelTransportStatus|WorldCall,request:WorldRequest):Promise<T>=>
 (typeof target==="function"?await target(request):await worldOp(target,request)) as T;

export const materialList=(t:KernelTransportStatus|WorldCall,input:Req<"material_list">={})=>call<MaterialListResult>(t,{operation:"material_list",...input});
export const actOpen=(t:KernelTransportStatus|WorldCall,input:Req<"act_open">)=>call<ActOutcome>(t,{operation:"act_open",...input});
export const actSelect=(t:KernelTransportStatus|WorldCall,input:Req<"act_select">)=>call<ActOutcome>(t,{operation:"act_select",...input});
export const actGesture=(t:KernelTransportStatus|WorldCall,input:Req<"act_gesture">)=>call<ActOutcome>(t,{operation:"act_gesture",...input});
export const actText=(t:KernelTransportStatus|WorldCall,input:Req<"act_text">)=>call<ActOutcome>(t,{operation:"act_text",...input});
export const actOperate=(t:KernelTransportStatus|WorldCall,input:Req<"act_operate">)=>call<ActOutcome>(t,{operation:"act_operate",...input});
export const actContinue=(t:KernelTransportStatus|WorldCall,input:Req<"act_continue">)=>call<ActOutcome>(t,{operation:"act_continue",...input});
export const actComplete=(t:KernelTransportStatus|WorldCall,input:Req<"act_complete">)=>call<ActOutcome>(t,{operation:"act_complete",...input});
export const actSeek=(t:KernelTransportStatus|WorldCall,input:Req<"act_seek">)=>call<ActOutcome>(t,{operation:"act_seek",...input});
export const actPlay=(t:KernelTransportStatus|WorldCall,input:Req<"act_play">)=>call<ActOutcome>(t,{operation:"act_play",...input});
export const actArchive=(t:KernelTransportStatus|WorldCall,input:Req<"act_archive">)=>call<ActOutcome>(t,{operation:"act_archive",...input});
export const actInspect=(t:KernelTransportStatus|WorldCall,act_ref:string)=>call<ActOutcome>(t,{operation:"act_inspect",act_ref});
export interface RetainedActEdition {state:"act_retained_edition";material_contract:ActMaterialContract;act_ref:string;act_revision:number;position:number;document:ExpressionDocument}
export const actRetainedInspect=(t:KernelTransportStatus|WorldCall,act_ref:string)=>call<ActOutcome>(t,{operation:"act_retained_inspect",act_ref});
export const actRetainedEdition=(t:KernelTransportStatus|WorldCall,input:Req<"act_retained_edition">)=>call<RetainedActEdition>(t,{operation:"act_retained_edition",...input});
/** Act summaries (no sequence; `passages` counts it) — `act_inspect` reads one act whole. */
export type ActSummary=Pick<WorldAct,"act_ref"|"expression_ref"|"summary"|"actor"|"phase"|"mode"|"revision"|"basis_revision"|"cast"|"subject_ref"|"instrument_ref"|"material"|"position"|"return_ref"|"updated_at_unix_ms"|"archived">&{passages:number};
export const actList=(t:KernelTransportStatus|WorldCall,input:Req<"act_list">={})=>call<{state:"acts";acts:ActSummary[];persistent:boolean;store_errors:string[]}>(t,{operation:"act_list",...input});
