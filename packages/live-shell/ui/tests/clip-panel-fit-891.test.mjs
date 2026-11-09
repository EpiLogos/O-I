// O-I #747 round 891: nothing in a Clip panel is cut. Walk 890 (capture 26, the Expressions Clip panel beside a long constellation ref)
// showed "Constella…" cut in its row's name, "Show in Bro" clipped beside the constellation, "Hot-swap" clipped beside Groove, Keep and
// Fit cut and Restore gone from the View row, and the scene's body (Carrier, Shows, Reference, Span) under the panel's edge, out of reach.
// One kind of fault: a panel row that gives its controls less room than their names. The guard reads every row and field of every tab
// of both panels, in every mode's clip, on its defaults, on each fixture and beside a long constellation ref with its source moved, at the
// kit's measure (panel.tsx nameWidth, the browser's sans at its size), and checks the stylesheet keeps what the measure assumes.
// Channel: SCRIPTED — the designs drawn to static markup through the transpiling loader (clip-source-constellation.test.mjs's).
import test, {mock} from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'
import {readFileSync} from 'node:fs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
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
  if (u.includes('?raw') || u.includes('.html') || u.endsWith('.svg') || u.endsWith('.png') || u.endsWith('.md')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage ??= {getItem: () => null, setItem: noop}

const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {nameWidth: kitWidth} = await import('../src/inhabitants/sdk/panel.tsx')
/** The kit's measure is the wider of Helvetica's advances and the system face's the shell is drawn in (-apple-system), letter by letter at 9
 * and 10 px (panel.tsx ADVANCE, O-I #858 r42): walk 891 read "Constellation" 63.3 px and "Engine composition" 93 off the drawn panel, and the
 * measure reads them 66.0 and 98.6. The guard reads every name at the kit's measure, the wider of the two, so a name the face draws wider than
 * Helvetica is not cut (r43: a tenth on top of a measure that already reads the face cut names the face draws whole). */
const nameWidth = kitWidth
const {MADE_OF, TAB_KEY, CLIP_ROOM} = await import('../src/inhabitants/catalogue/clips/design.ts')
const {GROUP_W} = await import('../src/inhabitants/catalogue/clips/clipKit.tsx')
const {loadClip, CLIP_MODES} = await import('../src/inhabitants/catalogue/clips/index.ts')

// ---------------------------------------------------------------- a small tree of React's static markup (device-grammar-748's)
const VOID = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'stop', 'use'])
function parse(html) {
  const root = {tag: '#root', attrs: {}, kids: [], parent: null}
  let at = root
  const re = /<(\/)?([a-zA-Z][\w:-]*)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*(\/)?>|([^<]+)/g
  let m
  while ((m = re.exec(html))) {
    if (m[5] !== undefined) { at.kids.push({tag: '#text', text: m[5]}); continue }
    const [, close, tag, rawAttrs, self] = m
    if (close) { let n = at; while (n && n.tag !== tag) n = n.parent; if (n && n.parent) at = n.parent; continue }
    const attrs = {}
    for (const a of rawAttrs.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? ''
    const node = {tag, attrs, kids: [], parent: at}
    at.kids.push(node)
    if (!self && !VOID.has(tag)) at = node
  }
  return root
}
const has = (n, c) => (n.attrs?.class ?? '').split(/\s+/).includes(c)
function* walk(n) { yield n; for (const k of n.kids ?? []) if (k.tag !== '#text') yield* walk(k) }
const all = (n, pred) => [...walk(n)].filter(pred)
const elements = n => (n.kids ?? []).filter(k => k.tag !== '#text')
const unescape = s => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const text = n => unescape(n.tag === '#text' ? n.text : (n.kids ?? []).map(text).join(''))

// ---------------------------------------------------------------- the kit's measure (clips.css, panel.css)
/** A panel's body: the group's width less the body's 8 px either side (.clv-body). */
const BODY_W = GROUP_W - 16
/** The row's name column at its least (.clv-rows), the gap after it, the gap between a row's controls (.clv-row-control), a field grid's
 * column gap (.clv-fields). */
const NAME_MIN = 56, NAME_GAP = 4, CONTROL_GAP = 3, FIELD_GAP = 6
/** A button's padding and border: an action or a toggle 6 px either side (.dp-action), a radio's button 3 px in a row (.clv-row-control). */
const BUTTON_X = 12 + 2, RADIO_X = 6 + 2, CHOOSER_X = 5 + 14 + 2
/** The least a field that gives way keeps: a chooser's value with its arrow, a fact's first words (a field squeezed under this reads as one
 * letter a line; walk 890: "wiki:nod / e:centra / l"), and a value box its number, five figures at most ("-180°", "0.25"). */
const FIELD_LEAST = 40, BOX_LEAST = 32

/** What a control in a row or a field needs across, at the kit's measure; `gives` where it may take less, down to FIELD_LEAST. */
function need(node) {
  if (has(node, 'dp-cell--action') || has(node, 'dp-cell--toggle')) {
    const button = all(node, n => n.tag === 'button' && (has(n, 'dp-action') || has(n, 'dp-toggle')))[0]
    return {name: text(button ?? node), px: nameWidth(text(button ?? node)) + BUTTON_X}
  }
  if (has(node, 'dp-cell--radio')) {
    const buttons = all(node, n => n.tag === 'button' && n.attrs.role === 'radio')
    return {name: buttons.map(text).join(' | '), px: buttons.reduce((sum, b) => sum + nameWidth(text(b)) + RADIO_X, 0)}
  }
  // A chooser shows its chosen option whole, whichever it is: its longest option, with the select's padding and border (.dp-chooser: 5 px
  // and the arrow's 14, a 1 px border either side). Walk 891 found the Groove row's "None" cut to "Nor" beside Hot-swap.
  if (has(node, 'dp-cell--chooser')) {
    const options = all(node, n => n.tag === 'option').map(text)
    const longest = options.reduce((a, b) => (nameWidth(b) > nameWidth(a) ? b : a), '')
    return {name: `${(node.attrs['data-i'] ?? '').split('|')[0]} (${longest})`, px: nameWidth(longest) + CHOOSER_X}
  }
  if (has(node, 'clv-source-mark')) return {name: text(node), px: nameWidth(text(node), 9.5)}
  if (has(node, 'clv-tag')) return {name: text(node), px: nameWidth(text(node), 10.5)}
  return {name: (node.attrs['data-i'] ?? text(node)).split('|')[0], px: has(node, 'dp-cell--box') ? BOX_LEAST : FIELD_LEAST, gives: true}
}

/** Every row and field of a tab's body, with its faults: a row's name its column cuts, a control its room cuts. */
function faultsIn(markup, where) {
  const faults = []
  const tree = parse(markup)
  for (const rows of all(tree, n => has(n, 'clv-rows'))) {
    const own = elements(rows).filter(n => has(n, 'clv-row'))
    const names = own.map(row => elements(row).find(n => has(n, 'clv-row-label'))).filter(Boolean).map(text)
    const column = Math.max(NAME_MIN, ...names.map(name => Math.ceil(nameWidth(name))))
    for (const row of own) {
      const name = text(elements(row).find(n => has(n, 'clv-row-label')) ?? {tag: '#text', text: ''})
      const control = elements(row).find(n => has(n, 'clv-row-control'))
      if (!control) continue
      // A row with no name is the line under the one above (Show in Browser under Constellation, as Live's sample buttons stand under its
      // name): it takes the panel's width.
      // A row marked `under` stands its control on the line under its name, across the panel's width.
      const room = name && !has(row, 'clv-row--under') ? BODY_W - column - NAME_GAP : BODY_W
      const cells = elements(control).map(need)
      const needs = cells.reduce((sum, cell) => sum + cell.px, 0) + CONTROL_GAP * Math.max(0, cells.length - 1)
      if (needs > room + 0.5) faults.push(`${where} · ${name || '(under the row above)'}: ${cells.map(cell => `"${cell.name}"`).join(' + ')} need ${Math.ceil(needs)} px, the row gives ${Math.floor(room)}`)
    }
  }
  for (const fields of all(tree, n => has(n, 'clv-fields'))) {
    const cols = Number(fields.attrs.style?.match(/repeat\((\d+)/)?.[1] ?? 2)
    const col = (BODY_W - FIELD_GAP * (cols - 1)) / cols
    for (const cell of elements(fields)) {
      const wide = has(cell, 'clv-wide')
      for (const one of wide ? elements(cell) : [cell]) {
        const {name, px, gives} = need(one)
        if (!gives && px > (wide ? BODY_W : col) + 0.5) faults.push(`${where} · field "${name}": needs ${Math.ceil(px)} px, its column gives ${Math.floor(wide ? BODY_W : col)}`)
      }
    }
  }
  return faults
}

/** A long constellation ref, its name, and its source moved since the clip was made, with a scene on the default framing: the state walk
 * 890 caught; and a scene's file moved since (round 891, under its Reference). */
const LONG = {[MADE_OF.name]: 'wiki:node:project-root/o-i/the-lived-in-world', [MADE_OF.ref]: 'wiki:node:project-root/o-i/the-lived-in-world', [MADE_OF.mark]: 'source moved',
  view: 'default', reference: 'central:notes/a-long-file-name-under-the-scene.md', 'body.mark': 'source moved'}

async function everyTab() {
  const out = []
  for (const mode of CLIP_MODES) {
    const design = await loadClip(mode)
    for (const [state, fixture] of [['defaults', {}], ...Object.entries(design.fixtures ?? {}), ['a long constellation ref, moved', LONG]]) {
      const v = {...design.defaults}
      for (const [k, x] of Object.entries(fixture)) { if (x === undefined) delete v[k]; else v[k] = x }
      for (const place of ['panel', 'tools']) {
        for (const tab of design[place].filter(t => !t.shows || t.shows(v))) {
          const p = {v: {...v, [TAB_KEY[place]]: tab.id}, set: noop, size: 'detail', room: CLIP_ROOM.detail}
          out.push({where: `${mode} · ${tab.label} · ${state}`, markup: renderToStaticMarkup(createElement('div', null, tab.draw(p)))})
        }
      }
    }
  }
  return out
}

test('no Clip panel cuts a row\'s name or a control: every row and field of every tab, in every mode, gives each name its width at the kit\'s measure', async () => {
  const tabs = await everyTab()
  const faults = new Set(tabs.flatMap(({where, markup}) => faultsIn(markup, where)))
  const rows = tabs.reduce((sum, {markup}) => sum + (markup.match(/class="clv-row[ "]/g) ?? []).length, 0)
  console.log(`[clip panels] ${tabs.length} tabs drawn, ${rows} rows read`)
  assert.ok(tabs.length > 60 && rows > 300, `the guard reads the clips' panels: ${tabs.length} tabs, ${rows} rows`)
  assert.deepEqual([...faults], [], 'a name or a control cut in a Clip panel')
})

test('the kit gives a field or a row the room its names need, so no panel sets it by hand: a field too wide for its column spans the panel, a row too wide beside its name stands under it (O-I #858 r43)', async () => {
  const kit = await import('../src/inhabitants/catalogue/clips/clipKit.tsx')
  const {Toggle, Chooser, Radio} = await import('../src/inhabitants/sdk/panel.tsx')
  const draw = node => renderToStaticMarkup(createElement('div', null, node))
  const fields = (...cells) => draw(createElement(kit.Fields, null, ...cells))
  const short = createElement(Toggle, {key: 's', label: 'Loop', on: true}), long = createElement(Toggle, {key: 'l', label: 'A selection tool, named long', on: true})
  assert.doesNotMatch(fields(short), /clv-wide/, 'a field that fits its column keeps it')
  assert.match(fields(short, long), /<div class="clv-wide"><div[^>]*dp-cell--toggle[^>]*data-i="A selection tool, named long/, 'a field its names outgrow spans the panel')
  const choose = label => createElement(Chooser, {label: 'Follow action', value: 'a', options: [{value: 'a', label}]})
  const rows = label => draw(createElement(kit.Rows, null, createElement(kit.Row, {label: 'Follow'}, choose(label))))
  assert.match(rows('Next'), /class="clv-row"/, 'a control that fits beside its name stands beside it')
  assert.match(rows('Jump to the scene it names'), /class="clv-row clv-row--under"/, 'one its names outgrow stands under its name')
  const radios = draw(createElement(kit.Rows, null, createElement(kit.Row, {label: 'Align'}, createElement(Radio, {label: 'Alignment', value: 'l',
    options: ['Left', 'Centre', 'Right', 'Justified'].map(x => ({value: x[0].toLowerCase(), label: x}))}))))
  assert.match(radios, /clv-row--under/, 'so do radios side by side')
  assert.deepEqual(faultsIn(fields(short, long) + rows('Jump to the scene it names') + radios, 'made up'), [], 'and the guard finds nothing cut')
})

test('the stylesheet keeps what the measure assumes: a row\'s names set their column, a nameless row takes the width, a button keeps its name, a chooser its options, a body too tall for its room scrolls', () => {
  const css = readFileSync(new URL('../src/inhabitants/catalogue/clips/clips.css', import.meta.url), 'utf8')
  const rule = selector => css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? ''
  assert.match(rule('.clv-rows'), /grid-template-columns: minmax\(56px, max-content\) minmax\(0, 1fr\)/, 'the name column is as wide as the longest name, at least 56 px')
  assert.match(rule('.clv-row'), /display: contents/, 'each row\'s name and control stand in the rows\' one grid')
  assert.match(rule('.clv-row--whole > .clv-row-control, .clv-row--under > .clv-row-control'), /grid-column: 1 \/ -1/,
    'a row with no name, and a control marked to stand under its name, take the panel\'s width')
  assert.match(rule('.clv-row-control'), /flex-wrap: wrap/, 'what a row cannot hold beside a chooser goes to the line under, never over its edge')
  assert.match(rule('.clv-row-control > .dp-cell--chooser'), /flex: 1 0 auto/, 'a chooser keeps the width of its options')
  assert.doesNotMatch(rule('.clv-row-label'), /ellipsis|overflow: hidden/, 'a row\'s name is never shortened')
  assert.match(rule('.clv-row-control > .dp-cell--action, .clv-row-control > .dp-cell--toggle, .clv-row-control > .dp-cell--radio'), /min-width: max-content/,
    'a button never takes less than its name')
  assert.match(rule('.clv-body'), /overflow-y: auto/, 'a body taller than its room scrolls, and nothing falls out of reach')
  assert.doesNotMatch(rule('.clv-body'), /overflow: hidden/)
})

// Walk of O-I 857, O4 (DLW build ruling 2026-11-07, ruling 6): quick arrow steps on a clip's value box could repeat a value. Each step
// started from the reading, which the owner answers only after the write before it lands, so two steps sent the same value and one
// was lost. By G10's one-after-another rule, a step now starts from the value the step before it sent while the reading still stands
// on a value of that run of steps, and from the reading once it is the hand's last value or moves elsewhere.
test('quick key steps on a value box each start from the step before, while the owner has not answered it', async () => {
  const {keyStepFrom} = await import('../src/inhabitants/sdk/panel.tsx')
  let sent = null, reading = 4
  const press = () => { const {from, seen} = keyStepFrom(sent, reading); const next = from + 1; sent = {seen: [...seen, next], to: next}; return next }
  assert.equal(press(), 5, 'the first step starts from the reading')
  assert.equal(press(), 6, 'the second, with the first in flight, from the first')
  reading = 5
  assert.equal(press(), 7, 'the reading answers the first: the third still starts from the second')
  reading = 7
  assert.equal(press(), 8, 'caught up: from the reading')
  reading = 2
  assert.equal(press(), 3, 'moved elsewhere: from the reading')
  const panel = readFileSync(new URL('../src/inhabitants/sdk/panel.tsx', import.meta.url), 'utf8')
  assert.match(panel, /onKeyDown: \(e: KeyboardEvent<Element>\) => \{[^]*?keyStepFrom\(sent\.current, value, at[,)]/, 'the scalar controls\' keys step this way, at the press\'s time')
})

// Walk of O-I 857, round 47 LN11 (G17's Sample tab, r47-LN11-b-07-set): six quick Gain steps moved the clip four. The set's owner keeps
// an audio clip's gain linear, so the reading comes back through dB a hair off the value the step sent (0.10000000000000821 for
// 0.10000000000000853), and an answer drawn late stood on an older value of the run. The run took either for a value elsewhere and
// started again from the reading. A reading is a value of the run when it is within a hair of one.
test('a run of key steps holds while the reading comes back through the owner\'s own units, or late, a hair off what was sent', async () => {
  const {keyStepFrom, fromUnit, toUnit} = await import('../src/inhabitants/sdk/panel.tsx')
  const {SAMPLE_GAIN} = await import('../src/live/clipBinding.ts')
  const gain = {min: -70, max: 3, step: 0.1}, unit = 1 / 730
  const back = db => SAMPLE_GAIN.toDesign(SAMPLE_GAIN.toSet(db))
  let sent = null, reading = 0
  const press = () => { const {from, seen} = keyStepFrom(sent, reading); const next = fromUnit(gain, toUnit(gain, from) + unit); sent = {seen: [...seen, next], to: next}; return next }
  const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} for ${b}`)
  const first = press(); near(first, 0.1, 'the first step starts from the reading')
  near(press(), 0.2, 'the second, with the first in flight, from the first')
  reading = back(first)
  assert.notEqual(reading, first, 'the owner answers the first in its own units, a hair off what was sent')
  near(press(), 0.3, 'and the third still starts from the second')
  near(press(), 0.4, 'the fourth from the third')
  reading = back(first)
  near(press(), 0.5, 'an answer drawn late, on an older value of the run, does not start the run again')
  reading = back(sent.to)
  near(press(), 0.6, 'caught up, in the owner\'s units: from the reading')
  reading = -12
  near(press(), -11.9, 'moved elsewhere: from the reading')
})

// The same walk, again (r47-LN11-b-08-gain-steps, its second take): while a write is in flight the dial draws the hand's own last value,
// so the reading stood on the run's last value before the owner had answered it, and the run began again there; the owner's answers,
// a step behind, then stood outside the new run. The reading drawn at each of six presses 150 ms apart, as walked: 1.2, 1.3 (the
// hand's), 1.3, 1.4, 1.6 (the hand's), 1.5 (the owner's). A run lasts while the hand keeps pressing; a press after a pause starts from
// the reading.
test('a run of key steps holds while the dial draws the hand\'s own value ahead of the owner, and ends when the hand pauses', async () => {
  const {keyStepFrom, fromUnit, toUnit, KEY_RUN_MS} = await import('../src/inhabitants/sdk/panel.tsx')
  const {SAMPLE_GAIN} = await import('../src/live/clipBinding.ts')
  const gain = {min: -70, max: 3, step: 0.1}, unit = 1 / 730
  const back = db => SAMPLE_GAIN.toDesign(SAMPLE_GAIN.toSet(db))
  let sent = null, now = 0
  const press = reading => { const {from, seen} = keyStepFrom(sent, reading, now); const next = fromUnit(gain, toUnit(gain, from) + unit); sent = {seen: [...seen, next], to: next, at: now}; now += 150; return next }
  const sentValues = []
  const hand = () => sent.to, start = back(1.2)
  sentValues.push(press(start))
  sentValues.push(press(hand()))
  sentValues.push(press(back(1.3)))
  sentValues.push(press(back(1.4)))
  sentValues.push(press(hand()))
  sentValues.push(press(back(1.5)))
  assert.deepEqual(sentValues.map(v => Math.round(v * 10) / 10), [1.3, 1.4, 1.5, 1.6, 1.7, 1.8], 'six presses, six steps')
  assert.ok(KEY_RUN_MS > 150 && KEY_RUN_MS <= 2000, `a run is a hand pressing on: ${KEY_RUN_MS} ms`)
  now += KEY_RUN_MS
  assert.ok(Math.abs(press(back(1.5)) - 1.6) < 1e-9, 'after a pause, the reading is where the next press starts (an undo, another hand)')
})

// Fresh review of O-I #939, item 9 (DLW build ruling 2026-11-09, 47c item 9): a run held while the reading stood on any value of it, so an
// undo or another hand that put the value back on one of the run's values, mid-run, was taken for the owner's late answer, and the next
// press stepped from the run's last value. Where the value read differs from the run's `to` because an undo or another hand changed it,
// the next press steps from the value read.
test('a key step after an undo, mid-run, starts from the value the undo left, not from the run\'s last step', async () => {
  const {keyStepFrom} = await import('../src/inhabitants/sdk/panel.tsx')
  const {recordStep, undoStep, redoStep, clearUndo} = await import('../src/frame/menu/undo.ts')
  clearUndo()
  let sent = null, reading = 4
  const press = () => {
    const {from, seen, runs} = keyStepFrom(sent, reading, 0)
    const next = from + 1, before = from
    sent = {seen: [...seen, next], to: next, at: 0, runs}
    recordStep({label: 'Gain', undo: () => { reading = before }, redo: () => { reading = next }})
    return next
  }
  assert.equal(press(), 5)
  assert.equal(press(), 6)
  reading = 6
  await undoStep()
  assert.equal(reading, 5, 'the undo put the value back on a value of the run')
  assert.equal(press(), 6, 'the next press steps from what the undo left')
  reading = 5
  assert.equal(press(), 7, 'and a new run holds over the owner\'s late answer as before')
  // A lone redo, mid-run (round 48 item 0C-4: the redo half bites). The run's presses are not recorded here, so the redo is of a change
  // made before the run (the value typed, say); it leaves the reading on a value of the run other than its last.
  clearUndo()
  sent = null; reading = 10
  recordStep({label: 'Gain typed', undo: () => { reading = 10 }, redo: () => { reading = 11 }})
  await undoStep()
  assert.equal(reading, 10)
  const plain = () => { const {from, seen, runs} = keyStepFrom(sent, reading, 0); const next = from + 1; sent = {seen: [...seen, next], to: next, at: 0, runs}; return next }
  assert.equal(plain(), 11)
  assert.equal(plain(), 12, 'the owner has not answered: from the run')
  await redoStep()
  assert.equal(reading, 11, 'the redo left the reading on a value of the run, not its last')
  assert.equal(plain(), 12, 'a redo ends the run too, and the press steps from what it left')
  clearUndo()
})

test('a key step after another hand moved the value, mid-run, starts from the value read', async () => {
  const {keyStepFrom} = await import('../src/inhabitants/sdk/panel.tsx')
  let sent = null
  const press = (reading, by) => { const {from, seen, runs} = keyStepFrom(sent, reading, 0, by); const next = from + 1; sent = {seen: [...seen, next], to: next, at: 0, runs, by}; return next }
  assert.equal(press(4), 5)
  assert.equal(press(4), 6, 'the owner has not answered: from the run')
  assert.equal(press(5, 'Kev'), 6, 'Kev put the value on 5, a value of the run: the press steps from 5')
  assert.equal(press(5, 'Kev'), 7, 'the name still standing from that move is not a second move: the new run holds')
  assert.equal(press(6), 8, 'the name gone, the owner\'s late answer holds the run')
  assert.equal(press(7, 'the sky'), 8, 'another hand again: from the value read')
  const panel = readFileSync(new URL('../src/inhabitants/sdk/panel.tsx', import.meta.url), 'utf8')
  assert.match(panel, /onKeyDown: \(e: KeyboardEvent<Element>\) => \{[^]*?keyStepFrom\(sent\.current, value, at, movedBy\)[^]*?sent\.current = \{seen: \[\.\.\.seen, next\], to: next, at, runs, by: movedBy\}/,
    'the scalar controls\' keys know who moved the value, and keep it with the run')
  for (const control of ['Dial', 'ValueBox'])
    assert.match(panel, new RegExp(`export function ${control}\\([^]*?useScalar\\(scale, known \\? value : scale\\.min, def, live, moverOf\\(standing\\)\\)`), `${control} tells its keys who moved the value`)
})

// Delta review of O-I #939's follow-up, finding 2 (DLW build ruling 2026-11-09, round 48 item 0C-2): the Sample tab's Gain dial stopped at
// +3 dB, so a clip the set keeps at +6 dB drew pinned at the end, and ArrowUp stepped from the clamp and wrote +3 dB: a press to raise the
// gain lowered it. The dial's scale follows the reading: above +3 dB it draws the clip at its own value, and a step starts from there.
// Driven through the Live clip's own Sample tab, its Gain Dial and the Dial's own key handler.
test('a clip above the Gain dial\'s +3 dB is drawn at its own value, and a key never writes it down', async () => {
  const {Dial} = await import('../src/inhabitants/sdk/panel.tsx')
  const design = await loadClip('live')
  const sample = design.panel.find(tab => tab.id === 'sample')
  const find = (node, match) => {
    if (!node || typeof node !== 'object') return null
    if (Array.isArray(node)) { for (const kid of node) { const hit = find(kid, match); if (hit) return hit } return null }
    if (match(node)) return node
    return find(node.props?.children, match)
  }
  const gainAt = db => {
    const set = []
    const p = {v: {...design.defaults, [TAB_KEY.panel]: 'sample', gain: db, warp: true}, set: (key, value) => set.push([key, value]), size: 'detail', room: CLIP_ROOM.detail}
    const dial = find(sample.draw(p), node => node.type === Dial && node.props.label === 'Gain')
    assert.ok(dial, 'the Sample tab draws a Gain dial')
    let svg = null
    const Probe = () => { const drawn = Dial(dial.props); svg = find(drawn, node => node.type === 'svg'); return drawn }
    const markup = renderToStaticMarkup(createElement(Probe))
    return {dial, svg, set, markup}
  }
  const loud = 20 * Math.log10(2)
  const {dial, svg, set, markup} = gainAt(loud)
  assert.equal(dial.props.scale.max, loud, 'the dial\'s top is the reading (0E item 2)')
  assert.match(markup, new RegExp(`aria-valuenow="${loud}"`), 'drawn at its own value')
  svg.props.onKeyDown({key: 'ArrowUp', shiftKey: false, preventDefault() {}})
  assert.deepEqual(set, [], 'ArrowUp at the top, the clip\'s own gain, writes nothing (0E item 2)')
  svg.props.onKeyDown({key: 'ArrowDown', shiftKey: false, preventDefault() {}})
  assert.equal(set.length, 1, 'one step written')
  assert.ok(set[0][1] < loud && set[0][1] > loud - 0.2, `ArrowDown steps down from the gain: ${set[0][1]} from ${loud}`)
  // The normal ceiling stands: a clip at or under +3 dB has the dial's +3 dB top.
  assert.equal(gainAt(0).dial.props.scale.max, 3)
  assert.equal(gainAt(3).dial.props.scale.max, 3)
})

// 0D item 2 (review of O-I #943, finding 2; DLW build ruling 2026-11-09): the dial's own +3 dB write reads back as 3.0000000000000004 (10 **
// (3 / 20) back to dB), which lifted its scale to +3.1 dB, so End then ArrowUp climbed past the ceiling a step at a time; and above +3 dB a
// drag at the end of travel climbed a step on every move, whatever the hand moved. The scale lifts only for a reading above +3 dB on the
// dial's grid, and holds the top it had when the hand took the control. Driven through the Sample tab's Gain scale and the kit's own
// hands, drawn again on each reading the owner gives back, as React draws them.
test('the Gain dial\'s ceiling holds at +3 dB through its own round trip, and a drag above it moves as far as the hand', async () => {
  const {scalarHands} = await import('../src/inhabitants/sdk/panel.tsx')
  const {gainScale} = await import('../src/inhabitants/catalogue/clips/live.tsx')
  const {SAMPLE_GAIN} = await import('../src/live/clipBinding.ts')
  const read = db => SAMPLE_GAIN.toDesign(SAMPLE_GAIN.toSet(db))
  const el = {setPointerCapture() {}, closest: () => null}
  const key = name => ({key: name, shiftKey: false, preventDefault() {}})
  const control = start => {
    const hold = {drag: {current: null}, hand: {current: 0}, sent: {current: null}, taken: {current: null}}
    const state = {reading: start, written: []}
    state.hands = () => scalarHands(hold, gainScale(state.reading), state.reading, 0, x => { state.written.push(x); state.reading = read(x) })
    return state
  }
  const keyed = control(0)
  keyed.hands().onKeyDown(key('End'))
  assert.equal(keyed.written.at(-1), 3, 'End writes the ceiling')
  assert.ok(keyed.reading > 3, `the set gives it back a hair over: ${keyed.reading}`)
  assert.equal(gainScale(keyed.reading).max, 3, 'a hair over is the ceiling on the dial\'s grid')
  keyed.hands().onKeyDown(key('ArrowUp'))
  assert.deepEqual(keyed.written, [3], 'ArrowUp in the same run writes nothing more: it stays at +3 dB')
  const fresh = control(read(3))
  fresh.hands().onKeyDown(key('ArrowUp'))
  assert.deepEqual(fresh.written, [], 'ArrowUp from the read-back ceiling, in a run of its own, writes nothing: it stays at +3 dB')
  // From +6 dB a drag up writes nothing, past the end of travel too; 12 one-pixel moves down go as far as 12 px of the dial's travel
  // (about 0.09 dB, one step), on the top the dial had when the hand took it.
  const dragged = control(6)
  dragged.hands().onPointerDown({button: 0, clientY: 500, pointerId: 1, currentTarget: el})
  for (let px = 1; px <= 400; px++) dragged.hands().onPointerMove({clientY: 500 - px, shiftKey: false, currentTarget: el})
  assert.deepEqual(dragged.written, [], 'a drag up from the top writes nothing')
  for (let px = 1; px <= 12; px++) dragged.hands().onPointerMove({clientY: 100 + px, shiftKey: false, currentTarget: el})
  assert.ok(Math.abs(dragged.reading - 5.9) < 1e-9, `12 px down from +6 dB moves one step: ${dragged.reading}`)
  dragged.hands().onPointerUp({currentTarget: el})
})

// 0E item 2 (delta review of O-I #943, findings 3 and 5; DLW build ruling 2026-11-09): above +3 dB the dial's keys climbed a step a run
// (five ArrowUps from +6 dB wrote 6.1 five times), and a clip at +3.03 dB was written down to +3 dB on its first touch. The dial's top is
// the reading: up writes nothing, down steps from it, and a run of keys never sends again the value it last sent. Driven through the Sample
// tab's Gain scale and the kit's own hands, drawn again on each reading the owner gives back, as React draws them.
test('0E: above +3 dB the Gain dial raises nothing, steps down from the reading, and a run of keys never resends its last value', async () => {
  const {scalarHands} = await import('../src/inhabitants/sdk/panel.tsx')
  const {gainScale} = await import('../src/inhabitants/catalogue/clips/live.tsx')
  const {SAMPLE_GAIN} = await import('../src/live/clipBinding.ts')
  const read = db => SAMPLE_GAIN.toDesign(SAMPLE_GAIN.toSet(db))
  const el = {setPointerCapture() {}, closest: () => null}
  const key = name => ({key: name, shiftKey: false, preventDefault() {}})
  const control = start => {
    const hold = {drag: {current: null}, hand: {current: 0}, sent: {current: null}, taken: {current: null}}
    const state = {reading: start, written: []}
    state.hands = () => scalarHands(hold, gainScale(state.reading), state.reading, 0, x => { state.written.push(x); state.reading = read(x) })
    return state
  }
  const touch = (state, name) => state.hands().onKeyDown(key(name))
  const drag = (state, px) => {
    state.hands().onPointerDown({button: 0, clientY: 500, pointerId: 1, currentTarget: el})
    state.hands().onPointerMove({clientY: 500 - px, shiftKey: false, currentTarget: el})
    state.hands().onPointerUp({currentTarget: el})
  }
  const loud = control(6)
  for (let i = 0; i < 5; i++) touch(loud, 'ArrowUp')
  touch(loud, 'End'); touch(loud, 'PageUp'); drag(loud, 1); drag(loud, 40)
  assert.deepEqual(loud.written, [], 'ArrowUp five times, End, PageUp and a drag up from +6 dB write nothing')
  touch(loud, 'ArrowDown')
  assert.equal(loud.written.length, 1)
  assert.ok(Math.abs(loud.written[0] - 5.9) < 1e-9, `ArrowDown steps down from the reading: ${loud.written[0]}`)
  // 0G item 3 (DLW build ruling 2026-11-09, review finding 2): each key takes the scale drawn at that key. At +5.9 dB the dial's top is
  // the reading again, so ArrowUp writes nothing: above the ceiling the dial only goes down, by design, and ⌘Z undoes a stray step.
  touch(loud, 'ArrowUp')
  assert.equal(loud.written.length, 1, `ArrowUp after ArrowDown from +6 dB writes nothing: ${loud.written}`)
  for (let i = 0; i < 2; i++) touch(loud, 'ArrowDown')
  touch(loud, 'ArrowUp')
  assert.equal(loud.written.length, 3, `two more ArrowDowns write 5.8 and 5.7, and ArrowUp nothing: ${loud.written}`)
  assert.ok(Math.abs(loud.written[2] - 5.7) < 1e-9, `${loud.written}`)
  // +3.03 dB is louder than the ceiling: a touch writes nothing, never +3 dB.
  assert.equal(gainScale(3.03).max, 3.03)
  assert.equal(gainScale(3.0000000000000004).max, 3, 'the dial\'s own +3 dB, read back a hair over, keeps the +3 dB scale')
  const kept = control(3.03)
  touch(kept, 'ArrowUp'); touch(kept, 'End'); touch(kept, 'PageUp'); drag(kept, 1)
  assert.deepEqual(kept.written, [], 'a touch at +3.03 dB writes nothing')
  // 0G item 3 (review info 4): from +3.03 dB, ArrowDown steps down from the reading, past the grid's +3 dB, to 2.9: as ruled.
  const just = control(3.03)
  touch(just, 'ArrowDown')
  assert.equal(just.written.length, 1)
  assert.ok(Math.abs(just.written[0] - 2.9) < 1e-9, `ArrowDown from +3.03 dB writes 2.9: ${just.written}`)
  // A run of keys never sends again the value it last sent, at the ceiling or the floor.
  const run = control(0)
  touch(run, 'End'); touch(run, 'End'); touch(run, 'ArrowUp'); touch(run, 'PageUp')
  assert.deepEqual(run.written, [3], 'End writes the ceiling once')
  const floor = control(-70)
  touch(floor, 'ArrowDown'); touch(floor, 'Home'); touch(floor, 'PageDown')
  assert.deepEqual(floor.written, [], 'nothing below the floor')
})

// Delta review of O-I #939's follow-up, finding 1 (DLW build ruling 2026-11-09, round 48 item 0C-1): the clip binding named no mover,
// so a value another hand put on a step of the run was taken for the owner's late answer. The clip binding knows what this panel sent:
// a reading that is neither the last one read nor an answer to a pending send of this panel was moved by another hand, and the binding
// says so (`movedBy`). Driven through the clip binding and the host's standing, into the key's own rule.
test('the clip binding names another hand when the set is read again on a value this panel did not send, and the run ends there', async () => {
  const {clipBinding} = await import('../src/frame/detail/clipBinding.ts')
  const {hostedStanding} = await import('../src/frame/devices/deviceHost.tsx')
  const {keyStepFrom} = await import('../src/inhabitants/sdk/panel.tsx')
  const written = []
  const wiring = {reads: {gain: 'live_clip_read'}, acts: {gain: async value => { written.push(value) }}, view: {}, refused: {}}
  const ref = `review-939-1-${Math.random()}`
  const bind = gain => clipBinding({mode: 'live', ref, values: {gain}, wiring})
  const mover = binding => hostedStanding({drafts: {}, sent: {}, refused: {}}, binding, ['gain']).gain?.movedBy
  let binding = bind(4), sent = null
  assert.equal(mover(binding), undefined, 'the first reading is no move')
  const press = async () => {
    const {from, seen, runs} = keyStepFrom(sent, binding.values.gain, 0, mover(binding))
    const next = from + 1
    sent = {seen: [...seen, next], to: next, at: 0, runs, by: mover(binding)}
    await binding.write([{key: 'gain', value: next}])
    return next
  }
  assert.equal(await press(), 5)
  assert.equal(await press(), 6, 'the owner has not answered: from the run')
  binding = bind(5)
  assert.equal(mover(binding), undefined, 'the owner\'s answer to this panel\'s own send of 5 is no move')
  assert.equal(await press(), 7, 'its late answer holds the run')
  binding = bind(7)
  assert.equal(mover(binding), undefined, 'caught up: the answer to the last send')
  // Another writer puts the gain on 6, a value of the run, after the owner answered 7: no send of this panel is pending on it.
  binding = bind(6)
  assert.equal(mover(binding), 'another hand', 'the set read again on a value this panel did not send')
  assert.equal(await press(), 7, 'the next press steps from what the other hand left, not from the run\'s 7')
  binding = bind(7)
  assert.equal(mover(binding), undefined, 'this panel\'s own send answered: the name goes')
  // And again, while a send of this panel is pending: a reading that answers none of them is another hand.
  assert.equal(await press(), 8)
  binding = bind(5)
  assert.equal(mover(binding), 'another hand', 'a second move by another hand shows the one name (0E item 5)')
  assert.equal(binding.standing.gain.move, 2, 'and is counted apart from the first, inside')
  assert.equal(await press(), 6, 'from the value read')
  assert.deepEqual(written, [5, 6, 7, 7, 8, 6])
})

// 0D items 3, 5 and 6 (review of O-I #943, findings 3, 5 and 6; DLW build ruling 2026-11-09): "another hand" was named for moves the
// person made. A key with no reading, then its first reading (P1); a linked key the owner moves with this panel's own send (P2: a Length
// moves End); an envelope's points given back a hair off in the owner's units (P3); the person's own undo (P4). And a send the owner
// never answered stood in the trail for good, so a later move to its value was taken for this panel's (the 4, 5, 4 case); a send whose
// write was refused stood there too. Two moves by other hands now read apart. Driven through the clip binding and the host's standing.
test('the clip binding names only another hand: no reading, a linked key, a hair off, an undo and an old send are this panel\'s', async () => {
  const {clipBinding, LATE_KEPT_MS} = await import('../src/frame/detail/clipBinding.ts')
  const {hostedStanding, CONFIRM_GRACE_MS} = await import('../src/frame/devices/deviceHost.tsx')
  const {endKeyRuns} = await import('../src/inhabitants/sdk/panel.tsx')
  mock.timers.enable({apis: ['Date'], now: 1_000_000})
  try {
    const refusals = new Set()
    const act = key => async value => { if (refusals.has(value)) throw new Error(`The set refuses ${key} ${value}`) }
    const keys = ['gain', 'start', 'end', 'length', 'env.mixer.volume']
    const wiring = {reads: {}, acts: Object.fromEntries(keys.map(key => [key, act(key)])), view: {}, refused: {}}
    const clip = () => {
      const ref = `review-943-${Math.random()}`
      const bind = values => clipBinding({mode: 'live', ref, values, wiring})
      return {bind, mover: (binding, key) => hostedStanding({drafts: {}, sent: {}, refused: {}}, binding, [key])[key]?.movedBy}
    }
    // P1: a key the owner had not read, then reads, is no move.
    let {bind, mover} = clip()
    assert.equal(mover(bind({}), 'gain'), undefined)
    assert.equal(mover(bind({gain: 4}), 'gain'), undefined, 'a first reading after none is no move')
    assert.equal(mover(bind({}), 'gain'), undefined, 'no reading is no move')
    assert.equal(mover(bind({gain: 4}), 'gain'), undefined, 'and the reading again is none either')
    // P2: this panel sends Length; the owner moves End with it in the same reading.
    ;({bind, mover} = clip())
    let binding = bind({start: 0, end: 4, length: 4})
    await binding.write([{key: 'length', value: 6}])
    binding = bind({start: 0, end: 6, length: 6})
    assert.equal(mover(binding, 'end'), undefined, 'End moved with this panel\'s own Length')
    assert.equal(mover(binding, 'length'), undefined)
    binding = bind({start: 0, end: 7, length: 6})
    assert.equal(mover(binding, 'end'), 'another hand', 'End moved alone, with no send of this panel awaited, is another hand\'s')
    // P3: an envelope point written as -3.4271 dB comes back -3.4270999999999994 (dB to linear and back).
    ;({bind, mover} = clip())
    binding = bind({'env.mixer.volume': JSON.stringify([[0, 0], [1, -6]])})
    await binding.write([{key: 'env.mixer.volume', value: JSON.stringify([[0, 0], [1, -3.4271]])}])
    binding = bind({'env.mixer.volume': JSON.stringify([[0, 0], [1, -3.4270999999999994]])})
    assert.equal(mover(binding, 'env.mixer.volume'), undefined, 'the owner\'s answer a hair off is this panel\'s own')
    // P4: the person's undo puts the gain back; the owner's reading of it is no other hand's.
    ;({bind, mover} = clip())
    binding = bind({gain: 4})
    await binding.write([{key: 'gain', value: 5}])
    binding = bind({gain: 5})
    endKeyRuns()
    assert.equal(mover(bind({gain: 4}), 'gain'), undefined, 'the person\'s undo is no other hand')
    // Item 5: sends 4, 5 and 4, answered by one reading of 4. The 5 the owner never read expires a grace after its write; another hand's
    // 5 after that is named.
    ;({bind, mover} = clip())
    binding = bind({gain: 3})
    for (const value of [4, 5, 4]) await binding.write([{key: 'gain', value}])
    binding = bind({gain: 4})
    assert.equal(mover(binding, 'gain'), undefined)
    mock.timers.tick(CONFIRM_GRACE_MS + LATE_KEPT_MS + 1)
    assert.equal(mover(bind({gain: 5}), 'gain'), 'another hand', 'a send the owner never answered is gone, late too, after its grace and 30 s')
    // A refused write leaves nothing awaited: another hand's move to its value is named.
    ;({bind, mover} = clip())
    binding = bind({gain: 3})
    refusals.add(9)
    await assert.rejects(binding.write([{key: 'gain', value: 9}]), /refuses gain 9/)
    assert.equal(mover(bind({gain: 9}), 'gain'), 'another hand', 'a refused send is no answer to wait for')
    // Item 6: two moves by other hands read apart, so the kit's run ends at each.
    const second = bind({gain: 10})
    assert.equal(mover(second, 'gain'), 'another hand', 'a second move shows the one name (0E item 5)')
    assert.equal(second.standing.gain.move, 2, 'and is counted apart from the first, inside')
    // Item 5: the trails are kept for the clips read most lately: a clip read again after 64 others starts afresh.
    const first = clip()
    first.bind({gain: 1})
    for (let n = 0; n < 64; n++) clip().bind({gain: n})
    assert.equal(first.mover(first.bind({gain: 2}), 'gain'), undefined, 'its trail was let go: the reading is a first one')
  } finally {
    mock.timers.reset()
  }
})

// 0E items 3, 4 and 5 (delta review of O-I #943, findings 2, 4 and 6; DLW build ruling 2026-11-09). A linked key (Start, End, Length,
// Position) was taken for this panel's own for the whole wait of a send to its group, so another hand's Start moved while End was awaited
// showed no name and did not end the kit's run (3); an answer slower than the grace was named another hand's (4); and the count of moves
// was drawn ("another hand 14") and never started afresh (5). Driven through the clip binding and the host's standing, into the kit's rule.
const handsOf = async () => {
  const {clipBinding, LATE_KEPT_MS} = await import('../src/frame/detail/clipBinding.ts')
  const {hostedStanding, CONFIRM_GRACE_MS} = await import('../src/frame/devices/deviceHost.tsx')
  const {endKeyRuns, moverOf} = await import('../src/inhabitants/sdk/panel.tsx')
  const keys = ['gain', 'start', 'end', 'length', 'position']
  const wiring = {reads: {}, acts: Object.fromEntries(keys.map(key => [key, async () => {}])), view: {}, refused: {}}
  const clip = () => {
    const ref = `review-0E-${Math.random()}`
    const bind = values => clipBinding({mode: 'live', ref, values, wiring})
    const standingOf = (binding, key) => hostedStanding({drafts: {}, sent: {}, refused: {}}, binding, [key])[key] ?? {}
    return {bind, standingOf, mover: (binding, key) => standingOf(binding, key).movedBy}
  }
  return {clip, LATE_KEPT_MS, CONFIRM_GRACE_MS, endKeyRuns, moverOf}
}

test('0E: a linked key is this panel\'s own only in the reading that answers its send', async () => {
  const {clip} = await handsOf()
  const {bind, mover} = clip()
  let binding = bind({start: 0, end: 4, length: 4, position: 0})
  await binding.write([{key: 'end', value: 8}])
  binding = bind({start: 2, end: 4, length: 4, position: 0})
  assert.equal(mover(binding, 'start'), 'another hand', 'Start moved while this panel\'s End is awaited, in a reading that answers no send')
  binding = bind({start: 2, end: 8, length: 6, position: 0})
  assert.equal(mover(binding, 'end'), undefined, 'End answered')
  assert.equal(mover(binding, 'length'), undefined, 'Length moved with it in the reading that answers End: this panel\'s own')
  binding = bind({start: 2, end: 8, length: 6, position: 1})
  assert.equal(mover(binding, 'position'), 'another hand', 'the next reading answers nothing: Position is another hand\'s')
})

test('0E: an answer slower than the grace is still this panel\'s for 30 s', async () => {
  const {clip, LATE_KEPT_MS, CONFIRM_GRACE_MS} = await handsOf()
  mock.timers.enable({apis: ['Date'], now: 2_000_000})
  try {
    let {bind, mover} = clip()
    await bind({gain: 3}).write([{key: 'gain', value: 4}])
    mock.timers.tick(CONFIRM_GRACE_MS + 1)
    assert.equal(mover(bind({gain: 4}), 'gain'), undefined, 'a late answer is this panel\'s, not another hand\'s')
    ;({bind, mover} = clip())
    await bind({gain: 3}).write([{key: 'gain', value: 4}])
    mock.timers.tick(CONFIRM_GRACE_MS + LATE_KEPT_MS - 1)
    assert.equal(mover(bind({gain: 4}), 'gain'), undefined, 'late, up to 30 s after its grace')
    ;({bind, mover} = clip())
    await bind({gain: 3}).write([{key: 'gain', value: 4}])
    mock.timers.tick(CONFIRM_GRACE_MS + LATE_KEPT_MS + 1)
    assert.equal(mover(bind({gain: 4}), 'gain'), 'another hand', 'after that it is no longer waited for')
  } finally {
    mock.timers.reset()
  }
})

test('0E: every move of another hand shows the one name; the kit tells them apart inside, and the count starts afresh', async () => {
  const {clip, endKeyRuns, moverOf} = await handsOf()
  const {bind, mover, standingOf} = clip()
  bind({gain: 1})
  const first = bind({gain: 2}), second = bind({gain: 3})
  assert.deepEqual([mover(first, 'gain'), mover(second, 'gain')], ['another hand', 'another hand'], 'the name, never a count')
  assert.notEqual(moverOf(standingOf(first, 'gain')), moverOf(standingOf(second, 'gain')), 'two moves read apart in the kit\'s keys')
  endKeyRuns()
  bind({gain: 4})
  assert.equal(standingOf(bind({gain: 5}), 'gain').move, 1, 'the count starts afresh when the kit\'s runs end')
})

// Walk of O-I 857, round 47 LN11 (r47-LN11-b-08-gain-steps): after a quick run of Gain steps the dial was drawn back a step, and the
// next key stepped from there. The clip is read again on every change of the set, so reads overlap, and an older read's answer came
// after a newer one's and was drawn over it. A clip is drawn only from the newest read that has answered.
test('a clip read again while an older read is in flight is drawn from the newest answer, never back to an older one', async () => {
  const {clipReader} = await import('../src/live/liveWrites.ts')
  const asked = [], drawn = []
  const answer = gain => ({outcome: {result: 'live_clip_reading', reading: {clip: {gain}}}})
  const reader = clipReader(() => new Promise(done => asked.push(done)), whole => drawn.push(whole.clip?.gain ?? whole.error), () => 'no kernel')
  reader.read(); reader.read(); reader.read()
  asked[1](answer(2)); await new Promise(r => setTimeout(r, 0))
  asked[2](answer(3)); await new Promise(r => setTimeout(r, 0))
  asked[0](answer(1)); await new Promise(r => setTimeout(r, 0))
  assert.deepEqual(drawn, [2, 3], 'the newest answer stands: the first read, answered last, is not drawn over it')
  reader.read(); asked[3](answer(4)); await new Promise(r => setTimeout(r, 0))
  assert.deepEqual(drawn, [2, 3, 4], 'a read asked after them is drawn')
  reader.stop(); reader.read(); asked[4](answer(5)); await new Promise(r => setTimeout(r, 0))
  assert.deepEqual(drawn, [2, 3, 4], 'stopped, nothing more is drawn')
})
