// Load the shell headless, wait, reload, wait — marking each phase in a file so the kernel trace can be split by phase.
// Usage: node load.mjs URL MARKS_FILE FIRST_WAIT_S SECOND_WAIT_S
import {createRequire} from 'node:module'
import {appendFileSync, readdirSync} from 'node:fs'
const require = createRequire('/Users/admin/Documents/fluid-dynamic-typographic-point-cloud-engine/node_modules/')
const {chromium} = require('playwright')
const [url, marks, first = '45', second = '45'] = process.argv.slice(2)
const base = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1248`
const dir = readdirSync(base).find(name => name.startsWith('chrome-headless-shell'))
const mark = label => appendFileSync(marks, `${Date.now()} ${label}\n`)
const browser = await chromium.launch({executablePath: `${base}/${dir}/chrome-headless-shell`})
const page = await browser.newPage({viewport: {width: 1600, height: 1000}})
let errors = 0
page.on('pageerror', () => { errors++ })
mark('first-load')
await page.goto(url, {waitUntil: 'load', timeout: 600_000})
mark('first-loaded')
await page.waitForTimeout(Number(first) * 1000)
mark('reload')
await page.reload({waitUntil: 'load', timeout: 600_000})
mark('reloaded')
await page.waitForTimeout(Number(second) * 1000)
mark('end')
await page.screenshot({path: marks.replace(/\.txt$/, '.png')})
console.log(JSON.stringify({errors}))
await browser.close()
