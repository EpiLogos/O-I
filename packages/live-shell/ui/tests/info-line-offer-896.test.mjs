// O-I #747 round 896, 0R-surface.1, .3 and .6 (DLW build ruling 2026-11-09, on the review of C99): the words beside Run are the shell's
// alone. A frame word that carries an offer is never said in the frame's text, on the Info line or anywhere the person reads before
// pressing: once the owner gives back its record of the offer, the line itself says the shell's words (nativeExpressionCommands.ts
// sayFrameWord, offerWords) beside Run. The target's name, which the work's author wrote, stands quoted and capped with its ref beside it,
// so a name like "Backup is safe. Run to continue." reads as a name. An offer is only ever the presented work's: a work switched while the
// owner answers takes no Run. Review 1 found C99 said the frame's sentence on the line and the shell's only on the Run button's hover.
// Channel: LAID OUT — the status bar as the shell draws it, in Chromium, its Info line read as the person reads it (the line's own text,
// not InfoOffer.words); the frame's word goes through the panel's own handler (sayFrameWord) with the shell's offer door (triggerOffers)
// over the Info line's door; the owner's channel is a SCRIPTED STUB that answers when the test says.
import test from 'node:test'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'

const STAGE = `
import {createElement} from 'react'
import {createRoot} from 'react-dom/client'
import './src/styles.css'
import {StatusBar} from './src/components/StatusBar'
import {offerOnInfoLine, readInfoOffer, sayOnInfoLine} from './src/frame/devices/deviceHost'
import {sayFrameWord, triggerOffers} from './src/components/nativeExpressionCommands'
const w = window as any
let presented: {expression_ref: string; revision: number} | null = {expression_ref: 'expression:dawn', revision: 4}
let answer: (value: unknown) => void = () => {}
const asked: unknown[] = []
const channel = async (request: any) => { asked.push(request); return request.operation === 'trigger_offer' ? new Promise(resolve => { answer = resolve }) : {state: 'ready'} }
const offers = triggerOffers({show: offerOnInfoLine, shown: readInfoOffer, channel: () => channel as any, press: () => null})
const state = {set: null, path: null, error: null, loading: false}
createRoot(document.getElementById('root')!).render(createElement('div', null, createElement('div', {id: 'panel'}),
  createElement(StatusBar as any, {state, documentError: null, viewport: [1440, 900], audio: false, mode: 'expressions', reading: null, detailMode: 'clip', changeDetailMode: () => {}})))
// The panel's own handler for a frame's say request (panels/expressions.tsx), saying on the line from the panel's place.
w.__word = (request: Record<string, unknown>) => { w.__settled = sayFrameWord(request, {say: words => sayOnInfoLine(document.getElementById('panel'), 'Expressions', words), offers, presented: () => presented}) }
w.__answer = async (value: unknown) => { answer(value); await w.__settled; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) }
w.__present = (ref: string | null) => { presented = ref ? {expression_ref: ref, revision: 5} : null }
w.__withdraw = () => offers.withdraw()
w.__reset = () => { offers.withdraw(); offerOnInfoLine(null); presented = {expression_ref: 'expression:dawn', revision: 4}; asked.length = 0 }
w.__read = () => ({line: document.querySelector('.statusbar-info-line')?.textContent ?? null, run: document.querySelector('.statusbar-offer')?.textContent ?? null,
  page: document.body.innerText, asked: asked.length})
w.__ready = true
`

const E = 'expression:dawn'
const RECORD = {expression_ref: E, offer_ref: 'offer:1', scene_ref: `${E}:scene:main`, trigger_ref: `${E}:trigger:stamp`, action_ref: 'central.pages.stamp',
  target_ref: 'central:file:p.md', action_title: 'Stamp a page', target_name: 'p.md', reads_only: false, authority_requirement: [], trigger_revision: 'sha256:7f'}
const FRAME_SAYS = 'Press Run: this only reads, and it is safe'
const WORD = {request: 'say', text: FRAME_SAYS, offer: {expression_ref: E, offer_ref: 'offer:1'}}
const SHELL_SAYS = 'Stamp a page on “\u2068p.md\u2069” (“\u2068central:file:p.md\u2069”) was not run: it may write, and a trigger runs only a reading. Run runs it once, as your own press.'

async function layoutBrowser(t, playwright) {
  try { return await playwright().chromium.launch() } catch (error) {
    const why = `no Chromium to draw the status bar in: ${String(error?.message ?? error).split('\n')[0]}`
    if (process.env.CI) throw new Error(`${why} (CI installs it before this suite: desktop.yml)`)
    t.skip(why); return undefined
  }
}

