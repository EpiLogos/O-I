# P0-R5b — Run-context follow-ups and the restored receipt

Label: wayfinder:task (Phase 0)
Claimed-by: — (released W0d, 12 Oct: committed; UI legs open)
Blocked-by: P0-R6 — landed W0d (`2ac3c157f`, `c4761bfd0`). UI legs
blocked-by the computer-use gate.

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

### W0d — landed, 12 Oct 2026 (UI legs open)

**Landed `e736ce78c`** (zone `packages/live-shell/ui/src/` files named
above and `ui/tests/`; nothing under `src/inhabitants/sdk/`). Ran after
P0-R6-ui in the same wave, as ruled.
- **(a)** `subscribeShellConfig` in `native/application.ts` (`:109`),
  announced for each settled current request (value or failure), not for
  cached reads or superseded requests; `RunContextReading` subscribes
  (`runContext.tsx:91`) and follows refreshes.
- **(b)** The three partial carrier readings route through the existing
  `carrierOf`: `ModeBrowser.tsx:128` (World row), `ModeContextDock.tsx:209`
  (carrier row), `App.tsx:358` (transport link). No second reading. A guard
  fails if a bare `transport.kind` is shown as the carrier.
- **(d)** `carrierForRead` (`runContext.tsx:78`) reads "configuration not
  read" when the read failed and "not yet read" only before it settles.
- **(18)** The `native_outcome` receipt is restored in
  `NativeMaterialBrowser.tsx:132` as a folded developer view
  (`<details data-developer-view="native-outcome">`) beneath the
  `OwnerRefusal` words, for perform/play and save-as-reusable refusals;
  allowlisted by name in `tests/run-context-refusal-guard.test.mjs`
  (`DEVELOPER_DISCLOSURES`, `FOLDED_RECEIPTS`), which requires the JSON
  exactly once, inside that view. `ProductPreferences` stays JSON-free.
- **(20)** and **(c)** unchanged, as ruled.

**Checks (scripted, converge re-run).** tsc 0 errors; lane suites 166/166
at `e736ce78c` (+8: `tests/run-context-followups.test.mjs` 5;
refusal guard one test replaced by two, one added). Every cite re-opened.
Conductor re-run at `4a5887376`: lane suites 169/169, tsc 0.

**Acceptance.** (a), (b), (d), (18) each done with a test; tsc zero; lane
suites green; refusal guard green with the receipt allowlisted by name. UI
legs not met.

**Unverified (channel `computer-use`).** (a) the reading updating live
after `readShellConfig(true)` in the native window (re-render is
code-reading only; `renderToStaticMarkup` runs no effects); (b) the longer
carrier wording fitting the three rows, both viewports; (d) the "configuration
not read" text in the window; (18) the folded receipt's look. No build or
launch from `e736ce78c` yet (PATH §10 item 36).

**Behaviour change, accepted by the conductor as the ticket's
consequence:** the three carrier readouts now show `carrierOf` wording
("Native owner configuration" / "Development native bridge" / the
unavailable reason) where they showed `tauri` / `bridge`.

**Carries:** PATH §10 items 40 (UI legs), 41 (the `owner-receipt` details
has no style rule — follow-up to file), 42 (wording change), 45 (shared
mount), 46 (WIDGET-GUIDE §8 proposals). Items 17 (a)/(b)/(d), 18, 31 and 35
are done.
