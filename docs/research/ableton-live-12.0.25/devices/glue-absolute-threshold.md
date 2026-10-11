# Glue absolute-threshold dependence — the LAM residual traced (2026-10-08, bounded binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice. NOT FOR REDISTRIBUTION. Never enters
product source (packages/live-dynamics). Everything offline; no Live.

Standing on: `glue-perblock-derivation.md` (state-slot ledger §2; §4/§7
residuals), `glue-compressor.md` §"LAM verdict", kernel decompile
`evidence/binary/glue-kernel-decompilation.txt` ([K#] below), and the exact
model `packages/live-dynamics/src/glue.rs` `CircuitModel`. New captures this
lane: `evidence/binary/glue-absolute-threshold-decompiles.txt` (FUN_10179fcfc
+ xrefs, ctor chain, const pool, FUN_10179ff74, FUN_1017a03c4). New
companion simulation: `evidence/devices/glue_abs_threshold_sim.py` — an
exact pure-Python port of `CircuitModel::step`, validated against the
committed gate numbers to ≤0.01 dB (below).

## 0. The question

The LAM verdict localized the model's ~2 dB deep-over deficit to a signature
the mapped kernel cannot express: the device breaks threshold-shift
invariance at attack idx 5 (−1.92/−4.69 at T−12 vs −2.84/−6.33 at T−24,
equal over) while staying invariant at idx 1 — and named the 0x1bc stage-1
binding ("detector-ripple scale into the LUT") the candidate mechanism.
This lane: close the 0x1bc chain, derive where (and whether) the captured
kernel can produce that signature, and state the corrected law.

**Outcome in one line: the captured kernel is EXACTLY threshold-shift
invariant — provably, for every constant binding — so the 0x1bc candidate
is refuted outright, and the device's idx-5 signature is structurally
impossible for everything mapped so far; the residual is relocalized to
either a confounded device render pair or a mechanism outside
OGlueCompressorProcessor, with a four-render discriminator that decides.**

## 1. The covariance law (the corrected law — derived, exact)

**Statement.** In the captured kernel, Threshold (s[0x188]) enters the DSP
exactly once — the detector gain [K113-115]:

```
G = 10^((7.8·s[0x120] − T − 18)/20)
```

Everything downstream of G is either (a) a fixed linear filter acting on the
input (stage-1 lowpass, coefficient 1−exp(−2π·0x1bc/N), [K117-120]; stage-2,
1−exp(−1.1·2π/N), [K122-134]), (b) the Ratio LUT and Range ceiling read at
index ∝ G·Φ[in] ([K135-177]), (c) the diode solve and dB states in the dB
domain ([K178-255]) — or (d) nothing else. The detector chain is linear in
amplitude, so the LUT-index trajectory is exactly

```
idx(t) = G · Φ[in](t),   Φ = (I − H2)(I − H1),  both H fixed
```

and the loop's fixed point is covariant under the joint map

```
T → T − Δ,   signal × 10^(−Δ/20)     ⇒     G·Φ invariant, all dB states identical
```

**GR depends on the over-threshold amount alone — for ANY LUT table, ANY
diode constants (m, B, u_max), ANY 0x1bc, ANY solver scale k, ANY −18
offset.** The proof needs only: one threshold entry (additive in G's
exponent), amplitude-linear detector filtering, and every other nonlinearity
downstream of the product G·Φ or acting on dB-domain states (which do not
scale). The under-branch attractor is exactly 0 — invariant. The only
amplitude-asymmetric terms in the kernel are the PRNG dither ν/w
([K62-90], scales 0x1c4 ≈ 9.9e-21 — dead by ~400 dB) and the +0.5 LUT index
offset (invariant under the map, since idx itself is).

**Confirmed three ways:**

- *Device, idx 1:* G1 (T−12/R30) ≡ G2 (T−24/R30) at equal over to 0.01 dB,
  and G9 (T−12/R60) ≡ G1 — the clean-pair invariances of the render
  campaign.
- *Model, exact port:* `glue_abs_threshold_sim.py` reproduces the committed
  numbers first (LAM pins T−24/R60/idx5 → −1.38/−4.57/−8.31/−12.41,
  exact to 0.01 dB; G13/T−12/idx5 → −1.38/−4.57 via the envelope-gate Δ
  row), then measures invariance under IDENTICAL signal and windows:
  model(T−12, +6 over) = model(T−24, +6 over) = −1.38 and model(+12 over) =
  −4.57 at idx 5, same at idx 1 (−2.02/−6.07), and Range-invariant too:
  T−12/R30 ≡ T−12/R60 ≡ T−24/R30 ≡ T−24/R60 at idx 5 across +6..+24 over
  (identical to <0.01 dB at every step, including +24 where the R30 ceiling
  shapes the deepest instantaneous LUT reads — min raw read −5.54 vs the
  t = 3.62 ceiling — yet leaves the cycle-mean GR unchanged).
  The committed verdict's "exactly invariant" is confirmed as a structural
  property, not a windowing accident.
- *Analytically:* at the Newton fixed point (s28 = 0, w ≈ 0, s38 → 0), the
  S = Σf′ terms of the over-branch x-solve cancel exactly ([K214-222]) and
  the per-sample conducting balance collapses to

```
Σ_legs m·(e^{B·u_i} − 1) = A·[k·ȳ − x·(k+R̂)] / (A+k+R̂) ,   u_i = x − lut_i
```

  with ȳ the cycle-mean y — k-free on the LUT-driving side, threshold-free,
  amplitude-covariant. Verified numerically at idx 5 (the deep, near-clamp
  regime): +2.4% at the deepest-conducting samples. At idx 1 the conducting
  samples sit against the u_max clamp (u = x − lut ≈ 0.60 > u_max
  0.3887), where the clean form no longer describes the balance — noted,
  not load-bearing here.

**Corollary.** No constant anywhere in the mapped layer — stage-1/stage-2
coefficients, LUT tables, diode set, u_max ladder, k's absolute scale λ,
the −18 offset — can produce a threshold dependence. A break of this
invariance REQUIRES an amplitude-asymmetric term entering the detector or
the LUT index (a signal-independent additive offset in idx, e.g. a live
dither, or a threshold-coupled coefficient write). The captured processor
contains no such term.

## 2. The 0x1bc chain — every read → its writer (closes the §4 open)

Writers (complete; new captures cited from
`evidence/binary/glue-absolute-threshold-decompiles.txt`):

| site | act | law |
|---|---|---|
| `FUN_10179f64c` init [B@0x10179f…, decompiles file] | copies 8 bytes from const pool 0x104d27080 into 0x1bc..0x1c3 | 0x1bc ← 0.0f, 0x1c0 ← 0.5f (pool dump: `0000000040000000`) |
| ctor `FUN_101687300` (the function holding the B@0x101687328 chain) | calls `FUN_10179fcfc(0)` — the ONLY call site in the binary | 0x1bc ← 2.0 (law below) |
| `FUN_10179fcfc` (the setter) | `0x1bc = (v ≥ 20.0) ? v : 2.0` | values in (2, 20) are UNREACHABLE; every v < 20 — including the entire 0x1e4 attack ladder {1e-5 … 0.03} — lands on 2.0 |
| `FUN_1017a028c` / block driver ramp setup | RAMP | target `0x1b8 = 1 − exp(−2π·s[0x1bc]·s[0x204])`, increment 0x1c0 |

Readers: the ramp setup (target computation) and the kernel stage-1 update
[K117-120] (accumulator 0x1b8). Xrefs: `FUN_10179fcfc` has exactly ONE
reference in the binary — DATA-typed, from 0x106b97c5b in the shared
unanalyzed setter-registration blob (the same blob holds the only DATA refs
to the Threshold setter and the Attack shell). No code caller besides the
ctor. The Attack/Release shells write 0x68/0x6c/0xb0/0xc8-0xd4/0x1cc/0x1d0/
0x1e4 — never 0x1bc. The per-block coefficient master `FUN_10179fff8` and
the parameter-apply/metering paths (`FUN_10179ff74`, `FUN_1017a03c4` —
decompiled this lane) write only metering slots 0x20c..0x284, which the
kernel never reads.

**Conclusion: 0x1bc is the fixed factory constant 2.0 in this build.** The
per-block derivation §4's open item ("caller of this setter outside the
captured set") is CLOSED: the caller is the ctor, with 0.0. Its role is
exactly the stage-1 lowpass coefficient target (cutoff ∝ 2·fs/N ≈ 689 Hz at
N=128, 44.1 kHz) — one fixed linear filter inside the covariant product Φ.

The 0x1e4 ladder (per-attack {1e-5, 1e-4, 3e-4, 1e-3, 3e-3, 0.01, 0.03},
written by the Attack shell, consumer outside the captured processor)
remains open as a consumer question, but is now BOUNDED: even if its
consumer drives the 0x1bc setter, every ladder value is < 20 → 2.0. It
cannot reach the stage-1 coefficient with a non-factory value through any
mapped path.

## 3. The named candidate refuted

The LAM verdict's candidate — "the 0x1bc stage-1 binding (detector-ripple
scale into the LUT); a slightly larger device-side LUT-index swing would
deepen exactly monotone-with-depth" — is refuted on two independent
grounds:

1. **Structural (the covariance corollary):** 0x1bc is a constant inside
   Φ. Under the threshold-shift map, Φ[in] scales with the signal and G
   anti-scales; the product is invariant for ANY 0x1bc. A larger
   device-side LUT-index swing changes the DEPTH, never the invariance.
2. **Numerical (the scan):** with the exact port, 0x1bc was swept over
   {2, 5, 10, 20, 40, 80} at idx 5 and idx 1, comparing model(T−12/R30) vs
   model(T−24/R60) at equal over. The gap is 0.00 dB at every value (the
   +0.21 dB readings at f1 ≥ 10 are near-threshold GR noise in the −0.00
   vs −0.21 regime, not a threshold effect). Moreover larger 0x1bc only
   SHALLOWS the depth (faster stage-1 → smaller spread), and 2.0 is the
   setter's floor — the model at factory 2.0 is already the DEEPEST
   configuration the captured kernel can reach, still 1.5–2.1 dB above the
   device at idx 5/T−24.

## 4. Where the device's idx-5 signature can live

The device pair behind the verdict's break — G7 (T−12, **R30**, idx 5,
2026-10-07 campaign) vs LAM (T−24, **R60**, idx 5, 2026-10-08 render lane
3) — differs in Threshold AND Range AND session. The mapped kernel says the
Range half is inert at idx 5 (model: identical to <0.01 dB across all four
R/T corners; the verdict's own idx-1 inference R60 ≡ R30 extends to idx 5
numerically). Since no constant can make Threshold act (§1), the measured
−0.92/−1.64 dB gap must be one of:

