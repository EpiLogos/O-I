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
    const of = /^var\((--[a-z0-9-]+)\)$/.exec(value)?.[1]
    assert.ok(value === 'inherit' || (of && of in bridge), `${token}: inherited, or a bridged token — never a second value`)
  }
  assert.equal(themed['--accent-ink'], 'var(--on-accent)', 'the ink on the accent follows the theme\'s')
})

test('the scrollbar, a native control\'s edge and an inhabitant\'s fault ink paint with the shell\'s tokens, which the theme reaches', () => {
  assert.match(styles, /::-webkit-scrollbar-thumb \{ background:var\(--scrollbar\);/)
  assert.equal(bridge['--scrollbar'], 'var(--oi-scrollbar-thumb,#777e80)', 'the bridge reads the theme\'s scrollbar thumb, the palette its fallback')
  assert.equal(palette['--scrollbar'], '#777e80', 'unthemed, the palette paints it as before')
  assert.match(styles, /\.native-control \{[^}]*border:1px solid var\(--edge\)/)
  assert.match(styles, /\.inhabitant-fault \{[^}]*color:var\(--fault\)/)
})
