// be2p (DLW build ruling 2026-11-11), the follow-ups of the review of O-I #969: the three things about Approvals that only a laid-out
// page can show, where the Node tests read markup and call handlers.
//   Ruling 2: the rail's tile draws a command wrapped on up to four lines (be2p-2). The card measures that block, and where four lines
//             do not hold the command, or it is over the 80 characters of the length rule, says "cut short" and has Read as sent in
//             Approve's place. A command shown whole keeps Approve.
//   Ruling 3: with nothing chosen, the pane and the whole view hold the first item they stand on as the choice, so when that item leaves
//             they say it is gone instead of standing on the next one under the same Approve.
//   Ruling 4: in the pane's list the cell is 104 px wide and cuts its end. "not as sent" stands whole in it beside the longest flag.
// Channel: LAID OUT, in Chromium with the kit's, the shell's and Approvals' own stylesheets: the design's own widget, whole and full
// views (software-factory__approvals.tsx), drawn by React's client on FIXTURE queue rows of the shape the binding hands (queueRows). No
// owner is asked and nothing is answered: every set is recorded on the page.
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
import {design} from './src/inhabitants/catalogue/panels/software-factory__approvals'
const place = {onExpand() {}, onPopout() {}, onRail() {}}
const settle = () => new Promise(r => setTimeout(r, 60))
const stage = (width: number, height: number) => {
  const box = document.createElement('div')
  box.style.cssText = 'position:relative;width:' + width + 'px;height:' + height + 'px'
  document.body.appendChild(box)
  return box
}
const propsOf = (v: any, set: (key: string, value: any) => void, room?: any) =>
  ({v, owner: v, set, nav: {full() {}, select() {}, fold() {}, unfold() {}}, page: 'queue', setPage() {}, standing: {}, room})
const base = {light: 'lit', show: 'all', order: 'oldest', follow: false}

/** The rail's tile on a queue: each card's words, whether the style sheet cuts them, its standing words and its buttons. */
;(window as any).__tile = async (queue: any[]) => {
  const box = stage(320, 160), root = createRoot(box)
  flushSync(() => root.render(h(PlaceContext.Provider, {value: place}, design.widget!(propsOf({...base, queue: JSON.stringify(queue)}, () => {}) as any))))
  await settle()
  const tile = box.querySelector<HTMLElement>('.dp-tile')
  const read = () => [...box.querySelectorAll<HTMLElement>('.ap-card')].map(card => {
    // A command stands on the card's line, which wraps (be2p-2) and is what is cut; other words in the line's own span.
    const said = card.querySelector<HTMLElement>('.ap-card-cmd') ?? card.querySelector<HTMLElement>('.ap-card-line span')!
    const words = card.querySelector<HTMLElement>('.ap-card-line--cmd') ?? said
    const line = parseFloat(getComputedStyle(said).lineHeight)
    return {words: said.textContent, cut: words.scrollWidth > words.clientWidth || words.scrollHeight > words.clientHeight, mark: card.querySelector('.ap-sent')?.textContent ?? null,
      lines: Math.round(words.clientHeight / line), breaks: words.querySelectorAll('.ap-nl').length, inside: words.getBoundingClientRect().right <= card.getBoundingClientRect().right + .5 && words.scrollWidth <= words.clientWidth,
      buttons: [...card.querySelectorAll('button')].map(button => button.textContent)}
  })
  const cards = read(), width = tile?.getBoundingClientRect().width
  const list = box.querySelector<HTMLElement>('.ap-cards')!, reach = {scrolls: getComputedStyle(list).overflowY, over: list.scrollHeight > list.clientHeight}
  // The same tile squeezed, then at its own width again: the card measures again when its size changes.
  if (tile) tile.style.width = '150px'
  await settle()
  const wide = read()
  if (tile) tile.style.width = ''
  await settle()
  const back = read()
  root.unmount(); box.remove()
  return {width, cards, wide, back, reach}
}

