# T-NARA — One Nara dialogue binding, met three ways (Central vertical leg)

Label: wayfinder:task (Phase 3, Central vertical leg)
Claimed-by: —
Blocked-by: Phase 2 gate; T-TRAIL (the crossing keeps its way back); P0-R1;
P0-R4 (owner bindings in the native run). Precondition, owner-side state:
a current Nara identity and an open Expression (ConversationNaraFace.tsx:9-10).
Source: DLW-VISION.md §5.3 item 27 (:1336-1343); L-7 (:493-538); ledger L7
(:1154); §6 NARA and EPII.

PLAN line cites read at the committed plan (`0dfa7b5ea`, unchanged at HEAD
`90f44b9e5`). DLW-PLAN carries uncommitted rewrites in the seat (12 Oct);
re-pin them at claim.

Zones: `packages/live-shell/ui/src/inhabitants/ConversationNaraFace.tsx`
(rack face), `packages/live-shell/ui/src/timeline/conversationTrackAdapter.ts`
(the Central day's conversation clip),
`packages/live-shell/ui/src/shell/ModeContextDock.tsx` (the Expressions
companion body, DOCK:66), tests under `packages/live-shell/ui/tests/`. The
binding owner is not in zone: `desktop/cradle/src/nara/nativeDialogue.ts`
and AIKit's canonical session, transcript and draft CAS.

## Question

In Hesse, after every symbol comes the meditation that keeps "the hieroglyphs
of the Game … from degenerating into mere empty signs" (CONT:28). The owner
corrects the study's reading of it: "The meditation is not a pause. It is a
dialogical encounter. The oracle speaks; you listen. The system meets you;
you meet the system" (CONT:98). It is M4 Nara. The live map gives its work as
"not providing answers but midwifing recognition" (M4
`q_4_individuation_threshold`, DLW-VISION.md:500-504). The lock puts "Nara
foreground" in the 3:3 reading (LOCK:31) on one chain, M4 Nara ↔ S4 Workcell
↔ S4′ Anima → M4′ (LOCK:96). The teaching runs inside the encounter: M4.5
"hosts epii consciousness in situ, running Logos Cycle over each Nara
episode" (M4.5.md:14; DLW-VISION.md:546-552).

The Central vertical must recover "a conversation clip + Nara device"
(WSD:856-861, PLAN Phase 3 item 2). This leg proves that one real
`oi.nara-dialogue-binding/v1` is one encounter wherever it is met. It is not
three conversations. It is shown three ways:

1. **the Central rack face** `nara-conversation` (worldShellFamilies.ts:84-89;
   ConversationNaraFace.tsx), which already resolves the binding through
   `lookupNativeDialogue` and renders no transcript;
2. **the Central day's conversation clip** on the Timeline
   (conversationTrackAdapter.ts: receipts as moments, "no second transcript
   store");
3. **the Expressions-mode Anima companion**, tab "Nara · oracle" (DOCK:66),
   reached by a mode crossing from Central. Central's own companion is Fizz
   (DOCK:64). The companion body reads its bound presence, not only a name and
   a note (DLW-VISION.md:1271-1275).

The leg extends PLAN:2949-2954 and adds no new vertical.

What the build must not do (§6 NARA): draw a pause or a timer where the
encounter is; let any presentation judge synthesis for the player (no scoring
a scene, no picking a reading, PRAX:497-500); keep a second conversation
store; or show a personal body other than as a handle behind consent
(INTEGRATED-4-5-0:43,115,129-134). Where a binding is absent, the face shows
the ghost mark beside the disclosed reason. A blank is not an absence.

## Open — waiting on the owner

- **L7 / C3, the interface of the encounter** (rack, dock or day). The
  meaning is settled by the owner's words (CONT:98); which presentation is
  primary is his. This ticket chooses none. All three stand as presentations
  of one binding, none labelled primary. The Resolution carries `OPEN: L7
  (owner, C3)` until he rules.
- **Nara identity decisions D1, D3–D6** are "draft-for-review; generated
  proposal, not adopted law" (QL/docs/NARA-IDENTITY-COMPOSITION-DECISIONS.md:3,93-98).
  The build reads the current identity as the owner supplies it and adopts
  none of them.
- **L8 / C4.** A separate teaching surface stays Open. No help or Lessons
  panel stands in for the in-situ teaching (§6 EPII).

## Sources

- ConversationNaraFace.tsx:1-40, 75-140; desktop/cradle/src/nara/nativeDialogue.ts:20-67
  (binding shape and key); conversationTrackAdapter.ts:1-45; DOCK:60-68;
  worldShellFamilies.ts:84-89.
- WSD §5.3 and :856-861; DLW-PLAN Phase 3 (PLAN:2941-2958).
- DLW-VISION.md L-7, L-8, §3.4, §6 NARA/EPII.

## Acceptance

Exercised: one real binding, end to end, across the three presentations and
one mode crossing.

1. `scripted` (node --test, new suite): with a fixture binding, all three
   presentations read the same binding identity: `person_ref`, `nara_ref`,
   `expression_ref`, `role`, and the identity source revision, as returned
   under `oi.nara-dialogue-binding/v1` (nativeDialogue.ts:20-21,52-54). No
   presentation holds transcript text. A grep guard covers the three files.
2. `scripted`: with no current identity or no open Expression, each
   presentation shows the ghost mark and the disclosed reason. None fills,
   guesses or renders a blank.
3. `scripted`: no presentation writes anything. The leg is readings plus the
   existing encounter aperture (the `contact` press opens the encounter
   surface through its own door, ConversationNaraFace.tsx:16-18).
4. `computer-use`, native app, real owner state: open the Central rack face →
   find the same conversation's clip on the Central day → cross to Expressions
   → the Anima companion shows the same binding. The receipt is one capture
   per step with the binding identity visible. Marked `UNVERIFIED:
   needs-computer-use` until the channel is green. The fixture run in 1–3 is
   never offered as this leg.
5. The matrices record the Central vertical's Nara leg as exercised only
   after leg 4 passes (PLAN Phase 3 gate: "computer-use walks with receipts").

## Resolution

—
