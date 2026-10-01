import {ExpressionConnectionLayer,type ConnectionBinding} from '../../../../../packages/oi-design-system/expressions-engine/oi/expressionBindings.mjs';
import {withRetainedField} from "../../../../../packages/oi-design-system/expressions-engine/oi/retained-capability.mjs";
import {MAX_FORMATIONS,MAX_PINS} from '../../src/engine/fieldModel';
import {TransportState} from '../../src/engine/transportState';
import {stateSource} from './sourceState';
import {PointCloudField} from '../../src/engine/PointCloudField';
import type {PointCloudConfig} from '../../src/engine/types';
import {CymaticResonator} from '../../src/engine/cymaticResonator';
import {readPath} from '../../src/engine/automation';
import {Color} from 'three';
import {toNativeConfig,MATERIAL_KEYS} from './nativeBridge';
import {summarizeAnalysis} from '../../src/engine/sourceSampling';
import {NATIVE_BINDINGS,WORLD_SCALE} from './nativeParameters';
import {basis,stageCentre,stageScale} from './camera';
import type {EngineFrame,FieldEngineAdapter,EngineCommand} from './engine';
import {EntitySoundBank,activeFromFocus} from './native-field/entitySound';

const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
function color(a:string,b:string,t:number){return '#'+new Color(a).lerp(new Color(b),t).getHexString();}
/** Production engine adapter. Only PointCloudField integrates physics and time. */
class EmbeddedProductionAdapter implements FieldEngineAdapter {
 readonly capabilities={name:'Native particle field',kind:'production' as const,parameters:[...NATIVE_BINDINGS.map(p=>p.key),...MATERIAL_KEYS,'grain'],physicalResonance:true,runtimeCheckpoints:false,exactSeek:false,
 notes:['GPU particle dynamics and continuous modal resonance. One simulation clock.',`${MAX_FORMATIONS} formations / ${MAX_PINS} pins. Configuration saves are not runtime checkpoints.`,'Live video and native-resolution PNG. Offline controlled clip rendering is not available.']};
 private engine:PointCloudField|null=null;
 private contextOwner:PointCloudField|null=null;
 private connections:ExpressionConnectionLayer|null=null;
 private connectionRows:readonly ConnectionBinding[]|undefined;
 private selectedConnection:string|null|undefined;
 private connectionEmphasis='';
 private sourceBodyPicking=false;
 private width=innerWidth;private height=innerHeight;private dpr=devicePixelRatio||1;
 private dirty=false;private signature='';private sceneId='';private target:PointCloudConfig|null=null;
 private from:PointCloudConfig|null=null;private transitionStart=0;private duration=0;
 private evaluated:PointCloudConfig|null=null;private applied:PointCloudConfig|null=null;private sources=new Map<string,string>();private sourceStatus:Record<string,string>={};
 private nativeDomain=false;
 /** Per-object sound voices for the present entities (authored `sound`). */
 readonly entitySound=new EntitySoundBank();
 private nativeConfigs=new WeakMap<PointCloudConfig,PointCloudConfig>();
 setNativeDomain(active:boolean){this.nativeDomain=active;this.applied=null;this.dirty=true;}
 private nativeConfig(config:PointCloudConfig):PointCloudConfig{
  if(!this.nativeDomain)return config;
  let result=this.nativeConfigs.get(config);
  if(!result){result={...config,cymatics:config.cymatics?{...config.cymatics,enabled:false}:undefined,
   toroidalMorph:config.toroidalMorph?{...config.toroidalMorph,enabled:false,autoOscillate:false}:undefined,
   automations:config.automations?.filter(l=>!l.path.startsWith('cymatics.')&&!l.path.startsWith('toroidalMorph.'))};
   this.nativeConfigs.set(config,result);}
  return result;
 }
 private contextLost=false;private seedRecoveredSources=false;private restoredClock=false;private allocationRestSeed=false;
 private stationaryAdmissionKey='';
 private lost=(event:Event)=>{event.preventDefault();this.contextLost=true;this.dirty=true;};
 constructor(readonly canvas:HTMLCanvasElement){canvas.addEventListener('webglcontextlost',this.lost);}

