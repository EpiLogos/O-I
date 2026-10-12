# Sources — DLW-PLAN-p2-ableton.md

Every file read by lane `zcode:dlw-ground-p2` (2026-10-10) and what it contributed.
Bracketed tags in the chapters resolve here. Paths absolute.

## A. The Live REA + RE evidence — `/Users/admin/Central/Work/O-I/docs/research/ableton-live-12.0.25/`

| file | contribution |
| --- | --- |
| `README.md` | [README] — the source lock (12.0.25, binary size, schema counts, Ghidra project), the four-step method, the DSP testing gate, guardrails (no redistribution, clean-room, decompiled material out of product source) |
| `session-model.md` | [session-model] — container format, LiveSet skeleton (tempo in MainTrack mixer; ReturnTrack as plain Tracks member), track anatomy, the five loader rules + MIDI-clip rules (§4, §7 — including the clip `Time` anchor), device parameter model (§6), clip model (§5), semantics still unverified (§8) |
| `devices/COVERAGE.md` | [COVERAGE] — the binding 70-device scope (13+46+11), the status ledger (which devices have param surface / behavior doc / binary derivation / crate / gate), the residual-24 line, warp/racks/followaction/groove/mixer rows |
| `devices/racks-session-model.md` | [racks] — the four rack devices + class vocabulary, group-device chassis quote (macros 0–15, snapshots, variations, chain selector), branch skeleton, preset wrapper, chain-selector zone math with the real 3-chain quote, drum pad identity + rack-in-rack, macro-mapping negative finding (no `MacroControlMapping` anywhere; Flip `live.MacroMapping` strings), mixer model (−70..+6 dB closed forms, chain mixers, master/cue/crossfader), scenes, clip slots, groove pool, locators, track topology, verification ledger, open items §7 |
| `devices/mod-matrix.md` | [mod-matrix] — Wavetable 52×13 matrix encoding + destination table, source attribution (0 = Key, 10 = Velocity; D10 closed positive), additive Amp-row law, the frozen-modulator machine-state saga (8/9/12 stuck at −1.0, persists across clean boots, second destination proven), shell consequence: expose the matrix, not a fixed velocity knob |
| `devices/wavetable-voice.md` | [wavetable-voice] — probe-set discipline (single-pin edits), voice architecture, fitted laws (linear amplitude, frame swap → 4-frame census closed), unison stereo layout (alternating hard pan, ±50¢×Amount, √(2/N) gain law, crate fix enacted), decay warp law `v(u)=(e^(−ku)−e^(−k))/(1−e^(−k)), k=7.41·slope` |
| `devices/operator-voice.md` | [operator-voice] — probe pins table (OP2…OP9), 23-row params.rs descriptor, envelope topology (decay exp-in-amp τ=0.120 s; release dB-linear (level+70)/time), velocity unrouted default, shells Operator.0–3 |
| `devices/sampler-derivation.md` | [sampler-derivation] — zone/layer storage model (AMultiSample* compounds; key/velocity/selector range types), Sampler≡Simpler one-engine law, sample-as-URI rule, per-sample DSP not located |
| `devices/simpler-derivation.md` (head) | [simpler-derivation] — single-zone model, SubOsc laws, shared warper (via COVERAGE row) |
| `devices/lfo-derivation.md` | [lfo-derivation] — NEGATIVE (LFO.amxd is M4L; browser name-pool evidence) + the engine `OLfoProcessor` law (shapes, S&H, smoothing, attack fade, tempo-sync, retrigger phase) |
| `devices/mpecontrol-derivation.md` | [mpecontrol-derivation] — NEGATIVE (M4L) + native MPE machinery: `AMpeSettings` zone model (/MpeSettings, Lower/Upper zones), MpeSettingsDialog, MpeDecoder/Encoder/Filter/TuningSystemToMpe |
| `devices/analog-, electric-, collision-, tension-, corpus-, drift-, impulse-, meld-, resonators-, hybridreverb-, looper-, spectrum-, vinyldistortion-, vocoder-, shifter-derivation.md` (headers/status lines) | [per-name] — provenance form + headline derivation claim for each (AAS family ×5, devicekit family, state machines, analyzer, negatives/thin spots) — headline claims cross-checked against their COVERAGE rows |
| `devices/glue-compressor.md`, `glue-perblock-derivation.md`, `glue-absolute-threshold.md` (via COVERAGE + backlog rows) | [glue-*] — circuit model fully closed, zero fitted scalars; the form-exemplar |
| `devices/echo.md`, `reverb.md` (via COVERAGE, backlog, NOW returns) | [echo; reverb] — gated laws as summarized (cubic AmountDelay, δ(thr) linear, TimeLink; IR model + HF tail + decorrelation) |
| `devices/arpeggiator-, chord-, velocity-noteecho-, autofilter-, saturator-, eq8-, compressor-, delay-, multiband-dynamics-, limiter-, gate-, redux-, overdrive-, erosion-, chorus-, phaser-, filter-delay-, graindelay-, beatrepeat-, channeleq-, eq3-, drumbuss-, pedal-, dynamictube-, utility-, legacy-derivations.md`, `amp-derivation.md`, `cabinet-derivation.md` (COVERAGE rows + doc headers) | [per-name] — the audio-FX and MIDI-FX derivation headlines in the A5.2/A5.3 tables |
| `devices/follow-action.md` | [follow-action] — element shape, guessed tags refuted, the `Time`-attribute anchoring resolution, session-launch BLOCKED for the export driver |
| `devices/midi-instruments.md` | [midi-instruments] — the instrument capture method (crafted MidiClips, five loader iterations), M1/M2 baselines |
| `devices/warp-probe.md` (via COVERAGE, backlog, NOW returns) | [warp-probe] — modes 0–5 loadable, mode-0 separation under tempo mismatch, transposition ×2/×0.5 findings |
| `evidence/ui/UI-EVIDENCE.md` | [UI-EVIDENCE] — the measured dossier: global layout, five regions, transport slot list, browser/pool, session grid anatomy, arrangement anatomy, interaction facts, density/dimension facts, adopt/adapt/never-ship binding |
| `evidence/ui/live-session-real.png` | [capture 1] — READ AS IMAGE: tracks 2-Group, 3–13 LABS, A Reverb, B Delay, Main; 8 scene rows; amber selected slot in 13 LABS; armed track 4 (red); routing stacks (MIDI From/Monitor/Audio To); mixer strips (Send A/B with loop-ring icons, pan, fader −∞..+6, track-number/arm/S/activator/meter); Master column (Cue Out/Main Out 1/2, Post, tempo); Groove Pool ("Drop Clips or Grooves Here", Global Amount 100%); browser Instruments list; "No clip selected."; status strip 13-LABS |
| `evidence/ui/live-arrangement-real.png` | [capture 2] — READ AS IMAGE: beat ruler 1…673 (32-beat spacing) + loop brace + Set markers; lanes 13 LABS…18 piano4, A Reverb, B Delay, Main with waveforms/named MIDI blocks/red automation; right-side headers with device dropdowns (EQ Eight ▸ 1. Frequency), routing, volumes (−7.4/−4.4 dB); bottom Clip panel (Start/End/Loop/Signature 4/4/Groove/Scale C Major/Launch/Pitch & Time/Stretch) + note editor (C5–C2, velocity lane Randomize 100/Ramp 100·127/Deviation 0, Focus LABS10); time ruler 0:00–20:00, 4/1, 1.00x, H/W |
| `evidence/ui/live-wavetable-device-panel.png` | [capture 3] — READ AS IMAGE: dense horizontal device strip in instrument slot with `Drop Audio Effects Here` terminator; chain header `Live12DefaultM V2-1`; four lettered Coarse/Fin/Fixed/Level rows + Noise row (−∞..0.0 dB); sections Envelope (0.00 ms/1.00 s/400 ms/Time<Vel/Sustain/Initial/Peak), Oscillator (Wave: Sin, Feedback/Repeat, Key 50%, Phase, Osc<Vel), LFO (Sine 100.00 Hz +10%), Filter (12/24 · Clean · 2.0 kHz · Res 28%), Pitch Env, Time/Tone/Volume (0%/70%/−18 dB); blue curve display; right dock = Live 12 Lessons; set VD0_NEG, tempo 120.00, time selection 1.1.1→129.1.1 (4:16). **Identified as Operator by the crosswalk's measured correction** — filename not evidence |
| `ui/UI-EVIDENCE.md` (same file as `evidence/ui/` — read at the `ui/` path) | duplicate citation path in the commission; one dossier |
| `LANES.md` | [LANES] — Thread A/B contracts (behavior truth = dossiers; code truth = gated crates; acceptance truth = golden renders + loader loop); current state |
| `NEXT-SESSION.md` | [NEXT-SESSION] — five devices gated; rounds landed; the seven open items with named probes; the rules that earned the state |
| `integration-map.md` | [integration-map] — the receiving surface (cradle, native-audio precedent, no audio-DSP surface gap), landing paths |
| `reconstruction-backlog.md` (header + verify gate + rows + structure) | [backlog] — verify-gate thresholds (0.5 dB/step, 1.0 dB spectral mean, 1.0 dB envelope MAE, dither bound 23 LSB/4.1%), gate rows for Glue/Echo/Reverb/Operator/Wavetable, wavetable data policy |

