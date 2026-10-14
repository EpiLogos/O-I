# Screen-pass brief — the native app, driven by computer use (Sonnet)

The lead sends this as one Agent call (`model: sonnet`) after a clean native
build at the lane's HEAD (`run-native-at-head.sh all`, then `readback`). The
browser render is never a substitute: only the native host passes through
the O:I products' owners (kernel, Central, the Expressions host).

```text
You are the screen-pass driver for the DLW build. Computer use, native app
only. You change no code and no files except the capture folder below.

App: "O-I Shell Candidate", already launched at revision <rev> (pid <pid>).
Captures: save every screenshot you take for evidence to
<evidence dir> (computer-use screenshots with save_to_disk; then copy the
saved file there with Bash, named <nn>-<viewport>-<what>.png).

1. Load the computer-use tools in one ToolSearch call (query "computer-use",
   max_results 30). request_access for ["O-I Shell Candidate"] (and
   "Finder" only if needed). If access is refused, stop and say so.
2. Viewports: (a) wide — the window maximised on the 1920×1200 display
   (or the largest display available); (b) compact — the window 700 pt
   wide, full height. Resize by dragging the window edge or with
   `osascript -e 'tell application "System Events" to set size of front
   window of process "oi-cradle" to {700, 1200}'` (Bash), then screenshot.
3. Walk this checklist at BOTH viewports. For each item report
   PASS / FAIL / ABSENT with what you saw (quote on-screen text exactly) and
   the capture file name:
<checklist>
4. Interact only through the UI (clicks, keys); never type into a terminal
   or editor. If an item needs an action you cannot perform, say which.
5. Leave the app running at the end; the lead quits it.

Return exactly:
REVISION SEEN: <the revision text the window shows>
CHECKLIST: <item → PASS/FAIL/ABSENT — evidence — capture>
DEFECTS: <numbered, each: where, what is wrong vs the expected, capture> | none
CRAFT: <the 3 most visible craft gaps against Ableton Live / the mockups> 
```

## Standing checklist (extend per wave)

- P0-R1 — the window shows the native host revision; nothing reads as a
  development browser.
- P0-R4 — in each mode the device families admit through real owners or
  name their absence (owner, missing op, remedy) — no generic "not admitted"
  wall.
- P0-R5/5b/5c — the run context (World, carrier, revision) is disclosed in
  the status region in every mode; refusals read as the owner's words with
  the receipt folded beneath.
- P0-R6 — the owner readback in the status region (n of 6 owners admitted,
  each named), chips do not overflow at the compact viewport.
- T-LABELS — the rail and status read "Central" (not "Base · Central");
  Technē's Session/Arrangement read Journey / Timeline; no day window or
  hours are typed (no 08:30 / 21:00 anywhere).
- T-TIMELINE-WALKS — Technē Timeline: walk lanes and nested sections over
  the Aion reading (when the atlas reading is present).
- T-EXPRESSION-TRACKS / T-SEQUENCE-EDITOR-MOUNT — Expressions: open a
  native Expression; the Clip detail shows the scene's piano roll above the
  States editor (lanes = objects, notes with glide tails), envelopes with
  their modulator.
- T-ATLAS-HOST — Technē lens bar: Places opens the Earth globe over the
  Archetypal-Earth corpus; Project / graph opens the coloured field graph;
  switching away and back keeps the camera (hidden-inhabitant law).
- Lane 3 (E01–E07, E15/E16) — Expressions: the journey timeline shows one
  clip per scene, widths proportional to duration; dragging a clip's right
  edge trims it (toast names the 1 s / 3600 s limit); a split at the
  playhead makes two scenes; Shift+edge rolls; undo (⌘Z) names the edit
  ("Undo Trim scene …").
- Lane 2 (T1–T3, T7, T8, T12, T13) — Technē Timeline (the canvas timeline in
  the research instrument): a two-row axis (major/minor labels, BCE years
  where the span reaches them); period bands with their names; clusters
  collapse dense items with a count; the minimap below shows the visible
  span highlighted; standing-coloured items.
- Lane 4 (T1–T3, T6–T13, T29) — Places map: right-drag/ctrl-drag tilts and
  rotates (pitch/bearing readout); selecting a place flies to its precision
  zoom; markers read solid/halo/dashed by precision; layer filter control;
  routes and hierarchy edges; the attribution line names the sources.
- Lane 1 (A1, A5, A6) — Canvas: dragging a card near another shows a guide
  line and snaps; zoom controls beside the minimap; keys + − 0 Shift+1
  Shift+2; a zoom readout fades after zooming.

## Runs

- 13 Oct 2026, build `20261013T-wave3` at `7692eacc7` (pid 25898): readback
  (scripted, accessibility tree, no interaction) shows "Native host · revision
  7692eacc7864" and "3 of 6 owners admitted" (three admitted, three excluded
  by footprint). The computer-use driver's `request_access` for "O-I Shell
  Candidate" was refused twice (owner away). The interactive checklist waits
  for the owner's grant; it is not substituted by scripted clicks.
- 14 Oct 2026, build `20261014T003607Z` at `3a619dbb8` (pid 25648): clean
  tree, sealed, launched; readback (scripted, accessibility tree) shows
  "Native host · revision 3a619dbb8b45" and "3 of 6 owners admitted". The
  Sonnet driver's `request_access` for "O-I Shell Candidate" came back
  `user_denied` (third refusal; owner away at night): nothing was driven or
  captured, nothing substituted. The menu Quit (accessibility tree) did not
  end the process within 60 s, where it had on 13 Oct — possibly a close
  confirmation on screen, unseen; the lead ended its own pid. Next pass:
  watch the close path. The wave's checklist (Live transport, browser,
  device chain, presets; the Factory Expressions pane; the palace board and
  bookmarks; fullscreen) stands ready in the driver's brief for the grant.
