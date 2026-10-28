import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, readdir} from 'node:fs/promises'

// Craft assertions for the agent-shell craft lane (zcode:agent-shell-craft,
// 2026-10-09): computed values the manual (§16.9-§16.10) and the mockup pin, asserted in
// the existing suites' style — CSS text and component source as data, no
// browser needed. Density values come from agent-shell-mockup.html; icon
// rules from icon-cut.html (the owner's icon standard).

const css = await readFile(new URL('../src/agent/agentShell.css', import.meta.url), 'utf8')
// The Session grid and the Arrangement ruler are the one tracks pane's (FOUNDATION F3); the agent shell no longer draws its own.
// Their craft floor is world-shell-mockup.html (`.trk`, `.cs`, `.thd`), so those rhythms are pinned on the shared stylesheet.
const tracksCss = await readFile(new URL('../src/frame/tracks/tracks.css', import.meta.url), 'utf8')
const agentDir = new URL('../src/agent/', import.meta.url).pathname
const sources = (await readdir(agentDir)).filter(name => name.endsWith('.tsx') || name.endsWith('.ts'))
const read = name => readFile(new URL(`../src/agent/${name}`, import.meta.url), 'utf8')

const ruleIn = (text, selector) => {
  // Anchor on a line start so compound selectors (.a .b {) do not shadow the
  // main rule with an earlier substring match.
  const at = text.search(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/^\\\./, '^\\.'), 'm')) ?? -1
  if (at === -1) return null
  const open = text.indexOf('{', at)
  const close = text.indexOf('}', open)
  return text.slice(open + 1, close)
}
const ruleFor = selector => ruleIn(css, selector)
const trackRule = selector => ruleIn(tracksCss, selector)

// W4 (the design is the standard, the mockups the floor): the cell takes the design's 52px, room for a clip's second line
// (catalogue dlw__session-grid.css .sgd-cell). Replaces the mockup's 28px (world-shell-mockup.html .cs).
test('the session grid keeps the design\'s 52px cell and the mockup 26px header and 22px stop-row rhythm (the one shared grid)', () => {
  assert.match(trackRule('.cs {'), /height:\s*52px/, 'clip cell height 52px (catalogue dlw__session-grid.css .sgd-cell)')
  assert.match(trackRule('.trk .thd {'), /height:\s*26px/, 'track header height 26px')
  assert.match(trackRule('.trk-foot {'), /height:\s*22px/, 'the track foot (retry) keeps the stop row\'s 22px')
  assert.match(trackRule('.trk.sub {'), /width:\s*104px/, 'a helper\'s track is 104px wide (mockup .trk.sub)')
  assert.match(trackRule('.trk-main {'), /width:\s*100px/, 'the Main column is 100px (mockup sessView)')
  assert.equal(ruleFor('.agent-slot {'), null, 'the agent shell no longer styles a grid of its own')
})

// DELETED (#804): "the transport keeps the mockup control rhythm" and "the context dock uses the mockup tile/launcher geometry" — the old
// Factory bar (AgentShellTransport.tsx) and the agent dock (AgentContextDock.tsx) were unreached and are deleted, with their rules in
// agentShell.css. Their replacements hold their craft: the one transport's floor in browser-transport-craft.test.mjs ("the transport
// stylesheet holds the floor") and f7-transport.test.mjs, the one widget rail's in widget-rail-craft.test.mjs ("the launcher's cells are
// 122px rows in two columns").
test('DELETED (#804) — the old bar\'s and the dock\'s rules are gone with them', () => {
  for (const selector of ['.agent-shell-transport .agent-nc ', '.agent-context-dock {', '.agent-tiles {', '.agent-lgrid {']) assert.equal(ruleFor(selector), null, `${selector.trim()}: no rule`)
})

test('the clip stall grammar is the mockup hazard, not a flat fill (the one shared grid)', () => {
  const stall = trackRule('.cs.clip.stalled {')
  assert.match(stall, /repeating-linear-gradient\(135deg/, 'hazard stripes at 135deg')
  assert.match(stall, /var\(--stalled\)/, 'stall colour carries the stripe')
  assert.match(trackRule('.cs.clip.stalled .tri {'), /var\(--stalled\)/, 'stall triangle recolours')
  assert.match(trackRule('.cs.clip.running .tri {'), /animation:\s*tracks-blink 1s/, 'run triangle blinks at 1s')
  assert.match(trackRule('.cs.clip.waiting .tri {'), /animation:\s*tracks-blink \.35s/, 'queued triangle blinks fast')
})

test('the arrangement draws no predicted ends (mask fade on running, dash on queued) (the one shared ruler)', () => {
  assert.match(trackRule('.tl-clip.running {'), /mask-image:\s*linear-gradient/, 'running block fades out — no right edge')
  assert.match(trackRule('.tl-clip.dash {'), /dashed/, 'queued block is a dash')
  assert.match(trackRule('.tl-needle {'), /width:\s*2px/, 'needle is a 2px line')
})

// DELETED (#804): "transport controls carry drawn marks, not bare text glyphs" read the old Factory bar (AgentShellTransport.tsx), deleted
// unreached. The one transport draws every slot's mark from the cut (frame/transport/slots.ts): browser-transport-craft.test.mjs ("the
// transport groups Link and Tap with the tempo cells … and keeps the slot laws") and f7-transport.test.mjs hold it.

test('icon marks come from the specimen set, not ad-hoc paths', async () => {
  const icons = await read('agentIcons.tsx')
  assert.match(icons, /VERBATIM from the icon specimen/, 'provenance header names icon-cut.html')
  assert.match(icons, /link:`<circle cx="8" cy="12" r="3"\/><circle cx="16" cy="12" r="3"\/><path d="M11 12h2"\/>`/,
    'the link mark is the specimen path, verbatim')
  const mask = await read('maskFace.ts')
  assert.match(mask, /icon-cut\.html/, 'the mask names its specimen source')
  assert.match(mask, /const FACE_DATA/, 'the mask carries the specimen polygon data')
})

test('no raw JSON renders as a panel surface — receipts fold, cards name', async () => {
  for (const name of ['devices/FactoryDeviceChain.tsx', 'AgentShellBrowser.tsx', 'AgentDockTileBody.tsx']) {
    const source = await read(name)
    // The only allowed JSON.stringify is through safeJson (a folded receipt).
    const raw = [...source.matchAll(/JSON\.stringify\(/g)].length
    const safe = [...source.matchAll(/safeJson\(/g)].length
    assert.ok(raw === 0, `${name} stringify calls must go through safeJson (found ${raw})`)
  }
  // The chain's cards are devices of the runtime (devices/FactoryDeviceChain.tsx); its refusals land as the one disclosure card.
  const chain = await read('devices/FactoryDeviceChain.tsx')
  assert.ok(chain.includes('<RefusalCard'), 'the chain\'s refusals render through the landed disclosure card')
  assert.ok(chain.includes('agent-transport-note'), 'and its receipts as the one styled line')
  // REPLACED (#804): "launcher renders preview cells; tiles carry the tile header anatomy" on the deleted agent dock — the one widget rail
  // draws both (widget-rail-craft.test.mjs "the rail wears the mockup's anatomy").
})

test('the disclosure card grammar is styled, named and dismissible', () => {
  const refusal = ruleFor('.agent-refusal {')
  assert.match(refusal, /var\(--stall\)/, 'refusal border carries the stall colour')
  const card = ruleFor('.agent-refusal details {')
  assert.ok(card !== null, 'the receipt folds into details')
})
