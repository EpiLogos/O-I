# Looper ("LooperDevice") binary derivation — per-sample layer (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SymProbe/CallTargetsProbe/BlockProbe scripts, no re-import).
NOT FOR REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/looper-decompiles.txt` (symbol table,
trampoline targets, ctor, Init/NewRate/NewTempo, all four Calc bodies,
OnState and the transport/quantization setters, helper laws, raw decompiles).
Form follows `compressor-derivation.md`; claims graded: **[D]
decompiled-confirmed** (capture cited), **[B] byte-decoded** (const pool /
memory dumps), **[H] unverified hypothesis** — no behavioral renders ran in
this lane; per README every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

The stock Looper DSP is `OLooperProcessor` (UI/device class `ALooper`,
namespace `NLooper` with `TLooperState`; a `TLooperEmergencyFade` fade object).
One processor, one engine: a power-of-two stereo loop ring, a 32.32
fixed-point read position, a tabulated 4-tap resampler for speed/pitch, and a
per-state Calc dispatch (`CalcImport`, `CalcStandby`, `CalcRecording`,
`CalcPlayOrOverdub`). Undo is a second full-size copy ring inside the
processor object.

## 1. What runs when (call topology)

DSP state lives inline in the processor (`this+…`); the `SProcessorFunc`
trampolines ARE the setter bodies (simple ones inline, complex ones tail-call
`FUN_…`).

- **Create** `OProcessorCreateManager::SOnProcessorCreate<OLooperProcessor>`
  0x1018c0224 → wrapper 0x1018c0260 (device-kit shell, param block at
  shell+0x3fb0) → ctor thunk 0x1018008a4 [D]: vtables; sr float at 0x80 (from
  the shell), tempo float at 0x84, **pitch in semitones at 0x8c (default
  12.0f [B])**; three ramp objects 0xb8/0xd0/0xe8 (`FUN_1015b6380` — the
  input-gain / overdub-mix / buffer-gain faders); **loop ring object at 0x198
  and undo ring at 0x2048, both inited with the sample rate**
  (`func_0x0001016d3920(this+…, 0x13c)`, 0x13c read from the sr source);
  `0x140 = sr/200` (5 ms in samples); sub-objects: transport 0x3f10,
  quantized-launch timer 0x3f18, reverse/double/halve event carriers 0x3f40 /
  0x3f30 / 0x3f38 (float slots pre-filled FLT_MAX), `TRampEvent<TLooperState>`
  carriers 0x3f58 (SetMonitorLevel) / 0x3f60 (SetOverdubLevel) / 0x3f68
  (SetBufferLevel), emergency-fade 0x3f70, OnRecordBufferEnd 0x3f78,
  scheduler at 0x3f80.
- **Init** `FUN_101801090` [D]: stores the scheduler at 0x3f80, copies a rate
  into 0x84's source struct, calls the shared state updater
  `func_0x000101801144`, primes the emergency fade (400000000 at +0x20 of the
  0x3f70 object — an effectively-never fade), sets 0x3fa0 = 1.
- **NewRate(int,int)** 0x10180b3e8 (inline) [D]: `0x80 = sr (float)`,
  `0x1f8 = sr (int)`, `0x140 = sr/200` (the 5 ms state-change ramp length).
- **NewTempo(f,f,f,f)** 0x10180b414 (inline) [D]: tempo → 0x84; then the
  shared **speed law** (§3) guarded by `0x1b4 != 0` (loop exists).
- **Reset** 0x10180b3e4, **Exit** → FUN_10180132c, **OnOn/OnX** tail
  0x1018018bc, **OnMonitor** 0x10180b4fc + helper 0x101802efc, **OnPitch**
  0x10180b508 (inline; `0x8c = semitones; 0x88 = exp2f(0x8c/12)`, then the
  speed law, then re-schedules the loop-end timer), **OnFeedback** tail-calls
  FUN_1015b63f8 — the generic ramp setter `FUN_1015b63f8(obj,
  {float target, int time-in-samples})` [D] — all parameter ramps in this
  device are target+time pairs, never raw writes.
- **Transport/quantization setters** (all inline, one int each) [D]:
  `OnLaunchQuantizationEnum → 0x144`, `OnLocalQuantization → 0x148`,
  `OnSongControl → 0x98`, `OnTempoControl → 0x9c` (0 = free; 1/2 = synced —
  re-runs the speed law), `OnOverdubAfterRecord`, `OnFixedLengthRecord`,
  `OnIsSidechainConnected`.
- **State entry points** → all funnel into `OnState` FUN_10180362c [D]:
  `OnStop`/`OnRecord` share 0x1017fc9f4; `OnPlay` 0x10180b5d0 and `OnOverdub`
  0x10180b60c pick the target state from the empty/playing state, then go
  through the shared transition machinery (`func_0x0001018022e4(this,
  newState, …)`). `OnReverse` FUN_101801a68, `OnDoubleSpeed` FUN_101801d4c,
  `OnHalveSpeed` FUN_101802038, `OnUndo` FUN_101803390, `OnClear`
  FUN_101802cb4, `OnDoubleLength` FUN_10180412c, `OnHalveLength`
  FUN_1018042e0, `OnMappablePedal` FUN_101800ed4.
- **Per-state calcs** (registered in the SProcessorFunc table, swapped by
  state) [D]: `CalcImport` FUN_10180518c, `CalcStandby` FUN_1018052e8,
  `CalcRecording` FUN_1018059b0, `CalcPlayOrOverdub` FUN_101805d1c.

## 2. The state-slot ledger (every reader → its writer)

| slot | role | writer | value / law |
|---|---|---|---|
| 0x40/0x48, 0x188/0x190 | input ptrs L/R; stream block ptrs (import in / standby+record monitor out) | shell | per-sample `**` |
| 0x50/0x54/0x58/0x5c | output pair (+meter mirrors) | CALC | monitor mix (§3) |
| 0x70/0x74 | playback wet pair (interp output) | CALC play | |
| 0x80/0x84/0x88/0x8c | sr float / tempo float / **speed = 2^(pitch/12)** / pitch (semitones) | shell, NewTempo, OnPitch/Double/Halve | |
| 0x90 | flag: fade shaping on (cubic soft-knee of 0x60/0x68) | SET (OnX family) | |
| 0x94 / 0x98 | song-control-related mode (10-checked) / SongControl mode (1/2 = may start song) | SET | |
| 0x9c | TempoControl mode (0 free, else tempo-synced) | OnTempoControl | |
| 0xa0/0xa8 | feedback gain (double) + ramp rate | ramp setter | ticked per sample in calcs |
| 0xb8/0xc0 | input-gain fade (double) + rate | OnOn/OnX ramps | |
| 0xd0/0xd8 | overdub mix (double) + rate; target set with 5 ms ramp on state change | OnState | |
| 0xe8/0xf0 | buffer-gain fade (double) + rate (play→stop ramp) | OnState | |
| 0x100/0x104 | **read position, 32.32 fixed** (0x104 = integer sample) | CALC, OnState | |
| 0x108 | **read step, 32.32** = ±(speed·2^32); 0x110 unclear twin | NewTempo/OnState/reverse | negated when reversed |
| 0x120/0x124 | monitor level L/R (dry leg of monitor mix) | OnMonitor | |
| 0x128 | **engine state** 0 standby · 1 record · 2 play · 3 overdub (4 = armed/queued marker in 0x12c) | OnState | selects the Calc |
| 0x12c | last requested state (4 = launch queued at quantization point) | OnState | |
| 0x134 | recorded length (samples) = min(write pos 0x138, 0x13c) | OnState (record exit) | |
| 0x138 | record write position (int) | CALC record | |
| 0x13c | record-length cap (sr-scaled int) | shell/Init | |
| 0x140 | **5 ms in samples (sr/200)** | NewRate | ramp length; also event delay |
| 0x144 / 0x148 | LocalQuantization / LaunchQuantizationEnum (0 = "local" → use 0x144) | SET | grid pick |
| 0x14d | undo-dirty flag (cleared on snapshot) | OnState/OnDoubleLength | |
| 0x15c | import write pos / standby+record monitor read pos (int) | CALC | |
| 0x159 | byte: buffer has content (gates standby/record monitor playback) | SET (import path) | |
| 0x1a0/0x1a8, 0x1b0 | loop ring data L/R + capacity (power of two) | shell/ctor | mask = cap−1 at use |
| 0x1b4 | **loop length in samples** (int); min 16, clamp cap | length commit 0x101803798 | |
| 0x1b8 | loop length in **beats** (double) | length commit | UI + undo metadata |
| 0x1c0 | **sync reference tempo** (double, ≥ 20 BPM) | length commit | sync speed law denominator |
| 0x1c8 | samples per beat = sr·60/tempo | length commit | |
| 0x1d0 | reverse bool | OnReverse (imm) | negates steps + write advance |
| 0x1f0 | loop length mirror (int) | NewRate area | used as mask seed |
| 0x1f8 | sr (int) | NewRate | 5 ms crossfade law input |
| 0x200/0x204 | second read pos pair (play: pos; 0x204 = integer part) | CALC/OnState | reverse start = len−1 |
| 0x2048-ring | **undo buffer** (data 0x2050/0x2058, cap 0x2060, saved len 0x2064, meta 0x2068/0x2078) | OnState(case 1/3), OnDoubleLength | full loop memcpy |
| 0x210 | overdub/play write position (int) | CALC play | advance ±1 by reverse |
| 0x214 | overdub-write gate (−9999 = always; else countdown) | OnState(case 3), OnReverse | |
| 0x218 | output-history cursor (0..1023) | CALC play | forward +1, reverse −1 mod 2^10 |
| 0x220/0x224/0x230 | heard-position accumulator / history index / base | CALC play(case 3) | feedback re-read walk |
| 0x234 | history distance (samples of delay) | CALC play | > 512 gates the write loop |
| 0x238 | **speed-step history table** (1024 × i64) | CALC play | per-sample 0x108 copies |

**State-change ramp law (OnState)** [D]: every transition that leaves
overdub (3 → ≠1) ramps the overdub mix 0xd0 to 0 over 5 ms; play→stop (0 ← 2)
ramps the buffer gain 0xe8 to 0 over 5 ms; enter-overdub ramps 0xd0 0→1 over
5 ms; each queues a `TRampEvent<NLooper::TLooperState>` carrier (0x3f60 /
0x3f68) with delay 0x140. Reverse/double/halve, when a quantization context
exists, instead schedule their event carriers on the transport grid
(`func_0x00010154a1bc(transport, grid)` = time to next boundary, −1.0 =
none; grid = 0x148−1, or 0x144 when 0x148 == 0).

## 3. The mechanism, plainly

**Speed law (NewTempo / OnState case 2/3 / OnPitch / OnReverse — one shared
sequence)** [D]:

```
pitchspeed = 2^(0x8c/12)                                  // stored at 0x88
d = pitchspeed                              if 0x9c == 0  // free
d = (tempo / refTempo(0x1c0)) · pitchspeed  if 0x9c != 0  // tempo-synced
step 0x108 = (long)(d · 2^32); inv 0x228 = (long)(2^32 / d)
if reversed (0x1d0): both negated
```

The sync reference tempo is *derived from the loop*: on record exit
(`func_0x101803798`) the recorded length in beats
(`tempo·len/(sr·60)`) is snapped to the launch grid (fixed-point quantizer
with 1/3843840-beat resolution [B], snap via `func_0x000100d09aa8`), and
`0x1c0 = quantizedBeats·sr·60/recordedLen`, floored at **20 BPM** [D]. A
synced Looper therefore plays back at however fast the current tempo makes
the recorded length land on the musical grid.

**Playback (CalcPlayOrOverdub)** [D]. The read position 0x200 advances by the
step; the buffer is read through a **4-tap window interpolator whose
coefficients come from __DATA tables** (page select `(pos>>24)&0xff` × 0x40
stride, 15-bit phase `(pos>>9)&0x7fff`, coefficient = `tab_lo + tab_hi·phase`
— linear interpolation inside the coefficient tables, bases 0x1059ad4c0 /
0x1059b1500) [B addresses]. Output composition per sample:

```
fade = 0x90 ? cubic(clamp(0x60/0x68, ±1.5)) : …        // x - (4/27)x^3 [B const]
out  = 0xe8·fade·xfade(0x108) + 0xb8·in + monitor(0x120/0x124)·(1−xfade)
```

then the overdub write: in state 3 the buffer sample is
`buf·(1−0xd0) + (in + fb(0xa0)·buf)·0xd0`; otherwise `in + fb·buf` — written
at 0x210 (advance ±1 by reverse; wrap: ≥ len → 0, < 0 → len−1). The write
loop only runs while the **heard-position walk** says the read has moved ≥ 10
samples ahead and ≥ 512 fixed-point units of history accumulated: the engine
keeps a 1024-entry per-sample history of the speed step (0x238) and walks it
backward (0x220/0x224) to reconstruct *where in the buffer the listener heard
this moment* — overdub material lands exactly under what was monitored, even
under speed changes/reverse [D dataflow; interpretation plain].

**Record (CalcRecording + OnState)** [D]. Monitor plays the old buffer at +1
speed while the new input writes at 0x138 (both masked by cap−1; first 4
slots duplicated past the ring end for the interpolator guards). Entering
record snapshots the loop into the undo ring (whole-buffer memcpy, min length
16) and copies the last **5 ms** of the output-history ring into a scratch
(0x248/0x1148). On record exit the recorded length is quantized (§ above),
`0x1b4` = clamp(len, 16, cap), and the **loop tail is crossfaded toward the
pre-record snapshot**: for i in 0..5 ms,
`buf[len−5ms+i] = (1−t_i)·buf[len−5ms+i] + t_i·snapshot[i]`, t linear — the
seam that makes quantized record wrap click-free [D code; acoustic reading
mine].

**Standby/Import (CalcStandby, CalcImport)** [D]. Import streams the incoming
block into the ring at 0x15c (64-frame unrolled); Standby plays the buffer
content out at +1 while mixing the monitor pair — the post-import monitor
path. Both tick the same ramp integrators (0xa0/0xb8/0x108).

**Quantized launch.** Without a quantization context, OnState applies the new
state immediately (`0x12c = state`). With one, `0x12c = 4` (armed), the ramps
above run, and the engine state still flips at once — the audible gate is the
5 ms ramp plus the transport-side arm (`func_0x000101803d18`: sets 0x7c, then
starts the song at the next grid point / snaps the value on the 3843840
grid) [D dataflow; the exact fire-at-the-boundary hop is shell-side, open].

**Reverse/speed buttons.** Each has the same two legs [D]: quantized —
schedule the event carrier at the next grid point; immediate — the helper
(0x101801c40 / 0x101801e68 / halve's twin): set 0x1d0 / pitch ∓ 12 semitones
(`0x8c += 12; 0x88 = 2^(0x8c/12)`), re-align the overdub walk (write pos =
read int pos, history cursor reset, gate −9999), re-run the speed law.
OnDoubleLength [D]: undo snapshot, `memcpy(buf, buf+len, len·4)` per channel
(content duplicated into the second half), len·2 clamped (min 16), beats
doubled. OnClear/OnUndo [D]: buffer/undo ring swaps via the same ring-guard
refresh (`func_0x0001017fdde0`).

## 4. What remains open (honest residuals)

- **The interpolator's coefficient tables** (0x1059ad4c0…, 0x1059b1500…)
  live in `__DATA` beyond static decode certainty of their family — 4 taps
  at −7/−3/+1/+5 with a two-level phase split is captured [D], the window
  family (sinc? Lagrange staged?) is not [H].
- **The armed-launch handshake**: who consumes `0x12c == 4` at the bar line,
  and the shell-side wiring of `func_0x0001018022e4`'s 5 arguments.
- **Ramp semantics of `FUN_1015b63f8`** — target+time is decoded [D], the
  curve (linear? exponential) inside is not.
- **0x110** (second read-step twin), **0x88/0x90 usage in OnOn** (fade
  target vs rate), the `OnFeedback` → `FUN_1015b63f8` argument threading
  (processor-level ramp vs slot-level), OnMappablePedal (0x101800ed4),
  OnOverdubAfterRecord/OnFixedLengthRecord consumers, and the CalcStandby
  0x214 meter-gate branch.
- **Undo metadata** 0x2068/0x2078 (8-byte copies of 0x1b8/0x1c8) consumers
  beyond the snapshot.
- Everything in §3 awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Class/callback inventory, the speed law, the state machine and its ramps,
  record/undo mechanics, the play/overdub output + write laws, the
  length/tempo commit: **high** as decompile readings — single-source
  (BlockProbe over the analyzed LiveRE2 project), cross-checked only against
  the symbol table and byte decodes; no second reading pass.
- The heard-position feedback walk and the record-seam interpretation:
  **medium** — dataflow [D], intent inferred.
- The interpolator family, armed-launch hop, ramp curve: **low** — [H], do
  not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Looper does not exist yet (COVERAGE row empty).
