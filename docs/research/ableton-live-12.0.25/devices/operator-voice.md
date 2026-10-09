# Operator — voice synthesis (oscillator A + amp envelope), Live 12.0.25

**Status:** M6 phase 1 model landed and gated (`packages/live-dynamics/src/operator.rs`,
`operator_voice_golden_gate`). Renders: render lane 5, 2026-10-08. Probes
built earlier by a prior lane (`harness/live/OP2_SUSTAIN24.als` …
`OP5_KEY60.als`, same builder as M1, `build_set_midi.py`).

## Clip model (identical to M1, `midi-instruments.md`)

4 notes at beats 0/2/4/6 (= 0/1/2/3 s at 120 BPM), key 48 (C3, f0 =
130.8128 Hz), each 1.75 beats (0.875 s sounding), velocities 127/96/64/32 —
velocity is unrouted at the default patch, so all four notes are acoustically
identical (M1). OP5: single note, key 60 (C4, 261.6256 Hz). Analyzer:
`harness/analyze_operator.py`; fit script retained in the session log.

## Probe pins (stored `Manual` values; base = default patch)

| render | pin | stored value | meaning |
|--------|-----|--------------|---------|
| M1_OPERATOR | — (default) | Sustain 1, OscA Vol 1, Globals 0.1258925349 | baseline |
| OP2_SUSTAIN24 | `Operator.0/Envelope/SustainLevel` | 0.06309572607 (−24 dB) | separates sustain from DecayLevel → exposes the decay segment |
| OP3_OSCA050 | `Operator.0/Volume` | 0.5 (−6.02 dB) | oscillator A level |
| OP4_TRIM025 | `Globals/Volume` | 0.0314731337 (= default ×0.25) | device output trim |
| OP5_KEY60 | key 60, single note | — | pitch law + level key-invariance |
| OP6_DECAY | `Envelope/DecayTime` (first `DecayTime` in document order = `Operator.0/Envelope`) | 3000 (default 1000) | DecayTime stored→τ mapping; OP2's sustain pin repeated so the decay is audible |

Render format 44.1 kHz/16-bit stereo AIFF, 256.0 s. All four landed via
`lane3_render_relaunch.sh` (the runtime-swap driver wedged on Live's
Project-enforcement Save panel — see the session log; relaunch-with-document
is the reliable path for loose sets).

## Parameter table

The panel-facing descriptor table for this device lives at
`packages/live-dynamics/src/params.rs` (`OPERATOR`, 23 rows) — built from
`evidence/devices/Operator/default.xml` (+ `preset-choir.xml`, which widens
the observed WaveForm extent to 22), with this dossier's fitted laws in the
row notes: level knobs linear amplitude, the envelope topology above,
velocity unrouted by default (routing is the `MidiCtrl/VelDst` matrix, not
the VelScale knob). Oscillator shells store as `Operator.0`..`Operator.3`
(A..D), each holding `Envelope` (Times/Levels/Slopes + `TimeVelScale`),
`Tune` (Coarse/Fine/VelCoarseScale), `Volume`, `WaveForm`, `Phase`,
`Feedback`, `VelScale`, `KeyScale`, `IsOn`; the device output level is
`Globals/Volume`. Its ids are the document paths the OP probes pin; the
table is served to panels on `/api/device-descriptors` (`PANEL_DEVICES`),
and `params.rs` tests assert the probe pins and the τ = 0.120 s / 175 dB/s
references against it.

## Envelope topology (the OP2 finding)

The default-patch family sounded by oscillator A follows this segment map,
with stored levels A-Level/D-Level/S-Level/R-Level and times Attack/Decay/
Release:

1. **Attack** (0.1 ms stored): dB-linear rise from AttackLevel (−70 dB
   floor) to **DecayLevel** (1.0). Unresolvable at the pin — the first
   10 ms window is already at full level (M1/OP2 −0.27 dB rel).
2. **Decay** (1000 ms stored): falls from DecayLevel toward **SustainLevel**
   as an exponential **in amplitude**: `a(t) = sus + (peak − sus)·e^(−t/τ)`,
   τ = 0.120 s fitted at this pin. OP2 refuted both alternative shapes:
   dB-linear decay (residuals > 3 dB mid-curve) and a "sustain = output
   level knob" flat reading (predicts −56.77 dBFS steady; render −49.81).
