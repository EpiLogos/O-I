// O-I #747 round 895 (DLW build ruling 2026-11-08), the shell's side of item 0:
//   0.1 a press runs exactly what was offered: the offer carries the withheld Action and target, the press names them and the person as its
//       caller, and a trigger that now runs another is said in the owner's words; the shell takes offers only from the presented work.
//   0.2 deleting the presented work closes it: the panel is told (ports.deleted) with the words of what was deleted, before the works list.
//   0.3 the Info line's offer stays until it is answered or its trigger changes: a later plain word leaves it.
//   0.4 Delete and a press say who calls: actor_kind 'human', the person's press in their window.
//   0.8 a Delete conflict says the owner's remedy (for an open work: close it and open it again), never "read the works list again" alone.
// REAL: the shell's offer door (triggerOffers over the Info line's own door), the press and Delete sequences; the owner channel is a SCRIPTED
// STUB. CODE-READING: the Expressions panel's wiring.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const Door = await import('../src/frame/devices/deviceHost.tsx')
const CMD = await import('../src/components/nativeExpressionCommands.ts')
const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const E = 'expression:dawn', SCENE = `${E}:scene:main`, TRIGGER = `${E}:trigger:stamp`
const OFFER = {expression_ref: E, scene_ref: SCENE, trigger_ref: TRIGGER, action_ref: 'central.pages.stamp', target_ref: 'central:file:p.md'}
const document = (action_ref = 'central.pages.stamp', target_ref = 'central:file:p.md') => ({expression_ref: E, revision: 4,
  scenes: [{scene_ref: SCENE, triggers: [{trigger_ref: TRIGGER, occasion: 'scene_enter', target: {kind: 'native_action', action_ref, target_ref, authority_requirement: 'none'}}]}]})

test('an offer is exact: it names the Action and the target the owner withheld', () => {
  assert.deepEqual(CMD.readTriggerOffer(OFFER), OFFER)
  const {target_ref: _target, ...untargeted} = OFFER
  assert.equal(CMD.readTriggerOffer(untargeted), null, 'an offer with no target cannot be pressed exactly')
})

test('the press names its offer and the person as its caller; a changed trigger is said in the owner\'s words', async () => {
  const sent = []
  const changed = async request => { sent.push(request); return {state: 'offer_changed', action_ref: 'central.pages.erase', target_ref: 'central:file:p.md',
    detail: 'This trigger now runs central.pages.erase on central:file:p.md; the offer was for central.pages.stamp on central:file:p.md. Look again.'} }
  assert.equal(await CMD.pressTrigger(changed, OFFER),
    'central.pages.stamp did not run: This trigger now runs central.pages.erase on central:file:p.md; the offer was for central.pages.stamp on central:file:p.md. Look again.')
  assert.deepEqual(sent, [{operation: 'trigger', expression_ref: E, scene_ref: SCENE, trigger_ref: TRIGGER, press: true,
    action_ref: 'central.pages.stamp', target_ref: 'central:file:p.md', actor_kind: 'human'}])
})

test('whether the owner\'s document still keeps the trigger as offered', () => {
  assert.equal(CMD.offerStands(document(), OFFER), true)
  assert.equal(CMD.offerStands(document('central.pages.erase'), OFFER), false, 'another Action')
  assert.equal(CMD.offerStands(document(undefined, 'central:file:q.md'), OFFER), false, 'another target')
  assert.equal(CMD.offerStands({...document(), scenes: [{scene_ref: SCENE, triggers: []}]}, OFFER), false, 'the trigger is gone')
  assert.equal(CMD.offerStands({...document(), expression_ref: 'expression:dusk'}, OFFER), false, 'another work')
})

