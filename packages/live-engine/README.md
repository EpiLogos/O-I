# live-engine

Audio graph core for the Live shell — M1 (graph) and the engine side of M3
(device hosting) of
`../docs/research/ableton-live-12.0.25/shell/SHELL-BLUEPRINT.md`. A typed
track/device/mixer graph with a beat clock and a deterministic offline
render; the offline render is also the acceptance path the milestone gates
run against.

## The clean-room rule (binding, inherited from live-dynamics)

This crate is written **only** from `session-model.md`, the device dossiers
(`devices/*.md`), and the gated `live-dynamics` models. No decompiled
output, no vendor material, no binary-derived tables enter this crate.
Live-truth constants carry a provenance comment naming the document they
come from; anything that is an ENGINE decision rather than Live truth is
marked as such at its definition (see "Engine decisions, not Live truth"
below).

## Layout

- `src/graph.rs` — `Clock` (tempo/beat transport), the `Device` trait,
  `Track` / `MasterTrack` / `Graph`, and the offline render
  (`Graph::render(sample_rate) -> Vec<f32>`, interleaved stereo).
- `src/devices.rs` — the device set, each backed by a gated
  `live-dynamics` model: `GlueDevice` (static curve path through
  `live_dynamics::glue`), `EchoDevice` (the measured bare-line tap laws of
  `live_dynamics::echo` — hop grid, L-first pingpong, first-pass taps 1–2,
  one feedback application per hop from tap 3, dry/wet crossfade),
  `ReverbDevice` (input convolved with `live_dynamics::reverb`'s impulse
  response, decay_ms + engine mix), `GainDevice` (utility), `BypassDevice`
  (document "off" state and landing spot for unknown devices).
- `src/wav.rs` — minimal IEEE-float WAV reader (format tag 3) that
  PRESERVES the interleaved channel layout — unlike
  `live_dynamics::audio`, which mixdowns to mono for gating. The engine
  owns multi-channel buffers; this crate reads audio, it is not a
  converter.
- `src/bridge.rs` — document → graph bridging: a `live_set::SetSummary`
  becomes a renderable graph. KNOWN devices (`GlueCompressor`, `Echo`,
  `Reverb`) instantiate their models at the factory-preset stored values
  (`devices/glue-compressor.md`, `devices/echo.md` E1 pins, the
  Reverb default state — each stored value cited at its construction);
  UNKNOWN device element names instantiate `BypassDevice` and produce a
  warning. MIDI and return tracks are warnings (not rendered in M1).
  Sources are not loaded by the bridge — the host fills `Track::source`.
- `tests/m1_gate.rs` — **the M1 gate**.
- `tests/m3_gate.rs` — **the M3 gate** (`#[ignore]`-gated, needs the
  golden renders, like `live-dynamics/tests/golden.rs`).

## The M1 gate

`cargo test` (integration test `m1_gate`):

1. The harness steps signal (`harness/signals/steps-1k.wav`, 48 kHz
   float32 stereo) is one stereo track through a `GlueDevice` pinned to
   the canonical G1 pins (Threshold −12, Range 30, Ratio 1, Makeup 0),
   master at unity — a synthetic set built in the test.
2. The render's per-step OUTPUT RMS is gated against `live-dynamics`'s
   static predictions (`glue::static_output_rms_db`) at
   `verify::STATIC_TOLERANCE_DB` = 0.5 dB, over the same step windows
   `verify::static_gate` measures. This validates graph + device + mixer
   against the same golden truth the DSP models are gated against (the
   G1 gain map in `devices/glue-compressor.md`).
3. A bypass reference confirms the staging is unity (the G6 role), and a
   second render must be bit-identical to the first (determinism).

Status: **green** — the engine matches the static predictions at
0.000 dB max error across all seven steps (−30…0 dBFS peak).

## The M3 gate

`cargo test -- --ignored` (integration test `m3_gate`, needs the golden
renders under `harness/renders/`):

1. **Echo vs `E8_BARE.aif`** (devices/echo.md D8, the bare-line
   baseline): the harness impulse renders through `EchoDevice` (hop
   0.1875 s — the measured synced hop at 120 BPM, pinned directly because
   the device hosts the free-mode seconds law — FB 0.5, 100% wet). The
   tap table (`live_dynamics::taps`) of the engine render must sit on the
   k·hop grid within ±1 ms and realize the modeled law exactly
   (`echo::tap_amplitudes_db`); the golden render's taps must sit on the
   same grid, and the per-hop decay slope over taps 3–8 must agree.
2. **Reverb vs `R1_IMPULSE_default_v2.aif`** (DecayTime 1200, the stored
   default): per-band RT60 (broadband + the four gate bands, floor-aware
   least squares, the stated 0.25–0.60 s window) at ±10%, and the
   48-band static spectrum over [0, 4 s) at mean ≤1.5 dB / max band
   ≤3.0 dB — the same thresholds the model's own golden gate runs. The
   stimulus is aligned so the engine render's direct sits on the golden
   render's direct sample (the analysis-geometry discipline of
   `model_buffer_at_direct` on the live-dynamics side).
