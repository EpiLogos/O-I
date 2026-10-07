# Point-Cloud-Demo #6 — consolidated defect candidates (Expression enrichment, 2026-10-06)

Findings from six authoring lanes, five critic passes and the covers pass,
each reproduced by at least one worker and most by several. Ordered by cost
to corpus work. This file is the receipt to file against Point-Cloud-Demo #6;
nothing here was fixed in shared code by this programme.

## A. Capture / authoring tooling

1. **`capture.mjs` requires `npm ci` + `npm run build` with no pointing error.**
   Fresh checkouts fail at `server exited early` / `TimeoutError` with nothing
   naming the missing `node_modules` or `dist/`. Cost real time in three waves.
2. **`--scene-id <id>` never switches scenes** — it screenshots wherever the
   presentation is at ~4s (twice verified rendering scene 0's text over another
   scene's field). `--all-scenes` calls `__FIELD_STUDIES__.openScene(id)`,
   which does not exist in the current build (silent no-op → N copies of scene 0).
   The live API is `setScene(<INDEX>)`; passing an id throws a misleading
   `Cannot read properties of undefined (reading 'transition')`.
3. **`setScene` does not stop the presentation clock** — unattended captures
   silently photograph the next scene on shorter journeys.
4. **`setScene` does not reset entity-sequence phase** — offset-based morph
   captures on non-first scenes land on arbitrary loop phases.
5. **Scene-entry crossfade scales with scene duration** — inflated-duration
   captures photograph the fade for tens of seconds; a dark scene was still
   settling at t≈16s (settling recipe: pixel-delta, not fixed sleeps; ≥ duration/2).
6. **Sim-time dilation after `setScene`** — re-bake dilates sim time to ~0.02×
   wall speed; timed captures photograph mid-transition blends. Poll
   `inspect().simTime` before shooting.
7. **The app persists scene/transport to localStorage and recovers on boot** —
   reusing a browser context across journeys silently captures the wrong
   scene; fresh context per member is mandatory.
8. **Root-scoped scratch drivers' `--port` flag is documented but not parsed**
   (falls through to the filename, ENOENT) — in two lanes' copies; the shipped
   tool hard-codes a 30s `goto('load')` that times out undiagnosed under load
   (the app's `load` event is unreliable; `domcontentloaded` + healthy-poll works).

## B. Engine / authoring-shell limits

9. **Formation-ceiling mismatch across surfaces**: the authoring app refuses
   >10 formations / >8 pins per scene (`app.ts` `ensureCapacity`), the
   validator admits 32 entities, the field model supports 64. A 13-formation
   scene boots-refuses in the shell while validating clean. One corpus scene
   had to be restaged; the ceiling is now a lint rule on this side.
10. **`engine.pointerMode: "none"` is invalid but silently re-renders the scene
    in a default washed-out presentation** (valid: attract/repel/vortex). The
    honest pointer-off must zero `pointerStrength`/`pointerClickStrength`.
11. **Native engine rejects absolute `field.params.frequency` below 1**
    ("Drive Frequency is outside its native validated bounds (1–100000)") with
    no error naming the parameter.
12. **Text sequences on non-text formation shapes render striped/partial** —
    the engine blends the shape raster with the glyph target; text walkers on
    disc/ring bases lose letterform.
13. **Text layers render markdown markers literally.**
14. **Small share-1 annotation glyphs rasterise below letter-legibility at
    1280×800** — equations survive only via text blocks; candidate minimum
    rasterised text size.

## C. Provenance convention (inherited, for the register's owner)

15. **Binding record SHAs ≠ raw blob shasum** — the production bindings'
    record-sha convention differs from `shasum` output; inherited unchanged
    from the priors, recorded here so the convention gets one owner.

Repair route: Point-Cloud-Demo #6, one repair each; the O-I linter
(`site/tests/expression-richness.mjs`, branch `enrich/expressions-20261006`)
carries the corpus-side guard (renderable ceiling) until the shell ceiling is
raised.
