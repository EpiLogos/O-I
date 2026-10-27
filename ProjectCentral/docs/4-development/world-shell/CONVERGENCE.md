# Convergence — Technè instrument parity programme, phases 1–2

**Standing:** the single converging ledger record of this programme's first
phase (`central-parallel-execution` law: one ledger, not one per lane).
Phases 1–2 — initial research, RE target selection, and the concrete
feature/function target sets — are **complete on all six lanes**. All
dispatched agents have returned and closed. The owner deliverable is the
target sets themselves; this record indexes them and names what the owner
is asked to adjudicate before phase 3 (RE passes) begins.

**Naming in force:** the technē deep instruments are M5-0′…M5-5′ (owner
ruling, 2026-10-07); lane documents written before the ruling use the old
cradle labels (M0′–M5′ / `m0m5`) — the mapping is recorded in PROGRAMME.md
and the rename in code is decision D-F. The real M1–M4 are the QL matrices
of the physical music instrument; they are the subject of lane 6, not of
lanes 1–5.

## The deliverable landscape

| Lane | Instrument(s) | Chosen RE targets (possession) | Targets |
|---|---|---|---|
| 1 | M5-0′ Project/Wiki/Graph + M5-1′ Canvas | tldraw v5.5.2 (`/tmp/lane1-tldraw`, source-available), Excalidraw (MIT clone), Obsidian 1.7.7 `.canvas` format (possessed app; from today's done campaign), Miro as doc-cited bar only (auth-gated, not captured) | 21 — `lane-1-canvas-graph/TARGET-SET.md` |
| 2 | M5-2′ Relation/Timeline | TimelineJS3 @12a8019, vis-timeline @67b24bb, PeriodO @51fe03a (all open-source clones); Aeon Timeline v2 official manual (app not installed — blocked-with-reason); Histography/Chronas (web captures) | 25 — `lane-2-timeline/TARGET-SET.md` |
| 3 | 3:3 Expressions editing | Kdenlive timeline2, Blender VSE, Olive, libopenshot, Shotcut/MLT (all source clones at `/tmp/techne-lane3-re/`, HEADs pinned); DaVinci Resolve as documentation-observed quality bar | 26 — `lane-3-expressions-editor/TARGET-SET.md` |
| 4 | M5-4′ World/Places | **MapLibre GL JS 6.11.1 — already in-tree** as the vendored M5-4′ renderer (extend in place, no second globe); CesiumJS @a3aea90b (scratch clone, reference only); Google Earth web as documented UX bar | 30 — `lane-4-world-places/TARGET-SET.md` |
| 5 | M5-3′ Journey + M5-5′ Palace | Godot 4.8-dev, Twine 2.12.1 (source clones); Unity Timeline (documentation target) | 24 — `lane-5-journey-palace/TARGET-SET.md` |
| 6 | **M1–M4 in the Live fork** (shell scope, rev. 2) | Ableton Live 12 Suite 12.0.25 (possessed, in active use); Max for Live / RNBO / LOM paths owned by the parallel REA thread | 8 decision points — `lane-6-ableton-shell/SCOPE.md` |
| 7 | app structure (owner ask: where expressions ends and techne begins) | the cradle itself — static + import-graph survey | 7 structural moves — `lane-7-app-structure/STRUCTURE.md` |

**126 concrete features/functions across the five instruments**, each with
what it does, the reference behavior it attains, the landing seam in the
cradle, a UI-harmonisation note, and a verifiable acceptance shape.
Data-saving and navigation targets are explicit entries in every lane.

## Cross-lane contracts (verified at the wire-shape level)

1. **The shared time model — lane 2 owns, lane 4 consumes.** Lane 2's T6
   publishes `techne:time-axis/v1` (dated events + uncertainty +
   provenance + period bands + session time window, all existing contract
   fields, no new store); lane 4's T14/T15 time slider and window playback
   consume exactly that shape plus T17's session window. Verified in both
   documents.
2. **The shared editing core — lane 3 owns, lane 5 consumes.** Lane 3's
   SC-1…SC-7 (sequence model, operation surface, receipt interface, time
   base and channels, and the rest) satisfy the five capability sections
   lane 5 named as binding dependencies (transition-capable engine,
   selection/inspection, fullscreen/focus chrome, per-scene save/restore,
   keyframe channels). Line-by-line binding is phase-3 work; no conflict
   found.
3. **The audit's craft bars travel.** Stillness lawful (lane 2 T23, lane 4
   T29, lane 1 A4/A9/C4), fullscreen + focus mode (lanes 1–3), colour
   journeys with meaning (lane 2 T23), render-verified composition (lane 1
   B3, lane 3), metadata banned from the stage (multiple). The 2026-10
   enrichment failure is the named negative law of this programme.
