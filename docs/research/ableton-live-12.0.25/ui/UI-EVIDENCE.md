# Live UI evidence — measured from the real application

**Status:** evidence dossier, revision 1 (2026-10-07). Source: full-display
captures of Live 12.0.25 running on this machine (session + arrangement
views, 1920×1200 native). Screenshots: `evidence/ui/live-session-real.png`,
`evidence/ui/live-arrangement-real.png`. This dossier is the visual/layout
ground truth for the shell rebuild (Thread B). The shell NEVER ships these
images — it rebuilds the layout language from the measured facts.

## Global layout (both views)

- Single dark chrome, no window decorations beyond the macOS bar. Overall
  background ≈ `#3f4348` (mid warm-gray); panels slightly darker
  (`#33363b`-ish); content surfaces `#43464c`. Hairline separators slightly
  darker than surfaces; NO drop shadows or gradients in the chrome —
  flatness and density are the language.
- Five regions, fixed: **top transport bar** (~64px), **left browser**
  (~430px in arrangement / ~425px session), **center view** (dominant),
  **bottom detail panel** (~330px arrangement / mixer-integrated in
  session), **bottom status strip** (~28px). Right side has no permanent
  dock — Live uses none; our shell's right dock is an original extension
  (documented in SHELL-BLUEPRINT.md, keep).
- Accent color is **amber/yellow** (`#ffbe00`-family): play button, scene
  highlight, arm state, selected-slot ring, clip play triangles. Selection
  elsewhere: cool blue-cyan for track headers/session slots
  (`#7ec3e6`-family tints per track color), track colors user-assigned
  (mint, teal, blue, purple families observed).
- Type: small (11–12px) system sans throughout; numerals in the same face;
  ALL-CAPS only for tiny section labels (e.g. "PITCH/TIME", "LAUNCH").

## Top transport bar (left→right)

1. MIDI-arrangement capture + draw-mode toggles (two small square toggles,
   far left).
2. Link/Tap cluster, then **tempo field** `131.00` (editable number),
   metronome cluster `||| 4/4`, global quantise menu (`1 Bar`).
3. **Position display** `1 . 1 . 1` (bars.beats.sixteenths), play/stop/
   record/loop-button cluster (round, record = filled circle right of
   play), then punch-in/out, draw-mode, computer-MIDI-keyboard toggles.
4. Center-right: second position readout `1 . 1 . 1`, loop brace toggle,
   `128 . 0 . 0` counter (arrangement loop length), plus small toggles.
5. Far right: draw-mode pencil, mini-hand, `Key`/`MIDI` indicators,
   `44.1 kHz` sample-rate readout, CPU `%` meter, and the hamburger
   (main menu) at the very edge.
- Bar title center-top: set name ("Untitled").

## Left browser (arrangement capture)

- Sections stacked, each collapsible with disclosure triangles:
  **Collections** (Favorites + user sidebars), **Library** (All, Sounds,
  Drums, Instruments, MIDI Effects, Max for Live, Plug-ins, Clips,
  Samples, Grooves, Tunings), **Places** (user folders: Templates, warm,
  amp, …, Sampler).
- A category open shows a flat searchable list ("Name" column header +
  filter box) — rows: device/instrument names with a small icon, e.g.
  Analog, Collision, Drift, Drum Rack, DS Globe, … Operator, Sampler.
- Bottom of browser: **Groove Pool** area with column headers
  (Groove Name | Base | Quantize | Timing | Random | Velocity) and a
  "Drop Clips or Grooves Here" empty-state.

## Session view (session capture)

- **Track columns** left→right; each column top has a colored **track
  header strip** (name + activator); below it the clip-slot grid: one
  square slot per scene (empty slot = small dark square with a ▶ glyph on
  hover; the grid row aligns with the scene number on the master column).
- **Master column at right** shows scene names (1…8) and is the launch
  column.
- **Bottom of each column = mixer strip**: device-chain previews and the
  mixer cluster — Send A / Send B knobs (with Arc/Live-loop icons), pan
  knob, volume fader with dB scale (−∞..+6), track number button, arm (■),
  solo (S), activator, and a level meter strip. Groups collapse their
  members (2-Group observed collapsing 3–13 LABS).
- Routing surfaces inline per track: "MIDI From / All Ins / All Channels /
  Monitor In-Auto-Off" and "Audio To / 2-Group / Main" dropdown stacks
  above the mixer.
- Selected-slot ring: amber outline; playing slots show green ▶.

## Arrangement view (arrangement capture)

- **Timeline ruler** in beats (1, 33, 65, … — 32-beat spacing displayed)
  with a draggable loop brace above.
- **Per-track lanes**: audio clips show real waveforms (violet/dark),
  MIDI clips show named blocks with note previews; automation lanes in
  red/neutral per device parameter; group lanes collapse children
  (15-Group → Mixer).
- **Track headers right-side** (Live keeps headers adjacent to the mixer
  column): device chain dropdowns per track (e.g. 13 LABS: EQ Eight ▸
  1. Frequency ▸ Filter; 14 ReCogniIze: EQ Eight, S-Gain A), routing
  (Ext. In, All Channels, Monitor Auto/Off), volume/pan fields,
  activator/solo/arm.
- **Bottom detail panel**: left = Clip panel (Start/End/Loop/Position/
  Length/Signature/Grove/Launch/Pitch & Time sub-sections with
  Fit-to-Scale, Stretch controls); right = **note editor / piano roll**
  (keyboard C1–C5 vertical, bars horizontal, velocity lane below, scale
  highlight toggle, Focus readout LABS10).
- Status strip: current set path area + `1.00×` groove/stretch indicator,
  `H`/`W` draw toggles, and the selected-track readout right.

## Interaction facts (for behavior parity)

- Session↔Arrangement = one key (`Tab`); browser toggle = `Cmd+Alt+B`
  family; device/clip detail panels are toggles too.
- Everything is inline-editable in place (tempo, names, values) — no
  modal dialogs for editing; dialogs exist for destructive/global ops.
- Drag targets everywhere (browser → track, clip → slot, devices → chain).
- Color = user semantic layer (track identity); the chrome itself stays
  neutral so user colors pop.

## Density/dimension facts (1920×1200 fullscreen)

- Transport bar ≈ 64px tall; browser ≈ 430px wide; track header width in
  arrangement ≈ 210px; session clip slot ≈ 68×26px per slot; mixer fader
  track ≈ 60px wide; bottom detail ≈ 330px; status strip ≈ 28px.
- Slot grid row height ≈ 26px; scene master labels ≈ 26px; timeline
  32-beat spacing ≈ 230px at default zoom.

## What the shell adopts vs adapts (binding for Thread B)

- **Adopt**: the five-region layout, session/arrangement duality, inline
  editing everywhere, drag-target ubiquity, color-as-user-layer over
  neutral chrome, density, hairline flatness, amber-accent language.
- **Adapt (original)**: exact pixel values are re-derived at our own
  breakpoints; right dock added (our extension surface); our own glyphs.
- **Never ship**: the captured images, Ableton's icon art, or its preset
  content.
