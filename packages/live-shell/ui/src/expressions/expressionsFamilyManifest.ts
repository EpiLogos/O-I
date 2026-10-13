/** The one Expressions inhabitant manifest. Device families are its faces, assembled from the
 * boundary declaration and the existing pure registries. No React views are imported, and the
 * catalogue is read, never changed. `params` names the parameter-address module as a string. */
import {EXPRESSIONS_FAMILIES, type ExpressionsFamilyDeclaration, type ExpressionsFamilyScope} from '../../../../expressions-boundary/src/expressionsFamilies'
import {deviceCatalogue, type RackDevice} from '../components/nativeDeviceCatalogue.ts'
import {FIELD_FACE_MODELS} from '../components/nativeFieldFaceModel.ts'
import {ENTITY_FACE_MODELS} from '../components/nativeEntityFaceModel.ts'
import {SCENE_FACE_MODELS} from '../components/nativeSceneFaceModel.ts'
import {holdersOfFace, validateFaceSemantic, validateHolderCoverage, type LiveSemantic, type SemanticInvariant} from '../inhabitants/sdk/semantics.ts'

export type ExpressionsBrowserCategory = 'works' | 'material' | 'objects' | 'properties' | 'devices'
export type ExpressionsFaceRegistry = 'field' | 'entity' | 'scene' | 'bespoke'

export interface ExpressionsFace {
  readonly id: string
  readonly scope: ExpressionsFamilyScope
  readonly faced: boolean
  readonly repeatable: boolean
  readonly registry: ExpressionsFaceRegistry | null
  readonly studio: string | null
  readonly paths: readonly string[]
  /** The Live semantic the face occupies (DEVICE-SEMANTICS-LOCK §1, §2.4, §5). */
  readonly liveSemantic: LiveSemantic
  readonly invariant?: SemanticInvariant
  /** The one holder that holds the face: its Studio section, or the Clip detail (lock §4.8; semantics.ts holdersOfFace). */
  readonly heldBy: readonly string[]
}

/** The Expressions faces' Live semantics (DEVICE-SEMANTICS-LOCK §2.4, §4.8, §9; lead's ruling 13 Oct 2026, T-SEMANTICS-GATE).
 * The physics simulation is the sounding instrument (M1 generates); glyph is its visual side and sound its entity
 * voices — both generate through the native expression owner. The field and entity devices transform the material in
 * focus and keep the stream (effects on the instrument). Resonance (M2, the ☿ key) and Body 3:3 modulate the
 * instrument — they never generate (QL-MEF D13: M2 is never a second generator). Automation is the scene's
 * parameter courses. A scene is a clip: an Expression's scene at its document revision (lock §9.1). */
const GENERATES = 'kernel:native_expression'
export const EXPRESSIONS_FACE_SEMANTICS: Readonly<Record<string, {readonly liveSemantic: LiveSemantic; readonly invariant?: SemanticInvariant}>> = {
  glyph: {liveSemantic: 'device-instrument', invariant: {generates: GENERATES}},
  physics: {liveSemantic: 'device-instrument', invariant: {generates: GENERATES}},
  sound: {liveSemantic: 'device-instrument', invariant: {generates: GENERATES}},
  pointer: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'the field under the pointer (attract, repel, trace) — the field plays on'}},
  relational: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'the field\'s relational forces between entities'}},
  medium: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'the medium the field moves in (drag, density)'}},
  contacts: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'the field\'s contacts and collisions'}},
  morph: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'the field\'s form between shapes'}},
  focus: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'what the field brings into focus'}},
  colour: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'the field\'s colour'}},
  ink: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'the field\'s ink (trails and marks)'}},
  depth: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'the field\'s depth'}},
  resonance: {liveSemantic: 'modulation'},
  automation: {liveSemantic: 'automation'},
  formation: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'an entity\'s formation'}},
  force: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'the forces on an entity'}},
  scene: {liveSemantic: 'clip', invariant: {material: 'the Expression\'s scene (the native expression document)', revision: 'the expression document revision (kernel:expression)', states: ['stopped', 'playing', 'queued', 'recording']}},
  meaning: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'an entity\'s meaning binding'}},
  text: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'the scene\'s text'}},
  body: {liveSemantic: 'modulation'},
  blueprint: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'the scene\'s form blueprint'}},
  arrange: {liveSemantic: 'device-audio-fx', invariant: {transforms: 'the scene\'s arrangement of entities'}},
}

