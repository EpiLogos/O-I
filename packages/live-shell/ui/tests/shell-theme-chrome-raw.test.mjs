/** The shell paints with one token system, and gains no raw colour (O-I #751, the CSS system; lane T1 began it). A raw colour
 * is a colour no theme reaches. The shell's tokens are declared once, in styles.css: the palette at :root (the default look) and
 * the theme bridge on the root above a body that carries a chosen theme (each token the theme's --oi-* role, or a mix of the
 * bridged tokens). Every stylesheet and script the candidate loads under packages/live-shell/ui/src and desktop/cradle/src is read
 * here (tests/support/rawColours.mjs), and every colour literal a stylesheet holds, or a script paints with (a style object's paint
 * key, an SVG paint attribute), is one of:
 *   - a token's own default: the literal a var() falls back to when it names a declared token (the token paints, not the literal);
 *   - a definition in a token block a theme reaches (TOKEN_BLOCKS, each with how the theme reaches it);
 *   - a mask's alpha (a mask paints nothing: only its alpha is read);
 *   - data (tests/support/themeData.mjs DATA: identity hues, the ink drawn on them, a picture's own colours, the cut's drawings, each
 *     with its reason);
 *   - or raw, which fails here.
 * The ratchet counts down to the data list: converting a literal is welcome — strike it from DATA. The colour pattern is the
 * cradle's raw-colour policy's (packages/oi-design-system/checks/verify.mjs), comments stripped. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {relative, resolve} from 'node:path'
import {DATA} from './support/themeData.mjs'

const {COLOUR, stripComments, TOKEN_BLOCKS, raw, scriptPaints} = await import('./support/rawColours.mjs')
const {reachable, repo} = await import('../scripts/candidate-reachable.mjs')
const {themeImportRules} = await import(new URL('../../../oi-design-system/scripts/convert.mjs', import.meta.url).href)

const isProduct = (path) => /^(packages\/live-shell\/ui\/src|desktop\/cradle\/src)\//.test(path)
const SCRIPT = /\.[cm]?[jt]sx?$/
const set = reachable()
const product = [...set].map((path) => relative(repo, path)).filter(isProduct).sort()
const sheets = product.filter((path) => path.endsWith('.css'))
const scripts = product.filter((path) => SCRIPT.test(path) && !/\.d\.[cm]?ts$/.test(path))

/** Every custom property the product declares (in its stylesheets, or set inline by its scripts), and the theme's roles. */
const declared = new Set(themeImportRules().roles)
for (const path of set) {
  const text = readFileSync(path, 'utf8')
  if (path.endsWith('.css')) for (const m of stripComments(text).matchAll(/(--[\w-]+)\s*:/g)) declared.add(m[1])
  else if (SCRIPT.test(path)) for (const m of text.matchAll(/['"`](--[\w-]+)['"`]/g)) declared.add(m[1])
}

const keyOf = (path) => path.replace(/^packages\/live-shell\/ui\/src\//, '')
const pathOf = (key) => key.startsWith('desktop/') ? key : `packages/live-shell/ui/src/${key}`
const count = (items) => items.reduce((counts, {literal}) => ({...counts, [literal]: (counts[literal] ?? 0) + 1}), {})
const gained = (counts, standing = {}) => Object.entries(counts).filter(([literal, n]) => n > (standing[literal] ?? 0)).map(([literal, n]) => `${literal} ×${n - (standing[literal] ?? 0)}`)
const sheetRaw = (path, text = readFileSync(resolve(repo, path), 'utf8')) => raw(text, {declared, blocks: TOKEN_BLOCKS[path] ?? []})
const scriptRaw = (path, text = readFileSync(resolve(repo, path), 'utf8')) => scriptPaints(text).filter(({kind, name}) => kind === 'paint' || !declared.has(name))

test('the ratchet reads every stylesheet and script the candidate loads', () => {
  assert.ok(sheets.length > 150, `the product's stylesheets (${sheets.length})`)
  assert.ok(scripts.length > 600, `the product's scripts (${scripts.length})`)
  for (const path of ['styles.css', 'settings/preferences.css', 'inhabitants/sdk/panel.css', 'projections/atlas/src/style/main.css',
    'inhabitants/catalogue/panels/panels.css']) assert.ok(sheets.includes(pathOf(path)), path)
  for (const path of ['native/ApplicationClose.tsx', 'inhabitants/catalogue/panels/scope.tsx']) assert.ok(scripts.includes(pathOf(path)), path)
})

let standing = 0
for (const path of sheets) {
  test(`${keyOf(path)} paints only with tokens, or data`, () => {
    const found = sheetRaw(path)
    standing += found.length
    const extra = gained(count(found), DATA[keyOf(path)])
    const where = found.filter(({literal}) => extra.some((e) => e.startsWith(`${literal} `))).map(({literal, line}) => `${literal} :${line}`)
    assert.deepEqual(extra, [], `${keyOf(path)} paints with a colour no theme reaches (${where.join(', ')}) — use the shell's tokens (styles.css) or name it as data in tests/support/themeData.mjs`)
  })
}

test('the product\'s scripts set no raw colour inline (a style object\'s paint, an SVG paint attribute)', () => {
  const faults = []
  for (const path of scripts) {
    const found = scriptRaw(path)
    standing += found.length
    const extra = gained(count(found), DATA[keyOf(path)])
    if (extra.length) faults.push(`${keyOf(path)}: ${found.filter(({literal}) => extra.some((e) => e.startsWith(`${literal} `))).map(({literal, line}) => `${literal} :${line}`).join(', ')}`)
  }
  assert.deepEqual(faults, [], 'a script paints with a colour no theme reaches — use a token (\'var(--text)\') or name it as data')
})

test('the data list names nothing the files no longer hold (strike a converted literal)', () => {
  for (const [key, kept] of Object.entries(DATA)) {
    const path = pathOf(key)
    assert.ok(product.includes(path), `${key} is a file the candidate loads`)
    const held = count(path.endsWith('.css') ? sheetRaw(path) : scriptRaw(path))
    for (const [literal, n] of Object.entries(kept)) assert.equal(held[literal] ?? 0, n, `${key}: ${literal} ×${n} is listed, ${held[literal] ?? 0} stand`)
  }
})

test('the ratchet has teeth: a raw colour fails, a token and its own default do not', () => {
  const blocks = [':root']
  assert.equal(raw('.x { color: #123456 }', {declared, blocks}).length, 1, 'a literal paint')
  assert.equal(raw('.x { box-shadow: 0 1px 2px rgba(0,0,0,.4) }', {declared, blocks}).length, 1, 'a literal shadow')
  assert.equal(raw('.x { --local: #123456 }', {declared, blocks}).length, 1, 'a token defined outside a reached block')
  assert.equal(raw('.x { color: var(--no-such-token, #123456) }', {declared, blocks}).length, 1, 'the default of a token nothing declares paints')
  assert.equal(raw('.x { color: var(--text, #d4d7da) }', {declared, blocks}).length, 0, 'a declared token\'s own default')
  assert.equal(raw('.x { --dp-x: var(--bg-2, #3f4348) }', {declared, blocks}).length, 0, 'a token\'s default inside a definition')
  assert.equal(raw('.x { background: color-mix(in srgb, var(--shade) 40%, transparent) }', {declared, blocks}).length, 0, 'a mix of tokens')
  assert.equal(raw(':root { --x: #123456 }', {declared, blocks}).length, 0, 'a definition in a reached block')
  assert.equal(raw('.x { mask-image: linear-gradient(#000, transparent) }', {declared, blocks}).length, 0, 'a mask\'s alpha')
  assert.equal(raw('.x { color: rgb(var(--core-rgb) / .5) }', {declared, blocks}).length, 0, 'channels read from a token')
  assert.equal(scriptPaints(`<rect fill="#123456" />`).length, 1, 'an SVG paint attribute')
  assert.equal(scriptPaints(`style={{color: pending ? 'rgba(1,2,3,.4)' : '#123456'}}`).length, 2, 'a style object\'s paint, both arms')
  assert.equal(scriptPaints(`const PALETTE = ['#123456']; <a title="#123 and #456">`).length, 0, 'data and words are not paints')
  const styles = readFileSync(resolve(repo, pathOf('styles.css')), 'utf8') + '\n.teeth { color: #abcdef }\n'
  assert.deepEqual(gained(count(sheetRaw(pathOf('styles.css'), styles)), DATA['styles.css']), ['#abcdef ×1'], 'one raw colour added to styles.css fails it')
  const settings = readFileSync(resolve(repo, pathOf('settings/preferences.css')), 'utf8').replace('background:var(--scrim)', 'background:#171a1e80')
  assert.deepEqual(gained(count(sheetRaw(pathOf('settings/preferences.css'), settings)), DATA['settings/preferences.css']), ['#171a1e80 ×1'], 'the Settings scrim put back as a literal fails')
})

test('the colours lane T1 converted stay tokens', () => {
  const mode = readFileSync(resolve(repo, pathOf('shell/modeSurface.css')), 'utf8')
  for (const token of ['--edge', '--disputed', '--fault', '--accent-wash', '--on-accent']) assert.match(mode, new RegExp(`var\\(${token}\\)`), `modeSurface.css paints with ${token}`)
  assert.match(readFileSync(resolve(repo, pathOf('inhabitants/inhabitantDevices.css')), 'utf8'), /body \{[^}]*background: var\(--gutter, #1b1d20\)/, 'the gutter between the panes is a token')
})

test.after(() => console.log(`colours standing outside the tokens in the shell's stylesheets and scripts: ${standing} (each listed as data)`))
