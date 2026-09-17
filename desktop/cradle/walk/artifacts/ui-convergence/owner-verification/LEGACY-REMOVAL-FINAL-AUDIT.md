# Final read-only renderer and startup audit

Source baseline inspected: O:I `4032740d6bcb16d09a2d9f253fbde2cca9a20f78`, native owner `91db8428fc9dfba06cd258ec5a58e7dd9eef5313`.
The browser probe used an in-memory byte snapshot of the current on-disk WALK build, **not a rebuilt artifact**. `startup-audit-dist-basis.json` records every served asset SHA256; entry is `index-C_xQ95j8.js`. The parent has subsequent source-only import/opening fixes pending final rebuild. This audit does not equate that older build with the latest source commit.

| Area | Actual remaining owner / result |
|---|---|
| Production Expression constructor | `ExpressionStage.tsx` calls `Surface.forWindow` once on its enabled path. `EngineSurface.forElement` remains a native test/adapter construction seam; no production caller uses it. Visuals and other bodies borrow the same stage canvas. |
| Semantic cues | `nativeCues.ts` contains no canvas creation or RAF. It uses native glyph/entities and the admitted Stage field, with foreground and actual retained-lease priority. |
| Legacy renderer exports | No production code or built bundle contains `createExpressionOverlay`, `formPoints`, `createPointClusters`, or the old overlay/cluster/masked-loader classes. Only explicit historical supersession prose retains their names. |
| CSS / SVG loaders | No old cloud/loader masks, grain tokens, cluster keyframes or SVG loading renderer remain. `point-cloud.css` now contains native placement and semantic status layout. |
| Pending operation text | `Loading.tsx` and portable `createLoadingIndicator` render accessible real labels; neither creates a renderer or animation clock. Cleanup no longer claims `surface.ready`. |
| Saved configuration compatibility | `point-cloud/config`, `point-cloud/presets`, and `oi-logo-state.json` are configuration/preferences data, migrated into the native engine. They create no canvas, renderer or timer. |
| Knowledge graph canvas | `knowledge/GraphCanvas.tsx` renders actual graph subjects/relations, with demand-driven geometry/camera updates and active hover travel. This is a real graph surface, not an Expression/loader fork. |
| Remaining SVG | Explore and KnowledgeEncounter render actual projected worlds/typed owner relations with selection and navigation. Glyph/search/folder/focus icons and static personal-page/identity SVGs are not point-cloud loaders. |
| Historical studies | `?study` routes are gated by `import.meta.env.DEV`; their prototype SVG graphs are excluded from the production build. No study chunks or old renderer symbols occur in this built artifact. |
| Other scheduling | Focus restoration and finite pane/resize transitions remain. `useFrameSample` is dev-only. The fresh Flow prompt rotates editorial prompts while visible/focused conditions allow; it is not a loading/progress system. Native BrowserSurface retains a continuous RAF for native child-view geometry and a 200ms focus poll while mounted. Its CPU cost was not measured here; it is outside the retired Expression renderer. |

## Concrete startup findings

### 1. Wrong first ground before opening (reproduced)

The entry JavaScript was held while the real browser loaded the shipped HTML/CSS and painted. No Welcome DOM or canvas existed at that first paint. After allowing the same real entry module, the actual native opening painted the inverse ground:

| Saved appearance | Before entry: actual body ground | Native opening ground after entry |
|---|---|---|
| Light | `rgb(233, 233, 229)` | `rgb(18, 18, 17)` |
| Dark | `rgb(11, 11, 10)` | `rgb(251, 251, 249)` |

First-paint entries were observed (28ms and16ms in this controlled local run). Screenshots `startup-light-entry-delayed.png` / `startup-light-field-ready.png` and corresponding dark images show the visible ground change. These times are observations, not a budget. `startup-readonly-audit.json` preserves the DOM/paint readings.

Minimal owner fix reported to parent: prepaint marks a pending opening using the existing enabled/welcome/default/session/detached rules and uses the existing inverse ground token before entry executes; clear that mark on opening finish/skip/failure. Saved appearance remains unchanged. The parent owns the bootstrap/CSP implementation and final regression.

### 2. Disabled still imports grouped native runtime (reproduced)

Disabled startup created **zero canvases and zero contexts**, but actual network requests loaded `expressions-engine-C1RpZ5Vl.js` (241,059 uncompressed bytes) and `three-DVI_j9-M.js` (746,939 bytes): 987,998 bytes of native/Three JavaScript. Neither the stage `engineSurface` chunk nor `nativeCues` was requested.

Static import analysis corroborated the observed requests: entry has no static engine dependency, but `CradleFrame-NJEzSNXm.js` reaches `engineProjection-BoCzGCCb.js`, the grouped native engine chunk and Three. The broad manual chunk grouping makes eager authoring/projection imports carry the implementation too. The parent found eager `navigateExplore` imports through the ExploreSurface barrel and is changing them to the existing pure navigation helper before the final build. Re-run the exact disabled request probe on that built result to verify the heavy requests disappear.

Probe source: `startup-readonly-audit.mjs`; browser observations: `startup-readonly-audit.json` and `.log`; complete built-asset basis: `startup-audit-dist-basis.json`. It served the local build on4392 with isolated browser profiles, real module/CSS delivery, real native rendering and reduced motion. No native user app, saved preferences, owner configs or source files were mutated. Browsers/server are closed.

No forgotten production legacy renderer was found. The two startup findings above are concrete follow-through, not a reopened design campaign or a claim of #65 lived acceptance.
