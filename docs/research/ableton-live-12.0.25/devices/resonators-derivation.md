# Resonators (OResonatorProcessor) binary derivation — slot bank + tuning laws (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only; the devicekit region was
already analyzed — all bodies decompiled in place, no re-import). Official
evidence: factory presets `Core Library/Devices/Audio Effects/Resonators/*.adv`
(Berlin/Brooklyn/..., gzip XML, read only). Capture:
`evidence/binary/resonators-decompiles.txt`. Form follows
`compressor-derivation.md`; claims graded: **[D]** decompiled-confirmed,
**[B]** byte/const decoded, **[H]** unverified hypothesis. NO Live, NO renders
ran in this lane; per README every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

Resonators is a **devicekit FX processor**, `OResonatorProcessor` (create
0x1018c3664), model side = the A-framework compound `AResonator` + 
`AResonatorUnit` (factories 0x102555adc/0x102558c38). Structure: a stereo
input biquad (the In Filter), then **5 resonator slots** (processor objects at
+0xb0/0x130/0x1b0/0x230/0x2b0, 0x80 bytes each) ticked as an alternating
L/R ping-pong chain, then a width/dry-wet output matrix. Each slot is a
**delay-line + allpass + lowpass resonator** tuned from a semitone→Hz
runtime LUT with allpass phase compensation. The per-sample entry is a
**20-callback calc family** `CalcIn{0,1}Res{0,1}Mono{0..4}` selected by
(in-filter-on, mode, active-extra-slot-count).

## 1. What runs when (call topology)

DSP state lives inline in the processor; the trampoline table is 0x1019ac184..
0x1019acb98 (56 `SProcessorFunc` registrations [D, nm census in capture]).

- **NewRate(int,int)** 0x1019ac4c0 [D, inline thunk]: second int = sr Hz (the
  compressor/Glue convention). `+0x454 = sr·0.001` (kHz); **delay capacity
  `+0x3d0 = int(sr_ms·300 + 1)` — a 300 ms delay buffer**; `+0x358 = +0x394
  = 1/sr`; the five slot objects re-inited with sr
  (`func_0x00010199c3ac` × 5); ring size = capacity; tail-call resizes the
  delay line.
- **Init** → `FUN_10199d058` [D]: the shared recompute — input-filter biquad
  build (Q = 0.1 fixed), per-slot allpass bank + delay tuning + decay
  coefficient (§3). The same body is inlined into OnResMode/OnResDecay/
  OnResConst/OnResColor [D — identical code in the setter bodies].
- **Reset** → `FUN_10199d2b8` [D]: zeroes biquad/delay/allpass states per
  slot; `+0xb4 = 0` (decay state), `+0xbc = 1.0` (gain hold), per-slot state
  resets (`FUN_1016d3ab0`).
- **CalcMainWithReset** 0x1019acb98 [D]: block-tick entry — builds the
  active-slot tick list at `+0x30..0x90` from the On flags (`+0x404/0x414/
  0x424/0x434/0x444`, stored 1.0/0.0): slot1 → bufs +0x3a8/+0x3b0, slot2 →
  +0x130/+0x3ac/+0x3b4, slot3 → +0x1b0, slot4 → +0x230, slot5 → +0x2b0 —
  **alternating L/R buffer pairing** (band 1 left of the ping-pong, band 2
  right, ...). The final dispatch reads `(InFilterOn == 1.0)` as one select
  axis.
