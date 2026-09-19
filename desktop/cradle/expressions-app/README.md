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

The cradle's Expressions centre (`desktop/cradle/src/expressions/
PointCloudHost.tsx`) reads this directory's `dist/` through the kernel's
files seam by its Central-relative path — `Work/O-I/desktop/cradle/
expressions-app/dist` — the same seam that previously served
`Work/Point-Cloud-Demo/dist`. The cradle sits on Central's disclosed ground,
so no copy-sync is needed: THIS directory is the source of truth, its
`dist/` is the served artefact, and Work/Point-Cloud-Demo is no longer the
app of record.

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
  `?scene` idiom) — Instrument 0 opens onto the Epii face
  (`?expression=source-twelve-faces`).

## Tests

```sh
npm test    # the journey model suite (node --test), 53 tests
npm run lint  # full typecheck of both tsconfigs
```

Known pre-existing drift, inherited verbatim at vendoring time and NOT
touched here: `tsc --noEmit` over the LEGACY workbench files (`src/App.tsx`,
`src/components/ColorSystemPanel.tsx`, `src/components/ChakraPanel.tsx`)
reports 22 errors — e.g. `App.tsx` calls `resetField`/`setActiveEntity` on
`PointCloudComponentRef`, whose interface (src/components/
PointCloudComponent.tsx) genuinely lacks them. A clean npm install resolves
the dependency types and surfaces this drift; the outer tree's install
masks it. The default application (field-studies-journeys, strictly
typechecked by `build:journeys` on every build) is clean, and `npm run
build` does not depend on the legacy workbench typechecking.
