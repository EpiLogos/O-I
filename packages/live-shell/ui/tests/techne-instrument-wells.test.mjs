// Lane BT (16 Oct): Technē's instruments are devices on the owner's panel kit. Every M0′–M5′ plate stands on the kit's head (inhabitants/
// sdk/panel.tsx PanelHead: the activator, the expand toggle, the name, the held mark, the pages, the device's own acts, the place's marks, ▦ —
// docs/dlw/DEVICE-UI.md §4.1), its display section first with a well drawn from its owner's readings, a missing reading said in the well
// (§7); no sentence stands in a plate (§1): the frame's save state and status line are lights, a group with nothing says one word; a
// parameter no owner carries draws disabled with its reason on the status bar (§6). The rack publishes the instrument it stands open so the
// Device side's head can name it. Rendered server-side with the production modules in memory (the loader of frame-chrome-plates.test.mjs).
import test from 'node:test'
import assert from 'node:assert/strict'
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
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

globalThis.__CRADLE_WALK__ = false
const door = await import('../src/inhabitants/familyManifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const adoptRows = await import('../src/inhabitants/sdk/adoptVerifiedRows.ts')
const {InstrumentDeviceDetail} = await import('../src/shell/ModeDetail.tsx')
const {publishHostedChrome} = await import('../src/projections/expressionsPaneHost.ts')
const {PanelHead} = await import('../src/inhabitants/sdk/panel.tsx')
const Plate = await import('../src/frame/devices/InstrumentPlate.tsx')
const Standing = await import('../src/inhabitants/ql/devices/standingInstrument.ts')
const {STAGE_PLATES} = await import('../src/projections/stageInstruments/stageInstrumentModel.ts')
const {readFile} = await import('node:fs/promises')

door.resetFamilyManifestsForTest()
world.loadWorldShellFamilies()
adoptRows.adoptVerifiedRows()

const html = element => renderToStaticMarkup(element)
const source = path => readFile(new URL(path, import.meta.url), 'utf8')
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}
const plate = instrument => html(createElement(InstrumentDeviceDetail, {transport, instrument}))
const control = (id, home, label, extra = {}) => ({id, home, kind: 'button', label, ...extra})
const section = (out, id) => out.slice(out.indexOf(`data-section="${id}"`), out.indexOf('</section>', out.indexOf(`data-section="${id}"`)))
/** Text nodes drawn in markup (outside attributes), longer than four words: the sentences a person would read in the plate. */
const sentences = markup => (markup.replace(/<svg[\s\S]*?<\/svg>/g, '').match(/>[^<>]+</g) ?? []).map(text => text.slice(1, -1).trim()).filter(text => text.split(/\s+/).length > 4)

test('the kit\'s head, as one part: the activator, the mark, the name, the held mark, the pages, the acts, the marks, ▦ — in that order; a double-click on the head folds it, as in Live', () => {
  const out = html(createElement(PanelHead, {title: 'World', light: 'lit', onFold() {}, mark: createElement('i', {className: 'm'}), heldBy: 'the sky',
    pages: [{id: 'a', label: 'Earth'}, {id: 'b', label: 'Graph'}], page: 'a', acts: createElement('button', {type: 'button'}, 'Save'),
    marks: createElement('button', {type: 'button', className: 'mk'}), onFull() {}, hint: 'M4′ · Technē · Earth'}))
  const order = ['dp-activator', 'class="m"', 'dp-title', 'dp-head-held', 'dp-pages', 'dp-head-acts', 'class="mk"', 'aria-label="Open World full in a pane"'].map(part => out.indexOf(part))
  assert.ok(order.every((at, index) => at > 0 && (index === 0 || at > order[index - 1])), `the head's parts in the manual's §16.9 order: ${order}`)
  assert.doesNotMatch(out, /aria-label="Fold World"/, 'no fold button: Live folds a device from its head (manual §16.4)')
  assert.match(out, /^<header class="dp-head dp-head--plate" data-i="World\|M4′ · Technē · Earth">/, 'who owns it is the status bar\'s words, never drawn')
  assert.match(out, /class="dp-activator" data-light="lit" aria-pressed="true" disabled=""/, 'the owner\'s light; with no owner write it only reads')
  const named = html(createElement(PanelHead, {title: 'Canvas', light: 'unknown', onName() {}, nameDoes: 'Open Canvas on the focused pane.'}))
  assert.match(named, /<button type="button" class="dp-title dp-title--press" data-i="Canvas\|Open Canvas on the focused pane\.">Canvas<\/button>/, 'a name can be the press')
  assert.match(named, /data-light="unknown"/, 'a hollow ring while the owner has not said')
})

