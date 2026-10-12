# P0-V1 — Land DLW-VISION and the DLW-PLAN rewrites

Label: wayfinder:task (Phase 0, conductor, docs only)
Claimed-by: —
Blocked-by: —
Seat state at writing (12 Oct): DLW-PLAN.md carries uncommitted edits
(`git diff --stat`: +456/−56), not made by this ticket's writer. Before
dispatch, the conductor confirms whether they are this ticket in progress and
sets Claimed-by.
Source: DLW-VISION.md §5.3 item 24 (DLW-VISION.md:1309-1310); the rewrites
are §5.1 items 1–16 (DLW-VISION.md:1195-1267).

Zones: `desktop/cradle/docs/world-shell/wayfinder/DLW-VISION.md` (land it;
correct only cites that P0-BIMBA-LIVE or this ticket's cite check finds
wrong), `desktop/cradle/docs/world-shell/wayfinder/DLW-PLAN.md` (§0, §2, §4
head, §4.1–§4.5, §5.4, §5.6, §6.1, §7, §8, §10, §11 as §5.1 lists them).
Conductor only: PATH:13 gives planning documents to the conductor. No product
code.

## Question

The owner's contemplation and his mode ruling (CONTEMPLATION-DLW-INSTRUMENT.md,
ruling at CONT:232-252) are compiled into DLW-VISION.md. At 12 Oct the file
is untracked in the seat (`git status` at `90f44b9e5`), and DLW-PLAN still
carries the pre-ruling framing. This ticket lands the vision and writes it
into the plan of record so that every builder reads the same figure.

What the plan must carry after this ticket, and not only as a feature list:

- **The figure.** The DLW is a total environment for meaning: the Glass Bead
  Game is the figure, Live the proof for a medium, the DLW the instance aimed
  at a world's contents and values (CONT:26-32; DLW-VISION.md:95-105). Its
  power is the integration, the porousness and the shared clock (CONT:26).
- **The five modes as law.** Live (base) · Central · Factory · Expressions ·
  Technē, with Epi-Logos a lens, not a mode (CONT:251-252). Live is the
  reverse-engineering basis, ported, not approximated; its destination is
  Expressions with audio and video track layers on one timeline (CONT:244-250).
  This is settled. It is written into the plan as law, never as a question.
- **Origin-return.** Technē's editing is "working the material backward into
  its origin", compassion as "loving sensitivity to origins", with origin as
  Gebser's ever-present origin (CONT:84-88). The kernel grounds the return:
  M0 "The Ever-Present Origin"; the M5-5 5→0 write-back in which an-a-logos
  "completes the return" and etymological archaeology deposits through review
  into M0's bimba node; M4.5-1 "pedagogical compassion"
  (DLW-VISION.md:133-160). Provenance mechanics are the material condition of
  the act, not the act (DLW-VISION.md:159-160).
- **Nara and Epii as encounters.** The meditation "is not a pause. It is a
  dialogical encounter" (CONT:98); the lock puts Nara foreground in the 3:3
  reading, chain M4 Nara ↔ S4 Workcell ↔ S4′ Anima → M4′ (LOCK:31,96). "The
  teaching is the encounter" (CONT:106); Palace is the objectified form of the
  M5 pedagogy pole (LOCK:358) (DLW-VISION.md:161-178).
- **Porous modes.** Material becomes material in another mode (CONT:167;
  DLW-VISION.md:128-132, 902-941).
- **The discipline of ending.** "Games end… The score remains" (CONT:159);
  "An instrument that cannot imagine its end will defend it" (CONT:161)
  (DLW-VISION.md:184-195).

## Sources

- DLW-VISION.md §0 (:93-195), §4 (:1138-1184), §5.1 (:1195-1267), §6
  (:1374-1469).
- CONTEMPLATION-DLW-INSTRUMENT.md in full; the ruling at :232-252.
- DLW-PLAN.md at the sections §5.1 names, by the line ranges it gives
  (read at HEAD `6e2ab0b50`).

## Acceptance

Exercised: the planning documents as the next builder reads them. Channels:
`scripted` (git and grep checks, commands kept in the Resolution) and
`code-reading` (the conductor's item-by-item check). No UI leg.

1. DLW-VISION.md is committed on `dlw/build-20261012`; `git log -1 --
   desktop/cradle/docs/world-shell/wayfinder/DLW-VISION.md` names the commit.
2. Each of §5.1 items 1–16 is applied. The Resolution lists item → DLW-PLAN
   section and post-edit line range, one row per item.
3. PLAN:75-79 survives word for word (§5.1 item 2): a scripted diff of that
   sentence against `git show 6e2ab0b50:…/DLW-PLAN.md` is empty.
4. Owner rulings are written as law, never as open: the mode set (L1), "a
   lens, not a mode" (L3; §10 item 2 closed as answer (a)), and §10 item 13
   closed as done (PATH §2). A grep of the edited §4 head and §10 finds no
   row that presents the mode set as a question.
5. §10 gains L1, L2, L5, L16, L17, L19, L21, L22 and L23, cross-referenced
   to C1–C9. Every row or part-row the vision leaves PARTLY or OWNER (L2
   leave act, L3 item 27, L4, L5, L6, L7, L8, L9, L10, L11, L12, L13, L14,
   L15, L16 school pairing, L17, L18 seam owner, L20, L21, L23 timing) is
   written as a recorded question with its owner named, never as an answer
   (DLW-VISION.md:1146-1170, 1190-1193).
6. Cite pins hold. The vision cites DLW-PLAN by line at `6e2ab0b50`; this
   ticket's own edits move those lines. Either every `PLAN:n` cite in
   DLW-VISION.md is re-pinned to the post-edit plan, or DLW-VISION's Standing
   names the plan revision its PLAN cites read. Scripted check: every
   `PLAN:a-b` cite resolves to a non-empty range in the pinned revision.
7. Known stale cites recorded, not silently carried: DLW-VISION.md:279 gives
   the measured backlog as "D1–D13"; at 12 Oct
   `docs/research/ableton-live-12.0.25/reconstruction-backlog.md` carries rows
   D1–D16 (:57-73). Corrected in the vision or recorded in the Resolution.
8. Reviewed at the next review point (R0 if it lands in wave 0) against §6
   and the mode ruling (BRIEF-REVIEWER.md).

## Open — not this ticket's to answer

Every §4 row still PARTLY or OWNER stays a recorded question in the plan.
§5.1 item 16 (a matrix row counting what left the workstation and held,
REL:179-184) is proposed to the owner, not adopted.

## Resolution

—
