import test from 'node:test'
import assert from 'node:assert/strict'

// R1 (T-REALIGN §3; manual §16.4, §10.1, §10.8): the window's parts keep their own sizes inside the window as it stands, a drag keeps
// the offset it was taken at, each frame's detail expansion returns to its own height, and the keys that show and hide the parts
// are read by the physical key as well as the character macOS gives under ⌥ (shell/workspaceAreas.ts). Pure.
const areas = await import('../src/shell/workspaceAreas.ts')
const press = (key, extra = {}) => ({key, metaKey: true, altKey: true, ctrlKey: false, shiftKey: false, ...extra})

test('the view keys (manual §10.1, §10.8, Live 12\'s View menu) — by the letter, the code, or macOS\'s ⌥ character', () => {
  assert.equal(areas.frameToggleOf(press('b')), 'browser')
  assert.equal(areas.frameToggleOf(press('B')), 'browser')
  assert.equal(areas.frameToggleOf(press('∫')), 'browser', '⌥B on the Mac gives "∫"')
  assert.equal(areas.frameToggleOf(press('x', {code: 'Digit5'})), 'browser', '⌥⌘5 is Live\'s other browser key')
  assert.equal(areas.frameToggleOf(press('l')), 'detail')
  assert.equal(areas.frameToggleOf(press('¬')), 'detail', '⌥L on the Mac gives "¬"')
  assert.equal(areas.frameToggleOf(press('x', {code: 'Digit8'})), 'rail', 'the rail is ⌥⌘8')
  assert.equal(areas.frameToggleOf(press('•')), 'rail', '⌥8 on the Mac gives "•"')
  assert.equal(areas.frameToggleOf(press('x', {code: 'KeyR'})), 'returns', '⌥⌘R stays Live\'s return tracks')
  assert.equal(areas.frameToggleOf(press('x', {code: 'Digit3'})), 'clip')
  assert.equal(areas.frameToggleOf(press('x', {code: 'Digit4'})), 'device')
  assert.equal(areas.frameToggleOf(press('x', {code: 'Digit6'})), 'pool')
  assert.equal(areas.frameToggleOf(press('x', {code: 'Digit9'})), 'pane')
  assert.equal(areas.frameToggleOf(press('x', {code: 'KeyM'})), 'mixer')
  assert.equal(areas.frameToggleOf(press('x', {code: 'KeyI'})), 'io')
  assert.equal(areas.frameToggleOf(press('x', {code: 'KeyS'})), 'sends')
  assert.equal(areas.frameToggleOf(press('x', {code: 'KeyL'})), 'detail', 'the physical key stands whatever the layout prints')
  assert.equal(areas.frameToggleOf(press('x', {code: 'KeyB'})), 'browser')
})

test('the focus keys (Live 12\'s Move Focus): ⌥ and a digit, nothing else held', () => {
  const alt = (code, extra = {}) => ({code, metaKey: false, altKey: true, ctrlKey: false, shiftKey: false, ...extra})
  assert.equal(areas.focusKeyOf(alt('Digit0')), 'transport')
  assert.equal(areas.focusKeyOf(alt('Digit1')), 'session')
  assert.equal(areas.focusKeyOf(alt('Digit2')), 'arrangement')
  assert.equal(areas.focusKeyOf(alt('Digit3')), 'clip')
  assert.equal(areas.focusKeyOf(alt('Digit4')), 'device')
  assert.equal(areas.focusKeyOf(alt('Digit5')), 'browser')
  assert.equal(areas.focusKeyOf(alt('Digit6')), 'pool')
  assert.equal(areas.focusKeyOf(alt('Digit9')), 'pane')
  assert.equal(areas.focusKeyOf(alt('Digit7')), null)
  assert.equal(areas.focusKeyOf(alt('Digit1', {metaKey: true})), null)
  assert.equal(areas.focusKeyOf(alt('Digit1', {altKey: false})), null)
})

test('the part keys need both ⌘ and ⌥ and refuse ⇧ or ⌃; any other key is none of them', () => {
  assert.equal(areas.frameToggleOf(press('b', {metaKey: false})), null)
  assert.equal(areas.frameToggleOf(press('b', {altKey: false})), null)
  assert.equal(areas.frameToggleOf(press('b', {shiftKey: true})), null)
  assert.equal(areas.frameToggleOf(press('l', {ctrlKey: true})), null)
  assert.equal(areas.frameToggleOf(press('k')), null)
})

test('⇧Tab switches Clip and Device view; Tab alone, or with ⌘ ⌥ ⌃, does not', () => {
  const tab = extra => ({key: 'Tab', shiftKey: true, metaKey: false, altKey: false, ctrlKey: false, ...extra})
  assert.equal(areas.switchesDetailSide(tab()), true)
  assert.equal(areas.switchesDetailSide(tab({shiftKey: false})), false)
  assert.equal(areas.switchesDetailSide(tab({metaKey: true})), false)
  assert.equal(areas.switchesDetailSide(tab({altKey: true})), false)
  assert.equal(areas.switchesDetailSide(tab({ctrlKey: true})), false)
  assert.equal(areas.switchesDetailSide({key: 'a', shiftKey: true, metaKey: false, altKey: false, ctrlKey: false}), false)
})

