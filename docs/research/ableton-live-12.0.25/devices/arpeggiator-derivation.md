# Arpeggiator (OMidiArpeggiatorProcessor) binary derivation (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SymProbe/BlockProbe/DataProbe/PairDump/StringsInRange, no re-import).
NOT FOR REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/arpeggiator-decompiles.txt` (setter
symbol table, all setter bodies, Init/Reset/ctor, OnMidiEvent +
DeferredProcess engine bodies, synced-rate table decode, mode-name strings,
ctor const pool). Form follows `compressor-derivation.md`; claims graded:
**[D] decompiled-confirmed** (capture cited), **[B] byte-decoded**
(const pool / data section), **[H] unverified hypothesis** — no behavioral
renders ran in this lane; per README every [D]/[B] claim still awaits the
golden-render cross-check before it gates a rebuild.

The stock Arpeggiator is `OMidiArpeggiatorProcessor`, registered through the
shared MIDI-FX shell (`OMidiFxShellProcessor::OnMidi` switches on event kind
and forwards; shell path string
`OceanProcessor/Src/MidiFxShellProcessor.cpp` [D]). Unlike the classic
one-`OnMidiEvent` processors, the arp splits into a **shell state object**
(the setter trampolines' `param_2`, ≥ 0x46960 bytes, holding every parameter
slot plus the pattern store) and an **engine object** built by the device
ctor (`FUN_1016b9d88`), which owns the per-key note records and a deferred
repeat event (`OMidiArpeggiatorEvent::DeferredProcess`) scheduled on an
`OScheduler` [D]. Notes are therefore processed by time-shifted deferred
callbacks, not inline in `OnMidiEvent`.

## 1. What runs when (call topology)

- **Create** `OProcessorCreateManager::SOnProcessorCreate<OMidiArpeggiatorProcessor>`
  0x1018c03d0 → builder 0x1018c040c → **ctor** `FUN_1016b9d88` [D]: builds
  the engine object — two null `Callback` pairs (+0x18/+0x30 float-callback
  slots), defaults 0.25 (engine+0xa0), {20.0 f @0xa8, 50.0 f @0xac} (const
  pool 0x104cca170 [B]), {64.0 f @0xe0, 1000.0 f @0xe4} (pool 0x104cca178
  [B]), −1.0 ×2 (engine+0xf8/0x100), −4.0 (engine+0x120), then a 128-entry
  per-MIDI-key array (stride 0x30, counts zeroed, doubles −1.0) [D]; on the
  shell: 64 records × 0x60 stride (shell+0x2130…0x3930, {float −0.0, double
  DBL_MAX, id −1} ×4 quarters — read as per-step/quarter timing records,
  semantics [H]); a 0x43010-byte zeroed pattern store (shell+0x3938…0x46948)
  with a sub-object built inside it at shell+0x4140 by
  `func_0x0001016c2360` [D — layout open]; a 0xb8-byte scheduled event
  object (vtable 0x10528a9f8) whose +0x70 callback is
  `OMidiArpeggiatorEvent::DeferredProcess`, and a 0x40-byte scheduler
  adapter (vtable 0x10528aa40) stored at shell+0x118 [D].
- **Init(OScheduler\*)** — trampoline thunk 0x1016c0bfc [D]: detaches any
  standing scheduler registration (`*(engine+0x38)` flag, `func_0x00010154eab8`),
  writes `*(int*)(engine+0x20) = 100000` (scheduler quantum — µs [H]), and
  registers with the new scheduler (`func_0x00010154e720`). This is the whole
  body — the arp has no Init-time parameter recompute; setters write state
  directly.
- **Reset** — thunk 0x1016c0c94 (459-line body) [D]: clears the note bookkeeping
  (calls `func_0x0001016ba378`, clears the KAllMidiKeys-derived per-key
  table) — full slot-by-slot reading open (capture §3).
- **Setters** (28 `SProcessorFunc` registrations, symbol table in evidence §1):
  On, Mode, PatternOffset, Repeat, SyncState, SyncedRate, Groove, FreeRate,
  Gate, Retrigger, RetriggerInterval, Hold, TransposeSteps, TransposeDistance,
  TransposeMode, TransposeKey, VelocitySwitch, RetriggerVelocity,
  VelocityDecay, VelocityTarget, UseSongScale, RandomStepsCompatibilityMode
  (all `(float)`), ScaleAndTuning + OnMidiEvent (both `(void*)`), Exit,
  Reset. Small setters are exact one-line stores [D] (ledger §2). The float
  setters for Mode/On/SyncState/SyncedRate/Groove/FreeRate/Gate/Hold carry a
  large shared recompute tail (each thunk decompiles the whole containing
  function, 434–1257 lines — the tail re-derives the repeat schedule from
  SyncState/SyncedRate/Groove/FreeRate/Gate; per-branch reading open [H],
  bodies captured).
- **OnMidiEvent** — thunk 0x1016c0f6c (1179-line body) [D]: note-on inserts a
  record into the 128-slot held-note store (shell+0x1050 area, 0x80 slots ×
  0x850 bytes, per-slot sub-record zeroed 0x840 [D]), stamps scheduler time
  quantized as `round(t·3843840)/3843840` (the shared event-time rounding,
  4.6116860e18-scaled fixed point in the captured body [D]; unit [H]:
  1/3843840 s ticks), then re-arms the repeat engine. When
  `state[0x25] == 0x11` (mode index 17) it **Fisher–Yates-shuffles a table at
  +0x64e of `count` entries with LCG `x = x·0x19660d + 0x3c6ef35f`**
  (the classic 1664525/1013904223 generator) — the Random-mode order table
  [D]; which of Random Other/Random Once this is (17 in the internal enum)
  and the second Random variant's path are open [H].
- **DeferredProcess** (`OMidiArpeggiatorEvent`, thunk 0x1016c0bd8) [D]: the
  per-repeat callback — reads the due records from shell+0x2130 (stride-6
  longs: id, time, time, …) whose times equal the due time, re-emits them
  through the float callback at engine+0x30 (`func_0x0001015f1948(0x42800000
  = 64.0f, …)` per emitted step [D — 64.0 is the raw velocity-domain
  constant; mapping to MIDI velocity [H]]), and re-books the next repeat.
  Body captured (partial, messy decompile — mid-function label).

**Chord/octave repetition.** The UI-facing knob is `Repeat` (int slot +0xe8,
raw store [D]); `OnRandomStepsCompatibilityMode` (+0xec bool [D]) preserves
the Live-11 "Random steps" behavior. The actual octave/chord expansion loop
sits inside the OnMidiEvent/DeferredProcess engine bodies (the 64×0x60
quarter records and the 0x64e order table) — **not transcribed line-by-line
in this lane**; structure captured, algorithm open (§4).

## 2. The state-slot ledger (every reader → its writer)

Object A = shell state (setter `param_2`; ctor `param_1`). Object B = engine
(`plVar4` in the ctor). "raw" = stored unscaled, conversion site open.

| slot (obj) | role | writer | value / law |
|---|---|---|---|
| A+0x90 | enable gate byte read by sync setters | SET On [H] | ctor/init open |
| A+0x98 | SyncState bool | SET SyncState [D] | `param != 0`; when false calls `func_0x0001016ba55c` (free-rate resched) |
| A+0xa0 | SyncedRate, **double, beats per step** | SET SyncedRate [D+B] | `rateTable[idx]` — table §3 |
| A+0xb0 | TransposeSteps int | SET TransposeSteps [D] | also wraps A+0x12c(300) into `[0,steps)` (stored cursor mod steps) |
| A+0xb8 | TransposeMode − 1 (0-based; untouched when 0) | SET TransposeMode [D] | `if(v!=0) slot=v−1` |
| A+0xbc | TransposeOn bool | SET TransposeMode [D] | `v != 0` |
| A+0xc0 | TransposeKey int | SET TransposeKey [D] | raw |
| A+0xc4 | Retrigger mode int | SET Retrigger [D] | mode 2 → recompute helper into +0x120 |
| A+0xc8 | RetriggerInterval int | SET RetriggerInterval [D] | ctor 8 (via engine copy [H]) |
| A+0xcc | RetriggerVelocity bool | SET RetriggerVelocity [D] | |
| A+0xd0 | PatternOffset int | SET PatternOffset [D] | raw |
| A+0xdc | VelocitySwitch bool | SET VelocitySwitch [D] | |
| A+0xe0 | VelocityDecay float (raw) | SET VelocityDecay [D] | |
| A+0xe4 | VelocityTarget float (raw) | SET VelocityTarget [D] | |
| A+0xe8 | Repeat int | SET Repeat [D] | |
| A+0xec | RandomStepsCompatibilityMode bool | SET [D] | Live-11 compatibility flag |
| A+0x120 | retrigger gate helper (double) | SET Retrigger/Interval [D] | default −1.0; mode 2 → `func_0x0001016bc49c` result; ctor writes −4.0 to ENGINE+0x120 (offsets coincide — object split [H]) |
| A+0x2130… | 64 records × 0x60: per-quarter {float −0.0, double DBL_MAX, id −1}×4 | CTOR [D] | due-step queue for DeferredProcess [H] |
| A+0x3938…0x46948 | pattern store, 0x43010 B zeroed; sub-object at +0x4140 | CTOR [D] | Live-12 pattern/offset storage — layout open |
| A+0x46948 | UseSongScale bool | SET UseSongScale [D] | |
| A+0x46950/0x46958 | scale object ptr / root note int | SET ScaleAndTuning [D] | walks the global scale list (stride 0x50) to find the index; reports `−index` (float, −1.0 when not found) through the +0x60 callback and root through +0x78 [D] |
| B+0x20 | scheduler quantum int | INIT [D] | 100000 (µs [H]) |
| B+0x28/+0x38 | scheduler ptr / attached flag | INIT/ctor [D] | attach/detach protocol |
| B+0xa0 | 0.25 (double) | CTOR [B] | Gate default (0.25 raw domain [H]) |
| B+0xa8 | {20.0 f, 50.0 f} | CTOR [B] | unnamed defaults (Velocity pair [H]) |
| B+0xe0 | {64.0 f, 1000.0 f} | CTOR [B] | unnamed defaults (Decay/Target pair [H]) |
| B+0xf8/0x100 | −1.0 ×2 | CTOR [B] | velocity ramp cursors [H] |
| B+0x138… | 128 × 0x30 per-key records | CTOR [D] | held-key bookkeeping |
| B+0x64e… | Random-order table (Fisher–Yates target) | OnMidiEvent [D] | count at +0x846, LCG seed at +0x848 |
| B+0x1050… | 128 × 0x850 held-note records | OnMidiEvent [D] | note store (per-note sub-record 0x840 B) |

## 3. The synced-rate table and the mode table

**SyncedRate table at 0x10528aa90**, 14 entries × 16 B `{double beats, char*}`
[B, PairDump in evidence §9] — `OnSyncedRate` indexes it as
`table + (int)param << 4` [D]:

```
1/128→0.03125  1/96→0.041666667  1/64→0.0625   1/48→0.083333333
1/32 →0.125    1/24→0.166666667  1/16→0.25     1/12→0.333333333
1/8  →0.5      1/6→0.666666667   1/4→1.0       1/3→1.333333333
1/2  →2.0      1/1→4.0
```

(values are **beats** — a 1/128 note lasts 4/128 = 0.03125 beats; the
triplet entries 1/96, 1/48, 1/24, 1/12, 1/6, 1/3 confirm the unit). The
step period in scheduling = stored beats × song tempo law — the tempo
multiplication lives in the shared recompute tail, not transcribed [H].
Adjacent structures at +0xe0/+0x100 (entries {0.5 "1/8"}…{3.0 "3"}) belong to
other menus (consumer open — likely NoteLength's SyncedLength menu, [H]).

**Mode table.** The runtime-built `SMidiArpeggiatorModeList()::sModeList`
(global 0x1057e2ac0, guard 0x1057e2ad8) is file-zeroed (lazy init), so the
ordered table itself is not statically decodable [B-negative]. The display
names survive as the A-view enum strings at 0x1048f6f66…0x1048f7004 [B]:
`UpDown, DownUp, "Up & Down", "Down & Up", Converge, Diverge,
"Con & Diverge", Pinky Up, Pinky UpDown, Thumb Up, Thumb UpDown,
Play Order, Chord Trigger, Random Other, Random Once` — 15 modes, matching
the Live 12 arp menu; the internal enum runs at least to index 17 (mode 0x11
triggers the random shuffle [D]), so plain Up/Down/Con/Order occupy lower
indices whose short strings sit elsewhere (shared short-string pool;
index→mode map [H]).

## 4. What remains open (honest residuals)

- **The step-generation algorithm per mode** (how Up/Down/Con/… pick the
  next note from the held set), the octave/Repeat expansion loop, and the
  Gate (fraction of step length) application: bodies captured (OnMidiEvent
  1179 lines, DeferredProcess partial) but not transcribed to pseudocode
  here — reading them is the next lane's first move. The velocity law
  (VelocitySwitch/Decay/Target applied per repeat — Decay raw +0xe0,
  Target raw +0xe4) is captured in state, not in arithmetic [H on the
  common `v·2^(decay·k)` shape].
- **Tempo/sync plumbing**: where SyncedRate beats × tempo × Groove amount
  become scheduler times (shared recompute tail, 434–1257-line bodies,
  captured in evidence §4–§6, per-branch reading open).
- **Hold behavior** (OnHold, 582-line body, captured partial) and the
  latch/pass-through of note-offs.
- **Pattern store layout** (shell+0x3938, 0x43010 B; sub-object at +0x4140)
  and how PatternOffset (+0xd0) indexes it.
- **Object split bookkeeping**: which slots setters share with the engine
  copies (A+0x120 vs B+0x120 −1.0/−4.0 mismatch noted in §2).
- **DeferredProcess** decompile is truncated/messy (mid-function label,
  `unaff_` registers) — re-decompile from the true function entry before
  building on it.
- Everything above awaits the golden-render gate before any rebuild claims
  parity (README's binding rule; no renders ran in this lane).

## 5. Confidence

- Setter inventory (28 registrations), small-setter state writes, Init/ctor
  structure, the 14-entry synced-rate table, mode-name strings, the Random
  LCG shuffle: **high** as decompile/byte readings — single-source (LiveRE2
  probes), tables byte-decoded, no second reading done.
- Object-split interpretation (shell vs engine), deferred-repeat topology,
  scheduler-quantum and default-constant naming: **medium** — the captures
  are [D]/[B] but the role assignments carry [H] marks above.
- Per-mode step order, Repeat/octave loop, Gate/velocity arithmetic: **low**
  — captured, not derived; do not build on them.
- No behavioral claim of any grade is made; the golden-render corpus for
  Arpeggiator does not exist yet (COVERAGE row empty).
