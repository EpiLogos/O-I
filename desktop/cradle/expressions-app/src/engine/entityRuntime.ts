import {ConnectionRuntime} from "../../../../../packages/oi-design-system/expressions-engine/oi/connectionRuntime.mjs";
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
import {geometryCandidates,type FormationGeometryProjection} from './formationGeometryProjection';
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
import { drawVolumeZ, mulberry32, hashString, buildDepthFieldsFromMask, cellVolumeShape, DEFAULT_GLYPH_VOLUME } from './glyphVolume';

/** World px per canvas px at entity.scale = 1 (a glyph fills ≈ 400 px) */
const BASE_SCALE = 0.56;

// Animated frequency/text inputs can produce a new pool every frame. These
// pools are recomputable; keep recent ones within both count and memory bounds.
const CANDIDATE_CACHE_MAX_ENTRIES = 128;
const CANDIDATE_CACHE_MAX_BYTES = 32 * 1024 * 1024;
// Conservative retention estimate: six numeric fields, object/array slots and
// alignment. This is a cache budget, not a measurement of the JS heap.
const CANDIDATE_ESTIMATED_BYTES = 128;

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
  connectionStart: number;
  bounds: Float32Array; // MAX_FORMATIONS — exclusive end particle index
  centers: THREE.Vector4[]; // MAX_FORMATIONS — xyz centre, w force radius
  morph: Float32Array; // MAX_FORMATIONS
  transforms: THREE.Vector3[]; // x/y scale and rotation radians
  depthScales: Float32Array;
  normalized: Float32Array;
  tints: THREE.Color[]; // MAX_FORMATIONS
  tintWeights: Float32Array; // MAX_FORMATIONS
}

export class EntityRuntime {
  public readonly connections = new ConnectionRuntime();
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
  private geometryProjection: {key:string;entityId:string;candidates:Candidate[]}|null=null;
  private candidateCache = new Map<string, {candidates: Candidate[]; estimatedBytes: number}>();
  private candidateCacheBytes = 0;
  private candidateCacheHits = 0;
  private candidateCacheMisses = 0;
  private candidateCacheEvictions = 0;
  private candidateCacheOversized = 0;
  private baseSig = '';
  private templateGeometry: 'square'|'circular'|'volumetric3D' = 'square';
  private templateDimension: '2D'|'3D' = '2D';
  /** Active true-3D letterform law; mirrored onto the sampler that builds pools. */
  private volume: GlyphVolumeConfig = DEFAULT_GLYPH_VOLUME;

  // Glyph SDF atlas: 2 columns (state A|B) x MAX_FORMATIONS rows (stable entity slots), RGBA float.
  // Uploaded alongside the targets at bake time; never rewritten during steady-state frames.
  public collisionTexture: THREE.DataTexture | null = null;
  /** Per-partition tile rect (uv origin x/y, tile width u, enabled) pushed to the simulator. */
  public readonly collisionTiles = new Float32Array(MAX_FORMATIONS * 4);
  private collisionData = new Float32Array(0);
  private collisionSlots = new Map<string, number>();

  public readonly uniforms: EntityUniformSet = {
    count: 0,
    connectionStart: 0,
    bounds: new Float32Array(MAX_FORMATIONS),
    centers: Array.from({ length: MAX_FORMATIONS }, () => new THREE.Vector4(0, 0, 0, 200)),
    morph: new Float32Array(MAX_FORMATIONS),
    transforms: Array.from({ length: MAX_FORMATIONS }, () => new THREE.Vector3(1, 1, 0)),
    depthScales: new Float32Array(MAX_FORMATIONS).fill(1),
    normalized: new Float32Array(MAX_FORMATIONS),
    tints: Array.from({ length: MAX_FORMATIONS }, () => new THREE.Color('#ffffff')),
    tintWeights: new Float32Array(MAX_FORMATIONS),
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
    this.clearCandidateCache();
    this.geometryProjection=null;
  }

  private clearCandidateCache() {
    this.candidateCache.clear();
    this.candidateCacheBytes = 0;
  }

  /** Recomputable pools only; authored image/ASCII sources are retained separately. */
  public getCandidateCacheStats() {
    return {entries: this.candidateCache.size, estimatedBytes: this.candidateCacheBytes,
      maxEntries: CANDIDATE_CACHE_MAX_ENTRIES, maxEstimatedBytes: CANDIDATE_CACHE_MAX_BYTES,
      hits: this.candidateCacheHits, misses: this.candidateCacheMisses,
      evictions: this.candidateCacheEvictions, oversized: this.candidateCacheOversized};
  }

