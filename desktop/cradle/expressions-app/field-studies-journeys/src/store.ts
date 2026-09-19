import {Journey,clone,validateJourney} from './model.js';
export const STORAGE_KEY='oi.field-studies.journey-library.v1';
export class DocumentStore {
 revision=0;
 /** Invalidates prepared runtime configuration without making a new undo entry. */
 touch(){this.revision++;if(this.baseline)this.mutated=true;}
 document:Journey;undoStack:Journey[]=[];redoStack:Journey[]=[];private baseline:Journey|null=null;private mutated=false;
 /** True while a pointer gesture or uncommitted edit holds a baseline. */
 get transactionOpen(){return this.baseline!==null;}
 constructor(document:Journey){this.document=clone(document);}
 begin(){if(!this.baseline){this.baseline=clone(this.document);this.mutated=false;}}
 /** Full-document stringify per gesture end showed up as frame hitches; the mutation flag is set by touch(). */
 finish(){if(!this.baseline)return;const before=this.baseline;this.baseline=null;if(!this.mutated)return;this.undoStack.push(before);if(this.undoStack.length>60)this.undoStack.shift();this.redoStack=[];this.document.updatedAt=new Date().toISOString();this.touch();}
 change(fn:(doc:Journey)=>void){this.begin();try{fn(this.document);this.mutated=true;this.finish();}catch(error){if(this.baseline)this.document=this.baseline;this.baseline=null;this.touch();throw error;}}
 undo(){this.finish();const d=this.undoStack.pop();if(!d)return false;this.redoStack.push(clone(this.document));this.document=d;this.touch();return true;}
 redo(){const d=this.redoStack.pop();if(!d)return false;this.undoStack.push(clone(this.document));this.document=d;this.touch();return true;}
 replace(doc:Journey){this.change(()=>{this.document=clone(doc);});}
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
