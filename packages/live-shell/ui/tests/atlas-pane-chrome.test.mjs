// The Earth pane holds the material alone (O-I #762; manual §16.3 Full: "The material itself: the page, the field, the torus, the world.
// No controls", and "A pane holds no device controls. They stay in Device view under the pane"; §17.11: a lens's controls are the Lens's).
// What the ported atlas still drew over the globe — the focus label (its name, line and acts), the graph's settings, the closes of its
// reading cards, a non-Field lens's own title and controls — stands down in the pane by one list (projections/atlas/paneChrome.ts
// PANE_CHROME_REGIONS, the host's stylesheet atlasHost.css), and stands on the devices: the focus label's acts, the closes and the graph's
// display on the World (atlasDevices.ts atlasGlobeBinding, the World design's Focus and Display), the lens's title and controls on the Lens
// (effectBindings.ts lensBinding, the Lens design's Lens page). A press from a device is the atlas's own control pressed. Scripted over a
// stand-in of the atlas's DOM, built as the ported modules build it (ui/focus-label.ts, shell/panel.ts, lenses/theory.ts, graph/tools.ts,
// ui/reveal.ts), with production modules in memory.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) return (r.url.endsWith('.html') || r.url.endsWith('.css')) ? {...r, format: 'module'} : r
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx', '/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const source = (await readFile(new URL(u), 'utf8')).split('import.meta.env').join('({BASE_URL: "/"})');
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}, fileName: new URL(u).pathname}).outputText};
}`)}`, import.meta.url)

globalThis.__CRADLE_WALK__ = false
const chrome = await import('../src/projections/atlas/paneChrome.ts')
const atlasDevs = await import('../src/inhabitants/ql/devices/atlasDevices.ts')
const {lensBinding} = await import('../src/techne/devices/effectBindings.ts')
const {design: world} = await import('../src/inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx')
const {design: lens} = await import('../src/inhabitants/catalogue/panels/techne__lens.tsx')
const {placeToolState} = await import('../src/projections/atlas/places/placeTool.ts')

// ── a stand-in of the atlas's DOM: elements as ui/dom.ts el() makes them ─────────────────────────────────────────────────────────────
class El {
  constructor(tagName, attrs = {}, children = []) {
    this.tagName = tagName.toUpperCase()
    this.attrs = new Map()
    this.parentElement = null
    this.children = []
    this.text = ''
    this.clicks = 0
    this.events = []
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') this.text = value
      else if (key === 'value') this.value = value
      else if (key === 'checked') this.checked = value
      else if (key === 'disabled') this.disabled = value
      else this.attrs.set(key, String(value))
    }
    this.type = this.attrs.get('type')
    this.classList = {contains: name => (this.attrs.get('class') ?? '').split(/\s+/).includes(name)}
    for (const child of children) this.append(child)
  }
  append(child) { child.parentElement = this; this.children.push(child) }
  get textContent() { return this.text + this.children.map(child => child.textContent).join('') }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null }
  hasAttribute(name) { return this.attrs.has(name) }
  click() { this.clicks++ }
  dispatchEvent(event) { this.events.push(event.type); return true }
  get options() { return this.children.filter(child => child.tagName === 'OPTION').map(child => ({value: child.value, textContent: child.textContent})) }
}
const h = (tag, attrs, ...children) => new El(tag, attrs, children)

/** The pane's #app as the controller fills it: the focus label on a subject, the Field's reading card closed, Theory's panel open on its
 * first section with a cite and a link in its text and a form, the graph's tools with their display, and Aion stood away. */
