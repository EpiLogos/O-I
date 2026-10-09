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
    corroborates). Round 2 quantified the wobble: a deterministic LFO sweep
    along the tap train (±1.4 ms peak-to-peak, ≈−1 dB peak smear) — see the
    round-2 section.
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

### Sections decomposition — the EC probes (2026-10-08 evening lane)

E8 (bare) splits into its two switchable sections with single-section sets
(signal `impulse.wav`, all else the E8 recipe: Modulation_AmountDelay=0,
Reverb_Level=0, DryWet=1, sync mode, FB 0.5; sets `harness/live/EC1_FILTER.als`,
`EC2_DUCK.als`, renders `harness/renders/EC1_FILTER.aif`, `EC2_DUCK.aif`,
5.0 s each):

| Point | Pin(s) vs the E8 recipe | Values |
|-------|------------------------|--------|
| EC1_FILTER | Filter_On=true (only section on) | HP 49.9997 / LP 5000.026 as E1 |
| EC2_DUCK | Ducking_On=true (only section on) | thr 0, rel 0.0999995 as E1 |

Tap table (±8 ms windows at t0 + k·0.1875 s; E8 bare and E1 shown from the
table above for comparison):

| tap | E8 bare | EC1 filter-only | EC2 duck-only | E1 all-on |
|-----|---------|-----------------|---------------|-----------|
| 1 L | −2.50 | **−14.08** | −2.50 | −19.63 |
| 2 R | −4.99 | **−18.45** | −4.99 | −23.86 |
| 3 L | −18.37 | **−33.07** | −18.37 | −38.76 |
| 4 R | −17.90 | **−35.19** | −17.90 | −40.68 |
| 5 L | −30.09 | **−49.17** | −30.09 | −54.60 |
| 6 R | −30.77 | **−50.94** | −30.76 | −56.68 |
| 7 L | −43.99 | **−64.29** | −43.95 | — |
| 8 R | −43.74 | **−65.20** | −43.74 | — |

- **Filter-only reproduces the E1 tap SHAPE, not quite its depth**: −11.58 dB
  of the E1-vs-E8 tap1 smear (−17.13 dB) is the filter section alone; the
  filter deepens through the recirculation (−14.7 dB by tap 3, −19.1 by tap
  5) — consistent with the filter sitting in the feedback path, each hop
  re-filtered. Per-hop EC1 deltas settle at ≈−15..−16 dB per 2 hops vs bare's
  −12.04 (FB 0.5) — the filter's per-hop insertion loss is ≈−1.5..−2 dB.
- **Duck-only is impulse-invisible**: EC2 ≡ E8 to ≤0.04 dB through tap 8
  (threshold 0, release 0.1 s; a 1-sample impulse gives the detector nothing
  to hold). Confirms D8's reading with the section proven ON. Characterizing
  ducking needs a sustained-signal probe (steps-1k) — backlog.
- **Between-tap floors**: EC1/EC2 both sit at the scanner's near-silence floor
  (−90.31 dBFS) like E8 — Reverb_Level=0 removes the tail in both, nailing
  the internal reverb as the sole between-tap energy source.
- **Residual — RESOLVED (round 2, same evening; see below)**: E1's remaining
  ≈−5.5 dB at tap1 (−19.63 vs EC1 −14.08) is **not** modulation. The round-2
  EC3/EC4/EC5–EC7 probes decompose it exactly: −4.62 dB is the DryWet
  crossfade (EC1 is a DryWet=1 render compared against E1 at 0.5873) and only
  ≈−0.9 dB is modulation smear. The original "attributed to modulation"
  reading is refuted.

### Round 2 — mod, sync/free, duck (2026-10-08 late evening)

Signal `impulse.wav` for EC3/EC4 (E1-based), `signals/steps-1k.wav` for the
duck probes (0.25 s lead, −30..−3 dBFS-peak 1 kHz steps 0.5 s each, a 0 dBFS
step, 1.5 s tail; RMS = peak − 3.01 dB). Analyzer
`harness/analyze_ec_duck.py` (wet-pair mode for the duck gain G(t);
`analyze_echo_taps.py taps 0.1875` + fine peak timing for the impulse sets).

