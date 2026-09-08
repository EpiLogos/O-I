# Canvas rendering and shell refinement · 8 September 2026

Agent-authored implementation review. The user's direct request governs scope; the pasted browser essay is evaluated as a proposal, not adopted as an instruction set. Three bounded agents delivered effects, shell cleanup and surface-plan recovery. No phase or full foundation acceptance is asserted.

## What was actually wrong with rendering

The old study fixture contains one CSS declaration (a dark body background), default typography and a one-pixel transparent image. Its low visual quality was authored into the fixture. The new `walk/fixtures/rendering-quality` page demonstrates real type, CSS grid, SVG, responsive reflow and direct manipulation; the host does not restyle it.

A separate native runtime defect was real: classic JavaScript worked, but ES module imports and relative fetch did not. The native route lacked opaque-origin CORS response headers, and both transports lacked `.mjs` MIME fallback. The shared MIME adapter now preserves the owner's disclosed type and covers additional module/font/WASM/image assets when the owner supplies no hint. The sandbox remains `allow-scripts allow-forms`, without same-origin access. Native read-only material responses allow the sandbox's null origin without credential permission and set nosniff. Actual WKWebView now reports classic/module/data Ready; Add one changes 12→13; Reload returns 12. See NATIVE-OBSERVATIONS.md.

Material previews gain per-binding zoom/view persistence, reload from the owner and retry. HTML/Markdown zoom changes the page viewport; it is not a screenshot enlargement. Returning from source reattaches visibility observation. Inactive document suspension still disposes/reloads contained content; it does not promise browser-session state continuity.

The fullscreen O:I identity loading mark is retained only at window scope. Inline/panel loading uses the existing shared point clusters while the user reviews elemental options. Elemental previews are not silently integrated as production behavior.

## Native boundary

The build now enumerates every current custom command through AppManifest and explicitly grants those permissions only to `main` and `surface-*` shell webviews. Capabilities no longer apply to every webview in a containing window. Native shell owner reads continue working with the manifest in place. A full malicious-webview IPC test remains part of genuine browser-provider acceptance; absence of a JavaScript global is not that test.

This matches the [Tauri capability documentation](https://v2.tauri.app/security/capabilities/), including its easily missed custom-command default. Installed Tauri is 2.11.5; no version upgrade was needed. The installed-source [provider decision](BROWSER-PROVIDER-DECISION.md) documents feature-gated child views, native stacking and profile/reparent requirements.

## Integrate the proposal without duplicating ownership

Keep the existing `SurfaceBinding` as view identity and its Central/AIKit/owner ref as semantic identity. Evolve renderer dispatch into a provider registry when adding the next real provider, with supported actions and lifecycle disclosed by that provider. Do not add a second desktop document/session database or claim every view can duplicate every owner resource.

| Surface | Current reality | Next meaningful capability |
|---|---|---|
| Source / ordinary text | Real owner read/write/CAS/history; textarea editing | Editor-engine integration with search, diagnostics and large-file bounds |
| HTML / Markdown | Contained document, owner assets, rendered/source, zoom/reload | Renderer registry and explicit per-provider state/disposal policies |
| PDF / image | Platform PDF path with honest fallback; actual decoded images | PDF text/search/zoom provider and proper image pan/zoom |
| Browser | No general browser session in cradle | Isolated native top-level browser proof: navigation/history/profile/permissions/downloads, zero kernel access; then deliberate child-view composition |
| Computer / terminal | No computer projection or PTY renderer mounted here | Consume an actual Workcell-owned session/provider contract, preserve machine/process identity |
| Shared Self/Other | Canonical plan and portable owner seams recovered; no cradle shared adapter | Ordinary shared canvas surface over existing participant/Explore models; do not replace the companion or synthesize shared NOW |
| Factory / product surfaces | Owner contracts determine availability | Mount real owner views/actions; never imply unavailable services work |

The [VS Code integrated browser](https://code.visualstudio.com/docs/debugtest/integrated-browser) is a useful experience reference for navigation, placement and session storage. Its capabilities do not imply that a Tauri iframe has the same session/profile behavior. Browser automation (CDP/Playwright) is a separate control provider; it does not embed Chromium's compositor into this window.

## Verification and review

- Real owner-backed cleanup walk 18/18 and final footer/root refinement 3/3. Broader shell-recovery36/36 passed after the harness awaited actual overlay visibility instead of sampling between responsive state updates; pointer and keyboard assertions retained. Earlier32/36 attempt is preserved in shell-refinement.log.
- Registered `rendering-quality` walk 19/19: authored layout and SVG, module/data execution, direct interaction, opaque sandbox, persistent zoom, reload, source/rendered, suspension/resume and 390px reflow. Canonical receipt: `../../rendering-quality.json`; final log `iframe-menu-after.log`. The earlier isolated agent receipt used the temporary shell-recovery runner name; it is supplementary, not the canonical scenario identity.
- The iframe-specific menu regression was reproduced (18/19 failed before repair), then fixed by dismissing menus on host-window blur; the actual iframe-click check passed without sandbox introspection.
- Native observations: refined shell, fixed controls on overflowing tabs, rich full-canvas HTML, actual module/data/interaction/reload results. Screenshots are in the task record. Checked-in `rich-wide.png` and `rich-narrow.png` are Chromium screenshots.
- TypeScript, Rust build/check and diff validation completed. Final build record is in native-build-final.log and composition.json.

System Settings and programme-owned changes are separately owned. No general browser, remote computer, authenticated profile, full hostile-content permission gate or native process/GPU lifetime acceptance is claimed.