- **(a) A confounded render pair** — a staging difference between the two
  sessions/lanes that co-varied with the pinned values. The LAM render's
  release tail (−96.33 dBFS) matches the campaign's (−96.32/−96.33), and
  the campaign itself produces exact invariance when the pair is clean
  (G1 ≡ G2, G9 ≡ G1) — so the pipeline is *capable* of exactness; but G7
  and LAM were never rendered in the same session, and no
  (T−12, R60, idx 5) or (T−24, R30, idx 5) cell exists to separate the
  axes in the DEVICE.
- **(b) A real mechanism outside `OGlueCompressorProcessor`** — an
  amplitude-asymmetric term (the only in-capture candidate, the dither, is
  dead) or a write into a detector coefficient from code this lane has not
  captured. The per-block paths decompiled this lane (apply, metering) are
  clean; the remaining uncaptured surface is outside the processor.

Both are decided by the same cheap experiment:

**Discriminator renders (one session, identical staging):** at idx 5,
Ratio 1, Release 0, MU 0 — (T−12, R30), (T−12, R60), (T−24, R30),
(T−24, R60) on steps-1k, read at the committed mid-step windows. The exact
model predicts all four IDENTICAL at equal over: −1.38/−4.57 (+6/+12 over)
and, at T−24 only, −8.31/−12.41 (+18/+24). If the device reproduces that
identity, the LAM-vs-G7 gap was a confound and the "absolute-threshold
dependence" ceases to exist as a device property. If the gap follows
Threshold at fixed Range, a real amplitude-asymmetric mechanism exists
outside the mapped processor. If it follows Range, the ceiling region
(lut < −3.62) is miscalibrated in a way the mapped ceiling law misses.

