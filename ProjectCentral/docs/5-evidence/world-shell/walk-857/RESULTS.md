# Walk #857: the instrument, walked by its separate verifier

Round 44 of lane BB, 7 November 2026. Base C86 `f566b1d0`. #857 is the frontier (DLW build ruling 2026-11-07). Lane BB did not build
the instrument, so it walks it as its separate verifier.

Round 45, the same day, on C88 `5b3976ed`: G2, G4, G6 and LN02 are fixed red first (DLW build ruling 2026-11-07, rulings 1 to 3 and
5), and the stories G4 held are walked again, with LB09–LB13, LN10–LN13, LV03, LR02, LR03, LK10, LT12, LT13 and LM03. The r45 walk
used r44's worlds walked forward (Arriving as the kept Lived-in), a stack built from the lane tree on C88, and the same no-device
walker with a 600-second offline context per page. Rows changed in r45 say so; their receipts are `receipts/r45-*`.

Later in r45 the lane was rebased onto L89 `d1900f53` (C89 `62772d7a`, BA's r893, then the lead's gate entries, on main `b90d9093a`).
G4 then took C89's finding (the clock split from the draw), and the rows from there on were walked in Chromium on ANGLE Metal, not
SwiftShader (DLW build ruling 2026-11-07; CI keeps software GL).

Round 46, 8 November 2026, on C90 `e1b66b8a` (DLW build ruling 2026-11-08). G12, G13 and G14 are built red first, with LV01, LT06's Range
(O2), LV06's return and O7. The walk used r44's Arriving walked forward, a stack built from the lane tree on C90, and the same
no-device walker; it walked LN10–LN13 and LV06 again, reached XF and XR, and found G17 and G18. Rows changed in r46 say so; their
receipts are `receipts/r46-*`.

Round 47, 9 November 2026, on main `6b21c0d5` (DLW build ruling 2026-11-09). G17 (the Sample tab), G18 (Output), the empty-slot
choice and O8 are built red first, with Setup's Music folder (round 47 item 1). The walk used r44's Arriving walked forward and r44's
Bare, a stack built from the lane tree on `6b21c0d5` with ctrl built from the lane's central-47 (by its path, never installed), and
the same no-device walker. It walked LN10–LN13, LV06's Output and Setup's Ground step in both worlds, and found three faults, each
fixed red first and walked again (LN11's key steps, the clip read out of order, and Setup's register on Bare). Rows changed in r47
say so; their receipts are `receipts/r47-*`.