3. **Sustain**: flat at SustainLevel. With DecayLevel = SustainLevel (the
   default patch) the decay is sonically inert — M1's organ-like plateau.
4. **Release** (400 ms stored): dB-linear from the **level at note-off** to
   ReleaseLevel (−70 dB) across ReleaseTime. The rate is therefore
   `level_db + 70) / 0.4 s`, not a constant: from 0 dB → 175 dB/s (M1, OP5),
   from ≈−25 dB → ≈115 dB/s (OP2). A fixed-rate reading is refuted by OP2's
   release windows.

Level knobs are **linear amplitudes**: OP3's ×0.5 and OP4's ×0.25 land on
`20·log10(ratio)` to the last 0.01 dB. Pitch is A440 equal temperament;
output level is key-invariant (OP5 −32.77 dBFS = M1).

## Fitted constants (all gated against the renders)

| constant | value | evidence | residual |
|----------|-------|----------|----------|
| RESIDUAL_GAIN | 0.25825 (−11.76 dB) | M1 peak −29.76 dBFS / stored −18 dB trim; held across OP3/OP4 | ≤0.01 dB (peak law, 3 renders) |
| DECAY_TAU_S | 0.120 s (at DecayTime 1000 ms) | OP2 full 10 ms-window curve | RMS 0.11 dB, max 0.22 dB |
| τ(DecayTime) mapping | linear through origin, τ ≈ 0.121 s per 1.0 s stored | OP6_DECAY: 0.3623 s at 3000 ms vs OP2 re-fit 0.1211 s at 1000 ms (ratio 2.99) | ±0.6 % on the proportional law (two pins) |
| release law | rate = (level + 70)/0.4 dB/s | M1/OP5: 175–180 dB/s; OP2: ≈115 dB/s | windows ≤0.62 dB |
| pitch law | f = 440·2^((k−69)/12) | M1 131.0 Hz, OP5 261.5 Hz (0.5 Hz grid) | ≤0.14 % |
| level laws | linear amplitude × | OP3 −38.79 (pred −38.79), OP4 −44.81 (pred −44.81) | ≤0.01 dB |

## DecayTime mapping (OP6_DECAY, 2026-10-08, render lane 3)

OP2's sustain pin repeated with `Operator.0/Envelope/DecayTime` pinned to
3000 (the first `DecayTime` in document order — the same element family the
OP2 pin used). Analyzer: `harness/analyze_operator_decay.py` (10 ms-window
exponential fit, peak free with sustain tied to it by the stored ratio;
**validated on OP2: τ = 0.1211 s** vs the documented 0.120).

- Note-1 100 ms windows (1.0–1.8 s): −33.82 / −36.01 / −38.14 / −40.22 /
  −42.23 / −44.14 / −45.92 / −47.53 dBFS — one clean exponential.
- **τ = 0.3623 s** (10 ms fit; 100 ms integration-modeled cross-check
  0.3629 s; fit residual −34 dB rel peak). Onset aligned at 1.000 s.
- **Law: τ ∝ DecayTime.** 0.3623 / 0.120 = 3.02; against the OP2 re-fit
  (0.1211): 2.99. Linear through the origin at **τ ≈ 0.121 s per 1.0 s
  stored** (two pins, ±0.6 %). The attack-floor hypothesis constant
  (τ = DecayTime/ln(1/AttackLevel) = 0.1241 s/s) is close but rejected at
  ~2.7 % — the mapping is proportional with a measured constant, not that
  derivation.

Level anomaly (OP2 and OP6, independent renders): the fitted audible peak is
**−32.75 dBFS in both** — ≈3.0 dB below M1's plateau (−29.76) — while the
onset→sustain span stays exactly the stored −24.00 dB. Pinning SustainLevel
shifts the whole voice down ≈3 dB, not just the tail: an unmodeled
loudness-compensation stage in Operator (open item below).

## Oscillator B — the modulator shell (OP7/OP8/OP9, 2026-10-09, night round 2 lane 1)

