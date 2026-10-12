# P0-R5c — Style the restored folded receipt

Label: wayfinder:task (Phase 0, one file + test)
Claimed-by: — (released W0e, 12 Oct: committed `046fb857b`; pixels open)
Blocked-by: —

Zones: the stylesheet that already styles `RefusalCard`'s folded receipt
(find it; reuse its class if one exists) or one new rule beside the other
native-browser rules; `packages/live-shell/ui/tests/` for a guard.

## Question

The restored `<details className="owner-receipt">`
(`packages/live-shell/ui/src/components/NativeMaterialBrowser.tsx:132`, P0-R5b;
the path was first filed as `src/native/`, corrected W0e)
has no style rule anywhere (PATH §10 item 41), so it renders unstyled.
Reuse RefusalCard's folded-receipt treatment (port, not a second look):
folded by default, token colours only, monospace body, summary reads as a
quiet developer affordance beneath the owner's words.

## Acceptance

The class resolves to a rule (or the element uses the existing class); a
test guards it; tsc zero; suites green. Pixels: UNVERIFIED until
computer-use.

## Resolution

**Resolved in code W0e, 12 Oct 2026 — `046fb857b`.** Pixels open.

**Landed.** Three rules in `packages/live-shell/ui/src/native/workbench.css:1240-1242`
(`.owner-receipt`, `.owner-receipt summary`, `.owner-receipt pre`), ported
value for value from RefusalCard's folded-receipt treatment
(`src/agent/agentShell.css:295-297`, the `.agent-refusal details` rules;
re-opened at record: the builder's cite was right, the converge's `:294-296`
was off by one); the
only addition is a fallback stack after `var(--mono)`. Token colours only
(`--text-faint` summary, `--text-dim` body). The element
(`src/components/NativeMaterialBrowser.tsx:132`) keeps no `open` attribute,
so it stays folded. The ticket's named stylesheets sit outside the zone, so
the rule lives in `workbench.css`, which the app loads eagerly
(`src/panels/index.ts` → `panels/workbench.tsx` → `native/Workbench.tsx:44`).
New guard `tests/owner-receipt-style.test.mjs` (3 tests): the element is
still rendered folded; the rule exists in a bundled stylesheet with a token
summary colour and a monospace body; no raw colour literals.

**Checks (scripted, converge re-runs).** tsc 0 errors; run-context and agent
suites 115/115; the new guard 3/3.

**Acceptance.** The class resolves to a rule; a test guards it; tsc zero;
suites green. Pixels not met.

**Unverified (channel).** The folded receipt beneath the owner's words — the
summary affordance, the monospace body, the spacing — in the native window:
`computer-use` (PATH §10 item 51).

**Carries:** PATH §10 items 51 (pixels), 52 (eager-load dependency and the
`--mono` token living only in `agentShell.css`). PATH §10 item 41 is done.
