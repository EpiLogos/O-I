# agent/oi-desktop-p1-host-105

`origin/agent/oi-desktop-p1-host-105` @ 8b58880 (2026-08-19) · 21 commits ·
Class A QUARRY-DESKTOP (§3) · ancestor of `agent/oi-desktop-p5-system-109`.
Contract of record already on main:
`docs/OI-DESKTOP-P1-HOST-INTEGRATION-CONTRACT.md`.

## What it is

The P1 host integration line: how a native Surface/contribution gets placed
into a host region generically, how ContextResolution availability survives
the bridge, and how the Tauri bridge emits Actions. Small but foundational —
it fixes the placement and emission contracts every later branch builds on.

## Feature/function inventory

- **Region-generic Surface placement** —
  `desktop/ui/src/workbench-host.tsx` + test: "make native Surface placement
  region-generic"; test locks "region-generic Surface placement and native
  availability" with typed host regions (Canvas/Inspector/RootAgency/…), so
  any native contribution can land in any disclosed region without
  per-surface hard-coding.
- **ContextResolution availability guard** — `fix: preserve AIKit
  ContextResolution availability shape`; `fix: make ContextResolution
  non-resolver guard self-consistent`: the desktop renders AIKit's
  resolution availability honestly (available ≠ resolved ≠ active).
- **camelCase Action emission** — `fix: preserve Tauri camelCase Action
  emission contract`; test "follow canonical camelCase Action emission
  projection": the bridge emits Action events in the canonical camelCase
  projection so UI and core agree without a second mapping.
- **Contextual Action authority test bed** —
  `desktop/core/tests/contextual_action_authority.rs` (first home of the
  authority-seam tests later carried on flow-138): pre-issued grants only,
  discovery never becomes authority, ambiguity fails closed.
- **Native command surface** — `desktop/ui/src/native-command.tsx/.css`:
  the command surface rendering native contributions' disclosed Actions
  (the forerunner of the cradle's command aperture U3.1).

## Map-unit mapping

- Region-generic placement + typed host regions → §2.1 contribution-field
  chain ("Navigator | Canvas | Sidecar | Inspector | Lower | System |
  Command") and **U0.3b Surface management system** (§5 P0).
- ContextResolution availability honesty → **U3.1** aperture rows (every row
  carries owner/provenance/actions) and law 7 honesty.
- Authority-seam tests → D15 component vein (§3): "invocation crosses the
  authority seam at commit time".

## Quarry verdict

**KEEP-FOR-UNIT** — U0.3b/U3.1 contract shape (placement grammar, emission
projection, availability guard). The code is removed with the desktop; the
contracts are the quarry.
