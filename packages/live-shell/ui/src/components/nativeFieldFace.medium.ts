import type {FieldFaceModel} from './nativeFieldFaceModel.ts'
import {fieldValue} from './nativeFieldFaceValues.ts'

/** Shared Medium: enabled by the medium flag; the card toggles that flag. */
export const mediumFaceModel: FieldFaceModel = {
  name: 'Shared Medium',
  paths: ['medium.pressure', 'medium.coupling', 'medium.persistence', 'medium.iterations', 'medium.gridRes', 'medium.splatGain', 'medium.extent'],
  controlPath: 'medium.coupling',
  // The app holds these seven in one panel, 'Shared collision medium' (inspector.ts:135); the medium plane lives in Physics.
  groups: [{title: 'Shared collision medium', paths: ['medium.pressure', 'medium.coupling', 'medium.persistence', 'medium.iterations', 'medium.gridRes', 'medium.splatGain', 'medium.extent']}],
  // Performer-facing solver terms. Grid resolution, iterations and extent set solver cost and size, so they stay in the expanded panel.
  compact: ['medium.pressure', 'medium.coupling', 'medium.persistence', 'medium.splatGain'],
  studio: 'collision',
  enabled: ({scene}) => scene.engine.mediumEnabled === true,
  strip: {
    summary: ({scene}) => `pressure ${fieldValue(scene, 'medium.pressure')} · coupling ${fieldValue(scene, 'medium.coupling')}`,
    toggle: {kind: 'field-setting', key: 'mediumEnabled'},
  },
}
