# Techne design language — extraction map (T8, L5 Technē convergence)

The style authority is the **current local Expressions physics workspace**:
`/Users/admin/Documents/fluid-dynamic-typographic-point-cloud-engine/field-studies-journeys/`
(read-only reference). Per the L5 Technē Instrument Wayfinder §15, the live
local physics UI is the authority — the older hosted `ExpressionView.tsx` /
minimal `expression.css` editor styling is **not** the target. The reference
app is never modified; this package extracts its language into shared,
themable primitives.

What landed here:

- `../techne.css` — the chrome tier: `.oi-techne` opt-in scope, `--oi-techne-*`
  tokens (light + night), HUD panels, tool rail, state rules, selected-state
  grammar, the stacked-canvas stage idiom, and the
  reduced-motion / reduced-transparency / forced-colours passes.
- `../src/techne-theme.mjs` — the `theme()` derivation port
  (`deriveTechneTheme`, `applyTechneTheme`).
- `../src/techne-surface-lifecycle.mjs` — the renderer lifecycle law
  (`createSurfaceLifecycle`).
- `../checks/techne.mjs` — extraction check (also wired into `npm run verify`).
- `../tests/` — unit tests for the two modules (`npm test`).

The law of this package is unchanged: **hosts theme by overriding tokens;
consumers use `var(--oi-*)` only.** `.oi-techne` is an opt-in host scope like
`.oi-desktop`; role names never change between themes.

## 1. Token map — engine token → oi token

Mapped roles are re-grounded inside `.oi-techne` (no new names); `--oi-techne-*`
exists only where no house role covered the meaning. Every token carries a
light value and a night value.

| Reference token (file) | oi token | Notes |
| --- | --- | --- |
| `--paper` (styles.css `:root`; set per scene by app.ts `theme()`) | `--oi-world-surface` | Existing world host hook; set at runtime by `applyTechneTheme` |
| `--ink` (styles.css; `theme()`) | `--oi-world-foreground` | Same |
| `--muted` (styles.css `:root` / `.night`) | `--oi-muted` | Role map; techne values `#66685f` / `#a6a6a6` (workspace.css:151-152) |
| `--line` (styles.css / workspace.css `--ui-line`) | `--oi-rule` | Role map; `#d5d6ce` / `#333` |
| `--ui-surface` (workspace.css:151-152) | `--oi-surface` | Role map; `#f6f5f0` / `#000` |
| `--ui-ink` (workspace.css:151-152) | `--oi-foreground` | Role map; `#252720` / `#ededed` |
| `--ui-input` (workspace.css:151-152) | `--oi-techne-input` | `#ffffff` / `#111` |
| `--ui-wash` (workspace.css:151-152) | `--oi-techne-wash` | Solid chrome hover wash `#e9eae2` / `#202020` |
| `--wash` document tier (styles.css `:root` / `.night`) | `--oi-techne-wash-veil` | Translucent over-canvas wash |
| `--panel` (styles.css `:root` / `.night`) | `--oi-techne-hud-solid` | Same role (rgba .97 ground) |
| `--hud-glass` (workspace.css:194-195) | `--oi-techne-hud-glass` | `rgba(246,245,240,.56)` / `rgba(0,0,0,.42)` |
| `--hud-solid` (workspace.css:194-195) | `--oi-techne-hud-solid` | `rgba(246,245,240,.97)` / `rgba(0,0,0,.97)` |
| `body(.night).hud-contrast --hud-glass` (workspace.css:291-292) | `--oi-techne-hud-contrast-glass` | `.86` / `.80` |
| `--accent` (styles.css `:root` / `.night`) | `--oi-techne-accent` | `#8b5844` / `#d0b48b`; aliased to `--oi-focus` / `--oi-accent` inside the scope |
| `--shadow` (styles.css) | `--oi-techne-shadow-menu` | Menus only; solid chrome is shadow-none (workspace.css:202) |
| `--panel-width` / `--panel-height` (workspace.css:205-206) | `--oi-techne-panel-width` / `--oi-techne-panel-height` | Shared defaults (280/600); hosts and resize handles override per panel |
| `--footer-height` (workspace.css:251) | `--oi-techne-footer-height` | 44px |
| `--automation-height` (workspace.css:264; set by app.ts `renderLive`) | `--oi-techne-automation-height` | 0px / 160px |
| `--field-line` (workspace.css:357) | `--oi-techne-field-line` | `calc(footer + 36px)` shared floor |
| `--sans`, `--serif` (styles.css `:root`) | *not extracted* | Deliberate: the house stacks (`--oi-font-sans`/`--oi-font-mono`) stand; instrument faces stay instrument-native (§15 parity) |

