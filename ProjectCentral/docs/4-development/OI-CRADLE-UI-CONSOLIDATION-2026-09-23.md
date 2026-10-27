# Cradle UI consolidation — work order

Date: 2026-09-23. Status: owner-directed. Every defect below was verified against the working tree on this date; file:line references are evidence, not suggestions.

Scope: `desktop/cradle` frontend, plus one producer fix in `Work/ai-kit` (W4). Branch: one env worktree refreshed from the current primary line.

## 1. Verdict

The UI's problems are not polish. The codebase carries ten separate implementations of "a panel with tabs", four fullscreen systems, four window menus, two type scales in the token file itself, and a mode layer that contradicts its own comments. Every new screen re-implements the laws it should inherit, so drift is the default outcome. The fix is consolidation: six shared primitives replacing the duplicates, then the per-screen defects fixed on top of them.

## 2. Current state

### 2.1 Structure

- Ten live implementations of a tab strip: right panel head (`agent/panel/PanelTop.tsx:15`), Workbench tab strip (`surface/Workbench.tsx:240`), a second Workbench instance nested inside the right panel's context plane (`CradleFrame.tsx:1644`), encounter nav (`encounter/EncounterView.tsx:114`), explore strip (`explore/ExploreSurface.tsx:133`), wiki-map apertures (`techne/WikiMapNavigator.tsx:80`), expressions menubar, factory run tabs (`contributions/factory/desk/RunPage.tsx:134`), segment controls, and five per-mode HUD rows (`workspace/shell.css:553-558`). Four different active-tab idioms (ink underline, accent underline, gold underline, wash chip).
- Four fullscreen systems: panel depth "full" (`shell.css:148-157`), Workbench pane maximize (`surface/registry.ts:80`), always-mounted mode stages (`CradleFrame.tsx:1717-1725`), native detach windows. A dormant fifth is declared on EncounterSurface and never used (`EncounterSurface.tsx:15`).
- Four separate "…" menus: footer tabs and footer recovery (`DesktopShell.tsx:373-396`), pane tools (`Workbench.tsx:352-364`), frame menu (`Workbench.tsx:682`). Tab presentation is offered in two of them.
- `workspace/mode.ts` contradicts itself: comments say the panel is Chat/Run/Agents/Context; the data says Chat/Activity/Agents/Context — in three modes (`mode.ts:101-111,130-142`).
- Two different "Agents" planes share one label from two data sources: `agent/panel/AgentsTab.tsx` (panel roster) vs `contributions/factory/sidebar/FactoryAgentsTab.tsx` (kernel roster).
- Three context plane ids (`context`, `ta-onta-context`, `factory-context`) all render one body (`workspace/modeBodies.tsx:67-81`).
- Factory's chat-in-centre is encoded three times and can drift: the flag (`mode.ts:126`), the plane-list omission, and mode branching in `CradleFrame.tsx:1681-1687` plus guards in `AgentLayer.tsx:217,283`.

### 2.2 Right sidebar

- Tab headings are text, not icons (`PanelTop.tsx:15-16`).
- Chat, activity, agents, context are four standalone bodies with their own widths, paddings and grounds in four CSS files (`agent/chat/chat.css`, `agent/panel/panel.css`, `agent/tape/tape.css`, `contributions/factory/sidebar/sidebar.css`). The planes do not read as one surface.
- Canvas is not full height: 40px topbar above (`shell.css:10`), footer strip below (`shell.css:240`), side/bottom gutters (`shell.css:136`).
- Three controls do close/collapse: the panel ✕ (`PanelTop.tsx:23`) and the shell toggle (`DesktopShell.tsx:313`), both on ⌘⇧B, plus a floating promote button overlapping the chat corner (`AgentLayer.tsx:283`, `panel.css:152`). Fullscreen ⤢ sits in the panel's top row (`PanelTop.tsx:22`).
- The "accompanying agent" presence chip appears in the topbar when the panel is collapsed (`DesktopShell.tsx:310-312`).
- The reconnect status renders a full sentence every time the session drops twice (`AgentLayer.tsx:274`). The approved design says: hollow dot, draft kept.
- Agents rows carry purpose and assignment sublines under every name, under two group headers (`AgentsTab.tsx:37,58-59`).
- Context details behind one click are raw dumps: `context/PreparedContextView.tsx:59`, `agent/tape/Tape.tsx:127`, `agent/chat/PermissionCard.tsx:48`, `agent/objects/ObjectPage.tsx:49`, `context/ContextActions.tsx:146`.

