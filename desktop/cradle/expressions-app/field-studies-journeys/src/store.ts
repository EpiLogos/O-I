import {Journey,clone} from './model.js';
import {invertEdit,type KernelChange,type KernelCompensation} from './kernelExpressions.js';
export const STORAGE_KEY='oi.field-studies.journey-library.v1';
/** E15c: one Save is one kernel checkpoint. `changes` is the kernel edit the Save
 * acknowledged; `before` and `after` are the kernel documents either side of it. */
export interface KernelCheckpoint {changes:KernelChange[];before:unknown;after:unknown}
/** Where a Save begins: the newest step it covers, the undo depth at that moment,
 * and the kernel depth before the Save. Read in the same step as the snapshot it submits. */
export interface KernelSaveAnchor {entry:HistoryEntry|null;length:number;base:number|null}
/** A compensation that carries its Save's documents and the kernel depth it returns to. */
type Checkpointed=KernelCompensation&{checkpoint?:{before:unknown;after:unknown;base:number|null}};
/** One labelled undo step, in the one store. `snapshot` is the document the step
 * returns to. `changes` and `inverse` are the kernel edit the step produced and
 * its compensation (invertEdit), when the caller recorded them with
 * attachKernelEdit or attachKernelCheckpoint; a step without them is undone locally only. */
export interface HistoryEntry {label:string;snapshot:Journey;changes?:KernelChange[];inverse?:Checkpointed;gesture?:string;
 /** False on a redo entry whose step the kernel never held (undone before any Save reached it): its redo is local. */
 kernelHeld?:false}
/** What the next undo or redo asks of the kernel: nothing (local only), one
 * kernel edit to submit first, or a refusal by name. */
