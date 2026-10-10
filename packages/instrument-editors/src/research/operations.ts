import type {ResearchMaterialAction} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchMaterial';
export interface ResearchOperation {key:string;pending:number;error?:string}
/** A failed native operation remains held for the mature renderer's retry. */
export class ResearchOperations {
 private entries=new Map<string,ResearchOperation&{attempt:number}>();
 constructor(private publish:(operations:readonly ResearchOperation[])=>void){}
 snapshot(){return [...this.entries.values()].map(({key,pending,error})=>({key,pending,...(error?{error}:{})}));}
 get dirty(){return this.entries.size>0;}
 private changed(){this.publish(this.snapshot());}
 async run(action:ResearchMaterialAction,execute:()=>Promise<void>){
  const key=action.type+('id' in action?`:${action.id}`:'key' in action?`:${action.key}`:'');
  const entry=this.entries.get(key)??{key,pending:0,attempt:0};const attempt=++entry.attempt;entry.pending++;this.entries.set(key,entry);this.changed();
  try{await execute();if(attempt===entry.attempt)entry.error=undefined;}
  catch(error){if(attempt===entry.attempt)entry.error=error instanceof Error?error.message:String(error);throw error;}
  finally{entry.pending--;if(entry.pending===0&&!entry.error)this.entries.delete(key);this.changed();}
 }
}
