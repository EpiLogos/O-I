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
 * a surface deliberately overrides it.
 *
 * Clock law (2026-09-15 lifecycle repair): the simulation clock runs only
 * while a LIVE presentation stands in a visible document. A released
 * presentation settles its hand-over for one bounded window and then the
 * surface sleeps — no frame is scheduled, the canvas is marked dormant and
 * hidden. A hidden document never schedules drawing frames; the
 * visibilitychange wake resumes a live field. Reduced motion paints one
 * still frame per change and schedules nothing. `paused` holds the clock
 * regardless. Every scheduler exit runs through the same `frame` guard, so
 * a frame already in flight when `release()` lands cannot re-arm the loop. A K9 retained lease is narrower:
 * K8 may own the attraction targets of this same production field while O:I
 * keeps the canvas, renderer, physics clock and lifecycle. Context return then
 * restores the acknowledged resident GPU checkpoint instead of reseeding.
 */
import { ProductionAdapter, type RetainedTargetPort } from "@epilogos/oi-design-system/expressions-engine/oi/retained.mjs";
import { nativeSnapshotToJourney, type NativeConfig, type StageScene } from "@epilogos/oi-design-system/expressions-engine/shell/nativeBridge.mjs";
import { stageCentre, stageScale } from "@epilogos/oi-design-system/expressions-engine/shell/camera.mjs";
import type { EngineCommand, EngineFrame } from "@epilogos/oi-design-system/expressions-engine/shell/engine.mjs";
import { stageRecipe, stageSequence } from "./recipes";

const WORLD_SCALE = 400; // the instrument's stage unit (nativeParameters.ts)

/** The only K8-facing capability of a stage surface. It deliberately has no
 * renderer, step, reseed, scene, recipe or document mutation method. */
export interface StageRetainedLease {
  retainedTargetPort(): RetainedTargetPort;
  checkpointRetainedField(binding: unknown): unknown;
  restoreRetainedField(binding: unknown, checkpoint: unknown): StageRetainedLease;
  onRecoveryRequired(listener: (phase:"lost"|"restored") => void): () => void;
  inspect(): unknown;
  pause(value?: boolean): StageRetainedLease;
  resume(): StageRetainedLease;
  renderOnce(): StageRetainedLease;
  updatePresentation(request: unknown): unknown;
}

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
/** The host's current canvas ground (the desktop theme's paper), read from
 * the design-system token so authored recipes — the mark, the focused
 * medium — take the ink the appearance calls for. The engine derives its
 * ink from the scene background (light ground → ink, dark ground → paper).
 * Absent a host token (bare test pages) the recipe's own ground stands. */
function hostGround(): string | null {
  try {
    const value = getComputedStyle(document.body).getPropertyValue("--oi-canvas-ground").trim();
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
  } catch { return null; }
}
const STAGE_IDLE = "stage-idle";
/** How long a released field keeps its clock to settle the hand-over
 * (the idle scene's own transition) before the surface sleeps. */
const SETTLE_MS = 900;

/** The presentation the surface currently holds. `recipe` is the unthemed
 * authored material of a recipe presentation (absent for document
 * presentations and the idle hand-over). */
interface ActivePresentation { id: string; scene: StageScene; revision: number; recipe?: NativeConfig }

export class EngineSurface {
  readonly canvas: HTMLCanvasElement;
  private adapter: ProductionAdapter;
  private active: ActivePresentation | null = null;
  private themeObserver: MutationObserver | null = null;
  private revision = 0;
  private selectedIds: string[] = [];
  private live = false;
  private settleUntil = 0;
  private frames = 0;
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
  private retainedLeaseOwner: string | null = null;
  private retainedLeaseIdentity: symbol | null = null;
  private readonly home: HTMLElement;
  private readonly homeElement: HTMLElement | null;
  private readonly homeStyle: string;

