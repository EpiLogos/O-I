import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Production model source in memory, same loader as the sibling native tests.
// Pure functions only: no React, DOM or native owner is involved.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  const {readFile}=await import('node:fs/promises');
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

const M = await import('../src/components/nativeArrangementModel.ts')

const states = [
  {step_id: 's1', hold_seconds: 1, transition_seconds: .5, axis_start: 0, axis_hold: 1, axis_transition: .5, axis_end: 1.5},
  {step_id: 's2', hold_seconds: 2, transition_seconds: .5, axis_start: 1.5, axis_hold: 2, axis_transition: .5, axis_end: 4},
  {step_id: 's3', hold_seconds: .5, transition_seconds: 0, axis_start: 4, axis_hold: .5, axis_transition: 0, axis_end: 4.5},
]
const spans = M.arrangementSpans(states)
const ids = list => list.map(span => span.stepId)

test('timing values clamp to the native 0..3600 bounds and snap by mode', () => {
  assert.equal(M.clampTiming(-1), 0)
  assert.equal(M.clampTiming(5000), 3600)
  assert.equal(M.clampTiming(Number.NaN), 0)
  assert.equal(M.snapSeconds(1.2345, 'grid'), 1.25)
  assert.equal(M.snapSeconds(1.3, 'coarse'), 1.5)
  assert.equal(M.snapSeconds(1.23456, 'free'), 1.235)
  assert.equal(M.snapSeconds(-4, 'grid'), 0)
  assert.equal(M.snapSeconds(9999, 'free'), 3600)
})

test('ruler bounds: seconds and morph cycles keep a minimum window and a non-empty extent', () => {
  assert.deepEqual(M.rangeBounds(10, 'seconds'), {start: 0, end: 10, minSpan: .05})
  assert.equal(M.rangeBounds(0, 'seconds').end, 1)
  assert.equal(M.rangeBounds(0, 'morph').minSpan, .01)
  assert.equal(M.rangeBounds(Number.NaN, 'seconds').end, 1)
})

test('clampRange keeps the window inside the bounds and between minSpan and full extent', () => {
  const bounds = M.rangeBounds(10, 'seconds')
  assert.deepEqual(M.clampRange({start: -3, end: 2}, bounds), {start: 0, end: 5})
  assert.deepEqual(M.clampRange({start: 8, end: 20}, bounds), {start: 0, end: 10})
  assert.deepEqual(M.clampRange({start: 9, end: 9.01}, bounds), {start: 9, end: 9.05})
})

test('zoomAround keeps the anchor at its fraction and refuses to leave the bounds', () => {
  const bounds = M.rangeBounds(10, 'seconds')
  assert.deepEqual(M.zoomAround({start: 0, end: 10}, 5, 2, bounds), {start: 2.5, end: 7.5})
  assert.deepEqual(M.zoomAround({start: 2, end: 7}, 2, 2, bounds), {start: 2, end: 4.5})
  assert.deepEqual(M.zoomAround({start: 0, end: 10}, 0, 1000, bounds), {start: 0, end: .05})
  assert.deepEqual(M.zoomAround({start: 0, end: 10}, 5, .5, bounds), {start: 0, end: 10})
  assert.deepEqual(M.zoomAround({start: 0, end: 5}, 20, 2, bounds), {start: 7.5, end: 10})
  assert.deepEqual(M.zoomAround({start: 0, end: 5}, 2, Number.NaN, bounds), {start: 0, end: 5})
})

test('panBy and revealRange move the window by the least amount that keeps it valid', () => {
  const bounds = M.rangeBounds(10, 'seconds')
  assert.deepEqual(M.panBy({start: 0, end: 5}, 2, bounds), {start: 2, end: 7})
  assert.deepEqual(M.panBy({start: 0, end: 5}, -3, bounds), {start: 0, end: 5})
  assert.deepEqual(M.panBy({start: 5, end: 10}, 10, bounds), {start: 5, end: 10})
  assert.deepEqual(M.revealRange({start: 0, end: 5}, 6, 7, bounds), {start: 2, end: 7})
  assert.deepEqual(M.revealRange({start: 2, end: 7}, .5, 1, bounds), {start: .5, end: 5.5})
  assert.deepEqual(M.revealRange({start: 0, end: 5}, 1, 2, bounds), {start: 0, end: 5})
  assert.equal(M.percentOf(2.5, {start: 0, end: 10}), 25)
})

