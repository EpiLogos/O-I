/** O:I-owned relation presentation attached to the existing production field. */
export interface ConnectionBinding {binding_ref:string;from_entity_ref:string;to_entity_ref:string;[key:string]:unknown}
export interface ConnectionPath {binding:ConnectionBinding;points:{x:number;y:number;z:number}[]}
export function connectionPaths(bindings:readonly ConnectionBinding[],poses:readonly unknown[]):{paths:ConnectionPath[];unavailable:string[]};
export function hitConnection(paths:readonly ConnectionPath[],x:number,y:number,project:(p:{x:number;y:number;z:number})=>{x:number;y:number;visible:boolean},radius?:number):(ConnectionBinding&{kind:'relation';distance:number})|null;
export class ExpressionConnectionLayer {
 constructor(engine:unknown);
 configure(bindings?:readonly ConnectionBinding[],selected?:readonly string[]):void;
 update():void;
 paths:ConnectionPath[];
 hitTest(x:number,y:number,radius?:number):(ConnectionBinding&{kind:'relation';distance:number})|null;
 pickEntity(x:number,y:number,radius?:number):string|null;
 inspect():{rendered:string[];unavailable:string[];enabled:boolean;totalParticles:number;nodeParticles:number;reservedParticles:number;limit:number;requested:number;overflow:string[];occurrences:(ConnectionBinding&{start:number;end:number})[]};
 dispose():void;
}