function atlasPane() {
  const follow = h('button', {class: 'link-quiet', type: 'button', text: 'Follow the thread'})
  const select = h('select', {'aria-label': 'Convention', value: 'equal'}, h('option', {value: 'equal', text: 'Equal months'}), h('option', {value: 'iau', text: 'IAU boundaries'}))
  const nameField = h('input', {type: 'text', value: 'You', placeholder: 'You'})
  const tab = h('button', {type: 'button', class: 'th-tab', 'aria-current': 'true', text: 'Libido'})
  const cite = h('button', {type: 'button', class: 'link-quiet lq-cite', text: 'CW 8, §1'})
  const app = h('div', {id: 'app'},
    h('header', {class: 'focus-label on', 'aria-live': 'polite', 'aria-hidden': 'false'},
      h('nav', {class: 'fl-up', 'aria-label': 'Where you came from'}, h('button', {class: 'link-quiet', type: 'button', text: '‹ the whole field'})),
      h('h2', {class: 'fl-name', text: 'Quaternity'}),
      h('p', {class: 'fl-line', text: 'A form of the field, in 48 instances'}),
      h('nav', {class: 'fl-links', 'aria-label': 'Go further'}, follow, h('button', {class: 'link-quiet', type: 'button', text: 'Reading'}))),
    h('aside', {class: 'reveal', 'aria-label': 'Selected presence', 'aria-hidden': 'true', inert: ''}, h('button', {class: 'rv-close', type: 'button', 'aria-label': 'Close'})),
    h('section', {class: 'lens-panel', 'aria-live': 'polite', 'aria-label': 'Theory'},
      h('button', {type: 'button', class: 'lp-handle', 'aria-label': 'Expand the panel'}, h('span', {class: 'lp-grip', 'aria-hidden': 'true'})),
      h('button', {type: 'button', class: 'lp-close icon-btn', 'aria-label': 'Close'}),
      h('div', {class: 'lp-body'},
        h('nav', {class: 'th-tabs'}, tab, h('button', {type: 'button', class: 'th-tab', text: 'Number'})),
        h('h2', {class: 'lp-h', text: 'Libido'}),
        h('p', {class: 'th-line', text: 'Psychic energy, as the source reads it. '}, cite),
        h('button', {type: 'button', class: 'th-link', text: 'Read it in the field'}),
        h('form', {class: 'as-form'}, h('label', {}, h('span', {text: 'Your name'}), nameField), h('label', {}, h('span', {text: 'Convention'}), select),
          h('button', {type: 'submit', text: 'Save'}))),
      h('div', {class: 'lp-foot'}, h('button', {type: 'button', text: '←', 'aria-label': 'Previous'}), h('button', {type: 'button', text: '→', 'aria-label': 'Next'}))),
    h('section', {class: 'aion', hidden: '', 'aria-label': 'Archetypal history'}, h('nav', {class: 'aion-epochs', 'aria-label': 'Historical epochs'}, h('button', {type: 'button', text: 'Pisces'}))),
    h('nav', {class: 'gv-tools', 'aria-label': 'Graph'},
      h('button', {class: 'gvt-link gvt-settings', type: 'button', text: 'Settings', 'aria-expanded': 'false'}),
      // the graph's Settings panel stands closed (graph/tools.ts: hidden until its toggle opens it); its display is read all the same
      h('section', {class: 'gvt-panel', hidden: ''}, h('details', {class: 'gvt-display'},
        h('div', {class: 'gvt-row'}, h('span', {text: 'Node size'}), h('input', {type: 'range', class: 'gvt-range', min: '0.5', max: '2', step: '0.05', value: '1', 'aria-label': 'Node size: How large every node is drawn.'})),
        h('button', {class: 'gvt-caption gvt-reset', type: 'button', text: 'Reset', title: 'Restore the drawing as it was'})))))
  return {app, follow, select, nameField, tab, cite}
}

const ids = reading => reading.controls.map(control => `${control.kind} ${control.id}`)

