import {ambientScene} from './ambient';
import {ProductionAdapter} from '../../field-studies-journeys/src/production';
import {fieldStudies,clone,validateJourney,type Scene} from '../../field-studies-journeys/src/model';
import {importDocuments} from '../../field-studies-journeys/src/nativeBridge';
import {defaultCamera,stageCentre,stageScale,basis,unproject,type Camera} from '../../field-studies-journeys/src/camera';
import {ensureAutoQuality} from './hardware';
const screensaver=new URLSearchParams(location.search).has('screensaver');
if(screensaver){document.body.style.background='#080a0c';document.title='Physis live screensaver';}
const canvas=document.querySelector<HTMLCanvasElement>('canvas')!;
let engine=new ProductionAdapter(canvas), scene:Scene|null=null, camera=defaultCamera();
let savedView:any=null;
const IDLE_MS=5*60*1000;
let paused=false,idleTimer=0;
const mouse={x:0,y:0,seen:false,inside:false};
if(screensaver){
 canvas.style.pointerEvents='auto';
 const armIdle=()=>{clearTimeout(idleTimer);idleTimer=window.setTimeout(()=>{
  paused=true;cancelAnimationFrame(raf);raf=0;canvas.dataset.phase='paused';
  canvas.dataset.stats=JSON.stringify({simTime,paused:true,fps:0});
 },IDLE_MS);};
 window.addEventListener('pointermove',event=>{
  mouse.inside=true;
  if(mouse.seen&&event.clientX===mouse.x&&event.clientY===mouse.y)return;
  mouse.x=event.clientX;mouse.y=event.clientY;mouse.seen=true;
  armIdle();
  if(paused){paused=false;last=performance.now();sampleStart=last;frames=0;raf=requestAnimationFrame(tick);}
 });
 document.documentElement.addEventListener('pointerleave',()=>{mouse.inside=false;});
 window.addEventListener('blur',()=>{mouse.inside=false;});
 window.addEventListener('contextmenu',event=>event.preventDefault());
 armIdle();
}
let simTime=0,frames=0,sampleStart=performance.now(),measuredFps=0,adaptiveRatio=.85;
let signature='', revision=0, fps=30, pixelRatio=1, last=performance.now(), ready=false, raf=0;
// Adaptive budget state: pixel ratio walks toward the tier floor first, then
// the particle budget; both recover after sustained headroom.
let baseCount=0,particleScale=1,pixelCap=1,slowSince=0,wellSince=0,degraded=false;
let lastTelemetry=0,lastDegradedState=false;
/** One report every few seconds, immediate whenever the degrade flag flips. */
function postTelemetry(s:{fps:number;particles:number;pixelRatio:number;degraded:boolean}){
 const now=performance.now();
 if(now-lastTelemetry<4000&&s.degraded===lastDegradedState)return;
 lastTelemetry=now;lastDegradedState=s.degraded;
 fetch('/api/telemetry',{method:'POST',headers:{'Content-Type':'application/json','X-Physis-Client':'1'},body:JSON.stringify(s)}).catch(()=>{});
}
function resize(){
 engine.resize(innerWidth,innerHeight,pixelRatio);
 if(!scene)return;
 camera={...defaultCamera(),...scene.view,panX:scene.view.panX*innerWidth,panY:scene.view.panY*innerHeight};
 if(savedView?.expression&&savedView.camera){camera={...camera,...savedView.camera};if(savedView.viewport){camera.panX*=innerWidth/savedView.viewport.width;camera.panY*=innerHeight/savedView.viewport.height;}}
 else if(scene.view.nativeCamera){const c=scene.view.nativeCamera;camera.yaw=-c.yaw;camera.pitch=c.pitch;camera.zoom=c.zoom*400/stageScale(innerWidth,innerHeight);const {a,b}=basis(camera),o=stageCentre(innerWidth,innerHeight);camera.panX=innerWidth/2-o.x-c.zoom*(a[0]*c.panX+a[1]*c.panY);camera.panY=innerHeight/2-o.y+c.zoom*(b[0]*c.panX+b[1]*c.panY);}
}
const events=new EventSource('/api/events?renderer=1');
void ensureAutoQuality('ambient');
events.onmessage=event=>{
 try {
  const state=JSON.parse(event.data), nextSignature=JSON.stringify([state.sceneId,state.particleLimit]);
  fps=state.fps||30;
  pixelCap=Math.max(.5,Number(state.pixelRatio)||1);
  if(adaptiveRatio>pixelCap)adaptiveRatio=pixelCap;
  pixelRatio=screensaver?adaptiveRatio:pixelCap;canvas.style.opacity=String(screensaver?1:state.opacity);resize();
  if(signature===nextSignature&&scene)return;
  const saved=state.scene;
  let expression=saved?.expression?validateJourney(saved.expression):saved?.config?importDocuments({name:saved.name,config:saved.config}).journeys[0]:fieldStudies();
  if(!expression)throw new Error('The selected scene could not be migrated to the current engine.');
  scene=clone(expression.scenes[saved?.sceneIndex??0]??expression.scenes[0]);
  if(screensaver)scene=ambientScene(scene,Math.min(16000,state.particleLimit));
  else scene.field.params.count=Math.min(scene.field.params.count,state.particleLimit);
  baseCount=scene.field.params.count;particleScale=1;
  savedView=saved;resize();
  signature=nextSignature;revision++;ready=false;simTime=0;
 }catch(error){canvas.dataset.phase='error';console.error(error);}
};
events.onerror=()=>{canvas.dataset.connection='reconnecting';};
function tick(now:number){
 if(paused)return;
 raf=requestAnimationFrame(tick);
 const elapsed=now-last;
 if(!scene||elapsed<1000/fps-1)return;
 last=now;
 try{
  const delta=Math.min(elapsed/1000,.05);simTime+=delta;
  const view=screensaver?{...camera,yaw:camera.yaw+.16*Math.sin(simTime/29),pitch:camera.pitch+.07*Math.sin(simTime/37),zoom:camera.zoom*(1+.035*Math.sin(simTime/19))}:camera;
  let pointer={active:false,world:{x:0,y:0,z:0}};
  if(screensaver&&mouse.seen&&mouse.inside){try{pointer={active:true,world:unproject(mouse.x,mouse.y,view,innerWidth,innerHeight)};}catch{/* An edge-on construction plane cannot be intersected safely. */}}
  engine.render({scene,authoringRevision:revision,scaffold:'off',simTime,delta,params:scene.field.params,camera:view,pointer,selectedIds:[]});
  canvas.dataset.phase='rendering';canvas.dataset.pointer=JSON.stringify(pointer);frames++;
  if(now-sampleStart>=2000){
   measuredFps=frames*1000/(now-sampleStart);frames=0;sampleStart=now;
   // Degrade fast after two slow seconds, recover one notch per ten good ones.
   if(measuredFps<fps*.85){
    if(!slowSince)slowSince=now;
    else if(now-slowSince>=2000){
     if(adaptiveRatio>.5){adaptiveRatio=Math.max(.5,Math.round((adaptiveRatio-.1)*100)/100);pixelRatio=adaptiveRatio;resize();}
     else if(scene&&particleScale>.25){particleScale=Math.max(.25,particleScale-.25);scene.field.params.count=Math.max(500,Math.round(baseCount*particleScale));}
     slowSince=now;degraded=true;
    }
   }else{
    slowSince=0;
    if(degraded){
     if(!wellSince)wellSince=now;
     else if(now-wellSince>=10000){
      if(particleScale<1){particleScale=Math.min(1,particleScale+.25);scene.field.params.count=Math.round(baseCount*particleScale);}
      else if(adaptiveRatio<pixelCap){adaptiveRatio=Math.min(pixelCap,Math.round((adaptiveRatio+.1)*100)/100);pixelRatio=adaptiveRatio;resize();}
      else degraded=false;
      wellSince=now;
     }
    }else wellSince=0;
   }
   const stats={fps:Math.round(measuredFps),simTime,particles:scene.field.params.count,pixelRatio,degraded,mode:screensaver?'live-screensaver':'overlay'};
   canvas.dataset.stats=JSON.stringify(stats);window.dispatchEvent(new CustomEvent('physis-frame',{detail:stats}));console.log('PHYSIS_FRAME_STATS '+JSON.stringify(stats));
   postTelemetry(stats);
  }
  if(!ready){ready=true;window.dispatchEvent(new Event('physis-ready'));console.log('PHYSIS_ENGINE_READY');}
 }catch(error){canvas.dataset.phase='error: '+String(error);console.error(error);cancelAnimationFrame(raf);}
}
window.addEventListener('resize',resize);
window.addEventListener('pagehide',()=>{clearTimeout(idleTimer);events.close();cancelAnimationFrame(raf);engine.dispose();});
raf=requestAnimationFrame(tick);
