/**
 * The engine surface: the Global Expression Stage's runtime. One production
 * engine (the merged native field) per native window, moved into a focused
 * container when needed, hosted the way the
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
 * presentation completes its authored exit before release, then the
 * surface sleeps immediately — no frame is scheduled, the canvas is marked dormant and
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
import { stageRecipe, stageSequence, type StageSequence } from "./recipes";

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
/** Element-bounded Expression hosts need breathing room for authored loci at
 * the edge of the instrument's normal stage. This is a view fit only: scene
 * coordinates, source refs and the owner-held field remain unchanged. */
const ELEMENT_CAMERA_2D: EngineFrame["camera"] = {...CAMERA_2D,zoom:0.6};

/** The host's current canvas ground (the desktop theme's paper), read from
 * the design-system token so authored recipes — the mark, the focused
 * medium — take the ink the appearance calls for. The engine derives its
 * ink and recipe palette both follow the host; a coloured engine palette
 * otherwise overrides the monochrome ink derived from the background.
 * Absent a host token (bare test pages) the recipe's own ground stands. */
function hostAppearance(inverse = false): { background: string; ink: string } | null {
  try {
    const style = getComputedStyle(document.body);
    const background = style.getPropertyValue(inverse ? "--oi-inverse-canvas-ground" : "--oi-canvas-ground").trim();
    const ink = style.getPropertyValue(inverse ? "--oi-inverse-foreground" : "--oi-foreground").trim();
    return [background, ink].every(value => /^#[0-9a-fA-F]{6}$/.test(value)) ? { background, ink } : null;
  } catch { return null; }
}
export type StageAppearance = "host" | "inverse-host" | "authored";
export type StagePlaybackResult = { status: "completed" | "cancelled" };
interface Playback {
  id: string;
  name: string;
  sequence: StageSequence;
  elapsed: number;
  nextStep: number;
  base: NativeConfig;
  appearance: StageAppearance;
  resolve(result: StagePlaybackResult): void;
}

/** Unthemed recipe material and explicitly host-themed document material
 * are retained separately. Native instrument configs have neither override. */
interface ActivePresentation { id: string; scene: StageScene; revision: number; recipe?: NativeConfig; hostMaterial?: NativeConfig; appearance?: StageAppearance }

export class EngineSurface {
  readonly canvas: HTMLCanvasElement;
  private adapter: ProductionAdapter;
  private active: ActivePresentation | null = null;
  private themeObserver: MutationObserver | null = null;
  private revision = 0;
  private selectedIds: string[] = [];
  private live = false;
  private frames = 0;
  private playback: Playback | null = null;
  private lastPlayback: {name: string; elapsed: number; duration: number; status: "completed" | "cancelled"} | null = null;
  private backdrop: "scene" | "transparent" = "scene";
  private paintedBackground: string | null = null;
  private nativeTransition = 1;
  private renderedId: string | null = null;
  private renderedRevision = -1;
  private readyWaiters = new Set<{id: string; resolve(): void; reject(reason: Error): void}>();
  private pendingCommands: EngineCommand[] = [];
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
      const camera=element?ELEMENT_CAMERA_2D:CAMERA_2D;
      const scale = (stageScale(width, height) * camera.zoom) / WORLD_SCALE;
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
      this.observer = new ResizeObserver(this.viewportChanged);
      this.observer.observe(element);
    }
    document.addEventListener("visibilitychange", this.visibilityChanged);
    window.addEventListener("resize", this.viewportChanged);
    this.reduced.addEventListener("change", this.motionChanged);
    // Recipes and opted-in document projections follow the host appearance:
    // when the theme flips, the same scene is re-grounded (revision bump, no reseed) so
    // the ink re-derives — one still frame under reduced motion.
    this.themeObserver = new MutationObserver(() => this.retheme());
    this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ["data-theme", "class"] });
    this.markDormant(true);
  }

  static forWindow(onError: (message: string) => void): EngineSurface {
    const canvas = document.createElement("canvas");
    canvas.className = "oi-expression-surface";
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

  present(id: string, recipe: string, appearance: StageAppearance = "host") {
    // The idle handover (after a release) is not a live presentation: the
    // same surface may present again — that is exactly the exit→re-enter
    // law. Only a different LIVE presentation refuses.
    if (this.live && this.active && this.active.id !== id) throw new Error(`The engine surface already presents "${this.active.id}"; release it before presenting "${id}".`);
    this.cancelPlayback();
    this.live = true;
    this.renderedId = null;
    this.markDormant(false);
    this.activateRecipe(id, stageRecipe(recipe), undefined, appearance);
    this.wake();
  }

  presentConfig(id: string, config: unknown, sceneRef?: string, selectedIds: string[] = [], appearance: StageAppearance = "authored") {
    if (this.live && this.active && this.active.id !== id) throw new Error(`The engine surface already presents "${this.active.id}"; release it before presenting "${id}".`);
    if (this.retainedLeaseOwner) throw new Error("Release the native domain binding before authoring this stage");
    this.cancelPlayback();
    this.live = true;
    this.markDormant(false);
    this.selectedIds = selectedIds;
    if (appearance !== "authored") this.activateHostMaterial(id, config as NativeConfig, sceneRef, appearance);
    else this.activate(id, this.sceneFrom(config as NativeConfig, sceneRef));
    this.wake();
  }

  whenReady(id: string): Promise<void> {
    this.require(id);
    if (!this.live) return Promise.reject(new Error("The Expression presentation has been released."));
    if (this.renderedId === id && this.renderedRevision === this.active?.revision) return Promise.resolve();
    return new Promise((resolve, reject) => this.readyWaiters.add({id, resolve, reject}));
  }

  setBackdrop(mode: "scene" | "transparent") {
    this.backdrop = mode;
    this.paintBackdrop();
  }

  renderOnce(id: string) {
    this.require(id);
    if (!this.live) throw new Error("The Expression presentation has been released.");
    if (!document.hidden) this.renderFrame(0);
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
    this.paintedBackground = null;
    if (container) {
      Object.assign(this.canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", zIndex: "0", pointerEvents: "none" });
      container.append(this.canvas);
      this.observer = new ResizeObserver(this.viewportChanged);
      this.observer.observe(container);
    } else {
      this.home.append(this.canvas);
      if (this.homeElement) {
        this.observer = new ResizeObserver(this.viewportChanged);
        this.observer.observe(this.homeElement);
      }
    }
    this.pointer.active = false;
    this.viewportChanged();
  }

  update(id: string, recipe: string) {
    const active = this.require(id);
    this.cancelPlayback();
    const merged = mergePatch(active.recipe ?? active.scene.native?.config ?? {}, stageRecipe(recipe));
    this.activateRecipe(id, merged, id, active.appearance);
    this.wake();
  }

  play(id: string, sequenceId: string): Promise<StagePlaybackResult> {
    const active = this.require(id);
    if (!this.live) throw new Error("The Expression presentation has been released.");
    this.cancelPlayback();
    const sequence = stageSequence(sequenceId);
    return new Promise(resolve => {
      this.playback = { id, name: sequenceId, sequence, elapsed: 0, nextStep: 0,
        base: active.recipe ?? active.hostMaterial ?? active.scene.native?.config ?? {},
        appearance: active.appearance ?? "authored", resolve };
      // Reduced motion applies the final authored state once. It still
      // completes only after that frame has actually been rendered.
      if (this.reduced.matches && !this.forceMotion) this.playback.elapsed = sequence.duration;
      this.applySequenceSteps();
      this.wake();
    });
  }

  private applySequenceSteps() {
    const playback = this.playback;
    if (!playback || !this.live || this.active?.id !== playback.id) return;
    const {steps, duration} = playback.sequence;
    while (playback.nextStep < steps.length && steps[playback.nextStep].at <= playback.elapsed) {
      const index = playback.nextStep++;
      const step = steps[index];
      playback.base = mergePatch(playback.base, stageRecipe(step.recipe));
      playback.appearance = step.appearance ?? playback.appearance;
      const config = playback.appearance === "authored" ? playback.base : this.onHostGround(playback.base, playback.appearance);
      const scene = this.sceneFrom(config, `${playback.id}·${playback.name}·${index}`);
      scene.transition = Math.max(0.05, ((steps[index + 1]?.at ?? duration) - step.at) / 1000);
      this.active = {id: playback.id, scene, revision: ++this.revision,
        recipe: playback.base, appearance: playback.appearance};
      // A native command can materialise a frame before the first tick;
      // reduced motion must not inject a hidden physical impulse.
      if (step.disperse !== undefined && (!this.reduced.matches || this.forceMotion)) this.command({type: "disperse", strength: step.disperse});
    }
  }

  private advancePlayback(delta: number) {
    const playback = this.playback;
    if (!playback) return;
    playback.elapsed += delta * 1000;
    const {duration, fadeOutFrom} = playback.sequence;
    if (fadeOutFrom !== undefined) {
      this.canvas.style.opacity = String(1 - Math.max(0, Math.min(1, (playback.elapsed - fadeOutFrom) / (duration - fadeOutFrom))));
    }
    if (playback.elapsed >= duration && playback.nextStep === playback.sequence.steps.length && this.nativeTransition >= 1) {
      this.playback = null;
      this.lastPlayback = {name: playback.name, elapsed: playback.elapsed, duration, status: "completed"};
      playback.resolve({status: "completed"});
    }
  }

  private cancelPlayback() {
    const playback = this.playback;
    this.playback = null;
    this.canvas.style.opacity = "";
    if (playback) this.lastPlayback = {name: playback.name, elapsed: playback.elapsed, duration: playback.sequence.duration, status: "cancelled"};
    playback?.resolve({status: "cancelled"});
  }

  inspectPlayback() {
    const playback = this.playback;
    return playback ? {name: playback.name, elapsed: playback.elapsed, duration: playback.sequence.duration, status: "active" as const} : this.lastPlayback;
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
    const current = () => surface.live && surface.retainedLeaseOwner === id && surface.retainedLeaseIdentity === leaseIdentity;
    const requireLease = () => { if (!current()) throw new Error("This retained presentation lease is no longer current."); };
    const lease: StageRetainedLease = {
      retainedTargetPort() { requireLease(); return surface.adapter.retainedTargetPort(); },
      checkpointRetainedField(binding) { requireLease(); return surface.adapter.checkpointRetainedField(binding as { checkpoint(renderer: unknown): unknown }); },
      restoreRetainedField(binding, checkpoint) {
        requireLease();
        surface.adapter.restoreRetainedField(binding as { restore(renderer: unknown, checkpoint: unknown): void }, checkpoint);
        surface.wake();
        return lease;
      },
      onRecoveryRequired(listener) { requireLease(); return surface.adapter.onRetainedRecoveryRequired(phase => { if (current()) listener(phase); }); },
      inspect() { requireLease(); return surface.adapter.inspect(); },
      pause(value = true) { requireLease(); surface.setPaused(value); return lease; },
      resume() { requireLease(); surface.setPaused(false); return lease; },
      renderOnce() { requireLease(); surface.renderFrame(0); return lease; },
      updatePresentation(request) {
        requireLease();
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
    if (!this.active || this.active.id !== id || !this.live) return;
    this.cancelPlayback();
    this.rejectReady(id, new Error("The Expression presentation has been released."));
    this.live = false;
    this.setContainer(id, null);
    if (this.retainedLeaseOwner === id) {
      this.adapter.releaseRetainedField();
      this.retainedLeaseOwner = null;
      this.retainedLeaseIdentity = null;
    }
    // Release is a lifecycle boundary, not another visual scene. The
    // caller completes its authored exit before releasing. Keep the real
    // buffers/IDs intact, hide the canvas and stop immediately.
    this.live = false;
    this.pendingCommands = [];
    this.sleep();
    this.markDormant(true);
  }

  command(command: EngineCommand) {
    if (!this.live || !this.active) throw new Error("The engine surface has no live presentation to command.");
    if (document.hidden) { this.pendingCommands.push(command); return; }
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
    this.wake();
  }
  /** Walk/dev observability: whether the surface's own clock is held. */
  get isPaused() { return this.paused; }
  /** Whether a live presentation stands (a released field is not live). */
  get isLive() { return this.live; }
  /** Whether a drawing frame is currently scheduled. */
  get isScheduled() { return this.raf !== 0; }
  /** Frames rendered since creation — the honest activity counter. */
  get frameCount() { return this.frames; }
  setForceMotion(force: boolean) { this.forceMotion = force; this.motionChanged(); }
  telemetry(): unknown { try { return this.adapter.telemetry?.() ?? null; } catch { return null; } }
  capabilities() { return this.adapter.capabilities; }

  dispose() {
    this.cancelPlayback();
    this.rejectReady(null, new Error("The Expression field has been disposed."));
    this.sleep();
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener("visibilitychange", this.visibilityChanged);
    window.removeEventListener("resize", this.viewportChanged);
    this.reduced.removeEventListener("change", this.motionChanged);
    this.themeObserver?.disconnect();
    this.themeObserver = null;
    this.detachPointer();
    this.active = null;
    this.live = false;
    this.pendingCommands = [];
    this.retainedLeaseOwner = null;
    this.retainedLeaseIdentity = null;
    try { this.adapter.dispose(); } catch { /* already gone with its context */ }
    this.canvas.remove();
  }

  private activate(id: string, scene: StageScene) { this.active = { id, scene, revision: ++this.revision }; }
  /** Authored recipe material on the host's ground. The unthemed recipe is
   * kept so overlays and re-theming compose on the authored config. */
  private activateRecipe(id: string, recipe: NativeConfig, sceneId?: string, appearance: StageAppearance = "host") {
    const config = appearance === "authored" ? recipe : this.onHostGround(recipe, appearance);
    this.active = { id, scene: this.sceneFrom(config, sceneId), revision: ++this.revision, recipe, appearance };
  }
  private activateHostMaterial(id: string, hostMaterial: NativeConfig, sceneId?: string, appearance: StageAppearance = "host") {
    this.active = { id, scene: this.sceneFrom(this.onHostGround(hostMaterial, appearance), sceneId), revision: ++this.revision, hostMaterial, appearance };
  }
  private onHostGround(material: NativeConfig, mode: StageAppearance = "host"): NativeConfig {
    const appearance = hostAppearance(mode === "inverse-host");
    return appearance ? mergePatch(material, {
      backgroundColor: appearance.background,
      color: {
        backgroundColor: appearance.background,
        primaryColor: appearance.ink, secondaryColor: appearance.ink, accentColor: appearance.ink,
        customPaletteColors: [appearance.ink, appearance.ink],
      },
    }) : material;
  }
  private retheme() {
    const active = this.active;
    if (!active || !this.live) return;
    if (active.recipe) this.activateRecipe(active.id, active.recipe, active.scene.id, active.appearance);
    else if (active.hostMaterial) this.activateHostMaterial(active.id, active.hostMaterial, active.scene.id, active.appearance);
    else return;
    if (active.hostMaterial && this.paused && !document.hidden) { this.renderFrame(0); return; }
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
  private rejectReady(id: string | null, reason: Error) {
    for (const waiter of this.readyWaiters) if (id === null || waiter.id === id) {
      this.readyWaiters.delete(waiter); waiter.reject(reason);
    }
  }
  private paintBackdrop() {
    // The adapter exposes the evaluated colour, including native scene
    // interpolation. The canvas owns its ground; no second scrim renders it.
    const state = this.adapter.telemetry() as {background?: string; transition?: number} | null;
    this.nativeTransition = state?.transition ?? 1;
    const colour = this.backdrop === "transparent" ? "transparent" : state?.background ?? this.active?.scene.native?.config?.backgroundColor;
    if (typeof colour === "string" && this.paintedBackground !== colour) {
      this.canvas.style.backgroundColor = colour;
      this.paintedBackground = colour;
    }
  }
  private markDormant(dormant: boolean) {
    this.canvas.dataset.oiStageLive = dormant ? "false" : "true";
  }
  private motionChanged = () => {
    // A preference change during a flight must reach its final authored
    // still. Otherwise delta becomes zero below and its promise can never
    // complete. Hidden/paused presentations still wait for a permitted draw.
    if (this.reduced.matches && !this.forceMotion && this.playback) {
      this.playback.elapsed = this.playback.sequence.duration;
      this.applySequenceSteps();
      // The final step may already be interpolating. A distinct scene
      // boundary with a zero-delta render tells the native adapter to
      // resolve that interpolation as a still instead of retaining an
      // unfinished positive-duration transition with no clock to finish it.
      if (this.active) this.active = { ...this.active,
        scene: { ...this.active.scene, id: `${this.active.scene.id}·still`, transition: 0 },
        revision: ++this.revision };
    }
    this.wake();
  };
  private wake = () => {
    if (this.raf || !this.active || document.hidden) return;
    if (!this.live) return;
    if (this.paused) {
      if (this.renderedRevision !== this.active.revision) this.renderFrame(0);
      return;
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };
  private viewportChanged = () => {
    if (this.paused && this.live && this.active && !document.hidden) this.renderFrame(0);
    else this.wake();
  };
  private visibilityChanged = () => {
    if (document.hidden) this.sleep();
    else if (this.paused && this.live && this.active?.hostMaterial) this.renderFrame(0);
    else this.wake();
  };
  private sleep() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  private frame = (now: number) => {
    this.raf = 0;
    if (!this.active || !this.live || this.paused) return;
    // A hidden document draws nothing and schedules nothing; the
    // visibilitychange wake resumes a live field when it returns.
    if (document.hidden) { this.last = now; return; }
    const animate = this.forceMotion || !this.reduced.matches;
    const delta = animate ? Math.min(0.05, Math.max(0.001, (now - this.last) / 1000)) : 0;
    this.last = now;
    this.applySequenceSteps();
    if (!this.renderFrame(delta)) return;
    this.advancePlayback(delta);
    // Reduced motion is genuinely reduced: one still frame per wake, no
    // continuous clock. Otherwise the loop continues only while the same
    // admission rule that started it still holds.
    if (animate && this.active && !this.paused && this.live) this.raf = requestAnimationFrame(this.frame);
  };
  private renderFrame(delta: number): boolean {
    if (!this.active || !this.live || document.hidden) return false;
    const element = this.element;
    let width: number, height: number;
    if (element) {
      const rect = element.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
    } else { width = window.innerWidth; height = window.innerHeight; }
    try {
      this.adapter.resize(width, height, window.devicePixelRatio || 1);
      this.adapter.render({ scene: this.active!.scene, authoringRevision: this.active!.revision, simTime: 0, delta, params: {}, camera: this.element?ELEMENT_CAMERA_2D:CAMERA_2D, pointer: this.pointer, selectedIds: this.selectedIds, scaffold: "off" });
      for (const command of this.pendingCommands.splice(0)) this.adapter.command(command);
      this.frames++;
      this.renderedId = this.active!.id;
      this.renderedRevision = this.active!.revision;
      this.paintBackdrop();
      for (const waiter of this.readyWaiters) if (waiter.id === this.renderedId) {
        this.readyWaiters.delete(waiter); waiter.resolve();
      }
      return true;
    } catch (cause) {
      this.sleep();
      this.fail(cause);
      return false;
    }
  }
  private fail(cause: unknown) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    this.rejectReady(null, error);
    this.cancelPlayback();
    this.onError(error.message);
  }
}
