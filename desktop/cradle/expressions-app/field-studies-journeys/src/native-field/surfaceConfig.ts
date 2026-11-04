/** The configuration the native frame draws (O-I 851, 854): the scene's own, with the plate ringing no plate of its own (under the native
 * instrument it is the body laid flat, production.ts setPlateBody, so its drive is resolved and its lanes move that drive) and the
 * surface's material the lens in force gives it (src/engine/surfaceMaterial.ts), as the owner's Torus reading states it. One
 * configuration for each scene configuration and material, so a repeated reading re-applies nothing. Pure but for its cache. */
import type {PointCloudConfig} from '../../../src/engine/types';
import type {TorusPlayReading} from '../../../src/engine/torusDrive';
import {surfaceMaterial} from '../../../src/engine/surfaceMaterial';

const made = new WeakMap<PointCloudConfig, {key: string; result: PointCloudConfig}>();

export function nativeSurface(config: PointCloudConfig, play: TorusPlayReading | null): PointCloudConfig {
  const material = play?.material && play.material.absentBecause === null ? play.material : null;
  const key = material ? JSON.stringify(material) : '';
  const held = made.get(config);
  if (held && held.key === key) return held.result;
  const plate: PointCloudConfig = {...config,
    toroidalMorph: config.toroidalMorph ? {...config.toroidalMorph, enabled: false, autoOscillate: false} : undefined,
    automations: config.automations?.filter(l => !l.path.startsWith('toroidalMorph.'))};
  const result = material ? surfaceMaterial(plate, material) : plate;
  made.set(config, {key, result});
  return result;
}
