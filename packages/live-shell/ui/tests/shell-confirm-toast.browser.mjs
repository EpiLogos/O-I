/**
 * The confirm dialog and the toast are the world-shell mockup's (shell parity B8, 13 Nov; audit G10).
 *
 * The numbers are the mockup's own: tests/world-shell-oracle.json holds what the mockup's dialog() and toast() draw at its 1920x1200
 * page (tests/support/build-world-shell-oracle.mjs reads them). The stage is the shell's own hosts (shell/ConfirmDialog.tsx,
 * shell/ShellToast.tsx) over styles.css, bundled as the shell bundles them, asked through the doors the shell's parts use:
 * `askConfirm` and `showToast`. Each must stand where the mockup's stands and measure what it measures within 1px — the window's
 * width and its centre, the 28px head, the 37px foot, the 20px buttons, Cancel then the act's word, the fonts — and answer as the
 * mockup's does: the act's word resolves true, Cancel, Escape and a press on the scrim false; a second ask waits for the first.
 * The toast stands 110px down, centred, takes no press, and fades after its time.
 *
 * Channel: headless Chromium (playwright, cradle's copy). A missing browser throws; nothing here skips.
 *
 *   node tests/shell-confirm-toast.browser.mjs
 */
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {bundleEntry, serveShellPage, launchShell, shellHtml, ui, CUT_BRIDGE} from './support/agentShellHarness.mjs'

const oracle = JSON.parse(await readFile(join(ui, 'tests/world-shell-oracle.json'), 'utf8'))
const contents = `
import {createRoot} from 'react-dom/client'
import './src/styles.css'
import {ConfirmDialogHost, askConfirm} from './src/shell/ConfirmDialog'
import {ShellToastHost, showToast, TOAST_MS} from './src/shell/ShellToast'
createRoot(document.getElementById('root')!).render(<><ConfirmDialogHost /><ShellToastHost /></>)
const w = window as any
w.__answers = []
w.__ask = (title: string) => askConfirm({title, body: <>Resetting reseeds <b>every particle</b>.</>, ok: 'Act'}).then(yes => { w.__answers.push([title, yes]) })
w.__toast = () => showToast(<><b>Landed</b> as claim</>)
w.__toastMs = TOAST_MS
w.__ready = true
`
const TOLERANCE = 1
const faults = []
const near = (label, got, want) => { if (!(Math.abs(got - want) <= TOLERANCE)) faults.push(`${label}: ${Math.round(got * 10) / 10}, the mockup's ${Math.round(want * 10) / 10}`) }

