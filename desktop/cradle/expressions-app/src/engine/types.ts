/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PointCloudFluidConfig {
  curlScale: number;       // Noise frequency
  curlSpeed: number;       // Noise temporal rate
  vortexStrength: number;  // Swirl torque between/around glyph centers
  viscosity: number;       // Velocity dissipation rate (damping 0.05 - 1.02)
  returnSpeed: number;     // Snapback spring constant (k) to target coordinates (-5 to 25)
  turbulence: number;      // Overall magnitude of noise perturbation
  dispersion: number;      // Drift / scatter impulse bridging glyphs
  // --- Extended physics (all optional; engine defaults reproduce the classic feel) ---
  snapRigidity?: number;   // Multiplier on the Hooke restoring force (default 1.0)
  densityTether?: number;  // How much stroke density stiffens the spring (0 = uniform, default 1.0)
  curlDepth?: number;      // Z-axis noise frequency relative to XY (default 0.57)
  vortexRadius?: number;   // Gaussian radius of the global / per-centre vortex in px (default 450)
  gravityX?: number;       // Constant body force X (default 0)
  gravityY?: number;       // Constant body force Y (default 0)
  gravityZ?: number;       // Constant body force Z (default 0)
  quadraticDrag?: number;  // Speed-squared drag coefficient (default 0)
  thermalJitter?: number;  // Brownian agitation magnitude (default 0)
  maxSpeed?: number;       // Hard velocity clamp (default 35000)
  zConfinement?: number;   // Per-frame Z decay toward the plane in flat modes (0 = free, 1 = classic, default 1)
  timeScale?: number;      // Simulation time multiplier (default 1)
  /** How far the global vortex becomes a true helical swirl about the depth axis (0..1, default 0). */
  vortex3d?: number;
  /** How far inter-glyph dispersion carries into the depth axis (0..1, default 0). */
  dispersion3d?: number;
}

export interface PlacedInteractionPoint {
  id: string;
  name?: string;
  x: number;
  y: number;
  z?: number; // 3D depth coordinate (-1000 to 1000, default 0)
  radius: number;
  strength: number;
  mode: 'repel' | 'attract' | 'vortex';
  active: boolean;
  /** Entity pins use Gaussian falloff; legacy points retain compact falloff. */
  falloff?: 'gaussian' | 'compact';
  spin?: number;
}

export interface PointCloudInteractionConfig {
  clickMode?:'pulse'|'implode'|'vortex'|'shove'|'off';
  clickStrength?:number;
  clickRadius?:number;
  radius: number;          // Mouse influence radius in world/pixel units
  strength: number;        // Push/pull or velocity advection strength
  mode: 'repel' | 'attract' | 'vortex'; // Interaction mode
  velocityInfluence?: number; // Cursor velocity injection multiplier (0.0 to 3.0)
  falloffPower?: number;      // Falloff exponent of pointer / pin influence (default 2)
  placedPoints?: PlacedInteractionPoint[]; // Placed persistent attractors/deflectors/vortices
}

export interface PointCloudRelationalConfig {
  enabled: boolean;          // Free relational multi-attractor system toggle
  mode?: 'orbital' | 'chaos' | 'nbody'; // Relational physics modality
  attractorCount?: number;    // Number of active dynamic attractors (2 to 6)
  attractorGravity?: number;  // Gravitational pull towards attractors (-20.0 to 30.0)
  orbitSpeed?: number;        // Orbital angular velocity (-10.0 to 10.0)
  orbitRadius?: number;       // Separation / orbital radius (0 to 1200px)
  relationalSpin?: number;    // Vortex swirl torque around attractor bodies (-20.0 to 20.0)
  chaosFactor?: number;       // Non-linear strange attractor turbulence (0 to 15.0)
  wanderSpeed?: number;       // Brownian / Lissajous wandering rate (0 to 10.0)
  gravitySoftening?: number;  // Plummer softening radius in px (default 45)
  gravityFalloff?: number;    // Potential falloff exponent (default 1.45)
  swirlRadius?: number;       // Gaussian radius of the orbital swirl around each attractor (default 500)
}

