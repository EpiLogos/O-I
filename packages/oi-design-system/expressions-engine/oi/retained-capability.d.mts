export interface RetainedCapability {
 retainedTopology(): {tex_width:number;tex_height:number;particle_count:number;slot_count:number;units:string}|null;
 retainedTargetPort(): any;
 releaseRetainedField(): void;
 checkpointRetainedField(binding: any): any;
 restoreRetainedField(binding: any, checkpoint: any): void;
 onRetainedRecoveryRequired(listener: (state: 'lost' | 'restored') => void): () => void;
 updateRetainedPresentation(request: any): unknown;
}
export function withRetainedField<T extends new (...args: any[]) => any>(
 Base: T, worldScale: number
): T & (new (...args: ConstructorParameters<T>) => InstanceType<T> & RetainedCapability);
