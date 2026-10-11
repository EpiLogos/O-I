/** Expression-shared Field parameters (legacy app.ts 'toggle-global', the globe
 * button on each Field control). The app's own helper, sharedSettings.ts
 * toggleShared, performs the move: sharing copies the Scene's effective value
 * into Journey.shared.values, and un-sharing copies the shared value back into
 * every Scene. This module only admits which parameters may be toggled and
 * names the change. Pointer paths are excluded: their scope is the
 * pointer-scope panel setting (panel-setting key=pointerScope). */
import {NATIVE_BINDINGS, type NativeBinding} from './parameters';
import {globalPath, isShared, POINTER_PATHS} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sharedSettings';
import type {Journey, Scene} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';

/** Registry Field parameters whose bind path the app lets be shared across the Expression. */
export const SHAREABLE_FIELD_BINDINGS: readonly NativeBinding[] = NATIVE_BINDINGS.filter(binding =>
  globalPath(binding.bind) && !POINTER_PATHS.includes(binding.bind) && Number.isFinite(binding.defaultValue));

/** The admitted target of a shared-setting change: 'field.<key>', exactly as the Field parameter targets. */
export const sharedFieldTarget = (binding: Pick<NativeBinding, 'key'>) => 'field.' + binding.key;

/** The binding named by a shared-setting target, or undefined when the app does not let it be shared. */
export function sharedFieldBinding(target: unknown): NativeBinding | undefined {
  if (typeof target !== 'string') return undefined;
  return SHAREABLE_FIELD_BINDINGS.find(binding => sharedFieldTarget(binding) === target);
}

/** The change a shell control sends: make the Field parameter shared (true) or Scene-local (false). */
export function sharedSettingChange(target: string, shared: boolean): {kind: 'shared-setting'; target: string; shared: boolean} {
  return {kind: 'shared-setting', target, shared};
}

/** The shareable Field targets the Expression currently shares for this Scene (the reading's sharedTargets). */
export function readSharedFieldTargets(journey: Journey, scene: Scene): string[] {
  return SHAREABLE_FIELD_BINDINGS.filter(binding => isShared(journey, scene, binding.bind)).map(sharedFieldTarget);
}
