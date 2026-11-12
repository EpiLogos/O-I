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
// be2r (DLW build ruling 2026-11-12), the follow-ups of the review of O-I #971, on the same faces:
//   Ruling 1: the pane has a floor. A pane too short for its lake, the scrolled part's least height and the answers scrolls as a
//             whole; a real mouse wheel reaches every answer and a real click presses it, at 900x200, 416x240, 380x210, 260x150 and a
//             device window's least room (400x254), under this machine's fonts and the carried ones.
//   Ruling 2: an approving button that will send an always-allow is named for it on the Thread's card and the answer's face.
//   Ruling 3: the answer's Decline says beside itself when it will send the cancelled outcome.
//   Ruling 4: the Review page's hold outlives the page: left and come back to, it stands on the same return or says it has left.
//   Ruling 5: the pane's list keeps its About column in a narrow pane; a button's name on the Thread's card is not broken.
// be2s (DLW build ruling 2026-11-12), the follow-ups of the review of O-I #972, on the same faces:
//   Ruling 1: the shell's least pane is the upper half of a device window's room (400x127 at the least window). There, and at
//             260x150, an approving answer is live only where the first line of the request is in view with it; where the pane
//             cannot hold that, it is not live and standing words say to make the window or the pane taller.
//   Ruling 2: a wheel over the request or the list moves the pane first: three notches at the most bring the answers into view.
//   Ruling 3: the floor holds with no size containment (dropped before Safari 15.4). Laid out in Chromium only.
//   Ruling 4: "Approve always" stands whole on the Thread's card down to a pane of 160 px.
//   (Ruling 5, what a plain approving button sends, is read in Node: chat-presentation, factory-thread-binding, factory-receipts-binding.)
// Channel: LAID OUT, in Chromium with the kit's, the shell's, the panels' and the chat panel's own stylesheets. The Approvals rows are
// the binding's own (receiptBindings.ts queueRows) on FIXTURE consent requests; the views are the designs' own, drawn by React's client.
// No owner is asked and nothing is answered: every set is recorded on the page.
import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {brotliDecompressSync} from 'node:zlib'
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
import {popoutOf} from './src/inhabitants/catalogue/panels/popout'
import {design as thread} from './src/inhabitants/catalogue/panels/thread'
import {AnswerPane} from './src/inhabitants/catalogue/panels/agent-answer'
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
/** Every character drawn in a part that is measured (the pane's list and detail, the chat's card, the Thread's card), for the test to
 * hold against what the carried font files hold. */
const drawn = new Set<string>()
;(window as any).__drawn = (clear?: boolean) => { const all = [...drawn].join(''); if (clear) drawn.clear(); return all }
/** The characters no carried face holds, where the test names some (be2q-4): each stands in a box of a fixed width and height set here,
 * so that whatever font a machine falls back to for it, the line it stands on breaks at the same place and is as tall. */
