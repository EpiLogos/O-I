import {memo,useEffect,useMemo,useRef,useState} from 'react';
import type {GraphNode,GraphReading} from './graph';
import type {Point} from './layout';
import {screenPoint,segmentVisible,zoomAt,type Camera} from './camera';
import {graphDragPosition,isUnresolvedGraphNode,unresolvedGraphAssociations} from './graphNavigation';
import {graphScreenEdges,hitGraphScreenEdge,emphasizedGraphRelations,admitGraphLabel,type GraphScreenEdge} from './graphRelationPresentation';
import {NavigationMinimap,type NavigationMinimapController} from '../shared/NavigationMinimap.tsx';
import {captureGraphContext,resolveGraphContext,type GraphContextSource} from './graphContext';
import './graphContext.css';
interface Props {unresolvedAssociations?:ReturnType<typeof unresolvedGraphAssociations>;emphasis?:ReadonlyMap<string,{label:string;color:string}>;nodes:GraphNode[];positions:Point[];model?:GraphReading;camera:Camera;selected?:string;focused:Set<string>;contextual?:Set<string>;labels?:'automatic'|'all'|'focus';arrows?:boolean;minZoom:number;maxZoom:number;onCamera:(camera:Camera)=>void;onDragNode?:(ref:string|null,world?:{x:number;y:number})=>void;onSelect?:(node:GraphNode)=>void;onOpen:(node:GraphNode)=>void;onTechne?:(node:GraphNode)=>void;onClear:()=>void}
/** One demand-driven drawing loop. Pointer/wheel updates never render React
 * or persist state per frame; dragging a subject asks the live layout world
 * to move it (the neighbourhood answers), dragging the ground pans. A press
 * picks a subject (its neighbourhood stays emphasised); only a double-click
 * opens it. The
 * accessibility subjects keep exact refs. */
