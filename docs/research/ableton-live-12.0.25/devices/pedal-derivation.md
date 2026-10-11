# Pedal (OPedalProcessor) binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
BlockProbe batches, no re-import). NOT FOR REDISTRIBUTION. Never enters
product source (`packages/live-dynamics`). Companion capture:
`evidence/binary/pedal-decompiles.txt` (create chain, all 16 setter
trampolines, Reset/NewRate, the CalcMain thunk + engine body, the three
pedal-circuit bodies, the 2x/4x oversampled runners). Form follows
`compressor-derivation.md`; claims graded: **[D] decompiled-confirmed**
(capture cited), **[B] byte-decoded** (const pool / XML / nm),
**[H] unverified hypothesis** — no behavioral renders ran in this lane; per
README every [D]/[B] claim still awaits the golden-render cross-check before
it gates a rebuild.

The stock Pedal is `OPedalProcessor` — a thin Live processor shell (param
block at shell+0xa40, devicekit create) around an **inline all-double
per-sample circuit engine** at `this+0x50` (`FUN_1018cf728`). There are **no
runtime lookup tables anywhere in the device**: every nonlinearity is an
**iterative nodal solve** (Newton–Raphson on Shockley diode equations with an
inlined fast-exp2 polynomial), and every filter is a TPT (zero-delay,
topology-preserving) one-pole/cap update of the form `s += 2·(g/(g+2))·(x−s)`.
The three Types are three distinct analog circuits, not three curves.

## 1. What runs when (call topology)

- **Create** `OProcessorCreateManager::SOnProcessorCreate<OPedalProcessor>`
  0x1018c2d98 → wrapper `FUN_1018c2dd4` [D]: allocates the 0x28 shell, the
  processor object, engine ctor `func_0x1018c7434`, zeroes On (0xa30),
  crossfade-guard (0xa31), scheduler (0xa38), inputs/outputs (0x30–0x40).
  16 `SProcessorFunc` registrations (Reset, NewRate, On*, CalcMain — symbol
  table in the capture).
- **CalcMain** thunk 0x1018cf6dc [D]: loads `**(0x30)`, `**(0x38)` (L/R
  input ptrs) as doubles, calls the engine `FUN_1018cf728(this+0x50, inPair)`,
  stores the returned pair at 0x40. One frame per call, stereo interleaved in
  one NEON pair throughout.
- **Engine dispatch** (FUN_1018cf728) [D]:
  1. input TPT high-pass pair (g at 0x6b0/0x6b8, states 0x6e0/0x6e8);
  2. `os = *(long*)(eng+0x858)` (shell 0x8a8, written by NewRate from
     Oversampling): **0 → native path** with the Type switch;
     **1 → `FUN_1018cfc18` (2x)**, **2 → `FUN_1018d0128` (4x)** — both push
     the input into a stereo history ring (base 0x8f8, counters 0x910/0x918)
     and re-run the same Type circuit at the multiplied rate;
  3. native path: `Type = *(int*)(eng+0x680)` (shell 0x6d0):
     **Type 0 → `FUN_1018d0654`** (result ×0.5),
     **Type 1 → `FUN_1018d0ba0`** at eng+0x120 (×0.1),
     **Type 2 → `FUN_1018c8088`** at eng+0x330 (×0.0625) — Type 2's circuit
     additionally feeds two cascaded TPT one-pole LPs (0x780–0x7a8, 0x7c0–0x7f8)
     inside the engine before the tone stack;
  4. output TPT high-pass pair (same g, states 0x6f0/0x6f8);
  5. the passive tone-stack network solve (below) and output mix:
     `out = (1−w)·in + w·(gain·stackOut + subGate·HPbranch(stackOut))`
     with w = 0x6a0/0x6a8 (DryWet), gain = 0x690 (Output, as
     2^(v·0.1661)), subGate = 0x800/0x808 (Sub bool: 0.0/1.0).
- **OnType** 0x1018c6cb8 [D]: stores the int, zeroes the active circuit's
  state block, and **re-primes Type 2's network**: temporarily overwrites the
  node states with a steady-state estimate
  `s = (s+partner)/(R+1)`, runs one dummy solve of `FUN_1018c8088(this+0x380)`
  and adds the result into 0x440/0x448 (click suppression), restores the
  states, clears the oversampler history (`FUN_1018cf5d8` + bzero of the
  0xa18 ring).
