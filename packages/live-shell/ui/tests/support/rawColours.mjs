/** The raw-colour classifier the CSS system's ratchet reads with (tests/shell-theme-chrome-raw.test.mjs; O-I #751). */

export const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/g
export const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, lead) => lead + ' '.repeat(m.length - lead.length))

/** The token blocks a theme reaches: file → selector → how. A literal defined in one of these is a token's default. */
export const TOKEN_BLOCKS = {
  // The palette and the theme bridge (bridged in the block below), and a page's Ink tone (the page's own tone, manual §17.2).
  'packages/live-shell/ui/src/styles.css': [':root', ':root:has(> body[data-oi-theme])', '[data-paper="ink"]'],
  // The inhabitant devices' copy of the palette: each --inh-* follows its chrome token under a theme (the bridge's --inh-* lines).
  'packages/live-shell/ui/src/inhabitants/inhabitantDevices.css': [':root'],
  // Factory's frame re-declares the chrome tokens for the agent-shell oracle; under a theme it inherits the root's (agentShell.css).
  'packages/live-shell/ui/src/agent/agentShell.css': ['.frame.agent-shell-frame'],
  // The Native Workbench's foundation tokens; under a theme frame/paneGrammar.css maps each onto the shell's tokens.
  'packages/live-shell/ui/src/native/workbench.css': ['.candidate-workbench'],
  // The atlas's own tokens, scoped to its pane (ported Archetypal-Earth): the atmosphere (--core, --glow, --fog, --deep) is the lens's
  // palette, set on the pane at run time from the picture's data (mount.ts setPaletteVars), and the inks and glass the atlas draws
  // in over the globe pair with that picture (themeData.mjs PICTURE): data, which no theme repaints.
  'packages/live-shell/ui/src/projections/atlas/src/style/main.css': ['.atlas-host'],
}

/** Every colour literal in a stylesheet, with where it stands: {literal, line, kind, name?, selector}. */
export function literals(text) {
  const clean = stripComments(text)
  const out = []
  for (const match of clean.matchAll(COLOUR)) {
    const literal = match[0]
    if (literal.includes('var(')) continue // a channel triple read from a token, e.g. rgb(var(--core-rgb) / .2)
    const at = match.index
    const start = Math.max(clean.lastIndexOf(';', at), clean.lastIndexOf('{', at), clean.lastIndexOf('}', at)) + 1
    const declaration = clean.slice(start, at).trim()
    const open = clean.lastIndexOf('{', at)
    const selector = clean.slice(clean.lastIndexOf('}', open) + 1, open).trim().replace(/\s+/g, ' ')
    const line = clean.slice(0, at).split('\n').length
    const property = /^([-\w]+)\s*:/.exec(declaration)?.[1] ?? ''
    // the innermost var( … still open before the literal names the token it falls back from
    const stack = []
    for (const m of clean.slice(start, at).matchAll(/var\(\s*(--[\w-]+)|\(|\)/g)) {
      if (m[1]) stack.push(m[1])
      else if (m[0] === '(') stack.push(null)
      else stack.pop()
    }
    const token = stack.filter(Boolean).at(-1)
    let kind = 'paint', name
    if (token) { kind = 'fallback'; name = token }
    else if (property.startsWith('--')) { kind = 'definition'; name = property }
    else if (/^(-webkit-)?mask(-image)?$/.test(property)) kind = 'mask'
    out.push({literal, line, kind, name, selector})
  }
  return out
}

/** The literals that count as raw, given the declared tokens and the file's token blocks. */
export function raw(text, {declared, blocks = []}) {
  return literals(text).filter(({kind, name, selector}) => {
    if (kind === 'mask') return false
    if (kind === 'fallback') return !declared.has(name)
    if (kind === 'definition') return !blocks.includes(selector)
    return true
  })
}

/** A script's paint keys: a style object's or an SVG attribute's colour (fill, stroke, color, background …). */
const PAINT_KEY = /^(fill|stroke|stop-?[Cc]olor|color|background[A-Za-z-]*|border[A-Za-z-]*|box-?[Ss]hadow|outline[A-Za-z-]*|text-?[Ss]hadow|caret-?[Cc]olor|accent-?[Cc]olor|flood-?[Cc]olor|lighting-?[Cc]olor)$/

/** Every colour literal a script paints with: in a style object under a paint key, or in an SVG paint attribute. */
export function scriptPaints(text) {
  const clean = stripComments(text)
  const out = []
  for (const match of clean.matchAll(COLOUR)) {
    const literal = match[0]
    if (literal.includes('var(')) continue
    const at = match.index
    const lineStart = clean.lastIndexOf('\n', at) + 1
    const before = clean.slice(Math.max(lineStart, at - 160), at)
    const keys = [...before.matchAll(/([A-Za-z][\w-]*)\s*[:=]/g)]
    const key = keys.at(-1)?.[1]
    if (!key || !PAINT_KEY.test(key)) continue
    const stack = []
    for (const m of before.matchAll(/var\(\s*(--[\w-]+)|\(|\)/g)) {
      if (m[1]) stack.push(m[1])
      else if (m[0] === '(') stack.push(null)
      else stack.pop()
    }
    const token = stack.filter(Boolean).at(-1)
    out.push({literal, line: clean.slice(0, at).split('\n').length, key, kind: token ? 'fallback' : 'paint', name: token})
  }
  return out
}