3. **Reverb decay scaling vs `R3_DECAY600.aif` / `R4_DECAY2400.aif`**:
   the same RT60 comparison at the D5 scaling pins (windows 0.10–0.30 s
   and 0.40–1.20 s) at ±20% — parameter pins moving engine output
   against golden truth.

Status: **green** —
Echo: all 8 taps within 0.23 ms of the golden grid (tol ±1 ms); engine
per-hop slope −6.021 dB/hop = the 20·log10(0.5) law exactly; golden
−5.881 (the documented D8 settling residual), Δ 0.14 dB/hop (tol 1.0).
Reverb R1: RT60 errors 0.5–5.9% (tol 10%); spectral mean 1.00 dB
(tol 1.5), worst band 2.89 dB (tol 3.0) — bit-identical to the residuals
the live-dynamics model gate records, as they must be (the engine render
of a delta through the device IS the model IR). R3/R4 scaling: 0.2–18.4%
(tolerance 20%; the 18.4% is the documented R4 high-band residual).

## Engine decisions, not Live truth

Marked in code where they are made; listed here so they are findable:

- **Glue ballistics**: the real detector is ballistics-aware and dithered
  (`devices/glue-compressor.md` binary cross-check; steady state shifts
  with Attack/Release pins, D6). The engine uses a simplified block-peak
  detector (32 frames ≈ 0.67 ms at 48 kHz) plus a one-pole dB-domain
  follower (attack 2 ms, release 50 ms), chosen so the static gate's
  measurement windows see the steady-state curve. Refining to the
  D6-measured ballistics is backlog.
- **Echo stereo feed**: the delay line is fed the frame mean; the
  dossiers only measure identical-channel input, so the true stereo feed
  law is unmeasured (echo.md leaves the wider pingpong topology open).
- **Echo tap-train truncation**: 256 taps or the crate's −144 dB floor,
  whichever first — FB ≥ 1 (self-oscillation) is untested in the dossier
  and cannot be represented faithfully.
- **Echo unmodeled sections**: the full preset's filter, ducking,
  modulation and internal reverb are not modeled — E8_BARE is the hosted
  baseline (the E1 residuals those sections cause are documented dossier
  facts, not engine behavior). The synced-division mapping (Delay_Sync*)
  is document/sync territory — the bridge stores the free-mode seconds
  value.
- **Reverb mix**: an engine-side dry/wet crossfade (0 = dry, 1 = the
  model response). The stored default state has no global DryWet element
  (the direct level is `MixDirect` 0.55, folded into the model's fitted
  constants), so the bridged default is 1.0.
- **Reverb mono**: the model's L/R decorrelation (Spin, Chorus) is folded
  into fitted levels, not reproduced (documented model residual) — the
  same IR runs on every channel.
- **Reverb convolution**: a per-sample streaming scatter, O(IR length)
  per NONZERO input sample (skipping a zero input is bit-exact). Exact
  but dense-input-heavy; FFT-partitioned overlap-add is backlog.
- **Pan law**: center = unity, only the counter channel tapers (never
  boosted). No dossier measures Live's pan law, so none is guessed.
  Measuring it is backlog.
- **Mixing topology**: clip → device chain → track gain/pan → master →
  master devices. This is the device-chain reading of session-model.md
  §3; it is not yet behavior-verified against Live (the M1 gate pins all
  staging at unity, so it does not exercise the order).
- **No clipper**: the master bus carries raw float; no limiting.

## Deliberately not here

- **Realtime audio I/O** — no cpal/no audio thread; the render path is
  offline and deterministic (the acceptance path). cpal output is the
  next milestone's backlog.
- **Live-native devices beyond the hosted four** — Glue, Echo, Reverb and
  the utilities are hosted; everything else from Live's device list
  (including Echo's filter/ducking/modulation/internal-reverb sections
  and any instrument) bridges to `BypassDevice` with a warning.
- **Parameter editing from document states** — the bridge reads device
  element names only (the M3 summary carries no parameter values); the
  hosted devices sit at their factory-preset stored values. Reading
  stored parameter states into the graph, and the device-panel surface
  that edits them, is the remaining M3 work (shell side).
- **Drag-in / device on/off surface** — the document `On` parameter
  bridges as the device element's presence, not as a runtime toggle; a
  device-panel UX is M3 shell work.
- **Warp / clip playback** — arrangement clip bounds, warp modes and
  sample references are M5. A track's source is a buffer the host
  provides.
- **MIDI tracks and instruments** — no voice models yet (RE lane open
  item); MIDI/return tracks bridge as warnings.
- **Sends / return buses** — not in the graph.

## Status

M1 standing: graph, mixer, transport clock, offline render, bridge; the
3-part M1 gate green (0.000 dB max error vs the static predictions).
M3 (engine side) standing: Echo and Reverb hosted on the gated
live-dynamics models, bridged at factory-preset stored values; 29 unit
tests + the 3-part M1 gate + the 3-part M3 gate green, zero clippy
warnings. Written from `session-model.md`, the device dossiers
(`devices/glue-compressor.md`, `devices/echo.md`, `devices/reverb.md`)
and the gated `live-dynamics` models only.
