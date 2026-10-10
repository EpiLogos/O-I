# Velocity + Note Echo + Note Length binary derivation (2026-10-09, binary lane)

PROVENANCE: owner-private analysis of `Live.arm64` (Live 12.0.25,
2024-08-27_2627c43816), arm64 slice, via the persistent Ghidra project
`~/tools/live-re/ghidra-proj2/LiveRE2` (already analyzed; query-only —
SymProbe/SearchProbe/BlockProbe/DataProbe/PairDump, no re-import). NOT FOR
REDISTRIBUTION. Never enters product source (`packages/live-dynamics`).
Companion capture: `evidence/binary/velocity-notelength-decompiles.txt`
(Velocity setters, NoteLength Init/Exit/Reset/setters/OnMidiEvent engine,
synced-length table, decay constants, and the Note Echo negative-result
search log). Form follows `compressor-derivation.md`; claims graded: **[D]
decompiled-confirmed**, **[B] byte-decoded**, **[H] unverified hypothesis**
— no behavioral renders ran in this lane; per README every [D]/[B] claim
still awaits the golden-render cross-check before it gates a rebuild.

One doc, three targets. Velocity and Note Length are classic MIDI-FX
processors sharing the `OMidiFxShellProcessor` shell (see
`chord-derivation.md` §0 for the family shape). **Note Echo is a negative
result: it does not exist as a compiled device in Live 12.0.25** — §3
documents the evidence.

## 1. Velocity (`OMidiVelocityProcessor`)

Create chain: `SOnProcessorCreate<OMidiVelocityProcessor>` 0x1018c17d0 →
builder 0x1018c180c → ctor `FUN_1016d2e3c` [D]. Setters (thunks
0x1016d63a8…0x1016d6418, exact bodies [D]):

| slot | param | writer law |
|---|---|---|
| +0xc68 | On | bool |
| +0xc6c (+ mirror +0xc80) | Lowest | raw float, **double-buffered** (two slots written together — clickless param swap [H]) |
| +0xc70 (+ mirror +0xc84) | MaxOut | raw float, double-buffered |
| +0xc88 | MinOut | raw float |
| +0xc8c | Range | raw float; ctor = **128.0 f** [B] |
| +0xc74 | Random | raw float; ctor 0.0 [B] |
| +0xc78 | Drive | stored **negated**: `slot = −v` [D] |
| +0xc7c | Compand | stored **negated**: `slot = −v` [D] |
| +0xc90 | Mode | int, with a `== 2` special case in the setter (mode-2 recompute branch, body captured) [D] |
| +0xc94 | Operation | int raw (drive/compand select — the UI "Operation" menu [H on enum]) |

