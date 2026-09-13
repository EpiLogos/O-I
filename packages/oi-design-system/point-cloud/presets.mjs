/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Named presets, ported from EpiLogos/Point-Cloud-Demo@7616489 src/App.tsx
 * PRESETS. Every preset keeps its fluid/relational character; particle dot
 * sizes are brought under the desktop's sub-3px ink law (MAX_PARTICLE_SIZE_PX).
 * The first entry is the O:I mark — the shipped first saved state that the
 * welcome frontstate renders.
 */

import { DEFAULT_CONFIG, MAX_PARTICLE_SIZE_PX } from './config.mjs';

/** The shipped logo state. Also serialized at
 * desktop/cradle/src/visuals/oi-logo-state.json — keep the two in step. */
export const LOGO_PRESET = Object.freeze({
  id: 'oi_logo_mark',
  name: 'O:I Mark',
  description: 'The app mark as a living point cloud — the welcome frontstate',
  config: Object.freeze({
    glyph: ['O', 'I'],
    particleCount: 120000,
    particleSize: { min: 0.7, max: 2.4 },
    colorMode: 'followTheme',
    style: 'stipple',
    dotShape: 'circle',
    fluid: {
      curlScale: 0.9,
      curlSpeed: 0.4,
      vortexStrength: 0.8,
      viscosity: 0.95,
      returnSpeed: 1.6,
      turbulence: 0.6,
      dispersion: 0.25,
    },
    interaction: {
      radius: 220,
      strength: 1.1,
      mode: 'repel',
    },
    relational: {
      enabled: false,
      mode: 'orbital',
      attractorCount: 3,
      attractorGravity: 1.6,
      orbitSpeed: 0.8,
      orbitRadius: 240,
      relationalSpin: 1.4,
      chaosFactor: 0.2,
      wanderSpeed: 0.5,
    },
    autoMorph: true,
    autoMorphDuration: 6.0,
    morphProgress: 0.0,
  }),
});

