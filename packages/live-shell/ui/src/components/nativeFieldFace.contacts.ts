import type {FieldFaceModel} from './nativeFieldFaceModel.ts'
import {fieldValue} from './nativeFieldFaceValues.ts'

/** Contacts: one device over the app's two independent contact panels, 'Glyph colliders' (inspector.ts:136) and
 * 'Pairwise contacts' (inspector.ts:137). Each section has its own enable and its own solver; the device light is lit by either. */
export const contactsFaceModel: FieldFaceModel = {
  name: 'Contacts',
  groups: [
    {title: 'Glyph colliders', paths: ['collision.restitution', 'collision.friction', 'collision.band', 'collision.strength', 'collision.integrity'],
      note: 'The glyph wall is solved only while Glyph walls is on (engine.collisionEnabled).'},
    {title: 'Pairwise contacts', paths: ['pairwise.radius', 'pairwise.stiffness', 'pairwise.restitution', 'pairwise.viscosity', 'pairwise.extent'],
      note: 'Particle contacts are solved only while Particle contacts is on (engine.pairwiseEnabled) and within the sort capacity (pairwiseSchedule.ts).'},
  ],
  paths: ['collision.restitution', 'collision.friction', 'collision.band', 'collision.strength', 'collision.integrity',
    'pairwise.radius', 'pairwise.stiffness', 'pairwise.restitution', 'pairwise.viscosity', 'pairwise.extent'],
  // The bottom slider drives a stiffness value that no in-diagram handle uses, so the two never share a path.
  controlPath: 'pairwise.stiffness',
  // Two per section: the wall's bounce and reach, and the pair's contact reach and spring. These are the four values that
  // change what the diagram shows first; the friction, strength, integrity, viscosity and extent stay one row away in the groups.
  compact: ['collision.restitution', 'collision.band', 'pairwise.radius', 'pairwise.stiffness'],
  // The Studio nav entry 'collision' (shell.ts, labelled 'Collision & medium'). Pairwise has no nav entry of its own.
  studio: 'collision',
  enabled: ({scene}) => scene.engine.collisionEnabled === true || scene.engine.pairwiseEnabled === true,
  strip: {
    summary: ({scene}) => `${scene.engine.collisionMode ?? 'obstacle'} · restitution ${fieldValue(scene, 'collision.restitution')} · pairs ${fieldValue(scene, 'pairwise.restitution')}`,
    // Turning the light off clears both sections; turning it on enables only the glyph wall.
    toggle: {kind: 'field-setting', key: 'collisionEnabled', clears: 'pairwiseEnabled'},
  },
}
