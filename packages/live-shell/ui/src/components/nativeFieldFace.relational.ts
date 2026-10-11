import type {FieldFaceModel} from './nativeFieldFaceModel.ts'
import {fieldValue} from './nativeFieldFaceValues.ts'

/** Relational forces: the app's Relational group as one whole device (inspector.ts:134; paramRegistry.ts:56,108-116).
 * Engine facts behind the groups: the attractor pull, swirl and chaos turbulence are shader terms that act in every
 * relational law (simulationShaders.ts 668-705, uniforms wired at GPGPUSimulator.ts 1001-1010); only the centres'
 * placement depends on the law (PointCloudField.ts 1685-1716). Enabled by engine.relationalEnabled. */
const LAW = {orbital: 'Orbital', nbody: 'N-body', chaos: 'Chaotic'} as const

export const relationalFaceModel: FieldFaceModel = {
  name: 'Relational forces',
  // Every numeric parameter of the app group, in registry order (paramRegistry.ts:56,108-116).
  paths: [
    'relational.attractorCount', 'relational.attractorGravity', 'relational.orbitSpeed', 'relational.orbitRadius', 'relational.relationalSpin',
    'relational.chaosFactor', 'relational.wanderSpeed', 'relational.gravitySoftening', 'relational.gravityFalloff', 'relational.swirlRadius',
  ],
  groups: [
    {
      title: 'Attractor law',
      paths: ['relational.attractorCount', 'relational.attractorGravity', 'relational.gravitySoftening', 'relational.gravityFalloff'],
      note: 'Each centre pulls by attractorGravity × 140000 ÷ (d² + gravitySoftening²)^gravityFalloff in every law (simulationShaders.ts 670-682). The count is capped at 10. Inert while Dynamic relational centres is off.',
    },
    {
      title: 'Placement',
      paths: ['relational.orbitSpeed', 'relational.orbitRadius', 'relational.wanderSpeed'],
      note: 'Placement depends on the law (PointCloudField.ts 1694-1716). Orbital uses speed, radius and wander drift. N-body uses speed and radius. Chaotic uses radius and wander speed. Orbit speed does nothing in Chaotic; wander speed does nothing in N-body.',
    },
    {
      title: 'Swirl and turbulence',
      paths: ['relational.relationalSpin', 'relational.swirlRadius', 'relational.chaosFactor'],
      note: 'Swirl: spin × alternating centre polarity × gaussian of distance (swirl radius), in every law (simulationShaders.ts 686-691). Turbulence (chaos factor) also acts in Orbital and N-body; the Chaotic law changes placement only (697-705).',
    },
  ],
  // Four performer controls: attractorGravity sets the strength and sign of the whole effect; orbitSpeed is the motion
  // seen and heard in the default Orbital law; relationalSpin is the whirl that is the device's signature in every law;
  // chaosFactor is the only turbulence control that acts in every law. Radii, softening and falloff are shaped in the
  // diagram and stay one step away in the expanded view.
  compact: ['relational.attractorGravity', 'relational.orbitSpeed', 'relational.relationalSpin', 'relational.chaosFactor'],
  // Not a diagram handle: the bottom slider drives spin, which no handle in the diagram uses.
  controlPath: 'relational.relationalSpin',
  studio: 'relational',
  enabled: ({scene}) => scene.engine.relationalEnabled === true,
  strip: {
    summary: ({scene}) => `${LAW[scene.engine.relationalMode ?? 'orbital'] ?? String(scene.engine.relationalMode)} · ${fieldValue(scene, 'relational.attractorCount')} centres · gravity ${fieldValue(scene, 'relational.attractorGravity')}`,
    toggle: {kind: 'panel-setting', key: 'relationalEnabled'},
  },
}
