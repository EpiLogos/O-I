import {clone, validateJourney} from './model.js';
import type {Journey} from './model.js';
import {forkExpression} from './expressions.js';
import {readLibraryDetailed, saveToLibrary} from './store.js';

/** Property order is presentation; every JSON authoring value is material. */
function exact(value:unknown):string {
 return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
}
function authored(journey:Journey,copy=false):string {
 const material=clone(journey);delete (material as Partial<Journey>).updatedAt;
 if(copy)delete (material as Partial<Journey>).id;
 return exact(material);
}
function library(){
 const reading=readLibraryDetailed();
 if(reading.blocked||reading.errors.length)throw new Error('The browser Library contains unreadable material. It was retained; native recovery was not adopted. Export or reconcile the Library first.');
 return reading;
}
export interface RecoveryLibraryCopies {copy_ids:string[];created_ids:string[]}

/** Retain divergent browser definitions before accepting native recovery.
 * These are ordinary Library forks, never new native identities or records.
 * This synchronous operation must finish before the caller accepts its exact
 * recovery basis. A storage/refusal/readback failure leaves adoption refused. */
export function preserveRecoveryLibraryCopies(recovered:Journey):RecoveryLibraryCopies {
 const native=validateJourney(recovered),before=library(),result:RecoveryLibraryCopies={copy_ids:[],created_ids:[]};
 const inventory=[...before.journeys],planned:Journey[]=[];
 for(const local of before.journeys.filter(row=>row.id===native.id)){
  if(authored(local)===authored(native))continue;
  // The authored title is material, including its maximum-length tail.
  // A distinct fork identity preserves it without truncation or decoration.
  const expected=clone(local);
  const existing=inventory.find(row=>row.id!==local.id&&authored(row,true)===authored(expected,true));
  if(existing){if(!result.copy_ids.includes(existing.id))result.copy_ids.push(existing.id);continue;}
  const copy=forkExpression(local);validateJourney(copy);
  if(copy.id===local.id||inventory.some(row=>row.id===copy.id))throw new Error('A distinct browser recovery copy could not be created. Existing definitions were retained; native recovery was not adopted.');
  inventory.push(copy);planned.push(copy);result.copy_ids.push(copy.id);
 }
 for(const copy of planned){
  saveToLibrary(copy);
  const acknowledged=library();
  if(!acknowledged.journeys.some(row=>row.id===copy.id&&exact(row)===exact(copy)))throw new Error('The browser Library did not acknowledge the complete recovery copy. Native recovery was not adopted.');
  const counts=new Map<string,number>();
  for(const raw of acknowledged.raw){const key=exact(raw);counts.set(key,(counts.get(key)??0)+1);}
  for(const raw of before.raw){const key=exact(raw),count=counts.get(key)??0;if(!count)throw new Error('Existing browser Library material changed during recovery retention. Native recovery was not adopted.');counts.set(key,count-1);}
  result.created_ids.push(copy.id);
 }
 return result;
}
