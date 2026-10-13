/** E14 nested reads (lane-3 TARGET-SET E14). The nested documents an open Expression's occurrences
 * name, read through the kernel's own expression read. Imports the pure module and the bridge only, so the
 * workspace's wiring is loadable and testable without the rest of the app.
 *
 * The cache is keyed by ref and by the revision each occurrence records for its subject (the kernel SceneBody's
 * `reading.revision`). A document is kept across host views while its recorded revision is unchanged; it is read
 * again only when that revision moves or the document is missing. An occurrence that records no revision is keyed by
 * its structure (subject and depth), so it is read again only when it changes shape. Nothing is cleared on a view, so
 * an unrelated host edit never makes a placed occurrence read as unread. */
import {withNestedVerdicts,type KernelConversion} from './kernelDocumentBridge.js';
import {isNestedBody,nestedBodyKey,nestedKeyOf,nestedReachable,nestedReadPlan,type NestedDocumentLike,type NestedGraph,type NestedRead} from './nestedOccurrence.js';

/** The nested documents the open Expression's occurrences name, read through `read` (the kernel's expression
 * read). Never authored state: a cache, pruned to what the open view names. A document that arrives refreshes the
 * host through `refresh`. */
export function nestedDocumentReads(read:(ref:string)=>Promise<unknown>,refresh:()=>void){
 const graph:NestedGraph=new Map();
 const requested=new Map<string,string>();
 let version=0;
 const scanned=new WeakSet<object>();
 const decorated=new WeakMap<KernelConversion,{version:number;view:KernelConversion}>();
 /** Reads what the occurrence rooted at `root` requests and does not hold. Returns whether anything was read. */
 const readFrom=async(root:NestedRead,maxDepth:number):Promise<boolean>=>{
  let any=false;
  const skip=new Set<string>();
  for(;;){
   const plan=nestedReadPlan(graph,requested,root,maxDepth,skip);
   if(!plan.length)return any;
   const rows=await Promise.allSettled(plan.map(item=>read(item.ref)));
   let added=false;
   rows.forEach((row,index)=>{
    const item=plan[index];
    if(row.status==='fulfilled'&&row.value&&typeof row.value==='object'){
     graph.set(item.ref,row.value as NestedDocumentLike);
     requested.set(item.ref,item.key);
     version++;added=true;any=true;
    }else skip.add(item.ref);
   });
   if(!added)return any;
  }
 };
 const scan=(view:KernelConversion):void=>{
  if(scanned.has(view))return;
  scanned.add(view);
  const roots=Object.values(view.bindings).flatMap(binding=>isNestedBody(binding.body)?[binding.body]:[]);
  if(!roots.length)return;
  // Keep what this view names and nothing else.
  const keep=new Set<string>();
  for(const body of roots)for(const ref of nestedReachable(graph,body.subject_ref,body.recursion?.max_depth??1))keep.add(ref);
  for(const ref of [...graph.keys()])if(!keep.has(ref)){graph.delete(ref);requested.delete(ref);version++;}
  void Promise.allSettled(roots.map(body=>readFrom({ref:body.subject_ref,key:nestedBodyKey(body)},body.recursion?.max_depth??1)))
   .then(results=>{if(results.some(row=>row.status==='fulfilled'&&row.value))refresh();});
 };
 const decorate=(view:KernelConversion):KernelConversion=>{
  if(!Object.values(view.bindings).some(binding=>isNestedBody(binding.body)))return view;
  const hit=decorated.get(view);
  if(hit?.version===version)return hit.view;
  // A subject whose recorded revision has moved is not the document the occurrence names until it is read again:
  // its verdict is unread, not the old content.
  const visible:NestedGraph=new Map(graph);
  for(const binding of Object.values(view.bindings))if(isNestedBody(binding.body)&&requested.get(binding.body.subject_ref)!==nestedBodyKey(binding.body))visible.delete(binding.body.subject_ref);
  const out=withNestedVerdicts(view,visible);
  decorated.set(view,{version,view:out});
  return out;
 };
 return {
  graph:():NestedGraph=>graph,
  document:(ref:string):NestedDocumentLike|undefined=>graph.get(ref),
  /** Read the document a placement names, under the revision the placement will record. */
  readNested:async(ref:string,revision:unknown,maxDepth:number):Promise<void>=>{
   await readFrom({ref,key:nestedKeyOf(ref,revision,maxDepth)},maxDepth);
  },
  /** The view as the workspace presents it: its nested verdicts re-derived from the graph read so far. */
  view:(view:KernelConversion):KernelConversion=>{scan(view);return decorate(view);},
 };
}
