/**
 * Theme conversion — VS Code color theme → oi.theme/v1.
 *
 * The import standard is the VS Code color theme file (JSON with comments:
 * name, type, include, colors, tokenColors). The app-native format is the
 * normalized document this module emits: values for the EXISTING --oi-* role
 * tokens only. Roles never change between themes (tokens.css law 11): a
 * converted theme colors roles, it cannot add chrome roles, rename roles, or
 * put raw colors in components. Unmapped VS Code keys are ignored.
 *
 * Plain node, no dependencies. Pure functions; the CLI lives in
 * build-themes.mjs.
 */

/** Parse JSON-with-comments: // and slash-star comments anywhere outside
 * strings, and trailing commas. VS Code theme files use both liberally. */
export function parseJsonc(text) {
  const out = [];
  let i = 0;
  const n = text.length;
  let inString = false;
  let escaped = false;
  while (i < n) {
    const c = text[i];
    if (inString) {
      out.push(c);
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      i += 1;
      continue;
    }
    if (c === '"') {
      inString = true;
      out.push(c);
      i += 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i + 1 < n && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out.push(c);
    i += 1;
  }
  return JSON.parse(out.join('').replace(/,(\s*[}\]])/g, '$1'));
}

/* ---- colour helpers ---------------------------------------------------- */

export function hexToRgb(hex) {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(String(hex).trim());
  if (!m) throw new Error(`not a hex colour: ${String(hex)}`);
  let body = m[1];
  if (body.length === 3) body = [...body].map((c) => c + c).join('');
  const channels = [0, 2, 4].map((at) => parseInt(body.slice(at, at + 2), 16));
  if (body.length === 8) {
    const alpha = parseInt(body.slice(6, 8), 16) / 255;
    return channels.map((c) => Math.round(c * alpha + 255 * (1 - alpha)));
  }
  return channels;
}

