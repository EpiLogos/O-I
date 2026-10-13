# T-LABELS — Plain instrument names; the Central mode titled "Central"

Label: wayfinder:task (Phase 4, UI only)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku ×1)
Blocked-by: — (code legs). UI legs need the screen gate (PATH §3).
Source: DEVICE-SEMANTICS-LOCK.md §4.6 and §4.7
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

## Also in this ticket — no hard-coded day hours (DEVICE-SEMANTICS-LOCK §4.7)

The day is an automated closure and an instrument; no hours are set. Replace
the hour text in `packages/live-shell/ui/src/inhabitants/sdk/modes.ts:175`
and `packages/live-shell/ui/src/shell/modeGrammar.ts:282` (and the matching
`icon-cut.html` readout only if the drift test requires it) with "day opened ·
close routine · day closes"; the punch slots read the day's bounds from the
Central owner (`centralDayNowModel.ts`) and show nothing when the owner gives
none.

## Resolution

**Code legs landed (13 Oct 2026; builder haiku ×1 + the lead's out-of-zone residues).**
- "Central" is the title in `modeGrammar.ts` and `sdk/modes.ts`; the surf
  and rail comments name the five ruled modes (Live the base); the book
  mode `base` is untouched (Central's shell id; Live's restore unchanged).
- Technē: Session "Journey", Arrangement "Timeline" (lock §7.2: the M2′
  Timeline; PROG:97-108's plain list), each keeping its M′ address as a
  `provenance` field / `data-provenance`; the visible M′ strings in
  `ModeCentre.tsx` and `ModeDetail.tsx` follow.
- No typed day hours: the punch rows read "day opened · close routine ·
  day closes"; the Today ruler spans the civil day and draws the day window
  only over the Central owner's reading (none today → no band); the close
  lane names the automated closure.
- Loader reds fixed in the tests (extensionless cradle imports):
  native-knowledge-adapter green under plain `node --test`;
  continuity-storage 9/9 with `--experimental-webstorage
  --localstorage-file=<tmp>` (it uses the global localStorage by design,
  like the other WebStorage suites).
- device-sdk's drift check reads `specimenName` (icon-cut keeps `Base`).
- Scripted: tsc 0; device-sdk, mode-grammar, mode-surface-fidelity,
  native-knowledge-adapter, live-mode-place → 65/65; devices:validate PASS.

**Unverified:** acceptance 4 (the rail/status read "Central", Technē
labels plain, no day band) — `UNVERIFIED: needs-computer-use`.