## B. The live-dynamics lane's records — `/Users/admin/Central/Work/O-I/ProjectCentral/now/agents/`

| file | contribution |
| --- | --- |
| `rounds-38-landed-20-commits-crate-2026-10-09.json` | [NOW rounds-3-8] — gate suite 13/13 PASS; wavetable closed N=1–8; Operator FM wired; reverb extension R4 18.7→4.7%; warp mode-0 separates; remaining thin spots named |
| `round-2-converged-four-parallel-lanes-2026-10-09.json` | [NOW round-2-converged] — Operator B = PM/FM modulator shell; wavetable unison STEREO spread; decay warp closed; Echo δ(thr) + TimeLink; lock/commit helpers |
| `probes-round-2-landed-…2026-10-09.json` | [NOW probes-round-2] — freeze persists on clean boot (3rd instance); unison ±50¢×Amount; Echo AmountDelay cubic |
| `probes-round-echo-laws-unison-followaction-2026-10-09.json` | [NOW probes-round-echo] — Echo nonlinearity + accumulation; FollowAction Time anchor; λ discriminator |
| `night-round-2-protocol-four-subagent-2026-10-09.json` | [NOW night-round-2] — the with_live_lock.sh serialization protocol; frontmost guard; never pkill |
| `taking-the-live-window-cleanboot-wavetable-2026-10-09.json` | [NOW cleanboot] — batch claims, WMR probe set, health control −26.57 dBFS |
| `render-queue-pending-on-live-wtup12-2026-10-08.json`, `warp-transposition-landed-wtup12wtdn12-2026-10-08.json` | [NOW render-queue; NOW warp-transposition] — window claim discipline; transposition findings; the silence fault discovery |

