import { PointCloudField } from "../engine/PointCloudField.mjs";
import { CymaticResonator } from "../engine/cymaticResonator.mjs";
import { readPath } from "../engine/automation.mjs";
import { Color } from "three";
import { toNativeConfig, MATERIAL_KEYS } from "./nativeBridge.mjs";
import { NATIVE_BINDINGS, WORLD_SCALE } from "./nativeParameters.mjs";
import { basis, stageCentre, stageScale } from "./camera.mjs";
const mix = (a, b, t) => a + (b - a) * t;
function color(a, b, t) {
  return "#" + new Color(a).lerp(new Color(b), t).getHexString();
}
class ProductionAdapter {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.addEventListener("webglcontextlost", this.lost);
    canvas.addEventListener("webglcontextrestored", this.restored);
  }
  capabilities = {
    name: "Native particle field",
    kind: "production",
    parameters: [...NATIVE_BINDINGS.map((p) => p.key), ...MATERIAL_KEYS, "grain"],
    physicalResonance: true,
    runtimeCheckpoints: true,
    exactSeek: false,
    notes: ["GPU particle dynamics and continuous modal resonance. One simulation clock.", "10 formations / 8 pins. Configuration saves are not runtime checkpoints; an admitted retained-field lease can checkpoint resident GPU position + velocity for recovery.", "Live video and native-resolution PNG. Offline controlled clip rendering is not available."]
  };
  engine = null;
  width = innerWidth;
  height = innerHeight;
  dpr = devicePixelRatio || 1;
  dirty = false;
  signature = "";
  sceneId = "";
  target = null;
  from = null;
  transitionStart = 0;
  duration = 0;
  evaluated = null;
  applied = null;
  sources = /* @__PURE__ */ new Map();
  sourceStatus = {};
  contextLost = false;
  retained = null;
  recoveryListeners = /* @__PURE__ */ new Set();
  lost = (event) => {
    event.preventDefault();
    this.contextLost = true;
    if (this.retained) {
      this.retained.recoveryRequired = true;
      for (const listener of this.recoveryListeners) listener("lost");
    }
    this.dirty = true;
  };
  restored = () => {
    if (!this.retained) {
      // Ordinary authored expression recovery remains the existing explicit
      // recover-context/reseed path. A browser restoration alone is not a
      // claim that its physical state survived.
      this.dirty = true;
      return;
    }
    this.contextLost = false;
    this.retained.recoveryRequired = true;
    this.dirty = true;
    for (const listener of this.recoveryListeners) listener("restored");
  };
  resize(width, height, pixelRatio) {
    this.width = width;
    this.height = height;
    this.dpr = pixelRatio;
  }
  configuration(frame) {
    const sig = frame.authoringRevision === void 0 ? JSON.stringify(frame.scene) : frame.scene.id + ":" + frame.authoringRevision;
    if (this.retained?.lockedSignature && sig !== this.retained.lockedSignature) {
      throw new Error("A retained native field is attached; release it before replacing the authored expression scene.");
    }
    if (sig !== this.signature) {
      const config = toNativeConfig(frame.scene);
      if (this.engine && this.sceneId !== frame.scene.id) {
        this.duration = frame.delta > 0 ? frame.scene.transition : 0;
        this.from = this.duration > 0 ? this.evaluated : null;
        this.transitionStart = this.engine.inspectState().simTime;
      }
      this.target = config;
      this.signature = sig;
      this.sceneId = frame.scene.id;
    }
    const target = this.target;
    if (!this.from || this.duration <= 0) return target;
    const time = this.engine?.inspectState().simTime ?? 0;
    const fraction = Math.max(0, Math.min(1, (time - this.transitionStart) / this.duration));
    if (fraction >= 1) {
      this.from = null;
      return target;
    }
    const t = fraction * fraction * (3 - 2 * fraction), a = this.from;
    const cfg = { ...target, fluid: { ...target.fluid }, material: target.material ? { ...target.material } : void 0, color: { ...target.color }, entities: target.entities?.map((e) => {
      const old = a.entities?.find((x) => x.id === e.id);
      if (!old) return e;
      return {
        ...e,
        x: mix(old.x, e.x, t),
        y: mix(old.y, e.y, t),
        z: mix(old.z, e.z, t),
        scale: mix(old.scale, e.scale, t),
        extent: e.extent && old.extent ? { ...e.extent, width: mix(old.extent.width, e.extent.width, t), height: mix(old.extent.height, e.extent.height, t), rotation: mix(old.extent.rotation, e.extent.rotation, t) } : e.extent,
        tint: color(old.tint, e.tint, t),
        tintWeight: mix(old.tintWeight, e.tintWeight, t),
        forces: { ...e.forces, strength: mix(old.forces.strength, e.forces.strength, t), radius: mix(old.forces.radius, e.forces.radius, t), spin: mix(old.forces.spin, e.forces.spin, t) }
      };
    }) };
    for (const key of Object.keys(cfg.fluid)) if (typeof cfg.fluid[key] === "number" && typeof a.fluid[key] === "number") cfg.fluid[key] = mix(a.fluid[key], cfg.fluid[key], t);
    for (const key of MATERIAL_KEYS) if (cfg.material && typeof a.material?.[key] === "number") cfg.material[key] = mix(a.material[key], target.material?.[key] ?? a.material[key], t);
    cfg.backgroundColor = color(a.backgroundColor ?? "#f4f2eb", target.backgroundColor ?? "#f4f2eb", t);
    const oldPalette = a.color?.customPaletteColors ?? [a.color.primaryColor], palette = target.color?.customPaletteColors ?? [target.color.primaryColor];
    cfg.color.customPaletteColors = palette.map((c, i) => color(oldPalette[Math.min(i, oldPalette.length - 1)], c, t));
    return cfg;
  }
  needsRender() {
    return this.dirty;
  }
  render(frame) {
    this.dirty = false;
    if (this.contextLost) {
      if (this.retained) return;
      throw new Error("GPU context was lost. Your expression is retained. Restore the field explicitly; its physical state must be reseeded.");
    }
    if (this.retained?.recoveryRequired) return;
    const config = this.configuration(frame);
    if (!this.engine) this.engine = new PointCloudField(this.canvas, config, true);
    else if (config !== this.applied) this.engine.replaceConfig(config);
    if (config !== this.applied) this.syncSources(frame.scene);
    this.applied = config;
    this.engine.setSelection(frame.selectedIds);
    this.engine.setGridMode(frame.scaffold ?? "off");
    const { a, b } = basis(frame.camera), o = stageCentre(this.width, this.height);
    this.engine.setHostView({ width: this.width, height: this.height, pixelRatio: this.dpr, originX: o.x + frame.camera.panX, originY: o.y + frame.camera.panY, pixelsPerUnit: stageScale(this.width, this.height) * frame.camera.zoom / WORLD_SCALE, right: a, up: b });
    this.engine.setHostPointer(frame.pointer.active, { x: frame.pointer.world.x * WORLD_SCALE, y: frame.pointer.world.y * WORLD_SCALE, z: frame.pointer.world.z * WORLD_SCALE }, frame.delta);
    this.engine.advance(frame.delta);
    this.evaluated = this.engine.getEvaluation().config;
  }
  telemetry() {
    if (!this.engine) return null;
    const t = this.engine.getCompositionTelemetry(), drive = this.engine.getMorphDrive(), cfg = this.engine.getEvaluation().config;
    const params = {};
    for (const b of NATIVE_BINDINGS) {
      const n = readPath(cfg, b.path);
      if (typeof n === "number") params[b.key] = n / b.factor;
    }
    return { ...t, drive, params, config: cfg, sourceStatus: { ...this.sourceStatus }, live: this.engine.getEvaluation().live, background: cfg.backgroundColor ?? "#f4f2eb", palette: cfg.color?.customPaletteColors ?? [cfg.color.primaryColor, cfg.color.accentColor, cfg.color.secondaryColor], transition: this.from ? Math.min(1, (t.simTime - this.transitionStart) / Math.max(1e-3, this.duration)) : 1 };
  }
  syncSources(scene) {
    const ids = new Set(scene.entities.map((e) => e.id));
    for (const id of this.sources.keys()) if (!ids.has(id)) {
      this.engine?.clearCustomSource(id);
      this.sources.delete(id);
      delete this.sourceStatus[id];
    }
    for (const e of scene.entities) {
      const signature = JSON.stringify(e.source ?? null);
      if (this.sources.get(e.id) === signature) continue;
      this.sources.set(e.id, signature);
      this.engine?.clearCustomSource(e.id);
      delete this.sourceStatus[e.id];
      if (e.kind === "pin" || !e.source) continue;
      if (e.source.kind === "ascii") {
        this.engine?.loadAsciiArt(e.source.ascii.text, e.source.ascii, e.id);
        this.sourceStatus[e.id] = "ASCII source active";
        continue;
      }
      const options = e.source.image, url = options.dataUrl ?? "";
      if (!/^data:image\/(png|jpeg|webp);base64,/i.test(url)) {
        this.sourceStatus[e.id] = "Image source needs an embedded PNG, JPEG or WebP. The original value is retained.";
        continue;
      }
      const image = new Image();
      this.sourceStatus[e.id] = "Decoding image\u2026";
      image.onload = () => {
        if (this.sources.get(e.id) !== signature || !this.engine) return;
        if (image.naturalWidth * image.naturalHeight > 16777216) {
          this.sourceStatus[e.id] = "Image exceeds the 16 megapixel source limit.";
          this.dirty = true;
          return;
        }
        this.engine.loadCustomImage(image, options, e.id);
        this.sourceStatus[e.id] = "Image source active";
        this.dirty = true;
      };
      image.onerror = () => {
        if (this.sources.get(e.id) === signature) {
          this.sourceStatus[e.id] = "The embedded image could not be decoded.";
          this.dirty = true;
        }
      };
      image.src = url;
    }
  }
  assertCaptureReady() {
    if (this.contextLost || this.retained?.recoveryRequired) throw new Error("GPU context recovery is incomplete: restore the retained field before capturing.");
    for (const status of Object.values(this.sourceStatus)) if (!status.endsWith("source active")) throw new Error("Capture waits for a valid source: " + status);
  }
  withCleanFrame(copy) {
    this.assertCaptureReady();
    return this.engine ? this.engine.withCleanFrame(copy) : copy();
  }
  capture(width, height) {
    this.assertCaptureReady();
    if (!this.engine) throw new Error("No rendered field yet");
    return this.engine.renderImage(width, height);
  }
  inspect(readParticles = false) {
    const field = this.engine?.inspectState(readParticles) ?? null;
    return field ? { ...field, retained: this.retained ? { targetsOwned: this.retained.external, recoveryRequired: this.retained.recoveryRequired } : null } : null;
  }
  projectNative(point) {
    return this.engine?.projectWorldToScreen(point.x * WORLD_SCALE, point.y * WORLD_SCALE, point.z * WORLD_SCALE);
  }
  stations() {
    const current = this.engine?.getCymaticStations();
    if (current?.length) return current;
    const r = new CymaticResonator();
    r.configure({ baseFrequency: this.target?.cymatics?.baseFrequency ?? 40, plateSize: this.target?.cymatics?.plateSize ?? 700 });
    return r.getStations();
  }
  /**
   * Narrow retained-field capability over this adapter's already-created native
   * field. O:I keeps renderer, simulation clock and lifecycle ownership. K8 may
   * only replace the two attraction target textures and ask O:I to checkpoint or
   * restore resident position+velocity through the existing binding.
   *
   * PointCloudField normally reasserts its authored entity targets every GPU
   * step. While this lease stands we suppress only those internal target writes;
   * the rest of O:I's physics/render path continues unchanged.
   */
  retainedTargetPort() {
    if (!this.engine || this.contextLost) throw new Error("The production field must be live before a retained target lease can attach.");
    if (!this.retained) {
      const simulator = this.engine.simulator;
      const originalOwn = Object.prototype.hasOwnProperty.call(simulator, "setTargetTextures") ? simulator.setTargetTextures : null;
      const original = simulator.setTargetTextures;
      const state = {
        simulator,
        originalOwn,
        original,
        external: false,
        recoveryRequired: false,
        lockedSignature: this.signature,
        port: null
      };
      // Internal PointCloudField entity-target writes continue until the first
      // admitted external target set. From that point onward only the retained
      // port may change target textures until the lease is released.
      simulator.setTargetTextures = (...args) => {
        if (!this.retained || !this.retained.external) return original.call(simulator, ...args);
      };
      this.retained = state;
    }
    const state = this.retained;
    if (!state.port) {
      const adapter = this;
      state.port = Object.freeze({
        get texWidth() { return state.simulator.texWidth; },
        get texHeight() { return state.simulator.texHeight; },
        get particleCount() { return state.simulator.particleCount; },
        get currentPosTarget() { return state.simulator.currentPosTarget; },
        get currentVelTarget() { return state.simulator.currentVelTarget; },
        get nextPosTarget() { return state.simulator.nextPosTarget; },
        get nextVelTarget() { return state.simulator.nextVelTarget; },
        // Authored target textures are exposed only as admission material. The
        // retained binding copies them before taking target ownership.
        get targetA() { return adapter.engine?.entities?.textureA ?? null; },
        get targetB() { return adapter.engine?.entities?.textureB ?? null; },
        setTargetTextures(targetA, targetB, centre) {
          if (adapter.retained !== state || adapter.contextLost || state.recoveryRequired) throw new Error("Retained target write is unavailable during field recovery.");
          state.external = true;
          state.original.call(state.simulator, targetA, targetB, centre);
          adapter.dirty = true;
        }
      });
    }
    return state.port;
  }
  checkpointRetainedField(binding) {
    if (!this.retained?.external || !this.engine || this.contextLost || this.retained.recoveryRequired || typeof binding?.checkpoint !== "function") {
      throw new Error("A live retained-field binding must own targets before checkpointing.");
    }
    return binding.checkpoint(this.engine.renderer);
  }
  restoreRetainedField(binding, checkpoint) {
    const state = this.retained;
    if (!state?.external || !this.engine || this.contextLost || !state.recoveryRequired || typeof binding?.restore !== "function") {
      throw new Error("Retained-field restore is only admitted after this same WebGL surface has returned.");
    }
    // Allow binding.restore() to call its port rebind while recovery is held.
    state.recoveryRequired = false;
    try {
      binding.restore(this.engine.renderer, checkpoint);
    } catch (error) {
      state.recoveryRequired = true;
      throw error;
    }
    this.dirty = true;
    return this;
  }
  onRetainedRecoveryRequired(listener) {
    if (typeof listener !== "function") throw new Error("Retained recovery listener must be callable.");
    this.recoveryListeners.add(listener);
    if (this.retained?.recoveryRequired) queueMicrotask(() => listener(this.contextLost ? "lost" : "restored"));
    return () => this.recoveryListeners.delete(listener);
  }
  releaseRetainedField() {
    const state = this.retained;
    if (!state) return;
    if (state.originalOwn) state.simulator.setTargetTextures = state.originalOwn;
    else delete state.simulator.setTargetTextures;
    this.retained = null;
    this.recoveryListeners.clear();
    if (this.engine?.entities?.textureA && this.engine?.entities?.textureB) {
      state.original.call(state.simulator, this.engine.entities.textureA, this.engine.entities.textureB, this.engine.entities.fieldCentre(), this.engine.entities.noiseTexture);
    }
    this.dirty = true;
  }
  command(command) {
    if (command.type === "recover-context") {
      if (this.retained) throw new Error("A retained field cannot be reseeded; restore its acknowledged GPU checkpoint through the retained lease.");
      this.engine?.destroy();
      this.engine = null;
      this.applied = null;
      this.target = null;
      this.from = null;
      this.signature = "";
      this.sources.clear();
      this.sourceStatus = {};
      this.contextLost = false;
      this.dirty = true;
      return;
    }
    if (!this.engine) throw new Error("The native engine has not rendered yet.");
    if (command.type === "reset-field") this.engine.resetField();
    else if (command.type === "reset-phases") this.engine.resetMorphPhases();
    else if (command.type === "disperse") {
      if (!Number.isFinite(command.strength) || Math.abs(command.strength) > 20) throw new Error("Impulse strength must be finite and within \xB120.");
      this.engine.triggerDisperse(command.strength);
    } else this.engine.fireAutomation(command.id, command.delay ?? 0);
    this.dirty = true;
  }
  dispose() {
    this.releaseRetainedField();
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    this.canvas.removeEventListener("webglcontextrestored", this.restored);
    this.engine?.destroy();
    this.engine = null;
  }
}
export {
  ProductionAdapter
};
