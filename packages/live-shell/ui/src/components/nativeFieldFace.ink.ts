import type {FieldFaceModel} from './nativeFieldFaceModel.ts'
import type {NativeGlyphChange} from '../../../../expressions-boundary/src/editor'
import {fieldValue} from './nativeFieldFaceValues.ts'

/** Field font weights the glyph panel offers: the native engine accepts the 100–900 CSS range (parityUI.ts:40-42). The host validator
 * admits any integer 1–1000 (hostEditor.ts applyNativeGlyphChanges), so every option here is admitted. */
export const FIELD_FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const

/** One admitted glyph change per choice: the Field typeface stack (hostEditor.ts fontFamily rule) or the Field weight. */
export const fontChange = (fontFamily: string): NativeGlyphChange => ({kind: 'field-font', values: {fontFamily}})
export const weightChange = (fontWeight: number): NativeGlyphChange => ({kind: 'field-font', values: {fontWeight}})

/** Mark profile (device key `ink`). The whole app panel: the shared-field size and opacity above it (inspector.ts:115),
 * then the Mark profile group (inspector.ts:122): count, min size and the material group, with its nested Glyph sampling.
 * paperGrain is the Colour panel's (paramRegistry 'Paper'), so it is not here. */
export const inkFaceModel: FieldFaceModel = {
  name: 'Particles',
  paths: [
    'particleSize.max', 'material.opacity',
    'particleCount', 'particleSize.min', 'material.sizeBias', 'material.roundness', 'material.softness', 'material.irregularity',
    'material.elongation', 'material.orientation', 'material.contrast', 'material.densityScale', 'material.densityPhase',
    'material.edgeWeight', 'material.halo',
  ],
  controlPath: 'material.opacity',
  // No separate owner enable: Extended grain profile is a profile choice, not a device light, so the light stays hollow.
  enabled: () => undefined,
  strip: {
    summary: ({scene}) => `${fieldValue(scene, 'particleCount')} particles · ${fieldValue(scene, 'particleSize.min')}–${fieldValue(scene, 'particleSize.max')} px`,
    toggle: null,
  },
  groups: [
    {title: 'Size and opacity', paths: ['particleSize.max', 'material.opacity'], note: 'Shared-field controls the app places above the mark profile (inspector.ts:115).'},
    {
      title: 'Mark profile',
      paths: [
        'particleCount', 'particleSize.min', 'material.sizeBias', 'material.roundness', 'material.softness', 'material.irregularity',
        'material.elongation', 'material.orientation', 'material.contrast', 'material.densityScale', 'material.densityPhase',
        'material.edgeWeight', 'material.halo',
      ],
      note: 'The material rows are read only while Extended grain profile is on (particleShaders.ts uGrainEnabled); the app disables them when it is off (inspector.ts:37).',
    },
  ],
  // Four performer controls: the size law (sizeBias), the mark shape (roundness), the edge (softness) and the top of the size range
  // (particleSize.max). Opacity is the bottom slider (controlPath) and is not repeated; count and min size are structural.
  compact: ['material.sizeBias', 'material.roundness', 'material.softness', 'particleSize.max'],
  // Expressions Studio section that holds this panel: 'Colour & material' (shell.ts:17), the field tab that carries Mark profile.
  studio: 'appearance',
}
