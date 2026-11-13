import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {agentShellOraclePath} from './support/agentShellHarness.mjs'

const fidelity = JSON.parse(await readFile(agentShellOraclePath(), 'utf8'))
const css = await readFile(new URL('../src/agent/agentShell.css', import.meta.url), 'utf8')

// The scoped token + geometry rule must be the first agent-shell-frame rule.
const ruleStart = css.indexOf('.frame.agent-shell-frame')
assert.ok(ruleStart !== -1, 'scoped .frame.agent-shell-frame rule present')
const declStart = css.indexOf('{', ruleStart) + 1
const declEnd = css.indexOf('}', declStart)
const block = css.slice(declStart, declEnd)

function declarations(text) {
  const map = new Map()
  for (const match of text.matchAll(/([^\s;:]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1], match[2].trim())
  }
  return map
}

const collapse = value => value.replace(/\s+/g, ' ').trim()

test('every oracle token is declared on the scoped frame with the exact oracle value', () => {
  const decls = declarations(block)
  for (const [name, value] of Object.entries(fidelity.tokens)) {
    assert.ok(decls.has(name), `missing token ${name}`)
    assert.equal(decls.get(name), value, `token ${name} drifted from the oracle`)
  }
})

test('no raw hex literals remain outside the token block', () => {
  const rest = css.slice(0, declStart) + css.slice(declEnd)
  const hexes = [...rest.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(match => match[0])
  assert.deepEqual(hexes, [], `raw hex outside the token block: ${hexes.join(', ')}`)
})

// REPLACED (shell parity B1, 13 Nov): two tests here held Factory's own grid templates to the agent oracle's strings (400 | 1fr | 300,
// rows 64 | 1fr | 300 | 28, with the transport row swapped for var(--transport-h) before comparing, so it could not fail) and its
// dock-open, no-browser, no-detail and no-dock variants. Factory drew a second frame: switching to it moved the browser's edge 30px
// and the rail's 40px. There is one frame now (styles.css .frame, the world-shell mockup's), measured in every mode, Factory's
// included, by tests/world-shell-geometry.browser.mjs against the numbers read out of the mockup. What the agent frame keeps is its
// area names.
test('the agent frame keeps the oracle\'s area names and draws no geometry of its own', () => {
  const decls = declarations(block)
  assert.equal(collapse(decls.get('grid-template-areas') ?? ''), collapse(fidelity.geometry.frame.gridTemplateAreas), 'the areas are the oracle\'s')
  for (const prop of ['grid-template-columns', 'grid-template-rows', '--browser-w', '--detail-h', '--dock-w']) {
    assert.ok(!decls.has(prop), `the agent frame declares ${prop}: Factory would stand in a frame of its own`)
  }
  assert.doesNotMatch(css, /\.frame\.agent-shell-frame[^{]*\{[^}]*grid-template-(columns|rows)/, 'no variant of the agent frame redraws the columns or rows')
})
