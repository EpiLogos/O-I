// O-I #747 round 892, XT02–XT06 (manual §16.6, Arrangement view: "Every edit is one labelled step in the undo list"; §10.9 Undo and Redo).
// Walk 892 dragged each cut of a scene on the shell's Arrangement: the owner took it (one labelled step in the frame's own history), but
// ⌘Z and ⇧⌘Z in the shell changed nothing, because the shell's undo list never listed the cut. Now a cut the owner takes answers with its
// way back — the frame's own labelled step, asked of the composition presented when Undo runs, and only while the Expression stands at the
// revision the cut (or the last Undo or Redo of it) left, so Undo never takes back a later change in the cut's name — and the Arrangement
// lists it under the press's words. Undo or Redo the owner refuses stays where it is in the list, and its words reach the info line;
// so does ⌘E's Split where the menu stands it disabled.
// Channels: SCRIPTED — the shell's Expressions controls over a fake presented composition (each call recorded); the undo list; the press
// helper. CODE-READING — the Arrangement's press, the menu bar's Undo and Redo, and the view's keys wire them.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

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

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const {expressionsControls} = await import('../src/frame/tracks/modeTracks.ts')
const undo = await import('../src/frame/menu/undo.ts')
const acts = await import('../src/frame/menu/objectActions.ts')
const {answerOf} = await import('../src/frame/tracks/SessionGrid.tsx')

const E = 'expression:dawn'
/** A presented composition: the owner's reading moves a revision on with every write, and every call is recorded. Since round 893 the
 * reading names the steps on top of the frame's own history (scene-cut-undo-893.test.mjs). */
function composition(name, world) {
  const actions = {
    sceneEdit: async intent => { world.calls.push([name, 'edit', intent.operation]); return world.write() },
    history: async (operation, at) => { world.calls.push([name, operation, at?.revision ?? 'no basis']); return world.write(operation) },
    scene: async () => ({ok: true, reading: world.reading}),
  }
  return {owner: 'expressions', content: {}, actions, isPresented: () => world.presented, currentReading: () => world.reading}
}
function world() {
  const w = {calls: [], presented: true, done: [], undone: [], next: 1}
  const read = revision => ({basis: {expression_ref: E, revision, scene_ref: `${E}:scene:1`},
    history: {canUndo: w.done.length > 0, canRedo: w.undone.length > 0, ...(w.done.length ? {undo: w.done.at(-1)} : {}), ...(w.undone.length ? {redo: w.undone.at(-1)} : {})}})
  w.reading = read(5)
  w.write = move => {
    if (move === 'undo') w.undone.push(w.done.pop())
    else if (move === 'redo') w.done.push(w.undone.pop())
    else { w.done.push({label: 'Edit', step: `h.${w.next++}`}); w.undone = [] }
    w.reading = read(w.reading.basis.revision + 1); return {ok: true, reading: w.reading}
  }
  return w
}
const link = {state: null, run: null}
const CUTS = [{operation: 'move', scene_ref: 's3', mode: 'insert', to_ref: 's1'}, {operation: 'trim', scene_ref: 's1', edge: 'end', seconds: 2},
  {operation: 'roll', scene_ref: 's1', seconds: 2}, {operation: 'slip', scene_ref: 's2', seconds: 1.5}, {operation: 'slide', scene_ref: 's2', seconds: 2},
  {operation: 'split', scene_ref: 's3', at: 4}]

test('XT02–XT06: each cut the owner takes answers with its way back; Undo and Redo ask the frame\'s own step of the composition presented then', async () => {
  for (const intent of CUTS) {
    const w = world(), first = composition('first', w)
    const answer = await expressionsControls(first, link).sceneEdit.run(intent)
    assert.equal(answer.ok, true, intent.operation)
    assert.equal(typeof answer.ownerStep?.undo, 'function', `${intent.operation}: a cut the owner took has a way back`)
    // The pane draws again after the cut: a new presented source. Undo asks it, never the source the cut was made through.
    const later = composition('later', w)
    expressionsControls(later, link)
    assert.deepEqual(await answer.ownerStep.undo(), {ok: true, note: 'Taken back.'})
    assert.deepEqual(await answer.ownerStep.redo(), {ok: true, note: 'Made again.'})
    assert.deepEqual(await answer.ownerStep.undo(), {ok: true, note: 'Taken back.'})
    assert.deepEqual(w.calls, [['first', 'edit', intent.operation], ['later', 'undo', 6], ['later', 'redo', 7], ['later', 'undo', 8]],
      `${intent.operation}: the frame's own step each way, on the basis that stands when it is asked`)
  }
})

