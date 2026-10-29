/**
 * Themes reach everything (O-I #751, the CSS system). The real shell entry (src/main.tsx, bundled as the screen pass bundles
 * it) is drawn headless with no kernel behind it, and each mode — Live, Central, Factory, Expressions, Technē — is read three
 * times: with no theme chosen, under a light library theme and under a dark one. The theme lands on the body as the presentation
 * projection lands it (desktop/cradle/src/visuals/ParticleExpression.tsx applyTheme: body[data-oi-theme]). For every surface —
 * the transport, the mode rail, the browser, the centre, the detail, the widget rail, the status bar, the device kit, the atlas
 * pane and the Settings window — every visible paint (text colour, ground, edges, outline, shadow, gradient, SVG fill and
 * stroke) is read from the computed style. A paint that is the same with no theme and under both themes is a colour no theme
 * reaches; it fails unless its colour is data (tests/support/themeData.mjs: identity hues and the ink drawn on them).
 *
 * Each mode is captured under each theme, and Settings under each theme, into --out (default .shell-theme-walk/).
 *
 * Channel: headless Chromium (playwright), the pixels of the web frontend, not the native window.
 *
 *   node tests/shell-theme-walk.browser.mjs [--out <dir>] [--light solarized-light] [--dark catppuccin-mocha]
 */
