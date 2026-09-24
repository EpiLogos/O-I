import {validateResearchMaterial,type ResearchMaterial} from './researchMaterial.js';
import {validateBlueprint,type SceneBlueprint} from './blueprintGeometry.js';
import {SharedSettings,globalPath,POINTER_PATHS} from './sharedSettings';
import {validateAutomationLinks} from './automationLinks';
import type {BeltEntry} from './workspacePreferences';
import {validateWorkspace,defaultWorkspace} from './workspacePreferences';
import type {PropertyTrack} from './propertyTracks';
import {validateTracks} from './propertyTracks';
import type {PointCloudConfig, AutomationEasing,CustomImageConfig,AsciiGlyphConfig,CameraOrbState} from '../../src/engine/types';
import type {SemanticFieldConfig} from '../../src/engine/semantics/semanticTypes';
import type {ResonanceDriveConfig} from '../../src/engine/resonanceDrive';
import type {Entity as NativeEntity, SequenceLink as NativeLink} from '../../src/engine/fieldModel';
/** Authoring schema. Deliberately NOT the production engine's schema-4 snapshot. */
export type Vec3 = {x:number;y:number;z:number};
export type Plane = 'XY'|'XZ'|'YZ';
export type Tool = 'select'|'interact'|'pin'|'formation'|'text'|'orbit';
export type Shape = 'text'|'ring'|'disc'|'square'|'triangle'|'yantra'|'cymatic';
export type Material = 'ink'|'print'|'round';
export interface SequenceStep {source?:Entity['source'];name?:string;objectState?:Pick<Entity,'size'|'rotation'|'scale'|'tint'|'tintWeight'|'force'>;holdOverride?:boolean;transitionOverride?:boolean;native?:NativeLink;yantraId?:string;templateFrequency?:number;templateGeometry?:'square'|'circular'|'volumetric3D';templateDimension?:'2D'|'3D';id:string;text:string;shape:Shape;hold:number;transition:number;position:Vec3|null}
export interface EntityLayer {id:string;text:string;z:number;scale?:number;source?:{kind:'image';image:CustomImageConfig}|{kind:'ascii';ascii:AsciiGlyphConfig}}
export interface Entity {
 source?:{kind:'image';image:CustomImageConfig}|{kind:'ascii';ascii:AsciiGlyphConfig};
 scale?:number;native?: NativeEntity;yantraId?:string;templateFrequency?:number;templateGeometry?:'square'|'circular'|'volumetric3D';templateDimension?:'2D'|'3D';enabled?:boolean;
 id:string;name:string;kind:'formation'|'pin';position:Vec3;size:{x:number;y:number};rotation:number;
 shape:Shape;text:string;share:number;tint:string;tintWeight:number;locked:boolean;
 force:{kind:'none'|'attract'|'repel'|'vortex';strength:number;radius:number;spin:number};station:number|null;
 layers?:EntityLayer[];
 sequence:{sourcesVersion?:1;enabled:boolean;clock:'seconds'|'morph';steps:SequenceStep[];manual?:boolean;hold?:number;transition?:number;order?:'loop'|'pingpong'|'random';easing?:'linear'|'smoothstep'|'kineticSnap'|'whip';jitter?:number;impulse?:number;rateMul?:number;phaseOffset?:number;};
}
export interface TextLayer {id:string;visible:boolean;kicker:string;title:string;italic:string;body:string;x:number;y:number;width:number;size:number;align:'left'|'center'|'right'}
export interface AutomationLane {clockId?:string;syncWith?:string;easing?:AutomationEasing;nativeId?:string;nativePath?:string;entityId?:string;id:string;enabled:boolean;target:string;type:'lfo'|'ramp';wave:'sine'|'triangle'|'square'|'saw'|'steps'|'smooth'|'morph';min:number;max:number;rate:number;phase:number;blend:'replace'|'add'|'multiply';duration:number;delay:number;loop:'once'|'loop'|'pingpong';firedAt:number|null}
export interface EngineSettings {inkMode?:'blackOnWhite'|'whiteOnBlack';paletteId?:string;templateGeometry?:'square'|'circular'|'volumetric3D';templateDimension?:'2D'|'3D';paletteSource?:'custom'|'legacy';grainProfile?:boolean;backgroundMode?:'solid'|'vignette'|'ambientGlow'|'adaptive';resonatorMode?:'resonator'|'template';focusOrder?:'listed'|'reverse'|'pingpong';resonanceEnabled:boolean;morphEnabled:boolean;trajectory:'linear'|'toroidalHopf'|'vortexSpiral'|'quantumInterference';driveShape:'sine'|'triangle'|'smooth'|'pulse';autoOscillate:boolean;relationalEnabled:boolean;relationalMode:'orbital'|'nbody'|'chaos';pointerMode:'repel'|'attract'|'vortex';pointerClick?:'pulse'|'implode'|'vortex'|'shove'|'off';pointerClickStrength?:number;pointerClickRadius?:number;colorMode:string;colorEnabled:boolean;dotShape?:'circle'|'square';autoFitSizes?:boolean;mediumEnabled?:boolean;collisionEnabled?:boolean;collisionMode?:'obstacle'|'vessel';pairwiseEnabled?:boolean;fontFamily?:string;fontWeight?:string|number;mediumPlane:'vertical'|'horizontal';mediumDimension?:'2D'|'3D';autoSweep:boolean;sweepDirection:'ascent'|'descent'|'pingpong';volumeEnabled?:boolean;volumeProfile?:'slab'|'bevel'|'round'|'dome'|'taper';depthPerspective?:boolean;depthOcclusion?:boolean;vortex3d?:number;dispersion3d?:number;depthTintColor?:string}
export const DEFAULT_ENGINE_SETTINGS:EngineSettings={paletteSource:'custom',grainProfile:true,backgroundMode:'solid',resonatorMode:'resonator',focusOrder:'listed',dotShape:'circle',autoFitSizes:true,mediumEnabled:false,collisionEnabled:false,collisionMode:'obstacle',pairwiseEnabled:false,fontFamily:'system-ui, -apple-system, sans-serif',fontWeight:900,resonanceEnabled:true,morphEnabled:false,trajectory:'toroidalHopf',driveShape:'sine',autoOscillate:true,relationalEnabled:false,relationalMode:'orbital',pointerMode:'repel',pointerClick:'pulse',pointerClickStrength:2.2,pointerClickRadius:.45,colorMode:'linearGradient',colorEnabled:true,mediumPlane:'vertical',mediumDimension:'2D',autoSweep:false,sweepDirection:'ascent'};
export interface Scene {research?:ResearchMaterial;pointerScope?:'local'|'global';
 engine:EngineSettings;
 semanticField?:SemanticFieldConfig;
 resonanceDrive?:ResonanceDriveConfig;
 favourites?:string[];
 native?: {config:PointCloudConfig; original:unknown; projection?:PointCloudConfig};
 propertyTakeRange?:{start:number;end:number};toolbelt?:BeltEntry[];propertyTracks?:PropertyTrack[];id:string;name:string;character:string;duration:number;transition:number;
 view:{nativeScaffold?:'off'|'axis'|'grid';nativeCamera?:CameraOrbState;mode:'2d'|'3d';yaw:number;pitch:number;zoom:number;panX:number;panY:number};
 field:{background:string;palette:string[];material:Material;params:Record<string,number>};
 entities:Entity[];text:TextLayer[];
 composition:{blueprint?:SceneBlueprint;layout:string;plane:Plane;focus:'parallel'|'travelling';focusDuration:number;focusDwell?:number;carryTint:boolean;carryStation:boolean;frequencyDriver:'manual'|'focus'|'automation'};
 morph:{thetaRate:number;phiRate:number;thetaOffset:number;phiOffset:number;law:'theta'|'product'|'sum'|'beat';depth:number;dwell:number};
 automation:AutomationLane[];
}
export interface Journey {shared?:SharedSettings;savedScenes?:Record<string,Scene>;schema:'oi.journey';version:1;id:string;name:string;description:string;loop:boolean;scenes:Scene[];updatedAt:string}
/** structuredClone is several times cheaper than a JSON round-trip on source-heavy documents. */
export const clone=<T>(v:T):T=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
/** Depth lamination default span, stage units (×400 = native world px). ~half the stage: a clear front/back separation. */
export const uid=(prefix='id')=>prefix+'-'+(globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2,12));
export const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export const DEFAULT_PARAMS:Record<string,number>={
 count:62000,size:2.8,sizeBias:1.6,opacity:.92,roundness:.95,softness:.15,irregularity:.35,elongation:.04,orientation:0,
 contrast:.93,densityScale:1,densityPhase:.3,edgeWeight:0,halo:.13,
 speed:.7,circulation:1,turbulence:.22,turbulenceScale:1.2,recovery:1.1,dispersion:.09,
 pointerStrength:.8,pointerRadius:.23,pointerFalloff:2,depth:.12,grain:.035,
 snapRigidity:1,densityTether:1,curlDepth:.2,vortexRadius:.4,gravityX:0,gravityY:0,gravityZ:0,quadraticDrag:.2,thermalJitter:0,speedLimit:3,zConfinement:1,timeScale:1,gravitySoftening:.1,gravityFalloff:2,swirlRadius:.4,
 frequency:220,dominance:0,excitation:.6,
};
export function entity(name:string,text='O',position:Vec3={x:0,y:0,z:0}):Entity{return {
 id:uid('entity'),name,kind:'formation',position:{...position},size:{x:.65,y:.86},rotation:0,shape:'text',text,share:1,tint:'#252720',tintWeight:0,locked:false,
 force:{kind:'attract',strength:0,radius:.45,spin:0},station:null,sequence:{enabled:false,clock:'seconds',steps:[{id:uid('step'),text,shape:'text',hold:3,transition:1,position:null}]}
};}
export function pin(position:Vec3):Entity{const e=entity('Attractor','',position);e.kind='pin';e.share=0;e.force.strength=1;e.size={x:.1,y:.1};return e;}
export function blankScene(name='Untitled scene'):Scene{return{toolbelt:defaultWorkspace().entries,
 engine:{...DEFAULT_ENGINE_SETTINGS},
 id:uid('scene'),name,character:'An arrangement, waiting to happen.',duration:12,transition:1.5,
 view:{mode:'2d',yaw:0,pitch:0,zoom:1,panX:0,panY:0},
 field:{background:'#f4f2eb',palette:['#252720','#252720'],material:'ink',params:{...DEFAULT_PARAMS}},entities:[],
 text:[],
 composition:{layout:'free',plane:'XY',focus:'parallel',focusDuration:4,carryTint:true,carryStation:false,frequencyDriver:'manual'},
 morph:{thetaRate:.08,phiRate:.13,thetaOffset:0,phiOffset:0,law:'theta',depth:1,dwell:.3},automation:[]
};}
const descriptions=[
 ['Ink','Between','form & field.','Fine, irregular stippling.\nForm on the edge of dissolution.'],
 ['Print','The print','comes undone.','An imperfect lattice.\nA surface beginning to move.'],
 ['Gather','Gathering','a current.','Rounded grains find\na shared current.'],
 ['Between','Neither one.','Nor two.','Two characters, one material.\nAn unsettled identity.'],
 ['Language','A language','of particles.','A different character.\nThe same living field.'],
 ['Weather','A change','in the weather.','No centre, no logo.\nOnly changing concentrations.'],
 ['Quiet','Room for','something else.','A little less certainty.\nA little more space.'],
 ['Nocturne','What the','dark holds.','Light collected in the dark.\nSomething quietly taking form.']
];
export function fieldStudies():Journey {
 const scenes=descriptions.map((d,i)=>{const s=blankScene(d[0]);s.id='study-'+i;s.character=d[3].replace('\n',' ');s.duration=14;
 const o=entity('O — opening','O',{x:-.22,y:.03,z:0});o.id='opening-o';o.size={x:1.43,y:1.63};o.rotation=-5;
 o.share=4;const ii=entity('I — interval','I',{x:.66,y:.015,z:0});ii.id='opening-i';ii.size={x:.28,y:1.62};ii.share=1;s.entities=[o,ii];
 if(i===1){s.field.material='print';Object.assign(s.field.params,{count:24000,size:4.1,contrast:.7,roundness:.15,dispersion:.025,speed:.4});}
 if(i===2){const e=entity('Gathering ring','O');e.id='opening-o';e.shape='ring';e.size={x:1.6,y:1.64};s.entities=[e];s.field.material='round';Object.assign(s.field.params,{count:28000,size:3.6,contrast:.75,densityPhase:2});}
 if(i===3){o.position.x=-.14;o.rotation=-17;ii.position.x=.40;ii.rotation=10;Object.assign(s.field.params,{dispersion:.16,contrast:.86});}
 if(i===4){o.text='&';o.name='Ampersand';o.size={x:1.25,y:1.5};o.position.x=.1;o.rotation=0;s.entities=[o];Object.assign(s.field.params,{contrast:.6});}
 if(i===5){o.shape='square';o.name='Atmosphere';o.position.x=0;o.size={x:3.6,y:2.5};s.entities=[o];Object.assign(s.field.params,{count:52000,size:1.45,contrast:.98,densityScale:1.8,opacity:.5,dispersion:.4});}
 if(i===6){o.position.x=.2;o.size={x:1.15,y:1.55};ii.position.x=.84;s.field.palette=['#8b8576','#c5bba3'];Object.assign(s.field.params,{count:29000,opacity:.5,size:1.5,contrast:.7});}
 if(i===7){s.field.background='#1d231f';s.field.palette=['#eee9d9','#a9b399'];Object.assign(s.field.params,{opacity:.9,densityPhase:1.9});}
 s.field.params.count=62000;
 return s;});
 return {schema:'oi.journey',version:1,id:'field-studies',name:'Field studies',description:'Eight states of a living material. An expression from ink to atmosphere.',loop:true,scenes,updatedAt:new Date().toISOString()};
}
/** The O:I mark as the app's own first expression — one expression, two
 * scenes: the same O and I, the same fine ink stippling, read in day
 * (ink on paper) and night (light collected in the dark). This is the
 * light/dark theme expression that matches the base O:I image, and it is
 * what the instrument opens at boot (owner direction 2026-09-19). */