/** The pane at a width: for each row of its list, the Flag cell's width, its words, and where "not as sent" ends inside it. */
;(window as any).__flags = async (width: number, queue: any[]) => {
  const box = stage(width, 520), root = createRoot(box)
  flushSync(() => root.render(h(PlaceContext.Provider, {value: place}, design.full!(propsOf({...base, queue: JSON.stringify(queue), pick: queue[0].id}, () => {}, {w: width, h: 520}) as any))))
  await settle()
  const rows = [...box.querySelectorAll<HTMLElement>('.ap-line:not(.ap-line--head) .ap-flag')].map(cell => {
    const text = cell.firstChild, said = cell.textContent ?? '', at = said.indexOf('not as sent'), rect = cell.getBoundingClientRect()
    if (!text || at < 0) return {said, cell: rect.width, room: null}
    const range = document.createRange()
    range.setStart(text, at); range.setEnd(text, at + 'not as sent'.length)
    const words = range.getBoundingClientRect()
    return {said, cell: rect.width, cut: cell.scrollWidth > cell.clientWidth, room: rect.right - words.right, starts: words.left - rect.left}
  })
  root.unmount(); box.remove()
  return rows
}

/** A face that answers, drawn with nothing chosen and its sets held as the shell holds them: what it sets by itself, what it stands on,
 * and what it stands on after the first request leaves the queue, and after a row is chosen again. */