 resize(width:number,height:number,pixelRatio:number){this.width=width;this.height=height;this.dpr=pixelRatio;}
 private configuration(frame:EngineFrame):PointCloudConfig{
  const {toolbelt,propertyTracks,...renderScene}=frame.scene;
  const sig=frame.authoringRevision===undefined?JSON.stringify(renderScene):frame.scene.id+':'+frame.authoringRevision;
  if(sig!==this.signature){
   const config=toNativeConfig(frame.scene);
   // A material adoption can repartition the same unplayed Scene. Its resident
   // ranges then belong to the old allocation even though all body IDs remain.
   // Reuse the existing source-ready initial-rest admission, before any native
   // follow or physics step. Playing edits retain their resident continuity.
   const allocation=(value:PointCloudConfig|null)=>JSON.stringify([value?.particleCount,value?.entities?.filter(e=>e.kind==='formation'&&e.enabled).map(e=>[e.id,e.share])]);
   const actual=this.engine?.inspectState();
   if(this.engine&&this.sceneId===frame.scene.id&&!this.nativeDomain&&frame.delta===0&&actual?.simTime===0&&actual.steps===0&&allocation(this.target)!==allocation(config)){
    this.seedRecoveredSources=true;this.restoredClock=true;this.allocationRestSeed=true;
   }
   if(this.engine&&this.sceneId!==frame.scene.id){
    this.allocationRestSeed=false;
    this.duration=frame.delta>0?frame.scene.transition:0;this.from=this.duration>0?this.evaluated:null;this.transitionStart=this.engine.inspectState().simTime;
    // A newly opened held Scene must encounter its own bodies before Play.
    // Wait for its actual image sources, then admit their baked targets once.
    // Camera/parameter edits and playing transitions retain resident motion.
    if(frame.delta===0){this.seedRecoveredSources=true;this.restoredClock=true;}
   }
   this.target=config;this.signature=sig;this.sceneId=frame.scene.id;
  }
  const target=this.target!;
  if(!this.from||this.duration<=0)return target;
  const time=this.engine?.inspectState().simTime??0;
  const fraction=Math.max(0,Math.min(1,(time-this.transitionStart)/this.duration));
  if(fraction>=1){this.from=null;return target;}
  const t=fraction*fraction*(3-2*fraction),a=this.from;
  // Target ownership changes once. GPU state is never cross-faded or reseeded.
  // Shared identities keep their actual places as transforms interpolate.
  const cfg={...target,fluid:{...target.fluid},material:target.material?{...target.material}:undefined,color:{...target.color!},entities:target.entities?.map(e=>{
   const old=a.entities?.find(x=>x.id===e.id);if(!old)return e;
   return{...e,x:mix(old.x,e.x,t),y:mix(old.y,e.y,t),z:mix(old.z,e.z,t),scale:mix(old.scale,e.scale,t),
    extent:e.extent&&old.extent?{...e.extent,width:mix(old.extent.width,e.extent.width,t),height:mix(old.extent.height,e.extent.height,t),rotation:mix(old.extent.rotation,e.extent.rotation,t)}:e.extent,
    tint:color(old.tint,e.tint,t),tintWeight:mix(old.tintWeight,e.tintWeight,t),forces:{...e.forces,strength:mix(old.forces.strength,e.forces.strength,t),radius:mix(old.forces.radius,e.forces.radius,t),spin:mix(old.forces.spin,e.forces.spin,t)}};
  })};
  for(const key of Object.keys(cfg.fluid) as (keyof typeof cfg.fluid)[])if(typeof cfg.fluid[key]==='number'&&typeof a.fluid[key]==='number')(cfg.fluid as any)[key]=mix(a.fluid[key]!,cfg.fluid[key]!,t);
  for(const key of MATERIAL_KEYS)if(cfg.material&&typeof a.material?.[key]==='number')cfg.material[key]=mix(a.material[key]!,target.material?.[key]??a.material[key]!,t);
  cfg.backgroundColor=color(a.backgroundColor??'#f4f2eb',target.backgroundColor??'#f4f2eb',t);
  const oldPalette=a.color?.customPaletteColors??[a.color!.primaryColor],palette=target.color?.customPaletteColors??[target.color!.primaryColor];
  cfg.color.customPaletteColors=palette.map((c,i)=>color(oldPalette[Math.min(i,oldPalette.length-1)],c,t));
  return cfg;
 }
 needsRender(){return this.dirty;}
 render(frame:EngineFrame){
  this.sourceBodyPicking=frame.sourceBodyPicking===true;
  this.dirty=false;
  if(this.contextLost)throw new Error('GPU context was lost. Your expression is retained. Restore the field explicitly; its physical state must be reseeded.');
  const config=this.nativeConfig(this.configuration(frame));
  if(!this.engine){this.engine=new PointCloudField(this.canvas,config,true);this.contextOwner=this.engine;this.connections=new ExpressionConnectionLayer(this.engine);this.connectionRows=undefined;this.selectedConnection=undefined;this.seedRecoveredSources=true;}
  else if(config!==this.applied)this.engine.replaceConfig(config);
  this.engine.setForceEmitterProjection(frame.forceEmitterProjection??null);this.engine.setLocalizedResonanceProjection(frame.localizedResonanceProjection??null);this.engine.setFormationGeometryProjection(frame.formationGeometryProjection??null);
  if(config!==this.applied){this.syncSources(frame.scene);this.soundScene=frame.scene.entities.some(e=>e.sound?.enabled)?frame.scene:null;}this.applied=config;
  const connectionEmphasis=JSON.stringify([frame.connectionFocusIds??[],frame.connectionRestOpacity??1]);
  if(frame.connections!==this.connectionRows||frame.selectedConnection!==this.selectedConnection||connectionEmphasis!==this.connectionEmphasis){
   this.connectionRows=frame.connections;this.selectedConnection=frame.selectedConnection;
   this.connectionEmphasis=connectionEmphasis;
   const focus=new Set(frame.connectionFocusIds??[]);
   const emphasized=(frame.connections??[]).filter(row=>row.binding_ref===frame.selectedConnection||focus.has(row.from_entity_ref)||focus.has(row.to_entity_ref)).map(row=>row.binding_ref);
   this.connections?.configure(frame.connections??[],emphasized,frame.connectionRestOpacity??1);
  }
  this.engine.setSelection(frame.selectedIds);this.engine.setGridMode(frame.scaffold??'off');
  const {a,b}=basis(frame.camera),o=stageCentre(this.width,this.height);
  this.engine.setHostView({width:this.width,height:this.height,pixelRatio:this.dpr,originX:o.x+frame.camera.panX,originY:o.y+frame.camera.panY,pixelsPerUnit:stageScale(this.width,this.height)*frame.camera.zoom/WORLD_SCALE,right:a,up:b});
  this.engine.setHostPointer(frame.pointer.active,{x:frame.pointer.world.x*WORLD_SCALE,y:frame.pointer.world.y*WORLD_SCALE,z:frame.pointer.world.z*WORLD_SCALE},frame.delta);
  // Source decoding is asynchronous. A correction scheduled at initial rest
  // loses that authority if Play/native follow starts before decoding ends.
  // Cancel its pending reset before any step; never seed later into live motion.
  if(this.allocationRestSeed){
   const actual=this.engine.inspectState();
   if(this.nativeDomain||frame.delta!==0||actual.simTime!==0||actual.steps!==0){
    this.seedRecoveredSources=false;this.restoredClock=false;this.allocationRestSeed=false;
    this.sourceStatus['material-adoption']='Initial allocation admission was interrupted; reopen the saved world at rest.';
   }
  }
  this.engine.advance(frame.delta);if(this.seedRecoveredSources&&Object.values(this.sourceStatus).every(v=>v.includes('source active'))){if(this.sources.size||this.restoredClock)this.engine.seedCurrentTargets();this.seedRecoveredSources=false;this.restoredClock=false;this.allocationRestSeed=false;this.engine.advance(0);}
  const stationary=frame.stationaryFormationAdmission;
  if(!stationary)this.stationaryAdmissionKey='';
  else if(frame.delta===0&&!this.seedRecoveredSources&&Object.values(this.sourceStatus).every(v=>v.includes('source active'))){
   const fence=this.engine.stationaryFormationAdmissionState();
   const key=frame.scene.id+':'+stationary.sourceRevision+':'+fence.partition_signature;
   if(key!==this.stationaryAdmissionKey){
    this.engine.admitStationaryFormations({entity_ids:stationary.entityIds,expected_revision:fence.revision,
     partition_signature:fence.partition_signature,source_revision:stationary.sourceRevision});
    this.stationaryAdmissionKey=key;
   }
  }
  this.evaluated=this.engine.getEvaluation().config;
  this.followSound(frame);
 }
 private soundScene:EngineFrame['scene']|null=null;private soundAt=-1;
 /** Object sound follows the present Scene and the engine's real focus
  * (travelling compositions sound the focused entity only). ~10 Hz. */
 private followSound(frame:EngineFrame){
  const scene=frame.entitySoundProjection?frame.entitySoundProjection(frame.scene):this.soundScene;
  if(!scene){if(this.soundAt!==-2){this.entitySound.sync({entities:[]});this.soundAt=-2;}return;}
  const now=performance.now();if(this.soundAt>=0&&now-this.soundAt<100)return;this.soundAt=now;
  const focus=scene.composition.focus==='travelling'?this.engine?.getCompositionTelemetry().focus:null;
  this.entitySound.sync({entities:scene.entities,field:frame.scene.field},activeFromFocus(focus));
 }
 hitEntity(x:number,y:number){
  if(!this.sourceBodyPicking||!this.engine)return this.connections?.pickEntity(x,y)??null;
  // This read never steps or seeds the owner. Wide rings and image/glyph
  // bodies can share an origin; a centre-only hit would select an unrelated
  // occurrence. Use the same resident GPU positions and native partitions
  // that the current field renders, keeping semantic identity on that body.
  const resident=this.engine.inspectState(true),positions=resident.positions;
  const enabled=new Set(this.engine.getEvaluation().config.entities?.filter(e=>e.enabled!==false).map(e=>e.id)??[]);
  let nearest:string|null=null,distance=8;
  for(const partition of resident.partitions){
   if(!enabled.has(partition.entityId))continue;
   for(let i=partition.start;i<partition.end;i++){
    const offset=i*4;if(positions[offset+3]<=0)continue;
    const p=this.engine.projectWorldToScreen(positions[offset],positions[offset+1],positions[offset+2]);
    if(!p.visible)continue;const gap=Math.hypot(x-p.x,y-p.y);
    if(gap<distance){distance=gap;nearest=partition.entityId;}
   }
  }
  return nearest;
 }
 hitConnection(x:number,y:number){return this.connections?.hitTest(x,y)??null;}
 inspectConnections(){return { ...this.connections?.inspect(),paths:this.connections?.paths.map(path=>({binding_ref:path.binding.binding_ref,points:path.points.map(p=>this.engine?.projectWorldToScreen(p.x,p.y,p.z))}))??[]};}
 transportState(){return this.engine?.getTransportState();}
 restoreTransport(state:TransportState){this.engine?.restoreTransportState(state);this.seedRecoveredSources=true;this.restoredClock=true;this.dirty=true;}
 telemetry(){
  if(!this.engine)return null;
  const t=this.engine.getCompositionTelemetry(),drive=this.engine.getMorphDrive(),cfg=this.engine.getEvaluation().config;
  const params:Record<string,number>={};for(const b of NATIVE_BINDINGS){const n=readPath(cfg,b.path);if(typeof n==='number')params[b.key]=n/b.factor;}
  return {...t,drive,params,config:cfg,sourceStatus:{...this.sourceStatus},live:this.engine.getEvaluation().live,background:cfg.backgroundColor??'#f4f2eb',palette:cfg.color?.customPaletteColors??[cfg.color!.primaryColor,cfg.color!.accentColor,cfg.color!.secondaryColor],transition:this.from?Math.min(1,(t.simTime-this.transitionStart)/Math.max(.001,this.duration)):1};
 }
 private syncSources(scene:EngineFrame['scene']){
  // Layers are the object's spatial composition: their sources always load,
  // regardless of any transport state — a laminated body exists whether or not
  // its sequence plays.
  const requests=scene.entities.filter(e=>e.kind==='formation').flatMap(e=>[
   ...(e.layers??[]).flatMap(l=>l.source?[{entityId:e.id,linkId:l.id,source:l.source}]:[]),
   ...(e.sequence.enabled||e.sequence.manual?e.sequence.steps.flatMap((k,i)=>{const source=stateSource(e,i);return source?[{entityId:e.id,linkId:k.id,source}]:[]}):e.source?[{entityId:e.id,linkId:e.id+'_base',source:e.source}]:[]),
  ]);
  const ids=new Set(requests.map(r=>JSON.stringify([r.entityId,r.linkId])));
  for(const key of this.sources.keys())if(!ids.has(key)){const [entityId,linkId]=JSON.parse(key);this.engine?.clearCustomSource(entityId,linkId);this.sources.delete(key);delete this.sourceStatus[key];}
  for(const {entityId,linkId,source} of requests){const key=JSON.stringify([entityId,linkId]),signature=JSON.stringify(source);if(this.sources.get(key)===signature)continue;this.sources.set(key,signature);this.engine?.clearCustomSource(entityId,linkId);delete this.sourceStatus[key];
   if(source.kind==='ascii'){const analysis=this.engine?.loadAsciiArt(source.ascii.text,source.ascii,entityId,linkId);this.sourceStatus[key]=analysis?summarizeAnalysis(analysis,'ascii'):'ASCII source active';continue;}
   const options=source.image,url=options.dataUrl??'';
   if(!/^data:image\/(png|jpeg|webp);base64,/i.test(url)){this.sourceStatus[key]='Image source needs an embedded PNG, JPEG or WebP.';continue;}
   const image=new Image();this.sourceStatus[key]='Decoding image…';
   image.onload=()=>{if(this.sources.get(key)!==signature||!this.engine)return;if(image.naturalWidth*image.naturalHeight>16777216){this.sourceStatus[key]='Image exceeds the 16 megapixel source limit.';this.dirty=true;return;}const analysis=this.engine.loadCustomImage(image,options,entityId,linkId);this.sourceStatus[key]=analysis?summarizeAnalysis(analysis,'image'):'Image source active';this.dirty=true;};
   image.onerror=()=>{if(this.sources.get(key)===signature){this.sourceStatus[key]='The embedded image could not be decoded.';this.dirty=true;}};image.src=url;
  }
 }

