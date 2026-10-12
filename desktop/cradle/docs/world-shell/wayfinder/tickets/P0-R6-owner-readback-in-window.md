# P0-R6 — Owner readback in the window: admitted, excluded, waiting

Label: wayfinder:task (Phase 0 gate — "every device either admits through a real owner or names its absence")
Claimed-by: — (released W0c, 12 Oct: blocked, zone-escape)
Blocked-by: a host field in `live_shell_config` disclosing the suite product
universe (owner or conductor go/no-go, PATH §10 item 24). UI legs blocked-by
the computer-use gate.

Zones: `packages/live-shell/ui/src/shell/` (a new owner-readback module and
its mount in the status/context region), `packages/live-shell/ui/src/native/application.ts`
(type the readback fields of `ShellConfig` only), tests under
`packages/live-shell/ui/tests/`. Host-side (Rust) changes are out of zone:
return `BLOCKED: zone-escape` if the readback is not already in
`live_shell_config`.

## Question

The native window must show which owners the host admitted and which it
did not, from the host's own readback — never from a file read beside it.
Factory, Workcell and QL are excluded in the 0/1/2 footprint (r1d
`7-catalogue.json` points them at `live-shell/unavailable/*`); the window
names none of them today (PATH §10 item 4; R0 objection 7).

## Sources

- PATH §10 item 4; R0 review objections (wave W0) on HONESTY.
- `desktop/cradle/src-tauri/src/native_shell.rs` — what `live_shell_config`
  already carries (contributions / product_ids / backing / the
  compiled·selected·registered·excluded·failed readings); read, do not edit.
- r1d evidence: `../../evidence/p0-r1/run-20261012T-r1d/`.
- WIDGET-GUIDE empty and refusing states; DLW-VISION §6 HONESTY line.

## Acceptance

1. One owner readback, from `live_shell_config` only, visible from every
   mode (status/context region): each product with its state —
   admitted / excluded-by-footprint / failed / absent — and the owner named.
2. Excluded-by-footprint reads differently from absent-because-unbuilt and
   from failed; each non-admitted owner carries its remedy where the host
   names one, else "no remedy named".
3. On the development browser path (no host readback) the module says so —
   it never fabricates a readback.
4. tsc zero; lane suites green; a new suite covers the three states and the
   no-readback case.
5. UI legs (pixels, both viewports): UNVERIFIED until computer-use.

## Resolution

**Blocked W0c, 12 Oct 2026** — `BLOCKED: zone-escape` to
`desktop/cradle/src-tauri/src/native_shell.rs`. Nothing written, no commit.

**Found (code-reading, conductor re-read `native_shell.rs:429-430`).**
`live_shell_config` carries `product_ids` (the backing's admitted list only:
0/1/2 = central, actuation, ai-kit) and `contributions` (owners oi,
ai-kit, software-factory; factory `owner_selected: false`, registration
excluded). Workcell and quaternal-logic appear in neither, so the host
readback cannot tell excluded-by-footprint from absent-because-unbuilt for
them. Acceptance 1 and 2 cannot be met from config as it stands. Hard-coding
the universe in the UI is refused (a second store; port and honesty laws).

**Proposed host change (owner or conductor go/no-go, PATH §10 item 24).**
Add a field in `candidate::config` carrying the footprint's backing-options
product list (full suite: central, actuation, ai-kit, software-factory,
workcell, quaternal-logic). Then a rebuild through the P0-R1 runner.

**In-zone design, ready once the host field lands.** A pure readback module
in `ui/src/shell/`: admitted / excluded-by-footprint / failed / absent, owner
named, remedy "no remedy named" (the host discloses none), and a "no host
readback" line on the development browser path. Mounted through
`RunContextReading` in `ui/src/shell/runContext.tsx`, which `StatusBar`
renders in every mode (`App.tsx:432`), so `components/StatusBar.tsx` stays
out of zone.

**Baseline (scripted).** tsc 0 errors; lane suites 143/143. The dispatched
test command's `tests/owner-readback*.test.mjs` glob matches no file yet
(PATH §10 item 34).

**Unverified (channel).** Every acceptance: nothing built. Acceptance 5 and
the window readback need `computer-use` (or scripted AX for text).

**Carries:** PATH §10 items 4, 24, 34.

**Conductor ruling, 12 Oct (PATH §10 item 24): go, option (a).** The host
publishes the suite product universe in `live_shell_config`: a field in
`native_shell.rs` `candidate::config` carrying the footprint's
backing-options product list, read from the footprint the host already
loads (never a literal list). The UI never hard-codes the universe (that
would be a second store). Two legs, run in order:
- **P0-R6-host** (zone `desktop/cradle/src-tauri/src/native_shell.rs` and
  its tests): the field, typed, with a test that it equals the footprint's
  list; `cargo check --features native_shell` green. Observing it needs a
  rebuild from the commit (P0-R1 runner), which the conductor runs.
- **P0-R6-ui** (the zone above): the readback module from the field —
  admitted / excluded-by-footprint / failed / absent, owner named, "no
  remedy named" where the host names none, "no host readback" on the
  development browser — mounted through `RunContextReading`
  (`src/shell/runContext.tsx`), which StatusBar renders in every mode.
