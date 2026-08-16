# O:I visual assets

This directory contains the production vector marks and the visual studies supplied for the public O:I site.

## Production marks

- `oi-mark.svg` — braced `{O:I}` mark used as the primary identity.
- `oi-glyph.svg` — unbraced `O:I` glyph for compact contexts.
- `oi-cube.svg` — isometric O:I cube derived from the supplied cube studies; used as a secondary structural mark.

The production marks are background-free SVGs so the site can invert cleanly without raster cut-outs, remote imagery or a required external brand font.

## Current production decisions

The public front door uses the supplied studies as design input rather than runtime decoration.

- the hero is built from raw SVG geometry and separates braces, ring, colon and bar into parallax layers;
- the opening remains a white field that transitions to black while the same mark inverts through `mix-blend-mode`;
- black, white, fine rules, generous space and typography carry the base visual system;
- gold is exposed as the semantic `--oi-meta-relation` token and is intentionally scarce;
- on the front door gold marks an active connective relation/programme, not ordinary CTA emphasis;
- the newer monogram/colon-above and framing studies remain reference material rather than replacement production identities;
- semantic design tokens live in `site/src/tokens.css` so future shared-field world presentation can remap meaning without coupling the public page to participant-specific theming.

## Reference studies

`reference/` preserves the twelve supplied visual studies as web-optimised source/reference material. They are not runtime dependencies of the production hero.

Current studies:

1. visual-system board
2. particle O:I
3. braced mark
4. square glyph
5. cube, large
6. cube, small
7. geometric study
8. construction study
9. monogram with colon above
10. geometric O:I / construction-axis study
11. nested-square O:I study
12. offset-frame O:I study

The final four continue to inform typographic, connective and framing decisions without being promoted automatically into production marks.