Round 52, 9 November 2026, on main `4f6ac28d` (DLW build ruling 2026-11-09, 48d item 4). Nothing is built this round. It walks the
rows earlier rounds left not walked: LT13, LK10, XA10, XR09, and XF08–XF11, which had no rows. The walk used r44's Arriving walked
forward, never Yours. Its stack was walk-bridge and live-shell built from main `4f6ac28d` alone (none of the lane's patches), with
ctrl built from Central `8bc225b` (central-47i changes tests only; by its path, never installed), a local scratch SpacetimeDB, and the
same no-device walker. It found the surface's one look (G19), LK10's missing identity (G20), strikes reaching the owner late on the
walk stack (O11), four gaps in the Studio's macros and the tab's double-click (written up for BA below). Rows changed in r52 say
so; their receipts are `receipts/r52-*`.

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
| LT10 | M | Lived-in | fixed (G4) | r45: the tile's ⤢ opens Torus Full in the pane, which hides the frame (0×0); a key still strikes (`torus-play`, `torus-release`) and the meter rises from rms 1e-23 to 1.3e-3, peak 0.016. Back in Pane view the frame reads "Live · sound on" (receipt r45-G4-b-03-LT10). | G4: #851, #853 |
| LT12 | M | Lived-in | partial | r45: View Wire is set; Receiver On sends `torus-receiver` with the camera's place (`at_metres`) (r45-LB-LT12-b). Moving the camera and hearing it move is #821's. | #856, #821 |
| LT13 | P | Lived-in | gap | r45: no control or mark on the surface was found by title that says whether a point was struck, previewed or walked. r52: a key the hand holds lights every key of its pitch class, 15 over five octaves, by their pressed state alone (accent border, text colour), not the point struck. A♯ held lit all 15 A♯ keys from 150 ms to 1950 ms, and none 250 ms after release (r52-LT13-b-01-direct, -b-03-direct). The clip player's strikes are not drawn: row 1's launch sent 16 `torus-play`/`torus-release` at its samples (row 1, column 30), and no key lit in 8 s (r52-LT13-b-02-row). Nothing previews a route or plays a generated walk: no control or mark is titled for either. | G19 below; #771 |
| LB01 | M | Lived-in | fixed (story) | r45: the row now names Rate and Carrier, from §21.2 (Pulse mix retired), and its readback is the two readings beating; the capability matrix is derived again. Not walked by ear. | Doc consistency |
| LB02 | M | Lived-in | holds | Carrier → `torus-set {carrier}`; QL answers. (Helix balance and Drive are retired, as in LB01.) | #850 |
| LB03 | M | Lived-in | partial | Damping reads "No reading from the owner yet" until a body or Tattva is set; then `set-damping` 475/s. | #850 |
| LB04 | M | Lived-in | holds | Strike → `torus-set {strike}`. Modes show only for a form. | #850 |
| LB05 | M | Lived-in | holds | Tattva → `set-damping` 475/s, Strike 45 %, Damping 12, each read back. | #850, #854 |
| LB06 | M | Lived-in | partial | Level is frame-local. Pan says "No pan: the native field announces only…". | #850, #849 |
| LB07 | M | Lived-in | gap | The kernel seals `torus_sound`, but Scene keep is refused: "No native Scene is presented; open one before a performance action." A sound cannot be kept from Live with no Expression open. | #852 |
| LB09 | P | Lived-in | partial | r45, after G11: the Stage page reads QL's slots (Damping "first-vertical r1", 1/4 owned). Evaluate is applied: `stage-evaluate`, then `stage-state` read back (r45-G11-b-02). The one procedure the native field offers is the Studio's `ta-onta:studio:first-vertical` (on damping), not a fold the story plays. Before G11, every act was dark. | G11 fixed; #850 |
| LB10 | M | Lived-in | blocked | r45: Bind is dark in the procedure's own words: "It runs when you evaluate it, so it binds to nothing". Its trigger is invocation, the failure the story names, and no procedure with a flow trigger is offered. | G16 below; #854 |
| LB11 | P | Lived-in | blocked | r45: Unbind is dark: "The procedure is not bound" (nothing can be bound, LB10). | G16; #850 |
| LB12 | P | Lived-in | fixed → holds | r45: Retire is applied: `stage-retire`, retired `ta-onta:studio:first-vertical@1/material.damping`, 0/4 owned, and Damping is authored again. Retired again: applied (r45-G11-b-02). | LB12 below; #850 |
| LB13 | P | Lived-in | partial | r45: a freed slot is owned again by the next Evaluate (applied), and the procedure evaluating a slot it holds is applied. A clash between two procedures was not reachable: one procedure is offered. | G16; #850 |
| LM01 | M | Bare | partial (walked from Arriving) | Root, then Scale mode (87 on a root: lens/CF modes on both bases, and maqāms). "Mode in force — ionian on L1 … pitch class 2 · held for this session (the set has no owner write for a mode yet)." No owner keeps it. | #854 |
| LM02 | M | Lived-in | partial | r45, on a take laid this round: ♭♯ gives the clip its own mode (`scale: true` read back), Root D written and read back (r45-G6-b-05, r45-G6-b-06). Playing the next phrase in it was not walked. | G6 fixed: #790 |
| LM03 | M | Lived-in | partial | r45: Maqam 0 is chosen as the mode in force and read back with QL's `maqam_pitches` and a quarter-tone tuning; a phrase of three keys strikes (`torus-play`), meter rms 0.0046, peak 0.037 (r45-LM03-b-maqam-phrase). The Torus's tuning stays `logic`, so each key sounds the sky's voice nearest its chromatic class, not the maqām's own intervals. QL's Torus has a `maqam` tuning (`torus-set`) that the mode in force does not set. | #854 |
| LM06 | M | Lived-in | partial | Fifths-basis modes are offered ("ionian on L0, fifths basis"). Addressing the surface in fifths was not walked. | #854, #853 |
| LM07 | P | Lived-in | fixed → holds | Highlight Scale marks the 4 rows of D Ionian in force; Fold to Scale keeps 4 rows. Before the fix: 0 marked, 1 row. | G7 |
| LM08 | P | Lived-in | holds | Overlay Mode / Direct / Partition / Pair family / Completion / Basis recolours the key column. | — |
| LM09 | M | Lived-in | fixed (G6) | r45: Fit to Scale is live; in D Ionian it moved F (65) to E (64), read back (r45-G6-b-06). | G6: #790 |
| LN01 | M | Lived-in | fixed → holds | Inserted (unnamed) clip opens in Clip view; key column Jankó (a/b rows) ↔ Piano. | G5 |
| LN02 | M | Lived-in | fixed (draw); partial (record) | r45: a double-click on an empty row drew A♯3 at beat 1.5, one 1/16 step long (`live_clip_write`, 4 notes, read back); a double-click on it removed it (3 notes) (r45-LN02-b-draw). With the clip open, Record records into Arrangement view as a take (Take 2 at beat 16, Take 3 at beat 36): no act records into the open clip itself. A note's chance was said as "chance 1 %": fixed. | G13 below; #790, #855 |
| LN03 | P | Lived-in | fixed (G6, O4) | r45: Signature 4/4 → 3/4 written and read back (`sig.num` 3), beside Start, End, Length and Loop. O4 fixed. | G6: #790 |
| LN04 | M | Lived-in | holds | Duplicate: length 4.75 → 9.5, notes 4 → 8 (owner read). | — |
| LN05 | M | Lived-in | holds | ×2, /2, Set Length, Reverse (twice gives the original), Humanize, Invert and Add Interval write; the owner reads the notes back. | Fit to Scale: G6 |
| LN06 | M | Lived-in | partial | Quantize, Span and Strum write. Arpeggiate, Connect, Ornament, Recombine and Time Warp are refused: "not written by the shell yet". | #790 |
| LN07 | M | Lived-in | partial | Rhythm writes 4 notes (owner read). Seed, Shape and Stacks are refused: "not written by the shell yet". | #790 |
| LN08 | M | Lived-in | holds | r45: a pen press with rising force, under Record, laid a note carrying `mpe.pressure` (8 points); its Clip view MPE tab draws it on the Pressure lane, Slide dim (r45-LN08-b-pressure-take-short, r45-LN08-b-mpe-tab). In the walk the press must sit inside one 8,192-sample block of the owner's clock, which runs slower than the hand here; see Walker notes. | #853, #855 |
| LN09 | M | Lived-in | fixed → holds (owner) | Before G9: "The set has no Mixer Volume to move". After G9, the owner keeps a Mixer Volume envelope (points [[0,0.5],[2,1]], target 121). A Torus envelope is refused: "a clip envelope of it has no owner in the .als document". | G9; Torus lanes: #850, #855 |
| LN10 | M | Lived-in | partial | r46 (G14 built): Samples lists the world's Music-folder files; double-click on Estuary (head chosen) made `estuary-low-tide` an audio clip in row 1, read back from live-set (`kind: audio`, 2 s unwarped). Clip view offers no Sample tab. r47 (G17 built): an audio clip's Clip view has a Sample tab (r47-LN10-b-02). On a clip made this round in Arrangement view ("Made estuary-low-tide an audio clip on Estuary from beat 0", r47-LN10-b-05), Warp on is written and read back, and the markers turn from seconds to beats (End 2 s → 3.07 beats at 92 BPM); Warp mode Beats → Complex is written and read back (r47-LN10-b-06, r47-LN11-b-07). On the clip r46 made, the mode is refused in the owner's words: "the clip carries no WarpMode in the document" (r47-LN10-b-04). BPM, /2 and ×2 are not offered. Not heard: the walk stack has no engine. | G17 below; #849, #790 |
| LN11 | M | Lived-in | partial | r46: no Reverse, Fade, RAM, HiQ, Gain or Pitch on Clip view. r47: on the Arrangement clip, Fade in and Fade out are written in ms while unwarped and read back in beats once warped (3 ms → 0.0046 beats); Gain, Transpose and Detune are written and read back (r47-LN11-b-07). Quick key steps lost steps: fixed, red first, and walked again: six Gain steps +1.6 → +2.2 dB, five Detune steps −4 → −9 ct, each read back (r47-LN11-b-08, -09). Reverse, RAM and HiQ are not offered. | G17; LN11-a below; #849, #790 |
| LN12 | M | Lived-in | gap | r46, r47: no transients or warp markers to move, and no Quantize for an audio clip (r47-LN12-13-b-10). | G17; #849, #790 |
| LN13 | M | Lived-in | gap | r46: Envelopes offers Mixer (Track Volume, Track Panning, A-Reverb) and the Torus's, not the clip's own Gain, Transposition or Sample Offset; it shows an Automation / Modulation switch, which the story says these have not. r47: the same on the Arrangement audio clip: Torus, Scale mapping and Mixer, and the switch (r47-LN12-13-b-10). | G17; #849, #790 |
| LN15 | P | Lived-in | fixed → holds | Rename "Tide 1", colour 12 → 9, Switch off; ⌘Z undoes each in turn (owner read). | G8 |
| LR01 | M | Lived-in | fixed | r45, Session view: Record into the row-2 slot of the armed Tide pad, played in the Torus's pop-out window: `take_record` → `live_set_acted`, 3 notes, the part keeps the Torus (`torus_keep`) (r45-G4-b-06-LR01). Two notes were laid 0 beats long, and a page opened again named its take Take 1 beside another: fixed (LR01-a, LR01-b below). | G4: #855, #851 |
| LR02 | M | Lived-in | blocked | r45: Overdub is dark: "Not wired here yet: The audio engine's transport is read-only until its owner lands; the field holds its place." Record itself lays notes along the ruler as takes (LN02). | #855 |
| LR03 | M | Lived-in | blocked | r45: Capture is dark in the same words as Overdub. | #855 |
| LR04 | H (core) | Lived-in | H (owner's) | — | Owner's ear |
| LR05 | M | Lived-in | partial | The automation Arm is enabled. Recording moves into lanes was not walked. | #855 |
| LR12 | M | Arriving | not reached | The audio interface is native only; the walker opens no input device. | #849, #821 |
| LK10 | M | Lived-in | blocked | r45: no cell act was found by title in Live's surface. r52: the M3 clock stands in Technē mode › Device view › Journey › Open Quaternal Logic, and reads "No reading of the clock". Its Position says why: "No Nara identity is chosen: the M3 form is the person's own. Choose one in the Nara instrument." The world holds no identity, so no cell is read and none strikes the torus. The Binding skin was not reached (r52-LK10-b-01-clock). | G20 below; #771 |
| LF07 | M | Lived-in | engine offline | live-engine offline render tests pass (below). Export Audio from the shell is the native candidate's. | #849 |
| LV01 | M | Bare | gap (words fixed) | Bare has no set and no way to make one (`set_from_template` needs a template). r45: the empty list now says so: "No set stands in your Music folder or Live's places, and no template to start one from: a new set starts from a template." A set made with no template is a spec gap: live-set's only act that makes a set starts from a template, and neither Setup nor Live lays one down in a Bare world. The torus plays without a set. | #849, #738 |
| LV02 | M | Bare | differs | There is no Torus to drag in the browser's Instruments. The torus is the one instrument and stands on every chain. | #851 |
| LV03 | M | Lived-in | not walked | The set has two audio parts (Estuary, Market hall). r45: no control titled for adding an audio part was found in Arrangement view; its input is the native host's (LR12). | #849, #821 |
| LV04 | P | Lived-in | holds | ⌘G → `live_set_act tracks_group` → "Grouped Market hall in 2-Group." (Shift did not extend the selection, so one part was grouped.) r47: the same: Shift-click on a second head left one part chosen, and ⌘G sent `tracks_group {"tracks":[1]}` (r47-G18-b-03). | O9 below |
| LV05 | M | Lived-in | fixed → holds | Solo, Activator off, Volume and Pan are written and read back; quick Volume steps all land. "While the piece plays" was not reached (G4). | G9, G10 |
| LV06 | M | Lived-in | fixed → partial | r46: the made set has its return (`A-Reverb`, item 10), and each part's Send A now stands on its mixer row (red first). Four PageUp steps on Estuary's wrote −63 → −42 dB through `live_track_mixer_write`, read back from live-set (0.00794); ⌥⌘S hides the sends. The return's own send stands disabled with why. Output reads Main; choosing another is still not offered. The return's sound is the engine's (native host test). r47 (G18 built), on the set r46 made: each part's Output reads Main, as live-set does (r47-G18-b-02). ⌘G grouped Market hall in 2-Group, and its Output read Group; Main, then its group, were chosen and read back from live-set each time ("Market hall goes to its group, 2-Group."); choosing Estuary was refused on the cell and in words: "only Main and the part's own group are routings the set itself holds" (r47-G18-b-03, -04). | G18 below; #738, #849 |
| LV07 | M | Lived-in | holds (owner) | Arm true; Monitor auto → off (owner read). Hearing the chain was not proven (engine). | #849 |
| LV09 | M | Lived-in | fixed (G4) | r45, Session view, frame off screen: the row's launch strikes the Torus at its samples (`torus-play` … `at_samples_elapsed`), no refusal; meter rms 0.0058, peak 0.065; "Row 1 plays on the torus: a clip" (r45-G4-b-04-LV09-LV10). Walked again after the clock split on a fresh page that never mounted a keyboard surface: it said "Not sounded: the keyboard has no surface from the owner yet" (r45-G4C-b-04). Fixed (O6): row 1 strikes at its samples, rms 0.0059, peak 0.069 (r45-O6-b). A row of another part then loses the field (G15). | G4, O6: #790, #851; G15 |
| LV10 | M | Lived-in | partial | r45: Stop All stops the strikes (the one already sent lands, then none); "what was struck rings out on the torus". Back to Arrangement stays dark: "the owner reports no play state to compare with the ruler · the owner gives no op that plays the ruler again" (r45-G4-b-05-LV10). | G12 below |
| LV11 | M | Lived-in | partial | r45: Follow Action on, Action A Play Again and Legato, each written and read back (r45-G6-b-04). The set-wide follow switch on the Main track was not found, and following was not played. | G6 fixed: #790 |
| LV12 | M | Lived-in | partial | r45: Launch Gate then Toggle, and the clip's Quantize 1 Bar, each written and read back (r45-G6-b-02). How each mode launches was not played. The transport's Quantize is dark: "the set keeps none Live names". | G6 fixed: #790 |
| LV13 | M | Bare | gap | Tempo is read-only. Tap, Metronome, Overdub, Loop, Punch, Capture, Draw, Keys and Follow say "Not wired here yet". Quantize has no set value. | #849, #790 |
| XA10 | M | Lived-in | partial | r52: Cymatic Plate · resonator in the pane, keys struck in the torus's own window. Three keys struck in turn had not reached the owner 3.5 s after the last (r52-XA10-b-01); single strikes reached it 18.7 s and 11.5 s after the key (r52-XA10-b-02-watch, -b-03-hear; O11). After one arrived, the frame's meter rose from rms 1.6e-3, peak 0.011 to rms 3.2e-3, peak 0.019, and the owner's field read peak \|a\| 7.1e-3 m over 16 components (r52-XA10-b-03-hear). That the figure forms in the particles was not measured: the walker keeps no picture. | O11 below; #851 |
| XF01 | M | Bare | partial | New Expression opens. Play scenes is disabled: "No authored native Scene material is disclosed". The pointer stir reaches the field (`strike-at`); the frame's meter stays silent. | BA write-up below |
| XF02–XF07, XF12 | M | Lived-in | reached, not graded | r46: Cymatic Plate opened from Templates (saved to the world's flows). On the walk stack the transport's Field tempo, Resonance, Follow and Re-enable stand disabled: "Not wired here yet: The native transport carries the real readings when the owner is attached". Pulse is enabled. | BA write-up below |
| XF08 | P | Lived-in | partial | r52: Present, the View menu's act run from ⌘K's line (`>Present`), gives the field the whole screen: the frame went from 835×550 to 1440×900, full screen, its tool rail hidden. Esc brought the window back at 835×550 (r52-XF08-b-01-present). A double-click on the field's tab ("Cymatic Plate · resonator — Central") left the frame as it was (r52-XF08-b-02-tab). | BA write-up below |
| XF09 | P | Lived-in | partial | r52, the Studio's whole view: "+ Parameter" left the browser on Expressions, not on the field's and the symbols' parameters. In its Parameters, a double-click on Ink Opacity added nothing (6 chosen). Dragged onto the Studio, it stood as the 7th, Field (r52-XF09-b-01-add), written to the Expression's toolbelt (`opacity:field`) and saved to its file. Remove took it off: 6 chosen, written and saved (r52-XF11-XF09-b-02, r52-XF09-XR09-owner.digest). The tile and the compact show four a page. Whether Remove leaves the value in the field, and the macros in another scene, were not read. | BA write-up below |
| XF10 | P | Lived-in | partial | r52: a Field control reads Reach Field, with Follow and Bind disabled; a field macro cannot follow or bind, as the story's rule says. The symbol's control (`sequence.transition`, marked "!") reads Follow. Pressed, Bind stayed off and Follow on, with no words and nothing written (r52-XF10-b-01). Follow moving the selected symbol was not read; the scene said "The sequence target is not a formation in this scene". | BA write-up below |
| XF11 | P | Lived-in | gap | r52: All scenes on a Field control (Ink Opacity, then the Studio's first) stayed Off when pressed, with no words and nothing written (r52-XF11-XF09-b-02, r52-XF11-b-03). Its title says what On should do: the value holds for every scene and overrides the scenes' envelopes. | BA write-up below |
| XR01–XR08 | M | Lived-in | reached, not graded | r45: the resonator sends `torus-set` rate sweeping 80 → 101 steps/s; meters silent. r46: the template opens; the frame's Resonance section was not reached within the walk's time. | BA write-up below |
| XR09 | P | Lived-in | partial | r52: Open Studio full in a pane › Resonance › Resonator page › Compatibility. "Legacy templates" was written (`expression edit`, resonatorMode `template`), read back by inspect, saved, and read back from the file. "Continuous" was then written, saved and read back (`resonator`) (r52-XR09-b-01, r52-XF09-XR09-owner.digest). The plate's picture under Template was not measured. The words differ: the manual's switch is Resonator · Template; the product's is Continuous · Legacy templates. | BA write-up below |

## Gaps

Each gap: what I did, what I read back, what was wrong, and its ticket.

- **G1 (fixed, red first). #851.**
  - Did: opened Live in Pane view.
  - Read back: the frame said "Native QL host channel unavailable", and the torus never opened.
  - Wrong: the Live entry made its one attempt before the host had answered the native channel.
  - Fix: `liveEntry.mjs` waits for `hostAnswered`; `channel.ts` gains `answered`; `nativeField.ts` wires them.
- **G2 (fixed in r45, red first). #851, the kernel.**
  - Did: closed or reloaded a window.
  - Read back: the next window was refused with `native-expression.owner_busy`.
  - Wrong: the kernel's native driver stayed owned (`Manager.active`, `native_expression.rs:2880`).
  - Fix (ruling 2): the driver's lease is bound to its holder, the window's label and that page's load. It is released on window
    Destroyed, on page reload or navigation (src-tauri `on_page_load`), and when the holder has not beaten for four of the slowest
    readback ticks a hidden page runs (the frame's existing 250 ms tick beats; a derivation: `BEAT_TICK_MS` 1000 × `MISSED_BEATS` 4).
    A living holder is never forced; a second surface is refused in words that name who holds the driver. Kernel tests: close, reload,
    a stalled holder, a live holder kept; mutation-checked.
  - r45 walk: six pages opened in turn on one world's kernel, each took the driver, and no native op was refused.
  - A second page of the world opened while the first still answered was refused: "native-expression.owner_busy: the material/audio
    driver is held by another browser tab, which still answers. It is freed when that window closes or its page reloads, or once it
    stops answering." With the first page closed, the reloaded page took the driver (r45-G2-b-second-surface-refused).
- **G3 (fixed). #850, #854.**
  - Did: turned Sound on.
  - Read back: every Torus control read "no reading", with "parameters.torus.material: expected its standing and law".
  - Wrong: the boundary bounded the material standing at 64 characters. QL's `MATERIAL_STANDING` is about 120.
  - Fix: bounded at 512, as the maqām's standing is.
- **G4 (fixed in r45, red first). #851, #849, #853, #790.**
  - Did: left Pane view (Session view, or Torus Full in the pane).
  - Read back: "Held — host surface hidden. Resume field to continue."
    - Keys, strikes and clip play are refused or never sent.
    - Coming back to Pane view does not resume.
    - Resume is concealed in the Live cut.
    - Later in Session view: "audio receiver disposed", then "cannot reconcile an unknown or in-flight native operation".
  - Blocks LT10, LV09, LV10, LR01, LN02 recording, LN08 and XA10. The instrument has to sound while its frame is not on screen.
  - Fix (ruling 1): leaving Pane view pauses drawing only; the native field, the audio receiver, strikes, keys, clip play and Record go
    on, and coming back draws the instrument as it stands. "Held — host surface hidden" stands only when the person holds the field.
  - r45 walk: LT10, LV09, LR01 and LN08 hold with the frame off screen; LV10 and LN02's recording are partial for other reasons (G12,
    G13). No "audio receiver disposed" or "cannot reconcile" was read after a view change.
  - The clock split (C89's finding, taken in G4, red first): the frame drew at about 60 fps while `display:none`, and its scene clock
    rode the draw loop. Now one clock (`frameClock`, `native-field/controller.ts`) steps on animation frames while the frame is shown
    and on a 16 ms timer while it is hidden (a derivation: one 60 Hz frame), and draws only when shown. The native instrument's pump
    already ran on its own timer. Walked (r45-G4C-b-01): shown, 181 animation frames in 3 s and no timer steps; hidden, no animation
    frames and 154 timer steps; shown again, 166 animation frames.
  - O6 (fixed in r45, red first): a row launched in Session view on a page that had never mounted a keyboard surface said "Not sounded:
    the keyboard has no surface from the owner yet". The one playing path strikes the owner's Jankó window, and only the keyboard
    surface asked for it. Now Live's transport, which stands in every view, follows the window for the instrument's lens too, through
    one follower that asks each lens once (`native/liveJankoWindow.ts` `followLiveJankoWindow`). Walked: r45-O6-b (LV09).
- **G5 (fixed). #790.**
  - Did: Insert clip on Tide pad.
  - Read back: the owner holds `<MidiClip><Name Value=""/>`, but Clip view said "Select a clip…".
  - Wrong: `liveClipOf` treated `""` as no clip. The status line's "0 clips" counts arrangement clips only (O3).
- **G6 (fixed in r45 for the shapes a Live-written fixture shows). #790, live-set.**
  - A clip made in a set that holds no MIDI clip uses `crafted_clip` (live-set `acts.rs:423`), which carried no TimeSignature, IsInKey/scale, LaunchMode, LaunchQuantisation or follow actions.
  - So Signature, the clip's own mode, Fit to Scale, Launch and Follow were dark or refused in the owner's words.
  - Fix (ruling 5): `crafted_clip` gains each element in the shape and order live-set's own Live-written fixture (`edit.rs` tests'
    `SET`) shows, each round-tripped through live-set's reader: LaunchMode, LaunchQuantisation, TimeSignature, Legato,
    GrooveSettings, VelocityAmount, FollowAction, ScaleInformation and IsInKey. The set's mode in force stays per session, and the
    words say why: no set Live wrote shows where Live keeps a set's scale.
  - r45 walk: LM09 and LN03 hold; LM02, LV11 and LV12 write and read back.
  - The owner's check: open a set with a crafted clip in Live.
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
- **LN02 (fixed in r45, red first; ruling 3).** The roll drew no notes. A double-click on an empty row now draws a note one grid step
  long, a double-click on a note removes it, and a drag moves or lengthens it; each is a `live_clip_write` of the clip's notes. Walked:
  drawn and removed, read back. Also fixed: the roll said a note's chance as "chance 1 %" and stood the chance lane at a hundredth of
  its height, though the set holds chance from 0 to 1 (`clips/live.tsx`).
- **LR01-a (fixed in r45, red first).** Did: held three keys under a slot's Record. Read back: two notes laid 0 beats long. Wrong: the
  owner landed their releases in the strike's own block, and the take took that as the note's length. Fix: a release in the strike's
  own block is a hold the owner's clock did not resolve, so the hand's time measures it (`liveTake.ts` `takeRecordAct`); the course keeps
  both acts as landed.
- **LR01-b (fixed in r45, red first).** Did: recorded again from a page opened again. Read back: "Take 1" laid beside "Take 1", and every
  Arrangement take at beat 0. Wrong: Record read the part's `arrangement_clips`, which the set's owner never gives (it answers
  `arrangementClips` and `sessionSlots`, as `shell/document.ts` reads them), and counted takes from 1 in each page. Fix: one reader of the
  part's clips in the owner's shape; a take is named after the highest "Take N" its part holds. Walked: Take 2 at beat 16, Take 3 at
  beat 36.
- **G11 (fixed in r45, red first). #850, the frame's stage reading.** Did: opened the Torus's Stage page, then pressed Read stage state
  in the frame's Studio (Procedural stage). Read back: QL answered `stage-state` with `available: true`, and the Stage page still read
  "No reading of the stage", every act dark. Wrong: nothing asked the field for its stage, and the frame's reading never reached the
  Torus's Stage page. Fix: while the field follows and no stage is read, the Torus asks the frame once (`procedural-stage state`,
  `torusDevice.ts` `torusStageRead`), and the frame announces what QL answered. Walked: r45-G11-b-01, r45-G11-b-02 (LB09–LB13).
- **LB12 (fixed in r45, red first).** Did: Evaluate, then Retire. Read back: Retire stayed dark on a slot the procedure held. Wrong: the
  page named a slot's owner by QL's contribution key (`procedure@revision/slot`), not by the procedure that holds it, so it never
  matched the procedure chosen. Fix: a slot's owner is its `procedure_ref` (`stageReading.ts` `stageReadingOf`).
- **G12 (built in r46, red first). #849.** Back to Arrangement stayed dark: the set's owner reports no play state to compare with
  the ruler, and no op played the ruler again (LV10).
  - Now live-engine keeps each part's Session standing: a launch puts the part in Session, and Back to Arrangement returns every part
    to the ruler at a block boundary (`EngineEvent::Session`, `BackToArrangement`). The native host carries both and reads `session`
    on each part (`live_engine_host.rs`). The button lights while any part plays from Session, and its press is the engine's act.
  - Proven by live-engine's offline tests and the native host's test (both mutation-checked). Not walked: the walk stack has no
    native host, and the look is #821's.
- **G13 (built in r46, red first). #855.** Record with a clip open recorded into Arrangement view as a take, and into a slot only
  when the slot was empty. No act recorded into the clip itself, which LN02 names.
  - Now Record on an armed part, while one of its clips plays in Session, overdubs into that clip, as Live's Session Record does.
    Each note is written at the clip's own beat it was heard on, as long as it was held, cut at the end of the pass it fell in. The
    notes go in through `live_clip_write` as one step, "Overdub into <clip>", which Undo takes out alone.
  - Proven by the shell's tests (`live-take-855.test.mjs`, mutation-checked). Not walked in r46.
- **G14 (built in r46, red first; walked). #849, #790.** The browser's Samples listed only the samples the opened set disclosed ("No
  samples disclosed by this set"), so no audio clip could be made from the world's own audio files. Blocked LN10–LN13.
  - Now the kernel op `live_samples_list` lists the WAV and AIFF files of the open set's folder and of the world's Music folder, each at
    its place. live-set's act `audio_clip_make` makes one an audio clip on an audio part: unwarped, playing the whole file once, its
    file named as Live names it (beside the set by its relative path; elsewhere by its whole path).
  - Walked (r46-LN10-b-01, -02): Samples listed `estuary-low-tide` and `market-hall` (Music). With Estuary's head chosen, a
    double-click said "Made estuary-low-tide an audio clip in row 1 of Estuary: 2 seconds of estuary-low-tide.wav, unwarped, at its own
    rate." live-set read it back (`kind: audio`, `CurrentEnd` 3.07 beats at 92 BPM; `RelativePathType` 0 with the file's path).
  - The engine plays a clip named by its whole path (live-engine `a_sets_unwarped_audio_clips_are_laid_from_their_samples…`, "Room").
  - Walked: a click on an empty slot does not choose it, so the clip goes in the part's first empty slot (Live chooses the slot clicked).
    r47 (fixed, red first; round 47 item 4): a click on an empty slot chooses it, and the status line reads "Estuary · slot 2"
    (r47-item4-b-02); it is the target of the browser and of Insert clip.
- **G17 (built in r47, red first; walked). #790, #849. An audio clip had no Sample tab (LN10–LN13).**
  - r46: Clip view showed Clip, Launch and Envelopes for the made audio clip (r46-LN10-b-03), and read an unwarped clip's markers,
    which Live keeps in seconds, as beats (End "1. 3. 1" for a 2-second clip at 92 BPM).
  - Now an audio clip's Sample tab reads Warp and its mode, Gain (drawn in dB), Transpose, Detune, and the Fade switch (a Session
    clip) or the fade lengths (an Arrangement clip), as live-set reads them; each is a write to the set's owner. While a clip is
    unwarped its markers read in seconds of its sample. A MIDI clip has no Sample tab.
  - Walked (LN10, LN11 above): each written and read back on a clip made this round. A clip made in r46 carries no WarpMode, so its
    mode is refused in the owner's words.
  - Still open: BPM, /2, ×2, Reverse, RAM and HiQ; transients, warp markers and an audio clip's Quantize (LN12); the clip's own
    envelopes (Gain, Transposition, Sample Offset) in place of the Torus's, with no Automation / Modulation switch (LN13).
- **G18 (built in r47, red first; walked). #738, #849. A part's output could not be chosen (LV06).**
  - r46: Estuary's Output read "Main", and "choosing another needs the routings Live offers on this machine, which the document does
    not list".
  - Now the Output row is a choice: Main, or the part's group (`Group · <name>`) when it stands in one, both written through
    live-set's `track_output` act, the same routing Group Tracks writes. Another part as a target is refused in words: where Live
    sends a part to another part is not in live-set's sources.
  - Walked (LV06 above): Main and the group written and read back; another part refused on the cell and in words.
- **LN11-a (fixed in r47, red first).** Did: six quick key steps on the Sample tab's Gain, five on Detune. Read back: four Gain steps
  and three Detune steps landed (r47-LN11-b-08). Wrong, two ways: the owner's reading came back through its own units a hair off the
  value sent, so the run took it for a new value and started again from it; and a dial draws the hand's value ahead of the owner's,
  which also ended the run. Fix: a run of key steps holds while the reading stands on a value the run has seen, and while the keys
  come within a second of each other (`panel.tsx` `keyStepFrom`, `KEY_RUN_MS`); the hand's press on the control ends it. Walked again:
  every step landed (r47-LN11-b-09).
- **LN11-b (fixed in r47, red first).** The clip is read again on every change of the set, and the reads overlap; an older answer that
  came back last drew the clip back to a state the set had left. Now a clip's reader draws an answer only when no read asked after it
  has answered first (`liveWrites.ts` `clipReader`).
- **Setup-a (fixed in r47, red first; round 47 item 1).** Bare's Music folder held the walker's two files, copies of Arriving's
  synthetic samples: `Audio/estuary-low-tide.wav` and `Ableton/Factory Packs/pack-loop.wav`. Did: held Setup's Accept on the Ground
  step's "Your Music folder" row. Read back: "Central owner Action refused: Unknown Project map" (r47-setup-a-03-refused). Wrong: the kernel's Central client
  fills a request that names no project with its own (`o-i`), and the register named none, so Central looked for an O-I Project map
  in a world that has only its root. Fix: the register names the root's file map (`"project": null`), as the inspect does.
  - Walked again on Bare (r47-setup-a-03-accepted): the step went from 3 to 4 of 5 accepted, and the row reads "Central's file map
    keeps it, so Samples lists its audio · Central never writes inside it". Central declared the scope `folder:Music` with the three
    exclusions; every file and folder in Music kept its size and time.
  - Live's Samples on Bare then listed `estuary-low-tide` (Music, from the scope `folder:Music`) and not the Factory Packs loop
    beside it (r47-setup-a-04-samples).
  - On Arriving the folder was already kept (`folder:Music`), and the row read so (r47-setup-b-02).
- **G15 (open, QL-MEF; issue body drafted for the lead). The field is lost when a part switch restores that part's Torus.**
  - Did: in Session view, Sound on, launched row 1, then rows of other parts in turn.
  - Read back: the third launch sent `torus-restore` with the part's kept checkpoint. The kernel retired the owner, and every later act
    said "Not sounded: domain operation requires idle admitted owner".
  - First the kernel said only "native acknowledgement standing unknown; ". Fixed in r45, red first: an answer that fails the kernel's
    guards is named by what the owner answered (`native_expression.rs`).
  - Walked again (r45-G15-b-part-switch-named): "the owner answered unavailable (available false) for request "128" after "128",
    request 128 sent: worker unavailable; operation standing unknown: the bank set is not the bank asked for".
  - Wrong: QL accepted the checkpoint and then lost its own standing at its worker's bank check (`receipt.rs` `set-state`). Its law
    says a checkpoint that cannot stand is refused in words and changes nothing. Both times, the checkpoint had been kept by an earlier
    owner of the scene (`taken_at_samples` 11870208, read on an owner some 200,000 samples in), and its bank held fading slots.
    That cause is a reading, not yet proven at QL.
- **G16 (open, spec). #854, #850.** The native field offers one procedure, the Studio's `ta-onta:studio:first-vertical`. It is
  triggered by invocation, so nothing can be bound to the live flow (LB10, LB11), and no two procedures can clash on a slot (LB13).
  The stories need a procedure with a flow trigger, which neither the frame nor QL's stage discloses.
  - r46: the QL-MEF issue body asking for a procedure triggered by the ring's own step, and for the stage to list the procedures it
    offers, is drafted for the lead (lane BB r46 `COMMENTS.md`, issue body 2).
- **G19 (r52, open, spec). #771, #853. The playing surface draws one look, and only for the hand (LT13).**
  - Did: in Live's Pane view, Sound on, held one key and then another in the Torus's pane (Jankó, 180 keys); then launched row 1 in
    Session view while watching the keys.
  - Read back: a held key presses every key of its pitch class, 15 over five octaves (`aria-pressed`, which `janko.css` draws as an
    accent border and text colour), and they clear within 250 ms of release (r52-LT13-b-01-direct, -b-03-direct). The row's clip
    player sent 16 strikes to the owner at its samples, and no key changed over 8 s (r52-LT13-b-02-row). No control or mark is titled
    for a route's preview or a generated walk, and no source in the shell names one.
  - Wrong: the story asks for three looks, one for each kind of strike, on the point struck. The surface marks the hand's held pitch
    classes, the same for every touch-point of the class, and marks nothing it did not strike itself. Which point the owner struck
    (row, column) is in the owner's answer, not on the surface.
  - One read in the torus's own window lit no key while the owner took the strike (r52-LT13-b-01); it was not repeated.
- **G20 (r52, open, starting world). #771. The M3 clock reads nothing in the Lived-in world (LK10).**
  - Did: Technē mode › Device view › Journey on the chain › Open Quaternal Logic, where the M3 clock stands.
  - Read back: "No reading of the clock"; Position, Turn and Open each say "No reading from the owner yet", and Position adds "No Nara
    identity is chosen: the M3 form is the person's own. Choose one in the Nara instrument." (r52-LK10-b-01-clock).
  - Wrong: LK10 starts from Lived-in, and a world walked forward from Arriving holds no Nara identity, so the clock has no cell to
    hand the Torus. Choosing one is the person's act in the Nara instrument; the walker did not choose one for the person. Until the
    starting world, or the walk, holds an identity, LK10 is blocked.
- **Observations.**
  - O1: with Sound off, every Torus session control is dark (#850).
  - O8 (r46; fixed in r47, red first): the return track `A-Reverb` was drawn in Session view with a clip slot and a Stop button in
    each row (r46-LV06-b-01). Live draws no clip slots on a return track. Walked: the return's column draws 0 slots (r47-item4-b-02).
  - O2 (fixed in r46, red first): LT06 had no Range control (#853). The keyboard's Range now cuts the surface to 2 to 8 octaves, 5 by
    default, and the Keys device on the chain has a Range row. Not walked in r46.
  - O3 (fixed in r45): "N clips" counted arrangement clips only; live-set's summary now gives `session_clips`, and the line counts both.
  - O4 (fixed in r45): quick steps on a clip value box could repeat a value while a write was in flight. A step now starts from the
    value it sent, by G10's one-after-another rule.
  - O5 (fixed in r45): changing the transport's root now keeps the mode (`liveModeCatalogue.ts` `holdOnRoot`).
  - O6 (fixed in r45): see G4.
  - O9 (r47, open): Shift-click on a second part's head does not extend the selection, so ⌘G groups one part (LV04). Live groups
    every part chosen (#790).
  - O10 (r47, open): a key step on a dial draws the hand's value at once and then the owner's, which comes a moment later, so a run
    of quick steps flickers back by a step before it settles. Every step lands (LN11-a).
  - O11 (r52, open; the walk stack, a debug build). A key struck in the torus's own window reached the owner late: 18.7 s and 11.5 s
    after the key in XA10 (r52-XA10-b-02-watch, -b-03-hear), not within 3.5 s for three keys in turn (r52-XA10-b-01), and not within
    2.5 s while row 1's clip player struck (r52-LT13-b-03-direct). On the first page, two presses that landed on the torus's window
    said "Not sounded: The application did not answer this stage command", the stage's 60 s timeout (r52-LT13-b-03-clip).
    - The walk bridge's own timings put the wait elsewhere (r52-walk-bridge-lock: its log's `total_ms`, `lock_wait_ms` and
      `lock_held_ms` per request, with the operations the page sent, from the walker's log). Over LT13's three minutes it answered
      1 106 `native_expression` requests (720 `beat`, 385 `exchange`), holding the kernel's lock 30 % of the time; the longest
      request took 653 ms and the longest wait for the lock 579 ms. Over XA10's two minutes: 733 requests, 23 %, 247 ms and 190 ms.
    - So the strike waited before the bridge was asked, between the key and the frame's request, for seconds the bridge does not
      account for. Where was not found. The native host was not walked; whether it waits too is #821's.
  - O7: after a maqām was chosen (LM03), the frame's refusal slot read "Refused (transcription): DNA is already acting": a transcription
    edit that changes nothing, refused in words. Which act sent it was not found (#854).
    r46 (fixed, red first): it was the shell's own take keeper (`liveTake.ts`). Setting a part's kept Torus again sent every kept edit,
    the transcription among them, though the owner already stood there. It now sends only what differs (`torusMoveEdits`).
  - Carrier 0 (fixed in r45, red first, the frame; C89's finding): a pulse tuned to the drive did not ring the plate at Carrier 0. QL's
    default Carrier is 0.0 (`m1_prime.rs:251`), which is the manual's §21.2 default, so no QL issue is due. The frame's tuning sent the
    rate alone. Now, while the pulse is tuned, a Carrier of 0 is raised to 1 (`PLATE_CARRIER`, a derivation) and given back with the
    rate afterwards; a Carrier the person set is kept. Proven by the frame's tests; the plate was not walked again.
- **Walker notes (r45), not product faults.**
  - Vite reloads the page when a lane source file changes. Two fixes made during the walk reloaded the walked page, which took the
    frame with it until Pane view was entered again; every row after a fix was walked on a fresh page.
  - The walker's offline context ends after 600 seconds, and the frame then loads again; rows were walked inside one context.
  - The owner's clock in the walk advances in 8,192-sample blocks and slower than the hand, so a held note is laid shorter than it was
    held. The native host's clock was not walked.
  - Rows after the L89 rebase ran Chromium with `--use-angle=metal`. A reload loses the walker's frame counters, so a reloaded page
    reads 0 for both.
  - A fresh page opens with Sound off (C89: the first opening is muted). Each walk turned it on from the Torus's Body page.
- **Walker notes (r52), not product faults.**
  - The torus's own window opens over Session view's launch buttons, so a launch click landed on the window's keys until the window
    was dragged 640 px down on a 1440×1500 page; each launch after that checked the element under the point first.
  - The shared field's node client did not start on this stack: its generated module bindings were not in the lane's export. No row
    this round reads the shared field.
  - The walker keeps no screenshots, so no row this round grades a picture (XA10's figure, XR09's pattern).
  - The Expression was set back: the macro added in XF09 was removed and Compatibility set back to Continuous, each saved (its
    revisions moved on).

## Written up for BA (Expressions; unedited)

- **XF01.** A New Expression ("An empty work: one Scene, nothing placed") cannot be played.
  - Play scenes is disabled: "No authored native Scene material is disclosed". Stop is disabled: "This Scene has no authored working duration to stop."
  - The story asks to open an Expression, press Play and stir. The stir reached the field (`strike-at`), but Play cannot be pressed.
  - Belongs to Expressions' scenes (BA's r892 zone).
- **XR (Cymatic Plate).** Opening the template makes the frame sweep `torus-set` rate (80 → 101 steps/s) through QL, while the frame's offline meter stays at rms 0 with the field unmuted (`advance … muted:false`). Whether the plate's field reaches the frame's audio output in a hosted window needs BA's reading. r45: at Carrier 0 that tuning rang nothing; the frame now raises Carrier while the pulse is tuned (Carrier 0 above). Not walked again.
- **XF02–XF12, XR (r46, Lived-in).** Cymatic Plate · resonator opened from Templates in Expressions ("Opened, and saved to
  Control/user/flows/cymatic-plate-resonator-….expression.json", the world's own flows).
  - The transport's Field tempo, Resonance, Follow and Re-enable stand disabled: "Not wired here yet: The native transport carries the
    real readings when the owner is attached". Pulse is enabled, as the Expression's own. Stop says the Scene is idle at its start.
  - Opened from Live's Pane view first, the Expressions templates said "Presented in the other Expressions pane." and opened nothing:
    one frame, held by Live's pane.
  - The frame's Studio lists a Resonance section; it was not reached in the walk's time (r46-XR-b-02). The plate's controls
    (Frequency driver, Q factor, Station sweep, Dominance, Dimension, Body source, Compatibility) were not walked.
  - Whether the field controls answer only with the native transport attached needs BA's reading before these rows can be graded.
- **XF08–XF11, XR09 (r52, Lived-in), on the same Cymatic Plate · resonator.** Each act below is the person's, through the Studio
  or the menu; what the Expression owner wrote is read from its answers (r52-XF09-XR09-owner.digest).
  - XF08: double-clicking the field's tab does not present it; the View menu's Present does.
  - XF09-a: "+ Parameter" opens the browser on Expressions, where the story opens it on the field's and the symbols' parameters.
  - XF09-b: a double-click on a parameter in the browser adds nothing; only a drag onto the Studio adds it.
  - XF10: on the symbol's control, Bind does nothing and says nothing. Its rule (a bound symbol not in the scene makes the macro say
    so and wait) could not be reached.
  - XF11: All scenes is enabled and its title says what On does, but pressing it leaves it Off, says nothing and writes nothing.
  - XR09: the Compatibility switch writes and reads back. Its words are Continuous · Legacy templates, where the manual (§20.14) says
    Resonator · Template.
  - XA10's strikes reach the owner seconds late on the walk stack (O11). They wait in the frame or in the shell's stage channel
    before it, which was not found; the bridge answered every `native_expression` request in those minutes within 653 ms.

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

r46, on C90 with the round's patch: `cargo test --locked --features k8` 157 passed, 6 ignored (the same corpus-gated six); without k8,
130 passed. The native host's own engine tests (`desktop/cradle/src-tauri`, `--features native_shell --bin oi-cradle live_engine_host`,
offline: the tests pull the engine's blocks themselves) 34 passed; G12's fails when the host's reading of `session` is cut.

The 6 ignored tests (m3 3, midi 1, mixer 2) are corpus-gated and were not run. Under load, the key-to-sound spin can outlast a 256-frame block, and the engine then saturates `reached_frame` at 0 (L87). It did not show here.
