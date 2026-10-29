export interface RetainedCapability {
 retainedTopology(): {tex_width:number;tex_height:number;particle_count:number;slot_count:number;units:string}|null;
 retainedTargetPort(): any;
 releaseRetainedField(): void;
 checkpointRetainedField(binding: any): any;
 restoreRetainedField(binding: any, checkpoint: any): void;
 onRetainedRecoveryRequired(listener: (state: 'lost' | 'restored') => void): () => void;
 updateRetainedPresentation(request: any): unknown;
 /** The authored identity a frame configures (scene id and authoring revision). */
 authoredIdentity(frame: any): string;
 /** O-I #747: whether configuring this frame would replace the authored scene a standing lease holds. */
 retainedRefuses(frame: any): boolean;
 /** The authored identity the standing lease holds, or null with no lease. */
 retainedAuthored(): string | null;
}
export function withRetainedField<T extends new (...args: any[]) => any>(
 Base: T, worldScale: number
): T & (new (...args: ConstructorParameters<T>) => InstanceType<T> & RetainedCapability);
