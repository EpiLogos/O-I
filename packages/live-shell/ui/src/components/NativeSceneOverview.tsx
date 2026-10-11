import {useEffect,useRef,useState} from 'react';
import type {NativeSceneAction} from '../shell/nativeContent';
import {currentNativeSceneReply,type NativeCompositionViewSource} from '../shell/compositionViews';

/** One overview traverses and zooms the native Expression extent. Its Scene
 * sections use disclosed seconds; glyph/source clocks remain in their owner. */
export function NativeSceneOverview({source}:{source:NativeCompositionViewSource}) {
  const [zoom,setZoom]=useState(1),[offset,setOffset]=useState(0),[fault,setFault]=useState<string|null>(null);
  const latest=useRef(source);latest.current=source;
  const lifetime=useRef(0);useEffect(()=>{lifetime.current++;return()=>{lifetime.current++}},[]);
  const drag=useRef<{pointer:number;x:number;y:number;offset:number;zoom:number;expression:string}|null>(null);
  const scenes=source.content?.scenes,timing=scenes?.timing.working,total=timing?.available?timing.total_seconds:0;
  useEffect(()=>{setOffset(0);setZoom(1);setFault(null);drag.current=null},[source.content?.basis.expression_ref]);
  useEffect(()=>{setOffset(value=>Math.max(0,Math.min(total-total/zoom,value)))},[total,zoom]);
  if(!source.content||!scenes)return null;
  const content=source.content,visible=total/zoom,bound=(value:number,nextZoom=zoom)=>Math.max(0,Math.min(total-total/nextZoom,value));
  const rows=timing?.available?timing.extents:[];
  const settle=async(action:NativeSceneAction,reveal=false)=>{
    if(!source.isPresented()||!source.actions)return;
    const captured=source,epoch=lifetime.current;
    try{const reply=await captured.actions!.scene(action);if(epoch===lifetime.current&&currentNativeSceneReply(captured,latest.current,reply,action)){
      setFault(reply.ok?null:reply.error);if(reply.ok&&reveal)captured.revealDetail('clip','scene',reply.reading.basis)
    }}
    catch(cause){if(epoch===lifetime.current&&currentNativeSceneReply(captured,latest.current,{ok:false,error:''},action))setFault(cause instanceof Error?cause.message:String(cause))}
  };
  const zoomAt=(next:number,fraction=.5)=>{next=Math.max(1,Math.min(32,next));setOffset(bound(offset+visible*fraction-total/next*fraction,next));setZoom(next)};
  const active=rows.find(row=>row.scene_ref===content.basis.scene_ref),playhead=active?active.start_seconds+(content.playback?.scene_elapsed_seconds??0):null;
  const ready=!!source.actions&&!content.standing.pending;
  return <section className="native-expression-timeline" aria-label="Expression Scenes">
    <div className="arrange-overview" role="slider" tabIndex={0} aria-label="Expression overview" aria-valuemin={0} aria-valuemax={Math.max(0,total-visible)} aria-valuenow={offset} aria-valuetext={`${offset.toFixed(2)}–${(offset+visible).toFixed(2)} seconds`} title={timing?.available?'Drag to traverse · drag vertically or scroll to zoom · double-click to seek · arrows to traverse, ↑↓ to zoom':timing?.reason??'Native Scene timing unavailable'}
      onPointerDown={event=>{if(!total)return;event.currentTarget.setPointerCapture(event.pointerId);const box=event.currentTarget.getBoundingClientRect(),position=(event.clientX-box.left)/box.width*total,start=position>=offset&&position<=offset+visible?offset:bound(position-visible/2);setOffset(start);drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,offset:start,zoom,expression:content.basis.expression_ref}}}
      onPointerMove={event=>{const start=drag.current;if(!start||start.pointer!==event.pointerId||start.expression!==latest.current.content?.basis.expression_ref||!event.currentTarget.hasPointerCapture(event.pointerId))return;const next=Math.max(1,Math.min(32,start.zoom*Math.pow(2,(start.y-event.clientY)/100)));setZoom(next);setOffset(bound(start.offset+(event.clientX-start.x)/event.currentTarget.clientWidth*total,next))}}
      onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}}
      onWheel={event=>{if(!total)return;if(event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))setOffset(bound(offset+(event.deltaX||event.deltaY)/event.currentTarget.clientWidth*visible));else{const box=event.currentTarget.getBoundingClientRect();zoomAt(zoom*Math.pow(2,-event.deltaY/240),Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)))}}}
      onDoubleClick={event=>{if(!ready||!total||content.playback?.saved_sequence_playing)return;const box=event.currentTarget.getBoundingClientRect(),position=Math.max(0,Math.min(total,(event.clientX-box.left)/box.width*total)),extent=rows.find((row,index)=>position>=row.start_seconds&&(position<row.start_seconds+row.duration_seconds||index===rows.length-1));if(extent)void settle({action:'seek',scene_ref:extent.scene_ref,seconds:Math.max(0,Math.min(extent.duration_seconds,position-extent.start_seconds)),sequence:'working'})}}
      onKeyDown={event=>{if(!total)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))event.preventDefault();if(event.key==='ArrowLeft')setOffset(bound(offset-visible/10));if(event.key==='ArrowRight')setOffset(bound(offset+visible/10));if(event.key==='ArrowUp')zoomAt(zoom*2);if(event.key==='ArrowDown')zoomAt(zoom/2);if(event.key==='Home')setOffset(0);if(event.key==='End')setOffset(bound(total))}}>
      {rows.map(row=><span key={row.scene_ref} style={{left:`${row.start_seconds/total*100}%`,width:`${row.duration_seconds/total*100}%`,top:2,height:9,background:row.scene_ref===content.basis.scene_ref?'var(--accent)':'var(--text-dim)'}}/>)}
      {!!total&&<div className="arrange-overview-window" style={{left:`${offset/total*100}%`,width:`${visible/total*100}%`}}/>}
    </div>
    <div className="native-section-ruler">{Array.from({length:5},(_,index)=><span key={index}>{total?Number((offset+visible*index/4).toFixed(2)):'—'}{index===4?' s':''}</span>)}</div>
    <div className="native-section-lane">{total?rows.map(extent=>{const row=scenes.scenes.find(row=>row.scene_ref===extent.scene_ref)!;return <button key={extent.scene_ref} style={{left:`${(extent.start_seconds-offset)/visible*100}%`,width:`${extent.duration_seconds/visible*100}%`}} aria-pressed={extent.scene_ref===content.basis.scene_ref} disabled={!ready||!row.material.available} title={`${row.title} · ${extent.duration_seconds} s · select Scene and open its Clip`} onClick={()=>void settle({action:'focus',scene_ref:row.scene_ref},true)}>{row.title}</button>}):scenes.scenes.map(row=><button className="native-section-undated" key={row.scene_ref} disabled={!ready||!row.material.available} aria-pressed={row.scene_ref===content.basis.scene_ref} title={row.material.reason??row.title} onClick={()=>void settle({action:'focus',scene_ref:row.scene_ref},true)}>{row.title}</button>)}
      {playhead!==null&&total>0&&<i className="native-section-playhead" aria-hidden="true" style={{left:`${(playhead-offset)/visible*100}%`}}/>}
    </div>{fault&&<div role="alert" className="native-scene-map-fault">{fault}</div>}
  </section>;
}
