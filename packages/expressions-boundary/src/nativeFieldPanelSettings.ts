/** Non-numeric Field panel controls admitted through the shell editor boundary.
 * Every key is an authored Scene field written at its exact path. Option lists
 * are the source option arrays (inspector.ts, cited per key) and must agree with
 * the authored model unions; the compile-time check below fails tsc on drift.
 * Registry numeric controls (NATIVE_BINDINGS), the shared-medium/morph/colour keys
 * already admitted by nativeDeviceEdits.ts, and Scene.composition.layout are
 * not in this table. The number kind admits the engine's own depth shares, whose
 * range is the inspector's range() call (inspector.ts:123); the validator enforces
 * finite and inclusive [min, max] only, because the inspector clamps to the range
 * but does not round to step. */
import type {EngineSettings, Scene} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';

export type FieldPanelSettingSpec =
  | {readonly target: 'engine' | 'composition'; readonly type: 'boolean'}
  | {readonly target: 'engine' | 'composition' | 'scene'; readonly type: 'enum'; readonly options: readonly string[]}
  | {readonly target: 'engine'; readonly type: 'number'; readonly min: number; readonly max: number; readonly step?: number};

export const FIELD_PANEL_SETTINGS = {
  // Palette & paper (inspector.ts:118). Model: EngineSettings.backgroundMode, optional.
  backgroundMode: {target: 'engine', type: 'enum', options: ['solid', 'vignette', 'ambientGlow', 'adaptive'] as const},
  // Mark profile (inspector.ts:122). Model: EngineSettings.grainProfile, optional.
  grainProfile: {target: 'engine', type: 'boolean'},
  // Mark profile (inspector.ts:122). Model: EngineSettings.dotShape, optional.
  dotShape: {target: 'engine', type: 'enum', options: ['circle', 'square'] as const},
  // 3D body & depth (inspector.ts:123). Model: EngineSettings.volumeEnabled, optional.
  volumeEnabled: {target: 'engine', type: 'boolean'},
  // 3D body & depth (inspector.ts:123). Model: EngineSettings.volumeProfile, optional.
  volumeProfile: {target: 'engine', type: 'enum', options: ['slab', 'bevel', 'round', 'dome', 'taper'] as const},
  // 3D body & depth (inspector.ts:123). Model: EngineSettings.depthPerspective, optional.
  depthPerspective: {target: 'engine', type: 'boolean'},
  // 3D body & depth (inspector.ts:123). The inspector select writes the strings
  // 'off'/'on' while the authored model is boolean; nativeBridge.ts:100 accepts
  // both. The boolean is the admitted authored form.
  depthOcclusion: {target: 'engine', type: 'boolean'},
  // 3D body & depth, range 'Depth in the swirl' (inspector.ts:123: range(…,'engine.vortex3d',…,0,1,.01)).
  // Model: EngineSettings.vortex3d, optional. Absent = derived from the body law
  // (nativeBridge.ts:101-104 keeps it absent; GPGPUSimulator.ts:950 `?? depthGeometry`).
  vortex3d: {target: 'engine', type: 'number', min: 0, max: 1, step: 0.01},
  // 3D body & depth, range 'Depth in the bridge' (inspector.ts:123: range(…,'engine.dispersion3d',…,0,1,.01)).
  // Model: EngineSettings.dispersion3d, optional. Absent = derived from the body law (GPGPUSimulator.ts:951 `?? depthGeometry`).
  dispersion3d: {target: 'engine', type: 'number', min: 0, max: 1, step: 0.01},
  // Pointer (inspector.ts:125). Model: EngineSettings.pointerMode. Pointer paths
  // follow the shared pointer bucket while pointerScope is global (sharedSettings.ts POINTER_PATHS).
  pointerMode: {target: 'engine', type: 'enum', options: ['attract', 'repel', 'vortex'] as const},
  // Pointer (inspector.ts:125). Model: EngineSettings.pointerClick, optional.
  pointerClick: {target: 'engine', type: 'enum', options: ['pulse', 'implode', 'vortex', 'shove', 'off'] as const},
  // Pointer (inspector.ts:125, id pointer-scope, not a data-bind). Model: Scene.pointerScope, optional
  // top-level Scene field, written through useLocalPointer (sharedSettings.ts), not a plain path write.
  pointerScope: {target: 'scene', type: 'enum', options: ['global', 'local'] as const},
  // Relational forces (inspector.ts:134). Model: EngineSettings.relationalEnabled.
  relationalEnabled: {target: 'engine', type: 'boolean'},
  // Relational forces (inspector.ts:134). Model: EngineSettings.relationalMode.
  relationalMode: {target: 'engine', type: 'enum', options: ['orbital', 'nbody', 'chaos'] as const},
  // Continuous resonance (inspector.ts:127). Model: Scene.composition.frequencyDriver.
  frequencyDriver: {target: 'composition', type: 'enum', options: ['manual', 'focus', 'automation'] as const},
  // Continuous resonance (inspector.ts:130). Model: EngineSettings.autoSweep.
  autoSweep: {target: 'engine', type: 'boolean'},
  // Continuous resonance (inspector.ts:131). Model: EngineSettings.sweepDirection.
  sweepDirection: {target: 'engine', type: 'enum', options: ['ascent', 'descent', 'pingpong'] as const},
  // Continuous resonance (inspector.ts:132). Model: EngineSettings.templateDimension, optional.
  templateDimension: {target: 'engine', type: 'enum', options: ['2D', '3D'] as const},
  // Continuous resonance, Compatibility (inspector.ts:133). Model: EngineSettings.resonatorMode, optional.
  resonatorMode: {target: 'engine', type: 'enum', options: ['resonator', 'template'] as const},
  // Travelling focus (inspector.ts:228). Model: Scene.composition.focus.
  focus: {target: 'composition', type: 'enum', options: ['parallel', 'travelling'] as const},
  // Travelling focus, Timing and direction (inspector.ts:230). Model: EngineSettings.focusOrder, optional.
  focusOrder: {target: 'engine', type: 'enum', options: ['listed', 'reverse', 'pingpong'] as const},
  // Travelling focus (inspector.ts:231). Model: Scene.composition.carryTint.
  carryTint: {target: 'composition', type: 'boolean'},
  // Travelling focus, legacy linked-station switch (inspector.ts:231). Model: Scene.composition.carryStation.
  carryStation: {target: 'composition', type: 'boolean'},
  // Layout plane (inspector.ts:144, select 'Layout plane'). Model: Scene.composition.plane, typed as model.ts Plane.
  plane: {target: 'composition', type: 'enum', options: ['XY', 'XZ', 'YZ'] as const},
  // Refit state sizes (inspector.ts:207, toggle 'Refit state sizes to new glyphs'). Model: EngineSettings.autoFitSizes, optional; absent reads as on (`!== false`).
  autoFitSizes: {target: 'engine', type: 'boolean'},
} satisfies Record<string, FieldPanelSettingSpec>;

