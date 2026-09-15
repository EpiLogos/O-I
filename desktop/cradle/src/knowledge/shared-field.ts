import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
import {createParticipant} from "../../../../shared-field/index.mjs";
import {createSharedField} from "../../../../shared-field/social.mjs";
import {createExploreEntry} from "../../../../shared-field/explore.mjs";
import {projectionStorageKey} from "../../../../shared-field/spacetimedb.mjs";

/** The hosted Shared Field through the kernel's `shared_field` op (Lane C
 * step 5, cell S→S0 · aperture mode). The renderer holds no target, no
 * token and no store: every reading is the O:I-owned client's own
 * envelope, pulled per call. Absence arrives as an explicit
 * `{state:"unavailable"}` reading, never as a throw. */
export type SharedFieldRequest=Record<string,unknown>&{kind:"status"|"snapshot"|"read"|"publish"|"participant"|"admit"|"contact"|"watch"};
export type SharedFieldTarget={name:string;uri:string;database:string};
export type SharedFieldUnavailable={state:"unavailable";owner_operation:string;detail:string};
export type SharedFieldStatus={schema:"oi.shared-field.status/v1";bound:true;target:SharedFieldTarget}|{schema:"oi.shared-field.status/v1";bound:false;reason:string}|SharedFieldUnavailable;
export interface HostedProjection {projection_ref:string;projection_revision:number;state:string;subject:{kind:string;ref:string};source:{system:string;ref?:string;revision:string};publisher_participant_ref:string;published_at:string;[key:string]:unknown}
export interface HostedEntry {ref:string;kind:string;world_ref:string;label:string;summary?:string;revision?:string;aliases:string[];projection_ref?:string;meta?:Record<string,unknown>;[key:string]:unknown}
export interface HostedRelationError {field_ref:string|null;relation_ref:string|null;from:string|null;to:string|null;detail:string}
export interface HostedRelation {from:string;to:string;relation:string;origin:string;[key:string]:unknown}
export interface HostedField {field_ref:string;kind:string;visibility:string;title?:string;[key:string]:unknown}
export interface HostedParticipant {participant_ref:string;field_ref:string;identity:{kind:string;ref:string};presentation?:{chosen_name?:string;world_ref?:string};[key:string]:unknown}
export interface HostedAuthority {field_ref:string;participant_ref:string;role:string;revoked:boolean}
export interface HostedWatch {watch_ref:string;field_ref:string;target_kind:string;target_ref:string;state:string;watcher_participant_ref?:string}
/** The caller-visible field (`oi.shared-field.snapshot/v1`), as the client reads it: hosted contracts verbatim plus the caller's own private views. */
export interface SharedFieldSnapshot {schema:"oi.shared-field.snapshot/v1";target:SharedFieldTarget;transport_identity:string;status:{healthy?:boolean;transport?:{state?:string};[key:string]:unknown};fields:HostedField[];participants:HostedParticipant[];projections:HostedProjection[];entries:HostedEntry[];relations:HostedRelation[];relation_errors?:HostedRelationError[];contributions:unknown[];my_authority:HostedAuthority[];my_contribution_receipts:unknown[];my_watches:HostedWatch[];my_contacts:unknown[];counts:{fields:number;participants:number;projections:number;entries:number;relations:number};entry_fields:Record<string,string>}
/** `watch` result (`oi.shared-field.watch-result/v1`): the caller's own Watch row as the field echoed it. */
export interface SharedFieldWatchResult {schema:"oi.shared-field.watch-result/v1";watch_ref:string;field_ref:string;target:{kind:string;ref:string};state:string;watcher_participant_ref:string}
/** One hosted ref as the client reads it (`oi.shared-field.reading/v1`). */
export type SharedFieldReading=
  |{schema:"oi.shared-field.reading/v1";ref:string;state:"absent";target:SharedFieldTarget}
  |{schema:"oi.shared-field.reading/v1";ref:string;state:"hosted";target:SharedFieldTarget;field_ref:string|null;entry:HostedEntry;projections:HostedProjection[];relations:HostedRelation[];relation_errors?:HostedRelationError[];contributions:unknown[];neighbourhood:unknown;my_authority:HostedAuthority[];my_watches:HostedWatch[];status:unknown}
  |SharedFieldUnavailable;
/** The hosted publication result (`oi.shared-field.hosted-result/v1`),
 * shown verbatim: the hosted Projection row, the target, and the transport
 * identity — a SpaceTimeDB connection identity, never a human. */
