import {ProductionAdapter as NativeAdapter} from '/Users/admin/Central/Work/Point-Cloud-Demo/.aikit/tasks/glyph-coverage-oi-compat/field-studies-journeys/src/production';
import {ProductionAdapter as RetainedAdapter} from '@epilogos/oi-design-system/expressions-engine/oi/retained.mjs';
import {nativeSnapshotToJourney} from '@epilogos/oi-design-system/expressions-engine/shell/nativeBridge.mjs';
import {EngineSurface} from './snapshot/engineSurface';
import {stageRecipe} from './snapshot/recipes';

const camera={mode:'2d',yaw:0,pitch:0,zoom:1,panX:0,panY:0,plane:'XY',depth:0,grid:false,snap:false};
const pointer={active:false,world:{x:0,y:0,z:0}};
const stat=(a:number[])=>{const s=[...a].sort((a,b)=>a-b);return {count:a.length,mean:a.reduce((n,x)=>n+x,0)/a.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],max:s.at(-1)};};
(window as any).runParity=async(mode:string,duration=6000,minWarmFrames=0)=>{
 const config=stageRecipe('oi.mark');
 const scene=nativeSnapshotToJourney({config}).scenes[0];scene.id='parity';
 let adapter:any,surface:any,raf=0,last=performance.now(),record=false,firstAt=0,start=0;
 let before:any,after:any;const errors:string[]=[],frames:any[]=[],metrics:any={};
 const wrap=(obj:any,key:string,name=key)=>{const fn=obj[key];if(typeof fn!=='function')throw new Error('No real method '+name);obj[key]=function(...args:any[]){const t=performance.now();try{return fn.apply(this,args);}finally{if(record){const m=metrics[name]??={calls:0,ms:0,max:0};const ms=performance.now()-t;m.calls++;m.ms+=ms;m.max=Math.max(m.max,ms);}}};};
 let instrumented=false,draws=0;
 const instrument=(a:any)=>{
  wrap(a,'configuration');wrap(a,'resize');
  const render=a.render;a.render=function(frame:any){const t=performance.now();const result=render.call(a,frame);draws++;
   if(!instrumented){
    instrumented=true;firstAt=performance.now();
    for(const key of ['setHostView','advance','replaceConfig'])wrap(a.engine,key);
    wrap(a.engine.entities,'update','entities.update');wrap(a.engine.simulator,'step','simulator.step');wrap(a.engine.renderer,'render','renderer.render');
   }
   if(record)frames.push({at:t,ms:performance.now()-t,delta:frame.delta});return result;
  };return a;
 };
 if(mode==='surface-window'||mode==='surface-element'){
  (window as any).OI_ENGINE_FACTORY=(canvas:any)=>(adapter=instrument(new RetainedAdapter(canvas)));
  surface=mode==='surface-element'?EngineSurface.forElement(document.body,e=>errors.push(e)):EngineSurface.forWindow(e=>errors.push(e));
  surface.presentConfig('parity',config,'parity');
 }else{
  const canvas=document.body.appendChild(document.createElement('canvas'));
  adapter=instrument(new (mode==='native'?NativeAdapter:RetainedAdapter)(canvas));
  const tick=(now:number)=>{const delta=Math.min(.05,Math.max(.001,(now-last)/1000));last=now;
   adapter.resize(innerWidth,innerHeight,devicePixelRatio||1);
   adapter.render({scene,authoringRevision:1,simTime:0,delta,params:{},camera,pointer,selectedIds:[],scaffold:'off'});
   raf=requestAnimationFrame(tick);
  };raf=requestAnimationFrame(tick);
 }
 try{
  const deadline=performance.now()+40000;
  while(!instrumented||performance.now()-firstAt<2000||draws<minWarmFrames){if(performance.now()>deadline)throw new Error('Field did not warm');if(errors.length)throw new Error(errors.join(';'));await new Promise(r=>setTimeout(r,50));}
  const gl=adapter.engine.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  const gpu={renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),unmaskedRenderer:ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),unmaskedVendor:ext&&gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)};
  const parity={canvas:{width:adapter.canvas.width,height:adapter.canvas.height},viewport:{width:innerWidth,height:innerHeight},dpr:devicePixelRatio,config:adapter.engine.config,camera:{...camera},ownerCanvasCount:document.querySelectorAll('canvas').length};
  const warmup={draws,elapsedMs:performance.now()-firstAt};before=adapter.inspect(false);start=performance.now();record=true;
  await new Promise(r=>setTimeout(r,duration));record=false;
  const end=performance.now();after=adapter.inspect(false);
  const intervals=frames.slice(1).map((f,i)=>f.at-frames[i].at);
  return {mode,gpu,parity,warmup,elapsedMs:end-start,frames:frames.length,fps:frames.length*1000/(end-start),frameIntervals:stat(intervals),renderJs:stat(frames.map(f=>f.ms)),deltas:stat(frames.map(f=>f.delta)),metrics,before,after,stepDelta:after.steps-before.steps,seedDelta:after.seeds-before.seeds,bakeDelta:after.bakes-before.bakes,errors};
 }finally{record=false;cancelAnimationFrame(raf);if(surface)surface.dispose();else{adapter.dispose();adapter.canvas.remove();}delete (window as any).OI_ENGINE_FACTORY;}
};
