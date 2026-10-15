import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// lane-3 E21: the owner answers the frame's wiki standing request for one exact basis (src/native/wikiSubjectStanding.ts).
// The loader is the transpile-only .ts/.tsx loader the other shell tests use; the real projection module and boundary run,
// and no kernel is reached. The live source is read honestly: with no register loaded it refuses by name.
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href)};
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



const {answerWikiSubjectStanding, liveWikiStandingSource, wikiStandingChannel, withWikiSubjectStanding, WIKI_STANDING_ROW_LIMIT} = await import('../src/native/wikiSubjectStanding.ts')
const {WIKI_SUBJECT_STANDING_CHANNEL, readWikiSubjectStandingRequest} = await import('../../../expressions-boundary/src/protocol.ts')
const {configureWikiProjectionAccess, getWikiProjectionState} = await import('../../../../desktop/cradle/src/techne/wikiProjectionStore.ts')
const {publishWikiNativeRegisters} = await import('../../../../desktop/cradle/src/techne/wikiNativeExpression.ts')

const REQUEST = {subject_ref: 'wiki:subject:alpha', expression_ref: 'expression:open', revision: 4}
const HELD = {expression_ref: 'expression:open', revision: 4}
const STANDING = {registerKey: 'central/register-one', expression_ref: 'expression:wiki', scene_ref: 'scene:wiki-1', scene_title: 'Opening',
  entity_ref: 'entity:wiki-a', entity_title: 'Alpha', subject_ref: 'wiki:subject:alpha'}

/** A fake owner reading: the rows it holds for a subject, its load outcome, the registers it cannot read, and its revision. */
function source({rows = [STANDING], loaded = true, revision = 9, unread = [], failure = null} = {}) {
  const asked = []
  let loads = 0
  return {
    asked,
    get loads() {return loads},
    loadRegisters: async () => {loads++; if (failure) throw Error(failure)},
    registersLoaded: () => loaded,
    unreadRegisters: () => unread,
    revision: () => revision,
    standingsOf: subjectRef => {asked.push(subjectRef); return rows},
  }
}

/** A scripted owner kernel behind fetch: the shell config, and the World's projects. Every other native read is refused by
 * name, so no wiki is ever read; each register then stands unavailable, which is exactly what the load must report. */
function kernelStub({worldFails = false, projects = [{name: 'Factory', path: 'Work/Factory'}]} = {}) {
  const ops = []
  const state = {worldFails}
  const original = globalThis.fetch
  const reply = body => ({ok: true, status: 200, json: async () => body})
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url === '/api/config') return reply({default_set: 'test', kernel_bridge: 'http://owner.test'})
    if (url === 'http://owner.test/op') {
      const op = JSON.parse(init.body)
      ops.push(op.op)
      if (op.op === 'world_read') {
        await new Promise(resolve => setTimeout(resolve, 20))
        if (state.worldFails) return reply({ok: false, error: 'the owner refused the World'})
        return reply({ok: true, outcome: {result: 'world_read', snapshot: {navigator: {root: {work: {projects}}}}}})
      }
      return reply({ok: false, error: `stub kernel: no ${op.op} reading`})
    }
    throw Error(`unexpected request ${url}`)
  }
  return {ops, state, restore() {globalThis.fetch = original}}
}

test('the owner answers the exact basis with the rows of its own reading, in the boundary reply shape', async () => {
  const reply = await answerWikiSubjectStanding(REQUEST, HELD, source())
  assert.deepEqual(reply, {
    subject_ref: 'wiki:subject:alpha', expression_ref: 'expression:open', revision: 4, standing_revision: 9,
    rows: [{register_key: 'central/register-one', expression_ref: 'expression:wiki', scene_ref: 'scene:wiki-1', scene_title: 'Opening',
      entity_ref: 'entity:wiki-a', entity_title: 'Alpha', subject_ref: 'wiki:subject:alpha'}],
  })
})

test('a subject with no wiki standing is answered with no rows, not refused', async () => {
  const reply = await answerWikiSubjectStanding(REQUEST, HELD, source({rows: []}))
  assert.deepEqual(reply.rows, [])
  assert.equal(reply.revision, 4)
})