import assert from 'node:assert/strict'
import {mkdir, readFile as readFileAsync, writeFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {join, resolve} from 'node:path'
import {readFileSync} from 'node:fs'
import {DATA, IDENTITY} from './support/themeData.mjs'

const {bundleEntry, serveShellPage, launchShell, shellHtml, ui, CUT_BRIDGE} = await import('./support/agentShellHarness.mjs')

const arg = (name, fallback) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback
const OUT = resolve(arg('--out', join(ui, '.shell-theme-walk')))
const LIGHT = arg('--light', 'solarized-light')
const DARK = arg('--dark', 'catppuccin-mocha')
const BRIDGE = process.env.OI_KERNEL_BRIDGE ?? CUT_BRIDGE
const STATES = [null, LIGHT, DARK]
const MODES = {live: 'Live', base: 'Central', factory: 'Factory', expressions: 'Expressions', techne: 'Technē'}
/** The surfaces a theme must reach, by the selector of their root. */
const SURFACES = {
  transport: '.mode-transport',
  'mode rail': 'nav.transport-modes',
  browser: 'aside.one-browser',
  centre: '.frame > :is(main, .mode-centre, .centre, .candidate-workbench, .surface-host), .frame .mode-centre, .frame .candidate-workbench',
  detail: '.detail-side',
  'widget rail': 'aside.widget-rail',
  'status bar': 'footer.statusbar',
  'device kit': 'section.dp, section.dp-tile',
  // The atlas pane's own chrome: the host's status line (atlasHost.css). What the atlas draws in the pane is the Earth's picture
  // (themeData.mjs REASONS.PICTURE); its controls are the devices' (the device kit, above). The fixture stage below mounts it.
  atlas: '.atlas-host-status',
  // and everything else the page draws: the foundation's fault, a floating line or menu, anything outside the regions above
  'whole page': 'body',
}
const SETTINGS = '.settings-window'
const DATA_COLOURS = Object.values(IDENTITY).flat()
/** The cut's own literals (themeData.mjs DATA for inhabitants/sdk/icons.ts and agent/agentIcons.tsx), and its drawings' markup. */
const CUT_LITERALS = [...new Set([...Object.keys(DATA['inhabitants/sdk/icons.ts']), ...Object.keys(DATA['agent/agentIcons.tsx'])])]
  .map((c) => c.length === 4 ? '#' + [...c.slice(1)].map((d) => d + d).join('') : c)
const CUT = [...readFileSync(join(ui, 'src/inhabitants/sdk/icons.ts'), 'utf8').matchAll(/'(<[^']*>)'/g)].map((m) => m[1])

await mkdir(OUT, {recursive: true})

/** In the page: every visible paint under the roots that match `selector`, keyed by a stable id on each element. */
function readPaints({selector, cut}) {
  // The cut's drawings (inhabitants/sdk/icons.ts, agent/agentIcons.tsx — icon-cut.html via devices:sync-icons): a kind mark's facets
  // and the knob's cap are the drawing's own (themeData.mjs DATA); the drawing is known by its markup, as the browser writes it.
  const known = new Set(cut.map((markup) => { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.innerHTML = markup; return svg.innerHTML }))
  const isCut = (el) => { const svg = el.closest('svg'); return !!svg && (known.has(svg.innerHTML.replace(/ data-b751="\d+"/g, '')) || !!svg.querySelector('stop[stop-color="#6a6f76"]')) }
  const props = ['background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color',
    'box-shadow', 'background-image', 'fill', 'stroke', 'text-shadow', 'caret-color']
  const out = []
  let next = Number(document.body.dataset.b751Next ?? 0)
  for (const root of document.querySelectorAll(selector)) {
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const rect = el.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) continue
      const cs = getComputedStyle(el)
      if (cs.visibility !== 'visible' || cs.display === 'none' || Number(cs.opacity) === 0) continue
      if (!el.dataset.b751) el.dataset.b751 = String(next++)
      const path = (() => {
        const parts = []
        for (let node = el; node && node !== document.body && parts.length < 4; node = node.parentElement) {
          parts.unshift(node.tagName.toLowerCase() + (node.classList.length ? '.' + [...node.classList].slice(0, 2).join('.') : ''))
        }
        return parts.join(' > ')
      })()
      const art = el instanceof SVGElement && isCut(el)
      const add = (prop, value) => out.push({id: el.dataset.b751, path, prop, value, art})
      const text = [...el.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())
      if (text) add('color', cs.color)
      for (const prop of props) {
        const value = cs.getPropertyValue(prop)
        if (!value || value === 'none') continue
        if (prop.startsWith('border-') && (parseFloat(cs.getPropertyValue(prop.replace('-color', '-width'))) === 0 || cs.getPropertyValue(prop.replace('-color', '-style')) === 'none')) continue
        if (prop === 'outline-color' && (cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) === 0)) continue
        if (prop === 'background-image' && !/(rgb|color\(|#)/.test(value)) continue
        // an SVG paint is drawn by a shape (the <svg> itself and a group paint nothing of their own)
        if ((prop === 'fill' || prop === 'stroke') && !el.matches('path, circle, rect, ellipse, line, polyline, polygon, text, tspan, use')) continue
        if (prop === 'caret-color' && !el.matches('input, textarea, [contenteditable]')) continue
        add(prop, value)
      }
    }
  }
  document.body.dataset.b751Next = String(next)
  return out
}

/** Every colour in a computed value, as [r, g, b, a]. */
function colours(value) {
  const found = []
  for (const m of String(value).matchAll(/rgba?\(([^)]*)\)|color\(srgb ([^)]*)\)/g)) {
    if (m[1]) { const [r, g, b, a = '1'] = m[1].split(/[\s,/]+/).filter(Boolean); found.push([+r, +g, +b, +a]) }
    else { const [r, g, b, a = '1'] = m[2].split(/[\s/]+/).filter(Boolean); found.push([r * 255, g * 255, b * 255, +a]) }
  }
  return found
}
const hex = (text) => { const h = text.slice(1); return [0, 2, 4].map(at => parseInt(h.slice(at, at + 2), 16)) }
const DATA_RGB = DATA_COLOURS.map(hex)
const isData = (value) => { const cs = colours(value); return cs.length > 0 && cs.every(([r, g, b, a]) => a === 0 || DATA_RGB.some(d => Math.abs(d[0] - r) <= 1 && Math.abs(d[1] - g) <= 1 && Math.abs(d[2] - b) <= 1)) }
const CUT_RGB = CUT_LITERALS.map(hex)
const isCutLiteral = (value) => { const cs = colours(value); return cs.length > 0 && cs.every(([r, g, b]) => CUT_RGB.some(d => Math.abs(d[0] - r) <= 1 && Math.abs(d[1] - g) <= 1 && Math.abs(d[2] - b) <= 1)) }
const invisible = (value) => { const cs = colours(value); return cs.length > 0 && cs.every(([, , , a]) => a === 0) }

