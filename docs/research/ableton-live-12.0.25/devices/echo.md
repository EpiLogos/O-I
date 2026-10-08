# Echo — golden-render evidence (Live 12.0.25, macOS arm64)

Renders: `_v2` series plus the second-matrix E-series (master chain cleared,
volumes and clip gain pinned 1.0), 44.1 kHz / 16-bit AIFF export. Signal:
`signals/impulse.wav` (48k float32, single unit impulse at sample 100, 4 s).
Tempo pinned 120 BPM (1 beat = 0.5 s).

## Parameter pins (XML element names from `preset-time-travel.xml`)

Device element: `Echo` (factory preset "Time Travel Echo", `LastPresetRef` →
`Devices/Audio Effects/Echo/Clean Delay/Time Travel Echo.adv`).

| Point | Pin(s) | Values |
|-------|--------|--------|
| E1_IMPULSE_default_v2 | (none — full preset as stored) | Delay_SyncL/R=true, Delay_TimeL/R=0.1249999925, Delay_SyncedDivisionL=−4 / R=−3, Delay_SyncedSixteenthL/R=3, Delay_SyncModeL/R=2, Delay_TimeLink=true, Delay_Repitch=true, Feedback=0.5, ChannelMode=1, InputGain=3.17460632, OutputGain=1, Filter_On=true (HP 49.9997 Hz, LP 5000.026 Hz), Ducking_On=true (thr 0, rel 0.0999995), Modulation_AmountDelay=0.21875 (2 Hz synced, phase 90°), Reverb_Level=0.2460317463, Reverb_Decay=0.5, StereoWidth=1, DryWet=0.5873016119 |
| E2_DELAY2X_v2 | Delay_TimeL=0.249999985, Delay_TimeR=0.249999985 | everything else as E1 |
| E3_FB_HALF_v2 | Feedback=0.25 | everything else as E1 |
| E1b_v2 | (E1 set rebuilt identically; md5 9dde3b810845ecf2e5f4604f671f05a8, byte-equal to E1 build) | — |
| E5_FREEMODE | Delay_SyncL=false, Delay_SyncR=false, Delay_TimeL=0.25, Delay_TimeR=0.5 | everything else as E1 (incl. Delay_TimeLink=true) |
| E6_FREE2X | Delay_SyncL=false, Delay_SyncR=false, Delay_TimeL=0.5, Delay_TimeR=1.0 | everything else as E1 |
| E7_FB075 | Feedback=0.75 | everything else as E1 (sync mode) |
| E8_BARE | Filter_On=false, Ducking_On=false, Modulation_AmountDelay=0, Reverb_Level=0, DryWet=1 | everything else as E1 (sync mode, FB 0.5) |

Note: the E1/E2/E3/E7 lineage is a full-featured state — filter, ducking,
modulation and the internal reverb are ON. E8 is the bare-delay baseline.

## Measured echo structure (impulse analysis, ±8 ms / broad peak scan)

Direct (t0 ≈ 0.0021 s = wav sample 100): −13.83 dBFS peak, identical in both
channels, identical in E1/E2/E3/E5/E6/E7. Absent in E8 (DryWet=1 = 100% wet:
the dry path is removed, not summed).

### Sync mode (hop = 0.1875 s = dotted 1/16 at 120 BPM)

| Position | E1 (FB 0.50) | E2 (Time×2) | E3 (FB 0.25) | E7 (FB 0.75) | E8 (bare) |
|----------|--------------|-------------|--------------|--------------|-----------|
| echo1 L, t0+0.1875 s | −19.63 dBFS | −19.63 | −19.64 | −19.63 | **−2.50** |
| echo2 R, t0+0.3750 s | −23.86 | −23.86 | −23.86 | −23.86 | **−4.99** |
| echo3 L, t0+0.5625 s | −38.76 | −38.76 | −50.75 | **−31.73** | −18.37 |
| echo4 R, t0+0.7500 s | −40.68 | −40.68 | −52.36 | −33.72 | −17.90 |
| echo5 L, t0+0.9375 s | −54.60 | −54.60 | −74.75 | −40.68 | −30.09 |
| echo6 R, t0+1.1250 s | −56.68 | −56.51 | −76.33 | −42.56 | −30.77 |
| echo7 L, t0+1.3125 s | — | — | — | −49.10 | −43.99 |
| echo8 R, t0+1.5000 s | — | — | — | −49.97 | −43.74 |
| between-tap floor | −53.92 (tail) | −54.05 | −53.92 | −44 | **−90.31 (near-silence)** |

