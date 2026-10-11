import type {ResearchInstrumentsHost} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchInstruments.js';
export type {ResearchInstrumentsHost};
export interface CanvasOperation {key:string;sceneId:string;action:Parameters<ResearchInstrumentsHost['material']>[1];pending:number;error?:string}
/** Retains the exact attempted material, including requests without native
 * IDs. A different create-card or stroke cannot clear an earlier refusal. */
export class CanvasOperations {
 private entries=new Map<string,CanvasOperation&{attempt:number}>();
 private sequence=0;
 private publish:(operations:readonly CanvasOperation[])=>void;
 constructor(publish:(operations:readonly CanvasOperation[])=>void){this.publish=publish;}
 snapshot():readonly CanvasOperation[]{return [...this.entries.values()].map(({attempt,...entry})=>structuredClone(entry));}
 get dirty(){return this.entries.size>0;}
 async run(sceneId:string,action:CanvasOperation['action'],execute:()=>Promise<void>){
  // This is a receiving request ID, never a native ref. Even identical
  // create-card input can produce a distinct owner card and is not a retry.
  const key=JSON.stringify([sceneId,++this.sequence,action]),entry={key,sceneId,action:structuredClone(action),pending:0,attempt:0,error:undefined as string|undefined};
  const attempt=++entry.attempt;entry.pending++;this.entries.set(key,entry);this.publish(this.snapshot());
  try{await execute();if(attempt===entry.attempt)entry.error=undefined;}
  catch(error){if(attempt===entry.attempt)entry.error=error instanceof Error?error.message:String(error);throw error;}
  finally{entry.pending--;if(entry.pending===0&&!entry.error)this.entries.delete(key);this.publish(this.snapshot());}
 }
 /** Caller supplies the retained owner's actual save/revert route. */
 async resolve(execute:(operations:readonly CanvasOperation[])=>Promise<void>){
  if([...this.entries.values()].some(entry=>entry.pending))throw Error('Wait for the retained Canvas operation before resolving it.');
  const captured=[...this.entries.values()];await execute(this.snapshot());
  for(const entry of captured)if(this.entries.get(entry.key)===entry&&entry.pending===0)this.entries.delete(entry.key);
  this.publish(this.snapshot());
 }
}
export interface CanvasBasis {expressionRef:string;sceneRef:string;sceneId:string;revision:number}
export function canvasBasis(host:ResearchInstrumentsHost,sceneId:string):CanvasBasis {
 const view=host.nativeView(),binding=view?.bindings[sceneId];
 if(!view||!binding)throw Error('This Canvas has no retained native Scene binding.');
 return {expressionRef:view.document.expression_ref,sceneRef:binding.scene_ref,sceneId,revision:view.document.revision};
}
export function assertCanvasBasis(host:ResearchInstrumentsHost,basis:CanvasBasis,checkRevision=true):void {
 const current=canvasBasis(host,basis.sceneId);
 if(current.expressionRef!==basis.expressionRef||current.sceneRef!==basis.sceneRef||(checkRevision&&current.revision!==basis.revision))throw Error('The native Canvas changed during this gesture. The draft is retained; select the current construction before retrying.');
}
/** Receiving adapter, not another owner. Every operation retains the exact Scene address.
 * Optional capabilities remain absent when the retained host does not disclose them. */
export function bindResearchHost(source:ResearchInstrumentsHost,sceneId:string,slots:Pick<ResearchInstrumentsHost,'container'|'tools'|'inspector'|'canvasHome'>):ResearchInstrumentsHost {
 const basis=canvasBasis(source,sceneId);
 const assertScene=(id:string)=>{if(id!==sceneId)throw Error('Canvas operation addressed another Scene.');assertCanvasBasis(source,basis,false);};
 const adapter={...source,...slots,sceneId:()=>sceneId,
  nativeView:()=>{try{assertCanvasBasis(source,basis,false);return source.nativeView();}catch{return undefined;}},
  sceneMaterial:(id:string)=>{assertScene(id);return source.sceneMaterial(id);},
  material:async(id,action)=>{assertScene(id);await source.material(id,action);},
  select:(id,entity,binding)=>{assertScene(id);source.select(id,entity,binding);},
  move:async(id,entity,position)=>{assertScene(id);await source.move(id,entity,position);},
  read:async request=>{assertCanvasBasis(source,basis,false);const current=canvasBasis(source,sceneId);if(request.expression_ref!==current.expressionRef||request.scene_ref!==current.sceneRef||request.revision!==current.revision)throw Error('Canvas read addressed a stale or different Scene.');return source.read(request);},
 } satisfies ResearchInstrumentsHost;
 // Wrap every scene-specific optional verb rather than falling back to an unrelated current selection.
 for(const key of ['moveMany','createNote','duplicateOccurrence','deleteOccurrence','updateContent','connect','reconnect','deleteConnection','updateConnectionKind','updateConnectionDirectionality','editObject','relateKnowledge','transformBlueprint','releaseBlueprint','pinEntity'] as const){
  const fn=source[key];if(fn)(adapter as unknown as Record<string,unknown>)[key]=(id:string,...args:unknown[])=>{assertScene(id);const current=source[key];if(!current)throw Error('The native owner withdrew this Canvas operation.');return (current as (...args:unknown[])=>unknown).call(source,id,...args);};
 }
 if(source.pageMembers)adapter.pageMembers=async delta=>{assertCanvasBasis(source,basis,false);if(source.sceneId()!==sceneId)throw Error('Select the pinned Scene in its native owner before paging members.');return source.pageMembers!(delta);};
 return adapter;
}
