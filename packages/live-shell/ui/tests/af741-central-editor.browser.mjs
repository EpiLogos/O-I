/**
 * Lane AF (O-I #741) — Central's editor side after VS Code's workbench, walked headless on a scratch world: the real App, bundled as
 * the shell bundles it (support/agentShellHarness.mjs), over a walk-bridge whose Central root and home are scratch folders, in
 * Chromium and in WebKit (the native candidate is WebKit). The native window is not walked here (UNVERIFIED, #821).
 *
 *   A. §10.2 — double-clicking a pane's tab fills the main area with its pane; again, the other panes come back.
 *   B. §18.1/§17.8 — a Flow with a draft marks its pane's tab; the owner's Save clears it (a real write on the scratch ground).
 *   C. §18.4 — ⌘F in a pane finds in the page in front, as VS Code's ⌘F finds in the file in front: typed inside the page or in the
 *      window; "{n} of {m}", Enter / ⇧Enter wrapping, ⌘G, the marks in the page, Escape closing and handing the page its focus back;
 *      ⌘F with the focus in the browser stays the browser's.
 *   D. §10.2 — a press inside a page focuses its pane.
 *
 * Run: OI_WALK_BRIDGE=<path to walk-bridge> node tests/af741-central-editor.browser.mjs [--evidence <dir>] [--engines chromium,webkit]
 * Nothing is written outside the scratch folders it makes (the Central root, OI_HOME and HOME of every owner it starts).
 */
import assert from 'node:assert/strict'
import {execFileSync, spawn} from 'node:child_process'
import {mkdirSync, mkdtempSync, writeFileSync, realpathSync} from 'node:fs'
import {register} from 'node:module'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {bundleEntry, playwright, postOp, serveShellPage, shellHtml, ui} from './support/agentShellHarness.mjs'

const args = process.argv.slice(2)
const argOf = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const scratch = realpathSync(mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'oi-af741-walk-')))
const evidence = argOf('--evidence', join(scratch, 'evidence'))
const engines = argOf('--engines', 'chromium,webkit').split(',')
mkdirSync(evidence, {recursive: true})
const bridgeBin = process.env.OI_WALK_BRIDGE
if (!bridgeBin) throw new Error('OI_WALK_BRIDGE: the walk-bridge binary to run on the scratch world')

// ---- the scratch world: a Central root made by Central itself, and homes nobody else uses
const ground = join(scratch, 'ground'), home = join(scratch, 'home')
mkdirSync(home, {recursive: true})
const isolated = {...process.env, HOME: home, OI_HOME: join(home, 'oi'), OI_CENTRAL_ROOT: ground, AIKIT_HOME: join(home, '.aikit')}
execFileSync(process.env.OI_CENTRAL_CTRL_BIN ?? 'ctrl', ['--root', ground, '--json', 'action', 'run', 'central.init'], {encoding: 'utf8', env: isolated})
mkdirSync(join(ground, 'Control/user/flows'), {recursive: true})
const port = 4300 + Math.floor(Math.random() * 400)
const bridgeUrl = `http://127.0.0.1:${port}`
const bridge = spawn(bridgeBin, [`127.0.0.1:${port}`], {env: isolated, detached: true, stdio: ['ignore', 'ignore', 'pipe']})
let bridgeLog = ''
bridge.stderr.on('data', chunk => { if (bridgeLog.length < 20000) bridgeLog += chunk })
const stopBridge = () => { try { process.kill(-bridge.pid, 'SIGTERM') } catch {} }
process.once('exit', stopBridge)
for (let i = 0; i < 240; i++) { try { if ((await fetch(`${bridgeUrl}/state`)).ok) break } catch {} await new Promise(done => setTimeout(done, 250)) }

