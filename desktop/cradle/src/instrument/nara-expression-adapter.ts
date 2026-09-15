import {blankScene,entity} from "@epilogos/oi-design-system/expressions-engine/shell/model.mjs";
import {nativeExport,type NativeConfig} from "@epilogos/oi-design-system/expressions-engine/shell/nativeBridge.mjs";
import type {FocusedInstrumentSnapshot,NaraExpressionPortableCues,NaraExpressionSession} from "./source";

export type NaraExpressionStanding="current"|"stale"|"unavailable";
export interface NaraExpressionProjection {standing:NaraExpressionStanding;session:NaraExpressionSession|null;config:NativeConfig|null;reason:string}
export interface NaraRetainedPresentation {schema:"oi.retained-presentation/v1";eventRef:string;subjectRef:string;profileGeneration:number;personalGeneration:number;entities:Array<{id:string;x:number;y:number;z:number;scale:number;tint:string;tintWeight:number}>}

const SESSION_SCHEMA="ql.nara-expression-session/v1";
const PORTABLE_SCHEMA="ql.nara-expression-portable-cues/v1";
const finite=(value:number)=>Number.isFinite(value);
const generation=(value:number)=>Number.isSafeInteger(value)&&value>=0;
const present=(value:string)=>typeof value==="string"&&value.trim().length>0&&!value.includes("\0");

function validateSession(snapshot:FocusedInstrumentSnapshot,session:NaraExpressionSession){
  if(session.schema!==SESSION_SCHEMA)throw new Error(`Unsupported Nara Expression contract ${session.schema}`);
  if(!generation(session.profile_generation)||!generation(session.personal_reception_generation))throw new Error("Nara Expression generations must be non-negative safe integers");
  if(session.subject_ref!==snapshot.event.subject_ref||session.event_ref!==snapshot.event.event_ref||session.profile_generation!==snapshot.event.profile_generation)
    throw new Error("Nara Expression belongs to another event, subject or profile generation");
  if(session.centres.length!==7)throw new Error("Nara Expression requires exactly seven centres");
  const ordinals=new Set<number>(),loci=new Set<string>();
  for(const centre of session.centres){
    if(!Number.isInteger(centre.ordinal)||centre.ordinal<0||centre.ordinal>6||ordinals.has(centre.ordinal))throw new Error("Nara Expression centre ordinals must be exactly 0..6");
    if(!present(centre.locus_ref)||loci.has(centre.locus_ref)||!present(centre.label)||!present(centre.source.source_ref)||!present(centre.source.revision)||!finite(centre.resonance))throw new Error("Nara Expression contains an invalid centre reading");
    for(const contribution of [centre.m1,centre.m2,centre.m3])if(!present(contribution.basis_ref)||!present(contribution.source_ref)||!finite(contribution.value))throw new Error("Nara Expression contains an invalid owner contribution");
    ordinals.add(centre.ordinal);loci.add(centre.locus_ref);
  }
  if(!present(session.earth_body.locus_ref)||loci.has(session.earth_body.locus_ref)||!present(session.earth_body.source.source_ref)||!present(session.earth_body.source.revision)||!present(session.earth_body.frame_ref))throw new Error("EarthBody must be a distinct source-qualified locus");
  for(const station of session.resonance_stations.station_refs)if(loci.has(station))throw new Error("Cymatic stations must remain distinct from Nara centres");
  if(session.resonance_stations.availability==="unavailable"&&session.resonance_stations.station_refs.length)throw new Error("Unavailable cymatic station disclosure cannot contain station identities");
  if(session.portable.schema!==PORTABLE_SCHEMA||session.portable.subject_ref!==session.subject_ref||session.portable.event_ref!==session.event_ref||session.portable.profile_generation!==session.profile_generation||session.portable.personal_reception_generation!==session.personal_reception_generation)throw new Error("Portable Nara cues do not identify this exact session reading");
  if(session.portable.centre_locus_refs.length!==7||session.portable.centre_locus_refs.some((ref,index)=>ref!==[...session.centres].sort((a,b)=>a.ordinal-b.ordinal)[index].locus_ref)||session.portable.earth_body_locus_ref!==session.earth_body.locus_ref)throw new Error("Portable Nara cues lost or reordered a presentation locus");
}

