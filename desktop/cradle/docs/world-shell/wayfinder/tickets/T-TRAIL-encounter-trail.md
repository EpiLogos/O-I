# T-TRAIL — Every transition leaves a trail stop; return appends

Label: wayfinder:task (Phase 2 seam)
Claimed-by: —
Blocked-by: Phase 1 gate (PATH §1: no fan-out across a red gate). UI legs
are also blocked by P0-R1 and by the computer-use gate (PATH §3).
Source: DLW-VISION.md §5.3 item 26 (:1329-1333); §2.4 (:902-941); ledger
L12, L14 (:1159, :1161); DLW-PLAN §10 item 28 (PLAN:3152-3157).

PLAN line cites read at the committed plan (`0dfa7b5ea`, unchanged through
`f591929b2`). DLW-PLAN carries uncommitted rewrites in the seat (12 Oct);
re-pin them at claim.

Zones: `packages/live-shell/ui/src/projections/encounterBridge.ts`
(`transition`), `packages/live-shell/ui/src/App.tsx` (`chooseMode` only,
APP:257-264), `packages/live-shell/ui/src/shell/ModeContextDock.tsx` (the
Trail tile, DOCK:199-204), and a new suite under `packages/live-shell/ui/tests/`.
Never write `desktop/cradle/src/workspace/store.ts` or `encounter.ts`: they
are the port sources and the one store.

## Question

A crossing between modes is the act by which material becomes material in
another mode (CONT:167). That act is honest only if it keeps the way back.
Origin-return asks that every derived thing can be "walked back to it in one
act" (§6 ORIGIN). The trail is the floor of that walk. Today no trail stop is
written in the new shell: `BRIDGE.transition` sets subject and occasion and
writes nothing to `trail` (encounterBridge.ts:74-96); `chooseMode` sets world
and mode directly through `continuity.setContext` (APP:257-264); the Trail
tile shows only the current subject (DOCK:199-204).

Build: every transition appends one trail stop. That covers a subject
change, an occasion change and a mode switch. `chooseMode` routes its context
change through the one transition, so there is one transition for every
shift (§6 CROSS). `returnTo` restores the exact mode, surface and reading
position and appends a stop; it does not rewind. The Trail tile lists the
stops and returns to any of them. The trail holds refs and titles only,
never content (encounterBridge.ts:78; STORE:57-59).

**The trail shape.** There are two shapes, a **Conflict** between code
sources (DLW-VISION.md:938-941):

- the store's `TrailStop {mode, surfaceRef, surfaceKind, label, position}`
  (STORE:61);
- the encounter's `{address, at}` (ENC:61-63,85).

This ticket uses the store's `TrailStop`. **Inferred:** `WorldContext.trail`
is typed `TrailStop[]` (STORE:62-67), and the bridge already reads that field
(encounterBridge.ts:7,48). Taking the encounter shape would put a second
shape into the one context, against the port law. The return semantics are
ported from `returnTo` (ENC:83-89): "return appends, it does not rewind".

**Conflict on return semantics, also code against code.** The cradle frame's
drill-through comment says "return" *pops* the stop
(CradleFrame.tsx:1010). `encounter.ts` says return appends (ENC:83-84).
This ticket follows the vision's choice, appends (DLW-VISION.md:1330-1331),
which matches the tile's own promise, "the trail keeps the encounters and
returns to them" (DOCK:203). The pop precedent is retired with the port.

## Open — waiting on the owner (DLW-PLAN §10 item 28)

"A ruling decides: placement and bound" (PLAN:3157). The ticket rules on
neither:

- **Bound.** The store already trims the trail to the last 24 on every write
  (`TRAIL_LIMIT = 24`, STORE:68; `setContext`, store.ts:487). Writing through
  `book.setContext` inherits that trim. The builder adds no retention rule of
  its own and states the current trim in the return as `retention:
  store TRAIL_LIMIT=24 (code standing, unruled — item 28)`. Whether the bound
  is 24 or unbounded stays OPEN.
- **Placement.** The Trail tile stands in the right dock as built (DOCK:42,
  54-58), as Revision 2 places it (quoted at PLAN:3155-3156). Building on it is
  not a ruling on placement.

## Sources

- Port sources: `desktop/cradle/src/workspace/encounter.ts:55-89` (`encounter`,
  `returnTo`); `desktop/cradle/src/workspace/store.ts:54-68,487`; the cradle
  drill-through `desktop/cradle/src/CradleFrame.tsx:1008-1026`.
- DLW-VISION.md §2.4 and §6 CROSS/ORIGIN; WIDGET-GUIDE §4.6 (dock tiles).

## Acceptance

Exercised: the encounter spine and the Trail tile. Channels as marked.

1. `scripted` (node --test, new suite `encounter-trail.test.mjs`): a subject
   transition, an occasion transition and each of the five mode switches
   append exactly one `TrailStop` each. The stop carries refs, kind, label
   and position, and no content key.
2. `scripted`: `returnTo(i)` restores the exact mode, surface ref and reading
   position of stop *i* and appends one stop. The trail length grows by one,
   up to the store's trim.
3. `scripted`: `chooseMode` writes world and mode through the one transition.
   A grep test shows no direct `continuity.setContext` world write is left in
   `chooseMode`.
4. `scripted`: existing suites stay green: mode-grammar, mode-surface-fidelity,
   continuity-storage, live-mode-place, inhabitant-manifest. `npx tsc --noEmit`
   is zero.
5. `computer-use`, in the native app after P0-R1: a walk Central → select a
   document → Technē → Expressions, then return through the Trail tile to the
   Central document at the same reading position. The receipt is a capture
   per step. Until the channel is up: `UNVERIFIED: needs-computer-use`.

## Resolution

—
