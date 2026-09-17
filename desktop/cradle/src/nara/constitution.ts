/**
 * `actuation.speech-constitution/v1` — the desktop consumer of the resolved
 * speech body (Actuation #94, O:I #336).
 *
 * The desktop builds this document from the AIKit modality resolution
 * (`aikit.model-modality/v1` — either a single-model
 * `ModelSurfaceReading.modality` or a cascade `StagedModelRuntimeReadModel`)
 * and consumes the receipts Actuation's laws produce. The admission checks
 * here mirror Actuation's validator so a document the desktop constructs is
 * admitted by the owner unchanged — the shapes are the owner's, never a
 * desktop dialect. A text-only body is a valid constitution: absence of
 * acoustic modalities is a constituted fact, not an error.
 */

import {
  INTERACTIONS,MODALITIES,RECONNECTS,SPEECH_CONSTITUTION_CHANGE_VERSION,SPEECH_CONSTITUTION_VERSION,TRANSFORMS,TRANSPORTS,
  degraded,noSecretMaterialKeys,readSupport,requireObject,supported,supportProven,supportUsable,unknown,unsupported,
  wireText,wireTimestamp,exactKeys,
  type SpeechSupport,
} from "./support";

export const SUPPORTED_INTERACTIONS = INTERACTIONS;
export const SUPPORTED_MODALITIES = MODALITIES;

export interface SpeechConstitutionFacts {
  constitution_ref:string;
  agent_ref:string;
  agency_ref:string;
  world_binding_ref:string;
  agent_session_ref:string;
  body_ref:string;
  body_revision?:string;
  harness_composition_ref?:string;
  modality_contract_ref?:string;
  modality_contract_revision?:string;
  model_relation:unknown;
  access_profile:unknown;
  input_modalities:string[];
  output_modalities:string[];
  transforms?:Record<string,SpeechSupport>;
  transform_role?:string;
  interaction:Record<string,SpeechSupport>;
  transport:string;
  connection:{kind:"stateless"}|{kind:"connected";reconnect:string|null};
  interruption:SpeechSupport;
  provider_binding:{provider_ref:string;provider_session_ref?:string|null;transport_connection_ref?:string|null;material_binding_ref?:string|null;facts:Record<string,unknown>};
  conditions?:{condition:"degraded"|"unavailable";reason:string}[];
  usage_evidence_refs?:string[];
  provenance:{source_refs?:string[]};
  resolved_at:string;
  [field:string]:unknown;
}

/** Validate one speech constitution exactly as the Actuation owner admits
 * it: identity roles distinct, declared vocabularies, no transform whose
 * acoustic prerequisites the body lacks, four-state support everywhere,
 * connection semantics coherent, no secret material. */
