/**
 * Typed seam for @epilogos/oi-design-system/expressions-engine — the
 * vendored native Expressions engine (see expressions-engine/PROVENANCE.json
 * for the exact source commit). Same convention as oi-point-cloud-types.d.ts:
 * the package ships plain ES modules; the cradle declares the surface the
 * stage uses as ambient modules.
 */

interface Window {
  /** The engine's designed injection seam (field-studies-journeys/src/engine.ts). */
  OI_ENGINE_FACTORY?: (canvas: HTMLCanvasElement) => unknown;
}

declare module "@epilogos/oi-design-system/expressions-engine/shell/camera.mjs" {
  export interface Vec3 { x: number; y: number; z: number }
  export interface Camera {
    mode: "2d" | "3d"; yaw: number; pitch: number; zoom: number;
    panX: number; panY: number; plane: "XY" | "XZ" | "YZ";
    depth: number; grid: boolean; snap: boolean;
  }
  /** The instrument's stage law: the centre and scale every projection uses. */
  export function stageCentre(width: number, height: number): { x: number; y: number };
  export function stageScale(width: number, height: number): number;
}

declare module "@epilogos/oi-design-system/expressions-engine/shell/nativeBridge.mjs" {
  /** The engine's complete schema-4 configuration document. Declared loose:
   * the stage builds configs only through migration and overlay merges. */
  export type NativeConfig = Record<string, unknown>;
  /** A validated authoring scene. The stage relies on the native-passthrough
   * fields (id, transition, native.config); the rest of the authoring schema
   * stays with the engine. */
  export interface StageScene {
    id: string;
    name: string;
    transition: number;
    native?: { config: NativeConfig; original: unknown; projection?: NativeConfig };
    [key: string]: unknown;
  }
  export interface StageJourney { scenes: StageScene[] }
  /** Migrates any recognised native configuration (including the old
   * point-cloud patch schema) into a validated journey whose scene retains
   * the complete schema-4 config losslessly. Throws on unrecognised input. */
  export function nativeSnapshotToJourney(raw: unknown, index?: number): StageJourney;
  /** Projects an authoring scene into a complete schema-4 configuration. */
  export function nativeExport(scene: unknown): { schemaVersion: 4; config: NativeConfig; [key: string]: unknown };
}

declare module "@epilogos/oi-design-system/expressions-engine/shell/model.mjs" {
  /** The engine's authoring helpers, used by the stage to compose authored
   * material (the mark) in the instrument's own scene schema. */
  export interface AuthoringEntity {
    id: string;
    name: string;
    kind: "formation" | "pin";
    size: { x: number; y: number };
    rotation: number;
    share: number;
    [key: string]: unknown;
  }
  export interface AuthoringScene {
    id: string;
    entities: AuthoringEntity[];
    field: { background: string; palette: string[]; params: Record<string, number>; [key: string]: unknown };
    [key: string]: unknown;
  }
  export function blankScene(name?: string): AuthoringScene;
  export function entity(name: string, text?: string, position?: { x: number; y: number; z: number }): AuthoringEntity;
}

declare module "@epilogos/oi-design-system/expressions-engine/shell/engine.mjs" {
  import type { Camera, Vec3 } from "@epilogos/oi-design-system/expressions-engine/shell/camera.mjs";
  export interface EngineFrame {
    scene: unknown;
    scaffold?: "off" | "axis" | "grid";
    authoringRevision?: number;
    simTime: number;
    delta: number;
    params: Readonly<Record<string, number>>;
    camera: Readonly<Camera>;
    pointer: { active: boolean; world: Vec3 };
    selectedIds: ReadonlyArray<string>;
  }
  export type EngineCommand =
    | { type: "reset-field" }
    | { type: "recover-context" }
    | { type: "reset-phases" }
    | { type: "disperse"; strength: number }
    | { type: "fire-automation"; id: string; delay?: number };
  export interface FieldEngineAdapter {
    readonly canvas: HTMLCanvasElement;
    readonly capabilities: {
      name: string; kind: "preview" | "production";
      runtimeCheckpoints: boolean; exactSeek: boolean;
    };
    render(frame: EngineFrame): void;
    resize(width: number, height: number, pixelRatio: number): void;
    needsRender?(): boolean;
    telemetry?(): unknown;
    command?(command: EngineCommand): void;
    inspect?(readParticles?: boolean): unknown;
    projectNative?(point: Vec3): unknown;
    dispose(): void;
  }
}

declare module "@epilogos/oi-design-system/expressions-engine/shell/production.mjs" {
  import type { EngineCommand, EngineFrame, FieldEngineAdapter } from "@epilogos/oi-design-system/expressions-engine/shell/engine.mjs";
  /** The production engine adapter: hosted PointCloudField with persistent-ID
   * scene interpolation and honest context-loss. Create one per canvas; the
   * caller owns the clock (render(frame) → advance), projection and document. */
  export class ProductionAdapter implements FieldEngineAdapter {
    constructor(canvas: HTMLCanvasElement);
    readonly canvas: HTMLCanvasElement;
    readonly capabilities: {
      name: string; kind: "production";
      runtimeCheckpoints: boolean; exactSeek: boolean;
    };
    render(frame: EngineFrame): void;
    resize(width: number, height: number, pixelRatio: number): void;
    needsRender(): boolean;
    telemetry(): unknown;
    command(command: EngineCommand): void;
    inspect(readParticles?: boolean): unknown;
    projectNative(point: { x: number; y: number; z: number }): unknown;
    dispose(): void;
  }
}
