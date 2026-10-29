import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

// The Agent's Team cell (DLW §19.4; O-I #684 `team.space`, `team.row`, `team.question`, `team.depth`): where the agent stands in Anima or
// Aletheia, read from Quaternal Logic's team space (`ql context-frame team-space`, `ql.vak-team-space/v1`, the kernel's team_space) for the
// agent the session names. A Voice of Anima stands in its frame's row and is asked that row's Day question (else the Night′ question it
// answers); a member of Aletheia is asked the Night′ question it answers in each row it sits in; an organ's lead stands at the depth of its
// organ's proving Position. Nothing is drawn that the team space does not say.
// Channels:
// - REAL (tests/fixtures/ql-team-space-2026-10-29.json): the installed quaternal-logic's team space, 29 Oct.
// - SCRIPTED: the Agent's binding the cell joins (a stand-in with the Agent's own keys).
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
  if(url.includes('?raw')||url.endsWith('.html'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText.split('import.meta.env').join('({BASE_URL: "/"})')};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}

const team = await import('../src/agent/devices/teamCell.ts')
const SPACE = JSON.parse(readFileSync(new URL('./fixtures/ql-team-space-2026-10-29.json', import.meta.url), 'utf8')).answer

test('a Voice of Anima stands in its frame\'s row and is asked its Day question; Nous, who has none, the Night′ question it answers', () => {
  const eros = team.teamCellOf({space: SPACE}, 'agent/anima-eros')
  assert.deepEqual(eros.values, {'team.space': 'Anima', 'team.row': 'CF3', 'team.question': '4.2 What is being done?'})
  assert.match(eros.standing['team.depth'], /no reading here names the Position/)
  const nous = team.teamCellOf({space: SPACE}, 'agent/anima-nous')
  assert.deepEqual([nous.values['team.row'], nous.values['team.question']], ['CF1', '4.0 What don\'t we know?'])
})

test('a member of Aletheia is asked the Night′ question it answers in each row it sits in, and one who answers none says so', () => {
  const moirai = team.teamCellOf({space: SPACE}, 'agent/aletheia-moirai')
  assert.deepEqual(moirai.values, {'team.space': 'Aletheia', 'team.row': 'CF3, CF5, CF7',
    'team.question': '4.1 What evidence exists? · 4.4 What sources inform? · 4.5 What crystallises?'})
  const janus = team.teamCellOf({space: SPACE}, 'agent/aletheia-janus')
  assert.deepEqual([janus.values['team.space'], janus.values['team.row'], janus.values['team.question']], ['Aletheia', 'CF2', undefined])
  assert.match(janus.standing['team.question'], /asks no question of agent\/aletheia-janus/)
})

test('an organ\'s lead stands at the depth of its proving Position; an agent in no team is in none; no agent and no reading are named', () => {
  const lead = team.teamCellOf({space: SPACE}, 'agent/aletheia')
  assert.deepEqual([lead.values['team.space'], lead.values['team.depth']], ['Aletheia', 'M5 Epii'])
  assert.match(lead.standing['team.row'], /stands in no frame row/)
  const anima = team.teamCellOf({space: SPACE}, 'agent/anima')
  assert.deepEqual(anima.values, {'team.space': 'Anima', 'team.row': 'CF5', 'team.depth': 'M4 Nara'})
  assert.deepEqual(team.teamCellOf({space: SPACE}, 'agent/ql-guardian').values, {'team.space': 'none'})
  assert.match(team.teamCellOf({space: SPACE}, null).standing['team.space'], /No agent is seated/)
  assert.match(team.teamCellOf({space: null, error: 'ql: no team space'}, 'agent/anima-eros').standing['team.space'], /no team space/)
  assert.equal(team.teamCellOf({space: null}, 'agent/anima-eros').waiting, true, 'unread: the cell waits')
  assert.match(team.teamCellOf({space: {contract: 'other'}}, 'agent/anima-eros').standing['team.space'], /not its team space/)
})

test('the cell joins the Agent\'s binding: its four keys read, nothing else of the Agent moves', () => {
  const agent = {id: 'factory:agent', values: {agent: 'agent/anima-eros', light: 'lit'}, standing: {cap: {disabled: 'Budget: …'}}, writes: key => key === 'effort', write: async () => {}}
  const joined = team.withTeamCell(agent, {space: SPACE}, 'agent/anima-eros')
  assert.equal(joined.values['team.row'], 'CF3')
  assert.equal(joined.values.light, 'lit')
  assert.equal(joined.standing.cap.disabled, 'Budget: …')
  assert.match(joined.standing['team.depth'].disabled, /Position/)
  assert.equal(joined.writes('team.row'), false, 'the cell is a reading')
  const waiting = team.withTeamCell(agent, {space: null}, 'agent/anima-eros')
  assert.ok(waiting.waiting.includes('team.space'))
  assert.equal(team.withTeamCell(null, {space: SPACE}, 'agent/anima-eros'), null)
})
