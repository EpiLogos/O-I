import type {FieldFaceModel} from './nativeFieldFaceModel.ts'
import {fieldValue} from './nativeFieldFaceValues.ts'

/** Pointer (app inspector.ts:125, Studio section 'pointer'): the Interact force and the click effect as one device.
 * Six numeric interaction parameters plus the scope, mode and click-effect switches. The app discloses no enable
 * operation for the pointer, so the light is unknown and the card has no toggle. */
export const pointerFaceModel: FieldFaceModel = {
  name: 'Pointer',
  paths: ['interaction.clickStrength', 'interaction.clickRadius', 'interaction.radius', 'interaction.strength', 'interaction.velocityInfluence', 'interaction.falloffPower'],
  // Four handles take radius, strength, clickRadius and falloffPower, so the bottom slider takes velocityInfluence.
  controlPath: 'interaction.velocityInfluence',
  enabled: () => undefined,
  groups: [
    {title: 'Click effect', paths: ['interaction.clickStrength', 'interaction.clickRadius'], note: 'A click fires the chosen click effect at its own strength and radius (app.ts firePointerClick).'},
    {title: 'Pointer', paths: ['interaction.radius', 'interaction.strength', 'interaction.velocityInfluence', 'interaction.falloffPower'], note: 'Active only with Interact. Radius and falloff shape the disc; strength sets amount and sign; velocity inject scales the mouse-velocity term inside the disc (GPGPUSimulator.ts:1065, simulationShaders.ts:736).'},
  ],
  // Compact, justified: radius and strength are the reach and the amount and sign of the held force; falloff sets how
  // that force fades across the disc; clickStrength is the punch of a click. clickRadius and velocityInfluence stay in
  // the expanded panel.
  compact: ['interaction.radius', 'interaction.strength', 'interaction.falloffPower', 'interaction.clickStrength'],
  studio: 'pointer',
  strip: {
    summary: ({scene}) => `${scene.engine.pointerMode} · r ${fieldValue(scene, 'interaction.radius')} · strength ${fieldValue(scene, 'interaction.strength')}`,
    toggle: null,
  },
}