E8 tap grid is exact to ≤0.5 ms at every k×0.1875 + t0 (broad scan, no off-grid
peaks above −70 dBFS); E1/E7 grids match the same positions within ±1.5 ms.

### Free mode (E5: tL=0.25, tR=0.5 — E6: tL=0.5, tR=1.0)

| tap | E5 time | E5 peak (L/R) | E6 time | E6 peak |
|-----|---------|---------------|---------|---------|
| direct | t0+0.0000 | −13.83 / −13.83 | t0+0.0000 | −13.83 |
| 1 L | t0+**0.2491** | −18.63 | t0+**0.5000** | −19.25 |
| 2 R | t0+**0.4992** | −23.18 | t0+**1.0001** | −23.41 |
| 3 L | t0+0.7484 | −37.78 | t0+1.5001 | −38.01 |
| 4 R | t0+0.9985 | −39.91 | t0+2.0002 | −40.21 |
| 5 L | t0+1.2477 | −54.19 | t0+2.5002 | −54.32 |
| 6 R | t0+1.4978 | −55.50 | t0+3.0003 | −55.99 |
| 7 L | t0+1.7470 | −69.48 | t0+3.5003 | −69.48 |

## Behavioral reading

- **Delay time units — RESOLVED: stored unit = seconds (high confidence).**
  In free mode (`Delay_SyncL/R=false`) the taps land at exactly the stored
  values: E5 (0.25/0.5) → hop 0.250 s; E6 (0.5/1.0) → hop 0.500 s. Doubling the
  stored time doubles every measured tap time (E6 ≡ 2× E5 to ≤1.5 ms) with
  near-identical tap levels (≤0.5 dB). The synced-mode renders (E1/E2) that
  first showed "Delay_Time inert while synced" stand unchanged.
- **Pingpong structure — refined; E1's "own-time" reading refuted.** Across E1,
  E5, E6: successive taps alternate channels L-first, spaced by
  hop = min(Delay_TimeL, Delay_TimeR), and **both** channels' same-channel
  repeats land at 2×hop. E5 breaks the old reading: the L channel repeats at
  0.5 s although tL=0.25 (in E1 the L-L interval 0.375 happened to equal tL
  because tL was 2× tR there — every test had the slower time at exactly 2× the
  faster, so "each channel repeats at its own time" and "both repeat at 2×min"
  were indistinguishable until E5). Whether the slower channel's value matters
  beyond min(), and whether Delay_TimeLink=true forces the two stored times
  equal on load (E5/E6 both hopped at the L value), is **open** — needs a
  Delay_TimeLink=false pair with tL ≢ tR and ratio ≠ 2.
- **Channel mode** (high confidence on pattern): `ChannelMode=1` produces the
  pingpong train above; first two taps are first-pass (FB-invariant across
  E1/E3/E7 at identical level to 0.01 dB); `Feedback` enters the recirculated
  tail from tap 3.
- **Feedback semantics — insertion point RESOLVED (high confidence).** Tap
  levels at tap 3 across three FB values: E3 (0.25) −50.75, E1 (0.50) −38.76,
  E7 (0.75) −31.73. E1−E3 = 11.99 dB ≈ 2 applications × 6.02 dB
  (20log10(0.5/0.25)); E7−E1 = −7.03 dB = 2 applications × 20log10(0.5/0.75)
  exactly. Feedback applies once per hop in the recirculating path, and tap 3
  has accumulated exactly two FB applications (one per channel crossing).
  Per-hop math for E8 confirms the shape: same-channel deltas settle at
  −12.04 dB per 2 hops (= FB 0.5) with one −3.5 dB settling loss on the first
  recirculation.
