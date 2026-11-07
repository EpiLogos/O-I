// O-I #747 round 891, XT12 (manual §20.1 Export's table, Film: "What plays, from the moment you start the recording until you stop it").
// Walk 891 pressed File › Export › Film… twice in Session view: the take was kept and named, and the frame opened it for review — a
// download needs a click inside the application — but the frame stood under the set's view, so the review, what the take was made from
// and Save recording were nowhere to be seen, and the fault line said "Choose Save recording there". Now the answer that opens the
// review brings the field in front (Pane view, where the frame stands). The line is left as it stands: clearing it while the frame
// records changes the field's height, and the frame stops a take on any resize (walk 891 captures-7: an empty remade film).
// SCRIPTED — the pure answer; CODE-READING — the panel's menu act wires it.
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
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

const Stage = await import('../src/components/expressions/studio/StudioStage.tsx')
const Commands = await import('../src/native/stageCommands.ts')
const REVIEW = 'The take is open for review. Choose Save recording there: a download needs a click inside the application.'
const withTake = take => ({recording: false, stage: {mode: '2d', grid: false, snap: false, guides: false, tool: 'select', repeatPins: false, videoTake: take}})

test('XT12: the answer that opens the take for review in the frame is told apart from every other answer', () => {
  const [, save] = Stage.menuStageCommands('file.export.film', {...withTake(false), recording: true})
  assert.deepEqual(save, Commands.STAGE_SAVE_VIDEO)
  assert.equal(Stage.reviewStandsInFrame(save, {ok: false, error: REVIEW}, withTake(true)), true, 'a take, not saved from here: its review stands in the frame')
  assert.equal(Stage.reviewStandsInFrame(save, {ok: true}, withTake(true)), false, 'saved where it is kept (a Physis host): nothing to show')
  assert.equal(Stage.reviewStandsInFrame(save, {ok: false, error: 'No recording take to save.'}, withTake(false)), false, 'no take: a refusal, nothing to show')
  assert.equal(Stage.reviewStandsInFrame(Commands.stageRecord('stop', Commands.STAGE_CAPTURE_DEFAULTS), {ok: false, error: 'No recording is running.'}, withTake(true)), false,
    'another act\'s refusal never moves the view')
  assert.equal(Stage.reviewStandsInFrame(save, {ok: false, error: REVIEW}, null), false, 'no frame state: nothing is known to stand')
})

test('XT12: the panel brings the field in front for the review', async () => {
  const panel = await readFile(new URL('../src/panels/expressions.tsx', import.meta.url), 'utf8')
  assert.match(panel, /import \{[^}]*\bshowMainView\b[^}]*\} from '\.\.\/shell\/mainView'/)
  const act = panel.slice(panel.indexOf('const menuAct = (event: Event) => {'), panel.indexOf('window.addEventListener(MENU_ACT, menuAct)'))
  assert.ok(act.length > 0, 'the menu act is where it was')
  assert.match(act, /if \(reviewStandsInFrame\(command, result, host\.getState\(\)\)\) showMainView\('pane'\)/, 'the review answer shows Pane view, where the frame stands')
})
