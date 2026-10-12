# P0-R5b — Run-context follow-ups and the restored receipt

Label: wayfinder:task (Phase 0)
Claimed-by: —
Blocked-by: P0-R6 (both touch the status region; run after it)

Zones: `packages/live-shell/ui/src/` files named below, tests under
`packages/live-shell/ui/tests/`.

## Question

Finish what P0-R5 left (PATH §10 items 17, 18, 20):

(a) `RunContextReading` reads `readShellConfig` once per `StatusBar` mount;
    subscribe it to config refreshes (`readShellConfig(true)`).
(b) Consolidate the partial carrier readings at `ModeBrowser.tsx:127-130`,
    `ModeContextDock.tsx:208`, `App.tsx:355-357` through
    `runContextOf`/`carrierOf` (port, no second reading).
(d) In the error state the carrier reads "not yet read" although the read
    failed — it must say "configuration not read".
(18) **Conductor ruling, 12 Oct:** P0-R5 removed the retained
    `native_outcome` receipt from `NativeMaterialBrowser`. Receipts stay
    intact (aperture law; established behaviour is not removed when fixing
    adjacent UI). Restore it as a folded developer view beneath the owner's
    words, allowlisted in the refusal guard by name.
(20) **Conductor ruling, 12 Oct:** no "fixture harness" label until a host
    supplies a fixture marker — the reading stays native host / development
    browser / pending. Nothing to build; record it in the Resolution.
(c) stays as is (the Settings acknowledgement JSON is an allowlisted
    developer disclosure).

## Acceptance

Each of (a), (b), (d), (18) done with a test; tsc zero; lane suites green;
refusal guard green with the receipt allowlisted by name. UI legs
UNVERIFIED until computer-use.

## Resolution

—
