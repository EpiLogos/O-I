# T-ATLAS-PROVIDER — the founding corpus provider reads through Central's file owner

Label: wayfinder:task (Phase 2 — seams; no UI leg)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku ×1)
Pairs with: T-ATLAS-HOST (the host leg codes against this signature).

## Question

The atlas needs the World's corpus at runtime (C2 provider seam, lock §8.4:
material through native owners with refs and revisions, never a
`public/data` fetch). The founding corpus is Archetypal-Earth's published
bundle at `Work/Archetypal-Earth/public/data/` (field, history, symbols,
corpus index + volumes, and the named material: redbook, dynamics,
dynamics-route, aionbook, sky-cards, theory, theory-pages, field-pages,
numbers, alchemy, astrology, depth, practice).

## Lead's design

`packages/live-shell/ui/src/projections/atlas/provider/archetypalEarthProvider.ts` (new):

```ts
export const ARCHETYPAL_EARTH_PROVIDER_ID = 'archetypal-earth'
export const ARCHETYPAL_EARTH_DATA = 'Work/Archetypal-Earth/public/data'
export function archetypalEarthProvider(transport: KernelTransportStatus, root = ARCHETYPAL_EARTH_DATA): CorpusProvider
export function adaptFoundingField(raw: unknown): Field   // the founding provider's re-emit (C2 §1.3)
```

- Reads only through `desktop/cradle/src/files/client.ts` (`listFiles` the
  root once, then `readFile(location)` per file — the listing's own
  locations, never a hand-built path). A missing optional file is absence
  (the found law), never an error; a missing `field.json` throws "The atlas
  data is unavailable" (mount.ts's honest-failure text starts with "The
  atlas data").
- `adaptFoundingField`: AE's field.json predates the C2 contract — map
  `meta.vaultPath`/`vaultLedgerLine` → `meta.provider = {id:
  'archetypal-earth', name: 'Jung archetypal field', home: vaultPath}` and
  `meta.freshness = vaultLedgerLine`; `ties.bases` = the founding triple
  with labels Jung · Inferred · Read here; each occurrence's `jung` →
  `cites` and drop `subject`; the corpus index's `vaultPath` → `provider`.
  Everything else verbatim. (The words "Jung archetypal field" live here,
  in the provider — C2-b8's one permitted place.)
- `published`: `(name) => readFile(location of '<name>.json')` turned into
  `new Response(content, {status: 200, headers: {'content-type':
  'application/json'}})`; a name not in the listing → `null`. Names with a
  slash (`corpus/<work>`) list that subdirectory once.
- Corpus volumes: `src/data/corpus.ts` fetches `${activeBase}/<work>.json`
  — route it through `fetchPublished('corpus/<work>')` (one-line host
  adaptation in a pinned module: update `PORT-PIN.json` via `node
  scripts/atlas-port-pin.mjs --record` and give the reason "[§8.4] corpus
  volumes through the provider's published material").
- Images: out of scope (T-ATLAS-IMAGES) — ImageRefs pass through; say so.

Tests `tests/atlas-provider.test.mjs`: a fake transport (kernelOp is
`desktop/cradle/src/kernel/bridge.ts` — stub via a transport of kind
`bridge` against a tiny in-process http server, or inject a reader: give the
provider an optional `reader` parameter `{list(path), read(location)}`
defaulting to files/client, and test with the fake reader) over a small
fixture tree shaped like AE's (meta with vaultPath, an occurrence with
`jung`): the bundle validates through `loadField`'s checks, cites renamed,
provider named, published resolves present names and nulls absent ones,
absent optional files are undefined.

## Acceptance

- Scripted: the tests above; `atlas-port-pin.mjs --check` exit 0 with the
  corpus.ts adaptation recorded; tsc 0.
- Code-reading: no `fetch(` against `public/data` anywhere in the provider.

## Resolution

—
