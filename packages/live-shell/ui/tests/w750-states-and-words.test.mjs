import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

// O-I #750, UI/UX phase 5: states and words (ProjectCentral/docs/1-vision/dlw/DLW.md §16.10–§16.12). Interaction, domain and presentation
// state are kept apart; waiting and faults are drawn, not written; Info View shows on hover.
//  - The kit (inhabitants/sdk/panel.tsx, panel.css) draws every standing of §16.11 from one standing value per control (`data-standing`),
//    apart from what the hand is doing (`data-hand`) and how the place sets it; reduced motion stops breathing and spreading.
//  - Every control and light puts its name, its value and its standing's words on the status bar's Info line through the one channel the
//    frame reads (`data-i`, agent/statusInfo.ts parseDataI; components/StatusBar.tsx infoOf).
//  - No catalogue design writes waiting, loading, "not read" or a fault in place of a control's value or a row's answer: the kit's standing
//    stands there, and the missing reading's name stays in the well (§16.12) or goes to the Info line.
// The design sweep reuses scripts/design-sweep.mjs's loader and markup reader.

const {designs, textNodes} = await import('../scripts/design-sweep.mjs')
const {createElement: h} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const kit = await import('../src/inhabitants/sdk/panel.tsx')
const {parseDataI} = await import('../src/agent/statusInfo.ts')
const css = await readFile(new URL('../src/inhabitants/sdk/panel.css', import.meta.url), 'utf8')
const html = el => renderToStaticMarkup(el)
const fmt = v => String(v)
const scale = {min: 0, max: 1}
const standingsIn = out => [...out.matchAll(/data-standing="([a-z]+)"/g)].map(m => m[1])
const infoIn = out => [...out.matchAll(/data-i="([^"]*)"/g)].map(m => m[1].replace(/&#x27;/g, '\'').replace(/&amp;/g, '&'))

// ── one standing per control ─────────────────────────────────────────────

test('a control has one standing, in the manual\'s order: no reading first, then who moves it now', () => {
  const {standingOf} = kit
  assert.equal(standingOf({}, false), 'unread', 'no reading, nobody asked')
  assert.equal(standingOf({waiting: true}, false), 'awaiting', 'no reading, the owner asked: Waiting for a reading')
  assert.equal(standingOf({waiting: true}, true), 'plain', 'a reading you had shows at once, asked again behind it')
  assert.equal(standingOf({disabled: 'No owner.', pending: true, heldBy: 'Fizz'}), 'disabled', 'nobody can move it now')
  assert.equal(standingOf({pending: true, heldBy: 'Fizz'}), 'waiting', 'sent, not yet confirmed')
  assert.equal(standingOf({refused: 'No.', heldBy: 'Fizz'}), 'refused')
  assert.equal(standingOf({heldBy: 'Fizz', movedBy: 'Fizz'}, true, true), 'moved', 'something else moved it a moment ago')
  assert.equal(standingOf({heldBy: 'Fizz', movedBy: 'Fizz'}, true, false), 'held', 'then the holder holds it')
  assert.equal(standingOf({automated: 'overridden', modulatedBy: 'LFO'}), 'overridden')
  assert.equal(standingOf({automated: true, modulatedBy: 'LFO'}), 'automated')
  assert.equal(standingOf({modulatedBy: 'LFO'}), 'modulated')
  assert.equal(standingOf({working: true}), 'working')
  assert.equal(standingOf({}), 'plain')
})

