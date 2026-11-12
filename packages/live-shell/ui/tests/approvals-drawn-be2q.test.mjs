// be2q (DLW build ruling 2026-11-11), the follow-ups of the review of O-I #970: what only a laid-out page can show of the faces that
// answer a consent request.
//   Ruling 1: in the Approvals pane the answers are always in reach. The detail scrolls inside its box, and Approve, Deny and Open stand
//             at its foot, outside the scrolled part, with "not as sent" beside them where the request is not shown as it was sent.
//   Ruling 2: nothing is cut without a mark. A long unbroken word wraps in the pane, on the chat card and on the Thread's card; what
//             the pane's detail and its list do not hold is reached by a scroll bar that is drawn.
//   Ruling 3: where Deny or Refuse will send the cancelled outcome, a line beside the button says so, in view with the button.
//   Ruling 4: the whole view's Review page stands on the review it drew; when that one leaves it says so and no answer is live.
//   Ruling 5: the tile measures again when a font loads and when its card becomes a command's; a command the tile shows whole keeps
//             Approve whatever its length.
// Channel: LAID OUT, in Chromium with the kit's, the shell's, the panels' and the chat panel's own stylesheets. The Approvals rows are
// the binding's own (receiptBindings.ts queueRows) on FIXTURE consent requests; the views are the designs' own, drawn by React's client.
// No owner is asked and nothing is answered: every set is recorded on the page.
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
import '../../../desktop/cradle/src/agent/panel/panel.css'
import {PlaceContext} from './src/inhabitants/sdk/panel'
import {design} from './src/inhabitants/catalogue/panels/software-factory__approvals'
import {design as thread} from './src/inhabitants/catalogue/panels/thread'
import {queueRows} from './src/agent/devices/receiptBindings'
import {PermissionCardView} from '../../../desktop/cradle/src/agent/chat/PermissionCard'
const place = {onExpand() {}, onPopout() {}, onRail() {}}
const settle = () => new Promise(r => setTimeout(r, 60))
const kept: HTMLElement[] = []
// A face is measured at the page's top left corner, in its view, so that what a pointer meets there can be asked of the page.
const stage = (width: number, height?: number) => {
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;left:0;top:0;width:' + width + 'px;' + (height === undefined ? '' : 'height:' + height + 'px')
  document.body.appendChild(box)
  return box
}
const done = (root: {unmount(): void}, box: HTMLElement, keep?: boolean) => { if (keep) { box.style.position = 'relative'; box.style.margin = '8px'; kept.push(box) } else { root.unmount(); box.remove() } }
const propsOf = (v: any, set: (key: string, value: any) => void, room?: any, more?: any) =>
  ({v, owner: v, set, nav: {full() {}, select() {}, fold() {}, unfold() {}}, page: 'queue', setPage() {}, standing: {}, room, ...more})
const base = {light: 'lit', show: 'all', order: 'oldest', follow: false}
const rectOf = (el: Element) => el.getBoundingClientRect()
const inside = (el: Element, box: Element) => { const r = rectOf(el), o = rectOf(box); return r.width > 0 && r.height > 0 && r.left >= o.left - .5 && r.right <= o.right + .5 && r.top >= o.top - .5 && r.bottom <= o.bottom + .5 }
/** Whether the element is what a pointer meets at the centre of its box (of its first line, where it wraps): drawn, in the page's view
 * and under nothing else. */
const onTop = (el: Element) => { const r = el.getClientRects()[0] ?? rectOf(el), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!at && (at === el || el.contains(at)) }
/** A click where the element's centre is, on whatever stands there. */
const pressAt = (el: Element) => { const r = rectOf(el); (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) as HTMLElement | null)?.click() }
/** The words under root whose drawn boxes lie outside the box sideways: the start of each. */
const sideways = (root: Element, box: Element) => {
  const o = rectOf(box), out: string[] = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walk.nextNode(); node; node = walk.nextNode()) {
    const range = document.createRange()
    range.selectNodeContents(node)
    if ([...range.getClientRects()].some(r => r.width > 0 && (r.left < o.left - .5 || r.right > o.right + .5))) out.push((node.textContent ?? '').slice(0, 24))
  }
  return out
}
const SESSION = {sessionRef: 's', purpose: 'Explain run', agentRef: 'agent:kite', agentName: 'Kite'}
const CHOICES = [{option_id: 'once', label: 'Allow', kind: 'allow_once'}, {option_id: 'always', label: 'Always allow', kind: 'allow_always'}, {option_id: 'no', label: 'Reject', kind: 'reject_once'}]
const asking = (command: string, n: number, choices: any[] = CHOICES) => ({native_request_id: 'req-' + n, native_session_id: 'n', tool_call_id: 'c' + n, raw: {}, provenance: [],
  tool_call: {kind: 'execute', title: 'Bash', rawInput: {command, cwd: '/srv/app'}}, choices})
/** The binding's own rows for these commands. \`bare\`: the requests offer no refusing choice. */
;(window as any).__rows = (commands: string[], bare = false) => queueRows(commands.map((command, n) => asking(command, n, bare ? CHOICES.slice(0, 1) : CHOICES)) as any, SESSION as any)

/** The pane at a size on one chosen request, a second waiting beside it. \`open\`: Show raw opened as a person opens it. What stands
 * where, what a click on each answer sets, and what the detail's scrolled part does. */
