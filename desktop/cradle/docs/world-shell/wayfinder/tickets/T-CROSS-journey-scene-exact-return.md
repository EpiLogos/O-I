# T-CROSS — Journey to Scene and back, by ref equality

Label: wayfinder:task (Phase 3; **proposed to the owner**, not yet accepted)
Claimed-by: —
Blocked-by: the owner accepting the proposal (if he declines, it stays a
lane-5 target and this file records that); the journey owner, whose writers
are waiting (ModeCentre.tsx:216, "The walk's writers wait for the journey
owner"); T-TRAIL; Phase 2 gate; P0-R1.
Source: DLW-VISION.md §5.3 item 28 (:1344-1349); ledger L6, L12, L14
(:1153, :1159, :1161); §2.4 (:902-941); §6 CROSS and ORIGIN.

PLAN line cites read at the committed plan (`0dfa7b5ea`, unchanged through
`f591929b2`). DLW-PLAN carries uncommitted rewrites in the seat (12 Oct);
re-pin them at claim.

Zones: set by the conductor when the owner accepts. Expected seams (not yet
a grant): the Technē journey centre (`packages/live-shell/ui/src/shell/ModeCentre.tsx`
journey section), the Expressions scene open path, and the encounter bridge.
The journey owner's writers and the kernel Expression store are never in
zone.

## Question

The modes bleed, and that is the point (CONT:169). The owner's own example is
a crossing between Expressions and Technē: "a live cymatic sweep becomes a
phrase for a Journey; the sweep is now material" (CONT:167). The lock names M3
Journey ↔ Expression Scenes "the strongest formal bridge" (LOCK:457-466)
between two operating modes of one application (LOCK:390-399). That relation
is how the vision reads "Technē composes → Expressions performs" (CONT:116,127):
grounded at the M3 bridge, "not a pipeline or a hierarchy"
(DLW-VISION.md:604-610).

The crossing is also the plainest test of origin-return. Technē's editing is
"working the material backward into its origin" (CONT:84). A scene that cannot
be walked back to the exact beat it came from has lost its origin. The return
by ref equality is the floor of that care, not the whole of it (§6 ORIGIN).

Proposed proof: a Technē journey → real Expression Scene refs → opened in
Expressions → verso inspected → exact return to the journey beat by ref
equality (PLAN:1700-1720 lane-5 "source/verso leg with explicit return…
restores the exact beat by ref equality"; LOCK:268-296,465). One scene
identity, no shadow store (PLAN:1704-1713; TDR:341,365).

## Open — waiting on the owner

- **Acceptance of this proposal.** The vision proposes T-CROSS to the owner as
  a Phase 3 proof. Until he accepts, it is not claimable. If he declines, the
  same proof stays a lane-5 target (PLAN:1700-1720) and nothing here is built.
- **L6 / C2, what a composed Expression is.** PARTLY: the artifact is an
  Expression/Scene under `oi.expression/v1` (APPA:104-147). The composition
  flow beyond the M3 bridge is not specified. The ticket builds the crossing
  and the return, and no composition pipeline.
- **L14, the trigger rule** for a mode shift is open. The crossing is an
  explicit act, and it never sends, discloses or launches by itself
  (EXP/FACTORY-AGENCY.md:42,102).

## Sources

- DLW-PLAN lane 5 (PLAN:1700-1720); LOCK:268-296, 390-399, 457-466;
  TDR:341,365; APPA:104-147.
- ModeCentre.tsx:200-218 (journey record, waiting writers); encounterBridge.ts;
  GRAM:467 ("view → scene" waits).

## Acceptance

Exercised: a real journey and real scenes, native owners only.

1. `scripted`: the scene opened in Expressions has the same Expression/Scene
   ref the journey stop holds. Equality is asserted on refs, not titles. No
   copy of the scene exists outside the kernel Expression store (grep guard:
   no new scene persistence in the shell).
2. `scripted`: return from the verso lands on the journey stop whose ref
   equals the origin, at the same beat, through the one transition, and
   appends a trail stop (T-TRAIL).
3. `computer-use`, native app: Technē journey → scene in Expressions → verso
   → return to the exact beat. The receipt is a capture per step showing the
   refs. `UNVERIFIED: needs-computer-use` until the channel is green.
4. No sounding claim: if the scene plays, the receipt names the sounding owner
   or marks it waiting (#281; §6 MUSIC).

## Resolution

— (waiting: owner acceptance of the proposal)