/** Every control the manual names (§16.10), drawn in a standing: [control, standing given, the standing it must draw]. */
const CASES = [
  ['Dial automated', h(kit.Dial, {label: 'Drive', value: 0.5, scale, format: fmt, automated: true}), 'automated'],
  ['Dial overridden', h(kit.Dial, {label: 'Drive', value: 0.5, scale, format: fmt, automated: 'overridden'}), 'overridden'],
  ['Dial modulated', h(kit.Dial, {label: 'Drive', value: 0.5, scale, format: fmt, modulatedBy: 'LFO 1', mod: [0.3, 0.7]}), 'modulated'],
  ['Dial held', h(kit.Dial, {label: 'Drive', value: 0.5, scale, format: fmt, heldBy: 'Fizz'}), 'held'],
  ['Dial waiting', h(kit.Dial, {label: 'Drive', value: 0.5, scale, format: fmt, pending: true}), 'waiting'],
  ['Dial disabled', h(kit.Dial, {label: 'Drive', value: 0.5, scale, format: fmt, disabled: 'No owner takes a change here.'}), 'disabled'],
  ['Dial awaiting', h(kit.Dial, {label: 'Drive', value: undefined, scale, format: fmt, waiting: true}), 'awaiting'],
  ['Dial unread', h(kit.Dial, {label: 'Drive', value: undefined, scale, format: fmt}), 'unread'],
  ['Value box modulated', h(kit.ValueBox, {label: 'Mix', value: 0.5, scale, format: fmt, modulatedBy: 'the sky', mod: [0.2, 0.6]}), 'modulated'],
  ['Value box held', h(kit.ValueBox, {label: 'Mix', value: 0.5, scale, format: fmt, heldBy: 'Fizz'}), 'held'],
  ['Value box awaiting', h(kit.ValueBox, {label: 'Mix', value: undefined, scale, format: fmt, waiting: true}), 'awaiting'],
  ['Toggle held', h(kit.Toggle, {label: 'Hz', on: true, heldBy: 'Fizz'}), 'held'],
  ['Toggle waiting', h(kit.Toggle, {label: 'Hz', on: true, pending: true}), 'waiting'],
  ['Toggle unread', h(kit.Toggle, {label: 'Hz', on: false, unknown: true}), 'unread'],
  ['Toggle awaiting', h(kit.Toggle, {label: 'Hz', on: false, unknown: true, waiting: true}), 'awaiting'],
  ['Radio held', h(kit.Radio, {label: 'Type', value: 'lp', options: [{value: 'lp', label: 'LP'}, {value: 'hp', label: 'HP'}], heldBy: 'Fizz'}), 'held'],
  ['Radio unread', h(kit.Radio, {label: 'Type', value: undefined, options: [{value: 'lp', label: 'LP'}, {value: 'hp', label: 'HP'}]}), 'unread'],
  ['Radio awaiting', h(kit.Radio, {label: 'Type', value: undefined, options: [{value: 'lp', label: 'LP'}], waiting: true}), 'awaiting'],
  ['Chooser automated', h(kit.Chooser, {label: 'Table', value: 'a', options: [{value: 'a', label: 'A'}], automated: true}), 'automated'],
  ['Chooser unread', h(kit.Chooser, {label: 'Table', value: undefined, options: [{value: 'a', label: 'A'}]}), 'unread'],
  ['Readout awaiting', h(kit.Readout, {label: 'state', value: undefined, waiting: true}), 'awaiting'],
  ['Readout unread', h(kit.Readout, {label: 'state', value: undefined}), 'unread'],
  ['Readout refused', h(kit.Readout, {label: 'state', value: 'Ready', refused: 'The gateway is not running.'}), 'refused'],
  ['Readout disabled', h(kit.Readout, {label: 'state', value: 'Ready', disabled: 'Nothing here.'}), 'disabled'],
  ['Action waiting', h(kit.Action, {label: 'Run', onPress: () => {}, pending: true}), 'waiting'],
  ['Action working', h(kit.Action, {label: 'Run', onPress: () => {}, working: true}), 'working'],
  ['Action disabled', h(kit.Action, {label: 'Run', onPress: () => {}, disabled: 'Choose a run first.'}), 'disabled'],
  ['Light working', h(kit.Lamp, {state: 'lit', busy: true, label: 'Run'}), 'working'],
  ['Light awaiting', h(kit.Lamp, {state: 'unknown', waiting: true, label: 'Run'}), 'awaiting'],
  ['Light unread', h(kit.Lamp, {state: 'unknown', label: 'Run'}), 'unread'],
  ['Rows unread', h(kit.Rows, {label: 'Members', items: undefined}), 'unread'],
  ['Rows awaiting', h(kit.Rows, {label: 'Members', items: undefined, waiting: true}), 'awaiting'],
  ['Row working', h(kit.Rows, {items: [{id: 'a', name: 'Lead', light: 'lit', busy: true}]}), 'working'],
  ['Row awaiting', h(kit.Rows, {items: [{id: 'a', name: 'Lead', light: 'unknown', waiting: true}]}), 'awaiting'],
  ['Ladder unread', h(kit.Ladder, {rungs: [null, null], labels: ['seen', 'run']}), 'unread'],
  ['Ladder awaiting', h(kit.Ladder, {rungs: [null, null], labels: ['seen', 'run'], waiting: true}), 'awaiting'],
  ['Pad held', h(kit.Pad, {w: 80, h: 80, x: {label: 'A', value: 0.5, scale, format: fmt, heldBy: 'Fizz'}, y: {label: 'B', value: 0.5, scale, format: fmt}}), 'held'],
  ['Pad waiting', h(kit.Pad, {w: 80, h: 80, x: {label: 'A', value: 0.5, scale, format: fmt, pending: true}, y: {label: 'B', value: 0.5, scale, format: fmt}}), 'waiting'],
  ['Pad unread', h(kit.Pad, {w: 80, h: 80, x: {label: 'A', value: undefined, scale, format: fmt}, y: {label: 'B', value: 0.5, scale, format: fmt}}), 'unread'],
]