First behavioral probe of a shell beyond A. Base = the M1 clip unchanged
(`midi-operator.als`, transport loop 512 beats = the M1 render convention);
sets derived by the ET round-trip + gzip mtime=0 convention
(`harness/build_lane1_probes.py`, precedent `build_session_probes.py`).
"Switching B on" in the document = raising `Operator.1/Volume`: the factory
default stores `IsOn=true` on ALL four shells — the mute is the Volume floor
(−70 dB), not the switch (params.rs note, now render-confirmed). 1.0 is the
only audible pin the factory itself uses (`Operator.0/Volume` = 1). OP8/OP9
each add ONE pin on top of OP7 (a WaveForm pin at the −70 dB floor would be
blind — see the OP7 verdict). Analyzer: `harness/analyze_lane1.py` (the
`analyze_wm_sources` conventions; steady window [start+0.15, start+0.70],
Goertzel fundamental 90–180 Hz on note 1, harmonics h1..h8 over [1.15, 1.70]).

| render | pin (all else untouched) | steady RMS ×4 (vel 127→32) | vs M1 |
|--------|--------------------------|----------------------------|-------|
| M1_OPERATOR | — (default) | −32.77 ×4 flat | — |
| OP7_OSCB | `Operator.1/Volume` 0.0003162277571 → 1 | −32.87 ×4 flat (Δ −0.10 dB) | **no level change** |
| OP8_OSCB050 | OP7 + `Operator.1/Volume` → 0.5 (−6.02 dB) | −32.80 ×4 flat (Δ +0.08 dB vs OP7) | **still no level change** |
| OP9_WF22 | OP7 + `Operator.1/WaveForm` 0 → 22 | −32.87 ×4 flat (Δ +0.00 dB vs OP7) | **identical to OP7** |

Harmonic scan, note-1 steady [1.15, 1.70], dBFS:

| band | M1 | OP7 | Δ | OP8 | Δ vs OP7 |
|------|-----|-----|---|-----|----------|
| h1 (131 Hz) | −29.91 | −30.07 | −0.16 | −29.95 | +0.12 |
| h2 (262 Hz) | −84.04 | **−49.58** | **+34.46** | −55.24 | **−5.66** |
| h3 (393 Hz) | −88.42 | −73.80 | +14.62 | −81.67 | −7.87 |
| h4..h8 | −90.6…−95.3 | +1.8…+2.9 vs M1 (floor) | | −0.7…−1.4 vs OP7 | |

Findings:

1. **Osc B is a MODULATOR of A, not a second output voice** (at `Globals/
   Algorithm` 0). Raising B to 0 dB added no level (−0.10 dB — within the
   energy-conservation residual) and no new fundamental (131.0 Hz C3 +2.5
   cent, unchanged); instead the sidebands exploded: h2 +34.5 dB, h3 +14.6 dB.
   Sidebands at exactly 2·f0/3·f0 with RMS invariant = the 1:1 PM/FM pairing
   signature (Bessel identity keeps total energy in the carrier family).
   The brief's "silent until its Level is raised" reading is refuted: B is
   audible the moment its Volume leaves the floor — as spectral change on A.
