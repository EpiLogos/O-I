# DLW plan lane p3 — sources

Lane `zcode:dlw-ontology-p3`, 2026-10-10. Companion to
[DLW-PLAN-p3-ontology.md](DLW-PLAN-p3-ontology.md). Every chapter claim
traces to a row here. Code paths under `src/` are
`/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/src/`;
`cradle/src` is `/Users/admin/Central/worktrees/env-1/o-i/desktop/cradle/src`.

## Commissioned law (the M-Prime documents)

| Source | What it supplied |
|---|---|
| `/Users/admin/Central/Work/Quaternal-Logic/docs/M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md` | D13 verbatim (§0.2); role classification (§1.3); musical/physical/temporal contracts (§2, esp. §2.5 timing law quoted in qlSampleClock); the professional experience (§3.1 "a proper musical working mode, not another app"); the failure-mode table (§0.3); realtime boundary law |
| `/Users/admin/Central/Work/Quaternal-Logic/docs/M-PRIME-PHYSICAL-MUSIC-WORK-PACKETS.md` | Nine packets; I1–I4 shared interfaces; "Transport state never silently overwrites civil Day or geometric clock state" (§9-C); performance persistence law |
| `/Users/admin/Central/Work/Quaternal-Logic/docs/M-PRIME-PHYSICAL-MUSIC-RESEARCH-ACCEPTANCE.md` | T01–T14 discriminating cases; the numerical protocol; retained-occasion context; "not a report that the vendor products … have been exercised" |

## Design documents (new-shell register)

Path prefix: `desktop/cradle/docs/world-shell/`.

