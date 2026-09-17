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
 * JSON shapes here mirror the Rust serde contract exactly (tag
 * `operation`, snake_case, unknown fields refused kernel-side).
 */
import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
import type {Change,ReadingRef} from "./types";

export type WorldOrigin="graph"|"wiki"|"constellation"|"expression"|"agent"|"page";
export type PortalPlacement="preview"|"overlay"|"beside"|"full"|"detached";
export type ActState="running"|"held";

export interface WorldSelection {subject_ref:string;kind:string;native_owner:string;revision?:string;origin:WorldOrigin;expression_ref?:string;entity_ref?:string;activity_ref?:string}
export interface WorldPortal {portal_ref:string;target_ref:string;surface_id:string;surface_kind:string;placement:PortalPlacement;title:string;opened_by:string;activity_ref?:string}
export interface WorldAct {act_ref:string;expression_ref:string;summary:string;actor:string;activity_ref?:string;state:ActState;basis_revision:number}
export interface WholeMember {subject:ReadingRef;native_owner:string}
export interface WholeRelation {relation:ReadingRef;from_ref:string;to_ref:string}

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
 | {operation:"whole_rebase";whole_ref:string;expected_basis_revision:string;basis:ReadingRef;members:WholeMember[];relations:WholeRelation[];actor:string;activity_ref?:string};

/** Apply one world operation through the kernel seam. The kernel returns
 * typed refusals inside `outcome.data` (revision conflicts, `unbound`,
 * `unavailable_surface`, `whole_basis_conflict`, `whole_unchanged`); a
 * transport-level failure is the bridge's `error`. */
export async function worldOp(transport:KernelTransportStatus,request:WorldRequest){
 const r=await kernelOp(transport,{op:"expression_world",request});
 if(r.error||!r.outcome||r.outcome.result!=="expression_world")throw new Error(r.error??"Expression world unavailable");
 return r.outcome.data;
}
