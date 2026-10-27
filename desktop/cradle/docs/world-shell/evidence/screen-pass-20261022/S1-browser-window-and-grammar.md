# S1 — the window and its grammar (reader findings, 22 Oct 2026)

Stack: private shell at http://localhost:4843/app/ (port 9341). Shots under `$P/shots/S1/` where
P=/private/tmp/claude-501/-Users-admin-Central/8300544e-4e39-428c-913c-0f026a6b86e1/scratchpad/pass

Standing reference problem: `gallery/clip__base.png` is NOT the Central clip design. It is the catalogue index page
(a list of links clip:techne, clip:central, ... on an empty dark page). The other four clip__*.png are real.

## Central (wide 1600x1000, then narrow 1180x760)

### S1-01 [BREAK]  Every mode › status bar, right side › stray development text
Seen: the right of the status bar always reads `Development browser · no revision disclosed   No host readback`, in every view and mode, at both sizes (shot: shots/S1/00-open.png, shots/S1/12-central-mixer.png). At 1180 it truncates to `Development browser · no revision dis…   No host …`.
Expected: the status bar says "what a control does, or what went wrong, in one line" (§10.1); the mockup's right end reads `aperture shared · 2 panes`, `Document`, `Devices`. Nothing in the mockups or manual names a "Development browser" or "host readback" string.
Interaction: none needed; present from load. (Possibly a legitimate "this is a browser without the native host" reading, but it is worded as a developer note and sits permanently in the status bar.)

