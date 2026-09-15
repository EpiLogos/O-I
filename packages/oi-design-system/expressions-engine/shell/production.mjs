import { stateSource } from "./sourceState.mjs";
import { PointCloudField } from "../engine/PointCloudField.mjs";
import { CymaticResonator } from "../engine/cymaticResonator.mjs";
import { readPath } from "../engine/automation.mjs";
import { Color } from "three";
import { toNativeConfig, MATERIAL_KEYS } from "./nativeBridge.mjs";
import { summarizeAnalysis } from "../engine/sourceSampling.mjs";
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
  }
  capabilities = {
    name: "Native particle field",
    kind: "production",
    parameters: [...NATIVE_BINDINGS.map((p) => p.key), ...MATERIAL_KEYS, "grain"],
    physicalResonance: true,
    runtimeCheckpoints: false,
    exactSeek: false,
    notes: ["GPU particle dynamics and continuous modal resonance. One simulation clock.", "10 formations / 8 pins. Configuration saves are not runtime checkpoints.", "Live video and native-resolution PNG. Offline controlled clip rendering is not available."]
  };
  engine = null;
  // Recovery disposes GPU objects before the next render replaces them, but the
  // adapter still owns the canvas context if it is disposed during that gap.
  contextOwner = null;
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
  seedRecoveredSources = false;
  restoredClock = false;
  lost = (event) => {
    event.preventDefault();
    this.contextLost = true;
    this.dirty = true;
  };
  resize(width, height, pixelRatio) {
    this.width = width;
    this.height = height;
    this.dpr = pixelRatio;
  }
  configuration(frame) {
    const { toolbelt, propertyTracks, ...renderScene } = frame.scene;
    const sig = frame.authoringRevision === void 0 ? JSON.stringify(renderScene) : frame.scene.id + ":" + frame.authoringRevision;
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
    if (this.contextLost) throw new Error("GPU context was lost. Your expression is retained. Restore the field explicitly; its physical state must be reseeded.");
    const config = this.configuration(frame);
    if (!this.engine) {
      this.engine = new PointCloudField(this.canvas, config, true);
      this.contextOwner = this.engine;
      this.seedRecoveredSources = true;
    } else if (config !== this.applied) this.engine.replaceConfig(config);
    if (config !== this.applied) this.syncSources(frame.scene);
    this.applied = config;
    this.engine.setSelection(frame.selectedIds);
    this.engine.setGridMode(frame.scaffold ?? "off");
    const { a, b } = basis(frame.camera), o = stageCentre(this.width, this.height);
    this.engine.setHostView({ width: this.width, height: this.height, pixelRatio: this.dpr, originX: o.x + frame.camera.panX, originY: o.y + frame.camera.panY, pixelsPerUnit: stageScale(this.width, this.height) * frame.camera.zoom / WORLD_SCALE, right: a, up: b });
    this.engine.setHostPointer(frame.pointer.active, { x: frame.pointer.world.x * WORLD_SCALE, y: frame.pointer.world.y * WORLD_SCALE, z: frame.pointer.world.z * WORLD_SCALE }, frame.delta);
    this.engine.advance(frame.delta);
    if (this.seedRecoveredSources && Object.values(this.sourceStatus).every((v) => v.includes("source active"))) {
      if (this.sources.size || this.restoredClock) this.engine.seedCurrentTargets();
      this.seedRecoveredSources = false;
      this.restoredClock = false;
      this.engine.advance(0);
    }
    this.evaluated = this.engine.getEvaluation().config;
  }
  transportState() {
    return this.engine?.getTransportState();
  }
  restoreTransport(state) {
    this.engine?.restoreTransportState(state);
    this.seedRecoveredSources = true;
    this.restoredClock = true;
    this.dirty = true;
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
    const requests = scene.entities.filter((e) => e.kind === "formation").flatMap((e) => e.sequence.enabled || e.sequence.manual ? e.sequence.steps.flatMap((k, i) => {
      const source = stateSource(e, i);
      return source ? [{ entityId: e.id, linkId: k.id, source }] : [];
    }) : e.source ? [{ entityId: e.id, linkId: e.id + "_base", source: e.source }] : []);
    const ids = new Set(requests.map((r) => JSON.stringify([r.entityId, r.linkId])));
    for (const key of this.sources.keys()) if (!ids.has(key)) {
      const [entityId, linkId] = JSON.parse(key);
      this.engine?.clearCustomSource(entityId, linkId);
      this.sources.delete(key);
      delete this.sourceStatus[key];
    }
    for (const { entityId, linkId, source } of requests) {
      const key = JSON.stringify([entityId, linkId]), signature = JSON.stringify(source);
      if (this.sources.get(key) === signature) continue;
      this.sources.set(key, signature);
      this.engine?.clearCustomSource(entityId, linkId);
      delete this.sourceStatus[key];
      if (source.kind === "ascii") {
        const analysis = this.engine?.loadAsciiArt(source.ascii.text, source.ascii, entityId, linkId);
        this.sourceStatus[key] = analysis ? summarizeAnalysis(analysis, "ascii") : "ASCII source active";
        continue;
      }
      const options = source.image, url = options.dataUrl ?? "";
      if (!/^data:image\/(png|jpeg|webp);base64,/i.test(url)) {
        this.sourceStatus[key] = "Image source needs an embedded PNG, JPEG or WebP.";
        continue;
      }
      const image = new Image();
      this.sourceStatus[key] = "Decoding image\u2026";
      image.onload = () => {
        if (this.sources.get(key) !== signature || !this.engine) return;
        if (image.naturalWidth * image.naturalHeight > 16777216) {
          this.sourceStatus[key] = "Image exceeds the 16 megapixel source limit.";
          this.dirty = true;
          return;
        }
        const analysis = this.engine.loadCustomImage(image, options, entityId, linkId);
        this.sourceStatus[key] = analysis ? summarizeAnalysis(analysis, "image") : "Image source active";
        this.dirty = true;
      };
      image.onerror = () => {
        if (this.sources.get(key) === signature) {
          this.sourceStatus[key] = "The embedded image could not be decoded.";
          this.dirty = true;
        }
      };
      image.src = url;
    }
  }
  assertCaptureReady() {
    if (this.contextLost) throw new Error("GPU context lost: restore the field before capturing.");
    for (const status of Object.values(this.sourceStatus)) if (!status.includes("source active")) throw new Error("Capture waits for a valid source: " + status);
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
    return this.engine?.inspectState(readParticles);
  }
  projectNative(point) {
    return this.engine?.projectWorldToScreen(point.x * WORLD_SCALE, point.y * WORLD_SCALE, point.z * WORLD_SCALE);
  }
  stations() {
    const current = this.engine?.getCymaticStations();
    if (current?.length) return current;
    const r = new CymaticResonator();
    r.configure({ baseFrequency: this.target?.cymatics?.baseFrequency ?? 40, plateSize: this.target?.cymatics?.plateSize ?? 700 });
    return r.getAnchors().map((a) => ({ id: a.id, index: a.index, name: `Mode ${a.m}:${a.n}`, frequencyHz: a.frequencyHz, m: a.m, n: a.n, color: "#888888" }));
  }
  command(command) {
    if (command.type === "recover-context") {
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
    } else if (command.type === "pointer-effect") {
      if (!["pulse", "implode", "vortex", "shove"].includes(command.kind)) throw new Error("Unknown pointer effect.");
      if (!Number.isFinite(command.strength) || command.strength < 0 || command.strength > 20) throw new Error("Pointer effect strength must be finite and within 0\u201320.");
      if (!Number.isFinite(command.radius) || command.radius <= 0) throw new Error("Pointer effect radius must be positive.");
      this.engine.triggerPointerEffect(command.kind, command.x, command.y, command.strength, command.radius);
    } else this.engine.fireAutomation(command.id, command.delay ?? 0);
    this.dirty = true;
  }
  dispose() {
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    this.contextOwner?.destroy({ releaseContext: true });
    this.engine = null;
    this.contextOwner = null;
  }
}
export {
  ProductionAdapter
};
