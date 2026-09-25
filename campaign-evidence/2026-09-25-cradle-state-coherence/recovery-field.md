# O:I #65 recovery inhabitation — Cradle state-coherence recovery field

Campaign evidence · 2026-09-25 · basis revision `d68aef804277c65eeec0a1b47e31427a3dac4574` (main).

Recovered from: authored design (`docs/experience/FACTORY-AGENCY.md`, `docs/cradle/10-SIDEBARS.md`, `docs/cradle/11-FACTORY.md`, `docs/experience/WORKSPACE-CONTINUITY.md`, `docs/experience/DESKTOP-LANGUAGE.md` via `packages/oi-design-system/DESKTOP-LANGUAGE.md`, `docs/experience/UI-FUNCTION-LANDING.md`), implementation maps of `desktop/cradle/src` and `desktop/cradle/kernel` + `src-tauri`, git history of the 2026-09-22..25 UI lanes, and the O:I #65 issue thread. Provenance classification per campaign law:

- **human-authored intent** — DESKTOP-LANGUAGE rulings 1–8 (22 Sep), 10-SIDEBARS seven laws + D1–D6 + A1–A7 (22–23 Sep), FACTORY-AGENCY §1–14 (adopted 14 Sep), WORKSPACE-CONTINUITY (19 Sep), 11-FACTORY Desk/Tasks commission (18 Sep).
- **current adopted UX/design** — the 23 Sep accepted sidebar design; theme library (23 Sep); Document Surface (25 Sep).
- **architectural/native contract** — one typed `KernelOp` seam; receipt log + pull-is-truth; kernel owns semantic state, desktop owns presentation state.
- **current implementation** — main `d68aef80`; frontend single-scope/one-conversation law compliant; checkpoint v2 covers membership/arrangement/panes/selection/widths/navigator/engine-refs.
- **later amendment** — Inspect plane superseded by object pages (D1); Epi-Logos sixth entrance superseded by hidden-footer lens (D2/A5); six entrances superseded by four modes + Settings (23 Sep).
- **historical superseded implementation** — `agent/desk/*`, `techne/m0m5` UI, `contributions/factory/sidebar/{Run,Agents,Context}Plane.tsx`, `settings/v2/*`: all deliberately retired with cited successors (verified on main).
- **current observed behaviour** — the discrepancies below.

Git-recovery verdict: the merge waves lost almost nothing. Two real divergences exist and are **not** repaired here: `feat/techne-inheritance-restoration-20260925` is an active, unmerged lane in worktree `env-1` (one writer per mutable subject — untouched by this campaign); `feat/expressions-canonical-deep-links` is one unlanded site-library commit (public site, not the Cradle shell) — recorded for its own lane.

## Discrepancies (INTENDED / OBSERVED / OWNER / EVIDENCE / COST)

### R1. World context is owned twice — persisted `LayoutState.epiLogos` mirrors `context.world`

- INTENDED RELATION: "The selected world is independent of the arrangement" (`src/workspace/store.ts:54-59`); one owner per semantic datum; presentation derives from it (10-SIDEBARS law 3; 03-UX-STATES invariant "neither derives from the other").
- OBSERVED RELATION: `LayoutState.epiLogos` (boolean, persisted in the workspace book) is written in tandem by `enterEpiWorld`/`leaveEpiWorld` (`src/CradleFrame.tsx:1683-1690`); `DesktopShell` receives both `epiLogos={state.epiLogos===true}` and `world={workspace.current.context?.world}` (`src/CradleFrame.tsx:1762`); `publishLens` derives a third copy (`src/epilogos/lens.ts` via `CradleFrame.tsx:1696`). No reconciler; a restored v1 layout (`epiLogos:true`, absent context) or a decode drop drifts the copies.
- OWNER: workspace store + `CradleFrame` (desktop-owned presentation over the one workspace-owned world context).
- EVIDENCE: file:line above; the two props reach the same render tree.
- USER/AGENT COST: Epi-lens/mode drift after restore; every future lens/world feature must remember to write N copies; exactly the "duplicate state explains mode drift" leverage class.

### R2. Raw JSON as primary human surface (owner law violation, multiple primary sites)

