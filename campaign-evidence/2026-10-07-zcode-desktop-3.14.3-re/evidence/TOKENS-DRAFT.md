# ZCode Desktop 3.14.3 — UI Token Sheet (Lane A1 draft)

Original documentation of observed design tokens in the ZCode desktop renderer.
Observed values are quoted from the app's own compiled CSS/JS; role names in
brackets are this study's naming, not the app's. Nothing here is copied source.

Corpus root: `/tmp/zcode-re/asar/` (extracted app tree)
Primary CSS bundle: `out/renderer/assets/styles-C8Nayk5k.css` (410 KB, Tailwind v4 output, minified — single line; evidence cites the rg-findable token text)
Theme table dump: `/tmp/zcode-re/a1-ui/root-tokens.txt` (317 root tokens), `/tmp/zcode-re/a1-ui/dark-tokens.txt` (142 dark overrides)

## 1. Token system shape

- The design system is **Tailwind CSS v4 `@theme`** compiled to `:root,:host` custom
  properties; the app redefines semantic aliases over Tailwind's stock scales.
- Two theme layers: a light **default** (`:root,:host`) and a **`.dark` class override**
  (142 property overrides). No `[data-theme]` attribute is used.
- Semantic color roles are *indirect*: most `--color-*` roles resolve to palette
  stops (`var(--color-sky-600)`, `var(--color-neutral-900)`), which are
  oklch values defined in the same table. Alpha-tinted literals (`#0a0a0a1a`,
  `#ffffff0d`) are used for hairline borders and surface overlays.
- A user-scalable UI type scale derives from one runtime variable
  `--ui-font-size: 14px` (`:root{--ui-font-size:14px}` in styles CSS, near the
  `html,body,#root` reset) via `calc()` steps.

## 2. Color roles (observed; light = default, dark = `.dark`)

| Role (app name) | Light | Dark |
|---|---|---|
| `--color-background` | `var(--color-neutral-50)` oklch(98.5% 0 0) | `var(--color-neutral-900)` oklch(20.5% 0 0) |
| `--color-foreground` | `var(--color-neutral-700)` | `var(--color-neutral-200)` |
| `--color-foreground-subtle` | `#40404099` | `#e5e5e599` |
| `--color-foreground-subtlest` | `#40404066` | `#e5e5e54d` |
| `--color-border` | `#0a0a0a1a` (10% ink) | `#fafafa1a` (10% paper) |
| `--color-border-hover` | `#0a0a0a33` | `#fafafa4d` |
| `--color-surface` | `#0a0a0a08` (3% ink overlay) | `#ffffff0d` (5% paper overlay) |
| `--color-surface-hover` | `#0a0a0a0d` | `#ffffff1a` |
| `--color-selected` | `#0a0a0a1a` | `#ffffff1a` |
| `--color-sidebar` | `var(--color-neutral-100)` | `var(--color-neutral-950)` |
| `--color-panel` / `--color-header` | `var(--color-neutral-100)` | `var(--color-neutral-900)` |
| `--color-card` | white | `var(--color-neutral-800)` |
| `--color-popover` / `--color-menu` | white | `var(--color-neutral-800)` / `neutral-950` |
| `--color-primary` (button) | `var(--color-neutral-950)` | `var(--color-neutral-50)` |
| `--color-brand` | `var(--color-sky-400)` | `var(--color-sky-500)` |
| `--color-accent` | `var(--color-sky-50)` | `#052f4a80` |
| `--color-destructive` | `var(--color-red-600)` | `var(--color-red-500)` |
| `--color-success` | `var(--color-green-600)` | `var(--color-green-500)` |
| `--color-warning` | `var(--color-yellow-600)` | `var(--color-yellow-500)` |
| `--color-input` | white | `var(--color-neutral-800)` |
| `--color-input-border-focused` | `var(--color-brand)` | `var(--color-brand)` |
| `--color-tab` / `--color-tab-active` | — (light not found) | `neutral-800` / `neutral-950` |
| `--color-toast`, `--color-tooltip` | white / `neutral-100` | `neutral-900` / `neutral-900` |

