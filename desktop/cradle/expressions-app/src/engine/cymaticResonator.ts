/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CymaticResonator — a single continuously-driven, damped modal resonator, evaluated on the
 * CPU in the ENVELOPE domain. Two mode sets share the same 64-slot state arrays and the same
 * per-mode oscillator math:
 *
 *   - '2D' (default): the classic square free Chladni plate, a K x K grid of mode shapes.
 *   - '3D': a volumetric standing-wave cavity (box resonator), a 4 x 4 x 4 mode lattice.
 *
 * Physical model
 * ---------------
 * The 2D plate supports a K x K grid of mode shapes (classic Chladni approximation for a
 * free square plate):
 *
 *   phi_mn(x, y) = cos(m*pi*x/L) * cos(n*pi*y/L) + s * cos(n*pi*x/L) * cos(m*pi*y/L)
 *   s = +1 if (m+n) even, -1 if (m+n) odd,  x, y in [-L/2, L/2]
 *
 * Kirchhoff-plate eigenfrequencies:  f_mn = f0 * (m^2 + n^2)
 *
 * The 3D cavity supports box standing waves with rigid walls:
 *
 *   phi_mnp(x, y, z) = cos(m*pi*x/L) * cos(n*pi*y/L) * cos(p*pi*z/L)
 *   m, n, p in [1..4], x/y/z in [-L/2, L/2], flat index i = ((m-1)*4 + (n-1))*4 + (p-1)
 *
 * Wave-equation eigenfrequencies:    f_mnp = f0 * sqrt(m^2 + n^2 + p^2)
 * (omega_mnp = c*pi*sqrt(m^2+n^2+p^2)/L; f0 absorbs c*pi/L, exactly as f0 absorbs the
 * plate-dispersion constant in 2D).
 *
 * A single point excitation at the drive point couples into every mode with coupling
 * coefficient c_mn = phi_mn(driveX, driveY) (3D: phi_mnp(driveX, driveY, driveZ)) —
 * symmetric modes couple strongest, which is genuine physics, not a picked shape.
 *
 * REAL-TIME APPROXIMATION (explicitly identified, per the brief): rather than integrating
 * the full wave equation at audio rates, each mode is treated as a damped driven harmonic
 * oscillator and we track its slowly-varying complex envelope A_mn(t) instead of the fast
 * carrier. The steady-state response to a drive frequency f is the standard second-order
 * transfer function
 *
 *   H_mn(f) = driveStrength * c_mn / ((1 - r^2) + i * 2*zeta*r),   r = f / f_mn
 *   zeta = 1 / (2*Q)
 *
 * and the envelope relaxes toward that target with the mode's own physical time constant
 * tau_mn = Q / (pi * f_mn) (clamped to stay visible in real time):
 *
 *   dA/dt = (H_mn(f(t)) - A_mn) / tau_mn
 *
 * Integrated per frame as an exponential blend (unconditionally stable for any dt):
 *
 *   alpha = 1 - exp(-dt / tau_mn);  A += alpha * (H - A)
 *
 * Because this is state (A_mn) that is carried frame to frame, sweeping the drive
 * frequency f(t) continuously detunes and re-tunes every mode's envelope live — nothing is
 * ever reset, reseeded, or swapped for a stored picture. The seven physical anchors below
 * are simply the seven most strongly-driven, mutually distinct eigenmodes of this one
 * instrument, picked by an explicit selection rule over the real mode spectrum. Semantic
 * systems may interpret these anchors; this physical model deliberately does not.
 */

export const RESONATOR_K = 8; // 2D mode grid side (K x K = 64 modes)
export const RESONATOR_MODE_TOTAL = RESONATOR_K * RESONATOR_K;
export const RESONATOR_STATION_COUNT = 7;
export const RESONATOR_K3 = 4; // 3D cavity modes per axis (4^3 = 64 modes, same slots)

/** Flat 3D slot for mode (m,n,p), m,n,p in [1..RESONATOR_K3]: i = ((m-1)*4 + (n-1))*4 + (p-1). */
export function resonatorModeIndex3D(m: number, n: number, p: number): number {
  return ((m - 1) * RESONATOR_K3 + (n - 1)) * RESONATOR_K3 + (p - 1);
}

export interface ResonanceAnchor {
  id: string;
  index: number;       // ascending physical frequency order
  m: number;
  n: number;
  p?: number;          // 3D cavity depth mode; undefined in 2D
  frequencyHz: number;
  modeIndex: number;   // flat index into the 64-mode arrays
}
/** @deprecated compatibility name; anchors no longer carry semantic identity. */
export type ResonatorStation = ResonanceAnchor;

