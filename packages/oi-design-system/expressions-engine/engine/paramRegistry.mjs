/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
const P = (path, label, group, min, max, hardMin, hardMax, step = 0.01, extra = {}) => ({ path, label, group, min, max, hardMin, hardMax, step, ...extra });
const PARAM_REGISTRY = [
  // ---- Native granular mark profile (render-only; one particle system) ----
  P("material.sizeBias", "Size Distribution", "Material", 0.2, 4, 0.1, 12, 0.05, { scale: "log" }),
  P("material.opacity", "Ink Opacity", "Material", 0, 1, 0, 1, 0.01),
  P("material.roundness", "Mark Roundness", "Material", 0, 1, 0, 1, 0.01),
  P("material.softness", "Edge Softness", "Material", 0, 1, 0, 1, 0.01),
  P("material.irregularity", "Imperfect Edges", "Material", 0, 1, 0, 1, 0.01),
  P("material.elongation", "Elongation", "Material", 0, 3, 0, 12, 0.01),
  P("material.orientation", "Mark Orientation", "Material", -180, 180, -36e3, 36e3, 1, { unit: "\xB0" }),
  P("material.contrast", "Density Contrast", "Material", 0, 1, 0, 1, 0.01),
  P("material.densityScale", "Density Band Scale", "Material", 0.1, 3, 0.01, 100, 0.01),
  P("material.densityPhase", "Density Band Phase", "Material", 0, 6.283, -1e3, 1e3, 0.01, { unit: "rad" }),
  P("material.edgeWeight", "Edge Emphasis", "Material", 0, 1, 0, 5, 0.01),
  P("material.halo", "Peripheral Ink", "Material", 0, 0.6, 0, 1, 0.01, { hint: "Visibility of low-density source samples; does not manufacture a second cloud" }),
  P("paperGrain", "Paper Grain", "Paper", 0, 0.2, 0, 1, 5e-3, { hint: "Host-rendered paper surface; excluded from transparent PNG" }),
  P("color.fieldCenterOffset.0", "Palette Centre X", "Color", -3, 3, -20, 20, 0.05),
  P("color.fieldCenterOffset.1", "Palette Centre Y", "Color", -3, 3, -20, 20, 0.05),
  P("relational.attractorCount", "Relational Centre Count", "Relational", 1, 10, 1, 10, 1),
  P("cymatics.driveScale", "Intensity Field Scale", "Cymatics", 0, 4, 0, 100, 0.05),
  // ---- Fluid core ----
  P("fluid.returnSpeed", "Return Spring", "Fluid", -5, 25, -100, 500, 0.1),
  P("fluid.viscosity", "Viscosity Damp", "Fluid", 0.2, 1.01, 0, 1.2, 5e-3, { decimals: 3 }),
  P("fluid.vortexStrength", "Vortex Force", "Fluid", -25, 25, -500, 500, 0.1),
  P("fluid.curlScale", "Curl Scale", "Fluid", 0.02, 16, 0, 200, 0.05, { scale: "log" }),
  P("fluid.curlSpeed", "Curl Speed", "Fluid", -10, 15, -200, 200, 0.05),
  P("fluid.turbulence", "Turbulence", "Fluid", 0, 15, -100, 500, 0.1),
  P("fluid.dispersion", "Dispersion", "Fluid", 0, 20, -100, 500, 0.1),
  // ---- Fluid extended physics ----
  P("fluid.snapRigidity", "Snap Rigidity", "Physics+", 0, 5, -20, 100, 0.05, { hint: "Multiplier on the restoring spring" }),
  P("fluid.densityTether", "Density Tether", "Physics+", 0, 3, 0, 10, 0.05, { hint: "How much stroke density stiffens the spring" }),
  P("fluid.curlDepth", "Curl Depth (Z)", "Physics+", 0, 4, 0, 50, 0.01),
  P("fluid.vortexRadius", "Vortex Radius", "Physics+", 20, 2e3, 5, 2e4, 5, { decimals: 0, unit: "px", scale: "log" }),
  P("fluid.gravityX", "Gravity X", "Physics+", -10, 10, -1e3, 1e3, 0.05),
  P("fluid.gravityY", "Gravity Y", "Physics+", -10, 10, -1e3, 1e3, 0.05),
  P("fluid.gravityZ", "Gravity Z", "Physics+", -10, 10, -1e3, 1e3, 0.05),
  P("fluid.quadraticDrag", "Quadratic Drag", "Physics+", 0, 10, 0, 1e3, 0.05),
  P("fluid.thermalJitter", "Thermal Jitter", "Physics+", 0, 10, 0, 1e3, 0.05),
  P("fluid.maxSpeed", "Speed Limit", "Physics+", 50, 6e4, 10, 1e7, 50, { decimals: 0, scale: "log" }),
  P("fluid.zConfinement", "Z Confinement", "Physics+", 0, 1, 0, 10, 0.01),
  P("fluid.timeScale", "Time Scale", "Physics+", 0, 4, -10, 100, 0.01),
  // ---- Particles ----
  P("particleCount", "Particle Count", "Particles", 1e3, 2e6, 64, 4e6, 1, { decimals: 0, scale: "log", hint: "Exact count; the GPU texture resizes to fit" }),
  P("particleSize.min", "Min Size", "Particles", 0.02, 40, 1e-3, 500, 0.01, { unit: "px", scale: "log" }),
  P("particleSize.max", "Max Size", "Particles", 0.05, 80, 1e-3, 1e3, 0.01, { unit: "px", scale: "log" }),
  // ---- Morph ----
  P("morphProgress", "A\u2192B Scrub", "Morph", 0, 1, 0, 1, 5e-3, { decimals: 3 }),
  P("toroidalMorph.oscillationSpeed", "Toroidal Rate", "Morph", 0, 10, -100, 100, 0.01, { unit: "Hz" }),
  P("toroidalMorph.poloidalRate", "Poloidal Rate", "Morph", 0, 10, -100, 100, 0.01, { unit: "Hz" }),
  P("toroidalMorph.toroidalPhase", "Toroidal Phase", "Morph", -6.283, 6.283, -1e3, 1e3, 0.01, { unit: "rad" }),
  P("toroidalMorph.poloidalPhase", "Poloidal Phase", "Morph", -6.283, 6.283, -1e3, 1e3, 0.01, { unit: "rad" }),
  P("toroidalMorph.oscillationAmplitude", "Breathing Amp", "Morph", 0, 5, -50, 100, 0.05),
  P("toroidalMorph.breathRate", "Breathing Rate", "Morph", 0, 10, -100, 100, 0.01, { unit: "Hz", hint: "Rate of the vibrational manifold breathing; defaults to the poloidal rate" }),
  P("toroidalMorph.breathDepth", "Breathing Depth", "Morph", 0, 2, 0, 10, 0.01, { hint: "How strongly the manifold swells and contracts with each breath" }),
  P("toroidalMorph.driveDepth", "Drive Depth", "Morph", 0, 2, -10, 10, 0.01),
  P("toroidalMorph.holdRatio", "Dwell Ratio", "Morph", 0, 0.9, 0, 0.99, 0.01),
  P("toroidalMorph.fiberPhaseOffset", "Fiber \u0394\u03C8", "Morph", -12.56, 12.56, -1e3, 1e3, 0.05),
  P("toroidalMorph.chiralCoupling", "Chiral Coupling", "Morph", -4, 4, -100, 100, 0.05),
  P("toroidalMorph.toroidalWinding", "Toroidal Winding p", "Morph", 0, 48, 0, 512, 1, { decimals: 0 }),
  P("toroidalMorph.poloidalWinding", "Poloidal Winding q", "Morph", 0, 48, 0, 512, 1, { decimals: 0 }),
  P("toroidalMorph.manifoldRadius", "Manifold Radius", "Morph", 10, 1200, 1, 2e4, 5, { unit: "px", scale: "log" }),
  P("toroidalMorph.volumetricDepthScale", "Volumetric Depth", "Morph", 0, 6, 0, 100, 0.05),
  // ---- Interaction ----
  P("interaction.clickStrength", "Click Strength", "Interaction", 0.2, 8, 0.01, 20, 0.05, { scale: "log" }),
  P("interaction.clickRadius", "Click Radius", "Interaction", 20, 800, 4, 4e3, 4, { unit: "px", scale: "log" }),
  P("interaction.radius", "Cursor Radius", "Interaction", 10, 2e3, 0, 5e4, 10, { unit: "px", scale: "log" }),
  P("interaction.strength", "Cursor Force", "Interaction", -30, 30, -1e3, 1e3, 0.1),
  P("interaction.velocityInfluence", "Velocity Inject", "Interaction", 0, 5, -100, 100, 0.05),
  P("interaction.falloffPower", "Falloff Power", "Interaction", 0.1, 6, 0, 50, 0.05),
  // ---- Relational ----
  P("relational.attractorGravity", "Gravity Pull", "Relational", -50, 50, -1e4, 1e4, 0.1),
  P("relational.orbitSpeed", "Orbit Speed", "Relational", -20, 20, -1e3, 1e3, 0.05),
  P("relational.orbitRadius", "Orbit Radius", "Relational", 0, 2e3, 0, 1e5, 5, { unit: "px" }),
  P("relational.relationalSpin", "Relational Spin", "Relational", -30, 30, -1e3, 1e3, 0.1),
  P("relational.chaosFactor", "Chaos Factor", "Relational", 0, 30, -1e3, 1e3, 0.1),
  P("relational.wanderSpeed", "Wander Speed", "Relational", 0, 10, -100, 100, 0.05),
  P("relational.gravitySoftening", "Gravity Softening", "Relational", 1, 500, 1, 1e5, 1, { unit: "px", scale: "log" }),
  P("relational.gravityFalloff", "Gravity Falloff", "Relational", 0.5, 3, 0.1, 10, 0.01),
  P("relational.swirlRadius", "Swirl Radius", "Relational", 20, 3e3, 5, 1e5, 10, { unit: "px", scale: "log" }),
  // ---- Color ----
  P("color.cycleSpeed", "Cycle Speed", "Color", -10, 10, -1e3, 1e3, 0.1),
  P("color.hueShiftSpeed", "Hue Shift Speed", "Color", -6, 6, -1e3, 1e3, 0.05),
  P("color.waveFrequency", "Wave Frequency", "Color", 0.05, 24, 0, 1e3, 0.1, { scale: "log" }),
  P("color.angle", "Gradient Angle", "Color", -360, 360, -36e3, 36e3, 1, { decimals: 0, unit: "\xB0" }),
  P("color.speedReactiveIntensity", "Velocity React", "Color", 0, 5, -100, 100, 0.05),
  P("color.turbulenceModulation", "Turbulence Mod", "Color", 0, 3, -100, 100, 0.05),
  P("color.densityWeight", "Density Weight", "Color", 0, 3, -10, 10, 0.05),
  P("color.contrast", "Contrast", "Color", 0.1, 5, 0, 100, 0.05, { scale: "log" }),
  P("backgroundGlowIntensity", "Glow Intensity", "Color", 0, 3, 0, 100, 0.05),
  // ---- Cymatic medium (continuous modal resonator) ----
  P("cymatics.frequencyHz", "Drive Frequency", "Cymatics", 20, 4e3, 1, 1e5, 1, { decimals: 0, unit: "Hz", scale: "log" }),
  P("cymatics.dominance", "Dominance", "Cymatics", 0, 1, 0, 1, 0.01, { hint: "0 = pure formation springs, 1 = pure resonator transport" }),
  P("cymatics.dampingQFactor", "Q Factor", "Cymatics", 0.1, 40, 0.01, 1e4, 0.1, { scale: "log" }),
  P("cymatics.driveStrength", "Drive Strength", "Cymatics", 0, 6, 0, 100, 0.05),
  P("cymatics.transportGain", "Transport Gain", "Cymatics", 0, 10, 0, 1e3, 0.05, { hint: "Pulls particles down the vibration-intensity gradient into nodal regions" }),
  P("cymatics.agitation", "Agitation", "Cymatics", 0, 5, 0, 200, 0.02, { hint: "Random kick scaled by sqrt(local vibration intensity)" }),
  P("cymatics.plateSize", "Plate Size", "Cymatics", 100, 2e3, 10, 2e4, 5, { unit: "px", scale: "log" }),
  P("cymatics.modeCount", "Mode Count", "Cymatics", 1, 64, 1, 64, 1, { decimals: 0, hint: "Number of participating modes, ranked by drive coupling" }),
  P("cymatics.boundaryStrength", "Boundary Strength", "Cymatics", 0, 30, 0, 1e3, 0.1),
  P("cymatics.baseFrequency", "Resonator f0", "Cymatics", 5, 200, 0.5, 2e3, 0.5, { unit: "Hz", scale: "log", hint: "f_mn = f0 * (m^2 + n^2); tunes the band to ~80-1100Hz" }),
  P("cymatics.sweepSpeed", "Sweep Period", "Cymatics", 0.05, 600, 0.01, 1e5, 0.05, { unit: "s", scale: "log" }),
  P("cymatics.sweep.glideS", "Sweep Glide", "Cymatics", 0.1, 30, 0.01, 3600, 0.1, { unit: "s" }),
  P("cymatics.sweep.dwellS", "Sweep Dwell", "Cymatics", 0, 30, 0, 3600, 0.1, { unit: "s" }),
  // ---- Composition ----
  P("composition.orchestration.dwell", "Focus Dwell", "Composition", 0, 30, 0, 3600, 0.05, { unit: "s" }),
  P("composition.orchestration.glide", "Focus Glide", "Composition", 0.02, 30, 0.01, 3600, 0.05, { unit: "s" }),
  P("composition.entityTintWeight", "Entity Tint Weight", "Composition", 0, 1, 0, 1, 0.01),
  P("composition.orchestration.focusTintWeight", "Focus Tint Weight", "Composition", 0, 1, 0, 1, 0.01)
];
const PARAM_GROUPS = Array.from(new Set(PARAM_REGISTRY.map((p) => p.group)));
const byPath = new Map(PARAM_REGISTRY.map((p) => [p.path, p]));
function getParamDef(path) {
  return byPath.get(path);
}
function paramLabel(path) {
  return byPath.get(path)?.label ?? path;
}
function entityParamDefs(index, entity) {
  const label = entity.name && entity.name.trim() ? entity.name.trim() : `Entity ${index + 1}`;
  const prefix = `entities.${index}`;
  const group = `Entity \xB7 ${label}`;
  return [
    P(`${prefix}.x`, `${label} \xB7 X`, group, -1200, 1200, -2e4, 2e4, 5, { decimals: 0, unit: "px" }),
    P(`${prefix}.y`, `${label} \xB7 Y`, group, -1200, 1200, -2e4, 2e4, 5, { decimals: 0, unit: "px" }),
    P(`${prefix}.z`, `${label} \xB7 Z`, group, -1200, 1200, -2e4, 2e4, 5, { decimals: 0, unit: "px" }),
    P(`${prefix}.scale`, `${label} \xB7 Scale`, group, 0.02, 4, 1e-3, 100, 0.01),
    P(`${prefix}.forces.strength`, `${label} \xB7 Force Strength`, group, -20, 20, -1e3, 1e3, 0.1),
    P(`${prefix}.forces.radius`, `${label} \xB7 Force Radius`, group, 20, 2e3, 5, 2e4, 5, { decimals: 0, unit: "px" }),
    P(`${prefix}.forces.spin`, `${label} \xB7 Force Spin`, group, -20, 20, -1e3, 1e3, 0.1),
    P(`${prefix}.tintWeight`, `${label} \xB7 Tint Weight`, group, 0, 1, 0, 1, 0.01),
    P(`${prefix}.sequence.hold`, `${label} \xB7 Seq Hold`, group, 0, 30, 0, 3600, 0.05, { unit: "s" }),
    P(`${prefix}.sequence.transition`, `${label} \xB7 Seq Transition`, group, 0.05, 30, 0.02, 3600, 0.05, { unit: "s" }),
    P(`${prefix}.sequence.rateMul`, `${label} \xB7 Seq Rate`, group, -5, 5, -100, 100, 0.01),
    P(`${prefix}.sequence.phaseOffset`, `${label} \xB7 Seq Phase`, group, -4, 4, -1e3, 1e3, 0.01)
  ];
}
export {
  PARAM_GROUPS,
  PARAM_REGISTRY,
  entityParamDefs,
  getParamDef,
  paramLabel
};
