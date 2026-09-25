import {prepareBlueprintEdit,blueprintReply,type BlueprintIntent,type BlueprintEdit} from './nativeBlueprint.js';
import {prepareOccurrenceEdit,occurrenceReply,type OccurrenceIntent,type DuplicateOccurrenceIntent,type InsertSourceIntent,type OccurrenceEdit} from './nativeOccurrence.js';
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
 | {kind:'file';intent:unknown}
 | {kind:'selection';request:SelectionEdit}
 | {kind:'connections';request:ConnectionEdit}
 | {kind:'occurrence';intent:OccurrenceIntent;request:OccurrenceEdit}
 | {kind:'blueprint';intent:BlueprintIntent;request:BlueprintEdit};
export interface NativeSelection {scene_ref:string;entity_ref?:string|null;binding_ref?:string}
export interface SelectionEdit {operation:'edit';expression_ref:string;expected_revision:number;actor:string;changes:[Record<string,unknown>]}
function selectionEdit(view:KernelConversion,selection:NativeSelection):SelectionEdit {
 const document=view.document,scene=document.scenes.find(s=>s.scene_ref===selection.scene_ref);
 if(!scene)throw new Error('Selection belongs to an absent native Scene');
 const relation=selection.binding_ref?document.relations?.[selection.binding_ref]:undefined;
 if(selection.binding_ref&&(!relation||!scene.entity_refs.includes(relation.from_entity_ref)||!scene.entity_refs.includes(relation.to_entity_ref)))throw new Error('Relation occurrence is not in this native Scene');
 if(selection.entity_ref&&(!scene.entity_refs.includes(selection.entity_ref)||selection.binding_ref))throw new Error('Select one exact entity or relation occurrence');
 const change=relation?{change:'relation_focus',scene_ref:scene.scene_ref,binding_ref:relation.binding_ref}
  :{change:'focus',scene_ref:scene.scene_ref,entity_ref:selection.entity_ref??null};
 return {operation:'edit',expression_ref:document.expression_ref,expected_revision:document.revision,actor:'human:expressions-app',changes:[change]};
}
function selectionMatches(view:KernelConversion,request:SelectionEdit,document:KernelExpressionDocument):boolean {
 const expected=clone(view.document),change=request.changes[0];
 expected.selection={scene_ref:String(change.scene_ref),entity_ref:change.change==='focus'?(change.entity_ref as string|null):null,
  ...(change.change==='relation_focus'?{relation_ref:String(change.binding_ref)}:{})};
 if(document.revision!==expected.revision&&document.revision!==expected.revision+1)return false;
 expected.revision=document.revision;
 return same(expected,document);
}
export interface ConnectionEdit {operation:'edit';expression_ref:string;expected_revision:number;actor:string;changes:Record<string,unknown>[]}
/** Expression connections are local composition bindings. This never edits a
 * source-owned semantic relation or infers Wiki write authority.
 *
 * ES1A/ES1B (O:I #352): the same bounded edit/readback path also carries
 * scene-body and scene-trigger changes (`scene_body_set`/`scene_body_clear`/
 * `scene_trigger_attach`/`scene_trigger_detach`) — the Rust-exact change
 * grammar from kernel/src/expression.rs's `Change` enum. This function name
 * predates that widening; it is kept so every existing call site
 * (`nativeWorkspace.edit`) needs no change. */
