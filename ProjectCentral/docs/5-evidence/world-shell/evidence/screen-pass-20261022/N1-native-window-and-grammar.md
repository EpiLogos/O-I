# N1 — the window and its grammar, natively (22 Oct 2026)

P=/private/tmp/claude-501/-Users-admin-Central/8300544e-4e39-428c-913c-0f026a6b86e1/scratchpad/pass
App: "O-I Shell Candidate" r36 (O-I main d1aae14cf023 per the status bar: "Native host · revision d1aae14cf023  6 of 6 owners admitted"),
pid 7438 (relaunched by the lead 10:24; the first r36 process 70694 exited 0 at 10:19:40). Screenshots under `$P/shots/N1/`.

## Process notes (not findings)

- 10:18:57 I ran `open -b org.epilogos.oi.live-shell` to bring the app forward. The bundle id is shared by two builds, so it
  launched ~/Applications/O-I Shell Candidate.app (pid 61822, built 8 Oct, window "Untitled / No set open"). r36 (70694) then
  exited 0 at 10:19:40 (launcher log). I do not know whether my launch caused that. The lead stopped 61822 and relaunched r36 as 7438.
- 10:24:20 my own duplicate launch of r36 (pid 7537) ran for ~15 s next to the lead's 7438 ("Expression endpoint is already
  serving another app"); I stopped only 7537.
- The auto-mode classifier refused my attempt to quit 61822 through System Events; I did not work around it.
- While I worked, the pointer, selection and mode changed between my calls without my input (see the message to the lead).
  Anything I saw change by itself is marked "(interfered?)".

- The pass was stopped by the lead at ~10:35 ("the owner is redirecting the build"). What follows is only what I reached.
  Evidence for every finding is in `$P/shots/N1/` (names in brackets). Window size was never changed (1261x820), so the
  narrow (900 pt) check was not made in any mode.
- Pointer/selection/mode changes that looked like another hand: the owner was at the machine (the lead confirmed). I could not
  tell my own from theirs in a few places; those are marked "(interfered?)".

## Findings

### N1-01 [BREAK] (native)  Central › Pane view › right pane › the Earth instrument
Seen: in the Pane view that r36 restored at load (two panes: a Flow page "Shared field — first curated artifact" on the left, a dark pane on the right with the gold focus ring), the right pane holds only plain text at its top left: "Earth could not mount — No workspace is bound for the Earth projection, so its settings have nowhere to live." Status bar at that moment: "aperture 1 pinned · 2 panes". (shot: c00-central-pane-view-earth-error.jpg, c12-status-bar-right-zoom.jpg)
Expected: §10.2 "A pane holds one device's Full view: its material at full size". An instrument that cannot open should say why in the pane's own design and give a way on, not a bare sentence in a dark box. (The sentence itself does give the reason; there is no control to bind a workspace.)
Interaction: none; present when I arrived (restored state). I did not try to open it again. Related to N-00 (same family: a pane that cannot mount its instrument natively).

