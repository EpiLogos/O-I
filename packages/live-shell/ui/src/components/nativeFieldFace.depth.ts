import type {NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import type {FieldFaceModel} from './nativeFieldFaceModel.ts'
import {fieldValue} from './nativeFieldFaceValues.ts'

/** 3D body & depth (inspector.ts:123, studio 'volume'): the true-3D glyph body law and the perspective projection with its aerial depth. */

/** glyphVolume.* numeric controls, in registry order (paramRegistry.ts:162-171). */
export const GLYPH_VOLUME_PATHS = ['glyphVolume.depth', 'glyphVolume.wallShare', 'glyphVolume.faceBias', 'glyphVolume.interiorFill', 'glyphVolume.surfaceThickness',
  'glyphVolume.wallBand', 'glyphVolume.outsideTaper', 'glyphVolume.referenceFalloff', 'glyphVolume.densityDepth', 'glyphVolume.jitter'] as const
/** depth.* numeric controls, in registry order (paramRegistry.ts:173-180). */
export const DEPTH_PATHS = ['depth.fov', 'depth.distance', 'depth.sizeAttenuation', 'depth.sizeAttenuationCurve', 'depth.sizeDepthBias',
  'depth.aerialFade', 'depth.aerialRange', 'depth.depthTintWeight'] as const
/** The five in-diagram handles. Each drives one distinct real parameter; none is the controlPath. */
export const DEPTH_HANDLE_PATHS = ['depth.fov', 'depth.distance', 'glyphVolume.depth', 'depth.aerialRange', 'depth.sizeAttenuationCurve'] as const

/** Depth profile shape h(t), t = 0 at the contour and 1 at the medial axis. Copied from glyphVolume.ts:205-219 (depthProfile). */
export function depthProfileShape(profile: string, t: number): number {
  const c = Math.max(0, Math.min(1, t))
  switch (profile) {
    case 'bevel': return c
    case 'round': return Math.sqrt(Math.max(0, 1 - (1 - c) * (1 - c)))
    case 'dome': return Math.sqrt(c)
    case 'taper': return c * c
    case 'slab':
    default: return 1
  }
}

/** Perspective size multiplier at view depth x = viewZ / orbit distance (particleShaders.ts:357-367). The 1/w law is gated on perspective by the caller. */
export function sizeMultiplier(x: number, exponent: number, bias: number, aerialReach: number): number {
  const ratio = 1 / Math.max(1e-6, x)
  return Math.pow(Math.max(0, ratio), exponent) * (1 + bias * (0.5 - aerialDepth(x, aerialReach)))
}
/** Aerial depth in [0,1] at view depth x = viewZ / orbit distance (particleShaders.ts:353-354). */
export function aerialDepth(x: number, reach: number): number {
  const r = Math.max(0.1, reach)
  return Math.max(0, Math.min(1, (x - (1 - r)) / (2 * r)))
}
/** Ink alpha factor: mix(1, 1 - fade*v, clamp(2v)) from particleShaders.ts:455-456. */
export function inkAlpha(v: number, fade: number): number {
  const f = Math.max(0, Math.min(1, fade))
  return 1 - Math.max(0, Math.min(1, v * 2)) * f * v
}
/** Depth tint share toward the fade colour (particleShaders.ts:458-459). */
export function tintShare(v: number, weight: number): number {
  return Math.max(0, Math.min(1, weight * v))
}
/** Depth geometry gate: the body is on and has thickness (GPGPUSimulator.ts:925-928). Drives swirl/bridge depth defaults and 3D pairwise contacts. */
export function depthGeometryOn(volumeOn: boolean, bodyDepth: number): boolean {
  return volumeOn && bodyDepth > 0
}

export const depthFaceModel: FieldFaceModel = {
  name: '3D body & depth',
  paths: [...GLYPH_VOLUME_PATHS, ...DEPTH_PATHS],
  // The shell's bottom slider drives wallShare; it is a control path, not an in-diagram handle.
  controlPath: 'glyphVolume.wallShare',
  // A real owner enable exists: engine.volumeEnabled (nativeBridge.ts:99 feeds glyphVolume.enabled from it).
  enabled: ({scene}: NativeEditorReading) => scene.engine.volumeEnabled === true,
  strip: {
    summary: ({scene}: NativeEditorReading) => `${scene.engine.volumeProfile ?? 'round'} · depth ${fieldValue(scene, 'glyphVolume.depth')} · ${scene.engine.depthPerspective === true ? 'perspective' : 'orthographic'}`,
    toggle: {kind: 'panel-setting', key: 'volumeEnabled'},
  },
  groups: [
    {title: '3D body (glyphVolume)', paths: GLYPH_VOLUME_PATHS, note: 'Live only while True 3D body is on (glyphVolume.enabled = volumeEnabled, nativeBridge.ts:99). Body depth 0 collapses every glyph to a flat card (glyphVolume.ts:265).'},
    {title: 'Projection & aerial depth', paths: DEPTH_PATHS, note: 'Field of View acts only with Perspective projection on (PointCloudField.ts:695-699). Size Attenuation and its curve act only with Perspective on (particleShaders.ts:357).'},
  ],
  // Performer's four: the body thickness, the flank share that makes it read solid when turned, the front/back fade that separates depth, and the lens.
  compact: ['glyphVolume.depth', 'glyphVolume.wallShare', 'depth.aerialFade', 'depth.fov'],
  studio: 'volume',
}
