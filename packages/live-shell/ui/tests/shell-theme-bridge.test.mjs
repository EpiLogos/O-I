/** The theme chosen in Settings › Appearance paints the shell (lane T1): the presentation → root mapping as a pure
 * function over the real sources, the token bridge (every chrome token has a themed derivation and the palette as its
 * fallback), the DLW palette as a library theme that paints exactly the palette, and the null-theme identity.
 *
 * The mapping is read from source, not re-stated: the generated library (oi-design-system themes/oi/*.json through the
 * converter's themeVariables, themes/themes.css), the bridge block and the palette in styles.css, the inhabitant devices'
 * copy of the palette, and the retained projection that lands the owner's choice on the body (ParticleExpression.tsx). */
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync} from 'node:fs'

const ui = new URL('../', import.meta.url)
const repo = new URL('../../../', ui)
const read = (url) => readFileSync(url, 'utf8')
const design = new URL('packages/oi-design-system/', repo)
const {themeVariables, themeSelector, themeImportRules, houseTheme, emitCss} = await import(new URL('scripts/convert.mjs', design).href)
const {THEMES} = await import(new URL('themes/index.mjs', design).href)
const docs = Object.fromEntries(readdirSync(new URL('themes/oi/', design)).map((file) => {
  const doc = JSON.parse(read(new URL(`themes/oi/${file}`, design)))
  return [doc.id, doc]
}))

const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '')
const styles = strip(read(new URL('src/styles.css', ui)))
const declarations = (body) => Object.fromEntries(body.split(';').map((part) => part.trim()).filter((part) => part.startsWith('--'))
  .map((part) => { const at = part.indexOf(':'); return [part.slice(0, at).trim(), part.slice(at + 1).trim()] }))
const palette = declarations(/^:root \{([\s\S]*?)\}/m.exec(styles)[1])
const BRIDGE_SELECTOR = ':root:has(> body[data-oi-theme])'
const bridgeMatch = new RegExp(`^${BRIDGE_SELECTOR.replace(/[()[\]>:]/g, (c) => `\\${c}`)} \\{([\\s\\S]*?)\\}`, 'm').exec(styles)
const bridge = bridgeMatch ? declarations(bridgeMatch[1]) : {}
const inhabitant = declarations(/^:root \{([\s\S]*?)\}/m.exec(strip(read(new URL('src/inhabitants/inhabitantDevices.css', ui))))[1])

/** The chrome tokens a theme reaches: the ticket's palette (styles.css "The DLW mockup's colours") and the chrome tokens the
 * raw-colour conversion added. Identity hues (the cut's palette) and the paper page are deliberately not here. */
const CHROME = ['--bg-0', '--bg-1', '--bg-2', '--bg-3', '--surface', '--line', '--line-strong', '--text', '--text-dim', '--text-faint',
  '--accent', '--accent-dim', '--accent-soft', '--sel', '--rec', '--green', '--stall',
  '--edge', '--on-accent', '--accent-wash', '--fault', '--disputed', '--gutter', '--fizz']
const INHABITANT = ['--inh-bg-0', '--inh-bg-1', '--inh-bg-2', '--inh-bg-3', '--inh-line', '--inh-line-strong', '--inh-text', '--inh-dim',
  '--inh-faint', '--inh-accent', '--inh-accent-soft', '--inh-sel', '--inh-rec', '--inh-green', '--inh-stall']

/* ---- colours as values ---- */
function rgba(text) {
  const value = String(text).trim()
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value)
  if (m) return [0, 2, 4].map((at) => parseInt(m[1].slice(at, at + 2), 16)).concat(m[2] ? Math.round(parseInt(m[2], 16) / 255 * 1000) / 1000 : 1)
  m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(value)
  if (m) return [+m[1], +m[2], +m[3], +m[4]]
  throw new Error(`not a colour value: ${value}`)
}
const same = (a, b) => assert.deepEqual(rgba(a), rgba(b))
const hex = ([r, g, b]) => `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`

/* ---- the bridge entries ---- */
function entry(token) {
  const expression = bridge[token]
  let m = /^var\((--oi-[a-z0-9-]+),(.+)\)$/.exec(expression ?? '')
  if (m) return {kind: 'role', role: m[1], fallback: m[2]}
  m = /^var\((--[a-z0-9-]+)\)$/.exec(expression ?? '')
  if (m) return {kind: 'alias', of: m[1]}
  m = /^color-mix\(in srgb,var\((--[a-z0-9-]+)\) (\d+)%,(transparent|black)\)$/.exec(expression ?? '')
  if (m) return {kind: 'mix', of: m[1], percent: +m[2], with: m[3]}
  return {kind: 'unknown', expression}
}

