import {kernelOp} from '../kernel/bridge';
import type {KernelTransportStatus} from '../kernel/types';
import type {NativeDialogueRequest} from './dialogueTypes';
export interface PresencePublication {
 field_ref:string;world_ref:string;projection_ref:string;presentation_ref:string;projection_revision:number;
 publisher_identity_ref:string;publisher_participant_ref:string;target_ref:string;target_identity_ref:string;
 consent_ref:string;granted_at:string;granted_at_unix_ms:number;
}
export interface NativePresenceRequest {
 operation:'prepare'|'publish';binding:NativeDialogueRequest;expected_expression_revision:number;publication:PresencePublication;
}
export interface NativePresenceReading {
 schema:'oi.nara-presence/v1';bundle:unknown;publication:unknown|null;
 consent_reading:{permitted:boolean;[key:string]:unknown};private_state_exported:false;
}
export async function nativePresence(transport:KernelTransportStatus,project:string,request:NativePresenceRequest):Promise<NativePresenceReading> {
 const response=await kernelOp(transport,{op:'nara_presence',project,request});
 if(response.error||response.outcome?.result!=='nara_presence')throw Error(response.error??'Native presence did not return a reading.');
 const reading=response.outcome.data;
 if(reading.schema!=='oi.nara-presence/v1'||reading.consent_reading.permitted!==true||reading.private_state_exported!==false)throw Error('Native presence returned an unadmitted reading.');
 return reading;
}
