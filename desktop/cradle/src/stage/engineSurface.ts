/**
 * The engine surface: the Global Expression Stage's runtime. One production
 * engine (the merged native field) per canvas — the window's expression
 * surface, or an element-bounded preview surface — hosted the way the
 * instrument's own shell hosts it: the caller owns the clock (frames call
 * `advance` through the adapter), the projection (the adapter applies the
 * stage law from the frame camera) and the document (scenes built through
 * validated native migration). Recipes apply as overlays on the scene's
 * retained schema-4 config; scene switches get the adapter's persistent-ID
 * interpolation, so authored transitions never reseed the medium. The
 * pointer is sampled passively — the surface never intercepts input.
 *
 * Laws carried over from the previous runtime: the surface exists exactly
 * while the expression is enabled (off removes canvas, context and
 * simulation entirely); prefers-reduced-motion renders a still field unless
 * a surface deliberately overrides it; context loss surfaces honestly and
 * recovery is an explicit reseed.
 */
import { ProductionAdapter } from "@epilogos/oi-design-system/expressions-engine/shell/production.mjs";
import { nativeSnapshotToJourney, type NativeConfig, type StageScene } from "@epilogos/oi-design-system/expressions-engine/shell/nativeBridge.mjs";
import { stageCentre, stageScale } from "@epilogos/oi-design-system/expressions-engine/shell/camera.mjs";
import type { EngineCommand, EngineFrame } from "@epilogos/oi-design-system/expressions-engine/shell/engine.mjs";
import { stageRecipe, stageSequence } from "./recipes";

const WORLD_SCALE = 400; // the instrument's stage unit (nativeParameters.ts)

/** Overlay merge for authored patches: objects merge recursively, arrays
 * and scalars replace. This is recipe semantics — untouched keys persist —
 * NOT the engine's migrate-from-defaults semantics. */
function mergePatch(base: NativeConfig, patch: NativeConfig): NativeConfig {
  const out: NativeConfig = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key];
    out[key] = value !== null && typeof value === "object" && !Array.isArray(value)
      && current !== null && typeof current === "object" && !Array.isArray(current)
      ? mergePatch(current as NativeConfig, value as NativeConfig)
      : value;
  }
  return out;
}

const CAMERA_2D: EngineFrame["camera"] = {
  mode: "2d", yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0,
  plane: "XY", depth: 0, grid: false, snap: false,
};

const IDLE_CONFIG: NativeConfig = { glyph: " ", particleCount: 2048 };

export class EngineSurface {
  readonly canvas: HTMLCanvasElement;
  private adapter: ProductionAdapter;
  private active: { id: string; scene: StageScene; revision: number } | null = null;
  private revision = 0;
  private live = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private raf = 0;
  private last = 0;
  private paused = false;
  private forceMotion = false;
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  private pointer: EngineFrame["pointer"] = { active: false, world: { x: 0, y: 0, z: 0 } };
  private element: HTMLElement | null;
  private observer: ResizeObserver | null = null;
  private detachPointer: () => void = () => {};
  private onError: (message: string) => void;

  private constructor(canvas: HTMLCanvasElement, element: HTMLElement | null, onError: (message: string) => void) {
    this.canvas = canvas;
    this.element = element;
    this.onError = onError;
    const factory = window.OI_ENGINE_FACTORY;
    this.adapter = factory
      ? (factory(canvas) as ProductionAdapter)
      : new ProductionAdapter(canvas);
    const pointerTarget = element ?? window;
    const move = (event: PointerEvent) => {
      const width = element ? element.clientWidth : window.innerWidth;
      const height = element ? element.clientHeight : window.innerHeight;
      const origin = stageCentre(width, height);
      const scale = (stageScale(width, height) * CAMERA_2D.zoom) / WORLD_SCALE;
      const localX = element ? event.clientX - element.getBoundingClientRect().left : event.clientX;
      const localY = element ? event.clientY - element.getBoundingClientRect().top : event.clientY;
      this.pointer = { active: true, world: { x: (localX - origin.x) / scale, y: -(localY - origin.y) / scale, z: 0 } };
    };
    const leave = () => { this.pointer = { active: false, world: this.pointer.world }; };
    pointerTarget.addEventListener("pointermove", move as EventListener, { passive: true });
    (element ?? document.documentElement).addEventListener("pointerleave", leave);
    this.detachPointer = () => {
      pointerTarget.removeEventListener("pointermove", move as EventListener);
      (element ?? document.documentElement).removeEventListener("pointerleave", leave);
    };
    if (element) {
      this.observer = new ResizeObserver(() => this.wake());
      this.observer.observe(element);
    }
    document.addEventListener("visibilitychange", this.wake);
  }

  /** The window's expression surface: one fixed, aria-hidden, fully
   * pointer-transparent canvas appended after the app root. */
  static forWindow(onError: (message: string) => void): EngineSurface {
    const canvas = document.createElement("canvas");
    canvas.className = "oi-point-cloud-overlay";
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.oiStage = "engine";
    document.body.append(canvas);
    return new EngineSurface(canvas, null, onError);
  }

  /** An element-bounded surface (the settings preview): the canvas lives
   * inside the container; the adapter's stage law frames the field to the
   * element's own box. */
  static forElement(container: HTMLElement, onError: (message: string) => void): EngineSurface {
    const canvas = document.createElement("canvas");
    canvas.className = "oi-stage-element-surface";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" } satisfies Partial<CSSStyleDeclaration>);
    container.append(canvas);
    return new EngineSurface(canvas, container, onError);
  }

