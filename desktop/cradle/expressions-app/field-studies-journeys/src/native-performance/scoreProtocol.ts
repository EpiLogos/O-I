import type {KernelConversion} from '../kernelDocumentBridge.js';
export type Counter=string;
export type NativeScoreEvent=[Counter,Counter,number,number,Record<string,unknown>|'b'|'c'|'x'];
export interface NativeScoreLayer {layer_ref:string;title:string;enabled:boolean;solo:boolean}
export interface NativeScoreParameter {native_owner:string;action_ref:string;target_ref:string;unit:string;scope:'note'|'instrument'|'body'|'context'|'presentation';minimum:number;maximum:number;baseline:number;smoothing_samples:Counter}
export interface NativeScoreRoute {route_ref:string;source:{ref:string;revision:string;availability:'available'|'unavailable'|'withheld'|'stale'};source_unit:string;destination:NativeScoreParameter;transfer:'replace'|'add'|'multiply';amount:number;delay_samples:Counter;feedback:boolean;enabled:boolean}
/** This is the exact authored subset of the existing native PerformanceOperation.
 * Native records, checkpoints, basis/source grants and reservations have no UI author. */
export type NativeScoreOperation=
 |{operation:'edit_event';sequence:Counter;replacement:NativeScoreEvent}
 |{operation:'remove_event';sequence:Counter}
 |{operation:'overdub';layer:NativeScoreLayer;events:NativeScoreEvent[]}
 |{operation:'layer_set';index:number;layer:NativeScoreLayer}
 |{operation:'route_set';route:NativeScoreRoute}
 |{operation:'route_clear';route_ref:string}
 |{operation:'automate';route_index:number;events:NativeScoreEvent[]}
 |{operation:'loop';range:{from_sample:Counter;to_sample:Counter}|null}
 |{operation:'seek';sample:Counter}
 |{operation:'tempo';segments:{at_sample:Counter;at_tick:Counter;micros_per_quarter:number}[]};
export interface NativeScorePerformance {
 schema:string;performance_ref:string;content_digest:string;duration_samples:Counter;sample_rate:number;position_sample:Counter;ppq:number;
 pages:{events:NativeScoreEvent[]}[];layers:NativeScoreLayer[];parameters:NativeScoreParameter[];routes:NativeScoreRoute[];
 tempo:{at_sample:Counter;at_tick:Counter;micros_per_quarter:number}[];loop_range:{from_sample:Counter;to_sample:Counter}|null;
 bases:{content_digest:string}[];
}
export interface NativeScoreSnapshot {expression_ref:string;document_revision:number;scene_ref:string;scene_revision:number;performance:NativeScorePerformance;stopped:boolean;playback_current:boolean;reason:string|null}
export interface NativeScorePort {snapshot():NativeScoreSnapshot|null;subscribe(listener:()=>void):()=>void;edit(operations:NativeScoreOperation[]):Promise<NativeScoreSnapshot>;resolve():Promise<NativeScoreSnapshot>}
export function scoreCounter(value:string):Counter {if(!/^(0|[1-9][0-9]{0,19})$/.test(value)||BigInt(value)>=(1n<<64n))throw Error('Enter an exact nonnegative native sample or sequence.');return value;}
export function currentScore(view:KernelConversion|undefined,sceneId:string):Omit<NativeScoreSnapshot,'stopped'|'playback_current'|'reason'> {
 const binding=view?.bindings[sceneId],scene=view?.document.scenes.find(s=>s.scene_ref===binding?.scene_ref);
 if(!view||!binding||!scene||!scene.performance||!Number.isSafeInteger(scene.revision))throw Error('The selected native Scene has no retained score.');
 const actual=scene.performance as NativeScorePerformance;
 // A score view copies only the authored musical operands. Full native assets,
 // original applications and checkpoints remain in the same native Document.
 const performance=structuredClone({schema:actual.schema,performance_ref:actual.performance_ref,content_digest:actual.content_digest,duration_samples:actual.duration_samples,sample_rate:actual.sample_rate,position_sample:actual.position_sample,ppq:actual.ppq,pages:actual.pages,layers:actual.layers,parameters:actual.parameters,routes:actual.routes,tempo:actual.tempo,loop_range:actual.loop_range,bases:actual.bases?.map(b=>({content_digest:b.content_digest}))}) as NativeScorePerformance;
 if(!performance.schema.startsWith('oi.expression-performance')||!Array.isArray(performance.pages)||!Array.isArray(performance.layers)||!Array.isArray(performance.parameters)||!Array.isArray(performance.routes)||!performance.content_digest)throw Error('The actual native score contract is unavailable.');
 return{expression_ref:view.document.expression_ref,document_revision:view.document.revision,scene_ref:binding.scene_ref,scene_revision:scene.revision as number,performance};
}
