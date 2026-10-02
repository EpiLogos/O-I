import type {NativeCallFailure} from "./types";

/** The kernel's physical-call failure projection, not a native success
 * receipt. Keep its original invocation and full owner error for readback. */
export class NativeOwnerFailure extends Error {
  constructor(readonly reading:NativeCallFailure) {
    const failure=reading.failure;
    const detail=failure.message??failure.detail??"Native call failed";
    const outcome=reading.owner_operation==="projectcentral.source.read"?"The outcome of this native source reading is unknown.":"The outcome is unknown.";
    super(`${reading.owner_operation}: ${detail}${failure.kind==="outcome_unknown"?` ${outcome} Retain the original selection and inspect native owner records before invoking this operation again.`:""}`);
    this.name="NativeOwnerFailure";
  }
}

/** String-error transports carry the same exact packet as JSON once. Never
 * infer an effect from diagnostic words or recursively decode arbitrary data. */
function decodeNativeFailure(value:unknown,rejectMalformed:boolean):NativeCallFailure|undefined {
  if(typeof value==="string") {
    try {value=JSON.parse(value);} catch {return;}
  }
  if(!value||typeof value!=="object"||Array.isArray(value))return;
  const reading=value as Record<string,unknown>;
  if(reading.schema!=="oi.native-call-failure/v1")return;
  const failure=reading.failure;
  if(typeof reading.owner_operation!=="string"||!failure||typeof failure!=="object"||Array.isArray(failure)||!["outcome_unknown","transport_failed","unavailable","malformed","refused"].includes(String((failure as Record<string,unknown>).kind))) {
    if(rejectMalformed)throw new Error("Kernel returned an incompatible native-call failure; no native receipt was delivered");
    return;
  }
  return value as NativeCallFailure;
}

export function nativeFailureReading(value:unknown):NativeCallFailure|undefined {
  return decodeNativeFailure(value,false);
}

export function throwNativeFailure(value:unknown):void {
  const reading=decodeNativeFailure(value,true);
  if(reading)throw new NativeOwnerFailure(reading);
}
