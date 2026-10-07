# ZCode desktop 3.14.3 — reverse-engineering study for the O-I cradle

Clean-room, document-only RE study commissioned by the owner (2026-10-07):
UI patterns, automations semantics, and the plugin/skill system surface of the
ZCode desktop app the owner possesses and runs — as a refinement source for the
O-I cradle. Every claim in the deliverables carries evidence, confidence and
limitations in the per-lane registers under `evidence/`.

**Status: generated study output — reference until adopted by the owner.**

## Deliverables

| Document | What it is |
|---|---|
| `UI-TOKEN-SHEET.md` | Design tokens: color roles, spacing, type, radii/shadows, motion, theming mechanics, layout geometry (measured) |
| `AUTOMATIONS-SEMANTICS.md` | Scheduled + off-peak automations: declaration, storage, trigger loop, dispatch state machine, late/missed semantics, lifecycle, reporting (+ live-verification addendum §11) |
| `PLUGIN-SKILL-CONTRACT.md` | Plugin/skill discovery, enable/disable, permissioning, marketplace pipeline, config-file map |
| `OI-INTEGRATION-MAP.md` | Per pattern: the exact O-I files that would adopt it, implied work, law check; explicitly-not-adopted records |
| `RECREATION-BACKLOG.md` | Done items, adoptable refinements with verify gates, standing not-adoptable records, open items |

## The recreation (owner directive: Rust)

`desktop/cradle/reference/zcode-automation-semantics/` — a dependency-free Rust
crate recreating the automation semantics **from this study's behavior spec**
(clean-room; no decompiled code transcribed): rule engine, cron carrier,
dispatch state machine, documented constants. `cargo test` = 26/26, including a
replay of the live probe and the observed late-skip. Reference until adopted;
not wired into the `oi-cradle-kernel` build.

## Method and lanes

Four bounded lanes (one question per agent), converged by the parent session:

- **A1 — UI/tokens** (static extraction + observe-only native captures +
  pixel measurement + twice-run `rea compare` determinism).
- **A2 — Automations** (read-only SQLite observation + scheduler-bundle code
  reading), with a **live scripted-clock test** run by the parent through the
  harness's own automation surface (writes the same store).
- **A3 — Plugin/skill contract** (config/plugin-store observation + CLI
  surfaces + reversible live enable/disable e2e).
- **B — O-I inventory** (read-only): maturity, extension points and gaps for
  seven pattern areas across `desktop/cradle` + `packages/oi-design-system`.

~27M subagent tokens across the four lanes; every mutation of the user's
installation was backed up and restored byte-identically (transcripts in
`evidence/e2e/`).

## Testing-gate verdicts

| Gate | Verdict |
|---|---|
| Token extraction reproduces real screens | **PARTIAL** — main screen measured within tolerance (sidebar 271px, composer 672×146 r12, chips 32px); settings/terminal not capturable this run (open item O1) |
| Automation triggers at documented time; late/idle semantics | **PASSED** — one-shot fired within one 20s tick, completed per spec; skip path verified by code + live sample; off-peak ticket/queue/sync observed live |
| Flow determinism (`rea compare`, twice-run scenario) | **PASSED** — byte-identical captures, verdict `identical`, 0 changed pixels |
| Permission contract enable/disable e2e | **PASSED** — skill disable cycle live, restore sha256-identical |

## Provenance

Subject: ZCode desktop 3.14.3 (`/Applications/ZCode.app`, bundle id
`dev.zcode.app`), studied in place plus an extracted tree; app's live stores
observed read-only except the two documented probe automations (one completed,
one queued) created deliberately as gate evidence. AIKit knowledge route
returned no prior art. Companion prior studies in this directory:
`ableton-live-12.0.25/`, `openrig-c8fca9d/`.
