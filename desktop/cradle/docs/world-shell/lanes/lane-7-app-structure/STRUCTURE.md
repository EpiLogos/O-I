# STRUCTURE.md — How the cradle app is organised: Expressions body vs techne mode

Lane 7 of the Technè instruments genuine-functionality-parity programme. 2026-10-07.
Survey target: `/Users/admin/Central/Work/O-I/desktop/cradle/` (READ-ONLY). Proposal: a minimal-churn structure for properly developing the techne side.

Naming law (owner ruling 2026-10-07): technē instruments are named plainly — project/graph, canvas, timeline, journey, places, palace. No M-prefixes. The deep instruments collectively: "the techne mode" / "the deep mode". Historical M-numbers appearing in code are quoted as code, not used as names.

STATUS: complete (survey + proposal), 2026-10-07.

## 0. Frame (ratified architecture, skimmed)

L5 lock (`/Users/admin/Central/Work/Quaternal-Logic/docs/L5-TECHNE-DUAL-READING-LOCK.md`) §11a (owner amendment 2026-09-19): M4′ = the general Expressions application body over the operative M1–M2–M3 backend; M5′ = the SAME application in the M5/M0 deep-working mode. One application, two operating modes; the 4:2 deep-mode changes change disclosure and available operation while subject identity and native Action ownership are preserved. Owner's survey framing: the live Expressions app is "instrument 0" — the body; techne is a MODE within it. Naming law (owner ruling 2026-10-07): the deep instruments are project/graph, canvas, timeline, journey, places, palace — no M-numbers; collectively "the techne mode" / "the deep mode". (Frame skimmed, not re-derived; M-numbers below appear only as quoted code identifiers.)

## 1. App shell and mode switching

**The §11a shape is genuinely in the code — one shell, one pane system, modes as curated presentation state.** `src/workspace/mode.ts` is the mode law: "A mode never forks the shell: it names which left body the sidebar region shows, which centre surface the mode opens inside the existing Workbench, and which planes the common right panel offers" (mode.ts:1–11). `WorkspaceMode = "base" | "factory" | "expressions" | "techne" | "epi-logos" | "settings"` (mode.ts:23). Expressions and techne are two of six curated modes, not parallel apps: `MODE_CURATION` gives expressions left body `expression-graph` + centre `expressions`, techne left body `wiki-map` + centre `techne`, both with the same panel planes (mode.ts:108–119). Techne's own hint reads "The same living field, the deep cut" (mode.ts:117).

Mode state is presentation on the layout: `LayoutState.mode`, absent = "base"; "Switching modes never closes surfaces, never restarts an encounter session and never touches the window's one Expression stage" (mode.ts:7–10). Each mode owns its own pane tree (`w.modeLayouts`, CradleFrame.tsx:425–426); entering a mode opens its `MODE_CURATION[mode].centreKind` centre when its tree is empty (CradleFrame.tsx:936–973, `enterMode`).

**Entry path:** `main.tsx:17–20` renders `<Cradle/>` (or a DEV-only study). `Cradle.tsx:72–76` wraps `KernelProvider → VisualsProvider → ExpressionStageProvider → ExpressionProvider → Opening`; `Opening` (Cradle.tsx:48–70) shows `WelcomeField`, then lazily mounts `CradleFrame` under an error boundary (owner ruling 2026-09-19: no whole-page error screens, Cradle.tsx:16–46). `Rest.tsx` is the empty-workspace surface; its "Graph" button is the shell's own deep-mode entrance — "Graph enters the Technè mode — the one summon the shell's own mode entries use (enterMode). That mode's left body IS the graph aperture over the wiki/expressions projection" (Rest.tsx:19–24, button at :87). Host-process mode requests arrive as `oi:host-workspace-mode` events for `"expressions"` or `"techne"` (CradleFrame.tsx:976–982).

