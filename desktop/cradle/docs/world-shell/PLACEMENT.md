# Where the new shell lives

Copied 11 October 2026 from the reverse-engineering campaign so the design
sits in the cradle tree with the app. The campaign copy remains at
`desktop/cradle/docs/world-shell/`.

- **This directory** holds the design pack: `WORLD-SHELL-DESIGN.md`, the
  mockups, `icon-cut.html`, the port and instrumentation contracts, and
  `wayfinder/` (the product plan `DLW-PLAN.md`, the pane ontology, and the
  wholesale port map).
- **The shell code** is `packages/live-shell`. It is not a second app inside
  `desktop/cradle/src`. The cradle tree is still the installed legacy app
  (`org.epilogos.oi.cradle`). The successor named in
  `LEGACY-CRADLE-RETIREMENT.md` is `org.epilogos.oi.live-shell`. Cutover
  stays owner-named; the wholesale port mounts the cradle's working
  components (terminal, browser, documents, chats) into the shell's panes.
- **Not copied:** the campaign's `evidence/`, native build stages, and
  package snapshots (about 4.4 GB). Those stay in the campaign directory.
- **The face rig** is `~/Central/Work/face-rig`. The campaign still holds a
  duplicate `face-rig.html`; it was not copied here again.
