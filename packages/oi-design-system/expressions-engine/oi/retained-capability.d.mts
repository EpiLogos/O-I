export interface RetainedPartitionSnapshot {
 readonly schema: 'oi.retained-partition-snapshot/v1';
 readonly scene_signature: string;
 readonly partition_signature: string;
 readonly slot_count: number;
 readonly particle_count: number;
 readonly connection_start: number;
 readonly partitions: ReadonlyArray<Readonly<{entity_ref:string;start:number;end:number}>>;
 /** Caller-owned copies. Mutation cannot alter the retained engine. */
 readonly authored_target_a: Float32Array;
 readonly authored_target_b: Float32Array;
}
export interface RetainedTargetPort {
 readonly texWidth:number;readonly texHeight:number;readonly particleCount:number;
 readonly targetA:any;readonly targetB:any;
 readPartitionSnapshot():RetainedPartitionSnapshot;
 setTargetTextures(targetA:any,targetB:any,centre:any):void;
 [key:string]:any;
}
export interface RetainedCapability {
 retainedTopology(): {tex_width:number;tex_height:number;particle_count:number;slot_count:number;units:string}|null;
 retainedTargetPort(): RetainedTargetPort;
 releaseRetainedField(): void;
 checkpointRetainedField(binding: any): any;
 restoreRetainedField(binding: any, checkpoint: any): void;
 onRetainedRecoveryRequired(listener: (state: 'lost' | 'restored') => void): () => void;
 updateRetainedPresentation(request: any): unknown;
}
export function withRetainedField<T extends new (...args: any[]) => any>(
 Base: T, worldScale: number
): T & (new (...args: ConstructorParameters<T>) => InstanceType<T> & RetainedCapability);
