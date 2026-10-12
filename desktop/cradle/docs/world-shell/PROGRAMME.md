# Technè instruments — genuine functionality parity programme

## Wayfinder — World shell (charted 2026-10-08)

The execution map for the new-shell convergence is
[`wayfinder/MAP.md`](wayfinder/MAP.md) (tickets under `wayfinder/tickets/`,
orchestrator brief at [`wayfinder/EXECUTION-PROMPT.md`](wayfinder/EXECUTION-PROMPT.md)).
It is the centre of gravity for shell work and outstanding testing as the
lanes run; its decisions index back into the design at
`new-shell/WORLD-SHELL-DESIGN.md`.

## Owner rulings — implementation commission (2026-10-07, evening)

Recorded from the owner's direction in conversation and the planning-session
document, superseding older wording wherever the two differ:

- **D-A RESOLVED (wording corrected 2026-10-07, late).** The build base is
  the **reengineered Ableton shell now under construction** by the owner's
  shell-builder session. `Work/O-I/packages/live-shell/` is **not** that
  shell — it is the first library (`.als` document read/write) plus a
  124-line document-inspector dev surface whose JSON API
  (`/api/summary?path=…`, `127.0.0.1:8787`) is, for now, the only stable
  data-plane contract. There is **no runnable shell app yet**. Astra works
  the data plane against that API (views, editing-flow bindings, the
  portable boundary, host-side integration prepared) and mounts nothing
  until the shell surface exists; the shell-builder session owns the shell
  surface, engine and RE agents.
- **D-E REVERSED.** The earlier posture (M0/M5 stay cradle-side, coupled
  views only) is superseded by the owner's clarified intention: the
  Expressions app **and** the M0/M5 deep-working app come into the shell as
  first-class inhabitants, open for the rest of the Ableton RE to land
  into, ready for the Factory and Central modes as following inhabitants.
  Native owners remain authoritative wherever they are.
- **Target sets APPROVED** as the full functional scope (all five, 126
  targets, identities and craft bars preserved). **Phases 3–5 AUTHORISED**
  for the Astra implementation lane: import, adaptation, harmonisation and
  integration within its candidate — the research-only restriction is
  superseded for that lane, and only that lane.
- **D-H DELEGATED** to the Astra lane as an engineering decision (native-
  first reuse of the existing C++ audio/modal body on its most mature
  compatible hosting path; resolved from source and executed audio, not
  returned to the owner).
- **Licence gate (binding for code adoption).** Before any reference-source
  code enters a candidate: classify adopt / clean-room / interface-only per
  source. Known: tldraw is study-only (source-available — no vendoring);
  Kdenlive, Olive, Shotcut are GPL-family (adoption carries obligations —
  decide explicitly); Excalidraw, Godot, Twine, MapLibre, CesiumJS are
  permissive/BSD/MIT-family. Record the classification next to the target
  it serves.
- **Lane boundedness.** The Astra lane (new-shell convergence) and the
  Cradle thread (parity pass + P1–P7 source reorg) are disjoint subjects.
  Shared artefacts: the lane-7 portable boundary is built once, consumed by
  both; shared native dependency repairs are bounded changes at the native
  owner keeping both consumers compatible.

---

**Standing:** owner-commissioned, 2026-10-07, in conversation. "Feature
enrichment, UI and UX harmonisation, and clarification of data saving and
navigation" across the Technè arrangement, by reverse-engineering genuine
reference products for actual functionality parity.
**Register:** the `reverse-engineering` project (moved from O-I
campaign-evidence by owner direction, 2026-10-07 — reverse-engineering
threads, campaigns and evidence land in `Work/reverse-engineering/`;
phases 4–5 harmonisation/integration still execute as code through the
O-I env seats). The cradle this programme serves:
`Work/O-I/desktop/cradle/`. The Obsidian campaign referenced below moved
into this ground (owner confirmed its lane complete): `../2026-10-07-obsidian-re/`.
**Method:** `reverse-engineering-playbook` (decompile → understand →
recreate; study/document only; every claim carries evidence + confidence +
limitations; possession checked and recorded).
**Lane method:** `central-parallel-execution` — this file is the one
converging ledger record; per-lane documents live in the lane directories.

