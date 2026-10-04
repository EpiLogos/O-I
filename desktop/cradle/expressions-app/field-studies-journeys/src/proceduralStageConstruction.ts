/** Explicit human construction intent for the actual ql.procedural-library/v1.
 * These rows contain authored slot/Scene IDs and existing native state IDs;
 * they carry no Source proof, graph, timing, receipt or application authority. */
import {clone} from './model';
import {studioBasis,type StudioSnapshot} from './proceduralStudio';
import {retention} from './proceduralRetention';
import {sameNative} from './proceduralProtocol';
import type {LibraryChoice} from './proceduralStageSource';

export type SceneOutput=Extract<LibraryChoice,{recipe:'scene_material'}>['outputs'][number];
export type SequenceHold=Extract<LibraryChoice,{recipe:'sequence_material'}>['holds'][number];
export interface SequenceHoldTarget {entity_ref:string;step_ref:string|null;label:string;loaded:boolean;}
const key=(row:Pick<SequenceHold,'entity_ref'|'step_ref'>)=>JSON.stringify([row.entity_ref,row.step_ref]);
const text=(value:unknown):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=4096&&!/[\u0000-\u001f\u007f]/.test(value);

/** Uses the accepted native presentation, never default-filled view material.
 * Names and loaded status join only through the actual KernelConversion. */
export function sequenceHoldTargets(snapshot:StudioSnapshot):SequenceHoldTarget[]{
 const basis=studioBasis(snapshot),scene=snapshot.view.document.scenes.find(s=>s.scene_ref===basis.scene_ref);
 const entities=scene?.presentation?.scene?.entities;
 if(!scene||!Array.isArray(entities))throw Error('The current native Scene has no retained sequence material');
 const binding=snapshot.view.bindings[snapshot.sceneId],view=snapshot.journey.scenes.find(s=>s.id===snapshot.sceneId);
 const rows:SequenceHoldTarget[]=[],seen=new Set<string>();
 for(const raw of entities){
  const e=raw as {id?:unknown;name?:unknown;sequence?:{steps?:unknown[]}};
  if(!text(e.id)||!scene.entity_refs.includes(e.id)||!snapshot.view.document.entities[e.id])throw Error('The retained sequence Entity differs from its native Scene membership');
  if(!e.sequence||!Array.isArray(e.sequence.steps))throw Error('The retained native Entity has no sequence states');
  const occurrences=binding.occurrences.filter(o=>o.entity_ref===e.id),occurrence=occurrences[0],material=view?.entities.find(e=>e.id===occurrence?.view_entity_id);
  if(occurrences.length>1||(occurrence&&(!binding.loaded_refs.includes(e.id)||!material)))throw Error('The loaded native sequence correspondence is disconnected');
  const name=material?.name??(text(e.name)?e.name:e.id),loaded=!!occurrence;
  const add=(step_ref:string|null,label:string)=>{const row={entity_ref:e.id as string,step_ref,label:`${name} · ${label}${loaded?'':' · outside the loaded page'}`,loaded};if(seen.has(key(row)))throw Error('Native sequence coordinates are ambiguous');seen.add(key(row));rows.push(row);};
  add(null,'sequence hold');
  for(const rawStep of e.sequence.steps){const step=rawStep as {id?:unknown;name?:unknown;text?:unknown};if(!text(step.id))throw Error('Native sequence state identity is missing');add(step.id,`state ${text(step.name)?step.name:text(step.text)?step.text:step.id} · ${step.id}`);}
 }
 return rows;
}

