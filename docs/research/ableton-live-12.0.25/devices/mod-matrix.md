# Wavetable / Operator modulation matrix — decoded structure

**Status:** census, revision 1 (2026-10-07). Source: full structural parse of
`evidence/devices/Wavetable/default.xml` (and Operator where noted). This is
the map the shell's device panels and the clean-room synth model implement.

## Wavetable matrix encoding (from the document XML)

- `ModulationConnections` holds **52 `ModulationConnectionsForInstrumentVector`
  blocks — one per destination**, each carrying:
  - `TargetId` — the XML path of the destination parameter
  - `TargetName` — the UI name (e.g. "Osc 1 Pitch", "Amp")
  - `ModulationAmounts.0..12` — **13 per-source amounts** (the matrix row).
- 13 modulation sources per destination; source identities are positional
  (not named in XML). Default patch active routes: source 5 → Amp (0.5),
  source 7 → Pitch (0.0417), source 9 → Osc 1 Pos (1.0), source 11 → Pitch
  (1.0), source 12 → Osc 1 Pos (0.33).
- 69 `ModulationTarget` elements (automation targets for the destinations).
- `Voice_Modulators_{Envelope2,Envelope3,Lfo1,Lfo2}` are the named
  modulators (the Amp envelope is Voice_Modulators_AmpEnvelope_*); fixed
  sources (velocity/key/pressure/wheel family) occupy the low indices.
- **M2 reinterpretation:** the earlier WT1 probe pinned
  `Voice_Global_AmpModulation`'s Manual — that element is destination 49's
  target ("Amp"); moving its Manual shifted the amp base level (uniform
  −36 dB), it did not touch a modulation amount. Velocity-flatness of the
  default patch stands.

## Destination table (full, from the default preset)

| # | TargetName | TargetId |
| --- | --- | --- |
| 0–5 | Osc 1 Pitch / Pos / Warp / Fold / Pan / Gain | `Voice_Oscillator1_*` |
| 6–11 | Osc 2 Pitch / Pos / FX 1 / FX 2 / Pan / Gain | `Voice_Oscillator2_*` |
| 12–13 | Sub Tone / Sub Gain | `Voice_SubOscillator_*` |
| 14–17 | Filter 1 Freq / Res / Drive / Morph | `Voice_Filter1_*` |
| 18–21 | Filter 2 Freq / Res / Drive / Morph | `Voice_Filter2_*` |
| 22–25 | Amp Attack / Decay / Release / Sustain | `Voice_Modulators_AmpEnvelope_*` |
| 26–32 | Env 2 Attack/Decay/Release/Initial/Peak/Sustain/Final | `Voice_Modulators_Envelope2_*` |
| 33–39 | Env 3 (same family) | `Voice_Modulators_Envelope3_*` |
| 40–45 | LFO 1 Amount/Shaping/Rate, LFO 2 Amount/Shaping/Rate | `Voice_Modulators_Lfo*_*` |
| 46–48 | Time / Global Mod Amount / Unison Amount | `Voice_Modulators_TimeScale`, `Voice_Modulators_Amount`, `Voice_Unison_Amount` |
| **49** | **Amp** | **`Voice_Global_AmpModulation`** |
| 50–51 | Pitch / Glide | `Voice_Global_PitchModulation`, `Voice_Global_Glide` |

## Source identity (open, being settled by probe)

- **Source 5 = a static/constant source** (default Amp route 0.5 explains the
  M2 uniform offset; velocity-flatness refutes Velocity here).
- Velocity candidates: indices 1–3 (probe ladder WM_A2 → WM_A1 → WM_A3:
  set `ModulationConnectionsForInstrumentVector.49/ModulationAmounts.k`
  = 1.0, render the velocity staircase, look for monotone level tracking).
- Probe results: appended below as they land.

## Operator (partial census)

- Same pattern at smaller scale: `ModulationTarget` ×162,
  `ModConnections.0/1` per shell (destination slots), `ModDst`/`VelDst`/
  `KeyDst` destination selectors, per-shell `VelScale`/`VelCoarseScale`
  amounts. VelDst Connection 0/1 = pitch-family, 5 = +6 dB static gain,
  2/3/4/6 inert on the default patch (M-lane sweep).

## Probe log + verdict (2026-10-07, late — inline ladder)

Amount 1.0 on destination 49 (Amp), one source at a time; velocity staircase
127/96/64/32 at key C3, per-note RMS [start+0.15, start+0.70] s:

