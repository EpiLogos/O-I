/** Source-qualified scene bodies over the existing Central file owner, and
 * a knowledge whole over the wiki's own reading of it (O-I #768).
 * Central's root/path remain a file location, never an invented World ID. */
import {nativeSubjectTextRequest,nativeSubjectBytesRequest,nativeKnowledgeWholeRequest,type NativeSubjectText,type NativeSubjectBytes,type NativeKnowledgeWhole} from './kernelExpressions.js';
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
/** O-I #768: a scene made of a constellation (DLW §16.5 "A clip's source is its constellation"; §20.1 the scene's Constellation): its body
 * is the knowledge whole, placed from the wiki's own reading of it (the subject reading the wiki projection binds the whole's entity to,
 * techne/wikiExpression.ts, with the readings it was observed through as provenance). No renderer draws a constellation inside a scene,
 * so the body says so and is drawn as its Thing (sceneBodies.ts planBody → the card), never a fabricated renderer. An answer about
 * another whole, or one with no owner or revision, is refused. Pure. */
export function bodyFromKnowledgeWhole(whole:NativeKnowledgeWhole,ref:string):KernelSceneBody{
 if(whole.requested_ref!==ref||whole.ref!==ref||whole.reading?.ref!==ref)throw Error('The wiki answered about another constellation than the one requested.');
 if(typeof whole.native_owner!=='string'||!whole.native_owner.trim())throw Error('The wiki returned an unqualified reading: it names no owner.');
 if(typeof whole.reading.revision!=='string'||!whole.reading.revision)throw Error('The wiki returned no valid revision for this constellation.');
 if(!Array.isArray(whole.provenance)||whole.provenance.length>256)throw Error('The wiki returned an unqualified reading: its provenance is not a bounded list.');
 const title=typeof whole.title==='string'&&whole.title.trim()?whole.title.trim().slice(0,200):ref;
 const reason=`${title}: a constellation of the wiki. No renderer draws a constellation inside a scene, so the scene shows it as its Thing.`;
 return {carrier:'knowledge_whole',subject_ref:ref,native_owner:whole.native_owner,reading:{...whole.reading},provenance:whole.provenance.map(row=>({...row})),
  actions:[],presentation:'preview',capability:{state:'degrades_to_thing',reason},span:null,recursion:null};
}
export async function prepareNativeSceneBody(carrier:'text_source'|'image_media'|'knowledge_whole',ref:string,span:KernelTextSpan|null=null):Promise<KernelSceneBody>{
 if(carrier==='knowledge_whole'){
  if(span)throw Error('A knowledge whole takes no text span.');
  return bodyFromKnowledgeWhole(await nativeKnowledgeWholeRequest(ref),ref);
 }
 const reading=carrier==='text_source'?await nativeSubjectTextRequest(ref):await nativeSubjectBytesRequest(ref);
 if(reading.requested_ref!==ref)throw Error('The native file reading does not answer the requested source.');
 validateNativeBodyReading(reading,reading.ref);
 return bodyFromNativeReading(carrier,reading,span);
}