export type FieldPanelSettingKey = keyof typeof FIELD_PANEL_SETTINGS;
type SpecValue<S> = S extends {readonly type: 'boolean'} ? boolean : S extends {readonly type: 'number'} ? number : S extends {readonly options: readonly (infer V)[]} ? V : never;
/** Literal value union per key: booleans, finite numbers in the spec's range, or the exact source option strings. */
export type FieldPanelSettingValue<K extends FieldPanelSettingKey> = SpecValue<(typeof FIELD_PANEL_SETTINGS)[K]>;

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
/** Compile-time agreement with the authored model unions. Any drifted option
 * list fails tsc here (the constraint rejects `false`). */
export type FieldPanelModelAgreement = [
  Assert<Equal<FieldPanelSettingValue<'backgroundMode'>, NonNullable<EngineSettings['backgroundMode']>>>,
  Assert<Equal<FieldPanelSettingValue<'grainProfile'>, NonNullable<EngineSettings['grainProfile']>>>,
  Assert<Equal<FieldPanelSettingValue<'dotShape'>, NonNullable<EngineSettings['dotShape']>>>,
  Assert<Equal<FieldPanelSettingValue<'volumeEnabled'>, NonNullable<EngineSettings['volumeEnabled']>>>,
  Assert<Equal<FieldPanelSettingValue<'volumeProfile'>, NonNullable<EngineSettings['volumeProfile']>>>,
  Assert<Equal<FieldPanelSettingValue<'depthPerspective'>, NonNullable<EngineSettings['depthPerspective']>>>,
  Assert<Equal<FieldPanelSettingValue<'depthOcclusion'>, NonNullable<EngineSettings['depthOcclusion']>>>,
  Assert<Equal<FieldPanelSettingValue<'vortex3d'>, NonNullable<EngineSettings['vortex3d']>>>,
  Assert<Equal<FieldPanelSettingValue<'dispersion3d'>, NonNullable<EngineSettings['dispersion3d']>>>,
  Assert<Equal<FieldPanelSettingValue<'pointerMode'>, EngineSettings['pointerMode']>>,
  Assert<Equal<FieldPanelSettingValue<'pointerClick'>, NonNullable<EngineSettings['pointerClick']>>>,
  Assert<Equal<FieldPanelSettingValue<'pointerScope'>, NonNullable<Scene['pointerScope']>>>,
  Assert<Equal<FieldPanelSettingValue<'relationalEnabled'>, EngineSettings['relationalEnabled']>>,
  Assert<Equal<FieldPanelSettingValue<'relationalMode'>, EngineSettings['relationalMode']>>,
  Assert<Equal<FieldPanelSettingValue<'frequencyDriver'>, Scene['composition']['frequencyDriver']>>,
  Assert<Equal<FieldPanelSettingValue<'autoSweep'>, EngineSettings['autoSweep']>>,
  Assert<Equal<FieldPanelSettingValue<'sweepDirection'>, EngineSettings['sweepDirection']>>,
  Assert<Equal<FieldPanelSettingValue<'templateDimension'>, NonNullable<EngineSettings['templateDimension']>>>,
  Assert<Equal<FieldPanelSettingValue<'resonatorMode'>, NonNullable<EngineSettings['resonatorMode']>>>,
  Assert<Equal<FieldPanelSettingValue<'focus'>, Scene['composition']['focus']>>,
  Assert<Equal<FieldPanelSettingValue<'focusOrder'>, NonNullable<EngineSettings['focusOrder']>>>,
  Assert<Equal<FieldPanelSettingValue<'carryTint'>, Scene['composition']['carryTint']>>,
  Assert<Equal<FieldPanelSettingValue<'carryStation'>, Scene['composition']['carryStation']>>,
  Assert<Equal<FieldPanelSettingValue<'plane'>, Scene['composition']['plane']>>,
  Assert<Equal<FieldPanelSettingValue<'autoFitSizes'>, NonNullable<EngineSettings['autoFitSizes']>>>,
];
