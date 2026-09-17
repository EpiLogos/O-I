# @epilogos/oi-design-system

The O:I house visual vocabulary, extracted from the live production
language in `site/src` (issue #25 extraction list; cradle-rebuild wayfinder
D9 + law 11). The original tokens preserve that extraction. The desktop
extension (`.oi-desktop`, opt-in) carries the owner-approved desktop ground:
canonical neutral light and dark appearances (owner revision 15 September
2026, superseding the olive palette of 6 September) plus the point-cloud and
loading language. See [DESKTOP-LANGUAGE.md](DESKTOP-LANGUAGE.md).

## The law

- **Consumers use `var(--oi-*)` only.** No raw colours, spacing, font
  stacks, type sizes, radii, z-layers, motion durations/easings, or focus
  ring values in consumer source. (Enforced for the cradle by
  `checks/verify.mjs`.)
- **The host themes.** Hosts theme a surface by overriding these tokens
  (or applying `.oi-surface-light` / `.oi-surface-dark`); role names never
  change between themes.
- **Bodies never self-chrome.** Composable and agent-native bodies
  (contributions, rich surfaces) are themed by the host through provided
  chrome/context — anything entering the app speaks this house language.
- **Gold stays scarce.** `--oi-gold` exists only to feed
  `--oi-meta-relation` (the meta-relation role). No other token may carry
  the gold value, and no new gold roles are added.

## Vocabulary sections (`tokens.css`)

Each section below maps to a `/* ===== section: … ===== */` marker in
`tokens.css`; `checks/verify.mjs` asserts every section is non-empty.

### Foundation tokens
The colour ground: `--oi-black`, `--oi-white`, `--oi-paper` (soft
writing-paper ground), `--oi-ink`, `--oi-gold`. Referenced by the semantic
roles; consumers should reference the roles, not the ground.

### Semantic tokens — surface / text / muted / rule roles
`--oi-surface`, `--oi-foreground`, `--oi-muted`, `--oi-rule`,
`--oi-focus`, `--oi-projection`. These are the roles every surface paints
with; the `.oi-surface-light` / `.oi-surface-dark` classes re-map them for
dark sections without renaming anything.

### Relation / focus / projection roles — scarce gold meta-relation
`--oi-relation` (a visible relation between things), `--oi-meta-relation`
(gold — the one scarce meta-relation accent), plus the world host hooks
`--oi-world-surface` / `--oi-world-foreground`: a world provider may
override them to carry its own ground (the site's `world-presentation`
pattern); they default to paper/ink.

### Spacing / rhythm
`--oi-space-1` … `--oi-space-7` (0.5rem → 4rem) and the section rhythm
`--oi-section-x` / `--oi-section-y`. Derived sizes are built from these
(`calc(var(--oi-space-7) * 4)`), not from new raw values.

### Typography
Family stacks `--oi-font-sans` (the site body stack) and `--oi-font-mono`
(the site code stack); scale steps `--oi-type-xs`, `--oi-type-sm`,
`--oi-type-body`, `--oi-type-title`, `--oi-type-display`; label tracking
`--oi-tracking-label`.

### Radii
`--oi-radius-xs` … `--oi-radius-xl` and `--oi-radius-pill`, from the
site's authored-surface language. The default house edge is square — radii
are the exception, used only where the site already uses them.

### Z-layers
`--oi-z-nav` (sticky app bars), `--oi-z-nav-top` (front-door nav above
stage layers), `--oi-z-drawer` (sliding side panes), `--oi-z-popover`
(modal popover planes), `--oi-z-notice` (floating notices above all).
Local stacking inside one component (0–5) is not a house layer.

### Motion
`--oi-motion-fast`, `--oi-motion-normal`, `--oi-motion-ease`. Under
`prefers-reduced-motion: reduce` the durations collapse to `0.01ms`, so
transitions built from the tokens degrade automatically; consumers
animating via raw keyframes or JS timings apply the same convention
themselves.