## Prior art this programme stands on

- `campaign-evidence/2026-10-07-obsidian-re/` — completed Obsidian 1.7.7 RE
  (save/handling A1, plugin ecosystem A2, graph/links A3; contracts, 38/38
  gates, recreation backlog T1–T7). This is lane 1's Obsidian half, DONE.
- `campaign-evidence/2026-10-07-expression-audit/FINDINGS.md` — the audit of
  the 2026-10 enrichment: floors that measured churn passed 52/52 while the
  craft failed (buried glyphs, mandated metadata on the stage, no colour
  journey, no stillness, no fullscreen). Law for every lane: **target sets
  name craft-quality bars, never compliance checklists.** The proposed
  floor in that audit (§"What good asks for instead") is carried into lane
  3 and 5's targets.
- `docs/experience/TECHNE-DUAL-READING.md` — the instrument constellation
  and its laws: one-field identity (subject_ref preserved across readings,
  §3), native-owner reuse (§2), the C0–C5 acceptance binding, and §7's
  development-pass intent per instrument.
- The rectified failure mode: earlier enrichment lanes built UI/features
  outside the proper app. Instrument work happens **in the instrument**;
  harmonisation and integration land in the cradle through the env seats.

## Lanes

**Naming rulings (owner, in conversation, 2026-10-07):** the technē deep
instruments are **not to be called "M" anything** — not the cradle's
M0′–M5′, not M5-0′…M5-5′ either. They are named by their plain actual
names: **project/graph, canvas, timeline, journey, places, palace**; the
collective is "the techne mode" / "the deep mode". The real M1–M2–M3–M4
remain the QL matrices of the physical music instrument
(`Work/Quaternal-Logic/docs/M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md`, QL-MEF
#281, L5 lock §11a). Programme documents adopt the plain names immediately;
a code rename (the `m0m5` tree) is a harmonisation-phase decision. The
older M-k′ labels appearing in lane documents written before the ruling
map as: M5-0′ project/graph · M5-1′ canvas · M5-2′ timeline · M5-3′
journey · M5-4′ places · M5-5′ palace.

**Shell ruling (owner, in conversation, 2026-10-07):** the live Expressions
application **remains the M4 body** — genuinely integrated into the
Ableton Live fork as the cymatics/physics embodiment surface, musical and
symbolic. Lane 6's SCOPE.md §3 (M4 row) and D-G record it; the open
engineering question there is hosting mechanics (D-H), not location.
Lane 7 is opened on the owner's structure ask: where the Expressions body
ends and the techne mode begins in the cradle code, and how to properly
structure the techne side (`lane-7-app-structure/`, one STRUCTURE.md).

Owner numbering → instrument constellation (M5-k′ names; cradle code paths
in `src/techne/instruments.ts`):

| Lane | Owner's name | Instrument(s) | Reference bar | Directory |
|---|---|---|---|---|
| 1 | "miro/obsidian" | M5-0′ Project/Wiki/Graph + M5-1′ Canvas/Constellation | Obsidian (done), Miro-class canvas | `lane-1-canvas-graph/` |
| 2 | timeline / historiography | M5-2′ Relation/Timeline | historiography-grade timeline tool | `lane-2-timeline/` |
| 3 | expressions (works) | 3:3 Expressions (conjugate) | a real video/scene editing tool | `lane-3-expressions-editor/` |
| 4 | "google earth clone + data layers" | M5-4′ World/Places | Google Earth + data viewing layers | `lane-4-world-places/` |
| 5 | "expressions editor improvements" | M5-3′ Journey/Scenes + M5-5′ Palace | same editing core, journey composition | `lane-5-journey-palace/` |
| 6 | shell contemplation (owner, 2026-10-07; corrected same day) | **M1–M2–M3–M4** — the physical music instrument (#281) — in an Ableton Live 12 fork; M0 + M5 couple as disclosure | Live 12 as shell — scope, not commitment | `lane-6-ableton-shell/` |

Lane 6's contract differs: one `SCOPE.md`, **revision 2** — revision 1
mistook the M5-layer technē instruments for the owner's M1–M2–M3–M4 and was
corrected; the revision records the miss rather than hiding it. Its
subject is the physical music instrument (M1 oscillator source; M2
tuning/modulation over that source, never a second generator — owner D13;
M3 forms/articulation/score; M4 the Expressions application body) hosted in
the Live fork, with the M0 ground and M5 deep mode coupled via the kernel
bus. It carries the two-clock doctrine (civil time keeps NOW/DAY closure
law; one work-time core; one typed bridge) and the shell-plurality posture
(kernel stays the semantic bus; Live is a front-end, never a second
semantic owner). Decision points D-A…D-H; the decisive one is D-G (does
M4's body become Live-hosted — an amendment to L5 §11a and #281's host
commission, owner ruling required). Converging inputs: the full REA on
Live 12, the minimal 0/1/2 port (Central mode), and the particle/physics
sound-generation recon (Sound Particles / Shrapnel / Tetrad / Anukari —
the M1 physical-modelling evidence base).

Shared-editor law: **lane 3 owns the editing-model target set** (the
expressions editor core); **lane 5 consumes it** as a recorded dependency
and targets only journey/palace composition over it. Lane 2 and lane 4
share temporal semantics (dated events on the globe) — lane 2 owns the time
model, lane 4 records the interface point.

## Phase ladder (per lane)

1. **Initial research** — current state of the instrument in the cradle:
   what exists (file:line evidence), how data saving works today, how
   navigation between instruments preserves subject identity, gaps.
2. **RE target selection** — survey candidates, verify and record
   legitimate possession (installed app / open-source checkout / observable
   web app), choose the genuine target(s) with reasoning tied to concrete
   feature families.
3. **RE passes** — findings with evidence, implementable contracts, gates
   (the obsidian-re pattern).
4. **UI harmonisation pass** — one Expressions-family visual/interaction
   grammar; each instrument keeps its native controls (dual-reading §7 UI).
5. **Integration into the cradle** — through the env seats, per the
   recreation backlog's landing seams; the kernel's authority laws hold
   (no second semantic store, no second write path, owner-disclosed
   capability only).

Phases 1–2 run now (this session); 3 follows per lane once targets are
agreed; 4–5 are implementation campaigns on the seats.

## Lane deliverables (phases 1–2, per lane directory)

- `FINDINGS.md` — current-state research with file:line evidence; data
  saving and navigation behavior **today**, named gaps.
- `RE-TARGETS.md` — candidates surveyed with possession status; the chosen
  target(s), version/surface observable, reasoning per feature family.
- `TARGET-SET.md` — **the owner deliverable**: concrete numbered features
  and functions as targets. Each entry: what it does for the instrument,
  the reference behavior it attains, the landing seam in the cradle, the
  UI-harmonisation note, and a verifiable acceptance shape (what evidence
  shows parity). Data-saving and navigation targets are explicit entries.

## Guardrails in force

- Read-only on every product tree; lanes write only inside their own lane
  directory.
- No target code or assets move into any product tree; recovered material
  appears only as short quoted evidence snippets with offsets, inside the
  campaign directory.
- No DRM circumvention; no possession, no RE — record the candidate as
  blocked-with-reason instead.
- Scratch (cloned open-source checkouts, captures, fixtures) lives outside
  product trees and is cited only through the durable lane documents.
- A completion claim carries executed evidence; what stayed unverified is
  named, not hidden.
