// O-I #747 round 893 (manual §16.4: a device's expanded view stands "between Clip view and the chain"; frame/devices/DeviceFlip.tsx: "the
// panes above shrink to make room, nothing is covered"; in Live the Device and Clip views share the pane without overlapping). Walk 892
// (captures-21, 43c) asked for Clip view with a device's band expanded: the band stood 22 px down the detail row, over Clip view, and
// covered its tabs — the Launch tab's middle hit "Triggers on this Scene" in the band. With Clip view alone the band was placed as if
// Device view's head stood above it, and Clip view kept the whole row. Now the band takes its height from the pane in flow: Clip view
// takes the row less the band, and the band stands under it (detailSides.ts bandPlace; DetailHost.tsx sizes Clip view and publishes it).
// DLW build ruling 2026-11-07: a fault, guarded in Chromium.
// Channel: LAID OUT — the frame's own styles (styles.css, detail.css) in Chromium, the detail row laid out as DetailHost lays it (its room
// less the band, clipHeightIn, bandPlace) with Clip view's tabs at its foot; each case measured as the browser lays it out.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'

const LAID_OUT = `
import {bandPlace, clipHeightIn} from './src/frame/detail/detailSides'
import './src/styles.css'
import './src/frame/detail/detail.css'
;(window as any).__lay = async (sides: {clip: boolean; device: boolean}, band: boolean) => {
  const frame = document.createElement('div')
  frame.className = 'frame'
  frame.style.cssText = 'position:fixed;left:0;top:0;height:900px;width:1200px;--transport-h:60px;--browser-w:220px;--detail-h:320px'
  const flip = document.createElement('div')
  flip.className = 'device-flip-host'
  if (band) { const whole = document.createElement('div'); whole.className = 'device-flip'; whole.textContent = 'Triggers on this Scene'; flip.appendChild(whole) }
  const host = document.createElement('div')
  host.className = 'detail-host'
  const clip = document.createElement('section')
  clip.className = 'detail-side detail-side--clip'
  clip.innerHTML = '<div style="flex:1"></div><div role="tablist" style="display:flex;height:18px;flex:none"><button class="clv-tab" role="tab">Clip</button><button class="clv-tab" role="tab">Launch</button></div>'
  clip.style.display = 'flex'; clip.style.flexDirection = 'column'
  const device = document.createElement('section')
  device.className = 'detail-side detail-side--device'
  device.hidden = !sides.device
  device.innerHTML = '<header class="detail-head" data-detail-head="device"><b>Scene body &amp; Jump</b></header><div class="detail-body"><div style="height:191px">chain</div></div>'
  if (sides.clip) host.appendChild(clip)
  host.appendChild(device)
  frame.append(flip, host)
  document.body.appendChild(frame)
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  // As DetailHost lays the row out: the room the sides share is the row less the band.
  const box = Math.floor(host.getBoundingClientRect().height), bandH = parseFloat(getComputedStyle(host).getPropertyValue('--frame-band')) || 0
  const room = Math.max(0, box - bandH), both = sides.clip && sides.device, clipH = clipHeightIn(room, both)
  if (sides.clip && (both || bandH > 0)) { clip.style.height = clipH + 'px'; clip.style.flex = 'none' }
  for (const [name, value] of Object.entries(bandPlace(sides, clipH))) if (value === null) frame.style.removeProperty(name); else frame.style.setProperty(name, value)
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  const r = (el: Element) => { const b = el.getBoundingClientRect(); return {top: Math.round(b.top), bottom: Math.round(b.bottom)} }
  const tabs = [...clip.querySelectorAll('[role=tab]')].filter(() => sides.clip).map(tab => {
    const b = tab.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
    return {name: tab.textContent, ...r(tab), hit: hit === tab ? 'itself' : (hit?.closest('.device-flip-host') ? 'the band' : hit?.className || hit?.tagName || 'nothing')}
  })
  const head = device.querySelector('.detail-head')!
  const laid = {bandH, band: band ? r(flip) : null, clip: sides.clip ? r(clip) : null, head: sides.device ? r(head) : null, row: r(host), tabs}
  frame.remove()
  return laid
}
;(window as any).__ready = true
`