/**
 * Sorted-grid pairwise particle collisions (DEM-style contact response).
 * Default-off: absent or enabled=false reproduces the classic simulation exactly.
 */
export interface PairwiseConfig {
  enabled: boolean;
  radius?: number;      // Interaction radius h in world px (2..80, default 14; ~baked slot spacing)
  stiffness?: number;   // Separation spring strength (0..10, default 1)
  restitution?: number; // Normal damping on approach (0..1, default 0.2)
  viscosity?: number;   // Tangential relative-velocity smoothing (0..1, default 0.3)
  extent?: number;      // Collision-grid half-extent in world px (200..5000, default 1400)
}

export type ChainTraversalMode = 'loop' | 'pingpong' | 'randomWalk' | 'chaos' | 'shuffle';
export type ChainEasing = 'smoothstep' | 'linear' | 'kineticSnap' | 'whip';
/** 'time' = classic hold/transition timeline. 'morphCycle' = the morph oscillator is the clock: one toroidal cycle = one link. */
export type ChainAdvanceMode = 'time' | 'morphCycle';

/**
 * Shared Eulerian medium: a coarse grid fluid that particles inject momentum into
 * and are pushed around by (see mediumShaders.ts). Absent or `enabled: false`
 * keeps the simulation numerically identical to the classic engine.
 */
export interface MediumConfig {
  enabled: boolean;
  pressure?: number;      // pressure-gradient crowd repulsion gain (0..20, default 4)
  coupling?: number;      // velocity drag into the medium flow (0..4, default 0.8)
  persistence?: number;   // medium velocity retained per frame at 60fps (0.8..1.0, default 0.97)
  iterations?: number;    // Jacobi pressure steps per frame (1..12, default 4)
  gridRes?: number;       // square solver grid resolution (default 192)
  splatGain?: number;     // momentum injection scale (0..4, default 1)
  extent?: number;        // world half-extent the grid covers (200..5000, default 1400)
  plane?: 'compositionPlane' | 'world3d'; // media axes follow the composition plane, or always the XZ world floor
  dimension?: '2D' | '3D'; // solver topology: '2D' sheet (legacy default) or '3D' voxel volume (see mediumGrid.ts)
}

/**
 * Glyph SDF colliders: each formation's letterform acts as a solid boundary with
 * restitution/friction and energy-dependent integrity (fast particles punch
 * through; the wall heals as things calm down).
 */
export interface CollisionConfig {
  enabled: boolean;
  mode?: 'obstacle' | 'vessel'; // strokes solid vs strokes as containers
  restitution?: number;   // normal bounce on contact (0..1, default 0.35)
  friction?: number;      // tangential loss on contact (0..1, default 0.1)
  band?: number;          // influence band around the surface in px (5..200, default 40)
  strength?: number;      // soft push gain (0..20, default 4)
  integrity?: number;     // energy-dependent wall weakening (0..4, default 0.5)
}

/**
 * True 3D letterforms. When enabled, glyph targets are baked as a solid body
 * with real thickness instead of a flat card with z micro-noise (see
 * glyphVolume.ts for the law). Off by default: an existing composition bakes
 * byte-identically until this is switched on.
 */
export interface GlyphVolumeConfig {
  enabled: boolean;
  /** Full thickness of the body in stage units (the depth axis span). */
  depth: number;
  /** How thickness varies from the contour to the medial axis. */
  profile: 'slab' | 'bevel' | 'round' | 'dome' | 'taper';
  /** Scales the auto-derived stroke half-width that normalizes the profile. */
  referenceFalloff: number;
  /** Share of samples placed on the extruded side walls at the contour. */
  wallShare: number;
  /** Of the non-wall remainder, how much pins to the front/back faces. */
  faceBias: number;
  /** How far into the interior the body fill spreads (fraction of half-depth). */
  interiorFill: number;
  /** Micro-noise on the final z, in stage units. */
  jitter: number;
  /** -1..1: denser ink reads thicker (positive) or thinner (negative). */
  densityDepth: number;
  /** Face sheets occupy this many units inside the surface, keeping them crisp. */
  surfaceThickness: number;
  /** Contour band, in px, over which flank placement falls off inward. */
  wallBand: number;
  /** How far the outside stipple spray keeps any thickness, in reference widths. */
  outsideTaper: number;
}

