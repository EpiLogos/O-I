/** The frame chrome gains no raw colour (lane T1). A raw colour is a colour no theme reaches: the chrome — transport,
 * browser, panes and their tabs, the detail area, the widget rail, the status bar — paints with the shell's tokens, which the
 * theme bridge in styles.css derives from the chosen theme. This is the form of the cradle's raw-colour policy
 * (packages/oi-design-system/checks/verify.mjs: the same colour pattern, comments stripped), held as a ratchet: the literals
 * still standing are named here with the reason each stays, and any colour beyond them fails. Converting one is welcome —
 * strike it from the list. styles.css's palette (:root) and its bridge are the tokens' own definitions, not chrome use. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const src = new URL('../src/', import.meta.url)
const colour = /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/g
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
const definitions = (text) => text.replace(/^:root \{[\s\S]*?\}\n/m, '').replace(/^:root:has\(> body\[data-oi-theme\]\) \{[\s\S]*?\}\n/m, '')

/** File → the literals still standing (literal → count), each line with its reason. */
const STANDING = {
  'styles.css': {
    // Session and arrangement slots: ink and grounds on the tracks' own identity colours (the track colour stays across themes).
    '#97b1be': 1, '#21282e': 1, '#637267': 1, '#292c31': 1, '#252a2d': 1, '#657b7e': 1, '#4a5056': 1, '#272d32': 1, '#20252a': 1,
    '#33383dcc': 2, '#a5aeb018': 1,
    // Mixer rails, transport record lamp, scrollbar thumb, the native control's edge, the collection square, fault inks: the layout
    // rules' own literals (lane S1's rules; --edge and --fault already carry #30343a and #f3b4a0 as tokens).
    '#202327': 2, '#17191b': 2, '#c9c8ad': 1, '#777e80': 1, '#30343a': 1, '#f46b64': 1, '#f3b4a0': 1, '#e4b09f': 1,
    '#251e1c': 1, '#edc9bc': 1, '#705344': 1,
  },
  'shell/modeSurface.css': {
    // The modes' kind hues (--mode-day … ) are identities, defined once as tokens there.
    '#a8b0b8': 1, '#e8e4d8': 1, '#5cc6b4': 1, '#d8c89a': 2, '#9fb4c8': 1, '#e2a35e': 1, '#c79ae0': 1, '#b095d6': 1, '#9db8cc': 1, '#6fb3c9': 1,
    // Ink on a track's identity colour (track heads, named cells, the cell's triangle).
    '#21282e': 1, '#252a2d': 1, '#252a2dbb': 1,
    // Shadow black and white lift: neutral overlays (the theme vocabulary carries shadows as whole --oi-shadow-* values).
    '#0006': 2, '#0008': 1, '#ffffff08': 2, '#ffffff06': 1,
  },
  // The tracks' identity colours (data, not chrome paint).
  'App.tsx': {'#79b6ce': 1, '#779dcc': 1, '#9885bc': 1, '#8baf9c': 1, '#b096b2': 1, '#6caaa9': 1, '#a2b6c2': 1, '#76c0b7': 1},
  // A colour input's empty value, not a paint.
  'components/expressions/studio/frameChrome.tsx': {'#808080': 1},
  'shell/ownerReadback.css': {}, 'frame/paneGrammar.css': {}, 'frame/transport/transport.css': {}, 'frame/browser/browser.css': {},
  'frame/browser/apertureViews.css': {}, 'frame/tracks/tracks.css': {}, 'frame/detail/detail.css': {}, 'frame/widgets/deviceWidgets.css': {},
  'components/expressions/studio/frameChrome.css': {},
  'components/TransportBar.tsx': {}, 'components/StatusBar.tsx': {}, 'frame/transport/Transport.tsx': {}, 'frame/widgets/WidgetRail.tsx': {},
  'shell/ModeBrowser.tsx': {}, 'shell/ModeDetail.tsx': {}, 'shell/ModeContextDock.tsx': {}, 'shell/ModeTransportBar.tsx': {},
  'shell/ModeModeRail.tsx': {}, 'shell/modeBrowsers.tsx': {}, 'shell/modeTransports.tsx': {}, 'shell/widgets.tsx': {},
}

const found = (rel) => {
  let text = stripComments(readFileSync(new URL(rel, src), 'utf8'))
  if (rel === 'styles.css') text = definitions(text)
  const counts = {}
  for (const [literal] of text.matchAll(colour)) counts[literal] = (counts[literal] ?? 0) + 1
  return counts
}

for (const [rel, standing] of Object.entries(STANDING)) {
  test(`the frame chrome's ${rel} gains no raw colour`, () => {
    const gained = Object.entries(found(rel)).filter(([literal, n]) => n > (standing[literal] ?? 0)).map(([literal, n]) => `${literal} ×${n - (standing[literal] ?? 0)}`)
    assert.deepEqual(gained, [], `${rel} paints with a colour no theme reaches — use the shell's tokens (styles.css) or name the reason here`)
  })
}

test('the colours lane T1 converted stay tokens', () => {
  const mode = readFileSync(new URL('shell/modeSurface.css', src), 'utf8')
  for (const token of ['--edge', '--disputed', '--fault', '--accent-wash', '--on-accent']) assert.match(mode, new RegExp(`var\\(${token}\\)`), `modeSurface.css paints with ${token}`)
  assert.match(readFileSync(new URL('inhabitants/inhabitantDevices.css', src), 'utf8'), /body \{[^}]*background: var\(--gutter, #1b1d20\)/, 'the gutter between the panes is a token')
})