- **OnOn** 0x1018c6ca8 [D]: bool at 0xa30, guard 0xa31; on the off→on edge
  runs the same clear+prime block, then installs CalcMain into the scheduler
  slot (0xa38). Off → installs NULL and zeroes 0x40.
- **NewRate** 0x1018c6c9c / **Reset** 0x1018c6ab8 [D]: share the tone-network
  coefficient rebuild — real component values in double precision:
  **4700 Ω, 51 pF (5.1e-11), 330 nF (3.3e-7), (π/2)² = 2.4674011002723395,
  4526.935264825714, 2π**; the internal rate is `(1<<os)·fs` (so Oversampling
  multiplies every filter's rate). NewRate second int = sample rate Hz (same
  convention as Compressor §8).

## 2. The state-slot ledger (engine offsets; shell = engine − 0x50)

Writers: SET = setter trampoline (shell offset in parens), INIT = NewRate/
Reset, CALC = engine.

| eng slot | role | writer |
|---|---|---|
| 0x30/0x38… | per-circuit coefficient blocks (g, R, I_s, bias voltages) | SET Gain, INIT |
| 0x120/0x330 | Type-1 / Type-2 circuit objects | (fixed) |
| 0x380 | the dummy object used by OnType's prime solve | OnType |
| 0x4b0/0x4c0/0x4d0 | Bass/Mid/Treble pot positions w | SET Bass 0x500, Mid 0x510, Treble 0x520 |
| 0x4e0…0x508 | tone-network resistor terms R/(k·(w−w²)) | SET (same three) |
| 0x510–0x648 | TPT cap states + network node states (6 sections) | CALC; zeroed by OnType |
| 0x5e0–0x648 | mid-band network coefficients (5600 Ω, 2.7e-8 F, MidFreq cap 3.3/0.72/0.22 nF) | SET MidFreq 0x6a4 |
| 0x690 | Output gain = 2^(v·0.1661) (fast-exp2 in OnOutput) | SET Output 0x6e0 |
| 0x6a0/0x6a8 | DryWet w | SET DryWet 0x6f0 |
| 0x6b0/0x6b8 | input+output HP g (4700 Ω/51 pF law) | INIT |
| 0x6e0/0x6e8, 0x6f0/0x6f8 | in/out HP TPT states | CALC |
| 0x6d0 (shell) | Type int | SET Type |
| 0x6a4 (shell) | MidFreq int (0/1/2) | SET MidFreq |
| 0x780–0x7f8 | Type-2 post LP TPT pairs | CALC |
| 0x800/0x808 | Sub gate (0.0/1.0) | SET Sub 0x850 (bool) |
| 0x810–0x848 | wet-leg HP branch TPT pair | CALC |
| 0x858 (shell 0x8a8) | oversample factor (0/1/2) | NewRate |
| 0x8f8/0x910/0x918 | oversampler history ring + counters | CALC os paths |
| 0xa30/0xa31/0xa38 | On bool / crossfade guard / calc slot | SET On/OnX |

**Pot law** (OnBass/OnMid/OnTreble, identical) [D]:
`w = clamp(t + 0.4·t + 1.2·clamp(t, −0.25, 0.25) + 0.5 − 0.5, 0.001, 0.999)`
(t = param 0..1; the ±0.5 terms cancel — decompiler noise), then
`R_node = g_R / (R · (w − w²))` — the classic potentiometer `w·(1−w)` split.

**MidFreq law** [D]: enum {0,1,2} → C = 3.3 / 0.72 / 0.22 (nF, against the
fixed 27 nF = 2.7e-8 F and 5600 Ω of the mid network); ω = 1/√(C·27nF)
normalized by sr_kHz (float at shell 0x6a0), tan-approximated by the rational
Padé `x·(0.999999492 − 0.096524608·x²)/(1 − (0.429867257 − 0.009981878·x²)·x²)`,
then the TPT network coefficients at 0x5e0–0x648.