  /** Present one authored recipe as the surface's scene. One scene at a
   * time in this phase — the shared-medium model, not parallel simulations. */
  present(id: string, recipe: string) {
    if (this.active && this.active.id !== id) {
      throw new Error(`The engine surface already presents "${this.active.id}"; release it before presenting "${id}".`);
    }
    this.live = true;
    this.activate(id, this.sceneFrom(stageRecipe(recipe)));
    this.wake();
  }

  /** Present owner-authored configuration directly (the visual-preference
   * owner's document — user material, not app-invented physics). */
  presentConfig(id: string, config: unknown) {
    if (this.active && this.active.id !== id) {
      throw new Error(`The engine surface already presents "${this.active.id}"; release it before presenting "${id}".`);
    }
    this.live = true;
    this.activate(id, this.sceneFrom(config as NativeConfig));
    this.wake();
  }

  /** Apply another authored recipe as an overlay on the presented scene's
   * retained config — same scene id, so the adapter applies it immediately
   * (no transition, no reseed). */
  update(id: string, recipe: string) {
    const active = this.require(id);
    const merged = mergePatch(active.scene.native?.config ?? {}, stageRecipe(recipe));
    this.activate(id, this.sceneFrom(merged, id));
    this.wake();
  }

  /** Play an authored sequence: each step merges over the presented
   * scene's config and lands as a new scene id, so the adapter's
   * persistent-ID interpolation carries the medium between steps without
   * a reseed. Reduced motion applies the final state immediately. */
  play(id: string, sequenceId: string) {
    const active = this.require(id);
    this.clearTimers();
    const { steps } = stageSequence(sequenceId);
    if (this.reduced.matches && !this.forceMotion) {
      const merged = steps.reduce<NativeConfig>(
        (config, step) => mergePatch(config, stageRecipe(step.recipe)),
        active.scene.native?.config ?? {},
      );
      this.activate(id, this.sceneFrom(merged, id));
      this.wake();
      return;
    }
    let base = active.scene.native?.config ?? {};
    steps.forEach((step, index) => {
      base = mergePatch(base, stageRecipe(step.recipe));
      const scene = this.sceneFrom(base, `${id}·${sequenceId}·${index}`);
      const next = steps[index + 1];
      scene.transition = next ? Math.max(0.05, (next.at - step.at) / 1000) : 0.6;
      this.timers.push(setTimeout(() => {
        if (!this.active || this.active.id !== id) return;
        this.active = { id, scene, revision: ++this.revision };
        if (step.disperse !== undefined) this.command({ type: "disperse", strength: step.disperse });
        this.wake();
      }, step.at));
    });
  }

  release(id: string) {
    if (!this.active || this.active.id !== id) { this.clearTimers(); return; }
    this.clearTimers();
    this.live = false;
    // An idle frame keeps the shared canvas honest — a released scene
    // leaves no lingering mark on the window's expression surface.
    this.activate("stage-idle", this.sceneFrom(IDLE_CONFIG, "stage-idle"));
    this.renderFrame(0);
  }

  command(command: EngineCommand) {
    try {
      this.adapter.command?.(command);
    } catch (cause) {
      this.fail(cause);
    }
  }

  setPaused(paused: boolean) { this.paused = paused; if (!paused) this.wake(); }
  setForceMotion(force: boolean) { this.forceMotion = force; if (force) this.wake(); }

  telemetry(): unknown {
    try { return this.adapter.telemetry?.() ?? null; } catch { return null; }
  }

  capabilities() { return this.adapter.capabilities; }

  dispose() {
    this.clearTimers();
    this.sleep();
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener("visibilitychange", this.wake);
    this.detachPointer();
    this.active = null;
    try { this.adapter.dispose(); } catch { /* already gone with its context */ }
    this.canvas.remove();
  }

  private activate(id: string, scene: StageScene) {
    this.active = { id, scene, revision: ++this.revision };
  }

  private require(id: string): { id: string; scene: StageScene; revision: number } {
    if (!this.active || this.active.id !== id) {
      throw new Error(`The engine surface is not presenting "${id}".`);
    }
    return this.active;
  }

  private sceneFrom(config: NativeConfig, id?: string): StageScene {
    const scene = nativeSnapshotToJourney({ config }).scenes[0]!;
    if (id !== undefined) scene.id = id;
    return scene;
  }

  private clearTimers() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.length = 0;
  }

  private wake = () => {
    if (this.raf || !this.active || !this.live) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };

  private sleep() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (!this.active) return;
    if (document.hidden) { this.last = now; this.raf = requestAnimationFrame(this.frame); return; }
    const animate = !this.paused && (this.forceMotion || !this.reduced.matches);
    const delta = animate ? Math.min(0.05, Math.max(0.001, (now - this.last) / 1000)) : 0;
    this.last = now;
    if (this.renderFrame(delta) && this.active) this.raf = requestAnimationFrame(this.frame);
  };

  /** Renders one frame; returns false when the surface has failed. */
  private renderFrame(delta: number): boolean {
    const element = this.element;
    let width: number, height: number;
    if (element) {
      const rect = element.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
    } else {
      width = window.innerWidth;
      height = window.innerHeight;
    }
    try {
      this.adapter.resize(width, height, window.devicePixelRatio || 1);
      this.adapter.render({
        scene: this.active!.scene,
        authoringRevision: this.active!.revision,
        simTime: 0,
        delta,
        params: {},
        camera: CAMERA_2D,
        pointer: this.pointer,
        selectedIds: [],
        scaffold: "off",
      });
      return true;
    } catch (cause) {
      this.sleep();
      this.fail(cause);
      return false;
    }
  }

  private fail(cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    this.onError(message);
  }
}
