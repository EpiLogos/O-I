# P0-R1 — The native run path at HEAD

Label: wayfinder:task (Phase 0 gate)
Claimed-by: claude-code:dlw-conductor (2026-10-12)
Blocked-by: —
Supersedes: DEVELOPMENT-TRACK-2026-10-09 "R1"; EXECUTION-CONTINUATION item 5

Zones: `desktop/cradle/src-tauri/` (host glue only), `packages/live-shell/`
build scripts (`build-native-candidate.py`, `package-payload.py`,
`tauri.candidate.conf.json`), this ticket's evidence under
`desktop/cradle/docs/world-shell/evidence/p0-r1/`.

## Question

What is the one supported command that builds the `native_shell` Tauri host
from this seat at HEAD and opens the NEW shell in a native window, with
owners resolving through the host's `OWNERS` table, not through Vite or a
dev bridge standing in for the host?

## Known ground

- Host: `desktop/cradle/src-tauri/src/native_shell.rs` (feature
  `native_shell`), which compiles `packages/live-shell/src/{api,runtime,
  inhabitants}.rs` in.
- Producer: `packages/live-shell/build-native-candidate.py --build` →
  `package-payload.py`; `freeze-product-bindings.py` for owner binaries.
- `NATIVE-COMPOSITION.md`: candidate assets depend on compile-time
  development paths; the production Tauri join was pending. A dev bridge or
  copied asset directory is NOT installed acceptance — R1 is the run path,
  installed acceptance is Phase 5's.
- Last native candidate: 0.1.2, 8 Oct, source `99111821a` (stale).

## Acceptance

1. One documented command (recorded here and in PATH §2) builds the host at
   HEAD from the seat; build log with source revision kept in evidence.
2. The window renders the new shell from HEAD; the run context (native
   host, revision) is visible in the window — joint with P0-R5.
3. Owner discovery readings (compiled/selected/registered/excluded/failed)
   are observable in the window or its structured readback; ctrl resolves
   to the installed `7a45111`.
4. Window captured: computer-use if the channel is up, else a
   `screencapture` labelled `screen-capture (no interaction)`.

## Resolution

—