function semanticOf(id: string): {liveSemantic: LiveSemantic; invariant?: SemanticInvariant} {
  const declared = EXPRESSIONS_FACE_SEMANTICS[id]
  if (!declared) throw new Error(`Expressions face "${id}" declares no Live semantic (DEVICE-SEMANTICS-LOCK §5.1) — add it to EXPRESSIONS_FACE_SEMANTICS.`)
  return declared
}

export interface ExpressionsManifest {
  readonly id: 'expressions'
  /** Browser categories this family already occupies in WorldBrowser. */
  readonly browser: readonly ExpressionsBrowserCategory[]
  readonly faces: readonly ExpressionsFace[]
  readonly params: {readonly grammar: 'parameterAddress.ts'}
  readonly projections: readonly ['expressions-track-adapter']
  readonly inspectors: readonly ['rack', 'device-pool', 'GlyphSequenceEditor']
  readonly time: {readonly consumes: 'Transport'; readonly contributes: readonly ['scenes', 'automation', 'takes']}
  readonly telemetry: 'observation.effectiveValues'
}

const has = (models: object, family: string) => Object.prototype.hasOwnProperty.call(models, family)

const registryOf = (family: string, catalogued: boolean): ExpressionsFaceRegistry | null => {
  if (has(FIELD_FACE_MODELS, family)) return 'field'
  if (has(ENTITY_FACE_MODELS, family)) return 'entity'
  if (has(SCENE_FACE_MODELS, family)) return 'scene'
  // Morph, Colour and Force are catalogued but built by their own hosts, not by a registry.
  return catalogued ? 'bespoke' : null
}

function faceOf(declaration: ExpressionsFamilyDeclaration, device: RackDevice | undefined): ExpressionsFace {
  return {
    id: declaration.id,
    scope: declaration.scope,
    faced: declaration.faced,
    repeatable: declaration.repeatable,
    registry: registryOf(declaration.id, device !== undefined),
    studio: device?.studio ?? null,
    paths: device ? [...device.paths] : [],
    heldBy: holdersOfFace('expressions', declaration.id),
    ...semanticOf(declaration.id),
  }
}

/** One Expressions manifest. The same declaration and registries give the same faces.
 * The Live semantic gate runs over its faces here (lock §4.8: every face is held by exactly one holder; §5). */
export function expressionsFamilyManifest(): ExpressionsManifest {
  const catalogue = new Map(deviceCatalogue().map(device => [device.family, device] as const))
  const faces = EXPRESSIONS_FAMILIES.map(declaration => faceOf(declaration, catalogue.get(declaration.id)))
  const faults = [
    ...faces.flatMap(face => validateFaceSemantic(face, {family: 'expressions'})),
    ...validateHolderCoverage('expressions', faces),
  ]
  if (faults.length) {
    throw new Error(`Expressions family refuses — the Live semantic law (DEVICE-SEMANTICS-LOCK §4.8, §5):\n- ${faults.join('\n- ')}`)
  }
  return {
    id: 'expressions',
    browser: ['works', 'material', 'objects', 'properties', 'devices'],
    faces,
    params: {grammar: 'parameterAddress.ts'},
    projections: ['expressions-track-adapter'],
    inspectors: ['rack', 'device-pool', 'GlyphSequenceEditor'],
    time: {consumes: 'Transport', contributes: ['scenes', 'automation', 'takes']},
    telemetry: 'observation.effectiveValues',
  }
}