test('the Info line\'s offer is the presented work\'s, and stands until it is answered or its trigger changes', async () => {
  Door.offerOnInfoLine(null)
  let read = document()
  const asked = []
  const channel = async request => {asked.push(request); if (read instanceof Error) throw read; return {state: 'ready', document: read}}
  const offers = CMD.triggerOffers({show: Door.offerOnInfoLine, shown: Door.readInfoOffer, channel: () => channel})
  offers.take(OFFER, 'Dawn enters → central.pages.stamp was not run…', {expression_ref: 'expression:dusk', revision: 2})
  assert.equal(Door.readInfoOffer(), null, 'another open work\'s offer is not taken')
  const presented = {expression_ref: E, revision: 4}
  offers.take(OFFER, 'Dawn enters → central.pages.stamp was not run…', presented)
  assert.equal(Door.readInfoOffer()?.act, 'Run')
  offers.take(undefined, 'Dawn enters → central.pages.peek ran.', presented)
  assert.equal(Door.readInfoOffer()?.words, 'Dawn enters → central.pages.stamp was not run…', 'a later plain word leaves the offer')
  await offers.follow(presented)
  assert.deepEqual(asked, [], 'the same revision is not read again')
  await offers.follow({...presented, revision: 5})
  assert.equal(Door.readInfoOffer()?.act, 'Run', 'a move that keeps the trigger as offered keeps the offer')
  read = Error('The owner did not answer')
  await offers.follow({...presented, revision: 6})
  assert.equal(Door.readInfoOffer()?.act, 'Run', 'a read that fails leaves the offer: the owner still refuses a changed press')
  read = document('central.pages.erase')
  await offers.follow({...presented, revision: 7})
  assert.equal(Door.readInfoOffer(), null, 'its trigger changed: the offer goes')
  assert.deepEqual(asked.map(request => [request.operation, request.expression_ref]), [['inspect', E], ['inspect', E], ['inspect', E]])

  offers.take(OFFER, 'again', presented)
  await offers.follow({expression_ref: 'expression:dusk', revision: 1})
  assert.equal(Door.readInfoOffer(), null, 'another work presented: the offer goes')
  offers.take(OFFER, 'again', presented)
  offers.forget(E)
  assert.equal(Door.readInfoOffer(), null, 'its work deleted: the offer goes')
  offers.take(OFFER, 'again', presented)
  read = document()
  const answered = await Door.pressInfoOffer()
  assert.equal(typeof answered, 'string')
  assert.equal(Door.readInfoOffer(), null, 'answered: the offer goes')
  offers.take(OFFER, 'again', presented)
  offers.withdraw()
  assert.equal(Door.readInfoOffer(), null, 'the panel goes: so does its offer')
})

const CENTRAL_FILE = {schema: 'central.path-ref/v1', ref: 'central:file:dawn', root: 'central:root', path: 'Control/user/flows/dawn.expression.json'}
test('Delete says the person is its caller; a deleted work is closed where it is presented before the works list; a conflict says the owner\'s remedy', async () => {
  const events = []
  const answer = {state: 'deleted', expression_ref: E, title: 'Dawn', location: CENTRAL_FILE, revision: 'r3', recover: {action: 'central.files.restore', revision: 'r3'}}
  const ports = {expression: async request => {events.push(['owner', request]); return answer}, refresh: async () => {events.push(['refresh'])},
    deleted: (ref, words) => events.push(['deleted', ref, words])}
  const done = await CMD.deleteWork(ports, [{expression_ref: E, title: 'Dawn', revision: 3, open: true}], E)
  const note = 'Dawn left the works home for Central\'s trash: Central\'s file history brings it back.'
  assert.deepEqual(done, {ok: true, note})
  assert.deepEqual(events, [['owner', {operation: 'delete', expression_ref: E, actor: 'human:expressions-app', actor_kind: 'human'}], ['deleted', E, note], ['refresh']])
  const remedy = 'Its file changed since this work was opened or saved, so what you hold is not what the file holds now: close it and open it again, then delete it.'
  const conflict = await CMD.deleteWork({expression: async () => ({state: 'file_revision_conflict', open: true, detail: remedy}), refresh: async () => {}}, [], E)
  assert.deepEqual(conflict, {ok: false, error: `The work stays in the works home. ${remedy}`})
  const agent = await CMD.deleteWork({expression: async () => ({state: 'delete_refused', detail: 'an agent cannot delete it. Ask the person to.'}), refresh: async () => {}}, [], E)
  assert.deepEqual(agent, {ok: false, error: 'Central would not take it to the trash: an agent cannot delete it. Ask the person to.'})
})

test('CODE-READING: the panel takes offers as the presented work\'s, follows the presented work, and closes a deleted work', () => {
  const panel = source('panels/expressions.tsx')
  assert.match(panel, /void offers\.follow\(state\.nativeScene\)/)
  assert.doesNotMatch(panel, /offerOnInfoLine\(offer \?/, 'a plain word no longer clears the offer')
  const deleted = panel.slice(panel.indexOf('deleted: (ref, words) => {'), panel.indexOf('}})', panel.indexOf('deleted: (ref, words) => {')))
  assert.match(deleted, /deletedWorks\.add\(ref\)/)
  assert.match(deleted, /if \(pendingOpen\.current === ref\) pendingOpen\.current = null/, 'a held open is dropped')
  assert.match(deleted, /owner\.surfaceEngine\(owner\.current\.id, binding\.id, undefined\)/, 'the workspace binding names it no more')
  assert.match(deleted, /offers\.forget\(ref\)/)
  assert.match(deleted, /mounted\?\.host\.closeDeleted\(ref, words\)/, 'the frame lets go of it and says what was deleted')
  assert.match(panel, /const heard = \(ref: string\) => \(result: \{ok: boolean; error\?: string\}\) => \{if \(!live \|\| deletedWorks\.has\(ref\)\) return;/, 'its dropped open offers no Retry')
  assert.match(source('frame/tracks/modeTracks.ts'), /remove: ref => deleteWork\(ports, works\(\), ref\)/)
})