export const GraphCanvas=memo(function GraphCanvas(props:Props) {
  const [accessPage,setAccessPage]=useState(0);
  const [minimap,setMinimap]=useState(true),[extent,setExtent]=useState({width:800,height:520});
  const [context,setContext]=useState<{basis:GraphContextSource;x:number;y:number}>();
  const mini=useRef<NavigationMinimapController|null>(null),contextMenu=useRef<HTMLDivElement>(null);
  const miniPoints=useMemo(()=>props.nodes.flatMap((node,index)=>{const point=props.positions[index];return point?[{id:node.ref,x:point.x,y:point.y,hollow:isUnresolvedGraphNode(node)}]:[];}),[props.nodes,props.positions]);
  const miniEdges=useMemo(()=>(props.model?.edges??[]).map(edge=>({from:edge.from_ref,to:edge.to_ref})),[props.model?.edges]);
  const canvas=useRef<HTMLCanvasElement>(null),current=useRef(props);current.current=props;
  const associations=useMemo(()=>props.unresolvedAssociations??unresolvedGraphAssociations(props.nodes),[props.nodes,props.unresolvedAssociations]);
  const currentAssociations=useRef(associations);currentAssociations.current=associations;
  const engine=useRef<{target:(camera:Camera)=>void;redraw:()=>void;focus:(ref:string)=>void}>();
  useEffect(()=>{
    const el=canvas.current;if(!el)return;const ctx=el.getContext('2d',{alpha:true});if(!ctx)return;
    let width=0,height=0,ratio=1,frame=0,drag:{x:number;y:number;camera:Camera;node?:GraphNode;moved:boolean;mode:'camera'|'node';nodeWorld?:{x:number;y:number}}|undefined;
    let hover:string|undefined,hoverNeighbours=new Set<string>(),picked:string|undefined,lastTap:{ref:string;at:number}|undefined,hoveredEdge:number|undefined;
    let view={...current.current.camera},travel:{from:Camera;to:Camera;start:number}|undefined,wheelTimer:ReturnType<typeof setTimeout>|undefined;
    let gestureScale=1,nativeGesture=false,disposed=false;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const style=getComputedStyle(el);
    const value=(name:string)=>style.getPropertyValue(name).trim();
    const num=(name:string)=>{const raw=value(name);if(raw.endsWith('ms'))return parseFloat(raw);if(raw.endsWith('s'))return parseFloat(raw)*1000;const measure=document.createElement('span');measure.style.cssText=`position:absolute;visibility:hidden;pointer-events:none;width:${raw};height:0`;el.parentElement!.append(measure);const pixels=measure.getBoundingClientRect().width;measure.remove();return pixels||parseFloat(raw)||1;};
    let ink=value('--oi-foreground'),muted=value('--oi-muted'),edge=value('--oi-relation'),accent=value('--oi-focus'),ground=value('--oi-canvas-ground');
    const core=num('--oi-desktop-gap-xs'),spaceCore=num('--oi-desktop-gap-sm'),hit=num('--oi-desktop-gap'),halo=num('--oi-space-3'),line=num('--oi-graph-edge-width');
    const font=num('--oi-shell-type-ui'),fontFamily=value('--oi-font-sans'),dot=num('--oi-graph-point-min-radius');
    const duration=reduced.matches?0:num('--oi-motion-normal');
    let screen:{node:GraphNode;p:Point;x:number;y:number;r:number}[]=[],lookup=new Map<string,{x:number;y:number}>();
    let relationScreens:GraphScreenEdge[]=[];
    const drawTimes:number[]=[];
    const report=()=>{if(!(import.meta as unknown as {env?:{DEV?:boolean}}).env?.DEV||!drawTimes.length)return;const times=drawTimes.splice(0).sort((a,b)=>a-b);console.info('C4 canvas draw',JSON.stringify({frames:times.length,p95DrawMs:times[Math.floor(times.length*.95)],maxDrawMs:times[times.length-1],visibleNodes:screen.length,totalNodes:current.current.nodes.length}));};
    const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(draw);};
    const commit=()=>{current.current.onCamera({...view});report();};
    const setHover=(ref:string|undefined)=>{hover=ref;hoverNeighbours=new Set<string>();if(ref){hoverNeighbours.add(ref);for(const relation of current.current.model?.edges??[])if(relation.from_ref===ref||relation.to_ref===ref){hoverNeighbours.add(relation.from_ref);hoverNeighbours.add(relation.to_ref);}for(const link of currentAssociations.current)if(link.source===ref||link.ghost===ref){hoverNeighbours.add(link.source);hoverNeighbours.add(link.ghost);}}};
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
      relationScreens=graphScreenEdges(p.model?.edges??[],lookup).filter(item=>segmentVisible(item.from,item.to,width,height));
      // Batch paths by focus state, retaining every admitted segment; missing
      // endpoints are represented by the related-subject UI, never invented.
      // A selection owns the focus set; over an unselected field the hover
      // does (its immediate relations stand out, unrelated material recedes).
      const focusedSet=p.selected?p.focused:(hover?hoverNeighbours:null),hasFocus=Boolean(p.selected)||Boolean(hover);
      for(const receded of [true,false]){ctx!.beginPath();for(const relation of p.model?.edges??[]){const strong=focusedSet!==null&&focusedSet.has(relation.from_ref)&&focusedSet.has(relation.to_ref);if(hasFocus&&strong===receded)continue;if(!hasFocus&&receded)continue;const a=lookup.get(relation.from_ref),b=lookup.get(relation.to_ref);if(a&&b&&segmentVisible(a,b,width,height)){ctx!.moveTo(a.x,a.y);ctx!.lineTo(b.x,b.y);}}ctx!.strokeStyle=edge;ctx!.lineWidth=line;ctx!.globalAlpha=receded?.12:.55;ctx!.stroke();}
      // Unresolved associations are drawn separately from native assertions.
      ctx!.setLineDash([line*4,line*3]);
      for(const receded of [true,false]){ctx!.beginPath();for(const link of currentAssociations.current){const strong=focusedSet!==null&&focusedSet.has(link.source)&&focusedSet.has(link.ghost);if(hasFocus&&strong===receded)continue;if(!hasFocus&&receded)continue;const a=lookup.get(link.source),b=lookup.get(link.ghost);if(a&&b&&segmentVisible(a,b,width,height)){ctx!.moveTo(a.x,a.y);ctx!.lineTo(b.x,b.y);}}ctx!.strokeStyle=muted;ctx!.lineWidth=line;ctx!.globalAlpha=receded?.12:.5;ctx!.stroke();}
      ctx!.setLineDash([]);
      if(p.arrows){ctx!.fillStyle=edge;ctx!.globalAlpha=.55;for(const relation of p.model?.edges??[]){const a=lookup.get(relation.from_ref),b=lookup.get(relation.to_ref);if(!a||!b||!segmentVisible(a,b,width,height))continue;const d=Math.hypot(b.x-a.x,b.y-a.y);if(d<16)continue;const ux=(b.x-a.x)/d,uy=(b.y-a.y)/d,x=b.x-ux*8,y=b.y-uy*8;ctx!.beginPath();ctx!.moveTo(x,y);ctx!.lineTo(x-ux*5-uy*3,y-uy*5+ux*3);ctx!.lineTo(x-ux*5+uy*3,y-uy*5-ux*3);ctx!.closePath();ctx!.fill();}}
      if(hover){ctx!.fillStyle=accent;ctx!.globalAlpha=.65;for(const relation of p.model?.edges??[]){if(relation.from_ref!==hover&&relation.to_ref!==hover)continue;const a=lookup.get(relation.from_ref),b=lookup.get(relation.to_ref);if(!a||!b||!segmentVisible(a,b,width,height))continue;const t=reduced.matches?.5:(time/Math.max(1,duration*16))%1;ctx!.beginPath();ctx!.arc(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,dot,0,Math.PI*2);ctx!.fill();}}
      const labelBoxes:{x:number;y:number;w:number;h:number}[]=[];
      screen.sort((a,b)=>Number(a.node.ref===p.selected||a.node.ref===hover)-Number(b.node.ref===p.selected||b.node.ref===hover));
      for(const item of screen){const {node,x,y,r}=item,selected=node.ref===p.selected,active=selected||node.ref===hover,receded=(Boolean(p.selected)&&!p.focused.has(node.ref))||Boolean(p.contextual?.has(node.ref))||((Boolean(hover)&&!p.selected)&&!hoverNeighbours.has(node.ref));
        ctx!.globalAlpha=receded?.28:.72;
        if(active){ctx!.beginPath();ctx!.arc(x,y,r+hit*.55,0,Math.PI*2);ctx!.fillStyle=ground;ctx!.fill();ctx!.strokeStyle=accent;ctx!.lineWidth=line;ctx!.stroke();}
        else if(!receded){ctx!.beginPath();ctx!.arc(x,y,r,0,Math.PI*2);ctx!.strokeStyle=edge;ctx!.lineWidth=line*.5;ctx!.globalAlpha=.2;ctx!.stroke();}
        ctx!.beginPath();ctx!.arc(x,y,r,0,Math.PI*2);
        if(isUnresolvedGraphNode(node)){ctx!.strokeStyle=active?accent:muted;ctx!.lineWidth=line;ctx!.setLineDash([line*3,line*2]);ctx!.stroke();ctx!.setLineDash([]);}
        else{ctx!.fillStyle=selected?accent:(p.emphasis?.get(node.ref)?.color??ink);ctx!.fill();}
        if(active||(p.labels!=='focus'&&!receded&&(p.labels==='all'||(node.kind==='wiki-space'&&view.zoom>.3)||view.zoom>1.1))){
          ctx!.font=`${font}px ${fontFamily}`;const w=ctx!.measureText(node.label).width,box={x:x-w/2,y:y+r+hit*.65,w,h:font*1.5};
          if(active||!labelBoxes.some(b=>b.x<box.x+box.w&&b.x+b.w>box.x&&b.y<box.y+box.h&&b.y+b.h>box.y)){labelBoxes.push(box);ctx!.globalAlpha=active?1:.8;ctx!.fillStyle=active?ink:muted;ctx!.textAlign='center';ctx!.lineJoin='round';ctx!.strokeStyle=ground;ctx!.lineWidth=3;ctx!.strokeText(node.label,x,box.y+font);ctx!.fillText(node.label,x,box.y+font);}
        }
      }
      for(const item of emphasizedGraphRelations(relationScreens,{selected:p.selected,hovered:hover,hoveredEdge,focused:p.focused})){
        const x=(item.from.x+item.to.x)/2,y=(item.from.y+item.to.y)/2;
        ctx!.font=`${font}px ${fontFamily}`;const text=item.edge.relation,w=ctx!.measureText(text).width,box={x:x-w/2-hit*.25,y:y-font*.75,w:w+hit*.5,h:font*1.5};
        if(x<0||y<0||x>width||y>height||!admitGraphLabel(box,labelBoxes))continue;
        labelBoxes.push(box);ctx!.globalAlpha=.86;ctx!.fillStyle=ground;ctx!.fillRect(box.x,box.y,box.w,box.h);ctx!.fillStyle=muted;ctx!.textAlign='center';ctx!.fillText(text,x,y+font*.35);
      }
      mini.current?.draw(view);
      ctx!.globalAlpha=1;drawTimes.push(performance.now()-started);if(drawTimes.length>600)drawTimes.shift();
      if(travel||(hover&&!reduced.matches))schedule();
    }
    const pointer=(e:{clientX:number;clientY:number})=>{const bounds=el.getBoundingClientRect();return {x:e.clientX-bounds.left,y:e.clientY-bounds.top};};
    const hitNode=(x:number,y:number)=>{let best:GraphNode|undefined,distance=Infinity;for(const item of screen){const d=Math.hypot(x-item.x,y-item.y);if(d<=Math.max(hit*.65,item.r+3)&&d<distance){best=item.node;distance=d;}}return best;};
    const down=(e:PointerEvent)=>{if(e.button!==0&&e.button!==1)return;e.preventDefault();setContext(undefined);hoveredEdge=undefined;const p=pointer(e);settle();const node=hitNode(p.x,p.y);const at=node?current.current.positions[current.current.nodes.findIndex(n=>n.ref===node.ref)]:undefined;drag={x:p.x,y:p.y,camera:{...view},node,moved:false,mode:node&&at?'node':'camera',nodeWorld:at?{x:at.x,y:at.y}:undefined};if(node){picked=node.ref;setHover(picked);schedule();}el.setPointerCapture(e.pointerId);el.focus({preventScroll:true});};
    const move=(e:PointerEvent)=>{const p=pointer(e);if(drag){const x=p.x-drag.x,y=p.y-drag.y;if(Math.hypot(x,y)>3)drag.moved=true;if(drag.moved){hover=undefined;el.style.cursor='grabbing';
        if(drag.mode==='node'&&drag.nodeWorld&&drag.node){const world=graphDragPosition(drag.nodeWorld,{x,y},drag.camera.zoom);current.current.onDragNode?.(drag.node.ref,world);}
        else view={...drag.camera,x:drag.camera.x+x,y:drag.camera.y+y};
        schedule();}}
      else{const under=hitNode(p.x,p.y)?.ref,next=under??picked,edge=under?undefined:hitGraphScreenEdge(relationScreens,p,Math.max(4,hit*.35))?.index;if(next!==hover||edge!==hoveredEdge){hoveredEdge=edge;setHover(next);schedule();}el.style.cursor=under?'pointer':'grab';}};
    const up=(e:PointerEvent)=>{const gesture=drag;drag=undefined;if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);el.style.cursor=hover?'pointer':'grab';
      if(picked&&hover!==picked){setHover(picked);schedule();}
      if(gesture?.mode==='node'){current.current.onDragNode?.(null);if(!gesture.moved&&gesture.node&&!isUnresolvedGraphNode(gesture.node)){const now=performance.now();if(lastTap?.ref===gesture.node.ref&&now-lastTap.at<400){lastTap=undefined;current.current.onOpen(gesture.node);}else {lastTap={ref:gesture.node.ref,at:now};current.current.onSelect?.(gesture.node);}}}
      else if(gesture&&!gesture.moved){lastTap=undefined;picked=undefined;setHover(undefined);schedule();current.current.onClear();}
      else if(gesture)commit();};
    const cancel=()=>{if(drag){const mode=drag.mode;drag=undefined;if(mode==='node')current.current.onDragNode?.(null);else commit();}el.style.cursor='grab';};
    const leave=()=>{if(!drag){hoveredEdge=undefined;setHover(picked);schedule();}};
    const menu=(e:MouseEvent)=>{const p=pointer(e),node=hitNode(p.x,p.y);if(!node||isUnresolvedGraphNode(node))return;e.preventDefault();settle();setContext({basis:captureGraphContext(node),x:Math.max(4,Math.min(width-190,p.x)),y:Math.max(4,Math.min(height-180,p.y))});};
    const wheel=(e:WheelEvent)=>{e.preventDefault();if(nativeGesture)return;settle();setHover(undefined);const point=pointer(e),unit=e.deltaMode===1?font:e.deltaMode===2?height:1;const dx=e.deltaX*unit,dy=e.deltaY*unit;
      if(e.ctrlKey||e.metaKey||e.deltaMode!==0)view=zoomAt(view,Math.exp(-dy*.008),point.x-width/2,point.y-height/2,current.current.minZoom,current.current.maxZoom);
      else view={...view,x:view.x-dx,y:view.y-dy};
      schedule();clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>{wheelTimer=undefined;commit();},120);};
    const gestureStart=(e:Event)=>{e.preventDefault();settle();nativeGesture=true;gestureScale=1;};
    const gestureChange=(e:Event)=>{e.preventDefault();const g=e as Event&{scale:number;clientX:number;clientY:number};if(!Number.isFinite(g.scale)||g.scale<=0)return;const point=pointer(g);view=zoomAt(view,g.scale/gestureScale,point.x-width/2,point.y-height/2,current.current.minZoom,current.current.maxZoom);gestureScale=g.scale;schedule();};
    const gestureEnd=()=>{nativeGesture=false;commit();};
    const key=(e:KeyboardEvent)=>{if(e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey){const node=current.current.nodes.find(node=>node.ref===current.current.selected&&!isUnresolvedGraphNode(node));if(node){e.preventDefault();setContext({basis:captureGraphContext(node),x:Math.max(4,width/2-95),y:Math.max(4,height/2-75)});}return;}if(e.key==='Enter'){const node=current.current.nodes.find(node=>node.ref===current.current.selected&&!isUnresolvedGraphNode(node));if(node){e.preventDefault();current.current.onOpen(node);}return;}if(e.key==='Escape'){e.preventDefault();setContext(undefined);picked=undefined;lastTap=undefined;hoveredEdge=undefined;setHover(undefined);schedule();current.current.onClear();return;}if(e.altKey||e.metaKey||e.ctrlKey)return;const pan={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]}[e.key];if(pan){e.preventDefault();settle();view={...view,x:view.x+pan[0],y:view.y+pan[1]};schedule();commit();}else if(['+','=','-'].includes(e.key)){e.preventDefault();settle();view=zoomAt(view,e.key==='-'?1/1.2:1.2,0,0,current.current.minZoom,current.current.maxZoom);schedule();commit();}};
    const resize=()=>{const r=el.getBoundingClientRect();width=r.width;height=r.height;setExtent({width,height});ratio=Math.min(2,devicePixelRatio||1);el.width=Math.max(1,Math.round(width*ratio));el.height=Math.max(1,Math.round(height*ratio));schedule();};
    const observer=new ResizeObserver(resize);observer.observe(el);const themeObserver=new MutationObserver(schedule);themeObserver.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:['class','data-theme']});
    engine.current={target(camera){if(Math.abs(view.x-camera.x)+Math.abs(view.y-camera.y)+Math.abs(view.zoom-camera.zoom)<.0001)return;travel={from:{...view},to:camera,start:performance.now()};schedule();},redraw:schedule,focus(ref){setHover(ref);const i=current.current.nodes.findIndex(n=>n.ref===ref),point=current.current.positions[i];if(point){const s=screenPoint(point,view,width,height);if(s.x<24||s.y<24||s.x>width-24||s.y>height-24){view={...view,x:(400-point.x)*view.zoom,y:(260-point.y)*view.zoom};commit();}}schedule();}};
    el.addEventListener('contextmenu',menu);el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',cancel);el.addEventListener('lostpointercapture',cancel);el.addEventListener('pointerleave',leave);el.addEventListener('wheel',wheel,{passive:false});el.addEventListener('keydown',key);el.addEventListener('gesturestart',gestureStart,{passive:false});el.addEventListener('gesturechange',gestureChange,{passive:false});el.addEventListener('gestureend',gestureEnd);reduced.addEventListener('change',schedule);resize();
    return()=>{if(drag){if(drag.mode==='node')current.current.onDragNode?.(null);drag=undefined;}if(wheelTimer||nativeGesture)commit();disposed=true;cancelAnimationFrame(frame);clearTimeout(wheelTimer);observer.disconnect();themeObserver.disconnect();engine.current=undefined;el.removeEventListener('contextmenu',menu);el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',cancel);el.removeEventListener('lostpointercapture',cancel);el.removeEventListener('pointerleave',leave);el.removeEventListener('wheel',wheel);el.removeEventListener('keydown',key);el.removeEventListener('gesturestart',gestureStart);el.removeEventListener('gesturechange',gestureChange);el.removeEventListener('gestureend',gestureEnd);reduced.removeEventListener('change',schedule);};
  },[]);
  useEffect(()=>{engine.current?.target(props.camera);engine.current?.redraw();},[props.camera.x,props.camera.y,props.camera.zoom,props.nodes,props.positions,props.model,props.selected,props.focused,props.contextual,props.labels,props.arrows,props.emphasis,props.unresolvedAssociations]);
  const contextNode=context?resolveGraphContext(context.basis,props.nodes):undefined;
  useEffect(()=>{
    if(!context)return;
    if(!resolveGraphContext(context.basis,current.current.nodes)){setContext(undefined);return;}
    contextMenu.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
    const outside=(event:PointerEvent)=>{if(!contextMenu.current?.contains(event.target as Node))setContext(undefined);};
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setContext(undefined);canvas.current?.focus({preventScroll:true});return;}
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      const buttons=Array.from(contextMenu.current?.querySelectorAll<HTMLButtonElement>('button')??[]);if(!buttons.length)return;
      event.preventDefault();const i=buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();
    };
    document.addEventListener('pointerdown',outside);contextMenu.current?.addEventListener('keydown',key);const menu=contextMenu.current;
    return()=>{document.removeEventListener('pointerdown',outside);menu?.removeEventListener('keydown',key);};
  },[context,props.nodes]);
  const contextAct=(act:(node:GraphNode)=>void)=>{if(context){const node=resolveGraphContext(context.basis,current.current.nodes);if(node&&!isUnresolvedGraphNode(node))act(node);}setContext(undefined);canvas.current?.focus({preventScroll:true});};
  // Keep every subject addressable while bounding hidden accessibility DOM.
  const lastPage=Math.max(0,Math.ceil(props.nodes.length/100)-1),page=Math.min(accessPage,lastPage);
  return <>{minimap&&miniPoints.length>0&&<NavigationMinimap label="Graph overview" points={miniPoints} edges={miniEdges} camera={props.camera} extent={extent} origin={{x:400,y:260}} screenOrigin={{x:extent.width/2,y:extent.height/2}} onCamera={props.onCamera} controller={mini}/>}
    <button className="graph-minimap-toggle" aria-pressed={minimap} onClick={()=>setMinimap(value=>!value)}>{minimap?'Hide overview':'Show overview'}</button>
    {context&&contextNode&&<div ref={contextMenu} className="graph-context-menu" role="menu" aria-label={`Actions for ${contextNode.label}`} style={{left:context.x,top:context.y}}>
      <button role="menuitem" onClick={()=>contextAct(node=>current.current.onSelect?.(node))}>Select {contextNode.label}</button>
      <button role="menuitem" onClick={()=>contextAct(node=>current.current.onOpen(node))}>Open source</button>
      <button role="menuitem" onClick={()=>contextAct(node=>{const p=current.current,index=p.nodes.findIndex(row=>row.ref===node.ref),point=p.positions[index];if(point)p.onCamera({...p.camera,x:(400-point.x)*p.camera.zoom,y:(260-point.y)*p.camera.zoom});})}>Centre in graph</button>
      {props.onTechne&&contextNode.native_owner!=='shared-field'&&<button role="menuitem" onClick={()=>contextAct(node=>current.current.onTechne?.(node))}>Open in Technè</button>}
    </div>}
    <canvas ref={canvas} className="knowledge-canvas" tabIndex={0} aria-label="Knowledge graph. Hollow dashed markers are unresolved links with no source to open. Drag a subject to move it and let its neighbourhood respond; click to pick it and double-click to open it; drag the background or two-finger scroll to pan. Pinch or Control plus scroll to zoom. Arrow keys pan; plus and minus zoom."/><div className="knowledge-node-accessibility">{props.nodes.length>100&&<div role="group" aria-label="Graph subject pages"><button disabled={page===0} onClick={()=>setAccessPage(page-1)}>Previous subjects</button><span>Subjects {page*100+1}–{Math.min(props.nodes.length,(page+1)*100)} of {props.nodes.length}</span><button disabled={page===lastPage} onClick={()=>setAccessPage(page+1)}>Next subjects</button></div>}{props.nodes.slice(page*100,(page+1)*100).map(node=>isUnresolvedGraphNode(node)?<button key={node.ref} data-unresolved-link={node.unresolved.key} aria-label={`Unresolved link ${node.label}; ${Object.keys(node.unresolved.sources).length} disclosed sources; no resolved source to open`} onFocus={()=>engine.current?.focus(node.ref)} onClick={()=>engine.current?.focus(node.ref)}>Unresolved link: {node.label}</button>:<button key={node.ref} data-knowledge-ref={node.ref} aria-label={props.emphasis?.has(node.ref)?`Open ${node.label} · emphasis ${props.emphasis.get(node.ref)!.label}`:undefined} aria-pressed={node.ref===props.selected} onFocus={()=>engine.current?.focus(node.ref)} onClick={()=>props.onOpen(node)}>Open {node.label}</button>)}</div></>;
});