// ---- one Flow on the scratch ground, minted by the Flow's own form and written through Central (the owner's create)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(url.slice(0,-4)).pathname,'utf8'))};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url).pathname,'utf8')};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})
const {mintInstance} = await import('../../../../desktop/cradle/src/flow/instance.ts')
const listing = await postOp(bridgeUrl, {op: 'files_list', path: 'Control/user/flows'}, 60000)
const root = listing?.outcome?.directory?.location?.root
assert.ok(root, `Central lists the scratch flows folder: ${JSON.stringify(listing).slice(0, 300)}`)
const flowPath = `Control/user/flows/flow-af741-${Date.now()}.html`
const flowHtml = mintInstance('The stone was carved at Bollingen.\n\nThe second stone stands by the water, and the stone remembers.')
const created = await postOp(bridgeUrl, {op: 'file_operation', location: {schema: 'central.path-ref/v1', ref: `central:path:${root}:${flowPath}`, root, path: flowPath},
  request: {action: 'write', expected_revision: '', content: flowHtml}}, 60000)
assert.equal(created?.outcome?.data?.outcome, 'created', `Central creates the Flow on the scratch ground: ${JSON.stringify(created).slice(0, 300)}`)

// ---- the real App, as main.tsx mounts it
const {js, css} = await bundleEntry({contents: `
import {StrictMode, Suspense} from 'react'
import {createRoot} from 'react-dom/client'
import './styles.css'
import './shell/theme'
import './panels'
import {loadAgentShellFamilies} from './inhabitants/loadAgentShellFamilies'
import {App} from './App'
import {WorkspaceProvider} from './shell/workspace'
import {ContinuityProvider} from './continuity/workspace'
import {NativeFoundation} from './native/Foundation'
import {AgentSessionsProvider} from './agent/AgentSessionsProvider'
loadAgentShellFamilies()
createRoot(document.getElementById('root')!).render(
  <StrictMode><ContinuityProvider><WorkspaceProvider><NativeFoundation><Suspense fallback={null}><AgentSessionsProvider><App /></AgentSessionsProvider></Suspense></NativeFoundation></WorkspaceProvider></ContinuityProvider></StrictMode>,
)
`, resolveDir: join(ui, 'src'), sourcefile: 'af741-walk-entry.tsx', outfile: 'af741-walk.mjs'})
const site = await serveShellPage({html: shellHtml({js, css}), kernelBridge: bridgeUrl})

const receipt = {schema: 'oi.af741-central-editor-walk/v1', recorded_at: new Date().toISOString(), scratch, bridge: bridgeUrl, flow: flowPath,
  channel: 'scripted Playwright over the real App bundle and a scratch-world walk-bridge; the native window is UNVERIFIED (#821)', engines: {}}
const faults = []

