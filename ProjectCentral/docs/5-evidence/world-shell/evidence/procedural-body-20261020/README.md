# T-PROCEDURAL-BODY evidence (20 Oct 2026)

`before/` is what the v1 generator (`globe/body.ts` at `5492ce9d6`) draws with the World design's own dials, rendered by
`before/render-v1.mjs` (the generator's texture, before the globe shader lights and grades it):

- `body-default-1024.png` — the default body at the width the globe is given on a capable GPU (1024).
- `body-fjord-1024.png`, `body-archipelago-1024.png` — the two coasts that are not smooth.
- `body-default-1024-zoom6x.png` — what the closest camera sees: the 1024 base enlarged six times.

The Earth's own texture is `packages/live-shell/ui/public/textures/earth-2k.jpg` (a quarter of what ships at 8k). The numbers that
separate them are in `packages/live-shell/ui/tests/fixtures/planet-reference.json`.

`after/` is the same bodies from the finished generator (version 2), 21 Oct 2026:

- `render-v2.mjs` draws `body-default-2048`, `body-fjord-2048`, `body-archipelago-2048`, `body-default-4096.png` (the widths the globe is
  given now: 2048 on a small GPU, 4096 on a capable one; the 4096 one is 11 MB and is not kept here), `cloud-default-2048.png` (the cloud layer) and `tiles-z7-default.png` (four close-zoom
  tiles, two over land and two over sea: what `before/` showed as the 1024 base enlarged six times). Run it with
  `node --experimental-strip-types after/render-v2.mjs <out dir>`; it writes PNG, and the equirects kept here are JPEG (quality 90) to keep the evidence small.
- `sea-crop-v2.png` and `sea-crop-earth.png`: a stretch of open sea and coast of each, the generated body's (2048 wide) and the Earth's own texture (a strip of the
  South Pacific and South America).
- `globe/` holds the globe as the world sees it, headless Chromium on swiftshader (so slow, and the tiles take about 90 s to arrive: wait for them),
  through `globe/shoot.py` (the page and vite config it serves are `before/globe/`'s): `earth-world|region|place.png` (the Earth at 38N 9W, at 3.2, 1.35 and 1.08 radii, from `before/globe/`, unchanged) beside
  `v2-world.png`, `v2-region.png`, `v2-region-clear.png` (clouds at 0, so the ground shows) and `v2-place-open-sea.png` (the same camera, which on this seed
  is open sea under cloud) from the default body (seed 20261018, the World design's own dials, clouds .35). Land at a place view:
  `v2-place-lowland.png`, `v2-place-mountain.png`, `v2-place-desert.png`. `v2-barren-world.png` is a barely begun world (a grey moon);
  `v2-system-scale.png` is your system (your planet, the other worlds on their ring, a world with no agent a grey moon, only agents at work on the inner
  rings and what they made on the outer); `v2-region-places.png` has locations named at their points, drawn on the nearest shore where the spot is sea,
  and the anchor line from one to its place on Earth. The cards over the globe are the atlas's own thread cards (a fixture), as in `before/`.
