import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/') || s === 'react-dom' || s.startsWith('react-dom/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
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
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

// UI/UX lane, phase 3 (manual §20.1 Pane view, Device view and Where everything is; §20.3 Studio; §16.3, a rack's Full is its devices):
// the field pane draws only the field, and the Studio's Full holds every device of the field. REPLACED (O-I #744): Expressions opens with
// the field filling one pane and the Studio in Device view (§20.1 "the field fills one pane, the Studio stands in Device view"); the
// Studio's Full opens in a pane from its head (▦), and a tree that already holds it keeps it as it was left.
// SCRIPTED — pure layout and the catalogue's design rendered to markup; CODE-READING — the frame's stand-down and the shell's doors.
const engine = await import('../../../../desktop/cradle/src/surface/engine.ts')
const {MODE_TREE_SEEDS, MODE_FRAMES} = await import('../src/shell/modeFrames.ts')
const {wantedPresentation} = await import('../src/components/expressions/studio/framePresentation.ts')
const {studioHomeOf} = await import('../src/components/expressions/studio/studioHome.ts')
const {design: studio} = await import('../src/inhabitants/catalogue/panels/expressions__studio.tsx')
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')

const group = (id, tabs) => ({type: 'group', id, tabs, pinned: [], active: tabs[0] ?? null})
const empty = () => ({root: group('g1', []), surfaces: {}, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'panel', rightDepth: 'collapsed', leftWidth: 260, rightWidth: 320})
const placed = layout => engine.groupsOf(layout.root).map(g => g.tabs.map(id => {
  const binding = layout.surfaces[id]
  return binding.projection?.subject_ref ? `${binding.kind}:${binding.projection.subject_ref}` : binding.kind
}))
const source = path => readFile(new URL(path, import.meta.url), 'utf8')

test('Expressions opens in Pane view with the field filling one pane, and the Studio in Device view', () => {
  assert.deepEqual(placed(MODE_TREE_SEEDS.expressions(empty())), [['projection.expressions']])
  assert.equal(MODE_FRAMES.expressions.view, 'pane')
  assert.equal(MODE_FRAMES.expressions.detailMode, 'device', 'the Studio stands in Device view')
})

test('a tree saved with the field alone is left as it stands; one that holds the Studio beside the field keeps it', () => {
  const old = engine.openBinding(empty(), engine.makeProjectionBinding(empty(), 'projection.expressions'))
  assert.deepEqual(placed(old), [['projection.expressions']])
  assert.equal(MODE_TREE_SEEDS.expressions(old), old, 'nothing is laid into a tree the person has')
  const field = engine.groupsOf(old.root)[0]
  const studio = engine.openBinding(old, {...engine.makeProjectionBinding(old, 'projection.device'), projection: {subject_ref: 'expressions:studio', title: 'Studio'}}, {groupId: field.id, edge: 'right'})
  assert.equal(MODE_TREE_SEEDS.expressions(studio), studio, 'a Studio pane the person kept stays where it is')
})

test('the frame stands on the devices at every size: no pane brings its own controls back', () => {
  assert.equal(wantedPresentation(), 'devices')
  return source('../src/components/expressions/studio/framePresentation.ts').then(hook => {
    const code = hook.split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n')
    assert.doesNotMatch(code, /'frame'/, 'no placement asks for the frame\'s own controls')
    assert.doesNotMatch(code, /data-maximized/, 'the pane\'s maximise no longer changes it')
    assert.match(hook, /command: 'presentation', chrome: want/, 'one command over the one runner')
  })
})