async function layoutBrowser(t, playwright) {
  try { return await playwright().chromium.launch() } catch (error) {
    const why = `no Chromium to lay the detail row out in: ${String(error?.message ?? error).split('\n')[0]}`
    if (process.env.CI) throw new Error(`${why} (CI installs it before this suite: desktop.yml)`)
    t.skip(why); return undefined
  }
}

test('the expanded device band never covers Clip view: Clip view alone, both views, and Device view alone', {timeout: 300_000}, async t => {
  const {bundleEntry, shellHtml, playwright} = await import('./support/agentShellHarness.mjs')
  const ui = fileURLToPath(new URL('..', import.meta.url))
  const {js, css} = await bundleEntry({contents: LAID_OUT, resolveDir: ui, sourcefile: 'band-clip-tabs.tsx', outfile: 'band-clip-tabs.mjs'})
  const browser = await layoutBrowser(t, playwright)
  if (!browser) return
  try {
    const tab = await browser.newPage({viewport: {width: 1300, height: 1000}})
    const errors = []
    tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
    await tab.setContent(shellHtml({js, css}), {waitUntil: 'load'})
    await tab.waitForFunction(() => window.__ready, null, {timeout: 60_000}).catch(error => { throw Error(`${error.message} ${errors.join(' | ')}`) })
    const lay = (sides, band) => tab.evaluate(([sides, band]) => window.__lay(sides, band), [sides, band])
    // Clip view alone, as the walk had it: the band stands under Clip view, and every tab is its own.
    const alone = await lay({clip: true, device: false}, true)
    console.log('Clip view alone:', JSON.stringify(alone))
    assert.equal(alone.bandH, 200)
    assert.ok(alone.band.top >= alone.clip.bottom, `the band (${alone.band.top}–${alone.band.bottom}) stands under Clip view (${alone.clip.top}–${alone.clip.bottom})`)
    assert.ok(alone.band.bottom <= alone.row.bottom, 'and within the detail row')
    assert.deepEqual(alone.tabs.map(row => [row.name, row.hit]), [['Clip', 'itself'], ['Launch', 'itself']], 'each tab answers its own press')
    // Both views: the band stands under Device view's head, which stands under Clip view.
    const both = await lay({clip: true, device: true}, true)
    console.log('both views:', JSON.stringify(both))
    assert.ok(both.head.top >= both.clip.bottom && both.band.top >= both.head.bottom, 'Clip view, then Device view\'s head, then the band')
    assert.deepEqual(both.tabs.map(row => row.hit), ['itself', 'itself'])
    // Device view alone: under its head, as before.
    const device = await lay({clip: false, device: true}, true)
    assert.equal(device.band.top, device.head.bottom)
    // With no band, Clip view alone keeps the whole row, as before.
    const none = await lay({clip: true, device: false}, false)
    assert.equal(none.clip.bottom, none.row.bottom)
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
})

test('CODE-READING: DetailHost sizes Clip view to the row less the band and publishes the band\'s place from bandPlace', async () => {
  const detail = await readFile(new URL('../src/frame/detail/DetailHost.tsx', import.meta.url), 'utf8')
  assert.match(detail, /height=\{both \|\| clipOnly && box\.band > 0 \? clipH : undefined\}/)
  assert.match(detail, /for \(const \[name, value\] of Object\.entries\(bandPlace\(shown, clipH\)\)\)/)
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(styles, /\.device-flip-host \{ grid-row:3; grid-column:1 \/ 3; align-self:start; margin-top:calc\(var\(--clip-stack-h, 0px\) \+ var\(--band-head-h, var\(--detail-head-h\)\)\);/)
})
