# Walk 739 — results of the screen walk (28 Oct 2026)

Candidate: O-I main a74803a09 (`source_revision` a74803a094425e22384b717d1ff330f076827b2d, `source_dirty: false`, read from
the host marker; the on-screen status bar line was not readable, see A1). Walker: a computer-use agent on the BACKGROUND
tools only (`app_screenshot`, `app_click`, `app_type`, `app_key`, `app_menu`, `app_drag`, `app_ax_find`), as instructed.
Captures: `screens/` beside this file (window captures taken by window id with `screencapture -l`, a shell step, not the
computer-use tools).

## Second attempt (display-scope control): stopped before the first screenshot

A second walker, with full-screen control approved for the session (`request_full_control` answered "already available"),
launched the candidate into Bare by the script (pid 59023, 23:45 UTC), brought it front with `osascript` by unix id, and
tried `computer_batch`. Every display-scope call aborted with "Batch aborted after 0 of N actions (user interrupt)" before
its first action ran: a `screenshot` at scale 0.5 (twice, with a 3 s wait between), a `wait` + `screenshot`, a
`screenshot` after a further 10 s wait, and a bare `cursor_position`. Six attempts across about a minute; the Mac was
left untouched by the walker in that time. The brief says to stop the walk if the abort persists after one retry, so it
stopped: no pixel of the window was seen, no item was walked, and nothing below changed from the first walker's results.
The abort lies in the computer-use layer, not in the candidate (the process stayed up, `pgrep` showed only pid 59023
and its launcher; no other candidate ran). The candidate was quit through the script (host exit code 0, no oi-cradle
process left). Bare is as the first walker left it (`.actuation .aikit .config .workcell Library`, no ground made);
Arriving and Yours were not launched; `~/Central` was not touched. What a third attempt needs: an interactive session
where the display-scope tools do not report a user interrupt (the likely cause is an input event the tool layer reads as
the user taking the machine back; it needs the person at the keyboard to leave the Mac alone, or the tool layer fixed).

## The first walker: the walk stopped at its first interaction

**Nothing inside the candidate's page can be driven with the background tools.** The window is a WebKit view; the
accessibility tree lists its buttons and fields (`app_ax_find` sees "Accept", "2 Harnesses and skills", Search, the mode
list) but every action aimed at them is refused, in both the frontmost and the Stage-Manager-parked state, and after
`app_release`:

