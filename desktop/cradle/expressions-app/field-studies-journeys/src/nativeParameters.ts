/** Reversible registry projection. Factors convert authored stage units to native units. */
import {PARAM_REGISTRY,entityParamDefs} from '../../src/engine/paramRegistry';
import {DEFAULT_CONFIG} from '../../src/engine/PointCloudField';
import {readPath} from '../../src/engine/automation';
import {automationGroups} from './automationLinks';
import type {Scene} from './model';
export const WORLD_SCALE = 400;
export interface NativeBinding {path:string;key:string;bind:string;factor:number;label:string;group:string;min:number;max:number;hardMin:number;hardMax:number;step:number;unit?:string;note?:string;defaultValue:number;scale?:'linear'|'log'}
const aliases:Record<string,[string,number?,string?]>={
 'interaction.clickStrength':['pointerClickStrength',1,'engine.pointerClickStrength'],'interaction.clickRadius':['pointerClickRadius',400,'engine.pointerClickRadius'],
 ...Object.fromEntries(['sizeBias','opacity','roundness','softness','irregularity','elongation','orientation','contrast','densityScale','densityPhase','edgeWeight','halo'].map(k=>['material.'+k,[k]])), paperGrain:['grain'],
 particleCount:['count'], 'particleSize.max':['size'],
 'fluid.returnSpeed':['recovery'],'fluid.vortexStrength':['circulation'],'fluid.curlScale':['turbulenceScale'],
 'fluid.curlSpeed':['speed'],'fluid.turbulence':['turbulence'],'fluid.dispersion':['dispersion'],
 'fluid.snapRigidity':['snapRigidity'],'fluid.densityTether':['densityTether'],'fluid.curlDepth':['curlDepth'],
 'fluid.vortexRadius':['vortexRadius',400],'fluid.gravityX':['gravityX'],'fluid.gravityY':['gravityY'],'fluid.gravityZ':['gravityZ'],
 'fluid.quadraticDrag':['quadraticDrag'],'fluid.thermalJitter':['thermalJitter'],'fluid.maxSpeed':['speedLimit',400],
 'fluid.zConfinement':['zConfinement'],'fluid.timeScale':['timeScale'],
 'interaction.radius':['pointerRadius',400],'interaction.strength':['pointerStrength'],'interaction.falloffPower':['pointerFalloff'],
 'relational.gravitySoftening':['gravitySoftening',400],'relational.gravityFalloff':['gravityFalloff'],'relational.swirlRadius':['swirlRadius',400],
 'cymatics.frequencyHz':['frequency'],'cymatics.dominance':['dominance'],'cymatics.driveStrength':['excitation'],
 'toroidalMorph.volumetricDepthScale':['depth'],
 'toroidalMorph.oscillationSpeed':['thetaRate',1,'morph.thetaRate'],
 'toroidalMorph.poloidalRate':['phiRate',1,'morph.phiRate'],
 'toroidalMorph.toroidalPhase':['thetaOffset',Math.PI*2,'morph.thetaOffset'],
 'toroidalMorph.poloidalPhase':['phiOffset',Math.PI*2,'morph.phiOffset'],
 'toroidalMorph.driveDepth':['morphDepth',1,'morph.depth'],
 'toroidalMorph.holdRatio':['morphDwell',1,'morph.dwell'],
 'composition.orchestration.dwell':['focusDwell',1,'composition.focusDwell'],
 'composition.orchestration.glide':['focusGlide',1,'composition.focusDuration'],
};
const groups:Record<string,string>={Fluid:'motion','Physics+':'physics',Particles:'material',Morph:'morph',Interaction:'pointer',Relational:'relational',Color:'color',Cymatics:'resonance',Composition:'composition',Material:'material',Paper:'color',Medium:'medium',Collision:'collision',Pairwise:'pairwise',Volume:'volume',Depth:'depth'};
const defaults:Record<string,number>={'cymatics.sweep.glideS':8,'cymatics.sweep.dwellS':2,'cymatics.modeCount':64,'color.cycleSpeed':0,'color.turbulenceModulation':0,'color.speedReactiveIntensity':0,'color.densityWeight':0,'composition.entityTintWeight':1,'composition.orchestration.dwell':0};
export const NATIVE_BINDINGS:NativeBinding[]=PARAM_REGISTRY.map(p=>{
 const a=aliases[p.path], key=a?.[0]??'native_'+p.path.replaceAll('.','__'),factor=a?.[1]??1;
 const value=defaults[p.path]??readPath(DEFAULT_CONFIG,p.path);
 return {...p,key,bind:a?.[2]??'field.params.'+key,factor,group:groups[p.group]??'physics',min:p.min/factor,max:p.max/factor,hardMin:p.hardMin/factor,hardMax:p.hardMax/factor,step:p.step/factor,
  unit:factor===400?'stage units':factor===Math.PI*2?'turns':p.unit,
  defaultValue:typeof value==='number'?value/factor:p.min/factor,note:p.hint};
});
export const nativeBinding=(key:string)=>NATIVE_BINDINGS.find(b=>b.key===key);
export function baseValue(scene:Scene,key:string):number {
 const b=nativeBinding(key), value=b?readPath(scene,b.bind):scene.field.params[key];
 return typeof value==='number'&&Number.isFinite(value)?value:b?.defaultValue??0;
}
export function bindValue(scene:Scene,path:string,value:unknown){
 if(path==='field.params.native_composition__orchestration__focusTintWeight'&&typeof value==='number'&&value>0)scene.composition.carryTint=true;
 const keys=path.split('.');if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))throw new Error('Unsafe document path');
 let o:any=scene;for(const k of keys.slice(0,-1))o=o[k]??(o[k]={});o[keys.at(-1)!]=value;
}

