import {worldRequest} from '../worldChannel.js';
import type {KernelExpressionDocument} from '../kernelDocumentBridge.js';

export interface NativeActSelection {
 expected_act_revision:number;edition_position:number;scene_ref:string;
 expected_expression_revision:number;expected_scene_revision:number;performance_digest:string;
}
export interface RetainedPerformanceAct {
 act_ref:string;selection:NativeActSelection;document:KernelExpressionDocument;
 performance_ref:string;checkpoint_index:number;
}
type Act={act_ref:string;expression_ref:string;revision:number;phase:string;position:number|null;material_contract:string;sequence:unknown[]};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const revision=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>0;
const ref=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=4096&&!/[\u0000-\u001f\u007f]/.test(v);
function performance(document:KernelExpressionDocument,scene_ref:string){
 const scene=document.scenes.find(row=>row.scene_ref===scene_ref),value=scene?.performance as {performance_ref?:string;content_digest?:string;checkpoints?:unknown[]}|undefined;
 if(!scene||!revision(scene.revision)||!value||!ref(value.performance_ref)||!ref(value.content_digest)||!Array.isArray(value.checkpoints)||!value.checkpoints.length)throw Error('Retain the actual stopped native performance checkpoint before its Act edition.');
 return{scene,value,performance_ref:value.performance_ref,content_digest:value.content_digest,checkpoint_index:value.checkpoints.length-1};
}
function actualAct(raw:any,act_ref:string,expression_ref:string):Act {
 const act=raw?.act;
 if(!act||act.act_ref!==act_ref||act.expression_ref!==expression_ref||!revision(act.revision)||act.material_contract!=='oi.expression-act-material/v2'||!Array.isArray(act.sequence)||!['running','held'].includes(act.phase))throw Error('The actual retained performance Act is unavailable, ended, foreign or stale.');
 return act;
}

/** Ordinary SAME-store native Act operations, outside the audio callback.
 * The stable name is explicitly authored identity policy, not a Source grant.
 * The native owner retains complete original pages/Return/checkpoints. */
