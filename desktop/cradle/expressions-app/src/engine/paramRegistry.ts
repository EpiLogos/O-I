/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Central registry of numeric parameters: dot path into PointCloudConfig, display
 * label, group, soft slider range and hard typed bound. Used by the inspector
 * sliders and by the automation system to pick targets and default ranges.
 */

export interface ParamDef {
  path: string;
  label: string;
  group: string;
  min: number;       // soft slider range
  max: number;
  hardMin: number;   // typed-value bound
  hardMax: number;
  step: number;
  decimals?: number;
  unit?: string;
  hint?: string;
  scale?: 'linear' | 'log';
}

const P = (
  path: string,
  label: string,
  group: string,
  min: number,
  max: number,
  hardMin: number,
  hardMax: number,
  step = 0.01,
  extra: Partial<ParamDef> = {}
): ParamDef => ({ path, label, group, min, max, hardMin, hardMax, step, ...extra });

export const PARAM_REGISTRY: ParamDef[] = [
  // ---- Native granular mark profile (render-only; one particle system) ----
  P('material.sizeBias', 'Size Distribution', 'Material', .2, 4, .1, 12, .05, {scale:'log'}),
  P('material.opacity', 'Ink Opacity', 'Material', 0, 1, 0, 1, .01),
  P('material.roundness', 'Mark Roundness', 'Material', 0, 1, 0, 1, .01),
  P('material.softness', 'Edge Softness', 'Material', 0, 1, 0, 1, .01),
  P('material.irregularity', 'Imperfect Edges', 'Material', 0, 1, 0, 1, .01),
  P('material.elongation', 'Elongation', 'Material', 0, 3, 0, 12, .01),
  P('material.orientation', 'Mark Orientation', 'Material', -180, 180, -36000, 36000, 1, {unit:'°'}),
  P('material.contrast', 'Density Contrast', 'Material', 0, 1, 0, 1, .01),
  P('material.densityScale', 'Density Band Scale', 'Material', .1, 3, .01, 100, .01),
  P('material.densityPhase', 'Density Band Phase', 'Material', 0, 6.283, -1000, 1000, .01, {unit:'rad'}),
  P('material.edgeWeight', 'Edge Emphasis', 'Material', 0, 1, 0, 5, .01),
  P('material.halo', 'Peripheral Ink', 'Material', 0, .6, 0, 1, .01, {hint:'Visibility of low-density source samples; does not manufacture a second cloud'}),
  P('paperGrain', 'Paper Grain', 'Paper', 0, .2, 0, 1, .005, {hint:'Host-rendered paper surface; excluded from transparent PNG'}),
  P('color.fieldCenterOffset.0', 'Palette Centre X', 'Color', -3, 3, -20, 20, .05),
  P('color.fieldCenterOffset.1', 'Palette Centre Y', 'Color', -3, 3, -20, 20, .05),
  P('relational.attractorCount', 'Relational Centre Count', 'Relational', 1, 10, 1, 10, 1),
  P('cymatics.driveScale', 'Intensity Field Scale', 'Cymatics', 0, 4, 0, 100, .05),
  // ---- Fluid core ----
  P('fluid.returnSpeed', 'Return Spring', 'Fluid', -5, 25, -100, 500, 0.1),
  P('fluid.viscosity', 'Viscosity Damp', 'Fluid', 0.2, 1.01, 0, 1.2, 0.005, { decimals: 3 }),
  P('fluid.vortexStrength', 'Vortex Force', 'Fluid', -25, 25, -500, 500, 0.1),
  P('fluid.curlScale', 'Curl Scale', 'Fluid', 0.02, 16, 0, 200, 0.05, {scale:'log'}),
  P('fluid.curlSpeed', 'Curl Speed', 'Fluid', -10, 15, -200, 200, 0.05),
  P('fluid.turbulence', 'Turbulence', 'Fluid', 0, 15, -100, 500, 0.1),
  P('fluid.dispersion', 'Dispersion', 'Fluid', 0, 20, -100, 500, 0.1),
  // ---- Fluid extended physics ----
  P('fluid.snapRigidity', 'Snap Rigidity', 'Physics+', 0, 5, -20, 100, 0.05, { hint: 'Multiplier on the restoring spring' }),
  P('fluid.densityTether', 'Density Tether', 'Physics+', 0, 3, 0, 10, 0.05, { hint: 'How much stroke density stiffens the spring' }),
  P('fluid.curlDepth', 'Curl Depth (Z)', 'Physics+', 0, 4, 0, 50, 0.01),
  P('fluid.vortexRadius', 'Vortex Radius', 'Physics+', 20, 2000, 5, 20000, 5, { decimals: 0, unit: 'px', scale: 'log' }),
  P('fluid.gravityX', 'Gravity X', 'Physics+', -10, 10, -1000, 1000, 0.05),
  P('fluid.gravityY', 'Gravity Y', 'Physics+', -10, 10, -1000, 1000, 0.05),
  P('fluid.gravityZ', 'Gravity Z', 'Physics+', -10, 10, -1000, 1000, 0.05),
  P('fluid.quadraticDrag', 'Quadratic Drag', 'Physics+', 0, 10, 0, 1000, 0.05),
  P('fluid.thermalJitter', 'Thermal Jitter', 'Physics+', 0, 10, 0, 1000, 0.05),
  P('fluid.maxSpeed', 'Speed Limit', 'Physics+', 50, 60000, 10, 1e7, 50, { decimals: 0, scale: 'log' }),
  P('fluid.zConfinement', 'Z Confinement', 'Physics+', 0, 1, 0, 10, 0.01),
  P('fluid.timeScale', 'Time Scale', 'Physics+', 0, 4, -10, 100, 0.01),
  // ---- Particles ----
  P('particleCount', 'Particle Count', 'Particles', 1000, 2_000_000, 64, 4_000_000, 1, { decimals: 0, scale: 'log', hint: 'Exact count; the GPU texture resizes to fit' }),
  P('particleSize.min', 'Min Size', 'Particles', 0.02, 40, 0.001, 500, 0.01, { unit: 'px', scale: 'log' }),
  P('particleSize.max', 'Max Size', 'Particles', 0.05, 80, 0.001, 1000, 0.01, { unit: 'px', scale: 'log' }),
  // ---- Morph ----
  P('morphProgress', 'A→B Scrub', 'Morph', 0, 1, 0, 1, 0.005, { decimals: 3 }),
  P('toroidalMorph.oscillationSpeed', 'Toroidal Rate', 'Morph', 0, 10, -100, 100, 0.01, { unit: 'Hz' }),
  P('toroidalMorph.poloidalRate', 'Poloidal Rate', 'Morph', 0, 10, -100, 100, 0.01, { unit: 'Hz' }),
  P('toroidalMorph.toroidalPhase', 'Toroidal Phase', 'Morph', -6.283, 6.283, -1000, 1000, 0.01, { unit: 'rad' }),
  P('toroidalMorph.poloidalPhase', 'Poloidal Phase', 'Morph', -6.283, 6.283, -1000, 1000, 0.01, { unit: 'rad' }),
  P('toroidalMorph.oscillationAmplitude', 'Breathing Amp', 'Morph', 0, 5, -50, 100, 0.05),
  P('toroidalMorph.breathRate', 'Breathing Rate', 'Morph', 0, 10, -100, 100, 0.01, { unit: 'Hz', hint: 'Rate of the vibrational manifold breathing; defaults to the poloidal rate' }),
  P('toroidalMorph.breathDepth', 'Breathing Depth', 'Morph', 0, 2, 0, 10, 0.01, { hint: 'How strongly the manifold swells and contracts with each breath' }),
  P('toroidalMorph.driveDepth', 'Drive Depth', 'Morph', 0, 2, -10, 10, 0.01),
  P('toroidalMorph.holdRatio', 'Dwell Ratio', 'Morph', 0, 0.9, 0, 0.99, 0.01),
  P('toroidalMorph.fiberPhaseOffset', 'Fiber Δψ', 'Morph', -12.56, 12.56, -1000, 1000, 0.05),
  P('toroidalMorph.chiralCoupling', 'Chiral Coupling', 'Morph', -4, 4, -100, 100, 0.05),
  P('toroidalMorph.toroidalWinding', 'Toroidal Winding p', 'Morph', 0, 48, 0, 512, 1, { decimals: 0 }),
  P('toroidalMorph.poloidalWinding', 'Poloidal Winding q', 'Morph', 0, 48, 0, 512, 1, { decimals: 0 }),
  P('toroidalMorph.manifoldRadius', 'Manifold Radius', 'Morph', 10, 1200, 1, 20000, 5, { unit: 'px', scale: 'log' }),
  P('toroidalMorph.volumetricDepthScale', 'Volumetric Depth', 'Morph', 0, 6, 0, 100, 0.05),
  // ---- Interaction ----
  P('interaction.clickStrength','Click Strength','Interaction',.2,8,.01,20,.05,{scale:'log'}),
  P('interaction.clickRadius','Click Radius','Interaction',20,800,4,4000,4,{unit:'px',scale:'log'}),
  P('interaction.radius', 'Cursor Radius', 'Interaction', 10, 2000, 0, 50000, 10, { unit: 'px', scale: 'log' }),
  P('interaction.strength', 'Cursor Force', 'Interaction', -30, 30, -1000, 1000, 0.1),
  P('interaction.velocityInfluence', 'Velocity Inject', 'Interaction', 0, 5, -100, 100, 0.05),
  P('interaction.falloffPower', 'Falloff Power', 'Interaction', 0.1, 6, 0, 50, 0.05),
  // ---- Relational ----
  P('relational.attractorGravity', 'Gravity Pull', 'Relational', -50, 50, -10000, 10000, 0.1),
  P('relational.orbitSpeed', 'Orbit Speed', 'Relational', -20, 20, -1000, 1000, 0.05),
  P('relational.orbitRadius', 'Orbit Radius', 'Relational', 0, 2000, 0, 100000, 5, { unit: 'px' }),
  P('relational.relationalSpin', 'Relational Spin', 'Relational', -30, 30, -1000, 1000, 0.1),
  P('relational.chaosFactor', 'Chaos Factor', 'Relational', 0, 30, -1000, 1000, 0.1),
  P('relational.wanderSpeed', 'Wander Speed', 'Relational', 0, 10, -100, 100, 0.05),
  P('relational.gravitySoftening', 'Gravity Softening', 'Relational', 1, 500, 1, 100000, 1, { unit: 'px', scale: 'log' }),
  P('relational.gravityFalloff', 'Gravity Falloff', 'Relational', 0.5, 3, 0.1, 10, 0.01),
  P('relational.swirlRadius', 'Swirl Radius', 'Relational', 20, 3000, 5, 100000, 10, { unit: 'px', scale: 'log' }),
  // ---- Pairwise (sorted-grid DEM collisions; toggled by pairwise.enabled, not numeric) ----
  P('pairwise.radius', 'Collision Radius', 'Pairwise', 2, 80, 0.5, 500, 0.5, { unit: 'px', hint: 'Interaction radius h; cells are at least this wide. ~5-15px matches typical baked slot spacing' }),
  P('pairwise.stiffness', 'Collision Stiffness', 'Pairwise', 0, 10, 0, 100, 0.05, { hint: 'Separation spring scaled by overlap depth' }),
  P('pairwise.restitution', 'Restitution', 'Pairwise', 0, 1, 0, 1, 0.01, { hint: 'Normal damping applied to approaching neighbours' }),
  P('pairwise.viscosity', 'Pairwise Viscosity', 'Pairwise', 0, 1, 0, 1, 0.01, { hint: 'Tangential relative-velocity smoothing between neighbours' }),
  P('pairwise.extent', 'Grid Extent', 'Pairwise', 200, 5000, 50, 20000, 25, { unit: 'px', scale: 'log', hint: 'Half-extent of the fixed collision grid around the world origin' }),
  // ---- Color ----
  P('color.cycleSpeed', 'Cycle Speed', 'Color', -10, 10, -1000, 1000, 0.1),
  P('color.hueShiftSpeed', 'Hue Shift Speed', 'Color', -6, 6, -1000, 1000, 0.05),
  P('color.waveFrequency', 'Wave Frequency', 'Color', 0.05, 24, 0, 1000, 0.1, {scale:'log'}),
  P('color.angle', 'Gradient Angle', 'Color', -360, 360, -36000, 36000, 1, { decimals: 0, unit: '°' }),
  P('color.speedReactiveIntensity', 'Velocity React', 'Color', 0, 5, -100, 100, 0.05),
  P('color.turbulenceModulation', 'Turbulence Mod', 'Color', 0, 3, -100, 100, 0.05),
  P('color.densityWeight', 'Density Weight', 'Color', 0, 3, -10, 10, 0.05),
  P('color.contrast', 'Contrast', 'Color', 0.1, 5, 0, 100, 0.05, {scale:'log'}),
  P('backgroundGlowIntensity', 'Glow Intensity', 'Color', 0, 3, 0, 100, 0.05),
  // ---- Cymatic medium (continuous modal resonator) ----
  P('cymatics.frequencyHz', 'Drive Frequency', 'Cymatics', 20, 4000, 1, 100000, 1, { decimals: 0, unit: 'Hz', scale: 'log' }),
  P('cymatics.dominance', 'Dominance', 'Cymatics', 0, 1, 0, 1, 0.01, { hint: '0 = pure formation springs, 1 = pure resonator transport' }),
  P('cymatics.dampingQFactor', 'Q Factor', 'Cymatics', 0.1, 40, 0.01, 10000, 0.1, {scale:'log'}),
  P('cymatics.driveStrength', 'Drive Strength', 'Cymatics', 0, 6, 0, 100, 0.05),
  P('cymatics.transportGain', 'Transport Gain', 'Cymatics', 0, 10, 0, 1000, 0.05, { hint: 'Pulls particles down the vibration-intensity gradient into nodal regions' }),
  P('cymatics.agitation', 'Agitation', 'Cymatics', 0, 5, 0, 200, 0.02, { hint: 'Random kick scaled by sqrt(local vibration intensity)' }),
  P('cymatics.plateSize', 'Plate Size', 'Cymatics', 100, 2000, 10, 20000, 5, { unit: 'px', scale: 'log' }),
  P('cymatics.modeCount', 'Mode Count', 'Cymatics', 1, 64, 1, 64, 1, { decimals: 0, hint: 'Number of participating modes, ranked by drive coupling' }),
  P('cymatics.boundaryStrength', 'Boundary Strength', 'Cymatics', 0, 30, 0, 1000, 0.1),
  P('cymatics.baseFrequency', 'Resonator f0', 'Cymatics', 5, 200, 0.5, 2000, 0.5, { unit: 'Hz', scale: 'log', hint: 'f_mn = f0 * (m^2 + n^2); tunes the band to ~80-1100Hz' }),
  P('cymatics.sweepSpeed', 'Sweep Period', 'Cymatics', 0.05, 600, 0.01, 100000, 0.05, { unit: 's', scale: 'log' }),
  P('cymatics.sweep.glideS', 'Sweep Glide', 'Cymatics', 0.1, 30, 0.01, 3600, 0.1, { unit: 's' }),
  P('cymatics.sweep.dwellS', 'Sweep Dwell', 'Cymatics', 0, 30, 0, 3600, 0.1, { unit: 's' }),
  // ---- Shared medium (Eulerian grid fluid; enabled toggle lives on config.medium.enabled) ----
  P('medium.pressure', 'Medium Pressure', 'Medium', 0, 20, 0, 200, 0.05, { hint: 'Crowd repulsion from the medium pressure gradient' }),
  P('medium.coupling', 'Medium Coupling', 'Medium', 0, 4, 0, 20, 0.01, { hint: 'Drag toward the shared medium flow' }),
  P('medium.persistence', 'Medium Persistence', 'Medium', 0.8, 1.0, 0, 1.0, 0.002, { decimals: 3, hint: 'Medium velocity retained per frame at 60fps' }),
  P('medium.iterations', 'Pressure Iterations', 'Medium', 1, 12, 1, 64, 1, { decimals: 0, hint: 'Jacobi pressure solver steps per frame' }),
  P('medium.gridRes', 'Medium Grid', 'Medium', 64, 512, 16, 1024, 4, { decimals: 0, hint: 'Square solver grid resolution' }),
  P('medium.splatGain', 'Splat Gain', 'Medium', 0, 4, 0, 20, 0.01, { hint: 'Momentum injection of particles into the medium' }),
  P('medium.extent', 'Medium Extent', 'Medium', 200, 5000, 50, 20000, 10, { decimals: 0, unit: 'px', scale: 'log', hint: 'World half-extent the solver grid covers' }),
  // ---- Glyph SDF colliders (enabled toggle lives on config.collision.enabled) ----
  P('collision.restitution', 'Restitution', 'Collision', 0, 1, 0, 1, 0.01, { hint: 'Normal bounce off the letterform boundary' }),
  P('collision.friction', 'Contact Friction', 'Collision', 0, 1, 0, 1, 0.01, { hint: 'Tangential loss while in contact with the boundary' }),
  P('collision.band', 'Contact Band', 'Collision', 5, 200, 1, 2000, 1, { decimals: 0, unit: 'px', hint: 'Influence band around the glyph surface' }),
  P('collision.strength', 'Wall Strength', 'Collision', 0, 20, 0, 200, 0.05, { hint: 'Soft push gain near the glyph boundary' }),
  P('collision.integrity', 'Integrity Weakening', 'Collision', 0, 4, 0, 20, 0.01, { hint: 'Energetic particles weaken the local wall; it heals as they calm down' }),
  // ---- True-3D glyph bodies (enabled toggle lives on config.glyphVolume.enabled) ----
  P('glyphVolume.depth', 'Body Depth', 'Volume', 0, 600, 0, 4000, 1, { decimals: 0, unit: 'px', scale: 'log', hint: 'Full thickness of the letterform body. 0 collapses it back to a flat card' }),
  P('glyphVolume.wallShare', 'Flank Share', 'Volume', 0, 1, 0, 1, 0.01, { hint: 'How much of the body sits on the extruded side walls at the contour — the cue that reads as solid under rotation' }),
  P('glyphVolume.faceBias', 'Face Share', 'Volume', 0, 1, 0, 1, 0.01, { hint: 'Of the depth that is not flank, how much pins to the front and back sheets' }),
  P('glyphVolume.interiorFill', 'Interior Fill', 'Volume', 0, 1, 0, 1, 0.01, { hint: 'How far the interior band spreads. Low values keep mass near the shell so a rotated glyph is not an opaque slug' }),
  P('glyphVolume.surfaceThickness', 'Surface Sheet', 'Volume', 0, 80, 0, 2000, 1, { decimals: 0, unit: 'px', hint: 'Thickness of the front/back sheet. Keeps a face reading as a surface rather than a haze' }),
  P('glyphVolume.wallBand', 'Contour Band', 'Volume', 1, 80, 0.5, 1000, 1, { decimals: 0, unit: 'px', hint: 'Contour band over which flank placement falls off inward' }),
  P('glyphVolume.outsideTaper', 'Spray Taper', 'Volume', 0, 3, 0, 100, 0.05, { hint: 'How far the stipple spray outside the ink keeps any thickness, in stroke widths' }),
  P('glyphVolume.referenceFalloff', 'Profile Reach', 'Volume', 0.1, 4, 0.05, 100, 0.05, { hint: 'Scales the auto-derived stroke half-width that normalizes the profile' }),
  P('glyphVolume.densityDepth', 'Density → Depth', 'Volume', -1, 1, -1, 1, 0.01, { hint: 'Denser ink reads thicker (positive) or thinner (negative)' }),
  P('glyphVolume.jitter', 'Depth Jitter', 'Volume', 0, 40, 0, 2000, 0.5, { decimals: 1, unit: 'px', hint: 'Micro-noise on the final depth; 0 is a clean machined body' }),
  // ---- Depth presentation (projection toggle lives on config.depth.projection) ----
  P('depth.fov', 'Field of View', 'Depth', 10, 100, 4, 120, 1, { decimals: 0, unit: '°', hint: 'Lens angle of the perspective camera. Narrower is flatter and more orthographic' }),
  P('depth.distance', 'Orbit Distance', 'Depth', 100, 5000, 10, 100000, 10, { decimals: 0, unit: 'px', scale: 'log', hint: 'Eye distance from the orbit target; sets how much convergence the subject sees' }),
  P('depth.sizeAttenuation', 'Size Attenuation', 'Depth', 0, 3, 0, 10, 0.01, { hint: '1 is the physical 1/w law. Above 1 exaggerates the near/far size separation, 0 renders ortho-like' }),
  P('depth.sizeAttenuationCurve', 'Attenuation Curve', 'Depth', 0.2, 3, 0.01, 20, 0.01, { hint: 'Shapes how fast distant marks shrink' }),
  P('depth.sizeDepthBias', 'Depth Size Bias', 'Depth', -1, 1, -1, 1, 0.01, { hint: 'Extra linear size ramp: near marks larger, far smaller (or inverted)' }),
  P('depth.aerialFade', 'Aerial Fade', 'Depth', 0, 1, 0, 1, 0.01, { hint: 'How strongly distance dims the ink, so a volume separates front from back' }),
  P('depth.aerialRange', 'Aerial Reach', 'Depth', 0.2, 6, 0.1, 100, 0.05, { hint: 'How far the falloff reaches, as a multiple of the orbit distance' }),
  P('depth.depthTintWeight', 'Depth Tint', 'Depth', 0, 1, 0, 1, 0.01, { hint: 'Weight of the depth tone shift toward the fade colour' }),
  // ---- Composition ----
  P('composition.orchestration.dwell', 'Focus Dwell', 'Composition', 0, 30, 0, 3600, 0.05, { unit: 's' }),
  P('composition.orchestration.glide', 'Focus Glide', 'Composition', 0.02, 30, 0.01, 3600, 0.05, { unit: 's' }),
  P('composition.entityTintWeight', 'Entity Tint Weight', 'Composition', 0, 1, 0, 1, 0.01),
  P('composition.orchestration.focusTintWeight', 'Focus Tint Weight', 'Composition', 0, 1, 0, 1, 0.01),
];