;(window as any).__pane = async (width: number, height: number, item: any, opts: {open?: boolean; keep?: boolean} = {}) => {
  const box = stage(width, height), root = createRoot(box), sets: [string, unknown][] = []
  const other = {id: 'other', kind: 'request', who: 'Kite', text: 'ls', where: 'execute'}
  flushSync(() => root.render(h(PlaceContext.Provider, {value: place}, design.full!(propsOf({...base, queue: JSON.stringify([item, other]), pick: item.id}, (key, value) => { sets.push([key, value]) }, {w: width, h: height}) as any))))
  await settle()
  const pane = box.querySelector<HTMLElement>('.ap-pane')!, detail = box.querySelector<HTMLElement>('.ap-detail')!, read = detail.querySelector<HTMLElement>('.ap-read')
  const raw = detail.querySelector<HTMLDetailsElement>('details.ap-raw'), byItself = raw?.open ?? null
  if (opts.open && raw) { raw.open = true; await settle() }
  const buttons = [...detail.querySelectorAll<HTMLButtonElement>('.ap-do button')].map(button => ({text: button.textContent, inPane: inside(button, pane), inDetail: inside(button, detail), top: onTop(button)}))
  const said = (selector: string) => { const el = detail.querySelector<HTMLElement>(selector); return el ? {text: el.textContent, inPane: inside(el, pane), top: onTop(el), outside: !read?.contains(el)} : null }
  const mark = said('.ap-answer .ap-sent'), cancels = said('.ap-answer .ap-cancels')
  const labels = [...detail.querySelectorAll<HTMLButtonElement>('.ap-do button')].map(button => button.scrollWidth <= button.clientWidth && button.scrollHeight <= button.clientHeight && sideways(button, button).length === 0)
  const scroll = read ? {y: getComputedStyle(read).overflowY, over: read.scrollHeight > read.clientHeight, wide: read.scrollWidth > read.clientWidth, bar: read.offsetWidth - read.clientWidth, inDetail: inside(read, detail), tall: read.clientHeight} : null
  const out = {top: sideways(detail, detail), end: [] as string[]}
  // The last three characters of the command against the scrolled part's box, to a hundredth of a pixel.
  const tail = (() => { const what = detail.querySelector('.ap-what')?.firstChild; if (!read || !what || !what.textContent) return null
    const range = document.createRange(); range.setStart(what, what.textContent.length - 3); range.setEnd(what, what.textContent.length)
    const r = range.getBoundingClientRect(), o = rectOf(read); return [range.toString(), r.width > 0 && r.left >= o.left - .01 && r.right <= o.left + read.clientWidth + .01] })()
  // The foot of the scrolled part is reached: its last element stands inside it once it is scrolled to its end.
  let end: boolean | null = null
  if (read) { read.scrollTop = read.scrollHeight; await settle(); const last = read.lastElementChild; end = last ? rectOf(last).bottom <= rectOf(read).bottom + .5 : null; out.end = sideways(detail, detail); read.scrollTop = 0; await settle() }
  for (const button of detail.querySelectorAll('.ap-do button')) pressAt(button)
  const seen = {tail, buttons, labels, sets, mark, cancels, scroll, out, end, byItself, rawOpen: raw?.open ?? null, line: detail.querySelector('.ap-differs')?.textContent ?? null, what: detail.querySelector('.ap-what')?.textContent ?? null,
    cmd: (() => { const cmd = detail.querySelector<HTMLElement>('pre.ap-cmd[aria-label]'); return cmd ? {text: cmd.textContent, whole: cmd.scrollHeight <= cmd.clientHeight} : null })()}
  done(root, box, opts.keep)
  return seen
}

/** The pane's list with many rows: each row keeps its height, and the rows the list does not hold are reached by its scroll bar. */
;(window as any).__list = async (width: number, height: number, count: number) => {
  const box = stage(width, height), root = createRoot(box)
  const queue = Array.from({length: count}, (_, n) => ({id: 'r' + n, kind: 'request', who: 'Kite', text: 'ls ' + n, where: 'execute'}))
  flushSync(() => root.render(h(PlaceContext.Provider, {value: place}, design.full!(propsOf({...base, queue: JSON.stringify(queue), pick: 'r0'}, () => {}, {w: width, h: height}) as any))))
  await settle()
  const list = box.querySelector<HTMLElement>('.ap-list')!, rows = [...list.querySelectorAll<HTMLElement>('.ap-line:not(.ap-line--head)')]
  const seen = {rows: rows.length, heights: [...new Set(rows.map(row => Math.round(rectOf(row).height)))], y: getComputedStyle(list).overflowY, over: list.scrollHeight > list.clientHeight, bar: list.offsetWidth - list.clientWidth - parseFloat(getComputedStyle(list).borderRightWidth), last: false}
  list.scrollTop = list.scrollHeight; await settle()
  seen.last = inside(rows[rows.length - 1], list) && onTop(rows[rows.length - 1])
  done(root, box)
  return seen
}

/** The rail's tile on a queue, at its own width: each card's first button and standing words, whether its buttons and its notes stand
 * inside it, and whether the last card is reached by scrolling. \`pane\`: whether a pane opens from the face. */
