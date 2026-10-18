// Occurrences as soft glowing presences: one instanced draw for the points and
// one instanced pass into an equirect density texture that the earth samples.
import * as THREE from 'three';
import type { Model } from '../data/model';
import { pickablePresence, type TimeWindow } from '../data/time';
import { PRESENCE_FRAG, PRESENCE_VERT, SPLAT_FRAG, SPLAT_VERT } from './shaders';
import type { Shared } from './shared';
import { fnv1a } from '../../provider/suiteReading';

const PREC: Record<string, number> = { place: 0, region: 1, culture: 2, none: 3 };
/** [T-ATLAS-SEAM] spare slots past the count, so a host that adds an occurrence at the tail does not regrow the buffers */
const HEADROOM = 16;

export class Presences {
  readonly mesh: THREE.Mesh;
  readonly densityTarget: THREE.WebGLRenderTarget;
  readonly densityScene = new THREE.Scene();
  readonly densityCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  /** per-slot level, eased toward relTarget; index-aligned with the model, held at capacity (>= the count) */
  rel: Float32Array;
  private relTarget: Float32Array;
  private relAttr: THREE.InstancedBufferAttribute;
  private n: number;
  /** [T-ATLAS-SEAM] the slots the buffers hold */
  private capacity: number;
  private geo: THREE.InstancedBufferGeometry;
  private sgeo: THREE.InstancedBufferGeometry;
  private buf: { dir: Float32Array; ll: Float32Array; col: Float32Array; glow: Float32Array; meta: Float32Array; locus: Float32Array };
  private focusCore = { value: new THREE.Vector3(1, 1, 1) };
  private focusMix = { value: 0 };
  private focusMixTarget = 0;
  private sizeK = { value: 1 };
  private relAnimating = false;
  densityDirty = true;
  private lastSig = '';
  private camDirTmp = new THREE.Vector3();

  constructor(private model: Model, private shared: Shared, private renderer: THREE.WebGLRenderer) {
    const n = (this.n = model.occ.length);
    this.capacity = n + HEADROOM;
    this.rel = new Float32Array(this.capacity).fill(1);
    this.relTarget = new Float32Array(this.capacity).fill(1);
    this.buf = {
      dir: new Float32Array(this.capacity * 3),
      ll: new Float32Array(this.capacity * 2),
      col: new Float32Array(this.capacity * 3),
      glow: new Float32Array(this.capacity * 3),
      meta: new Float32Array(this.capacity * 4),
      locus: new Float32Array(this.capacity),
    };
    for (let i = 0; i < n; i++) this.writeSlot(i);
    const { dir, ll, col, glow, meta, locus } = this.buf;
    const aDir = new THREE.InstancedBufferAttribute(dir, 3);
    const aLL = new THREE.InstancedBufferAttribute(ll, 2);
    const aColor = new THREE.InstancedBufferAttribute(col, 3);
    const aGlow = new THREE.InstancedBufferAttribute(glow, 3);
    const aMeta = new THREE.InstancedBufferAttribute(meta, 4);
    const aLocus = new THREE.InstancedBufferAttribute(locus, 1);
    this.relAttr = new THREE.InstancedBufferAttribute(this.rel, 1);
    this.relAttr.setUsage(THREE.DynamicDrawUsage);

    const quad = (g: THREE.InstancedBufferGeometry) => {
      g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.instanceCount = n;
    };

    // ── presence points
    const geo = (this.geo = new THREE.InstancedBufferGeometry());
    quad(geo);
    geo.setAttribute('aDir', aDir);
    geo.setAttribute('aColor', aColor);
    geo.setAttribute('aMeta', aMeta);
    geo.setAttribute('aLocus', aLocus);
    geo.setAttribute('aRel', this.relAttr);
    const mat = new THREE.ShaderMaterial({
      vertexShader: PRESENCE_VERT,
      fragmentShader: PRESENCE_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      // screen blend: overlaps keep their hue and can never exceed white
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcColorFactor,
      uniforms: {
        uCursor: shared.cursor, uTrail: shared.trail, uRamp: shared.ramp, uTimeOn: shared.timeOn,
        uCamDir: shared.camDir, uCamDist: shared.camDist, uRes: shared.res, uPx: shared.px, uTime: shared.time,
        uSizeK: this.sizeK, uFocusCore: this.focusCore, uFocusMix: this.focusMix, uCalm: { value: prefersCalm() ? 1 : 0 },
      },
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;

    // ── density splats (three copies across the dateline)
    const sgeo = (this.sgeo = new THREE.InstancedBufferGeometry());
    quad(sgeo);
    sgeo.setAttribute('aLL', aLL);
    sgeo.setAttribute('aGlow', aGlow);
    sgeo.setAttribute('aMeta', aMeta);
    sgeo.setAttribute('aRel', this.relAttr);
    for (const off of [0, -2, 2]) {
      const sm = new THREE.ShaderMaterial({
        vertexShader: SPLAT_VERT,
        fragmentShader: SPLAT_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uCursor: shared.cursor, uTrail: shared.trail, uRamp: shared.ramp, uTimeOn: shared.timeOn,
          uOffset: { value: off },
        },
      });
      const m = new THREE.Mesh(sgeo, sm);
      m.frustumCulled = false;
      this.densityScene.add(m);
    }
    this.densityTarget = new THREE.WebGLRenderTarget(1024, 512, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
    });
  }