- **D8 — bare-delay decomposition (E8 vs E1):**
  - Tap **grid**: identical with modulation and ducking on or off (±1.5 ms).
    `Modulation_AmountDelay=0.21875` at 2 Hz did **not** audibly modulate the
    synced tap times in E1 (no wobble beyond ±1.5 ms; E2's bit-identity
    corroborates). What AmountDelay actually modulates in synced mode: open.
  - **Filter** (HP 50 / LP 5k): the dominant level difference. Band-limiting
    the 1-sample impulse smears its peak: E8 tap1 −2.50 vs E1 −19.63 ≈ −17 dB
    of peak smear, and the first recirculation carries most of the remaining
    loss (E8's own first-recirculation −3.5 dB settling vs ≈−12.04 dB/hop-pair
    afterwards).
  - **Internal reverb** (Reverb_Level 0.246): the between-tap tail. E1 floor
    ≈ −54 dBFS; E8 floor ≈ −90 dBFS (scanner grouping floor, near-silence).
  - **Ducking** (thr 0): no visible change to the impulse tap table.
  - **DryWet=1** removes the direct entirely (no t0 peak in E8) — dry/wet is a
    crossfade, not a sum.

## Determinism (E4 / E1b pair, per protocol)

Sets rebuilt identically (md5 match). `cmp renders/E1_IMPULSE_default_v2.aif
renders/E1b_v2.aif` → **not byte-identical**. `analyze_render.py` pair stats:
`max|delta|=2 LSB16; >1LSB: 3.1169%; >8LSB: 0.00000%` — export dither, as with
the Glue pair.

## afinfo (one render)

```
File:           renders/E1_IMPULSE_default_v2.aif
File type ID:   AIFF
Num Tracks:     1
Data format:     2 ch,  44100 Hz, lpcm (0x0000000E) 16-bit big-endian signed integer
estimated duration: 256.000000 sec
```

## Evidence

- Renders: `harness/renders/E1_IMPULSE_default_v2.aif`, `E2_DELAY2X_v2.aif`,
  `E3_FB_HALF_v2.aif`, `E1b_v2.aif`, `E5_FREEMODE.aif`, `E6_FREE2X.aif`,
  `E7_FB075.aif`, `E8_BARE.aif` (+ `.asd`)
- Sets: `harness/live/e1-impulse-default.als`, `e2-delay2x.als`,
  `e3-fb-half.als`, `e1b.als`, `E5_FREEMODE.als`, `E6_FREE2X.als`,
  `E7_FB075.als`, `E8_BARE.als`
- Analyzer: `harness/analyze_echo_taps.py` (stereo broad peak scan + ±8 ms
  windowed tap table)
- Preset source: `evidence/devices/Echo/preset-time-travel.xml`
- Superseded contaminated first-pass renders: `harness/renders/contaminated-v1/`

## Confidence

- Hop time 0.1875 s / dotted-division sync at 120 BPM: **high** (burst timing exact to ~1 ms)
- Delay_Time inert while synced: **high** (E2 ≡ E1 at all six tap positions)
- **Delay_Time stored unit = seconds: high** (E5/E6 free-mode: 0.25→0.250 s, 2×→2×; exact)
- Pingpong L-first alternation, hop = min(tL,tR): **high** (E1/E5/E6)
- Same-channel repeats at 2×hop; E1 "own-time" reading refuted: **high** (E5)
- min() vs TimeLink force-equal on load: **open** (all tests had L = min; needs TimeLink=false)
- FB = linear gain, one application per hop, 2 applications by tap 3: **high** (three-point FB table: 11.99 and 7.03 dB both = 2× predicted)
- First two taps FB-invariant (first-pass): **high** (identical across FB 0.25/0.5/0.75)
- Bare-line baseline: grid exact, pure FB decay after one settling loss: **high** (E8)
- Filter = dominant level loss (~17 dB impulse-peak smear): **high** (E8 vs E1 tap1)
- Internal reverb = between-tap tail: **high** (−54 vs −90 dBFS floors)
- Modulation/ducking leave the synced tap grid unchanged: **high** (grid comparison); what AmountDelay modulates: **open**