**Verdict on target 1:** "one application, two modes" is structurally TRUE at the shell level — but expressions and techne sit as siblings in a six-value mode enum curated identically (same left-body pattern, same panel), so nothing in `mode.ts` encodes the §11a claim that techne is the *same application* in deep mode. That equivalence lives one level down, in the centre hosting (§3). Confidence: high (direct reads of mode.ts, Cradle.tsx, Rest.tsx, CradleFrame.tsx excerpts).

## 2. The Expressions side (the body)

**Where the live body lives.** The Expressions application is vendored source-of-record at `desktop/cradle/expressions-app/` — "This directory IS the Expressions application (owner ruling 2026-09-19: 'we are building now INSIDE the expressions system, not around it')" (expressions-app/README.md:1–5). The actual app is `expressions-app/field-studies-journeys/` (the journey/expression editor, Library, capture, toolbelt); `src/` in that tree is the WebGL point-cloud engine. The **one build law** (README.md:7–17): `npm run build` emits `dist/` with relative base; the native desktop serves it at the reserved `oi-material://…/__application/expressions/index.html` route and embeds the built bytes in the candidate; browser webviews cannot reach the route; the frontend marks ready only after its own state handshake.

**How the cradle hosts it.** `src/expressions/PointCloudHost.tsx` is the single host: an iframe whose URL is minted once at mount (`hostedAppUrl`, PointCloudHost.tsx:73–89; `__application/expressions/index.html?mode=<mode>&expression=<ref>`, hostedApp.ts:30–34) — "the frame's URL must never change after boot" (PointCloudHost.tsx:66–72). The host relays a **typed message channel** (hostedApp.ts:445–540): host→frame `host-mode` (`HostedAppMode = "expressions" | "techne"`, hostedApp.ts:465), `host-command` (`open-expression`, `lens`, `insert-source`, `refresh-expression`), frame→host `host-request` and `oi-app-state` announcements (the race-free initial read). A separate `oi-kernel-channel` relay (`relayKernelChannel`, PointCloudHost.tsx:107–120+) gives the frame typed kernel ops directly — "the kernel document is the only store" (PointCloudHost.tsx:104–106). Readiness = the app's own handshake (`watchHostedAppReady`, hostedApp.ts:533+); no native failure falls back to another checkout.

**The two src directories are a split by role, not duplication.** `src/expression/` (singular) is the kernel-document Expression reading/authoring layer — `useExpressionApplication.ts` ("the same state machine the Expression composer has always run… lifted out of `ExpressionView` so the composer and the Expressions centre surface share ONE implementation", :1–6), summon, ActStrip, crossModeAct. `src/expressions/` (plural) is the Expressions **mode** region — the host (PointCloudHost, hostedApp), its selection/field-open stores, the graph navigator, panel and portal wiring. The split is discoverable only by reading headers; nothing in the names says "document layer" vs "mode region".

**Bindings INTO the body from the techne side** live in `src/techne/`: `wikiExpression.ts` / `wikiNativeExpression.ts` (ensure/focus/publish native Wiki register expressions) and `wikiProjectionStore.ts` (the wiki→expression projection + selection request store; consumers include CradleFrame, WikiMapNavigator, LibraryBrowse, knowledge/techneHandoff, expression/ExpressionVerso). `src/instrument/nara-expression-adapter.ts` is a different, older seam: the K8 focused-instrument Nara adapter building native Expression entities from a QL-owned Nara session (`ql.nara-expression-session/v1`, nara-expression-adapter.ts:8–9) — presentation-only projection over the retained lease (:36–38). It is the FocusedInstrument path (`instrument/source.ts`), not part of the hosted-app hosting law. Confidence: high for hosting law and store split (direct reads); medium for the full consumer graph of `instrument/` (not exhaustively walked).

## 3. The techne side (the mode)

**The centre is the same hosted application.** `TechneCentre` "operates inside the hosted Expressions application. The cradle supplies owner readings; it never replaces the field with another lens UI" (TechneCentre.tsx:1–2). It mounts `PointCloudHost mode="techne"` (:90) with techne-only callbacks (`readTechne` = `readWikiSceneTechne`, `techneWorld` register listing/open, :76–86), consumes the wiki projection store's selection requests and opens them as native Expression field-opens (`requestTechneFieldOpen(expression_ref, binding.id, …)`, :42–75). The composition root binds surface kinds to mounts: `TechneHostedSurface → TechneCentre`, `ExpressionsHostedSurface → PointCloudHost mode="expressions"` (`contributions/core/descriptor.tsx:4–16`) — both over `surface/registry.ts`'s FRAME_DISCLOSED_KINDS "expressions"/"techne" (registry.ts:61).

