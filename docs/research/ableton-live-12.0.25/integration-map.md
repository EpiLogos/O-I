# Integration map — where the Live dynamics work lands in O-I

**Status:** revision 1 (2026-10-07). Companion to `README.md` (guardrails) and
`reconstruction-backlog.md` (what lands when).

## What exists in O-I today (the receiving surface)

| surface | path | state |
| --- | --- | --- |
| The Cradle (O:I desktop app) | `Work/O-I/desktop/cradle/` | Tauri + Rust kernel (`oi-cradle-kernel`) + React shell (`oi-cradle`) |
| Native-audio playback precedent | `desktop/cradle/expressions-app/field-studies-journeys/src/native-field/ql/native-audio.mjs` | plays a native owner's PCM; encodes the house rule: **companions never create a second DSP/oscillator/clock owner** |
| Instrument contract | `desktop/cradle/src/instrument/source.ts` (`ql.focused-instrument/v1`) | desktop owns presentation only; the instrument is a QL native concern |
| Nara instrument channel | `desktop/cradle/src/nara/instrumentProtocol.ts` (`nara-instrument`) | bounded channel pattern a future audio channel would mirror |
| RE-dossier precedent | `docs/research/openrig-c8fca9d/` (`BEHAVIOURS.md`, `CROSSWALK.md`) | source-locked external study, "reference study only: no code vendored" |
| Research protocol | `docs/RESEARCH-PROTOCOL.md` | source-lock → study → interpret → compare → operationalise |
| Package convention | `packages/<name>/` with own manifest | independent crates are the norm (no root Cargo workspace) |
| Landing gate | `gates/manifest.json` (`oi.gate-manifest/v1`), run via `node gates/run.mjs landing` | a new Rust crate needs its own gate entries (fmt/clippy/test) per `gates/README.md` |
| CI | `.github/workflows/verify.yml` | path-scoped to `cli/**`, `suite/**`, `surfaces.json`, `schemas/**`; `docs/**` and `packages/**` are **not** CI triggers — no CI edit needed for this lane |

## The gap

There is **no audio-DSP surface anywhere in O-I** — no crate, no cradle panel,
no contract. The cradle's only audio material is the presentation-bounded PCM
playback of a *native owner's* output. The Live dynamics lane supplies the
missing native owner in the form of a clean-room crate whose sole authority is
the behavior documentation in this folder.

## Where things land (exact paths, decided)

1. **RE dossiers + session model + this map** → `docs/research/ableton-live-12.0.25/`
   (this folder; OpenRig precedent: source-locked, no vendored code, reopen-when).
2. **Clean-room Rust rebuilds** → `packages/live-dynamics/` — independent crate
   (own `Cargo.toml`, like `desktop/cradle/kernel`), the **single native owner**
   of the "clean-room device dynamics" audio domain. Its README states the
   clean-room rule: written from `docs/research/ableton-live-12.0.25/` behavior
   documents only; decompiled material never enters the crate.
3. **Verify gates** → golden renders + spectral-distance gates per device, run by
   the crate's own test harness (renders live under the research folder, not the
   crate); a `rust-live-dynamics` entry added to `gates/manifest.json` when the
   crate lands on a branch for review.
4. **Cradle wiring (future, not this lane)** → when the cradle wants these
   dynamics, the pattern is the focused-instrument pattern: a typed contract
   module beside `src/instrument/source.ts`, the crate compiled into the kernel
   (path dependency), the cradle side presentation/receipts only. Per the house
   rule, the DSP owner stays one: `live-dynamics` — the cradle never
   reimplements device behavior.

## Authorship note

This lane's files are generated commissioned work standing in the owner's
repository (working seat). Landing them on a branch / PR is the owner-visible
act that transfers authorship; until then the crate is a proposal in code form
per the authorship law.