export const PRESETS = Object.freeze([
  LOGO_PRESET,
  Object.freeze({
    id: 'reference_oi',
    name: 'O ⇄ I Vortex Bridge',
    description: 'Canonical reference: orbital vorticity pulling O boundary into I bar with fine stipple spray',
    config: Object.freeze({
      glyph: ['O', 'I'],
      style: 'stipple',
      dotShape: 'circle',
      particleSize: { min: 1.1, max: 2.6 },
      fluid: {
        curlScale: 1.2,
        curlSpeed: 0.6,
        vortexStrength: 1.45,
        viscosity: 0.94,
        returnSpeed: 1.15,
        turbulence: 1.0,
        dispersion: 0.75,
      },
      interaction: {
        radius: 190,
        strength: 1.3,
        mode: 'repel',
      },
      relational: {
        enabled: false,
        mode: 'orbital',
        attractorCount: 2,
        attractorGravity: 1.6,
        orbitSpeed: 0.8,
        orbitRadius: 240,
        relationalSpin: 1.4,
        chaosFactor: 0.2,
        wanderSpeed: 0.5,
      },
      autoMorph: true,
      autoMorphDuration: 3.8,
    }),
  }),
  Object.freeze({
    id: 'binary_star_orbit',
    name: 'Binary Star Relational Orbits',
    description: 'Two relational attractor poles dynamically orbiting each other, transferring stipple particles along gravitational bridges',
    config: Object.freeze({
      glyph: ['✦', '✧'],
      style: 'stipple',
      dotShape: 'circle',
      particleSize: { min: 0.9, max: 2.8 },
      relational: {
        enabled: true,
        mode: 'orbital',
        attractorCount: 2,
        attractorGravity: 3.2,
        orbitSpeed: 1.2,
        orbitRadius: 280,
        relationalSpin: 2.5,
        chaosFactor: 0.4,
        wanderSpeed: 0.6,
      },
      fluid: {
        curlScale: 1.4,
        curlSpeed: 0.8,
        vortexStrength: 1.5,
        viscosity: 0.94,
        returnSpeed: 0.6,
        turbulence: 0.8,
        dispersion: 0.5,
      },
      interaction: {
        radius: 200,
        strength: 1.5,
        mode: 'vortex',
      },
      autoMorph: false,
    }),
  }),
  Object.freeze({
    id: 'chaotic_strange_attractor',
    name: 'Harmonic Strange Attractor',
    description: '3 multi-pole non-linear harmonic wanderers perturbing typographic symbols into turbulent filament streams',
    config: Object.freeze({
      glyph: ['Ω', '∞'],
      style: 'stipple',
      dotShape: 'circle',
      particleSize: { min: 0.8, max: 2.8 },
      relational: {
        enabled: true,
        mode: 'chaos',
        attractorCount: 3,
        attractorGravity: 4.5,
        orbitSpeed: 0.5,
        orbitRadius: 320,
        relationalSpin: -3.0,
        chaosFactor: 2.2,
        wanderSpeed: 1.8,
      },
      fluid: {
        curlScale: 2.2,
        curlSpeed: 1.2,
        vortexStrength: 2.2,
        viscosity: 0.93,
        returnSpeed: 0.4,
        turbulence: 1.8,
        dispersion: 1.0,
      },
      interaction: {
        radius: 250,
        strength: 2.0,
        mode: 'attract',
      },
      autoMorph: false,
    }),
  }),
  Object.freeze({
    id: 'nbody_lemniscate',
    name: 'N-Body Lemniscate Rosette',
    description: 'Keplerian figure-8 orbit with 4 dynamic centers interweaving mathematical glyph forms in continuous motion',
    config: Object.freeze({
      glyph: ['∑', '∫'],
      style: 'halftone',
      dotShape: 'circle',
      particleSize: { min: 0.9, max: 3.0 },
      relational: {
        enabled: true,
        mode: 'nbody',
        attractorCount: 4,
        attractorGravity: 2.8,
        orbitSpeed: 1.4,
        orbitRadius: 260,
        relationalSpin: 2.0,
        chaosFactor: 0.3,
        wanderSpeed: 0.4,
      },
      fluid: {
        curlScale: 0.9,
        curlSpeed: 0.5,
        vortexStrength: 1.2,
        viscosity: 0.95,
        returnSpeed: 0.9,
        turbulence: 0.5,
        dispersion: 0.3,
      },
      interaction: {
        radius: 220,
        strength: 1.4,
        mode: 'vortex',
      },
      autoMorph: false,
    }),
  }),
  Object.freeze({
    id: 'explosive_antigravity',
    name: 'Anti-Spring Kinetic Dispersal',
    description: 'Negative spring constant (k = -0.6) and high kinetic speed propelling stipple points outward in unrestrained fluid dissipation',
    config: Object.freeze({
      glyph: ['&', '@'],
      style: 'stipple',
      dotShape: 'circle',
      particleSize: { min: 1.0, max: 2.8 },
      relational: {
        enabled: true,
        mode: 'chaos',
        attractorCount: 2,
        attractorGravity: -2.5,
        orbitSpeed: 2.0,
        orbitRadius: 300,
        relationalSpin: 5.0,
        chaosFactor: 3.5,
        wanderSpeed: 2.0,
      },
      fluid: {
        curlScale: 3.0,
        curlSpeed: 2.5,
        vortexStrength: 4.5,
        viscosity: 0.97,
        returnSpeed: -0.6,
        turbulence: 3.0,
        dispersion: 2.5,
      },
      interaction: {
        radius: 350,
        strength: 3.5,
        mode: 'repel',
      },
      autoMorph: true,
      autoMorphDuration: 3.0,
    }),
  }),
  Object.freeze({
    id: 'halftone_matrix',
    name: 'Ordered Halftone Matrix',
    description: 'Structured dot-matrix grid with radius directly modulated by typographical stroke density',
    config: Object.freeze({
      glyph: ['O', 'I'],
      style: 'halftone',
      dotShape: 'circle',
      particleSize: { min: 0.9, max: 3.0 },
      fluid: {
        curlScale: 0.8,
        curlSpeed: 0.4,
        vortexStrength: 0.6,
        viscosity: 0.96,
        returnSpeed: 1.8,
        turbulence: 0.4,
        dispersion: 0.2,
      },
      interaction: {
        radius: 160,
        strength: 1.1,
        mode: 'vortex',
      },
      relational: {
        enabled: false,
      },
      autoMorph: true,
      autoMorphDuration: 4.5,
    }),
  }),
  Object.freeze({
    id: 'risograph_spray',
    name: 'Risograph Ink Spray',
    description: 'Organic high-turbulence curl dispersion with micro-droplet perimeter scatter',
    config: Object.freeze({
      glyph: ['&', '@'],
      style: 'stipple',
      dotShape: 'circle',
      particleSize: { min: 0.9, max: 2.7 },
      fluid: {
        curlScale: 1.8,
        curlSpeed: 0.85,
        vortexStrength: 1.1,
        viscosity: 0.93,
        returnSpeed: 0.85,
        turbulence: 1.6,
        dispersion: 0.9,
      },
      interaction: {
        radius: 220,
        strength: 1.5,
        mode: 'repel',
      },
      relational: {
        enabled: false,
      },
      autoMorph: true,
      autoMorphDuration: 4.2,
    }),
  }),
  Object.freeze({
    id: 'square_dither',
    name: 'Square Dither Grid',
    description: 'Typographic square dither matrix with geometric halftone compression',
    config: Object.freeze({
      glyph: ['8', '∞'],
      style: 'halftone',
      dotShape: 'square',
      particleSize: { min: 1.0, max: 3.0 },
      fluid: {
        curlScale: 1.0,
        curlSpeed: 0.5,
        vortexStrength: 0.8,
        viscosity: 0.95,
        returnSpeed: 1.5,
        turbulence: 0.6,
        dispersion: 0.4,
      },
      interaction: {
        radius: 180,
        strength: 1.2,
        mode: 'attract',
      },
      relational: {
        enabled: false,
      },
      autoMorph: true,
      autoMorphDuration: 4.0,
    }),
  }),
]);

/** Preset application: nested merge over the current config (a preset never
 * resets keys it does not name). */
export function presetConfig(current, preset) {
  return { ...current, ...preset.config };
}

export { DEFAULT_CONFIG, MAX_PARTICLE_SIZE_PX };
