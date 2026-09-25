import {forceCollide,forceLink,forceManyBody,forceSimulation,forceX,forceY,type Simulation,type SimulationLinkDatum,type SimulationNodeDatum} from "d3-force";
import type {GraphReading} from "./graph";

export interface Point {x:number;y:number;z?:number;scale?:number}

/** Authored member-role coordinates arrive in [-100,100]; this presentation
 * scale is the same translation the constellation scenes use. */
const MEMBER_SCALE=95,MAX_FORM_RADIUS=360;
function seed(ref:string){let h=2166136261;for(const c of ref)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296;}

interface SimNode extends SimulationNodeDatum {ref:string;out:number;radius:number;x:number;y:number}
interface CarriedMember {ref:string;out:number;anchor:SimNode;offset:{x:number;y:number;z:number}}

/** A live force world over one graph reading. Free nodes simulate;
 * authored constellation members ride their whole as an intact group —
 * native role geometry is never rearranged by the forces. Positions live
 * on disposable sim records keyed by native reference; canonical knowledge
 * records are never mutated. The world is deterministic: seeded initial
 * positions, no random init, so an unchanged topology re-settles into the
 * same arrangement after reopen. */
export class ForceWorld {
  private sim:Simulation<SimNode,SimulationLinkDatum<SimNode>>;
  private simNodes=new Map<string,SimNode>();
  private carried:CarriedMember[]=[];
  private out:Point[]=[];