test('the browser and the rail are bounded by each other and the panes\' least width; the detail area by the window\'s height', () => {
  // 1440 wide: the browser may take the window less the padding, the shown rail and the panes' 240.
  assert.equal(areas.browserMax(1440, 300), 1440 - 2 * areas.FRAME_PAD - 300 - areas.MIN_CENTRE_W)
  assert.equal(areas.clampBrowserWidth(5000, 1440, 300), areas.browserMax(1440, 300))
  assert.equal(areas.clampBrowserWidth(10, 1440, 0), areas.MIN_BROWSER_W)
  assert.equal(areas.clampRailWidth(5000, 1440, 0), areas.RAIL_MAX_W, 'the rail never passes its own bound')
  assert.equal(areas.clampRailWidth(5000, 1000, 430), Math.max(areas.RAIL_MIN_W, 1000 - 12 - 430 - 240), 'nor what the browser and the panes leave')
  assert.equal(areas.clampRailWidth(10, 1440, 0), areas.RAIL_MIN_W)
  assert.equal(areas.clampDetailHeight(5000, 900), 900 - areas.DETAIL_KEEPS_H)
  assert.equal(areas.clampDetailHeight(1, 900), areas.MIN_DETAIL_H)
  assert.equal(areas.expandedDetailHeight(900), 900 - areas.EXPANDED_KEEPS_H)
  assert.equal(areas.expandedDetailHeight(100), areas.MIN_DETAIL_H, 'never below its least, however small the window')
})

test('a drag keeps the offset it was taken at: the first move never jumps, and the part grows the way the pointer says', () => {
  const drag = {at: 500, size: 330}
  assert.equal(areas.draggedSize(drag, 500, -1), 330, 'no move, no change')
  assert.equal(areas.draggedSize(drag, 480, -1), 350, 'the detail area grows as the pointer rises')
  assert.equal(areas.draggedSize({at: 200, size: 430}, 260, 1), 490, 'the browser grows as the pointer moves right')
})

test('drawnSizes holds each chosen size inside the window as it stands; null keeps the stylesheet\'s own; the book keeps the choice', () => {
  const chosen = {browserW: 900, railW: 700, detailH: 2000}
  const drawn = areas.drawnSizes(chosen, {browser: true, rail: true}, [1200, 800])
  assert.equal(drawn.railW, areas.clampRailWidth(700, 1200, 0))
  assert.equal(drawn.browserW, areas.clampBrowserWidth(900, 1200, drawn.railW), 'the browser yields to the rail as drawn')
  assert.equal(drawn.detailH, areas.expandedDetailHeight(800))
  assert.deepEqual(chosen, {browserW: 900, railW: 700, detailH: 2000}, 'the chosen sizes are untouched')
  const hidden = areas.drawnSizes(chosen, {browser: true, rail: false}, [1200, 800])
  assert.equal(hidden.browserW, areas.clampBrowserWidth(900, 1200, 0), 'a hidden rail leaves its width to the browser')
  assert.deepEqual(areas.drawnSizes({browserW: null, railW: null, detailH: null}, {browser: true, rail: true}, [1200, 800]), {browserW: null, railW: null, detailH: null})
  const railDefault = areas.drawnSizes({browserW: 2000, railW: null, detailH: null}, {browser: true, rail: true}, [1200, 800], 300)
  assert.equal(railDefault.browserW, areas.clampBrowserWidth(2000, 1200, 300), 'the rail\'s default width counts while it shows')
})

test('each frame\'s detail expansion returns exactly the height it had, and only to the workspace and lease that made it', () => {
  const at = {frame: 'base', workspaceId: 'w1', accessEpoch: 3}
  let held = areas.expandDetail({}, at, 330)
  assert.deepEqual(held.base, {height: 330, workspaceId: 'w1', accessEpoch: 3})
  assert.equal(areas.expandDetail(held, at, 600), held, 'a second expansion keeps the first height to return to')
  held = areas.expandDetail(held, {frame: 'factory', workspaceId: 'w1', accessEpoch: 3}, null)
  assert.equal(areas.keptDetailHeight(held, 'base', 700), 330, 'while expanded, the book keeps the height it returns to')
  assert.equal(areas.keptDetailHeight(held, 'techne', 280), 280)
  assert.equal(areas.enteredDetailHeight(held, 'base', 330, 900), areas.expandedDetailHeight(900), 'left expanded, it enters expanded')
  assert.equal(areas.enteredDetailHeight(held, 'techne', 280, 900), 280)
  const back = areas.collapseDetail(held, at)
  assert.deepEqual(back.restore, {height: 330})
  assert.equal(back.held.base, undefined)
  assert.ok(back.held.factory, 'the other frames keep their own')
  const foreign = areas.collapseDetail(held, {frame: 'base', workspaceId: 'w2', accessEpoch: 3})
  assert.equal(foreign.restore, undefined, 'another workspace\'s expansion restores nothing here')
  assert.equal(foreign.held.base, undefined, 'and is let go')
  assert.equal(areas.collapseDetail(held, {frame: 'base', workspaceId: 'w1', accessEpoch: 4}).restore, undefined, 'nor one under another lease')
  assert.deepEqual(areas.collapseDetail({}, at), {held: {}}, 'nothing expanded, nothing to restore')
})