/** The presentation → root mapping, pure: the owner's theme choice (and imported library) to the shell's token values, as
 * the cascade computes them — no block and no bridge without an id; with one, the theme's roles, the palette for any role
 * the theme leaves unset. */
function rootTokens(choice, custom = []) {
  if (!choice?.id) return Object.fromEntries([...CHROME].map((token) => [token, palette[token]]))
  const theme = docs[choice.id] ? themeVariables(docs[choice.id]) : custom.find((t) => t.id === choice.id)?.variables ?? {}
  const out = {}
  const resolve = (token) => {
    if (token in out) return out[token]
    const e = entry(token)
    if (e.kind === 'role') out[token] = theme[e.role] ?? e.fallback
    else if (e.kind === 'alias') out[token] = resolve(e.of)
    else if (e.kind === 'mix') {
      const [r, g, b, a] = rgba(resolve(e.of)); const t = e.percent / 100
      out[token] = e.with === 'transparent' ? `rgba(${r}, ${g}, ${b}, ${a * t})` : hex([r * t, g * t, b * t])
    } else throw new Error(`${token}: no themed derivation (${e.expression})`)
    return out[token]
  }
  for (const token of CHROME) resolve(token)
  return out
}

test('the bridge is one block on the root over a body that carries the chosen theme', () => {
  assert.ok(bridgeMatch, `styles.css carries the bridge block ${BRIDGE_SELECTOR} { … }`)
  assert.equal(styles.split(BRIDGE_SELECTOR).length - 1, 1, 'one bridge block')
})

test('every chrome token has a themed derivation, the palette value as its fallback', () => {
  const roles = new Set(themeImportRules().roles)
  for (const token of CHROME) {
    assert.ok(palette[token], `${token} is a palette token at :root`)
    const e = entry(token)
    assert.notEqual(e.kind, 'unknown', `${token} is derived from the theme (${e.expression})`)
    if (e.kind === 'role') {
      assert.ok(roles.has(e.role), `${token} reads ${e.role}, an existing --oi-* role (roles never change)`)
      same(e.fallback, palette[token])
    } else assert.ok(e.kind === 'mix' && CHROME.includes(e.of), `${token} mixes a bridged chrome token`)
  }
  const used = CHROME.map(entry).filter((e) => e.kind === 'role').map((e) => e.role)
  assert.equal(new Set(used).size, used.length, 'no two chrome tokens read one role, so a palette can round-trip')
})

test('the inhabitant devices\' copy of the palette follows the tokens it copies', () => {
  for (const token of INHABITANT) {
    const e = entry(token)
    assert.equal(e.kind, 'alias', `${token} aliases a chrome token under a theme`)
    assert.ok(CHROME.includes(e.of), `${token} → ${e.of}`)
    same(inhabitant[token], palette[e.of])
  }
})

test('presentation → root: no theme chosen paints the palette, whatever the appearance', () => {
  for (const appearance of ['light', 'dark', 'system']) {
    const tokens = rootTokens({appearance, id: null})
    for (const token of CHROME) assert.equal(tokens[token], palette[token])
  }
})

test('presentation → root: a library theme paints its roles; a role it leaves unset keeps the palette', () => {
  const nord = themeVariables(docs['nord-dark'])
  const tokens = rootTokens({appearance: 'dark', id: 'nord-dark'})
  assert.equal(tokens['--bg-0'], nord['--oi-shell-ground'])
  assert.equal(tokens['--bg-2'], nord['--oi-canvas-ground'])
  assert.equal(tokens['--text'], nord['--oi-foreground'])
  assert.equal(tokens['--accent'], nord['--oi-accent'])
  assert.equal(tokens['--sel'], nord['--oi-terminal-ansi-blue'])
  assert.equal(tokens['--disputed'], palette['--disputed'], 'Nord sets no --oi-syntax-invalid')
  const light = rootTokens({appearance: 'light', id: 'light-plus'})
  assert.equal(light['--rec'], palette['--rec'], 'Light Plus carries no terminal hues: the status hues stay')
})