export class NativePerformanceActs {
 private currentOperation:{request:Record<string,unknown>;reply?:unknown;failure?:string;expected_document?:KernelExpressionDocument}|null=null;
 private unresolvedMutation:NonNullable<NativePerformanceActs['currentOperation']>|null=null;
 private completedReferences:Record<string,unknown>[]=[];
 private intentDocument:KernelExpressionDocument|null=null;
 private failure:string|null=null;
 private retained:RetainedPerformanceAct|null=null;
 get needsReconciliation(){return this.failure!==null||this.unresolvedMutation!==null;}
 inspect(){
  const selected=this.retained;
  return structuredClone({retained:selected?{act_ref:selected.act_ref,selection:selected.selection,performance_ref:selected.performance_ref,checkpoint_index:selected.checkpoint_index,document_ref:{expression_ref:selected.document.expression_ref,revision:selected.document.revision}}:null,
   current_operation:this.currentOperation,unresolved_mutation:this.unresolvedMutation,completed_references:this.completedReferences,failure:this.failure,
   resident_policy:{maximum_completed_references:32,maximum_full_operation_rows:2,history_owner:'native-ActStore'},standing:'Current original operation and unresolved mutation custody; historical full Editions are read from the native Act store.'});
 }
 private rememberReference(row:NonNullable<NativePerformanceActs['currentOperation']>){
  const reply=row.reply as any,act=reply?.act,doc=reply?.document;
  const scalar=(value:unknown)=>typeof value==='string'&&value.length<=4096?value:typeof value==='number'&&Number.isSafeInteger(value)?value:null;
  const reference={operation:scalar(row.request.operation),act_ref:scalar(row.request.act_ref??act?.act_ref??reply?.act_ref),
   expression_ref:scalar(row.request.expression_ref??act?.expression_ref??doc?.expression_ref),
   state:scalar(reply?.state),act_revision:scalar(act?.revision??reply?.act_revision),edition_position:scalar(act?.position??reply?.position),document_revision:scalar(doc?.revision??row.request.expected_revision),failed:row.failure!==undefined};
  this.completedReferences.push(reference);if(this.completedReferences.length>32)this.completedReferences.shift();
 }
 private async request(request:Record<string,unknown>,expectedDocument?:KernelExpressionDocument){
  const mutation=request.operation==='act_retained_perform'||request.operation==='act_interrupt';
  if(mutation&&this.unresolvedMutation)throw Error('The original native Act mutation requires actual same-store Edition reconciliation before another mutation.');
  const row:NonNullable<NativePerformanceActs['currentOperation']>={request:structuredClone(request)};
  this.currentOperation=row;
  if(mutation){const document=expectedDocument??this.intentDocument;if(!document)throw Error('The actual whole native Edition is absent at its Act mutation boundary.');row.expected_document=document;this.unresolvedMutation=row;}
  try{const reply=await worldRequest<any>(request as {operation:string;[key:string]:unknown},90000);row.reply=reply;this.rememberReference(row);return reply;}
  catch(error){row.failure=String(error);this.rememberReference(row);throw error;}
 }
 private settleNativeMutation(act:Act,document:KernelExpressionDocument){
  const original=this.unresolvedMutation;if(!original)return;
  if(original.request.act_ref!==act.act_ref||!original.expected_document||!same(original.expected_document,document))throw Error('The original unknown native Act effect differs from this actual store Edition; its complete custody is preserved.');
  if(original.request.operation==='act_interrupt'&&act.phase!=='held')throw Error('The original native hold has no actual held store acknowledgement.');
  this.unresolvedMutation=null;
 }
 private async inspectAct(act_ref:string,expression_ref:string):Promise<Act|null>{
  const reply=await this.request({operation:'act_retained_inspect',act_ref});
  if(reply?.state==='unknown_act'&&reply.act_ref===act_ref)return null;
  if(reply?.state!=='act_retained')throw Error('The native Act inspection has no current retained owner.');
  return actualAct(reply,act_ref,expression_ref);
 }
 private async edition(act:Act,position:number):Promise<KernelExpressionDocument>{
  if(!Number.isSafeInteger(position)||position<0||position>=act.sequence.length)throw Error('The actual retained Act has no selected native edition.');
  const reply=await this.request({operation:'act_retained_edition',act_ref:act.act_ref,expected_act_revision:act.revision,position});
  if(reply?.state!=='act_retained_edition'||reply.material_contract!=='oi.expression-act-material/v2'||reply.act_ref!==act.act_ref||reply.act_revision!==act.revision||reply.position!==position||reply.document?.expression_ref!==act.expression_ref||!revision(reply.document?.revision))throw Error('The original full retained Edition readback differs from its native Act CAS.');
  return reply.document;
 }
 private async hold(act:Act,actor:string,document:KernelExpressionDocument):Promise<Act>{
  if(act.phase==='held')return act;
  const reply=await this.request({operation:'act_interrupt',act_ref:act.act_ref,actor,reason:'Retain the stopped physical-musical performance for Save and continuation.'},document);
  if(reply?.state!=='act_held')throw Error('The retained native Act did not acknowledge its stopped hold.');
  const held=actualAct(reply,act.act_ref,act.expression_ref);
  if(held.phase!=='held'||held.position!==act.position||held.sequence.length!==act.sequence.length)throw Error('The native Act hold changed the selected performance edition.');
  return held;
 }
 /** Invoke after SAME controller DeviceStop/SaveCut, before ordinary FileSave.
  * Same ScenePerformanceSet is a real nonempty native transaction. Native
  * Document::edited leaves an exactly unchanged typed Document unchanged;
  * require the whole returned edition equal, never guess a revision. */
 async retain(document:KernelExpressionDocument,scene_ref:string,actor:string,current:()=>boolean):Promise<RetainedPerformanceAct>{
  if(!current()||!ref(actor)||document.selection?.scene_ref!==scene_ref)throw Error('The actual selected native performance changed before Act retention.');
  const original=structuredClone(document),source=performance(original,scene_ref);
  const act_ref=`act:physical-musical:${source.performance_ref}`;
  if(!ref(act_ref))throw Error('The authored performance Act identity exceeds the native reference bound.');
  this.intentDocument=original;
  try{
   let act=await this.inspectAct(act_ref,original.expression_ref),position:number;
   if(act){
    if(act.position===null)throw Error('The actual retained Act has no current Edition.');
    const prior=await this.edition(act,act.position),owned=performance(prior,scene_ref);
    if(owned.performance_ref!==source.performance_ref)throw Error('This existing Act identity retains another native performance.');
    if(!current())throw Error('The selected Document changed during actual Act inspection.');
    if(same(prior,original)){
     // An unknown prior acknowledgement is reconciled from the actual same
     // store edition. Its original operation is never issued again.
     this.settleNativeMutation(act,prior);
     act=await this.hold(act,actor,prior);position=act.position!;
     const observed=await this.edition(act,position);
     if(!same(observed,original)||!current())throw Error('The same native held Edition no longer matches this whole Document.');
     return this.admit(act,position,observed,scene_ref,true);
    }
    // The currently running Act still owns its prior whole Edition. Hold and
    // read that SAME prior Edition before performing the later current Doc.
    const priorPosition=act.position;
    act=await this.hold(act,actor,prior);
    const heldPrior=await this.edition(act,priorPosition);
    if(!same(heldPrior,prior)||!current())throw Error('The original prior Act Edition changed while acknowledging its hold.');
    this.settleNativeMutation(act,heldPrior);
   }
   if(!current())throw Error('The current native Document changed before its retained Act transaction.');
   const reply=await this.request({operation:'act_retained_perform',act_ref,expression_ref:original.expression_ref,expected_revision:original.revision,expected_act_revision:act?.revision??null,
    summary:`Physical-musical performance · ${source.scene.title}`,actor,activity_ref:`performance-save:${crypto.randomUUID()}`,
    changes:[{change:'scene_performance_set',scene_ref,performance:structuredClone(source.scene.performance)}]});
   if(reply?.state!=='act_running')throw Error('The native Act did not acknowledge its exact performance Edition.');
   act=actualAct(reply,act_ref,original.expression_ref);
   if(act.position===null)throw Error('The original retained transaction omitted its actual Edition position.');
   position=act.position;
   const edition=await this.edition(act,position);
   if(!same(edition,original)||!current())throw Error('The retained native transaction changed the full post-cut Document; no file save or source grant follows.');
   this.settleNativeMutation(act,edition);
   act=await this.hold(act,actor,edition);
   const held=await this.edition(act,position);
   if(!same(held,original)||!current())throw Error('The held native Act edition changed before ordinary file save.');
   return this.admit(act,position,held,scene_ref,true);
  }catch(error){this.failure=String(error);throw error;}finally{this.intentDocument=null;}
 }
 private admit(act:Act,position:number,document:KernelExpressionDocument,scene_ref:string,reconciled=false):RetainedPerformanceAct{
  const source=performance(document,scene_ref),retained={act_ref:act.act_ref,selection:{expected_act_revision:act.revision,edition_position:position,scene_ref,expected_expression_revision:document.revision,expected_scene_revision:source.scene.revision as number,performance_digest:source.content_digest},document,performance_ref:source.performance_ref,checkpoint_index:source.checkpoint_index};
  if(reconciled){this.settleNativeMutation(act,document);this.failure=null;}this.retained=structuredClone(retained);return structuredClone(retained);
 }
 /** Cold reopen discovers through the actual native store. A name or current
  * Scene metadata alone never chooses a receiving owner or restores a body. */
 async discover(expression_ref:string):Promise<Record<string,unknown>>{
  if(!ref(expression_ref))throw Error('Open the actual native Expression before its retained Act discovery.');
  const reply=await this.request({operation:'act_list',expression_ref});
  if(reply?.state!=='acts'||!Array.isArray(reply.acts)||reply.persistent!==true||!Array.isArray(reply.store_errors)||reply.store_errors.length||reply.acts.some((row:any)=>row.expression_ref!==expression_ref||row.resident_currentness||row.stored_reload_error))throw Error('The actual persistent native Act store is unavailable or has retained read failures.');
  return structuredClone(reply);
 }
 /** Only this explicitly authored archival identity, actual held material-v2
  * Act and complete native Edition correspondence relax read-through. This
  * grants no source, clock, body restore or permission over unrelated Acts. */
 async isSavedCustody(act_ref:string,document:KernelExpressionDocument):Promise<boolean>{
  const scene_ref=document.selection?.scene_ref;
  if(!scene_ref)return false;
  const source=performance(document,scene_ref);
  if(act_ref!==`act:physical-musical:${source.performance_ref}`)return false;
  const act=await this.inspectAct(act_ref,document.expression_ref);
  return !!act&&act.phase==='held'&&act.position!==null&&same(await this.edition(act,act.position),document);
 }
 async selected(act_ref:string,expression_ref:string,scene_ref:string):Promise<RetainedPerformanceAct>{
  if(!ref(act_ref)||!ref(expression_ref)||!ref(scene_ref))throw Error('Select an actual retained native Act and Scene.');
  const act=await this.inspectAct(act_ref,expression_ref);
  if(!act||act.position===null)throw Error('The selected same-store retained Act has no native Edition.');
  const document=await this.edition(act,act.position);
  return this.admit(act,act.position,document,scene_ref);
 }
}
