# T-EXPRESSIONS-PANE-LEASE — an Expressions pane beside the centre

**Found:** 13 Oct 2026, making instrument panes reachable in Factory.
`ExpressionsPanel` (`packages/live-shell/ui/src/panels/expressions.tsx`) owns
one ExpressionsHost and one native owner lease. A second Expressions pane
body would put a second frame on that lease, which the host is not proven to
support. Expressions panes are therefore disabled in the Factory lens bar.

## Target

Decide from the host and kernel whether a second frame can hold its own lease
(its own expression, its own owner grant) safely; if so, admit an
Expressions pane body through the projection door with its own lease and
its own frame; if not, the pane presents the one hosted Expressions surface
by moving it (retained, never remounted), and says so.

## Acceptance

- Scripted: two leases never write the same expression concurrently; closing
  a pane releases exactly its lease; the centre's frame is never remounted.
- Native: an Expressions pane beside the agent in Factory edits its own
  Expression; the centre's stays untouched.

## Resolution (14 Oct 2026)

- A second lease is not safe. The kernel holds one native owner
  (`kernel/src/native_expression.rs` `active: Option<Owner>`), refuses a
  second open as `owner_busy` (`busy()`, asserted by
  `kernel/tests/native_expression_owner.rs`), and the centre's panel holds
  module-level singletons a second mount would overwrite.
- So the pane presents the one live frame. The centre's `ExpressionsPanel`
  stays mounted in Factory (hidden, never unmounted), and while an Expressions
  pane is open and visible its container is placed over the pane's slot
  (`projections/framePlacement.ts`: fixed to the slot's clipped rectangle,
  followed by animation frame, ResizeObserver, resize and scroll). It is never
  re-parented or remounted; the iframe and its `src` are unchanged. The
  centre's toolbar moves into the pane header while it is placed. Closing the
  pane, a tab switch or leaving Factory returns the frame to its own place.
  Two panes: one holds the frame, the other says so and offers "Show here".
- Open: the native run (geometry, z-order over Factory popovers, pointer
  routing); a second pane needs a subject, since the lens reactivates the one
  binding; Factory's toolbar still omits the Expressions kind
  (`native/Workbench.tsx:48,685`).