| source | result |
|--------|--------|
| 1 | flat (−31.23 ±0.01) — not velocity |
| 2 | flat (−31.23 ±0.01) — not velocity |
| 3 | flat (−28.38 ±0.01; note0 +0.18 startup) — not velocity |
| 4 | flat (−28.38 ±0.01; static offset −2.8 dB vs base) — not velocity |
| 5 | (default Amp route 0.5 — M2: static offset, not velocity) |
| 6 | flat (−34.02 ±0.01; static offset −2.8 dB) — not velocity |
| 7 | flat (−32.08 ±0.01) — not velocity |
| **10** | **velocity-dependent: −35.31 / −43.27 / −27.35 / −48.34 dBFS at vel 127/96/64/32** |

**Verdict: source 10 = Velocity** (the only source responding to the
velocity staircase; 21 dB spread, non-monotonic in RMS — bipolar character
around a mid-velocity peak; exact transfer shape open, confirmation runs
on 8/9/12 would refine the map).

**Source 0 = Key (note number)** — key-varied probe (midi-wm-a0-keys.aif,
keys 36/48/60/72 at fixed velocity 100, amount 1.0 → Amp): level
−49.81/−49.81/−95.77/−96.33 dBFS — monotone attenuation with pitch,
silent above ≈key 57. Key-tracking confirmed. (Measured fundamentals at
keys 36/48 read ≈65 Hz with the level near-floor — the zero-crossing
estimate is polluted there; keys 60/72 show aliasing residue at the
floor.)

**Source attribution summary (Wavetable, evidence-complete):**
- **0 = Key**, **10 = Velocity** (behaviorally settled)
- 1/2/3 = not velocity (flat), 4/6 = static offsets (level shift, flat),
  5 = static/constant (default Amp route 0.5)
- 8/9/11/12 = modulator family (LFO1/LFO2/Env2/Env3 or envelope
  self-patches; default routes 9→Osc1Pos 1.0, 11→Pitch 1.0, 12→Osc1Pos
  0.33 are consistent with envelope-driven wave position + key/LFO pitch
  tracking) — exact labels unverified, low priority.

**D10 CLOSED POSITIVE:** Wavetable velocity→level exists as the matrix
route 10 → Amp; the default patch leaves it at 0. Operator matches the
design (wired, unrouted). The shell's device panel exposes the matrix.

**Shell consequence (D10 positive):** Wavetable velocity→level exists and is
user-configurable through the matrix (source 10 → Amp); the default patch
leaves it unrouted — matching Operator's design (velocity wired, unrouted).
The shell's device panel should expose the matrix (52 destinations × 13
sources) rather than a fixed velocity knob.

## Envelope attribution (2026-10-08)

Probes S9/S11 (amount 1.0 → Amp): both sources retrigger an identical
attack-decay shape on every note (S9: −24.05→−33.12 dBFS over 0.9 s;
S11: −28.66→−33.08), flat across velocities — **envelope-family sources**,
matching the default patch's own routes (9 → Osc 1 WavePosition 1.0 = the
position envelope; 11 → Global Pitch 1.0). Exact labels (Env2/Env3/LFO)
unverified; 8/12 remain LFO-family suspects (free-running → position-
dependent per-note RMS, untested).

## Source map (final, evidence-complete for the shell)

**0 = Key · 10 = Velocity · 9/11 = envelopes · 5/4/6 = static offsets ·
1/2/3 = no effect · 8/12 = LFO-family (likely, unverified) · 7 = no effect
on Amp (default-routed to Pitch at 0.0417).**

## Probe attempt: 8/9/12 → Amp (2026-10-08, BLOCKED — route renders silence; mechanism isolated — **RESOLVED 2026-10-09, amount-ladder section at end**)

The completion probes for 8/12 (and a same-spec S9 confirmation run) were
built and driven to render. First pass (17:54–18:05) rendered digital
silence; the closing Live batch (18:27–19:36) re-ran the full discriminator
protocol and **confirmed the silence is real, set-specific, and caused by the
modulator→Amp route itself**:

- **Discriminator PASS.** `WT1_AMPVEL_check.als` (byte-copy of the
  known-audible set) rendered **audible**, per-note RMS identical to the
  13:28 reference (−62.30/−62.18/−62.18/−62.18), twice: in the pre-crash
  instance (18:27) and again on a **fully clean-boot instance** (graceful
  quit, recovery state wiped, fresh launch, 19:33).