export interface HistoryPlan {label:string;kernel:null|{changes:KernelChange[]}|{refused:string;reason:string}}
const UNRECORDED='this edit recorded no kernel changes, so it cannot be undone as a kernel edit';
let gestureSeq=0;
/** A gesture id is unique within this page; the kernel guard refuses a second submission of one. */
function mintGesture():string{gestureSeq+=1;return `gesture:${Date.now().toString(36)}.${gestureSeq}`;}
/** Restore a document's content in place, so a reference held by the gesture stays valid. */
function restoreInPlace(target:Journey,source:Journey):void{const slots=target as unknown as Record<string,unknown>;for(const key of Object.keys(slots))delete slots[key];Object.assign(target,clone(source));}
export class DocumentStore {
 revision=0;
 /** Invalidates prepared runtime configuration without making a new undo entry. */
 touch(){this.revision++;if(this.baseline)this.mutated=true;}
 document:Journey;undoStack:HistoryEntry[]=[];redoStack:HistoryEntry[]=[];private baseline:Journey|null=null;private mutated=false;
 private pendingLabel='Edit';
 /** How many undo steps the kernel holds: the kernel reflects the first kernelDepth
  * steps of the stack. null means unknown, and the next save reconciles by diff. */
 private kernelDepth:number|null=null;
 private lastCommit:HistoryEntry|null=null;
 /** True while a composite (withComposite) holds the one gesture open. */
 private composing=false;
 /** E16 (spanning): the label of an open spanning gesture, or null. It stays open across a native owner act. */
 private spanning:string|null=null;
 /** True only while recordNativeAct records the owner act that closes the spanning gesture. */
 private recording=false;
 /** True while a pointer gesture or uncommitted edit holds a baseline. */
 get transactionOpen(){return this.baseline!==null;}
 /** The label of the open spanning gesture (an import in progress), or null. */
 get spanningLabel():string|null{return this.spanning;}
 constructor(document:Journey){this.document=clone(document);}
 /** Local edits wait while a spanning gesture is open: its owner act records it, and nothing else may fold into it. */
 private refuseWhileSpanning(){if(this.spanning!==null&&!this.recording)throw new Error(`"${this.spanning}" is in progress: this edit waits until the native owner acknowledges it`);}
 /** A gesture takes its label from the first begin(); unlabelled gestures are "Edit". */
 begin(label?:string){this.refuseWhileSpanning();if(!this.baseline){this.baseline=clone(this.document);this.mutated=false;this.pendingLabel=label?.trim()||'Edit';}}
 /** Full-document stringify per gesture end showed up as frame hitches; the mutation flag is set by touch(). */
 finish(){if(this.composing)throw new Error('A composite edit closes once, when its edit returns; finish() inside it is refused');this.refuseWhileSpanning();this.lastCommit=null;if(!this.baseline)return;const before=this.baseline;this.baseline=null;if(!this.mutated)return;const entry:HistoryEntry={label:this.pendingLabel,snapshot:before};this.undoStack.push(entry);this.lastCommit=entry;if(this.undoStack.length>60){this.undoStack.shift();if(this.kernelDepth!==null)this.kernelDepth=this.kernelDepth>0?this.kernelDepth-1:null;}this.redoStack=[];this.document.updatedAt=new Date().toISOString();this.touch();}
 /** Commit one labelled edit. Both forms keep working: change(fn) is labelled "Edit". */
 change(label:string,fn:(doc:Journey)=>void):void;
 change(fn:(doc:Journey)=>void):void;
 change(labelOrFn:string|((doc:Journey)=>void),maybeFn?:(doc:Journey)=>void):void{
  const label=typeof labelOrFn==='string'?labelOrFn:undefined,fn=typeof labelOrFn==='function'?labelOrFn:maybeFn;
  if(!fn)throw new TypeError('store.change needs an edit function');
  this.refuseWhileSpanning();
  if(this.composing){this.joinComposite(fn);return;}
  this.begin(label);try{fn(this.document);this.mutated=true;this.finish();}catch(error){if(this.baseline)this.document=this.baseline;this.baseline=null;this.touch();throw error;}
 }
 /** One multi-step gesture as one labelled step: a synchronous edit runs inside a
  * single gesture, so it leaves exactly one undo entry. A throw anywhere inside
  * restores the baseline byte-equal, records no entry, and rethrows. A composite
  * does not nest in another composite, and does not start inside an open gesture. */
 composite<T>(label:string,fn:(doc:Journey)=>T):T{
  if(this.composing)throw new Error(`"${label}" cannot nest inside a composite edit; its steps belong to the enclosing edit`);
  this.refuseWhileSpanning();
  if(this.transactionOpen)throw new Error(`"${label}" cannot start inside an open gesture; finish that gesture first`);
  const gesture=mintGesture();
  this.composing=true;this.begin(label);
  let value!:T;
  try{
   value=fn(this.document);
   if(value instanceof Promise){(value as unknown as Promise<unknown>).catch(()=>undefined);throw new Error(`"${label}" must be synchronous: an async edit would hold the store open across awaits`);}
   if(!this.mutated&&JSON.stringify(this.document)!==JSON.stringify(this.baseline))this.mutated=true;
   this.composing=false;
   this.finish();
  }catch(error){
   this.composing=false;
   if(this.baseline)restoreInPlace(this.document,this.baseline);
   this.baseline=null;this.mutated=false;this.lastCommit=null;this.touch();
   throw error;
  }
  if(this.lastCommit)this.lastCommit.gesture=gesture;
  return value;
 }
 /** The gesture id of the step the last composite committed, or null when it
  * committed none. The kernel submission of that step carries it, once. */
 committedGesture():string|null{return this.lastCommit?.gesture??null;}
 /** A nested change inside a composite is one more step of the same edit: it joins
  * without closing the gesture, and a throw restores only its own step. */
 private joinComposite(fn:(doc:Journey)=>void):void{
  const before=clone(this.document);
  try{fn(this.document);this.mutated=true;}
  catch(error){restoreInPlace(this.document,before);throw error;}
 }
 /** Record the kernel edit the last committed step produced, with its compensation.
  * Attaches only to the step the last change() or finish() committed; false otherwise. */
 attachKernelEdit(changes:KernelChange[],inverse:KernelCompensation):boolean{
  if(!this.lastCommit||this.undoStack.at(-1)!==this.lastCommit)return false;
  this.lastCommit.changes=changes;this.lastCommit.inverse=inverse;return true;
 }
 /** A kernel step crossed the kernel depth: keep kernelDepth true to the kernel. */
 private settleKernel(from:number,to:number,compensated:boolean){
  if(this.kernelDepth===null)return;
  if(this.kernelDepth===from)this.kernelDepth=compensated?to:null;
  else if(this.kernelDepth>from)this.kernelDepth=null;
 }
 /** The kernel now holds the document at the head of the stack (after a save). */
 markKernelSaved(){if(this.transactionOpen)throw new Error('Finish the current gesture before recording a kernel save.');this.kernelDepth=this.undoStack.length;}
 /** E15c: where the Save about to be submitted begins. Read it in the same step as the snapshot the Save submits. */
 kernelSaveAnchor():KernelSaveAnchor{
  return {entry:this.transactionOpen?null:(this.undoStack.at(-1)??null),length:this.undoStack.length,base:this.kernelDepth};
 }
 /** E15c: record an acknowledged Save as one checkpoint on the step it began at. The
  * kernel now holds that step's depth. Steps the Save covers carry no kernel edit of
  * their own: the anchor's edit is the Save's, so they are undone and redone locally.
  * Returns false, and records nothing, when the anchor is no longer where the Save began. */
 attachKernelCheckpoint(anchor:KernelSaveAnchor,checkpoint:KernelCheckpoint):boolean{
  // A Save that changed nothing records nothing: the step's real compensation (an earlier Save's) stays, and the kernel depth is unchanged.
  if(checkpoint.changes.length===0)return true;
  if(!anchor.entry||this.undoStack[anchor.length-1]!==anchor.entry)return false;
  const inverse:Checkpointed=Object.assign(invertEdit(checkpoint.before,checkpoint.after),{checkpoint:{before:clone(checkpoint.before),after:clone(checkpoint.after),base:anchor.base}});
  anchor.entry.changes=clone(checkpoint.changes);anchor.entry.inverse=inverse;
  if(anchor.base!==null)for(let index=anchor.base;index<anchor.length-1;index++){const covered=this.undoStack[index];covered.changes=[];covered.inverse={changes:[]};}
  this.kernelDepth=anchor.length;
  return true;
 }
 /** E16 (spanning): open ONE labelled gesture that stays open across a native owner act, for an edit whose local
  * draft and owner act are one step (a .canvas import: its cards and its connections). Local edits are refused by name
  * until the act records the step (recordNativeAct closes the gesture under this label), or abandonSpanningGesture()
  * closes it with nothing recorded and the document returned to where the gesture began. */
 openSpanningGesture(label:string):void{
  if(this.composing)throw new Error(`"${label}" cannot nest inside a composite edit; its steps belong to the enclosing edit`);
  if(this.transactionOpen)throw new Error(`"${label}" cannot start inside an open gesture; finish that gesture first`);
  this.begin(label);this.spanning=label.trim()||'Edit';
 }
 /** Withdraw the newest step as if it had never been made, when the owner refused the Save that was to record it:
  * its snapshot returns and no redo survives. Only a step the owner never recorded, under this label, can be withdrawn. */
 withdrawNewestStep(label:string):boolean{
  this.refuseWhileSpanning();this.finish();
  const top=this.undoStack.at(-1);
  if(!top||top.label!==label||top.changes!==undefined)return false;
  this.undoStack.pop();restoreInPlace(this.document,top.snapshot);this.redoStack=[];this.lastCommit=null;this.touch();
  return true;
 }
 /** Close the open spanning gesture with nothing recorded: the document returns to where it began. */
 abandonSpanningGesture():void{
  if(this.spanning===null)return;
  this.spanning=null;
  if(this.baseline)restoreInPlace(this.document,this.baseline);
  this.baseline=null;this.mutated=false;this.lastCommit=null;this.touch();
 }
 /** E15/E16: one native act the owner acknowledged, as one labelled step. The step
  * adopts `next` and records the owner's checkpoint: the kernel edit that reached
  * it and the kernel documents either side. Steps its flush covered carry no kernel
  * edit of their own, as under a Save. A checkpoint whose edit has no inverse is kept
  * as a refusal on the step, so Undo names it instead of diverging from the kernel. */
 recordNativeAct(label:string,next:Journey,checkpoint:KernelCheckpoint|{refused:string;reason:string}):void{
  // E16 (spanning): an open spanning gesture closes here, and the owner act is its one step under the gesture's own label.
  this.recording=true;
  try{this.change(label,()=>{this.document=clone(next);});}
  finally{this.recording=false;this.spanning=null;}
  const anchor=this.kernelSaveAnchor();
  if(!('changes' in checkpoint)){
   if(!anchor.entry)throw new Error(`"${label}" could not be recorded: its step moved`);
   anchor.entry.inverse=checkpoint;
   if(anchor.base!==null)for(let index=anchor.base;index<anchor.length-1;index++){const covered=this.undoStack[index];covered.changes=[];covered.inverse={changes:[]};}
   this.kernelDepth=anchor.length;return;
  }
  if(!this.attachKernelCheckpoint(anchor,checkpoint))throw new Error(`"${label}" could not be recorded: its step moved`);
 }
 /** E15: an adoption from outside this editor (another window, the kernel's own reconcile) is a labelled step the kernel holds. This editor has no inverse for another owner's change, so Undo refuses it by name. */
 recordOutsideUpdate(label:string,next:Journey,reason:string):void{
  this.change(label,()=>{this.document=clone(next);});
  const top=this.undoStack.at(-1);if(!top)throw new Error(`"${label}" could not be recorded`);
  top.inverse={refused:'outside-update',reason};this.kernelDepth=this.undoStack.length;
 }
 /** E15c: undo one step whose kernel compensation was accepted. A checkpoint compensates its whole Save, so the kernel returns to the depth the Save began at. */
 undoAccepted():boolean{
  this.finish();
  const top=this.undoStack.at(-1);
  if(!this.undo({compensated:true}))return false;
  const checkpoint=top?.inverse?.checkpoint;
  if(checkpoint)this.kernelDepth=checkpoint.base===null?null:Math.min(checkpoint.base,this.undoStack.length);
  return true;
 }
 /** E15c: the kernel documents the next undo (`before`) or redo (`after`) of a checkpointed step moves between; null when the step is not a checkpoint. */
 checkpointAt(direction:'undo'|'redo'):{before:unknown;after:unknown}|null{
  const entry=direction==='undo'?this.undoStack.at(-1):this.redoStack.at(-1);
  const checkpoint=entry?.inverse?.checkpoint;
  return checkpoint?{before:checkpoint.before,after:checkpoint.after}:null;
 }
 /** Undo one labelled step. Pass compensated:true only after the kernel edit from
  * undoPlan() was accepted; a plain undo across a kernel save leaves the kernel to
  * the next diff save. */
 undo(options?:{compensated?:boolean}):boolean{
  this.finish();const entry=this.undoStack.pop();if(!entry)return false;
  const from=this.undoStack.length+1;const unheld=this.kernelDepth!==null&&this.kernelDepth<from&&entry.changes===undefined;
  this.settleKernel(from,from-1,options?.compensated===true);
  this.redoStack.push({label:entry.label,snapshot:clone(this.document),changes:entry.changes,inverse:entry.inverse,...(unheld?{kernelHeld:false as const}:{})});
  this.document=entry.snapshot;this.touch();return true;
 }
 /** Redo one labelled step; compensated:true means its forward kernel edit was accepted. */
 redo(options?:{compensated?:boolean}):boolean{
  this.refuseWhileSpanning();
  const entry=this.redoStack.pop();if(!entry)return false;
  // A step the kernel never held is redone locally: the kernel stays where it was, below the new head.
  const from=this.undoStack.length;if(entry.kernelHeld!==false||options?.compensated===true)this.settleKernel(from,from+1,options?.compensated===true);
  this.undoStack.push({label:entry.label,snapshot:clone(this.document),changes:entry.changes,inverse:entry.inverse});
  this.document=entry.snapshot;this.touch();return true;
 }
 /** The kernel step the next undo needs; null when there is nothing to undo. */
 undoPlan():HistoryPlan|null{
  if(this.transactionOpen)throw new Error('Finish the current gesture before planning an undo.');
  const entry=this.undoStack.at(-1);if(!entry)return null;
  if(this.kernelDepth!==this.undoStack.length)return{label:entry.label,kernel:null};
  if(!entry.inverse)return{label:entry.label,kernel:{refused:'unrecorded',reason:UNRECORDED}};
  return{label:entry.label,kernel:'changes' in entry.inverse?{changes:entry.inverse.changes}:{refused:entry.inverse.refused,reason:entry.inverse.reason}};
 }
 /** The kernel step the next redo needs; null when there is nothing to redo. */
 redoPlan():HistoryPlan|null{
  if(this.transactionOpen)throw new Error('Finish the current gesture before planning a redo.');
  const entry=this.redoStack.at(-1);if(!entry)return null;
  if(this.kernelDepth!==this.undoStack.length||entry.kernelHeld===false)return{label:entry.label,kernel:null};
  if(!entry.changes)return{label:entry.label,kernel:{refused:'unrecorded',reason:UNRECORDED}};
  return{label:entry.label,kernel:{changes:entry.changes}};
 }
 undoLabel():string|null{const entry=this.undoStack.at(-1);return entry?entry.label:null;}
 redoLabel():string|null{const entry=this.redoStack.at(-1);return entry?entry.label:null;}
 /** Adopt the same native work's acknowledged projection without recording a
  * human edit. An acknowledgement must not sit above the gesture in Undo. */
 acknowledge(doc:Journey,history:'preserve'|'retire'='preserve'){
  if(this.transactionOpen)throw new Error('Uncommitted authoring is retained; finish the gesture before adopting native state.');
  if(doc.id!==this.document.id)throw new Error('The acknowledgement belongs to another document.');
  this.document=clone(doc);if(history==='retire'){this.undoStack=[];this.redoStack=[];}this.touch();
  // The kernel's own projection is adopted: the document now IS the kernel's, so the kernel
  // reflects every step on the stack (lead fix, E15c OPEN 2 — redo after the first Save reaches the kernel).
  this.kernelDepth=this.undoStack.length;
 }
 replace(doc:Journey){this.change('Replace document',()=>{this.document=clone(doc);});}
}
/** The one way a multi-step gesture writes to the store: see DocumentStore.composite. */
export function withComposite<T>(store:DocumentStore,label:string,fn:(doc:Journey)=>T):T{return store.composite(label,fn);}
// lane-3 E18: the Library is one record per document (libraryStore.ts). These names are its public surface.
export {readLibraryDetailed,readLibrary,saveToLibrary,removeFromLibrary,setLibraryQuarantine,sweepLibraryDamage,setLibraryBackend,LEGACY_LIBRARY_KEY} from './libraryStore.js';
export type {LibraryRead,LibraryBackend,LibraryQuarantineSink} from './libraryStore.js';