- **Per-sample callbacks** `CalcIn{b}Res{c}Mono{n}` [D]: b = in-filter on,
  c = ResMode, n = 0..4 (active extra slots; Mono4 ticks exactly the 4 list
  entries via `func_0x00010199e6bc`). Band 1 (the Note band) is always
  active — it is the base leg, not counted in n [H — from Mono0's body doing
  the dry path only and CalcMainWithReset's list layout].

## 2. The state-slot ledger (every reader → its writer)

Writers: SET = parameter setter (trampoline body), INIT = shared recompute,
NR = NewRate, RESET, CALC = per-sample tick.

| slot | role | writer | value / law |
|---|---|---|---|
| +0x8 / +0x10/+0x18 | ring size / delay-line object | NR | capacity = int(sr_ms·300+1) |
| +0xb0…+0x330 | 5 slot objects (0x80 each) | NR (sr), SET (params) | slot1 Note band, slots 2–5 Pitch bands |
| +0xb4 | slot1 decay state | RESET/INIT | one-pole coefficient (§3) |
| +0xb8 / +0xc4/+0xcc | slot1 delay (samples) / ramp counter+step | INIT | 100-step ramp on change |
| +0xd0..+0x2b0 | slot1..4 inner state (reset helper `FUN_1016d3ab0`) | RESET | |
| +0x100..+0x114 | slot1 allpass biquad (6 coeffs) | INIT | Q = 0.3, tracks the tuned f |
| +0x128 | tuning scalar (Hz→rad) | INIT | consumed ×2π×f |
| +0x330..+0x36c | **in-filter bank** (2 biquads, 16 floats) | SET InFilter* | rebuilt on On/Freq/Mode |
| +0x358 / +0x394 | 1/sr (two copies) | NR | |
| +0x36c..+0x382 | in-filter coeffs (stereo DF1) | SET InFilter* | §3 |
| +0x388..+0x390 / +0x398..+0x3a4 | in-filter states L / R | CALC | |
| +0x3a8/+0x3ac, +0x3b0/+0x3b4 | ping-pong band buffers L/R | CALC | per-slot alternation |
| +0x3b8 | dry gain | INIT | from DryWet |
| +0x3c0 / +0x3c4 | width matrix gains | INIT | 0.5 − Width·0.5 and complement |
| +0x3c8 / +0x3d4 | tick callback / block countdown | shell / CALC | |
| +0x3d0 | delay capacity (samples) | NR | sr_ms·300 |
| +0x3d8/+0x3d9 | mode bools (scheduling) | SET On/OnX | semantics open |
| +0x3dc / +0x3e0 / +0x3e4 | InFilterOn / InFilterFreq / InFilterMode | SET | mode = menu, switch 0..3 |
| +0x3e8 (+1000) | **ResMode** | SET | XML stores bool |
| +0x3ec / +0x3f0 / +0x3f4 | ResDecay / ResConst / ResColor | SET | recompute after each |
| +0x3f8 / +0x3fc / +0x400 | sustain-shape / phase-pan / gain params | INIT readers | exact roles [H] |
| +0x404/0x414/0x424/0x434/0x444 | slot On flags (1.0/0.0) | SET OnResOn1..5 | |
| +0x408 / +0x40c | band-1 MIDI note / cents (fine) | SET OnResNote/Tune1 | note + cents·0.01 |
| +0x410 | band gain (linear) | SET OnResGain* | 10^(dB/20); XML −70..+6 dB |
| +0x414..+0x444 | per-slot pitch/tune/gain echoes | SET Pitch2..5/Tune/Gain | −24..+24 st |
| +0x454 | sr in kHz | NR | |
| +0x458 | scheduler/model object | shell | |

## 3. The mechanism, plainly

**In Filter.** One biquad leg per channel (DF1, coeffs +0x36c.., states
+0x388..). The Mode menu (switch at +0x3e4, cases rebuilding the +0x330
bank) selects the filter form; corner ω = Freq·2π/sr; Freq range 50..8000 Hz
[XML]. One captured rebuild leg shows the RBJ highpass-form coefficient set
with **fixed Q = 0.1** and corner min(2π·30/sr, 3.1101768 rad) for the
Init-time default bank [D for the captured leg; the full case→form map is
open].

**Slot tuning (the core law)** [D, INIT body]:

```
note_eff = note + cents·0.01 + 24 + (111 − note)·(Color·0.75 + 24)·0.01
idx      = note_eff·5 + 1381.8816            // 5 LUT steps per semitone
f        = LUT[idx] + LUT'[idx]·frac         // runtime tables 0x1059a89a8/b0,
                                             // 2400 float entries; corpus
                                             // material (startup-built)
w        = min(f·2π·scalar(+0x128), 3.1101768)     // allpass corner
allpass  = RBJ biquad, Q = 0.3, coeffs +0x100..
phase    = atan2f((a·d − b·c)/den, (c·d + a·b)/den)  // allpass phase at f
delay    = sr_ms·1000 / (f − f·phase/(−2π))   // delay-line length in samples
```

The delay is set so the delay+allpass pair hits the target frequency with
matched phase — a phase-compensated comb resonator. Changes ramp over 100
samples (counter +0xc4, step +0xcc). **Color warps the pitch scale**
(note_eff blends note→111 as Color rises) [D formula; the musical reading
"stiffness/stretch" is [H]].

**Decay.** The slot decay coefficient (`+0xb4`) =
`(2·Decay−1)·(1 − 1/(shape²·5e-05·fₓ + 1))` with the shape leg switching on
**ResConst** (`+0x3f0 == 1.0` → shape from `+0x3f8`; else `sqrt(f)·12`)
[D shapes; which leg means "constant decay across pitch" is [H — the XML
bool + the sqrt(f)·12 branch make frequency-dependent-decay-compensation the
likely reading]. Decay XML range 0..100, default ≈ 77.

**Ping-pong slot chain.** Active slots tick in list order through
`func_0x00010199e6bc(slot, bufA, bufB)`, buffers alternating L/R per slot —
band n sits opposite band n−1 in the stereo field [D structure; the per-slot
pan law is inside the tick helper, open].

**Output matrix.** `outL = 0x3b4·0x3c4 + 0x3c0·0x3b0 + 0x3b8·inL` (and the
mirror): dry gain `+0x3b8` (DryWet), width cross-terms `+0x3c0/+0x3c4` = 
`0.5 − Width·0.5` and complement (Width 0..1, mono-fold at 0) [D structure;
init assignments captured]. GlobalGain ±15 dB applied at the shell/meter
path [H placement].

**Dispatch.** 20 calc callbacks = InFilterOn × ResMode × activeExtraSlots
(0..4). ResMode is stored as a bool in the XML; the `Res` axis of the calc
family carries it into the tick (its per-sample effect is inside the slot
tick helper — open, §4). The three UI mode names and the ResMode/Mono
naming do not appear as strings in this TU [D-negative].

## 4. What remains open (honest residuals)

- **The slot tick helper `func_0x00010199e6bc`** (the actual resonator
  filter/delay update) and the ResMode per-sample difference — not yet
  decompiled; the delay/allpass/decay laws above are its Init-time inputs.
- **InFilterMode case→form map** (the +0x330 bank rebuild switch, cases
  beyond the captured leg).
- **ResMode UI semantics** (mode menu names; XML bool), **ResConst** leg
  assignment, **+0x3f8/+0x3fc/+0x400** exact parameter identities.
- **The semitone→Hz LUT contents** (0x1059a89a8/b0, 2400 entries) —
  runtime-built `__DATA`, corpus material; a render pins them.
- **GlobalGain/On/OnX shell placement**, and the band-1-always-active
  reading (Mono0..4 semantics) — [H].
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Census, NewRate/Reset, active-slot list build, per-sample tick shape,
  setter slot map, tuning/decay coefficient laws, output matrix structure:
  **high** as decompile readings — single-source (LiveRE2 decompiles),
  cross-checked against nm and the Berlin.adv XML.
- Mode/const semantics, LUT contents, inner tick helper: **low** — graded
  [H]/open, do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Resonators does not exist yet (COVERAGE row empty).