test('every control draws its standing from one value, data-standing, and from nothing else', () => {
  for (const [name, el, standing] of CASES) {
    const out = html(el)
    assert.ok(standingsIn(out).includes(standing), `${name}: draws ${standing} (has ${standingsIn(out).join(', ') || 'none'})`)
    // One standing for the control itself: the cell, or the light where the control is a light.
    if (name.startsWith('Row ')) continue // a row's standing is on its own line, under the list's
    const own = out.match(/^<(?:div|span)[^>]*>/)[0]
    assert.equal((own.match(/data-standing=/g) ?? []).length, 1, `${name}: one standing on the control (${own.slice(0, 120)})`)
  }
})

test('every standing of §16.11 has its drawing in the kit\'s stylesheet, keyed on the one standing value', () => {
  for (const standing of ['automated', 'overridden', 'modulated', 'held', 'moved', 'waiting', 'disabled', 'working', 'awaiting', 'unread', 'refused']) {
    assert.match(css, new RegExp(`\\[data-standing="${standing}"\\]`), `${standing} is drawn`)
  }
  assert.match(css, /\.dp-cell\[data-standing="disabled"\] \{ opacity: \.4; \}/, 'Disabled: the control at 40 %')
  assert.match(css, /\.dp-cell\[data-standing="overridden"\]::before \{[^}]*background: transparent; border: 1px solid/, 'Overridden: a hollow red dot')
  assert.match(css, /\.dp-cell\[data-standing="waiting"\] \.dp-dial-value \{ stroke-dasharray: 2 2; \}/, 'Waiting: the arc dashed')
  assert.match(css, /\.dp-cell\[data-standing="waiting"\] \.dp-value[^{]*\{ font-style: italic/, 'Waiting: the value in italics')
  // The standing draws; the host's old flags no longer do.
  assert.doesNotMatch(css, /\[data-(pending|held|waiting|automated|disabled|refused|modulated|unread|busy)=/, 'no drawing keyed on a flag of its own')
})

test('reduced motion stops breathing and spreading, and every standing still shows', () => {
  const reduce = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce) {'))
  assert.match(reduce, /\.dp-lamp\[data-standing="awaiting"\][^{]*\{ animation: none; opacity: \.55; \}/, 'a light still to come stops breathing, dimmed')
  assert.match(reduce, /\.dp-cell--rows\[data-standing="awaiting"\] \.dp-rows/, 'a list still to come stops breathing')
  assert.match(reduce, /\.dp-cell\[data-standing="working"\] \.dp-action::after \{ animation: none;/, 'a working act\'s ring stands still')
  assert.match(reduce, /\.dp-lamp\[data-standing="working"\]::after[^{]*\{ animation: none; transform: scale\(1\.8\); opacity: \.6; \}/, 'a working light\'s ring stands still')
  const infinite = [...css.matchAll(/([^{}]+)\{[^}]*animation:[^;}]*infinite/g)].map(m => m[1].trim())
  for (const selector of infinite) {
    for (const part of selector.split(',')) assert.match(part, /data-standing="(working|awaiting|waiting)"|data-running/, `${part.trim().slice(0, 80)} loops only while the owner reports it`)
  }
})

test('what the hand does is its own input: the standing never changes with it, nor it with the standing', async () => {
  const src = await readFile(new URL('../src/inhabitants/sdk/panel.tsx', import.meta.url), 'utf8')
  assert.match(src, /data-hand=\{hand\}/, 'the cell draws the hand apart')
  const out = html(h(kit.Dial, {label: 'Drive', value: 0.5, scale, format: fmt, heldBy: 'Fizz'}))
  assert.doesNotMatch(out, /data-hand=/, 'no hand on a control nobody touches')
  assert.match(css, /\.dp-cell\[data-hand="drag"\]/)
  assert.doesNotMatch(css, /data-hand="[a-z]+"\][^{]*data-standing|data-standing="[a-z]+"\][^{]*data-hand/, 'no rule blends the hand with the standing')
})

// ── Info View ────────────────────────────────────────────────────────────

test('every control and light says its name, its value and its standing\'s words on the Info line, through data-i', () => {
  const said = el => infoIn(html(el))[0]
  const dial = said(h(kit.Dial, {label: 'Drive', does: 'Drives the input.', value: 0.5, scale, format: v => `${v * 100} %`, heldBy: 'Fizz'}))
  assert.deepEqual(parseDataI(dial), {label: 'Drive', fn: '50 % — Drives the input. Fizz holds this value. Press the name to give it back.'})
  assert.match(said(h(kit.Dial, {label: 'Drive', value: 0.5, scale, format: fmt, modulatedBy: 'LFO 1'})), /^Drive\|0\.5 — LFO 1 moves this value\.$/, 'the modulator')
  assert.match(said(h(kit.Dial, {label: 'Drive', value: 0.5, scale, format: fmt, disabled: 'A reading: the owner reports it.'})), /^Drive\|0\.5 — A reading: the owner reports it\.$/, 'the reason')
  assert.match(said(h(kit.Dial, {label: 'Drive', value: undefined, scale, format: fmt, waiting: true})), /^Drive\|Waiting for the owner's first reading\.$/, 'a reading still to come, said, never drawn as text')
  assert.match(said(h(kit.Toggle, {label: 'Hz', on: true})), /^Hz\|On$/)
  assert.match(said(h(kit.Radio, {label: 'Type', value: 'hp', options: [{value: 'lp', label: 'LP'}, {value: 'hp', label: 'HP'}]})), /^Type\|HP$/)
  assert.match(said(h(kit.Chooser, {label: 'Table', value: 'a', options: [{value: 'a', label: 'Basic'}], pending: true})), /^Table\|Basic — Sent: waiting for the owner to confirm it\.$/)
  assert.match(said(h(kit.Readout, {label: 'state', value: 'Ready', refused: 'The gateway is not running.'})), /^state\|Ready — The owner refused: The gateway is not running\.$/, 'a fault is said, not written in the value')
  assert.match(said(h(kit.Lamp, {state: 'lit', label: 'Gateway', does: 'The gateway carries messages.', busy: true})), /^Gateway\|On — The gateway carries messages\. The owner reports it working\.$/)
  assert.match(said(h(kit.Lamp, {state: 'unknown', label: 'Gateway', why: 'No reading of the gateway.'})), /^Gateway\|No reading from the owner yet\. No reading of the gateway\.$/)
  assert.match(said(h(kit.Rows, {label: 'Members', items: undefined, why: 'No reading of the members.'})), /^Members\|No reading from the owner yet\. No reading of the members\.$/, 'which list reading is missing goes to the Info line')
  const row = infoIn(html(h(kit.Rows, {items: [{id: 'a', name: 'Lead', light: 'lit', note: 'r12', why: 'Held back by the owner.'}]}))).find(i => i.startsWith('Lead|'))
  assert.match(row, /^Lead\|r12 — Held back by the owner\.$/, 'a row: its name, its answer, its reason')
  assert.match(said(h(kit.Pad, {w: 80, h: 80, label: 'Room', x: {label: 'Decay', value: 0.5, scale, format: fmt}, y: {label: 'Size', value: 0.25, scale, format: fmt}})), /^Room\|Decay 0\.5 · Size 0\.25$/)
})

test('the Info line is the frame\'s one channel: the status bar reads data-i, and no control writes a second', async () => {
  const bar = await readFile(new URL('../src/components/StatusBar.tsx', import.meta.url), 'utf8')
  assert.match(bar, /closest\('\[data-i\]/, 'the status bar reads the nearest data-i')
  const panel = await readFile(new URL('../src/inhabitants/sdk/panel.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(panel, /\btitle=\{[^}]*(waiting|refused|reading)/i, 'no standing words in a tooltip beside the channel')
})


// ── designs: waiting and faults drawn, not written ───────────────────────

/** Words that say the owner's reading is absent or still to come. */
const ABSENT = /\bno readings?\b|\bnot read\b|\bunread\b|waiting for (output|the owner|a reading)|waiting…|\bloading\b/i
/** A fault written in a reading's place: the owner's refusal or failure as a sentence, or a name with the fault after it. */
const FAULT = /\b(refus|fail)\w*\b.*[.:]|^[A-Z][\w ]+: [^:]*\b(refus|fail)\w*/
/** The places a control or a row shows its value or its answer: the kit's, and the designs' own value slots. */
const VALUE_PLACES = ['dp-value', 'dp-box', 'dp-readout-value', 'dp-toggle', 'dp-swatch-value', 'dp-row-name', 'dp-row-note', 'dp-folded-reading', 'dp-tile-badge',
  'dp-display-corner', 'dp-action', 'fm-read', 'srch-read', 'th-pane-head', 'th-task', 'th-out', 'kg-chip', 'st-none', 'st-setup', 'ref-doc', 'st-suite-state',
  'st-suite-note', 'wt-bar', 'as-strip']
/** A missing reading named in a sentence of its own in a list's or a pane's material, as a well names it (§16.12): it stays. */
const NAMED_IN_MATERIAL = /^No reading of [^.:]+[.:]/
/** The designs' own wells: a picture that is not the kit's Display (the Terminal's screen). What they name stays. */
const WELLS = ['wt-screen']
const VIEWS = ['folded', 'compact', 'whole', 'widget', 'full']
/** Where a design's words say an absence that is the owner's own reading, not a value written in its place. */
const STANDS = {
  'settings:window': {'1 owner unread': 'The Settings head counts the owners that have not answered: a reading of the window, not a value in place of one.'},
  'actuation:gateway': {'error · git diff failed: no upstream': 'A frame the gateway passed: an error frame is the stream\'s own content, its kind and note as the frame reads.'},
  'ai-kit:skill-device': {'Preflight refused: no capability matrix in Work/face-rig': 'A row of the member\'s history: a failure that happened, as the history records it.',
    'failure · 14 Oct 11:02': 'A row of the member\'s history: its outcome and its time.'},
}

/** The value place a text node stands in: the innermost element with a class, or a list's label in its head. */
function placeOf(node) {
  const classed = [...node.classes].reverse().filter(Boolean)
  const own = classed[0]?.split(/\s+/) ?? [], parent = classed[1]?.split(/\s+/) ?? []
  if (own.includes('dp-label') && parent.includes('dp-rows-head')) return 'dp-rows-head'
  return VALUE_PLACES.find(place => own.includes(place))
}

/** Every place a design writes waiting or a fault in place of a value: [`id · view · fixture`, the text, the place]. */
async function writtenStandings() {
  const {found} = await designs()
  const out = [], failed = []
  for (const design of found) {
    if (design.id.startsWith('quaternal-logic:')) continue // another lane's designs this round (O-I #745)
    const keys = Object.keys(design.defaults)
    const runs = [['defaults', {...design.defaults}, undefined], ...Object.entries(design.fixtures ?? {}).map(([name, fixture]) => {
      const v = {...design.defaults}
      for (const [k, x] of Object.entries(fixture)) { if (x === undefined) delete v[k]; else v[k] = x }
      return [name, v, undefined]
    }), ['a missing owner', {}, undefined], ['a waiting owner', {}, Object.fromEntries(keys.map(k => [k, {waiting: true}]))]]
    for (const [fixture, v, standing] of runs) for (const view of VIEWS) {
      if (design.views && !design.views.includes(view)) continue
      const draw = page => { try { return renderToStaticMarkup(h('div', null, design[view]({v, set: () => {}, nav: {}, page, setPage: () => {}, standing}))) } catch (error) { failed.push(`${design.id} · ${view} · ${fixture} · ${page}: ${String(error?.message ?? error).split('\n')[0]}`); return '' } }
      // Every page the view's head offers (the kit's PagesNav names each with data-page), not only the first.
      const first = draw(design.firstPage ?? ''), pages = [...new Set([...first.matchAll(/data-page="([^"]+)"/g)].map(m => m[1]))].filter(x => x !== (design.firstPage ?? ''))
      for (const markup of [first, ...pages.map(draw)]) for (const node of textNodes(markup)) {
        const classes = node.classes.flatMap(c => c.split(/\s+/))
        if ((classes.includes('dp-display') && !classes.includes('dp-display-corner')) || node.tags.includes('svg') || WELLS.some(w => classes.includes(w))) continue // the well names it
        if (STANDS[design.id]?.[node.text]) continue
        const place = placeOf(node)
        const absent = ABSENT.test(node.text), fault = !!place && FAULT.test(node.text)
        if (!absent && !fault) continue
        if (!place && NAMED_IN_MATERIAL.test(node.text)) continue
        out.push([`${design.id} · ${view} · ${fixture}`, node.text, place ?? node.classes.filter(Boolean).at(-1)])
      }
    }
  }
  return Object.assign(out, {failed})
}

test('no design writes waiting, loading, "not read" or a fault in place of a control\'s value or a row\'s answer', {timeout: 600_000}, async () => {
  const found = await writtenStandings()
  const byDesign = new Map()
  for (const [where, text, place] of found) {
    const id = where.split(' · ')[0]
    byDesign.set(id, [...(byDesign.get(id) ?? []), `${where.slice(id.length + 3)}: "${text}" in ${place}`])
  }
  if (process.env.W750_LIST) for (const line of found.failed) console.log(`did not render | ${line}`)
  if (process.env.W750_LIST) for (const line of new Set(found.map(([where, text, place]) => `${where.split(' · ')[0]} | ${place} | ${text}`))) console.log(line)
  if (process.env.W750_COUNT) console.log(`designs writing waiting or faults as text: ${byDesign.size}\n${[...byDesign].map(([id, lines]) => `${id}\n  ${[...new Set(lines)].slice(0, 6).join('\n  ')}`).join('\n')}`)
  assert.deepEqual([...byDesign.keys()], [], 'the kit\'s standing stands in the value\'s place; the missing reading\'s name stays in the well or goes to the Info line')
})

test('a running tool whose output has not come draws the breathing field, never words in its place', () => {
  return designs(['actuation:harness-model']).then(({found}) => {
    const design = found[0]
    const full = renderToStaticMarkup(h('div', null, design.full({v: {...design.defaults}, set: () => {}, nav: {}, page: design.firstPage ?? '', setPage: () => {}})))
    assert.match(full, /<pre class="th-out" data-standing="awaiting" aria-label="Output still to come" data-i="Bash\|Its output has not come yet\."><\/pre>/)
    assert.doesNotMatch(full, /waiting for output/)
  })
})

// ── the two walk findings (29 Oct) ───────────────────────────────────────

test('Selection → packet, dimmed, says why on the status bar: a slot no owner binds carries its waiting line in its data-i', async () => {
  const {Transport, unboundWhy} = await import('../src/frame/transport/Transport.tsx')
  const words = id => ({label: id === 'capture' ? 'Selection → packet' : id, fn: id === 'capture' ? 'put the current selection into the packet' : `does ${id}`,
    dataI: id === 'capture' ? 'Selection → packet|put the current selection into the packet' : `${id}|does ${id}`,
    waiting: id === 'capture' ? 'Selection → packet — put the current selection into the packet. Not wired here yet: the day document\'s owner admits it.' : `${id} waits`})
  const out = html(h(Transport, {bindings: {play: {press() {}}}, words}))
  const capture = out.match(/<button[^>]*data-slot="capture"[^>]*>/)[0]
  assert.match(capture, /disabled=""/, 'the slot stands dimmed')
  assert.match(capture, /data-i="Selection → packet\|put the current selection into the packet\. Not wired here yet: the day document&#x27;s owner admits it\."/, 'and says why')
  assert.match(out.match(/<button[^>]*data-slot="play"[^>]*>/)[0], /data-i="play\|does play"/, 'a slot an owner binds says only what it does')
  assert.equal(unboundWhy(words('capture')), 'Not wired here yet: the day document\'s owner admits it.')
})

test('a New… tile makes one thing for a double-click, holds off presses while it is made, and says truthfully what was made', async () => {
  // ModeBrowser's graph reads the owner's form roster (JSON) and page templates: a hook for those, over the design sweep's loader.
  const {register} = await import('node:module')
  register(`data:text/javascript,${encodeURIComponent(`import {readFile} from 'node:fs/promises';
export async function load(u, c, n) {
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (u.includes('?raw') || ['.html', '.svg', '.png', '.md'].some(x => u.split('?')[0].endsWith(x))) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  return n(u, c);
}`)}`, import.meta.url)
  const noop = () => {}
  globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
  globalThis.localStorage ??= {getItem: () => null, setItem: noop, removeItem: noop}
  Object.assign(globalThis.document, {addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], body: {}, documentElement: {style: {}, dataset: {}}})
  const {makeOnce} = await import('../src/shell/ModeBrowser.tsx')
  let opened = 0, made
  const lines = [], making = []
  const press = makeOnce('New Flow', () => { opened++; return new Promise(resolve => { made = resolve }) }, {making: x => making.push(x), say: x => lines.push(x)})
  press(1); press(2) // a double-click: click (detail 1), click (detail 2)
  assert.equal(opened, 1, 'the second click of a double-click makes nothing more')
  press(1)
  assert.equal(opened, 1, 'nor does a press while the first is being made')
  assert.deepEqual(making, [true], 'the tile stands Waiting while it is made')
  made('Made a new Flow. It opens in the focused pane.')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(lines.at(-1), 'New Flow|Made a new Flow. It opens in the focused pane.', 'the Info line says what was made')
  assert.deepEqual(making, [true, false])
  const refused = makeOnce('New Flow', () => Promise.reject(new Error('The native owner refused all eight collision-safe Flow filenames.')), {making: () => {}, say: x => lines.push(x)})
  refused(1)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(lines.at(-1), 'New Flow|The native owner refused all eight collision-safe Flow filenames.', 'a refusal is the owner\'s own words, never a claim of its own')
  const surface = makeOnce('Terminal', () => { opened++ }, {making: x => making.push(x), say: x => lines.push(x)})
  surface(1); surface(1)
  assert.equal(opened, 3, 'an opener that answers nothing holds nothing off')
  const workbench = await readFile(new URL('../src/native/Workbench.tsx', import.meta.url), 'utf8')
  assert.match(workbench, /const freshChoice = async \([^)]*\): Promise<boolean>/, 'the fresh choice answers whether it made something')
  assert.match(workbench, /made \? `Made a new \$\{form\.label\}\. It opens in the focused pane\.` : 'The new tab closed before anything was made in it\.'/, 'the opener says what was made only when it was')
})
