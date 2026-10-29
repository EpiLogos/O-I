/** A theme changes every surface it names, and nothing it names stays hard-coded (O-I #744, the theme system made usable; #751 is the CSS
 * system's later phase). The token audit's fixes: Factory's frame re-declares the chrome tokens on its own element for the agent-shell
 * oracle (agent/agentShell.css; tests/agent-shell-tokens.test.mjs holds those values), which shadowed the bridge on the root, so a theme
 * chosen in Settings › Appearance never reached Factory's chrome; under a chosen theme the frame now takes the bridged tokens from the
 * root. The scrollbar thumb, a native control's edge and an inhabitant's fault ink painted literals the theme names (--oi-scrollbar-thumb,
 * --oi-rule, --oi-terminal-ansi-bright-red); they paint with the shell's tokens now. Read from source; the cascade's own rule (a custom
 * property set to `inherit` takes its parent's computed value) does the rest. Not a screen pass. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const styles = read('../src/styles.css'), agent = read('../src/agent/agentShell.css')
const declarations = (body) => Object.fromEntries(body.split(';').map((part) => part.trim()).filter((part) => part.startsWith('--'))
  .map((part) => { const at = part.indexOf(':'); return [part.slice(0, at).trim(), part.slice(at + 1).trim()] }))
const BRIDGE = ':root:has(> body[data-oi-theme])'
const block = (text, selector) => { const at = text.indexOf(`${selector} {`); return at < 0 ? null : declarations(text.slice(text.indexOf('{', at) + 1, text.indexOf('}', at))) }
const bridge = block(styles, BRIDGE), palette = declarations(/^:root \{([\s\S]*?)\}/m.exec(styles)[1])
const frame = block(agent, '.frame.agent-shell-frame')

test('Factory\'s frame takes the chosen theme: every bridged token it re-declares is inherited from the root under a theme', () => {
  const shadowed = Object.keys(frame).filter((token) => token in bridge)
  assert.ok(shadowed.length >= 15, `the frame re-declares the bridged chrome tokens (${shadowed.join(' ')})`)
  const themed = block(agent, `${BRIDGE} .frame.agent-shell-frame`)
  assert.ok(themed, 'a rule for the frame under a chosen theme')
  for (const token of shadowed) assert.equal(themed[token], 'inherit', `${token}: the root's themed value reaches Factory`)
  for (const [token, value] of Object.entries(themed)) {
    const reads = [...value.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1])
    assert.ok(value === 'inherit' || (reads.length && reads.every((of) => of in bridge) && !/#[0-9a-f]{3,8}\b|rgba?\(/i.test(value)),
      `${token}: inherited, or derived from bridged tokens — never a second value (${value})`)
  }
  assert.equal(themed['--accent-ink'], 'var(--on-accent)', 'the ink on the accent follows the theme\'s')
})

test('every colour the frame declares follows the theme, or pairs with an identity hue (O-I #751)', () => {
  const colour = /#[0-9a-f]{3,8}\b|rgba?\(/i
  const themed = block(agent, `${BRIDGE} .frame.agent-shell-frame`)
  // the cut's agent hues, the track's default colour, the inks on a track's colour (heads, named cells, the cell's triangle), the mask's ink
  const data = ['--honey', '--bumble', '--drone', '--track-default', '--track-ink', '--slot-ink', '--slot-ink-tri', '--mask-ink']
  const colours = Object.entries(frame).filter(([, value]) => colour.test(value)).map(([token]) => token)
  assert.ok(colours.length >= 30, `the frame's colour tokens (${colours.length})`)
  for (const token of colours) assert.ok(token in themed || data.includes(token), `${token}: the theme reaches it, or it is named as data`)
  for (const [token, value] of [['--rail-bg', 'color-mix(in srgb,var(--edge) 67%,black)'], ['--rail-border', 'color-mix(in srgb,var(--bg-0) 60%,black)']]) {
    assert.equal(themed[token], value, `${token}: the rail's derivation (exact on the palette)`)
  }
})

test('the scrollbar, a native control\'s edge and an inhabitant\'s fault ink paint with the shell\'s tokens, which the theme reaches', () => {
  assert.match(styles, /::-webkit-scrollbar-thumb \{ background:var\(--scrollbar\);/)
  assert.equal(bridge['--scrollbar'], 'var(--oi-scrollbar-thumb,#777e80)', 'the bridge reads the theme\'s scrollbar thumb, the palette its fallback')
  assert.equal(palette['--scrollbar'], '#777e80', 'unthemed, the palette paints it as before')
  assert.match(styles, /\.native-control \{[^}]*border:1px solid var\(--edge\)/)
  assert.match(styles, /\.inhabitant-fault \{[^}]*color:var\(--fault\)/)
})

test('the Native Workbench\'s own foundation colours are the shell\'s tokens, themed or not (O-I #751)', () => {
  const workbench = read('../src/native/workbench.css'), grammar = read('../src/frame/paneGrammar.css'), knowledge = read('../src/panels/knowledge.css')
  const themed = block(grammar, ':root .candidate-workbench')
  assert.ok(themed, 'frame/paneGrammar.css maps the Workbench onto the shell\'s tokens, above workbench.css\'s own declarations')
  const colour = /#[0-9a-f]{3,8}\b|rgba?\(|light-dark\(/i
  const literal = new Set()
  for (const m of workbench.matchAll(/(--oi-[a-z0-9-]+)\s*:\s*([^;]+);/g)) if (colour.test(m[2])) literal.add(m[1])
  for (const m of workbench.matchAll(/var\((--oi-[a-z0-9-]+),\s*(#[0-9a-f]{3,8})\)/gi)) literal.add(m[1])
  assert.ok(literal.size >= 15, `the Workbench's literal colour tokens (${[...literal].join(' ')})`)
  for (const token of literal) {
    assert.ok(token in themed, `${token}: the theme reaches it`)
    assert.match(themed[token], /^var\(--[a-z0-9-]+\)$/, `${token}: one of the shell's tokens`)
    assert.ok(themed[token].slice(4, -1) in bridge, `${token} → ${themed[token]}, a bridged token`)
  }
  const panel = block(knowledge, `${BRIDGE} .candidate-knowledge`)
  for (const token of ['--oi-text', '--oi-border']) assert.ok(panel?.[token], `the knowledge panel's ${token} follows the theme`)
})
