# T-LABELS — Plain instrument names; the Central mode titled "Central"

Label: wayfinder:task (Phase 4, UI only)
Claimed-by: —
Blocked-by: Phase 3 gate (the phase chain, PATH §1). UI legs are also
blocked by P0-R1 and the computer-use gate.
Source: DLW-VISION.md §5.3 item 30 (:1354-1360); §2.1 naming defect
(:749-764); §2.3 (:829-837); ledger L19 (:1166).

Zones: `packages/live-shell/ui/src/shell/modeGrammar.ts` (GRAM:17-22,
31-32, 228, 415-416, 445-446, and the grammar type if a provenance field is
added), `packages/live-shell/ui/tests/mode-grammar.test.mjs`,
`packages/live-shell/ui/tests/mode-surface-fidelity.test.mjs` (only where it
asserts the changed strings). Not in zone:
`packages/live-shell/ui/src/continuity/workspace.tsx` and the stored book mode.

## Question

The owner ruled the mode set as Live (base) · Central · Factory · Expressions
· Technē (CONT:251), and ruled plain names for the Technē instruments:
project/graph, canvas, timeline, journey, places, palace, "not to be called
'M' anything" (D-F, PROG:97-108). The grammar still says otherwise:

- the Central mode's title is `'Base · Central'` (GRAM:228). The surf comment
  reads "Live · Base · Central · Factory" (GRAM:31-32). Under the ruling,
  "base" names Live;
- the GRAM:21 comment, "Central is a world context, not a separate mode",
  contradicts the ruling's wording;
- Technē's session and arrangement still carry "M3′ Journey" and "M2′
  Relation Field" (GRAM:415-416, 445-446).

Change: the title becomes "Central". The surf comment lists the five ruled
modes. The GRAM:21 comment says Central is a mode, implemented as book mode
`base` + world context (GRAM:20; WSD:533-536). The instrument labels show
plain names, and the M′ address moves to a provenance field. An address
conserved as provenance is how the kernel keeps a Pratibimba honest to its
Bimba.

**Do not rename the stored book mode `base` without a migration.** It serves
both Live and Central: Live is "book mode `base`, the music presentation"
(GRAM:19); restore reads `storedMode === 'base' && world === 'central' ?
'base' : 'audio'` (continuity/workspace.tsx:27). Renaming only Central's use
would break Live's restore (DLW-VISION.md:760-764). The shell id `base` stays
Central's (GRAM:20,33).

## Sources

- GRAM as cited; continuity/workspace.tsx:20-30; PROG:97-108; LOCK:415
  ("No rename is performed anywhere *by this amendment*": a sequence, not a
  contradiction, DLW-VISION.md:829-835).

## Acceptance

Exercised: the mode grammar as rendered and as tested.

1. `scripted`: `grep -n "Base · Central" packages/live-shell/ui/src` returns
   nothing. `grep -n "M3′ Journey\|M2′ Relation Field"` in GRAM returns only
   provenance fields.
2. `scripted` (node --test): mode-grammar and mode-surface-fidelity are
   updated in the same change and green. A new case asserts the Central title
   and that each Technē label has a plain name plus an M′ provenance value.
3. `scripted`: continuity-storage and live-mode-place stay green (the book
   mode is untouched). `npx tsc --noEmit` is zero.
4. `computer-use`, native app: the rail and the status region read "Central"
   in the Central mode, and the Technē session/arrangement labels read plain
   names. `UNVERIFIED: needs-computer-use` until the channel is green.
5. If T-WORLDCTX landed the GRAM:21 comment first, this ticket verifies it and
   does not rewrite it.

## Resolution

—