/** Builds stable native Expression entities from an actual QL-owned reading.
 * The arrangement is presentation only. The retained K8 lease remains the
 * topology/material/audio/clock owner and may replace particle targets. */
export function naraExpressionConfig(session:NaraExpressionSession):NativeConfig{
  const scene=blankScene(`Nara · ${session.subject_ref}`);
  const ordered=[...session.centres].sort((a,b)=>a.ordinal-b.ordinal);
  scene.entities=ordered.map(centre=>{
    const locus=entity(centre.label,String(centre.ordinal+1),{x:0,y:-0.66+centre.ordinal*0.22,z:0});
    locus.id=centre.locus_ref;locus.size={x:0.17,y:0.17};locus.rotation=0;
    locus.share=1;
    Object.assign(locus,presentationEntity(centre.locus_ref,centre.ordinal,centre.resonance,session));
    return locus;
  });
  const earth=entity("EarthBody","⊕",{x:0,y:-0.94,z:0});
  earth.id=session.earth_body.locus_ref;earth.size={x:0.28,y:0.28};earth.share=1;
  Object.assign(earth,presentationEntity(earth.id,7,0.5,session));
  scene.entities.push(earth);
  scene.field.background="#f4f2eb";scene.field.params.count=65536;scene.field.params.size=1.2;
  return nativeExport(scene).config;
}

function sourceTint(session:NaraExpressionSession):{tint:string;weight:number}{
  const colour=(session.m2_presentation as {colour?:{linear_rgba?:unknown;standing?:unknown}}|null)?.colour;
  const rgba=colour?.linear_rgba;
  if(!Array.isArray(rgba)||rgba.length<3||rgba.slice(0,3).some(value=>typeof value!=="number"||!Number.isFinite(value)))return {tint:"#252720",weight:0};
  const srgb=(value:number)=>value<=.0031308?12.92*value:1.055*Math.pow(value,1/2.4)-.055;
  const hex=rgba.slice(0,3).map(value=>Math.round(Math.max(0,Math.min(1,srgb(value as number)))*255).toString(16).padStart(2,"0")).join("");
  return {tint:`#${hex}`,weight:colour?.standing==="available"||colour?.standing==="current"?0.72:0};
}

function presentationEntity(id:string,ordinal:number,resonance:number,session:NaraExpressionSession){
  const colour=sourceTint(session);
  return {id,x:0,y:ordinal===7?-0.94:-0.66+ordinal*0.22,z:0,scale:Math.max(0.72,Math.min(1.34,0.9+Math.abs(resonance)*0.22)),tint:colour.tint,tintWeight:colour.weight};
}

/** Strict, complete retained-presentation envelope. It contains session-local
 * readings and must never be exported as the portable cue body. */
export function naraRetainedPresentation(session:NaraExpressionSession):NaraRetainedPresentation{
  const ordered=[...session.centres].sort((a,b)=>a.ordinal-b.ordinal);
  return {schema:"oi.retained-presentation/v1",eventRef:session.event_ref,subjectRef:session.subject_ref,profileGeneration:session.profile_generation,personalGeneration:session.personal_reception_generation,entities:[...ordered.map(centre=>presentationEntity(centre.locus_ref,centre.ordinal,centre.resonance,session)),presentationEntity(session.earth_body.locus_ref,7,0.5,session)]};
}

export function projectNaraExpression(snapshot:FocusedInstrumentSnapshot):NaraExpressionProjection{
  const session=snapshot.nara_expression;
  if(!session)return {standing:"unavailable",session:null,config:null,reason:"The QL owner has not supplied a Nara reception."};
  validateSession(snapshot,session);
  if(!session.current||!snapshot.personal_current)return {standing:"stale",session,config:null,reason:"The Nara reception does not match the current owner generation."};
  return {standing:"current",session,config:naraExpressionConfig(session),reason:session.standing};
}

/** Only the QL-owner validated portable body crosses export. */
export function exportNaraCues(session:NaraExpressionSession):NaraExpressionPortableCues{
  return structuredClone(session.portable);
}
