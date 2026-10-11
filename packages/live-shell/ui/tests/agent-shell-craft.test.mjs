import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, readdir} from 'node:fs/promises'

// Craft assertions for the agent-shell craft lane (zcode:agent-shell-craft,
// 2026-10-09): computed values the WIDGET-GUIDE and mockup pin, asserted in
// the existing suites' style — CSS text and component source as data, no
// browser needed. Density values come from agent-shell-mockup.html; icon
// rules from icon-cut.html (the owner's icon standard).

const css = await readFile(new URL('../src/agent/agentShell.css', import.meta.url), 'utf8')
const agentDir = new URL('../src/agent/', import.meta.url).pathname
const sources = (await readdir(agentDir)).filter(name => name.endsWith('.tsx') || name.endsWith('.ts'))
const read = name => readFile(new URL(`../src/agent/${name}`, import.meta.url), 'utf8')

const ruleFor = selector => {
  // Anchor on a line start so compound selectors (.a .b {) do not shadow the
  // main rule with an earlier substring match.
  const at = css.search(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/^\\./, '^\\.'), 'm')) ?? -1
  if (at === -1) return null
  const open = css.indexOf('{', at)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

test('the session grid keeps the mockup 26px slot and header rhythm', () => {
  assert.match(ruleFor('.agent-slot {') ?? ruleFor('.agent-slot {'), /height:26px/, 'clip slot height 26px')
  assert.match(ruleFor('.agent-track-hd {'), /height:26px/, 'track header height 26px')
  assert.match(ruleFor('.agent-stoprow {'), /height:22px/, 'stop row height 22px')
  assert.match(ruleFor('.agent-strip {'), /height:228px/, 'mixer strip keeps the mockup height')
})

test('the transport keeps the mockup control rhythm (19px rows, 10px type)', () => {
  const nc = ruleFor('.agent-shell-transport .agent-nc ')
  assert.match(nc, /height:19px/, 'nc control 19px tall')
  assert.match(nc, /font-size:10px/, 'nc control 10px type')
  const fld = ruleFor('.agent-shell-transport .agent-fld ')
  assert.match(fld, /font-family:var\(--mono\)/, 'readouts are mono')
})

test('the context dock uses the mockup tile/launcher geometry', () => {
  assert.match(ruleFor('.agent-tiles {'), /minmax\(270px, 1fr\)/, 'tiles auto-fill at 270px')
  assert.match(ruleFor('.agent-lgrid {'), /minmax\(130px, 1fr\)/, 'launcher cells at 130px')
  assert.match(ruleFor('.agent-lgrid {'), /grid-auto-rows:126px/, 'launcher rows 126px')
})

test('the clip stall grammar is the mockup hazard, not a flat fill', () => {
  const stall = ruleFor('.agent-slot.stall {')
  assert.match(stall, /repeating-linear-gradient\(135deg/, 'hazard stripes at 135deg')
  assert.match(stall, /var\(--stall\)/, 'stall colour carries the stripe')
  assert.match(ruleFor('.agent-slot.stall .tri {'), /var\(--stall\)/, 'stall triangle recolours')
  assert.match(ruleFor('.agent-slot.run .tri {'), /animation:agent-blink 1s/, 'run triangle blinks at 1s')
  assert.match(ruleFor('.agent-slot.queued .tri {'), /animation:agent-blink .35s/, 'queued triangle blinks fast')
})

test('the arrangement draws no predicted ends (mask fade on running, dash on queued)', () => {
  const run = ruleFor('.agent-arr .ac.run {')
  assert.match(run, /mask-image:linear-gradient/, 'running block fades out — no right edge')
  const qd = ruleFor('.agent-arr .qd {')
  assert.match(qd, /dashed/, 'queued block is a dash')
  assert.match(ruleFor('.agent-arr .needle {'), /width:2px/, 'needle is a 2px line')
})

test('transport controls carry drawn marks, not bare text glyphs', async () => {
  const transport = await read('AgentShellTransport.tsx')
  for (const banned of ['>▥<', '>▤<', '●◦', '>➜', '>⌘<', '>←<', '>○<', '>∞<']) {
    assert.ok(!transport.includes(banned), `raw glyph ${banned} replaced by a drawn mark`)
  }
  assert.ok(transport.includes('CutIcon name="link"'), 'Link draws the specimen mark')
  assert.ok(transport.includes('CutIcon name="tap"'), 'Tap draws the specimen mark')
  assert.ok(transport.includes('CutIcon name="metro"'), 'Heartbeat draws the pendulum')
  assert.ok(transport.includes('CutIcon name="follow"'), 'Follow draws the specimen mark')
  assert.ok(transport.includes('CutIcon name="arm"'), 'Write arm draws the lever')
  assert.ok(transport.includes('CutIcon name="back"'), 'Hand back draws the specimen mark')
  assert.ok(transport.includes('CutIcon name="cap"'), 'Capture draws the recording head')
  assert.ok(transport.includes('CutIcon name="loop"'), 'Loop draws the specimen mark')
  assert.ok(transport.includes('CutIcon name="browser"'), 'Browser toggle draws the globe')
  assert.ok(transport.includes('CutIcon name="detail"'), 'Detail toggle draws the panes')
})

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
  for (const name of ['AgentDeviceChain.tsx', 'AgentShellBrowser.tsx', 'AgentDockTileBody.tsx', 'AgentDevicePool.tsx']) {
    const source = await read(name)
    // The only allowed JSON.stringify is through safeJson (a folded receipt).
    const raw = [...source.matchAll(/JSON\.stringify\(/g)].length
    const safe = [...source.matchAll(/safeJson\(/g)].length
    assert.ok(raw === 0, `${name} stringify calls must go through safeJson (found ${raw})`)
  }
  const rack = await read('NativeAgentDeviceRack.tsx')
  assert.ok(rack.includes('InlineNote'), 'chain cards carry the one-styled-line refusal')
  const dock = await read('AgentContextDock.tsx')
  assert.ok(dock.includes('agent-lcell'), 'launcher renders preview cells')
  assert.ok(dock.includes('agent-tile-h'), 'tiles carry the tile header anatomy')
})

test('the disclosure card grammar is styled, named and dismissible', () => {
  const refusal = ruleFor('.agent-refusal {')
  assert.match(refusal, /var\(--stall\)/, 'refusal border carries the stall colour')
  const card = ruleFor('.agent-refusal details {')
  assert.ok(card !== null, 'the receipt folds into details')
})