  constructor(reading:GraphReading,retained?:ReadonlyMap<string,Point>) {
    // Stable reference order keeps an unchanged topology spatially identical
    // without imposing a source order (native order may change as providers arrive).
    const nodes=[...reading.nodes].sort((a,b)=>a.ref.localeCompare(b.ref));
    const indexByRef=new Map<string,number>();
    nodes.forEach((node,i)=>{if(!indexByRef.has(node.ref))indexByRef.set(node.ref,i);});
    const outputSlot=new Map<string,number>();
    reading.nodes.forEach((node,i)=>outputSlot.set(node.ref,i));
    this.out=reading.nodes.map(()=>({x:400,y:260,scale:1}));

    // Seeded phyllotaxis start: well-spread before the first tick, identical
    // across reloads. A retained position (a prior world of the same
    // topology) wins so an edit does not resettle the whole network.
    const reach=Math.max(260,Math.sqrt(nodes.length)*48);
    const spaces:number[]=[],seeded=new Map<number,{x:number;y:number}>();
    nodes.forEach((n,i)=>{if(n.kind==="wiki-space")spaces.push(i);});
    spaces.forEach((index,i)=>{const angle=i*2.399963,r=Math.sqrt(i/Math.max(1,spaces.length-1))*reach;seeded.set(index,{x:400+Math.cos(angle)*r,y:260+Math.sin(angle)*r*.72});});
    const memberships=reading.edges.filter(e=>e.relation==="space-node"||e.relation==="space-child-space").flatMap(e=>{const a=indexByRef.get(e.from_ref),b=indexByRef.get(e.to_ref);return a!==undefined&&b!==undefined?[[a,b]]:[];}).sort((x,y)=>x[0]-y[0]||x[1]-y[1]);
    const parent=new Map<number,number>();
    for(const [a,b] of memberships){if(seeded.has(a)&&!seeded.has(b)&&!parent.has(b))parent.set(b,a);if(seeded.has(b)&&!seeded.has(a)&&!parent.has(a))parent.set(a,b);}
    const start=(i:number):{x:number;y:number}=>{
      const kept=retained?.get(nodes[i].ref);if(kept)return {x:kept.x,y:kept.y};
      const anchor=seeded.get(i)??(parent.has(i)?seeded.get(parent.get(i)!):undefined);
      if(anchor)return anchor;
      const angle=seed(nodes[i].ref)*Math.PI*2,r=Math.sqrt(seed(`${nodes[i].ref}:ring`))*reach*.5;
      return {x:400+Math.cos(angle)*r,y:260+Math.sin(angle)*r};
    };
    const ordinals=new Map<number,number>();
    const jitter=(i:number,ref:string)=>{const p=parent.get(i);const ordinal=ordinals.get(p??-1)??0;ordinals.set(p??-1,ordinal+1);const spin=seed(`${ref}:jitter`)*.7,r=seeded.has(i)||p!==undefined?Math.sqrt(ordinal+1)*36:0;return {dx:Math.cos(ordinal*2.399963+spin)*r,dy:Math.sin(ordinal*2.399963+spin)*r};};

    // Formation pass first: members with native role layouts are carried;
    // their whole (or the member closest to the group's authored centre)
    // is the simulated anchor the group hangs from.
    const memberOf=new Map<string,{anchor:string;offset:{x:number;y:number;z:number}}>();
    const anchorRadius=new Map<string,number>();
    const used=new Set<string>();
    for(const formation of [...(reading.formations??[])].sort((a,b)=>a.ref.localeCompare(b.ref))) {
      const placed=formation.members.flatMap(member=>{
        const index=indexByRef.get(member.ref),layout=member.address?.layout;
        if(index===undefined||used.has(member.ref)||!layout||![layout.x,layout.y,layout.z].every(value=>Number.isFinite(value)&&Math.abs(value)<=100))return [];
        return [{member,layout}];
      });
      if(!placed.length)continue;
      // The whole's own node anchors the group when the reading discloses
      // one; otherwise the member closest to the group's authored centre.
      const anchorRef=nodes.some(n=>n.ref===formation.ref)
        ?formation.ref
        :placed.reduce((best,row)=>Math.hypot(row.layout.x,row.layout.y)<Math.hypot(best.layout.x,best.layout.y)?row:best).member.ref;
      const anchorLayout=placed.find(row=>row.member.ref===anchorRef)?.layout;
      const radius=Math.min(MAX_FORM_RADIUS,Math.max(80,...placed.map(({layout})=>Math.hypot(layout.x,layout.y)*MEMBER_SCALE+35)));
      for(const {member,layout} of placed) {
        used.add(member.ref);
        // The anchor itself simulates; it is never carried by itself.
        if(member.ref===anchorRef)continue;
        memberOf.set(member.ref,{anchor:anchorRef,offset:anchorLayout
          ?{x:(layout.x-anchorLayout.x)*MEMBER_SCALE,y:(layout.y-anchorLayout.y)*MEMBER_SCALE,z:(layout.z-anchorLayout.z)*MEMBER_SCALE}
          :{x:layout.x*MEMBER_SCALE,y:layout.y*MEMBER_SCALE,z:layout.z*MEMBER_SCALE}});
      }
      anchorRadius.set(anchorRef,Math.max(anchorRadius.get(anchorRef)??0,radius));
    }

    // Simulated nodes: everything not carried. Collision radii follow the
    // visual treatment (spaces larger, formation wholes by their extent).
    const world:SimNode[]=nodes.flatMap((n,i)=>{
      if(memberOf.has(n.ref))return [];
      const {dx,dy}=jitter(i,n.ref),at=start(i);
      const node:SimNode={ref:n.ref,out:outputSlot.get(n.ref)??-1,radius:anchorRadius.get(n.ref)??(n.kind==="wiki-space"?26:13),x:at.x+dx,y:at.y+dy};
      this.simNodes.set(n.ref,node);
      return [node];
    });
    for(const [ref,member] of memberOf) {
      const anchor=this.simNodes.get(member.anchor),slot=outputSlot.get(ref);
      if(anchor&&slot!==undefined)this.carried.push({ref,out:slot,anchor,offset:member.offset});
    }

    // Relations spring between simulated endpoints; a carried member's
    // outside relations pull its whole formation (moving the group is the
    // point), and relations interior to an authored group are already
    // answered by its role geometry. Canonical link order keeps the world
    // identical however the source ordered its rows.
    const links:SimulationLinkDatum<SimNode>[]=[];
    const springs:{a:SimNode;b:SimNode;membership:boolean}[]=[];
    for(const edge of reading.edges) {
      const resolve=(ref:string)=>memberOf.get(ref)?.anchor??ref;
      const a=this.simNodes.get(resolve(edge.from_ref)),b=this.simNodes.get(resolve(edge.to_ref));
      if(!a||!b||a===b)continue;
      springs.push({a,b,membership:edge.relation==="space-node"||edge.relation==="space-child-space"});
    }
    springs.sort((x,y)=>x.a.ref.localeCompare(y.a.ref)||x.b.ref.localeCompare(y.b.ref));
    for(const {a,b,membership} of springs)links.push({source:a,target:b,...(membership?{distance:130,strength:.15}:{distance:90,strength:.35})});

    const n=Math.max(1,world.length);
    this.sim=forceSimulation<SimNode,SimulationLinkDatum<SimNode>>(world)
      .force("charge",forceManyBody<SimNode>().strength(-Math.min(240,60+Math.sqrt(n)*12)))
      .force("collide",forceCollide<SimNode>().radius(node=>node.radius+8).strength(.9).iterations(2))
      .force("link",forceLink<SimNode,SimulationLinkDatum<SimNode>>(links).distance(link=>(link as {distance?:number}).distance??90).strength(link=>(link as {strength?:number}).strength??.35))
      .force("x",forceX(400).strength(.03))
      .force("y",forceY(260).strength(.03))
      .velocityDecay(.4);
  }