| Tool | Aim | Refusal (the tool's words, shortened) |
|---|---|---|
| `app_click` | element 26 "2 Harnesses and skills"; element 64 "Accept"; a coordinate | "cannot be clicked while O-I Shell Candidate is in the background — this is a canvas/custom view with no accessibility action at that point" |
| `app_type` | element 6, the Search field | "cannot be typed into … accessibility could not write the text here … app_click the field first" (and the click is refused) |
| `app_key` | `tab`, at a coordinate | "cannot be sent that key … neither accessibility nor a background keystroke could deliver it … app_click the target so it holds keyboard focus" |
| `app_drag` | Accept to itself (the held Accept) | "cannot be dragged while … in the background — only text-selection drags work in the background" |
| `app_focus` | element 64 | "was accepted but keyboard focus did not move there" |

Only the menu bar answers (`app_menu`): it lists O-I Shell Candidate (Settings…, Worlds, Hide…, Quit…, Quit and Keep Windows),
Edit, Create (Insert Clip, Insert Row), View (Session / Arrangement / Pane View, Browser, Pool, Widget Rail, Clip View, Device
View, Expand Clip View, Mixer, In/Out), Workspace (New Tab, New Terminal, New Browser Pane, Go to Web Address…, New Workspace…,
Rename Workspace…, Recover Saved Arrangement…), Window. But with Settings open over the work, "Settings…" and the three
Worlds entries (Yours, Arriving, Open World…) read as disabled and were not pressed. The one thing the walk needs most,
the held Accept (§10.11, 900 ms: `MOTION.hold` in `inhabitants/sdk/panel.tsx`; a pointer press or Space/Enter held), has no
background route: a drag is refused, and a keystroke goes down and up at once, so it springs back. Everything after the Ground
step (and every mode, which is entered by clicking its button) therefore stands behind that wall.

**What the walk needs to go on:** the display-scope tools (`request_full_control`, then `computer_batch` with
`left_click`, `left_mouse_down` / `wait` / `left_mouse_up` for the held Accept, `left_click_drag`, `mouse_move` for the status
bar). The brief said not to request them, so they were not requested, and no shell-side input injection was tried either.
The worlds are in the state the walk needs: Bare holds only the world's own homes (`.actuation .aikit .config .workcell
Library`), no ground was made; Arriving is untouched (84 files); `~/Central` unchanged. `captures/B0-claude-before.txt` (the
four hashes of Arriving's `.claude`) is recorded in scratch for B3.

Stage Manager note: making another app frontmost parks the candidate as a tilted thumbnail in the strip; `osascript` by unix
id (never the bundle id) brings it back, as the checklist says. Launches by the script: pids 53774 and 56554, both quit through
the script (host exit code 0 each), no candidate left running, no other candidate was ever running.

## Per item

Result words: WORKS, PARTLY, FAILS, BLOCKED (could not be driven: reason given), NOT REACHED. Channel: computer use,
background tools, plus the menu bar. Screenshots: `screens/<file>`.

### A — Bare: the first run (#738)

| ID | Ticket | World | Result | What was seen | Screenshot |
|---|---|---|---|---|---|
| A1 | #738 | Bare | PARTLY | Launch into the empty Bare opens Settings over Central on its Setup page: "SETUP 0 of 5 accepted", five steps in order, Ground · Harnesses and skills · Credentials · Machines · Projects, none ticked. The head reads "Choose the native personal ground to open its work." Behind it, Central's own head reads "Central location / No default Central selected / Choose Central…" (blurred): whether Central stands on today's Day and a Flow in Pane view could not be seen, and the status bar ("Native host · revision …", "6 of 6 owners admitted") lies under the Settings window and could not be reached, so the revision check is from the host marker (a74803a09), not the screen. | `A1-first-open.jpg` |
| A2 | #738 | Bare | PARTLY | Ground step: one row, Found "A new ground", Where "/Users/admin/DLW Worlds/Bare/…" (cut off by the column), the change "Central makes your ground here and checks it · nothing else is m…" (cut off), state "found", an Accept button. The page offers no folder chooser and no name field: the gap the checklist expected. The held Accept was not pressed (no route, see above); afterwards Bare holds no ground, `~/Central` unchanged. Full path and full sentence not readable (no way to widen or select). | `A1-first-open.jpg` |
| A3 | #738 | Bare | BLOCKED | Needs A2's accept (a made ground) before the date-of-birth step can appear. | — |
| A4 | #738 | Bare | BLOCKED | Step 2 cannot be opened (clicks refused). | — |
| A5 | #738 | Bare | BLOCKED | Step 3 cannot be opened. | — |
| A6 | #738 | Bare | BLOCKED | Step 4 cannot be opened; the keychain prompt was never in play. | — |
| A7 | #738 | Bare | BLOCKED | Step 5 and the browser's Work place cannot be reached; first-project folder not made (nothing to read yet). | — |
| A8 | #806 | Bare | BLOCKED | Needs a world in the Work place and a drag. | — |
| A9 | — | Bare | BLOCKED | No mode can be entered. | — |
| A10 | #738 | Bare | BLOCKED | Not walkable (nothing accepted). One control seen on the way: quitting and launching Bare again with nothing accepted opens Settings on Setup again, "0 of 5 accepted", as it should for a world still new. | `A1b-relaunch-unaccepted.jpg` |

### B — Arriving (#738)

| ID | Ticket | World | Result | What was seen | Screenshot |
|---|---|---|---|---|---|
| B1 | #738 | Bare → Arriving | PARTLY | O-I › Worlds lists, through the menu bar, "Yours", "✓ Bare", "Arriving", "Open World…" (Bare ticked, as expected). Choosing Arriving was refused: the entry reads as disabled while Settings stands open on Setup (cause not established: Setup open, or the app's own validation; the menu says only "disabled"). The relaunch into Arriving was therefore not seen. | none (a menu is not in the window capture) |
| B2 | #738 | Arriving | BLOCKED | Not reached (needs B1's relaunch and a held Accept). | — |
| B3 | #738 | Arriving | BLOCKED | Not reached. Only the "before" hashes exist (scratch `captures/B0-claude-before.txt`); no "after" compared. | — |
| B4 | #738 | Arriving | BLOCKED | Not reached. | — |
| B5 | #738 | Arriving | BLOCKED | Not reached. | — |
| B6 | #738 | Arriving | BLOCKED | Not reached. | — |
| B7 | #806 | Arriving | BLOCKED | Not reached. | — |

### C — Central, in Arriving

| ID | Ticket | World | Result | What was seen |
|---|---|---|---|---|
| C1 | — | Arriving | BLOCKED | Arriving cannot be entered (B1). |
| C2 | — | Arriving | BLOCKED | Same. |
| C3 | — | Arriving | BLOCKED | Same. |
| C4 | #756 | Arriving | BLOCKED | Same. |
| C5 | — | Arriving | BLOCKED | Same. |
| C6 | — | Arriving | BLOCKED | Same. |
| C7 | #804 | Arriving | BLOCKED | Same. |
| C8 | #764 | Arriving | BLOCKED | Same. |

### Factory F1–F9 · Expressions X1–X4 · Technē T1–T6 · Live L1–L4

All 23 items: BLOCKED. A mode is entered by clicking its button in the page, and every click is refused (see above); no
mode, no clip, no drag, no key could be tried. Tickets owed: #757 (X3, T6), #760 (T3–T5), #761 (T6), #772 (F4, F8), #787 (F4),
#790 (L4), #795 (F5–F7), #804 (F8), #806 (F8).

### D — The Settings window (#758)

| ID | Ticket | World | Result | What was seen | Screenshot |
|---|---|---|---|---|---|
| D1 | #758 | Bare | PARTLY | Seen on the Setup page only. Pages down the left: Setup; under PREFERENCES Harnesses & models, Profiles, Credentials, Machines & services, Automations, Appearance; under SYSTEM Products & updates, System (no Skills & methods, Permissions, Search & telemetry or Sources & libraries pages in this candidate's list). Head: "Search settings", the line "Choose the native personal ground to open its work.", "Read again" (dimmed) and "← Back to work" (it does not name a work, as none was left). Foot: "No local changes" and a dimmed "Review changes…"; no Discard control shows with no change. The owners'-connection line (any owner it cannot read, and why) was not visible beyond that sentence. Nothing scrolled on this page. | `A1-first-open.jpg` |
| D2 | #758 | Bare | BLOCKED | No page can be opened. | — |
| D3 | #758 | Bare | BLOCKED | Search cannot be typed into. | — |
| D4 | #758 | Bare | BLOCKED | No setting can be pressed. | — |
| D5 | #758 | Bare | BLOCKED | Esc cannot be delivered. | — |

### W — The owed ticket walks

| ID | Ticket | Result | What was seen |
|---|---|---|---|
| W1 | #768 | BLOCKED | Needs the Vault as a wiki (B6) and the modes. |
| W2 | #806 | BLOCKED | Needs the rail and the Workcells tile. |
| W3 | #757 | BLOCKED | Needs the modes and devices. |
| W4 | #772 | BLOCKED | Needs Arriving's field-notes world (B6/B7). |
| W5 | #756 | BLOCKED | Needs Settings › Products & updates (a click). |
| W6 | #763 | NOT REACHED | Not in this candidate (db5738c8a and 6d8ef5560 are on `dlw/build-lane`, not on main a74803a09); skipped as the checklist says. |

### Y — Back to Yours

| ID | Ticket | World | Result | What was seen |
|---|---|---|---|---|
| Y1 | #738 | Yours (shell only) | WORKS | Run of the checklist's command (`yours-state.py after-starting-worlds … --since <walk-baseline-epoch>`, read-only): `workspace_books` and `candidate_configuration` are identical to `yours-walk-baseline.json`, including the worlds register (sha256 f66bb7b5…35e4, mtime 23:16:35, unchanged: no world switch happened). The `.detail.json` has no line naming `DLW Worlds`, Bare or Arriving. Two launches into Bare changed nothing of Yours. Channel: shell, not the screen. |
| Y2 | #738 | Yours | NOT REACHED | Yours was not opened (nothing in the page can be read or driven; opening it would only have shown a window). |
| Y3 | #756, #806, #768, #790 | Yours | NOT REACHED | As Y2. |
| Y4 | #738 | Yours | NOT REACHED | No Yours launch, so no "after-yours" run. |

### G — Older owed checks G1–G9

Not walked (the walk stopped before time remained).

## Counts (63 numbered items A–Y; G not walked)

| Result | Count | Items |
|---|---|---|
| WORKS | 1 | Y1 |
| PARTLY | 4 | A1, A2, B1, D1 |
| FAILS | 0 | none was proven broken; none could be tried |
| BLOCKED | 54 | A3–A10, B2–B7, C1–C8, F1–F9, X1–X4, T1–T6, L1–L4, D2–D5, W1–W5 |
| NOT REACHED | 4 | W6 (not in candidate), Y2, Y3, Y4 |

(1 + 4 + 0 + 54 + 4 = 63. A10 stays BLOCKED; its control is noted inside the row.)

## Per-mode summary

- **Setup / worlds.** What was seen works as written: a new world opens Settings on Setup with five steps and "0 of 5
  accepted"; the Ground step finds "A new ground" under Bare and offers Accept; relaunching Bare with nothing accepted opens
  Setup again; O-I › Worlds lists Yours, Bare (ticked), Arriving, Open World…. One gap seen, as the checklist predicted: the
  Ground step offers no folder chooser and no name (§10.11 says it should). Not seen: any accept (the held Accept cannot be
  made with the background tools), the date of birth, Harnesses, Credentials, Machines, Projects, bring-in, relaunch with
  everything done. Worlds entries were disabled while Setup stood open.
- **Central, Factory, Expressions, Technē, Live.** Not walked. No mode could be entered; nothing is known from this walk
  about whether they work.
- **Settings.** The window's shape on the Setup page matches §10.10 (pages left, head, foot); the page list is nine pages,
  fewer than the manual's list (no Skills & methods, Permissions, Search & telemetry, Sources & libraries). No page past
  Setup was opened; Search, a change and its review, and Back were not tried.
- **Yours.** Unchanged by this walk (Y1). Not opened.

## Next step

Re-run the walk with display control granted (the held Accept, drag and drop, hover for the status bar's reasons and mode
buttons all need it), from the same candidate: Bare is clean and Arriving untouched; the launch commands in `PREPARED.md` are
unchanged. The scratch helper `/private/tmp/claude-501/-Users-admin-Central/c55001ab-1082-4cbc-9e73-930a0b173f72/scratchpad/b739/cap.sh <name> [yours]`
captures the candidate's window by id into `screens/` (or the Yours scratch folder).

---

# Headless walk (28 Oct 23:55 – 29 Oct 00:50 UTC, 2026)

The same checklist through the same UI against the real owners, headless, while computer use on the native candidate is
blocked. Walker: a builder subagent. Nothing was committed; only this section and `screens/h-*.jpg` were written into the seat.

## How it was run

- **Source:** the seat at main a74803a09 (the candidate's source). `walk-bridge` (desktop/cradle/kernel) and the live-shell
  server built into a private target (`~/.cache/oi-build-lane-739h-target`, deleted at the end); the shell UI from the seat by vite;
  the Expressions frame served from the candidate bundle's own built `live-shell/expressions`.
- **Owners:** the candidate's frozen binaries from its bundle (`native-products/*/bin`, `live-shell/bin/oi`): central 575de6b0f51f,
  actuation, ai-kit, factory, workcell, quaternal-logic, exactly as `native_shell.rs` pins them.
- **Worlds:** copies in scratch (`…/scratchpad/b739h/worlds/`): Arriving copied whole (84 files, `.claude` hashes equal to the
  first walker's B0); Bare made empty, as the walk's first run starts (the original holds the first walker's launch homes, whose
  files name `/Users/admin/DLW Worlds/Bare`, so copying them would have pointed writes at the original). The originals were not touched.
- **Entering a world** mirrors `world_folder.rs` `environment` and `native_shell.rs` `prepare`: every `PRODUCT_HOMES` variable
  cleared; `HOME` = the world folder, `OI_NATIVE_HOME`, `OI_WORLD_FOLDER`; `OI_HOME` = `<world>/.config/oi-shell-candidate/full-suite`,
  `OI_DATA_HOME`, `XDG_CACHE_HOME`, `OI_EXPRESSION_HOME` = `<world>/.oi`, `OI_CATALOG`, `OI_BIN`, the `OI_*_BIN` owner pins, the QL
  runtime bindings, and the composition/catalogue written as `prepare` writes them. A relaunch is a stop and start of the stack;
  each world has its own persistent browser profile (the world's own webview store). The processes ran with cwd = the seat, as the
  scripted launch does.
- **One shim, named:** the development `/api/config` carries no `onboarding` or `world` (application.ts: "Absent on the
  development bridge"), so a scratch front proxy adds the fields the native `config()` computes: `personal_ground` from the
  candidate composition, `onboarding` = no ground, `world` (name, folder, the worlds register's listing read-only), and drops
  `world_error` while onboarding. Without it a new world would not open Settings on Setup. The status bar therefore reads
  "Development browser · no revision disclosed", not the native revision line.
- **Browser:** Playwright headless Chromium (GPU flags), 1512×945, a development build (StrictMode). The native host is WebKit and a
  production build; where a finding could be the channel's, the row says so.
- **Yours afterwards:** `yours-state.py after-headless` against `yours-walk-baseline.json`: `workspace_books` and
  `candidate_configuration` identical, the detail file names no scratch world; `~/Central` mtime unchanged.

Result words: HEADLESS-WORKS, HEADLESS-PARTLY, HEADLESS-FAILS, NATIVE-ONLY, NOT REACHED. Screenshots: `screens/h-<item>….jpg`.

## Per item

### A — Bare (#738)

| ID | Ticket | World | Result | What happened | Screens |
|---|---|---|---|---|---|
| A1 | #738 | Bare | HEADLESS-WORKS | Settings opens over Central on Setup, "0 of 5 accepted", Ground · Harnesses and skills · Credentials · Machines · Projects; behind it Central stands in Pane view with Day and Flow panes (both empty: no ground yet). | h-A1-first-open |
| A2 | #738 | Bare | HEADLESS-PARTLY | Held Accept (1.3 s press) made the ground at `<world>/Central` (`.central Control Work`), read back "Your ground · Central keeps it here · nothing in it moved · accepted"; `~/Central` unchanged. No folder chooser and no name on the step (gap). | h-A2-ground-found, -accepted, -readback |
| A3 | #738 | Bare | HEADLESS-FAILS | No step asks for the date of birth once the ground is made; Setup has its five steps only and no code in the shell asks. | — |
| A4 | #738 | Bare | HEADLESS-PARTLY | Not "no agent tool": AIKit lists 11 tools found by their programs on this computer (claude-code, codex, gemini, pi, hermes, hermes-acp, ollama, openclaw, kimi; opencode, prime on page 2), each "left as it is" with the reason "It keeps no skills here"; Accept dimmed "Nothing found to bring in." openclaw's place reads `/Users/admin/.openclaw`, Yours's home, while every other tool is read under the world. | h-A4-harnesses |
| A5 | #738 | Bare | HEADLESS-PARTLY | Names and "process environment" only, never a value; but a Bare world finds 7 keys (DEEPSEEK, GEMINI, OPENROUTER bindable; four left as they are) from the launching process's environment. Nothing bound. | h-A5-credentials |
| A6 | #738 | Bare | HEADLESS-WORKS | "This computer · workcell:local"; held Accept: "Central adopted this computer as your current machine, bound to Workcell workcell:local, and read it back. Your world is read again with it." The world qualified (world_scope bound). No call blocked on a keychain prompt (a macOS dialog itself cannot be seen headless). | h-A6-machines-found, h-A6-machines |
| A7 | #738 | Bare | HEADLESS-PARTLY | No Add folder… in the browser (gap). After `mkdir Work/first-project` + README, Read again found it; Create; Preview listed projectcentral.init lines; held Accept: "Central made first-project's ProjectCentral beside its material. It reads back in place." `ls` shows ProjectCentral beside README.md; Worlds lists first-project (project). | h-A7-projects-preview, -accepted, h-A7-central-after-setup |
| A8 | #806 | Bare | HEADLESS-FAILS | The drop is refused in words, never silent: "first-project cannot come into today: today's set is kept in today's Day, which Central did not read: no DayRef or current today pointer". But no Day can exist in a new world: New… › Day is refused "Central's civil time is denied: requires one explicitly recognised civil-time-policy source; the current Day cannot be ensured" (`central.time.policy` agrees). The made ground has no civil-time policy; neither the refusal nor the Day die offers a way on (no Open today). | h-A8-bring-in, h-A8-new-day, h-A8-day-die-whole |
| A9 | — | Bare | HEADLESS-PARTLY | Central: the Flow pane had no document; New… › Flow made one (a double-click made it, then said "The new tab did not open in the focused pane, so nothing was made"); a line written; ⌘S in the Flow did not save headless, the pane's Save did ("saved — native save acknowledged", the line is in the file). Factory: every read refuses "Project is outside Central's disclosed ground" (the shell asks project O-I); no agent to drag. Expressions: New Expression opens a field and Studio, saved into the world's `Control/user/flows`. Technē: "Earth could not mount — No workspace is bound for the Earth projection, so its settings have nowhere to live." Live: the field draws; torus NATIVE-ONLY ("No reading of the pulses", "MIDI input refused: this window is not the native O-I host"). | h-A9-central, -new-flow, -factory-enter, -expressions, -techne, -live |
| A10 | #738 | Bare | HEADLESS-PARTLY | After relaunch: opens in Live as left, no Settings over it; ⌘, opens Settings on Harnesses & models; Setup "3 of 5 accepted" (Ground, Machines, Projects), Ground's Accept dimmed "Accepted." (nothing twice); the Flow line is there. Harnesses and Credentials never read accepted in a world with nothing to adopt or bind, so Bare's Setup cannot reach 5 of 5. | h-A10-relaunch, -setup-done, -central-flow |

### B — Arriving (#738)

| ID | Ticket | World | Result | What happened | Screens |
|---|---|---|---|---|---|
| B1 | #738 | Arriving | NATIVE-ONLY | O-I › Worlds is the Tauri menu. Entered headless by starting the stack in Arriving: Settings opened on Setup, "0 of 5 accepted" (a new world opens on Setup: works). | h-B1-arriving-first-open |
| B2 | #738 | Arriving | HEADLESS-WORKS | Held Accept: "Central made your ground at `<world>/Arriving/Central` and checked it. Your world's state is kept beside it."; reads back accepted, inside the world. | h-B2-ground |
| B3 | #738 | Arriving | HEADLESS-PARTLY | Finds claude-code at `.claude/skills` with its 2 skills (field-recording-log, weekly-review); its settings (model sonnet) and its instructions are not shown. Held Accept: "AIKit adopted 2 skills from claude-code (skill/claude/field-recording-log, skill/claude/weekly-review) and reads them back as its own…"; a second Accept dimmed "Accepted.". shasum before/after identical, but both SKILL.md files are now symlinks into `<world>/.aikit/registries/personal/capsules/skill/claude/*/payload/SKILL.md`: same bytes, changed form. | h-B3-harnesses, -p2, -accepted |
| B4 | #738 | Arriving | HEADLESS-PARTLY | As A5: by place ("process environment"), never value; the keys are the launching process's, not the world's. Nothing bound. | h-B4-credentials |
| B5 | #738 | Arriving | HEADLESS-WORKS | As A6, read back bound to workcell:local. | h-B5-machines |
| B6 | #738 | Arriving | HEADLESS-PARTLY | Lists Vault, field-notes, tide-sketches as "elsewhere", drawn material left and dashed ProjectCentral right; every row "Central finds: no wiki"; agent instructions not named. Preview stays dimmed "Choose what to make first." for an elsewhere folder until some Make is chosen, though the bring ignores it. field-notes: bring preview (35 files, its .git comes with it, the original stays); held Accept brought it; Create made its ProjectCentral; `git log` reads "efe034f Field notes: a listening log of recordings"; the original stands. Vault: brought into Work, but Keep in place is refused "The folder keeps no wiki": Central's projectcentral.inspect sees an `obsidian` source signal and no wiki candidate. | h-B6-projects-found, -bring-preview, -bring-accepted, -create-accepted, -vault |
| B7 | #806 | Arriving | HEADLESS-FAILS | Drag, double-click, and select + Enter all refuse in the same words as A8; no Day can be made (civil time). No track. | h-B7 |

### C — Central, in Arriving

| ID | Ticket | Result | What happened | Screens |
|---|---|---|---|---|
| C1 | — | HEADLESS-PARTLY | Day and Flow side by side in Pane view; the chain in Device view (Day die, Approvals, Packet, Agent, Scope, Docs); the rail holds the agent of the world (Fizz), Trail, Messages, Packet. The agent refuses "Project is outside Central's disclosed ground"; the transport shows no date; the Day is refused (none exists). | h-C1-central |
| C2 | — | NOT REACHED | No field-notes track (B7), so no clip to select. | — |
| C3 | — | HEADLESS-PARTLY | A selected passage goes "To packet" inside the Flow (its ⋮ menu: "Context packet 1"), but the Packet device reads "No reading of the packet · — items · — ch" and the transport's Selection → packet stays dimmed with no reason: nothing shows the packet whole or its size. Not sent. | h-C3-packet, -packet-menu |
| C4 | #756 | HEADLESS-PARTLY | Arrangement: lanes Your world (the Flow as a clip on the ruler), cron · firings, Day (Main); no invented moments, and no Day opening (no Day). The ruler reads 0…1.9, not times of day. | h-C4-arrangement |
| C5 | — | NOT REACHED | The Main track's chain holds Day die and Approvals only: no Day device (Face, View, Close routine, Close now), no Clip view of a Day; Punch-in "empty until the owner gives one". No Day exists. | h-C5-day |
| C6 | — | HEADLESS-FAILS | `@field` typed in a Flow entry, and in the agent's composer, opens no finder; the text stays literal. | h-C6-at, -at-composer |
| C7 | #804 | HEADLESS-PARTLY | The rail's agent of the world shows a refusal (project O-I), not a face. The chain's Agent device draws a face, turn not read; Hears and Speaks sit dimmed in its Voice column, not at the face's corners; its Context page has no Git row, so the Diff page was not reached. | h-C7-face, -context |
| C8 | #764 | HEADLESS-WORKS | Flow at entry 1 → Technē → Expressions; Back ×3 lands on the Flow at entry 1; Forward steps one stop on; the Trail lists the stops newest first with times. | h-C8-back, -trail |

### Factory, Expressions, Technē, Live (Arriving)

| ID | Ticket | Result | What happened | Screens |
|---|---|---|---|---|
| F1 | — | HEADLESS-FAILS | Session view: "The agent sessions are unread: Project is outside Central's disclosed ground"; Sessions, Agents and Skillsets refuse the same; "Temporal read refused: civil time refused: central.time.policy carries no policy object". The shell asks project `O-I` by name (useAgencySessions.ts `PROJECT = 'O-I'`, AgentThreadView.tsx, AgentDockTileBody.tsx, expressionOwners.ts, CentralHygieneDevice.tsx, skyPresences.ts, qlM3Clock.ts, panels/expressions.tsx). | h-F1-factory |
| F2 | — | NOT REACHED | The adopted Claude Code agent is not listed (Agents refuses, as F1). | h-F2-agents |
| F3–F7 | #787, #772, #795 | NOT REACHED | No session and no track to write, launch, loop, repeat, gate or toggle. | — |
| F8 | #772, #804 | HEADLESS-PARTLY | The Approvals device (read in Central's chain): Show All, Order Oldest first, "Nothing waits"; no control writes Wait or On no answer. In Factory the Main track's Approvals is in the page but not shown. The pop-out is a native window (NATIVE-ONLY). | h-F8-approvals |
| F9 | — | NOT REACHED | No threads (no sessions). | h-F9-arrangement |
| X1 | — | HEADLESS-PARTLY | New Expression opens, saved into the world's flows; Studio "Main · saved" with Material · Motion · Body · Nara and the chain (Field, Colour, Ink, Depth, Medium, Pointer, Relational, Contacts, Morph, Focus, Physics, Resonance, Torus / field). In Arriving the field kept the O:I mark with "A retained native field is attached; release it before replacing the authored expression scene." | h-X1-expressions |
| X2 | — | HEADLESS-FAILS | Clip view shows the scene's Clip panel (Name, Constellation, Groove, Colour, Duration 12 s, Transition 1.5 s, Signature…), but Sequence reads "No reading of the scene's sequence yet." (no lanes or steps) and Play scenes is dimmed with no reason. | h-X2-scene, -play |
| X3 | #757 | HEADLESS-WORKS | Field draws every value (Tempo 1.00×, Hold 3:7, Tone 220 Hz, Plate on, mode 1·2 200 Hz, 165 ¢, 0 voices, 62k particles), Level dimmed; no NaN on any page; Resonance says Driven by Torus (Freq 220 Hz, Q 4.5, Plate 0.00). | h-X3-field |
| X4 | — | HEADLESS-PARTLY | After relaunch the Untitled expression (r1) is listed and opens with its saved controls, "Snapshot: saved · revision 1"; no line says what live motion could not be brought back. | h-X4-relaunch |
| T1 | — | HEADLESS-FAILS | "Earth could not mount — No workspace is bound for the Earth projection, so its settings have nowhere to live." in both worlds and after relaunch; the Project device reads "the Earth not mounted". May be this channel's (AtlasProjectionPanel binds the scope in an effect): the on-screen walk must confirm. | h-T1-world, h-A9-techne-after-relaunch |
| T2 | — | HEADLESS-PARTLY | The ruler with lanes Readings, Occurrences, Journeys, Runs, Revisions, Sky, cron · firings; Tap reads "Back to Now · snap the occasion back to Now". No World to return. | h-T2-ruler |
| T3–T5 | #760 | NOT REACHED | Record walk is dimmed with no reason on the status bar; no World to visit, turn or capture. | h-T2-ruler |
| T6 | #761, #757 | NOT REACHED | Palaces lists Central, Vault ("could not be read"), field-notes; no palace and no World to draw one on. | h-T6-palace |
| L1 | — | NATIVE-ONLY | Torus: "No reading of the pulses"; MIDI refused outside the native host. | h-A9-live |
| L2 | — | HEADLESS-PARTLY | Material › Live sets lists nothing in Arriving; Open set by path opened Tide Sketch: Estuary, Market hall, Tide pad, tempo 92.00, "4 tracks · 4 scenes · 0 clips". | h-L2-sets, -open-set, -set |
| L3 | — | HEADLESS-PARTLY | Root D, "dorian on L0, chromatic basis": "Mode in force — dorian on L0 … on pitch class 2 … held for this session (the set has no owner write for a mode yet)". The keyboard and roll following it were not seen (no clip; torus native). | h-L3-mode |
| L4 | #790, #768 | HEADLESS-FAILS | Insert clip is dimmed: "No owner operation carries it yet — missing op: clip.insert (kernel · live-set, the open set's owner)" (Paste, Stop the track, Remove stop button the same); no constellation to drop. Play through the torus is NATIVE-ONLY. | h-L4-menu |

### D — Settings (#758), W — owed ticket walks (Arriving)

| ID | Ticket | Result | What happened | Screens |
|---|---|---|---|---|
| D1 | #758 | HEADLESS-PARTLY | Thirteen pages down the left (Setup; Harnesses & models, Skills & methods, Profiles, Permissions, Credentials, Machines & services, Automations, Search & telemetry, Sources & libraries, Appearance; Products & updates, System); head: Search settings, the owners' connection ("Development native bridge"), Read again, "← Back to work" (names no work); foot: local changes and Review changes…. Harnesses & models' 24-row list runs past the foot instead of turning with ‹ ›. | h-D1-window |
| D2 | #758 | HEADLESS-PARTLY | Every page opens; no raw owner JSON on any; secrets by name and place only. Products & updates: "7 owners · the desktop is a full install: none is added or removed here" (O:I and the six). Harnesses & models marks openclaw installed (read from Yours's `~/.openclaw`). | h-D2-*.jpg (13) |
| D3 | #758 | HEADLESS-PARTLY | "theme" finds one result, Appearance (page); ↑↓ move; Enter does not open it. | h-D3 |
| D4 | #758 | HEADLESS-FAILS | Appearance applies by its own Apply, at once, through the presentation owner (revision 2): no amber mark, no page or foot count, no Details, no Undo on the row, no Review changes plan. Set back to Follow system. | h-D4-amber, -applied |
| D5 | #758 | HEADLESS-WORKS | Esc returns to the work (once focus is off the search field). | h-D5 |
| W1 | #768 | NOT REACHED | Constellations lists none: "Vault's wiki was not read: … No such file or directory" (the Vault is no wiki, B6). | h-W1-constellations |
| W2 | #806 | HEADLESS-WORKS | Left behind: prose rows ("Sandboxes · not read · No sandbox server is named here: …"), no JSON. The same widget lists lanes env-1, env-2, env-3 in Arriving: the owner's seat names, fixed in `workcell__git-seat.tsx` `SEAT_NAMES`; its Seats page lists this computer's live harness processes. | h-W2-left-behind |
| W3 | #757 | HEADLESS-PARTLY | Reachable designs draw a value or a reason, never NaN: Scope ("No reading of the reach", Reads and Writes "no reading": no Reads rows to show), M′ matrices ("No reading of the oscillator", Apply dimmed), Field and Resonance (X3). Not reached: harness-model's stage, the session grid, Skills' Export, the Sky's Withdraw, the wiki widget's link, the workcell's World chooser, the Ledger by ref, the Remote carrier. | h-W3-scope, -m-matrices |
| W4 | #772 | NOT REACHED | No field-notes track; Central's chain Docs reads "No reading of the account". | — |
| W5 | #756 | HEADLESS-WORKS | Products & updates: Central 0.1.0; `ctrl --version` (installed) "ctrl 0.1.0 (575de6b0f51f)", the same revision the candidate freezes. The page shows the version, not the revision. | h-D2-products-updates |
| W6 | #763 | NOT REACHED | Not in this candidate. | — |

Y (Yours) was left to the on-screen walk; G was not walked.

## Counts (59 items: A 10, B 7, C 8, F 9, X 4, T 6, L 4, D 5, W 6)

| Result | Count | Items |
|---|---|---|
| HEADLESS-WORKS | 9 | A1, A6, B2, B5, C8, X3, D5, W2, W5 |
| HEADLESS-PARTLY | 23 | A2, A4, A5, A7, A9, A10, B3, B4, B6, C1, C3, C4, C7, F8, X1, X4, T2, L2, L3, D1, D2, D3, W3 |
| HEADLESS-FAILS | 9 | A3, A8, B7, C6, F1, X2, T1, L4, D4 |
| NATIVE-ONLY | 2 | B1, L1 |
| NOT REACHED | 16 | C2, C5, F2, F3, F4, F5, F6, F7, F9, T3, T4, T5, T6, W1, W4, W6 |

## Per mode, in plain words

- **Setup.** The held Accept works through every step that has something to do: a ground made inside the world, this computer
  bound as its Workcell, Claude Code's skills adopted by AIKit (bytes unchanged, files turned into links), field-notes brought into
  Work with its history and given its ProjectCentral, nothing made twice, all kept across a relaunch. Missing: the folder and name
  for the ground, the date of birth, Add folder…, the Vault as a wiki, and a way for a world with nothing to adopt to read 5 of 5. A
  world is not fully its own: keys come from the launching environment, openclaw is read in Yours's home, AIKit reads a project root
  from the process's working directory.
- **Central.** Writing works (a Flow made, written, saved, kept across relaunch), Back and Forward with the Trail work. Today does
  not: the ground Setup makes has no civil-time policy, so Central cannot make a Day, nothing can be brought into today, and the set,
  the Day device, Clip view of pages and the Day's lane all wait on it. The @ finder is absent; the packet is the document's, not the
  Packet device's; the agent of the world refuses for want of an O-I project.
- **Factory.** Nothing works in a world without an "O-I" project: every read refuses "Project is outside Central's disclosed ground".
- **Expressions.** Works: new work, Studio and its chains, the Field and Resonance drawing real values, saved and reopened after
  relaunch. Not: the scene's sequence (no reading, Play dimmed), and a retained field blocking a new work's scene.
- **Technē.** The Earth does not mount in this channel ("No workspace is bound"), so the World, walks, captures and the Palace were
  not reached; the ruler's lanes draw.
- **Live.** A set opens by path with its tracks and tempo; a mode can be chosen. The person's own set is not listed, no clip can be
  inserted (op missing), and the torus is native-only.
- **Settings.** The window, its pages, search, owners' connection and Esc work; no page shows raw JSON. Appearance writes at once
  outside the local-changes review; search's Enter does not open its result; long lists overflow.

## Gaps found (candidate build-ticket lines)

1. §10.11 Ground — no folder chooser and no name; the ground is always `<world>/Central`. → #738's remainder.
2. §10.11 — no date-of-birth step after the ground. → #738's remainder.
3. §10.11, §18.1, §18.2 — the ground Setup makes has no civil-time policy (`central.time.policy`: "requires one explicitly
   recognised civil-time-policy source"), so no Day can be made: New Day refused, bring-in refused (A8, B7), the Day device, the set
   and Factory's temporal read all blocked. The refusal names no way on and the Day die offers no Open today in this state. Needs
   Setup (or Central's ground establishment) to adopt a policy, and the refusal to name it. → #738's remainder / #740.
4. The shell asks Central for project `O-I` by name in eight places (F1); in any world without that project Factory, the agent of
   the world, Git reads, sky presences and the M3 clock refuse. The project must be the world's. → #740 (foundations), with #738.
5. The Workcells widget lists env-1, env-2, env-3 in every world (`workcell__git-seat.tsx` `SEAT_NAMES`). → #745.
6. World boundary: AIKit reads openclaw at `/Users/admin/.openclaw` inside Bare and Arriving; AIKit adds a project root
   (`/Users/admin/Central/.agents/skills`) from the process's working directory, which the world inherits from the launch;
   provider keys in the launching environment appear in every world. `world_folder.rs` could set the working directory to the
   world's folder and clear provider-key variables; AIKit's openclaw profile should key off HOME. → #738's remainder (AIKit, O-I).
7. AIKit's adoption replaces the tool's SKILL.md files with links into the world's `.aikit` (§10.11 "The tool's own settings and
   plugins stay as they are"): owner to judge whether links are the intended form. → #738.
8. Setup's Harnesses step does not show what it found of the tool's settings (model) and instructions; Harnesses and Credentials
   never read accepted when there is nothing to adopt or bind. → #738.
9. Projects: Preview and Accept wait on a Make choice for a folder elsewhere (`settings__window.tsx` 441–443) though the bring
   ignores it. → #738.
10. An Obsidian vault is not a wiki to Central (`projectcentral.inspect`: obsidian signal, no wiki candidate), so Keep in place is
    refused and the world has no constellations (W1). → #738 / #742.
11. New… tiles act twice on a double-click and then say "nothing was made" when it was. → #750.
12. ⌘S in a Flow document did not save headless (the Save button did): confirm on the native host. → #743.
13. §5 — no @ finder in the Flow or the composer. → no open ticket names it; a new ticket (Central's editor, #741's VS Code workbench
    lane is the nearest).
14. §5 — the packet is the document's: the Packet device and the transport's packet count do not read it; Selection → packet is
    dimmed with no reason. → #745 / #750.
15. §19.4 — the rail's agent of the world shows a refusal, not the face; Hears and Speaks are not at the face's corners; no Git row
    leads to the Diff page. → #748 (with #804's follow-up).
16. §7, §20.1 — the scene's Sequence has no reading and Play scenes is dimmed without a reason; a retained native field blocks a new
    Expression's scene. → #747.
17. §17.1 — Technē's Earth does not mount ("No workspace is bound for the Earth projection") in this channel; Record walk is dimmed
    with no reason. → #742 (check on native first).
18. §21 — Live sets does not list the person's set from Music/Ableton; Insert clip, Paste, Stop the track and Remove stop button
    are dimmed for missing live-set ops (`clip.insert`, `clip.paste`, `track.stop`, `slot.stop-button`). → #749 (the browser), #743 (the ops).
19. §10.10 — Appearance applies outside the local-changes review; search's Enter does not open the result; "Back to work" names no
    work; the 24-row harness list overflows the window instead of paging. → #758's follow-up, #751 for the overflow.
20. §16 "the status bar says why" — Selection → packet, Record walk, Play scenes and Insert clip (on hover in the menu) show no
    reason on the status bar. → #750.

## What the on-screen walk must still cover (NATIVE-ONLY or channel-dependent)

O-I › Worlds and its relaunch (B1); the torus, keys lighting points, chords, a clip playing on the torus (L1, L4, A9 Live); G5's
Effects, Sky modulation, Scale mapping, M3 clock; pop-outs and their Info line (F8, G6); the status bar's "Native host · revision
a74803a09…" and "6 of 6 owners admitted"; any keychain prompt at Machines; ⌘S in a Flow; the native Create menu; whether Technē's
Earth mounts natively (T1–T6 hang on it); WebKit's drawing of everything above; and the Y items in Yours.