export const PARAM_GROUPS: string[] = Array.from(new Set(PARAM_REGISTRY.map((p) => p.group)));

const byPath = new Map(PARAM_REGISTRY.map((p) => [p.path, p]));

export function getParamDef(path: string): ParamDef | undefined {
  return byPath.get(path);
}

export function paramLabel(path: string): string {
  return byPath.get(path)?.label ?? path;
}

/**
 * Dynamic ParamDefs for one entity's automatable fields, e.g. 'entities.2.forces.strength'.
 * Not part of PARAM_REGISTRY (the registry is static) — callers that need to resolve these
 * paths (the automation lane picker, RegistryRow-style lookups) should build a combined
 * lookup from PARAM_REGISTRY plus entityParamDefs(index, entity) for every entity in scope.
 */
export function entityParamDefs(index: number, entity: { name?: string }): ParamDef[] {
  const label = entity.name && entity.name.trim() ? entity.name.trim() : `Entity ${index + 1}`;
  const prefix = `entities.${index}`;
  const group = `Entity · ${label}`;
  return [
    P(`${prefix}.x`, `${label} · X`, group, -1200, 1200, -20000, 20000, 5, { decimals: 0, unit: 'px' }),
    P(`${prefix}.y`, `${label} · Y`, group, -1200, 1200, -20000, 20000, 5, { decimals: 0, unit: 'px' }),
    P(`${prefix}.z`, `${label} · Z`, group, -1200, 1200, -20000, 20000, 5, { decimals: 0, unit: 'px' }),
    P(`${prefix}.scale`, `${label} · Scale`, group, 0.02, 4, 0.001, 100, 0.01),
    P(`${prefix}.forces.strength`, `${label} · Force Strength`, group, -20, 20, -1000, 1000, 0.1),
    P(`${prefix}.forces.radius`, `${label} · Force Radius`, group, 20, 2000, 5, 20000, 5, { decimals: 0, unit: 'px' }),
    P(`${prefix}.forces.spin`, `${label} · Force Spin`, group, -20, 20, -1000, 1000, 0.1),
    P(`${prefix}.tintWeight`, `${label} · Tint Weight`, group, 0, 1, 0, 1, 0.01),
    P(`${prefix}.sequence.hold`, `${label} · Seq Hold`, group, 0, 30, 0, 3600, 0.05, { unit: 's' }),
    P(`${prefix}.sequence.transition`, `${label} · Seq Transition`, group, 0.05, 30, 0.02, 3600, 0.05, { unit: 's' }),
    P(`${prefix}.sequence.rateMul`, `${label} · Seq Rate`, group, -5, 5, -100, 100, 0.01),
    P(`${prefix}.sequence.phaseOffset`, `${label} · Seq Phase`, group, -4, 4, -1000, 1000, 0.01),
  ];
}