;(window as any).__chosen = async (view: 'full' | 'whole') => {
  const A = {id: 'req-a', kind: 'request', who: 'Kite', text: 'ls', where: 'execute'}, B = {id: 'req-b', kind: 'request', who: 'Kite', text: 'rm -rf ~', where: 'execute'}
  const box = stage(760, 520), root = createRoot(box)
  const sets: [string, unknown][] = []
  let queue = [A, B], pick: string | undefined
  const draw = () => flushSync(() => root.render(h(PlaceContext.Provider, {value: place},
    design[view]!(propsOf({...base, queue: JSON.stringify(queue), ...(pick === undefined ? {} : {pick})}, (key, value) => { sets.push([key, value]); if (key === 'pick') { pick = value; draw() } }, {w: 760, h: 520}) as any))))
  const stands = () => (view === 'full'
    ? {what: box.querySelector('.ap-what')?.textContent ?? null, note: box.querySelector('.ap-empty[role="note"]')?.textContent ?? null,
        answers: [...box.querySelectorAll<HTMLButtonElement>('.ap-do button')].filter(button => !button.disabled).map(button => button.textContent)}
    : {what: box.querySelector('.dp-row[aria-selected="true"], .dp-row[data-selected="true"], .dp-row.is-selected')?.textContent ?? null, note: box.querySelector('.ap-where')?.textContent ?? null,
        answers: [...box.querySelectorAll<HTMLButtonElement>('.dp-action')].filter(button => !button.disabled).map(button => button.textContent)})
  draw(); await settle()
  const first = {sets: sets.slice(), ...stands()}
  queue = [B]; draw(); await settle()
  const left = {sets: sets.slice(), ...stands()}
  pick = 'req-b'; draw(); await settle()
  const again = stands()
  root.unmount(); box.remove()
  return {first, left, again}
}
/** For a capture, to look at as a person would: the tile, the whole view and the pane, each standing on a choice that has left. */
;(window as any).__show = async (queue: any[]) => {
  for (const [view, width, height] of [['widget', 320, 150], ['whole', 760, 330], ['full', 760, 420]] as const) {
    const box = stage(width, height)
    box.style.margin = '8px'
    flushSync(() => createRoot(box).render(h(PlaceContext.Provider, {value: place}, design[view]!(propsOf({...base, queue: JSON.stringify(queue), pick: view === 'widget' ? undefined : 'gone'}, () => {}, {w: width, h: height}) as any))))
  }
  await settle()
}
;(window as any).__ready = true
`
const FACES = `:root{--bg-0:#26292d;--bg-1:#33363b;--bg-2:#3f4348;--bg-3:#4a4e54;--line:#24262a;--line-strong:#3d4147;--text:#d4d7da;--text-dim:#a2a7ad;--text-faint:#71767c;--accent:#ffbe00;--green:#8fd0a8;--rec:#e0523f}
*{box-sizing:border-box}html,body{margin:0;background:#1b1d20;color:var(--text);font:12px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}`

async function layoutBrowser(t, playwright) {
  try { return await playwright().chromium.launch() } catch (error) {
    const why = `no Chromium to lay Approvals out in: ${String(error?.message ?? error).split('\n')[0]}`
    if (process.env.CI) throw new Error(`${why} (CI installs it before this suite: desktop.yml)`)
    t.skip(why); return undefined
  }
}

const LINE = 'The command holds characters that are not shown here. Show raw has it as it was sent.'
const HELD = 'Held past its Wait: nobody answered, and On no answer holds it for you on Approvals.'

test('Approvals laid out: the tile says when its card cuts a command, a face holds what it stands on, and "not as sent" is whole in its cell (be2p rulings 2, 3, 4)', {timeout: 300_000}, async t => {
  const {bundleEntry, shellHtml, playwright} = await import('./support/agentShellHarness.mjs')
  const ui = fileURLToPath(new URL('..', import.meta.url))
  const {js, css} = await bundleEntry({contents: STAGE, resolveDir: ui, sourcefile: 'approvals-drawn-be2p.tsx', outfile: 'approvals-drawn-be2p.mjs'})
  const browser = await layoutBrowser(t, playwright)
  if (!browser) return
  try {
    const tab = await browser.newPage({viewport: {width: 1300, height: 760}})
    const errors = []
    tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
    await tab.setContent(shellHtml({js, css: `${FACES}\n${css}`}), {waitUntil: 'load'})
    await tab.waitForFunction(() => window.__ready, null, {timeout: 60_000}).catch(error => { throw Error(`${error.message} ${errors.join(' | ')}`) })

    // Ruling 2, as be2p-2 has it: on the 280 px tile a command wraps on up to four lines, so one of 20 or of 60 characters stands whole
    // and keeps Approve; one of 120 or of 300 is over the length rule, and four lines do not hold it either. A
    // long word with no space breaks inside the card. Each is drawn first of the two cards, beside one that fits.
    const command = n => 'curl -fsSL https://example.test/install.sh | sh -s -- --yes --prefix /opt/tools '.repeat(5).slice(0, n).trimEnd().padEnd(n, '!')
    const drawn = {}
    for (const [name, text] of [['20', command(20)], ['60', command(60)], ['word60', 'x'.repeat(60)], ['80', command(80)], ['120', command(120)], ['300', command(300)]]) {
      assert.equal(text.length, Number(name.replace('word', '')))
      const tile = await tab.evaluate(queue => window.__tile(queue), [{id: 'first', kind: 'request', who: 'Kite', text, where: 'execute'}, {id: 'short', kind: 'request', who: 'Kite', text: 'ls', where: 'execute'}])
      assert.equal(tile.width, 280, 'the tile at its own width')
      assert.deepEqual([tile.cards[0].words, tile.cards[0].inside], [text, true], `${name}: the command, inside its card`)
      assert.deepEqual([tile.cards[1].cut, tile.cards[1].mark, tile.cards[1].buttons], [false, null, ['Approve', 'Deny', 'Open']], `${name}: the short command beside it is whole`)
      drawn[name] = [tile.cards[0].cut, tile.cards[0].mark, tile.cards[0].buttons[0]]
      if (name === '20') assert.equal(tile.cards[0].lines, 1)
      if (name === '60' || name === 'word60' || name === '80') assert.ok(tile.cards[0].lines > 1 && tile.cards[0].lines <= 4, `${name}: it wraps, on ${tile.cards[0].lines} lines`)
      // Two cards with a command of four lines are taller than the tile: its cards scroll, so the second card's answers are reached.
      if (name === '300') assert.deepEqual(tile.reach, {scrolls: 'auto', over: true})
      if (name === '20') assert.deepEqual(tile.reach, {scrolls: 'auto', over: false})
      if (name === '120' || name === '300') assert.equal(tile.cards[0].lines, 4, `${name}: it fills four lines and no more`)
      if (name === '60') {
        // The measure is taken again when the card's size changes: squeezed until four lines do not hold the command, then given room again.
        assert.deepEqual(tile.wide.map(card => [card.cut, card.mark, card.buttons[0]]), [[true, 'cut short', 'Read as sent'], [false, null, 'Approve']], 'squeezed, the same card says it is cut and has no Approve')
        assert.deepEqual(tile.back.map(card => [card.cut, card.mark, card.buttons[0]]), [[false, null, 'Approve'], [false, null, 'Approve']], 'and at its own width again, the command is whole and Approve is back')
      }
    }
    assert.deepEqual(drawn, {20: [false, null, 'Approve'], 60: [false, null, 'Approve'], word60: [false, null, 'Approve'], 80: [false, null, 'Approve'],
      120: [true, 'cut short', 'Read as sent'], 300: [true, 'cut short', 'Read as sent']}, 'Approve stands for the commands shown whole, and for no other')
    // A command with a real line break: each break carries a mark; it is "not as sent" by the queue's own line, so Read as sent stands.
    const broken = await tab.evaluate(queue => window.__tile(queue), [{id: 'two', kind: 'request', who: 'Kite', text: 'echo one\nrm -rf ~', where: 'execute', differs: 'The command has 2 lines, drawn as one here. Show raw has it as it was sent.'}])
    assert.deepEqual([broken.cards[0].lines, broken.cards[0].breaks, broken.cards[0].cut, broken.cards[0].mark, broken.cards[0].buttons[0]], [2, 1, false, 'not as sent', 'Read as sent'])
    // A decision in its owner's words and a proposal are not commands: one line, cut or not, and answered where they stand.
    const sixty = command(60)
    const others = await tab.evaluate(queue => window.__tile(queue), [{id: 'u', kind: 'request', who: 'Factory', text: sixty, options: {allowOnce: 'Resume', deny: 'Cancel'}}, {id: 'p', kind: 'proposal', who: 'Kite', text: sixty, where: 'notes.md'}])
    assert.deepEqual(others.cards.map(card => [card.cut, card.mark, card.buttons[0]]), [[true, null, 'Resume'], [true, null, 'Approve']])

    // Ruling 4: the pane's list at three widths. The cell is 104 px; "not as sent" starts at its left edge and ends well inside it.
    const queue = [{id: 'a', kind: 'request', who: 'Kite', text: 'rm -rf ./build', where: 'execute', flag: HELD, differs: LINE},
      {id: 'b', kind: 'request', who: 'Kite', text: 'ls', where: 'execute', urgent: true, differs: LINE}, {id: 'c', kind: 'request', who: 'Kite', text: 'ls', where: 'execute', differs: LINE}]
    for (const width of [520, 760, 1200]) {
      const rows = await tab.evaluate(([w, q]) => window.__flags(w, q), [width, queue])
      assert.equal(rows.length, 3, `${width} px: three rows`)
      assert.equal(rows[0].said, `not as sent \u{b7} ${HELD}`)
      for (const row of rows) {
        assert.ok(Math.abs(row.cell - 104) < 0.5, `${width} px: the Flag cell is 104 px (${row.cell})`)
        assert.ok(row.starts < 1 && row.room > 16, `${width} px: "not as sent" stands whole in the cell, with room for the cut's mark after it (starts ${row.starts}, room ${row.room}): ${row.said}`)
      }
      assert.equal(rows[0].cut, true, `${width} px: the long flag is what the cell cuts`)
    }

    // Ruling 3: nothing chosen. The face stands on the first request and holds it as the choice; when that request leaves, it says so and
    // no answer is live; a row chosen again stands with its own answers.
    for (const view of ['full', 'whole']) {
      const seen = await tab.evaluate(v => window.__chosen(v), view)
      assert.deepEqual(seen.first.sets, [['pick', 'req-a']], `${view}: the face holds the item it stands on as the choice, once`)
      assert.deepEqual(seen.left.sets, [['pick', 'req-a']], `${view}: and chooses nothing by itself when that item leaves`)
      if (view === 'full') {
        assert.deepEqual([seen.first.what, seen.first.note, seen.first.answers], ['ls', null, ['Approve', 'Deny', 'Open']])
        assert.deepEqual([seen.left.what, seen.left.answers], [null, []], 'the pane: the next request is not drawn under Approve')
        assert.match(seen.left.note, /^The item that stood here is no longer in this list/)
        assert.deepEqual([seen.again.what, seen.again.note, seen.again.answers], ['rm -rf ~', null, ['Approve', 'Deny', 'Open']])
      } else {
        assert.deepEqual([seen.first.note, seen.first.answers], [null, ['Approve', 'Deny', 'Open']])
        assert.deepEqual([seen.left.note, seen.left.answers], ['The item chosen has left this list. Choose one in the queue.', []], 'the whole view: every answer stands disabled, with the words beside them')
        assert.deepEqual([seen.again.note, seen.again.answers], [null, ['Approve', 'Deny', 'Open']])
      }
    }
    assert.deepEqual(errors, [])
    const out = process.env.APPROVALS_DRAWN_CAPTURE
    if (out) {
      mkdirSync(out, {recursive: true})
      await tab.evaluate(q => window.__show(q), [{id: 'long', kind: 'request', who: 'Kite', text: sixty, where: 'execute'}, {id: 'longer', kind: 'request', who: 'Kite', text: command(300), where: 'execute'}, ...queue])
      writeFileSync(`${out}/approvals-be2p.png`, await tab.screenshot({fullPage: true}))
    }
  } finally { await browser.close() }
})
