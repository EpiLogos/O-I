---
Register: episteme
Standing: design-commitment (proposed 2026-09-22; builds on 10-SIDEBARS rulings D1–D6)
---

# 11 — Factory: Desk, Tasks, the Run and its objects

**Factory is where structured multi-agent work is set up, watched, and recognised.** This page designs its centre pages, its right panel, and the object pages that Inspect opens. It keeps the owner's layouts (Desk | Tasks on the left, Run · Agents · Context on the right) and specifies what fills them, using the fields the owners actually write today. The companion study, [`sidebars/sidebars-study.html`](sidebars/sidebars-study.html), renders every page below. Choose *Factory*, then a page.

Sources honoured: FACTORY-AGENCY §§1–14 and the fourteen obligations; the Factory UI handoff (§§1–10); the UI v2 specs `02-RUN` and `07-DESK` (commit `397cd001`, unlanded); #375's rejections; and the DeepSeek Harness trajectory from #289 and the owner's 22 Sep screenshot.

## 0. What the real data can carry today

A page must not promise what no owner writes. Current state, from a read of the real Central-root Factory state on 22 Sep:

| Owner read | Carries | Used by the Desk today? |
|---|---|---|
| `factory development project` → journeys | journey status, run refs, **`commission.purpose`** (the one human sentence for the work), **`startedAt`/`completedAt`** | No |
| `factory development run` | lifecycle, destination, **run map** (nodes: destination/work/decision/candidate/gate/…; edges: requires/branches_to/converges_to/…), applicable actions | Only on the Map tab, as a flat list |
| `factory workflow inspect` | per work unit: concern, required difference and return, **required verification**, dependencies, barriers, nesting, leg standing, failure reason | No |
| `factory attempt read / task` | legs with status history, attempts, the body (agent, harness, model, route, session, workcell), budget, verifications, readable return | Partly (the handoff) |
| `factory telemetry inspect` | carrier, harness, session, started/updated/completed, **Git basis** (repo, head, branch, clean), model and material usage | No |
| Conversation journal (`encounter read`) | typed signals, tool call + result pairs, and for Pi sessions **per-message timestamps, model, tokens, cache, cost** | No (only a raw disclosure) |
| Build view (`factory build snapshot`) | claims, evidence, candidates, human requests, trajectories, tokens | Yes. But **no production code writes these today**; only tests and specimens fill them |

**Consequence for the design:** the pages are built on the run map, the work-unit inspection, attempts, telemetry and the journal. Claims, candidates and human requests appear when they exist and take zero space when they don't. Five owner-side fixes are listed in §9.

## 1. The pages at a glance

The sketches below use the real queued run (`oi-65/native-conversation-identity-v3`, two work units) together with illustrative neighbours. File names and numbers in the sketches are examples.

```text
LEFT                 CENTRE                                   RIGHT
Desk  ◉              Desk — the run board                     Run · Agents · Context
Tasks                Run page — Map · Trajectory · Live · Handoff
TASKS rows           Tasks — the conversation, full size
INTENT (vision,      Object pages — unit, attempt, call, candidate,
goals)                 check, agent, NOW record (canvas or pop-out)
```

- **Desk** and **Tasks** are the two left destinations, as today. Desk is for *the work*, Tasks is for *talking about it*. Both are views of the same runs; neither holds a copy of the other.
- **Opening a run** from the Desk shows the Run page in the same pane, with `← Desk` in the pane header and the Desk's scroll kept.
- The right panel always answers about **the selected run**, or the conversation's own activity when the conversation is Direct.

## 2. Desk — the run board

**Job:** see every run in scope, what state it is in, and which one needs you. Open one.

```text
Desk                                 ⌕ Search runs    ⟳ read 2m ago    + Add to Desk ▾
NEEDS YOU · 1        ACTIVE · 2          QUEUED · 1           RECENT · 3
┌───────────────┐    ┌───────────────┐   ┌───────────────┐    …
│ ! Blocked     │    │ ● Running     │   │ ○ Queued      │
│ Native conver-│    │ Harness adap- │   │ Now surface   │
│ sation identity│   │ ter fan-out   │   │ for session   │
│ Next: verify  │    │ Next: pi leg  │   │ spaces        │
│ ▰▰▱ 2 units   │    │ ▰▰▰▱▱ 5 units │   │ waits on fan- │
│ O-I · 3h      │    │ ai-kit · 40m  │   │ out           │
└───────────────┘    └───────────────┘   └───────────────┘
```

