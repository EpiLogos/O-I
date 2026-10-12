# P0-R6 — Owner readback in the window: admitted, excluded, waiting

Label: wayfinder:task (Phase 0 gate — "every device either admits through a real owner or names its absence")
Claimed-by: — (released W0e, 12 Oct: P0-R6b host and UI code legs committed; UI legs open)
Blocked-by: — for code (host fields landed W0d `2ac3c157f` and W0e
`1f9b04034`). UI legs blocked-by the owner unlocking the login session (the
r1f readback saw 0 AX windows, PATH §10 item 48), then an in-window readback
(PATH §10 item 36), and the computer-use gate.

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

### W0d — host field and UI readback landed, 12 Oct 2026 (ticket open for its UI legs)

**Landed.**
- **P0-R6-host `2ac3c157f`** (zone `desktop/cradle/src-tauri/src/native_shell.rs`
  only, +112/-1). `candidate::suite_product_ids` (`native_shell.rs:73`)
  reads the union of the footprint's `backing.options[*].products` from the
  footprint `prepare()` already qualifies, filtered through the existing
  `OWNERS` table (`:36-48`) in its order; no literal list. It is called
  after `runtime::qualify` (`:223`); the host refuses to start when the
  selected backing names a product outside the universe (`:224-230`); the
  value is held in the `RUNTIME` slot (`:427`) and published as
  `live_shell_config.suite_product_ids` (`:474`). For
  `desktop/install-footprint.json` it yields central, actuation, ai-kit,
  software-factory, workcell, quaternal-logic; the default 0/1/2 is a strict
  subset. Four tests in `candidate::suite_product_ids_tests` (`:493`):
  universe equals the backing-options union, default backing leaves named
  products outside, a product with no host owner refuses, a footprint with
  no options refuses.
- **P0-R6-ui `c4761bfd0`** (zone `packages/live-shell/ui/src/shell/`,
  `ui/src/native/application.ts` types, `ui/tests/`). New
  `ui/src/shell/ownerReadback.tsx` + `.css`, mounted through
  `RunContextReading` (`runContext.tsx`, now a fragment), which `StatusBar`
  renders in every mode. Reading: admitted = `product_ids`;
  excluded-by-footprint = in `suite_product_ids`, not in `product_ids`;
  failed = a contribution with `registration: "failed"` (owner's words from
  `failure`); absent = not in the universe ("absent, not compiled into this
  build" for a `compiled: false` row, "absent, the footprint does not offer
  it" otherwise). Every non-admitted row reads "Remedy: no remedy named"
  (the host names no remedy field). The development browser draws "No host
  readback" with no rows and no chips. Extra tested states: "not disclosed"
  (a host build without `suite_product_ids`) and pending / unread.
  `ShellConfig.suite_product_ids?: string[]` (`application.ts:22`). New
  suite `tests/owner-readback.test.mjs` (10 tests), including a guard that
  the module hard-codes no suite product id.

**Checks (scripted, converge re-runs).** Host: `cargo check --features
native_shell` green (15 warnings, none in `native_shell.rs`); `cargo test
--features native_shell` 34 passed / 3 ignored, the 4 new tests passing,
re-run on the clean committed tree. UI: tsc 0 errors; lane suites 158/158 at
`c4761bfd0`. Conductor re-run at `4a5887376` (wave HEAD): lane suites
169/169, tsc 0.

**Acceptance.** 1–4 met in code and tests, verified against fixture configs
only. 5 not met.

**Unverified (channel).**
- `suite_product_ids` and the readback in a running native window: needs a
  rebuild from the clean committed tree through the P0-R1 runner
  (`source_dirty: false`) and a `readback` (channel `scripted`, AX) — PATH
  §10 item 36.
- `prepare()` wiring (`:223`, `:224-230`, `:427`, `:474`): code-reading
  only; the unit tests cover the pure reader, not the Tauri bootstrap.
- Acceptance 5, both viewports, the status-region look and chip overflow:
  `computer-use` (PATH §10 item 37).

**Carries:** PATH §10 items 36, 37, 38 (absent-vs-unbuilt split is partial),
39 (needs-owner: display names vs ids), 44 (extra states), 45 (shared
mount with P0-R5b), 46 (WIDGET-GUIDE §8 proposal). Items 4 (code landed),
24 and 34 are done.

**Conductor ruling, 12 Oct (PATH §10 item 39): the host discloses display
names.** The Rust `OWNERS` table in `native_shell.rs` already holds each
owner's public name (Central, AIKit, Software Factory, Workcell, Quaternal
Logic, …); `live_shell_config` gains a `suite_owner_names` map from that
table (no new literal list), and the readback shows the name with the id as
secondary text. The shell still hard-codes nothing. Legs: **P0-R6b-host**
(native_shell.rs + tests), **P0-R6b-ui** (the readback module + its test).
Item 38 (absent-vs-unbuilt is only partial where no contribution row exists)
stays a named limit in the readback's wording, not a fix.