export interface ModalState {
  modeIndex:number;
  m:number;
  n:number;
  p:number;            // 3D cavity depth mode (1 = no z structure, the 2D plate value)
  frequencyHz:number;
  coupling:number;
  active:boolean;
  re:number;
  im:number;
  energy:number;
}

export interface ResonanceState {
  frequencyHz:number;
  totalEnergy:number;
  coherence:number;
  modes:ModalState[];
  anchors:Array<ResonanceAnchor & {energy:number}>;
}

export interface ResonatorTelemetry {
  frequencyHz: number;
  coherence: number;         // energy share of the single dominant mode (0..1)
  totalEnergy: number;
  dominantM: number;
  dominantN: number;
  dominantP: number;               // 3D cavity depth mode of the dominant mode (1 in 2D)
  dominantModeIndex: number;
  nearestStationIndex: number;
  nearestStationProximity: number; // 1.0 = exactly on station, 0.0 = at lock-band edge or beyond
  isLocked: boolean;               // within +/-4% of a station's eigenfrequency
}

export interface ResonatorParams {
  plateSize: number;     // world px, side L of the square plate (default 700)
  baseFrequency: number; // f0 such that f_mn = f0 * (m^2 + n^2); default tuned for ~80-1100Hz band
  dampingQ: number;      // shared quality factor -> zeta = 1/(2Q), tau = Q/(pi*f_mn)
  driveStrength: number; // excitation amplitude at the drive point
  modeCount: number;     // how many of the 64 modes actively participate (<=64), ranked by coupling
  driveX: number;        // drive point, fraction of L from center (default 0.11)
  driveY: number;        // drive point, fraction of L from center (default 0.07)
  driveZ: number;        // drive point depth fraction, 3D cavity only (default 0.05)
  dimension: '2D' | '3D';// mode set: '2D' square plate (8x8) | '3D' volumetric cavity (4x4x4)
}

export const DEFAULT_RESONATOR_PARAMS: ResonatorParams = {
  plateSize: 700,
  baseFrequency: 40,
  dampingQ: 8,
  driveStrength: 1.0,
  modeCount: RESONATOR_MODE_TOTAL,
  driveX: 0.11,
  driveY: 0.07,
  driveZ: 0.05,
  dimension: '2D',
};

export type SweepDirection = 'ascent' | 'descent' | 'pingpong';

export interface SweepOptions {
  glideS: number;
  dwellS: number;
  direction: SweepDirection;
}

/** phi_mn(x, y) for the free-square-plate Chladni approximation, x/y already normalized by L. */
function modeShapeNormalized(m: number, n: number, u: number, v: number): number {
  const s = (m + n) % 2 === 0 ? 1 : -1;
  const a = Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v);
  const b = Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v);
  return a + s * b;
}

/** phi_mnp(x, y, z) for the standing-wave box cavity, x/y/z already normalized by L. */
function modeShape3DNormalized(m: number, n: number, p: number, u: number, v: number, w: number): number {
  return Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v) * Math.cos(p * Math.PI * w);
}

/**
 * One continuously-driven damped modal resonator. Call `configure()` when plate/drive
 * parameters change (cheap, O(64)); call `step(dt, frequencyHz)` once per simulation frame.
 * State (the complex envelopes) persists across both calls indefinitely — this is what lets
 * frequency sweeps, dwells, and detunes happen with no reset.
 */
export class CymaticResonator {
  // Per-mode state, flat 64-slot arrays. 2D: i = (m-1)*K + (n-1), m,n in [1..K].
  // 3D: i = ((m-1)*4 + (n-1))*4 + (p-1), m,n,p in [1..4]. Same re/im arrays either way.
  public re: Float32Array = new Float32Array(RESONATOR_MODE_TOTAL);
  public im: Float32Array = new Float32Array(RESONATOR_MODE_TOTAL);

  private modeM: Int32Array = new Int32Array(RESONATOR_MODE_TOTAL);
  private modeN: Int32Array = new Int32Array(RESONATOR_MODE_TOTAL);
  private modeP: Int32Array = new Int32Array(RESONATOR_MODE_TOTAL);
  private modeFreq: Float32Array = new Float32Array(RESONATOR_MODE_TOTAL);
  private modeCoupling: Float32Array = new Float32Array(RESONATOR_MODE_TOTAL);
  private modeActive: Uint8Array = new Uint8Array(RESONATOR_MODE_TOTAL);
  private orderByCoupling: number[] = [];

