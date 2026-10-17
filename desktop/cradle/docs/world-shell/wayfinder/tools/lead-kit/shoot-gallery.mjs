// Render designed devices and clips from the device gallery (the `dlw-device-gallery` preview, port 5208) to PNG, for a builder to
// Read as its mockup: the manual's embeds are these same pages. Usage:
//   node shoot-gallery.mjs OUT_DIR <query> [<query>…]
// where a query is what follows `?` on the gallery: `device=central:day&view=all`, `clip=factory`, `device=live:torus&view=whole`.
// GALLERY overrides the origin (default http://127.0.0.1:5208/). One browser, closed at the end.
import {chromium} from '../../../../../node_modules/playwright/index.mjs'
import {mkdirSync} from 'node:fs'
const [out, ...queries] = process.argv.slice(2)
if (!out || queries.length === 0) { console.error('usage: node shoot-gallery.mjs OUT_DIR <query>…'); process.exit(2) }
mkdirSync(out, {recursive: true})
const origin = process.env.GALLERY ?? 'http://127.0.0.1:5208/'
const browser = await chromium.launch()
const page = await browser.newPage({viewport: {width: 1440, height: 900}})
for (const query of queries) {
  await page.goto(`${origin}?${query}`)
  await page.waitForTimeout(1500)
  const name = query.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  await page.screenshot({path: `${out}/gallery-${name}.png`, fullPage: true})
  console.log('shot', `${out}/gallery-${name}.png`)
}
await browser.close()
