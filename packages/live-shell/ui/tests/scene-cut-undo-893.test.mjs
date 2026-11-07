// O-I #747 round 893, XT02–XT06 (manual §16.6, Arrangement view: "Every edit is one labelled step in the undo list"; §10.9 Undo and Redo).
// Round 892 gave a cut the owner takes its way back on the shell's undo list, asked only while the Expression stands at the revision the
// cut left. A frame-local edit that is not saved yet leaves that revision where it was, so ⌘Z in the shell would have taken back that
// edit in the cut's name. Now the cut's way back proves the frame's own history: Undo runs only while the step on top of the frame's undo
// list is the cut's own step (its step id, as the cut's reply named it), Redo only while the cut's step is on top of its redo list.
// Otherwise it refuses in words that name the change on top, asks no owner, and the edit and the cut both stand.
// Channels: SCRIPTED — the shell's Expressions controls over a fake presented composition whose reading names the frame's history tops
// (each owner call recorded).
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

const E = 'expression:dawn'
/** The frame: its own history (each step with its id), and the revision its owner's reading stands at. An owner act (a cut, Undo or Redo
 * asked of it) moves the revision on; a frame-local edit not saved yet does not. */
function frame() {
  const f = {calls: [], presented: true, revision: 5, done: [], undone: [], next: 1}
  f.read = () => ({basis: {expression_ref: E, revision: f.revision, scene_ref: `${E}:scene:1`},
    history: {canUndo: f.done.length > 0, canRedo: f.undone.length > 0, ...(f.done.length ? {undo: f.done.at(-1)} : {}), ...(f.undone.length ? {redo: f.undone.at(-1)} : {})}})
  f.reading = f.read()
  f.local = label => { f.done.push({label, step: `h.${f.next++}`}); f.undone = []; f.reading = f.read() }
  f.ownUndo = () => { f.undone.push(f.done.pop()); f.reading = f.read() }
  f.owner = (from, to) => { if (from.length) to.push(from.pop()); f.revision++; f.reading = f.read(); return {ok: true, reading: f.reading} }
  return f
}
function composition(f) {
  const actions = {
    sceneEdit: async intent => { f.calls.push(['edit', intent.operation]); f.local(`Trim ${intent.scene_ref}`); f.revision++; f.reading = f.read(); return {ok: true, reading: f.reading} },
    history: async (operation, at) => { f.calls.push([operation, at?.revision ?? 'no basis']); return operation === 'undo' ? f.owner(f.done, f.undone) : f.owner(f.undone, f.done) },
    scene: async () => ({ok: true, reading: f.reading}),
  }
  return {owner: 'expressions', content: {}, actions, isPresented: () => f.presented, currentReading: () => f.reading}
}
const link = {state: null, run: null}
const TRIM = {operation: 'trim', scene_ref: 's1', edge: 'end', seconds: 2}

test('XT02–XT06: an unsaved frame-local edit after the cut is never undone in the cut\'s name: Undo refuses in words, asks no owner, and both stand', async () => {
  const f = frame(), source = composition(f)
  const answer = await expressionsControls(source, link).sceneEdit.run(TRIM)
  assert.equal(typeof answer.ownerStep?.undo, 'function')
  f.local('Move Glyph')
  const refused = await answer.ownerStep.undo()
  assert.equal(refused.ok, false)
  assert.match(refused.error, /"Move Glyph"/, 'it names the change on top')
  assert.match(refused.error, /Nothing was changed\.$/)
  assert.deepEqual(f.calls, [['edit', 'trim']], 'no owner was asked')
  assert.deepEqual(f.done.map(step => step.label), ['Trim s1', 'Move Glyph'], 'the edit and the cut both stand')
  // The frame takes its own edit back: the cut's step is on top again, and its way back runs.
  f.ownUndo()
  assert.deepEqual(await answer.ownerStep.undo(), {ok: true, note: 'Taken back.'})
  assert.deepEqual(await answer.ownerStep.redo(), {ok: true, note: 'Made again.'})
  assert.deepEqual(f.calls, [['edit', 'trim'], ['undo', 6], ['redo', 7]])
})

test('XT02–XT06: Redo makes the cut again only while its step is on top of the frame\'s redo list', async () => {
  const f = frame(), source = composition(f)
  const answer = await expressionsControls(source, link).sceneEdit.run(TRIM)
  assert.deepEqual(await answer.ownerStep.undo(), {ok: true, note: 'Taken back.'})
  // A frame-local edit after the Undo clears the frame's redo list: there is nothing of the cut to make again.
  f.local('Move Glyph')
  const gone = await answer.ownerStep.redo()
  assert.equal(gone.ok, false)
  assert.match(gone.error, /Nothing was changed\.$/)
  // The frame's own Undo puts its edit on top of the redo list: Redo would make that again, not the cut.
  f.ownUndo()
  const other = await answer.ownerStep.redo()
  assert.equal(other.ok, false)
  assert.match(other.error, /"Move Glyph"/)
  assert.deepEqual(f.calls, [['edit', 'trim'], ['undo', 6]], 'no owner was asked to redo')
})

test('XT02–XT06: a cut whose reply names no step of the frame\'s history carries no way back', async () => {
  const f = frame(), source = composition(f)
  source.actions.sceneEdit = async () => { f.revision++; return {ok: true, reading: {basis: f.read().basis, history: {canUndo: true, canRedo: false}}} }
  const answer = await expressionsControls(source, link).sceneEdit.run(TRIM)
  assert.equal(answer.ok, true)
  assert.equal('ownerStep' in answer, false, 'without the step it cannot prove, it lists nothing')
})
