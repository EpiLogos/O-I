import {Journey,clone,validateJourney} from './model.js';
import type {KernelChange,KernelCompensation} from './kernelExpressions.js';
export const STORAGE_KEY='oi.field-studies.journey-library.v1';
/** One labelled undo step, in the one store. `snapshot` is the document the step
 * returns to. `changes` and `inverse` are the kernel edit the step produced and
 * its compensation (invertEdit), when the caller recorded them with
 * attachKernelEdit; a step without them is undone locally only. */
export interface HistoryEntry {label:string;snapshot:Journey;changes?:KernelChange[];inverse?:KernelCompensation}
/** What the next undo or redo asks of the kernel: nothing (local only), one
 * kernel edit to submit first, or a refusal by name. */
export interface HistoryPlan {label:string;kernel:null|{changes:KernelChange[]}|{refused:string;reason:string}}
const UNRECORDED='this edit recorded no kernel changes, so it cannot be undone as a kernel edit';
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
 /** True while a pointer gesture or uncommitted edit holds a baseline. */
 get transactionOpen(){return this.baseline!==null;}
 constructor(document:Journey){this.document=clone(document);}
 /** A gesture takes its label from the first begin(); unlabelled gestures are "Edit". */
 begin(label?:string){if(!this.baseline){this.baseline=clone(this.document);this.mutated=false;this.pendingLabel=label?.trim()||'Edit';}}
 /** Full-document stringify per gesture end showed up as frame hitches; the mutation flag is set by touch(). */
 finish(){this.lastCommit=null;if(!this.baseline)return;const before=this.baseline;this.baseline=null;if(!this.mutated)return;const entry:HistoryEntry={label:this.pendingLabel,snapshot:before};this.undoStack.push(entry);this.lastCommit=entry;if(this.undoStack.length>60){this.undoStack.shift();if(this.kernelDepth!==null)this.kernelDepth=this.kernelDepth>0?this.kernelDepth-1:null;}this.redoStack=[];this.document.updatedAt=new Date().toISOString();this.touch();}
 /** Commit one labelled edit. Both forms keep working: change(fn) is labelled "Edit". */
 change(label:string,fn:(doc:Journey)=>void):void;
 change(fn:(doc:Journey)=>void):void;
 change(labelOrFn:string|((doc:Journey)=>void),maybeFn?:(doc:Journey)=>void):void{
  const label=typeof labelOrFn==='string'?labelOrFn:undefined,fn=typeof labelOrFn==='function'?labelOrFn:maybeFn;
  if(!fn)throw new TypeError('store.change needs an edit function');
  this.begin(label);try{fn(this.document);this.mutated=true;this.finish();}catch(error){if(this.baseline)this.document=this.baseline;this.baseline=null;this.touch();throw error;}
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
 /** Undo one labelled step. Pass compensated:true only after the kernel edit from
  * undoPlan() was accepted; a plain undo across a kernel save leaves the kernel to
  * the next diff save. */
 undo(options?:{compensated?:boolean}):boolean{
  this.finish();const entry=this.undoStack.pop();if(!entry)return false;
  const from=this.undoStack.length+1;this.settleKernel(from,from-1,options?.compensated===true);
  this.redoStack.push({label:entry.label,snapshot:clone(this.document),changes:entry.changes,inverse:entry.inverse});
  this.document=entry.snapshot;this.touch();return true;
 }
 /** Redo one labelled step; compensated:true means its forward kernel edit was accepted. */
 redo(options?:{compensated?:boolean}):boolean{
  const entry=this.redoStack.pop();if(!entry)return false;
  const from=this.undoStack.length;this.settleKernel(from,from+1,options?.compensated===true);
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
  if(this.kernelDepth!==this.undoStack.length)return{label:entry.label,kernel:null};
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
  // The kernel's own projection is adopted, so its relation to earlier steps is unknown until the next save.
  this.kernelDepth=null;
 }
 replace(doc:Journey){this.change('Replace document',()=>{this.document=clone(doc);});}
}
export interface LibraryRead {journeys:Journey[];errors:string[];raw:unknown[];blocked:boolean}
export function readLibraryDetailed():LibraryRead {
 const result:LibraryRead={journeys:[],errors:[],raw:[],blocked:false};
 try {const text=localStorage.getItem(STORAGE_KEY);if(!text)return result;
  const parsed=JSON.parse(text);if(!Array.isArray(parsed))throw new Error('Library root is not an array');result.raw=parsed;
  parsed.forEach((value,index)=>{try{result.journeys.push(validateJourney(value));}catch(error){result.errors.push(`Entry ${index+1}: ${error instanceof Error?error.message:String(error)}`);}});
 }catch(error){result.blocked=true;result.errors.push(error instanceof Error?error.message:String(error));}
 return result;
}
export function readLibrary():Journey[]{return readLibraryDetailed().journeys;}
export function saveToLibrary(journey:Journey){
 const library=readLibraryDetailed();if(library.blocked)throw new Error('Existing library could not be read. It has not been overwritten. Export a file to keep this edit.');
 // Retain unrecognised entries byte-for-value and all other saved journeys. Never
 // trim old work or overwrite a newer unrecognised document sharing this ID.
 const all=library.raw.filter(value=>{try{return validateJourney(value).id!==journey.id;}catch{return true;}});
 all.unshift(clone(validateJourney(journey)));localStorage.setItem(STORAGE_KEY,JSON.stringify(all));return readLibrary();
}

/** Delete only understood entries; failed/newer documents are retained verbatim. */
export function removeFromLibrary(id:string){
 const library=readLibraryDetailed();if(library.blocked)throw new Error('The existing library could not be read; nothing was deleted.');
 const raw=library.raw.filter(value=>{try{return validateJourney(value).id!==id;}catch{return true;}});
 localStorage.setItem(STORAGE_KEY,JSON.stringify(raw));
}
