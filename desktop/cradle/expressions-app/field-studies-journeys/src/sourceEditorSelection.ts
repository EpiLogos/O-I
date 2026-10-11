import type {NativeEditorReading,NativeEditorRequest} from '../../../../../packages/expressions-boundary/src/editor';

type SelectRequest=Extract<NativeEditorRequest,{operation:'select'}>;
export interface SourceEditorSelectionContext {
 owner:object|null;
 nativeOwner:object|null;
 navigation:number;
 sourceEpoch:number;
 visible:boolean;
 reading:NativeEditorReading;
}
/** The Image Suite selects through the same admitted native editor as Clip.
 * Native CAS/readback stay with that owner; this guards only its source cut. */
export function createSourceEditorSelection(options:{
 context():SourceEditorSelectionContext;
 select(request:SelectRequest,isCurrent:()=>boolean):Promise<void>;
}) {
 let pending=false;
 return {
  async select(entity_id:string,step_id:string):Promise<'applied'|'superseded'> {
   const captured=options.context(),reading=captured.reading;
   if(!captured.visible||!captured.owner||!captured.nativeOwner)throw Error('The native Source editor is no longer presented');
   if(pending)throw Error('A native Source selection is awaiting acknowledgement; the current source was retained');
   const entity=reading.scene.entities.find(row=>row.id===entity_id&&row.kind==='formation');
   if(!entity||!reading.entityOccurrences[entity_id]||!entity.sequence.steps.some(step=>step.id===step_id))throw Error('This stable source state has no captured native occurrence');
   const occurrence=reading.entityOccurrences[entity_id],selected=[...reading.selection.entity_ids],selectedStep=reading.selection.step_id;
   const current=()=>{
    const now=options.context(),basis=now.reading.basis;
    return now.visible&&now.owner===captured.owner&&now.nativeOwner===captured.nativeOwner
     &&now.navigation===captured.navigation&&now.sourceEpoch===captured.sourceEpoch
     &&basis.expression_ref===reading.basis.expression_ref&&basis.scene_ref===reading.basis.scene_ref
     &&basis.authored_revision===reading.basis.authored_revision
     &&now.reading.entityOccurrences[entity_id]===occurrence
     &&now.reading.scene.entities.some(row=>row.id===entity_id&&row.kind==='formation'&&row.sequence.steps.some(step=>step.id===step_id))
     &&now.reading.selection.step_id===selectedStep&&now.reading.selection.entity_ids.length===selected.length
     &&now.reading.selection.entity_ids.every((id,index)=>id===selected[index]);
   };
   pending=true;
   try {
    if(!current())return 'superseded';
    // The retained owner validates native revision and exact selection after
    // ACK. Its own focus revision may advance while local authoring stays put.
    await options.select({operation:'select',basis:{...reading.basis},entity_id,step_id},current);
    return 'applied';
   } catch(cause) {
    if(!current())return 'superseded';
    throw cause;
   } finally {pending=false;}
  },
 };
}
