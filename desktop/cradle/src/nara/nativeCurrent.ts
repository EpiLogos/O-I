/** Native contextual reading; this module contains no field calculation. */
import type {NativeDialogueRequest} from './dialogueTypes';
import type {PersonalCurrentContext} from './dialogueContext';
import type {PersonalCurrentReading,SkyRequest} from './identity/types';
export type NativeCurrentRequest=
 |{operation:'pin';binding:NativeDialogueRequest;sky_request:SkyRequest}
 |{operation:'read';binding:NativeDialogueRequest};
export interface NativeCurrentReading {
 schema:'oi.nara-personal-current-context/v1';
 nara_ref:string;expression_ref:string;expression_revision:number;
 status:'available'|'absent';context:PersonalCurrentContext|null;reading:PersonalCurrentReading|null;
 private:true;public_export:false;
}
