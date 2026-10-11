import {entity as newEntity,type Entity,type Vec3} from './model';
import {refitEntityForGlyph,refitStepForGlyph} from './stateSizing.js';
/** One formation to add: the pointer add and the shell's formation-add edit both build their entity from this, so they cannot drift. */
export interface FormationSpec{title:string;shape:Entity['shape'];text:string;position:Vec3}
export function formationFromSpec(spec:FormationSpec,engine:{autoFitSizes?:boolean;fontFamily?:string;fontWeight?:string|number}):Entity{
 const added=newEntity(spec.title,spec.text,spec.position);
 added.shape=spec.shape;added.sequence.steps[0].shape=spec.shape;
 if(spec.shape==='text'&&engine.autoFitSizes!==false){const font={fontFamily:engine.fontFamily,fontWeight:engine.fontWeight};refitEntityForGlyph(added,spec.text,font);refitStepForGlyph(added,0,spec.text,font);}
 return added;
}
/** Plan a useful state-local XY nudge; the caller retains native/history ownership. */
export function formationStateNudge(entity:Entity,stepId:string,key:string,amount:number):Vec3|null {
 if(entity.kind!=='formation'||entity.locked||!Number.isFinite(amount)||amount<=0)return null;
 const step=entity.sequence.steps.find(row=>row.id===stepId);
 if(!step||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key))return null;
 const before=step.position??{x:0,y:0,z:0},next={...before};
 if(key==='ArrowLeft')next.x-=amount;
 if(key==='ArrowRight')next.x+=amount;
 if(key==='ArrowUp')next.y+=amount;
 if(key==='ArrowDown')next.y-=amount;
 next.x=Math.max(-50,Math.min(50,next.x));next.y=Math.max(-50,Math.min(50,next.y));
 return next.x===before.x&&next.y===before.y?null:next;
}
