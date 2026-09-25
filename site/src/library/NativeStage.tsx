import { useEffect, useRef, useState } from 'react';
import type { Edition, NativeScene } from './model.mjs';
import type { PublicField, Camera } from './native-player.mjs';
import { Tool } from './ui';
export function NativeStage({edition,scene,active,playing,selected,onSelect,onScene,onTick,onCamera,camera}:{edition:Edition;scene:NativeScene;active:boolean;playing:boolean;selected:string;onSelect:(ref:string)=>void;onScene:(ref:string)=>void;onTick:(delta:number)=>void;onCamera:(camera:Camera)=>void;camera?:Partial<Camera>}){
 const canvas=useRef<HTMLCanvasElement>(null),root=useRef<HTMLDivElement>(null),field=useRef<PublicField|null>(null);
 const [error,setError]=useState(''),[ready,setReady]=useState(false);
 const [nativeBody,setNativeBody]=useState<{journey:any;sceneMap:Record<string,string>;entityMap:Record<string,string>}|null>(null);
 const nativeDescriptor=edition.native_body;
 useEffect(()=>{let cancelled=false;setNativeBody(null);setReady(false);if(!nativeDescriptor)return;
  setError('');
  import('./native-player.mjs').then(({loadNativeJourney})=>loadNativeJourney(nativeDescriptor)).then(body=>{if(!cancelled)setNativeBody(body);}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:String(e));});
  return()=>{cancelled=true;};
 },[nativeDescriptor?.path,nativeDescriptor?.digest?.value]);
 const latest=useRef({edition,scene,active,playing,selected,onTick,onCamera,camera,nativeBody});latest.current={edition,scene,active,playing,selected,onTick,onCamera,camera,nativeBody};
 useEffect(()=>{let cancelled=false;let resident:PublicField|null=null;
  import('./native-player.mjs').then(({PublicField})=>{if(cancelled)return;
   resident=new PublicField(canvas.current!,setError,positions=>{
    if(!canvas.current?.dataset.ready){canvas.current!.dataset.ready='yes';setReady(true);}
    for(const p of positions){const node=root.current?.querySelector<HTMLElement>(`[data-entity-ref="${CSS.escape(p.ref)}"]`);if(node)node.style.transform=`translate(${p.x}px,${p.y}px)`;}
   },dt=>latest.current.onTick(dt));field.current=resident;
   const p=latest.current;if(!p.edition.native_body||p.nativeBody)resident.setScene(p.edition.publication.composition,p.scene.scene_ref,p.camera,p.nativeBody?.journey,p.nativeBody?.sceneMap,p.nativeBody?.entityMap);resident.setSelected(p.selected);resident.setPlaying(p.playing);resident.setActive(p.active);
  }).catch(e=>{if(!cancelled)setError(String(e));});
  return()=>{cancelled=true;if(resident){latest.current.onCamera({...resident.camera});resident.dispose();}field.current=null;};
 },[]);
 useEffect(()=>{if(field.current&&(!nativeDescriptor||nativeBody)){field.current.setScene(edition.publication.composition,scene.scene_ref,camera,nativeBody?.journey,nativeBody?.sceneMap,nativeBody?.entityMap);field.current.setSelected(selected);}},[edition,scene.scene_ref,selected,nativeBody,nativeDescriptor]);
 useEffect(()=>{field.current?.setActive(active);},[active]);
 useEffect(()=>{field.current?.setPlaying(playing);},[playing]);
 const save=()=>{if(field.current)onCamera({...field.current.camera});};
 const view=(change:Partial<Camera>)=>{field.current?.view(change);save();};
 useEffect(()=>{const node=canvas.current!;const wheel=(e:WheelEvent)=>{e.preventDefault();const f=field.current;if(f){f.view({zoom:Math.max(.25,Math.min(5,f.camera.zoom*Math.exp(-e.deltaY*.001)))});save();}};node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);},[]);
 const drag=useRef<{x:number;y:number;yaw:number;pitch:number;panX:number;panY:number;pan:boolean}|null>(null);
 return <div className="native-stage" ref={root} data-scene-ref={scene.scene_ref} aria-label="Live Expression">
  <canvas ref={canvas} aria-label="Expression field. Drag to orbit, shift-drag to pan, scroll to zoom." tabIndex={0} onContextMenu={e=>e.preventDefault()}
   onPointerDown={e=>{const f=field.current;if(!f)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,yaw:f.camera.yaw,pitch:f.camera.pitch,panX:f.camera.panX,panY:f.camera.panY,pan:e.shiftKey||e.button===2};}}
   onPointerMove={e=>{const d=drag.current;if(!d)return;const x=e.clientX-d.x,y=e.clientY-d.y;if(d.pan)view({panX:d.panX+x,panY:d.panY+y});else view({mode:'3d',yaw:d.yaw+x*.006,pitch:Math.max(-1.4,Math.min(1.4,d.pitch+y*.006))});}}
   onPointerUp={()=>{drag.current=null;save();}} onPointerCancel={()=>{drag.current=null;}}
   onKeyDown={e=>{const f=field.current;if(!f)return;const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'];if(!keys.includes(e.key))return;e.preventDefault();if(e.key==='0'){f.home();save();}else if(e.key==='+'||e.key==='-')view({zoom:Math.max(.25,Math.min(5,f.camera.zoom*(e.key==='+'?1.1:.9)))});else view({mode:'3d',yaw:f.camera.yaw+(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0),pitch:f.camera.pitch+(e.key==='ArrowUp'?-.12:e.key==='ArrowDown'?.12:0)});}}/>
  {!error&&<div className="field-objects" style={{visibility:ready?'visible':'hidden'}}>{scene.entity_refs.map(ref=>{const entity=edition.publication.composition.entities[ref];const target=edition.entry.scenes.find(s=>s.subject_ref===entity.subject?.subject_ref&&s.ref!==edition.entry.scenes[0].ref);return <button key={ref} className="field-object" data-entity-ref={ref} aria-pressed={selected===ref} onClick={()=>onSelect(ref)} onDoubleClick={()=>target&&onScene(target.ref)}><span className="field-object-hit"/><span className="field-object-label">{entity.title}</span></button>;})}</div>}
  {!ready&&!error&&<div className="field-loading" role="status"><span/>{nativeDescriptor&&!nativeBody?'Verifying the authored Expression…':'Opening the native field…'}</div>}
  {error&&<div className="field-error" role="alert"><h2>The live field needs attention.</h2><p>{error}</p><p>The published text and Scene addresses remain available in Read & sources.</p><button onClick={()=>{setError('');try{if(field.current)field.current.recover();else location.reload();}catch(e){setError(String(e));}}}>Recover field</button><small>Recovery retains the edition and view. It does not promise the previous particle state.</small></div>}
  <div className="camera-controls" role="group" aria-label="Camera"><Tool name="minus" label="Zoom out" onClick={()=>field.current&&view({zoom:Math.max(.25,field.current.camera.zoom*.8)})}/><Tool name="fit" label="Restore Scene view" onClick={()=>{field.current?.home();save();}}/><Tool name="plus" label="Zoom in" onClick={()=>field.current&&view({zoom:Math.min(5,field.current.camera.zoom*1.2)})}/></div>
 </div>;
}
