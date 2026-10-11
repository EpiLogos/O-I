# LFO (MIDI-modulation LFO) binary derivation — negative result + engine-LFO law (2026-10-10, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
ModLaneProbe/SearchProbe/BlockProbe-pattern scripts, no re-import).
NOT FOR REDISTRIBUTION. Never enters product source
(`packages/live-dynamics`). Companion capture:
`evidence/binary/midi-mod-lane-decompiles.txt` (existence searches, browser
pool dump, registry census, OLfoProcessor decompiles, on-disk bundle
listing). Form follows `compressor-derivation.md`; claims graded: **[D]
decompiled-confirmed** (capture cited), **[B] byte-decoded**, **[H]
unverified hypothesis** — no behavioral renders ran in this lane; per README
every [D]/[B] claim still awaits the golden-render cross-check before it
gates a rebuild.

**The headline is a negative result.** The Live 11+ MIDI-modulation LFO —
the brief's "LFODevice" — is **not a compiled device in Live 12.0.25**. It
ships as a bundled Max for Live patcher (`LFO.amxd`, 357,488 bytes, App-
Resources/Builtin/Devices/Audio Effects/LFO/), and its DSP is not derivable
from this binary (same finding class as Note Echo,
`velocity-noteecho-derivation.md` §3). What the lane derived instead is the
engine-side LFO that IS in the binary — `OLfoProcessor`, a full stereo
event-rate LFO with shape tables, S&H, smoothing, attack fade and
tempo-sync — the law any native LFO rebuild must match.

## 1. The negative result (what the binary says)

- **No processor class**: the complete `SOnProcessorCreate` registry (367
  classes enumerated, evidence §3) contains no LFO-device class. The MIDI-FX
  class set is exactly the velocity lane's list — no LFO [D].
- **No LFODevice symbol/string**: `lfodevice` → 0 string, 0 symbol hits [D].
- Every other LFO hit belongs to device-internal modulators: AutoFilter,
  AutoPan, Phaser/Flanger, Drift, Wavetable (Lfo1/Lfo2), Simpler (the
  `StereoLfo,DeviceStereoLfo,AutoFilterLfo,AutoPanLfo,FlangerLfo,PhaserLfo,
  SimplerAuxLfo,SimplerLfo` blocks-name string) [D].
- The browser device-name pool segment (0x10490b7bc…) carries the M4L-bundle
  names 'Envelope Follower', 'Envelope MIDI', 'MPE Control', 'Note Echo',
  'Expression Control', 'MIDI Monitor', 'Shaper MIDI' — **no 'LFO' entry in
  the captured segment**; the only short 'LFO' string in the binary
  (0x104928cba) sits with 'AOperatorLfoDetailView'/'mpLfoTarget' —
  Operator's LFO section UI strings, not a device name [D, evidence §10].
- **On disk** (no Live run; filesystem evidence §8): `LFO.amxd` exists under
  Audio Effects — the M4L attribution for the LFO device proper. Note it is
  bundled as an **audio-effect** .amxd even though it modulates; its
  "modulation output routing" is a Max-model mapping, not an engine port [D
  for the file; device behavior H-out-of-lane].

## 2. `OLfoProcessor` — the engine LFO that is in the binary

Registered create `SOnProcessorCreate<OLfoProcessor>` 0x1018bf9d4 → wrapper
0x1018bfa10 (allocates 0x28 bytes, ctor `func_0x0001017a7478` via
`func_0x000101545cf4`) [D]. Setter set (SProcessorFunc thunks, exact bodies
[D]):

| slot (this+) | param | writer law |
|---|---|---|
| 0x29 | IsOn | bool; on → re-init phases, restart attack fade, push 1.0 to out [D] |
| 0x2a | note-active flag | OnNoteOn sets, OnStop clears |
| 0x2b | Retrigger | bool; turned OFF re-aligns phase to clock boundary (below) |
| 0x2c / 0x30 | Phase / Offset | stored **÷360** (`v·0.0027777778`) — UI domain is degrees [D] |
| 0x34 | Width | raw float (pulse width; consumer not in captured bodies) |
| 0x38 | Type | int enum; 0–4 pick precomputed LUTs, 5 = S&H (§3) |
| 0x3c/0x40/0x140/0x144/0x148 | Attack | ms stored; fade built: `n = ms·0.001·sr/eventRate`, floor 1; step = −fade/n; fade active flag `|v−0.1|>0.001` [D shape] |
| 0x44 | sample rate | NewRate second int [D] |
| 0x88/0x8c/0x90/0x98 | rate copies / event rate | NewRate/OnSmooth |
| 0x94 | Smooth raw | |
| 0xa0 | phase increment per event tick | `512 · min(0x8c,0x90) / …` (below) |
| 0xa8 / 0x108 | L/R phase accumulator (0..512 domain) | CALC |
| 0xb8 / 0x118 | L/R shape-LUT pointer (null for S&H) | OnType |
| 0xc8/0xcc/0xd0/0xd4/0xd8/0xdc | L smoother (a, b, x, x1, y, out) | OnSmooth/CALC |
| 0xe8/0xf4/0xf8/0x128/0x12c | R channel mirrors | |
| 0x140/0x144/0x148/0x14c | attack length / fade value / step / counter | OnAttack/OnResolution/OnIsOn/OnNoteOn |
| 0x48 / 0x4c | **L/R float outputs** (per event tick) | CALC |