2. **B's own envelope scales the modulation index.** B's factory envelope is
   a pluck (DecayTime 400 ms, SustainLevel 0.0630957 = −24 dB; A's is
   1000 ms/1.0). Time-resolved note 1 (100 ms windows): at onset h1 dips to
   −40.66 (10.9 dB below M1's h1) while h2 DOMINATES at −35.18 (+5.5 dB rel
   h1 — deepest index at B's envelope peak), recovering over ≈300 ms to the
   steady h2_rel = −19.5 dB as B's decay runs to its −24 dB sustain. Steady
   small-index reading: h2/h1 → β ≈ 0.21; the J2 ladder predicts h3_rel
   −45.0 dB, measured −43.7 (1.3 dB). If β ∝ B's linear amplitude the
   implied index constant is ≈3.35 — a reading from two pins, deliberately
   NOT fitted into the crate (zero-fitted-scalars rule).
3. **B's Volume follows the linear-amplitude law as a modulation amount**
   (OP8): halving it moved h2 −5.66 dB (J1 ∝ β predicts −6.02; residual
   0.36 dB), β 0.212 → 0.109 (halving predicts 0.106), h1 +0.12 dB back
   toward M1, total RMS +0.08 dB (still invariant), onset dip shallower
   (−33.07 vs −33.68 first window). h3's −7.87 (vs −12 predicted for J2 ∝ β²)
   is the one outlier — h3 sits 12–26 dB above the other floor bands there;
   leakage/floor caveat, medium confidence.
4. **`WaveForm` extent tail 22 = the user-wave page** (OP9 null as the
   positive control it turns out to be): pinning 22 changed nothing (≤0.03
   dB on every band, envelope + release identical). Document anchor: in the
   factory default (WF=0) `UserHarmonics` holds only h0=1 — a sine; the
   choir preset's WF=22 shells carry rich `UserHarmonics` (h0..h15/h64). So
   WF22 selects the user-drawn wave, whose default content IS a sine — the
   modulator waveform was unchanged, and the render agrees exactly.
5. Velocity stays flat in all three renders (unrouted VelDst — consistent
   with M1/VD sweep).

What remains open:

- **The index law**: β as a function of B's amplitude, shell ratio, and
  envelope — and PM-vs-FM sign/phase discrimination — is not nameable from
  audio alone at these pins; needs a ratio sweep (B Coarse 2 vs A) or a
  binary cross-check. The ≈3.35 constant is two-pin evidence, not a law.
  (Three level pins now exist — see the OP10/OP11 section below; strict
  ∝Volume is refuted at the third point.)
- **`Globals/Algorithm`**: probed at the two factory-observed extremes
  (0 → 7, OP11 below; the OP12 discriminating probe with C/D audible is
  still a null — see the OP12–OP14 section): acoustic null at these pins
  under both C/D regimes. Whether ANY index re-routes audibly is still open
  beyond {0, 7}.
- **Shells C/D**: C probed at one pin (OP13: C on at 1.0, Algorithm 0) —
  byte-flat M1; C mirrors B, a modulator shell, not an output voice. D
  untested alone; C/D together at Algorithm 7 (OP12) contribute nothing
  audible either.
- **WaveForm labels 0..21**: unknown; OP9 pins only the extent tail (22).
  Whether a mid-extent wave changes a MODULATOR's spectrum is untested.
- `Phase`, `Feedback`, `Fine` on shell B: untouched (0/0/0), semantics open
  per the params.rs table. (Shell A's `Feedback` probed at 0.5 and 25 of
  0..100 — OP14, OP15: flat to the −84 dBFS floor at both; what stays open
  is whether the law lives on a routed shell — B feedback into A — rather
  than the carrier, and the 26..100 stretch.)

Confidence:

- B = modulator of A at Algorithm 0, not an output voice: **high** (RMS
  invariance + spectral redistribution + onset-index behavior, consistent
  across two level pins).
- B's Volume = linear-amplitude modulation amount: **high at h2** (−5.66 vs
  −6.02 dB), **medium at h3** (floor/leakage outlier noted above).
- B's default envelope drives the onset index: **high** (time-resolved h1/h2
  ladder, settles exactly across B's 400 ms decay).
- WF22 = user wave, default sine: **high** (null render + document anchor in
  both factory presets); the full label map stays open.

## Index law at a third pin + the Algorithm cell (OP10/OP11, 2026-10-09, op-alg lane)

Both probes derive from OP7 by one pin each (`harness/build_lane3_alg_probes.py`,
same ET + gzip mtime=0 convention); renders via `with_live_lock.sh` +
`lane3_render.sh`; analyzer `harness/analyze_lane3_alg.py` (the analyze_lane1
conventions, plus an exact J1/J0 Bessel inversion of the h2/h1 ratio and a
90–2000 Hz Goertzel partial scan).

**OP10_BV025 — `Operator.1/Volume` → 0.25 (−12.04 dB), third β point.**

| pin | B Volume | h1 dBFS | h2 dBFS | h3 dBFS | β (exact J1/J0) | vs ∝Volume |
|-----|----------|---------|---------|---------|-----------------|------------|
| OP7 | 1.0 | −30.07 | −49.58 | −73.80 | 0.2104 | — |
| OP8 | 0.5 | −29.95 | −55.24 | −81.67 | 0.1086 | +3.2 % |
| OP10 | 0.25 | −29.92 | −60.71 | −85.76 | 0.0577 | +9.7 % |

