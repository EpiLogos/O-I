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
        const analysis = this.engine?.loadAsciiArt(e.source.ascii.text, e.source.ascii, e.id);
        this.sourceStatus[e.id] = analysis ? summarizeAnalysis(analysis, "ascii") : "ASCII source active";
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
        const analysis = this.engine.loadCustomImage(image, options, e.id);
        this.sourceStatus[e.id] = analysis ? summarizeAnalysis(analysis, "image") : "Image source active";
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
    return r.getStations();
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
    } else this.engine.fireAutomation(command.id, command.delay ?? 0);
    this.dirty = true;
  }
  dispose() {
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    this.engine?.destroy();
    this.engine = null;
  }
}
export {
  ProductionAdapter
};