Property string 'OLfoProcessor.ForceMono' exists; the mono path copies the L
state to R (`*(0x4c) = *(0x48)` in OnIsOn when 0x28 set) [D; which device
surface owns OLfoProcessor — open, §4].

## 3. The mechanism, plainly

**Shape domain.** One cycle is **512 phase units** (`& 0x1ff` index), the
table pointer (0xb8) selects a 512-float LUT, output = **linear interp**
between `lut[i]` and `lut[i+1]`. Types 0–4 select global LUT pointers at
0x1059a8a00/08/10/18/20 [D]; **the LUT contents are not statically
decodable** — the region 0x1059a89f0.. throws `MemoryAccessException`
(runtime-built at startup, the same finding as the Compressor's 0x1059a89b8
LUT [B-negative, evidence §9]). Type→shape-name mapping is therefore [H].

**S&H (Type 5).** LUT pointer cleared; on note-on / on wrap a fresh random
value `rng·2−1` is drawn from an LCG (`FUN_100d0b76c`: `x = x·0xbc8f −
(x/0xadc8)·0x7fffffff + 0x7fffffff`, `/2^31 → [0,1)` [B]). The accumulator
wraps at **256, not 512** in S&H mode (`if acc ≥ 256: acc −= 256`) — the
S&H cycle is half the table cycle for the same rate [D code; UI consequence
H].

**Phase/Offset/Retrigger.** Phase is added into the accumulator domain
(`fmod((phase + acc/512), 1)·512`); Offset is the R-channel phase offset
(`fmod(phase + offset, 1)` builds R's start). Retrigger-off re-anchors the
phase to the next clock boundary: `0xc0 = clockNow + (floor(clockNow/
eventRate)·eventRate − clockNow)` — tempo-quantized re-arm [D].

**Synced vs free rate.** Free rate runs as `0xa0 = 512·(freq-domain clamp)/
…` from the NewRate recompute; the **synced path (`OnFreq` takes a pointer,
not a float)** reads a shared clock object and keeps a fractional
correction term (`puVar7[5] += puVar7[4]·ticksSince`) — drift-free beat-locked
accumulation [D shape; clock-object contract open].

**Smoothing = TPT one-pole lowpass.** OnSmooth maps Smooth → cutoff `Hz =
Smooth·10 + (1−Smooth)·400` (Smooth 1 → 10 Hz, 0 → 400 Hz), clamped below
0.499·tickrate, and builds bilinear coefficients `a = 1/(1/t+1)`,
`b = (1−1/t)/a`; the per-tick filter is `y = (x1 + x·a) − y1·b`, output
clamped ±1 [D]. This is a topologically-true one-pole (no delay-free loop),
applied to BOTH the table and S&H outputs.

**Attack = fade-in ramp.** `n = Attack_ms·0.001·sr / eventRate` (floor 1)
ticks; the output multiply ramps 0→1 linearly (`fade += step`) on every
IsOn/NoteOn restart [D]. The enable flag compares the stored ms to 0.1 —
0.1 ms is the "no fade" point [H on UI reading].

**Output routing.** Per event tick the processor writes two floats — L
0x48, R 0x4c (mono: both = L) — into the event stream the mod-router picks
up; OnStop writes 0 and unlinks the processor from its tick list (doubly
linked list splice through 0x10/0x18) [D]. There is no MIDI output here:
this is the control-rate float modulator plumbing (contrast the M4L LFO
device, which maps its output through the Live Object Model).

## 4. What remains open (honest residuals)

- **Shape-LUT contents** (Types 0–4): runtime-built region, not decodable
  [B-negative]. A render gate (drive Type through one cycle, record 0x48)
  recovers all five shapes directly.
- **Which device owns `OLfoProcessor`**: the create registry carries it and
  the 'OLfoProcessor.ForceMono' property string exists, but no device XML in
  `evidence/devices/` matches its property set (Smooth/Resolution/Attack are
  absent from the captured AutoPan Lfo element). Live 12's reworked AutoPan
  LFO is the leading suspect [H]; confirm by xref from a device model or a
  fresh XML capture.
- S&H half-cycle wrap, Width consumer, the 0.1 ms attack flag, the synced
  clock-object contract: [H], do not build on them.
- The M4L LFO device itself (its UI shape set, sync menus, modulation-map
  output) is undecodable in this lane — its law lives in `LFO.amxd`.
- Everything above awaits the golden-render gate (README binding rule; no
  renders ran in this lane).

## 5. Confidence

- The negative result (no compiled LFO device; M4L bundle attribution):
  **high** — three independent lines (registry census, string/symbol
  searches, on-disk .amxd listing), exact captures cited.
- `OLfoProcessor` setter laws, the 512-unit table/S&H phase machinery, the
  TPT smoother, attack ramp, dual-channel layout and event-out routing:
  **high** as decompile readings — single-source (LiveRE2 probes), exact
  bodies in the capture.
- Type→shape-name mapping, S&H UI semantics, OLfoProcessor's device owner:
  **low**, marked [H] above.
- No behavioral claim of any grade is made; the golden-render corpus for any
  LFO does not exist yet (COVERAGE row empty).