Role family beyond basics (names as observed): `--color-tag`, `--color-hover`,
`--color-diff-added`/`--color-diff-removed`, `--color-git-{added,deleted,modified,renamed,
untracked,ignored,descendant}`, `--color-terminal-*` (16 ANSI-mapped stops:
bg/fg/cursor/selection + black…bright-white mapped onto sky/green/fuchsia/red/
yellow/cyan/neutral palette stops), `--color-trajectory-{user,assistant,reasoning,
tool-call,tool-result}` (hex literals: light `#2563eb/#0f766e/#7c3aed/#d97706/#0284c7`),
`--color-usage-chart-1..6`, `--color-usage-heatmap-0..4` (color-mix ramps),
`--color-file-node`, `--color-session-node`, `--color-skill-node`,
`--color-command-node`, `--color-plugin-node` (+ `-foreground`/`-hover` variants),
`--color-interaction-ask-*`, `--color-interaction-confirmation-*`,
`--color-context-breakdown-1..7`, `--color-workflow-{rule,trace,trace-strong}`,
`--color-find-highlight{-active}`, `--animated-gradient-text-{soft,strong}`.

Palette anchor examples (observed): `--color-sky-600: oklch(58.8% .158 241.966)`,
`--color-neutral-950: oklch(14.5% 0 0)`, `--color-green-600: oklch(62.7% .194 149.214)`.

## 3. Spacing scale

Base unit: `--spacing: .25rem` (4px); all Tailwind numeric utilities derive from it.
Observed arbitrary widths used by layout: `w-[190px]`, `w-[220px]`, `w-[240px]`,
`w-[260px]`, `w-[280px]` (styles CSS), plus max-widths 220/260/420px.
Container scale: `--container-xs: 20rem` … `--container-6xl: 72rem` (stock Tailwind).

Measured geometry (from live capture, logical px; see EVIDENCE.md):
- Sidebar width ≈ 270px (measured 271 incl. 1px separator).
- Composer card ≈ 672px wide, corner radius ≈ 12px.
- Composer card height ≈ 146px total (workspace row ≈ 39px + input card ≈ 105px).
- Quick-action chip height = 32px (h-8).
- Top bar band ≈ 56px (h-14 utility present; color-uniform background makes the
  pixel boundary uncertain).

## 4. Type scale

Stock Tailwind stops (observed): `--text-xs: .75rem` … `--text-4xl: 2.25rem`, each
with a paired `--text-*--line-height` ratio calc (e.g. `--text-sm--line-height:
calc(1.25 / .875)`).

App UI scale (derives from `--ui-font-size: 14px`):
- `--text-ui-2xs: calc(var(--ui-font-size) - 5px)` = 9px
- `--text-ui-xs: -4px` = 10px
- `--text-ui-sm: -2px` = 12px
- `--text-ui-caption: -1px` = 13px
- `--text-ui-base: var(--ui-font-size)` = 14px
- `--text-ui-lg: +2px` = 16px
- `--text-ui-xl: +4px` = 18px
- `--text-mobile-input-safe: 16px` (iOS zoom guard)

Letter spacing: `--tracking-tight: -.025em`, `--tracking-wide: .025em`,
`--tracking-widest: .1em`, `--tracking-wf-label: .09em`.
Line heights: `--leading-tight: 1.25`, snug 1.375, normal 1.5, relaxed 1.625.
Weights: `--font-weight-{normal:400, medium:500, semibold:600, bold:700}`.

Font stacks (observed verbatim):
- `--font-sans: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`
- `--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", monospace`

Measured on the live dark screen: sidebar item glyph band 10px and composer
placeholder band ~11px → consistent with 14px ui-base; greeting heading glyph
band 27px → ~24px (text-2xl).

## 5. Radii / borders / shadows / blur

Radii (observed): `--radius-xs: .125rem` (2px), `sm: .25rem` (4px), `md: .375rem`
(6px), `lg: .5rem` (8px), `xl: .75rem` (12px), `2xl: 1rem` (16px), `3xl: 1.5rem`
(24px). Startup logo shell uses 24px radius (index.html).