### 2.3 Chat and identity

- The Factory chat hardcodes the label "Factory agent" (`CradleFrame.tsx:1492`, `mode.ts:126`) and that hardcoded prop wins over the real profile identity inside the chat (`AgentChat.tsx:222`: `agentName || identity.name`). The panel head does it correctly (`AgentLayer.tsx:249`). Per-mode persona labels are also hardcoded (`mode.ts:135,142,149,155`).
- Session titles fall back to raw provisioned refs (`agent-session/<slug>-chat-<stamp>`, minted at `kernel/src/agency.rs:593`): centre chat with no title passed (`AgentChat.tsx:251`, `CradleFrame.tsx:1489-1507`) and the conversations list (`encounter/EncounterList.tsx:22`).
- The model selector is real end to end (kernel `ModelSelect` with verified receipt, `encounter/nativeModel.ts:106-110`), but it shows junk: options carry producer names verbatim, and the producer stamps the resource-kind slug "harness" on every entry (`ai-kit/crates/aikit-core/src/resource/model.rs:64`), so pi appears six times all titled "harness". Raw-id fallbacks leak elsewhere: chip falls back to raw `current_model_id` (`ComposerChips.tsx:99`), the resume chip says "Reconnect {provider}" (`ChatComposer.tsx:122`). When a harness does not advertise model selection, the menu silently disables instead of saying why (`ComposerChips.tsx:96`).
- A persistent "Drop a file or a tab to attach" hint sits in the composer (`ChatComposer.tsx:137`). The drop feature itself works (`AgentChat.tsx:179-191`).

### 2.4 Settings

- One skills toggle runs: hold → full config diff → one `oi config show` subprocess per watched scope, each re-reading AIKit's entire disclosure (`kernel/src/configuration.rs:443-468`), all serialized behind one global kernel mutex (`src-tauri/src/main.rs:28-37`), with no optimistic UI (`SkillsSection.tsx:116-117`). Opening Settings runs the heaviest composition read twice (`settingsData.ts:353-355`) and the registry read spawns seven sequential subprocesses (`configuration.rs:391-433`).
- The harnesses page offers exactly three actions — install, set default for new chats, open folder — and otherwise displays detection status. It does not answer a user's actual questions: which harness is this chat running, which should be default, what model will it use, is the connection alive. Detection is the whole page; capability is absent.
- Dead code: the entire `workspace/settings/v2/` tree has zero importers.

### 2.5 Left sidebar and techne

- The List/Tree/Graph switcher is wired but reads dead: with registers collapsed nothing visibly changes (`WikiMapNavigator.tsx:81-93`). The three renderers are visually near-identical, which is its own defect.
- A wiki row sits behind ~37px of stacked inset across five padding layers (`techne.css:185,212,217,223,234`).
- `.wiki-map` runs its own scroller nested inside the frame's scroller (`techne.css:185` vs `workspace/left/LeftFrame.tsx:243`).
- `.wiki-map-note` is declared twice with different values in one file; the later silently wins (`techne.css:225,233`).
- Three competing padding laws fight over the same navigator element (`surfaces/navigator/navigator.css:32`, `shell.css:160`, `left/left.css:60`).
- Four dense-row grammars serve the same column: `.left-row`, `.oi-side-row` (re-patched regionally by `workspace/sidebar-presentation.css:3-13`), `.settings-nav-row`, `.wiki-node-row`.

### 2.6 Scrollbars and tokens