  public stations: ResonanceAnchor[] = [];
  public params: ResonatorParams;

  private lastTelemetry: ResonatorTelemetry;

  constructor(params: Partial<ResonatorParams> = {}) {
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
      isLocked: false,
    };
  }

  /** Update plate/drive parameters. Envelope state (re/im) is preserved. */
  public configure(next: Partial<ResonatorParams>) {
    const dimensionChanged = (next.dimension ?? this.params.dimension) !== this.params.dimension;
    this.params = { ...this.params, ...next };
    // The mode table itself depends on the dimension; frequencies/coupling always do.
    if (dimensionChanged) this.rebuildModeTable();
    this.recompute();
  }

  /** Fills the (m,n[,p]) lattice for the active dimension into the flat 64-slot arrays. */
  private rebuildModeTable() {
    if (this.params.dimension === '3D') {
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
          this.modeP[i] = 1; // the 2D plate is uniform along the (unused) depth axis
        }
      }
    }
  }

  /** Recomputes eigenfrequencies, coupling coefficients, station picks and active-mode ranking. */
  private recompute() {
    const { baseFrequency: f0, driveX, driveY } = this.params;
    if (this.params.dimension === '3D') {
      const driveZ = this.params.driveZ ?? DEFAULT_RESONATOR_PARAMS.driveZ;
      for (let i = 0; i < RESONATOR_MODE_TOTAL; i++) {
        const m = this.modeM[i];
        const n = this.modeN[i];
        const p = this.modeP[i];
        // Box standing wave: omega = c*pi*sqrt(m^2+n^2+p^2)/L -> f0 absorbs c*pi/L.
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

    // Rank all modes by |coupling| descending; the top `modeCount` remain active.
    this.orderByCoupling = Array.from({ length: RESONATOR_MODE_TOTAL }, (_, i) => i).sort(
      (a, b) => Math.abs(this.modeCoupling[b]) - Math.abs(this.modeCoupling[a])
    );
    const activeCount = Math.max(1, Math.min(RESONATOR_MODE_TOTAL, Math.round(this.params.modeCount)));
    this.modeActive.fill(0);
    for (let k = 0; k < activeCount; k++) {
      this.modeActive[this.orderByCoupling[k]] = 1;
    }

    this.stations = this.selectStations();
    // Guarantee the modes underlying the seven stations are always active, regardless of modeCount.
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
  private selectStations(): ResonanceAnchor[] {
    const f0 = this.params.baseFrequency;
    if (this.params.dimension === '3D') return this.selectStations3D();
    // The instrument's working band: f_11 = f0*2 (lowest mode) up to f0*27.5, which with the
    // default f0=40 reproduces the ~80-1100Hz band the physical model is tuned for. Restricting
    // candidates to this band (rather than the full 64-mode spectrum up to f0*128) is what makes
    // the seven stations sit ACROSS the band instead of clustering at its high end.
    const bandLow = f0 * 1.5;
    const bandHigh = f0 * 27.5;

    const seen = new Set<string>();
    const candidates: { modeIndex: number; m: number; n: number; f: number; absC: number }[] = [];
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
    // Best drive coupling first...
    candidates.sort((a, b) => b.absC - a.absC);
    const chosen = candidates.slice(0, RESONATOR_STATION_COUNT);
    // ...then presented ascending by frequency (Root -> Crown).
    chosen.sort((a, b) => a.f - b.f);

    return chosen.map((c, idx) => ({
      id: `mode:${Math.min(c.m,c.n)}:${Math.max(c.m,c.n)}`,
      index: idx,
      m: c.m,
      n: c.n,
      frequencyHz: c.f,
      modeIndex: c.modeIndex,
    }));
  }

  /**
   * 3D counterpart over the cavity spectrum f = f0*sqrt(m^2+n^2+p^2) in
   * [f0*sqrt(3), f0*sqrt(48)]; the band [f0*1.5, f0*7.5] covers all of it (sqrt(48)~6.93),
   * so the seven stations are drawn from the whole volume rather than clustering at one end.
   */
  private selectStations3D(): ResonanceAnchor[] {
    const f0 = this.params.baseFrequency;
    const bandLow = f0 * 1.5;
    const bandHigh = f0 * 7.5;

    const seen = new Set<string>();
    const candidates: { modeIndex: number; m: number; n: number; p: number; f: number; absC: number }[] = [];
    for (let i = 0; i < RESONATOR_MODE_TOTAL; i++) {
      const m = this.modeM[i];
      const n = this.modeN[i];
      const p = this.modeP[i];
      const f = this.modeFreq[i];
      if (f < bandLow || f > bandHigh) continue;
      const key = [m, n, p].sort((a, b) => a - b).join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ modeIndex: i, m, n, p, f, absC: Math.abs(this.modeCoupling[i]) });
    }
    // Best drive coupling first...
    candidates.sort((a, b) => b.absC - a.absC);
    const chosen = candidates.slice(0, RESONATOR_STATION_COUNT);
    // ...then presented ascending by frequency (Root -> Crown).
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
        modeIndex: c.modeIndex,
      };
    });
  }

  /**
   * Integrates every active mode's envelope one frame forward under a continuous drive at
   * `frequencyHz`, and returns fresh telemetry. Nothing here resets particle-independent
   * state; re/im simply relax toward the new steady state at each mode's own time constant.
   */
  public step(dt: number, frequencyHz: number): ResonatorTelemetry {
    const { dampingQ, driveStrength } = this.params;
    const zeta = 1 / (2 * Math.max(0.05, dampingQ));
    const clampedDt = Math.max(0, Math.min(0.1, dt));

    let totalEnergy = 0;
    let domEnergy = -1;
    let domIndex = 0;

    for (let i = 0; i < RESONATOR_MODE_TOTAL; i++) {
      if (!this.modeActive[i]) {
        // Inactive modes still relax passively toward silence (no drive term).
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
      const Hre = (drive * denomRe) / denomMagSq;
      const Him = (-drive * denomIm) / denomMagSq;

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

    // Nearest station by relative detuning.
    let nearestIdx = 0;
    let nearestRel = Infinity;
    for (let s = 0; s < this.stations.length; s++) {
      const rel = Math.abs(frequencyHz - this.stations[s].frequencyHz) / this.stations[s].frequencyHz;
      if (rel < nearestRel) {
        nearestRel = rel;
        nearestIdx = s;
      }
    }
    const lockBand = 0.04; // +/-4%
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
      isLocked: nearestRel <= lockBand,
    };
    return this.lastTelemetry;
  }

  public getTelemetry(): ResonatorTelemetry {
    return this.lastTelemetry;
  }

  public getAnchors(): ResonanceAnchor[] {
    return this.stations.map((anchor)=>({...anchor}));
  }

  /** @deprecated use getAnchors(); retained for compatibility with pre-semantic callers. */
  public getStations(): ResonanceAnchor[] {
    return this.getAnchors();
  }

  public getModalState(): ModalState[] {
    return Array.from({length:RESONATOR_MODE_TOTAL},(_,modeIndex)=>({
      modeIndex,
      m:this.modeM[modeIndex],
      n:this.modeN[modeIndex],
      p:this.modeP[modeIndex],
      frequencyHz:this.modeFreq[modeIndex],
      coupling:this.modeCoupling[modeIndex],
      active:this.modeActive[modeIndex]===1,
      re:this.re[modeIndex],
      im:this.im[modeIndex],
      energy:this.re[modeIndex]*this.re[modeIndex]+this.im[modeIndex]*this.im[modeIndex],
    }));
  }

  public getState(): ResonanceState {
    const modes=this.getModalState();
    const energyByIndex=new Map(modes.map(mode=>[mode.modeIndex,mode.energy] as const));
    return {
      frequencyHz:this.lastTelemetry.frequencyHz,
      totalEnergy:this.lastTelemetry.totalEnergy,
      coherence:this.lastTelemetry.coherence,
      modes,
      anchors:this.getAnchors().map(anchor=>({...anchor,energy:energyByIndex.get(anchor.modeIndex)??0})),
    };
  }

  /**
   * Continuous, uninterrupted glide through all seven stations with per-station dwell.
   * `tSeconds` is a monotonically increasing accumulator (NOT reset between calls) so the
   * resonator drive frequency this produces is itself continuous — the caller feeds the
   * result straight into `step()`.
   */
  public sweepFrequency(tSeconds: number, opts: SweepOptions): number {
    const stations = this.stations;
    if (stations.length === 0) return this.params.baseFrequency;
    const freqs = stations.map((s) => s.frequencyHz);

    let waypoints: number[];
    if (opts.direction === 'descent') {
      waypoints = [...freqs].reverse();
    } else if (opts.direction === 'pingpong') {
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

    const tMod = ((tSeconds % cycle) + cycle) % cycle;
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
