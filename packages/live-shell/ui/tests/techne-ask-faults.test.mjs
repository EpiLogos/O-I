// Lane D (PATH §7, 16 Oct): the frame's refusal of a Technē ask reaches the ask, and a fault line belongs to its pane and mode.
//
// Seen natively by the lead (m4 build) and headless on the real ground (lane D's scripted door trace): the frame refused the door's
// Scene with a revision conflict shown only as its own toast; the row stayed "asking for O I…" and after 30 s the pane said the frame
// "gave the shell no reason"; and that fault line still stood on Expressions' pane after the mode changed, because every refusal was
// written into the one Expressions panel's faults, which every Expressions pane draws.
//
// Channels (each claim carried by one):
// - SCRIPTED over fakes: subjectAsks.ts `createStageAnswers` (the stage's answers, ported from panels/expressions.tsx) with a fake
//   stage and fake timers; askFault.ts over the real answer broadcast; subjectOpenings.ts with a recorded follower;
// - SOURCE TEXT: the pane body draws its own pane's ask fault (projections/expressionsPane.tsx).
// The frame's answer to the host's open is the boundary's (packages/expressions-boundary/tests/open-answer.test.mjs) and the frame's
// (desktop/cradle/expressions-app/field-studies-journeys/tests/opened-work-saved.test.mjs). Not covered: the window — UNVERIFIED.
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
const faults = await import('../src/techne/subject/askFault.ts')
const openings = await import('../src/techne/subject/subjectOpenings.ts')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')

const ASKED = {registerKey: 'central', sceneRef: 'expression:techne-m0.central.x:scene:o-i'}
const REF = 'expression:techne-m0.central.x'
const CONFLICT = 'revision_conflict: the native Expression changed; inspect its current basis before trying again'

/** A stage the test drives: what the frame shows, which pane presents it, and a clock. */
function stage() {
  const timers = new Map(), state = {shown: 'expression:techne-m0.o-i.y', pane: 'pane:techne-stage', mode: 'techne'}
  let next = 1, now = 0
  return {
    state,
    env: {
      shownRef: () => state.shown,
      paneId: () => state.pane,
      mode: () => state.mode,
      setTimer: (run, ms) => { const id = next++; timers.set(id, {run, at: now + ms}); return id },
      clearTimer: id => { timers.delete(id) },
    },
    tick(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.run() } },
    armed: () => timers.size,
  }
}
const opened = answer => ({state: 'opened', request: {...ASKED, title: 'O I'}, open: {expression_ref: REF}, ...(answer ? {answer} : {})})
function hear() {
  const heard = []
  const stop = asks.onAskAnswer(answer => heard.push(answer))
  return {heard, stop}
}

// ── the frame's refusal reaches the ask ─────────────────────────────────────────────────────────────────────────────────────

test('the frame refuses the open: the ask is refused at once in the frame\'s words, on the pane whose stage took it', async () => {
  const fake = stage(), {heard, stop} = hear()
  const answers = asks.createStageAnswers(fake.env)
  answers.settle(opened(Promise.resolve({ok: false, error: CONFLICT})))
  fake.state.pane = 'pane:expressions'; fake.state.mode = 'expressions'
  await new Promise(resolve => setTimeout(resolve, 0))
  const words = asks.refusedWords('O I', REF, CONFLICT)
  assert.equal(words, `Technē focused O I in ${REF}, but the Expressions frame refused to show it: ${CONFLICT}`)
  assert.deepEqual(heard, [{state: 'refused', ...ASKED, reason: words, by: 'stage', paneId: 'pane:techne-stage', mode: 'techne'}],
    'refused in the owner\'s reason the frame was given — before lane D the ask waited 30 s for "it gave the shell no reason"')
  assert.equal(fake.armed(), 0, 'the deadline is spent')
  fake.tick(asks.SCENE_SHOWN_WITHIN_MS)
  answers.seen(REF)
  assert.equal(heard.length, 1, 'one answer per ask')
  stop(); answers.dispose()
})

test('a frame that says nothing is still refused at its deadline — the 30 s honesty line stands for a real stall', () => {
  const fake = stage(), {heard, stop} = hear()
  const answers = asks.createStageAnswers(fake.env)
  answers.settle(opened(new Promise(() => {})))
  fake.tick(asks.SCENE_SHOWN_WITHIN_MS - 1)
  assert.deepEqual(heard, [])
  fake.tick(1)
  assert.deepEqual(heard, [{state: 'refused', ...ASKED, reason: asks.notShownWords('O I', REF, 'expression:techne-m0.o-i.y'), by: 'stage', paneId: 'pane:techne-stage', mode: 'techne'}])
  stop(); answers.dispose()
})

test('the frame shows it: shown, once; a late refusal of the open changes nothing', async () => {
  const fake = stage(), {heard, stop} = hear()
  const answers = asks.createStageAnswers(fake.env)
  let refuse
  answers.settle(opened(new Promise(resolve => { refuse = resolve })))
  answers.seen(REF)
  refuse({ok: false, error: 'late'})
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(heard, [{state: 'shown', ...ASKED, expression_ref: REF}])
  assert.equal(fake.armed(), 0)
  // Already standing on the Expression when the ask is settled: shown at once (the ported behaviour).
  fake.state.shown = REF
  answers.settle(opened())
  assert.equal(heard.at(-1).state, 'shown')
  // The navigator's own refusal names the pane presenting the stage now.
  answers.settle({state: 'refused', request: ASKED, reason: 'This Wiki register is not disclosed by the native World'})
  assert.deepEqual(heard.at(-1), {state: 'refused', ...ASKED, reason: 'This Wiki register is not disclosed by the native World', by: 'stage', paneId: 'pane:techne-stage', mode: 'techne'})
  stop(); answers.dispose()
})

