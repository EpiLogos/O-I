# The essay reader: essay + field (Quartz layout, redesigned)

Quartz is still the engine (`site/vendor/quartz`, pinned commit; `build:essay-quartz` still stages the published
scope and emits `.public-edition/essay`). What changed is the reading layout and everything it stands on. It was
approved as a mockup first (`site/redesign-materials/essay-projection-mockup/`, git-ignored, with its rationale),
then ported into Quartz's own components. `vendor/quartz/PROVENANCE.json` lists every local modification.

## What a reader gets

- **Quartz's anatomy, redesigned.** Left sidebar (title · search · explorer), centre (tabs · article · breadcrumb
  footer), right sidebar (graph · contents · connections). The right sidebar is the *field*, a first-class view:
  **Essay · Split · Field** (keys `1 2 3`); either sidebar puts itself away to a rail; under 1100 px the explorer is a
  drawer, under 760 px one pane at a time with a bottom bar.
- **One locus.** Reading the manuscript tracks the movement (M01–M48, joined to the `<a id="M##">` anchors): the
  graph re-centres on it, the contents list and the 48-tick reading rail mark it, the explorer marks the reading room,
  the tab and the address bar (`?m=`) follow.
- **Page over page.** The first tab is the page the address names. Anything followed from the graph, the connections
  list, a link in the text or a search hit opens as a *tangent* in a preview tab (italic; the next tangent replaces it;
  double-click keeps it; `↗` makes it the main page, a real navigation). The explorer, the pager and the breadcrumbs
  turn the main page itself. Tangents survive page turns and a reload (session storage).
- **The graph** is the local graph on the reading position: click selects, drag moves a node, drag the background pans,
  wheel zooms, double-click opens a tangent. One filter icon opens one menu (reach, which registers, index pages) and
  the filter applies to the graph *and* the connections list.
- **Breadcrumbs** are the footer, and every crumb is a way back: a page is a link, the root goes home, a folder with no page of
  its own opens what is in it (the six movements of a room), and each separator opens that level's siblings.
- **Search** is in the sidebar, answers at once from titles and paths, and loads the full text (the 12 MB
  `contentIndex.json`) only when first used. Every hit says where it lives; six station bars show where hits cluster.
- **Expressions** are a layer over the same field, not a second library. A page that has an Expression says so under its
  title (a gold chip), the explorer marks it, the graph rings it, the connections list badges it. **Library** is a fourth
  view (`4`): the gallery (covers, collections, search, grid or columns, scene chips) in the centre with the field beside
  it, and **Here** narrows it to the Expressions of the page you are on and of what the graph shows around it. Opening a
  card opens the Expression as a tab (the full renderer, the shell's `expression.html`, in a frame): kept, closed and
  returned from like any page; its contents are its scenes; the graph follows the pages it is about.
- **Figures** are authored in the corpus (image paragraph + caption paragraph) and rendered as figures; click enlarges.
  Plates and diagrams live in their field folders; they are not a group of their own.

## Build side (what the browser reads)

| File | Role |
|---|---|
| `quartz/util/essayField.ts` | One model: classifies every page (rooms, movements, arguments, symbolon offices), labels it, resolves links, builds the explorer tree. Feeds the emitter and the server-rendered head, pager and breadcrumbs. |
| `quartz/plugins/emitters/fieldIndex.ts` | `static/fieldIndex.json` (~0.6 MB): nodes, links, rooms, movements, tree. The graph, explorer, search results and breadcrumbs need nothing else. |
| `quartz/components/Field.tsx`, `renderPage.tsx` | The page anatomy and its regions. `.graph-container` stays in the right sidebar (the `finalizeEssayDist` contract). |
| `quartz/components/scripts/field/*.ts` | The reading UI, mounted on Quartz's `nav` event and unmounted on the next; tabs, open folders and the full-text index outlive a page turn. |
| `quartz/styles/field.scss`, `custom.scss` | The skin: the O:I shell's own tokens (paper `#fbfaf6` / black `#0b0b0c`, gold), light and dark. No font service is called. |

Contracts that did not move: the shell links to `./essay/`; `essay/index.html` carries a title and `.graph-container`;
`quartz-source.json` and `404.html` are emitted; `vercel.json` and the host rules are untouched.

## The Expression layer (build side)

| File | Role |
|---|---|
| `site/essay-expressions.mjs` | Reads the curated collection as it stands (`PUBLICATION-CURATED.json` → the cradle's `return-of-zero` manifests, plus the S0–S5 product journeys when their checkout is present) and writes `essay/expressions/`: `index.json` (`oi.essay-expressions/v1`), each exact `oi.journey` body (`x/<id>.journey.json`, digest in the index) and a 640 px cover. Missing sources are named in `absent`, never replaced. |
| `site/essay-expression-map.json` | Authored: which essay pages each member is *about* (anchored slug patterns, `range` for C01–C32). 52 members → 434 pages; the product members live in the gallery only. Change it here. |
| `site/build-essay-quartz.mjs` | Plans before the Quartz build (the index feeds `quartz/util/expressionIndex.ts`: page chips, `x` in `fieldIndex.json`), writes the bodies after it. |
| `site/expression.html`, `site/src/expression/` | The full renderer: verifies the body's SHA-256, then plays it with the same production adapter the Library used (`PublicField`). `?x=<id>&scene=<id>&embed=1&theme=`. |
| `quartz/components/scripts/field/library.ts`, `tabs.ts` | The gallery view and the Expression tab. |

The old Library publication shelf (`library.html`, `build-return-of-zero-publications.mjs`, the byte-verified editions) is
untouched: CI still gates on it. The essay field is now the way in; retiring that pipeline is a separate decision.

## Pipeline repairs made on the way

1. **Internal links.** Corpus links are true relative file paths; Quartz resolved them from the vault root unless the file
   name was unique, so ~26,000 of ~50,000 internal links pointed nowhere. They now resolve against the linking page (197
   remain, all to withheld or unstaged pages such as `WHOLE-FIELD`).
2. **Images.** Raster images under `symbolon/**/images/` are staged and published (21 MB); relative `src` paths are no longer
   mangled; every `<img>` carries intrinsic `width`/`height` and loads lazily, so the reading position cannot drift.
3. **Wikilink aliases** may contain `#` (the corpus writes `#4` in aliases): 62 pages no longer show literal `[[…]]`.
4. **Projection.** The page-title `h1` and corpus scaffolding (*Write here / Where you are / Open beside it*, the
   *Movement 16 of 48 · Previous · Next* line) are left out of the reading view; the breadcrumbs and the pager do those jobs.

## Verifying

```
npm run build:essay-quartz            # emits .public-edition/essay
npm run test:essay                    # includes essay-field.test.mjs (model, tree, link resolution), essay-expressions.test.mjs and the image staging test
python3 tests/essay-reader-controls.py   # the reader in a real browser: root and /O-I bases; desktop, phone (OI_ESSAY_PUBLIC=<dir> to serve another copy)
python3 tests/essay-host-smoke.py     # deep links against the built dist (needs build:public)
```

## Known limits

- Search is a folded substring scan, not FlexSearch; it ranks by title, path and hit density. Quoted phrases work.
- The graph is a small SVG force layout on the local neighbourhood (no global graph); splitters are not draggable.
- Not exercised: iOS Safari, Android, a screen reader (the connections list is the keyboard-accessible twin of the graph).
- Seven image fits were flagged weak by the procurement pass (Chartres, the Mercator/Ortelius pairings, the zero images,
  Owen, Signorelli, the dew web): a corpus judgement, not a layout one.
