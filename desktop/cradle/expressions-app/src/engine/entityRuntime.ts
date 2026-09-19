/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * EntityRuntime — the engine-side owner of the field's formations.
 *
 *  - Every enabled formation owns a contiguous PARTITION of the particle texture (share-weighted).
 *  - Each partition's A/B targets are baked in LOCAL coordinates (centred on the origin); the entity's
 *    world centre is a per-frame uniform, so moving an entity never re-bakes and never reseeds.
 *  - Sequence position (which link, progress) is resolved statelessly from the engine clock via
 *    fieldModel.resolveSequence; a partition is re-baked only when its current/next link changes.
 *  - Positions/velocities are never touched here except `buildSeed()` for an explicit reset.
 */

import * as THREE from 'three';
import { GlyphSampler } from './GlyphSampler';
import {
  SDF_ATLAS_WIDTH,
  SDF_ATLAS_HEIGHT,
  SDF_TILE_U,
  SDF_TILE_V,
  allocateEntitySlot,
  buildSdfTile,
  writeSdfTile,
} from './sdfField';
import {
  Entity,
  EntityLayer,
  Shape,
  Composition,
  Partition,
  SequenceLink,
  SequenceState,
  layoutPartitions,
  resolveSequence,
  effectiveLinks,
  MAX_FORMATIONS,
} from './fieldModel';
import { SpatialChakraNode, type GlyphVolumeConfig } from './types';
import { resolveEntityPose, type EvaluatedEntityPose } from './entityPose';
import { drawVolumeZ, mulberry32, buildDepthFieldsFromMask, cellVolumeShape, DEFAULT_GLYPH_VOLUME } from './glyphVolume';

/** World px per canvas px at entity.scale = 1 (a glyph fills ≈ 400 px) */
const BASE_SCALE = 0.56;

interface Candidate {
  x: number;
  y: number;
  z?: number;
  density: number;
  /** Half-thickness of the glyph body at this cell, in stage units (volume law). */
  hz?: number;
  /** 0..1 flank weight: 1 at the letterform contour, 0 well inside it. */
  cw?: number;
}

export interface EntityFrame {
  entityId: string;
  index: number;
  state: SequenceState;
}

export interface EntityUniformSet {
  count: number;
  bounds: Float32Array; // 10 — exclusive end particle index
  centers: THREE.Vector4[]; // 10 — xyz centre, w force radius
  morph: Float32Array; // 10
  transforms: THREE.Vector3[]; // x/y scale and rotation radians
  depthScales: Float32Array;
  normalized: Float32Array;
  tints: THREE.Color[]; // 10
  tintWeights: Float32Array; // 10
}

export class EntityRuntime {
  private sampler: GlyphSampler;
  public bakeGeneration = 0;
  private currentPlane: Composition['plane'] = 'vertical';
  private texW = 0;
  private texH = 0;
  private particleCount = 0;
  private dataA: Float32Array = new Float32Array(0);
  private dataB: Float32Array = new Float32Array(0);
  private noiseData: Float32Array = new Float32Array(0);
  public noiseTexture: THREE.DataTexture | null = null;
  public textureA: THREE.DataTexture | null = null;
  public textureB: THREE.DataTexture | null = null;

  private partitions: Partition[] = [];
  private layoutSig = '';
  private bakeSig = new Map<string, string>();
  private lastStep = new Map<string, number>();
  private customCandidates = new Map<string, Candidate[]>();
  private candidateCache = new Map<string, Candidate[]>();
  private baseSig = '';
  private templateGeometry: 'square'|'circular'|'volumetric3D' = 'square';
  private templateDimension: '2D'|'3D' = '2D';
  /** Active true-3D letterform law; mirrored onto the sampler that builds pools. */
  private volume: GlyphVolumeConfig = DEFAULT_GLYPH_VOLUME;

  // Glyph SDF atlas: 2 columns (state A|B) x 10 rows (stable entity slots), RGBA float.
  // Uploaded alongside the targets at bake time; never rewritten during steady-state frames.
  public collisionTexture: THREE.DataTexture | null = null;
  /** Per-partition tile rect (uv origin x/y, tile width u, enabled) pushed to the simulator. */
  public readonly collisionTiles = new Float32Array(40);
  private collisionData = new Float32Array(0);
  private collisionSlots = new Map<string, number>();

