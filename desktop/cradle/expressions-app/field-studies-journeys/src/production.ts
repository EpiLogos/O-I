import {ExpressionConnectionLayer,type ConnectionBinding} from './expressionBindings.mjs';
import {withRetainedField} from './retainedField.mjs';
import {MAX_FORMATIONS,MAX_PINS} from '../../src/engine/fieldModel';
import {TransportState} from '../../src/engine/transportState';
import {stateSource} from './sourceState';
import {PointCloudField} from '../../src/engine/PointCloudField';
import type {PointCloudConfig} from '../../src/engine/types';
import {pulseRateFor,type TorusPlayReading} from '../../src/engine/torusDrive';
import {MAX_FORCE_EMITTERS,type ForceEmitterProjection,type ForceEmitterState} from '../../src/engine/forceRuntime';
import {CymaticResonator} from '../../src/engine/cymaticResonator';
import {readPath} from '../../src/engine/automation';
import {Color} from 'three';
import {toRenderConfig,MATERIAL_KEYS} from './nativeBridge';
import {summarizeAnalysis} from '../../src/engine/sourceSampling';
import {NATIVE_BINDINGS,WORLD_SCALE} from './nativeParameters';
import {basis,project,stageCentre,stageScale} from './camera';
import type {EngineFrame,FieldEngineAdapter,EngineCommand} from './engine';
import {entitySoundPlan,activeFromFocus,expressionSilencedHere,onObjectSoundMuted,objectSoundLevels,fieldVoiceMix} from './native-field/entitySound';
import {SymbolVoices,placeOf,type TorusTap} from './native-field/symbolVoices';
import {formMaskOf,symbolHarmonies,type ClassesReading,type FormMask} from './native-field/symbolHarmony';
import {nativeSurface} from './native-field/surfaceConfig';
import {bodyOf} from '../../src/engine/torusObject';
import {modeCatalogueReading,onModeCatalogue} from './native-field/modeStore';
import {DIP_AT_DEFAULT,transitionKindOf,paintedOverlayActive,transitionColourOf,edgeBlend,type TransitionSpec} from './transitions';
import type {TransitionOverlay} from '../../src/engine/transitionPass';

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
 private connectionKey='';
 /** The relations a host binds itself (setExpressionBindings: the stage, the published player): drawn while its frames carry none of
  * their own (`frame.connections`), the frame's selection selecting among them. Once this field has drawn them it stays their reader. */
 private hostBindings:readonly ConnectionBinding[]=[];private hostBound=false;
 private width=innerWidth;private height=innerHeight;private dpr=devicePixelRatio||1;
 private dirty=false;private signature='';private sceneId='';private target:PointCloudConfig|null=null;
 private from:PointCloudConfig|null=null;private transitionStart=0;private duration=0;
 /** E11: the seam's transition into the current scene. Absent = crossfade (the config blend), byte-identical. */
 private seam:TransitionSpec|undefined;
 /** E11b: the painted overlay this frame draws through the transition pass, and whether a wipe must hold the outgoing frame
  * before the new scene reaches the GPU. */
 private overlay:TransitionOverlay|null=null;private holdDue=false;
 private evaluated:PointCloudConfig|null=null;private applied:PointCloudConfig|null=null;private sources=new Map<string,string>();private sourceStatus:Record<string,string>={};
 private nativeDomain=false;
 /** The symbols' voices (authored `sound`): they carry the torus's sound to where their symbols stand, and have no oscillator of their own. */
 readonly symbolVoices=new SymbolVoices();
 private releaseVoiceWatch:()=>void=()=>{};
 setNativeDomain(active:boolean){this.nativeDomain=active;this.applied=null;this.dirty=true;this.engine?.setPlateBody(active);}
 /** The torus's voices that sound, as force points (native-field/controller.ts torusVoicePoints; O-I 851): read every tick the engine
  * compiles its forces, so a voice pulls while it sounds and lets go as it fades. */
 private torusVoices:(()=>readonly ForceEmitterState[])|null=null;
 setTorusVoices(source:(()=>readonly ForceEmitterState[])|null){this.torusVoices=source;this.forceSource=undefined;this.dirty=true;}
 private forceSource:ForceEmitterProjection|null|undefined;private forceComposed:ForceEmitterProjection|null=null;
 private forceProjection(base:ForceEmitterProjection|null):ForceEmitterProjection|null{
  const voices=this.torusVoices;
  if(!this.nativeDomain||!voices)return base;
  if(this.forceSource!==base||!this.forceComposed){
   this.forceSource=base;
   this.forceComposed=emitters=>[...(base?base(emitters):emitters),...voices()].slice(0,MAX_FORCE_EMITTERS);
  }
  return this.forceComposed;
 }
 /** The plate as the body laid flat (DLW §20.14; O-I 851): whether the scene's Resonance studies the modes while the instrument holds
  * the field, and, under Manual, Focus and Automation, the drive the pulse is tuned to (null under Torus: the pulse is the torus's own). */
 plateBody():{flat:boolean;pulseHz:number|null}{
  const cym=this.target?.cymatics,flat=this.nativeDomain&&!!cym?.enabled&&cym.engine!=='template';
  if(!flat)return {flat:false,pulseHz:null};
  const driver=(this.engine?.getCompositionTelemetry() as any)?.cymatic?.driver??null;
  return {flat:true,pulseHz:pulseRateFor(driver)};
 }
 /** The torus's played reading (nativeField.ts): kept here so an engine built later, or rebuilt after a lost context, is handed it too. The
  * plate reads it only when the scene's drive is Torus; a repeated reading is not a change. */
 private torusPlay:TorusPlayReading|null=null;
 setTorusPlay(reading:TorusPlayReading|null){
  if(JSON.stringify(reading)===JSON.stringify(this.torusPlay))return;
  this.torusPlay=reading;this.engine?.setTorusPlay(reading);this.soundAt=-1;this.dirty=true;
  // The classes stand where the owner read them at its steps; from then the pulse carries them on at its rate (symbolHarmony.ts classesAt).
  const classes=reading?.classes as ClassesReading|undefined,steps=classes&&classes.absentBecause===null?classes.steps:null;
  if(steps!==this.classesSteps){this.classesSteps=steps;this.classesSince=performance.now();}
 }
 private classesSteps:number|null=null;private classesSince=0;
 /** A symbol's form as cells of its box, from the engine's own pool for it; made once per bake. */
 private forms=new WeakMap<readonly {x:number;y:number}[],FormMask|null>();
 private formOf(entityId:string):FormMask|null{
  const pool=this.engine?.getFormPool(entityId)??null;
  if(!pool)return null;
  let mask=this.forms.get(pool);
  if(mask===undefined){mask=formMaskOf(pool);this.forms.set(pool,mask);}
  return mask;
 }
 /** The node the controller offers for the symbols' voices to listen to (native-field/controller.ts `voiceTap`), or none while no instrument is open. */
 setTorusTap(tap:TorusTap|null){if(this.symbolVoices.attach(tap)){this.soundAt=-1;this.dirty=true;}}
 private nativeConfig(config:PointCloudConfig):PointCloudConfig{
  // The plate stays as authored: under the native instrument it is the body laid flat (setPlateBody), so its drive is resolved, and
  // its lanes move that drive, but it rings no plate of its own here (O-I 851); the surface takes the lens's material (O-I 854).
  return this.nativeDomain?nativeSurface(config,this.torusPlay):config;
 }
 private contextLost=false;private seedRecoveredSources=false;private restoredClock=false;
 private lost=(event:Event)=>{event.preventDefault();this.contextLost=true;this.dirty=true;};
 constructor(readonly canvas:HTMLCanvasElement){
  canvas.addEventListener('webglcontextlost',this.lost);
  // The Expression's own mute, and the mode catalogue arriving, are changes the voices must follow without waiting for an edit.
  const stopMute=onObjectSoundMuted(()=>{this.soundAt=-1;this.dirty=true;}),stopCatalogue=onModeCatalogue(()=>{this.soundAt=-1;this.dirty=true;});
  this.releaseVoiceWatch=()=>{stopMute();stopCatalogue();};
 }

 resize(width:number,height:number,pixelRatio:number){this.width=width;this.height=height;this.dpr=pixelRatio;}
 private configuration(frame:EngineFrame):PointCloudConfig{
  const {toolbelt,propertyTracks,...renderScene}=frame.scene;
  const sig=frame.authoringRevision===undefined?JSON.stringify(renderScene):frame.scene.id+':'+frame.authoringRevision+':'+(frame.liveRevision??0);
  if(sig!==this.signature){
   const config=toRenderConfig(frame.scene);
   if(this.engine&&this.sceneId!==frame.scene.id){this.seam=frame.scene.transitionSpec;this.duration=frame.delta>0&&transitionKindOf(this.seam)!=='cut'?frame.scene.transition:0;this.from=this.duration>0?this.evaluated:null;this.holdDue=this.from!==null&&transitionKindOf(this.seam)==='wipe';this.transitionStart=this.engine.inspectState().simTime;}
   this.target=config;this.signature=sig;this.sceneId=frame.scene.id;
  }
  const target=this.target!;
  if(!this.from||this.duration<=0){this.overlay=null;return target;}
  const time=this.engine?.inspectState().simTime??0;
  const fraction=Math.max(0,Math.min(1,(time-this.transitionStart)/this.duration));
  if(fraction>=1){this.from=null;this.overlay=null;return target;}
  // E11b: a painted kind draws through the transition pass. A wipe's live side is the incoming scene itself, so it takes the
  // target without a particle blend; its held side is the outgoing frame captured at the start. A dip's colour is laid over
  // the frame by the pass at the colour point, so the background ramp below stays only to agree with the frame's own ground.
  const spec=this.seam,painted=!!spec&&paintedOverlayActive(spec,fraction);
  // T5: the edge's own curve is the blend the field and the painted pass both read, the law live playback reads. An edge without one
  // blends exactly as it always did (the raw fraction, and the smoothstep).
  const {progress,blend:t}=edgeBlend(spec,fraction);
  const paint=(ground:string|undefined):TransitionOverlay|null=>painted?{spec:spec!,fraction:progress,colour:transitionColourOf(target.backgroundColor),ground:transitionColourOf(ground)}:null;
  if(transitionKindOf(spec)==='wipe'){this.overlay=paint(target.backgroundColor);return target;}
  const a=this.from;
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
  // E11: a dip to colour reaches the incoming scene's own background at its point. The pass lays the colour over the frame
  // itself (E11b); this ramp keeps the field's ground in step with it.
  cfg.backgroundColor=color(a.backgroundColor??'#f4f2eb',target.backgroundColor??'#f4f2eb',transitionKindOf(this.seam)==='dip-to-colour'?Math.min(1,progress/(this.seam?.at??DIP_AT_DEFAULT)):t);
  const oldPalette=a.color?.customPaletteColors??[a.color!.primaryColor],palette=target.color?.customPaletteColors??[target.color!.primaryColor];
  cfg.color.customPaletteColors=palette.map((c,i)=>color(oldPalette[Math.min(i,oldPalette.length-1)],c,t));
  this.overlay=paint(cfg.backgroundColor);
  return cfg;
 }
 needsRender(){return this.dirty;}
 gpuBehind(){return this.engine?.gpuBehind()??false;}
 shownAgain(){this.engine?.shownAgain();}
 /** Whom the engine tells of a step that throws outside the host's own call: a hidden wake's later task (PointCloudField.onWakeFailed,
  * 1T.2 item 23). Kept for each engine made: the first, and the one made after a lost context. */
 private stepFailed:((error:unknown)=>void)|null=null;
 onStepFailed(listener:(error:unknown)=>void){this.stepFailed=listener;this.engine?.onWakeFailed(listener);}
 /** The contacts the engine read back since the last take (PointCloudField.takeContacts); null before the field stands. */
 takeContacts(){return this.engine?.takeContacts()??null;}
 render(frame:EngineFrame,draw=true){this.stepAt(frame,draw,engine=>{engine.advance(frame.delta,draw);});}
 /** A wake of a field not shown, on its timer (a hidden document, or a surface its host shows none of; 1T.0 item 2): the frame as a render takes it, then the engine steps `seconds` of the time owed in its
  * capped steps (PointCloudField.advanceHidden), drawing nothing. Returns the time stepped. */
 stepHidden(frame:EngineFrame,seconds:number):number{let stepped=0;this.stepAt(frame,false,engine=>{stepped=engine.advanceHidden(seconds);});return stepped;}
 private stepAt(frame:EngineFrame,draw:boolean,advance:(engine:PointCloudField)=>void){
  if(draw)this.dirty=false;
  if(this.contextLost)throw new Error('GPU context was lost. Your expression is retained. Restore the field explicitly; its physical state must be reseeded.');
  const config=this.nativeConfig(this.configuration(frame));
  // E11b: a wipe holds the outgoing frame, captured before the new configuration reaches the GPU.
  if(this.holdDue){this.holdDue=false;this.engine?.captureTransitionHold(transitionColourOf(this.from?.backgroundColor));}
  if(!this.engine){this.engine=new PointCloudField(this.canvas,config,true);this.engine.onWakeFailed(this.stepFailed);this.engine.setTorusPlay(this.torusPlay);this.engine.setPlateBody(this.nativeDomain);this.contextOwner=this.engine;this.connections=new ExpressionConnectionLayer(this.engine);this.connectionRows=undefined;this.connectionKey='';this.hostBound=false;this.seedRecoveredSources=true;}
  else if(config!==this.applied)this.engine.replaceConfig(config);
  this.engine.setTransitionOverlay(this.overlay);this.engine.setForceEmitterProjection(this.forceProjection(frame.forceEmitterProjection??null));this.engine.setLocalizedResonanceProjection(frame.localizedResonanceProjection??null);this.engine.setFormationGeometryProjection(frame.formationGeometryProjection??null);
  if(config!==this.applied){this.syncSources(frame.scene);this.soundScene=frame.scene.entities.some(e=>e.sound?.enabled)?frame.scene:null;}this.applied=config;
  // The relations drawn: the frame's own (the application's, its one selected connection), else those the host bound, under the frame's
  // selection. Configured when they or their selection change; the field keeps them between (ConnectionRuntime).
  const hosted=frame.connections===undefined&&(this.hostBound||this.hostBindings.length>0);
  const rows=hosted?this.hostBindings:frame.connections,selected=hosted?frame.selectedIds:frame.selectedConnection?[frame.selectedConnection]:[];
  const key=rows===undefined?'':selected.join('\n');
  if(rows!==this.connectionRows||key!==this.connectionKey){
   this.connectionRows=rows;this.connectionKey=key;this.hostBound||=hosted;
   this.connections?.configure(rows??[],rows===undefined?[]:selected);
  }
  this.engine.setSelection(frame.selectedIds);this.engine.setGridMode(frame.scaffold??'off');
  const {a,b}=basis(frame.camera),o=stageCentre(this.width,this.height);
  this.engine.setHostView({width:this.width,height:this.height,pixelRatio:this.dpr,originX:o.x+frame.camera.panX,originY:o.y+frame.camera.panY,pixelsPerUnit:stageScale(this.width,this.height)*frame.camera.zoom/WORLD_SCALE,right:a,up:b});
  this.engine.setHostPointer(frame.pointer.active,{x:frame.pointer.world.x*WORLD_SCALE,y:frame.pointer.world.y*WORLD_SCALE,z:frame.pointer.world.z*WORLD_SCALE},frame.delta);
  // Collisions strike (DLW §20.2 Field): the engine reduces and reads back its contacts only while the scene's setting is On.
  this.engine.listenContacts(frame.scene.composition.collisionsStrike===true);
  advance(this.engine);if(this.seedRecoveredSources&&Object.values(this.sourceStatus).every(v=>v.includes('source active'))){if(this.sources.size||this.restoredClock)this.engine.seedCurrentTargets();this.seedRecoveredSources=false;this.restoredClock=false;this.engine.advance(0,draw);}
  this.evaluated=this.engine.getEvaluation().config;
  this.followSound(frame);
 }
 private soundScene:EngineFrame['scene']|null=null;private soundAt=-1;
 /** Object sound follows the present Scene and the engine's real focus
  * (travelling compositions sound the focused entity only). ~10 Hz. */
 private followSound(frame:EngineFrame){
  const scene=frame.entitySoundProjection?frame.entitySoundProjection(frame.scene):this.soundScene;
  const reading=this.torusPlay,closed='No instrument is open: the torus is not sounding';
  const none={plan:{voices:[],silent:[]},catalogue:null,catalogueWhy:null,root:reading?.root??{hz:null,absentBecause:closed},torusSilentBecause:reading?.torus.silentBecause??closed,places:new Map<string,number>(),muted:expressionSilencedHere(),levels:objectSoundLevels(),mixOf:fieldVoiceMix};
  if(!scene){if(this.soundAt!==-2){this.symbolVoices.sync(none);this.soundAt=-2;}return;}
  const now=performance.now();if(this.soundAt>=0&&now-this.soundAt<100)return;this.soundAt=now;
  const focus=scene.composition.focus==='travelling'?this.engine?.getCompositionTelemetry().focus:null;
  const plan=entitySoundPlan({entities:scene.entities,composition:scene.composition},activeFromFocus(focus));
  // A voice stands where its symbol stands: the stage's own projection (camera.ts) gives the symbol's x, and the place is that x in half the stage's width.
  const places=new Map<string,number>();
  for(const voice of plan.voices){const entity=scene.entities.find(e=>e.id===voice.entityId);if(entity)places.set(voice.entityId,placeOf(project(entity.position,frame.camera,this.width,this.height).x,this.width));}
  const store=modeCatalogueReading();
  // A voice with no name or mode is its symbol's own harmony: its form laid where it stands, on the classes the pulse has carried there now.
  const classes=(reading?.classes as ClassesReading|undefined)??{absentBecause:closed};
  const steps=classes.absentBecause===null?classes.steps+classes.steps_per_second*Math.max(0,now-this.classesSince)/1000:0;
  const harmonies=symbolHarmonies(scene.entities,plan,classes,reading?.body?bodyOf(reading.body.influence):null,steps,id=>this.formOf(id),this.symbolVoices.sampleRate()??48000);
  this.symbolVoices.sync({...none,plan,catalogue:store.catalogue,catalogueWhy:store.why,places,harmonies});
 }
 /** The relations the host draws on this field (the stage's, a page's: its Expression's correspondence); none, the field draws none. */
 setExpressionBindings(bindings:readonly ConnectionBinding[]=[]){this.hostBindings=bindings;this.dirty=true;}
 /** What a host's pointer is on, from the evaluated poses and the drawn relations: the nearest symbol within 12 px, else a relation
  * within 7 px, else nothing. */
 hitTestExpression(x:number,y:number){
  if(!this.engine||this.contextLost)return null;
  const member=this.connections?.nearestEntity(x,y,12);
  return member?{kind:'entity' as const,entity_ref:member.entityId,distance:member.distance}:this.connections?.hitTest(x,y)??null;
 }
 /** The host's relations as this field draws them; before it has drawn them, every one unavailable. */
 expressionBindingSnapshot(){return this.hostBound&&this.connections?this.connections.inspect():{rendered:[] as string[],unavailable:this.hostBindings.map(binding=>binding.binding_ref)};}
 hitEntity(x:number,y:number){return this.connections?.pickEntity(x,y)??null;}
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
   ...Array.from(new Map([...(e.layers??[]),...(e.sequence.enabled||e.sequence.manual?e.sequence.steps.flatMap(k=>k.layers??[]):[])].map(l=>[l.id,l])).values()).flatMap(l=>l.source?[{entityId:e.id,linkId:l.id,source:l.source}]:[]),
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
 inspectResources(){return this.engine?.inspectResources();}
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
 dispose(){this.symbolVoices.dispose();this.releaseVoiceWatch();this.canvas.removeEventListener('webglcontextlost',this.lost);this.connections?.dispose();this.connections=null;this.contextOwner?.destroy({releaseContext:true});this.engine=null;this.contextOwner=null;}
}

/** The production engine: the one adapter the application, the candidate's stage and the published player all run. */
export const ProductionAdapter = withRetainedField(EmbeddedProductionAdapter, WORLD_SCALE);
export type ProductionAdapter = InstanceType<typeof ProductionAdapter>;
