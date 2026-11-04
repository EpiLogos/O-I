/** The surface's material (DLW §20.14 Modes: "The lens in force gives the surface its material"; M2′ seed §2.M2-1′; O-I 854). QL gives it
 * (scene_field.rs lens_material_of, m2_material.rs): a colour and four magnitudes, each 0..1, for the lens in force at its position, and a
 * lens's partner gives the mirror. The engine lays it on what the particles show and on nothing else: their marks (the granular material,
 * PointCloudField uGrain*) and, when the scene's colour field is on, its first colour. It moves no note, no body and no force: nothing that
 * sounds or moves reads a configuration's marks or colours. Pure. */
import type {PointCloudConfig} from './types';

/** A lens's surface as the owner reads it (torusPlay.mjs `material`). */
export interface SurfaceMaterial {
  readonly lens: string; readonly partner: string; readonly face: 'day' | 'night'; readonly position: number; readonly valence: number;
  readonly colour_rgb: readonly [number, number, number];
  readonly roughness: number; readonly elasticity: number; readonly particle_affinity: number; readonly tension: number;
  readonly standing: string | null; readonly absentBecause: null;
}
export type SurfaceMaterialReading = SurfaceMaterial | {readonly absentBecause: string};

/** The most peripheral ink a surface leaves (paramRegistry.ts `material.halo`, 0..0.6). */
export const HALO_MAX = 0.6;
/** Declared presentation: how the owner's magnitudes reach the marks. */
export const SURFACE_LAW = 'O-I 854: the lens\'s material on the marks: roughness is the marks\' imperfect edges (irregularity), elasticity their edge softness, tension their density contrast, and particles that gather less leave more peripheral ink (halo = 0.6 · (1 − particle affinity)); the colour is the colour field\'s first colour while the field is on. Every other mark the scene sets stands.';

const unit = (x: number) => Math.min(1, Math.max(0, x));
/** `#rrggbb` of a colour whose channels run 0..1. */
export function hexOf(rgb: readonly number[]): string {
  return `#${rgb.slice(0, 3).map(c => Math.round(unit(c) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** The configuration with the surface's material laid on its marks and, when the colour field is on, its colour. Never writes `config`. */
export function surfaceMaterial(config: PointCloudConfig, m: SurfaceMaterial): PointCloudConfig {
  return {
    ...config,
    material: {...config.material, irregularity: m.roughness, softness: m.elasticity, contrast: m.tension, halo: HALO_MAX * (1 - m.particle_affinity)},
    ...(config.color?.enabled ? {color: {...config.color, primaryColor: hexOf(m.colour_rgb)}} : {}),
  };
}