export function validateSpeechConstitution(value:unknown):SpeechConstitutionFacts {
  const v=requireObject(value,"speech constitution");
  if(v["schema"]!==SPEECH_CONSTITUTION_VERSION)throw new Error("wrong schema; expected actuation.speech-constitution/v1");
  for(const key of ["constitution_ref","agent_ref","agency_ref","world_binding_ref","agent_session_ref","body_ref"])wireText(v[key],key);
  const lookup=(path:string):unknown=>path.split(".").reduce<unknown>((current,key)=>current!=null&&typeof current==="object"?(current as Record<string,unknown>)[key]:undefined,v);
  const distinct:[string,string][]=[
    ["agent_ref","agency_ref"],["agent_ref","agent_session_ref"],["agent_ref","body_ref"],
    ["agency_ref","body_ref"],["agent_session_ref","body_ref"],
    ["body_ref","provider_binding.provider_session_ref"],["body_ref","provider_binding.transport_connection_ref"],
  ];
  for(const [a,b] of distinct){
    const left=v[a],right=lookup(b);
    if(typeof left==="string"&&typeof right==="string"&&left===right)throw new Error(`${a} and ${b} must remain distinct refs`);
  }
  for(const key of ["body_revision","harness_composition_ref","modality_contract_ref","modality_contract_revision"])if(v[key]!=null)wireText(v[key],key);
  requireObject(v["model_relation"],"model_relation");
  requireObject(v["access_profile"],"access_profile");
  for(const key of ["input_modalities","output_modalities"]){
    const list=modalitiesOf(v[key]);
    if(!list.length)throw new Error("a constitution declares its modalities; absence is recorded, not omitted");
    if(new Set(list).size!==list.length)throw new Error("duplicate modality");
    v[key]=list;
  }
  const acousticIn=modalitiesOf(v["input_modalities"]).some(m=>m==="audio"||m==="speech");
  const acousticOut=modalitiesOf(v["output_modalities"]).some(m=>m==="audio"||m==="speech");
  if(v["transforms"]!=null){
    const transforms=requireObject(v["transforms"],"transforms");
    for(const [name,entry] of Object.entries(transforms)){
      if(!(TRANSFORMS as readonly string[]).includes(name))throw new Error(`unknown transform ${name}`);
      (transforms as Record<string,SpeechSupport>)[name]=readSupport(entry,`transform ${name}`);
      const needsIn=name==="speech-to-text"||name==="speech-to-speech"||name==="audio-understanding";
      const needsOut=name==="text-to-speech"||name==="speech-to-speech";
      if(needsIn&&!acousticIn)throw new Error(`transform ${name} requires an acoustic input modality`);
      if(needsOut&&!acousticOut)throw new Error(`transform ${name} requires an acoustic output modality`);
    }
  }
  if(v["transform_role"]!=null){
    const role=wireText(v["transform_role"],"transform role");
    if(!(TRANSFORMS as readonly string[]).includes(role))throw new Error("unknown transform role");
  }
  if(v["interaction"]==null)throw new Error("the interaction support map is required; an unqueried capability is unknown, not absent");
  const interaction=requireObject(v["interaction"],"interaction support");
  for(const [name,entry] of Object.entries(interaction)){
    if(!(INTERACTIONS as readonly string[]).includes(name))throw new Error(`unknown interaction capability ${name}`);
    (interaction as Record<string,SpeechSupport>)[name]=readSupport(entry,`interaction ${name}`);
  }
  const transport=wireText(v["transport"],"transport");
  if(!(TRANSPORTS as readonly string[]).includes(transport))throw new Error(`unknown transport ${transport}`);
  const connection=requireObject(v["connection"],"connection semantics");
  if(connection["kind"]==="stateless"){
    if(connection["reconnect"]!=null)throw new Error("stateless connection cannot declare reconnect support");
  }else if(connection["kind"]==="connected"){
    const reconnect=connection["reconnect"]==null?null:wireText(connection["reconnect"],"reconnect");
    if(reconnect!=null&&!(RECONNECTS as readonly string[]).includes(reconnect))throw new Error(`unknown reconnect support ${reconnect}`);
    (connection as {reconnect?:unknown}).reconnect=reconnect;
  }else throw new Error("connection kind must be stateless or connected");
  v["interruption"]=readSupport(v["interruption"],"interruption");
  const binding=requireObject(v["provider_binding"],"provider_binding provenance");
  wireText(binding["provider_ref"],"provider_ref");
  for(const key of ["provider_session_ref","transport_connection_ref","material_binding_ref"])if(binding[key]!=null)wireText(binding[key],key);
  requireObject(binding["facts"],"provider_binding.facts");
  if(v["conditions"]!=null){
    if(!Array.isArray(v["conditions"]))throw new Error("conditions must be an array of named facts");
    for(const condition of v["conditions"] as Record<string,unknown>[]){
      requireObject(condition,"condition");
      if(condition["condition"]!=="degraded"&&condition["condition"]!=="unavailable")throw new Error("condition must be degraded or unavailable");
      wireText(condition["reason"],"condition reason");
    }
  }
  if(v["usage_evidence_refs"]!=null){
    if(!Array.isArray(v["usage_evidence_refs"]))throw new Error("usage_evidence_refs must be a list");
    v["usage_evidence_refs"]=v["usage_evidence_refs"].map(ref=>wireText(ref,"usage evidence ref"));
  }
  const provenance=requireObject(v["provenance"],"provenance");
  if(provenance["source_refs"]!=null){
    if(!Array.isArray(provenance["source_refs"]))throw new Error("provenance.source_refs must be a list");
    provenance["source_refs"]=provenance["source_refs"].map(ref=>wireText(ref,"provenance ref"));
  }
  wireTimestamp(v["resolved_at"],"resolved_at");
  noSecretMaterialKeys(v,"constitution");
  return v as unknown as SpeechConstitutionFacts;
}

