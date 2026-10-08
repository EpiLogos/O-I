# Live Shell — blueprint for the clean-room rebuild

**Status:** foundation document, revision 1 (2026-10-07). Commissioned as the
parallel thread to the RE lane: all reverse-engineered functionality lands
in this shell.
**Reading order:** this file, then `../LANES.md` (thread protocol), then
`../session-model.md` (document truth), then the phase plan below.

## What is being built

A clean-room host for the documented behavior of Ableton Live 12: the
application shell (session/arrangement workflow, device chains, transport,
document engine) with the reverse-engineered device dynamics as its first
instruments and effects. It is **workflow-compatible and asset-original**:
it follows the documented model and interaction patterns, and uses its own
design language, code, icons, fonts and colors.

## Binding constraints

1. **No Ableton material in the tree** — no code, artwork, themes, fonts,
   factory presets, samples or wavetables. The shell *reads* standard
   document formats (.als/.adv/.adg) as interop on the owner's own files;
   it never bundles their content.
2. **Clean-room chain**: product code is written from `session-model.md`,
   the device dossiers, and the gated crate models only. `evidence/`
   (including all decompilations) never enters product source.
3. **One native owner per domain** (house rule): `live-dynamics` owns device
   DSP; `live-set` owns the document model; `live-engine` owns the audio
   graph; the shell owns presentation. Cradle integration later follows the
   focused-instrument pattern (presentation + receipts only on that side).
4. **Gates before claims**: every capability is accepted by a test against
   Live-truth evidence (golden renders, loader acceptance, round-trip
   documents) — the same discipline the RE lane uses.

## Why the foundations are ready (honest inventory)

| foundation | state |
| --- | --- |
| Document model | **strong** — `session-model.md` (loader-validated rules), Schema vocabulary (356 class tables), proven write-path into the real loader (audio + MIDI crafted sets), reading/writing evidence sets |
| Device dynamics | **partial** — Glue (static curve + ballistics + measured menus), Echo (tap laws), Reverb (gated model) live in `live-dynamics` behind golden gates; Operator/Wavetable synthesis NOT yet modeled (velocity mapping documented; voice models are a RE-lane work item) |
| Audio graph/transport | **standing (M1)** — `packages/live-engine`: typed track/device/mixer graph, beat clock, deterministic offline render; realtime I/O and warp deliberately absent (backlog) |
| UI shell | **none** — greenfield, M2 |
| Golden-render acceptance | **strong** — 51 labeled renders + hardened drivers + analyzers; the same harness validates engine output against Live truth |

## Architecture

```
packages/live-set      document engine (M0): LiveSet/Tracks/Clips/Devices
                       typed model; .als/.adv read+write; Schema-driven;
                       deps: flate2 + quick-xml (the DSP crate stays zero-dep)
packages/live-dynamics device DSP (exists, gated): glue/echo/reverb models,
                       envelope + tap verification
packages/live-engine   audio graph (M1): tracks, mixer, transport, offline
                       render path (deterministic — same path used for
                       acceptance vs golden renders), cpal output later
packages/live-shell    UI shell (M2+): Tauri + React per the Cradle house
                       pattern, so it can surface as a cradle panel later;
                       views: browser, session grid, arrangement, device
                       panels, transport; original design language
```

Data flow: shell (React) ⇄ engine commands/events ⇄ graph ⇄ device models ⇄
document engine (open/save .als). The engine's offline render is the
acceptance path: render a set → diff against golden renders with the same
spectral/static gates used for the DSP models.

## Phase plan (each milestone has an acceptance gate)

| phase | scope | acceptance |
| --- | --- | --- |
| **M0 document engine** | typed LiveSet model, .als read/write, loader-rule enforcement (Ids, pointees, sends), round-trip | round-trip idempotence on evidence sets; written sets load in real Live (loader loop via the proven harness) |
| **M1 graph core** — **LANDED 2026-10-07** (`packages/live-engine`) | offline-render engine: tracks (audio, mono/stereo), mixer (gain/pan), device chains (`GlueDevice` static-curve path + `GainDevice` + `BypassDevice` on live-dynamics), transport clock, document→graph bridge (known devices → models, unknown → bypass + warnings) | **GATE (green)**: engine renders `harness/signals/steps-1k.wav` as a set through Glue at the G1 pins (T−12/R30/MU0, unity staging) → per-step output RMS vs `live-dynamics` static predictions at 0.5 dB (same windows/threshold as `verify::static_gate`): 0.000 dB max error; bypass-reference + determinism assertions in the same gate (`live-engine/tests/m1_gate.rs`) |
| **M2 shell skeleton** | Tauri app frame, document open/save via live-set, transport UI, empty views | open a real .als, show tracks/clips/devices, save round-trips through M0 tests |
| **M3 device hosting** — **engine side LANDED 2026-10-07** (`packages/live-engine`; device panels remain) | Echo/Reverb wired to the gated live-dynamics models in the engine: `EchoDevice` = the measured bare-line tap laws (hop grid, L-first pingpong, first-pass taps 1–2, one FB application per hop from tap 3, dry/wet crossfade), `ReverbDevice` = the gated IR model convolved per channel (decay_ms + engine mix); bridge registers `GlueCompressor`/`Echo`/`Reverb` at factory-preset stored values, unknown devices still bypass+warn | **GATE (green)** (`live-engine/tests/m3_gate.rs`, `#[ignore]`-gated on the golden renders): Echo vs `E8_BARE.aif` — 8 taps on the k·hop grid within 0.23 ms (tol ±1 ms), engine per-hop slope = 20·log10(FB) exactly, golden Δ 0.14 dB/hop (documented D8 settling residual, tol 1.0); Reverb vs `R1_IMPULSE_default_v2.aif` — per-band RT60 0.5–5.9% (tol 10%), spectral mean 1.00 dB / worst band 2.89 dB (tols 1.5/3.0 — identical to the model's own golden residuals, the engine render of a delta IS the model IR); decay-scaling pins `R3`/`R4` 0.2–18.4% (tol 20%). Remaining on M3: parameter editing surface (stored document states → live graph), device on/off toggle, drag-in — shell-side work |
| **M4 session workflow** | clip slots, scenes, launch/quantise, FollowAction | session launch semantics match documented model |
| **M5 arrangement + warp** | arrangement editing; warp modes from the warp probe (Texture/Complex Pro 1:1-transparent first) | warp-gated renders |
| **M6 instruments** | Operator/Wavetable voice models (RE lane: synthesis + routing RE) | velocity/envelope gates vs MIDI-harness renders |
| **M7 library interop** | read .adv/.adg libraries (parameter trees), preset browsing | parameter trees match Schema vocabulary |

M1 backlog (deliberately not built, see `packages/live-engine/README.md`):
realtime cpal output, MIDI tracks (blocked on RE-lane voice models), warp /
arrangement clip playback (M5), send/return buses, Live's pan law
(unmeasured — engine uses a unity-center placeholder), D6-measured Glue
ballistics (engine uses a simplified smoothed follower). Echo/Reverb
hosting landed with the M3 engine gate; the device-panel editing surface
(panels, stored-state editing, drag-in) is the M3 remainder.

## Working agreements

- Both threads work the O-I register, in the working seat, with NOW returns.
- RE lane (A) lands: renders → dossiers → gated crate models. Shell lane
  (B) consumes only gated models + documents. The contract between threads
  is `LANES.md`.
- UI design work happens in this tree with original assets; any Ableton
  screenshot used during study is evidence (private), never shipped.
- Big multi-session work follows the wayfinder pattern (shared map, lanes
  pick up bounded slices, gates record acceptance).