| Source | What it supplied |
|---|---|
| `WORLD-SHELL-DESIGN.md` | §1 design law; §2 the tripartite spine; §3.1–3.5 the projections; §4 panes; §5 rack + inhabitants; §6 Central resolved; §7 Factory; §8 Time (Now/Occasion/Transport, two-clock doctrine); §9 operation families; §10 smallest seams; §11 not-do laws; §12 six families + manifest fields; §13 uncarved core; §14 modulation/specification; §15 the five time strata; §16 one family four surfaces; §17 verticals; §18 the musical system; Revision 2 (axes, encounter bar, aperture, view-as, cosmos layers, standing chips, Trail tile); Revision 3 (per-mode arrangements, planet building, Mūlādhāra Earth); Revision 4 (icon selector, split-tree panes, Clip\|Device, dock); Revision 5 (one transport five meanings tables, Live restored) |
| `UI-UX-CONVERGENCE-STUDY.md` | The measured Live basis; `expressionTiming` as authored sequence time; the civil/work-time bridge as `techne:time-axis/v1` work; three levels of disclosure; five-region composition; the add-a-parameter activity; fault table |
| `FUNCTIONAL-CROSSWALK.md` | The 126 targets (lane-2 T1–T25 temporal target set quoted in Chapter C/D); the eight operation families; ghost nodes (lane-1:C1); uncertainty presentation (T3), deep time (T4), relative time (T5) |
| `EXPRESSIONS-ENCOUNTER-SPINE.md` | The spine's selection chain in code; transitions T1–T4; finding 6 "Trail is not built"; R1/R2 rule split; proposed owner rulings |
| `EXPRESSIONS-FEATURE-MAP.md` | The outward-home inventory per internal feature; the sound device row ("after executed native engine/hosting acceptance"); instrument face row |
| `world-shell-mockup.html` | Aperture definitions verbatim (World/Local/Shared/Federated + `worldAdmitted`); view-as fog mechanics (`visibleAs`, fog messages); keyboard map (space=play, 1–4=mode, INPUT guard); Technē Now/Occasion/Walk segment; status bar aperture reading |
| `evidence/musical-family-l9-20261009/ROLE-CLASSIFICATION.md` | The five-role table with track admissions/refusals; D13 in the type; the 7-row mapping table summary; owner-code binding table |
| `evidence/musical-family-l9-20261009/LANE-RETURN.md` | What was admitted vs waiting; the honesty list (manifest projections, host channel, modulation semantics gaps); verification record incl. the sample-clock demonstration; the realtime-gate measurement and refusal |
| `MAP.md` (wayfinder) | Lane inventory; standing laws (port law, aperture law, widget law, musical law); Decisions section (each ruling's citation); "Not yet specified" list |

## Landed code (the seat, branch `agent/o-i-20261007-1639`)

| Source | What it supplied |
|---|---|
| `src/timeline/worldTrackAdapter.ts` | The adapter contract verbatim (columns/tracks/clips/takes; "a take is never a clock and never a Timeline track") |
| `src/timeline/registerWorldTrackAdapters.ts` | The two doors (family door manifest-strict; lane door registration-as-disclosure); the registration inventory; lazy-import law |
| `src/timeline/qlSampleClock.ts` | The seven strata; `QL_CLOCK_MAPPINGS` (7 rows, quoted); measured anchors; declared cadences; `bindToSpine` read-only; policy ports (48000/8192/0.5 s) |
| `src/timeline/timeSpine.ts` | The five strata behaviours; occasion basis/admission split; cron no-synthetic-history; `eventStanding` never-upgrade law; `eventDayKey` |
| `src/timeline/dayTrackAdapter.ts` | Day lanes by stream; undated column first; clip→event index |
| `src/timeline/runTrackAdapter.ts` | Run subject grammar; 12-lane bound with honest overflow |
| `src/timeline/conversationTrackAdapter.ts` | Receipts as clips; 8-space bound |
| `src/timeline/expressionsTrackAdapter.ts` | Scenes as columns; sequence steps as hold+transition spans; property tracks as takes |
| `src/timeline/qlTrackRoles.ts` | `QlSonicRole`; `QL_ROLE_LAWS` verbatim laws; `QL_AUDIO_ROLES`/`QL_PHYSICS_ROLES` |
| `src/timeline/qlAudioTrackAdapter.ts` | u64 sample cursors; rate lock (no implicit resampling); role refusals; `QlPerformanceTake` seed |
| `src/timeline/qlPhysicsTrackAdapter.ts` | Declared span units; visual-only honest labelling |
| `src/projections/worldTimelinePresentation.tsx` | The World cut: standing attributes, now/occasion/transport cursors, week strip with TODAY_BREAK=61, four lenses, honest-absence notes, `groupOfTrackKind` grouping |
| `src/projections/useWorldTemporalReading.ts` | The one temporal read: `temporal_events_read`, 90 s cadence as a declared cron parameter, 7-day window, Now derived from the reading, agency_read for run lanes |
| `src/inhabitants/ql/qlInstrumentReading.ts` | Standing states; identity tuple; u64 cursors; audio receipt schema + rate lock; playback policy; `QL_LAUNCH_CONTRACT` verbatim |
| `src/inhabitants/ql/qlModulationSources.ts` | 12 observables with `generates: false` literal; compile-before-realtime; route/scope grammar; honesty law |
| `src/shell/modeGrammar.ts` | The full five-mode transport grammar (29 slots × 5); Session/Arrangement + Clip/Device meanings; browser categories with cut/waiting states; mode→spine mapping; waitingNote honesty |
| `src/continuity/workspace.tsx` | `ShellMode` (no epi-logos) |
| `cradle/src/workspace/mode.ts` | `WorkspaceMode` incl. 'epi-logos'; curation verbatim; owner ruling 2026-09-18; TREE_MODES/STRIP_MODES |
| `cradle/src/workspace/store.ts` | `WorldRef`, `WorldContext` (world/subject/reading/trail), TRAIL_LIMIT 24, trail law verbatim, per-mode layouts, `switchWorkspaceMode` refusal |
| `cradle/src/workspace/lens.ts` | The Epi-Logos lens header verbatim; EPI_CORPUS_PROJECT |
| `cradle/src/workspace/DesktopShell.tsx` | Footer toggle records verbatim (lines ~405-410) |
| `cradle/src/workspace/left/LeftFrame.tsx` | "Epi-Logos lens is on" chip + "Leave the Epi-Logos lens" (130-132) |
| `cradle/src/workspace/encounter.ts` | EncounterAddress; `encounter()` sole transition; Trail type; `decodeEncounter` query grammar |
| `cradle/src/epilogos/EpiLogosSurface.tsx` | Threshold/doorways verbatim; three compositions; receiving-only Nara panel |
| `cradle/src/epilogos/EpiPlacesNavigator.tsx` | Four family sections; keyboard grammar |
| `cradle/src/epilogos/sources.ts` | EpiFamily; EpiStanding (owner's words verbatim); reading sourceRef/revision; receiving-only adapters |
| `cradle/src/epilogos/places.ts` | Shared open-place store; per-place reading position (localStorage, never sent) |
| `cradle/src/CradleFrame.tsx` | enterEpiWorld/leaveEpiWorld; lens↔world publication; the working trail leave/back incl. `oi:epi-return` passage restoration |
| `cradle/src/workspace/agentBody.ts` | The Epi world's constituted agent persistence |
| `cradle/src/surface/registry.ts` | `epi-logos` in FRAME_DISCLOSED_KINDS |
| `desktop/cradle/kernel/src/temporal_sources.rs` | The five stream adapters (central-now, central-now-thoughts, wiki-returns, kernel-event-log, aikit-history); refusal of automatic readings; time inherited verbatim |

## Contracts and rulings

| Source | What it supplied |
|---|---|
| `/Users/admin/Central/Work/Quaternal-Logic/docs/kernel-rebuild/K8-SKY-CONTRACT.md` | Retained-occasion law: `retained-occasion` purpose, `fresh_current_attested=false`, basis never rewritten, `ql.sky-admission/v1` |
| `/Users/admin/Central/worktrees/env-1/o-i/docs/cradle/10-SIDEBARS.md` | §3.1 lens law verbatim; §6 audit replacement; §7 rulings D2 + amendments A5; lens-over-any-mode row |

## Sessions and registers

| Source | What it supplied |
|---|---|
| Planning session `sess_ac3200ca-b5e7-410e-81ff-4fa5a4c512e2` (ReadSessionContext, two focused queries) | Confirmation of the encounter bar, one-transport-five-meanings, cosmos layers, spine; the naming finding (no "DLW", no "Epi-Logos mode" in the transcript); the mockups as the source of keyboard/aperture detail; C3/L3 widget-guide scope |
| Orchestrator message (2026-10-10) | The owner decisions binding the chapters (spine bar, time locked high, cosmos layers, tracks phrasing, D13 + musical working mode); the naming finding; the pointer to the cradle lens records and the project NOW register |
| `/Users/admin/Central/Work/reverse-engineering/ProjectCentral/now/` | Session traceability register (consulted; no DLW-specific clearing found at read time) |

## What was searched and not found

- No source defines "DLW" as a name (the orchestrator's naming finding;
  consistent with `MAP.md` and the design doc, which never use it).
- No source defines an "Epi-Logos mode" for the new shell's five-mode
  grammar (`SURF_MODES`, `FrameMode`, `ShellMode` all exclude it).
- No source supplies the producing owners for the `essay`/`epii` receiving
  families (adapters disclose `receiving-only` with named owners as words).
- No shell-side trail implementation exists (`EXPRESSIONS-ENCOUNTER-SPINE.md`
  finding 6; confirmed by reading the timeline/inhabitants/shell zones).
