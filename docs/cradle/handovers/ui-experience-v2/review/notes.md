# Validation and publication notes

These checks concern only this handover and its standalone control specimen. They do not build Cradle, execute its native walks, inspect the active Mac app or establish human acceptance.

The original artifact preparation recorded 24 passing browser checks. Its initial Chromium executable lookup failed; the rerun used an installed browser via the script's fallback. The test renders the exact self-contained HTML bytes with `page.set_content`, without external/private navigation. Menu, drawer and narrow screenshots from that earlier session are not part of this source publication.

For a fresh reproducible specimen check, from the exported handover root with Python Playwright and Chromium already available:

```sh
python3 review/check_specimen.py
python3 review/validate_handover.py
```

`SPECIMEN_BROWSER` can name an existing browser. The first command regenerates its three screenshots and `review/specimen-validation.json`; the second checks document structure, links, fenced shell syntax, JavaScript syntax, all seven retained prior binding inventories and the standalone receipt. Generated files belong to the exported reference/test directory, not the production module graph.

Use the actual local Cradle screenshots and its existing build/walk suite for implementation proof. Do not count these specimen checks as native/UI integration success or use this HTML to replace the accepted Context/SSSF/Expressions bodies.

GitHub publication is documentation/reference only on its dedicated branch. No local app source, current main, owner machine, live session or deployment was changed by it. The local implementation commission remains no-commit/no-push unless separately authorised.
