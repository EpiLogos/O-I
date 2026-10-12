# T-WORLDCTX — The Central mode: its leave act and its initial world

Label: wayfinder:task (Phase 2 seam; owner question first, build second)
Claimed-by: —
Blocked-by: the owner's ruling on the L2 leave act (DLW-VISION.md:1149);
Phase 1 gate for the build leg. UI legs are also blocked by P0-R1 and the
computer-use gate.
Source: DLW-VISION.md §5.3 item 26 (:1334-1335); §2.1 "Central as a mode"
(:765-767); §2.4 gaps (:932-933); ledger L2.

Zones (build leg, after the ruling): `packages/live-shell/ui/src/App.tsx`
(`chooseMode`, APP:257-264), `packages/live-shell/ui/src/continuity/workspace.tsx`
(restore, :24-27), `packages/live-shell/ui/src/shell/modeGrammar.ts` (the
mapping comment, GRAM:17-22), tests under `packages/live-shell/ui/tests/`.
Before the ruling: no code. The conductor writes the owner question.

## Question

**Settled, owner-ruled.** Central is one of the five modes (CONT:251), and it
is the ground the other modes return to: "All return to Central" (CONT:184).
The design builds the Central mode as a world context over one book mode:
`base` → book mode `base` + `WorldContext.world = 'central'` (GRAM:20-21;
WSD:533-536). A mode can be built that way (DLW-VISION.md:765-767). Until
this ticket resolves, GRAM:20-21's mapping stands.

**Open, the owner's.** Two acts are unstated:

1. **The leave act.** On every mode switch, `chooseMode` sets `world` to
   `undefined` unless the target is Central (APP:259). Leaving the Central
   mode drops the world. The cradle store's law reads differently: the
   selected world holds "until the person leaves it" (STORE:54-56). Two
   readings:
   - (a) leaving the Central mode *is* leaving the world, as the code does;
   - (b) the world holds across mode switches until an explicit leave act, as
     the store's comment says. Under (b), the ground travels with the
     material as it crosses into Factory, Expressions or Technē (CONT:167).
2. **The initial world.** What world the Central mode starts in (code: always
   `'central'`, APP:259), and whether entering Central replaces a world
   already held.

**A constraint the ruling must meet (Inferred from code).** Live and Central
share the stored book mode `base`. Restore tells them apart only by the world:
`storedMode === 'base' && world === 'central' ? 'base' : 'audio'`
(continuity/workspace.tsx:27). Under reading (b), switching from Central into
Live with the world held would restore into Central after a reload. Any
ruling that holds the world into Live needs a restore discriminant that does
not depend on `world`. That discriminant is part of this ticket's build. The
book mode `base` is not renamed without a migration (DLW-VISION.md:760-764).

## Sources

- APP:250-264; continuity/workspace.tsx:20-30; GRAM:15-25;
  desktop/cradle/src/workspace/store.ts:54-67.
- WSD §6 (:533-536); DLW-VISION.md §2.1, §2.4, L2.

## Acceptance

Before the ruling (conductor). Channel: `code-reading`. The owner question
is sent with both readings verbatim-short, the code facts and line cites
above, and the restore constraint, and its ref is recorded here. The
ticket's state reads `waiting: owner (L2 leave act)`. No code is changed.

After the ruling (builder). Exercised: the mode transition and restore.

1. `scripted` (node --test): a five-mode switch sequence asserts `world` after
   each switch, per the ruling, and asserts the initial world on entering
   Central.
2. `scripted`: reload-restore lands in Live after Live and in Central after
   Central, under the ruled world behaviour (continuity-storage and
   live-mode-place suites green, plus one new case per reading the ruling
   chose).
3. `scripted`: the GRAM:20-21 comment states the ruling: Central is a mode,
   implemented as book mode `base` + world context. This is the comment
   correction T-LABELS also names; whichever ticket lands first does it, the
   other verifies it.
4. `computer-use`, native app: Central → Factory → back, showing the world as
   ruled in the status region (with P0-R5's run context). Until then:
   `UNVERIFIED: needs-computer-use`.

## Resolution

— (waiting: owner, L2 leave act and initial world)