function modalitiesOf(value:unknown):string[] {
  if(!Array.isArray(value))throw new Error("modalities must be a list");
  return value.map(entry=>{
    const modality=wireText(entry,"modality");
    if(!(MODALITIES as readonly string[]).includes(modality))throw new Error(`unknown modality ${modality}`);
    return modality;
  });
}

/** Whether the constituted body can actually hear and speak: derived from
 * declared acoustic modalities plus usable transforms — never from a name. */
export function speechCapable(c:SpeechConstitutionFacts):boolean {
  const acousticIn=c.input_modalities.some(m=>m==="audio"||m==="speech");
  const acousticOut=c.output_modalities.some(m=>m==="audio"||m==="speech");
  return acousticIn&&acousticOut&&bodyUsable(c);
}

/** Acoustic both ways plus a proven full-duplex interaction. */
export function realtimeCapable(c:SpeechConstitutionFacts):boolean {
  return speechCapable(c)&&supportProven(interactionSupport(c,"full-duplex-realtime"));
}

export function interactionSupport(c:SpeechConstitutionFacts,capability:string):SpeechSupport {
  return c.interaction[capability]??unknown(`capability ${capability} was not adjudicated in this constitution`);
}

export function interruptionSupport(c:SpeechConstitutionFacts):SpeechSupport {return c.interruption;}

export function bodyUsable(c:SpeechConstitutionFacts):boolean {
  return !(c.conditions??[]).some(condition=>condition.condition==="unavailable");
}

/** Text path support: the honest dialogue channel when no acoustic body is
 * available. A text-capable body is constituted, not degraded-by-us. */
export function textPathSupport(c:SpeechConstitutionFacts):SpeechSupport {
  const textIn=c.input_modalities.includes("text");
  const textOut=c.output_modalities.includes("text");
  if(textIn&&textOut&&bodyUsable(c))return supported();
  if(!bodyUsable(c))return unsupported("the constituted body is recorded unavailable");
  return unsupported("the constituted body does not declare text in both directions");
}

// ---------------------------------------------------------------------------
// Construction from the AIKit modality resolution
// ---------------------------------------------------------------------------

/** Identity roles the caller (the desktop session host) supplies; the body
 * is none of them. */
export interface ConstitutionIdentities {
  constitution_ref:string;
  agent_ref:string;
  agency_ref:string;
  world_binding_ref:string;
  agent_session_ref:string;
  body_ref:string;
  body_revision?:string;
  harness_composition_ref?:string;
}

interface AikitModalityContract {
  schema:string;
  input_modalities:unknown;
  output_modalities:unknown;
  transforms?:Record<string,unknown>;
  interaction?:unknown;
  degraded_interaction?:Record<string,string>;
  transport?:unknown;
  connection?:unknown;
  availability?:unknown;
  provider?:unknown;
  provider_native_surface?:unknown;
  provider_revision?:string|null;
  provenance?:string[];
  [field:string]:unknown;
}

interface AikitComposedModality {
  input_modalities:unknown;
  output_modalities:unknown;
  transforms?:Record<string,unknown>;
  interaction?:Record<string,unknown>;
  degraded_interaction?:Record<string,string>;
  speech_capable?:boolean;
  complete?:boolean;
  basis?:string[];
  [field:string]:unknown;
}

/** Build the constitution from the AIKit resolution wire document.
 * `resolution` is either a `ModelRuntimeReadModel` (single model: the facts
 * live at `relation.model_surface.modality`) or a
 * `StagedModelRuntimeReadModel` (cascade: `composed_modality`). Every
 * capability the resolution does not prove answers `unsupported` when the
 * body's declaration is complete and `unknown` when it is not — proven,
 * proven-absent and unproven stay distinct facts. */