/**
 * Depth presentation. The field renders orthographically by default, which is
 * why a real z body still reads flat: an orthographic camera has no
 * convergence, so distance cannot change size. These are the knobs that make
 * depth legible (see particleShaders.ts).
 */
export interface DepthRenderConfig {
  /** 'orthographic' keeps the planar drawing; 'perspective' gives real convergence. */
  projection: 'orthographic' | 'perspective';
  /** Vertical field of view in degrees (perspective only). */
  fov: number;
  /** Orbit radius of the camera, in world units. */
  distance: number;
  /** Strength of perspective point-size attenuation (0 = none, ortho-like). */
  sizeAttenuation: number;
  /** Exponent on the attenuation curve; >1 keeps far marks larger. */
  sizeAttenuationCurve: number;
  /** Aerial perspective: how strongly distance dims ink (0..1). */
  aerialFade: number;
  /** How far the falloff reaches, as a multiple of the orbit distance. */
  aerialRange: number;
  /** Extra size ramp with depth: near marks larger, far smaller (−1..1). */
  sizeDepthBias: number;
  /** Depth tone shift weight (0..1); mixed toward the fade colour. */
  depthTintWeight: number;
  /** Ink colour distant marks shift toward. */
  depthTintColor: string;
  /** Reversed-Z depth buffer so near bodies occlude far ones. */
  occlusion: boolean;
}

export interface PointCloudChainingConfig {
  enabled: boolean;                      // Sequenced morph chaining mode toggle
  chain: string[];                       // Array of glyphs or words in sequence
  mode: ChainTraversalMode;              // Traversal pattern
  stepHoldDuration: number;              // Hold/dwell duration on resolved link (seconds)
  transitionDuration: number;            // Morph interpolation duration (seconds)
  easing: ChainEasing;                   // Transition easing curve
  timingJitter: number;                  // Dynamic timing jitter / organic drift (0.0 to 1.0)
  disperseImpulse: number;               // Fluid shockwave burst kicked on transition (0.0 to 5.0)
  paused?: boolean;                      // Pause playback
  advance?: ChainAdvanceMode;            // What drives link transitions (default 'time')
}

export interface ChainTimelineState {
  currentIndex: number;
  nextIndex: number;
  currentGlyph: string;
  nextGlyph: string;
  phase: 'hold' | 'transition';
  progress: number; // 0.0 to 1.0
  elapsedInPhase: number;
  totalDurationInPhase: number;
}

export type ColorDistributionMode =
  | 'monochrome'
  | 'linearGradient'
  | 'radialGradient'
  | 'angularSweep'
  | 'velocityThermal'
  | 'densityDepth'
  | 'waveInterference'
  | 'rainbowSpectral';

export type BackgroundAtmosphereMode = 'solid' | 'vignette' | 'ambientGlow' | 'adaptive';

export type MorphTrajectoryMode = 'toroidalHopf' | 'linear' | 'vortexSpiral' | 'quantumInterference';
/** How the two conjugate phase oscillators combine into the morph drive */
export type MorphInterferenceMode = 'toroidalOnly' | 'product' | 'sum' | 'beat';
export type MorphDriveShape = 'sine' | 'triangle' | 'smooth' | 'pulse';

/**
 * Unified morph control system: two conjugate phase oscillators (toroidal θ and poloidal φ)
 * whose interference drives the A→B morph progress AND the Hopf manifold displacement.
 */
