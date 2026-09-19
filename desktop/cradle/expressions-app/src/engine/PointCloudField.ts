import {TransportState,validateTransport} from './transportState';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import {
  PointCloudConfig,
  PointCloudColorConfig,
  CameraOrbState,
  ToroidalMorphConfig,
  MorphTelemetry,
  PlacedInteractionPoint,
  CompositionTelemetry,
  MediumConfig,
  CollisionConfig,
  PairwiseConfig,
  GlyphVolumeConfig,
  DepthRenderConfig,
} from './types';
import { DEFAULT_GLYPH_VOLUME } from './glyphVolume';
import { applyAutomations, createAutomationRuntime, AutomationRuntime, AutomationLiveValue } from './automation';
import { GPGPUSimulator } from './GPGPUSimulator';
import { GlyphSampler } from './GlyphSampler';
import { particleVertexShader, particleFragmentShader } from './shaders/particleShaders';
import { isLightHex } from './colorPalettes';
import { CymaticResonator, ResonatorTelemetry, type ResonanceState, type ResonanceAnchor } from './cymaticResonator';
import { PinMarkerLayer, PinGhostState } from './pinMarkers';
import { EntityRuntime, EntityFrame } from './entityRuntime';
import type { EvaluatedEntityPose } from './entityPose';
import { compileEntityForceEmitters, relationalCarrierStates, type ForceEmitterState, type RelationalCarrierState } from './forceRuntime';
import { SemanticFieldRuntime } from './semantics/semanticFieldRuntime';
import type { SemanticFieldState } from './semantics/semanticTypes';
import { CHAKRA_BY_ID } from './semantics/chakraSemantics';
import { mapChakrasToAnchors, CHAKRA_PROFILE_ID } from './semantics/chakraProfile';
import { semanticFocusTarget, type ResonanceDriveConfig, type ResolvedResonanceDrive } from './resonanceDrive';
import type { SourceAnalysis } from './sourceSampling';
import {
  Entity,
  Composition,
  CymaticMedium,
  FocusState,
  DEFAULT_COMPOSITION,
  DEFAULT_CYMATIC_MEDIUM,
  DEFAULT_SEQUENCE,
  makeFormation,
  makeLink,
  resolveFocus,
} from './fieldModel';

/** A retained image/ASCII source, kept so the pool can be re-derived against a new true-3D law. */
interface CustomSourceRecord {
  kind: 'image' | 'ascii';
  entityId: string;
  linkId?: string;
  /** The decoded element (image) or the raw text (ASCII) the pool was sampled from. */
  input: CanvasImageSource | ImageData | string;
  options: Record<string, unknown>;
}

export function getColorModeIndex(mode?: string): number {
  switch (mode) {
    case 'monochrome': return 0;
    case 'linearGradient': return 1;
    case 'radialGradient': return 2;
    case 'angularSweep': return 3;
    case 'velocityThermal': return 4;
    case 'densityDepth': return 5;
    case 'waveInterference': return 6;
    case 'rainbowSpectral': return 7;
    default: return 1;
  }
}

export const DEFAULT_COLOR_CONFIG: PointCloudColorConfig = {
  enabled: false,
  mode: 'linearGradient',
  primaryColor: '#00f0ff',
  secondaryColor: '#ff007f',
  accentColor: '#ffe600',
  cycleSpeed: 1.2,
  waveFrequency: 1.8,
  angle: 45,
  fieldCenterOffset: [0, 0],
  turbulenceModulation: 0.35,
  speedReactiveIntensity: 0.6,
  densityWeight: 0.5,
  hueShiftSpeed: 0.0,
  contrast: 1.0,
  paletteId: 'cyberpunk_neon',
  backgroundColor: '#09090b',
  backgroundMode: 'ambientGlow',
  backgroundGlowIntensity: 0.45,
};

export const DEFAULT_TOROIDAL_CONFIG: ToroidalMorphConfig = {
  enabled: false,
  trajectory: 'toroidalHopf',
  progress: 0.5,
  autoOscillate: true,
  oscillationSpeed: 0.8,
  oscillationAmplitude: 1.2,
  breathRate: 0.35,
  breathDepth: 0.35,
  fiberPhaseOffset: 0.0,
  toroidalWinding: 3.0,
  poloidalWinding: 2.0,
  chiralCoupling: 0.75,
  manifoldRadius: 180,
  volumetricDepthScale: 1.0,
  poloidalRate: 0.35,
  toroidalPhase: 0,
  poloidalPhase: 0,
  interference: 'toroidalOnly',
  driveShape: 'sine',
  holdRatio: 0,
  driveDepth: 1,
};

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const DEFAULT_MEDIUM_CONFIG: MediumConfig = {
  enabled: false,
  pressure: 4,
  coupling: 0.8,
  persistence: 0.97,
  iterations: 4,
  gridRes: 192,
  splatGain: 1,
  extent: 1400,
  plane: 'compositionPlane',
  dimension: '2D',
};

export const DEFAULT_COLLISION_CONFIG: CollisionConfig = {
  enabled: false,
  mode: 'obstacle',
  restitution: 0.35,
  friction: 0.1,
  band: 40,
  strength: 4,
  integrity: 0.5,
};

/** Sorted-grid pairwise collisions; default-off (see types.ts PairwiseConfig). */
export const DEFAULT_PAIRWISE_CONFIG: PairwiseConfig = {
  enabled: false,
  radius: 2.2,
  stiffness: 1.0,
  restitution: 0.12,
  viscosity: 0.06,
  extent: 1400,
};
export {computeMorphDrive} from './morphSignal';
import {computeMorphDrive,MorphDriveState} from './morphSignal';


export type SpatialGridMode = 'off' | 'axis' | 'grid';

/**
 * Depth presentation defaults. Projection stays orthographic so the instrument
 * opens exactly as it did; the depth system is switched on from the studio,
 * where the projection, attenuation and aerial-perspective knobs live.
 */
export const DEFAULT_DEPTH_CONFIG: DepthRenderConfig = {
  projection: 'orthographic',
  fov: 38,
  distance: 800,
  sizeAttenuation: 1,
  sizeAttenuationCurve: 1,
  aerialFade: 0.55,
  aerialRange: 2.2,
  sizeDepthBias: 0,
  depthTintWeight: 0,
  depthTintColor: '#101018',
  occlusion: false,
};

export const DEFAULT_CONFIG: PointCloudConfig = {
  glyph: ['O', 'I'],
  particleCount: 200000,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontWeight: 900,
  colorMode: 'blackOnWhite',
  backgroundColor: '#09090b',
  backgroundMode: 'ambientGlow',
  backgroundGlowIntensity: 0.45,
  style: 'stipple',
  dotShape: 'circle',
  particleSize: { min: 0.16, max: 1.6 },
  fluid: {
    curlScale: 1.2,
    curlSpeed: 0.6,
    vortexStrength: 1.4,
    viscosity: 0.94,
    returnSpeed: 1.1,
    turbulence: 1.0,
    dispersion: 0.65,
    snapRigidity: 1.0,
    densityTether: 1.0,
    curlDepth: 0.57,
    vortexRadius: 450,
    gravityX: 0,
    gravityY: 0,
    gravityZ: 0,
    quadraticDrag: 0,
    thermalJitter: 0,
    maxSpeed: 35000,
    zConfinement: 1.0,
    timeScale: 1.0,
    vortex3d: 0,
    dispersion3d: 0,
  },
  interaction: {
    radius: 180,
    strength: 1.2,
    mode: 'repel',
    velocityInfluence: 1.0,
    falloffPower: 2.0,
    placedPoints: [],
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
    gravitySoftening: 45,
    gravityFalloff: 1.45,
    swirlRadius: 500,
  },
  pairwise: DEFAULT_PAIRWISE_CONFIG,
  chaining: {
    enabled: false,
    chain: ['▲', '■', '⬟', '⬢', '⯎', '◉'],
    mode: 'loop',
    stepHoldDuration: 1.0,
    transitionDuration: 2.2,
    easing: 'smoothstep',
    timingJitter: 0.15,
    disperseImpulse: 0.8,
    paused: false,
    advance: 'time',
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
      id: 'ent_main',
      name: 'Main',
      shape: { kind: 'glyph', text: 'O' },
      sequence: { ...DEFAULT_SEQUENCE, links: [makeLink({ kind: 'glyph', text: 'O' }), makeLink({ kind: 'glyph', text: 'I' })], advance: 'time', order: 'pingpong', hold: 0.2, transition: 3.8 },
    }),
  ],
  composition: DEFAULT_COMPOSITION,
  cymatics: DEFAULT_CYMATIC_MEDIUM,
  semanticField: {
    enabled: false,
    profile: { kind: 'chakra', profileId: CHAKRA_PROFILE_ID },
    affinity: { method: 'modalProjection', bandwidth: 0.14 },
    globalColorGain: 1,
    bindings: [],
  },
  morphProgress: 0.0,
  autoMorph: true,
  autoMorphDuration: 4.0,
  positioning: 'absolute',
};


export class PointCloudField {
  public canvas: HTMLCanvasElement;
  public config: PointCloudConfig;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  /**
   * Two projections, one rig. The orbit controller drives both cameras
   * identically; `depth.projection` selects which one draws. Orthographic is the
   * original drawing instrument — parallel lines stay parallel and a glyph is
   * seen face-on. Perspective adds the convergence that makes depth legible, and
   * is what the true-3D glyph bodies are authored against.
   */
  private orthoCamera: THREE.OrthographicCamera;
  private perspCamera: THREE.PerspectiveCamera;
  private get camera(): THREE.Camera {
    return this.cameraProjection === 'perspective' ? this.perspCamera : this.orthoCamera;
  }
  private cameraProjection: DepthRenderConfig['projection'] = 'orthographic';
  private gridGroup: THREE.Group | null = null;
  private axisGroup: THREE.Group | null = null;
  private gridMode: SpatialGridMode = 'off';
  private gridIsLight: boolean | null = null;
  private pinLayer: PinMarkerLayer | null = null;
  private simulator!: GPGPUSimulator;
  private glyphSampler!: GlyphSampler;
  private entities!: EntityRuntime;

  private particleGeometry!: THREE.BufferGeometry;
  private particleMaterial!: THREE.ShaderMaterial;
  private particlePoints!: THREE.Points;

  // Animation & Clock (the ONE clock: simTime)
  private clock: THREE.Clock;
  private animFrameId: number | null = null;
  private isDestroyed: boolean = false;
  private simTime: number = 0;
  private seedGeneration = 0;

  // Field-level manual morph scrub (entities with sequence.advance === 'off')
  private morphProgress: number = 0.0;

  // Composition state derived per frame (no timers)
  private lastFrames: EntityFrame[] = [];
  private lastFocus: FocusState | null = null;
  private focusTint: THREE.Color = new THREE.Color('#ffffff');
  private activeEntityId: string | null = null;
  private lastPoses: EvaluatedEntityPose[] = [];
  private lastForceEmitters: ForceEmitterState[] = [];
  private lastRelationalCarriers: RelationalCarrierState[] = [];
  private semanticRuntime = new SemanticFieldRuntime();
  private latestSemanticState: SemanticFieldState = { nodes: [], colorFields: [] };
  private lastResonanceDrive: ResolvedResonanceDrive = { kind: 'frequency', targetHz: 396, bound: true };

  // Cymatic medium: one continuously driven resonator (see cymaticResonator.ts)
  private cymaticResonator: CymaticResonator | null = null;
  private latestResonatorTelemetry: ResonatorTelemetry | null = null;
  private resonatorActive: boolean = false;
  private cymaticFreqCurrent: number = 396;
  private sweepAccum: number = 0;

  // 3D Orbit Camera State (Orb Camera Control)
  private cameraState: CameraOrbState = { pitch: 0, yaw: 0, zoom: 1.0, panX: 0, panY: 0 };
  private isOrbitDragging: boolean = false;
  private isPanDragging: boolean = false;
  private panModeEnabled: boolean = false;
  private lastDragPointerX: number = 0;
  private lastDragPointerY: number = 0;
  private onCameraChangeCallback: ((state: CameraOrbState) => void) | null = null;

  // Unified morph oscillator + automation runtime
  private torPhaseAcc: number = 0;
  private polPhaseAcc: number = 0;
  private breathPhaseAcc: number = 0;
  private lastDrive: MorphDriveState | null = null;
  private automationRt: AutomationRuntime = createAutomationRuntime();
  private telemetryAccum: number = 0;
  private onMorphUpdateCallback: ((t: MorphTelemetry) => void) | null = null;
  private onAutomationUpdateCallback: ((live: AutomationLiveValue[]) => void) | null = null;
  private onCompositionUpdateCallback: ((t: CompositionTelemetry) => void) | null = null;