export function constitutionFromAikitResolution(identities:ConstitutionIdentities,resolution:unknown,resolvedAt:string):SpeechConstitutionFacts {
  const document=requireObject(resolution,"AIKit model runtime read model");
  const staged=requireObject(document["composed_modality"],"composed_modality") as unknown as AikitComposedModality;
  const relation=document["relation"]!=null?requireObject(document["relation"],"model_relation"):null;
  const surface=relation?requireObject(relation["model_surface"],"model_surface"):null;
  const contract=(surface?surface["modality"]:null) as AikitModalityContract|null;
  const complete=staged["complete"]!==false;
  const unavailable=requireObject(document,"read model").hasOwnProperty("unavailable")?document["unavailable"]:[];
  const input=listStrings(staged["input_modalities"],"composed input_modalities");
  const output=listStrings(staged["output_modalities"],"composed output_modalities");
  const transformEntries=Object.entries(stagedCompletion(staged,contract,"transforms"));
  const transforms:Record<string,SpeechSupport>={};
  const acousticIn=input.some(m=>m==="audio"||m==="speech");
  const acousticOut=output.some(m=>m==="audio"||m==="speech");
  for(const [name,declared] of transformEntries){
    // A declared transform whose acoustic prerequisites the body lacks is a
    // contradiction between read models; the desktop refuses to paper it in.
    const needsIn=name==="speech-to-text"||name==="speech-to-speech"||name==="audio-understanding";
    const needsOut=name==="text-to-speech"||name==="speech-to-speech";
    if((needsIn&&!acousticIn)||(needsOut&&!acousticOut))throw new Error(`AIKit resolution declares transform ${name} whose acoustic modalities the composed body does not carry`);
    transforms[name]=declaredSupport(declared,name,complete);
  }
  const interaction:Record<string,SpeechSupport>={};
  const declaredInteractions=Object.keys(stagedCompletion(staged,contract,"interaction"));
  const degradedInteraction={...staged["degraded_interaction"]??{},...(contract?.degraded_interaction??{})};
  for(const name of INTERACTIONS){
    if(name==="request-response"&&(input.includes("text")&&output.includes("text"))&&!declaredInteractions.includes(name)){
      // A text-in/text-out body carries request-response by constitution;
      // the declared map refines it only when the resolution states a reduction.
      interaction[name]=degradedInteraction[name]?degraded(degradedInteraction[name]):supported();
      continue;
    }
    if(!declaredInteractions.includes(name)){
      interaction[name]=complete?unsupported(`the resolved body's declaration does not carry ${name}`):unknown(`no modality contract declared ${name}; the body's declaration is incomplete`);
      continue;
    }
    const raw=findDeclared(staged,contract,"interaction",name);
    interaction[name]=declaredSupport(raw,name,complete);
  }
  const transportValue=(contract?.transport??stagedTransportFallback(document))??unknownTransport(document);
  const transport=wireText(transportValue,"transport");
  if(!(TRANSPORTS as readonly string[]).includes(transport))throw new Error(`unknown transport ${transport}`);
  const connectionRaw=(contract?.connection??null) as Record<string,unknown>|null;
  const kind=connectionRaw?.["kind"]==="connected"?"connected":"stateless";
  const reconnect=kind==="connected"?wireText(connectionRaw?.["reconnect"]??"unsupported","reconnect"):null;
  if(reconnect!=null&&!(RECONNECTS as readonly string[]).includes(reconnect))throw new Error(`unknown reconnect support ${reconnect}`);
  const interruption:SpeechSupport=interaction["barge-in"];
  const conditions:{condition:"degraded"|"unavailable";reason:string}[]=[];
  if(Array.isArray(unavailable))for(const entry of unavailable as Record<string,unknown>[]){
    conditions.push({condition:"unavailable",reason:wireText(entry["reason"],"unavailability reason")});
  }
  if(contract&&contract["availability"]==="unavailable"&&!conditions.some(c=>c.condition==="unavailable")){
    conditions.push({condition:"unavailable",reason:"the resolved surface declares itself unavailable"});
  }
  const providerRef=contract?wireText(contract["provider"]??"provider:unresolved","provider"):stagedProviderFallback(document);
  const constitution:SpeechConstitutionFacts={
    schema:SPEECH_CONSTITUTION_VERSION,
    ...identities,
    model_relation:relation??{schema:"aikit.staged-model-runtime/v1",basis:staged["basis"]??[]},
    access_profile:{schema:"aikit.model-access/v1",derived:true},
    input_modalities:input,output_modalities:output,
    transforms:Object.keys(transforms).length?transforms:undefined,
    interaction,
    transport,
    connection:kind==="connected"?{kind:"connected",reconnect}:{kind:"stateless"},
    interruption,
    provider_binding:{
      provider_ref:providerRef,
      provider_session_ref:null,
      transport_connection_ref:null,
      material_binding_ref:null,
      facts:{
        provider_native_surface:contract?.provider_native_surface??"unresolved",
        provider_revision:contract?.provider_revision??null,
        credential_scope:contract&&Object.prototype.hasOwnProperty.call(contract,"credential_scope")?(contract as unknown as Record<string,unknown>)["credential_scope"]:"unresolved",
        composed_basis:staged["basis"]??[],
      },
    },
    conditions:conditions.length?conditions:undefined,
    provenance:{source_refs:[...contract?.provenance??[],...staged["basis"]??[],aikitResolutionRef(String(document["harness"]??"harness:unresolved"),String(document["version"]??"v1"))]},
    resolved_at:resolvedAt,
  };
  return validateSpeechConstitution(constitution);
}

