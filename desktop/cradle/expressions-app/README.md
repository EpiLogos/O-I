# The O:I Expressions application — vendored source of record

This directory IS the Expressions application (owner ruling 2026-09-19: "we
are building now INSIDE the expressions system, not around it"). It is a
genuine copy of the application source from Work/Point-Cloud-Demo (source
trees identical to the owner's Documents copy at vendoring time) — not an
outer-repo hack. Every change to the application happens here, in this repo.

## The one build law

```sh
cd desktop/cradle/expressions-app
npm install        # once; self-contained node_modules under this directory
npm run build      # build:journeys (the standalone editor page) + vite build
```

The build writes `dist/` with a RELATIVE base (`--base=./` is fixed in
`vite.config.ts`), so the bundle serves from any directory prefix — the
cradle hosts it through the owner's `oi-material://` file seam, where the
app's URL is the served dist directory itself, never a site root.

The native desktop serves its own application build at
`oi-material://localhost/__application/expressions/index.html`. The cradle's `npm run build`
first builds this application, then copies its generated `dist/` into the
desktop frontend bundle's `expressions/` directory. Tauri embeds those bytes
in the candidate. Install this application's dependencies explicitly before
building; no lifecycle hook installs them.

For a debug native run without embedded assets, the kernel may read this
checkout's `expressions-app/dist` only. Missing files are refused; a candidate
never silently reads the primary checkout. The asset response's
`X-OI-Asset-Source` header distinguishes `bundled` from `development-build`.
This preserves the existing material origin and its stored hosted drafts.
Only the reserved application/Expressions prefix is admitted; traversal and symlink escapes are
refused, and browser webviews cannot reach this route. The frontend marks the
application ready only after its own state handshake, with a bounded failure
message if it does not start. Its sandbox and typed host relay remain in place.

Explicit ground-bound bridge walks retain the Central material location
`Work/O-I/desktop/cradle/expressions-app/dist`. This is a separate test transport,
not a native fallback. Owner-authored personal documents still use the Central
`oi-material://` seam.

`dist/` and `node_modules/` are gitignored (generated); everything else in
this tree is source and is committed.

## What lives here

- `src/` — the engine (WebGL point-cloud field, glyph sampling, physics) and
  the legacy workbench (`legacy.html` still builds from it). The default
  application entry (`index.html` → `src/native.ts`) is the journey editor.
- `field-studies-journeys/` — the Expressions application itself: the
  journey/expression editor, its Library, capture and toolbelt.
  `scripts/build.mjs` typechecks it and emits the offline standalone page.
- `legacy-collections/` — the app's collection content as DATA (featured
  expressions + starters), exported for the collections/library refit at
  Central and ProjectCentral levels. See its `manifest.json`. Retained as
  non-legacy and live in the app: `oi-mark` (the default light/dark O:I
  theme expression) and `source-twelve-faces` (the Epii face).
- `scripts/export-legacy-collections.mjs` — regenerates the above from the
  app's own modules after `npm run build:journeys`.

## Owner directions carried in this tree (2026-09-19)

- The default opened expression at boot is the O:I mark — one expression,
  two scenes (Day / Night), the light/dark theme matching the base O:I
  image (`oiMark()` in `field-studies-journeys/src/model.ts`).
- The orbit controller anchors in the BOTTOM-LEFT corner at all times
  (`#orbit-control` in `field-studies-journeys/src/workspace.css`); the
  menu-relative visibility rules still govern when it yields.
- The masthead aligns with the desktop shell's traffic-lights cutout: the
  host posts the live cutout geometry (`oi-shell-cutout` messages) and the
  header height/padding follow (`--shell-cutout-w/--shell-cutout-h`).
- `?expression=<id>` is a hosted deep link (the app's own `?journey`/
  `?scene` idiom). Under the owner's 2026-09-24 correction, Technè's M0
  opens the selected Wiki register as a native Expression with Scenes.
  The authored Epii face remains available through Home; it is not a
  substitute graph or a second instrument application.

## Technè instruments

The engine mounts the existing Research Canvas `CanvasView`, `TimelineSurface`
and `PsychogeographicMap` components for M1, M2 and M4. Their pinned source,
license, dependency requirements and eight capability adaptations are recorded
in `vendor/research-canvas/README.md` and `PROVENANCE.json`. M3 and M5 use the
existing Expression and Scene controls. The cradle only supplies typed native
readings and operations; it does not mount a competing instrument UI.

Canvas edits use the current native Scene's occurrences and revision. Source
relations remain read-only; locally authored Expression connections are committed
and independently read back. An interrupted connection operation is recovered by
inspection, without replaying its mutation. Timeline and Places consume actual
source dates and locations; missing facets do not produce invented records.
The map ships geographic context for offline use. Instrument camera/layout
preferences currently survive lens switches in memory, not application restart.

## Tests

```sh
npm test    # the journey model suite (node --test), 53 tests
npm run lint  # full typecheck of both tsconfigs
```

Both configurations must pass. The wrapper enables `strictNullChecks` so the
Research Canvas schema types retain their required fields; the engine uses full
strict checking. Native instrument acceptance additionally requires the desktop
host and real owner records, beyond the model and typecheck gates.
