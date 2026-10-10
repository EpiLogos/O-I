/** Scene blueprint edits the shell may propose: bind the sixfold roles, set the
 * whole transform, release. Pure: no store, clock, owner or network.
 *
 * Routing. The shell sends `{operation:'blueprint', basis, intent}` through the
 * editor channel. The host (hostEditor.ts) resolves the exact native binding for
 * a bind (readSceneBlueprint: the shell never supplies frame, digest or member
 * refs), turns a transform's display values into native units with the app's
 * own law (blueprintHUD.ts blueprintTransformIntent), preflights the native edit
 * (prepareBlueprintEdit), and only then hands one intent to the owner's CAS
 * edit (nativeWorkspace.blueprint). One gesture, one native operation.
 *
 * Display units are the blueprint HUD's: position in stage units (native / 400),
 * rotation in degrees, relative size (native scale / 110). The constants below
 * are copies of the app's, each pinned by tests/native-device-blueprint.test.mjs
 * against the source file it names. */
import type {BlueprintTransform} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/blueprintGeometry';
import type {NativeEditorBasis} from './editor';

/** nativeParameters.ts WORLD_SCALE: native world units per stage unit. */
export const BLUEPRINT_WORLD_SCALE = 400;
/** blueprintHUD.ts BASE_SIZE: native scale of relative size 1. */
export const BLUEPRINT_BASE_SIZE = 110;
/** blueprintGeometry.ts validateBlueprint: native translation |v| <= 1600, rotation |v| <= 1000 radians, scale 0.01 to 1600. */
const NATIVE_TRANSLATION_LIMIT = 1600;
const NATIVE_ROTATION_LIMIT = 1000;
const NATIVE_SCALE_RANGE = [0.01, 1600] as const;
/** Display bounds, derived from the native limits above. Position in stage units. */
export const BLUEPRINT_POSITION_RANGE = [-NATIVE_TRANSLATION_LIMIT / BLUEPRINT_WORLD_SCALE, NATIVE_TRANSLATION_LIMIT / BLUEPRINT_WORLD_SCALE] as const;
/** Rotation in degrees. The HUD has no rotation input bound, so the native radian limit is the admitted range. */
export const BLUEPRINT_ROTATION_RANGE = [-NATIVE_ROTATION_LIMIT * 180 / Math.PI, NATIVE_ROTATION_LIMIT * 180 / Math.PI] as const;
/** Relative size: the HUD's size input minimum (blueprintHUD.ts `min="0.0001"`), and the native scale ceiling over BASE_SIZE. */
export const BLUEPRINT_SIZE_RANGE = [0.0001, NATIVE_SCALE_RANGE[1] / BLUEPRINT_BASE_SIZE] as const;

/** The six sixfold sites, by QL position 0 to 5: sites[].xyz of kernel/src/expression_blueprint_sixfold.json (drift-tested). */
export const BLUEPRINT_SITES: readonly (readonly [number, number, number])[] = [
  [0, -1, 0],
  [0.8660254037844386, -0.5, 0],
  [0.8660254037844386, 0.5, 0],
  [0, 1, 0],
  [-0.8660254037844386, 0.5, 0],
  [-0.8660254037844386, -0.5, 0],
];

/** Display transform as the panel holds it. Position is in stage units, rotation in degrees, size relative. */
export interface BlueprintDisplayTransform {
  translation: readonly [number, number, number];
  rotationDegrees: readonly [number, number, number];
  size: number;
}

/** The app's transform, in its own units: blueprintGeometry.ts BlueprintTransform. */
export function blueprintDisplayOf(transform: BlueprintTransform): BlueprintDisplayTransform {
  return {
    translation: transform.translation.map(value => value / BLUEPRINT_WORLD_SCALE) as unknown as [number, number, number],
    rotationDegrees: transform.rotation.map(value => value * 180 / Math.PI) as unknown as [number, number, number],
    size: transform.scale / BLUEPRINT_BASE_SIZE,
  };
}

/** blueprintHUD.ts blueprintTransformIntent's unit law, exactly: stage to native translation, degrees to radians, size to scale. */
export function blueprintNativeOf(display: BlueprintDisplayTransform): BlueprintTransform {
  return {
    translation: display.translation.map(value => value * BLUEPRINT_WORLD_SCALE) as unknown as [number, number, number],
    rotation: display.rotationDegrees.map(value => value * Math.PI / 180) as unknown as [number, number, number],
    scale: display.size * BLUEPRINT_BASE_SIZE,
  };
}

/** blueprintGeometry.ts blueprintPosition, in the same order (rotate X, then Y, then Z; scale; translate). Native units. */
export function blueprintSitePoint(position: number, transform: BlueprintTransform): [number, number, number] {
  const site = BLUEPRINT_SITES[position];
  if (!Number.isInteger(position) || !site) throw Error('This role has no supplied QL position');
  let [x, y, z] = site;
  const [rx, ry, rz] = transform.rotation;
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  return [x, y, z].map((v, i) => v * transform.scale + transform.translation[i]) as [number, number, number];
}

/** One bounded finite number. The message names the label and its admitted range. */
export function blueprintNumber(value: unknown, [min, max]: readonly [number, number], label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw Error(`${label} must be between ${round(min)} and ${round(max)}`);
  return value;
}
const round = (value: number) => Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(6)));

const AXES = ['X', 'Y', 'Z'] as const;
function triple(value: unknown, group: string, range: readonly [number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) throw Error(`${group} is three values, X, Y and Z`);
  return [0, 1, 2].map(index => blueprintNumber(value[index], range, `${group} ${AXES[index]}`)) as [number, number, number];
}
function closed(value: object, allowed: readonly string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw Error('Unsupported blueprint operand');
}

/** The blueprint intents the shell may send. A bind carries no payload: the host reads the assigned native roles. */
export type NativeBlueprintIntent =
  | {operation: 'bind'}
  | {operation: 'release'}
  | {operation: 'transform'; translation: [number, number, number]; rotation_degrees: [number, number, number]; size: number};
export interface NativeBlueprintRequest {operation: 'blueprint'; basis: NativeEditorBasis; intent: NativeBlueprintIntent}

/** Validates one blueprint intent: its operation, its exact operands and each bound. Throws the refusal the panel shows. */
export function validateBlueprintIntent(value: unknown): NativeBlueprintIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Supply one named blueprint intent');
  const intent = value as Record<string, unknown>;
  switch (intent.operation) {
    case 'bind':
    case 'release':
      closed(intent, ['operation']);
      return {operation: intent.operation};
    case 'transform':
      closed(intent, ['operation', 'translation', 'rotation_degrees', 'size']);
      return {
        operation: 'transform',
        translation: triple(intent.translation, 'Position', BLUEPRINT_POSITION_RANGE),
        rotation_degrees: triple(intent.rotation_degrees, 'Rotation', BLUEPRINT_ROTATION_RANGE),
        size: blueprintNumber(intent.size, BLUEPRINT_SIZE_RANGE, 'Relative size'),
      };
    default: throw Error('Blueprint operations are bind, transform or release');
  }
}

/** One exact-value field's text, parsed against its bound. A problem keeps the value out of any request. */
export function blueprintFieldValue(raw: string, range: readonly [number, number], label: string): {value: number; problem: null} | {value: null; problem: string} {
  const text = raw.trim(), value = text === '' ? NaN : Number(text);
  try {return {value: blueprintNumber(value, range, label), problem: null};}
  catch (cause) {return {value: null, problem: cause instanceof Error ? cause.message : String(cause)};}
}
