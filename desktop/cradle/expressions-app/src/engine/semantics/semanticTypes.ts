export type SemanticProfileKind = 'chakra';
export type SemanticCarrierRef =
  | {kind:'entity'; id:string}
  | {kind:'forceEmitter'; id:string};

export type SemanticActivationSource =
  | 'resonanceAffinity'
  | 'focus'
  | 'constant';

export interface SemanticColorCoupling {
  enabled: boolean;
  colorSource: 'canonical'|'entityTint'|'override';
  overrideColor?: string;
  gain: number;
  radius: {source:'independent'|'force'; value?:number};
  falloff: 'gaussian'|'compact';
  metric: 'world3d'|'compositionPlane';
  blend: 'weighted'|'additive';
  activation: SemanticActivationSource;
}

export type SemanticSignalRef =
  | {kind:'resonanceAffinity'}
  | {kind:'focus'}
  | {kind:'carrierSpeed'}
  | {kind:'forceStrength'}
  | {kind:'forceSpin'};

export interface SemanticModulation {
  source: SemanticSignalRef;
  target: 'color.gain'|'color.radius'|'color.hueShift';
  amount: number;
  offset?: number;
  clamp?: [number,number];
}

export interface SemanticBinding {
  id: string;
  semanticNodeId: string;
  enabled: boolean;
  resonance?: { anchorId?: string; gain:number };
  carriers: SemanticCarrierRef[];
  color?: SemanticColorCoupling;
  modulations?: SemanticModulation[];
}

export interface SemanticFieldConfig {
  enabled: boolean;
  profile: {kind:SemanticProfileKind; profileId:string};
  affinity: {method:'modalProjection'; bandwidth:number};
  globalColorGain: number;
  bindings: SemanticBinding[];
}

export interface SpatialColorFieldState {
  bindingId:string;
  semanticNodeId:string;
  carrierId:string;
  center:{x:number;y:number;z:number};
  color:string;
  gain:number;
  radius:number;
  falloff:'gaussian'|'compact';
  metric:'world3d'|'compositionPlane';
  blend:'weighted'|'additive';
}

export interface EvaluatedSemanticNode {
  semanticNodeId:string;
  directResonantEnergy:number;
  affinity:number;
  frequencyProximity:number;
  focused:number;
}

export interface SemanticFieldState {
  nodes: EvaluatedSemanticNode[];
  colorFields: SpatialColorFieldState[];
}
