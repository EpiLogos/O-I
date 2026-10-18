// The ticket S (PATH §7): Technē's subject door completes — a subject chosen in the browser's World rows opens on the stage in the
// Scene that carries it, and a failure on that path is never silent.
//
// Seen headless against the real ground (15 Oct, lane S's own stack): the ask was posted and the stage pane opened, but nothing
// took the ask, and the row read "in O I · +2" while the stage stayed empty. The row now reads asked until the stage answers; the
// stage answers shown (the frame announced the Scene's Expression) or refused (the owner's words, or the deadline's); an ask nobody
// takes is answered by the door at its deadline, and the stage's wiring puts every refusal on the pane's fault line.
//
// Channels (each claim below is carried by exactly one):
// - SCRIPTED over fakes: subjectAsks.ts `followAsk` with a fake seam and fake timers; subjectOpenings.ts with a recorded follower;
//   the live seam's `pending` over the real projection store (wikiProjectionStore.ts requestWikiSelection);
// - SOURCE TEXT: the stage's wiring in panels/expressions.tsx (onSettled → the answer, the frame's announcement → shown, refusals on
//   the fault line), with no mode branch.
// The navigator's own settlement (taken, refused, returned to the seam) is the boundary's: packages/expressions-boundary/tests/
// techne-selection-settlement.test.mjs. Not covered here: the window on screen — UNVERIFIED, the lead's native pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/') || s === 'react-dom' || s.startsWith('react-dom/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const source = (await readFile(new URL(u), 'utf8')).replace(/import\\.meta\\.env/g, '({BASE_URL:"/"})');
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(source, {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const asks = await import('../src/techne/subject/subjectAsks.ts')
const openings = await import('../src/techne/subject/subjectOpenings.ts')
const rows = await import('../src/techne/subject/worldRows.ts')
const {liveAskEnv} = await import('../src/techne/subject/openSubject.ts')
const store = await import('../../../../desktop/cradle/src/techne/wikiProjectionStore.ts')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')

const ASKED = {registerKey: 'central', sceneRef: 'expression:techne-m0.central.x:scene:o-i'}
const OTHER = {registerKey: 'central', sceneRef: 'expression:techne-m0.central.x:scene:overview'}

/** A seam and a clock the test drives: `state.pending` says whether the ask is still untaken; `tick` fires the timers due. */
function seam(pending) {
  const timers = new Map(), state = {pending}
  let next = 1, now = 0
  return {
    state,
    env: {
      pending: () => state.pending,
      setTimer: (run, ms) => { const id = next++; timers.set(id, {run, at: now + ms}); return id },
      clearTimer: id => { timers.delete(id) },
    },
    tick(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.run() } },
    armed: () => timers.size,
  }
}

// ── the answer ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('an ask nobody takes is answered by the door at its deadline, in words that say what is known — and broadcast for the fault line', () => {
  const fake = seam(true)
  const heard = [], broadcast = []
  const stopBroadcast = asks.onAskAnswer(answer => broadcast.push(answer))
  const stop = asks.followAsk(ASKED, 'O-I', answer => heard.push(answer), fake.env)
  fake.tick(asks.ASK_TAKEN_WITHIN_MS - 1)
  assert.deepEqual(heard, [], 'nothing before the deadline')
  fake.tick(1)
  const words = asks.notTakenWords('O-I')
  assert.equal(words, "Technē's stage has not taken the ask to open O-I after 15 s: no Technē stage presenting the Expressions frame is listening for it. The ask stays posted, and opens when the stage is shown.")
  assert.deepEqual(heard, [{state: 'refused', ...ASKED, reason: words, by: 'door'}], 'the follower hears the door\'s answer once')
  assert.deepEqual(broadcast, heard, 'and it is broadcast, so the stage\'s wiring can say it on the pane\'s fault line')
  // A stage shown later takes the ask and answers it: the follower still listens, and stops once it is shown.
  asks.answerAsk({state: 'shown', ...OTHER, expression_ref: 'expression:techne-m0.central.x'})
  assert.equal(heard.length, 1, 'an answer for another Scene is not this ask\'s')
  asks.answerAsk({state: 'shown', ...ASKED, expression_ref: 'expression:techne-m0.central.x'})
  assert.deepEqual(heard.at(-1), {state: 'shown', ...ASKED, expression_ref: 'expression:techne-m0.central.x'})
  asks.answerAsk({state: 'refused', ...ASKED, reason: 'late', by: 'stage'})
  assert.equal(heard.length, 2, 'shown ends the follow')
  stop(); stopBroadcast()
})