  /** Publish while the simulation has work; a settled world emits once more
   * on end and then stops (the timer retires itself at alpha-min). */
  onTick(publish:(points:Point[])=>void) {
    this.sim.on("tick",()=>publish(this.positions())).on("end",()=>publish(this.positions()));
  }
  stop(){this.sim.stop();}
  wake(){if(this.sim.alpha()>this.sim.alphaMin())this.sim.restart();}
  /** Verification seam: advance the world synchronously. The live world
   * advances on its own timer instead. */
  advance(ticks=1){this.sim.stop();for(let i=0;i<ticks;i++)this.sim.tick();return this.positions();}
  drag(ref:string,x:number,y:number) {
    const node=this.simNodes.get(ref);if(!node)return;
    node.fx=x;node.fy=y;
    this.sim.alphaTarget(.3).restart();
  }
  /** Release the dragged subject: its position rejoins the simulation. One
   * pointer drags at a time, so clearing every pin is exact. */
  release(_ref:string) {
    for(const node of this.simNodes.values()){node.fx=undefined;node.fy=undefined;}
    this.sim.alphaTarget(0);
  }
  /** Reading-order output. Free nodes take their simulated position with no
   * generated depth; authored members sit at their exact role offsets around
   * their whole — packed by the forces, never rearranged inside. */
  positions():Point[] {
    for(const node of this.simNodes.values()) {
      if(node.out<0)continue;
      const point=this.out[node.out];
      point.x=node.x;point.y=node.y;point.z=0;point.scale=1;
    }
    for(const member of this.carried) {
      const point=this.out[member.out];
      point.x=member.anchor.x+member.offset.x;
      point.y=member.anchor.y+member.offset.y;
      point.z=member.offset.z;
      point.scale=1;
    }
    return this.out;
  }
  /** The settled working arrangement, keyed by native reference — what the
   * next world of an edited topology starts from. */
  retain():Map<string,Point> {
    const points=this.positions(),retained=new Map<string,Point>();
    for(const [ref,node] of this.simNodes){if(node.out>=0){const point=points[node.out];retained.set(ref,{x:point.x,y:point.y});}}
    for(const member of this.carried){const point=points[member.out];retained.set(member.ref,{x:point.x,y:point.y});}
    return retained;
  }
}