export function rgbToHex([r, g, b]) {
  const channel = (c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Normalise any VS Code colour to opaque #rrggbb; 8-digit alpha composites
 * over `over` (the theme ground — where VS Code would layer it). */
export function normalizeColor(hex, over = '#ffffff') {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(String(hex).trim());
  if (!m) return null;
  let body = m[1];
  if (body.length === 3) body = [...body].map((c) => c + c).join('');
  if (body.length === 8) {
    const [r, g, b] = hexToRgb(body.slice(0, 6));
    const alpha = parseInt(body.slice(6, 8), 16) / 255;
    const [or, og, ob] = hexToRgb(over);
    return rgbToHex([r * alpha + or * (1 - alpha), g * alpha + og * (1 - alpha), b * alpha + ob * (1 - alpha)]);
  }
  return rgbToHex(hexToRgb(body));
}

/** Linear mix of two opaque hex colours: t=0 gives `a`, t=1 gives `b`. */
export function mix(a, b, t) {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

/* ---- chrome mapping: VS Code workbench keys → --oi-* roles -------------- */

/** Explicit workbench-colour mapping. Everything not listed here is either
 * derived from the editor pair below or ignored. */
const CHROME_KEYS = {
  'editor.background': ['--oi-canvas-ground', '--oi-surface', '--oi-paper'],
  'editor.foreground': ['--oi-foreground', '--oi-ink', '--oi-focus'],
  'sideBar.background': ['--oi-sidebar-ground'],
  'titleBar.activeBackground': ['--oi-shell-ground'],
  'editorGroupHeader.tabsBackground': ['--oi-pane-bar-ground'],
  'tab.inactiveBackground': ['--oi-pane-bar-ground'],
  'editorWidget.background': ['--oi-agent-ground'],
  'input.background': ['--oi-composer-ground'],
  'input.border': ['--oi-control-edge'],
  'panel.border': ['--oi-hairline'],
  'contrastBorder': ['--oi-hairline'],
  'list.hoverBackground': ['--oi-wash'],
  'list.activeSelectionBackground': ['--oi-wash-strong'],
  'focusBorder': ['--oi-accent'],
  'button.background': ['--oi-active-ground'],
  'button.foreground': ['--oi-active-ink'],
  'editorLineNumber.foreground': ['--oi-muted-3'],
  'descriptionForeground': ['--oi-muted-2'],
  'disabledForeground': ['--oi-muted-3'],
  'editor.selectionBackground': ['--oi-accent-soft'],
  'scrollbarSlider.background': ['--oi-scrollbar-thumb'],
  'scrollbarSlider.hoverBackground': ['--oi-scrollbar-thumb-strong'],
};

/** Roles derived when their workbench key is absent: a minimal theme that
 * declares only the editor pair still grounds the whole shell. `t` is the
 * mix toward ink from ground; shadows come from the appearance defaults. */
const DERIVED = [
  ['--oi-rule', 0.16],
  ['--oi-hairline', 0.16],
  ['--oi-hairline-soft', 0.1],
  ['--oi-control-edge', 0.26],
  ['--oi-wash', 0.05],
  ['--oi-wash-strong', 0.09],
  ['--oi-sidebar-ground', 0.035],
  ['--oi-pane-bar-ground', 0.02],
  ['--oi-agent-ground', 0.045],
  ['--oi-shell-ground', 0.07],
  ['--oi-muted', 0.42],
  ['--oi-muted-2', 0.46],
  ['--oi-muted-3', 0.62],
  ['--oi-scrollbar-thumb', 0.2],
  ['--oi-scrollbar-thumb-strong', 0.38],
];

const SHADOWS = {
  light: {
    '--oi-shadow-plane': '0 1px 2px rgba(22, 22, 20, 0.05)',
    '--oi-shadow-menu': '0 10px 40px rgba(22, 22, 20, 0.12), 0 1px 2px rgba(22, 22, 20, 0.08)',
    '--oi-shadow-overlay': '0 20px 70px rgba(22, 22, 20, 0.14)',
    '--oi-shadow-drawer': '-10px 0 25px rgba(22, 22, 20, 0.07)',
  },
  dark: {
    '--oi-shadow-plane': '0 1px 2px rgba(0, 0, 0, 0.4)',
    '--oi-shadow-menu': '0 10px 40px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.4)',
    '--oi-shadow-overlay': '0 20px 70px rgba(0, 0, 0, 0.55)',
    '--oi-shadow-drawer': '-10px 0 25px rgba(0, 0, 0, 0.35)',
  },
};

/* ---- syntax mapping: TextMate scopes → --oi-syntax-* roles --------------- */

/** The 13 syntax roles, each with its representative scopes. A tokenColor
 * rule colours a role when one of its scope selectors prefix-matches
 * (segment-wise) a representative; the longest selector wins, later rules
 * break length ties. */
const SYNTAX_REPRESENTATIVES = {
  '--oi-syntax-meta': ['meta'],
  '--oi-syntax-link': ['markup.underline.link', 'string.other.link'],
  '--oi-syntax-heading': ['markup.heading'],
  '--oi-syntax-keyword': ['keyword', 'storage'],
  '--oi-syntax-atom': ['constant.language'],
  '--oi-syntax-literal': ['constant.numeric'],
  '--oi-syntax-string': ['string'],
  '--oi-syntax-special': ['constant.character.escape', 'string.regexp', 'support.function.magic'],
  '--oi-syntax-definition': ['entity.name.function', 'support.function'],
  '--oi-syntax-variable': ['variable', 'variable.other'],
  '--oi-syntax-type': ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.name.tag'],
  '--oi-syntax-comment': ['comment'],
  '--oi-syntax-invalid': ['invalid'],
};

const segments = (scope) => scope.trim().split(/\s+/)[0].split('.');

/** The effective scope a selector contributes: for a descendant selector
 * ("comment keyword.codetag.notation") that is its final part — a token's
 * scope is flat here, so only the trailing element can be honoured. */
function selectorKey(selector) {
  return selector.trim().split(/\s+/).pop();
}

function prefixMatches(selector, scope) {
  const s = selectorKey(selector).split('.');
  const t = segments(scope);
  if (s.length > t.length) return false;
  return s.every((part, at) => part === t[at] || part === '*');
}

/** Flatten tokenColors (array of {scope, settings} rules or the older object
 * form) into ordered [(selector, colour)] pairs. */
export function flattenTokenColors(tokenColors) {
  const pairs = [];
  if (Array.isArray(tokenColors)) {
    for (const rule of tokenColors) {
      const color = rule?.settings?.foreground;
      if (typeof color !== 'string') continue;
      const scopes = Array.isArray(rule.scope) ? rule.scope : typeof rule.scope === 'string' ? [rule.scope] : [];
      for (const scope of scopes) for (const selector of scope.split(',')) pairs.push([selector, color]);
    }
  } else if (tokenColors && typeof tokenColors === 'object') {
    for (const [scope, settings] of Object.entries(tokenColors)) {
      const color = typeof settings === 'string' ? settings : settings?.foreground;
      if (typeof color === 'string') for (const selector of scope.split(',')) pairs.push([selector, color]);
    }
  }
  return pairs;
}

export function resolveSyntaxColors(pairs, ground) {
  const resolved = {};
  for (const [role, representatives] of Object.entries(SYNTAX_REPRESENTATIVES)) {
    let best = null;
    for (const representative of representatives) {
      for (let at = 0; at < pairs.length; at += 1) {
        const [selector, color] = pairs[at];
        if (!prefixMatches(selector, representative)) continue;
        const length = segments(selectorKey(selector)).length;
        if (!best || length > best.length || (length === best.length && at >= best.at)) {
          best = { length, at, color };
        }
      }
    }
    const color = best && normalizeColor(best.color, ground);
    if (color) resolved[role] = color;
  }
  return resolved;
}

/* ---- terminal mapping ---------------------------------------------------- */

const ANSI_KEYS = ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White', 'BrightBlack', 'BrightRed', 'BrightGreen', 'BrightYellow', 'BrightBlue', 'BrightMagenta', 'BrightCyan', 'BrightWhite'];

export function resolveTerminalColors(colors, ground, foreground) {
  const terminal = {};
  const background = normalizeColor(colors['terminal.background'] ?? ground, ground);
  const ink = normalizeColor(colors['terminal.foreground'] ?? foreground, ground);
  if (background) terminal.background = background;
  if (ink) terminal.foreground = ink;
  const selection = normalizeColor(colors['terminal.selectionBackground'], background ?? ground);
  if (selection) terminal.selection = selection;
  const cursor = normalizeColor(colors['terminalCursor.foreground'], background ?? ground);
  if (cursor) terminal.cursor = cursor;
  // Sparse by key position: a partial palette keeps its slot rather than
  // shifting every later colour onto the wrong terminal role.
  const ansi = [];
  ANSI_KEYS.forEach((key, at) => {
    const color = normalizeColor(colors[`terminal.ansi${key}`], background ?? ground);
    if (color) ansi[at] = color;
  });
  if (ansi.length) terminal.ansi = ansi;
  return terminal;
}

/* ---- conversion ----------------------------------------------------------- */

/** Merge an `include` parent under `child` (child wins): colours merge per
 * key, token rule lists concatenate parent-then-child. */
export function mergeInclude(child, parent) {
  return {
    ...parent,
    ...child,
    colors: { ...(parent.colors ?? {}), ...(child.colors ?? {}) },
    tokenColors: [...(parent.tokenColors ?? []), ...(child.tokenColors ?? [])],
  };
}

/** Convert one parsed VS Code theme into an oi.theme/v1 document.
 * `source` is the provenance record; `appearance` decides the derived
 * defaults (and the color-scheme the theme rides with). */
export function convertTheme(theme, { id, name, appearance, source }) {
  const colors = { ...(theme.colors ?? {}) };
  const groundRaw = colors['editor.background'];
  if (typeof groundRaw !== 'string') {
    throw new Error(`${name}: the theme declares no editor.background — the shell cannot be grounded`);
  }
  // Classic themes omit editor.foreground and ride the workbench default for
  // their appearance; adopt the same defaults instead of refusing.
  const inkRaw = colors['editor.foreground'] ?? (appearance === 'dark' ? '#d4d4d4' : '#3b3b3b');
  // The resolved pair is what grounds the shell — a defaulted foreground
  // must reach the roles too, not only the derivations.
  const resolved = { ...colors, 'editor.background': groundRaw, 'editor.foreground': inkRaw };
  const ground = normalizeColor(groundRaw);
  const ink = normalizeColor(inkRaw, ground);

  const tokens = {};
  for (const [key, roles] of Object.entries(CHROME_KEYS)) {
    const value = normalizeColor(resolved[key], ground);
    if (!value) continue;
    for (const role of roles) tokens[role] = value;
  }
  // Appearance defaults first, so an explicit workbench key always wins the tie.
  tokens['--oi-surface'] = tokens['--oi-surface'] ?? mix(ground, ink, 0.015);
  tokens['--oi-accent'] = tokens['--oi-accent'] ?? mix(ink, ground, 0.12);
  tokens['--oi-accent-ink'] = tokens['--oi-accent-ink'] ?? mix(ink, ground, 0.06);
  tokens['--oi-accent-soft'] = tokens['--oi-accent-soft'] ?? mix(ground, ink, 0.22);
  tokens['--oi-composer-rule'] = tokens['--oi-composer-rule'] ?? mix(ground, ink, 0.16);
  tokens['--oi-inverse-canvas-ground'] = appearance === 'dark' ? '#fbfbf9' : '#121211';
  tokens['--oi-inverse-foreground'] = appearance === 'dark' ? '#161614' : '#e9e9e4';
  for (const [role, t] of DERIVED) {
    if (!(role in tokens)) tokens[role] = mix(ground, ink, t);
  }
  for (const [role, value] of Object.entries(SHADOWS[appearance])) {
    tokens[role] = tokens[role] ?? value;
  }
  // Glass planes take the derived grounds at the house opacities.
  tokens['--oi-sidebar-ground-glass'] ??= withAlpha(tokens['--oi-sidebar-ground'], 0.92);
  tokens['--oi-popover-ground-glass'] ??= withAlpha(tokens['--oi-surface'], appearance === 'dark' ? 0.88 : 0.9);
  tokens['--oi-card-glass'] ??= withAlpha(tokens['--oi-surface'], appearance === 'dark' ? 0.42 : 0.56);
  tokens['--oi-card-solid'] ??= withAlpha(tokens['--oi-surface'], 0.97);

  const syntax = resolveSyntaxColors(flattenTokenColors(theme.tokenColors), ground);
  const terminal = resolveTerminalColors(colors, ground, ink);

  const accent = tokens['--oi-accent'];
  const strip = ['--oi-syntax-keyword', '--oi-syntax-string', '--oi-syntax-type']
    .map((role) => syntax[role])
    .filter(Boolean);
  if (!strip.length) strip.push(accent);
  const preview = { ground, ink, accent, strip: strip.slice(0, 3) };

  return {
    schema: 'oi.theme/v1',
    id,
    name,
    appearance,
    source,
    tokens,
    syntax,
    terminal,
    preview,
  };
}

function withAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ---- emission -------------------------------------------------------------- */

/** The terminal roles the runtime reads; the house themes leave them unset,
 * so the terminal keeps its behaviour unchanged there. */
const TERMINAL_ROLES = {
  background: '--oi-terminal-background',
  foreground: '--oi-terminal-foreground',
  selection: '--oi-terminal-selection',
  cursor: '--oi-terminal-cursor',
};
const ANSI_ROLE_NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'bright-black', 'bright-red', 'bright-green', 'bright-yellow', 'bright-blue', 'bright-magenta', 'bright-cyan', 'bright-white'];

/** All theme variables as `role → value`, syntax and terminal included. */
export function themeVariables(doc) {
  const variables = { ...doc.tokens, ...doc.syntax };
  for (const [key, role] of Object.entries(TERMINAL_ROLES)) {
    if (doc.terminal?.[key]) variables[role] = doc.terminal[key];
  }
  doc.terminal?.ansi?.forEach((color, at) => {
    const role = ANSI_ROLE_NAMES[at];
    if (role) variables[`--oi-terminal-ansi-${role}`] = color;
  });
  return variables;
}

const CSS_COMMENT = '/* Generated by scripts/build-themes.mjs from themes/upstream/ — do not edit; rerun the script. */\n';

/** One `.oi-desktop[data-oi-theme="<id>"]` block per theme. The block rides
 * AFTER tokens.css in import order, so it wins the specificity tie with the
 * dark block and every override lands. */
export function emitCss(docs) {
  const blocks = docs.map((doc) => {
    const lines = Object.entries(themeVariables(doc)).map(([role, value]) => `  ${role}: ${value};`);
    return `.oi-desktop[data-oi-theme="${doc.id}"] {\n  color-scheme: ${doc.appearance};\n${lines.join('\n')}\n}`;
  });
  return `${CSS_COMMENT}\n${blocks.join('\n\n')}\n`;
}

/** The picker's index: identity, appearance and preview colours only — the
 * full documents stay in themes/oi/ and the CSS. */
export function emitIndexModule(docs) {
  const entries = docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    appearance: doc.appearance,
    preview: doc.preview,
    source: { name: doc.source.name, repo: doc.source.repo, license: doc.source.license },
  }));
  return [
    '/** Generated by scripts/build-themes.mjs from themes/upstream/ — do not edit; rerun the script. */',
    '/** The theme library index: what Settings → Visuals renders. Each entry',
    ' * carries its preview colours; the values themselves live in themes.css. */',
    '/** @typedef {{id: string, name: string, appearance: "light" | "dark",',
    ' *             preview: {ground: string, ink: string, accent: string, strip: string[]},',
    ' *             source: {name: string, repo: string, license: string}}} ThemeIndexEntry */',
    '/** @type {ThemeIndexEntry[]} */',
    `export const THEMES = ${JSON.stringify(entries, null, 2)};\n`,
  ].join('\n');
}
