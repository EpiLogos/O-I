import type { ResonanceAnchor } from './cymaticResonator';
import type { SemanticFieldConfig } from './semantics/semanticTypes';
import { mapChakrasToAnchors } from './semantics/chakraProfile';
import type { KeySource } from './torusDrive';

export type ResonanceDriveConfig =
  | {kind:'frequency'}
  | {kind:'sweep'; glideS?:number; dwellS?:number; direction?:'ascent'|'descent'|'pingpong'}
  | {kind:'semanticFocus'; profileId:string}
  /** DLW §20.14: the plate is driven by what the torus plays; the Key source (§20.2) picks which pitches (torusDrive.ts). */
  | {kind:'torus'; keySource?:KeySource};

export interface ResolvedResonanceDrive {
  kind: ResonanceDriveConfig['kind'];
  targetHz:number;
  bound:boolean;
  semanticNodeId?:string;
  anchorId?:string;
  /** Torus drive only: every tone driving the plate, whether the source is silent, and why in words. `bound` is false while silent. */
  tonesHz?:number[];
  silent?:boolean;
  reason?:string|null;
  keySource?:KeySource;
  roles?:{standing:'absent';reason:string};
}

/** Resolves semantic focus without teaching the resonator what a chakra is. */
export function semanticFocusTarget(args:{
  currentHz:number;
  focus:{entityId:string;nextEntityId:string;blend:number}|null;
  semanticField:SemanticFieldConfig|undefined;
  anchors:readonly ResonanceAnchor[];
}):ResolvedResonanceDrive {
  const cfg=args.semanticField;
  if(!args.focus||!cfg?.enabled||cfg.profile.kind!=='chakra'||cfg.profile.profileId!=='chakra-seven-v1')return{kind:'semanticFocus',targetHz:args.currentHz,bound:false};
  const map=mapChakrasToAnchors(args.anchors);
  const bindingFor=(entityId:string)=>cfg.bindings.find(b=>b.enabled&&b.carriers.some(c=>c.kind==='entity'&&c.id===entityId));
  const resolve=(entityId:string)=>{
    const binding=bindingFor(entityId);if(!binding)return null;
    const mapped=map.find(m=>m.node.id===binding.semanticNodeId);const override=binding.resonance?.anchorId;const anchor=override?args.anchors.find(a=>a.id===override):mapped?.anchor;
    return binding&&anchor?{binding,anchor}:null;
  };
  const a=resolve(args.focus.entityId),b=resolve(args.focus.nextEntityId);
  if(!a&&!b)return{kind:'semanticFocus',targetHz:args.currentHz,bound:false};
  const aa=a??b!,bb=b??a!;const blend=Math.max(0,Math.min(1,args.focus.blend));
  return{kind:'semanticFocus',targetHz:aa.anchor.frequencyHz+(bb.anchor.frequencyHz-aa.anchor.frequencyHz)*blend,bound:true,semanticNodeId:blend<.5?aa.binding.semanticNodeId:bb.binding.semanticNodeId,anchorId:blend<.5?aa.anchor.id:bb.anchor.id};
}
