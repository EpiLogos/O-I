# Walk 739 — the native candidate from main, walked against the manual

O-I #739, stage two: the on-screen walk. Prepared 28 Oct 2026 by the stage-one builder; the walk is driven with
computer use. Spec: the manual, `ProjectCentral/docs/1-vision/dlw/DLW.md` (§ numbers below). Starting worlds:
`docs/experience/LOCAL-CAMPAIGN.md` §2.2. Candidate, worlds and Yours's recorded state: `PREPARED.md` beside this file.

## How to walk

**One candidate at a time.** Before every launch run `pgrep -fl oi-cradle`; if one runs, quit it first. Stop only the
pid you launched; never kill by pattern.

**Launch** by binary path, never `open -b` or `open -a` (`~/Applications/O-I Shell Candidate.app` is an 8 Oct build with the
same bundle id). From the seat `/Users/admin/Central/worktrees/env-1/o-i`:

```sh
export P0R1_TARGET="$HOME/.cache/oi-build-lane-739-target" P0R1_STAMP=20261028T231512Z
P0R1_WORLD="$HOME/DLW Worlds/Bare"     bash packages/live-shell/run-native-at-head.sh launch   # Bare
P0R1_WORLD="$HOME/DLW Worlds/Arriving" bash packages/live-shell/run-native-at-head.sh launch   # Arriving
P0R1_WORLD="$HOME"                     bash packages/live-shell/run-native-at-head.sh launch   # Yours
bash packages/live-shell/run-native-at-head.sh quit      # the app menu's Quit, by the pid in launch.pid
```

The launcher writes the pid to `$P0R1_TARGET/p0-r1/$P0R1_STAMP/logs/launch.pid` and the exit code to `quit-exit-code.txt`
beside it. Without the script, the same launch is
`OI_WORLD_FOLDER="<world folder>" "$P0R1_TARGET/p0-r1/$P0R1_STAMP/run/oi-desktop-bundle/app/O-I Shell Candidate.app/Contents/MacOS/oi-cradle"`.
Switching worlds from inside the app (O-I › Worlds) relaunches the candidate under a new pid; the script's `quit` then
no longer knows it — quit from the app menu (O-I › Quit) instead.

**Bring the window forward** with osascript by unix id, never by bundle id:
`osascript -e 'tell application "System Events" to set frontmost of (first process whose unix id is <pid>) to true'`.
A window about 116×120 at a negative x is the candidate parked in Stage Manager's strip; one screenshot brings it front.

**First, every launch:** the status bar reads "Native host · revision a74803a09…" and "6 of 6 owners admitted". If it
names another revision, stop: it is the wrong app.

**Never** type a password, a key, a token or a credential reference anywhere. If macOS asks for the login keychain
("workcell wants to use … "workcell-connection""), do not answer it: capture it, note the step, leave it, and tell the
lead. Never write into Yours except where an item says so (none do). Anything that writes is walked in Bare or Arriving.