Shadow language (styles CSS, distinct values):
- Focus/selection rings are `box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-X) 18-35%, transparent)` (danger/success/warning/foreground variants).
- Inset hairlines: `inset 0 0 0 1px color-mix(in oklab, var(--color-brand) 10-32%, transparent)`.
- kbd shadow: `0 3px 0 var(--tw-prose-kbd-shadows)` (prose).
- Startup logo: `0 20px 25px -5px rgb(0 0 0 / .2), 0 8px 10px -6px rgb(0 0 0 / .2)` (Tailwind shadow-xl values, index.html line 49-52).
Blur: `--blur-xs: 4px` … `--blur-3xl: 64px`.

## 6. Z-index

Tailwind utilities used: z-0/1/10/20/30/40/50; literal z-index values found:
60, 100, 9998, 9999, and `2147483647` for the startup loading overlay
(index.html `#loading`).

## 7. Motion

Default transition: `--default-transition-duration: .15s`,
`--default-transition-timing-function: cubic-bezier(.4, 0, .2, 1)`.
Named easings: `--ease-out: cubic-bezier(0, 0, .2, 1)`, `--ease-in-out: cubic-bezier(.4, 0, .2, 1)`.

Custom easing vocabulary observed in CSS (counts): `cubic-bezier(.16,1,.3,1)` (2),
`cubic-bezier(.34,1.56,.64,1)` (3, springy overshoot), `cubic-bezier(.77,0,.175,1)` (2),
`cubic-bezier(.65,0,.35,1)` (1), `cubic-bezier(.22,1,.36,1)` (startup logo, index.html:54).

Workflow-visual subsystem has its own motion tokens (observed values):
`--wf-ease: cubic-bezier(.22,.61,.36,1)`, `--wf-t-fast: .12s`, `--wf-t-base: .16s`,
`--wf-t-enter: .2s`, `--wf-t-ink: .32s`, `--wf-beat: 1.6s`, plus face-animation
vars (`--wf-face-blink-time`, `--wf-face-x/y`, …).

Durations in transitions/animations: .15s (dominant), .2s, .18s, .16s (startup
fade, index.html:18), .3s, .5s, .72s (startup logo pop), 5s (border sweep).

Keyframe inventory (46 named): `accordion-down/up`, `collapsible-down/up`,
`enter`/`exit`, `ping` (1s), `pulse` (2s), `spin` (1s), plus app-specific:
`zcode-stream-text-in` (opacity fade of streamed text),
`zcode-stream-marker-in` (stream marker colorizes from transparent to
`--color-foreground-subtlest`), `zcode-reaction-pop` (scale 0→1.3→.95→1),
`zcode-draft-prompt-waterfall` (clip-path wipe + translateY(-12px)),
`markdown-image-loading-shimmer`, `fork-highlight-pulse`, `task-search-result-highlight`,
`zcode-alarm-ring`, `zcode-update-charge-sweep`, `browser-use-operation-breathe`,
`workspace-remote-connecting-breathe`, `onboarding-logo-border-sweep` (conic-gradient rotation),
and 19 `wf-*` keyframes (workflow avatar/face/rail animation set).
`prefers-reduced-motion: reduce` disables the sweep animations (observed on
onboarding-logo-sweep in styles CSS and index.html:103).

## 8. Theming mechanics

- Stored key: `localStorage['zcode-theme']`; values `zai-dark` | `zai-light` |
  `system` (legacy `dark`/`light` mapped). Default when unset: **`zai-dark`**.
- Resolution (index bundle, `assets/index-jrPzjrBP.js`, search `zcode-theme`):
  `system` resolves via `matchMedia('(prefers-color-scheme: dark)')`, then
  `document` element gets the `dark` class toggled
  (`classList.toggle("dark", zcodeTheme === "zai-dark")` in
  `assets/styles-DEELZGp2.js`).
- Startup pre-paint: the same resolution runs inline before React mounts, so no
  theme flash; `#root` fades in via `body.zcode-startup-ready` (index.html:15-21).

## 9. Code-block / syntax highlighting tokens

- Shiki is the highlighter; dual-theme pair `['github-light','github-dark']`
  (`chunk-BO2N2NFS-DYX-I6EX.js`, search `shikiTheme`). ~54 theme chunks are
  code-split (github-*, one-*, laserwave, …) under `out/renderer/assets/`.