## Limitations / unverified

- 44.1k/16-bit export of a 48k source: dither non-determinism (max |Δ| 2 LSB16);
  SRC ringing on a 1-sample impulse sets the direct's observed shape (−13.83 dBFS).
- Every free-mode test had the slower time at exactly 2× the faster (E1: 0.375/0.1875,
  E5: 0.5/0.25, E6: 1.0/0.5) — the pingpong topology beyond "hop = min, repeats at
  2×hop" is under-determined; a 3:1 ratio pair with TimeLink=false would pin it.
- FB range above 1.0 (self-oscillation) untested.
- SyncMode=2 semantics, Repitch behavior, gate/noise/wobble sections: untouched.
- No cross-check against the binary yet.

## Binary lane evidence (2026-10-07 — Ghidra 12.1.4, project `LiveRE`)

`OEchoProcessor` symbol-confirmed. Callback surface from trampoline symbols:
`Init, Reset, Exit, OnOn, OnX, OnRamp, OnAutomatableFloat, OnMidi,
CalcMainSingleSample` — a per-sample main kernel
(`CalcMainSingleSample`, real body FUN_10178a16c region; see
`evidence/binary/echo-decompilation.txt`, owner-private, not for
redistribution). Constant-level reconciliation of delay/feedback internals
is **remaining work** (backlog); no decompiled claim above contradicts the
measured tap tables.

## Rebuild coverage and E1 gate (2026-10-08, circuit-model lane)

`packages/live-dynamics/src/echo.rs` now carries the synced-time mapping, the
filter section and the E1-family tap model, gated by
`echo_e1_golden_gate` (tests/golden.rs):

- **Synced mapping** (`synced_time_s`): anchored on the one measured cell —
  (division −4, sixteenth 3, SyncMode 2) at 120 BPM → 0.1875 s = dotted 1/16.
  Structure: base = 2^(sixteenth−5) beats; SyncMode 2 = dotted ×1.5
  (triplet ×2/3 and straight ×1 stated unverified). **Division's independent
  effect is unmeasured** (both channels' divisions −4/−3 land on the same
  hop): modeled as ×1 and documented in code.
- **Filter section**: one-pole LP 5000.026 Hz → HP 49.9997 Hz at the preset
  pins, **stated as fitted** from the D8 smear analysis. Order note (stated
  inference): the measured −17.1 dB E1-vs-E8 impulse-peak smear requires the
  LP to act before the HP (LP→HP gives −5.9 dB of it at 44.1 kHz; HP→LP
  passes the onset at −0.06 dB and cannot smear). The residual ~−11 dB is
  attributed to the render path (SRC/dither) — boundary, not modeled.
- **E1 gate result** (E1_IMPULSE_default_v2.aif): six taps found within
  0.13–1.55 ms of the k×0.1875 s grid (±1 ms held on the first-pass taps;
  ±2 ms allowed on recirculated taps because the evidence itself records
  ±1.5 ms of modulation wobble on this grid — "E1/E7 grids match within
  ±1.5 ms"); all six levels match the dossier table to 0.01 dB and all five
  per-hop slopes to 0.01 dB (level constants are same-pin fitted to that
  table; the out-of-sample content is the time grid and the FB
  proportionality verified across E3/E7 in D4).
- **Boundary — OUT of the rebuild**: ducking (no visible impulse-table change
  in D8) and the internal reverb (the between-tap tail: −54 vs −90 dBFS
  floors) are not modeled; the gate reads tap peaks, which sit above that
  tail. Modulation is out (grid unchanged in D8). Per-channel measurement is
  required: the mono mixdown halves every single-channel tap by 6 dB and lets
  the reverb floor mask the late taps (audio.rs gained
  `read_aiff_i16_channels` for this).
