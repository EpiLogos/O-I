import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Lane AF (O-I #741, VS Code's workbench into Central's editor side). A pane's tab, as the manual gives it and as VS Code's workbench
// does it (campaign-evidence/2026-10-29-vscode-workbench-re/DECODE.md):
//   - §10.2 "Double-click a pane's tab and the pane fills the main area; double-click it again and the other panes come back."
//     VS Code 1.141 multiEditorTabsControl: a DBLCLICK on a tab toggles the group (workbench.editor.doubleClickTabToToggleEditorGroupSizes,
//     "maximize": "All other editor groups are hidden and the current editor group is maximized").
//   - §18.1 "A clip shows its state … Draft, Saved or Edited since save" and §17.8 "The save state shows next to the page": a Central
//     document's pane tab carries its draft, as VS Code's tab of an editor with unsaved changes carries its dot. Before this lane only a
//     kernel source buffer marked its tab (Workbench.tsx kernelDirty); a Day, a Flow, a Being or a Thing in a pane never did.
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
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url).pathname,'utf8')};
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})
// The cradle's sources read the walk switch Vite defines.
globalThis.__CRADLE_WALK__ = false

const bench = await import('../../../../desktop/cradle/src/surface/Workbench.tsx')
const {executeFrameAction} = await import('../../../../desktop/cradle/src/surface/registry.ts')
const {groupsOf} = await import('../../../../desktop/cradle/src/surface/engine.ts')
// The cradle's Workbench binds the cradle's own React (desktop/cradle/node_modules/react): it is drawn with that React's server renderer.
const {renderToStaticMarkup} = await import('../../../../desktop/cradle/node_modules/react-dom/server.js')
const {createElement} = await import('../../../../desktop/cradle/node_modules/react/index.js')

const group = (id, tabs) => ({type: 'group', id, tabs, pinned: [], active: tabs[0] ?? null})
const twoPanes = () => ({
  root: {type: 'split', id: 's1', dir: 'h', children: [group('g1', ['day']), group('g2', ['flow'])]},
  surfaces: {day: {id: 'day', kind: 'projection.central-document', title: 'Day'}, flow: {id: 'flow', kind: 'projection.central-document', title: 'Flow'}},
  closedStack: [], focusedGroupId: 'g1', agencyDepth: 'strip',
})
const tabElement = (tree) => {
  // Tab renders <div class="tab-entry"><IconTab …/><button class="tab-close"/></div>; the IconTab is the pressed tab.
  const children = [tree.props.children].flat()
  return children.find(child => child && child.props && child.props['data-surface-id'] !== undefined)
}

test('§10.2: double-clicking a pane\'s tab asks the pane to fill the main area, through the frame\'s own maximise', () => {
  assert.equal(typeof bench.Tab, 'function', 'Workbench.tsx exports the pane tab it draws (a function with no hooks of its own)')
  const asked = []
  const tree = bench.Tab({id: 'flow', title: 'Flow', kind: 'projection.central-document', active: true, pinned: false, dirty: false, groupId: 'g2',
    execute: (ref, arg) => asked.push([ref, arg]), openBindingMenu: () => {}})
  const tab = tabElement(tree)
  assert.ok(tab, 'the tab carries its surface id')
  assert.equal(typeof tab.props.onDoubleClick, 'function', 'a double-click on the tab is heard (was: nothing — only the split menu\'s Full size)')
  tab.props.onDoubleClick({preventDefault() {}, stopPropagation() {}})
  assert.deepEqual(asked, [['surface.maximize', {surfaceId: 'flow'}]], 'the tab names its own surface: the pane it stands in toggles, not the focused one')
})

test('§10.2: the same double-click again brings the other panes back — the maximise the tab asks for toggles its own pane', () => {
  const layout = twoPanes()
  const full = executeFrameAction(layout, 'surface.maximize', {surfaceId: 'flow'})
  assert.equal(full.maximizedGroupId, 'g2', 'the Flow\'s pane fills the main area')
  assert.equal(full.focusedGroupId, 'g2', 'and takes the focus')
  const back = executeFrameAction(full, 'surface.maximize', {surfaceId: 'flow'})
  assert.equal(back.maximizedGroupId, undefined, 'again: the other panes come back')
  assert.deepEqual(groupsOf(back.root).map(g => g.tabs), [['day'], ['flow']], 'nothing moved: maximising is presentation only')
})

