// O-I #747 round 895, the shell's side of item 0 (DLW build ruling 2026-11-08) and of its delta review (ruling 2026-11-09, 0b):
//   0.1/0b.1 the consent words are the shell's own: the frame passes on the id of the offer the owner recorded, the Info line reads that
//            record from the owner and says the Action's title and the target by name, never the frame's text; a press names the
//            recorded offer, and a trigger changed since is said in the owner's words; the shell takes offers only from the presented work.
//   0b.2     a Delete and a trigger's Run go by the person's press channel (the desktop host's kernel_press), never by the owner channel
//            the frame and the agents share; a window with no press path (the bridge) refuses in words and asks nothing.
//   0b.2+    the same channel for every person act (the ruling's addition): an Action the shell invokes goes by kernel_press, one the
//            shell relays for the frame by kernel_op, and over the bridge an Action goes to /op as any op (the kernel refuses a person
//            act there in words).
//   0.2/0b.7 deleting the presented work closes it, by behaviour: the held open is dropped, the binding names it no more
//            (surfaceEngine(…, undefined)), the selection expects none, its offer goes and the frame lets go of it.
//   0.3      the Info line's offer stays until it is answered or its trigger changes: a later plain word leaves it.
//   0b.4     Delete of a work the frame holds unsaved edits for is refused: "Save or discard its changes first."
//   0.8      a Delete conflict says the owner's remedy.
//   0b.10    "ran, as your own press" only where the owner ran it on the person's token; otherwise "ran".
// REAL: the shell's offer door (triggerOffers over the Info line's own door), the press and Delete sequences, the deleted work's close, the
// press channel over the kernel bridge (the Tauri core's invoke is a SCRIPTED STUB of the host); the owner channel is a SCRIPTED STUB.
// CODE-READING: the Expressions panel's call of that wiring (frameActs), beside frame-acts-896.test.mjs, which runs it (round 896, 0R-surface.5).
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
const Bridge = await import('../../../../desktop/cradle/src/kernel/bridge.ts')
const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const E = 'expression:dawn', SCENE = `${E}:scene:main`, TRIGGER = `${E}:trigger:stamp`
/** The owner's record of the offer (kernel expression.rs TriggerOffer), as `trigger_offer` gives it back. */
const RECORD = {expression_ref: E, offer_ref: 'offer:1', scene_ref: SCENE, trigger_ref: TRIGGER, action_ref: 'central.pages.stamp', target_ref: 'central:file:p.md',
  action_title: 'Stamp a page', target_name: 'p.md', reads_only: false, authority_requirement: []}
const OWNER_ANSWER = {state: 'offer', offer: {...RECORD, trigger_revision: 'sha256:7f'}}
/** What the frame says with its offer: only the id is read; its words and any Action or target it names are not. */
const FRAME_OFFER = {expression_ref: E, offer_ref: 'offer:1', words: 'Press Run: this only reads', action_ref: 'central.pages.erase', target_ref: 'central:file:everything'}
const SAID = 'Stamp a page on \u201C\u2068p.md\u2069\u201D (\u201C\u2068central:file:p.md\u2069\u201D) was not run: it may write, and a trigger runs only a reading. Run runs it once, as your own press.'
const document = (action_ref = 'central.pages.stamp', target_ref = 'central:file:p.md') => ({expression_ref: E, revision: 4,
  scenes: [{scene_ref: SCENE, triggers: [{trigger_ref: TRIGGER, occasion: 'scene_enter', target: {kind: 'native_action', action_ref, target_ref, authority_requirement: 'none'}}]}]})

test('0b.1: the frame\'s offer is the id of the owner\'s record; anything else the frame says is not read', () => {
  assert.deepEqual(CMD.readTriggerOffer(FRAME_OFFER), {expression_ref: E, offer_ref: 'offer:1'})
  const {offer_ref: _offer, ...unnamed} = FRAME_OFFER
  assert.equal(CMD.readTriggerOffer(unnamed), null, 'an offer naming no record cannot be pressed')
  assert.equal(CMD.readTriggerOffer({...FRAME_OFFER, expression_ref: 'dawn'}), null)
})