async function setTheme(page, theme) {
  await page.evaluate(id => { if (id) document.body.dataset.oiTheme = id; else delete document.body.dataset.oiTheme }, theme)
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))
  await page.waitForTimeout(250)
}

/** The paints that no theme moved: present in every state, the same value in each. */
function stuck(readings) {
  const [none, ...themed] = readings
  const key = (p) => `${p.id}|${p.prop}`
  const maps = themed.map(r => new Map(r.map(p => [key(p), p.value])))
  return none.filter(p => !invisible(p.value) && !isData(p.value) && !(p.art && isCutLiteral(p.value)) && maps.every(m => m.get(key(p)) === p.value))
}

const {js, css} = await bundleEntry({contents: `import './src/main'`, resolveDir: ui, sourcefile: 'shell-theme-walk-entry.tsx', outfile: 'shell-theme-walk-entry.mjs'})
const host = await serveShellPage({html: shellHtml({js, css}), kernelBridge: BRIDGE})
const shell = await launchShell({width: 1600, height: 1000})
const report = {light: LIGHT, dark: DARK, bridge: BRIDGE, modes: {}, settings: null}
try {
  await shell.page.addInitScript(url => { window.__OI_KERNEL_BRIDGE__ = url }, BRIDGE)
  await shell.page.goto(host.url, {waitUntil: 'load'})
  await shell.page.waitForTimeout(3000)
  for (const [mode, title] of Object.entries(MODES)) {
    const rail = shell.page.locator(`button.mode-rail-button[aria-label="${title}"]`).first()
    assert.ok(await rail.count(), `the mode rail offers ${title}`)
    await rail.click()
    await shell.page.waitForTimeout(1800)
    const surfaces = {}
    for (const [surface, selector] of Object.entries(SURFACES)) {
      if (!await shell.page.locator(selector).count()) continue
      const readings = []
      for (const theme of STATES) {
        await setTheme(shell.page, theme)
        readings.push(await shell.page.evaluate(readPaints, {selector, cut: CUT}))
      }
      surfaces[surface] = {paints: readings[0].length, stuck: stuck(readings).map(({path, prop, value}) => ({path, prop, value}))}
    }
    for (const theme of STATES) {
      await setTheme(shell.page, theme)
      await shell.page.screenshot({path: join(OUT, `${mode}-${theme ?? 'default'}.png`)})
    }
    await setTheme(shell.page, null)
    report.modes[mode] = surfaces
  }
  await shell.page.keyboard.press('Meta+,')
  await shell.page.waitForTimeout(1200)
  if (await shell.page.locator(SETTINGS).count()) {
    const readings = []
    for (const theme of STATES) {
      await setTheme(shell.page, theme)
      readings.push(await shell.page.evaluate(readPaints, {selector: '.settings-window-layer', cut: CUT}))
      await shell.page.screenshot({path: join(OUT, `settings-${theme ?? 'default'}.png`)})
    }
    report.settings = {paints: readings[0].length, stuck: stuck(readings).map(({path, prop, value}) => ({path, prop, value}))}
  }
} finally {
  await shell.browser.close()
  await host.close()
}
// The atlas stage: the Earth mounted on the fixture corpus (provider/fixtureProvider.ts) in a pane of its own, as the shell's Earth
// pane mounts it, under each theme. What it draws — the globe in space and everything over it — is the picture, which stays under
// every theme (themeData.mjs REASONS.PICTURE); the atlas's chrome in the shell is its pane's status line (the walk above, Technē)
// and its controls, which the devices draw (the device kit, above).
{
  const contents = `
import './styles.css'
import './shell/theme'
import './projections/atlas/atlasHost.css'
import {mountAtlas, registerFixtureProvider, FIXTURE_PROVIDER_ID} from './projections/atlas/mount'
const host = document.createElement('div'); host.className = 'atlas-host'; host.style.cssText = 'width:900px;height:640px'
const globe = document.createElement('div'); globe.id = 'globe'; globe.className = 'atlas-host-globe'
const app = document.createElement('div'); app.id = 'app'; app.className = 'atlas-host-app'
host.append(globe, app); document.getElementById('root').append(host)
registerFixtureProvider(true)
mountAtlas({globe, app, provider: FIXTURE_PROVIDER_ID}).then(() => { window.__ready = true }, (error) => { window.__ready = String(error) })
`
  const {js: atlasJs, css: atlasCss} = await bundleEntry({contents, resolveDir: join(ui, 'src'), sourcefile: 'shell-theme-walk-atlas.tsx', outfile: 'shell-theme-walk-atlas.mjs'})
  const html = shellHtml({js: atlasJs, css: atlasCss})
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent((request.url ?? '/').split('?')[0])
    if (path === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); return }
    try { response.end(await readFileAsync(join(ui, 'public', path))) } catch { response.statusCode = 404; response.end() }
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  const stage = await launchShell({width: 900, height: 640})
  try {
    await stage.page.goto(`http://127.0.0.1:${server.address().port}/`)
    await stage.page.waitForFunction(() => window.__ready !== undefined, undefined, {timeout: 60000})
    const ready = await stage.page.evaluate(() => window.__ready)
    assert.equal(ready, true, `the atlas mounts on the fixture corpus (${ready})`)
    await stage.page.waitForTimeout(2500)
    const host = [], picture = []
    for (const theme of STATES) {
      await setTheme(stage.page, theme)
      host.push(await stage.page.evaluate(() => { const cs = getComputedStyle(document.querySelector('.atlas-host')); return {ground: cs.backgroundColor, ink: cs.color} }))
      picture.push(await stage.page.evaluate(readPaints, {selector: '.atlas-host-app', cut: CUT}))
      await stage.page.screenshot({path: join(OUT, `atlas-${theme ?? 'default'}.png`)})
    }
    const moved = picture[0].filter((p, i) => picture.slice(1).some((r) => r.find((q) => q.id === p.id && q.prop === p.prop)?.value !== p.value))
    report.atlas = {host, picturePaints: picture[0].length, pictureMoved: moved.length}
  } finally {
    await stage.browser.close()
    server.close()
  }
}

