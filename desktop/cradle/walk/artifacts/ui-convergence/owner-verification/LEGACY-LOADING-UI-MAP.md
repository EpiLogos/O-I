# Legacy loading and point-field inventory

Read-only inventory at O:I `2a4f76ab9b9672b25fa9bcc12573d271e2653a17` plus the concurrent, explicitly assigned Stage readiness forwarding. Ground: `docs/cradle/EXPRESSION-FIELD.md`, the 2026-09-14 Expression Field Wayfinder, current design-system desktop language, and the user's new instruction to retire legacy loaders and use the production field for the opening experience. The current desktop language still expressly authorises the old CSS loaders and Canvas2D forms; that dated ruling needs an explicit supersession, not silent reinterpretation.

## Owners and consumers

| Current implementation | Actual consumers | Disposition under the new instruction |
| --- | --- | --- |
| `packages/oi-design-system/loading.mjs` + `point-cloud.css`: SVG-mask mark, procedural CSS dot clusters, independent CSS animations | React `src/shared/Loading.tsx`: 18 callsites in 15 modules below | Retire the decorative marks/clusters and all their animation. Retain truthful, accessible pending text and scope semantics. No renderer is needed for a pending label. |
| `.oi-loading-mark`, mask `assets/oi-mark.svg` | No current production `Loading scope="window"` caller; all actual pane callers replace this mark with clusters. The mark still exists in package exports and `examples/loading.html` | Remove the loader's use of the SVG asset and its reference/check expectations. The brand asset itself is a separate authored identity source, not inherently an obsolete renderer. |
| `.oi-point-cloud` radial-gradient ellipse | One actual production caller: `knowledge/KnowledgeSurface.tsx:112`, heading ornament | Remove this decorative cloud. Keep heading, source identity and KnowledgeExpression control. |
| `packages/oi-design-system/expression.mjs` Canvas2D form/gesture engine | `ExpressionStageProvider` creates it unconditionally, including when master Expression is disabled. Production producers are `ExpressionAnchor` in AgentLayer and resize gestures in `ExpressionProvider` | Replace rendering with the single native EngineSurface through the semantic Stage API. Delete the independent Canvas2D point generator, sprite canvas, drawing loop and overlay probe. |
| `ExpressionAnchor` | `agent/AgentLayer.tsx:121`; real encounter state maps to searching/arrival/listening/presence/idle | Preserve owner state and semantic handles. Idle is a still native formation; only actual active states animate. Do not replace owner evidence with decorative motion. |
| `ExpressionProvider` / `requestResizeExpression` | Root and detached provider trees; keyboard resize callers in DesktopShell and Workbench | Preserve accepted resize meaning and bounds; migrate its held/finite cue to native Stage. Remove the second renderer. |
| `ExpressionLayout` | CradleFrame (the shared ExpressionProvider also wraps DetachedFrame) | Preserve native layout cues and FocusedInstrumentComposition. `oi:expression-intent` is currently emitted for layout/save but has no production listener; only walk observation consumes it. Avoid deleting the instrument mount while removing decorative plumbing. |
| `WelcomeField` + `welcome.css` + `stage/recipes.ts` | CradleFrame only; one `welcome.mark` frontstate presentation | Already a native production field, not SVG. Replace timer-controlled handoff with actual engine readiness/rendered completion. Parent/Welcome agent own this work. |
| `EngineSurface` / native ProductionAdapter | Shared Stage for Welcome, Visuals settings, Expression composition, KnowledgeExpression, FocusedInstrumentComposition, Personal PageExpression and Explore presentation; ShareProjection uses capture | Keep one owner. `forElement` has no remaining production caller after c5418ac0 and can be retired separately. Native `PointCloudField` receives hosted=true: its standalone RAF and window/pointer listeners are guarded off, so these are not a duplicated hosted loop. |

The 18 pending-label callsites are ConfigurationView:118, ProfilesView:78, RememberedList:51, EncounterList:19/20, ExploreSurface:149/164, FileHistory:11, FileSurface:141, FileTree:35/37, UserFlowsList:15, KnowledgeSurface:104, MaterialSurface:185, SourceHistory:31, WorldNavigator:117, GroundChooser:19 and SettingsPage:112 (all under `desktop/cradle/src`). No other native-owner source under `Central/Work` imports the legacy loading/expression renderer APIs; the cross-workspace search excluded dependencies, build outputs, worktrees and agent records. Package examples/checks are the other local consumers.

## Actual running evidence and lifecycle work

`legacy-overlay-sample.mjs/json/log` use the real ExpressionAnchor, real React StrictMode providers and real design-system Canvas2D renderer. Controlled `idle` is a component state, not a fabricated native Agent operation.