Z-altitudes: the reference HUD z values (masthead 70, panels 21-45, modes 75)
map onto the house layers (`--oi-z-nav-top`, `--oi-z-nav`, `--oi-z-popover`);
no new z tokens.

## 2. Chrome grammar

- **Top bar** (`.oi-techne-bar`): one full-width glass row above the stage
  (masthead, workspace.css:196/:301); grid `1fr auto 1fr`, hairline bottom.
- **Tool rail** (`.oi-techne-rail`, `.oi-techne-tool`): a transparent row of
  `aria-pressed` toggles riding the bar; dividers between groups; quiet-reveal
  nav at 45% opacity until hover/focus/expanded (workspace.css:200).
- **Contextual panels** (`.oi-techne-panel`): glass ground, hairline border,
  blur 10px, radius 8px, **solidify on `:hover`/`:focus-within`**
  (workspace.css:202-203). Variants: `--quiet` keeps glass under the pointer
  (the studio law, workspace.css:213); `--opaque` is born solid (assignment
  sheets, header menus). Placement is composition and stays with the host;
  the reference places the sequence panel left, toolbelt right, studio as the
  single authoring surface, context panels local to the selection. Panels are
  resizable through a handle writing per-element `--oi-techne-panel-*` values.
- **Transport** (`.oi-techne-transport`): compact bottom instrument that
  expands in place to carry the timeline (`data-expanded="true"`, width
  transition `.28s cubic-bezier(.2,.8,.2,1)`, expanded ground hud-solid).
- **Presentation mode**: the host sets `data-presentation="true"` on the scope
  and `inert` on covered work; `.oi-techne-chrome` descendants hide, a single
  return control (`.oi-techne-present-return`) rests at 15% opacity and wakes
  on hover/focus (app.ts `renderAll`/`renderLibrary`; styles.css
  `.presentation`/`.present-return`). No universal toolbar appears in
  presentation — the artwork stands alone.
- **Native choice lists and scrollbars**: selects get an opaque themed surface
  (workspace.css:328-334); scrollbars are transparent until the surface is
  used (workspace.css:342-347).

## 3. The three state rules

1. **Wash hover** — pointer feedback is a wash, never a shadow
   (`.oi-techne-panel button:hover`, `.oi-techne-row:hover`).
2. **Ink-inversion active tool** — pressed/selected controls paint surface
   with foreground ink: `[aria-pressed="true"]`, `[aria-selected="true"]`,
   `.oi-techne-button-primary` (workspace.css:156/:188/:298/:396).
3. **Accent-outline focus-visible + .42 disabled** — `outline: 2px solid
   --oi-techne-accent; outline-offset: 4px`; `:disabled` is `opacity: .42;
   cursor: not-allowed` (styles.css:1). Dense embedded controls take the 1px
   form (workspace.css:24).

**Selected-state grammar**: a selected row takes the wash
(`data-selected="true"`, `[aria-current="page"]`); a selected card takes the
ink border plus 1px ring; selection dots carry the accent; carousel cards lift
3px on hover/focus.

**Arrival**: panels enter once with `panel-arrive` (7px rise, .99 scale, 230ms)
and use `@starting-style` + `transition-behavior: allow-discrete` for
hidden↔shown where supported (workspace.css:244-250).

## 4. The theme() derivation

Ported verbatim in `../src/techne-theme.mjs` (app.ts `theme()`, line 99):

```js
luminance   = 0.2126*R + 0.7152*G + 0.0722*B     // scene background, 0..255
night       = appearance === 'dark' || (appearance === 'scene' && luminance < 100)
hudContrast = (appearance === 'dark' && luminance >= 100)
           || (appearance === 'light' && luminance < 100)
```