1. **β is near-linear in B's Volume but NOT strictly proportional.** Halving
   the level divides β by 0.516 / 0.531 (not 0.500): h2 sits +0.27 dB (OP8)
   then **+0.75 dB (OP10)** above the proportional prediction — outside the
   0.01 dB level law of the render chain. A Volume-offset line,
   **β ≈ 0.2036·V + 0.0068**, fits all three pins to ≤0.2 % — stated as a
   reading, deliberately not fitted into the crate (zero-fitted-scalars
   rule; the intercept is also unverifiable near the −70 dB floor, where it
   predicts h2 ≈ −79 dBFS, at the dither floor). Steady RMS stays invariant
   (−32.78, +0.10 vs OP7 = the M1 residual family): the Bessel energy
   identity holds at every pin.
2. **h3 is NOT on the J2 ladder — confirmed, and worse than leakage.**
   h3−h2 measures −24.2 / −26.4 / −25.1 dB across the three β (nearly
   constant) while the small-index J2 ladder predicts −25.6 / −31.3 / −36.8.
   h3 carries a large β-independent (or different-order) component ~25 dB
   below h2; β estimated from h3 is unusable at these pins. (OP10's h2 at
   −60.7 dBFS is 23 dB above the M1 floor, so this is not floor-limited
   measurement.)

**OP11_ALGX — `Globals/Algorithm` 0 → 7 (B Volume 1, C/D at the −70 dB
floor).** 7 is the only other factory-observed stored value
(`preset-choir.xml`; params.rs has no Algorithm row — extent evidence is
{0, 7}). Result: **acoustic null to ≤0.02 dB on every measure** — per-note
steady RMS +0.00 ×4, h1..h4 identical (h4 −87.70 vs −87.72), the 90–2000 Hz
partial scan reproduces every OP7 peak within 0.01 dB, and the note-1 onset
profile (8 × 100 ms) is identical (B still drives the onset index). **No new
fundamental, no output voice for B, no spectral shape change.** B-as-carrier
is refuted for both factory-observed extremes. Honest limit: with C/D at the
−70 dB floor the null cannot separate "Algorithm is sonically inert" from
"Algorithm only re-routes the muted C/D shells" — the discriminating probe
(Algorithm 7 with C/D raised) is a follow-up lane.

## Shells C/D, the Algorithm cell with audible C/D, and A feedback (OP12–OP14, 2026-10-09, operator-probes lane)

All three probes derive from OP7 (`harness/build_op_probes2.py`, same ET +
gzip mtime=0 convention); renders via `with_live_lock.sh` + `lane3_render.sh`
(256 s family spec); analyzer `harness/analyze_op_probes2.py` (the
analyze_lane1 / analyze_lane3_alg conventions: steady RMS ×4, h1..h4 at
[1.15, 1.70], 90–2000 Hz partial scan, onset profile). The shared scan floor
(146/122/110/154/90/168 Hz at −59…−66 dBFS) appears identically in every
render including M1 — it is the render floor family, not probe content.

**OP12_ALG7CD — the OP11 discriminating probe: `Globals/Algorithm` → 7 AND
`Operator.2/Volume`, `Operator.3/Volume` → 0.25 each.** Result: **still a
null, to the family residual.** Steady RMS +0.15 ×4 vs OP7 (the same
magnitude as OP7's −0.10 voice-loudness residual vs M1); h1..h4 within
0.13 dB of OP7 (h2 −49.54 vs −49.58); β = 0.2089 vs 0.2115 (−1.2 %); the
partial scan adds **no peak** above the shared floor family; the onset
profile keeps B's signature (−33.1 first 100 ms — B still drives the onset
index). **Verdict: at Algorithm 7, C/D raised to 0.25 do not become output
voices and do not measurably re-route the A+B pair.** C/D-as-carrier at this
pin is excluded to the −59 dBFS scan floor. Honest extent: {0, 7} on the
Algorithm index, C/D at one level (0.25); the null now covers "Algorithm
re-routes audible shells" for the only two indices with stored factory
evidence.

