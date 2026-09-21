/** Retained native basis for the existing authoring draft. Every semantic
 * mutation and durable file save crosses existing owner operations. Recovery
 * shares the existing draft DB, separately from the exportable Journey. */
import {sameSceneData} from './sceneCorrespondence.js';
import {clone,validateJourney,type Journey} from './model.js';
import {kernelDocumentToJourney,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge.js';
import {prepareCompositionEdit,acceptCompositionReply,rebaseCompositionView,type CompositionEdit} from './kernelComposition.js';
export interface WorkingSnapshot {journey:Journey;sceneId:string;entityId:string|null}
export interface NativeFile {location:{schema:'central.path-ref/v1';ref:string;root:string;path:string};revision:string;expression_ref:string}
export type SaveDestination={parent_path:string;name:string}|{location:NativeFile['location'];revision:string};
export type PendingNative =
 | {kind:'create';expression_ref:string;submitted:WorkingSnapshot}
 | {kind:'edit';request:CompositionEdit;submitted:WorkingSnapshot}
 | {kind:'file';intent:unknown};
export interface NativeWorkingRecord {
 schema:'oi.native-working/v1';draft_id:string;view?:KernelConversion;file?:NativeFile;pending?:PendingNative;
}
export interface NativeWorkingPorts {
 expression:(request:Record<string,unknown>)=>Promise<unknown>;
 file:(request:Record<string,unknown>)=>Promise<unknown>;
 checkpoint:(draftId:string,record:NativeWorkingRecord)=>Promise<void>;
 mint:()=>string;
}
const same=sameSceneData;
function readDocument(value:unknown,reference:string):KernelExpressionDocument {
 const result=value as {state?:string;document?:KernelExpressionDocument}|null;
 if(result?.state!=='ready'||result.document?.expression_ref!==reference)throw new Error('The native owner did not return the addressed Expression');
 return kernelDocumentToJourney(result.document).document;
}
function artifact(value:unknown,reference:string):NativeFile {
 const result=value as {document?:KernelExpressionDocument;file?:NativeFile}|null,file=result?.file;
 if(result?.document?.expression_ref!==reference||file?.location?.schema!=='central.path-ref/v1'
  ||!file.location.ref||!file.location.root||!file.location.path||!file.revision)throw new Error('The owner did not confirm the exact native file and revision');
 return {location:clone(file.location),revision:file.revision,expression_ref:reference};
}
function firstView(document:KernelExpressionDocument,snapshot:WorkingSnapshot):KernelConversion {
 if(document.revision!==1||Object.keys(document.entities).length||Object.keys(document.relations??{}).length||document.scenes.length!==1||document.title!==snapshot.journey.name)throw new Error('The created native Expression has already changed; reconcile it before composing');
 return kernelDocumentToJourney(document,{identity:{expression:snapshot.journey.id,scenes:{[document.scenes[0].scene_ref]:snapshot.journey.scenes[0].id}}});
}
/** Lost CAS replies are recovered only from the exact intended result, not
 * merely from a higher revision, routing receipt or matching title. */
function editMatches(record:NativeWorkingRecord,request:CompositionEdit,submitted:WorkingSnapshot,doc:KernelExpressionDocument):boolean {
 if(!record.view||doc.revision!==request.expected_revision+1)return false;
 const basis=record.view.document;
 if(!same(doc.relations??{},basis.relations??{})||!same(doc.provenance,basis.provenance))return false;
 for(const [ref,entity]of Object.entries(basis.entities))if(!same(doc.entities[ref],entity))return false;
 try{
  const view=rebaseCompositionView(record.view,submitted.journey,doc);
  return prepareCompositionEdit(view,submitted.journey,{sceneId:submitted.sceneId,entityId:submitted.entityId}).changes.length===0;
 }catch{return false;}
}
/** Checkpoint data is validated through actual import and action laws. */
export function validateWorkingRecord(raw:unknown,journey:Journey):NativeWorkingRecord {
 const value=clone(raw) as NativeWorkingRecord;
 if(value?.schema!=='oi.native-working/v1'||value.draft_id!==journey.id)throw new Error('Recovery belongs to a different authoring draft');
 validateJourney(journey);
 if(value.view){
  const view=value.view;
  validateJourney(view.journey);
  if(view.journey.id!==journey.id)throw new Error('Native recovery identity disagrees with its draft');
  const scenes=Object.fromEntries(Object.entries(view.bindings).map(([id,b])=>[b.scene_ref,id]));
  const pages=Object.fromEntries(Object.values(view.bindings).map(b=>[b.scene_ref,b.page]));
  value.view=kernelDocumentToJourney(view.document,{identity:{expression:journey.id,scenes,entities:view.entity_ids},pages});
 }
 if(value.file){
  artifact({document:value.view?.document,file:value.file},value.file.expression_ref);
  if(value.file.expression_ref!==value.view?.document.expression_ref)throw new Error('Recovered file points to another work');
 }
 if(value.pending){
  const pending=value.pending;
  if(!['create','edit','file'].includes(pending.kind))throw new Error('Unknown pending native operation');
  if(pending.kind==='create'||pending.kind==='edit'){
   validateJourney(pending.submitted.journey);
   if(pending.submitted.journey.id!==journey.id)throw new Error('Pending proposal belongs to another draft');
  }
  if(pending.kind==='create'&&(!/^expression:[a-zA-Z0-9_.-]{1,128}$/.test(pending.expression_ref)||value.view))throw new Error('Invalid pending creation identity');
  if(pending.kind==='edit'&&(!value.view||pending.request.operation!=='edit'||pending.request.expression_ref!==value.view.document.expression_ref||pending.request.expected_revision!==value.view.document.revision
   ||!same(pending.request,prepareCompositionEdit(value.view,pending.submitted.journey,{sceneId:pending.submitted.sceneId,entityId:pending.submitted.entityId,actor:pending.request.actor}))))throw new Error('The recovered edit does not match its captured basis');
  if(pending.kind==='file'&&!value.view)throw new Error('A file-save checkpoint requires a native basis');
 }
 return value;
}
export class NativeWorking {
 private record?:NativeWorkingRecord;
 private epoch=0;
 private inFlight=false;
 constructor(private readonly ports:NativeWorkingPorts){}
 get state():NativeWorkingRecord|undefined{return this.record?clone(this.record):undefined;}
 get busy():boolean{return this.inFlight;}
 /** Late results are checkpointed for the old work, never adopted into a
  * newly selected inquiry. Navigation does not cancel an authorised act. */
 detach():void{this.epoch++;this.record=undefined;}
 restore(raw:unknown,journey:Journey):void{this.epoch++;this.record=validateWorkingRecord(raw,journey);}
 async adopt(document:KernelExpressionDocument,file?:NativeFile):Promise<KernelConversion>{
  if(this.inFlight)throw new Error('A native operation is still returning; the current draft is retained');
  const epoch=++this.epoch,view=kernelDocumentToJourney(document);
  const record:NativeWorkingRecord={schema:'oi.native-working/v1',draft_id:view.journey.id,view,...(file?{file}: {})};
  validateWorkingRecord(record,view.journey);
  await this.persist(record,epoch);return view;
 }
 private async persist(record:NativeWorkingRecord,epoch:number):Promise<void>{
  await this.ports.checkpoint(record.draft_id,clone(record));
  if(epoch===this.epoch)this.record=clone(record);
 }
 private begin():number{if(this.inFlight)throw new Error('A native operation is already in flight');this.inFlight=true;return this.epoch;}
 async commit(snapshot:WorkingSnapshot):Promise<KernelExpressionDocument>{
  const epoch=this.begin(),submitted=clone(snapshot);
  try{
   validateJourney(submitted.journey);
   if(!submitted.journey.name.trim())throw new Error("Give the native composition a nonempty title before saving");
   let record:NativeWorkingRecord=this.record?clone(this.record):{schema:'oi.native-working/v1',draft_id:submitted.journey.id};
   if(record.draft_id!==submitted.journey.id)throw new Error('Select the native basis of this draft before saving');
   if(record.pending)throw new Error('Inspect the interrupted native operation before saving again');
   if(!record.view){
    const expression_ref=this.ports.mint();
    if(!/^expression:[a-zA-Z0-9_.-]{1,128}$/.test(expression_ref))throw new Error('Native creation needs a stable safe Expression identity');
    record={...record,pending:{kind:'create',expression_ref,submitted}};
    await this.persist(record,epoch); // storage failure means no native effect
    const document=readDocument(await this.ports.expression({operation:'create',expression_ref,title:submitted.journey.name,actor:'human:expressions-app'}),expression_ref);
    record={...record,view:firstView(document,submitted),pending:undefined};
    await this.persist(record,epoch);
   }
   const view=record.view!;
   const request=prepareCompositionEdit(view,submitted.journey,{sceneId:submitted.sceneId,entityId:submitted.entityId});
   if(!request.changes.length)return clone(view.document);
   record={...record,pending:{kind:'edit',request,submitted}};
   await this.persist(record,epoch);
   const document=acceptCompositionReply(request,await this.ports.expression({...request}));
   if(!editMatches(record,request,submitted,document))throw new Error('Native acknowledgement does not contain the submitted composition; inspect before retrying');
   record={...record,view:rebaseCompositionView(view,submitted.journey,document),pending:undefined};
   await this.persist(record,epoch);
   return document;
  }finally{this.inFlight=false;}
 }
 async saveFile(snapshot:WorkingSnapshot,destination:SaveDestination):Promise<NativeFile>{
  const document=await this.commit(snapshot),epoch=this.begin();
  try{
   let record=this.record?clone(this.record):undefined;
   if(!record?.view||record.view.document.expression_ref!==document.expression_ref||record.draft_id!==snapshot.journey.id)throw new Error('The working position changed before file save; nothing was written to a different work');
   const intent=await this.ports.file({operation:'prepare',document,destination:record.file?{location:record.file.location,revision:record.file.revision}:destination});
   record={...record,pending:{kind:'file',intent}};
   await this.persist(record,epoch);
   const result=await this.ports.file({operation:'perform',intent}),file=artifact(result,document.expression_ref);
   await this.persist({...record,file,pending:undefined},epoch);
   return file;
  }finally{this.inFlight=false;}
 }
 async retryFile():Promise<NativeFile>{
  const epoch=this.begin();
  try{
   const record=this.record?clone(this.record):undefined;
   if(record?.pending?.kind!=='file'||!record.view)throw new Error('There is no exact file-save operation to retry');
   const result=await this.ports.file({operation:'perform',intent:record.pending.intent});
   const file=artifact(result,record.view.document.expression_ref);
   await this.persist({...record,file,pending:undefined},epoch);return file;
  }finally{this.inFlight=false;}
 }
 async inspectPending():Promise<string>{
  const epoch=this.begin();
  try{
   const record=this.record?clone(this.record):undefined,pending=record?.pending;
   if(!record||!pending)throw new Error('There is no interrupted native operation');
   if(pending.kind==='file'){
    const response=await this.ports.file({operation:'inspect',intent:pending.intent}) as {state?:string;artifact?:unknown;detail?:string};
    if(response.state!=='saved')throw new Error(response.detail??'The intended file is not verified; retain the exact save proposal');
    const file=artifact(response.artifact,record.view!.document.expression_ref);
    await this.persist({...record,file,pending:undefined},epoch);
    return 'Recovered the exact saved file without replaying its write.';
   }
   const reference=pending.kind==='create'?pending.expression_ref:pending.request.expression_ref;
   const doc=readDocument(await this.ports.expression({operation:'inspect',expression_ref:reference}),reference);
   if(pending.kind==='create'){
    const view=firstView(doc,pending.submitted);
    await this.persist({...record,view,pending:undefined},epoch);
    return 'Recovered the created native identity. Your material draft is unchanged; save it when ready.';
   }
   if(same(doc,record.view!.document)){
    await this.persist({...record,pending:undefined},epoch);
    return 'The native edit was not applied. Your draft remains available for an explicit save.';
   }
   if(!editMatches(record,pending.request,pending.submitted,doc))throw new Error('revision_conflict: the native work differs from the pending proposal; preserve and reconcile it, do not silently retry');
   await this.persist({...record,view:rebaseCompositionView(record.view!,pending.submitted.journey,doc),pending:undefined},epoch);
   return 'Recovered the composition without replaying an edit or replacing newer local work.';
  }finally{this.inFlight=false;}
 }
}