**Card anatomy.** Every line is a real field; any line without a value is omitted.

| Line | Source | Rule |
|---|---|---|
| State | run lifecycle → Queued / Running / Blocked / Succeeded / Failed | The owner's word stays; glyph ○ ● ! ✓ × |
| Title | the journey's `commission.purpose`, first sentence; fallback: the destination slug made readable (`oi-65/native-conversation-identity-v3` → "Native conversation identity v3") | Never a `run:` ref |
| Next | the frontier node's title | One line, clamped |
| Units | one segment per work unit, shaded by leg standing (not started / active / returned / failed) | **Never a percentage** |
| Needs you | count of open human requests or pending recognition | Card goes to NEEDS YOU |
| Agents | avatars of the agencies carrying executions | Only when real |
| Footer | project **name** (from the project key, e.g. `central-project:Factory` → Factory) · time since `startedAt` | Never `project:0000…` |

**Rules kept from the handoff:** cards order by identity and never resort under the pointer; nothing auto-selects; refresh is explicit (the ⟳ shows when it was last read); no polling; no drag between columns.

**Scope.** The Desk reads the one scope (10-SIDEBARS §3.6). With a project in scope it shows that project's runs; with **All projects** (a scope-menu entry in Factory) it aggregates, each card naming its project. Factory sources are **discovered** with `factory project locate`, not typed in. *Add Factory source* survives only in the ⟳ menu as a fallback. A source that cannot be read shows one line above the board ("1 source couldn't be read — Factory, Omarchy. Retry"). It is never an empty healthy board.

