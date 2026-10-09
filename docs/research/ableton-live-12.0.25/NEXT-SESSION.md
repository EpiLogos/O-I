# NEXT SESSION — resume the Ableton Live 12.0.25 RE campaign

Read, in order: `docs/research/ableton-live-12.0.25/README.md` (source lock +
guardrails) → `docs/research/ableton-live-12.0.25/reconstruction-backlog.md`
(open items, each with a named probe) → the latest NOW returns in
`Work/O-I/ProjectCentral/now/agents/` (actor `agent:zcode-live-dynamics` and
`zcode:ableton-render-lane3`).

**State**: five devices modeled and gated (Glue — circuit model fully closed,
zero fitted scalars; Echo — tap budget exact; Reverb — IR model; Wavetable —
voice + 4-frame interior law; Operator — envelope topology). Shell plays
audio (`cargo run -p live-shell -- --play <set.als>` from
`packages/live-shell/`). Render cycle: ~6.25 s per probe (the shrunk
arrangement loop — verified).

**Open, each with a named next probe** (details in the backlog):
1. Glue ×1.40 detector-tap writer (binary — derivation §8; Ghidra proj2
   healthy) + the 0.4701 composition (§9 — DERIVED, needs recording only).
2. Wavetable mod sources 8/9/12: re-verify on a clean boot (the silence was
   a post-crash modulator freeze at −1.0 — mechanism closed; the labels
   8/9/12 await one clean re-render each; sets built: `harness/live/WM_S*.als`).
3. Echo AmountDelay nonlinearity mechanism (loop-internal mod — the wobble
   accumulates down the train; AmountDelay=0 render isolates it).
4. Wavetable voice depth: unison topology sweep (VoiceCount renders exist),
   Slope/Phase laws.
5. Operator Osc B–D shells + WaveForm table (the XML nesting is documented
   in params.rs OPERATOR table comments).

**Rules that earned this state**: bounded lanes, one Live owner at a time,
frontmost-guarded keystrokes, never pkill, gate everything against renders,
zero fitted scalars in live-dynamics (citations only), commit as you land.
The renders dir holds only the 20 gate inputs — older evidence lives in
`~/tools/live-re/archive-20261007/`.