  /** The per-slot values of one occurrence: the constructor's writer, and the writer of a host replacement (sync). */
  private writeSlot(i: number): void {
    const m = this.model;
    const o = m.occ[i];
    const { dir, ll, col, glow, meta, locus } = this.buf;
    dir.set(m.dir[i], i * 3);
    ll[i * 2] = (o.lon * Math.PI) / 180;
    ll[i * 2 + 1] = (o.lat * Math.PI) / 180;
    col.set(m.colour[i], i * 3);
    glow.set(m.famPalette.get(o.familyId)?.glow ?? m.colour[i], i * 3);
    const prec = m.located[i] ? PREC[o.geoPrecision] ?? 0 : 3;
    // The presence's own look is keyed by its subject (the native identity, absent ⇒ its id), never by its slot: a reorder of the
    // field never changes how a presence looks (T-WORLDS §5 identity; fnv1a is the suite reading's own, suiteReading.ts).
    const seed = seedOf(o.subject_ref ?? o.id);
    meta[i * 4] = m.u[i];
    meta[i * 4 + 1] = 5.4 + seed * 1.8;
    meta[i * 4 + 2] = prec;
    meta[i * 4 + 3] = seed;
    // a mythic locus looks mythic in every view (manual §17.2 rules): aMeta is full, so its standing rides its own attribute
    locus[i] = o.locusType === 'myth-episode' ? 1 : 0;
  }

  /**
   * [T-ATLAS-SEAM] Brings the buffers to the model's count and rewrites one slot: an occurrence the host replaced in place
   * (data/occurrenceSeam.ts has already changed the model). No other slot is written. A count past the capacity regrows the
   * buffers and copies the values held; a count that falls only ends the draw. A new slot starts at full level; a replaced
   * slot keeps its level. The caller follows with setTargets, which sets the emphasis for the new count.
   */
  sync(slot: number | null): void {
    const before = this.n;
    const n = this.model.occ.length;
    if (n > this.capacity) this.regrow(n + HEADROOM);
    this.n = n;
    this.geo.instanceCount = n;
    this.sgeo.instanceCount = n;
    if (slot !== null && slot >= 0 && slot < n) {
      if (slot >= before) {
        this.rel[slot] = 1;
        this.relTarget[slot] = 1;
      }
      this.writeSlot(slot);
    }
    for (const g of [this.geo, this.sgeo]) {
      for (const name of ['aDir', 'aLL', 'aColor', 'aGlow', 'aMeta', 'aLocus', 'aRel']) {
        const attr = g.getAttribute(name) as THREE.InstancedBufferAttribute | undefined;
        if (attr) attr.needsUpdate = true;
      }
    }
    this.densityDirty = true;
  }

