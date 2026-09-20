/** Nara's consumer of the existing native ExpressionWorld. No renderer-owned
 * graph, act or checkpoint is substituted for the native operation/result. */
import type {ExpressionDocument} from "../expression/types";
import type {WorldRequest,WorldSelection} from "../expression/world";
import {isAdmitted,validateDialogueContext,type NaraDialogueContext} from "./dialogueContext";
import {abortCheck} from "./nativeDialogue";

export interface PresentationPorts {
  read(expressionRef:string):Promise<ExpressionDocument>;
  world(request:WorldRequest):Promise<Record<string,unknown>>;
}
export interface PresentationState {
  state:"idle"|"running"|"held"|"unknown";
  act_ref:string|null;completed_refs:string[];cancelled_refs:string[];
  checkpoint_ref:string|null;revision:number|null;
}
function documentBasis(document:ExpressionDocument,context:NaraDialogueContext):void {
  if(document.schema!=="oi.expression/v1"||document.expression_ref!==context.expression_ref||String(document.revision)!==context.expression_revision)
    throw new Error("Expression changed since this context was reviewed; nothing was applied");
}
/** Invoked ONLY by an explicit Include selection action. No source body is
 * fetched, and merely moving the pointer never discloses private material. */
export function selectedContext(context:NaraDialogueContext,document:ExpressionDocument,selection:WorldSelection|undefined):NaraDialogueContext {
  if(document.expression_ref!==context.expression_ref)throw new Error("Selection belongs to another Expression");
  if(!selection||selection.expression_ref!==context.expression_ref)throw new Error("No exact shared selection is bound to this Expression");
  if(!selection.subject_ref||!selection.revision)throw new Error("Selection has no source-qualified revision");
  // Refs and revisions are disclosed, never source content or inferred state.
  const next=structuredClone(context);
  next.context_ref=`dialogue-context/selection-${crypto.randomUUID()}`;
  next.expression_revision=String(document.revision);next.scene_ref=document.selection.scene_ref;
  next.pointed_ref=selection.subject_ref;next.hovered_ref=null;next.expressive_act=null;
  // Do not silently keep the previous selected source in the next packet.
  next.disclosed=next.disclosed.filter(item=>item.disclosed_via_ref!=="oi:nara:explicit-selection");
  if(!next.disclosed.some(item=>item.ref_id===selection.subject_ref))next.disclosed.push({ref_id:selection.subject_ref,revision:selection.revision,standing:"observed",disclosure:"personal-consent",disclosed_via_ref:"oi:nara:explicit-selection"});
  return validateDialogueContext(next);
}