test('presentation → root: an imported theme applies its variables; a sparse one falls back per token', () => {
  const custom = [{id: 't1-probe', variables: {'--oi-accent': '#4cc27a'}}]
  const tokens = rootTokens({appearance: 'dark', id: 't1-probe'}, custom)
  assert.equal(tokens['--accent'], '#4cc27a')
  same(tokens['--accent-wash'], 'rgba(76, 194, 122, 0.2)')
  for (const token of CHROME.filter((t) => t !== '--accent' && t !== '--accent-wash')) same(tokens[token], palette[token])
  const unknown = rootTokens({appearance: 'dark', id: 'no-such-theme'})
  for (const token of CHROME) same(unknown[token], palette[token])
})

test('the DLW palette is a library theme that paints exactly the palette', () => {
  assert.ok(THEMES.some((t) => t.id === 'dlw' && t.name === 'DLW' && t.appearance === 'dark'), 'Settings › Appearance lists DLW')
  assert.ok(themeImportRules(THEMES).bundled_themes.some((t) => t.id === 'dlw'), 'the kernel\'s import rules name DLW')
  const tokens = rootTokens({appearance: 'dark', id: 'dlw'})
  for (const token of CHROME) same(tokens[token], palette[token])
  const source = JSON.parse(read(new URL('themes/house/dlw.json', design)))
  assert.deepEqual(docs.dlw.tokens, houseTheme(source).tokens, 'themes/oi/dlw.json is the generator\'s output of themes/house/dlw.json')
  assert.deepEqual(Object.keys(docs.dlw.tokens).sort(), Object.keys(source.tokens).sort(), 'a house theme sets exactly the roles it declares')
})

test('a house theme may set only existing roles, with colour values', () => {
  const base = {id: 'probe', name: 'Probe', appearance: 'dark', source: {}, tokens: {'--oi-canvas-ground': '#101010', '--oi-foreground': '#f0f0f0', '--oi-accent': '#ff0000'}}
  assert.doesNotThrow(() => houseTheme(base))
  assert.throws(() => houseTheme({...base, tokens: {...base.tokens, '--oi-new-role': '#000000'}}), /not an --oi-\* role/)
  assert.throws(() => houseTheme({...base, tokens: {...base.tokens, '--oi-hairline': 'red'}}), /must be #rrggbb/)
})

test('null-theme identity: nothing the theme system adds matches a body without a chosen theme', () => {
  const themes = read(new URL('themes/themes.css', design))
  assert.equal(themes, emitCss(THEMES.map((t) => docs[t.id])), 'themes.css is the generator\'s output (never hand-edited)')
  const selectors = [...strip(themes).matchAll(/^([^\s{}][^{}]*)\{/gm)].map((m) => m[1].trim())
  assert.equal(selectors.length, THEMES.length)
  for (const theme of THEMES) assert.ok(selectors.includes(themeSelector(theme.id)), `${theme.id} has its block`)
  for (const selector of [...selectors, BRIDGE_SELECTOR]) {
    for (const part of selector.split(/,(?![^(]*\))/)) assert.match(part, /\[data-oi-theme(="[a-z0-9-]+")?\]/, `${part.trim()} requires a chosen theme`)
  }
  assert.match(themeSelector('x'), /:root:has\(> body:not\(\.oi-desktop\)\[data-oi-theme="x"\]\)/, 'the shell\'s block is the root over its body')
  assert.match(themeSelector('x'), /^\.oi-desktop\[data-oi-theme="x"\]/, 'the desktop keeps its own block selector')
})

test('the owner\'s choice reaches that body through the retained projection the shell mounts, and the library reaches the shell', () => {
  const projection = read(new URL('desktop/cradle/src/visuals/ParticleExpression.tsx', repo))
  assert.match(projection, /if \(themeId\) document\.body\.dataset\.oiTheme = themeId;\s*else delete document\.body\.dataset\.oiTheme;/)
  assert.match(projection, /receipt\.event === "presentation_changed"/, 'the projection re-reads on presentation_changed')
  assert.match(read(new URL('src/native/Foundation.tsx', ui)), /<VisualsProvider>/, 'the shell mounts the projection')
  assert.match(read(new URL('src/main.tsx', ui)), /^import '\.\/shell\/theme'/m, 'main.tsx mounts the theme module')
  assert.match(read(new URL('src/shell/theme/index.ts', ui)), /^import '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/oi-design-system\/themes\/themes\.css'$/m)
  assert.doesNotMatch(read(new URL('src/shell/theme/index.ts', ui)).replace(/\/\*[\s\S]*?\*\//g, ''), /presentation_read|theme_apply|dataset/, 'the module reads and writes no presentation itself')
})
