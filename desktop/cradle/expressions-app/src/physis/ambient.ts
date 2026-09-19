import {clone,type Scene} from '../../field-studies-journeys/src/model';
import {automationTarget} from '../../field-studies-journeys/src/nativeParameters';

/** Runtime-only additions: never rewrite the saved expression or its own lanes. */
export function ambientScene(source:Scene,limit=16000):Scene {
 const scene=clone(source);
 scene.field.params.count=Math.min(scene.field.params.count,limit);
 for(const [key,span,period] of [['dispersion',.06,47],['circulation',.25,67],['speed',.15,83]] as const){
  const target='field.'+key,binding=automationTarget(scene,target);
  if(!binding||scene.automation.some(l=>l.enabled&&l.target===target))continue;
  scene.automation.push({id:'physis-ambient-'+key,target,enabled:true,type:'lfo',wave:'sine',min:Math.max(binding.hardMin,binding.value-span),max:Math.min(binding.hardMax,binding.value+span),rate:1/period,phase:0,blend:'replace',duration:period,delay:0,loop:'loop',firedAt:null});
 }
 return scene;
}
