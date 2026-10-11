# Dynamic Tube (OTubeProcessor) binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
BlockProbe/DataProbe, no re-import). NOT FOR REDISTRIBUTION. Never enters
product source (`packages/live-dynamics`). Companion capture:
`evidence/binary/dynamictube-decompiles.txt` (all 17 trampolines, full
CalcMain body, CalcMain4x head, create, the Type-id source probe). Form
follows `compressor-derivation.md`; claims graded: **[D] decompiled-confirmed**,
**[B] byte-decoded**, **[H] unverified hypothesis** — no behavioral renders
ran in this lane; per README every [D]/[B] claim still awaits the
golden-render cross-check before it gates a rebuild.

Dynamic Tube is `OTubeProcessor` (XML tag `<Tube>`, device tag "Tube") — a
Compressor-family per-sample processor: floats (not doubles), one frame per
call, **two independent channel chains** (no mid/stereo coupling except the
per-channel detectors feeding one shared bias smoother). Signal chain:
4-band TPT/biquad Tone network → drive → **bias (manual + signal-tracking
auto-bias)** → **tube transfer LUT** → two-stage AC-coupling integrators →
post Tone network → makeup + dry/wet.

## 1. What runs when (call topology)

- **Create** `SOnProcessorCreate<OTubeProcessor>` 0x1018c5088 → wrapper
  0x1018c50c4 [D] (same shell pattern as Pedal/Compressor).
- **NewRate(int,int)** 0x1019bfa00 [D]: second int = sr Hz → stored float
  0x5c; `sr_kHz = *(float*)0x160`; rebuilds six ballistic coefficients
  (below); re-inits the Tone filter object at this+100
  (`func_0x101883258/0x101883274`), the de-zipper for Bias
  (`func_0x1016e2f78(1.0, 1.0, sr)` → coeff 0x48), and the curve-LUT
  descriptors (0x1c8, 0x330 via `func_0x10199bfac`); re-primes the tube
  operating point from the curve LUT at the current Bias.
- **Reset** 0x1019bf9fc [D]: identical coefficient rebuild + zeroed
  ballistics (0x168/0x180/0x198/0x1b0) + LUT re-prime (0x4a8–0x4c0).
- **Calc-slot selectors**: OnOn 0x1019bfa5c, OnOversampling 0x1019bfe48,
  OnX 0x1019bfee4 share the same tail [D] — install
  `CalcMain` (Oversampling 0) or `CalcMain4x` (Oversampling 1) into the
  scheduler slot 0x508 when On(0x2c) && !X-fading(0x2d); NULL (SNoCalcAudioFunc)
  otherwise. OnOn additionally copies Bias → smoothed-bias (0x44 = 0x40) and
  calls the filter re-init on the on-edge.
- **CalcMain4x** 0x1019bff74 [D, body captured; line cap truncated the tail
  of the print — the 1x body below is complete]: same chain, tube core run at
  4× per frame.
- XML parameters [B]: `Type, DryWet, PreDrive, PostDrive, Bias, AutoBias,
  AutoBiasAttack, AutoBiasRelease, Tone, Oversampling` — exactly the setter
  set (16 `SProcessorFunc` registrations).

## 2. The state-slot ledger (all offsets are processor `this`)

| slot | role | writer | law |
|---|---|---|---|
| 0x2c/0x2d | On bool / crossfade guard | SET On/OnX | |
| 0x30 | PreDrive gain (linear) | SET PreDrive | LUT: `(v·0.05 − c20)·c24` interp, table 0x1059a89c0+8 (runtime dB→linear family, cf. compressor 0x1059a89b8) [D] |
| 0x34 | PostDrive gain (linear) | SET PostDrive | same LUT |
| 0x38 | 1−w | SET (recomputed by Pre/Post too) | |
| 0x3c | makeup = PostDrive·w / PreDrive | SET Pre/Post/DryWet | |
| 0x40 | Bias voltage = (1 − 2v)·0.65 V | SET Bias | ±0.65 V [D] |
| 0x44 | smoothed Bias | CALC (NewRate sets = 0x40) | `0x44 += 0x48·(0x40−0x44)` |
| 0x48 | Bias de-zipper coeff | NewRate | `func_0x1016e2f78(1,1,sr)` |
| 0x4c | AutoBias depth, **negated** | SET AutoBias | stored −v |
| 0x50/0x54 | AutoBiasAttack / Release (ms) | SET | |
| 0x5c | sr Hz (float) | NewRate | |
| 0x60 | Oversampling int (0/1) | SET Oversampling | CalcMain vs CalcMain4x |
| 0x68–0x7c, 0xa4–0xb8, 0xe0–0xf4, 0x11c–0x130 | four 2-pole Tone sections (b0,b1,b2,a1,a2 + states), L/R pairs | SET Tone; base freqs 0x90/0xcc/0x108/0x144 by shared init | RBJ-style with Q²=0.1 (0.1 in the α term), boost A = 10^(±0.025·Tone); bands 1/3 ω = stored·251.32742 (=2π·40), bands 2/4 ω = stored·116238.93, ω clamped ≤ 0.99π (3.1101768) [D] |
| 0x158/0x160 | Tone raw / sr_kHz | SET Tone / INIT | |
| 0x168, 0x198 | detector stage (L/R): peak-follow state | CALC | `s += c·(env−s)`, c = attack 0x170/0x1a0 when env ≥ s else release 0x188/0x1b8 |
| 0x170/0x178/0x188 | L attack, attack×6, release coeffs | SET Atk/Rel, INIT | `exp(−1/(ms·sr_kHz))`; the ×6 pair (0x178/0x1a8) is built but not read by CalcMain [D] |
| 0x1a0/0x1a8/0x1b8 | R attack/×6/release | SET, INIT | |
| 0x1c0 | tube-curve LUT descriptor (data +8, cap +0x18, domain c20 +0x20, scale c24 +0x24) | SET Type (via `FUN_10189d0e0(id)` → `FUN_101884a28`) | **Type picks resource id at `0x104cf31e8 + Type·4` = {6,7,8}** [B/DataProbe] — runtime-loaded curve tables |
| 0x1c8/0x330 | second/third LUT descriptors | INIT | consumers open |
| 0x4a0/0x4a4 | AC-coupling integrator coeffs | INIT | |
| 0x4a8/0x4ac, 0x4b0/0x4b4 | stage-1 coupling state / last tube out (L/R) | CALC | `u = (y − y_last) + u·0x4a0` |
| 0x4b8/0x4bc, 0x4c0/0x4c4 | stage-2 coupling state / last u (L/R) | CALC | `u2 = (u − u_last) + u2·0x4a4` |
| 0x4e8/0x4f0 | input ptrs L/R | shell | |
| 0x4f8/0x4fc | output L/R | CALC | `wet·makeup + in·(1−w)` |
| 0x500/0x504 | `ABS(x_tube − lut_out)` per channel | CALC | tube drive meter |

