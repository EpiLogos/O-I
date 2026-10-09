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

test('frame grid templates equal the oracle geometry strings', () => {
  const decls = declarations(block)
  const frame = fidelity.geometry.frame
  for (const [prop, oracleValue] of [
    ['grid-template-columns', frame.gridTemplateColumns],
    ['grid-template-rows', frame.gridTemplateRows],
    ['grid-template-areas', frame.gridTemplateAreas],
  ]) {
    assert.ok(decls.has(prop), `missing ${prop}`)
    assert.equal(collapse(decls.get(prop)), collapse(oracleValue), `${prop} drifted from the oracle`)
  }
})

test('frame variants keep the oracle fallback geometry', () => {
  const rowDetail = /grid-template-rows:64px minmax\(0, ?1fr\) 0 28px/
  const colBrowser = /grid-template-columns:0 minmax\(0, ?1fr\) var\(--dock-w\)/
  const rule = pattern => {
    const match = css.match(pattern)
    assert.ok(match, `rule not found: ${pattern}`)
    return match[0]
  }
  assert.ok(rowDetail.test(rule(/\.frame\.agent-shell-frame\.detail-hidden[^{]*\{[^}]*\}/)))
  assert.ok(rowDetail.test(rule(/\.frame\.agent-shell-frame\.no-detail \{[^}]*\}/)))
  assert.ok(colBrowser.test(rule(/\.frame\.agent-shell-frame\.browser-hidden,\n[^{]*\{[^}]*\}/)))
  assert.ok(colBrowser.test(rule(/\.frame\.agent-shell-frame\.no-browser \{[^}]*\}/)))
  assert.ok(/grid-template-columns:400px minmax\(0, ?1fr\) 0/.test(rule(/\.frame\.agent-shell-frame\.no-dock \{[^}]*\}/)))
})