function connectionEdit(view:KernelConversion,changes:Record<string,unknown>[]):ConnectionEdit {
 if(!changes.length||changes.length>256)throw new Error('Choose 1–256 native connection changes');
 const request:ConnectionEdit={operation:'edit',expression_ref:view.document.expression_ref,expected_revision:view.document.revision,actor:'human:expressions-app',changes:clone(changes)};
 connectionResult(view,request); // refuse unsupported ownership before dispatch
 return request;
}
const SCENE_CHANGE_KINDS=new Set(['scene_body_set','scene_body_clear','scene_trigger_attach','scene_trigger_detach']);
function connectionResult(view:KernelConversion,request:ConnectionEdit):KernelExpressionDocument {
 const doc=clone(view.document);doc.relations??={};
 const touchedScenes=new Set<string>();
 for(const change of request.changes){
  if(SCENE_CHANGE_KINDS.has(change.change as string)){
   applySceneChange(doc,change,touchedScenes);
   continue;
  }
  // A world-position pin: the exact occurrence keeps its place; this is not
  // blueprint membership and not a lock on its other properties.
  if(change.change==='entity_pin'){
   const ref=change.entity_ref,entity=typeof ref==='string'?doc.entities[ref]:undefined;
   if(!entity||typeof change.pinned!=='boolean')throw new Error('A pin names an existing occurrence and a pinned state');
   if(change.pinned)(entity as {pinned?:boolean}).pinned=true;else delete (entity as {pinned?:boolean}).pinned;
   continue;
  }
  const binding=change.binding as NonNullable<KernelExpressionDocument['relations']>[string]|undefined;
  const ref=change.change==='relation_bind'?binding?.binding_ref:change.binding_ref;
  if(typeof ref!=='string'||!ref.startsWith(doc.expression_ref+':relation:connection-'))throw new Error('Only O:I Expression connections can be edited here');
  const previous=doc.relations[ref];
  if(previous&&previous.native_owner!=='oi')throw new Error('Source relations must be changed through their source owner');
  if(change.change==='relation_bind'){
   if(!binding||binding.native_owner!=='oi'||!binding.relation?.ref.startsWith(ref+':'))throw new Error('Connection binding must identify its O:I owner');
   if(!doc.scenes.some(scene=>scene.entity_refs.includes(binding.from_entity_ref)&&scene.entity_refs.includes(binding.to_entity_ref)))throw new Error('Both connection endpoints must belong to the same native Scene');
   doc.relations[ref]=clone(binding);
  }else if(change.change==='relation_remove'){
   if(!previous)throw new Error('Connection is absent');
   delete doc.relations[ref];
   if(doc.selection?.relation_ref===ref)delete doc.selection.relation_ref;
  }else throw new Error('Only native connection bind/remove/scene-body/scene-trigger changes are admitted by this operation');
 }
 if(!same(doc,view.document)){
  doc.revision++;
  for(const scene of doc.scenes)if(touchedScenes.has(scene.scene_ref))scene.revision=doc.revision;
 }
 kernelDocumentToJourney(doc); // complete binding and membership validation
 return doc;
}
/** ES1A/ES1B change application, mirrored from kernel/src/expression.rs's
 * `Change::SceneBodySet/SceneBodyClear/SceneTriggerAttach/SceneTriggerDetach`
 * handling — a local prediction of the owner's own semantics, so the
 * readback comparison in `editConnections` below stays an honest check
 * rather than a rubber stamp. */
