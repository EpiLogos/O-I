# T-ATLAS-HOST — the atlas mounts in the shell's Earth / Graph panes

Label: wayfinder:task (Phase 2 — seams; has a UI leg)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; split: provider leg = T-ATLAS-PROVIDER, host leg = this ticket; builders haiku ×2)
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

## Lead's design (13 Oct 2026) — the host leg

The provider leg is T-ATLAS-PROVIDER (`provider/archetypalEarthProvider.ts`
exports `archetypalEarthProvider(transport: KernelTransportStatus): CorpusProvider`
and `ARCHETYPAL_EARTH_PROVIDER_ID = 'archetypal-earth'`). Code against that
signature; until it lands, the fixture provider stands in (tests).

1. `src/projections/atlas/AtlasProjectionPanel.tsx` (new) — a React
   component that owns one atlas instance: a globe element + an app
   element; on mount `registerCorpusProvider(archetypalEarthProvider(transport),
   {asDefault: true})` (once per transport), binds the host stores
   (step 3), calls `mountAtlas({globe, app, provider: ARCHETYPAL_EARTH_PROVIDER_ID})`,
   and shows the honest refusal text in the pane when mount rejects; on
   unmount `handle.destroy()`. A `view: 'earth' | 'graph'` prop drives the
   atlas's own Earth ⇄ Graph switch through the controller (read
   `src/app/controller.ts` for the existing graph toggle — call it, never
   reimplement). Hidden-inhabitant law: hidden (`display:none`) keeps the
   instance; `setVisible(false)` pauses the engine if the engine exposes a
   pause (read `globe/engine.ts`), else leave it.
2. Registration (`src/projections/atlas/registerAtlasHost.ts`, new, called
   once from `App.tsx` where other panels register — find `registerPanel`
   callers): `registerPanel({id: 'projection.earth', slot: 'center', …})`
   rendering the panel with `view="earth"`, and `registerProjectionModule`
   for `projection.earth` and `projection.constellation` (cradle door,
   `desktop/cradle/src/surface/projectionModules.ts`) whose `create` mounts
   the same way into the pane element (view earth / graph).
3. Host stores (lock §8.4: settings in the workspace, never browser
   storage): bind `setGraphSettingsStore`, `setPracticeStorage`,
   `setLandingStore` to the shell's workspace-scoped store — read
   `src/continuity/workspace.tsx` / `continuity/residency.ts` for the
   workspace's own storage namespace and use it (one namespace per
   workspace id); never `localStorage` directly in the atlas.
4. The Technē lens bar (`src/shell/ModeDetail.tsx` LENSES +
   `src/App.tsx` onLens): **Places** becomes `cut`, opening the centre
   panel `projection.earth` (Earth view); **Project / graph** becomes `cut`,
   opening it in the Graph view. Timeline and Journey keep their World-cut
   behaviour. `aria-pressed` follows the open lens.
5. Tests (`tests/atlas-host.test.mjs`, headless, jsdom-free like the other
   SSR tests — render the lens bar and assert cut/waiting states; unit-test
   the store binding and the registration doors with fakes;
   `registerProjectionModule` refuses a second different module).

UI legs (the globe and graph visible in Technē, both viewports): verified
by the lead's computer-use / headless-Playwright pass.

## Resolution

**Code landed (13 Oct 2026; host leg builder haiku + the lead's fixes).**
`AtlasProjectionPanel.tsx` mounts the atlas lazily (its own chunk) over the
World's provider; `registerAtlasHost.ts` admits `projection.earth` as a
centre panel and both projection kinds at the cradle door (a second module
is refused); Technē's lens bar cuts **Places** (Earth) and **Project / graph**
(the field graph, through the controller's own `toggleMode`); hidden panes
pause through `engine.setPaused`; atlas memory is keyed under the
workspace's storage namespace. Lead fixes: AE's document-level CSS (`:root`
tokens that collided with the shell's `--ink/--sans/--serif/--ease`, `*`,
`html/body`, `button`, `a`, `:focus-visible`) scoped to `.atlas-host`
(recorded in PORT-PIN); the atmosphere palette written on the pane, not the
document; the practice store follows the host's binding (probed on use).
Scripted: atlas-host 5/5, provider 9/9, pin check 0, tsc 0, vite build ok.
Carried: the controller's window listeners outlive `destroy()` (the host
claims the atlas once per session — hidden-inhabitant retention, so it is
never unmounted in practice); a workspace-sets field would replace the
namespaced keys. UI legs: the native screen pass.