;(window as any).__tile = async (queue: any[], opts: {pane?: boolean; spacing?: string; fonts?: boolean; then?: any[]; keep?: boolean; hidden?: boolean; squeeze?: boolean} = {}) => {
  const box = stage(320, 160), root = createRoot(box)
  if (opts.hidden) box.style.display = 'none'
  const draw = (rows: any[]) => flushSync(() => root.render(h(PlaceContext.Provider, {value: place}, design.widget!(propsOf({...base, queue: JSON.stringify(rows)}, () => {}, undefined, opts.pane === false ? {nav: {select() {}, fold() {}, unfold() {}}} : undefined) as any))))
  const read = () => [...box.querySelectorAll<HTMLElement>('.ap-card')].map(card => {
    const words = card.querySelector<HTMLElement>('.ap-card-line--cmd') ?? card.querySelector<HTMLElement>('.ap-card-line span')!
    return {cut: words.scrollWidth > words.clientWidth || words.scrollHeight > words.clientHeight, mark: card.querySelector('.ap-sent')?.textContent ?? null, first: card.querySelector('button')?.textContent ?? null,
      buttons: [...card.querySelectorAll('button')].map(button => [button.textContent, inside(button, card)]), notes: [...card.querySelectorAll<HTMLElement>('.ap-where')].map(note => [note.textContent, inside(note, card), sideways(note, card).length])}
  })
  draw(queue); await settle()
  const first = read()
  // A change of the glyphs' measure that leaves the card's box as it was, and then a font's arrival said by the document.
  let spaced = null, loaded = null
  if (opts.spacing) { for (const line of box.querySelectorAll<HTMLElement>('.ap-card-line--cmd')) line.style.letterSpacing = opts.spacing; await settle(); spaced = read() }
  if (opts.fonts) { document.fonts.dispatchEvent(new Event('loadingdone')); await settle(); loaded = read() }
  let then = null
  let squeezed = null
  if (opts.then) { draw(opts.then); await settle(); then = read() }
  if (opts.squeeze) { const tile = box.querySelector<HTMLElement>('.dp-tile'); if (tile) tile.style.width = '150px'; await settle(); squeezed = read(); if (tile) tile.style.width = ''; await settle() }
  const list = box.querySelector<HTMLElement>('.ap-cards')!, cards = [...box.querySelectorAll<HTMLElement>('.ap-card')]
  list.scrollTop = list.scrollHeight; await settle()
  const lastCard = cards[cards.length - 1], reached = lastCard ? [...lastCard.querySelectorAll('button')].every(button => inside(button, list) && onTop(button)) : null
  done(root, box, opts.keep)
  return {first, spaced, loaded, then, squeezed, reached}
}

/** The whole view's Review page: what it stands on, the answers that are live, the words beside them, and what a press on Recognise
 * sets; then the same after the first review leaves, and after a row is chosen. */
;(window as any).__review = async (pick: string | undefined) => {
  const V = {id: 'rcg-v', kind: 'recognition', who: 'Factory', where: 'Run 8', text: 'Run 8 returned', recognition: {run: 'Run 8', course: 'A course', summary: 'Eight.'}}
  const W = {id: 'rcg-w', kind: 'recognition', who: 'Factory', where: 'Run 9', text: 'Run 9 returned', recognition: {run: 'Run 9', course: 'A course', summary: 'Nine.'}}
  const R = {id: 'req-r', kind: 'request', who: 'Kite', text: 'ls', where: 'execute'}
  const box = stage(760, 330), root = createRoot(box), sets: [string, unknown][] = []
  let queue: any[] = [R, V, W], chosen = pick
  const draw = () => flushSync(() => root.render(h(PlaceContext.Provider, {value: place},
    design.whole!(propsOf({...base, queue: JSON.stringify(queue), ...(chosen === undefined ? {} : {pick: chosen})}, (key, value) => { sets.push([key, value]) }, {w: 760, h: 330}, {page: 'review'}) as any))))
  const stands = () => ({run: (box.textContent ?? '').includes('Run 8') ? 'Run 8' : (box.textContent ?? '').includes('Run 9') ? 'Run 9' : null,
    note: box.querySelector('.ap-where')?.textContent ?? null, said: /no longer in the queue/.test(box.textContent ?? ''), answers: [...box.querySelectorAll<HTMLButtonElement>('.dp-action')].filter(button => !button.disabled).map(button => button.textContent)})
  const recognise = () => { const button = [...box.querySelectorAll<HTMLButtonElement>('.dp-action')].find(el => el.textContent === 'Recognise'); if (button) pressAt(button) }
  draw(); await settle(); await settle()
  const first = stands(); recognise(); await settle()
  const firstSets = sets.slice()
  queue = [R, W]; draw(); await settle(); await settle()
  const left = stands(); recognise(); await settle()
  const leftSets = sets.slice()
  chosen = 'req-r'; draw(); await settle()
  const other = stands()
  chosen = 'rcg-w'; draw(); await settle()
  const again = stands(); recognise(); await settle()
  const seen = {first, firstSets, left, leftSets, other, again, againSets: sets.slice()}
  done(root, box)
  return seen
}