## 5. The residual ledger after this lane

- **0x1bc chain: CLOSED** (factory 2.0, ctor-only caller, setter law
  max(v,2), no DSP writer). §4's open item in the per-block derivation is
  resolved; the integration model's `a_s1 = 1 − exp(−2·τ/N)` stands as the
  unique faithful reading.
- **Threshold-shift invariance: DERIVED** (the covariance law, §1) — the
  model's exact invariance is structural, now shared by the device at
  idx 1 and, under the null hypothesis (a), expected at idx 5 too.
- **The ~2 dB covariant depth deficit** (model shallow vs device at idx 1
  both thresholds; idx 5/T−24): OPEN, now correctly characterized — it is
  NOT threshold-dependent (invariant deficit at idx 1), NOT
  Range-dependent (§1/R-inertness), NOT the solver scale (LAM verdict),
  NOT 0x1bc (this lane). It is a covariant law-shape difference: something
  that deepens the device's operating point ~monotone-in-over by ~1.5-2.2
  dB while preserving shift-invariance. Candidates that keep covariance:
  a larger effective detector-scale law (0xa8-like), a different LUT
  family at Ratio 1 than the extracted DAT_104cd1280 (e.g. table select
  off-by-one in the extraction mapping — checkable against the D1 grid),
  or a diode-set difference. The G7/G13-vs-model near-exactness at
  idx 5/T−12 (−0.12/−0.54 dB) bounds any such mechanism to be
  attack-coupled at fast attacks... or the same confound as (a).
  **CLOSED 2026-10-08 (equilibrium lane): the G7/G13 near-exactness was the
  confound — the A20 cells run attack case 6 (host clamp), and the deficit
  is a uniform ×1.40 detector-feed trajectory gain closing all nine pin
  families to ≤0.07 dB (G7's A20 pin included, at case 6). None of the
  three candidates above survived (LUT families swap with the wrong shape;
  detector scale/diode set bounded out). Record:
  `glue-compressor.md` "Over-branch equilibrium closure".**
- **The LAM verdict's relocalization stands, sharpened:** the residual's
  home is NOT in the mapped per-sample kernel at all — provably (§1). It
  is either outside `OGlueCompressorProcessor` or outside the pinned
  comparison itself. The four-render discriminator (§4) is the next move
  and belongs to a render lane.

## 6. Confidence

- Covariance law: **high** — four-line proof off the decompile's only
  threshold read; confirmed on the exact port (validated ≤0.01 dB against
  two independent committed gate runs) across 16 corner runs; device-side
  confirmed at idx 1 by the campaign's own clean pairs.
- 0x1bc closure: **high** — setter decompile + single-xref enumeration +
  const-pool dump + ctor chain + negative results on shells/apply/metering,
  all cited in the new capture file.
- Candidate refutation: **high** — structural (corollary) + numerical
  (scan), independent.
- The (a)-vs-(b) fork: **open by construction** — this lane is binary-only;
  the deciding evidence is four device renders. The failing LAM assertions
  stay `#[ignore]`d in `tests/golden.rs` as the honest record; this dossier
  adds the prediction they will be judged against.

## 7. Files

- Dossier: this file.
- New binary evidence: `evidence/binary/glue-absolute-threshold-decompiles.txt`.
- Exact-port simulation: `evidence/devices/glue_abs_threshold_sim.py`
  (pure Python, no deps; E1 validation + invariance grid + 0x1bc scan +
  equilibrium-law check are reproducible from its `main` and the lane log).
