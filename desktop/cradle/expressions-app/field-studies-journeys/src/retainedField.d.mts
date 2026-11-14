/** The lease's view of the simulator's attraction targets: K8 writes them through this port, nothing else. */
export interface RetainedTargetPort {
 readonly texWidth: number;
 readonly texHeight: number;
 readonly particleCount: number;
 readonly currentPosTarget: unknown;
 readonly currentVelTarget: unknown;
 readonly nextPosTarget: unknown;
 readonly nextVelTarget: unknown;
 /** The authored source textures, admission material only: a retained binding copies them before taking target ownership. */
 readonly targetA: unknown;
 readonly targetB: unknown;
 setTargetTextures(targetA: unknown, targetB: unknown, centre: unknown): void;
}
export interface RetainedCapability {
 retainedTopology(): {tex_width:number;tex_height:number;particle_count:number;slot_count:number;units:string}|null;
 retainedTargetPort(): RetainedTargetPort;
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
/** The class it makes keeps the base's statics and has one constructor, so `new` and `InstanceType` both name the retained adapter. */
export function withRetainedField<T extends new (...args: any[]) => any>(
 Base: T, worldScale: number
): Omit<T, 'prototype'> & {new (...args: ConstructorParameters<T>): InstanceType<T> & RetainedCapability; readonly prototype: InstanceType<T> & RetainedCapability};
