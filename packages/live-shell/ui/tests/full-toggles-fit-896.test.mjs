// O-I #747 round 896, item 0.4 (DLW build ruling 2026-11-09): "'Symbol voices' and 'Collisions strike' are clipped in the Full. Red first:
// a Chromium layout guard, with no clipped label at the Full's narrowest width." Walk 896b/896d (r896/walk/captures-896d/11-resonance.png)
// read "ymbol voice" and "llisions stri" in the Field's Sound section of the Studio's Full.
// Why: a section's width grows to the names its controls carry over (or under) them (panel.tsx sectionWidth, .dp-label), but a toggle's name
// is on its own button, and the kit never measured it; the Sound section stood one column wide (cols={1}), narrower than "Symbol voices" on
// its button, and the section's overflow cut the button on both sides. Now the kit measures a button's name with the button's own room
// (panel.css .dp-toggle: 6 px padding and a 1 px border either side), so no pressable name is cut wherever a design gives its section a
// measure.
// Channel: LAID OUT, in Chromium with the kit's and the shell's stylesheets — the Studio's own Full (expressions__studio.tsx `full`, the
// suite) as DeviceView draws a rack's Full (each member a RackMember: its Whole, in the pane's frame), the Field drawn by its own design,
// in a pane as narrow as a pane stands: beside the field in the least window (tauri.conf.json minWidth 360, half of it), the least window
// alone, and a wide one. Every name in the Field's sections, on a button or over a control, stands whole inside its section.
import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdirSync, writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const STAGE = `
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {createElement as h} from 'react'
import './src/styles.css'
import './src/frame/devices/devices.css'
import './src/inhabitants/catalogue/panels/panels.css'
import {PlaceContext} from './src/inhabitants/sdk/panel'
import {design as studio} from './src/inhabitants/catalogue/panels/expressions__studio'
import {design as field} from './src/inhabitants/catalogue/panels/expressions__field'
const nav = {select() {}, expand() {}, full() {}, popout() {}, fold() {}, unfold() {}, rail() {}, close() {}}, place = {onExpand() {}, onPopout() {}, onRail() {}}
const designs: any = {[field.id]: field}
/** A rack's member as DeviceView's RackMember draws it: its Whole, in the pane's frame. */
const member = (id: string) => designs[id] ? h('div', {className: 'device-rack-member', 'data-rack-member': id},
  h('div', {className: 'device-place device-place--whole', 'data-device-frame': 'pane'}, h('div', {className: 'device device--whole'},
    designs[id].whole({v: designs[id].defaults, set() {}, nav, page: '', setPage() {}, standing: {}, owner: designs[id].defaults, frame: 'pane'})))) : null
;(window as any).__lay = async (width: number) => {
  const pane = document.createElement('div')
  pane.style.cssText = 'position:relative;width:' + width + 'px;height:700px'
  pane.className = 'device-place device-place--full'
  document.body.appendChild(pane)
  const root = createRoot(pane)
  flushSync(() => root.render(h(PlaceContext.Provider, {value: place}, h('div', {className: 'device device--full', style: {position: 'absolute', inset: 0}},
    studio.full({v: studio.defaults, set() {}, nav, page: '', setPage() {}, standing: {}, owner: studio.defaults, frame: 'pane', room: {w: width, h: 700}, member})))))
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  const cut: string[] = []
  const drawn = pane.querySelector('[data-rack-member="expressions:field"]')
  if (!drawn) cut.push('the Field is not drawn in the Full')
  const names: string[] = []
  for (const sec of drawn ? [...drawn.querySelectorAll<HTMLElement>('.dp-sec')] : []) {
    const s = sec.getBoundingClientRect(), label = sec.querySelector('.dp-sec-label')?.textContent ?? 'a section'
    for (const x of sec.querySelectorAll<HTMLElement>('.dp-toggle, .dp-radio button, .dp-action, .dp-cell > .dp-label')) {
      if (x.closest('.dp-sec') !== sec || !x.getClientRects().length) continue
      const r = x.getBoundingClientRect(), name = (x.textContent ?? '').trim()
      names.push(name)
      if (r.left < s.left - .5 || r.right > s.right + .5) cut.push(label + ': "' + name + '" runs ' + Math.round(Math.max(s.left - r.left, r.right - s.right)) + ' px past its section (' + Math.round(s.width) + ' px)')
      if (x.scrollWidth > x.clientWidth + .5) cut.push(label + ': "' + name + '" is cut (' + x.clientWidth + ' of ' + x.scrollWidth + ' px)')
    }
  }
  const rect = drawn?.getBoundingClientRect()
  root.unmount(); pane.remove()
  return {cut, names, rect: rect ? {x: rect.x, y: rect.y, w: rect.width, h: rect.height} : null}
}
;(window as any).__show = (width: number) => {
  const pane = document.createElement('div')
  pane.style.cssText = 'position:relative;width:' + width + 'px;height:700px'
  pane.className = 'device-place device-place--full'
  pane.id = 'shown'
  document.body.appendChild(pane)
  flushSync(() => createRoot(pane).render(h(PlaceContext.Provider, {value: place}, h('div', {className: 'device device--full', style: {position: 'absolute', inset: 0}},
    studio.full({v: studio.defaults, set() {}, nav, page: '', setPage() {}, standing: {}, owner: studio.defaults, frame: 'pane', room: {w: width, h: 700}, member})))))
}
;(window as any).__ready = true
`
const FACES = `:root{--bg-0:#26292d;--bg-1:#33363b;--bg-2:#3f4348;--bg-3:#4a4e54;--line:#24262a;--line-strong:#3d4147;--text:#d4d7da;--text-dim:#a2a7ad;--text-faint:#71767c;--accent:#ffbe00;--green:#8fd0a8;--rec:#e0523f}
*{box-sizing:border-box}html,body{margin:0;background:#1b1d20;color:var(--text);font:12px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}`