test('a request for an Expression or revision the host no longer holds is refused by name, and no owner is asked', async () => {
  const owner = source()
  await assert.rejects(answerWikiSubjectStanding(REQUEST, {expression_ref: 'expression:other', revision: 4}, owner), /The open Expression moved/)
  await assert.rejects(answerWikiSubjectStanding(REQUEST, {expression_ref: 'expression:open', revision: 5}, owner), /The open Expression moved/)
  await assert.rejects(answerWikiSubjectStanding(REQUEST, null, owner), /The open Expression moved/)
  assert.deepEqual(owner.asked, [], 'a stale basis reads no standing')
  assert.equal(owner.loads, 0, 'a stale basis loads no register')
})

test('the registers are loaded before the answer; a failed load is a named refusal and no standing is read', async () => {
  const failed = source({failure: 'the native owner is unavailable'})
  await assert.rejects(answerWikiSubjectStanding(REQUEST, HELD, failed), /registers were not loaded.*the native owner is unavailable/)
  assert.equal(failed.loads, 1)
  assert.deepEqual(failed.asked, [], 'no standing is read after a failed load')
  const loaded = source()
  await answerWikiSubjectStanding(REQUEST, HELD, loaded)
  assert.equal(loaded.loads, 1, 'the answer asks the owner to load the registers')
})

test('with no wiki register loaded and none disclosed the answer is a named refusal', async () => {
  await assert.rejects(answerWikiSubjectStanding(REQUEST, HELD, source({loaded: false})), /No wiki register is loaded/)
})

test('a register whose reading could not be read refuses the standing by name, never a partial one', async () => {
  const owner = source({unread: [{key: 'Factory', reason: 'the wiki reading failed'}]})
  await assert.rejects(answerWikiSubjectStanding(REQUEST, HELD, owner), /wiki register Factory could not be read \(the wiki reading failed\)/)
  assert.deepEqual(owner.asked, [], 'a partial standing is not read')
})

test('a standing larger than the bound is refused by name, never truncated', async () => {
  const rows = Array.from({length: WIKI_STANDING_ROW_LIMIT + 1}, () => STANDING)
  await assert.rejects(answerWikiSubjectStanding(REQUEST, HELD, source({rows})), /more than the Library shows/)
})

test('the channel owner answers from the basis the host announced for the frame, and refuses when none is announced', async () => {
  const channel = wikiStandingChannel(source())
  const reply = await channel(REQUEST, {state: {nativeScene: {expression_ref: 'expression:open', revision: 4, scene_ref: 'scene:one'}}})
  assert.equal(reply.standing_revision, 9)
  await assert.rejects(channel(REQUEST, {state: null}), /The open Expression moved/)
  await assert.rejects(channel(REQUEST, {state: {}}), /The open Expression moved/)
})

test('a fresh shell holds no register, and the live source refuses by name when the World discloses none', async () => {
  configureWikiProjectionAccess('scope-fresh', 'epoch-fresh', () => true)
  assert.equal(liveWikiStandingSource.registersLoaded(), false, 'a fresh shell holds no register')
  assert.deepEqual(liveWikiStandingSource.unreadRegisters(), [])
  const stub = kernelStub({projects: []})
  try {
    // Central is always disclosed, so an empty World still loads one register, which stands unavailable here and is named.
    await assert.rejects(answerWikiSubjectStanding(REQUEST, HELD), /wiki register central could not be read/)
    assert.equal(getWikiProjectionState().registers.length, 1)
    assert.equal(stub.ops.filter(op => op === 'world_read').length, 1, 'the owner was asked for the World once')
  } finally {stub.restore()}
})

test('an ask loads the World registers through the owner: concurrent asks share one World read, and no reading is repeated', async () => {
  configureWikiProjectionAccess('scope-share', 'epoch-share', () => true)
  const stub = kernelStub()
  try {
    const results = await Promise.all([1, 2, 3].map(() => answerWikiSubjectStanding(REQUEST, HELD).then(() => null, error => error)))
    // The stub reads no wiki: each register stands unavailable and the first one is named. The load is what is under test.
    for (const error of results) assert.match(error.message, /wiki register central could not be read \(stub kernel: no files_list reading\)/)
    assert.equal(stub.ops.filter(op => op === 'world_read').length, 1, 'concurrent asks share one World read')
    assert.equal(stub.ops.filter(op => op !== 'world_read').length, 2, 'each disclosed register is read once: Central and Factory')
    assert.deepEqual(getWikiProjectionState().registers.map(row => row.key), ['central', 'Factory'])
    await assert.rejects(answerWikiSubjectStanding(REQUEST, HELD), /could not be read/)
    assert.equal(stub.ops.filter(op => op === 'world_read').length, 1, 'a settled load is not repeated by a later ask')
    assert.equal(stub.ops.filter(op => op !== 'world_read').length, 2, 'a settled reading is not read again')
  } finally {stub.restore()}
})