### S1-02 [BREAK]  Central › status bar hover lines › internal identifiers in user-facing text
Seen: hovering the Arm control in the mixer row, the status bar reads `Arm  Arm · Lets the agent of this world write into its pages directly, each write with a receipt; off, every agent write arrives as a proposal · off · press to turn it on (shell.setWriteArm — the shell's one write ar…` (shot: shots/S1/12-central-mixer-status.png). The label is doubled (`Arm  Arm ·`) and the line ends in a code identifier. Selecting a clip shows `... plays now (central:now:control:root:71cf4b2221bf4a09d60c36577653741cc531a77be7476e32e980c42…`. Selecting a Day shows `(CAS identity, basis, save-router standing)`; the Days category reads `rows from the kernel's temporal read (L4) and the day records`.
Expected: one plain line that says what the control does (§10.1, §16.14); no internal function names, node refs, "CAS", "save-router", "L4".
Likely source: the status/hint strings in the Central frame bindings (src/frame/**).

### S1-03 [MISMATCH]  Central › detail area › Clip view and Device view never stand together at the default size
Seen: at 1600x1000 the detail area (≈270 px tall) holds only one of Clip view or Device view. The switch pair at the bottom right behaves as a two-way switch: Clip lit -> Device hidden; Device lit -> Clip hidden. ⌥⌘3 and ⌥⌘4 switch (not show/hide); ⌥⌘L hides the whole area and brings back Clip only. ⌥-click on Clip or Device (the page does receive altKey=true) switches to that one and does not show both (shots: 03-central-both.png, 03-central-both2.png, 03-key-a3.png, 03-key-a4.png).
Expected: §10.1 "⌥-click Clip or Device to show both views at once, one above the other"; §16.4 "both at once when there is room, as Live 12 does"; ▲ beside each switch "shows or hides" that view.
Interaction: dragging the resize line above the detail area from y=697 up to y=420 DID bring both (Clip view above Device view) — so "when there is room" works, but nothing at the default size and no key/⌥-click can show both. The ▲ beside Device shows Device and hides Clip instead of adding it.
Likely source: src/frame (detail area layout).

### S1-04 [POLISH]  Central › detail area (both views shown) › unexplained empty band
Seen: with the detail area dragged tall and both Clip view and Device view showing, a ≈50 px dark empty band separates the foot of Clip view (y≈694) from the title line of Device view (y≈745) (shot: 03-drag-detail.png). The chain inside Device view is also scaled down (smaller type than at full height).
Expected: Clip view above Device view with no gap (Live 12; §16.5).

### S1-05 [MISMATCH]  Central › Pane view › pane tabs, ⊞ split and + are not visible
Seen: in Pane view the two panes (Day, Flow) show no tab strip, no ⊞ and no + (shot: 06-central-pane.png). The accessibility tree lists tablist "Open surfaces" with tabs `Day`/`Flow`, "Split this pane ⊞", "New tab", "Keep this pane's footer up", but the tab strip is 0 px wide, the tab sits under the page content (elementFromPoint at the tab is the `central-document-absence` div), and the ⊞ / + report boxes at (324,671) and (345,670), i.e. over the browser's pool footer, not on the pane. A grey 17 px strip under each pane is empty. Hovering the pane edges, top or foot shows nothing.
Expected: §10.2 "To split a pane, click ⊞ … Double-click a pane's tab and the pane fills the main area". The mockup shows pane heads (`DAY 4+2`, `Dialogue · Flow · Journal`).
Interaction: hover at pane top/left/bottom; click the "Keep this pane's footer up" control by script: nothing appears.

### S1-06 [MISMATCH]  Central › Pane view › Flow pane head carries Save and Re-read
Seen: the Flow pane's head reads `FLOW   rcdf8c28f · as read   [Save] [Re-read]` (shot: 01-top-right.png). Not pressed.
Expected: §16.3 "A pane holds no device controls … no controls on it"; the Full view is "the material itself".

### S1-07 [MISMATCH]  Central › Session view › clips drawn "Stopped / ready" while their state is "not disclosed"
Seen: every clip of "Your world" is drawn in full green with a ▶, and selecting or hovering one reads `flow-2026-09-23-1832 · State not disclosed · A Flow · Control/user/flows/flow-2026-09-23-1832.html` (shot: 15-central-clip-chain.png). The grid legend (Waiting, Running, Stopped, Recording, Stalled, Done) has no swatch for the green. One clip's status line says "Running" (`Shared field first curated artifact · Running · A Flow …`) while it is drawn the same as the rest.
Expected: §3, §16.6: "Every clip shows its state … Stopped: ready, in full colour"; a clip whose state is not known should not look ready. The gallery's session-grid draws clips in their track colour with a distinct fill for each state.

### S1-08 [MISMATCH]  Central › Device view › chain order and membership for a selected page
Seen: select a Flow page clip: Device view reads `Note · flow-2026-09-23-1832.html — document devices: each modifies the open document` and the chain is `Day, Approvals, Packet, Agent, Voice, Scope, [Add a document device]` (shots: 15-central-clip-chain.png, 10-central-chain-scrolled.png). Day and Approvals (the Main track's chain) stand first, in front of the world's own devices. Selecting the Main track head shows only `Day, Approvals` (shot 15-central-main-selected.png).
Expected: §16.2 "Central: a world's chain is the packet, the agent of the world, and its scope. On the Main track: the Day, then Approvals." and §10.2 "Device view shows the chain of the selected track". The mockup chain (Text, Highlight, Notes, Packet, Answer, Die) is also different from the shell's, but the Day-first order is the break here. Voice is not named in §16.2 for Central.
Interaction: scrolled the chain by setting `.detail-chain` scrollLeft (the chain scrolls horizontally; the mouse wheel does not scroll it).

### S1-09 [MISMATCH]  Central › Device view › Voice device is a head with an empty body
Seen: `Voice` in the chain draws as a 130 px card with a head (empty light, name, ⊞ only; no ▸, no ↗) and an empty dark body; nothing inside it (shot: 10-central-chain-scrolled.png).
Expected: gallery `actuation__voice.png` Compact: a small live display with Body / Speed / Mouth / Interrupt controls, light, ▸, ▦, ↗.
Interaction: none pressed.

### S1-10 [POLISH]  Central › Session view › track head mixer row is ~7 px type
Seen: under each track head the mixer row reads `IN the worl… OU… WOR…` in ≈7 px caps with buttons `1`, `S`, ● (shot: 12-central-mixer-z.png). "in/out/works in" labels are truncated and illegible at 1x.
Expected: §16.6 mixer row sections (In/Out, Works in, switches Activator/Solo/Arm); legible controls.
Interaction: ⌥⌘M hides and shows it (works).

### S1-11 [POLISH]  Central › Arrangement view › ruler labels collide at the right end; track names clipped
Seen: the last two ruler labels overprint: `10-20 21:00` and `10-20 23:59` read as `10-20 21:1-20 23:59`; the first track head reads `Your worl` (cut, no ellipsis); the overview strip's name reads `minutes (UT…` (shot: 05-arr-z1.png, 05-arr-z2.png).
Expected: gallery `dlw__arrangement-ruler.png`: evenly spaced time labels, full lane names.

### S1-12 [MISMATCH]  Central › Arrangement view › the ruler stands on a Day older than today
Seen: Position/transport reads `22 Oct · 06:19 PM`; the title line reads `… — Central · 20 Oct`; the Main track reads `Day · 2026-10-20`; the Days list's newest Day is `Mon 19 Oct`; the Day device says `Central's Day: Mon 19 Oct; civil today: Thu 22 Oct`. Four different dates for "today" are on screen at once. The ruler runs `10-20 00:00 … 10-20 23:59`.
Expected: one consistent day (§10.1 title line "its world and its day"; §16.6 "Central: Today, from first entry to last").
Note: this is the real owner state (the Day pointer is stale, and the Day device says so honestly), so only the 20 Oct versus 19 Oct pair is a break: the title line and Main track say 20 Oct while the Day device and Days list say 19 Oct.

### S1-13 [BREAK]  Central › Clip view for flow-2026-09-23-1832 › head and title empty
Seen: selecting `flow-2026-09-23-1832` and expanding Clip view (⌥⌘E): the head bar is an empty green bar with no name and no activator; Title field blank; Colour `—`; editor `No reading of the Flow yet.` After 10+ s nothing changed (shot: 17-central-expand-clip2.png).
Expected: §16.5 "Head: the clip's activator, its name on its colour"; the clip's name stands even while its content loads.
Interaction: ⌥⌘E expands; ⌥⌘E again returns to the Session view with the clip still selected (works).

### S1-14 [MISMATCH]  Central › right-click menu › disabled acts give no reason, no act has a hint
Seen: right-click on a Flow clip: menu `Launch  Stop | Cut Copy Duplicate Delete (all dimmed) | Rename  Switch off  Edit info text (dimmed) | Open  Reveal | colour palette` with the keys beside each (shot: 16-central-clip-menu.png). Pointing at a dimmed item (Cut, Delete, Edit info text) leaves the status bar on the clip's own line (`flow-2026-09-23-1832 · State not disclosed · A Flow · …`); pointing at Launch or Rename also changes nothing.
Expected: §10.9 "An act that its owner cannot take stays in the menu, dimmed. Point at it and the status bar says why: the operation it waits for, and whose." (§16.14). Delete is dimmed rather than "drawn in the record colour".
Interaction: right-click, hover; nothing pressed. The menu items themselves match §10.9's list for a clip in Central.

### S1-15 [POLISH]  Central › widget rail › launcher grid clips its last row
Seen: the launcher shows 2x2 large tiles (Messages, Fizz open, Packet, Trail open); the second row's labels are cut by the `+ Save as preset…` strip (shot: 04-launcher.png). 20 widgets exist, so the grid scrolls, but the cut label looks like a clip.

### S1-16 [OK-NOTE]  Central › window regions at 1600x1000
Control bar with title line (Back, Forward, `Nothing selected — Central · 20 Oct`) across the top; transport groups in §10.1's order (Browser toggle, Link/Stamp/Die/Autosave, key, Follow, Position, Play/Stop/Record, Overdub…Capture, Loop, Draw/Keys/Key map/MIDI map, Readings, Mode, View, Rail); browser left (Material/Instruments/Running, pool below it); main area; widget rail right; detail area bottom; status bar. Toggles ⌥⌘6 (pool), ⌥⌘B (browser), ⌥⌘8 (rail), ⌥⌘M (mixer), ⌥⌘E (expand clip) and ⌥⌘L all work and give the room to the main area. The Resize-detail line drags (and brought both Clip and Device).

### S1-17 [OK-NOTE]  Central › Tab / view buttons
Tab Session <-> Arrangement works; from Pane view Tab returns to the view left (checked Arrangement -> Pane -> Tab -> Arrangement). The three view buttons switch and light correctly. ⌥⌘9 toggles Pane view.

### S1-18 [OK-NOTE]  Central › device views on a chain
Packet: ▸ opens the Whole band above the chain (panes shrink, nothing covered; matches the gallery's Whole), Esc hides it; double-click on the head folds to a 22 px strip (`Packet 4 items 4943 ch`), click unfolds; ▦ opens Full in the focused pane (header `Packet · 4 items`, body, footer `4943 characters 4 of 32 items Limit Off For the project`) and the chain selects Packet; ↗ opens a window with Full above and Whole below (traffic-light dots grey), Esc does not close it and ↗ in the window does (as §16.4).

### S1-19 [POLISH]  Central › Packet Full (and window) › entries are raw HTML source
Seen: Packet entries 1-4 read `<html lang="en"><head><meta charset="utf-8"><meta name="viewport" …` — each an "observed element" of a Things page, shown as page markup (shot: 11-central-packet-pane.png). Real data, but the gallery shows readable text entries.

## Factory (wide 1600x1000, narrow 1180x760)

### S1-20 [BREAK]  Factory › control bar › title line is the whole task prompt
Seen: with a task selected the title line (top centre) reads `Factory280 r3 producer: inspect the immutable candidate7a0aa625c504afef96677688b1b4ec851a6faba5/tree27714f2e0a67130c154c09b277eda4435aaa4da6 and return substantive attributable focused-verification findings under a read-only material boundary; no candidate writes o…` — a single line that spans the entire control bar from x≈50 to x=1600 and overprints the row where Back/Forward sit (shot: 22-factory-clip.png, 25-factory-narrow-session.png). The same text is the clip's status line and fills the Clip switch.
Expected: §10.1 "the title line names what you have selected, its world and its day, with Back and Forward at its head" — a short name, as the mockup's `Flight Path — Release Cut`. (Sibling sessions are named `Factory280 ordinary protecte…`, `Commission-scoped Factory r3 p…`: long prompt-derived titles.)

### S1-21 [MISMATCH]  Expressions, Technē, Live › title line, Clip switch › another mode's selection shown
Seen: after selecting a Factory task, switching to Expressions and to Technē keeps the Factory title (`Factory280 r3 producer: inspect…`) and the Clip switch at the bottom right keeps carrying `Factory280 r3 producer: insp…` with the task's small picture, while Technē's own detail area reads `Instruments — none open on the focused pane` and Live's reads `No track selected` (shots: 30-expr-first.png, 40-techne-first.png, 50-live-first.png). Earlier, switching Central -> Factory kept `flow-2026-09-23-1832.html — Central · 20 Oct` in the title.
Expected: §10.2 "A mode has one selection … Every view and the detail area show the same one"; in a mode with nothing selected the title should read `Nothing selected — <World>` (as Central did at load) and the Clip switch should be empty. (The mockups show the same title in every mode, so the title carrying one global subject may be intended; the Clip switch and the long Factory text are the clear breaks.)

### S1-22 [MISMATCH]  Factory › Session view › grid shape against the agent-shell mockup
Seen: 25 session tracks across (horizontal scroll with no visible scrollbar; the grid is 3178 px wide in an 886 px area), one task clip in total (`Factory280 …` in `Commission-scoped`), `cron · firings` with one clip, then the workcells `env-1`, `env-2`, `env-3`, then the Main track with rows 1-4 and `firings` (shots: 21-factory-session.png, 21-factory-session-right.png). The mixer row stands directly under the track head as a ≈7 px strip (`1 S ● ⌿`, `IN Ga… OUT La… WORK…`), not under the slots with faders, Lead/Model/Watch and the stop-and-retry buttons the mockup draws (agent-shell-mockup.png).
Expected: §16.6 "Under the head is the track's mixer row"; workcells after the sessions and before the Main track (this part matches); the mockup's Main track carries Approvals, Stalled, Ledger controls and a fader.
Interaction: scrolled the grid by `.sg` scrollLeft; the wheel does not.

### S1-23 [MISMATCH]  Factory › Arrangement view › lane heads cut to ~45 px; no needles
Seen: lane heads read `Factory28`, `Commis`, `Joined in`, `Authoris`, `verify-prc`, `Indepen`… because each head also holds the lane number, S, arm and route buttons; the ruler (`08:13:46 … 09:13:46`) holds no clips or needles; one line says `382 clips have no place on this ruler: its owner gives none. The Session grid holds them.` (shot: 23-factory-arr.png).
Expected: gallery `dlw__arrangement-ruler.png` lane heads `Fizz · lead`, `explore`, `Budget recorded`; §16.6 "Factory: each session has a needle at its last check-in".

### S1-24 [OK-NOTE]  Factory › Clip view for a task
Head (task name on its colour), Clip/Launch/Intent tabs, Launch panel with Once/Hold/Loop, Then, Hand off to, Quantize Global and the line `A task has no legato and no launch velocity.`; editor toolbar `Fold  All tools | Log  Envelopes` with `No reading of the task's log yet.` — the structure matches `gallery/clip__factory.png` (shot: 22-factory-clip.png). Device view for the task reads `… — the agent's chain: agent → skills → scope` with Agent, a skills rack, a skill and Scope (shot: 22-factory-device.png), in §16.2's order.

### S1-25 [MISMATCH]  Factory › browser › category set differs from §10.3 / mockup
Seen: Material: Git, Projects; Instruments: Context, Instruments, Surfaces; Devices: Skillsets, Runs; Running: Sessions, Agents. Sessions list is flat (`Commission-scoped Factory r3 producer…`, `Desktop chat conversation` ×4 …, all `idle`) (shot: 20-factory-first.png).
Expected: §10.3 "Factory: Your projects, each opening to its chats … newest first, each with its agent, its state and its last exchange". The agent-shell mockup groups Collections / Library / Places and lists the open sessions with state. Here projects do not open to their chats on the list that leads; the rows show no agent and no last exchange.

## Expressions

### S1-30 [MISSING]  Expressions › Pane view › nothing opens: stage empty, Studio pane full of placeholders
Seen: Pane view shows a left pane `No Expression is open — open one from the browser's Expressions, or New.` and a right pane headed `● Studio  no reading of the work  ○ Material ○ Motion ○ Body ● Nara [Sa…` listing YOUR CONTROLS / FIELD / MATERIAL `0 of 4 on` (Colour Field, Particles, 3D body & depth, Shared Medium: each `Open a native Expression to read it.`) / MOTION… (shot: 30-expr-first.png). The pane head's Save is cut at the pane's right edge (`Sa`).
Expected: mockup world-shell-expressions.png: the field fills the pane, the Studio device under it. Without a native Expression this is an honest empty state (NATIVE-ONLY for the field itself); the clipped Save and the four identical placeholder cards are the shell's own.

### S1-31 [OK-NOTE]  Expressions › disabled controls name why
Hovering the Studio's Save, Undo and Redo (all dimmed) reads `Save  Save the Expression. The corner of the display says whether it is edited since the last save. Open a native Expression first.`, `Undo  … Open a native Expression first.`, `Redo … Open a native Expression first.` (shot: 32-hover-all.png). Browser rows read plainly: `O:I — the mark  One expression, two scenes: the base O:I image in day and night. Double-click it, or press Open, to open it.` Not pressed: New Expression, Open on Featured and Starters.

### S1-32 [POLISH]  Expressions, Technē, Live › Arrangement view ruler
Seen: with nothing open the ruler reads `0  0.1  0.3  0.4  0.5  0.6  0.8  0.9  1` (nine ticks at 0, 1/8 … 1, each label rounded to one decimal: 0.25 reads 0.3, 0.75 reads 0.8), no unit (shots: 31-expr-arr2.png, 41-techne-arr.png, 51-live-arr.png). §16.6: Expressions measures "seconds"; Technē "deep time to today"; Live "bars and beats".
Expected: a labelled ruler in the mode's unit; evenly rounded or labelled ticks.

### S1-33 [OK-NOTE]  Expressions › Session view empty state
`Open an Expression to see it as a track, its scenes as clips.` with the Main track rows 1-8 and the stop/menu buttons at its foot; the browser fills `New Expression / Featured (O:I — the mark, Field studies, Seven centres, A small language) / Starters (Ink, Print, Gather, Between)` a few seconds after the mode opens.

## Technē

### S1-40 [BREAK]  Technē › Pane view › `Earth could not mount`
Seen: the whole main area is one pane reading `Earth could not mount — No workspace is bound for the Earth projection, so its settings have nowhere to live.` (shot: 40-techne-first.png). The URL carries `?arr=base&projection=earth`. Nothing else is in the pane; no instrument, no way out except the browser.
Expected: the world / Earth drawing, or at least the instrument's own empty state with the chain showing it (mockup world-shell-techne.png: the system of bodies fills the pane).
Interaction: none; present at first entry to Technē. This may be specific to this private stack (no workspace bound); recorded because the pane is a dead end.

### S1-41 [POLISH]  Technē › Session view › raw identifiers as track names
Seen: tracks `Readings, Occurrences, Journeys, development-entry-fac…, development-entry-roc…, direct-5c117063862f8…, direct-7209029b…, direct-ac1a89022f8b…, direct-e0aa37…, fx-aletheia-2…, fx-anima-20…, o-i-chat-179…` ×4, `Revisions`, `Sky`, `cron · firings` (shots: 41-techne-session.png, 41-techne-arr.png). The mixer strip under each head reads `IN Sourc… OUT Instrume…` in ≈7 px.
Expected: §16.6 "Technē: a reading, a journey or the occurrences of a subject" as tracks — readable names, no hash ids.

### S1-42 [MISMATCH]  Technē › transport position › "20 Oct"
Seen: Position reads `06:19 PM · 20 Oct` while Central's reads `22 Oct · 06:19 PM` and the date today is 22 Oct (shot 40-techne-first.png).
Expected: one clock, one date (§10.5: Technē Position is "the clock that drives the panes").

### S1-43 [OK-NOTE]  Technē › Device view
Detail area reads `Instruments — none open on the focused pane`; chain `Project, Canvas, Timeline, Journey, World` each with its Compact display (`the Earth not mounted`, `the stage is in project lens`) and `Drop a device here` (shot: 41-techne-session.png). Pane-view chain also holds the folded strips `Canvas M1′, Timeline M2′, Journey M3′, World M4′, Palace M5′` after Lens.

## Live

### S1-50 [BREAK]  Live › transport › a diagnostic sentence stands in the Key group
Seen: between the Key controls and Position the transport carries the line `Mode in force — none chosen; the kernel serves 240 s…` cut at the next group (full text from the page: `Mode in force — none chosen; the kernel serves 240 scales · absent: shem (absent), ficino-planetary (needs owner authoring)`) (shot: 50-live-transport.png).
Expected: §10.1 transport: Key group is "Key, root and scale" controls; the mockup has `C ▾ Major` only.

### S1-51 [OK-NOTE]  Live › empty states
Pane view shows the O:I stipple mark on the paper ("Live: Music — the shell's base mode, restored"); Session view `Open a Live set from the browser to see its tracks.` with the Main track rows 1-8; Arrangement the 0…1 ruler; detail area `No track selected` with `The torus joins the chain when its owner publishes a reading; open a set to bring a track's devices here.` and `Drop an instrument or effect here`. Pool head carries `Grooves` which swaps to `Open a set: its grooves are the set's own.` (§16.7). No Live set could be opened here (NATIVE-ONLY).

## Cross-mode and further findings

### S1-60 [MISMATCH]  All modes › transport › controls do not keep one place across modes
Seen: the Follow button (the left edge of the Position group) sits at x=516 in Central, 637 in Factory, 555 in Expressions, 495 in Technē and 752 in Live at 1600 px; Stop at x=679, 774 (Factory's Stop is not named "Stop" in the tree), 683, 658 and 880. The Key group's own width (Central `Σ 0 — 0-I`, Factory `Σ—·— Factory280 ordi… session`, Live `# C▾ none chosen▾ Mode in force …`) pushes Position and the Play group across the bar. The right group (Draw/Keys/Key/MIDI) sits at x=1050 in Central and x=1141-1153 in the other four (measured by eval on aria-labels; shots: 00-open.png, 20-factory-first.png, 30-expr-first.png, 40-techne-first.png, 50-live-first.png).
Expected: §10.1 "Every control has one place in the transport, and the place is the same in every mode. A control that a mode does not use stays in its place, dimmed, so that nothing slides into its space."
Interaction: switched modes at a fixed 1600x1000 viewport and read each control's left edge.

### S1-61 [MISMATCH]  Technē › Device view › chain differs by window width; developer text in a device
Seen: at 1180x760 the Technē chain reads, left to right, the folded strips `Project M0′`, `Canvas M1′`, `Timeline M2′`, `Journey M3′`, `World M4′`, `Palace M5′`, a folded `Torus / field waiting`, then a card `QL field / PCM owner` marked `not docked` whose body reads: `No owner reading in this host … ql-field-host (+ ql-field-worker) — one managed native owner supplying PCM and identified field targets together · Launcher: the kernel's native-expression owner (desktop/cradle/kernel/src/native_expression.rs compose → spawn) · OI_QL_FIELD_HOST_BIN + OI_QL_FIELD_WORKER_BIN (absolute paths; both or neither) · … Compose: {operation:"compose", request:{texture:[w,h], units_per_metre:120, sky:"none"|"now"|{epoch}}} · Channel: oi.native-expression/v1 … The Tauri gate still lacks … the retained GPU field (the M4 stage) must be live before compose` (shot: 71-techne-narrow.png; full text read from the DOM). At 1600x1000 the chain shows only `Project, Canvas, Timeline, Journey, World` in Compact with `Drop a device here` (shot: 73-techne-wide-arr.png).
Expected: a device card is "a small live picture and up to four controls" (§16.3) in a fixed order; no source paths, env-var names, request schemas or "Tauri gate" notes on the screen. (The device itself is NATIVE-ONLY; the text is not.)

### S1-62 [MISMATCH]  Central › browser › no category for devices or widgets
Seen: Central's browser holds Material (Worlds, Days, Flows, Beings, Things, Goals, Files, Wiki, New…, Ground), Instruments (Instruments, Surfaces) and Running (Sessions). No Devices and no Widgets list, and no way to add a device to the open chain except the dock `Add a document device` (shot: 00-open.png). Factory has `Devices: Skillsets, Runs`; Expressions `Devices: Objects, Parameters, Devices`; Live `Devices: Presets, Instruments, Chain devices`.
Expected: §10.3 and §16.7 "In every mode the browser holds four kinds of thing … Instruments, devices and widgets are the same in every mode, grouped by the product that makes them. Drag a device onto a chain to add it."
Interaction: could not add a device to a chain from the browser in Central. (Not tried in Factory, Expressions or Live: adding there could write to an agent or an Expression.)

### S1-63 [OK-NOTE]  Central › browser › Instruments
Single click on `Timeline` previews it at the foot of the list (`History beside the work that studied it, on one ruler from deep time to this morning. Double-click or drag it into a pane.`) and in the status bar; it does not open. Categories Worlds, Days, Flows, Beings, Things, Instruments, Surfaces, Sessions list as expected; `Beings` reads `Your world holds no Beings yet: make one from New….` Selecting a Day opens it in the detail area (title and Trail update) and does not show a preview at the foot of the list.

### S1-64 [BREAK]  Central › browser search › Worlds list does not filter
Seen: ⌘F focuses the browser search (`Search (⌘ F)`); typing `cen` and Enter leaves the Worlds list unchanged (Actuation, Archetypal-Earth … all shown) (shot: 60-search.png). In Days, typing `Mon` filters correctly (Mon 19 Oct, Mon 12 Oct … plus `NOW  mac quiet`) (shot: 60-full.png).
Expected: §10.8 "Search, in a pane ⌘F … Search, over anything: the same line ⌘K". ⌘K did nothing visible (focus stayed on the mode button).

### S1-65 [OK-NOTE]  Central › selection and focus
One selection at a time: selecting a Day, the Main track head, a clip or a pane replaces the previous one in the title line, the Trail widget (each change adds a stop) and the detail area; the Main track head selected shows `Main · Day · 2026-10-20 · its chain: Day, Approvals`, the Device switch carries `Main`. The clip selected is outlined in yellow in the grid and in the Arrangement; the focused pane carries the yellow edge (Day pane, then Packet pane after ▦).

### S1-66 [BREAK]  Central, Live › a pane holding the stippled O:I mark stalls the page for minutes
Seen: Live mode's first screen is a Pane view holding the stippled "OI" mark (shot: 50-live-first.png). After switching to Live the page stopped answering the driver (CDP connect timed out) for about two minutes; the same happened in Central after opening `Timeline` from the browser (double-click) — the pane became the stippled mark (browser preview turns red: `Open an available native Expression before choosing its instrument.`, shot 90-central-timeline-pane.png) and the page stopped answering for ten minutes (had to be restarted) and, on a second try, for about 90 s after switching view. The console shows the Expressions app loading (`__application/expressions/assets/…`, `THREE.Clock deprecated`, repeated `GPU stall due to ReadPixels`) and one Chromium process stayed at 60-75 % CPU. The machine load average was 35-70 from other readers, so part of this is load; the mark is the heavy part.
Expected: a pane with no work open draws a still empty state, not a live WebGL scene that blocks the window.
Interaction: Central ▸ Instruments ▸ Timeline (double-click) ▸ view switches; Live mode entry.

### S1-67 [BREAK]  Central › Fizz widget › raw error with a local file path
Seen: with a Factory session selected, the top of the Fizz widget on the rail reads `Native Agent source unavailable: Error: Central owner Action refused: AgentProfile source not found: /Users/admin/Central/Work/O-I/ProjectCentral/agents/profiles/profile-bbf99f6f2ff90b4c.json` above `O-I conversation  Disconnected` (shot: 91-central-world-select.png).
Expected: a plain line saying the agent cannot be read and why, without a thrown-error prefix or an absolute path (§16.14 "When a device is done").

### S1-68 [MISMATCH]  Central › Device view header › text after the chain name
Seen: with a Timeline pane open the detail area reads `No document selected — document devices: each modifies the open document · then Project, open on the focused pane` (shot: 90-central-timeline-pane.png). 
Expected: a name of the track and its chain (§10.1 "Device: carries the selected track's name") — the appended `then Project, open on the focused pane` is a stray composition note.

### S1-69 [MISMATCH]  Central › keys › arrow keys, U, ⌥3 ⌥4 ⌥5 ⌥6 and ⌘K do nothing
Seen: in Session view with a clip selected, ArrowDown ×2 and ArrowRight leave the selection on the same clip (title and outline unchanged); `U` does not fold the track. ⌥1, ⌥2, ⌥9 switch to Session, Arrangement and Pane view; ⌥0 puts focus on the transport; ⌥3, ⌥4, ⌥5, ⌥6 leave the bright edge where it was (activeElement unchanged, shots 85-focus-both.png). ⌘K does not move the cursor anywhere visible; ⌘F focuses the browser's search.
Expected: §10.2 "The arrow keys move the selection"; §10.8 U "Fold or unfold the selected track", ⌥3 Clip view, ⌥4 Device view, ⌥5 browser, ⌥6 pool, ⌘K "Search, over anything".
Interaction: clicked a clip, pressed the keys, read the title line and document.activeElement.

### S1-70 [MISMATCH]  All modes › Device switch › right-click gives no list of the chain's devices
Seen: right-click on the Device switch at the bottom right (Factory, with a task track selected) only selects a word of its label (`scope` highlighted) and opens no menu; the page holds no `[role=menu]` afterwards (shot: 88-crop.png). Right-click on the Clip switch and Mixer: also nothing.
Expected: §10.1 "Right-click it for a list of the chain's devices, and choose one to go to it."

### S1-71 [OK-NOTE]  Factory, Central › device head menu and track menu
Right-click on a device head lists `Fold, Rename, Group, Save as preset, Hot-swap, Show automation, Map` — exactly §16.4. A Factory clip's menu: `Launch (dimmed), Stop, Cut Copy Duplicate Delete (dimmed), Rename, Switch off, Edit info text (dimmed), colours`; a track's: `Rename Duplicate Delete (dimmed), Switch off, Solo, Arm, Group Move left Move right (dimmed), Colour (dimmed)`.

### S1-72 [MISSING]  Factory, Central › track menu has no Fold, no Retry
Seen: the track's menu has no `Fold (U)` entry (items: Rename, Duplicate, Delete, Switch off, Solo, Arm, Group, Move left, Move right, Colour) (aria dump). Group headers fold with their ▼ (works: clicking `Factory280 ordinary` hides its member `Commission-scoped…`; click again restores).
Expected: §10.9 Track: "Fold (U) … Retry, when its lane has stalled; In Central, Open and Reveal the world's folder". Central's track menu was not opened (not retried).

### S1-73 [MISMATCH]  Central › Session view › no empty track to drop a world onto
Seen: selecting `Actuation` in the browser reads `Actuation — Actuation's world; its pages are kept in Work/Actuation/ProjectCentral/user. Drag it onto the empty track, or double-click or press Enter, to bring it into today.` The grid shows `Your world`, `cron · firings`, the Main track and a wide empty dark area with no visible empty track or "drop here" slot (shot: 91-central-world-select.png). Not pressed: double-click or Enter (would bring a world into today).
Expected: §10.2 "The grid waits for a drop: a world in Central"; Live's empty track on the right of the grid.

### S1-74 [OK-NOTE]  Central › pool statuses, back/forward, lanes
Pool controls read plainly in the status bar (`Panes Keeps the panes, how they are split and pinned, and what each holds. On: press to turn it off.`, `Launch Bring Central's context back, in the modes On launch says.`, `Keep Store what is in front of you now into Central.`); the column heads are cut to `Pan… Inst… Wid… Lay…` (POLISH). Back and Forward at the title line work (Mon 12 Oct -> Back -> Tue 13 Oct -> Forward -> Mon 12 Oct). Arrangement: `Takes 0` and `Automation 0` lit, `Events 0` off by default (§16.6 defaults), Events lights on press with `Event lanes are Factory's: a session's messages, files, terminal and pages read.`; `+` zooms the ruler (09:00-15:00 at 45 min ticks, overview strip marks the window), `Fit` restores. ⌥⌘9 toggles Pane view and Tab returns to the view left.

### S1-75 [OK-NOTE]  Factory › transport statuses name each control in Factory's terms
Hovering the controls: `Peers`, `Ping`, `Effort`, `Budget`, `Heartbeat`, `Interrupt timing`, `Tokens`, `Follow`, `Position`, `Run`, `Stop all`, `Voice`, `Steer`, `Write arm`, `Hand back`, `Capture`, `Write window`, `Routine`, `Write window out`, `Point`, `Keys`, `Key`, `MIDI`, `Throughput` — each matches §10.5's Factory column (e.g. Stop: `pause at the next quantize, context kept; press again to cancel the turns`). Disabled controls (nearly all of Central's, and several of Factory's) give no reason except Ground sync / Peers, whose text is `… missing op: aikit gateway remote add · remove through the kernel (the link has no off switch of its own) (AIKit)` (jargon).

### S1-76 [MISMATCH]  All modes › status bar › Clip and Device switches carry no picture
Seen: the Clip switch is a document icon and the word `Clip`; the Device switch is a clock icon and the selected track's name (cut with an ellipsis: `Prove project-scope accepta…`, `Factory280 r3 producer: insp…`), with no small picture of the clip or of the chain (shot: 98-switches-crop.png). The name part is the right idea, the pictures are missing.
Expected: §10.1 "Clip: the switch carries a small picture of the selected clip. Device: the switch carries the selected track's name and a small picture of its chain."

### S1-77 [POLISH]  Trail widget › marker circles print over long labels
Seen: in the Trail widget on the rail, a ring marker sits at the right end of a stop's line and overprints the last letters of long names (`Prove project-scope acceptance after the` ○ / `Factory280 r3 producer: inspect the immu` ○) (shot: 96-factory-projects.png, 20-factory-first.png).

### S1-78 [POLISH]  Factory, Technē, Central › browser lists and pool: clipped headings
Seen: pool column heads read `Pan… Inst… Wid… Lay…` (all modes); Factory Projects list shows bare names with a bullet and an empty State column (`Project · chats  State`); Technē Sources reads `No works disclosed / The retained app has not disclosed its works in this reading. Sources to hand lists the open works; each opens in its instrument.` (shot 40-techne-first.png). Not wrong, but the retained-app wording shows how the owner is built, not what the user can do.

### S1-79 [MISMATCH]  Factory › browser Devices list is almost empty
Seen: `Devices › Skillsets` lists one row (`skill/actuation/actuation-operation  admitted`); `Devices › Runs` lists `Run  on chain` and `Runs  on chain`. No Agent, Scope, Packet, Approvals, Skillset rack, Git or Seat rows to put on a chain (shot: 96-factory-devs.png).
Expected: §16.7 "Instruments, devices and widgets are the same in every mode, grouped by the product that makes them."

### S1-80 [POLISH]  Central › Arrangement view › selection carried from Session view is not visible
Seen: select `flow-2026-09-23-1832` (a clip with no place on the ruler) in Session view, press Tab: the track head `Your worl` looks unchanged (same background, no outline or light); the clip with a place (`Shared field — …`) is not outlined either (shot: 100-select-carries-crop.png). The title line, Trail and Device view do carry the selection.
Expected: §10.2 "Where the clip has a place in the view you switch to, that place is selected and scrolled into sight. Where it has none … its track's head lights."

### S1-81 [OK-NOTE]  Factory, Central › ⌥⌘R, ⌥⌘I, ⌥⌘M work
⌥⌘R hides and shows Factory's workcell return tracks (env-1, env-2, env-3 leave the grid and return); ⌥⌘I hides and shows the In/Out text of every track's mixer strip; ⌥⌘M hides and shows the mixer strip (Central). Group fold ▼ hides and restores a group's members.

### S1-82 [OK-NOTE]  Central › Keep on rail
`Keep this device on the widget rail` (📍 on the Approvals head) adds an `Approvals` tile to the rail (`0 wait  Nothing waits.`, with ⊞ ↗ ✕); ✕ takes it off again; the launcher's Packet tile does the same (`Packet 4 …` rows of raw HTML). The rail holds Fizz, Trail and a third widget but cuts the third at the foot (scrolls under the launcher).

### S1-83 [OK-NOTE]  Central › Clip view against the catalogue
`gallery/clip__base.png` is the catalogue index, not a design. The live gallery at `?clip=central` shows the design: head on its colour; Clip / Launch / Ties (Being) or Clip / Launch / Participants (Flow) tabs; Text / Highlight / Notes; editor with `As Frank ▾ | Reply ▾ | Media | Dialogue Flow Journal Source` and a revision label at the right (`Unchanged · 7be0d13`), notes column at the right. The shell's Flow clip has the same arrangement (Clip / Participants, Text / Highlight / Notes, `As the person ▾ | — ▾ | Media`, Dialogue Flow Journal Source, notes column) without a Launch tab (as §16.5 says for Central); the revision label reads `— · :062d2c9ad451 · 45962 B` and Save reads `—` (the design reads `Saved`, `a41c9e2`). The second drop-down reads `—` where the design reads `Reply`.

### S1-84 [MISMATCH]  Technē, Expressions › mockup regions
Seen: Technē's main area holds one pane saying `Earth could not mount …` (see S1-40); the mockup's `World / Places` body fills it. The mockup's detail area holds `M0′ … M5′` strips around an expanded `M4′ World / Places`; the shell holds Project / Canvas / Timeline / Journey / World compact cards. In Expressions the main area is the Studio pane list and an empty stage; the mockup's Studio sits in the detail area as one wide device with TOOLS, SELECTED · THE GLYPH, FORMATION, MATERIAL, MOTION, BODY, NARA, CAPTURE; the shell's detail area holds a Studio rack in Compact (`No reading of your controls`) and a `Stage` card (FRAME TOOLS, VIEW, CAPTURE).
Expected: the mockups are the layout target (`mockups/world-shell-techne.png`, `world-shell-expressions.png`). The shell keeps the regions in the right places; what stands in them differs because no native work is open here (NATIVE-ONLY for the content).

### S1-85 [POLISH]  Factory › narrow window (1180x760)
Seen: the browser (405 px) and the rail (≈260 px) take more than half of the width, leaving the Session grid ≈460 px (3½ tracks); the legend's right end reads `Fa…`; the detail area keeps its full Device-view height (≈290 px) (shot: 25-factory-narrow-session.png). Central narrow: the Packet Full's `462 chars ×` and the entries' right edge are cut by the pane (shot 13-central-narrow-pane.png), the status bar's right readings are truncated (`Development browser · no revision dis…  No host …`).

### S1-86 [BREAK]  Central › Pane view › every pane tab sits under the pane content (confirms S1-05)
Seen: after opening Timeline in the Day pane the page holds tabs `Day`, `Expressions` (both in the left pane, 36x28 at x=369) and `Flow` (x=854), each at the top-left of its pane, and `document.elementFromPoint` at each tab returns the pane's content, not the tab. A second tab in one pane (`Day` + `Expressions`) is therefore also unreachable by mouse: no way to switch tabs, split with ⊞, add with + or double-click a tab to fill the area.
Expected: §10.2 pane tabs, ⊞ split, tab drag and double-click.

### S1-87 [POLISH]  Status bar hint strings carry source paths
Seen: hovering a clip's ▶ in Central reads `Launch Shared field — first curated artifact  Launch (the page owner's launch (kernel/src/page.rs): its NOW clearing allocated, or rejoined, and active)` (extends S1-02). Not pressed: launching a Central clip allocates a NOW clearing, which writes to the owner's field.

### S1-88 [OK-NOTE]  Window-only controls checked and working
⌘, opens Preferences as a dimmed overlay (footer `Development native bridge`), Esc closes it; dragging the browser's right edge and the rail's left edge resizes them and the main area follows, and they drag back; ⇧Tab switches Clip view and Device view when one shows (Clip -> Device -> Clip); Surfaces list (`New tab, Sources, Techné, Epi-Logos, Settings, Library, Identity · Nara, Factory, Automations, Field`) and Sessions list read; `errors` after each mode showed only aborted `event-replay` long-polls, `Draft recovery unavailable … native recovery address` and WebGL `GPU stall` warnings (native-only / harness), no page errors.

## Coverage table

| Area | Status | Note |
|---|---|---|
| Central: regions, wide and narrow | checked | S1-01..19, S1-85 |
| Central: Session, Arrangement, Pane, Tab and ⌥⌘9 | checked | Session grid, ruler, lanes, zoom, Pane switches work; tabs/⊞ unreachable (S1-05/86) |
| Central: clip selection, Clip view, Device view, ⌥⌘E | checked | Flow clip; Being/Thing clips not opened; Clip view design compared to `?clip=central` (clip__base.png is blank) |
| Central: browser, pool, ⌥⌘6/B/8 | checked | categories Worlds, Days, Instruments, Surfaces, Sessions, Beings opened; Flows, Things, Goals, Files, Wiki, New…, Ground not opened (New… writes); Launch/Keep not pressed |
| Central: device views Folded, Whole, Full, Pop-out, Widget | checked | Packet and Approvals |
| Central: adding a device from the browser | not reached | no device category in Central's browser (S1-62) |
| Central: drag from browser into pane, drag a clip, drop a world | not reached | synthetic drag opened nothing; dropping writes |
| Factory: regions, Session, Arrangement, Pane, clip, chain, narrow | checked | one task clip only; follow action and Quantize read in Launch tab, not changed |
| Factory: launch, retry, takes, stall | not reached | would write to an agent; no stalled lane; take lanes toggle seen only |
| Expressions: regions, three views, narrow | checked | empty states only (no native Expression); New/Open not pressed |
| Expressions: clip, scene, Clip view | not reached | needs a native Expression (NATIVE-ONLY) |
| Technē: regions, three views, narrow | partly | Earth does not mount (S1-40); screenshots at narrow timed out under load; no events or clips to select |
| Live: regions, three views, narrow | partly | no set can open; torus/clip view NATIVE-ONLY |
| Transport per mode, hover lines | checked | Central, Factory fully; Expressions/Technē/Live positions only |
| Keys: Tab, ⌥⌘3/4/9/L/E/M/R/I/B/6/8, ⇧Tab, Esc, ⌘, ⌘F ⌘K, arrows, U, ⌥0-⌥6 | checked | failures in S1-69 |
| Enter, 1-9, double-click empty slot, Space, follow actions, takes | not reached | all write to an owner or need a launched clip |
| Second window ⇧⌘W, full screen ⌃⌘F | not reached | window-level, not driven here |
