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

const REQUEST = {subject_ref: 'wiki:subject:alpha', expression_ref: 'expression:open', revision: 4}
const HELD = {expression_ref: 'expression:open', revision: 4}
const STANDING = {registerKey: 'central/register-one', expression_ref: 'expression:wiki', scene_ref: 'scene:wiki-1', scene_title: 'Opening',
  entity_ref: 'entity:wiki-a', entity_title: 'Alpha', subject_ref: 'wiki:subject:alpha'}

/** A fake owner reading: the rows it holds for a subject, whether registers are loaded, and its revision. */
function source({rows = [STANDING], loaded = true, revision = 9} = {}) {
  const asked = []
  return {
    asked,
    registersLoaded: () => loaded,
    revision: () => revision,
    standingsOf: subjectRef => {asked.push(subjectRef); return rows},
  }
}

test('the owner answers the exact basis with the rows of its own reading, in the boundary reply shape', () => {
  const reply = answerWikiSubjectStanding(REQUEST, HELD, source())
  assert.deepEqual(reply, {
    subject_ref: 'wiki:subject:alpha', expression_ref: 'expression:open', revision: 4, standing_revision: 9,
    rows: [{register_key: 'central/register-one', expression_ref: 'expression:wiki', scene_ref: 'scene:wiki-1', scene_title: 'Opening',
      entity_ref: 'entity:wiki-a', entity_title: 'Alpha', subject_ref: 'wiki:subject:alpha'}],
  })
})

test('a subject with no wiki standing is answered with no rows, not refused', () => {
  const reply = answerWikiSubjectStanding(REQUEST, HELD, source({rows: []}))
  assert.deepEqual(reply.rows, [])
  assert.equal(reply.revision, 4)
})

test('a request for an Expression or revision the host no longer holds is refused by name, and the owner is not asked', () => {
  const owner = source()
  assert.throws(() => answerWikiSubjectStanding(REQUEST, {expression_ref: 'expression:other', revision: 4}, owner), /The open Expression moved/)
  assert.throws(() => answerWikiSubjectStanding(REQUEST, {expression_ref: 'expression:open', revision: 5}, owner), /The open Expression moved/)
  assert.throws(() => answerWikiSubjectStanding(REQUEST, null, owner), /The open Expression moved/)
  assert.deepEqual(owner.asked, [], 'a stale basis reads no standing')
})

test('with no wiki register loaded the answer is a named refusal, never an empty standing', () => {
  assert.throws(() => answerWikiSubjectStanding(REQUEST, HELD, source({loaded: false})), /No wiki register is loaded/)
})

test('a standing larger than the bound is refused by name, never truncated', () => {
  const rows = Array.from({length: WIKI_STANDING_ROW_LIMIT + 1}, () => STANDING)
  assert.throws(() => answerWikiSubjectStanding(REQUEST, HELD, source({rows})), /more than the Library shows/)
})

test('the channel owner answers from the basis the host announced for the frame, and refuses when none is announced', async () => {
  const channel = wikiStandingChannel(source())
  const reply = await channel(REQUEST, {state: {nativeScene: {expression_ref: 'expression:open', revision: 4, scene_ref: 'scene:one'}}})
  assert.equal(reply.standing_revision, 9)
  await assert.rejects(channel(REQUEST, {state: null}), /The open Expression moved/)
  await assert.rejects(channel(REQUEST, {state: {}}), /The open Expression moved/)
})

test('the live source refuses honestly in a shell where no wiki register is loaded', () => {
  assert.equal(liveWikiStandingSource.registersLoaded(), false, 'a fresh shell holds no register')
  assert.deepEqual(liveWikiStandingSource.standingsOf('wiki:subject:alpha'), [])
  assert.throws(() => answerWikiSubjectStanding(REQUEST, HELD), /No wiki register is loaded/)
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
