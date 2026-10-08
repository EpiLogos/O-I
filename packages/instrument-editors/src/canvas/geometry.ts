/** Canvas-space geometry. Presentation only; positions return through the native owner. */
export interface Point {x:number;y:number}
export interface Box extends Point {width:number;height:number}
export interface PositionedNode {id:string;position:Point;size:{width:number;height:number}}
export interface Guide {axis:'x'|'y';value:number;start:number;end:number}
export function bounds(nodes:readonly PositionedNode[]):Box {
 if(!nodes.length)return {x:-120,y:-80,width:240,height:160};
 const x=Math.min(...nodes.map(n=>n.position.x)),y=Math.min(...nodes.map(n=>n.position.y));
 return {x,y,width:Math.max(1,Math.max(...nodes.map(n=>n.position.x+n.size.width))-x),height:Math.max(1,Math.max(...nodes.map(n=>n.position.y+n.size.height))-y)};
}
export function fitBox(box:Box,width:number,height:number,padding=24):Box {
 const aspect=Math.max(1,width)/Math.max(1,height),w=box.width+padding*2,h=box.height+padding*2;
 const fittedWidth=Math.max(w,h*aspect),fittedHeight=fittedWidth/aspect;
 return {x:box.x+(box.width-fittedWidth)/2,y:box.y+(box.height-fittedHeight)/2,width:fittedWidth,height:fittedHeight};
}
export function zoomBox(box:Box,factor:number,anchor:Point={x:box.x+box.width/2,y:box.y+box.height/2}):Box {
 const width=Math.max(8,Math.min(1e7,box.width/factor)),height=width*box.height/box.width;
 return {x:anchor.x-(anchor.x-box.x)*width/box.width,y:anchor.y-(anchor.y-box.y)*height/box.height,width,height};
}
/** Screen threshold stays eight pixels at every zoom; selected peers do not snap to each other. */
export function snapPosition(node:PositionedNode,position:Point,peers:readonly PositionedNode[],unitsPerPixel:number,grid=false):{position:Point;guides:Guide[]} {
 const next={...position},guides:Guide[]=[];
 const tolerance=8*Math.max(.0001,unitsPerPixel);
 for(const axis of ['x','y'] as const){
  const size=axis==='x'?node.size.width:node.size.height,other=axis==='x'?'y':'x';
  let best:{delta:number;value:number;peer:PositionedNode}|undefined;
  for(const peer of peers){if(peer.id===node.id)continue;const peerSize=axis==='x'?peer.size.width:peer.size.height;
   for(const ownOffset of [0,size/2,size])for(const peerOffset of [0,peerSize/2,peerSize]){
    const value=peer.position[axis]+peerOffset,delta=value-position[axis]-ownOffset;
    if(Math.abs(delta)<=tolerance&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={delta,value,peer};
   }
  }
  if(best){next[axis]+=best.delta;guides.push({axis,value:best.value,start:Math.min(position[other],best.peer.position[other])-12,end:Math.max(position[other]+(other==='x'?node.size.width:node.size.height),best.peer.position[other]+(other==='x'?best.peer.size.width:best.peer.size.height))+12});}
  else if(grid)next[axis]=Math.round(next[axis]/20)*20;
 }
 return {position:next,guides};
}
