# Final native UI verification after accepted-main reconciliation

O:I accepted main basis: `0df0680cedaa4455069d1150510480f43fe159f4`.
Validated UI commit: `4032740d6bcb16d09a2d9f253fbde2cca9a20f78`.
Current native Expression owner: `91db8428fc9dfba06cd258ec5a58e7dd9eef5313` (O:I intake `f67161c7`).
Exact source and real QL snapshot hashes: `final-native-verification-basis.json`.
These results supersede the prior cue receipt's pre-forward-port limitation.

## Scoped follow-through

KnowledgeEncounter now supplies `appearance: "host"`, defers temporary Stage null admission during opening/initial engine admission, clears stale admission error on retry, and reports genuine admission/placement failures with correct release. Its actual graph/tree/list/page/Expression, pin/follow, sources, revisions and native navigation remain intact. The existing 5 native renderer-neutral SF2 encounter contract tests pass; this is not a claim of a full live SharedField world walk.

The four Vite lifecycle checks now use separate strict ports: native cues4391, provider4388, Nara4389, Visuals4390. Welcome4386 and stage4387 remain free for the other verification lane. No browser processes remain from this run.

## Executed checks

All ran against current native91db modules after intake and passed:

- `npx tsc --noEmit`.
- `node packages/oi-design-system/checks/verify.mjs` — `design-verify-final.log`.
- `node packages/oi-design-system/checks/browser.mjs` — 13/13, `design-browser-final.log`.
- `node desktop/cradle/tests/native-cues-lifecycle.mjs` — `native-cues-final.log`; actual glyph pixels at original/moved target bounds, one native canvas/context, disabled zero canvas and lost held contexts, static zero continuous RAF/steps, active native progress without an FPS budget, foreground preemption/restoration, native formation capacity, hidden target, reduced motion, stale handles, StrictMode. Actual static glyph screenshot: `native-cue-static-final.png`.
- `node desktop/cradle/tests/expression-provider-lifecycle.mjs` — `provider-final.log`; one-owner/window, disabled/enabled, two browser windows, StrictMode/remount, pause handover, stale generation and idle RAF.
- `node desktop/cradle/tests/visuals-preview-lifecycle.mjs` — `visuals-final.log`; real config/control/capture, one context, disabled terminal disposal, navigation, reduced motion and override handover.
- `QL_NARA_SNAPSHOT=/tmp/oi-ui-owner-verification-20260915/ql-personal/focused-snapshot.json node desktop/cradle/tests/nara-retained-field.mjs` — `nara-priority-final.log`; the actual QL example preserves eight native partitions/seven GPU loci, target identities/seeds and stale-generation refusal; actual Stage reservation prevents cue replacement/reseed across release/reentry, and released/superseded lease clocks cannot run.
- `node --test shared-field/knowledge-encounter.test.mjs` — 5/5, `sf2-knowledge-encounter-final.log`.

These are functional browser checks on SwiftShader, not a hardware performance measurement. The physical-GPU comparison and complete opening/native app checks belong to their separate receipts. The owner’s #65 lived UX acceptance remains separate.
