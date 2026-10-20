# T-PROCEDURAL-BODY evidence (20 Oct 2026)

`before/` is what the v1 generator (`globe/body.ts` at `5492ce9d6`) draws with the World design's own dials, rendered by
`before/render-v1.mjs` (the generator's texture, before the globe shader lights and grades it):

- `body-default-1024.png` — the default body at the width the globe is given on a capable GPU (1024).
- `body-fjord-1024.png`, `body-archipelago-1024.png` — the two coasts that are not smooth.
- `body-default-1024-zoom6x.png` — what the closest camera sees: the 1024 base enlarged six times.

The Earth's own texture is `packages/live-shell/ui/public/textures/earth-2k.jpg` (a quarter of what ships at 8k). The numbers that
separate them are in `packages/live-shell/ui/tests/fixtures/planet-reference.json`.

`after/` (added by the lead at the end) holds the same bodies from the finished generator and the globe captures beside the Earth
at the same camera.