  // Pointer state
  private pointerPos: THREE.Vector2 = new THREE.Vector2(-99999, -99999);
  private pointerVel: THREE.Vector2 = new THREE.Vector2(0, 0);
  private lastPointerPos: THREE.Vector2 = new THREE.Vector2(-99999, -99999);
  private lastPointerTime: number = 0;

  // Bound listeners
  private onPointerMoveBound: (e: PointerEvent) => void;
  private onPointerLeaveBound: () => void;
  private onResizeBound: () => void;
  private onCanvasWheelBound: (e: WheelEvent) => void;
  private onCanvasPointerDownBound: (e: PointerEvent) => void;
  private onWindowPointerUpBound: (e: PointerEvent) => void;
  private onCanvasContextMenuBound: (e: MouseEvent) => void;

  constructor(canvas: HTMLCanvasElement, options: Partial<PointCloudConfig> = {}, private readonly hosted = false) {
    this.canvas = canvas;
    this.config = this.mergeConfig(DEFAULT_CONFIG, options);
    this.morphProgress = this.config.morphProgress ?? 0.0;
    this.cymaticFreqCurrent = this.config.cymatics?.frequencyHz ?? 396;
    this.clock = new THREE.Clock();

    // 1. Initialize WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    this.renderer.setPixelRatio(dpr);

    const hostSize = this.hosted ? this.renderer.getSize(new THREE.Vector2()) : null;
    const width = hostSize?.x ?? (this.canvas.clientWidth || window.innerWidth);
    const height = hostSize?.y ?? (this.canvas.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height, false);

    // 2. Scene + orbit camera rig + scaffolds
    this.scene = new THREE.Scene();
    this.orthoCamera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, -3000, 4000);
    this.perspCamera = new THREE.PerspectiveCamera(DEFAULT_DEPTH_CONFIG.fov, width / Math.max(1, height), 1, 100000);
    this.cameraProjection = this.config.depth?.projection === 'perspective' ? 'perspective' : 'orthographic';
    this.updateCameraTransform();
    this.initGridAndAxes();
    this.pinLayer = new PinMarkerLayer(this.scene);

    // 3. GPGPU simulation + entity runtime (partitions, targets, sequences)
    this.simulator = new GPGPUSimulator(this.renderer, this.config.particleCount);
    this.glyphSampler = new GlyphSampler();
    this.entities = new EntityRuntime(this.glyphSampler);
    this.initEntities(true);

    // 4. Particle render pipeline
    this.initParticlePipeline(width, height, dpr);

    // 5. Event listeners
    this.onPointerMoveBound = this.handlePointerMove.bind(this);
    this.onPointerLeaveBound = this.handlePointerLeave.bind(this);
    this.onResizeBound = this.handleResize.bind(this);
    this.onCanvasWheelBound = this.handleCanvasWheel.bind(this);
    this.onCanvasPointerDownBound = this.handleCanvasPointerDown.bind(this);
    this.onWindowPointerUpBound = this.handleWindowPointerUp.bind(this);
    this.onCanvasContextMenuBound = (e: MouseEvent) => e.preventDefault();

