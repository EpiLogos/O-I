# T-ATLAS-ASSETS — the Earth's base ships with the instrument; plates resolve through the material route

FOUNDATION §4 "Can start now"; PORT-AUDIT §D M2 and M4 (M1 is withdrawn: the
field is N3, never AE's corpus). Builder: Sonnet. Wave 1, 14 Oct 2026.

## Realises

- Manual `docs/dlw/DLW.md` §8: "Everything starts from the world … Earth is
  given; you place things on it, and anchor your own world's places to its
  real ones." §10.2: an instrument opens in a pane.
- Craft floor: Archetypal-Earth's own globe (`Work/Archetypal-Earth`, the
  PORT-PIN commit) — the base paints before tiles, never a black sphere;
  `world-shell-mockup.html` `drawSphere` / `buildTex` (lines 888–941) for the
  globe's place in the pane.

## Derivation (recorded, not asked)

The base textures are part of the instrument, not personal material: the
manual says Earth is given, and a player plays by downloading the app (lock
§0, settled). So `earth-2k/4k/8k.jpg` ship in the candidate's own payload, at
the exact path the verbatim port already loads (`globe/earth.ts:68,82`:
`${BASE}/textures/earth-*.jpg`, `BASE = /app`). Vite copies
`packages/live-shell/ui/public/` into `ui-dist`, so the port needs no code
change for them. Any other AE texture the ported code loads (check
`earth-dark`, `earth-topology`, `earth-water`) follows the same rule.

Image plates are owner material: an occurrence's `ImageRef` names a file the
owner holds. They resolve through the material route the host already serves
(`desktop/cradle/src-tauri/src/material_protocol.rs`: `oi-material://localhost/<encoded Location>/<relative>`,
the candidate's helpers in `desktop/cradle/src/material/MaterialSurface.tsx:42-46`
and `desktop/cradle/src/expressions/hostedApp.ts:60-66`; in walks, the bridge's
dev mirror). N3's provider will hand each occurrence a base `Location`; this
ticket builds the resolver it will call.

## Work

1. Copy the AE textures the ported atlas loads into
   `packages/live-shell/ui/public/textures/` (byte-identical; record each file
   in the atlas PORT-PIN as `vendored-asset` with its sha256 and AE path).
   Correct `globe/earth.ts:61–66`'s comment ("No texture bytes ship with this
   port") to say where they ship; record that one-comment adaptation.
2. An image-ref resolver in the atlas host
   (`packages/live-shell/ui/src/projections/atlas/provider/`): given an
   `ImageRef` whose `src`/`thumb` is relative (`img/…`) and a base Central
   `Location`, return the material URL for the current transport (tauri →
   `oi-material://…`, walk bridge → its mirror), reusing the existing
   `materialPath` grammar — never a new URL grammar. Wire it where the field is
   adapted (`adaptFoundingField`), taking the base location from the provider;
   with no base location, the plate stays absent and the reveal card shows no
   broken image.
3. Tests: the resolver (tauri, bridge, absent base, `..` refused), and a check
   that every texture path the ported globe loads exists under `public/`.

## Zone

- `packages/live-shell/ui/public/textures/**`
- `packages/live-shell/ui/src/projections/atlas/provider/**`
- `packages/live-shell/ui/src/projections/atlas/src/globe/earth.ts` (comment only)
- `packages/live-shell/ui/src/projections/atlas/PORT-PIN*` (records)
- `packages/live-shell/ui/tests/atlas-assets*.test.mjs` (new)

## Done when

- Headless: the atlas dev harness (`atlas/dev/main.ts`, fixture provider)
  serves its textures from the candidate's `public/` (not
  `atlas/dev/public/textures/`) and the globe paints its base.
- On screen (lead, after N3): Technē › Earth paints the Blue Marble base
  before tiles; a reveal card with a plate shows it.
- Checks: `npx tsc --noEmit -p .` in `packages/live-shell/ui`; the atlas suites
  (`node --experimental-strip-types --test tests/atlas-*.test.mjs`);
  `node scripts/atlas-port-pin.mjs` if it verifies pins; `npm run build` and
  `ls ui-dist/textures`.