- INTENDED RELATION: "No raw JSON in user surfaces … verbatim technical material sits only behind an explicit disclosure" (DESKTOP-LANGUAGE ruling 2, 22 Sep; 10-SIDEBARS §2 law 7); D1: inspecting opens object pages; receiving review renders the shared returned-document grammar (FACTORY-AGENCY §6–7).
- OBSERVED RELATION (render-path sites on primary surfaces, outside explicit collapsed disclosure):
  1. `src/knowledge/SearchOverlay.tsx:332` — `<details open>` pre-opened JSON "Owner evidence" in the ⌘K search overlay (S2).
  2. `src/knowledge/OwnerActions.tsx:60` — dispatch outcome payload as bare `<pre>` (S3).
  3. `src/explore/BeingEncounter.tsx:38-39` — proposal changes as `JSON.stringify(change)` list items; pre-opened raw invocation result (S3).
  4. `src/explore/ContributionPanel.tsx:54-55` — three bare JSON blocks as the Native-Return / return-state / Expression-return review cards; body falls back to `JSON.stringify(body.content)` as visible text (S3).
  5. `src/explore/ContextContributionPanel.tsx:20` — same body fallback (S3).
  6. `src/agency/MintAgent.tsx:299` — profile-use plan old/new values as JSON in `<dd>` (S3).
  7. `src/nara/NaraSurface.tsx:855` — `currentness` receipt as JSON in the visible Epii-proposals facts list (S3).
- OWNER: each rendering surface (explore receiving family, knowledge search/dispatch, agency mint, nara facts); the shared presentation idiom belongs in the receiving/object grammar that already exists.
- EVIDENCE: exhaustive render-path audit (every `JSON.stringify` in JSX classified; compliant "Show raw" depths excluded).
- USER/AGENT COST: the owner reads wire shapes where the design promises a person-readable review; the components predate the 22–23 Sep rulings — authored interaction lost in the law's gap, i.e. the "stale design implementation explains repeated reversion" class.

### R3. Factory re-entry does not restore the working state it already persists

- INTENDED RELATION: "Re-entry restores from canonical work refs plus presentation state" (FACTORY-AGENCY §1); the selected Run survives leaving/returning; continuity law: restore membership/selection across restart.
- OBSERVED RELATION: `FactorySelection` is session-only (`src/contributions/factory/sidebar/sidebarModel.ts:55`); Desk scroll/query are module vars (`src/contributions/factory/desk/deskStore.ts:226-231`); the last-run locator **is persisted** (`oi-factory-desk-last-run.v1`, `src/contributions/factory/desk/deskModel.ts:98-121`) but nothing reads it back to re-establish the selection.
- OWNER: desk store + sidebar selection model (desktop presentation state over native run refs).
- EVIDENCE: persisted locator has no read-side consumer; selection module resets on restart.
- USER/AGENT COST: every restart lands the operator on a neutral Factory shell; a persisted datum is written and never used (half-wired duplicate state path).

### R4. Whole WorldNavigator remount on workspace switch

- INTENDED RELATION: "Structural moves preserve document identity, revisions and drafts with zero owner re-reads" (continuity matrix, walk scenario-bindings); local change suffices where a local change is what happened.
- OBSERVED RELATION: `key={workspace.current.id}` on the navigator (`src/CradleFrame.tsx:1757`) rebuilds the entire tree (fresh reads, scroll loss, transient `directoryRefs` loss) on every workspace switch, though persisted `projectNavigation` restores expansion afterwards.
- OWNER: `CradleFrame` centre assembly.
- EVIDENCE: key forces identity change → React unmount/remount; reads re-fire.
- USER/AGENT COST: visible churn + latency per workspace switch; the exact "whole-tree reload where local change would suffice" pattern.

### R5. Dead duplicated Factory state paths (delete, don't wire)

