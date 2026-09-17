import type {GraphReading} from "./graph";
export interface Point {x:number;y:number;z?:number;scale?:number}
function seed(ref:string) {let h=2166136261;for(const c of ref)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296;}
/** A stable world, not a layout squeezed into each viewport. Depth is a
 * disposable visual coordinate; it never asserts importance or a relation. */
export function constellation(reading:GraphReading|undefined,_width:number,_height:number):Point[] {
  if(!reading)return [];
  const nodes=reading.nodes;
  const first=new Map<string,number>();nodes.forEach((n,i)=>{if(!first.has(n.ref))first.set(n.ref,i);});
  const edges=reading.edges.flatMap(e=>{const a=first.get(e.from_ref),b=first.get(e.to_ref);return a!==undefined&&b!==undefined&&a!==b?[[a,b]]:[];});
  const reach=Math.max(260,Math.sqrt(nodes.length)*48);
  const spaces=nodes.flatMap((n,i)=>n.kind==="wiki-space"?[i]:[]);
  const anchors=new Map<number,Point>();
  spaces.forEach((index,i)=>{const angle=i*2.399963,r=Math.sqrt(i/Math.max(1,spaces.length-1))*reach;anchors.set(index,{x:Math.cos(angle)*r,y:Math.sin(angle)*r*.72});});
  const membership=new Map<number,number>();
  for(const [a,b] of edges){if(anchors.has(a)&&!anchors.has(b)&&!membership.has(b))membership.set(b,a);if(anchors.has(b)&&!anchors.has(a)&&!membership.has(a))membership.set(a,b);}
  const ordinals=new Map<number,number>();
  const world=nodes.map((n,i)=>{const parent=membership.get(i),center=anchors.get(i)??(parent===undefined?{x:0,y:0}:anchors.get(parent)!);const ordinal=ordinals.get(parent??-1)??0;ordinals.set(parent??-1,ordinal+1);const angle=ordinal*2.399963+seed(n.ref)*.7;const r=anchors.has(i)?0:Math.sqrt(ordinal+1)*36;return {x:center.x+Math.cos(angle)*r,y:center.y+Math.sin(angle)*r,z:seed(`${n.ref}:depth`)*650-140};});
  // Bounded local collision relaxation. Spatial buckets avoid a quadratic
  // all-pairs pass. Springs consume only owner-admitted relation endpoints.
  for(let step=0;step<40;step++){
    const buckets=new Map<string,number[]>();
    world.forEach((p,i)=>{const key=`${Math.floor(p.x/90)},${Math.floor(p.y/90)}`;const cell=buckets.get(key)??[];cell.push(i);buckets.set(key,cell);});
    const forces=world.map(()=>({x:0,y:0}));
    world.forEach((p,i)=>{const cx=Math.floor(p.x/90),cy=Math.floor(p.y/90);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const j of buckets.get(`${cx+dx},${cy+dy}`)??[]){if(j<=i)continue;const x=p.x-world[j].x,y=p.y-world[j].y,d=Math.max(1,Math.hypot(x,y)),f=Math.min(6,1900/(d*d));forces[i].x+=x/d*f;forces[i].y+=y/d*f;forces[j].x-=x/d*f;forces[j].y-=y/d*f;}});
    for(const [a,b] of edges){const x=world[b].x-world[a].x,y=world[b].y-world[a].y,d=Math.max(1,Math.hypot(x,y)),f=(d-190)*.002;forces[a].x+=x/d*f;forces[a].y+=y/d*f;forces[b].x-=x/d*f;forces[b].y-=y/d*f;}
    world.forEach((p,i)=>{p.x+=forces[i].x;p.y+=forces[i].y;});
  }
  return world.map(p=>{const scale=800/(800+p.z);return {x:400+p.x*scale,y:260+p.y*scale,z:p.z,scale};});
}