  public readonly uniforms: EntityUniformSet = {
    count: 0,
    bounds: new Float32Array(10),
    centers: Array.from({ length: 10 }, () => new THREE.Vector4(0, 0, 0, 200)),
    morph: new Float32Array(10),
    transforms: Array.from({ length: 10 }, () => new THREE.Vector3(1, 1, 0)),
    depthScales: new Float32Array(10).fill(1),
    normalized: new Float32Array(10),
    tints: Array.from({ length: 10 }, () => new THREE.Color('#ffffff')),
    tintWeights: new Float32Array(10),
  };

  constructor(sampler: GlyphSampler) {
    this.sampler = sampler;
  }

  // ------------------------------------------------------------------ allocation
  public allocate(particleCount: number, texW: number, texH: number) {
    this.disposeTextures();
    this.texW = texW;
    this.texH = texH;
    this.particleCount = particleCount;
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
    this.layoutSig = '';
    this.bakeSig.clear();
    this.lastStep.clear();
  }

  private disposeTextures() {
    this.textureA?.dispose();
    this.textureB?.dispose();
    this.noiseTexture?.dispose();this.noiseTexture=null;
    this.collisionTexture?.dispose();this.collisionTexture=null;
    this.textureA = null;
    this.textureB = null;
  }

  public dispose() {
    this.disposeTextures();
    this.candidateCache.clear();
  }

  public getPartitions(): Partition[] {
    return this.partitions;
  }

  /** Base bake context (style/font/plane). Changing it invalidates every partition. */
  public setBaseContext(style: string, fontFamily: string | undefined, fontWeight: string | number | undefined, plane: Composition['plane'], template?: {plateGeometry?:'square'|'circular'|'volumetric3D';dimension?:'2D'|'3D'}) {
    this.templateGeometry=template?.plateGeometry??'square';this.templateDimension=template?.dimension??'2D';
    const sig = `${style}|${fontFamily ?? ''}|${fontWeight ?? ''}|${plane}|${this.templateGeometry}|${this.templateDimension}`;
    if (sig !== this.baseSig) {
      this.baseSig = sig;
      this.candidateCache.clear();
      this.bakeSig.clear();
    }
  }

  /**
   * True 3D letterform bodies. Thickness is baked into the candidate pool, so a
   * change to the law has to invalidate both the pool and every partition built
   * from it — otherwise a slider in the studio would move nothing. Returns true
   * when the law actually changed.
   */
  public setVolume(config: GlyphVolumeConfig | undefined): boolean {
    const next = config ?? DEFAULT_GLYPH_VOLUME;
    const changed = this.sampler.setVolume(next);
    this.volume = next;
    if (changed) {
      this.candidateCache.clear();
      this.bakeSig.clear();
    }
    return changed;
  }

  public getVolume(): GlyphVolumeConfig {
    return this.volume;
  }

  /** Image / ASCII sources: override a formation's shape with an explicit candidate pool. */
  public setCustomCandidates(entityId: string, candidates: Candidate[] | null, linkId?:string) {
    const key=linkId?entityId+':'+linkId:entityId;
    if (candidates) this.customCandidates.set(key, candidates);
    else this.customCandidates.delete(key);
    this.bakeSig.delete(entityId);
  }

  // ------------------------------------------------------------------ shapes
  private shapeSignature(shape: Shape): string {
    return `${shape.kind}|${shape.text ?? ''}|${shape.yantraId ?? ''}|${shape.frequencyHz ?? ''}|${shape.primitive ?? ''}|${shape.plateGeometry ?? ''}|${shape.dimension ?? ''}`;
  }