- INTENDED RELATION: "Prefer deleting/connecting layers over adding another one."
- OBSERVED RELATION: `deskModel.rowCache`/`cacheDeskRow`/`peekDeskRow`/`deskRowForSession` have zero callers (the live join is `runsForSession` in `deskStore.ts:250-252`); the desk fixture store seeded by the dev "desk" scenario is never read by the board; `FactoryMaterialSurface` (fixture-disclosing view) and `useDeskFixture` are unreachable; dev-console `RunRow` component-owned reads never invalidate (`FactoryDevelopmentSurface.tsx:277-291`, DEV-gated).
- OWNER: contributions/factory.
- EVIDENCE: zero-caller grep; board reads `deskStore` only.
- USER/AGENT COST: a second row cache and a fixture path wait to be accidentally wired; tests or future contributors can mistake them for the live path.

### R6 (recorded, not first-vertical). Kernel-side starvation law holds; frontend settings read shape verified compliant

- The #65/#201 settings-kernel-starvation concern: prepared reads now execute outside the kernel lock (`src-tauri/src/owner_read.rs:14-34`, `kernel/src/knowledge_prepared.rs`), and `settingsData.ts:116-149` loads each settings part alone. The unlanded 22 Sep "settings face reads like a person" refinement (lazy suite reads) died with `settings/v2/*`; the current architecture already reads per-part. **Verification obligation**, not a repair: replay the 46-settings read scenario on installed software and confirm no unasked full-suite scan on mount.

### R7 (discovered by replay, 2026-09-25). The Factory Desk head is clipped at its top edge — pre-existing on main

- INTENDED RELATION: headers stand visible and hittable; "nothing clips it" (10-SIDEBARS §12 layout discipline; walk law).
- OBSERVED RELATION: `walk/scenarios/mode-workspaces.mjs:61` hit-tests `.mode-stage[data-mode="factory"] .fdesk-head` at (left+40, top+2) and the head does not contain the hit point; `elementFromPoint` resolves elsewhere (something overlaps or the head is scrolled under the stage's top edge after the walk's mode round-trips). FAILS IDENTICALLY on the unmodified base revision d68aef80 (verified by building and walking that revision) — introduced by the recent merge waves, not by this campaign's cut. The sibling check in `walk/scenarios/factory-desk.mjs:130` ("after the scrolls") is the same class.
- EVIDENCE: `walk/artifacts/mode-workspaces.json` receipts on both revisions, 11/12 checks each, check[7] false; the surrounding lens/world checks (lines 65–73) pass on the campaign cut.
- OWNER: Factory stage/head stacking or scroll geometry in the shell reconciliation lineage (`workspace/` stage slots + `contributions/factory/desk/Desk.tsx` head) — to be diagnosed with a stacking-context probe in the walk.
- USER/AGENT COST: the first interactive strip of the Factory Desk may be partially unreachable at its top edge after mode round-trips — an authored interaction regressed by merge, exactly the class this campaign hunts. **Selected as the first discrepancy of the next vertical.**

## Selection (contemplation basis)

Telos/obligations: the campaign's first vertical is the state spine + Factory desktop coherence; DESKTOP-LANGUAGE ruling 2 and D1 are owner law, not preferences; continuity law is a commissioned contract (WORKSPACE-CONTINUITY).
Capability/praxis: all repairs are frontend presentation-state work over existing native owners — no new framework, no kernel semantic change except none required.
Matrices/tests: each unit carries a real owner→consumer test route (persist→restore, dispatch→render, disconnect→degraded) replacing fixture-constructed assertions.

Resulting order:
1. **R1** (duplicate world-state removal) — smallest decisive state-spine repair; provable restore relation.
2. **R3** (Factory re-entry continuity + delete dead caches R5) — restores the authored re-entry interaction; removes a competing state path (criterion: "at least one duplicated/competing state path removed").
3. **R2** (payload presentation family, 7 sites) — restores the authored D1/law-7 interaction (criterion: raw-JSON primary surface replaced).
4. **R4** (navigator retained swap) — only if the stage-retention idiom applies cleanly; judge during repair, drop without ceremony if it risks the navigator's contract.

## As-executed (same day, basis d68aef804277c65eeec0a1b47e31427a3dac4574)