  private retainCandidates(sig: string, candidates: Candidate[]) {
    const estimatedBytes = candidates.length * CANDIDATE_ESTIMATED_BYTES + sig.length * 2 + 256;
    if (estimatedBytes > CANDIDATE_CACHE_MAX_BYTES) {
      this.candidateCacheOversized++;
      return;
    }
    while (this.candidateCache.size >= CANDIDATE_CACHE_MAX_ENTRIES ||
      this.candidateCacheBytes + estimatedBytes > CANDIDATE_CACHE_MAX_BYTES) {
      const oldest = this.candidateCache.keys().next().value;
      if (oldest === undefined) break;
      this.candidateCacheBytes -= this.candidateCache.get(oldest)!.estimatedBytes;
      this.candidateCache.delete(oldest);
      this.candidateCacheEvictions++;
    }
    this.candidateCache.set(sig, {candidates, estimatedBytes});
    this.candidateCacheBytes += estimatedBytes;
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
  public setVolume(config: GlyphVolumeConfig | undefined): boolean {
    const next = config ?? DEFAULT_GLYPH_VOLUME;
    const changed = this.sampler.setVolume(next);
    this.volume = next;
    if (changed) {
      this.clearCandidateCache();
      this.bakeSig.clear();
    }
    return changed;
  }

  public getVolume(): GlyphVolumeConfig {
    return this.volume;
  }

  /** Reversible source geometry; authored image/layer pools remain intact. */
  public setGeometryProjection(value:FormationGeometryProjection|null){
    const key=value?JSON.stringify(value):'';
    if(key===(this.geometryProjection?.key??''))return;
    const candidate=value?{key,entityId:value.entityId,candidates:geometryCandidates(value)}:null;
    if(this.geometryProjection)this.bakeSig.delete(this.geometryProjection.entityId);
    this.geometryProjection=candidate;
    if(candidate)this.bakeSig.delete(candidate.entityId);
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
    if (cached) {
      this.candidateCache.delete(sig);
      this.candidateCache.set(sig, cached);
      this.candidateCacheHits++;
      return cached.candidates;
    }
    this.candidateCacheMisses++;

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
      out = this.sampler.sampleCymaticTemplate({frequencyHz:shape.frequencyHz??396,plateGeometry:shape.plateGeometry??this.templateGeometry,dimension:shape.dimension??this.templateDimension,seed:hashString(sig)}).candidates;
    } else {
      out = this.sampler.rasterizeSpatialNode(pseudo, shape.kind === 'glyph' ? 'symbol' : 'yantra', fontFamily, fontWeight, 'yantraA',hashString(sig)).candidates;
    }
    if (out.length === 0) out = [{ x: 0, y: 0, density: 1 }];
    this.retainCandidates(sig, out);
    return out;
  }