test('an instrument plate stands on the kit\'s head; its display section is first, has no heading and never folds for room', () => {
  const out = html(createElement(Plate.InstrumentPlate, {presentation: {family: 'techne', faceId: 'techne:m9', title: 'Probe', icon: 'techne', owner: 'M9′ · probe'}, onFold() {}, onFull() {},
    sections: [{id: 'display', title: 'Display', display: true, width: 164, children: 'well'}, {id: 'a', title: 'First', children: 'a'}, {id: 'b', title: 'Second', children: 'b'}]}))
  assert.match(out, /<section class="inst-face" aria-label="Probe"><header class="dp-head dp-head--plate" data-i="Probe\|M9′ · probe">/)
  assert.doesNotMatch(out, /sdk-face__owner|sdk-face__head|<h3/, 'no FacePlate head and no owner sentence')
  assert.match(out, /<section class="inst-section inst-section--display" data-section="display" aria-label="Display" style="--section-w:164px">well<\/section>/, 'the well alone, no heading')
  assert.doesNotMatch(out, /Fold Display/, 'the display never folds')
  for (const title of ['First', 'Second']) assert.match(out, new RegExp(`aria-label="Fold ${title} to its title"`), `${title} folds for room, the display first`)
  assert.doesNotMatch(out, /aria-label="Fold Probe"/, 'no fold button on the head: a double-click on it folds the plate')
})

test('every Technē instrument\'s open plate has its well first, drawn from its owner, a missing reading said in the well', () => {
  const words = {'techne:m0': /the Earth<\/text><text[^>]*>not mounted/, 'techne:m4': /the Earth<\/text><text[^>]*>not mounted/, 'techne:m1': /no stage<\/text><text[^>]*>reported yet/,
    'techne:m2': /all time/, 'techne:m3': /no walk<\/text><text[^>]*>reported yet/}
  // W4-Technē: M5′'s picture is the Palace design's own well (its floor), at the head of M5′'s chain on the palace session; the plate after
  // it keeps what the design does not carry, and draws no second well (techne-designs-binding.test.mjs draws the design's well).
  const m5 = plate('techne:m5')
  assert.ok(m5.indexOf('data-device-id="techne:palace" data-chain-place="head"') >= 0 && m5.indexOf('data-device-id="techne:palace"') < m5.indexOf('data-instrument="techne:m5" data-expanded="true"'), 'the Palace design heads M5′')
  assert.doesNotMatch(m5.slice(m5.indexOf('data-instrument="techne:m5" data-expanded="true"')), /data-section="display"/, 'no second well')
  for (const [id, said] of Object.entries(words)) {
    const out = plate(id)
    const at = out.indexOf(`data-instrument="${id}" data-expanded="true"`)
    assert.ok(at >= 0, `${id} stands open`)
    const open = out.slice(at)
    assert.match(open, /<header class="dp-head dp-head--plate"/, `${id}: the kit's head`)
    const sections = [...open.matchAll(/data-section="([^"]+)"/g)].map(match => match[1])
    assert.equal(sections[0], 'display', `${id}: the well first`)
    assert.match(section(open, 'display'), said, `${id}: the well says which reading is missing`)
    assert.doesNotMatch(section(open, 'display'), /NaN|undefined/, `${id}: nothing drawn as a reading nobody gave`)
  }
})

/** The frame's chrome on the canvas lens, with the two readings the lead saw drawn as text on M1′'s TOOLS: the status line and the save glyph. */
const CANVAS = {lens: 'canvas', controls: [
  control('tools/l:Snap', 'canvas:tools', 'Snap', {kind: 'toggle', pressed: true}),
  control('tools/l:O-I — wiki overview', 'canvas:tools', 'O-I — wiki overview', {kind: 'reading', value: 'O-I — wiki overview'}),
  control('tools/l:Saved', 'canvas:tools', 'Saved', {kind: 'reading', value: 'Saved'}),
  control('readout/l:80%', 'canvas:look', '80%', {kind: 'reading', value: '80%'}),
]}
const state = (chrome, extra = {}) => ({hostMode: 'techne', lens: chrome.lens, sceneIndex: 0, sceneCount: 1, presentation: 'devices', chrome, ...extra})
const run = async () => ({ok: true})

