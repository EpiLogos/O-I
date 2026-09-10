/**
 * Typed seam for @epilogos/oi-design-system/point-cloud — the same
 * convention as oi-expression-types.d.ts: the design system ships plain JS
 * modules; the cradle declares their shapes here as ambient modules.
 * Runtime values import from the package; the declarations attach to it.
 */

declare module "@epilogos/oi-design-system/point-cloud/config" {
  export type PointCloudColorMode = "followTheme" | "blackOnWhite" | "whiteOnBlack";
  export type PointCloudStyle = "stipple" | "halftone";
  export type PointCloudDotShape = "circle" | "square";
  export type PointCloudPointerMode = "repel" | "attract" | "vortex";
  export type PointCloudRelationalMode = "orbital" | "chaos" | "nbody";

  export interface PointCloudFluidConfig {
    curlScale: number; curlSpeed: number; vortexStrength: number;
    viscosity: number; returnSpeed: number; turbulence: number; dispersion: number;
  }
  export interface PointCloudInteractionConfig { radius: number; strength: number; mode: PointCloudPointerMode }
  export interface PointCloudRelationalConfig {
    enabled: boolean; mode: PointCloudRelationalMode; attractorCount: number;
    attractorGravity: number; orbitSpeed: number; orbitRadius: number;
    relationalSpin: number; chaosFactor: number; wanderSpeed: number;
  }
  export interface PointCloudConfig {
    glyph: [string, string] | string;
    particleCount: number;
    fontFamily: string;
    fontWeight: string | number;
    colorMode: PointCloudColorMode;
    style: PointCloudStyle;
    dotShape: PointCloudDotShape;
    particleSize: { min: number; max: number };
    fluid: PointCloudFluidConfig;
    interaction: PointCloudInteractionConfig;
    relational: PointCloudRelationalConfig;
    morphProgress: number;
    autoMorph: boolean;
    autoMorphDuration: number;
  }
  /** Nested partial of PointCloudConfig — the saved-state/import shape. */
  export type PointCloudPatch = {
    [K in keyof PointCloudConfig]?: PointCloudConfig[K] extends object ? Partial<PointCloudConfig[K]> : PointCloudConfig[K];
  };

  export interface PointCloudControlSpec { label: string; min: number; max: number; step: number; integer?: boolean }
  export const CONTROL_SCHEMA: Record<string, PointCloudControlSpec>;
  export const DEFAULT_CONFIG: PointCloudConfig;
  export const MAX_PARTICLE_SIZE_PX: number;
  export const CONFIG_KEYS: ReadonlySet<string>;
  export function applyPatch(config: PointCloudConfig, patch: PointCloudPatch): PointCloudConfig;
  export function applyPath(config: PointCloudConfig, path: string, value: unknown): PointCloudConfig;
  export function readPath(config: PointCloudConfig, path: string): unknown;
  export function hydrateConfig(overrides?: PointCloudPatch): PointCloudConfig;
  export function cloneConfig(config: PointCloudConfig): PointCloudConfig;
}

declare module "@epilogos/oi-design-system/point-cloud/presets" {
  import type { PointCloudConfig, PointCloudPatch } from "@epilogos/oi-design-system/point-cloud/config";
  export interface PointCloudPreset { id: string; name: string; description: string; config: Partial<PointCloudConfig> }
  export const PRESETS: readonly PointCloudPreset[];
  export const LOGO_PRESET: PointCloudPreset;
  export function presetConfig(current: PointCloudConfig, preset: PointCloudPreset): PointCloudConfig;
  export { MAX_PARTICLE_SIZE_PX } from "@epilogos/oi-design-system/point-cloud/config";
}

declare module "@epilogos/oi-design-system/point-cloud/host" {
  import type { PointCloudConfig, PointCloudPatch } from "@epilogos/oi-design-system/point-cloud/config";

  export interface PointCloudInstanceInspect {
    id: string;
    tag?: string;
    mode: "live" | "static-fallback";
    paused: boolean;
    requestedParticles: number;
    allocatedParticles: number;
    texWidth: number;
    texHeight: number;
    morphProgress?: number;
  }

  export interface PointCloudHostInspect {
    mode: "live" | "static-fallback" | "context-lost";
    floatType: "float32" | "float16" | "none";
    frames: number;
    instances: { id: string; tag?: string; paused: boolean; glyph: [string, string] | string | null; requestedParticles: number; allocatedParticles: number; texWidth: number; texHeight: number }[];
    allocatedParticles: number;
    particleBudget: number;
    instanceBudget: number;
    dpr: number;
    canvas: { width: number; height: number };
    reducedMotion: boolean;
  }

  export interface PointCloudInstance {
    id: string;
    pause(value?: boolean): PointCloudInstance;
    resume(): PointCloudInstance;
    renderOnce(): PointCloudInstance;
    reset(): PointCloudInstance;
    disperse(x?: number, y?: number, strength?: number): PointCloudInstance;
    /** Change classification: 'uniform' | 'rebake' | 'reallocate' | 'none'. */
    update(patch: PointCloudPatch): string;
    release(): void;
    inspect(): PointCloudInstanceInspect;
  }

  export interface PointCloudHost {
    readonly canvas: HTMLCanvasElement;
    readonly mode: "live" | "static-fallback" | "context-lost";
    readonly floatType: "float32" | "float16" | "none";
    readonly reducedMotion: boolean;
    createInstance(options: {
      id: string;
      tag?: string;
      /** Element target (rect read per frame), rect function, or omitted for window scope. */
      target?: HTMLElement | (() => DOMRect | null) | null;
      config?: PointCloudPatch;
      /** Passive pointer sampling surface; never captures input. */
      pointer?: "element" | "window" | null;
      /** Deliberate preview override of prefers-reduced-motion. */
      forceMotion?: boolean;
      paused?: boolean;
    }): PointCloudInstance;
    instance(record: unknown): PointCloudInstance;
    releaseInstance(id: string): void;
    renderAll(): void;
    refreshTheme(): void;
    inspect(): PointCloudHostInspect;
    dispose(): void;
  }

  export function createPointCloudHost(win: Window, options?: {
    maxInstances?: number;
    maxAllocatedParticles?: number;
    onLost?: (cause: Error) => void;
  }): Promise<PointCloudHost>;
}
