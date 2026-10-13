# T-ATLAS-HOST — the atlas mounts in the shell's Earth / Graph panes

Label: wayfinder:task (Phase 2 — seams; has a UI leg)
Claimed-by: —
Blocked-by: — (code); the UI leg needs the screen gate (PATH §3)
Found by: the lead, 13 Oct 2026, while designing T-TIMELINE-WALKS leg 2.

## Finding

The re-ported atlas (T-AE-REPORT, `68e0b8ba5`) is not mounted anywhere in
the running shell: `mountAtlas` is called only by the atlas dev harness
(`src/projections/atlas/dev/main.ts`), and no corpus provider is registered
outside it. The shell already hosts projection panes through the cradle's
Workbench (`src/native/Workbench.tsx` → `desktop/cradle/src/surface/projectionPane.tsx`),
and the projection module door names this exact adoption
(`desktop/cradle/src/surface/projectionModules.ts:144-146`: "the atlas
port's mount.ts adopts this door under kind 'projection.earth'"). So the
Earth instrument type has no body, and Technē's Journey has no walk source.

## Question

Register the atlas as the `projection.earth` module (and the graph
implementation A under `projection.constellation`, lock §8.1) through
`registerProjectionModule`, over `mountAtlas`, honouring the hidden-inhabitant
law (`setVisible` pauses, state survives) and the encounter bridge (selection
travels as encounter transitions, never a second store). Register the World's
corpus provider at shell start: the founding provider is the Archetypal-Earth
published bundle (field, history, symbols, corpus index, and the named
material `CorpusBundle.published` carries), read through a native owner
(refs + revisions), never a `public/data` fetch; the fixture stays the dev
harness's. Bind the atlas host stores (graph settings, practice store,
landing flag — `setGraphSettingsStore`, `setPracticeStorage`,
`setLandingStore`) to the workspace's sets.

## Acceptance

- `projection.earth` and `projection.constellation` are admitted at shell
  start; opening an Earth pane mounts the atlas over the World's provider;
  closing it unmounts clean (scripted, headless: the module contract tests).
- The provider is registered from the World, not the fixture; the published
  material resolves through a native owner (code-reading + scripted).
- Settings and practice records persist in the workspace across a reload
  (scripted).
- UI: the Earth, Graph and Aion views in the native app at both viewports —
  `UNVERIFIED: needs-computer-use` until the screen pass.

Then: T-TIMELINE-WALKS leg 2 (the Journey reads the walks of the mounted
atlas) and T-ATLAS-WORKSPACE-STORES (folded in here).

## Resolution

—