export interface ToroidalMorphConfig {
  enabled: boolean;
  trajectory: MorphTrajectoryMode;
  progress: number;                // 0.0 to 1.0
  autoOscillate: boolean;          // Auto-oscillating ping-pong or manual scrub
  oscillationSpeed: number;        // Rate in Hz (0.1 to 4.0, default 0.8)
  oscillationAmplitude: number;    // Vibrational breathing intensity (0.0 to 3.0, default 1.2)
  breathRate?: number;             // Breathing oscillator rate in Hz (default: the poloidal rate)
  breathDepth?: number;            // Breathing swell depth around unity (default 0.35)
  fiberPhaseOffset: number;        // Phase difference delta-psi between conjugate Hopf fibers (0 to 2*PI, default 0.0)
  toroidalWinding: number;         // p winding number (1 to 12, default 3)
  poloidalWinding: number;         // q winding number (1 to 12, default 2)
  chiralCoupling: number;          // Coupling/interference between left and right inverse Hopf fibrations (0.0 to 1.0, default 0.75)
  manifoldRadius: number;          // Dimensional scale of the toroidal manifold (50 to 450, default 180)
  volumetricDepthScale?: number;   // Volumetric 3D Z-depth expansion (0.1 to 3.0, default 1.0)
  // --- Dual-phase drive (all optional, defaults reproduce classic behaviour) ---
  poloidalRate?: number;           // Poloidal (second conjugate) phase rate in Hz (default 0.35)
  toroidalPhase?: number;          // Manual toroidal phase offset in radians (added to the running phase)
  poloidalPhase?: number;          // Manual poloidal phase offset in radians
  interference?: MorphInterferenceMode; // How θ and φ combine into the drive (default 'toroidalOnly')
  driveShape?: MorphDriveShape;    // Waveform of the progress drive (default 'sine')
  holdRatio?: number;              // Fraction of each cycle spent dwelling at A / B (0 to 0.9, default 0)
  driveDepth?: number;             // Depth of the drive around the midpoint (0 = frozen at 0.5, 1 = full A↔B, default 1)
}

export interface MorphTelemetry {
  progress: number;
  toroidalPhase: number;  // radians, unwrapped
  poloidalPhase: number;
  interference: number;   // -1..1 combined drive signal
}

// ---------------------------------------------------------------------------
// Parameter automation (LFOs & one-shot ramps on any registered parameter path)
// ---------------------------------------------------------------------------
export type AutomationWaveform = 'sine' | 'triangle' | 'square' | 'saw' | 'randomStep' | 'smoothRandom' | 'morph';
export type AutomationEasing = 'linear' | 'smooth' | 'easeIn' | 'easeOut' | 'elastic' | 'bounce';
export type AutomationLoop = 'none' | 'restart' | 'pingpong';

export interface AutomationLane {
  /** Shared runtime clock for linked lanes; targets and output ranges remain independent. */
  clockId?: string;
  id: string;
  path: string;                 // dot path into PointCloudConfig, e.g. 'fluid.curlScale'
  enabled: boolean;
  type: 'lfo' | 'oneShot';
  // LFO
  waveform?: AutomationWaveform;
  min?: number;
  max?: number;
  rateHz?: number;
  phase?: number;               // 0..1 cycle offset
  // One-shot ramp
  from?: number;
  to?: number;
  durationS?: number;
  easing?: AutomationEasing;
  loop?: AutomationLoop;
  fireToken?: number;           // bump to (re)trigger the ramp
  delayS?: number;              // delay before the ramp starts after firing
  blend?: 'replace' | 'add' | 'multiply'; // how the lane value combines with the base value (default replace)
}

export type CustomImageMode = 'luminance' | 'edgeSobel' | 'silhouette';

export interface CustomImageConfig {
  dataUrl?: string;
  name?: string;
  mode: CustomImageMode;
  threshold: number;      // 0.05 to 0.95
  invert: boolean;        // Invert luminance/edges
  scale: number;          // 0.2 to 2.0
}

export interface AsciiGlyphConfig {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  invert?: boolean;
}

export type SpatialCenterShapeType = 'glyph' | 'yantra' | 'cymatics' | 'image' | 'ascii';

