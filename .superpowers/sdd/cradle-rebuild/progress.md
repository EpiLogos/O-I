# Cradle rebuild — execution ledger

Branch `cradle-rebuild` · map of record `docs/OI-DESKTOP-CRADLE-REBUILD-WAYFINDER.md`
([OI-CRADLE-REBUILD-WF], issue #190). One row per unit: what is real, what was
walked, what remains. Rulings are ledgered, never re-asked.

| unit | relation | status | what is real | what was walked | what remains |
|---|---|---|---|---|---|
| branch bootstrap | — | done 2026-09-05 | `cradle-rebuild` off `main`; map + `skills/cradle-execution/` carried (e528715 on main, branch inherits); this ledger created as first act on the branch (931c7a4) | `scripts/cradle-context-check.sh` → "context chain intact" | — |
| U0.1 ai-kit substrate | S→S2 | closed 2026-09-05 (owner re-aim) | ai-kit main (e300ed0) is the full shape; D11 port premise aged out (codex/full-shape deleted post-port; modules live as composition.rs/profile.rs/actor_composition.rs). `aikit compose` restored on main + installed; binaries rebuilt from HEAD | `aikit compose --json` in /Users/admin/Central/Work/O-I: ok, plan `aikit.actor-bootstrap/v2`, composition_error null, model/harness honestly unset. Workspace tests all green except 1 env-sensitive TUI test (mux_install timeout, spawns a terminal) | (a) OWNER-AUTHORING, not code: `agent/epilogos/oi-development` exists only in AIKit store ground; `ctrl action run agent-profile.list {scope:personal}` → profiles:[] — the owner authors the Central AgentProfile. (b) Contract change: compose no longer takes `--profile`; the profile is derived through Central and disclosed in the plan's agent field; never fabricated |
| U0.2 Central source-ref canonicalisation | S→S0 | done 2026-09-05 | Central a233c24: ground derives the horizon ref `central:source:project:{id}:{escaped-path}`; persisted relations re-derived from path on read (retired path-hash grammar never disclosed); ctrl reinstalled | Walk on real O-I ground: 3 inspect-disclosed refs byte-identical to refs `projectcentral.source.read` accepts; CAS read/write round-trip on all 3 (changed:false on identical content); ctrl tests 260 green | Desktop surfaces consume this one grammar (D12) |
| U0.3 Fresh cradle shell | S | done 2026-09-05 | `desktop/cradle/` fresh Vite+React+TS+Tauri 2 app (cc92fd2): rest = agency-field column (honest absence, zero children) + canvas (textarea, caret, `To:` affordance); thin src-tauri (window setup only); versions mirrored from desktop/ui | Orchestrator re-ran walk: 12/12 checks pass, DOM census exactly 6 nodes, cold start FCP 88 ms (< 3 s), zero raw colours (0 hits; 28 `var(--oi-*)` uses), screenshot walk/u0.3-rest.png viewed — austere rest confirmed; native binary launches (pixel capture unavailable in sandbox, honestly disclosed) | kernel seams (U0.4), walk harness (U0.6), ui removal (U0.7) |
| U0.3b Surface management | S (frame mode, law 12/D16) | done 2026-09-05 | `desktop/cradle/src/surface/` (0705799): typed SurfaceBinding + pane-tree engine (open/close/reopen/split/tile/move/pin/restore, pure serialisable ops), persisted layout, one Action executor shared by keyboard+pointer+menu (parity by construction), D15 context menus (no disclosed Actions → no menu), D17 agency depths with full as true overlay | Orchestrator re-ran: 41/41 checks keyboard+pointer, reload restores exactly, close-all returns to the 6-node rest shape, u0.3 rest walk still green, 0 raw colours, screenshots u0.3b-tiled/u0.3b-menu viewed — menu shows exactly the 4 frame actions | U0.4 kernel seam (events/focus), owner kinds replace test bindings, D19 workspaces subsume layout (U1.5) |

| layer repair (orchestrator) | oi+ai-kit | done 2026-09-05 | oi: live drift teeth (annotate_live_drift: git HEAD vs frozen registration, executable-predates-HEAD, sha256-compared PATH shadows) wired into `oi doctor` (FAILs, exit 3) — walked: all six products' frozen-at-registration records exposed vs live HEAD (0d3c4aa, on cradle-rebuild); ai-kit: ActorBootstrap discloses harness/model candidates + compose composition_notes name the closing surface per absence (7a05c31, ai-kit main) | `oi doctor` exit 3 with per-product drift findings; `aikit compose --json` shows notes + empty candidate lists (honest) | detection→candidates join is open: no Harness-kind resources exist in any catalogue while client status detects claude/codex installed — identity-ownership decision (Actuation receipt / aikit client registry), not invented in this fix |
| U0.4 Kernel seam re-proof | S; S→S0 (writes) | done 2026-09-05 | `desktop/cradle/kernel/` (e0118ad): events.rs+focus.rs ported KEEP-RE-EARN; flow.rs CAS core — every write through `projectcentral.source.write` with canonical U0.2 refs, desktop never writes fs nor mints refs; two layers (cradle buffer vs Central canonical); structured `revision-conflict` failures preserving both sides; world.rs reading core; dev-only walk-bridge fronts the same KernelOp seam (D10) | Orchestrator re-ran: cargo 25 green, build green, 30/30 walk vs real ctrl/O-I horizon — save advances revision (…0aed→…90b9), forced external edit → exactly one conflict event (expected …90b9 ≠ current …e431), buffer intact, re-read rebase then save succeeds, focus event carries the same ref, log strictly monotonic 1..14; screenshot u0.4-conflict.png viewed | native-window walk (with U0.5/U0.6); three-way merge + history rows (U1.3); focus to many surfaces (U1.4) |
| U0.5 Design-system extraction | S | done 2026-09-05 | packages/oi-design-system (2334a63): +18 tokens sourced verbatim from site/src (typography stacks, radii, z-layers, focus-ring, world host hooks) → 49 unique --oi-*; gold-scarcity enforced; brand SVGs exported; README documents consume-only law; 2 inlined cradle values moved onto tokens | Orchestrator re-ran: verify 16/16 (all 9 #25 sections non-empty, cradle 0 raw colours, all var refs resolve), site build green (untouched), cradle build green, u0.3 walk re-passed with byte-identical rest screenshot | site→package import migration (incremental, future); primitives extraction (belongs to verticals, law 11); body font-family application = owner visual call |
| U0.6 Walk harness | S | done 2026-09-05 | `desktop/cradle/walk/` (aa98828 + race fix 8e0358a): typed `__cradle.walk` channel bound to the live KernelOp seam inside KernelProvider (no second authority path); build-gated mount absent from production bundles (grep-proof: 0 `__cradle` in dist); scenarios rest/surfaces/kernel-cas replace the ad-hoc scripts; receipts as committed JSON + screenshots | Orchestrator re-ran `run.mjs all` — caught a load race (scenario's first op beating the dynamic-import mount → swallowed 0/0 receipt); fixed (dispatch polls for mount, 10s ceiling) and proven: 3× consecutive all-green 13/13, 44/44, 40/40 with §8 metrics as data (FCP 24–28ms, open-4 27–37ms, reload-restore 24–33ms); kernel-cas re-read+save driven as typed channel invokes; renderer-active-tab-unmoved check proves no-renderer-authority as data | native-window pixel walk (noted since U0.3); verticals add their §8 rows as scenarios here |
| U0.7 Disposition audit | S | done 2026-09-05 | Legacy line physically removed: `desktop/{ui,src-tauri,fixtures,core}` gone (138 files, 35,981 lines; core crate removed whole — all 25 modules dispositioned in `.superpowers/sdd/cradle-rebuild/disposition.md`). Verdicts: events/focus/world/flow/central_change RE-DERIVED-IN-KERNEL (U0.4 receipt); agent_surface, shell, bridge, contribution, living_*, flow_contemplate, central_agent_profile, local_factory, live_product, native_application, product_command, execution_authority, lib.rs REMOVED; aikit_workbench + local_aikit HARVESTED-TO-NONE (examined; owner-client envelope already re-derived as kernel CentralClient; SessionSpace glue replaced by D4/law 4); project_field + project_knowledge HARVEST→RE-EARN recorded for U1.1/U3.x. SURVIVES: none — no design-set section names a legacy module for the cradle. Wiring cleaned: .gitignore, desktop.yml (rebuilt around cradle), prelocal-release.yml (cradle bundle), W7/W8 workflows (O:I-side legacy steps dropped, owner pins kept), cli `oi app` → cradle/src-tauri, dev_world fixture paths, desktop/README rewritten | Post-removal: cradle `npm run build` green; `cargo check` kernel + src-tauri green; kernel `cargo test` 25 green; cli suite 90 passed 0 failed; `node walk/run.mjs all` 3× consecutive all-green (13/13 + 44/44 + 40/40 each run, no 0/0 receipt — race fix holds); `git grep desktop/ui|desktop/core` → only historical/port-provenance mentions (kernel port headers, W7/W8 removal notes, suite records); `scripts/cradle-context-check.sh` intact | P0 gate: owner walks the cradle; P1 units (U1.1 navigator re-points rooted-World, U1.2/U1.3 editor+conflict, U1.4 focus fan-out, U1.5 workspaces) |

## Ruling log

- 2026-09-05 (owner ruling, orchestrator-executed) — **P0 gate + git discipline repair.** Owner walked the P0 state and directed: work genuinely into main; root-cause the branch/worktree hell; sharpen map+skill. Executed: `cradle-rebuild` merged `--no-ff` to main (08f6ea9), phase branch deleted; main pushed to origin (was 53 ahead); fully-merged remote branches deleted (unmerged left for owner triage); ai-kit stray worktree `worktree-agent-aa03397ba3da0301e` removed (tip fully contained in ai-kit main) + branch deleted; ai-kit main (was 24 ahead) and Central main (was 14 ahead) pushed. Map amended: §1 law 13 (git discipline), §9 process-skill exclusivity, §10 generalised to the phase loop. Skill amended: Step 0.5 git ground check. `cradle-context-check.sh` extended with law-13 checks (branch, stray worktrees, CRADLE_ALLOW_MAIN for gate work). Root causes ledgered: (a) no merge-retire loop — merged remote branches never deleted, mains never pushed, so parallel sessions built against stale ground; (b) superpowers skillset inherited machine-wide (~/.agents/ → every harness home) carrying its own execution semantics incl. `using-git-worktrees` and the sdd loop — archived out of the inherited path (reversible by moving back); (c) nothing guarded main — two contamination incidents this phase (4617e7a; a U0.4 implementer commit landing on main before repair). The `.superpowers/sdd/` ledger path is legacy addressing; content is the cradle loop's.
- 2026-09-05 (orchestrator): a parallel paused session fast-forwarded `main` to the in-flight line (4617e7a "wip paused"), contaminating main with wip contrary to map §0 "execution lives on cradle-rebuild". Restored `main` to e528715 (its pre-incident tip; reversible via reflog; nothing pushed). Branch `cradle-rebuild` keeps the full line incl. 4617e7a + e0118ad.

- 2026-09-05 (owner, in-session) — three rulings: (1) **System region built** as U1.6 (APP-SPEC §10 + §17.9 is its contract; answers the N8 flagged no-home gap; Workcell lives behind-the-scenes per APP-SPEC §9.5 — inspectable, never a dashboard); (2) **Pi designated the agent-harness ACP passthrough for main testing** (U2.1's claude-first line now reads: claude/codex adapters prove the seam, Pi is the main-test passthrough); (3) **GPT Astra engaged as an external implementer working the map's units under the cradle-execution laws** — the enforced loop (brief/build/walk/review/receipt), design-set precedence, walk-as-acceptance, and law 13 git discipline bind Astra exactly as they bind any implementer. Astra's computer-use capability is a walk asset: it can drive the real app UI as functional acceptance.
- 2026-09-05 (coordinating fact) — Central main carries a red 4-commit unpushed stack and ai-kit is mid-restructure under the owner's live sessions; builders consume product state as pinned in suite/mainline.json (or remote mains), never unpushed local stacks.

| P1 bootstrap | S→S0 | in progress 2026-09-05 | cradle-p1 cut from main c80e2aa; user released O:I checkout and selected productName O-I; design map and execution skill inherited unchanged; Central pin 832f2e5 | pre-change suite 97/97 green; context chain intact | native packaging repair; U1.1 navigator |

| U1.1 Rooted-World navigator + native packaging repair | S→S0 | done 2026-09-06 | Cmd+B / Agency-field context menu summons Central’s real World map; filter + project selection + ProjectCentral ground + distinct root/project Wiki refs and federation; kernel-owned selection/focus/events; no path-minted semantic refs. productName O-I; native hooks corrected; owner reads run off the native UI thread. Consumes Central 832f2e5 compiled from a detached source archive; live product checkouts untouched | `node walk/run.mjs all` with pinned ctrl: **123/123** (97 baseline + 22 navigator + 4 native); World summon 817 ms; 12 actual Work projects match owner order; unbound projects remain unbound; unavailable transport has no fabricated rows; ordered events. Native computer-use on rebuilt O-I.app: writing → pointer World → close → typing continues without corrective click; keyboard filter/select O-I; project + root wiki expanded. Screenshots/AX/native receipt in `desktop/cradle/walk/artifacts/navigator-native*`. Native bundle and production walk-channel exclusion verified. Kernel tests 25/25 before final focus-only fix | U1.2 editor: navigate real sources across projects, preserve project context on writes, 10-file timing proof; U1.3 conflict/history. Formal owner ref spellings are preserved exactly (current horizon returns project:project:o-i), never rewritten to design-example identities |

| U1.2 Editor surface | S→S0 | done 2026-09-06 | World opens actual owner-disclosed sources. Each kernel buffer retains its original project route; dirty documents remain separate across tabs; closed sources reopen by the same ref. Initial canvas writing survives source navigation. Save/refusal state is scoped to the source; rapid edit/save cannot be skipped or overwritten by delayed clean readings. Replaced mock-shell CAS tests with actual Central integration tests | Full suite **155/155** (123 prior + 32 editor), kernel **25/25**. Ten actual documents open in 62–83 ms each. Save advances owner revision, source ref remains stable; switching projects cannot redirect the write; real exclusion refuses without modifying bytes or losing dirty writing. Native computer-use: open O-I learning README, edit + immediate Cmd+S, observe new clean revision, restore original through UI + owner byte comparison, close to retained writing, reopen same source. `editor-native*` screenshots/AX/JSON hold evidence. Design review: APP-SPEC §5 source ownership; cradle/02 §§6–7 distinct layers and refs; map §5 U1.2 timing/ref/revision acceptance. No design documents changed | U1.3 conflict + history; draft persistence belongs to U1.5. Product checkouts remain untouched; pinned Central 832f2e5 consumed from archive |

| U1.3 Conflict + history | S→S0 | implemented and walked 2026-09-06; further work superseded by owner spatial priority | History reads Central’s durable source-change horizon, scoped by exact source ref and current retrieval permission. Conflict retains both sides; explicit reread rebases; history refreshes on conflict and save. No desktop history store | Full suite **172/172**, kernel **26/26**. Actual second owner writer, failed CAS, explicit reconciliation, one history row per changed save, none per failed/no-op, fresh kernel retains owner history. Native O-I.app on temporary real Central ground: external file write, exact both-side conflict, explicit merge/reread/save, two attributed/unattributed history rows. Screenshots/AX and history-native.json. Temporary ground removed; no design source edited | Owner rejected advancing features on the incomplete spatial foundation. Prioritize D16–D19, APP-SPEC §3, U1.4/U1.5; history presentation remains subject to shell integration |

- 2026-09-06 (owner, in-session): repeated three-panel desktop/harness foundation is the priority. “Quiet writing first” must not steer implementation into a notes app. Build deep spatial and workspace setup and semantics before filling regions. Existing test workbench is not an acceptable product shell. This supersedes sequential feature expansion until the shell foundation is structurally complete; preserve native product business logic and do not alter design documents.

| Spatial UI study | S · D9/D16–D21 | interactive mock, 2026-09-06; not a business-unit completion | Owner explicitly deferred business logic for UI mocking. Separate `?study` entry: grey-green paper wiki, root/project/shared scopes, hierarchical navigator, contextual agency, split source, full panel return, freeform named local workspaces, selected-Flow handoff preview, search, provenance and six-product System. Sample world/agency explicitly labelled; no product writes or execution | Study walk **19/19** browser interaction checks; production TypeScript/Vite build passes. Visible computer-use: three-region graph; pointer selection and source beside graph; full agency/Escape; selected-text handoff into conversation; shared projection Inspect. Fixed the graph hit target from that walk. `ui-study-2026-09-06.md` maps actual details and limits; `walk/artifacts/study*` contains receipts | The live-shell experiment remains unfinished with red regressions; no whole-suite green claim. Study does not yet restore all D19 session/split/depth state or connect real wiki/agent/SpaceTimeDB logic. Another session advanced the branch to 5e6f79b during this work; no commit/push/merge attempted over concurrent work. Design documents and product pins untouched |

| Companion UI studies + integration recovery | S · D16–D21 | review-ready interactive mocks, 2026-09-06 | Owner-directed Central naming; one sidebar with per-project chats/tasks, files and wiki controls; canvas chat access; thin contextual tab bars; single/columns/rows/studio/grid arrangements, pointer tab move, menu move/split/pin/close, keyboard divider resize, reversible full chat and per-workspace/project sidebar modes. Distinct Shared Field glyph and admitted subset. Original study retained. No owner execution or writes | Companion browser walk **29/29** plus original **19/19**. Visible computer-use: project files while chat remains; full chat from tiled group with draft; Escape restore; same encounter moved between groups with retained draft; contextual menu and screenshots captured. Two requested agents produced an integration map covering all 166 capability IDs and a subsequent independent harmonization audit. Audit findings corrected workspace/pane reveal, Research encounter reuse and System owner labels. NEXT-SESSION-HANDOFF.md consolidates exact state contract and limits | Review resting/default shape, project/workspace trigger, canonical side/full/tab binding, local/shared boundaries and focus restoration before final programme handoff. Native detach, owner menus, complete per-Surface/per-workspace geometry, integration of all owner capabilities remain work. Current suite pin drift discovered and exact f66794a ctrl built from archive for final full-suite check; no active product checkout touched. No design edits or git publication |

- Companion round final complete suite, current pinned Central f66794a from archive: **companions 29/29 + original study 19/19 + native packaging 4/4 pass**. Seven existing live-shell scenarios remain red (rest, surfaces, kernel-cas, navigator, editor, history, spatial). Final log `/tmp/oi-companions-final.log`; no concurrent build during final verification. This is review-ready UI evidence, not product acceptance. All companion changes and reports left local; active-session git work preserved.

| Shared point-cloud language + bootstrap execution refinement | Owner follow-up · 2026-09-06 | Shared package implemented; native bootstrap integration pending | Opt-in desktop tokens, exact braced mark mask at 480px responsive width, dense 0.45px dot cores / 2px pitch with antialias edge for 1×; reusable three-population cluster motion beyond the logo; truthful loading DOM primitive, reduced-motion and forced-colour fallbacks. Bootstrap contract covers BOOT-00–14 with owners/exits and acceptance slices. Programme fixes early bootstrap/contribution plumbing, knowledge before generated knowledge, session identity before stream, and local graph before optional Field infrastructure. Older prompts visibly superseded | Real Chromium package checks **10/10**; visible in-app browser loading reference and overlay inspected, including narrow display. Desktop screenshot exposed invisible subpixel dots at 1×; corrected edge and visually rechecked. Package token verification retains its one pre-existing failure: raw colours in UI study styles. No claim of native bootstrap completion or full app green | BUILD-O-I-NEXT.md links current language/bootstrap contracts. Implementing session must wire package primitives to actual native states and execute the BOOT acceptance cases. Active app source/build/git left to concurrent developer; no commit/push performed |


| Rolling development — Central consumer gate | S→S0 | bounded gate passed 2026-09-06; slice 0 remains open for other consumer seams | `oi dev gate central [--candidate SHA]` fetches named origin/main or exports an exact committed candidate without changing the owner checkout. Native descriptor builds into a unique artifact directory; native tests and a captured actual Cradle kernel consumer run against its explicit ctrl path. Cargo/JS locks and consumer source hashes, executable SHA-256, success/failure logs and Suite Snapshot are recorded automatically. Descriptor pins no longer cap current-main install readiness; dev status distinguishes observed origin/main from historical descriptor evidence | Current Central 616749373a60f55e9fd99e4f2b0bebf2c73a674b: native build/test and Cradle kernel pass. Artifact `8bab929aa46d8ecf935a8bee50597eaf8304e0aa8af05247484c78534b09dd01`; receipt `/Users/admin/Library/Application Support/OI/receipts/dev/central-616749373a60-1788689489188-75287/receipt.json`. CLI suite green; four real Git/filesystem/process tests cover dirty checkout preservation, exact candidate export, pin-ceiling removal, captured consumer bytes and failed command evidence. Pre-change full app walk reproduces seven red live scenarios; study 19/19, companions 29/29, packaging 4/4 pass. Native existing O-I.app inspected by computer use | Gate is deliberately bounded to Central→Cradle kernel; full spatial/native-window/wiki/search acceptance and other affected-consumer gates remain open. Installed providers were not replaced. Known-good artifact directories and release snapshots retained. Native desktop baseline still needs its first spatial slice gate |

### 2026-09-06 — source baseline repaired; companion frame replacement underway (not spatial acceptance)

Owner direction reaffirmed: the `?study=chat` / `?study=tiled` companion shape is the implementation target. The earlier live shell is not an accepted visual foundation. This increment replaces its permanent inspector rail, moves workspace selection into the compact Central sidebar, nests real participating source rows under their project, puts ground/identity disclosure behind an explicit details control, and uses thin pane-local strips plus an operative split/tile/window-action bar. Preserved saved arrangements remain user presentation requests; new workspaces begin with the inspector closed. No sample task, transcript, graph or search state is admitted as native behaviour.

Source safety repair retained: browsing Central/project readings does not replace semantic focus or dirty source buffers; CAS still uses the source's original owner route; layout focus reanchors an orphaned/other-pane caret while external controls keep focus. Editor/CAS/conflict/history tests use isolated real Central ground. Obsolete six-node rest and synthetic surface expectations were replaced with real source and desktop behaviour. Ground evidence is still reachable and verified after moving it out of the primary navigation.

Verification: `node walk/run.mjs all` passed **228/228** (rest 12, surfaces 28, kernel CAS 40, navigator 22, editor 32, history 17, spatial 25, companions 29, original study 19, native packaging 4). Current log `/tmp/oi-implementation-20260906/companion-pane-verified.log`. Kernel tests separately passed 27/27 against Central `616749373a60f55e9fd99e4f2b0bebf2c73a674b`. Native bundle `desktop/cradle/src-tauri/target/debug/bundle/macos/O-I.app` reopened through its executable with explicit `OI_CENTRAL_CTRL_BIN` from the rolling-dev receipt `central-616749373a60-1788689489188-75287`; no installed owner replaced. Native CUA inspection confirmed actual O-I README and learning source panes, restored two-pane layout, collapsed inspector persisting across relaunch, and the real tiling control. Source content was not edited during native visual inspection. Native screenshots are in this execution transcript; walk captures are under `desktop/cradle/walk/artifacts/`.

This is **not** the first spatial milestone complete: project task/files/wiki modes with workspace + ProjectRef presentation state, wiki-centred canvas, summoned owner search, canonical encounter surfaces, native detach/re-dock, and full pane maximize/restore remain. The seven-red live-shell baseline is repaired, but passing those checks does not make these missing features implemented. Continue replacing the presentation with the companion structure; do not reopen U0.1 or settle for the repaired interim shell. The integrated app edits remain on the shared phase checkout with the pre-existing source/workspace changes; they have not been swept into the separate rolling-dev commit.

Native seam discovery for continuation: installed `oi aikit knowledge relations` requires typed addresses (`wiki=REF`, `source=REF`, `project=REF`), not paths. `knowledge search O-I --limit 3 --json` returned no hits with explicit SemanticWiki/ProjectMap provider absences and degraded wiki materialisation; these require owner/composition repair, not a desktop index. `aikit session list` lists terminal/mux topology (two real sessions), so it must not be misrepresented as canonical chat encounters. Inspect the actual encounter owner operation next while continuing independent shell work. AIKit's occupied dirty checkout remains untouched.

### 2026-09-06 — native wiki/search and real window lifecycle; desktop entry replaces automatic writing

Real behaviour: AIKit knowledge Search/Read/Relations/Explain/History/Use now crosses a typed kernel operation, resolved against currently disclosed Central project ground. Successful explicit openings alone record native use; query, display, refresh, failed routes and restore do not. Wiki references are validated by the owner before surface/focus binding. Closing a knowledge view preserves its AIKit attribution. Normal wiki tabs split beside dirty Central sources. The summoned configurable Cmd/Ctrl-K aperture restores focus on Escape; no desktop index/ranking/frecency store was added. The graph renders native relations, with surface-owned camera state; fixed pixel-scale geometry avoids illegible text in narrow panes.

Native detach is an actual Tauri/WebKit window with the existing kernel subject and buffer. Re-dock returns it to the recorded pane/tab position; the macOS close button re-docks without a provider interrupt. Existing detached subjects are focused rather than duplicated. Detached arrangements and dirty drafts survive process relaunch. Maximize masks other panes while preserving mounted views, split widths and left access; pointer and Cmd/Ctrl-Alt-Enter restore the arrangement. Empty workspaces now offer wiki/search entry and explicit writing mode, retaining existing local drafts. The non-operative To/address draft simulation was removed. Historical austere-rest design consequences are handled as this reversible presentation default; canonical documents were not rewritten.

Owner contribution: AIKit's native SemanticWikiProvider now discloses authored WikiSpace membership and child-space edges through its bounded relations operation with revision/authority. Explicit candidate `9bc4aa16e74aa6e9f6f7160604c4d935c8548263` passed full owner workspace/all-target tests and Cradle kernel consumer against real temporary Central ground. Receipt: `/Users/admin/Library/Application Support/OI/receipts/dev/ai-kit-9bc4aa16e74a-1788692850706-14275/receipt.json`. Owner file landed and pushed on AIKit main as `5cbb1e59b4a2acc1060728e376449e5fd3199d8f`; only this session's owner file was committed, preserving concurrent adopt work. A fresh landed build/owner/consumer gate is running at `ai-kit-5cbb1e59b4a2-1788694302514-1431`; its built executable is explicitly bound for the current desktop verification. Installed live providers were not overwritten. Central remains explicitly bound to verified `616749373a60f55e9fd99e4f2b0bebf2c73a674b` artifact. Normal dependency lockfiles retained. Native verification now automatically writes `walk/artifacts/native-composition.json` with executable, frontend and lock hashes plus owner receipt/revision bindings.

Verified preceding camera refinement: full walk **251/251** (`desktop-entry-verified.log`: rest14, surfaces28, kernel-CAS40, navigator22, editor32, knowledge15, history17, spatial31, companions29, study19, native4). Kernel **28/28** additionally verifies wiki close attribution (`wiki-close-owner-tests.log`). Native CUA visual acceptance used Central-initialized isolated ground `oi-cradle-editor-23fVry`, explicit owner artifacts, and a separate WebKit store `947c423843f14fdcb3db2f6a94ddb386`: edit in detached window, re-dock exact unsaved text, save through Central and independently verify bytes on disk, detach/new dirty draft, quit/relaunch/restored detached draft, native red close re-dock, real wiki open/split, maximize and keyboard restore. Screenshots and AX evidence are in the execution transcript. The explicit native data-store builder was necessary because this Tauri version did not forward that config field to WebKit; no real user source was edited during that discovery. Current graph-camera/landed-owner full walk log: `/tmp/oi-implementation-20260906/native-landed-graph-walk.log` (pending at this entry).

Remaining scope is not silently accepted: per-workspace/ProjectRef task/files/wiki navigation and canonical encounters remain; terminal mux sessions are not encounters. AIKit root-wide discovery currently degrades on dangling wiki topology/incidental schema mentions, and its knowledge CLI does not yet admit ordinary Central source files through the native filesystem provider. Both require owner increments, not renderer inference/indexing. Native geometry persistence, complete session/composer movement, Flow/Return, System contribution composition, Factory/material and Shared Field plus the full 166-capability map remain programme work. This is a passing incremental slice, not complete spatial or whole-product acceptance. Shared pre-existing app/study/design-system changes remain unswept; only the independent rolling-dev change and owner contribution have landed so far.

Follow-on evidence in the same implementation session: landed AIKit `5cbb1e59b4a2acc1060728e376449e5fd3199d8f` now has a **passed** complete owner/build/Cradle gate at `/Users/admin/Library/Application Support/OI/receipts/dev/ai-kit-5cbb1e59b4a2-1788694762435-36135/receipt.json`. The first landed gate failed when debug compilation exhausted disk; that failed receipt was retained. Removing only this session's rebuildable debug caches recovered space; history and native checks then passed. O-I CLI gate extension/cache retention landed and pushed as `0b6ecea` with 95/95 CLI tests. No installed provider was replaced. The running native app explicitly uses the new passed-gate AIKit executable.

Graph refinement and window geometry: full walk **254/254** passed in `/tmp/oi-implementation-20260906/window-geometry-walk.log`; subsequent spatial/native checks passed **31/31 + 4/4** after preserving bounds through closed-pane/legacy state and passing them on explicit re-detach. Native CUA confirmed Central's real root-to-project child-space relation, readable graph labels in a narrow split, new empty workspace → real Central wiki, and a single Escape dismissing search after typing (disabled macOS text correction for search). The detached Central wiki was resized with macOS Window → Move & Resize → Left, then the process quit and relaunched: the same native wiki returned at its resized dimensions. Its normal-window bounds are workspace presentation requests, validated and rejected as a position if their title area is outside actual monitors; maximized/fullscreen dimensions do not replace normal bounds. Screenshots/AX are in this execution transcript. Automatic native composition is regenerated at the native gate; compiler caches may be discarded while source/artifact/receipt remain.

Current continuation work: cross-project surface focus now reveals that surface's native project without replacing open work. Root graph project wiki opens match Central's declared wiki space refs rather than parsing opaque refs or labels. The first all-walk run passed all existing checks and both focus-reveal checks; a new browse assertion sampled before the asynchronous owner read completed. It now waits for that owner-backed browse and asserts the wiki is still visible. Native visual acceptance and final targeted knowledge/kernel/native checks for this reveal increment remain pending. Project tasks/files/wiki mode/expansion/filter/scroll ownership and canonical agency are still open programme obligations; do not treat the source-only sidebar as their completion.

Project-reveal increment verified: kernel **28/28** (`project-reveal-kernel.log`), knowledge **21/21** and native **4/4** (`project-reveal-final-walk.log`). All other current scenarios passed in the preceding all-run, giving **257 current passing checks across that run and the targeted completion**, not a falsely relabelled single all-run. Native CUA reopened the built app with both explicit owner artifacts, re-docked the Central wiki and clicked its actual project graph node: the same workspace retained Central's tab, opened the owner-validated project wiki and revealed Editor's native source neighbourhood in the sidebar. Native composition now records the passed landed AIKit receipt. The task/session CLI reconnaissance found `aikit task` manages filesystem isolation, while `aikit session` manages mux topology; neither may be presented as canonical conversations. The next native agency entry should expose the existing AIKit SessionSpaceApplicationStore/AgentSession attachment/connection contracts, preserving Actuation ownership and runtime vs authored-intent distinction.

## 2026-09-06 — native session contribution and project navigation persistence

AIKit's existing standalone `aikit-session-space` is the canonical SessionSpace application front door. The explored main-CLI alias candidate `45b8d1463479e36c72477ce69d1f4fccfea8529d` was NOT landed; those changes were removed and its evidence retained in `/tmp/oi-implementation-20260906/session-space-alias-not-landed.patch`. O-I now binds and hashes the existing companion explicitly alongside `aikit` (CLI commit `ea60212`, 95/95 native CLI checks). Kernel `AgencyRead` obtains the exact Central manifest ProjectRef, invokes native scoped discovery, rejects unbound/outside-ground queries, and leaves focus and dirty source buffers unchanged. This is a reading seam, not completed live encounter UI.

Concurrent first opening of a real AIKit SQLite database exposed a reproducible owner defect. AIKit now uses its existing bounded ContextLock only across open/WAL/schema setup and applies migrations with an immediate SQLite transaction. Eight concurrent connections across eight fresh databases reproduce the former failure and pass after the fix. Explicit candidate `44d2b9ca236da6a693d7a270b2b02f93cacdcb52` passed the full native owner build/test and captured Cradle consumer gate (`ai-kit-44d2b9ca236d-1788697488800-11799/receipt.json`). Owner commit `70cfaed9c15207ec18afeb27bf9127c3ca3cc579` landed and pushed on AIKit main; fresh landed gate is running (`index-landed-gate.log`). Unrelated native skill edits were preserved.

Workspace now owns project disclosure and file-list scroll keyed by owner ProjectRef. The separate keyboard-accessible disclosure control collapses navigation without replacing panes, changing semantic focus, or losing drafts. Each workspace retains independent project state; restored references are still read through Central. Full current walk: **263/263**, including spatial 37/37 and native packaging 4/4 (`/tmp/oi-implementation-20260906/project-navigation-acceptance-walk.log`). An earlier all-run had one history-refresh timeout; isolated history 17/17 and the subsequent full run passed. Added native history response diagnostics to preserve evidence if it recurs; no weakened assertion or claimed fix.

Native macOS visual acceptance: restarted the real bundle in the existing isolated WK store and real temporary Central ground; collapsed Editor in Native desktop acceptance, switched through the native workspace selector to Central, and verified independent expanded Editor, the original two-pane source/wiki arrangement, and exact unsaved source text preserved. CUA screenshot recorded in this task. Native artifact SHA: 80968f913cecbb56f55df693ff5e06e4da63fe6ab5f8aa7a5cccce137426bd32. App currently binds the proved candidate contribution while the landed rebuild completes.

Remaining before complete spatial/canonical agency acceptance: three operative project modes and their state, real provider encounter connection/stream/permission/interrupt/composer continuity, full SessionSpace native mutation/history/reconstruction UI, and remaining programme/audit capabilities. The source-only navigation is not marked complete. App modifications continue to depend on pre-existing shared uncommitted shell/study work; no unrelated files were swept into a phase commit.

### Continuation — canonical Project context integration

Landed initialization owner `70cfaed9c15207ec18afeb27bf9127c3ca3cc579` completed a fresh full owner + captured Cradle kernel gate: `/Users/admin/Library/Application Support/OI/receipts/dev/ai-kit-70cfaed9c152-1788698046926-65750/receipt.json`, passed. The running native app was refreshed to that exact mainline's `aikit` and `aikit-session-space` executables and visually rechecked with the source/wiki split and original unsaved draft retained.

Next slice exposed two native context prerequisites through a real positive test: an ordinary Central project needs the native AIKit Project Specification binding to become a resolver input; and the shared legacy context path was deriving `project:Editor` instead of keeping Central's declared `editor-integration`. No desktop alias or invented context evidence was used. Candidate `cf981bc76ef8c8da2aed8a03bb5e758d9bc377e8` adds the standalone `project-context` read and threads an optional native ProjectBinding through AIKit's shared application context. The existing ProjectCentral filesystem adapter supplies exact native identity and manifest/provider provenance. Invalid present ProjectCentral metadata refuses resolution rather than falling back to a directory-derived identity. Legacy non-Central context behaviour stays available through the existing path.

The Cradle positive integration now uses real ctrl temporary ground, native `aikit project bind`, native SessionSpace create/stage/apply/discover, and its own AIKit home. Unbound membership is excluded; exact applied membership returns; native state survives new CLI processes; browsing does not move source focus or dirty buffers. Current kernel **29/29** passed against candidate cf981 (`session-context-positive-kernel.log`). Candidate full owner gate is still running (`session-context-v3-candidate-gate.log`); full app walk is running (`session-context-app-walk.log`). Earlier candidate ee95 failed because the test did not bind an AIKit Project Specification; b914 failed compilation due to module-qualified type paths. Those receipts remain failed and the corrected cf981 is a separate candidate.

Provider reconnaissance for the next bounded streaming unit: installed Pi at `/Users/admin/.local/bin/pi` uses the native JSONL RPC protocol (`@earendil-works/pi-coding-agent/docs/rpc.md`). An isolated no-session process answered `get_state` successfully, idle and with zero messages (`pi-native-state.json`). This is real provider discovery only, not a proved live chat/permission/interrupt integration. Existing AIKit AgentSessionHost is protocol-neutral and concurrent, but currently exposes ACP/classic adapters; no Pi adapter or desktop transcript has been fabricated. Actuation checkout contains another session's CLI/detection changes, preserved.

### Context connection gate and concurrent mainline integration

Candidate `cf981bc76ef8c8da2aed8a03bb5e758d9bc377e8` passed full AIKit owner build/tests and captured Cradle kernel **29/29**, receipt `ai-kit-cf981bc76ef8-1788699361567-80808/receipt.json`. The coherent current app walk also passed **263/263**, including native packaging (`session-context-app-walk.log`). The nine exact candidate files were committed locally as `54ed782` after blob equality checks. Its main push was rejected because another session advanced remote main to `aa4abc3` (native Control adoption/generation-root work in separate files).

The live AIKit checkout and its unrelated dirty skills were preserved: no pull, reset, worktree or checkout merge. `git merge-tree` composed the disjoint committed trees; explicit integration candidate **9a7402ec401471c9701e5efaecd619297659c489** has parents origin/main aa4abc3 and local context commit 54ed782. Candidate branch `oi-cradle-context-integrated`; metadata `/tmp/oi-implementation-20260906/context-integrated-candidate.json`. Full owner + current captured Cradle gate is running (`context-integrated-candidate-gate.log`). On pass, push the exact candidate fast-forward to remote main; if remote advanced again, repeat isolated tree integration rather than altering the occupied checkout. Local AIKit main remains 54ed782 intentionally until its checkout can be reconciled safely. Refresh O-I's private native contribution to the proved landed artifact, preserving any separately running provider.

## 2026-09-06 — current context contribution landed; detached search parity

Combined AIKit candidate **9a7402ec401471c9701e5efaecd619297659c489** passed full owner build/tests and captured Cradle 29/29, then fast-forwarded remote main from aa4abc3. Exact candidate became the landed commit; no force push or live-checkout merge. Gate artifact `/Users/admin/Library/Application Support/OI/receipts/dev/ai-kit-9a7402ec4014-1788699959371-38909/receipt.json` remains immutable candidate proof for that same landed revision. Native contribution refresh uses its exact `aikit` and `aikit-session-space` release executables. Local AIKit main intentionally remains 54ed782 with unrelated dirty skill edits intact; do not pull/reset it.

Search keyboard matching now uses Command on macOS and Control elsewhere, respects the configured shift modifier, and does not steal macOS Control-K editing. Sidebar/selector labels follow the actual configured shortcut; storage changes synchronize across native windows. Native detached source/wiki windows now host the same summoned aperture. Result routing waits for a main-workspace acknowledgement of the owner-resolved open and focuses the window actually carrying that subject. Refusal remains visible in the aperture; source drafts and owner-use recording remain on their existing native seams.

Full current walk **267/267** (`detached-search-app-walk.log`), including knowledge25 and native4. Fresh native packaging with the landed combined contribution passed4/4 (`context-landed-native-refresh.log`) and automatically updated native-composition.json. Native artifact SHA 572801efaec7a1c85c5c2b510e219090b4fdbc4e895e7cf03ceda8eb9f3eae40. Physical macOS acceptance: detach existing dirty source; Control-K did not summon; Command-K opened the overlay inside that native window; querying editor-walk returned the real native wiki; selecting it focused the existing main-window wiki tab; reopening the source focused the same detached window with exact original draft; Escape restored its editor; CmdShiftD re-docked the unchanged source into its prior split. CUA screenshot in task shows the native detached aperture. Finally relaunched with exact landed 9a7402 executable bindings and confirmed restored source/wiki split and draft.

Next independent bounded unit: actual Pi connection through AIKit's native protocol/SessionSpace host seam, then canonical encounter UI and operative project conversations mode. Pi0.84.4 exposes JSONL RPC and `agent_settled` (not every `agent_end`) marks final settlement. Read the installed source-owned RPC contract before implementing adapter semantics; no ACP masquerade, provider-native id promoted to canonical identity, sample transcript, or inferred permission parity.

## 2026-09-06 — owner correction: ACP, actual Central data, companion fidelity

AIKit native Pi RPC candidate `9b8f4797faaa8a4ce648196d3c13b2acbcbcf6ff` passed full owner build/tests + captured Cradle kernel29 and the explicit live Pi0.84.4 streaming/cancellation/resident-continuation acceptance (`pi-native-acceptance.json`, log). The exact candidate fast-forwarded main. It uses the existing AgentSessionHost, but **is not ACP** and is not a completed desktop agency route. The owner subsequently reaffirmed the generic ACP harness path. The proposed Pi-specific JSONL encounter endpoint and unused desktop transport were parked at `/tmp/oi-implementation-20260906/parked-pi-endpoint`, removed from the live working tree, and never connected/landed. Candidate9332 failed compilation (Ulid v3 uses generate); corrected6d6 built but its owner test compilation and final gate receipt write exhausted disk. Original logs and failure-note.json remain. Its stopped debug cache was removed; no native acceptance/landing is claimed. Do not resume this endpoint direction without reconciling the generic ACP owner operation. Upstream `pi-acp@0.0.33` package was fetched for inspection; no global install or active provider replacement.

Owner UX correction is an execution requirement: workspace = app-wide saved tab/pane arrangement; Central parent and actual Work projects each need compact Conversations/Tasks, Files, Wiki controls. No persistent diagnostic Ground/identity/provenance footer. No project/workspace conflation. Complete filesystem browsing is still missing: current Files list is Central's participating-source horizon, not the full tree; extend Central, do not add renderer filesystem business logic. Existing workspace.project helper still warrants removal/audit although current browsing uses workspace.browse without arrangement activation. Three-mode sidebar, normal canonical chat surfaces, and native filesystem operations remain incomplete.

Visible correction implemented: removed Ground & identity and wiki Source & provenance footer; preserved native owner identity/federation assertions in navigator walk through actual readings. Added functioning Window titlebar menu, companion line glyphs, actual selected binding title in contextual inspection; removed the empty Agent inspector plane. Responsive sizing now reserves only requested panels, so an already collapsed inspector no longer evicts Central at700px. Current pre-change all-walk267/267; correction all-run passed every other scenario but navigator stopped on one obsolete footer locator. Corrected navigator23/23 and spatial39/39 passed (`design-correction-targeted.log`), giving270 current passing checks across the all-run and targeted completion; not yet a single whole-run270 result.

Native development ground is now **/Users/admin/Central**, default installed AIKit home, explicit proved ctrl616749 and aikit/session-space9b8 contributions. Dedicated real-data WK store `b89d6c197c3e4f0a9182578b41e9a603`; native process exec24631. Previous isolated test store947c423843f14fdcb3db2f6a94ddb386 and its exact dirty drafts are preserved, not migrated into user data. Native AX confirms the actual13 Work projects and absence of the removed footer. Opening actual Central wiki refused. Native `aikit knowledge status -C /Users/admin/Central` identifies the reason: generic JSON discovery reaches4096 files, treats a ProjectCentral manifest as wiki material, then fails SemanticWiki rebuild on an unresolved child. This defect was masked by small temporary ground. Next owner fix: load Central-declared canonical wiki sources through the native contract, retain scoped/provenance/partial-failure truth, and verify against actual Central plus isolated adversarial ground. No generated graph or successful-use receipt may cover that refusal.


### 2026-09-06 — real Central wiki and workspace identity correction (continuing)

The companion correction passed one complete **270/270** run (`/tmp/oi-implementation-20260906/design-correction-full-walk.log`). Subsequent workspace identity cleanup passed spatial40, editor32, history17, kernel40 and native4 (`workspace-identity-walk.log`); this is affected coverage after that whole run, not a new whole-suite claim. Browsing projects no longer has an unused helper that mints/activates project-named workspaces. Canvas heading uses the saved arrangement name. Human source breadcrumbs retain revision bindings for real CAS checks while removing the persistent hash display. Native packaging/build passed.

Native O-I was visually inspected through CUA against **/Users/admin/Central**, in a distinct WK data store preserving the earlier isolated test drafts. Central's actual thirteen Work directories are disclosed. The actual O-I ProjectCentral learning README is open and clean; no real authored source was edited. The Central workspace remains Central while O-I is browsed. Ground/identity and provenance footers are absent. This still does not provide the complete filesystem or the three project modes.

The actual root exposed AIKit's generic wiki scan selecting copied fixtures and exhausting its 4096 file bound. Owner candidate `beac7b1e9c2bff321ce660832b961a8bb77c1304` reads wiki declarations from native `central.world`, validates their root-bound canonical paths, then uses the existing SemanticWikiIndex. Candidate predecessor9384's release executable visibly opened the actual Central wiki in the native app (four native spaces and four nodes), alongside the unchanged README tab. It is **candidate visual evidence**, not landed/fully verified evidence. Predecessor9384's gate failed compiling a native test assertion (WikiObject is not Serialize), fixed by testing actual object refs. First beac gate hit disk exhaustion and could not write its normal snapshot; failure-note and logs retained. Only that failed gate's compiler intermediates were removed. Retrying the same explicit candidate with debug symbols/incremental caches disabled preserves tests and lockfiles while bounding disk consumption; active gate `ai-kit-beac7b1e9c2b-1788705277933-57633`.

Pi-specific endpoint remains parked. A real configured Pi ACP acceptance now targets the **existing AcpStableConnectionAdapter and AgentSessionHost** via isolated pi-acp0.0.33 installation and existing native Pi0.84.4. No replacement ACP implementation or desktop transcript store has been added. Live proof is pending; the earlier RPC adapter test must not be called ACP acceptance.


### 2026-09-06 — native ACP proof and companion toolbar correction

**Two complete current runs passed 271/271**: `current-real-data-baseline-walk.log`, then `central-toolbar-full-walk.log` under `/tmp/oi-implementation-20260906/`. The second includes the actual toolbar correction: search and Central wiki share the compact action row above the app-wide workspace selector; the duplicate World close button is removed. The remaining heading/titlebar navigation controls call the same summon/dismiss functions as the keyboard so the original writing caret is restored. This preserves the existing strong navigator focus assertions rather than removing them. Native bundle rebuilt successfully (11.457s on the second run).

**Real ACP acceptance passed** using the existing AIKit `AcpStableConnectionAdapter` + `AgentSessionHost` at owner9b8f479, actual pi-acp0.0.33 and installed Pi0.84.4. Receipt `acp-native-acceptance.json` records binary/test/launcher hashes. The test observed native startup messages before prompting, then verified exact streamed output after dropping the view handle, mid-stream explicit `session/cancel`, observed cancellation, and another exact response on the same canonical/native binding. The first two attempts failed exact-output assertions because the bridge emits startup/upgrade text after session/new; failed receipts/logs remain. The corrected test separates pre-turn native messages from a prompted answer, rather than accepting arbitrary response substrings. Temporary launcher settings and no-tools/no-extensions/no-session flags do not replace the provider. **This is native ACP connectivity proof, not completed desktop chat, Actuation authority, transcript persistence or cross-view acceptance.**

Central wiki candidatebeac full owner build, all-target tests and actual consuming kernel tests passed (`ai-kit-beac7b1e9c2b-1788705277933-57633/receipt.json`). Its explicit actual Central acceptance also passed. The app was relaunched against that verified candidate's exact two executable bindings and actual user Central; the saved Central wiki and clean real README restored through owners. AIKit remote advanced independently tobc7c158; candidate0deb integrated that mainline and also passed its full gate. A final343bd4cd574e03855bb9a4740933e988520859c4 candidate additionally retains native-root detection when root wiki is absent, with a real missing-root declaration regression and bounded ACP startup observation. Its full gate and final native recheck are running; no unverified candidate is marked landed.

The filesystem gap is now precise: `projectcentral.change.horizon` and `projectcentral.source.read/write` only accept participating World sources. They are not a general Central filesystem API. The current Files display must not be claimed as complete `/Work` filesystem passthrough. Extending that owner operation contract (including ordinary/unbound projects, root files, retrieval treatment, identity, CAS/history) remains required before the complete tree and project Files mode can be accepted. No renderer directory scanner or invented source authority was added to mask that gap.


### 2026-09-06 — configured ACP limit and bounded rolling gate

The final native acceptance for candidate **8a1d20097cb2453d86ffc1beab91767f3fd3e70b** passed all three explicit checks: actual Central declaration loading (including missing/corrupt canonical sources and copied fixture contamination), actual Pi ACP streaming/cancellation/resident identity, and the actual AIKit CLI refusing to substitute a copied wiki after the native root wiki is removed. `/tmp/oi-implementation-20260906/final-native-acceptance.json` records exact executable and bridge lock hashes. The full owner/all-target/kernel gate is still running at `ai-kit-8a1d20097cb2-1788706601538-48238`.

The repeated live provider run exposed a real configuration requirement: legitimate reasoning updates can exceed the SDK's default512-signal turn bound before answer text. The native acceptance now uses the **existing configurable HostLimits with 16,384 signals**, interrupts on native content or thinking progress, and still requires observed cancellation plus continued same-session output. This does not remove the bound or weaken exact prompted response checks. First failed native recheck343 and runner-shape failure (absent wiki is null, not an object with availablefalse) are retained in `final-native-first-failure.json` and failed logs. Desktop integration must configure/disclose an adequate bound, preserve the distinction between host failure and provider cancellation, and complete thinking-update presentation; these obligations are not fulfilled by the passing connection test.

O-I bounded rolling-gate repair committed and pushed as **1565e59** on cradle-p1, changing only `cli/src/rolling_dev.rs`. Native candidate builds now default to disabled debug symbols and incremental caches, preserve explicit overrides, and record those non-secret compiler settings in the receipt. Failed compiler caches are discarded before snapshot/receipt writing, while source, lockfiles, owner executable and diagnostic logs remain. The full CLI suite passed95/95 before extracting the cleanup helper; the final six rolling-dev tests passed, including two new real-filesystem retention tests, and the CLI rebuilt. Failed intermediate compile output remains (`rolling-cache-retention-tests.log`, corrected missing qualified serde type). Final results: `rolling-cache-policy-final-tests.log`, `rolling-cache-retention-final-tests.log`, `rolling-cache-policy-build.log`.

Native toolbar was visually inspected after the271/271 run. The running app remains on verified beac artifacts over actual user Central; its current tab arrangement has been left available. The broader spatial/agency phase is still incomplete and has not been merged or represented as complete.

### 2026-09-06 — actual Central filesystem reading, owner gate and native window proof

AIKit **8a1d20097cb2453d86ffc1beab91767f3fd3e70b** completed its owner/all-target/kernel gate, was pushed to native main and registered through `oi register`; the configured real Pi proof uses AIKit's existing generic ACP adapter, not the parked Pi-specific endpoint. Desktop encounter integration remains outstanding.

Central **4106b28b6fee29a489f92848d3023653d46d4828** now exposes `central.files.list/read`. Directory traversal, opaque root-bound path references, retrieval exclusion, bounded UTF-8 reading and native project/source membership belong to Central. No renderer filesystem scanner, adoption or parallel index was added. Owner tests include real unadopted project files, existing authored-source bindings, valid whitespace/Unicode paths, root mismatch, symlink replacement, binary and size refusal. Earlier candidate gates caught exact registry-count and public-documentation omissions; those checks were preserved and corrected. Final gate `central-4106b28b6fee-1788709485128-28202/receipt.json` passed release workspace build, complete native workspace tests and captured Cradle kernel tests. Candidate pushed to native main and registered with its exact exported release executable; live Central checkout and unrelated changes were preserved.

Desktop FileTree now browses actual root/project directories through those operations. Existing authored files open their canonical editable SourceSurface with existing CAS/history; ordinary files have an explicitly read-only native surface, owner-validated restore, refresh, close/reopen and native detach/re-dock. Kernel holds only transient owner-validated file refs; missing locations do not redirect dirty sources. Folder expansion and scroll remain workspace/project presentation. Async loading exposed scroll-restoration and keyboard-return defects; repaired with content-size-aware restoration and canvas-only return-focus capture.

Verification: `full-filesystem-restoration-walk.log` passed the full existing **271/271**, including native packaging. The added actual-owner `files` walk passed **13/13** separately (`native-files-walk.log`, `walk/artifacts/files.json`); it covers actual root bytes, unadopted ordinary project bytes, no implicit adoption/writes, symlink refusal, dirty-source preservation, unchanged pane arrangement on browsing, owner restore, external update and deleted-file last-reading disclosure. No single combined284-check run is claimed yet.

Native CUA visual verification used the rebuilt O-I.app over **/Users/admin/Central**, WK store **b89d6c197c3e4f0a9182578b41e9a603**, with explicit Central4106 and AIKit8a executables from their verified gate directories. Actual O-I directories (cli, desktop, docs, packages, etc.) appeared in the sidebar; opening Work/O-I/README.md displayed the actual repository text, then detached into README.md — O-I and re-docked into the same main arrangement. CUA screenshots in the implementation conversation show both native states. Process session24791 holds this current app; no provider was active or replaced. Existing tabs and authored drafts were retained.

Remaining acceptance is explicit: ordinary-file write/CAS/history, all three compact project modes (Chats/tasks default, Files, Wiki), full companion-shape fidelity, generic ACP encounter/session integration, full owner capability coverage and subsequent programme phases. The read-only filesystem slice is not claimed as complete editing, complete project UX or a completed spatial phase. O-I shared app WIP remains uncommitted pending its complete phase gate; native owner increment is landed.

Combined verification subsequently completed: **284/284** in one `node walk/run.mjs all` run with explicit Central4106 + AIKit8a bindings, including all13 ordinary-files checks and native packaging. Receipt log: `/tmp/oi-implementation-20260906/full-filesystem-combined-walk.log`. This supersedes the separate271+13 qualification above. Native re-dock returned the file to the existing main window; keyboard caret parity after re-dock still warrants a targeted check (immediate AX observation reported the previous wiki tab focused while the file tab was selected).

Next concrete owner integration seam: existing `aikit-session-space` CLI provides durable discovery/stage/apply/reconstruction; it has no resident generic ACP host endpoint yet. The existing `AgentSessionHost` + `AcpStableConnectionAdapter` must supply that owner endpoint rather than desktop-owned provider/process/business state. AIKit live `agent_session_host.rs`, `agent_connection.rs`, `actuation_stream_projection.rs`, and `session_space_connection.rs` now have other dirty work; preserve it and base any explicit candidate on current remote owner revisions without resetting that checkout. Project three-mode rendering must bind actual SessionSpace/encounter rows and retain Central owner ProjectRefs; native labels alone do not fulfil chat/tasks acceptance.


### 2026-09-06 — owner-requested review pause and execution correction

Implementation paused at the owner's request. Added REORIENTATION-HANDOFF-2026-09-06.md and linked it from the current programme and launch brief; canonical design documents were not rewritten. The review explicitly rejects current shell fidelity as accepted, prioritises the production visual structure and native app-menu placement, ties workspaces to whole tab/pane arrangements, separates presentation contracts from owner business operations, and bounds computer-use checkpoints. The512 default and16,384 test override are not a runtime solution: AIKit must support normal streams without a total-event ceiling while bounding retention, and preserve provider-exposed thinking content through to the canonical encounter view. The284/284 result remains functional evidence only. No app code changed or tests rerun for this documentation-only pause; context chain passed and only the primary cradle-p1 checkout exists. Shared WIP and active app state preserved.

### 2026-09-06 — owner-review shell correction checkpoint

Continued on primary cradle-p1, now HEAD3a93aae (advanced independently from the handoff's1565e59). Context chain passed; one worktree. Shared uncommitted shell/design work was reviewed and preserved; no reset, worktree, bulk stage, commit or phase merge. Before-images for this session's principal shared files: /tmp/oi-shell-20260906/*.before.*.

Implementation: removed the web app-menu/topbar row. Actual macOS O-I/Edit/Workspace/Window menus now dispatch through the main arrangement executor; native workspace entries and main-window title follow saved arrangement names. A single contextual arrangement selector remains above the panes; the sidebar selector and repeated workspace labels are removed. The left-panel toggle appears once, in Central when open and in the canvas strip when closed. Compact Chats/tasks, Files and Wiki controls are workspace-scoped; new project modes default to Chats/tasks, old saved Files navigation is retained. Actual Central files and declared wiki operations remain attached. Unadopted directories retain native location identity without invented ProjectRefs. Chats/tasks currently names the missing encounter connection rather than manufacturing sessions; it is not accepted canonical agency.

DesktopShell now receives subject identity, context/history content and arrangement actions as explicit inputs. History is scoped to the selected subject, unavailable History never renders Context, and pending history reloads clear stale readings. Pane strips, source canvas and inspector use compact companion geometry; native WebKit's white inset ordinary-file textarea was removed. Re-dock waits for the actual remounted source/file reader and foreground document before transferring focus, rather than consuming the request on an interim Refresh control.

Functional receipt (separate from visual): /tmp/oi-shell-20260906/final-walk.log passed one complete291/291 run with Central4106 + AIKit8a1 explicit artifacts (the former284 plus7 real-owner mode/chrome/History assertions). After the final native-focus repair, /tmp/oi-shell-20260906/focus-fix-walk.log passed affected files20 + spatial40 + native4 =64/64. Earlier affected127/127 and checkpoint115/115 logs are retained. Native cargo check and frontend TypeScript/build passed. Existing real source CAS/conflict, authority, history, owner restore, symlink refusal, keyboard and search-use assertions remain. Presentation assertions were updated to explicitly select Files and locate the one arrangement selector in its new canvas position.

Visual receipt: the three running studies were inspected once in the in-app browser at its1280x720 viewport. Existing companion tests additionally exercise900x760; native restored window is narrower than that reference. At the coherent native checkpoint, actual /Users/admin/Central restored the existing README and wiki tabs in WK store b89d6c197c3e4f0a9182578b41e9a603. CUA screenshots in this task show the single command strip, compact project modes, inset-free canvas and contextual right panel. Native Workspace→Rename opened the actual arrangement editor and was cancelled. Native detach/re-dock first reproduced the old mismatch (selected README, focused O-I wiki); that failure is not counted as a pass. After the focused repair, a second actual detach and Re-dock returned README and AX explicitly reported `text entry area Reading README.md` focused. Actual unsupported History displayed only its unavailable operation message. Right panel restored collapsed. No actual source edit was performed. Final native process53394 uses the same actual root, WK store and exact registered Central4106/AIKit8a gate executables. Native-composition.json identifies the final built artifact.

Visual discrepancies closed: redundant app-menu row, repeated sidebar workspace selector, duplicate left toggle, missing compact modes, source reader's white control bezel, coarse inspector chrome, History→Context fallback, and native re-dock reader focus. Remaining design/integration acceptance: canonical encounter transcript/composer and full/side/detached continuity, complete multi-project expansion semantics and presentation-only navigator extraction, richer active-subject planes as native owners disclose operations, and whole-shell owner visual acceptance at agreed viewport sizes. This is a correction checkpoint, not full spatial-phase or complete companion fidelity acceptance.

AIKit remains unresolved: read-only mainline check (`git ls-remote origin refs/heads/main`) still returns8a1d20097cb2453d86ffc1beab91767f3fd3e70b. Live checkout remains54ed782 with occupied host/connection/projection and other dirty work untouched. The current source still has max_signals_per_turn/default512 and exposed ACP thinking represented as status; the native proof's16,384 override remains connectivity evidence only. No resident generic ACP encounter service or streaming/thinking fix is claimed, and the parked Pi endpoint was not revived. The next owner candidate must preserve that occupied checkout and provide bounded retention/durable events without a normal total-event ceiling before canonical chat binding can be accepted.


## 2026-09-06 — S CLI / M′ desktop routing and capability collation

Owner clarification is recorded in CANONICAL-PRODUCT-FIELD, APP-SPEC and the
reorientation handoff: S = oi CLI whole; M′ = desktop 0/1 whole, left 0 / canvas
/ / right 1. M/S′ remain QL-MEF-owned. Scoped Terra passes collated the six source
matrices and repaired Central file/AIKit companion command accounting.

Implemented: discovered kernel clients route through oi; native candidate
bindings remain owner-selected. oi desktop shares the kernel's file, knowledge
and SessionSpace readers. oi capabilities carries 121 native capabilities and
322 relations, including 219 main-CLI identities plus the companion disclosure.
The desktop projection records 10 native/application bindings and 10 resident
arrangement commands. New dev gates capture/hash their exact suite executable
as OI_BIN. Source skills and standalone snapshot CI updated.

Evidence: scripts/test-desktop-suite-routing.py passed 5 real-owner checks using
Central gate central-4106b28b6fee-1788709485128-28202 and AIKit gate
ai-kit-8a1d20097cb2-1788706601538-48238 (six CLI help routes, native refusal,
actual file list/read, knowledge history, SessionSpace discovery). Collation
8/8; existing CLI catalogue/dispatch/dev-gate regressions 13/13. Locked CLI build,
CLI snapshot equality, all M′ capability refs, source collation and standalone
snapshot validation passed. Both changed child matrices passed structural checks.

Remaining: this receipt does not assert a new running-app walk or remote CI
activation. Resident arrangement IPC and the wider encounter programme remain.
Central debug CLI is stale against the gated file Actions; existing action.rs
basis drift and AIKit knowledge.rs basis drift were preserved, not re-attested.
Use cli/target/debug/oi as the candidate OI_BIN for the next coordinated app walk.
No bulk stage, commit, push or installed-suite replacement was performed.


### 2026-09-06 — full-programme orchestration authority transferred

Owner requested a stronger full-session handover and a short steering message for the currently working agent. Added ORCHESTRATION-CONTINUATION.md and linked it first from the programme, launch brief and reorientation handoff. It explicitly authorises bounded subagent delegation, assigns the lead overall programme/UI/integration accountability, preserves occupied lanes and later routing changes, and defines evidence, coordination and continuation responsibilities. No agents spawned or messages sent to other tasks by this documentation update; the owner will steer the current agent. No app or owner code changed.

### 2026-09-06 — active programme continuation: resident encounter candidate

Work remains active; no slice/phase completion claim. Lead owns shell and consumer integration in the existing shared checkout; occupied AIKit checkout remains untouched. AIKit work is an explicit source archive candidate at `/tmp/oi-acp-streaming-20260906/source` from main `8a1d20097cb2453d86ffc1beab91767f3fd3e70b`, not a git worktree and not yet landed/registered.

- Shell continuation: independent project expansion and workspace-scoped modes now render through ProjectBranch; spatial/files/navigator real walk passed85/85 (`/tmp/oi-shell-20260906/multi-project-walk.log`). Existing native visual checkpoint and re-dock caret repair remain dated evidence; new encounter changes await native comparison.
- AIKit candidate: default host event ceiling removed (0 means no operational event limit); disk-backed ordered lane, bounded interruption retention, owner durable SQLite journal/draft CAS and bounded presentation blocks. Exposed thinking retains native text/raw content. Explicit configured limit has distinct OperationalLimit termination; resource failures remain errors.
- Generic resident service extends existing aikit-session-space: explicit provider configuration/start, one owner/home via native advisory lock, private IPC, stale socket recovery, native SessionSpace attachment and local Project-context validation. UI clients do not own provider lifetime. No Pi-specific endpoint.
- Actual published pi-acp acceptance passed long streaming beyond512 events, thinking content/order, explicit cancellation and same-native-session continuation across fresh CLI clients; restart retains transcript/draft and reports missing resident connection truthfully. Latest owner read-model proof also compares every displayed thinking byte with durable raw history. Receipts `/tmp/oi-acp-streaming-20260906/resident-view-proof.log` and `view-resident/resident-acceptance.json`; exact candidate binary hash recorded there. Lifecycle proof `/tmp/oi-acp-streaming-20260906/lifecycle-acceptance.log` passed same-process reuse, duplicate refusal and stale recovery. Adapter tests passed; store and CLI checks passed.
- Consumer in progress: typed encounter operation routes through current `OI_BIN` and validates Central project/AIKit attachment. Normal encounter surface, real attachment list, owner thinking presentation, shared composer CAS, and detached body added. TypeScript/native compilation passed before latest flow tests. Running native app PID53394 still uses prior registered owner artifacts and original WK store; not replaced.
- Current gate: real browser ACP encounter walk; first attempt found a test assumption about Pi's genuine startup message preceding the reply, while native transcript already held the exact expected response. Assertion corrected to match actual reply. Next: rerun browser, native detach/re-dock/restore, permission/tool authority and concurrent sessions, candidate owner/consumer gate and promotion, then continue remaining programme slices. No broad staging or reset performed.

Native encounter continuation receipt: real browser walk passed7/7 (`/tmp/oi-acp-streaming-20260906/encounter-walk2.log`). Actual native app on `/Users/admin/Central` produced `OI_NATIVE_ENCOUNTER_OK`; detach and re-dock preserved the canonical transcript and draft. Re-dock initially focused before the composer became enabled; repaired by waiting for enabled state and confirming DOM focus, then native AX showed the Message textarea focused. App relaunch preserved the same resident native session `01a077c4-d218-7129-aca8-55de1e36949a`. Current app PID85353; owner PID79665, explicitly frozen proof artifact `/tmp/oi-acp-streaming-20260906/native-proof-aikit-session-space` sha256 `c5af51dd5fe4be9beb99773de9555f33634ab9f177e58feb19b9bc01e01f0259`. Owner remains resident; do not replace it during an active turn. Full receipt `native-continuity-receipt.json` in that directory.

Visual discrepancy closed: encounter follows latest output instead of remaining atop Pi startup disclosure. Startup output projection into a collapsible Provider notice is implemented in the owner candidate source, not yet in the frozen active service. Explicit operational-limit real ACP acceptance passed separately (`operational-limit-proof2.log`); it is policy distinct from normal default unlimited turn count. No full programme/phase acceptance asserted; permission/tool authority and concurrent sessions remain active next work.


### Live programme lanes — 2026-09-06

| Lane | Owner | Deliverable / state | Dependency and next gate | Evidence |
|---|---|---|---|---|
| Shell and integration | Lead | Companion geometry, native chrome, canonical encounter integration; active | Coherent native comparison after owner read-model integration; retain resident PID79665 | Recovery5/5 + spatial42/42, `/tmp/oi-shell-20260906/recovery-spatial-walk.log`; visual receipt remains separate |
| AIKit | aikit_owner | Generic resident encounter, bounded durable streaming, thinking, consent and tool results; candidate hardening | Exact candidate review and consumer gate; no active-provider replacement | Concurrent sessions, actual Codex ACP permission/refusal and authorized tool proofs under `/tmp/oi-acp-streaming-20260906/` |
| Central | central_owner | Ordinary file write/CAS/history/restore in isolated archive; hardening | Final native contract and consumer edit/history gate | 27 real filesystem checks reported; review final receipt before binding |
| Composition | acceptance_review | Native S aggregate reader complete; source aggregate disclosures active | Wire reviewed kernel reader; close genuine native availability/contribution gaps | Actual CLI composition1/1; no invented runtime readiness |

Whole slices0–8 remain the execution scope. No phase completion is inferred from these local receipts. Legacy arrangement storage is now retained rather than overwritten by each workspace render. Recovery and subject-plane persistence are functional changes awaiting the next coherent native visual comparison.


### 2026-09-06 — coherent shell and native owner consumer checkpoint

Functional evidence: ordinary-file edit/reload/CAS/both-sides/preview/restore browser walk10/10 (`/tmp/oi-shell-20260906/file-permission-walk3.log`); canonical ACP transcript/thinking/cancel/reload8/8 (`owner-integration-walk2.log`); actual Codex ACP consent/options/tool write/Activity6/6 (`permission-walk-final.log`). Consumer failures were retained and corrected: saved-file dirty marker, optional history cursor encoded as null, meaningful recovery control labels, composer operation race and stale draft-revision polling, historical permission selector collision. Native tests are not replaced by browser counts.

Visual evidence separately: coherent native build `/tmp/oi-shell-20260906/coherent-native-build.log`; main PID64514, preserved WK store b89d6c197c3e4f0a9182578b41e9a603 and actual `/Users/admin/Central`. Native CUA observed compact pane tabs, companion encounter header/planes/composer, three deliberately distinct regional grounds, real Workspace menu including recovery, existing wiki/source tabs, shared draft and reply restored. Native width resize changed wrapping/centred composer without dropping tabs; captures were1013×768 then1225×768, not an asserted exact1280×720 receipt. The original service PID79665/native session01a077c4-d218-7129-aca8-55de1e36949a remains Resident and unchanged. Its old startup disclosure remains uncollapsed because its frozen owner projection predates Provider notice; not presented as upgraded. New Central native proof path `/tmp/oi-central-files-20260906/native-proof-ctrl`, sha2561555a8ef7f4466977b9bb4c40e0099ada309e96036dc7b2c55c32e04759674e0.

Gate standing: ordinary candidate e451cca build passed but full workspace gate failed obsolete macOS registry counts; amendment0141c91b passed294 native workspace tests and awaits gate rerun. AIKit d9c52d63 exact source imported under refs/oi-candidates without touching live working tree/index, gate still pending. Subsequent owner candidates Flow803b71e6, Central Return03460e5f, Factoryb346c5cc and Actuationcb77d787 have independent native receipts; none is claimed landed or integrated by this entry. Programme remains active through slices0–8.


### 2026-09-06 — programme integration and full AIKit gate

AIKit d9c52d63da1c19fd11b7bb2da2505b454cabb7e5 now has a **passed standard isolated gate**, including release build, full workspace/all-targets tests and captured Cradle kernel consumer. Exact receipt: `/Users/admin/Library/Application Support/OI/receipts/dev/ai-kit-d9c52d63da1c-1788720375668-10919/receipt.json`. Release contributions are aikit sha256a7bd76344aa7c7083f25243b091e868cac01e7008639087cfa65ffb1bb643b91 and aikit-session-space sha2564db82a9359b03560de59f3a10f2fe14453ee7ca003b398d1ad0c3c53edcd2e3a. This does not replace the running frozen resident provider or establish later Flow/Living/Contemplate acceptance. The gate captured the kernel before subsequent ground-picker/material integration.

Shared Field lifecycle candidate9815d7f reviewed and applied to the clean owned eight paths; integrated183 native/provider regressions passed (`/tmp/oi-shared-lifecycle-20260906/integrated-regression.log`). No live user ground published; Explore body still needs attachment. Central recognitionab7b3929 follows Return03460e5:295 full workspace +17 actual filesystem checks; explicit root identity/access/no-mutation, not binding or initialization. Workcell materialf53ad162 has12 actual native CLI tests including a real HTTP body and service loss; no default browser exposure invented.

Lead changes after native checkpoint: System6-owner reading; native folder-dialog and typed recognition/binding consumer; ordinary History assertions updated to actual native availability; encounter plane carried as workspace/surface view state through main/detached views; recovery preserves valid project navigation and namespaces recovered bindings. These latest changes await their targeted walks/native changed-flow checkpoint. Existing app PID64514/provider79665 were not replaced. Settled native re-dock at prior checkpoint did confirm enabled Message focus; immediate prior-wiki AX alone was not treated as a pass.

Current live lanes (supersedes earlier allocation table):

| Lane | Owner | Deliverable/state | Next integration gate |
| --- | --- | --- | --- |
| Programme/UI | lead | Shell, System, ground chooser, view-state recovery; Shared Field lifecycle integrated | Targeted real files/recovery/System walk; native chooser and latest consumer comparison |
| AIKit | aikit_owner | Flow/Living candidates frozen; real ACP runtime identity/composition and Contemplate/Return staging implementing | Actual source-backed model binding and same-session Contemplate through ACP |
| Central/S | central_owner | Recognition frozen; binding-only S and shared composition CAS implementing | Real isolated S/recognition tests, no live ground change |
| Material/Factory | acceptance_review |166 evidence map and Workcell candidate complete; typed consumer seams and production BuildSurface packaging | Actual S receipt/body/grant consumer tests then root mounts |

166 evidence/disposition reconciliation is `/tmp/oi-programme-acceptance-20260906/`:166 canonical obligations are distinct from443 native catalogue rows. Exact-source joins do not imply equivalence;55 unmatched mappings remain explicit. Dispositions are proposals, not waived work or owner acceptance. All slices0–8 remain active. Completed compiler cache cleanup receipts preserve exact native executable hashes, source/locks/logs; no occupied source or running provider was removed.


### 2026-09-06 — owner direction correction; implementation paused

Owner rejects current right-panel shape: agent details and full Conversation /
Activity / Context / Inspect section belong in the dynamic right layer, not the
canvas header/plane block. Persistent panel-management button bar to be removed
in favour of standard keyboard/native-menu/contextual operation. Broad material
format support, especially actual HTML rendering, is an explicit canvas obligation.
Recorded in wayfinder and ORCHESTRATION-CONTINUATION; not yet implemented. Earlier
visual checkpoint is partial evidence, not design acceptance. Paused at owner's
request to reflect; no new owner work or builds commissioned during pause.

Latest completed browser walk `/tmp/oi-shell-20260906/live-layout-ground-walk2.log`:
files21/21, recovery5/5, spatial42/42, System4/4. Walk layout read now observes
actual mounted workspace, fixing legacy-storage evidence defect. Ground13/14
checks then reload visibility timeout: retain failed receipt, do not call complete.
Fresh Central ab7 standard gate passed per actual receipt in
`central-ab7b39292a14-1788721281763-94397`; supplemental consumer result still needs
inspection. AIKit Contemplate source compiles and runtime identity/native adapter
checks passed, but actual ACP completion/Return acceptance was unfinished when
agent rate limit hit. Do not promote this work from its summary. Factory/material
kernel clients have2/2 actual native consumer checks; Factory35d758 contribution
captured as9 exact reviewed Git blobs under src/contributions/factory with manifest.
These bodies are not mounted yet. Native confirmation ingress is only a proposed
contract (bounded owner CLI PTY), no module implemented. All agent lanes hit usage
limits; no automatic retry or credit reset authorized.


### 2026-09-06 — foundation/Gateway specification and minimal dispatch

Owner requested desktop-side specification/execution mapping while the product
team develops Agency Gateway. Read the supplied awareness brief and canonical
O-I#154 via authenticated issue read; existing gateway-awareness document retained
as dated session evidence. Runtime/connector and Workcell hosting source paths
were checked for existence/contract location; no new runtime acceptance inferred.

Added explicit desktop consumer contract in architecture§14, application-spec
clarification, E.G continuity/right-panel UX states, BOOT-15, programme GW-01–06
and foundation FND-00–06. Wayfinder no longer leaves Gateway continuity as fog.
Machine capability publication/regeneration is a named native-owner handoff;
no unsupported gateway commands or capability rows added to generated catalogues.
The full three-route HTML reference set has a mandatory real-inspection matrix;
source/capture/viewport/interaction and separate visual/functional/owner evidence
are required. Old inspection does not excuse the missed right panel. Native top
bar exception and explicit owner chrome corrections are bounded. Actual HTML
rendering and format availability/fallback are part of material foundation.

BUILD-O-I-NEXT is now the minimal dispatch, pointing to detailed map/programme;
ORCHESTRATION and canonical execution protocol carry current precedence. Current
turn changes documentation only. No reference UI inspection, app build, native
provider replacement, implementation resumption, commit or acceptance promotion
is claimed by this entry.


### 2026-09-08 — FND-00 reference contract closed; FND-01–04 build wave dispatched

Lead session (Claude Fable) on `cradle-p1` HEAD `c1ce2db` with the shared dirty
WIP preserved; context chain intact, one worktree, no commit/push/reset.

FND-00: the complete indexed HTML set was inspected live in the in-app browser
(REF-01 `?study`, REF-02 `?study=chat`, REF-03 `?study=tiled`) at 1280×720 and
900×760, exercising planes, ⌘⌥J full agent and Escape, the Window arrange menu,
project mode changes, node context menu and the lower drawer. The production
shell was baselined in the browser transport against the real kernel bridge
(`127.0.0.1:4179`, vite `:1423`) over `/Users/admin/Central`: rest, project
modes, Files tree, README.md read-only, writing mode, right inspector. Receipt:
`FND-00-REFERENCE-MATRIX-2026-09-08.md` (rows A–F; required structural rows
A1 A2 A4 A6 A9 B1 B2 B4 C2 D1–D6 D9 D11 E2–E5). Functional finding F-01: opening
the O-I wiki neighbourhood through the bridge failed with a JSON control-character
parse error from the AIKit knowledge route; investigation open.

Design ruling: shell vocabulary tokens appended to
`packages/oi-design-system/tokens.css` (grounds, gutter, hairline, accent,
type scale, elevation, motion) and the build brief
`FND-01-02-SHELL-BRIEF-2026-09-08.md`, including the owner steer that the
running app's writing canvas, source editor, file surface and encounter are
ahead of the studies and keep every function (polish only).

Research receipts (read-only agents): walk selector/aria anchors to preserve;
material-host owner seam (Central `files.read` is UTF-8/4 MiB/NUL-refusing with
no base64; Tauri CSP `frame-src 'none'`, no custom protocol, detached windows
inherit IPC → sandboxed iframe over an `oi-material://` scheme); BOOT-00–15 gap
table (window-scope loading never used; no Gateway/ecology op exists; ground
chooser only inside System).

Live lanes:

| Lane | Agent | Deliverable / state | Next gate |
|---|---|---|---|
| S1 shell chrome (FND-01) | sonnet implementer | ground/gutter/card planes, workbench bar without the button cluster, pane/tab grammar, menus, empty/writing polish; building | build + rest/surfaces/spatial/files/companions/study walks; lead review with screenshots |
| S2 sidebar (FND-01) | sonnet implementer | REF-02 sidebar grammar over real Central/encounter reads; building | navigator/files walks; lead review |
| S3 accompanying agent layer (FND-02) | sonnet implementer | `src/agent/AgentLayer`, EncounterView presentations, subject-following Context, System as canvas surface, Cradle wiring; building | encounter/permission/system walks (need resident owner); lead review |
| S4 material host (FND-04) | sonnet implementer | Central `files.read` base64 candidate, kernel `FileBytes`, `oi-material://` protocol + CSP, renderer registry, material walk; building | ctrl tests + candidate hash, cargo check, material walk |
| FND-05 bootstrap | queued (touches Cradle/Rest after S1/S3) | window-scope loading, boot phases, ground chooser at start, honest Gateway absence | after S1/S3 land |
| FND-03 / FND-06 | lead | keyboard/menu parity check, native comparison, repeated-cycle resource receipt | after the wave integrates |

No visual acceptance is claimed by this entry; functional walks were not rerun
against the shell edits yet.

Inventory note (law 13): `git worktree list` shows a second worktree
`/Users/admin/Central/Work/oi-m3-bootstrap` on branch `oi-m3-bootstrap`
(HEAD 2d36ba2, 1 dirty file, touched 2026-09-08 04:15). It is another
session's active lane in its own directory and branch; ruled inert for the
foundation round, not removed, not used.

F-01 root cause: the kernel knowledge route runs `oi aikit --json -C <project>
knowledge …`. The installed `~/.local/bin/oi` (built 2026-09-06) does not
honour `OI_AIKIT_BIN` and forwards to an AIKit without the `knowledge` route;
the verified gate `ai-kit-d9c52d63` binary has the route but refuses the live
knowledge store ("schema 6 but this build only knows 5" — another session
advanced AIKit main to fa002bb and the store with it). Working binding for this
round's browser/bridge walks: `OI_BIN=cli/target/debug/oi`,
`OI_AIKIT_BIN=~/.cargo/bin/aikit` (current main, 2026-09-08 03:42),
`OI_CENTRAL_CTRL_BIN=` the installed ctrl. Secondary defect: the dev walk bridge
embedded owner stderr in its error envelope without JSON escaping; S4 owns the
fix. No installed binary was replaced.

### 2026-09-08 — build wave returns (S1 shell, S2 sidebar, S3 agent layer); integration seams

S1 (shell chrome): shell ground + 4 px gutter + card planes, workbench bar
without the panel-management cluster (Return-to-arrangement pill when
maximized; native Window menu `region.right` → "Show / Hide Agent"), pane/tab
grammar with kind glyphs and `⋯` pane tool opening the same disclosures,
focused-pane highlight, context menu with `kbd` shortcuts, search overlay,
empty-state and writing-canvas polish, source/file surface gutter + footer,
responsive tiers (≤1000 compact, ≤760 agent drawer). `npm run build` and
`cargo check` green; rest 14/14, companions 29/29, study 19/19. Matrix rows
closed by S1's own screenshots: A1 A2 A4 A6 A9 A10 B1 B2 B4 E1 (visual
receipts `walk/artifacts/fnd/s1-*.png`).

S2 (sidebar): REF-02 sidebar geometry over the real Central/encounter reads,
"Open accompanying agent" entry (real `region.right` dispatch), shared Loading
indicator in EncounterList/FileTree; found the design-system defect that
`--oi-loading-ground/ink` resolved at `:root` (lead fixed it in tokens.css).
Rows C2 C4 C5 C6 closed; C1/C9 in S1's files.

S3 (accompanying agent, FND-02): `src/agent/AgentLayer` bound to
`layout.accompanying`, EncounterView `tab|side|full` presentations, Context
plane follows the active subject (real read model; History only when the
operation exists), Inspect as owner rows + raw `details`, honest no-encounter
state from real attached rows/providers, polling paused when hidden, `system`
surface kind, DetachedFrame tab presentation. Evidence `s3-*.png` including a
real already-connected pi-acp encounter presented in the side plane (D1–D7,
D9, D10). Known gap: file subjects report revision Unknown (read model has no
draft state for ordinary files yet).

Lead integration after the wave: legacy Context/History/System chrome no
longer renders when the agent layer is present; `system` surface body mounted
in Workbench (closes D11); agent plane nav fits 300 px; project rows flex
with the 6 px mark; writing surface shows no focus ring. Walk runs collided
on port 4179 (orphan bridge from a concurrent lane, and the shared dev bridge)
— the shared dev bridge now lives on 4189, the orphan was stopped, and the
full functional suite is being rerun against the freed port; results pending.

Resource smoke (S6, `walk/scenarios/resources.mjs`, standalone against the
bridge-bound dev server during the shell rebuild): 4 cycles (3 warm-up, 1
sampled) with `--expose-gc`; sampled heap 6.86 MB used / 9.31 MB total, 135
DOM nodes, 176 listeners, 1 document; 0 B and 0 nodes growth over the single
sampled cycle — a smoke of the harness, not the FND-06 receipt (the 20-cycle
run with real open/close/split/maximize/wiki/agent cycles is still owed, and
its step log recorded a split step that timed out; a synthetic ⌘D in the live
app splits correctly, so the miss is a scenario timing issue to fix, not an
app regression). Receipt: `walk/artifacts/resources-smoke.json`,
`resources-smoke-summary.md`.

Second rate-limit interruption (all lanes, 2026-09-08 ~04:20–08:50): S4, S5,
the walk repair and the design review were relaunched at 10:40 to continue
from their on-disk partial work. The bridge-bound dev server was rebound to
the 4189 bridge (it had still pointed at 4179).

Design review (opus, read-only, `walk/artifacts/review/FND-01-02-REVIEW.md`
+ 53 screenshots incl. study frames): blockers — descendant
`.desktop-shell button`/`:focus-visible` rules crushing agent-plane controls
to 0 width and drawing a bezel on the writing canvas; legacy `.inspector-body`
padding around the agent layer; Return pill wrapping in the workbench bar;
plane nav clipping "Inspect" at 900 px; wiki entry silently no-op on the
owner refusal "SemanticWiki provider is absent from this Project world";
shoulds — full agent loses its card, centre not a card at rest/writing/single
pane, encounter.css off-token with no motion/hover, material markdown srcdoc
carries a duplicate palette. Row verdicts: closed A4 A5 A7 A8 A10 B1 B5 B7
C1–C4 C7 D5 D6 D9 D11; partial A1 A2 A3 A6 A9 B2 B3 B4 C5 C6 C8 D1–D4 D7 D10;
open C9. S7 (polish) dispatched on the shell/agent/encounter findings; the
material palette goes to S4, the "Observed NaNd ago" stamp to S5. Owner note:
the SemanticWiki absence is AIKit's real state for this project under the
current-main aikit; the desktop must show it, not repair it.

S5 (FND-05 bootstrap, browser transport): `boot` phases in KernelProvider
(starting/ready/transport-unavailable/ground-unrecognised/ground-inaccessible)
derived from the transport probe, first `state` and the ground status op;
BOOT-00 window-scope indicator (design-system component, `inert` root, focus
return) lifted the instant `state` settles; chooser-first at unrecognised or
inaccessible ground with writing still reachable; discovered-not-ready
labelling and `observed_at_unix_ms` on composition/agency readings; Gateway
aperture as a static truthful System section (absence, named obligations,
three real facts); per-binding open failure with Retry; freshness with the
shared indicator in EncounterList/KnowledgeSurface/FileTree/SourceHistory.
Evidence: `bootstrap.mjs` standalone 13/13 (`walk/artifacts/fnd/s5-*.png`),
system 4/4, recovery 5/5, rest 14/14, kernel `cargo test --test source_cas`
11 passed. Open: the native cold-start pair and the missing-`OI_BIN` case
(no native build in this round yet); BOOT-15 text not yet in the agent
layer's no-encounter state (file ownership).

Walk repair after the shell wave: spatial 42/42, files 21/21, ground 15/15,
surfaces 28/28 (full WALK build, verified candidate owner bindings). Causes:
the split-width check compared an unsettled paint after a keyboard resize
with a settled one after restore (weights were identical; the scenario now
waits for two identical reads); ordinary files now open through the material
surface with a Rendered/Source toggle (scenario selects Source before the
editor assertion); ground compared a raw temp path with the owner's
canonicalised `/private/var` path and expected the old boot-phase System
auto-surface (System is now a canvas surface). Residual app defect found, not
yet fixed: `WorldNavigator.keyFor()` resolves a project's disclosure key from
the kernel's global selection before the per-workspace lookup, so a workspace
switch can override saved expansion state intermittently (~30–50 % of runs).

Lead fix: `WorldNavigator.keyFor()` now prefers the workspace's persisted key
for a path over the kernel's lagging global selection. Three consecutive
runs: navigator 23/23 ×3, spatial 42/42 ×2; the first spatial run of the
sequence timed out before its first check while the fresh bridge's initial
Central read was still pending after the cold WALK build (0/0, no assertion
failed) — recorded as a cold-start timing flake, not a pass.

S4 (FND-04 material host): Central `central.files.read` gains
`encoding: base64` (32 MiB ceiling, `mime_hint` sniff, retrieval rules
unchanged; `cargo test -p ctrl --lib files` 9/9) as candidate
`Work/Central/target/release/ctrl` sha256
`071b9ea4a10cf15ade5cc8c32c7d9cd8163c298c1b6357519e5904a134a4ad1a`, not
installed and not yet landed; kernel `FileBytes` op + `read_bytes` +
`resolve_material` (tests 2/2); Tauri `oi-material://` async scheme with
directory-bound resolution, CSP `frame-src oi-material:` and dead `asset:`
entries removed; renderer `src/material/` (detect, dependency-free markdown,
sandboxed iframes, image, PDF via the platform viewer, disposition card
without invented open-with, Rendered/Source toggle, suspend/resume on inactive
tab, maximize and document-hidden); bridge `/material` route and serde_json
envelopes. `node walk/run.mjs material` 24/24 including HTML with relative
img/css/link, traversal refused, PDF actually rendered on this machine,
`.bin` disposition. Rows E2–E5 closed in the browser transport; the native
`oi-material://` path still needs the coherent native walk (FND-06).
Integration fact: the recognition-capable ctrl (`ab7b3929` gate) and the
base64-capable candidate are built from different Central sources; one ctrl
carrying both is required before the native comparison.

S7 (polish, from the opus review): scoped the leaking `.desktop-shell button`
and `:focus-visible` rules (agent-plane controls at their true size, no bezel
on the writing surface or ⌘K input); agent layer mounts directly in the right
plane; workbench bar never wraps and the Return pill is one line; plane nav
fits at 260 px; wiki/search/knowledge owner refusals render as visible alert
cards; full agent keeps its card and one horizontal axis; rest/writing/single
pane draw the same card as split panes; encounter.css on the shell tokens
with hover/pressed/focus and motion, Send as a 26 px accent control; sticky
System row; drawer scrim; first-paint sidebar width guard; context-menu
glyphs; raw values tokenised. Findings 1–11, 20–25, 28–30, 32, 33, 36
closed; 16–19, 26, 27 and the material toggle, SystemPanel stamp and
navigator rows handed to S8. `npm run build` green; 14/14 anchor checks;
evidence `walk/artifacts/fnd/s7-*.png`. Full functional suite rerun in
progress; the Central lane is producing one ctrl with recognition + base64.

Full functional suite after S7: rest 14, surfaces 28, kernel-cas 40,
navigator 23, editor 32, history 17, files 21, knowledge 25, companions 29,
study 19, recovery 5, ground 15, system 4, bootstrap 10, file-edit 10 — all
PASS; spatial failed once on the first `keyFor` change (a path could carry
two presentation keys), material 12/16 because the bound ctrl (recognition
candidate) lacks the base64 read the assets need. `keyFor` rewritten to one
key per path (ProjectRef when the workspace holds it, else the persisted
entry, else ProjectRef/directory ref): spatial 42/42 and navigator 23/23 three
times in a row.

Central lane: the four not-yet-landed candidate commits (e451cca, 0141c91,
03460e5, ab7b392 — ordinary-file CAS/history/recovery/restore, bounded Flow
disclosure + Source Return, `central.recognize`) merged `--no-ff` onto
Central main as d2fd616; the base64/`mime_hint` material read landed as
7f3a85f and the `file_mutation.rs` encoding thread-through as 9a6abf4
(Central main HEAD, not pushed). `cargo test --workspace` 318/318;
`cargo build --release` clean; functional checks: recognize → recognized,
base64 PNG byte-exact with `image/png`, CAS write/history/list. Candidate
`Work/Central/target/release/ctrl` sha256
`fd17999b677505d362fa3ea1ff8244a509a9401997006a77924fe20355505e70`; dev gate
`central-9a6abf41285a-1788864017019-79731` passed owner build/test, the
Cradle consumer step failed only on a wiki test that shells to `aikit` on
PATH without the `knowledge` route (binding, not Central). Untouched:
`ctrl/src/engineering_ground.rs` (unrelated dirty work). Dev bridge and walk
bindings now use this ctrl.

PF Flow / source-return owner relation (2026-09-08): no Central defect found at
pinned `Work/Central` revision `f3559dbf900b8409ff00b24a84b824c6cd6ec2c3`.
Added the typed owner-Action adapter in `desktop/cradle/kernel/src/flow.rs`
and real consumer proof in `desktop/cradle/kernel/tests/flow_return.rs`:
the exact candidate O:I executable routes to the exact pinned Central
executable, preserving FlowRef/SourceRef, bytes, revision history, lifecycle,
actor/session provenance and explicit source-return outcomes. Owner evidence:
`/tmp/pf-flow-owner-receipt-20260908.json` (isolated root
`/tmp/pf-flow-owner.Pv1u7P`). Consumer command
`cargo test --manifest-path desktop/cradle/kernel/Cargo.toml --test flow_return
-- --nocapture` passed 1/1; kernel unit tests passed 20/20. Full kernel test
run passed all exercised non-ignored cases except the unrelated existing
AIKit `knowledge` subcommand failure in `source_cas`; no walk was run because
the brief keeps Flow/Return UI inputs with the UI lead. Candidate hashes:
O:I `582c2b5ad541c09fc0890a501d035f73b6e5224e4cce5e569de9d66d191cf999`,
Central `538e70402dff0377efd5c39843aefb03355de281b7bada9945760a6ac45ff887`.
No Central files, UI files, bridges, binaries, branches, commits or pushes
were changed by this unit.

Accountable domain checkpoint (2026-09-08): the shell redesign did not remove
Central ordinary-file CAS/history/recovery, recognition or base64 material
reads. They are present on accepted Central main
`f3559dbf900b8409ff00b24a84b824c6cd6ec2c3`; the accepted-main blobs for
`ctrl/src/files.rs` and `ctrl/src/file_mutation.rs` are byte-identical to the
previously tested `9a6abf4` candidate. The live bridge's release ctrl was not
replaced. Owner/consumer evidence: `cargo test -p ctrl files::tests` 8/8;
real temporary-ground `ordinary_files.py` 35/35; kernel material-bytes 2/2;
explicit ignored native ordinary-CAS 1/1; source-CAS 11/11 with one intentional
ignore. An accepted-main rebuild/hash remains owed once the shared bridge is
free.

AIKit agency reconciliation found no required implementation diff. The owner
already uses unlimited normal signal count (`0`), bounded unattributed queue
(64), durable ordered SQLite history and bounded page/view reads. Real ACP
evidence produced 531 long-stream events, 528 thinking updates, same-session
continuation `OI_CONTINUED_OK`, draft revision 7 and two concurrent native
session refs. Receipts:
`/private/tmp/aikit-agency-gate-20260908-retry/runner.log` and
`/private/tmp/aikit-agency-concurrent-20260908/concurrent-acceptance.json`;
tested `aikit-session-space` hash
`8045de38676d6666cf244b028a1503fb8ccab49e5cd74cc9a99a2a6d227728de`.
Permission remains open: a real provider used read/edit tools but emitted no
native permission request/response event
(`/private/tmp/aikit-agency-permission-20260908/runner.log`).

Knowledge consumer repair: `desktop/cradle/kernel/src/knowledge.rs` now
preserves non-zero AIKit status/stderr when stdout is empty instead of
misreporting a JSON decode failure. Exact consumer O:I hash
`582c2b5ad541c09fc0890a501d035f73b6e5224e4cce5e569de9d66d191cf999`;
real provider-loss and source-CAS tests passed apart from unrelated moving
material cases in the then-full suite.

Workcell commit `70a39c1` makes the missing owner-native `material` operation
operative. It composes the receipt WorldRef with sequential observe/expose
outcomes and typed body/provenance descriptors; the kernel only validates and
adapts. `cargo test --locked -p epilogos-workcell-cli --test cli` passed 4/4;
`cargo test --locked -p epilogos-workcell-runtime --test expose_collect`
passed 6/6; exact-bound O:I `material_native` passed 1/1. Candidate Workcell
hash `dee625432b0373db6bfcc27319b13760af353cfc844015556ab2d75ca985e0ec`;
evidence `/tmp/oi-workcell-material-H8fWme/`. Non-empty HTML/CSS/JavaScript
bodies, nested owner assets and unsupported-format dispositions remain
unproved through this route.

Factory is a genuine contract mismatch, not hidden presentation. Accepted
Factory `947ce7a` exposes only explicit-state `build.snapshot`,
`build.refresh`, `action.list`, `action.invoke` and `verify`. It has no
`build discover`, binding snapshot or `action intent`; accepted Actuation
`163aef0` has no generic `authority approve`. No desktop registry/grant was
invented and the ignored consumer test is not acceptance. Owner checks:
`cargo fmt --check`; `cargo clippy --all-targets -- -D warnings`;
`cargo test --all-targets` 42 passed; `validate_factory_skills.py` OK.
Evidence `/tmp/oi-factory-gate.N8Ztg4/owner-command-probes.log`.

FND-06 remains open. The former 20-cycle result contained 80 failed steps.
The repaired 23-cycle browser run has zero step failures but heap slope about
175,378 bytes/cycle and DOM slope about 86.526 nodes/cycle, both above the
gate, and is not native child-window evidence.

Fresh capability reconciliation at
`/tmp/oi-programme-acceptance-20260908.otSFg6` contains all 166 unique
obligations: 111 exact-source evidence overlaps, 55 unmatched and zero
accepted. Dispositions: 92 not-yet-connected, 45 non-UI, 16 native-alternate,
12 connected-unaccepted, one unavailable. Hashes: `dispositions.json`
`ef1506547d7a8b497f3fdc230d7d6c1a41c6d17435a90871ac8e9499e36da275`;
`dispositions.tsv`
`6e809556924eaa162bf0f03b4d08ac3e7ab3b2c886de374524ffe4ea5916d278`;
`blockers.json`
`5253d8a643499fff261f3538dced982cfa52112bf35edd6b71437dcedbf07f95`.

| Lane | Owner revision | State | Kernel role | Next gate |
|---|---|---|---|---|
| Central files | `f3559db` | real owner + consumer tests green | exact owner adapter | accepted-main rebuild/hash; UI-lead bind |
| AIKit agency | `9e586aa` inspected | stream/thinking/continuation/concurrency real; permission open | encounter adapter | native permission/failure taxonomy |
| Knowledge | AIKit `9e586aa`; O:I working diff | truthful provider-loss repair | no desktop index | clean full suite after moving lanes settle |
| Flow/Return | Central `f3559db`; O:I working diff | typed owner contract green | typed adapter, no owner state | expose stable Rust `KernelOp`; then UI seam |
| Workcell material | Workcell `70a39c1`; O:I working test | lifecycle route green | receipt/identity validator | rich body/assets/refusal proof |
| Factory | Factory `947ce7a`; Actuation `163aef0` | incompatible contract proved | legacy adapter unusable | owner-contract reconciliation |
| FND-06 | UI-lead working tree | harness fixed; growth observed | none | lifecycle repair + native cycles |


## 2026-09-08 · UI lead shell/pane tranche (user-directed topbar correction)

Original WIP safety checkpoint `79a446d` pushed before implementation. User
explicitly requested three parallel subagents and moved region controls from
footer to a window-wide, focused-pane-aware topbar. Built that strip, quiet
workspace footer, usable narrow focused-pane selector, persistent empty splits,
pane/tab operations and native detach/re-dock focus/draft recovery. Tab
activation and Close are now distinct native accessibility actions.

Functional: shell-recovery 36/36, surfaces 28/28, material 26/26, navigator
23/23, spatial 42/42 passed. Real app evidence includes empty-pane reload and
fill, width transitions, overlays and real HTML/CSS/JavaScript interaction.
Native macOS observations include topbar integration, split/fill, narrow pane
switching, editor focus, draft-preserving detach/re-dock, quit/relaunch and
separate tab activation/close/reopen. Browser screenshots are identified as
browser evidence; native screenshots remain in the task record.

Resource correction to earlier failing readings: explicit retained-heap
measurement after bounding renderer receipts to 256 produced 20,537.8 B/cycle
(<58,890 threshold), DOM 3.729/cycle, 20/20 successful sampled cycles. Earlier
failed/no-GC readings remain preserved. This is not native GPU/lifetime
acceptance. FND-06 and the full FND-00–06 gate remain open; provider helper
composition and native permission/failure coverage are unresolved.

System internal design is deferred to its separate task. Point-cloud options
are isolated proposals, not production interaction effects. Review and exact
file/build evidence: `desktop/cradle/walk/artifacts/review/SHELL-PANES-TRANCHE-2026-09-08.md`.
No phase advancement. Concurrent kernel, System and A2A work is preserved.


## 2026-09-08 · UI refinement and browser-material capability tranche

User-directed three-agent parallel tranche: elemental point-cloud showcase,
compact shell refinement and planned product/Self-Other surface recovery.
Tabs scroll independently of fixed pane tools; topbar carries only region
toggles and the necessary narrow pane selector. My O:I exposes real Central
User/Agent folders above Work. Active shading uses existing editor footers,
and menus dismiss outside, Escape and when focus enters rendered content.

Native rendering investigation separated the bare earlier HTML fixture from
a real module/data failure. Native protocol opaque-origin CORS and shared MIME
fallback repair ES modules and fetch; the sandbox stays opaque. Preview
zoom/view persist per binding; reload/retry read the owner. Application IPC
commands are explicitly manifest-controlled and granted to shell webviews.
Window-only O:I loading logo; local loading uses shared point clusters.

Real-owner cleanup 18/18, footer refinement 3/3, shell 36/36 and rich-rendering 19/19
passed. The iframe-menu defect was reproduced before repair. Native WKWebView
shows authored rich CSS/SVG, module/data Ready, real counter and reload.
The showcase is an isolated visual proposal; SharedField/browser/computer
owner gaps remain explicit, with no new semantic store or foundation promotion.
Review: desktop/cradle/walk/artifacts/review/browser-canvas/REVIEW.md.
Effects: desktop/cradle/walk/artifacts/review/point-cloud-elements/index.html.


## 2026-09-08 — native browser and shell refinement tranche

User-commissioned lower-tier shell motion and editor-context planning returned to the UI lead. Implemented native browser views inside existing surface bindings, real navigation/history/zoom, isolated temporary stores, hide/show and detach/reparent/redock continuity, native page focus, URL/capability boundaries and explicit popup handling. Native observations cover retained forms/counters/cookies, separate stores, split geometry, full-right overlay, actual close/reopen disposal, direct shell IPC denial and external HTTPS. Hairline resize affordances, synchronized region motion, zero canvas top gap and duplicate-title/footer cleanup are in place. Editor/context attachment remains an attributed proposal with Central/AIKit owner gaps, not a new shell semantic store. Bounded receipt: `desktop/cradle/walk/artifacts/review/browser-native/REVIEW.md`; linked shell measurements and editor plan there. This does not mark complete browser-product acceptance or the wider cradle phase. Downloads and persistent profiles are not shipped.


### 2026-09-08 — terminal, Flow and final shell layers (Codex shell lead)

Implemented real PTY terminal surfaces with lease-preserving detach/re-dock, Central NOW Flow creation and revision saves, contextual editor/footer tools and selected-text context insertion, browser downloads and persistent profiles, full-height sidebar ground, pane-content focus, right-pane maximize and actual fresh tabs. Native review exercised shell I/O/resize/interrupt/detach, file download, persistent cookie restart, Flow saving and provenance-bearing selection review. Real checks: PTY 5/5, Flow 2/2, editor 33/33, material 26/26, context draft 7/7. Build excludes development walk tooling.

Evidence and explicit limits: `desktop/cradle/walk/artifacts/review/FINAL-LAYERS-2026-09-08.md`. Git owner operations and semantic web-element attachments remain follow-on contracts; suite/owner promotion must keep binary schemas matched. Concurrent System, point-cloud and governance work remains separately owned.


### 2026-09-08 — owner-led editor and chrome refinement

CodeMirror now backs Central source, ordinary text-file and Flow editing. Standard selections carry local highlights and explicit @context attachment; the owner save/conflict paths remain in place. The window and tab row share space, sidebar resize affordances are cursor-only, synchronized geometry settles even when WebKit suspends animation frames, focused footers reveal from their bottom edge, and the workspace footer has a retained pin toggle. Tab menus now expose tab focus and destination-pane moves. Fresh canvas keeps Write/Search/Terminal with configurable rotating phrases.

Evidence: refinement 27/27, real context-owner 7/7, native Flow save/highlight and full-right geometry. Receipt and bounded limitations: `desktop/cradle/walk/artifacts/review/EDITOR-CHROME-REFINEMENT-2026-09-08.md`. Production app rebuilt. Concurrent System, point-cloud and shared-day changes are preserved separately.

| Editor modes, context and open corner | S→S0/S2 | implemented and walked 2026-09-08 | Pen/@ alone select and reveal toolkits; writing menu parity, larger fold target, layout-expanding footers, hidden canvas scrollbars, live Mac-control corner cutout; real DOM/native-page observations with stale validation and owner-draft CAS | 31 refinement + 12 real-owner context + 11 page-context checks; native browser granular text/component picks, Markdown element pick, final two-mode header and cutout observed; production app build | Human visual acceptance; PDF/internal cross-origin semantic picking and synced annotation ownership remain outside this receipt. See `desktop/cradle/walk/artifacts/review/MODE-CONTEXT-CORNER-REFINEMENT-2026-09-08.md` |

| Final sidebar / full agency polish | S→S0/S2 | implemented and walked 2026-09-08 | Sidebar icons down 2px; arrow-free folder rows; System outside navigator scroll; full agent covers canvas header and reflows content with live global controls | 37/37 refinement checks; actual-Central native full view inspected; production app build | Owner visual review; concurrent work preserved |


### 2026-09-08 — P1 integration orchestrator checkpoint

User-directed current-state checkpoint `3a4f69d` pushed to `origin/cradle-p1` before new implementation. Context chain passed again with explicit absolute Central/AIKit function bindings; single O-I worktree. Existing UI, System, owner changes and resident PID 79665 preserved. Final native build/walk remains serialized after UI lead publishes FND-07. No phase acceptance or downstream implementation begins here.

| Cell | Owner | Current evidence | Next condition |
|---|---|---|---|
| FND-07 expression | existing UI lead | production module and wiring in progress; latest resize-only gesture steer preserved, other intents reserved | stable candidate, module/browser receipt, then orchestrator native integration |
| Central binding | verification worker, reviewed | exact ctrl `4389437f…` and oi `582c2b5a…`; 35 real filesystem, 8 owner unit, 2 material-byte and 10 source-CAS tests passed; two AIKit-dependent cases excluded | frozen source provenance and native walk |
| Flow/Return kernel contract | domain worker, reviewed | 2 real tests passed with exact copied executables; test candidate resolution repaired to require explicit absolute bindings | integrate test diff; Flow disclosure UI correction separately owned |
| Agent-native component audit | read-only worker, reviewed | absent encounter Actions incorrectly enable legacy controls; Flow Save omits existing capability disclosure; corrections returned to UI lead | re-audit frozen candidate; static findings are not native acceptance |
| Capability reconciliation | read-only worker | exact affected IDs being mapped conservatively | append exact dispositions after native gate |
| Native resource gate | read-only preparation / orchestrator | prior browser 20 sampled cycles had zero step failures and bounded retained heap; earlier 80-failure run rejected | warm baseline, repeated native windows/webviews, state parity and attributed process measurements |

Binding caveats: the accepted ctrl executable hash is verified, but its dependency file names the live Central source tree; no whole-binary source-purity claim. The resident AIKit process remains running although its old `/tmp/oi-acp-streaming-20260906/` executable path is absent. Do not restart it. Coherent isolated AIKit pair is being resolved before native binding. Workcell current clean `70a39c1` differs from one stale `81fd5e1` brief; rich body/asset evidence is still open, not inferred from the empty-body contract test.

### P1 serialized native review — revision 2 held, 2026-09-08

The coherent native bundle built successfully from 145 unchanged frozen source inputs. Exact owner bindings and accepted Central/AIKit archive-build provenance are retained in `desktop/cradle/walk/artifacts/review/p1-integration-2026-09-08/`. Isolated native source save reached the Central file (7003 bytes); a real native terminal produced `P1_NATIVE_PTY_OK`. These are bounded observations, not gate closure.

Native review stopped at a harness binding error: Central root and AIKit home were isolated but suite `OI_HOME` was omitted. System correctly disclosed the existing suite binding. A private suite home was subsequently bound through Central recognition and `oi ground bind`; no user composition was changed. The isolated candidate was closed through its native Quit action.

FND-07 remains open: a successful native sidebar keyboard resize produced no observed expression increment; static review also proves the split keyboard handler stops propagation before the document expression listener. UI lead owns the narrow integration repair and real React regression. All 21 structural comparison rows remain individually bounded/open in its native receipt. FND-06 repeated native cycles, real two-session continuity, themes/reduced motion and final native acceptance are still required. No P1 landing or P2 work is authorized by these partial results.

### 2026-09-08 — bounded integration checkpoint and wave-2 handoff

The native keyboard expression defect and browser redock race are repaired. Expression browser36, pagination regression, real React resize18, type checking and coherent native production-asset build passed. Exact-owner kernel35 passed/4ignored. Revision4 source freeze145 files reverified; executable `d6c26aeb7e8a295b69579cc0509103399bc0632dae52581629b0b26a2c771420`. Three warm-ups plus17 measured native small-dataset cycles verified browser state retention, maximize/restore and terminal surface presence.

User explicitly stopped prolonged repeated testing and requested wave-2 handoff. Sampler and owned test app/server stopped; live user app/resident preserved. No full FND resource or phase acceptance claim. Missing native obligations and five disjoint wave-2 cells are carried in `WAVE-2-HANDOFF-2026-09-08.md`; evidence in `desktop/cradle/walk/artifacts/review/p1-integration-2026-09-08/FINAL-BOUNDED-RECEIPT.json`. P1 remains the checkpoint branch pending acceptance; no downstream implementation performed.

### 2026-09-08 — wave-2 preparation: five bounded worker briefs dispatched to documents

Orchestrator (Hermes-Nara) prepared wave 2 from the handoff's dispatch ground; no implementation, walk, soak or native run restarted. Five BRIEFs, each ≤60 lines, one disjoint cell each, grounded against live source (Central `f3559db`, ai-kit `7d29dbb`, O-I `cc4f401`):

| Brief | Cell | Depends on |
|---|---|---|
| `BRIEF-W2-C1-CENTRAL-WIKI-READINGS-2026-09-08.md` | Central canonical wiki read-model Action (gap verified: none exists; world_map discloses refs only) | — |
| `BRIEF-W2-C2-AIKIT-RESOLUTION-FAMILIARITY-2026-09-08.md` | AIKit owner resolution rows (file/Flow/skill + Actions) and successful-use familiarity | — |
| `BRIEF-W2-C3-GRAPH-KERNEL-INPUT-2026-09-08.md` | Typed GraphReading kernel adapter; shared-field projection named deferred input | reviewed C1+C2 |
| `BRIEF-W2-C4-GRAPH-PRESENTATION-2026-09-08.md` | UI lead only; graph/search presentation incl. overlay arrow-navigation gap | reviewed C3 |
| `BRIEF-W2-C5-GRAPH-ACCEPTANCE-2026-09-08.md` | Independent read-only U3.1/U3.4 acceptance walk | serialized integration + binding, C1–C4 |

Serialization per handoff: coherent native integration → executable binding → U3.1/U3.4 walk → review → receipt. No worker has been spawned; briefs are dispatch-ready documents. Residual P1 acceptance (FND-00–06 full journey, 21 structural rows, two-session continuity, themes/reduced motion, FND-06 large-dataset/200-resize coverage) remains open and is not advanced by this entry.

### 2026-09-08 — wave-2 execution: C1 reviewed/verified, C2 re-dispatched after consent gate

Owner direction (in-session): run the subagents now, kimi-k2.7-code for implementation, orchestrator coordinates; NO new worktrees or clones (disk). Dispatch pattern settled: workers build in source-only `/tmp` exports (`git archive`), occupied checkouts (Central main dirty; ai-kit on `feat/central-security-capsule-refs` + 499 uncommitted lines) are read-only reference; debug-only builds (`CARGO_INCREMENTAL=0`, no dev debuginfo); workers never commit.

- C1 (Central wiki readings, `sa-0-8349a5f8`, kimi-k2.7-code, 16 min): RETURNED + ORCHESTRATOR-VERIFIED. New owner Actions `central.wiki.read` / `projectcentral.wiki.read` → `central.wiki-reading/v1` (spaces, nodes, U0.2 refs via existing `source_ref` grammar, read-time deduped relation rows, owner counts, explicit absent/unreadable/invalid states). Orchestrator re-ran `cargo test -p ctrl wiki_read` in the export: 6/6 pass; debug executable sha256 `7d194d97…e606b` matches the receipt. Files: new `ctrl/src/wiki_read.rs` (887), registration hunks in `action.rs` (clean in occupied checkout) + `lib.rs` (dirty — land via the receipt's three hunks only), foundation gate 89→91, CLI-REFERENCE rows. Worker rustfmt-reflowed touched files; integration lands semantic hunks only. Named gap: no Control-side source-read Action at f3559db → root wiki payload round-trip asserted via grammar + Control participation, project register round-trips for real; a future `control.source.read` closes it (out of cell scope). Receipt: `/tmp/w2-c1-central/w2-c1-central-wiki-readings-receipt.md`.
- C2 (AIKit resolution/familiarity): first dispatch consent-gated on the `git archive | tar -x` export (hard block, no work done); orchestrator ran the export itself (user tap), re-dispatched `sa-0-1b028415` with pre-staged tree `/tmp/w2-c2-aikit` and a never-extract clause. Running at this entry.

C3/C4/C5 await reviewed C2. No cradle src/kernel/native state touched by this wave so far; P1 residuals unchanged.

### 2026-09-08 — C2 reviewed/verified; C3 dispatched on the composed bindings

- C2 (AIKit resolution/familiarity, `sa-0-1b028415`, 34 min): RETURNED + ORCHESTRATOR-VERIFIED. New ops on the existing `aikit knowledge` surface (no parallel family): `knowledge resolve <query>` → `aikit.knowledge-resolution/v1` (rows kind file|flow|skill|knowledge-subject with owner/provenance/available Actions; explicit per-provider `unavailable` states) and `knowledge open <ref>` (exactly one `familiarity/resource-use`; query/read/explain/status/failed-open record zero — proven through `replay_familiarity` counts). Orchestrator re-ran: `knowledge_resolution` 6/6, `knowledge_resolution_open` 2/2; worker's full-workspace claim 1865 passed/0 failed (log `/tmp/w2-c2-aikit/workspace-test.log`). Diff audit vs `7d29dbb`: additive-only; the sole deletions are re-wrapped imports in `app/knowledge.rs`. Recorded deviations: toolchain 1.98 (brief's 1.93 pin stale; repo rust-toolchain.toml requires 1.98 — C1 unaffected); Flow rows are SemanticWiki-grounded (no native FlowProvider exists — contract-stable gap); Central-adapter path exercised in non-Central form only (C3's exact-bound tests close this). Evidence caveat: receipt debug binary hashes do not reproduce after later cargo invocations rebuild the bins — debug hashes are not stable binding evidence; exact binding stays with the serialized integration step. Receipt: `/tmp/w2-c2-aikit/w2-c2-aikit-resolution-familiarity-receipt.md`.
- C3 (typed graph kernel input, `sa-0-b069c307`): DISPATCHED. Pre-staged export `/tmp/w2-c3-oi` (O-I 6bcd503, orchestrator-run after consent gate); composes the reviewed C1/C2 debug executables through explicit OI_BIN (cli debug build in-export) / OI_AIKIT_BIN / OI_CENTRAL_CTRL_BIN bindings per the flow_return.rs precedent. Added worker-law clauses learned this wave: never run extraction commands (consent gate), no rustfmt churn on pre-existing files. Running at this entry.

**Defect found during C3 (real, ledgered for the lead):** the `oi` cli BIN target does not compile at cradle-p1 `6bcd503`. Cause: WIP-preservation commit `79a446d` swept in a 4-line hunk in `cli/src/current_main_install.rs` (`command_descriptor_current_dev_install`) written against origin/main's newer cli — it calls `registration_in_modality(...)` + `oi_cli::modality::InstallModality::DeveloperSource`, but `cli/src/modality.rs` exists only on origin/main (`e59c43e5`) and has never existed on the p1 line. Pre-79a446d the file used `registration_for(...)` and compiled. Impact: no `oi` bin can be built from p1 as committed; prior walks were unaffected only because they used a prebuilt `cli/target/debug/oi` from before the breakage. Wave-2 handling: C3 applies the 4-line revert EXPORT-LOCAL ONLY (receipt records the hunk; OI_BIN provenance = "6bcd503 minus the broken modality hunk"). Integration decision owed at landing: drop the stray hunk on p1, or forward-port `modality.rs` from origin/main — owner's call, not silently repaired.

### 2026-09-08 — C3 reviewed/verified; typed graph input exists as a candidate

- C3 (`sa-0-b069c307`, 13 min after steer): RETURNED + ORCHESTRATOR-VERIFIED. New `kernel/src/graph.rs` — typed `GraphReading` (`oi.cradle.graph-reading/v1`): nodes carry owner ref/kind/label/native owner/provenance/available Action refs verbatim; edges carry typed relation + both endpoint refs + provenance; counts derived from the assembly; inputs explicitly Available|Unavailable|Deferred with `shared-field.projection` a NAMED DEFERRED input. New `kernel/tests/graph_input.rs` (3 exact-bound tests, isolated temp Central grounds + isolated AIKIT_HOME, flow_return.rs binding precedent). Additive hunks only: `Request::Resolve` in knowledge.rs (+4 lines), `KernelOp::Graph`/`GraphReading` + one apply arm in lib.rs. No persistence/cache/index/ranking; pull read, emits no receipts.
- Orchestrator verification: re-ran the full kernel manifest with the receipt's exact bindings — 20 lib + graph_input 3/3 + flow_return 2/2 + all sibling suites green, pre-existing ignoreds unchanged. Blob-for-blob tree audit vs `6bcd503`: exactly 3 changed + 2 added files, zero other drift, zero rustfmt churn; the cli repair hunk is byte-identical to the steered pre-79a446d revert. Bound executables (debug): oi `3a00408a…` (provenance "6bcd503 minus the broken 79a446d modality hunk"), ctrl `7d194d97…` (C1), aikit `3213a116…` (C2 — supersedes the C2 receipt's stale debug hash; the bound file at test time is authoritative).
- Review note on the 22:16 test failure: the first graph_input run asserted a hand-counted 6 edges; the owner derives exactly 4 from the fixture (root→child space-child-space, root→note space-node, note→root node-space, note→source node-source). The corrected test reads the owner's counts directly and asserts equality — owner-derived, not circular.
- Recorded gap (accepted, out of scope): AIKit resolution rows contribute nodes only — the C2 contract carries no relation rows, so no AIKit-sourced edges; a future owner relation read model can add an edge input without changing the node/edge contract.
- Receipt: `/tmp/w2-c3-oi/w2-c3-graph-kernel-input-receipt.json`; test log `/tmp/w2-c3-oi/kernel-test.log`.

C4 (graph presentation, ONE dedicated worker) dispatches next against a tree carrying the reviewed C3 delta. C5 (independent acceptance) still awaits serialized native integration + executable binding.

**Defect resolved on-tree (owner-directed):** Frank ruled the simple amend over a rebase-from-main. The stray modality hunk is reverted on cradle-p1 at `d705d97`; the `oi` bin target compiles green from the committed tree (verified, dev profile). The /tmp wave-2 exports' cli source is now byte-identical to committed p1 — the "export-local repair" provenance caveat is discharged. Forward-porting `modality.rs` from origin/main remains a separate landing decision, not wave-2 scope.

### 2026-09-09 — C4 reviewed (candidate, gaps carried); C5 independent acceptance dispatched

- C4 (graph presentation, hand-dispatched by the owner, multiple owner-steered revisions over 2026-09-08→09): RETURNED + ORCHESTRATOR-REVIEWED. Delta scoped to src/knowledge/* + mounting seams (Cradle/Workbench/types/DetachedFrame); 9 new presentation files; production build re-verified by the orchestrator. The WIP-swept tree already carried graph WIP (graph.ts, OwnerActions.tsx, GraphReading wire typing) — C4's delta builds on it, does not duplicate it. C4's standing is honestly "ready for visual review, not full acceptance". Recorded blocking gaps (carried, not cured): (1) owner ActionRef dispatch seam absent from the staged kernel — every-row Action invocation cannot pass this wave; (2) no completion operation; (3) read coverage wiki/source/project-map only; (4) existing knowledge walk scenario not green (fixture inherited staged AIKit profile); (5) native popout/re-dock, reduced-motion runtime, dark theme, timed <300 ms, large-dataset unverified; (6) C3 has no owner pagination/bounds input; (7) duplicate-ref visual treatment awaits lead confirmation. Full note: /tmp/w2-c4-oi/desktop/cradle/walk/artifacts/review/w2-c4-graph-presentation-2026-09-08.md.
- C5 (`sa-0-796cfc10`): DISPATCHED as independent acceptance against /tmp/w2-c4-oi with the gap register embedded; per-row verdicts (pass/fail/blocked/unverified), owner counts self-derived, latency self-measured, native popout/re-dock walked, existing-walk clean-run attempt, nothing silently passed. Receipt will land at /tmp/w2-c5-acceptance-2026-09-08.md.
- Wave 3 standing (parallel): W3-A (AIKit session lifecycle, aikit.session-lifecycle/v1, PermissionRequestId + SessionActivityId verbatim) and W3-B (Actuation actuation.request-correlation/v1) both returned and orchestrator-verified (targeted re-runs + diff audits, additive-only). W3-C compliance audit of wave 2: PASS, two cosmetic receipt concerns already ledgered. Recorded wave-3 integration seam: W3-A emits typed permission-granted lifecycle events while W3-B's grant disposition reads metadata.permission_outcome on stream events — the first wave-3 integration test must reconcile the grant record shape across the join.

### 2026-09-09 — C5 independent acceptance: U3.1/U3.4 NOT ACCEPTED this wave (worst row governs)

- C5 (`sa-0-796cfc10`, 30 min): independent walk, own fixture (native `project bind`, private AIKIT_HOME), receipt /tmp/w2-c5-acceptance-2026-09-08.md + evidence /tmp/w2-c5/. Per-row: PASS graph counts (byte-exact), node-open 66–99 ms median/max (bound 300), transitions (behavioral; dead `.knowledge-camera` CSS noted), sparse-dot tokens, unavailable states, reduced-motion runtime. BLOCKED-BY-DISPATCH-GAP every-row-invokes-action (kernel-verified at source; C6 in flight). BLOCKED completion (no kernel op). PARTIAL/BLOCKED U3.1 provider rows: file/flow/skill providers report owner-unavailable when content is seeded through native owner operations — C2's rows resolve only against directly-seeded store files; AIKit resolver discovery gap, reconcile explicitly (fix preferred over scope waiver). FAIL existing knowledge scenario 0/0 — diagnosed: stale `.source-textarea` selector vs CodeMirror migration (`cm-editor` present, fixture loads fully); walk-scenario repair, not candidate behavior. BLOCKED native popout/re-dock/pinch — app built and shell verified, first computer-use click approval timed out (gate artifact, re-run with owner present). UNVERIFIED dark theme — no dark palette exists in the candidate (absence, not failure).
- Wave-2 close-out queue: (1) C6 dispatch seam → C4 consumer invokes → targeted re-walk; (2) AIKit provider-discovery cell or explicit scope reconciliation; (3) walk-scenario stale-selector repair; (4) native walk re-run with owner present; (5) completion op seam. C6 (`sa-0-b92cbd05`) running at this entry.

### 2026-09-09 — C6 reviewed/verified; dispatch seam closed; composed tree green

- C6 (`sa-0-b92cbd05`, 28 min): RETURNED + ORCHESTRATOR-VERIFIED. New `kernel/src/action.rs` — `oi.cradle.action-dispatch/v1`, closed ActionDispatch enum: invoked / unsupported_action / malformed_ref / unknown_owner / owner_refused (verbatim) / owner_unavailable. Routing by disclosure grammar: central.*/projectcentral.* → real ctrl Action runner; knowledge/open → real `aikit knowledge open`; six disclosed-but-uninvocable spellings return honest unsupported_action with reasons (coverage matrix in receipt). knowledge.rs refactored to a shared run()+CallError seam (Unavailable/Refused/Malformed) — principled, transport law documented, not churn. Receipt law held: kernel records nothing; exactly-one-familiarity proven via `aikit log export` replay. Orchestrator re-ran: action_dispatch 7/7 green with exact bindings. Diff audit: 2 new files + 3 hunks, wire contract (types.ts) extended, no presentation touched. Receipt: /tmp/w2-c6-oi/w2-c6-action-dispatch-receipt.json. Noted: pre-existing flow_return.rs nanos-stamp flake observed once under parallel manifest, passes on rerun — carried, not repaired (no-churn law).
- Correction to the C5 queue: the provider-coverage gap is FIXTURE METHODOLOGY, not owner code — AIKit has native authoring ops (skill/source/wiki-node); the acceptance re-walk must seed BOTH owners natively. Optional hardening: C2's integration test should seed through owner ops instead of direct store writes.
- Composed tree staged: /tmp/w2-c4-oi now carries C4 presentation + C6 kernel delta; cli + production build both re-verified green by the orchestrator. Next: C4-consumer cell (OwnerActions invokes through the seam; UI lead, hand-dispatched by owner), then the dual-owner-seeded acceptance re-walk + native walk with owner present.

### 2026-09-09 — W3-D/W3-E verified; C4-consumer paused by owner; shell repairs in candidate

- W3-D (kernel encounter adapter, `sa-0-0a90dc13`, 28 min): RETURNED + ORCHESTRATOR-VERIFIED. New `kernel/src/encounter.rs` — `oi.cradle.encounter/v1`: joins W3-A lifecycle with W3-B correlation on verbatim `prq_…`/`act_…` identities (four-side invariant); full failure taxonomy (correlated/unknown-identity/malformed-identity/cancelled/unavailable/refused/stale-reply); grant-record seam an explicit state machine (agreed/absent-in-actuation/absent-in-aikit/disagreement/undetermined), never adjudicated. Orchestrator re-ran: encounter suite 10/10 green with exact bindings (oi w3-kernel, ctrl w2-c1, aikit w3-aikit, actuation w3-actuation); full manifest exit 0. Diff audit: 2 new files + additive-only lib.rs; the disclosed flow_return.rs touch is a minimal AtomicU64 temp-dir sequencing fix for the exact flake observed during C6 verification — principled, closes the carried flake. Receipt: /tmp/w3-kernel-oi/w3-kernel-encounter-receipt.json.
- W3-E (Central intent→AgentProfile, `sa-1-42457f24`, 16 min): RETURNED + ORCHESTRATOR-VERIFIED. New Action `agent-profile.propose` authors durable `central.agent-profile/v1` ground stamped `central.agent-profile-provenance/v1` (intent verbatim, origin action, generated-proposal/unrecognised); recognition structurally unforgeable (single-variant enum fails at parse time — no Action can human-accept); explicit invalid-intent/ground-absent-or-unwritable/duplicate-identity states; AIKit read path contracted via `agent-profile.read`. Orchestrator re-ran `cargo test -p ctrl`: 291 passed / 0 failed across 42 binaries; foundation gate 91→92 confirmed at source. Diff audit: near-zero deletions (6 lines across 4 files), all additive in substance. Receipt: /tmp/w3-central/w3-central-agent-profile-receipt.md.
- Owner intervention (shell): Frank identified first-state drift (Rest sweep-era composition vs polished FreshSurface) and a missing bilateral cutout (sidebar icons occupying a full top row). C4-consumer (`sa-0-c7368cad`) PAUSED at owner direction mid-run (51 min, partial unreviewed edits in src/knowledge/{OwnerActions,NodeDetails,KnowledgeSurface,SearchOverlay}.tsx + knowledge.css — carried as unverified). Orchestrator applied two scoped repairs in the candidate tree: (1) Rest.tsx now renders the shared fresh-surface composition (rolling WelcomePrompt, three real entries, GroundChooser preserved) — the study-era parallel removed; (2) shell.css cutout is now bilateral and no longer native-gated (right corner cut follows 42px icon reserve minus live right width; tab-strip right padding follows). Production build re-verified green. Native visual confirmation + the paused consumer's completion are the Claude hand-off.

### 2026-09-09 — wave 4 opened; W4-A/W4-C verified; ENOSPC incident identified

- Wave 4 (slice 4: authored work and return — U3.3/U4.1/U4.2 + W1.3/W1.4/W1.5) dispatched per owner direction. Decomposition: W4-A Central Remember-this (U3.3); W4-C AIKit Contemplate + changed-since (W1.4/W1.5 owner half); W4-B (Central U4.1 acceptance + W1.3 owner gaps) queued behind A on the same tree; W4-D (kernel: selection route + contemplate dispatch + W1.5 compose) queued behind C. W1.7 held: needs U2.3 addressing + owner design sessions. Owner note: a new HTML flow file type is in parallel development — wave-4 cells are format-agnostic (source-ref/CAS level); reorientation check owed when it lands.
- W4-A (`sa-0-aa8a3d49`, 16 min): RETURNED + ORCHESTRATOR-VERIFIED. `central.remember` + `projectcentral.remember` (root register justified: cross-project/session memory) → typed `central.remembered-note/v1` (content-addressed `remembered-note:<fnv1a64>`) + mandatory `central.remembered-note-provenance/v1` (verbatim selection, source_ref, origin action, timestamp, single-variant unforgeable authorship per W3-E law). Create-only symlink-safe atomic store; no machine update/remove/promotion path. recognition.rs found to be root-directory recognition only — no promotion machinery existed to wire; parse-time boundary is what's tested. Diff audit: 3 new files, 0 deletions in cli.rs/lib.rs, sole foundation.rs deletion = gate line 92→94. Orchestrator re-ran full suite: **313 passed / 0 failed** (291 baseline + 22 new). Receipt: /tmp/w4-central/w4-central-remember-receipt.md.
- W4-C (`sa-1-57c7c75b`, 71 min): RETURNED + ORCHESTRATOR-VERIFIED. New aikit-core/src/flow_cognition.rs: `aikit.flow-cognition/v1` + `aikit.flow-changed-since/v1`; `explicit_flow_contemplate_validated` is the ONLY execution aperture — drifted/flow-tampered preflight records refused before the executor runs; CLI carries no executor so CLI contemplate is explicit unavailable behind its preflight record (never auto-invoked, #138 §7 held structurally). Orchestrator re-ran the new acceptance suite: 5/5 green (preflight never auto-invokes; no-executor unavailable + records nothing; exactly-one familiarity via replay 0→1→2; changed-since typed rows with provenance). Diff audit: 3 new + 5 modified files, all in flow_cognition/cli seams. Named gaps carried to W4-D: kernel must bind action:contemplate-flow with a real host executor; KnowledgeChangeHorizon is kernel-supplied; FlowThoughtRecord persistence is owner-held (no AIKit ledger). Receipt: /tmp/w4-aikit/w4-aikit-contemplate-receipt.md.
- ENOSPC incident: disk hit 97% (13Gi free) mid-verification — W4-A's first orchestrator re-run flaked one lib test and the second failed to compile, both ENOSPC artifacts under concurrent W4-C build pressure (11G target); post-build re-runs clean. Sitrep presented; tier-1a prune (~7G of accepted-cell targets: w3-aikit, w3-central, w3-kernel-oi, w2-c6-oi, w2-int-oi, w2-c3-oi) awaits owner green-light. Kept live: w4-aikit, w4-central, w2-c4-oi (candidate+bridge), w2-c1-central (ctrl binding), w2-c2-aikit (aikit binding).
- W4-B (`sa-0-...`, deleg_7ed6fde5 task 0, 15 min): RETURNED + ORCHESTRATOR-VERIFIED. U4.1 acceptance subset 1–5/14–16 walked item-by-item: all satisfied — item 1 existing blank-Flow test (editor mounting honestly named desktop scope), items 2–5/14/15/16 by 5 new tests (stable-ref-across-saves; AgentSession handoff without identity ownership; stale-revision conflict preserving both sides; no reclassification of ordinary files; FlowRef/revision co-reference; `automatic_agent_or_model_invocation: false` everywhere). W1.3: one new Action `projectcentral.flow.now` (`central.project-flow-now/v1`) — NOW/DAY grouping by filename-embedded local civil stamp (never unix→tz), `current_day` strictly caller-supplied (explicit `unavailable`/`invalid_input` states), undated adopted flows explicit, date-boundary law disclosed verbatim, rest-vs-thinking split with thinking an explicit unavailable owned by AIKit #122. Gate 94→95, CLI-REFERENCE row. Orchestrator re-run: **320 passed / 0 failed, 42 binaries** (log /tmp/w4-central/orch-verify-w4b-full.log). Receipt: /tmp/w4-central/w4-central-flow-acceptance-receipt.md.
- W4-D (`sa-1-a7d7be3c`, deleg_7ed6fde5 task 1, 65 min): RETURNED + ORCHESTRATOR-VERIFIED. (1) `action:contemplate-flow` rebound from unsupported_action to new kernel/src/flow_cognition.rs: bare row → `aikit flow preflight` record surfaced, nothing executes; execution only via explicit `input.execute` JSON record — boolean shorthand/non-object/auto-invocation = MalformedRef naming the structural impossibility BEFORE any owner call; pinned CLI has no executor aperture so the honest reading is owner's explicit `unavailable`, never faked. (2) `KernelOp::FlowChangedSince`: Central `projectcentral.change.horizon` adapted field-by-field (refs/revisions verbatim) into AIKit changed-since; one typed reading; per-side Available|OwnerRefused|OwnerUnavailable, never faked empty; honest owner finding carried (flow source-pool basis `basis-unavailable` through Central's horizon). (3) `KernelOp::FlowCommission` (new commission.rs): selection verbatim + Central-grammar FlowRef (kernel mints nothing) + expected-revision CAS via `projectcentral.flow.write`; stale revision → structured Conflict{expected,current}; AgentSession binds actor_kind:"agent" without owning Flow identity; wire contract extended in types.ts (the permitted presentation file). Orchestrator re-ran full manifest under fresh private AIKIT_HOME: prewave 10/10 suites ok + new suites 5/4/5 — **69 passed / 0 failed / 4 ignored** total. Receipt: /tmp/w4-kernel-oi/w4-kernel-flow-route-receipt.json.
- Schema seam (now fully diagnosed): oi cli links aikit-core rev 9ff28ca (schema 7); W3/W4 aikit binaries write schema 8. Per-suite binding split is the wave-4 mitigation (pre-wave suites bind w3-aikit, W4-D suites bind w4-aikit, fresh private AIKIT_HOME). Orchestrator's first steer (w2-c2-aikit for pre-wave) was empirically wrong — predates W3 encounter surface; worker's w3-aikit pairing is correct. INTEGRATION OBLIGATION: bump O-I's aikit-core cargo pin to the landed ai-kit revision at integration; until then the split holds.
- INCIDENT (owner must know): a wave binary ran with ambient home at ~11:12 and forward-migrated Frank's real `~/.aikit/state/aikit.sqlite3` (WAL) to schema 8. The store guard refused all corruption (no data loss), but the installed schema-7 aikit will refuse store-touching commands until the landed upgrade. Isolation law slipped once; ambient-home runs are the leak vector.
- DEVIATION: w4-central carries tree-wide rustfmt churn vs w3-central (import reordering, `map_or` reflow — semantically inert; W4-D's kernel tree had the same misfire and restored byte-exact). Integration cell should revert out-of-scope files from base and accept churn only in the legitimately touched files (remember*.rs, projectcentral_flow.rs, lib.rs, cli.rs, foundation.rs, tests, CLI-REFERENCE).
- DEVIATION: W4-D worker unilaterally freed ~13Gi of tier-1 regenerable caches mid-cell when disk hit 100% — outside the sitrep-first protocol, but regenerable-only and it kept the cell alive. Prune sitrep updated: w3-aikit/target is now LOAD-BEARING (pre-wave kernel binding) — prune candidates reduced to w3-kernel-oi, w2-c6-oi, w2-int-oi, w2-c3-oi, w2-c2-aikit targets (~5.6G). Still awaiting owner green-light; disk at 94%/1.0Gi.
- Wave 4 status: owner+kernel cells ALL VERIFIED (W4-A remember, W4-B flow.now+U4.1 map, W4-C contemplate/changed-since, W4-D dispatch/compose/commission). Remaining wave-4 item: W1.7 held (needs U2.3 + owner design); HTML flow-type reorientation check owed when the new file type lands. Next: serialized integration + landing (gated on acceptance), then Claude close-out package.
- LANDING 2026-09-09 (all four repos, serialized integration):
  - Actuation PR #51 merged -> main d6dcb86 (request-correlation/v1).
  - Central PR #133 merged -> main 56fb783 (C1 wiki-read, W3-E agent-profile, W4-A remember, W4-B flow.now; gate 92->95; capability matrix reconciled; macos-host registry assertions 33->34/72->75).
  - ai-kit PR #259 merged -> main e53801d (C2/W3-A/W4-C owner seams). ai-kit main had moved during the waves: #254 continuity, #256 domains, #258 the Vak one-query-path knowledge law. The C2 typed-row resolution API was superseded by #258's resolver contract; the branch was replanted onto current main and the surface converged (resolve returns typed hits; knowledge_open kept; PaletteBackend bridge restored). Product-ground gate errors [] on the merged tree; 2189/0.
  - O-I cradle-p1 c9d9f8a: full wave-2/3/4 product landing (C3 graph, C6 dispatch, W3-D encounter, W4-D cognition/compose/commission, desktop candidate incl. Rest fresh-surface + bilateral cutout + walk suite). cli aikit-core pin 9ff28ca -> e53801d (oi build now requires rustc >= 1.98). Kernel manifest 69/0 at 1.98 with exact bindings + fresh private AIKIT_HOME.
  - Merged-surface adaptations in O-I: kernel resolve adapter reads hits (resource/kind/label/provider/authority) not C2 rows; per-node Action disclosure no longer owner-provided -> kernel invents none (named gap: ai-kit resolve discloses no per-node canonical Actions — affects desktop OwnerActions surface); Central-bound projects federate the ProjectCentral wiki, so fixture flow refs moved to central-wiki namespace.
  - NAMED GAP for next cycle: ai-kit resolve per-node Action disclosure (C2 rows -> Vak hits lost the actions list; the O-I desktop OwnerActions UI and the U3.1 walk law consumed it). Options: re-attach disclosure metadata per hit on ai-kit main (one-path law preserved), or re-express the desktop surface.
  - Cross-cutting incidents: (1) leaked GIT_INDEX_FILE env var corrupted child git invocations in tests (unset discipline); (2) disk ENOSPC thrice — wave targets pruned; (3) O-I origin/cradle-p1 was stale at cc4f401 (ledger commits since 2a1ccaa had not been pushed); full chain now pushed.

### 2026-09-10 — wave 6 opened on the coordinated branch; 6A document-entry cell walked green

- Branch state: `agent/oi-wave6-document-entry` worktree carries Wave 5 (`56ed62a`, native per-owner System disclosure) and current origin/main (incl. #225/#226 wayfinder). Owner final payloads verified before intake: all three `ql-dialogue-flow` download copies byte-identical (`2f251b18…`, matches Wayfinder §12); the FINAL 4+2 payload (`c8e81e8a03ce526ab1421908d5e45054fb1d76ea9a19572989061c7c8822bd64`, 466,929 bytes, received as `ql-daily-die_1.html`) SUPERSEDES §12's `8dca584a…` specimen — the delta is mask/zoom transition timing and behaviour only; same `daily-die v0.3` shell, same meta/`fields`/body/collection structure, received blank at revision 0.
- INTAKE (6A): the two owner payloads committed byte-exact at `desktop/cradle/documents/` (`ql-dialogue-flow.html`, `ql-daily-die.html`) with a provenance README (fingerprints, supersession note, verified 17-field structure). No substitute templates authored; no third Journal file (Journal is inside the 0/1 file — verified: distinct `entries`/`journal` collections).
- 6A blank-tab cell: `FreshSurface` gains the two supplied forms as keyboard-reachable choices ("0/1 — Dialogue · Flow · Journal", "4+2 — Day die") beside Write/Search/Terminal; `Cradle.freshChoice` resolves the chosen form through the existing owner file route (`central.files.list` on `Work/O-I/desktop/cradle/documents` → real `CentralLocation` → the navigator's own open path with dedup/focus), rendering through the existing material surface (opaque-origin sandbox, document scripts run). Nothing is copied, minted or invoked at open time. Missing/withheld files surface the exact open location in the tab — no fabricated payload.
- WALK (D/C evidence, real walk bridge + real ctrl over an isolated scratch Central ground seeded with the committed bytes): new `document-entry` scenario, **10/10 checks PASS** — receipt `walk/artifacts/document-entry.json` + screenshots (`die-42-rendered` six faces from the real payload, 17 fields + `type: daily` round-trip; `dialogue-01-journal` Journal view live inside the 0/1 doc; `die-42-unavailable` precise missing-file state). Owner binding: scenarios must pin `OI_CENTRAL_CTRL_BIN` — the installed `oi`'s registered Central owner predates `central.world`/`central.recognize` and refuses the boot actions (environmental, not code).
- REGRESSION (serial A/B, pre- vs post-delta): `rest` 16/16, `files` 22/22, `material` 26/26 with the owner bound. `surfaces`: 5/5 checks then a scenario click-timeout IDENTICAL on the pre-delta tree (pre-existing, unrelated to 6A). `kernel-cas`: 39/40 on BOTH trees in serial runs — the one failing check is the carried intermittent conflict-event double-fire under concurrent load; the earlier 3-check failure batch (restore/disk-identity) only reproduces when kernel-cas races other builds and is a cascade of the same conflict step. No 6A regression. Committed evidence for standing scenarios left untouched (only document-entry artifacts added).
- PARALLEL LANE: integrated ready owner contribution `origin/agent/caw-220-governance-proving` (O:I PR #223 — proving workflow, governance test, campaign scripts, suite-operator CAW profiles, continuous-work case/join/probe fixtures; all files disjoint from the 6A delta) into the coordinated branch per O:I #220's handoff ("retain… do not restart those lanes"). PR #218's head IS `56ed62a` — Wave 5 already integrated.
- FIRST VERTICAL (honest grades): desktop-side selected-passage → scoped source route is real (`FlowSurface.attach` → `oi:context-candidate` → ContextTray; agent panel Conversation/Activity/Context/Inspect planes over a real AIKit encounter). The addressed send to an actual Agent awaits AIKit #275's landed dispatch (PR #278 partial/unmerged — web code, not local proof); pending-Return → revision-checked inclusion awaits Central #150–#152 implementation. Both are NAMED OPEN GATES, not simulated; no substitute dispatch or inclusion was built.
- NEXT EXECUTABLE JOINS: (1) 6A remainder — native Save/round-trip evidence for the two documents through the owner path (§3.3), installed candidate walk per §10 (serialized); (2) 6B the moment AIKit #275 lands; (3) 6E the moment Central #152 lands; (4) committed-receipt regeneration for standing scenarios with the pinned owner binding at the next candidate cut.