test('in the field pane the frame\'s Studio and its working panels stand down; its dialogs are left alone', async () => {
  const css = await source('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/workspace.css')
  const block = css.slice(css.indexOf('The field pane draws only the field'))
  const rule = block.slice(0, block.indexOf('{visibility:hidden!important;pointer-events:none!important}') + 1)
  for (const id of ['inspector', 'live-workspace', 'toolbelt-panel', 'belt-picker', 'context-panel', 'shape-picker', 'automation-assignment',
    'automation-monitor', 'modes-panel', 'entry-gate', 'capture-panel']) assert.match(rule, new RegExp(`body\\.oi-chrome-devices #${id}[,{\\n]`), id)
  for (const dialog of ['confirm-dialog', 'guide-dialog', 'video-dialog']) assert.doesNotMatch(rule, new RegExp(dialog), `${dialog}: a hidden modal would leave the field inert`)
  assert.match(css, /body\.oi-chrome-devices:not\(\[data-active-instrument="journey"\]\) #timeline-panel\{visibility:hidden!important/, 'the scenes strip, outside the journey')
})

test('"Open in studio" opens a setting where it lives: a field device\'s in the Studio\'s pane, a scene\'s in Clip view', async () => {
  for (const section of ['physics', 'pointer', 'relational', 'collision', 'motion', 'focus', 'appearance', 'volume', 'resonance', 'native']) assert.equal(studioHomeOf(section), 'studio', section)
  for (const section of ['formations', 'sequence', 'automation', 'layout', 'text', 'blueprint', 'scene']) assert.equal(studioHomeOf(section), 'clip', section)
  const panel = await source('../src/panels/expressions.tsx')
  assert.doesNotMatch(panel, /host\.openStudio\(/, 'the shell never opens the frame\'s own Studio in the field pane')
  assert.match(panel, /openStudioHome\(section\)/)
})

const viewProps = (member, extra = {}) => ({v: Object.fromEntries(Object.entries(studio.defaults).filter(([, x]) => x !== undefined)), set: () => {},
  nav: {}, page: 'macros', setPage: () => {}, frame: 'pane', room: {w: 1180, h: 620}, member, ...extra})
const draw = node => renderToStaticMarkup(React.createElement(() => node))

test('the Studio\'s Full is its devices: the Field and every chain\'s devices, asked of the host in chain order', () => {
  const asked = []
  const markup = draw(studio.full(viewProps(id => { asked.push(id); return React.createElement('i', {'data-member': id}) })))
  assert.deepEqual(asked, ['expressions:field', 'expressions:colour', 'expressions:ink', 'expressions:depth', 'expressions:medium', 'expressions:pointer',
    'expressions:relational', 'expressions:contacts', 'expressions:morph', 'expressions:focus', 'expressions:physics', 'expressions:resonance', 'quaternal-logic:torus'])
  for (const id of asked) assert.match(markup, new RegExp(`data-member="${id}"`), id)
  assert.match(markup, /aria-label="Nara"/, 'Nara has no Whole of its own: its stand-in, with Open')
  assert.match(markup, /Your controls/)
  for (const label of ['Particle Count', 'Turbulence', 'Rotation', 'Particle share']) assert.match(markup, new RegExp(label), `${label} as a dial at the head`)
  assert.match(markup, /\+ Parameter/)
})

test('a member the host does not hold stands in with its name, its light and its owner\'s words', () => {
  const markup = draw(studio.full(viewProps(id => (id === 'quaternal-logic:torus' ? null : React.createElement('i', {'data-member': id})))))
  assert.match(markup, /aria-label="Torus"/)
  assert.match(markup, /The torus waits for its owner in Expressions\./)
  const none = draw(studio.full(viewProps(undefined)))
  assert.equal((none.match(/class="dp st-standin"/g) ?? []).length, 14, 'with no door, every member stands in: the Field, twelve devices and Nara')
})

test('in its own window the Studio is the suite alone, with no Whole under it', () => {
  const markup = draw(studio.popout(viewProps(id => React.createElement('i', {'data-member': id}), {frame: 'window'})))
  assert.match(markup, /class="st-window"/)
  assert.match(markup, /class="st-suite"/)
  assert.doesNotMatch(markup, /data-view="whole"/)
})

test('the host draws a rack\'s members from the door, by their design, in their Whole views', async () => {
  const view = await source('../src/frame/devices/DeviceView.tsx')
  assert.match(view, /hosting\.designed\.kind === 'rack' && \(view === 'full' \|\| view === 'popout'\)/)
  assert.match(view, /publishedByDesign\(id\)/)
  assert.match(view, /<PlacedDevice device=\{entry\.device\} view="whole"/)
  const door = await source('../src/frame/devices/deviceDoor.ts')
  assert.match(door, /`\$\{entry\.device\.family\}:\$\{entry\.device\.face\.id\}` === design/)
  const host = await source('../src/frame/devices/deviceHost.tsx')
  assert.match(host, /\.\.\.\(member \? \{member\} : \{\}\)/)
})

// ——— O-I #747: the homes the manual gives the Stage plate's relays (§20.1 "Where everything is": "Show the field alone — Present, in the
// View menu"; "Export a picture or a film of the field — Export, in the File menu"; §20.1 Export's table) ———

test('#747: Present in the View menu and Export in the File menu are the field\'s own acts, with the manual\'s defaults', async () => {
  const {menuStageCommands} = await import('../src/components/expressions/studio/StudioStage.tsx')
  const S = await import('../src/native/stageCommands.ts')
  const idle = {stage: {mode: '2d', grid: false, snap: false, guides: true}, presenting: false, recording: false}
  assert.deepEqual(menuStageCommands('view.present', idle), [S.stagePresent(true)])
  assert.deepEqual(menuStageCommands('view.present', {...idle, presenting: true}), [S.stagePresent(false)], 'Present again (or Esc) brings the window back')
  // Picture: "Width … 1440 by default. Frame: Stage frame … Include page text, on by default. Transparent background, off by default."
  assert.deepEqual(S.STAGE_CAPTURE_DEFAULTS, {width: 1440, aspect: 'stage', includeText: true, transparent: false})
  assert.deepEqual(menuStageCommands('file.export.picture', idle), [S.stageCapturePng(S.STAGE_CAPTURE_DEFAULTS)])
  // Film: "What plays, from the moment you start the recording until you stop it."
  assert.deepEqual(menuStageCommands('file.export.film', idle), [S.stageRecord('start', S.STAGE_CAPTURE_DEFAULTS)])
  assert.deepEqual(menuStageCommands('file.export.film', {...idle, recording: true}), [S.stageRecord('stop', S.STAGE_CAPTURE_DEFAULTS), S.STAGE_SAVE_VIDEO])
  // Expression: "Expression JSON; living HTML, with its editor; or the current scene as a native configuration."
  for (const format of ['json', 'html', 'native']) assert.deepEqual(menuStageCommands(`file.export.${format}`, idle), [S.stageExport(format)])
  assert.equal(menuStageCommands('view.session', idle), null, 'an item that is not the field\'s is left to the frame')
  for (const [id, command] of [['view.grid', 'grid'], ['view.snap', 'snap'], ['view.guides', 'guides']]) assert.deepEqual(menuStageCommands(id, idle), [S.stageView(command)], `${id}: the field's own`)
  const menus = await source('../../../../desktop/cradle/src-tauri/src/menus.rs')
  for (const [id, label] of [['view.present', 'Present'], ['view.grid', 'Grid'], ['view.snap', 'Snap'], ['view.guides', 'Guides'], ['file.export.picture', 'Picture…'],
    ['file.export.film', 'Film'], ['file.export.json', 'Expression JSON'], ['file.export.html', 'Living HTML'], ['file.export.native', 'Native Configuration']])
    assert.match(menus, new RegExp(`item\\("${id.replace(/\./g, '\\.')}", "${label}", None\\)`), `${id} stands in the menu bar`)
  assert.match(menus, /SubmenuBuilder::new\(app, "File"\)/, 'a File menu')
  assert.match(menus, /\["edit\.", "create\.", "view\.", "file\.", "app\."\]/, 'its items reach the renderer as oi:command')
  // O-I #747 round two: the search line's > offers them (frame/menu/commandDoor.ts MENU_COMMANDS).
  const {MENU_COMMANDS} = await import('../src/frame/menu/commandDoor.ts')
  for (const id of ['view.present', 'view.grid', 'view.snap', 'view.guides', 'file.export.picture', 'file.export.film', 'file.export.json', 'file.export.html', 'file.export.native'])
    assert.ok(MENU_COMMANDS[id], `${id}: an act of the search line's >`)
})

test('#747: the menu bar\'s items the frame does not route go to the mode that stands; Expressions answers Present and Export', async () => {
  const app = await source('../src/App.tsx')
  assert.match(app, /new CustomEvent\(MENU_ACT, \{detail: \{id\}, cancelable: true\}\)/, 'one mode-blind door, no per-mode branch')
  assert.match(app, /sayOnInfoLine\([^)]*'Nothing in this window answers it/, 'unanswered, the status bar says so')
  const panel = await source('../src/panels/expressions.tsx')
  assert.match(panel, /window\.addEventListener\(MENU_ACT, menuAct\)/)
  assert.match(panel, /menuStageCommands\(id, mounted\.host\.getState\(\)\)/)
  // Picture… asks its choices first (§20.1 Export's table), over the window, until Export or Close.
  assert.match(panel, /if \(id === 'file\.export\.picture'\) \{ event\.preventDefault\(\); setPicture\(true\); return \}/)
  assert.match(panel, /<PictureChoices sender=\{pictureSender\} onDone=\{\(\) => setPicture\(false\)\} exported=\{exported\} \/>/)
  assert.match(panel, /window\.removeEventListener\(MENU_ACT, menuAct\)/)
})
