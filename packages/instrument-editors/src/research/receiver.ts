import {assertCanvasBasis,canvasBasis,bindResearchHost,type ResearchInstrumentsHost} from '../canvas/adapter';
import {assertInstrumentReadingScope} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchInstrumentsData';
import {researchOverview} from './overview';
import type {ResearchOperations} from './operations';
/** Observes the actual renderer read, rechecking native scope after return. */
export function receiveResearchHost(source:ResearchInstrumentsHost,sceneId:string,slots:Pick<ResearchInstrumentsHost,'container'|'tools'|'inspector'|'canvasHome'|'placesHome'>,operations:ResearchOperations,onReading:(overview:ReturnType<typeof researchOverview>,basis:ReturnType<typeof canvasBasis>)=>void,onRefusal?:(message:string)=>void){
 const bound=bindResearchHost(source,sceneId,slots);
 const retained=canvasBasis(source,sceneId);
 const contextAction=(run:()=>void)=>{try{assertCanvasBasis(source,retained,false);if(source.sceneId()!==sceneId)throw Error('Select the pinned Scene in its native owner before opening its source.');run();}catch(error){if(!onRefusal)throw error;onRefusal(error instanceof Error?error.message:String(error));}};
 return {...bound,...slots,
  // The original generic source-open functions use the owner's current
  // context. Never lend a pinned reading another active Scene's context.
  inspectSubject:(ref:string,context?:Parameters<ResearchInstrumentsHost['inspectSubject']>[1])=>contextAction(()=>source.inspectSubject(ref,context)),
  openSubject:(ref:string)=>contextAction(()=>source.openSubject(ref)),
  select:(id:string,entity:string|null,binding?:string)=>contextAction(()=>bound.select(id,entity,binding)),
  read:async(request:Parameters<ResearchInstrumentsHost['read']>[0])=>{
   const basis=canvasBasis(source,sceneId),view=source.nativeView();
   const raw=await bound.read(request);assertCanvasBasis(source,basis);
   if(!request.facet){assertInstrumentReadingScope(raw,view,sceneId);onReading(researchOverview(raw),basis);}
   return raw;
  },
  material:(id:string,action:Parameters<ResearchInstrumentsHost['material']>[1])=>operations.run(action,()=>bound.material(id,action)),
 } satisfies ResearchInstrumentsHost;
}