**The deep-mode law is implemented inside the vendored app.** `app.ts` carries "One Expressions system, two operating cuts" (app.ts:860–866): `hostMode: 'expressions'|'techne'` (:869), `setHostMode` toggles `oi-host-techne`, swaps `lensStudio.setMode`, closes research/palace instruments on return to expressions, activates the standing lens on techne (:891–898). The `lens` command validates the plain names `['project','canvas','timeline','journey','place','palace']` (:940). Host-mode is answered with a fresh `oi-app-state` (:936). The research bodies — `researchInstruments.tsx` mounts the vendored Research Canvas `CanvasView`, `TimelineSurface`, `PsychogeographicMap` (+ `StreetViewSurface`, :7) keyed by `data.reading.subject.subject_ref` (:631, :665); `palaceInstrument.tsx` and `naraInstrument.tsx` stand beside them — with the vendor provenance recorded (`vendor/research-canvas/README.md`, `PROVENANCE.json`; maplibre confirmed at `vendor/research-canvas/packages/canvas/src/psychogeographic/renderer.ts`). The vendored app is sealed from cradle src (no cross-tree imports found); the only seams are the message channel and the kernel channel.

**The cradle-side contract and models.** `src/techne/contract.ts` (965 lines) is the `ql.techne/v1` mirror of the QL-MEF Technē contract — ported byte-identical (T3, contract.ts:1–5), instrument ids the plain names + `expressions` as "the conjugate 3:3 reading, not a deep instrument" (:27–33). It is ALIVE: `knowledge/` consumes its temporal/place facets and validators (ParticipationFacts.tsx:3, wikiFacts.ts:3, construction.ts:1), and `wikiReadingProvider.ts` builds `TechneReading`s over it. `techneReading.ts` types the disclosure binding (capability disclosure with availability and stated reasons; the subject "in its native identity", :31–35). `wikiReadingProvider.ts` is the registered reading provider TechneCentre and PointCloudHost read through.

**The orphaned half.** `src/techne/m0m5/` — 37 files of pure per-instrument models (canvas/journey/palace/place/project/timeline + `adapter.ts`, `reading.ts`) — has **zero importers outside itself**; the only reference from live code is a comment (wikiReadingProvider.ts:10). Inside it, imports run only to `contract.ts`, `techneReading.ts`, `session.ts`. Its own `adapter.ts` — "the TechneAdapter floor… the renderer-side composition seam between the instrument UIs and the native owners" (adapter.ts:3–14) — is likewise unreached. Lane 5's finding extends to the whole tree: every journey submodule (presence, sequence, vak, agent, proving-reading, beats, compose, crossing) has no consumers. These are **unwired, not abandoned**: lane 4's TARGET-SET names `m0m5/place/filter.ts` as its binding seam (`TimeWindow` :22–28, `coversWindow` :121–123), i.e. the models are the designated pure-model landing ground the lanes are about to wire.

