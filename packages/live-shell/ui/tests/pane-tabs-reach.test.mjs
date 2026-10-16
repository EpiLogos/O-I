import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from '../node_modules/typescript/lib/typescript.js'

// Lane F, F5: a pane's tabs and its ⊞ (Beside, Below, Four ways, Full size) reveal by pointing, in every pane kind, and ⌘⌥\ pins
// them. Seen natively (the lead, 16 Oct): pointing at the top 8 px of Technē's frame pane, Expressions' field and Central's Day and
// Flow revealed nothing, and ⌘⌥\ changed nothing visible. Found headless (lane F): the candidate's pane grammar folds the tabs to a
// rail on the pane's LEFT edge (the mockup's .trail, #375), whose zone answered on a 14 px left band only — above the hosted frame
// (z 25 over the placed frame's 20), but nowhere on the top edge; and the cradle's pin read an absent presentation as
// pinned-horizontal while this grammar reads it as unpinned, so its pin never pinned. Channel: scripted.
const workbench = await readFile(new URL('../src/native/Workbench.tsx', import.meta.url), 'utf8')
const css = (await readFile(new URL('../src/native/workbench.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '')

// The pure pin, as Workbench.tsx states it (it uses nothing beyond its own grammar constant and the layout's shape).
const start = workbench.indexOf('export const PANE_TABS')
const end = workbench.indexOf('// end lane F (F5)')
assert.ok(start > 0 && end > start, 'Workbench.tsx states the pane tabs\' grammar and its pin')
const {outputText} = ts.transpileModule(workbench.slice(start, end), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}})
const {PANE_TABS, paneTabsAction, paneTabsOf, isPaneTabsRef} = await import(`data:text/javascript,${encodeURIComponent(outputText)}`)

const group = (id, extra = {}) => ({type: 'group', id, tabs: ['a'], pinned: [], active: 'a', ...extra})
const layout = (...groups) => ({root: groups.length === 1 ? groups[0] : {type: 'split', id: 's1', dir: 'h', children: groups, sizes: groups.map(() => 1)}, surfaces: {}, closedStack: [], focusedGroupId: groups[0].id})
const tabsOf = (state, id) => {
  const find = pane => pane.type === 'split' ? pane.children.map(find).find(Boolean) : pane.id === id ? pane : undefined
  const g = find(state.root)
  return `${g.tabPresentation ?? `(${PANE_TABS.presentation})`}/${g.tabPinOrientation ?? `(${PANE_TABS.orientation})`}`
}

test('⌘⌥\\ pins a pane folded by the grammar, and pressed again folds it again — every state stored, none read as the default', () => {
  assert.deepEqual(PANE_TABS, {presentation: 'unpinned', orientation: 'vertical'}, 'the grammar: a folded rail on the left edge')
  const folded = layout(group('g1'))
  const pinned = paneTabsAction(folded, 'frame.tabs-pin')
  assert.equal(tabsOf(pinned, 'g1'), 'pinned-vertical/vertical', 'the first press pins the rail it reveals (was: unpinned again, no visible change)')
  const again = paneTabsAction(pinned, 'frame.tabs-pin')
  assert.equal(tabsOf(again, 'g1'), 'unpinned/vertical', 'the second folds it, in the same orientation')
  const turned = paneTabsAction(again, 'frame.tabs-orient')
  assert.equal(tabsOf(turned, 'g1'), 'unpinned/horizontal', 'the orientation turns and stays folded')
  assert.equal(tabsOf(paneTabsAction(turned, 'frame.tabs-pin'), 'g1'), 'pinned-horizontal/horizontal',
    'a horizontal pin is stored as itself — absent would read as folded under this grammar')
})

test('the pin is the focused pane\'s, or the pane named; the other panes keep theirs', () => {
  const two = layout(group('g1'), group('g2', {tabPresentation: 'pinned-vertical', tabPinOrientation: 'vertical'}))
  const pinned = paneTabsAction(two, 'frame.tabs-pin')
  assert.equal(tabsOf(pinned, 'g1'), 'pinned-vertical/vertical')
  assert.equal(tabsOf(pinned, 'g2'), 'pinned-vertical/vertical', 'untouched')
  assert.equal(tabsOf(paneTabsAction(two, 'frame.tabs-pin', 'g2'), 'g2'), 'unpinned/vertical', 'a named pane')
  const none = {...two, root: null}
  assert.equal(paneTabsAction(none, 'frame.tabs-pin'), none, 'no tree: nothing')
})

test('the frame menu\'s Pin tabs horizontally / vertically / Unpin tabs set every pane, each stored as itself', () => {
  const two = layout(group('g1'), group('g2', {tabPinOrientation: 'horizontal'}))
  const horizontal = paneTabsAction(two, 'frame.tabs:pinned-horizontal')
  assert.deepEqual([tabsOf(horizontal, 'g1'), tabsOf(horizontal, 'g2')], ['pinned-horizontal/horizontal', 'pinned-horizontal/horizontal'],
    'was stored as absent — folded again under this grammar')
  const unpinned = paneTabsAction(horizontal, 'frame.tabs:unpinned')
  assert.deepEqual([tabsOf(unpinned, 'g1'), tabsOf(unpinned, 'g2')], ['unpinned/horizontal', 'unpinned/horizontal'], 'unpinning keeps each pane\'s geometry')
  assert.deepEqual(paneTabsOf(undefined), {presentation: 'unpinned', orientation: 'vertical'}, 'a pane with no state of its own stands as the grammar says')
  assert.deepEqual(['frame.tabs-pin', 'frame.tabs-orient', 'frame.tabs:unpinned', 'frame.tabs-width', 'surface.split-right'].map(isPaneTabsRef), [true, true, true, false, false])
})

test('the candidate routes ⌘⌥\\, the orientation toggle and the menu\'s tab entries through its grammar, and discloses them as they stand', () => {
  assert.match(workbench, /if \(isPaneTabsRef\(ref\)\) \{latest\.current\.book\.setLayout\(layout => paneTabsAction\(layout, ref, arg\?\.groupId\)\); return\}/)
  assert.match(workbench, /tabs: PANE_TABS,/)
  assert.match(workbench, /const standing = paneTabsOf\(focusedGroup\(state\)\)\.presentation/, 'the menu marks the pane\'s own state "(current)", not the cradle\'s default')
})

test('the folded rail answers on the pane\'s top edge as well as its left band, as one L cut by clip-path (its hit area with it)', () => {
  assert.match(css, /\.pane\.group\[data-tab-presentation="unpinned"\] > \.tab-reveal-zone\[data-orientation="vertical"\] \{ right: 0; width: auto;\s*clip-path: polygon\(0 0, 100% 0, 100% 8px, 14px 8px, 14px 100%, 0 100%\); \}/)
  assert.match(css, /\.pane\.group > \.tab-reveal-zone \{ position: absolute; z-index: 25; \}/, 'above the placed hosted frame (framePlacement.ts PLACED_Z_INDEX 20)')
  assert.match(css, /:has\(> \.tab-reveal-zone:hover\)[^{]*\{ grid-template-columns: var\(--tab-list-width/, 'pointing at the zone opens the rail in flow')
})
