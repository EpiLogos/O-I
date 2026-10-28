// The Knowledge graph's canvas under wheel pans and pointer moves: every animation-frame callback timed (the canvas draws
// in one), and each pointer move's handler timed as it is dispatched.
import { createRequire } from 'node:module'
const require = createRequire('<playwright-host>/package.json')
const { chromium } = require('playwright')
const [url] = process.argv.slice(2)
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
await page.addInitScript(() => {
  const orig = window.requestAnimationFrame.bind(window); window.__raf = []
  window.requestAnimationFrame = cb => orig(t => { const a = performance.now(); try { cb(t) } finally { if (window.__rec) window.__raf.push(performance.now() - a) } })
})
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 300)))
await page.goto(url)
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 600000, polling: 500 })
const meta = await page.evaluate(() => window.__meta ?? window.__error)
await page.waitForTimeout(1500)
const canvas = page.locator('#root canvas').first(); const box = await canvas.boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.evaluate(() => { window.__raf = []; window.__rec = true })
for (let i = 0; i < 60; i++) { await page.mouse.wheel(i % 2 ? -30 : 30, 20); await page.waitForTimeout(20) }
await page.waitForTimeout(600)
const pan = await page.evaluate(() => { window.__rec = false; return window.__raf.slice() })
const hover = await page.evaluate(() => {
  const c = document.querySelector('#root canvas'); const r = c.getBoundingClientRect(); const out = []
  for (let i = 0; i < 80; i++) { const ev = new PointerEvent('pointermove', { clientX: r.left + 100 + (i * 13) % 1000, clientY: r.top + 100 + (i * 29) % 600, bubbles: true, pointerType: 'mouse' }); const a = performance.now(); c.dispatchEvent(ev); out.push(performance.now() - a) }
  return out
})
const st = a => { const s = [...a].sort((x, y) => x - y); return { n: s.length, median: +(s[s.length >> 1] ?? 0).toFixed(2), p95: +(s[Math.floor(s.length * .95)] ?? 0).toFixed(2), max: +(s.at(-1) ?? 0).toFixed(2) } }
console.log(JSON.stringify({ meta, pan_frame_callback_ms: st(pan), pointermove_handler_ms: st(hover), errors: errors.slice(0, 3) }))
await browser.close()
