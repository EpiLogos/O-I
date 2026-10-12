# P0-R5b — Run-context follow-ups and the restored receipt

Label: wayfinder:task (Phase 0)
Claimed-by: — (released W0c, 12 Oct: blocked-by P0-R6)
Blocked-by: P0-R6 (both touch the status region; run after it)

Zones: `packages/live-shell/ui/src/` files named below, tests under
`packages/live-shell/ui/tests/`.

## Question

Finish what P0-R5 left (PATH §10 items 17, 18, 20):

(a) `RunContextReading` reads `readShellConfig` once per `StatusBar` mount;
    subscribe it to config refreshes (`readShellConfig(true)`).
(b) Consolidate the partial carrier readings at `ModeBrowser.tsx:126-130`
    (transport `:126`, carrier `:127`, World row `:130`; re-opened W0c),
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

**Blocked W0c, 12 Oct 2026** — blocked-by P0-R6 (header), which is itself
blocked (zone-escape, PATH §10 item 24). Nothing written, no commit. The
dispatch went out before PATH listed this ticket as claimable.

**Checked (scripted / code-reading).** tsc 0 errors; lane suites 143/143
(baseline). Cites re-opened: `ModeContextDock.tsx:208` and
`App.tsx:355-357` hold; `ModeBrowser.tsx` carrier reading spans `:126-130`
(header updated). `NativeMaterialBrowser.tsx:131` renders `OwnerRefusal`
with `retainedOutcome`; the folded `native_outcome` receipt is still absent
(item 18 open).

**Item (20).** Conductor ruling recorded: nothing to build. No "fixture
harness" label until a host supplies a fixture marker; the reading stays
native host / development browser / pending.

**Unverified (channel).** (a), (b), (d), (18): not implemented. UI legs need
`computer-use`.

**Ordering — conductor call (PATH §10 item 31).** Land P0-R6 first, or rule
that (d) and (18) run ahead of it while (a) and (b) wait.

**Carries:** PATH §10 items 17, 18, 31, 34, 35 (the rerun reads
DLW-VISION §0 as well as §6).

**Conductor ruling, 12 Oct (PATH §10 item 31):** P0-R5b runs after P0-R6's
UI leg in the same wave; all of (a), (b), (d), (18) together. The
ModeBrowser carrier reading spans `:126-130`.