/** The AIKit provenance line a constitution cites for the resolution it
 * carries (Actuation `aikit_resolution_ref`, verbatim spelling). */
export function aikitResolutionRef(readModelRef:string,revision:string):string {
  return `aikit:model-runtime:${readModelRef}@${revision}`;
}

function declaredSupport(declared:unknown,name:string,complete:boolean):SpeechSupport {
  if(declared&&typeof declared==="object"&&!Array.isArray(declared)){
    const record=declared as Record<string,unknown>;
    if(record["state"]==="supported")return supported();
    if(record["state"]==="degraded")return degraded(wireText(record["reason"],"degraded reason"));
    if(record["state"]==="unsupported")return unsupported(wireText(record["reason"],"unsupported reason"));
    if(record["state"]==="unknown")return unknown(wireText(record["reason"],"unknown reason"));
    if("available" in record)return record["available"]===true?supported():unsupported(`the resolved surface withholds ${name}`);
  }
  return complete?unsupported(`the resolved body's declaration does not carry ${name}`):unknown(`no modality contract declared ${name}; the body's declaration is incomplete`);
}

function stagedCompletion(staged:AikitComposedModality,contract:AikitModalityContract|null,kind:"transforms"|"interaction"):Record<string,unknown> {
  const composed=kind==="transforms"?staged["transforms"]:staged["interaction"];
  const declared=contract?(kind==="transforms"?contract["transforms"]:contract["interaction"]):undefined;
  return {...normalizeEntries(declared),...normalizeEntries(composed)};
}

function findDeclared(staged:AikitComposedModality,contract:AikitModalityContract|null,kind:"transforms"|"interaction",name:string):unknown {
  const composed=normalizeEntries(kind==="transforms"?staged["transforms"]:staged["interaction"]);
  const declared=normalizeEntries(kind==="transforms"?contract?.["transforms"]:contract?.["interaction"]);
  if(Object.prototype.hasOwnProperty.call(composed,name))return composed[name];
  if(Object.prototype.hasOwnProperty.call(declared,name))return declared[name];
  return null;
}

function normalizeEntries(value:unknown):Record<string,unknown> {
  if(Array.isArray(value)){
    // A BTreeSet of capability names serialises as a list of strings; each
    // declared name means proven support with no stated reduction.
    const entries:Record<string,unknown>={};
    for(const entry of value)if(typeof entry==="string")entries[entry]={state:"supported"};
    return entries;
  }
  if(value&&typeof value==="object")return {...value as Record<string,unknown>};
  return {};
}

function listStrings(value:unknown,label:string):string[] {
  if(!Array.isArray(value))throw new Error(`${label} must be a list`);
  return value.map(entry=>wireText(entry,label));
}

function stagedTransportFallback(document:Record<string,unknown>):string|null {
  const stages=document["stages"];
  if(Array.isArray(stages)){
    for(const stage of stages as Record<string,unknown>[]){
      const modality=requireObject(stage["modality"]??{}, "stage modality") as Record<string,unknown>;
      if(typeof modality["transport"]==="string")return modality["transport"];
    }
  }
  return null;
}

function unknownTransport(document:Record<string,unknown>):string {
  throw new Error(`the AIKit resolution carries no transport fact for the composed body (harness ${String(document["harness"]??"unresolved")})`);
}

function stagedProviderFallback(document:Record<string,unknown>):string {
  return `provider:unresolved@${String(document["harness_composition_fingerprint"]??"unfingerprinted")}`;
}

// ---------------------------------------------------------------------------
// Body change receipts (#94 identity law, consumed verbatim)
// ---------------------------------------------------------------------------

export interface ConstitutionDelta {
  body_changed:boolean;
  model_changed:boolean;
  provider_changed:boolean;
  provider_session_changed:boolean;
  transport_connection_changed:boolean;
  connection_changed:boolean;
  gained_interaction:string[];
  lost_interaction:string[];
  interruption_before:SpeechSupport;
  interruption_after:SpeechSupport;
  speech_capable_before:boolean;
  speech_capable_after:boolean;
}

