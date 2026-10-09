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

// F2 — the Skillsets rows derive from the roster reading (the ai-kit skillset
// registry's admitted instances: accepted profiles' skill_refs, the same
// reading the chain's skillset admit light consumes). Never a crowd literal.
test('skillset rows refuse by name when the roster read errors', () => {
  const rows = browser.skillsetRowsFromRoster(null, 'Action refused: unknown field')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].key, 'skillsets-unadmitted')
  assert.ok(rows[0].label.includes('No skillsets admitted through the door yet'))
  assert.ok(rows[0].label.includes('roster'), 'the refused source is named')
  assert.ok(rows[0].label.includes('Action refused: unknown field'), 'the reason is carried verbatim')
  assert.ok(rows[0].meta.includes('refused'))
})

test('skillset rows name the absent source when the read answers with nothing admitted', () => {
  const empty = browser.skillsetRowsFromRoster({result: 'agent_definition_reading', data: {profiles: []}}, null)
  assert.equal(empty.length, 1)
  assert.equal(empty[0].key, 'skillsets-empty')
  assert.ok(empty[0].label.includes('accepted agent profiles carrying skill_refs'), 'names what would supply the rows')
  // Malformed data is the honest empty state, never a crash or a fabricated row.
  const malformed = browser.skillsetRowsFromRoster({result: 'agent_definition_reading', data: {profiles: 'nope'}}, null)
  assert.deepEqual(malformed.map(row => row.key), ['skillsets-empty'])
})

test('skillset rows equal the reading entries: accepted profiles\' skill_refs, sorted, unique', () => {
  const reading = {
    result: 'agent_definition_reading',
    data: {
      profiles: [
        {accepted: true, profile: {agent_ref: 'central:alpha', skill_refs: ['port-widgets', 'review-pr']}},
        {accepted: false, profile: {agent_ref: 'central:beta', skill_refs: ['refused-skill']}},
        {accepted: true, profile: {agent_ref: 'central:gamma', skill_refs: ['port-widgets', 'diff-grammar']}},
      ],
    },
  }
  const rows = browser.skillsetRowsFromRoster(reading, null)
  assert.deepEqual(rows.map(row => row.key), ['diff-grammar', 'port-widgets', 'review-pr'])
  assert.deepEqual(rows.map(row => row.label), ['diff-grammar', 'port-widgets', 'review-pr'])
  for (const row of rows) assert.equal(row.meta, 'skillset')
})

test('a wrong result kind is a refusal, not an empty admission', () => {
  const rows = browser.skillsetRowsFromRoster({result: 'something_else', data: {}}, null)
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
  assert.equal(rows[0].key, 'seat-unavailable')
  assert.ok(rows[0].label.includes('disclosed no workcell_ref'))
})

// The faulted literals themselves are dead in the component source.
test('no fabricated skillset crowd and no machine-bound seat literal remain in the browser', async () => {
  const source = await readFile(new URL('../src/agent/AgentShellBrowser.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\bSKILLSETS\b/)
  assert.doesNotMatch(source, /'Porting'|'Review'|'Research'|'Ops'/)
  assert.doesNotMatch(source, /env-1/)
  // The rows come from the two admitted readings.
  assert.match(source, /skillsetRowsFromRoster\(rosterOutcome, rosterError\)/)
  assert.match(source, /gitRowsFromWorkcell\(seatOutcome, seatError\)/)
})
