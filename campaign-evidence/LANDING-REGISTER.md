# Landing register — reverse-engineering → shell convergence

**Standing:** owner direction, 2026-10-07 — RE elements land **first
class**: the decode contract is the functional spec of record, the shell
hosts it, and wiring agents conform to it thereafter. Acceptance is the
decode's own gates (golden renders), not a wiring agent's opinion.
**The one rule that kills cross-chat waste: the tree is the only
coordination medium.** A lane that needs another lane's output checks that
lane's landing path. If it is absent, the lane proceeds with what exists
and records the dependency as pending in its own checkpoint — it never
messages the other lane. Cross-chat is for one-off owner-level
communications only.

## Lanes and their landing paths

| Lane | Writes (landing paths) | Reads (inputs of record) | Checkpoints |
|---|---|---|---|
| **Live-12 RE agents** (device decodes: Glue, Wavetable, discriminators) | `Work/reverse-engineering/live-12-re/devices/<device-slug>/DECODE.md` — parameter laws, LUT/solver derivations, byte offsets, confidence, limitations; `…/gates/` — golden renders, fixture sets, render-diff results | The binary + crafted fixtures only. Nothing from other lanes. | One DECODE.md + gate result per device; note in reverse-engineering NOW when a device lands |
| **Audio-engine agent** (M1 offline graph) | Engine code in the shell tree it was dispatched against (`packages/live-shell/` or the sibling its brief names); gate evidence → `Work/reverse-engineering/live-12-re/engine-gates/` | Its dispatch brief; the decode contracts of devices it renders | Gate result per acceptance run |
| **Shell-builder** (shell frame, kernel, panels) | `Work/O-I/packages/live-shell/` — kernel `src/`, UI `ui/`; the integration surface is the panel registry (`ui/PANELS.md`, `ui/src/shell/panels.ts`) — panels are registered data, never frame changes | DECODE contracts when wiring a decoded device; nothing else from other lanes | O-I project NOW |
| **Astra** (new-shell convergence) | Panels + boundary module inside `packages/live-shell/` per `ui/PANELS.md`; programme checkpoints in `desktop/cradle/docs/world-shell/` | `2026-10-07-techne-instrument-re/PROGRAMME.md` (rulings block = law), `CONVERGENCE.md`, the five TARGET-SETs, `ui/PANELS.md`, DECODE contracts | NOW return per coherent increment |
| **Cradle parity thread** | `Work/O-I/desktop/cradle/` through the env seats; P1–P7 reorg per lane-7 STRUCTURE.md | lane-7 STRUCTURE.md; its own targets | O-I project NOW |
| **Sound-gen recon, 0/1/2 port, instrument phase-3 RE campaigns** | Evidence + findings → their own dirs under `Work/reverse-engineering/`; code → their owning trees | Their own briefs | reverse-engineering NOW |

## Other-app RE lanes — features that feed the shell's UI/UX

These lanes reverse-engineer **other applications**; their recovered
features and functions are ingredients for the Ableton shell app. Their
contracts are the spec of record; the shell-builder and Astra consume them
from these paths and adopt the features through the panel registry /
boundary — conforming to each contract's craft bars. No lane messages
another; the paths below are the only interface.

| RE lane | Contracts of record (inputs of record) | Further findings land at |
|---|---|---|
| **Obsidian RE** (save/handling A1, plugin ecosystem A2, graph/links A3) — **COMPLETE, moved into this ground** | `2026-10-07-obsidian-re/` — contracts/, integration-map.md, recreation-backlog.md T1–T7 | `Work/reverse-engineering/obsidian-re/` |
| **Buzz/Grok agent-messaging RE** — **COMPLETE, moved into this ground; outputs regenerated + widened 2026-10-08** | `2026-10-07-buzz-grok-agent-messaging-re/` — buzz-messaging/CONTRACT.md (messaging mechanics), buzz-messaging/AGENT-SYSTEM.md (agent system + UI/UX), screenshots/, decompile evidence | `Work/reverse-engineering/buzz-grok-messaging-re/` |
| **Grok Bot RE** (xAI desktop agent client on the Anysphere/Cursor stack) — **DECODED 2026-10-08** | `2026-10-08-grok-bot-re/` — DECODE.md, decompiled/ (3 binaries, 306 functions), logs/, asar-inventory/ | `Work/reverse-engineering/2026-10-08-grok-bot-re/` |
| **Instrument reference families** (tldraw/Excalidraw canvas, Kdenlive/Blender VSE/Olive/Shotcut editing, Cesium/MapLibre globe, TimelineJS/vis-timeline/PeriodO time, Godot/Twine/Unity journey, Sound Particles/Shrapnel/Tetrad/Anukari physics-sound, Miro/Google Earth UX bars) | `Work/reverse-engineering/2026-10-07-techne-instrument-re/lane-*/TARGET-SET.md` + `RE-TARGETS.md` — the 126 contracts of record | `Work/reverse-engineering/<target-slug>/` per new campaign |

Shell consumption rule: the shell-builder and Astra read these contracts
as the functional spec for the corresponding shell surface (saving family
← A1; wiki/graph/canvas panels ← A2/A3 + canvas families; agent
conversations ← Buzz/Grok; Places ← globe families; Timeline ← time
families; Journey/Palace ← journey families; the physical instrument ←
physics-sound references). Adoption follows the licence gate (PROGRAMME.md
rulings block). Both completed O-I campaigns remain migration candidates
to this ground once their citing sessions confirm quiescent.

## What "first class" means concretely

1. A decoded device's **DECODE.md is the spec of record** — parameter
   laws, LUT/solver derivations, offsets, confidence, limitations. Wiring
   agents implement *to the contract*; they do not redesign it. If the
   contract looks wrong, the lane records the discrepancy at the contract
   (a note in the DECODE dir) and proceeds — it does not silently deviate
   and does not debate in chat.
2. **Acceptance is mechanical**: the device's golden-render gates pass on
   the candidate's implementation. No gate, no claim — the playbook's
   completion rule verbatim.
3. RE decodes, findings, contracts and evidence land in this ground
   (`Work/reverse-engineering/…`); product code lands in its owning tree;
   the two are connected by the paths above, never by conversation.
4. Every lane's session brief carries this rule: **coordinates live in
   files; files are read before work; absent files mean "proceed and
   record pending," never "message the other lane."**
