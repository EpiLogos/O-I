/**
 * The running shell's frame is the world-shell mockup's frame (shell parity B9, 13 Nov; audit G1-G3, T1-T4).
 *
 * The numbers are read out of the mockup, never typed: tests/world-shell-oracle.json is written by
 * tests/support/build-world-shell-oracle.mjs from desktop/cradle/docs/world-shell/world-shell-mockup.html, and carries the
 * mockup's hash; a changed mockup fails here until the oracle is built again from it.
 *
 * The stage is the real shell entry (src/main.tsx, bundled as the screen pass bundles it) with no kernel behind it: the shell
 * draws its degraded states, and its frame stands as it stands for a person who has chosen no sizes. At the mockup's own
 * 1920x1200 each region's box must be the mockup's within 2px, in every mode — Live, Central, Factory, Expressions, Technē — so
 * switching mode moves no edge (G2). At two smaller windows of the mockup's proportion the browser, the rail and the detail row
 * must stand at the mockup's sizes scaled as the mockup scales its page (its fit()). The transport's 3px rule and the status
 * bar's 1px rule and 11px words are read from the computed style.
 *
 * Channel: headless Chromium (playwright, cradle's copy). A missing browser throws; nothing here skips. With an isolated HOME,
 * export PLAYWRIGHT_BROWSERS_PATH.
 *
 *   node tests/world-shell-geometry.browser.mjs
 */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {bundleEntry, serveShellPage, launchShell, shellHtml, ui, root, CUT_BRIDGE} from './support/agentShellHarness.mjs'

const oracle = JSON.parse(await readFile(join(ui, 'tests/world-shell-oracle.json'), 'utf8'))
const mockup = await readFile(join(root, oracle.source))
assert.equal(createHash('sha256').update(mockup).digest('hex'), oracle.sha256,
  `${oracle.source} changed since the oracle was read from it: run node tests/support/build-world-shell-oracle.mjs and look at what moved`)

const TOLERANCE = 2
const MODES = {live: 'Live', base: 'Central', factory: 'Factory', expressions: 'Expressions', techne: 'Technē'}
/** The shell's region for each of the mockup's (.tp .br .ct .dk .dt .sb, and the title line). */
const SHELL = {
  transport: '.frame > header.transport',
  browser: '.frame .one-browser',
  centre: '.frame > main.center',
  rail: '.frame .widget-rail',
  detail: '.frame .detail-host',
  status: '.frame footer.statusbar',
  title: '.frame .set-title',
}
/** Smaller windows of the mockup's 16:10, where the mockup scales its page by width/1920. */
const SCALED = [{width: 1440, height: 900}, {width: 1280, height: 800}]

function measure(selectors) {
  const out = {regions: {}, missing: []}
  for (const [name, selector] of Object.entries(selectors)) {
    const el = document.querySelector(selector)
    if (!el) { out.missing.push(`${name} (${selector})`); continue }
    const b = el.getBoundingClientRect()
    out.regions[name] = {x: b.x, y: b.y, width: b.width, height: b.height}
  }
  const style = selector => { const el = document.querySelector(selector); return el ? getComputedStyle(el) : null }
  const tp = style(selectors.transport), sb = style(selectors.status)
  out.rules = {transportRule: tp && parseFloat(tp.borderBottomWidth), statusRule: sb && parseFloat(sb.borderTopWidth),
    statusFontSize: sb && parseFloat(sb.fontSize)}
  return out
}

const faults = []
const near = (label, got, want) => { if (Math.abs(got - want) > TOLERANCE) faults.push(`${label}: ${Math.round(got * 10) / 10}, the mockup's ${Math.round(want * 10) / 10}`) }

const {js, css} = await bundleEntry({contents: `import './src/main'`, resolveDir: ui, sourcefile: 'world-shell-geometry-entry.tsx', outfile: 'world-shell-geometry-entry.mjs'})
const host = await serveShellPage({html: shellHtml({js, css}), kernelBridge: CUT_BRIDGE})
const shell = await launchShell(oracle.viewport)
const measured = {}
try {
  await shell.page.addInitScript(url => { window.__OI_KERNEL_BRIDGE__ = url }, CUT_BRIDGE)
  await shell.page.goto(host.url, {waitUntil: 'load'})
  await shell.page.waitForSelector('.frame footer.statusbar', {timeout: 30000})
  await shell.page.waitForTimeout(1500)
  for (const [mode, title] of Object.entries(MODES)) {
    const rail = shell.page.locator(`button.mode-rail-button[aria-label="${title}"]`).first()
    assert.ok(await rail.count(), `the mode rail offers ${title}`)
    await rail.click()
    await shell.page.waitForTimeout(1200)
    const got = measured[mode] = await shell.page.evaluate(measure, SHELL)
    for (const name of got.missing) faults.push(`${mode}: the shell draws no ${name}`)
    for (const [name, box] of Object.entries(got.regions)) {
      const want = oracle.regions[name]
      // The title line's height is the mockup's; its width is the bar's less the traffic-light inset where that applies.
      const keys = name === 'title' ? ['y', 'height'] : ['x', 'y', 'width', 'height']
      for (const key of keys) near(`${mode} › ${name}.${key}`, box[key], want[key])
    }
    for (const [rule, value] of Object.entries(got.rules)) near(`${mode} › ${rule}`, value ?? NaN, oracle.rules[rule])
  }
  // G2: nothing in the frame moves when the mode changes.
  const [first, ...rest] = Object.keys(MODES)
  for (const mode of rest) for (const name of Object.keys(SHELL)) {
    const a = measured[first].regions[name], b = measured[mode].regions[name]
    if (a && b && JSON.stringify(a) !== JSON.stringify(b)) faults.push(`switching ${first} → ${mode} moves the ${name}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`)
  }
  for (const viewport of SCALED) {
    await shell.page.setViewportSize(viewport)
    await shell.page.waitForTimeout(600)
    const scale = Math.min(viewport.width / oracle.viewport.width, viewport.height / oracle.viewport.height)
    const got = await shell.page.evaluate(measure, SHELL)
    const at = `${viewport.width}x${viewport.height}`
    near(`${at} › browser.width`, got.regions.browser?.width ?? NaN, oracle.regions.browser.width * scale)
    near(`${at} › rail.width`, got.regions.rail?.width ?? NaN, oracle.regions.rail.width * scale)
    near(`${at} › detail.height`, got.regions.detail?.height ?? NaN, oracle.regions.detail.height * scale)
  }
} finally {
  await shell.browser.close()
  await host.close()
}

for (const [mode, got] of Object.entries(measured)) {
  console.log(`${mode.padEnd(12)} ${Object.entries(got.regions).map(([name, b]) => `${name} ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`).join(' · ')}`)
}
if (faults.length) {
  console.error(`world-shell geometry: ${faults.length} drift(s) from ${oracle.source}\n  ${faults.join('\n  ')}`)
  process.exit(1)
}
console.log(`world-shell geometry: the frame is the mockup's in all ${Object.keys(MODES).length} modes, and scales as it scales`)
