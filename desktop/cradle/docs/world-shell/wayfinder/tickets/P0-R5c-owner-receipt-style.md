# P0-R5c — Style the restored folded receipt

Label: wayfinder:task (Phase 0, one file + test)
Claimed-by: —
Blocked-by: —

Zones: the stylesheet that already styles `RefusalCard`'s folded receipt
(find it; reuse its class if one exists) or one new rule beside the other
native-browser rules; `packages/live-shell/ui/tests/` for a guard.

## Question

The restored `<details className="owner-receipt">`
(`packages/live-shell/ui/src/native/NativeMaterialBrowser.tsx:132`, P0-R5b)
has no style rule anywhere (PATH §10 item 41), so it renders unstyled.
Reuse RefusalCard's folded-receipt treatment (port, not a second look):
folded by default, token colours only, monospace body, summary reads as a
quiet developer affordance beneath the owner's words.

## Acceptance

The class resolves to a rule (or the element uses the existing class); a
test guards it; tsc zero; suites green. Pixels: UNVERIFIED until
computer-use.

## Resolution

—