test('M1′: the save state and the status line are lights, never text; its well draws the pane at the frame\'s zoom and the selection', () => {
  publishHostedChrome({state: state(CANVAS, {selection: [{id: 'card:1', name: 'The Stone'}]}), run, faults: []})
  try {
    const out = plate('techne:m1')
    const tools = section(out, 'tools')
    assert.match(tools, /class="dp-cell plate-light" data-chrome="tools\/l:Saved" data-save-state="saved" data-i="Save\|Saved: [^"]+"><span class="dp-lamp" data-light="lit" data-tone="green"/, 'saved: a green light')
    assert.match(tools, /data-chrome="tools\/l:O-I — wiki overview" data-i="Status\|O-I — wiki overview" aria-label="O-I — wiki overview"><span class="dp-lamp"[^>]*><\/span><span class="dp-label">status<\/span>/, 'the status line is a light; its words the status bar\'s')
    assert.doesNotMatch(tools, />O-I — wiki overview<|>Saved</, 'neither is drawn as text')
    assert.match(section(out, 'look'), /data-chrome="readout\/l:80%"/, 'a short value stays the frame\'s own reading')
    const well = section(out, 'display')
    assert.match(well, /class="dp-display-corner">80%</, 'the zoom at the well\'s top right')
    assert.match(well, /class="dp-curve-on"/, 'the part of the board the pane shows')
    assert.match(well, /1 selected · The Stone/, 'what is selected')
    assert.match(well, /<circle[^>]*r="0\.8"/, 'Snap on: the grid')
    assert.deepEqual(sentences(out.slice(out.indexOf('data-instrument="techne:m1" data-expanded="true"'), out.indexOf('data-section="expression"'))), [], 'no sentence drawn in M1′\'s groups')
  } finally {
    publishHostedChrome(null)
  }
})

test('a mockup control no owner carries draws disabled, its reason on the status bar: M1′ Tool, Relation type, Standing; M2′ Deep time, Strata; M3′ Take', () => {
  const cases = [
    ['techne:m1', {lens: 'canvas', controls: []}, ['Tool', 'Relation type', 'Standing']],
    ['techne:m2', {lens: 'timeline', controls: []}, ['Deep time', 'Strata']],
    ['techne:m3', {lens: 'journey', controls: []}, ['Take']],
  ]
  for (const [id, chrome, names] of cases) {
    publishHostedChrome({state: state(chrome), run, faults: []})
    try {
      const out = plate(id)
      for (const name of names) {
        const cell = new RegExp(`data-disabled="true"( data-waiting="true")? data-i="${name}\\|[^"]{12,}"|data-waiting="true" title="${name} — [^"]+" data-disabled="true" data-i="${name}\\|[^"]{12,}"`)
        assert.match(out, cell, `${id} ${name}: disabled, with its reason`)
      }
    } finally {
      publishHostedChrome(null)
    }
  }
  const deep = STAGE_PLATES['techne:m2'].flatMap(group => group.waiting ?? []).find(parameter => parameter.name === 'Deep time')
  assert.deepEqual(deep?.dial, {unit: '%'}, 'Deep time is the mockup\'s dial (world-shell-mockup.html:1405), drawn with no reading')
})

test('M3′: the walk\'s stops as cells, the one it stands on lit, its place at the top right', () => {
  publishHostedChrome({state: state({lens: 'journey', controls: []}, {sceneCount: 3, sceneIndex: 1, sceneName: 'Gather', journeyPlaying: true}), run, faults: []})
  try {
    const well = section(plate('techne:m3'), 'display')
    assert.equal((well.match(/<rect /g) ?? []).length, 3, 'one cell a stop')
    assert.equal((well.match(/class="dp-curve-on"/g) ?? []).length, 1, 'the stop it stands on lit')
    assert.match(well, /class="dp-display-corner">2\/3</)
    assert.match(well, />▶</, 'walking')
    assert.match(well, />Gather</, 'the stop\'s name')
  } finally {
    publishHostedChrome(null)
  }
})

test('the rack says which instrument stands open, so the Device side\'s head can name it (standingInstrument.ts)', async () => {
  assert.equal(Standing.standingInstrument('techne:m0'), undefined, 'no rack has said: the focus stands')
  Standing.publishStandingInstrument('techne:m0', 'techne:m4')
  assert.equal(Standing.standingInstrument('techne:m0'), 'techne:m4', 'M4′ stands over the Earth pane\'s M0′')
  Standing.publishStandingInstrument('techne:m0', null)
  assert.equal(Standing.standingInstrument('techne:m0'), null, 'every instrument folded')
  Standing.publishStandingInstrument('techne:m0', undefined)
  assert.equal(Standing.standingInstrument('techne:m0'), undefined, 'the rack left')
  const rack = await source('../src/inhabitants/ql/devices/TechneDevices.tsx')
  assert.match(rack, /publishStandingInstrument\(focusInstrument, open\)/, 'the rack publishes what it stands open')
  assert.match(rack, /onFold=\{\(\) => setOpened\(\{focus: focusInstrument, id: null\}\)\}/, 'the open plate\'s ▾ folds it: none stands open, the Compacts take the row')
  assert.match(rack, /<Folded title=\{holderTitle\(holder\)\}/, 'an instrument\'s fold is the kit\'s Folded')
})
