# Gate (OGateProcessor) binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
nm/CallTargetsProbe/BlockProbe headless runs, `-process Live.arm64
-noanalysis`, no re-import), plus `objdump` const-pool decodes and the
factory preset XML (`Core Library/Devices/Audio Effects/Gate/Softy.adv`).
NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/gate-decompiles.txt` (create/ctor, Init/Exit/Reset/
NewRate, all setters, both calc bodies, EQ re-init helper, const-pool
decodes, hysteresis constants). Form follows `compressor-derivation.md`;
claims graded: **[D] decompiled-confirmed** (capture cited), **[B]
byte-decoded** (nm/const pool/preset XML), **[H] unverified hypothesis** —
no behavioral renders ran in this lane; per README every [D]/[B] claim
still awaits the golden-render cross-check before it gates a rebuild.

The stock Gate is ONE processor, `OGateProcessor` (create
`SOnProcessorCreate<>` 0x1018be37c → wrapper 0x1018be3b8 (param block at
shell+0x270) → ctor thunk 0x10168562c → `func_0x000101685350` [D]). It is
a **two-detector hysteresis gate with hold counter and look-ahead rings**:
a fast envelope follower (user Attack) max-combined with a slow fixed
envelope (3 ms / 150 ms), two thresholds (open / close) derived from
Threshold and Return, an integer hold counter, four delay rings for
look-ahead, and a one-pole gain smoother whose attack/release ARE the
user Attack/Release. FlipMode rewires the hysteresis pointers (gate ↔
inverse behavior); a Live8 legacy calc variant changes which parameters
shape the detector.

## 1. What runs when (call topology)

- **Ctor** [D, evidence]: four ring objects at 0x80/0x98/0xb0/0xc8 (init
  `func_0x0001019a9894`); sr_ms (0xd0/0x100/0x130/0x258(600) = sr·0.001);
  placeholder coeffs 0xe0/0xe8/0xf8/0x110/0x118/0x128/0x140/0x148/0x158 =
  `exp(−1/sr_ms)` (τ = 1 ms, Compressor-ctor convention); gain floor
  0x160 = 0; EQ object at 0x188 built by `func_0x000101884fac(sr)` — the
  SAME builder the Compressor ctor uses [D]; defaults from const pool
  0x104cc97d0: Attack 1.0 ms (0x220), Release 1.0 ms (0x228), fixed
  detector attack 3.0 ms (0x22c), fixed detector release 150.0 ms (0x230),
  Threshold 0.0 (0x234) [B]; Lookahead default {int 1, 1.5 ms} at 0x250/
  0x254 [B: 0x3fc00000_00000001]; rings sized `int(sr_ms·10 + 5)` — the
  SAME 10 ms + 5 law as the Compressor's look-ahead ring [D]; 0x164 =
  1.5·sr_ms (default look-ahead in samples).
- **Init(OScheduler\*)** 0x10168f330 [D]: hooks the main ring's read
  pointers to this+0x70/0x78 (ring bookkeeping; scheduler stored at
  ring+0x28). **Exit** 0x10168f388 [D]: unhook. **Reset** 0x10168f3c0
  [D]: resets all four rings, zeroes envelope states 0xd8/0xf0/0x108/
  0x120/0x138/0x150, EQ reset (`func_0x000101885454`, the Compressor's
  EQ reset), hold counter 0x16c = 0, meter slots seeded from inputs.
- **NewRate(int,int)** [D]: second int = sr Hz; sr_ms → 0x258(600),
  0xd0, 0x100, 0x130; envelope states zeroed; EQ re-init
  (`func_0x000101885394(sr)` — the shared re-init); coefficient rebuild
  per Live8LegacyMode (§2 laws); Hold 0x168 = int(sr_ms·Hold_ms) with
  counter 0x16c clamped down; rings resized to `int(sr_ms·10 + 5)` with
  the current look-ahead length 0x164; `*(int*)(this+8) = 0x164`; device
  latency reported through the virtual at +0x10 (0x164 as float ms arg).
- **On/OnX** [D]: the calc-slot swap — disabled (On=0 or X=0) →
  `func_0x000101543a80(sched, 0)` + ring release (`func_0x0001019a9578`)
  + the full Reset block; enabled → CalcMain, or CalcMainLive8 when
  Live8LegacyMode 0x245 is set (PTR table 0x1050b8878/0x1050b8860 [B]) +
  ring refill (`func_0x0001019a9450`).
- **Per-sample**: CalcMain 0x10168f928 (modern) / CalcMainLive8
  0x10168f924, one sample per call [D, full captures].

## 2. The state-slot ledger (every reader → its writer)

Writers: SET = parameter setter (trampoline body), CO = ctor, INIT =
NewRate/Init, CALC = callback.

| slot | role | writer | value / law |
|---|---|---|---|
| 0x30/0x38 | main in L/R ptrs; 0x40/0x48 sidechain in L/R ptrs | shell | `**` per sample |
| 0x50–0x68 | outputs + meter taps | CALC | SideListen reroutes (below) |
| 0x70/0x78, 0x88/0x90, 0xa0/0xa8, 0xb8/0xc0(+0xc8 obj) | four rings: delayed main L, dry L?, gated L, R pair (ptr + ring obj each) | INIT/SET Lookahead | read via obj+0x40 index |
| 0xd0/0x100/0x130/0x258 | sr_ms copies | CO/INIT | sr·0.001 |
| 0xd8/0xf0 | detector env #1 state/prev (doubles, L-side) | CALC | coeffs 0xe0 atk / 0xf8 rel |
| 0x108/0x120 | detector env #2 state/prev (doubles, second detector) | CALC | coeffs 0x110/0x118 atk, 0x128 rel |
| 0xe0/0xe8 | env-1 attack pair (normal / ×6 fast twin) | SET OnAttack, INIT, SET Live8 | §laws |
| 0xf8 | env-1 release | SET OnRelease / Live8 / INIT | modern: FIXED 150 ms (0x230); legacy: user Release [D] |
| 0x110/0x118/0x128 | env-2 attack pair / release | SET OnAttack (modern: from 0x22c = 3 ms fixed; legacy: user param), INIT | 6× twin pattern (Compressor-style) |
| 0x138/0x150 | gain smoother state/prev (double) | CALC | |
| 0x140/0x148 | gain attack coeff pair | SET OnAttack | user param, ×6 twin |
| 0x158 | gain release coeff | SET OnRelease | user param |
| 0x160 | Gain floor (linear) | SET OnGain | `exp10(Gain_dB·0.05)`, clamp ≥ −75 [B preset range −75..0]; stored ms 0x248 (int) |
| 0x164 | look-ahead samples | SET OnLookAhead/INIT | ms·sr_ms |
| 0x168 / 0x16c | hold length / hold counter (samples) | SET OnHold, INIT | int(sr_ms·Hold_ms); counter clamps ≤ length |
| 0x170 / 0x171 | hysteresis bools: env > openThr / env < closeThr | CALC | |
| 0x178 / 0x180 | POINTERS: reload-cond ptr / drain-cond ptr | SET OnFlipMode/Live8 | normal: &0x170, &0x171; flipped: &0x171, &0x170 [D] |
| 0x188… | EQ object (on byte 0x188; stored mode 0x18c, freq 0x190(400), gain 0x194, Q 0x198; resolved type 0x1a4, Q 0x1ac; coeffs 0x1b4–0x200; states 0x208–0x21c) | SET Eq*, INIT | §EQ |
| 0x220/0x224 | Attack / Release stored ms | SET | defaults 1.0/1.0 [B] |
| 0x22c / 0x230 | fixed detector attack 3 ms / release 150 ms | CO | modern-mode env-1×? times [B] |
| 0x234 | Threshold (LINEAR) | SET OnThreshold | floor `exp10f(−8.0)` [B 0xc0600000] |
| 0x238 | Return ratio (linear) | SET OnReturn | `exp10(dB·0.05)` |
| 0x23c / 0x240 | open / close thresholds | SET OnThreshold/OnReturn/OnFlipMode | §law |
| 0x244 / 0x245 | FlipMode / Live8LegacyMode bools | SET | |
| 0x248 | Gain stored (int) | SET OnGain | |
| 0x24c / 0x24d | On / X bools | SET | calc gate |
| 0x250/0x254 | LookAhead enum / ms | SET OnLookAhead | 0 → 0 ms; 1 → 1.5; 2 → 10 [D] |
| 0x25c | SideListen bool | SET | |
| 0x260 | look-ahead countdown | SET OnLookAhead | int(sr_ms·10) |

## 3. The mechanism, plainly (CalcMain) [D]

```
side L/R = (EQ ? biquad(side) : side)                       // 0x188 gate
eL = |sideL|²  →  env1 = eL + c(env1 − eL)                  // c = 0xe0 rising,
                                                            //   0xf8 falling