test('ruler ticks are adaptive, labelled in the clock unit, and never denser than 64px', () => {
  const whole = M.rulerTicks(0, 10, 640, 'seconds')
  assert.equal(whole.length, 11)
  assert.equal(whole[0].label, '0')
  assert.equal(whole.at(-1).label, '10')
  const fine = M.rulerTicks(0, .5, 640, 'seconds')
  assert.equal(fine.length, 11)
  assert.equal(fine[1].label, '0.05')
  assert.equal(fine[1].time - fine[0].time, .05)
  const cycles = M.rulerTicks(0, 3, 640, 'morph')
  assert.deepEqual(cycles.map(tick => tick.label), ['0.0', '0.5', '1.0', '1.5', '2.0', '2.5', '3.0'])
  const offset = M.rulerTicks(2.2, 4.3, 640, 'seconds')
  assert.ok(offset.every(tick => tick.time >= 2.2 && tick.time <= 4.3))
  assert.deepEqual(offset.map(tick => tick.label), ['2.25', '2.50', '2.75', '3.00', '3.25', '3.50', '3.75', '4.00', '4.25'])
  const huge = M.rulerTicks(0, 100000, 640, 'seconds')
  assert.ok(huge.length > 0 && huge.length <= 400)
  assert.ok(huge.every(tick => tick.time <= 100000))
  // Spacing in pixels for each drawn window: never denser than the 64px floor.
  for (const [ticks, span] of [[whole, 10], [fine, .5], [cycles, 3], [offset, 2.1]]) {
    for (let i = 1; i < ticks.length; i++) assert.ok((ticks[i].time - ticks[i - 1].time) / span * 640 >= 63.9, `tick spacing ${ticks[i].time}`)
  }
  assert.deepEqual(M.rulerTicks(5, 5, 640, 'seconds'), [])
  assert.deepEqual(M.rulerTicks(0, 1, 0, 'seconds'), [])
})

test('authored states map to spans and a retime preview follows the owner axis', () => {
  assert.deepEqual(ids(spans), ['s1', 's2', 's3'])
  assert.deepEqual([spans[1].axisStart, spans[1].axisEnd], [1.5, 4])
  const longer = M.retimeLane(spans, 's2', {hold: 2.5})
  assert.deepEqual(longer.map(span => [span.axisStart, span.axisEnd]), [[0, 1.5], [1.5, 4.5], [4.5, 5]])
  assert.equal(longer[1].hold, 2.5)
  const shorter = M.retimeLane(spans, 's1', {transition: 0})
  assert.deepEqual(shorter.map(span => [span.axisStart, span.axisEnd]), [[0, 1], [1, 3.5], [3.5, 4]])
  assert.deepEqual(M.retimeLane(spans, 'absent', {hold: 9}).map(span => span.axisEnd), [1.5, 4, 4.5])
})

test('edge drag: zero movement keeps the authored value, grid snaps to 0.05 s, free and coarse modes', () => {
  const span = {hold: 1, transition: .5}
  const still = M.edgeDragToTiming(span, 0, 100, 'grid')
  assert.equal(still.value, 1); assert.equal(still.changed, false); assert.equal(still.width, 1.5)
  assert.equal(M.edgeDragToTiming(span, 1, 100, 'grid').changed, false)
  const tenPx = M.edgeDragToTiming(span, 10, 100, 'grid')
  assert.equal(tenPx.value, 1.1); assert.equal(tenPx.changed, true); assert.deepEqual(tenPx.timing, {hold: 1.1, transition: .5}); assert.equal(tenPx.width, 1.6)
  assert.equal(M.edgeDragToTiming(span, 3, 100, 'free').value, 1.03)
  assert.equal(M.edgeDragToTiming(span, 30, 100, 'coarse').value, 1.5)
  assert.equal(M.edgeDragToTiming(span, 3, 0, 'grid').changed, false)
})

test('edge drag: bounds are enforced and the transition handle leaves hold alone', () => {
  const span = {hold: 1, transition: .5}
  const under = M.edgeDragToTiming(span, -500, 100, 'grid')
  assert.equal(under.value, 0); assert.equal(under.changed, true); assert.equal(under.width, .5)
  const over = M.edgeDragToTiming(span, 1e6, 100, 'grid')
  assert.equal(over.value, 3600)
  const transition = M.edgeDragToTiming(span, 20, 100, 'grid', 'transition')
  assert.equal(transition.key, 'transition'); assert.equal(transition.value, .7)
  assert.deepEqual(transition.timing, {hold: 1, transition: .7}); assert.equal(transition.width, 1.7)
  // An off-grid authored value is not moved by a zero-length gesture.
  assert.equal(M.edgeDragToTiming({hold: 1.23, transition: 0}, 0, 100, 'grid').changed, false)
})