const {js, css} = await bundleEntry({contents, resolveDir: ui, sourcefile: 'shell-confirm-toast-entry.tsx', outfile: 'shell-confirm-toast-entry.mjs'})
const host = await serveShellPage({html: shellHtml({js, css}), kernelBridge: CUT_BRIDGE})
const shell = await launchShell(oracle.viewport)
const {page} = shell
try {
  await page.goto(host.url, {waitUntil: 'load'})
  await page.waitForFunction(() => window.__ready === true, undefined, {timeout: 20000})

  // The dialog, as the mockup draws it.
  await page.evaluate(() => { window.__ask('first'); window.__ask('second') })
  await page.waitForSelector('.shell-scrim .shell-dlg')
  const got = await page.evaluate(() => {
    const box = el => { const b = el.getBoundingClientRect(); return {x: b.x, y: b.y, width: b.width, height: b.height} }
    const dlg = document.querySelector('.shell-dlg'), head = dlg.querySelector('.shell-dlg-head'), body = dlg.querySelector('.shell-dlg-body')
    const foot = dlg.querySelector('.shell-dlg-foot'), pri = foot.querySelector('.shell-bt-pri'), bs = getComputedStyle(body)
    return {window: box(dlg), head: box(head), foot: box(foot), button: box(pri), headFontSize: parseFloat(getComputedStyle(head).fontSize),
      bodyFontSize: parseFloat(bs.fontSize), bodyPadding: [parseFloat(bs.paddingTop), parseFloat(bs.paddingRight)],
      buttonFontSize: parseFloat(getComputedStyle(pri).fontSize), buttons: [...foot.querySelectorAll('button')].map(b => b.textContent),
      title: head.textContent, focused: document.activeElement?.textContent}
  })
  const want = oracle.dialog
  near('dialog width', got.window.width, want.window.width)
  near('dialog centre x', got.window.x + got.window.width / 2, want.window.x + want.window.width / 2)
  near('dialog head height', got.head.height, want.head.height)
  near('dialog foot height', got.foot.height, want.foot.height)
  near('dialog button height', got.button.height, want.button.height)
  for (const key of ['headFontSize', 'bodyFontSize', 'buttonFontSize']) near(`dialog ${key}`, got[key], want[key])
  near('dialog body padding top', got.bodyPadding[0], want.bodyPadding[0]); near('dialog body padding side', got.bodyPadding[1], want.bodyPadding[1])
  assert.deepEqual(got.buttons, ['Cancel', 'Act'], 'Cancel, then the act\'s own word, as the mockup orders them')
  assert.equal(got.title, 'first', 'the first ask stands first')
  assert.equal(got.focused, 'Cancel', 'the focus starts on Cancel')

  // Answers: the act's word, then (the second ask comes up) Escape.
  await page.click('.shell-bt-pri')
  await page.waitForFunction(() => document.querySelector('.shell-dlg-head')?.textContent === 'second')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__answers.length === 2)
  assert.equal(await page.locator('.shell-scrim').count(), 0, 'answered, the dialog leaves')
  await page.evaluate(() => { window.__ask('third') })
  await page.waitForSelector('.shell-scrim')
  await page.mouse.click(20, 20)
  await page.waitForFunction(() => window.__answers.length === 3)
  assert.deepEqual(await page.evaluate(() => window.__answers), [['first', true], ['second', false], ['third', false]], 'the act resolves true; Escape and the scrim false')

  // The toast, as the mockup draws it.
  await page.evaluate(() => window.__toast())
  await page.waitForSelector('.shell-toast.on')
  await page.waitForTimeout(400)
  const toast = await page.evaluate(() => {
    const t = document.querySelector('.shell-toast'), b = t.getBoundingClientRect(), ts = getComputedStyle(t)
    return {y: b.y, centre: b.x + b.width / 2, height: b.height, fontSize: parseFloat(ts.fontSize), padding: [parseFloat(ts.paddingTop), parseFloat(ts.paddingLeft)],
      pointerEvents: ts.pointerEvents, transitionDuration: ts.transitionDuration, opacity: parseFloat(ts.opacity), bold: t.querySelector('b')?.textContent}
  })
  const tw = oracle.toast
  near('toast top', toast.y, tw.box.y)
  near('toast centre x', toast.centre, tw.box.x + tw.box.width / 2)
  near('toast height', toast.height, tw.box.height)
  near('toast font', toast.fontSize, tw.fontSize)
  near('toast padding top', toast.padding[0], tw.padding[0]); near('toast padding side', toast.padding[1], tw.padding[1])
  assert.equal(toast.pointerEvents, tw.pointerEvents, 'the toast takes no press')
  assert.equal(toast.transitionDuration, tw.transitionDuration, 'it fades as the mockup\'s does')
  assert.equal(toast.opacity, 1, 'it stands while shown')
  assert.equal(toast.bold, 'Landed')
  const ms = await page.evaluate(() => window.__toastMs)
  await page.waitForTimeout(ms + 400)
  assert.equal(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.shell-toast')).opacity)), 0, 'and is gone after its time')
  assert.deepEqual(shell.pageErrors, [], 'no page errors')
} finally {
  await shell.browser.close()
  await host.close()
}
if (faults.length) {
  console.error(`confirm dialog / toast: ${faults.length} drift(s) from ${oracle.source}\n  ${faults.join('\n  ')}`)
  process.exit(1)
}
console.log('confirm dialog and toast: the mockup\'s, and they answer as it does')