- Thin/invisible scrollbars are opt-in per component. Blanket `*` suppressions on `.surface-body` and `.mode-stage` (`cradle.css:890,1040-1041`) mean the chat transcript shows its thin scrollbar in the right panel and none in a centre tab — one component, two opposite laws. Stragglers with default fat scrollbars: `wiki-map` (`techne.css:185`), the config drawer (`configuration/configuration.css:82`), `.canvas` (`rest.css:53`), knowledge content (`shell.css:327`).
- Two desktop type scales coexist in `packages/oi-design-system/tokens.css` (`--oi-desktop-type-*` at :219-235 vs `--oi-shell-type-*` at :294-302); consumers are split between them.
- Factory invents a private `--fd-*` alias layer including a 16-26px gutter against the shell's 4px, and is the only raw-hex colour site in shell chrome (`contributions/factory/desk/fdesk.css:6-16`), against the stated zero-raw-hex policy.
- Three heights for "a panel top row": 40px (`panel.css:3`), 65px (`chat.css:10`), 32px (Workbench tabbar), plus a 26px held-pane chrome (`sidebar.css:116`).
- Gutter is 3px in the shell (`shell.css:443-444`) and 4px in the token (`--oi-shell-gutter`), used inconsistently.
- Techne hardcodes its own micro type scale (10/10.5/11px literals, `techne.css:190-225`).
- The chat plane re-paints a ground the region already painted (`chat.css:5`).

### 2.7 Dead code still shipped

`RunPlane.tsx`, `AgentsPlane.tsx`, `agent/desk/{Trajectory,SkillsTools,ClaimsEvidence,Results}Plane.tsx`, `WorkScope.tsx`, `agent/planes/ContextPlane.tsx`, legacy `.agent-head`/`.agent-planes` CSS (`agent/agent.css:14-23`), `settings/v2/`. Zero importers each; their stylesheets still load.

## 3. Target design

Six primitives absorb the duplicates:

1. **PanelShell** — one container for right-panel planes: shared width tokens, one ground, depth states (panel / full / overlay / collapsed), one top-row slot. Absorbs the four standalone tab bodies and retires `sidebar-presentation.css`.
2. **IconTabStrip** — one icon tab strip across the full top edge, with dot/attention marks (the existing `PanelTab` shape already carries marks), tooltips for labels, parameterized by mode curation data. Replaces all other tab grammars.
3. **CanvasHost** — one full-height centre: absorbs the mode-stage slots (keeping them keyed and never unmounted), the Workbench pane frame, RestPane's fake geometry, the traffic-light cutouts, a HUD slot for tabs, and horizontal split where a second form of information is wanted (activity or context beside canvas content). Chat can occupy the canvas (the existing centre variant is absorbed, not rebuilt).
4. **WindowFunctionsMenu** — one "…" per panel and per canvas owning close/collapse, fullscreen, tab presentation (offered once), arrangement, status/recovery.
5. **One scroll law** — thin, invisible-until-hover scrollbars everywhere, globally; all blanket `*` suppressions deleted; every scroll container uses the house class.
6. **One plane registry** — canonical plane ids; one Agents implementation; the three context ids collapse to one parameterized plane; `mode.ts` data becomes the single curation source and its comments are rewritten to match what the data says.

## 4. Decisions already made (binding — do not re-open)

- No text headings anywhere in the right sidebar. Icons only.
- Window functions live in "…". The in-panel ✕ and the floating promote button die. The shell toggle is the only close.
- The presence chip is removed. A collapsed sidebar reopens via the shell toggle or ⌘⇧B.
- Reconnect renders a hollow dot with a tooltip ("draft kept"), never a paragraph.
- Agents tab: agent name and live status only. Purpose lines, assignment lines and group headers are removed.
- Chat, activity, agents, context share one panel width, one padding scale, one ground.
- Canvas is full height; tabs live in the canvas HUD; horizontal split only where dual display is wanted.
- Context, run and harness details get curated HTML renderers. Raw JSON survives only behind an explicit "raw" disclosure, or not at all.
- Agent identity always comes from the live kernel profile or agency roster. Hardcoded per-mode agent labels are deleted. When nothing is selected, the name is **World**.
- Session titles are readable names; raw refs never render as titles.
- The persistent "Drop a file…" hint is removed. The drag veil on an actual drag stays.
- Model chip: deduped, real model names; the harness kind is a badge, not a title; no raw transport strings render anywhere; a disabled selector states the harness-provided reason.
- The harnesses page is rebuilt around user capability: which harness is running and which is default, set default, verify the connection, default model. Detection moves to secondary.
- Techne: the List/Tree/Graph switcher is removed; one rendering survives (tree, not list); the padding stack collapses; the nested scroller goes.