- **S8/S9/S12 all render digital silence** (−96.3 dBFS dither floor, no
  note activity) on the clean-boot instance — `WM_S8.aif`/`WM_S12.aif`
  (fresh, verified export path), `midi-wm-s9.aif` (re-rendered from the
  original bytes that rendered −31.2 dBFS audible at 13:28).
  `WM_S9.aif` is a byte-copy (md5-verified) of that `midi-wm-s9.aif`
  render — `WM_S9.als` and `midi-wm-s9.als` are the same bytes (md5
  93b71e2b…) — made because the owner held machine focus at the last
  render slot; a same-name re-render can replace it when Live is free.
- **Mechanism isolated (WM_BASE control).** `WM_BASE.als` = WM_S8 with the
  single pin `ModulationAmounts.8[Amp]` zeroed (all else byte-equal) renders
  **audible at −26.2 dBFS**. So the files load, Wavetable instantiates, the
  MIDI clip fires, the amp envelope works — **a non-zero Amp-row amount on a
  modulator-family source (8/9/12) is what silences the voice** (amount 0 →
  audible; amount 1.0 → exact digital floor).
- The 13:28 renders of byte-identical sets (S9 flat −31.2, envelope-shaped)
  therefore reflect an engine behavior that changed on this machine between
  13:28 and the 17:12 crash and **persists across clean boots**; the app
  binary is unchanged (Aug 2024 build). Root cause of the behavior change is
  open (persistent Live state; not pursued further in this batch).

Two separate environment findings from the same session:

- **Live export crash (real bug, 2 hits):** `LRecordManager::
  OnCheckFreeDiskSpaceAndFileSizesTimer` SIGSEGV near-null
  (`Live-2026-10-08-171236.ips` — the storm trigger — and
  `Live-2026-10-08-184344.ips`, hit during the `midi-wm-a10` export). The
  crash kills the export mid-flight (no output file); a crash-recovery
  prompt then stands in the way of the next open. The a10 velocity route was
  verified only at 13:28 (−35.31/−43.27/−27.35/−48.34); its re-render is
  still owed.
- **Harness driver hardened** (`lane3_render.sh` + `lane3_export.applescript`
  v2): swap-prompt static-text scan now reads inside AX groups (the prompt
  text moved a level deeper — this was the "open-handoff flake");
  crash-recovery prompts auto-declined; every export stashes any existing
  render first and refuses to bless a stale file; the export panel is driven
  by named-button clicks + field reads instead of blind keystrokes (the
  go-to desync after relaunch silently ate two exports).

Status of the attribution: **unchanged and still blocked by the silence** —
the 13:28 evidence (10 = Velocity, 0 = Key, 9/11 = envelope-family,
5/4/6 = static, 8/12 = LFO-family hypothesis) stands as-is, but until the
modulator→Amp routes render again, S8/S9/S12 re-renders cannot refine it.
The `WM_S*.als` sets and the `WM_BASE.als` control remain staged; when the
routes render audibly again, re-run the three sets and analyze with
`analyze_wm_sources.py` (per-note RMS + sub-window shape + fundamental).

## Same-instance re-run: silence fully replicates (2026-10-08 evening, lane 3)

The discriminator protocol ran again on the already-running Live instance,
renders minutes apart, owner focus contended but every keystroke guarded:

- **Discriminator PASS again.** `WT1_AMPVEL_check2.als` (fresh byte-copy of
  the known-audible set) rendered **audible at exactly the 13:28 reference
  values** — per-note RMS −62.30/−62.18/−62.18/−62.18, spread 0.12 dB,
  fundamental 131.0 Hz — third independent replication (13:28, 19:33 clean
  boot, now same-instance).
- **S8/S9/S12 all render digital silence in the same minutes-adjacent
  session**: `WM_S8b.aif`, `WM_S9b.aif`, `WM_S12b.aif` (byte-copy sets of the
  staged originals, md5-identical content) read the −96.3 dBFS dither floor
  with no note activity, flat sub-window profiles, no fundamental. This
  removes the last session-boundary confound: **control audible and probes
  silent within one boot, minutes apart** — the modulator-family → Amp route
  itself is what silences the voice, matching the `WM_BASE` isolation.
- Attribution status unchanged: 8/9/12 stay unattributed while silent; the
  13:28 S9 audible render (−31.2, envelope-shaped) remains the sole
  counter-evidence that these routes CAN sound. What changed the engine's
  reading of a non-zero Amp-row modulator amount after 13:28 — persisting
  across boots, invisible to the control set — is still open.