- **Expression disabled, idle anchor visible:** 72 window RAF callbacks and 27 Canvas2D draws in 1.201 seconds; 704 points at current density; one connected canvas; native engine absent. Thus master-off and idle both still admit legacy continuous work.
- Anchor removed: 0 RAF/draws over 0.500 seconds. Reduced motion: static anchor, 0 RAF/draws over 0.501 seconds. Cleanup exists; the wrong activity policy remains.
- Source shows a nominal 30Hz paint cap but the Canvas2D scheduler requests intervening RAFs too. Each draw clears the entire window canvas, generates 880×density points per form (704 currently), checks viewport geometry, and cancels/rearms the lease timeout.
- Canvas2D owns one MutationObserver, visibility/media/resize/capture-scroll listeners, one drawing RAF and one expiry timer. The MutationObserver watches class/style, not `data-theme`, so a normal theme change can leave ink stale until another refresh.
- Each mounted Agent anchor adds a 10-second renewal interval, ResizeObserver, IntersectionObserver and visibility listener. Hidden geometry returns without releasing its handle; expiry eventually cleans it. The form generator continuously changes even `idle`.
- Each Loading instance adds an IntersectionObserver and visibility listener solely to toggle three CSS cluster animations. Removing decoration removes this extra per-loader work. Its cleanup emits `surface.ready` on every unmount/relabel; this is a presentation lifecycle fact, not proof of successful native operation.
- Resize expression plumbing adds pointermove/up/cancel/lostcapture, accepted-resize and window-blur listeners, plus bounded (up to 1 second) geometry RAF polling. These are separate from actual drag/resize ownership; preserve resize mechanics while simplifying expression delivery.

## SVG and geometry that are not legacy loading

- `workspace/Glyph.tsx`, WorldNavigator's icon helper, DesktopShell folder icon, SearchOverlay magnifier and KnowledgeSurface focus-release icon are static semantic control icons. They own no RAF, context or timers. Their SVG format is not the defect.
- ExploreSurface's SVG constellation renders actual world/entry/Being refs and relation paths with selection, keyboard activation and labels. This is a native read-model graph representation, not a loading point cloud. Preserve those interactions if later rendering is migrated.
- Knowledge GraphCanvas is a separate 2D *graph* view with selection/pan/zoom and event-driven drawing, not the legacy Expression overlay. Its CSS dotted graph ground is decorative and removable independently of its graph semantics.
- `src/study/Seed.tsx` and WorkspaceStudy contain hardcoded SVG study graphics and prototype graph data. `main.tsx` still admits them via production `?study`, although their chunks load lazily. Retire that production route or gate it to development; preserve an authored reference only if needed, not a live product substitute.
- `assets/oi-mark.svg`, `oi-glyph.svg`, `oi-cube.svg` are copied brand assets. Remove loader coupling; do not silently delete authored identity assets used by the site/native bundle. The current desktop itself has no direct use of these exports beyond the loader CSS.

## Proposed implementation boundary

Keep `ExpressionStageApi.express/update/release` semantic handles. A renderer-free native-cue controller can own the bounded map, state/geometry and expiry; **EngineSurface remains the only canvas, context and simulation scheduler**.

1. Explicit foreground/frontstate/focused `present` has priority. Before admission, suspend/release only the internal cue presentation. Held semantic handles may remain pending; no cue may mutate a foreground or retained lease. On foreground release, eligible current cues can re-enter the same surface.
2. Compile native scene entities/formation glyphs from the current cue name and viewport rect, retaining handle identity across updates. Never copy `formPoints` maths into another drawing path. Transparent native backdrop for cues; full scene backdrop for normal presentations.
3. Static cue state requires **one genuine material/render update, then zero RAF/simulation**, including after geometry/theme updates. Active state admits the existing production clock. Reduced motion forces static. Disabled means no canvas/context, even with retained semantic handles. Hidden-document handling remains native.
4. Needed runtime seam beyond the agreed ready/play/backdrop API: a current-ID-gated `renderOnce(id)` (or equivalent explicit still-presentation operation) that materialises the scene without starting a continuous clock. `setPaused(true)` alone currently suppresses initial materialisation. No retained-field lease should be borrowed to implement this.
5. Cue scene changes must not disturb an active native retained lease. Check K9/Nara re-entry after foreground→cue→foreground; avoid count/reseed churn merely to display a small cue. Actual particle budgets need measurement, not a fabricated replacement field.
6. The Stage ready/play forwarding is separately wired: ready delegates native whenReady with generation checks; play returns native completed/cancelled; `appearance` adds inverse-host; backdrop defaults scene. Welcome must not duplicate native completion with wall-time timers.

## Package/API retirement and portable compatibility

- Keep the pure semantic form-name/gesture vocabulary available at `./expression` if existing typed consumers need it. Retire `createExpressionOverlay`, `formPoints` and the old overlay/ink Canvas2D CSS rather than hide a renderer fallback behind them. All actual local consumers are accounted for above; no external native consumer was found. Update the private package's declared exports/types/examples/checks together.
- Keep `createLoadingIndicator` only as a portable accessible DOM status body if compatibility is useful; remove `createPointClusters`, SVG masking and decorative motion. The React wrapper can become direct semantic JSX with no observers. A loading label must not acquire its own native field.
- Keep `point-cloud.css` only for the production canvas placement/dormancy contract, or move those rules deliberately while preserving its compatibility import. Remove cloud/loader density tokens only after decoupling unrelated Knowledge sizes (`--oi-loading-mark-width`, `--oi-loading-stage-min-height`, `--oi-cloud-field-width`) into actual layout roles.
- Keep native `./expressions-engine/*` exports and portable Expression document/capture/WorldPresentation paths. They are the admitted production engine, unrelated to the retired Canvas2D package facade.
- Replace old reference checks that require animated CSS clusters or a permanent second canvas with real single-engine cue, disabled, idle, hidden, foreground-priority, release, remount, reduced-motion and retained re-entry checks. Update D22/FND-07 desktop-language provenance explicitly under the new owner ruling.

No loading, cue or SVG production source was edited for this inventory. The only concurrent source edits by this agent are the specifically assigned Stage ready/play/backdrop forwarding and the already verified terminal-context regression.