**Gain (Drive) law** [D]: raw v stored to the circuit coefficient slots
(0x50/0x58, 0x170/0x178); effective loop gain
`p = 1 − (max((1−v) − 0.5, 0)·1.6 + (1−v)·0.2)`, clamped ≤ 0.99, stored
0x380/0x388.

## 3. The mechanism, plainly (the three Types)

All three solve a diode network each sample with the same machinery [D]:

- **fast exp2**: domain-reduced polynomial
  `(1+((x·0.013487903+0.0521745)x+0.24128748)x+0.6930501)x` · 2^(int) via the
  `(long<<52)` bit construction, |x| ≤ 1023.5, times log2(e) = 1.4426950409 —
  i.e. e^v for the diode law; the `d − 2/d` + sign-copy idiom is **2·sinh(v/Vt)**
  (antiparallel diode pair).
- **Newton–Raphson** on the node voltage with KCL residual
  `(I_s + g_in·v + g·(−2V_drv − v)) − (I_bias + g_fb·(V_node − v))` over
  `(g_fb + g_in + g·(e^v + e^−v)/Vt)`; convergence tol `|Δ| ≤ |v|·0.001 + 1e−6`;
  **Type 0/1 use ≤23 iterations, Type 1's output stage ≤11**; state clamped to
  a ±circuit-rail window each iteration (fmax/fmin pairs).
- **TPT capacitor updates** after each solve: `s' = a·Δv − b·(s + g·Δv)` per
  cap slot.

- **Type 0** (`FUN_1018d0654`): three cascaded symmetric two-diode stages,
  each with its own cap state pair (0x10/0x11, 0x12/0x13, 0x0e/0x0f) and
  output network (0x16–0x23); softest, most linear of the three (×0.5 out).
- **Type 1** (`FUN_1018d0ba0`): input cap → **asymmetric hard clamp**
  (−2·V_rail … +0.5·V_rail) → two closed-form resistive-network stages →
  final 11-iteration diode stage; ×0.1 out.
- **Type 2** (`FUN_1018c8088`): two solver passes over a **four-exp network**
  (four sinh evaluations per iteration = four diode-connected elements), then
  two TPT one-pole LPs in the engine; ×0.0625 out.

UI naming: XML elements are `Type, Gain, Output, Bass, Mid, Treble, MidFreq,
Sub, DryWet, Oversampling` [B]; the strings "Fuzz" and "Distort" sit in the
APedal string pool [B]; the "Guitar Gnarly Fuzz" factory preset stores
`Type=2` [B] — **Type 2 = Fuzz**. The 0/1 order (Boost vs Overdrive vs the
circuit structures above) is **[H]** — resolve with one render per Type.

**No runtime tables**: unlike Compressor/Saturator, nothing here indexes a
__DATA LUT; the only table-ish artifact is the inlined exp2 polynomial [B].
Nothing to name as corpus material on the Live side; the behavioral corpus
itself (3 Types × drive sweep) is the missing piece.

## 4. What remains open (honest residuals)

- **Type-name ↔ circuit mapping for 0/1** ([H] above).
- Component-level identification of every R/C in the three circuits (the
  coefficient slots are captured in use, but the schematic netlist — which cap
  is the coupling cap of which stage — is not reconstructed).
- The exact sub-slot semantics of OnGain's four raw stores (0x50/0x58 feed the
  drive-V source of the solves; 0x170/0x178 feed Type-1's battery — reading is
  structural, per-slot naming [H]).
- Oversampler interpolation filter: the 2x/4x runners' history ring +
  interpolation coefficients were not decoded (only the structure is [D]).
- Reset's full 892-line body (rebuild tail shared with NewRate) — captured,
  not line-by-line read in this lane.
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Class/setter inventory, engine dispatch, TPT one-pole form, Newton/sinh
  solver identification, pot/MidFreq/Output/Gain laws, Type-2=Fuzz: **high**
  (single-source BlockProbe decompiles, cross-checked against the XML
  parameter list and the factory-preset Type value).
- Circuit netlist identities ("this is a Tubescreamer-style stage") and the
  Boost/Overdrive order: **low** — graded [H], do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Pedal does not exist yet (COVERAGE row empty).