await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2))

const faults = []
for (const [mode, surfaces] of Object.entries(report.modes)) {
  for (const [surface, {paints, stuck: held}] of Object.entries(surfaces)) {
    console.log(`${mode.padEnd(12)} ${surface.padEnd(12)} ${String(paints).padStart(5)} paints, ${held.length} kept the default`)
    for (const p of held.slice(0, 6)) console.log(`    ${p.prop} ${p.value}  ${p.path}`)
    if (held.length) faults.push(`${mode} › ${surface}: ${held.length}`)
  }
}
if (report.settings) {
  console.log(`settings     ${String(report.settings.paints).padStart(5)} paints, ${report.settings.stuck.length} kept the default`)
  for (const p of report.settings.stuck.slice(0, 6)) console.log(`    ${p.prop} ${p.value}  ${p.path}`)
  if (report.settings.stuck.length) faults.push(`settings: ${report.settings.stuck.length}`)
}
if (report.atlas) {
  const [none, light, dark] = report.atlas.host
  console.log(`atlas stage  ground ${none.ground} → ${light.ground} / ${dark.ground}; ink ${none.ink} → ${light.ink} / ${dark.ink}; the picture: ${report.atlas.picturePaints} paints, ${report.atlas.pictureMoved} moved`)
  if (report.atlas.pictureMoved) faults.push(`atlas: ${report.atlas.pictureMoved} of the picture's paints moved with the theme (the picture is data)`)
}
const seen = new Set(Object.values(report.modes).flatMap(s => Object.keys(s)))
// Headless, with no kernel, the shell's Earth pane cannot mount (its data is the kernel's): the atlas is read on the stage instead.
for (const surface of Object.keys(SURFACES).filter(s => s !== 'atlas')) assert.ok(seen.has(surface), `the walk reached the ${surface} in some mode`)
assert.ok(report.atlas, 'the atlas stage mounted the Earth')
assert.ok(report.settings, 'Settings opened (⌘,)')
assert.deepEqual(faults, [], `paints no theme reaches (report: ${join(OUT, 'report.json')})`)
console.log(`themes reach every surface → ${OUT}`)
