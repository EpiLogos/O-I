import {memo,useEffect,useRef} from 'react';
import type {GraphNode,GraphReading} from './graph';
import type {Point} from './layout';
import {screenPoint,segmentVisible,zoomAt,type Camera} from './camera';
interface Props {nodes:GraphNode[];positions:Point[];model?:GraphReading;camera:Camera;selected?:string;focused:Set<string>;minZoom:number;maxZoom:number;onCamera:(camera:Camera)=>void;onOpen:(node:GraphNode)=>void;onClear:()=>void}
/** One demand-driven drawing loop. Pointer/wheel updates never render React
 * or persist state per frame. The accessibility subjects keep exact refs. */
export const GraphCanvas=memo(function GraphCanvas(props:Props) {
  const canvas=useRef<HTMLCanvasElement>(null),current=useRef(props);current.current=props;
  const engine=useRef<{target:(camera:Camera)=>void;redraw:()=>void;focus:(ref:string)=>void}>();
  useEffect(()=>{
    const el=canvas.current;if(!el)return;const ctx=el.getContext('2d',{alpha:true});if(!ctx)return;
    let width=0,height=0,ratio=1,frame=0,hover:string|undefined,drag:{x:number;y:number;camera:Camera;node?:GraphNode;moved:boolean}|undefined;
    let view={...current.current.camera},travel:{from:Camera;to:Camera;start:number}|undefined,wheelTimer:ReturnType<typeof setTimeout>|undefined;
    let gestureScale=1,nativeGesture=false,disposed=false;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const style=getComputedStyle(el);
    const value=(name:string)=>style.getPropertyValue(name).trim();
    const num=(name:string)=>{const raw=value(name);if(raw.endsWith('ms'))return parseFloat(raw);if(raw.endsWith('s'))return parseFloat(raw)*1000;const measure=document.createElement('span');measure.style.cssText=`position:absolute;visibility:hidden;pointer-events:none;width:${raw};height:0`;el.parentElement!.append(measure);const pixels=measure.getBoundingClientRect().width;measure.remove();return pixels||parseFloat(raw)||1;};
    let ink=value('--oi-foreground'),muted=value('--oi-muted'),edge=value('--oi-relation'),accent=value('--oi-focus'),ground=value('--oi-canvas-ground');
    const core=num('--oi-desktop-gap-xs'),spaceCore=num('--oi-desktop-gap-sm'),hit=num('--oi-desktop-gap'),halo=num('--oi-space-3'),line=num('--oi-cloud-edge');
    const font=num('--oi-shell-type-ui'),fontFamily=value('--oi-font-sans'),dot=num('--oi-cloud-dot');
    const duration=reduced.matches?0:num('--oi-motion-normal');
    let screen:{node:GraphNode;p:Point;x:number;y:number;r:number}[]=[],lookup=new Map<string,{x:number;y:number}>();
    const drawTimes:number[]=[];
    const report=()=>{if(!(import.meta as unknown as {env?:{DEV?:boolean}}).env?.DEV||!drawTimes.length)return;const times=drawTimes.splice(0).sort((a,b)=>a-b);console.info('C4 canvas draw',JSON.stringify({frames:times.length,p95DrawMs:times[Math.floor(times.length*.95)],maxDrawMs:times[times.length-1],visibleNodes:screen.length,totalNodes:current.current.nodes.length}));};
    const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(draw);};
    const commit=()=>{current.current.onCamera({...view});report();};
    /** Interrupting an in-flight camera travel keeps the camera the surface
     *  committed: the gesture composes on `travel.to`, never on the eased
     *  frame the travel is about to abandon. */
    const settle=()=>{if(travel){view={...travel.to};travel=undefined;}};
    function draw(time:number){
      frame=0;const started=performance.now(),p=current.current;
      ink=value('--oi-foreground');muted=value('--oi-muted');edge=value('--oi-relation');accent=value('--oi-focus');ground=value('--oi-canvas-ground');
      if(travel){const t=!reduced.matches&&duration?Math.min(1,(time-travel.start)/duration):1,e=1-Math.pow(1-t,3);view={x:travel.from.x+(travel.to.x-travel.from.x)*e,y:travel.from.y+(travel.to.y-travel.from.y)*e,zoom:travel.from.zoom+(travel.to.zoom-travel.from.zoom)*e};if(t===1)travel=undefined;}
      ctx!.setTransform(ratio,0,0,ratio,0,0);ctx!.clearRect(0,0,width,height);
      screen=[];lookup=new Map();
      p.nodes.forEach((node,i)=>{const point=p.positions[i];if(!point)return;const s=screenPoint(point,view,width,height);lookup.set(node.ref,s);const r=Math.max(dot,Math.min(halo,(node.kind==='wiki-space'?spaceCore:core)*(point.scale??1)*view.zoom));if(s.x>=-halo&&s.y>=-halo&&s.x<=width+halo&&s.y<=height+halo)screen.push({node,p:point,...s,r});});
      // Batch paths by focus state, retaining every admitted segment; missing
      // endpoints are represented by the related-subject UI, never invented.
      for(const receded of [true,false]){ctx!.beginPath();for(const relation of p.model?.edges??[]){if(Boolean(p.selected)&&!(p.focused.has(relation.from_ref)&&p.focused.has(relation.to_ref))!==receded)continue;if(!p.selected&&receded)continue;const a=lookup.get(relation.from_ref),b=lookup.get(relation.to_ref);if(a&&b&&segmentVisible(a,b,width,height)){ctx!.moveTo(a.x,a.y);ctx!.lineTo(b.x,b.y);}}ctx!.strokeStyle=edge;ctx!.lineWidth=line;ctx!.globalAlpha=receded?.12:.55;ctx!.stroke();}
      if(hover){ctx!.fillStyle=accent;ctx!.globalAlpha=.65;for(const relation of p.model?.edges??[]){if(relation.from_ref!==hover&&relation.to_ref!==hover)continue;const a=lookup.get(relation.from_ref),b=lookup.get(relation.to_ref);if(!a||!b||!segmentVisible(a,b,width,height))continue;const t=reduced.matches?.5:(time/Math.max(1,duration*16))%1;ctx!.beginPath();ctx!.arc(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,dot,0,Math.PI*2);ctx!.fill();}}
      const labelBoxes:{x:number;y:number;w:number;h:number}[]=[];
      screen.sort((a,b)=>Number(a.node.ref===p.selected||a.node.ref===hover)-Number(b.node.ref===p.selected||b.node.ref===hover));
      for(const item of screen){const {node,x,y,r}=item,selected=node.ref===p.selected,active=selected||node.ref===hover,receded=Boolean(p.selected)&&!p.focused.has(node.ref);
        ctx!.globalAlpha=receded?.28:Math.min(1,.45+(item.p.scale??1)*.45);
        if(active){ctx!.beginPath();ctx!.arc(x,y,r+hit*.55,0,Math.PI*2);ctx!.fillStyle=ground;ctx!.fill();ctx!.strokeStyle=accent;ctx!.lineWidth=line;ctx!.stroke();}
        ctx!.beginPath();ctx!.arc(x,y,r,0,Math.PI*2);ctx!.fillStyle=selected?accent:ink;ctx!.fill();
        if(active||(!receded&&node.kind==='wiki-space'&&view.zoom>.4)){
          ctx!.font=`${font}px ${fontFamily}`;const w=ctx!.measureText(node.label).width,box={x:x-w/2,y:y+r+hit*.65,w,h:font*1.5};
          if(active||!labelBoxes.some(b=>b.x<box.x+box.w&&b.x+b.w>box.x&&b.y<box.y+box.h&&b.y+b.h>box.y)){labelBoxes.push(box);ctx!.globalAlpha=active?1:.8;ctx!.fillStyle=active?ink:muted;ctx!.textAlign='center';ctx!.fillText(node.label,x,box.y+font);}
        }
      }
      ctx!.globalAlpha=1;drawTimes.push(performance.now()-started);if(drawTimes.length>600)drawTimes.shift();
      if(travel||(hover&&!reduced.matches))schedule();
    }
    const pointer=(e:{clientX:number;clientY:number})=>{const bounds=el.getBoundingClientRect();return {x:e.clientX-bounds.left,y:e.clientY-bounds.top};};
    const hitNode=(x:number,y:number)=>{let best:GraphNode|undefined,distance=Infinity;for(const item of screen){const d=Math.hypot(x-item.x,y-item.y);if(d<=Math.max(hit*.65,item.r+3)&&d<distance){best=item.node;distance=d;}}return best;};
    const down=(e:PointerEvent)=>{if(e.button!==0&&e.button!==1)return;e.preventDefault();const p=pointer(e);settle();drag={...p,camera:{...view},node:hitNode(p.x,p.y),moved:false};el.setPointerCapture(e.pointerId);el.focus({preventScroll:true});};
    const move=(e:PointerEvent)=>{const p=pointer(e);if(drag){const x=p.x-drag.x,y=p.y-drag.y;if(Math.hypot(x,y)>3)drag.moved=true;if(drag.moved){hover=undefined;view={...drag.camera,x:drag.camera.x+x,y:drag.camera.y+y};el.style.cursor='grabbing';schedule();}}else{const next=hitNode(p.x,p.y)?.ref;if(next!==hover){hover=next;el.style.cursor=hover?'pointer':'grab';schedule();}}};
    const up=(e:PointerEvent)=>{const gesture=drag;drag=undefined;if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);el.style.cursor=hover?'pointer':'grab';if(gesture&&!gesture.moved){if(gesture.node)current.current.onOpen(gesture.node);else current.current.onClear();}else if(gesture)commit();};
    const cancel=()=>{if(drag){drag=undefined;commit();}el.style.cursor='grab';};
    const leave=()=>{if(!drag){hover=undefined;schedule();}};
    const wheel=(e:WheelEvent)=>{e.preventDefault();if(nativeGesture)return;settle();hover=undefined;const point=pointer(e),unit=e.deltaMode===1?font:e.deltaMode===2?height:1;const dx=e.deltaX*unit,dy=e.deltaY*unit;
      if(e.ctrlKey||e.metaKey||e.deltaMode!==0)view=zoomAt(view,Math.exp(-dy*.008),point.x-width/2,point.y-height/2,current.current.minZoom,current.current.maxZoom);
      else view={...view,x:view.x-dx,y:view.y-dy};
      schedule();clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>{wheelTimer=undefined;commit();},120);
    };
    const gestureStart=(e:Event)=>{e.preventDefault();settle();nativeGesture=true;gestureScale=1;};
    const gestureChange=(e:Event)=>{e.preventDefault();const g=e as Event&{scale:number;clientX:number;clientY:number};if(!Number.isFinite(g.scale)||g.scale<=0)return;const point=pointer(g);view=zoomAt(view,g.scale/gestureScale,point.x-width/2,point.y-height/2,current.current.minZoom,current.current.maxZoom);gestureScale=g.scale;schedule();};
    const gestureEnd=()=>{nativeGesture=false;commit();};
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();current.current.onClear();return;}if(e.altKey||e.metaKey||e.ctrlKey)return;const pan={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]}[e.key];if(pan){e.preventDefault();settle();view={...view,x:view.x+pan[0],y:view.y+pan[1]};schedule();commit();}else if(['+','=','-'].includes(e.key)){e.preventDefault();settle();view=zoomAt(view,e.key==='-'?1/1.2:1.2,0,0,current.current.minZoom,current.current.maxZoom);schedule();commit();}};
    const resize=()=>{const r=el.getBoundingClientRect();width=r.width;height=r.height;ratio=Math.min(2,devicePixelRatio||1);el.width=Math.max(1,Math.round(width*ratio));el.height=Math.max(1,Math.round(height*ratio));schedule();};
    const observer=new ResizeObserver(resize);observer.observe(el);const themeObserver=new MutationObserver(schedule);themeObserver.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:['class','data-theme']});
    engine.current={target(camera){if(Math.abs(view.x-camera.x)+Math.abs(view.y-camera.y)+Math.abs(view.zoom-camera.zoom)<.0001)return;travel={from:{...view},to:camera,start:performance.now()};schedule();},redraw:schedule,focus(ref){hover=ref;const i=current.current.nodes.findIndex(n=>n.ref===ref),point=current.current.positions[i];if(point){const s=screenPoint(point,view,width,height);if(s.x<24||s.y<24||s.x>width-24||s.y>height-24){view={...view,x:(400-point.x)*view.zoom,y:(260-point.y)*view.zoom};commit();}}schedule();}};
    el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',cancel);el.addEventListener('lostpointercapture',cancel);el.addEventListener('pointerleave',leave);el.addEventListener('wheel',wheel,{passive:false});el.addEventListener('keydown',key);el.addEventListener('gesturestart',gestureStart,{passive:false});el.addEventListener('gesturechange',gestureChange,{passive:false});el.addEventListener('gestureend',gestureEnd);reduced.addEventListener('change',schedule);resize();
    return()=>{if(drag||wheelTimer||nativeGesture)commit();disposed=true;cancelAnimationFrame(frame);clearTimeout(wheelTimer);observer.disconnect();themeObserver.disconnect();engine.current=undefined;el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',cancel);el.removeEventListener('lostpointercapture',cancel);el.removeEventListener('pointerleave',leave);el.removeEventListener('wheel',wheel);el.removeEventListener('keydown',key);el.removeEventListener('gesturestart',gestureStart);el.removeEventListener('gesturechange',gestureChange);el.removeEventListener('gestureend',gestureEnd);reduced.removeEventListener('change',schedule);};
  },[]);
  useEffect(()=>{engine.current?.target(props.camera);engine.current?.redraw();},[props.camera.x,props.camera.y,props.camera.zoom,props.nodes,props.positions,props.model,props.selected,props.focused]);
  return <><canvas ref={canvas} className="knowledge-canvas" tabIndex={0} aria-label="Knowledge graph. Drag or two-finger scroll to pan. Pinch or Control plus scroll to zoom. Arrow keys pan; plus and minus zoom."/><div className="knowledge-node-accessibility">{props.nodes.map(node=><button key={node.ref} data-knowledge-ref={node.ref} aria-pressed={node.ref===props.selected} onFocus={()=>engine.current?.focus(node.ref)} onClick={()=>props.onOpen(node)}>Open {node.label}</button>)}</div></>;
});
