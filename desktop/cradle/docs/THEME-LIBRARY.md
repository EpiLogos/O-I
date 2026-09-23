# Theme library — the build spec

Commissioned 2026-09-23: give the desktop a host of themes under a real
standard, selectable in Settings → Visuals, with the conversion proven
against real downloaded themes. Research return:
`ProjectCentral/now/agents/theme-library-vscode-standard-research-2026-09-23.json`.

## The standard

The **import standard is the VS Code color theme file** (JSON with comments:
`name`, `type` (`dark`/`light`), `include`, `colors` (workbench UI keys),
`tokenColors` (TextMate scope rules), optional `semanticTokenColors` — ignored).
Schema: schemastore `vscode-color-theme.json`. Upstream themes are stored
verbatim with provenance; converted docs are the app's own format.

The **app-native format is `oi.theme/v1`** — a normalized document the
converter emits:

```json
{
  "schema": "oi.theme/v1",
  "id": "dracula-dark",
  "name": "Dracula",
  "appearance": "dark",
  "source": { "format": "vscode-color-theme", "name": "Dracula Official",
               "repo": "dracula/vscode", "revision": "<sha>", "license": "MIT" },
  "tokens":  { "--oi-surface": "#282a36", "…": "chrome roles" },
  "syntax":  { "--oi-syntax-keyword": "#ff79c6", "…": "13 syntax roles" },
  "terminal": { "ansi": ["16 colors"], "cursor": "…", "selection": "…" },
  "preview": { "ground": "…", "ink": "…", "accent": "…", "strip": ["3 syntax colors"] }
}
```

## The law the build must keep

- **Roles never change** (tokens.css header, law 11): a converted theme only
  sets values of existing `--oi-*` roles. It cannot add chrome roles, rename
  roles, or put raw colors in components. New roles are additive design-system
  decisions; this build adds exactly one family: `--oi-terminal-ansi-*` +
  `--oi-terminal-selection` / `--oi-terminal-cursor` (undefined in house themes
  → terminal behavior unchanged).
- **House appearance is untouched**: the canonical light/dark blocks stay
  hand-authored. Converted themes live beside them, selected explicitly.
- **No raw JSON in user surfaces** (owner ruling 2026-09-22 §2): the picker
  renders real preview components from the index; no JSON dumps, no dev faces.
- **Acceptance from the designs, not from what got built**: the prepaint CSP
  test must still pass byte-exact (its hash pin updates with the script).

## Architecture

```
themes/upstream/*.json + catalog.json + PROVENANCE.json   verbatim downloads
        │  scripts/build-themes.mjs  (plain node, no deps)
        ▼
themes/oi/<id>.json      normalized oi.theme/v1 documents
themes/themes.css        .oi-desktop[data-oi-theme="<id>"] { --oi-…: … } blocks
themes/index.mjs         THEMES: [{id, name, appearance, preview, source}]
        imported by cradle (main.tsx, after tokens.css) + VisualsView picker
```

- **Selection model**: `theme` stays the single appearance truth
  (`light`/`dark`/`system`). A named theme adds `themeId` + `themeAppearance`
  to the visuals snapshot; picking one sets `theme` to the theme's appearance
  so every existing consumer (native window sync, terminal observer, prepaint)
  keeps working unchanged. Clearing to Light/Dark/System clears `themeId`.
- **Application**: `data-oi-theme="<id>"` on the body, alongside the existing
  `data-theme`. CSS cascade: themes.css is imported after tokens.css, and its
  attribute selector ties with `.oi-desktop[data-theme="dark"]` (0,2,0), so
  import order decides — the theme wins.
- **Prepaint**: index.html's inline script also sets `data-oi-theme` from the
  persisted record (string passthrough; an unknown id simply matches no block).
  The `script-src` sha256 pin in `src-tauri/tauri.conf.json` is recomputed for
  the new bytes.
- **Terminal**: `terminalTheme()` additionally reads the `--oi-terminal-*`
  roles when defined and re-reads on both attributes.
- **Editors**: zero changes — HighlightStyle already reads `var(--oi-syntax-*)`.

## Conversion rules

- `colors` → chrome roles through an explicit mapping table (~40 keys).
  Missing keys derive from `editor.background`/`editor.foreground` (muted,
  rules, washes via alpha over the ground) so even minimal themes ground the
  shell. Unmapped VS Code keys are ignored.
- `tokenColors` → the 13 `--oi-syntax-*` roles through a longest-scope-suffix
  table (~30 rules: `keyword`→keyword, `string`→string, `comment`→comment,
  `constant.numeric`→literal, `entity.name.type`→type, `entity.name.function`
  →definition, `markup.heading`→heading, `invalid`→invalid, …). Last (most
  specific) match wins; `fontStyle` italic/bold is kept for comment/heading.
- `terminal.ansi*` / `terminal.background` / `terminal.foreground` /
  `terminal.selectionBackground` → the terminal block, falling back to the
  editor pair.
- Refuse (loudly, with the file name) a theme without a usable
  `editor.background`/`editor.foreground` pair.

## Import from disk

Settings → Visuals also accepts any VS Code color-theme file at runtime:
the same converter runs in the renderer (`@epilogos/oi-design-system/themes/convert`),
the converted theme persists in its own localStorage record
(`oi-cradle.custom-themes.v1`), joins the grid marked "Imported", and its
variable blocks ride in one mounted `<style>` element (the CSP allows inline
styles). Rules:

- the id slugs from the theme's name and is deduped against bundled and
  previously imported ids; the appearance comes from the file's `type`, or
  the ground's perceived lightness when absent;
- only validated values reach the cascade — normalized hex colours, rgba()
  built from them, and the house's fixed shadow strings; malformed files
  refuse in plain words and select nothing;
- removal takes the active selection back to a house appearance;
- the style element re-mounts at module load, so a restart restores an
  imported theme before the first React commit (the pre-paint script only
  carries the bundled blocks).

## Acceptance

1. `packages/oi-design-system`: `node --test` — JSONC parsing (comments,
   trailing commas), mapping tables, derivation fallbacks, emission shape,
   imported-id dedupe and appearance guessing, and every downloaded upstream
   file converts.
2. `desktop/cradle`: `theme-prepaint-csp.mjs` extended — a persisted
   `themeId` lands `data-oi-theme` on the body before paint, CSP intact.
3. `npm run build` green (tsc strict).
4. Settings → Visuals shows the theme grid; picking a card flips the shell,
   editors and terminal; System/Light/Dark restore the house appearances.
5. `visuals-preview-lifecycle.mjs`: import → apply → persist across
   restart → remove, plus the plain-words refusal of a malformed file.
