/** The owner's chosen theme paints the shell.
 *
 * Nothing here reads or writes the presentation. Settings › Appearance writes it through the presentation owner's own ops
 * (theme_apply, theme_revert, theme_import, theme_remove), and the shell already projects the owner's reading onto the page by
 * the retained desktop path it mounts (native/Foundation.tsx → VisualsProvider, desktop/cradle/src/visuals/ParticleExpression.tsx):
 * read when the owner's gate opens and again on every presentation_changed receipt, the appearance resolved against
 * prefers-color-scheme onto body[data-theme], the chosen library or imported theme onto body[data-oi-theme], an imported
 * theme's block written by customThemes.ts.
 *
 * What the shell lacked was the library itself: this brings the generated theme blocks in (they ground the root over that
 * body — oi-design-system/scripts/convert.mjs themeSelector), and styles.css's theme bridge derives every chrome token from
 * the theme's roles. With no theme chosen no block matches and the shell paints its own palette, unchanged. */
import '../../../../../oi-design-system/themes/themes.css'