export function oiMark():Journey {
 const mark=()=>{const s=blankScene();const o=entity('O — opening','O',{x:-.22,y:.03,z:0});o.id='opening-o';o.size={x:1.43,y:1.63};o.rotation=-5;
  o.share=4;const ii=entity('I — interval','I',{x:.66,y:.015,z:0});ii.id='opening-i';ii.size={x:.28,y:1.62};ii.share=1;s.entities=[o,ii];return s;};
 const day=mark();day.id='mark-day';day.name='Day';day.character='The mark in ink on paper — the base O:I image, light.';day.duration=16;
 const night=mark();night.id='mark-night';night.name='Night';night.character='The same mark, light collected in the dark — the base O:I image, dark.';night.duration=16;
 night.field.background='#1d231f';night.field.palette=['#eee9d9','#a9b399'];Object.assign(night.field.params,{opacity:.9,densityPhase:1.9});
 return {schema:'oi.journey',version:1,id:'oi-mark',name:'O:I — the mark',description:'One expression, two scenes: the base O:I image in day and night.',loop:true,scenes:[day,night],updatedAt:new Date().toISOString()};
}
export function chakraEntities():Entity[]{return ['Root','Sacral','Solar','Heart','Throat','Brow','Crown'].map((name,i)=>{const e=entity(name,['△','◯','△','✧','◯','∞','✧'][i],{x:.18,y:-.82+i*.274,z:0});e.size={x:.235,y:.235};e.tint=['#a94138','#c67c46','#c2a852','#638c69','#5898a4','#737599','#a590b0'][i];e.tintWeight=1;e.station=i;e.force={kind:'vortex',strength:.3,radius:.27,spin:.12};return e;});}
export function sevenCentres():Journey{const s=blankScene('Seven centres');s.entities=chakraEntities();s.field.params.count=42000;s.field.params.contrast=.5;s.composition.layout='column';const t=clone(s);t.id=uid('scene');t.name='A rising attention';t.composition.focus='travelling';return {schema:'oi.journey',version:1,id:'seven-centres',name:'Seven centres',description:'A spatial composition; not seven isolated simulations.',loop:true,scenes:[s,t],updatedAt:new Date().toISOString()};}
export function smallLanguage():Journey {const j=fieldStudies();j.id='small-language';j.name='A small language';j.description='Three characters, and the intervals between them.';j.scenes=[j.scenes[0],j.scenes[4],j.scenes[6]].map((s,i)=>{s.id=uid('scene');s.name=['A beginning','And','An opening'][i];return s;});return j;}
export function blankJourney():Journey{return {schema:'oi.journey',version:1,savedScenes:{},id:uid('journey'),name:'Untitled expression',description:'',loop:true,scenes:[blankScene()],updatedAt:new Date().toISOString()};}
/** Validate before use. Reject malformed documents; never silently claim schema-4 migration. */
export function validateJourney(value:unknown):Journey {
 if(!value||typeof value!=='object')throw new Error('Choose a Field Studies journey JSON file.');
 const inspect=(v:unknown,depth=0):void=>{if(depth>40)throw new Error('Document nesting is too deep.');if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Non-finite value.');if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw new Error('Unsafe document key.');inspect(x,depth+1);}};inspect(value);
 const j=clone(value) as Journey;
 if(j.schema!=='oi.journey'||j.version!==1)throw new Error('This is not a journey-schema 1 document. Use Import for native schema-4 configurations.');
 const finite=(n:unknown,a:number,b:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
 const str=(s:unknown,max=5000)=>typeof s==='string'&&s.length<=max;
 const safeId=(s:unknown)=>typeof s==='string'&&/^[a-zA-Z0-9_.:-]{1,160}$/.test(s);
 const color=(s:unknown)=>typeof s==='string'&&/^#[\da-f]{6}$/i.test(s);
 if(!str(j.name,160)||!safeId(j.id)||!str(j.description)||typeof j.loop!=='boolean'||!Array.isArray(j.scenes)||!j.scenes.length||j.scenes.length>64)throw new Error('Journey metadata or scene count is invalid (1–64 scenes).');
 const validateSource=(source:Entity['source'])=>{if(!source)return;if(!['ascii','image'].includes(source.kind))throw new Error('Invalid formation source');if(source.kind==='ascii'){const a=source.ascii;if(!a||!str(a.text,50000)||a.fontFamily!==undefined&&!str(a.fontFamily,200)||a.fontSize!==undefined&&!finite(a.fontSize,1,1024)||a.invert!==undefined&&typeof a.invert!=='boolean')throw new Error('Invalid ASCII source');}else{const a=source.image;if(!a||!['luminance','edgeSobel','silhouette'].includes(a.mode)||!finite(a.threshold,0,1)||!finite(a.scale,.01,100)||a.invert!==undefined&&typeof a.invert!=='boolean'||a.name!==undefined&&!str(a.name,500)||a.dataUrl!==undefined&&(!str(a.dataUrl,12000000)||!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(a.dataUrl)))throw new Error('Invalid image source');}};
 if(j.shared){j.shared.toolbelt=validateWorkspace({version:1,appearance:'scene',entries:j.shared.toolbelt}).entries;for(const bucket of ['values','pointer'] as const){const values=j.shared[bucket];if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length>1024)throw new Error('Invalid expression properties');for(const [path,value] of Object.entries(values)){if(!globalPath(path)||bucket==='pointer'&&!POINTER_PATHS.includes(path)||!(typeof value==='number'&&finite(value,-1e8,1e8)||typeof value==='boolean'||str(value,300)))throw new Error('Invalid shared property: '+path);}}}
 const ids=new Set<string>();
 for(const s of j.scenes){if(s.pointerScope!==undefined&&!['local','global'].includes(s.pointerScope))throw new Error('Invalid pointer scope.');if(s.propertyTakeRange&&(!Number.isFinite(s.propertyTakeRange.start)||!Number.isFinite(s.propertyTakeRange.end)||s.propertyTakeRange.start<0||s.propertyTakeRange.end<=s.propertyTakeRange.start||s.propertyTakeRange.end>3600))throw new Error('Invalid property take interval');if(s.toolbelt!==undefined)s.toolbelt=validateWorkspace({version:1,appearance:'scene',entries:s.toolbelt}).entries;if(s.propertyTracks!==undefined)s.propertyTracks=validateTracks(s.propertyTracks);s.engine={...DEFAULT_ENGINE_SETTINGS,...s.engine};if(!safeId(s.id)||ids.has(s.id)||!str(s.name,160)||!str(s.character)||!finite(s.duration,1,3600)||!finite(s.transition,0,30))throw new Error('Invalid or duplicate scene.');ids.add(s.id);
  if(!s.view)s.view={mode:'2d',yaw:0,pitch:0,zoom:1,panX:0,panY:0};
  if(s.view.nativeScaffold!==undefined&&!['off','axis','grid'].includes(s.view.nativeScaffold))throw new Error('Invalid native scaffold.');
  if(!['2d','3d'].includes(s.view.mode)||!finite(s.view.yaw,-1000,1000)||!finite(s.view.pitch,-1000,1000)||!finite(s.view.zoom,.01,100)||!finite(s.view.panX,-10,10)||!finite(s.view.panY,-10,10))throw new Error('Invalid scene framing.');
  if(!s.field||!color(s.field.background)||!['ink','print','round'].includes(s.field.material)||!Array.isArray(s.field.palette)||s.field.palette.length<2||s.field.palette.length>8||!s.field.palette.every(color)||!s.field.params)throw new Error('Scene material or palette is invalid.');
  for(const [key,defaultValue] of Object.entries(DEFAULT_PARAMS)){if(!(key in s.field.params))s.field.params[key]=defaultValue;if(!finite(s.field.params[key],-1e8,1e8))throw new Error('Invalid numeric field parameter: '+key);}
  if(!Array.isArray(s.entities)||s.entities.length>32||!Array.isArray(s.text)||s.text.length>16||!Array.isArray(s.automation)||s.automation.length>64)throw new Error('Scene exceeds safe authoring limits.');
  const eids=new Set<string>();for(const e of s.entities){if(!safeId(e.id)||eids.has(e.id)||!str(e.name,160)||!str(e.text,120)||!['formation','pin'].includes(e.kind)||!['text','ring','disc','square','triangle','yantra','cymatic'].includes(e.shape))throw new Error('Invalid entity.');eids.add(e.id);
   if(!e.position||!Object.values(e.position).every(n=>finite(n,-100,100))||!['x','y','z'].every(k=>finite(e.position[k as keyof Vec3],-100,100))||!e.size||!finite(e.size.x,.001,100)||!finite(e.size.y,.001,100)||!finite(e.rotation,-36000,36000)||!finite(e.share,0,1000)||!color(e.tint)||!finite(e.tintWeight,0,1)||typeof e.locked!=='boolean')throw new Error('Invalid entity transform or appearance.');
   if(!e.force||!['none','attract','repel','vortex'].includes(e.force.kind)||!finite(e.force.strength,-1000,1000)||!finite(e.force.radius,.001,125)||!finite(e.force.spin,-1000,1000)||!(e.station===null||Number.isInteger(e.station)&&e.station>=0&&e.station<7))throw new Error('Invalid entity influence.');
   validateSource(e.source);
   if(!e.sequence||e.sequence.sourcesVersion!==undefined&&e.sequence.sourcesVersion!==1||typeof e.sequence.enabled!=='boolean'||!['seconds','morph'].includes(e.sequence.clock)||!Array.isArray(e.sequence.steps)||e.sequence.steps.length>32)throw new Error('Invalid sequence.');
   for(const l of e.layers??[])if(typeof l.id!=='string'||!l.id||!finite(l.z,-100,100)||(l.scale!==undefined&&!finite(l.scale,.01,10))||typeof l.text!=='string')throw new Error('Invalid layer.');
   for(const step of e.sequence.steps){validateSource(step.source);if(step.name!==undefined&&!str(step.name,500))throw new Error('Invalid state name');if(step.objectState){const v=step.objectState;if(!v.size||!finite(v.size.x,.001,100)||!finite(v.size.y,.001,100)||!finite(v.rotation,-36000,36000)||v.scale!==undefined&&!finite(v.scale,.001,1000)||!color(v.tint)||!finite(v.tintWeight,0,1)||!v.force||!['none','attract','repel','vortex'].includes(v.force.kind)||!finite(v.force.radius,.001,125)||!finite(v.force.strength,-1000,1000)||!finite(v.force.spin,-1000,1000))throw new Error('Invalid object state');}if(!safeId(step.id)||!str(step.text,120)||!['text','ring','disc','square','triangle','yantra','cymatic'].includes(step.shape)||!finite(step.hold,0,3600)||!finite(step.transition,0,3600)||step.position!==null&&(!step.position||!['x','y','z'].every(k=>finite(step.position![k as keyof Vec3],-100,100))))throw new Error('Invalid sequence step.');}
  }
  if(s.research!==undefined)validateResearchMaterial(s.research,eids);
  for(const t of s.text){if(!safeId(t.id)||!str(t.kicker,300)||!str(t.title,300)||!str(t.italic,300)||!str(t.body)||!finite(t.x,-.5,1.5)||!finite(t.y,-.5,1.5)||!finite(t.width,60,1000)||!finite(t.size,14,150)||!['left','center','right'].includes(t.align)||typeof t.visible!=='boolean')throw new Error('Invalid page text.');}
  if(s.semanticField){const sf=s.semanticField;if(typeof sf.enabled!=='boolean'||sf.profile?.kind!=='chakra'||!safeId(sf.profile.profileId)||sf.affinity?.method!=='modalProjection'||!finite(sf.affinity.bandwidth,.001,10)||!finite(sf.globalColorGain,0,100)||!Array.isArray(sf.bindings)||sf.bindings.length>32)throw new Error('Invalid semantic field.');
   const semanticIds=new Set<string>();for(const b of sf.bindings){if(!safeId(b.id)||semanticIds.has(b.id)||!safeId(b.semanticNodeId)||typeof b.enabled!=='boolean'||!Array.isArray(b.carriers)||!b.carriers.length||b.carriers.length>16)throw new Error('Invalid semantic binding.');semanticIds.add(b.id);for(const c of b.carriers){if(!['entity','forceEmitter'].includes(c.kind)||!safeId(c.id)||c.kind==='entity'&&!eids.has(c.id))throw new Error('Invalid semantic carrier.');}if(b.resonance&&(!finite(b.resonance.gain,-100,100)||(b.resonance.anchorId!==undefined&&!str(b.resonance.anchorId,160))))throw new Error('Invalid semantic resonance binding.');if(b.color){const c=b.color;if(typeof c.enabled!=='boolean'||!['canonical','entityTint','override'].includes(c.colorSource)||c.overrideColor!==undefined&&!color(c.overrideColor)||!finite(c.gain,0,100)||!['independent','force'].includes(c.radius?.source)||c.radius.value!==undefined&&!finite(c.radius.value,.001,100000)||!['gaussian','compact'].includes(c.falloff)||!['world3d','compositionPlane'].includes(c.metric)||!['weighted','additive'].includes(c.blend)||!['resonanceAffinity','focus','constant'].includes(c.activation))throw new Error('Invalid semantic colour coupling.');}if(b.modulations){if(!Array.isArray(b.modulations)||b.modulations.length>16)throw new Error('Invalid semantic modulation list.');for(const m of b.modulations){if(!['resonanceAffinity','focus','carrierSpeed','forceStrength','forceSpin'].includes(m.source?.kind)||!['color.gain','color.radius','color.hueShift'].includes(m.target)||!finite(m.amount,-10000,10000)||m.offset!==undefined&&!finite(m.offset,-10000,10000)||m.clamp!==undefined&&(!Array.isArray(m.clamp)||m.clamp.length!==2||!m.clamp.every(v=>finite(v,-1e9,1e9))))throw new Error('Invalid semantic modulation.');}}}
  }
  if(s.resonanceDrive){const d=s.resonanceDrive;if(!['frequency','sweep','semanticFocus'].includes(d.kind))throw new Error('Invalid resonance driver.');if(d.kind==='semanticFocus'&&!safeId(d.profileId))throw new Error('Invalid semantic resonance driver.');if(d.kind==='sweep'&&([d.glideS,d.dwellS].some(v=>v!==undefined&&!finite(v!,0,3600))||(d.direction!==undefined&&!['ascent','descent','pingpong'].includes(d.direction))))throw new Error('Invalid resonance sweep.');}
  if(!s.composition||!['XY','XZ','YZ'].includes(s.composition.plane)||!['parallel','travelling'].includes(s.composition.focus)||!finite(s.composition.focusDuration,.01,3600)||!['manual','focus','automation'].includes(s.composition.frequencyDriver))throw new Error('Invalid composition.');
  if(s.composition.blueprint)validateBlueprint(s.composition.blueprint);
  if(!s.morph||!['theta','product','sum','beat'].includes(s.morph.law)||!finite(s.morph.thetaRate,-100,100)||!finite(s.morph.phiRate,-100,100)||!finite(s.morph.thetaOffset,-1000,1000)||!finite(s.morph.phiOffset,-1000,1000)||!finite(s.morph.depth,-10,10)||!finite(s.morph.dwell,0,.99))throw new Error('Invalid morph clock.');
  validateAutomationLinks(s.automation);for(const a of s.automation){if(!safeId(a.id)||!str(a.target,250)||!['lfo','ramp'].includes(a.type)||!['sine','triangle','square','saw','steps','smooth','morph'].includes(a.wave)||!['replace','add','multiply'].includes(a.blend)||!['once','loop','pingpong'].includes(a.loop)||![a.min,a.max,a.rate,a.phase,a.duration,a.delay].every(n=>typeof n==='number'&&Number.isFinite(n))||!(a.firedAt===null||typeof a.firedAt==='number'&&Number.isFinite(a.firedAt)))throw new Error('Invalid automation lane.');}
 }
 if(j.savedScenes!==undefined){
  if(!j.savedScenes||typeof j.savedScenes!=='object'||Array.isArray(j.savedScenes))throw new Error('Invalid saved scenes.');
  const saved=Object.entries(j.savedScenes);
  if(saved.length>64||saved.some(([id,s])=>!ids.has(id)||!s||s.id!==id))throw new Error('Saved scene does not match its working scene.');
  if(saved.length){const checked=validateJourney({...j,savedScenes:undefined,scenes:saved.map(([,s])=>s)});j.savedScenes=Object.fromEntries(checked.scenes.map(s=>[s.id,s]));}
 }
 return clone(j);
}
// --- Collections (the library refit at the Central/ProjectCentral levels) --
/** A collection manifest names member journey files as ordinary data. The
 * OPTIONAL provenance envelope (oi.collection-provenance) names where an
 * export was read from: its register and root, the Central-relative paths,
 * the ground the content was read from, the exported-at civil date, and the
 * generator with its own revision. Envelopes are additive and never a
 * schema gate: a manifest without one (an old export) validates unchanged,
 * and an envelope this code does not know is carried verbatim. */
export interface CollectionProvenance {schema?:string;register?:string;root?:string;paths?:string[];ground?:string;exported_at?:string;generator?:{name?:string;revision?:string;[key:string]:unknown};[key:string]:unknown}
export interface CollectionManifestEntry {id:string;name:string;file:string;group?:string}
export interface CollectionManifest {schema:string;exported_at?:string;source?:string;provenance?:CollectionProvenance;retained_non_legacy?:{id:string;reason:string}[];featured:CollectionManifestEntry[];starters:CollectionManifestEntry[];[key:string]:unknown}
export const COLLECTION_MANIFEST_SCHEMA='oi.legacy-collections/v1';
export const COLLECTION_PROVENANCE_SCHEMA='oi.collection-provenance/v1';
/** Validate a collection manifest — the manifest law beside validateJourney.
 * Rejects malformed documents (unsafe keys, ambiguous membership, unsafe
 * member paths); when the provenance envelope declares the known schema its
 * required facts are checked, and any other (or absent) envelope passes
 * through untouched. */
export function validateCollectionManifest(value:unknown):CollectionManifest {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Choose a collection manifest JSON document.');
 const inspect=(v:unknown,depth=0):void=>{if(depth>40)throw new Error('Document nesting is too deep.');if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Non-finite value.');if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw new Error('Unsafe document key.');inspect(x,depth+1);}};inspect(value);
 const safeId=(s:unknown)=>typeof s==='string'&&/^[a-zA-Z0-9_.:-]{1,160}$/.test(s);
 const str=(s:unknown,max=5000)=>typeof s==='string'&&s.length<=max;
 const m=clone(value) as CollectionManifest;
 if(m.schema!==COLLECTION_MANIFEST_SCHEMA)throw new Error(`This is not a collection manifest this build understands (expected ${COLLECTION_MANIFEST_SCHEMA}, got ${String(m.schema)}).`);
 const entry=(e:unknown,where:string):CollectionManifestEntry=>{
  if(!e||typeof e!=='object'||Array.isArray(e))throw new Error(`Manifest ${where} entry is not an object.`);
  const t=e as CollectionManifestEntry;
  if(!safeId(t.id))throw new Error(`Manifest ${where} entry has an invalid id.`);
  if(typeof t.file!=='string'||!t.file||t.file.startsWith('/')||t.file.split('/').some(seg=>seg==='..'))throw new Error(`Manifest entry ${t.id} names an unsafe member path.`);
  if(t.name!==undefined&&!str(t.name,300))throw new Error(`Manifest entry ${t.id} has an invalid name.`);
  if(t.group!==undefined&&!str(t.group,120))throw new Error(`Manifest entry ${t.id} has an invalid group.`);
  return {id:t.id,name:typeof t.name==='string'&&t.name?t.name:t.id,file:t.file,...(t.group!==undefined?{group:t.group}:{})};
 };
 for(const key of ['featured','starters'] as const){
  const list=m[key];
  if(list===undefined){m[key]=[];continue;}
  if(!Array.isArray(list))throw new Error(`Manifest ${key} must be a list of member entries.`);
  m[key]=list.map(e=>entry(e,key));
 }
 const ids=new Set<string>();
 for(const e of [...m.featured,...m.starters]){if(ids.has(e.id))throw new Error(`Manifest names "${e.id}" more than once; membership would be ambiguous.`);ids.add(e.id);}
 if(m.exported_at!==undefined&&!str(m.exported_at,60))throw new Error('Manifest exported_at is invalid.');
 if(m.source!==undefined&&!str(m.source,2000))throw new Error('Manifest source is invalid.');
 if(m.retained_non_legacy!==undefined){
  if(!Array.isArray(m.retained_non_legacy))throw new Error('Manifest retained_non_legacy must be a list.');
  for(const r of m.retained_non_legacy){if(!r||typeof r!=='object'||!safeId((r as {id?:unknown}).id)||!str((r as {reason?:unknown}).reason,500))throw new Error('Manifest retained_non_legacy entry is invalid.');}
 }
 if(m.provenance!==undefined){
  if(!m.provenance||typeof m.provenance!=='object'||Array.isArray(m.provenance))throw new Error('Collection provenance must be an object envelope.');
  const p=m.provenance as CollectionProvenance;
  if(p.schema===COLLECTION_PROVENANCE_SCHEMA){
   for(const k of ['register','root','ground','exported_at'] as const){const v=p[k];if(typeof v!=='string'||!v)throw new Error(`Provenance envelope is missing its ${k}.`);}
   if(!Array.isArray(p.paths)||!p.paths.length||!p.paths.every(x=>typeof x==='string'))throw new Error('Provenance envelope is missing its paths.');
   const g=p.generator;
   if(!g||typeof g!=='object'||typeof g.name!=='string'||!g.name||typeof g.revision!=='string'||!g.revision)throw new Error('Provenance envelope is missing its generator and revision.');
  }
 }
 return clone(m);
}
/** The collection's membership in manifest order — featured first, then the
 * starters in their listed groups. This order is what a collection restores
 * with (D3): a collection is never N loose expressions. */
export function collectionMembership(m:CollectionManifest):CollectionManifestEntry[]{
 return [...(m.featured??[]).map(e=>({...e,group:e.group??'Featured'})),...(m.starters??[]).map(e=>({...e,group:e.group??'Starters'}))];
}