**Also orphaned:** `techne/instrumentRail.ts` (the six-tab rail state; zero consumers — lane 1's claim verified) and `techne/instruments.ts` `DEEP_INSTRUMENTS` (consumed only by instrumentRail). So the cradle-side instrument constellation — vocabulary, rail, adapter, models — is entirely unreached, while the LIVE instrument UI is the vendored app's `lensStudio`/`researchInstruments` driven by host messages. `techne/lenses.tsx` (zero importers) feeds `techne/lens.ts`'s registry, and `techne/MaterialDepth.tsx` + `techne/session.ts` are unreached too. Alive on this side: `TechneCentre`, `wikiReadingProvider` + facet readers, `wikiProjectionStore`/`wikiNativeExpression`/`wikiExpression`, `WikiMapNavigator` + `MaterialNavigator` (mode left bodies, modeBodies.tsx:20–21,48,50), `material.ts` (refs-only scene store), `contract.ts`, `techneReading.ts`, `sceneConstellationRelation.ts`.

Confidence: high on dead/live classification (grep over all of src, import-graph based); the m0m5-as-landing-ground reading is inference from lane TARGET-SETs, marked as such.

## 4. The seams (kernel, surface registry, identity plumbing)

**Kernel bridge** (`src/kernel/bridge.ts:1–12`): three honest transports in order — Tauri `kernel_op`/`kernel_event_log` + `oi:kernel-event` push; a dev-only HTTP walk bridge (`window.__OI_KERNEL_BRIDGE__` / `VITE_KERNEL_BRIDGE`); and honest unavailability ("the app runs; kernel-backed surfaces disclose their absence"). `KernelProvider` (Cradle.tsx:73) starts native reads at boot, before the workspace composes. The hosted app gets the same typed seam through `relayKernelChannel` — the iframe is a kernel client, not a store (PointCloudHost.tsx:104–113).

**Surface registry** (`src/surface/registry.ts`): the frame discloses only its OWN operations for FRAME_DISCLOSED_KINDS — which includes "expressions", "techne", "epi-logos", "instrument" (:61); "Owner kinds join when their surfaces mount — until then their menus are empty, never invented" (:53–59). Centre kinds map to mounts in the composition root (`contributions/core/descriptor.tsx:11–18`); mode centres are singletons resolved by `centreBindingOf(ws, mode, kind)` (CradleFrame stageCentres; cited in techneSummonRecord.ts:7–10).

**Subject/identity plumbing — refs only, kernel document is the store.** The chain, each hop guarded:
1. The Expressions centre publishes what it shows into `expressions/selection.ts` — "selection = what the centre is ACTUALLY showing (a reading, not a command); request = what another region ASKS it to show… Refs only" (selection.ts:1–12).
2. The techne left body's wiki graph publishes selection *requests* through `wikiProjectionStore`; `TechneCentre` consumes them and resolves a register to a native Expression (`ensureWikiNativeExpression`/`focusWikiNativeExpression`), then asks for a field open naming ITS OWN binding id (TechneCentre.tsx:42–75).
3. `expressions/fieldOpen.ts` is the ONE buffered recorder+consumer for "open this native Expression in the presented Technē field" — deliberately not a fifth global `summonExpression` listener: "a raw global listener… would open a summon twice and would fire from a concealed, inactive host"; the consumer matches on target binding id so concealed hosts (warm trees, foreign-tree tabs) leave the ref for the presented host (fieldOpen.ts:1–17).
4. The composition root records summons only while the workspace stands in the techne cut, resolving the target by the same `centreBindingOf` call the stage slot uses to MOUNT the centre — "the recorded target is always exactly the presented host's binding id — never a concealed one" (`surface/techneSummonRecord.ts:1–10`, mode gate :26–31). This module exists because "the §41 fail-on-disconnect seam" lacked coverage — a patch-shaped proof the contract was implicit before.
5. Inside the frame, `openHostExpression` follows the ref through the native workspace (kernel inspect, no reload): "It opens in place… This is a subject change (§28): the field then stands on the opened work's own scene, camera and selection" (app.ts:910–925); refs starting `expression:` only, bad refs refused by the owner.
6. The frame answers with `oi-app-state` carrying `expression_ref`, `revision`, `scene_ref`, `selection` (app.ts:874–885) — the host's reading of subject state. The research instruments key their mounts on `data.reading.subject.subject_ref` (researchInstruments.tsx:631, :665).

**Actions and receipts.** The cradle-side TechneAdapter floor states the law — "native Actions are ROUTED, never executed: execution crosses the native authority seam (desktop KernelOp `invoke_action` / owner CLI)" (m0m5/adapter.ts:8–12), with `validateActionReceipt`/`validateActionRoute` — but that floor is currently unwired (§3); the live action path is the kernel channel's typed ops.

**The one stage.** `ExpressionStageProvider` wraps the whole app (Cradle.tsx:73); "switching modes never closes surfaces… and never touches the window's one Expression stage" (mode.ts:8–10) — the stage is app-global, modes are layout presentation. This is the deepest sense in which the shell already implements "one application".

## 5. Where the organisation actively harms development

1. **Two parallel architectures for "how instruments present", only one alive.** The cradle side carries a complete orphaned arrangement — rail (`instrumentRail.ts`), vocabulary (`instruments.ts`), composition floor (`m0m5/adapter.ts`), session model (`session.ts`), lens registry (`lens.ts`+`lenses.tsx`), depth viewer (`MaterialDepth.tsx`), and the 37-file pure-model tree (`m0m5/`) — while the LIVE presentation is the vendored app's `lensStudio` + `researchInstruments`/`palaceInstrument`, driven by host messages. A developer extending an instrument cannot tell which half to build in; the dead half still compiles and states laws (adapter.ts's routing law) that the live path enforces elsewhere by different means. This is the single largest harm: ~40 files of designed-but-unwired work whose relation to the live path is documented nowhere but lane notes.