## 3. The mechanism, plainly (CalcMain)

1. **Tone pre-network** (sections 1–2, coeffs 0x68/0xa4 …): per channel,
   two cascaded 2-pole sections on the raw input → fVar11/fVar9.
2. **Detector** (per channel, independent): env = |section-1 out|; one-pole
   peak follower (attack/release coefficients above). No dB conversion.
3. **Bias**: smoothed manual bias 0x44 plus **auto-bias injection**
   `x = section2out·PreDrive + bias + AutoBiasDepth·env` — the envelope
   (depth stored NEGATED) pushes the tube's operating point against the
   signal, per channel (L uses L-env, R uses R-env) [D].
4. **Tube transfer**: linear-interpolated LUT lookup
   `idx = clamp((x − c20)·c24, 0, cap)` in the descriptor at 0x1c0 [D].
   Which table: Type ∈ {0,1,2} reads a resource id from `0x104cf31e8+Type·4`
   — the probe shows `{6,7,8}` there, i.e. **three runtime-loaded curve
   resources, not file-backed floats**. These three curves are **corpus
   material**: one render per Type (constant full-scale sine) pins each
   curve point-for-point; they are NOT decodable statically in this lane
   [B-negative, evidence header].
5. **AC coupling**: the tube output enters two cascaded leaky
   difference-integrators (`u = Δy + u·c`) — a 2nd-order low-frequency
   rolloff of the tube's DC-shifted output (coupling-cap model; structural
   reading [D], naming [H]).
6. **Tone post-network** (sections 3–4, coeffs 0xe0/0x11c …) on the coupling
   output, then `out = post·makeup + in·(1−w)` [D].
7. **CalcMain4x**: the same chain with the tube core (detector, bias, LUT,
   coupling) executed at 4× per frame; the Tone sections run once
   [D shape; per-stage placement of the 4× loop not fully read].

**Tube "model law"**: there is no closed-form tube equation — the tube is
the **curve LUT** (§4) plus the bias-dependent operating point and the
per-channel auto-bias envelope. Type/Bias/AutoBias/Drive all act through
those, not through re-derived coefficients [D].

## 4. What remains open (honest residuals)

- **The three curve LUT contents** (resource ids 6,7,8) — runtime-loaded,
  not statically decodable here; **corpus material** (render per Type).
- The Type id table base `0x104cf31e8` holds `{6,7,8}` as ints [B] — how
  `FUN_10189d0e0` maps id → table pointer (resource loader) not traced.
- UI names for Type 0/1/2: not found as strings near ATube; factory presets
  put Type 0 on "Broken Tube"/"Tube Trash"/"Distortion Gate", Type 1 on
  "Warm Tube"/"Discreet Beat Dirt", Type 2 on "Hot Driven Tape" [B] — the
  display names themselves remain [H].
- Consumers of LUT descriptors 0x1c8/0x330 and the ×6 attack coefficients
  (0x178/0x1a8) — built, no reader in the captured bodies [open].
- The shared Tone base-frequency writer (init funcs at this+100) — bands'
  base freqs (0x90/0xcc/0x108/0x144) not captured being written.
- The 445-line CalcMain4x tail beyond the capture cap — the 1x body is the
  reference; per-stage 4× placement partially read.
- Everything in §3 awaits the golden-render gate (no renders ran in this
  lane; COVERAGE row empty).

## 5. Confidence

- Setter laws, ballistic coefficient laws, bias/auto-bias injection, LUT
  transfer + descriptor layout, DryWet/makeup law, detector topology: **high**
  (single-source decompiles; XML parameter list matches the setter set 1:1).
- Coupling-integrator naming ("coupling caps"), Tone band center meanings,
  Type display names: **low** — graded [H]/[B-partial], do not build on them.
- No behavioral claim of any grade is made.
