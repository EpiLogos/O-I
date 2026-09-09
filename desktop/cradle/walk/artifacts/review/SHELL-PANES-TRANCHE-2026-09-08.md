# Shell and pane recovery · 8 September 2026

Actor: Codex UI lead, with three explicitly commissioned bounded subagents. Phase: `cradle-p1`; no phase advancement.

## User correction governing this tranche

The user's screenshots and follow-up supersede the initial footer-only treatment: region toggles belong at the top, in a window-wide strip with focused-pane functionality. The footer keeps workspace identity/actions and quiet status. System's internal design is deferred to its separate owner. Point-cloud interaction options remain isolated proposals; no global interaction animation ships in this tranche.

## Safety and ownership

Original integrated WIP was committed and pushed first as `79a446d`. No reset, stash, branch switch or worktree creation. Concurrent kernel/Flow, System Settings and A2A work belongs to other tasks and is preserved; it is not a UI-lead implementation. The final native build observes the shared working tree and therefore includes those concurrent changes without accepting their functionality. Existing owner processes were not stopped or replaced.

## Operative changes

- Window-wide top strip: persistent Central/agent toggles, focused surface context and established frame actions. Native main titlebar uses macOS overlay geometry with room for the real traffic lights; dragging crosses Tauri's window permission. Footer remains workspace/status only.
- Single-tab split creates an explicit empty sibling, without duplicating the source or semantic binding. Empty panes survive layout persistence, receive opened/dropped surfaces, and close through the frame action or Cmd-W.
- Resized split weights survive insertion/pruning; pinned tabs reorder; tile preserves active subject and exits maximize. Pane-local maximize/restore, directional keyboard resize/reset, keyboard tab focus and whole-pane internal drop targets.
- Native bindings carry view metadata. Stale/failed window setup recovers; re-dock is guarded and retryable; a failed latest-state refresh cannot strand the returned view. Detached pane slots survive unrelated closes/moves.
- Source selection/scroll and ordinary-file caret/scroll retain bounded view coordinates; drafts and source authority remain on their existing routes. Binary material remount/detach uses the owner's binary-safe read.
- Below 640 px, the persisted split tree exposes one focused pane at a time, with an accessible pane selector in the top strip; returning to a wide window recovers the arrangement.
- Narrow Central overlay is summonable by pointer, shortcut and native menu; closing restores focus and persisted arrangement. Right-region overlay avoids starving the canvas.
- Renderer kernel-receipt cache is bounded to 256 observations; the kernel's history is untouched. Subscription cleanup handles late completion.
- Material walk now exercises an actual relative JavaScript interaction alongside CSS/images, sandboxing, unsupported/PDF dispositions and suspension.

## Evidence before the user's top-strip correction

All 18 non-provider scenarios completed successfully in `shell-recovery/integrated-walk.log`. These include reference-study scenarios; they are not native production proof. A cold editor open previously missed the 1s budget at 1,028 ms; the subsequent integrated run passed. Source selection and ordinary-file caret checks exercise actual editor behavior.

Resource scenario repaired: 23 cycles, 3 warm-up + 20 sampled, all five intended interaction steps successful on every cycle. Retained heap after explicit CDP collection grew 20,537.8 B/cycle (<1% of first stable 5,889,064 B), DOM slope 3.729/cycle (<5). Raw pre-collection heap and cumulative task/script/layout durations are retained in `../resources-measurements.json`. Before bounding renderer receipts, retained heap slope 60,504.3 B/cycle exceeded 55,043.6 B/cycle; the failing reading is preserved in `shell-recovery/resources-before-receipt-bound.json`. These are Chromium renderer measurements, not native GPU/process lifetime acceptance; interaction effects were subsequently removed from production.

Encounter acceptance did not complete: the installed session helper lacks encounter commands; the isolated older verified helper supports them but its schema 5 cannot read schema 6 created by current AIKit. Exact errors are retained in the integrated log. This is an explicit executable-composition gap, not a passed encounter walk. No running provider was replaced.

## Tranche verification

Focused browser tranche: surfaces 28/28, material 26/26, navigator 23/23 passed. Spatial restoration subsequently passed 42/42 after correcting a harness race: it sampled scroll before the real listing finished restoring; the exact restoration assertions were retained. Earlier failing attempts remain in the logs. Native tab activation is now a real button separate from Close. Actual macOS accessibility activation selected study.html and then the unsaved architecture tab without reducing tab count; the distinct Close removed only study.html, and Cmd-Shift-T restored it. Final shell-recovery passed 36/36 using an isolated bridge on 4197, including reload of the empty pane followed by opening into that pane. The actual race was repaired: an unfocused source editor must not steal focus from the persisted empty pane. TypeScript and diff checks passed. See `shell-recovery/narrow-pane-walk-final.log`.

Actual macOS application was built and driven with an isolated, real Central-created project and a separate native data-store ID. Observed at 1280×720, 900×760 and 390×720: native traffic lights and top region controls; single-tab split creates an empty pane; another source fills it; narrow focused-pane selection and Cmd-B/Escape focus return; unsaved source draft retained through detach/re-dock; child editor receives focus and Cmd-Shift-D returns to the parent editor. Quit/relaunch restored the pane arrangement. Native HTML material loaded relative CSS and JavaScript, with a real Increment action producing 1. Native screenshots are embedded in the task record; the checked-in width screenshots are Chromium evidence, not relabeled native images.

No FND-00–06 readiness promotion: provider executable composition, native permission/failure coverage and native resource/GPU lifetime acceptance remain open. This is a bounded shell tranche ready for review, not the full foundation gate.

## Point-cloud options

Three independently runnable alternatives are in `point-cloud-options/index.html`, with screenshots and lifecycle checks. They consume existing shared primitives. Options are proposals only; the standalone preview is not product functionality or a provider simulation.

## File and build record

`./shell-recovery/owned-code-files.json` is the exact implementation/scenario file manifest for this UI tranche. `./shell-recovery/native-composition.json` records final bundle and executable hashes and the shared working-tree composition. The build is a debug macOS app for review, not a signed release. Concurrent System, kernel/Flow and A2A code remains separately owned.