### N1-02 [BREAK] (native)  Factory › title line › selected task with a long name
Seen: with the task "Factory280 r3 producer: inspect the immutable candidate7a0aa625c504afef96677688b1b4ec851a6faba5/tree27714f2e0a67130c154c09b277eda4435aaa4da6 and return substantive attributable focused-verification findi…" selected, the title line spans the whole top bar. It starts at x≈62, under the green and yellow window buttons, and runs behind Back/Forward, and is cut only at the right end with "…". (shots: f01-factory-session-wide.jpg, f02-factory-title-overlaps-window-controls.jpg)
Expected: a centred title that truncates inside the space between Back/Forward and the right edge (mockups: "Bollingen · the stone carved — Central · 08 Oct", centred, short); §10.1 "the title line names what you have selected, with Back and Forward at its head".
Interaction: none, it follows the selection (the selected clip was the second track's only clip).
Likely source: src/frame title line (no max-width / text-overflow on a 1px-token name).

### N1-03 [BREAK] (native)  Factory › entering the mode › macOS Keychain password prompt
Seen: after I switched to Factory (by mistake, see N1-10) a system dialog appeared over the window: "workcell wants to use your confidential information stored in “workcell-connection” in your keychain. To allow this, enter the “login” keychain password." Buttons Always Allow / Deny / Allow, with a password field. It is the SecurityAgent window, so every display-scope action was refused while it stood. I did not type, click or answer it; at my last look (10:33) it was still up; at 10:36 the owner's Claude window is in front and r36 sits in the Stage Manager strip, so I do not know whether it was answered. (shot: f04-keychain-prompt-workcell-connection.png, cropped to the dialog)
Expected: the shell never makes the owner type a login-keychain password to look at a mode. The lead's ledger K1 OPEN 8 says a `workcell connections probe` from an unsigned binary may raise exactly this prompt; the shell's own Factory entry seems to trigger the same read.
Interaction: Factory mode loaded (Session view) → ~60 s later the dialog. Cause not isolated (the probe may be on a timer, not on mode entry).

### N1-04 [MISMATCH] (native)  Central, Factory › Session view › the mixer row stands above the clips
Seen: directly under each track head, above the first slot, a tiny row: Central "1 S ●" with "IN the worl… OU… WOR…"; Factory "1 S ● ⌿" with "IN Ga… OUT La… WOR…" (numbers 1–8 on colour boxes). The labels are cut to two or three letters at the 110 px track width. Nothing stands under the slots. (shots: c05-central-session-wide-no-rail.jpg, c06-central-session-text-selected-zoom.jpg, f03-factory-track-heads-zoom.jpg)
Expected: §16.6 "In Session view it stands under the slots"; the agent-shell mockup has the mixer at the foot of the tracks (Lead / Agent / Model / Watch / Arm, volume and S/arm), and the gallery's session grid has the stop buttons under the slots.
Interaction: none. I did not test the "Mixer" switch at the bottom right (⌥⌘M), so this may be the "mixer hidden" form; the row is still drawn above the slots.

### N1-05 [MISMATCH] (native)  Central › detail area › Clip view and Device view never stand together (confirms S1-03 natively)
Seen: at 1261x820 the detail area is ≈190 px tall and holds one of them. ⌥-click on the Device switch (modifier sent) left Device view alone; Clip switch gives Clip view alone; ⌥⌘3 and ⌥⌘4 switch between them; ⌥⌘L twice hid the whole area; ⇧Tab then brought Clip view back. (shots: c07-central-altclick-device-only.jpg, c08-central-clipview-session.jpg)
Expected: §10.1 "⌥-click Clip or Device to show both views at once, one above the other"; §16.4 "both at once when there is room".
Interaction: as above. I did not drag the line above the detail area to see whether both show when it is taller (S1 found they do).

### N1-06 [MISMATCH] (native)  Central › Clip view › the head and the editor's first tab
Seen: for the selected Flow page "flow-2026-09-23-1832" the Clip view head is a plain green bar with no activator box and no name; the Clip panel's "Title" field is empty and Colour reads "—". The editor's first tab is cut to "Medi" beside Dialogue / Flow / Journal / Source. (shot: c08-central-clipview-session.jpg)
Expected: §16.5 "Head: the clip's activator, its name on its colour" (gallery clip__*.png: a checkbox and the name on the colour). The name is available: it shows in the title bar and at the foot of the grid.
Interaction: clicked the Clip switch only.

### N1-07 [POLISH] (native)  Central › widget rail › the bottom row of tiles is clipped (the lead's browser finding, confirmed natively)
Seen: with the rail shown (⌥⌘8) at 1261x820 the launcher grid shows one full row (Messages, Fizz) and a second row (Packet, Trail) cut through its labels by the "+ Save as preset…" strip at the foot; the "Packet" and "Trail"/"open" labels are half hidden. A scrollbar stands at the right, so the grid scrolls, but the cut falls mid-label with nothing to show it continues. The mockup also ends on a partial row but cuts it above its label line. The rail header reads "Widgets 9 open" (mockup: "Context 3 open"). (shots: c04-rail-tiles-zoom.jpg, c03-central-session-rail-first.jpg)
Expected: a whole row, or a row cut cleanly below the label; §16.4 "Fold the launcher to give the tiles the height".
Interaction: ⌥⌘8 to show the rail. I did not scroll the grid or fold the launcher (S2's).

### N1-08 [POLISH] (native)  every mode › status bar › the line stays on the last control, and there is no idle line
Seen: after the pointer left a control the line kept that control's text (after I moved the pointer into the empty grid it still read "Session view today as clips…"; after clicking the Clip switch it read "Widen the widget rail Drag to widen the rail; widgets reflow."; after an ⌥-click on Device, "Packet exactly what the agent will receive. Open it above."). Several lines also follow keyboard focus, not the pointer ("Factory Sessions and tasks — the agency desk" while the pointer was in the title row). The mockups' idle line reads "Info  Hover anything to read what it does."
Expected: §10.1 "what the control under the pointer does, or what went wrong"; mockup idle line.
Interaction: pointer moves with mouse_move; part of this may be that a synthetic click teleports the pointer without a move event, so I give it as POLISH, not BREAK.

### N1-09 [POLISH] (native)  Central › Arrangement view › the "now" label over the ruler, and the empty main area
Seen: the label "occasion · A page is open: Control/user…" with a green dot sits on the ruler's own tick labels and hides the 18:00 tick and half of "23:59"; it is cut mid-path. Under the three tracks (Your world, cron · firings, Day Main with a "Today 1 stop" row) the rest of the main area (≈280 px) is empty. A line under it reads "138 clips have no place on this ruler: its owner gives none. The Session grid holds them." (the count moved from 137 to 138 while I watched). The Session grid showed 12 rows for Your world; I did not scroll it, so I cannot say it holds the rest. (shots: c09-central-arrangement-wide.jpg, c10-central-arrangement-ruler-zoom.jpg, c11-central-arrangement-foot-zoom.jpg)
Expected: §16.6 the ruler measures "today, from first entry to last"; the gallery ruler (dlw__arrangement-ruler.png) has tick labels clear of the needle readout and the lanes filling the area.
Interaction: Arrangement button (1103,80).

### N1-10 [POLISH] (native)  Toolbar › mode buttons › the hit area reaches up into the title row (not isolated)
Seen: my clicks at x=1000, y=63 (the title row, 17 px above the mode icons at y≈80) changed the mode to Factory: after the first, the status line showed the Factory button's hover text; the next Tab then toggled Factory's views, and the third batch found Factory in front. The drawn button is ≈20 px tall.
Expected: the title row is the window drag area; a click there does nothing.
Interaction: I made this mistake three times by using that point to "focus the window". I did not repeat it in isolation to prove it, so confidence is medium.

### N1-11 [NATIVE-ONLY] (native)  Live › first load › the centre pane (the lead's N-00, reproduced on pid 7438)
Seen: seconds after the relaunch the window showed the Live set "screen-pass-r11" in Pane view with "Opening the Library…" and "This candidate has no built Expressions asset at the requested path"; browser Instruments list: Expressions stage, Earth, Graph, Canvas, Timeline, Journey ("An ordered walk through places, moments and things. Double-click or drag it into a pane."); chain "3-LABS — Plug-in → EQ Eight → Saturator → Reverb → Auto Filter" with the line "The torus joins the chain when its owner publishes a reading." in the first chain slot; status "21 tracks · 8 sce… 3-LABS". About 15 s later, with nobody touching it from my side, the window was in Central mode with a Flow page and the Earth message of N1-01. (shot: l00-live-first-load-library-break.jpg)
Seen elsewhere: the same message did not appear in Central or Factory in what I reached.
Interaction: none.

### N1-12 [POLISH] (native)  Browser pool › column heads and select cut short
Seen: the pool header reads "Workspace · Pan… · Inst… · Wid… · Lay… · Opens in", the "Opens in" select reads "Last mo" (Live: "Last mc") and the Keep button "Keep" (Live: "Kee"), in a pool 340 px wide at 1261 pt. The footer rows "On launch: Restore all modes" and "Keep context: On change" are whole. The pool's "Grooves" switch stands at its head in Live (§16.7). (shots: c01-central-session-clipview-wide.jpg, l00-live-first-load-library-break.jpg)
Expected: §16.7 columns Panes, Instruments, Widgets, Layouts, Opens in; Keep.

### N1-13 [OK-NOTE] (native)  every mode › status bar right end
The right end reads "Native host · revision d1aae14cf023  6 of 6 owners admitted" (Pane view adds "aperture 1 pinned · 2 panes"), then the ▲ Clip ▲ Device and Mixer switches. S1-01's "Development browser · no revision disclosed / No host readback" is a browser-only reading; natively the line is true and plain. The revision stamp is still developer information in an owner-facing bar (POLISH at most). (shot: c12-status-bar-right-zoom.jpg)

### N1-14 [OK-NOTE] (native)  switching the views and the rail
- Session and Arrangement buttons switch the main area in Central; Tab switches Session ↔ Arrangement in Factory (checked twice: Arrangement → Session). 
- ⌥⌘8 shows the rail and moves the main area's right edge; the Main track column shifts with it (c05 vs c03).
- ⌥⌘3, ⌥⌘4, ⌥⌘L and ⇧Tab act as in N1-05. Pane view button/⌥⌘9 and "Tab returns from Pane view" not tested.

### N1-15 [OK-NOTE] (native)  Central regions present, wide
Transport top (Ground sync, Link's settings, Stamp Now, Die face down/up, Autosave, Save timing, Follow, Answer/Stop/Dictate, then mode icons and view icons, rail toggle), browser left (Material: Worlds, Days, Flows, Beings, Things, Goals, Files, Wiki, New…, Ground; Instruments: …; list column "Name"), pool under it, main area, detail area, status bar, rail on the right after ⌥⌘8. Session grid: tracks "Your world" (12 page clips, green) and "cron · firings" (1 clip, "civil-field read · c…", dimmed), the Main track "Day · 2026-10-20" with row launchers 1–12 and a "firings" row, ■ and ≡ buttons under it, and a state legend (Waiting, Running, Stopped, Recording, Stalled, Done) with the selected clip's name at the right. Arrangement: ruler with − + Fit # grid, a LANES row (Takes 0, Automation 0, Events 0), a Main track "Day" and a "Today 1 stop" row, overview strip, legend. (shots: c05, c09)

### N1-16 [OK-NOTE] (native)  Factory regions, seen briefly
Browser: Material: Git, Projects; Instruments: Context, Instruments, Surfaces; Devices: Skillsets, Runs; Running…; the Surfaces list: Settings, Library, Identity · Nara, Factory, Automations, Field, Terminal, Web browser. Session grid: eight narrow session tracks with coloured heads and a fold ▾, one task clip ("Factory280 …", blue, selected) and empty slots; legend as Central. Clip view of the selected task: head with a checkbox and the name on orange; tabs Clip / Launch / Intent; "Fold · All tools" and the Log / Envelopes tabs; "No reading of the task's log yet." Device view (seen only in a full-screen capture): Agent device with face, Effort/Budget/Steer/Queue/Interrupt, then a skills rack ("Members · no reading"; REPERTOIRE Scope Home Project Session), then a third device "No reading of th…". Order Agent → skills → scope matches §16.2. The rail was hidden in Factory (the layout is per mode). (shots: f01, f03)

## Coverage

| Area | Status |
|---|---|
| Window regions, Central, wide | checked in Session view; regions found, no overlap other than N1-07/N1-09 |
| Window regions, Factory, wide | partly (Session view first look; the Main track, the workcells at the right and the mixer were off-screen to the right: not scrolled) |
| Window regions, Expressions / Technē / Live | not reached (Live only the first-load frame, N1-11) |
| Narrow (900 pt) in any mode | not reached |
| Session view, Central | checked: tracks, clips, Main track, legend; clip states other than "stopped/ready" not present; no return tracks in Central |
| Arrangement view, Central | checked; the needle/lanes not exercised (0 lanes) |
| Pane view, Central | seen only as the restored state (N1-01); Pane view buttons and ⌥⌘9 not pressed |
| Session / Arrangement / Pane, other modes | Factory Session and Arrangement seen (Arrangement via Tab, only a crop at 0.7 scale); not compared with the gallery ruler |
| Clip view and Device view, Central | partly (N1-05, N1-06); toggle works as one-at-a-time |
| Clip view, other modes | Factory Intent tab seen only |
| Browser and pool | categories read in Central and Factory; no item opened or previewed; ⌥⌘6 not pressed; pool not exercised |
| Devices on a chain (views, fold, add/remove, pop-out) | not reached |
| Selection and focus rings | not reached beyond one clip highlight |
| Interactions (launch, follow actions, takes, double-click, Enter, Esc, drag) | not reached; a drag by another hand left grey text selections across the clip labels in Central's grid (shot c06): UI text is selectable, which Live's grid is not; not reproduced by me |
| Live mode: torus, effects, transport play | not reached |