## 5. Workstreams

Order matters: W1 before W2 before W8. W3-W7 are independent lanes once W1 lands the primitives they touch; W3's cradle half and W4 can start immediately.

- **W1 — Primitives (lead).** PanelShell, IconTabStrip, CanvasHost, WindowFunctionsMenu, plane registry, mode.ts reconciliation. Acceptance: the right sidebar renders all four planes through PanelShell with identical metrics; canvas is full height with HUD tabs; exactly one "…" per panel and per canvas; `mode.ts` comments match its data.
- **W2 — Migration (lead + support).** Move chat/activity/agents/context, encounter nav, explore strip, factory tabs and the per-mode HUD rows onto the primitives; delete each replaced implementation as it is migrated. Acceptance: zero remaining hand-rolled tab strips outside the primitives; the dead-tab-idiom CSS files are gone.
- **W3 — Chat and identity (subagent).** Profile/roster-driven identity with "World" fallback; readable session titles; reconnect dot; drop hint removal; model-chip fallbacks cleaned and the disabled state's reason surfaced. Acceptance: no hardcoded agent label survives in any mode; no raw ref or raw transport string renders in the chat.
- **W4 — Producer naming contract (subagent, ai-kit lane).** Dedupe advertised model routes; real model names instead of the kind slug (`aikit-core/src/resource/model.rs:64` is the string source; the adapters build the list). Acceptance: the pi session advertises deduped options with real names; ai-kit adapter tests updated and green.
- **W5 — Settings speed (subagent).** Optimistic toggle; cache resolutions; collapse the per-scope `oi config show` fan-out into one disclosure read; run the composition read once per open; parallelize the registry read. Acceptance: a skills toggle reflects instantly and settles without a visible round trip; settings open does at most one heavy read.
- **W6 — Harnesses capability rebuild (lead designs, subagent builds).** The page answers: which harness is running and which is default, set default, verify connection, default model. Detection demoted to a secondary section. Acceptance: a user can choose and confirm what their chats run without leaving the page.
- **W7 — Token and scrollbar law (subagent).** One type scale; one gutter; retire `--fd-*`; tokenize the raw hexes; one head height; global scroll law with suppressions deleted; techne padding stack collapsed; navigator padding fight resolved to one rule; one row grammar. Acceptance: grepping shell chrome for raw hex returns zero; every visible scrollbar is the house scrollbar; the wiki row's cumulative inset is under half its current value.
- **W8 — Dead code deletion (subagent, after W2).** Everything listed in 2.7. Acceptance: build, typecheck and tests green with the files gone.

## 6. What must not change

- Factory's chat lives in the centre. That is owner-directed behaviour, not duplication.
- Floating panel over canvas fields (expressions, techne) versus region-pushing in component modes is a deliberate spatial distinction. Keep both regimes; implement them in one place.
- Mode-stage slots stay keyed and never unmount: remounting loses engine and iframe state.
- Per-mode plane memory, plane order and default depths are curation data; the unified strip renders them, it does not flatten them.
- Settings mode collapses the panel on entry; base mode starts collapsed. Both are decisions.
- macOS traffic lights stay native; the shell keeps carving their space.

## 7. Verification and return

- Keep the project's own gates green: cradle build, typecheck, and `desktop/cradle/tests`; ai-kit adapter tests for W4. No new dependencies without stating them.
- Every workstream returns executed evidence: what ran, what passed. A visual claim about the panel or canvas carries a screenshot from the running app.
- The final return leads with the working face: what the app now does, what to run and try, what changed visually, open risks. Plain English, no project-internal names the owner did not use.