test('a taken ask is never answered by the door; the stage answers it — refused in the owner\'s words, then shown', () => {
  const fake = seam(false)
  const heard = []
  const stop = asks.followAsk(ASKED, 'O-I', answer => heard.push(answer), fake.env)
  fake.tick(asks.ASK_TAKEN_WITHIN_MS)
  assert.deepEqual(heard, [], 'the ask left the seam: the door says nothing')
  assert.equal(fake.armed(), 0)
  asks.answerAsk({state: 'refused', ...ASKED, reason: 'This Wiki register is not disclosed by the native World', by: 'stage'})
  asks.answerAsk({state: 'refused', ...ASKED, reason: 'another door\'s deadline', by: 'door'})
  assert.deepEqual(heard.map(answer => [answer.state, answer.reason]), [['refused', 'This Wiki register is not disclosed by the native World']],
    'the stage\'s refusal is heard; a door\'s broadcast is the fault line\'s, not a follower\'s')
  stop()
  asks.answerAsk({state: 'shown', ...ASKED, expression_ref: 'expression:x'})
  assert.equal(heard.length, 1, 'a stopped follow hears nothing')
})

test('the live seam: an ask is pending while it is the projection store\'s untaken request, by register and Scene', () => {
  store.requestWikiSelection({registerKey: ASKED.registerKey, sceneRef: ASKED.sceneRef, entityRef: null, subjectRef: 'central:wiki:project:O-I', origin: 'external'})
  assert.equal(liveAskEnv.pending(ASKED), true)
  assert.equal(liveAskEnv.pending(OTHER), false)
  store.consumeWikiSelectionRequest()
  assert.equal(liveAskEnv.pending(ASKED), false, 'taken')
})

test('the stage\'s words when the owner focused the Scene but the frame did not show it say what the frame shows instead', () => {
  assert.equal(asks.notShownWords('O-I', 'expression:techne-m0.central.x', null),
    'Technē focused O-I in expression:techne-m0.central.x, but the Expressions frame has not shown it after 30 s: it reports no Scene, and it gave the shell no reason.')
  assert.match(asks.notShownWords('O-I', 'expression:a', 'expression:b'), /it still shows expression:b,/)
})

// ── held for every face ─────────────────────────────────────────────────────────────────────────────────────────────────────

const scene = (title, ref, extra = {}) => ({registerKey: 'central', expression_ref: 'expression:techne-m0.central.x', scene_ref: ref, scene_title: title,
  entity_ref: null, subject_ref: 'central:wiki:project:O-I', whole: false, overview: false, ...extra})
const O_I = scene('O I', ASKED.sceneRef, {whole: true}), OVERVIEW = scene('Central — wiki overview', OTHER.sceneRef, {overview: true})
const door = async () => ({state: 'asked', scene: O_I, others: [OVERVIEW]})

