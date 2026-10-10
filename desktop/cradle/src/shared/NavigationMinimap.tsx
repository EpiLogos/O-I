import {useEffect,useRef,type MutableRefObject} from 'react';
import {projectNavigationMinimap,navigationMinimapPoint,navigationViewport,navigationCameraAt,type NavigationCamera,type NavigationExtent,type NavigationPoint,type NavigationProjection} from './navigationMinimapGeometry';
import './NavigationMinimap.css';
export interface NavigationMinimapController {draw:(camera:NavigationCamera)=>void}
export function NavigationMinimap(props:{label:string;points:readonly NavigationPoint[];edges:readonly {from:string;to:string}[];camera:NavigationCamera;
 extent:NavigationExtent;origin:{x:number;y:number};screenOrigin:{x:number;y:number};onCamera:(camera:NavigationCamera)=>void;
 controller?:MutableRefObject<NavigationMinimapController|null>}){
 const element=useRef<HTMLCanvasElement>(null),current=useRef(props);current.current=props;
 const api=useRef<NavigationMinimapController|null>(null);
 useEffect(()=>{
  const canvas=element.current;if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const overview=document.createElement('canvas'),ink=overview.getContext('2d');if(!ink)return;
  let width=160,height=104,ratio=1,cache:{points:typeof props.points;edges:typeof props.edges;theme:string}|null=null,held=false,projection:NavigationProjection|null=null,liveCamera=current.current.camera;
  const style=getComputedStyle(canvas),colour=(name:string)=>style.getPropertyValue(name).trim()||style.getPropertyValue(name==='--oi-relation'?'--line':name==='--oi-foreground'?'--ink':'--accent').trim();
  function draw(camera:NavigationCamera){
   const p=current.current;liveCamera=camera;if(cache?.points!==p.points)projection=projectNavigationMinimap(p.points,{width,height});
   ctx!.setTransform(ratio,0,0,ratio,0,0);ctx!.clearRect(0,0,width,height);const projected=projection;if(!projected)return;
   const theme=[colour('--oi-relation'),colour('--oi-foreground'),colour('--oi-focus')].join('|');
   if(cache?.points!==p.points||cache?.edges!==p.edges||cache?.theme!==theme){
    overview.width=canvas!.width;overview.height=canvas!.height;ink!.setTransform(ratio,0,0,ratio,0,0);ink!.clearRect(0,0,width,height);
    const points=new Map(p.points.filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)).map(point=>[point.id,{point,at:navigationMinimapPoint(point,projected)}]));
    ink!.beginPath();for(const edge of p.edges){const from=points.get(edge.from),to=points.get(edge.to);if(!from||!to)continue;ink!.moveTo(from.at.x,from.at.y);ink!.lineTo(to.at.x,to.at.y);}ink!.strokeStyle=colour('--oi-relation');ink!.globalAlpha=.35;ink!.lineWidth=.5;ink!.stroke();
    ink!.globalAlpha=.8;ink!.fillStyle=colour('--oi-foreground');ink!.strokeStyle=colour('--oi-foreground');
    for(const {point,at} of points.values()){if(point.width&&point.height){const w=Math.max(.8,point.width*projected.scale),h=Math.max(.8,point.height*projected.scale);ink!.fillRect(at.x-w/2,at.y-h/2,w,h);}else{ink!.beginPath();ink!.arc(at.x,at.y,1.3,0,Math.PI*2);if(point.hollow)ink!.stroke();else ink!.fill();}}
    cache={points:p.points,edges:p.edges,theme};
   }
   ctx!.drawImage(overview,0,0,width,height);
   const viewport=navigationViewport(camera,p.extent,p.origin,p.screenOrigin),corner=navigationMinimapPoint({x:viewport.left,y:viewport.top},projected);
   ctx!.fillStyle=colour('--oi-focus');ctx!.strokeStyle=colour('--oi-focus');ctx!.globalAlpha=.09;ctx!.fillRect(corner.x,corner.y,viewport.width*projected.scale,viewport.height*projected.scale);ctx!.globalAlpha=.75;ctx!.lineWidth=1;ctx!.strokeRect(corner.x,corner.y,viewport.width*projected.scale,viewport.height*projected.scale);ctx!.globalAlpha=1;
  }
  const jump=(event:PointerEvent)=>{
   const p=current.current,bounds=canvas.getBoundingClientRect();if(cache?.points!==p.points)projection=projectNavigationMinimap(p.points,{width,height});if(!projection||!bounds.width||!bounds.height)return;
   const camera=navigationCameraAt({x:(event.clientX-bounds.left)*width/bounds.width,y:(event.clientY-bounds.top)*height/bounds.height},projection,liveCamera,p.extent,p.origin,p.screenOrigin);
   p.onCamera(camera);draw(camera);
  };
  const down=(event:PointerEvent)=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();held=true;canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});jump(event);};
  const move=(event:PointerEvent)=>{if(held&&canvas.hasPointerCapture(event.pointerId))jump(event);};
  const end=(event:PointerEvent)=>{held=false;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);};
  const key=(event:KeyboardEvent)=>{const delta={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]}[event.key];if(!delta)return;event.preventDefault();event.stopPropagation();const p=current.current,factor=event.shiftKey?4:1,camera={...liveCamera,x:liveCamera.x+delta[0]*factor,y:liveCamera.y+delta[1]*factor};p.onCamera(camera);draw(camera);};
  const resize=()=>{const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);ratio=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);cache=null;projection=projectNavigationMinimap(current.current.points,{width,height});draw(liveCamera);};
  api.current={draw};if(props.controller)props.controller.current=api.current;
  const observer=new ResizeObserver(resize);observer.observe(canvas);const themeObserver=new MutationObserver(()=>draw(liveCamera));themeObserver.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:['class','data-theme']});canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);canvas.addEventListener('keydown',key);resize();
  return()=>{observer.disconnect();themeObserver.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',end);canvas.removeEventListener('pointercancel',end);canvas.removeEventListener('lostpointercapture',end);canvas.removeEventListener('keydown',key);if(props.controller?.current===api.current)props.controller.current=null;api.current=null;};
 },[]);
 useEffect(()=>{api.current?.draw(props.camera);},[props.points,props.edges,props.camera,props.extent,props.origin,props.screenOrigin]);
 return <canvas ref={element} className="navigation-minimap" tabIndex={0} aria-label={`${props.label}. Click or drag to travel. Arrow keys pan; Shift pans farther.`}/>;
}