test('selection: plain replaces, Shift extends from the anchor within one lane, Ctrl toggles', () => {
  let sel = M.selectSpan(M.NO_SELECTION, 'L', spans, 's2', 'replace')
  assert.deepEqual(sel, {lane: 'L', ids: ['s2'], primary: 's2', anchor: 's2'})
  sel = M.selectSpan(sel, 'L', spans, 's1', 'extend')
  assert.deepEqual(sel.ids, ['s1', 's2'])
  assert.equal(sel.primary, 's1'); assert.equal(sel.anchor, 's2')
  sel = M.selectSpan(sel, 'L', spans, 's3', 'extend')
  assert.deepEqual(sel.ids, ['s2', 's3'])
  assert.deepEqual(M.selectSpan(sel, 'M', spans, 's3', 'extend'), {lane: 'M', ids: ['s3'], primary: 's3', anchor: 's3'})
  let toggled = M.selectSpan({lane: 'L', ids: ['s1'], primary: 's1', anchor: 's1'}, 'L', spans, 's2', 'toggle')
  assert.deepEqual(toggled, {lane: 'L', ids: ['s1', 's2'], primary: 's2', anchor: 's1'})
  toggled = M.selectSpan(toggled, 'L', spans, 's1', 'toggle')
  assert.deepEqual(toggled, {lane: 'L', ids: ['s2'], primary: 's2', anchor: 's2'})
  assert.equal(M.selectSpan(toggled, 'L', spans, 's2', 'toggle'), M.NO_SELECTION)
  assert.equal(M.selectSpan(sel, 'L', spans, 'absent', 'replace'), sel)
})

test('selection prunes to present states and clears on another lane', () => {
  const pruned = M.pruneSelection({lane: 'L', ids: ['s1', 'gone'], primary: 'gone', anchor: 's1'}, 'L', spans)
  assert.deepEqual(pruned, {lane: 'L', ids: ['s1'], primary: 's1', anchor: 's1'})
  assert.equal(M.pruneSelection({lane: 'L', ids: ['s1'], primary: 's1', anchor: 's1'}, 'M', spans), M.NO_SELECTION)
  assert.equal(M.pruneSelection({lane: 'L', ids: ['gone'], primary: 'gone', anchor: 'gone'}, 'L', spans), M.NO_SELECTION)
  assert.deepEqual(M.selectedIdsIn({lane: 'L', ids: ['s1'], primary: 's1', anchor: 's1'}, 'M'), [])
})

test('duplicate copies one state; a multi-span selection is refused locally', () => {
  assert.deepEqual(M.duplicateTarget({lane: 'L', ids: ['s1'], primary: 's1', anchor: 's1'}, 'L'), {ok: true, stepId: 's1'})
  const two = M.duplicateTarget({lane: 'L', ids: ['s1', 's2'], primary: 's2', anchor: 's1'}, 'L')
  assert.equal(two.ok, false); assert.match(two.reason, /single span/)
  assert.equal(M.duplicateTarget(M.NO_SELECTION, 'L').ok, false)
})

test('reorder: moveStepOrder returns the full permutation, or null when nothing changes', () => {
  assert.deepEqual(M.moveStepOrder(['a', 'b', 'c'], 'c', 0), ['c', 'a', 'b'])
  assert.deepEqual(M.moveStepOrder(['a', 'b', 'c'], 'a', 2), ['b', 'c', 'a'])
  assert.equal(M.moveStepOrder(['a', 'b', 'c'], 'b', 1), null)
  assert.equal(M.moveStepOrder(['a', 'b', 'c'], 'x', 0), null)
  assert.deepEqual(M.moveStepOrder(['a', 'b', 'c'], 'a', 99), ['b', 'c', 'a'])
  assert.equal(M.moveStepOrder(['a', 'b', 'c'], 'a', -5), null)
  assert.deepEqual(M.shiftStepOrder(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c'])
  assert.deepEqual(M.shiftStepOrder(['a', 'b', 'c'], 'b', 1), ['a', 'c', 'b'])
  assert.equal(M.shiftStepOrder(['a', 'b', 'c'], 'a', -1), null)
  assert.equal(M.shiftStepOrder(['a', 'b', 'c'], 'c', 1), null)
})

test('drop slot and insertion line follow pointer time over the other states', () => {
  assert.equal(M.dropSlot(spans, 's2', 0), 0)
  assert.equal(M.dropSlot(spans, 's2', 1), 1)
  assert.equal(M.dropSlot(spans, 's2', 5), 2)
  assert.equal(M.insertionTime(spans, 's2', 0), 0)
  assert.equal(M.insertionTime(spans, 's2', 1), 4)
  assert.equal(M.insertionTime(spans, 's2', 2), 4.5)
})

test('inspector text carries exact authored values', () => {
  assert.equal(M.formatSeconds(0.1 + 0.2), '0.3')
  assert.equal(M.describeSpan(spans[0], 'seconds'), 'hold 1 · transition 0.5 · 0–1.5 seconds')
})
