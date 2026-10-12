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

**Blocked 12 Oct 2026** — no edits, no commit. The builder stopped at this
ticket's 12-file rule and returned the call sites.

**Discovered (code-reading).** (A) Run context: port
`src/native/configuration.ts:45-46` and `src/native/application.ts:33-37`;
the host already emits `source_revision`/`source_tree_sha256` in
`live_shell_config` (`src-tauri/src/native_shell.rs:429`) but `ShellConfig`
(`application.ts:14-31`) does not type them. Render in `StatusBar.tsx`
(mounted at `App.tsx:432`, `:439`); consolidate partial readings at
`ModeBrowser.tsx:127-130`, `ModeContextDock.tsx:208`, `App.tsx:355-357`.
(B) Raw JSON `<pre>` dumps: 6 files; owner refusals are `RefusalCard.tsx:99`
(reuse its `refusalLine`), `NativeMaterialBrowser.tsx:129`,
`ProductPreferences.tsx:15`. (C) Raw error strings: 64 `role="alert"` files.

**Rescope (conductor, 12 Oct).** This ticket is (A) + (B). The guard forbids
raw JSON for an owner refusal only, as the acceptance reads; developer
disclosures (inspector set summary, SettingsWorkspace plan blocks) are not
refusals. (C) goes to a follow-up ticket (PATH §10 item 11).

**Baseline (scripted).** tsc 0 errors; lane suites 125/125 pass.

**Unverified.** Everything: nothing built. Revision on the development
browser path (the `/api/config` producer was not traced) — the reading says
"no revision" there until it is. UI legs need `computer-use` in the native app.

**Carries** (PATH §10 items 2, 11).

### W0b — (A) + (B) landed, 12 Oct 2026

**Landed.** `f5adaa2ab` (builder, converged and pushed by the conductor).
(A) `native/application.ts` types `source_revision`, `source_tree_sha256`
and `source_dirty` on `ShellConfig` (from `native_shell.rs:429`, `:433`);
`shell/runContext.tsx` (new) holds `runContextOf` and `carrierOf` (labels
ported from `native/configuration.ts:46-47`) and the `RunContextReading`
span; `components/StatusBar.tsx` mounts it (`data-region=run-context`), so
it renders on both shell paths (`App.tsx:432`, `:439`). States: native host
at a disclosed revision with tree digest and dirty flag; development browser
"no revision disclosed"; pending before the read; an unreadable
configuration names its failure. Malformed revisions are rejected. (B)
`components/OwnerRefusal.tsx` (new) reuses `refusalLine`
(`agent/RefusalCard.tsx:105`): owner, operation, the owner's words, a remedy
only when the owner names one, the retained copy ref, no receipt and no
preformatted block. It replaces the raw `<pre>` dumps in
`NativeMaterialBrowser.tsx` and `ProductPreferences.tsx` (whose success
output is now named rows). Guard: `tests/run-context-refusal-guard.test.mjs`
fails on `JSON.stringify`/`safeJson` in those two files and on any raw JSON
`<pre>` across `src` outside four listed developer disclosures.

**Checks (scripted, conductor re-run).** tsc 0 errors (baseline 0); lane
suites 143/143 (baseline 125 + 18 new in `run-context.test.mjs` and
`run-context-refusal-guard.test.mjs`); diff is exactly the 8 claimed files.

**Native-app reading (from P0-R1 r1d, `scripted` AX).** The window's status
region reads "Native host · revision b50b970c3b92" with no
uncommitted-changes suffix.

**Unverified (channel).** The reading and the refusal card in pixels in
every mode (`computer-use`); the span's title (digest, carrier) is not in
the AX tree (`computer-use`, hover). Development-browser wording and the
status region were checked only as static markup (`renderToStaticMarkup`);
no browser or dev server ran and the `/api/config` producer is not traced.
The reading does not refresh on `readShellConfig(true)`.

**Carries** (PATH §10 items 2, 11, 17, 18, 20, 21): refresh subscription;
consolidate the partial carrier readings (`ModeBrowser.tsx:127-130`,
`ModeContextDock.tsx:208`, `App.tsx:355-357`); `SettingsWorkspace.tsx`
JSON acknowledgement (allowlisted); "not yet read" carrier in the error
state; the removed `native_outcome` receipt in `NativeMaterialBrowser`
(behaviour change, to confirm); **needs-owner:** the "fixture harness" kind
has no producer and is not rendered; WIDGET-GUIDE §8 proposals; (C) the
64-file error-string sweep.