4. **One data-saving family.** Lane 3's E17–E19 adopt the Obsidian A1
   posture (D-1 atomic-write decision recorded, not silently taken); lane
   1's save schedule rides the kernel ack gate; lane 2's T15–T18 and lane
   4's T17–T21 persist through existing owner routes with refusal laws
   intact. No lane proposes a second semantic store.
5. **One-field identity everywhere.** Every lane's navigation targets
   round-trip through subject identity (lane 1 C3 canvas→graph hop, lane 2
   T20, lane 4 T23/T24, lane 5 T23/T24, lane 3 E21–E23).

## The shell lane's relation to the target sets

SCOPE.md revision 2 scopes the **M1–M2–M3–M4 physical music instrument**
(QL-MEF #281) into the Ableton Live fork — the correct subject after the
owner's same-day correction, which revision 1 had missed (it mapped this
programme's own M5-layer instruments). Live natively answers part of lane
3's editing-model set (envelopes/keyframes, arrangement sequencing,
comping-as-takes); the exact coverage map (what the shell answers vs what
remains Expressions-side) is convergence item 6 in SCOPE §9, owned by the
parallel Live REA thread + lane 3 at phase 3. Owner rulings applied 2026-
10-07: **D-G ruled** — the live Expressions application remains the M4
body, genuinely integrated into the Live fork as the cymatics/physics
embodiment surface; **D-F resolved** — no M-prefix at all, plain names
(project/graph, canvas, timeline, journey, places, palace).

## The structure verdict (lane 7)

The §11a law — one application, two operating modes — **is already enacted
in the code but almost nowhere legible**: `workspace/mode.ts` gives one
shell with `expressions` and `techne` as curated modes of one pane system,
and both mode centres mount the *same* vendored Expressions application
(`setHostMode` swaps lens studio and instruments over one retained
document). The owner's intuition ("instrument 0 IS the expressions app")
is how the code actually behaves; what is wrong is that the tree lies
about it — `src/techne/` mixes live centre, wiki bindings, and an entire
~40-file orphaned architecture (cradle-side rail, instrument vocabulary,
session model, the whole `m0m5/` pure-model tree) with **zero consumers**,
while boundary correctness survives only as post-hoc guards across four
files. The proposal (STRUCTURE.md §6, moves P1–P7): one boundary module
stating what crosses the mode line; a tree rehome carrying the law
(`centre/`, `wiki-projection/`, `bodies/`, `instruments/<plain-name>/`);
retire the orphaned arrangement (keeping the adapter's Action-receipt
validation, which states the right law); wire the pure models where the
five lanes land (all landing seams survive); let `MODE_CURATION` state the
body/mode relation plainly; naming harmonisation at phase 4. The boundary
module doubles as the portable artefact for the Live-fork host (D-G ruled:
same contract, Live-side implementation).

## What the owner is asked to adjudicate

1. **The five target sets** — approve, trim, or re-prioritise; they are
   the phase-3 work programme per instrument.
2. **Phase-3 order.** Recommendation: lane 3 first (its editing core
   unblocks lane 5's RE passes and its A1-shaped save work strengthens
   every other lane), lanes 2 and 4 next (the time-axis contract is
   already proven at the wire level), lanes 1 and 5 following. All five
   are independent products and can run staggered — rate limits killed
   two runs at full concurrency; stagger or narrow the fleet.
3. **The shell decision points D-A…D-H** — especially D-G (M4 body), D-H
   (audio-body hosting), D-B (the two-clock bridge, shell-independent and
   cradle-wanted), D-F (adopting M5-k′ naming in code).
4. **Phase-4 harmonisation and phase-5 integration** proceed per lane once
   their phase-3 evidence exists, through the env seats, under the same
   guardrails.

## Operational record (honest)

- Two runs died to API rate limits (1302) at five-lane concurrency; a
  session restart killed the first fleet. Recovery: continuation agents,
  incremental-write discipline (write after every research cluster), and
  staggering. Deliverable files landed intact across three attempts.
- All lanes did static/source/document reading; **no lane executed the
  live desktop app end-to-end** — each names its unverifieds (live runs,
  un-exercised kernel paths, doc-derived reference behaviors). Acceptance
  shapes are written to be executable when phases 3–5 begin.
- Scratch (all source clones, captures) lives under `/tmp/…` with commit
  hashes and sha256s recorded in the lane RE-TARGETS documents; nothing
  entered product trees.
- Registered in the O-I project NOW as an active handoff chain; this
  campaign directory is the durable record.
