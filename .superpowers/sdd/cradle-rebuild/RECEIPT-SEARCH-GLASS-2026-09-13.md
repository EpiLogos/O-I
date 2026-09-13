# U3.1 refinement — glass search and full native query transport

Owner: Satya, 2026-09-13. Delivery: O-I #274 under #190. Brief:
`BRIEF-SEARCH-GLASS-2026-09-13.md` beside this receipt.

| unit | real implementation | evidence | remaining |
|---|---|---|---|
| U3.1 search refinement | one locally frosted panel; literal AIKit search/resolve input; discreet Options; IME/keyboard/latest-response safety | controlled browser, JSON/argv and compositor evidence below | installed-native whole-app walk and human visual acceptance are not claimed |

## Owner meaning and implementation

The existing search aperture exposes AIKit's full operative language rather
than defining a desktop dialect. Raw strings reach both owner operations,
with one literal CLI operand after `--`. The desktop does not parse, strip
operators, invent completion results, train familiarity by querying, or
execute a result Action on input. Native order, refs, Actions, refusal and
provider absence remain visible.

The panel itself has translucent material and local blur; the workspace
is not fogged. Material roles are opt-in in `oi-design-system/search.css`.
Shortcut configuration and the static native-syntax reference sit under
Options. History, Explain, provenance and explicit owner Actions remain
available. Keyboard/caret restoration, IME composition, current-query
identity, bounded scroll and accessibility alternatives are exercised.

## Exact D evidence

Production implementation first passed on branch head
`ab7510eb9d1ef0f79e5b05a0780a2bebe7b3e7fd`, tested merge
`cec63fa2b60305a679f91a6873b1f60f36d24cf8`:

- desktop run 34763672506 and OI Verify 34763672483 passed;
- 172 named Chromium/WebKit browser checks;
- 31 shared query cases, both operations, Central-root and child contexts;
- independent Rust JSON round-trips and actual process-argv witnesses.

After preserving newer main `a10f350bc090a9ce4483ef9bbec4307061ba9e35`,
head `075e37fc943bffc9f59713549614c8a9a9558d1b` was tested as merge
`da9911ad8c15d0f6f737be6c401e83f4e402e42d`:

- desktop run 34765121195 passed: web build, kernel tests/clippy, locked
  aarch64 macOS shell check, Chromium/WebKit component contracts;
- material run 34765121252 passed on Linux Chromium 153.0.8010.12 and
  headed macOS WebKit 26.6;
- artifact 10320091246: Linux painted stripe contrast 0.3333 with production
  blur versus 57 with blur explicitly disabled;
- artifact 10319779948: macOS display contrast 0 with production blur
  versus 56 with blur disabled. Both controls passed.

The native knowledge walk is retained; only its path to shortcut settings
adds the Options click. It was not executed in this session. No AIKit
parser/provider reimplementation was introduced for any test fixture.

## Returned visual reality

Initial WebKit offscreen screenshots exposed sharp background text despite
reporting blur in computed CSS. The comparison in run 34764860044,
artifact 10320730194, separated the actual macOS display from that capture
path: the display paints the production blur; the offscreen snapshot omits
it. No speculative production workaround was applied.

The retained material gate therefore uses actual macOS screencapture for
WebKit, Linux browser capture for Chromium, a visible location marker and
an unblurred negative control. Its screenshots distinguish display from
snapshot. This is controlled CI compositor evidence, not the user's
machine, an installed native suite, or human H/EX.

## Integration and closure

The branch preserves accepted point-cloud exports, peer dependency and all
other newer-main changes. A final unrelated repository Format failure
named two whitespace-only hunks in `cli/tests/guardian_projection.rs`,
already present in that newer main. The convergence commit corrects only
those hunks; it changes no guardian semantics or assertions.

Final convergence checks and the accepted merge SHA are recorded in #274's
closeout. This receipt does not promote earlier fixture evidence into
installed-native or human acceptance. Native completions remain outside
the current kernel seam; the component reports that honestly.
