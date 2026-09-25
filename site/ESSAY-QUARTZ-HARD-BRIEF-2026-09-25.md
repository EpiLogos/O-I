# Hard brief — Quartz is the essay system, restyled night

Written 2026-09-25 by the production-deploy lane, on the owner's instruction,
after `dde7cb38` + `d68aef80` shipped a custom React essay shell that dropped
everything the owner uses Quartz for. The owner's words define the target:
"make the quartz setup look similar to the html setup, with the graph, and
ensure the routing etc is clean and genuinely usable."

## What went wrong (so it is not repeated)

`dde7cb38` ("Plate B essay shell for The Return of Zero") replaced the Quartz
reading surface with a purpose-built React shell and — in
`essay-host.ts :: finalizeEssayDist` — made the public build actively delete
any `essay/**` tree and refuse to publish Quartz HTML. What the owner lost,
and named explicitly:

1. the graph (the shell's "local graph" is a bullet list, and only on reading
   pages — at the reading root there is none);
2. folder nesting (the shell flattens the vault into six flat "office" lists);
3. sidebar control (both shell sidebars are fixed; no collapse, no drawer);
4. familiar Quartz reading chrome (backlinks, TOC, search, clean URLs).

## The target, non-negotiable

1. **Quartz owns `/essay`.** The published essay is a Quartz v4 build of the
   vault (`Antykathera-Essay-Work`, `submission-package/essay`), served at
   `/essay/**` from the same deploy as the Plate A home.
2. **Real graph.** Local graph on every page and the global graph available;
   rendered by Quartz's own graph components, not a list standing in for one.
3. **Nested explorer.** The left explorer mirrors the vault's folder tree
   (section-rooms → movements, symbolon, manuscript) with collapsible folders.
4. **Sidebar control.** Quartz's collapse/drawer behaviour ships unimpaired;
   the reader can put the sidebars away.
5. **Backlinks and TOC** present on reading pages.
6. **Night skin.** The Quartz build is themed to the Plate B palette so the
   essay and the html entrance read as one publication:
   `--night #141311`, text `#e6e0d4`, muted `#a39b8c`, link `#d7c4a3`,
   accent gold `#b08958`, hairlines `#3a372f`, serif stack
   Iowan Old Style / Palatino / Georgia.
7. **The home stays Plate A.** `/` unchanged: mark left; Library + Essay
   right; two doors; no Menu; no product tiles; no install links.
8. **Routing is clean and genuinely usable.** `/` serves Plate A (200, never
   a redirect into the essay). `/essay` and `/essay/**` deep links cold-load
   the right page. Quartz pages carry depth-correct relative asset paths, so
   folder pages live at trailing-slash URLs (Vercel's directory
   normalisation provides this; do NOT set `trailingSlash: true`, which
   slashes file pages and breaks `cleanUrls`) while file pages resolve
   `path.html` via `cleanUrls`. Legacy vault addresses (`/section-rooms`,
   `/symbolon`, `/manuscript`) redirect into the essay. A missing essay path
   falls back to the reading root on Vercel and to the Quartz not-found page
   on Pages. The deploy-side config (dist/vercel.json and the
   dist/.vercel project link) is restored by the build itself
   (`write-vercel-deploy-config.mjs`) because Vite empties dist on every
   build. No stub pages, no meta-refresh.
9. **Content scope stays curated.** The published publication scope already
   fixed by `essay-browser.mjs` (no quilt, NOTES, reference-notes, or JSON)
   is the same scope Quartz publishes. The vault source is the local
   checkout when present, else the pinned remote ref
   (`fix/publish-readiness-2026-09-24`), and the build stamps which commit
   it published.
10. **The build cannot ship a Quartz-less essay again.** `finalizeEssayDist`
    inverts: the public build now REQUIRES `essay/index.html` from Quartz and
    FAILS if the essay is missing. The old guard (delete `essay/`, refuse
    Quartz HTML) is gone, replaced by its mirror image.
11. **Tests tell the truth.** `essay-host-smoke.py` verifies the Quartz
    contract (essay 200, deep link, graph asset, night skin); the shell unit
    tests stay scoped to the shell's own modules. The React shell source
    stays in the repository, unbuilt — the essay lane's work is not deleted,
    it is stood down from production.
12. **No review PRs.** Work lands on `main` directly, as this lane's
    commission states.

## Vendoring and provenance

Quartz v4 is vendored at `site/vendor/quartz` (upstream `jackyzha0/quartz`,
`v4` branch, pinned commit recorded in `PROVENANCE.json` beside it, MIT).
Theme and layout changes for the night skin live as small committed diffs on
top — no upstream history rewrites. Vault content is staged fresh at build
time; the vault is not committed into this repository.

## Acceptance (executed evidence, not tone)

- `npm run build:public` in `site/` completes with `dist/essay/index.html`
  present and stamped with the vault commit.
- Preview + real browser: graph renders, explorer shows the nested tree and
  folds, backlinks/TOC present, night palette correct, sidebar collapses to
  a drawer at mobile width.
- `curl` matrix on production: `/` → 200 Plate A; `/essay` → 200 Quartz
  reading root; a movement deep link → 200 right page; a missing path →
  served not-found.
- `essay-browser.test.mjs`, `essay-host.test.mjs`, `test:library` green;
  `essay-host-smoke.py` green against the new contract.
- Deployed to production (Vercel `oi-epi-logos`) and re-verified there.
