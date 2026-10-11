# Impulse (ImpulseDevice) binary derivation — slot/voice shell (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (query-only — CallTargetsProbe/
BlockProbe decompiles, nm symbol census, objdump/const-pool decodes; no
re-import). Companion capture: `evidence/binary/impulse-decompiles.txt`.
Form follows `compressor-derivation.md` / `analog-derivation.md`; claims
graded: **[D]** decompiled/disassembly-confirmed (capture cited), **[B]**
byte/const decoded, **[H]** unverified hypothesis. NO Live, NO renders ran in
this lane; per README every [D]/[B] claim still awaits the golden-render
cross-check before it gates a rebuild.

Impulse is a devicekit instrument: **`OInstrumentImpulseProcessor`** (create
manager 0x1018bea20, wrapper 0x1018bea5c, ctor `thunk_FUN_10168b7ac`
0x10168b9e8→0x10168b7ac), plus five per-slot **serializer processors**
(Tab/Start/Filter/Decay/Volume) and an `OImpulsePlayerParameterProcessor`.
The per-slot parameter surface lives in the serializers; the per-sample
playback/filter/decay math is anonymous code — **not located** (§4, corpus
material). The 8-slot model is visible as eight-entry pointer tables in the
processor shell [D].

## 1. What runs when (call topology)

- **Create** `OProcessorCreateManager::SOnProcessorCreate<OInstrumentImpulseProcessor>`
  0x1018bea20 → trampoline 0x101546e1c → wrapper `FUN_1018bea5c` [D]: reads
  device info (`0x10153be8c`/`0x10153be4c`), allocates the 0x28-byte shell,
  registers with param stride `0x1850`, ctor at `0x10168b9e8`, then
  `0x101545e84`. Same shape for the five serializer processors (create
  wrappers 0x1018be8b4 Decay, 0x1018be988 Filter, 0x1018beb34 Start,
  0x1018bec08 Tab, 0x1018becdc Volume — all 128-byte boilerplate) and
  `OImpulsePlayerParameterProcessor` (0x101aa09a8 → 0x101aa09e4) [D].
- **Ctor** [D, evidence §ctor]: vtable 0x105289fc8; zeroed `0x1458`
  (LinkSlot7and8) and `0x15d4` (X); **voice-record init loop, stride 0x20
  over 0x800 bytes = 64 records at 0xc50**: `+0x00 ← 0`, `+0x08 ← 0`,
  `+0x10 ← {2, −1}` (state 2, next −1 — const pool 0x104cc7430 [B]),
  `+0x18 ← 0xffffffff`; `0x145c/0x1460 ← {8, 2}` (const pool 0x104dd94a8
  [B] — the voice-count pair); per-slot **callback triples** (3 × 8-byte
  slots) at `0x15f0 + k·0x18` (float callbacks, `CallbackIFvfE` null) and
  `0x16c8 + k·0x18` (void callbacks, k = 0..7 — eight slots [D]) plus one at
  `0x15d8` (global).