export interface SpatialAnchorCenter {
  id: string;
  name: string;
  x: number;
  y: number;
  z?: number;
  scale: number;
  shapeType: SpatialCenterShapeType;
  glyphOrSymbol: string;
  cymaticFreqHz?: number;
  imageDataUrl?: string;
  asciiText?: string;
  color?: string;
  attractorStrength: number;
  active: boolean;
}

export interface SpatialCompositionConfig {
  enabled: boolean;
  name?: string;
  centers: SpatialAnchorCenter[];
  activeCenterIndex: number;
  playbackMode: 'simultaneous' | 'sequential';
  autoCycle: boolean;
  cycleDuration: number;
  holdDuration: number;
  plane: 'horizontal' | 'vertical';
}

export type SpatialChakraPlaybackMode = 'simultaneousBody' | 'sequentialMorph';
export type SpatialChakraGlyphType = 'yantra' | 'symbol' | 'seed' | 'both';
export type SpatialChakraPlane = 'horizontal' | 'vertical';

export type ChakraGeometryMode = 'yantra' | 'cymatics';
export type CymaticPlateGeometry = 'square' | 'circular' | 'volumetric3D';
export type CymaticDimension = '2D' | '3D';

export type CymaticsEngineMode = 'resonator' | 'template';
export type CymaticsSweepDirection = 'ascent' | 'descent' | 'pingpong';

export interface CymaticsSweepConfig {
  enabled: boolean;
  glideS: number;   // Glide duration between stations (seconds)
  dwellS: number;   // Dwell duration at each station (seconds)
  direction: CymaticsSweepDirection;
}

export interface CymaticsConfig {
  plateGeometry: CymaticPlateGeometry;  // 'square' (classic Chladni plate) | 'circular' (drum/liquid membrane) | 'volumetric3D' (acoustic cavity) — 'template' engine only
  dimension: CymaticDimension;          // '2D' (planar horizontal/vertical) | '3D' (volumetric standing wave nodal cages) — 'template' engine only
  frequencyHz: number;                  // Continuous acoustic frequency (300Hz to 1050Hz, default 396)
  autoSweep: boolean;                   // Continuous sweeping through the harmonic spectrum (legacy triangle sweep, 'template' engine)
  sweepSpeed: number;                   // Continuous sweep rate in seconds per octave / cycle ('template' engine)
  chaosIntensity: number;               // Chaotic agitation / Faraday instability factor between harmonics (0.0 to 3.0, default 1.5) — 'template' engine only
  nodalAttraction: number;              // Gravitational pull into Chladni zero-acceleration nodal lines (0.0 to 5.0, default 2.8) — 'template' engine only
  dampingQFactor: number;               // Sharpness of harmonic resonance basins (1.0 to 10.0, default 4.5); reused by the resonator as its shared Q
  chladniM?: number;                    // Optional manual override for modal m parameter ('template' engine only)
  chladniN?: number;                    // Optional manual override for modal n parameter ('template' engine only)

  // --- Continuous modal resonator engine (default for new configs) ---
  engine?: CymaticsEngineMode;          // 'resonator' (one continuously driven damped modal plate) | 'template' (legacy per-chakra baked Chladni target textures)
  baseFrequency?: number;               // f0: f_mn = f0 * (m^2 + n^2), tuned so the band spans ~80-1100Hz (default 40)
  driveStrength?: number;               // Point-excitation amplitude at the drive point (default 1.0)
  transportGain?: number;               // Gain on -grad(vibration intensity): pulls particles toward nodal regions (default 1.0)
  agitation?: number;                   // Random kick amplitude scaled by sqrt(local intensity) (default 0.3)
  plateSize?: number;                   // Square plate side L in world px (default 700)
  modeCount?: number;                   // Number of participating modes, ranked by drive coupling (<=64, default 64)
  boundaryStrength?: number;            // Soft-wall strength keeping particles on the finite plate (default 6.0)
  driveScale?: number;                  // Final scale applied to the raw envelope intensity field before it becomes force (default 1.0)
  sweep?: CymaticsSweepConfig;          // Uninterrupted glide-and-dwell sweep through all seven stations
}

