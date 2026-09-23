# Merge orienter — the shell-law UI/UX programme (for the lane-harmonisation session)

*Written 2026-09-23 08:49 for the session merging this work with the
parallel general UI upgrade (theme library, revamped settings). Read this,
the dossier (docs/experience/HARNESS-SETTINGS-RESEARCH-2026-09-22.md) and
the session return (ProjectCentral/now/agents/ui-ux-fix-programme-all-lanes-landed-2026-09-23.json)
before touching files.*

## Where the work is

Branch `ui/shell-law-2026-09-22`, 33 programme commits, carried forward into
the checkout's current branch `ui/theme-library-2026-09-23` (38 ahead of
main) — the parallel UI merges (#477 Prime-QL body, #478 dev project, #479
one-sidebar-design, #480 wiki-map re-land) are already folded in ON TOP of
my line, via merge 48656b48. My work is therefore already the base of the
theme-library branch; the harmonisation question is not "merge two
branches" but "keep my invariants through further UI work".

## The five areas my commits own (file-level merge map)

1. **Settings v2** (highest overlap with a parallel settings revamp):
   `src/workspace/settings/v2/SettingsHome.tsx`, `v2/panels.tsx` (Status /
   Harnesses / Models / Credentials / Skills panels), `v2/axisDisplay.tsx`,
   `src/configuration/systemDisclosure.ts` (NEW — the suite read seam),
   `src/configuration/sourceHost.ts`, `src/workspace/settings/v2/vocabulary.ts`.
   DELETED on purpose: `src/configuration/ChatHarnessPanel.tsx`,
   `src/configuration/harnessFixture.ts`. Dumps demoted: DevView, SetupFlow
   default-path ceremony, GroundChooser recognition dump, AdoptionFlow
   native_plan, per-product developer records (commit 910642a5).
2. **Acceptance corpus**: `walk/lib/read-model.mjs` (assertNoRawJson — L5),
   `walk/lib/settings-sections.mjs`, `walk/live-settings-acceptance.mjs`,
   `walk/scenarios/{configuration,system-settings,factory-development,rest,flow-canvas,document-entry}.mjs`,
   `scripts/receipt-lint.mjs` (+ `npm run lint:receipts`),
   `tests/chat-settings.test.mjs`, `tests/verify-shell-evidence.*`,
   regenerated receipts under `walk/artifacts/` (spec_ref + grade on every
   receipt).
3. **Sidebar / agent planes**: the returns→receiving rename sweep
   (`ReceivingTray`, `receiving.css`, `navigator.css`, `EditorChrome`,
   Factory `ReturnsBand` deleted), `src/agent/planes/InspectPlane.tsx`
   (known-kinds reader registry), `src/shared/SideSection.tsx` + `side.css`
   (NEW primitives), `.factory-side-*` CSS → `.oi-side-*`, PlaneNav glyphs,
   composer harness/model chips.
4. **Rest page**: `src/Rest.tsx` (Day / Card / Graph / Search / Start
   writing), `src/CradleFrame.tsx` (onCard/onGraph wiring + the
   `windowLights` signal), `documents/oi-epi-card.html` (NEW, derived from
   the Epi-Card spec + recovery bundle), `src/flow/documentForms.ts`
   (fresh-listing fix).
5. **Corner regime**: `src/expressions/hostedApp.ts` (posts cutout
   {width, height, right}), `tests/window-lights-contract.test.mjs` (7
   checks), the shell.css corner rules (unchanged square notch).

## Load-bearing invariants — a merge that breaks these is wrong however it builds

- **The suite read is lazy.** `SettingsHome` reads Status/Harnesses/Models/
  Credentials/Skills only when a suite panel opens. Mount-time suite reads
  fire CLI-heavy kernel ops into the kernel's ONE serialized lock, starve
  every other read, and the page's own transports die ("Failed to fetch" —
  observed). Same law: the face renders shell-first with distinct
  loading/unavailable/failed states; never gate the whole page on reads.
- **Live acceptance reads the SAME seam the page reads** —
  `system_composition_read` over the bridge, not the ambient `aikit` CLI
  (different project context; the skills active axis genuinely differs).
- **Deleted files stay deleted**; reinstated census tables fail the walks.
- **Nothing user-visible says "returns"** — `factory-development` runs a
  visible-text scan (L7).
- **Every receipt carries spec_ref + grade**; `verify-shell-evidence` never
  emits `passed:true` without a grade-A (live/installed) input.
- **The corner contract test pins the corner geometry by regex.** The wedge
  decision (A square / B diagonal / C chamfered — owner's eye, still open,
  see ProjectCentral/now/flows/wedge-reauthoring-proposal-2026-09-23.md)
  amends that gate link IN THE SAME COMMIT as the geometry.
- **Walk selectors follow real markup, assertions never weaken.** A revamp
  that moves settings markup updates the scenario selectors; the checks'
  semantics (content equality, round trips, honest states) are the
  acceptance and do not move.

## Verification bar (all green at my last head; re-run after merging)

```
cd desktop/cradle
npm run build
npm run lint:receipts
node --test tests/window-lights-contract.test.mjs   # 7/7
node walk/run.mjs rest flow-canvas                   # 22/22 · 26/26
node walk/run.mjs system-settings                    # 44/44
node walk/run.mjs configuration                      # 65/65
node walk/run.mjs factory-development                # 55/55
node walk/run.mjs document-entry                     # 31/31
node walk/run.mjs receive-recover receive-include now-relations  # 14 · 11 · 15
```
Take the advisory lock `mkdir /tmp/cradle-walk-lock` before walk runs
(port 4173 is shared with parallel sessions; two lanes ran walks at once on
09-22/23 and produced spurious reds).

## Named reds — pre-existing, not absorbed by my lanes

`navigator` (projectcentral.flow.list refusal), `modes` (timeout at open),
`first-vertical` + `leave-reenter` (register-follows-work legs),
`a2a-exchange` + `shared-field-return` + `context-draft` (#441
selection-attach path). Also honest negatives to keep: the skill-proposal
leg has no native seam on this cut; the Agents roster situates by the
grounded project.

## In flight right now (08:49, uncommitted, not mine)

The theme-library lane's working edits: `VisualsView.tsx`, `visuals.css`,
`ParticleExpression.tsx`, `visuals/store.ts`, `TerminalSurface.tsx`,
`main.tsx`, `index.html`, `tauri.conf.json`, design-system `themes/` +
`scripts/` + `theme-convert.test.mjs`, `docs/THEME-LIBRARY.md`. Disjoint
from my settings work except by location: `VisualsView` sits under
`src/workspace/settings/` — my lane left the Appearance panel alone by
design (dossier §2 row 7), so the two can coexist; just don't let a
settings refactor orphan it.

## The corner: closed

Ruled 2026-09-23: the wedge is the restored component gated by
`tests/window-lights-contract.test.mjs` — no shape decision exists or is
owed. The re-authoring options in
`wedge-reauthoring-proposal-2026-09-23.md` are withdrawn; that file remains
only as the geometry record and the laws future corner work answers to.
The branch comes into main after the parallel UI work lands; nothing else
is pending from the shell-law programme.
