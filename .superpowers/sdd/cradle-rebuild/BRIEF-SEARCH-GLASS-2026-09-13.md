# Search glass and full-syntax transport

Owner request, 2026-09-13: check full search-syntax passthrough; make the
component more glasslike, closer to macOS Spotlight. Owner then authorised
implementation here and confirmed the local desktop agent was no longer
live in the tree. This is a bounded U3.1 refinement under #190, not a new
search language or a takeover of the open #270 test-repair line.

Basis: O-I main 5efb1a55782cc1c5a4412cdd648a1d1f4bb644b2.
Phase branch: cradle-search-glass. Native GitHub delivery.

## Meaning and owner chain

FOUNDING-POSITIONS: source and agency stay native-owned; human attention
should return to the act rather than continuous apparatus supervision.
OI-DESKTOP-CRADLE-REBUILD-WAYFINDER U3.1 and APP-SPEC §8: search resolves
native refs with provenance and Actions. The desktop makes that usable.
cradle-execution: "A component never re-implements an operation";
"Visual acceptance is human evidence" (APP-SPEC §17).

AIKit's resource/operative.rs (inspected blob d82cb9cfade6eb1c543b680bf4c74ddfbb9296bd)
is the grammar authority. Preserve @, @0–@5, @#, - + x / =, framing,
quotes, escapes and ordinary/literal input. No desktop parser or completion
pretending to be an owner response. Typing is not invocation.

## Files and operations

- src/knowledge/SearchOverlay.tsx: preserve literal native search/resolve;
  composition-safe input, latest-response wins, keyboard/caret continuity;
  compact results, secondary evidence/shortcut/syntax disclosure.
- src/knowledge/search.css + packages/oi-design-system/search.css and export:
  one locally frosted, translucent plane, restrained scrim, crisp text;
  opaque/high-contrast/non-blur/reduced-motion alternatives.
- kernel/src/knowledge.rs + tests/search-queries.json: executable argument
  preservation across JSON and a real process argv, no shell evaluation.
- tests/search-* and desktop CI: real component/client/bridge browser
  contracts with an explicitly controlled transport, not fake owner proof.
- walk/scenarios/knowledge.mjs: retain the native journey and update only
  the deliberate Options disclosure before changing its shortcut.

## Verification and return

Build and kernel tests/clippy must pass. Browser contracts cover literal
input to both native request shapes, root/child context, owner order/errors,
late responses, IME, keyboard opening, Escape/caret restoration, bounded
scroll, glass material and accessibility alternatives, in Chromium/WebKit.
Keep screenshots as review artifacts. Controlled component/argv evidence is
D, not installed-native or human acceptance. The existing knowledge walk
remains the native-owner/full-app proving route; do not relax its assertions
or label a component fixture as a running native suite.
