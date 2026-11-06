# live-engine

Audio graph core for the Live shell — M1 (graph) and the engine side of M3
(device hosting) of
`../docs/research/ableton-live-12.0.25/shell/SHELL-BLUEPRINT.md`. A typed
track/device/mixer graph with a beat clock and a deterministic offline
render; the offline render is also the acceptance path the milestone gates
run against.

Since O-I #849 it is also **the shell's one engine for Live's parts**: MIDI
parts with an instrument, sends and return tracks, the Main track, a
realtime pull path that takes notes and mixer moves through a lock-free
queue, and Export Audio that renders exactly what was played. The desktop
hosts it (`desktop/cradle/src-tauri/src/live_engine_host.rs`); the Torus
sounds through it as an instrument node over QL's K8 typed API (feature
`k8`).

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
  warning. `bridge` (the summary) leaves MIDI and return tracks as
  warnings; `bridge_set` (the document) bridges them with their notes,
  instrument, mixer, sends and the Main track (see the parts engine).
  Sources are not loaded by the bridge — the host fills `Track::source`.
- `src/realtime.rs` — realtime output (feature `realtime`, cpal): the
  phase-1 audition path. The cpal callback pulls `Graph::mix_frame`
  through `pull_block` — the exact arithmetic the offline render runs,
  verified bit-identical OFFLINE (no device needed) by
  `pull_blocks_reproduce_the_render_exactly`. Design constraints and the
  audition recipe below.
