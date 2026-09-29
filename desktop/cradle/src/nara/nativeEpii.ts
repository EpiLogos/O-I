import {kernelOp} from '../kernel/bridge';
import type {KernelTransportStatus} from '../kernel/types';
import type {NativeEpiiRequest,NativeEpiiResult} from './epiiTypes';
/** No caller-supplied model answer, context, registry, profile or Change is
 * admitted. The native owner rereads the original completed turn on accept. */
export async function nativeEpii(transport:KernelTransportStatus,project:string,request:NativeEpiiRequest):Promise<NativeEpiiResult>{
 const response=await kernelOp(transport,{op:'nara_epii',project,request});
 if(response.error||response.outcome?.result!=='nara_epii')throw Error(response.error??'The native Epii review owner did not answer.');
 const result=response.outcome.data;
 const expected={delegate:'oi.nara-epii-delegation/v1',inspect:'oi.nara-epii-review/v1',accept:'oi.nara-epii-accepted/v1'}[request.operation];
 if(result.schema!==expected)throw Error('The native owner returned a different Epii operation.');
 return result;
}
