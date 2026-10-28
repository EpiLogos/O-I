// Headless Chromium (visible document, not the app's pane) over the harness; prints the harness's result.
import { createRequire } from 'node:module'
const require = createRequire('<playwright-host>/package.json')
const { chromium } = require('playwright')
const [url, timeoutS = '900', mode = 'gpu'] = process.argv.slice(2)
const args = mode === 'gpu' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const browser = await chromium.launch({ headless: true, args })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
const logs = []
page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)) })
page.on('pageerror', e => logs.push(String(e).slice(0, 300)))
await page.goto(url)
const hidden = await page.evaluate(() => document.hidden)
await page.waitForFunction(() => window.__result, null, { timeout: Number(timeoutS) * 1000, polling: 1000 }).catch(() => {})
const result = await page.evaluate(() => window.__result ?? window.__partial ?? null)
console.log(JSON.stringify({ hidden, result, errors: logs.slice(0, 8) }))
await browser.close()