**+ Add to Desk** is one menu: *New run…* (the real start passage) and *Agent… / Team… / Skill…* (open those objects' pages as tabs).

**States:** reading (skeleton columns with "Reading runs…") · empty ("No runs yet." + *New run*) · partial (the line above) · error ("Couldn't read the Desk." + Retry) · search-empty ("No runs match "x"." + Clear).

## 3. The Run page

**Job:** understand the current developmental question before seeing any tool log. Then watch it, steer it, and recognise what returned.

### 3.1 Header

```text
← Desk
Native conversation identity v3                           [ Start run ]   ⋯
The real Agency-bound Oh-I conversation appears as a generic Conversation…
● Queued · O-I · started 3h ago · 2 units · branch agent/oi-65 (clean)
Map    Trajectory    Live    Handoff
```

- **Title** as on the card. **Subtitle** = the commission purpose in full.
- **Facts line:** state · project · started · units · Git basis (branch, clean or dirty) from telemetry.
- **One primary action**: the first `currentlyApplicable` native action — *Start run*, *Recognise*, *Request changes*. Other applicable actions sit in `⋯`, together with *Open in Expressions*, *Copy run reference* and *Show raw*. No permanent Full run / Compare / Expand row.
- **No refs in the header.** The run and project refs are in *Copy run reference* and *Show raw*.

### 3.2 Map — the meaning of the work (the SSSF multi-lane map)

This replaces today's "Reading" and "Map" tabs, which were two halves of one reading.

```text
destination ──branches_to──▶ ┌ Verify conversation identity ┐──requires──▶ ┌ Repair Agency binding ┐ ──▶ ▮ gate: reviewed ──▶ ◇ candidate
                             │ ready · 0 / 5 checks          │              │ planned · 0 / 5 checks │
                             │ needs: Builder (pi)           │              │                         │
                             └───────────────────────────────┘              └─────────────────────────┘
                     ▲ frontier
```

- **One lane per work unit**, laid left to right in dependency order. Independent units stack as parallel lanes (fork). `converges_to` edges join lanes (convergence). Barriers are vertical **gate** bars across the lanes they hold. Nested runs show as a unit with a ⊞ that opens the child run's page.
- **Unit card:** the concern as its title, standing, `required checks passed / total`, and the agent requirement. The frontier unit is outlined in ink.
- **Selecting a unit** opens a detail band under the map. It shows the required difference, the required return (contract and address), each required check with its state, permitted effects, stop conditions, and attempts so far. Actions: **Message** (opens its conversation in Tasks; if several exist, an anchored list, never a guess), **Open activity** (the right Run tape at its first event), **Open page** (the unit's object page, §6).
- **Candidates, claims and evidence** appear as right-hand nodes and in the detail band when they exist. The order is claim → basis → the exact tested state → remaining obligations. A failed required check never disappears into a green aggregate.
- **What the map never does:** invent a graph from names, show three hard-coded lanes, or show a completion percentage.

### 3.3 Trajectory — what happened, in time (the DeepSeek-style run log)

Built after the DSH Trajectory view (owner screenshot, 22 Sep), over the real journal.

```text
Session  Builder · verify conversation identity · attempt 1 ▾        Duration  Turns  Calls     ⌕ Search
Input  ▭▭▭▭                  ▭                        ▭
Model      ▬▬▬  ▬▬▬   ▬▬▬       ▬▬▬   ▬▬▬   ▬▬▬           ▬▬▬
Tools         ▪▪    ▪▪   ▪▪        ▪▪   ▪▪    ▪▪              ▪▪
──────────────────────────────────────────────────────────────────────────────
CONTEXT    Prepared context · 3 items (collaboration projection, NOW record, mode.ts)
ASSISTANT  I'll read the encounter adapter and the agency binding first.
TOOL       read   crates/agency/src/binding.rs                         0.2s  ✓
TOOL       bash   cargo test -p agency binding                         14.1s ✓
THINK      The provider label is taken from the space, not the agency…
Turn 2 ─────────────────────────────────────────────────────────────────────
USER       why does it still say Conversation?
…
3 turns · 13 steps · 62 tok/s · 181K tok · cache hit 94% · $0.026
```

- **Session selector:** one entry per execution or attempt of the run, named `agent · unit · attempt n`. For a Direct conversation the tape is that conversation's own.
- **Lane strip:** Input / Model / Tools across time. Each mark is a message or call. Toggling **Duration / Turns / Calls** changes the x-axis. Clicking a mark scrolls the rows to it.
- **Rows:** one line each, a type tag (CONTEXT, USER, ASSISTANT, THINK, TOOL), then the text or `tool object`, then duration and result. Tool rows join the call and its result by call id, so one row per call rather than seven streaming blocks. Enter or the chevron expands a row to its input and output, then *Copy*, then *Show raw* last. Turn markers separate turns.
- **Footer stats:** turns · steps · tok/s · tokens · cache hit · cost, where the owner supplies them.
- **Follow:** tail-follow is on while the run is live. Scrolling up pauses it; a **Resume live · n new** pill brings it back.
- **Honesty:** timestamps, tokens, cache and cost exist today only in Pi sessions' journals. For other harnesses the lane strip uses order, not time (the x-axis label says **Order**), and the footer shows only turns and steps. Parallel spans are never summed into wall-clock time.
- **Execution waterfall.** When several executions run in parallel, a compact waterfall of executions (the ported SSSF `TraceWaterfall`, rows = agents) sits above the session selector. Picking a bar selects that session.

### 3.4 Live — who is carrying it right now

```text
Builder     Verify conversation identity     Pi · deepseek-v4-pro     ● running 12m
            session on this Mac · branch agent/oi-65 (clean)          Open conversation · Open terminal · Open activity
Verifier    Repair Agency binding            waiting on Verify        ○ not started
NOW   root: Harness adapter fan-out · child: verify conversation identity
```

- One row per leg: agent, unit, harness · model (from the attempt body), leg status with its duration, then where it runs (workcell or host) and its Git basis.
- **Actions** are only real native operations: *Open conversation* (Tasks), *Open terminal / surface* (the persisted working surface), *Open activity*. Interrupt, cancel and retry appear only where the owner exposes them, and each is named for what it does.
- **NOW:** the root and child NOW records for the run.
- **Empty:** "Nothing is running. [Start run]" when the run is queued.

### 3.5 Handoff — what came back

In FACTORY-AGENCY §7 order. A section with no content is omitted:

1. **Outcome**: one paragraph from the readable return.
2. **What changed**: the diff, labelled committed / staged / working, with counts from that comparison; *Open diff* opens it as a tab.
3. **Verification**: each required check as passed, failed or outstanding, naming the revision it tested. Checks made stale by later edits are marked stale.
4. **Observations**: duration, harness and model, usage and cost.
5. **Remaining work**: blockers and the next step.
6. **Continue with**: one to three prompts, each copyable, each able to start a conversation (it never launches on its own).
7. **Provenance**: collapsed.

Recognition controls sit at the top of the tab when recognition is the applicable action: **Recognise** as primary, **Request changes** and **Request evidence** as quiet actions. Agent completion, human recognition and Git integration are three different states and are labelled that way.

**Empty:** "Nothing has come back yet." (not an empty section stack).

## 4. Tasks — the conversation

**Job:** talk with the agent or team carrying the work.

- The **left TASKS rows** are the conversations in scope (10-SIDEBARS §3.4 row anatomy), including the **Run** they belong to as a meta word: `TASK · Builder · Native conversation identity`.
- The **centre** is the selected conversation at full size. The header is avatar · title · a **Run chip** only when truly joined · `⋯`. The Run chip opens the Run page; hovering it shows the run's state.
- **The join is repaired.** A conversation belongs to a run when its session appears in the run's executions, attempts or journey sessions, not only in its trajectories. Today it can never join on real data (`deskModel.ts:142-159`). Otherwise the conversation is **Direct**, and says so once in the header.
- **Composer** (10-SIDEBARS §4.1): To: · Insert context · dictation · **connection chip** · Send/Stop.
  - The connection chip replaces the plain-text "Connect with …" list. It opens a picker **grouped by harness** (Pi, Hermes, Gemini CLI, Codex …).
  - Each row is the provider's cleaned label, its model, and badges such as *sandboxed*. Campaign names like "(AG campaign)" become a quiet second line.
  - The first Send provisions the session (#454).
  - Once connected, the chip reads `Pi · deepseek-v4-pro ▾` and switches the model where the provider allows it.
- Messages, work marks, permission cards and completion lines follow the v2 conversation spec (10-SIDEBARS §4.3). A work mark's **Open activity** opens the right Run tape at that event.

## 5. The right panel in Factory — Run · Agents · Context

| Tab | Holds | Empty |
|---|---|---|
| **Run** | Compact header (run title, state, next decision) and the **tape**. The tape is the Trajectory rows (§3.3) in their compact form, following the selected run's live session. Filter chips appear only for kinds present: All · Tools · Errors · Permission. | "No run yet — start one." |
| **Agents** | The roster (10-SIDEBARS §4.5): real agents working on this run first, then Guardians from their real identities. Each row is avatar, name, one purpose line. **Clicking opens the agent's page in the canvas.** Today's panel dumps the Guardian's markdown; that stops. | "Create an agent to work with." |
| **Context** | The existing canvas insertion of files, terminals and browser material, preserved. Its empty state offers Factory's slice: the project's **Intent** (vision, goals), run material, NOW records. | — |

## 6. Object pages — what Inspect opens *(Ruling D1)*

Each opens as a canvas tab, or pops out with ⌥-click. Fields come first, content second, *Show raw* last.

| Object | Page shows | Opened from |
|---|---|---|
| **Run** | §3 | Desk card, Run chip, Run tab header |
| **Work unit** | Concern; required difference and return; required checks with state; dependencies and barriers; permitted effects; stop and escalation conditions; attempts | Map lane, Live row |
| **Attempt / execution** | Agent, harness, model, route, session, workcell; budget; status history as a timeline; verifications; readable return | Live row, Trajectory session selector |
| **Tool call** | Tool, input, output, result, duration, the turn it belongs to | Trajectory or tape row → *Open page* |
| **Candidate / produced material** | The material itself, via the HTML template system where it is a document, or the diff or preview; its basis revision; claims and evidence about it; compare with other candidates | Map node, Handoff |
| **Check / evidence** | Assertion, basis, the tested state (revision), result, what remains | Map detail, Handoff |
| **Agent** | Avatar, name, purpose; Skills · Setup · Activity | Agents tab, avatars |
| **NOW record** | Purpose, participants, sources, lifecycle | Live, Context |

## 7. State catalogue (Factory)

| ID | State | What you see | Check |
|---|---|---|---|
| F1 | Desk reading | Skeleton columns, "Reading runs…" | No invented cards |
| F2 | Desk empty | "No runs yet." + New run | Read succeeded with zero runs |
| F3 | Desk partial | One line naming unreadable sources + Retry | Distinct from F2 |
| F4 | Card needs you | In NEEDS YOU, with `!` and a count | An open human request moves it; answering moves it back |
| F5 | Card title | The commission purpose, not a ref | No `run:`/`project:` text on any card |
| F6 | Run queued | "Nothing is running. [Start run]" in Live; Start run is the primary action | Primary action = first applicable native action |
| F7 | Map frontier | Frontier unit outlined; detail band on select | The selected unit's checks match the owner inspection |
| F8 | Map no units | "This run has no work units yet." | Distinct from a read error |
| F9 | Trajectory with timing | Lane strip on a time axis; footer stats | Stats equal the journal's usage sums |
| F10 | Trajectory without timing | Axis labelled Order; footer shows turns and steps only | No invented durations |
| F11 | Tape paused | Resume live · n new | An arrival while paused does not scroll |
| F12 | Handoff empty | "Nothing has come back yet." | No empty sections rendered |
| F13 | Recognition | Recognise / Request changes / Request evidence call native operations | Each produces an owner receipt |
| F14 | Tasks joined | Run chip on the conversation header | Join by execution, attempt or journey session |
| F15 | Tasks direct | "Direct conversation" once in the header | No invented Run ancestry |
| F16 | Object page popped out | The same page in its own window | Docks back with the same identity |

## 8. What changes from today

| Today | Becomes |
|---|---|
| Card project label `project:0000…`, run label a slug | Project name; commission purpose as the title |
| Tabs Trajectory · Reading · Live · Map + sections Produced material / Attempt handoff / Task conversations below | Tabs **Map · Trajectory · Live · Handoff**; nothing stacked below |
| Map: a flat node list with edge text | Lanes by work unit with forks, gates and convergence (§3.2) |
| Trajectory: "no executions available" | The journal-backed run log (§3.3) |
| Header shows raw run and project refs, "live · owner build revision 4" | Title, purpose, facts line; refs behind *Copy* and *Show raw* |
| Agents tab dumps a Guardian's markdown | Roster rows; the agent's page opens in the canvas |
| "The conversation is in the centre." note, "Situated in Central", "Observed 15m ago" | Removed |
| Composer's plain "Connect with …" list | Harness-grouped connection picker |
| Hand-typed Desk sources | `factory project locate` discovery |
| Separate Desk "All Projects" filter | The one scope (10-SIDEBARS §3.6) |

## 9. Owner-side fixes this design needs (Factory)

1. `build.rs:604-606` sets the project `label` to its ref; it should carry the project key's name.
2. `build.rs:725` writes the frontier summary as Rust Debug text (`RunMap frontier: Some(Ready)`); it should be a sentence or nothing.
3. `closureState` / `gateState` are never set (`build.rs:726-727`).
4. Execution `status` values (`contract-fixture`, `returned`, `running`) fall outside the desktop's status union; they need a shared vocabulary.
5. Normalised usage: tokens, cache, timing and cost exist in Pi's journal and in Actuation's model-usage shape, but Factory's execution correlation is never populated on real runs. The Trajectory footer and the Desk need it to show numbers beyond Pi sessions.

## 10. Build order

1. Desk from real reads: the journey purpose, run map units, discovery, the one scope.
2. Run page header, and Map from `development run` + `workflow inspect`.
3. Live from attempts + telemetry; Handoff from the readable return.
4. Trajectory from the journal: call and result joined by id, turn markers, lane strip, footer stats.
5. Tasks join repair and the connection picker.
6. Object pages and pop-out; Agents roster pages.
7. One walk per F-state against a real run (the Central-root run `oi-65/native-conversation-identity-v3` is a real, queued specimen).
