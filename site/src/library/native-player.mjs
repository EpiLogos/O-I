/** Browser host of the same production adapter used by the native Expressions
 * instrument. No document mutation API; camera/clock/selection are view state. */
import { ProductionAdapter } from '@epilogos/oi-design-system/expressions-engine/oi/retained.mjs';
import { blankScene } from '@epilogos/oi-design-system/expressions-engine/shell/model.mjs';
import { nativeExport, nativeSnapshotToJourney } from '@epilogos/oi-design-system/expressions-engine/shell/nativeBridge.mjs';
import { defaultCamera, project } from '@epilogos/oi-design-system/expressions-engine/shell/camera.mjs';
// Paths are resolved by Vite's native-engine alias; renderer ownership is unchanged.
const base=nativeExport(blankScene()).config;
export function projectComposition(composition,sceneRef) {
 const scene=composition.scenes.find(s=>s.scene_ref===sceneRef);
 if(!scene)throw new Error('This Scene is no longer available.');
 if(scene.entity_refs.length>10)throw new Error('This Scene exceeds the available formation capacity.');
 const automations=[];
 const entities=scene.entity_refs.map((ref,index)=>{
  const entity=composition.entities[ref];if(!entity)throw new Error('An Expression object is missing.');
  const at=(key,value)=>entity.parameters[key]?.value??value;
  for(const [key,p] of Object.entries(entity.parameters))if(p.automation){const a=p.automation;automations.push({id:`${ref}:automation:${key}`,path:`entities.${index}.${key}`,enabled:true,type:'lfo',waveform:a.waveform,min:a.min,max:a.max,rateHz:a.rate_hz,phase:0,blend:'replace'});}
  return {id:ref,name:entity.title,kind:'formation',enabled:true,x:at('x',0),y:at('y',0),z:at('z',0),scale:at('scale',1),share:at('share',1),shape:{kind:'glyph',text:at('glyph','O')},sequence:{advance:'off',links:[]}};
 });
 const config={...structuredClone(base),sourceType:'composition',glyph:' ',particleCount:8192,entities,automations,backgroundColor:'#f4f2ec',colorMode:'monochrome'};
 const result=nativeSnapshotToJourney({name:scene.title,config}).scenes[0];
 result.id=scene.scene_ref;result.transition=.8;
 return result;
}
export class PublicField {
 constructor(canvas,onError,onPositions,onTick){
  this.canvas=canvas;this.onError=onError;this.onPositions=onPositions;this.onTick=onTick;
  this.adapter=new ProductionAdapter(canvas);this.camera=defaultCamera();this.raf=0;this.last=0;this.active=false;this.playing=true;this.scene=null;this.selected=[];this.frames=0;this.disposed=false;
  this.visibility=()=>{this.last=0;this.schedule();};document.addEventListener('visibilitychange',this.visibility);
  this.resize=new ResizeObserver(()=>{const r=canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.adapter.resize(this.width,this.height,Math.min(devicePixelRatio||1,1.5));this.schedule();});this.resize.observe(canvas);
 }
 setScene(composition,ref,camera){
  const changed=this.scene?.id!==ref;
  this.scene=projectComposition(composition,ref);this.revision=composition.revision;
  if(changed){this.camera=defaultCamera();if(camera)this.camera={...this.camera,...camera};else if(this.scene.entities.length===1){const p=this.scene.entities[0].position;this.camera.zoom=1.5;this.fitPoint=p;}else this.camera.zoom=.85;}
  this.schedule();
 }
 setActive(active){this.active=active;this.last=0;this.schedule();}
 setPlaying(playing){this.playing=playing;this.last=0;this.schedule();}
 setSelected(ref){this.selected=ref?[ref]:[];this.schedule();}
 view(change){Object.assign(this.camera,change);this.fitPoint=null;this.schedule();}
 home(){this.camera=defaultCamera();this.camera.zoom=this.scene?.entities.length===1?1.5:.85;this.fitPoint=this.scene?.entities.length===1?this.scene.entities[0].position:null;this.schedule();}
 recover(){this.adapter.command({type:'recover-context'});this.failed=false;this.last=0;this.schedule();}
 schedule(){cancelAnimationFrame(this.raf);this.raf=0;if(!this.disposed&&this.active&&!document.hidden&&!this.failed&&this.scene)this.raf=requestAnimationFrame(t=>this.frame(t));}
 frame(now){
  if(this.disposed||!this.active||document.hidden||!this.scene)return;
  const delta=this.last&&this.playing?Math.min(.05,(now-this.last)/1000):0;this.last=now;
  try{
   if(this.fitPoint){const p=project(this.fitPoint,{...this.camera,panX:0,panY:0},this.width,this.height);this.camera.panX=this.width*.51-p.x;this.camera.panY=this.height*.48-p.y;this.fitPoint=null;}
   this.adapter.render({scene:this.scene,delta,authoringRevision:this.revision,camera:this.camera,pointer:{active:false,world:{x:0,y:0,z:0}},selectedIds:this.selected,scaffold:'off'});
   this.frames++;this.canvas.dataset.rendered='true';this.canvas.dataset.frames=String(this.frames);
   this.onPositions(this.scene.entities.map(e=>({ref:e.id,...project(e.position,this.camera,this.width,this.height)})));
   this.onTick(delta);
   if(this.playing||this.adapter.needsRender())this.raf=requestAnimationFrame(t=>this.frame(t));
  }catch(error){this.failed=true;this.onError(error instanceof Error?error.message:String(error));}
 }
 inspect(){return {frames:this.frames,active:this.active,playing:this.playing,camera:{...this.camera},scene:this.scene?.id};}
 dispose(){this.disposed=true;cancelAnimationFrame(this.raf);this.resize.disconnect();document.removeEventListener('visibilitychange',this.visibility);this.adapter.dispose();}
}
