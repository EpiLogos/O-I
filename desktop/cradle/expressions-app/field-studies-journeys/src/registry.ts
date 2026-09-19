import {NATIVE_BINDINGS} from './nativeParameters';
/** Every live control is a projection of its native owner. Placeholder preview values are gone. */
export interface Parameter {key:string;label:string;group:string;min:number;max:number;hardMin:number;hardMax:number;step:number;preview:boolean;unit?:string;note?:string;bind:string;scale?:'linear'|'log'}
export const PARAMETERS:Parameter[]=[...NATIVE_BINDINGS.map(b=>({...b,preview:true,note:b.path==='cymatics.sweepSpeed'?'Legacy glide fallback per station, consumed only while explicit Sweep Glide is absent. An imported explicit glide remains authoritative.':b.path==='cymatics.modeCount'?'Requested modal budget. The native model also retains its seven marked stations; the GPU addresses every active slot.':b.note??(b.key==='timeScale'?'Values at or below zero hold the simulation. Negative values do not reverse accumulated physics.':undefined)}))];
export const parameter=(key:string)=>PARAMETERS.find(p=>p.key===key);