/** The chat's consent card at a width: the words that lie outside it sideways, and whether each button stands inside it. */
;(window as any).__card = async (width: number, command: string, choices: any[], keep?: boolean) => {
  const box = stage(width), root = createRoot(box)
  box.className = 'desktop-shell'
  flushSync(() => root.render(h(PermissionCardView as any, {request: asking(command, 0, choices), agentName: 'Kite', scope: undefined, setScope() {}, onAnswer() {}})))
  await settle()
  const card = box.querySelector<HTMLElement>('.chat-permission')!
  for (const raw of card.querySelectorAll<HTMLDetailsElement>('details')) raw.open = true
  await settle()
  const seen = {outside: sideways(card, card), buttons: [...card.querySelectorAll('button')].map(button => [(button.textContent ?? '').slice(0, 12), inside(button, card)]), inBox: inside(card, box),
    note: (() => { const note = card.querySelector<HTMLElement>('.chat-permission-cancels'); return note ? [note.textContent, inside(note, card)] : null })(), text: card.textContent,
    short: [...card.querySelectorAll('button')].filter(button => (button.textContent ?? '').length < 12).map(button => [button.textContent, rectOf(button).height < 34 && button.scrollWidth <= button.clientWidth])}
  done(root, box, keep)
  return seen
}

