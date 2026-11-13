/**
 * Reads the world-shell mockup's frame out of the mockup itself and writes it as tests/world-shell-oracle.json, the numbers
 * tests/world-shell-geometry.browser.mjs holds the running shell to (shell parity B9, 13 Nov).
 *
 * The mockup (desktop/cradle/docs/world-shell/world-shell-mockup.html) draws one 1920x1200 page and scales it to the window
 * (its fit()); at a 1920x1200 viewport the scale is 1, so each region's box is the mockup's own number. Each mode the mockup
 * draws (?mode=base|factory|expressions|techne) is read; the frame must be the same in all of them, or this script refuses.
 * The mockup's bytes are hashed into the oracle, so a changed mockup fails the geometry test until this script is run again.
 *
 * Channel: headless Chromium (playwright, cradle's copy), the mockup file itself. No hand-typed number.
 *
 *   node tests/support/build-world-shell-oracle.mjs
 */
import {createHash} from 'node:crypto'
import {readFile, writeFile} from 'node:fs/promises'
import {join, relative} from 'node:path'
import {launchShell, root, ui} from './agentShellHarness.mjs'

export const MOCKUP = join(root, 'desktop/cradle/docs/world-shell/world-shell-mockup.html')
export const ORACLE = join(ui, 'tests/world-shell-oracle.json')
const VIEWPORT = {width: 1920, height: 1200}
const MODES = ['base', 'factory', 'expressions', 'techne']
/** The mockup's region classes, by the names the geometry test uses for the shell's. */
const REGIONS = {transport: '.tp', browser: '.br', centre: '.ct', rail: '.dk', detail: '.dt', status: '.sb', title: '.tp .title'}

function read(regions) {
  const box = el => { const b = el.getBoundingClientRect(); return {x: b.x, y: b.y, width: b.width, height: b.height} }
  const out = {regions: {}, rules: {}}
  for (const [name, selector] of Object.entries(regions)) {
    const el = document.querySelector(selector)
    if (!el) throw new Error(`the mockup draws no ${selector}`)
    out.regions[name] = box(el)
  }
  // The detail row's content: .dt pads itself (0 4px 4px 0), and what stands in it stands inside that padding.
  const dt = getComputedStyle(document.querySelector('.dt')), d = out.regions.detail
  out.regions.detail = {x: d.x + parseFloat(dt.paddingLeft), y: d.y + parseFloat(dt.paddingTop),
    width: d.width - parseFloat(dt.paddingLeft) - parseFloat(dt.paddingRight), height: d.height - parseFloat(dt.paddingTop) - parseFloat(dt.paddingBottom)}
  const px = value => parseFloat(value)
  const tp = getComputedStyle(document.querySelector('.tp')), sb = getComputedStyle(document.querySelector('.sb'))
  const frame = getComputedStyle(document.querySelector('.frame'))
  out.rules = {transportRule: px(tp.borderBottomWidth), statusRule: px(sb.borderTopWidth), statusFontSize: px(sb.fontSize),
    framePadding: px(frame.paddingLeft)}
  out.frame = {columns: frame.gridTemplateColumns, rows: frame.gridTemplateRows}
  return out
}

function readOverlays() {
  const box = el => { const b = el.getBoundingClientRect(); return {x: b.x, y: b.y, width: b.width, height: b.height} }
  const px = value => parseFloat(value)
  window.dialog('Head', 'Body', 'Act', null)
  const dlg = document.querySelector('#scrim.on .dlg')
  if (!dlg) throw new Error('the mockup\'s dialog() drew no .scrim.on .dlg')
  const head = dlg.querySelector('.dh2'), body = dlg.querySelector('.dbody'), foot = dlg.querySelector('.df'), pri = foot.querySelector('.bt.pri')
  const bodyStyle = getComputedStyle(body)
  const dialog = {window: box(dlg), head: box(head), foot: box(foot), button: box(pri),
    headFontSize: px(getComputedStyle(head).fontSize), bodyFontSize: px(bodyStyle.fontSize), bodyPadding: [px(bodyStyle.paddingTop), px(bodyStyle.paddingRight)],
    buttonFontSize: px(getComputedStyle(pri).fontSize), buttons: [...foot.querySelectorAll('button')].map(b => b.textContent)}
  document.querySelector('#scrim').classList.remove('on')
  window.toast('<b>Landed</b> as claim')
  const t = document.querySelector('#toast'), ts = getComputedStyle(t)
  const toast = {box: box(t), fontSize: px(ts.fontSize), padding: [px(ts.paddingTop), px(ts.paddingLeft)], pointerEvents: ts.pointerEvents,
    transitionDuration: ts.transitionDuration}
  return {dialog, toast}
}

export async function buildOracle() {
  const bytes = await readFile(MOCKUP)
  const shell = await launchShell(VIEWPORT)
  const byMode = {}
  let overlays
  try {
    for (const mode of MODES) {
      await shell.page.goto(`file://${MOCKUP}?mode=${mode}`, {waitUntil: 'load'})
      await shell.page.waitForFunction(() => document.querySelector('.frame .tp .title'))
      byMode[mode] = await shell.page.evaluate(read, REGIONS)
    }
    // The confirm dialog and the toast, as the mockup's own dialog() and toast() draw them (:1942-1943).
    await shell.page.goto(`file://${MOCKUP}`, {waitUntil: 'load'})
    await shell.page.waitForFunction(() => typeof window.dialog === 'function' && typeof window.toast === 'function')
    overlays = await shell.page.evaluate(readOverlays)
  } finally { await shell.browser.close() }
  const [first, ...rest] = MODES
  for (const mode of rest) {
    if (JSON.stringify(byMode[mode]) !== JSON.stringify(byMode[first])) throw new Error(`the mockup's frame differs between ${first} and ${mode}: one oracle cannot hold both`)
  }
  return {
    source: relative(root, MOCKUP),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    built: 'node tests/support/build-world-shell-oracle.mjs',
    viewport: VIEWPORT,
    modes: MODES,
    ...byMode[first],
    ...overlays,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const oracle = await buildOracle()
  await writeFile(ORACLE, JSON.stringify(oracle, null, 2) + '\n')
  console.log(`wrote ${relative(ui, ORACLE)} from ${oracle.source} (${oracle.sha256.slice(0, 12)})`)
}