// ── the fault line belongs to its pane and mode ─────────────────────────────────────────────────────────────────────────────

test('a refusal stands on the fault line of the pane whose stage took the ask, in the cut it took it in, and nowhere else', () => {
  faults.clearAskFault()
  asks.answerAsk({state: 'refused', ...ASKED, reason: CONFLICT, by: 'stage', paneId: 'pane:techne-stage', mode: 'techne'})
  assert.equal(faults.askFaultIn('pane:techne-stage', 'techne'), CONFLICT)
  assert.equal(faults.askFaultIn('pane:expressions', 'expressions'), null, 'another pane')
  assert.equal(faults.askFaultIn('pane:techne-stage', 'expressions'), null,
    'the same stage pane in another mode\'s tree (one binding per kind) — before lane D every mode\'s Expressions pane drew Technē\'s fault')
  assert.equal(faults.askFaultIn('pane:techne-stage', 'techne'), CONFLICT, 'back in the cut that took the ask, it stands again until it settles')
  asks.answerAsk({state: 'shown', registerKey: 'central', sceneRef: 'expression:other:scene:z', expression_ref: 'expression:other'})
  assert.equal(faults.askFaultIn('pane:techne-stage', 'techne'), CONFLICT, 'another ask\'s answer leaves it')
  asks.answerAsk({state: 'shown', ...ASKED, expression_ref: REF})
  assert.equal(faults.askFaultIn('pane:techne-stage', 'techne'), null, 'it clears when its subject settles shown')
  asks.answerAsk({state: 'refused', ...ASKED, reason: CONFLICT, by: 'stage', paneId: 'pane:techne-stage'})
  assert.equal(faults.askFaultIn('pane:techne-stage', 'expressions'), CONFLICT, 'a refusal naming no cut (an older wiring) is scoped by its pane alone')
  faults.clearAskFault()
})

test('the pane leaving clears its fault; another pane\'s leaving does not; the door\'s deadline belongs to no pane', () => {
  faults.clearAskFault()
  asks.answerAsk({state: 'refused', ...ASKED, reason: CONFLICT, by: 'stage', paneId: 'pane:techne-stage', mode: 'techne'})
  faults.clearAskFault('pane:expressions')
  assert.equal(faults.askFaultIn('pane:techne-stage', 'techne'), CONFLICT)
  faults.clearAskFault('pane:techne-stage')
  assert.equal(faults.askFault(), null, 'the pane changed instrument: its fault went with it')
  asks.answerAsk({state: 'refused', ...ASKED, reason: asks.notTakenWords('O-I'), by: 'door'})
  assert.deepEqual(faults.askFault(), {asked: ASKED, reason: asks.notTakenWords('O-I'), paneId: null, mode: null}, 'no stage took it: the row says it')
  assert.equal(faults.faultPane({by: 'stage'}, () => 'pane:placed'), 'pane:placed', 'a stage refusal naming no pane is the pane presenting the stage as it refuses')
  assert.equal(faults.faultPane({by: 'stage', paneId: null}, () => 'pane:placed'), null)
  faults.clearAskFault()
})

test('a newer ask clears the older ask\'s fault line', async () => {
  openings.resetSubjectOpenings()
  faults.clearAskFault()
  asks.answerAsk({state: 'refused', ...ASKED, reason: CONFLICT, by: 'stage', paneId: 'pane:techne-stage', mode: 'techne'})
  const scene = {registerKey: 'central', expression_ref: REF, scene_ref: ASKED.sceneRef, scene_title: 'O I', entity_ref: null, subject_ref: 'central:wiki:project:O-I', whole: true, overview: false}
  await openings.openHeldSubject({ref: 'central:wiki:project:O-I', title: 'O-I'}, async () => ({state: 'asked', scene, others: []}), () => () => {})
  assert.equal(faults.askFault(), null)
  openings.resetSubjectOpenings()
})

test('source: the pane body draws its own pane\'s ask fault, in the frame\'s announced cut, beside the frame\'s, and lets it go when the pane leaves', async () => {
  const pane = await source('projections/expressionsPane.tsx')
  assert.match(pane, /const askFault = useAskFault\(paneId, chrome\?\.state\?\.hostMode\)\n\s+const faults = \[\.\.\.new Set\(\[\.\.\.\(chrome\?\.faults \?\? \[\]\), \.\.\.\(askFault \? \[askFault\] : \[\]\)\]\)\]/)
  assert.match(pane, /unregisterExpressionsPane\(paneId, admission\)\n[\s\S]*?if \(!expressionsPaneAdmitted\(paneId\)\) clearAskFault\(paneId\)/)
  const MODE = /[!=]==\s*'(?:live|base|central|factory|expressions|techne|audio)'|'(?:live|base|central|factory|expressions|techne|audio)'\s*[!=]==|\bis[A-Z]\w*Mode\(/
  for (const file of ['techne/subject/askFault.ts', 'techne/subject/subjectAsks.ts', 'projections/expressionsPane.tsx']) assert.doesNotMatch(await source(file), MODE, `${file} adds no mode branch`)
})