  /** [T-ATLAS-SEAM] Larger buffers for a larger count: the held values are copied, the new slots take the rest state. */
  private regrow(capacity: number): void {
    const used = this.capacity;
    const fit = (src: Float32Array, size: number, fill: number) => {
      const out = new Float32Array(capacity * size).fill(fill);
      out.set(src.subarray(0, used * size));
      return out;
    };
    const b = this.buf;
    this.buf = { dir: fit(b.dir, 3, 0), ll: fit(b.ll, 2, 0), col: fit(b.col, 3, 0), glow: fit(b.glow, 3, 0), meta: fit(b.meta, 4, 0), locus: fit(b.locus, 1, 0) };
    this.rel = fit(this.rel, 1, 1);
    this.relTarget = fit(this.relTarget, 1, 1);
    this.capacity = capacity;
    this.relAttr = new THREE.InstancedBufferAttribute(this.rel, 1);
    this.relAttr.setUsage(THREE.DynamicDrawUsage);
    const { dir, ll, col, glow, meta, locus } = this.buf;
    this.geo.setAttribute('aDir', new THREE.InstancedBufferAttribute(dir, 3));
    this.geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
    this.geo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(meta, 4));
    this.geo.setAttribute('aLocus', new THREE.InstancedBufferAttribute(locus, 1));
    this.geo.setAttribute('aRel', this.relAttr);
    this.sgeo.setAttribute('aLL', new THREE.InstancedBufferAttribute(ll, 2));
    this.sgeo.setAttribute('aGlow', new THREE.InstancedBufferAttribute(glow, 3));
    this.sgeo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(meta, 4));
    this.sgeo.setAttribute('aRel', this.relAttr);
  }

  /** Targets are rel values (see REL_GLSL); they ease in over ~1.2s. */
  setTargets(t: Float32Array | null) {
    if (t) this.relTarget.set(t);
    else this.relTarget.fill(1);
    this.relAnimating = true;
  }

  setFocusTint(core: [number, number, number], on: boolean) {
    this.focusCore.value.set(core[0], core[1], core[2]);
    this.focusMixTarget = on ? 1 : 0;
  }

  setSizeFor(dist: number, surface = 1) {
    // regional zoom lets the presences breathe a little larger; the sky stages shrink them away with the globe
    this.sizeK.value = (1 + Math.max(0, 2.4 - dist) * 0.12) * surface;
  }

  step(dt: number) {
    const fm = this.focusMix.value;
    if (Math.abs(fm - this.focusMixTarget) > 0.001) {
      this.focusMix.value = fm + (this.focusMixTarget - fm) * (1 - Math.exp(-dt * 2.6));
    }
    if (this.relAnimating) {
      const k = 1 - Math.exp(-dt * 3.4);
      let moving = false;
      for (let i = 0; i < this.n; i++) {
        const d = this.relTarget[i] - this.rel[i];
        if (d > 0.002 || d < -0.002) {
          this.rel[i] += d * k;
          moving = true;
        } else this.rel[i] = this.relTarget[i];
      }
      this.relAttr.needsUpdate = true;
      this.relAnimating = moving;
      this.densityDirty = true;
    }
  }

  /** Re-render the density texture when time or emphasis changed. */
  renderDensity() {
    const s = this.shared;
    const sig = `${s.cursor.value.toFixed(4)}|${s.trail.value.toFixed(3)}|${s.timeOn.value.toFixed(3)}`;
    if (sig !== this.lastSig) {
      this.lastSig = sig;
      this.densityDirty = true;
    }
    if (!this.densityDirty) return;
    this.densityDirty = false;
    const r = this.renderer;
    const prev = r.getRenderTarget();
    const prevClear = new THREE.Color();
    r.getClearColor(prevClear);
    const prevAlpha = r.getClearAlpha();
    r.setRenderTarget(this.densityTarget);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.densityScene, this.densityCam);
    r.setRenderTarget(prev);
    r.setClearColor(prevClear, prevAlpha);
  }

  get window(): TimeWindow {
    const s = this.shared;
    return { on: s.timeOn.value, cursorU: s.cursor.value, trail: s.trail.value, ramp: s.ramp.value };
  }

  /**
   * Nearest visible presence to a screen point (CSS px), or -1.
   * CPU-side so the field can hold thousands of points without picking buffers.
   */
  pick(sx: number, sy: number, camera: THREE.PerspectiveCamera, width: number, height: number, radius: number): number {
    const m = this.model;
    const w = this.window;
    const cam = camera.position;
    const camLen = cam.length();
    this.camDirTmp.copy(cam).divideScalar(camLen);
    const horizon = 1 / camLen + 0.04;
    const e = camera.projectionMatrix.elements;
    const v = camera.matrixWorldInverse.elements;
    let best = -1;
    let bestD = radius * radius;
    for (let i = 0; i < this.n; i++) {
      if (!m.located[i]) continue;
      const d = m.dir[i];
      if (d[0] * this.camDirTmp.x + d[1] * this.camDirTmp.y + d[2] * this.camDirTmp.z < horizon) continue;
      // everything the shader draws is selectable: the receded field stays reachable
      if (this.rel[i] < 0.035) continue; // filtered out (and so culled by the shader): never picked
      // the pick gate is the draw's gate (T1/T2): pickable where the shader draws the node at least half present
      if (!pickablePresence(m.u[i], w, this.rel[i])) continue;
      // view space
      const x = v[0] * d[0] + v[4] * d[1] + v[8] * d[2] + v[12];
      const y = v[1] * d[0] + v[5] * d[1] + v[9] * d[2] + v[13];
      const z = v[2] * d[0] + v[6] * d[1] + v[10] * d[2] + v[14];
      const cx = e[0] * x + e[8] * z;
      const cy = e[5] * y + e[9] * z;
      const cw = -z;
      if (cw <= 0) continue;
      const px = (cx / cw * 0.5 + 0.5) * width;
      const py = (1 - (cy / cw * 0.5 + 0.5)) * height;
      const dx = px - sx;
      const dy = py - sy;
      const prec = m.occ[i].geoPrecision;
      const reach = prec === 'culture' ? 1.9 : prec === 'region' ? 1.35 : 1;
      const dd = (dx * dx + dy * dy) / (reach * reach);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    }
    return best;
  }
}

/** Reduced motion (the same query main.ts hands the engine): the emergence ring and flare are off, the fades stay. */
function prefersCalm(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A presence's seed, 0–1, from its subject's identity: FNV-1a of the ref, then the avalanche the slot hash used. */
export function seedOf(ref: string): number {
  let x = fnv1a(ref);
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519);
  x ^= x >>> 13;
  return ((x >>> 0) % 10000) / 10000;
}
