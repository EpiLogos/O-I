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
