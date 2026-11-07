// O-I #747 round 893 (the OPEN list, walk 892): a drag in the Arrangement that missed its clip selected the page's text — the lane
// names, the ruler's marks and the receipt went blue across the lanes. The lanes are not text to select: a press and drag there moves,
// draws or selects time (manual §16.6), never page text. A field in them (a name being typed) still selects its own text.
// Channel: LAID OUT — the lanes' own stylesheet (frame/tracks/tracks.css) in Chromium, a drag by the mouse across lanes as the
// Arrangement and the Session lay them out, and the page's selection read after it.
import test from 'node:test'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'

const LAID_OUT = `
import './src/styles.css'
import './src/frame/tracks/tracks.css'
;(window as any).__lay = (root: 'tl' | 'sg') => {
  document.body.innerHTML = ''
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:400px;display:flex'
  const view = document.createElement('div')
  view.className = root
  view.innerHTML = root === 'tl'
    ? '<div class="tl-ruler"><div>Arrangement</div><div class="tl-marks"><span>1</span><span style="left:200px">2</span></div></div>'
      + '<div class="tl-lane"><div class="tl-head">Dawn field</div><div class="tl-body" style="height:40px">Dawn · Noon · Dusk</div></div>'
      + '<div class="tl-lane"><div class="tl-head">Second track</div><div class="tl-body" style="height:40px">Wave</div></div>'
      + '<p class="sg-receipt tl-receipt"><b>Trim Dawn</b><span>The Expression changed.</span></p>'
      + '<input id="name" value="Dawn field">'
    : '<div class="sg-col"><div>Dawn field</div><div>Dawn</div><div>Noon</div><div>Dusk</div><input id="name" value="Dawn field"></div>'
  host.appendChild(view)
  document.body.appendChild(host)
  getSelection()?.removeAllRanges()
  return true
}
;(window as any).__ready = true
`

async function layoutBrowser(t, playwright) {
  try { return await playwright().chromium.launch({args: ['--mute-audio']}) } catch (error) {
    const why = `no Chromium to lay the lanes out in: ${String(error?.message ?? error).split('\n')[0]}`
    if (process.env.CI) throw new Error(`${why} (CI installs it before this suite: desktop.yml)`)
    t.skip(why); return undefined
  }
}

test('a drag across the lanes that misses a clip selects no page text; a field in them still selects its own', {timeout: 300_000}, async t => {
  const {bundleEntry, shellHtml, playwright} = await import('./support/agentShellHarness.mjs')
  const ui = fileURLToPath(new URL('..', import.meta.url))
  const {js, css} = await bundleEntry({contents: LAID_OUT, resolveDir: ui, sourcefile: 'tracks-drag-select.tsx', outfile: 'tracks-drag-select.mjs'})
  const browser = await layoutBrowser(t, playwright)
  if (!browser) return
  try {
    const tab = await browser.newPage({viewport: {width: 1000, height: 500}})
    const errors = []
    tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
    await tab.setContent(shellHtml({js, css}), {waitUntil: 'load'})
    await tab.waitForFunction(() => window.__ready, null, {timeout: 60_000}).catch(error => { throw Error(`${error.message} ${errors.join(' | ')}`) })
    for (const root of ['tl', 'sg']) {
      await tab.evaluate(root => window.__lay(root), root)
      await tab.mouse.move(5, 8); await tab.mouse.down(); await tab.mouse.move(400, 120, {steps: 12}); await tab.mouse.move(880, 300, {steps: 12}); await tab.mouse.up()
      const selected = await tab.evaluate(() => getSelection()?.toString() ?? '')
      console.log(`${root}: a missed drag selected ${JSON.stringify(selected)}`)
      assert.equal(selected, '', `${root}: a drag across the lanes selects no page text`)
      const field = await tab.evaluate(() => { const input = document.getElementById('name'); input.focus(); input.select(); return input.selectionEnd - input.selectionStart })
      assert.equal(field, 'Dawn field'.length, `${root}: a field in the lanes still selects its own text`)
    }
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
})
