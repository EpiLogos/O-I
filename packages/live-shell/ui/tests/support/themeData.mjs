/** The colours no theme reaches, by design (O-I #751, the CSS system): data, not chrome. A theme paints the shell's chrome through
 * its role tokens (styles.css :root, bridged from the theme's --oi-* roles); what is listed here is a colour that means something
 * of the material — a track's or a mode's identity, the ink drawn on an identity colour, a picture's own palette, a page's tone, the
 * cut's drawings — and so stays the same under every theme, or a ported control the shell never draws. The raw-colour ratchet
 * (tests/shell-theme-chrome-raw.test.mjs) admits a literal only from DATA, and the headless theme walk
 * (tests/shell-theme-walk.browser.mjs) admits a paint that stays the same across themes only when its colour is in IDENTITY.
 *
 * DATA: file (src-relative, or repo-relative under desktop/) → the literals it keeps (literal → count), each group with why. */

/** Identity hues and the page's tone: what a track, a mode, an agent, a world or a page is, the same under every theme. */
export const IDENTITY = {
  // The cut's palette (styles.css :root, icon-cut.html): the agents', worlds' and kinds' own colours.
  cut: ['#5cc6b4', '#e2a35e', '#d985a6', '#8fbfb6', '#a8c9c2', '#c79ae0', '#d1a46c', '#5fb3b0', '#a9c4dc', '#7ec3e6', '#c9a0dc', '#9fc7e8', '#d8c89a'],
  // The tracks' identity colours (App.tsx).
  tracks: ['#79b6ce', '#779dcc', '#9885bc', '#8baf9c', '#b096b2', '#6caaa9', '#a2b6c2', '#76c0b7', '#97b1be'],
  // The modes' kind hues (shell/modeSurface.css --mode-*).
  modes: ['#a8b0b8', '#e8e4d8', '#5cc6b4', '#d8c89a', '#9fb4c8', '#e2a35e', '#c79ae0', '#b095d6', '#9db8cc', '#6fb3c9'],
  // Ink and edges drawn on an identity colour: they pair with the hue, which stays, so they stay.
  onIdentity: ['#21282e', '#292c31', '#252a2d', '#20252a', '#272d32'],
  // A collection's own colour (Favorites), as a track's colour (components/BrowserPane.tsx).
  collections: ['#f46b64'],
  // The page's tone (styles.css :root, the paper family; manual §17: a page's Paper and Tone are the Document's parameters, not the
  // theme's): Paper and its Ink tone.
  paper: ['#efefed', '#fafaf8', '#111111', '#6e6e6a', '#a3a39e', '#c9c9c4', '#ffe97a', '#20231f', '#282c26', '#eeeee8', '#b2b7aa', '#8e9688', '#555e50'],
}

const PICTURE = 'drawn on the Earth\'s picture (the globe in space, in its lens\'s atmosphere): the veil, the plates and their credits, the floats and their names, the strips, the satellites, the readings\' text and the shades that lift them off the globe pair with that picture, which no theme repaints (the atmosphere is the lens\'s palette, src/data/palette.ts, set at run time by mount.ts)'
const CONTROLS = 'the atlas\'s own controls (its header and menus, selects and their options, rails, closes, graph tools, settings forms): the shell never draws them — atlasHost.css stands each down and the devices draw its working copy (manual §16.3, #762)'

