import {computeMorphDrive} from '../../src/engine/morphSignal';
import {toNativeConfig} from './nativeBridge';
import {resolvedAutomation} from './automationLinks';
import {Scene,Entity,Vec3,clamp} from './model.js';
import {parameter} from './registry.js';
const TAU=Math.PI*2;
export function phases(s:Scene,time:number){const theta=(time*s.morph.thetaRate+s.morph.thetaOffset)*TAU,phi=(time*s.morph.phiRate+s.morph.phiOffset)*TAU;const a=Math.sin(theta),b=Math.sin(phi);const raw=s.morph.law==='theta'?a:s.morph.law==='product'?a*b:s.morph.law==='sum'?(a+b)/2:Math.sin(theta-phi);return {theta,phi,drive:clamp((raw*s.morph.depth+1)/2,0,1)};}
export function sequenceAt(e:Entity,s:Scene,time:number):{from:number;to:number;mix:number;position:Vec3;text:string;nextText:string;shape:Entity['shape'];nextShape:Entity['shape']} {
 const q=e.sequence;if(!q.enabled||!q.steps.length)return{from:0,to:0,mix:0,position:{...e.position},text:e.text,nextText:e.text,shape:e.shape,nextShape:e.shape};
 let index=0,mix=0;
 if(q.clock==='morph'){const phase=time*s.morph.thetaRate+s.morph.thetaOffset;index=Math.floor(Math.max(phase,0))%q.steps.length;const f=((phase%1)+1)%1;mix=clamp((f-s.morph.dwell)/(1-s.morph.dwell),0,1);}
 else {const total=q.steps.reduce((n,k)=>n+k.hold+k.transition,0);let t=((time%total)+total)%total;for(let i=0;i<q.steps.length;i++){const k=q.steps[i];if(t<k.hold+k.transition){index=i;mix=clamp((t-k.hold)/k.transition,0,1);break;}t-=k.hold+k.transition;}}
 mix=mix*mix*(3-2*mix);const next=(index+1)%q.steps.length,a=q.steps[index],b=q.steps[next];const p=a.position??{x:0,y:0,z:0},r=b.position??{x:0,y:0,z:0};
 return{from:index,to:next,mix,position:{x:e.position.x+p.x+(r.x-p.x)*mix,y:e.position.y+p.y+(r.y-p.y)*mix,z:e.position.z+p.z+(r.z-p.z)*mix},text:a.text,nextText:b.text,shape:a.shape,nextShape:b.shape};
}
export function evaluateParameters(s:Scene,time:number){const p={...s.field.params};for(const authored of s.automation){const l=resolvedAutomation(s.automation,authored);if(!l.enabled||!l.target.startsWith('field.'))continue;const key=l.target.slice(6);if(!(key in p))continue;let v=0;
 if(l.type==='ramp'){if(l.firedAt===null)continue;let t=(time-l.firedAt-l.delay)/Math.max(.01,l.duration);if(t<0)continue;if(l.loop==='loop')t%=1;else if(l.loop==='pingpong'){t%=2;t=t>1?2-t:t;}else t=clamp(t,0,1);v=t*t*(3-2*t);}
 else if(l.wave==='morph'){const tm=toNativeConfig(s).toroidalMorph!;v=computeMorphDrive(tm,(s.engine.autoOscillate?time*(tm.oscillationSpeed??0)*TAU:0)+(tm.toroidalPhase??0),(s.engine.autoOscillate?time*(tm.poloidalRate??0)*TAU:0)+(tm.poloidalPhase??0)).progress;}
 else {const phase=time*l.rate+l.phase,t=((phase%1)+1)%1;v=l.wave==='sine'?(1-Math.cos(t*TAU))/2:l.wave==='triangle'?1-Math.abs(t*2-1):l.wave==='square'?(t<.5?0:1):l.wave==='saw'?t:l.wave==='steps'?Math.floor(t*5)/4:(1+Math.sin(phase*2.7)*Math.cos(phase*1.17))/2;}
 const n=l.min+(l.max-l.min)*v;p[key]=l.blend==='replace'?n:l.blend==='add'?p[key]+n:p[key]*n;
 const def=parameter(key);if(def)p[key]=clamp(p[key],def.min,def.max);
 }return p;}
export function focusAt(s:Scene,time:number){if(s.composition.focus!=='travelling'||!s.entities.length)return null;const forms=s.entities.filter(e=>e.kind==='formation');if(!forms.length)return null;const u=time/s.composition.focusDuration,idx=Math.floor(u)%forms.length;return {entity:forms[idx],next:forms[(idx+1)%forms.length],mix:u%1,index:idx};}
export function arrange(entities:Entity[],layout:string,plane:'XY'|'XZ'|'YZ'='XY'){
 const n=entities.length;if(!n)return;
 const axes:('x'|'y'|'z')[]=plane==='XY'?['x','y']:plane==='XZ'?['x','z']:['y','z'];
 if(layout.startsWith('align-')||layout.startsWith('distribute-')){const axis=axes[layout.endsWith('x')?0:1];const ordered=[...entities].sort((a,b)=>a.position[axis]-b.position[axis]);const lo=ordered[0].position[axis],hi=ordered.at(-1)!.position[axis],mean=ordered.reduce((v,e)=>v+e.position[axis],0)/n;ordered.forEach((e,i)=>e.position[axis]=layout.startsWith('align-')?mean:lo+(hi-lo)*i/Math.max(1,n-1));return;}
 // laminate: stack the selected centres through depth — the layout plane's normal — centred on their mean,
 // spanning the same .6 stage-unit pitch a grid row uses. Pair with each formation's own sequence lamination.
 if(layout==='laminate'){const axis=plane==='XY'?'z':plane==='XZ'?'y':'x';const ordered=[...entities].sort((a,b)=>a.position[axis]-b.position[axis]);const mean=ordered.reduce((v,e)=>v+e.position[axis],0)/n;ordered.forEach((e,i)=>e.position[axis]=mean+(n>1?(i/(n-1)-.5)*.6:0));return;}
 entities.forEach((e,i)=>{let x=0,y=0;const f=n===1?.5:i/(n-1);if(layout==='line'){x=(f-.5)*1.8;}else if(layout==='column'){y=(.5-f)*1.8;}else if(layout==='ring'){const a=i/n*TAU;x=Math.cos(a)*.72;y=Math.sin(a)*.72;}else if(layout==='spiral'){const a=i/n*TAU*1.5,r=.15+f*.7;x=Math.cos(a)*r;y=Math.sin(a)*r;}else if(layout==='grid'){const cols=Math.ceil(Math.sqrt(n)),rows=Math.ceil(n/cols);x=(i%cols-(cols-1)/2)*.6;y=((rows-1)/2-Math.floor(i/cols))*.6;}else return;
 if(plane==='XY'){e.position.x=x;e.position.y=y;}else if(plane==='XZ'){e.position.x=x;e.position.z=y;}else{e.position.y=x;e.position.z=y;}
 });
}

/** Reorder only formations in the focus route. Interleaved force-only pins keep their slots. */
export function reorderFocus(entities:Entity[],id:string,direction:-1|1){
 const slots=entities.flatMap((e,i)=>e.kind==='formation'?[i]:[]),from=slots.findIndex(i=>entities[i].id===id),to=from+direction;
 if(from<0||to<0||to>=slots.length)return false;
 const a=slots[from],b=slots[to];[entities[a],entities[b]]=[entities[b],entities[a]];return true;
}
