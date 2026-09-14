# Native browser and shell refinement tranche — 2026-09-08

Standing: implemented and observed in the macOS debug application; bounded tranche, not full browser-product acceptance.

## Commission and relation

The user's direct commission takes precedence over the attached browser proposal: lower-tier agents refine shell motion and plan the editor/context suite while the lead implements functional browser panes. S now hosts independent HTTP(S) documents as native browser views inside its existing surface bindings. These views do not acquire Central ownership, AIKit encounter identity, or native package authority by appearing in a pane. Central-owned files continue through their existing material route.

The shell refinement and editor proposal are separate attributable returns:
- `../shell-motion/README.md` — measured edges, motion, top spacing and footer cleanup.
- `../EDITOR-CONTEXT-PLAN-2026-09-08.md` — document-type tools, element/text candidates, explicit cross-pane context inclusion and owner gaps.

## Implemented

- Tauri 2.11.5 native child webviews (explicit `unstable` feature) keyed by the existing surface binding ID. Hide/show retains the actual browser object; moving between pane groups does not recreate a page. Detach and re-dock reparent that object before destroying its host window.
- Address, back, forward, reload/stop, native zoom, actual page title, temporary-session disclosure. Workspace menu: New Browser Pane (Cmd/Ctrl+Shift+L), Go to Web Address (Cmd/Ctrl+L).
- Separate nonpersistent WebKit stores per browser pane. Closing ends that session. Reopen/restart restores the address only. Native sessions survive ordinary tab changes and inactive arrangements during the app lifetime.
- Native child geometry follows real viewport bounds, including region animation. Shell menus, search/dialog overlays and full right-region presentation hide the child so it cannot cover shell controls. macOS first-responder observation keeps pane focus attached to direct page interaction without trusting page scripts.
- Browser labels are `browser-*`, outside every shell IPC capability. The material protocol rejects those labels before owner resolution. HTTP(S) navigation is validated natively; native schemes, script/data URLs and embedded credentials are refused.
- Shell callbacks identify the native instance, not only its reusable binding ID. Native attach/reconcile lifecycle is serialized; closure retains failed rows, aggregates errors and removes successful rows. Reparenting commits host metadata after success and rolls back on failure. Missing native views can be recreated; an in-progress attachment is not mistaken for a disappeared view.
- Address presentation follows verified native page-load URL. Installed Wry maps Started to WebKit `didCommitNavigation`; pre-navigation requests do not replace the committed address over old content. Pending edits remain distinct from committed page state.
- New-window requests are held with a visible destination and explicit open-in-this-pane action.

## Native observations

Actual O-I.app, real kernel/owner fixture and standalone HTTP server at 127.0.0.1:4290, operated through native accessibility and screenshots in the task record. This was not a Chromium-only simulation of the native provider.

1. Opened an HTTP page through the address field. Its actual scripts, form, counter and cookie endpoint ran in the native child view.
2. Switched to an existing Central HTML tab and back: form text, Count 1, cookie and the same native `browser-1` survived.
3. Detached into `surface-1`: form `Browser continuity`, Count 1 and cookie survived; re-docked and retained them again.
4. Navigated A → B → Back: native address/title followed B and back restored A's form and counter.
5. Direct remote invocations of `kernel_event_log` and `browser_reconcile` were denied by Tauri ACL in both main and detached hosts. The denial identified remote `browser-1`, despite its host being `main` or `surface-1`.
6. A second browser view at the same origin read an empty cookie while the first retained its cookie.
7. Full right-region presentation removed the browser from both sight and accessibility; restoring returned the preserved form/counter.
8. Final reviewed build: address submission by Go, native Cmd+L from page focus, history and split placement passed. Three actual groups (source + two browser views) rendered with the browser content clipped to each pane. Directly clicking the second page then Cmd+L navigated that pane, leaving the other form intact.
9. Closed and reopened the test browser: a new `browser-3` reported an empty cookie and continued to deny shell IPC. This confirms disposal rather than hidden-view reuse on actual close.
10. Ordinary external HTTPS navigation to `https://example.com/` rendered Example Domain in the native browser.

## Validation and review

- Production frontend typecheck and Vite build passed; real native app bundle completed.
- Two native boundary tests passed: native/script/data/credential-bearing URLs are refused; invalid/nonfinite geometry is refused. These supplement the real native checks above.
- Scoped independent review found and corrected window-vs-webview assumptions, lifecycle disposal/reattachment races, URL presentation timing and undisclosed popup destinations.
- Final native bundle build initially hit disk exhaustion; only regenerable local incremental build cache was cleared, and rebuilding with incremental output disabled succeeded. Build receipt: `build.log`.
- Production entry bundle contains no `__cradle` walk hook.

## Explicit remaining limits

Downloads are currently refused with a visible notice; there is no file-save/download manager. Popups require explicit inclusion in the current pane. Browser stores are temporary, with no persistent signed-in profile UI, extension system, permission manager or multi-profile claim. The installed cross-platform webview seam does not provide a complete navigation-failure callback; Stop and Reload remain available during a stalled load. Native focus observation and the native acceptance above are macOS-specific; Windows/Linux are not claimed verified.

Element/text attachment is a plan in this tranche, not a shell-owned semantic context store. Central's selection resolver and AIKit's canonical draft attachment/send contract must provide the authority seam described in the editor proposal. No attachment is silently sent to an encounter.
