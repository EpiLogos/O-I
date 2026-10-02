import { ConnectionRuntime } from "../oi/connectionRuntime.mjs";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from "three";
import { geometryCandidates } from "./formationGeometryProjection.mjs";
import {
  SDF_ATLAS_WIDTH,
  SDF_ATLAS_HEIGHT,
  SDF_TILE_U,
  SDF_TILE_V,
  allocateEntitySlot,
  buildSdfTile,
  writeSdfTile
} from "./sdfField.mjs";
import {
  layoutPartitions,
  effectiveLinks,
  MAX_FORMATIONS
} from "./fieldModel.mjs";
import { resolveEntityPose } from "./entityPose.mjs";
import { drawVolumeZ, mulberry32, hashString, buildDepthFieldsFromMask, cellVolumeShape, DEFAULT_GLYPH_VOLUME } from "./glyphVolume.mjs";
const BASE_SCALE = 0.56;
const CANDIDATE_CACHE_MAX_ENTRIES = 128;
const CANDIDATE_CACHE_MAX_BYTES = 32 * 1024 * 1024;
const CANDIDATE_ESTIMATED_BYTES = 128;
class EntityRuntime {
  connections = new ConnectionRuntime();
  sampler;
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
  geometryProjection = null;
  candidateCache = /* @__PURE__ */ new Map();
  candidateCacheBytes = 0;
  candidateCacheHits = 0;
  candidateCacheMisses = 0;
  candidateCacheEvictions = 0;
  candidateCacheOversized = 0;
  baseSig = "";
  templateGeometry = "square";
  templateDimension = "2D";
  /** Active true-3D letterform law; mirrored onto the sampler that builds pools. */
  volume = DEFAULT_GLYPH_VOLUME;
  // Glyph SDF atlas: 2 columns (state A|B) x MAX_FORMATIONS rows (stable entity slots), RGBA float.
  // Uploaded alongside the targets at bake time; never rewritten during steady-state frames.
  collisionTexture = null;
  /** Per-partition tile rect (uv origin x/y, tile width u, enabled) pushed to the simulator. */
  collisionTiles = new Float32Array(MAX_FORMATIONS * 4);
  collisionData = new Float32Array(0);
  collisionSlots = /* @__PURE__ */ new Map();
  uniforms = {
    count: 0,
    connectionStart: 0,
    bounds: new Float32Array(MAX_FORMATIONS),
    centers: Array.from({ length: MAX_FORMATIONS }, () => new THREE.Vector4(0, 0, 0, 200)),
    morph: new Float32Array(MAX_FORMATIONS),
    transforms: Array.from({ length: MAX_FORMATIONS }, () => new THREE.Vector3(1, 1, 0)),
    depthScales: new Float32Array(MAX_FORMATIONS).fill(1),
    normalized: new Float32Array(MAX_FORMATIONS),
    tints: Array.from({ length: MAX_FORMATIONS }, () => new THREE.Color("#ffffff")),
    tintWeights: new Float32Array(MAX_FORMATIONS)
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
    this.collisionData = new Float32Array(SDF_ATLAS_WIDTH * SDF_ATLAS_HEIGHT * 4);
    this.collisionTexture = new THREE.DataTexture(this.collisionData, SDF_ATLAS_WIDTH, SDF_ATLAS_HEIGHT, THREE.RGBAFormat, THREE.FloatType);
    this.collisionTexture.minFilter = THREE.NearestFilter;
    this.collisionTexture.magFilter = THREE.NearestFilter;
    this.collisionTexture.needsUpdate = true;
    for (const t of [this.textureA, this.textureB, this.noiseTexture]) {
      t.minFilter = THREE.NearestFilter;
      t.magFilter = THREE.NearestFilter;
      t.needsUpdate = true;
    }
    this.collisionSlots.clear();
    this.collisionTiles.fill(0);
    this.layoutSig = "";
    this.bakeSig.clear();
    this.lastStep.clear();
  }
  disposeTextures() {
    this.textureA?.dispose();
    this.textureB?.dispose();
    this.noiseTexture?.dispose();
    this.noiseTexture = null;
    this.collisionTexture?.dispose();
    this.collisionTexture = null;
    this.textureA = null;
    this.textureB = null;
  }
  dispose() {
    this.disposeTextures();
    this.clearCandidateCache();
    this.geometryProjection = null;
  }
  clearCandidateCache() {
    this.candidateCache.clear();
    this.candidateCacheBytes = 0;
  }
  /** Recomputable pools only; authored image/ASCII sources are retained separately. */
  getCandidateCacheStats() {
    return {
      entries: this.candidateCache.size,
      estimatedBytes: this.candidateCacheBytes,
      maxEntries: CANDIDATE_CACHE_MAX_ENTRIES,
      maxEstimatedBytes: CANDIDATE_CACHE_MAX_BYTES,
      hits: this.candidateCacheHits,
      misses: this.candidateCacheMisses,
      evictions: this.candidateCacheEvictions,
      oversized: this.candidateCacheOversized
    };
  }
  retainCandidates(sig, candidates) {
    const estimatedBytes = candidates.length * CANDIDATE_ESTIMATED_BYTES + sig.length * 2 + 256;
    if (estimatedBytes > CANDIDATE_CACHE_MAX_BYTES) {
      this.candidateCacheOversized++;
      return;
    }
    while (this.candidateCache.size >= CANDIDATE_CACHE_MAX_ENTRIES || this.candidateCacheBytes + estimatedBytes > CANDIDATE_CACHE_MAX_BYTES) {
      const oldest = this.candidateCache.keys().next().value;
      if (oldest === void 0) break;
      this.candidateCacheBytes -= this.candidateCache.get(oldest).estimatedBytes;
      this.candidateCache.delete(oldest);
      this.candidateCacheEvictions++;
    }
    this.candidateCache.set(sig, { candidates, estimatedBytes });
    this.candidateCacheBytes += estimatedBytes;
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
      this.clearCandidateCache();
      this.bakeSig.clear();
    }
  }
  /**
   * True 3D letterform bodies. Thickness is baked into the candidate pool, so a
   * change to the law has to invalidate both the pool and every partition built
   * from it — otherwise a slider in the studio would move nothing. Returns true
   * when the law actually changed.
   */
  setVolume(config) {
    const next = config ?? DEFAULT_GLYPH_VOLUME;
    const changed = this.sampler.setVolume(next);
    this.volume = next;
    if (changed) {
      this.clearCandidateCache();
      this.bakeSig.clear();
    }
    return changed;
  }
  getVolume() {
    return this.volume;
  }
  /** Reversible source geometry; authored image/layer pools remain intact. */
  setGeometryProjection(value) {
    const key = value ? JSON.stringify(value) : "";
    if (key === (this.geometryProjection?.key ?? "")) return;
    const candidate = value ? { key, entityId: value.entityId, candidates: geometryCandidates(value) } : null;
    if (this.geometryProjection) this.bakeSig.delete(this.geometryProjection.entityId);
    this.geometryProjection = candidate;
    if (candidate) this.bakeSig.delete(candidate.entityId);
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
    if (cached) {
      this.candidateCache.delete(sig);
      this.candidateCache.set(sig, cached);
      this.candidateCacheHits++;
      return cached.candidates;
    }
    this.candidateCacheMisses++;
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
      if (this.volume.enabled && this.volume.depth > 0 && out.length) {
        const G = 192, mask = new Uint8Array(G * G);
        for (const c of out) {
          const gx = Math.round((c.x + 200) / 400 * (G - 1));
          const gy = Math.round((200 - c.y) / 400 * (G - 1));
          mask[gy * G + gx] = 1;
        }
        const fields = buildDepthFieldsFromMask(mask, G, G);
        for (const c of out) {
          const gx = Math.max(0, Math.min(G - 1, Math.round((c.x + 200) / 400 * (G - 1))));
          const gy = Math.max(0, Math.min(G - 1, Math.round((200 - c.y) / 400 * (G - 1))));
          const s = cellVolumeShape(fields.distInside[gy * G + gx], fields.distToInk[gy * G + gx], fields.referenceThickness, c.density, this.volume);
          c.hz = s.half;
          c.cw = s.contourness;
        }
      }
    } else if (shape.kind === "cymatic") {
      out = this.sampler.sampleCymaticTemplate({ frequencyHz: shape.frequencyHz ?? 396, plateGeometry: shape.plateGeometry ?? this.templateGeometry, dimension: shape.dimension ?? this.templateDimension, seed: hashString(sig) }).candidates;
    } else {
      out = this.sampler.rasterizeSpatialNode(pseudo, shape.kind === "glyph" ? "symbol" : "yantra", fontFamily, fontWeight, "yantraA", hashString(sig)).candidates;
    }
    if (out.length === 0) out = [{ x: 0, y: 0, density: 1 }];
    this.retainCandidates(sig, out);
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
  writeCandidates(target, start, end, cands, scale, plane, jitterPx, channel, depthOffset = 0) {
    const n = cands.length;
    if (!n) {
      target.fill(0, start * 4, end * 4);
      for (let i = start; i < end; i++) {
        this.noiseData[i * 4 + channel] = 0;
        this.noiseData[i * 4 + channel + 1] = 0;
      }
      return;
    }
    const volume = this.volume;
    const volumeOn = volume.enabled && volume.depth > 0;
    const rand = volumeOn ? mulberry32((start + 1) * 2654435761 + (channel + 1) * 40503 + n) : null;
    const jitter = mulberry32((start + 1) * 40503 + (channel + 1) * 2654435761 + n);
    for (let i = start; i < end; i++) {
      const c = cands[Math.floor((i - start) * 0.6180339887498949 % 1 * n)];
      const jx = (jitter() - 0.5) * jitterPx;
      const jy = (jitter() - 0.5) * jitterPx;
      this.noiseData[i * 4 + channel] = jx;
      this.noiseData[i * 4 + channel + 1] = jy;
      const lx = c.x * scale;
      const ly = c.y * scale;
      let lz = (c.z ?? 0) * scale;
      if (volumeOn && rand && c.hz !== void 0) {
        lz = drawVolumeZ(Math.max(0, c.hz) * scale, c.cw ?? 0, volume, rand).z;
      }
      lz += depthOffset;
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
  /** Stage-box normalization shared by every pool path: glyph-law pools are
   *  stretched to the 400-unit square; stage400 pools (image/ASCII) keep their
   *  true aspect. */
  presetPool(e, cands, sourcePool = false) {
    if (!e.extent || e.extent.normalized === false) return cands;
    const core = cands.filter((c) => c.density > 0.25);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of core.length ? core : cands) {
      x0 = Math.min(x0, c.x);
      x1 = Math.max(x1, c.x);
      y0 = Math.min(y0, c.y);
      y1 = Math.max(y1, c.y);
    }
    let sx = 400 / Math.max(1, x1 - x0), sy = 400 / Math.max(1, y1 - y0);
    if (sourcePool) sx = sy = Math.min(sx, sy);
    return cands.map((c) => ({ ...c, x: (c.x - (x0 + x1) / 2) * sx, y: (c.y - (y0 + y1) / 2) * sy }));
  }
  /** A link's candidate pool: per-link custom source, the entity-wide override on link 0, else the shape. */
  linkCandidates(e, link, linkIndex, custom, fontFamily, fontWeight) {
    return this.customCandidates.get(e.id + ":" + link.id) ?? (custom && linkIndex === 0 ? custom : this.candidatesFor(link.shape, fontFamily, fontWeight));
  }
  /** A layer's candidate pool: its loaded image/ASCII source, else its shape. */
  layerCandidates(e, layer, custom, fontFamily, fontWeight) {
    return this.customCandidates.get(e.id + ":" + layer.id) ?? this.candidatesFor(layer.shape, fontFamily, fontWeight);
  }
  bakePartition(p, e, linkIndex, nextIndex, plane, fontFamily, fontWeight) {
    const geometry = this.geometryProjection?.entityId === e.id ? this.geometryProjection : null;
    if (geometry) {
      this.bakeGeneration++;
      const scale = e.extent && e.extent.normalized !== false ? 1 : BASE_SCALE;
      for (const channel of [0, 2]) this.writeCandidates(channel === 0 ? this.dataA : this.dataB, p.start, p.end, geometry.candidates, scale, plane, 0, channel);
      if (this.noiseTexture) this.noiseTexture.needsUpdate = true;
      if (this.textureA) this.textureA.needsUpdate = true;
      if (this.textureB) this.textureB.needsUpdate = true;
      if (this.collisionTexture) {
        const slot2 = this.collisionSlot(e.id);
        if (slot2 >= 0) {
          for (const channel of [0, 1]) writeSdfTile(this.collisionData, slot2, channel, buildSdfTile(geometry.candidates, scale));
          this.collisionTexture.needsUpdate = true;
        }
      }
      return;
    }
    const links = effectiveLinks(e);
    const custom = this.customCandidates.get(e.id);
    const slot = this.collisionTexture ? this.collisionSlot(e.id) : -1;
    for (const [index, channel] of [[linkIndex, 0], [nextIndex, 2]]) {
      const link = links[index];
      const normalized = link.state?.extent?.normalized ?? e.extent?.normalized ?? !!e.extent;
      const body = { ...e, extent: { ...e.extent, width: e.extent?.width ?? 400, height: e.extent?.height ?? 400, rotation: e.extent?.rotation ?? 0, normalized } };
      const scale = normalized ? 1 : BASE_SCALE;
      const target = channel === 0 ? this.dataA : this.dataB;
      const layers = link.layers ?? e.layers;
      let union;
      if (layers?.length) {
        union = [];
        const per = Math.floor((p.end - p.start) / layers.length);
        const reach = Math.max(...layers.map((l) => Math.abs(l.z)), 0);
        layers.forEach((layer, k) => {
          const pool = this.presetPool(body, this.layerCandidates(e, layer, custom, fontFamily, fontWeight), this.customCandidates.has(e.id + ":" + layer.id)).map((c) => {
            const ls = Math.max(1e-3, layer.scale ?? 1);
            return { ...c, x: c.x * ls, y: c.y * ls, ...c.hz === void 0 ? {} : { hz: c.hz * ls } };
          });
          const start = p.start + k * per, end = k === layers.length - 1 ? p.end : start + per;
          this.writeCandidates(target, start, end, pool, scale, plane, 2, channel, layer.z);
          union.push(...pool.map((c) => ({ ...c, hz: Math.max(c.hz ?? 0, reach) })));
        });
      } else {
        union = this.presetPool(body, this.linkCandidates(e, link, index, custom, fontFamily, fontWeight), this.customCandidates.has(e.id + ":" + link.id) || !!(custom && index === 0));
        this.writeCandidates(target, p.start, p.end, union, scale, plane, 2, channel);
      }
      this.bakeGeneration++;
      if (slot >= 0) writeSdfTile(this.collisionData, slot, channel === 0 ? 0 : 1, buildSdfTile(union, scale));
    }
    if (this.noiseTexture) this.noiseTexture.needsUpdate = true;
    if (this.textureA) this.textureA.needsUpdate = true;
    if (this.textureB) this.textureB.needsUpdate = true;
    if (this.collisionTexture) this.collisionTexture.needsUpdate = true;
  }
  /** Stable atlas row per entity id; -1 when all formation rows are taken. */
  collisionSlot(entityId) {
    let slot = this.collisionSlots.get(entityId);
    if (slot === void 0) {
      slot = allocateEntitySlot(this.collisionSlots.values());
      if (slot >= 0) this.collisionSlots.set(entityId, slot);
    }
    return slot;
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
      if (i >= MAX_FORMATIONS) return;
      const e = byId.get(p.entityId);
      if (!e) return;
      const pose = poseById.get(e.id);
      const state = pose.sequence;
      const links = effectiveLinks(e);
      const linkSig = (link, index) => {
        const layers = link.layers ?? e.layers;
        const shape = layers?.length ? layers.map((l) => `${l.id}:${l.z}:${l.scale ?? 1}:${this.shapeSignature(l.shape)}:${this.customCandidates.get(e.id + ":" + l.id)?.length ?? 0}`).join(",") : this.shapeSignature(link.shape);
        return `${layers?.length ? "layers" : link.id}:${shape}:${link.state?.extent?.normalized ?? e.extent?.normalized ?? !!e.extent}:${layers?.length ? "" : (this.customCandidates.get(e.id + ":" + link.id)?.length ?? 0) + ":" + customSource(index)}`;
      };
      const customSource = (index) => index === 0 ? this.customCandidates.get(e.id)?.length ?? 0 : 0;
      const sig = linkSig(links[state.linkIndex], state.linkIndex) + ">" + linkSig(links[state.nextIndex], state.nextIndex);
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
      u.normalized[i] = pose.extent?.normalized ? 1 : 0;
      u.transforms[i].set(Math.max(1e-3, pose.scale) * (pose.extent ? pose.extent.width / 400 : 1), Math.max(1e-3, pose.scale) * (pose.extent ? pose.extent.height / 400 : 1), pose.extent?.rotation ?? 0);
      u.tints[i].set(pose.tint);
      u.tintWeights[i] = Math.max(0, Math.min(1, pose.tintWeight * comp.entityTintWeight));
      const cSlot = this.collisionSlot(e.id);
      const tOff = i * 4;
      if (cSlot >= 0) {
        this.collisionTiles[tOff] = 0;
        this.collisionTiles[tOff + 1] = cSlot * SDF_TILE_V;
        this.collisionTiles[tOff + 2] = SDF_TILE_U;
        this.collisionTiles[tOff + 3] = 1;
      } else {
        this.collisionTiles[tOff + 3] = 0;
      }
      frames.push({ entityId: e.id, index: i, state });
    });
    for (let i = u.count; i < MAX_FORMATIONS; i++) {
      u.bounds[i] = this.particleCount;
      u.tintWeights[i] = 0;
      u.morph[i] = 0;
      this.collisionTiles[i * 4 + 3] = 0;
    }
    this.connections.update(poses, this.dataA, this.dataB, this.noiseData);
    if (this.connections.enabled) {
      this.textureA.needsUpdate = true;
      this.textureB.needsUpdate = true;
      this.noiseTexture.needsUpdate = true;
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
      if (i >= MAX_FORMATIONS) return;
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
  /** Mean depth of the formation centres — the field's 3D reference plane. */
  fieldCentreZ() {
    const n = this.uniforms.count;
    if (n === 0) return 0;
    let z = 0;
    for (let i = 0; i < n; i++) z += this.uniforms.centers[i].z;
    return z / n;
  }
}
export {
  EntityRuntime
};