test('a subject asked reads asked until the stage answers: then shown, or the refusal in the stage\'s words, with its Scenes kept', async () => {
  openings.resetSubjectOpenings()
  const follows = []
  const follower = (asked, title, onAnswer) => { const row = {asked, title, onAnswer, stopped: false}; follows.push(row); return () => { row.stopped = true } }
  const subject = {ref: 'central:wiki:project:O-I', title: 'O-I'}
  const asked = await openings.openHeldSubject(subject, door, follower)
  assert.equal(asked.state, 'asked')
  assert.equal(rows.openingWords(asked, 'O-I').standing, 'asking for O I…', 'never "in O I" before the stage shows it')
  assert.deepEqual([follows[0].asked, follows[0].title], [ASKED, 'O-I'])
  follows[0].onAnswer({state: 'refused', ...ASKED, reason: asks.notTakenWords('O-I'), by: 'door'})
  const refused = openings.subjectOpenings().get(subject.ref)
  assert.deepEqual([refused.state, refused.reason, refused.scenes.length], ['refused', asks.notTakenWords('O-I'), 2])
  assert.equal(rows.openingWords(refused, 'O-I').standing, asks.notTakenWords('O-I'), 'the row stands on the words')
  assert.deepEqual(rows.sceneRowsOf(refused, 'O-I').map(row => [row.name, row.standing]), [['O I', 'not open'], ['Central — wiki overview', 'the register’s overview']],
    'the Scenes stay listed; another is a press away')
  follows[0].onAnswer({state: 'shown', ...ASKED, expression_ref: 'expression:techne-m0.central.x'})
  const shown = openings.subjectOpenings().get(subject.ref)
  assert.deepEqual([shown.state, shown.expression_ref], ['shown', 'expression:techne-m0.central.x'], 'a stage shown later takes it and shows it')
  assert.equal(rows.openingWords(shown, 'O-I').standing, 'in O I · +1')
  // Asked again: the older follow ends, and its late answers change nothing.
  await openings.openHeldSubject(subject, door, follower)
  assert.equal(follows[0].stopped, true, 'a newer ask for the subject ends the older follow')
  assert.equal(openings.subjectOpenings().get(subject.ref).state, 'asked')
  openings.resetSubjectOpenings()
  assert.equal(follows[1].stopped, true, 'a reset ends every follow')
})

// ── the stage's wiring ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('source: the stage answers through the one seam — settled asks, the frame\'s announcement, refusals on the fault line — with no mode branch', async () => {
  const panel = await source('panels/expressions.tsx')
  // Lane D: the stage's answers live in techne/subject/subjectAsks.ts (createStageAnswers, behaviour in techne-ask-faults.test.mjs);
  // the panel wires them, and no ask refusal enters the panel's own faults (every Expressions pane in every mode draws those).
  assert.match(panel, /const stageAnswers = createLiveStageAnswers\(\(\) => mounted\?\.host\.getState\(\)\)/)
  assert.match(panel, /onSettled: settlement => \{if \(live\) stageAnswers\.settle\(settlement\)\}/, 'the navigator\'s settlements reach the answer')
  assert.match(panel, /onState: state => \{\n\s+if \(!live\) return\n\s+stageAnswers\.seen\(state\.nativeScene\?\.expression_ref\)/, 'the frame\'s own announcement is what shows an opened ask')
  assert.doesNotMatch(panel, /\baskFault\(|notShownWords\(|answerAsk\(/, 'an ask\'s refusal stands on its own pane\'s fault line (askFault.ts), never in the panel\'s faults')
  assert.match(panel, /live = false; setExpressionOwner\(null\); stageAnswers\.dispose\(\)/, 'the wiring leaves with the panel')
  const MODE = /[!=]==\s*'(?:live|base|central|factory|expressions|techne|audio)'|'(?:live|base|central|factory|expressions|techne|audio)'\s*[!=]==|\bis[A-Z]\w*Mode\(/
  for (const file of ['techne/subject/subjectAsks.ts', 'techne/subject/subjectOpenings.ts', 'techne/subject/openSubject.ts', 'techne/subject/worldRows.ts', 'techne/clipBinding.ts', 'techne/subject/askFault.ts']) {
    assert.doesNotMatch(await source(file), MODE, `${file} adds no mode branch`)
  }
  const door = await source('techne/subject/subjectOpenings.ts')
  assert.match(door, /follower: AskFollower = followLiveAsk/, 'the held answer follows the live seam by default')
})