### W0e — P0-R6b display names landed, 12 Oct 2026 (ticket open for its UI legs)

**Landed.**
- **P0-R6b-host `1f9b04034`** (zone `desktop/cradle/src-tauri/src/native_shell.rs`
  only, +46/-2). `candidate::suite_owner_names` (`native_shell.rs:104`)
  maps each product id in the suite universe to its public name from the
  existing `OWNERS` table (`:36-48`, fourth column); no literal list. An id
  with no host owner is refused, never named. Computed in `prepare()` right
  after the subset check (`:249`), held in the `RUNTIME` slot (`:446`) and
  published as `live_shell_config.suite_owner_names` (`:496`). Two tests in
  `suite_product_ids_tests` (`:578`, `:593`): the map's keys equal the
  universe and each value equals the `OWNERS` name; an unowned id refuses
  and an empty input gives an empty map.
- **P0-R6b-ui `c287c379c`** (zone `ui/src/native/application.ts`,
  `ui/src/shell/ownerReadback.{tsx,css}`, `ui/tests/owner-readback.test.mjs`).
  `ShellConfig.suite_owner_names?: Record<string,string>`
  (`application.ts:28`). `displayNameOf` (`ownerReadback.tsx:69`) accepts
  only an own, non-empty string key; the row draws the host display name
  first, the product id in parentheses as secondary text
  (`.owner-readback-id`, `ownerReadback.css:5`), then the state after a
  middle dot — e.g. "Software Factory (software-factory) · excluded by
  footprint". An owner with no host name is drawn by its id alone. A
  malformed map (null, array, string, non-string value, whitespace-only) or
  an inherited prototype key names nothing. The development browser still
  draws "No host readback" with no rows and no names. Five new tests (15 in
  the suite), including a guard that the module quotes none of the host's
  display names.

**W0d cites refreshed** (re-opened after `1f9b04034`): the
`suite_product_ids` call is now `native_shell.rs:241`, the subset refusal
`:242-248`, the `RUNTIME` slot `:446`, the config field `:493`, the test
module `:515`.

**Checks (scripted, converge re-runs).** Host: `cargo check --features
native_shell` green (15 warnings, none in `native_shell.rs`); `cargo test
--features native_shell` 36 passed / 0 failed / 3 ignored, re-run on the
clean committed tree. UI: tsc 0 errors; lane suites 174/174 at `c287c379c`.

**Acceptance.** 1–4 met in code and tests (fixture configs only), now with
display names per the ruling on PATH §10 item 39. 5 not met.

**Unverified (channel).**
- `suite_product_ids`, `suite_owner_names` and the readback rows in a
  running native window (`scripted`, AX). The conductor rebuilt r1f from
  the clean tree at `b57c206e5` (which holds both P0-R6b commits;
  `source_dirty: false`), but its readback saw 0 AX windows: the login
  session has been screen-locked since 16:08:56Z (`CGSSessionScreenIsLocked
  1`). Re-run `readback` after the owner unlocks (PATH §10 items 36, 48).
- `prepare()` wiring (`:249`, `:446`, `:496`): code-reading only. The
  refusal inside `suite_owner_names` cannot fire from `prepare()`, since
  `suite_product_ids` already refuses an id with no `OWNERS` row; it is
  harmless defence, covered by its own test.
- Acceptance 5, both viewports, the status-region look and the width of
  "name (id)" in the narrow status bar (the chip is nowrap and
  overflow-hidden, so truncation is expected but not seen): `computer-use`
  (PATH §10 item 37).
- The development-browser path drawing no names: tested in code, not seen
  in a browser.

**Carries:** PATH §10 items 36, 37, 48, 49, 50 (WIDGET-GUIDE §8 proposal:
name first, id in parentheses). Item 39 is done in code.