test('the focus label, the Field’s closes and the graph’s display are the World’s; a lens’s title and its own controls are the Lens’s', () => {
  const {app} = atlasPane()
  const read = chrome.readPaneChrome(app)
  assert.equal(read.world.title, 'Quaternity', 'the subject in focus titles the World’s part')
  assert.deepEqual(ids(read.world), [
    'reading focus/Quaternity', 'reading focus/A form of the field, in 48 instances',
    'button focus/‹ the whole field', 'button focus/Follow the thread', 'button focus/Reading',
    'number graph/Node size: How large every node is drawn.', 'button graph/Reset',
  ], 'the focus label’s name, line and every act; the closed reading card’s close is not drawn; the graph’s display')
  assert.equal(read.lens.title, 'Theory', 'the lens’s own title')
  assert.deepEqual(ids(read.lens), [
    'button panel/Expand the panel', 'button panel/Close', 'toggle panel/Libido', 'toggle panel/Number',
    'text panel/Your name', 'select panel/Convention', 'button panel/Save', 'button panel/Previous', 'button panel/Next',
  ], 'the panel’s handle, close, tabs, fields with their form’s button and walk rail; Aion is not drawn')
  const all = [...read.world.controls, ...read.lens.controls].map(control => control.label)
  assert.ok(!all.includes('CW 8, §1') && !all.includes('Read it in the field'), 'the links in the reading’s text stay in the pane: they are its material')
  assert.equal(read.lens.controls.find(control => control.label === 'Libido').pressed, true, 'the tab the lens stands on reads pressed')
  assert.deepEqual(read.lens.controls.find(control => control.kind === 'select').options.map(option => option.value), ['equal', 'iau'])
})

test('a press from a device is the atlas’s own control pressed; a value is set as typing sets it; a stale or a reading press is refused in words', () => {
  const {app, follow, select, nameField, tab} = atlasPane()
  chrome.pressPaneChrome(app, 'focus/Follow the thread')
  assert.equal(follow.clicks, 1, 'the focus label’s own act')
  chrome.pressPaneChrome(app, 'panel/Libido')
  assert.equal(tab.clicks, 1, 'the lens’s own tab')
  chrome.pressPaneChrome(app, 'panel/Convention', 'iau')
  assert.equal(select.value, 'iau')
  assert.deepEqual(select.events, ['input', 'change'], 'the atlas’s own listeners take the choice')
  chrome.pressPaneChrome(app, 'panel/Your name', 'Ada')
  assert.equal(nameField.value, 'Ada')
  assert.throws(() => chrome.pressPaneChrome(app, 'panel/Convention', 'tropical'), /offers no such choice/)
  assert.throws(() => chrome.pressPaneChrome(app, 'focus/Quaternity'), /is a reading, not a control/)
  assert.throws(() => chrome.pressPaneChrome(app, 'focus/See in sky'), /no longer draws this control/)
})

test('the host’s stylesheet stands down exactly what the devices draw, and nothing of the reading', async () => {
  const css = await readFile(new URL('../src/projections/atlas/atlasHost.css', import.meta.url), 'utf8')
  const rule = css.slice(css.indexOf('#762'))
  const block = rule.slice(rule.indexOf('*/') + 2, rule.indexOf('{')).split(/,\s*\n/).map(line => line.trim()).filter(Boolean)
  assert.deepEqual(new Set(block), new Set(chrome.PANE_STAND_DOWN.map(selector => `.atlas-host ${selector}`)), 'one list: the regions the devices read are the ones the pane stands down')
  assert.match(rule.slice(rule.indexOf('{')), /^\{\s*display: none;\s*\}/, 'stood down whole: every element stays mounted with its own handler')
  for (const kept of ['.lens-panel', '.lp-body', '.deep', '.reveal', '.aion', '.redbook', '.dynamics', '.passage', '.link-quiet', '.lq-cite']) {
    assert.ok(!block.some(selector => selector.endsWith(` ${kept}`)), `${kept} stays in the pane: it is the reading`)
  }
})

