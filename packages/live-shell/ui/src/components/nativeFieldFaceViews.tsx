import type {ReactNode} from 'react'
import type {NativeEditorChange, NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import type {Apply, CaptureCurrent} from './nativeDeviceCustody'
import type {FIELD_FACE_MODELS} from './nativeFieldFaceModel.ts'
import {physicsFaceView} from './NativeFieldFace.physics.tsx'
import {mediumFaceView} from './NativeFieldFace.medium.tsx'
import {resonanceFaceView} from './NativeFieldFace.resonance.tsx'
import {contactsFaceView} from './NativeFieldFace.contacts.tsx'
import {inkFaceView} from './NativeFieldFace.ink.tsx'
import {depthFaceView} from './NativeFieldFace.depth.tsx'
import {relationalFaceView} from './NativeFieldFace.relational.tsx'
import {pointerFaceView} from './NativeFieldFace.pointer.tsx'
import {focusFaceView} from './NativeFieldFace.focus.tsx'

/** family, disabled, apply, captureCurrent and setDraft are the NativeFieldHandle inputs; setDraft mirrors a live handle value by path. */
export interface FieldFaceDrawContext {reading: NativeEditorReading; graphValue: number; position: number; value: (path: string) => number | undefined
  family: string; disabled: boolean; apply: Apply; captureCurrent: CaptureCurrent; setDraft: (path: string, value: number | null) => void}
export interface FieldFaceSwitchContext {reading: NativeEditorReading; disabled: boolean; apply: (changes: readonly NativeEditorChange[]) => Promise<unknown>}
/** Source-bound drawing and the family's own switches; the editor shell keeps the surface, custody and pointers. */
export interface FieldFaceView {draw: (ctx: FieldFaceDrawContext) => ReactNode; switches?: (ctx: FieldFaceSwitchContext) => ReactNode}
export const FIELD_FACE_VIEWS: Record<keyof typeof FIELD_FACE_MODELS, FieldFaceView> = {
  physics: physicsFaceView,
  medium: mediumFaceView,
  resonance: resonanceFaceView,
  contacts: contactsFaceView,
  ink: inkFaceView,
  depth: depthFaceView,
  relational: relationalFaceView,
  pointer: pointerFaceView,
  focus: focusFaceView,
}
