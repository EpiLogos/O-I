# UI convergence implementation receipt — 15 September 2026

Standing: implementation and executed evidence. This does not claim O:I #65
human experience acceptance, SF6/EX6 closure, suite installation or harmonisation.

## Basis and integration

| Owner | Starting basis | Returned basis |
|---|---|---|
| O:I accepted main | `5c7582e09f6d84b3e4a7372a73643177025d0e2c` | Reconciled onto `ce82daac8bf35c2c02a3f44f69e9c3afbf59e26e` |
| Recovered Claude UI | `be172a109f2f5e307cc34a8c0f62cfdc6e5825b1` | Continued in `aikit/ui-expression-convergence`; source commit and PR recorded at closure below |
| Factory | `fb854dede9876a0ea008afd62422ef9150fe5203` accepted main, including #237 | `87d8785071b7de1cc73aefbb235fd59e4e43d756`, [PR #238](https://github.com/EpiLogos/Factory/pull/238), unmerged |
| QL/Nara producer | `3a3d7dbcf6a898ce88a9093f858b8f254fff3cfe` | Unchanged; actual native examples produced the retained-field specimen |
| Expression engine | O:I accepted intake `9443f58fa8599f903d6affa61bc6fbed7109f640` | `47c465d78aeb282f95bba65ecfc0dd0cbc476152`, compatible native repair; current-main [PR #5](https://github.com/EpiLogos/Point-Cloud-Demo/pull/5) at `ae32714ec1f24ee894bd54bc2c32ed185d90ad5c`, unmerged |

Source commits remain separated by lifecycle, theme/tokens, shell/footer,
grammar, component migrations, fixtures and native contribution intake.
The current registered worktree is `.aikit/tasks/ui-expression-convergence`,
locked to this active task. Its predecessor worktrees were externally removed
twice; committed source and independent evidence were recovered. See the
[continuation brief](UI-CONVERGENCE-CONTINUATION-2026-09-15.md).

## Actual UI/component map

| Owner/body | Relationships preserved and refined |
|---|---|
| `DesktopShell`, `Workbench`, `DetachedFrame` | Left world/project navigation; central pane tree, tabs, splits, focus and source identity; right contextual Agent plane; reveal footer. Host owns appearance and container grammar. |
| `AgentLayer` / Encounter | Conversation, Activity, Composition, Context and Inspect retain their different sources. Disclosed operations, consent, provider fault, journal and addressed delivery remain owner-backed. |
| `ExpressionView` / shared stage | Document/file identity, scenes/entities, subject binding, presentation, proposals/refinements, pedagogy, share/project and export remain available. The selected entity inspector follows selection; deeper apparatus is disclosed progressively. |
| Knowledge | Real spatial canvas plus accessible subject controls; search, recenter/back/forward, pins/follow, native source/properties/Actions, movable inspector and page promotion. Context controls occupy the remaining area beside the inspector. No new graph store or semantic edges. |
| Factory native `factory-ui` | Build semantic/live/trajectory depths; Candidates, Claims/Evidence, HumanRequests, Agencies, Executions, references; SessionCards, ExecutionTraceExplorer, TraceWaterfall, PhaseDetail and SpanDetail. O:I composes the exact captured body. |
| SharedField / Explore | Existing navigation, presentation/context and owner-return relationships stay intact. Existing controls consume neutral roles. New SF functionality remains with the concurrent SF lanes. |
| Nara / instrument | One retained-field adapter over the same production engine, stable IDs/targets/seeds, native M1–M5 events and independent centres. Heavy instrument bodies load on demand. |

The graph/design reading also preserves planned scope/layer traversal, selected
context and native Action disclosure from current experience maps. Planned
operations do not become invented working controls in this pass.

## Appearance and shared grammar

The owner's explicit **15 September 2026** ruling supersedes the earlier
grey/yellow/green/olive desktop ground. `DESKTOP-LANGUAGE.md` records both the
old ruling and its supersession; no history is silently rewritten.

Neutral light and dark are the two canonical appearances; system resolves to
one of them before paint. Existing theme classes/semantic roles remain. Ink,
hairlines, spacing and type do the work; gold retains its scarce meta-relation
role. Components consume `--oi-*` roles. Factory's owner removed its forced
dark class in #237; no host override is needed for light/dark.

`packages/oi-design-system/desktop.css` supplies contextual headers, tool/action
groups, quiet and icon actions, fields/inputs, selected states, tabs, disclosure,
state/provenance rows, key/value details, notes and sidecars. Agent/shell,
Expression, Knowledge and the Factory host compose these primitives. The
remaining surface-specific styles preserve their native layouts.

Prepaint now handles explicit light/dark, both system appearances, old persisted
preferences, malformed JSON and `null`. The native explicit CSP hash matches
the script, and a browser-enforced policy test rejects altered script bytes.
Tauri also adds computed hashes for packaged assets; the stale configured hash
alone was not proof of a packaged WebView flash.

## Expression lifecycle diagnosis and measurements

The engine retained an active scene after release and continued scheduling on
`active && !paused`. That scene is needed for retained identity, but it is not
evidence of a live presentation. The repaired admission rule checks live or a
bounded release-settle interval; settled release stops drawing/simulation.
Hidden documents cancel their pending frame immediately and resume only eligible
work. Reduced motion produces one still frame per wake.

Provider-level verification also exposed two lifetime defects: a new
presentation inherited a prior presentation's pause, and a stale same-ID handle
could release a replacement after disable/re-enable. New presentation pause is
explicit; handles are bound to their actual presentation record and surface.

Recipe theming now supplies the native palette as well as the canvas background;
otherwise dark welcome ink could remain black. Authored document palettes are
preserved.

The real System/Visuals preview still created a component-level EngineSurface.
Its before-state had three connected canvases. It now acquires and places the
existing window stage: two canvases total, one production WebGL context and
one shared 2D overlay. Config editing, commands, pause/resume, actual PNG capture
and telemetry remain available. Busy ownership refuses explicitly with retry.
Navigation releases the preview; its deliberate reduced-motion override cannot
leak to the next presentation. Real component/provider tests cover all of these,
including disabled/enabled and StrictMode/remount.

The native glyph renderer also selected a raster-order prefix for ordinary
formations: an O allocated 512 particles covered only 4.42% of its height. The
existing normalized full-pool sampling stride now applies to all formations;
the same allocation covers 100% height and all four quadrants. Native tests
exercise 48 actual sampler/runtime cases and reject the old engine. A Linux
font difference invalidated a width cutoff even on the pre-existing normalized
path; the final test compares actual sampled source coordinates across modes,
while retaining height/quadrant checks. Both native bases pass.

O:I consumes the clean compatible native commit through its vendor script;
no generated engine file was hand-edited. The later semantic/schema refresh
from native main remains the separate engine lane. PR #5 carries the same
production fix on current native main; its Linux CI passed.

Same-machine comparison: actual production WALK bundles, real native kernel,
alternating baseline/current/current/baseline, Chromium ANGLE/SwiftShader,
1280×820, two 2.5-second settled samples per revision. The exact source patch,
hashes and native binary digest are in the evidence folder.

| Observation | Baseline main | Repaired runtime |
|---|---:|---:|
| Settled idle RAF callbacks / 2.5 seconds | 150, 150 | 0, 0 |
| Settled renderer CPU | 2.63–2.98% | 0.35–0.53% |
| Active/idle retained production WebGL contexts | 1 / 1 | 1 / 1 |
| Disabled production canvases / contexts | 0 / 0 | 0 / 0 |
| Shared window overlay 2D contexts | 1 | 1 |
| Disabled-startup script transfer | 823,976 bytes | 167,392 bytes |

The current production frame counter stays unchanged at settled idle. An
enabled idle canvas/context is retained; it does no continuous simulation.
The shared overlay likewise stays mounted without continuous work when empty.
StrictMode, three remount cycles, disable/re-enable, re-entry, stale handles,
hidden/visible and two independent browser windows are explicitly tested.

The renderer CPU median was about 84% lower. This is not whole-machine CPU or
physical GPU evidence. Enabled startup varied with shader/cache state, so no
general startup speed improvement is claimed. Unforced-GC heap observations
are recorded, not promoted into a leak proof. One native bridge interval and
two timeouts remain; they are not Expression simulation.

## Footer and implementation cleanup

The old persistent `oi-shell-footer-pinned` state could make hover/focus CSS
irrelevant. The new versioned `oi-shell-footer.v2` preference retires the legacy
key; only an explicit pin action writes the pinned state. Unpinned is the
default. Hovering the tiny bottom edge or focusing its controls reveals the
footer; collapsed content cannot intercept pointer input. Pin/unpin, reload,
ordinary navigation, keyboard focus, reduced motion and narrow widths pass.
One footer rule set replaces overlapping generations, and focus rings remain
visible under normal and forced colours.

Removed dead study/rest/title/toolbelt rules, obsolete SVG graph styles and
animations, duplicate inspector/footer declarations and source-order patches.
Live `.surface-body`, `.source-editor-scroll` and `.source-editor-body` sizing
rules cut during the earlier cleanup were restored and proved by real walks.
Heavy editor, graph, Factory, instrument, terminal, System and study bodies load
on demand; no permanent pane animation was added.

Expression numeric fields use proper labels, invalid-state descriptions,
Enter commit and Escape restore. Conflict recovery stays outside labels and
preserves the native expected-revision boundary. The actual source editor
also used a light-only default syntax palette: Markdown links measured 1.44:1
against the dark ground. Shared `--oi-syntax-*` roles now cover the complete
syntax taxonomy and retain bold, italic, underline and invalid-state semantics.
Measured links are 17.49:1 in light and 16.09:1 in dark; changing appearance
keeps the same editor and selection. Exact already-resolved CodeMirror/Lezer
versions are declared as direct dependencies; no upgrade was introduced.

Knowledge's initial managed
geometry fits the native camera; existing human geometry and automation remain
untouched on refresh.

Factory #238 native-disables Actions when no dispatcher exists and describes
their unavailability. Inspection/depth/trace controls remain usable. O:I removes
the fake request callback and opacity override, passing the exact owner view.
Every captured source file has its native Git SHA/digest in `contribution.json`.

## Fixtures and executed checks

Factory #237 repaired source/read-model parity: three real shared-agency lanes,
null SessionSpace/actual Surface refs, portable-only missing-detail evidence,
and removal of unused duplicate SSSF data/unproduced fields. #238 adds real
component regressions for missing/restored Action dispatch. Assertions were not
weakened or filled with fabricated status.

O:I walks now inspect actual current contracts: Flow's owner HTML append entries
instead of treating its directory as the old text file; actual pane IDs and
focused editor rather than document text/first hidden editor; sibling tab close
controls and the complete current menu, including real destination pane IDs.

| Check | Result |
|---|---|
| Design-system verify | 168 unique roles; 104 CSS sources; all roles resolve; zero raw hex/rgba/hsl colours |
| Design-system browser | 14/14, including keyboard disclosure and forced colours |
| Cradle TypeScript + production/WALK build | Passed; existing large-chunk and mixed Tauri-import warnings retained |
| Expression native projection | 26 round-trip assertions |
| Stage lifecycle | 20 checks; actual WebGL, theme uniforms and hidden cancellation |
| Provider lifecycle | Actual React StrictMode/remount/disable/stale-handle/two-window checks passed |
| Appearance/footer | Explicit/system light/dark, corrupt preferences, persistence migration, keyboard/reduced motion, 1000/760/640 boundaries passed |
| Source editor appearance | Real Markdown/TypeScript, formatting, editing, same editor on theme flip, forced colours; fail-before/pass-after contrast |
| System/Visuals preview | One shared production context, real commands/config/PNG capture, busy refusal/retry, navigation release, disabled/enabled, StrictMode, reduced-motion handover |
| Expression pedagogy | Existing real-kernel browser walk passed unchanged: proposals, correction, conflict drafts and late mutation response |
| Theme CSP | 14 source/built browser cases, including tamper refusal |
| Kernel-backed shell | Welcome 12/12; rest 16/16; recovery 5/5; refinement 37/37; shell recovery 36/36; surfaces 28/28 |
| Kernel-backed rich surfaces | Agency 20/20; Factory development 16/16; Expression controls 14/14; Knowledge 22/22 |
| Knowledge preservation/geometry | 13 identity/refusal assertions; actual sampler/camera at 1–10 members and 300×220, 600×200, 900×600; rendered pixels inside artboard |
| Factory accepted main / new candidate | 32/32 / 34/34; TypeScript/library build; candidate native CI passed |
| QL → Nara | Actual calculated sky/native M2/C++/coupled/personal producers and retained-field browser passed |

The new lifecycle/provider/preview, appearance/editor/CSP and design-system
regressions now run in the existing desktop CI job after browser installation.

The Agency walk uses the actual resident/session/Actuation protocol with the
repository's controlled ACP provider. It proves consent/dispatch/state/UI
contracts, not an actual model's work quality. Factory fixtures and generated
developmental specimens similarly retain their evidence level.

## Evidence and limits

Evidence root: `desktop/cradle/walk/artifacts/ui-convergence/`.
`owner-verification/PORTABLE-RECEIPT.md` indexes exact performance/Factory/QL
evidence; `portable-files.json` supplies source-file hashes. `logs/` preserves
successful and failed trials. Standard walk JSON and images sit beside it.

Representative visuals include ordinary light/dark workspace and narrow/footer
states; Expression light/dark/narrow; Knowledge graph/context and Expression;
Agency Inspect/Activity; native Factory semantic/live/trajectory; same-machine
baseline/repaired welcome and idle. Exact paths are indexed at closure below.

Remaining performance debt: existing ~544KB entry, ~679KB editor and ~747KB
Three chunks (uncompressed minified), mixed Tauri static/dynamic imports,
shader-sensitive enabled startup and no long-duration leak/physical-GPU proof.
The native kernel bridge's polling is outside this UI runtime repair. Native
macOS titlebar chrome continues to follow the operating-system appearance;
explicit body light/dark and detached content are verified separately.

SharedField's configured client in the isolated walk reports unavailable; the
separate SF/runtime configuration lane owns that binding. No unavailable
backend was replaced with mock data. This pass accommodates the native
SharedField/Nara/Agent/graph relationships; it does not finish their unlanded
contracts or the adopted full Factory arrangement.

The C0–C5 lived campaign, actual models, two worlds/machines, sensory judgement,
physical GPU behaviour and owner Recognition remain #65 work. Browser checks
are not evidence that a person accepted the experience.

## Closure additions

Current source passes the checks above. Final review exposed two remaining
repairs: explicit terminal WebGL context disposal, and host ink for monochrome
Expression documents on dark backgrounds. Both are in progress with real
regressions. Final native build/window results and revisions will follow those
repairs; this draft receipt does not claim implementation closure.
