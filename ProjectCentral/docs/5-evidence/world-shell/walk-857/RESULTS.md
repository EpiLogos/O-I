# Walk #857: the instrument, walked by its separate verifier

Round 44 of lane BB, 7 November 2026. Base C86 `f566b1d0`. #857 is the frontier (DLW build ruling 2026-11-07). Lane BB did not build
the instrument, so it walks it as its separate verifier.

## What was walked, and how

- **Stories.** 83 stories, from manual §21.1, §21.2, §20.2 and §20.14: the LT, LB, LM, LV, LN, LR, LK, LF, XR, XF and XA families.
  - Grades are cell 5: 70 M, 11 P, 2 H.
  - Grade law (#715): P means the effect runs through its real owning product; M means files, machines or sound are involved; H is the owner's.
- **Worlds.** Two fresh scratch worlds, each made by `packages/live-shell/starting-worlds.py` under the lane's scratch folder.
  - **Bare (a)** walked the [Bare] stories. **Arriving (b)** walked [Arriving], and [Lived-in] by building forward from Arriving.
  - Setup was done through the real UI in both worlds: Ground, then Machines.
  - The walked Arriving world is kept as a Lived-in snapshot (`starting-worlds.py keep Arriving`).
- **Stack.** Each world ran its own walk-bridge (the kernel built from C86), live-shell and AIKit encounter owner.
  - HOME was the world's folder, as `world_folder.rs` sets it.
  - The shared field was a local scratch SpacetimeDB only.
  - The installed QL field host and worker rendered the torus.
- **Sound, strictly.**
  - No output device was ever opened. The walker removes each page's `AudioContext` before load and puts a paced `OfflineAudioContext` with a meter in its place. Media play, `getUserMedia` and MIDI are refused.
  - Sound is proven by that meter offline and by live-engine's own offline tests. Real Live (Ableton) was never driven.
- **Readback.** Every effect is read back from the product that owns it:
  - QL: its field-host receipts (`ql.strike-at/v1`, `ql.field-host-receipt/v1`, torus-set and damping answers).
  - live-set, through the kernel: `live_set_read`, `live_clip_read`, `live_track_mixer_*`.
  - live-engine: its offline tests.
  - Expressions: what its frame announces and the native commands it sends.
- **Receipts** are in `receipts/`.
  - Owner ops logs too large to keep whole are kept as `*.digest.json`: each command, the schemas its answer names, and its receipt or refusal.
  - There are no screenshots, and nothing of Yours.

## Results

Standing:
- **holds**: walked; the owner read back the effect the story asks for.
- **fixed**: a gap found and fixed this round, red first, then walked again.
- **partial**: some of the story holds; the rest is a named gap.
- **gap**: walked; the story does not hold.
- **blocked**: the story cannot be reached past a named gap.
- **not walked**: not reached this round (budget); nothing is claimed.
- **H (owner's)**: listed, not graded.

| Story | Grade | Start | Standing | Readback | Gap / ticket |
|---|---|---|---|---|---|
| LT01 | H (core) | Bare | H (owner's) | The surface plays (receipts LT01-a.digest). | Owner's ear |
| LT02 | M | Bare | holds | Touch → `strike-at` → QL `ql.strike-at/v1` receipt (`at_samples_elapsed`, law). Offline meter rms 8e-6 → 1e-3, peak 0.014. | #771 |
| LT03 | M | Bare | holds (pop-out) | Focused keyboard: a → row 1 col 42, `torus-play`/`torus-release`. Meter about 1e-3. | G4 for Torus Full in the pane; #853 |
| LT04 | M | Lived-in | not reached | "MIDI input refused: this window is not the native O:I host." | Native host only: #853, #821 |
| LT05 | M | Bare | holds | The Piano layout plays (`torus-play`). | #853 |
| LT06 | M | Lived-in | partial | Transpose works. No Range (2–8 octaves) control. | #853 |
| LT07 | M | Lived-in | holds | Fixed velocity sends 0.35; pointer height varies the amplitude. | #853 |
| LT08 | M | Lived-in | holds | Sustain holds each release until Sustain is off. | #853 |
| LT09 | M | Bare | holds | `torus-set` polyphony; Panic sends one release of every key. | #853 |
| LT10 | M | Lived-in | blocked | Torus Full in the pane hides the frame. Keys are refused: "domain operation requires idle admitted owner". | G4: #851, #853 |
| LT12 | M | Lived-in | not walked | — | #856 |
| LT13 | P | Lived-in | not walked | — | #771 |
| LB01 | M | Lived-in | gap (story) | Pulse mix is retired in §21.2, so the story names a parameter the manual no longer has. | Doc consistency: coordinator |
| LB02 | M | Lived-in | holds | Carrier → `torus-set {carrier}`; QL answers. (Helix balance and Drive are retired, as in LB01.) | #850 |
| LB03 | M | Lived-in | partial | Damping reads "No reading from the owner yet" until a body or Tattva is set; then `set-damping` 475/s. | #850 |
| LB04 | M | Lived-in | holds | Strike → `torus-set {strike}`. Modes show only for a form. | #850 |
| LB05 | M | Lived-in | holds | Tattva → `set-damping` 475/s, Strike 45 %, Damping 12, each read back. | #850, #854 |
| LB06 | M | Lived-in | partial | Level is frame-local. Pan says "No pan: the native field announces only…". | #850, #849 |
| LB07 | M | Lived-in | gap | The kernel seals `torus_sound`, but Scene keep is refused: "No native Scene is presented; open one before a performance action." A sound cannot be kept from Live with no Expression open. | #852 |
| LB09 | P | Lived-in | not walked | — | #850 (Body source) |
| LB10 | M | Lived-in | not walked | — | #854 |
| LB11 | P | Lived-in | not walked | — | #850 |
| LB12 | P | Lived-in | not walked | — | #850 |
| LB13 | P | Lived-in | not walked | — | #850 |
| LM01 | M | Bare | partial (walked from Arriving) | Root, then Scale mode (87 on a root: lens/CF modes on both bases, and maqāms). "Mode in force — ionian on L1 … pitch class 2 · held for this session (the set has no owner write for a mode yet)." No owner keeps it. | #854 |
| LM02 | M | Lived-in | gap | The owner refused: "the clip carries no IsInKey in the document" / "no scale". | G6: #790 |
| LM03 | M | Lived-in | not walked | Maqāms are offered as the mode in force. Playing a phrase was not walked. | #854 |
| LM06 | M | Lived-in | partial | Fifths-basis modes are offered ("ionian on L0, fifths basis"). Addressing the surface in fifths was not walked. | #854, #853 |
| LM07 | P | Lived-in | fixed → holds | Highlight Scale marks the 4 rows of D Ionian in force; Fold to Scale keeps 4 rows. Before the fix: 0 marked, 1 row. | G7 |
| LM08 | P | Lived-in | holds | Overlay Mode / Direct / Partition / Pair family / Completion / Basis recolours the key column. | — |
| LM09 | M | Lived-in | blocked | Fit to Scale is disabled: "The clip has no mode of its own." | G6: #790 |
| LN01 | M | Lived-in | fixed → holds | Inserted (unnamed) clip opens in Clip view; key column Jankó (a/b rows) ↔ Piano. | G5 |
| LN02 | M | Lived-in | gap | The roll draws no notes ("Press a note to select it"). Record is disabled in Session view: "The torus is not open, so there is nothing to record." | #790, #855; G4 |
| LN03 | P | Lived-in | partial | Start, End, Length and Loop are written and read back. Signature is dark. Quick arrow steps on a clip box can repeat a step (O4). | G6: #790 |
| LN04 | M | Lived-in | holds | Duplicate: length 4.75 → 9.5, notes 4 → 8 (owner read). | — |
| LN05 | M | Lived-in | holds | ×2, /2, Set Length, Reverse (twice gives the original), Humanize, Invert and Add Interval write; the owner reads the notes back. | Fit to Scale: G6 |
| LN06 | M | Lived-in | partial | Quantize, Span and Strum write. Arpeggiate, Connect, Ornament, Recombine and Time Warp are refused: "not written by the shell yet". | #790 |
| LN07 | M | Lived-in | partial | Rhythm writes 4 notes (owner read). Seed, Shape and Stacks are refused: "not written by the shell yet". | #790 |
| LN08 | M | Lived-in | gap | The MPE tab draws Slide (dim), Pressure and Bend. Expression is only recorded from the surface under Record, which is blocked (G4); nothing draws it by hand. | #853, #855 |
| LN09 | M | Lived-in | fixed → holds (owner) | Before G9: "The set has no Mixer Volume to move". After G9, the owner keeps a Mixer Volume envelope (points [[0,0.5],[2,1]], target 121). A Torus envelope is refused: "a clip envelope of it has no owner in the .als document". | G9; Torus lanes: #850, #855 |
| LN10 | M | Lived-in | not walked | — | #849, #790 |
| LN11 | M | Lived-in | not walked | — | #849, #790 |
| LN12 | M | Lived-in | not walked | — | #849, #790 |
| LN13 | M | Lived-in | not walked | — | #849, #790 |
| LN15 | P | Lived-in | fixed → holds | Rename "Tide 1", colour 12 → 9, Switch off; ⌘Z undoes each in turn (owner read). | G8 |
| LR01 | M | Lived-in | blocked | Arm is written and read back. Record is disabled in Session view (G4). | G4: #855, #851 |
| LR02 | M | Lived-in | not walked | — | #855 |
| LR03 | M | Lived-in | not walked | — | #855 |
| LR04 | H (core) | Lived-in | H (owner's) | — | Owner's ear |
| LR05 | M | Lived-in | partial | The automation Arm is enabled. Recording moves into lanes was not walked. | #855 |
| LR12 | M | Arriving | not reached | The audio interface is native only; the walker opens no input device. | #849, #821 |
| LK10 | M | Lived-in | not walked | — | #771 |
| LF07 | M | Lived-in | engine offline | live-engine offline render tests pass (below). Export Audio from the shell is the native candidate's. | #849 |
| LV01 | M | Bare | gap | Bare has no set and no way to make one: "No set stands in your Music folder or Live's places" (`set_from_template` needs a template). The torus plays without a set. | #849, #738 |
| LV02 | M | Bare | differs | There is no Torus to drag in the browser's Instruments. The torus is the one instrument and stands on every chain. | #851 |
| LV03 | M | Lived-in | not walked | — | #849 |
| LV04 | P | Lived-in | holds | ⌘G → `live_set_act tracks_group` → "Grouped Market hall in 2-Group." (Shift did not extend the selection, so one part was grouped.) | — |
| LV05 | M | Lived-in | fixed → holds | Solo, Activator off, Volume and Pan are written and read back; quick Volume steps all land. "While the piece plays" was not reached (G4). | G9, G10 |
| LV06 | M | Lived-in | gap | The made set has no return track to send to. | #738, #849 |
| LV07 | M | Lived-in | holds (owner) | Arm true; Monitor auto → off (owner read). Hearing the chain was not proven (engine). | #849 |
| LV09 | M | Lived-in | blocked | Launch in Session view sends no native command; the field is "Held — host surface hidden". | G4: #790, #851 |
| LV10 | M | Lived-in | blocked | Stop All sends nothing, since nothing plays. | G4 |
| LV11 | M | Lived-in | blocked | Follow actions (Action A/B, Chance) are dark: the clip carries none. | G6: #790 |
| LV12 | M | Lived-in | blocked | The owner refused: "the clip carries no LaunchMode / LaunchQuantisation in the document". | G6: #790 |
| LV13 | M | Bare | gap | Tempo is read-only. Tap, Metronome, Overdub, Loop, Punch, Capture, Draw, Keys and Follow say "Not wired here yet". Quantize has no set value. | #849, #790 |
| XA10 | M | Lived-in | not walked | — | #851 |
| XF01 | M | Bare | partial | New Expression opens. Play scenes is disabled: "No authored native Scene material is disclosed". The pointer stir reaches the field (`strike-at`); the frame's meter stays silent. | BA write-up below |
| XF02–XF07, XF12 | M | Lived-in | not walked | — | — |
| XR01–XR08 | M | Lived-in | not walked (XR02/XR04 reached) | Cymatic Plate opens. Its resonator sends `torus-set` rate sweeping 80 → 101 steps/s to QL. Meters are silent. Not graded. | — |
| XR09 | P | Lived-in | not walked | — | — |

## Gaps

Each gap: what I did, what I read back, what was wrong, and its ticket.

- **G1 (fixed, red first). #851.**
  - Did: opened Live in Pane view.
  - Read back: the frame said "Native QL host channel unavailable", and the torus never opened.
  - Wrong: the Live entry made its one attempt before the host had answered the native channel.
  - Fix: `liveEntry.mjs` waits for `hostAnswered`; `channel.ts` gains `answered`; `nativeField.ts` wires them.
- **G2 (open). #851 or the kernel.**
  - Did: closed or reloaded a window.
  - Read back: the next window was refused with `native-expression.owner_busy`.
  - Wrong: the kernel's native driver stays owned (`Manager.active`, `native_expression.rs:2880`).
  - Needs a decision on lease liveness or a TTL. The walk restarted the world's kernel for each new window.
- **G3 (fixed). #850, #854.**
  - Did: turned Sound on.
  - Read back: every Torus control read "no reading", with "parameters.torus.material: expected its standing and law".
  - Wrong: the boundary bounded the material standing at 64 characters. QL's `MATERIAL_STANDING` is about 120.
  - Fix: bounded at 512, as the maqām's standing is.
- **G4 (open). #851, #849, #853, #790.**
  - Did: left Pane view (Session view, or Torus Full in the pane).
  - Read back: "Held — host surface hidden. Resume field to continue."
    - Keys, strikes and clip play are refused or never sent.
    - Coming back to Pane view does not resume.
    - Resume is concealed in the Live cut.
    - Later in Session view: "audio receiver disposed", then "cannot reconcile an unknown or in-flight native operation".
  - Blocks LT10, LV09, LV10, LR01, LN02 recording, LN08 and XA10. The instrument has to sound while its frame is not on screen.
- **G5 (fixed). #790.**
  - Did: Insert clip on Tide pad.
  - Read back: the owner holds `<MidiClip><Name Value=""/>`, but Clip view said "Select a clip…".
  - Wrong: `liveClipOf` treated `""` as no clip. The status line's "0 clips" counts arrangement clips only (O3).
- **G6 (open, not bounded). #790, live-set.**
  - A clip made in a set that holds no MIDI clip uses `crafted_clip` (live-set `acts.rs:423`), which carries no TimeSignature, IsInKey/scale, LaunchMode, LaunchQuantisation or follow actions.
  - So Signature, the clip's own mode, Fit to Scale, Launch and Follow are dark or refused in the owner's words.
  - The fix must add Live's own element shapes, which need a check against Live's loader (session-model.md §7). That cannot be done here, because real Live is never driven.
- **G7 (fixed). #790.**
  - Did: Highlight Scale and Fold to Scale with a mode in force.
  - Read back: 0 rows marked and 1 row kept.
  - Wrong: the roll (`clips/live.tsx` `modeOf`) followed the set's mode only for Scale Off, never for a clip that discloses no scale.
- **G8 (fixed). #790.**
  - Did: Rename, Switch off and a colour from the grid's clip menu.
  - Read back: "Clip view did not come to hold the clip", though Clip view held it.
  - Wrong: Live's clip binding named neither the grid's clip id nor itself as that clip (`objectDoor.ts` `bindsClip`).
- **G9 (fixed). #738.**
  - Did: mixer, arm, monitor and an envelope from Arriving.
  - Read back: "The set has no Mixer Volume to move", and so on.
  - Wrong: the made Arriving set's parts had no Mixer and no MainSequencer.
  - Fix: `starting-worlds.py` `ableton_set` gives each part its mixer and recorder, in the owner's own fixture shape. Proved with the real owner (receipt G9-probe-owner-writes): volume, pan, arm, monitor, solo, activator, clip, envelope.
- **G10 (fixed). #849 (Live writes).**
  - Did: three quick Volume steps.
  - Read back: the second and third were refused: "The set changed since it was read".
  - Wrong: each write was sent on the standing revision while the one before it was in flight.
  - Fix: writes to one set now go one after another (`liveWrites.ts` `onRevision`). Walked again: all three landed.
- **Observations.**
  - O1: with Sound off, every Torus session control is dark (#850).
  - O2: LT06 has no Range control (#853).
  - O3: the status line's "N clips" counts arrangement clips only.
  - O4: quick steps on a clip value box can repeat a value while a write is in flight. All steps land, but one is lost.
  - O5: the transport's scale list is per root, so changing the root after the mode drops the mode.

## Written up for BA (Expressions; unedited)

- **XF01.** A New Expression ("An empty work: one Scene, nothing placed") cannot be played.
  - Play scenes is disabled: "No authored native Scene material is disclosed". Stop is disabled: "This Scene has no authored working duration to stop."
  - The story asks to open an Expression, press Play and stir. The stir reached the field (`strike-at`), but Play cannot be pressed.
  - Belongs to Expressions' scenes (BA's r892 zone).
- **XR (Cymatic Plate).** Opening the template makes the frame sweep `torus-set` rate (80 → 101 steps/s) through QL, while the frame's offline meter stays at rms 0 with the field unmuted (`advance … muted:false`). Whether the plate's field reaches the frame's audio output in a hosted window needs BA's reading.

## For #821 (only the screen can show)

- Each key with several fingers (multi-touch).
- Where I touch, drawn on the surface.
- WebKit drawing of the pane.
- A MIDI controller (LT04) and an audio interface (LR12) on the native host.
- Camera as listener (LT12).
- The owner's ear rows: LT01 and LR04.

## Engine, offline

`packages/live-engine`, `cargo test --features k8 --release` (no `realtime`, QL K8 against the installed QL prefix, isolated HOME), all passing:

| Suite | Passed |
|---|---|
| lib | 56 |
| k8_instrument | 26 |
| k8_no_alloc | 1 |
| m1_gate | 9 |
| mixer_gate | 1 |
| parts_engine | 62 |
| realtime_no_alloc | 1 |

The 6 ignored tests (m3 3, midi 1, mixer 2) are corpus-gated and were not run. Under load, the key-to-sound spin can outlast a 256-frame block, and the engine then saturates `reached_frame` at 0 (L87). It did not show here.