  // ------------------------------------------------------------------ layout & baking
  /** Recompute partitions. Returns true when the layout changed (all partitions need baking). */
  public layout(entities: Entity[]): boolean {
    this.partitions = layoutPartitions(entities, this.connections.start);
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
    const rand = volumeOn ? mulberry32((start + 1) * 2654435761 + (channel + 1) * 40503 + n) : null;
    const jitter=mulberry32((start+1)*40503+(channel+1)*2654435761+n);
    for (let i = start; i < end; i++) {
      // The raster pool is scanline ordered. A prefix would crop low-share
      // allocations to the top of a glyph. A low-discrepancy stride covers the
      // complete local shape for every allocation size without changing IDs.
      const c = cands[Math.floor(((i-start)*0.6180339887498949 % 1)*n)];
      const jx = (jitter() - 0.5) * jitterPx;
      const jy = (jitter() - 0.5) * jitterPx;
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
  private presetPool(e: Entity, cands: Candidate[], sourcePool = false): Candidate[] {
    if (!e.extent || e.extent.normalized === false) return cands;
    const core = cands.filter(c=>c.density>.25);
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    for (const c of (core.length ? core : cands)) {x0=Math.min(x0,c.x);x1=Math.max(x1,c.x);y0=Math.min(y0,c.y);y1=Math.max(y1,c.y);}
    let sx=400/Math.max(1,x1-x0),sy=400/Math.max(1,y1-y0);
    // Image/ASCII sampling has already retained the source's aspect. Fit its
    // longest axis; independently expanding both axes would distort it.
    if(sourcePool)sx=sy=Math.min(sx,sy);
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
    const geometry=this.geometryProjection?.entityId===e.id?this.geometryProjection:null;
    if(geometry){
      this.bakeGeneration++;
      const scale=e.extent&&e.extent.normalized!==false?1:BASE_SCALE;
      // Preserve the owner's angles and aspect; never stretch the local
      // geometry to its own bounding box. Outer authored transforms still apply.
      for(const channel of [0,2] as const)this.writeCandidates(channel===0?this.dataA:this.dataB,p.start,p.end,geometry.candidates,scale,plane,0,channel);
      if(this.noiseTexture)this.noiseTexture.needsUpdate=true;
      if(this.textureA)this.textureA.needsUpdate=true;
      if(this.textureB)this.textureB.needsUpdate=true;
      if(this.collisionTexture){const slot=this.collisionSlot(e.id);if(slot>=0){for(const channel of [0,1] as const)writeSdfTile(this.collisionData,slot,channel,buildSdfTile(geometry.candidates,scale));this.collisionTexture.needsUpdate=true;}}
      return;
    }
    const links = effectiveLinks(e);
    const custom = this.customCandidates.get(e.id);
    const slot = this.collisionTexture ? this.collisionSlot(e.id) : -1;
    for (const [index, channel] of [[linkIndex, 0], [nextIndex, 2]] as const) {
      const link = links[index];
      const normalized = link.state?.extent?.normalized ?? e.extent?.normalized ?? !!e.extent;
      const body = {...e, extent: {...e.extent, width: e.extent?.width ?? 400, height: e.extent?.height ?? 400, rotation: e.extent?.rotation ?? 0, normalized}};
      const scale = normalized ? 1 : BASE_SCALE;
      const target = channel === 0 ? this.dataA : this.dataB;
      const layers = link.layers ?? e.layers;
      let union: Candidate[];
      if (layers?.length) {
        union = [];
        const per = Math.floor((p.end-p.start)/layers.length);
        const reach = Math.max(...layers.map(l=>Math.abs(l.z)),0);
        layers.forEach((layer,k)=>{
          const pool = this.presetPool(body,this.layerCandidates(e,layer,custom,fontFamily,fontWeight),this.customCandidates.has(e.id+':'+layer.id)).map(c=>{
            const ls=Math.max(.001,layer.scale??1);
            return {...c,x:c.x*ls,y:c.y*ls,...(c.hz===undefined?{}:{hz:c.hz*ls})};
          });
          const start=p.start+k*per,end=k===layers.length-1?p.end:start+per;
          this.writeCandidates(target,start,end,pool,scale,plane,2,channel,layer.z);
          union.push(...pool.map(c=>({...c,hz:Math.max(c.hz??0,reach)})));
        });
      } else {
        union=this.presetPool(body,this.linkCandidates(e,link,index,custom,fontFamily,fontWeight),this.customCandidates.has(e.id+':'+link.id)||!!(custom&&index===0));
        this.writeCandidates(target,p.start,p.end,union,scale,plane,2,channel);
      }
      this.bakeGeneration++;
      if(slot>=0)writeSdfTile(this.collisionData,slot,channel===0?0:1,buildSdfTile(union,scale));
    }
    if(this.noiseTexture)this.noiseTexture.needsUpdate=true;
    if(this.textureA)this.textureA.needsUpdate=true;
    if(this.textureB)this.textureB.needsUpdate=true;
    if(this.collisionTexture)this.collisionTexture.needsUpdate=true;
  }

  /** Stable atlas row per entity id; -1 when all formation rows are taken. */
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
      if (i >= MAX_FORMATIONS) return;
      const e = byId.get(p.entityId);
      if (!e) return;
      const pose = poseById.get(e.id)!;
      const state = pose.sequence;
      const links = effectiveLinks(e);
      const linkSig=(link:SequenceLink,index:number)=>{
        const layers=link.layers??e.layers;
        const shape=layers?.length?layers.map(l=>`${l.id}:${l.z}:${l.scale??1}:${this.shapeSignature(l.shape)}:${this.customCandidates.get(e.id+':'+l.id)?.length??0}`).join(','):this.shapeSignature(link.shape);
        return `${layers?.length?'layers':link.id}:${shape}:${link.state?.extent?.normalized??e.extent?.normalized??!!e.extent}:${layers?.length?'':(this.customCandidates.get(e.id+':'+link.id)?.length??0)+':'+customSource(index)}`;
      };
      const customSource=(index:number)=>index===0?this.customCandidates.get(e.id)?.length??0:0;
      const sig=linkSig(links[state.linkIndex],state.linkIndex)+'>'+linkSig(links[state.nextIndex],state.nextIndex);
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
      u.normalized[i]=pose.extent?.normalized?1:0;
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
    for (let i = u.count; i < MAX_FORMATIONS; i++) {
      u.bounds[i] = this.particleCount;
      u.tintWeights[i] = 0;
      u.morph[i] = 0;
      this.collisionTiles[i * 4 + 3] = 0;
    }
    this.connections.update(poses, this.dataA, this.dataB, this.noiseData);
    if (this.connections.enabled) {
      this.textureA!.needsUpdate = true; this.textureB!.needsUpdate = true; this.noiseTexture!.needsUpdate = true;
    }
    this.uniforms.connectionStart = this.connections.start;
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
      if (i >= MAX_FORMATIONS) return;
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