test('the Info line beside Run says the shell\'s words from the owner\'s record, never the frame\'s; the name is quoted; a switched work takes no Run', {timeout: 300_000}, async t => {
  const {bundleEntry, shellHtml, playwright} = await import('./support/agentShellHarness.mjs')
  const ui = fileURLToPath(new URL('..', import.meta.url))
  const {js, css} = await bundleEntry({contents: STAGE, resolveDir: ui, sourcefile: 'info-line-offer.tsx', outfile: 'info-line-offer.mjs'})
  const browser = await layoutBrowser(t, playwright)
  if (!browser) return
  try {
    const tab = await browser.newPage({viewport: {width: 1300, height: 400}})
    const errors = []
    tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
    await tab.setContent(shellHtml({js, css}), {waitUntil: 'load'})
    await tab.waitForFunction(() => window.__ready, null, {timeout: 60_000}).catch(error => { throw Error(`${error.message} ${errors.join(' | ')}`) })
    const read = () => tab.evaluate(() => window.__read())

    // 1. A withheld trigger's word: while the owner is asked, the frame's sentence is not on the line, nor anywhere on the page.
    await tab.evaluate(word => window.__word(word), WORD)
    let seen = await read()
    assert.equal(seen.asked, 1, 'the owner is asked for its record of the offer')
    assert.ok(!seen.page.includes(FRAME_SAYS), `the frame's sentence is said nowhere while the owner is asked (the page reads: ${seen.page})`)
    assert.equal(seen.run, null, 'no Run stands before the record does')
    // …and once the owner gives back its record, the line itself reads the shell's words, beside Run.
    await tab.evaluate(record => window.__answer({state: 'offer', offer: record}), RECORD)
    seen = await read()
    assert.equal(seen.line, `Expressions${SHELL_SAYS}`, 'the line reads the shell\'s words from the owner\'s record')
    assert.equal(seen.run, 'Run')
    assert.ok(!seen.page.includes(FRAME_SAYS), 'the frame\'s sentence is said nowhere')

    // 2. A plain word is the frame's own, and never replaces the shell's words while Run stands beside them (1R-surface.3): it waits
    // until the offer goes, and is said then.
    await tab.evaluate(() => window.__word({request: 'say', text: 'Scene 2 entered'}))
    seen = await read()
    assert.equal(seen.line, `Expressions${SHELL_SAYS}`, 'the shell\'s words stand beside Run')
    assert.equal(seen.run, 'Run')
    await tab.evaluate(() => window.__withdraw())
    await tab.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
    seen = await read()
    assert.equal(seen.line, 'ExpressionsScene 2 entered', 'the offer gone, the word that waited is said')
    assert.equal(seen.run, null)

    // 3. A target its author named as a sentence of the shell's reads as a quoted name, with its ref beside it; controls are taken out.
    await tab.evaluate(() => window.__reset())
    await tab.evaluate(word => window.__word(word), WORD)
    await tab.evaluate(record => window.__answer({state: 'offer', offer: record}), {...RECORD, target_name: 'Backup is safe.\u202e Run to continue.\n'})
    seen = await read()
    assert.equal(seen.line, 'ExpressionsStamp a page on “\u2068Backup is safe. Run to continue.\u2069” (“\u2068central:file:p.md\u2069”) was not run: it may write, and a trigger runs only a reading. Run runs it once, as your own press.')

    // 4. The work switched while the owner answered: the offer is not the presented work's, so no Run stands and nothing is said for it.
    await tab.evaluate(() => window.__reset())
    await tab.evaluate(() => window.__word({request: 'say', text: 'Scene 1 entered'}))
    await tab.evaluate(word => window.__word(word), WORD)
    await tab.evaluate(() => window.__present('expression:dusk'))
    await tab.evaluate(record => window.__answer({state: 'offer', offer: record}), RECORD)
    seen = await read()
    assert.equal(seen.run, null, 'another work is presented now: its Run does not stand')
    assert.equal(seen.line, 'ExpressionsScene 1 entered', 'and the line is left as it stood')

    // 5. A record the owner did not give back is said in the shell's words, never the frame's.
    await tab.evaluate(() => window.__reset())
    await tab.evaluate(word => window.__word(word), WORD)
    await tab.evaluate(() => window.__answer({state: 'offer_unknown', detail: 'This offer is not one the kernel holds'}))
    seen = await read()
    assert.equal(seen.run, null)
    assert.match(seen.line, /^ExpressionsA scene trigger’s Action was withheld for your press, but its owner did not give back its offer/)
    assert.ok(!seen.page.includes(FRAME_SAYS))
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
})