- **Registered dispatch — 9 entries only** (nm census [D]): `OnTab`,
  `OnStart`, `OnDecay`, `OnFilter`, `OnVolume` (payload = int* whose [0] is
  the slot index), `OnX(float)`, `OnVoiceWentOff(float)`,
  `OnLinkSlot7and8(float)`, `OnIsConnected`. **No Init/NewRate/Reset/Calc
  registration** for this class — per-sample DSP is not in a named
  SProcessorFunc (unlike the Compressor's 36); the serializers each register
  their own On* set (below).
- **Setter law (all five per-slot families)** [D]: the payload pointer is
  stored into a per-slot table, indexed by slot:
  tab table `0x1490 + tab·8` (OnTab), Start `0x14d0 + tab·8`,
  Filter `0x1510 + tab·8`, Decay `0x1550 + tab·8`, Volume `0x1590 + tab·8`.
  `OnIsConnected` writes a byte array `0x1450 + tab` (connected flag);
  `OnLinkSlot7and8`: `0x1458 = (v > 0.5)`; `OnX`: `0x15d4 = (v > 0.0001)`;
  `OnVoiceWentOff`: `0x15d0 = (int)v` then, if `-1 < v < *(int*)0x1460 +
  *(int*)0x145c` (= 10 with the ctor pair) and record state `+0x10 == 1`
  (playing) → state `= 2` (releasing), snapshot `+0x08 ← *(sched+0x90)`,
  `+0x00 ← 0xffffffff` [D].
- **OnTab** [D, evidence §OnTab]: `tabtable[tab] = payload`; if the
  payload's second qword is 0 → `FUN_10168bc58` (below); if payload byte
  flag set → posts a message `{ K[tab], 80.0f, 1, … }` through the shell
  vtable (vtable +0x18 then +0x20), where **K = *(u32*)(0x10571acf8 + tab·4)
  = {60, 62, 64, 65, 67, 69, 71, 72}** [B decode] — the default per-slot
  key centers: **C4 D4 E4 F4 G4 A4 B4 C5** (C-major white keys) [H on the
  posting semantics; the table is [B]].
- **`FUN_10168bc58`** (tab flush/retrigger) [D]: scans the first
  `*(int*)0x145c + *(int*)0x1460` voice records; for each whose `+0x14`
  (slot index) equals the argument: `+0x00 ← {0.0f, 1.0f}` (fade pair [H]),
  `+0x08 ← *(sched+0x90)` (position snapshot), then fires the per-slot
  callback triple `0x16c8 + tab·0x18` and the global `0x15d8` with a
  `{voice, 1, 1, 1.0f, …}` message.

## 2. The parameter/state ledger

Main `OInstrumentImpulseProcessor` shell (all [D] unless noted):

| slot | role | writer |
|---|---|---|
| 0xc50 + v·0x20 | voice record: fade pair (2×f32), position snapshot (8B), state i32 (1 playing / 2 released), slot i32 (+0x14), spare i32 (−1) | ctor, CALC?, OnVoiceWentOff, FUN_10168bc58 |
| 0x1450 + tab | per-slot IsConnected byte | SET OnIsConnected |
| 0x1458 | LinkSlot7and8 bool (v>0.5) | SET |
| 0x145c / 0x1460 | voice counts {8, 2} — bound = sum | ctor [B]; consumers [H] |
| 0x1490 + tab·8 | tab payload ptr table | SET OnTab |
| 0x14d0 / 0x1510 / 0x1550 / 0x1590 + tab·8 | Start / Filter / Decay / Volume payload ptr tables | SET |
| 0x15d0 | last VoiceWentOff index | SET OnVoiceWentOff |
| 0x15d4 | X bool (v > 0.0001) | SET OnX |
| 0x15d8 / 0x16c8 + k·0x18 | global + per-slot callback triples | ctor (null), wired later [H] |

Serializer param blocks — the per-slot parameter storage (each serializer
holds one slot's set; the store offset law is [D] from the On* bodies):

| processor | stores (offsets in its state block) |
|---|---|
| StartSerializer | +0x0c Start, +0x10 Tune, +0x14 Random, +0x18 Velocity, +0x1c Reverse, +0x20 Soft, +0x24 Stretch, +0x28 StretchVel, +0x2c StretchMode; +0x28 also the sample ptr slot (refcounted, OnSample swaps with retain/release) — overlap noted in capture |
| FilterSerializer | +0x0c Freq, +0x10 Q, +0x14 Random, +0x18 Velocity, +0x1c Type (int), +0x20 On (bool >0.5) |
| DecaySerializer | +0x0c SatOn (bool >0.5), +0x10 Drive, +0x14 Decay, +0x18 DecayMode (bool, v==1.0) |
| VolumeSerializer | +0x0c Volume, +0x10 Pan, +0x14 PanRand, +0x18 Mute, +0x1c VolumeVel, +0x20 PanVel (bool), +0x21 Solo (bool) |
| TabSerializer | +0x10 Alpha, +0x18 Omega (doubles), +0x28 sample ptr; OnPlay = serialize-now pulse; Exit releases the sample |

Every store ends by invoking the serializer's callback (`vtable +0x30`) —
the "serialize" hop that forwards the block to the engine side [D shape;
the consumer is anonymous].

**Time-stretch parameter law** [D names, H semantics]: StartSerializer's
`Stretch` / `StretchVel` / `StretchMode` triple is Impulse's per-slot
time-stretch (the UI's Transpose-adjacent "Stretch" with velocity
sensitivity and mode toggle). `NWarperTypes::TWarpMode` exists in the
binary [D symbol] and the clip warp engines' measured behavior is in
`warp-probe.md`; which engine the Stretch path instantiates per mode is
not pinned — corpus material.

## 3. The mechanism, plainly (what the binary pins down)

- **8 slots = 8 pointer-table rows + 8 per-slot callback triples + the
  8-entry note table** [D/B]: the slot index arrives in every payload
  (`payload[0]`), the processors never iterate slots themselves — slot
  addressing is a table lookup, so the slot count is a shell constant,
  not a loop bound.
- **Voice release protocol** [D]: state machine 1 (playing) → 2 (released)
  on OnVoiceWentOff; the release record snapshots the scheduler position
  (`*(sched+0x90)`) — the decay tail runs against that stamp. Record
  capacity is 64 (ctor loop) while the active window is
  `counts[0] + counts[1]` = 10 [B]; reading 8 as "8 slots" and 2 as
  "spare/linked-slot extra" is [H].
- **Linked slots 7+8** [D bool / H behavior]: `OnLinkSlot7and8` is a plain
  bool at 0x1458 — Impulse's slot 7/8 stereo-link; how it couples the
  voices is engine-side, not captured.
- **Key mapping** [B]: the per-slot center notes {60..72 white keys} imply
  the default key-zone split is C4–C5 across the 8 pads; user remapping
  lives device-model side (the UI), not in this processor.
- **The engine is anonymous.** No Init/NewRate/Calc SProcessorFunc exists
  for `OInstrumentImpulseProcessor`; the playback, one-pole/biquad filter
  (FilterSerializer's Type/Q/Freq), saturation (SatOn/Drive), decay
  envelope law and stretch all live in undisassembled/anonymous code. The
  `OImpulsePlayerParameterProcessor::OnInfo` body [D] shows the device
  side converting semitones → ratio through the **shared runtime-built
  LUT at 0x1059a89b8** (the same table object family the Compressor's GR
  LUT uses: `+8` LUT ptr, `+0x20` domain start, `+0x24` scale, linear
  interpolation between adjacent entries) over
  `(x/12 − c20)·c24` inputs — the Global Time/Pitch display converters.

## 4. What remains open (honest residuals — corpus material)

- **The per-sample engine**: voice playback, filter coefficient law per
  Filter Type enum, Decay→time mapping (ms law), Drive saturation curve,
  Stretch implementation per StretchMode. Next lane's move: find the audio
  callback via the voice records' consumers (readers of 0xc50 block) or
  the shell vtable.
- **OnTab message semantics** (K[tab] + 80.0f + 1 — key-flash vs note-on
  echo) and the exact meaning of the payload second qword == 0 branch.
- **Voice-count pair {8, 2}** (0x145c/0x1460): slot count + spare, or
  8 normal + 2 linked? [H]
- **StartSerializer +0x28 double duty** (Velocity float store vs sample
  ptr) — likely two separate state regions overlapping in Ghidra's view;
  the true block layout needs the ctor of that serializer.
- **TabSerializer Alpha/Omega** (doubles at +0x10/+0x18): play-position
  interpolator state (alpha/omega) — role open.
- Everything in §3 awaits the golden-render corpus (no renders this lane;
  COVERAGE row empty).

## 5. Confidence

- Class architecture, dispatch census (9 + serializer sets), the five
  per-slot pointer tables, voice-record layout/init, const decodes (notes
  table, {8,2}, {2,−1}), serializer store maps: **high** as decompile
  readings — single-source (BlockProbe decompiles + nm census), with the
  const pools double-decoded via raw bytes (objdump/python) which agreed.
- Release/retrigger protocol reading, slot-7/8 linking, key-zone default
  interpretation: **medium** — the writes are [D], the dataflow built on
  them is [H].
- Any DSP behavior claim: **none made** — nothing about the render loop,
  filter laws, decay curves, or stretch was decodable within this lane's
  timebox; §4 residuals are corpus material, not buildable law.