let boxed = ''
;(window as any).__box = (chars: string) => { boxed = chars }
const MEASURED = '.ap-body, .chat-permission, .th-card'
const boxThem = (box: Element) => {
  if (!boxed) return
  for (const part of box.querySelectorAll(MEASURED)) {
    const walk = document.createTreeWalker(part, NodeFilter.SHOW_TEXT), texts: Text[] = []
    for (let node = walk.nextNode(); node; node = walk.nextNode()) texts.push(node as Text)
    for (let rest of texts) for (;;) {
      const at = [...rest.data].findIndex(ch => boxed.includes(ch))
      if (at < 0) break
      const odd = rest.splitText(at), span = document.createElement('span')
      rest = odd.splitText(1)
      span.dataset.boxed = 'true'
      span.style.cssText = 'display:inline-block;width:4px;height:6px;overflow:hidden'
      odd.replaceWith(span); span.appendChild(odd)
    }
  }
}
const done = (root: {unmount(): void}, box: HTMLElement, keep?: boolean) => {
  for (const part of box.querySelectorAll(MEASURED)) { const walk = document.createTreeWalker(part, NodeFilter.SHOW_TEXT)
    for (let node = walk.nextNode(); node; node = walk.nextNode()) if (!node.parentElement?.dataset.boxed) for (const ch of node.textContent ?? '') drawn.add(ch) }
  if (keep) { box.style.position = 'relative'; box.style.margin = '8px'; kept.push(box) } else { root.unmount(); box.remove() } }
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
/** The words under root that are drawn broken inside themselves: each word (a run with no space) that stands on more than one line. */
const brokenWords = (root: Element) => {
  const out: string[] = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walk.nextNode(); node; node = walk.nextNode()) for (const found of (node.textContent ?? '').matchAll(/[^ ]+/g)) {
    const range = document.createRange(); range.setStart(node, found.index!); range.setEnd(node, found.index! + found[0].length)
    if (new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size > 1) out.push(found[0].slice(0, 24))
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
;(window as any).__pane = async (width: number, height: number, item: any, opts: {open?: boolean; keep?: boolean; atEnd?: boolean} = {}) => {
  const box = stage(width, height), root = createRoot(box), sets: [string, unknown][] = []
  const other = {id: 'other', kind: 'request', who: 'Kite', text: 'ls', where: 'execute'}
  flushSync(() => root.render(h(PlaceContext.Provider, {value: place}, design.full!(propsOf({...base, queue: JSON.stringify([item, other]), pick: item.id}, (key, value) => { sets.push([key, value]) }, {w: width, h: height}) as any))))
  await settle()
  boxThem(box)
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
  // The foot of the scrolled part is reached: its last element stands inside it once it is scrolled to its end, to within one pixel
  // (be2q-3; DLW build ruling 2026-11-12). The browser scrolls by whole pixels between two whole numbers: the scrolled part's height
  // and its content's, each rounded from a fraction (the part is 78.5 px tall where a 14.5 px line stands at the foot, and reads as
  // 79). Each rounding can leave half a pixel, so the last block's box can end up to one pixel under the part's foot, in the empty
  // space under its last line of words: measured at 0.94 px, on the Linux runner and here. A line that could not be read lies 16 px under.
  let end: boolean | null = null
  if (read) { read.scrollTop = read.scrollHeight; await settle(); const last = read.lastElementChild; end = last ? rectOf(last).bottom < rectOf(read).bottom + 1 : null; out.end = sideways(detail, detail); read.scrollTop = 0; await settle() }
  for (const button of detail.querySelectorAll('.ap-do button')) pressAt(button)
  const seen = {tail, buttons, labels, sets, mark, cancels, scroll, out, end, byItself, rawOpen: raw?.open ?? null, line: detail.querySelector('.ap-differs')?.textContent ?? null, what: detail.querySelector('.ap-what')?.textContent ?? null,
    cmd: (() => { const cmd = detail.querySelector<HTMLElement>('pre.ap-cmd[aria-label]'); return cmd ? {text: cmd.textContent, whole: cmd.scrollHeight <= cmd.clientHeight} : null })()}
  if (opts.atEnd && read) read.scrollTop = read.scrollHeight
  done(root, box, opts.keep)
  return seen
}

/** The pane's list with many rows: each row keeps its height, and the rows the list does not hold are reached by its scroll bar. */
;(window as any).__list = async (width: number, height: number, count: number, first?: any) => {
  const box = stage(width, height), root = createRoot(box)
  const queue = [...(first ? [first] : []), ...Array.from({length: count}, (_, n) => ({id: 'r' + n, kind: 'request', who: 'Kite', text: 'ls ' + n, where: 'execute'}))]
  flushSync(() => root.render(h(PlaceContext.Provider, {value: place}, design.full!(propsOf({...base, queue: JSON.stringify(queue), pick: 'r0'}, () => {}, {w: width, h: height}) as any))))
  await settle()
  const list = box.querySelector<HTMLElement>('.ap-list')!, rows = [...list.querySelectorAll<HTMLElement>('.ap-line:not(.ap-line--head)')]
  // be2r ruling 5: every cell of a row and of the head stands inside its row, and the About cell has a width.
  const cells = [...list.querySelectorAll<HTMLElement>('.ap-line')].map(row => [...row.children].every(cell => { const r = rectOf(cell), o = rectOf(row); return r.left >= o.left - .5 && r.right <= o.right + .5 }))
  const flag = first ? rows[0].querySelector<HTMLElement>('.ap-flag')! : null
  const seen = {...(flag ? {flag: [flag.textContent, flag.scrollWidth <= flag.clientWidth]} : {}), about: Math.floor(Math.min(...rows.map(row => row.querySelector<HTMLElement>('.ap-text')!.clientWidth))), cells: cells.every(Boolean),
    rows: rows.length, heights: [...new Set(rows.map(row => Math.round(rectOf(row).height)))], y: getComputedStyle(list).overflowY, over: list.scrollHeight > list.clientHeight, bar: list.offsetWidth - list.clientWidth - parseFloat(getComputedStyle(list).borderRightWidth), last: false}
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
  // Drawn twice: a page drawn again on the same return tells the shell nothing more (be2r ruling 4).
  draw(); await settle(); await settle(); draw(); await settle()
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

/** be2r ruling 4: the Review page left and come back to, on a shell that holds the page's key (\`reviewing\`) as it holds \`pick\`. The
 * page is taken down each time it is left (the Queue page is drawn in its place). What it stands on at each return, and what a real
 * click at the point where Recognise first stood sets. */
;(window as any).__returns = async () => {
  const V = {id: 'rcg-v', kind: 'recognition', who: 'Factory', where: 'Run 8', text: 'Run 8 returned', recognition: {run: 'Run 8', course: 'A course', summary: 'Eight.'}}
  const W = {id: 'rcg-w', kind: 'recognition', who: 'Factory', where: 'Run 9', text: 'Run 9 returned', recognition: {run: 'Run 9', course: 'A course', summary: 'Nine.'}}
  const R = {id: 'req-r', kind: 'request', who: 'Kite', text: 'ls', where: 'execute'}
  const box = stage(760, 330), root = createRoot(box), sets: [string, unknown][] = [], held: Record<string, unknown> = {}
  let queue: any[] = [R, V, W], page = 'review'
  const draw = () => flushSync(() => root.render(h(PlaceContext.Provider, {value: place},
    design.whole!(propsOf({...base, queue: JSON.stringify(queue), ...held}, (key, value) => { sets.push([key, value]); if (key === 'reviewing' || key === 'pick') held[key] = value }, {w: 760, h: 330}, {page}) as any))))
  const stands = () => ({run: (box.textContent ?? '').includes('Run 8') ? 'Run 8' : (box.textContent ?? '').includes('Run 9') ? 'Run 9' : null,
    note: box.querySelector('.ap-where')?.textContent ?? null, said: /no longer in the queue/.test(box.textContent ?? ''), answers: [...box.querySelectorAll<HTMLButtonElement>('.dp-action')].filter(button => !button.disabled).map(button => button.textContent)})
  const show = async (to: string) => { page = to; draw(); await settle(); draw(); await settle() }
  await show('review')
  const first = stands(), button = [...box.querySelectorAll<HTMLButtonElement>('.dp-action')].find(el => el.textContent === 'Recognise')!, r = rectOf(button)
  const point = [r.left + r.width / 2, r.top + r.height / 2]
  const steps: Record<string, unknown> = {first, point}
  /** Leave for the Queue page, let the queue change there, and come back. */
  const away = async (name: string, next: string) => { await show('queue'); const left = !(box.textContent ?? '').includes('Eight.'); queue = [...next].map(letter => ({R, V, W})[letter]); await show('review'); steps[name] = {...stands(), left} }
  ;(window as any).__away = away
  ;(window as any).__steps = () => ({...steps, sets: sets.slice()})
  ;(window as any).__choose = async (id: string) => { held.pick = id; await show('review'); steps.chosen = stands() }
  ;(window as any).__over = () => { done(root, box) }
  return steps
}

/** be2r rulings 2 and 3 on the answer's face, in its pane: the proposal's card, its buttons' names (whole, on one line, inside the card)
 * and the standing note beside them. */
;(window as any).__answer = async (width: number, height: number, row: any, keep?: boolean) => {
  const box = stage(width, height), root = createRoot(box)
  flushSync(() => root.render(h(PlaceContext.Provider, {value: place}, h(AnswerPane as any, {p: propsOf({light: 'lit', agent: 'Kite', thread: JSON.stringify([{who: 'you', kind: 'you', text: 'Go on.'}, row])}, () => {}, {w: width, h: height}), run: 'waiting'}))))
  await settle()
  const card = [...box.querySelectorAll<HTMLElement>('.an-card')].pop(), chat = box.querySelector<HTMLElement>('.an-chat')
  const seen = card && chat ? {outside: sideways(card, card), inChat: sideways(card, chat), buttons: [...card.querySelectorAll('button')].map(button => [button.textContent, inside(button, card) && onTop(button)]),
    broken: [...card.querySelectorAll('button')].flatMap(button => (button.scrollWidth > button.clientWidth ? [button.textContent] : brokenWords(button))),
    notes: [...card.querySelectorAll<HTMLElement>('.an-card-cancels')].map(note => [note.textContent, inside(note, card) && onTop(note)])} : null
  done(root, box, keep)
  return seen
}

/** The chat's consent card at a width: the words that lie outside it sideways, and whether each button stands inside it. */
;(window as any).__card = async (width: number, command: string, choices: any[], keep?: boolean) => {
  const box = stage(width), root = createRoot(box)
  box.className = 'desktop-shell'
  flushSync(() => root.render(h(PermissionCardView as any, {request: asking(command, 0, choices), agentName: 'Kite', scope: undefined, setScope() {}, onAnswer() {}})))
  await settle()
  boxThem(box)
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
  boxThem(box)
  const card = box.querySelector<HTMLElement>('.th-card'), pane = box.querySelector<HTMLElement>('.th-pane')!
  if (card) for (const raw of card.querySelectorAll<HTMLDetailsElement>('details')) raw.open = true
  await settle()
  const seen = card ? {outside: sideways(card, card), inPane: sideways(card, pane), buttons: [...card.querySelectorAll('button')].map(button => [button.textContent, inside(button, card)]), text: card.textContent,
    // be2r ruling 5: no button's name is broken inside itself or cut by its button.
    broken: [...card.querySelectorAll('button')].flatMap(button => (button.scrollWidth > button.clientWidth ? [button.textContent] : brokenWords(button))),
    // be2s ruling 4: the buttons whose name is not all drawn inside the button's own box (a word of it under the button's foot, or cut).
    cut: [...card.querySelectorAll('button')].filter(button => { const range = document.createRange(); range.selectNodeContents(button); const o = rectOf(button)
      return button.scrollHeight > button.clientHeight || button.scrollWidth > button.clientWidth || [...range.getClientRects()].some(r => r.width > 0 && (r.top < o.top - .5 || r.bottom > o.bottom + .5 || r.left < o.left - .5 || r.right > o.right + .5)) }).map(button => button.textContent),
    lines: [...card.querySelectorAll('button')].map(button => Math.round(rectOf(button).height))} : null
  done(root, box, keep)
  return seen
}
/** be2r ruling 1: the pane at a size on one chosen request, left standing at the page's corner so that a real pointer can meet it
 * (the test's own mouse wheels over it and clicks its answers). What is seen before any wheel: the scrolled part's own height, whether
 * a line of the command and the "not as sent" sentence can each be brought whole into it by its own scroll, and where a pointer
 * over the detail would be. */
let stood: {root: {unmount(): void}; box: HTMLElement; sets: [string, unknown][]} | null = null
const still = async (els: (HTMLElement | null)[]) => { let was = ''; for (let n = 0; n < 60; n++) { await new Promise(r => setTimeout(r, 25)); const now = els.map(el => el?.scrollTop).join(); if (now === was) return; was = now } }
/** A wheel that is about to turn over the pane: its scroll is waited for by the browser's own word that it has ended (\`scrollend\`),
 * not by a guess at how long it takes, so a slow machine is not read as a pane that did not move. A wheel that moves nothing (the
 * end is reached) is given up on after two seconds; the test turns no wheel where nothing can scroll further (\`more\`). */
let wheeled: Promise<void> | null = null
;(window as any).__arm = () => { const {box} = stood!
  wheeled = new Promise<void>(resolve => { const end = () => { box.removeEventListener('scrollend', end, true); resolve() }; box.addEventListener('scrollend', end, true); setTimeout(end, 2000) }) }
const look = async () => {
  const {box, sets} = stood!, pane = box.querySelector<HTMLElement>('.ap-pane')!, detail = box.querySelector<HTMLElement>('.ap-detail')!, read = detail.querySelector<HTMLElement>('.ap-read')
  if (wheeled) { await wheeled; wheeled = null }
  await still([pane, detail, read])
  const p = rectOf(pane), d = rectOf(detail)
  /** How much of the element's height is drawn inside the pane's box. */
  const shown = (el: Element) => { const r = rectOf(el); return Math.max(0, Math.min(r.bottom, p.bottom) - Math.max(r.top, p.top)) }
  const buttons = [...detail.querySelectorAll<HTMLButtonElement>('.ap-do button')].map(button => { const r = rectOf(button)
    return {text: button.textContent, inPane: inside(button, pane), inDetail: inside(button, detail), top: onTop(button), x: r.left + r.width / 2, y: r.top + r.height / 2, live: !button.disabled} })
  const said = (selector: string) => { const el = detail.querySelector<HTMLElement>(selector); return el ? {text: el.textContent, inPane: inside(el, pane), top: onTop(el), outside: !read?.contains(el)} : null }
  // be2s ruling 1: the words that say the pane is too short for its approving answer, and the room the pane has for the first
  // line of the item beside the answers, without those words.
  const answer = detail.querySelector<HTMLElement>('.ap-answer'), note = detail.querySelector<HTMLElement>('.ap-answer .ap-short')
  const lineOf = () => { const words = read?.querySelector('.ap-what')?.firstChild; if (!words) return null; const range = document.createRange(); range.selectNodeContents(words); return range.getClientRects()[0] ?? null }
  const line = lineOf()
  // What the pane's height leaves over everything from the top of the first line of what the item is down to the detail's foot.
  const what = read?.querySelector('.ap-what')
  const tight = read && answer && what ? pane.clientHeight - (d.bottom - rectOf(what).top - (note ? rectOf(note).height + parseFloat(getComputedStyle(answer).rowGap) : 0)) : null
  // Whether that line stands whole inside the scrolled part's box, as the part stands (not scrolled by anyone).
  const held = !!read && !!line && line.top >= rectOf(read).top - .5 && line.bottom <= rectOf(read).bottom + .5
  // be2s ruling 3: the parts of the pane that are size-contained (none: the floor holds without it).
  const contained = [pane, ...pane.querySelectorAll('*')].filter(el => /size|strict|content/.test(getComputedStyle(el).contain)).map(el => el.className)
  const bar = (el: HTMLElement) => ({y: getComputedStyle(el).overflowY, over: el.scrollHeight > el.clientHeight, bar: el.offsetWidth - el.clientWidth - parseFloat(getComputedStyle(el).borderRightWidth) - parseFloat(getComputedStyle(el).borderLeftWidth), at: el.scrollTop})
  // Where a pointer over the detail is: the middle of the part of it the pane shows, or the pane's middle where it shows none of it.
  const top = Math.max(d.top, p.top), bottom = Math.min(d.bottom, p.bottom)
  const at = bottom > top ? [d.left + d.width / 2, (top + bottom) / 2] : [p.left + p.width / 2, p.top + p.height / 2]
  // Whether a wheel can still move something down: the pane, the detail or the scrolled part, where it scrolls and is not at its end.
  const more = [pane, detail, read].some(el => !!el && /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  return {more, buttons, mark: said('.ap-answer .ap-sent'), cancels: said('.ap-answer .ap-cancels'), short: said('.ap-answer .ap-short'), tight, held, contained, at, sets: sets.slice(), out: sideways(detail, detail),
    read: read ? {tall: read.clientHeight, shown: shown(read), ...bar(read)} : null, pane: bar(pane), detail: bar(detail), wide: pane.scrollWidth > pane.clientWidth && getComputedStyle(pane).overflowX !== 'hidden',
    head: brokenWords(detail.querySelector('.ap-detail-head')!),
    rawOpen: detail.querySelector<HTMLDetailsElement>('details.ap-raw')?.open ?? null, line: detail.querySelector('.ap-differs')?.textContent ?? null}
}
/** \`opts.win\` (be2s ruling 1): the size is a device window's room, and what is drawn in it is what the host draws there for a design
 * with no pop-out of its own (panels/popout.tsx popoutOf): the pane over the Device view, which takes half the room up to its own
 * height. \`opts.count\`: that many more requests wait in the list. */
;(window as any).__stand = async (width: number, height: number, item: any, open = false, opts: {win?: boolean; count?: number} = {}) => {
  const box = stage(width, height), root = createRoot(box), sets: [string, unknown][] = []
  const others = Array.from({length: opts.count ?? 1}, (_, n) => ({id: n ? 'other' + n : 'other', kind: 'request', who: 'Kite', text: n ? 'ls ' + n : 'ls', where: 'execute'}))
  const props = propsOf({...base, queue: JSON.stringify([item, ...others]), pick: item.id}, (key, value) => { sets.push([key, value]) }, {w: width, h: height}) as any
  // A window shows nothing outside its room.
  if (opts.win) box.style.overflow = 'hidden'
  flushSync(() => root.render(h(PlaceContext.Provider, {value: place}, opts.win ? popoutOf(design as any, props, {w: width, h: height}) : design.full!(props))))
  stood = {root, box, sets}
  await settle()
  boxThem(box)
  const detail = box.querySelector<HTMLElement>('.ap-detail')!, read = detail.querySelector<HTMLElement>('.ap-read'), raw = detail.querySelector<HTMLDetailsElement>('details.ap-raw'), byItself = raw?.open ?? null
  if (open && raw) { raw.open = true; await settle() }
  // A line of the command, and of the sentence that says it is not as sent, brought into the scrolled part by its own scroll.
  const reads: Record<string, boolean | null> = {}
  for (const [name, selector] of [['what', '.ap-what'], ['line', '.ap-differs']]) {
    const el = read?.querySelector<HTMLElement>(selector), words = el?.firstChild
    if (!read || !el || !words) { reads[name] = null; continue }
    read.scrollTop += rectOf(el).top - rectOf(read).top
    const range = document.createRange(); range.selectNodeContents(words)
    const first = range.getClientRects()[0], o = rectOf(read)
    reads[name] = !!first && first.height > 0 && first.top >= o.top - .5 && first.bottom <= o.bottom + .5
    read.scrollTop = 0
  }
  return {...await look(), byItself, reads}
}
;(window as any).__look = look
/** be2s ruling 1: the pane moved by script through every scroll position it has. At each one where the approving answer is live, in
 * the pane's box and under nothing, how much of the scrolled part's box the pane shows, and whether "not as sent" is in view where
 * the item carries it. The least of the first, whether the second held at every one, and how many such positions there were; and
 * whether the words that say the pane is too short are whole in view with that answer at some position. The pane is put back. */
;(window as any).__sweep = () => {
  const {box} = stood!, pane = box.querySelector<HTMLElement>('.ap-pane')!, detail = box.querySelector<HTMLElement>('.ap-detail')!, read = detail.querySelector<HTMLElement>('.ap-read')!
  const first = detail.querySelector<HTMLButtonElement>('.ap-do button')!, mark = detail.querySelector<HTMLElement>('.ap-answer .ap-sent'), was = pane.scrollTop, read0 = read.scrollTop
  // The scrolled part as it stands when nobody has scrolled it: at its top.
  read.scrollTop = 0
  const note = detail.querySelector<HTMLElement>('.ap-answer .ap-short')
  const words = read.querySelector('.ap-what')!.firstChild!, range = document.createRange(); range.selectNodeContents(words)
  let least: number | null = null, marked = true, met = 0, noted = false, lined = true
  for (let y = 0; y <= Math.max(0, pane.scrollHeight - pane.clientHeight); y++) {
    pane.scrollTop = y
    // The words that say the pane is too short, whole in view together with the answer they are about.
    if (note && inside(note, pane) && onTop(note) && inside(first, pane) && onTop(first)) noted = true
    if (first.disabled || !inside(first, pane) || !onTop(first)) continue
    const p = rectOf(pane), r = rectOf(read), shown = Math.max(0, Math.min(r.bottom, p.bottom) - Math.max(r.top, p.top))
    met += 1; least = least === null ? shown : Math.min(least, shown)
    // The first line of what the item is, whole inside the scrolled part's box and inside the pane's.
    const line = range.getClientRects()[0]
    if (!line || line.top < Math.max(r.top, p.top) - .5 || line.bottom > Math.min(r.bottom, p.bottom) + .5) lined = false
    if (mark && !(inside(mark, pane) && onTop(mark))) marked = false
  }
  pane.scrollTop = was; read.scrollTop = read0
  return {least, marked, met, noted, lined}
}
/** be2s ruling 2: where a pointer is over a part of the pane: the middle of what the pane shows of it. */
/** be2s ruling 1: the pane's box made as tall as given, as a pane is made taller by its edge; what is seen then. */
;(window as any).__tall = async (height: number) => { stood!.box.style.height = height + 'px'; await settle(); return look() }
/** be2s ruling 2: a wheel event of the page's own making over a part of the pane (a pinch, a sideways turn, a turn counted in lines
 * or in pages, which a real mouse here does not send): whether the pane took it from the browser, and where the pane and the
 * scrolled part then stand. */
;(window as any).__turn = async (selector: string, init: any) => {
  const event = new WheelEvent('wheel', {bubbles: true, cancelable: true, ...init})
  stood!.box.querySelector(selector)!.dispatchEvent(event); await settle()
  const seen = await look()
  return {taken: event.defaultPrevented, pane: seen.pane.at, read: seen.read!.at}
}
/** Whether the last wheel the page met was taken from the browser by the pane. */
let taken: boolean | null = null
window.addEventListener('wheel', event => { taken = event.defaultPrevented })
;(window as any).__taken = () => taken
;(window as any).__point = (selector: string) => {
  const {box} = stood!, pane = box.querySelector<HTMLElement>('.ap-pane')!, el = box.querySelector<HTMLElement>(selector)
  if (!el) return null
  const p = rectOf(pane), r = rectOf(el), top = Math.max(r.top, p.top), bottom = Math.min(r.bottom, p.bottom), left = Math.max(r.left, p.left), right = Math.min(r.right, p.right)
  return bottom > top && right > left ? [(left + right) / 2, (top + bottom) / 2] : null
}
;(window as any).__unstand = (keep?: boolean) => { const {root, box, sets} = stood!; stood = null; done(root, box, keep); return sets }

/** The width of one line of plain words in a family, at a size: a measure of the layout, by which the test sees that a carried face
 * and its glyph width are the ones drawn. */
;(window as any).__wide = async (family: string) => {
  await Promise.all(['11px', '600 12px', '10.5px'].map(size => document.fonts.load(size + ' ' + family, 'The quick brown fox | {jumps}\u2014\u2026')))
  const line = document.createElement('span')
  line.style.cssText = 'position:fixed;left:0;top:0;white-space:nowrap;font:100px ' + family
  line.textContent = 'The quick brown fox jumps over the lazy dog 0123456789'
  document.body.appendChild(line)
  const width = rectOf(line).width
  line.remove()
  return width
}
/** The faces' fonts changed for the page, as another machine's fonts change them: the shell's two font tokens and the chat panel's two
 * (its card draws a command in its own), so no face of a row is left on a machine's font. null puts them back. */
;(window as any).__font = (ui: string | null, mono: string | null) => {
  const root = document.documentElement.style
  for (const [name, value] of [['--font-ui', ui], ['--font-mono', mono], ['--oi-font-sans', ui], ['--oi-font-mono', mono]] as const) { if (value) root.setProperty(name, value); else root.removeProperty(name) }
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
// The fonts of the other-fonts rows are carried by the repository (be2q-3; DLW build ruling 2026-11-12), so a row is the same row on
// every machine: KaTeX's sans, typewriter and roman faces, vendored under desktop/cradle, handed to the page as data. A family is the
// sans face at a glyph width (size-adjust), with the few characters it lacks taken from the other two; the lines' heights are the
// style sheets' own, whatever the font. Rows under a font named by a machine (Arial, Gill Sans) meant one thing here and another on
// the Linux runner, where the name falls back to a font this Mac does not have. The widths: 100 %; 113 %, where the scrolled part
// is a fraction of a pixel tall and its end lies 0.94 px under its foot (the runner's failure, met here); 93 % and 104 %, beside them.
const CARRIED_WIDTHS = [100, 93, 104, 113]
const CARRIED_MONO = 'carried-mono'
/** The KaTeX faces' files, and the code points each holds, read from the file itself (its cmap table), never asked of a browser:
 * what a browser answers about which face drew a glyph differs by platform (be2q-4; the runner and this Mac answered differently
 * for the line-break mark, which no carried face holds). */
const FACE_FILE = name => new URL(`../../../../desktop/cradle/src/field/vendor/katex/fonts/KaTeX_${name}-Regular.woff2`, import.meta.url)
const WOFF2_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca']
function heldBy(name) {
  const file = readFileSync(FACE_FILE(name))
  assert.equal(file.toString('latin1', 0, 4), 'wOF2', `${name}: a WOFF2 file`)
  let at = 48
  const base128 = () => { let value = 0; for (let n = 0; n < 5; n++) { const byte = file[at++]; value = (value << 7) | (byte & 127); if (!(byte & 128)) return value } throw Error('a number of the table directory does not end') }
  const tables = Array.from({length: file.readUInt16BE(12)}, () => {
    const flags = file[at++], index = flags & 63, tag = index === 63 ? file.toString('latin1', at, (at += 4)) : WOFF2_TAGS[index] ?? `#${index}`
    const length = base128(), transformed = tag === 'glyf' || tag === 'loca' ? flags >> 6 === 0 : flags >> 6 !== 0
    return {tag, size: transformed ? base128() : length}
  })
  const data = brotliDecompressSync(file.subarray(at, at + file.readUInt32BE(20)))
  let offset = 0, cmap
  for (const table of tables) { if (table.tag === 'cmap') cmap = data.subarray(offset, offset + table.size); offset += table.size }
  assert.ok(cmap, `${name}: the file has a cmap table`)
  const held = new Set()
  for (let n = 0; n < cmap.readUInt16BE(2); n++) {
    const sub = cmap.subarray(cmap.readUInt32BE(8 + n * 8)), format = sub.readUInt16BE(0)
    if (format === 4) { const segments = sub.readUInt16BE(6) / 2
      for (let k = 0; k < segments; k++) { const end = sub.readUInt16BE(14 + k * 2), start = sub.readUInt16BE(16 + segments * 2 + k * 2), delta = sub.readUInt16BE(16 + segments * 4 + k * 2), rangeAt = 16 + segments * 6 + k * 2, range = sub.readUInt16BE(rangeAt)
        for (let code = start; code <= end && code < 0xffff; code++) if ((range === 0 ? (code + delta) & 0xffff : sub.readUInt16BE(rangeAt + range + (code - start) * 2)) !== 0) held.add(code) } }
    else if (format === 12) for (let g = 0; g < sub.readUInt32BE(12); g++) for (let code = sub.readUInt32BE(16 + g * 12); code <= sub.readUInt32BE(20 + g * 12); code++) held.add(code)
  }
  return held
}
/** What each carried family takes from which face: the sans face (the typewriter face, for the commands' blocks), and for the code
 * points listed, another face. The same lists make the @font-face rules and answer whether a family holds a character. */
const UI_BORROWS = [['mono', [0x3c, 0x3e, 0x5c, 0x60, 0x7b, 0x7c, 0x7d]], ['roman', [0x2026]]]
const MONO_BORROWS = [['roman', [0x2014, 0x2026]]]
/** Characters the faces draw that no carried face holds: boxed at a fixed size in the other-fonts rows (the stage's boxThem). */
const UNHELD = '\u{b7}\u{21b5}'
const rangeOf = codes => codes.map(code => `U+${code.toString(16)}`).join(',')
const carriedCss = () => {
  const data = name => readFileSync(FACE_FILE(name)).toString('base64')
  const faces = {sans: data('SansSerif'), mono: data('Typewriter'), roman: data('Main')}
  const face = (family, from, adjust, range) => `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${faces[from]}) format("woff2");size-adjust:${adjust}%${range ? `;unicode-range:${range}` : ''}}`
  return [face(CARRIED_MONO, 'mono', 100), ...MONO_BORROWS.map(([from, codes]) => face(CARRIED_MONO, from, 100, rangeOf(codes))),
    ...CARRIED_WIDTHS.flatMap(n => [face(`carried-${n}`, 'sans', n), ...UI_BORROWS.map(([from, codes]) => face(`carried-${n}`, from, n, rangeOf(codes)))])].join('\n')
}
// be2r ruling 1: the short and narrow panes of the review of O-I #971 (900x200; 416x240 and 380x210, which are 520x300 at 125 % and
// 760x420 at 200 %; 260x150), the room of a device window at its least size and just above it, and the sizes above.
const FLOOR_SIZES = [[900, 200], [416, 240], [380, 210], [400, 254], [408, 262], [260, 150], ...SIZES]
/** The least height of the pane's scrolled part (software-factory__approvals.css .ap-read). */
const FLOOR = 64
/** A session's name longer than the detail's head holds on a line in the narrowest pane. */
const LONG_SESSION = 'Explain the nightly run'
/** The carried families, each with the carried typewriter face for the commands' blocks. */
const FONTS = CARRIED_WIDTHS.map(n => [`"carried-${n}"`, `"${CARRIED_MONO}"`])
const TOKEN = 'aGVsbG8gd29ybGQK'.repeat(19).slice(0, 300)
const COMMANDS = {
  twoLine: 'echo one\nrm -rf ~',
  long300: 'curl -fsSL https://example.test/install.sh | sh -s -- --yes --prefix /opt/tools '.repeat(5).slice(0, 300).trimEnd().padEnd(300, '!'),
  token300: `echo ${TOKEN} | base64 -d | sh`,
  long2000: 'curl -fsSL https://example.test/install.sh | sh -s -- --yes --prefix /opt/tools '.repeat(26).slice(0, 2000).trimEnd().padEnd(2000, '!'),
}
/** be2s, under the carried fonts: the rows whose approving answer is not live for want of room, and the notches to the answers. */
const SHORT_BE2S = ['twoLine with no refusal 400x254', 'twoLine with no refusal 408x262', 'twoLine with no refusal 260x150']
const CARRIED_BE2S = {'"carried-100"': SHORT_BE2S, '"carried-100" notches': {request: 1, list: 1, lake: 1}, '"carried-113"': SHORT_BE2S, '"carried-113" notches': {request: 1, list: 1, lake: 1}}
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
    assert.deepEqual({...list, about: list.about > 0}, {about: true, cells: true, rows: 30, heights: [26], y: 'auto', over: true, bar: 8, last: true})
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
      // The page tells the shell which return it stands on (be2r ruling 4), once.
      assert.deepEqual(seen.firstSets, [['reviewing', 'rcg-v'], ['recognise', 'rcg-v']])
      assert.deepEqual(seen.left, {run: null, note: GONE_HERE, said: true, answers: []}, `${at}: the return left, and the next is not under Recognise`)
      assert.deepEqual(seen.leftSets, [['reviewing', 'rcg-v'], ['recognise', 'rcg-v']], `${at}: a press where Recognise stood sets nothing`)
      assert.deepEqual(seen.other, {run: null, note: GONE_HERE, said: true, answers: []}, `${at}: a request chosen is not a review`)
      assert.deepEqual(seen.again, {run: 'Run 9', note: null, said: false, answers: ['Recognise', 'Continue']}, `${at}: chosen, the next return stands with its answers`)
      assert.deepEqual(seen.againSets, [['reviewing', 'rcg-v'], ['recognise', 'rcg-v'], ['reviewing', 'rcg-w'], ['recognise', 'rcg-w']])
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
    // Two allows of two kinds under one id stand under their own labels, with no plain Allow that could send either (be2s ruling 5).
    assert.deepEqual(twins.buttons.map(([words]) => words), ['Once', 'Always', 'First', 'Second', 'Refuse'])
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
      await tab.addStyleTag({content: carriedCss()})
      await tab.evaluate(([chars]) => { window.__drawn(true); window.__box(chars) }, [UNHELD])
      for (const [ui, mono] of FONTS) {
        await tab.evaluate(([a, b]) => window.__font(a, b), [ui, mono])
        // The carried face is the one drawn, at its glyph width: one line of words is as wide as the same line at 100 %, times the width.
        const [plain, scaled] = [await tab.evaluate(family => window.__wide(family), FONTS[0][0]), await tab.evaluate(family => window.__wide(family), ui)], share = Number(ui.match(/\d+/)[0]) / 100
        assert.ok(plain > 0 && Math.abs(scaled / plain - share) < 0.002, `${ui}: its words are ${share} times as wide as at 100 % (${scaled} to ${plain})`)
        try {
          for (const [width, height] of [[760, 420], [759, 420], [761, 420], [700, 420], [800, 420], [520, 300], [1180, 620]]) for (const [n, name] of names.entries()) for (const open of [false, true]) {
            const seen = await tab.evaluate(([w, hgt, item, o]) => window.__pane(w, hgt, item, {open: o}), [width, height, rows[n], open]), at = `${ui}: ${name} at ${width}x${height}${open ? ', Show raw open' : ''}`
            assert.deepEqual([seen.scroll.y, seen.scroll.wide, seen.scroll.inDetail, seen.end], ['auto', false, true, true], `${at}: it scrolls down and not sideways, inside the detail, and its end is reached`)
            assert.deepEqual([seen.out, seen.tail], [{top: [], end: []}, [rows[n].text.slice(-3), true]], `${at}: nothing lies outside, and the command's last characters stand inside the scrolled part`)
            assert.deepEqual(seen.buttons, ['Approve', 'Deny', 'Open'].map(text => ({text, inPane: true, inDetail: true, top: true})), `${at}: the answers are in reach`)
          }
          for (const width of [280, 281, 420]) {
            const card = await tab.evaluate(([w, c, ch]) => window.__card(w, c, ch), [width, COMMANDS.token300, offered])
            assert.deepEqual([card.outside, card.inBox, card.buttons.every(([, within]) => within), card.short.every(([, whole]) => whole)], [[], true, true, true], `${ui}: chat card at ${width} px`)
          }
          for (const width of [300, 301, 520]) {
            const card = await tab.evaluate(([w, row]) => window.__thread(w, 300, row), [width, threadRow])
            assert.deepEqual([card.outside, card.inPane, card.buttons], [[], [], [['Approve', true], ['Changes', true], ['Diff', true]]], `${ui}: Thread card at ${width} px`)
          }
        } finally { await tab.evaluate(() => window.__font(null, null)) }
      }
      await tab.evaluate(() => window.__box(''))
      // Every character these rows drew in a measured part is held by the carried files, in both families (be2q-4), or stands in a
      // box of the test's own fixed size (UNHELD: the middle dot of "Proposal \u{b7} ..." on the Thread's card and of a row's flags).
      // So no machine's fallback font decides where a measured line breaks or how tall it is. The box changes nothing these rows
      // prove: they are about a long word wrapping inside its part and the answers staying in reach, and the dot stands between
      // short words. Outside the measured parts (the pane's head, the Thread's own head) lines are of fixed height and do not wrap.
      const faces = {sans: heldBy('SansSerif'), mono: heldBy('Typewriter'), roman: heldBy('Main')}
      const holds = (base, borrows, code) => (borrows.find(([, codes]) => codes.includes(code)) ? faces[borrows.find(([, codes]) => codes.includes(code))[0]] : faces[base]).has(code)
      const drew = [...await tab.evaluate(() => window.__drawn())].filter(ch => ch.codePointAt(0) >= 32)
      assert.ok(drew.length > 60, `the rows drew ${drew.length} different characters`)
      for (const ch of UNHELD) assert.ok(!Object.values(faces).some(face => face.has(ch.codePointAt(0))), `U+${ch.codePointAt(0).toString(16)} is boxed because no carried face holds it`)
      assert.deepEqual(drew.filter(ch => !holds('sans', UI_BORROWS, ch.codePointAt(0)) || !holds('mono', MONO_BORROWS, ch.codePointAt(0))), [], 'a character of a measured part that a carried family does not hold')
      for (const [family, base, borrows] of [['ui', 'sans', UI_BORROWS], ['mono', 'mono', MONO_BORROWS]]) for (const [from, codes] of borrows) for (const code of codes)
        assert.ok(!faces[base].has(code) && faces[from].has(code), `${family}: U+${code.toString(16)} is lacking in its own face and held by the ${from} face it is taken from`)
    })
    // be2r ruling 1 (DLW build ruling 2026-11-12; the review of O-I #971, F1): the pane has a floor. In a pane too short for its head,
    // the lake, the scrolled part's least height and the answers together, the pane itself scrolls, by a scroll bar that is drawn: the
    // scrolled part never has no height beside a live Approve, and the answers are reached by a real mouse wheel and pressed by a real
    // click, down to the room of a device window at its least size (frame/devices/deviceWindow.ts WINDOW_MIN_W x WINDOW_MIN_H, 400x300,
    // less its 26 px bar and its 20 px Info line: 400x254) and under it.
    const reach = async (width, height, item, open, kept, opts = {}) => {
      const first = await tab.evaluate(([w, hgt, it, o, more]) => window.__stand(w, hgt, it, o, more), [width, height, item, open, opts])
      await tab.mouse.move(first.at[0], first.at[1])
      let seen = first, wheels = 0
      const places = look => JSON.stringify([look.pane.at, look.detail.at, look.read?.at])
      while (kept !== 'first' && wheels < 80 && seen.more && !seen.buttons.every(button => button.inPane && button.top)) {
        await tab.evaluate(() => window.__arm()); await tab.mouse.wheel(0, 400); wheels += 1
        const next = await tab.evaluate(() => window.__look())
        const moved = places(next) !== places(seen); seen = next
        if (!moved) break
      }
      // be2s ruling 1: every scroll position of the pane, by script, for what stands in view wherever the approving answer is live.
      const sweep = kept ? null : await tab.evaluate(() => window.__sweep())
      if (!kept) for (const button of seen.buttons) await tab.mouse.click(button.x, button.y)
      const sets = await tab.evaluate(keep => window.__unstand(keep), !!kept)
      return {first, seen, sets, wheels, sweep}
    }
    const answersOf = item => ['Approve', 'Deny', 'Open'].map(text => ({text, inPane: true, inDetail: true, top: true}))
    const strict = assert, wrong = []
    const claimed = claim => { try { claim() } catch (error) { wrong.push(String(error.message).split('\n')[0]) } }
    const none = () => { const said = wrong.splice(0); strict.deepEqual(said.slice(0, 12), [], `${said.length} claims do not hold`) }
    const floorAt = async (width, height, item, open, name, font = '', opts = {}) => {
      const {first, seen, sets, wheels, sweep} = await reach(width, height, item, open, undefined, opts), at = `${font}${name} ${opts.win ? 'in a window of' : 'at'} ${width}x${height}${open ? ', Show raw open' : ''}`
      const approve = seen.buttons[0]?.text ?? 'Approve'
      const tall = !opts.win && height >= 200
      // Every claim of a row is tried, so a red run says all that is wrong at a size and not only the first of it.
      const assert = Object.assign((...args) => claimed(() => strict(...args)), {ok: (...args) => claimed(() => strict.ok(...args)), equal: (...args) => claimed(() => strict.equal(...args)), deepEqual: (...args) => claimed(() => strict.deepEqual(...args))})
      assert.deepEqual(first.head, [], `${at}: who asks, the kind and the session are not broken inside a word`)
      const strip = look => look.buttons.map(({text, inPane, inDetail, top}) => ({text, inPane, inDetail, top}))
      // Before any wheel: the scrolled part has its floor, and what it holds can be read in it.
      assert.ok(first.read.tall >= FLOOR, `${at}: the scrolled part keeps its least height (${first.read.tall} px)`)
      assert.deepEqual(first.reads, {what: true, line: item.differs ? true : null}, `${at}: a line of the command, and of the sentence that it is not as sent, can be read in the scrolled part`)
      assert.deepEqual([first.byItself, first.line], item.differs ? [true, item.differs] : [false, null], `${at}: Show raw opens by itself for a request not as sent, and its sentence stands`)
      assert.deepEqual([first.out, first.wide], [[], false], `${at}: nothing lies outside the detail sideways, and the pane does not move sideways`)
      // Where the answers are not all in view at first, a drawn scroll bar on the pane says more lies below.
      if (!first.buttons.every(button => button.inPane && button.top)) assert.deepEqual([first.pane.y, first.pane.over, first.pane.bar], ['auto', true, 8], `${at}: the answers are below the pane's foot, and its scroll bar is drawn`)
      else assert.equal(wheels, 0)
      // Reached by the wheel: every answer is inside the pane and the detail, under nothing, and a real click on each sets its key.
      assert.deepEqual(strip(seen), answersOf(item), `${at}: each answer is in the pane's box and can be met by a mouse (${wheels} wheels)`)
      // be2s ruling 1 (DLW build ruling 2026-11-12; the review of O-I #972, F1): the approving answer is never live and in view
      // without the first line of what the item is (a request's command) whole in view with it, inside the scrolled part, or
      // without "not as sent" where the request carries it, at any scroll position of the pane. Where the pane cannot hold that,
      // the answer is not live, words above the answers say so and what to do, and they come into view with it; a click on it sets
      // nothing, and the other answers still set theirs. It is not live only where the room is in fact too little (measured here
      // from the boxes: the pane's height less everything from that line's top to the detail's foot).
      assert.deepEqual(seen.contained, [], `${at}: no part of the pane is size-contained (be2s ruling 3)`)
      if (seen.short) {
        assert.deepEqual([seen.short.text, seen.short.outside, seen.buttons.map(button => button.live), sweep.met, sweep.noted], [`No room here to read it beside ${approve}. Make the window or the pane taller.`, true, [false, true, true], 0, true], `${at}: the pane is too short: ${approve} is not live, and the words that say so stand above the answers and come into view with it`)
        if (width >= 400) assert.deepEqual([seen.short.inPane, seen.short.top], [true, true], `${at}: in a pane as wide as a window, those words are in view with all three answers`)
        assert.ok(first.tight < 0, `${at}: and the pane is in fact too short for the line and the answers together (${first.tight} px over)`)
        assert.deepEqual(sets, [['deny', item.id], ['open', item.id]], `${at}: a click on ${approve} sets nothing, and one on each other answer sets its key to the request`)
      } else {
        assert.deepEqual(seen.buttons.map(button => button.live), [true, true, true], `${at}: every answer is live`)
        assert.ok(sweep.met > 0 && sweep.lined && first.held, `${at}: wherever ${approve} is in view, the first line of the request is whole in view, inside the scrolled part (${sweep.least} px of the part at the least, ${sweep.met} positions)`)
        assert.equal(sweep.marked, true, `${at}: and "not as sent" is in view wherever ${approve} is`)
        assert.ok(first.tight >= 0, `${at}: the pane holds the line and the answers together (${first.tight} px over)`)
        assert.deepEqual(sets, [['allowOnce', item.id], ['deny', item.id], ['open', item.id]], `${at}: a click on each sets its key to the request`)
      }
      // With the answers in view, the scrolled part still has its floor; in a pane as tall as a window's least room, some of it is in view with them.
      assert.ok(seen.read.tall >= FLOOR, `${at}: with the answers in view the scrolled part keeps its least height (${seen.read.tall} px)`)
      if (tall) assert.ok(seen.read.shown >= 17, `${at}: a line or more of the scrolled part is in view with the answers (${seen.read.shown} px)`)
      if (item.differs && tall) assert.deepEqual(seen.mark, {text: 'not as sent', inPane: true, top: true, outside: true}, `${at}: "not as sent" is in view with Approve, outside the scrolled part`)
      if (item.denySays && tall) assert.deepEqual(seen.cancels, {text: DENY_CANCELS, inPane: true, top: true, outside: true}, `${at}: what Deny sends is in view with it`)
      return seen
    }
    // be2s ruling 2 (the review of O-I #972, F2): how many notches of a real wheel, 100 px each, bring every answer into view with
    // the pointer over a part of the pane; then what the next notch down and the two after it back up move.
    const notches = async (width, height, item, selector, opts = {}) => {
      await tab.evaluate(([w, hgt, it, more]) => window.__stand(w, hgt, it, false, more), [width, height, item, opts])
      const at = await tab.evaluate(sel => window.__point(sel), selector)
      assert.ok(at, `${selector} is in the first view at ${width}x${height}`)
      await tab.mouse.move(at[0], at[1])
      const turn = async dy => { await tab.evaluate(() => window.__arm()); await tab.mouse.wheel(0, dy); return tab.evaluate(() => window.__look()) }
      let seen = await tab.evaluate(() => window.__look()), count = 0
      while (count < 130 && !seen.buttons.every(button => button.inPane && button.top)) { seen = await turn(100); count += 1 }
      const places = look => [look.pane.at, look.read.at]
      const reached = places(seen), moved = []
      // The pane has moved under the pointer: it is put over the request again, as a person who reads on puts it.
      if (selector === '.ap-read') { const again = await tab.evaluate(sel => window.__point(sel), selector); await tab.mouse.move(again[0], again[1])
        for (const dy of [100, -100, -100]) moved.push(places(await turn(dy))) }
      const taken = await tab.evaluate(() => window.__taken())
      await tab.evaluate(() => window.__unstand(false))
      return {count, reached, moved, max: seen.pane.at, taken}
    }
    // be2r ruling 4 (the review's F4): the Review page's hold outlives the page. With real clicks at the point where Recognise first stood.
    await t.test('be2r ruling 4: the Review page, left and come back to, still stands on the return it held or says it has left; a click where Recognise stood never recognises the next', async () => {
      const live = run => ({run, note: null, said: false, answers: ['Recognise', 'Continue'], left: true}), gone = {run: null, note: GONE_HERE, said: true, answers: [], left: true}
      const start = await tab.evaluate(() => window.__returns()), [x, y] = start.point
      assert.deepEqual(start.first, {run: 'Run 8', note: null, said: false, answers: ['Recognise', 'Continue']})
      const back = async (name, queue) => { await tab.evaluate(([n, q]) => window.__away(n, q), [name, queue]); await tab.mouse.click(x, y); return tab.evaluate(() => window.__steps()) }
      const recognised = seen => seen.sets.filter(([key]) => key === 'recognise').map(([, id]) => id)
      let seen = await back('same', 'RVW')
      assert.deepEqual([seen.same, recognised(seen)], [live('Run 8'), ['rcg-v']], 'left and come back to: the same return, and its Recognise answers for it')
      seen = await back('behind', 'RWV')
      assert.deepEqual([seen.behind, recognised(seen)], [live('Run 8'), ['rcg-v', 'rcg-v']], 'another return now waits before it in the queue: the page still stands on the one it held')
      seen = await back('gone', 'RW')
      assert.deepEqual([seen.gone, recognised(seen)], [gone, ['rcg-v', 'rcg-v']], 'it left while the page was away: the page says so, and a click where Recognise stood recognises nothing')
      seen = await back('still', 'RW')
      assert.deepEqual([seen.still, recognised(seen)], [gone, ['rcg-v', 'rcg-v']], 'and again')
      await tab.evaluate(() => window.__choose('rcg-w')); await tab.mouse.click(x, y)
      seen = await back('held', 'RW')
      assert.deepEqual([seen.chosen, seen.held, recognised(seen)], [{run: 'Run 9', note: null, said: false, answers: ['Recognise', 'Continue']}, live('Run 9'), ['rcg-v', 'rcg-v', 'rcg-w', 'rcg-w']], 'chosen, the next return stands, and is held in its turn')
      assert.deepEqual(seen.sets.filter(([key]) => key === 'reviewing'), [['reviewing', 'rcg-v'], ['reviewing', 'rcg-w']], 'the page tells the shell once which one it stands on')
      await tab.evaluate(() => window.__over())
    })
    // be2r ruling 5 (F3): the pane's list keeps an About column in the narrow panes, every cell inside its row; "not as sent" stands whole in its cell at 520 px.
    await t.test('be2r ruling 5: the pane\'s list keeps its About column in a narrow pane', async () => {
      for (const [width, height, least] of [[520, 300, 40], [416, 240, 16], [400, 254, 16], [760, 420, 100], [1180, 620, 280]]) {
        const seen = await tab.evaluate(([w, hgt, item]) => window.__list(w, hgt, 4, item), [width, height, rows[0]])
        assert.ok(seen.about >= least, `${width}x${height}: the About cell keeps a width (${seen.about} px)`)
        assert.equal(seen.cells, true, `${width}x${height}: every cell stands inside its row`)
        if (width >= 520) assert.deepEqual(seen.flag, ['not as sent', true], `${width}x${height}: "not as sent" stands whole in its cell`)
      }
    })
    // be2r rulings 2 and 5 (F2, F5) on the Thread's card in a pane 240 px wide: no button's name is broken inside itself, the buttons a
    // line does not hold go to the next and stay inside the card, and an approval that will send an always-allow is named for it.
    await t.test('be2r rulings 2, 3 and 5: the Thread\'s card keeps each button\'s name whole in a narrow pane, and the answer\'s face says what Accept and Decline send', async () => {
      for (const width of [240, 300]) for (const always of [false, true]) {
        const card = await tab.evaluate(([w, row]) => window.__thread(w, 300, row), [width, {...threadRow, ...(always ? {always: true} : {})}]), at = `Thread card at ${width} px${always ? ', always' : ''}`
        assert.deepEqual([card.buttons, card.broken], [[[always ? 'Approve always' : 'Approve', true], ['Changes', true], ['Diff', true]], []], `${at}: each button inside the card, its name whole on one line`)
        assert.deepEqual([card.outside, card.inPane], [[], []], `${at}: no words lie outside the card or the pane`)
      }
      // The answer's face, in the gallery's pane and in a device window at its least room.
      const DECLINE_CANCELS = 'Decline cancels the request: it offers no refusing choice.'
      for (const [width, height] of [[760, 420], [400, 254]]) {
        const plain = await tab.evaluate(([w, hgt, row]) => window.__answer(w, hgt, row), [width, height, threadRow])
        assert.deepEqual(plain, {outside: [], inChat: [], buttons: [['Accept', true], ['Decline', true]], broken: [], notes: []}, `answer's face at ${width}x${height}`)
        const said = await tab.evaluate(([w, hgt, row]) => window.__answer(w, hgt, row), [width, height, {...threadRow, always: true, declineSays: DECLINE_CANCELS}])
        assert.deepEqual(said, {outside: [], inChat: [], buttons: [['Accept always', true], ['Decline', true]], broken: [], notes: [[DECLINE_CANCELS, true]]}, `answer's face at ${width}x${height}, an always-allow and a Decline that cancels`)
      }
    })
    await t.test('be2r ruling 1: the pane has a floor: the scrolled part never has no height beside Approve, and a mouse reaches every answer in a short pane', async () => {
      for (const [width, height] of FLOOR_SIZES) {
        for (const [n, name] of names.entries()) for (const open of [false, true]) await floorAt(width, height, rows[n], open, name)
        await floorAt(width, height, bare[0], false, 'twoLine with no refusal')
      }
      // A session's long name in the narrowest pane: the head's words go to further lines, and none is broken inside itself.
      await floorAt(260, 150, {...rows[0], session: LONG_SESSION}, false, 'twoLine of a long session')
      none()
    })
    await t.test('be2r ruling 1 under other fonts: the floor holds and a mouse reaches every answer', async () => {
      // The same carried fonts, and the same boxes for the characters they do not hold, as the part above (be2q-4).
      await tab.evaluate(([chars]) => window.__box(chars), [UNHELD])
      for (const [ui, mono] of FONTS) {
        await tab.evaluate(([a, b]) => window.__font(a, b), [ui, mono])
        try {
          for (const [width, height] of FLOOR_SIZES) {
            await floorAt(width, height, rows[0], false, 'twoLine', `${ui}: `)
            await floorAt(width, height, rows[2], true, 'token300', `${ui}: `)
            await floorAt(width, height, bare[0], false, 'twoLine with no refusal', `${ui}: `)
          }
          await floorAt(260, 150, {...rows[0], session: LONG_SESSION}, false, 'twoLine of a long session', `${ui}: `)
        } finally { await tab.evaluate(() => window.__font(null, null)) }
      }
      await tab.evaluate(() => window.__box(''))
      none()
    })
    // be2s (DLW build ruling 2026-11-12), the follow-ups of the review of O-I #972.
    // Ruling 1: the shell's least pane is not a window's room but the upper half of it. A device window draws Approvals' pane over
    // its Device view (panels/popout.tsx popoutOf: Full over Whole) and gives the Device view half the room up to its own height,
    // so a window at its least size (400x300, a room of 400x254) holds a pane of 400x127. The rows draw that composition, at the
    // least window, just above it, at a window where every request has room, and the bare pane at 260x150.
    const WINDOWS = [[400, 254], [408, 262], [400, 340], [760, 420]]
    const windowRows = async (font = '') => {
      const states = {}
      for (const [width, height] of WINDOWS) {
        const paneOf = async (item, open, name) => { const seen = await floorAt(width, height, item, open, name, font, {win: true}); states[`${name} ${width}x${height}`] = seen.short ? 'short' : 'live'; return seen }
        const two = await paneOf(rows[0], false, 'twoLine')
        claimedHere(() => strict.deepEqual([two.pane.y, Math.round(two.pane.at + 0) >= 0, two.read.tall >= FLOOR], ['auto', true, true]))
        await paneOf(rows[1], false, 'long300'); await paneOf(rows[2], true, 'token300'); await paneOf(bare[0], false, 'twoLine with no refusal')
      }
      for (const [item, name] of [[rows[0], 'twoLine'], [rows[1], 'long300'], [bare[0], 'twoLine with no refusal']]) states[`${name} 260x150`] = (await floorAt(260, 150, item, false, name, font)).short ? 'short' : 'live'
      return states
    }
    const claimedHere = claim => claimed(claim)
    await t.test('be2s ruling 1: in a device window, where the pane is half the room, Approve is live only where a line of the request is in view with it; where the pane is too short it is not live and the pane says what to do', async () => {
      const states = await windowRows()
      none()
      // The pane the least window holds is 127 px tall: half of the room, the Device view under it.
      const least = await tab.evaluate(async ([item]) => { await window.__stand(400, 254, item, false, {win: true}); const pane = document.querySelector('.ap-pane').getBoundingClientRect(), whole = document.querySelector('.dp-window-controls').getBoundingClientRect(); window.__unstand(false); return [pane.width, pane.height, whole.top] }, [rows[0]])
      assert.deepEqual(least, [400, 127, 127], 'the least window: the pane is 400x127, and the Device view stands under it from 127 px down')
      // In this machine's fonts: which rows are too short. A request with both foot lines has no room at the least window or just
      // above it, nor in the bare pane at 260x150; every request has room in a window of 400x340 and of 760x420.
      assert.deepEqual(Object.entries(states).filter(([, state]) => state === 'short').map(([row]) => row), SHORT_BE2S)
      // An item of another kind, with its own approving answer: a proposal's Approve, a return's Recognise.
      for (const [item, label, key, keys] of [[{id: 'prop', kind: 'proposal', who: 'Flint', text: 'Set the model', diff: ['+ model: large', '- model: small']}, 'Approve', 'approve', ['changes', 'reject']],
        [{id: 'rcg', kind: 'recognition', who: 'Factory', where: 'Run 8', text: 'Run 8 returned', recognition: {run: 'Run 8', course: 'A course', summary: 'Eight.'}}, 'Recognise', 'recognise', ['continue']],
        [{id: 'ref', kind: 'proposal', who: 'AIKit', text: 'A revision of a skill', refinement: {member: 'skill/x', result: [{condition: 'It triggers', proposed: 'met', inUse: 'not met'}]}}, 'Accept', 'refineAccept', ['refineDiscard']],
        [{id: 'unit', kind: 'request', who: 'Factory', text: 'The unit stopped at its bound. Resume it or cancel it?', where: 'unit 4', options: {allowOnce: 'Resume bounded work', deny: 'Cancel bounded work'}}, 'Resume bounded work', 'allowOnce', ['deny', 'open']]]) {
        for (const [height, short] of [[60, true], [300, false]]) {
          const {seen, sets, sweep} = await reach(400, height, item, false), at = `${item.kind} at 400x${height}`
          assert.deepEqual([seen.buttons.map(button => button.live), seen.short?.text ?? null], short ? [[false, ...keys.map(() => true)], `No room here to read it beside ${label}. Make the window or the pane taller.`] : [[true, ...keys.map(() => true)], null], `${at}: ${label} is ${short ? 'not live, and the pane says so' : 'live'}`)
          assert.deepEqual(sets, [...(short ? [] : [[key, item.id]]), ...keys.map(other => [other, item.id])], `${at}: what a click on each sets`)
          if (!short) assert.ok(sweep.lined, `${at}: its first line is in view wherever ${label} is (${sweep.least} px of the scrolled part)`)
        }
      }
    })
    await t.test('be2s ruling 1: a pane made taller by its edge gives Approve back as soon as a line has room, and takes it again when made short', async () => {
      const first = await tab.evaluate(([item]) => window.__stand(400, 127, item, false), [bare[0]])
      assert.deepEqual([first.short?.text, first.buttons.map(button => button.live), first.tight < 0], ['No room here to read it beside Approve. Make the window or the pane taller.', [false, true, true], true])
      // Two pixels more than the line needs: less than the words that said it was too short took.
      const room = 127 + Math.ceil(-first.tight) + 2
      const taller = await tab.evaluate(height => window.__tall(height), room)
      assert.deepEqual([taller.short, taller.buttons.map(button => button.live), taller.tight >= 0 && taller.tight < 5], [null, [true, true, true], true], `at ${room} px the line has room (${taller.tight} px): Approve is live and the words are gone`)
      const again = await tab.evaluate(() => window.__tall(127))
      assert.deepEqual([again.short?.text, again.buttons.map(button => button.live)], [first.short.text, [false, true, true]], 'made short again, it is not live again')
      await tab.evaluate(() => window.__unstand(false))
    })
    // Ruling 2: the wheel moves the pane. A command of 200 lines, its raw form open by itself: 10,900 px in a scrolled part 64 px tall.
    const LINES_200 = Array.from({length: 200}, (_, n) => `echo line ${n}`).join('\n')
    const [long200] = await tab.evaluate(commands => window.__rows(commands), [LINES_200])
    /** The most notches of 100 px, from anywhere in the pane, before every answer is in view. */
    const NOTCHES = 3
    await t.test('be2s ruling 2: a wheel over the request, the list or the lake brings the answers into view in three notches at the most; a long request does not hold the wheel', async () => {
      let max400 = null
      for (const [width, height, opts] of [[400, 254, {}], [900, 200, {}], [400, 254, {win: true}]]) {
        const at = `${opts.win ? 'a window of ' : ''}${width}x${height}`
        const over = {}
        for (const [name, selector] of [['request', '.ap-read'], ['list', '.ap-list'], ['lake', '.ap-lake']]) {
          if (opts.win && name !== 'lake') continue
          over[name] = await notches(width, height, long200, selector, opts)
          assert.ok(over[name].count >= 1 && over[name].count <= NOTCHES, `${at}: ${over[name].count} notches over the ${name} bring every answer into view`)
        }
        if (opts.win) continue
        if (width === 400) max400 = over.request.max
        // Over the request the pane moves first, to its end, and the request after it; back up, the request first and the pane after.
        const {count, reached, moved, max} = over.request
        assert.deepEqual([reached, over.request.taken], [[max, 0], true], `${at}: the answers are reached at the pane's end, and the request still stands at its first line`)
        assert.deepEqual(moved, [[max, 100], [max, 0], [Math.max(0, max - 100), 0]], `${at}: the next notch reads on in the request; back up, the request first, then the pane (${count} notches, pane ${max} px)`)
      }
      // Thirty requests wait: the list is longer than its box, and does not hold the wheel either.
      const many = await notches(400, 254, long200, '.ap-list', {count: 30})
      assert.ok(many.count >= 1 && many.count <= NOTCHES, `thirty rows at 400x254: ${many.count} notches over the list`)
      // A pane tall enough not to scroll: the wheel over the request is the request's own, as it was.
      await tab.evaluate(([item]) => window.__stand(1180, 620, item, false), [long200])
      const at = await tab.evaluate(() => window.__point('.ap-read')); await tab.mouse.move(at[0], at[1])
      await tab.evaluate(() => window.__arm()); await tab.mouse.wheel(0, 100)
      const tall = await tab.evaluate(() => window.__look()), left = await tab.evaluate(() => window.__taken()); await tab.evaluate(() => window.__unstand(false))
      assert.deepEqual([tall.pane.at, tall.read.at, tall.pane.over, left], [0, 100, false, false], '1180x620: the pane does not scroll, and the wheel is left to the browser, which reads on in the request')
      // Turns a mouse here does not send, made by the page: a pinch (the wheel with Control) and a sideways turn are left to the
      // browser; a turn counted in lines is 16 px a line, and one counted in pages is the pane's height.
      await tab.evaluate(([item]) => window.__stand(400, 254, item, false), [long200])
      const made = []
      for (const init of [{deltaY: 100, ctrlKey: true}, {deltaY: 10, deltaX: 100}, {deltaY: 1, deltaMode: 1}, {deltaY: 1, deltaMode: 2}]) made.push(await tab.evaluate(event => window.__turn('.ap-read', event), init))
      const end = made[3].pane; await tab.evaluate(() => window.__unstand(false))
      assert.deepEqual(made, [{taken: false, pane: 0, read: 0}, {taken: false, pane: 0, read: 0}, {taken: true, pane: 16, read: 0}, {taken: true, pane: end, read: 0}], 'a pinch and a sideways turn are the browser\'s; a line is 16 px and a page the pane\'s height')
      assert.ok(end === max400 && end > 16 && end < 254, `a page's turn takes the pane to its end (${end} of ${max400} px)`)
    })
    // Ruling 4: "Approve always" on the Thread's card at every width its pane takes down to 160 px: no word of a button's name is
    // hidden. Where a line of its own does not hold the two words, the second stands under the first inside a taller button.
    const threadNarrow = async (font = '') => {
      for (const width of [160, 180, 200, 240]) for (const always of [true, false]) {
        const card = await tab.evaluate(([w, row]) => window.__thread(w, 300, row), [width, {...threadRow, ...(always ? {always: true} : {})}]), at = `${font}Thread card at ${width} px${always ? ', always' : ''}`
        assert.deepEqual([card.buttons, card.cut, card.broken], [[[always ? 'Approve always' : 'Approve', true], ['Changes', true], ['Diff', true]], [], []], `${at}: each button inside the card, every word of its name drawn inside it, none broken`)
        assert.deepEqual([card.outside, card.inPane], [[], []], `${at}: no words lie outside the card or the pane`)
        assert.ok(card.lines.slice(1).every(tall => tall === 16) && (card.lines[0] === 16 || (always && card.lines[0] === 30)), `${at}: a button is one line tall, or two for "Approve always" (${card.lines})`)
      }
    }
    await t.test('be2s ruling 4: "Approve always" stands whole on the Thread\'s card down to a pane of 160 px', async () => {
      await threadNarrow()
      const narrow = await tab.evaluate(([row]) => window.__thread(160, 300, row), [{...threadRow, always: true}]), wide = await tab.evaluate(([row]) => window.__thread(240, 300, row), [{...threadRow, always: true}])
      assert.deepEqual([wide.lines[0], narrow.lines[0] >= 16], [16, true])
    })
    await t.test('be2s rulings 1, 2 and 4 under the carried fonts: the same rows, on any machine', async () => {
      await tab.evaluate(([chars]) => { window.__drawn(true); window.__box(chars) }, [UNHELD])
      const short = {}
      for (const [ui, mono] of [FONTS[0], FONTS[3]]) {
        await tab.evaluate(([a, b]) => window.__font(a, b), [ui, mono])
        try {
          short[ui] = Object.entries(await windowRows(`${ui}: `)).filter(([, state]) => state === 'short').map(([row]) => row)
          await threadNarrow(`${ui}: `)
          const counts = {}
          for (const [name, selector] of [['request', '.ap-read'], ['list', '.ap-list'], ['lake', '.ap-lake']]) counts[name] = (await notches(400, 254, long200, selector)).count
          short[`${ui} notches`] = counts
        } finally { await tab.evaluate(() => window.__font(null, null)) }
      }
      await tab.evaluate(() => window.__box(''))
      none()
      // Under the carried fonts the rows are the same on every machine, so what they are is stated: which requests have no room, and
      // the notches for the 200-line command at 400x254 (110 over the request before be2s).
      assert.deepEqual(short, CARRIED_BE2S)
      const faces = {sans: heldBy('SansSerif'), mono: heldBy('Typewriter'), roman: heldBy('Main')}
      const holds = (base, borrows, code) => (borrows.find(([, codes]) => codes.includes(code)) ? faces[borrows.find(([, codes]) => codes.includes(code))[0]] : faces[base]).has(code)
      const drew = [...await tab.evaluate(() => window.__drawn())].filter(ch => ch.codePointAt(0) >= 32)
      assert.deepEqual(drew.filter(ch => !holds('sans', UI_BORROWS, ch.codePointAt(0)) || !holds('mono', MONO_BORROWS, ch.codePointAt(0))), [], 'a character of a measured part that a carried family does not hold')
    })
    assert.deepEqual(errors, [])

    const out = process.env.APPROVALS_DRAWN_CAPTURE
    if (out) {
      mkdirSync(out, {recursive: true})
      const shot = async name => { writeFileSync(`${out}/drawn-${name}.png`, await tab.screenshot({fullPage: true})); await tab.evaluate(() => { for (const box of document.querySelectorAll('body > div:not(#root)')) box.remove() }) }
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
      // Under a carried font: the token and its raw form at 760x420, and the row whose end the runner did not reach, the two-line
      // command at 520x300 at 113 %, scrolled to its end.
      await tab.evaluate(([a, b]) => window.__font(a, b), ['"carried-113"', `"${CARRIED_MONO}"`])
      await tab.evaluate(([item]) => window.__pane(760, 420, item, {keep: true}), [rows[2]])
      await tab.evaluate(([item]) => window.__pane(760, 420, item, {open: true, keep: true}), [rows[2]])
      await tab.evaluate(([item]) => window.__pane(520, 300, item, {keep: true, atEnd: true}), [rows[0]])
      await shot('pane-carried-113')
      await tab.evaluate(() => window.__font(null, null))
      // be2r rulings 2, 3 and 5: the Thread's card at 240 px (plain, and an always-allow), the answer's face at a window's least room
      // with an always-allow and a Decline that cancels, and the pane's list at 520x300 with a request not as sent first.
      await tab.evaluate(([w, row]) => window.__thread(w, 300, row, true), [240, threadRow])
      await tab.evaluate(([w, row]) => window.__thread(w, 300, row, true), [240, {...threadRow, always: true}])
      await tab.evaluate(([row]) => window.__answer(400, 254, row, true), [{...threadRow, always: true, declineSays: 'Decline cancels the request: it offers no refusing choice.'}])
      await tab.evaluate(([item]) => window.__pane(520, 300, item, {keep: true}), [rows[0]])
      await shot('thread-answer-list')
      // be2r ruling 1, each floor size: the request with both foot lines as the pane first draws it and as the wheel reaches its
      // answers, and the 2,000-character command with its raw form open, reached. Then the same under a carried font at 113 %.
      for (const font of [null, FONTS[3]]) {
        if (font) await tab.evaluate(([a, b]) => window.__font(a, b), font)
        for (const [width, height] of FLOOR_SIZES) {
          await reach(width, height, bare[0], false, 'first')
          await reach(width, height, bare[0], false, 'reached')
          await reach(width, height, rows[3], true, 'reached')
          await shot(`floor${font ? '-carried-113' : ''}-${width}x${height}`)
        }
        if (font) await tab.evaluate(() => window.__font(null, null))
      }
      // be2s ruling 1: the device window's composition (the pane over the Device view) at the least window, just above it and at
      // 400x340. In each: the request with both foot lines as first drawn and as the wheel reaches its answers, then the two-line
      // command and the 300-character one, reached. Then the bare pane at 260x150, and ruling 4's Thread cards at 160, 180 and
      // 200 px. All of it again under a carried font at 113 %.
      for (const font of [null, FONTS[3]]) {
        if (font) { await tab.evaluate(([chars]) => window.__box(chars), [UNHELD]); await tab.evaluate(([a, b]) => window.__font(a, b), font) }
        for (const [width, height] of WINDOWS.slice(0, 3)) {
          await reach(width, height, bare[0], false, 'first', {win: true})
          for (const item of [bare[0], rows[0], rows[1]]) await reach(width, height, item, false, 'reached', {win: true})
          await shot(`window${font ? '-carried-113' : ''}-${width}x${height}`)
        }
        for (const item of [bare[0], rows[0], rows[1]]) await reach(260, 150, item, false, 'reached')
        for (const width of [160, 180, 200]) await tab.evaluate(([w, row]) => window.__thread(w, 300, row, true), [width, {...threadRow, always: true}])
        await shot(`short-pane-thread${font ? '-carried-113' : ''}`)
        if (font) { await tab.evaluate(() => window.__font(null, null)); await tab.evaluate(() => window.__box('')) }
      }
    }
  } finally { await browser.close() }
})