test('0b.1: the owner\'s record is read exactly, and only as an offer the owner holds', () => {
  assert.deepEqual(CMD.readOfferRecord(OWNER_ANSWER), RECORD)
  assert.equal(CMD.readOfferRecord({state: 'offer_unknown', detail: 'This offer is not one the kernel holds'}), null)
  const {action_title: _title, ...untitled} = RECORD
  assert.equal(CMD.readOfferRecord({state: 'offer', offer: untitled}), null, 'a record with no title for its Action is not said')
  assert.equal(CMD.readOfferRecord({state: 'offer', offer: {...RECORD, authority_requirement: 'person'}}), null)
})

test('0b.1: the Info line\'s words are the shell\'s own, from the record: the Action\'s title, then the target by name', () => {
  assert.equal(CMD.offerWords(RECORD), SAID)
  assert.equal(CMD.offerWords({...RECORD, action_title: 'Peek at a page', reads_only: true, authority_requirement: ['person']}),
    'Peek at a page on \u201C\u2068p.md\u2069\u201D (\u201C\u2068central:file:p.md\u2069\u201D) was not run: it asks for an authority (person), and a trigger runs only what asks none. Run runs it once, as your own press.')
})

test('round 896, 0R-authority.9: a reading withheld only because it is the person\'s own act says a press is missing, not an authority', () => {
  assert.equal(CMD.offerWords({...RECORD, action_title: 'Record the Day\'s field', reads_only: true, authority_requirement: []}),
    'Record the Day\'s field on \u201C\u2068p.md\u2069\u201D (\u201C\u2068central:file:p.md\u2069\u201D) was not run: it is an act of yours, and a trigger runs your acts only by your press. Run runs it once, as your own press.')
})

