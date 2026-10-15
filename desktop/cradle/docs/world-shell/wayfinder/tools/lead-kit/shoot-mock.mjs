// Render the mockup's modes to PNG for a builder to Read (the craft floor). Usage: node shoot-mock.mjs OUT_DIR mode [mode…]
// Modes: base, factory, expressions, techne, live (world-shell-mockup.html?mode=…).
import {chromium} from '../../../../../node_modules/playwright/index.mjs'
import {mkdirSync} from 'node:fs'
const [out, ...modes] = process.argv.slice(2)
mkdirSync(out, {recursive: true})
const file = new URL('../../../world-shell-mockup.html', import.meta.url).href
const browser = await chromium.launch()
const page = await browser.newPage({viewport: {width: 1440, height: 900}})
for (const mode of modes) {
  await page.goto(`${file}?mode=${mode}`)
  await page.waitForTimeout(1200)
  await page.screenshot({path: `${out}/mockup-${mode}.png`})
  console.log('shot', mode)
}
await browser.close()