  private candidatesFor(shape: Shape, fontFamily: string | undefined, fontWeight: string | number | undefined): Candidate[] {
    const sig = this.shapeSignature(shape);
    const cached = this.candidateCache.get(sig);
    if (cached) return cached;

    let out: Candidate[];
    const pseudo: SpatialChakraNode = {
      id: shape.yantraId || 'anahata',
      shape: shape.kind === 'glyph' ? 'glyph' : shape.kind === 'cymatic' ? 'cymatic' : 'yantra',
      glyphText: shape.text,
      name: '',
      sanskrit: '',
      seedSyllable: shape.text || 'ॐ',
      symbol: shape.text || '✦',
      frequencyHz: shape.frequencyHz ?? 396,
      x: 0,
      y: 0,
      scale: 1,
      color: '#ffffff',
      attractorStrength: 0,
      active: true,
    };
    if (shape.kind === 'primitive') {
      out = [];
      const kind = shape.primitive ?? 'disc';
      for (let j=0;j<192;j++) for(let i=0;i<192;i++) {
        const x=(i/191-.5)*400, y=(j/191-.5)*400;
        const r=Math.hypot(x,y);
        const inside=kind==='square' || kind==='disc'&&r<=200 || kind==='ring'&&r>=140&&r<=200 || kind==='triangle'&&y>=-200&&y<=200&&Math.abs(x)<=(200-y)/2;
        if (inside) out.push({x,y,density:1});
      }
      // True 3D body: primitives extrude by the same measured law as every
      // other planar pool — the mask they were generated from is the source.
      if (this.volume.enabled && this.volume.depth > 0 && out.length) {
        const G=192, mask=new Uint8Array(G*G);
        for (const c of out) {
          const gx=Math.round((c.x+200)/400*(G-1));
          const gy=Math.round((200-c.y)/400*(G-1));
          mask[gy*G+gx]=1;
        }
        const fields=buildDepthFieldsFromMask(mask,G,G);
        for (const c of out) {
          const gx=Math.max(0,Math.min(G-1,Math.round((c.x+200)/400*(G-1))));
          const gy=Math.max(0,Math.min(G-1,Math.round((200-c.y)/400*(G-1))));
          const s=cellVolumeShape(fields.distInside[gy*G+gx],fields.distToInk[gy*G+gx],fields.referenceThickness,c.density,this.volume);
          c.hz=s.half;c.cw=s.contourness;
        }
      }
    } else if (shape.kind === 'cymatic') {
      out = this.sampler.sampleCymaticTemplate({frequencyHz:shape.frequencyHz??396,plateGeometry:shape.plateGeometry??this.templateGeometry,dimension:shape.dimension??this.templateDimension}).candidates;
    } else {
      out = this.sampler.rasterizeSpatialNode(pseudo, shape.kind === 'glyph' ? 'symbol' : 'yantra', fontFamily, fontWeight, 'yantraA').candidates;
    }
    if (out.length === 0) out = [{ x: 0, y: 0, density: 1 }];
    this.candidateCache.set(sig, out);
    return out;
  }

  // ------------------------------------------------------------------ layout & baking
  /** Recompute partitions. Returns true when the layout changed (all partitions need baking). */
  public layout(entities: Entity[]): boolean {
    this.partitions = layoutPartitions(entities, this.particleCount);
    const sig = this.partitions.map((p) => `${p.entityId}:${p.start}-${p.end}`).join(',');
    if (sig === this.layoutSig) return false;
    this.layoutSig = sig;
    this.bakeSig.clear();
    // particles outside every partition (none normally) are parked at the origin
    return true;
  }

