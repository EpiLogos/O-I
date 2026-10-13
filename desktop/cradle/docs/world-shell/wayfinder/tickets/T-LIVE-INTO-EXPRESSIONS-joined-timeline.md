# T-LIVE-INTO-EXPRESSIONS — Live joins Expressions on one audio and video timeline

Label: wayfinder:task (Phase 4/5, deferred, owner-timed; **not claimable**)
Alias: T-LIVE-EXPR (DLW-VISION.md:1170, 1364-1368)
Claimed-by: —
Blocked-by:
1. **The engine measured as a whole against the RE corpus.** Since the owner's
   13 Oct 2026 ruling (DEVICE-SEMANTICS-LOCK §0.2), Live mode exposes one
   instrument, the M1 torus, and the corpus is the engine's measured
   reference, not a catalogue to expose; the torus is already the one
   simulation Live and every Expression share. Live mode remains
   the reverse-engineering basis (CONT:244-246). Its dynamics must be ported
   and verified against the measured reference: the verify gate and rows of
   `Work/reverse-engineering/ableton-live-12.0.25/reconstruction-backlog.md` (:8, :25;
   D-rows D1–D18 at :57-75, 12 Oct) and DLW-PLAN §4.1.a, the measured reference (PLAN:679).
   Until the port measures whole, a merge would bury the basis it rests on.
2. **The owner names the time** (L23, OWNER timing; DLW-VISION.md:1170).
3. **A design for the video track layer.** No design or code names a video
   track (WSD and PLAN carry no "video"; DLW-VISION.md:600-603, 819). The
   design is Open and needs the owner before any build.
4. **Phase 4 gates** for the Live-mode and Expressions target work (PLAN
   Phase 4), and P0-R1.
5. For any sounding claim, #281 (M′ physical music). M1 generates sound and
   M2 only modulates (D13, MPW:32-34).
Source: DLW-VISION.md §5.3 item 32 (:1364-1368); §2.1 (:723-786); L-0
(:261-283); ledger L1, L18, L23.

PLAN line cites read at the committed plan (`0dfa7b5ea`, unchanged through
`f591929b2`). DLW-PLAN carries uncommitted rewrites in the seat (12 Oct);
re-pin them at claim.

Zones: none until claimable. The conductor cuts zones when the owner times
it.

## Question

The owner ruled: "lets just keep the live mode, it ought be integrated
cleanly, eventually, into expressions where we've planned to have the video
and audio track layers together (like a video editor would, like davinci),
but having the base mode means we can get a clean reverse engineer basis to
ensure we are porting/using its real deep dynamics as a whole unified
technology, building from that only gets better" (CONT:236-241).

This is settled, and it is a sequence. Live stays a distinct base mode now,
so the port stays clean and measurable, and it moves into Expressions later
(CONT:247-250; DLW-VISION.md:768-772). The ticket is that later move: Live's
ported dynamics, kept whole as one technology (live-set, live-dynamics,
live-engine, live-shell), joined into Expressions, where audio and video
track layers live on one timeline. The music/audio half has source ties: a
composition environment "inside the existing Expressions application"
(MPW:10), and "the DaVinci Resolve pattern … an integrated musical working
mode, not another app" (WSD:917-918). Track kinds enter as adapters on the
Timeline projection (WSD:945-951; PLAN §5.8, PLAN:2185). The video half rests
on the ruling alone.

This file exists so that no other ticket does this by accident
(DLW-VISION.md:1367-1368). Until it is claimable, nothing merges Live's rail
entry, and nothing approximates a Live dynamic inside Expressions in its
place.

## Open — waiting on the owner

- **L23: when.** The owner names the time.
- **The audio + video track design.** No design names a video track. The
  design is drawn and put to the owner before build.
- **L18: the Live device-write seam.** Live faces write through `POST
  device-param` (OI/packages/live-shell/src/main.rs:174-176), outside the
  writers law. The seam needs an owner op before any Live face writes from
  Expressions.
- **L17.** Whether the cymatic plate sounds, and how entity voices stand
  against D13. This is the owner's question with the QL owner (#281).

## Sources

- CONT:232-252; DLW-VISION.md §2.1, §2.2 (the audio + video row, :819), L-0,
  L-9 (:600-603).
- MPW:10, 32-34, 144-146; WSD:917-924, 945-951; PLAN §4.1 (:643-), §5.8
  (:2185-); reconstruction-backlog.md.
- Note: DLW-VISION.md:279 named the backlog "D1–D13". At 12 Oct the backlog
  carries D1–D18 (:57-75); the vision and DLW-PLAN §4.1 now say so.

## Acceptance (provisional; re-cut by the conductor when the owner times it)

Exercised: Live's ported engine inside Expressions, against its own measured
reference.

1. `scripted`: every measured dynamic Live mode passes in the backlog's
   verify gate renders the same inside Expressions: the offline render is
   bit-identical to Live mode's render of the same set, as live-engine's
   audition is to its own render (DLW-VISION.md:275-277). The port is not
   re-derived.
2. `scripted`: audio and video tracks sit on one timeline as Timeline track
   adapters, on the one clock stratum. No second clock, and takes are never
   a clock or a track (worldTrackAdapter.ts:33-34).
3. `computer-use`, native app: a set with audio and video layers is played,
   edited and saved in Expressions through native owners, with a capture per
   step.
4. Live's rail entry is removed or kept only by the owner's named act. The
   five-mode grammar changes only by his ruling.
5. No sounding claim beyond what #281 has landed (§6 MUSIC).

## Resolution

— (deferred: owner-timed; Live port not yet measured whole)
