# P0-R6 — Owner readback in the window: admitted, excluded, waiting

Label: wayfinder:task (Phase 0 gate — "every device either admits through a real owner or names its absence")
Claimed-by: —
Blocked-by: — (UI legs blocked-by the computer-use gate)

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

—
