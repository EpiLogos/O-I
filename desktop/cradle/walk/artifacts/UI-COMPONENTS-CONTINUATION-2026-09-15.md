# UI component continuation — 15 September 2026

Scoped continuation of the commissioned parallel UI lane, from O:I
`be172a109f2f5e307cc34a8c0f62cfdc6e5825b1` on
`agent/ui-components-continuation`. Parent integration owns the final mainline
basis, theme authority, shell, runtime lifecycle and native-owner convergence.

## Implemented

- Expression retains its native document, scene/entity selection, presentation,
  source binding, disclosed Actions, proposals, pedagogy, export and file paths.
  The selected entity inspector now follows its selection row. Numeric controls
  use the shared input grammar; Enter commits, Escape restores, invalid numbers
  are explained without mutation, and both revision-conflict recovery choices
  preserve the native expected-revision boundary. Recovery buttons are outside
  input labels. Scene navigation scrolls within the composition at narrow widths.
- Knowledge retains the actual bounded owner graph, canvas, search/read mapping,
  selection, movable/resizable inspector, provenance, native Action dispatch,
  pins/follow, page promotion, browser/native popout distinction and travel.
  Its controls, disclosures, actions and sidecar consume the existing desktop
  grammar. The selection tools and Expression occupy the same free region used
  by graph-camera accommodation, avoiding the inspector. The Expression host
  inherits the canonical light/dark canvas ground.
- New knowledge projections centre a single member and size bounded groups to
  fit the native stage. The former 500-unit displacement and 1.4 scale clipped a
  single glyph. Existing parameters remain untouched, including human layout.
- Removed unused SVG graph selectors/animations, obsolete graph chrome classes,
  duplicate detail/footer/content declarations and the hidden detail point mark.
  Search and exact owner dispatch outcomes retain their current contracts.

## Executed evidence

From `desktop/cradle`:

```sh
npx tsc --noEmit
npm run build
node tests/knowledge-expression.mjs
node tests/knowledge-projection-geometry-browser.mjs
WALK_URL=http://localhost:4322 WALK_BRIDGE_PORT=4331 \
  CARGO_TARGET_DIR=/Users/admin/Central/Work/O-I/target CARGO_INCREMENTAL=0 \
  OI_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  node walk/run.mjs expression-controls knowledge-expression
```

TypeScript and production build pass. Native preservation/grammar assertions:
13 pass. Browser geometry uses the shipped glyph sampler and camera for all
1–10 member cardinalities at 300×220, 600×200 and 900×600. The real app also
samples rendered glyph pixels and verifies they stay within the artboard.

- [Expression controls receipt](expression-controls.json): 14/14; numeric
  validation, concurrent owner revision, both recovery choices, keyboard and
  widths 1000, 760, 640 and 639px. Isolated native Central setup; no mock transport.
- [Knowledge receipt](knowledge-expression.json): 21/21; actual AIKit/semantic
  wiki search/read/local-whole operations, dirty-source preservation, exact refs,
  contextual geometry, real rendering, dark host ground, pins/follow and travel.
- Visuals: [Expression light](expression-controls-expression-light.png),
  [dark](expression-controls-expression-dark.png),
  [narrow](expression-controls-expression-narrow.png),
  [graph and inspector](knowledge-expression-graph-context-light.png),
  [graph Expression in dark](knowledge-expression-graph-expression-dark.png),
  [narrow graph](knowledge-expression-graph-context-narrow.png).

The final walk uses dev instrumentation and the real native kernel. The
production build was checked independently. The projection geometry browser
check has its own transient Vite test server (default port 4334); it does not
require test-source imports to exist in a production walk bundle.

## Limits and retained evidence

This lane does not claim #65 human experience acceptance or native detached
window verification. SharedField is unavailable in this isolated worktree's
walk because its separate client dependencies were not installed; the returned
absence remains visible. Build warnings for existing large entry/Three/editor
chunks and mixed static/dynamic Tauri imports remain.

The first graph run exposed control/inspector overlap and failed before pinning;
free-region placement repairs it. An initial test expected `data-theme=light`,
although the actual light contract omits that attribute; the assertion now
checks resolved appearance. These did not weaken native operation assertions.
Local before and intermediate screenshots remain under `ui-components/` and
`*-failure.png` in this worktree, outside the committed final evidence set.