test('XT02–XT06: Undo refuses in words where the Expression changed after the cut, or another Expression stands, and asks no owner', async () => {
  const w = world(), source = composition('one', w)
  const answer = await expressionsControls(source, link).sceneEdit.run(CUTS[1])
  w.write()
  const moved = await answer.ownerStep.undo()
  assert.equal(moved.ok, false)
  assert.match(moved.error, /changed after it/)
  assert.match(moved.error, /Nothing was changed/)
  w.reading = {basis: {...w.reading.basis, expression_ref: 'expression:tide', revision: 6}}
  assert.match((await answer.ownerStep.undo()).error, /not the Expression presented now/)
  w.reading = {basis: {...w.reading.basis, expression_ref: E, revision: 6}}; w.presented = false
  assert.match((await answer.ownerStep.undo()).error, /not the Expression presented now/)
  assert.deepEqual(w.calls, [['one', 'edit', 'trim']], 'no owner was asked')
})

test('XT02–XT06: a refused cut, an edit that is no cut, and a reply that names no revision carry no way back', async () => {
  const w = world()
  const refusing = {...composition('r', w), actions: {...composition('r', w).actions, sceneEdit: async () => ({ok: false, error: 'This Scene is locked: unlock it to change it'})}}
  assert.equal('ownerStep' in await expressionsControls(refusing, link).sceneEdit.run(CUTS[1]), false)
  assert.equal('ownerStep' in await expressionsControls(composition('n', w), link).sceneEdit.run({operation: 'rename', scene_ref: 's1', title: 'Dawn 2'}), false)
  const unnamed = {...composition('u', w), actions: {...composition('u', w).actions, sceneEdit: async () => ({ok: true, reading: {}})}}
  assert.equal('ownerStep' in await expressionsControls(unnamed, link).sceneEdit.run(CUTS[1]), false)
})

test('the Arrangement lists an act whose owner answers with its way back, under the press\'s words; Undo or Redo refused stays and says why', async () => {
  undo.clearUndo()
  const calls = [], said = []
  let refuse = false
  const ownerStep = {undo: async () => { calls.push('undo'); return refuse ? {ok: false, error: 'The Expression changed after it. Nothing was changed.'} : {ok: true, note: 'Taken back.'} },
    redo: async () => { calls.push('redo'); return {ok: true, note: 'Made again.'} }}
  const run = acts.ownerStepped({record: undo.recordStep}, 'Trim Dawn', () => ({ok: true, note: 'The Expression changed.', ownerStep}))
  assert.deepEqual(await answerOf(run), {ok: true, text: 'The Expression changed.'})
  assert.deepEqual(undo.undoState(), {undo: 'Trim Dawn', redo: null}, 'one step, labelled as the press said it')
  refuse = true
  await undo.undoStep((label, words) => said.push([label, words]))
  assert.deepEqual(undo.undoState(), {undo: 'Trim Dawn', redo: null}, 'refused: the step stands where it was')
  assert.deepEqual(said, [['Trim Dawn', 'The Expression changed after it. Nothing was changed.']])
  refuse = false
  await undo.undoStep((label, words) => said.push([label, words]))
  assert.deepEqual(undo.undoState(), {undo: null, redo: 'Trim Dawn'})
  await undo.redoStep()
  assert.deepEqual(undo.undoState(), {undo: 'Trim Dawn', redo: null})
  assert.deepEqual(calls, ['undo', 'undo', 'redo'])
  // A refused act, and one that gives no way back, list nothing.
  undo.clearUndo()
  await answerOf(acts.ownerStepped({record: undo.recordStep}, 'Trim Dawn', () => ({ok: false, error: 'This Scene is locked: unlock it to change it', ownerStep})))
  await answerOf(acts.ownerStepped({record: undo.recordStep}, 'Trim Dawn', () => ({ok: true, note: 'The Expression changed.'})))
  assert.deepEqual(undo.undoState(), {undo: null, redo: null})
  undo.clearUndo()
})

test('CODE-READING: the Arrangement\'s press lists what the owner gives back; the menu bar\'s Undo and Redo say a refusal; ⌘E says why Split stands disabled', async () => {
  const ruler = await readFile(new URL('../src/inhabitants/catalogue/panels/dlw__arrangement-ruler.tsx', import.meta.url), 'utf8')
  assert.match(ruler, /answerOf\(ownerStepped\(\{record: recordStep\}, what, run\)\)/)
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /undoStep\(sayRefused\) : redoStep\(sayRefused\)/)
  const menu = await readFile(new URL('../src/frame/menu/TracksMenu.tsx', import.meta.url), 'utf8')
  assert.match(menu, /const refused = refusedAct\(id\)/)
  assert.match(menu, /sayOnInfoLine\(rootRef\.current, refused\.label, refused\.why\)/)
})