export class NaraPresentation {
  private ports:PresentationPorts;
  private generation=0;
  private preparing=false;
  private inFlight:Promise<void>|null=null;
  private context:NaraDialogueContext|null=null;
  private value:PresentationState={state:"idle",act_ref:null,completed_refs:[],cancelled_refs:[],checkpoint_ref:null,revision:null};
  constructor(ports:PresentationPorts){this.ports=ports;}
  get state():PresentationState{return structuredClone(this.value);}
  /** Exact source subject focus is the only effect this application adapter
   * accepts. Native Action proposals are not silently converted to focus. */
  async perform(context:NaraDialogueContext,refs:string[],signal:AbortSignal):Promise<NaraDialogueContext> {
    if(this.preparing||this.inFlight||this.value.state==="running"||this.value.state==="unknown")throw new Error("An atomic Expression operation is still pending or uncertain; reconcile native state first");
    if(!refs.length||refs.length>16||new Set(refs).size!==refs.length)throw new Error("Choose a bounded set of distinct focus references");
    const current=validateDialogueContext(structuredClone(context));
    for(const ref of refs)if(!isAdmitted(current,ref))throw new Error("A proposed focus is outside the currently permitted context");
    const generation=++this.generation;
    this.preparing=true;
    let document:ExpressionDocument;
    try {
      document=await this.ports.read(current.expression_ref);documentBasis(document,current);abortCheck(signal);
      if(generation!==this.generation)throw new DOMException("Presentation was held during preparation","AbortError");
    } finally {this.preparing=false;}
    // Validate every target before the first mutation. Ambiguous mappings are
    // refused, not resolved by silently taking the first entity or EarthBody.
    const targets=refs.map(ref=>{
      const entities=Object.values(document.entities).filter(entity=>entity.subject?.subject_ref===ref);
      if(entities.length!==1)throw new Error(`Focus ${ref} has no unique bound entity; no substitute was selected`);
      const scenes=document.scenes.filter(scene=>scene.entity_refs.includes(entities[0].entity_ref));
      const scene=scenes.find(scene=>scene.scene_ref===document.selection.scene_ref)??(scenes.length===1?scenes[0]:undefined);
      if(!scene)throw new Error(`Focus ${ref} has no unambiguous scene`);
      return {ref,entity:entities[0].entity_ref,scene:scene.scene_ref};
    });
    const act=this.value.act_ref??`expressive-act/nara-${crypto.randomUUID()}`;
    this.context=current;this.value={...this.value,state:"running",act_ref:act,completed_refs:[],cancelled_refs:[],revision:document.revision};
    let expected=document.revision;
    for(let index=0;index<targets.length;index++){
      if(signal.aborted||generation!==this.generation){this.value.cancelled_refs=targets.slice(index).map(target=>target.ref);break;}
      const target=targets[index];
      const step=(async()=>{
        if(index>0)await this.expect({operation:"act_interrupt",act_ref:act,actor:current.nara_ref,reason:"advance reviewed focus sequence"},"act_held");
        // Interrupt may have arrived while the previous hold was acknowledged.
        if(signal.aborted||generation!==this.generation){this.value.cancelled_refs=targets.slice(index).map(item=>item.ref);return;}
        await this.expect({operation:"act_perform",act_ref:act,expression_ref:current.expression_ref,expected_revision:expected,
          summary:"Reviewed Nara focus",actor:current.nara_ref,changes:[{change:"focus",scene_ref:target.scene,entity_ref:target.entity}]},"act_running");
        const after=await this.ports.read(current.expression_ref);
        if(after.selection.scene_ref!==target.scene||after.selection.entity_ref!==target.entity||after.revision<=expected)throw new Error("Native focus readback did not match the performed step");
        expected=after.revision;this.value.revision=expected;this.value.completed_refs.push(target.ref);
        current.expression_revision=String(expected);current.scene_ref=target.scene;current.pointed_ref=target.ref;current.expressive_act=null;
      })();
      this.inFlight=step;
      try{await step;}catch(error){this.value.state="unknown";this.value.cancelled_refs=targets.slice(index+1).map(item=>item.ref);throw error;}
      finally{if(this.inFlight===step)this.inFlight=null;}
    }
    try {await this.expect({operation:"act_interrupt",act_ref:act,actor:current.nara_ref,reason:"reviewed sequence held"},"act_held");}
    catch(error){this.value.state="unknown";throw error;}
    this.value.state="held";this.context=current;
    return validateDialogueContext(structuredClone(current));
  }
  async hold():Promise<void> {
    ++this.generation;
    // A sent atomic edit may finish. Do not report it cancelled or restore
    // over it; wait for the exact receipt, then hold the native act.
    try{await this.inFlight;}catch{this.value.state="unknown";throw new Error("An atomic Expression edit has unknown outcome");}
    if(!this.value.act_ref||!this.context)return;
    await this.expect({operation:"act_interrupt",act_ref:this.value.act_ref,actor:this.context.nara_ref,reason:"personal interruption"},"act_held");this.value.state="held";
  }
  async checkpoint():Promise<void> {
    if(this.inFlight||this.value.state!=="held"||!this.value.act_ref||!this.context)throw new Error("Hold an actually performed Expression act before taking a checkpoint");
    const live=await this.ports.read(this.context.expression_ref);documentBasis(live,this.context);
    const ref=`checkpoint/nara-${crypto.randomUUID()}`;
    await this.expect({operation:"act_checkpoint",act_ref:this.value.act_ref,checkpoint_ref:ref,actor:this.context.nara_ref},"checkpointed");
    this.value.checkpoint_ref=ref;
  }
  async restore():Promise<NaraDialogueContext> {
    if(this.inFlight||this.value.state!=="held"||!this.value.act_ref||!this.value.checkpoint_ref||!this.context)throw new Error("No confirmed native checkpoint is available");
    const live=await this.ports.read(this.context.expression_ref);documentBasis(live,this.context);
    await this.expect({operation:"act_restore",act_ref:this.value.act_ref,checkpoint_ref:this.value.checkpoint_ref,expected_revision:live.revision,actor:this.context.nara_ref},"act_restored");
    const after=await this.ports.read(this.context.expression_ref);
    if(after.revision<=live.revision)throw new Error("Native restore did not advance the revision");
    this.value.revision=after.revision;this.context={...this.context,expression_revision:String(after.revision),scene_ref:after.selection.scene_ref,expressive_act:null};
    return structuredClone(this.context);
  }
  private async expect(request:WorldRequest,state:string):Promise<void> {
    const response=await this.ports.world(request);
    if(response.state!==state)throw new Error(`Native Expression operation did not return ${state} (${String(response.state??"unknown")})`);
  }
}