- `src/engine.rs` — the parts engine (O-I #849): `engine(graph)` splits a
  prepared graph into `EngineCore` (the audio half: `pull_block`) and
  `EngineHandle` (the control half: `send` an `EngineEvent`, `collect`
  the applied `MixerState`, `position`, `performance` for Export Audio,
  `latency`). Events are refused in words before they are queued
  (`MixerState::refusal`), applied at the first frame of the next block
  and stamped with that frame.
- `src/ring.rs` — the bounded SPSC ring (`RING_CAPACITY` 4096) the
  control and audio halves cross by: no lock, no allocation.
- `src/instruments.rs` — `OperatorInstrument` (16 voices over
  `live_dynamics::operator`'s gated default patch, oldest stolen) and
  `SilentInstrument` (a MIDI part with no modelled instrument).
- `src/k8.rs`, `src/k8/field_shim.cpp`, `build.rs` — feature `k8`: the
  Torus as an instrument node (`K8Instrument` over `K8Field`, a C ABI shim
  over `ql::ContinuousField`); `QL_MEF_PREFIX` names an installed QL
  prefix (`include/ql/continuous_field.hpp`, `lib/libql-mef-c.a`).
- `examples/key_to_sound.rs` — the key-to-sound measurement (headless by
  default; `--device` plays it on the default output, by hand only).
- `tests/m1_gate.rs` — **the M1 gate**.
- `tests/m3_gate.rs` — **the M3 gate** (`#[ignore]`-gated, needs the
  golden renders, like `live-dynamics/tests/golden.rs`).
- `tests/midi_gate.rs` — **the MIDI gate** (`#[ignore]`, needs the corpus).
- `tests/mixer_gate.rs` — **the mixer gate** (pan law and send taps against
  Live's renders; `#[ignore]`, skips with a notice while the renders are
  absent) and its teeth test.
- `tests/parts_engine.rs`, `tests/realtime_no_alloc.rs`,
  `tests/k8_instrument.rs` — the parts engine, the allocation-free pull,
  the Torus node.
- `tests/corpus/mod.rs` — where the gates find the RE corpus:
  `LIVE_RE_CORPUS` (else `../../docs/research/ableton-live-12.0.25`) and
  the render archive (`LIVE_RE_RENDER_ARCHIVE`).

## The parts engine (O-I #849)

- **One mixing law.** `Graph::mix_frame` serves the offline `render` /
  `render_performance` and the realtime `EngineCore::pull_block`; per
  part: instrument (MIDI) or source (audio) → its chain → activator and
  solo → volume and pan → Main; each send taps the part post-fader (after
  volume and pan) or pre-fader (`SendsPre/SendPreBool`), into its return
  → the return's chain → its volume and pan → Main → Main's chain.
- **MIDI parts.** `bridge_set` reads a MIDI part's arrangement notes
  (`KeyTracks/MidiNoteEvent`, the notes a part plays at their frames) and
  hosts its first `Operator` at the gated default patch; any other
  instrument plays its notes silently, with a warning.
- **Returns and Main.** Return tracks are members of `Tracks`
  (session-model.md:49); `LiveSet/SoloInPlace` decides whether returns
  sound while a part is soloed. A set may hold fewer sends than returns
  (the loader's words: "Track has more send knobs than set has return
  tracks" is the only refusal).
- **Realtime law.** `pull_block` takes no allocation, no blocking lock
  and no UI work (`tests/realtime_no_alloc.rs` counts allocations across
  ten event kinds with Operator, Echo and Glue sounding: zero).
- **Export Audio** is `Graph::render_performance(perf)` of a fresh bridge
  of the same set: every event at the frame the engine applied it, so the
  export is bit-identical to the pulled blocks (tested in
  `parts_engine.rs`, `k8_instrument.rs` and the desktop host's tests).
- **The Torus** (feature `k8`) sounds at the first frame of the block that
  takes its key — one audio block, never the worker's half second. Release
  build, two Toruses ringing, thread CPU per block (`key_to_sound`):
  64 frames 6.5 µs, 128 frames 12.6 µs, 1024 frames 59.4 µs (deadlines
  1.33 / 2.67 / 21.3 ms).

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
  follower, attack 2 ms, chosen so the static gate's measurement windows
  see the steady-state curve. Its release is measured (O-I #849 round 25):
  80, 160 and 302 ms at stored Release 0, 2 and 4, Live's renders of the
  release probe (glue.rs `MEASURED_RELEASE_TC_S`, gated by
  `m1_gate_the_glue_releases_as_lives_renders_at_each_stored_release`); a
  stored Release between them releases at the nearer, 1 as 2 and 3, 5 and
  6 as 4. The steady-state shift the Release makes (−0.12 dB at 2, −0.22
  at 4 on the probe) is not modelled. Refining the attack to the
  D6-measured ballistics is backlog.
- **Glue output**: no output clipper, which is Live's PeakClipIn off
  (the G16_NOCLIP pin); a set storing it on is named in the bridge's
  words. DryWet is not taken yet, and the set's warning says so.
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
- **Send taps** (#849): a post-fader send taps after the part's volume and
  pan; a pre-fader send before both. The send range's floor (−70 dB,
  0.0003162277571) is applied as stored; whether Live treats it as
  silence is unmeasured.
- **Solo with returns**: Solo in Place on, returns still sound while a
  part is soloed; off, they fall silent.
- **Activator**: an inactive part keeps its chain running (its device
  state moves on) but its output and sends are silent.
- **Operator voices**: 16 per part, the oldest stolen; a voice ends at the
  release floor. Notes shorter than one frame are dropped; at one frame,
  note-offs fire before note-ons.
- **The Torus's note-off and Panic** do nothing: K8 has no release or
  silencing op yet (the body rings down by its own damping).
- **A take's export rings out** (`Graph::render_ringing_out`, the desktop
  host's `TAKE_RING_OUT`): past the take's end the render goes on while
  any frame stands above −96 dBFS (the floor of a 16-bit file), ends once
  none has for 5 s (longer than the longest Delay between repeats the
  frame offers, so a silence between repeats does not end it), and stops
  at 30 s at the most (more than the longest room, 22 s), a tail still
  sounding there cut and said to be. These are the engine's choice: the
  corpus attests no tail behaviour of Live's own — its Export renders the
  Render Start/Length the panel holds, the arrangement's stored length
  and not the content's (session-model.md, "Export-render provenance";
  reconstruction-backlog.md, "Render-cycle loop-length fix"), so nothing
  says how far Live would ring a take out.
- **Consolidate and Crop write two things no corpus set attests**
  (live-set `acts.rs`; DLW build ruling 2026-11-05: they stay as they are,
  warned here, until a corpus set attests them). The sample they keep is
  named in its `FileRef` by `RelativePathType` 1, the type the corpus keeps
  for a path from the document's folder; the type Live gives a sample in a
  saved project's own folder is not attested. Crop keeps its sample in
  `Samples/Processed/Crop`, named by analogy with the template's
  `Samples/Processed/Consolidate` and `…/Reverse`: no set here holds a
  crop. A Live that reads either otherwise may look for the sample
  elsewhere.

## Realtime output (feature `realtime`)

`src/realtime.rs` makes the shell audible: a cpal output stream on the
default device whose callback pulls **the same mixing arithmetic the
offline render runs** — one mixing law, two execution paths. Phase-1
constraints, stated in the module doc and kept deliberately minimal:

- **Verified offline, no device needed.** The callback's mixing body is
  factored into `pull_block`; the unit test
  `pull_blocks_reproduce_the_render_exactly` drives it over the same
  frame sequence as `Graph::render` (state-carrying Glue, short track,
  uneven device-sized blocks, the arrangement ending mid-block) and pins
  every sample BIT-IDENTICAL to the offline render. Frames past the
  arrangement render as silence and the transport rests at the end.
- **Graph swap = rebuild + swap.** A parameter change builds a fresh
  graph (device state resets — the same one-shot semantics as the
  offline render) and hands it over through a lock-guarded handoff; the
  callback only ever `try_lock`s (on contention it keeps playing and
  tries again next callback), retired graphs are dropped on the UI
  thread, the beat clock follows the adopted graph's tempo. The swap is
  NOT click-free — a boundary discontinuity is acceptable in phase 1.
- **No resampling.** The stream requests the graph's sample rate in
  stereo f32; a device that refuses it surfaces as
  `RealtimeError::StreamBuild`, never a panic. No output device is
  `RealtimeError::NoOutputDevice` (headless/CI machines degrade
  gracefully).
- **`EnginePlayer`** (#849) plays the parts engine's `EngineCore` on the
  default output: the callback only `pull_block`s and reports the
  device's output latency. cpal's stream is not `Send` on CoreAudio, so a
  keeper thread opens, holds and drops it; the player itself is `Send`
  and lives in the desktop host's state.
- **Failure posture:** a runtime stream error (device unplugged) is
  logged to stderr and the stream goes silent; the callback cannot panic
  (block writes are exact 2-sample frames, missing graphs render
  silence).

### Audition (the harness sets)

The shell's old `--play` mode (`packages/live-shell/src/play.rs`) was
removed as dead code on 2026-11-05: it had not been compiled since the
shell's server crate dropped its `live-engine` dependency, its whole
work was to open the default output device (which no test may do), and
what it did — walk a set's unwarped audio clips and lay their samples on
the bridged graph — is the bridge's own now (`bridge::lay_samples`,
which also resamples and reads AIFF), played by the desktop host. The
engine is auditioned in the desktop candidate (`live_engine_open` /
`live_engine_play`) and by `examples/key_to_sound.rs --device`. What the
harness sets sound like there:

- `harness/live/steps-1k-gluecompressor.als` — **the canonical audition**.
  1 audio track, tempo 120, clip 0–10.5 beats = **5.25 s**. What you
  should hear: the level-staircase tone — a 1 kHz tone stepping up
  through seven levels (−30…0 dBFS peak, ~3.75 s of tone) then silence
  to the clip end — with the steps above the Glue threshold (−12 dB,
  Range 30, the G1 pins the M1 gate pins) sitting under the compressor's
  gain map. Play `g6-bypass.als` next to it: same staircase, no gain map.
- `harness/live/E8_BARE.als` — **4.00 s**; one impulse click, then the
  Echo bare-line tap train: taps every 0.1875 s (the measured synced hop
  at 120 BPM) alternating L/R, fading −6 dB per hop (FB 0.5), 100% wet.
- Warp-probe sets (`W1_TONES.als`, `WS1_TONES_2X.als`, …) correctly play
  nothing: the bridge warns that each clip "is warped, and the engine
  plays unwarped clips first: it is silent" — the documented behaviour,
  not a failure. A machine with no output device answers the
  `NoOutputDevice` refusal.

## Deliberately not here

- **Realtime audio I/O beyond phase 1** — the cpal output path is landed
  and pull-path-verified (see the realtime section above); click-free
  crossfaded swaps, resampling, realtime MIDI input and a mixer clock
  are the stated phase-1 non-goals (module doc). The offline render
  stays the acceptance path and the default, dependency-light build.
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
- **Instruments beyond Operator and the Torus** — Wavetable and the rest
  play their notes silently, with a warning.
- **Group buses** — a group's members route to the Main track.
- **Live's measured pan law** — the mixer gate is built and its teeth are
  measured, but the PAN_/SEND_ probe sets (built from the template) have
  no Live renders yet, so the pan law stays the M1 placeholder above.

## Status

M1 standing: graph, mixer, transport clock, offline render, bridge; the
3-part M1 gate green (0.000 dB max error vs the static predictions).
M3 (engine side) standing: Echo and Reverb hosted on the gated
live-dynamics models, bridged at factory-preset stored values; 27 unit
tests (32 with the `realtime` feature) + the 3-part M1 gate + the 3-part
M3 gate green, zero clippy warnings. Written from `session-model.md`, the
device dossiers (`devices/glue-compressor.md`, `devices/echo.md`,
`devices/reverb.md`) and the gated `live-dynamics` models only.

Parts engine (2026-11-03, O-I #849): MIDI parts, sends and returns,
pre/post taps, Solo in Place, the Main track, the realtime engine with
its event queue, Export Audio, the Torus node; 37 unit tests with
`realtime`, 18 parts-engine tests, the no-allocation test, the MIDI gate
(Operator against `M1_OPERATOR.aif` and `OP5_KEY60.aif`), the mixer gate
(skipping, renders absent) and 5 Torus tests with `k8`; clippy clean in
all three feature sets.

Realtime (2026-10-08): the cpal output path landed behind the `realtime`
feature — `pull_block` verified bit-identical to the offline render
offline (`pull_blocks_reproduce_the_render_exactly`), the handoff/swap
contract unit-tested, and the shell's `--play` (since removed) auditioned against the
real device (steps-1k through Glue, 5.25 s, clean exit; E8_BARE through
Echo, 4.00 s). Clippy clean with and without the feature.
