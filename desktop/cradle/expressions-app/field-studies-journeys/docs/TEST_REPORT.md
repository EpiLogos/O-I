# Test and delivery report

Build assessed: `ca829a2b691764b4e41312d76263841808c5e1ebae4775a7e7f8795c22fbfd7b` (SHA-256 of `public/index.html`). Report generated 2026-09-11T21:07:04.662951+00:00.

## Completed checks

The strict TypeScript build passed across eleven source modules. **19 model, camera, clock, sequencing, automation, validation and edit-history tests passed. 38 browser acceptance checks passed**, with zero collected JavaScript runtime errors in the exercised paths. These are acceptance checks, not a claim of exhaustive coverage.

Browser execution used Chromium with software WebGL under Xvfb. The standalone HTML was loaded as local inline content without changing browser URL policies. Separately, the local static server returned HTTP 200 and served byte-identical built HTML; managed browser policy prevented testing navigation to that loopback URL. The browser harness's explicit in-memory storage test double exercises persistence calls without pretending to be durable origin storage.

The browser checks cover the O/I opening; contextual navigation without clock resets; one-click and explicit repeated pinning; placement matching the clicked point; pin movement with preserved depth; undo and repulsion without unrelated mutations; 3D plane depth; formation placement; text drafts and shortcut exclusion; local sequence keyframes; contextual automation and preserved base values; optional editorial text and safe literal rendering; saved scene framing; scene duplication/undo; unavailable physical controls; JSON and self-contained HTML export; journey playback; seven ordinary chakra entities; transient-pointer ownership; desktop/mobile bounds; and reduced-motion behaviour.

The image exports were decoded as PNG at the requested output width. A separate transparent export had genuine zero-alpha background pixels and nonzero foreground alpha. Exported journey HTML was reopened and its embedded authoring document compared to the source; its presentation view also opened correctly.

## Video evidence and limits

The browser recorder produced a **vp9** file at **1280 × 889**. Browser playback loaded decoded video frames. Independent ffprobe decoding counted **6 frames** in the short software-rendered test recording (`evidence/video-probe.json`). This establishes the real capture/encode/download/decode path; it does **not** establish sustained 30 fps. The renderer ran under software graphics in this environment. The UI labels 30 fps as a target and reports render cadence; it warns when that target is not being met.

No Safari/Firefox/Edge matrix, target-hardware sustained recording benchmark, two-minute endurance test, audio pipeline, offline deterministic export or supersampled native-engine capture is claimed. The PNG path scales/crops the current renderer output; it does not re-simulate the field or increase its particle count. Decorative CSS paper noise is not independently baked into the capture; the renderer, background and optional text are captured.

## Engine and storage exclusions

The supplied alternate engine is absent. The replacement is an explicitly labelled procedural layout preview; the native production engine has not been supplied, connected, tested or modified. Physical cymatics, fluid/sand transport, force integration, runtime checkpoints and exact physical seeking are intentionally not represented as completed. The basic Canvas2D fallback is reduced and is not equivalent to the WebGL renderer.

The user-reported production pin defect remains an explicit integration requirement in `ENGINE_HANDOFF.md`; passing shell placement tests is not proof that the production force bug is fixed. The authoring envelope is `oi.journey` version 1, not production schema 4. Unsupported documents are rejected rather than silently migrated. No private browser profile or legacy snapshots were accessed.

## Delivery

The built standalone site, complete source, engine handoff, UX contract, parameter inventory, tests and visual evidence are included. The site also works without runtime network requests. The requested public URL has not been published: the offered AppDeploy hosting connection remained unconnected. `public/` is ready for a normal static deployment, and the standalone HTML can be opened directly in a browser in the meantime.

Raw evidence: `evidence/unit-tests.log`, `evidence/browser-results.json`, `evidence/browser.log`, `evidence/video-probe.json`, captures and desktop/mobile screenshots. Reproduction instructions are in the README and test harness.