test('round 896, 0R-surface.3: the target\'s name is the document\'s, so it stands quoted, cleaned and capped, with its ref beside it', () => {
  const named = target_name => CMD.offerWords({...RECORD, target_name})
  assert.equal(named('Backup is safe. Run to continue.'),
    'Stamp a page on \u201C\u2068Backup is safe. Run to continue.\u2069\u201D (\u201C\u2068central:file:p.md\u2069\u201D) was not run: it may write, and a trigger runs only a reading. Run runs it once, as your own press.')
  assert.match(named('Tidy\u200B notes\u202E\n\t" closed'), /on \u201C\u2068Tidy notes ' closed\u2069\u201D \(\u201C\u2068central:file:p\.md\u2069\u201D\)/, 'controls, format and quote marks cannot break the quotes')
  const long = named('n'.repeat(200))
  assert.match(long, new RegExp(`on \u201C\u2068${'n'.repeat(79)}\u2026\u2069\u201D \\(\u201C\u2068central:file:p\\.md\u2069\u201D\\)`), 'at most 80 characters, with an ellipsis')
  assert.equal(named('central:file:p.md'), 'Stamp a page on \u201C\u2068central:file:p.md\u2069\u201D was not run: it may write, and a trigger runs only a reading. Run runs it once, as your own press.',
    'a name that is the ref is not said twice')
  assert.equal(CMD.offerWords({...RECORD, action_title: 'Stamp a page'}).startsWith('Stamp a page on'), true, 'the Action\'s title stays the catalogue\'s')
  assert.equal(CMD.documentText('\u0007\u2028', 80), '')
  // 1R-surface.8: the ref is quoted and capped as the name is, so it cannot speak in the shell's sentence; blank-looking letters and
  // stacked marks are stripped; the name is isolated (FSI/PDI), so a right-to-left name cannot reorder the sentence around it.
  const ref = 'x) Backup is safe. Run to continue. ('
  assert.equal(CMD.offerWords({...RECORD, target_ref: ref}),
    `Stamp a page on \u201C\u2068p.md\u2069\u201D (\u201C\u2068${ref}\u2069\u201D) was not run: it may write, and a trigger runs only a reading. Run runs it once, as your own press.`)
  assert.match(CMD.offerWords({...RECORD, target_ref: 'r'.repeat(300)}), new RegExp(`\\(\u201C\u2068${'r'.repeat(79)}\u2026\u2069\u201D\\)`), 'the ref capped at 80 too')
  assert.equal(CMD.documentText('a\u2800b\u3164c\u115Fd\u1160e\uFFA0f', 80), 'a b c d e f', 'blank-looking letters read as the space they look like')
  assert.equal(CMD.documentText('\u3164\u2800\u115F', 80), '', 'a name of them alone is no name')
  assert.equal(CMD.documentText('Z\u0301\u0302\u0303\u0304\u0305\u0306o\u0301\u0302\u0303', 80), 'Zo\u0301\u0302\u0303', 'four marks or more go; three stay')
  assert.equal(CMD.quotedName('\u05E9\u05DC\u05D5\u05DD'), '\u201C\u2068\u05E9\u05DC\u05D5\u05DD\u2069\u201D')
  assert.equal(CMD.quotedName('a\u2068b\u2069\u202Ec'), '\u201C\u2068a b c\u2069\u201D', 'the name\'s own isolates and overrides go')
})

test('round 896, 0R-surface.6: an offer is the presented work\'s as it stands when the owner answers; a work switched during the round trip takes none', async () => {
  Door.offerOnInfoLine(null)
  let answer
  const channel = async () => new Promise(resolve => {answer = resolve})
  const offers = CMD.triggerOffers({show: Door.offerOnInfoLine, shown: Door.readInfoOffer, channel: () => channel, press: () => null})
  let presented = {expression_ref: E, revision: 4}
  const taking = offers.take(FRAME_OFFER, () => presented)
  presented = {expression_ref: 'expression:dusk', revision: 1}
  answer(OWNER_ANSWER)
  assert.deepEqual(await taking, {state: 'not-presented'})
  assert.equal(Door.readInfoOffer(), null, 'work A\'s Run does not stand while work B is presented')
  presented = {expression_ref: E, revision: 9}
  const again = offers.take(FRAME_OFFER, () => presented)
  answer(OWNER_ANSWER)
  const taken = await again
  assert.equal(taken.state, 'standing')
  assert.equal(Door.readInfoOffer()?.words, SAID)
  offers.withdraw()
})

test('round 896, 1R-surface.9: a word said before the frame announces its work waits for the announce, then asks again which work is presented', async () => {
  Door.offerOnInfoLine(null)
  const asked = []
  const channel = async request => {asked.push(request.operation); return OWNER_ANSWER}
  const offers = CMD.triggerOffers({show: Door.offerOnInfoLine, shown: Door.readInfoOffer, channel: () => channel, press: () => null})
  // The frame says the word for work A before its announce of A reaches the shell: the shell still reads no work presented.
  let presented = null
  const taking = offers.take(FRAME_OFFER, () => presented)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(asked, [], 'the owner is not asked for a work not presented yet')
  // The announce comes: A is presented; the offer is read and stands.
  presented = {expression_ref: E, revision: 4}
  await offers.follow(presented)
  const taken = await taking
  assert.equal(taken.state, 'standing')
  assert.equal(Door.readInfoOffer()?.words, SAID)
  offers.withdraw()
  // A word for a work that never comes is let go once the wait ends, and nothing is said or asked.
  assert.equal(CMD.ANNOUNCE_WAIT_MS, 1500)
  presented = {expression_ref: 'expression:dusk', revision: 1}
  asked.length = 0
  assert.deepEqual(await offers.take(FRAME_OFFER, () => presented), {state: 'not-presented'})
  assert.deepEqual(asked, [])
  assert.equal(Door.readInfoOffer(), null)
})

test('0b.1/0b.10: the press names the recorded offer; "as your own press" only where the person\'s token ran it; a changed trigger in the owner\'s words', async () => {
  const sent = []
  let reply = {state: 'action_result', dispatch: {state: 'invoked'}, as_person: true}
  const channel = async request => {sent.push(request); return reply}
  assert.equal(await CMD.pressTrigger(channel, RECORD), 'Stamp a page ran, as your own press.')
  assert.deepEqual(sent, [{operation: 'trigger', expression_ref: E, scene_ref: SCENE, trigger_ref: TRIGGER, press: true, offer_ref: 'offer:1'}],
    'the press names the offer and nothing else of what to run')
  reply = {state: 'action_result', dispatch: {state: 'invoked'}, as_person: false}
  assert.equal(await CMD.pressTrigger(channel, RECORD), 'Stamp a page ran.')
  reply = {state: 'action_result', dispatch: {state: 'invoked'}}
  assert.equal(await CMD.pressTrigger(channel, RECORD), 'Stamp a page ran.', 'an answer that does not say it ran on the person\'s token is not said so')
  reply = {state: 'offer_changed', detail: 'This trigger changed since it was offered: it now runs central.pages.erase on central:file:p.md, and the offer was for central.pages.stamp on central:file:p.md. Look again.'}
  assert.equal(await CMD.pressTrigger(channel, RECORD), `Stamp a page did not run: ${reply.detail}`)
  assert.equal(await CMD.pressTrigger(null, RECORD), CMD.OWNER_UNATTACHED)
})

test('whether the owner\'s document still keeps the trigger as offered', () => {
  assert.equal(CMD.offerStands(document(), RECORD), true)
  assert.equal(CMD.offerStands(document('central.pages.erase'), RECORD), false, 'another Action')
  assert.equal(CMD.offerStands(document(undefined, 'central:file:q.md'), RECORD), false, 'another target')
  assert.equal(CMD.offerStands({...document(), scenes: [{scene_ref: SCENE, triggers: []}]}, RECORD), false, 'the trigger is gone')
  assert.equal(CMD.offerStands({...document(), expression_ref: 'expression:dusk'}, RECORD), false, 'another work')
})

test('the Info line\'s offer is the presented work\'s, said from the owner\'s record, run by the press channel, and stands until answered or its trigger changes', async () => {
  Door.offerOnInfoLine(null)
  let read = document(), offered = OWNER_ANSWER
  const asked = [], pressed = []
  const channel = async request => {
    asked.push(request)
    if (request.operation === 'trigger_offer') return offered
    if (read instanceof Error) throw read
    return {state: 'ready', document: read}
  }
  const press = async request => {pressed.push(request); return {state: 'action_result', dispatch: {state: 'invoked'}, as_person: true}}
  const offers = CMD.triggerOffers({show: Door.offerOnInfoLine, shown: Door.readInfoOffer, channel: () => channel, press: () => press})
  await offers.take(FRAME_OFFER, () => ({expression_ref: 'expression:dusk', revision: 2}))
  assert.equal(Door.readInfoOffer(), null, 'another open work\'s offer is not taken')
  assert.deepEqual(asked, [], 'nor asked after')
  const presented = {expression_ref: E, revision: 4}
  offered = {state: 'offer_unknown', detail: 'This offer is not one the kernel holds'}
  await offers.take(FRAME_OFFER, () => presented)
  assert.equal(Door.readInfoOffer(), null, 'an offer the owner does not hold is not said')
  offered = {state: 'offer', offer: {...RECORD, expression_ref: 'expression:dusk'}}
  await offers.take(FRAME_OFFER, () => presented)
  assert.equal(Door.readInfoOffer(), null, 'a record of another work is not taken')
  offered = OWNER_ANSWER
  asked.length = 0
  await offers.take(FRAME_OFFER, () => presented)
  assert.deepEqual(asked, [{operation: 'trigger_offer', offer_ref: 'offer:1'}], 'the record is read from the owner by the offer\'s id')
  assert.equal(Door.readInfoOffer()?.act, 'Run')
  assert.equal(Door.readInfoOffer()?.words, SAID, 'the shell\'s words, not the frame\'s')
  await offers.take(undefined, () => presented)
  assert.equal(Door.readInfoOffer()?.words, SAID, 'a later plain word leaves the offer')
  asked.length = 0
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

  await offers.take(FRAME_OFFER, () => presented)
  await offers.follow({expression_ref: 'expression:dusk', revision: 1})
  assert.equal(Door.readInfoOffer(), null, 'another work presented: the offer goes')
  await offers.take(FRAME_OFFER, () => presented)
  offers.forget(E)
  assert.equal(Door.readInfoOffer(), null, 'its work deleted: the offer goes')
  await offers.take(FRAME_OFFER, () => presented)
  read = document()
  asked.length = 0
  assert.equal(await Door.pressInfoOffer(), 'Stamp a page ran, as your own press.')
  assert.deepEqual(pressed, [{operation: 'trigger', expression_ref: E, scene_ref: SCENE, trigger_ref: TRIGGER, press: true, offer_ref: 'offer:1'}], 'the Run goes by the press channel')
  assert.deepEqual(asked, [], 'and never by the owner channel')
  assert.equal(Door.readInfoOffer(), null, 'answered: the offer goes')
  await offers.take(FRAME_OFFER, () => presented)
  offers.withdraw()
  assert.equal(Door.readInfoOffer(), null, 'the panel goes: so does its offer')
})

const CENTRAL_FILE = {schema: 'central.path-ref/v1', ref: 'central:file:dawn', root: 'central:root', path: 'Control/user/flows/dawn.expression.json'}
const DAWN = [{expression_ref: E, title: 'Dawn', revision: 3, open: true}]
const refused = () => {throw Error('the owner channel carries no press')}
test('0b.2/0b.4: Delete goes by the press channel; a work held with unsaved edits is refused in words; a conflict says the owner\'s remedy', async () => {
  const events = []
  const answer = {state: 'deleted', expression_ref: E, title: 'Dawn', location: CENTRAL_FILE, revision: 'r3', recover: {action: 'central.files.restore', revision: 'r3'}}
  const ports = {expression: refused, press: async request => {events.push(['press', request]); return answer}, refresh: async () => {events.push(['refresh'])},
    deleted: (ref, words) => events.push(['deleted', ref, words]), hold: async ref => {events.push(['hold', ref]); return {ok: true, unsaved: false}}, release: ref => events.push(['release', ref])}
  const done = await CMD.deleteWork(ports, DAWN, E)
  const note = '\u201C\u2068Dawn\u2069\u201D left the works home for Central\'s trash: Central\'s file history brings it back.'
  assert.deepEqual(done, {ok: true, note})
  assert.deepEqual(events, [['hold', E], ['press', {operation: 'delete', expression_ref: E, actor: 'human:expressions-app', actor_kind: 'human'}], ['deleted', E, note], ['release', E], ['refresh']],
    'the frame is asked first, and lets go of the work before its hold')

  events.length = 0
  const held = await CMD.deleteWork({...ports, hold: async ref => {events.push(['hold', ref]); return {ok: true, unsaved: ref === E}}}, DAWN, E)
  assert.deepEqual(held, {ok: false, error: '\u201C\u2068Dawn\u2069\u201D holds changes in the field that are not saved. Save or discard its changes first.'})
  assert.deepEqual(events, [['hold', E], ['release', E]], 'nothing is asked of the owner, and the hold is let go')
  assert.equal(CMD.UNSAVED_DELETE, 'Save or discard its changes first.')
  assert.deepEqual(await CMD.deleteWork({...ports, press: null}, DAWN, E), {ok: false, error: CMD.OWNER_UNATTACHED}, 'no press channel: nothing goes by another')

  const remedy = 'Its file changed since this work was opened or saved, so what you hold is not what the file holds now: close it and open it again, then delete it.'
  const conflict = await CMD.deleteWork({...ports, press: async () => ({state: 'file_revision_conflict', open: true, detail: remedy})}, [], E)
  assert.deepEqual(conflict, {ok: false, error: `The work stays in the works home. ${remedy}`})
  const elsewhere = 'This work lives at Control/user/notes/dawn.expression.json, outside your works home (Control/user/flows/expressions): Delete takes only a work of the works home to Central\'s trash. Delete it in Files.'
  assert.deepEqual(await CMD.deleteWork({...ports, press: async () => ({state: 'delete_refused', detail: elsewhere})}, [], E), {ok: false, error: elsewhere})
  assert.deepEqual(await CMD.deleteWork({...ports, press: async () => ({state: 'delete_refused', failure: {message: 'Central is not taking pages to the trash just now'}})}, [], E),
    {ok: false, error: 'Central would not take it to the trash: Central is not taking pages to the trash just now'})
})

test('0b.2: the press channel is the host\'s kernel_press; a window with no press path refuses in words and asks nothing', async () => {
  const fetched = [], invoked = []
  const priorFetch = globalThis.fetch, priorWindow = globalThis.window
  globalThis.fetch = async (...call) => {fetched.push(call); throw Error('not reached')}
  try {
    const request = {operation: 'delete', expression_ref: E, actor: 'human:expressions-app', actor_kind: 'human'}
    await assert.rejects(CMD.pressChannel({kind: 'bridge', url: 'http://127.0.0.1:9'})(request), {message: Bridge.NO_PRESS_PATH})
    assert.deepEqual(fetched, [], 'the bridge is not asked')
    const failed = await CMD.deleteWork({expression: refused, press: CMD.pressChannel({kind: 'bridge', url: 'http://127.0.0.1:9'}), refresh: async () => {}}, DAWN, E)
    assert.deepEqual(failed, {ok: false, error: Bridge.NO_PRESS_PATH})
    await assert.rejects(CMD.pressChannel({kind: 'unavailable', reason: 'no kernel transport'})(request), {message: 'no kernel transport'})

    globalThis.window = {__TAURI_INTERNALS__: {invoke: async (command, args) => {invoked.push([command, args]); return {result: 'expression', data: {state: 'deleted', expression_ref: E}}}}}
    assert.deepEqual(await CMD.pressChannel({kind: 'tauri'})(request), {state: 'deleted', expression_ref: E})
    assert.deepEqual(invoked.map(([command]) => command), ['kernel_press'], 'the person\'s press goes by the host\'s press command, not kernel_op')
    assert.deepEqual(invoked[0][1], {op: {op: 'expression', request}})
  } finally {
    globalThis.fetch = priorFetch
    if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow
  }
})

test('0b.2, every person act: the shell\'s own Action goes by kernel_press, the frame\'s relayed one by kernel_op, the bridge\'s to /op', async () => {
  const invoked = [], fetched = []
  const priorFetch = globalThis.fetch, priorWindow = globalThis.window
  const action = {op: 'invoke_action', invocation: {action: 'central.day.move.record', target_ref: 'central:day:2026-11-09', input: {}}}
  const dispatched = {result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: 'central.day.move.record', data: {}}}
  globalThis.window = {__TAURI_INTERNALS__: {invoke: async (command, args) => {invoked.push([command, args.op.op]); return dispatched}}}
  try {
    await Bridge.kernelOp({kind: 'tauri'}, action)
    await Bridge.kernelReadSend({kind: 'tauri'}, action)
    await Bridge.kernelOp({kind: 'tauri'}, {op: 'world_read'})
    assert.deepEqual(invoked, [['kernel_press', 'invoke_action'], ['kernel_press', 'invoke_action'], ['kernel_op', 'world_read']],
      'the shell\'s own Actions go by the press path, its other ops by kernel_op')
    await Bridge.kernelWireOp({kind: 'tauri'}, action)
    assert.deepEqual(invoked[3], ['kernel_op', 'invoke_action'], 'an Action relayed for a frame goes by kernel_op')
    globalThis.fetch = async (url, init) => {fetched.push([url, JSON.parse(init.body).op]); return {json: async () => ({ok: true, outcome: dispatched})}}
    const call = await Bridge.kernelOp({kind: 'bridge', url: 'http://127.0.0.1:9'}, action)
    assert.equal(call.error, undefined)
    assert.deepEqual(fetched, [['http://127.0.0.1:9/op', 'invoke_action']], 'the bridge has no press path: the Action goes to /op as any op')
  } finally {
    globalThis.fetch = priorFetch
    if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow
  }
  // CODE-READING: the boundary relays the frame's channels (its Action pass-through among them) by the wire send alone.
  for (const file of ['cradle.ts', 'techne.ts']) {
    const text = readFileSync(new URL(`../../../expressions-boundary/src/${file}`, import.meta.url), 'utf8')
    assert.match(text, /import \{kernelWireOp\} from '\.\.\/\.\.\/\.\.\/desktop\/cradle\/src\/kernel\/bridge'/, file)
    assert.doesNotMatch(text, /\bkernel(?:Op|ReadSend|Press|Read)\(/, `${file} sends nothing by the shell's own path`)
  }
})

test('0b.7: a deleted work is closed by behaviour: its open is dropped, the binding names it no more, its selection, offer and frame let go', () => {
  const calls = []
  const ports = {deletedWorks: new Set(), pendingOpen: {current: E}, clearOpenFault: ref => calls.push(['clearOpenFault', ref]),
    binding: () => ({workspaceId: 'workspace:1', id: 'binding:expressions', expressionRef: E}),
    surfaceEngine: (...args) => calls.push(['surfaceEngine', ...args]), selection: {current: {workspaceId: 'workspace:1', expected: E}},
    forgetOffer: ref => calls.push(['forgetOffer', ref]), closeInFrame: (ref, words) => calls.push(['closeInFrame', ref, words])}
  CMD.closeDeletedWork(ports, E, 'Dawn left the works home for Central\'s trash.')
  assert.equal(ports.deletedWorks.has(E), true, 'its open, when it answers, offers no Retry')
  assert.equal(ports.pendingOpen.current, null, 'a held open of it is dropped')
  assert.deepEqual(ports.selection.current, {workspaceId: 'workspace:1', expected: undefined})
  assert.deepEqual(calls, [['clearOpenFault', E], ['surfaceEngine', 'workspace:1', 'binding:expressions', undefined], ['forgetOffer', E],
    ['closeInFrame', E, 'Dawn left the works home for Central\'s trash.']])
  assert.equal(calls[1].length, 4, 'surfaceEngine is told the engine is undefined, so no reopen brings it back')

  calls.length = 0
  const other = {...ports, deletedWorks: new Set(), pendingOpen: {current: 'expression:dusk'}, binding: () => ({workspaceId: 'workspace:1', id: 'binding:expressions', expressionRef: 'expression:dusk'}),
    selection: {current: {workspaceId: 'workspace:1', expected: 'expression:dusk'}}}
  CMD.closeDeletedWork(other, E, 'gone')
  assert.equal(other.pendingOpen.current, 'expression:dusk', 'another work\'s open stands')
  assert.deepEqual(other.selection.current, {workspaceId: 'workspace:1', expected: 'expression:dusk'})
  assert.deepEqual(calls.map(([name]) => name), ['clearOpenFault', 'forgetOffer', 'closeInFrame'], 'the binding of another work is left')
})

test('CODE-READING, beside the behavioural tests (frame-acts-896 runs the wiring; info-line-offer-896, delete-hold-896): the panel calls the one wiring with its own ports', () => {
  // Round 896, 0R-surface.5: the wiring these pins read is components/nativeExpressionCommands.ts frameActs, run in frame-acts-896.test.mjs.
  // What stays here is only that the panel hands it its own frame, Info line, fault line and book, and calls it where it did.
  const panel = source('panels/expressions.tsx')
  assert.match(panel, /const acts = frameActs\(\{live: \(\) => live, frame: \(\) => mounted\?\.host, say: words => sayOnInfoLine\(target, 'Expressions', words\),\n\s+show: offerOnInfoLine, shown: readInfoOffer, openFault: setOpenFault, pendingOpen, selection: selectionOwner,/)
  assert.match(panel, /surfaceEngine: \(workspaceId, bindingId, engine\) => bookRef\.current\.surfaceEngine\(workspaceId, bindingId, engine\)\}\)/)
  assert.match(panel, /acts\.attach\(request => owners\.channels\['kernel-expression'\]\(request, context\(\)\), transport, \{works: \(\) => workspaceRef\.current\.nativeWorks,/)
  assert.match(panel, /acts\.follow\(state\)/)
  assert.match(panel, /if \(request\.request === 'say'\) void acts\.say\(request\)/)
  assert.match(panel, /return \(\) => \{live = false; acts\.dispose\(\);/)
  assert.match(panel, /const heard = acts\.heard/)
  assert.doesNotMatch(panel, /setExpressionPress|setWorksDoor|triggerOffers\(|unsavedEdits/, 'the panel holds none of the wiring itself')
  assert.match(source('frame/tracks/modeTracks.ts'), /remove: ref => deleteWork\(ports, works\(\), ref\)/)
})