Driver lesson (harness): an Export panel that survived a crashed Save-panel
read re-opens with a **dead name field** (text field reads `missing value`
indefinitely; `readSavePanel` then throws on the empty read). Recovery that
works: cancel the Save panel AND the Export panel by named clicks, then
re-run the full `lane3_render.sh` flow — a fresh panel populates normally
(all three evening renders after recovery used route=direct).

## Mechanism RESOLVED by amount ladder (2026-10-09, lane 3 — Live owned)

**Verdict: DC-push, constant identified. The modulator-family sources are
frozen at exactly −1.0 (full-scale negative).** The Amp destination applies
its additive law `gain = 1 + Σ amountᵢ·sourceᵢ` faithfully — so a route
8/9/12 → Amp at amount `a` now renders at `gain = 1 − a`: audibly attenuated
at small amounts, **exactly digital zero at amount 1.0**. Not tremolo, not a
phase/freeze state of the destination — the source VALUE is a stuck constant.

The ladder (source 8 → Amp, one pin moved per run; control = `WM_BASE`
amount 0; velocity staircase 127/96/64/32 at C3, same as all prior probes):

| amount | render | whole-5 s RMS | peak | fitted gain vs control | envelope shape |
|--------|--------|---------------|------|------------------------|----------------|
| 0 | WM_BASE | −26.57 dBFS | −17.13 dBFS | 1.00000 | amp-env attack–decay–sustain, 131.0 Hz C3 |
| 0.2 | WMA8_02 | −28.50 | −19.07 | **0.80000** (−1.938 dB) | exact scaled copy of control (residual 0.047 %) |
| 0.5 | WMA8_05 | −32.59 | −23.15 | **0.50000** (−6.021 dB) | exact scaled copy (residual 0.065 %) |
| 1.0 | WMA8_10 | −96.32 | −90.31 (1 LSB) | **0.000000** | dither floor — digital silence |
| 0.5 on source **12** | WMA12_05 | −32.59 | −23.15 | identical to 8@0.5 | same, within ±2 LSB dither |

Evidence chain:

- **Law is `1 − amount`, to five decimals.** Least-squares fit of each render
  against the control over the 4-note region: 0.80000 and 0.50000 exactly;
  the residual after scaling is < 0.07 % — each probe is a pure scaled copy
  of the audible control. 100 ms RMS envelopes show **zero ripple at any
  rate** (monotone per-note decay, sub-window profiles identical across all
  four notes): a live 1 Hz LFO (preset: shape 0, rate ≈1 Hz, retrigger=true,
  phase 0) would show a 1 s-period tremolo with periodic nulls at amount
  1.0 — refuted. The 13:28 hypothesis space collapses to the DC branch.
- **Sources 8 and 12 read the same stuck value.** WMA8_05 vs WMA12_05:
  identical headers, 44 % of frames differ by ≤2 LSB, max |delta| 2 LSB —
  the same signal up to dither. One shared frozen value, not two
  independent modulator states.
- **The destination arithmetic is intact — the −1.0 is the source value.**
  If the Amp row computed `1 − amount` from the row alone, source 5's row
  would follow the same law and `WT1_AMPVEL_check2` (5 = 1.0) would be
  silent. It renders audible, and its level ratio to `WM_BASE` (5 = 0.5) is
  0.01563 (−36.123 dB) — byte-for-byte the same doubling measurement taken
  2026-10-07, BEFORE the 17:12 crash. The static-source row still reads a
  live constant; only the dynamic modulator slots deliver −1.0.
- Velocity-flat at every ladder rung (per-note spread 0.12 dB — no route 10
  in these sets), fundamentals 131.0 Hz (+2.5 cent) at every audible rung.

Consequences:

- **Silence is not a special amount-1.0 pathology.** Any non-zero amount on
  a frozen-−1.0 source attenuates by `20·log10(1 − amount)`; 1.0 is simply
  where the line hits zero. This explains every observation: S8/S9/S12 at
  1.0 → exact digital floor; WM_BASE (pin zeroed) → audible.