function applySceneChange(doc:KernelExpressionDocument,change:Record<string,unknown>,touchedScenes:Set<string>):void {
 if(change.change==='scene_body_set'||change.change==='scene_body_clear'){
  const sceneRef=change.scene_ref;
  if(typeof sceneRef!=='string'||!sceneRef)throw new Error('Scene body change needs a scene_ref');
  const scene=doc.scenes.find(s=>s.scene_ref===sceneRef);
  if(!scene)throw new Error(`Scene body change names an absent native Scene: ${sceneRef}`);
  scene.body=change.change==='scene_body_set'?clone(change.body as Record<string,unknown>):null;
  touchedScenes.add(sceneRef);
  return;
 }
 if(change.change==='scene_trigger_attach'){
  const sceneRef=change.scene_ref,trigger=change.trigger as {trigger_ref?:unknown}|undefined;
  if(typeof sceneRef!=='string'||!sceneRef)throw new Error('Scene trigger attach needs a scene_ref');
  const scene=doc.scenes.find(s=>s.scene_ref===sceneRef);
  if(!scene)throw new Error(`Scene trigger attach names an absent native Scene: ${sceneRef}`);
  if(!trigger||typeof trigger.trigger_ref!=='string'||!trigger.trigger_ref)throw new Error('Scene trigger attach needs a trigger_ref');
  if(doc.scenes.some(s=>((s.triggers??[]) as {trigger_ref:string}[]).some(t=>t.trigger_ref===trigger.trigger_ref)))throw new Error('Scene trigger already exists');
  scene.triggers=[...((scene.triggers??[]) as unknown[]),clone(trigger)];
  touchedScenes.add(sceneRef);
  return;
 }
 if(change.change==='scene_trigger_detach'){
  const triggerRef=change.trigger_ref;
  if(typeof triggerRef!=='string'||!triggerRef)throw new Error('Scene trigger detach needs a trigger_ref');
  let removed=false;
  for(const scene of doc.scenes){
   const before=((scene.triggers??[]) as {trigger_ref:string}[]);
   const after=before.filter(t=>t.trigger_ref!==triggerRef);
   if(after.length!==before.length){scene.triggers=after;touchedScenes.add(scene.scene_ref);removed=true;}
  }
  if(!removed)throw new Error('Scene trigger is absent');
  return;
 }
}
function connectionView(view:KernelConversion,doc:KernelExpressionDocument):KernelConversion {
 return kernelDocumentToJourney(doc,{identity:{expression:view.journey.id,scenes:Object.fromEntries(Object.entries(view.bindings).map(([id,b])=>[b.scene_ref,id])),entities:view.entity_ids},pages:Object.fromEntries(Object.values(view.bindings).map(b=>[b.scene_ref,b.page]))});
}
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
 const result=value as {state?:string;expression_ref?:string;document?:KernelExpressionDocument}|null;
 if(result?.state==='revision_conflict'&&result.expression_ref===reference)throw new Error('revision_conflict: the native Expression changed; inspect its current basis before trying again');
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
  if(!['create','edit','file','selection','connections','occurrence','blueprint'].includes(pending.kind))throw new Error('Unknown pending native operation');
  if(pending.kind==='create'||pending.kind==='edit'){
   validateJourney(pending.submitted.journey);
   if(pending.submitted.journey.id!==journey.id)throw new Error('Pending proposal belongs to another draft');
  }
  if(pending.kind==='create'&&(!/^expression:[a-zA-Z0-9_.-]{1,128}$/.test(pending.expression_ref)||value.view))throw new Error('Invalid pending creation identity');
  if(pending.kind==='edit'&&(!value.view||pending.request.operation!=='edit'||pending.request.expression_ref!==value.view.document.expression_ref||pending.request.expected_revision!==value.view.document.revision
   ||!same(pending.request,prepareCompositionEdit(value.view,pending.submitted.journey,{sceneId:pending.submitted.sceneId,entityId:pending.submitted.entityId,actor:pending.request.actor}))))throw new Error('The recovered edit does not match its captured basis');
  if(pending.kind==='selection'){
   const change=pending.request?.changes?.[0];
   if(!value.view||!change||!same(pending.request,selectionEdit(value.view,{scene_ref:String(change.scene_ref),entity_ref:change.entity_ref as string|null,binding_ref:change.binding_ref as string|undefined})))throw new Error('Recovered selection does not match its native basis');
  }
  if(pending.kind==='connections'&&(!value.view||!same(pending.request,connectionEdit(value.view,pending.request.changes))))throw new Error('Recovered connection edit does not match its native basis');
  if(pending.kind==='blueprint'&&(!value.view||!same(pending.request,prepareBlueprintEdit(value.view,pending.intent).request)))throw new Error('Recovered blueprint does not match its captured native basis');
  if(pending.kind==='occurrence'&&(!value.view||!same(pending.request,prepareOccurrenceEdit(value.view,pending.intent).request)))throw new Error('Recovered occurrence does not match its captured native basis');
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
 /** Reopen an acknowledged native basis after process restart. Local draft
  * edits and interrupted operations remain recovery data; none is replayed. */
 async reopenCheckpoint(raw:unknown,journey:Journey,accept:()=>boolean=()=>true):Promise<KernelConversion>{
  if(this.inFlight)throw new Error('A native operation is still returning');
  const record=validateWorkingRecord(raw,journey);
  if(!record.view)throw new Error('This draft has no acknowledged native basis to reopen');
  const epoch=++this.epoch;this.inFlight=true;
  try{
   const result=await this.ports.expression({operation:'open',document:record.view.document,actor:'oi:working-draft-recovery'});
   const conflict=result as {state?:string;expression_ref?:string}|null;
   if(conflict?.state==='revision_conflict'&&conflict.expression_ref===record.view.document.expression_ref
    &&!record.pending&&!prepareCompositionEdit(record.view,journey).changes.length){
    // Another aperture may have advanced clean work (including its focus).
    // Read that owner revision; never submit the old document as an edit or
    // rebase unsaved/interrupted material onto an unrelated native basis.
    const document=readDocument(await this.ports.expression({operation:'inspect',expression_ref:record.view.document.expression_ref}),record.view.document.expression_ref);
    const view=connectionView(record.view,document),refreshed={...record,view};
    if(epoch!==this.epoch||!accept())throw new Error('The selected draft changed while recovery was returning; its native basis was not replaced');
    await this.ports.checkpoint(record.draft_id,clone(refreshed));
    if(epoch!==this.epoch||!accept())throw new Error('The selected draft changed while recovery was returning; its native basis was not replaced');
    this.record=refreshed;
    return clone(view);
   }
   const reopened=readDocument(result,record.view.document.expression_ref);
   if(!same(reopened,record.view.document))throw new Error('Native work changed; the recovery draft was retained separately');
   if(epoch!==this.epoch||!accept())throw new Error('The selected draft changed while recovery was returning; its native basis was not replaced');
   this.record=record;
   return {...clone(record.view),journey:clone(journey)};
  }finally{this.inFlight=false;}
 }
 async adopt(document:KernelExpressionDocument,file?:NativeFile,accept:()=>boolean=()=>true):Promise<KernelConversion>{
  if(this.inFlight)throw new Error('A native operation is still returning; the current draft is retained');
  const epoch=++this.epoch,view=kernelDocumentToJourney(document);
  const record:NativeWorkingRecord={schema:'oi.native-working/v1',draft_id:view.journey.id,view,...(file?{file}: {})};
  validateWorkingRecord(record,view.journey);
  this.inFlight=true;
  try{
   await this.ports.checkpoint(record.draft_id,clone(record));
   // Returning durable data is not permission to replace the selected work.
   // Check before changing the basis, so a later navigation needs no rollback.
   if(epoch!==this.epoch||!accept())throw new Error('The selected draft changed while opening; its native basis was not replaced');
   this.record=clone(record);return view;
  }finally{this.inFlight=false;}
 }
 /** Adopt a newer owner revision of the SAME Expression (advanced by another
  * native owner operation, e.g. a constellation re-projection) only while
  * this draft is clean: nothing pending and no local changes. Unsaved work is
  * never rebased; the caller is told the draft was kept. */
 async advanceClean(journey:Journey,accept:()=>boolean=()=>true):Promise<KernelConversion|null>{
  const record=this.record;
  if(!record?.view)throw new Error('No native work is open');
  if(record.pending||prepareCompositionEdit(record.view,journey).changes.length)return null;
  const epoch=this.begin();
  try{
   const document=readDocument(await this.ports.expression({operation:'inspect',expression_ref:record.view.document.expression_ref}),record.view.document.expression_ref);
   if(document.revision<=record.view.document.revision)return clone(record.view);
   const view=connectionView(record.view,document);
   if(epoch!==this.epoch||!accept())throw new Error('The work changed while the newer native revision was returning; its basis was kept');
   await this.persist({...record,view},epoch);
   return clone(view);
  }finally{this.inFlight=false;}
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
 /** Selection edits only the native focus and acknowledged revision. It never
  * commits the human's unsaved material, discloses it to an Agent, or remounts
  * the current physical field. */
 async select(selection:NativeSelection):Promise<void>{
  const epoch=this.begin();
  try{
   let record=this.record?clone(this.record):undefined;
   if(!record?.view)throw new Error('This representation has no native working basis');
   if(record.pending)throw new Error('Inspect the interrupted native operation before changing its focus');
   const request=selectionEdit(record.view,selection),change=request.changes[0],selected=record.view.document.selection;
   if(selected&&selected.scene_ref===change.scene_ref&&((change.change==='relation_focus'&&selected.relation_ref===change.binding_ref)||(change.change==='focus'&&!selected.relation_ref&&selected.entity_ref===change.entity_ref)))return;
   record={...record,pending:{kind:'selection',request}};
   await this.persist(record,epoch);
   const document=readDocument(await this.ports.expression({...request}),request.expression_ref);
   if(!selectionMatches(record.view!,request,document))throw new Error('Native selection reply changed more than its captured focus; preserve and reconcile');
   await this.persist({...record,view:rebaseCompositionView(record.view!,record.view!.journey,document),pending:undefined},epoch);
  }finally{this.inFlight=false;}
 }
 async editBlueprint(intent:BlueprintIntent):Promise<KernelConversion>{
  const epoch=this.begin();
  try{
   const record=this.record?clone(this.record):undefined;
   if(!record?.view)throw Error('Open a native Expression before applying a blueprint');
   if(record.pending)throw Error('Inspect the interrupted native operation before changing the blueprint');
   const {request,expected}=prepareBlueprintEdit(record.view,intent);
   if(same(expected,record.view.document))return clone(record.view);
   await this.persist({...record,pending:{kind:'blueprint',intent:clone(intent),request}},epoch);
   const reply=readDocument(await this.ports.expression({...request}),request.expression_ref);
   blueprintReply(record.view,intent,reply);
   const observed=readDocument(await this.ports.expression({operation:'inspect',expression_ref:request.expression_ref}),request.expression_ref);
   const view=blueprintReply(record.view,intent,observed);
   await this.persist({...record,view,pending:undefined},epoch);return view;
  }finally{this.inFlight=false;}
 }
 /** Exact native connection edit with durable intent and independent readback. */
 async editConnections(changes:Record<string,unknown>[]):Promise<KernelConversion>{
  const epoch=this.begin();
  try{
   const record=this.record?clone(this.record):undefined;
   if(!record?.view)throw new Error('Open a native Expression before editing its connections');
   if(record.pending)throw new Error('Inspect the interrupted native operation before editing connections');
   const request=connectionEdit(record.view,changes),expected=connectionResult(record.view,request);
   if(same(expected,record.view.document))return clone(record.view);
   await this.persist({...record,pending:{kind:'connections',request}},epoch);
   const reply=readDocument(await this.ports.expression({...request}),request.expression_ref);
   if(!same(reply,expected))throw new Error('Native connection acknowledgement differs from the captured edit; inspect before retrying');
   const observed=readDocument(await this.ports.expression({operation:'inspect',expression_ref:request.expression_ref}),request.expression_ref);
   if(!same(observed,expected))throw new Error('Native connection readback changed; preserve the pending edit and reconcile');
   const view=connectionView(record.view,observed);
   await this.persist({...record,view,pending:undefined},epoch);
   return view;
  }finally{this.inFlight=false;}
 }
 /** Duplicate one native source occurrence with durable intent and exact readback. */
 async duplicateOccurrence(intent:DuplicateOccurrenceIntent):Promise<KernelConversion>{return this.editOccurrence(intent);}
 async insertSource(intent:InsertSourceIntent):Promise<KernelConversion>{return this.editOccurrence(intent);}
 private async editOccurrence(intent:OccurrenceIntent):Promise<KernelConversion>{
  const epoch=this.begin();
  try{
   const record=this.record?clone(this.record):undefined;
   if(!record?.view)throw new Error('Open a native Expression before duplicating an occurrence');
   if(record.pending)throw new Error('Inspect the interrupted native operation before duplicating');
   const captured=clone(intent),{request}=prepareOccurrenceEdit(record.view,captured);
   await this.persist({...record,pending:{kind:'occurrence',intent:captured,request}},epoch);
   const reply=readDocument(await this.ports.expression({...request}),request.expression_ref);
   occurrenceReply(record.view,captured,reply);
   const observed=readDocument(await this.ports.expression({operation:'inspect',expression_ref:request.expression_ref}),request.expression_ref);
   const view=occurrenceReply(record.view,captured,observed);
   await this.persist({...record,view,pending:undefined},epoch);
   return view;
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
   if(pending.kind==='blueprint'){
    if(same(doc,record.view!.document)){await this.persist({...record,pending:undefined},epoch);return 'The blueprint edit was not applied. No write was replayed.';}
    const view=blueprintReply(record.view!,pending.intent,doc);
    await this.persist({...record,view,pending:undefined},epoch);
    return 'Recovered the exact native blueprint without replaying its edit.';
   }
   if(pending.kind==='occurrence'){
    if(same(doc,record.view!.document)){await this.persist({...record,pending:undefined},epoch);return 'The native duplicate was not applied. No write was replayed.';}
    const view=occurrenceReply(record.view!,pending.intent,doc);
    await this.persist({...record,view,pending:undefined},epoch);
    return 'Recovered the exact native occurrence without duplicating it again or replacing newer local work.';
   }
   if(pending.kind==='connections'){
    if(same(doc,record.view!.document)){
     await this.persist({...record,pending:undefined},epoch);return 'The native connection edit was not applied. No write was replayed.';
    }
    if(!same(doc,connectionResult(record.view!,pending.request)))throw new Error('revision_conflict: native connections differ from the captured edit; preserve and reconcile');
    await this.persist({...record,view:connectionView(record.view!,doc),pending:undefined},epoch);
    return 'Recovered the exact native connection edit without replaying it or replacing newer local work.';
   }
   if(pending.kind==='selection'){
    if(same(doc,record.view!.document)){
     await this.persist({...record,pending:undefined},epoch);return 'The native selection did not change. No write was replayed.';
    }
    if(!selectionMatches(record.view!,pending.request,doc))throw new Error('revision_conflict: the native selection basis changed; inspect and reconcile');
    await this.persist({...record,view:rebaseCompositionView(record.view!,record.view!.journey,doc),pending:undefined},epoch);
    return 'Recovered the exact native selection without replaying it or replacing newer local work.';
   }
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