const lookupPath=(v:SpeechConstitutionFacts,path:string):unknown=>path.split(".").reduce<unknown>((current,key)=>current!=null&&(typeof current==="object")?(current as Record<string,unknown>)[key]:undefined,v);

/** What actually moved between two constitutions. Losses are facts, not
 * judgements; the delta never softens them (Actuation `ConstitutionDelta`). */
export function constitutionDelta(before:SpeechConstitutionFacts,after:SpeechConstitutionFacts):ConstitutionDelta {
  const usableInteractions=(c:SpeechConstitutionFacts)=>new Set(Object.entries(c.interaction).filter(([,entry])=>supportUsable(entry)).map(([name])=>name));
  const beforeInteractions=usableInteractions(before),afterInteractions=usableInteractions(after);
  return {
    body_changed:before.body_ref!==after.body_ref,
    model_changed:JSON.stringify(lookupPath(before,"model_relation.model_ref"))!==JSON.stringify(lookupPath(after,"model_relation.model_ref")),
    provider_changed:before.provider_binding.provider_ref!==after.provider_binding.provider_ref,
    provider_session_changed:before.provider_binding.provider_session_ref!==after.provider_binding.provider_session_ref,
    transport_connection_changed:before.provider_binding.transport_connection_ref!==after.provider_binding.transport_connection_ref,
    connection_changed:JSON.stringify(before.connection)!==JSON.stringify(after.connection),
    gained_interaction:[...afterInteractions].filter(name=>!beforeInteractions.has(name)).sort(),
    lost_interaction:[...beforeInteractions].filter(name=>!afterInteractions.has(name)).sort(),
    interruption_before:before.interruption,
    interruption_after:after.interruption,
    speech_capable_before:speechCapable(before),
    speech_capable_after:speechCapable(after),
  };
}

export interface SpeechConstitutionChangeReceipt {
  schema:typeof SPEECH_CONSTITUTION_CHANGE_VERSION;
  change_ref:string;
  agent_ref:string;
  agency_ref:string;
  world_binding_ref:string;
  agent_session_before:string;
  agent_session_after:string;
  before:SpeechConstitutionFacts;
  after:SpeechConstitutionFacts;
  delta:ConstitutionDelta;
  reason:string;
  evidence_refs:string[];
  changed_at:string;
}

/** Record a body change between two admitted constitutions of one enduring
 * Agent/Agency. Refuses when identity changed — that is a different Agent,
 * and this receipt must never paper over it (Actuation #94 identity law). */
export function recordConstitutionChange(input:{change_ref:string;before:SpeechConstitutionFacts;after:SpeechConstitutionFacts;reason:string;evidence_refs:string[];changed_at:string}):SpeechConstitutionChangeReceipt {
  const before=validateSpeechConstitution(input.before);
  const after=validateSpeechConstitution(input.after);
  if(before.agent_ref!==after.agent_ref||before.agency_ref!==after.agency_ref)throw new Error("a speech body change must not change Agent or Agency identity");
  if(before.constitution_ref===after.constitution_ref)throw new Error("a change receipt must record two distinct constitutions");
  if(!input.evidence_refs.length)throw new Error("a body change requires evidence of the change");
  const receipt:SpeechConstitutionChangeReceipt=exactKeys({
    schema:SPEECH_CONSTITUTION_CHANGE_VERSION,
    change_ref:wireText(input.change_ref,"change_ref"),
    agent_ref:before.agent_ref,
    agency_ref:before.agency_ref,
    world_binding_ref:before.world_binding_ref,
    agent_session_before:before.agent_session_ref,
    agent_session_after:after.agent_session_ref,
    before,after,
    delta:constitutionDelta(before,after),
    reason:wireText(input.reason,"reason"),
    evidence_refs:input.evidence_refs.map(ref=>wireText(ref,"evidence ref")),
    changed_at:wireTimestamp(input.changed_at,"changed_at"),
  },["schema","change_ref","agent_ref","agency_ref","world_binding_ref","agent_session_before","agent_session_after","before","after","delta","reason","evidence_refs","changed_at"],"speech constitution change") as unknown as SpeechConstitutionChangeReceipt;
  return receipt;
}
