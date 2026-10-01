/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
const RESONATOR_K = 8;
const RESONATOR_MODE_TOTAL = RESONATOR_K * RESONATOR_K;
const RESONATOR_STATION_COUNT = 7;
const RESONATOR_K3 = 4;
function resonatorModeIndex3D(m, n, p) {
  return ((m - 1) * RESONATOR_K3 + (n - 1)) * RESONATOR_K3 + (p - 1);
}
const DEFAULT_RESONATOR_PARAMS = {
  plateSize: 700,
  baseFrequency: 40,
  dampingQ: 8,
  driveStrength: 1,
  modeCount: RESONATOR_MODE_TOTAL,
  driveX: 0.11,
  driveY: 0.07,
  driveZ: 0.05,
  dimension: "2D"
};
function modeShapeNormalized(m, n, u, v) {
  const s = (m + n) % 2 === 0 ? 1 : -1;
  const a = Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v);
  const b = Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v);
  return a + s * b;
}
function modeShape3DNormalized(m, n, p, u, v, w) {
  return Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v) * Math.cos(p * Math.PI * w);
}
class CymaticResonator {
  // Per-mode state, flat 64-slot arrays. 2D: i = (m-1)*K + (n-1), m,n in [1..K].
  // 3D: i = ((m-1)*4 + (n-1))*4 + (p-1), m,n,p in [1..4]. Same re/im arrays either way.
  re = new Float32Array(RESONATOR_MODE_TOTAL);
  im = new Float32Array(RESONATOR_MODE_TOTAL);
  modeM = new Int32Array(RESONATOR_MODE_TOTAL);
  modeN = new Int32Array(RESONATOR_MODE_TOTAL);
  modeP = new Int32Array(RESONATOR_MODE_TOTAL);
  modeFreq = new Float32Array(RESONATOR_MODE_TOTAL);
  modeCoupling = new Float32Array(RESONATOR_MODE_TOTAL);
  modeActive = new Uint8Array(RESONATOR_MODE_TOTAL);
  orderByCoupling = [];
  stations = [];
  params;
  lastTelemetry;
  constructor(params = {}) {
    this.params = { ...DEFAULT_RESONATOR_PARAMS, ...params };
    this.rebuildModeTable();
    this.recompute();
    this.lastTelemetry = {
      frequencyHz: this.params.baseFrequency,
      coherence: 0,
      totalEnergy: 0,
      dominantM: 1,
      dominantN: 1,
      dominantP: 1,
      dominantModeIndex: 0,
      nearestStationIndex: 0,
      nearestStationProximity: 0,
      isLocked: false
    };
  }
  /** Update plate/drive parameters. Envelope state (re/im) is preserved. */
  configure(next) {
    const dimensionChanged = (next.dimension ?? this.params.dimension) !== this.params.dimension;
    this.params = { ...this.params, ...next };
    if (dimensionChanged) this.rebuildModeTable();
    this.recompute();
  }
  /** Fills the (m,n[,p]) lattice for the active dimension into the flat 64-slot arrays. */
  rebuildModeTable() {
    if (this.params.dimension === "3D") {
      for (let m = 1; m <= RESONATOR_K3; m++) {
        for (let n = 1; n <= RESONATOR_K3; n++) {
          for (let p = 1; p <= RESONATOR_K3; p++) {
            const i = resonatorModeIndex3D(m, n, p);
            this.modeM[i] = m;
            this.modeN[i] = n;
            this.modeP[i] = p;
          }
        }
      }
    } else {
      for (let m = 1; m <= RESONATOR_K; m++) {
        for (let n = 1; n <= RESONATOR_K; n++) {
          const i = (m - 1) * RESONATOR_K + (n - 1);
          this.modeM[i] = m;
          this.modeN[i] = n;
          this.modeP[i] = 1;
        }
      }
    }
  }
  /** Recomputes eigenfrequencies, coupling coefficients, station picks and active-mode ranking. */
  recompute() {
    const { baseFrequency: f0, driveX, driveY } = this.params;
    if (this.params.dimension === "3D") {
      const driveZ = this.params.driveZ ?? DEFAULT_RESONATOR_PARAMS.driveZ;
      for (let i = 0; i < RESONATOR_MODE_TOTAL; i++) {
        const m = this.modeM[i];
        const n = this.modeN[i];
        const p = this.modeP[i];
        this.modeFreq[i] = f0 * Math.sqrt(m * m + n * n + p * p);
        this.modeCoupling[i] = modeShape3DNormalized(m, n, p, driveX, driveY, driveZ);
      }
    } else {
      for (let i = 0; i < RESONATOR_MODE_TOTAL; i++) {
        const m = this.modeM[i];
        const n = this.modeN[i];
        this.modeFreq[i] = f0 * (m * m + n * n);
        this.modeCoupling[i] = modeShapeNormalized(m, n, driveX, driveY);
      }
    }
    this.orderByCoupling = Array.from({ length: RESONATOR_MODE_TOTAL }, (_, i) => i).sort(
      (a, b) => Math.abs(this.modeCoupling[b]) - Math.abs(this.modeCoupling[a])
    );
    const activeCount = Math.max(1, Math.min(RESONATOR_MODE_TOTAL, Math.round(this.params.modeCount)));
    this.modeActive.fill(0);
    for (let k = 0; k < activeCount; k++) {
      this.modeActive[this.orderByCoupling[k]] = 1;
    }
    this.stations = this.selectStations();
    for (const st of this.stations) {
      this.modeActive[st.modeIndex] = 1;
    }
  }
  /**
   * Selects seven physical stability anchors: the mutually-distinct, most strongly-coupled
   * eigenmodes of THIS instrument, ordered ascending by frequency across the band. Distinct
   * shape = distinct unordered {m,n} pair in 2D (on a free square plate, (m,n) and (n,m) are
   * the same nodal pattern up to an overall sign) and distinct unordered {m,n,p} triple in 3D
   * (triple permutations are frequency-degenerate, axis-relabelled versions of one pattern).
   */
  selectStations() {
    const f0 = this.params.baseFrequency;
    if (this.params.dimension === "3D") return this.selectStations3D();
    const bandLow = f0 * 1.5;
    const bandHigh = f0 * 27.5;
    const seen = /* @__PURE__ */ new Set();
    const candidates = [];
    for (let i = 0; i < RESONATOR_MODE_TOTAL; i++) {
      const m = this.modeM[i];
      const n = this.modeN[i];
      const f = this.modeFreq[i];
      if (f < bandLow || f > bandHigh) continue;
      const key = m <= n ? `${m}_${n}` : `${n}_${m}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ modeIndex: i, m, n, f, absC: Math.abs(this.modeCoupling[i]) });
    }
    candidates.sort((a, b) => b.absC - a.absC);
    const chosen = candidates.slice(0, RESONATOR_STATION_COUNT);
    chosen.sort((a, b) => a.f - b.f);
    return chosen.map((c, idx) => ({
      id: `mode:${Math.min(c.m, c.n)}:${Math.max(c.m, c.n)}`,
      index: idx,
      m: c.m,
      n: c.n,
      frequencyHz: c.f,
      modeIndex: c.modeIndex
    }));
  }
  /**
   * 3D counterpart over the cavity spectrum f = f0*sqrt(m^2+n^2+p^2) in
   * [f0*sqrt(3), f0*sqrt(48)]; the band [f0*1.5, f0*7.5] covers all of it (sqrt(48)~6.93),
   * so the seven stations are drawn from the whole volume rather than clustering at one end.
   */
  selectStations3D() {
    const f0 = this.params.baseFrequency;
    const bandLow = f0 * 1.5;
    const bandHigh = f0 * 7.5;
    const seen = /* @__PURE__ */ new Set();
    const candidates = [];
    for (let i = 0; i < RESONATOR_MODE_TOTAL; i++) {
      const m = this.modeM[i];
      const n = this.modeN[i];
      const p = this.modeP[i];
      const f = this.modeFreq[i];
      if (f < bandLow || f > bandHigh) continue;
      const key = [m, n, p].sort((a, b) => a - b).join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ modeIndex: i, m, n, p, f, absC: Math.abs(this.modeCoupling[i]) });
    }
    candidates.sort((a, b) => b.absC - a.absC);
    const chosen = candidates.slice(0, RESONATOR_STATION_COUNT);
    chosen.sort((a, b) => a.f - b.f);
    return chosen.map((c, idx) => {
      const sorted = [c.m, c.n, c.p].sort((a, b) => a - b);
      return {
        id: `mode:${sorted[0]}:${sorted[1]}:${sorted[2]}`,
        index: idx,
        m: c.m,
        n: c.n,
        p: c.p,
        frequencyHz: c.f,
        modeIndex: c.modeIndex
      };
    });
  }
  /**
   * Integrates every active mode's envelope one frame forward under a continuous drive at
   * `frequencyHz`, and returns fresh telemetry. Nothing here resets particle-independent
   * state; re/im simply relax toward the new steady state at each mode's own time constant.
   */
  step(dt, frequencyHz) {
    const { dampingQ, driveStrength } = this.params;
    const zeta = 1 / (2 * Math.max(0.05, dampingQ));
    const clampedDt = Math.max(0, Math.min(0.1, dt));
    let totalEnergy = 0;
    let domEnergy = -1;
    let domIndex = 0;
    for (let i = 0; i < RESONATOR_MODE_TOTAL; i++) {
      if (!this.modeActive[i]) {
        const decay = Math.pow(0.98, clampedDt * 60);
        this.re[i] *= decay;
        this.im[i] *= decay;
        continue;
      }
      const fm = this.modeFreq[i];
      const c = this.modeCoupling[i];
      const r = frequencyHz / Math.max(1e-3, fm);
      const denomRe = 1 - r * r;
      const denomIm = 2 * zeta * r;
      const denomMagSq = Math.max(1e-6, denomRe * denomRe + denomIm * denomIm);
      const drive = driveStrength * c;
      const Hre = drive * denomRe / denomMagSq;
      const Him = -drive * denomIm / denomMagSq;
      const tau = Math.max(0.05, dampingQ / (Math.PI * Math.max(1e-3, fm)));
      const alpha = 1 - Math.exp(-clampedDt / tau);
      this.re[i] += alpha * (Hre - this.re[i]);
      this.im[i] += alpha * (Him - this.im[i]);
      const energy = this.re[i] * this.re[i] + this.im[i] * this.im[i];
      totalEnergy += energy;
      if (energy > domEnergy) {
        domEnergy = energy;
        domIndex = i;
      }
    }
    const coherence = totalEnergy > 1e-9 ? Math.max(0, Math.min(1, domEnergy / totalEnergy)) : 0;
    let nearestIdx = 0;
    let nearestRel = Infinity;
    for (let s = 0; s < this.stations.length; s++) {
      const rel = Math.abs(frequencyHz - this.stations[s].frequencyHz) / this.stations[s].frequencyHz;
      if (rel < nearestRel) {
        nearestRel = rel;
        nearestIdx = s;
      }
    }
    const lockBand = 0.04;
    const proximity = Math.max(0, Math.min(1, 1 - nearestRel / lockBand));
    this.lastTelemetry = {
      frequencyHz,
      coherence,
      totalEnergy,
      dominantM: this.modeM[domIndex],
      dominantN: this.modeN[domIndex],
      dominantP: this.modeP[domIndex],
      dominantModeIndex: domIndex,
      nearestStationIndex: nearestIdx,
      nearestStationProximity: proximity,
      isLocked: nearestRel <= lockBand
    };
    return this.lastTelemetry;
  }
  getTelemetry() {
    return this.lastTelemetry;
  }
  getAnchors() {
    return this.stations.map((anchor) => ({ ...anchor }));
  }
  /** @deprecated use getAnchors(); retained for compatibility with pre-semantic callers. */
  getStations() {
    return this.getAnchors();
  }
  getModalState() {
    return Array.from({ length: RESONATOR_MODE_TOTAL }, (_, modeIndex) => ({
      modeIndex,
      m: this.modeM[modeIndex],
      n: this.modeN[modeIndex],
      p: this.modeP[modeIndex],
      frequencyHz: this.modeFreq[modeIndex],
      coupling: this.modeCoupling[modeIndex],
      active: this.modeActive[modeIndex] === 1,
      re: this.re[modeIndex],
      im: this.im[modeIndex],
      energy: this.re[modeIndex] * this.re[modeIndex] + this.im[modeIndex] * this.im[modeIndex]
    }));
  }
  getState() {
    const modes = this.getModalState();
    const energyByIndex = new Map(modes.map((mode) => [mode.modeIndex, mode.energy]));
    return {
      frequencyHz: this.lastTelemetry.frequencyHz,
      totalEnergy: this.lastTelemetry.totalEnergy,
      coherence: this.lastTelemetry.coherence,
      modes,
      anchors: this.getAnchors().map((anchor) => ({ ...anchor, energy: energyByIndex.get(anchor.modeIndex) ?? 0 }))
    };
  }
  /**
   * Continuous, uninterrupted glide through all seven stations with per-station dwell.
   * `tSeconds` is a monotonically increasing accumulator (NOT reset between calls) so the
   * resonator drive frequency this produces is itself continuous — the caller feeds the
   * result straight into `step()`.
   */
  sweepFrequency(tSeconds, opts) {
    const stations = this.stations;
    if (stations.length === 0) return this.params.baseFrequency;
    const freqs = stations.map((s) => s.frequencyHz);
    let waypoints;
    if (opts.direction === "descent") {
      waypoints = [...freqs].reverse();
    } else if (opts.direction === "pingpong") {
      const fwd = freqs;
      const back = freqs.slice(1, -1).reverse();
      waypoints = [...fwd, ...back];
    } else {
      waypoints = freqs;
    }
    const dwell = Math.max(0, opts.dwellS);
    const glide = Math.max(0.01, opts.glideS);
    const segment = dwell + glide;
    const cycle = waypoints.length * segment;
    if (cycle <= 0) return waypoints[0];
    const tMod = (tSeconds % cycle + cycle) % cycle;
    const segIdx = Math.floor(tMod / segment);
    const segT = tMod - segIdx * segment;
    const from = waypoints[segIdx % waypoints.length];
    const to = waypoints[(segIdx + 1) % waypoints.length];
    if (segT <= dwell) {
      return from;
    }
    const u = Math.min(1, (segT - dwell) / glide);
    const smooth = u * u * (3 - 2 * u);
    return from + (to - from) * smooth;
  }
}
export {
  CymaticResonator,
  DEFAULT_RESONATOR_PARAMS,
  RESONATOR_K,
  RESONATOR_K3,
  RESONATOR_MODE_TOTAL,
  RESONATOR_STATION_COUNT,
  resonatorModeIndex3D
};