test('a failed World read is a named refusal, and the next ask may try again', async () => {
  configureWikiProjectionAccess('scope-fail', 'epoch-fail', () => true)
  const stub = kernelStub({worldFails: true})
  try {
    await assert.rejects(answerWikiSubjectStanding(REQUEST, HELD), /registers were not loaded.*the owner refused the World/)
    stub.state.worldFails = false
    await assert.rejects(answerWikiSubjectStanding(REQUEST, HELD), /could not be read/)
    assert.equal(stub.ops.filter(op => op === 'world_read').length, 2, 'the failed load was forgotten, so the next ask reads the World again')
  } finally {stub.restore()}
})

test('registers the Technē centre already published are not read from the World again', async () => {
  configureWikiProjectionAccess('scope-published', 'epoch-published', () => true)
  publishWikiNativeRegisters([{name: 'Factory', path: 'Work/Factory'}])
  const stub = kernelStub()
  try {
    await assert.rejects(answerWikiSubjectStanding(REQUEST, HELD), /could not be read/)
    assert.equal(stub.ops.filter(op => op === 'world_read').length, 0, 'the centre already disclosed the World')
    assert.equal(stub.ops.filter(op => op !== 'world_read').length, 2, 'the published registers are read through the owner path')
  } finally {stub.restore()}
})

test('the register load goes through the knowledge coordinator: never more register readings in flight than its bound (lane Q)', async () => {
  configureWikiProjectionAccess('scope-bounded', 'epoch-bounded', () => true)
  const projects = Array.from({length: 16}, (_, index) => ({name: `Project-${index}`, path: `Work/Project-${index}`}))
  const original = globalThis.fetch
  const reply = body => ({ok: true, status: 200, json: async () => body})
  let inFlight = 0, most = 0, reads = 0
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url === '/api/config') return reply({default_set: 'test', kernel_bridge: 'http://owner.test'})
    if (url !== 'http://owner.test/op') throw Error(`unexpected request ${url}`)
    const op = JSON.parse(init.body)
    if (op.op === 'world_read') return reply({ok: true, outcome: {result: 'world_read', snapshot: {navigator: {root: {work: {projects}}}}}})
    reads++; inFlight++; most = Math.max(most, inFlight)
    await new Promise(resolve => setTimeout(resolve, 15))
    inFlight--
    return reply({ok: false, error: `stub kernel: no ${op.op} reading`})
  }
  try {
    await assert.rejects(answerWikiSubjectStanding(REQUEST, HELD), /could not be read/)
    assert.equal(getWikiProjectionState().registers.length, 17, 'Central and the sixteen projects')
    assert.equal(reads, 17, 'every register read once')
    assert.ok(most <= 4, `at most the coordinator's four register readings at once (saw ${most}); the kernel bounds AIKit readers at five`)
    assert.ok(most >= 2, 'and they do run beside each other, not one by one')
  } finally { globalThis.fetch = original }
})

test('the pane owners gain exactly the one channel; every other channel and the attach hook are kept', () => {
  const base = {channels: {'kernel-expression': async () => 'kernel', 'central-read': async () => 'read'}, unavailableReason: undefined}
  const owners = withWikiSubjectStanding(base, source())
  assert.equal(owners.channels['kernel-expression'], base.channels['kernel-expression'])
  assert.equal(owners.channels['central-read'], base.channels['central-read'])
  assert.equal(typeof owners.channels[WIKI_SUBJECT_STANDING_CHANNEL], 'function')
  assert.equal(base.channels[WIKI_SUBJECT_STANDING_CHANNEL], undefined, 'the qualified owners are not mutated')
})

test('the boundary reads the request exactly: a malformed standing request is refused before any owner is asked', () => {
  assert.equal(WIKI_SUBJECT_STANDING_CHANNEL, 'wiki-subject-standing')
  assert.deepEqual(readWikiSubjectStandingRequest(REQUEST), REQUEST)
  assert.equal(readWikiSubjectStandingRequest({...REQUEST, revision: 0}), null)
  assert.equal(readWikiSubjectStandingRequest({...REQUEST, expression_ref: 'open'}), null)
  assert.equal(readWikiSubjectStandingRequest({...REQUEST, subject_ref: ''}), null)
  assert.equal(readWikiSubjectStandingRequest({...REQUEST, subject_ref: 'x'.repeat(513)}), null)
  assert.equal(readWikiSubjectStandingRequest(null), null)
})
