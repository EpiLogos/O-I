export interface ConnectionBinding {binding_ref:string;from_entity_ref:string;to_entity_ref:string;[key:string]:unknown}
export interface Point {x:number;y:number;z:number}
export interface ConnectionPath {binding:ConnectionBinding;points:Point[]}
export const MAX_CONNECTIONS: number;
export const MIN_CONNECTION_PARTICLES: number;
export const CONNECTION_PARTICLE_FRACTION: number;
export function connectionPaths(bindings:readonly ConnectionBinding[],poses:readonly unknown[]):{paths:ConnectionPath[];unavailable:string[]};
export class ConnectionRuntime {
 enabled:boolean;particleCount:number;start:number;capacity:number;slots:Map<string,number>;ranges:Map<number,{start:number;end:number}>;selected:Set<string>;paths:ConnectionPath[];unavailable:string[];overflow:string[];
 resize(count:number):void;
 configure(bindings:readonly ConnectionBinding[],selected:readonly string[],count:number):void;
 range(slot:number):{start:number;end:number};
 update(poses:readonly unknown[],a:Float32Array,b:Float32Array,metadata:Float32Array):void;
 inspect():{enabled:boolean;totalParticles:number;nodeParticles:number;reservedParticles:number;limit:number;requested:number;rendered:string[];unavailable:string[];overflow:string[];occurrences:(ConnectionBinding&{start:number;end:number})[]};
}
