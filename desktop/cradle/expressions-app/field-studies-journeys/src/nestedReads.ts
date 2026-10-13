/** E14 nested reads (lane-3 TARGET-SET E14). The nested documents an open Expression's occurrences name.
 * Imports the pure module and the bridge only, so the workspace's wiring is loadable and testable without the rest
 * of the app.
 *
 * Freshness comes from the library, not from the occurrence. Once per host view, one list call (the kernel's own
 * expression list, `list`) gives the current revision of every saved Expression. A named document is read again only
 * when the cached copy is at a different revision from the one listed, or when it is missing. A document that is
 * missing (not listed, or failed to read) is asked for again on a growing wait: 1 s, 2 s, 4 s … up to five minutes,
 * reset as soon as the list shows it again.
 *
 * The occurrence's recorded revision is never rewritten here. When it differs from the current one, the verdict is
 * marked `changed`, which the strip shows as one quiet note; the occurrence still plays the current revision. Nothing
 * is cleared on a view, so an unrelated host edit never makes a placed occurrence read as unread. */
import {withNestedVerdicts,type KernelConversion} from './kernelDocumentBridge.js';
import {isNestedBody,nestedBackoffMs,nestedChangedSincePlaced,nestedReachable,nestedReadPlan,type NestedDocumentLike,type NestedGraph} from './nestedOccurrence.js';

/** One row of the kernel's expression list: a saved Expression and its current revision. */
export interface NestedListing {expression_ref:string;revision:number}

/** Passes one read may make before it returns to the caller: a document read at a revision the list moved past in the
 * meantime is asked for again on the next view, not in a loop. */
const READ_PASSES=4;

/** The nested documents the open Expression's occurrences name, read through `read` (the kernel's expression read),
 * freshness taken from `list` (the kernel's expression list) and waits measured by `now`. A cache, never authored state:
 * pruned to what the open view names. A document that arrives, or a listing that changes a verdict, refreshes the host
 * through `refresh`. */
export function nestedDocumentReads(
 read:(ref:string)=>Promise<unknown>,
 refresh:()=>void,
 list:()=>Promise<readonly NestedListing[]>,
 now:()=>number=()=>Date.now(),
){
 const graph:NestedGraph=new Map();
 /** The current revision of each saved Expression, as the latest list showed it. */
 const listed=new Map<string,number>();
 /** Asks that failed or found nothing, per ref: how many, and when the next may be made. */
 const waits=new Map<string,{misses:number;nextAt:number}>();
 let version=0;
 const scanned=new WeakSet<object>();
 const decorated=new WeakMap<KernelConversion,{version:number;view:KernelConversion}>();
 const mayAsk=(ref:string):boolean=>{const wait=waits.get(ref);return !wait||now()>=wait.nextAt;};
 const asked=(ref:string):void=>{
  const misses=(waits.get(ref)?.misses??0)+1;
  waits.set(ref,{misses,nextAt:now()+nestedBackoffMs(misses)});
 };
 /** Reads what the occurrence rooted at `root` needs and does not hold. Returns whether anything was read. A placement
  * (`forced`) reads at once, whatever wait the ref was under. */
 const readFrom=async(root:string,maxDepth:number,forced=false):Promise<boolean>=>{
  let any=false;
  for(let pass=0;pass<READ_PASSES;pass++){
   const plan=nestedReadPlan(graph,listed,root,maxDepth,forced?()=>true:mayAsk);
   if(!plan.length)return any;
   for(const ref of plan)if(!listed.has(ref))asked(ref);
   const rows=await Promise.allSettled(plan.map(ref=>read(ref)));
   let added=false;
   rows.forEach((row,index)=>{
    const ref=plan[index];
    if(row.status==='fulfilled'&&row.value&&typeof row.value==='object'){
     graph.set(ref,row.value as NestedDocumentLike);
     version++;added=true;any=true;
     if(listed.has(ref))waits.delete(ref);
    }else if(listed.has(ref))asked(ref);
   });
   if(!added)return any;
  }
  return any;
 };
 const scan=(view:KernelConversion):void=>{
  if(scanned.has(view))return;
  scanned.add(view);
  const roots=Object.values(view.bindings).flatMap(binding=>isNestedBody(binding.body)?[binding.body]:[]);
  if(!roots.length)return;
  // Keep what this view names and nothing else.
  const keep=new Set<string>();
  for(const body of roots)for(const ref of nestedReachable(graph,body.subject_ref,body.recursion?.max_depth??1))keep.add(ref);
  for(const ref of [...graph.keys()])if(!keep.has(ref)){graph.delete(ref);version++;}
  // One list call for this view. Without a listing nothing is asked for and the cache stands as it is.
  void (async()=>{
   let rows:readonly NestedListing[];
   try{rows=await list();}catch{return;}
   listed.clear();
   for(const row of rows){
    listed.set(row.expression_ref,Number(row.revision));
    // The list shows a document again: a wait is reset once the document we hold is at the listed revision.
    const held=graph.get(row.expression_ref);
    if(held&&Number(held.revision)===Number(row.revision))waits.delete(row.expression_ref);
   }
   version++;
   await Promise.allSettled(roots.map(body=>readFrom(body.subject_ref,body.recursion?.max_depth??1)));
   version++;
   refresh();
  })();
 };
 const decorate=(view:KernelConversion):KernelConversion=>{
  if(!Object.values(view.bindings).some(binding=>isNestedBody(binding.body)))return view;
  const hit=decorated.get(view);
  if(hit?.version===version)return hit.view;
  const out=withNestedVerdicts(view,graph);
  const bindings:KernelConversion['bindings']={...out.bindings};
  for(const [id,binding] of Object.entries(out.bindings)){
   if(!binding.nested||!isNestedBody(binding.body))continue;
   if(nestedChangedSincePlaced(binding.body.reading?.revision,listed.get(binding.body.subject_ref)))
    bindings[id]={...binding,nested:{...binding.nested,changed:true}};
  }
  const result:KernelConversion={...out,bindings};
  decorated.set(view,{version,view:result});
  return result;
 };
 return {
  graph:():NestedGraph=>graph,
  document:(ref:string):NestedDocumentLike|undefined=>graph.get(ref),
  /** Read the document a placement names. The placement has just listed it at `revision`, so that revision is the current
   * one, and the read is not held back by any wait. */
  readNested:async(ref:string,revision:unknown,maxDepth:number):Promise<void>=>{
   const current=Number(revision);
   if(Number.isFinite(current)){listed.set(ref,current);version++;}
   await readFrom(ref,maxDepth,true);
   version++;
  },
  /** The view as the workspace presents it: its nested verdicts, with the changed note, from the graph read so far. */
  view:(view:KernelConversion):KernelConversion=>{scan(view);return decorate(view);},
 };
}