export interface CameraOrbState {
  pitch: number;    // Orbit elevation angle (-Math.PI/2 to Math.PI/2)
  yaw: number;      // Orbit azimuth angle (0 to Math.PI * 2)
  zoom: number;     // Camera zoom factor (0.3 to 3.5, default 1.0)
  panX: number;     // Pan offset X (-1500 to 1500, default 0)
  panY: number;     // Pan offset Y (-1500 to 1500, default 0)
}

export type AnchorShapeType = 'yantra' | 'glyph' | 'cymatic';

/**
 * An anchored centre in a spatial composition. The canonical chakra body is one
 * composition preset; any anchor can instead render a free glyph/word or a cymatic plate.
 */
export interface SpatialChakraNode {
  id: string;
  shape?: AnchorShapeType;    // 'yantra' (sacred geometry keyed by id) | 'glyph' (free text) | 'cymatic' (Chladni at frequencyHz)
  glyphText?: string;         // Text rendered when shape === 'glyph'
  name: string;               // e.g. "Root (Muladhara)", "Heart (Anahata)"
  sanskrit: string;           // e.g. "मूलाधार", "अनाहत"
  seedSyllable: string;       // e.g. "लं", "वं", "रं", "यं", "हं", "ॐ", "☸"
  symbol: string;             // Yantra or sacred geometry symbol e.g. "🪷", "✡"
  englishTitle?: string;      // e.g. "Root / Earth"
  frequencyHz?: number;       // e.g. 396
  element?: string;           // e.g. "Earth"
  x: number;                  // Center X offset in world space (-500 to 500)
  y: number;                  // Center Y offset in world space (-400 to 400)
  z?: number;                 // Optional depth offset
  scale: number;              // Relative scale factor (0.15 to 0.9, default 0.35)
  color: string;              // Signature chakra hue hex (e.g. '#e53935')
  attractorStrength: number;  // Gravitational attractor pull (0.0 to 5.0)
  active: boolean;            // Whether this node is active
}

export interface SpatialChakraTimelineState {
  currentIndex: number;
  nextIndex: number;
  currentNode: SpatialChakraNode;
  nextNode: SpatialChakraNode;
  progress: number; // 0.0 to 1.0
  phase: 'hold' | 'transition';
  elapsedInPhase: number;
  totalDurationInPhase: number;
  // Cymatic real-time telemetry
  cymaticFrequency?: number;
  cymaticCoherence?: number;       // 0.0 (chaotic in-between state) to 1.0 (crystallized resonance lock)
  isResonanceLocked?: boolean;
  lockStrength?: number;
  chaosTurbulence?: number;
  cymaticStatus?: 'Resonance Lock' | 'Harmonic Transition' | 'Chaotic In-Between';
  modalM?: number;
  modalN?: number;
  modalL?: number;
}

export interface SpatialChakraConfig {
  enabled: boolean;                           // Master toggle for Spatial Chakra Body Mode
  geometryMode?: ChakraGeometryMode;          // 'yantra' (Sacred Yantra mandalas) vs 'cymatics' (Harmonic Chladni standing waves)
  cymatics?: CymaticsConfig;                  // Cymatic acoustic resonance configuration
  playbackMode: SpatialChakraPlaybackMode;     // 'simultaneousBody' (full constellation) vs 'sequentialMorph' (Kundalini ascent)
  glyphType: SpatialChakraGlyphType;           // 'seed' (Sanskrit Bija) vs 'symbol' (Sacred Yantra)
  nodes: SpatialChakraNode[];                 // Placed spatial nodes
  activeNodeIndex?: number;                   // Currently focused/morphing node in sequential mode
  transitionDuration?: number;                // Travel duration in seconds between nodes in space (default 2.5s)
  holdDuration?: number;                      // Rest duration in seconds at each chakra node (default 1.2s)
  autoCycle?: boolean;                        // Auto-travel along the chakra spine
  cycleDirection?: 'ascent' | 'descent' | 'pingpong'; // Ascent (Root->Crown), Descent, Pingpong
  attractorInfluence?: number;                // Global multiplier for placed attractor forces (0.0 to 3.0)
  particlePartitionSpread?: number;           // Cloud compactness for multi-node distribution (0.5 to 2.0)
  plane?: SpatialChakraPlane;                 // 'horizontal' (flat when viewed horizontally, spinning in X-Z) vs 'vertical' (facing front)
  vortexStrength?: number;                    // Individual vortex intensity per chakra (0.0 to 3.0, default 1.5)
  compositionName?: string;                   // Human label for the current anchor arrangement
}