2. **The boundary is real but illegible.** §11a's one-application-two-modes law is enacted by three scattered facts: `PointCloudHost mode=…` (a prop), the vendored `setHostMode` (a body class + lens-studio swap), and `fieldOpen`'s techne-cut mode gate. No directory, module or type is named as THE mode boundary; discovering it requires reading four files' headers. `src/techne/` is one flat directory of ~28 files spanning four distinct roles — live centre, wiki-projection bindings, orphaned model layer, mode left bodies — so the tree contradicts the law it implements.

3. **Naming confusion is structural, not cosmetic.** (a) The `m0m5` directory name and `mPrime: 0..5` field (instruments.ts:21–35) carry the retired M-numbering the owner has now ruled out of documents (naming law 2026-10-07) — code still teaches it. (b) "lens" names three unrelated things: `workspace/lens.ts` (the Epi-Logos world context, `useEpiLens`), the dead `techne/lens.ts` instrument registry, and the vendored `lensStudio.ts` (the LIVE instrument lenses). (c) `expression/` vs `expressions/` differ by one character with wholly different roles (document layer vs mode region). (d) Two mode enums must stay hand-synced: shell `WorkspaceMode` "techne" and frame `HostedAppMode` "techne", joined only by `postHostMode`'s runtime guard (hostedApp.ts:465–488).

4. **The summon/subject contract grew by patching.** The subject_ref path (§4) is correct but its correctness is spread across per-hop guards written after failures — `techneSummonRecord.ts` exists specifically because the §41 seam had no coverage; `fieldOpen.ts`'s one-recorder law answers a double-open bug class; `concealed host` semantics are re-explained in three headers. The contract has no single home, so every new entry point (knowledge/techneHandoff, ExpressionVerso, LibraryBrowse — all wikiProjectionStore consumers) re-negotiates it informally.

5. **Store idiom duplication.** `selection.ts`, `fieldOpen.ts`, `wikiProjectionStore.ts`, `material.ts`, `instrumentRail.ts` are five hand-rolled `useSyncExternalStore` external stores, each re-proving the refs-only/no-content-copy law in its own header. The law is right; the repetition means each new store re-argues it, and the dead rail proves one can be written, persisted and never wired.

6. **Concealed-host complexity.** Because mode switches never unmount surfaces and warm trees persist, a techne centre can be mounted-but-hidden in any mode's tree (fieldOpen.ts:9–17, techneSummonRecord.ts:4–6). The design handles it, but every new techne-side entry must reason about presented-vs-concealed hosts — a consequence of centre singletons living INSIDE per-mode pane trees rather than the mode boundary owning the centre slot.

What does NOT harm: the vendored app hosting law (one build, one route, handshake-gated), the kernel-owned document, the refs-only stores, and the surface-registry honesty are all sound and consistently enforced — the proposal builds on them rather than replacing them.

## 6. Proposal: structuring the techne side going forward

