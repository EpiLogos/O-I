/** E14 nested reads (lane-3 TARGET-SET E14). The nested documents an open Expression's occurrences
 * name, read through the kernel's own expression read. Imports the pure module and the bridge only, so the
 * workspace's wiring is loadable and testable without the rest of the app. */
import {withNestedVerdicts,type KernelConversion} from './kernelDocumentBridge.js';
import {isNestedBody,nestedReadPlan,type NestedDocumentLike,type NestedGraph} from './nestedOccurrence.js';

/** E14: the nested documents the open Expression's occurrences name, read through the
 * kernel's own expression read (`read`). This is a read cache keyed by ref, never authored
 * state. It is rescanned whenever a new view of its host is adopted, and it reads no deeper than
 * each occurrence's own nesting bound. A new document refreshes the host through `refresh`. */
export function nestedDocumentReads(read:(ref:string)=>Promise<unknown>,refresh:()=>void){
 const graph:NestedGraph=new Map();
 let version=0;
 const scanned=new WeakSet<object>();
 const decorated=new WeakMap<KernelConversion,{version:number;view:KernelConversion}>();
 const readFrom=async(root:string,maxDepth:number):Promise<void>=>{
  const skip=new Set<string>();
  for(;;){
   const plan=nestedReadPlan(graph,root,maxDepth,skip);
   if(!plan.length)return;
   const rows=await Promise.allSettled(plan.map(ref=>read(ref)));
   let added=false;
   rows.forEach((row,index)=>{
    const ref=plan[index];
    if(row.status==='fulfilled'&&row.value&&typeof row.value==='object'){graph.set(ref,row.value as NestedDocumentLike);version++;added=true;}
    else skip.add(ref);
   });
   if(!added)return;
  }
 };
 const scan=(view:KernelConversion):void=>{
  if(scanned.has(view))return;
  scanned.add(view);
  const roots=Object.values(view.bindings).flatMap(binding=>isNestedBody(binding.body)?[binding.body]:[]);
  if(!roots.length)return;
  graph.clear();version++;
  void Promise.allSettled(roots.map(body=>readFrom(body.subject_ref,body.recursion?.max_depth??1))).then(()=>refresh());
 };
 const decorate=(view:KernelConversion):KernelConversion=>{
  if(!Object.values(view.bindings).some(binding=>isNestedBody(binding.body)))return view;
  const hit=decorated.get(view);
  if(hit?.version===version)return hit.view;
  const out=withNestedVerdicts(view,graph);
  decorated.set(view,{version,view:out});
  return out;
 };
 return {
  graph:():NestedGraph=>graph,
  document:(ref:string):NestedDocumentLike|undefined=>graph.get(ref),
  readNested:async(root:string,maxDepth:number):Promise<void>=>{await readFrom(root,maxDepth);version++;},
  /** The view as the workspace presents it: its nested verdicts re-derived from the graph read so far. */
  view:(view:KernelConversion):KernelConversion=>{scan(view);return decorate(view);},
 };
}