  private constructor(canvas: HTMLCanvasElement, element: HTMLElement | null, onError: (message: string) => void) {
    this.canvas = canvas;
    this.home = canvas.parentElement!;
    this.homeElement = element;
    this.homeStyle = canvas.style.cssText;
    this.element = element;
    this.onError = onError;
    const factory = window.OI_ENGINE_FACTORY;
    this.adapter = factory
      ? (factory(canvas) as ProductionAdapter)
      : new ProductionAdapter(canvas);
    const pointerTarget = window;
    const move = (event: PointerEvent) => {
      const element = this.element;
      const width = element ? element.clientWidth : window.innerWidth;
      const height = element ? element.clientHeight : window.innerHeight;
      const origin = stageCentre(width, height);
      const scale = (stageScale(width, height) * CAMERA_2D.zoom) / WORLD_SCALE;
      const localX = element ? event.clientX - element.getBoundingClientRect().left : event.clientX;
      const localY = element ? event.clientY - element.getBoundingClientRect().top : event.clientY;
      if (element && (localX < 0 || localY < 0 || localX > width || localY > height)) { leave(); return; }
      this.pointer = { active: true, world: { x: (localX - origin.x) / scale, y: -(localY - origin.y) / scale, z: 0 } };
    };
    const leave = () => { this.pointer = { active: false, world: this.pointer.world }; };
    pointerTarget.addEventListener("pointermove", move as EventListener, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    this.detachPointer = () => {
      pointerTarget.removeEventListener("pointermove", move as EventListener);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
    if (element) {
      this.observer = new ResizeObserver(() => this.wake());
      this.observer.observe(element);
    }
    document.addEventListener("visibilitychange", this.wake);
    this.reduced.addEventListener("change", this.wake);
    // Recipe presentations follow the host appearance: when the theme
    // flips, the same scene is re-grounded (revision bump, no reseed) so
    // the ink re-derives — one still frame under reduced motion.
    this.themeObserver = new MutationObserver(() => this.retheme());
    this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ["data-theme", "class"] });
    this.markDormant(true);
  }

  static forWindow(onError: (message: string) => void): EngineSurface {
    const canvas = document.createElement("canvas");
    canvas.className = "oi-point-cloud-overlay";
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.oiStage = "engine";
    document.body.append(canvas);
    return new EngineSurface(canvas, null, onError);
  }

  static forElement(container: HTMLElement, onError: (message: string) => void): EngineSurface {
    const canvas = document.createElement("canvas");
    canvas.className = "oi-stage-element-surface";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" } satisfies Partial<CSSStyleDeclaration>);
    container.append(canvas);
    return new EngineSurface(canvas, container, onError);
  }

  present(id: string, recipe: string) {
    // The idle handover (after a release) is not a live presentation: the
    // same surface may present again — that is exactly the exit→re-enter
    // law. Only a different LIVE presentation refuses.
    if (this.active && this.active.id !== id && this.active.id !== STAGE_IDLE) throw new Error(`The engine surface already presents "${this.active.id}"; release it before presenting "${id}".`);
    this.live = true;
    this.settleUntil = 0;
    this.markDormant(false);
    this.activateRecipe(id, stageRecipe(recipe));
    this.wake();
  }

  presentConfig(id: string, config: unknown, sceneRef?: string, selectedIds: string[] = []) {
    if (this.active && this.active.id !== id && this.active.id !== STAGE_IDLE) throw new Error(`The engine surface already presents "${this.active.id}"; release it before presenting "${id}".`);
    if (this.retainedLeaseOwner) throw new Error("Release the native domain binding before authoring this stage");
    this.live = true;
    this.settleUntil = 0;
    this.markDormant(false);
    this.selectedIds = selectedIds;
    this.activate(id, this.sceneFrom(config as NativeConfig, sceneRef));
    this.wake();
  }

