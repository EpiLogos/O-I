// The lead's screen pass, headless: the REAL shell entry (src/main.tsx — the
// same module graph vite serves) bundled by the agent-shell harness, served
// with the live kernel bridge as its transport, rendered in headless Chromium
// at two viewports, one capture per mode (and per presentation where a mode
// has two). Channel: headless (playwright) — the pixels of the web frontend,
// not the native window; the native window is computer-use's.
//
//   node scripts/shell-screens.mjs [--out <dir>] [--modes live,base,...] [--wide 1600x1000] [--narrow 1180x760]
//
// Writes <out>/<viewport>-<mode>[-<presentation>].png plus errors.json (the
// page's console errors and uncaught exceptions per capture).

import {mkdir, writeFile} from 'node:fs/promises'
import {join, resolve} from 'node:path'

const {bundleEntry, serveShellPage, launchShell, shellHtml, ui} = await import('../tests/support/agentShellHarness.mjs')

const arg = (name, fallback) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback
const OUT = resolve(arg('--out', join(ui, '.shell-screens')))
const BRIDGE = process.env.OI_KERNEL_BRIDGE ?? 'http://127.0.0.1:4179'
const MODES = arg('--modes', 'live,base,factory,expressions,techne').split(',')
const size = text => { const [width, height] = text.split('x').map(Number); return {width, height} }
const VIEWPORTS = {wide: size(arg('--wide', '1600x1000')), narrow: size(arg('--narrow', '1180x760'))}
// The surf's mode names as the rail titles them (modeGrammar titles).
const RAIL_TITLE = {live: 'Live', base: 'Central', factory: 'Factory', expressions: 'Expressions', techne: 'Technē'}

await mkdir(OUT, {recursive: true})
const {js, css} = await bundleEntry({contents: `import './src/main'`, resolveDir: ui, sourcefile: 'shell-screens-entry.tsx', outfile: 'shell-screens-entry.mjs'})
const host = await serveShellPage({html: shellHtml({js, css}), kernelBridge: BRIDGE})
const report = {bridge: BRIDGE, captures: []}

try {
  for (const [label, viewport] of Object.entries(VIEWPORTS)) {
    const shell = await launchShell(viewport)
    try {
      await shell.page.goto(host.url, {waitUntil: 'load'})
      await shell.page.waitForTimeout(2500)
      for (const mode of MODES) {
        const rail = shell.page.locator(`[aria-label="${RAIL_TITLE[mode]}"], button[title^="${RAIL_TITLE[mode]}"]`).first()
        if (await rail.count()) { await rail.click().catch(() => {}); await shell.page.waitForTimeout(1200) }
        for (const presentation of ['session', 'arrangement']) {
          const tab = shell.page.locator(`button[title^="${presentation === 'session' ? 'Session' : 'Arrangement'}"]`).first()
          if (await tab.count()) { await tab.click().catch(() => {}); await shell.page.waitForTimeout(700) }
          const file = join(OUT, `${label}-${mode}-${presentation}.png`)
          await shell.page.screenshot({path: file})
          report.captures.push({viewport: label, mode, presentation, file, railFound: (await rail.count()) > 0,
            errors: [...shell.browserErrors], pageErrors: [...shell.pageErrors]})
          shell.browserErrors.length = 0; shell.pageErrors.length = 0
        }
      }
    } finally {
      await shell.browser.close()
    }
  }
} finally {
  await host.close()
}
await writeFile(join(OUT, 'errors.json'), JSON.stringify(report, null, 2))
console.log(`${report.captures.length} captures → ${OUT}`)
for (const capture of report.captures) {
  const errs = capture.errors.length + capture.pageErrors.length
  console.log(`${capture.viewport} ${capture.mode} ${capture.presentation}${capture.railFound ? '' : ' (rail item not found)'}${errs ? ` — ${errs} error(s)` : ''}`)
}
