import {useEffect,useMemo,useRef,useState,type MutableRefObject} from 'react';
import {NavigationMinimap,type NavigationMinimapController} from '../../../src/shared/NavigationMinimap';
import type {NavigationCamera} from '../../../src/shared/navigationMinimapGeometry';
import type {CanvasNode,CanvasEdge} from '@research-canvas/schema';
/** One overview implementation, with the Canvas's actual viewport feed.
 * Source rows and viewport state remain in their existing native controller. */
export function CanvasNavigationOverview({nodes,edges,capture,controller,onCamera}:{
 nodes:readonly CanvasNode[];edges:readonly CanvasEdge[];capture:()=>NavigationCamera|null;
 controller:MutableRefObject<NavigationMinimapController|null>;onCamera:(camera:NavigationCamera)=>void;
}){
 const home=useRef<HTMLSpanElement>(null),[extent,setExtent]=useState({width:0,height:0}),[camera,setCamera]=useState<NavigationCamera|null>(null),[shown,setShown]=useState(true);
 const points=useMemo(()=>nodes.map(node=>({id:node.id,x:node.position.x+node.size.width/2,y:node.position.y+node.size.height/2,width:node.size.width,height:node.size.height})),[nodes]);
 const relations=useMemo(()=>edges.map(edge=>({from:edge.sourceNodeId,to:edge.targetNodeId})),[edges]);
 const latest=useRef(capture);latest.current=capture;
 useEffect(()=>{
  const parent=home.current?.parentElement;if(!parent)return;
  const resize=()=>{const rect=parent.getBoundingClientRect();setExtent({width:rect.width,height:rect.height});const current=latest.current();if(current)setCamera({...current});};
  const observer=new ResizeObserver(resize);observer.observe(parent);resize();return()=>observer.disconnect();
 },[]);
 useEffect(()=>{if(shown){const current=capture();if(current)setCamera({...current});}},[shown,nodes,edges]);
 return <><span ref={home} aria-hidden="true"/>{shown&&camera&&extent.width>0&&extent.height>0&&<NavigationMinimap label="Canvas overview" points={points} edges={relations} camera={camera} extent={extent} origin={{x:0,y:0}} screenOrigin={{x:0,y:0}} onCamera={onCamera} controller={controller}/>}<button className="research-minimap-toggle" aria-pressed={shown} onClick={()=>setShown(value=>!value)}>{shown?'Hide overview':'Show overview'}</button></>;
}
