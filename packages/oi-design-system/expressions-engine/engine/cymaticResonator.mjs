/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { CANONICAL_CHAKRAS } from "./chakraSystem.mjs";
const RESONATOR_K = 8;
const RESONATOR_MODE_TOTAL = RESONATOR_K * RESONATOR_K;
const RESONATOR_STATION_COUNT = 7;
const DEFAULT_RESONATOR_PARAMS = {
  plateSize: 700,
  baseFrequency: 40,
  dampingQ: 8,
  driveStrength: 1,
  modeCount: RESONATOR_MODE_TOTAL,
  driveX: 0.11,
  driveY: 0.07
};
function modeShapeNormalized(m, n, u, v) {
  const s = (m + n) % 2 === 0 ? 1 : -1;
  const a = Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v);
  const b = Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v);
  return a + s * b;
}
class CymaticResonator {
  // Per-mode state, flat K*K arrays, i = (m-1)*K + (n-1), m,n in [1..K]
  re = new Float32Array(RESONATOR_MODE_TOTAL);
  im = new Float32Array(RESONATOR_MODE_TOTAL);
  modeM = new Int32Array(RESONATOR_MODE_TOTAL);
  modeN = new Int32Array(RESONATOR_MODE_TOTAL);
  modeFreq = new Float32Array(RESONATOR_MODE_TOTAL);
  modeCoupling = new Float32Array(RESONATOR_MODE_TOTAL);
  modeActive = new Uint8Array(RESONATOR_MODE_TOTAL);
  orderByCoupling = [];
  stations = [];
  params;
  lastTelemetry;
  constructor(params = {}) {
    this.params = { ...DEFAULT_RESONATOR_PARAMS, ...params };
    for (let m = 1; m <= RESONATOR_K; m++) {
      for (let n = 1; n <= RESONATOR_K; n++) {
        const i = (m - 1) * RESONATOR_K + (n - 1);
        this.modeM[i] = m;
        this.modeN[i] = n;
      }
    }
    this.recompute();
    this.lastTelemetry = {
      frequencyHz: this.params.baseFrequency,
      coherence: 0,
      totalEnergy: 0,
      dominantM: 1,
      dominantN: 1,
      dominantModeIndex: 0,
      nearestStationIndex: 0,
      nearestStationProximity: 0,
      isLocked: false
    };
  }
  /** Update plate/drive parameters. Envelope state (re/im) is preserved. */
  configure(next) {
    this.params = { ...this.params, ...next };
    this.recompute();
  }
  /** Recomputes eigenfrequencies, coupling coefficients, station picks and active-mode ranking. */
  recompute() {
    const { plateSize: L, baseFrequency: f0, driveX, driveY } = this.params;
    for (let i = 0; i < RESONATOR_MODE_TOTAL; i++) {
      const m = this.modeM[i];
      const n = this.modeN[i];
      this.modeFreq[i] = f0 * (m * m + n * n);
      this.modeCoupling[i] = modeShapeNormalized(m, n, driveX, driveY);
    }
    this.orderByCoupling = Array.from({ length: RESONATOR_MODE_TOTAL }, (_, i) => i).sort(
      (a, b) => Math.abs(this.modeCoupling[b]) - Math.abs(this.modeCoupling[a])
    );
    const activeCount = Math.max(1, Math.min(RESONATOR_MODE_TOTAL, Math.round(this.params.modeCount)));
    this.modeActive.fill(0);
    for (let k = 0; k < activeCount; k++) {
      this.modeActive[this.orderByCoupling[k]] = 1;
    }
    this.stations = this.selectStations(L);
    for (const st of this.stations) {
      this.modeActive[st.modeIndex] = 1;
    }
  }
  /**
   * Selects the seven chakral stations: the seven mutually-distinct, most strongly-coupled
   * eigenmodes of THIS instrument, ordered ascending by frequency across the band. Distinct
   * shape = distinct unordered {m,n} pair (on a free square plate, (m,n) and (n,m) are the
   * same nodal pattern up to an overall sign, so only one representative per pair is kept).
   */
  selectStations(_L) {
    const f0 = this.params.baseFrequency;
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
    return chosen.map((c, idx) => {
      const chakra = CANONICAL_CHAKRAS[CANONICAL_CHAKRAS.length - 1 - idx] ?? CANONICAL_CHAKRAS[0];
      return {
        index: idx,
        name: chakra.name,
        m: c.m,
        n: c.n,
        frequencyHz: c.f,
        color: chakra.color,
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
  getStations() {
    return this.stations;
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
  RESONATOR_MODE_TOTAL,
  RESONATOR_STATION_COUNT
};
