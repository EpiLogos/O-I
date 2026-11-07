// O-I #747 round 892 (the PROPOSE of round 891, accepted): the Expressions pane's fault line no longer takes its height from the frame's slot.
// Walk 891 (captures-7) recorded a remade film of no frames: a fault line that cleared while the take recorded changed the field's height,
// and the frame stops a recording on any resize ("Recording stopped to preserve its established frame after a window resize"). The line
// now keeps its place at the slot's foot whether or not a fault stands in it, so a fault that comes or goes never moves the slot, and the
// XT12 review line can clear once its moment has passed: when the frame reports the take's review closed.
// LAID OUT — the pane body in Chromium, its slot measured with no fault, with one, and with none again. SCRIPTED — the pure answer that the
// review's moment has passed. CODE-READING — the panel holds the review's line and clears it with that answer.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {register} from 'node:module'
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/') || s === 'react-dom' || s.startsWith('react-dom/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

const Stage = await import('../src/components/expressions/studio/StudioStage.tsx')
const REVIEW = 'The take is open for review. Choose Save recording there: a download needs a click inside the application.'
const stageWith = review => ({recording: false, stage: {mode: '2d', grid: false, snap: false, guides: false, videoTake: true, ...(review === undefined ? {} : {review})}})

const LAID_OUT = `
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {createElement as h} from 'react'
import {ExpressionsPaneBody} from './src/projections/expressionsPane'
import {publishHostedChrome, publishHostedExpressions} from './src/projections/expressionsPaneHost'
import './src/styles.css'
;(window as any).__lay = async () => {
  const host = document.createElement('div')
  host.style.cssText = 'position:relative;width:640px;height:400px'
  document.body.appendChild(host)
  publishHostedExpressions({expression_ref: 'expression:dawn', title: 'Dawn field'})
  const root = createRoot(host)
  flushSync(() => root.render(h(ExpressionsPaneBody, {paneId: 'pane:laid-out'})))
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  const slot = () => (host.querySelector('[data-frame-slot]') as HTMLElement).getBoundingClientRect().height
  const line = () => host.querySelector('.expressions-pane-fault') as HTMLElement | null
  const read = async (faults: string[]) => {
    flushSync(() => publishHostedChrome({state: null, run: null, faults}))
    await frame()
    return {slot: slot(), line: line() ? {words: line()!.textContent, height: line()!.getBoundingClientRect().height} : null}
  }
  const none = await read([]), one = await read(['${REVIEW}']), two = await read(['A refusal.', '${REVIEW}']), again = await read([])
  root.unmount(); host.remove()
  return {none, one, two, again}
}
;(window as any).__ready = true
`

test('r892: a fault line that comes and goes never changes the height of the slot the frame is drawn over', {timeout: 180_000}, async t => {
  const {bundleEntry, shellHtml, playwright} = await import('./support/agentShellHarness.mjs')
  const ui = fileURLToPath(new URL('..', import.meta.url))
  const {js, css} = await bundleEntry({contents: LAID_OUT, resolveDir: ui, sourcefile: 'fault-line.tsx', outfile: 'fault-line.mjs'})
  let engines = 0
  for (const engine of ['chromium', 'webkit']) {
    let browser
    try { browser = await playwright()[engine].launch() } catch (error) { console.log(`no ${engine}: ${String(error?.message ?? error).split('\n')[0]}`); continue }
    engines += 1
    try {
      const tab = await browser.newPage({viewport: {width: 900, height: 700}})
      const errors = []
      tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
      await tab.setContent(shellHtml({js, css}), {waitUntil: 'load'})
      await tab.waitForFunction(() => window.__ready, null, {timeout: 60_000}).catch(error => { throw Error(`${error.message} ${errors.join(' | ')}`) })
      const laid = await tab.evaluate(() => window.__lay())
      console.log(engine, JSON.stringify(laid))
      assert.deepEqual(errors, [])
      assert.equal(laid.one.line?.words, REVIEW, `${engine}: a fault stands in the line`)
      assert.equal(laid.two.line?.words, `A refusal. · ${REVIEW}`, `${engine}: two stand in it together`)
      assert.ok(laid.none.line && laid.none.line.words === '', `${engine}: with no fault the line keeps its place, saying nothing`)
      assert.deepEqual([laid.one.slot, laid.two.slot, laid.again.slot], [laid.none.slot, laid.none.slot, laid.none.slot], `${engine}: the slot keeps its height as faults come and go`)
      assert.deepEqual([laid.one.line.height, laid.two.line.height, laid.again.line.height], [laid.none.line.height, laid.none.line.height, laid.none.line.height], `${engine}: the line keeps its height`)
    } finally { await browser.close() }
  }
  if (!engines) t.skip('no browser to lay the pane out in')
})

test('r892: the review\'s line has had its moment once the frame reports the review closed; never while it stands or is unread', () => {
  assert.equal(Stage.reviewPassed(REVIEW, stageWith(false)), true, 'the review closed: the line clears')
  assert.equal(Stage.reviewPassed(REVIEW, stageWith(true)), false, 'the review stands: the line stays')
  assert.equal(Stage.reviewPassed(REVIEW, stageWith(undefined)), false, 'a frame that does not say: the line stays')
  assert.equal(Stage.reviewPassed(REVIEW, null), false, 'no frame state: the line stays')
  assert.equal(Stage.reviewPassed(null, stageWith(false)), false, 'no review line held: nothing to clear')
})

test('r892: the panel holds the review\'s line and clears it when its moment has passed, and only that line', async () => {
  const panel = await readFile(new URL('../src/panels/expressions.tsx', import.meta.url), 'utf8')
  const act = panel.slice(panel.indexOf('const menuAct = (event: Event) => {'), panel.indexOf('window.addEventListener(MENU_ACT, menuAct)'))
  assert.match(act, /if \(reviewStandsInFrame\(command, result, host\.getState\(\)\)\) \{ reviewLine\.current = result\.error; showMainView\('pane'\) \}/)
  assert.match(panel, /useEffect\(\(\) => \{\s*const words = reviewLine\.current\s*if \(!reviewPassed\(words, stage\)\) return\s*reviewLine\.current = null\s*setFault\(current => current === words \? null : current\)\s*\}, \[stage\]\)/)
})
