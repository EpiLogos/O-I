// O-I #747 round 891: nothing in a Clip panel is cut. Walk 890 (capture 26, the Expressions Clip panel beside a long constellation ref)
// showed "Constella…" cut in its row's name, "Show in Bro" clipped beside the constellation, "Hot-swap" clipped beside Groove, Keep and
// Fit cut and Restore gone from the View row, and the scene's body (Carrier, Shows, Reference, Span) under the panel's edge, out of reach.
// One kind of fault: a panel row that gives its controls less room than their names. The guard reads every row and field of every tab
// of both panels, in every mode's clip, on its defaults, on each fixture and beside a long constellation ref with its source moved, at the
// kit's measure (panel.tsx nameWidth, the browser's sans at its size), and checks the stylesheet keeps what the measure assumes.
// Channel: SCRIPTED — the designs drawn to static markup through the transpiling loader (clip-source-constellation.test.mjs's).
import test from 'node:test'
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
  assert.match(panel, /onKeyDown: \(e: KeyboardEvent<Element>\) => \{[^]*?keyStepFrom\(sent\.current, value, at\)/, 'the scalar controls\' keys step this way, at the press\'s time')
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