export function validateSceneOutputs(snapshot:StudioSnapshot,outputs:readonly SceneOutput[],options:{max_active_instances:number;action:'prepare'|'regenerate';procedure_ref:string}):SceneOutput[]{
 const expression=studioBasis(snapshot).expression_ref,existing=new Set(snapshot.view.document.scenes.map(s=>s.scene_ref));
 if(!Number.isSafeInteger(options.max_active_instances)||options.max_active_instances<1||!outputs.length||outputs.length>options.max_active_instances||outputs.length>64)throw Error('Scene outputs exceed the actual native rule or 64-Scene document budget');
 const slots=new Set<string>(),refs=new Set<string>();let additions=0;
 const contributions=snapshot.view.document.scenes.flatMap(scene=>scene.presentation?.scene?retention(scene.presentation.scene).contributions:[]);
 for(const row of outputs){
  if(!text(row.output_slot)||!text(row.scene_ref)||!row.scene_ref.startsWith(`${expression}:scene:`)||slots.has(row.output_slot)||refs.has(row.scene_ref))throw Error('Enter distinct stable output slots and exact Scene references in this Expression');
  slots.add(row.output_slot);refs.add(row.scene_ref);
  if(existing.has(row.scene_ref)){
   const owned=contributions.filter(c=>c.procedure_ref===options.procedure_ref&&c.output_slot===row.output_slot&&c.occurrence_ref===row.scene_ref&&c.status==='active'&&c.owned_addresses.some(a=>a.expression_ref===expression&&a.scene_ref===row.scene_ref&&a.component==='scene'&&a.entity_ref===null&&a.property===null));
   if(options.action!=='regenerate'||new Set(owned.map(c=>c.contribution_ref)).size!==1)throw Error('An existing Scene is not this exact active generated slot; retain its authored material');
  }else additions++;
 }
 if(existing.size+additions>64)throw Error('The passage would exceed the actual native 64-Scene document budget');
 return clone(outputs as SceneOutput[]);
}

export function validateSequenceHolds(snapshot:StudioSnapshot,holds:readonly SequenceHold[]):SequenceHold[]{
 if(!holds.length||holds.length>2048)throw Error('Choose one or more explicit sequence targets within the native 2048-edit budget');
 const targets=new Set(sequenceHoldTargets(snapshot).map(key)),seen=new Set<string>();
 for(const hold of holds){const id=key(hold);if(!targets.has(id)||seen.has(id))throw Error('A sequence target disappeared, belongs elsewhere or is repeated; retain the original intent');seen.add(id);if(typeof hold.seconds!=='number'||!Number.isFinite(hold.seconds)||hold.seconds<0||hold.seconds>3600)throw Error('Sequence hold must be within the native 0–3600 second domain');}
 return clone(holds as SequenceHold[]);
}

/** Explicitly reload an original retained native program into editable intent.
 * Its historic source/program remains untouched and supplies no current grant. */
export function retainedMaterialChoice(definition:unknown):Extract<LibraryChoice,{recipe:'scene_material'|'sequence_material'}>{
 const program=(definition as {recipe_parameters?:{native_program?:{recipe?:unknown;outputs?:Array<{output_slot:unknown;scene_ref:unknown;sequence_holds?:SequenceHold[]}>}}}|null)?.recipe_parameters?.native_program;
 if(program?.recipe!=='scene_material'||!Array.isArray(program.outputs)||!program.outputs.length)throw Error('This saved native definition has no material output program');
 const outputs=program.outputs.map(row=>{if(!text(row.output_slot)||!text(row.scene_ref)||!Array.isArray(row.sequence_holds))throw Error('The original native output coordinates or sequence edits are incomplete');return {output_slot:row.output_slot,scene_ref:row.scene_ref};});
 const holds=program.outputs[0].sequence_holds!;
 if(program.outputs.some(row=>!sameNative(row.sequence_holds,holds)))throw Error('This original native program uses different holds per output; the shared-hold library cannot represent it without changing intent');
 if(holds.some(h=>!text(h.entity_ref)||(h.step_ref!==null&&!text(h.step_ref))||!Number.isFinite(h.seconds)||h.seconds<0||h.seconds>3600))throw Error('The original native sequence hold is malformed');
 return clone(holds.length?{recipe:'sequence_material',outputs,holds}:{recipe:'scene_material',outputs});
}