/** Composition = the generalised anchored-centre system (same runtime as spatialChakra). */
export type CompositionConfig = SpatialChakraConfig;
export type CompositionAnchor = SpatialChakraNode;

export interface PointCloudColorConfig {
  enabled: boolean;                      // Whether procedural color field is enabled (true = dynamic colors, false = classic ink)
  mode: ColorDistributionMode;          // Spatial color distribution algorithm across the glyph
  primaryColor: string;                 // Hex e.g. '#00f0ff'
  secondaryColor: string;               // Hex e.g. '#ff007f'
  accentColor: string;                  // Hex e.g. '#ffe600'
  cycleSpeed: number;                   // Temporal wave propagation rate (-5.0 to 5.0, 0 = stationary)
  waveFrequency: number;                // Spatial scale / band density across glyph field (0.1 to 8.0)
  angle: number;                        // Wave travel / gradient angle in degrees (0 to 360)
  fieldCenterOffset: [number, number];  // Center offset [x, y] in normalized coordinates (-1.0 to 1.0)
  turbulenceModulation: number;         // Fluid curl noise warping on color coordinates (0.0 to 1.0)
  speedReactiveIntensity: number;       // Kinetic brightness & color shift under fluid velocity (0.0 to 2.0)
  densityWeight: number;                // Shading influence of particle density (0.0 to 1.0)
  hueShiftSpeed: number;                // Continuous temporal hue cycling rate (-2.0 to 2.0)
  contrast: number;                     // Sharpness / contrast between gradient stops (0.2 to 3.0)
  paletteId?: string;                   // Optional preset palette reference ID
  customPaletteColors?: string[];       // Dynamic user-defined color stops (2 to 8 hex strings)

  // Background atmosphere variability
  backgroundColor?: string;              // Custom background color hex (e.g. '#09090b', '#000000', '#fafaf9')
  backgroundMode?: BackgroundAtmosphereMode; // Atmospheric style: solid, vignette, ambientGlow, adaptive
  backgroundGlowIntensity?: number;      // 0.0 to 1.0 - glow intensity of particle color on background
}

export interface SequenceTelemetry {
  entityId: string;
  linkIndex: number;
  nextIndex: number;
  progress: number;
  phase: 'hold' | 'transition';
  linkCount: number;
}

export interface CompositionTelemetry {
  simTime: number;
  focus: { index: number; entityId: string; nextEntityId: string; blend: number } | null;
  sequences: SequenceTelemetry[];
  semantic?: import('./semantics/semanticTypes').SemanticFieldState;
  cymatic: {
    enabled: boolean;
    frequencyHz: number;
    coherence: number;
    dominantM: number;
    dominantN: number;
    nearestStation: number;
    stationProximity: number; // 0..1
    stations: Array<{ id:string; index:number; name:string; frequencyHz:number; m:number; n:number; color:string; energy?:number; semanticNodeId?:string; affinity?:number }>;
    driver?: {kind:'frequency'|'sweep'|'semanticFocus'; bound:boolean; semanticNodeId?:string; anchorId?:string};
  } | null;
}

