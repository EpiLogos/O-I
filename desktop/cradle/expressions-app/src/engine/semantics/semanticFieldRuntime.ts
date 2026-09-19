import type { ResonanceState } from '../cymaticResonator';
import type { EvaluatedEntityPose } from '../entityPose';
import type { ForceEmitterState, RelationalCarrierState } from '../forceRuntime';
import { CHAKRA_BY_ID } from './chakraSemantics';
import { mapChakrasToAnchors } from './chakraProfile';
import type { SemanticBinding, SemanticFieldConfig, SemanticFieldState, SpatialColorFieldState } from './semanticTypes';

const clamp01=(v:number)=>Math.max(0,Math.min(1,v));
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));

interface CarrierSample {id:string;position:{x:number;y:number;z:number};speed:number;forceStrength:number;forceSpin:number;forceRadius:number;entityTint?:string;}

function hueShift(hex:string,turns:number){
  const clean=hex.replace('#','');if(!/^[0-9a-f]{6}$/i.test(clean)||Math.abs(turns)<1e-9)return hex;
  let r=parseInt(clean.slice(0,2),16)/255,g=parseInt(clean.slice(2,4),16)/255,b=parseInt(clean.slice(4,6),16)/255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0,s=d===0?0:d/(1-Math.abs(2*l-1));
  if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h/=6;if(h<0)h+=1;}
  h=(h+turns)%1;if(h<0)h+=1;
  const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h*6)%2-1)),m=l-c/2;let rr=0,gg=0,bb=0;const seg=Math.floor(h*6)%6;
  if(seg===0)[rr,gg,bb]=[c,x,0];else if(seg===1)[rr,gg,bb]=[x,c,0];else if(seg===2)[rr,gg,bb]=[0,c,x];else if(seg===3)[rr,gg,bb]=[0,x,c];else if(seg===4)[rr,gg,bb]=[x,0,c];else[rr,gg,bb]=[c,0,x];
  const h2=(n:number)=>Math.round((n+m)*255).toString(16).padStart(2,'0');return `#${h2(rr)}${h2(gg)}${h2(bb)}`;
}

export class SemanticFieldRuntime {
  private previous = new Map<string,{x:number;y:number;z:number}>();