    if (!this.hosted) {
    window.addEventListener('pointermove', this.onPointerMoveBound, { passive: false });
    window.addEventListener('pointerleave', this.onPointerLeaveBound, { passive: true });
    window.addEventListener('resize', this.onResizeBound, { passive: true });
    window.addEventListener('pointerup', this.onWindowPointerUpBound, { passive: true });
    this.canvas.addEventListener('wheel', this.onCanvasWheelBound, { passive: false });
    this.canvas.addEventListener('pointerdown', this.onCanvasPointerDownBound, { passive: false });
    this.canvas.addEventListener('contextmenu', this.onCanvasContextMenuBound);

    // 6. Start
    this.clock.start();
    this.tick();
    }
  }

  // ------------------------------------------------------------------ config
  private mergeConfig(base: PointCloudConfig, override: Partial<PointCloudConfig>): PointCloudConfig {
    const comp: Composition = {
      ...(base.composition || DEFAULT_COMPOSITION),
      ...(override.composition || {}),
      orchestration: { ...(base.composition || DEFAULT_COMPOSITION).orchestration, ...(override.composition?.orchestration || {}) },
    };
    return {
      ...base,
      ...override,
      particleSize: { ...base.particleSize, ...override.particleSize },
      fluid: { ...base.fluid, ...override.fluid },
      interaction: { ...base.interaction, ...override.interaction },
      relational: { enabled:false, ...base.relational, ...override.relational },
      pairwise: { enabled:false, ...base.pairwise, ...override.pairwise },
      color: {
        ...(base.color || DEFAULT_COLOR_CONFIG),
        ...(override.color || {}),
        fieldCenterOffset: override.color?.fieldCenterOffset
          ? [...override.color.fieldCenterOffset]
          : base.color?.fieldCenterOffset
          ? [...base.color.fieldCenterOffset]
          : [0, 0],
        customPaletteColors: override.color?.customPaletteColors
          ? [...override.color.customPaletteColors]
          : base.color?.customPaletteColors
          ? [...base.color.customPaletteColors]
          : undefined,
      },
      toroidalMorph: override.toroidalMorph !== undefined ? { ...DEFAULT_TOROIDAL_CONFIG, ...override.toroidalMorph } : base.toroidalMorph,
      medium: { ...DEFAULT_MEDIUM_CONFIG, ...base.medium, ...override.medium },
      collision: { ...DEFAULT_COLLISION_CONFIG, ...base.collision, ...override.collision },
      glyphVolume: { ...DEFAULT_GLYPH_VOLUME, ...(base.glyphVolume || {}), ...(override.glyphVolume || {}) } as GlyphVolumeConfig,
      depth: { ...DEFAULT_DEPTH_CONFIG, ...(base.depth || {}), ...(override.depth || {}) } as DepthRenderConfig,
      entities: override.entities !== undefined ? override.entities : base.entities,
      composition: comp,
      cymatics: { ...(base.cymatics || DEFAULT_CYMATIC_MEDIUM), ...(override.cymatics || {}) } as CymaticMedium,
      resonanceDrive: override.resonanceDrive !== undefined ? override.resonanceDrive : base.resonanceDrive,
      semanticField: override.semanticField !== undefined ? {
        ...override.semanticField,
        profile: { ...override.semanticField.profile },
        affinity: { ...override.semanticField.affinity },
        bindings: override.semanticField.bindings.map((b) => ({
          ...b,
          resonance: b.resonance ? { ...b.resonance } : undefined,
          carriers: b.carriers.map((c) => ({ ...c })),
          color: b.color ? { ...b.color, radius: { ...b.color.radius } } : undefined,
          modulations: b.modulations?.map((m) => ({ ...m, source: { ...m.source }, clamp: m.clamp ? [...m.clamp] as [number, number] : undefined })),
        })),
      } : base.semanticField,
      automations: override.automations !== undefined ? override.automations : base.automations,
    };
  }

  private formations(): Entity[] {
    return (this.config.entities || []).filter((e) => e.kind === 'formation' && e.enabled);
  }

  /** Allocate partitions + bake targets for the current entities. seed=true reseeds particle positions. */
  private initEntities(seed: boolean) {
    const cfg = this.config;
    const comp = cfg.composition || DEFAULT_COMPOSITION;
    this.entities.allocate(this.simulator.particleCount, this.simulator.texWidth, this.simulator.texHeight);
    // Bilinear SDF sampling when the device can filter float textures (smooth distance falloff).
    if (this.entities.collisionTexture && this.renderer.capabilities.isWebGL2 && this.renderer.extensions.has('OES_texture_float_linear')) {
      this.entities.collisionTexture.minFilter = THREE.LinearFilter;
      this.entities.collisionTexture.magFilter = THREE.LinearFilter;
      this.entities.collisionTexture.needsUpdate = true;
    }
    this.entities.setBaseContext(cfg.style, cfg.fontFamily, cfg.fontWeight, comp.plane, cfg.cymatics);
    this.entities.setVolume(cfg.glyphVolume);
    this.entities.layout(cfg.entities || []);
    const resolved = this.entities.update(cfg.entities || [], comp, this.simTime, this.lastDrive?.theta ?? 0, this.morphProgress, cfg.toroidalMorph?.holdRatio ?? 0, cfg.fontFamily, cfg.fontWeight);
    this.lastPoses = resolved.poses;
    const depthForms = !!(cfg.glyphVolume?.enabled && (cfg.glyphVolume?.depth ?? 0) > 0);
    this.lastForceEmitters = compileEntityForceEmitters(cfg.entities || [], resolved.poses, cfg.interaction.placedPoints || [], depthForms ? 'world3d' : 'compositionPlane');
    this.simulator.setTargetTextures(this.entities.textureA!, this.entities.textureB!, this.entities.fieldCentre(), this.entities.noiseTexture!);
    this.simulator.setEntityState(this.entities.uniforms);
    this.simulator.setCollisionState(this.entities.collisionTiles, this.entities.collisionTexture);
    this.simulator.setForceEmitters(this.lastForceEmitters);
    this.simulator.setCompositionPlane(comp.plane);
    if (seed) { this.seedGeneration++; this.simulator.seedInitialState(this.entities.buildSeed()); }
  }

  /** Explicit reset: particles jump to their current targets. The only user-driven reseed. */
  public resetField() {
    this.burstVelocity.set(0, 0);
    this.burstRadial = 0;
    this.burstSpin = 0;
    this.seedGeneration++;
    this.simulator.seedInitialState(this.entities.buildSeed());
    this.resetMorphPhases();
  }

  public setActiveEntity(id: string | null) {
    this.activeEntityId = id;
  }

  public getActiveEntity(): string | null {
    return this.activeEntityId;
  }

  /** World centre of an entity this frame (entity position + current link offset) */
  public getEntityCentre(id: string): { x: number; y: number; z: number } | null {
    const parts = this.entities.getPartitions();
    const i = parts.findIndex((p) => p.entityId === id);
    if (i >= 0 && i < 10) {
      const c = this.entities.uniforms.centers[i];
      return { x: c.x, y: c.y, z: c.z };
    }
    const e = (this.config.entities || []).find((x) => x.id === id);
    return e ? { x: e.x, y: e.y, z: e.z } : null;
  }

  /**
   * Tears down and recreates the simulation textures and render geometry for a new particle
   * count, then re-bakes and reseeds. Camera, grid, pins and config all persist.
   */
  private rebuildParticleSystem() {
    const hostSize = this.hosted ? this.renderer.getSize(new THREE.Vector2()) : null;
    const width = hostSize?.x ?? (this.canvas.clientWidth || window.innerWidth);
    const height = hostSize?.y ?? (this.canvas.clientHeight || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);

    if (this.particlePoints) this.scene.remove(this.particlePoints);
    if (this.particleGeometry) this.particleGeometry.dispose();
    if (this.particleMaterial) this.particleMaterial.dispose();
    if (this.simulator) this.simulator.destroy();

    this.simulator = new GPGPUSimulator(this.renderer, this.config.particleCount);
    this.initEntities(true);
    this.initParticlePipeline(width, height, dpr);
    this.resonatorActive = false;
    this.updateConfig({});
  }

  private initParticlePipeline(width: number, height: number, dpr: number) {
    const totalCount = this.simulator.particleCount;
    const texW = this.simulator.texWidth;
    const texH = this.simulator.texHeight;

    const uvs = new Float32Array(totalCount * 2);
    for (let i = 0; i < totalCount; i++) {
      const x = i % texW;
      const y = Math.floor(i / texW);
      uvs[i * 2 + 0] = (x + 0.5) / texW;
      uvs[i * 2 + 1] = (y + 0.5) / texH;
    }

    this.particleGeometry = new THREE.BufferGeometry();
    // Use dummy positions for attribute; vertex shader reads actual coords from simulation texture
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(totalCount * 3), 3));
    this.particleGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    const effectiveBg = this.config.backgroundColor || this.config.color?.backgroundColor;
    const isLightMode = effectiveBg ? isLightHex(effectiveBg) : (this.config.colorMode === 'blackOnWhite');
    const particleColor = isLightMode ? new THREE.Color(0x0a0a0a) : new THREE.Color(0xf5f5f5);

    const col = this.config.color || DEFAULT_COLOR_CONFIG;
    const primaryCol = new THREE.Color(col.primaryColor || '#00f0ff');
    const secondaryCol = new THREE.Color(col.secondaryColor || '#ff007f');
    const accentCol = new THREE.Color(col.accentColor || '#ffe600');
    const colorAngleRad = ((col.angle ?? 45) * Math.PI) / 180;
    const colorCenter = new THREE.Vector2(
      (col.fieldCenterOffset?.[0] ?? 0) * 300,
      (col.fieldCenterOffset?.[1] ?? 0) * 300
    );

    this.particleMaterial = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: {
        uPositionTexture: { value: this.simulator.currentPosTarget.texture },
        uVelocityTexture: { value: this.simulator.currentVelTarget.texture },
        uMinParticleSize: { value: this.config.particleSize.min },
        uMaxParticleSize: { value: this.config.particleSize.max },
        uStyleMode: { value: this.config.style === 'halftone' ? 1.0 : 0.0 },
        uDotShape: { value: this.config.dotShape === 'square' ? 1.0 : 0.0 },
        uParticleColor: { value: particleColor },
        uColorMode: { value: isLightMode ? 0.0 : 1.0 },
        uContrast: { value: 1.0 },
        uGrainA: {value: new THREE.Vector4(1, 1, 1, 0)}, // size bias, opacity, roundness, softness
        uGrainB: {value: new THREE.Vector4(0, 0, 0, 1)}, // edge irregularity, elongation, orientation radians, density contrast
        uGrainC: {value: new THREE.Vector4(1, 0, 0, 1)}, // density scale, density phase, edge emphasis, halo
        uGrainEnabled: {value: 0},
        uPixelRatio: { value: dpr },
        uCanvasSize: { value: new THREE.Vector2(width, height) },
        uTime: { value: 0.0 },

        // Depth presentation (see types.ts DepthRenderConfig): perspective
        // attenuation and aerial perspective. Pushed from pushDepthUniforms().
        uDepthEnabled: { value: 0 },
        uPerspective: { value: 0 },
        uCameraDistance: { value: this.orbitDistance() },
        uViewHeight: { value: height },
        uSizeAttenuation: { value: DEFAULT_DEPTH_CONFIG.sizeAttenuation },
        uSizeAttenuationCurve: { value: DEFAULT_DEPTH_CONFIG.sizeAttenuationCurve },
        uSizeDepthBias: { value: DEFAULT_DEPTH_CONFIG.sizeDepthBias },
        uAerialFade: { value: DEFAULT_DEPTH_CONFIG.aerialFade },
        uAerialRange: { value: DEFAULT_DEPTH_CONFIG.aerialRange },
        uDepthTintWeight: { value: DEFAULT_DEPTH_CONFIG.depthTintWeight },
        uDepthTint: { value: new THREE.Color(DEFAULT_DEPTH_CONFIG.depthTintColor) },

        // Procedural Color Field Uniforms
        uColorEnabled: { value: col.enabled ? 1.0 : 0.0 },
        uColorDistMode: { value: getColorModeIndex(col.mode) },
        uPrimaryColor: { value: primaryCol },
        uSecondaryColor: { value: secondaryCol },
        uAccentColor: { value: accentCol },
        uColorCycleSpeed: { value: col.cycleSpeed ?? 1.2 },
        uColorWaveFrequency: { value: col.waveFrequency ?? 1.8 },
        uColorAngle: { value: colorAngleRad },
        uColorCenter: { value: colorCenter },
        uColorTurbulence: { value: col.turbulenceModulation ?? 0.35 },
        uColorSpeedReactive: { value: col.speedReactiveIntensity ?? 0.6 },
        uColorDensityWeight: { value: col.densityWeight ?? 0.5 },
        uColorHueShift: { value: 0.0 },
        uColorContrast: { value: col.contrast ?? 1.0 },
        uPaletteColors: {
          value: [
            new THREE.Color(col.primaryColor || '#00f0ff'),
            new THREE.Color(col.secondaryColor || '#ff007f'),
            new THREE.Color(col.accentColor || '#ffe600'),
            new THREE.Color('#ffffff'),
            new THREE.Color('#ffffff'),
            new THREE.Color('#ffffff'),
            new THREE.Color('#ffffff'),
            new THREE.Color('#ffffff'),
          ],
        },
        uColorStopCount: {
          value: col.customPaletteColors && col.customPaletteColors.length >= 2 ? col.customPaletteColors.length : 0,
        },

        // Entity tints (per partition) + composition focus tint
        uEditHasSelection: {value:0},
        uEditSelected: {value:new Float32Array(10)},
        uEntityCount: { value: 0 },
        uEntityBounds: { value: new Float32Array(10) },
        uEntityTint: { value: Array.from({ length: 10 }, () => new THREE.Color('#ffffff')) },
        uEntityTintWeight: { value: new Float32Array(10) },
        uTexSize: { value: new THREE.Vector2(texW, texH) },
        uFocusTint: { value: new THREE.Color('#ffffff') },
        uFocusTintWeight: { value: 0.0 },

        // Semantic spatial colour is a render-only contribution field. It does not own particles or forces.
        uCompPlane: { value: (this.config.composition || DEFAULT_COMPOSITION).plane === 'horizontal' ? 1.0 : 0.0 },
        uSemanticColorCount: { value: 0 },
        uSemanticColorCenter: { value: Array.from({ length: 16 }, () => new THREE.Vector4(-99999, -99999, 0, 1)) },
        uSemanticColorValue: { value: Array.from({ length: 16 }, () => new THREE.Vector4(1, 1, 1, 0)) },
        uSemanticColorParams: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 0, 0)) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.particlePoints = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.particlePoints.frustumCulled = false;
    this.scene.add(this.particlePoints);
  }


  private handleCanvasWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    this.setCameraZoom(this.cameraState.zoom * zoomFactor);
  }

  private handleCanvasPointerDown(e: PointerEvent) {
    // Right Click or Alt + Left Click -> Orbit Drag
    if (e.button === 2 || (e.button === 0 && e.altKey)) {
      this.isOrbitDragging = true;
      this.lastDragPointerX = e.clientX;
      this.lastDragPointerY = e.clientY;
      e.preventDefault();
    }
    // Middle Click, Shift + Left Click, or Left Click while Pan Mode is engaged -> Pan Drag
    else if (e.button === 1 || (e.button === 0 && (e.shiftKey || this.panModeEnabled))) {
      this.isPanDragging = true;
      this.lastDragPointerX = e.clientX;
      this.lastDragPointerY = e.clientY;
      e.preventDefault();
    }
  }

  private handleWindowPointerUp() {
    this.isOrbitDragging = false;
    this.isPanDragging = false;
  }

  private handlePointerMove(e: PointerEvent) {
    if (this.isOrbitDragging) {
      const dx = e.clientX - this.lastDragPointerX;
      const dy = e.clientY - this.lastDragPointerY;
      this.lastDragPointerX = e.clientX;
      this.lastDragPointerY = e.clientY;

      this.setCameraOrbit(
        this.cameraState.pitch + dy * 0.007,
        this.cameraState.yaw - dx * 0.007
      );
      return;
    }

    if (this.isPanDragging) {
      const dx = e.clientX - this.lastDragPointerX;
      const dy = e.clientY - this.lastDragPointerY;
      this.lastDragPointerX = e.clientX;
      this.lastDragPointerY = e.clientY;

      this.setCameraPan(
        this.cameraState.panX - (dx / this.cameraState.zoom),
        this.cameraState.panY + (dy / this.cameraState.zoom)
      );
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Centered coordinates mapped through camera pan and zoom
    const rawX = x - rect.width / 2;
    const rawY = -(y - rect.height / 2);
    const worldX = rawX / this.cameraState.zoom + this.cameraState.panX;
    const worldY = rawY / this.cameraState.zoom + this.cameraState.panY;

    const now = performance.now();
    const dt = Math.max(0.001, (now - this.lastPointerTime) / 1000);

    if (this.lastPointerPos.x > -90000) {
      const vx = (worldX - this.lastPointerPos.x) / dt;
      const vy = (worldY - this.lastPointerPos.y) / dt;
      // Exponential velocity smoothing
      this.pointerVel.x = this.pointerVel.x * 0.4 + vx * 0.6;
      this.pointerVel.y = this.pointerVel.y * 0.4 + vy * 0.6;
    }

    this.pointerPos.set(worldX, worldY);
    this.lastPointerPos.set(worldX, worldY);
    this.lastPointerTime = now;
  }

  private handlePointerLeave() {
    this.pointerPos.set(-99999, -99999);
    this.pointerVel.set(0, 0);
    this.lastPointerPos.set(-99999, -99999);
  }

  /** Distance from the orbit target to the eye, for the active projection. */
  private orbitDistance(): number {
    return Math.max(1, this.config.depth?.distance ?? DEFAULT_DEPTH_CONFIG.distance);
  }

  /**
   * Applies the viewport to whichever camera draws. Orthographic keeps its
   * original framebuffer-pixel frustum; perspective derives its aspect from the
   * viewport and frames the target plane so that the two projections cover a
   * comparable world extent at zoom 1 — switching projection should not jump the
   * subject's scale.
   */
  private applyProjection(width: number, height: number) {
    const depth = this.config.depth ?? DEFAULT_DEPTH_CONFIG;
    const aspect = width / Math.max(1, height);

    this.orthoCamera.left = -width / 2;
    this.orthoCamera.right = width / 2;
    this.orthoCamera.top = height / 2;
    this.orthoCamera.bottom = -height / 2;
    this.orthoCamera.near = -3000;
    this.orthoCamera.far = 4000;
    this.orthoCamera.zoom = this.cameraState.zoom;
    this.orthoCamera.updateProjectionMatrix();

    const fov = Math.max(4, Math.min(120, depth.fov ?? DEFAULT_DEPTH_CONFIG.fov));
    this.perspCamera.fov = fov;
    this.perspCamera.aspect = aspect;
    this.perspCamera.near = Math.max(0.1, this.orbitDistance() * 0.01);
    this.perspCamera.far = this.orbitDistance() * 40 + 20000;
    this.perspCamera.zoom = this.cameraState.zoom;
    this.perspCamera.updateProjectionMatrix();
  }

  /**
   * World height of the viewport at the target plane, for the active camera.
   * Callers that only care about framing extent (capture, aspect fitting) can
   * stay projection-agnostic through this.
   */
  private viewHeight(): number {
    if (this.cameraProjection === 'perspective') {
      const fov = (this.perspCamera.fov * Math.PI) / 180;
      return 2 * this.orbitDistance() * Math.tan(fov / 2) / Math.max(0.0001, this.perspCamera.zoom);
    }
    return this.orthoCamera.top - this.orthoCamera.bottom;
  }

  public updateCameraTransform() {
    if (!this.canvas) return;
    const hostSize = this.hosted ? this.renderer.getSize(new THREE.Vector2()) : null;
    const width = hostSize?.x ?? (this.canvas.clientWidth || window.innerWidth);
    const height = hostSize?.y ?? (this.canvas.clientHeight || window.innerHeight);

    this.applyProjection(width, height);

    const D = this.orbitDistance();
    const { pitch, yaw, panX, panY } = this.cameraState;

    const targetX = panX;
    const targetY = panY;
    const targetZ = 0;

    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);

    const camX = targetX + D * cosPitch * sinYaw;
    const camY = targetY + D * sinPitch;
    const camZ = targetZ + D * cosPitch * cosYaw;

    // The rig is shared: both cameras sit at the same eye and look at the same
    // target, so a projection switch is only a change of lens.
    for (const cam of [this.orthoCamera, this.perspCamera]) {
      cam.position.set(camX, camY, camZ);
      if (Math.abs(cosPitch) < 0.01) {
        cam.up.set(0, 0, pitch > 0 ? -1 : 1);
      } else {
        cam.up.set(0, 1, 0);
      }
      cam.lookAt(targetX, targetY, targetZ);
      cam.updateMatrixWorld(true);
    }

    this.pushDepthUniforms();
  }

  /**
   * Depth presentation state the shader needs to size and tone marks by
   * distance. The eye distance is a uniform rather than a shader-side guess so
   * the attenuation curve is anchored to the same rig the physics sees.
   */
  private pushDepthUniforms() {
    if (!this.particleMaterial) return;
    const u = this.particleMaterial.uniforms;
    const depth = this.config.depth ?? DEFAULT_DEPTH_CONFIG;
    const persp = this.cameraProjection === 'perspective';
    const fov = (this.perspCamera.fov * Math.PI) / 180;
    const viewH = persp ? this.viewHeight() : 0;
    // The tint is depth presentation too — without it in the gate, Depth Tint
    // silently dies in orthographic when fade and bias are zero.
    u.uDepthEnabled.value = persp || depth.aerialFade > 0.0001 || depth.sizeDepthBias !== 0 || (depth.depthTintWeight ?? 0) > 0 ? 1 : 0;
    // Surfaces occlude: near marks win the pixel through the depth buffer and
    // far marks are rejected. Off — the original instrument — every mark draws.
    // Legacy 'on'/'off' strings predate the boolean coercion and are honoured.
    const occlude = depth.occlusion === true || (depth.occlusion as unknown as string) === 'on';
    this.particleMaterial.depthTest = occlude;
    this.particleMaterial.depthWrite = occlude;
    u.uPerspective.value = persp ? 1 : 0;
    u.uCameraDistance.value = this.orbitDistance();
    u.uViewHeight.value = viewH;
    u.uSizeAttenuation.value = Math.max(0, depth.sizeAttenuation ?? 0);
    u.uSizeAttenuationCurve.value = Math.max(0.01, depth.sizeAttenuationCurve ?? 1);
    u.uSizeDepthBias.value = Math.max(-1, Math.min(1, depth.sizeDepthBias ?? 0));
    u.uAerialFade.value = Math.max(0, Math.min(1, depth.aerialFade ?? 0));
    u.uAerialRange.value = Math.max(0.1, depth.aerialRange ?? DEFAULT_DEPTH_CONFIG.aerialRange);
    u.uDepthTintWeight.value = Math.max(0, Math.min(1, depth.depthTintWeight ?? 0));
    u.uDepthTint.value.set(depth.depthTintColor ?? DEFAULT_DEPTH_CONFIG.depthTintColor);
  }

  public setCameraOrbit(pitch: number, yaw: number) {
    this.cameraState.pitch = Math.max(-Math.PI * 0.47, Math.min(Math.PI * 0.47, pitch));
    this.cameraState.yaw = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    this.updateCameraTransform();
    this.emitCameraChange();
  }

  public setCameraPan(panX: number, panY: number) {
    this.cameraState.panX = Math.max(-4000, Math.min(4000, panX));
    this.cameraState.panY = Math.max(-4000, Math.min(4000, panY));
    this.updateCameraTransform();
    this.emitCameraChange();
  }

  public setCameraZoom(zoom: number) {
    this.cameraState.zoom = Math.max(0.1, Math.min(6.0, zoom));
    this.updateCameraTransform();
    this.emitCameraChange();
  }

  public resetCamera(preset?: 'perspective' | 'flat' | 'top') {
    if (preset === 'top') {
      this.cameraState.pitch = Math.PI * 0.47;
      this.cameraState.yaw = 0;
    } else if (preset === 'perspective') {
      this.cameraState.pitch = 0.52;
      this.cameraState.yaw = 0.20;
    } else {
      // Default: clean face-on central front view
      this.cameraState.pitch = 0;
      this.cameraState.yaw = 0;
    }
    this.cameraState.panX = 0;
    this.cameraState.panY = 0;
    this.cameraState.zoom = 1.0;
    this.updateCameraTransform();
    this.emitCameraChange();
  }

  private isLightScene(): boolean {
    const effectiveBg = this.config.backgroundColor || this.config.color?.backgroundColor;
    return effectiveBg ? isLightHex(effectiveBg) : this.config.colorMode === 'blackOnWhite';
  }

  /**
   * Builds two independent scaffolds:
   *  - axisGroup: a very subtle XYZ axis triad through the origin with faint tick marks
   *  - gridGroup: full 3D coordinate scaffold (XY / XZ / YZ planes through origin) used for pin placement
   */
  public initGridAndAxes() {
    if (this.gridGroup) {
      this.scene.remove(this.gridGroup);
      this.gridGroup.traverse((o) => {
        const m = o as THREE.LineSegments;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (m.material as THREE.Material).dispose();
      });
    }
    if (this.axisGroup) {
      this.scene.remove(this.axisGroup);
      this.axisGroup.traverse((o) => {
        const m = o as THREE.LineSegments;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (m.material as THREE.Material).dispose();
      });
    }

    const isLight = this.isLightScene();
    this.gridIsLight = isLight;

    const axisX = new THREE.Color(isLight ? 0xc2410c : 0xff6b81); // coral
    const axisY = new THREE.Color(isLight ? 0x047857 : 0x34d399); // emerald
    const axisZ = new THREE.Color(isLight ? 0x0369a1 : 0x22d3ee); // cyan
    const neutral = new THREE.Color(isLight ? 0x57534e : 0xa1a1aa);

    const pushLine = (pos: number[], col: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Color) => {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    };

    // ---------- AXIS (minimal, very subtle) ----------
    this.axisGroup = new THREE.Group();
    this.axisGroup.name = 'spatialAxisGroup';
    {
      const pos: number[] = [];
      const col: number[] = [];
      const len = 900;
      pushLine(pos, col, new THREE.Vector3(-len, 0, 0), new THREE.Vector3(len, 0, 0), axisX);
      pushLine(pos, col, new THREE.Vector3(0, -len, 0), new THREE.Vector3(0, len, 0), axisY);
      pushLine(pos, col, new THREE.Vector3(0, 0, -len), new THREE.Vector3(0, 0, len), axisZ);
      // Tick marks every 100 units (small crosses)
      const tick = 6;
      for (let t = -len; t <= len; t += 100) {
        if (t === 0) continue;
        const major = t % 500 === 0;
        const tl = major ? tick * 2 : tick;
        pushLine(pos, col, new THREE.Vector3(t, -tl, 0), new THREE.Vector3(t, tl, 0), neutral);
        pushLine(pos, col, new THREE.Vector3(-tl, t, 0), new THREE.Vector3(tl, t, 0), neutral);
        pushLine(pos, col, new THREE.Vector3(-tl, 0, t), new THREE.Vector3(tl, 0, t), neutral);
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: isLight ? 0.28 : 0.22,
        depthWrite: false,
        depthTest: false,
      });
      this.axisGroup.add(new THREE.LineSegments(geom, mat));
    }
    this.scene.add(this.axisGroup);

    // ---------- FULL GRID (3D scaffold for coordinate reading / pin placement) ----------
    this.gridGroup = new THREE.Group();
    this.gridGroup.name = 'spatialGridGroup';
    {
      const size = 1600;
      const step = 100;
      const half = size / 2;
      const subtle = new THREE.Color(isLight ? 0xc9c4bf : 0x52525b);
      const major = new THREE.Color(isLight ? 0x8f8a85 : 0x8b8b94);

      const buildPlane = (plane: 'xy' | 'xz' | 'yz', opacity: number) => {
        const pos: number[] = [];
        const col: number[] = [];
        for (let i = -half; i <= half; i += step) {
          const isMajor = Math.abs(i) < 1 || Math.abs(i) % 500 === 0;
          const c = isMajor ? major : subtle;
          if (plane === 'xy') {
            pushLine(pos, col, new THREE.Vector3(i, -half, 0), new THREE.Vector3(i, half, 0), Math.abs(i) < 1 ? axisY : c);
            pushLine(pos, col, new THREE.Vector3(-half, i, 0), new THREE.Vector3(half, i, 0), Math.abs(i) < 1 ? axisX : c);
          } else if (plane === 'xz') {
            pushLine(pos, col, new THREE.Vector3(i, 0, -half), new THREE.Vector3(i, 0, half), Math.abs(i) < 1 ? axisZ : c);
            pushLine(pos, col, new THREE.Vector3(-half, 0, i), new THREE.Vector3(half, 0, i), Math.abs(i) < 1 ? axisX : c);
          } else {
            pushLine(pos, col, new THREE.Vector3(0, i, -half), new THREE.Vector3(0, i, half), Math.abs(i) < 1 ? axisZ : c);
            pushLine(pos, col, new THREE.Vector3(0, -half, i), new THREE.Vector3(0, half, i), Math.abs(i) < 1 ? axisY : c);
          }
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        const mat = new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity,
          depthWrite: false,
          depthTest: false,
        });
        return new THREE.LineSegments(geom, mat);
      };

      this.gridGroup.add(buildPlane('xy', isLight ? 0.5 : 0.42));
      this.gridGroup.add(buildPlane('xz', isLight ? 0.24 : 0.18));
      this.gridGroup.add(buildPlane('yz', isLight ? 0.24 : 0.18));
    }
    this.scene.add(this.gridGroup);

    this.applyGridVisibility();
  }

  private applyGridVisibility() {
    if (this.axisGroup) this.axisGroup.visible = this.gridMode === 'axis' || this.gridMode === 'grid';
    if (this.gridGroup) this.gridGroup.visible = this.gridMode === 'grid';
  }

  public setGridMode(mode: SpatialGridMode) {
    this.gridMode = mode;
    if (this.gridIsLight !== this.isLightScene()) {
      this.initGridAndAxes();
    }
    this.applyGridVisibility();
  }

  public getGridMode(): SpatialGridMode {
    return this.gridMode;
  }

  /** Back-compat shim: visible => full grid, hidden => off */
  public setGridVisible(visible: boolean) {
    this.setGridMode(visible ? 'grid' : 'off');
  }

  public getGridVisible(): boolean {
    return this.gridMode !== 'off';
  }

  public setPanMode(enabled: boolean) {
    this.panModeEnabled = enabled;
    if (!enabled) this.isPanDragging = false;
    this.canvas.style.cursor = enabled ? 'grab' : '';
  }

  public getPanMode(): boolean {
    return this.panModeEnabled;
  }

  public setCameraState(state: Partial<CameraOrbState>) {
    if (typeof state.pitch === 'number') this.cameraState.pitch = Math.max(-Math.PI * 0.47, Math.min(Math.PI * 0.47, state.pitch));
    if (typeof state.yaw === 'number') this.cameraState.yaw = ((state.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (typeof state.zoom === 'number') this.cameraState.zoom = Math.max(0.1, Math.min(6.0, state.zoom));
    if (typeof state.panX === 'number') this.cameraState.panX = Math.max(-4000, Math.min(4000, state.panX));
    if (typeof state.panY === 'number') this.cameraState.panY = Math.max(-4000, Math.min(4000, state.panY));
    this.updateCameraTransform();
    this.emitCameraChange();
  }

  public projectWorldToScreen(x: number, y: number, z: number = 0): { x: number; y: number; visible: boolean } {
    if (!this.camera || !this.canvas) return { x: 0, y: 0, visible: false };
    const vec = new THREE.Vector3(x, y, z);
    vec.project(this.camera);
    const hostSize = this.hosted ? this.renderer.getSize(new THREE.Vector2()) : null;
    const width = hostSize?.x ?? (this.canvas.clientWidth || window.innerWidth);
    const height = hostSize?.y ?? (this.canvas.clientHeight || window.innerHeight);
    return {
      x: (vec.x * 0.5 + 0.5) * width,
      y: (-vec.y * 0.5 + 0.5) * height,
      visible: vec.z >= -1 && vec.z <= 1,
    };
  }

  public unprojectScreenToWorld(screenX: number, screenY: number, planeZ: number = 0): { x: number; y: number; z: number } {
    if (!this.camera || !this.canvas) return { x: 0, y: 0, z: planeZ };
    const hostSize = this.hosted ? this.renderer.getSize(new THREE.Vector2()) : null;
    const width = hostSize?.x ?? (this.canvas.clientWidth || window.innerWidth);
    const height = hostSize?.y ?? (this.canvas.clientHeight || window.innerHeight);
    const ndcX = (screenX / width) * 2 - 1;
    const ndcY = -(screenY / height) * 2 + 1;
    const origin = new THREE.Vector3(ndcX, ndcY, -1).unproject(this.camera);
    const dir = new THREE.Vector3(0, 0, -1).transformDirection(this.camera.matrixWorld);
    const ray = new THREE.Ray(origin, dir);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
    const target = new THREE.Vector3();
    ray.intersectPlane(plane, target);
    return { x: target.x || 0, y: target.y || 0, z: target.z || planeZ };
  }

  /** Pushes the current spatial-pin data into the in-scene marker layer (tiny 3D dots + selected/ghost influence volume). */
  public setPinMarkers(points: PlacedInteractionPoint[], activeId: string | null, ghost: PinGhostState | null): void {
    this.pinLayer?.update(points, activeId, ghost, this.isLightScene(), this.camera);
  }

  /** Returns the id of the nearest pin whose projected screen position is within thresholdPx of (screenX, screenY), or null. */
  public pickPin(screenX: number, screenY: number, points: PlacedInteractionPoint[], thresholdPx: number = 10): string | null {
    let bestId: string | null = null;
    let bestDist = thresholdPx;
    for (const p of points) {
      const pos = this.projectWorldToScreen(p.x, p.y, p.z ?? 0);
      if (!pos.visible) continue;
      const d = Math.hypot(pos.x - screenX, pos.y - screenY);
      if (d <= bestDist) {
        bestDist = d;
        bestId = p.id;
      }
    }
    return bestId;
  }

  public getCameraState(): CameraOrbState {
    return { ...this.cameraState };
  }

  public setOnCameraChange(cb: ((state: CameraOrbState) => void) | null) {
    this.onCameraChangeCallback = cb;
    if (cb) cb({ ...this.cameraState });
  }

  private emitCameraChange() {
    if (this.onCameraChangeCallback) {
      this.onCameraChangeCallback({ ...this.cameraState });
    }
  }

  public resize() {
    this.handleResize();
  }

  private handleResize() {
    if (!this.canvas || this.isDestroyed) return;
    const hostSize = this.hosted ? this.renderer.getSize(new THREE.Vector2()) : null;
    const width = hostSize?.x ?? (this.canvas.clientWidth || window.innerWidth);
    const height = hostSize?.y ?? (this.canvas.clientHeight || window.innerHeight);

    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);

    this.updateCameraTransform();

    if (this.particleMaterial) {
      this.particleMaterial.uniforms.uPixelRatio.value = dpr;
      this.particleMaterial.uniforms.uCanvasSize.value.set(width, height);
    }
  }


  /** Complete document replacement, unlike the public incremental updateConfig API.
   * Replacing a scene must not inherit its predecessor's optional palettes/sources. */
  public replaceConfig(config: PointCloudConfig) {
    this.applyConfig(this.mergeConfig(DEFAULT_CONFIG, config));
  }

  public updateConfig(newConfig: Partial<PointCloudConfig>) {
    this.applyConfig(this.mergeConfig(this.config, newConfig));
  }

  private applyConfig(config: PointCloudConfig) {
    const prev = this.config;
    this.config = config;
    const cfg = this.config;

    if (Math.floor(cfg.particleCount) !== this.simulator.particleCount) {
      this.rebuildParticleSystem();
      return;
    }

    const comp = cfg.composition || DEFAULT_COMPOSITION;
    const styleChanged = prev.style !== cfg.style || prev.fontFamily !== cfg.fontFamily || prev.fontWeight !== cfg.fontWeight;
    if (styleChanged) this.glyphSampler.clearCache();
    this.entities.setBaseContext(cfg.style, cfg.fontFamily, cfg.fontWeight, comp.plane, cfg.cymatics);
    const volumeChanged = this.entities.setVolume(cfg.glyphVolume);
    if (volumeChanged) {
      // Every planar source re-measures its body against the new law, exactly
      // as the glyph pools do; the next update() bakes the fresh pools.
      this.rederiveCustomSources();
    }
    if ((prev.composition || DEFAULT_COMPOSITION).plane !== comp.plane) this.simulator.setCompositionPlane(comp.plane);

    // Projection and depth presentation: a change here is a change of lens, not of
    // scene, so the rig is simply re-applied (and the shader uniforms refreshed)
    // rather than reseeding anything.
    const prevDepth = prev.depth ?? DEFAULT_DEPTH_CONFIG;
    const nextDepth = cfg.depth ?? DEFAULT_DEPTH_CONFIG;
    const depthChanged = JSON.stringify(prevDepth) !== JSON.stringify(nextDepth);
    if (depthChanged) {
      this.cameraProjection = nextDepth.projection === 'perspective' ? 'perspective' : 'orthographic';
      this.updateCameraTransform();
    }
    if (volumeChanged && prev.glyphVolume?.enabled !== cfg.glyphVolume?.enabled) {
      // The body lives in the target texture, so switching the law on or off has
      // to reseed from the freshly baked targets or particles keep the old depth.
      this.seedCurrentTargets();
    }

    // Entity edits: partition layout is recomputed; bakes happen lazily in the next tick only for
    // partitions whose shapes changed. Positions / forces / tints are uniforms — no bake, no reseed.
    this.entities.layout(cfg.entities || []);

    // Update canvas background styling
    const effectiveBg = this.config.backgroundColor || this.config.color?.backgroundColor;
    if (effectiveBg && this.canvas && !this.hosted) {
      this.canvas.style.backgroundColor = effectiveBg;
    }

    // Re-tint the spatial scaffold when the scene flips between light and dark
    if (this.gridIsLight !== null && this.gridIsLight !== this.isLightScene()) {
      this.initGridAndAxes();
    }

    // Update material uniforms
    if (this.particleMaterial) {
      const isLightMode = effectiveBg ? isLightHex(effectiveBg) : (this.config.colorMode === 'blackOnWhite');
      const particleColor = isLightMode ? new THREE.Color(0x0a0a0a) : new THREE.Color(0xf5f5f5);

      this.particleMaterial.uniforms.uParticleColor.value.copy(particleColor);
      this.particleMaterial.uniforms.uColorMode.value = isLightMode ? 0.0 : 1.0;
      this.particleMaterial.uniforms.uMinParticleSize.value = this.config.particleSize.min;
      this.particleMaterial.uniforms.uMaxParticleSize.value = this.config.particleSize.max;
      this.particleMaterial.uniforms.uStyleMode.value = this.config.style === 'halftone' ? 1.0 : 0.0;
      this.particleMaterial.uniforms.uDotShape.value = this.config.dotShape === 'square' ? 1.0 : 0.0;

      const col = this.config.color || DEFAULT_COLOR_CONFIG;
      this.particleMaterial.uniforms.uColorEnabled.value = col.enabled ? 1.0 : 0.0;
      this.particleMaterial.uniforms.uColorDistMode.value = getColorModeIndex(col.mode);
      this.particleMaterial.uniforms.uPrimaryColor.value.set(col.primaryColor || '#00f0ff');
      this.particleMaterial.uniforms.uSecondaryColor.value.set(col.secondaryColor || '#ff007f');
      this.particleMaterial.uniforms.uAccentColor.value.set(col.accentColor || '#ffe600');
      this.particleMaterial.uniforms.uColorCycleSpeed.value = col.cycleSpeed ?? 1.2;
      this.particleMaterial.uniforms.uColorWaveFrequency.value = col.waveFrequency ?? 1.8;
      this.particleMaterial.uniforms.uColorAngle.value = ((col.angle ?? 45) * Math.PI) / 180;
      this.particleMaterial.uniforms.uColorCenter.value.set(
        (col.fieldCenterOffset?.[0] ?? 0) * 300,
        (col.fieldCenterOffset?.[1] ?? 0) * 300
      );
      this.particleMaterial.uniforms.uColorTurbulence.value = col.turbulenceModulation ?? 0.35;
      this.particleMaterial.uniforms.uColorSpeedReactive.value = col.speedReactiveIntensity ?? 0.6;
      this.particleMaterial.uniforms.uColorDensityWeight.value = col.densityWeight ?? 0.5;
      this.particleMaterial.uniforms.uColorContrast.value = col.contrast ?? 1.0;

      // Update custom palette stops
      const pColors = this.particleMaterial.uniforms.uPaletteColors.value as THREE.Color[];
      if (col.customPaletteColors && col.customPaletteColors.length >= 2) {
        const count = Math.min(8, col.customPaletteColors.length);
        for (let i = 0; i < 8; i++) {
          if (i < count) {
            pColors[i].set(col.customPaletteColors[i]);
          } else {
            pColors[i].set('#ffffff');
          }
        }
        this.particleMaterial.uniforms.uColorStopCount.value = count;
      } else {
        pColors[0].set(col.primaryColor || '#00f0ff');
        pColors[1].set(col.secondaryColor || '#ff007f');
        pColors[2].set(col.accentColor || '#ffe600');
        this.particleMaterial.uniforms.uColorStopCount.value = 0;
      }
    }
  }


  private sourceAnalyses = new Map<string, SourceAnalysis>();

  /** Last sampling analysis per entity, for status lines and previews. */
  public getSourceAnalysis(entityId?: string): SourceAnalysis | undefined {
    const id = entityId ?? this.formations()[0]?.id;
    return id ? this.sourceAnalyses.get(id) : undefined;
  }

  /** Keyed exactly like the runtime's custom candidate pools. */
  private static sourceKey(entityId: string, linkId?: string): string {
    return linkId ? `${entityId}:${linkId}` : entityId;
  }

  private customSourceInputs = new Map<string, CustomSourceRecord>();

  private retainCustomSource(record: CustomSourceRecord) {
    this.customSourceInputs.set(PointCloudField.sourceKey(record.entityId, record.linkId), record);
  }

  /**
   * Re-derives every retained image/ASCII pool against the current true-3D law.
   * Glyph pools re-rasterize when the law changes; the masks must follow, or a
   * law toggled after loading would leave half the scene flat.
   */
  private rederiveCustomSources() {
    if (!this.customSourceInputs.size) return;
    for (const record of [...this.customSourceInputs.values()]) {
      if (record.kind === 'image') {
        if (typeof record.input === 'string') continue;
        this.loadCustomImage(record.input, record.options, record.entityId, record.linkId);
      } else {
        if (typeof record.input !== 'string') continue;
        this.loadAsciiArt(record.input, record.options, record.entityId, record.linkId);
      }
    }
  }

  public loadCustomImage(img: CanvasImageSource | ImageData, options: { mode?: 'luminance' | 'edgeSobel' | 'silhouette'; threshold?: number; invert?: boolean; scale?: number } = {}, entityId?: string, linkId?:string): SourceAnalysis | null {
    const target = entityId ? this.formations().find(e=>e.id===entityId) : this.formations()[0];
    if (!target) return null;
    const { candidates, analysis } = this.glyphSampler.rasterizeCustomImage(img, options);
    if (entityId) this.sourceAnalyses.set(entityId, analysis);
    this.entities.setCustomCandidates(target.id, candidates,linkId);
    this.retainCustomSource({ kind: 'image', entityId: target.id, linkId, input: img, options });
    return analysis;
  }

  public loadAsciiArt(asciiText: string, options: { fontFamily?: string; fontSize?: number; invert?: boolean } = {}, entityId?: string, linkId?:string): SourceAnalysis | null {
    const target = entityId ? this.formations().find(e=>e.id===entityId) : this.formations()[0];
    if (!target) return null;
    const { candidates, analysis } = this.glyphSampler.rasterizeAscii(asciiText, options);
    if (entityId) this.sourceAnalyses.set(entityId, analysis);
    this.entities.setCustomCandidates(target.id, candidates,linkId);
    this.retainCustomSource({ kind: 'ascii', entityId: target.id, linkId, input: asciiText, options });
    return analysis;
  }

  public clearCustomSource(entityId?: string,linkId?:string) {
    const id = entityId ?? this.formations()[0]?.id;
    if (id) {
      this.sourceAnalyses.delete(id);
      this.customSourceInputs.delete(PointCloudField.sourceKey(id, linkId));
      this.entities.setCustomCandidates(id, null,linkId);
    }
  }

  public setMorphProgress(progress: number) {
    if(!Number.isFinite(progress))throw new Error('Invalid morph progress');
    this.morphProgress = Math.max(0.0, Math.min(1.0, progress));
    this.config = {...this.config,morphProgress:this.morphProgress};
  }

  public getMorphProgress(): number {
    return this.morphProgress;
  }

  /** Queued click-effect impulse, consumed by the velocity shader and decayed each step. */
  private burstVelocity = new THREE.Vector2();
  private burstPosition = new THREE.Vector2();
  private burstZ = 0;
  private burstRadius = 150;
  private burstRadial = 0;
  private burstSpin = 0;
  public triggerDisperse(strength: number = 3.0) {
    if (!Number.isFinite(strength)) throw new Error('Invalid disperse strength');
    this.burstVelocity.set((Math.random() - 0.5) * 600 * strength, (Math.random() - 0.5) * 600 * strength);
    this.burstRadial = 0;
    this.burstSpin = 0;
    this.burstPosition.copy(this.pointerPos.x > -90000 ? this.pointerPos : this.entities.fieldCentre());
    this.burstZ = this.pointerPos.x > -90000 ? this.hostPointerZ : this.entities.fieldCentreZ();
  }

  /** Momentary pointer click effect. Coordinates are native world pixels. */
  public triggerPointerEffect(kind: 'pulse' | 'implode' | 'vortex' | 'shove', x: number, y: number, strength = 1, radius = 150, z = 0) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(strength) || !Number.isFinite(radius) || !Number.isFinite(z)) {
      throw new Error('Invalid pointer effect');
    }
    this.burstPosition.set(x, y);
    this.burstZ = z;
    this.burstRadius = Math.max(8, Math.abs(radius));
    this.burstVelocity.set(0, 0);
    const power = 950 * strength;
    this.burstRadial = kind === 'pulse' ? power : kind === 'implode' ? -power : 0;
    this.burstSpin = kind === 'vortex' ? power : 0;
    if (kind === 'shove') this.burstVelocity.set((Math.random() - 0.5) * 2 * power, (Math.random() - 0.5) * 2 * power);
  }

  private tick = () => {
    if (this.isDestroyed) return;
    this.animFrameId = requestAnimationFrame(this.tick);
    this.advance(Math.min(this.clock.getDelta(), 0.05));
  };

  /** Synchronous step. The caller is the only scheduler in hosted mode.
   * rawDelta is unscaled wall duration; every native driver uses simTime.
   * Zero delta performs a clean render, never a GPGPU integration pass.
   */
  public advance(rawDelta: number): number {
    if (this.isDestroyed) return this.simTime;
    if (!Number.isFinite(rawDelta) || rawDelta < 0) throw new Error('Invalid simulation delta');
    const base = this.config;
    // Paused inspection may evaluate values but must not arm or consume one-shots.
    const runtime = rawDelta > 0 ? this.automationRt : {
      ...this.automationRt, lanes: new Map([...this.automationRt.lanes].map(([id, v]) => [id, {...v}]))
    };
    const auto = applyAutomations(base, base.automations, this.simTime, runtime, computeMorphDrive(base.toroidalMorph??DEFAULT_TOROIDAL_CONFIG, (base.toroidalMorph?.autoOscillate===false?0:this.torPhaseAcc)+(base.toroidalMorph?.toroidalPhase??0), (base.toroidalMorph?.autoOscillate===false?0:this.polPhaseAcc)+(base.toroidalMorph?.poloidalPhase??0)));
    this.config = auto.config;
    this.liveAutomation = auto.live;
    this.evaluatedConfig = auto.config;
    try {
      if (Math.floor(this.config.particleCount) !== this.simulator.particleCount) this.rebuildParticleSystem();
      const delta = Math.min(rawDelta, 0.1) * Math.max(0, this.config.fluid.timeScale ?? 1);
      const count = Math.max(1, Math.ceil(delta / (1 / 60)));
      if (count > 600) throw new Error('Time scale exceeds the safe live stepping budget');
      if (auto.live.length > 0) this.syncLiveMaterialUniforms();
      for (let i = 0; i < count; i++) {
        this.simTime += delta / count;
        this.tickFrame(delta / count, this.simTime, i === count - 1);
      }
      this.emitTelemetry(rawDelta, auto.live);
      return this.simTime;
    } finally { this.config = base; }
  }

  private liveAutomation: AutomationLiveValue[] = [];
  private evaluatedConfig: PointCloudConfig | null = null;
  public getEvaluation() { return { config: this.evaluatedConfig ?? this.config, live: this.liveAutomation }; }

  /** Host projection is exact, including off-centre framing and edge-on workplanes. */
  public setHostView(view: { width: number; height: number; pixelRatio: number; originX: number; originY: number; pixelsPerUnit: number; right: number[]; up: number[] }) {
    const {width, height, originX, originY, pixelsPerUnit: s} = view;
    const dpr = Math.max(0.5, Math.min(3, view.pixelRatio));
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x !== width || size.y !== height || this.renderer.getPixelRatio() !== dpr) {
      this.renderer.setPixelRatio(dpr); this.renderer.setSize(width, height, false);
    }
    const right = new THREE.Vector3(...view.right as [number,number,number]);
    const up = new THREE.Vector3(...view.up as [number,number,number]);
    const normal = new THREE.Vector3().crossVectors(right, up).normalize();
    this.orthoCamera.left = -originX / s; this.orthoCamera.right = (width - originX) / s;
    this.orthoCamera.top = originY / s; this.orthoCamera.bottom = -(height - originY) / s;
    this.orthoCamera.near = 0.1; this.orthoCamera.far = 20000; this.orthoCamera.zoom = 1;
    this.orthoCamera.updateProjectionMatrix();

    // The host asks for an exact world scale per output pixel. Perspective can
    // honour that scale at the workplane by choosing the eye distance that makes
    // the frustum cover the same pixel pitch — the two projections then frame
    // identically at z = 0 and diverge only in convergence, which is the point.
    const fov = (this.perspCamera.fov * Math.PI) / 180;
    const distance = (height / Math.max(0.0001, s) * 0.5) / Math.max(0.0001, Math.tan(fov / 2));
    this.perspCamera.near = 0.1; this.perspCamera.far = 20000; this.perspCamera.zoom = 1;
    this.perspCamera.updateProjectionMatrix();

    const planar = this.cameraProjection !== 'perspective';
    const eyeDistance = planar ? 5000 : distance;
    const cam = this.camera as THREE.OrthographicCamera | THREE.PerspectiveCamera;
    cam.position.copy(normal).multiplyScalar(eyeDistance);
    cam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    this.pushDepthUniforms();
    this.particleMaterial.uniforms.uPixelRatio.value = dpr;
    this.particleMaterial.uniforms.uCanvasSize.value.set(width, height);
  }

  public setHostPointer(active: boolean, point: {x:number; y:number; z:number}, delta: number) {
    if (!active) { this.handlePointerLeave(); this.hostPointerZ = 0; return; }
    if (this.pointerPos.x > -90000 && delta > 0) {
      this.pointerVel.set((point.x - this.pointerPos.x) / delta, (point.y - this.pointerPos.y) / delta).clampLength(0, 20000);
    } else this.pointerVel.set(0, 0);
    this.pointerPos.set(point.x, point.y); this.hostPointerZ = point.z;
  }
  private hostPointerZ = 0;

  /** Diagnostics read real floating-point GPU state, only on explicit request. */
  public inspectState(readParticles = false) {
    const result = { simTime: this.simTime, steps: this.simulator.stepCount, seeds: this.seedGeneration,
      bakes: this.entities.bakeGeneration, particleCount: this.simulator.particleCount,
      drive: this.lastDrive, composition: this.getCompositionTelemetry(),
      positions: [] as number[], velocities: [] as number[] };
    if (readParticles) {
      const n = this.simulator.texWidth * this.simulator.texHeight * 4;
      const p = new Float32Array(n), v = new Float32Array(n);
      this.renderer.readRenderTargetPixels(this.simulator.currentPosTarget, 0, 0, this.simulator.texWidth, this.simulator.texHeight, p);
      this.renderer.readRenderTargetPixels(this.simulator.currentVelTarget, 0, 0, this.simulator.texWidth, this.simulator.texHeight, v);
      result.positions = Array.from(p.subarray(0, this.simulator.particleCount * 4));
      result.velocities = Array.from(v.subarray(0, this.simulator.particleCount * 4));
    }
    return result;
  }

  /** Editing decoration only. Neither GPU state nor the stored configuration is touched. */
  public setSelection(ids: readonly string[]) {
    const u=this.particleMaterial.uniforms,parts=this.entities.getPartitions();
    const mask=u.uEditSelected.value as Float32Array;mask.fill(0);
    let any=false;parts.forEach((p,i)=>{if(i<10&&ids.includes(p.entityId)){mask[i]=1;any=true;}});
    u.uEditHasSelection.value=any?1:0;
  }
  /** Copy a clean live framebuffer without readback, stepping, or changing the authoring frame. */
  public withCleanFrame<T>(copy:()=>T):T {
    const u=this.particleMaterial.uniforms,selected=u.uEditHasSelection.value;
    const visibility=this.scene.children.map(o=>[o,o.visible] as const);
    try {u.uEditHasSelection.value=0;for(const [o] of visibility)if(o!==this.particlePoints)o.visible=false;this.renderer.render(this.scene,this.camera);return copy();}
    finally {u.uEditHasSelection.value=selected;for(const [o,v] of visibility)o.visible=v;if(selected||visibility.some(([o,v])=>o!==this.particlePoints&&v))this.renderer.render(this.scene,this.camera);}
  }

  /** Render current state at native output resolution. No stepping or allocation changes. */
  public renderImage(width: number, height: number): HTMLCanvasElement {
    if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 8192) || width * height > 33554432) throw new Error('Image exceeds the 32 megapixel capture budget');
    const target = new THREE.WebGLRenderTarget(width, height, {format:THREE.RGBAFormat, type:THREE.UnsignedByteType, depthBuffer:false, stencilBuffer:false});
    const previous = this.renderer.getRenderTarget();
    const selected=this.particleMaterial.uniforms.uEditHasSelection.value;
    const visibility=this.scene.children.map(o=>[o,o.visible] as const);
    this.particleMaterial.uniforms.uEditHasSelection.value=0;for(const [o] of visibility)if(o!==this.particlePoints)o.visible=false;
    const pixelRatio = this.particleMaterial.uniforms.uPixelRatio.value;
    const camera = (this.camera as THREE.OrthographicCamera | THREE.PerspectiveCamera).clone();
    const aspect = width / height;
    const cssHeight = this.renderer.getSize(new THREE.Vector2()).y;
    let sizeScale = height / cssHeight;
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.isPerspectiveCamera) {
      // A perspective lens resizes by aspect, not by cropping the frustum, so
      // the world-per-pixel at the workplane is unchanged and only the output
      // pixel scale applies.
      persp.aspect = aspect;
      persp.updateProjectionMatrix();
    } else {
      const ortho = camera as THREE.OrthographicCamera;
      const oldAspect = (ortho.right - ortho.left) / (ortho.top - ortho.bottom);
      const cx = (ortho.left + ortho.right) / 2, cy = (ortho.top + ortho.bottom) / 2;
      let w = ortho.right - ortho.left, h = ortho.top - ortho.bottom;
      if (aspect < oldAspect) w = h * aspect; else h = w / aspect;
      ortho.left = cx - w / 2; ortho.right = cx + w / 2; ortho.top = cy + h / 2; ortho.bottom = cy - h / 2;
      ortho.updateProjectionMatrix();
      sizeScale *= this.viewHeight() / h;
    }
    this.particleMaterial.uniforms.uPixelRatio.value = sizeScale;
    try {
      this.renderer.setRenderTarget(target); this.renderer.clear(); this.renderer.render(this.scene,camera);
      const bytes=new Uint8Array(width*height*4);this.renderer.readRenderTargetPixels(target,0,0,width,height,bytes);
      const out=document.createElement('canvas');out.width=width;out.height=height;
      const ctx=out.getContext('2d')!;const image=ctx.createImageData(width,height);
      for(let y=0;y<height;y++) image.data.set(bytes.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);
      for(let i=0;i<image.data.length;i+=4){const alpha=image.data[i+3];if(alpha>0&&alpha<255){image.data[i]=Math.min(255,Math.round(image.data[i]*255/alpha));image.data[i+1]=Math.min(255,Math.round(image.data[i+1]*255/alpha));image.data[i+2]=Math.min(255,Math.round(image.data[i+2]*255/alpha));}}
      ctx.putImageData(image,0,0);return out;
    } finally {this.renderer.setRenderTarget(previous);this.particleMaterial.uniforms.uPixelRatio.value=pixelRatio;this.particleMaterial.uniforms.uEditHasSelection.value=selected;for(const [o,v] of visibility)o.visible=v;target.dispose();}
  }

  /** Advances the two conjugate phase oscillators and pushes them to the GPU. */
  private advanceMorphOscillator(delta: number): MorphDriveState {
    const tm = this.config.toroidalMorph || DEFAULT_TOROIDAL_CONFIG;
    const manual = !!tm.enabled && tm.autoOscillate === false;
    if (!manual) {
      this.torPhaseAcc += delta * TAU * (tm.oscillationSpeed ?? 0.8);
      this.polPhaseAcc += delta * TAU * (tm.poloidalRate ?? 0.35);
      this.breathPhaseAcc += delta * TAU * (tm.breathRate ?? tm.poloidalRate ?? 0.35);
    }
    const theta = (manual ? 0 : this.torPhaseAcc) + (tm.toroidalPhase ?? 0);
    const phi = (manual ? 0 : this.polPhaseAcc) + (tm.poloidalPhase ?? 0);
    // The breathing phase mirrors the poloidal phase (offset included) until an
    // explicit breathRate decouples it, preserving the pre-breath-rate law.
    const breath = manual ? 0 : this.breathPhaseAcc + (tm.poloidalPhase ?? 0);
    const drive = computeMorphDrive(tm, theta, phi);
    this.lastDrive = drive;
    this.simulator.setMorphPhases(theta, phi, breath);
    return drive;
  }

  private syncLiveMaterialUniforms() {
    if (!this.particleMaterial) return;
    const u = this.particleMaterial.uniforms;
    const m = this.config.material;
    u.uGrainEnabled.value = m ? 1 : 0;
    if (m) {
      u.uGrainA.value.set(m.sizeBias??1,m.opacity??1,m.roundness??1,m.softness??0);
      u.uGrainB.value.set(m.irregularity??0,m.elongation??0,(m.orientation??0)*Math.PI/180,m.contrast??1);
      u.uGrainC.value.set(m.densityScale??1,m.densityPhase??0,m.edgeWeight??0,m.halo??1);
    }
    u.uMinParticleSize.value = this.config.particleSize.min;
    u.uMaxParticleSize.value = this.config.particleSize.max;
    const col = this.config.color;
    if (col) {
      u.uColorCycleSpeed.value = col.cycleSpeed ?? 1.2;
      u.uColorWaveFrequency.value = col.waveFrequency ?? 1.8;
      u.uColorAngle.value = ((col.angle ?? 45) * Math.PI) / 180;
      u.uColorTurbulence.value = col.turbulenceModulation ?? 0.35;
      u.uColorSpeedReactive.value = col.speedReactiveIntensity ?? 0.6;
      u.uColorDensityWeight.value = col.densityWeight ?? 0.5;
      u.uColorContrast.value = col.contrast ?? 1.0;
      u.uColorCenter.value.set((col.fieldCenterOffset?.[0]??0)*300,(col.fieldCenterOffset?.[1]??0)*300);
    }
  }

  private emitTelemetry(rawDelta: number, live: AutomationLiveValue[]) {
    this.telemetryAccum += rawDelta;
    if (this.telemetryAccum < 0.08) return;
    this.telemetryAccum = 0;
    if (this.onMorphUpdateCallback && this.lastDrive) {
      this.onMorphUpdateCallback({
        progress: this.morphProgress,
        toroidalPhase: this.lastDrive.theta,
        poloidalPhase: this.lastDrive.phi,
        interference: this.lastDrive.signal,
      });
    }
    if (this.onAutomationUpdateCallback) this.onAutomationUpdateCallback(live);
    if (this.onCompositionUpdateCallback) this.onCompositionUpdateCallback(this.getCompositionTelemetry());
  }

  public setOnCompositionUpdate(cb: ((t: CompositionTelemetry) => void) | null) {
    this.onCompositionUpdateCallback = cb;
  }

  public getCompositionTelemetry(): CompositionTelemetry {
    const forms = this.formations();
    const focus = this.lastFocus;
    const res = this.latestResonatorTelemetry;
    const stations = this.getCymaticStations();
    return {
      simTime: this.simTime,
      focus: focus && forms.length > 0
        ? {
            index: focus.index,
            entityId: forms[Math.min(focus.index, forms.length - 1)].id,
            nextEntityId: forms[Math.min(focus.nextIndex, forms.length - 1)].id,
            blend: focus.blend,
          }
        : null,
      semantic: this.latestSemanticState,
      sequences: this.lastFrames.map((f) => ({
        entityId: f.entityId,
        linkIndex: f.state.linkIndex,
        nextIndex: f.state.nextIndex,
        progress: f.state.progress,
        phase: f.state.phase,
        linkCount: f.state.linkCount,
      })),
      cymatic: this.config.cymatics?.enabled
        ? {
            enabled: this.resonatorActive,
            frequencyHz: this.cymaticFreqCurrent,
            coherence: res?.coherence ?? 0,
            dominantM: res?.dominantM ?? 0,
            dominantN: res?.dominantN ?? 0,
            nearestStation: res?.nearestStationIndex ?? 0,
            stationProximity: res?.nearestStationProximity ?? 0,
            stations,
            driver: { ...this.lastResonanceDrive },
          }
        : null,
    };
  }

  public setOnMorphUpdate(cb: ((t: MorphTelemetry) => void) | null) {
    this.onMorphUpdateCallback = cb;
  }

  public setOnAutomationUpdate(cb: ((live: AutomationLiveValue[]) => void) | null) {
    this.onAutomationUpdateCallback = cb;
  }

  /** Re-trigger a one-shot automation lane immediately (independent of config churn). */
  public fireAutomation(id: string, delayS: number = 0) {
    const lane=this.config.automations?.find(l=>l.id===id);
    if(lane&&!this.automationRt.lanes.has(id))applyAutomations(this.config,[lane],this.simTime,this.automationRt);
    const r = this.automationRt.lanes.get(id);
    if (r) r.startTime = this.simTime + delayS;
  }

  /** Zero the running toroidal / poloidal phases (restart the morph cycle). */
  /** Reconstruct source targets after startup decoding; preserve recovered driver clocks. */
  seedCurrentTargets(){this.seedGeneration++;this.simulator.seedInitialState(this.entities.buildSeed());}
  getTransportState():TransportState{return {version:1,simTime:this.simTime,theta:this.torPhaseAcc,phi:this.polPhaseAcc,lanes:[...this.automationRt.lanes].map(([id,v])=>[id,{...v}])};}
  restoreTransportState(value:unknown){const s=validateTransport(value);this.simTime=s.simTime;this.torPhaseAcc=s.theta;this.polPhaseAcc=s.phi;this.breathPhaseAcc=s.phi;this.automationRt={lanes:new Map(s.lanes)};}
  public resetMorphPhases() {
    this.torPhaseAcc = 0;
    this.polPhaseAcc = 0;
    this.breathPhaseAcc = 0;
  }

  public getMorphDrive(): MorphDriveState | null {
    return this.lastDrive;
  }


  private tickFrame(delta: number, elapsedTime: number, draw = true) {
    const cfg = this.config;
    const comp = cfg.composition || DEFAULT_COMPOSITION;
    const tm = cfg.toroidalMorph || DEFAULT_TOROIDAL_CONFIG;

    this.syncLiveMaterialUniforms();

    // 0. Dual-phase morph oscillator (the field's morph control system)
    const drive = this.advanceMorphOscillator(delta);
    // Entities whose sequence is 'off' follow the manifold drive when it oscillates, else the manual scrub
    const manual = tm.enabled && tm.autoOscillate !== false ? drive.progress : (cfg.morphProgress ?? 0);

    // 1. Entities: resolve sequences from the clock, re-bake changed partitions, refresh uniforms
    const res = this.entities.update(cfg.entities || [], comp, elapsedTime, drive.theta, manual, tm.holdRatio ?? 0, cfg.fontFamily, cfg.fontWeight);
    this.lastFrames = res.frames;
    this.lastPoses = res.poses;
    if (delta > 0) for (const imp of res.impulses) this.triggerDisperse(imp);
    this.simulator.setTargetTextures(this.entities.textureA!, this.entities.textureB!, this.entities.fieldCentre(), this.entities.noiseTexture!);
    this.simulator.setEntityState(this.entities.uniforms);
    this.simulator.setCollisionState(this.entities.collisionTiles, this.entities.collisionTexture);
    this.morphProgress = res.frames[0]?.state.progress ?? manual;

    // 2. Composition focus (pure function of time) → focus tint + cymatic station follow
    const forms = this.formations();
    const focus = resolveFocus(forms.length, comp, elapsedTime);
    this.lastFocus = focus;
    let focusWeight = 0;
    if (focus && forms.length > 0) {
      const a = new THREE.Color(forms[Math.min(focus.index, forms.length - 1)].tint);
      const b = new THREE.Color(forms[Math.min(focus.nextIndex, forms.length - 1)].tint);
      this.focusTint.copy(a).lerp(b, focus.blend);
      focusWeight = Math.max(0, Math.min(1, comp.orchestration.focusTintWeight));
    }
    if (this.particleMaterial) {
      const u = this.particleMaterial.uniforms;
      const eu = this.entities.uniforms;
      u.uEntityCount.value = eu.count;
      (u.uEntityBounds.value as Float32Array).set(eu.bounds);
      (u.uEntityTintWeight.value as Float32Array).set(eu.tintWeights);
      const tints = u.uEntityTint.value as THREE.Color[];
      for (let i = 0; i < 10; i++) tints[i].copy(eu.tints[i]);
      (u.uTexSize.value as THREE.Vector2).set(this.simulator.texWidth, this.simulator.texHeight);
      (u.uFocusTint.value as THREE.Color).copy(this.focusTint);
      u.uFocusTintWeight.value = focusWeight;
    }

    // 3. Cymatic medium (continuously driven resonator; frequency may follow the focus station)
    this.tickCymaticMedium(delta, comp, forms, focus);

    // 4. Pointer velocity decay
    this.pointerVel.multiplyScalar(Math.pow(0.92, delta * 60));

    // 5. Relational multi-attractors retain their own physical law, but expose carrier telemetry.
    // Attractors live in the field's real 3D centre; once the body law is on they also
    // trace tilted orbits through the depth axis, so a whirlpool organises a solid
    // instead of dragging it flat toward the picture plane.
    this.lastRelationalCarriers = [];
    if (cfg.relational?.enabled) {
      const rel = cfg.relational;
      const count = Math.max(1, Math.min(10, rel.attractorCount ?? 3));
      const eu = this.entities.uniforms;
      const baseCenters: Array<{x:number;y:number;z:number}> = [];
      for (let i = 0; i < Math.max(1, eu.count); i++) baseCenters.push({x: eu.centers[i].x, y: eu.centers[i].y, z: eu.centers[i].z});
      const vCenter = this.entities.fieldCentre();
      let centreZ = 0;
      for (const c of baseCenters) centreZ += c.z;
      centreZ /= Math.max(1, baseCenters.length);
      const depthForms = !!(cfg.glyphVolume?.enabled && (cfg.glyphVolume?.depth ?? 0) > 0);
      const dynamicAttractors: THREE.Vector4[] = [];
      const dynamicSpins: number[] = [];
      const carrierPositions: Array<{x:number;y:number;z:number}> = [];
      for (let i = 0; i < 10; i++) {
        if (i < count) {
          const basePt = baseCenters[i % baseCenters.length] || {x: 0, y: 0, z: 0};
          const initialAngle = (i / count) * Math.PI * 2;
          const currentAngle = initialAngle + elapsedTime * (rel.orbitSpeed ?? 0.8);
          const radius = rel.orbitRadius ?? 240;
          const phase = (i / count) * Math.PI * 2;
          let posX = 0;
          let posY = 0;
          let posZ = centreZ;
          if (rel.mode === 'chaos') {
            const wx = Math.sin(elapsedTime * (rel.wanderSpeed ?? 0.5) * 1.4 + i * 2.1) * radius * 0.7;
            const wy = Math.cos(elapsedTime * (rel.wanderSpeed ?? 0.5) * 1.1 + i * 1.7) * radius * 0.5;
            posX = basePt.x + wx;
            posY = basePt.y + wy;
            if (depthForms) posZ += Math.sin(elapsedTime * (rel.wanderSpeed ?? 0.5) * 0.9 + i * 1.3) * radius * 0.35;
          } else if (rel.mode === 'nbody') {
            const t = elapsedTime * (rel.orbitSpeed ?? 0.8) + i * ((Math.PI * 2) / count);
            const denom = 1 + Math.cos(t) * Math.cos(t);
            posX = vCenter.x + (Math.sin(t) / denom) * radius * 1.4;
            posY = vCenter.y + ((Math.sin(t) * Math.cos(t)) / denom) * radius * 1.4;
            if (depthForms) posZ += (Math.cos(t) / denom) * radius * 0.55;
          } else {
            const rx = Math.cos(currentAngle) * radius;
            const ry = Math.sin(currentAngle) * radius * 0.75;
            const driftX = Math.sin(elapsedTime * (rel.wanderSpeed ?? 0.5) + i) * 35;
            const driftY = Math.cos(elapsedTime * (rel.wanderSpeed ?? 0.5) + i) * 35;
            posX = vCenter.x + rx + driftX;
            posY = vCenter.y + ry + driftY;
            if (depthForms) posZ += Math.sin(currentAngle + phase) * radius * 0.6;
          }
          const spin = (i % 2 === 0 ? 1.0 : -1.0) * (1.0 + i * 0.2);
          dynamicAttractors.push(new THREE.Vector4(posX, posY, posZ, 1.0));
          dynamicSpins.push(spin);
          carrierPositions.push({x:posX,y:posY,z:posZ});
        } else {
          dynamicAttractors.push(new THREE.Vector4(-99999, -99999, 0, 0));
          dynamicSpins.push(0);
        }
      }
      this.simulator.setAttractors(dynamicAttractors, dynamicSpins);
      this.lastRelationalCarriers = relationalCarrierStates(carrierPositions, rel);
    }

    // 6. All first-class entity forces compile through one physical emitter table. Formation
    // forces keep their composition-plane metric; pins keep their full-3D metric. Legacy placed
    // points are accepted only as migration input and compile into the same table.
    this.lastForceEmitters = compileEntityForceEmitters(cfg.entities || [], this.lastPoses, cfg.interaction.placedPoints || []);
    this.simulator.setForceEmitters(this.lastForceEmitters);

    // 7. Semantic interpretation consumes physical resonance + evaluated carriers, then emits
    // render-only colour fields. It cannot mutate resonance, forces, targets, or particle state.
    const focusSemantic = focus && forms.length > 0 ? {
      entityId: forms[Math.min(focus.index, forms.length - 1)].id,
      nextEntityId: forms[Math.min(focus.nextIndex, forms.length - 1)].id,
      blend: focus.blend,
    } : null;
    const resonanceState = this.cymaticResonator && this.resonatorActive ? this.cymaticResonator.getState() : null;
    this.latestSemanticState = this.semanticRuntime.evaluate({
      config: cfg.semanticField,
      resonance: resonanceState,
      poses: this.lastPoses,
      entityTints: new Map((cfg.entities || []).map((e) => [e.id, e.tint] as const)),
      forceEmitters: this.lastForceEmitters,
      relationalCarriers: this.lastRelationalCarriers,
      focus: focusSemantic,
      delta,
    });
    this.syncSemanticColorUniforms(comp);

    // Runtime burst input survives UI/pointer clearing and is consumed only by physics.
    this.simulator.setBurst(this.burstPosition, this.burstVelocity, this.burstRadius, this.burstRadial, this.burstSpin, this.burstZ);
    if (delta > 0) {
      const decay = Math.pow(0.92, delta * 60);
      this.burstVelocity.multiplyScalar(decay);
      this.burstRadial *= decay;
      this.burstSpin *= decay;
    }
    // 8. GPGPU step
    this.simulator.step(delta, elapsedTime, cfg, this.morphProgress, this.pointerPos, this.pointerVel, this.hostPointerZ);

    // 9. Bind simulation textures and render
    this.particleMaterial.uniforms.uPositionTexture.value = this.simulator.currentPosTarget.texture;
    this.particleMaterial.uniforms.uVelocityTexture.value = this.simulator.currentVelTarget.texture;
    this.particleMaterial.uniforms.uTime.value = elapsedTime;

    const col = cfg.color;
    if (col && col.enabled && col.hueShiftSpeed && Math.abs(col.hueShiftSpeed) > 0.001) {
      this.particleMaterial.uniforms.uColorHueShift.value = (elapsedTime * col.hueShiftSpeed * 0.1) % 1.0;
    } else if (this.particleMaterial.uniforms.uColorHueShift.value !== 0.0) {
      this.particleMaterial.uniforms.uColorHueShift.value = 0.0;
    }

    if (draw) this.renderer.render(this.scene, this.camera);
  }

  // ------------------------------------------------------------------ cymatic medium
  private stopResonator() {
    if (!this.resonatorActive) return;
    this.resonatorActive = false;
    const zero = new Float32Array(64);
    this.simulator.setResonatorState(false, 0, zero, zero, 700, 0, 0, 0, 0, 1, false);
  }

  /**
   * One driven, damped resonator; its frequency is the single owner of "where the medium is":
   * an uninterrupted sweep, the composition focus (station follow), or the field's static frequency.
   * Envelopes persist across every change — nothing here resets particles or resonator state.
   */
  private tickCymaticMedium(delta: number, comp: Composition, forms: Entity[], focus: FocusState | null) {
    const cym = this.config.cymatics;
    if (!cym || !cym.enabled || cym.engine === 'template') {
      this.stopResonator();
      this.lastResonanceDrive = { kind:'frequency', targetHz:cym?.frequencyHz ?? this.cymaticFreqCurrent, bound:true };
      return;
    }
    // The two existing dim/plane keys are the single source of truth for the volumetric
    // mode: either '3D' dimension or the volumetric3D plate geometry turns the resonator
    // into a standing-wave cavity (4x4x4 mode lattice instead of the 8x8 plate grid).
    const volumetric = cym.dimension === '3D' || cym.plateGeometry === 'volumetric3D';
    const params = {
      plateSize: cym.plateSize ?? 700,
      baseFrequency: cym.baseFrequency ?? 40,
      dampingQ: cym.dampingQFactor ?? 4.5,
      driveStrength: cym.driveStrength ?? 1.0,
      modeCount: Math.max(1, Math.min(64, Math.round(cym.modeCount ?? 64))),
      dimension: volumetric ? ('3D' as const) : ('2D' as const),
    };
    if (!this.cymaticResonator) this.cymaticResonator = new CymaticResonator(params);
    else this.cymaticResonator.configure(params);
    const resonator = this.cymaticResonator;
    const anchors = resonator.getAnchors();
    const focusIds = focus && forms.length > 0 ? {
      entityId: forms[Math.min(focus.index, forms.length - 1)].id,
      nextEntityId: forms[Math.min(focus.nextIndex, forms.length - 1)].id,
      blend: focus.blend,
    } : null;

    // New documents name one physical driver. Undefined is a compatibility bridge for schema-4.
    let drive: ResonanceDriveConfig | undefined = this.config.resonanceDrive;
    if (!drive) {
      if (cym.autoSweep || cym.sweep?.enabled) drive = { kind:'sweep' };
      else if (cym.followFocus && comp.orchestration.followStation) drive = this.config.semanticField?.enabled
        ? { kind:'semanticFocus', profileId:this.config.semanticField.profile.profileId }
        : undefined;
      else drive = { kind:'frequency' };
    }

    let target = cym.frequencyHz ?? 396;
    if (drive?.kind === 'sweep') {
      this.sweepAccum += delta;
      const opts = {
        glideS: Math.max(0.05, drive.glideS ?? cym.sweep?.glideS ?? cym.sweepSpeed ?? 3.5),
        dwellS: Math.max(0, drive.dwellS ?? cym.sweep?.dwellS ?? 2.0),
        direction: drive.direction ?? cym.sweep?.direction ?? 'ascent' as const,
      };
      target = resonator.sweepFrequency(this.sweepAccum, opts);
      this.lastResonanceDrive = {kind:'sweep',targetHz:target,bound:true};
    } else if (drive?.kind === 'semanticFocus') {
      const resolved = semanticFocusTarget({currentHz:this.cymaticFreqCurrent,focus:focusIds,semanticField:this.config.semanticField,anchors});
      target = resolved.targetHz;
      this.lastResonanceDrive = resolved;
    } else if (!drive && cym.followFocus && comp.orchestration.followStation && focus && forms.length > 0 && anchors.length > 0) {
      // Explicit schema-4 compatibility only. New authoring uses SemanticBinding → physical anchor.
      const aIndex = Math.min(anchors.length - 1, forms[Math.min(focus.index, forms.length - 1)].stationIndex ?? 0);
      const bIndex = Math.min(anchors.length - 1, forms[Math.min(focus.nextIndex, forms.length - 1)].stationIndex ?? 0);
      const a = anchors[aIndex], b = anchors[bIndex];
      target = a.frequencyHz + (b.frequencyHz - a.frequencyHz) * focus.blend;
      this.lastResonanceDrive = {kind:'semanticFocus',targetHz:target,bound:true,anchorId:focus.blend<.5?a.id:b.id};
    } else {
      this.lastResonanceDrive = {kind:'frequency',targetHz:target,bound:true};
    }

    // Continuous glide toward the target so editing never resets the modal envelopes.
    this.cymaticFreqCurrent += (target - this.cymaticFreqCurrent) * (1 - Math.exp(-delta * 8));
    this.latestResonatorTelemetry = resonator.step(delta, this.cymaticFreqCurrent);
    this.resonatorActive = true;
    this.simulator.setResonatorState(
      true,
      params.modeCount,
      resonator.re,
      resonator.im,
      params.plateSize,
      cym.transportGain ?? 1.0,
      cym.agitation ?? 0.3,
      cym.boundaryStrength ?? 6.0,
      comp.plane === 'horizontal' ? 0.0 : 1.0,
      cym.driveScale ?? 1.0,
      volumetric
    );
    this.simulator.setResonatorDominance(cym.dominance ?? 1.0);
  }

  /** Physical anchors enriched at the orchestration boundary; the resonator itself has no semantic imports. */
  public getCymaticStations() {
    const anchors = this.cymaticResonator?.getAnchors() ?? [];
    const semantic = this.config.semanticField?.enabled && this.config.semanticField.profile.kind === 'chakra'
      ? mapChakrasToAnchors(anchors) : [];
    const semanticByAnchor = new Map(semantic.filter((m) => m.anchor).map((m) => [m.anchor!.id, m.node] as const));
    const stateByNode = new Map(this.latestSemanticState.nodes.map((n) => [n.semanticNodeId, n] as const));
    const physicalState = this.cymaticResonator?.getState();
    return anchors.map((anchor) => {
      const node = semanticByAnchor.get(anchor.id);
      const sem = node ? stateByNode.get(node.id) : undefined;
      const physical = physicalState?.anchors.find((a) => a.id === anchor.id);
      return {
        id: anchor.id,
        index: anchor.index,
        name: node?.name ?? `Mode ${anchor.m}:${anchor.n}`,
        frequencyHz: anchor.frequencyHz,
        m: anchor.m,
        n: anchor.n,
        color: node?.canonicalColor ?? '#888888',
        energy: physical?.energy ?? 0,
        semanticNodeId: node?.id,
        affinity: sem?.affinity,
      };
    });
  }

  private syncSemanticColorUniforms(comp: Composition) {
    if (!this.particleMaterial) return;
    const u = this.particleMaterial.uniforms;
    const fields = this.latestSemanticState.colorFields.slice(0, 16);
    u.uSemanticColorCount.value = fields.length;
    u.uCompPlane.value = comp.plane === 'horizontal' ? 1 : 0;
    const centres = u.uSemanticColorCenter.value as THREE.Vector4[];
    const values = u.uSemanticColorValue.value as THREE.Vector4[];
    const params = u.uSemanticColorParams.value as THREE.Vector4[];
    for (let i = 0; i < 16; i++) {
      const field = fields[i];
      if (!field) { centres[i].set(-99999,-99999,0,1); values[i].set(1,1,1,0); params[i].set(0,0,0,0); continue; }
      const color = new THREE.Color(field.color);
      centres[i].set(field.center.x, field.center.y, field.center.z, Math.max(1e-3, field.radius));
      values[i].set(color.r, color.g, color.b, Math.max(0, field.gain));
      params[i].set(field.metric === 'world3d' ? 1 : 0, field.falloff === 'compact' ? 1 : 0, field.blend === 'additive' ? 1 : 0, 0);
    }
  }

  public getCymaticTelemetry(): ResonatorTelemetry | null {
    return this.latestResonatorTelemetry;
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerleave', this.onPointerLeaveBound);
    window.removeEventListener('resize', this.onResizeBound);
    window.removeEventListener('pointerup', this.onWindowPointerUpBound);
    this.canvas.removeEventListener('wheel', this.onCanvasWheelBound);
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDownBound);
    this.canvas.removeEventListener('contextmenu', this.onCanvasContextMenuBound);

    this.entities?.dispose();
    if (this.simulator) this.simulator.destroy();
    if (this.glyphSampler) this.glyphSampler.destroy();
    if (this.particleGeometry) this.particleGeometry.dispose();
    if (this.particleMaterial) this.particleMaterial.dispose();
    this.pinLayer?.dispose();
    this.renderer.dispose();
  }
}
