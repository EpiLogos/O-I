# P0-R5 — Run-context disclosure and disclosure components

Label: wayfinder:task (Phase 0)
Claimed-by: —
Blocked-by: — (acceptance in the native app blocked-by P0-R1)

Zones: `packages/live-shell/ui/src/` — a new disclosure component module
plus the call sites that today dump raw JSON or raw error strings into
panels; tests under `packages/live-shell/ui/tests/`. Builder discovers the
exact call sites first and returns them before editing if they exceed 12
files.

## Question

1. The shell must state, visibly and always, which world it runs in: native
   host at revision X / fixture harness / development browser surface.
   "A screenshot must never again be mistakable for the product"
   (DEVELOPMENT-TRACK-2026-10-09 R5; DLW-PLAN §9.2 Phase 0 item 4).
2. Raw JSON error dumps in panels become disclosure components: the owner,
   the operation (boundary_op), the refusal in the owner's words, the
   remedy where the owner names one.

## Sources

- DLW-PLAN §9.2 Phase 0 gate; §11 honesty law.
- WIDGET-GUIDE: empty and refusing states sections.
- Existing context readers to port from, not duplicate: `src/shell/modeGrammar.ts`,
  `src/native/Workbench.tsx`, `src/settings/HarnessPreferences.tsx`
  (all mention a run/host context — find the existing reading first).

## Acceptance

- One run-context reading, from what the host actually supplies (no
  guessed environment), rendered in the status region in every mode.
- No panel renders raw JSON for an owner refusal; grep-based test guards it.
- tsc zero; existing suites (mode-grammar, mode-surface-fidelity,
  live-mode-place, inhabitant-manifest, agent-*) stay green; a new suite
  covers the component and the guard.
- UI legs: UNVERIFIED until the conductor's computer-use pass in the native
  app (P0-R1).

## Resolution

—