export interface PointCloudConfig {
  /** Host-rendered paper surface, driven by the same automation clock. */
  paperGrain?: number;
  /** Granular mark rendering; no secondary particle simulation. */
  material?: Partial<Record<'sizeBias'|'opacity'|'roundness'|'softness'|'irregularity'|'elongation'|'orientation'|'contrast'|'densityScale'|'densityPhase'|'edgeWeight'|'halo',number>>;
  /** First-class field organisation (see fieldModel.ts). Legacy keys below are migrated into these on load. */
  entities?: import('./fieldModel').Entity[];
  composition?: import('./fieldModel').Composition;
  cymatics?: import('./fieldModel').CymaticMedium;
  /** Semantic interpretation/expression layer. Physics remains independent when absent/disabled. */
  semanticField?: import('./semantics/semanticTypes').SemanticFieldConfig;
  resonanceDrive?: import('./resonanceDrive').ResonanceDriveConfig;
  /** Shared Eulerian medium (default off; absent = disabled with defaults). */
  medium?: MediumConfig;
  /** Glyph SDF collision boundaries (default off; absent = disabled with defaults). */
  collision?: CollisionConfig;
  /** True 3D letterform bodies (default off; absent = flat cards with z noise). */
  glyphVolume?: GlyphVolumeConfig;
  /** Depth presentation: projection, attenuation and aerial perspective. */
  depth?: DepthRenderConfig;

  /** @deprecated legacy — migrated into entities[0] (kept only as migration input) */
  glyph: string | string[];           // e.g., ["O", "I"] or "OI" or "✦ ✧"
  sourceType?: 'glyph' | 'image' | 'ascii' | 'composition' | 'chakra';
  particleCount: number;             // Default: 200000 (nearest power texture e.g. 512x512=262144)
  fontFamily?: string;               // Default: system bold sans/serif
  fontWeight?: string | number;      // Default: 900
  colorMode: 'blackOnWhite' | 'whiteOnBlack';
  backgroundColor?: string;          // Direct background color hex override
  backgroundMode?: BackgroundAtmosphereMode; // Direct background atmosphere mode override
  backgroundGlowIntensity?: number;  // Direct background glow intensity override
  style: 'stipple' | 'halftone';     // Ink stipple vs matrix halftone
  dotShape?: 'circle' | 'square';    // Crisp circular stipple vs typographic square grid
  particleSize: { min: number; max: number };
  fluid: PointCloudFluidConfig;
  interaction: PointCloudInteractionConfig;
  relational?: PointCloudRelationalConfig;
  pairwise?: PairwiseConfig;
  chaining?: PointCloudChainingConfig;
  spatialChakra?: SpatialChakraConfig;
  toroidalMorph?: ToroidalMorphConfig;
  customImage?: CustomImageConfig;
  asciiGlyph?: AsciiGlyphConfig;
  color?: PointCloudColorConfig;
  automations?: AutomationLane[]; // Parameter automation lanes (LFO / one-shot)
  morphProgress?: number;            // 0.0 = glyph A, 1.0 = glyph B
  autoMorph?: boolean;               // Ping-pong morphing between glyph A & B
  autoMorphDuration?: number;        // Duration in seconds for full morph cycle
  positioning?: 'fixed' | 'absolute' | 'relative';
  containerClassName?: string;
  debug?: boolean;
}

export interface GlyphSampleData {
  positionsA: Float32Array; // (x, y, z, density) per particle
  positionsB: Float32Array; // (x, y, z, density) per particle for morphing
  width: number;
  height: number;
  textureWidth: number;
  textureHeight: number;
}

export interface ThemeColorProfile {
  id: string;
  name: string;
  timestamp: number;
  colorMode: 'blackOnWhite' | 'whiteOnBlack';
  backgroundColor: string;
  backgroundMode: BackgroundAtmosphereMode;
  backgroundGlowIntensity: number;
  color: PointCloudColorConfig;
}

export interface MaterialParticleProfile {
  id: string;
  name: string;
  timestamp: number;
  style: 'stipple' | 'halftone';
  dotShape: 'circle' | 'square';
  particleSize: { min: number; max: number };
  particleCount: number;
  fluid: PointCloudFluidConfig;
}