export interface AutomationTarget extends NativeBinding {target:string;entityId?:string;value:number}
/** Entity automation is addressed by stable ID in documents, resolved to an index only at the native boundary. */
export function entityTargets(scene:Scene):AutomationTarget[]{
 return scene.entities.flatMap((e,index)=>entityParamDefs(index,e).filter(p=>e.kind==='formation'||!p.path.endsWith('.scale')&&!p.path.includes('.sequence.')&&!p.path.endsWith('.tintWeight')).map(p=>{
  const suffix=p.path.replace(/^entities\.\d+\./,''),factor=['x','y','z','forces.radius'].includes(suffix)?WORLD_SCALE:1;
  const local=['x','y','z'].includes(suffix)?'position.'+suffix:suffix.replace(/^forces\./,'force.');
  let value=readPath(e,local);if(typeof value!=='number'){value=readPath(e.native,suffix);if(typeof value==='number')value/=factor;}
  if(typeof value!=='number')value=suffix==='scale'||suffix==='sequence.rateMul'?1:suffix==='sequence.hold'?e.sequence.steps[0]?.hold??3:suffix==='sequence.transition'?e.sequence.steps[0]?.transition??1:0;

  return {...p,key:suffix,bind:'entity.'+local,factor,group:'entity',target:'entity:'+encodeURIComponent(e.id)+':'+suffix,entityId:e.id,min:p.min/factor,max:p.max/factor,hardMin:p.hardMin/factor,hardMax:p.hardMax/factor,step:p.step/factor,defaultValue:Number(value),value:Number(value)};
 }));
}
export function automationTarget(scene:Scene,target:string):AutomationTarget|undefined{
 if(target.startsWith('field.')){const b=nativeBinding(target.slice(6));return b?{...b,target,value:baseValue(scene,b.key)}:undefined;}
 const known=entityTargets(scene).find(b=>b.target===target);if(known)return known;
 // Preserve imported numeric lanes outside the static registry. IDs, not array
 // indices, remain authoritative for both entities and their sequence links.
 let path:string, value:unknown, entityId:string|undefined;
 if(target.startsWith('entity:')){
  const [,encoded,...rest]=target.split(':'),id=decodeURIComponent(encoded),i=scene.entities.findIndex(e=>e.id===id);
  if(i<0)return;entityId=id;path=`entities.${i}.${rest.join(':')}`;value=readPath(scene.entities[i].native,rest.join(':'));
 }else if(target.startsWith('link:')){
  const [,encoded,encodedLink,...rest]=target.split(':'),id=decodeURIComponent(encoded),link=decodeURIComponent(encodedLink),i=scene.entities.findIndex(e=>e.id===id);
  if(i<0)return;const j=scene.entities[i].sequence.steps.findIndex(k=>k.id===link);if(j<0)return;
  entityId=id;path=`entities.${i}.sequence.links.${j}.${rest.join(':')}`;value=readPath(scene.entities[i].sequence.steps[j].native,rest.join(':'));
 }else if(target.startsWith('native:')){path=decodeURIComponent(target.slice(7));value=readPath(scene.native?.config,path)??readPath(DEFAULT_CONFIG,path);}
 else return;
 if(!/^[a-zA-Z0-9_.]+$/.test(path)||path.split('.').some(k=>['__proto__','prototype','constructor'].includes(k))||typeof value!=='number'||!Number.isFinite(value))return;
 return {path,key:path,bind:'',factor:1,label:'Native path · '+path,group:'native',target,entityId,value,defaultValue:value,min:Math.min(0,value),max:Math.max(1,value*2),hardMin:-1e10,hardMax:1e10,step:.01,note:'Imported native numeric path. Native units and existing consumer semantics are retained.'};
}
export function automationTargets(scene:Scene):AutomationTarget[]{
 const all=[...NATIVE_BINDINGS.map(b=>({...b,target:'field.'+b.key,value:baseValue(scene,b.key)})),...entityTargets(scene)];
 for(const lane of scene.automation){const t=automationTarget(scene,lane.target);if(t&&!all.some(a=>a.target===t.target))all.push(t);}return all;
}
/** Lanes whose entity or sequence link no longer exists cannot drive anything; drop them. */
export function pruneAutomation(scene:Scene):boolean{
 const before=scene.automation.length;
 scene.automation=scene.automation.filter(l=>automationTarget(scene,l.target));
 return scene.automation.length!==before;
}
/** A pin's own cycle clock: one stable shared clockId per pin, expressed with the existing lane clockId grouping (one engine clock, no second timer). */
export const pinCycleClockId=(entityId:string)=>'pin:'+entityId;
/** Automation groups with at least one lane targeting this entity, restricted to that entity's targets. */
export function entityCycleGroups(scene:Scene,entityId:string){return automationGroups(scene.automation).map(g=>({...g,targets:g.targets.filter(l=>automationTarget(scene,l.target)?.entityId===entityId)})).filter(g=>g.targets.length);}
export function stableNativeTarget(scene:Scene,path:string):string {
 const m=/^entities\.(\d+)\.(.+)$/.exec(path);if(!m)return 'native:'+encodeURIComponent(path);
 const e=scene.entities[Number(m[1])];if(!e)return 'native:'+encodeURIComponent(path);
 const link=/^sequence\.links\.(\d+)\.(.+)$/.exec(m[2]);
 return link&&e.sequence.steps[Number(link[1])]?`link:${encodeURIComponent(e.id)}:${encodeURIComponent(e.sequence.steps[Number(link[1])].id)}:${link[2]}`:`entity:${encodeURIComponent(e.id)}:${m[2]}`;
}