- **R1 — repaired.** `LayoutState.epiLogos` deleted (`surface/types.ts`), restore dropped (`surface/persist.ts`), the tandem writes and dead `epiLogos`/`world`/`onEpiLogosToggle`/`onLeaveWorld` props removed (`CradleFrame.tsx`, `workspace/DesktopShell.tsx` — DesktopShell already read only the lens store, which is published from `context.world`). Stale comments updated (`workspace/mode.ts`, walk scenario header). New relation test in `tests/mode-workspaces.test.mjs`: a legacy payload carrying `epiLogos:true` decodes without it; `context.world` remains the sole owner.
- **R3 — repaired.** `deskStore.ts` now persists the held Run selection as canonical refs (`oi-factory-desk-selection.v1`), re-establishing it from a reading that actually contains that run (`reestablishHeldSelection` + `deskKeyOfLocator`: exact statePath/projectRef/runRef identity; a locator the owner no longer answers re-establishes nothing). Board query persist immediately, scroll coalesced 250 ms (`oi-factory-desk-board.v1`), both restored at boot and on mount. Relation tests: `tests/factory-desk-reentry.test.mjs` (identity match, missing-run neutrality, no silent re-pointing, storage-less degradation).
- **R5 — deleted (wider than mapped).** Consumer audit showed the dev-scenario surface mounted nowhere: `ScenarioBar.tsx`, `fixtures/desk-board.ts`, `FactoryMaterialSurface.tsx` deleted; `sidebarModel.ts` shrunk to the live `FactoryPanelHost` type; `deskModel.ts` shrunk to `centreView` + remembered sources (dead: `deskDetail`, `lastDeskRun`, `rowCache` family, `deskGroupOf`, fixture store); the dev console's void publishes into `FactorySelection` removed. `tests/walk-runner` SCENARIOS references are the walk runner's own registry — unrelated.
- **R2 — repaired** (7 sites + shared idiom `src/shared/contributionPresentation.tsx`: `changeLine`, `ContributionText`, `RawDisclosure`). Search evidence and invocation results now collapsed by default with human summaries; review cards render their real fields; structured bodies render named summaries; raw payloads only behind collapsed `Show raw`. Law gate added to `tests/cradle-shell-antipatterns.test.mjs`. Worker finding recorded: NaraSurface's pre-opened `data-change-receipt` details (~line 860) is a further candidate outside the assigned sites.
- **R4 — reasoned return, not forced.** `WorldNavigator`'s read-guards (`directoryRefs`, `reported`, `entered`, pending/error/readFailure) are workspace-transient; a retained swap must re-key those guards by workspace identity or risk showing one workspace's tree for another — a coherence violation worse than the bounded remount it would replace. The durable layer (persisted `projectNavigation`: expansion, scroll, location) already restores. Returned as its own designed change.
- **Verification:** `tsc --noEmit` clean; full node suite green (112 files, incl. new `tests/factory-desk-reentry.test.mjs` and the law gates in `tests/cradle-shell-antipatterns.test.mjs`); production build green; the repaired search surface's browser contract passes on chromium + webkit (180 checks); `mode-workspaces` walk: every R1 lens/world relation passes on the cut (its one failing check is pre-existing on base — R7 below).

## Install and replay (2026-09-25 evening)

- **oi product:** managed update applied from the committed cut of main — installed `6e777b2740fb` → `8ceb2fc461fc`, atomic swap, receipt at the O:I managed root (`receipts/updates/active.json`, entry `oi`, branch main). `oi --version` reports `0.1.0 (8ceb2fc461fc)`.
- **Desktop surface — collision serialised, not clobbered:** the managed desktop install (`products/desktop`, `~/Applications/O-I.app`) was built and installed **today 19:55Z from the active techne lane's tip `b59973bb`** (worktree env-1, branch `feat/techne-inheritance-restoration-20260925`), and the app is running. Per one-writer-per-mutable-subject this campaign did not replace it. A bundle built from the campaign cut is staged beside this file (`staged-desktop-bundle/oi-cradle-0.1.0-aarch64-apple-darwin.tar.gz`, BUNDLE.json `source_revision 8ceb2fc4…`, sha256 `ba9beb88…`; binaries are left untracked by intent); the coordinated swap is `oi desktop install --bundle <staged archive>` once the techne lane releases the desktop surface or consents.
- **Replay verdict:** source relations proven by real browser contracts and walks; the managed CLI install of the same cut is receipted; the desktop replay on installed software is the named remaining act of the coordinated swap above.