- **Root cause narrows to the modulator engine's source output**, which has
  delivered a constant full-scale negative value since the 17:12 crash,
  persisting across clean boots. −1.0 is the sine LFO's minimum; the
  envelope family has no −1.0 point (Initial/Final 0, Peak 1, Sustain 0.5).
  Either all dynamic slots read one shared stuck bus (clock/phase freeze),
  or 8/12 (and 9) are all LFO-family. The 13:28 family labels (9/11 =
  "envelope-shaped") are now suspect: a retriggered 1 Hz LFO can fake an
  attack–decay shape over a 0.875 s note. Re-labeling needs the engine
  unfrozen (or a different-destination probe, e.g. source 8 → Osc 1 Pos).
- Attribution of 8/9/12's *musical* identity remains open while frozen, but
  the **shell consequence is unchanged** (expose the matrix); add: the
  clean-room model should implement the Amp row as additive
  `1 + Σ amount·source` — the law this machine still follows on live rows.



## Clean-boot re-render: the freeze persists, and reaches a second destination (2026-10-09 night lane)

The open question after the amount ladder — is the stuck −1.0 crash-lineage
session state that a truly clean boot would clear? — is answered: **no.
A third fully independent instance still delivers −1.0.** Protocol: guarded
graceful quit (osascript quit, first attempt, no prompts; no pkill),
`CrashRecoveryInfo.cfg` and the Saved Application State removed, relaunch
with the probe set as launch document. Sets: `WMR_*` = the `WM_*`/`midi-wm-a10`
content with the transport loop shrunk to 11.75 beats (fast-render
convention; content identical, analysis windows absolute-time), built by
`harness/build_session_probes.py`.

| render | route | whole-5 s RMS | verdict |
|---|---|---|---|
| WMR_BASE | default row (5 = 0.5) | **−26.57 dBFS** | byte-level equal to the archive WM_BASE (−26.57) — instance healthy |
| WMR_S8 / S9 / S12 | 8/9/12 → Amp @ 1.0 | −96.3 dBFS (dither floor) | **freeze replicates on the clean boot** |
| WM_P8_POS | 8 → Osc 1 Pos @ 1.0 (Amp pin zeroed) | −26.57 dBFS | **dither-identical to WMR_BASE** (±2 LSB, 44 % frames) |
| WMR_A10 | 10 → Amp @ 1.0 | −28.24 / −39.46 / −28.94 / −31.08 | responds; transfer shifted (below) |

- **Second destination confirmed.** The Pos row carries the default
  9→Pos 1.0 and 12→Pos 0.33 alongside the probe 8→Pos 1.0; a frozen sum of
  −2.33 clamps at position 0 and renders the exact sine the control renders.
  WM_P8_POS vs WMR_BASE: max |Δ| = 2 LSB, 44 % of frames differing — the
  same acoustic signal up to dither. The stuck source value therefore feeds
  the position destination through the same additive row law, and Pos clamps
  at 0 in this regime.
- **The velocity transfer is engine-state-dependent.** WMR_A10 (route
  10→Amp @ 1.0, the row the 18:44 render owed) reproduces the pre-crash
  ladder's *shape* (dip at vel 96; 127 ≈ 64 > 32) but at shifted levels:
  spread 11.22 dB tonight vs 21 dB on 2026-10-07
  (−28.24/−39.46/−28.94/−31.08 vs −35.31/−43.27/−27.35/−48.34 dBFS at
  vel 127/96/64/32). Source 10 = Velocity is unaffected as an attribution —
  it still uniquely responds — but the exact transfer measured on 10-07
  should not be modeled until the engine renders mod routes at its 10-07
  state (or the difference is attributed).
- **Reframing of the timeline.** The default patch already routes 9→Pos 1.0
  and 12→Pos 0.33 — yet every M2-class render, pre- and post-crash, is a
  static sine at position 0. The modulator engine has never shown a live
  sweep in any render we hold; what changed after 13:28 on 2026-10-08 is the
  source VALUE the Amp row reads (~0/inert → exactly −1.0). The 13:28
  "audible S9" render is consistent with the pre-change value, not with a
  live LFO. The family labels hypothesized from 13:28 (9/11 = envelope) stay
  suspect; **the musical identities of sources 8/9/12 remain behaviorally
  unattachable on this machine in its current engine state** — both Amp-row
  and Pos-row probes read constants.
- Attribution work is exhausted at the behavior level short of a
  UI-authored set (a set whose mod routes Live's own writer laid out). If a
  future lane opens the editor anyway: author one route by hand, save-as
  into a scratch Project folder, and diff the writer's XML against the
  hand-built set — the delta is the missing initialization, exactly like the
  FollowAction `Time` anchor.