  private writeCandidates(
    target: Float32Array,
    start: number,
    end: number,
    cands: Candidate[],
    scale: number,
    plane: Composition['plane'],
    jitterPx: number,
    channel: 0 | 2,
    normalized: boolean,
    depthOffset: number = 0
  ) {
    const n = cands.length;
    if(!n){target.fill(0,start*4,end*4);for(let i=start;i<end;i++){this.noiseData[i*4+channel]=0;this.noiseData[i*4+channel+1]=0;}return;}
    // Depth is drawn per particle from the cell's own body thickness, so a single
    // pool spans the whole solid instead of one sheet per raster cell. The stream
    // is seeded per bake, so a re-bake reproduces the same body rather than
    // re-rolling it into visible flicker.
    const volume = this.volume;
    const volumeOn = volume.enabled && volume.depth > 0;
    const rand = volumeOn ? mulberry32(this.bakeGeneration * 2654435761 + (channel + 1) * 40503) : null;
    for (let i = start; i < end; i++) {
      // The raster pool is scanline ordered. A prefix would crop low-share
      // allocations to the top of a glyph. A low-discrepancy stride covers the
      // complete local shape for every allocation size without changing IDs.
      const c = normalized ? cands[Math.floor(((i-start)*0.6180339887498949 % 1)*n)] : cands[(i-start)%n];
      const jx = (Math.random() - 0.5) * jitterPx;
      const jy = (Math.random() - 0.5) * jitterPx;
      this.noiseData[i*4+channel]=jx;this.noiseData[i*4+channel+1]=jy;
      const lx = c.x * scale;
      const ly = c.y * scale;
      let lz = (c.z ?? 0) * scale;
      if (volumeOn && rand && c.hz !== undefined) {
        lz = drawVolumeZ(Math.max(0, c.hz) * scale, c.cw ?? 0, volume, rand).z;
      }
      // Layer depth (lamination) offsets the extrusion axis after the body law,
      // so a laminated layer carries both its own thickness and its band.
      lz += depthOffset;
      const o = i * 4;
      if (plane === 'horizontal') {
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
  private presetPool(e: Entity, cands: Candidate[]): Candidate[] {
    if (!e.extent || e.extent.normalized === false) return cands;
    const core = cands.filter(c=>c.density>.25);
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    for (const c of (core.length ? core : cands)) {x0=Math.min(x0,c.x);x1=Math.max(x1,c.x);y0=Math.min(y0,c.y);y1=Math.max(y1,c.y);}
    const sx=400/Math.max(1,x1-x0),sy=400/Math.max(1,y1-y0);
    return cands.map(c=>({...c,x:(c.x-(x0+x1)/2)*sx,y:(c.y-(y0+y1)/2)*sy}));
  }

  /** A link's candidate pool: per-link custom source, the entity-wide override on link 0, else the shape. */
  private linkCandidates(e: Entity, link: SequenceLink, linkIndex: number, custom: Candidate[] | undefined, fontFamily?: string, fontWeight?: string | number): Candidate[] {
    return this.customCandidates.get(e.id+':'+link.id)
      ?? (custom && linkIndex === 0 ? custom : this.candidatesFor(link.shape, fontFamily, fontWeight));
  }

  /** A layer's candidate pool: its loaded image/ASCII source, else its shape. */
  private layerCandidates(e: Entity, layer: EntityLayer, custom: Candidate[] | undefined, fontFamily?: string, fontWeight?: string | number): Candidate[] {
    return this.customCandidates.get(e.id+':'+layer.id)
      ?? this.candidatesFor(layer.shape, fontFamily, fontWeight);
  }

  private bakePartition(p: Partition, e: Entity, linkIndex: number, nextIndex: number, plane: Composition['plane'], fontFamily?: string, fontWeight?: string | number) {
    const links = effectiveLinks(e);
    if (e.layers?.length) {
      this.bakeLayers(p, e, plane, fontFamily, fontWeight);
      return;
    }
    const custom = this.customCandidates.get(e.id);
    const candA = this.linkCandidates(e, links[linkIndex], linkIndex, custom, fontFamily, fontWeight);
    const candB = this.linkCandidates(e, links[nextIndex], nextIndex, custom, fontFamily, fontWeight);
    this.bakeGeneration++;
    const scale = e.extent && e.extent.normalized !== false ? 1 : BASE_SCALE;
    const normalized = !!e.extent && e.extent.normalized !== false;
    const poolA = this.presetPool(e, candA);
    const poolB = this.presetPool(e, candB);
    this.writeCandidates(this.dataA, p.start, p.end, poolA, scale, plane, 2, 0, normalized);
    this.writeCandidates(this.dataB, p.start, p.end, poolB, scale, plane, 2, 2, normalized);
    if (this.noiseTexture) this.noiseTexture.needsUpdate = true;
    if (this.textureA) this.textureA.needsUpdate = true;
    if (this.textureB) this.textureB.needsUpdate = true;

    // Collision boundary: the SDF bakes from the same candidate pools the targets
    // were baked from, so the wall always matches the visual shape. The slot is
    // stable per entity id, so tiles never migrate between rows.
    if (this.collisionTexture) {
      const slot = this.collisionSlot(e.id);
      if (slot >= 0) {
        writeSdfTile(this.collisionData, slot, 0, buildSdfTile(poolA, scale));
        writeSdfTile(this.collisionData, slot, 1, buildSdfTile(poolB, scale));
        this.collisionTexture.needsUpdate = true;
      }
    }
  }

  /**
   * A laminated object: the entity's layers are its spatial composition, and
   * the formation's particle allocation is subdivided across them. Layer k
   * draws its shape — or its loaded image/ASCII pool, keyed per layer — in the
   * depth band its z occupies, with its own in-plane scale and measured body
   * thickness. Both channels bake the same union, so the whole layered body is
   * one static object that the sequence then transforms as a whole (placement,
   * size, rotation, tint, forces ride the ordinary uniforms).
   */
  private bakeLayers(p: Partition, e: Entity, plane: Composition['plane'], fontFamily?: string, fontWeight?: string | number) {
    const layers = e.layers!;
    const custom = this.customCandidates.get(e.id);
    const baseScale = e.extent && e.extent.normalized !== false ? 1 : BASE_SCALE;
    const normalized = !!e.extent && e.extent.normalized !== false;
    const K = Math.max(1, layers.length);
    const per = Math.floor((p.end - p.start) / K);
    // The union collision envelope reaches across the whole stack: from the
    // outermost layer edge to the opposite one.
    const reach = Math.max(...layers.map((l) => Math.abs(l.z)), 0);

    const union: Candidate[] = [];
    layers.forEach((layer: EntityLayer, k: number) => {
      const pool = this.presetPool(e, this.layerCandidates(e, layer, custom, fontFamily, fontWeight)).map((c) => {
        const ls = Math.max(0.001, layer.scale ?? 1);
        const scaled: Candidate = {...c, x: c.x * ls, y: c.y * ls};
        if (c.hz !== undefined) scaled.hz = c.hz * ls;
        return scaled;
      });
      const start = p.start + k * per;
      const end = k === K - 1 ? p.end : start + per;
      this.bakeGeneration++;
      this.writeCandidates(this.dataA, start, end, pool, baseScale, plane, 2, 0, normalized, layer.z);
      this.bakeGeneration++;
      this.writeCandidates(this.dataB, start, end, pool, baseScale, plane, 2, 2, normalized, layer.z);
      // Collision: one union section whose thickness envelope reaches across
      // the whole lamination, so the wall is the bounding solid of the stack.
      for (const c of pool) union.push({...c, hz: Math.max(c.hz ?? 0, reach)});
    });
    if (this.noiseTexture) this.noiseTexture.needsUpdate = true;
    if (this.textureA) this.textureA.needsUpdate = true;
    if (this.textureB) this.textureB.needsUpdate = true;
    if (this.collisionTexture) {
      const slot = this.collisionSlot(e.id);
      if (slot >= 0) {
          const tile = buildSdfTile(union, baseScale);
        writeSdfTile(this.collisionData, slot, 0, tile);
        writeSdfTile(this.collisionData, slot, 1, tile);
        this.collisionTexture.needsUpdate = true;
      }
    }
  }

  /** Stable atlas row per entity id; -1 when all 10 rows are taken. */
  private collisionSlot(entityId: string): number {
    let slot = this.collisionSlots.get(entityId);
    if (slot === undefined) {
      slot = allocateEntitySlot(this.collisionSlots.values());
      if (slot >= 0) this.collisionSlots.set(entityId, slot);
    }
    return slot;
  }

  /**
   * Per-frame update: resolves every formation's sequence, re-bakes partitions whose links changed,
   * and refreshes the uniform set. Returns the frames + impulses to fire (link changes).
   */
  public update(
    entities: Entity[],
    comp: Composition,
    simTime: number,
    drivePhase: number,
    manualMorph: number,
    holdRatio: number,
    fontFamily?: string,
    fontWeight?: string | number
  ): { frames: EntityFrame[]; poses: EvaluatedEntityPose[]; impulses: number[]; rebaked: boolean } {
    this.currentPlane = comp.plane;
    const byId = new Map(entities.map((e) => [e.id, e]));
    const frames: EntityFrame[] = [];
    const poses = entities.map((entity)=>resolveEntityPose(entity,simTime,drivePhase,manualMorph,holdRatio));
    const poseById = new Map(poses.map((pose)=>[pose.entityId,pose] as const));
    const impulses: number[] = [];
    let rebaked = false;
    const u = this.uniforms;
    u.count = Math.min(MAX_FORMATIONS, this.partitions.length);

    this.partitions.forEach((p, i) => {
      if (i >= 10) return;
      const e = byId.get(p.entityId);
      if (!e) return;
      const pose = poseById.get(e.id)!;
      const state = pose.sequence;
      const links = effectiveLinks(e);
      // A layered body bakes once from every layer, so its signature covers the
      // whole stack — layer order, shapes, depths, scales and which layers
      // carry custom sources — and the sequence clock never rebuilds it.
      const layersSig = e.layers?.length
        ? `layers|${e.layers.map((l) => `${l.id}:${l.z}:${l.scale ?? 1}:${this.shapeSignature(l.shape)}:${this.customCandidates.has(e.id + ':' + l.id) ? (this.customCandidates.get(e.id + ':' + l.id) as {length:number}).length : ''}`).join(',')}|${!!e.extent && e.extent.normalized !== false}`
        : '';
      const sig = layersSig || `${links[state.linkIndex].id}:${links[state.nextIndex].id}|${this.shapeSignature(links[state.linkIndex].shape)}>${this.shapeSignature(links[state.nextIndex].shape)}|${!!e.extent && e.extent.normalized !== false}|${this.customCandidates.has(e.id) ? `c:${state.linkIndex === 0}:${state.nextIndex === 0}` : ''}`;
      const prevStep = this.lastStep.get(e.id);
      if (this.bakeSig.get(e.id) !== sig) {
        this.bakePartition(p, e, state.linkIndex, state.nextIndex, comp.plane, fontFamily, fontWeight);
        this.bakeSig.set(e.id, sig);
        rebaked = true;
      }
      if (prevStep !== undefined && prevStep !== state.step && e.sequence.impulse > 0) impulses.push(e.sequence.impulse);
      this.lastStep.set(e.id, state.step);

      // Every subsystem consumes the same evaluated pose — centre, per-link object
      // state (scale/extent/tint) and forces. Moving never re-bakes.
      u.bounds[i] = p.end;
      u.centers[i].set(pose.x, pose.y, pose.z, Math.max(5, pose.forces.radius));
      u.morph[i] = state.progress;
      u.depthScales[i]=Math.max(.001,pose.scale);
      u.normalized[i]=e.extent&&e.extent.normalized!==false?1:0;
      u.transforms[i].set(Math.max(.001,pose.scale)*(pose.extent?pose.extent.width/400:1),Math.max(.001,pose.scale)*(pose.extent?pose.extent.height/400:1),pose.extent?.rotation??0);
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
    for (let i = u.count; i < 10; i++) {
      u.bounds[i] = this.particleCount;
      u.tintWeights[i] = 0;
      u.morph[i] = 0;
      this.collisionTiles[i * 4 + 3] = 0;
    }
    return { frames, poses, impulses, rebaked };
  }

  /** Explicit reset: particle seed = current blended targets translated to each entity's centre. */
  public buildSeed(): Float32Array {
    const seed = new Float32Array(this.dataA.length);
    seed.set(this.dataA);
    if (!this.partitions.length) {
      // A field without formations remains a medium, not a stack at the origin.
      // Used only on explicit reset / initial count allocation.
      const count=seed.length/4;
      for(let i=0;i<count;i++) {
        seed[i*4]=(((i+.5)*0.6180339887498949)%1-.5)*700;
        seed[i*4+1]=((i+.5)/count-.5)*700;
        seed[i*4+2]=0; seed[i*4+3]=.8;
      }
    }
    this.partitions.forEach((p, i) => {
      if (i >= 10) return;
      const c = this.uniforms.centers[i];
      for (let k = p.start; k < p.end; k++) {
        const tr=this.uniforms.transforms[i],blend=this.uniforms.morph[i];
        for(let channel=0;channel<4;channel++){const offset=k*4+channel;seed[offset]=this.dataA[offset]+(this.dataB[offset]-this.dataA[offset])*blend;}
        const horizontal=this.currentPlane==='horizontal';
        const jx=this.noiseData[k*4]+(this.noiseData[k*4+2]-this.noiseData[k*4])*blend,jy=this.noiseData[k*4+1]+(this.noiseData[k*4+3]-this.noiseData[k*4+1])*blend,normalized=this.uniforms.normalized[i]>.5;
        const x=(seed[k*4]+(normalized?jx:0))*tr.x, y=((horizontal?-seed[k*4+2]:seed[k*4+1])+(normalized?jy:0))*tr.y;
        const nx=normalized?0:jx,ny=normalized?0:jy;
        const co=Math.cos(tr.z),si=Math.sin(tr.z);
        seed[k*4]=x*co-y*si+nx+c.x;
        if(horizontal){seed[k*4+2]=-(x*si+y*co+ny)+c.z;seed[k*4+1]=seed[k*4+1]*this.uniforms.depthScales[i]+c.y;}
        else{seed[k*4+1]=x*si+y*co+ny+c.y;seed[k*4+2]=seed[k*4+2]*this.uniforms.depthScales[i]+c.z;}
      }
    });
    return seed;
  }

  /** Centroid of all formation centres (field-level vortex reference) */
  public fieldCentre(): THREE.Vector2 {
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
  public fieldCentreZ(): number {
    const n = this.uniforms.count;
    if (n === 0) return 0;
    let z = 0;
    for (let i = 0; i < n; i++) z += this.uniforms.centers[i].z;
    return z / n;
  }
}