test('the Earth pane holds no button, field or setting of the atlas’s chrome: every one the atlas draws stands on a device', async () => {
  // Every control the ported atlas builds into its #app outside a reading's text, by the module that builds it, and the device it stands on
  // now (the header, its menu and chips, the time strip, the Earth ⇄ Graph pill and the corner stood down on 14–15 Oct; atlas-places-plate).
  const css = await readFile(new URL('../src/projections/atlas/atlasHost.css', import.meta.url), 'utf8')
  const stoodDown = selector => new RegExp(`\\.atlas-host ${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[,{]`).test(css)
  const homes = {
    '.shell': 'the World / Places plate’s Lens (LensReadings)', '.shell-menu': 'the World / Places plate’s Lens', '.sh-chips': 'the plate’s Relations',
    '.time': 'the transport and the Deep time device', '.mode-switch': 'the Earth ⇄ Graph device', '.sh-corner': 'the plate’s find',
    '.focus-label': 'the World (Focus)', '.gv-tools': 'the Project plate’s Graph and Forces, and the World (Display)',
    '.rv-close': 'the World (Focus), or the Lens for a reading lens’s card', '.dp-close': 'the World (Focus)',
    '.aion .aion-epochs': 'the Lens', '.aion .rb-rail': 'the Lens', '.redbook .rb-rail': 'the Lens', '.dynamics .dy-rail': 'the Lens', '.aion-ring select': 'the Lens',
  }
  for (const [selector, home] of Object.entries(homes)) assert.ok(stoodDown(selector), `${selector} stands down in the pane; it stands on ${home}`)
  assert.match(css, /\.atlas-host \.lens-panel :is\(\.lp-handle, \.lp-close, \.lp-foot, \.th-tab, form, input, select, textarea\)/,
    'a panel lens’s handle, close, walk rail, tabs, forms and fields stand down; its reading stays')
  // the ported modules build these controls, and no other control outside a reading's text (cites, related names, steps into the field)
  const sources = {
    'src/ui/focus-label.ts': /class: 'focus-label'/, 'src/graph/tools.ts': /class: 'gv-tools'/, 'src/shell/panel.ts': /class: 'lp-close icon-btn'/,
    'src/ui/reveal.ts': /class: 'rv-close'/, 'src/ui/deep.ts': /class: 'dp-close'/, 'src/aion/view.ts': /class: 'aion-epochs'/, 'src/redbook/view.ts': /class: 'rb-rail'/,
    'src/dynamics/view.ts': /class: 'dy-rail'/, 'src/aion/skyclock-view.ts': /class: 'aion-ring'/,
  }
  for (const [path, built] of Object.entries(sources)) assert.match(await readFile(new URL(`../src/projections/atlas/${path}`, import.meta.url), 'utf8'), built, `${path} still builds what the pane stands down`)
})

test('the World device carries the focus label’s acts, the closes and the display, and presses the atlas’s own', () => {
  const {app, follow} = atlasPane()
  const read = chrome.readPaneChrome(app)
  chrome.publishPaneChrome(app, read)
  try {
    const reading = {...atlasDevs.atlasReading(null, 'earth'), mounted: true, globe: {scopeLabel: null, wholeField: false}}
    const binding = atlasDevs.atlasGlobeBinding(reading)
    assert.deepEqual(JSON.parse(binding.values['pane.controls']), read.world.controls, 'the World reads the pane’s World part, as it stands')
    assert.equal(binding.values['pane.title'], 'Quaternity')
    binding.local['pane.press'](JSON.stringify({id: 'focus/Follow the thread'}))
    assert.equal(follow.clicks, 1, 'a press on the World is the focus label’s own act')
    binding.local['pane.press'](JSON.stringify({id: 'focus/The deep field'}))
    assert.match(placeToolState().notice ?? '', /no longer draws this control/, 'a refusal is said on the atlas’s line, in its words')
    const unmounted = atlasDevs.atlasGlobeBinding(atlasDevs.atlasReading(null, 'earth'))
    assert.equal(unmounted.values['pane.controls'], undefined, 'no Earth mounted: no reading, never a default')
    assert.match(unmounted.standing['pane.press'].disabled, /has not mounted/)
    // the design draws them: the subject, its line and its acts under Focus; the display under Graph's Display
    const space = renderToStaticMarkup(world.whole({v: {...world.defaults, ...binding.values}, set() {}, nav: {}, page: 'space', setPage() {}}))
    assert.match(space, /Focus/)
    for (const word of ['Quaternity', 'A form of the field, in 48 instances', '‹ the whole field', 'Follow the thread', 'Reading']) assert.ok(space.includes(word), `the World’s Focus draws ${word}`)
    const graph = renderToStaticMarkup(world.whole({v: {...world.defaults, ...binding.values}, set() {}, nav: {}, page: 'graph', setPage() {}}))
    assert.match(graph, /Display/)
    assert.ok(graph.includes('Node size') && graph.includes('Reset'), 'the graph’s display on the World’s Graph page')
    const pressed = []
    const rendered = world.whole({v: {...world.defaults, ...binding.values}, set: (key, value) => pressed.push([key, value]), nav: {}, page: 'space', setPage() {}})
    findPress(rendered, 'Follow the thread')()
    assert.deepEqual(pressed, [['pane.press', JSON.stringify({id: 'focus/Follow the thread'})]], 'the design sends one press, by the control’s id')
  } finally {
    chrome.publishPaneChrome(null, null)
  }
})

