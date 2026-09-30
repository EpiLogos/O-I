/** Source-qualified scene bodies over the existing Central file owner.
 * Central's root/path remain a file location, never an invented World ID. */
import {nativeSubjectTextRequest,nativeSubjectBytesRequest,type NativeSubjectText,type NativeSubjectBytes} from './kernelExpressions.js';
import type {KernelSceneBody,KernelTextSpan} from './kernelDocumentBridge.js';

type Reading=NativeSubjectText|NativeSubjectBytes;
export function validateNativeBodyReading(reading:Reading,ref:string,expectedRevision?:string):void {
 if(reading.ref!==ref||reading.location?.ref!==ref||reading.location.schema!=='central.path-ref/v1'||!reading.location.root||!reading.location.path||reading.native_owner!=='central')throw Error('The native source owner returned another or unqualified file location.');
 if(!reading.revision||!Number.isSafeInteger(reading.byte_len)||reading.byte_len<0)throw Error('The native source owner returned no valid revision.');
 if(expectedRevision!==undefined&&reading.revision!==expectedRevision)throw Error('This scene body source has changed. Review and explicitly adopt its current revision.');
}
export function bodyFromNativeReading(carrier:'text_source'|'image_media',reading:Reading,span:KernelTextSpan|null=null):KernelSceneBody {
 validateNativeBodyReading(reading,reading.ref);
 if(carrier==='text_source'){
  if(!('content' in reading))throw Error('Text scene bodies require the native text reading.');
  if(span&&(!Number.isSafeInteger(span.start)||!Number.isSafeInteger(span.end)||span.start<0||span.end<=span.start||span.end>[...reading.content].length))throw Error('The selected span must lie within the current source text.');
 }else{
  if(!('content_base64' in reading)||!reading.mime_hint?.startsWith('image/'))throw Error('This carrier requires an image admitted by the native MIME reading.');
  if(span)throw Error('Image scene bodies do not accept text spans.');
 }
 const basis={ref:reading.ref,revision:reading.revision,availability:'available' as const};
 return {carrier,subject_ref:reading.ref,native_owner:'central',reading:basis,provenance:[basis],actions:[],presentation:'inline',capability:{state:'renderable'},span,recursion:null};
}
export async function prepareNativeSceneBody(carrier:'text_source'|'image_media',ref:string,span:KernelTextSpan|null=null):Promise<KernelSceneBody>{
 const reading=carrier==='text_source'?await nativeSubjectTextRequest(ref):await nativeSubjectBytesRequest(ref);
 if(reading.requested_ref!==ref)throw Error('The native file reading does not answer the requested source.');
 validateNativeBodyReading(reading,reading.ref);
 return bodyFromNativeReading(carrier,reading,span);
}
