/** Optional local-desktop integration. Ordinary web/offline Expressions builds keep their existing behavior. */
import type {Journey} from './model';
import type {Camera} from './camera';
import {esc} from './icons';
import {ensureAutoQuality} from '../../src/physis/hardware';
export interface DesktopScene {expression:Journey;sceneIndex:number;camera:Camera;viewport?:{width:number;height:number};name:string}
export const physisHost=()=>!!document.querySelector('meta[name="physis-host"]');
async function api(route:string,body?:unknown){const r=await fetch(route,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Physis-Client':'1'},body:JSON.stringify(body)});const value=await r.json();if(!r.ok)throw new Error(value.error??r.statusText);return value;}
export async function saveDesktopScene(source:DesktopScene){return api('/api/scenes',source);}
export async function saveDesktopCapture(blob:Blob,filename:string,source:DesktopScene,settings:unknown){
 if(!physisHost())return false;
 const scene=await saveDesktopScene(source),kind=blob.type.startsWith('image/')?'images':'videos';
 const r=await fetch(`/api/media/${kind}?sceneId=${encodeURIComponent(scene.id)}`,{method:'POST',headers:{'Content-Type':blob.type.split(';')[0],'X-Physis-Client':'1','X-Physis-Capture':encodeURIComponent(JSON.stringify(settings))},body:blob});
 const result=await r.json();if(!r.ok)throw new Error(result.error??'Capture could not be saved');
 window.dispatchEvent(new Event('physis-library-changed'));return true;
}
export function installPhysis(getSource:()=>DesktopScene,load:(source:DesktopScene)=>void,toast:(text:string)=>void){
 if(!physisHost())return;
 const button=document.createElement('button');button.className='icon-button';button.id='physis-desktop';button.textContent='✧';button.title='Physis desktop';button.setAttribute('aria-label','Physis desktop');button.setAttribute('aria-expanded','false');document.querySelector('.header-actions')!.append(button);
 const panel=document.createElement('section');panel.id='physis-panel';panel.className='capture-panel chrome';panel.setAttribute('aria-label','Physis desktop');panel.hidden=true;document.body.append(panel);
 let state:any=null;
 const events=new EventSource('/api/events');events.onmessage=e=>{state=JSON.parse(e.data);window.dispatchEvent(new CustomEvent('physis-quality',{detail:state}));button.classList.toggle('active',!!state.running);const indicator=panel.querySelector('[data-physis-status]');if(indicator)indicator.textContent=statusText();};
 // The studio resolves `auto` too: open the app once and the tier is set for every surface.
 void ensureAutoQuality('studio');
 const statusText=()=>state?.error?state.error:state?.suspended&&state.enabled?`Paused: ${state.suspended}`:state?.running?'Desktop engine on':state?.starting?'Starting desktop engine':'Desktop engine off';
 const run=async(fn:()=>Promise<void>)=>{try{await fn();}catch(error){toast(error instanceof Error?error.message:String(error));}};
  async function render(){
  const [scenes,media]=await Promise.all([api('/api/scenes'),api('/api/media')]);
  const qualityNote=state?.hardware?`<p class="control-note">${esc(state.hardware.gpuLabel||'Unknown GPU')} · tier ${esc(state.hardware.tier||state.qualityMode||'balanced')}${state.live?` · ${Math.round(state.live.fps)} fps live${state.live.degraded?' · reduced':''}`:''}</p>`:'';
  panel.innerHTML=`<header><h3>Physis</h3><button class="icon-button" data-physis="close" aria-label="Close Physis desktop">×</button></header><p data-physis-status>${esc(statusText())}</p>${qualityNote}<div class="button-row"><button class="primary" data-physis="send">Use this scene on desktop</button><button class="secondary" data-physis="toggle">${state?.enabled?'Turn off':'Turn on'}</button></div><label class="control"><span>Opacity</span><input aria-label="Desktop opacity" type="range" min=".05" max="1" step=".05" value="${state?.opacity??.55}" data-physis-setting="opacity"></label><label class="control"><span>Quality</span><select aria-label="Desktop quality" title="Applies immediately to this window and to live scenes" data-physis-setting="quality">${[['auto','Auto · detect this hardware'],['eco','Eco · 24 fps · small fields'],['gentle','Gentle · 20 fps'],['balanced','Balanced · 30 fps'],['fluid','Fluid · 60 fps']].map(([v,l])=>`<option value="${v}" ${state?.qualityMode===v?'selected':''}>${l}</option>`).join('')}</select></label><div class="button-row"><button class="secondary" data-physis="save">Save expression to disk</button></div><label class="control"><span>Saved expressions</span><select aria-label="Physis saved expressions" data-physis-setting="load"><option value="">Load from disk…</option>${scenes.filter((s:any)=>s.expression).map((s:any)=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label><p class="control-note">Image capture and Save recording write directly to your Physis library. Completed videos become screensaver scenes.</p><div class="physis-media">${media.slice(0,5).map((m:any)=>`<a href="${esc(m.url)}" target="_blank" rel="noreferrer">${m.kind==='images'?'PNG':'Video'} · ${esc(m.name)}</a>`).join('')}</div>`;
 }
 function close(){panel.hidden=true;button.setAttribute('aria-expanded','false');}
 button.onclick=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)void run(render);};
 panel.addEventListener('click',e=>{const target=(e.target as Element).closest<HTMLElement>('[data-physis]');if(!target)return;void run(async()=>{
  const action=target.dataset.physis;if(action==='close'){close();return;}target.setAttribute('disabled','');
  try{if(action==='send'){const scene=await saveDesktopScene(getSource());await api('/api/overlay',{sceneId:scene.id,enabled:true});toast('Current scene is on your desktop.');}
   else if(action==='toggle')await api('/api/overlay',{enabled:'toggle'});
   else if(action==='save'){await saveDesktopScene(getSource());toast('Expression saved to the Physis directory.');}
   await render();
  }finally{target.removeAttribute('disabled');}
 });});
 panel.addEventListener('change',e=>{const target=e.target as HTMLInputElement;void run(async()=>{
  if(target.dataset.physisSetting==='opacity')await api('/api/overlay',{opacity:Number(target.value)});
  if(target.dataset.physisSetting==='quality'){await api('/api/overlay',{quality:target.value});await run(render);}
  if(target.dataset.physisSetting==='load'&&target.value){const item=(await api('/api/scenes')).find((s:any)=>s.id===target.value);if(item){load(item);toast('Expression loaded from the Physis directory.');close();}}
 });});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!(e.target as Element).closest('#physis-panel,#physis-desktop'))close();});
 window.addEventListener('physis-library-changed',()=>{if(!panel.hidden)void run(render);});
 window.addEventListener('pagehide',()=>events.close());
}