**Ctor defaults [B]** (const pool 0x104ccad68…): Lowest pair {1.0 f, 1.0 f},
Random 0.0, Drive slot 1.0 f (i.e. −(−1) [H on sign convention]), Compand
0.0, Lowest-mirror 1.0 f, MaxOut-mirror 0.0 f, MinOut **128.0 f**, Range
**128.0 f**, On false. Drive/Compand negation in storage means the note-time
consumer reads them directly as negative exponents [H — the consume site is
the unsymbolized transform, same residual as the Chord family; the negated
store is the lane's hard fact].

**Drive/out law**: not captured at the arithmetic level (transform
unsymbolized — see residuals). What the binary fixes: the parameter set
(Operation, Drive, Compand, MinOut, MaxOut, Lowest, Range, Random, Mode,
On), their storage domains, and the ctor defaults above.

## 2. Note Length (`OMidiNoteLengthProcessor`) — fully readable engine

Create chain: create 0x1018c1048 → builder 0x1018c1084 → ctor
`FUN_10183e2a8` [D]. Ctor: per-MIDI-key state, **128 keys × 0x30-byte
records at +0x88** (on-time double at +0x08, velocity double at +0x18,
latched byte at +0x20, off-due marker +0x24; init −1/−1.0/0/0 [D]);
pending-off **ring of 128 ints at +0x1890, head +0x188c, count +0x1888**
[D]; a big zeroed region +0x1a90 (0x42808 B) with builder
`func_0x00010184d6bc` (decay table [H]); scheduled event object (vtable
0x105296138) + scheduler adapter (0x105296180) at +0x78/+0x80 [D].

**Defaults [B]**: SyncedLength(+0x50) = **4.0 beats** ("1/1"), TimeLength
(+0x58) = **100.0 ms**, Gate(+0x60) = **1.0**, Balance(+0x68) = **0.0**,
DecayTime(+0x6c) = **60000.0** (the exact "off" threshold — decay active
only below 60000), DecayKeyScale(+0x70) = 0.

**Setter laws (exact, [D])**: On +0x48 bool (turning off releases all
pending offs); Mode +0x49 bool (Trigger Source [H on polarity]); Latch
+0x75 bool — turning latch OFF immediately emits synthetic note-offs for
every latched key, velocity constant **0x42800000 = 64.0 f** raw [D];
SyncState +0x4a bool; SyncedLength +0x50 = table lookup at **0x10571ae40**
(indexed `(int)v << 4`) [D]; TimeLength +0x58 ms (double); **Gate +0x60 =
`v × 0.01`** (UI % → fraction) [D]; Balance +0x68, DecayTime +0x6c,
DecayKeyScale +0x70 — raw floats. Every length-affecting setter re-runs the
same recompute tail: recompute the due time of the single pending-off at
the ring head and reschedule it (dedup: skip if unchanged), else drain due
offs [D].

**Synced-length table at 0x10571ae40** — 13 entries × {double beats,
char*} [B, PairDump in evidence §3]:

```
"0"→0.0  1/64→0.0625  1/48→0.083333  1/32→0.125  1/24→0.166667
1/16→0.25  1/12→0.333333  1/8→0.5  1/6→0.666667  1/4→1.0
1/3→1.333333  1/2→2.0  1/1→4.0        (values in beats)
```

(the "0" entry is the synced menu's zero-length slot [H on UI meaning]).
NoteLength has its OWN table — separate from the Arp's 0x10528aa90 —
missing only the /128 and /96 rows the arp has.

**The length law (Reset/OnSyncState/OnSyncedLength/OnTimeLength/OnGate
shared tail, exact [D])**:

```
sync ?  len = SyncedLength(beats) × Gate          :  len = TimeLength(ms) × Gate × 0.001
effective = (len ≥ 0.01) ? len : 0.005            // 5 ms floor; 5–10 ms collapses to 5 ms
due = noteOnTime + effective                      // then scheduled on the OScheduler
```

**The release-velocity decay law (OnMidiEvent, exact [D])** — when
DecayTime < 60000, the note-off velocity is scaled by an exponential decay
in elapsed time, key-scaled around key 0x40 (64):

```
t       = elapsedTicks / ticksPerBeat                       // beats since note-on
arg     = (t + DecayKeyScale × (key − 0x40) × −0.015625 × t)
          × (sLogOfMinus84dB / (DecayTime × 0.001))
arg     = max(arg, −6.9078)                                 // floor = exp(−6.9078) ≈ 0.001
vel     = velIn × expf(arg)
Balance (Release Velocity mix, %): out = vel×(1 − Balance/100) + origReleaseVel×(Balance/100)
clamp to 127
```

constants [B]: `sMinus84dB = exp10f(−4.2) ≈ 6.3096e-5`,
`sLogOfMinus84dB = logf(sMinus84dB) ≈ −9.6730`, `sMinimumExpArgument =
−6.9078 (ln 0.001)`. Naming: the −84 dB label comes from the symbol
(`OMidiNoteLengthProcessor::Velocity<TNoteState>::sMinus84dB`) while the
numeric floor is −60 dB in amplitude — the label is the designer's
intent-name, the floor is the code [D both; the mismatch noted, not
resolved]. Per-semitone time shrink: `−0.015625 = −1/64` of elapsed time
per key above 0x40, weighted by DecayKeyScale [D shape; reference key 64 =
E4 [H]].

## 3. Note Echo — NEGATIVE RESULT (no compiled device in 12.0.25)

The lane brief names a Note Echo MIDI effect. The binary says otherwise.
Evidence (full log in the companion capture §5):

- **No processor class**: the complete `SOnProcessorCreate` registry
  enumerates every MIDI device class — Arpeggiator, BranchOut, CcControl,
  ChannelDispatcher, Choke, Chord, Defer, (internal) Delay, Gate,
  GroupChain, JitterReduction, LatencyTest×2, Meter, Mute, **NoteLength**,
  Pitcher, RackBypass, Random, RandomTest, Scale, Smoothing, Switch,
  ToHerz, Velocity. **No Note Echo / MidiEcho class** [D].
- **No strings**: `NoteEcho`, `MidiEcho`, `EchoDevice`, `oteEcho` — zero
  hits in strings and symbols [D].
- **No devicekit model**: the `ableton::devices::*` namespaces are roar,
  meld, wavetable, drift, drum, hybrid, **echo (the audio Echo)**, shifter,
  spectral, reverb, **delay (the audio Delay)**, fake, transmute, chorus,
  redux2, phaser, channel, repitch — no MIDI echo model [D].
- **No push model**: `push_live_model` device classes include MidiChord,
  MidiPitcher, Transmute, Shifter… — no NoteEcho [D].
- The UI string **"Note Echo" exists exactly once** (0x10490b7fe), in the
  browser device-name pool whose neighbors are Max-for-Live device names
  ("MPE Control", "Expression Control", "MIDI Monitor", "Shaper MIDI",
  "Envelope MIDI") alongside stock ones — consistent with a **bundled Max
  for Live MIDI device**, whose DSP lives in an .amxd, not in Live.arm64
  [D for the string and pool; M4L attribution [H — amxd content not
  inspected in this offline lane]].

Consequence: no binary derivation of Note Echo is possible from this
target. If a rebuild needs Note Echo parity, the derivation target is the
bundled .amxd (a different lane with different tooling), or the device is
out of scope for 12.0.25 binaries.

## 4. What remains open (honest residuals)

- **Velocity's note-time arithmetic** (Drive/Compand exponent application,
  Random draw, Operation/Mode semantics): the transform is unsymbolized;
  storage, defaults, and the double-buffered Lowest/MaxOut slots are the
  captured facts. Next-lane move: xref reads of +0xc78/−negation or catch
  the shell-dispatched callback.
- NoteLength: the 0x42808-byte region at +0x1a90 (builder
  `func_0x00010184d6bc`) — likely the per-key decay-time table (Decay Key
  Scale precompute) [H]; Mode +0x49 polarity; the exact ordering of drain
  vs re-arm inside OnMidiEvent's 570-line body (captured, only the decay
  core transcribed).
- The synthetic note-off velocity 64.0 f raw → MIDI velocity mapping (raw
  domain shared with the arp's 64.0 emit [H]).
- Everything above awaits the golden-render gate (README binding rule; no
  renders ran in this lane).

## 5. Confidence

- Velocity setter laws + defaults, NoteLength's complete setter set, the
  length law (incl. the 5 ms floor and Gate ÷ 100), the 13-entry
  synced-length table, the release-velocity decay law with its three
  constants, the pending-off ring, and the Note Echo negative result:
  **high** as decompile/byte readings — single-source (LiveRE2 probes),
  exact bodies cited in the capture.
- Raw-domain → MIDI-velocity mapping, Mode/Balance UI semantics, the M4L
  attribution of Note Echo: **low-to-medium**, marked [H] above; do not
  build on them without the render gate.
- No behavioral claim of any grade is made; the golden-render corpus for
  these devices does not exist yet (COVERAGE rows empty).