async function walk(name) {
  const steps = []
  const step = (what, detail = '') => { steps.push({what, detail}); console.log(`  ${name}: ${what}${detail ? ` — ${detail}` : ''}`) }
  const fault = (what, error) => { faults.push(`${name}: ${what}: ${error?.message ?? error}`); steps.push({what, fault: String(error?.message ?? error)}); console.log(`  ${name}: FAULT ${what} — ${error?.message ?? error}`) }
  let mark = () => {}
  const check = async (what, run) => { mark(what); try { const detail = await run(); step(what, detail ?? '') } catch (error) { fault(what, error) } }
  const browser = await playwright()[name].launch({headless: true})
  const page = await browser.newPage({viewport: {width: 1600, height: 1000}})
  // The dev walk bridge, as every page of the shell finds it (desktop/cradle/src/kernel/bridge.ts detectTransport).
  await page.addInitScript(url => { window.__OI_KERNEL_BRIDGE__ = url }, bridgeUrl)
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  // Every owner op the page asks, with when: what reads and writes the Flow is read back from here when a step does not hold.
  const ops = []
  const began = Date.now()
  page.on('request', request => {
    if (!request.url().endsWith('/op') || request.method() !== 'POST') return
    const body = request.postData() ?? ''
    if (body.includes(flowPath.split('/').pop())) ops.push(`${Date.now() - began}ms ${body.slice(0, 160)}`)
  })
  mark = what => ops.push(`${Date.now() - began}ms ── ${what}`)
  try {
    await page.goto(site.url, {waitUntil: 'domcontentloaded', timeout: 90000})
    await page.waitForSelector('.transport', {timeout: 90000})
    await page.locator('.mode-rail-button[aria-label*="Central"]').first().click()
    await page.locator('button[aria-label="Pane view"]').first().click().catch(() => {})
    const flowPane = page.locator('.central-document-pane[data-central-document="flow"]').first()
    await flowPane.waitFor({timeout: 90000})
    const flowFrame = page.frameLocator('.central-document-pane[data-central-document="flow"] iframe.inhabitant-document-frame')
    await flowFrame.locator('text=Bollingen').first().waitFor({timeout: 90000})
    // The face takes its first read of the page as the basis a draft is told from (DocumentFlowFace.tsx refreshDraftStanding, every
    // 2.5 s): an edit made before it would be taken as the basis, not a draft. The walk writes after it, as a reader does.
    await page.waitForFunction(() => document.querySelector('.central-document-pane[data-central-document="flow"] [data-document-device="ql-flow"]')?.dataset.baselined === 'true', undefined, {timeout: 30000})
    step('Central opens the scratch Flow in its pane, drawn by its form', flowPath)
    const ids = await page.evaluate(() => {
      const group = document.querySelector('.central-document-pane[data-central-document="flow"]').closest('.pane.group')
      return {flow: group.querySelector(':scope > .surface-body').dataset.bindingId, group: group.dataset.groupId,
        groups: [...document.querySelectorAll('.candidate-workbench-tree:not([hidden]) .pane.group')].map(g => g.dataset.groupId)}
    })
    step('the panes', JSON.stringify(ids))
    await page.screenshot({path: join(evidence, `${name}-00-central.png`)})

    // D. a press inside the page focuses its pane
    await check('D: a press inside the Flow page focuses the Flow\'s pane', async () => {
      const other = ids.groups.find(id => id !== ids.group)
      if (other) await page.locator(`.pane.group[data-group-id="${other}"] .surface-body`).first().click({position: {x: 40, y: 40}, force: true})
      await flowFrame.locator('[data-entry]').first().click()
      await page.waitForFunction(group => document.querySelector(`.pane.group[data-group-id="${group}"]`)?.dataset.focused === 'true', ids.group, {timeout: 5000})
      return `focused: ${ids.group}`
    })

    // C. ⌘F inside the page
    await check('C: ⌘F typed inside the page opens its pane\'s find, seeded empty', async () => {
      await flowFrame.locator('[data-entry]').first().click()
      await page.keyboard.press('Meta+f')
      await flowPane.locator('.document-find input').waitFor({timeout: 5000})
      await page.waitForFunction(() => document.activeElement?.closest('.document-find') != null, undefined, {timeout: 3000})
    })
    await check('C: typing finds as you type and counts "{n} of {m}"', async () => {
      await page.keyboard.type('stone')
      await page.waitForFunction(() => /^\d+ of \d+$/.test(document.querySelector('.document-find [data-find-count]')?.textContent ?? ''), undefined, {timeout: 5000})
      return await flowPane.locator('.document-find [data-find-count]').textContent()
    })
    const total = Number((await flowPane.locator('.document-find [data-find-count]').textContent().catch(() => '0 of 0')).split(' of ')[1])
    /** The Flow's own frame (another origin: its marks are read from inside it). */
    const flowFrameObject = async () => (await page.locator('.central-document-pane[data-central-document="flow"] iframe.inhabitant-document-frame').first().elementHandle())?.contentFrame()
    const marksNow = async () => (await flowFrameObject())?.evaluate(() => (window.__OI_DOCUMENT_FIND__
      ? {all: CSS.highlights?.get('oi-find')?.size ?? 0, current: CSS.highlights?.get('oi-find-current')?.size ?? 0, marks: document.querySelectorAll('mark').length} : null))
    await check('C: the page marks every match and the one in front (CSS highlights; no node of the page added)', async () => {
      const seen = await marksNow()
      assert.ok(seen, 'the Flow\'s page carries the find')
      assert.equal(seen.all, total, 'every match is marked')
      assert.equal(seen.current, 1, 'one is in front')
      assert.equal(seen.marks, 0, 'no <mark> was written into the page')
      return `${seen.all} marked, 1 in front`
    })
    await check('C: Enter steps to the next match and wraps round; ⇧Enter steps back; ⌘G steps on', async () => {
      const count = () => flowPane.locator('.document-find [data-find-count]').textContent()
      // The page answers by message: each press is read once its answer has come back.
      const shows = words => page.waitForFunction(text => document.querySelector('.document-find [data-find-count]')?.textContent === text, words, {timeout: 5000})
      const first = await count()
      const at = Number(first.split(' of ')[0])
      const nth = k => `${((at - 1 + k) % total + total) % total + 1} of ${total}`
      for (let i = 1; i <= total; i++) { await page.keyboard.press('Enter'); await shows(nth(i)) }
      assert.equal(await count(), first, `${total} Enters come round to where they began (loop)`)
      await page.keyboard.press('Shift+Enter'); await shows(nth(-1))
      await page.keyboard.press('Meta+g'); await shows(first)
      return `${first} → ${total} Enters → ${first}; ⇧Enter → ${nth(-1)}; ⌘G → ${first}`
    })
    await page.screenshot({path: join(evidence, `${name}-01-find.png`)})
    await check('C: "No results" for words the page does not hold', async () => {
      await page.keyboard.press('Meta+a'); await page.keyboard.type('quartzite')
      await page.waitForFunction(() => document.querySelector('.document-find [data-find-count]')?.textContent === 'No results', undefined, {timeout: 5000})
    })
    await check('C: Escape closes the find, clears its marks and hands the page its focus back', async () => {
      await page.keyboard.press('Meta+a'); await page.keyboard.type('stone')
      await page.waitForFunction(() => /^\d+ of \d+$/.test(document.querySelector('.document-find [data-find-count]')?.textContent ?? ''), undefined, {timeout: 5000})
      await page.keyboard.press('Escape')
      await flowPane.locator('.document-find').waitFor({state: 'detached', timeout: 5000})
      assert.equal(await page.evaluate(() => document.activeElement?.matches('iframe.inhabitant-document-frame')), true, 'the page has the focus again')
      // The page clears its marks when the close reaches it, by message.
      for (let i = 0; i < 20 && (await marksNow())?.all !== 0; i++) await page.waitForTimeout(50)
      assert.equal((await marksNow())?.all, 0, 'no mark is left in the page')
    })
    await check('C: ⌘F in the window (the focus loose on the pane) opens the pane in front\'s find, with its last words', async () => {
      await flowPane.locator('.document-pane-state').click()
      await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur())
      await page.keyboard.press('Meta+f')
      await flowPane.locator('.document-find input').waitFor({timeout: 5000})
      const value = await flowPane.locator('.document-find input').inputValue()
      assert.equal(value, 'stone', 'VS Code keeps the last search when nothing is selected')
      await page.waitForFunction(() => document.activeElement?.closest('.document-find') != null, undefined, {timeout: 3000})
      await page.keyboard.press('Escape')
      await flowPane.locator('.document-find').waitFor({state: 'detached', timeout: 5000})
      return `seeded "${value}"`
    })
    await check('C: ⌘F with the focus in the browser stays the browser\'s', async () => {
      const row = page.locator('.one-browser [data-browser-row], .one-browser .mode-browser-row').first()
      // A press, as the hand makes it: WebKit leaves a pressed row unfocused, so where the hand pressed is what says where ⌘F finds.
      if (await row.count()) await row.click()
      const before = await page.evaluate(() => `${document.activeElement?.tagName.toLowerCase()}${document.activeElement?.closest('.one-browser, .world-browser') ? ' in the browser' : ''}`)
      await page.keyboard.press('Meta+f')
      await page.waitForTimeout(300)
      assert.equal(await page.locator('.document-find').count(), 0, `no pane opened its find (focus before ⌘F: ${before})`)
      return await page.evaluate(() => `focus: ${document.activeElement?.tagName.toLowerCase()}${document.activeElement?.closest('.one-browser') ? ' in the browser' : ''}`)
    })

    // A. the tab's double-click
    await check('A: double-clicking the Flow\'s tab fills the main area with its pane', async () => {
      await page.locator(`[data-surface-id="${ids.flow}"]`).first().dblclick({force: true})
      await page.waitForFunction(group => document.querySelector(`.pane.group[data-group-id="${group}"]`)?.dataset.maximized === 'true', ids.group, {timeout: 5000})
      const hidden = await page.evaluate(({group, groups}) => groups.filter(id => id !== group).every(id => getComputedStyle(document.querySelector(`.pane.group[data-group-id="${id}"]`)).display === 'none'), ids)
      assert.equal(hidden, true, 'the other panes stand hidden')
    })
    await page.screenshot({path: join(evidence, `${name}-02-tab-full.png`)})
    await check('A: double-clicking it again brings the other panes back', async () => {
      await page.locator(`[data-surface-id="${ids.flow}"]`).first().dblclick({force: true})
      await page.waitForFunction(group => document.querySelector(`.pane.group[data-group-id="${group}"]`)?.dataset.maximized === 'false', ids.group, {timeout: 5000})
      const shown = await page.evaluate(({groups}) => groups.every(id => getComputedStyle(document.querySelector(`.pane.group[data-group-id="${id}"]`)).display !== 'none'), ids)
      assert.equal(shown, true, 'every pane stands again')
    })

    // B. the draft on the tab, and the owner's Save
    await check('B: a draft in the Flow marks its pane\'s tab', async () => {
      await flowFrame.locator('[aria-label="Title"]').first().click()
      await page.keyboard.type(`Walked ${name}`)
      try {
        await page.waitForFunction(id => document.querySelector(`[data-surface-id="${id}"]`)?.dataset.dirty === 'true', ids.flow, {timeout: 12000})
      } catch (error) {
        // Say what the face and its page held when the mark did not come.
        const face = await flowPane.locator('[data-document-device="ql-flow"]').evaluate(el => ({dirty: el.dataset.dirty, baselined: el.dataset.baselined, revision: el.dataset.basisRevision})).catch(e => String(e))
        const island = await (await flowFrameObject())?.evaluate(() => { const r = window.__OI_DOCUMENT_HOST__?.read(); return {present: r?.present, titled: String(r?.text ?? '').includes('Walked')} }).catch(e => String(e))
        throw new Error(`${error.message}; face ${JSON.stringify(face)}; island ${JSON.stringify(island)}; state "${await flowPane.locator('.document-pane-state').textContent()}"`)
      }
      assert.equal(await page.locator(`[data-surface-id="${ids.flow}"] .tab-dirty`).count(), 1, 'the tab carries the mark')
      return await flowPane.locator('.document-pane-state').textContent()
    })
    await page.screenshot({path: join(evidence, `${name}-03-draft.png`)})
    await check('B: the owner\'s Save writes it and the mark goes', async () => {
      await flowPane.locator('button[data-action="save"]').click()
      await page.waitForFunction(id => document.querySelector(`[data-surface-id="${id}"]`)?.dataset.dirty === 'false', ids.flow, {timeout: 20000})
      const read = await postOp(bridgeUrl, {op: 'file_read', location: {schema: 'central.path-ref/v1', ref: `central:path:${root}:${flowPath}`, root, path: flowPath}}, 30000)
      const content = read?.outcome?.reading?.content ?? read?.outcome?.data?.content ?? JSON.stringify(read).slice(0, 2000)
      assert.ok(String(content).includes(`Walked ${name}`), 'Central holds the saved title')
      return await flowPane.locator('.document-pane-state').textContent()
    })
    if (pageErrors.length) step('page errors (not failing the walk)', pageErrors.slice(0, 6).join(' | '))
  } catch (error) {
    fault('walk', error)
    await page.screenshot({path: join(evidence, `${name}-fault.png`)}).catch(() => {})
  } finally {
    await browser.close()
  }
  receipt.engines[name] = steps
  receipt[`${name}_flow_ops`] = ops
}

try {
  for (const name of engines) { console.log(`— ${name}`); await walk(name) }
} finally {
  await site.close()
  stopBridge()
  receipt.faults = faults
  receipt.bridge_log_tail = bridgeLog.slice(-2000)
  writeFileSync(join(evidence, 'receipt.json'), JSON.stringify(receipt, null, 2))
  console.log(`receipt: ${join(evidence, 'receipt.json')}`)
}
if (faults.length) { console.error(`${faults.length} fault(s):\n${faults.join('\n')}`); process.exit(1) }
console.log('af741 walk: every step held')