**Record each item** as: Seen (what the screen showed) · Expected (the manual's words, cited) · Verdict: works, partly,
broken or not reached · Captures. Label the channel (computer use). Sound is not judged by eye: say "sound not judged"
where an item turns on hearing. A dimmed control's reason is on the status bar when you point at it (§16 "The status bar
says why"): read it and record it.

**Captures** go to `/private/tmp/claude-501/-Users-admin-Central/c55001ab-1082-4cbc-9e73-930a0b173f72/scratchpad/b739/captures/`,
named `<item>-<what>.png` (for example `B2-ground-accepted.png`). Capture the candidate's window only. Captures of Yours
never enter the repository; the lead chooses which starting-world captures do.

**Known traps.** The computer-use layer has aborted with "user interrupt" while the Mac sat idle (28 Oct pass): retry
the step once and note it. Clicks in the title row just above the mode buttons have switched mode (22 Oct N1-10): click
the mode buttons themselves. Keys never act while a document has the focus (§10.8).

**Order.** A then B then C (Bare, Arriving's Setup, the modes in Arriving), then D (Settings), W (the owed ticket walks),
Y (back to Yours) last. G (older owed checks) only if time remains. An item already met inside an earlier one is marked
"see <item>", not walked twice.

---

## A — Bare: the first run (#738; §10.11, §10.10)

World: Bare (nothing in it: no ground, no agent tools, no projects). Every write here lands in `~/DLW Worlds/Bare`.

**A1 · First open.** Launch into Bare.
Expected: "The first time you open the DLW, Settings opens on its Setup page, over Central, which stands on today's Day
and a Flow in Pane view" (§10.11). The Setup page lists five steps in order: Ground, Harnesses and skills, Credentials,
Machines, Projects; nothing has changed yet. Capture `A1-first-open.png` (whole window with Settings over it).

**A2 · Ground.** On Setup › Ground: the table says what it found and the change Accept makes. Press and hold Accept (§10.11
"Accept and Remove are held").
Expected: §10.11 "makes a new one in the folder you choose, under the name you give it". The build offers no folder
chooser or name here: it plans native oi's suggested ground (`settings/windowPages.ts` acceptGround), so record whether
the page lets you choose a folder and a name (a gap if not). The step answers "Central made your ground at <path>" and
reads back accepted; the path must lie inside `~/DLW Worlds/Bare`. Readback: `ls -a <that path>` shows a ground; `ls -ld
~/Central` is unchanged (nothing written into the owner's Central). Capture `A2-ground-found.png`, `A2-ground-accepted.png`.

**A3 · Date of birth.** Expected: "Once your ground is made, Setup asks for your date of birth" (§10.11). If asked, enter a
made-up date for the disposable person (1 January 1990), never the owner's. If no step asks, record it absent (a gap).
Capture `A3-birth.png`.

**A4 · Harnesses and skills.** Expected for Bare: it finds no agent tool and says so in words; nothing to accept; nothing
it cannot read goes unnamed. Capture `A4-harnesses-empty.png`.

**A5 · Credentials.** Expected: no key found; "the place, never the value". Bind nothing. Capture `A5-credentials-empty.png`.

**A6 · Machines.** Expected: this computer's Workcell is read; Accept (held) makes this computer a workcell for the world
and the step reads back done. Capture `A6-machines.png`. Watch for the keychain prompt (see How to walk).

**A7 · Projects — a first project.** Work is empty and Bare has no folder of work elsewhere. First look in the browser's
Work place for Add folder… (§10.11 "Add folder… opens this step for that folder"); the build has no such label in
`packages/live-shell/ui/src`, so expect it absent and record it. Then make the person's folder as they would in Finder,
from a terminal: `mkdir -p "<ground>/Work/first-project" && printf '# First project\n' > "<ground>/Work/first-project/README.md"`
(`<ground>` is the path A2 named). On Setup › Projects press Read again; choose first-project; Make = Create ("ProjectCentral
is made around the folder. Nothing in the folder moves."); Preview; hold Accept.
Expected: the answer "Central made first-project's ProjectCentral beside its material … It reads back in place"; it stands
as a world in the browser's Work place. Readback: `ls -a "<ground>/Work/first-project"` shows ProjectCentral beside
README.md. Capture `A7-projects-preview.png`, `A7-projects-accepted.png`, `A7-work-place.png`.

**A8 · Bring it into today (#806).** Drag `first-project` from the Work place onto the empty track in Central. Then try the
two other ways on a second world if one exists (double-click; select and Enter).
Expected (§10.11, §18.1 The track): "drag it onto an empty track in Central: … a drop on a track admits what you dropped
into the set"; the world becomes a track and its pages its clips. If the Day is stale, all three ways refuse in words
naming Close now, then Open today (#806). Never silence. Capture `A8-bring-in.png`.

**A9 · A first piece of work in each mode** (LOCAL-CAMPAIGN §2.2 Bare row). One small act per mode, in Bare:
Central — write one line in today's Flow and save (⌘S); Factory — drag an agent type from Instruments › Agent onto an
empty track (expect it takes the seat, or a refusal in words: Bare has no harness); Expressions — make a new Expression
and see its field; Technē — the World shows My World ("A world you have barely begun is a grey moon", §2); Live — the torus
turns; press keys on the computer keyboard and points light (sound not judged). Capture one per mode, `A9-<mode>.png`.

**A10 · Relaunch, nothing twice.** Quit (O-I › Quit), launch into Bare again.
Expected: "After that the DLW opens on the world you chose, in the mode and the view you left"; Settings does not open on
Setup by itself; on Settings › Setup every accepted step reads done, and "run it again and nothing is made twice"
(§10.11). The Flow line from A9 is there. Capture `A10-relaunch.png`, `A10-setup-done.png`.

## B — Arriving: Setup adopts what is there (#738; §10.11)

World: Arriving (a disposable person: `code/field-notes` and `code/tide-sketches` git repositories with AGENTS.md /
CLAUDE.md, a Claude Code setup in `.claude/` with two skills, `Notes/`, `Music/Audio` (two .wav), an Ableton set
`Music/Ableton/Tide Sketch Project/Tide Sketch.als` (three tracks, tempo 92, no clips), an Obsidian `Vault/`).

Before launching, record the tool's own bytes for the "keeps working as before" check:
`shasum "$HOME/DLW Worlds/Arriving/.claude/settings.json" "$HOME/DLW Worlds/Arriving/.claude/CLAUDE.md" "$HOME/DLW Worlds/Arriving/.claude/skills/"*/SKILL.md > <scratch>/captures/B0-claude-before.txt`

**B1 · Switch worlds from the menu.** In Bare, open O-I › Worlds: it lists Yours, Bare (✓) and Arriving, and Open World….
Choose Arriving. Expected: the candidate relaunches into Arriving and Settings opens on Setup (a new world). Capture
`B1-worlds-menu.png`, `B1-arriving-first-open.png`.

**B2 · Ground.** As A2, in Arriving: hold Accept; the ground's path must lie inside `~/DLW Worlds/Arriving`. Capture
`B2-ground.png`.

**B3 · Harnesses and skills.** Expected: it finds Claude Code with its settings (model sonnet), its instructions and its
two skills (field-recording-log, weekly-review); Accept adopts the skill roots through AIKit ("its skills keep their
function in the DLW and in the tool itself. The tool's own settings and plugins stay as they are"); a second Accept is
refused. Readback: re-run the shasum above into `B3-claude-after.txt` and diff: identical. Capture `B3-harnesses.png`,
`B3-accepted.png`. (The Skillset rack's adopt-by-path follow-up, c5f7cb58b, is not in this candidate.)

**B4 · Credentials.** Expected: whatever AIKit discovers is listed by place, never value. Bind nothing. Capture `B4.png`.

**B5 · Machines.** As A6. Capture `B5.png`.

**B6 · Projects.** Expected: the step lists the folders standing elsewhere (Central's work.candidates): the two
repositories (with their agent instructions) and the Vault (a wiki), each drawn with its own material at the left and
ProjectCentral at the right, dashed where Accept would make it (§10.11 The Projects step). For `code/field-notes`: Where =
Into Work, Preview, hold Accept: "Central brought field-notes into your ground's Work … the original stays at …". Then,
with the copy in Work chosen: Make = Create, Preview, hold Accept. For `Vault`: bring it Into Work the same way, then Make =
Keep in place (its wiki), Preview, hold Accept. Readback: `ls "$HOME/DLW Worlds/Arriving/code/field-notes"` still there;
`git -C "<ground>/Work/field-notes" log --oneline` shows "Field notes: a listening log of recordings". Capture
`B6-projects-found.png`, `B6-bring-preview.png`, `B6-create-accepted.png`, `B6-vault.png`.

**B7 · Bring field-notes into today.** As A8, with field-notes. Expected: a track named field-notes; its pages are clips.
Capture `B7.png`.

## C — Each mode's core loop, in Arriving

### Central (§5, §18.1, §18.2)

**C1 · How Central opens.** Expected: "Central opens with today's Day and a Flow side by side in two panes, the world's
chain in Device view, and the agent of the world, the Packet and the Trail on the rail" (§18.1). The transport shows
today's date. Capture `C1-central.png`.

**C2 · A page in Clip view.** Select a clip on the field-notes track. Expected: Clip view opens the page for writing; the
Clip panel shows Title (on the clip's colour), Colour, Kind, Constellation (with Show in Browser), Groove, Template,
Revision, Save state (§18.1 The Clip panel). Write a sentence, ⌘S. Save state reads Saved. Capture `C2-clip-view.png`.

**C3 · The packet.** Select a passage you wrote and add it to the packet. Expected: "you see it whole, and how big it is,
before anything is sent" (§5). Do not send it. Capture `C3-packet.png`.

**C4 · The day as lived (#756).** Press Tab for Arrangement view. Expected: "The day as you lived it, from the first entry
to the last" (§18.1 The set); on the Day's track, the moment today's Day opened stands at its instant (#756); no
invented moments. Capture `C4-arrangement.png`.

**C5 · The Day.** Select the Main track. Expected: Clip view opens the Day's open face for writing; the Day device shows the
die's net with the open face lit and Face, View, Close routine, Close now (§16.15 Day); the transport's Punch in shows when
the day opened (§18.2 Transport). Do not press Close now. Capture `C5-day.png`.

**C6 · @.** In the Flow, type `@` and a few letters of `field`. Expected: "it finds anything you can reach — a person, an
agent, a place, a document, a passage" (§5). Escape without sending. Capture `C6-at.png`.

**C7 · The answer's face (#804).** Open the Agent of the world (rail or chain). Expected: "In Central, the answer is a face …
asleep while no conversation is bound"; Hears and Speaks marks at the face's lower corners, a third opens the
conversation (§19.4 The answer's face). Then press the Git row in the agent's context: it opens Files' Diff page (§23.4),
not an empty tile. Capture `C7-face.png`, `C7-diff.png`.

**C8 · Back and Forward (#764).** Central → open a page and scroll to a passage → switch to Technē → switch to Expressions.
Press Back (head of the title line) three times. Expected: you land on the page at that passage; Forward returns to
Expressions; the Trail widget lists the stops newest first with their times (§10.7, §23.5). Capture `C8-trail.png`,
`C8-back.png`.

### Factory (§6, §19.1)

**F1 · Enter Factory.** Switch to Factory. Expected: Session view; agents' tracks; tasks as clips. Watch for the keychain
prompt (do not answer). Capture `F1-factory.png`.

**F2 · Seat an agent.** Drag the adopted Claude Code agent (Instruments › Agent) onto an empty track. Expected: "Drag an
agent from the browser onto an empty track and it takes the seat"; its chain shows the agent (model, autonomy, effort,
turns), the skills rack with a light each, and its scope (§6). Capture `F2-seat.png`, `F2-chain.png`.

**F3 · Write and fire a task.** Double-click an empty square, write "List the recordings field-notes knows about", press
Enter to launch. Expected: drawn by how it stands — Queued blinks with no length, Running has no end (§19.1 The clip); or,
if the harness cannot run in this world (no sign-in here), a refusal in words naming why. Never a silent nothing.
Capture `F3-task.png`.

**F4 · The Clip panel and the Launch panel (#787, #772).** Select the task; Clip view. Expected: the Clip panel shows Name,
Colour, Constellation, Groove, State, Turns, Output style, Loop; the Launch panel shows Launch mode Trigger · Gate ·
Toggle · Repeat and Then Next task · Again · Stop, and Quantize (§19.1). Point at Trigger: the status bar reads "Trigger
— Starts the task when you press its launch". Capture `F4-clip-panel.png`, `F4-launch.png`.

**F5 · Loop (#795).** Set Loop On; choose its stop condition (Task done, then Test pass) and a cap of 3. Select another clip
and come back. Expected: the values read back from AIKit (§19.1 "Runs the task again after each finish, until its stop
condition or the cap"). Capture `F5-loop.png`.

**F6 · Repeat (#795).** Set Launch mode Repeat. Expected: Variable, Levels, Repeats and Stop when appear (§19.1 Launch panel
second table). Press the launch. Expected: takes run as a set (needs Autonomy auto: takes cancel permission asks), or a
refusal in words before anything is written; while the takes run the four fields stand disabled ("Once the first run
starts, these do not change"). Capture `F6-repeat.png`.

**F7 · Gate and Toggle (#795).** Gate: press and hold the launch, then release. Expected: runs only while held; release
stops it. Toggle: press once (starts), press again (stops). Capture `F7-gate.png`, `F7-toggle.png`.

**F8 · Approvals (#772, #804).** Select Approvals on the Main track. Expected: answers by kind, Show All and Follow On as
defaults (§19.14); no control writes Wait or On no answer ("Approvals shows them and never sets them"). Pop Approvals
out (full screen): a dimmed answer's reason reads on the pop-out's Info line (#806). Capture `F8-approvals.png`,
`F8-popout-info.png`.

**F9 · Arrangement.** Tab. Expected: "Every thread runs along one ruler with a needle that jumps each time its agent
checks in" (§6). Capture `F9-arrangement.png`.

### Expressions (§7, §20.1)

**X1 · A new Expression.** Switch to Expressions; make a new Expression. Expected: the field, a scene, the device area with
the studio and the four chains (material, motion, body, personal) (§7). Capture `X1-expressions.png`.

**X2 · A scene and its sides.** Open the scene in Clip view. Expected: "the sequence step by step, each symbol in its own
lane like a note on a roll, each step's hold and change … and beneath it what the scene sounds like" (§7). Press Play:
the scenes play. Capture `X2-scene.png`.

**X3 · The Field and Resonance (#757).** Open the Field device. Expected: every dial draws its value or, dimmed, its reason;
an absent level draws unread, never "NaN". Resonance says what drives the plate. Capture `X3-field.png`.

**X4 · Kept across a relaunch.** Save; quit; launch into Arriving again; open the Expression. Expected: "an Expression's
scenes, settings and selection come back as you saved them; the field tells you what of its live motion it could not
bring back" (§7). Capture `X4-relaunch.png`.

### Technē (§8, §17.1, §17.2, §17.7)

**T1 · The World.** Switch to Technē. Expected: the World pane: My World (a young world), Earth; come in until a single
place fills the pane with its position (§8). Capture `T1-world.png`.

**T2 · The ruler.** Tab. Expected: the timeline ruler; "Tap returns the window to now" (§17.1 Transport on the ruler).
Capture `T2-ruler.png`.

**T3 · Record a walk (#760).** Arm, then Record; visit three places on the World (or occasions on the time spine); Stop.
Expected: a take ("Take 01") lies on the ruler (§17.1 "Record | Records a walk of the events you meet"); select it and press
Play: it walks the stops at the Tempo, turning the World to each. Capture `T3-take.png`, `T3-play.png`.

**T4 · Capture a view (#760).** Turn the World to a view; press Capture. Expected: "Keeps the present view as a scene"
(§17.1); launching the kept view returns the World to it. Capture `T4-capture.png`.

**T5 · Kept across a relaunch (#760).** Quit; launch into Arriving; Technē. Expected: the take and the kept view still lie on
the ruler and play or reopen. Capture `T5-relaunch.png`.

**T6 · Palace (#761, #757).** On the World, select a palace and choose Enter (if the world has none, Draw one: Draw, then
Palace). Expected (§17.7 To use the Palace): the device's pages Palace, Enter, Whole, Compose, Portals; a room's guide says
why it stands there; Arrangement Method of loci lays "six rooms with four places in each"; Tempo is stepped (2–16 s a room)
and changing it changes the dwell when you press Play; mark a room private: it draws clouded for every audience but you
(set the transport's Key, "as whom", to the public to see the cloud, §8); Return → Propose sends a proposal with your name to Central, and Accept lands
it with a receipt. Capture `T6-palace.png`, `T6-loci.png`, `T6-private.png`, `T6-return.png`.

### Live (§9, §21.1, §21.2)

**L1 · The torus.** Switch to Live. Expected: "a torus, turning in the centre of the pane"; play keys on the computer
keyboard: "a point on the ring lights and answers; play a chord and several points light together" (§9). Sound not
judged. Capture `L1-torus.png`, `L1-chord.png`.

**L2 · Open the person's set.** In the browser (Material › Sets), open `Tide Sketch` (from Arriving's Music/Ableton).
Expected: three tracks, Estuary and Market hall (audio) and Tide pad (MIDI), tempo 92 in the transport. Capture `L2-set.png`.

**L3 · The mode.** In the transport choose a root and a mode (D Dorian). Expected: "the keyboard and the piano roll follow
it, marking the notes that belong and folding away the ones that don't" (§9). Capture `L3-mode.png`.

**L4 · Play a clip (#790).** The set has no clips. Make one: drop a constellation on Tide pad (item W1, #768) if the
browser offers one; else insert a clip (select Tide pad's first slot, ⇧⌘M) and draw three notes in the roll. Select the
clip and press Play. Expected: "In Clip view, the Torus plays the notes of the clip that you select" (§21.2); the notes
show on the surface in time; Stop ends it; leaving Live stops it. If no clip can be made here, walk this in Yours (Y3).
Capture `L4-play.png`, `L4-stopped.png`.

## D — The Settings window (#758; §10.10)

**D1 · Open and its parts.** Press ⌘, (or O-I › Settings…). Expected: pages down the left, the page beside them; a head with
Search, the owners' connection (any owner it cannot read, and why), Read again, and the way back naming the work you
came from; a foot with your local changes, Discard and Review changes; nothing scrolls, long lists turn with ‹ ›
(§10.10 The window). Capture `D1-window.png`.

**D2 · Every page.** Walk each page down the left and capture it: Setup, Harnesses & models, Skills & methods (if shown),
Profiles, Permissions (if shown), Credentials, Machines & services, Automations, Search & telemetry (if shown), Sources
& libraries (if shown), Appearance, Products & updates, System. Expected per §10.10 The pages; Products & updates lists six
products, a full install, none added or removed; no owner's raw record (JSON) stands on any page; every secret shows its
reference only. Capture `D2-<page>.png` each.

**D3 · Search.** Type `theme` in Search; move with ↑ and ↓; press Enter. Expected: you go to the setting. Capture `D3.png`.

**D4 · A change and its review.** On Appearance choose Dark. Expected: the row takes an amber mark, the page's name and
the foot count it. Press the setting's name: Details (where the owner keeps it, four axes, default, reconciliation,
reading). Undo on the row drops it; make it again; Review changes… lists the owner's plan; Apply; the owner answers in the
table (applied, verified or refused, with its reason). Set it back to what it was. Capture `D4-amber.png`,
`D4-details.png`, `D4-review.png`, `D4-applied.png`.

**D5 · Back.** Esc. Expected: back to the work you came from. Capture `D5.png`.

## W — The owed ticket walks not met above

**W1 · The clip's source in every mode (#768; §10.3, §16.5).** Needs a wiki with constellations: after B6 the Vault is the
world's wiki — look in the browser under Material › Constellations. If it lists none, walk only the reading half in Yours
(Y3) and record the drops as not reached. In each of the five modes: select a constellation; its preview is what this mode
makes of it ("in Central, the writing about it; in Factory, the work it would become; in Expressions, its symbolic form; in
Technē, its reading through a lens; in Live, its sound", §10.3); change mode and it stays selected. Drag it onto a track:
Central makes a page, Factory a task (on a session with a task; on a fresh session AIKit may refuse for want of task
authority — record its words), Expressions a scene, Technē an event, Live a clip. Each new clip's Clip panel names the
constellation; Show in Browser selects it. Capture `W1-<mode>-preview.png`, `W1-<mode>-clip.png`.

**W2 · Left behind in prose (#806).** Open the Workcells tile on the rail (or the Workcell rack) › Left behind. Expected: each
read is the owner's words as prose, never `{"kind":"unavailable",…}` JSON. Capture `W2-left-behind.png`.

**W3 · The surviving designs (#757).** Open each where it is reachable and capture it drawing its owner's value or a reason,
never a made-up value or NaN: harness-model's stage (Factory, the agent's chain); the knowledge graph's Fit (Technē);
Chakra and the M′ matrices' Apply (the map rack); the Sky's Withdraw (Live or Technē, the sky); Skills' Export (the
skillset rack); Scope's Reads rows with include and exclude; the wiki widget showing an external link as it is; the
workcell's World chooser; the session grid rolling a group up with full-height rails (Factory); the Ledger by ref; the
Remote carrier's Standing run chooser. Capture `W3-<device>.png`.

**W4 · Docs on a world track (#772; §18.5).** In Central select the field-notes track's chain › Docs. Expected: Central's
six-tier account read through `projectcentral.docs.*`; Relate, Recognise, Ensure, Reproject, Initialise root offered; an
unreadable source shows its refusal word for word; Meaning and Moved since read their owners. Capture `W4-docs.png`.

**W5 · The installed ctrl (#756).** Settings › Products & updates › Central. Expected: the version the candidate carries is
the installed `ctrl` (compare with `ctrl --version` in a terminal). Capture `W5.png`.

**W6 · Expressions' recovery and undo (#763) — not in this candidate.** Its commits (db5738c8a, 6d8ef5560) are on
`dlw/build-lane`, not on main at a74803a09. Skip; record "not in this candidate".

## Y — Back to Yours (#738 "switching back to Yours shows the owner's world as it was")

Yours is the owner's real world. Read only: press nothing that writes (no Accept, no Close now, no drops, no edits, no
Apply).

**Y1 · Before opening Yours.** With the candidate quit, compare Yours with the baseline taken before the walk:
`python3 -I /private/tmp/claude-501/-Users-admin-Central/c55001ab-1082-4cbc-9e73-930a0b173f72/scratchpad/b739/yours-state.py after-starting-worlds /private/tmp/claude-501/-Users-admin-Central/c55001ab-1082-4cbc-9e73-930a0b173f72/scratchpad/b739/evidence --since $(cat /private/tmp/claude-501/-Users-admin-Central/c55001ab-1082-4cbc-9e73-930a0b173f72/scratchpad/b739/evidence/walk-baseline-epoch.txt)`.
Expected: `workspace_books` and `candidate_configuration` identical to `yours-walk-baseline.json` (beside this file;
recorded after the carry-over, the registration and the smoke launch): the full-suite book's book_json sha256 and
history_set_sha256, its composition_sha256, and the worlds register's sha256 — except that O-I › Worlds writes the
register's `current` when it switches worlds, so a changed register is read, not failed. Other sessions write `~/.aikit`,
`~/.oi` and `~/.config/oi` all day: open the `.detail.json` and look for anything naming `DLW Worlds`, Bare or Arriving;
there should be none.

**Y2 · Open Yours.** O-I › Worlds › Yours (or launch with `P0R1_WORLD="$HOME"`). Expected: no Setup page (the ground is
bound); the owner's world as the owner left it on 28 Oct (the workspace book carried from the 0-1-2 profile): today's set,
its tracks, the window as kept; "6 of 6 owners admitted". Capture `Y2-yours.png` (scratch only, never the repo).

**Y3 · Read-only checks only Yours can give.**
- #756: Central › Arrangement: the Day's opening moment at its instant (the root Day has been open since 19 Oct; if the
  Day is stale, the Day device says so in words).
- #806: in Central's browser, Worlds: select a world and press Enter only if the Day device says the Day is stale (it must
  refuse in words naming Close now then Open today, writing nothing); if the Day is current, do not bring anything in.
- #768: a clip's Clip panel names its constellation; Show in Browser selects it; change mode and the preview changes.
  No drops.
- #790 (if L4 could not be walked): open a set that has a MIDI clip, select the clip, Play, then Stop. Edit nothing.
Capture `Y3-<ticket>.png` (scratch only).

**Y4 · After.** Quit. Run Y1's command again with the label `after-yours`. Record what the Yours launch itself changed
(expected: the candidate's `full-suite` composition.json and catalogue.json are re-written by the host; the workspace book
gains history only for what was done).

## G — Older owed screen checks (#739's comment; only if time remains)

In Arriving unless noted. Each: capture, and judge against its section.
- **G1** Physics in its six views (§16.3, §20.4): Folded, Compact, Whole, Full, Widget, pop-out.
- **G2** The Skillset rack with an agent session (§19.7): lights, a preview before Apply.
- **G3** Clip view in Factory, Expressions and Technē (§16.5): head with the activator and the name on its colour.
- **G4** The mixer row on an owned track (§16.6): under the slots in Session view.
- **G5** Live: the Effects chain (§21.5), Sky modulation (§22.2), Scale mapping (§21.3), the M3 clock (§22.3).
- **G6** A write landing from a pop-out (§16.4).
- **G7** Live: comp, sends, clip colour, grooves (the third round of Live's acts, §21.1, §16.7).
- **G8** A journey launched as Reading, Walk and Sky; the Day's Close now as a press (in Bare only).
- **G9** Whether the Session · Arrangement pane body stands against §10.2.

## Where each ticket is walked

| Ticket | Items |
|---|---|
| #738 worlds and Setup | A1–A10, B1–B7, Y1–Y4 |
| #756 the Day's opening; the installed ctrl | C4, W5, Y3 |
| #757 the surviving designs | X3, T6, W3 |
| #758 the Settings window | D1–D5 (Setup's page: A1–A7) |
| #760 Record and Capture | T3–T5 |
| #761 the Palace | T6 |
| #763 recovery and undo | W6 — not in this candidate |
| #764 Back and Forward | C8 |
| #768 the clip's source | W1, L4, Y3 |
| #772 the reconciled pages | F4, F8, W4 |
| #787 Factory's words | F4 |
| #790 Live plays a clip | L4 (Y3 if no clip can be made) |
| #795 Loop, Repeat, Gate, Toggle | F5–F7 |
| #804 retired devices; the Answer's face | C7, F8 |
| #806 bring-in, prose reasons, pop-outs | A8, B7, F8, W2, Y3 |

Items: Setup and worlds 21 (A 10, B 7, Y 4) · Central 8 · Factory 9 · Expressions 4 · Technē 6 · Live 4 · Settings 5 ·
owed ticket walks 6 · older owed checks 9 (G, if time remains).
