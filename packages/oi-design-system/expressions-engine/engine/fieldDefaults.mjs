import { DEFAULT_GLYPH_VOLUME } from "./glyphVolume.mjs";
import { DEFAULT_COMPOSITION, DEFAULT_CYMATIC_MEDIUM, DEFAULT_SEQUENCE, makeFormation, makeLink } from "./fieldModel.mjs";
import { CHAKRA_PROFILE_ID } from "./semantics/chakraProfile.mjs";
const DEFAULT_COLOR_CONFIG = {
  enabled: false,
  mode: "linearGradient",
  primaryColor: "#00f0ff",
  secondaryColor: "#ff007f",
  accentColor: "#ffe600",
  cycleSpeed: 1.2,
  waveFrequency: 1.8,
  angle: 45,
  fieldCenterOffset: [0, 0],
  turbulenceModulation: 0.35,
  speedReactiveIntensity: 0.6,
  densityWeight: 0.5,
  hueShiftSpeed: 0,
  contrast: 1,
  paletteId: "cyberpunk_neon",
  backgroundColor: "#09090b",
  backgroundMode: "ambientGlow",
  backgroundGlowIntensity: 0.45
};
const DEFAULT_TOROIDAL_CONFIG = {
  enabled: false,
  trajectory: "toroidalHopf",
  progress: 0.5,
  autoOscillate: true,
  oscillationSpeed: 0.8,
  oscillationAmplitude: 1.2,
  breathRate: 0.35,
  breathDepth: 0.35,
  fiberPhaseOffset: 0,
  toroidalWinding: 3,
  poloidalWinding: 2,
  chiralCoupling: 0.75,
  manifoldRadius: 180,
  volumetricDepthScale: 1,
  poloidalRate: 0.35,
  toroidalPhase: 0,
  poloidalPhase: 0,
  interference: "toroidalOnly",
  driveShape: "sine",
  holdRatio: 0,
  driveDepth: 1
};
const DEFAULT_MEDIUM_CONFIG = {
  enabled: false,
  pressure: 4,
  coupling: 0.8,
  persistence: 0.97,
  iterations: 4,
  gridRes: 192,
  splatGain: 1,
  extent: 1400,
  plane: "compositionPlane",
  dimension: "2D"
};
const DEFAULT_COLLISION_CONFIG = {
  enabled: false,
  mode: "obstacle",
  restitution: 0.35,
  friction: 0.1,
  band: 40,
  strength: 4,
  integrity: 0.5
};
const DEFAULT_PAIRWISE_CONFIG = {
  enabled: false,
  radius: 2.2,
  stiffness: 1,
  restitution: 0.12,
  viscosity: 0.06,
  extent: 1400
};
const DEFAULT_DEPTH_CONFIG = {
  projection: "orthographic",
  fov: 38,
  distance: 800,
  sizeAttenuation: 1,
  sizeAttenuationCurve: 1,
  aerialFade: 0.55,
  aerialRange: 2.2,
  sizeDepthBias: 0,
  depthTintWeight: 0,
  depthTintColor: "#101018",
  occlusion: false
};
const DEFAULT_CONFIG = {
  glyph: ["O", "I"],
  particleCount: 2e5,
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontWeight: 900,
  colorMode: "blackOnWhite",
  backgroundColor: "#09090b",
  backgroundMode: "ambientGlow",
  backgroundGlowIntensity: 0.45,
  style: "stipple",
  dotShape: "circle",
  particleSize: { min: 0.16, max: 1.6 },
  fluid: {
    curlScale: 1.2,
    curlSpeed: 0.6,
    vortexStrength: 1.4,
    viscosity: 0.94,
    returnSpeed: 1.1,
    turbulence: 1,
    dispersion: 0.65,
    snapRigidity: 1,
    densityTether: 1,
    curlDepth: 0.57,
    vortexRadius: 450,
    gravityX: 0,
    gravityY: 0,
    gravityZ: 0,
    quadraticDrag: 0,
    thermalJitter: 0,
    maxSpeed: 35e3,
    zConfinement: 1,
    timeScale: 1
  },
  interaction: {
    radius: 180,
    strength: 1.2,
    mode: "repel",
    velocityInfluence: 1,
    falloffPower: 2,
    placedPoints: []
  },
  relational: {
    enabled: false,
    mode: "orbital",
    attractorCount: 3,
    attractorGravity: 1.6,
    orbitSpeed: 0.8,
    orbitRadius: 240,
    relationalSpin: 1.4,
    chaosFactor: 0.2,
    wanderSpeed: 0.5,
    gravitySoftening: 45,
    gravityFalloff: 1.45,
    swirlRadius: 500
  },
  pairwise: DEFAULT_PAIRWISE_CONFIG,
  chaining: {
    enabled: false,
    chain: ["\u25B2", "\u25A0", "\u2B1F", "\u2B22", "\u2BCE", "\u25C9"],
    mode: "loop",
    stepHoldDuration: 1,
    transitionDuration: 2.2,
    easing: "smoothstep",
    timingJitter: 0.15,
    disperseImpulse: 0.8,
    paused: false,
    advance: "time"
  },
  color: DEFAULT_COLOR_CONFIG,
  toroidalMorph: DEFAULT_TOROIDAL_CONFIG,
  medium: DEFAULT_MEDIUM_CONFIG,
  collision: DEFAULT_COLLISION_CONFIG,
  glyphVolume: DEFAULT_GLYPH_VOLUME,
  depth: DEFAULT_DEPTH_CONFIG,
  automations: [],
  entities: [
    makeFormation({
      id: "ent_main",
      name: "Main",
      shape: { kind: "glyph", text: "O" },
      sequence: { ...DEFAULT_SEQUENCE, links: [makeLink({ kind: "glyph", text: "O" }), makeLink({ kind: "glyph", text: "I" })], advance: "time", order: "pingpong", hold: 0.2, transition: 3.8 }
    })
  ],
  composition: DEFAULT_COMPOSITION,
  cymatics: DEFAULT_CYMATIC_MEDIUM,
  semanticField: {
    enabled: false,
    profile: { kind: "chakra", profileId: CHAKRA_PROFILE_ID },
    affinity: { method: "modalProjection", bandwidth: 0.14 },
    globalColorGain: 1,
    bindings: []
  },
  morphProgress: 0,
  autoMorph: true,
  autoMorphDuration: 4,
  positioning: "absolute"
};
export {
  DEFAULT_COLLISION_CONFIG,
  DEFAULT_COLOR_CONFIG,
  DEFAULT_CONFIG,
  DEFAULT_DEPTH_CONFIG,
  DEFAULT_MEDIUM_CONFIG,
  DEFAULT_PAIRWISE_CONFIG,
  DEFAULT_TOROIDAL_CONFIG
};