- Dual-theme bridging: token spans set `--sdm-c` (color) / `--sdm-tbg`
  (background) inline; dark mode flips via utility classes referencing
  `var(--shiki-dark,var(--sdm-c,inherit))` and `var(--shiki-dark-bg,var(--sdm-tbg))`
  (same chunk, search `sdm-tbg`).
- Code-block context defaults: `controls: true`, `lineNumbers: true`,
  `mode: 'streaming'`, mermaid preview enabled (same chunk, search
  `shikiTheme:Jb,controls`).
- i18n confirms UI: `codeBlock.copyCode` ("Copy code"), `codeBlock.wrapLines`
  ("Wrap lines"), mermaid zoom/fit/preview actions (i18n-keys.txt).

## 10. Terminal tokens

- xterm.js embedded in `assets/styles-DEELZGp2.js` (search `.xterm-` classes,
  `FitAddon`); no WebGL/Canvas/Search addon bundles found in this build.
- Backend: `node-pty` in the main process (`out/main/index.js`, search
  `node-pty`; default shell `/bin/zsh`).
- Terminal palette is token-driven: `--color-terminal-bg/fg/cursor/
  cursor-accent/selection/selection-inactive` + 16 ANSI stops mapped onto the
  app palette (see role family above; full values in root-tokens.txt /
  dark-tokens.txt lines 185-206 / 95-116).

## 11. Diff-view tokens

- Diff computation/rendering runs in a Web Worker: `assets/diffs.worker-CAavpt0L.js`
  (message protocol `initialize` / `diff` / `file` / `set-render-options`).
- Hunk model with expansion: `expansionLineCount` default **100**
  (`styles-DEELZGp2.js`, search `expansionLineCount`), `hunksRenderer` +
  `expandHunk` API (search `expandHunk`).
- Diff colors: `--color-diff-added` / `--color-diff-removed` (+ dark-mode
  `-foreground` variants) over green/red palette stops.
- i18n: `git.diff.selectFile` ("…left side switch source, expand directories…"),
  `diff.preview.truncatedLines` (truncation notice), `diff.toggle`
  (i18n-keys.txt). No unified/split toggle string found in this build.

## 12. Layout & chat-surface patterns (named, not beautified)

- App shell: custom hidden titlebar — drag regions are attribute utilities
  `[app-region:drag]` / `[app-region:no-drag]` (styles CSS).
- Left sidebar ≈ 270px: New task (⌘N), Search (⌘K), Automations, Plugin
  Marketplace; Group/Project radio filter chips; Pinned / Projects / Tasks
  sections with per-item relative timestamps; account row with model badge
  ("Max") and settings gear (`screens/01-main-chat-dark.png` + AX tree).
- Chat canvas: empty state = large watermark logo + time-of-day greeting
  (`chat.empty.greeting.lateNight` = "It's late—remember to take care of
  yourself." — matches capture `screens/01-main-chat-dark.png` verbatim) + quick-action chips.
- Message list: virtualized with the `virtua` library (27 refs) + custom
  bottom-pinning: 48px threshold classifies "at bottom"
  (`function eQ(e,t=48)`, search `stickToBottom` in styles-DEELZGp2.js); user
  scroll sets `stickToBottom` vs `hold`; direction classified
  `towardBottom`/`awayFromBottom`; `chat.scrollToBottom` pill in i18n.
- Streaming: `mode: 'streaming'` in code-block context; `zcode-stream-text-in`
  fade-in per chunk; `chat.message.toolSlice.loadMore` for long tool batches;
  body preview truncation for large messages (`chat.message.bodyPreview.*`).
- Composer: workspace selector, placeholder "Ask ZCode anything, @ to add
  context, / for commands or capabilities", `@` context / `$` skills / `#`
  sessions / `/` capability shortcuts, attachments, background-works indicator,
  permission-mode selector per backend (`mode.label.{claude,codex,gemini,glm,
  opencode}.*` — e.g. glm: build/edit/plan/yolo), model picker (GLM-5.3) and
  effort picker (Max), send button (observed in `screens/01-main-chat-dark.png`).
- Command palette / quick pick: ⌘K "Search and run commands available in this
  workspace" (AX heading observed), `quickPick.command.*` catalog (toggle
  terminal, preview, browser tabs, review tabs).