export interface StageConstructionEditor {panel:HTMLElement;refresh(snapshot:StudioSnapshot|null,sequence:boolean):void;outputs():SceneOutput[];holds():SequenceHold[];load(choice:Extract<LibraryChoice,{recipe:'scene_material'|'sequence_material'}>):void;dispose():void;}
export function installStageConstructionEditor(report:(message:string)=>void):StageConstructionEditor {
 const panel=document.createElement('section');panel.className='stage-construction';panel.setAttribute('aria-label','Passage outputs and sequence holds');
 const outputsHost=document.createElement('div'),holdsHost=document.createElement('div'),outputs=new Set<{node:HTMLElement;slot:HTMLInputElement;scene:HTMLInputElement}>(),holds=new Set<{node:HTMLElement;target:HTMLSelectElement;seconds:HTMLInputElement}>();
 let snapshot:StudioSnapshot|null=null,disposed=false;
 const button=(title:string,action:()=>void)=>{const node=document.createElement('button');node.type='button';node.textContent=title;node.addEventListener('click',()=>{if(disposed)return;try{action();}catch(error){report(error instanceof Error?error.message:String(error));}});return node;};
 const label=(title:string,input:HTMLElement)=>{const node=document.createElement('label');node.className='control';const caption=document.createElement('span');caption.textContent=title;node.append(caption,input);return node;};
 const input=(title:string)=>{const node=document.createElement('input');node.setAttribute('aria-label',title);return node;};
 function addOutput(value?:SceneOutput){if(outputs.size>=64)throw Error('The native document admits at most 64 output Scenes');const node=document.createElement('div'),slot=input('Stable output slot'),scene=input('Exact output Scene reference'),row={node,slot,scene};slot.value=value?.output_slot??'';scene.value=value?.scene_ref??'';node.append(label('Stable output slot',slot),label('Exact output Scene reference',scene),button('Remove this output intent',()=>{outputs.delete(row);node.remove();}));outputs.add(row);outputsHost.append(node);}
 function updateTarget(row:{target:HTMLSelectElement}){const value=row.target.value,targets=snapshot?sequenceHoldTargets(snapshot):[],choices=targets.map(t=>[key(t),t.label] as const);if(value&&!choices.some(([id])=>id===value))choices.push([value,'Original target is no longer admitted; input retained']);const next=[['','Choose an actual native sequence/state'] as const,...choices];if(row.target.options.length!==next.length||[...row.target.options].some((o,i)=>o.value!==next[i][0]||o.textContent!==next[i][1]))row.target.replaceChildren(...next.map(([id,title])=>{const option=document.createElement('option');option.value=id;option.textContent=title;return option;}));row.target.value=value;}
 function addHold(value?:SequenceHold){if(holds.size>=2048)throw Error('The native sequence edit budget is full');const node=document.createElement('div'),target=document.createElement('select'),seconds=input('Sequence hold in seconds'),row={node,target,seconds};target.setAttribute('aria-label','Actual native sequence target');seconds.type='number';seconds.step='any';seconds.min='0';seconds.max='3600';if(value){const option=document.createElement('option');option.value=key(value);target.append(option);target.value=option.value;seconds.value=String(value.seconds);}node.append(label('Sequence/state',target),label('Hold · seconds',seconds),button('Remove this hold intent',()=>{holds.delete(row);node.remove();}));holds.add(row);holdsHost.append(node);updateTarget(row);}
 const heading=document.createElement('p');heading.className='control-note';heading.textContent='Each output is an explicit stable slot and native Scene reference. The native Source owner constructs the material and admits its scope; these fields do not issue Source or timing authority.';
 outputsHost.append(button('Add Scene output',()=>addOutput()));holdsHost.append(button('Add sequence hold',()=>addHold()));panel.append(heading,outputsHost,holdsHost);
 return {panel,refresh(next,sequence){snapshot=next;holdsHost.hidden=!sequence;for(const row of holds)updateTarget(row);},outputs:()=>[...outputs].map(row=>({output_slot:row.slot.value,scene_ref:row.scene.value})),holds:()=>[...holds].map(row=>{if(!row.target.value||!row.seconds.value.trim())throw Error('Choose an exact retained sequence target and explicit hold');const [entity_ref,step_ref]=JSON.parse(row.target.value);return {entity_ref,step_ref,seconds:Number(row.seconds.value)};}),load(choice){for(const row of outputs)row.node.remove();for(const row of holds)row.node.remove();outputs.clear();holds.clear();choice.outputs.forEach(addOutput);if(choice.recipe==='sequence_material')choice.holds.forEach(addHold);},dispose(){disposed=true;snapshot=null;}};
}
