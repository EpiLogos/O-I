/** The one Expressions inhabitant manifest. Device families are its faces, assembled from the
 * boundary declaration and the existing pure registries. No React views are imported, and the
 * catalogue is read, never changed. `params` names the parameter-address module as a string. */
import {EXPRESSIONS_FAMILIES, type ExpressionsFamilyDeclaration, type ExpressionsFamilyScope} from '../../../../expressions-boundary/src/expressionsFamilies'
import {deviceCatalogue, type RackDevice} from '../components/nativeDeviceCatalogue.ts'
import {FIELD_FACE_MODELS} from '../components/nativeFieldFaceModel.ts'
import {ENTITY_FACE_MODELS} from '../components/nativeEntityFaceModel.ts'
import {SCENE_FACE_MODELS} from '../components/nativeSceneFaceModel.ts'

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
  }
}

/** One Expressions manifest. The same declaration and registries give the same faces. */
export function expressionsFamilyManifest(): ExpressionsManifest {
  const catalogue = new Map(deviceCatalogue().map(device => [device.family, device] as const))
  return {
    id: 'expressions',
    browser: ['works', 'material', 'objects', 'properties', 'devices'],
    faces: EXPRESSIONS_FAMILIES.map(declaration => faceOf(declaration, catalogue.get(declaration.id))),
    params: {grammar: 'parameterAddress.ts'},
    projections: ['expressions-track-adapter'],
    inspectors: ['rack', 'device-pool', 'GlyphSequenceEditor'],
    time: {consumes: 'Transport', contributes: ['scenes', 'automation', 'takes']},
    telemetry: 'observation.effectiveValues',
  }
}