 private assertCaptureReady(){if(this.contextLost)throw new Error('GPU context lost: restore the field before capturing.');for(const status of Object.values(this.sourceStatus))if(!status.includes('source active'))throw new Error('Capture waits for a valid source: '+status);}
 withCleanFrame<T>(copy:()=>T):T {this.assertCaptureReady();return this.engine?this.engine.withCleanFrame(copy):copy();}
 capture(width:number,height:number){this.assertCaptureReady();if(!this.engine)throw new Error('No rendered field yet');return this.engine.renderImage(width,height);}
 inspect(readParticles=false){return this.engine?.inspectState(readParticles);}
 projectNative(point:{x:number;y:number;z:number}){return this.engine?.projectWorldToScreen(point.x*WORLD_SCALE,point.y*WORLD_SCALE,point.z*WORLD_SCALE);}
 stations(){if(this.nativeDomain)return [];const current=this.engine?.getCymaticStations();if(current?.length)return current;const r=new CymaticResonator();r.configure({baseFrequency:this.target?.cymatics?.baseFrequency??40,plateSize:this.target?.cymatics?.plateSize??700});return r.getAnchors().map(a=>({id:a.id,index:a.index,name:`Mode ${a.m}:${a.n}`,frequencyHz:a.frequencyHz,m:a.m,n:a.n,color:'#888888'}));}
 command(command:EngineCommand){
  if(this.nativeDomain&&['recover-context','reset-field','reset-phases'].includes(command.type))throw new Error('Native follow holds resident continuity; disconnect before a destructive presentation reset.');
  if(command.type==='recover-context'){
   this.connections?.dispose();this.connections=null;this.engine?.destroy();this.engine=null;this.applied=null;this.target=null;this.from=null;this.signature='';this.sources.clear();this.sourceStatus={};this.contextLost=false;this.dirty=true;return;
  }
  if(!this.engine)throw new Error('The native engine has not rendered yet.');
  if(command.type==='reset-field')this.engine.resetField();
  else if(command.type==='reset-phases')this.engine.resetMorphPhases();
  else if(command.type==='disperse'){
   if(!Number.isFinite(command.strength)||Math.abs(command.strength)>20)throw new Error('Impulse strength must be finite and within ±20.');
   this.engine.triggerDisperse(command.strength);
  }else if(command.type==='pointer-effect'){
   if(!['pulse','implode','vortex','shove'].includes(command.kind))throw new Error('Unknown pointer effect.');
   if(!Number.isFinite(command.strength)||command.strength<0||command.strength>20)throw new Error('Pointer effect strength must be finite and within 0–20.');
   if(!Number.isFinite(command.radius)||command.radius<=0)throw new Error('Pointer effect radius must be positive.');
   this.engine.triggerPointerEffect(command.kind,command.x,command.y,command.strength,command.radius);
  }else this.engine.fireAutomation(command.id,command.delay??0);
  this.dirty=true;
 }
 dispose(){this.entitySound.dispose();this.canvas.removeEventListener('webglcontextlost',this.lost);this.connections?.dispose();this.connections=null;this.contextOwner?.destroy({releaseContext:true});this.engine=null;this.contextOwner=null;}
}

export const ProductionAdapter = withRetainedField(EmbeddedProductionAdapter, WORLD_SCALE);