test('the Lens carries a lens’s own title and controls under its name, and presses the atlas’s own; absent while no lens draws any', () => {
  const {app, tab} = atlasPane()
  const read = chrome.readPaneChrome(app)
  chrome.publishPaneChrome(app, read)
  try {
    const binding = lensBinding(undefined, {}, read.lens)
    assert.equal(binding.values['pane.title'], 'Theory')
    assert.deepEqual(JSON.parse(binding.values['pane.controls']), read.lens.controls)
    binding.local['pane.press'](JSON.stringify({id: 'panel/Libido'}))
    assert.equal(tab.clicks, 1, 'a press on the Lens is the lens’s own tab')
    const page = renderToStaticMarkup(lens.whole({v: {...lens.defaults, ...binding.values}, set() {}, nav: {}, page: 'lens', setPage() {}}))
    assert.match(page, /<div class="dp-sec-label">Theory<\/div>/, 'the lens’s section under its own name')
    for (const word of ['Libido', 'Number', 'Your name', 'Save', 'Previous', 'Next']) assert.ok(page.includes(word), `the Lens draws ${word}`)
    const none = lensBinding(undefined, {}, {title: null, controls: []})
    assert.equal(none.values['pane.controls'], undefined, 'no lens of the instrument’s: nothing reported')
    const bare = renderToStaticMarkup(lens.whole({v: {...lens.defaults, ...none.values, 'pane.controls': undefined, 'pane.title': undefined}, set() {}, nav: {}, page: 'lens', setPage() {}}))
    assert.doesNotMatch(bare, /In the pane|Libido/, 'and the Lens draws its QL lens alone')
  } finally {
    chrome.publishPaneChrome(null, null)
  }
})

test('the attach reads the pane’s chrome while the atlas stands, tells the faces when it changes, and withdraws it on release (structural)', async () => {
  const host = await readFile(new URL('../src/projections/atlas/AtlasProjectionPanel.tsx', import.meta.url), 'utf8')
  assert.match(host, /chrome = watchPaneChrome\(app, \(\) => mounted\.ctl\.facesChanged\?\.\(\)\)/, 'read from the atlas’s own #app, the faces told')
  assert.match(host, /chrome\?\.dispose\(\)/, 'released with the attach')
  const designs = await readFile(new URL('../src/techne/devices/techneDesigns.ts', import.meta.url), 'utf8')
  assert.match(designs, /lensBinding\(lensLists, heldFor\(LENS_DESIGN\), lensPane\)/, 'the Lens is bound on the pane’s lens part')
})

/** The onPress of the first Action labelled `label` in a rendered React tree. */
function findPress(node, label) {
  const stack = [node]
  while (stack.length) {
    const next = stack.pop()
    if (!next || typeof next !== 'object') continue
    if (Array.isArray(next)) { stack.push(...next); continue }
    const props = next.props ?? {}
    if (props.label === label && typeof props.onPress === 'function') return props.onPress
    if (typeof next.type === 'function' && !props.children && next.type.name !== 'Action') {
      try { stack.push(next.type(props)) } catch { /* a hook-bearing component: its children are walked through props */ }
    }
    stack.push(props.children)
  }
  throw new Error(`no action labelled ${label}`)
}
