/**
 * Shared wire vocabulary for the desktop Nara speech consumer (#336).
 *
 * O:I is a consumer here. Every schema name, kebab spelling and four-state
 * answer mirrors the upstream owners verbatim — the speech constitution and
 * receipts are Actuation's (`actuation-adapters/src/speech.rs`,
 * `actuation-runtime/src/{nara,speech_session}.rs`), the dialogue context,
 * deixis and Epii delegation are QL's (`ql-mef/src/nara/dialogue.rs`). This
 * module defines none of them; it carries their shapes so constructed
 * documents round-trip against the owners' fixtures unchanged.
 */

export const SPEECH_CONSTITUTION_VERSION = "actuation.speech-constitution/v1";
export const SPEECH_CONSTITUTION_CHANGE_VERSION = "actuation.speech-constitution-change/v1";
export const SPEECH_TOOL_DECISION_VERSION = "actuation.speech-tool-decision/v1";
export const SPEECH_SESSION_READ_VERSION = "actuation.speech-session-read/v1";
export const SPEECH_INTERRUPTION_VERSION = "actuation.speech-interruption/v1";
export const NARA_BINDING_VERSION = "actuation.nara-binding/v1";
export const NARA_INTERRUPTION_VERSION = "actuation.nara-interruption/v1";
export const NARA_DELEGATION_VERSION = "actuation.nara-delegation/v1";
export const NARA_ENRICHMENT_VERSION = "actuation.nara-enrichment/v1";
export const NARA_DIALOGUE_CONTEXT_VERSION = "ql.nara-dialogue-context/v1";
export const NARA_DEIXIS_VERSION = "ql.nara-deixis/v1";
export const NARA_EPII_DELEGATION_VERSION = "ql.nara-epii-delegation/v1";
export const EPII_ENRICHMENT_VERSION = "ql.epii-enrichment/v1";

export const MODALITIES = ["text", "audio", "speech"] as const;
export const TRANSFORMS = ["speech-to-text", "text-to-speech", "speech-to-speech", "audio-understanding", "multimodal-text-audio"] as const;
export const INTERACTIONS = ["request-response", "streaming-input", "streaming-output", "full-duplex-realtime", "structured-events", "tool-requests", "timestamps", "partial-transcripts", "final-transcripts", "vad-turn-detection", "barge-in"] as const;
export const TRANSPORTS = ["in-process", "cli", "http", "websocket", "webrtc", "sip", "provider-native"] as const;
export const RECONNECTS = ["not-applicable", "resumable", "reconnect-without-session", "unsupported"] as const;

/** The fully explicit answer to "can this body do X?". Supported, degraded,
 * unsupported and unknown stay four different facts; `unknown` never behaves
 * as a yes (Actuation SpeechSupport, verbatim). */
export type SpeechSupport =
  | {state:"supported"}
  | {state:"degraded";reason:string}
  | {state:"unsupported";reason:string}
  | {state:"unknown";reason:string};

export const supported = ():SpeechSupport => ({state:"supported"});
export const degraded = (reason:string):SpeechSupport => ({state:"degraded",reason});
export const unsupported = (reason:string):SpeechSupport => ({state:"unsupported",reason});
export const unknown = (reason:string):SpeechSupport => ({state:"unknown",reason});

/** Only a proven or stated-reduced capability behaves as usable. */
export function supportUsable(s:SpeechSupport):boolean {return s.state==="supported"||s.state==="degraded";}
export function supportProven(s:SpeechSupport):boolean {return s.state==="supported";}

/** Read one four-state support entry, refusing flattened two-state answers. */
export function readSupport(entry:unknown,label:string):SpeechSupport {
  if(!entry||typeof entry!=="object"||Array.isArray(entry))throw new Error(`${label} must be a four-state support object`);
  const record=entry as Record<string,unknown>;
  const reason=(value:unknown):string=>{
    if(typeof value!=="string"||!value.trim())throw new Error(`${label} ${String(record.state)} must carry a non-empty reason`);
    return value;
  };
  switch(record.state){
    case "supported":return supported();
    case "degraded":return degraded(reason(record.reason));
    case "unsupported":return unsupported(reason(record.reason));
    case "unknown":return unknown(reason(record.reason));
    default:throw new Error(`${label} must be supported, degraded, unsupported or unknown`);
  }
}

/** A bounded non-empty text field, mirroring the owners' text law. */
export function wireText(value:unknown,label:string):string {
  if(typeof value!=="string"||!value.trim()||value.length>4096||/[\u0000-\u001f]/.test(value))throw new Error(`invalid ${label}`);
  return value;
}

/** A bounded long-text field (briefs, syntheses). */
export function wireLongText(value:unknown,label:string,max:number):string {
  if(typeof value!=="string"||!value.trim()||value.length>max||/[\u0000-\u001f]/.test(value))throw new Error(`invalid ${label}`);
  return value;
}

/** A list of distinct bounded refs, capped. */
export function wireRefs(value:unknown,label:string,max:number):string[] {
  if(!Array.isArray(value))throw new Error(`invalid ${label} list`);
  if(value.length>max)throw new Error(`too many ${label}`);
  const seen=new Set<string>();const out:string[]=[];
  for(const entry of value){
    const ref=wireText(entry,label);
    if(seen.has(ref))throw new Error(`duplicate ${label}`);
    seen.add(ref);out.push(ref);
  }
  return out;
}

/** An owner timestamp (the owners' `date` admission: a parseable timestamp string). */
export function wireTimestamp(value:unknown,label:string):string {
  const text=wireText(value,label);
  if(Number.isNaN(Date.parse(text)))throw new Error(`invalid ${label}: expected a timestamp`);
  return text;
}

/** Unix-ms stamp for requests the owners timestamp with integers. */
export function wireUnixMs(value:unknown,label:string):number {
  if(typeof value!=="number"||!Number.isSafeInteger(value)||value<0)throw new Error(`invalid ${label}`);
  return value;
}

const SECRET_KEY_NAMES = ["value","secret_value","secretvalue","plaintext","secret","password","token_value","api_key","apikey","credential"];
/** Refuses value-shaped keys anywhere in a public wire record (Actuation's
 * secret scan, mirrored). Refs and presence facts travel; material never does. */
export function noSecretMaterialKeys(node:unknown,path:string):void {
  if(Array.isArray(node)){node.forEach((entry,index)=>noSecretMaterialKeys(entry,`${path}[${index}]`));return;}
  if(node&&typeof node==="object"){
    for(const [key,value] of Object.entries(node as Record<string,unknown>)){
      if(SECRET_KEY_NAMES.includes(key.toLowerCase()))throw new Error(`${path}.${key} carries a forbidden value-shaped key`);
      noSecretMaterialKeys(value,`${path}.${key}`);
    }
  }
}

/** Exact-key record check: the owners admit with `deny_unknown_fields`, so a
 * constructed document carrying keys outside the contract is refused here too. */
export function exactKeys(value:unknown,allowed:readonly string[],label:string):Record<string,unknown> {
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error(`${label} must be an object`);
  const record=value as Record<string,unknown>;
  for(const key of Object.keys(record)){
    if(!allowed.includes(key))throw new Error(`${label} carries unknown field ${key}`);
    if(record[key]===undefined)throw new Error(`${label} carries undefined field ${key}`);
  }
  return record;
}

export function requireObject(value:unknown,label:string):Record<string,unknown> {
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error(`${label} must be an object`);
  return value as Record<string,unknown>;
}
