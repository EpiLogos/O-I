/** Explicit controls over the existing native Scene blueprint, in the shared
 * native-work panel. Form values are transient; the Scene remains the owner. */
import type {KernelConversion} from './kernelDocumentBridge.js';
import {prepareBlueprintEdit,type BlueprintIntent} from './nativeBlueprint.js';
import {readSceneBlueprint} from './kernelExpressions.js';
import {WORLD_SCALE} from './nativeParameters.js';
import type {SceneBlueprint} from './blueprintGeometry.js';

const BASE_SIZE=110;
export interface BlueprintControls {translation:[number,number,number];rotationDegrees:[number,number,number];size:number}
function address(view:KernelConversion,sceneId:string){
 const scene_ref=view.bindings[sceneId]?.scene_ref;
 if(!scene_ref)throw Error('Choose an open native Scene before changing its blueprint');
 return {expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref};
}
function bindingOf(view:KernelConversion,sceneId:string):SceneBlueprint|undefined{
 const {scene_ref}=address(view,sceneId);
 return view.document.scenes.find(scene=>scene.scene_ref===scene_ref)?.presentation?.scene.composition.blueprint;
}
export function blueprintTransformIntent(view:KernelConversion,sceneId:string,controls:BlueprintControls):BlueprintIntent{
 if(!Array.isArray(controls.translation)||controls.translation.length!==3||!controls.translation.every(Number.isFinite)
  ||!Array.isArray(controls.rotationDegrees)||controls.rotationDegrees.length!==3||!controls.rotationDegrees.every(Number.isFinite)||!Number.isFinite(controls.size))throw Error('Enter finite position, rotation and size values');
 const intent:BlueprintIntent={...address(view,sceneId),operation:'transform',transform:{
  translation:controls.translation.map(value=>value*WORLD_SCALE) as [number,number,number],
  rotation:controls.rotationDegrees.map(value=>value*Math.PI/180) as [number,number,number],scale:controls.size*BASE_SIZE,
 }};
 prepareBlueprintEdit(view,intent); // the same native-bound edit law as submission
 return intent;
}
export interface BlueprintHUDHost {
 container:HTMLElement;
 nativeView:()=>KernelConversion|undefined;
 sceneId:()=>string;
 apply:(intent:BlueprintIntent)=>Promise<void>;
}
export function installBlueprintHUD(host:BlueprintHUDHost){
 const section=document.createElement('fieldset');section.id='scene-blueprint-controls';section.tabIndex=-1;
 section.innerHTML='<legend>Blueprint</legend><p data-blueprint-summary></p><p role="status" aria-live="polite" data-blueprint-status></p>'
  +'<button type="button" data-blueprint="bind">Bind sixfold roles</button><div data-blueprint-transform>'
  +'<p>Move, rotate and resize the assigned roles together.</p>'
  +['Position','Rotation'].map((group,index)=>'<div class="native-actions">'+['X','Y','Z'].map((axis,i)=>`<label>${group} ${axis}${index?' (°)':''}<input type="number" step="${index?'1':'0.05'}" data-blueprint-field="${index?'rotation':'position'}-${i}"></label>`).join('')+'</div>').join('')
  +'<label>Relative size<input type="number" step="0.05" min="0.0001" data-blueprint-field="size"></label>'
  +'<div class="native-actions"><button type="button" data-blueprint="transform">Apply whole transform</button><button type="button" data-blueprint="release">Release blueprint</button></div><p>Release keeps the current positions.</p></div>';
 host.container.insertBefore(section,host.container.querySelector('fieldset'));
 const summary=section.querySelector<HTMLElement>('[data-blueprint-summary]')!,status=section.querySelector<HTMLElement>('[data-blueprint-status]')!;
 const transform=section.querySelector<HTMLElement>('[data-blueprint-transform]')!,bind=section.querySelector<HTMLButtonElement>('[data-blueprint="bind"]')!;
 const field=(name:string)=>section.querySelector<HTMLInputElement>(`[data-blueprint-field="${name}"]`)!;
 let busy=false,key='',disposed=false;
 const current=()=>{const view=host.nativeView();if(!view)throw Error('Open a native Scene before changing its blueprint');return {view,sceneId:host.sceneId()};};
 const controls=():BlueprintControls=>({translation:[0,1,2].map(i=>field(`position-${i}`).valueAsNumber) as [number,number,number],rotationDegrees:[0,1,2].map(i=>field(`rotation-${i}`).valueAsNumber) as [number,number,number],size:field('size').valueAsNumber});
 const refresh=(force=false)=>{
  if(disposed||busy)return;
  try{
   const {view,sceneId}=current(),basis=address(view,sceneId),next=JSON.stringify(basis);
   if(!force&&next===key)return;key=next;
   const binding=bindingOf(view,sceneId);bind.hidden=!!binding;bind.disabled=false;transform.hidden=!binding;
   summary.textContent=binding?`${binding.members.length} sixfold roles move together.`:'Bind the roles already assigned in this Scene’s sixfold constellation.';
   status.textContent='';
   if(binding){for(let i=0;i<3;i++){field(`position-${i}`).value=String(binding.transform.translation[i]/WORLD_SCALE);field(`rotation-${i}`).value=String(binding.transform.rotation[i]*180/Math.PI);}field('size').value=String(binding.transform.scale/BASE_SIZE);}
  }catch(cause){key='';summary.textContent=cause instanceof Error?cause.message:String(cause);bind.hidden=false;bind.disabled=true;transform.hidden=true;status.textContent='';}
 };
 const click=async(event:Event)=>{
  const action=(event.target as HTMLElement).closest<HTMLElement>('[data-blueprint]')?.dataset.blueprint;if(!action||!['bind','transform','release'].includes(action)||busy)return;
  busy=true;section.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button').forEach(input=>{input.disabled=true;});status.textContent=action==='bind'?'Reading assigned native roles…':'Saving blueprint…';
  let message='',acknowledged=false;
  try{
   const {view,sceneId}=current(),basis=address(view,sceneId);
   let intent:BlueprintIntent;
   if(action==='bind'){
    const proposal=await readSceneBlueprint(basis),latest=current();
    if(JSON.stringify(address(latest.view,latest.sceneId))!==JSON.stringify(basis))throw Error('The native Scene changed while reading its roles; try again');
    intent={...basis,operation:'bind',binding:proposal.binding};
   }else if(action==='release')intent={...basis,operation:'release'};
   else intent=blueprintTransformIntent(view,sceneId,controls());
   if(disposed)throw Error('The blueprint controls closed before this action could be submitted');
   await host.apply(intent);acknowledged=true;message=action==='release'?'Blueprint released. Positions retained.':action==='bind'?'Sixfold roles bound.':'Whole transform saved.';
  }catch(cause){message=cause instanceof Error?cause.message:String(cause);}
  // A refused proposal remains editable against the same native basis. A
  // changed Scene/revision still refreshes normally; only our acknowledgement
  // forces a refresh when that basis is unchanged (for example a no-op).
  finally{busy=false;if(!disposed){section.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button').forEach(input=>{input.disabled=false;});refresh(acknowledged);status.textContent=message;}}
 };
 const listener=(event:Event)=>{void click(event);};section.addEventListener('click',listener);refresh();
 return {
  open(){host.container.hidden=false;refresh();section.scrollIntoView({block:'nearest'});section.focus();},
  refresh,
  destroy(){disposed=true;section.removeEventListener('click',listener);section.remove();},
 };
}