`appearance` is the workspace-appearance preference (`scene | dark | light`,
the Studio → Interface select). `night` selects the dark token scope;
`hudContrast` fires when the preference **opposes** the scene's natural tone —
the HUD glass solidifies so chrome stays legible over an opposite-tone
artwork. `applyTechneTheme(root, {paper, ink, appearance})` writes
`data-techne-night`, `data-techne-hud-contrast` and the world host hooks
`--oi-world-surface` / `--oi-world-foreground`; techne.css does the rest.
While the engine runs, hosts re-apply on telemetry (the reference re-reads
`native.background` every tick).

## 5. The surface lifecycle law

Ported in `../src/techne-surface-lifecycle.mjs` from app.ts's single `tick()`
plus `FieldEngineAdapter` (engine.ts) and context-lost recovery
(production.ts):

- **One renderer lifecycle per active surface.** One rAF loop, one dirty
  flag; instrument surfaces never grow duplicate animation loops.
- Raw delta clamps to 0.25s (a background stall never jumps the field); while
  playing, a frame advances at most 0.05s.
- Delta gating: paused surfaces repaint dirty frames at delta 0; only playing
  surfaces advance.
- A frame draws only when playing, or the surface was marked dirty, or the
  renderer reports `needsFrame()`; the flag clears after the draw.
- `document.hidden` auto-suspends; resume re-bases the clock so no spike
  lands.
- A render throw stops the loop and reports through `onError` — recovery
  (rebuild, replay) stays the host's decision, exactly as the reference
  surfaces its GPU-recovery panel instead of tearing down.

```js
import { createSurfaceLifecycle } from '@epilogos/oi-design-system/techne-surface-lifecycle';
const surface = createSurfaceLifecycle({ acquire, release, render: (delta) => engine.render(delta), needsFrame: () => engine.needsRender(), fpsCap, onError });
surface.start(); surface.setPlaying(true); surface.markFrameNeeded();
// visibilitychange is wired internally; dispose() is terminal.
```

## 6. Parity rules (Wayfinder §15)

- **Native instrument controls stay native.** The shared tier supplies tokens,
  surfaces, state grammar and lifecycle — never a replacement for an
  instrument's own controls. A piano stays a piano.
- **No universal toolbar.** The rail/bar grammar is available; instruments
  compose from it only what their native controls need. Nothing subscribes
  every instrument to one global chrome.
- **Hosts theme; consumers consume tokens.** An instrument adopting the family
  imports `techne.css`, applies `.oi-techne`, and calls `applyTechneTheme`
  with its scene/paper ground; it does not fork the palette or hardcode
  chrome colours.
- **The live local physics UI is the authority.** Where the older hosted
  ExpressionView styling disagrees with the reference app, the reference app
  wins.

## 7. Usage (instrument-lane handoff)

```html
<link rel="stylesheet" href="…/tokens.css">
<link rel="stylesheet" href="…/techne.css">
```

```js
import { applyTechneTheme } from '@epilogos/oi-design-system/techne-theme';
import { createSurfaceLifecycle } from '@epilogos/oi-design-system/techne-surface-lifecycle';

const host = document.body;            // carries .oi-techne
applyTechneTheme(host, { paper: scene.field.background, ink: scene.field.palette[0], appearance: 'scene' });
```

Markup roles: `.oi-techne-stage` (stacked canvas layers `--paper`, `--field`,
`--transition`, `--veil`, `--guides`, `--text`), `.oi-techne-bar` +
`.oi-techne-rail`/`.oi-techne-tool`, `.oi-techne-panel` (`--quiet`/`--opaque`)
for every contextual panel, `.oi-techne-transport` for the bottom instrument,
`.oi-techne-row`/`.oi-techne-card` for selectable lists, state via
`aria-pressed` / `aria-selected` / `data-selected` / `:disabled` — the same
grammar the reference app speaks.

## 8. Verification

`npm run verify` (package) runs the standing design-system check plus
`checks/techne.mjs` (balanced braces; both scopes define every
`--oi-techne-*` token; the luminance table; attribute/CSS agreement; gold
scarcity). `npm test` runs `node --test` over the two modules.
