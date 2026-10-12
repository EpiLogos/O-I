# Shell contemplation — the Ableton Live fork as the app shell

**Revision 2 (owner correction applied, 2026-10-07).** Revision 1 mapped the
wrong layer onto Live: it took the technē deep instruments (cradle tabs,
coded M0′–M5′) for the owner's "M1–M2–M3–M4". The owner corrected this in
conversation the same day: the technē instruments are part of **M5** — they
should be named **M5-0′ through M5-5′** — and the commission was the
**real M1–M2–M3–M4**, the physical music instrument. This revision
supersedes §3–§4 of revision 1 wholesale; §5–§7 survive with corrected
subjects; the correction is recorded here rather than hidden.

**Standing:** owner direction in conversation, 2026-10-07 ("one other lane
for contemplation"), corrected in conversation the same day. This is a
scoping contemplation — research proposition in the desktop spec's
provenance ladder — not a design commitment. The owner decides what
graduates.
**Register:** O-I project, within the Technè instrument parity programme
(`../PROGRAMME.md`). Lane 6's contract: one scope document.
**Ground truth for the M system:** `Work/Quaternal-Logic/docs/
M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md` (owner commission, Satya, 2 Oct 2026,
QL-MEF #281), `L5-TECHNE-DUAL-READING-LOCK.md` §11a (owner amendment,
2026-09-19), `KERNEL-M-LEDGER-MATRIX-LOCK.md`.

---

## 0. The hypothesis, stated correctly this time

Build the **full M1–M2–M3–M4** — the professional playable, physically
modelled audiovisual synthesizer and composition environment — **inside the
Ableton Live 12 fork**, with the Expressions application as the operative
M4 body and the M1–M2–M3 backend (topology/resonance/form) feeding its
actual controls and material behaviour (the #281 construction, relocated
into a Live-class host). M0 and M5 — the source ground and the deep-working
mode whose professional projections are the instruments now to be named
M5-0′…M5-5′ — integrate into the same shell as disclosure and deep-working
views rather than native surfaces. Factory finds its temporal place there.
The musical software foundation is the owner's candidate for the missing
unified temporal core that NOW and DAY only partially provide.

What revision 1 got right and survives: the possession facts, the kernel-bus
law, the two-clock doctrine, and most of the fit scoring — now serving the
correct subject. What it got wrong: §3's mapping table mapped the M5-layer
instruments (canvas/timeline/journey/places) onto Live as if they were the
integration target. They are the deep-working *disclosure* layer. The
instrument that belongs in a music shell is the one #281 already defines.

## 1. Verified starting facts

- **Possession is real.** `Ableton Live 12 Suite.app` 12.0.25 installed
  (`/Applications`); `~/Music/Ableton/` holds an active User Library
  (Clips, Grooves, MIDI Tools, Presets, **Remote Scripts**), Factory Packs
  and Live Recordings. The playbook's Ableton route applies: official
  surfaces first (Live Object Model, MIDI Remote Scripts, Max for Live,
  device archives), binary depth after. Version pinned 12.0.25.
- **The instrument already has a commissioned definition.** QL-MEF #281 /
  `M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md`: one causal construction —
  **M1** harmonic/topological constitution and oscillator excitation (the
  source; owner ruling D13: M1 *is* the oscillator source, M2 pitch
  structures are tuning/modulation targets over that source, never a
  second generator); **M2** MEF/Vimarśā reading, tuning, modulation,
  spectral/material conditions (writes the shared `audio_octet[8]` +
  `nodal_quartet[4]`); **M3** source-defined forms, glyph/body geometry,
  articulation and score; **M4** situated world/body, receiving
  configuration and participation. Sound and visible form are projections
  of the same evolving state. Owner-named physical precedents: **Sound
  Particles, Tech Audio Shrapnel, Physical Audio Tetrad, Anukari** — the
  owner's parallel particle/physics sound-generation recon thread.
- **The computation bodies are fixed by contract.** C canonical
  structural/numerical identities; Rust typed domain composition, Actions,
  providers, provenance; C++ the continuous modal/audio body; the GPU
  engine its actual responsibilities. "Extend and measure these bodies. Do
  not replace their ownership with a new framework merely because an
  external synth uses one."
- **M4′/M5′ embodiment is owner-amended law** (L5 lock §11a,
  2026-09-19): M4′ is the general Expressions application body with the
  operative M1–M2–M3 backend; M5′ is the *same application* in M5/M0
  deep-working mode; the professional lenses (Canvas, Timeline, Journey,
  Places, Palace, Project/Wiki/Graph — the future M5-0′…M5-5′) are
  narrower projections, not the whole of either coordinate. **No rename
  was performed by that amendment** — the owner's 2026-10-07 direction to
  rename them M5-0′…M5-5′ is a new ruling awaiting adoption (below, D-F).
- **The cradle kernel is shell-agnostic by law.** Typed `KernelOp` in,
  receipts out, generation-qualified event log; a dev HTTP bridge exists
  (`kernel/src/bin/walk-bridge.rs`, `POST /op`). A Live-side client can
  bind to the same kernel without forking semantics.
- **Live's own grammar already embodies the one-field identity law:**
  Session/Arrangement/Clip/Device are different readings of the same
  material with identity preserved across the switch.
- **NOW/DAY today:** horizon law only — timezone, day boundary, ordered
  close. No shared sub-day temporal machinery binds sessions, runs,
  scenes and the instrument. That gap is the owner's hypothesis and this
  document's §5.
- **The instruments' target sets (lanes 1–5) are M5-layer function
  truth.** They remain valid for the deep-working mode regardless of
  shell; the M1–M3 editing needs (keyframes, transitions, transport,
  snapping — lane 3's set) now have a *second* candidate answer: Live's
  native automation/arrangement model (§3, E-targets interaction).

## 2. [converging input] The parallel threads

- **Full REA on Live 12** — will hold: .als Set internals, LOM/Remote
  Scripts reach, Max for Live capabilities and sandbox (JS, external
  objects, RNBO), Link protocol, VST3/AU hosting behaviour, UI region
  geometry. Until it lands, §3 stands on documented surfaces.
- **Particle/physics sound-generation recon** (Sound Particles, Shrapnel,
  and the resonator references Tetrad/Anukari) — is the M1–M3 physical
  modelling evidence base; converges directly into §3's M1 row.
- **The minimal 0/1/2 port with its Central mode** — the Live shell
  already running a minimal O-I arrangement; its UX findings reconcile
  §4 and §6.
- Obligation: each thread records evidence in this ground; convergence is
  by document.

## 3. The mapping — M1–M4 in Live's grammar

The corrected core. "Live time" = transport/sample clock: bars|beats,
tempo, quantisation, warp, automation lanes, follow actions.

| M coordinate | Live surface | Shape of the fit |
|---|---|---|
| **M1** — oscillator source, harmonic/topological constitution, physical excitation | **Instrument device in Live's device chain** — the C++ modal/audio body hosted as an external instrument / audio-rate object (Max for Live external, RNBO, or VST3/AU wrapper — REA decides); the Jankó controller enters as **MPE/MIDI input** (Live 12 is MPE-native) | The strongest possible fit: Live's device graph *is* an oscillator-source + processing host with sample-accurate scheduling, take recording, and plugin encapsulation. M1-as-device is the native idiom. |
| **M2** — tuning/modulation/spectral/material conditions (Vimarśā over M1's source; `audio_octet`/`nodal_quartet`) | **Modulation architecture**: device parameters on automation/envelope lanes, Max-side modulation, MIDI modifiers; Live 12's tuning/Meld-era scale machinery where applicable (REA verifies) | Strong — with one hard law carried across: **M2 modulates, it never becomes a second oscillator** (D13). In Live terms M2 is modulator devices/automation over M1's instrument, never another instrument in the chain. |
| **M3** — forms, glyph/body geometry, articulation, score | **Clips + notes (score-side) and the Expressions engine's visual body (geometry-side)**: articulation/score material in clips/arrangement; glyph/body geometry rendered by the existing GPU/C++ engine in the M4 body's view | Good split: what is temporal-musical in M3 lives in Live natively; what is visual-geometric renders in the engine view. The two stay one state (the #281 common-cause law) through the shared backend, not through timestamps. |
| **M4** — situated world/body; **the general Expressions application body** | **RULED (owner, 2026-10-07, in conversation):** the live Expressions application **remains the M4 body** — hosted inside the Live fork as the genuinely-integrated embodiment surface, not narrowed to an engine view and not replaced by Live as the body. §11a stands unamended; #281's host commission gains the Live fork as the hosting shell around the unchanged body. The owner names this body **the cymatics/physics system, musical and symbolic** — visible form as the projection of the same physical state that sounds (the #281 common-cause law is the cymatics law). Integration bar: a first-class surface of the shell (device-panel-grade hosting, transport/clock coupled through the two-clock bridge), not a bolted-on panel. | Decided. The engineering question that remains is hosting mechanics (D-H), not location. |
| **M0 + M5** (source ground; deep-working mode incl. M5-0′…M5-5′) | **Coupled views via the kernel bus** (walk-bridge / receipts), not native Live surfaces — graph/Wiki disclosure, collection management, and composition of material returned from the instrument live cradle-side, as §11a already frames the deep mode | Honest posture: the deep-working mode keeps its home and *discloses into* Live; it does not force a Wiki into a browser panel. |
| **Factory** | **Runs as arrangements; Candidates as takes (comping); trajectory as automation lanes; evidence as clip annotations; Recognition/Return as render/export with attribution (collect-all-and-save discipline)** | Strong — Factory's material is already temporal; Live makes it visible and playable. Factory's SEMANTIC depth stays Factory-owned, entering Live as read models/devices. |
| **NOW / DAY** | **NOW as playhead + scheduled launches; DAY as the Set** — the bounded whole that opens, is worked, and closes (save + collect + export; the day-close order maps onto Live's save/export hygiene); see §5's two-clock doctrine | The owner's hypothesis, made concrete. |
| **3:3 Expressions (scene sequences)** | **Clips/scenes with automation envelopes** — lane 3's editing-model targets (keyframe channels, transitions, trim/roll, nested sequences, undo receipts) partially *exist natively* in this shell; the unmet remainder (time-proportional journey strip, ref-addressed ops, kernel-expressible diffs) lands on the Expressions side as before | The Live shell *is* a partial answer to lane 3's target set — reconciled at convergence, not assumed. |

**One causal construction, preserved:** the arrows in #281's construction
(M1 ↔ M2 ↔ M3 ↔ M4, down to acoustic output and visible embodiment,
recorded performance returning under M0/M5) must survive as *typed
parameter, signal, event and state relations* in the Live host — Live's
device graph and parameter automation are the transport layer for those
relations; it is never licensed to become a second semantic owner of them.

## 4. The M0/M5 systems in the Live shell (the demoted half of revision 1)

The deep-working arrangement — graph/Wiki/graph disclosure, the future
M5-0′…M5-5′ instruments — couples into the Live shell through the kernel
bus and stays cradle-side. Where its *surfaces* project usefully onto Live
grammar, revision 1's observations still hold as projections, explicitly
secondary: Session view as a performative constellation (vs the M5-1′
free canvas, which remains a coupled surface); scenes + follow actions as
a journey analogue; the Timeline as an arrangement-adjacent reading of
`techne:time-axis/v1` (lane 2's contract). None of these are the
integration target; none should be built native in the fork. The failure
mode to avoid is the old one from either direction: features built outside
the instrument that owns them.

## 5. The two-clock doctrine

Unchanged from revision 1, now serving the instrument:

```text
CIVIL TIME (governs closure and the world)
    timezone, day boundary, rollover — the civil-time policy is untouched
    NOW/DAY closure law unchanged; a DAY still opens and closes at a
    local civil date with byte-exact snapshots and dated readings

WORK TIME (governs the material)
    sample clock, bars|beats|tempo, arrangement position, envelope time,
    follow-action sequencing — the time the instrument is played,
    composed, recorded and returned in
```

Live proves work time can be one core for many material kinds — audio,
MIDI, automation, and now M1–M3's typed signal/event relations, Factory's
runs and takes, and expression scene sequences. Civil time stays the
world's closure law; a single typed bridge maps between them (arrangement
position ↔ wall-clock origin + tempo map; dated events ride the bridge
with their civil truth carried as data). Lane 2's `techne:time-axis/v1` is
the bridge's content spec on the M5 side; the instrument needs the same
bridge for its recorded-performance history. This is the concrete form of
"the missing unified core for temporality" — and it is shell-independent:
the cradle wants it too.

## 6. The fit, scored honestly

**Where Live is right for M1–M4:**

1. It is a sample-accurate, plugin-encapsulated, MPE-native instrument
   host with recording, comping, automation and a modulation architecture
   — precisely the host class the #281 instrument needs, with decades of
   interaction polish.
2. Multi-surface identity (Session/Arrangement/Clip/Device as readings of
   one material) matches the dual-reading acceptance law natively.
3. Modularity/plugin-driven development — devices, Max for Live, RNBO,
   VST3/AU, Link, Remote Scripts — is the extension surface, already
   battle-tested.
4. The 0//1 arrangement maps to Live's Browser / main / Detail triangle —
   consistent with the 0/1/2 port's early cleanliness. **[converging
   input]**
5. The owner lives in it (verified: active User Library, Factory Packs).

**Where Live is not:**

1. The M4 body question (§3) is unresolved law, not a UI preference — and
   the Expressions GPU engine's performance inside a device/GL context is
   unproven.
2. The M1–M3 backend hosting path (external instrument vs Max/RNBO vs
   VST3/AU) is undecided and each option has real DSP/latency/packaging
   consequences — REA + a bounded audio prototype must decide (D-H).
3. M0 and the deep-working M5 mode have no native home; they couple in —
   correct per §11a's framing, but it means the shell alone is never the
   whole world.
4. Live is proprietary: "fork" can only mean (a) extension inside the
   owner's licensed copy, or (b) a clean-room rebuild of the grammar. It
   can never mean derived binaries or redistributed code.
5. A second shell splits the six products' surface accounting; without
   ledger discipline the old failure (features outside the proper app)
   returns from the other direction.

## 7. What this changes for the desktop application pass

As in revision 1, affirmed in a precise form: the desktop spec's semantic
acceptance (§17) is untouched and remains the test; what changes is the
host-grammar candidate set. The recommended posture stands — **shell
plurality over shell replacement**: the kernel stays the semantic bus; the
Tauri cradle and the Live fork are two front-ends; the Surface Ledger
gains LIVE dispositions; no second semantic store, timeline truth, scene
ontology or instrument state may grow inside the fork. The additional
consequence of the corrected frame: **QL-MEF #281's "inside the existing
Expressions application" gains a second candidate host** for the M1–M4
whole. That is an amendment to commissioned law (the #281 wayfinder and
L5 §11a), which only the owner can make — proposed as D-G, not self-adopted.

## 8. Decision points (owner)

- **D-A · What "fork" means.** (1) extension inside licensed Live (Max
  for Live / RNBO / Remote Scripts / Link), (2) clean-room rebuild of the
  grammar, (3) **staged (recommended)**: extend first in Live 12.0.25;
  REA evidence and the port decide whether a rebuild is ever commissioned.
- **D-B · The temporal bridge.** Commission the two-clock doctrine as an
  owner-facing contract; lane 2's time-model is the M5-side content spec;
  the instrument's recorded-performance history needs the same bridge.
- **D-C · Shell plurality.** Confirm the kernel-bus law: the Live shell is
  a front-end, never a second semantic owner; desktop pass continues on
  its spec; Surface Ledger gains LIVE dispositions.
- **D-E · M0/M5 posture.** Deep-working mode and source ground stay
  cradle-side, coupling via the kernel bus; no native Wiki/browser
  rebuilds inside the fork.
- **D-F · Naming.** **RULED (owner, 2026-10-07):** drop the "M" prefix for
  the technē instruments entirely — no M5-0′…M5-5′ either; name them by
  their plain actual names (project/graph, canvas, timeline, journey,
  places, palace) in documents and, at the harmonisation-phase rename, in
  code. The deep mode is "the techne mode" / "the deep mode".
- **D-G · The M4 body.** **RULED (owner, 2026-10-07):** the live
  Expressions application remains the M4 body, genuinely integrated into
  the Live fork as the cymatics/physics embodiment surface (musical and
  symbolic form of one physical state). §11a unamended; #281's host gains
  the Live fork as its hosting shell. See §3's M4 row for the integration
  bar.
- **D-H · Where the M1–M3 backend runs.** External instrument (C++ audio
  body as plugin), Max for Live/RNBO hosting, or staged both — decided by
  the REA thread plus one bounded audio prototype through Live's real
  device graph.

## 9. What must be verified before any of this hardens

Named, not hidden — owned by the converging threads:

1. Max for Live / RNBO hosting paths and limits for the C++ modal body
   (external objects, sample-rate/scheduling behaviour, parameter
   automation into `audio_octet`/`nodal_quartet`) — REA + D-H prototype.
2. Live 12 MPE/tuning specifics against the Jankó mapping and M2's
   twelve-position substrate — REA.
3. Expressions GPU engine performance inside a device/GL context — port
   thread + a bounded render probe.
4. .als Set internals and save/export hygiene as the DAY-incarnation
   candidate — REA, then a data-saving contract in the obsidian-re A1
   pattern.
5. The 0/1/2 port's actual state and Central-mode UX findings — port
   thread.
6. Lane 3's editing-model target set vs Live's native automation/clip
   model: an exact coverage map (what the shell answers natively, what
   remains Expressions-side) — convergence of lane 3 + REA.
7. Sound-generation recon × M1 physical modelling (Sound Particles /
   Shrapnel / Tetrad / Anukari documented and observable operations) —
   the sound thread, feeding D-H.

## 10. The one-paragraph answer

The Ableton fork is the right shell question to ask about the *right*
object: the M1–M2–M3–M4 physical instrument — oscillator-source excitation,
tuning/modulation over that source, forms/articulation/score, and the
Expressions application as the M4 body — which Live hosts almost natively
(device graph, MPE, modulation, comping, arrangement), while the M0 ground
and the M5 deep-working mode (the instruments now to be named M5-0′…M5-5′)
couple in through the kernel bus as disclosure, not natives. Two things
keep the experiment honest: the two-clock doctrine (civil time keeps
NOW/DAY; one work-time core; one typed bridge), and the kernel-bus law (no
second semantic owner grows inside the fork). One thing only the owner can
decide moves law: whether M4's body becomes Live-hosted (amending L5 §11a
and #281's host commission) — framed as D-G, with the hosting path for the
C++ audio body (D-H) as its technical companion. Shell plurality now,
replacement only if the fork's evidence earns it.
