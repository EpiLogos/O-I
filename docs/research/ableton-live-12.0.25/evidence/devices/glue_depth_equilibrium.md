# Glue over-branch depth equilibrium — the shaped-LUT cycle mean at depth (2026-10-08, bounded math lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice. NOT FOR REDISTRIBUTION. Never enters
product source (`packages/live-dynamics`). Companion simulation:
`evidence/devices/glue_depth_equilibrium_sim.py` (Python, stdlib only;
loads the committed 512-float LUTs from
`evidence/binary/glue-ratio-tables.txt` and reuses the render-validated
exact port in `evidence/devices/glue_abs_threshold_sim.py` plus the
equilibrium helpers of `evidence/devices/glue_overbranch_equilibrium_sim.py`).
Standing on: `devices/glue-perblock-derivation.md` (state-slot ledger;
§3/§4), `devices/glue-compressor.md` (G1/G2 gain maps; LAM verdict;
four-cell grid; "Over-branch equilibrium closure"),
`devices/glue-absolute-threshold.md` (covariance law; the 0x1bc chain
closed), `evidence/binary/glue-kernel-decompilation.txt` (kernel lines
cited [K#] = file line).

## 0. The question

The LAM verdict (`glue-compressor.md` "LAM verdict") homed the circuit
model's last residual — model uniformly shallow vs render, monotone in
over-level and saturating: **+1.46/+1.77/+1.96/+2.10 dB at +6/+12/+18/+24
over at attack idx 5, +1.89/+2.05/+2.15/+2.24 at idx 1** — in "the λ-free
over-branch equilibrium: the shaped-LUT cycle mean → x at depth, treated
as constant in the current derivation, which is wrong at depth". Before
this lane: λ exonerated (the LAM discriminator itself), 0x1bc exonerated
(`glue-absolute-threshold.md` §2–§3: factory constant 2.0, ctor-only
caller, and the captured kernel is threshold-shift-covariant for ANY
constant binding), and the four-cell grid closed threshold/Range
covariance (all idx-5 cells identical at equal over, 0.00–0.01 dB).

This lane implements the equilibrium solve WITH the depth-dependent cycle
mean — the balance iterated to convergence at each input level — and asks
whether it produces the missing ≈2 dB of depth.

**Verdict: no.** The corrected equilibrium reproduces the mapped loop's
own steady state to ≤0.05 dB everywhere the balance is valid (≤0.10 dB at
the deepest idx-1 rows): the depth-dependent cycle mean is not a missing
correction — the per-sample loop already computes it exactly. And the
constant-ȳ substitution the derivation made is not "≈2 dB shallow" either:
**it has no compressed fixed point at all** (GR identically 0, §2) — the
depth dependence is not a correction term, it is the whole compression.
The ≈2 dB is a trajectory-read-depth difference between the device and the
mapped law (§4), quantified by the balance's own inversion and closed
render-side by the detector-tap constant (`DETECTOR_TAP_GAIN = 1.40`,
adopted in `src/glue.rs`; its binary writer remains the open item —
`glue-compressor.md` "Over-branch equilibrium closure", which ran as this
lane's follow-on the same day and whose 38-cell table this dossier's §3.4
reproduces on three pins).

## 1. The per-sample balance and its cycle mean

From the over-branch Newton solve [K188-226] with s28 = 0 and w ≈ 0
(dither-dead build, [PB §2: 0x1c4/0x1c8]):

- The fixed point of [K220-221] is `x·denom = −A·(z + Φ) − c4·Φ`, with
  `z = −k·y[n−1] − s38` [K179-183], `c4 = k + R̂`,
  `Φ = Σ_c [f(u_c) − x·f′(u_c)]`, `u_c = clamp(x − lut_c, 0, u_max)`,
  `f(u) = m·(e^{Bu} − 1)`, `f′ = m·B·e^{Bu}`, `S = Σ_c f′(u_c)`,
  `denom = S·(A+k+R̂) + A·(k+R̂)`.
- On the interior (`0 < u_c < u_max`) `u_c + lut_c = x`, so the x·S terms
  cancel exactly and the solve satisfies the **per-sample balance**

  ```
  Σ_legs m·(e^{B·u_c} − 1) = A·(k·y[n−1] + s38 − x·(k+R̂)) / (A+k+R̂)
  ```

  written with `u = clamp(x − lut, 0, u_max)` it holds in ALL three
  regimes: under-branch both sides vanish (`x = (k·y + s38)/c4`, [K227-231]);
  interior it is the cancellation above; **at the u_max clamp it does NOT
  hold** — u is pinned, Φ and S become x-independent, and [K220-221] is
  linear in x. The exact per-sample solve is therefore piecewise
  (under / clamped-linear / interior-balance); §3.2 audits all three
  against the kernel's own Newton loop. `s38 → 0` at the cycle scale
  ([K236]: `s38 = z + k·y`, fixed point 0).
- The y recursion [K223-225] is a one-pole of the solved x with
  branch-independent DC gain `A/(A+R̂)`: `⟨y⟩ = x̄·A/(A+R̂)` exactly, ripple
  included.

Cycle-meaning the balance (sum it over the 1 kHz cycle) kills k exactly:

```
⟨Σ_legs m·(e^{B·u_c} − 1)⟩ = −x̄·A·R̂/(A+R̂)
```

and the steady applied GR is exactly `7.8·x̄·A/(A+R̂)`. The balance is
threshold-free: the trajectory enters only through `a·G =
10^((over + 7.8·ȳ − 18)/20)` — the threshold cancels, reproducing the
four-cell grid's measured covariance by construction. The one place the
cycle-mean form loses exactness is a cycle that touches the clamp
(at idx 5, +24 over: 11% of samples — §3.2; the `full` tier below handles
the clamp exactly, so no table number rests on the mean form).

## 2. What "ȳ treated as constant" means — the four tiers

The depth-dependent object is the shaped-LUT read along the detector
trajectory: `lut_c = shapedLUT(spread(θ)·G(θ))`, `G =
10^((7.8·y − T − 18)/20)` ([K113-115]; the dB smoother is a pass-through,
[PB §2]), `spread` from the two-pole detector ([K117-134]; stage-1
`1−exp(−2π·2/N)` with 0x1bc = 2.0, stage-2 `1−exp(−1.1·2π/N)`), the LUT
itself the committed Ratio-1 table (`DAT_104cd1280`: +0.676 at center,
falling through 0 at index ≈ +29 to −6.68 at +255). Four treatments, in
the order the derivation could have made them:

| tier | ȳ / cycle-mean treatment | LUT trajectory | G over the cycle |
|---|---|---|---|
| `center` | constant, = lut(0) = +0.676 ("the center value, ≈0.7 dB region") | none | constant |
| `cycle` | depth-dependent, solved | the real shaped trajectory | constant (quasi-static) |
| `rippled` | depth-dependent | the real shaped trajectory | constant |
| `full` | depth-dependent | the real per-sample trajectory | per-sample `G(θ) = 10^((7.8·y[θ−1] − T − 18)/20)` |

`full` also threads s38 exactly and solves the balance piecewise (§1) —
it is the mapped law's exact per-sample composition iterated to its
periodic steady state; its GR is the power-weighted applied gain
(the render-side `out_rms − in_rms` definition).

**The `center` tier is structurally degenerate.** With `lut ≡ lut(0)` the
mean balance reads

```
h(x̄) = 2m·(e^{B·u} − 1) + x̄·A·R̂/(A+R̂),   u = clamp(x̄ − 0.676, 0, u_max)
```

`h > 0` strictly for x̄ > 0 (both terms positive) and `h < 0` strictly for
x̄ < 0 (u clamps to 0, the linear term is negative): the only fixed point
is x̄ = 0 — **GR identically 0 at every input level**. Numeric sign scan
(EC log): min h over x ∈ {1e-4 … 5} = +1.72e-13, max over the negatives =
−1.72e-13. So the task's premise inverts: the constant-center treatment
does not under-predict depth by ≈2 dB — it under-predicts ALL of it. The
depth-dependent cycle mean is load-bearing for any compression at all, and
the per-sample loop (the committed `CircuitModel`) has always computed it.
No treatment of ȳ can move the equilibrium off the loop's own fixed point
by anything but a fidelity correction — which §3.3 measures at ≤0.10 dB.

## 3. Results

### 3.1 Port validation (EA)

Exact port (LUTs from `glue-ratio-tables.txt`, provenance-checked against
the glue.rs copy: max|d| = 0) vs the committed gate numbers
(`glue-compressor.md` LAM verdict table; `tests/golden.rs`):

| pin | +6 | +12 | +18 | +24 |
|---|---|---|---|---|
| LAM (T−24/R60/A5) sim | −1.379 | −4.569 | −8.309 | −12.412 |
| LAM committed | −1.38 | −4.57 | −8.31 | −12.41 |
| G2 (T−24/R30/A1) sim | −2.022 | −6.068 | −10.417 | −14.977 |
| G2 committed | −2.02 | −6.07 | −10.42 | −14.98 |

### 3.2 Per-sample balance audit (EB)

The port instrumented at the LAM pin (T−24/R60/A5, 0 dBFS sine = +24 over;
4410 samples audited, steady state): the kernel's converged Newton solve
against the closed-form balance, and against this lane's piecewise-exact
solve:

| regime | count (share) | check | result |
|---|---|---|---|
| under-branch | 1680 (38%) | identity trivially 0 | — |
| interior | 2240 (51%) | max \|Σf − balance\|/\|Σf\| at the exact root | **2.1e-12** |
| interior | 2240 (51%) | same at the kernel's iterate | 7.1e-2 (Newton exit-tol slack, [K232]) |
| u_max-clamped | 490 (11%) | \|x_exact − x_Newton\| over ALL samples | **1.1e-3** |

The identity is exact at the root; the 7e-2 interior figure at the kernel's
iterate is the exit tolerance (`|Δx| ≤ |x|·1e-5 + 1e-7`, [K232]) amplified
by the balance's tiny scale (m ≈ 6.8e-9), and the 1.1e-3 worst x-gap is the
same slack near the clamp boundary. This audit is what licenses solving the
equilibrium from the closed-form balance instead of the Newton loop.

### 3.3 The tier ladder (EC) — the main table

Steady applied GR (dB) at the G-series pins (T−12/T−24, R30, attack idx 5
and idx 1 — the task's pin set, old attack map). Device: the four-cell grid
+ LAM map at idx 5 (−2.84/−6.33/−10.27/−14.51 — threshold-identical at
equal over), the G2 map at idx 1 (−3.91/−8.12/−12.57/−17.22; G1 ≡ G2).
The T−12 grid tops at 0 dBFS peak = +12 over, so T−12 rows commit only
+6/+12.

| pin | over | device | port | center | cycle | rippled | full | d(full−dev) | d(port−dev) |
|---|---|---|---|---|---|---|---|---|---|
| T−12/R30/A5 | +6 | −2.84 | −1.38 | 0.00 | −1.38 | −1.38 | −1.38 | +1.46 | +1.46 |
| T−12/R30/A5 | +12 | −6.33 | −4.57 | 0.00 | −4.57 | −4.58 | −4.57 | +1.76 | +1.76 |
| T−24/R30/A5 | +6 | −2.84 | −1.38 | 0.00 | −1.38 | −1.38 | −1.38 | +1.46 | +1.46 |
| T−24/R30/A5 | +12 | −6.33 | −4.57 | 0.00 | −4.57 | −4.58 | −4.57 | +1.76 | +1.76 |
| T−24/R30/A5 | +18 | −10.27 | −8.31 | 0.00 | −8.31 | −8.32 | −8.31 | +1.96 | +1.96 |
| T−24/R30/A5 | +24 | −14.51 | −12.41 | 0.00 | −12.39 | −12.41 | −12.41 | +2.10 | +2.10 |
| T−12/R30/A1 | +6 | −3.91 | −2.02 | 0.00 | −2.04 | −2.04 | −2.04 | +1.87 | +1.89 |
| T−12/R30/A1 | +12 | −8.12 | −6.07 | 0.00 | −6.03 | −6.04 | −6.12 | +2.00 | +2.05 |
| T−24/R30/A1 | +6 | −3.91 | −2.02 | 0.00 | −2.04 | −2.04 | −2.04 | +1.87 | +1.89 |
| T−24/R30/A1 | +12 | −8.12 | −6.07 | 0.00 | −6.03 | −6.04 | −6.12 | +2.00 | +2.05 |
| T−24/R30/A1 | +18 | −12.57 | −10.42 | 0.00 | −9.94 | −9.95 | −10.50 | +2.07 | +2.15 |
| T−24/R30/A1 | +24 | −17.22 | −14.98 | 0.00 | −13.60 | −13.84 | −15.08 | +2.14 | +2.24 |

Reading the ladder:

- **At idx 5 — the pin family the residual was named on — every
  depth-dependent treatment lands ON the port** (≤0.02 dB at all four
  overs). y's over-branch pole there is ≈52 ms, so the cycle mean is nearly
  static anyway; solving it properly changes nothing.
- **At idx 1 the quasi-static tiers drift shallow at depth** (cycle
  −13.60 vs port −14.98 at +24: the constant-G cycle assumption frays when
  y's pole is ≈0.8 ms and G fluctuates hard within the cycle) — and the
  drift is AWAY from the device. The `full` tier (per-sample G, exact s38)
  closes the fidelity gap to 0.10 dB of the port — the total amount the
  most faithful depth-dependent treatment can add at any row.
- **Worst \|full − device\| = 2.14 dB** (idx 1, +12): the corrected
  equilibrium misses the device by the same uniformly-shallow, saturating
  margin as the loop it reproduces.
- Full-tier threshold covariance: T−12 vs T−24 rows identical to 0.0000 dB
  (the grid's invariance, by construction).

**The depth-dependent cycle mean does not close the residual.** It is
necessary (§2: without it there is no compression at all), it is exact in
the loop, and its total fidelity correction beyond the loop is ≤0.10 dB —
against a 2.1–2.2 dB deficit.

### 3.4 Residual structure (ED) — where the sim still misses

Inverting the balance at each committed pin (`D = x̄ − u_eff`, the
exp-weighted LUT read the trajectory must supply; threshold-free — the
grid's covariance):

| pin | over | device D | model D | dD (dev − mod) |
|---|---|---|---|---|
| A5 | +6 | −0.802 | −0.488 | −0.315 |
| A5 | +12 | −1.506 | −1.155 | −0.351 |
| A5 | +18 | −2.279 | −1.896 | −0.383 |
| A5 | +24 | −3.102 | −2.695 | −0.407 |
| A1 | +6 | −0.783 | −0.506 | −0.277 |
| A1 | +12 | −1.364 | −1.084 | −0.279 |
| A1 | +18 | −1.959 | −1.672 | −0.287 |
| A1 | +24 | −2.575 | −2.279 | −0.296 |

Structure, plainly:

- **Monotone in over-level in dB, saturating** (idx 5: +1.46 → +2.10;
  idx 1: +1.89 → +2.24, increments decelerating); as a fraction of depth it
  FALLS (51% → 14% at idx 5) — this is not a growing-curvature signature,
  which is what a wrong ȳ treatment would produce.
- **Nearly depth-uniform in the balance's own domain**: the device's
  exp-weighted LUT read is deeper by ≈ −0.28 at every idx-1 cell and
  −0.32…−0.41 at idx 5 — a near-constant TRAJECTORY-READ-DEPTH deficit:
  the device behaves as if the fast-minus-slow spread enters the LUT index
  ≈1.40× deeper than the mapped detector chain supplies.
- **No sign change anywhere**; the miss is one-signed and smooth.

#### Closure rows (the same-day follow-on, reproduced)

Exact port with the detector-tap ×1.40 on the LUT-index delta and the
corrected attack map (stored Attack 2 → setter case 2 = 2700 µs, NOT case 1;
stored 20 → case 6 — `glue-shell-functions.txt` FUN_10179f9d4 has no case 2;
`glue-compressor.md` "Over-branch equilibrium closure" finding 1):

| pin | +6 | +12 | +18 | +24 | worst |
|---|---|---|---|---|---|
| LAM(5) T−24/R60 | −0.00 | −0.01 | +0.00 | −0.00 | **0.01** |
| G2(2) T−24/R30 | +0.01 | +0.02 | +0.02 | +0.04 | **0.04** |
| G1(2) T−12/R30 | +0.01 | +0.02 | — | — | **0.02** |

(worst |Δ| across ALL nine committed pin families = 0.07 dB over 38 cells —
closure-section table; `glue_tapgain_confirm.py` and this lane's ED2 agree.)
The ×1.40 lever is covariance-preserving, leaves the sub-threshold rows at
unity, and is bounded out of every mapped constant (stage-1/2 cascade cannot
exceed unity spread gain at 0x1bc = 2.0; the G-offset lever is ~30× too hot;
m/B/u_max move the wrong way or ≤0.3 dB; the neighbour LUT tables have the
wrong shape) — the closure section holds the full bounding argument.

## 4. Verdict

**The depth-dependent cycle mean does NOT close the ≈2 dB residual —
refuted, with the residual characterized.**

1. The constant-ȳ (center-value) derivation is structurally degenerate:
   its only fixed point is GR = 0. There was never a "2 dB-shallow"
   constant-ȳ equilibrium to correct; the depth-dependent cycle mean is the
   whole compression, and the committed per-sample `CircuitModel` computes
   it exactly.
2. The corrected equilibrium, solved to its most faithful form (per-sample
   G, exact s38, piecewise-exact balance incl. the u_max clamp), reproduces
   the model's own steady state to ≤0.05 dB (idx 5, all depths) and
   ≤0.10 dB (idx 1, deepest). The equilibrium mapping is CLOSED — it is the
   loop, and the loop is render-shallow by 1.5–2.2 dB.
3. The residual is a **trajectory-read-depth deficit**: the device's
   exp-weighted LUT read sits ≈0.28–0.41 dB-deeper in the balance's D-domain,
   ≈uniform across depth (no curvature growth, no sign change), i.e. an
   effective ×1.40 on the spread→LUT-index swing. It is closed render-side
   by `DETECTOR_TAP_GAIN = 1.40` (adopted in `src/glue.rs`, worst 0.07 dB
   across 38 committed cells; this lane re-verified 0.01/0.04/0.02 on
   LAM/G2/G1). The constant's binary WRITER remains the open item — a
   detector-feed gain outside the captured functions (p[0x314] is bounded
   out; it is the oversample factor). Deciding captures, from the closure
   section: dump the X1 body's input-gain neighborhood at render time, or a
   setter-registry sweep for the detector-feed gain.

Scope honest-words: the ladder's quasi-static tiers (`cycle`/`rippled`)
are the previous lane's E3 machinery re-run for the record; the `center`
degeneracy proof, the piecewise-exact solver (the clamp regime was absent
from the earlier balance-only treatment), the per-sample audit, and the
`full` tier are this lane's additions.

## Citations

- Kernel: `evidence/binary/glue-kernel-decompilation.txt` — G law
  [K113-115]; detector legs [K117-134]; LUT index + interp
  [K135-153]; Range ceiling [K154-177]; Newton loop [K178-240]
  (z [K179-183], Φ [K214-216], x-solve [K218-221], y recursion
  [K223-225], under-branch [K227-231], convergence [K232], s38 [K236]).
- LUT tables: `evidence/binary/glue-ratio-tables.txt` DAT_104cd1280
  (Ratio 1; center +0.676, zero-crossing ≈ +29, tail −6.68 at +255).
- Committed maps: `devices/glue-compressor.md` — G1 (ll. 58-68), G2
  (ll. 71-81), LAM verdict table (ll. 970-975), four-cell grid
  (ll. 1032-1066), "Over-branch equilibrium closure" (§ at ll. 1072ff).
- 0x1bc exoneration: `devices/glue-absolute-threshold.md` §2-§3.
- Attack setter cases: `evidence/binary/glue-shell-functions.txt`
  FUN_10179f9d4 (ll. 99-152; cases {0,1,3,4,5,6} — no case 2).
- Adopted constant: `packages/live-dynamics/src/glue.rs` `DETECTOR_TAP_GAIN`
  (ll. 345-350), applied at the LUT read (ll. 983-987).