export interface SharedFieldHostedResult {schema:"oi.shared-field.hosted-result/v1";target:SharedFieldTarget;transport_identity:string;hosted_projection_row:{projectionKey:string;rowId:string;projectionRef:string;projectionRevision:number;sourceRevision:string;state:string;publisherParticipantRef:string};entries:string[];relations:string[];status:unknown}

export async function sharedField<T=unknown>(transport:KernelTransportStatus,request:SharedFieldRequest):Promise<T> {
  const response=await kernelOp(transport,{op:"shared_field",request});
  if(response.error||response.outcome?.result!=="shared_field_reading")throw new Error(response.error??"The Shared Field client returned no reading");
  return response.outcome.data as T;
}

export const isUnavailable=(reading:unknown):reading is SharedFieldUnavailable=>!!reading&&typeof reading==="object"&&(reading as {state?:string}).state==="unavailable";

/** A stable, readable slug of a source ref for the desktop's own field and
 * world refs — derived, never minted from a counter. */
export function slug(value:string):string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}

/** Build the hosted reducer arguments (the `hostedPublicationArgs` shape the
 * client's `publish` expects) from a composed `oi.projection/v1` envelope:
 * the field `oi:field:desktop:<slug>` (kind explore) through
 * `createSharedField`, the publisher as a human Participant through
 * `createParticipant`, the projection verbatim, and one Explore entry (kind
 * `central.document`, ref = the subject ref, world `world:desktop:<slug>`)
 * through `createExploreEntry`. Owner contracts validate every object; the
 * desktop re-implements none of them. */
export function hostedPublicationArgs(envelope:Record<string,unknown>&{projection_ref:string;projection_revision:number;state:string},candidate:{sourceRef:string;revision:string;text:string;title:string}) {
  const key=slug(candidate.sourceRef);
  const audience=envelope.audience as {visibility:string};
  const publisher=String(envelope.publisher_participant_ref);
  const provenance=[{kind:"document-source",ref:candidate.sourceRef,source_system:"central",revision:candidate.revision}];
  const field=createSharedField({field_ref:`oi:field:desktop:${key}`,kind:"explore",visibility:audience.visibility,title:candidate.title,provenance});
  const participant=createParticipant({participant_ref:publisher,field_ref:field.field_ref,identity:{kind:"human",ref:publisher},presentation:{chosen_name:publisher},provenance:{source_system:"central",source_revision:candidate.revision,source_ref:candidate.sourceRef}});
  // The projection link rides in `meta.projection_ref`, the shape the
  // owner's Central wiki projection uses: the hosted module's explore_entry
  // view gates a TOP-LEVEL `projection_ref` on the projection naming the
  // entry ref itself (projection_ref or representation.ref), which a
  // document projection does not — such an entry would never be visible.
  const entry=createExploreEntry({ref:candidate.sourceRef,kind:"central.document",world_ref:`world:desktop:${key}`,label:candidate.title,summary:candidate.text,revision:candidate.revision,aliases:[envelope.projection_ref],provenance,locators:[{surface:"web",locator:`/explore.html?ref=${encodeURIComponent(candidate.sourceRef)}`}],meta:{projection_ref:envelope.projection_ref,standing:"projection"}});
  const source=envelope.source as {revision:string};
  return {
    putSharedField:{fieldRef:field.field_ref,kind:field.kind,visibility:field.visibility,contractJson:JSON.stringify(field)},
    putParticipant:{participantRef:participant.participant_ref,fieldRef:participant.field_ref,identityKind:participant.identity.kind,identityRef:participant.identity.ref,sourceSystem:participant.provenance.source_system,sourceRevision:participant.provenance.source_revision,contractJson:JSON.stringify(participant)},
    putProjection:{projectionKey:projectionStorageKey(envelope.projection_ref,envelope.projection_revision),fieldRef:field.field_ref,projectionRef:envelope.projection_ref,projectionRevision:envelope.projection_revision,sourceRevision:source.revision,publisherParticipantRef:publisher,state:envelope.state,contractJson:JSON.stringify(envelope)},
    putExploreEntries:[{semanticRef:entry.ref,fieldRef:field.field_ref,worldRef:entry.world_ref,kind:entry.kind,label:entry.label,revision:entry.revision??"",entryJson:JSON.stringify(entry)}],
    putExploreRelations:[],
  };
}