  /** Move the same canvas/context/clock between page and focused hosts.
   * Placement never creates a production adapter or changes the scene. */
  setContainer(id: string, container: HTMLElement | null) {
    this.require(id);
    if (container && (container.ownerDocument !== this.canvas.ownerDocument || !container.isConnected || container === this.canvas || this.canvas.contains(container))) {
      throw new Error("Expression container must be a connected element in this window.");
    }
    if (this.element === (container ?? this.homeElement)) return;
    this.observer?.disconnect();
    this.observer = null;
    this.element = container ?? this.homeElement;
    this.canvas.style.cssText = this.homeStyle;
    if (container) {
      Object.assign(this.canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", zIndex: "0", pointerEvents: "none" });
      container.append(this.canvas);
      this.observer = new ResizeObserver(() => this.wake());
      this.observer.observe(container);
    } else {
      this.home.append(this.canvas);
      if (this.homeElement) {
        this.observer = new ResizeObserver(() => this.wake());
        this.observer.observe(this.homeElement);
      }
    }
    this.pointer.active = false;
    this.wake();
  }

  update(id: string, recipe: string) {
    const active = this.require(id);
    const merged = mergePatch(active.recipe ?? active.scene.native?.config ?? {}, stageRecipe(recipe));
    this.activateRecipe(id, merged, id);
    this.wake();
  }

  play(id: string, sequenceId: string) {
    const active = this.require(id);
    this.clearTimers();
    const { steps } = stageSequence(sequenceId);
    if (this.reduced.matches && !this.forceMotion) {
      const merged = steps.reduce<NativeConfig>((config, step) => mergePatch(config, stageRecipe(step.recipe)), active.scene.native?.config ?? {});
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

  retainedLease(id: string): StageRetainedLease {
    this.require(id);
    if (this.retainedLeaseOwner && this.retainedLeaseOwner !== id) throw new Error(`The retained expression lease belongs to "${this.retainedLeaseOwner}".`);
    if (!this.retainedLeaseOwner) {
      if (!this.renderFrame(0)) throw new Error("The production expression field could not be materialised for retained binding.");
      this.retainedLeaseOwner = id;
    }
    const surface = this;
    const leaseIdentity = Symbol(id);
    this.retainedLeaseIdentity=leaseIdentity;
    const lease: StageRetainedLease = {
      retainedTargetPort() { return surface.adapter.retainedTargetPort(); },
      checkpointRetainedField(binding) { return surface.adapter.checkpointRetainedField(binding as { checkpoint(renderer: unknown): unknown }); },
      restoreRetainedField(binding, checkpoint) {
        surface.adapter.restoreRetainedField(binding as { restore(renderer: unknown, checkpoint: unknown): void }, checkpoint);
        surface.wake();
        return lease;
      },
      onRecoveryRequired(listener) { return surface.adapter.onRetainedRecoveryRequired(listener); },
      inspect() { return surface.adapter.inspect(); },
      pause(value = true) { surface.setPaused(value); return lease; },
      resume() { surface.setPaused(false); return lease; },
      renderOnce() { surface.renderFrame(0); return lease; },
      updatePresentation(request) {
        if(surface.retainedLeaseOwner!==id||surface.retainedLeaseIdentity!==leaseIdentity)throw new Error("This retained presentation lease is no longer current.");
        const receipt=surface.adapter.updateRetainedPresentation(request);
        // A deliberate presentation edit remains visible while an otherwise
        // healthy field is paused. Ambient wake sources stay held below.
        if(surface.paused)surface.renderFrame(0);else surface.wake();
        return receipt;
      },
    };
    Object.defineProperty(lease,"identity",{value:leaseIdentity});
    return lease;
  }

  release(id: string) {
    if (!this.active || this.active.id !== id) { this.clearTimers(); return; }
    // Keep the renderer's current allocation while the retained owner is
    // absent. Re-entry with the same field size can then rebind the existing
    // GPU textures without a seed-changing resize; this carries no Personal
    // presentation or owner generation across the release.
    const retainedParticleCount = this.retainedLeaseOwner === id
      ? this.adapter.retainedTargetPort().particleCount
      : undefined;
    this.setContainer(id, null);
    this.clearTimers();
    if (this.retainedLeaseOwner === id) {
      this.adapter.releaseRetainedField();
      this.retainedLeaseOwner = null;
      this.retainedLeaseIdentity = null;
    }
    this.live = false;
    const idleConfig = retainedParticleCount === undefined
      ? IDLE_CONFIG
      : { ...IDLE_CONFIG, particleCount: retainedParticleCount };
    this.activate(STAGE_IDLE, this.sceneFrom(idleConfig, STAGE_IDLE));
    // The hand-over: a released field settles for one bounded window (its
    // own transition to the idle scene), then the surface sleeps. Under
    // reduced motion, or while paused, there is nothing to settle — one
    // still frame and dormancy at once.
    if (this.paused || (this.reduced.matches && !this.forceMotion)) {
      this.renderFrame(0);
      this.settleUntil = 0;
      this.sleep();
      this.markDormant(true);
      return;
    }
    this.settleUntil = performance.now() + SETTLE_MS;
    this.wake();
  }

  command(command: EngineCommand) {
    // A command may arrive before the first frame (a sequence step fired
    // while the document was hidden, or straight after present()). The
    // engine materialises on its first render; give it that frame rather
    // than reporting a fatal engine failure for an impulse with no field
    // yet. A genuinely failed render still surfaces through renderFrame.
    if (!this.frames && this.active && !this.renderFrame(0)) return;
    try { this.adapter.command?.(command); }
    catch (cause) { this.fail(cause); }
  }

  /** The engine's own capture path, through the host's single field: a clean
   * re-render of the live presentation into an offscreen canvas at the given
   * size (the surface's pixel size when omitted). The engine's honesty gates
   * throw through unchanged — no live field, a lost GPU context, or a source
   * still decoding refuses instead of fabricating an image. */
  capture(width?: number, height?: number): HTMLCanvasElement {
    if (!this.active || !this.live) throw new Error("The engine surface has no live presentation to capture.");
    const w = Math.max(1, Math.round(width ?? this.canvas.width));
    const h = Math.max(1, Math.round(height ?? this.canvas.height));
    // A refused capture (for example a decoding source) is an operation
    // failure, not permission to destroy the live presentation and its draft.
    return this.adapter.withCleanFrame(() => this.adapter.capture(w, h));
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) this.sleep();
    else this.wake();
  }
  /** Walk/dev observability: whether the surface's own clock is held. */
  get isPaused() { return this.paused; }
  /** Whether a live presentation stands (a released field is not live). */
  get isLive() { return this.live; }
  /** Whether a drawing frame is currently scheduled. */
  get isScheduled() { return this.raf !== 0; }
  /** Frames rendered since creation — the honest activity counter. */
  get frameCount() { return this.frames; }
  setForceMotion(force: boolean) { this.forceMotion = force; if (force) this.wake(); }
  telemetry(): unknown { try { return this.adapter.telemetry?.() ?? null; } catch { return null; } }
  capabilities() { return this.adapter.capabilities; }

  dispose() {
    this.clearTimers();
    this.sleep();
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener("visibilitychange", this.wake);
    this.reduced.removeEventListener("change", this.wake);
    this.themeObserver?.disconnect();
    this.themeObserver = null;
    this.detachPointer();
    this.active = null;
    this.live = false;
    this.settleUntil = 0;
    this.retainedLeaseOwner = null;
    this.retainedLeaseIdentity = null;
    try { this.adapter.dispose(); } catch { /* already gone with its context */ }
    this.canvas.remove();
  }

  private activate(id: string, scene: StageScene) { this.active = { id, scene, revision: ++this.revision }; }
  /** Authored recipe material on the host's ground. The unthemed recipe is
   * kept so overlays and re-theming compose on the authored config. */
  private activateRecipe(id: string, recipe: NativeConfig, sceneId?: string) {
    const ground = hostGround();
    const themed = ground ? mergePatch(recipe, { backgroundColor: ground, color: { backgroundColor: ground } }) : recipe;
    this.active = { id, scene: this.sceneFrom(themed, sceneId), revision: ++this.revision, recipe };
  }
  private retheme() {
    const active = this.active;
    if (!active?.recipe || !this.live) return;
    this.activateRecipe(active.id, active.recipe, active.scene.id);
    this.wake();
  }
  private require(id: string): ActivePresentation {
    if (!this.active || this.active.id !== id) throw new Error(`The engine surface is not presenting "${id}".`);
    return this.active;
  }
  private sceneFrom(config: NativeConfig, id?: string): StageScene {
    const scene = nativeSnapshotToJourney({ config }).scenes[0]!;
    if (id !== undefined) scene.id = id;
    return scene;
  }
  private clearTimers() { for (const timer of this.timers) clearTimeout(timer); this.timers.length = 0; }
  /** The one admission rule for a drawing frame: a live presentation, or a
   * released one still inside its settle window. */
  private running(now: number) { return this.live || now < this.settleUntil; }
  private markDormant(dormant: boolean) {
    this.canvas.dataset.oiStageLive = dormant ? "false" : "true";
  }
  private wake = () => {
    if (this.paused || this.raf || !this.active || document.hidden) return;
    if (!this.running(performance.now())) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };
  private sleep() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  private frame = (now: number) => {
    this.raf = 0;
    if (!this.active || this.paused) return;
    // A hidden document draws nothing and schedules nothing; the
    // visibilitychange wake resumes a live field when it returns.
    if (document.hidden) { this.last = now; return; }
    if (!this.running(now)) {
      // The settle window of a released field has elapsed: one last still
      // frame of the idle scene, then dormancy.
      this.settleUntil = 0;
      this.renderFrame(0);
      this.markDormant(true);
      return;
    }
    const animate = this.forceMotion || !this.reduced.matches;
    const delta = animate ? Math.min(0.05, Math.max(0.001, (now - this.last) / 1000)) : 0;
    this.last = now;
    if (!this.renderFrame(delta)) return;
    // Reduced motion is genuinely reduced: one still frame per wake, no
    // continuous clock. Otherwise the loop continues only while the same
    // admission rule that started it still holds.
    if (animate && this.active && !this.paused && this.running(now)) this.raf = requestAnimationFrame(this.frame);
  };
  private renderFrame(delta: number): boolean {
    const element = this.element;
    let width: number, height: number;
    if (element) {
      const rect = element.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
    } else { width = window.innerWidth; height = window.innerHeight; }
    try {
      this.adapter.resize(width, height, window.devicePixelRatio || 1);
      this.adapter.render({ scene: this.active!.scene, authoringRevision: this.active!.revision, simTime: 0, delta, params: {}, camera: CAMERA_2D, pointer: this.pointer, selectedIds: this.selectedIds, scaffold: "off" });
      this.frames++;
      return true;
    } catch (cause) {
      this.sleep();
      this.fail(cause);
      return false;
    }
  }
  private fail(cause: unknown) { this.onError(cause instanceof Error ? cause.message : String(cause)); }
}
