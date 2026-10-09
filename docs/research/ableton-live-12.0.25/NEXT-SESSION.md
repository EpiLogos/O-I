# NEXT SESSION — resume the Ableton Live 12.0.25 RE campaign

Read, in order: `docs/research/ableton-live-12.0.25/README.md` (source lock +
guardrails) → `docs/research/ableton-live-12.0.25/reconstruction-backlog.md`
(open items, each with a named probe) → the latest NOW returns in
`Work/O-I/ProjectCentral/now/agents/` (actor `agent:zcode-live-dynamics`).

**State**: five devices modeled and gated (Glue — circuit model fully closed,
zero fitted scalars, §8/§9 recorded; Echo — tap budget exact + AmountDelay
depth law; Reverb — IR model; Wavetable — voice + 4-frame interior law +
unison spread law; Operator — envelope topology). Shell plays audio
(`cargo run -p live-shell -- --play <set.als>` from `packages/live-shell/`).
Render cycle: ~6 s per probe (shrunk-loop sets; `build_session_probes.py`
stamps the 11.75/10-beat convention onto derived sets).

**Closed since the last pointer (night lane 2026-10-09, ee0ca0d95)**:
- Glue ×1.40/0.4701 items were ALREADY closed at 752ea7e2a (the old pointer's
  item 1 was stale — §8 dissolves the ×1.40 writer, §9 derives 0.470000).
- Wavetable mod-freeze: persists on a fully clean boot (3rd instance,
  recovery state cleared) — not crash-lineage state; reaches the Osc 1 Pos
  destination too (clamps at 0); the engine never showed a live sweep in any
  held render. Labels 8/9/12 unattachable behaviorally (mod-matrix.md final
  section).
- Wavetable unison Amount axis: **spread = ±50¢ × Amount**, centre voice
  fixed, RMS Amount-invariant (wavetable-voice.md; D15 Amount CLOSED).
- Echo AmountDelay depth: **pp wobble ∝ Amount³**, R = 0.26 × L constant,
  loop-internal accumulation proven (echo.md round 4; D17 curve CLOSED).

**Open, each with a named next probe** (details in the backlog):
1. Operator Osc B–D shells + WaveForm table (the XML nesting is documented
   in params.rs OPERATOR table comments).
2. Wavetable voice depth: long-note unison re-probe (4-beat notes → 0.5 Hz
   resolution, pins amplitudes/phase layout), mode-enum identities, D16
   slope warp-curve sweep (−1…+1; 0.0/0.5 measured) + Attack/Release slope
   families.
3. Echo δ(thr) mapping sweep (duck threshold offset 0.0→+1.2 dB as thr
   −24→−30) + TimeLink=false pair with tL/tR ratio ≠ 2 (backlog item (d)).
4. D18-continued: session-capture driver for M4 follow semantics + builders
   `build_set.py`/`build_set_midi.py` adopt the clip `Time` attribute
   (offline, no Live needed).
5. D11 `VD0_NEG.als` is still staged — one render closes the negative-amount
   case.
6. Mod-source labels 8/9/12: only lever left is a UI-authored set (one route
   laid out by Live's own writer, saved to a scratch Project folder, diffed
   against the hand-built XML) — editor automation + the Project-folder
   cascade must be handled; otherwise close as machine-state and keep the
   shell's additive Amp-row model.
7. WMR_A10 velocity-transfer shift (11.22 vs 21 dB spread, shape preserved):
   re-measure only if the engine ever renders mod routes at its 2026-10-07
   state; do not model the exact transfer from the current state.

**Rules that earned this state**: bounded lanes, one Live owner at a time,
frontmost-guarded keystrokes, never pkill, gate everything against renders,
zero fitted scalars in live-dynamics (citations only), commit as you land.
The renders dir holds the 20 gate inputs + this round's 12 evidence renders;
older evidence lives in `~/tools/live-re/archive-20261007/`.
