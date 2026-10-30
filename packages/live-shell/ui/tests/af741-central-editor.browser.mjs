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
 * Lane AG (O-I #741) carries on from there:
 *   E. §10.9/§17.8 — ⌘S typed inside the Flow page is the pane's Save through Central: the owner holds the edit, and the form's own
 *      ⌘S (its portable copy) downloads nothing.
 *   F. §18.4 — a find line left open re-arms on the page a Re-read puts in its frame (the owner's page moved meanwhile).
 *   G. §2/§16.7 — a draft in a pane that closes is kept on this device: ⇧⌘T brings the Flow back with the draft in its page, named, and
 *      the owner never saw it; Re-read sets it aside.
 *   H. §18.4 — the search line's ✕, at the kernel's door, when AIKit's own binary is handed to the bridge (OI_WALK_AIKIT): AIKit's
 *      `knowledge history` answers through the kernel, and `aikit knowledge forget here` forgets one item in your world's ground and
 *      names that world; a world Central does not disclose is refused before AIKit is asked. On screen it is UNWALKED: a scratch world
 *      gives AIKit nothing to find, so no item is counted to forget (lane AG's OPEN).
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
// AIKit's own binary for the kernel's AIKit routes (aikit_write) and, through a shim, its knowledge op (`oi aikit …`); everything else
// the suite's own `oi`. Its state is the scratch home's.
const walkAikit = process.env.OI_WALK_AIKIT
if (walkAikit) {
  const shim = join(scratch, 'oi-shim')
  writeFileSync(shim, `#!/bin/sh\nif [ "$1" = aikit ]; then shift; exec ${JSON.stringify(walkAikit)} "$@"; fi\nexec oi "$@"\n`, {mode: 0o755})
  Object.assign(isolated, {OI_AIKIT_BIN: walkAikit, OI_BIN: shim, CENTRAL_ROOT: ground, AIKIT_CENTRAL_ROOT: ground})
}
execFileSync(process.env.OI_CENTRAL_CTRL_BIN ?? 'ctrl', ['--root', ground, '--json', 'action', 'run', 'central.init'], {encoding: 'utf8', env: isolated})
mkdirSync(join(ground, 'Control/user/flows'), {recursive: true})
const port = 4300 + Math.floor(Math.random() * 400)
const bridgeUrl = `http://127.0.0.1:${port}`
const bridge = spawn(bridgeBin, [`127.0.0.1:${port}`], {env: isolated, detached: true, stdio: ['ignore', 'ignore', 'pipe']})
let bridgeLog = ''
bridge.stderr.on('data', chunk => { if (bridgeLog.length < 20000) bridgeLog += chunk })
// The bridge's owners can leave a server of their own standing on the scratch ground (AIKit's `session-space encounter-serve`): it is
// stopped with the bridge, by its pid, found by the scratch ground it was started on — nothing else is touched.
const stopOnGround = () => {
  try {
    for (const line of execFileSync('ps', ['-Ao', 'pid=,command='], {encoding: 'utf8'}).split('\n')) {
      const [, pid, command] = /^\s*(\d+)\s+(.*)$/.exec(line) ?? []
      if (pid && Number(pid) !== process.pid && command.includes(ground)) { try { process.kill(Number(pid), 'SIGTERM') } catch {} }
    }
  } catch {}
}
const stopBridge = () => { try { process.kill(-bridge.pid, 'SIGTERM') } catch {} stopOnGround() }
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

/** The Flow as Central holds it now, and its revision. */
const flowLocation = {schema: 'central.path-ref/v1', ref: `central:path:${root}:${flowPath}`, root, path: flowPath}
async function readFlow() {
  const read = await postOp(bridgeUrl, {op: 'file_read', location: flowLocation}, 30000)
  const reading = read?.outcome?.reading ?? read?.outcome?.data ?? {}
  return {content: String(reading.content ?? JSON.stringify(read).slice(0, 2000)), revision: reading.revision}
}

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

    // E. ⌘S inside the page
    await check('E: ⌘S typed inside the Flow page saves it through Central, and no portable copy downloads', async () => {
      const downloads = []
      const onDownload = download => downloads.push(download.suggestedFilename())
      page.on('download', onDownload)
      try {
        // A save re-reads the Flow and puts the owner's page back in the frame: write in that page, once it stands.
        await page.waitForFunction(() => document.querySelector('.central-document-pane[data-central-document="flow"] [data-document-device="ql-flow"]')?.dataset.baselined === 'true', undefined, {timeout: 30000})
        await flowFrame.locator('[aria-label="Title"]').first().click()
        await page.keyboard.press('End')
        // One word, no space: WebKit's editable keeps a typed trailing space as a no-break space.
        await page.keyboard.type('-bykey')
        await page.waitForFunction(id => document.querySelector(`[data-surface-id="${id}"]`)?.dataset.dirty === 'true', ids.flow, {timeout: 12000})
        await page.keyboard.press('Meta+s')
        await page.waitForFunction(id => document.querySelector(`[data-surface-id="${id}"]`)?.dataset.dirty === 'false', ids.flow, {timeout: 20000})
        assert.ok((await readFlow()).content.includes('-bykey'), 'Central holds the edit ⌘S saved')
        await page.waitForTimeout(800)
      } finally { page.off('download', onDownload) }
      assert.deepEqual(downloads, [], 'the form\'s portable copy was not downloaded')
      return await flowPane.locator('.document-pane-state').textContent()
    })

    // F. ⌘F re-arms on the page a Re-read puts in the frame
    await check('F: a find line left open re-arms on the page a Re-read puts in its place', async () => {
      await flowFrame.locator('[data-entry]').first().click()
      await page.keyboard.press('Meta+f')
      await flowPane.locator('.document-find input').waitFor({timeout: 5000})
      await page.keyboard.press('Meta+a'); await page.keyboard.type('stone')
      await page.waitForFunction(() => /^\d+ of \d+$/.test(document.querySelector('.document-find [data-find-count]')?.textContent ?? ''), undefined, {timeout: 5000})
      const before = (await marksNow())?.all ?? 0
      // The owner's page moves (another editor writes it): one more stone in its title.
      const held = await readFlow()
      const moved = held.content.split('-bykey').join('-bykey stone')
      assert.notEqual(moved, held.content, 'the walk found the title to move')
      const wrote = await postOp(bridgeUrl, {op: 'file_operation', location: flowLocation, request: {action: 'write', expected_revision: held.revision, content: moved}}, 30000)
      assert.ok(['written', 'saved', 'updated'].includes(wrote?.outcome?.data?.outcome) || wrote?.outcome?.data?.revision, `Central writes the moved page: ${JSON.stringify(wrote).slice(0, 300)}`)
      await (await flowFrameObject())?.evaluate(() => { window.__agOldPage = true })
      await flowPane.locator('button[data-action="reread"]').click()
      // The new page stands in the frame: the old document's mark is gone and its words are drawn.
      let fresh = false
      for (let i = 0; i < 150 && !fresh; i++) {
        fresh = await (await flowFrameObject())?.evaluate(() => !window.__agOldPage && !!document.querySelector('[data-entry]')).catch(() => false)
        if (!fresh) await page.waitForTimeout(100)
      }
      assert.ok(fresh, 'the Re-read put a new page in the frame')
      let after = 0
      for (let i = 0; i < 60 && after <= before; i++) { after = (await marksNow())?.all ?? 0; if (after <= before) await page.waitForTimeout(100) }
      // The moved page holds more stones than the one it replaced (every copy of the title the owner keeps moved): marked there, the line
      // re-armed on it; a line left dead would leave the new page unmarked.
      assert.ok(after > before, `the new page marks its matches, the moved title's among them (${before} before, ${after} now)`)
      await page.waitForFunction(total => document.querySelector('.document-find [data-find-count]')?.textContent?.endsWith(` of ${total}`), after, {timeout: 5000})
      await page.locator('.document-find input').focus()
      await page.keyboard.press('Escape')
      await flowPane.locator('.document-find').waitFor({state: 'detached', timeout: 5000})
      return `${before} marked before, ${after} on the new page; ${await page.evaluate(() => document.querySelector('.document-pane-state')?.textContent)}`
    })

    // G. a draft in a pane that closes
    await check('G: a draft in a pane that closes is kept on this device, and the owner never sees it', async () => {
      await page.waitForFunction(() => document.querySelector('.central-document-pane[data-central-document="flow"] [data-document-device="ql-flow"]')?.dataset.baselined === 'true', undefined, {timeout: 30000})
      await flowFrame.locator('[aria-label="Title"]').first().click()
      await page.keyboard.press('End')
      await page.keyboard.type('-unsaved')
      await page.waitForFunction(id => document.querySelector(`[data-surface-id="${id}"]`)?.dataset.dirty === 'true', ids.flow, {timeout: 12000})
      // ⌘W closes the tab in front of the focused pane (desktop/cradle/src/surface/keys.ts): a press on the pane's head focuses it, outside
      // the page, whose own keys are its own. (The tab's ✕ stands in a strip that folds away under the next pane in this layout.)
      await flowPane.locator('.document-pane-state').click()
      await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur())
      await page.keyboard.press('Meta+w')
      try {
        await page.locator('.central-document-pane[data-central-document="flow"]').first().waitFor({state: 'detached', timeout: 15000})
      } catch (error) {
        // Say what the window said when the pane stayed: a refused close names why.
        const said = await page.evaluate(() => [...document.querySelectorAll('[role="alert"]')].map(el => el.textContent?.trim()).filter(Boolean).slice(0, 8))
        throw new Error(`${error.message.split('\n')[0]}; the window said: ${JSON.stringify(said)}`)
      }
      const kept = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('oi-central.kept-draft.v1:Flow:'))
        .map(key => JSON.parse(localStorage.getItem(key))))
      assert.equal(kept.length, 1, 'one Flow draft kept on this device')
      assert.ok(kept[0].draft.includes('unsaved'), 'the draft as it stood')
      assert.ok(!(await readFlow()).content.includes('unsaved'), 'the owner was never written')
      await page.screenshot({path: join(evidence, `${name}-04-closed.png`)})
      return `kept against ${String(kept[0].basis).slice(-8)}`
    })
    await check('G: ⇧⌘T brings the Flow back with the draft in its page, named, and its tab marked', async () => {
      await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur())
      await page.keyboard.press('Meta+Shift+t')
      const again = page.locator('.central-document-pane[data-central-document="flow"]').first()
      await again.waitFor({timeout: 30000})
      await flowFrame.locator('[aria-label="Title"]', {hasText: 'unsaved'}).first().waitFor({timeout: 30000})
      const notice = await again.locator('.inhabitant-device-notice').first().textContent({timeout: 10000})
      assert.match(notice, /is back in the page/, 'the page says the draft is back')
      await page.waitForFunction(() => document.querySelector('.tab[data-dirty="true"]') != null, undefined, {timeout: 12000})
      await page.screenshot({path: join(evidence, `${name}-05-reopened.png`)})
      return notice
    })
    await check('G: Re-read sets the kept draft aside', async () => {
      const again = page.locator('.central-document-pane[data-central-document="flow"]').first()
      await again.locator('button[data-action="reread"]').click()
      await page.waitForFunction(() => !Object.keys(localStorage).some(key => key.startsWith('oi-central.kept-draft.v1:Flow:')), undefined, {timeout: 10000})
      await flowFrame.locator('[aria-label="Title"]').first().waitFor({timeout: 30000})
      for (let i = 0; i < 50 && ((await flowFrame.locator('[aria-label="Title"]').first().textContent()) ?? '').includes('unsaved'); i++) await page.waitForTimeout(100)
      assert.ok(!((await flowFrame.locator('[aria-label="Title"]').first().textContent()) ?? '').includes('unsaved'), 'the page shows the Flow as Central holds it')
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

// H. the search line's ✕ at the kernel's door: AIKit's own history and its forget of one item in one world.
async function kernelDoor() {
  if (!walkAikit) { receipt.kernel_door = 'not walked: OI_WALK_AIKIT not given'; console.log('— kernel door: not walked (OI_WALK_AIKIT not given)'); return }
  console.log('— kernel door (AIKit)')
  const steps = []
  const step = (what, run) => run().then(detail => { steps.push({what, detail}); console.log(`  ${what} — ${detail}`) },
    error => { faults.push(`kernel door: ${what}: ${error.message}`); steps.push({what, fault: error.message}); console.log(`  FAULT ${what} — ${error.message}`) })
  await step('H: AIKit\'s knowledge history answers through the kernel (the receipts how lately is read from)', async () => {
    const history = await postOp(bridgeUrl, {op: 'knowledge', request: {action: 'history'}}, 60000)
    assert.ok(Array.isArray(history?.outcome?.data), `a list of receipts: ${JSON.stringify(history).slice(0, 300)}`)
    return `${history.outcome.data.length} receipt(s)`
  })
  await step('H: ✕ — `aikit knowledge forget here` forgets one item in your world\'s ground, and names that world', async () => {
    const forgot = await postOp(bridgeUrl, {op: 'aikit_write', request: {kind: 'knowledge-forget', scope: 'here', resource: 'wiki:node:bollingen'}}, 60000)
    const data = forgot?.outcome?.data
    assert.equal(forgot?.outcome?.result, 'owner_route_reading', JSON.stringify(forgot).slice(0, 400))
    assert.equal(data?.forgot?.DestinationIn?.destination, 'wiki:node:bollingen', JSON.stringify(data))
    assert.ok('project' in (data?.forgot?.DestinationIn ?? {}), 'the world it forgot in is named')
    assert.ok(data?.preserved?.includes('other-worlds'), 'every other world keeps its own')
    return `${forgot.outcome.route}: ${JSON.stringify(data.forgot)}`
  })
  await step('H: a world Central does not disclose is refused before AIKit is asked', async () => {
    const refused = await postOp(bridgeUrl, {op: 'aikit_write', request: {kind: 'knowledge-forget', scope: 'here', resource: 'wiki:node:bollingen', project: 'Elsewhere'}}, 60000)
    assert.ok(refused?.error, JSON.stringify(refused).slice(0, 300))
    return String(refused.error).slice(0, 120)
  })
  receipt.kernel_door = steps
}

try {
  for (const name of engines) { console.log(`— ${name}`); await walk(name) }
  await kernelDoor()
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
