// O-I #747 round 895, OPEN 4 (DLW build ruling 2026-11-08): a portal's placement is honoured, or said in words. The manual's Launch
// panel (DLW.md §20.1): "| Portal placement | Preview · Overlay · Beside · Full · Detached · Re-dock | Beside | Where a portal opens. |".
// Round 894 left it recorded but not honoured: every portal opened as a Workbench tab, wherever its placement said.
//   Beside   — the source stands in its own pane on the right edge of the pane the work stands in (the pane engine's dropOnEdge).
//   Full     — the source's pane fills the main area (the pane engine's maximize mask).
//   Detached — the source goes to its own window through the Workbench's own detach door; where no window owner answers (the
//              development browser), it stays a tab and the door's words say why.
//   Re-dock  — a source held in its own window returns through the window door; with none, it opens as a tab, said.
//   Preview, Overlay — the shell draws nothing over the Scene, so they open beside the work, and say so.
// The frame is answered once the Workbench has placed the source, with the words of any placement it could not honour; the frame
// says them on its Info line. A knowledge page opens as a Workbench tab, whatever the placement, and says so.
// Channels: REAL — portalPlacing and placePortalPane over the pane engine; SCRIPTED — answerScenePortal over an injected admission and
// recording owners. BEHAVIOUR, the whole chain: portal-answered-896.test.mjs (round 896, 0R-surface.5). CODE-READING beside it — the Workbench,
// App and the panel call that chain.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const {answerScenePortal} = await import('../src/native/hostedSummons.ts')
const {portalPlacing, placePortalPane, PORTAL_WORDS} = await import('../src/native/portalPlace.ts')
const {openBinding, groupOf, groupsOf} = await import('../../../../desktop/cradle/src/surface/engine.ts')
const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('each placement the manual lists has its place: Beside, Full, Detached and Re-dock are honoured; Preview and Overlay open beside, said', () => {
  assert.deepEqual(portalPlacing('beside'), {place: 'beside'})
  assert.deepEqual(portalPlacing('full'), {place: 'full'})
  assert.deepEqual(portalPlacing('detached'), {place: 'detached'})
  assert.deepEqual(portalPlacing('re_dock'), {place: 're_dock'})
  assert.deepEqual(portalPlacing('preview'), {place: 'beside', note: 'the shell draws no preview over the Scene, so it opened beside the work.'})
  assert.deepEqual(portalPlacing('overlay'), {place: 'beside', note: 'the shell draws no overlay over the Scene, so it opened beside the work.'})
  assert.deepEqual(portalPlacing(undefined), {place: 'beside'}, 'the manual\'s default is Beside')
})

const work = {id: 'work', kind: 'projection', title: 'Expressions'}
const source = {id: 'src', kind: 'file', title: 'a.md', ref: 'central:file:notes/a.md'}
const layout = () => ({root: {type: 'group', id: 'g1', tabs: ['work'], pinned: [], active: 'work'}, surfaces: {work}, closedStack: [], focusedGroupId: 'g1', agencyDepth: 'rest'})

test('Beside: the source stands in its own pane on the right edge of the work\'s pane, and the work stays shown', () => {
  const opened = openBinding(layout(), source)
  assert.deepEqual(groupOf(opened, 'src')?.id, 'g1', 'opened as a tab, it would stand over the work')
  const {layout: placed, note} = placePortalPane(opened, 'src', 'beside', 'work')
  assert.equal(note, undefined)
  assert.equal(placed.root.type, 'split')
  assert.equal(placed.root.dir, 'h')
  assert.deepEqual(placed.root.children.map(child => child.tabs), [['work'], ['src']], 'the work on the left, the source on its right')
  assert.equal(groupOf(placed, 'work').active, 'work', 'the work is still the shown tab of its pane')
  assert.equal(placed.focusedGroupId, groupOf(placed, 'src').id)
})

test('Full: the source\'s pane fills the main area; Beside with the work in no pane opens as a tab, and says so', () => {
  const opened = openBinding(layout(), source)
  const {layout: full, note} = placePortalPane(opened, 'src', 'full', 'work')
  assert.equal(note, undefined)
  assert.equal(full.maximizedGroupId, groupOf(full, 'src').id)
  const alone = openBinding({...layout(), root: {type: 'group', id: 'g1', tabs: [], pinned: [], active: null}, surfaces: {}}, source)
  const away = placePortalPane(alone, 'src', 'beside', null)
  assert.equal(away.note, PORTAL_WORDS.noWorkPane)
  assert.deepEqual(groupsOf(away.layout.root).map(group => group.tabs), [['src']])
})