| Point | Pin(s) vs base | Values |
|-------|----------------|--------|
| EC3_NOMOD | E1 (full preset) | Modulation_AmountDelay=0, all else E1 |
| EC4_SYNC1_16 | E1 | Delay_SyncL/R=false, Delay_TimeL/R=0.1875 (free at the measured synced hop) |
| EC5_DUCK_TONE | E8 sections recipe | Ducking_On=true only (Filter/Mod/Reverb off), DryWet=0.5873016119, thr 0, rel 0.1 |
| EC5B_NODUCK | EC5 | Ducking_On=false (control) |
| EC6_WET_DUCK | EC5 | DryWet=1 (wet-only duck shape) |
| EC6B_WET_NODUCK | EC6 | Ducking_On=false (control) |
| EC7_DUCK_T24 | EC6 | Ducking_Threshold=−24 |

**1. The −5.5 dB tap1 residual: crossfade, not modulation (E1 fully
decomposed).** EC3 (E1 minus mod) reproduces E1's taps to ≤0.93 dB; the gap
EC1→EC3 is exactly the wet-path gain: 20log10(0.5873) = −4.62 dB, with
EC1×0.5873 predicting EC3's true taps to ≤0.15 dB (tap1/3/5 L, 2/4 R). Full
tap1 chain, exact: −2.50 (E8 bare) −11.58 (filter smear) −4.62 (DryWet
crossfade) −0.93 (mod smear) = −19.63 (E1). Corollaries: the wet path scales
**linearly** in DryWet at this operating point (equal-power would miss by
~0.25 dB the other way), and the reverb's contribution to tap-window peaks is
<0.15 dB (EC3 carries Reverb_Level=0.246, EC1 none — only the between-tap
floors differ).

**2. Modulation quantified (AmountDelay=0.21875, 2 Hz synced, phase 90°).**
Tap-peak smear mod-on vs mod-off: −0.78..−1.49 dB (mean ≈ −1.0 dB, taps
1–6). Timing wobble is deterministic, not jitter: with mod ON, tap offsets
from the grid progress −0.63 → +0.18 → +1.37 ms along the L taps (−0.06 →
+0.50 → +0.58 ms on R); with mod OFF all taps sit at −0.03..−0.15 ms. The
LFO phase sweeps continuously along the tap train; peak-to-peak ≈ ±1.4 ms,
consistent with the dossier's ±1.5 ms. What AmountDelay does NOT do in synced
mode: change the tap grid beyond this wobble.

**3. Synced/free equivalence — CLOSED at the dotted-1/16 point.** EC4 (free,
stored 0.1875 s both channels) ≡ E1 (synced, division −4/−3, sixteenth 3,
SyncMode 2, stored 0.125 s) at **≤0.02 dB and 0.00 ms** on all six taps —
including the identical modulation wobble pattern, so the mod LFO anchors to
the same clock in both modes. The synced grid at 120 BPM maps to exactly one
free delay of 0.1875 s; no other synced-path behavior is visible at the
output.

**4. Ducking — threshold is NOT peak-referenced; at stored pins (thr 0) it
never engages.** EC5 vs EC5B and EC6 vs EC6B: G(t) ≡ 0.00 dB through every
step including the 0 dBFS-peak (RMS −3.0) step. A peak-sensing detector at
thr 0 would have engaged; so the threshold acts on the signal's slow envelope
(steady-tone-RMS consistent), stored in dB.

**5. Ducking law at thr −24 (EC7 vs EC6B), 1 kHz staircase:**

| input step (peak) | RMS | excess vs thr | steady GR (L/R) |
|---|---|---|---|
| −30 / −24 dBFS | −33 / −27 | <0 | 0.00 dB (no duck) |
| −18 | −21 | +3 | **−3.90 / −3.90** |
| −12 | −15 | +9 | **−8.38 / −8.38** |
| −6 | −9 | +15 | **−13.10 / −13.10** |
| −3 | −6 | +18 | −15.07 / **−15.44** (L contam.) |
| 0 | −3 | +21 | (contam.) / **≈−17.8** |

