import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const browser = await import('../src/agent/AgentShellBrowser.tsx')

// F2 — the Skillsets rows are the sets AIKit holds (`aikit set list` through agent_definition `skillsets`; manual §19.7 "Drag a set
// from the browser onto a chain"). REPLACED (ticket 743; DLW build ruling 2026-11-12): they were the roster's accepted profiles'
// skill_refs — Skills, not sets — and a drop admits the row's ref to the profile's skill_set_refs. Never a crowd literal.
const SETS = {result: 'agent_definition_reading', data: {sets: [
  {name: 'central:documentation', provenance: 'central', members: 19, projected: 18, withheld: 1, summary: 'How Central writes its documents'},
  {name: 'core-development', provenance: 'ai-kit', members: 1, projected: 1, withheld: 0, summary: ''},
]}}

test('skillset rows refuse by name when AIKit\'s set list errors', () => {
  const rows = browser.skillsetRowsFromSets(null, 'Action refused: unknown field')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].key, 'skillsets-unadmitted')
  assert.match(rows[0].label, /^No SkillSets read — waiting on AIKit — agent_definition skillsets \(`aikit set list`\) refused: Action refused: unknown field/)
  assert.equal(rows[0].meta, 'ai-kit · refused')
  assert.equal(rows[0].drag, undefined)
})

test('skillset rows name where a set comes from when AIKit holds none', () => {
  const empty = browser.skillsetRowsFromSets({result: 'agent_definition_reading', data: {sets: []}}, null)
  assert.deepEqual(empty.map(row => row.key), ['skillsets-empty'])
  assert.match(empty[0].label, /AIKit's set list names none; a set made or installed through AIKit is listed here/)
  // Rows without a name are left out, never drawn as a set; a reply with no list at all is a refusal, not an empty list.
  assert.deepEqual(browser.skillsetRowsFromSets({result: 'agent_definition_reading', data: {sets: [{members: 2}, 'x']}}, null).map(row => row.key), ['skillsets-empty'])
  assert.match(browser.skillsetRowsFromSets({result: 'agent_definition_reading', data: {profiles: []}}, null)[0].label, /the reply holds no set list/)
})

test('skillset rows are AIKit\'s sets by name, sorted, each with its members and where it comes from', () => {
  const rows = browser.skillsetRowsFromSets({...SETS, data: {sets: [...SETS.data.sets].reverse()}}, null)
  assert.deepEqual(rows.map(row => [row.key, row.label, row.meta, row.standing]),
    [['central:documentation', 'central:documentation', 'skillset', '19'], ['core-development', 'core-development', 'skillset', '1']])
  assert.equal(rows[0].hover, 'SkillSet central:documentation · 19 members, 18 projected here, 1 withheld · central — How Central writes its documents · drag it onto an agent\'s chain')
  assert.equal(rows[1].hover, 'SkillSet core-development · 1 member, 1 projected here · ai-kit · drag it onto an agent\'s chain')
})

test('a wrong result kind is a refusal, not an empty list', () => {
  const rows = browser.skillsetRowsFromSets({result: 'something_else', data: {}}, null)
  assert.equal(rows[0].key, 'skillsets-unadmitted')
})

// F3 — the Git rows derive from the workcell family's seat reading
// (workcell_status_read, the same reading the chain's git admit light
// consumes). Never a seat literal about the machine the code was written on.
test('git rows carry the seat reading\'s own workcell_ref', () => {
  const rows = browser.gitRowsFromWorkcell(
    {result: 'workcell_status_reading', data: {workcell_ref: 'workcell:mac', health: 'ok'}},
    null,
  )
  assert.deepEqual(rows, [{key: 'seat', label: 'Git · workcell:mac', meta: 'workcell'}])
})

test('git rows refuse by name when the seat read errors', () => {
  const rows = browser.gitRowsFromWorkcell(null, 'workcell status unavailable')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].key, 'seat-unavailable')
  assert.ok(rows[0].label.includes('workcell_status_read'), 'the absent source is named')
  assert.ok(rows[0].label.includes('workcell status unavailable'), 'the reason is carried')
  assert.ok(rows[0].meta.includes('refused'))
})

test('a seat reading without a workcell_ref discloses the absence, never invents a seat', () => {
  const rows = browser.gitRowsFromWorkcell({result: 'workcell_status_reading', data: {health: 'ok'}}, null)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].key, 'seat-no-ref')
  assert.ok(rows[0].label.includes('disclosed no workcell_ref'))
  assert.ok(!rows[0].label.includes('unavailable'), 'an answered reading is not unavailable')
  assert.equal(rows[0].drag, undefined, 'an answered row with no ref drags nothing')
})

// PATH §10 item 27 — an answered seat without a workcell_ref is not a refusal.
// Refused is reserved for an owner read that errored (seatError set).
test('an answered seat without a workcell_ref is labelled as answered, not refused', () => {
  const rows = browser.gitRowsFromWorkcell({result: 'workcell_status_reading', data: {health: 'ok'}}, null)
  assert.equal(rows[0].meta, 'workcell · no ref')
  assert.ok(!rows[0].meta.includes('refused'), 'the meta does not call an answered reading refused')
  assert.ok(!rows[0].label.includes('refused'), 'the label does not call an answered reading refused')
  assert.ok(rows[0].label.includes('answered'), 'the label says the reading answered')
})

test('a seat read that errored is refused by name', () => {
  const rows = browser.gitRowsFromWorkcell(null, 'Action refused: workcell offline')
  assert.equal(rows[0].key, 'seat-unavailable')
  assert.equal(rows[0].meta, 'workcell · refused')
  assert.ok(rows[0].label.includes('Action refused: workcell offline'), 'the owner words are carried')
})

test('no seat reading and no read error is unread, not refused', () => {
  const rows = browser.gitRowsFromWorkcell(null, null)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].key, 'seat-unread')
  assert.equal(rows[0].meta, 'workcell · unread')
  assert.ok(!rows[0].meta.includes('refused'), 'nothing was refused when nothing was read')
})

// The faulted literals themselves are dead in the component source.
test('no fabricated skillset crowd and no machine-bound seat literal remain in the browser', async () => {
  const source = await readFile(new URL('../src/agent/AgentShellBrowser.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\bSKILLSETS\b/)
  assert.doesNotMatch(source, /'Porting'|'Review'|'Research'|'Ops'/)
  assert.doesNotMatch(source, /env-1/)
  // The rows come from the two admitted readings.
  // REPLACED (ticket 743): the Skillsets rows came from the roster (skillsetRowsFromRoster); they are AIKit's set list, read once for the window.
  assert.match(source, /skillsetRowsFromSets\(setsOutcome, setsError\)/)
  assert.match(source, /const setsAnswer = useSkillSetsAnswer\(transport, null\)\.reading/)
  assert.match(source, /row\.meta === 'skillset'\n\s*\? \{\.\.\.row, drag: \{family: 'skillset' as const, ref: row\.key, label: row\.label\}\}/, 'a set row drags its name')
  assert.match(source, /gitRowsFromWorkcell\(seatOutcome, seatError\)/)
})