test('§18.1/§17.8: a document pane that holds a draft is marked on its tab, as an edited buffer is', async () => {
  const drafts = await import('../src/central/documents/paneDrafts.ts')
  const door = await import('../src/central/documents/documentDoor.ts')
  let heard = 0
  const stop = drafts.subscribePaneDrafts(() => { heard++ })
  // Two faces stand in two panes; the one the hand reached first is the aperture's, the other is not — its draft still shows on its tab.
  door.publishDocument({key: 'face-day', paneId: 'day', form: 'Day', title: 'Day', state: 'as read', dirty: false}, true)
  door.publishDocument({key: 'face-flow', paneId: 'flow', form: 'Flow', title: 'Flow', state: 'edited since save', dirty: true})
  assert.equal(door.reachedDocument()?.key, 'face-day', 'the Flow was not reached: the aperture still reads the Day')
  assert.equal(drafts.paneHoldsDraft('flow'), true, 'the Flow\'s pane holds a draft though the hand has not reached it')
  assert.equal(drafts.paneHoldsDraft('day'), false)
  const after = heard
  door.publishDocument({key: 'face-flow', paneId: 'flow', form: 'Flow', title: 'Flow', state: 'edited since save', dirty: true})
  assert.equal(heard, after, 'a republish of the same standing is no change: nothing re-renders the panes')
  door.publishDocument({key: 'face-flow', paneId: 'flow', form: 'Flow', title: 'Flow', state: 'saved', dirty: false})
  assert.equal(drafts.paneHoldsDraft('flow'), false, 'saved: the mark goes')
  door.publishDocument({key: 'face-flow', paneId: 'flow', form: 'Flow', title: 'Flow', state: 'edited since save', dirty: true})
  door.withdrawDocument('face-flow')
  assert.equal(drafts.paneHoldsDraft('flow'), false, 'a face that leaves takes its draft fact with it')
  door.publishDocument({key: 'face-device', form: 'Flow', title: 'Flow', state: 'edited since save', dirty: true})
  assert.equal(drafts.paneHoldsDraft(undefined), false, 'a face outside any pane marks no tab')
  stop()
  door.withdrawDocument('face-day'); door.withdrawDocument('face-device')

  // The pane's tab reads it: a document binding holds no kernel ref, so only the draft fact can mark it.
  const layout = twoPanes()
  const markup = (draftOf) => renderToStaticMarkup(createElement(bench.GroupPane, {
    group: groupsOf(layout.root)[1], pane: groupsOf(layout.root)[1], state: layout, menuOpen: false, nativeWindows: false, workspaceName: 'w',
    execute() {}, openBindingMenu() {}, openFrameMenu() {}, openSource() {}, openKnowledge() {}, onView() {},
    kernelDirty: () => false, presented: false, ...(draftOf ? {draftOf} : {}),
  }))
  assert.match(markup(id => id === 'flow'), /data-surface-id="flow"[^>]*data-dirty="true"|data-dirty="true"[^>]*data-surface-id="flow"/, 'the Flow\'s tab is marked')
  assert.match(markup(() => false), /data-dirty="false"/, 'no draft: no mark')
})

test('the candidate\'s panes read the drafts: the native Workbench hands its panes the draft fact and re-renders when it moves', async () => {
  const {readFile} = await import('node:fs/promises')
  const source = await readFile(new URL('../src/native/Workbench.tsx', import.meta.url), 'utf8')
  assert.ok(/usePaneDrafts\(\)/.test(source), 'the Workbench follows the drafts')
  assert.ok(/draftOf[,:]/.test(source), 'and hands them to its panes')
})

test('§10.2 "Focus a pane": a press inside a hosted page focuses the pane it stands in, as a click into an editor activates its group', async () => {
  // A press inside a frame of another origin never reaches the shell's document: the frame takes the focus as the window blurs, and
  // the Workbench reads which frame it was. It read material frames only, so a press in a Day, a Flow, a Being or a Thing left the
  // focus on whichever pane had it (walked headless, lane AF: chromium, the Flow's pane stayed unfocused).
  assert.equal(typeof bench.PANE_FOCUS_FRAMES, 'string', 'Workbench.tsx names the frames whose focus focuses their pane')
  const {readFile} = await import('node:fs/promises')
  for (const face of ['DocumentDayDieFace.tsx', 'DocumentFlowFace.tsx', 'DocumentPageFace.tsx']) {
    const source = await readFile(new URL(`../src/inhabitants/${face}`, import.meta.url), 'utf8')
    const frameClass = /<iframe[^>]*className="([^"]+)"/.exec(source)?.[1]
    assert.ok(frameClass, `${face} hosts its page in a frame`)
    assert.ok(bench.PANE_FOCUS_FRAMES.split(',').map(s => s.trim()).includes(`.${frameClass}`), `${face}'s frame (.${frameClass}) focuses its pane`)
  }
  assert.ok(bench.PANE_FOCUS_FRAMES.split(',').map(s => s.trim()).includes('.material-frame'), 'a material frame still does')
})
