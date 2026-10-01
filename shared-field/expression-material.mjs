/** Audience admission for the application's existing oi.journey-scene/v1.
 * This is a disclosure boundary, not a second material language or renderer.
 * Native original/config, live-world receipts, tools and unknown extensions
 * never travel. The author explicitly selects scene material before admission.
 */
import {validateJourney} from '../packages/oi-design-system/expressions-engine/shell/model.mjs';

const scalar = null;
const vec = {x: scalar, y: scalar, z: scalar};
const source = {kind: scalar, ascii: {text: scalar, fontFamily: scalar, fontSize: scalar, invert: scalar}, image: {name: scalar, dataUrl: scalar, mode: scalar, threshold: scalar, scale: scalar, invert: scalar}};
const objectState = {size: {x: scalar, y: scalar}, rotation: scalar, scale: scalar, tint: scalar, tintWeight: scalar, force: {kind: scalar, strength: scalar, radius: scalar, spin: scalar}};
const form = {id: scalar, name: scalar, kind: scalar, enabled: scalar, position: vec, ...objectState, shape: scalar, text: scalar, share: scalar, locked: scalar, station: scalar, role: scalar, source,
  yantraId: scalar, templateFrequency: scalar, templateGeometry: scalar, templateDimension: scalar,
  layers: [{id: scalar, text: scalar, z: scalar, scale: scalar, source}],
  sequence: {sourcesVersion: scalar, enabled: scalar, clock: scalar, manual: scalar, hold: scalar, transition: scalar, order: scalar, easing: scalar, jitter: scalar, impulse: scalar, rateMul: scalar, phaseOffset: scalar,
    steps: [{id: scalar, name: scalar, text: scalar, shape: scalar, hold: scalar, transition: scalar, position: vec, source, objectState, holdOverride: scalar, transitionOverride: scalar, yantraId: scalar, templateFrequency: scalar, templateGeometry: scalar, templateDimension: scalar}]}};
const keys = names => Object.fromEntries(names.split(' ').map(key => [key, scalar]));
const sceneShape = {
  ...keys('id name character duration transition pointerScope'),
  view: keys('mode yaw pitch zoom panX panY'),
  field: {background: scalar, palette: [scalar], material: scalar, params: keys('count size sizeBias opacity roundness softness irregularity elongation orientation contrast densityScale densityPhase edgeWeight halo speed circulation turbulence turbulenceScale recovery dispersion pointerStrength pointerRadius pointerFalloff depth grain snapRigidity densityTether curlDepth vortexRadius gravityX gravityY gravityZ quadraticDrag thermalJitter speedLimit zConfinement timeScale gravitySoftening gravityFalloff swirlRadius frequency dominance excitation')},
  engine: keys('inkMode paletteId templateGeometry templateDimension paletteSource grainProfile backgroundMode resonatorMode focusOrder resonanceEnabled morphEnabled trajectory driveShape autoOscillate relationalEnabled relationalMode pointerMode pointerClick pointerClickStrength pointerClickRadius colorMode colorEnabled dotShape autoFitSizes mediumEnabled collisionEnabled collisionMode pairwiseEnabled fontFamily fontWeight mediumPlane mediumDimension autoSweep sweepDirection volumeEnabled volumeProfile depthPerspective depthOcclusion vortex3d dispersion3d depthTintColor'),
  entities: [form],
  text: [keys('id visible kicker title italic body x y width size align role')],
  composition: keys('layout plane focus focusDuration focusDwell carryTint carryStation frequencyDriver'),
  morph: keys('thetaRate phiRate thetaOffset phiOffset law depth dwell'),
  automation: [keys('id enabled target type wave min max rate phase blend duration delay loop firedAt easing clockId syncWith entityId')],
};

function admitted(value, shape, path, strict, omissions, depth = 0) {
  if (depth > 24) throw new TypeError('Scene material nesting exceeds admission limit');
  if (value == null) return value;
  if (shape === null) {
    if (!['string', 'number', 'boolean'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value)) throw new TypeError(`Unsupported material value at ${path}`);
    return value;
  }
  if (Array.isArray(shape)) {
    if (!Array.isArray(value) || value.length > 256) throw new TypeError(`Invalid material array at ${path}`);
    return value.map((item, index) => admitted(item, shape[0], `${path}[${index}]`, strict, omissions, depth + 1));
  }
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid material object at ${path}`);
  const next = {};
  for (const [key, item] of Object.entries(value)) {
    if (!Object.hasOwn(shape, key)) {
      if (strict) throw new TypeError(`Unsupported material key at ${path}.${key}`);
      omissions.push(`${path}.${key}`);
    } else next[key] = admitted(item, shape[key], `${path}.${key}`, strict, omissions, depth + 1);
  }
  return next;
}

/** Publish mode reports omissions; receiver mode refuses any unadmitted byte. */
export function admitSceneMaterial(presentation, sceneRef, entityRefs, {strict = false} = {}) {
  if (presentation?.schema !== 'oi.journey-scene/v1') throw new TypeError('Unsupported native scene presentation');
  if (strict && Object.keys(presentation).some(key => !['schema', 'scene'].includes(key))) throw new TypeError('Unsupported scene presentation key');
  const omissions = [];
  const scene = admitted(presentation.scene, sceneShape, 'scene', strict, omissions);
  if (scene.id !== sceneRef) throw new TypeError('Native scene occurrence does not match scene_ref');
  const ids = scene.entities?.map(entity => entity.id) ?? [];
  if (new Set(ids).size !== ids.length || new Set(entityRefs).size !== entityRefs.length || ids.length !== entityRefs.length || ids.some(id => !entityRefs.includes(id))) throw new TypeError('Required native body occurrences do not match the scene membership');
  if (JSON.stringify(scene).length > 1_048_576) throw new TypeError('Scene material exceeds admission byte limit');
  // The actual author's validator owns validity. No renderer-local inference.
  const checked = validateJourney({schema: 'oi.journey', version: 1, id: 'shared-scene-admission', name: 'Shared scene', description: '', loop: true, updatedAt: '1970-01-01T00:00:00.000Z', scenes: [scene]}).scenes[0];
  // The validator may supply authoring workspace defaults. Those aren't public
  // material; filter its output through the same disclosure aperture.
  return {presentation: {schema: 'oi.journey-scene/v1', scene: admitted(checked, sceneShape, 'scene', false, omissions)}, omissions};
}