**OP13_OSCC — shell C on: `Operator.1/Volume` → the off floor
(0.0003162277571), `Operator.2/Volume` → 1.0.** Result: **byte-flat M1** —
steady RMS −0.00 ×4, h1..h4 within 0.1 dB (h1 −29.91, h2 −84.00 at the
dither floor), scan = the floor family. **Shell C at Algorithm 0 is a
modulator shell exactly like B (OP7's verdict extends): its Volume at 1.0
is acoustically inert when unrouted, and the expected "C adds its own sine
/ level law vs A" does not exist at Algorithm 0.** A's −70 dB off floor
value is confirmed as the muted-shell constant (carried by C/D in the OP7
set).

**OP14_AFB050 — Osc A self-feedback: `Operator.0/Feedback` → 0.5
(params.rs range 0..100 → 0.5 % of scale), B off (M1 voice).** Result:
**byte-flat M1** — RMS −0.00 ×4, h2 −84.02 vs −84.04, scan = floor family.
**Feedback 0.5 enriches nothing above the −84 dBFS reading floor; no
self-FM index is readable at this pin.** The pin was chosen too small for
the 0..100 range — the discriminating follow-up is a larger fraction
(e.g. 25 or 50), which would put h2 near the OP10 ladder where β is
readable.

Render-lane note: the committed `lane3_render_relaunch.sh` passed only the
renders dir to `lane3_export.applescript` (whose `on run` indexes item 2
unconditionally — argv gap, fixed 2026-10-09), and the driver's
`stepSlider` read slider values through an unguarded `as string` coercion
that aborted post-click on some panel states while the export landed anyway
(both OP12 attempts exited 8 with a correct 256 s file on disk; the first,
4.875 s, predates the length step). The driver now reads AXValue with a
guarded fallback; OP13/OP14 exported clean (exit 0).

## A feedback at the larger pin (OP15, 2026-10-09, operator-probes lane)

**OP15_AFB25 — `Operator.0/Feedback` → 25, B off (the M1 voice).** The
OP14-predicted discriminator. The set XML settles the scale question:
Feedback's `MidiControllerRange` is Min 0 / Max 100, so Manual values sit on
the displayed 0..100 scale — 25 is 25 %, 50× the OP14 pin (the brief's
"stored 0..1" reading is refuted; 0.25 would have been 0.25 %, smaller than
OP14). Built by `harness/build_op15.py` from OP7 (same ET + gzip mtime=0
convention, verify pass asserts B off + A_fb=25); rendered via
`with_live_lock.sh` + `lane3_render.sh` (exit 0 first attempt, 256 s);
analyzer `harness/analyze_op15.py` (the OP14 conventions, h1..h6, plus a
h3/h2 J2/J1 cross-check). Result: **flat M1 again** — steady RMS −0.00 ×4;
h1 −29.91 unchanged; h2..h6 within 0.1 dB of M1's dither-floor values
(h2 −84.02, h3 −88.36, h6 −93.24); β_h2 = 0.0039 (floor); the 90–2000 Hz
scan returns the identical floor family peak-for-peak; the onset profile is
byte-identical to M1. **Carrier self-feedback at Algorithm 0 does not
enrich a plain sine at 25 % of its range: the Feedback→tone null now spans
a 50× interval ({0.5, 25} of 0..100), to the −84 dBFS reading floor.**
Extent-honest verdict: Feedback is either heavily rescaled below its stored
number or inert on an unrouted carrier — the place a DX-style feedback law
can still live is the routed path, feedback of a *modulator*: `Operator.1/
Feedback` with B → A (OP7's audible chain) is the named next discriminator;
an A Feedback 100 pin would seal the carrier null across the full range.

## Round 6 discriminators: the carrier null seals; shell D mirrors C (OP16/OP17, 2026-10-09, op-r6 lane)

Both probes derive from OP7 by one and two pins (`harness/build_op16_17.py`,
the build_op15 ET + gzip mtime=0 convention, each with a verify pass);
rendered via `with_live_lock.sh` + `lane3_render.sh` (both exit 0 first
attempt, 256 s); analyzer `harness/analyze_op16_17.py` (the OP15 conventions:
steady RMS ×4, note-1 h1..h6 at [1.15, 1.70], β from h1/h2, 90–2000 Hz scan,
onset profile), with OP7/OP13/OP15 carried in the family so the verdicts are
direct comparisons.

**OP16_AFB100 — `Operator.0/Feedback` → 100, B off (the M1 voice).** The
top of the MidiControllerRange (Min 0 / Max 100 — the OP15 scale reading,
maxed). Result: **byte-flat M1.** Steady RMS −0.00 ×4; h1 −29.91 unchanged;
h2..h6 within 0.1 dB of M1's dither-floor values (h2 −84.02, h3 −88.38);
β_h2 = 0.0039 (floor — the printed "self-FM cross-check" ratio reads dither,
not signal); the scan returns the identical floor family peak-for-peak; the
onset profile is byte-identical to M1. **The carrier-feedback null seals
across the full stored range: {0.5, 25, 100} of 0..100, a 200× span, all
acoustically zero on an unrouted carrier.** Feedback on a lone Algorithm-0
carrier is inert at any stored value; only a routed-feedback pin
(`Operator.1/Feedback`, B → A) can still carry a DX-style law.

**OP17_OSCD — shell D on: `Operator.1/Volume` → the off floor,
`Operator.2/Volume` → the off floor, `Operator.3/Volume` → 1 (Algorithm 0
unchanged).** The exact OP13 state with D in C's seat. Result: **byte-flat
M1** — steady RMS +0.00 ×4 (also +0.00 vs OP13); h1..h6 within 0.09 dB of
M1 (h1 −29.91, h2 −84.04 at the dither floor); β at the floor; the scan is
identical to M1's, peak for peak; onset byte-identical. **Shell D mirrors C,
not B: at Algorithm 0 with A as the only carrier, D's Volume at 1.0 is
acoustically inert — no own sine, no level change, no sidebands. Only B
routes into A at Algorithm 0 (OP7's +34.5 dB h2 remains the sole audible
shell signature); C and D are silent shells at these defaults.**

## Gate residuals (operator_voice_golden_gate, 2026-10-08)

Thresholds (stated in `tests/golden.rs` before analysis): steady per-note
RMS ±0.5 dB; release 20 ms windows ±2.0 dB while above −80 dBFS; OP5
fundamental ±1 % / level ±0.5 dB; M1 h2 ≥60 dB below h1.

| render | steady Δ (4 notes) | release Δ (6 windows) |
|--------|--------------------|-----------------------|
| M1 | 0.00 / 0.00 / 0.00 / −0.00 | +0.05 … +0.62 |
| OP2 | −0.10 / −0.09 / −0.10 / −0.12 | +0.05 … +0.62 |
| OP3 | 0.00 ×4 | — |
| OP4 | 0.00 ×4 | — |
| OP5 | 0.00 (single note), 261.50 Hz | — |

M1 harmonics: h1 −29.76 dBFS, h2 −92.70 dBFS (63.0 dB below — pure sine at
key 48).

## What did not fit / open items

- **Flat-sustain envelope** (the pre-render model): refuted by OP2. Sustain
  is a *decay target*, not an output level; the gate's OP2 block records the
  revision. The decay segment's behavior when DecayLevel ≠ SustainLevel was
  previously untested — it is now measured at one pin and modeled.
- **Fixed release rate** (175 dB/s): refuted by OP2; the rate is set by the
  note-off level (time-normalized to ReleaseTime).
- **τ(DecayTime, levels) mapping**: **RESOLVED for direction and rough law
  (2026-10-08, OP6_DECAY)** — linear through the origin, τ ≈ 0.121 s per
  1.0 s stored (two pins, ±0.6 %); the attack-floor constant (0.1241 s/s) is
  near but rejected at ~2.7 %. Still open: a third pin (e.g. 500 ms) to
  test curvature, and the **DecayLevel ≠ SustainLevel decay-target case**
  (both pins hold DecayLevel = 1.0).
- **Pinned-sustain voice shift**: the OP2/OP6 renders sit ≈3.0 dB below the
  M1 plateau at all points (fitted peak −32.75 dBFS in both) with the stored
  −24.00 dB span intact — Operator compensates voice loudness when the
  envelope levels change. Mechanism open; the crate's peak law uses the M1
  constant and would read ≈3 dB hot on pinned-sustain patches.
- **Waveform beyond sine**: at key 60 (OP5) a faint h2 appears at ≈−88 dBFS
  (−58 dB below h1; at key 48 h2 sits at the −93 dBFS dither floor). Whether
  that is Operator waveshaping at higher pitch or export-dither correlation
  is open — 5 dB above the floor, inaudible, and the gate only asserts the
  key-48 floor. h3..h10 stay at/below the floor in all renders.
- **Attack shape**: stored 0.1 ms — below export resolution at any probe in
  this lane; modeled dB-linear, unverified (irrelevant at ≤1 ms pins).
- **AttackLevel's role as a start floor** is inferred from the stored value
  and the release path (release ends at the same −70 dB floor); a separate
  AttackLevel pin would confirm it.

## Confidence

- Level knobs linear (osc A Volume, Globals Volume): **high** (exact to
  0.01 dB, two independent probes + baseline).
- Pitch law + key-invariant level: **high** (two keys, ≤0.14 % with a 0.5 Hz
  scan grid).
- Envelope topology A→D→S→R with these level targets: **high** (M1/OP3/OP4
  exact; OP2 onset + steady + release all consistent with one model).
- Decay shape exp-in-amplitude, τ = 0.120 s: **high** (full-curve fit
  0.11 dB RMS at one pin; τ ∝ DecayTime confirmed at a second pin,
  ratio 2.99 vs 3.0).
- τ(DecayTime) proportionality: **medium-high** (two pins, ±0.6 %; no
  third pin, and the 0.121 constant is measured, not derived).
- Release time-normalized dB-linear: **high** (two level regimes, ≤0.62 dB).
- Sine purity at key 48: **high** (h2..h10 at dither floor); at key 60:
  **medium** (h2 ≈ −88 dBFS, cause open).
- Algorithm 0/7 nulls (OP11/OP12): **high** for these pins — the OP12 null
  holds with C/D audible (three independent render chains agree to ≤0.15 dB).
- Shell C inert at Algorithm 0 (OP13): **high** (byte-flat M1).
- Shell D inert at Algorithm 0 (OP17): **high** (byte-flat M1, ±0.09 dB
  h1..h6, scan identical peak-for-peak) — only B routes into A at these
  defaults.
- Carrier Feedback null at {0.5, 25, 100} of 0..100 (OP14/OP15/OP16): **high
  across the full stored range** (200× span, to the −84 dBFS floor); the
  routed-modulator case (`Operator.1/Feedback`, B → A) is untested.

## Evidence

- Renders: `harness/renders/OP2_SUSTAIN24.aif`, `OP3_OSCA050.aif`,
  `OP4_TRIM025.aif`, `OP5_KEY60.aif`, `OP6_DECAY.aif` (+ `.asd`), baseline
  `M1_OPERATOR.aif`; sets `harness/live/OP2_SUSTAIN24.als` …
  `OP5_KEY60.als`, `OP6_DECAY.als`.
- OP12–OP14 renders: `harness/renders/OP12_ALG7CD.aif`, `OP13_OSCC.aif`,
  `OP14_AFB050.aif`; sets `harness/live/OP12_ALG7CD.als`, `OP13_OSCC.als`,
  `OP14_AFB050.als` (built by `harness/build_op_probes2.py` from OP7);
  analyzer `harness/analyze_op_probes2.py`.
- OP15 render: `harness/renders/OP15_AFB25.aif`; set
  `harness/live/OP15_AFB25.als` (built by `harness/build_op15.py` from
  OP7); analyzer `harness/analyze_op15.py`.
- OP16/OP17 renders: `harness/renders/OP16_AFB100.aif`,
  `OP17_OSCD.aif`; sets `harness/live/OP16_AFB100.als`,
  `OP17_OSCD.als` (built by `harness/build_op16_17.py` from OP7, each with
  a verify pass); analyzer `harness/analyze_op16_17.py`.
- Analyzers: `harness/analyze_operator.py`,
  `harness/analyze_operator_decay.py` (τ fit; self-validates on OP2);
  gate:
  `packages/live-dynamics/tests/golden.rs::operator_voice_golden_gate`;
  model: `packages/live-dynamics/src/operator.rs`.
- Render-lane note: OP4's export dialog was found open (a prior lane died
  mid-export); the runtime-swap driver raised Live's Project-enforcement
  Save panel and wedged the instance; all four renders completed through
  `lane3_render_relaunch.sh` (guarded osascript quit → relaunch with the
  set as launch document). No pkill; no unguarded keystroke.
