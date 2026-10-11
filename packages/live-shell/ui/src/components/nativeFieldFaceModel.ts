import type {NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {physicsFaceModel} from './nativeFieldFace.physics.ts'
import {mediumFaceModel} from './nativeFieldFace.medium.ts'
import {resonanceFaceModel} from './nativeFieldFace.resonance.ts'
import {contactsFaceModel} from './nativeFieldFace.contacts.ts'
import {inkFaceModel} from './nativeFieldFace.ink.ts'
import {depthFaceModel} from './nativeFieldFace.depth.ts'
import {relationalFaceModel} from './nativeFieldFace.relational.ts'
import {pointerFaceModel} from './nativeFieldFace.pointer.ts'
import {focusFaceModel} from './nativeFieldFace.focus.ts'

export {fieldValue, short} from './nativeFieldFaceValues.ts'
export type StripToggle =
  | {kind: 'field-setting'; key: 'mediumEnabled' | 'resonanceEnabled' | 'collisionEnabled'; /** Also cleared when the light is turned off, so the light and the flags cannot disagree. */ clears?: 'pairwiseEnabled'}
  | {kind: 'morph-setting'; key: 'morphEnabled'}
  | {kind: 'colour-setting'; key: 'colorEnabled'}
  | {kind: 'panel-setting'; key: 'relationalEnabled' | 'volumeEnabled'}
/** Pure per-family facts for one native Field device: controls, slider path, enable light and device-chain card. No React, no commits. */
export interface FieldFaceModel {
  name: string
  paths: readonly string[]            // exact-value controls, in order
  controlPath: string                 // the one native path the SVG slider handle drives
  /** true/false = enable light; undefined = no enable operation disclosed */
  enabled: (reading: NativeEditorReading) => boolean | undefined
  strip: {summary: (reading: NativeEditorReading) => string; toggle: StripToggle | null}
  /** Coupled parameter groups in the app's own panel order; every group shows together under its title. Covers `paths` exactly. */
  groups?: readonly {title: string; paths: readonly string[]; note?: string}[]
  /** At most four default controls for the compact rack widget. Parameters stay live whether or not a widget is on the rack. */
  compact?: readonly string[]
  /** The Expressions Studio section this panel opens in the full view (app shell.ts nav id). */
  studio?: string
}
export const FIELD_FACE_MODELS = {
  physics: physicsFaceModel,
  medium: mediumFaceModel,
  resonance: resonanceFaceModel,
  contacts: contactsFaceModel,
  ink: inkFaceModel,
  depth: depthFaceModel,
  relational: relationalFaceModel,
  pointer: pointerFaceModel,
  focus: focusFaceModel,
} as const satisfies Record<string, FieldFaceModel>