## C. The shell-inputs index and landing register — `/Users/admin/Central/Work/reverse-engineering/`

| file | contribution |
| --- | --- |
| `shell-inputs/INDEX.md` | [shell-inputs INDEX] — the RE output pack for shell lanes; `live-12-re/devices/<slug>/DECODE.md + gates/` named "empty today, the path of record" |
| `LANDING-REGISTER.md` | [LANDING-REGISTER] — decodes land first class; DECODE.md is spec of record; the tree is the only coordination medium; lane/path map |

## D. The plan's own ground — `desktop/cradle/docs/world-shell/`

| file | contribution |
| --- | --- |
| `lane-6-ableton-shell/SCOPE.md` | [SCOPE rev2] — revision 2's corrected hypothesis, verified starting facts, the M1–M4 mapping table, two-clock doctrine (§5), fit scoring (§6), decision points D-A…D-H (§8) with ruled states |
| `PROGRAMME.md` | [PROGRAMME] — owner rulings block (D-A resolved, D-E reversed, target sets approved, D-H delegated, licence gate, lane boundedness), lane table, phase ladder, guardrails |
| `wayfinder/MAP.md` | [MAP] — destination, orchestration discipline, protocol pack, aperture law, widget law, musical law, honesty boundaries, lanes/decisions (incl. the L1 one-Timeline fix, Rev 2–5 records) |
| `wayfinder/DEVELOPMENT-TRACK-2026-10-09.md` | [DEVELOPMENT-TRACK] — honest state (shell below mockup spec), R-lanes, the landed SYSTEM SHAPE (modeGrammar.ts, five modes × 28 slots, "Live unchanged (read-only honesty)") |
| `new-shell/WORLD-SHELL-DESIGN.md` (§5, §9, §11–18; Rev 5 header) | [WSD] — rack + inhabitants (§5), operation-family landings (§9), not-do laws (§11), six carvings with the owner's families quote + Central clip-view craft + AIKit skills-as-devices (§12), uncarved block (§13), modulation/scope (§14 — macros as first modulators, modulated-knob law), time spine (§15), four surfaces (§16), verticals (§17), musical system (§18) |
| `new-shell/UI-UX-CONVERGENCE-STUDY.md` | [UI-UX] — measured rulings: five-region composition, browser above/below pool, three levels of disclosure, the complete add-a-parameter activity, viewport bars, capture observations (incl. the Operator correction), current faults |
| `new-shell/FUNCTIONAL-CROSSWALK.md` | [CROSSWALK] — 126 targets + 8 operation families; the device-lifecycle family verbatim (anchors/gestures/shape/detecting trial); reference-ground corrections (the wavetable-capture-shows-Operator fact; capture inventory) |
| `new-shell/DEVICE-PANEL-BRIEF.md` | [DEVICE-PANEL-BRIEF] — whole-panel device law, three presentations (compact ≤4 / expanded / full), honest-visual rules, activator rule (hollow light), craft rules, lane rules |
| `new-shell/world-shell-mockup.html` (Rev-5 block: MODES, TPM.live, VIEWTIP, VIEWMAP, liveDetail, BCATS.live, DVN) | [mockup:world] — Live mode as base mode; per-mode transport slot meanings (live column verbatim); Session/Arrangement views; the live device chain (Drum Rack 16 pads → Glue → Reverb + dropz); live browser categories; Clip|Device pair |
| `new-shell/agent-shell-mockup.html` (device chain block) | [mockup:agent] — agent device face, skillRack (chains + admit lights + Thorough/Test-depth/Reach/Risk macros + the owner's skills-as-plug-ins tooltip verbatim), agentsetRack, gateway device + Gateways rack, world device, git device, foldedRack, dropz ("through → who → how → where → lands"), clip view (Then = follow action) |

## E. The seat's device reality — `/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/src/`

| file | contribution |
| --- | --- |
| `inhabitants/sdk/DEVICE-SDK.md` | [SDK] — device-sdk v1.1: the laws it binds, the modules, the loop (find/own/declare/compose/gate/verify), write-path grammar (`kernel:`/`shell.`/`tool:`), "a row without a writePath IS a reading", writers law + writerAuthority, §14 modulation honesty, mode-scoped plugin surface + device formats |
| `inhabitants/sdk/modes.ts` (read: declarations + formats) | [SDK modes.ts] — TRANSPORT_ROWS (8 rows), SDK_MODE_DECLARATIONS (five modes with marks, readouts, Session/Arrangement meanings, per-mode rows), DEVICE_FORMATS (`chain-plate`, `die`, `scene-strip`, `run-viewer`, `instrument-face`, `tool-tile`), MODE_DEFAULT_FORMAT (live = chain-plate) |
| `inhabitants/sdk/controls.tsx` (signatures read) | [SDK controls] — DeviceFaceAperture `{reading, disabled, apply, captureCurrent}`, useFaceDrafts, FacePlate (power/admission), ScalarParam/EnumParam/BoolParam, ReadingRow, Lamp (admit/deny/waiting/refusing/unknown), Disclosure, WaitingFace |
| `inhabitants/worldShellFamilies.ts` | [worldShellFamilies] — the six family ids; central's L2 extension (ground-hygiene, impact, day-die, flow-document, nara-conversation — each with its owner ops and waiting writers verbatim); software-factory attempt-review; idempotent loading law |
| `agent/AgentDeviceChain.tsx` (head), `agent/agentChainDrag.ts` (gesture lines) | [agent chain] — the landed chain: kernelOp reads, roster-admits reading, honest refusal lines, NativeAgentDeviceRack, chain drag encode/insertion-index/chainDropDecision with MISSING_OPS named |

## F. The planning session

| source | contribution |
| --- | --- |
| `sess_ac3200ca-b5e7-410e-81ff-4fa5a4c512e2` (ReadSessionContext, strategy relevant) | the four owner decisions verbatim: the clip-view craft quote ("nitty gritty functionalities of warping etc"), the widget ruling ("guides… MUCH BETTER than the mockups"), the rack ontology ("Skills are this session's plug-ins…"), the families quote ("our 6 products want their given family of plugins/devices"); where each landed (WSD §12–17, widget law, EXECUTION-PROMPT) |

## G. Coordinator-supplied during the lane

- The session id above; the live-dynamics corpus pointer (Work/reverse-engineering NOW handoffs + COVERAGE.md — read under A/B); the shell-inputs INDEX (read under C). Folded as citations.

## Items checked and found empty or absent (recorded for honesty)

- `/Users/admin/Central/Work/reverse-engineering/live-12-re/` and its `devices/` — **do not exist on disk**; the INDEX's "empty today, the path of record" is the accurate state. Named as gap A7.9 / OPEN-QUESTION.
- `new-shell/src/inhabitants/…` (the commission's literal path) — the SDK lives in the **seat** at `packages/live-shell/ui/src/inhabitants/sdk/`; read there.
- The commission's "~50 of 70 device slots" vs the ledger: the ledger's rows above its residual line cover ≈46 slots; the devices/ directory holds 61 evidence documents. The chapters state the ledger's own arithmetic and both counts (A5 preamble).