### Focus / keyboard states
The keyboard ring: `--oi-focus-ring-width` (2px of `--oi-focus` on
`:focus-visible`) with `--oi-focus-ring-offset` (dense/app surfaces) or
`--oi-focus-ring-offset-loose` (spacious front-door surfaces).

## Identity assets (`assets/`)

The production vector marks, copied verbatim from
`site/public/media/brand/`: `oi-mark.svg` (braced `{O:I}` primary mark),
`oi-glyph.svg` (unbraced compact glyph), `oi-cube.svg` (secondary
structural mark). Background-free SVGs that invert cleanly — colour them
via `currentColor` / `--oi-foreground` at the use site.

## Checks

`npm run verify` (in this package) parses `tokens.css`, asserts every
vocabulary section is non-empty, asserts no duplicate token names within a
scope, asserts gold stays scarce (only `--oi-gold` and
`--oi-meta-relation` carry the gold value), asserts the reduced-motion
convention is present, then audits `desktop/cradle/src`: every
`var(--oi-*)` reference must resolve to a defined token, and raw hex /
rgb(a) / hsl(a) colours must be zero.

## Migration note (#25)

The public site keeps its own `site/src/tokens.css` today and does not yet
import this package — by design: extraction means the vocabulary now
exists here and is faithful to the site's values; the site migrates
incrementally with regression evidence, never in the same stroke.

### Desktop grammar (`desktop.css`)

The small shared vocabulary of desktop chrome, extracted 2026-09-15 from the
patterns the application already repeated: quiet icon actions (`.oi-tool`),
text actions and groups (`.oi-action`, `.oi-action-primary`,
`.oi-action-group`), the compact tool row (`.oi-tool-row`), contextual heads
(`.oi-context-head`), eyebrows (`.oi-eyebrow`), plane navs whose current
state is `aria-pressed`/`aria-selected` (`.oi-plane-nav`), disclosure
(`.oi-disclosure`, `.oi-section`), reference material (`.oi-ref`,
`.oi-ref-row`, `.oi-kv`, `.oi-state`), menus and inputs (`.oi-menu`,
`.oi-menu-item`, `.oi-input`, `.oi-field`), sidecars (`.oi-sidecar`) and the
named states (`.oi-empty`, `.oi-refusal` / `[role=alert]`, `.oi-note`). A
surface keeps its own information architecture and meaning classes and
composes these for its chrome; no class here claims a capability the owner
does not offer. Tokens only.

### Native Expression and pending status

Import `tokens.css`, `desktop.css` and `point-cloud.css`; the latter now owns
only placement of the shared `.oi-expression-surface` and quiet status text.
The O:I host owns one native canvas/context/clock per window and borrows it
for focused surfaces. `./expression` exports semantic names and gesture
admission only; the former Canvas2D factory and procedural point generator
are retired. Components use the host Stage's express/update/release handles.
The actual native field projects cue glyphs and target geometry when no
foreground presentation or retained-field reservation has priority. Static
cues draw once. Native formation capacity bounds admission without truncation.

`./loading` retains `createLoadingIndicator({label, detail, scope, active})`
as a portable accessible DOM status body with `update` and `remove`. Scope and
active are metadata; the host owns placement and observed operation state.
There are no masked logos, CSS clusters, animation clocks or alternate loading
renderers. `createPointClusters`, `.oi-point-cloud`, the loader-mask rules and
their unused tokens are removed. Branded SVG assets remain identity assets.

Run `npm run verify` for token use and `npm run verify:browser` for actual
portable status updates, safe text, focus, light/dark, forced colours and narrow
layout. `node checks/expression-browser.mjs` runs the actual Cradle provider/native
cue lifecycle test through an isolated Vite server; it creates no reference
renderer. The Nara retained-field check additionally requires an actual
`QL_NARA_SNAPSHOT` produced by the native QL example. The examples document
portable grammar; production Expression is inspected in the real desktop.

See [DESKTOP-LANGUAGE.md](DESKTOP-LANGUAGE.md) for the dated owner revisions.
