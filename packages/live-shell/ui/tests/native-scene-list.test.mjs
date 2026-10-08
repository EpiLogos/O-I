import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production model source in memory, same loader as the sibling native tests.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function load(url,context,next){if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};}`)}`, import.meta.url)
const {reorderScenes, dropSlotTarget, addSceneIntent, addSceneBlock, sceneStanding, SCENE_LIMIT} = await import('../src/components/nativeSceneList.ts')

const ORDER = ['scene:a', 'scene:b', 'scene:c', 'scene:d']

test('reorderScenes moves one row to its final index and sends a full permutation', () => {
  assert.deepEqual(reorderScenes(ORDER, 0, 2), ['scene:b', 'scene:c', 'scene:a', 'scene:d'])
  assert.deepEqual(reorderScenes(ORDER, 3, 0), ['scene:d', 'scene:a', 'scene:b', 'scene:c'])
  assert.deepEqual(reorderScenes(ORDER, 1, 2), ['scene:a', 'scene:c', 'scene:b', 'scene:d'])
  for (const [from, to] of [[0, 3], [3, 1], [2, 0]]) {
    const next = reorderScenes(ORDER, from, to)
    assert.deepEqual([...next].sort(), [...ORDER].sort(), 'membership is preserved')
    assert.equal(new Set(next).size, ORDER.length, 'no duplicates')
  }
})

test('reorderScenes never mutates its input', () => {
  const order = [...ORDER]
  reorderScenes(order, 0, 3)
  assert.deepEqual(order, ORDER)
})

test('reorderScenes returns null for a no-op and for any out-of-bounds or non-integer index', () => {
  assert.equal(reorderScenes(ORDER, 2, 2), null, 'same index is a no-op')
  assert.equal(reorderScenes(ORDER, -1, 0), null)
  assert.equal(reorderScenes(ORDER, 0, -1), null)
  assert.equal(reorderScenes(ORDER, 0, ORDER.length), null, 'target past the last row')
  assert.equal(reorderScenes(ORDER, ORDER.length, 0), null, 'source past the last row')
  assert.equal(reorderScenes(ORDER, 1.5, 0), null)
  assert.equal(reorderScenes(ORDER, Number.NaN, 0), null)
  assert.equal(reorderScenes([], 0, 0), null)
  assert.equal(reorderScenes(['scene:only'], 0, 0), null, 'a single row has no move')
})

test('reorderScenes keyboard moves: Alt+Up at the top and Alt+Down at the bottom are no-ops', () => {
  assert.equal(reorderScenes(ORDER, 0, -1), null)
  assert.equal(reorderScenes(ORDER, ORDER.length - 1, ORDER.length), null)
  assert.deepEqual(reorderScenes(ORDER, 2, 1), ['scene:a', 'scene:c', 'scene:b', 'scene:d'])
})

test('dropSlotTarget maps an insertion slot to the final index after the dragged row is removed', () => {
  // Dragging the row at index 0 (a) to before c (slot 2) lands it at index 1.
  assert.equal(dropSlotTarget(0, 2), 1)
  assert.deepEqual(reorderScenes(ORDER, 0, dropSlotTarget(0, 2)), ['scene:b', 'scene:a', 'scene:c', 'scene:d'])
  // Dragging a to the end (slot 4) lands it at index 3.
  assert.equal(dropSlotTarget(0, 4), 3)
  assert.deepEqual(reorderScenes(ORDER, 0, dropSlotTarget(0, 4)), ['scene:b', 'scene:c', 'scene:d', 'scene:a'])
  // Dropping on either side of its own row is a no-op.
  assert.equal(reorderScenes(ORDER, 1, dropSlotTarget(1, 1)), null)
  assert.equal(reorderScenes(ORDER, 1, dropSlotTarget(1, 2)), null)
})

test('addSceneIntent names only the operation unless a trimmed title is given', () => {
  assert.deepEqual(addSceneIntent(), {operation: 'add'})
  assert.deepEqual(addSceneIntent('  Verse  '), {operation: 'add', title: 'Verse'})
  assert.deepEqual(addSceneIntent('x'.repeat(160)), {operation: 'add', title: 'x'.repeat(160)})
  assert.throws(() => addSceneIntent('   '), /1–160 characters/)
  assert.throws(() => addSceneIntent(''), /1–160 characters/)
  assert.throws(() => addSceneIntent('x'.repeat(161)), /1–160 characters/)
})

test('addSceneBlock refuses an incomplete order and the 64-Scene bound', () => {
  assert.equal(SCENE_LIMIT, 64)
  assert.equal(addSceneBlock(3, true), null)
  assert.equal(addSceneBlock(63, true), null, 'the 64th Scene is admitted')
  assert.match(addSceneBlock(64, true), /up to 64/)
  assert.match(addSceneBlock(3, false), /complete Scene order/)
})

test('sceneStanding claims Saved only when the owner reports it', () => {
  assert.deepEqual(sceneStanding({snapshot: {availability: 'present', standing: 'Saved'}}).label, 'Saved')
  assert.equal(sceneStanding({snapshot: {availability: 'present', standing: 'Edited since save'}}).label, 'Edited')
  assert.equal(sceneStanding({snapshot: {availability: 'absent', standing: 'Draft'}}).label, 'Draft')
  assert.equal(sceneStanding({snapshot: {availability: 'absent', standing: null}}).label, 'Draft')
  // A present snapshot whose comparison is unavailable is not called Saved or Edited.
  const partial = sceneStanding({snapshot: {availability: 'present', standing: null}})
  assert.equal(partial.label, 'Snapshot')
  assert.notEqual(partial.tone, 'saved')
  assert.match(partial.title, /not claimed/)
  const unknown = sceneStanding({snapshot: {availability: 'unavailable', standing: null}})
  assert.equal(unknown.label, 'Unknown')
  assert.match(unknown.title, /not known/)
})
