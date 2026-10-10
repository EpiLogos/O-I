import type {FieldFaceModel} from './nativeFieldFaceModel.ts'
import {fieldValue} from './nativeFieldFaceValues.ts'

// The app's own Physics panel: desktop/cradle/expressions-app/field-studies-journeys/src/inspector.ts:124.
// Its numeric parameters are the registry groups 'Fluid' (motion) and 'Physics+' (physics), in registry order
// (desktop/cradle/expressions-app/src/engine/paramRegistry.ts:59-78). The panel's medium plane select is a
// field-setting in the view; Pause physics, Disperse and Reset are runtime actions and are disclosed there.
const FLUID = ['fluid.returnSpeed', 'fluid.viscosity', 'fluid.vortexStrength', 'fluid.curlScale', 'fluid.curlSpeed', 'fluid.turbulence', 'fluid.dispersion'] as const
const PHYSICS_PLUS = ['fluid.snapRigidity', 'fluid.densityTether', 'fluid.curlDepth', 'fluid.vortexRadius', 'fluid.gravityX', 'fluid.gravityY', 'fluid.gravityZ',
  'fluid.quadraticDrag', 'fluid.thermalJitter', 'fluid.maxSpeed', 'fluid.zConfinement', 'fluid.timeScale'] as const

/** Physics: the whole app panel as one device. It has no enable operation of its own (mediumEnabled gates no fluid term), so the light is unknown and the card has no toggle. */
export const physicsFaceModel: FieldFaceModel = {
  name: 'Physics',
  paths: [...FLUID, ...PHYSICS_PLUS],
  groups: [
    // Curl Scale sets the noise cell of the curl term (simulationShaders.ts:572). Return Spring is scaled by Snap Rigidity and Density Tether below.
    {title: 'Fluid', paths: FLUID, note: 'Curl Scale sets the curl noise cell (simulationShaders.ts:572). Viscosity and drag act on each simulation step.'},
    // The return spring is Return Spring x Snap Rigidity x Density Tether (simulationShaders.ts:558-565). Time Scale sets steps per frame (PointCloudField.ts:1333-1339).
    {title: 'Physics+', paths: PHYSICS_PLUS, note: 'Snap Rigidity and Density Tether scale the return spring (simulationShaders.ts:558-565). Time Scale sets steps per frame.'},
  ],
  // Four controls for the rack, chosen for performance: viscosity (how long a gesture lingers), vortexStrength (the swirl; also the bottom slider),
  // gravityY (the one bias a performer reads as down on the Stage) and timeScale (the pace, and the only control that can hold the field).
  compact: ['fluid.viscosity', 'fluid.vortexStrength', 'fluid.gravityY', 'fluid.timeScale'],
  controlPath: 'fluid.vortexStrength',
  enabled: () => undefined,
  strip: {
    summary: ({scene}) => `viscosity ${fieldValue(scene, 'fluid.viscosity')} · vortex ${fieldValue(scene, 'fluid.vortexStrength')}`,
    toggle: null,
  },
  studio: 'physics',
}
