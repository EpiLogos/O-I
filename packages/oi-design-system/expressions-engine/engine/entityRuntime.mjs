import {ConnectionRuntime} from "../oi/connectionRuntime.mjs";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from "three";
import {
  layoutPartitions,
  effectiveLinks,
  MAX_FORMATIONS
} from "./fieldModel.mjs";
import { resolveEntityPose } from "./entityPose.mjs";
const BASE_SCALE = 0.56;
class EntityRuntime {
  sampler;
  connections = new ConnectionRuntime();
  bakeGeneration = 0;
  currentPlane = "vertical";
  texW = 0;
  texH = 0;
  particleCount = 0;
  dataA = new Float32Array(0);
  dataB = new Float32Array(0);
  noiseData = new Float32Array(0);
  noiseTexture = null;
  textureA = null;
  textureB = null;
  partitions = [];
  layoutSig = "";
  bakeSig = /* @__PURE__ */ new Map();
  lastStep = /* @__PURE__ */ new Map();
  customCandidates = /* @__PURE__ */ new Map();
  candidateCache = /* @__PURE__ */ new Map();
  baseSig = "";
  templateGeometry = "square";
  templateDimension = "2D";
  uniforms = {
    count: 0,
    bounds: new Float32Array(10),
    centers: Array.from({ length: 10 }, () => new THREE.Vector4(0, 0, 0, 200)),
    morph: new Float32Array(10),
    transforms: Array.from({ length: 10 }, () => new THREE.Vector3(1, 1, 0)),
    depthScales: new Float32Array(10).fill(1),
    normalized: new Float32Array(10),
    tints: Array.from({ length: 10 }, () => new THREE.Color("#ffffff")),
    tintWeights: new Float32Array(10)
  };
  constructor(sampler) {
    this.sampler = sampler;
  }
  // ------------------------------------------------------------------ allocation
  allocate(particleCount, texW, texH) {
    this.disposeTextures();
    this.texW = texW;
    this.texH = texH;
    this.particleCount = particleCount;
    this.connections.resize(particleCount);
    this.dataA = new Float32Array(texW * texH * 4);
    this.dataB = new Float32Array(texW * texH * 4);
    this.noiseData = new Float32Array(texW * texH * 4);
    this.noiseTexture = new THREE.DataTexture(this.noiseData, texW, texH, THREE.RGBAFormat, THREE.FloatType);
    this.textureA = new THREE.DataTexture(this.dataA, texW, texH, THREE.RGBAFormat, THREE.FloatType);
    this.textureB = new THREE.DataTexture(this.dataB, texW, texH, THREE.RGBAFormat, THREE.FloatType);
    for (const t of [this.textureA, this.textureB, this.noiseTexture]) {
      t.minFilter = THREE.NearestFilter;
      t.magFilter = THREE.NearestFilter;
      t.needsUpdate = true;
    }
    this.layoutSig = "";
    this.bakeSig.clear();
    this.lastStep.clear();
  }
  disposeTextures() {
    this.textureA?.dispose();
    this.textureB?.dispose();
    this.noiseTexture?.dispose();
    this.noiseTexture = null;
    this.textureA = null;
    this.textureB = null;
  }
  dispose() {
    this.disposeTextures();
    this.candidateCache.clear();
  }
  getPartitions() {
    return this.partitions;
  }
  /** Base bake context (style/font/plane). Changing it invalidates every partition. */
  setBaseContext(style, fontFamily, fontWeight, plane, template) {
    this.templateGeometry = template?.plateGeometry ?? "square";
    this.templateDimension = template?.dimension ?? "2D";
    const sig = `${style}|${fontFamily ?? ""}|${fontWeight ?? ""}|${plane}|${this.templateGeometry}|${this.templateDimension}`;
    if (sig !== this.baseSig) {
      this.baseSig = sig;
      this.candidateCache.clear();
      this.bakeSig.clear();
    }
  }
  /** Image / ASCII sources: override a formation's shape with an explicit candidate pool. */
  setCustomCandidates(entityId, candidates, linkId) {
    const key = linkId ? entityId + ":" + linkId : entityId;
    if (candidates) this.customCandidates.set(key, candidates);
    else this.customCandidates.delete(key);
    this.bakeSig.delete(entityId);
  }
  // ------------------------------------------------------------------ shapes
  shapeSignature(shape) {
    return `${shape.kind}|${shape.text ?? ""}|${shape.yantraId ?? ""}|${shape.frequencyHz ?? ""}|${shape.primitive ?? ""}|${shape.plateGeometry ?? ""}|${shape.dimension ?? ""}`;
  }
  candidatesFor(shape, fontFamily, fontWeight) {
    const sig = this.shapeSignature(shape);
    const cached = this.candidateCache.get(sig);
    if (cached) return cached;
    let out;
    const pseudo = {
      id: shape.yantraId || "anahata",
      shape: shape.kind === "glyph" ? "glyph" : shape.kind === "cymatic" ? "cymatic" : "yantra",
      glyphText: shape.text,
      name: "",
      sanskrit: "",
      seedSyllable: shape.text || "\u0950",
      symbol: shape.text || "\u2726",
      frequencyHz: shape.frequencyHz ?? 396,
      x: 0,
      y: 0,
      scale: 1,
      color: "#ffffff",
      attractorStrength: 0,
      active: true
    };
    if (shape.kind === "primitive") {
      out = [];
      const kind = shape.primitive ?? "disc";
      for (let j = 0; j < 192; j++) for (let i = 0; i < 192; i++) {
        const x = (i / 191 - 0.5) * 400, y = (j / 191 - 0.5) * 400;
        const r = Math.hypot(x, y);
        const inside = kind === "square" || kind === "disc" && r <= 200 || kind === "ring" && r >= 140 && r <= 200 || kind === "triangle" && y >= -200 && y <= 200 && Math.abs(x) <= (200 - y) / 2;
        if (inside) out.push({ x, y, density: 1 });
      }
    } else if (shape.kind === "cymatic") {
      out = this.sampler.sampleCymaticTemplate({ frequencyHz: shape.frequencyHz ?? 396, plateGeometry: shape.plateGeometry ?? this.templateGeometry, dimension: shape.dimension ?? this.templateDimension }).candidates;
    } else {
      out = this.sampler.rasterizeSpatialNode(pseudo, shape.kind === "glyph" ? "symbol" : "yantra", fontFamily, fontWeight, "yantraA").candidates;
    }
    if (out.length === 0) out = [{ x: 0, y: 0, density: 1 }];
    this.candidateCache.set(sig, out);
    return out;
  }
  // ------------------------------------------------------------------ layout & baking
  /** Recompute partitions. Returns true when the layout changed (all partitions need baking). */
  layout(entities) {
    this.partitions = layoutPartitions(entities, this.connections.start);
    const sig = this.partitions.map((p) => `${p.entityId}:${p.start}-${p.end}`).join(",");
    if (sig === this.layoutSig) return false;
    this.layoutSig = sig;
    this.bakeSig.clear();
    return true;
  }
  writeCandidates(target, start, end, cands, scale, plane, jitterPx, channel) {
    const n = cands.length;
    if (!n) {
      target.fill(0, start * 4, end * 4);
      for (let i = start; i < end; i++) {
        this.noiseData[i * 4 + channel] = 0;
        this.noiseData[i * 4 + channel + 1] = 0;
      }
      return;
    }
    for (let i = start; i < end; i++) {
      const c = cands[Math.floor((i - start) * 0.6180339887498949 % 1 * n)];
      const jx = (Math.random() - 0.5) * jitterPx;
      const jy = (Math.random() - 0.5) * jitterPx;
      this.noiseData[i * 4 + channel] = jx;
      this.noiseData[i * 4 + channel + 1] = jy;
      const lx = c.x * scale;
      const ly = c.y * scale;
      const lz = (c.z ?? 0) * scale;
      const o = i * 4;
      if (plane === "horizontal") {
        target[o] = lx;
        target[o + 1] = lz;
        target[o + 2] = -ly;
      } else {
        target[o] = lx;
        target[o + 1] = ly;
        target[o + 2] = lz;
      }
      target[o + 3] = c.density;
    }
  }
  bakePartition(p, e, linkIndex, nextIndex, plane, fontFamily, fontWeight) {
    const links = effectiveLinks(e);
    const custom = this.customCandidates.get(e.id);
    const candA = this.customCandidates.get(e.id + ":" + links[linkIndex].id) ?? (custom && linkIndex === 0 ? custom : this.candidatesFor(links[linkIndex].shape, fontFamily, fontWeight));
    const candB = this.customCandidates.get(e.id + ":" + links[nextIndex].id) ?? (custom && nextIndex === 0 ? custom : this.candidatesFor(links[nextIndex].shape, fontFamily, fontWeight));
    this.bakeGeneration++;
    const normalize = (cands) => {
      if (!e.extent || e.extent.normalized === false) return cands;
      const core = cands.filter((c) => c.density > 0.25);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of core.length ? core : cands) {
        x0 = Math.min(x0, c.x);
        x1 = Math.max(x1, c.x);
        y0 = Math.min(y0, c.y);
        y1 = Math.max(y1, c.y);
      }
      const sx = 400 / Math.max(1, x1 - x0), sy = 400 / Math.max(1, y1 - y0);
      return cands.map((c) => ({ ...c, x: (c.x - (x0 + x1) / 2) * sx, y: (c.y - (y0 + y1) / 2) * sy }));
    };
    const preset = (cands) => cands.norm === "stage400" ? cands : normalize(cands);
    const scale = e.extent && e.extent.normalized !== false ? 1 : BASE_SCALE;
    this.writeCandidates(this.dataA, p.start, p.end, preset(candA), scale, plane, 2, 0);
    this.writeCandidates(this.dataB, p.start, p.end, preset(candB), scale, plane, 2, 2);
    if (this.noiseTexture) this.noiseTexture.needsUpdate = true;
    if (this.textureA) this.textureA.needsUpdate = true;
    if (this.textureB) this.textureB.needsUpdate = true;
  }
  /**
   * Per-frame update: resolves every formation's sequence, re-bakes partitions whose links changed,
   * and refreshes the uniform set. Returns the frames + impulses to fire (link changes).
   */
  update(entities, comp, simTime, drivePhase, manualMorph, holdRatio, fontFamily, fontWeight) {
    this.currentPlane = comp.plane;
    const byId = new Map(entities.map((e) => [e.id, e]));
    const frames = [];
    const poses = entities.map((entity) => resolveEntityPose(entity, simTime, drivePhase, manualMorph, holdRatio));
    const poseById = new Map(poses.map((pose) => [pose.entityId, pose]));
    const impulses = [];
    let rebaked = false;
    const u = this.uniforms;
    u.count = Math.min(MAX_FORMATIONS, this.partitions.length);
    this.partitions.forEach((p, i) => {
      if (i >= 10) return;
      const e = byId.get(p.entityId);
      if (!e) return;
      const pose = poseById.get(e.id);
      const state = pose.sequence;
      const links = effectiveLinks(e);
      const sig = `${links[state.linkIndex].id}:${links[state.nextIndex].id}|${this.shapeSignature(links[state.linkIndex].shape)}>${this.shapeSignature(links[state.nextIndex].shape)}|${!!e.extent && e.extent.normalized !== false}|${this.customCandidates.has(e.id) ? `c:${state.linkIndex === 0}:${state.nextIndex === 0}` : ""}`;
      const prevStep = this.lastStep.get(e.id);
      if (this.bakeSig.get(e.id) !== sig) {
        this.bakePartition(p, e, state.linkIndex, state.nextIndex, comp.plane, fontFamily, fontWeight);
        this.bakeSig.set(e.id, sig);
        rebaked = true;
      }
      if (prevStep !== void 0 && prevStep !== state.step && e.sequence.impulse > 0) impulses.push(e.sequence.impulse);
      this.lastStep.set(e.id, state.step);
      u.bounds[i] = p.end;
      u.centers[i].set(pose.x, pose.y, pose.z, Math.max(5, pose.forces.radius));
      u.morph[i] = state.progress;
      u.depthScales[i] = Math.max(1e-3, pose.scale);
      u.normalized[i] = e.extent && e.extent.normalized !== false ? 1 : 0;
      u.transforms[i].set(Math.max(1e-3, pose.scale) * (pose.extent ? pose.extent.width / 400 : 1), Math.max(1e-3, pose.scale) * (pose.extent ? pose.extent.height / 400 : 1), pose.extent?.rotation ?? 0);
      u.tints[i].set(pose.tint);
      u.tintWeights[i] = Math.max(0, Math.min(1, pose.tintWeight * comp.entityTintWeight));
      frames.push({ entityId: e.id, index: i, state });
    });
    for (let i = u.count; i < 10; i++) {
      u.bounds[i] = this.particleCount;
      u.tintWeights[i] = 0;
      u.morph[i] = 0;
    }
    this.connections.update(poses, this.dataA, this.dataB, this.noiseData);
    if (this.connections.enabled) {
      this.textureA.needsUpdate = true; this.textureB.needsUpdate = true; this.noiseTexture.needsUpdate = true;
    }
    this.uniforms.connectionStart = this.connections.start;
    return { frames, poses, impulses, rebaked };
  }
  /** Explicit reset: particle seed = current blended targets translated to each entity's centre. */
  buildSeed() {
    const seed = new Float32Array(this.dataA.length);
    seed.set(this.dataA);
    if (!this.partitions.length) {
      const count = seed.length / 4;
      for (let i = 0; i < count; i++) {
        seed[i * 4] = ((i + 0.5) * 0.6180339887498949 % 1 - 0.5) * 700;
        seed[i * 4 + 1] = ((i + 0.5) / count - 0.5) * 700;
        seed[i * 4 + 2] = 0;
        seed[i * 4 + 3] = 0.8;
      }
    }
    this.partitions.forEach((p, i) => {
      if (i >= 10) return;
      const c = this.uniforms.centers[i];
      for (let k = p.start; k < p.end; k++) {
        const tr = this.uniforms.transforms[i], blend = this.uniforms.morph[i];
        for (let channel = 0; channel < 4; channel++) {
          const offset = k * 4 + channel;
          seed[offset] = this.dataA[offset] + (this.dataB[offset] - this.dataA[offset]) * blend;
        }
        const horizontal = this.currentPlane === "horizontal";
        const jx = this.noiseData[k * 4] + (this.noiseData[k * 4 + 2] - this.noiseData[k * 4]) * blend, jy = this.noiseData[k * 4 + 1] + (this.noiseData[k * 4 + 3] - this.noiseData[k * 4 + 1]) * blend, normalized = this.uniforms.normalized[i] > 0.5;
        const x = (seed[k * 4] + (normalized ? jx : 0)) * tr.x, y = ((horizontal ? -seed[k * 4 + 2] : seed[k * 4 + 1]) + (normalized ? jy : 0)) * tr.y;
        const nx = normalized ? 0 : jx, ny = normalized ? 0 : jy;
        const co = Math.cos(tr.z), si = Math.sin(tr.z);
        seed[k * 4] = x * co - y * si + nx + c.x;
        if (horizontal) {
          seed[k * 4 + 2] = -(x * si + y * co + ny) + c.z;
          seed[k * 4 + 1] = seed[k * 4 + 1] * this.uniforms.depthScales[i] + c.y;
        } else {
          seed[k * 4 + 1] = x * si + y * co + ny + c.y;
          seed[k * 4 + 2] = seed[k * 4 + 2] * this.uniforms.depthScales[i] + c.z;
        }
      }
    });
    return seed;
  }
  /** Centroid of all formation centres (field-level vortex reference) */
  fieldCentre() {
    const n = this.uniforms.count;
    if (n === 0) return new THREE.Vector2(0, 0);
    let x = 0;
    let y = 0;
    for (let i = 0; i < n; i++) {
      x += this.uniforms.centers[i].x;
      y += this.uniforms.centers[i].y;
    }
    return new THREE.Vector2(x / n, y / n);
  }
}
export {
  EntityRuntime
};