const subject = {ref: 'expression:made-of', revision: 4, sceneRef: 'expression:made-of:scene:central'}
const request = {v: 1, kind: 'host-request', request: 'scene-portal', request_id: 'r-1', detail: {trigger_ref: 'expression:made-of:trigger:p1', subject}}
const location = {schema: 'central.path-ref/v1', ref: 'central:file:notes/a.md', root: 'Control', path: 'notes/a.md'}
function harness(portal) {
  const log = {answers: [], files: [], knowledge: [], faults: []}
  const deps = {transport: {kind: 'unavailable', reason: 'test transport'}, current: () => true, project: () => 'O-I',
    openFile: (value, carry) => log.files.push([value.ref, carry]), openKnowledge: value => log.knowledge.push(value),
    fault: reason => log.faults.push(reason), clear: () => {}, answer: (id, error, note) => log.answers.push([id, error ?? null, note ?? null]),
    resolvePortal: async () => portal}
  return {deps, log}
}

test('the file portal carries its place, and the frame is answered once the Workbench has placed it, with the words of what it could not honour', async () => {
  const overlay = harness({target: {location, title: 'a.md'}, placement: 'overlay'})
  await answerScenePortal(request, overlay.deps)
  assert.equal(overlay.log.files.length, 1)
  const [[ref, carry]] = overlay.log.files
  assert.equal(ref, 'central:file:notes/a.md')
  assert.equal(carry.portal.place, 'beside')
  assert.deepEqual(overlay.log.answers, [], 'answered when the Workbench says where it placed it')
  carry.portal.complete()
  assert.deepEqual(overlay.log.answers, [['r-1', null, 'the shell draws no overlay over the Scene, so it opened beside the work.']])

  const detached = harness({target: {location, title: 'a.md'}, placement: 'detached'})
  await answerScenePortal(request, detached.deps)
  detached.log.files[0][1].portal.complete(undefined, 'it opened as a tab: Detached native windows are unavailable in the development browser.')
  assert.deepEqual(detached.log.answers, [['r-1', null, 'it opened as a tab: Detached native windows are unavailable in the development browser.']])

  const refused = harness({target: {location, title: 'a.md'}, placement: 're_dock'})
  await answerScenePortal(request, refused.deps)
  refused.log.files[0][1].portal.complete('The window owner did not answer.')
  assert.deepEqual(refused.log.answers, [['r-1', 'The window owner did not answer.', null]])
  assert.deepEqual(refused.log.faults, ['The window owner did not answer.'])
})

test('a knowledge page opens as a Workbench tab whatever the placement, and the frame is told so', async () => {
  const page = harness({target: {address: {kind: 'wiki', value: 'wiki:node:central'}, title: 'Central', project: 'O-I'}, placement: 'full'})
  await answerScenePortal(request, page.deps)
  page.log.knowledge[0].complete()
  assert.deepEqual(page.log.answers, [['r-1', null, PORTAL_WORDS.knowledge]])
})

// Round 896, 0R-surface.5: the chain these pins once stood in for runs by behaviour in desktop/cradle/expressions-app/field-studies-journeys/
// tests/portal-answered-896.test.mjs (the frame's request, the boundary host, the shell's answer, App's hold, the Workbench's open and
// placement, the frame's answer). What stays here is only that the Workbench, App and the panel call those, with their own book and doors.
test('CODE-READING, beside portal-answered-896 (which runs the chain): the Workbench, App and the panel call it with their own book and doors', async () => {
  const workbench = await read('../src/native/Workbench.tsx')
  assert.match(workbench, /const sourceOpen = \(event: Event\) => receiveSourceOpen\(\(event as CustomEvent<unknown>\)\.detail, \{\n\s+presented: \(\) => ownsPresented\(\),/)
  assert.match(workbench, /place: \(binding, place, away\) => callbacks\.current\.placePortal\(binding, place, away\),/)
  assert.match(workbench, /const placePortal = \(binding: SurfaceBinding, place: PortalPlace, away: boolean\): Promise<string \| undefined> => placeOpenedPortal\(binding, place, away, \{\n\s+layout: \(\) => latest\.current\.book\.current\.layout,\n\s+setLayout: change => latest\.current\.book\.setLayout\(change\),\n\s+workPane: \(\) => framePlacement\(\)\?\.paneId \?\? null,\n\s+detach: source => detach\(source\.id, source\),/)
  assert.match(workbench, /invoke\('window_redock_surface', \{workspaceId, surfaceId: source\.id\}\)/)
  const app = await read('../src/App.tsx')
  assert.match(app, /setSourceIntent\(heldSources\.hold\(\{location: detail\.location, passage: detail\.passage, note: detail\.note, portal: detail\.portal\}\)\)/)
  assert.match(app, /new CustomEvent\('oi:epi-open-source', \{detail: \{location: sourceIntent\.location, passage: sourceIntent\.passage, note: sourceIntent\.note, portal: sourceIntent\.portal\}\}\)\)\n\s+heldSources\.handed\(sourceIntent\)/)
  const panel = await read('../src/panels/expressions.tsx')
  assert.match(panel, /answer: \(id, error, note\) => at\?\.answerScenePortal\(id, error, note\),/)
  const app2 = await read('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/app.ts')
  assert.match(app2, /\.then\(note=>\{if\(note\)toast\(`\$\{said\}: \$\{note\}`,6500\);\}\)/, 'the frame says where it opened on its Info line')
})