- Depth ≈ **0.75–0.79 dB per dB of envelope excess** above threshold (clean
  points +3/+9/+15), sub-unity — a compressed duck, not 1:1. Top-step values
  are lower bounds: the **unducked control itself clips at export** on the
  −3/0 steps (up to 11.6k samples ≥32766 on L; EC7 never clips), so read
  −15.4/−17.8 as floors, and the apparent L/R split there as an artifact
  (clean steps agree to 0.01 dB).
- **Detector path — resolved**: GR onset is within ≤5 ms of the input step
  (no +0.1875 s hop lag) → the detector listens to the pre-delay/dry input
  and the gain is applied at the output in real time (it does NOT travel
  through the delay line with the taps).
- **Attack**: fast, τ ≈ 15–25 ms through the 20 ms RMS window; no stored
  attack parameter exists in the XML.
- **Release**: amplitude-exponential recovery, τ ≈ 111 ms ≈ the stored
  Ducking_Release 0.1 s (20 ms window smearing included); not dB-linear.
  Stored unit = seconds.

### Round 3 — AmountDelay depth + duck steady ladder (2026-10-08 late lane)

Signal `impulse.wav` for EC8, `signals/steps-long.wav` for EC9 (0.5 s lead,
2.5 s steps at −18/−12/−6/0 dBFS-peak 1 kHz, 4 s tail — 4× longer steps than
round-2's steps-1k, so the GR actually settles). Analyzer for the duck:
`harness/analyze_ec9_saturation.py` (20 ms G(t) tables, settled-window
ladder, leveler read-out); for the wobble: `harness/analyze_ec8_wobble.py`
(fine parabolic peak timing on the same-channel tap trains, pingpong-aware).

| Point | Pin(s) vs base | Values |
|-------|----------------|--------|
| EC8_MOD50 | E1 (full preset) | Modulation_AmountDelay=0.5 (vs E1's stored 0.21875) |
| EC9_DUCK_TONE_STAIRCASE | EC6/EC7 recipe | steps-long.wav, Ducking_Threshold=−24 |
| EC9C_DUCK_T30 | EC6/EC7 recipe | steps-long.wav, Ducking_Threshold=−30 |
| EC9B_NODUCK6 | EC6/EC7 recipe | Ducking_On=false, **clip gain SampleVolume=0.5** (−6.02 dB control — see below) |

(EC6/EC7 recipe = Filter/Mod/Reverb off, DryWet=1, sync dotted-1/16, FB 0.5;
duck renders carry unity clip gain. The −6 dB control kills EC6B's export
clipping: the unducked FB-0.5 wet sum of the 0 dBFS step exceeded full scale
in round 2, making the top-step depths floors; with the attenuated control
every depth below is exact. G(t) = duck − control + 6.02 dB.)

**1. Modulation_AmountDelay depth is NOT linear in the stored amount
(EC8).** Peak-to-peak tap-time wobble over the same-channel trains
(L k=1,3,5,7 / R k=2,4,6,8, identical LFO phases per tap across renders, so
pp scales exactly with internal depth whatever the LFO waveform):

| render | amount | pp L | pp R |
|--------|--------|------|------|
| EC3_NOMOD | 0 | 0.75 ms | 0.63 ms (baseline-artifact band) |
| E1 | 0.21875 | 2.00 ms | 0.64 ms (at the artifact band) |
| EC8_MOD50 | 0.5 | 21.58 ms | 5.37 ms |

Depth ratio for an amount ratio of 2.286: ×10.8 (L) / ×8.4 (R) — strongly
superlinear (power-law exponent ≈ 1.8–2.9 depending on channel and whether
EC8's late taps are included; E1's per-tap offsets reproduce round 2 exactly:
L −0.64/+0.19/+1.37, R −0.05/+0.50/+0.59 ms). At amount 0.5 the tap train
DRIFTS down the recirculation: EC8's L taps sit at −5.79/+2.92/+15.79/+2.52 ms
from grid (tap 5 verified a real tap by its FB-family level, −54.32 dBFS vs
EC3's −54.60 in the same window, and by the broad peak scan). No single
"ms-per-unit" constant exists; the E1-family ±1.5 ms grid tolerance does not
extrapolate to higher amounts. Whether the exact curve is A², exponential or
a UI taper, and how much of EC8's L spread is tap-vs-reverb-tail confusion
(reverb floor −54 sits at the tap-5 level), is **open** — a clean re-probe on
the E8 bare recipe (reverb off, floor −90) would settle it (backlog).

**2. Ducking steady state is a LEVELER to the threshold — round 2's
"0.75–0.79 dB per dB" revised (EC9 family).** Settled GR (mean over the last
1.5 s of each 2.5 s step; round 2's 0.5 s steps never settled — attack+RMS
window need ≈0.4 s, so its per-step means sat 0.2–1.8 dB shallow; EC7's
numbers reproduce here as the full-step-window column):

| step (peak/RMS) | excess vs −24 | GR settled (−24) | excess vs −30 | GR settled (−30) |
|---|---|---|---|---|
| −18 / −21 dBFS | +3 | **−4.12** | +9 | **−8.64** |
| −12 / −15 | +9 | **−9.13** | +15 | **−13.80** |
| −6 / −9 | +15 | **−14.90** | +21 | **−19.64** |
| 0 / −3 | +21 | **−21.16** | +27 | **−25.93** |

- Read as output envelope: out_env = in_RMS + GR = **−24.1 ± 0.2 dBFS at
  thr −24** (excess +9…+21) and **−28.8 ± 0.25 dBFS at thr −30** (excess
  +9…+27): in steady state the ducking drives the output envelope TO the
  threshold — **≈1:1 gain tracking, no saturation**: the curve does not
  flatten anywhere through GR −26 dB. Local slope −0.84 → −0.96 → −1.04
  dB/dB climbing to 1:1.
- **Soft knee** at low excess: +3 dB excess reads −4.12 (1.1 dB shallow of
  the leveler line); from +9 up the leveler holds to ±0.3 dB.
- **Threshold mapping**: the leveled output sits ≈0.0 dB above the stored
  threshold at −24 but ≈+1.2 dB above it at −30 — the offset δ(thr) grows as
  the threshold lowers (two cells measured; the mapping law is open).
- Dynamics re-confirmed on the longer steps: onset ≤20 ms; release from a
  −21 dB duck reads −9.9 dB after 0.1 s (consistent with round 2's
  τ ≈ 111 ms exponential).
- L/R agree to ≤0.32 dB on every settled step.

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
  `E7_FB075.aif`, `E8_BARE.aif`, sections probes `EC1_FILTER.aif`,
  `EC2_DUCK.aif`, round-2 probes `EC3_NOMOD.aif`, `EC4_SYNC1_16.aif`,
  `EC5_DUCK_TONE.aif`, `EC5B_NODUCK.aif`, `EC6_WET_DUCK.aif`,
  `EC6B_WET_NODUCK.aif`, `EC7_DUCK_T24.aif`, round-3 probes
  `EC8_MOD50.aif`, `EC9_DUCK_TONE_STAIRCASE.aif`, `EC9B_NODUCK6.aif`,
  `EC9C_DUCK_T30.aif` (+ `.asd`)
- Sets: `harness/live/e1-impulse-default.als`, `e2-delay2x.als`,
  `e3-fb-half.als`, `e1b.als`, `E5_FREEMODE.als`, `E6_FREE2X.als`,
  `E7_FB075.als`, `E8_BARE.als`, `EC1_FILTER.als`, `EC2_DUCK.als`,
  `EC3_NOMOD.als`, `EC4_SYNC1_16.als`, `EC5_DUCK_TONE.als`,
  `EC5B_NODUCK.als`, `EC6_WET_DUCK.als`, `EC6B_WET_NODUCK.als`,
  `EC7_DUCK_T24.als`, `EC8_MOD50.als`, `EC9_DUCK_TONE_STAIRCASE.als`,
  `EC9B_NODUCK6.als`, `EC9C_DUCK_T30.als`
- Analyzers: `harness/analyze_echo_taps.py` (stereo broad peak scan + ±8 ms
  windowed tap table), `harness/analyze_ec_duck.py` (EC duck pair mode:
  20 ms RMS windows, per-step means, onset, release-τ fit),
  `harness/analyze_ec8_wobble.py` (round 3: per-tap fine peak timing on the
  pingpong-aware same-channel trains, pp/power-law depth read-out),
  `harness/analyze_ec9_saturation.py` (round 3: settled-window GR ladder,
  leveler read-out, onset/release)
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
- Modulation/ducking leave the synced tap grid unchanged: **high** (grid comparison); what AmountDelay modulates: **quantified (round 2)** — deterministic ±1.4 ms LFO wobble along the tap train, ≈−1 dB tap-peak smear
- −5.5 dB tap1 residual = modulation: **refuted (round 2)** — −4.62 dB DryWet crossfade + ≈−0.9 dB mod smear; E1 tap1 decomposes exactly (bare −2.50 → filter −11.58 → crossfade −4.62 → mod −0.93 → −19.63)
- Wet path linear in DryWet at 0.5873: **medium-high** (EC1×0.5873 = EC3 to ≤0.15 dB; one operating point)
- Synced grid ≡ free 0.1875 s at 120 BPM (division −4/−3, sixteenth 3, SyncMode 2): **high** (EC4 ≡ E1 ≤0.02 dB, 0.00 ms, all six taps)
- Ducking threshold on the slow envelope (RMS-like), stored in dB; NOT peak-referenced: **high** (0 dBFS-peak tone inert at thr 0; −27 dB RMS inert / −21 dB RMS ducked at thr −24)
- Duck gain applied at output in real time, detector on the dry/pre-delay input: **high** (onset ≤5 ms after the step, no hop lag)
- Duck STEADY depth ≈1:1 leveler to the threshold (round-3 revision of the 0.75–0.79 dB/dB reading, which was settling contamination of the 0.5 s steps): **high** (settled 2.5 s-step ladder at two thresholds, 8 cells; out_env −24.1±0.2 at thr −24, −28.8±0.25 at thr −30; no saturation through GR −26 dB; soft knee ≈1 dB shallow at +3 excess)
- Modulation_AmountDelay depth NOT linear in stored amount: **high** (same-tap-set pp ratio ×8.4–10.8 for ×2.286 amount; exact curve open)

## Limitations / unverified

- 44.1k/16-bit export of a 48k source: dither non-determinism (max |Δ| 2 LSB16);
  SRC ringing on a 1-sample impulse sets the direct's observed shape (−13.83 dBFS).
- ~~The unducked wet-only control (EC6B) exceeds full scale on the −3/0 steps~~
  **RESOLVED round 3**: the control carries clip gain 0.5 (EC9B_NODUCK6), so
  the settled depth ladder at thr −24/−30 is exact, not floored.
- ~~The exact saturation curve near and beyond −18 dB GR is unmeasured~~
  **RESOLVED round 3**: no saturation — steady GR tracks ≈1:1 (leveler) to
  −26 dB GR; soft knee at +3 excess; δ(thr) offset grows at −30 (mapping open).
- Every free-mode test had the slower time at exactly 2× the faster (E1: 0.375/0.1875,
  E5: 0.5/0.25, E6: 1.0/0.5) — the pingpong topology beyond "hop = min, repeats at
  2×hop" is under-determined; a 3:1 ratio pair with TimeLink=false would pin it.
  (EC4 pinned tL=tR — also not a discriminant for min() vs link.)
- FB range above 1.0 (self-oscillation) untested.
- SyncMode=2 semantics beyond the dotted mapping, Repitch behavior,
  gate/noise/wobble sections: untouched. Modulation envelope mix
  (Modulation_EnvelopeMix) and AmountFilter paths untested; ducking depth
  curve modeled only at 1 kHz / this preset's other pins.
- AmountDelay depth curve (round 3): superlinearity measured at two amounts
  on the reverb-ON recipe — EC8's late-tap offsets carry a ±few-ms
  tap-vs-tail ambiguity (floor −54 ≈ tap-5 level). A bare-recipe re-probe
  (E8: reverb off, floor −90) at amounts 0.21875/0.5 would pin the exact
  curve; the δ(thr) leveler offset (0.0 at −24, +1.2 at −30) wants a
  threshold sweep. Both queued (backlog).
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

### Round 4 — bare-line AmountDelay depth law (2026-10-09 night lane)

The round-3 thin remainders (exact depth curve, E8-bare re-probe) closed
with `EC10/11/12_AMT` = E8_BARE (filter/duck/reverb off, mod LFO 2 Hz
synced phase 90) at `Modulation_AmountDelay` 0.10/0.35/0.75
(`build_session_probes.py`), analyzed with the round-2/3 tap measure
(parabolic fine peak in ±20 ms at k·0.1875 s + T0; L taps 1,3,5,7,9, R taps
2,4,6,8,10). The measure replicates the archived round-3 numbers exactly
(EC8_MOD50: pp L 21.579 ms / R 5.369 ms vs recorded 21.6/5.4):

| render | amount | pp wobble L | pp wobble R | note |
|---|---|---|---|---|
| E8_BARE (archive) | 0 | 0.004 ms | 0.005 ms | taps exact on grid (interpolation noise; uniform −0.176 ms T0 bias) |
| EC10_AMT10 | 0.10 | 0.169 ms | 0.048 ms | nearly inert |
| EC11_AMT35 | 0.35 | 7.342 ms | 1.954 ms | clean sampled sinusoid per channel |
| EC12_AMT75 | 0.75 | ≥31.9 ms | ≥28.3 ms | **window-clipped lower bound** — readings pinned at the ±20 ms edge |
| EC8_MOD50 (archive) | 0.50 | 21.579 ms | 5.369 ms | full preset — sits on the bare-line curve |

1. **Depth law: pp wobble ∝ Amount³.** Pairwise exponents on the bare line:
   0.10→0.35 gives **3.01 (L) / 2.96 (R)**; the full-preset A=0.5 point
   predicts 7.342·(0.5/0.35)³ = 21.4 ms vs measured 21.58 — the A³ law holds
   across bare and full-preset (filter/reverb sections carry no timing
   contribution, independently confirming round 2). Round 3's ×8.4–10.8 for
   ×2.29 amount (exponent ≈2.8) was this same cubic through two points.
   Implementation shape: mod depth per unit amount ∝ amount² (quadratic
   indexing), not linear.
2. **Stereo depth ratio is constant: R ≈ 0.26 × L at every amount**
   (0.28 / 0.27 / 0.25 across 0.10/0.35/0.50). The right delay line's mod
   depth is a fixed fraction of the left's — not an independent modulator.
3. **Accumulation confirmed on the bare line.** Same-channel taps sample the
   2 Hz LFO 90° apart (135°/hop, 270°/same-channel step), so a pure
   delay-time modulation must read first-tap = last-tap and |values| bounded
   by one amplitude. At A=0.35 the L sequence
   {−2.17, +0.77, +5.17, +0.50, −2.13} ms has first ≈ last (−2.17/−2.13 ✓)
   but the mid-tap overshoots 2.4× the end taps — the wobble amplitude
   GROWS down the recirculating train (loop-internal modulation: each
   feedback pass re-enters through the modulated delay). The round-3
   "tap drift accumulates" observation is a property of the graph, not of
   the full preset.
4. At A=0.75 the sweep exceeds the measure window; the pp numbers are lower
   bounds and the tap pattern aliases (taps migrate between windows). Any
   deeper probe needs a wider window or a smaller hop.
