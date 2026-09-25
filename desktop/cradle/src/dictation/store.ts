/** Desktop-owned dictation configuration is native-owned. Browser storage is
 * no longer an authority (the conformance commission supersedes the former
 * localStorage placement in NARA-SPEECH-EXPERIENCE-V1, not its local-only law). */
import {detectTransport,kernelOp} from "../kernel/bridge";
import type {DictationStipulation,KernelTransportStatus} from "../kernel/types";
export type {DictationStipulation};
export const DEFAULT_STT_URL="http://127.0.0.1:8080/inference";
export async function readDictationStipulation(transport:KernelTransportStatus=detectTransport()):Promise<DictationStipulation>{
 const result=await kernelOp(transport,{op:"dictation_read"});
 if(result.outcome?.result!=="dictation_reading")throw Error(result.error??"Native dictation configuration is unavailable");
 return result.outcome.stipulation;
}
export async function writeSttUrl(stt_url:string,transport:KernelTransportStatus=detectTransport()):Promise<DictationStipulation>{
 const current=await readDictationStipulation(transport);
 const result=await kernelOp(transport,{op:"dictation_configure",stt_url,expected_revision:current.revision});
 if(result.outcome?.result!=="dictation_reading")throw Error(result.error??"Native dictation configuration was not saved");
 return result.outcome.stipulation;
}
