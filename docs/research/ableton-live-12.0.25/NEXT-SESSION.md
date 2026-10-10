# NEXT SESSION — resume the Ableton Live 12.0.25 RE campaign

Read, in order: `docs/research/ableton-live-12.0.25/README.md` (source lock +
guardrails) → `docs/research/ableton-live-12.0.25/reconstruction-backlog.md`
(open items, each with a named probe) → the latest NOW returns in
`Work/O-I/ProjectCentral/now/agents/` (actor `agent:zcode-live-dynamics`).

**State**: five devices modeled and gated (Glue — circuit model fully closed,
zero fitted scalars; Echo — taps + AmountDelay cubic depth + leveler duck +
δ(thr) mapping + TimeLink semantics; Reverb — IR model; Wavetable — voice +
4-frame interior law + unison stereo layout + slope warp; Operator — envelope
topology + Osc B modulator shell). Shell plays audio (`cargo run -p
live-shell -- --play <set.als>` from `packages/live-shell/`). Render cycle:
~6 s per probe on shrunk-loop sets; parallel lanes serialize Live through
`harness/with_live_lock.sh` and commit via `harness/lane_commit.sh`.

**Round 2 (2026-10-09, four lanes) landed**: Operator Osc B = PM/FM
modulator of A (RMS invariant, h2 +34 dB; D11 negative-amount closed);
Wavetable unison is a STEREO spread (equal-gain voices panned hard-L/C/hard-R
— D15's asymmetric reading was a left-channel artifact) and the decay slope
warp is closed (v(u) = (e^{−ku}−e^{−k})/(1−e^{−k}), k = 7.41·slope, one
fitted scalar; one-pole τ reading superseded); Echo δ(thr) = linear (fitted
−0.189·thr − 4.613) and TimeLink=false honors own times (hop=min was the
linked special case); builders' Time anchor verified with an offline
self-check; `wavetable.rs::unison` implements the cents law (zero fitted
scalars, 43 lib tests green).

**Open, each with a named next probe** (details in the backlog):
1. Operator Osc B follow-ups: index law + PM/FM sign, `Globals/Algorithm`
   sweep (B-as-carrier), shells C/D, WaveForm labels 0..21, Phase/Feedback/
   Fine (params.rs OPERATOR comments document the XML nesting; lane 1's
   `build_lane1_probes.py` is the derivation precedent).
2. Wavetable: VC-ladder stereo re-read (pan law changes what the ladder
   means — WV12/WV13 renders were read L-only), mode-enum identities,
   Attack/Release slope families.
3. Crate integration obligations: `wavetable.rs` decay → warp law (gate the
   slope-0.5 branch against the existing goldens); unison goldens from the
   archive into the `#[ignore]` gate set.
4. Echo: TimeLink=true rewrite-vs-in-engine discriminator (linked unequal
   set round-tripped through Live's own save — needs a Save-As flow into a
   scratch Project folder).
5. D18-continued: session-capture driver for M4 follow semantics (the last
   FollowAction open).
6. Mod-source labels 8/9/12: only lever left is a UI-authored set (one route
   laid out by Live's own writer, saved to a scratch Project folder, diffed
   against the hand-built XML); otherwise close as machine-state (the freeze
   persists across clean boots; mod-matrix.md final section).
7. WMR_A10 velocity-transfer shift: re-measure only if the engine ever
   renders mod routes at its 2026-10-07 state; do not model the exact
   transfer from the current state.

**Rules that earned this state**: bounded lanes, one Live owner at a time
(parallel lanes under the lock), frontmost-guarded keystrokes, never pkill,
gate everything against renders, zero fitted scalars in live-dynamics
(citations only), commit as you land. Renders dir holds the 20 gate inputs +
round evidence; older renders live in `~/tools/live-re/archive-20261007/`.
