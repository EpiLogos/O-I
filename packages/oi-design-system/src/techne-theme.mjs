/**
 * Techne theme derivation — ported from the Expressions physics workspace
 * (field-studies-journeys/src/app.ts `theme()`, ~line 99). Plain JS, no
 * framework. The host owns the scene; this module only derives and applies
 * the chrome appearance the way the reference does:
 *
 *   luminance   = 0.2126*R + 0.7152*G + 0.0722*B   (scene background, 0..255)
 *   night       = appearance === 'dark'
 *                 || (appearance === 'scene' && luminance < 100)
 *   hudContrast = (appearance === 'dark' && luminance >= 100)
 *                 || (appearance === 'light' && luminance < 100)
 *
 * `night` selects the dark chrome token scope (techne.css
 * [data-techne-night="true"]). `hudContrast` fires when the workspace
 * appearance preference disagrees with the scene's natural tone — the HUD
 * glass must solidify to stay legible over an opposite-tone artwork
 * (techne.css [data-techne-hud-contrast="true"]).
 *
 * The scene paper/ink map onto the existing world host hooks
 * --oi-world-surface / --oi-world-foreground (theme() sets --paper/--ink the
 * same way); the document tier re-derives muted/line/wash/accent in CSS.
 */

const NIGHT_LUMINANCE_THRESHOLD = 100;
const APPEARANCES = new Set(['scene', 'dark', 'light']);

/** Rec. 709 luminance of a #rrggbb colour on the 0..255 scale (theme() parses
 * hex.slice(1,3|3,5|5,7) the same way). Throws on anything else. */
export function techneLuminance(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new TypeError('A #rrggbb scene background is required');
  }
  const channel = (at) => parseInt(hex.slice(at, at + 2), 16);
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Derive the chrome appearance for a scene. `paper` is the scene background
 * (theme()'s s.field.background); `appearance` is the workspace preference:
 * 'scene' follows the scene, 'dark'/'light' force the chrome and raise
 * hudContrast when they oppose the scene tone. */
export function deriveTechneTheme({ paper, appearance = 'scene' } = {}) {
  if (!APPEARANCES.has(appearance)) {
    throw new TypeError("appearance must be 'scene', 'dark' or 'light'");
  }
  const luminance = techneLuminance(paper);
  const sceneIsDark = luminance < NIGHT_LUMINANCE_THRESHOLD;
  const night = appearance === 'dark' || (appearance === 'scene' && sceneIsDark);
  const hudContrast =
    (appearance === 'dark' && !sceneIsDark) || (appearance === 'light' && sceneIsDark);
  return { night, hudContrast, luminance };
}

/** Convenience for scene objects shaped like the engine's
 * {field:{background}, palette:[ink,...]} telemetry/document form. */
export function sceneTechneTheme(scene, appearance = 'scene') {
  const background = scene?.field?.background ?? scene?.background;
  const ink = scene?.field?.palette?.[0] ?? scene?.palette?.[0];
  return { ...deriveTechneTheme({ paper: background, appearance }), ink };
}

/** Apply a derived theme to the host element carrying `.oi-techne`:
 * the two data attributes techne.css selects on, plus the world host hooks
 * carrying the scene ground/ink. Returns the derived theme. Idempotent. */
export function applyTechneTheme(root, { paper, ink, appearance = 'scene' } = {}) {
  if (!root || typeof root.setAttribute !== 'function' || !root.style) {
    throw new TypeError('A host element is required');
  }
  const theme = deriveTechneTheme({ paper, appearance });
  root.setAttribute('data-techne-night', String(theme.night));
  root.setAttribute('data-techne-hud-contrast', String(theme.hudContrast));
  if (typeof paper === 'string') root.style.setProperty('--oi-world-surface', paper);
  if (typeof ink === 'string') root.style.setProperty('--oi-world-foreground', ink);
  return theme;
}