  evaluate(input:{
    config: SemanticFieldConfig|undefined;
    resonance: ResonanceState|null;
    poses: readonly EvaluatedEntityPose[];
    entityTints: ReadonlyMap<string,string>;
    forceEmitters: readonly ForceEmitterState[];
    relationalCarriers?: readonly RelationalCarrierState[];
    focus?: {entityId:string;nextEntityId:string;blend:number}|null;
    delta:number;
  }):SemanticFieldState {
    const cfg=input.config;if(!cfg?.enabled||cfg.profile.kind!=='chakra'||cfg.profile.profileId!=='chakra-seven-v1'){this.previous.clear();return{nodes:[],colorFields:[]};}
    const anchors=input.resonance?.anchors??[];
    const mapping=mapChakrasToAnchors(anchors);
    const modal=input.resonance?.modes??[];
    const bw=Math.max(.01,cfg.affinity.bandwidth||.14);
    const raw=mapping.map(({node,anchor})=>{
      if(!anchor)return{node,anchor,direct:0,affinity:0,proximity:0};
      const direct=modal.find(m=>m.modeIndex===anchor.modeIndex)?.energy??0;
      let affinity=0;
      for(const mode of modal){if(mode.energy<=0)continue;const d=Math.log(Math.max(1e-9,mode.frequencyHz)/Math.max(1e-9,anchor.frequencyHz));affinity+=mode.energy*Math.exp(-.5*(d/bw)*(d/bw));}
      const current=input.resonance?.frequencyHz??0;const detune=Math.abs(Math.log(Math.max(1e-9,current)/Math.max(1e-9,anchor.frequencyHz)));const proximity=Math.exp(-.5*(detune/bw)*(detune/bw));
      return{node,anchor,direct,affinity,proximity};
    });
    const sum=raw.reduce((s,v)=>s+v.affinity,0);const affinities=new Map(raw.map(v=>[v.node.id,sum>1e-12?v.affinity/sum:0] as const));
    const focusWeight=new Map<string,number>();if(input.focus){focusWeight.set(input.focus.entityId,1-input.focus.blend);focusWeight.set(input.focus.nextEntityId,(focusWeight.get(input.focus.nextEntityId)??0)+input.focus.blend);}
    const poseById=new Map(input.poses.map(p=>[p.entityId,p] as const));const emitterById=new Map(input.forceEmitters.map(e=>[e.id,e] as const));const relational=new Map((input.relationalCarriers??[]).map(e=>[e.id,e] as const));
    const carrierCache=new Map<string,CarrierSample|null>();
    const sample=(ref:{kind:string;id:string}):CarrierSample|null=>{
      const cacheKey=`${ref.kind}:${ref.id}`;if(carrierCache.has(cacheKey))return carrierCache.get(cacheKey)??null;
      let result:CarrierSample|null=null;
      if(ref.kind==='entity'){
        const pose=poseById.get(ref.id);if(pose){const previousKey=`entity:${ref.id}`,prev=this.previous.get(previousKey);const speed=prev&&input.delta>0?Math.hypot(pose.x-prev.x,pose.y-prev.y,pose.z-prev.z)/input.delta:0;this.previous.set(previousKey,{x:pose.x,y:pose.y,z:pose.z});const force=emitterById.get(`entity:${ref.id}`);
          result={id:`entity:${ref.id}`,position:{x:pose.x,y:pose.y,z:pose.z},speed,forceStrength:force?.strength??0,forceSpin:force?.spin??0,forceRadius:force?.radius??220,entityTint:input.entityTints.get(ref.id)};}
      }else{
        const force=emitterById.get(ref.id)??emitterById.get(`entity:${ref.id}`);if(force)result={id:force.id,position:{...force.position},speed:0,forceStrength:force.strength,forceSpin:force.spin,forceRadius:force.radius};
        else{const rel=relational.get(ref.id);if(rel)result={id:rel.id,position:{...rel.position},speed:0,forceStrength:rel.strength,forceSpin:rel.spin,forceRadius:rel.radius};}
      }
      carrierCache.set(cacheKey,result);return result;
    };
    const nodes=raw.map(v=>({semanticNodeId:v.node.id,directResonantEnergy:v.direct,affinity:affinities.get(v.node.id)??0,frequencyProximity:v.proximity,focused:0}));
    const byNode=new Map(nodes.map(n=>[n.semanticNodeId,n] as const));const colorFields:SpatialColorFieldState[]=[];
    for(const binding of cfg.bindings){if(!binding.enabled)continue;const node=CHAKRA_BY_ID.get(binding.semanticNodeId as any);if(!node)continue;const affinity=affinities.get(node.id)??0;const carriers=binding.carriers.map(sample).filter((v):v is CarrierSample=>!!v);const focused=carriers.reduce((m,c)=>Math.max(m,focusWeight.get(c.id.replace(/^entity:/,''))??0),0);const nodeState=byNode.get(node.id);if(nodeState)nodeState.focused=Math.max(nodeState.focused,focused);
      const colorCfg=binding.color;if(!colorCfg?.enabled)continue;
      for(const carrier of carriers){let activation=colorCfg.activation==='resonanceAffinity'?affinity:colorCfg.activation==='focus'?focused:1;let gain=colorCfg.gain*(binding.resonance?.gain??1)*activation*cfg.globalColorGain;let radius=colorCfg.radius.source==='force'?carrier.forceRadius:(colorCfg.radius.value??220);let shift=0;
        for(const mod of binding.modulations??[]){const signal=mod.source.kind==='resonanceAffinity'?affinity:mod.source.kind==='focus'?focused:mod.source.kind==='carrierSpeed'?carrier.speed:mod.source.kind==='forceStrength'?carrier.forceStrength:carrier.forceSpin;let value=(mod.offset??0)+signal*mod.amount;if(mod.clamp)value=clamp(value,mod.clamp[0],mod.clamp[1]);if(mod.target==='color.gain')gain*=value;else if(mod.target==='color.radius')radius*=value;else shift+=value;}
        const color=colorCfg.colorSource==='override'&&colorCfg.overrideColor?colorCfg.overrideColor:colorCfg.colorSource==='entityTint'&&carrier.entityTint?carrier.entityTint:node.canonicalColor;
        if(gain>1e-6&&radius>1e-6)colorFields.push({bindingId:binding.id,semanticNodeId:node.id,carrierId:carrier.id,center:{...carrier.position},color:hueShift(color,shift),gain,radius,falloff:colorCfg.falloff,metric:colorCfg.metric,blend:colorCfg.blend});
      }
    }
    return{nodes,colorFields:colorFields.slice(0,16)};
  }
}
