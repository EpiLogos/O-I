import type {EncounterStatus} from "../../encounter/client";

/** An explicit native status read proves liveness, never successful inference. */
export function connectionVerification(status:EncounterStatus):{connected:boolean;summary:string} {
 const connected=!!status.native_session_id&&status.resident!==false&&!status.error&&["Resident","TurnInFlight","InterruptRequested"].includes(status.state);
 if(status.error)return {connected:false,summary:"The harness reports a connection fault."};
 if(connected)return {connected:true,summary:status.state==="Resident"?"Connected. The native session is ready.":"Connected. A turn is in progress."};
 return {connected:false,summary:status.state==="Disconnected"||status.resident===false?"Disconnected. This conversation has no resident harness connection.":"The owner did not confirm a live native connection."};
}

export const MODEL_DEFAULT_SETTING="ai-kit:models:models.default";
export interface HarnessModelDefault {model_id:string;model_name?:string;native_provider?:string}
export function modelDefaults(value:unknown):Record<string,HarnessModelDefault> {
 if(!value||typeof value!=="object"||Array.isArray(value))return {};
 return Object.fromEntries(Object.entries(value).filter((entry):entry is [string,HarnessModelDefault]=>{
  const v=entry[1];return !!v&&typeof v==="object"&&typeof v.model_id==="string"&&!!v.model_id&&
   (v.model_name===undefined||typeof v.model_name==="string")&&(v.native_provider===undefined||typeof v.native_provider==="string");
 }));
}
/** A default can only be staged from a harness's actual advertisement. */
export function modelDefaultChoice(observation:import("../../encounter/nativeModel").NativeModelObservation|undefined|null,id:string):HarnessModelDefault|undefined {
 const choice=observation?.available_models.find(model=>model.modelId===id);
 if(!choice)return undefined;
 return {model_id:choice.modelId,model_name:choice.name,...(observation?.native_provider?{native_provider:observation.native_provider}:{})};
}