async function layoutBrowser(t, playwright) {
  try { return await playwright().chromium.launch() } catch (error) {
    const why = `no Chromium to lay the Full out in: ${String(error?.message ?? error).split('\n')[0]}`
    if (process.env.CI) throw new Error(`${why} (CI installs it before this suite: desktop.yml)`)
    t.skip(why); return undefined
  }
}

test('the Field\'s Sound toggles draw whole in the Studio\'s Full, at its narrowest: no name on a button or over a control is cut', {timeout: 300_000}, async t => {
  const {bundleEntry, shellHtml, playwright} = await import('./support/agentShellHarness.mjs')
  const ui = fileURLToPath(new URL('..', import.meta.url))
  const {js, css} = await bundleEntry({contents: STAGE, resolveDir: ui, sourcefile: 'full-toggles-fit.tsx', outfile: 'full-toggles-fit.mjs'})
  const browser = await layoutBrowser(t, playwright)
  if (!browser) return
  try {
    const tab = await browser.newPage({viewport: {width: 1300, height: 760}})
    const errors = []
    tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
    await tab.setContent(shellHtml({js, css: `${FACES}\n${css}`}), {waitUntil: 'load'})
    await tab.waitForFunction(() => window.__ready, null, {timeout: 60_000}).catch(error => { throw Error(`${error.message} ${errors.join(' | ')}`) })
    for (const width of [180, 360, 1200]) {
      const laid = await tab.evaluate(w => window.__lay(w), width)
      assert.ok(laid.names.includes('Symbol voices') && laid.names.includes('Collisions strike'), `${width} px: the guard reads the Sound section's toggles (${laid.names.join(', ')})`)
      assert.deepEqual(laid.cut, [], `${width} px: a name cut in the Field, in the Studio's Full`)
    }
    assert.deepEqual(errors, [])
    // The capture, to look at as the owner would: the Field in the Full, beside the field in the least window.
    const out = process.env.FULL_TOGGLES_CAPTURE
    if (out) {
      mkdirSync(out, {recursive: true})
      await tab.evaluate(w => window.__show(w), 1200)
      await tab.waitForTimeout(200)
      const field = tab.locator('#shown [data-rack-member="expressions:field"]')
      writeFileSync(`${out}/field-in-the-full.png`, await field.screenshot())
    }
  } finally { await browser.close() }
})