/** File → literals kept (literal → count). */
export const DATA = {
  'styles.css': {
    // The arrangement clip's edge, mixed into the track's own identity colour.
    '#20252a': 1, '#272d32': 1,
    // The Favorites collection's own colour.
    '#f46b64': 1,
  },
  'shell/modeSurface.css': {
    // The modes' kind hues (--mode-day … ), defined once as tokens there: a mode's identity.
    '#a8b0b8': 1, '#e8e4d8': 1, '#5cc6b4': 1, '#d8c89a': 2, '#9fb4c8': 1, '#e2a35e': 1, '#c79ae0': 1, '#b095d6': 1, '#9db8cc': 1, '#6fb3c9': 1,
    // Ink on a track's identity colour (track heads, named cells, the cell's triangle).
    '#21282e': 1, '#252a2d': 1, '#252a2dbb': 1,
  },
  // The MIDI map's own tint (Live's MIDI-map mode): the mapping mode's identity, defined once as tokens there.
  'live/midiMap/midiMap.css': {'#a48ec9': 1, 'rgba(164, 142, 201, 0.7)': 1, 'rgba(164, 142, 201, 0.14)': 1},
  // The page template's own ground behind the frame that draws it (the page's tone, not chrome).
  'inhabitants/catalogue/panels/panels.css': {'#fff': 1},
  // The cut's drawings (icon-cut.html, synced by devices:sync-icons — never hand-edited): the kind marks' facets shade their
  // identity hue, the ghost mark's grey, the journey mark's dark core; the cut's knob, its cap and its lift.
  'inhabitants/sdk/icons.ts': {'#000': 7, '#fff': 5, '#1d1f22': 4, '#9aa0a8': 2},
  'agent/agentIcons.tsx': {'#6a6f76': 1, '#46494f': 1, '#2a2c30': 1, '#000': 1, '#1d1f22': 1, '#fff': 1},
  // The vendored face-rig creatures' own colours (their art: hide, wing, ground, stage).
  'inhabitants/catalogue/faces/vendor/creature-crew.js': {'rgba(8,10,14,.82)': 1, '#0b0d11': 1, '#cfd3da': 1},
  'inhabitants/catalogue/faces/vendor/creature-kit.js': {'#eadcc8': 1, '#f4ead8': 2},
  'inhabitants/catalogue/faces/vendor/creature-lion.js': {'#eadcc8': 1, '#f4ead8': 2},
  'inhabitants/catalogue/faces/vendor/crew-honeybee.js': {'#d4a03c': 6},
  'inhabitants/catalogue/faces/vendor/stage-serpent-tree.js': {'#14161a': 1, '#2b2a27': 1, '#3a3528': 1, '#000': 1, '#fff': 1, '#8a8f7a': 1, '#0b0d11': 1, '#e08a5a': 1},
  // desktop/cradle/src: the context capture's outline, drawn inside a page the browser shows (that page's own colours); the
  // scene recipes' and the Nara adapter's field background (an Expression's paper, a parameter's value); Factory's parity fixture's
  // agents' own colours.
  'desktop/cradle/src/context/page-context.js': {'#0002': 1},
  'desktop/cradle/src/stage/recipes.ts': {'#f4f2eb': 2},
  'desktop/cradle/src/instrument/nara-expression-adapter.ts': {'#f4f2eb': 1},
  'desktop/cradle/src/contributions/factory/fixtures/sssf-parity.ts': {'#a78bfa': 1, '#5ad2dd': 1},
  // The torus's two key families, as a keyboard's dark and light keys: device art that encodes which family a key is.
  'inhabitants/catalogue/panels/torus.tsx': {'#2a3036': 1, '#59606a': 1},
  // A canvas body's name drawn on the body's own fill (the body's colour, data): its ink pairs with that fill.
  'inhabitants/catalogue/panels/techne__canvas.tsx': {'#3d3a2e': 1},
  // The Colour device's default background: a parameter's value (the Expression's paper), not a paint of the device.
  'inhabitants/catalogue/panels/expressions__colour.tsx': {'#09090b': 1},
  // The sky chart's own inks over the sky picture (ported Archetypal-Earth, verbatim).
  'projections/atlas/src/sky/chart-overlay.ts': {'#aab8d4': 1, '#8fa3cc': 1},
  'projections/atlas/src/sky/layer.ts': {'#9fb0cc': 2},
  // Ported Archetypal-Earth stylesheets, verbatim (PORT-PIN.json): PICTURE, then CONTROLS (see above).
  'projections/atlas/src/style/main.css': {
    '#02030a': 2, 'rgb(0 0 0 / 0.42)': 3, '#9fb4e6': 1, 'rgb(120 150 230 / 0.55)': 1, 'rgb(255 255 255 / 0.05)': 1, 'rgb(255 255 255 / 0.62)': 1,
    'rgb(255 255 255 / 0.78)': 1, 'rgb(0 0 0 / 0.55)': 4, 'rgb(0 0 0 / 0.95)': 2, 'rgb(0 0 0 / 0.85)': 1, 'rgb(0 0 0 / 0.4)': 2,
    'rgb(236 241 252 / 0.86)': 1, 'rgb(0 0 0 / 0.45)': 1, 'rgb(236 241 252 / 0.88)': 1, 'rgb(236 241 252 / 0.62)': 1,
    // a reading's quiet link, hovered; CONTROLS: the deep panel's close, hovered, and the reading's close.
    '#fff': 2, 'rgb(255 255 255 / 0.85)': 1, 'rgb(0 0 0 / 0.38)': 1,
  },
  'projections/atlas/src/style/shell.css': {
    'rgb(0 0 0 / 0.9)': 1, 'rgb(140 190 255 / 0.55)': 1,
    // the lens panel's and a satellite card's lift (and CONTROLS: the header menu's)
    'rgb(0 0 0 / 0.55)': 3,
    // the landing's start (and CONTROLS: the checkbox list's)
    'rgb(0 0 0 / 0.45)': 3, 'rgb(0 0 0 / 0.95)': 2, 'rgb(0 0 0)': 2,
    'rgb(140 190 255 / 0.4)': 1, 'rgb(140 190 255 / 0.85)': 1, 'rgb(140 190 255 / 0.8)': 1, 'rgb(214 214 232)': 2, 'rgb(214 214 232 / 0.45)': 1,
    'rgb(255 255 255 / 0.2)': 1,
    // CONTROLS: the header's selects and menu, the settings form, the theory steps, the checkbox list.
    '#0a1020': 3, '#e5eafa': 2, 'rgb(0 0 0 / 0.28)': 1, '#fff': 1, '#f2b8a8': 1,
  },
  'projections/atlas/src/style/graph.css': {'rgb(0 0 0 / 0.46)': 1, /* CONTROLS: the graph tools */ '#fff': 1, 'rgb(0 0 0 / 0.4)': 1, 'rgb(205 218 245 / 0.8)': 1},
  'projections/atlas/src/style/redbook.css': {'rgb(0 0 0 / 0.55)': 1, /* CONTROLS: the Red Book's rail */ 'rgb(0 0 0 / 0.28)': 1, '#fff': 1},
  // CONTROLS: Aion's selects, mode options and choices; the dynamics rail; the graph tools on a phone.
  'projections/atlas/src/style/aion.css': {'#0a1020': 1, '#e5eafa': 1, 'rgb(0 0 0 / 0.22)': 1, 'rgb(0 0 0 / .55)': 1, 'rgb(0 0 0 / 0.5)': 1},
  'projections/atlas/src/style/dynamics.css': {'rgb(0 0 0 / 0.28)': 1, '#fff': 1},
  'projections/atlas/src/style/touch.css': {'rgb(0 0 0 / 0.5)': 1},
}

/** Why the atlas's literals stand (the groups above). */
export const REASONS = {PICTURE, CONTROLS}