/** The Thread's pane on one consent row: the words of its card that lie outside the card sideways, and its buttons. */
;(window as any).__thread = async (width: number, height: number, row: any, keep?: boolean) => {
  const box = stage(width, height), root = createRoot(box)
  flushSync(() => root.render(h(PlaceContext.Provider, {value: place}, thread.full!(propsOf({light: 'lit', thread: JSON.stringify([{who: 'you', kind: 'you', text: 'Go on.'}, row])}, () => {}, {w: width, h: height}) as any))))
  await settle()
  const card = box.querySelector<HTMLElement>('.th-card'), pane = box.querySelector<HTMLElement>('.th-pane')!
  if (card) for (const raw of card.querySelectorAll<HTMLDetailsElement>('details')) raw.open = true
  await settle()
  const seen = card ? {outside: sideways(card, card), inPane: sideways(card, pane), buttons: [...card.querySelectorAll('button')].map(button => [button.textContent, inside(button, card)]), text: card.textContent} : null
  done(root, box, keep)
  return seen
}
/** The faces' fonts changed for the page, as another machine's fonts change them: the shell's two font tokens. null puts them back. */
;(window as any).__font = (ui: string | null, mono: string | null) => {
  const root = document.documentElement.style
  for (const [name, value] of [['--font-ui', ui], ['--font-mono', mono]] as const) { if (value) root.setProperty(name, value); else root.removeProperty(name) }
  document.body.style.fontFamily = ui ?? ''
}
;(window as any).__ready = true
`
const FACES = `:root{--bg-0:#26292d;--bg-1:#33363b;--bg-2:#3f4348;--bg-3:#4a4e54;--line:#24262a;--line-strong:#3d4147;--text:#d4d7da;--text-dim:#a2a7ad;--text-faint:#71767c;--accent:#ffbe00;--green:#8fd0a8;--rec:#e0523f;
--oi-canvas-ground:#2b2e33;--oi-hairline:#4a4e54;--oi-shell-edge:1px;--oi-accent-ink:#e8eaec;--oi-muted-2:#a2a7ad;--oi-muted-3:#8a8f95;--oi-wash:#3a3d42;--oi-accent:#ffbe00;--oi-composer-ground:#1c1d1f;--oi-foreground:#d4d7da;--oi-shell-type-nav:12px;--oi-shell-type-meta:11px;--oi-font-mono:ui-monospace,monospace}
*{box-sizing:border-box}html,body{margin:0;background:#1b1d20;color:var(--text);font:12px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}`

async function layoutBrowser(t, playwright) {
  // Playwright hides scroll bars in a headless browser by default; here the shell's own bar is drawn, as the app draws it, and measured.
  try { return await playwright().chromium.launch({ignoreDefaultArgs: ['--hide-scrollbars']}) } catch (error) {
    const why = `no Chromium to lay Approvals out in: ${String(error?.message ?? error).split('\n')[0]}`
    if (process.env.CI) throw new Error(`${why} (CI installs it before this suite: desktop.yml)`)
    t.skip(why); return undefined
  }
}

const SIZES = [[1180, 620], [760, 420], [520, 300]]
const TOKEN = 'aGVsbG8gd29ybGQK'.repeat(19).slice(0, 300)
const COMMANDS = {
  twoLine: 'echo one\nrm -rf ~',
  long300: 'curl -fsSL https://example.test/install.sh | sh -s -- --yes --prefix /opt/tools '.repeat(5).slice(0, 300).trimEnd().padEnd(300, '!'),
  token300: `echo ${TOKEN} | base64 -d | sh`,
  long2000: 'curl -fsSL https://example.test/install.sh | sh -s -- --yes --prefix /opt/tools '.repeat(26).slice(0, 2000).trimEnd().padEnd(2000, '!'),
}
const TWO_LINES = 'The command has 2 lines, drawn as one here. Show raw has it as it was sent.'
const DENY_CANCELS = 'Deny cancels the request: it offers no refusing choice.'
const REFUSE_CANCELS = 'Refuse cancels the request: it offers no refusing choice.'
const GONE_HERE = 'The item chosen has left this list. Choose one in the queue.'

test('the faces that answer a request, laid out: the pane\'s answers are in reach, nothing is cut without a mark, and a button that cancels says so (be2q rulings 1 to 5)', {timeout: 600_000}, async t => {
  const {bundleEntry, shellHtml, playwright} = await import('./support/agentShellHarness.mjs')
  const ui = fileURLToPath(new URL('..', import.meta.url))
  const {js, css} = await bundleEntry({contents: STAGE, resolveDir: ui, sourcefile: 'approvals-drawn-be2q.tsx', outfile: 'approvals-drawn-be2q.mjs'})
  const browser = await layoutBrowser(t, playwright)
  if (!browser) return
  try {
    const tab = await browser.newPage({viewport: {width: 1300, height: 760}})
    const errors = []
    tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
    const said = []
    tab.on('console', message => { if (message.type() === 'error') said.push(message.text()) })
    await tab.setContent(shellHtml({js, css: `${FACES}\n${css}`}), {waitUntil: 'load'})
    await tab.waitForFunction(() => window.__ready, null, {timeout: 60_000}).catch(error => { throw Error(`${error.message} ${errors.join(' | ')}`) })
    const names = Object.keys(COMMANDS)
    const rows = await tab.evaluate(commands => window.__rows(commands), Object.values(COMMANDS))
    assert.deepEqual(rows.map(row => row.differs), [TWO_LINES, undefined, undefined, undefined], 'the binding says which of them is not shown as sent')
    assert.equal(rows[2].text, COMMANDS.token300)

    // Rulings 1 and 2, the pane at the three sizes, on each command, as it draws itself and with Show raw opened.
    const panes = []
    for (const [width, height] of SIZES) for (const [n, name] of names.entries()) for (const open of [false, true])
      panes.push({row: rows[n], name, height, open, at: `${name} at ${width}x${height}${open ? ', Show raw open' : ''}`, seen: await tab.evaluate(([w, hgt, item, o]) => window.__pane(w, hgt, item, {open: o}), [width, height, rows[n], open])})
    await t.test('ruling 1: in the pane every answer is in reach, whatever the detail holds, and "not as sent" stands with Approve', async () => { for (const {row, name, open, at, seen} of panes) {
      // Every answer stands inside the pane and inside the detail, under nothing, and a click where it stands sets its own key.
      assert.deepEqual(seen.buttons, ['Approve', 'Deny', 'Open'].map(text => ({text, inPane: true, inDetail: true, top: true})), `${at}: each answer is in the pane's box and can be met`)
      assert.deepEqual(seen.sets, [['allowOnce', row.id], ['deny', row.id], ['open', row.id]], `${at}: and a click on each sets its key to the request`)
      if (name === 'twoLine') {
        // The raw form still opens by itself, the line still stands, and "not as sent" is in view beside the answers.
        assert.deepEqual([seen.byItself, seen.rawOpen, seen.line], [true, true, TWO_LINES], `${at}: Show raw opens by itself and the line stands`)
        assert.deepEqual(seen.mark, {text: 'not as sent', inPane: true, top: true, outside: true}, `${at}: "not as sent" stands with Approve, outside the scrolled part`)
      } else {
        assert.deepEqual([seen.byItself, seen.rawOpen, seen.line, seen.mark], [false, open, null, null], `${at}: no line, and Show raw is closed until it is opened`)
      }
    } })
    await t.test('ruling 2: in the pane nothing lies outside the detail, a long word wraps, and what is below is reached by a drawn scroll bar', async () => { for (const {row, name, height, open, at, seen} of panes) {
      // The detail scrolls inside its box; nothing in it lies outside it sideways, before the scroll or at its end.
      assert.ok(seen.scroll, `${at}: the detail has a scrolled part`)
      assert.deepEqual([seen.scroll.y, seen.scroll.wide, seen.scroll.inDetail, seen.end], ['auto', false, true, true], `${at}: it scrolls down and not sideways, inside the detail, and its end is reached`)
      assert.deepEqual(seen.out, {top: [], end: []}, `${at}: no words lie outside the detail's box`)
      assert.deepEqual(seen.tail, [row.text.slice(-3), true], `${at}: the command's last characters stand inside the scrolled part`)
      assert.ok(seen.scroll.tall >= 40, `${at}: the scrolled part keeps room to read in (${seen.scroll.tall} px)`)
      // What the scrolled part does not hold is marked by the shell's scroll bar, which is drawn and takes its 8 px.
      assert.equal(seen.scroll.bar, seen.scroll.over ? 8 : 0, `${at}: a scroll bar stands where there is more below`)
      assert.equal(seen.what, row.text.replace('\n', ' '), `${at}: the whole command stands in the pane (a line break drawn as a space, which the line says)`)
      assert.deepEqual(seen.cmd, {text: 'execute', whole: true}, `${at}: the tool's block is not squeezed`)
      assert.equal(seen.cancels, null, `${at}: the request offers a refusal, so nothing says cancel`)
      if (height === 300 && (open || name !== 'long300')) assert.equal(seen.scroll.over, true, `${at}: more than the short pane holds`)
    }
    // The pane's list: thirty rows in the short pane. A row is not squeezed; the rows below are reached by a drawn scroll bar.
    const list = await tab.evaluate(() => window.__list(520, 300, 30))
    assert.deepEqual(list, {rows: 30, heights: [26], y: 'auto', over: true, bar: 8, last: true})
    })

    // Ruling 3 in the pane: a request that offers no refusing choice. Deny will send the cancelled outcome, and says so beside itself.
    const bare = await tab.evaluate(commands => window.__rows(commands, true), [COMMANDS.twoLine, 'ls'])
    await t.test('ruling 3: where Deny will cancel, the line stands beside it at the pane\'s foot, in view with the answers', async () => {
    assert.deepEqual(bare.map(row => row.denySays), [DENY_CANCELS, DENY_CANCELS])
    assert.deepEqual(rows.map(row => row.denySays), [undefined, undefined, undefined, undefined], 'and a request that offers a refusal carries no such line')
    for (const [width, height] of SIZES) {
      const seen = await tab.evaluate(([w, hgt, item]) => window.__pane(w, hgt, item), [width, height, bare[0]])
      assert.deepEqual(seen.cancels, {text: DENY_CANCELS, inPane: true, top: true, outside: true}, `${width}x${height}: the line stands with Deny`)
      assert.deepEqual(seen.mark, {text: 'not as sent', inPane: true, top: true, outside: true})
      assert.deepEqual(seen.buttons, ['Approve', 'Deny', 'Open'].map(text => ({text, inPane: true, inDetail: true, top: true})), `${width}x${height}: and the answers are still in reach`)
      assert.deepEqual(seen.out, {top: [], end: []})
      assert.ok(seen.scroll.tall >= 24, `${width}x${height}: with both lines at the foot the scrolled part still shows a line or more (${seen.scroll.tall} px)`)
    }

    })
    await t.test('ruling 1: answers in their owner\'s longer words take a second line at the foot and stay in reach', async () => {
    // Ruling 1, a decision in its owner's own words, which are longer than "Approve" and "Deny": in the narrow pane the answers take a
    // second line at the foot and stay inside the detail.
    const unit = {id: 'unit', kind: 'request', who: 'Factory', text: 'The unit stopped at its bound. Resume it or cancel it?', where: 'unit 4', options: {allowOnce: 'Resume bounded work', deny: 'Cancel bounded work'}}
    const asked = await tab.evaluate(([item]) => window.__pane(520, 300, item), [unit])
    assert.deepEqual(asked.buttons, ['Resume bounded work', 'Cancel bounded work', 'Open'].map(text => ({text, inPane: true, inDetail: true, top: true})))
    assert.deepEqual(asked.labels, [true, true, true], 'each answer\'s words stand whole on its button')
    assert.deepEqual([asked.sets, asked.mark, asked.cancels], [[['allowOnce', 'unit'], ['deny', 'unit'], ['open', 'unit']], null, null])
    })

    await t.test('ruling 3: on the tile the line stands inside the card under its buttons, and the buttons stay inside it', async () => {
    // Ruling 3 on the tile: the line stands inside the card under its buttons, with a pane to open and with none; the buttons stay
    // inside the card, and the second card's are reached by scrolling.
    for (const pane of [true, false]) {
      const tile = await tab.evaluate(([queue, p]) => window.__tile(queue, {pane: p}), [bare, pane])
      const where = pane ? 'a pane opens' : 'no pane opens'
      assert.deepEqual(tile.first[1].buttons, [['Approve', true], ['Deny', true], ['Open', true]], `tile, ${where}: the buttons stand inside their card`)
      assert.deepEqual(tile.first[1].notes, [[DENY_CANCELS, true, 0]], `tile, ${where}: the line stands inside the card, whole`)
      assert.deepEqual(tile.first[0].buttons, [['Read as sent', true], ['Deny', true], ['Open', true]])
      assert.deepEqual(tile.first[0].notes, pane ? [[DENY_CANCELS, true, 0]] : [['Not as sent: answer it in the Approvals pane.', true, 0], [DENY_CANCELS, true, 0]])
      assert.equal(tile.reached, true, `tile, ${where}: the last card's buttons are reached by scrolling`)
    }
    })

    // Ruling 5, the length rule on the tile: a command of 81 characters that four lines hold is whole there, and keeps Approve; one
    // that four lines do not hold is cut, whatever the rule would have said.
    const command = n => COMMANDS.long300.slice(0, n).trimEnd().padEnd(n, '!')
    const tileOf = async (text, opts) => tab.evaluate(([queue, o]) => window.__tile(queue, o), [[{id: 'first', kind: 'request', who: 'Kite', text, where: 'execute'}], opts ?? {}])
    const state = card => [card.cut, card.mark, card.first]
    await t.test('ruling 5: the tile calls a command cut only where it does not show it whole, and measures again when a font loads or its words change', async () => {
    assert.deepEqual(state((await tileOf(command(81))).first[0]), [false, null, 'Approve'], '81 characters, shown whole: not "cut short"')
    assert.deepEqual(state((await tileOf(command(120))).first[0]), [true, 'cut short', 'Read as sent'])
    assert.deepEqual(state((await tileOf(command(300))).first[0]), [true, 'cut short', 'Read as sent'])
    // A card with no laid-out box (its tile is not displayed) has measured nothing: the length rule stands in, so a long command has
    // no Approve there, and a short one keeps it.
    assert.deepEqual([(await tileOf(command(300), {hidden: true})).first[0].first, (await tileOf(command(60), {hidden: true})).first[0].first], ['Read as sent', 'Approve'])
    // Ruling 5, a font: the glyphs grow and the card's box stays as it was, so no change of size is seen. When the document says a font
    // has loaded, the card measures again, says the command is cut and has no Approve.
    const font = await tileOf(command(81), {spacing: '3px', fonts: true})
    assert.deepEqual(state(font.first[0]), [false, null, 'Approve'])
    assert.equal(font.spaced[0].cut, true, 'wider glyphs: four lines no longer hold the command')
    assert.deepEqual(state(font.loaded[0]), [true, 'cut short', 'Read as sent'], 'after the font is said to have loaded, the card has measured again')
    // Ruling 5, the card's content: a decision in its owner's words (one line, cut) becomes a request to run those words. The card
    // measures the command's own block, which four lines hold.
    const sixty = command(60)
    const turned = await tab.evaluate(([a, b]) => window.__tile(a, {then: b, squeeze: true}), [[{id: 'x', kind: 'request', who: 'Kite', text: sixty, options: {allowOnce: 'Resume', deny: 'Cancel'}}], [{id: 'x', kind: 'request', who: 'Kite', text: sixty, where: 'execute'}]])
    assert.deepEqual([state(turned.first[0]), state(turned.then[0])], [[true, null, 'Resume'], [false, null, 'Approve']])
    assert.deepEqual(state(turned.squeezed[0]), [true, 'cut short', 'Read as sent'], 'squeezed, it is the command\'s block that is measured')
    })
    await t.test('ruling 4: the Review page holds the return it stands on; when it leaves, the page says so and Recognise does nothing', async () => {

    // Ruling 4, the whole view's Review page. It stands on the first return that waits and holds it; when that one leaves, the next is
    // not put under Recognise: the page says so, no answer is live and a press where Recognise stood sets nothing, until a review or a
    // recognition is chosen. A request chosen on the Queue page is not one.
    for (const pick of [undefined, 'req-r', 'rcg-v']) {
      const seen = await tab.evaluate(p => window.__review(p), pick), at = `Review page, pick ${pick}`
      assert.deepEqual(seen.first, {run: 'Run 8', note: null, said: false, answers: ['Recognise', 'Continue']}, `${at}: it stands on the first return`)
      assert.deepEqual(seen.firstSets, [['recognise', 'rcg-v']])
      assert.deepEqual(seen.left, {run: null, note: GONE_HERE, said: true, answers: []}, `${at}: the return left, and the next is not under Recognise`)
      assert.deepEqual(seen.leftSets, [['recognise', 'rcg-v']], `${at}: a press where Recognise stood sets nothing`)
      assert.deepEqual(seen.other, {run: null, note: GONE_HERE, said: true, answers: []}, `${at}: a request chosen is not a review`)
      assert.deepEqual(seen.again, {run: 'Run 9', note: null, said: false, answers: ['Recognise', 'Continue']}, `${at}: chosen, the next return stands with its answers`)
      assert.deepEqual(seen.againSets, [['recognise', 'rcg-v'], ['recognise', 'rcg-w']])
    }
    })

    // Ruling 2 on the chat's card, at the width of a narrow chat: a 300-character token in the command, a long word as a choice's own
    // label and as a scope. Ruling 3: where the request offers no refusing choice, the line stands in the card beside Refuse.
    const WORD = 'Wholesale'.repeat(34).slice(0, 300)
    const offered = [{option_id: 'a', kind: 'allow_once', label: 'Allow'}, {option_id: 'p', kind: 'allow_project', label: WORD}, {option_id: 'o', label: WORD}]
    await t.test('rulings 2 and 3: on the chat\'s card a long word wraps, every button stands inside it, and Refuse says when it cancels', async () => {
    for (const width of [280, 420]) {
      const card = await tab.evaluate(([w, c, ch]) => window.__card(w, c, ch), [width, COMMANDS.token300, offered])
      assert.deepEqual([card.outside, card.inBox], [[], true], `chat card at ${width} px: no words lie outside the card`)
      assert.ok(card.buttons.length === 5 && card.buttons.every(([, within]) => within), `chat card at ${width} px: every button stands inside it (${JSON.stringify(card.buttons)})`)
      assert.deepEqual(card.short, [['This time', true], ['Allow', true], ['Refuse', true]], `chat card at ${width} px: a short button keeps its words on one line beside a long one`)
      assert.deepEqual(card.note, [REFUSE_CANCELS, true], `chat card at ${width} px: Refuse cancels, said in the card`)
      assert.ok(card.text.includes(TOKEN), 'the whole token stands on the card')
    }
    const plain = await tab.evaluate(([c, ch]) => window.__card(280, c, ch), ['ls', [{option_id: 'a', kind: 'allow_once', label: 'Allow'}, {option_id: 'r', kind: 'reject_once', label: 'Reject'}]])
    assert.equal(plain.note, null, 'a request that offers a refusal: no such line')
    // Ruling 5: two choices that share an id are each drawn, and React is handed no two of them under one key.
    const twins = await tab.evaluate(([c, ch]) => window.__card(280, c, ch), ['ls', [{option_id: 'x', kind: 'allow_once', label: 'Once'}, {option_id: 'x', kind: 'allow_always', label: 'Always'}, {option_id: 'y', label: 'First'}, {option_id: 'y', label: 'Second'}]])
    assert.deepEqual(twins.buttons.map(([words]) => words), ['This time', 'Always', 'Allow', 'First', 'Second', 'Refuse'])
    assert.deepEqual(said.filter(words => /same key/.test(words)), [], 'no two children under one key')
    })

    // Ruling 2 on the Thread's card, in a narrow pane: an unbroken 80-character target, the line, and the raw form with the token.
    const threadRow = {who: 'Kite', kind: 'proposal', text: 'Kite wants to run a command', tool: `${TOKEN.slice(0, 80)}\u{2026}`, note: 'What it asks is cut short here. Show raw has it as it was sent.',
      raw: JSON.stringify({tool_call: {kind: 'execute', rawInput: {command: COMMANDS.token300}}}, null, 1), request: 'req-0'}
    await t.test('ruling 2: on the Thread\'s card a long word wraps and nothing lies outside it', async () => {
    for (const width of [300, 520]) {
      const card = await tab.evaluate(([w, row]) => window.__thread(w, 300, row), [width, threadRow])
      assert.ok(card, `Thread at ${width} px: the card is drawn`)
      assert.deepEqual([card.outside, card.inPane], [[], []], `Thread card at ${width} px: no words lie outside the card or the pane`)
      assert.deepEqual(card.buttons, [['Approve', true], ['Changes', true], ['Diff', true]], `Thread card at ${width} px: its buttons stand inside it`)
    }
    })
    // Ruling 2 on another machine's fonts (be2q-2; DLW build ruling 2026-11-12). The detail's column is a fraction of a pixel wide
    // (760 px / 2.15), so a line broken inside the token can end between two whole pixels: under Arial's widths (Liberation Sans on the
    // Linux runner has the same) the command's block then measured one pixel wider than itself, and the scrolled part could be moved
    // sideways. Under each font: the pane at 760x420 and beside it, every command, raw closed and open; the chat card; the Thread's card.
    await t.test('ruling 2 under other fonts: the scrolled part cannot move sideways, and no card lets a word out', async () => {
      for (const [ui, mono] of [['Arial, "Liberation Sans", sans-serif', '"Courier New", "Liberation Mono", monospace'], ['"Gill Sans", "DejaVu Sans", sans-serif', 'monospace'], ['"Times New Roman", serif', 'monospace']]) {
        await tab.evaluate(([a, b]) => window.__font(a, b), [ui, mono])
        try {
          for (const [width, height] of [[760, 420], [759, 420], [761, 420], [700, 420], [800, 420], [520, 300], [1180, 620]]) for (const [n, name] of names.entries()) for (const open of [false, true]) {
            const seen = await tab.evaluate(([w, hgt, item, o]) => window.__pane(w, hgt, item, {open: o}), [width, height, rows[n], open]), at = `${ui.split(',')[0]}: ${name} at ${width}x${height}${open ? ', Show raw open' : ''}`
            assert.deepEqual([seen.scroll.y, seen.scroll.wide, seen.scroll.inDetail, seen.end], ['auto', false, true, true], `${at}: it scrolls down and not sideways, inside the detail, and its end is reached`)
            assert.deepEqual([seen.out, seen.tail], [{top: [], end: []}, [rows[n].text.slice(-3), true]], `${at}: nothing lies outside, and the command's last characters stand inside the scrolled part`)
            assert.deepEqual(seen.buttons, ['Approve', 'Deny', 'Open'].map(text => ({text, inPane: true, inDetail: true, top: true})), `${at}: the answers are in reach`)
          }
          for (const width of [280, 281, 420]) {
            const card = await tab.evaluate(([w, c, ch]) => window.__card(w, c, ch), [width, COMMANDS.token300, offered])
            assert.deepEqual([card.outside, card.inBox, card.buttons.every(([, within]) => within), card.short.every(([, whole]) => whole)], [[], true, true, true], `${ui.split(',')[0]}: chat card at ${width} px`)
          }
          for (const width of [300, 301, 520]) {
            const card = await tab.evaluate(([w, row]) => window.__thread(w, 300, row), [width, threadRow])
            assert.deepEqual([card.outside, card.inPane, card.buttons], [[], [], [['Approve', true], ['Changes', true], ['Diff', true]]], `${ui.split(',')[0]}: Thread card at ${width} px`)
          }
        } finally { await tab.evaluate(() => window.__font(null, null)) }
      }
    })
    assert.deepEqual(errors, [])

    const out = process.env.APPROVALS_DRAWN_CAPTURE
    if (out) {
      mkdirSync(out, {recursive: true})
      const shot = async name => { writeFileSync(`${out}/be2q-${name}.png`, await tab.screenshot({fullPage: true})); await tab.evaluate(() => { for (const box of document.querySelectorAll('body > div:not(#root)')) box.remove() }) }
      for (const [width, height] of SIZES) {
        for (const n of [0, 2]) await tab.evaluate(([w, hgt, item]) => window.__pane(w, hgt, item, {keep: true}), [width, height, n === 0 ? bare[0] : rows[n]])
        await tab.evaluate(([w, hgt, item]) => window.__pane(w, hgt, item, {open: true, keep: true}), [width, height, rows[1]])
        await shot(`pane-${width}x${height}`)
      }
      await tab.evaluate(([queue]) => window.__tile(queue, {keep: true}), [bare])
      await tab.evaluate(([queue]) => window.__tile(queue, {pane: false, keep: true}), [bare])
      await tab.evaluate(([w, c, ch]) => window.__card(w, c, ch, true), [280, COMMANDS.token300, offered])
      await tab.evaluate(([w, row]) => window.__thread(w, 300, row, true), [300, threadRow])
      await shot('tile-card-thread')
      // The row that failed on the Linux runner, under Arial's widths: the token and the raw form at 760x420.
      await tab.evaluate(() => window.__font('Arial, "Liberation Sans", sans-serif', '"Courier New", "Liberation Mono", monospace'))
      await tab.evaluate(([item]) => window.__pane(760, 420, item, {keep: true}), [rows[2]])
      await tab.evaluate(([item]) => window.__pane(760, 420, item, {open: true, keep: true}), [rows[2]])
      await shot('pane-arial-760x420')
      await tab.evaluate(() => window.__font(null, null))
    }
  } finally { await browser.close() }
})