eR likewise → env2 (state 0x108, coeffs 0x110/0x128)        // second detector
env    = sqrt(max(env1, env2))                              // linear
open   = env > 0x23c ; close = env < 0x240                  // 0x170 / 0x171
if (*0x178) counter = 0x168                                 // reload hold
else if (*0x180) counter −= 1                               // drain only while
                                                            //   close-cond true
gate   = (counter == 0) ? 0 : (--counter, 1)                // hold semantics
target = gate ? 1.0 : 0x160                                 // floor
smooth = one-pole(target, atk 0x140 rising / rel 0x158)     // USER A/R shape
audio  = look-ahead rings (0x260 countdown; pre-roll otherwise)
g      = FlipMode ? (1 − smooth) + 0x160 : smooth
if (!SideListen) out = delayed · g ; meters 0x50–0x68
else            out = sidechain ; 0x64 = 0, 0x68 = 1
```

- **Threshold/Return → the two thresholds** [D]:
  `open = 0x23c = Threshold`, `close = 0x240 = Threshold / Return_ratio`
  — Return (0–24 dB) lowers the close point below the open point
  (hysteresis width = Return dB).
- **Legacy hysteresis** (Live8LegacyMode): `close = open·0.70794576`
  (−3 dB fixed), or flipped `open = Thr·1.0964782` (+0.8 dB) /
  `close = Thr·0.77624714` (−2.2 dB) [B constants decoded].
- **Two detectors**: the user Attack feeds only the gain smoother in
  modern mode; the detector envelopes run the fixed 3 ms attack (env-2)
  and the fixed 150 ms release (env-1, modern) / user times (legacy) —
  max of the two sustains the gate through short dips [D mechanics;
  perceptual framing [H]].
- **FlipMode** rewires the hysteresis pointers (0x178/0x180 swap) and the
  gain mapping `g = 1 − smooth + floor` [D; the audible result — the UI's
  gate↔expander flip — via golden render [H]].
- **Sidechain EQ** [D]: one parametric band (stereo pair of the §EQ
  biquad), UI modes 0..5 → internal filter types {2, 6, 3, 0, 0, 1} with
  Q 0.98 (0x3f7ae148, the Compressor EQ's default Q) except mode 1 → Q
  2.0 (0x40000000); mode 3 falls through to mode 4's case (identical
  config in this build) [D-capture; UI names open]. Coefficient build via
  `FUN_1019b1c0c` (base form) + `func_0x0001019b1e50` (second form into
  0x1d8–0x200); the runtime biquad consumes 0x1b8–0x1d4 in a
  transposed-section shape (exact form in the capture) [D-shape].

**CalcMainLive8** differs only in the parameter wiring above (which slots
get user vs fixed times, per the setter table); the DSP body is otherwise
identical shape [D].

## 4. What remains open (honest residuals)

- **Ring topology naming** (which of the four rings is delayed-main vs
  dry vs gated per channel; the 0x260 pre-roll vs post-roll reading) —
  the mechanics are captured, the labels are inferred [H-minor].
- **EQ mode enum → UI names** (types {2,6,3,0,0,1} + the 3≡4 fall-through)
  and the biquad builder bodies (`FUN_1019b1c0c`/`func_0x0001019b1e50`,
  shared with the Compressor EQ family — one derivation can cover both)
  [open].
- **Hold reload condition aliasing**: 0x178/0x180 point into 0x170/0x171
  — the wiring is decompiled fact; only the OnFlipMode+legacy combination
  table is fully enumerated [D most rows; the On/OnX interplay minor-H].
- **Flip-mode gain mapping** perceptual check (`1 − smooth + floor` can
  exceed 1 when floor > 0 and gate closes — by design?) [H — render].
- **0x104cc9800 const block** {8, 7, 11.11, 0.5} (ctor source region)
  consumers [open].
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane). The
  golden-render corpus for Gate does not exist yet (COVERAGE row empty).

## 5. Confidence

- Class inventory, ctor defaults (const pool), NewRate/Reset/Init/Exit,
  all setter slots and coefficient laws (including the 6× fast-twin
  pattern and the modern/legacy time-source split), the hysteresis +
  hold-counter + look-ahead mechanics, the threshold/return law with its
  exact dB constants, preset ranges: **high** as decompile/byte readings —
  single-source decompiles cross-checked against nm symbols, the const
  pool, the shared-EQ identification with the Compressor ctor, and the
  preset XML (Threshold linear 0.01–1.41, Attack 0.02–150 ms, Hold
  1–1500 ms, Release 0.1–750 ms, Return 0–24 dB, Gain −75–0 dB — all
  consistent with the laws above).
- Detector naming (which env is "channel R" vs "slow path"), ring labels,
  FlipMode audibility, EQ UI names: **low/medium** — graded inline; do
  not build on them alone.
- No behavioral claim of any grade is made; the golden-render corpus for
  Gate does not exist yet (COVERAGE row empty).