Principle: the code already obeys §11a at runtime; the work is to make the tree SAY so, retire the second (dead) architecture, and give the mode boundary one named home. Every move below is marked (a) rename/rehome, (b) new contract, (c) retire, with effort sense: S = hours, M = a day or two, L = rides existing phase work.

### P1 — One boundary module, named (b, M)

Create `src/techne/boundary.ts` as the single home of the mode contract, extracting laws that today live in four headers:

- **Crosses the boundary:** kernel-owned refs (`expression_ref`, `scene_ref`, `subject_ref` — opaque, never re-keyed), selection READINGS, kernel receipts, native Actions routed to their owners, the wiki-projection selection REQUEST, field-open summons with a named target binding.
- **Never crosses:** mode-internal presentation state — lens/instrument rail choice, camera/layout preferences, material-scene arrangement, per-viewer localStorage. These stay on whichever side made them and survive mode switches by not travelling.
- **Types as enforcement:** `HostedAppMode` (already `"expressions" | "techne"`, hostedApp.ts:465) moves here as the boundary's mode type; the shell's `WorkspaceMode` narrows to it via one checked join (`postHostMode`), so the two enums can no longer drift silently. `DEEP_INSTRUMENT_IDS` (the six plain names) becomes the one vocabulary here — the vendored app's inline `['project','canvas','timeline','journey','place','palace']` (app.ts:940) and `instruments.ts`'s list both cite it instead of re-inlining it.
- **The stated law in one line:** the deep mode changes disclosure and available operation; subject identity and native Action ownership are preserved (L5 §11a, mirrored as the module's header).

This formalises what `techneSummonRecord.ts` + `fieldOpen.ts` already enforce piecemeal; their logic can move under this roof (or re-export from it) so the next entry point negotiates one contract, not three guards.

### P2 — Make the tree carry the two-mode law (a, M)

Rehome `src/techne/`'s four roles into legible places (git mv + import fixes; no behaviour change):

```text
src/techne/
  boundary.ts            the mode contract (P1)
  centre/                TechneCentre, techneReading, wikiReadingProvider,
                         sceneConstellationRelation, facet readers — the mode's mount side
  wiki-projection/       wikiProjectionStore, wikiNativeExpression, wikiExpression —
                         the techne→Expressions-body bindings (kernel refs in, refs out)
  bodies/                WikiMapNavigator, MaterialNavigator — the mode's left bodies
  instruments/           project/ canvas/ timeline/ journey/ places/ palace/ —
                         one directory per instrument, the pure models (ex m0m5/*)
```

Each `instruments/<name>/` directory is the instrument's ONE cradle-side seam, and its internal shape states the three-body pattern:

- `model/` — the pure cradle model (today under `m0m5/<name>/`), testable by `node --test`, no React, no store;
- `surface` — a documented POINTER to the vendored body the model feeds (`researchInstruments.tsx`'s CanvasView / TimelineSurface / PsychogeographicMap, `palaceInstrument.tsx`, the Expression/Scene controls for journey), never a second implementation;
- `mount` — how the host activates it: the `lens` host-command + the readings it consumes through the centre.

Rule stated once in `instruments/README` (or the boundary module's header): **an instrument has exactly one model (here), one surface (in the vendored app), one mount (the boundary)**. A third body is a bug, not an option.

The `expressions/` vs `expression/` split gets named, not merged: a one-line header cross-reference on each directory's index (or rename in phase 4 alongside P6) — `expression/` = the kernel-document authoring layer shared by composer and centre; `expressions/` = the Expressions mode region (host, stores, navigator).

### P3 — Retire the orphaned arrangement; keep its true parts (c + a, S)

The live path never reads the cradle-side rail, so:

- **Retire:** `techne/instrumentRail.ts`, `techne/MaterialDepth.tsx`, `techne/lenses.tsx`, `techne/session.ts` (~600 lines, zero consumers, verified §3). If a future cradle-side rail is wanted, it is rebuilt against the boundary contract — but the rail's honest home today is the vendored app's rail, which already renders in both modes.
- **Keep and rehome:** `m0m5/adapter.ts`'s receipt/route validation — the Action-routing law is right and will be needed the day instruments disclose Actions cradle-side; it folds into `boundary.ts` or `centre/`. `instruments.ts`'s plain-name vocabulary folds into `boundary.ts` (P1) and the rest of the file retires with the rail.
- `techne/wikiRelationMetadata.ts` (zero consumers) retires unless lane 2 claims it — check TARGET-SETs before deletion.

Effort sense: deletions are S; each is safe because consumer analysis is part of this survey and any surprise fails a `tsc` pass.

### P4 — Wire the models where the lanes land (existing phase work, L but already funded)

The five lanes' landing seams survive as-is — this proposal invalidates none of them:

- **lane 1 (canvas/graph):** vendored `researchInstruments.tsx` CanvasView + `src/knowledge/` graph — untouched by P1–P3.
- **lane 2 (timeline):** `techne/contract.ts` facets (`TechneTemporalFacet`, contract.ts:205–222) + vendored TimelineSurface — `contract.ts` does not move; only its consumers' paths stabilise.
- **lane 4 (places):** binds `m0m5/place/filter.ts` (`TimeWindow` :22–28, `coversWindow` :121–123) — the ONE coordination point: at rehome, `place/filter.ts` moves to `instruments/places/model/filter.ts`. Do the rehome with a one-line re-export stub at the old path, delete the stub when lane 4's seam lands, or land the rehome before lane 4's first code change. `contract.ts` and the vendored map (maplibre, `vendor/research-canvas/packages/canvas/src/psychogeographic/renderer.ts`) do not move.
- **lane 5 (journey/palace):** lands on the vendored instruments; the orphaned journey models are exactly the pure-model half its targets need — P2 gives them their wired home. Its FINDINGS' dead-module list (presence/sequence/vak/agent/proving-reading) is confirmed and now explained: unwired models, not failures.
- **lane 3 (expressions editor):** Expressions-side; orthogonal to every move here.

What each lane gains: models that are importable from a directory that names the instrument, one contract to satisfy (P1), and no dead twin to wonder about.

### P5 — Say the body/mode relation in `mode.ts` (b, S)

`MODE_CURATION.expressions` and `.techne` should state their relation structurally, not just in the techne hint's poetry. Minimal form: a shared field, e.g. `hostKind: "expressions-app"` on both curations (both centres mount the same vendored application — descriptor.tsx:11–16), plus one line: techne is the same application in the deep cut; the curation differs in left body and disclosed instruments, never in document or stage. If phase 4 wants more, the centre kinds could merge to one kind with a mode parameter — but that churns the surface registry and layout persistence for no behavioural gain, so it is NOT recommended now.

### P6 — Naming harmonisation in code (a, S, phase 4)

Per the owner's ruling (2026-10-07): directory `m0m5/` → `instruments/<plain-name>/` (P2 does this); `mPrime` field out of `instruments.ts` (retires with P3); "M0′–M5′" comments updated at harmonisation. `HostedAppMode` already uses plain mode names — it survives unchanged. Rename `lensStudio`'s cradle-side echo: nothing cradle-side is named lens after P3 retires `techne/lens*.tsx`, leaving `workspace/lens.ts` (Epi-Logos world) and the vendored `lensStudio.ts` as the only two, in different trees with different jobs — acceptable; a comment on each disambiguates.

### P7 — Where the Live fork changes the answer (note; D-G ruled)

Lane 6 SCOPE rev 2, D-G (owner-ruled 2026-10-07): the live Expressions application REMAINS the M4 body, genuinely integrated into the Live fork; the deep mode and source ground stay cradle-side, coupling via the kernel bus (D-E, SCOPE §4). Consequences for this structure:

- The **boundary module (P1) is the portable artefact**. A Live-side host implements the same contract — refs in, `oi-app-state`-shaped readings out, mode cuts, Actions routed — so write P1 shell-agnostic (no Tauri types in it; the kernel transport is already an interface).
- `PointCloudHost` is already a general-purpose mount (`followsOwnRef`, `entryInstrument`, Factory Live use) — its hosting law (one build, one route, handshake) is exactly what a Live device-panel-grade host must re-implement; nothing in P1–P6 presumes the Tauri shell around the frame.
- The instruments stay cradle-side per D-E — so P2's `instruments/` home and the vendored surfaces remain the single home of the deep mode even after Live exists. No Live-native instrument surfaces (SCOPE §4's failure mode).
- The two-clock doctrine (SCOPE §5) lands on lane 2's time model — one more reason `contract.ts`'s temporal facets are the stable seam and must not move.

### Phasing

1. **Now (S):** P3 deletions + P1 boundary module skeleton (extract, don't redesign) — before lanes 2/4/5 land code, so their seams cite the new homes.
2. **With the lanes (funded):** P2 rehome, stubs at old paths; P4 per-lane wiring.
3. **Phase 4 harmonisation (S, mechanical):** P5 curation field, P6 comment/naming sweep.
4. **Live-fork track:** P1 hardens into the shell-agnostic contract; everything else holds.

## 7. Evidence register, confidence, limitations

**Directly read (file:line claims above):** main.tsx, Cradle.tsx, Rest.tsx, CradleFrame.tsx (excerpted via grep, mode regions :32–982), workspace/mode.ts (full), workspace/modeBodies.tsx (full), surface/registry.ts (full), surface/techneSummonRecord.ts (full), techne/TechneCentre.tsx (full), techne/instruments.ts (full), techne/instrumentRail.ts (full), techne/contract.ts (head + consumer graph), techne/m0m5/adapter.ts (head), techne/techneReading.ts (head), techne/lens.ts (head), techne/material.ts (head), expressions/PointCloudHost.tsx (:1–120), expressions/hostedApp.ts (grep-verified regions :13–540), expressions/selection.ts (head), expressions/fieldOpen.ts (head), expression/useExpressionApplication.ts (head), instrument/nara-expression-adapter.ts (head), kernel/bridge.ts (head), contributions/core/descriptor.tsx (:1–20), expressions-app/README.md (full), expressions-app/field-studies-journeys/src/app.ts (:860–945 + grep), researchInstruments.tsx (grep :7–665), lensStudio presence (grep). Consumer analysis: grep-based import graph over `desktop/cradle/src` (all files), plus explicit absence checks for each named-dead module.

**Lane claims verified (sample, not all):** lane 1's instrumentRail-zero-consumers (reproduced exactly); lane 5's journey-submodule no-consumers (reproduced, extended to the whole m0m5 tree); lane 2's researchInstruments mount (verified at :631/:665); lane 4's maplibre surface (verified at vendor/research-canvas/packages/canvas/src/psychogeographic/renderer.ts) and m0m5/place/filter.ts interface point (verified as currently-unwired but named in their TARGET-SET).

**Unverified / limitations:**

- CradleFrame.tsx was read by targeted grep, not line-by-line — the `enterMode`/stageCentres/`centreBindingOf` descriptions rest on the mode regions quoted plus techneSummonRecord's independent description; a full read could refine details of concealed-host mounting.
- Vendored `lensStudio.ts` internals were not read; the claim "the live rail is the vendored app's" rests on app.ts's `renderRail`/`activateInstrument`/`lensStudio.select` call sites and the mode class toggle.
- The `instrument/` (FocusedInstrument/K8 Nara) consumer graph was not exhaustively walked; its role here is stated from the adapter header and its imports only.
- Runtime behaviour (what actually renders in the techne mode today) was not executed — absence of static imports is the evidence; a dynamic-`import()` sweep was completed and found no external dynamic loads of the named-dead modules (the only `import(` hits are type-position annotations inside the dead files themselves).
- `wikiProjectionStore` internals were read only through its consumers' usage; its full request/selection shape deserves a dedicated read before anyone refactors it.
- The proposal's effort senses are estimates, not executed migrations; the m0m5 rehome coordination with lane 4 is a recommendation to be settled at convergence, not an agreed plan.
