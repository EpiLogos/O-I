#!/usr/bin/env node
// Render the DLW mockup (the craft floor) headless at the owner's working size, one PNG per mode, so a builder or the lead
// can Read it beside the candidate. Uses desktop/cradle's own Playwright.
//
//   node desktop/cradle/docs/world-shell/wayfinder/tools/shoot-mockup.mjs <out-dir> base factory expressions techne
//   (extra query params: MOCK_QUERY='doc=day&layout=quad')
import {fileURLToPath, pathToFileURL} from 'node:url'
import {dirname, join, resolve} from 'node:path'
import {mkdirSync} from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const worldShell = resolve(here, '../..')
const cradle = resolve(worldShell, '../..')
const {chromium} = await import(pathToFileURL(join(cradle, 'node_modules/playwright/index.mjs')).href)
const [out, ...modes] = process.argv.slice(2)
if (!out || !modes.length) { console.error('usage: shoot-mockup.mjs <out-dir> <mode…>  (modes: base factory expressions techne)'); process.exit(2) }
mkdirSync(out, {recursive: true})
const file = pathToFileURL(join(worldShell, 'world-shell-mockup.html')).href
const extra = process.env.MOCK_QUERY ? `&${process.env.MOCK_QUERY}` : ''
const browser = await chromium.launch()
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}})
  for (const mode of modes) {
    await page.goto(`${file}?mode=${mode}${extra}`)
    await page.waitForTimeout(1200)
    const path = join(out, `mockup-${mode}.png`)
    await page.screenshot({path})
    console.log(path)
  }
} finally { await browser.close() }
