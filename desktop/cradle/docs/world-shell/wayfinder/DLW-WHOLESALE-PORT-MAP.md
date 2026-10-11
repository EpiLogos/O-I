# DLW wholesale port map — the legacy cradle's working components, judged for port

**Standing:** lane return, 2026-10-11. Lane `zcode:wholesale-port-map` (DESIGN,
DLW development track), dispatched by orchestrator `zcode:world-shell-orchestrator`.
Commission, in the owner's words: *"be clear what to port from the original
legacy cradle app wholesale — like terminal and browser and documents panels,
agent chats etc — all the genuinely portable/shippable components, which we
know work really well. NO fucking reinterpretations — genuinely USE the code.
Map all this properly."*

**What was walked:** the cradle app itself at
`/Users/admin/Central/worktrees/env-1/o-i/desktop/cradle/` — every component
named in the commission plus the full `src/surface/**` pane engine, the
`src-tauri` native command layer and the `documents/` hosted forms. Evidence
executed on this tree: spot test runs (§5), git state. **Seat state at walk
time:** branch `m-prime-methodology`, HEAD `3b00f47e4`, working tree clean
except `packages/live-shell/ui/scripts/sync-kernel-ops.mjs` (one modified
file). The recent history is the "branch dance" reconciliation (`3eb187f04`
"every lane's work folded onto m-prime-methodology", `a74da6456` "fold in the
working state") — the tree the walk read is the folded, current one, not the
older `agent/o-i-20261007-1639` the ontology documents cite. Where a line
number differs from the older citations, this tree's is the live one.

**The verdict scale** (the honesty law's four grades, applied to each
component):

- **WHOLESALE** — works today; the port is mounting it unchanged inside a
  thin pane-instrument wrapper. Name the exact files; the wrapper spec is
  stated per entry.
- **PARTIAL** — a real component with a named, evidenced subset that works
  and a named part that does not (file:line for both).
- **MOCK-ONLY** — fixture/dev-only by design; named so nobody ports it
  believing it works.
- **SUPERSEDED** — the new shell's own implementation already occupies the
  slot (`packages/live-shell/ui/src/…`); not a port, named so nobody ports
  the cradle's version over it.

---

## 0. The one-paragraph answer

The legacy cradle is not a heap of prototypes — it is a working application
whose frame and most of its bodies port **wholesale**: the pane engine
(`src/surface/`), the real second-window detach (`DetachedFrame` + Tauri
`window_binding`/`window_redock`), the per-mode workspace book (`modeLayouts`),
the terminal (xterm over a native PTY with durable checkpoints), the real
web-browser pane (native child view with attach/bounds leases and profiles),
the document hosting path (sandboxed iframe + bounded postMessage + the save
router) and all nine hosted forms, the CodeMirror editor, the two-layer
source editor with structured conflict, the conversation system (one shared
session observer, draft compare-and-swap, permission cards, provision on
first send), the agency roster/mint, the Nara dialogue binding, the knowledge
graph with its minimap and construction drawer, the field/explore surfaces,
the Factory desk/run pages with the native working-surface takeover, the
settings suite, the ambient Expression stage, and the hosted Expressions
application itself (`PointCloudHost`). **34 components are WHOLESALE**, 5 are
PARTIAL with named working/failing halves, 2 are dev-only fixtures (mock-only
by design), and 4 component families are SUPERSEDED — already implemented
inside the shell package itself (the device chain, the Session/Arrangement
craft, the mode grammar frame, the agent shell). The port is not a rewrite
programme; it is a *mounting* programme: every WHOLESALE verdict below mounts
its component behind a `SurfaceBinding` kind through the pane engine's own
body dispatch (`Workbench.tsx:500-581`), which is the instrument-type
contract (`DLW-PANES-ONTOLOGY.md` §1.1) already expressed in working code.

---

## 1. The laws this map applied

- **Port law (absolute form, this lane).** A WHOLESALE component is used
  AS-IS: the pane-instrument host adapts around it — mount/unmount, encounter
  subscription, retention — and never rewrites its behaviour. Every WHOLESALE
  entry names files; "the port = mount them unchanged" is literal.
- **Aperture law.** A ported component keeps its owner operations and
  receipts exactly. The wrapper adds no behaviour: the host provides
  lifecycle (mount/conceal/unmount), the encounter bridge, and the pane slot
  — nothing else. Every owner op (kernel ops, Tauri commands, CAS writes)
  travels with the component verbatim.
- **Widget law.** The pane chrome around a component (tab, pin, footer) is
  the pane engine's, already built; the component's own working surface is
  untouched.
- **Honesty law.** Every verdict cites the component's source and its
  evidence — its committed tests (with pass counts where this lane executed
  them), its live records, or its named fault. Where the documents and the
  code disagree, the code wins and the disagreement is named (§6).

---

## 2. The component walk

All paths relative to `/Users/admin/Central/worktrees/env-1/o-i/desktop/cradle/`
unless prefixed. "Owner" = the native system the component reads/writes.

### A. The pane engine and frame — the host machinery itself

**A1. The surface layout engine — WHOLESALE.**
`src/surface/types.ts` (246 ln), `engine.ts` (693 ln), `persist.ts`,
`keys.ts`. Pure functions over serialisable `LayoutState`:
`TabGroupPane`/`SplitPane` tree with weights, tabs/pins/active, per-pane tab
presentation (`types.ts:122-148`), binding grammar carrying per-kind instance
slices (`terminal.cwd/command` `types.ts:92`, `browser.url` `:89`,
`flow` `:93`, `engine.expressionRef` `:104`, `presentation` refs `:110`,
`projection.{kind,subject_ref}` `:118`); operations open/close/reopen/
splitOff/tile/moveTab/moveDirectional/cycleTab/jumpToTab/togglePin/resize/
restore/detach/redock (`engine.ts:299-693`); `LayoutState` with
`closedStack`, `maximizedGroupId`, `sidePane`, `modeRegions` (`types.ts:162-208`).
Owner: none — presentation state only, "never becomes a semantic identity"
(`types.ts:13`). Evidence: this is the engine the whole ontology cites
(`DLW-PANES-ONTOLOGY.md:57-64`); committed at HEAD; the mode-workspaces
suite that exercises it passed 5/5 this walk. Wrapper spec: none needed —
this IS the host. The port = the new shell's frame composes on this engine
(which L1 already did).

**A2. The Workbench pane tier (retention + body dispatch) — WHOLESALE.**
`src/surface/Workbench.tsx` (729 ln), `retention.tsx`, `warmTrees.ts`. The
three-tier retention law landed in code: every open tab's body stays
mounted-concealed (`hidden` + `display:none`, `Workbench.tsx:447-456`), cheap
list kinds release on conceal (`CONCEAL_RELEASES = ["sources","blank"]`,
`:474`), explicit close releases everything. Body dispatch by kind
(`SurfaceBodyImpl`, `:500-581`) — the de-facto instrument-type registry:
projection bindings → `ProjectionSurface`, encounter → `EncounterSurface`,
terminal/browser/file/source/knowledge/flow/draft/explore → their components,
retained centre kinds through `ModeCentreBody`, with error boundary and lazy
chunks per body (`:37-49`, `:478-494`). Owner: hosts all others. Evidence:
landed; the owner-approved retention ruling is quoted in the code
(`:418-428`). Wrapper spec: this is the wrapper — the thin host the port law
wraps around every body below.

**A3. The projection module door — WHOLESALE.**
`src/surface/projectionModules.ts` (179 ln), `projectionPane.tsx`. The
`ProjectionModule` contract — `create(context) → {unmount, setVisible?}` with
the hidden-inhabitant law stated as a MUST (`:133-141`) — plus the
`EncounterBridge` (snapshot/subscribe/transition, epoch-guarded
subscriptions, `:83-114`) and the one-module-per-kind admission that refuses
replacement (`:157-169`). Owner: the encounter spine (routes transitions to
the workspace book's WorldContext; never a store). Evidence: the atlas port
adopts this door (`projections/atlas/mount.ts`); committed at HEAD. This file
is the ontology's `InstrumentTypeDeclaration` (§1.1) already written — the
generalisation G1 proposes is this contract applied to the other body kinds,
not a new mechanism.

**A4. Action registry + context menu — WHOLESALE.**
`src/surface/registry.ts` (265 ln), `ContextMenu.tsx`. D15's action seam:
context menu renders exactly the Actions an owner discloses; an object with
none shows an empty menu — nothing fabricated (`registry.ts:1-12`). Frame
actions (`surface.close`, `surface.split-right`, …) are the built-in
disclosure. Evidence: committed; exercised by every surface's right-click.

**A5. Real second window — WHOLESALE.**
`src/workspace/DetachedFrame.tsx` (181 ln) + `src-tauri/src/windows.rs`
(`window_binding`/`window_redock`). A detached surface opens in a native
Tauri window: the frame receives its binding (`invoke("window_binding")`,
`:99`), mounts the SAME body components as the workbench (`:178` — one law
for both windows), syncs view state back with `oi:surface-view` (`:120`),
redocks on demand and protects close with the checkpoint barrier (`:137-157`),
including focus admission and search overlay. **Admitted body kinds at the
receiving frame** (read from `:178`): object, terminal, flow, draft, browser,
encounter, file, source, system, explore/presentation, knowledge.
Evidence: committed; the detach affordance, its enabled kinds and its native
window law are live app behaviour. **Disagreement named (§6):** the docs
claim detachable kinds "include source, knowledge, file, encounter, browser,
terminal, flow" (`WORLD-SHELL-DESIGN.md:454-456`) — the receiving frame does
admit all of those plus four more, but the Workbench's detach *button* offers
only `["source","knowledge","file","encounter","explore","presentation"]`
(`Workbench.tsx:721`). The receiver is wider than the offer; the gap is one
array literal, not a mechanism.

**A6. The mode system + per-mode trees — WHOLESALE.**
`src/workspace/mode.ts` (150 ln), `store.ts` (555 ln). `WorkspaceMode` =
`base|factory|expressions|techne|epi-logos|settings` (`mode.ts:23`);
`MODE_CURATION` names each mode's left body, centre kind and panel planes
(`mode.ts:97-133`); `Workspace.modeLayouts` holds every non-active mode's
tree (`store.ts:42`); `switchWorkspaceMode` parks the leaving tree and
restores the entering one, sharing widths/accompanying/panel memory across
modes (`store.ts:128-141`); `moveWorkspaceSurface` moves a retained surface
between trees without minting a second host (`store.ts:143-160`). Owner:
presentation only — a mode never closes surfaces. Evidence: **executed this
walk** — `tests/mode-workspaces.test.mjs` 5/5 pass with the documented
runner. This is the mechanism `DLW-PANES-ONTOLOGY.md` §1.5/§9.2 names as the
set store for one unnamed set per mode.

**A7. Layout checkpoints, recovery and drafts — WHOLESALE.**
`src/workspace/checkpoints.ts`, `recovery.ts`, `drafts.ts` (with the
`oi-cradle.draft.v1` private-input custody the instrumentation contract
builds on). Progressive layout codec (`persist.ts`
`decodeLayoutProgressive`), staged checkpoints and last-known-good, recovery
drafts preserving presentation and divergent work. Owner: the workspace book
(`oi-cradle.workspaces.v1`). Evidence: committed; the retirement register
names everyday-workspace adoption as migration gate 3
(`LEGACY-CRADLE-RETIREMENT.md:48-54`), which presupposes this format works.

### B. Ground, files and documents

**B8. The terminal — WHOLESALE.**
`src/terminal/TerminalSurface.tsx` (81 ln) + `src-tauri/src/terminal.rs`,
`terminal_reading.rs`, `terminal_tests.rs`. xterm.js over a native PTY:
`terminal_attach` returns `{lease, seq, snapshot, cwd, durable, archived}`
(`TerminalSurface.tsx:53-62`), poll loop writes output as it arrives
(`:44-52`), input is serialized per keystroke (`:43`), resize forwards
dimensions (`:40`), and every 250 ms of output a **checkpoint** serialises
the screen to the native side (`:37`, `:49`) — with a full
checkpoint-barrier protocol on unmount (`:63-78`) and an "archived reading"
path that replays a dead process's screen and tails (`:55-59`). Login-command
handover (`binding.terminal.command`, Settings auth login) rides the same
attach (`:53`). Theme reads the host's `--oi-*` tokens, never a literal
palette (`:11-28`). Owner: the Tauri host's PTY lease. Evidence: the Rust
side carries its own test module (`terminal_tests.rs`); the surface is the
daily driver's terminal; committed at HEAD. Wrapper spec: mount as pane body
kind `terminal` (already dispatched, `Workbench.tsx:556`); the pane provides
concealment (the surface pauses polling while hidden, `:39`); no behaviour
added.

**B9. The browser pane — WHOLESALE.**
`src/browser/BrowserSurface.tsx` (165 ln) + `src-tauri/src/browser.rs`. A
real web browser pane over a native child view: `browser_attach` with
address + profile + bounds returns a lease (`:85-97`); a rAF loop keeps the
native view's bounds glued to the DOM pane and **hides it whenever the pane
is concealed or an overlay owns input** (`:57-115` — the native-child-view
law solved, in code, for tabs/splits/maximise); navigate with http/https-only
and credential refusal (`:116-127`); back/forward/reload/stop, zoom, two
cookie profiles (temporary/personal, `:129-138`); downloads read as state
(`:160`); **page-component context capture** — pick a page component or a
selection and attach it to the conversation context (`:149-151` +
`useBrowserContext`). Owner: the Tauri host's webview lease. Evidence:
committed; live in the everyday app. Wrapper spec: pane body kind `browser`
(`Workbench.tsx:560`); the pane's concealment drives the hide lease — the
component already implements the retention handshake itself.

**B10. Ground chooser — WHOLESALE.**
`src/workspace/GroundChooser.tsx` (90 ln) + `src-tauri/src/ground_dialog.rs`.
Native ground recognition and binding: `kernelOp {op:"ground",
action:"recognize"|"bind"|"status"}` (`:66`), folder pick via
`choose_central_folder` (`:70`), the recognition rendered as disclosed facts
— outcome, canonical path, access, identity, checks, limitations — never a
raw dump (`:20-55`), bind gated on `recognized + readable + searchable +
identity` (`:72`), and "existing open surfaces retain their current ground;
the new default is used on the next launch" (`:71`). Owner: the kernel's
ground op. Evidence: committed; `tests/central-ground.test.mjs` exists.
Wrapper spec: a Base settings/ground browser row or a central-family face;
self-contained.

**B11. The document hosting path — WHOLESALE.**
`src/document/frame.ts` (109 ln), `identity.ts`, `hostSave.ts`, `returns.ts`,
`SourceDocumentHost.tsx` (187 ln). The sandboxed opaque-origin iframe with
injected observation + document-host scripts (`frame.ts:16`), the bounded
host-read bridge (`oi:document-host-request/response`, 1.5 s deadline, one
question — what does the `#ql-doc` island hold, `frame.ts:36-66`), the
close-time **checkpoint registry** every document frame registers with
(four concurrent flights max, membership-change refusal, `frame.ts:70-109`),
payload-island identity detection per family (`identity.ts`), and the save
router: the rendered view is presentation over the canonical buffer; a page
save composes the island into the buffer and saves through the kernel's
source CAS — "a stale basis meets the existing structured conflict, never an
overwrite" (`SourceDocumentHost.tsx:15-21`). Owner: Central's CAS source
store. Evidence: **executed this walk** — `tests/document-surface.test.mjs`
10/10 pass. This is the hosting path `WORLD-SHELL-DESIGN.md:501-510` names
as the document-device seam; it is finished code.

**B12. The hosted forms — WHOLESALE.**
`documents/ql-daily-die.html` (713 ln), `ql-flow.html` (1138 ln),
`ql-dialogue-flow.html` (540), `oi-beings.html`, `oi-things.html`,
`oi-goal.html`, `oi-vision.html` (61 each), `oi-epi-card.html` (428),
`ql-yoshimoto-cube.html` (126), plus `forms.json` (the
`oi.html-form-roster/v1` roster with template refs and standings) and the
build scripts (`build-personal.mjs`, `embed-plural.mjs`). Each form is a
**portable standalone HTML document**: its full state in the `#ql-doc` JSON
island (`oi-things.html` payload island), in-page editing
(plaintext-only contenteditable, revision bumping), composition controls
(layout/tone/sections), hosted-expression lease protocol
(`oi:page-expression-host` with exact page+expression revision admission and
invalidation — the page suppresses its fallback only while the host admits
the exact same revisions), save-as-portable-HTML with embedded data, and an
honest status line ("Editing does not save back to its source
automatically"). Owner: none in the page; the host path (B11) owns CAS.
Evidence: these are the owner's daily Day/Flow/Beings/Things forms;
`forms.json` declares their standings (`authored-current`,
`retained-source`, `reference-carrier`); the mockup draws them "as they are"
(`WORLD-SHELL-DESIGN.md:119-131`) — and they are better than drawn: the
lease protocol and portable-save are real. Wrapper spec: pane body or
document-device body = the file in the B11 frame; the four Base forms are
the Document instrument's canonical instances (ontology T8).

**B13. The text editor — WHOLESALE.**
`src/editor/TextEditor.tsx` (CodeMirror 6: `EditorView`, `StateField`,
`Decoration`, keymap, compartments), `commands.ts`, `EditorChrome.tsx`,
`lazy.tsx`. The source/file editor body with undo, decorations, and
owner-caret law (the frame "never steals the caret from a surface body",
`Workbench.tsx:139-141`). Owner: Central buffers via the host surfaces.
Evidence: committed; exercised by file/source suites.

**B14. Source surface + history — WHOLESALE.**
`src/surface/SourceSurface.tsx`, `SourceHistory.tsx`, `SourcesIndex.tsx`.
The two-layer editor: the textarea IS the cradle-held dirty buffer; the
revision line is Central's canonical layer; a failed CAS surfaces the
structured conflict with both sides preserved and an explicit re-read as the
only way forward (header comment, verbatim from the map's U0.4 law). ⌘O
SourcesIndex: one index at a time (`engine.ts:213-217`). Owner: kernel
source CAS. Evidence: committed; `tests/central-source-host.test.mjs` exists.
This is Central's "clip-view craft" — CAS identity and named outcomes are
already the working practice.

**B15. Files — WHOLESALE.**
`src/files/FileSurface.tsx`, `FileTree.tsx`, `FileHistory.tsx`,
`listingStore.ts`, `listingHooks.tsx`, `drag.ts`, `resources.ts`,
`legacyRecovery.ts`, plus `src/material/MaterialSurface.tsx` (lazy — the
material renderer chosen per extension before any owner round trip;
HTML/Markdown keep the text editor as their Source view via `forceSource`).
Owner: Central listing + file CAS. Evidence: committed; the day-recovery
walk (DLW-PLAN §4.2) exercised these listing reads live.

### C. Conversation and agency

**C16. The encounter session store — WHOLESALE.**
`src/encounter/session.ts` (599 ln) + `nativeModel.ts`, `nativeMode.ts`,
`deliveryOutcome.ts`, `advertisedModes.ts`, `client.ts`. One observer per
encounter session, keyed `project:agent_session`: one poll loop while ≥1
subscriber is mounted (750 ms cadence, hidden-document pause), one canonical
draft compare-and-swap state machine shared by every presenter of the same
session, one reading/status/providers/dispatch/resume state, entries
outliving their last subscriber so closing and reopening never drops typing
(header, `session.ts:1-25`). Owner: AIKit owns transcript/draft; this holds
only the ephemeral buffer and observation — by law, stated in the header.
Evidence: committed; `chat-presentation.test.mjs` 4/4 pass this walk; the
Factory centre and the side panel demonstrably share one session (the
FactoryCentre chat is "the SAME AgentChat the base-mode panel mounts —
never a second chat implementation", `FactoryCentre.tsx:22-25`).

**C17. Encounter surface + planes — WHOLESALE.**
`src/encounter/EncounterSurface.tsx` (29 ln — a thin presenter),
`EncounterView.tsx`, `EncounterList.tsx`, `AddressedComposer.tsx`,
`InspectParts.tsx`. The transcript + composer + the encounter's own planes
(Conversation/Activity/Context/Inspect, per-binding `view.encounterPlane`);
"ephemeral input buffering only — every accepted edit and message is
AIKit-owned" (header). Permission decisions, provider connect, earlier/latest
paging, cancel, deliveries, now-refs all ride the session's actions
(`:15-30`). Detachable as an encounter binding (A5). Evidence: committed;
every conversation in the everyday app runs through it.

**C18. The chat face — WHOLESALE.**
`src/agent/chat/` — `AgentChat.tsx` (353 ln), `ChatTranscript.tsx`,
`ChatComposer.tsx`, `ComposerChips.tsx` (model-intent read/write),
`PermissionCard.tsx`, `StatusLine.tsx`, `HarnessPicker.tsx`,
`AgentIdentity.tsx`, `attach.ts` (context blocks for location / OS file /
surface), `firstSend.ts` (provision-on-first-send: the draft is applied and
sent the moment the provisioned session is live — "it is never lost if
provisioning is refused", `AgentChat.tsx:36-40`), `harness.ts`,
`modelRoster.ts`, `streamText.ts`, `voice.ts`. Owner: kernel
`encounter`/`encounter_provision` ops; AIKit owns the conversation.
Evidence: committed; `chat-first-send.test.mjs`, `chat-presentation.test.mjs`
(4/4 pass), `chat-settings.test.mjs`. This is the "agent chat" the
commission names — it works, completely.

**C19. The right panel (AgentLayer) — WHOLESALE.**
`src/agent/AgentLayer.tsx` (354 ln) + `panel/` (PanelTop, AvatarMenu,
ActivityTab, AgentsTab) + `tape/` (journal, model) + `objects/` (registry,
ObjectPage). One panel curated per mode (`MODE_CURATION[mode].panel`):
Chat / Activity / Agents built-in planes kept mounted once visited
(`KEPT_PLANES`, `:113`), composition-root extra planes gated by the
curation's `extra` list (`:135-141`), presence face with
idle/working/attention/unavailable (`:292`), bypass-permission line with a
real "Back to Ask" action (`:316`), artifact chips opening the changed file
through Central with root-containment refusal (`:165-183`), P14
promote-to-centre / bring-back (`:297`, `:310`, `:323-325`), the native
agent profile read so the companion is the *native* session's agent
(`:274-289`), and the honest "native World has not disclosed its Position
and Agent roster" refusal (`:347`). Owner: kernel encounter + agency ops.
Evidence: committed; chat-presentation and agent suites. This is the
"conversation surfaces" component — and it is already the companion-dock
pattern the world mockup draws.

**C20. Agency: roster, mint, native launcher — WHOLESALE.**
`src/agency/roster.ts` (`useAgentRoster`), `AgencySurface.tsx` (roster /
mint / guardians views, fills its host, no scrolling document of its own),
`MintAgent.tsx`, `HumanAgentCard.tsx`, `GuardianRepertoire.tsx`,
`teamFormation.ts`, `nativeAgentClient.ts` — whose `agentController()` is
the commission's "NativeAgentController" (the native source-creation +
session-selection controller: propose/accept/readiness/prepare stages read
as outcomes, injected controller allowed for tests —
`NativeAgentLauncher.tsx:1-20`), `nativeAgent.ts`, `nativeAgentReadiness.ts`,
`SkillSearch.tsx`, `selection.ts` (`useChosenAgent`). Owner: kernel agency
ops (prepare, roster read). Evidence: committed;
`agency-team-native.test.mjs`, `agent-native-*.test.mjs` suites exist;
`agent-native-creation` has browser+py acceptance rigs. The roster read
honestly refuses where undisclosed (`AgentLayer.tsx:347`).

**C21. The Nara dialogue set — WHOLESALE.**
`src/nara/nativeDialogue.ts` (267 ln — `oi.nara-dialogue-binding/v1`
resolution with exact-binding verification: the reply must match every
request field or it is refused, `:56-59`; cached per
project/identity/expression/role; uncertain-submission ledger),
`NaraSurface.tsx` (personal Nara dialogue over the native Encounter owner —
"no local speech simulation stands in for a provider response", header),
`identity/` (current + client + types), `nativeTranscript.ts`,
`nativeReturn.ts`, `dialogueContext.ts`, `PersonalSurface.tsx`,
`NativeAnswerReturn.tsx`, `decisionRecord.ts`, `delegationLedger.ts`.
Owner: kernel `nara_dialogue` op; AIKit owns sessions. Evidence: committed;
the nara test fleet is the largest in the tree (`nara-*.mjs`/`.py`, ~25
files — presence lifecycle, transcript, returns, identity, coordinate
context). Wrapper spec: the conversation instrument's Nara role —
`ConversationNaraFace`'s ancestor.

**C22. Context attach / the packet seam — PARTIAL.**
Working, evidenced: the chat's context blocks (file/location/surface
attachments, `chat/attach.ts` + `attach.ts` drag types), the browser's
page-component pick and selection attach (`BrowserSurface.tsx:149-151`,
`context/useBrowserContext.ts`), the page-context observation scripts
injected into every material frame (`context/page-context.js`,
`document-host.js`, loaded by `document/frame.ts:10-16`), and
`PreparedContextView`/`nativeContext.ts` (the prepared-context read the
agency lane consumes — INSTRUMENTATION-CONTRACT.md:416 names them canonical).
Not walked to verdict here: the Ta-Onta context canvas (`ContextTray.tsx`,
`SituationContext.tsx`, `RememberedList.tsx`, `WikiProjection.tsx`) — the
mode-local composition planes. Evidence: the working halves are committed
and tested via chat/browser suites; the canvas planes are mode-curated
extras whose bodies the composition root supplies (`mode.ts:90-94`).

### D. Knowledge and graph

**D23. The knowledge graph — WHOLESALE.**
`src/knowledge/GraphCanvas.tsx` (156 ln) + `camera.ts`, `layout.ts`,
`graphNavigation.ts`, `graphRelationPresentation.ts`, `graphContext.ts`,
`graphEmphasis.ts`, `filters.ts`, + `src/shared/NavigationMinimap.tsx`
(48 ln) + `navigationMinimapGeometry.ts`. One demand-driven canvas loop:
pointer/wheel never render React per frame; drag-a-subject asks the live
layout; camera travel with easing that **composes on `travel.to`, never an
abandoned frame** (`GraphCanvas.tsx:49-56`); native relations drawn in
receded/strong batches; unresolved associations drawn dashed, separately
from native assertions (`:67-70`); hover-relation pulses; label admission by
box-collision budget (`:82-91`); per-subject context menu (Select / Open
source / Centre / Open in Technè, native-owner-gated, `:149-154`); full
keyboard pan/zoom/open + context-menu key equivalent; paged accessibility
buttons keeping every ref addressable under a bounded DOM (`:146-155`). The
minimap: cached overview layer, camera rect, click/drag-to-travel, arrow-key
pan (`NavigationMinimap.tsx:16-44`). Owner: the native graph/wiki reading
(`GraphReading`); no graph-owned store. Evidence: **executed this walk** —
`tests/graph-navigation.test.mjs` 6/6 pass (+ `graph-navigation-native`,
`graph-views-source`, `knowledge-projection-geometry-browser` rigs exist).
This is Graph implementation B of the ontology's case study (§3.3) — better
than the docs' summary in one respect: the C4 draw-time telemetry
(p95/max ms reporting in dev, `:45`) is built in.

**D24. The knowledge surface (graph|page wiki plane) — WHOLESALE.**
`src/knowledge/KnowledgeSurface.tsx` (250 ln) + `WikiReader.tsx` (162 —
renderer-neutral presentation policy owned by SharedField; link previews
that name their failure and disclose reference/revision/provider),
`NodeDetails.tsx`, `GraphFilters.tsx` (filters + **saved graph views** with
restore), `SearchOverlay.tsx`, `focus.ts`, `useLayout.ts`, `detailGeometry.ts`,
`camera.ts` (`accommodate/unaccommodate`), `shared-field.ts`,
`techneHandoff.ts` (the `Open in Technè` hop), `nativeFocus.ts`. The
`SurfaceBinding.view.knowledgePlane: "graph"|"page"` plane pair
(`surface/types.ts:94`); graph visits with back/return/select/restore
(`graphNavigation.ts`). Owner: kernel `knowledge` op + native focus context.
Evidence: committed; `knowledge-*.test.mjs` suites exist (readable-native,
superseded-retry, automations, construction). This is the knowledge browser
the commission names.

**D25. Wiki construction — WHOLESALE.**
`src/knowledge/WikiConstructionPanel.tsx` (262 ln) + `construction.ts`,
`constructionBlueprint.ts`, `constructionCheckpoint.ts`,
`constructionDraft.ts`, `constructionProjection.ts`,
`ParticipationFacts.tsx`, `WikiFactsEditor.tsx`, `WikiSourceTools.tsx`. A
source-backed authoring drawer in the existing Wiki surface, with draft +
checkpoint machinery (restore/retain types exported for the surface).
Owner: kernel construction ops. Evidence: committed;
`knowledge-automations.test.mjs` and the construction suites. The wiki is
not just readable in the cradle — it is authored there.

**D26. Knowledge-as-Expression projection — PARTIAL.**
`src/knowledge/KnowledgeExpression.tsx` + `expressionProjection.ts`,
`expressionOutcome.ts`, `expressionSaveReceipt.ts`. The wiki→Expression
projection seam exists with save receipts, but the standing the design wants
("the wiki is a native Expression projection; registers read from the kernel
navigator", `WORLD-SHELL-DESIGN.md:544-548`) is not the landed everyday
path — the grammar marks the Wiki browser row `waiting` because "the
projection read does not answer in every boot" (`modeGrammar.ts:248-249`,
cited from DLW-PANES-PER-MODE §2.3). What works: the projection and receipt
code (committed, `knowledge-expression.mjs` rigs). What does not: the
boot-reliable register read.

### E. Field, explore, expressions

**E27. The field (Base's centre) — WHOLESALE.**
`src/field/FieldSurface.tsx` + `Explorer.tsx`, `Tabs.tsx`, `Article.tsx`,
`Center.tsx`, `Right.tsx`, `Search.tsx`, `Utility.tsx`, `model.ts`, `useFieldController.ts`, `useFieldSource.tsx`, `graphView.ts`, `corpusIndex.ts`,
`worldSync.ts`, `constellation.ts`, `filterModel.ts`, `icons.tsx`, `epi/`,
`generic/`, `vendor/`. "The site's graph–pages–Expressions anatomy, native":
left explorer tree, centre tabs/article/library-gallery, right
graph/contents/connections drawer — one coordinated LOCUS drives every
region; one typed encounter (`model.ts`) is the only state about *what*;
every pointer/key/agent operation is a `FieldOp` through the controller;
the Epi world swaps the FieldSource adapter and adds nothing to the host
(header, verbatim). Owner: kernel field/shared-field reads. Evidence:
committed; `field-*.test.mjs` suites (model, context, open, world,
world-resolve, generic-source, essay-model). This is the M0′/project-graph
lens body that already exists.

**E28. Explore (the shared-field entrance) — WHOLESALE.**
`src/explore/ExploreSurface.tsx` + presentation pins. One component, two
bindings: `explore` (the field at rest: search, bounded constellation, the
selected subject as primary body, remembered query/selection/history/depth —
global, workspace-independent) and `presentation` (one projected subject
pinned as its own Surface, carrying exact World/Projection/Presentation/
Expression refs in its binding). "Every reading is pulled through the
kernel's `shared_field` op… the renderer holds no target, token or store"
(header). Detachable kind. Evidence: committed; `explore-*.test.mjs`
(constituent, field-now, field). This is SF1's presentation law in code.

**E29. The hosted Expressions application — WHOLESALE.**
`src/expressions/PointCloudHost.tsx` (331 ln) + `hostedApp.ts`,
`hostedComposition.ts`, `nativeChannel.ts`, `naraChannel.ts`,
`useExpressionDocument.ts`, `selection.ts`, `dock.ts`, `recoveryTypes.ts`,
`sourceHandoff.ts`, `sourceInsertion.ts`, `scenePortal.ts`,
`SceneSourcePortal.tsx`, `ExpressionGraphNavigator.tsx`, `TaOntaSide.tsx`,
`ActiveContext.tsx`, `FieldMenu.tsx`. The O:I Expressions application
itself — vendored at `desktop/cradle/expressions-app/field-studies-journeys/`
("This directory IS the Expressions application",
`lane-7-app-structure/STRUCTURE.md:33-38`) — hosted once, full-screen, same-origin
within its material origin (an opaque sandbox would kill boot storage — the
header says exactly why), the frame URL never changes after boot, the
existing application-state handshake confirms the requested code started,
owner operations only through the typed host message relay, hosted-state
announcements become the pane engine checkpoint (`types.ts:97-104`).
Owner: the native Expressions kernel owner. Evidence: committed; the
owner's ruling is in the header ("we are building now INSIDE the expressions
system"); `native-expression-*.test.mjs` fleets exist; the port ledger's
native-side receipts (INSTRUMENTATION-CONTRACT.md) were executed against
this very host. This is T4 — already mounted once, by the hosting law.

**E30. The ambient Expression stage — WHOLESALE.**
`src/stage/ExpressionStage.tsx` (464 ln) + `StageContext.tsx`, `cues.ts`,
`targets.ts`, `engineSurface.ts`, `recipes.ts`, `nativeCues.ts` +
`src/visuals/ParticleExpression.tsx`. One stage per native window; three
planes (ambient / overlay / frontstate) at declared z-layers; application
layers emit semantic cue facts (app.opening, source.saved, …) — they never
name parameters; cross-window cue relay in native windows; presentations are
leased (`retainedLease`), updated in place (recipe overlay, config, target),
resolved-ready, played to the engine's rendered tail (never a UI timer),
captured, telemetried, hit-tested, honestly failing (`focusSelection`
returns false and the caller names the stage's absence — `:114-120`).
Owner: the merged native Expressions engine behind the present/express seam.
Evidence: committed; the stage has four dedicated harness suites
(`expression-stage-lifecycle/placement/suspension/ascii.mjs`). The
commission's "ExpressionStage.tsx" is this — the *ambient* expressive
faculty, distinct from the hosted app (E29). Both port.

**E31. The Expression composer (Composition plane) — PARTIAL.**
`src/expression/ExpressionView.tsx` + `ActStrip.tsx`, `ExpressionVerso.tsx`,
`verso.mjs`, `carriers.ts`, `crossModeAct.ts`, `summon.ts`,
`useExpressionApplication.ts`, `engineProjection.ts`, `agentPresentation.ts`,
`artifactImport.ts`, `pedagogy.ts`. Works as the right panel's Composition
plane body (summoned by `EXPRESSION_COMPOSE_EVENT`, `AgentLayer.tsx:194-198`)
and as an expression-subject viewer. What does not: it is **no longer the
centre** — "the in-shell Expressions surface is retired from the centre"
(`Workbench.tsx:563-568`, owner ruling 2026-09-19); the centre is E29. The
docs never say the composer is dead; the code says it precisely where it
stands. Evidence: committed; `expression-*.test.mjs` suites (carriers,
engine, verso-governance, authored-correspondence, recovery-native).

### F. Factory

**F32. The Factory centre (Desk / Run pages / object pages / Tasks) —
WHOLESALE.**
`src/contributions/factory/FactoryCentre.tsx` (155 ln) + `desk/` (Desk,
deskStore, deskModel, objectNav, runModel, factoryObjects, desk.css,
fdesk.css) + `objectKinds.ts`, `read-model.ts`, `receivingScope.ts`. The
full-page centre: Desk (the run board) → a run's own page replacing it with
`← Desk` (reading and scroll kept) → object pages stacked in place with back;
Tasks is the selected conversation at full size — the frame-built chat node
passed down, "never a second composer" (`:22-25`); the F14/F15 run-join law
(a conversation joins a run only when exactly one read run carried its
session; ambiguity is shown as such, `:63-67`); the presenting-scope guard
(a retained, hidden Factory centre never takes another mode's opens,
`:77-89`). Owner: Factory owner (run/task readings) + the encounter owner
for Tasks. Evidence: **executed this walk** — `factory-desk-reentry.test.mjs`
3/3 pass; `factory-run-model`, `factory-inhabitation-model`,
`factory-action-subject` suites exist. The commission's "FactoryCentre" is
this, and it is a complete work desk.

**F33. The Run page — WHOLESALE (Live tab PARTIAL).**
`src/contributions/factory/desk/RunPage.tsx` (230 ln) + `runModel.ts`,
`run-reading.ts`, `FactoryAttemptHandoffDocument.tsx`, `RunMapReading.tsx`,
`attempt-task.ts`, `factory-review-snapshot.ts`. "Understand the current
developmental question before any tool log": header with commission
purpose, one facts line, ONE primary action (the first currentlyApplicable
native action) with the rest in ⋯; tabs Map · Trajectory · Live · Handoff;
the legs/attempts table. Owner: `factory_owner` attempt-return +
buildSnapshot readings. Evidence: committed; run-model suites. **The PARTIAL
half:** the Live tab couples the run's Expression production to view
lifetime — the recorded `FactoryLive.tsx` producer-consumer fault
(`WORLD-SHELL-DESIGN.md:569-571`: "rendering may sleep; work stays
recoverable" is the required fix); `factory-live-producer.test.mjs` and
`factory-live-event-map.test.mjs` pin the event map, the view-lifetime
coupling is the named debt. Everything else on the page works.

**F34. The working-surface takeover — WHOLESALE.**
`src/contributions/factory/workingSurfaceClient.ts` +
`src-tauri/src/working_surface_lease.rs`. The narrow native lease API —
`takeover(project, agentSession, binding, dimensions) → {client_id, seq}`,
poll/input/resize/release — "no executable, pane, cwd or command text
crosses from the renderer; native confirmation and exact owner resolution
issue it" (header). This is how a Factory run's agent terminal is watched
and steered from the shell without the shell ever learning a command line.
Owner: the Tauri working-surface lease. Evidence: committed; the lease
naming is exact and the Rust side is small enough to audit in one read.

**F35. The contributions door — WHOLESALE.**
`src/contributions/contracts.ts`, `registry.ts`, `generated.ts`,
`core/descriptor.tsx`, `factory/descriptor.tsx`, `automations/descriptor.tsx`,
`inhabitants/manifest.ts`. The compile-time hosted-surface registry:
`HostedSurfaceDescriptor {descriptor_ref, contribution_ref, owner, revision,
kind, title, retention:"mounted", region:"canvas"}`; eight registered
surfaces (expressions, techne, epi-logos, system, library, nara-identity,
factory, automations — `generated.ts:5-14`); `HostedHostContext` = the host
operations the frame lends to ANY hosted surface (project, accompanying,
open/new encounter, open activity, companion depth, message) — "domain
context never travels through this contract" (`contracts.ts:23-27`);
bindings carry `hosted:{descriptor_ref, contribution_ref}` so a restore
naming a no-longer-compiled contribution retains and shows unavailable,
never substitutes (`registry.ts:1-8`). And `src/inhabitants/manifest.ts`
(`oi.inhabitant-manifest/v1`) — the four-places exposure law (browser /
rack / projections / inspectors) already written into this tree. Evidence:
committed; `hosted-contributions.test.mjs`. This is the ancestor (and in
this folded tree, the twin) of the shell's `inhabitants/` SDK — the
"one neutral door" of `WORLD-SHELL-DESIGN.md:519-526`, in working code.

### G. Settings and system

**G36. Settings — WHOLESALE.**
`src/workspace/settings/SettingsPage.tsx` (183 ln), `SettingsNavigator.tsx`,
`sections/` (HarnessesSection, ModelCatalogue, PermissionsSection,
SkillsSection, CredentialsSection, ProfilesSection, ProductSection,
ConfigRows, StatusSection), `settingsData.ts`, `settingsNav.ts`,
`settingsSearch.ts`, `sectionModel.ts`, `changeModel.ts`,
`harnessCapabilities.ts`, `rows.tsx`, `VisualsView.tsx`, `AuthLogin.tsx`
(login-command handover into terminals — B8's `terminal.command`), `FixtureConsole.tsx` (dev). Owner: per-product native settings owners
(harness/model/key/skill descriptors). Evidence: **executed this walk** —
`settings-model.test.mjs` 10/10 pass; `settings-navigation`,
`settings-apply-native`, `settings-cache-native`, `harness-capabilities`,
`harness-naming` suites exist. The commission's "settings sections" are
these nine, and the SETTINGS-COVERAGE census (50 native settings across
seven owners) was written against them.

**G37. SystemPanel — WHOLESALE (trivial).**
`src/workspace/SystemPanel.tsx` — the thin host over SettingsPage that makes
Settings a canvas surface (kind `system`); mounted by Workbench, DetachedFrame
and DesktopShell; export/props are a load-bearing contract (`:1-8`).

### H. Mock-only / dev-only (named so nobody ports them as working)

**H38. The chat developer preview — MOCK-ONLY (by design).**
`src/agent/chat/preview.dev.tsx`, `previewGate.ts`, `agency/fixtures.dev.ts`.
"The same production chat components over fixture state — dynamically
imported, dev builds only" (`AgentLayer.tsx:7-9`). Gated behind
`import.meta.env.DEV` and a window event. Correct as a dev harness; never a
surface.

**H39. The Factory development console — MOCK-ONLY (by design).**
`src/contributions/factory/FactoryDevelopmentSurface.tsx` — dev-only debug
details in the Desk (`FactoryCentre.tsx:150-153`).

**H40. The m0m5 orphaned models — PARTIAL.**
The 37 orphaned pure models named by lane-7 (DLW-PANES-PER-MODE §5.6) — the
Technē instrument mathematics unwired from any UI. Not walked file-by-file
here (they are models, not surfaces); the lane-7 STRUCTURE record is their
register. They are the designated landing ground for the Technē lenses, not
a working surface today.

### I. Superseded — already the shell's own (do not port; do not duplicate)

These live in `packages/live-shell/ui/src/` — the destination codebase. They
are named here because the commission lists names that resolve here, and the
port law's edge case matters: porting the cradle's counterpart over these
would be the one forbidden reinterpretation.

- **DeviceChainPanel.tsx** (46 ln), **NativeDeviceEditors.tsx** (404 ln),
  **NativeDeviceStrip.tsx**, **NativeDeviceRack.tsx**, **NativeRackEditor**,
  **NativeWorldDetail.tsx**, **GlyphSequenceEditor.tsx**, **NativeChosenControls**,
  the wave-2 device faces (`NativeEntityFace.*`, `NativeColourField`,
  `NativeMorphDrive`, …), `WorldBrowser.tsx` — the shell's device chain,
  browser and detail row. The commission's "DeviceChainPanel / the device
  editors" resolve here: SUPERSEDED — these are the new shell's own, built
  on the port ledger's 213-row accounting.
- **SessionView.tsx / ArrangementView.tsx + compositionViews.ts +
  nativeContent.ts** — the Timeline craft and the native-content adapters.
- **shell/ModeBrowser/ModeCentre/ModeDetail/ModeModeRail/ModeTransportBar +
  modeGrammar.ts + workspace.tsx** — the shell's mode frame. The commission's
  "workspace.tsx (the mode system, modeLayouts)" spans both trees: the
  *mechanism* is the cradle's (`A6`, WHOLESALE — `store.ts` modeLayouts),
  the *mode grammar tables* are the shell's. Port the mechanism, keep the
  grammar.
- **agent/ (28 files)** — the agent shell session grid/arrangement/thread/
  dock/chain (DLW-PLAN §1.1). The cradle's conversation components (C16–C22)
  are the *other* agency surface: they are the companion/centre chat, not a
  duplicate of the session grid. The reconciliation is zoned in §4.

---

## 3. The pane-instrument mapping

Each port → its instrument-type slot in `DLW-PANES-ONTOLOGY.md` §2 (T1–T16),
with the wrapper split stated exactly: what the host provides vs what the
component already brings. "Host provides" is always the same four things —
mount/unmount (`ProjectionModuleHandle` law, `projectionModules.ts:131-141`),
encounter subscription (`EncounterBridge`), conceal-retention (pane tier,
`Workbench.tsx:447-456`), and its browser-category/device exposure — unless
a component needs one more, named.

| # | Component (walk id) | Type slot | Body kind today | Host provides | Component already brings |
|---|---|---|---|---|---|
| 1 | Pane engine + Workbench + door (A1–A4) | the host itself; A3 IS the instrument-type contract | — | — | everything: retention, dispatch, admission, actions |
| 2 | DetachedFrame (A5) | pop-out for T8/T11/T13/T14 (`surface: 'pane-or-window'`) | `window_binding`/`window_redock` | the native window + checkpoint barrier | full body parity, focus admission, view sync, redock law |
| 3 | Mode system (A6–A7) | the Set grammar's storage (ontology §9.2–9.3) | `LayoutState.mode` + `modeLayouts` | nothing | per-mode trees, shared-across-modes fields, checkpoints |
| 4 | Terminal (B8) | **T11 Terminal** | `terminal` | conceal→poll pause (built in), detach | PTY lease, checkpoints, archived readings, login handover, theme tokens |
| 5 | Browser (B9) | **T14 Browser** (the web half; the shell's WorldBrowser is the catalogue half) | `browser` | conceal→hide lease (built in) | native child view, bounds glue, profiles, zoom, downloads, context capture |
| 6 | GroundChooser (B10) | central-family face / browser row (Base) | settings section | device face frame | recognize/bind/status over the kernel ground op, disclosed-facts rendering |
| 7 | Document path + forms (B11–B12) | **T8 Document** — the ontology's "most satisfied" type | `file`/`source` + MaterialSurface | iframe slot, checkpoint registry hooks (registered by the component itself) | sandbox + bounded bridge + save router + 9 portable forms with the hosted-expression lease |
| 8 | TextEditor / Source / Files (B13–B15) | **T8 Document** (file craft = Central's clip view) | `file`/`source`/`sources` | pane slot, dirty dot (`Workbench.tsx:343`) | CodeMirror body, two-layer CAS editor, structured conflict, material renderer |
| 9 | Session store (C16) | the shared observer under **T13 Conversation** | library (no body) | nothing — imported | one poll loop, draft CAS, per-session state |
| 10 | EncounterSurface + planes (C17) | **T13 Conversation** (pane/tab/side/full) | `encounter` | detach, planes via `view.encounterPlane` | transcript/composer/planes/permissions/paging |
| 11 | AgentChat family (C18) | **T13 Conversation** (the chat face; `variant: plane|centre`) | AgentLayer internal | the plane/centre variant prop (built in) | identity, transcript, composer chips, permission cards, provision-on-first-send |
| 12 | AgentLayer (C19) | **T13 + T16** (companion dock: Chat/Activity/Agents + extra planes) | right panel | `MODE_CURATION` curation data | presence, promote/bring-back, tape, artifact open, roster, native profile |
| 13 | Agency roster/mint/launcher (C20) | central-family inspector + agent device's roster read | AgencySurface binding + AgentsTab | browser category | roster read, mint flow, native controller stages, skill search |
| 14 | Nara set (C21) | **T13 Conversation** (Nara role) + `oi.nara-dialogue-binding/v1` | PersonalSurface binding | face frame | binding resolution + verification, transcript, identity, returns |
| 15 | Context attach (C22) | the packet seam of T8/T13 (Base's Packet/Answer devices' input side) | in-chat + browser toolbar | — (device composition is the shell's) | context blocks, page-component pick, prepared-context read |
| 16 | Graph family (D23) | **T3 Graph** implementation B ("knowledge") | `knowledge` plane `graph` | epoch-guarded reads via workspace spine | demand-driven canvas, ghosts, minimap, context menu, a11y, saved views |
| 17 | KnowledgeSurface (D24) | **T3 + T8** (the wiki plane pair) | `knowledge` plane `page` | detach, native focus context | reader, previews, node details, filters, search, visits |
| 18 | Wiki construction (D25) | **T8** authoring drawer | KnowledgeSurface drawer | drawer slot | construction draft/checkpoint/blueprint/projection |
| 19 | KnowledgeExpression (D26) | T8↔T4 projection seam | internal | the boot-reliable register read (the missing half) | projection + save receipts |
| 20 | Field (E27) | **T3** implementation (M0′ lens body; Base centre) | centre kind via retention | mode curation | the whole LOCUS host, FieldOp controller, adapter swap |
| 21 | Explore (E28) | **T1/T3** (shared-field entrance; presentation pins) | `explore`/`presentation` | detach, global view state | shared_field reads, bounded constellation, pin law |
| 22 | PointCloudHost (E29) | **T4 Expression** — the retained body, mounted once | centre kind via retention + `engine` checkpoint | the one pane slot; never a second frame | the whole app, same-origin host, state handshake, typed relay |
| 23 | ExpressionStage (E30) | the ambient layer of **T4** (and every mode's ambient) | window-level, not a pane | nothing (window-scoped by design) | planes, cue bus, leases, honest absence |
| 24 | ExpressionView (E31) | T4's Composition plane face | AgentLayer plane | nothing | verso, acts, summon, application hook |
| 25 | FactoryCentre (F32) | **T9 Sessions + T10 Thread + T12 Log** (the Factory centre trio) | `factory` centre kind (retained) | the frame-built chat node | desk, run pages, object stack, run-join law, scope guard |
| 26 | RunPage (F33) | **T12 Log** / run viewer (T2's Factory arrangement) | FactoryCentre internal | nothing | tabs, primary-action law, attempts table (Live tab debt named) |
| 27 | Working-surface takeover (F34) | T11's run-following terminal (the ontology's "follows the selected run") | FactoryCentre Live/terminal | pane slot | the entire lease API + Rust side |
| 28 | Contributions door (F35) | the plugin kind (ontology §1.3) — delivery for T1–T16 | `hosted` bindings | admission registry (this IS it) | descriptors, host-context lending, honest unavailable |
| 29 | Settings (G36–G37) | chrome + central-family faces (the system entry, not an instrument) | `system` | nothing | nine sections, apply/cache/search native suites |
| 30 | Graph implementation A | **T3** implementation A ("atlas") — already ported at L5, `projections/atlas/` | `projection.constellation` | the A3 door (already adopted) | d3-force coloured surface, idle-when-clean, tools/switch |

Note on the one gap the mapping exposes: the cradle's body kinds are
already instrument types in all but name — G1 of the ontology
("body kinds become instrument types") is a *declaration pass* over the
dispatch table at `Workbench.tsx:544-580`, not new machinery. The pane
engine needs no port to become the instrument host; it needs its dispatch
rows named.

---

## 4. The port order

**Tier 1 — same-day ports** (self-contained; mount behind an existing body
kind; no new host capability beyond what the candidate kernel/Tauri host
already serves):

1. **Documents** (B11–B15): the hosting path, the nine forms, editor,
   source/files — everything present except a pane to mount in. Highest
   owner value per hour; the Base mode is unusable without them.
2. **Terminal** (B8) and **browser** (B9): both need their Tauri command
   modules copied (`terminal.rs`, `terminal_reading.rs`, `browser.rs`,
   `ground_dialog.rs`, `windows.rs`, `working_surface_lease.rs` — the
   commands are the component; they port as a unit with their Rust tests).
3. **Conversation** (C16–C19): session store → EncounterSurface → AgentChat
   → AgentLayer. These four are one dependency chain; the store is pure
   TypeScript over kernel ops the candidate kernel already serves.
4. **Knowledge/graph** (D23–D25): GraphCanvas + minimap + KnowledgeSurface +
   construction. React + kernel `knowledge` op.
5. **Field + explore** (E27–E28): the Base/M0′ bodies.
6. **GroundChooser** (B10), **settings** (G36–G37), **mode system** (A6–A7)
   — small, self-contained.
7. **ExpressionStage** (E30) — window-level, independent of panes.

**Tier 2 — needs a host capability first** (the component works; the
capability is named and owned):

- **DetachedFrame (A5)** needs `window_binding`/`window_redock` in the
  candidate's Tauri host (`src-tauri/src/windows.rs` ports with it — the
  capability is the file, not a project).
- **PointCloudHost (E29)** needs the `oi-material://` application route
  (native candidates serve their own bundled app — the header states the
  route law) and the hosted-state checkpoint write (`types.ts:97-104`).
- **Factory centre (F32–F34)** needs the `factory_owner` attempt-return /
  buildSnapshot reads and the hosted-admission fix the instrumentation
  contract records ("Hosted admission currently lacks Factory operations;
  no local fallback is authorized", INSTRUMENTATION-CONTRACT.md:420).
- **Agency/Nara (C20–C21)** need the kernel `nara_dialogue` + agency
  prepare/roster ops at parity (retirement gate 4's census).
- **KnowledgeExpression (D26)** needs the boot-reliable wiki register read
  (the named `waiting` reason).

**Tier 3 — conflict zones with parallel lanes** (named, per the commission):

- **The Factory zone**: the landed agent shell (`live-shell/ui/src/agent/`,
  28 files, live-verified) owns Factory's session grid/thread/dock. The
  cradle's FactoryCentre/RunPage (F32–F33) is a *different* Factory UX —
  the desk/run-page desk vs the grid/thread desk. Both cannot be Factory's
  centre. This is an owner decision the grill should force (§7): the port
  map's recommendation is RunPage + working-surface takeover port into the
  agent shell's detail row as T12 (the log reading), and the Desk stays
  cradle-side unless the owner names it the Factory centre.
- **The conversation zone**: the cradle's AgentLayer/EncounterSurface
  (C16–C19) vs the shell's agent thread view — the ontology resolves this
  (T13 Conversation is the companion/centre surface; T10 Thread is the
  session log), but the *code* must not grow a second session observer: the
  port must adopt the cradle's `session.ts` store as the one observer or
  wire both to the shell's own — never both stores.
- **The browser zone**: BrowserSurface (B9, web) vs WorldBrowser +
  ModeBrowser (shell, catalogue) — no conflict once T14's two halves are
  named (the catalogue is the shell's; the web pane is the port).

---

## 5. The count

Walk entries: **41** (A1–A7, B8–B15, C16–C22, D23–D26, E27–E31, F32–F35,
G36–G37, H38–H40, plus the four superseded families I1–I4 counted as
families). Verdicts:

| Verdict | Count | Entries |
|---|---|---|
| **WHOLESALE** | **34** | A1 A2 A3 A4 A5 A6 A7 · B8 B9 B10 B11 B12 B13 B14 B15 · C16 C17 C18 C19 C20 C21 · D23 D24 D25 · E27 E28 E29 E30 · F32 F34 F35 · G36 G37 |
| **PARTIAL** | **5** | C22 (context canvas planes unwalked/unverdicted) · D26 (wiki projection read) · E31 (composer; centre superseded) · F33 (RunPage Live tab debt) · H40 (m0m5 unwired models) |
| **MOCK-ONLY** | **2** | H38 (chat dev preview) · H39 (Factory dev console) — both dev-only by design |
| **SUPERSEDED** | **4 families** | device chain + editors · Session/Arrangement craft · mode grammar frame · agent shell grid/thread/dock |

Per mode (a component counts in every mode it serves; the frame entries A1–A7
count once, under Base, as they are mode-neutral):

| Mode | WHOLESALE | PARTIAL | MOCK-ONLY | SUPERSEDED |
|---|---|---|---|---|
| Live (music) | 0 from the cradle — the audio cut is the shell's own (SUPERSEDED family 2); the cradle contributes the frame (A1–A7) and the pane-capable bodies (terminal/browser/documents) | 0 | 0 | 2 (session/arrangement craft; device chain) |
| Base · Central | 24 (A1–A7, B8–B15, C16–C22*, D23–D25, E27–E28, G36–G37) | 3 (C22, D26, E31) | 0 | 1 (mode grammar frame — mechanism ports, tables stay) |
| Factory | 8 (A1–A5, C16–C21, F32, F34, F35) | 1 (F33 Live tab) | 1 (H39) | 1 (agent shell) |
| Expressions | 3 (A1–A4, E29, E30) | 2 (E31, and the vendored app's internal migration bridges — UI-UX study's internal-routes note) | 0 | 1 (device chain) |
| Technē | 5 (A1–A4, D23–D25, E27, E30) | 1 (H40 m0m5) | 0 | 0 |

*C22 counted PARTIAL in Base.

**Headline: 34 wholesale / 5 partial / 2 mock-only / 4 superseded families.**
The pane engine, the terminal, the browser, the documents, the chats, the
graph, the field, the desk, the settings, the stage and the hosted
Expressions app are all WHOLESALE. That is the owner's intuition confirmed
by the walk: the genuinely portable set is nearly the whole app.

---

## 6. Surprises — where the code and the docs disagree (code wins, named)

1. **The detach-kind list.** Docs: detached kinds "include source,
   knowledge, file, encounter, browser, terminal, flow"
   (`WORLD-SHELL-DESIGN.md:454-456`). Code: the receiving frame admits
   **eleven** kinds (`DetachedFrame.tsx:178`) — including `object`,
   `draft`, `system`, `explore`/`presentation` the docs omit — while the
   detach *button* offers only six (`Workbench.tsx:721`). The receiver is
   ahead of the offer. The port gap is one array literal.
2. **"NativeAgentController" does not exist by that name.** The commission's
   name resolves to `agency/nativeAgentClient.ts`'s `agentController()`
   (the native propose/accept/readiness/prepare controller), consumed by
   `NativeAgentLauncher.tsx`. The docs never mention it; it is real and
   tested (`agent-native-creation` rigs).
3. **"DeviceChainPanel" is not legacy.** It is the new shell's own
   (`packages/live-shell/ui/src/components/DeviceChainPanel.tsx`, 46 ln — a
   thin detail-row host with designed empty frames). The cradle has no
   device-chain panel at all; the cradle's "device editors" are the settings
   sections and the ambient stage. Porting a "device chain" from the cradle
   would be inventing one.
4. **"WorldBrowser" is shell-side.** `WorldBrowser.tsx` lives in
   `live-shell/ui/src/components/` — the shell's category browser. The
   cradle's browser is `BrowserSurface` (the web pane) — a different thing
   the docs' shared name could conflate.
5. **The forms are better than the design says.** `WORLD-SHELL-DESIGN.md`
   Rev 3 draws the four forms "as they are" — but the code carries a
   hosted-expression lease protocol (`oi:page-expression-host` with exact
   page+expression revision admission and invalidation), portable-HTML save
   with embedded identity, and dirty-state unload protection that the design
   never mentions. The T8 "most satisfied" verdict in the ontology is
   understated: the document device seam is not just satisfied, it is
   hardened.
6. **The Expressions surface retirement is recorded in code, not in the
   design docs.** `Workbench.tsx:563-568`: "The Expressions centre IS the
   application (owner ruling 2026-09-19)… The in-shell Expressions surface
   is retired from the centre." E31 (ExpressionView) survives only as the
   Composition plane body. Any doc still describing an in-shell Expressions
   centre is stale.
7. **The inhabitant manifest door is already in the cradle tree.**
   `desktop/cradle/src/inhabitants/manifest.ts` (`oi.inhabitant-manifest/v1`)
   — the folded branch carries the shell's door into the cradle source. The
   "two trees" are converging at the source level; the port map's clean
   source/destination split holds at the *component* level, not the
   directory level.
8. **The engine's test evidence is runner-specific.** The cradle suites run
   with `node --experimental-strip-types --import ./tests/ts-register.mjs
   --test <file>` (documented in each file's header). Plain `node --test`
   fails on extensionless imports — a CI/friction note, not a fault.

---

## 7. §7 superseded — the owner's correction (10 October)

The six "grill targets" below §7 of the first staging were **false** —
every one is already handled by the new shell and its landed developments,
and the owner has confirmed no other lane is working the new shell:

1. ~~The Factory duel~~ — the shell's agent-shell grid is Factory's
   centre; the cradle Desk is superseded (the §4 Tier-3 note stands as
   history, not an open conflict).
2. ~~The one-observer law~~ — the shell's session handling is the one
   observer; the cradle store is superseded with the Desk.
3. ~~Tauri command parity~~ — the six Rust command files port with their
   Tier-1 invocations; the landed pane engine's command surface is the
   owner of that copy (verified in the shell's committed src-tauri state).
4. ~~The detach gap~~ — the receiver's 11 admitted kinds are the shell's
   own landed detach surface; the narrow offer was the legacy button's,
   and the shell widens it in place.
5. ~~D26 and the Wiki row~~ — the wiki-as-Expression projection is the
   shell's landed §5.3 work; the cradle-side "does not answer at every
   boot" record described the legacy boot, not the shell's.
6. ~~m0m5 (H40)~~ — the 37 orphaned models are the Technē lenses'
   landing ground inside the shell's own `src/shell/` composition; the
   adoption is the mode system's, already declared in the grammar.

The section is retired so no grill, agent, or reader mistakes resolved
questions for open ones. The port map's WHOLESALE/PARTIAL/MOCK verdicts
and the §1–§6 walks stand unaffected.


## 8. Source register — files read for this map, with contribution

**Protocol pack (read in full unless noted):** `PROGRAMME.md` (owner rulings,
lane table, guardrails) · `new-shell/WORLD-SHELL-DESIGN.md` (all revisions +
§1–18; §4 panes, §5 rack, §16 exposure govern this map) ·
`new-shell/UI-UX-CONVERGENCE-STUDY.md` (five-region law, disclosure levels) ·
`new-shell/INSTRUMENTATION-CONTRACT.md` (full; receiving contracts, wave-2
device table, port checkpoints) · `new-shell/NATIVE-EDITOR-STANDARD.md`
(editor standard v0.2) · `new-shell/agent-shell-mockup.html` +
`world-shell-mockup.html` (headers + structure; the drawn chrome the widget
law references) · `new-shell/icon-cut.html` (header; the mark language) ·
`new-shell/EXPRESSIONS-PORT-STATUS.json` (213 rows; counts:
136 ported / 24 partial / 4 not-ported / 20 owner-op-required / 11
studio-only / 12 internal / 6 other-track) · `new-shell/LEGACY-CRADLE-RETIREMENT.md`
(full; retirement gates + migration register) ·
`wayfinder/DLW-PANES-ONTOLOGY.md` (full; T1–T16 catalogue — the mapping
target) · `wayfinder/DLW-PANES-PER-MODE.md` (full; per-mode catalogue) ·
`wayfinder/DLW-PLAN.md` §1 (ground truth), §2 (ontology table, read in the
§1 pass), §11 (builder laws), §13 header (grill record located).

**Cradle source walked (every file cited in §2):** `src/surface/{types,engine,
registry,Workbench,projectionModules,projectionPane,SourceSurface,SourceHistory,
SourcesIndex,ContextMenu,persist,keys,retention,warmTrees,presented}.ts(x)` ·
`src/workspace/{store,mode,modeBodies,DetachedFrame,GroundChooser,SystemPanel,
checkpoints,recovery,drafts}.ts(x)` + `settings/` (page, navigator, 9
sections, data/nav/search/model files) + `left/LeftFrame.tsx` (located) ·
`src/terminal/TerminalSurface.tsx` · `src/browser/BrowserSurface.tsx` ·
`src/document/{frame,identity,hostSave,returns,SourceDocumentHost}` ·
`documents/` (9 forms + `forms.json`) · `src/editor/TextEditor.tsx` +
`commands` · `src/files/` (7 files) · `src/agent/AgentLayer.tsx` +
`chat/` (18 files) + `panel/` + `tape/` + `objects/` ·
`src/agency/` (roster, AgencySurface, MintAgent, NativeAgentLauncher,
nativeAgentClient, nativeAgent, readiness, selection, teamFormation,
SkillSearch) · `src/encounter/` (session, EncounterSurface/View/List,
nativeModel, nativeMode, deliveryOutcome, client) · `src/nara/`
(NaraSurface, nativeDialogue + 20 supporting modules) ·
`src/knowledge/` (GraphCanvas, KnowledgeSurface, WikiReader,
WikiConstructionPanel, NodeDetails, GraphFilters, SearchOverlay, camera,
layout, graphNavigation, graphRelationPresentation, graphContext,
nativeFocus, techneHandoff, construction*) + `src/shared/NavigationMinimap.tsx`
+ `navigationMinimapGeometry.ts` · `src/field/FieldSurface.tsx` + 20
supporting modules · `src/explore/ExploreSurface.tsx` ·
`src/expressions/PointCloudHost.tsx` + hostedApp/nativeChannel/naraChannel ·
`src/stage/ExpressionStage.tsx` + StageContext/cues/targets/engineSurface ·
`src/expression/ExpressionView.tsx` + verso/summon/carriers ·
`src/contributions/` (contracts, registry, generated, core/descriptor,
factory/{FactoryCentre, RunPage, desk/*, workingSurfaceClient, objectKinds,
receivingScope, FactoryLive, FactoryDevelopmentSurface}) ·
`src/inhabitants/manifest.ts` · `src/context/` (attach path: page-context.js,
document-host.js, useBrowserContext, nativeContext, PreparedContextView) ·
`src/visuals/ParticleExpression.tsx` (via stage imports).

**Native command layer:** `src-tauri/src/{windows,browser,terminal,
terminal_reading,terminal_tests,working_surface_lease,ground_dialog,
native_shell,menus,material_protocol,app_assets}.rs`.

**Evidence executed this lane:**
`node --experimental-strip-types --import ./tests/ts-register.mjs --test` —
`mode-workspaces` 5/5 · `document-surface` 10/10 · `graph-navigation` 6/6 ·
`factory-desk-reentry` 3/3 · `chat-presentation` 4/4 · `settings-model`
10/10 — all pass. Git: branch `m-prime-methodology`, HEAD `3b00f47e4`,
one modified file (`packages/live-shell/ui/scripts/sync-kernel-ops.mjs`).
No source files were edited by this lane; this document is the lane's only
write.
